import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sessionUpdateSchema } from '../utils/input-validation.js';
import { db } from '../db.js';

const router = Router();
router.use(requireAuth);

router.get('/today', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.query(
      'SELECT * FROM sessions WHERE user_id = $1 AND date = $2',
      [req.userId, today]
    );

    if (result.rows.length === 0) {
      // Create today's session
      await db.query(
        'INSERT INTO sessions (user_id, date, total_actions) VALUES ($1, $2, 10)',
        [req.userId, today]
      );
      res.json({
        date: today,
        completed_actions: [],
        total_actions: 10,
        post_drafted: false,
        post_published: false,
        connections_sent: 0,
        completed_at: null,
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Session fetch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.put('/today', async (req: Request, res: Response) => {
  try {
    const data = sessionUpdateSchema.parse(req.body);
    const today = new Date().toISOString().split('T')[0];

    // Upsert session
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

    // Check if session is complete and update streak
    const session = result.rows[0];
    const completedCount = Array.isArray(session.completed_actions) ? session.completed_actions.length : 0;
    if (completedCount >= 5 && !session.completed_at) {
      await db.query(
        'UPDATE sessions SET completed_at = NOW() WHERE user_id = $1 AND date = $2',
        [req.userId, today]
      );
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
    const sessionsResult = await db.query(
      `SELECT date, completed_actions, post_drafted, post_published, connections_sent
       FROM sessions WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
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

async function updateStreak(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const streakResult = await db.query(
    'SELECT current_streak, longest_streak, last_completed_date FROM streaks WHERE user_id = $1',
    [userId]
  );

  if (streakResult.rows.length === 0) return;

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

export default router;
