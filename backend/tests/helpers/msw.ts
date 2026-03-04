import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { beforeAll, afterEach, afterAll } from 'vitest';

export const anthropicHandlers = [
  http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
    const body = await request.json() as any;

    // Return mock response
    return HttpResponse.json({
      id: 'msg_test_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Great insight about the challenges of scaling microservices. What specific bottleneck did you encounter?' }],
      model: 'claude-sonnet-4-5-20250929',
      usage: { input_tokens: 150, output_tokens: 25 },
      stop_reason: 'end_turn',
    });
  }),
];

export const server = setupServer(...anthropicHandlers);

export function setupMSW() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
