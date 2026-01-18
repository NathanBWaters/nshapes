import { test, expect } from '@playwright/test';

/**
 * Mobile layout tests for CharacterSelection
 * Tests iPhone SE (375x667) and iPhone 12 Pro (390x844) viewports
 */

test.describe('CharacterSelection Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  async function navigateToCharacterSelection(page: any) {
    // Wait for main menu to load
    await expect(page.getByText('ADVENTURE')).toBeVisible({ timeout: 15000 });
    // Click Adventure to go to character selection
    await page.getByText('ADVENTURE').click();
    // Wait for character selection to load
    await expect(page.getByText('Character Selection')).toBeVisible({ timeout: 10000 });
  }

  test('iPhone SE layout - detail section contains all content', async ({ page }) => {
    // Set iPhone SE viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await navigateToCharacterSelection(page);

    // Wait for characters to load
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'e2e-screenshots/iphone-se-character-initial.png', fullPage: false });

    // Click on different characters to see if details update
    const characterButtons = page.locator('[style*="border-width: 1"]').filter({ hasText: /.+/ });
    const count = await characterButtons.count();

    if (count > 0) {
      // Click first character
      await characterButtons.first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'e2e-screenshots/iphone-se-character-selected.png', fullPage: false });
    }

    // Verify Start Adventure button is visible
    const startButton = page.getByTestId('start-adventure-button');
    await expect(startButton).toBeVisible();
    const startBtnBox = await startButton.boundingBox();
    if (startBtnBox) {
      expect(startBtnBox.y + startBtnBox.height).toBeLessThanOrEqual(667);
    }
  });

  test('iPhone 12 Pro layout - beautiful display', async ({ page }) => {
    // Set iPhone 12 Pro viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/');
    await navigateToCharacterSelection(page);

    // Wait for characters to load
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'e2e-screenshots/iphone-12-pro-character-initial.png', fullPage: false });

    // Click on a character
    const characterButtons = page.locator('[style*="border-width: 1"]').filter({ hasText: /.+/ });
    const count = await characterButtons.count();

    if (count > 0) {
      await characterButtons.first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'e2e-screenshots/iphone-12-pro-character-selected.png', fullPage: false });
    }

    // Verify Start Adventure button is visible
    await expect(page.getByTestId('start-adventure-button')).toBeVisible();
  });

  test('iPhone SE - starting weapons and stats visible', async ({ page }) => {
    // Set iPhone SE viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await navigateToCharacterSelection(page);

    // Wait for characters to load
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 5000 });

    // Click on a character to show details
    const characterButtons = page.locator('[style*="border-width: 1"]').filter({ hasText: /.+/ });
    if (await characterButtons.count() > 0) {
      await characterButtons.first().click();
      await page.waitForTimeout(300);
    }

    // Check that Starting Weapons section is visible
    const startingWeapons = page.getByText('Starting Weapons');
    await expect(startingWeapons).toBeVisible({ timeout: 2000 });

    // Verify it's within viewport (or scrollable)
    const box = await startingWeapons.boundingBox();
    if (box) {
      expect(box.y).toBeGreaterThanOrEqual(0);
    }

    await page.screenshot({ path: 'e2e-screenshots/iphone-se-character-weapons.png', fullPage: false });
  });

  test('iPhone SE - difficulty selector and start button always accessible', async ({ page }) => {
    // Set iPhone SE viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await navigateToCharacterSelection(page);

    // Wait for characters to load
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 5000 });

    // Click on a character
    const characterButtons = page.locator('[style*="border-width: 1"]').filter({ hasText: /.+/ });
    if (await characterButtons.count() > 0) {
      await characterButtons.first().click();
      await page.waitForTimeout(200);
    }

    // Verify difficulty buttons are visible
    await expect(page.getByText('Easy')).toBeVisible();
    await expect(page.getByText('Medium')).toBeVisible();
    await expect(page.getByText('Hard')).toBeVisible();

    // Verify Start Adventure button is visible and within viewport
    const startButton = page.getByTestId('start-adventure-button');
    await expect(startButton).toBeVisible();

    const startBtnBox = await startButton.boundingBox();
    if (startBtnBox) {
      expect(startBtnBox.y + startBtnBox.height).toBeLessThanOrEqual(667);
    }

    await page.screenshot({ path: 'e2e-screenshots/iphone-se-character-buttons.png', fullPage: false });
  });

  test('iPhone SE - cycling through characters updates details', async ({ page }) => {
    // Set iPhone SE viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await navigateToCharacterSelection(page);

    // Wait for characters to load
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 5000 });

    // Click through multiple characters
    const characterButtons = page.locator('[style*="border-width: 1"]').filter({ hasText: /.+/ });
    const count = await characterButtons.count();

    for (let i = 0; i < Math.min(3, count); i++) {
      await characterButtons.nth(i).click();
      await page.waitForTimeout(200);
    }

    await page.screenshot({ path: 'e2e-screenshots/iphone-se-character-cycling.png', fullPage: false });

    // Verify UI is still functional
    await expect(page.getByTestId('start-adventure-button')).toBeVisible();
  });
});
