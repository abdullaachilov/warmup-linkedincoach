import { db } from '../db.js';
import type { StoryBankEntry } from '../types/index.js';

interface ProfileContext {
  headline: string;
  industry: string;
  topics: string[];
  work_situation: string | null;
  current_goals: string | null;
  hot_takes: string | null;
  daily_reality: string | null;
  communication_style: string | null;
}

export async function getProfile(userId: string): Promise<ProfileContext> {
  const result = await db.query(
    'SELECT headline, industry, topics, work_situation, current_goals, hot_takes, daily_reality, communication_style FROM profiles WHERE user_id = $1',
    [userId]
  );
  const row = result.rows[0];
  return {
    headline: row?.headline || '',
    industry: row?.industry || '',
    topics: row?.topics || [],
    work_situation: row?.work_situation || null,
    current_goals: row?.current_goals || null,
    hot_takes: row?.hot_takes || null,
    daily_reality: row?.daily_reality || null,
    communication_style: row?.communication_style || null,
  };
}

export async function getRelevantStories(userId: string, topic?: string): Promise<StoryBankEntry[]> {
  let query: string;
  let params: any[];

  if (topic) {
    const keywords = topic.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
    if (keywords.length > 0) {
      // Boost stories with matching tags, then prioritize least-used, then most recent
      query = `SELECT *, CASE WHEN tags && $2 THEN 0 ELSE 1 END AS tag_rank
               FROM story_bank_entries
               WHERE user_id = $1 AND is_active = TRUE
               ORDER BY tag_rank ASC, used_count ASC, created_at DESC
               LIMIT 5`;
      params = [userId, keywords];
    } else {
      query = `SELECT * FROM story_bank_entries
               WHERE user_id = $1 AND is_active = TRUE
               ORDER BY used_count ASC, created_at DESC
               LIMIT 5`;
      params = [userId];
    }
  } else {
    query = `SELECT * FROM story_bank_entries
             WHERE user_id = $1 AND is_active = TRUE
             ORDER BY used_count ASC, created_at DESC
             LIMIT 5`;
    params = [userId];
  }

  const result = await db.query(query, params);
  return result.rows;
}

export async function buildUserContext(userId: string, postTopic?: string): Promise<{ contextText: string; storyIds: number[] }> {
  const profile = await getProfile(userId);
  const stories = await getRelevantStories(userId, postTopic);

  const hasPersonalContext = profile.work_situation || profile.current_goals || profile.hot_takes || profile.daily_reality || profile.communication_style;

  let contextText = `USER CONTEXT - This is the real person you're writing for:

Who they are: ${profile.headline || 'Professional'}
Industry: ${profile.industry || 'General'}
Topics they know: ${profile.topics.length > 0 ? profile.topics.join(', ') : 'General'}`;

  if (hasPersonalContext) {
    if (profile.work_situation) contextText += `\nWork situation: ${profile.work_situation}`;
    if (profile.daily_reality) contextText += `\nDaily reality: ${profile.daily_reality}`;
    if (profile.current_goals) contextText += `\nCurrent goals: ${profile.current_goals}`;
    if (profile.hot_takes) contextText += `\nTheir hot takes: ${profile.hot_takes}`;
    if (profile.communication_style) contextText += `\nCommunication style: ${profile.communication_style}`;
  }

  if (stories.length > 0) {
    contextText += `\n\nSTORY BANK - Real experiences to draw from:
${stories.map((s, i) => `${i + 1}. [${s.entry_type}] ${s.content}`).join('\n')}`;
  }

  contextText += `\n\nRULES:
- ONLY reference experiences from the Story Bank above or general knowledge
- NEVER invent teams, companies, metrics, or experiences not listed above
- NEVER fabricate quotes, conversations, or specific numbers unless from the Story Bank
- Match the communication style described above
- The post should sound like THIS person wrote it, not a generic LinkedIn influencer`;

  if (stories.length === 0 && hasPersonalContext) {
    contextText += `\n- Story Bank is empty. Write based on the profile context above. Stay within what you know about this person.`;
  }

  return {
    contextText,
    storyIds: stories.map(s => s.id),
  };
}

export async function markStoriesUsed(storyIds: number[]): Promise<void> {
  if (storyIds.length === 0) return;
  await db.query(
    `UPDATE story_bank_entries SET used_count = used_count + 1, last_used_at = NOW() WHERE id = ANY($1)`,
    [storyIds]
  );
}
