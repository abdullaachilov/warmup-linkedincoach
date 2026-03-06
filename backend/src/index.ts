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
import adminRoutes from './routes/admin.js';
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

// Request signing (skip for webhooks, health check, and LinkedIn OAuth browser redirects)
app.use('/api/auth', (req, res, next) => {
  // LinkedIn OAuth routes are browser-initiated, not signed extension requests
  if (req.path.startsWith('/linkedin')) {
    next();
    return;
  }
  verifyRequestSignature(req, res, next);
});
app.use('/api/ai', verifyRequestSignature);
app.use('/api/me', verifyRequestSignature);
app.use('/api/sessions', verifyRequestSignature);
app.use('/api/admin', verifyRequestSignature);

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
app.use('/api/admin', adminRoutes);

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

// Algorithm knowledge base (updated for 2026)
const ALGORITHM_RULES = {
  engagement_weights: {
    save: 10,
    send_share: 7,
    comment: 15,
    dwell_time: 5,
    click_see_more: 3,
    reaction_nonlike: 2,
    like: 1,
  },
  posting: {
    best_days: ['tuesday', 'wednesday', 'thursday'],
    best_hours_local: [8, 9, 10],
    ideal_length_chars: { min: 900, max: 1500 },
    max_hashtags: 3,
    golden_window_minutes: 90,
    link_in_body_penalty: 0.4,
    edit_in_first_hour_kills_reach: true,
    min_hours_between_posts: 12,
    format_performance: {
      text_only: 'Best in 2026 - highest average reach',
      carousel: 'Good for educational/list content',
      poll: '200%+ reach but lower quality engagement',
      image: 'Moderate boost, depends on quality',
      native_video: 'Strong but requires high production',
    },
    engagement_bait_penalty: true,
    engagement_bait_phrases: [
      'Like if you agree', 'Comment YES', 'Share this with someone',
      'Tag someone who', 'Repost if', 'Follow me for more',
    ],
  },
  comments: {
    min_words: 5,
    ideal_range: { min: 15, max: 50 },
    early_comment_bonus: true,
    depth_score_matters: true,
    generic_phrases_to_avoid: [
      'Great post!', 'Thanks for sharing!', 'This!',
      'Agree!', 'Love this!', 'So true!', 'Well said!',
      'Couldn\'t agree more!', 'Spot on!',
    ],
  },
  connections: {
    safe_daily_limit: 5,
    safe_weekly_limit: 25,
    note_max_chars: 200,
    note_acceptance_boost: 1.48,
  },
  signals: {
    topical_consistency: 'Posting about the same 2-3 topics boosts reach over time',
    depth_score: 'Algorithm rewards substantive content over surface-level takes',
    creator_mode: 'Enable for Follow button and featured content section',
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
