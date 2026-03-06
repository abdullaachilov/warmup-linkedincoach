import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sessionUpdateSchema, sessionGenerateSchema, actionCompleteSchema, postPerformanceSchema } from '../utils/input-validation.js';
import { db } from '../db.js';
import { makeAISuggestion } from '../services/ai-proxy.js';
import { buildUserContext } from '../services/user-context-builder.js';
import { SYSTEM_PROMPTS, getFallbackSession } from '../utils/prompts.js';
import { TOKEN_LIMITS } from '../types/index.js';
import type { DailySessionData, SessionAction } from '../types/index.js';

const router = Router();
router.use(requireAuth);

// Get today's dynamic session (creates fallback if none exists)
router.get('/today', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Check for existing dynamic session first
    const dynamicResult = await db.query(
      'SELECT * FROM daily_sessions WHERE user_id = $1 AND date = $2',
      [req.userId, today]
    );

    if (dynamicResult.rows.length > 0) {
      const session = dynamicResult.rows[0];
      res.json({
        id: session.id,
        date: session.date,
        session_data: session.session_data,
        actions_completed: session.actions_completed,
        actions_total: session.actions_total,
        completed_at: session.completed_at,
        is_dynamic: true,
      });
      return;
    }

    // No session yet - create a fallback session
    const dayOfWeek = new Date().getDay();
    const fallbackData = getFallbackSession(dayOfWeek) as DailySessionData;
    const actionsTotal = fallbackData.actions.length;

    const insertResult = await db.query(
      `INSERT INTO daily_sessions (user_id, date, session_data, actions_total)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, date) DO UPDATE SET session_data = daily_sessions.session_data
       RETURNING *`,
      [req.userId, today, JSON.stringify(fallbackData), actionsTotal]
    );

    const session = insertResult.rows[0];
    res.json({
      id: session.id,
      date: session.date,
      session_data: session.session_data,
      actions_completed: session.actions_completed,
      actions_total: session.actions_total,
      completed_at: session.completed_at,
      is_dynamic: false,
    });

    // Update last_active_at
    await db.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.userId]).catch(() => {});
  } catch (err) {
    console.error('Session fetch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Generate or regenerate today's session using AI
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const data = sessionGenerateSchema.parse(req.body);
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Build user context
    const { contextText } = await buildUserContext(req.userId!);

    // Get recent session history (last 3 days)
    const historyResult = await db.query(
      `SELECT date, session_data, actions_completed, actions_total
       FROM daily_sessions WHERE user_id = $1 AND date < $2
       ORDER BY date DESC LIMIT 3`,
      [req.userId, today]
    );

    let recentHistory = '';
    if (historyResult.rows.length > 0) {
      recentHistory = historyResult.rows.map((r: any) => {
        const completed = r.actions_completed || 0;
        const total = r.actions_total || 0;
        return `${r.date}: completed ${completed}/${total} actions`;
      }).join('\n');
    }

    // Format feed posts for AI context
    let feedPostsText = '';
    if (data.feed_posts && data.feed_posts.length > 0) {
      feedPostsText = data.feed_posts
        .slice(0, 5)
        .map((p, i) => `${i + 1}. ${p.author}: "${p.text.substring(0, 200)}"`)
        .join('\n');
    }

    const tier = (req.userTier || 'free') as 'free' | 'starter' | 'pro' | 'byok';

    let sessionData: DailySessionData;
    let tokensUsed = 0;

    try {
      const result = await makeAISuggestion({
        userId: req.userId!,
        tier,
        systemPrompt: SYSTEM_PROMPTS['generate-session'](contextText, days[dayOfWeek], recentHistory, feedPostsText),
        userMessage: '<task>Generate my personalized LinkedIn session for today.</task>',
        maxTokens: TOKEN_LIMITS['generate-session'].maxOutput,
        suggestionType: 'session_generation',
      });

      tokensUsed = result.tokensUsed;

      // Parse the AI response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.actions || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
        throw new Error('Invalid session structure');
      }

      // Ensure all actions have required fields and completed=false
      sessionData = {
        theme: parsed.theme || `${days[dayOfWeek]} session`,
        estimated_minutes: parsed.estimated_minutes || 5,
        actions: parsed.actions.map((a: any, i: number) => ({
          id: a.id || `action_${i + 1}`,
          category: validateCategory(a.category),
          label: String(a.label || '').substring(0, 200),
          sublabel: a.sublabel ? String(a.sublabel).substring(0, 200) : undefined,
          why: a.why ? String(a.why).substring(0, 200) : undefined,
          completed: false,
          ai_type: validateAIType(a.ai_type),
          context: a.context,
        })),
      };
    } catch (aiErr) {
      // Fallback to static session if AI fails
      console.warn('AI session generation failed, using fallback:', aiErr);
      const feedForFallback = data.feed_posts?.map(p => ({ author: p.author, text: p.text }));
      sessionData = getFallbackSession(dayOfWeek, feedForFallback) as DailySessionData;
    }

    // Check if there's an existing session with completed actions we need to preserve
    const existingResult = await db.query(
      'SELECT session_data, actions_completed FROM daily_sessions WHERE user_id = $1 AND date = $2',
      [req.userId, today]
    );

    let actionsCompleted = 0;
    if (existingResult.rows.length > 0) {
      const existingSession = existingResult.rows[0].session_data as DailySessionData;
      const completedIds = new Set(
        existingSession.actions?.filter((a: SessionAction) => a.completed).map((a: SessionAction) => a.id) || []
      );

      // Preserve completion status for actions with matching IDs
      sessionData.actions = sessionData.actions.map(a => {
        if (completedIds.has(a.id)) {
          actionsCompleted++;
          return { ...a, completed: true };
        }
        return a;
      });
    }

    // Upsert the session
    const upsertResult = await db.query(
      `INSERT INTO daily_sessions (user_id, date, session_data, context_snapshot, actions_completed, actions_total, generation_tokens_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, date) DO UPDATE SET
         session_data = $3,
         context_snapshot = $4,
         actions_completed = $5,
         actions_total = $6,
         generation_tokens_used = COALESCE(daily_sessions.generation_tokens_used, 0) + $7
       RETURNING *`,
      [
        req.userId,
        today,
        JSON.stringify(sessionData),
        data.feed_posts ? JSON.stringify({ feed_posts: data.feed_posts }) : null,
        actionsCompleted,
        sessionData.actions.length,
        tokensUsed,
      ]
    );

    const session = upsertResult.rows[0];
    res.json({
      id: session.id,
      date: session.date,
      session_data: session.session_data,
      actions_completed: session.actions_completed,
      actions_total: session.actions_total,
      completed_at: session.completed_at,
      is_dynamic: true,
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input.' });
      return;
    }
    console.error('Session generation error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Complete or uncomplete a specific action
router.put('/action', async (req: Request, res: Response) => {
  try {
    const data = actionCompleteSchema.parse(req.body);
    const today = new Date().toISOString().split('T')[0];

    const result = await db.query(
      'SELECT * FROM daily_sessions WHERE user_id = $1 AND date = $2',
      [req.userId, today]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No session found for today.' });
      return;
    }

    const session = result.rows[0];
    const sessionData = session.session_data as DailySessionData;

    // Find and update the action
    const actionIndex = sessionData.actions.findIndex((a: SessionAction) => a.id === data.action_id);
    if (actionIndex === -1) {
      res.status(404).json({ error: 'Action not found in session.' });
      return;
    }

    sessionData.actions[actionIndex].completed = data.completed;

    const actionsCompleted = sessionData.actions.filter((a: SessionAction) => a.completed).length;
    const isComplete = actionsCompleted >= sessionData.actions.length;

    await db.query(
      `UPDATE daily_sessions SET
         session_data = $1,
         actions_completed = $2,
         completed_at = $3
       WHERE user_id = $4 AND date = $5`,
      [
        JSON.stringify(sessionData),
        actionsCompleted,
        isComplete ? new Date().toISOString() : null,
        req.userId,
        today,
      ]
    );

    // Update streak if session just completed
    if (isComplete && !session.completed_at) {
      await updateStreak(req.userId!);
    }

    // Also sync to old sessions table for backward compatibility
    const completedActionIds = sessionData.actions
      .filter((a: SessionAction) => a.completed)
      .map((a: SessionAction) => a.id);

    await db.query(
      `INSERT INTO sessions (user_id, date, completed_actions, total_actions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, date) DO UPDATE SET
         completed_actions = $3`,
      [req.userId, today, JSON.stringify(completedActionIds), sessionData.actions.length]
    ).catch(() => {});

    res.json({
      actions_completed: actionsCompleted,
      actions_total: sessionData.actions.length,
      completed_at: isComplete ? new Date().toISOString() : null,
      session_data: sessionData,
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input.' });
      return;
    }
    console.error('Action update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Legacy: PUT /today still works for backward compatibility
router.put('/today', async (req: Request, res: Response) => {
  try {
    const data = sessionUpdateSchema.parse(req.body);
    const today = new Date().toISOString().split('T')[0];

    // If we have completed_actions, sync them into the dynamic session
    if (data.completed_actions) {
      const dynamicResult = await db.query(
        'SELECT * FROM daily_sessions WHERE user_id = $1 AND date = $2',
        [req.userId, today]
      );

      if (dynamicResult.rows.length > 0) {
        const session = dynamicResult.rows[0];
        const sessionData = session.session_data as DailySessionData;
        const completedSet = new Set(data.completed_actions);

        sessionData.actions = sessionData.actions.map((a: SessionAction) => ({
          ...a,
          completed: completedSet.has(a.id),
        }));

        const actionsCompleted = sessionData.actions.filter((a: SessionAction) => a.completed).length;
        const isComplete = actionsCompleted >= sessionData.actions.length;

        await db.query(
          `UPDATE daily_sessions SET
             session_data = $1,
             actions_completed = $2,
             completed_at = $3
           WHERE user_id = $4 AND date = $5`,
          [
            JSON.stringify(sessionData),
            actionsCompleted,
            isComplete && !session.completed_at ? new Date().toISOString() : session.completed_at,
            req.userId,
            today,
          ]
        );
      }
    }

    // Also update old sessions table
    const result = await db.query(
      `INSERT INTO sessions (user_id, date, completed_actions, post_drafted, post_published, connections_sent, total_actions)
       VALUES ($1, $2, $3, $4, $5, $6, 10)
       ON CONFLICT (user_id, date) DO UPDATE SET
         completed_actions = COALESCE($3, sessions.completed_actions),
         post_drafted = COALESCE($4, sessions.post_drafted),
         post_published = COALESCE($5, sessions.post_published),
         connections_sent = COALESCE($6, sessions.connections_sent)
       RETURNING *`,
      [
        req.userId,
        today,
        data.completed_actions ? JSON.stringify(data.completed_actions) : null,
        data.post_drafted ?? null,
        data.post_published ?? null,
        data.connections_sent ?? null,
      ]
    );

    const session = result.rows[0];
    const completedCount = Array.isArray(session.completed_actions) ? session.completed_actions.length : 0;
    if (completedCount >= 5 && !session.completed_at) {
      await db.query('UPDATE sessions SET completed_at = NOW() WHERE user_id = $1 AND date = $2', [req.userId, today]);
      await updateStreak(req.userId!);
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input.' });
      return;
    }
    console.error('Session update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/streak', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT current_streak, longest_streak, last_completed_date FROM streaks WHERE user_id = $1',
      [req.userId]
    );
    res.json(result.rows[0] || { current_streak: 0, longest_streak: 0, last_completed_date: null });
  } catch (err) {
    console.error('Streak fetch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Pull from dynamic sessions instead
    const sessionsResult = await db.query(
      `SELECT date, actions_completed, actions_total, completed_at,
              session_data->'theme' as theme
       FROM daily_sessions WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY date DESC`,
      [req.userId]
    );

    const usageResult = await db.query(
      `SELECT date, COUNT(*)::int as suggestions, SUM(tokens_used)::int as tokens
       FROM usage_logs WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY date ORDER BY date DESC`,
      [req.userId]
    );

    res.json({
      sessions: sessionsResult.rows,
      usage: usageResult.rows,
    });
  } catch (err) {
    console.error('Stats fetch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Weekly snapshot endpoint
router.get('/weekly', async (req: Request, res: Response) => {
  try {
    // Calculate current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Get this week's sessions
    const sessionsResult = await db.query(
      `SELECT date, actions_completed, actions_total, completed_at
       FROM daily_sessions WHERE user_id = $1 AND date >= $2
       ORDER BY date`,
      [req.userId, weekStartStr]
    );

    const sessionsCompleted = sessionsResult.rows.filter((r: any) => r.completed_at).length;
    const totalActionsCompleted = sessionsResult.rows.reduce((sum: number, r: any) => sum + (r.actions_completed || 0), 0);

    // Get AI usage this week
    const usageResult = await db.query(
      `SELECT COUNT(*)::int as total FROM usage_logs WHERE user_id = $1 AND date >= $2`,
      [req.userId, weekStartStr]
    );

    // Get stories added this week
    const storiesResult = await db.query(
      `SELECT COUNT(*)::int as total FROM story_bank_entries WHERE user_id = $1 AND created_at >= $2`,
      [req.userId, weekStartStr]
    );

    res.json({
      week_start: weekStartStr,
      sessions_completed: sessionsCompleted,
      total_days: sessionsResult.rows.length,
      total_actions_completed: totalActionsCompleted,
      ai_suggestions_used: usageResult.rows[0]?.total || 0,
      stories_added: storiesResult.rows[0]?.total || 0,
      daily_breakdown: sessionsResult.rows,
    });
  } catch (err) {
    console.error('Weekly stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Report post performance
router.post('/performance', async (req: Request, res: Response) => {
  try {
    const data = postPerformanceSchema.parse(req.body);
    const today = new Date().toISOString().split('T')[0];

    await db.query(
      `INSERT INTO post_performance (user_id, posted_at, content_preview, impressions, reactions, comments_count, shares)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.userId, today, data.content_preview, data.impressions, data.reactions, data.comments_count, data.shares]
    );

    res.json({ success: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input.' });
      return;
    }
    console.error('Performance report error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

async function updateStreak(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const streakResult = await db.query(
    'SELECT current_streak, longest_streak, last_completed_date FROM streaks WHERE user_id = $1',
    [userId]
  );

  if (streakResult.rows.length === 0) {
    // Create streak record
    await db.query(
      'INSERT INTO streaks (user_id, current_streak, longest_streak, last_completed_date) VALUES ($1, 1, 1, $2) ON CONFLICT DO NOTHING',
      [userId, today]
    );
    return;
  }

  const streak = streakResult.rows[0];
  let newStreak = 1;

  if (streak.last_completed_date === yesterday) {
    newStreak = streak.current_streak + 1;
  } else if (streak.last_completed_date === today) {
    return; // Already counted today
  }

  const longestStreak = Math.max(newStreak, streak.longest_streak);

  await db.query(
    'UPDATE streaks SET current_streak = $1, longest_streak = $2, last_completed_date = $3 WHERE user_id = $4',
    [newStreak, longestStreak, today, userId]
  );
}

function validateCategory(cat: string): SessionAction['category'] {
  const valid = ['engage', 'create', 'connect', 'grow', 'reflect'];
  return valid.includes(cat) ? cat as SessionAction['category'] : 'engage';
}

function validateAIType(type: string | undefined): SessionAction['ai_type'] {
  if (!type) return undefined;
  const valid = ['comment', 'post', 'ideas', 'note'];
  return valid.includes(type) ? type as SessionAction['ai_type'] : undefined;
}

export default router;
