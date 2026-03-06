import { api } from './api/client.js';
import { CONTENT_CALENDAR, DAILY_ACTIONS, TIER_LIMITS } from '../shared/constants.js';

// State
let state = {
  view: 'loading', // loading, auth, auth-polling, auth-2fa, onboarding, dashboard, settings
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
    case 'dashboard':
      app.innerHTML = renderDashboard();
      attachDashboardHandlers();
      break;
    case 'settings':
      app.innerHTML = renderSettings();
      attachSettingsHandlers();
      break;
    default:
      app.innerHTML = renderLoading();
  }
}

function renderLoading() {
  return `<div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <div class="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="mt-3 text-gray-500 text-sm">Loading Warmup...</p>
    </div>
  </div>`;
}

function renderAuth() {
  return `<div class="p-6">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold" style="background-clip: text; -webkit-background-clip: text; color: transparent; background-image: linear-gradient(135deg, #667eea, #764ba2);">Warmup</h1>
      <p class="text-gray-500 text-sm mt-1">Your Daily LinkedIn Growth Coach</p>
    </div>
    ${state.error ? `<div class="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">${state.error}</div>` : ''}
    <button id="btn-linkedin-login" class="w-full flex items-center justify-center gap-3 py-3 bg-[#0A66C2] text-white rounded-lg text-sm font-medium hover:bg-[#004182] transition">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      Sign in with LinkedIn
    </button>
    <p class="text-center text-xs text-gray-400 mt-6">Zero automation. 100% guided growth.</p>
    <p class="text-center text-xs text-gray-300 mt-2">By signing in, you agree to our Terms & Privacy Policy.</p>
  </div>`;
}

function renderAuthPolling() {
  return `<div class="p-6">
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold" style="background-clip: text; -webkit-background-clip: text; color: transparent; background-image: linear-gradient(135deg, #667eea, #764ba2);">Warmup</h1>
    </div>
    <div class="text-center">
      <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="mt-4 text-gray-600 text-sm font-medium">Waiting for LinkedIn login...</p>
      <p class="mt-1 text-gray-400 text-xs">Complete the sign-in in the opened tab.</p>
    </div>
    <button id="btn-cancel-login" class="w-full mt-6 py-2 text-gray-500 text-sm hover:text-gray-700">Cancel</button>
  </div>`;
}

function render2FA() {
  return `<div class="p-6">
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold" style="background-clip: text; -webkit-background-clip: text; color: transparent; background-image: linear-gradient(135deg, #667eea, #764ba2);">Warmup</h1>
      <p class="text-gray-500 text-sm mt-1">Two-Factor Authentication</p>
    </div>
    ${state.error ? `<div class="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">${state.error}</div>` : ''}
    <p class="text-sm text-gray-600 mb-4">Enter the 6-digit code from your authenticator app.</p>
    <form id="2fa-form" class="space-y-3">
      <input type="text" id="2fa-code" placeholder="000000" required maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center text-2xl tracking-widest focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none" />
      <button type="submit" class="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">Verify</button>
    </form>
    <button id="btn-back-login" class="w-full text-center text-xs text-gray-500 mt-3 hover:underline">Back to login</button>
  </div>`;
}

function renderOnboarding() {
  const userName = state.user?.name || '';
  return `<div class="p-6">
    <h2 class="text-lg font-bold mb-1">Welcome${userName ? ', ' + userName : ''}!</h2>
    <p class="text-gray-500 text-sm mb-4">Tell us about yourself so we can personalize your coaching.</p>

    <button id="btn-parse-profile" class="w-full mb-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-medium hover:bg-[#004182] transition flex items-center justify-center gap-2">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      Import from LinkedIn Profile
    </button>
    <div id="parse-status" class="hidden mb-3 p-2 rounded-lg text-xs text-center"></div>
    <p class="text-center text-xs text-gray-400 mb-3">- or fill in manually -</p>

    <form id="onboarding-form" class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Your LinkedIn Headline</label>
        <input type="text" id="ob-headline" placeholder="e.g., Senior Product Manager at Acme" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Industry</label>
        <input type="text" id="ob-industry" placeholder="e.g., Technology, Marketing" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Topics you post about (comma-separated)</label>
        <input type="text" id="ob-topics" placeholder="e.g., AI, Leadership, Product" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      <button type="submit" class="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Start My Routine</button>
    </form>
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

  const isConnectDay = [1, 3, 5].includes(dayOfWeek);
  const isGrowDay = [2, 4].includes(dayOfWeek);

  const goldenWindowHtml = state.goldenWindowStart ? `
    <div class="mx-4 mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center text-xs">
      <span class="text-amber-700 font-medium">Golden Window Active</span>
      <span id="golden-timer" class="text-amber-600 font-mono font-bold">--:--</span>
    </div>` : '';

  const usedCount = state.usage?.used || 0;

  return `<div class="pb-4">
    <div class="p-4 text-white" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <div class="flex justify-between items-center mb-2">
        <h1 class="text-lg font-bold">Warmup</h1>
        <button id="btn-settings" class="text-white/80 hover:text-white text-sm">Settings</button>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-center">
          <div class="text-2xl font-bold">${streakCount > 0 ? streakCount : '-'}</div>
          <div class="text-xs text-white/70">day streak</div>
          ${longestStreak > streakCount ? `<div class="text-xs text-white/50">best: ${longestStreak}</div>` : ''}
        </div>
        <div class="flex-1 text-right">
          <div class="text-xs text-white/70">${calendar.emoji} ${calendar.label}</div>
          <div class="text-xs text-white/60 mt-1">${completedActions.length} of ${state.session?.total_actions || 10} actions done</div>
        </div>
      </div>
      <div class="mt-2 bg-white/20 rounded-full h-2">
        <div class="bg-white rounded-full h-2 transition-all" style="width: ${Math.min(100, (completedActions.length / (state.session?.total_actions || 10)) * 100)}%"></div>
      </div>
    </div>

    ${streakMsg ? `<div class="mx-4 mt-3 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 text-center font-medium">${streakMsg}</div>` : ''}
    ${goldenWindowHtml}

    <div class="mx-4 mt-3 p-2 bg-purple-50 rounded-lg flex justify-between items-center text-xs">
      <span class="text-purple-700 font-medium">AI suggestions today</span>
      <span class="text-purple-600">${usedCount} / ${tierLimit}</span>
    </div>

    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Engage (2-3 min)</h3>
      ${DAILY_ACTIONS.engage.map(action => renderActionCard(action, completedActions)).join('')}
    </div>

    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Create (3-5 min)</h3>
      ${DAILY_ACTIONS.create.map(action => renderActionCard(action, completedActions)).join('')}
    </div>

    ${isConnectDay ? `
    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Connect (1-2 min)</h3>
      ${DAILY_ACTIONS.connect.map(action => renderActionCard(action, completedActions)).join('')}
    </div>` : ''}

    ${isGrowDay ? `
    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Grow (1 min)</h3>
      ${DAILY_ACTIONS.grow.map(action => renderActionCard(action, completedActions)).join('')}
    </div>` : ''}

    <div class="mx-4 mt-4 mb-2">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">AI Tools</h3>
      <div class="grid grid-cols-2 gap-2">
        <button data-ai="comment" class="p-3 bg-white border border-gray-200 rounded-lg text-left hover:border-purple-200 transition">
          <div class="text-sm font-medium">Comment</div>
          <div class="text-xs text-gray-400">Get a comment idea</div>
        </button>
        <button data-ai="post" class="p-3 bg-white border border-gray-200 rounded-lg text-left hover:border-purple-200 transition">
          <div class="text-sm font-medium">Draft Post</div>
          <div class="text-xs text-gray-400">AI-powered draft</div>
        </button>
        <button data-ai="ideas" class="p-3 bg-white border border-gray-200 rounded-lg text-left hover:border-purple-200 transition">
          <div class="text-sm font-medium">Post Ideas</div>
          <div class="text-xs text-gray-400">3 ideas for today</div>
        </button>
        <button data-ai="note" class="p-3 bg-white border border-gray-200 rounded-lg text-left hover:border-purple-200 transition">
          <div class="text-sm font-medium">Connection Note</div>
          <div class="text-xs text-gray-400">Personalized note</div>
        </button>
      </div>
    </div>

    <div id="ai-panel" class="mx-4 mb-4 ${state.aiResult ? '' : 'hidden'}">
      <div class="bg-white border border-purple-200 rounded-lg p-3">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-medium text-purple-600">${state.aiResultType || 'AI Suggestion'}</span>
          <div class="flex gap-1">
            <button id="btn-regenerate" class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200" title="Try again">Retry</button>
            <button id="btn-copy" class="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Copy</button>
          </div>
        </div>
        <p class="text-sm text-gray-700 whitespace-pre-wrap">${state.aiResult || ''}</p>
        <div class="mt-2 text-xs text-gray-400">${state.aiResult ? state.aiResult.length + ' chars' : ''}</div>
      </div>
    </div>

    ${state.aiLoading ? `<div class="mx-4 mb-4"><div class="flex items-center gap-2 text-sm text-gray-500"><div class="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>Generating...</div></div>` : ''}

    ${state.aiHistory.length > 0 ? `
    <div class="mx-4 mb-4">
      <button id="btn-toggle-history" class="text-xs text-gray-400 hover:text-gray-600">Recent suggestions (${state.aiHistory.length})</button>
      <div id="ai-history" class="hidden mt-2 space-y-2">
        ${state.aiHistory.map((h, i) => `
          <div class="p-2 bg-gray-50 rounded-lg text-xs cursor-pointer hover:bg-gray-100" data-history="${i}">
            <div class="font-medium text-gray-500">${h.type}</div>
            <div class="text-gray-600 truncate">${h.text.substring(0, 80)}...</div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

function renderSettings() {
  const user = state.user || {};
  const profile = user.profile || {};

  return `<div class="pb-4">
    <div class="p-4 text-white" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <div class="flex justify-between items-center">
        <h1 class="text-lg font-bold">Settings</h1>
        <button id="btn-back" class="text-white/80 hover:text-white text-sm">Back</button>
      </div>
    </div>

    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Profile</h3>
      <div class="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
        ${user.picture_url ? `<img src="${user.picture_url}" class="w-12 h-12 rounded-full" />` : ''}
        <div class="text-sm"><span class="text-gray-500">Name:</span> ${user.name || '-'}</div>
        <div class="text-sm"><span class="text-gray-500">Email:</span> ${user.email || '-'}</div>
        <div class="text-sm"><span class="text-gray-500">Headline:</span> ${profile.headline || '-'}</div>
        <div class="text-sm"><span class="text-gray-500">Industry:</span> ${profile.industry || '-'}</div>
        <div class="text-sm"><span class="text-gray-500">Topics:</span> ${profile.topics?.join(', ') || '-'}</div>
        <button id="btn-edit-profile" class="text-xs text-purple-600 hover:underline">Edit profile</button>
      </div>
    </div>

    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Billing</h3>
      <div class="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
        <div class="text-sm"><span class="text-gray-500">Plan:</span> <span class="font-medium capitalize">${user.tier || 'free'}</span></div>
        <div class="text-sm"><span class="text-gray-500">AI limit:</span> ${TIER_LIMITS[user.tier || 'free']} suggestions/day</div>
        <button id="btn-billing-portal" class="text-xs text-purple-600 hover:underline">Manage billing</button>
      </div>
    </div>

    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">BYOK (Bring Your Own Key)</h3>
      <div class="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
        <p class="text-xs text-gray-500">Use your own Anthropic API key for unlimited AI suggestions. Key is sent per-request and never stored on our servers.</p>
        <input type="password" id="byok-key" placeholder="sk-ant-..." value="" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
        <div class="flex gap-2">
          <button id="btn-save-byok" class="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">Save Key</button>
          <button id="btn-clear-byok" class="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Clear Key</button>
        </div>
      </div>
    </div>

    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Security</h3>
      <div class="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
        <div class="text-sm"><span class="text-gray-500">2FA:</span> ${user.totp_enabled ? '<span class="text-green-600">Enabled</span>' : '<span class="text-gray-400">Disabled</span>'}</div>
        <button id="btn-2fa-toggle" class="text-xs text-purple-600 hover:underline">${user.totp_enabled ? 'Disable 2FA' : 'Enable 2FA'}</button>
      </div>
    </div>

    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Stats</h3>
      <div class="bg-white border border-gray-200 rounded-lg p-3">
        <div class="grid grid-cols-2 gap-2 text-center">
          <div>
            <div class="text-xl font-bold text-purple-600">${state.streak?.current_streak || 0}</div>
            <div class="text-xs text-gray-500">Current streak</div>
          </div>
          <div>
            <div class="text-xl font-bold text-purple-600">${state.streak?.longest_streak || 0}</div>
            <div class="text-xs text-gray-500">Longest streak</div>
          </div>
        </div>
      </div>
    </div>

    <div class="mx-4 mt-4 mb-4">
      <button id="btn-logout" class="w-full py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition">Log Out</button>
    </div>
  </div>`;
}

function renderActionCard(action, completedActions) {
  const isCompleted = completedActions.includes(action.id);
  return `<div class="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg mb-2 cursor-pointer hover:border-purple-200 transition" data-action="${action.id}">
    <div class="w-5 h-5 rounded-full border-2 ${isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300'} flex items-center justify-center flex-shrink-0">
      ${isCompleted ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' : ''}
    </div>
    <span class="text-sm ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}">${action.label}</span>
  </div>`;
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

      // Start polling
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
    if (attempts > 120) { // 2 min timeout
      clearInterval(state.pollInterval);
      state.pollInterval = null;
      state.error = 'Login timed out. Try again.';
      state.view = 'auth';
      render();
      return;
    }

    try {
      const result = await api.pollLinkedInLogin(sessionId);
      if (!result) return; // Still pending

      clearInterval(state.pollInterval);
      state.pollInterval = null;

      // Check if 2FA required
      if (result.requires2FA) {
        state.tempToken = result.tempToken;
        state.view = 'auth-2fa';
        render();
        return;
      }

      // Got tokens - complete login
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
      // Don't stop polling on fetch errors, just keep trying
      console.warn('Poll error:', err.message);
    }
  }, 1000);

  // Cancel button
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
      // Check if we're on a LinkedIn profile page
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.includes('linkedin.com/in/')) {
        statusEl.className = 'mb-3 p-2 rounded-lg text-xs text-center bg-amber-50 text-amber-700';
        statusEl.textContent = 'Go to your LinkedIn profile page first, then click this button.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Parsing...';

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'PARSE_PROFILE' });
      const profile = response?.profile;

      if (!profile || !profile.headline) {
        statusEl.className = 'mb-3 p-2 rounded-lg text-xs text-center bg-amber-50 text-amber-700';
        statusEl.textContent = 'Could not read profile. Make sure the page is fully loaded and try again.';
        btn.disabled = false;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> Import from LinkedIn Profile';
        return;
      }

      // Fill in the fields
      const headlineInput = document.getElementById('ob-headline');
      const industryInput = document.getElementById('ob-industry');
      const topicsInput = document.getElementById('ob-topics');

      if (headlineInput && profile.headline) headlineInput.value = profile.headline;

      // Derive industry from headline/experience/about
      if (industryInput) {
        const text = (profile.headline + ' ' + profile.experience.join(' ') + ' ' + profile.about).toLowerCase();
        const industries = ['Technology', 'Software', 'Finance', 'Marketing', 'Healthcare', 'Education', 'Consulting', 'Design', 'Sales', 'Engineering', 'Product', 'Data', 'AI', 'Crypto', 'Real Estate', 'Media', 'Legal', 'HR'];
        const matched = industries.filter(i => text.includes(i.toLowerCase()));
        industryInput.value = matched.length > 0 ? matched.slice(0, 2).join(', ') : '';
      }

      // Use skills as topics
      if (topicsInput && profile.skills.length > 0) {
        topicsInput.value = profile.skills.slice(0, 5).join(', ');
      }

      statusEl.className = 'mb-3 p-2 rounded-lg text-xs text-center bg-green-50 text-green-700';
      statusEl.textContent = 'Profile imported! Review the fields and click Start.';
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> Import from LinkedIn Profile';
    } catch (err) {
      statusEl.className = 'mb-3 p-2 rounded-lg text-xs text-center bg-red-50 text-red-600';
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
      await loadDashboard();
    } catch (err) {
      state.error = err.message;
      render();
    }
  });
}

function attachDashboardHandlers() {
  if (state.goldenWindowStart) startGoldenWindowTimer();

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
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    }
  });

  document.getElementById('btn-toggle-history')?.addEventListener('click', () => {
    const el = document.getElementById('ai-history');
    if (el) el.classList.toggle('hidden');
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
        saveToHistory('Post Ideas', formatted);
        break;
      }
      case 'note': {
        const name = params?.name || prompt('Their name:');
        const headline = params?.headline || prompt('Their headline:');
        if (!name || !headline) { state.aiLoading = false; render(); return; }
        lastAICall = { type: 'note', params: { name, headline } };
        result = await api.generateConnectionNote(name, headline);
        state.aiResult = result.note;
        state.aiResultType = 'Connection Note';
        state.usage = result.usage;
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
    state = { view: 'auth', user: null, session: null, streak: null, usage: null, error: null, aiLoading: false, aiResult: null, aiResultType: null, aiHistory: [], goldenWindowStart: null, goldenWindowTimer: null, tempToken: null, oauthSessionId: null, pollInterval: null };
    render();
  });

  document.getElementById('btn-edit-profile')?.addEventListener('click', () => {
    state.view = 'onboarding';
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
        panel.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        panel.innerHTML = `
          <div class="bg-white rounded-xl p-4 max-w-xs w-full text-center">
            <h3 class="font-bold mb-2">Scan QR Code</h3>
            <p class="text-xs text-gray-500 mb-3">Scan with your authenticator app (Google Authenticator, Authy, etc.)</p>
            <img src="${result.qrDataUrl}" class="mx-auto mb-3" width="200" />
            <input type="text" id="verify-2fa-code" placeholder="Enter 6-digit code" maxlength="6" class="w-full px-3 py-2 border rounded-lg text-sm text-center mb-2" />
            <button id="btn-verify-2fa" class="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Verify & Enable</button>
            <button id="btn-cancel-2fa" class="w-full text-xs text-gray-500 mt-2">Cancel</button>
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
