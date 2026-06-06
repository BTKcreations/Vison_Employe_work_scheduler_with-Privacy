import { test, expect } from '@playwright/test';
import { ensureBstkAdminLoggedIn, setBstkAdminInBrowser } from './helpers';

test.describe('Tenant admin: Business Units settings page', () => {
  test('list, create, edit, deactivate a business unit; default cannot be deactivated', async ({ page }) => {
    const { tempPassword } = await ensureBstkAdminLoggedIn();
    await setBstkAdminInBrowser(page, tempPassword);

    await page.goto('/admin/settings/business-units');
    await expect(page.getByRole('heading', { name: /^Business Units$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Head Office', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Default', { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    const defaultCount = await page.getByText('Default', { exact: false }).count();
    expect(defaultCount).toBeGreaterThan(0);

    const stamp = Date.now().toString().slice(-7);
    const branchName = `PW Branch ${stamp}`;

    await page.getByRole('button', { name: /New Business Unit/i }).click();
    const modalHeading = page.getByRole('heading', { name: /^New Business Unit$/i });
    await expect(modalHeading).toBeVisible();

    const dialog = page.locator('form').filter({ has: page.getByRole('button', { name: /^Create$/i }) });
    await dialog.locator('input[type="text"]').first().fill(branchName);
    await dialog.locator('select').first().selectOption('branch');
    await dialog.locator('input[type="text"]').nth(1).fill(`PW-${stamp}`);

    await page.getByRole('button', { name: /^Create$/i }).click();
    await expect(page.getByRole('heading', { name: branchName })).toBeVisible({ timeout: 10_000 });

    const newCard = page.locator('h3', { hasText: branchName }).locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
    await expect(newCard).toBeVisible();
    await newCard.getByTitle('Edit').click();
    await expect(page.getByRole('heading', { name: new RegExp(`Edit ${branchName}`) })).toBeVisible();
    const editDialog = page.locator('form').filter({ has: page.getByRole('button', { name: /Save Changes/i }) });
    const descInput = editDialog.locator('textarea').first();
    await descInput.fill('Edited by Playwright');
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await expect(newCard.getByText('Edited by Playwright')).toBeVisible({ timeout: 10_000 });

    const showInactive = page.getByLabel(/Show inactive units/i);
    await showInactive.check();
    await expect(newCard).toBeVisible();

    await newCard.getByTitle('Deactivate').click();
    await expect(newCard.getByText('Inactive', { exact: false })).toBeVisible({ timeout: 10_000 });

    await showInactive.uncheck();
    await expect(newCard).toHaveCount(0);

    await showInactive.check();
    await expect(newCard).toBeVisible();

    const hqCard = page.locator('h3', { hasText: 'Head Office' }).first().locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
    const hqDeactivateBtn = hqCard.getByTitle('Deactivate');
    await expect(hqDeactivateBtn).toBeDisabled();
  });
});
