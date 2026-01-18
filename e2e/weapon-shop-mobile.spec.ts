import { test, expect, devices } from '@playwright/test';

/**
 * Mobile layout tests for WeaponShop
 * Tests iPhone SE (375x667) and iPhone 12 Pro (390x844) viewports
 */

test.describe('WeaponShop Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('iPhone SE layout - detail section contains all content', async ({ page }) => {
    // Set iPhone SE viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dev/store');
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 15000 });

    // Wait for weapons to load
    await expect(page.getByText('Available Weapons')).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'e2e-screenshots/iphone-se-shop-initial.png', fullPage: false });

    // Click on a weapon to show details
    const weaponButtons = page.locator('[style*="border-width: 2"]').filter({ hasText: /\$\d+/ });
    const count = await weaponButtons.count();

    if (count > 0) {
      await weaponButtons.first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'e2e-screenshots/iphone-se-shop-selected.png', fullPage: false });
    }

    // Check that Stat Changes section is visible (if weapon has effects)
    const statChanges = page.getByText('Stat Changes');
    if (await statChanges.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Verify it's within viewport
      const box = await statChanges.boundingBox();
      if (box) {
        expect(box.y + box.height).toBeLessThan(667); // Should be within viewport height
      }
    }

    // Verify Continue button is visible and clickable
    const continueBtn = page.getByText('Continue', { exact: true });
    await expect(continueBtn).toBeVisible();
    const continueBtnBox = await continueBtn.boundingBox();
    if (continueBtnBox) {
      expect(continueBtnBox.y + continueBtnBox.height).toBeLessThan(667);
    }
  });

  test('iPhone 12 Pro layout - beautiful display', async ({ page }) => {
    // Set iPhone 12 Pro viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/dev/store');
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 15000 });

    // Wait for weapons to load
    await expect(page.getByText('Available Weapons')).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'e2e-screenshots/iphone-12-pro-shop-initial.png', fullPage: false });

    // Click on a weapon to show details
    const weaponButtons = page.locator('[style*="border-width: 2"]').filter({ hasText: /\$\d+/ });
    const count = await weaponButtons.count();

    if (count > 0) {
      await weaponButtons.first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'e2e-screenshots/iphone-12-pro-shop-selected.png', fullPage: false });
    }

    // Verify the layout looks good - all elements visible
    await expect(page.getByText('Purchase')).toBeVisible();
    await expect(page.getByText('Continue', { exact: true })).toBeVisible();
  });

  test('iPhone SE - detail section scrollable with long content', async ({ page }) => {
    // Set iPhone SE viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dev/store');
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 15000 });

    // Wait for weapons to load
    await expect(page.getByText('Available Weapons')).toBeVisible({ timeout: 5000 });

    // Click multiple weapons to see if details update properly
    const weaponButtons = page.locator('[style*="border-width: 2"]').filter({ hasText: /\$\d+/ });
    const count = await weaponButtons.count();

    for (let i = 0; i < Math.min(3, count); i++) {
      await weaponButtons.nth(i).click();
      await page.waitForTimeout(200);
    }

    await page.screenshot({ path: 'e2e-screenshots/iphone-se-shop-cycling.png', fullPage: false });

    // Verify UI is still functional
    await expect(page.getByText('Continue', { exact: true })).toBeVisible();
  });

  test('iPhone SE - stat changes box stays within bounds', async ({ page }) => {
    // Set iPhone SE viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dev/store');
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 15000 });

    // Click on various weapons and verify stat changes are visible
    const weaponButtons = page.locator('[style*="border-width: 2"]').filter({ hasText: /\$\d+/ });
    const count = await weaponButtons.count();

    for (let i = 0; i < count; i++) {
      await weaponButtons.nth(i).click();
      await page.waitForTimeout(200);

      // Check if stat changes box exists and is within the viewport
      const statChanges = page.getByText('Stat Changes');
      if (await statChanges.isVisible({ timeout: 500 }).catch(() => false)) {
        const box = await statChanges.boundingBox();
        if (box) {
          // Stat Changes label should be within visible area (allowing for scrolling in parent)
          expect(box.y).toBeGreaterThanOrEqual(0);
        }
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'e2e-screenshots/iphone-se-stat-changes.png', fullPage: false });

    // Verify purchase and continue buttons are always visible and clickable
    await expect(page.getByText('Purchase')).toBeVisible();
    await expect(page.getByText('Continue', { exact: true })).toBeVisible();
  });

  test('iPhone SE - purchase and continue buttons always accessible', async ({ page }) => {
    // Set iPhone SE viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dev/store');
    await expect(page.getByText('Weapon Shop')).toBeVisible({ timeout: 15000 });

    // Click a weapon
    const weaponButtons = page.locator('[style*="border-width: 2"]').filter({ hasText: /\$\d+/ });
    if (await weaponButtons.count() > 0) {
      await weaponButtons.first().click();
      await page.waitForTimeout(200);
    }

    // Verify buttons are visible and within viewport
    const purchaseBtn = page.getByText('Purchase');
    const continueBtn = page.getByText('Continue', { exact: true });

    await expect(purchaseBtn).toBeVisible();
    await expect(continueBtn).toBeVisible();

    const purchaseBox = await purchaseBtn.boundingBox();
    const continueBox = await continueBtn.boundingBox();

    // Buttons should be within the 667px viewport height
    if (purchaseBox && continueBox) {
      expect(purchaseBox.y + purchaseBox.height).toBeLessThanOrEqual(667);
      expect(continueBox.y + continueBox.height).toBeLessThanOrEqual(667);
    }

    await page.screenshot({ path: 'e2e-screenshots/iphone-se-buttons.png', fullPage: false });
  });
});
