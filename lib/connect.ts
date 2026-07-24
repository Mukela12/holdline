import { stripe } from '@/lib/stripe';

export async function createRecipientAccount(email: string, displayName: string) {
  const account = await stripe.v2.core.accounts.create({
    contact_email: email,
    display_name: displayName,
    dashboard: 'express',
    identity: {
      country: 'US',
      entity_type: 'individual',
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    defaults: {
      currency: 'usd',
      responsibilities: {
        fees_collector: 'stripe',
        losses_collector: 'stripe',
      },
    },
  });

  return account;
}

export async function createOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string) {
  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['recipient'],
        return_url: returnUrl,
        refresh_url: refreshUrl,
      },
    },
  });

  return link;
}
