import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { db } from '../db.js';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// List users with usage stats
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT u.id, u.email, u.tier, u.role, u.active, u.email_verified, u.totp_enabled, u.created_at,
              COALESCE(du.total_suggestions, 0) as total_suggestions
       FROM users u
       LEFT JOIN (
         SELECT user_id, SUM(suggestion_count) as total_suggestions
         FROM daily_usage
         GROUP BY user_id
       ) du ON du.user_id = u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);

    res.json({ users: result.rows, total, page, limit });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Global stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [usersResult, tierResult, spendingResult, todayUsageResult] = await Promise.all([
      db.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE active = TRUE) as active FROM users'),
      db.query('SELECT tier, COUNT(*) as count FROM users GROUP BY tier'),
      db.query(
        `SELECT SUM(estimated_cost_cents) as total_cost_cents, SUM(total_requests) as total_requests
         FROM spending_daily WHERE date >= CURRENT_DATE - INTERVAL '30 days'`
      ),
      db.query(
        `SELECT SUM(suggestion_count) as today_suggestions
         FROM daily_usage WHERE date = CURRENT_DATE`
      ),
    ]);

    res.json({
      users: {
        total: parseInt(usersResult.rows[0].total),
        active: parseInt(usersResult.rows[0].active),
      },
      tiers: tierResult.rows.reduce((acc: Record<string, number>, r: any) => {
        acc[r.tier] = parseInt(r.count);
        return acc;
      }, {}),
      spending30d: {
        totalCostCents: parseInt(spendingResult.rows[0]?.total_cost_cents || '0'),
        totalRequests: parseInt(spendingResult.rows[0]?.total_requests || '0'),
      },
      todaySuggestions: parseInt(todayUsageResult.rows[0]?.today_suggestions || '0'),
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Spending dashboard
router.get('/spending', async (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 30));

    const result = await db.query(
      `SELECT date, api_key_tier, total_requests, total_tokens, estimated_cost_cents
       FROM spending_daily
       WHERE date >= CURRENT_DATE - $1 * INTERVAL '1 day'
       ORDER BY date DESC`,
      [days]
    );

    res.json({ spending: result.rows, days });
  } catch (err) {
    console.error('Admin spending error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Suspend/unsuspend user
router.post('/users/:id/suspend', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { suspend } = req.body;

    if (id === req.userId) {
      res.status(400).json({ error: 'Cannot suspend yourself.' });
      return;
    }

    // Prevent suspending other admins
    const targetResult = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (!targetResult.rows[0]) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (targetResult.rows[0].role === 'admin') {
      res.status(403).json({ error: 'Cannot suspend an admin.' });
      return;
    }

    await db.query(
      'UPDATE users SET active = $1, updated_at = NOW() WHERE id = $2',
      [!suspend, id]
    );

    // If suspending, invalidate all their refresh tokens
    if (suspend) {
      await db.query('UPDATE refresh_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [id]);
    }

    res.json({ message: suspend ? 'User suspended.' : 'User unsuspended.' });
  } catch (err) {
    console.error('Admin suspend error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
