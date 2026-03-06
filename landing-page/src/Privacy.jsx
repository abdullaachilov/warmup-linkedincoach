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
        <p className="text-sm text-gray-500 mb-8">Last updated: March 6, 2026</p>

        <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. What We Collect</h2>
            <p><strong>Account data:</strong> When you sign in with LinkedIn, we receive your name, email address, and profile picture from LinkedIn's OAuth service. We do not receive or store your LinkedIn password.</p>
            <p className="mt-2"><strong>Profile data:</strong> Your LinkedIn headline, industry, topics, and optional voice/context settings you choose to share for AI personalization.</p>
            <p className="mt-2"><strong>Story Bank:</strong> Personal stories, wins, lessons, and opinions you voluntarily add to improve AI suggestions.</p>
            <p className="mt-2"><strong>Usage data:</strong> Daily session progress, streak counts, actions completed, and the number of AI suggestions used per day.</p>
            <p className="mt-2"><strong>LinkedIn content (minimal):</strong> When you use AI features, the extension sends only the text of the specific LinkedIn post or profile you're engaging with to our server for AI processing. This content is not stored after the AI response is generated.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. What We Do NOT Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We do not scrape or store your LinkedIn feed.</li>
              <li>We do not access or store your LinkedIn password.</li>
              <li>We do not post, like, comment, or perform any actions on LinkedIn on your behalf.</li>
              <li>We do not collect your browsing history.</li>
              <li>We do not track you across websites.</li>
              <li>We do not sell or share your data with third parties for advertising.</li>
              <li>We do not store BYOK (Bring Your Own Key) API keys - they are used for a single request and immediately discarded.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To authenticate you via LinkedIn OAuth and maintain your session.</li>
              <li>To generate personalized AI sessions and suggestions (comments, posts, connection notes).</li>
              <li>To track your daily coaching progress, streaks, and weekly summaries.</li>
              <li>To manage your subscription and billing through Stripe.</li>
              <li>To enforce usage limits and prevent abuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. LinkedIn OAuth</h2>
            <p>Warmup uses LinkedIn's "Sign In with LinkedIn" (OpenID Connect) for authentication. When you sign in:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>You are redirected to LinkedIn's login page - we never see your LinkedIn credentials.</li>
              <li>We request only the <code>openid</code>, <code>profile</code>, and <code>email</code> scopes.</li>
              <li>We receive your name, email, and profile picture. We do not receive access to post on your behalf or read your connections.</li>
              <li>You can revoke access at any time from your LinkedIn settings under "Permitted Services".</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. AI Processing</h2>
            <p>AI suggestions are generated using Anthropic's Claude API. When you request a suggestion:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>The relevant text (e.g., a LinkedIn post you want to comment on) is sent to our backend server.</li>
              <li>Your profile context and Story Bank entries may be included to personalize the response.</li>
              <li>Our server forwards the text to Anthropic's API with a system prompt.</li>
              <li>The AI response is returned to you. Post content sent for AI processing is not stored.</li>
              <li>Anthropic's privacy policy applies to their processing of this data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Storage and Security</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your data is stored on Railway-hosted PostgreSQL with SSL encryption.</li>
              <li>All connections use HTTPS/TLS.</li>
              <li>Authentication uses JWT tokens with expiry and refresh token rotation.</li>
              <li>Optional two-factor authentication (TOTP) is available for additional security.</li>
              <li>BYOK API keys are never stored, logged, or cached on our servers.</li>
              <li>Payment processing is handled entirely by Stripe - we never see your card details.</li>
              <li>All API requests are signed with HMAC to prevent tampering.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Chrome Extension Permissions</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>sidePanel:</strong> Displays the coaching panel alongside LinkedIn.</li>
              <li><strong>storage:</strong> Saves your login session and checklist progress locally in the browser.</li>
              <li><strong>activeTab:</strong> Reads the current LinkedIn page to provide context for AI suggestions.</li>
              <li><strong>alarms:</strong> Resets your daily session and updates streak counts at midnight.</li>
              <li><strong>notifications:</strong> Sends reminders during your 90-minute post engagement window.</li>
              <li><strong>host_permissions (linkedin.com):</strong> Reads visible post content on LinkedIn for AI context. The extension never modifies LinkedIn pages or performs actions on your behalf.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Data Retention</h2>
            <p>Account and profile data is retained while your account is active. Usage logs are retained for 90 days for abuse prevention. Story Bank entries are retained until you delete them. You can delete your account by contacting us, which removes all associated data within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>LinkedIn (OAuth):</strong> Authentication only. <a href="https://www.linkedin.com/legal/privacy-policy" className="text-purple-600 underline">Privacy Policy</a></li>
              <li><strong>Anthropic (Claude API):</strong> AI text generation. <a href="https://www.anthropic.com/privacy" className="text-purple-600 underline">Privacy Policy</a></li>
              <li><strong>Stripe:</strong> Payment processing. <a href="https://stripe.com/privacy" className="text-purple-600 underline">Privacy Policy</a></li>
              <li><strong>Railway:</strong> Server hosting. <a href="https://railway.app/legal/privacy" className="text-purple-600 underline">Privacy Policy</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us at the email below. You can revoke LinkedIn access from your LinkedIn account settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Contact</h2>
            <p>For privacy-related questions, contact: <a href="mailto:im@abdullaachilov.com" className="text-purple-600 underline">im@abdullaachilov.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
