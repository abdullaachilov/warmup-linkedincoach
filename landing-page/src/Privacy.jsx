import React from 'react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
          <a href="/" className="text-xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">Warmup</a>
        </div>
      </nav>

      <div className="pt-24 pb-20 px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 4, 2026</p>

        <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. What We Collect</h2>
            <p><strong>Account data:</strong> Email address and hashed password when you register. We never store your password in plain text.</p>
            <p className="mt-2"><strong>Profile data:</strong> Your LinkedIn headline, industry, and topics you choose to share for AI personalization.</p>
            <p className="mt-2"><strong>Usage data:</strong> Daily checklist progress, streak counts, and the number of AI suggestions used per day.</p>
            <p className="mt-2"><strong>LinkedIn content (minimal):</strong> When you use AI features, the extension sends only the text of the specific LinkedIn post or profile you're engaging with to our server for AI processing. This content is not stored after the AI response is generated.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. What We Do NOT Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We do not scrape or store your LinkedIn feed.</li>
              <li>We do not access your LinkedIn credentials.</li>
              <li>We do not collect your browsing history.</li>
              <li>We do not track you across websites.</li>
              <li>We do not sell or share your data with third parties.</li>
              <li>We do not store BYOK (Bring Your Own Key) API keys - they are used for a single request and immediately discarded.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide personalized AI suggestions (comments, posts, connection notes).</li>
              <li>To track your daily coaching progress and streaks.</li>
              <li>To manage your subscription and billing through Stripe.</li>
              <li>To send transactional emails (verification, password reset).</li>
              <li>To enforce usage limits and prevent abuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. AI Processing</h2>
            <p>AI suggestions are generated using Anthropic's Claude API. When you request a suggestion:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>The relevant text (e.g., a LinkedIn post you want to comment on) is sent to our backend server.</li>
              <li>Our server forwards the text to Anthropic's API with a system prompt.</li>
              <li>The AI response is returned to you and not stored.</li>
              <li>Anthropic's privacy policy applies to their processing of this data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Storage and Security</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your data is stored on Railway-hosted PostgreSQL with SSL encryption.</li>
              <li>All connections use HTTPS/TLS.</li>
              <li>Passwords are hashed with bcrypt.</li>
              <li>Authentication uses JWT tokens with expiry.</li>
              <li>BYOK API keys are never stored, logged, or cached.</li>
              <li>Payment processing is handled entirely by Stripe - we never see your card details.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Chrome Extension Permissions</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>sidePanel:</strong> Displays the coaching panel alongside LinkedIn.</li>
              <li><strong>storage:</strong> Saves your login session and checklist progress locally.</li>
              <li><strong>activeTab:</strong> Reads the current LinkedIn page to provide context for AI suggestions.</li>
              <li><strong>alarms:</strong> Resets your daily checklist and updates streak counts.</li>
              <li><strong>notifications:</strong> Sends reminders during your 90-minute post engagement window.</li>
              <li><strong>host_permissions (linkedin.com):</strong> Reads visible post content on LinkedIn for AI context. The extension never modifies LinkedIn pages.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Retention</h2>
            <p>Account and profile data is retained while your account is active. Usage logs are retained for 90 days for abuse prevention. You can delete your account by contacting us, which removes all associated data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Anthropic (Claude API):</strong> AI text generation. <a href="https://www.anthropic.com/privacy" className="text-purple-600 underline">Privacy Policy</a></li>
              <li><strong>Stripe:</strong> Payment processing. <a href="https://stripe.com/privacy" className="text-purple-600 underline">Privacy Policy</a></li>
              <li><strong>Resend:</strong> Transactional emails. <a href="https://resend.com/legal/privacy-policy" className="text-purple-600 underline">Privacy Policy</a></li>
              <li><strong>Railway:</strong> Server hosting. <a href="https://railway.app/legal/privacy" className="text-purple-600 underline">Privacy Policy</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us at the email below.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Contact</h2>
            <p>For privacy-related questions, contact: <a href="mailto:im@abdullaachilov.com" className="text-purple-600 underline">im@abdullaachilov.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
