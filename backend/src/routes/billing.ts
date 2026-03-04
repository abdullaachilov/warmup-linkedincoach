import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-01-27.acacia' as any });

const router = Router();

router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { priceId } = req.body;
    if (!priceId) {
      res.status(400).json({ error: 'Price ID required.' });
      return;
    }

    // Get or create Stripe customer
    const userResult = await db.query('SELECT email, stripe_customer_id FROM users WHERE id = $1', [req.userId]);
    const user = userResult.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: req.userId! } });
      customerId = customer.id;
      await db.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.userId]);
    }

    // Determine if one-time (BYOK) or subscription
    const isBYOK = priceId === process.env.STRIPE_BYOK_PRICE_ID;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: isBYOK ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || 'https://warmup.li'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'https://warmup.li'}/pricing`,
      metadata: { userId: req.userId! },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

router.post('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const userResult = await db.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.userId]);
    const user = userResult.rows[0];
    if (!user?.stripe_customer_id) {
      res.status(400).json({ error: 'No billing account found.' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.APP_URL || 'https://warmup.li'}/settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session.' });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    res.status(500).json({ error: 'Webhook not configured.' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed');
    res.status(400).json({ error: 'Invalid signature.' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        if (session.mode === 'payment') {
          // BYOK one-time purchase
          await db.query(
            'UPDATE users SET tier = $1, byok_enabled = TRUE, updated_at = NOW() WHERE id = $2',
            ['byok', userId]
          );
        } else if (session.subscription) {
          // Subscription
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0]?.price.id;
          let tier = 'starter';
          if (priceId === process.env.STRIPE_PRO_PRICE_ID) tier = 'pro';

          await db.query(
            'UPDATE users SET tier = $1, stripe_subscription_id = $2, updated_at = NOW() WHERE id = $3',
            [tier, subscription.id, userId]
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price.id;
        let tier = 'starter';
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) tier = 'pro';

        await db.query(
          'UPDATE users SET tier = $1, updated_at = NOW() WHERE stripe_customer_id = $2',
          [tier, customerId]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await db.query(
          'UPDATE users SET tier = $1, stripe_subscription_id = NULL, updated_at = NOW() WHERE stripe_customer_id = $2',
          ['free', customerId]
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        console.warn(`Payment failed for customer ${customerId}`);
        // Grace period - don't downgrade immediately
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT tier, stripe_subscription_id, byok_enabled FROM users WHERE id = $1',
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({
      tier: user.tier,
      hasSubscription: !!user.stripe_subscription_id,
      byokEnabled: user.byok_enabled,
    });
  } catch (err) {
    console.error('Billing status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
