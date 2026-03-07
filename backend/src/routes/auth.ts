import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authService, AppError } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { redis } from '../redis.js';

const router = Router();

// Step 1: Extension opens this URL in a tab - redirects to LinkedIn
router.get('/linkedin', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.session_id as string;
    if (!sessionId || sessionId.length < 16) {
      res.status(400).json({ error: 'session_id required.' });
      return;
    }

    // Store session_id in Redis to validate callback
    await redis.set(`oauth_state:${sessionId}`, '1', 'EX', 600); // 10 min

    const url = authService.getLinkedInAuthURL(sessionId);
    res.redirect(url);
  } catch (err) {
    console.error('LinkedIn auth redirect error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Step 2: LinkedIn redirects here after user authorizes
router.get('/linkedin/callback', async (req: Request, res: Response) => {
  try {
    const { code, state: sessionId, error } = req.query;

    if (error) {
      res.status(400).send(authPage('Login cancelled.', false));
      return;
    }

    if (!code || !sessionId) {
      res.status(400).send(authPage('Invalid callback.', false));
      return;
    }

    // Validate state
    const valid = await redis.get(`oauth_state:${sessionId as string}`);
    if (!valid) {
      res.status(400).send(authPage('Session expired. Try again.', false));
      return;
    }
    await redis.del(`oauth_state:${sessionId as string}`);

    await authService.handleLinkedInCallback(code as string, sessionId as string);

    res.send(authPage('Login successful! You can close this tab.', true));
  } catch (err) {
    console.error('LinkedIn callback error:', err);
    const message = err instanceof AppError ? err.message : 'Authentication failed. Try again.';
    res.status(500).send(authPage(message, false));
  }
});

// Step 3: Extension polls this to get tokens
router.get('/linkedin/poll', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.session_id as string;
    if (!sessionId) {
      res.status(400).json({ error: 'session_id required.' });
      return;
    }

    const result = await authService.pollOAuthSession(sessionId);
    if (!result) {
      res.status(202).json({ status: 'pending' });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('OAuth poll error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 2FA validation (after OAuth flow if user has 2FA enabled)
router.post('/2fa/validate', async (req: Request, res: Response) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      res.status(400).json({ error: 'Temp token and code required.' });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Code must be 6 digits.' });
      return;
    }

    // Rate limit per tempToken: max 5 attempts
    const attemptKey = `2fa_attempts:${tempToken}`;
    const attempts = parseInt(await redis.get(attemptKey) || '0');
    if (attempts >= 5) {
      res.status(429).json({ error: 'Too many attempts. Request a new login.' });
      return;
    }
    await redis.incr(attemptKey);
    await redis.expire(attemptKey, 300);

    const result = await authService.validate2FA(tempToken, code);
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('2FA validate error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/2fa/setup', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await authService.setup2FA(req.userId!);
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('2FA setup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/2fa/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Valid 6-digit code required.' });
      return;
    }
    await authService.verify2FASetup(req.userId!, code);
    res.json({ message: '2FA enabled successfully.' });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('2FA verify error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/2fa/disable', requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Valid 6-digit code required.' });
      return;
    }
    await authService.disable2FA(req.userId!, code);
    res.json({ message: '2FA disabled.' });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('2FA disable error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required.' });
      return;
    }
    const result = await authService.refreshAuth(refreshToken);
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    await authService.logout(req.userId!);
    res.json({ message: 'Logged out successfully.' });
  } catch {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Simple HTML page shown after OAuth callback
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function authPage(message: string, success: boolean): string {
  const color = success ? '#10B981' : '#EF4444';
  const icon = success ? '&#10003;' : '&#10007;';
  return `<!DOCTYPE html>
<html><head><title>Warmup - Login</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f9fafb; }
  .card { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 400px; }
  .icon { font-size: 48px; color: ${color}; margin-bottom: 16px; }
  h2 { margin: 0 0 8px; color: #111827; }
  p { color: #6b7280; font-size: 14px; }
</style></head>
<body><div class="card">
  <div class="icon">${icon}</div>
  <h2>${success ? 'Done!' : 'Oops'}</h2>
  <p>${escapeHtml(message)}</p>
</div></body></html>`;
}

export default router;
