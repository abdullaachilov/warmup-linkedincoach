import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const MAX_TIMESTAMP_DRIFT_MS = 30000; // 30 seconds

function getSharedSecret(): string {
  return process.env.HMAC_SHARED_SECRET || 'dev-shared-secret';
}

export function verifyRequestSignature(req: Request, res: Response, next: NextFunction): void {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }

  const signature = req.headers['x-warmup-signature'] as string;
  const timestamp = req.headers['x-warmup-timestamp'] as string;

  if (!signature || !timestamp) {
    res.status(401).json({ error: 'Missing request signature.' });
    return;
  }

  // Check timestamp freshness
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) {
    res.status(401).json({ error: 'Invalid timestamp.' });
    return;
  }

  const drift = Math.abs(Date.now() - requestTime);
  if (drift > MAX_TIMESTAMP_DRIFT_MS) {
    res.status(401).json({ error: 'Stale request.' });
    return;
  }

  // Verify HMAC
  const payload = JSON.stringify(req.body) + timestamp;
  const expected = crypto
    .createHmac('sha256', getSharedSecret())
    .update(payload)
    .digest('base64');

  // Timing-safe comparison
  try {
    const sigBuffer = Buffer.from(signature, 'base64');
    const expectedBuffer = Buffer.from(expected, 'base64');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      res.status(401).json({ error: 'Invalid signature.' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Invalid signature format.' });
    return;
  }

  next();
}
