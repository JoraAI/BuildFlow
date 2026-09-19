import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8081';

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name, page.url(), fs.statSync(file).size);
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(60000);

try {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot(page, '01-login');

  // RN-web inputs: fill by placeholder
  await page.getByPlaceholder(/you@company|9876543210/i).fill('owner@reddyconst.com');
  await page.getByText(/^Send OTP$/i).click();
  await page.waitForTimeout(2000);
  await page.getByPlaceholder(/6-digit/i).fill('111111');
  await shot(page, '01b-login-filled');

  // Desktop Sign In is in the footer
  await page.getByText(/^Sign In$/i).last().click();
  await page.waitForTimeout(5000);

  // Wait until we leave login
  for (let i = 0; i < 20; i++) {
    if (!page.url().includes('/login')) break;
    await page.waitForTimeout(500);
  }
  console.log('post-login url', page.url());
  await shot(page, '02-after-login');

  if (page.url().includes('/login')) {
    // Fallback: inject tokens via API then reload
    const loginRes = await page.evaluate(async () => {
      const r = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@reddyconst.com', otp: '111111' }),
      });
      return r.json();
    });
    const data = loginRes.data || loginRes;
    console.log('api login keys', Object.keys(data), data.user?.role);
    // Expo SecureStore on web often uses localStorage
    await page.evaluate((payload) => {
      const user = JSON.stringify(payload.user || payload);
      const access = payload.accessToken;
      const refresh = payload.refreshToken;
      localStorage.setItem('bf_access_token', access);
      localStorage.setItem('bf_refresh_token', refresh || '');
      localStorage.setItem('bf_user', user);
      // common expo-secure-store web prefixes
      for (const k of ['bf_access_token', 'bf_refresh_token', 'bf_user']) {
        localStorage.setItem(`SecureStore-${k}`, localStorage.getItem(k));
      }
      sessionStorage.setItem('bf_access_token', access);
      sessionStorage.setItem('bf_user', user);
    }, data);
    await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    console.log('token inject url', page.url());
    await shot(page, '02-after-login');
  }

  const routes = [
    ['03-dashboard', '/dashboard'],
    ['04-projects', '/projects'],
    ['05-accounting', '/accounting'],
    ['06-reports', '/reports'],
    ['07-reports-hub', '/reports-hub'],
    ['08-proposals', '/proposals'],
    ['09-planning', '/planning'],
    ['10-settings', '/settings'],
    ['11-settings-users', '/settings/users'],
    ['12-settings-permissions', '/settings/permissions'],
  ];

  for (const [name, route] of routes) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await shot(page, name);
  }

  // Open NH-45 from projects list
  await page.goto(BASE + '/projects', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const nh = page.getByText(/NH-45/i).first();
  if (await nh.count()) {
    await nh.click();
    await page.waitForTimeout(4000);
  }
  await shot(page, '13-project-overview');
  console.log('project url', page.url());

  const m = page.url().match(/projects\/([^/?#]+)/);
  const pid = m?.[1];
  if (pid && pid !== 'create') {
    // Click through common tabs by label
    for (const [name, label] of [
      ['14-tab-boq', 'BOQ'],
      ['15-tab-estimates', 'Estimates'],
      ['16-tab-procurement', 'Procurement'],
      ['17-tab-variations', 'Variations'],
      ['18-tab-drawings', 'Drawings'],
      ['19-tab-bills', 'Bills'],
      ['20-tab-snags', 'Snags'],
    ]) {
      const tab = page.getByText(new RegExp(`^${label}$`, 'i')).first();
      if (await tab.count()) {
        await tab.click();
        await page.waitForTimeout(2500);
        await shot(page, name);
      }
    }
  }
} catch (e) {
  console.error('SCRIPT_ERROR', e);
  await shot(page, '99-error').catch(() => {});
} finally {
  await browser.close();
}
