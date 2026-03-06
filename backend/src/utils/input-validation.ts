import { z } from 'zod';

// Strip control characters and null bytes
function sanitizeText(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim();
}

// Prompt injection detection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+all\s+instructions/i,
  /you\s+are\s+now/i,
  /new\s+instructions:/i,
  /system\s+prompt:/i,
  /act\s+as/i,
  /forget\s+everything/i,
  /disregard\s+(all|previous|the|your)/i,
];

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

export const suggestCommentSchema = z.object({
  post_text: z.string().min(1).max(2000).transform(sanitizeText),
  author_name: z.string().min(1).max(200).transform(sanitizeText),
});

export const draftPostSchema = z.object({
  idea: z.string().min(1).max(1000).transform(sanitizeText),
  content_type: z.string().max(50).optional().transform(v => v ? sanitizeText(v) : undefined),
});

export const postIdeasSchema = z.object({
  feed_context: z.array(z.string().max(500).transform(sanitizeText)).max(5).optional(),
});

export const connectionNoteSchema = z.object({
  target_name: z.string().min(1).max(200).transform(sanitizeText),
  target_headline: z.string().min(1).max(500).transform(sanitizeText),
});

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const profileUpdateSchema = z.object({
  headline: z.string().max(500).optional(),
  industry: z.string().max(100).optional(),
  topics: z.array(z.string().max(50)).max(10).optional(),
  daily_minutes: z.number().int().min(1).max(60).optional(),
  timezone: z.string().max(50).optional(),
  work_situation: z.string().max(500).optional(),
  current_goals: z.string().max(500).optional(),
  hot_takes: z.string().max(500).optional(),
  daily_reality: z.string().max(500).optional(),
  communication_style: z.string().max(500).optional(),
});

const storyEntryTypes = ['win', 'lesson', 'opinion', 'project', 'milestone', 'daily_log'] as const;

export const storyBankCreateSchema = z.object({
  entry_type: z.enum(storyEntryTypes),
  content: z.string().min(1).max(1000).transform(sanitizeText),
  tags: z.array(z.string().max(50).transform(sanitizeText)).max(10).default([]),
});

export const storyBankUpdateSchema = z.object({
  content: z.string().min(1).max(1000).transform(sanitizeText).optional(),
  tags: z.array(z.string().max(50).transform(sanitizeText)).max(10).optional(),
  entry_type: z.enum(storyEntryTypes).optional(),
});

export const sessionUpdateSchema = z.object({
  completed_actions: z.array(z.string().max(100)).max(20).optional(),
  post_drafted: z.boolean().optional(),
  post_published: z.boolean().optional(),
  connections_sent: z.number().int().min(0).max(20).optional(),
});

export const sessionGenerateSchema = z.object({
  feed_posts: z.array(z.object({
    author: z.string().max(200).transform(sanitizeText),
    text: z.string().max(500).transform(sanitizeText),
  })).max(10).optional(),
});

export const actionCompleteSchema = z.object({
  action_id: z.string().min(1).max(100),
  completed: z.boolean(),
});

export const postPerformanceSchema = z.object({
  content_preview: z.string().max(500).transform(sanitizeText).optional(),
  impressions: z.number().int().min(0).optional(),
  reactions: z.number().int().min(0).optional(),
  comments_count: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
});
