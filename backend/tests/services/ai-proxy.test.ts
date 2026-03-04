import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeAISuggestion, checkUsageLimit, _resetClients } from '../../src/services/ai-proxy.js';
import { redis } from '../../src/redis.js';
import { pushQueryResult } from '../setup.js';
import { setupMSW, server } from '../helpers/msw.js';
import { http, HttpResponse } from 'msw';

setupMSW();

const baseRequest = {
  userId: 'user-1',
  tier: 'free' as const,
  systemPrompt: 'You are a test assistant.',
  userMessage: 'Test message',
  maxTokens: 300,
  suggestionType: 'comment',
};

describe('AI Proxy', () => {
  beforeEach(() => {
    _resetClients();
  });

  describe('tier routing', () => {
    it('free tier uses ANTHROPIC_FREE_KEY', async () => {
      let usedKey = '';
      server.use(
        http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
          usedKey = request.headers.get('x-api-key') || '';
          return HttpResponse.json({
            content: [{ type: 'text', text: 'Test response' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          });
        })
      );
      pushQueryResult({ rows: [] }); // usage log
      pushQueryResult({ rows: [] }); // daily usage

      await makeAISuggestion({ ...baseRequest, tier: 'free' });
      expect(usedKey).toBe('sk-ant-test-free-fake');
    });

    it('starter tier uses ANTHROPIC_PAID_KEY', async () => {
      let usedKey = '';
      server.use(
        http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
          usedKey = request.headers.get('x-api-key') || '';
          return HttpResponse.json({
            content: [{ type: 'text', text: 'Test response' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          });
        })
      );
      pushQueryResult({ rows: [] });
      pushQueryResult({ rows: [] });

      await makeAISuggestion({ ...baseRequest, tier: 'starter' });
      expect(usedKey).toBe('sk-ant-test-paid-fake');
    });

    it('pro tier uses ANTHROPIC_PAID_KEY', async () => {
      let usedKey = '';
      server.use(
        http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
          usedKey = request.headers.get('x-api-key') || '';
          return HttpResponse.json({
            content: [{ type: 'text', text: 'Test response' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          });
        })
      );
      pushQueryResult({ rows: [] });
      pushQueryResult({ rows: [] });

      await makeAISuggestion({ ...baseRequest, tier: 'pro' });
      expect(usedKey).toBe('sk-ant-test-paid-fake');
    });

    it('BYOK tier uses the provided key', async () => {
      let usedKey = '';
      server.use(
        http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
          usedKey = request.headers.get('x-api-key') || '';
          return HttpResponse.json({
            content: [{ type: 'text', text: 'Test response' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          });
        })
      );

      await makeAISuggestion({ ...baseRequest, tier: 'byok', byokKey: 'sk-ant-user-key-123456789012345678' });
      expect(usedKey).toBe('sk-ant-user-key-123456789012345678');
    });
  });

  describe('daily usage limits', () => {
    it('free user: allows 2 requests per day', async () => {
      const today = new Date().toISOString().split('T')[0];
      (redis as any)._store.set(`usage:user-1:${today}`, '1');
      pushQueryResult({ rows: [] });
      pushQueryResult({ rows: [] });

      const result = await makeAISuggestion({ ...baseRequest, tier: 'free' });
      expect(result.text).toBeTruthy();
    });

    it('free user: blocks 3rd request with 429', async () => {
      const today = new Date().toISOString().split('T')[0];
      (redis as any)._store.set(`usage:user-1:${today}`, '2');

      await expect(makeAISuggestion({ ...baseRequest, tier: 'free' })).rejects.toThrow('Daily limit reached');
    });

    it('starter user: allows 8 requests per day', async () => {
      const today = new Date().toISOString().split('T')[0];
      (redis as any)._store.set(`usage:user-1:${today}`, '7');
      pushQueryResult({ rows: [] });
      pushQueryResult({ rows: [] });

      const result = await makeAISuggestion({ ...baseRequest, tier: 'starter' });
      expect(result.text).toBeTruthy();
    });

    it('starter user: blocks 9th request', async () => {
      const today = new Date().toISOString().split('T')[0];
      (redis as any)._store.set(`usage:user-1:${today}`, '8');

      await expect(makeAISuggestion({ ...baseRequest, tier: 'starter' })).rejects.toThrow('Daily limit reached');
    });

    it('pro user: allows 40 requests per day', async () => {
      const today = new Date().toISOString().split('T')[0];
      (redis as any)._store.set(`usage:user-1:${today}`, '39');
      pushQueryResult({ rows: [] });
      pushQueryResult({ rows: [] });

      const result = await makeAISuggestion({ ...baseRequest, tier: 'pro' });
      expect(result.text).toBeTruthy();
    });

    it('pro user: blocks 41st request', async () => {
      const today = new Date().toISOString().split('T')[0];
      (redis as any)._store.set(`usage:user-1:${today}`, '40');

      await expect(makeAISuggestion({ ...baseRequest, tier: 'pro' })).rejects.toThrow('Daily limit reached');
    });

    it('usage counter is per-user', async () => {
      const today = new Date().toISOString().split('T')[0];
      (redis as any)._store.set(`usage:user-other:${today}`, '100');
      // user-1 has no usage
      pushQueryResult({ rows: [] });
      pushQueryResult({ rows: [] });

      const result = await makeAISuggestion({ ...baseRequest, tier: 'free' });
      expect(result.text).toBeTruthy();
    });
  });

  describe('burst rate limiting', () => {
    it('allows 5 requests in 1 minute', async () => {
      const minuteKey = `burst:user-1:${Math.floor(Date.now() / 60000)}`;
      (redis as any)._store.set(minuteKey, '4');
      pushQueryResult({ rows: [] });
      pushQueryResult({ rows: [] });

      const result = await makeAISuggestion({ ...baseRequest, tier: 'free' });
      expect(result.text).toBeTruthy();
    });

    it('blocks 6th request within same minute', async () => {
      const minuteKey = `burst:user-1:${Math.floor(Date.now() / 60000)}`;
      (redis as any)._store.set(minuteKey, '5');

      await expect(makeAISuggestion({ ...baseRequest, tier: 'free' })).rejects.toThrow('Too many requests');
    });
  });

  describe('circuit breakers', () => {
    it('free circuit breaker blocks free tier', async () => {
      (redis as any)._store.set('circuit_breaker:free', '1');

      await expect(makeAISuggestion({ ...baseRequest, tier: 'free' })).rejects.toThrow('Free tier AI suggestions are temporarily at capacity');
    });

    it('free circuit breaker does NOT block paid tiers', async () => {
      (redis as any)._store.set('circuit_breaker:free', '1');
      pushQueryResult({ rows: [] });
      pushQueryResult({ rows: [] });

      const result = await makeAISuggestion({ ...baseRequest, tier: 'starter' });
      expect(result.text).toBeTruthy();
    });

    it('global circuit breaker blocks ALL tiers', async () => {
      (redis as any)._store.set('circuit_breaker:all', '1');

      await expect(makeAISuggestion({ ...baseRequest, tier: 'pro' })).rejects.toThrow('AI suggestions temporarily unavailable');
    });

    it('auto-enables free circuit breaker when daily spend > $5', async () => {
      const today = new Date().toISOString().split('T')[0];
      (redis as any)._store.set(`spend:${today}:free`, '500'); // $5.00

      await expect(makeAISuggestion({ ...baseRequest, tier: 'free' })).rejects.toThrow('Free tier at daily capacity');
      expect(redis.set).toHaveBeenCalledWith('circuit_breaker:free', '1', 'EX', expect.any(Number));
    });
  });

  describe('spending tracking', () => {
    it('increments Redis spend counter after successful call', async () => {
      pushQueryResult({ rows: [] });
      pushQueryResult({ rows: [] });

      await makeAISuggestion({ ...baseRequest, tier: 'free' });
      expect(redis.incrby).toHaveBeenCalled();
    });

    it('does NOT track spending for BYOK requests', async () => {
      const incrbyCallsBefore = (redis.incrby as any).mock.calls.length;

      await makeAISuggestion({ ...baseRequest, tier: 'byok', byokKey: 'sk-ant-user-key-123456789012345678' });

      // incrby for spend should not be called (incr for usage counter is still called)
      const spendCalls = (redis.incrby as any).mock.calls.filter(
        (c: any) => c[0].includes('spend:')
      );
      expect(spendCalls.length).toBe(0);
    });
  });

  describe('checkUsageLimit', () => {
    it('returns current usage and limit', async () => {
      const today = new Date().toISOString().split('T')[0];
      (redis as any)._store.set(`usage:user-1:${today}`, '3');

      const result = await checkUsageLimit('user-1', 'starter');
      expect(result).toEqual({ used: 3, limit: 8 });
    });
  });
});
