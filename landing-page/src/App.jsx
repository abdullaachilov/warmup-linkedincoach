import React from 'react';

const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/warmup-daily-linkedin-coa/baippjjmfcohnhbggbilelehdecpddop';

function App() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">Warmup</span>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block">Features</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block">Pricing</a>
            <a href="#faq" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block">FAQ</a>
            <a href={CHROME_STORE_URL} className="text-sm font-medium px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">Add to Chrome</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight">
            Your Daily <span className="bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">LinkedIn</span> Growth Coach
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
            Grow your LinkedIn reach in 5 minutes a day. AI-powered coaching, zero automation. You stay in control.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a href={CHROME_STORE_URL} className="px-8 py-3 bg-purple-600 text-white rounded-xl text-lg font-medium hover:bg-purple-700 transition shadow-lg shadow-purple-200">
              Add to Chrome - Free
            </a>
            <a href="#pricing" className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl text-lg font-medium hover:bg-gray-200 transition">
              See Pricing
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-400">No credit card required. Free forever plan available.</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Open LinkedIn', desc: 'Warmup appears in your side panel automatically when you visit linkedin.com.' },
              { step: '2', title: 'Follow Your Routine', desc: 'A guided daily checklist coaches you through high-impact actions: comment, post, connect.' },
              { step: '3', title: 'Use AI Suggestions', desc: 'AI suggests comments, post drafts, and connection notes. You copy, paste, and publish.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">{item.step}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Everything You Need to Grow</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: 'Daily Guided Checklist', desc: 'Algorithm-optimized routine that adapts by day of week. Engage, create, connect, grow.' },
              { title: 'AI Post Drafter', desc: 'Describe an idea, get an optimized LinkedIn post. Hook-first writing that beats the algorithm.' },
              { title: 'AI Comment Suggester', desc: 'Thoughtful, genuine comments generated from post context. Never generic "Great post!" again.' },
              { title: 'Connection Note Generator', desc: 'Personalized outreach under 200 characters. 48% higher accept rate vs blank requests.' },
              { title: 'Streak Tracking', desc: 'Build consistency with daily streaks. See your weekly stats and growth over time.' },
              { title: 'Algorithm Tips', desc: 'Every action has a tooltip explaining WHY it works. Learn the algorithm as you grow.' },
            ].map((feature) => (
              <div key={feature.title} className="p-6 border border-gray-200 rounded-xl hover:border-purple-200 hover:shadow-sm transition">
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 bg-purple-50 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl text-gray-700 italic">"I went from 50 impressions per post to 2,000+ in three weeks just by being consistent with Warmup."</p>
          <p className="mt-4 text-sm text-gray-500">- Early beta user</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-center text-gray-600 mb-12">Start free. Upgrade when you need more AI suggestions.</p>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { name: 'Free', price: '$0', period: 'forever', features: ['Daily checklist', 'Algorithm tips', 'Streak tracking', '2 AI suggestions/day'], cta: 'Get Started', highlight: false },
              { name: 'Starter', price: '$5', period: '/month', features: ['Everything in Free', '8 AI suggestions/day', 'Post idea generator', 'Priority support'], cta: 'Start Free Trial', highlight: false },
              { name: 'Pro', price: '$15', period: '/month', features: ['Everything in Starter', '40 AI suggestions/day', 'Weekly performance review', 'Content calendar'], cta: 'Start Free Trial', highlight: true },
              { name: 'BYOK', price: '$5', period: '/year', features: ['Everything in Pro', 'Unlimited AI*', 'Use your own API key', '*Subject to Anthropic limits'], cta: 'Get Started', highlight: false },
            ].map((plan) => (
              <div key={plan.name} className={`p-6 rounded-xl border ${plan.highlight ? 'border-purple-500 shadow-lg shadow-purple-100 relative' : 'border-gray-200'}`}>
                {plan.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-full">Most Popular</div>}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href={CHROME_STORE_URL} className={`block text-center py-2 rounded-lg text-sm font-medium transition ${plan.highlight ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-gray-50 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              { q: 'Does this automate my LinkedIn?', a: 'No. Warmup coaches you through actions - you do all the clicking, typing, and posting yourself. Zero automation, zero ToS risk.' },
              { q: 'Is this against LinkedIn\'s Terms of Service?', a: 'No. The extension reads your feed for context (same as you reading it) and suggests content you copy-paste. No automation, no API abuse.' },
              { q: 'What AI model does it use?', a: 'Claude by Anthropic (Sonnet 4.5). BYOK users can use their own Anthropic API key for unlimited suggestions.' },
              { q: 'Where is my data stored?', a: 'Your coaching profile and progress are stored on our servers. Your LinkedIn data is only read in your browser and never sent to us except the minimal context needed for AI suggestions.' },
              { q: 'Can I cancel anytime?', a: 'Yes. Cancel from the extension settings or your Stripe billing portal. You\'ll keep access until the end of your billing period.' },
            ].map((faq) => (
              <div key={faq.q} className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900">{faq.q}</h3>
                <p className="mt-2 text-sm text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to grow your LinkedIn presence?</h2>
          <p className="text-gray-600 mb-8">Join thousands of professionals who grow their reach in just 5 minutes a day.</p>
          <a href={CHROME_STORE_URL} className="px-8 py-3 bg-purple-600 text-white rounded-xl text-lg font-medium hover:bg-purple-700 transition shadow-lg shadow-purple-200 inline-block">
            Add to Chrome - Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-sm text-gray-500">Built with care. Not affiliated with LinkedIn.</span>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="/privacy" className="hover:text-gray-900">Privacy Policy</a>
            <a href="/terms" className="hover:text-gray-900">Terms</a>
            <a href="mailto:hello@networkwarmup.com" className="hover:text-gray-900">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
