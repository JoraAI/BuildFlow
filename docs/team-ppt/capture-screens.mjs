/**
 * Capture BuildFlow web + mobile viewport screenshots for the team PPT.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshots');
const BASE = process.env.BF_BASE || 'http://localhost:8081';
const API = process.env.BF_API || 'http://localhost:4000/api';

fs.mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function waitReady(page) {
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name);
}

async function clearSession(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await page.context().clearCookies();
}

async function injectCompanySession(page, email, otp = '111111') {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { email, otp },
  });
  if (!res.ok()) {
    throw new Error(`API login failed for ${email}: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const data = body.data;
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((payload) => {
    localStorage.setItem('buildflow_secure_bf_access_token', payload.accessToken);
    localStorage.setItem('buildflow_secure_bf_refresh_token', payload.refreshToken);
    localStorage.setItem('buildflow_secure_bf_user', JSON.stringify(payload.user));
  }, data);
  const dest = data.user.productMode === 'inventory' ? '/inventory' : '/dashboard';
  await page.goto(`${BASE}${dest}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitReady(page);
  // If hydrate redirected back to login, fall back to UI login
  if (page.url().includes('/login')) {
    await page.locator('input').first().fill(email);
    await page.locator('input').nth(1).fill(otp);
    await page.getByText('Sign In', { exact: true }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45000 });
    await waitReady(page);
  }
}

async function loginPlatform(page) {
  await clearSession(page);
  await page.goto(`${BASE}/platform/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitReady(page);
  await page.getByLabel(/^email$/i).fill('admin@buildflow.com');
  await page.getByLabel(/^password$/i).fill('Admin@1234');
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForURL((u) => u.pathname.includes('/platform') && !u.pathname.includes('login'), {
    timeout: 45000,
  });
  await waitReady(page);
}

async function captureRoutes(page, routes, prefix) {
  for (const [route, slug] of routes) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitReady(page);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(400);
      // Skip if bounced to login
      if (page.url().includes('/login')) {
        console.warn('SKIP (auth)', prefix, slug);
        continue;
      }
      await shot(page, `${prefix}_${slug}`);
    } catch (e) {
      console.warn('FAIL', prefix, slug, e.message);
    }
  }
}

async function runViewport(browser, viewport, tag) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: tag === 'mobile' ? 2 : 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  // Public / marketing
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await shot(page, `${tag}_public_home`);

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await shot(page, `${tag}_login`);

  // Platform admin
  await loginPlatform(page);
  await shot(page, `${tag}_platform_home`);
  await captureRoutes(
    page,
    [
      ['/platform/companies', 'platform_companies'],
      ['/platform/tickets', 'platform_tickets'],
    ],
    tag,
  );

  // Construction ERP (Owner)
  await clearSession(page);
  await injectCompanySession(page, 'owner@reddyconst.com');
  await shot(page, `${tag}_construction_dashboard`);
  await captureRoutes(
    page,
    [
      ['/projects', 'construction_projects'],
      ['/proposals', 'construction_proposals'],
      ['/planning', 'construction_planning'],
      ['/reports', 'construction_reports'],
      ['/accounting', 'construction_accounting'],
      ['/reports-hub', 'construction_reports_hub'],
      ['/notifications', 'construction_notifications'],
      ['/settings', 'construction_settings'],
      ['/settings/users', 'construction_users'],
      ['/settings/permissions', 'construction_permissions'],
      ['/estimation', 'construction_estimation'],
    ],
    tag,
  );
  // Assistant is an overlay (legacy /chat redirects and can error in capture)
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitReady(page);
    const gotIt = page.getByText('Got it', { exact: true });
    if (await gotIt.count()) await gotIt.first().click().catch(() => {});
    await page.getByLabel('Open BuildFlow Assistant').click({ timeout: 10000 });
    await page.getByText('BuildFlow Assistant').waitFor({ timeout: 15000 });
    await page.waitForTimeout(3000);
    await shot(page, `${tag}_construction_assistant`);
  } catch (e) {
    console.warn('FAIL', tag, 'construction_assistant', e.message);
  }

  // Inventory (Owner - materials supplier)
  await clearSession(page);
  await injectCompanySession(page, 'owner@hydmaterials.com');
  await shot(page, `${tag}_inventory_stock`);
  await captureRoutes(
    page,
    [
      ['/inventory/materials', 'inventory_materials'],
      ['/inventory/parties', 'inventory_parties'],
      ['/inventory/quotes', 'inventory_quotes'],
      ['/inventory/sales', 'inventory_sales'],
      ['/inventory/warehouse', 'inventory_warehouse'],
      ['/inventory/procurement', 'inventory_procurement'],
      ['/inventory/invoices', 'inventory_invoices'],
      ['/inventory/bills', 'inventory_bills'],
      ['/inventory/reports', 'inventory_reports'],
      ['/inventory/settings', 'inventory_settings'],
    ],
    tag,
  );

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  console.log('Capturing desktop...');
  await runViewport(browser, DESKTOP, 'web');
  console.log('Capturing mobile...');
  await runViewport(browser, MOBILE, 'mobile');
  console.log('Done. Files in', OUT);
  console.log(fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length, 'pngs');
} finally {
  await browser.close();
}
