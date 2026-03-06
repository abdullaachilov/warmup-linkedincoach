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
