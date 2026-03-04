// This script ONLY reads visible DOM content. It NEVER modifies the page.

const readFeedPosts = () => {
  const posts = document.querySelectorAll('[data-urn]');
  return Array.from(posts).slice(0, 10).map(post => {
    const authorEl = post.querySelector('.update-components-actor__name');
    const textEl = post.querySelector('.feed-shared-update-v2__description');
    const likesEl = post.querySelector('.social-details-social-counts__reactions-count');
    const commentsEl = post.querySelector('.social-details-social-counts__comments');
    return {
      author: authorEl?.textContent?.trim() || 'Unknown',
      text: textEl?.textContent?.trim()?.substring(0, 500) || '',
      likes: parseInt(likesEl?.textContent?.trim() || '0'),
      comments: parseInt(commentsEl?.textContent?.trim() || '0'),
    };
  });
};

const getPageContext = () => {
  const url = window.location.href;
  if (url.includes('/feed')) return 'feed';
  if (url.includes('/in/')) return 'profile';
  if (url.includes('/posts/')) return 'post';
  if (url.includes('/groups/')) return 'group';
  return 'other';
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_FEED_CONTEXT') {
    sendResponse({ page: getPageContext(), posts: readFeedPosts() });
  }
  return true;
});
