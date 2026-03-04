import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock Redis
vi.mock('../src/redis.js', () => {
  const store = new Map<string, string>();
  return {
    redis: {
      get: vi.fn(async (key: string) => store.get(key) || null),
      set: vi.fn(async (key: string, value: string, ...args: any[]) => {
        store.set(key, value);
        return 'OK';
      }),
      incr: vi.fn(async (key: string) => {
        const val = parseInt(store.get(key) || '0') + 1;
        store.set(key, val.toString());
        return val;
      }),
      incrby: vi.fn(async (key: string, amount: number) => {
        const val = parseInt(store.get(key) || '0') + amount;
        store.set(key, val.toString());
        return val;
      }),
      expire: vi.fn(async () => 1),
      del: vi.fn(async (key: string) => { store.delete(key); return 1; }),
      ping: vi.fn(async () => 'PONG'),
      connect: vi.fn(async () => {}),
      on: vi.fn(),
      _store: store, // exposed for test access
    },
  };
});

// Mock database
const mockQueryResults: any[] = [];
let queryCallCount = 0;

vi.mock('../src/db.js', () => ({
  db: {
    query: vi.fn(async (text: string, params?: unknown[]) => {
      queryCallCount++;
      const result = mockQueryResults.shift();
      if (result) return result;
      return { rows: [], rowCount: 0 };
    }),
    getClient: vi.fn(async () => ({
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    })),
  },
  pool: {
    query: vi.fn(async () => ({ rows: [{ '?column?': 1 }] })),
    connect: vi.fn(async () => ({
      query: vi.fn(),
      release: vi.fn(),
    })),
    end: vi.fn(async () => {}),
  },
}));

export function pushQueryResult(result: any) {
  mockQueryResults.push(result);
}

export function resetQueryResults() {
  mockQueryResults.length = 0;
  queryCallCount = 0;
}

export function getQueryCallCount() {
  return queryCallCount;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-do-not-use';
  process.env.ANTHROPIC_FREE_KEY = 'sk-ant-test-free-fake';
  process.env.ANTHROPIC_PAID_KEY = 'sk-ant-test-paid-fake';
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
  process.env.HMAC_SHARED_SECRET = 'test-hmac-secret';
});

afterEach(async () => {
  // Clear mock Redis store
  const { redis } = await import('../src/redis.js');
  (redis as any)._store.clear();
  vi.clearAllMocks();
  resetQueryResults();
});

afterAll(async () => {});
