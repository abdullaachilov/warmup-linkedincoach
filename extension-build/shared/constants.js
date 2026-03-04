export const API_URL = 'https://warmup-api-production.up.railway.app';
export const HMAC_SECRET = 'd9890bfabc43e5f0c9845f11b698ce7d82bfe846b9363f6847ff8b937e4c2cfa';

export const TIER_LIMITS = {
  free: 2,
  starter: 8,
  pro: 40,
  byok: 100,
};

export const CONTENT_CALENDAR = {
  0: { type: 'review', label: 'Weekly review', emoji: '📊' },
  1: { type: 'insight', label: 'Industry insight', emoji: '🔥' },
  2: { type: 'educational', label: 'How-to or tips', emoji: '📝' },
  3: { type: 'story', label: 'Personal story', emoji: '📖' },
  4: { type: 'engagement', label: 'Question or poll', emoji: '💬' },
  5: { type: 'celebration', label: 'Win or reflection', emoji: '🎉' },
  6: { type: 'casual', label: 'Behind-the-scenes', emoji: '🌤️' },
};

export const DAILY_ACTIONS = {
  engage: [
    { id: 'comment_1', label: 'Comment on post #1', category: 'engage' },
    { id: 'comment_2', label: 'Comment on post #2', category: 'engage' },
    { id: 'comment_3', label: 'Comment on post #3', category: 'engage' },
    { id: 'like_posts', label: 'Like 5-8 posts', category: 'engage' },
    { id: 'react_posts', label: 'React (non-like) to 2 posts', category: 'engage' },
  ],
  create: [
    { id: 'draft_post', label: 'Draft a post', category: 'create' },
    { id: 'publish_post', label: 'Publish your post', category: 'create' },
  ],
  connect: [
    { id: 'send_connections', label: 'Send 3-5 connection requests', category: 'connect' },
    { id: 'accept_pending', label: 'Accept pending requests', category: 'connect' },
  ],
  grow: [
    { id: 'follow_creators', label: 'Follow 1-2 creators/newsletters', category: 'grow' },
    { id: 'profile_viewers', label: 'Check profile viewers & connect', category: 'grow' },
  ],
};
