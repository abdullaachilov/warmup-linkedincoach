import { pool } from '../db.js';

const migration = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255),
  tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'byok')),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  byok_enabled BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  suggestion_type VARCHAR(50) NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_logs(user_id, date);

CREATE TABLE IF NOT EXISTS daily_usage (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  suggestion_count INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline VARCHAR(500),
  industry VARCHAR(100),
  topics TEXT[] DEFAULT '{}',
  daily_minutes INTEGER DEFAULT 5,
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed_actions JSONB DEFAULT '[]',
  total_actions INTEGER DEFAULT 0,
  post_drafted BOOLEAN DEFAULT FALSE,
  post_published BOOLEAN DEFAULT FALSE,
  connections_sent INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS streaks (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_completed_date DATE
);

CREATE TABLE IF NOT EXISTS post_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  topic VARCHAR(500),
  content_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_history_user ON post_history(user_id, date DESC);

CREATE TABLE IF NOT EXISTS spending_daily (
  date DATE NOT NULL,
  api_key_tier VARCHAR(20) NOT NULL,
  total_requests INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,
  PRIMARY KEY (date, api_key_tier)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Security: 2FA, admin role, password reset
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn OAuth
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_id VARCHAR(100) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS picture_url TEXT;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT TRUE;

-- Story Bank: personal context fields on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_situation TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_goals TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hot_takes TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_reality TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS communication_style TEXT;

-- Story Bank entries
CREATE TABLE IF NOT EXISTS story_bank_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  entry_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  used_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_bank_user ON story_bank_entries(user_id, is_active, entry_type);
CREATE INDEX IF NOT EXISTS idx_story_bank_usage ON story_bank_entries(user_id, used_count ASC);

-- Dynamic AI Sessions
CREATE TABLE IF NOT EXISTS daily_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  session_data JSONB NOT NULL,
  context_snapshot JSONB,
  actions_completed INTEGER DEFAULT 0,
  actions_total INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  generation_tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_sessions_user_date ON daily_sessions(user_id, date DESC);

CREATE TABLE IF NOT EXISTS weekly_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  sessions_completed INTEGER DEFAULT 0,
  total_actions_completed INTEGER DEFAULT 0,
  ai_suggestions_used INTEGER DEFAULT 0,
  stories_added INTEGER DEFAULT 0,
  snapshot_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE TABLE IF NOT EXISTS post_performance (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  posted_at DATE NOT NULL,
  content_preview TEXT,
  impressions INTEGER,
  reactions INTEGER,
  comments_count INTEGER,
  shares INTEGER,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_performance_user ON post_performance(user_id, posted_at DESC);

-- Retention: last_active and days_inactive tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS re_engagement_sent_at TIMESTAMPTZ;
`;

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(migration);
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
