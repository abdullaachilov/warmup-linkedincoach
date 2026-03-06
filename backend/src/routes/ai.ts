import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBYOKKey, extractBYOKKey } from '../middleware/byok-handler.js';
import { makeAISuggestion, checkUsageLimit } from '../services/ai-proxy.js';
import { suggestCommentSchema, draftPostSchema, postIdeasSchema, connectionNoteSchema, detectInjection } from '../utils/input-validation.js';
import { validateOutput, FALLBACK_RESPONSE } from '../utils/output-validation.js';
import { SYSTEM_PROMPTS, wrapUserContent, addInjectionAnchor } from '../utils/prompts.js';
import { TOKEN_LIMITS } from '../types/index.js';
import { db } from '../db.js';
import { AppError } from '../services/auth.js';
import { buildUserContext, markStoriesUsed } from '../services/user-context-builder.js';

const router = Router();

// All AI routes require auth and BYOK validation
router.use(requireAuth);
router.use(validateBYOKKey);

router.post('/suggest-comment', async (req: Request, res: Response) => {
  try {
    const data = suggestCommentSchema.parse(req.body);
    const byokKey = extractBYOKKey(req);
    const tier = (byokKey ? 'byok' : req.userTier) as 'free' | 'starter' | 'pro' | 'byok';

    const { contextText, storyIds } = await buildUserContext(req.userId!, data.post_text);

    const hasInjection = detectInjection(data.post_text);
    const userMessage = `${addInjectionAnchor(hasInjection)}${wrapUserContent(data.post_text, 'linkedin_post_content')}

Post author: ${data.author_name}

<task>Write a thoughtful comment on the above LinkedIn post from my perspective.</task>`;

    const result = await makeAISuggestion({
      userId: req.userId!,
      tier,
      byokKey,
      systemPrompt: SYSTEM_PROMPTS['suggest-comment'](contextText),
      userMessage,
      maxTokens: TOKEN_LIMITS['suggest-comment'].maxOutput,
      suggestionType: 'comment',
    });

    const validated = validateOutput(result.text, 'suggest-comment');
    if (!validated.valid) {
      res.json({ suggestion: FALLBACK_RESPONSE, usage: await checkUsageLimit(req.userId!, tier) });
      return;
    }

    await markStoriesUsed(storyIds);
    const usage = await checkUsageLimit(req.userId!, tier);
    res.json({ suggestion: validated.text, usage, stories_used: storyIds });
  } catch (err: unknown) {
    handleAIError(err, res);
  }
});

router.post('/draft-post', async (req: Request, res: Response) => {
  try {
    const data = draftPostSchema.parse(req.body);
    const byokKey = extractBYOKKey(req);
    const tier = (byokKey ? 'byok' : req.userTier) as 'free' | 'starter' | 'pro' | 'byok';

    const { contextText, storyIds } = await buildUserContext(req.userId!, data.idea);

    const hasInjection = detectInjection(data.idea);
    const userMessage = `${addInjectionAnchor(hasInjection)}${wrapUserContent(data.idea, 'post_idea')}

Content type: ${data.content_type || 'general'}

<task>Draft a LinkedIn post based on the above idea.</task>`;

    const result = await makeAISuggestion({
      userId: req.userId!,
      tier,
      byokKey,
      systemPrompt: SYSTEM_PROMPTS['draft-post'](contextText),
      userMessage,
      maxTokens: TOKEN_LIMITS['draft-post'].maxOutput,
      suggestionType: 'post',
    });

    const validated = validateOutput(result.text, 'draft-post');
    if (!validated.valid) {
      res.json({ draft: FALLBACK_RESPONSE, usage: await checkUsageLimit(req.userId!, tier) });
      return;
    }

    await markStoriesUsed(storyIds);
    const usage = await checkUsageLimit(req.userId!, tier);
    res.json({ draft: validated.text, usage, stories_used: storyIds });
  } catch (err: unknown) {
    handleAIError(err, res);
  }
});

router.post('/post-ideas', async (req: Request, res: Response) => {
  try {
    const data = postIdeasSchema.parse(req.body);
    const byokKey = extractBYOKKey(req);
    const tier = (byokKey ? 'byok' : req.userTier) as 'free' | 'starter' | 'pro' | 'byok';

    const { contextText, storyIds } = await buildUserContext(req.userId!);

    // Get recent topics
    const recentResult = await db.query(
      'SELECT topic FROM post_history WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL \'14 days\' ORDER BY date DESC LIMIT 10',
      [req.userId]
    );
    const recentTopics = recentResult.rows.map((r: any) => r.topic).filter(Boolean);

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];

    const feedContext = data.feed_context?.join('\n') || '';
    const userMessage = feedContext
      ? `Current trending topics from my feed:\n${wrapUserContent(feedContext, 'feed_context')}\n\n<task>Generate 3 post ideas for me.</task>`
      : '<task>Generate 3 post ideas for me based on my profile and stories.</task>';

    const result = await makeAISuggestion({
      userId: req.userId!,
      tier,
      byokKey,
      systemPrompt: SYSTEM_PROMPTS['post-ideas'](contextText, recentTopics, today),
      userMessage,
      maxTokens: TOKEN_LIMITS['post-ideas'].maxOutput,
      suggestionType: 'post_idea',
    });

    const validated = validateOutput(result.text, 'post-ideas');
    if (!validated.valid) {
      res.json({ ideas: [], usage: await checkUsageLimit(req.userId!, tier) });
      return;
    }

    let ideas;
    try {
      ideas = JSON.parse(validated.text);
    } catch {
      ideas = [{ idea: validated.text, type: 'general', hook_preview: '' }];
    }

    await markStoriesUsed(storyIds);
    const usage = await checkUsageLimit(req.userId!, tier);
    res.json({ ideas, usage, stories_used: storyIds });
  } catch (err: unknown) {
    handleAIError(err, res);
  }
});

router.post('/connection-note', async (req: Request, res: Response) => {
  try {
    const data = connectionNoteSchema.parse(req.body);
    const byokKey = extractBYOKKey(req);
    const tier = (byokKey ? 'byok' : req.userTier) as 'free' | 'starter' | 'pro' | 'byok';

    const { contextText, storyIds } = await buildUserContext(req.userId!);

    const userMessage = `Their name: ${data.target_name}
Their headline: ${data.target_headline}

<task>Write a connection request note.</task>`;

    const result = await makeAISuggestion({
      userId: req.userId!,
      tier,
      byokKey,
      systemPrompt: SYSTEM_PROMPTS['connection-note'](contextText),
      userMessage,
      maxTokens: TOKEN_LIMITS['connection-note'].maxOutput,
      suggestionType: 'connection_note',
    });

    const validated = validateOutput(result.text, 'connection-note');
    if (!validated.valid) {
      res.json({ note: FALLBACK_RESPONSE, usage: await checkUsageLimit(req.userId!, tier) });
      return;
    }

    await markStoriesUsed(storyIds);
    const usage = await checkUsageLimit(req.userId!, tier);
    res.json({ note: validated.text, usage, stories_used: storyIds });
  } catch (err: unknown) {
    handleAIError(err, res);
  }
});

router.post('/score-post', async (req: Request, res: Response) => {
  try {
    const { draft } = req.body;
    if (!draft || typeof draft !== 'string' || draft.length < 10) {
      res.status(400).json({ error: 'Post draft required (minimum 10 characters).' });
      return;
    }
    if (draft.length > 5000) {
      res.status(400).json({ error: 'Post draft too long (max 5000 characters).' });
      return;
    }

    const byokKey = extractBYOKKey(req);
    const tier = (byokKey ? 'byok' : req.userTier) as 'free' | 'starter' | 'pro' | 'byok';

    const userMessage = `<post_draft>\n${draft}\n</post_draft>\n\n<task>Score this LinkedIn post draft and return the JSON analysis.</task>`;

    const result = await makeAISuggestion({
      userId: req.userId!,
      tier,
      byokKey,
      systemPrompt: SYSTEM_PROMPTS['score-post'](),
      userMessage,
      maxTokens: 600,
      suggestionType: 'score_post',
    });

    let score;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      score = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result.text);
    } catch {
      res.status(500).json({ error: 'Failed to parse score result.' });
      return;
    }

    res.json({ score });
  } catch (err: unknown) {
    handleAIError(err, res);
  }
});

function handleAIError(err: unknown, res: Response) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
    res.status(400).json({ error: 'Invalid input.', details: (err as any).errors });
    return;
  }
  console.error('AI route error:', err);
  res.status(500).json({ error: 'Internal server error.' });
}

export default router;
