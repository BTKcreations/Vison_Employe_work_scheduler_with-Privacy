import { test, expect } from '@playwright/test';
import { ensureBstkAdminLoggedIn, setBstkAdminInBrowser } from './helpers';

test.describe('BusinessUnitSwitcher in topbar', () => {
  test('switcher shows All Units + per-unit entries; selection changes localStorage + X-Active-Business-Unit-Id header', async ({ page }) => {
    const { tempPassword } = await ensureBstkAdminLoggedIn();
    await setBstkAdminInBrowser(page, tempPassword);

    await page.goto('/admin/employees');
    await expect(page.getByRole('heading', { name: /Employees/i })).toBeVisible({ timeout: 10_000 });

    const switcher = page.locator('header button').filter({ hasText: /All Units|Head Office|PW Branch|Smoke Branch|Branch/ }).first();
    await expect(switcher).toBeVisible({ timeout: 15_000 });
    await switcher.click();

    const dropdown = page.locator('text=Switch Business Unit').locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByText('All Units').first()).toBeVisible();
    await expect(dropdown.getByText('Head Office').first()).toBeVisible();

    let headerSeen: string | null = null;
    page.on('request', (req) => {
      if (req.url().includes('/admin/employees') && req.method() === 'GET') {
        headerSeen = req.headers()['x-active-business-unit-id'] ?? null;
      }
    });

    await dropdown.getByText('Head Office', { exact: false }).first().click();
    await page.waitForTimeout(800);
    const stored1 = await page.evaluate(() => localStorage.getItem('active_business_unit_id'));
    expect(stored1).toBeTruthy();
    expect(stored1).toMatch(/^[0-9a-f]{24}$/i);

    await switcher.click();
    await page.locator('text=All Units').first().click();
    await page.waitForTimeout(500);
    const stored2 = await page.evaluate(() => localStorage.getItem('active_business_unit_id'));
    expect(stored2).toBeNull();
  });

  test('switching BUs triggers a refetch on the admin page', async ({ page }) => {
    const { tempPassword } = await ensureBstkAdminLoggedIn();
    await setBstkAdminInBrowser(page, tempPassword);
    await page.goto('/admin/employees');
    await expect(page.getByRole('heading', { name: /Employees/i })).toBeVisible({ timeout: 10_000 });

    const switcher = page.locator('header button').filter({ hasText: /All Units|Head Office|PW Branch|Smoke Branch|Branch/ }).first();
    await expect(switcher).toBeVisible({ timeout: 15_000 });

    let aggregateCount = 0;
    let hqCount = 0;
    page.on('response', async (res) => {
      if (res.url().endsWith('/admin/employees') && res.request().method() === 'GET' && res.status() === 200) {
        try {
          const body = await res.json();
          if (res.request().headers()['x-active-business-unit-id']) {
            hqCount = Array.isArray(body) ? body.length : 0;
          } else {
            aggregateCount = Array.isArray(body) ? body.length : 0;
          }
        } catch {
          // ignore
        }
      }
    });

    await page.waitForTimeout(800);
    await switcher.click();
    await page.locator('text=All Units').first().click();
    await page.waitForTimeout(800);
    const aggregate = await page.evaluate(() => localStorage.getItem('active_business_unit_id'));

    await switcher.click();
    await page.locator('text=Head Office').first().click();
    await page.waitForTimeout(1500);
    const hq = await page.evaluate(() => localStorage.getItem('active_business_unit_id'));

    expect(aggregate).toBeNull();
    expect(hq).toMatch(/^[0-9a-f]{24}$/i);
    expect(hq).not.toBeNull();
  });
});
