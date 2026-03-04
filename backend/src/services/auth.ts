import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db.js';
import { redis } from '../redis.js';
import type { User, TokenPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const SALT_ROUNDS = 10;

export class AuthService {
  async register(email: string, password: string, ip: string): Promise<{ userId: string }> {
    // Rate limit: max 3 registrations per IP per day
    const ipKey = `reg_ip:${ip}:${new Date().toISOString().split('T')[0]}`;
    const ipCount = parseInt(await redis.get(ipKey) || '0');
    if (ipCount >= 3) {
      throw new AppError('Too many registrations from this IP. Try again tomorrow.', 429);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Invalid email format.', 400);
    }

    // Block disposable emails
    const disposableDomains = ['tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com', 'yopmail.com', 'temp-mail.org', 'fakeinbox.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'dispostable.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    if (disposableDomains.includes(domain)) {
      throw new AppError('Disposable email addresses are not allowed.', 400);
    }

    // Validate password strength
    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters.', 400);
    }

    // Check for duplicate email
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw new AppError('An account with this email already exists.', 409);
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email.toLowerCase(), passwordHash]
    );
    const userId = result.rows[0].id;

    // Create default profile
    await db.query('INSERT INTO profiles (user_id) VALUES ($1)', [userId]);

    // Create default streak
    await db.query('INSERT INTO streaks (user_id) VALUES ($1)', [userId]);

    // Increment IP counter
    await redis.incr(ipKey);
    await redis.expire(ipKey, 86400);

    // Generate verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await redis.set(`verify:${verifyToken}`, userId, 'EX', 86400); // 24h

    // Send verification email (async, don't block)
    this.sendVerificationEmail(email, verifyToken).catch(err => {
      console.error('Failed to send verification email:', err.message);
    });

    return { userId };
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await redis.get(`verify:${token}`);
    if (!userId) {
      throw new AppError('Invalid or expired verification token.', 400);
    }

    await db.query('UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1', [userId]);
    await redis.del(`verify:${token}`);
  }

  async login(email: string, password: string): Promise<{ jwt: string; refreshToken: string; user: Partial<User> }> {
    // Rate limit: 5 failed attempts per email per hour
    const failKey = `login_fail:${email.toLowerCase()}`;
    const failCount = parseInt(await redis.get(failKey) || '0');
    if (failCount >= 5) {
      throw new AppError('Too many failed login attempts. Try again in an hour.', 429);
    }

    const result = await db.query(
      'SELECT id, email, email_verified, password_hash, tier, byok_enabled, active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];

    if (!user) {
      await redis.incr(failKey);
      await redis.expire(failKey, 3600);
      throw new AppError('Invalid email or password.', 401);
    }

    if (!user.active) {
      throw new AppError('Account is suspended.', 403);
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      await redis.incr(failKey);
      await redis.expire(failKey, 3600);
      throw new AppError('Invalid email or password.', 401);
    }

    if (!user.email_verified) {
      throw new AppError('Please verify your email before logging in.', 403);
    }

    // Clear failed login counter
    await redis.del(failKey);

    // Generate tokens
    const token = this.generateJWT(user.id, user.tier);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      jwt: token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        byok_enabled: user.byok_enabled,
      },
    };
  }

  async refreshAuth(refreshTokenValue: string): Promise<{ jwt: string; refreshToken: string }> {
    const tokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');

    const result = await db.query(
      'SELECT rt.id, rt.user_id, rt.used, rt.expires_at, u.tier, u.active FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1',
      [tokenHash]
    );
    const tokenRecord = result.rows[0];

    if (!tokenRecord) {
      throw new AppError('Invalid refresh token.', 401);
    }

    if (tokenRecord.used) {
      throw new AppError('Refresh token already used.', 401);
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      throw new AppError('Refresh token expired.', 401);
    }

    if (!tokenRecord.active) {
      throw new AppError('Account is suspended.', 403);
    }

    // Mark old token as used (rotation)
    await db.query('UPDATE refresh_tokens SET used = TRUE WHERE id = $1', [tokenRecord.id]);

    // Generate new tokens
    const newJwt = this.generateJWT(tokenRecord.user_id, tokenRecord.tier);
    const newRefreshToken = await this.generateRefreshToken(tokenRecord.user_id);

    return { jwt: newJwt, refreshToken: newRefreshToken };
  }

  async logout(userId: string): Promise<void> {
    await db.query('UPDATE refresh_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [userId]);
  }

  generateJWT(userId: string, tier: string): string {
    return jwt.sign({ userId, tier } as TokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
  }

  verifyJWT(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );

    return token;
  }

  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('RESEND_API_KEY not set, skipping verification email');
      return;
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const baseUrl = process.env.APP_URL || 'https://api.warmup.li';

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'hello@warmup.li',
      to: email,
      subject: 'Verify your Warmup account',
      html: `<p>Click <a href="${baseUrl}/api/auth/verify-email?token=${token}">here</a> to verify your email.</p><p>This link expires in 24 hours.</p>`,
    });
  }
}

export class AppError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'AppError';
  }
}

export const authService = new AuthService();
