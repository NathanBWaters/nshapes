import { test, expect } from '@playwright/test';

test.describe('NShapes Gameplay', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to reset state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('can start adventure mode and play a round', async ({ page }) => {
    // Wait for main menu to load
    await expect(page.getByText('NSHAPES')).toBeVisible({ timeout: 10000 });

    // Click Adventure mode
    await page.getByTestId('menu-adventure').click();

    // Wait for character selection
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 5000 });

    // Wait for auto-select to happen (button text changes from "Select a Character")
    await expect(page.getByText('Start Adventure')).toBeVisible({ timeout: 3000 });

    // Click Start Adventure
    await page.getByTestId('start-adventure-button').click();

    // Handle tutorial prompt if it appears
    const skipButton = page.getByText('Skip - Start Adventure');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Wait for enemy selection screen
    await expect(page.getByText('Choose Enemy')).toBeVisible({ timeout: 10000 });

    // Select first enemy using testID
    await page.getByTestId('fight-enemy-button').click();

    // Wait for game to load - round indicator should be visible
    await expect(page.getByText('R1')).toBeVisible({ timeout: 10000 });

    // Verify the game is running
    expect(await page.getByText('R1').isVisible()).toBeTruthy();
  });

  test('can navigate to free play mode', async ({ page }) => {
    // Wait for main menu to load
    await expect(page.getByText('NSHAPES')).toBeVisible({ timeout: 10000 });

    // Click Free Play mode
    await page.getByTestId('menu-freeplay').click();

    // Free Play shows difficulty selection first
    await expect(page.getByText('Choose Difficulty')).toBeVisible({ timeout: 5000 });

    // Verify difficulty options are present
    await expect(page.getByText('EASY')).toBeVisible();
    await expect(page.getByText('MEDIUM')).toBeVisible();
  });
});
