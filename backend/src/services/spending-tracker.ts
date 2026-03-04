import { redis } from '../redis.js';

export async function checkCircuitBreaker(tier: string): Promise<boolean> {
  const allBreaker = await redis.get('circuit_breaker:all');
  if (allBreaker === '1') return true;

  if (tier === 'free') {
    const freeBreaker = await redis.get('circuit_breaker:free');
    if (freeBreaker === '1') return true;
  }

  return false;
}

export async function setCircuitBreaker(scope: 'free' | 'all', ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await redis.set(`circuit_breaker:${scope}`, '1', 'EX', ttlSeconds);
  } else {
    await redis.set(`circuit_breaker:${scope}`, '1');
  }
}

export async function clearCircuitBreaker(scope: 'free' | 'all'): Promise<void> {
  await redis.del(`circuit_breaker:${scope}`);
}

export async function getSpendingSummary(): Promise<{
  freeToday: number;
  paidToday: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  const freeSpend = parseInt(await redis.get(`spend:${today}:free`) || '0');
  const paidSpend = parseInt(await redis.get(`spend:${today}:paid`) || '0');

  return {
    freeToday: freeSpend,
    paidToday: paidSpend,
  };
}
