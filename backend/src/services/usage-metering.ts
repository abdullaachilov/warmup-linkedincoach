import { redis } from '../redis.js';
import { db } from '../db.js';
import { TIER_LIMITS } from '../types/index.js';

export async function getDailyUsage(userId: string): Promise<{ used: number; limit: number; tier: string }> {
  const dailyKey = `usage:${userId}:${new Date().toISOString().split('T')[0]}`;
  const used = parseInt(await redis.get(dailyKey) || '0');

  const result = await db.query('SELECT tier FROM users WHERE id = $1', [userId]);
  const tier = result.rows[0]?.tier || 'free';
  const limit = TIER_LIMITS[tier] || 2;

  return { used, limit, tier };
}

export async function getDailySpending(tier: 'free' | 'paid'): Promise<number> {
  const spendKey = `spend:${new Date().toISOString().split('T')[0]}:${tier}`;
  return parseInt(await redis.get(spendKey) || '0');
}

export async function getWeeklyStats(userId: string): Promise<{
  totalSuggestions: number;
  totalTokens: number;
  byDay: Array<{ date: string; count: number }>;
}> {
  const result = await db.query(
    `SELECT date, COUNT(*)::int as count, SUM(tokens_used)::int as tokens
     FROM usage_logs
     WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
     GROUP BY date ORDER BY date`,
    [userId]
  );

  return {
    totalSuggestions: result.rows.reduce((sum, r) => sum + r.count, 0),
    totalTokens: result.rows.reduce((sum, r) => sum + (r.tokens || 0), 0),
    byDay: result.rows.map(r => ({ date: r.date, count: r.count })),
  };
}
