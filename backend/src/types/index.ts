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
  created_at: Date;
  updated_at: Date;
}

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
};
