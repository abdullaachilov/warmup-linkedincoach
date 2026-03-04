# Warmup - Complete Setup Guide

## Step 1: Anthropic API Keys

Go to console.anthropic.com → API Keys

Create 2 keys:
- ANTHROPIC_FREE_KEY (set $50/month spend limit in console)
- ANTHROPIC_PAID_KEY (set $500/month spend limit in console)

---

## Step 2: Stripe

Go to dashboard.stripe.com

A) Developers → API Keys → copy Secret key → STRIPE_SECRET_KEY

B) Products → Create 3 products:
- "Warmup Starter" - $5/month recurring → copy Price ID → STRIPE_STARTER_PRICE_ID
- "Warmup Pro" - $15/month recurring → copy Price ID → STRIPE_PRO_PRICE_ID
- "Warmup BYOK" - $5/year one-time → copy Price ID → STRIPE_BYOK_PRICE_ID

C) Developers → Webhooks → Add endpoint:
- URL: https://warmup-api-production.up.railway.app/api/billing/webhook
- Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
- Copy Signing secret → STRIPE_WEBHOOK_SECRET

---

## Step 3: Resend

Go to resend.com → sign up free → API Keys → create key
- Copy RESEND_API_KEY
- Choose FROM_EMAIL (e.g. hello@yourdomain.com)

---

## Step 4: Set Variables on Railway

Open: https://railway.com/project/3e56a3a4-de7b-411e-8497-29e8ffcc28da

Click warmup-api → Variables tab → set these:

    ANTHROPIC_FREE_KEY=sk-ant-...
    ANTHROPIC_PAID_KEY=sk-ant-...
    STRIPE_SECRET_KEY=sk_live_...
    STRIPE_WEBHOOK_SECRET=whsec_...
    STRIPE_STARTER_PRICE_ID=price_...
    STRIPE_PRO_PRICE_ID=price_...
    STRIPE_BYOK_PRICE_ID=price_...
    RESEND_API_KEY=re_...
    FROM_EMAIL=hello@yourdomain.com
    ADMIN_EMAIL=your@email.com

These are already set (don't change):
    DATABASE_URL, REDIS_URL, JWT_SECRET, HMAC_SHARED_SECRET,
    NODE_ENV, PORT, JWT_EXPIRY, FREE_KEY_DAILY_LIMIT_CENTS,
    PAID_KEY_DAILY_LIMIT_CENTS, CORS_ORIGINS

Railway auto-redeploys after saving variables.

---

## Step 5: Chrome Extension - Publish

A) Get HMAC_SHARED_SECRET value from Railway → warmup-api → Variables

B) Edit extension/src/shared/constants.js:
    - Set API_URL to https://warmup-api-production.up.railway.app
    - Set HMAC_SECRET to the value from step A

C) Convert SVG icons to PNG:
    - extension/public/icons/ has SVG placeholders
    - Convert to icon-16.png, icon-48.png, icon-128.png
    - Use any online SVG→PNG converter

D) Zip the extension/ folder

E) Go to chrome.google.com/webstore/devconsole
    - New item → upload zip
    - Name: Warmup - Daily LinkedIn Coach
    - Description: Your daily 5-minute LinkedIn growth routine. AI-powered coaching, zero automation.
    - Category: Productivity
    - Add screenshots
    - Submit for review

F) After approval, copy Extension ID and update on Railway:
    CORS_ORIGINS=chrome-extension://YOUR_EXTENSION_ID,https://warmup.li

---

## Step 6: Landing Page (optional)

Option A - Cloudflare Pages:
    1. dash.cloudflare.com → Pages → Create project
    2. Connect GitHub repo warmup-linkedincoach
    3. Root directory: landing-page
    4. Build command: npm run build
    5. Output directory: dist

Option B - Skip for now, use Railway URL directly.

---

## Step 7: Domain (optional)

If you buy a domain:
    1. Point api.yourdomain.com → Railway custom domain
    2. Point yourdomain.com → Cloudflare Pages
    3. Update CORS_ORIGINS and API_URL in extension

---

## Verification

After setup, test:
    1. Visit https://warmup-api-production.up.railway.app/health → should return {"status":"ok"}
    2. Install extension locally, create account
    3. Check email for verification link
    4. Log in, try AI suggestions
    5. Test Stripe upgrade flow
