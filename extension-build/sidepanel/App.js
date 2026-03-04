import { api } from './api/client.js';
import { CONTENT_CALENDAR, DAILY_ACTIONS, TIER_LIMITS } from '../shared/constants.js';

// State
let state = {
  view: 'loading', // loading, auth, onboarding, dashboard
  user: null,
  session: null,
  streak: null,
  usage: null,
  error: null,
  aiLoading: false,
  aiResult: null,
  aiResultType: null,
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

    // Update badge
    chrome.runtime.sendMessage({ type: 'UPDATE_STREAK', streak: streak.current_streak }).catch(() => {});

    render();
  } catch (err) {
    state.error = err.message;
    render();
  }
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
    case 'onboarding':
      app.innerHTML = renderOnboarding();
      attachOnboardingHandlers();
      break;
    case 'dashboard':
      app.innerHTML = renderDashboard();
      attachDashboardHandlers();
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
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold warmup-gradient bg-clip-text text-transparent" style="background-clip: text; -webkit-background-clip: text; color: transparent; background-image: linear-gradient(135deg, #667eea, #764ba2);">Warmup</h1>
      <p class="text-gray-500 text-sm mt-1">Your Daily LinkedIn Growth Coach</p>
    </div>
    ${state.error ? `<div class="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">${state.error}</div>` : ''}
    <div id="auth-tabs" class="flex mb-4 bg-gray-100 rounded-lg p-1">
      <button class="flex-1 py-2 text-sm font-medium rounded-md bg-white shadow" data-tab="login">Log In</button>
      <button class="flex-1 py-2 text-sm font-medium rounded-md text-gray-500" data-tab="register">Sign Up</button>
    </div>
    <form id="auth-form" class="space-y-3">
      <input type="email" id="auth-email" placeholder="Email" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none" />
      <input type="password" id="auth-password" placeholder="Password" required minlength="8" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none" />
      <button type="submit" class="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">Log In</button>
    </form>
    <p class="text-center text-xs text-gray-400 mt-4">Zero automation. 100% guided growth.</p>
  </div>`;
}

function renderOnboarding() {
  return `<div class="p-6">
    <h2 class="text-lg font-bold mb-1">Welcome to Warmup!</h2>
    <p class="text-gray-500 text-sm mb-4">Tell us about yourself so we can personalize your coaching.</p>
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
  const tierLimit = TIER_LIMITS[state.user?.tier || 'free'];

  const isConnectDay = [1, 3, 5].includes(dayOfWeek); // Mon, Wed, Fri
  const isGrowDay = [2, 4].includes(dayOfWeek); // Tue, Thu

  return `<div class="pb-4">
    <!-- Header -->
    <div class="warmup-gradient p-4 text-white" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <div class="flex justify-between items-center mb-2">
        <h1 class="text-lg font-bold">Warmup</h1>
        <button id="btn-settings" class="text-white/80 hover:text-white text-sm">Settings</button>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-center">
          <div class="text-2xl font-bold streak-fire">${streakCount > 0 ? streakCount : '-'}</div>
          <div class="text-xs text-white/70">day streak</div>
        </div>
        <div class="flex-1 text-right">
          <div class="text-xs text-white/70">${calendar.emoji} ${calendar.label}</div>
          <div class="text-xs text-white/60 mt-1">${completedActions.length} of ${state.session?.total_actions || 10} actions done</div>
        </div>
      </div>
      <!-- Progress bar -->
      <div class="mt-2 bg-white/20 rounded-full h-2">
        <div class="bg-white rounded-full h-2 transition-all" style="width: ${Math.min(100, (completedActions.length / (state.session?.total_actions || 10)) * 100)}%"></div>
      </div>
    </div>

    <!-- Usage meter -->
    <div class="mx-4 mt-3 p-2 bg-purple-50 rounded-lg flex justify-between items-center text-xs">
      <span class="text-purple-700 font-medium">AI suggestions today</span>
      <span class="text-purple-600">${state.usage?.used || 0} / ${tierLimit}</span>
    </div>

    <!-- Engage Section -->
    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Engage (2-3 min)</h3>
      ${DAILY_ACTIONS.engage.map(action => renderActionCard(action, completedActions)).join('')}
    </div>

    <!-- Create Section -->
    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Create (3-5 min)</h3>
      ${DAILY_ACTIONS.create.map(action => renderActionCard(action, completedActions)).join('')}
    </div>

    ${isConnectDay ? `
    <!-- Connect Section -->
    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Connect (1-2 min)</h3>
      ${DAILY_ACTIONS.connect.map(action => renderActionCard(action, completedActions)).join('')}
    </div>` : ''}

    ${isGrowDay ? `
    <!-- Grow Section -->
    <div class="mx-4 mt-4">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Grow (1 min)</h3>
      ${DAILY_ACTIONS.grow.map(action => renderActionCard(action, completedActions)).join('')}
    </div>` : ''}

    <!-- AI Tools -->
    <div class="mx-4 mt-4 mb-2">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">AI Tools</h3>
      <div class="grid grid-cols-2 gap-2">
        <button data-ai="comment" class="action-card p-3 bg-white border border-gray-200 rounded-lg text-left">
          <div class="text-sm font-medium">Comment</div>
          <div class="text-xs text-gray-400">Get a comment idea</div>
        </button>
        <button data-ai="post" class="action-card p-3 bg-white border border-gray-200 rounded-lg text-left">
          <div class="text-sm font-medium">Draft Post</div>
          <div class="text-xs text-gray-400">AI-powered draft</div>
        </button>
        <button data-ai="ideas" class="action-card p-3 bg-white border border-gray-200 rounded-lg text-left">
          <div class="text-sm font-medium">Post Ideas</div>
          <div class="text-xs text-gray-400">3 ideas for today</div>
        </button>
        <button data-ai="note" class="action-card p-3 bg-white border border-gray-200 rounded-lg text-left">
          <div class="text-sm font-medium">Connection Note</div>
          <div class="text-xs text-gray-400">Personalized note</div>
        </button>
      </div>
    </div>

    <!-- AI Result Panel -->
    <div id="ai-panel" class="mx-4 mb-4 ${state.aiResult ? '' : 'hidden'}">
      <div class="bg-white border border-purple-200 rounded-lg p-3">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-medium text-purple-600">${state.aiResultType || 'AI Suggestion'}</span>
          <button id="btn-copy" class="copy-btn text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Copy</button>
        </div>
        <p class="text-sm text-gray-700 whitespace-pre-wrap">${state.aiResult || ''}</p>
      </div>
    </div>

    ${state.aiLoading ? `<div class="mx-4 mb-4"><div class="flex items-center gap-2 text-sm text-gray-500"><div class="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>Generating...</div></div>` : ''}
  </div>`;
}

function renderActionCard(action, completedActions) {
  const isCompleted = completedActions.includes(action.id);
  return `<div class="action-card flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg mb-2 cursor-pointer" data-action="${action.id}">
    <div class="w-5 h-5 rounded-full border-2 ${isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300'} flex items-center justify-center flex-shrink-0">
      ${isCompleted ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' : ''}
    </div>
    <span class="text-sm ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}">${action.label}</span>
  </div>`;
}

// Event handlers
function attachAuthHandlers() {
  let isLogin = true;

  document.querySelectorAll('#auth-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      isLogin = btn.dataset.tab === 'login';
      document.querySelectorAll('#auth-tabs button').forEach(b => {
        b.className = `flex-1 py-2 text-sm font-medium rounded-md ${b === btn ? 'bg-white shadow' : 'text-gray-500'}`;
      });
      document.querySelector('#auth-form button[type="submit"]').textContent = isLogin ? 'Log In' : 'Sign Up';
    });
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    state.error = null;

    try {
      if (isLogin) {
        await api.login(email, password);
        const user = await api.getMe();
        state.user = user;
        if (!user.profile?.headline) {
          state.view = 'onboarding';
        } else {
          await loadDashboard();
          return;
        }
      } else {
        await api.register(email, password);
        state.error = null;
        state.view = 'auth';
        // Show success message
        render();
        const app = document.getElementById('app');
        const msg = document.createElement('div');
        msg.className = 'mx-6 mb-2 p-3 bg-green-50 text-green-700 text-sm rounded-lg';
        msg.textContent = 'Account created! Check your email to verify, then log in.';
        app.querySelector('#auth-form').before(msg);
        return;
      }
    } catch (err) {
      state.error = err.message;
    }
    render();
  });
}

function attachOnboardingHandlers() {
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
  // Action toggle
  document.querySelectorAll('[data-action]').forEach(card => {
    card.addEventListener('click', async () => {
      const actionId = card.dataset.action;
      const current = state.session?.completed_actions || [];
      const updated = current.includes(actionId)
        ? current.filter(a => a !== actionId)
        : [...current, actionId];

      state.session.completed_actions = updated;
      render();

      // Save state before potential popup close
      chrome.storage.local.set({ pendingSession: { completed_actions: updated } });

      try {
        await api.updateToday({ completed_actions: updated });
        chrome.storage.local.remove('pendingSession');
      } catch (err) {
        console.error('Failed to save action:', err);
      }
    });
  });

  // AI tool buttons
  document.querySelectorAll('[data-ai]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.ai;
      state.aiLoading = true;
      state.aiResult = null;
      render();

      try {
        let result;
        switch (type) {
          case 'comment': {
            // Try to get post context from content script
            let postText = 'A recent LinkedIn post about industry trends';
            let authorName = 'A professional';
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
            result = await api.suggestComment(postText, authorName);
            state.aiResult = result.suggestion;
            state.aiResultType = 'Comment Suggestion';
            state.usage = result.usage;
            break;
          }
          case 'post': {
            const idea = prompt('Describe your post idea:');
            if (!idea) { state.aiLoading = false; render(); return; }
            result = await api.draftPost(idea);
            state.aiResult = result.draft;
            state.aiResultType = 'Post Draft';
            state.usage = result.usage;
            break;
          }
          case 'ideas': {
            result = await api.getPostIdeas();
            const ideas = result.ideas;
            state.aiResult = Array.isArray(ideas)
              ? ideas.map((i, idx) => `${idx + 1}. [${i.type}] ${i.idea}\n   Hook: "${i.hook_preview}"`).join('\n\n')
              : JSON.stringify(ideas);
            state.aiResultType = 'Post Ideas';
            state.usage = result.usage;
            break;
          }
          case 'note': {
            const name = prompt('Their name:');
            const headline = prompt('Their headline:');
            if (!name || !headline) { state.aiLoading = false; render(); return; }
            result = await api.generateConnectionNote(name, headline);
            state.aiResult = result.note;
            state.aiResultType = 'Connection Note';
            state.usage = result.usage;
            break;
          }
        }
      } catch (err) {
        state.aiResult = `Error: ${err.message}`;
        state.aiResultType = 'Error';
      }

      state.aiLoading = false;
      render();
    });
  });

  // Copy button
  document.getElementById('btn-copy')?.addEventListener('click', async () => {
    if (state.aiResult) {
      await navigator.clipboard.writeText(state.aiResult);
      const btn = document.getElementById('btn-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    }
  });

  // Settings
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    // Simple settings toggle - could expand to full settings panel
    if (confirm('Log out?')) {
      api.logout().then(() => {
        state = { view: 'auth', user: null, session: null, streak: null, usage: null, error: null, aiLoading: false, aiResult: null, aiResultType: null };
        render();
      });
    }
  });
}

// Save state on unload (popup unmounting mid-operation)
window.addEventListener('beforeunload', () => {
  if (state.session?.completed_actions) {
    chrome.storage.local.set({ pendingSession: { completed_actions: state.session.completed_actions } });
  }
});

// Restore pending state on load
async function restorePendingState() {
  const { pendingSession } = await chrome.storage.local.get('pendingSession');
  if (pendingSession && api.isLoggedIn()) {
    try {
      await api.updateToday(pendingSession);
      await chrome.storage.local.remove('pendingSession');
    } catch {}
  }
}

// Listen for daily reset
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'DAILY_RESET') {
    loadDashboard();
  }
});

// Boot
restorePendingState().then(init);
