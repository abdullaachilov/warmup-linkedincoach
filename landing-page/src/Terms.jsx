import React from 'react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
          <a href="/" className="text-xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">Warmup</a>
        </div>
      </nav>

      <div className="pt-24 pb-20 px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 4, 2026</p>

        <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Service Description</h2>
            <p>Warmup is a Chrome extension and web service that provides daily LinkedIn engagement coaching. It offers a guided checklist, AI-powered content suggestions, and streak tracking. Warmup does not automate any actions on LinkedIn - all actions are performed manually by the user.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Account Registration</h2>
            <p>You must provide a valid email address and verify it to use the service. You are responsible for maintaining the security of your account credentials. One account per person.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Acceptable Use</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use Warmup only for personal LinkedIn engagement coaching.</li>
              <li>Not attempt to circumvent usage limits or rate limits.</li>
              <li>Not use the service to generate spam, misleading content, or content that violates LinkedIn's Terms of Service.</li>
              <li>Not reverse-engineer, decompile, or attempt to extract the source code of the service.</li>
              <li>Not share your account or API access with others.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. AI-Generated Content</h2>
            <p>Warmup provides AI-generated suggestions for LinkedIn comments, posts, and connection notes. You are solely responsible for reviewing, editing, and publishing any content. AI suggestions are starting points - you should personalize them before use. We are not liable for any consequences of content you post on LinkedIn.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. BYOK (Bring Your Own Key)</h2>
            <p>If you use the BYOK feature with your own Anthropic API key:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Your API key is sent per-request and never stored on our servers.</li>
              <li>You are responsible for any costs incurred on your Anthropic account.</li>
              <li>We are not liable for any charges resulting from your API key usage through our service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Payments and Subscriptions</h2>
            <p>Paid plans are billed through Stripe. Subscriptions renew automatically. You can cancel at any time through the billing portal or extension settings. Refunds are handled on a case-by-case basis. The BYOK plan is a one-time annual payment.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Service Availability</h2>
            <p>We aim to maintain high availability but do not guarantee uninterrupted service. AI features depend on third-party APIs (Anthropic) and may be temporarily unavailable. Free tier AI features may be limited or disabled during high-demand periods.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms, abuse the service, or engage in fraudulent activity. You may delete your account at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Limitation of Liability</h2>
            <p>Warmup is provided "as is" without warranties. We are not liable for any indirect, incidental, or consequential damages. Our total liability is limited to the amount you paid for the service in the past 12 months.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Changes to Terms</h2>
            <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Contact</h2>
            <p>For questions about these terms, contact: <a href="mailto:im@abdullaachilov.com" className="text-purple-600 underline">im@abdullaachilov.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
