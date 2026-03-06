import { api } from './api/client.js';
import { CONTENT_CALENDAR, DAILY_ACTIONS, TIER_LIMITS } from '../shared/constants.js';

// State
let state = {
  view: 'loading', // loading, auth, auth-polling, auth-2fa, onboarding, onboarding-context, dashboard, settings, story-bank, daily-log
  user: null,
  session: null,
  streak: null,
  usage: null,
  error: null,
  aiLoading: false,
  aiResult: null,
  aiResultType: null,
  aiHistory: [],
  goldenWindowStart: null,
  goldenWindowTimer: null,
  tempToken: null,
  oauthSessionId: null,
  pollInterval: null,
  feedContext: null, // { page, posts } from content script
  profileContext: null, // { profile } when on a profile page
  storyBank: [], // story bank entries
  storiesUsed: [], // story IDs used in last AI result
};

// Initialize
async function init() {
  try {
    await api.init();
    if (!api.isLoggedIn()) {
      state.view = 'auth';
      render();
      return;
    }
    const user = await api.getMe();
    state.user = user;

    if (!user.profile?.headline) {
      state.view = 'onboarding';
      render();
      return;
    }

    await loadDashboard();
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      state.view = 'auth';
    } else {
      state.error = err.message;
      state.view = 'auth';
    }
    render();
  }
}

async function readPageContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes('linkedin.com')) {
      state.feedContext = null;
      state.profileContext = null;
      return;
    }

    if (tab.url.includes('/feed')) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_FEED_CONTEXT' });
      state.feedContext = response || null;
      state.profileContext = null;
    } else if (tab.url.includes('/in/')) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'PARSE_PROFILE' });
      state.profileContext = response?.profile || null;
      state.feedContext = null;
    } else {
      state.feedContext = null;
      state.profileContext = null;
    }
  } catch {
    state.feedContext = null;
    state.profileContext = null;
  }
}

async function loadDashboard() {
  try {
    const [session, streak] = await Promise.all([
      api.getToday(),
      api.getStreak(),
    ]);
    state.session = session;
    state.streak = streak;
    state.view = 'dashboard';

    const { goldenWindowStart } = await chrome.storage.local.get('goldenWindowStart');
    state.goldenWindowStart = goldenWindowStart || null;
    if (state.goldenWindowStart) startGoldenWindowTimer();

    const { aiHistory } = await chrome.storage.local.get('aiHistory');
    state.aiHistory = aiHistory || [];

    chrome.runtime.sendMessage({ type: 'UPDATE_STREAK', streak: streak.current_streak }).catch(() => {});

    // Read current page context for personalized tasks
    await readPageContext();

    // Load story bank
    try {
      const sbResult = await api.getStoryBank();
      state.storyBank = sbResult.entries || [];
    } catch { state.storyBank = []; }

    render();
  } catch (err) {
    state.error = err.message;
    render();
  }
}

function startGoldenWindowTimer() {
  if (state.goldenWindowTimer) clearInterval(state.goldenWindowTimer);
  state.goldenWindowTimer = setInterval(() => {
    const el = document.getElementById('golden-timer');
    if (!el || !state.goldenWindowStart) return;
    const elapsed = Date.now() - state.goldenWindowStart;
    const remaining = Math.max(0, 90 * 60000 - elapsed);
    if (remaining <= 0) {
      clearInterval(state.goldenWindowTimer);
      state.goldenWindowStart = null;
      chrome.storage.local.remove('goldenWindowStart');
      render();
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getStreakMessage(streak) {
  if (streak === 7) return 'One week streak! You\'re building a real habit.';
  if (streak === 14) return 'Two weeks strong! Consistency is paying off.';
  if (streak === 30) return '30-day streak! You\'re in the top 5% of users.';
  if (streak === 100) return '100 DAYS! Legendary commitment.';
  return null;
}

// Render
function render() {
  const app = document.getElementById('app');

  switch (state.view) {
    case 'loading':
      app.innerHTML = renderLoading();
      break;
    case 'auth':
      app.innerHTML = renderAuth();
      attachAuthHandlers();
      break;
    case 'auth-polling':
      app.innerHTML = renderAuthPolling();
      break;
    case 'auth-2fa':
      app.innerHTML = render2FA();
      attach2FAHandlers();
      break;
    case 'onboarding':
      app.innerHTML = renderOnboarding();
      attachOnboardingHandlers();
      break;
    case 'onboarding-context':
      app.innerHTML = renderOnboardingContext();
      attachOnboardingContextHandlers();
      break;
    case 'dashboard':
      app.innerHTML = renderDashboard();
      attachDashboardHandlers();
      break;
    case 'settings':
      app.innerHTML = renderSettings();
      attachSettingsHandlers();
      break;
    case 'story-bank':
      app.innerHTML = renderStoryBank();
      attachStoryBankHandlers();
      break;
    case 'daily-log':
      app.innerHTML = renderDailyLog();
      attachDailyLogHandlers();
      break;
    default:
      app.innerHTML = renderLoading();
  }
}

function renderLoading() {
  return `<div style="display:flex;align-items:center;justify-content:center;height:100vh">
    <div style="text-align:center">
      <div style="width:40px;height:40px;border:3px solid #7c3aed;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto"></div>
      <p style="margin-top:12px;color:#9ca3af;font-size:13px">Loading...</p>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  </div>`;
}

function renderAuth() {
  return `<div style="padding:48px 24px 24px;text-align:center">
    <div style="margin-bottom:32px">
      <div style="font-size:32px;font-weight:800;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;background-clip:text;color:transparent">Warmup</div>
      <p style="color:#6b7280;font-size:14px;margin-top:6px">Your Daily LinkedIn Growth Coach</p>
    </div>
    ${state.error ? `<div style="background:#fef2f2;color:#dc2626;font-size:13px;padding:10px 14px;border-radius:10px;margin-bottom:16px;text-align:left">${state.error}</div>` : ''}
    <button id="btn-linkedin-login" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;background:#0A66C2;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;transition:background 0.15s">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      Sign in with LinkedIn
    </button>
    <p style="margin-top:32px;font-size:12px;color:#9ca3af">Zero automation. 100% guided growth.</p>
    <p style="margin-top:8px;font-size:11px;color:#d1d5db">By signing in, you agree to our Terms & Privacy Policy.</p>
  </div>`;
}

function renderAuthPolling() {
  return `<div style="padding:48px 24px 24px;text-align:center">
    <div style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:32px">Warmup</div>
    <div style="width:48px;height:48px;border:3px solid #0A66C2;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto"></div>
    <p style="margin-top:20px;color:#374151;font-size:14px;font-weight:500">Waiting for LinkedIn...</p>
    <p style="margin-top:6px;color:#9ca3af;font-size:12px">Complete sign-in in the opened tab</p>
    <button id="btn-cancel-login" style="margin-top:24px;padding:8px 20px;background:none;border:1px solid #e5e7eb;border-radius:8px;color:#6b7280;font-size:13px;cursor:pointer">Cancel</button>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  </div>`;
}

function render2FA() {
  return `<div style="padding:48px 24px 24px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;background-clip:text;color:transparent">Warmup</div>
      <p style="color:#6b7280;font-size:13px;margin-top:6px">Two-Factor Authentication</p>
    </div>
    ${state.error ? `<div style="background:#fef2f2;color:#dc2626;font-size:13px;padding:10px 14px;border-radius:10px;margin-bottom:16px">${state.error}</div>` : ''}
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px">Enter the 6-digit code from your authenticator app.</p>
    <form id="2fa-form">
      <input type="text" id="2fa-code" placeholder="000000" required maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" style="width:100%;padding:14px;border:2px solid #e5e7eb;border-radius:12px;font-size:24px;text-align:center;letter-spacing:8px;outline:none;box-sizing:border-box;transition:border-color 0.15s" onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e5e7eb'" />
      <button type="submit" style="width:100%;margin-top:12px;padding:14px;background:#7c3aed;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Verify</button>
    </form>
    <button id="btn-back-login" style="display:block;margin:12px auto 0;background:none;border:none;color:#9ca3af;font-size:12px;cursor:pointer">Back to login</button>
  </div>`;
}

function renderOnboarding() {
  const userName = state.user?.name?.split(' ')[0] || '';
  return `<div style="padding:24px">
    <div style="margin-bottom:20px">
      <h2 style="font-size:20px;font-weight:700;margin:0">Welcome${userName ? ', ' + userName : ''}!</h2>
      <p style="color:#6b7280;font-size:13px;margin-top:4px">Tell us about yourself so we can personalize your daily routine.</p>
    </div>

    <button id="btn-parse-profile" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:#0A66C2;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:12px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      Import from LinkedIn Profile
    </button>
    <div id="parse-status" style="display:none;margin-bottom:12px;padding:8px 12px;border-radius:8px;font-size:12px;text-align:center"></div>
    <div style="text-align:center;font-size:11px;color:#d1d5db;margin-bottom:16px">or fill in manually</div>

    <form id="onboarding-form">
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:4px">Your LinkedIn Headline</label>
        <input type="text" id="ob-headline" placeholder="e.g., Senior Product Manager at Acme" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.15s" onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e5e7eb'" />
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:4px">Industry</label>
        <input type="text" id="ob-industry" placeholder="e.g., Technology, Marketing" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.15s" onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e5e7eb'" />
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:4px">Topics you post about</label>
        <input type="text" id="ob-topics" placeholder="e.g., AI, Leadership, Product" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.15s" onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e5e7eb'" />
      </div>
      <button type="submit" style="width:100%;padding:14px;background:#7c3aed;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Start My Routine</button>
    </form>
  </div>`;
}

function getEngageTasks() {
  const posts = state.feedContext?.posts || [];
  const tasks = [];

  // Build personalized comment tasks from feed posts
  for (let i = 0; i < 3; i++) {
    const post = posts[i];
    if (post && post.author && post.author !== 'Unknown') {
      const snippet = post.text ? post.text.substring(0, 50).trim() : '';
      tasks.push({
        id: `comment_${i + 1}`,
        label: `Comment on ${post.author.split('\n')[0].trim()}'s post`,
        sublabel: snippet ? `"${snippet}..."` : null,
        category: 'engage',
      });
    } else {
      tasks.push(DAILY_ACTIONS.engage[i]);
    }
  }

  // Add remaining engage tasks
  tasks.push(...DAILY_ACTIONS.engage.slice(3));
  return tasks;
}

function getConnectTasks() {
  // If on a profile page, personalize the connection request task
  if (state.profileContext?.headline) {
    const name = state.profileContext.headline.split(' ').slice(0, 2).join(' ') || '';
    return DAILY_ACTIONS.connect.map(a => {
      if (a.id === 'send_connections' && name) {
        return { ...a, label: `Send request to ${name} + 2-4 others`, sublabel: state.profileContext.headline };
      }
      return a;
    });
  }
  return DAILY_ACTIONS.connect;
}

function renderContextBanner() {
  const onLinkedIn = state.feedContext || state.profileContext;

  if (!onLinkedIn) {
    return `<div style="margin:10px 14px 0;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;display:flex;align-items:center;gap:10px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#2563eb"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:#1e40af">Open LinkedIn to get started</div>
        <div style="font-size:11px;color:#3b82f6">Go to your feed for personalized tasks</div>
      </div>
      <button id="btn-open-feed" style="padding:6px 12px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">Open Feed</button>
    </div>`;
  }

  const hasPosts = state.feedContext?.posts?.length > 0;
  const pageName = state.feedContext?.page === 'feed' ? 'feed' : state.profileContext ? 'profile' : 'LinkedIn';

  return `<div style="margin:10px 14px 0;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;display:flex;align-items:center;justify-content:space-between">
    <div style="font-size:12px;color:#15803d">
      ${hasPosts ? `Reading ${state.feedContext.posts.length} posts from your feed` : `You're on a ${pageName} page`}
    </div>
    <button id="btn-refresh-context" style="padding:4px 10px;background:#dcfce7;color:#15803d;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-weight:500">Refresh</button>
  </div>`;
}

function renderDashboard() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const calendar = CONTENT_CALENDAR[dayOfWeek];
  const completedActions = state.session?.completed_actions || [];
  const streakCount = state.streak?.current_streak || 0;
  const longestStreak = state.streak?.longest_streak || 0;
  const tierLimit = TIER_LIMITS[state.user?.tier || 'free'];
  const streakMsg = getStreakMessage(streakCount);
  const totalActions = state.session?.total_actions || 10;
  const pct = Math.round((completedActions.length / totalActions) * 100);

  const isConnectDay = [1, 3, 5].includes(dayOfWeek);
  const isGrowDay = [2, 4].includes(dayOfWeek);

  // Progress ring SVG
  const radius = 23;
  const circ = 2 * Math.PI * radius;
  const dashoffset = circ - (pct / 100) * circ;

  const usedCount = state.usage?.used || 0;
  const firstName = state.user?.name?.split(' ')[0] || '';

  // Dynamic tasks based on feed context
  const engageTasks = getEngageTasks();
  const connectTasks = getConnectTasks();

  return `<div style="padding-bottom:16px">
    <!-- Header -->
    <div style="padding:20px 16px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div>
          <div style="font-size:14px;opacity:0.8">${getGreeting()}${firstName ? ', ' + firstName : ''}</div>
          <div style="font-size:11px;opacity:0.6;margin-top:2px">${calendar.emoji} Today: ${calendar.label}</div>
        </div>
        <button id="btn-settings" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:500">Settings</button>
      </div>
      <div style="display:flex;align-items:center;gap:16px">
        <!-- Progress ring -->
        <div class="progress-ring">
          <svg width="56" height="56">
            <circle cx="28" cy="28" r="${radius}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="4"/>
            <circle cx="28" cy="28" r="${radius}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${dashoffset}" style="transition:stroke-dashoffset 0.5s ease"/>
          </svg>
          <div class="count">${completedActions.length}</div>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${completedActions.length} of ${totalActions} tasks done</div>
          <div style="font-size:11px;opacity:0.7;margin-top:2px">${pct === 100 ? 'All done! Great work today.' : pct >= 50 ? 'Keep it up - past halfway!' : 'Let\'s get started!'}</div>
        </div>
        <div style="text-align:center">
          <div class="streak-num">${streakCount > 0 ? streakCount : '-'}</div>
          <div class="streak-label">day streak</div>
          ${longestStreak > streakCount ? `<div style="font-size:10px;opacity:0.5">best: ${longestStreak}</div>` : ''}
        </div>
      </div>
    </div>

    ${streakMsg ? `<div style="margin:10px 14px 0;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:12px;color:#15803d;text-align:center;font-weight:500">${streakMsg}</div>` : ''}

    ${renderContextBanner()}

    ${state.goldenWindowStart ? `
    <div class="golden-bar" style="margin:10px 14px 0;padding:10px 14px;border-radius:10px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:12px;font-weight:600;color:#92400e">Golden Window Active</div>
        <div style="font-size:11px;color:#a16207">Reply to comments now for max reach</div>
      </div>
      <div id="golden-timer" style="font-size:18px;font-weight:700;color:#92400e;font-family:monospace">--:--</div>
    </div>` : ''}

    <!-- Step 1: Engage -->
    <div style="margin:16px 14px 0">
      <div class="section-header">
        <span class="section-badge" style="background:#eff6ff;color:#2563eb">Step 1</span>
        <span style="font-size:13px;font-weight:600;color:#1e293b">Engage</span>
        <span class="section-time">2-3 min</span>
      </div>
      ${engageTasks.map(a => renderTask(a, completedActions)).join('')}
    </div>

    <!-- Step 2: Create -->
    <div style="margin:16px 14px 0">
      <div class="section-header">
        <span class="section-badge" style="background:#faf5ff;color:#7c3aed">Step 2</span>
        <span style="font-size:13px;font-weight:600;color:#1e293b">Create</span>
        <span class="section-time">3-5 min</span>
      </div>
      ${DAILY_ACTIONS.create.map(a => renderTask(a, completedActions)).join('')}
    </div>

    ${isConnectDay ? `
    <!-- Step 3: Connect -->
    <div style="margin:16px 14px 0">
      <div class="section-header">
        <span class="section-badge" style="background:#ecfdf5;color:#059669">Step 3</span>
        <span style="font-size:13px;font-weight:600;color:#1e293b">Connect</span>
        <span class="section-time">1-2 min</span>
      </div>
      ${connectTasks.map(a => renderTask(a, completedActions)).join('')}
    </div>` : ''}

    ${isGrowDay ? `
    <!-- Step 3: Grow -->
    <div style="margin:16px 14px 0">
      <div class="section-header">
        <span class="section-badge" style="background:#fefce8;color:#ca8a04">Step 3</span>
        <span style="font-size:13px;font-weight:600;color:#1e293b">Grow</span>
        <span class="section-time">1 min</span>
      </div>
      ${DAILY_ACTIONS.grow.map(a => renderTask(a, completedActions)).join('')}
    </div>` : ''}

    <!-- AI Tools -->
    <div style="margin:20px 14px 0">
      <div class="section-header">
        <span style="font-size:13px;font-weight:600;color:#1e293b">AI Assistant</span>
        <span class="section-time">${usedCount} / ${tierLimit} used today</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button data-ai="comment" class="ai-btn">
          <div class="ai-icon" style="background:#eff6ff;color:#2563eb">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#1e293b">Comment</div>
            <div style="font-size:11px;color:#9ca3af">${state.feedContext?.posts?.[0] ? 'For ' + state.feedContext.posts[0].author.split('\n')[0].trim() : 'From current post'}</div>
          </div>
        </button>
        <button data-ai="post" class="ai-btn">
          <div class="ai-icon" style="background:#faf5ff;color:#7c3aed">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#1e293b">Draft Post</div>
            <div style="font-size:11px;color:#9ca3af">AI-powered draft</div>
          </div>
        </button>
        <button data-ai="ideas" class="ai-btn">
          <div class="ai-icon" style="background:#fefce8;color:#ca8a04">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2a7 7 0 00-2 13.71V18h4v-2.29A7 7 0 0012 2z"/><path d="M10 21h4"/></svg>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#1e293b">Post Ideas</div>
            <div style="font-size:11px;color:#9ca3af">3 ideas for today</div>
          </div>
        </button>
        <button data-ai="note" class="ai-btn">
          <div class="ai-icon" style="background:#ecfdf5;color:#059669">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#1e293b">Connect Note</div>
            <div style="font-size:11px;color:#9ca3af">${state.profileContext?.headline ? 'For this profile' : 'Personalized message'}</div>
          </div>
        </button>
      </div>
    </div>

    <!-- AI Result -->
    ${state.aiLoading ? `
    <div style="margin:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;padding:16px;background:#faf5ff;border-radius:12px">
        <div style="width:20px;height:20px;border:2px solid #7c3aed;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0"></div>
        <span style="font-size:13px;color:#6b7280">Generating...</span>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>` : ''}

    ${state.aiResult ? `
    <div class="ai-result" style="margin:12px 14px">
      <div style="background:#fff;border:1px solid #e9e5f5;border-radius:12px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#faf5ff;border-bottom:1px solid #e9e5f5">
          <span style="font-size:12px;font-weight:600;color:#7c3aed">${state.aiResultType || 'AI Suggestion'}</span>
          <div style="display:flex;gap:6px">
            <button id="btn-regenerate" style="font-size:11px;padding:4px 10px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;color:#6b7280;cursor:pointer">Retry</button>
            <button id="btn-copy" style="font-size:11px;padding:4px 10px;background:#7c3aed;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:500">Copy</button>
          </div>
        </div>
        <div style="padding:14px;font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap">${state.aiResult}</div>
        <div style="padding:0 14px 10px;font-size:11px;color:#9ca3af">${state.aiResult.length} characters</div>
        ${state.storiesUsed.length > 0 ? `<div style="padding:8px 14px 12px;border-top:1px solid #f3f4f6;font-size:11px;color:#6b7280">Based on ${state.storiesUsed.length} of your stories</div>` : ''}
      </div>
    </div>` : ''}

    ${state.aiHistory.length > 0 ? `
    <div style="margin:8px 14px 16px">
      <button id="btn-toggle-history" style="background:none;border:none;font-size:11px;color:#9ca3af;cursor:pointer;padding:4px 0">Recent suggestions (${state.aiHistory.length})</button>
      <div id="ai-history" style="display:none;margin-top:8px">
        ${state.aiHistory.map((h, i) => `
          <div data-history="${i}" style="padding:10px 12px;background:#fff;border:1px solid #f3f4f6;border-radius:8px;margin-bottom:4px;cursor:pointer;transition:border-color 0.15s" onmouseover="this.style.borderColor='#e9e5f5'" onmouseout="this.style.borderColor='#f3f4f6'">
            <div style="font-size:11px;font-weight:600;color:#9ca3af">${h.type}</div>
            <div style="font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.text.substring(0, 80)}...</div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

function renderTask(action, completedActions) {
  const done = completedActions.includes(action.id);
  return `<div class="task-row ${done ? 'completed' : ''}" data-action="${action.id}">
    <div class="task-check ${done ? 'done' : ''}">
      <svg width="12" height="12" viewBox="0 0 20 20" fill="#fff"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
    </div>
    <div style="flex:1;min-width:0">
      <div class="task-label" style="font-size:13px;color:${done ? '#9ca3af' : '#374151'}">${action.label}</div>
      ${action.sublabel ? `<div style="font-size:11px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px">${action.sublabel}</div>` : ''}
    </div>
  </div>`;
}

function renderSettings() {
  const user = state.user || {};
  const profile = user.profile || {};

  return `<div style="padding-bottom:16px">
    <div style="padding:20px 16px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:18px;font-weight:700">Settings</span>
        <button id="btn-back" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:500">Back</button>
      </div>
    </div>

    <!-- Profile -->
    <div style="margin:16px 14px 0">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Profile</div>
      <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #f3f4f6">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          ${user.picture_url ? `<img src="${user.picture_url}" style="width:44px;height:44px;border-radius:50%;object-fit:cover" />` : `<div style="width:44px;height:44px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:18px;color:#9ca3af">${(user.name || '?')[0]}</div>`}
          <div>
            <div style="font-size:14px;font-weight:600;color:#1e293b">${user.name || '-'}</div>
            <div style="font-size:12px;color:#9ca3af">${user.email || '-'}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#6b7280;line-height:1.8">
          <div><span style="color:#9ca3af">Headline:</span> ${profile.headline || '-'}</div>
          <div><span style="color:#9ca3af">Industry:</span> ${profile.industry || '-'}</div>
          <div><span style="color:#9ca3af">Topics:</span> ${profile.topics?.join(', ') || '-'}</div>
        </div>
        <button id="btn-edit-profile" style="margin-top:10px;background:none;border:none;font-size:12px;color:#7c3aed;cursor:pointer;padding:0;font-weight:500">Edit profile</button>
      </div>
    </div>

    <!-- Story Bank -->
    <div style="margin:16px 14px 0">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Story Bank</div>
      <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #f3f4f6">
        <p style="font-size:12px;color:#6b7280;margin:0 0 8px">Your real stories make AI posts sound like you.</p>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;color:#1e293b">${state.storyBank.length} stories saved</span>
          <button id="btn-open-story-bank" style="padding:6px 14px;background:#faf5ff;color:#7c3aed;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500">Manage Stories</button>
        </div>
      </div>
    </div>

    <!-- Voice & Context -->
    <div style="margin:16px 14px 0">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Voice & Context</div>
      <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #f3f4f6;font-size:12px;color:#6b7280;line-height:1.8">
        <div><span style="color:#9ca3af">Work:</span> ${profile.work_situation || '-'}</div>
        <div><span style="color:#9ca3af">Goals:</span> ${profile.current_goals || '-'}</div>
        <div><span style="color:#9ca3af">Hot takes:</span> ${profile.hot_takes || '-'}</div>
        <div><span style="color:#9ca3af">Style:</span> ${profile.communication_style || '-'}</div>
        <button id="btn-edit-context" style="margin-top:8px;background:none;border:none;font-size:12px;color:#7c3aed;cursor:pointer;padding:0;font-weight:500">Edit voice settings</button>
      </div>
    </div>

    <!-- Billing -->
    <div style="margin:16px 14px 0">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Plan</div>
      <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #f3f4f6">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:14px;font-weight:600;color:#1e293b;text-transform:capitalize">${user.tier || 'free'}</span>
          <span style="font-size:12px;color:#7c3aed;font-weight:500">${TIER_LIMITS[user.tier || 'free']} AI / day</span>
        </div>
        <button id="btn-billing-portal" style="background:none;border:none;font-size:12px;color:#7c3aed;cursor:pointer;padding:0;font-weight:500">Manage billing</button>
      </div>
    </div>

    <!-- BYOK -->
    <div style="margin:16px 14px 0">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Bring Your Own Key</div>
      <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #f3f4f6">
        <p style="font-size:12px;color:#6b7280;margin:0 0 10px">Use your Anthropic API key for unlimited AI suggestions. Sent per-request, never stored on our servers.</p>
        <input type="password" id="byok-key" placeholder="sk-ant-..." style="width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;margin-bottom:8px" />
        <div style="display:flex;gap:8px">
          <button id="btn-save-byok" style="padding:6px 14px;background:#7c3aed;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500">Save</button>
          <button id="btn-clear-byok" style="padding:6px 14px;background:#f3f4f6;color:#6b7280;border:none;border-radius:6px;font-size:12px;cursor:pointer">Clear</button>
        </div>
      </div>
    </div>

    <!-- Security -->
    <div style="margin:16px 14px 0">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Security</div>
      <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #f3f4f6">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;color:#1e293b">Two-Factor Auth</div>
            <div style="font-size:12px;color:${user.totp_enabled ? '#059669' : '#9ca3af'}">${user.totp_enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
          <button id="btn-2fa-toggle" style="padding:6px 14px;background:${user.totp_enabled ? '#fef2f2' : '#faf5ff'};color:${user.totp_enabled ? '#dc2626' : '#7c3aed'};border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500">${user.totp_enabled ? 'Disable' : 'Enable'}</button>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div style="margin:16px 14px 0">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Stats</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #f3f4f6;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#7c3aed">${state.streak?.current_streak || 0}</div>
          <div style="font-size:11px;color:#9ca3af">Current streak</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #f3f4f6;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#7c3aed">${state.streak?.longest_streak || 0}</div>
          <div style="font-size:11px;color:#9ca3af">Longest streak</div>
        </div>
      </div>
    </div>

    <!-- Logout -->
    <div style="margin:20px 14px 16px">
      <button id="btn-logout" style="width:100%;padding:12px;background:#fef2f2;color:#dc2626;border:none;border-radius:12px;font-size:14px;font-weight:500;cursor:pointer">Log Out</button>
    </div>
  </div>`;
}

const STORY_ICONS = { win: '&#x1F3C6;', lesson: '&#x1F4A1;', opinion: '&#x1F525;', project: '&#x1F680;', milestone: '&#x1F4CD;', daily_log: '&#x1F4DD;' };

function renderOnboardingContext() {
  const profile = state.user?.profile || {};
  return `<div style="padding:24px">
    <h2 style="font-size:18px;font-weight:700;margin:0 0 4px">Make posts sound like YOU</h2>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px">This helps AI write in your voice, not generic LinkedIn-speak. All optional.</p>

    <form id="context-form">
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:4px">What do you actually do day-to-day?</label>
        <textarea id="ctx-work" rows="2" placeholder='e.g. "Solo contractor, code reviews, backend architecture for B2B SaaS clients"' style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;font-family:inherit">${profile.work_situation || ''}</textarea>
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:4px">What are you working toward right now?</label>
        <textarea id="ctx-goals" rows="2" placeholder='e.g. "Transitioning to US remote roles, shipping indie products"' style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;font-family:inherit">${profile.current_goals || ''}</textarea>
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:4px">A hot take about your industry?</label>
        <textarea id="ctx-takes" rows="2" placeholder='e.g. "Most developers are underusing AI tools and will regret it in 2 years"' style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;font-family:inherit">${profile.hot_takes || ''}</textarea>
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:4px">How do you like to communicate?</label>
        <textarea id="ctx-style" rows="2" placeholder='e.g. "Direct, technical, dry humor, no corporate fluff"' style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;font-family:inherit">${profile.communication_style || ''}</textarea>
      </div>
      <button type="submit" style="width:100%;padding:14px;background:#7c3aed;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Save & Start</button>
    </form>
    <button id="btn-skip-context" style="display:block;margin:12px auto 0;background:none;border:none;color:#9ca3af;font-size:13px;cursor:pointer">Skip for now</button>
    <p style="text-align:center;font-size:11px;color:#d1d5db;margin-top:12px">You can always update this in Settings</p>
  </div>`;
}

function attachOnboardingContextHandlers() {
  document.getElementById('context-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.updateProfile({
        work_situation: document.getElementById('ctx-work')?.value || undefined,
        current_goals: document.getElementById('ctx-goals')?.value || undefined,
        hot_takes: document.getElementById('ctx-takes')?.value || undefined,
        communication_style: document.getElementById('ctx-style')?.value || undefined,
      });
      state.user = await api.getMe();
      await loadDashboard();
    } catch (err) {
      state.error = err.message;
      render();
    }
  });

  document.getElementById('btn-skip-context')?.addEventListener('click', async () => {
    // If user already has a profile, go back to settings instead of dashboard
    if (state.user?.profile?.headline) {
      state.view = 'settings';
      render();
    } else {
      await loadDashboard();
    }
  });
}

function renderStoryBank() {
  const entries = state.storyBank || [];

  return `<div style="padding-bottom:16px">
    <div style="padding:20px 16px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:18px;font-weight:700">Story Bank</span>
        <div style="display:flex;gap:8px">
          <button id="btn-add-story" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:500">+ Add</button>
          <button id="btn-sb-back" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:500">Back</button>
        </div>
      </div>
      <p style="font-size:12px;opacity:0.7;margin-top:6px">Your stories make your posts authentic. ${entries.length} stories saved.</p>
    </div>

    <div id="story-add-panel" style="display:none;margin:12px 14px 0">
      <div style="background:#fff;border:1px solid #e9e5f5;border-radius:12px;padding:14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:#1e293b">Add a Story</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${['win', 'lesson', 'opinion', 'project', 'milestone', 'daily_log'].map(t =>
            `<button data-stype="${t}" class="stype-btn" style="padding:4px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;cursor:pointer;background:#fff;color:#374151">${STORY_ICONS[t]} ${t.replace('_', ' ')}</button>`
          ).join('')}
        </div>
        <textarea id="story-content" rows="3" maxlength="1000" placeholder="1-3 sentences. Be specific - numbers, tools, timelines make better posts." style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;font-family:inherit;margin-bottom:8px"></textarea>
        <input id="story-tags" type="text" placeholder="Tags: ai, career, typescript (comma separated)" style="width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;margin-bottom:10px" />
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="btn-cancel-story" style="padding:6px 14px;background:#f3f4f6;color:#6b7280;border:none;border-radius:6px;font-size:12px;cursor:pointer">Cancel</button>
          <button id="btn-save-story" style="padding:6px 14px;background:#7c3aed;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500">Save</button>
        </div>
      </div>
    </div>

    <div style="margin:12px 14px 0">
      ${entries.length === 0 ? `
        <div style="text-align:center;padding:32px 16px;color:#9ca3af">
          <div style="font-size:14px;margin-bottom:4px">No stories yet</div>
          <div style="font-size:12px">Add your wins, lessons, and opinions to make AI posts personal.</div>
        </div>
      ` : entries.map(e => `
        <div style="background:#fff;border:1px solid #f3f4f6;border-radius:10px;padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7c3aed">${STORY_ICONS[e.entry_type] || ''} ${e.entry_type.replace('_', ' ')}</span>
            <div style="display:flex;gap:6px">
              <button data-del-story="${e.id}" style="background:none;border:none;font-size:16px;color:#9ca3af;cursor:pointer;padding:0;line-height:1" title="Remove">x</button>
            </div>
          </div>
          <div style="font-size:13px;color:#374151;line-height:1.5">${e.content}</div>
          ${e.tags?.length > 0 ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${e.tags.map(t => `<span style="font-size:10px;padding:2px 6px;background:#f3f4f6;border-radius:4px;color:#6b7280">${t}</span>`).join('')}</div>` : ''}
          <div style="margin-top:6px;font-size:10px;color:#d1d5db">Used in ${e.used_count || 0} posts</div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

function attachStoryBankHandlers() {
  let selectedType = 'win';

  document.getElementById('btn-sb-back')?.addEventListener('click', () => {
    state.view = 'settings';
    render();
  });

  document.getElementById('btn-add-story')?.addEventListener('click', () => {
    const panel = document.getElementById('story-add-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-cancel-story')?.addEventListener('click', () => {
    const panel = document.getElementById('story-add-panel');
    if (panel) panel.style.display = 'none';
  });

  document.querySelectorAll('.stype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.stype;
      document.querySelectorAll('.stype-btn').forEach(b => {
        b.style.background = b.dataset.stype === selectedType ? '#7c3aed' : '#fff';
        b.style.color = b.dataset.stype === selectedType ? '#fff' : '#374151';
        b.style.borderColor = b.dataset.stype === selectedType ? '#7c3aed' : '#e5e7eb';
      });
    });
  });

  document.getElementById('btn-save-story')?.addEventListener('click', async () => {
    const content = document.getElementById('story-content')?.value?.trim();
    const tagsStr = document.getElementById('story-tags')?.value || '';
    const tags = tagsStr.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    if (!content) { alert('Please enter your story.'); return; }

    try {
      await api.addStory(selectedType, content, tags);
      const result = await api.getStoryBank();
      state.storyBank = result.entries;
      render();
      attachStoryBankHandlers();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  });

  document.querySelectorAll('[data-del-story]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delStory;
      try {
        await api.deleteStory(id);
        state.storyBank = state.storyBank.filter(e => String(e.id) !== String(id));
        render();
        attachStoryBankHandlers();
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
    });
  });
}

function renderDailyLog() {
  const streakCount = state.streak?.current_streak || 0;
  return `<div style="padding:24px;text-align:center">
    <div style="font-size:48px;margin-bottom:8px">&#x2705;</div>
    <h2 style="font-size:18px;font-weight:700;margin:0 0 4px">Session complete!</h2>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px">Streak: ${streakCount} day${streakCount !== 1 ? 's' : ''}</p>

    <div style="text-align:left">
      <p style="font-size:13px;color:#374151;margin:0 0 8px;font-weight:500">Anything interesting happen today you might post about?</p>
      <textarea id="daily-log-text" rows="3" placeholder='e.g. "Fixed a gnarly race condition" or "Got 3x impressions by posting at 9am"' style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;resize:vertical;font-family:inherit"></textarea>
    </div>

    <div style="display:flex;gap:8px;margin-top:16px">
      <button id="btn-skip-log" style="flex:1;padding:12px;background:#f3f4f6;color:#6b7280;border:none;border-radius:10px;font-size:14px;cursor:pointer">Skip</button>
      <button id="btn-save-log" style="flex:1;padding:12px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Save to Stories</button>
    </div>
  </div>`;
}

function attachDailyLogHandlers() {
  document.getElementById('btn-skip-log')?.addEventListener('click', () => {
    state.view = 'dashboard';
    render();
  });

  document.getElementById('btn-save-log')?.addEventListener('click', async () => {
    const text = document.getElementById('daily-log-text')?.value?.trim();
    if (!text) { state.view = 'dashboard'; render(); return; }
    try {
      await api.addStory('daily_log', text, []);
      const result = await api.getStoryBank();
      state.storyBank = result.entries;
    } catch (err) {
      console.error('Failed to save daily log:', err);
    }
    state.view = 'dashboard';
    render();
  });
}

function saveToHistory(type, text) {
  state.aiHistory.unshift({ type, text, timestamp: Date.now() });
  if (state.aiHistory.length > 5) state.aiHistory.pop();
  chrome.storage.local.set({ aiHistory: state.aiHistory });
}

let lastAICall = null;

// Event handlers

function attachAuthHandlers() {
  document.getElementById('btn-linkedin-login')?.addEventListener('click', async () => {
    state.error = null;
    try {
      const sessionId = await api.startLinkedInLogin();
      state.oauthSessionId = sessionId;
      state.view = 'auth-polling';
      render();
      startOAuthPolling(sessionId);
    } catch (err) {
      state.error = err.message;
      render();
    }
  });
}

function startOAuthPolling(sessionId) {
  if (state.pollInterval) clearInterval(state.pollInterval);

  let attempts = 0;
  state.pollInterval = setInterval(async () => {
    attempts++;
    if (attempts > 120) {
      clearInterval(state.pollInterval);
      state.pollInterval = null;
      state.error = 'Login timed out. Try again.';
      state.view = 'auth';
      render();
      return;
    }

    try {
      const result = await api.pollLinkedInLogin(sessionId);
      if (!result) return;

      clearInterval(state.pollInterval);
      state.pollInterval = null;

      if (result.requires2FA) {
        state.tempToken = result.tempToken;
        state.view = 'auth-2fa';
        render();
        return;
      }

      await api.completeLogin(result);
      const user = await api.getMe();
      state.user = user;

      if (!user.profile?.headline) {
        state.view = 'onboarding';
        render();
      } else {
        await loadDashboard();
      }
    } catch (err) {
      console.warn('Poll error:', err.message);
    }
  }, 1000);

  setTimeout(() => {
    document.getElementById('btn-cancel-login')?.addEventListener('click', () => {
      if (state.pollInterval) clearInterval(state.pollInterval);
      state.pollInterval = null;
      state.view = 'auth';
      state.error = null;
      render();
    });
  }, 50);
}

function attach2FAHandlers() {
  document.getElementById('2fa-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('2fa-code').value;
    state.error = null;

    try {
      await api.validate2FA(state.tempToken, code);
      state.tempToken = null;
      const user = await api.getMe();
      state.user = user;
      if (!user.profile?.headline) {
        state.view = 'onboarding';
      } else {
        await loadDashboard();
        return;
      }
    } catch (err) {
      state.error = err.message;
    }
    render();
  });

  document.getElementById('btn-back-login')?.addEventListener('click', () => {
    state.view = 'auth';
    state.tempToken = null;
    state.error = null;
    render();
  });
}

function attachOnboardingHandlers() {
  document.getElementById('btn-parse-profile')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('parse-status');
    const btn = document.getElementById('btn-parse-profile');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.includes('linkedin.com/in/')) {
        statusEl.style.display = 'block';
        statusEl.style.background = '#fffbeb';
        statusEl.style.color = '#92400e';
        statusEl.textContent = 'Go to your LinkedIn profile page first, then click this button.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Parsing...';

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'PARSE_PROFILE' });
      const profile = response?.profile;

      if (!profile || !profile.headline) {
        statusEl.style.display = 'block';
        statusEl.style.background = '#fffbeb';
        statusEl.style.color = '#92400e';
        statusEl.textContent = 'Could not read profile. Make sure the page is fully loaded.';
        btn.disabled = false;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> Import from LinkedIn Profile';
        return;
      }

      const headlineInput = document.getElementById('ob-headline');
      const industryInput = document.getElementById('ob-industry');
      const topicsInput = document.getElementById('ob-topics');

      if (headlineInput && profile.headline) headlineInput.value = profile.headline;

      if (industryInput) {
        const text = (profile.headline + ' ' + profile.experience.join(' ') + ' ' + profile.about).toLowerCase();
        const industries = ['Technology', 'Software', 'Finance', 'Marketing', 'Healthcare', 'Education', 'Consulting', 'Design', 'Sales', 'Engineering', 'Product', 'Data', 'AI', 'Crypto', 'Real Estate', 'Media', 'Legal', 'HR'];
        const matched = industries.filter(i => text.includes(i.toLowerCase()));
        industryInput.value = matched.length > 0 ? matched.slice(0, 2).join(', ') : '';
      }

      if (topicsInput && profile.skills.length > 0) {
        topicsInput.value = profile.skills.slice(0, 5).join(', ');
      }

      statusEl.style.display = 'block';
      statusEl.style.background = '#f0fdf4';
      statusEl.style.color = '#15803d';
      statusEl.textContent = 'Profile imported! Review and click Start.';
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> Import from LinkedIn Profile';
    } catch (err) {
      statusEl.style.display = 'block';
      statusEl.style.background = '#fef2f2';
      statusEl.style.color = '#dc2626';
      statusEl.textContent = 'Failed to parse. Make sure you\'re on your LinkedIn profile page.';
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> Import from LinkedIn Profile';
    }
  });

  document.getElementById('onboarding-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const headline = document.getElementById('ob-headline').value;
    const industry = document.getElementById('ob-industry').value;
    const topics = document.getElementById('ob-topics').value.split(',').map(t => t.trim()).filter(Boolean);

    try {
      await api.updateProfile({ headline, industry, topics });
      state.user = await api.getMe();
      // Go to personal context step
      state.view = 'onboarding-context';
      render();
    } catch (err) {
      state.error = err.message;
      render();
    }
  });
}

function attachDashboardHandlers() {
  if (state.goldenWindowStart) startGoldenWindowTimer();

  // Context banner buttons
  document.getElementById('btn-open-feed')?.addEventListener('click', async () => {
    await chrome.tabs.create({ url: 'https://www.linkedin.com/feed/' });
    // Re-read context after a short delay for the tab to load
    setTimeout(async () => {
      await readPageContext();
      render();
    }, 2000);
  });

  document.getElementById('btn-refresh-context')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-context');
    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    await readPageContext();
    render();
  });

  document.querySelectorAll('[data-action]').forEach(card => {
    card.addEventListener('click', async () => {
      const actionId = card.dataset.action;
      const current = state.session?.completed_actions || [];
      const wasCompleted = current.includes(actionId);
      const updated = wasCompleted
        ? current.filter(a => a !== actionId)
        : [...current, actionId];

      state.session.completed_actions = updated;

      if (!wasCompleted && actionId === 'publish_post' && !state.goldenWindowStart) {
        state.goldenWindowStart = Date.now();
        chrome.runtime.sendMessage({ type: 'START_GOLDEN_WINDOW' }).catch(() => {});
      }

      // Show daily log prompt when all tasks completed
      const totalActions = state.session?.total_actions || 10;
      if (!wasCompleted && updated.length >= totalActions) {
        const { dailyLogShown } = await chrome.storage.local.get('dailyLogShown');
        const todayStr = new Date().toISOString().split('T')[0];
        if (dailyLogShown !== todayStr) {
          await chrome.storage.local.set({ dailyLogShown: todayStr });
          state.view = 'daily-log';
          render();
          return;
        }
      }

      render();

      chrome.storage.local.set({ pendingSession: { completed_actions: updated } });

      try {
        await api.updateToday({ completed_actions: updated });
        chrome.storage.local.remove('pendingSession');
      } catch (err) {
        console.error('Failed to save action:', err);
      }
    });
  });

  document.querySelectorAll('[data-ai]').forEach(btn => {
    btn.addEventListener('click', () => handleAITool(btn.dataset.ai));
  });

  document.getElementById('btn-regenerate')?.addEventListener('click', () => {
    if (lastAICall) handleAITool(lastAICall.type, lastAICall.params);
  });

  document.getElementById('btn-copy')?.addEventListener('click', async () => {
    if (state.aiResult) {
      await navigator.clipboard.writeText(state.aiResult);
      const btn = document.getElementById('btn-copy');
      btn.textContent = 'Copied!';
      btn.style.background = '#059669';
      setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = '#7c3aed'; }, 1500);
    }
  });

  document.getElementById('btn-toggle-history')?.addEventListener('click', () => {
    const el = document.getElementById('ai-history');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  });

  document.querySelectorAll('[data-history]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.history);
      const item = state.aiHistory[idx];
      if (item) {
        state.aiResult = item.text;
        state.aiResultType = item.type;
        render();
      }
    });
  });

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    state.view = 'settings';
    render();
  });
}

async function handleAITool(type, params) {
  state.aiLoading = true;
  state.aiResult = null;
  render();

  try {
    let result;
    switch (type) {
      case 'comment': {
        let postText = params?.postText || 'A recent LinkedIn post about industry trends';
        let authorName = params?.authorName || 'A professional';
        if (!params) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
              const context = await chrome.tabs.sendMessage(tab.id, { type: 'GET_FEED_CONTEXT' });
              if (context?.posts?.[0]) {
                postText = context.posts[0].text;
                authorName = context.posts[0].author;
              }
            }
          } catch {}
        }
        lastAICall = { type: 'comment', params: { postText, authorName } };
        result = await api.suggestComment(postText, authorName);
        state.aiResult = result.suggestion;
        state.aiResultType = 'Comment Suggestion';
        state.usage = result.usage;
        state.storiesUsed = result.stories_used || [];
        saveToHistory('Comment', result.suggestion);
        break;
      }
      case 'post': {
        const idea = params?.idea || prompt('Describe your post idea:');
        if (!idea) { state.aiLoading = false; render(); return; }
        lastAICall = { type: 'post', params: { idea } };
        result = await api.draftPost(idea);
        state.aiResult = result.draft;
        state.aiResultType = 'Post Draft';
        state.usage = result.usage;
        state.storiesUsed = result.stories_used || [];
        saveToHistory('Post Draft', result.draft);
        break;
      }
      case 'ideas': {
        lastAICall = { type: 'ideas', params: {} };
        result = await api.getPostIdeas();
        const ideas = result.ideas;
        const formatted = Array.isArray(ideas)
          ? ideas.map((i, idx) => `${idx + 1}. [${i.type}] ${i.idea}\n   Hook: "${i.hook_preview}"`).join('\n\n')
          : JSON.stringify(ideas);
        state.aiResult = formatted;
        state.aiResultType = 'Post Ideas';
        state.usage = result.usage;
        state.storiesUsed = result.stories_used || [];
        saveToHistory('Post Ideas', formatted);
        break;
      }
      case 'note': {
        let name = params?.name;
        let headline = params?.headline;
        // Auto-fill from profile context if on a profile page
        if (!name && state.profileContext?.headline) {
          // Parse name from headline (first line is usually the name area)
          name = prompt('Their name:', '');
          headline = state.profileContext.headline;
        }
        if (!name) name = prompt('Their name:');
        if (!headline) headline = prompt('Their headline:');
        if (!name || !headline) { state.aiLoading = false; render(); return; }
        lastAICall = { type: 'note', params: { name, headline } };
        result = await api.generateConnectionNote(name, headline);
        state.aiResult = result.note;
        state.aiResultType = 'Connection Note';
        state.usage = result.usage;
        state.storiesUsed = result.stories_used || [];
        saveToHistory('Connection Note', result.note);
        break;
      }
    }
  } catch (err) {
    state.aiResult = `Error: ${err.message}`;
    state.aiResultType = 'Error';
  }

  state.aiLoading = false;
  render();
}

function attachSettingsHandlers() {
  document.getElementById('btn-back')?.addEventListener('click', async () => {
    await loadDashboard();
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await api.logout();
    state = { view: 'auth', user: null, session: null, streak: null, usage: null, error: null, aiLoading: false, aiResult: null, aiResultType: null, aiHistory: [], goldenWindowStart: null, goldenWindowTimer: null, tempToken: null, oauthSessionId: null, pollInterval: null, feedContext: null, profileContext: null, storyBank: [], storiesUsed: [] };
    render();
  });

  document.getElementById('btn-edit-profile')?.addEventListener('click', () => {
    state.view = 'onboarding';
    render();
  });

  document.getElementById('btn-open-story-bank')?.addEventListener('click', () => {
    state.view = 'story-bank';
    render();
  });

  document.getElementById('btn-edit-context')?.addEventListener('click', () => {
    state.view = 'onboarding-context';
    render();
  });

  document.getElementById('btn-billing-portal')?.addEventListener('click', async () => {
    try {
      const result = await api.billingPortal();
      if (result?.url) chrome.tabs.create({ url: result.url });
    } catch (err) {
      alert('Failed to open billing: ' + err.message);
    }
  });

  (async () => {
    const { byokKey } = await chrome.storage.local.get('byokKey');
    if (byokKey) {
      const input = document.getElementById('byok-key');
      if (input) input.value = byokKey.substring(0, 10) + '...';
    }
  })();

  document.getElementById('btn-save-byok')?.addEventListener('click', async () => {
    const key = document.getElementById('byok-key')?.value;
    if (!key || !key.startsWith('sk-ant-')) {
      alert('Invalid key format. Must start with sk-ant-');
      return;
    }
    await chrome.storage.local.set({ byokKey: key });
    alert('Key saved locally. It will be sent per-request.');
  });

  document.getElementById('btn-clear-byok')?.addEventListener('click', async () => {
    await chrome.storage.local.remove('byokKey');
    const input = document.getElementById('byok-key');
    if (input) input.value = '';
    alert('Key cleared.');
  });

  document.getElementById('btn-2fa-toggle')?.addEventListener('click', async () => {
    if (state.user?.totp_enabled) {
      const code = prompt('Enter your 2FA code to disable:');
      if (!code) return;
      try {
        await api.disable2FA(code);
        state.user.totp_enabled = false;
        render();
        attachSettingsHandlers();
      } catch (err) {
        alert('Failed: ' + err.message);
      }
    } else {
      try {
        const result = await api.setup2FA();
        const panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px';
        panel.innerHTML = `
          <div style="background:#fff;border-radius:16px;padding:20px;max-width:300px;width:100%;text-align:center">
            <h3 style="font-size:16px;font-weight:700;margin:0 0 8px">Scan QR Code</h3>
            <p style="font-size:12px;color:#6b7280;margin:0 0 14px">Scan with your authenticator app</p>
            <img src="${result.qrDataUrl}" style="margin:0 auto 14px;display:block" width="200" />
            <input type="text" id="verify-2fa-code" placeholder="Enter 6-digit code" maxlength="6" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:10px;font-size:16px;text-align:center;outline:none;box-sizing:border-box;margin-bottom:10px" />
            <button id="btn-verify-2fa" style="width:100%;padding:12px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Verify & Enable</button>
            <button id="btn-cancel-2fa" style="display:block;margin:8px auto 0;background:none;border:none;color:#9ca3af;font-size:12px;cursor:pointer">Cancel</button>
          </div>`;
        document.body.appendChild(panel);

        document.getElementById('btn-verify-2fa').addEventListener('click', async () => {
          const code = document.getElementById('verify-2fa-code').value;
          try {
            await api.verify2FA(code);
            state.user.totp_enabled = true;
            panel.remove();
            render();
            attachSettingsHandlers();
          } catch (err) {
            alert('Invalid code: ' + err.message);
          }
        });

        document.getElementById('btn-cancel-2fa').addEventListener('click', () => panel.remove());
      } catch (err) {
        alert('Failed to setup 2FA: ' + err.message);
      }
    }
  });
}

// Persist state on unload
window.addEventListener('beforeunload', () => {
  if (state.pollInterval) clearInterval(state.pollInterval);
  if (state.session?.completed_actions) {
    chrome.storage.local.set({ pendingSession: { completed_actions: state.session.completed_actions } });
  }
});

async function restorePendingState() {
  const { pendingSession } = await chrome.storage.local.get('pendingSession');
  if (pendingSession && api.isLoggedIn()) {
    try {
      await api.updateToday(pendingSession);
      await chrome.storage.local.remove('pendingSession');
    } catch {}
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'DAILY_RESET') {
    loadDashboard();
  }
});

restorePendingState().then(init);
