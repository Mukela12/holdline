import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://holdline.vercel.app/');
await page.screenshot({ path: '.explore-shots/01-landing.png', fullPage: true });

const text = await page.textContent('body');
console.log('LANDING TEXT SNIPPET:', text.slice(0, 400));

// Find pro links
const links = await page.$$eval('a', as => as.map(a => ({ href: a.getAttribute('href'), text: a.textContent })));
console.log('LINKS:', JSON.stringify(links, null, 2));

await browser.close();
