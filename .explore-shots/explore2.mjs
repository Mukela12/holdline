import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://holdline.vercel.app/pro/cmryz3da40003tev3cu2wblqk');
await page.screenshot({ path: '.explore-shots/02-pro-dashboard.png', fullPage: true });

const connectBtn = page.getByRole('button', { name: /connect payout account/i });
await connectBtn.click();
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);
console.log('URL after click:', page.url());
await page.screenshot({ path: '.explore-shots/03-stripe-onboarding-start.png', fullPage: true });

const bodyText = await page.textContent('body');
console.log('ONBOARDING TEXT:', bodyText.slice(0, 1000));

await browser.close();
