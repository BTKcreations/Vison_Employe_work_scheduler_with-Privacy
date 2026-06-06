import { test, expect } from '@playwright/test';
import { TENANTS, setOwnerInBrowser } from './helpers';

test.describe('Owner: tenant detail and business units', () => {
  test('owner can see Business Units section on tenant detail page', async ({ page }) => {
    await setOwnerInBrowser(page);
    await page.goto(`/owner/tenants/${TENANTS.bstk.id}`);
    const sectionHeading = page.getByRole('heading', { name: /Business Units/i });
    await expect(sectionHeading).toBeVisible({ timeout: 10_000 });
    const sectionText = await page.locator('section, div').filter({ hasText: 'Business Units' }).filter({ has: page.getByText('Head Office', { exact: false }) }).first().innerText().catch(() => '');
    const allText = await page.locator('body').innerText();
    expect(allText).toMatch(/Head Office/i);
  });

  test('owner is redirected to /owner/login when not authenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('access_token');
        window.localStorage.removeItem('user');
        window.localStorage.removeItem('active_business_unit_id');
        window.localStorage.removeItem('owner_access_token');
        window.localStorage.removeItem('platform_owner');
      }
    }).catch(() => undefined);
    await page.goto(`/owner/tenants/${TENANTS.bstk.id}`);
    await expect(page).toHaveURL(/\/owner\/login/);
  });
});
