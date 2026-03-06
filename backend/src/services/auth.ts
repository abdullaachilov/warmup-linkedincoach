import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db.js';
import { redis } from '../redis.js';
import type { User, TokenPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '';
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';

export class AuthService {

  // --- LinkedIn OAuth ---

  getLinkedInAuthURL(sessionId: string): string {
    const redirectUri = `${process.env.APP_URL || 'https://warmup-api-production.up.railway.app'}/api/auth/linkedin/callback`;
    const scope = 'openid profile email';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LINKEDIN_CLIENT_ID,
      redirect_uri: redirectUri,
      state: sessionId,
      scope,
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  async handleLinkedInCallback(code: string, sessionId: string): Promise<void> {
    const redirectUri = `${process.env.APP_URL || 'https://warmup-api-production.up.railway.app'}/api/auth/linkedin/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('LinkedIn token exchange failed:', err);
      throw new AppError('LinkedIn authentication failed.', 401);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch user info from LinkedIn
    const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoResponse.ok) {
      console.error('LinkedIn userinfo failed:', await userInfoResponse.text());
      throw new AppError('Failed to fetch LinkedIn profile.', 401);
    }

    const profile = await userInfoResponse.json();
    const linkedinId = profile.sub;
    const email = profile.email;
    const name = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim();
    const pictureUrl = profile.picture || null;

    if (!linkedinId || !email) {
      throw new AppError('LinkedIn did not provide required profile data.', 400);
    }

    // Find or create user
    let userResult = await db.query(
      'SELECT id, tier, role, active FROM users WHERE linkedin_id = $1',
      [linkedinId]
    );

    let userId: string;

    if (userResult.rows.length > 0) {
      // Existing user - update profile info
      const user = userResult.rows[0];
      if (!user.active) {
        throw new AppError('Account is suspended.', 403);
      }
      userId = user.id;
      await db.query(
        'UPDATE users SET email = $1, name = $2, picture_url = $3, updated_at = NOW() WHERE id = $4',
        [email.toLowerCase(), name, pictureUrl, userId]
      );
    } else {
      // Check if email already exists (link accounts)
      const emailResult = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (emailResult.rows.length > 0) {
        userId = emailResult.rows[0].id;
        await db.query(
          'UPDATE users SET linkedin_id = $1, name = $2, picture_url = $3, email_verified = TRUE, updated_at = NOW() WHERE id = $4',
          [linkedinId, name, pictureUrl, userId]
        );
      } else {
        // New user
        const role = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';
        const result = await db.query(
          'INSERT INTO users (email, linkedin_id, name, picture_url, email_verified, role) VALUES ($1, $2, $3, $4, TRUE, $5) RETURNING id',
          [email.toLowerCase(), linkedinId, name, pictureUrl, role]
        );
        userId = result.rows[0].id;

        // Create default profile (populate headline from LinkedIn name)
        await db.query('INSERT INTO profiles (user_id) VALUES ($1)', [userId]);
        await db.query('INSERT INTO streaks (user_id) VALUES ($1)', [userId]);
      }
    }

    // Get full user for token generation
    const fullUser = await db.query('SELECT id, tier, role, totp_enabled FROM users WHERE id = $1', [userId]);
    const user = fullUser.rows[0];

    // Check if 2FA is enabled
    if (user.totp_enabled) {
      const tempToken = crypto.randomBytes(32).toString('hex');
      await redis.set(`2fa_pending:${tempToken}`, userId, 'EX', 300);
      // Store 2FA pending state for polling
      await redis.set(`oauth_session:${sessionId}`, JSON.stringify({ requires2FA: true, tempToken }), 'EX', 300);
      return;
    }

    // Generate tokens and store for polling
    const jwtToken = this.generateJWT(user.id, user.tier, user.role);
    const refreshToken = await this.generateRefreshToken(user.id);

    await redis.set(
      `oauth_session:${sessionId}`,
      JSON.stringify({ jwt: jwtToken, refreshToken }),
      'EX', 300 // 5 min TTL
    );
  }

  async pollOAuthSession(sessionId: string): Promise<any | null> {
    const data = await redis.get(`oauth_session:${sessionId}`);
    if (!data) return null;

    const parsed = JSON.parse(data);
    // Consume on successful read (one-time use)
    await redis.del(`oauth_session:${sessionId}`);
    return parsed;
  }

  // --- 2FA ---

  async validate2FA(tempToken: string, totpCode: string): Promise<{ jwt: string; refreshToken: string; user: Partial<User> }> {
    const userId = await redis.get(`2fa_pending:${tempToken}`);
    if (!userId) {
      throw new AppError('Invalid or expired 2FA session.', 401);
    }

    const result = await db.query(
      'SELECT id, email, tier, byok_enabled, totp_secret, role FROM users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];
    if (!user || !user.totp_secret) {
      throw new AppError('2FA not configured.', 400);
    }

    const { TOTP } = await import('otpauth');
    const totp = new TOTP({
      issuer: 'Warmup',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: user.totp_secret,
    });

    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      throw new AppError('Invalid 2FA code.', 401);
    }

    await redis.del(`2fa_pending:${tempToken}`);

    const token = this.generateJWT(user.id, user.tier, user.role);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      jwt: token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        byok_enabled: user.byok_enabled,
        role: user.role,
      },
    };
  }

  async setup2FA(userId: string): Promise<{ uri: string; qrDataUrl: string }> {
    const result = await db.query('SELECT email, totp_enabled FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) throw new AppError('User not found.', 404);
    if (user.totp_enabled) throw new AppError('2FA is already enabled.', 400);

    const { TOTP, Secret } = await import('otpauth');
    const secret = new Secret({ size: 20 });

    const totp = new TOTP({
      issuer: 'Warmup',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const uri = totp.toString();
    await redis.set(`2fa_setup:${userId}`, secret.base32, 'EX', 600);

    const QRCode = await import('qrcode');
    const qrDataUrl = await QRCode.toDataURL(uri);

    return { uri, qrDataUrl };
  }

  async verify2FASetup(userId: string, totpCode: string): Promise<void> {
    const secretBase32 = await redis.get(`2fa_setup:${userId}`);
    if (!secretBase32) {
      throw new AppError('No pending 2FA setup. Start setup again.', 400);
    }

    const result = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) throw new AppError('User not found.', 404);

    const { TOTP } = await import('otpauth');
    const totp = new TOTP({
      issuer: 'Warmup',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secretBase32,
    });

    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      throw new AppError('Invalid code. Try again.', 400);
    }

    await db.query(
      'UPDATE users SET totp_secret = $1, totp_enabled = TRUE, updated_at = NOW() WHERE id = $2',
      [secretBase32, userId]
    );
    await redis.del(`2fa_setup:${userId}`);
  }

  async disable2FA(userId: string, totpCode: string): Promise<void> {
    const result = await db.query(
      'SELECT email, totp_secret, totp_enabled FROM users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];
    if (!user || !user.totp_enabled) {
      throw new AppError('2FA is not enabled.', 400);
    }

    const { TOTP } = await import('otpauth');
    const totp = new TOTP({
      issuer: 'Warmup',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: user.totp_secret,
    });

    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      throw new AppError('Invalid 2FA code.', 401);
    }

    await db.query(
      'UPDATE users SET totp_secret = NULL, totp_enabled = FALSE, updated_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  // --- Token management ---

  async refreshAuth(refreshTokenValue: string): Promise<{ jwt: string; refreshToken: string }> {
    const tokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');

    const result = await db.query(
      'SELECT rt.id, rt.user_id, rt.used, rt.expires_at, u.tier, u.active, u.role FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1',
      [tokenHash]
    );
    const tokenRecord = result.rows[0];

    if (!tokenRecord) throw new AppError('Invalid refresh token.', 401);
    if (tokenRecord.used) throw new AppError('Refresh token already used.', 401);
    if (new Date(tokenRecord.expires_at) < new Date()) throw new AppError('Refresh token expired.', 401);
    if (!tokenRecord.active) throw new AppError('Account is suspended.', 403);

    await db.query('UPDATE refresh_tokens SET used = TRUE WHERE id = $1', [tokenRecord.id]);

    const newJwt = this.generateJWT(tokenRecord.user_id, tokenRecord.tier, tokenRecord.role);
    const newRefreshToken = await this.generateRefreshToken(tokenRecord.user_id);

    return { jwt: newJwt, refreshToken: newRefreshToken };
  }

  async logout(userId: string): Promise<void> {
    await db.query('UPDATE refresh_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [userId]);
  }

  generateJWT(userId: string, tier: string, role?: string): string {
    return jwt.sign({ userId, tier, role: role || 'user' } as TokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
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
}

export class AppError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'AppError';
  }
}

export const authService = new AuthService();
