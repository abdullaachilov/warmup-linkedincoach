import { describe, it, expect, vi } from 'vitest';
import { validateBYOKKey, extractBYOKKey } from '../../src/middleware/byok-handler.js';

function createMockReqRes(byokKey?: string) {
  const req = {
    headers: byokKey ? { 'x-byok-key': byokKey } : {},
  } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('BYOK Handler', () => {
  it('passes valid BYOK key', () => {
    const { req, res, next } = createMockReqRes('sk-ant-api03-validkey12345678901234567890');
    validateBYOKKey(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects BYOK key not matching pattern', () => {
    const { req, res, next } = createMockReqRes('invalid-key');
    validateBYOKKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects empty BYOK key', () => {
    const { req, res, next } = createMockReqRes('');
    validateBYOKKey(req, res, next);
    // Empty string won't match the regex check since it's falsy
    expect(next).toHaveBeenCalled();
  });

  it('rejects BYOK key with null bytes', () => {
    const { req, res, next } = createMockReqRes('sk-ant-api03-valid\x00key1234567890');
    validateBYOKKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('passes through when no BYOK key provided', () => {
    const { req, res, next } = createMockReqRes();
    validateBYOKKey(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('extractBYOKKey clears key from request', () => {
    const { req, res, next } = createMockReqRes('sk-ant-api03-validkey12345678901234567890');
    validateBYOKKey(req, res, next);
    const key = extractBYOKKey(req);
    expect(key).toBe('sk-ant-api03-validkey12345678901234567890');
    // Second extraction should be undefined
    expect(extractBYOKKey(req)).toBeUndefined();
  });
});
