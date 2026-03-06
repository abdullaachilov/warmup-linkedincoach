import { API_URL, HMAC_SECRET } from '../../shared/constants.js';

const encoder = new TextEncoder();

async function signRequest(body, timestamp) {
  const payload = (body ? JSON.stringify(body) : '{}') + timestamp;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

class WarmupAPI {
  constructor() {
    this.token = null;
    this.refreshToken = null;
  }

  async init() {
    const stored = await chrome.storage.local.get(['jwt', 'refreshToken']);
    this.token = stored.jwt || null;
    this.refreshToken = stored.refreshToken || null;
  }

  isLoggedIn() {
    return !!this.token;
  }

  async request(method, path, body = null) {
    const timestamp = Date.now().toString();
    const signature = await signRequest(body, timestamp);

    const headers = {
      'Content-Type': 'application/json',
      'X-Warmup-Signature': signature,
      'X-Warmup-Timestamp': timestamp,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const { byokKey } = await chrome.storage.local.get('byokKey');
    if (byokKey) {
      headers['X-BYOK-Key'] = byokKey;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAuth();
      if (refreshed) return this.request(method, path, body);
      await chrome.storage.local.remove(['jwt', 'refreshToken']);
      this.token = null;
      this.refreshToken = null;
      throw new Error('SESSION_EXPIRED');
    }

    if (response.status === 429) {
      const data = await response.json();
      throw new Error(data.error || 'Rate limit reached. Please wait.');
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  async refreshAuth() {
    if (!this.refreshToken) return false;
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      this.token = data.jwt;
      this.refreshToken = data.refreshToken;
      await chrome.storage.local.set({ jwt: data.jwt, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  }

  // LinkedIn OAuth
  async startLinkedInLogin() {
    const sessionId = crypto.randomUUID();
    await chrome.storage.local.set({ oauthSessionId: sessionId });
    // Open LinkedIn auth in new tab
    const url = `${API_URL}/api/auth/linkedin?session_id=${sessionId}`;
    await chrome.tabs.create({ url });
    return sessionId;
  }

  async pollLinkedInLogin(sessionId) {
    const response = await fetch(`${API_URL}/api/auth/linkedin/poll?session_id=${sessionId}`);
    if (response.status === 202) return null; // Still pending
    if (!response.ok) throw new Error('Login failed.');
    const data = await response.json();
    return data;
  }

  async completeLogin(data) {
    this.token = data.jwt;
    this.refreshToken = data.refreshToken;
    await chrome.storage.local.set({ jwt: data.jwt, refreshToken: data.refreshToken });
  }

  // 2FA
  async validate2FA(tempToken, code) {
    const result = await this.request('POST', '/api/auth/2fa/validate', { tempToken, code });
    this.token = result.jwt;
    this.refreshToken = result.refreshToken;
    await chrome.storage.local.set({ jwt: result.jwt, refreshToken: result.refreshToken });
    return result;
  }

  async setup2FA() { return this.request('POST', '/api/auth/2fa/setup'); }
  async verify2FA(code) { return this.request('POST', '/api/auth/2fa/verify', { code }); }
  async disable2FA(code) { return this.request('POST', '/api/auth/2fa/disable', { code }); }

  async logout() {
    try { await this.request('POST', '/api/auth/logout'); } catch {}
    await chrome.storage.local.remove(['jwt', 'refreshToken', 'oauthSessionId']);
    this.token = null;
    this.refreshToken = null;
  }

  // User
  async getMe() { return this.request('GET', '/api/me'); }
  async updateProfile(data) { return this.request('PUT', '/api/me/profile', data); }

  // AI
  async suggestComment(postText, authorName) {
    return this.request('POST', '/api/ai/suggest-comment', { post_text: postText, author_name: authorName });
  }
  async draftPost(idea, contentType) {
    return this.request('POST', '/api/ai/draft-post', { idea, content_type: contentType });
  }
  async getPostIdeas(feedContext) {
    return this.request('POST', '/api/ai/post-ideas', { feed_context: feedContext });
  }
  async generateConnectionNote(targetName, targetHeadline) {
    return this.request('POST', '/api/ai/connection-note', { target_name: targetName, target_headline: targetHeadline });
  }

  // Sessions
  async getToday() { return this.request('GET', '/api/sessions/today'); }
  async updateToday(data) { return this.request('PUT', '/api/sessions/today', data); }
  async generateSession(feedPosts) { return this.request('POST', '/api/sessions/generate', { feed_posts: feedPosts }); }
  async completeAction(actionId, completed) { return this.request('PUT', '/api/sessions/action', { action_id: actionId, completed }); }
  async getStreak() { return this.request('GET', '/api/sessions/streak'); }
  async getStats() { return this.request('GET', '/api/sessions/stats'); }
  async getWeekly() { return this.request('GET', '/api/sessions/weekly'); }
  async reportPerformance(data) { return this.request('POST', '/api/sessions/performance', data); }

  // Billing
  async createCheckout(priceId) { return this.request('POST', '/api/billing/checkout', { priceId }); }
  async getBillingStatus() { return this.request('GET', '/api/billing/status'); }
  async billingPortal() { return this.request('POST', '/api/billing/portal'); }

  // Post scoring
  async scorePost(draft) { return this.request('POST', '/api/ai/score-post', { draft }); }

  // Story Bank
  async getStoryBank() { return this.request('GET', '/api/me/story-bank'); }
  async addStory(entryType, content, tags) { return this.request('POST', '/api/me/story-bank', { entry_type: entryType, content, tags }); }
  async updateStory(id, data) { return this.request('PUT', `/api/me/story-bank/${id}`, data); }
  async deleteStory(id) { return this.request('DELETE', `/api/me/story-bank/${id}`); }
}

export const api = new WarmupAPI();
