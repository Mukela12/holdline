import { stripe } from '@/lib/stripe';

export async function createRecipientAccount(email: string, displayName: string) {
  const account = await stripe.accounts.create({
    country: 'US',
    email,
    business_type: 'individual',
    business_profile: {
      name: displayName,
      mcc: '7392', // consulting services
      product_description: 'Freelance software development milestone payouts',
    },
    capabilities: {
      transfers: { requested: true },
    },
    controller: {
      stripe_dashboard: { type: 'express' },
      fees: { payer: 'application' },
      losses: { payments: 'application' },
      requirement_collection: 'stripe',
    },
  });

  return account;
}

export async function createOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string) {
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });

  return link;
}
