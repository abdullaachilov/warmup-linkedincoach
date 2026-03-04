import { Request, Response, NextFunction } from 'express';
import { authService, AppError } from '../services/auth.js';
import type { TokenPayload } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userTier?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required.' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload: TokenPayload = authService.verifyJWT(token);
    req.userId = payload.userId;
    req.userTier = payload.tier;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction): void {
  // This would check the user's email_verified status
  // For now, the JWT is only issued after email verification, so this is implicit
  next();
}
