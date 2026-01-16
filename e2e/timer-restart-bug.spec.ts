import { test, expect } from '@playwright/test';

test.describe('Timer Restart Bug', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to reset state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('timer counts down properly after exiting and restarting adventure mode', async ({ page }) => {
    // Helper function to start adventure mode
    async function startAdventure() {
      // Wait for main menu
      await expect(page.getByText('NSHAPES')).toBeVisible({ timeout: 10000 });

      // Click Adventure mode
      await page.getByTestId('menu-adventure').click();

      // Wait for character selection
      await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 5000 });

      // Wait for auto-select
      await expect(page.getByText('Start Adventure')).toBeVisible({ timeout: 3000 });

      // Click Start Adventure
      await page.getByTestId('start-adventure-button').click();

      // Handle tutorial if it appears
      const skipButton = page.getByText('Skip - Start Adventure');
      if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipButton.click();
      }

      // Wait for enemy selection screen
      await expect(page.getByText('Choose Enemy')).toBeVisible({ timeout: 10000 });

      // Select first enemy using testID
      await page.getByTestId('fight-enemy-button').click();

      // Wait for game to load
      await expect(page.getByText('R1')).toBeVisible({ timeout: 10000 });
    }

    // FIRST PLAYTHROUGH
    await startAdventure();

    // Get initial timer value (should be around 30 for round 1)
    // Wait 3 seconds for timer to tick
    await page.waitForTimeout(3000);

    // Verify timer has ticked (not frozen at initial value)
    // Timer should not show "30" anymore after 3 seconds
    const timerAfterWait = page.locator('text=/^[0-9]+$/').first();
    const timerText = await timerAfterWait.textContent();
    expect(parseInt(timerText || '30')).toBeLessThan(30);

    // Exit to main menu
    await page.getByText('MENU').click();

    // Click Exit Game menu item
    await expect(page.getByText('Exit Game').first()).toBeVisible({ timeout: 3000 });
    await page.getByText('Exit Game').first().click();

    // Confirm exit in dialog
    await expect(page.getByText('EXIT GAME?')).toBeVisible({ timeout: 3000 });
    // Click the Exit Game button in the dialog (it's the last one with that text)
    await page.getByText('Exit Game').last().click();

    // Wait for main menu
    await expect(page.getByText('NSHAPES')).toBeVisible({ timeout: 5000 });

    // SECOND PLAYTHROUGH - This is where the bug would manifest
    await startAdventure();

    // Wait 3 seconds
    await page.waitForTimeout(3000);

    // THE CRITICAL CHECK: Timer should have decreased from initial value
    // If the bug is present, timer will still show the initial value (frozen)
    const timerAfterRestart = page.locator('text=/^[0-9]+$/').first();
    const timerTextRestart = await timerAfterRestart.textContent();
    expect(parseInt(timerTextRestart || '30')).toBeLessThan(30);
  });
});
