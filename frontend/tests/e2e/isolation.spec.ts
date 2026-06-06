import { test, expect } from '@playwright/test';
import { ensureBstkAdminLoggedIn, setBstkAdminInBrowser } from './helpers';

test.describe('Tenant isolation in the UI', () => {
  test('BSTK admin only sees their own employees and business units', async ({ page }) => {
    const { tempPassword } = await ensureBstkAdminLoggedIn();
    await setBstkAdminInBrowser(page, tempPassword);

    await page.goto('/admin/settings/business-units');
    await expect(page.getByRole('heading', { name: /Business Units/i })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    const bodyText = await page.locator('main').innerText();
    expect(bodyText).toMatch(/Head Office/i);
    const isoBstkUnits = await page.getByRole('heading', { name: 'Head Office' }).count();
    expect(isoBstkUnits).toBeGreaterThanOrEqual(1);

    await page.goto('/admin/employees');
    await expect(page.getByRole('heading', { name: /Employees/i })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    const empBodyText = await page.locator('main').innerText();
    expect(empBodyText.toLowerCase()).not.toMatch(/acme/);
  });

  test('cross-tenant BU id in header returns 400 (verified via API)', async ({ request }) => {
    const { ownerLogin, TENANTS } = await import('./helpers');
    const ownerToken = await ownerLogin();

    const { tempPassword } = await ensureBstkAdminLoggedIn();
    const bstkToken = await (await fetch('http://127.0.0.1:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TENANTS.bstk.adminEmail, password: tempPassword }),
    })).json().then((d) => d.access_token);

    const acmeListRes = await request.get(`http://127.0.0.1:8000/platform/tenants/${TENANTS.acme.id}/business-units`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(acmeListRes.ok()).toBeTruthy();
    const acmeList = await acmeListRes.json();
    const acmeUnits = (acmeList.items as Array<{ id: string }>);
    expect(acmeUnits.length).toBeGreaterThan(0);
    const acmeHqId = acmeUnits[0].id;

    const res = await request.get('http://127.0.0.1:8000/admin/employees', {
      headers: { Authorization: `Bearer ${bstkToken}`, 'X-Active-Business-Unit-Id': acmeHqId },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.detail).toMatch(/business unit does not belong/i);
  });
});
