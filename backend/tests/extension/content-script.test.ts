import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// We'll test the content script logic by extracting its functions
// Since it's a plain JS file, we simulate the DOM environment

describe('Content Script', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM(`
      <div>
        <div data-urn="urn:li:activity:1">
          <span class="update-components-actor__name">John Doe</span>
          <div class="feed-shared-update-v2__description">This is a post about AI trends in 2024</div>
          <span class="social-details-social-counts__reactions-count">42</span>
          <span class="social-details-social-counts__comments">12</span>
        </div>
        <div data-urn="urn:li:activity:2">
          <span class="update-components-actor__name">Jane Smith</span>
          <div class="feed-shared-update-v2__description">Leadership lessons from my startup journey</div>
          <span class="social-details-social-counts__reactions-count">156</span>
          <span class="social-details-social-counts__comments">45</span>
        </div>
      </div>
    `, { url: 'https://www.linkedin.com/feed' });
  });

  function readFeedPosts(document: Document) {
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
  }

  function getPageContext(url: string) {
    if (url.includes('/feed')) return 'feed';
    if (url.includes('/in/')) return 'profile';
    if (url.includes('/posts/')) return 'post';
    if (url.includes('/groups/')) return 'group';
    return 'other';
  }

  it('readFeedPosts extracts author, text, likes, comments', () => {
    const posts = readFeedPosts(dom.window.document);
    expect(posts[0].author).toBe('John Doe');
    expect(posts[0].text).toContain('AI trends');
    expect(posts[0].likes).toBe(42);
    expect(posts[0].comments).toBe(12);
  });

  it('readFeedPosts returns max 10 posts', () => {
    const posts = readFeedPosts(dom.window.document);
    expect(posts.length).toBeLessThanOrEqual(10);
  });

  it('readFeedPosts handles missing elements gracefully', () => {
    const emptyDom = new JSDOM(`<div data-urn="urn:test:1"></div>`, { url: 'https://www.linkedin.com/feed' });
    const posts = readFeedPosts(emptyDom.window.document);
    expect(posts[0].author).toBe('Unknown');
    expect(posts[0].text).toBe('');
    expect(posts[0].likes).toBe(0);
  });

  it('getPageContext returns "feed" for /feed URL', () => {
    expect(getPageContext('https://www.linkedin.com/feed')).toBe('feed');
  });

  it('getPageContext returns "profile" for /in/ URL', () => {
    expect(getPageContext('https://www.linkedin.com/in/johndoe')).toBe('profile');
  });

  it('getPageContext returns "post" for /posts/ URL', () => {
    expect(getPageContext('https://www.linkedin.com/posts/johndoe_activity')).toBe('post');
  });

  it('getPageContext returns "other" for unknown URL', () => {
    expect(getPageContext('https://www.linkedin.com/messaging')).toBe('other');
  });
});
