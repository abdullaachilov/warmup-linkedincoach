import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService, AppError } from '../../src/services/auth.js';
import { pushQueryResult } from '../setup.js';
import { redis } from '../../src/redis.js';
import bcrypt from 'bcrypt';

describe('AuthService', () => {
  describe('register', () => {
    it('registers new user with valid email + password', async () => {
      pushQueryResult({ rows: [] }); // No duplicate
      pushQueryResult({ rows: [{ id: '123' }] }); // Insert user
      pushQueryResult({ rows: [] }); // Insert profile
      pushQueryResult({ rows: [] }); // Insert streak

      const result = await authService.register('test@example.com', 'password123', '127.0.0.1');
      expect(result.userId).toBe('123');
    });

    it('rejects duplicate email', async () => {
      pushQueryResult({ rows: [{ id: 'existing' }] }); // Duplicate found

      await expect(
        authService.register('dup@example.com', 'password123', '127.0.0.1')
      ).rejects.toThrow('An account with this email already exists.');
    });

    it('rejects invalid email format', async () => {
      await expect(
        authService.register('not-an-email', 'password123', '127.0.0.1')
      ).rejects.toThrow('Invalid email format.');
    });

    it('rejects weak password (< 8 chars)', async () => {
      await expect(
        authService.register('test@example.com', 'short', '127.0.0.1')
      ).rejects.toThrow('Password must be at least 8 characters.');
    });

    it('hashes password with bcrypt', async () => {
      pushQueryResult({ rows: [] }); // No duplicate
      pushQueryResult({ rows: [{ id: '456' }] }); // Insert
      pushQueryResult({ rows: [] }); // Profile
      pushQueryResult({ rows: [] }); // Streak

      const { db } = await import('../../src/db.js');
      await authService.register('hash@example.com', 'mypassword123', '127.0.0.1');

      const insertCall = (db.query as any).mock.calls.find(
        (c: any) => c[0].includes('INSERT INTO users')
      );
      expect(insertCall).toBeTruthy();
      // The password hash should start with $2b$ (bcrypt)
      const passHash = insertCall[1][1];
      expect(passHash).toMatch(/^\$2[aby]\$/);
    });

    it('rate limits: max 3 registrations per IP per day', async () => {
      // Set IP counter to 3
      (redis as any)._store.set(`reg_ip:127.0.0.1:${new Date().toISOString().split('T')[0]}`, '3');

      await expect(
        authService.register('new@example.com', 'password123', '127.0.0.1')
      ).rejects.toThrow('Too many registrations');
    });

    it('blocks disposable email domains', async () => {
      await expect(
        authService.register('test@mailinator.com', 'password123', '127.0.0.1')
      ).rejects.toThrow('Disposable email addresses are not allowed.');
    });
  });

  describe('verifyEmail', () => {
    it('verifies email with valid token', async () => {
      (redis as any)._store.set('verify:validtoken', 'user-123');
      pushQueryResult({ rows: [{ id: 'user-123' }] }); // Update query

      await authService.verifyEmail('validtoken');
      const { db } = await import('../../src/db.js');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('email_verified = TRUE'),
        expect.arrayContaining(['user-123'])
      );
    });

    it('rejects expired/invalid token', async () => {
      await expect(authService.verifyEmail('badtoken')).rejects.toThrow(
        'Invalid or expired verification token.'
      );
    });
  });

  describe('login', () => {
    it('returns JWT + refresh token for valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      pushQueryResult({
        rows: [{ id: 'user-1', email: 'test@example.com', email_verified: true, password_hash: hash, tier: 'free', byok_enabled: false, active: true }],
      });
      pushQueryResult({ rows: [{ id: 'rt-1' }] }); // Insert refresh token

      const result = await authService.login('test@example.com', 'password123');
      expect(result.jwt).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.email).toBe('test@example.com');
    });

    it('rejects wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      pushQueryResult({
        rows: [{ id: 'user-1', email: 'test@example.com', email_verified: true, password_hash: hash, tier: 'free', byok_enabled: false, active: true }],
      });

      await expect(
        authService.login('test@example.com', 'wrongpass')
      ).rejects.toThrow('Invalid email or password.');
    });

    it('rejects unverified email', async () => {
      const hash = await bcrypt.hash('password123', 10);
      pushQueryResult({
        rows: [{ id: 'user-1', email: 'test@example.com', email_verified: false, password_hash: hash, tier: 'free', byok_enabled: false, active: true }],
      });

      await expect(
        authService.login('test@example.com', 'password123')
      ).rejects.toThrow('Please verify your email');
    });

    it('rejects inactive user', async () => {
      const hash = await bcrypt.hash('password123', 10);
      pushQueryResult({
        rows: [{ id: 'user-1', email: 'test@example.com', email_verified: true, password_hash: hash, tier: 'free', byok_enabled: false, active: false }],
      });

      await expect(
        authService.login('test@example.com', 'password123')
      ).rejects.toThrow('Account is suspended.');
    });

    it('rate limits: max 5 failed attempts per email per hour', async () => {
      (redis as any)._store.set('login_fail:test@example.com', '5');

      await expect(
        authService.login('test@example.com', 'password123')
      ).rejects.toThrow('Too many failed login attempts');
    });

    it('JWT contains correct claims', async () => {
      const hash = await bcrypt.hash('password123', 10);
      pushQueryResult({
        rows: [{ id: 'user-42', email: 'test@example.com', email_verified: true, password_hash: hash, tier: 'starter', byok_enabled: false, active: true }],
      });
      pushQueryResult({ rows: [] }); // refresh token

      const result = await authService.login('test@example.com', 'password123');
      const decoded = authService.verifyJWT(result.jwt);
      expect(decoded.userId).toBe('user-42');
      expect(decoded.tier).toBe('starter');
    });
  });

  describe('refreshAuth', () => {
    it('issues new JWT with valid refresh token', async () => {
      const crypto = await import('crypto');
      const token = 'valid-refresh-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      pushQueryResult({
        rows: [{ id: 'rt-1', user_id: 'user-1', used: false, expires_at: new Date(Date.now() + 86400000), tier: 'free', active: true }],
      });
      pushQueryResult({ rows: [] }); // Mark old as used
      pushQueryResult({ rows: [] }); // Insert new

      const result = await authService.refreshAuth(token);
      expect(result.jwt).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('rejects used refresh token', async () => {
      pushQueryResult({
        rows: [{ id: 'rt-1', user_id: 'user-1', used: true, expires_at: new Date(Date.now() + 86400000), tier: 'free', active: true }],
      });

      await expect(authService.refreshAuth('used-token')).rejects.toThrow('Refresh token already used.');
    });

    it('rejects expired refresh token', async () => {
      pushQueryResult({
        rows: [{ id: 'rt-1', user_id: 'user-1', used: false, expires_at: new Date(Date.now() - 86400000), tier: 'free', active: true }],
      });

      await expect(authService.refreshAuth('expired-token')).rejects.toThrow('Refresh token expired.');
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
});
