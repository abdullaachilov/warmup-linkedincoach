import { Request, Response, NextFunction } from 'express';

const BYOK_KEY_REGEX = /^sk-ant-[a-zA-Z0-9_-]{20,180}$/;

export function validateBYOKKey(req: Request, _res: Response, next: NextFunction): void {
  const byokKey = req.headers['x-byok-key'] as string;

  if (byokKey) {
    // Validate format
    if (!BYOK_KEY_REGEX.test(byokKey)) {
      // Do NOT include the key in the error response
      _res.status(400).json({ error: 'Invalid BYOK key format.' });
      return;
    }

    // Strip control characters and null bytes
    const cleaned = byokKey.replace(/[\x00-\x1f\x7f]/g, '');
    if (cleaned !== byokKey) {
      _res.status(400).json({ error: 'Invalid BYOK key format.' });
      return;
    }

    // Attach to request for handler use (will be nulled after use)
    (req as any)._byokKey = byokKey;
  }

  next();
}

export function extractBYOKKey(req: Request): string | undefined {
  const key = (req as any)._byokKey;
  // Clear from request immediately after extraction
  (req as any)._byokKey = undefined;
  return key;
}
