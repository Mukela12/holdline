import { test, expect } from '@playwright/test';

/**
 * End-to-end verification of the real escrow mechanism against the live deployment.
 * Runs against a real Postgres database and real Stripe test-mode API calls, not mocks.
 *
 * Prerequisite (one-time, already done for this environment): the platform's test-mode
 * available balance must cover the transfer amount, since card charges settle into a
 * pending balance first. See Stripe's `balance_insufficient` error for the fix (charge
 * the `tok_bypassPending` test token once to top up available balance).
 *
 * Prerequisite: at least one seeded Pro must have completed real Stripe Connect
 * onboarding by hand (the phone-verification step is behind hCaptcha and cannot be
 * automated, by design). This suite assumes that Pro already shows "Connected".
 */

test.describe('Holdline escrow flow (live)', () => {
  test('landing page lists seeded clients and pros', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('90/10');
    const clientLinks = page.locator('a[href^="/client/"]');
    const proLinks = page.locator('a[href^="/pro/"]');
    await expect(clientLinks.first()).toBeVisible();
    await expect(proLinks.first()).toBeVisible();
  });

  test('client can fund a draft milestone via real Stripe Checkout and it holds in escrow', async ({ page }) => {
    await page.goto('/');
    const clientHref = await page.locator('a[href^="/client/"]').first().getAttribute('href');
    await page.goto(clientHref!);

    const fundButton = page.getByRole('button', { name: /fund via stripe checkout/i }).first();
    test.skip((await fundButton.count()) === 0, 'No draft milestone available to fund in current seed state.');

    const milestoneCard = fundButton.locator('xpath=ancestor::div[contains(@class, "border")][1]');
    const milestoneTitle = await milestoneCard.locator('span.font-medium').first().textContent();

    await Promise.all([page.waitForNavigation({ timeout: 20000 }), fundButton.click()]);
    expect(page.url()).toContain('checkout.stripe.com');

    await page.fill('input[name="email"]', 'qa@holdline.test');
    await page.fill('input[name="cardNumber"]', '4242424242424242');
    await page.fill('input[name="cardExpiry"]', '12/34');
    await page.fill('input[name="cardCvc"]', '123');
    await page.fill('input[name="billingName"]', 'QA Test');

    const payButton = page.getByRole('button', { name: /^pay/i });
    await Promise.all([
      page.waitForURL(/holdline/, { timeout: 30000 }),
      payButton.click(),
    ]);

    // Webhook is async relative to the redirect; poll briefly for the status flip.
    await expect(async () => {
      await page.reload();
      const badge = page.locator(`text=${milestoneTitle}`).locator('xpath=ancestor::div[contains(@class,"border")][1]').getByText(/held in escrow/i);
      await expect(badge).toBeVisible();
    }).toPass({ timeout: 15000 });
  });

  test('client can approve a funded milestone and the pro is paid via a real transfer', async ({ page }) => {
    await page.goto('/');
    const clientHref = await page.locator('a[href^="/client/"]').first().getAttribute('href');
    await page.goto(clientHref!);

    const releaseButton = page.getByRole('button', { name: /approve & release payment/i }).first();
    test.skip((await releaseButton.count()) === 0, 'No funded milestone available to release in current seed state.');

    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 20000 }),
      releaseButton.click(),
    ]);

    await expect(page.getByText(/released/i).first()).toBeVisible();
    await expect(page.getByText(/transferred to/i).first()).toBeVisible();
  });

  test('no console errors across landing, client, and pro dashboards', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    const clientHref = await page.locator('a[href^="/client/"]').first().getAttribute('href');
    const proHref = await page.locator('a[href^="/pro/"]').first().getAttribute('href');
    await page.goto(clientHref!);
    await page.goto(proHref!);

    expect(errors, `Console/page errors found: ${JSON.stringify(errors)}`).toEqual([]);
  });
});
