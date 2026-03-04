import { describe, it, expect, vi } from 'vitest';
import { makeAISuggestion, _resetClients } from '../../src/services/ai-proxy.js';
import { redis } from '../../src/redis.js';
import { setupMSW, server } from '../helpers/msw.js';
import { http, HttpResponse } from 'msw';

setupMSW();

const byokRequest = {
  userId: 'user-byok',
  tier: 'byok' as const,
  byokKey: 'sk-ant-byok-test1234567890123456',
  systemPrompt: 'Test',
  userMessage: 'Test',
  maxTokens: 300,
  suggestionType: 'comment',
};

describe('BYOK Safety', () => {
  beforeEach(() => { _resetClients(); });

  it('BYOK key is forwarded to Anthropic API correctly', async () => {
    let receivedKey = '';
    server.use(
      http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
        receivedKey = request.headers.get('x-api-key') || '';
        return HttpResponse.json({
          content: [{ type: 'text', text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      })
    );

    await makeAISuggestion(byokRequest);
    expect(receivedKey).toBe('sk-ant-byok-test1234567890123456');
  });

  it('BYOK key is NOT stored in Redis', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () =>
        HttpResponse.json({ content: [{ type: 'text', text: 'R' }], usage: { input_tokens: 10, output_tokens: 5 } })
      )
    );

    await makeAISuggestion(byokRequest);

    // Check all Redis keys - none should contain the BYOK key
    const store = (redis as any)._store;
    for (const [key, value] of store.entries()) {
      expect(value).not.toContain('sk-ant-byok');
      expect(key).not.toContain('sk-ant-byok');
    }
  });

  it('BYOK key variable is null after request completes', async () => {
    const req = { ...byokRequest };
    await makeAISuggestion(req);
    expect(req.byokKey).toBeUndefined();
  });

  it('returns generic error on invalid BYOK key', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () =>
        HttpResponse.json({ error: { type: 'authentication_error', message: 'Invalid API key' } }, { status: 401 })
      )
    );

    await expect(
      makeAISuggestion(byokRequest)
    ).rejects.toThrow('AI suggestion failed');
  });

  it('returns generic error on Anthropic rate limit', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () =>
        HttpResponse.json({ error: { type: 'rate_limit_error' } }, { status: 429 })
      )
    );

    await expect(
      makeAISuggestion(byokRequest)
    ).rejects.toThrow('AI suggestion failed');
  });
});
