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

export const CATEGORY_STYLES = {
  engage: { badge: 'Engage', bg: '#eff6ff', color: '#2563eb' },
  create: { badge: 'Create', bg: '#faf5ff', color: '#7c3aed' },
  connect: { badge: 'Connect', bg: '#ecfdf5', color: '#059669' },
  grow: { badge: 'Grow', bg: '#fefce8', color: '#ca8a04' },
  reflect: { badge: 'Reflect', bg: '#fdf2f8', color: '#be185d' },
};
