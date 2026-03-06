import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pushQueryResult } from '../setup.js';

describe('Story Bank & User Context Builder', () => {
  describe('buildUserContext', () => {
    it('builds context with all profile fields', async () => {
      const { buildUserContext } = await import('../../src/services/user-context-builder.js');

      // Profile query
      pushQueryResult({
        rows: [{
          headline: 'Senior Engineer at Acme',
          industry: 'Technology',
          topics: ['AI', 'TypeScript'],
          work_situation: 'Solo B2B contractor',
          current_goals: 'Breaking into US market',
          hot_takes: 'AI is underused',
          daily_reality: 'Code reviews, architecture',
          communication_style: 'Direct, technical',
        }],
      });
      // Stories query
      pushQueryResult({
        rows: [
          { id: 1, entry_type: 'win', content: 'Shipped extension in 2 days', tags: ['ai'], used_count: 0 },
          { id: 2, entry_type: 'lesson', content: 'Learned TDD the hard way', tags: ['coding'], used_count: 1 },
        ],
      });

      const { contextText, storyIds } = await buildUserContext('user-1', 'AI tools');

      expect(contextText).toContain('Senior Engineer at Acme');
      expect(contextText).toContain('Technology');
      expect(contextText).toContain('AI, TypeScript');
      expect(contextText).toContain('Solo B2B contractor');
      expect(contextText).toContain('Breaking into US market');
      expect(contextText).toContain('AI is underused');
      expect(contextText).toContain('Code reviews, architecture');
      expect(contextText).toContain('Direct, technical');
      expect(contextText).toContain('[win] Shipped extension in 2 days');
      expect(contextText).toContain('[lesson] Learned TDD the hard way');
      expect(contextText).toContain('NEVER invent teams');
      expect(storyIds).toEqual([1, 2]);
    });

    it('handles missing/empty profile fields gracefully', async () => {
      const { buildUserContext } = await import('../../src/services/user-context-builder.js');

      pushQueryResult({ rows: [{ headline: '', industry: '', topics: [] }] });
      pushQueryResult({ rows: [] });

      const { contextText, storyIds } = await buildUserContext('user-1');

      expect(contextText).toContain('Professional');
      expect(contextText).toContain('General');
      expect(contextText).not.toContain('Work situation');
      expect(storyIds).toEqual([]);
    });

    it('works with empty story bank (graceful degradation)', async () => {
      const { buildUserContext } = await import('../../src/services/user-context-builder.js');

      pushQueryResult({
        rows: [{
          headline: 'PM at Startup',
          industry: 'Tech',
          topics: ['product'],
          work_situation: 'Early stage',
          current_goals: null,
          hot_takes: null,
          daily_reality: null,
          communication_style: null,
        }],
      });
      pushQueryResult({ rows: [] });

      const { contextText, storyIds } = await buildUserContext('user-1');

      expect(contextText).toContain('PM at Startup');
      expect(contextText).toContain('Story Bank is empty');
      expect(storyIds).toEqual([]);
    });

    it('returns max 5 story IDs', async () => {
      const { buildUserContext } = await import('../../src/services/user-context-builder.js');

      pushQueryResult({ rows: [{ headline: 'Dev', industry: 'Tech', topics: [] }] });
      pushQueryResult({
        rows: Array.from({ length: 5 }, (_, i) => ({
          id: i + 1, entry_type: 'win', content: `Story ${i + 1}`, tags: [], used_count: i,
        })),
      });

      const { storyIds } = await buildUserContext('user-1');
      expect(storyIds).toHaveLength(5);
    });
  });

  describe('getRelevantStories', () => {
    it('calls db with topic keywords for tag matching', async () => {
      const { getRelevantStories } = await import('../../src/services/user-context-builder.js');
      const { db } = await import('../../src/db.js');

      pushQueryResult({
        rows: [{ id: 1, entry_type: 'win', content: 'AI win', tags: ['ai'], used_count: 0 }],
      });

      const stories = await getRelevantStories('user-1', 'AI coding');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tags && $2'),
        expect.arrayContaining(['user-1']),
      );
      expect(stories).toHaveLength(1);
    });

    it('works without topic', async () => {
      const { getRelevantStories } = await import('../../src/services/user-context-builder.js');
      const { db } = await import('../../src/db.js');

      pushQueryResult({ rows: [] });

      await getRelevantStories('user-1');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY used_count ASC'),
        ['user-1'],
      );
    });
  });

  describe('markStoriesUsed', () => {
    it('increments used_count for given story IDs', async () => {
      const { markStoriesUsed } = await import('../../src/services/user-context-builder.js');
      const { db } = await import('../../src/db.js');

      pushQueryResult({ rows: [] });
      await markStoriesUsed([1, 2, 3]);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('used_count = used_count + 1'),
        [[1, 2, 3]],
      );
    });

    it('does nothing for empty array', async () => {
      const { markStoriesUsed } = await import('../../src/services/user-context-builder.js');
      const { db } = await import('../../src/db.js');

      await markStoriesUsed([]);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('Story Bank CRUD validation', () => {
    it('storyBankCreateSchema accepts valid entry', async () => {
      const { storyBankCreateSchema } = await import('../../src/utils/input-validation.js');

      const result = storyBankCreateSchema.parse({
        entry_type: 'win',
        content: 'Shipped a feature in one day',
        tags: ['shipping', 'speed'],
      });

      expect(result.entry_type).toBe('win');
      expect(result.content).toBe('Shipped a feature in one day');
      expect(result.tags).toEqual(['shipping', 'speed']);
    });

    it('rejects invalid entry_type', async () => {
      const { storyBankCreateSchema } = await import('../../src/utils/input-validation.js');

      expect(() => storyBankCreateSchema.parse({
        entry_type: 'invalid',
        content: 'test',
      })).toThrow();
    });

    it('rejects content over 1000 characters', async () => {
      const { storyBankCreateSchema } = await import('../../src/utils/input-validation.js');

      expect(() => storyBankCreateSchema.parse({
        entry_type: 'win',
        content: 'x'.repeat(1001),
      })).toThrow();
    });

    it('rejects more than 10 tags', async () => {
      const { storyBankCreateSchema } = await import('../../src/utils/input-validation.js');

      expect(() => storyBankCreateSchema.parse({
        entry_type: 'win',
        content: 'test',
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
      })).toThrow();
    });

    it('defaults tags to empty array', async () => {
      const { storyBankCreateSchema } = await import('../../src/utils/input-validation.js');

      const result = storyBankCreateSchema.parse({
        entry_type: 'lesson',
        content: 'A lesson learned',
      });
      expect(result.tags).toEqual([]);
    });

    it('accepts all valid entry types', async () => {
      const { storyBankCreateSchema } = await import('../../src/utils/input-validation.js');

      for (const type of ['win', 'lesson', 'opinion', 'project', 'milestone', 'daily_log']) {
        const result = storyBankCreateSchema.parse({ entry_type: type, content: 'test' });
        expect(result.entry_type).toBe(type);
      }
    });

    it('profileUpdateSchema accepts story bank context fields', async () => {
      const { profileUpdateSchema } = await import('../../src/utils/input-validation.js');

      const result = profileUpdateSchema.parse({
        work_situation: 'Solo contractor',
        current_goals: 'Break into US market',
        hot_takes: 'AI is underused',
        daily_reality: 'Code reviews',
        communication_style: 'Direct',
      });

      expect(result.work_situation).toBe('Solo contractor');
      expect(result.communication_style).toBe('Direct');
    });
  });

  describe('Updated AI prompts', () => {
    it('suggest-comment prompt includes user context', async () => {
      const { SYSTEM_PROMPTS } = await import('../../src/utils/prompts.js');

      const prompt = SYSTEM_PROMPTS['suggest-comment']('USER CONTEXT - test context');
      expect(prompt).toContain('USER CONTEXT - test context');
      expect(prompt).toContain('Story Bank');
      expect(prompt).toContain('communication style');
    });

    it('draft-post prompt includes user context', async () => {
      const { SYSTEM_PROMPTS } = await import('../../src/utils/prompts.js');

      const prompt = SYSTEM_PROMPTS['draft-post']('USER CONTEXT - my context');
      expect(prompt).toContain('USER CONTEXT - my context');
      expect(prompt).toContain('ghostwrites');
      expect(prompt).toContain('Story Bank');
    });

    it('post-ideas prompt includes user context and recent topics', async () => {
      const { SYSTEM_PROMPTS } = await import('../../src/utils/prompts.js');

      const prompt = SYSTEM_PROMPTS['post-ideas']('USER CONTEXT - ideas', ['topic1', 'topic2'], 'monday');
      expect(prompt).toContain('USER CONTEXT - ideas');
      expect(prompt).toContain('topic1, topic2');
      expect(prompt).toContain('monday');
    });

    it('connection-note prompt includes user context', async () => {
      const { SYSTEM_PROMPTS } = await import('../../src/utils/prompts.js');

      const prompt = SYSTEM_PROMPTS['connection-note']('USER CONTEXT - connect');
      expect(prompt).toContain('USER CONTEXT - connect');
      expect(prompt).toContain('communication style');
    });
  });
});
