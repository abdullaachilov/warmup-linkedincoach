import React, { useState } from 'react';

const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/warmup-daily-linkedin-coa/baippjjmfcohnhbggbilelehdecpddop';

const CheckIcon = () => (
  <svg className="w-5 h-5 text-warmup-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Daily Guided Checklist',
    desc: 'An algorithm-optimized routine that adapts by day of week. Engage, create, connect - each step tells you exactly what to do and why it works.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
    title: 'AI Post Drafter',
    desc: 'Describe an idea, get a hook-first LinkedIn post optimized for reach. Trained on what the algorithm actually rewards.',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    title: 'AI Comment Suggester',
    desc: 'Thoughtful, genuine comments generated from post context. Your voice, amplified. Never a generic "Great post!" again.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    title: 'Connection Notes',
    desc: 'Personalized outreach under 200 characters. 48% higher accept rate vs blank connection requests.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
      </svg>
    ),
    title: 'Streak Tracking',
    desc: 'Build consistency with daily streaks, weekly stats, and growth tracking. The habit is the strategy.',
    color: 'from-rose-500 to-pink-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    ),
    title: 'Algorithm Education',
    desc: 'Every action has a tooltip explaining why it works. Learn the LinkedIn algorithm as you grow, not just follow rules blindly.',
    color: 'from-cyan-500 to-blue-600',
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Start building your LinkedIn habit',
    features: ['Daily guided checklist', 'Algorithm tips on every step', 'Streak tracking', '2 AI suggestions per day'],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '$5',
    period: '/mo',
    desc: 'For consistent LinkedIn growers',
    features: ['Everything in Free', '8 AI suggestions per day', 'AI post idea generator', 'Story Bank for your voice', 'Priority support'],
    cta: 'Start Free Trial',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$15',
    period: '/mo',
    desc: 'For serious LinkedIn builders',
    features: ['Everything in Starter', '40 AI suggestions per day', 'Weekly performance review', 'Content calendar', 'Advanced voice tuning'],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'BYOK',
    price: '$5',
    period: '/6mo',
    desc: 'Bring Your Own API Key',
    features: ['Everything in Pro', 'Unlimited AI suggestions', 'Use your Anthropic API key', 'Full control over usage', 'Subject to Anthropic limits'],
    cta: 'Get Started',
    highlight: false,
  },
];

const faqs = [
  { q: 'Does this automate my LinkedIn?', a: 'No. Warmup coaches you through actions - you do all the clicking, typing, and posting yourself. Zero automation, zero ToS risk. Think of it as a personal trainer, not a robot.' },
  { q: "Is this against LinkedIn's Terms of Service?", a: "No. The extension reads your feed for context (same as you reading it) and suggests content you copy-paste. No automation, no API abuse, no fake engagement." },
  { q: 'What AI model powers the suggestions?', a: "Claude by Anthropic (Sonnet 4.5) - one of the most capable AI models available. BYOK users can use their own Anthropic API key for unlimited suggestions." },
  { q: 'Where is my data stored?', a: 'Your coaching profile and progress are stored securely on encrypted servers. LinkedIn data is only read in your browser and never stored - we send minimal context for AI suggestions and discard it immediately.' },
  { q: 'Can I cancel anytime?', a: "Yes. Cancel from the extension settings or your Stripe billing portal. You keep access until the end of your billing period. No questions asked." },
  { q: 'How is this different from other LinkedIn tools?', a: "Most tools automate actions (risky) or just schedule posts. Warmup is a daily coaching system that teaches you the algorithm while you do the work. You build real skills, not dependency on a tool." },
];

function App() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50">
        <div className="mx-4 mt-4">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm">
            <a href="/" className="text-xl font-bold text-gradient">Warmup</a>
            <div className="flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition hidden sm:block">Features</a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition hidden sm:block">Pricing</a>
              <a href="#faq" className="text-sm text-gray-600 hover:text-gray-900 transition hidden sm:block">FAQ</a>
              <a href={CHROME_STORE_URL} className="text-sm font-semibold px-5 py-2 bg-warmup-600 text-white rounded-xl hover:bg-warmup-700 transition-all shadow-md shadow-warmup-200/50">
                Add to Chrome
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950 pt-36 pb-28 sm:pt-44 sm:pb-36">
        {/* Gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="orb-1 absolute -top-32 -left-32 w-[500px] h-[500px] bg-warmup-600/20 rounded-full blur-[120px]" />
          <div className="orb-2 absolute top-20 right-0 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[100px]" />
          <div className="orb-3 absolute -bottom-20 left-1/3 w-[600px] h-[300px] bg-indigo-500/10 rounded-full blur-[120px]" />
        </div>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className="fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-warmup-300 text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Your daily LinkedIn coach, powered by AI
          </div>

          <h1 className="fade-up fade-up-delay-1 text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight">
            Grow your LinkedIn
            <br />
            <span className="text-gradient">in 7 minutes a day</span>
          </h1>

          <p className="fade-up fade-up-delay-2 mt-7 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            AI-powered coaching that teaches you the algorithm while you engage.
            No automation. No shortcuts. Just consistent daily actions that compound.
          </p>

          <div className="fade-up fade-up-delay-3 mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a href={CHROME_STORE_URL} className="group px-8 py-4 bg-warmup-600 text-white rounded-2xl text-lg font-semibold hover:bg-warmup-500 transition-all shadow-xl shadow-warmup-600/25 pulse-cta inline-flex items-center justify-center gap-3">
              <svg className="w-5 h-5 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              Add to Chrome - Free
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </a>
            <a href="#how-it-works" className="px-8 py-4 bg-white/[0.06] text-gray-300 rounded-2xl text-lg font-medium hover:bg-white/[0.1] transition border border-white/[0.08]">
              See How It Works
            </a>
          </div>

          <p className="fade-up fade-up-delay-4 mt-6 text-sm text-gray-500">No credit card required. Free forever plan available.</p>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* Trust bar */}
      <section className="py-10 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-400 mb-6 uppercase tracking-wider font-medium">Built with technology you can trust</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-gray-400">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span className="text-sm font-medium text-gray-600">HMAC Signed</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              <span className="text-sm font-medium text-gray-600">E2E Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
              <span className="text-sm font-medium text-gray-600">Claude AI</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
              <span className="text-sm font-medium text-gray-600">Zero Automation</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 grid-bg">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-warmup-600 uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Three steps. Seven minutes. Real growth.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-[2px] bg-gradient-to-r from-warmup-200 via-warmup-300 to-warmup-200" />

            {[
              { step: '01', title: 'Open LinkedIn', desc: 'Warmup appears automatically in your Chrome side panel when you visit linkedin.com. No extra tabs or windows needed.', icon: '🖥' },
              { step: '02', title: 'Follow Your Routine', desc: 'A guided daily checklist coaches you through high-impact actions. Each step tells you what to do and why the algorithm rewards it.', icon: '📋' },
              { step: '03', title: 'Engage with AI Help', desc: 'AI suggests comments, post drafts, and connection notes. You review, personalize, copy, and paste. Your voice, amplified.', icon: '⚡' },
            ].map((item, i) => (
              <div key={item.step} className={`fade-up fade-up-delay-${i + 1} relative text-center`}>
                <div className="relative z-10 w-16 h-16 bg-white border-2 border-warmup-200 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6 shadow-sm">
                  {item.icon}
                </div>
                <span className="text-xs font-bold text-warmup-400 uppercase tracking-widest">Step {item.step}</span>
                <h3 className="text-xl font-bold text-gray-900 mt-2 mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-warmup-600 uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything you need to grow on LinkedIn</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">Not another generic AI tool. Warmup is a complete daily coaching system built specifically for LinkedIn growth.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={feature.title} className={`fade-up fade-up-delay-${(i % 3) + 1} group bg-white p-7 rounded-2xl border border-gray-100 card-hover`}>
                <div className={`w-11 h-11 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-white mb-5 shadow-lg shadow-gray-200/50`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed text-[15px]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-warmup-950 to-gray-900" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-warmup-400 uppercase tracking-wider mb-3">Real results</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Professionals growing with Warmup</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: "I went from 50 impressions per post to 2,000+ in three weeks just by being consistent with Warmup.", name: 'Early beta user', role: 'Tech founder', metric: '40x reach' },
              { quote: "The daily checklist is what makes this different. I actually know what to do each day instead of guessing.", name: 'Beta tester', role: 'Marketing lead', metric: '21-day streak' },
              { quote: "The AI comments save me so much time. They sound like me, not like a bot. I just tweak and post.", name: 'Beta tester', role: 'Sales director', metric: '3x comments/day' },
            ].map((t, i) => (
              <div key={i} className={`fade-up fade-up-delay-${i + 1} bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-7`}>
                <div className="text-warmup-400 font-bold text-2xl mb-4">{t.metric}</div>
                <p className="text-gray-300 leading-relaxed mb-6 text-[15px]">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-warmup-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 grid-bg">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-warmup-600 uppercase tracking-wider mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Start free. Scale when ready.</h2>
            <p className="mt-4 text-lg text-gray-500">No hidden fees. No surprise charges. Cancel anytime.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl p-7 transition-all duration-300 ${
                plan.highlight
                  ? 'bg-white pricing-glow scale-[1.02]'
                  : 'bg-white border border-gray-200 card-hover'
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-warmup-600 to-purple-600 text-white text-xs font-bold rounded-full shadow-lg shadow-warmup-200/50 uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-1 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-400 text-sm ml-1">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckIcon />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={CHROME_STORE_URL}
                  className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                    plan.highlight
                      ? 'bg-warmup-600 text-white hover:bg-warmup-700 shadow-lg shadow-warmup-200/50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-gray-50 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-warmup-600 uppercase tracking-wider mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Common questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50/50 transition"
                >
                  <span className="font-semibold text-gray-900 pr-8">{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? 'max-h-48' : 'max-h-0'}`}>
                  <p className="px-6 pb-6 text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-warmup-600 via-purple-600 to-indigo-700" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />

        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to grow your LinkedIn presence?</h2>
          <p className="text-purple-100 text-lg mb-10 max-w-xl mx-auto">
            Join professionals who are building real LinkedIn reach through consistent, coached daily actions.
          </p>
          <a href={CHROME_STORE_URL} className="group inline-flex items-center gap-3 px-10 py-4 bg-white text-warmup-700 rounded-2xl text-lg font-bold hover:bg-gray-50 transition-all shadow-2xl shadow-black/20">
            Add to Chrome - Free
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </a>
          <p className="mt-5 text-sm text-purple-200">Free forever plan available. No credit card required.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">
            <div>
              <span className="text-2xl font-bold text-gradient">Warmup</span>
              <p className="mt-2 text-sm text-gray-500 max-w-xs">Your daily LinkedIn growth coach. AI-powered coaching, zero automation.</p>
            </div>
            <div className="flex gap-16">
              <div>
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Product</h4>
                <div className="flex flex-col gap-3 text-sm">
                  <a href="#features" className="hover:text-white transition">Features</a>
                  <a href="#pricing" className="hover:text-white transition">Pricing</a>
                  <a href="#faq" className="hover:text-white transition">FAQ</a>
                  <a href={CHROME_STORE_URL} className="hover:text-white transition">Chrome Web Store</a>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Legal</h4>
                <div className="flex flex-col gap-3 text-sm">
                  <a href="/privacy" className="hover:text-white transition">Privacy Policy</a>
                  <a href="/terms" className="hover:text-white transition">Terms of Service</a>
                  <a href="mailto:hello@networkwarmup.com" className="hover:text-white transition">Contact</a>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-sm text-gray-600">2026 Warmup. Not affiliated with LinkedIn.</span>
            <span className="text-sm text-gray-600">Built with care by indie makers.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
