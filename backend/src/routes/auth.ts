import { Router, Request, Response } from 'express';
import { authService, AppError } from '../services/auth.js';
import { registerSchema, loginSchema } from '../utils/input-validation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await authService.register(data.email, data.password, ip);
    res.status(201).json({ message: 'Account created. Check your email for verification.', userId: result.userId });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input.', details: (err as any).errors });
      return;
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).json({ error: 'Verification token required.' });
      return;
    }
    await authService.verifyEmail(token);
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input.' });
      return;
    }
    console.error('Login error:', err);
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

export default router;
