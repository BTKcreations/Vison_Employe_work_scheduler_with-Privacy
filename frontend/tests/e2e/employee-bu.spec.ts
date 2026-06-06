import { test, expect } from '@playwright/test';
import { BACKEND_URL, ensureBstkAdminLoggedIn, setBstkAdminInBrowser } from './helpers';

test.describe('Employee + Business Unit scoping (UI + API)', () => {
  test('employee pinned to a branch is filtered by active BU in the admin UI', async ({ page }) => {
    const { token: adminToken, tempPassword } = await ensureBstkAdminLoggedIn();
    await setBstkAdminInBrowser(page, tempPassword);

    const branchStamp = Date.now().toString().slice(-7);
    const newBranchName = `PW Emp Branch ${branchStamp}`;

    const buRes = await fetch(`${BACKEND_URL}/business-units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: newBranchName, type: 'branch', code: `PW-EMP-${branchStamp}` }),
    });
    expect(buRes.ok).toBeTruthy();
    const created = await buRes.json();
    const branchId = created.id as string;

    const email = `pwemp_${branchStamp}@bstk.in`;
    const fullName = `PW Emp ${branchStamp}`;
    const empRes = await fetch(`${BACKEND_URL}/admin/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: fullName,
        email,
        password: 'PWTest@2026',
        role: 'manager',
        mobile: '9999999999',
        business_unit_id: branchId,
      }),
    });
    if (!empRes.ok) {
      const errBody = await empRes.text();
      throw new Error(`employee create failed: ${empRes.status} ${errBody}`);
    }
    const empCreated = await empRes.json();

    const aggregateRes = await fetch(`${BACKEND_URL}/admin/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const aggregate = await aggregateRes.json();
    const aggregateMatch = (aggregate as Array<{ id: string; email: string }>).find((e) => e.id === empCreated.id);
    expect(aggregateMatch).toBeTruthy();
    expect(aggregateMatch?.email).toBe(email);

    const hqRes = await fetch(`${BACKEND_URL}/admin/employees`, {
      headers: { Authorization: `Bearer ${adminToken}`, 'X-Active-Business-Unit-Id': branchId },
    });
    const hqList = await hqRes.json();
    const hqMatch = (hqList as Array<{ id: string; email: string }>).find((e) => e.id === empCreated.id);
    expect(hqMatch).toBeTruthy();

    const otherBranch = (await (await fetch(`${BACKEND_URL}/business-units`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })).json()).items.find((u: { id: string; type: string; is_default: boolean }) => u.id !== branchId && u.type === 'branch' && !u.is_default);

    if (otherBranch) {
      const otherRes = await fetch(`${BACKEND_URL}/admin/employees`, {
        headers: { Authorization: `Bearer ${adminToken}`, 'X-Active-Business-Unit-Id': otherBranch.id },
      });
      const otherList = await otherRes.json();
      const otherMatch = (otherList as Array<{ id: string }>).find((e) => e.id === empCreated.id);
      expect(otherMatch).toBeFalsy();
    }

    await page.goto('/admin/employees');
    await expect(page.getByRole('heading', { name: /Employees/i })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('tr', { hasText: fullName })).toBeVisible({ timeout: 10_000 });

    const switcher = page.locator('header button').filter({ hasText: /All Units|Head Office|PW Branch|Smoke Branch|Branch/ }).first();
    await expect(switcher).toBeVisible({ timeout: 10_000 });
    await switcher.click();
    const branchOption = page.getByRole('button', { name: new RegExp(`^${newBranchName} branch$`) });
    await expect(branchOption).toBeAttached({ timeout: 10_000 });
    await branchOption.evaluate((el) => (el as HTMLButtonElement).click());
    await page.waitForTimeout(2000);
    await expect(page.locator('tr', { hasText: fullName })).toBeVisible({ timeout: 10_000 });
  });
});
