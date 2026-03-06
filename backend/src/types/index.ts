export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  password_hash: string | null;
  tier: 'free' | 'starter' | 'pro' | 'byok';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  byok_enabled: boolean;
  active: boolean;
  totp_secret: string | null;
  totp_enabled: boolean;
  role: 'user' | 'admin';
  linkedin_id: string | null;
  name: string | null;
  picture_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Profile {
  user_id: string;
  headline: string | null;
  industry: string | null;
  topics: string[];
  daily_minutes: number;
  timezone: string;
  work_situation: string | null;
  current_goals: string | null;
  hot_takes: string | null;
  daily_reality: string | null;
  communication_style: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StoryBankEntry {
  id: number;
  user_id: string;
  entry_type: string;
  content: string;
  tags: string[];
  used_count: number;
  last_used_at: Date | null;
  is_active: boolean;
  created_at: Date;
}

export const STORY_ENTRY_TYPES = ['win', 'lesson', 'opinion', 'project', 'milestone', 'daily_log'] as const;

export interface Session {
  user_id: string;
  date: string;
  completed_actions: string[];
  total_actions: number;
  post_drafted: boolean;
  post_published: boolean;
  connections_sent: number;
  completed_at: Date | null;
}

export interface Streak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
}

export interface UsageLog {
  id: number;
  user_id: string;
  date: string;
  suggestion_type: string;
  tokens_used: number;
  created_at: Date;
}

export interface AISuggestionRequest {
  userId: string;
  tier: 'free' | 'starter' | 'pro' | 'byok';
  byokKey?: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  suggestionType: string;
}

export interface TokenPayload {
  userId: string;
  tier: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export const TIER_LIMITS: Record<string, number> = {
  free: 2,
  starter: 8,
  pro: 40,
  byok: 100,
};

export const TOKEN_LIMITS: Record<string, { maxOutput: number; maxInput: number }> = {
  'suggest-comment': { maxOutput: 300, maxInput: 2000 },
  'draft-post': { maxOutput: 800, maxInput: 2000 },
  'post-ideas': { maxOutput: 500, maxInput: 2000 },
  'connection-note': { maxOutput: 100, maxInput: 1000 },
  'score-post': { maxOutput: 600, maxInput: 5000 },
  'generate-session': { maxOutput: 1200, maxInput: 3000 },
};

export interface SessionAction {
  id: string;
  category: 'engage' | 'create' | 'connect' | 'grow' | 'reflect';
  label: string;
  sublabel?: string;
  why?: string;
  completed: boolean;
  ai_type?: 'comment' | 'post' | 'ideas' | 'note';
  context?: Record<string, string>;
}

export interface DailySessionData {
  theme: string;
  actions: SessionAction[];
  estimated_minutes: number;
}

export interface DailySession {
  id: number;
  user_id: string;
  date: string;
  session_data: DailySessionData;
  context_snapshot: Record<string, unknown> | null;
  actions_completed: number;
  actions_total: number;
  completed_at: Date | null;
  generation_tokens_used: number | null;
  created_at: Date;
}

export interface WeeklySnapshot {
  id: number;
  user_id: string;
  week_start: string;
  sessions_completed: number;
  total_actions_completed: number;
  ai_suggestions_used: number;
  stories_added: number;
  snapshot_data: Record<string, unknown> | null;
  created_at: Date;
}
