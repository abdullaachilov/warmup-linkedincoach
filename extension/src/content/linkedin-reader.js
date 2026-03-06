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

const readProfile = () => {
  // Headline - the text right below the name
  const headlineEl = document.querySelector('.text-body-medium.break-words');
  const headline = headlineEl?.textContent?.trim() || '';

  // About section
  const aboutSection = document.querySelector('#about ~ div .inline-show-more-text, #about ~ .display-flex .inline-show-more-text');
  const about = aboutSection?.textContent?.trim()?.substring(0, 1000) || '';

  // Skills
  const skillEls = document.querySelectorAll('.skill-card-skill-pill .hoverable-link-text, [data-field="skill_card_skill_topic"] .hoverable-link-text');
  const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean).slice(0, 10);

  // If skills not found via above selectors, try the top skills section
  let topSkills = skills;
  if (topSkills.length === 0) {
    const topSkillsEl = document.querySelector('.top-skills-text, [class*="top-skills"]');
    if (topSkillsEl) {
      topSkills = topSkillsEl.textContent?.split(/[,\-\.]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 50) || [];
    }
  }

  // Industry - try experience section for company/role info
  const experienceItems = document.querySelectorAll('#experience ~ div .display-flex.align-items-center .hoverable-link-text');
  const experience = Array.from(experienceItems).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean);

  // Location
  const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words');
  const location = locationEl?.textContent?.trim() || '';

  return {
    headline,
    about,
    skills: topSkills,
    experience,
    location,
  };
};

const getPageContext = () => {
  const url = window.location.href;
  if (url.includes('/feed')) return 'feed';
  if (url.includes('/in/')) return 'profile';
  if (url.includes('/posts/')) return 'post';
  if (url.includes('/groups/')) return 'group';
  return 'other';
};

// Auto-detect likes and reactions
(function setupInteractionTracking() {
  // LinkedIn uses these buttons for like/react
  // Like button: button with aria-label containing "Like" or reaction button classes
  // Reactions: when user picks a reaction from the reaction picker

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const ariaPressed = btn.getAttribute('aria-pressed');

    // Main like button - "like" button that toggles
    // When aria-pressed is "false", user is about to like (will become true)
    // LinkedIn like buttons have aria-label like "Like", "React Like", etc.
    if (ariaLabel.includes('like') && !ariaLabel.includes('unlike') && ariaPressed === 'false') {
      chrome.runtime.sendMessage({ type: 'USER_LIKED_POST' }).catch(() => {});
      return;
    }

    // Reaction picker - non-like reactions (celebrate, support, love, insightful, funny)
    // These appear in the reaction bar/menu with specific aria-labels
    const reactionLabels = ['celebrate', 'support', 'love', 'insightful', 'funny', 'curious'];
    if (reactionLabels.some(r => ariaLabel.includes(r))) {
      chrome.runtime.sendMessage({ type: 'USER_REACTED_POST' }).catch(() => {});
      return;
    }
  }, true); // Use capture to catch before LinkedIn's own handlers

  // Also watch for reaction menu clicks (LinkedIn sometimes uses spans/imgs inside buttons)
  document.addEventListener('click', (e) => {
    // Reaction buttons in the popup menu have img elements with alt text
    const img = e.target.closest('img');
    if (!img) return;
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    const reactionAlts = ['celebrate', 'support', 'love', 'insightful', 'funny', 'curious'];
    if (reactionAlts.some(r => alt.includes(r))) {
      chrome.runtime.sendMessage({ type: 'USER_REACTED_POST' }).catch(() => {});
    }
  }, true);
})();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_FEED_CONTEXT') {
    sendResponse({ page: getPageContext(), posts: readFeedPosts() });
  }
  if (msg.type === 'PARSE_PROFILE') {
    const profile = readProfile();
    sendResponse({ page: getPageContext(), profile });
  }
  return true;
});
