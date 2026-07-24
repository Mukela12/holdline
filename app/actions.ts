'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { createOnboardingLink, createRecipientAccount } from '@/lib/connect';

async function baseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  const h = await headers();
  const host = h.get('host');
  const protocol = host?.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export async function createGig(formData: FormData) {
  const clientId = String(formData.get('clientId'));
  const proId = String(formData.get('proId'));
  const title = String(formData.get('title'));
  const description = String(formData.get('description'));
  const milestoneTitle = String(formData.get('milestoneTitle'));
  const amountDollars = Number(formData.get('amountDollars'));

  await prisma.gig.create({
    data: {
      title,
      description,
      clientId,
      proId,
      milestones: {
        create: [{ title: milestoneTitle, amountCents: Math.round(amountDollars * 100) }],
      },
    },
  });

  revalidatePath(`/client/${clientId}`);
  redirect(`/client/${clientId}`);
}

export async function fundMilestone(milestoneId: string, clientId: string) {
  const milestone = await prisma.milestone.findUniqueOrThrow({
    where: { id: milestoneId },
    include: { gig: { include: { pro: true } } },
  });

  const origin = await baseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: milestone.title,
            description: `${milestone.gig.title} — held in escrow until the client approves the milestone.`,
          },
          unit_amount: milestone.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: { milestoneId },
    success_url: `${origin}/client/${clientId}?funded=${milestoneId}`,
    cancel_url: `${origin}/client/${clientId}`,
  });

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { stripeCheckoutId: session.id },
  });

  redirect(session.url!);
}

export async function releaseMilestone(milestoneId: string, clientId: string) {
  const milestone = await prisma.milestone.findUniqueOrThrow({
    where: { id: milestoneId },
    include: { gig: { include: { pro: true } } },
  });

  if (milestone.status !== 'FUNDED') {
    throw new Error('Milestone must be funded before it can be released.');
  }
  if (!milestone.gig.pro?.stripeAccountId || !milestone.gig.pro.stripeOnboarded) {
    throw new Error('The pro has not finished connecting a payout account yet.');
  }

  const proShareCents = Math.round((milestone.amountCents * (10000 - milestone.platformFeeBps)) / 10000);
  const platformFeeCents = milestone.amountCents - proShareCents;

  const transfer = await stripe.transfers.create({
    amount: proShareCents,
    currency: 'usd',
    destination: milestone.gig.pro.stripeAccountId,
    metadata: { milestoneId },
  });

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      status: 'RELEASED',
      stripeTransferId: transfer.id,
      releasedAt: new Date(),
      events: {
        create: {
          type: 'RELEASED',
          detail: `Client approved the milestone. $${(proShareCents / 100).toFixed(2)} transferred to ${milestone.gig.pro.name}, $${(platformFeeCents / 100).toFixed(2)} platform fee retained.`,
        },
      },
    },
  });

  revalidatePath(`/client/${clientId}`);
  revalidatePath(`/pro/${milestone.gig.pro.id}`);
}

export async function connectProAccount(proId: string) {
  const pro = await prisma.user.findUniqueOrThrow({ where: { id: proId } });
  const origin = await baseUrl();

  let accountId = pro.stripeAccountId;
  if (!accountId) {
    const account = await createRecipientAccount(pro.email, pro.name);
    accountId = account.id;
    await prisma.user.update({ where: { id: proId }, data: { stripeAccountId: accountId } });
  }

  const link = await createOnboardingLink(
    accountId,
    `${origin}/pro/${proId}?onboarded=1`,
    `${origin}/pro/${proId}`,
  );

  redirect(link.url);
}

export async function checkProOnboardingStatus(proId: string) {
  const pro = await prisma.user.findUniqueOrThrow({ where: { id: proId } });
  if (!pro.stripeAccountId) return false;

  const account = await stripe.v2.core.accounts.retrieve(pro.stripeAccountId);
  const transfersCapability =
    account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
  const active = transfersCapability?.status === 'active';

  if (active && !pro.stripeOnboarded) {
    await prisma.user.update({ where: { id: proId }, data: { stripeOnboarded: true } });
  }

  return active;
}
