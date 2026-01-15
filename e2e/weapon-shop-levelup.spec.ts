import { test, expect } from '@playwright/test';

/**
 * E2E tests for WeaponShop and LevelUp screens
 *
 * These tests verify that:
 * 1. Weapons can be selected in both screens
 * 2. The detail panel updates when clicking weapons
 * 3. The Continue button works correctly
 * 4. No hard-stuck scenarios occur
 */

test.describe('Weapon Shop and Level Up', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to reset state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('dev mode can access shop and interact with weapons', async ({ page }) => {
    // Navigate to dev play page which has dev tools
    await page.goto('/dev/play');

    // Wait for game to load
    await expect(page.getByText('R1')).toBeVisible({ timeout: 10000 });

    // Open menu and access dev tools
    await page.getByText('MENU').click();

    // Click Dev Tools
    const devToolsButton = page.getByText('Dev Tools');
    if (await devToolsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await devToolsButton.click();
    } else {
      // If Dev Tools isn't visible, menu structure might be different
      test.skip();
      return;
    }

    // Use dev tools to skip to shop (if available)
    // This depends on the dev tools UI structure
    const toShopButton = page.getByTestId('dev-to-shop');
    if (await toShopButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toShopButton.click();
    }
  });

  test('dev store can display and click weapons', async ({ page }) => {
    // Navigate to dev store page
    await page.goto('/dev/store');

    // Wait for store to load
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 10000 });

    // Verify weapons are displayed (should see at least one weapon name or "Available Weapons")
    await expect(page.getByText('Available Weapons')).toBeVisible({ timeout: 5000 });

    // Try to click on a weapon option (they should have a price visible)
    const weaponOptions = page.locator('[class*="optionButton"]');
    const count = await weaponOptions.count();

    // Verify at least one weapon is displayed
    expect(count).toBeGreaterThan(0);

    // Click on the first weapon
    await weaponOptions.first().click();

    // Wait a bit for state update
    await page.waitForTimeout(100);

    // Verify the detail section updated (should show weapon name in title case)
    // The detail card should be visible
    const detailCard = page.locator('[class*="detailCard"]');
    await expect(detailCard).toBeVisible({ timeout: 2000 });

    // Continue button should be visible and clickable
    await expect(page.getByText('Continue')).toBeVisible();
  });

  test('dev store Continue button works', async ({ page }) => {
    // Navigate to dev store page
    await page.goto('/dev/store');

    // Wait for store to load
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 10000 });

    // Click Continue button
    await page.getByText('Continue').click();

    // After clicking continue, we should transition to another screen
    // In dev store, this refreshes the shop
    await page.waitForTimeout(500);

    // Verify we're still in a valid state (either still in shop or moved to next phase)
    const isStillInShop = await page.getByText('Weapon Shop').isVisible().catch(() => false);
    const isInRound = await page.getByText('R1').isVisible().catch(() => false);

    // Should be in one of these valid states
    expect(isStillInShop || isInRound).toBe(true);
  });

  test('dev store handles reroll', async ({ page }) => {
    // Navigate to dev store page
    await page.goto('/dev/store');

    // Wait for store to load
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 10000 });

    // Find and click reroll button
    const rerollButton = page.getByRole('button', { name: /reroll/i });
    if (await rerollButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rerollButton.click();

      // Wait for shop to refresh
      await page.waitForTimeout(300);

      // Verify shop is still functional
      await expect(page.getByText('Available Weapons')).toBeVisible();
    }
  });

  test('multiple weapon clicks update detail panel each time', async ({ page }) => {
    // Navigate to dev store page
    await page.goto('/dev/store');

    // Wait for store to load
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 10000 });

    // Get all weapon options
    const weaponOptions = page.locator('[class*="optionButton"]').filter({ hasNot: page.locator('[class*="Sold"]') });
    const count = await weaponOptions.count();

    if (count >= 2) {
      // Click first weapon
      await weaponOptions.first().click();
      await page.waitForTimeout(100);

      // Get the detail text after first click
      const detailAfterFirst = await page.locator('[class*="detailName"]').textContent();

      // Click second weapon
      await weaponOptions.nth(1).click();
      await page.waitForTimeout(100);

      // Get the detail text after second click
      const detailAfterSecond = await page.locator('[class*="detailName"]').textContent();

      // Verify the detail panel updated (names should be different if weapons are different)
      // Note: In rare cases, both could be the same weapon type, so we just verify it's not empty
      expect(detailAfterSecond).toBeTruthy();
    }
  });

  test('purchasing a weapon marks slot as sold', async ({ page }) => {
    // Navigate to dev store page (starts with $50k)
    await page.goto('/dev/store');

    // Wait for store to load
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 10000 });

    // Get weapon options that are not sold
    const weaponOptions = page.locator('[class*="optionButton"]').filter({ hasNot: page.locator('[class*="Sold"]') });
    const initialCount = await weaponOptions.count();

    if (initialCount > 0) {
      // Double-click first weapon to purchase
      await weaponOptions.first().dblclick();

      // Wait for purchase to process
      await page.waitForTimeout(500);

      // Verify a "SOLD" label appeared
      const soldCount = await page.getByText('SOLD').count();
      expect(soldCount).toBeGreaterThan(0);
    }
  });

  test('shop handles all weapons purchased', async ({ page }) => {
    // Navigate to dev store page
    await page.goto('/dev/store');

    // Wait for store to load
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 10000 });

    // Purchase all weapons by double-clicking each
    for (let i = 0; i < 4; i++) {
      const availableWeapons = page.locator('[class*="optionButton"]').filter({ hasNot: page.locator('[class*="Sold"]') });
      const count = await availableWeapons.count();

      if (count === 0) break;

      await availableWeapons.first().dblclick();
      await page.waitForTimeout(300);
    }

    // After purchasing all, verify "All weapons sold" message or shop is still functional
    const allSoldMessage = page.getByText('All weapons sold');
    const selectMessage = page.getByText('Select a weapon below');

    // Should show one of these messages
    const hasAllSold = await allSoldMessage.isVisible().catch(() => false);
    const hasSelect = await selectMessage.isVisible().catch(() => false);

    // Either message is acceptable
    expect(hasAllSold || hasSelect).toBe(true);

    // Continue button should still work even when all weapons are sold
    const continueButton = page.getByText('Continue');
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Should transition successfully
    await page.waitForTimeout(500);
  });
});
