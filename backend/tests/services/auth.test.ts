import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService, AppError } from '../../src/services/auth.js';
import { pushQueryResult } from '../setup.js';
import { redis } from '../../src/redis.js';

describe('AuthService', () => {
  describe('LinkedIn OAuth', () => {
    it('generates LinkedIn auth URL with correct params', () => {
      const url = authService.getLinkedInAuthURL('test-session-123');
      expect(url).toContain('linkedin.com/oauth/v2/authorization');
      expect(url).toContain('test-session-123');
      expect(url).toContain('openid');
      expect(url).toContain('profile');
      expect(url).toContain('email');
    });

    it('pollOAuthSession returns null when no session data', async () => {
      const result = await authService.pollOAuthSession('nonexistent');
      expect(result).toBeNull();
    });

    it('pollOAuthSession returns data and consumes session', async () => {
      (redis as any)._store.set('oauth_session:sess-1', JSON.stringify({ jwt: 'token123', refreshToken: 'rt123' }));

      const result = await authService.pollOAuthSession('sess-1');
      expect(result).toEqual({ jwt: 'token123', refreshToken: 'rt123' });

      // Should be consumed
      const second = await authService.pollOAuthSession('sess-1');
      expect(second).toBeNull();
    });
  });

  describe('JWT', () => {
    it('generates valid JWT with correct claims', () => {
      const token = authService.generateJWT('user-42', 'starter', 'user');
      const decoded = authService.verifyJWT(token);
      expect(decoded.userId).toBe('user-42');
      expect(decoded.tier).toBe('starter');
      expect(decoded.role).toBe('user');
    });

    it('generates admin JWT when role is admin', () => {
      const token = authService.generateJWT('admin-1', 'pro', 'admin');
      const decoded = authService.verifyJWT(token);
      expect(decoded.role).toBe('admin');
    });

    it('defaults role to user', () => {
      const token = authService.generateJWT('user-1', 'free');
      const decoded = authService.verifyJWT(token);
      expect(decoded.role).toBe('user');
    });

    it('rejects invalid JWT', () => {
      expect(() => authService.verifyJWT('invalid-token')).toThrow();
    });
  });

  describe('refreshAuth', () => {
    it('issues new JWT with valid refresh token', async () => {
      const crypto = await import('crypto');
      const token = 'valid-refresh-token';

      pushQueryResult({
        rows: [{ id: 'rt-1', user_id: 'user-1', used: false, expires_at: new Date(Date.now() + 86400000), tier: 'free', active: true, role: 'user' }],
      });
      pushQueryResult({ rows: [] }); // Mark old as used
      pushQueryResult({ rows: [] }); // Insert new

      const result = await authService.refreshAuth(token);
      expect(result.jwt).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('rejects used refresh token', async () => {
      pushQueryResult({
        rows: [{ id: 'rt-1', user_id: 'user-1', used: true, expires_at: new Date(Date.now() + 86400000), tier: 'free', active: true, role: 'user' }],
      });

      await expect(authService.refreshAuth('used-token')).rejects.toThrow('Refresh token already used.');
    });

    it('rejects expired refresh token', async () => {
      pushQueryResult({
        rows: [{ id: 'rt-1', user_id: 'user-1', used: false, expires_at: new Date(Date.now() - 86400000), tier: 'free', active: true, role: 'user' }],
      });

      await expect(authService.refreshAuth('expired-token')).rejects.toThrow('Refresh token expired.');
    });

    it('rejects suspended user', async () => {
      pushQueryResult({
        rows: [{ id: 'rt-1', user_id: 'user-1', used: false, expires_at: new Date(Date.now() + 86400000), tier: 'free', active: false, role: 'user' }],
      });

      await expect(authService.refreshAuth('suspended-token')).rejects.toThrow('Account is suspended.');
    });
  });

  describe('logout', () => {
    it('invalidates refresh tokens', async () => {
      pushQueryResult({ rows: [] });
      await authService.logout('user-1');
      const { db } = await import('../../src/db.js');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        expect.arrayContaining(['user-1'])
      );
    });
  });

  describe('2FA', () => {
    it('setup2FA rejects if already enabled', async () => {
      pushQueryResult({ rows: [{ email: 'test@example.com', totp_enabled: true }] });
      await expect(authService.setup2FA('user-1')).rejects.toThrow('2FA is already enabled.');
    });

    it('disable2FA rejects if not enabled', async () => {
      pushQueryResult({ rows: [{ email: 'test@example.com', totp_secret: null, totp_enabled: false }] });
      await expect(authService.disable2FA('user-1', '123456')).rejects.toThrow('2FA is not enabled.');
    });

    it('validate2FA rejects expired temp token', async () => {
      await expect(authService.validate2FA('expired-temp', '123456')).rejects.toThrow('Invalid or expired 2FA session.');
    });
  });
});
