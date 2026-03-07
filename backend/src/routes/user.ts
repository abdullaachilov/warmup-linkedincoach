import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { profileUpdateSchema, storyBankCreateSchema, storyBankUpdateSchema, isValidUUID } from '../utils/input-validation.js';
import { db } from '../db.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const userResult = await db.query(
      'SELECT id, email, name, picture_url, tier, byok_enabled, totp_enabled, role, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    const profileResult = await db.query(
      'SELECT headline, industry, topics, daily_minutes, timezone, work_situation, current_goals, hot_takes, daily_reality, communication_style FROM profiles WHERE user_id = $1',
      [req.userId]
    );
    const streakResult = await db.query(
      'SELECT current_streak, longest_streak, last_completed_date FROM streaks WHERE user_id = $1',
      [req.userId]
    );

    const user = userResult.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      ...user,
      profile: profileResult.rows[0] || null,
      streak: streakResult.rows[0] || null,
    });
  } catch (err) {
    console.error('User fetch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.put('/profile', async (req: Request, res: Response) => {
  try {
    const data = profileUpdateSchema.parse(req.body);

    const result = await db.query(
      `UPDATE profiles SET
        headline = COALESCE($1, headline),
        industry = COALESCE($2, industry),
        topics = COALESCE($3, topics),
        daily_minutes = COALESCE($4, daily_minutes),
        timezone = COALESCE($5, timezone),
        work_situation = COALESCE($6, work_situation),
        current_goals = COALESCE($7, current_goals),
        hot_takes = COALESCE($8, hot_takes),
        daily_reality = COALESCE($9, daily_reality),
        communication_style = COALESCE($10, communication_style),
        updated_at = NOW()
       WHERE user_id = $11 RETURNING *`,
      [data.headline, data.industry, data.topics, data.daily_minutes, data.timezone,
       data.work_situation, data.current_goals, data.hot_takes, data.daily_reality, data.communication_style,
       req.userId]
    );

    if (result.rows.length === 0) {
      await db.query(
        'INSERT INTO profiles (user_id, headline, industry, topics, daily_minutes, timezone, work_situation, current_goals, hot_takes, daily_reality, communication_style) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [req.userId, data.headline, data.industry, data.topics, data.daily_minutes, data.timezone,
         data.work_situation, data.current_goals, data.hot_takes, data.daily_reality, data.communication_style]
      );
    }

    res.json(result.rows[0] || data);
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input.' });
      return;
    }
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// --- Story Bank ---

router.get('/story-bank', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT id, entry_type, content, tags, used_count, last_used_at, created_at FROM story_bank_entries WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ entries: result.rows });
  } catch (err) {
    console.error('Story bank fetch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/story-bank', async (req: Request, res: Response) => {
  try {
    const data = storyBankCreateSchema.parse(req.body);
    const result = await db.query(
      'INSERT INTO story_bank_entries (user_id, entry_type, content, tags) VALUES ($1, $2, $3, $4) RETURNING id, entry_type, content, tags, used_count, created_at',
      [req.userId, data.entry_type, data.content, data.tags]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input.' });
      return;
    }
    console.error('Story bank create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.put('/story-bank/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      res.status(400).json({ error: 'Invalid ID format.' });
      return;
    }
    const data = storyBankUpdateSchema.parse(req.body);

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.content !== undefined) { sets.push(`content = $${idx++}`); params.push(data.content); }
    if (data.tags !== undefined) { sets.push(`tags = $${idx++}`); params.push(data.tags); }
    if (data.entry_type !== undefined) { sets.push(`entry_type = $${idx++}`); params.push(data.entry_type); }

    if (sets.length === 0) {
      res.status(400).json({ error: 'No fields to update.' });
      return;
    }

    params.push(id, req.userId);
    const result = await db.query(
      `UPDATE story_bank_entries SET ${sets.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} AND is_active = TRUE RETURNING id, entry_type, content, tags, used_count, created_at`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Entry not found.' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input.' });
      return;
    }
    console.error('Story bank update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/story-bank/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      res.status(400).json({ error: 'Invalid ID format.' });
      return;
    }
    const result = await db.query(
      'UPDATE story_bank_entries SET is_active = FALSE WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
      [id, req.userId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Entry not found.' });
      return;
    }
    res.json({ message: 'Entry archived.' });
  } catch (err) {
    console.error('Story bank delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.put('/byok', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    // Only allow enabling BYOK for users on the byok tier
    if (enabled) {
      const userResult = await db.query('SELECT tier FROM users WHERE id = $1', [req.userId]);
      if (!userResult.rows[0] || userResult.rows[0].tier !== 'byok') {
        res.status(403).json({ error: 'BYOK tier required to enable this feature.' });
        return;
      }
    }

    await db.query(
      'UPDATE users SET byok_enabled = $1, updated_at = NOW() WHERE id = $2',
      [!!enabled, req.userId]
    );
    res.json({ byok_enabled: !!enabled });
  } catch (err) {
    console.error('BYOK update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
