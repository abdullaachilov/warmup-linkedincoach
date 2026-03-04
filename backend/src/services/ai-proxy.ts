import Anthropic from '@anthropic-ai/sdk';
import { redis } from '../redis.js';
import { db } from '../db.js';
import type { AISuggestionRequest } from '../types/index.js';
import { TIER_LIMITS } from '../types/index.js';
import { AppError } from './auth.js';

// Two separate clients, two separate keys
let freeClient: Anthropic | null = null;
let paidClient: Anthropic | null = null;

function getFreeClient(): Anthropic {
  if (!freeClient) {
    freeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_FREE_KEY || '' });
  }
  return freeClient;
}

function getPaidClient(): Anthropic {
  if (!paidClient) {
    paidClient = new Anthropic({ apiKey: process.env.ANTHROPIC_PAID_KEY || '' });
  }
  return paidClient;
}

function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

export async function checkUsageLimit(userId: string, tier: string): Promise<{ used: number; limit: number }> {
  const dailyKey = `usage:${userId}:${new Date().toISOString().split('T')[0]}`;
  const currentUsage = parseInt(await redis.get(dailyKey) || '0');
  const limit = TIER_LIMITS[tier] || 2;
  return { used: currentUsage, limit };
}

export async function makeAISuggestion(req: AISuggestionRequest): Promise<{ text: string; tokensUsed: number }> {
  // 1. Check circuit breakers
  const allBreaker = await redis.get('circuit_breaker:all');
  if (allBreaker === '1') {
    throw new AppError('AI suggestions temporarily unavailable. Please try again later.', 503);
  }

  const freeBreaker = await redis.get('circuit_breaker:free');
  if (freeBreaker === '1' && req.tier === 'free') {
    throw new AppError('Free tier AI suggestions are temporarily at capacity. Upgrade for uninterrupted access.', 503);
  }

  // 2. Check daily usage limit
  const dailyKey = `usage:${req.userId}:${new Date().toISOString().split('T')[0]}`;
  const currentUsage = parseInt(await redis.get(dailyKey) || '0');
  const limit = TIER_LIMITS[req.tier] || 2;

  if (currentUsage >= limit) {
    throw new AppError(`Daily limit reached (${currentUsage}/${limit}). ${req.tier === 'free' ? 'Upgrade for more suggestions.' : 'Try again tomorrow.'}`, 429);
  }

  // 3. Check per-minute burst limit
  const burstKey = `burst:${req.userId}:${Math.floor(Date.now() / 60000)}`;
  const burstCount = parseInt(await redis.get(burstKey) || '0');
  if (burstCount >= 5) {
    throw new AppError('Too many requests. Please wait a moment.', 429);
  }

  // 4. Check daily spending (only for our keys, not BYOK)
  if (req.tier !== 'byok') {
    const tierBucket = req.tier === 'free' ? 'free' : 'paid';
    const spendKey = `spend:${new Date().toISOString().split('T')[0]}:${tierBucket}`;
    const dailySpendCents = parseInt(await redis.get(spendKey) || '0');
    const dailyLimitCents = req.tier === 'free'
      ? parseInt(process.env.FREE_KEY_DAILY_LIMIT_CENTS || '500')
      : parseInt(process.env.PAID_KEY_DAILY_LIMIT_CENTS || '3000');

    if (dailySpendCents >= dailyLimitCents) {
      if (req.tier === 'free') {
        await redis.set('circuit_breaker:free', '1', 'EX', getSecondsUntilMidnight());
        throw new AppError('Free tier at daily capacity. Upgrade for continued access.', 503);
      }
      // For paid, just alert but don't disable
      console.warn(`ALERT: Paid tier daily spend hit $${(dailySpendCents / 100).toFixed(2)}`);
    }
  }

  // 5. Select client
  let client: Anthropic;
  if (req.tier === 'byok' && req.byokKey) {
    client = new Anthropic({ apiKey: req.byokKey });
  } else if (req.tier === 'free') {
    client = getFreeClient();
  } else {
    client = getPaidClient();
  }

  // 6. Make the call
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: req.maxTokens,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userMessage }],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // NEVER include BYOK key in error logs
    console.error('AI request failed', { userId: req.userId, tier: req.tier, error: message });
    throw new AppError('AI suggestion failed. Please try again.', 502);
  }

  const resultText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

  // 7. Increment counters
  await redis.incr(dailyKey);
  await redis.expire(dailyKey, 172800); // 48h TTL

  await redis.incr(burstKey);
  await redis.expire(burstKey, 120); // 2 min TTL

  // 8. Track spending (skip for BYOK)
  if (req.tier !== 'byok') {
    const estimatedCostCents = Math.ceil(
      (response.usage.input_tokens * 0.3 + response.usage.output_tokens * 1.5) / 100
    );
    const tierBucket = req.tier === 'free' ? 'free' : 'paid';
    const spendKey = `spend:${new Date().toISOString().split('T')[0]}:${tierBucket}`;
    await redis.incrby(spendKey, estimatedCostCents);
    await redis.expire(spendKey, 172800);

    // Log to database
    await db.query(
      'INSERT INTO usage_logs (user_id, date, suggestion_type, tokens_used) VALUES ($1, CURRENT_DATE, $2, $3)',
      [req.userId, req.suggestionType, tokensUsed]
    ).catch(err => console.error('Failed to log usage:', err.message));

    // Update daily_usage
    await db.query(
      `INSERT INTO daily_usage (user_id, date, suggestion_count, estimated_cost_cents)
       VALUES ($1, CURRENT_DATE, 1, $2)
       ON CONFLICT (user_id, date)
       DO UPDATE SET suggestion_count = daily_usage.suggestion_count + 1, estimated_cost_cents = daily_usage.estimated_cost_cents + $2`,
      [req.userId, estimatedCostCents]
    ).catch(err => console.error('Failed to update daily_usage:', err.message));
  }

  // 9. Null out BYOK key
  if (req.byokKey) {
    req.byokKey = undefined;
  }

  return { text: resultText, tokensUsed };
}

// For testing - allow resetting clients
export function _resetClients() {
  freeClient = null;
  paidClient = null;
}
