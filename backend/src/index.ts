import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { redis } from './redis.js';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import sessionRoutes from './routes/sessions.js';
import billingRoutes from './routes/billing.js';
import userRoutes from './routes/user.js';
import { verifyRequestSignature } from './middleware/request-signing.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Trust proxy (Railway)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' },
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
}));

// Health check (before CORS so monitoring can reach it)
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: 'Service dependencies unavailable' });
  }
});

// CORS
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks)
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-BYOK-Key', 'X-Warmup-Signature', 'X-Warmup-Timestamp'],
  credentials: true,
}));

// Logging - exclude sensitive headers
morgan.token('safe-headers', (req: express.Request) => {
  const h = { ...req.headers };
  delete h['x-byok-key'];
  delete h['authorization'];
  delete h['cookie'];
  return JSON.stringify(h);
});
app.use(morgan(':method :url :status :response-time ms'));

// Global rate limit: 100 req/min per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
}));

// Body parsing - raw body for Stripe webhooks
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10kb' }));

// Request signing (skip for webhooks and health check)
app.use('/api/auth', verifyRequestSignature);
app.use('/api/ai', verifyRequestSignature);
app.use('/api/me', verifyRequestSignature);
app.use('/api/sessions', verifyRequestSignature);

// Security headers on every response
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Request-Id', crypto.randomUUID());
  next();
});

// Algorithm knowledge base endpoint
app.get('/api/algorithm-rules', (_req, res) => {
  res.json(ALGORITHM_RULES);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/me', userRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// Start server
async function start() {
  try {
    await redis.connect();
    console.log('Redis connected');
  } catch (err) {
    console.warn('Redis connection failed, continuing:', (err as Error).message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warmup API running on port ${PORT}`);
  });
}

start();

// Algorithm knowledge base
const ALGORITHM_RULES = {
  engagement_weights: {
    comment: 15,
    share: 7,
    reaction_nonlike: 2,
    like: 1,
    dwell_time: 5,
    click_see_more: 3,
    save: 10,
  },
  posting: {
    best_days: ['tuesday', 'wednesday', 'thursday'],
    best_hours_local: [8, 9, 10],
    ideal_length: { min: 100, max: 200 },
    max_hashtags: 3,
    golden_hour_minutes: 60,
    link_in_body_penalty: 0.5,
    edit_in_first_hour_kills_reach: true,
    image_boost: 1.5,
    carousel_boost: 2.5,
    native_video_boost: 1.8,
  },
  comments: {
    min_words: 5,
    ideal_range: { min: 15, max: 50 },
    early_comment_bonus: true,
    generic_phrases_to_avoid: [
      'Great post!', 'Thanks for sharing!', 'This!',
      'Agree!', 'Love this!', 'So true!', 'Well said!'
    ],
  },
  connections: {
    safe_daily_limit: 5,
    safe_weekly_limit: 25,
    note_max_chars: 200,
    note_acceptance_boost: 1.48,
  },
  content_calendar: {
    monday: { type: 'insight', label: 'Industry insight or hot take', emoji: '🔥' },
    tuesday: { type: 'educational', label: 'How-to or tips', emoji: '📝' },
    wednesday: { type: 'story', label: 'Personal story or lesson', emoji: '📖' },
    thursday: { type: 'engagement', label: 'Question or poll', emoji: '💬' },
    friday: { type: 'celebration', label: 'Win, shoutout, or reflection', emoji: '🎉' },
    saturday: { type: 'casual', label: 'Behind-the-scenes or hobby', emoji: '🌤️' },
    sunday: { type: 'review', label: 'Weekly review (internal only)', emoji: '📊' },
  },
};

export { app };
