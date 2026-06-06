export const TENANTS = {
  bstk: { id: '6a215ffdf6d2ac752d1454f2', adminId: '6a215ffdf6d2ac752d1454f4', adminEmail: 'tharun@bstk.in' },
  acme: { id: '6a2163e6f6d2ac752d145523', adminId: '6a2163e6f6d2ac752d145525', adminEmail: 'shiva@company.com' },
} as const;

export const OWNER = { email: 'superadmin@bstk.in', password: 'Tharunkumar123@#!' };

export const BACKEND_URL = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:8000';

export interface LoginResult { token: string; tempPassword: string; }

export async function ownerLogin(): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER.email, password: OWNER.password }),
  });
  if (!res.ok) throw new Error(`owner login failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function resetTenantAdminPassword(tenantId: string, adminId: string): Promise<string> {
  const ownerToken = await ownerLogin();
  const res = await fetch(
    `${BACKEND_URL}/platform/tenants/${tenantId}/admins/${adminId}/reset-password`,
    { method: 'POST', headers: { Authorization: `Bearer ${ownerToken}` } },
  );
  if (!res.ok) throw new Error(`reset failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.temp_password as string;
}

export async function tenantAdminLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`tenant admin login failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function ensureBstkAdminLoggedIn(): Promise<LoginResult> {
  const temp = await resetTenantAdminPassword(TENANTS.bstk.id, TENANTS.bstk.adminId);
  const token = await tenantAdminLogin(TENANTS.bstk.adminEmail, temp);
  return { token, tempPassword: temp };
}

async function typeIntoReactInput(
  page: import('@playwright/test').Page,
  selector: string,
  value: string,
): Promise<void> {
  await page.evaluate(
    ({ sel, val }) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) throw new Error(`element not found: ${sel}`);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { sel: selector, val: value },
  );
  const v = await page.locator(selector).inputValue();
  if (v !== value) {
    throw new Error(`failed to set ${selector}: got "${v}", expected "${value}"`);
  }
}

async function waitForFormReady(page: import('@playwright/test').Page, selector: string): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) return false;
      const node = el as unknown as Record<string, unknown>;
      const keys = Object.keys(node);
      const allProps = Object.getOwnPropertyNames(node);
      return [...keys, ...allProps].some((k) => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'));
    },
    selector,
    { timeout: 20_000 },
  ).catch(() => undefined);
  await page.waitForTimeout(800);
}

export async function setOwnerInBrowser(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/owner/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#owner-login-email').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForFormReady(page, '#owner-login-email');
  await typeIntoReactInput(page, '#owner-login-email', OWNER.email);
  await typeIntoReactInput(page, '#owner-login-password', OWNER.password);
  await page.waitForTimeout(400);
  const navP = page.waitForURL(/\/owner\/dashboard/, { timeout: 20_000 });
  await page.locator('#owner-login-submit').click();
  await navP;
}

export async function setBstkAdminInBrowser(page: import('@playwright/test').Page, temp: string): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForFormReady(page, '#login-email');
  await typeIntoReactInput(page, '#login-email', TENANTS.bstk.adminEmail);
  await typeIntoReactInput(page, '#login-password', temp);
  await page.waitForTimeout(400);
  const navP = page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000 });
  await page.locator('#login-submit').click();
  await navP;
}
