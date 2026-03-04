import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

const JWT_SECRET = 'test-secret-do-not-use';

export function createTestUser(overrides: any = {}) {
  return {
    id: uuid(),
    email: `test-${Date.now()}@example.com`,
    email_verified: true,
    password_hash: '$2b$10$fakehash', // Pre-hashed
    tier: 'free' as const,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    byok_enabled: false,
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export function createAuthToken(userId: string, tier: string = 'free') {
  return jwt.sign({ userId, tier }, JWT_SECRET, { expiresIn: '7d' });
}

export function createExpiredToken(userId: string, tier: string = 'free') {
  return jwt.sign({ userId, tier }, JWT_SECRET, { expiresIn: '-1s' });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
