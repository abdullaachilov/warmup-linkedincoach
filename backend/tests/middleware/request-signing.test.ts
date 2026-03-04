import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyRequestSignature } from '../../src/middleware/request-signing.js';
import crypto from 'crypto';

// Override NODE_ENV for these tests
const originalEnv = process.env.NODE_ENV;

function createMockReqRes(body: any, signature?: string, timestamp?: string) {
  const req = {
    body,
    headers: {
      'x-warmup-signature': signature,
      'x-warmup-timestamp': timestamp,
    },
  } as any;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;

  const next = vi.fn();
  return { req, res, next };
}

function computeSignature(body: any, timestamp: string, secret: string = 'test-hmac-secret'): string {
  const payload = JSON.stringify(body) + timestamp;
  return crypto.createHmac('sha256', secret).update(payload).digest('base64');
}

describe('Request Signing Middleware', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.HMAC_SHARED_SECRET = 'test-hmac-secret';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('accepts request with valid HMAC signature', () => {
    const body = { test: 'data' };
    const timestamp = Date.now().toString();
    const signature = computeSignature(body, timestamp);
    const { req, res, next } = createMockReqRes(body, signature, timestamp);

    verifyRequestSignature(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects request with missing signature header', () => {
    const { req, res, next } = createMockReqRes({ test: 'data' }, undefined, Date.now().toString());

    verifyRequestSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with missing timestamp header', () => {
    const { req, res, next } = createMockReqRes({ test: 'data' }, 'fake-sig', undefined);

    verifyRequestSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid signature', () => {
    const body = { test: 'data' };
    const timestamp = Date.now().toString();
    const { req, res, next } = createMockReqRes(body, 'aW52YWxpZA==', timestamp);

    verifyRequestSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects request with tampered body', () => {
    const originalBody = { test: 'original' };
    const timestamp = Date.now().toString();
    const signature = computeSignature(originalBody, timestamp);
    const tamperedBody = { test: 'tampered' };
    const { req, res, next } = createMockReqRes(tamperedBody, signature, timestamp);

    verifyRequestSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects request with timestamp > 30 seconds old', () => {
    const body = { test: 'data' };
    const oldTimestamp = (Date.now() - 31000).toString();
    const signature = computeSignature(body, oldTimestamp);
    const { req, res, next } = createMockReqRes(body, signature, oldTimestamp);

    verifyRequestSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Stale request.' });
  });

  it('rejects request with future timestamp', () => {
    const body = { test: 'data' };
    const futureTimestamp = (Date.now() + 60000).toString();
    const signature = computeSignature(body, futureTimestamp);
    const { req, res, next } = createMockReqRes(body, signature, futureTimestamp);

    verifyRequestSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('skips verification in test environment', () => {
    process.env.NODE_ENV = 'test';
    const { req, res, next } = createMockReqRes({ test: 'data' });

    verifyRequestSignature(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('validates empty body correctly', () => {
    const body = {};
    const timestamp = Date.now().toString();
    const signature = computeSignature(body, timestamp);
    const { req, res, next } = createMockReqRes(body, signature, timestamp);

    verifyRequestSignature(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
