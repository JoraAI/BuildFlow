/**
 * Capture BuildFlow Owner screens for web (desktop) + mobile (iOS/Android emulation).
 */
import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'screenshots');
const WEB = path.join(ROOT, 'web');
const MOBILE = path.join(ROOT, 'mobile');
fs.mkdirSync(WEB, { recursive: true });
fs.mkdirSync(MOBILE, { recursive: true });

const BASE = 'http://localhost:8081';
const PROJECT = 'bd7944de-1b4f-4d18-821e-56171eda66a6';

async function shot(page, dir, name) {
  const file = path.join(dir, `${name}.png`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', path.basename(dir), name, page.url().replace(BASE, ''), fs.statSync(file).size);
}

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.getByPlaceholder(/you@company|9876543210/i).fill('owner@reddyconst.com');
  await page.getByText(/^Send OTP$/i).click();
  await page.waitForTimeout(1800);
  await page.getByPlaceholder(/6-digit/i).fill('111111');
  await shot(page, page._shotDir, '01-login');
  // Mobile Sign In is in-form; desktop is footer — click last matching
  await page.getByText(/^Sign In$/i).last().click();
  await page.waitForURL(/dashboard|projects|inventory/, { timeout: 45000 });
  await page.waitForTimeout(2800);
  const gotIt = page.getByText(/^Got it$/i);
  if (await gotIt.count()) {
    await gotIt.click();
    await page.waitForTimeout(600);
  }
}

async function captureSuite(page, dir, label) {
  page._shotDir = dir;
  console.log('\n===', label, '===');
  await login(page);
  await shot(page, dir, '02-home');

  const routes = [
    ['03-projects', '/projects'],
    ['04-accounting', '/accounting'],
    ['05-reports-hub', '/reports-hub'],
    ['06-proposals', '/proposals'],
    ['07-planning', '/planning'],
    ['08-settings', '/settings'],
    ['09-settings-users', '/settings/users'],
    ['10-project', `/projects/${PROJECT}`],
  ];
  for (const [name, route] of routes) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2800);
    if (await page.getByText(/^Got it$/i).count()) {
      await page.getByText(/^Got it$/i).click().catch(() => {});
    }
    await shot(page, dir, name);
  }

  await page.goto(BASE + `/projects/${PROJECT}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  for (const [name, labelText] of [
    ['11-boq', 'BOQ'],
    ['12-procurement', 'Procurement'],
    ['13-variations', 'Variations'],
    ['14-bills', 'Bills'],
  ]) {
    // On mobile, tabs may be in a horizontal scroller — try several strategies
    let clicked = false;
    const exact = page.getByText(new RegExp(`^${labelText}$`, 'i')).first();
    if (await exact.count()) {
      await exact.scrollIntoViewIfNeeded().catch(() => {});
      await exact.click().catch(() => {});
      clicked = true;
    }
    if (!clicked) {
      const soft = page.getByText(new RegExp(labelText, 'i')).first();
      if (await soft.count()) {
        await soft.click().catch(() => {});
        clicked = true;
      }
    }
    await page.waitForTimeout(2000);
    await shot(page, dir, name);
  }
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

// --- Web (desktop) ---
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(50000);
  await captureSuite(page, WEB, 'WEB desktop');
  await page.close();
}

// --- iOS (iPhone 14) ---
{
  const iphone = devices['iPhone 14'];
  const context = await browser.newContext({
    ...iphone,
    // Expo web still serves responsive layout
  });
  const page = await context.newPage();
  page.setDefaultTimeout(50000);
  await captureSuite(page, MOBILE, 'iOS iPhone 14');
  // Also copy key frames as ios-* aliases
  for (const f of fs.readdirSync(MOBILE).filter((x) => x.endsWith('.png'))) {
    fs.copyFileSync(path.join(MOBILE, f), path.join(MOBILE, `ios-${f}`));
  }
  await context.close();
}

// --- Android (Pixel 7) ---
{
  const androidDir = path.join(ROOT, 'android');
  fs.mkdirSync(androidDir, { recursive: true });
  const pixel = devices['Pixel 7'];
  const context = await browser.newContext({ ...pixel });
  const page = await context.newPage();
  page.setDefaultTimeout(50000);
  await captureSuite(page, androidDir, 'Android Pixel 7');
  await context.close();
}

await browser.close();
console.log('\nDONE all platforms');
