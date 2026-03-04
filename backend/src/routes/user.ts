import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { profileUpdateSchema } from '../utils/input-validation.js';
import { db } from '../db.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const userResult = await db.query(
      'SELECT id, email, tier, byok_enabled, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    const profileResult = await db.query(
      'SELECT headline, industry, topics, daily_minutes, timezone FROM profiles WHERE user_id = $1',
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
        updated_at = NOW()
       WHERE user_id = $6 RETURNING *`,
      [data.headline, data.industry, data.topics, data.daily_minutes, data.timezone, req.userId]
    );

    if (result.rows.length === 0) {
      // Create profile if it doesn't exist
      await db.query(
        'INSERT INTO profiles (user_id, headline, industry, topics, daily_minutes, timezone) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.userId, data.headline, data.industry, data.topics, data.daily_minutes, data.timezone]
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

router.put('/byok', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
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
