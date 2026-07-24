import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Webhook signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const milestoneId = session.metadata?.milestoneId;

    if (milestoneId) {
      const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
      if (milestone && milestone.status === 'DRAFT') {
        await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status: 'FUNDED',
            fundedAt: new Date(),
            stripePaymentIntentId:
              typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
            events: {
              create: {
                type: 'FUNDED',
                detail: `Client funded $${((session.amount_total ?? 0) / 100).toFixed(2)} via Stripe Checkout. Held on the platform pending approval.`,
              },
            },
          },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
