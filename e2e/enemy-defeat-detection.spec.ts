import { test, expect } from '@playwright/test';

/**
 * Integration tests for enemy defeat detection UI
 *
 * Verifies that the game correctly shows whether an enemy was defeated or failed,
 * and displays appropriate challenge completion status and reward information.
 */

test.describe('Enemy Defeat Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  // TODO: Enable this test after implementing "End Round Early" feature (Section 4.4)
  // Currently skipped because the test relies on exiting a round early via menu option
  test.skip('shows challenge failed when enemy defeat condition not met', async ({ page }) => {
    // Start adventure mode
    await expect(page.getByText('NSHAPES')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('menu-adventure').click();

    // Select character
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('start-adventure-button').click();

    // Skip tutorial if it appears
    const skipButton = page.getByText('Skip - Start Adventure');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Select an enemy (Stinging Scorpion - must make perfect matches)
    await expect(page.getByText('Choose Enemy')).toBeVisible({ timeout: 10000 });

    // Find and select Stinging Scorpion if available, otherwise use first enemy
    const enemyOptions = await page.getByTestId(/enemy-option-\d+/).all();
    let selectedEnemy = null;

    for (const option of enemyOptions) {
      const text = await option.textContent();
      if (text?.includes('Stinging Scorpion')) {
        selectedEnemy = option;
        await option.click();
        break;
      }
    }

    // If Stinging Scorpion not available, click first enemy
    if (!selectedEnemy && enemyOptions.length > 0) {
      await enemyOptions[0].click();
    }

    // Start the round using testID
    const fightButton = page.getByTestId('fight-enemy-button');
    await fightButton.click();

    // Wait for game board to load
    await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 15000 });

    // Make intentional invalid matches to fail the challenge
    // We'll click 3 cards that don't form a valid set to trigger an invalid match
    const cards = await page.locator('[data-testid^="card-"]').all();

    if (cards.length >= 3) {
      // Click first 3 cards (likely not a valid set)
      await cards[0].click();
      await cards[1].click();
      await cards[2].click();

      // Wait a moment for the invalid match to be processed
      await page.waitForTimeout(1000);
    }

    // Complete the round by running out of time or reaching score
    // Fast-forward by clicking menu and completing round
    await page.getByTestId('game-menu-button').click();
    const exitRound = page.getByText('Exit Round');
    if (await exitRound.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exitRound.click();
    }

    // Wait for round summary
    await expect(page.getByText('ROUND 1 COMPLETE')).toBeVisible({ timeout: 10000 });

    // Verify challenge status shows failed
    await expect(page.getByText('Extra Challenge')).toBeVisible();
    await expect(page.getByText('Challenge Failed')).toBeVisible();
    await expect(page.getByText('REWARD MISSED')).toBeVisible();
  });

  // TODO: Enable this test after implementing "End Round Early" feature (Section 4.4)
  // Currently skipped because the test relies on exiting a round early via menu option
  test.skip('shows challenge completed when enemy defeat condition met', async ({ page }) => {
    // Start adventure mode
    await expect(page.getByText('NSHAPES')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('menu-adventure').click();

    // Select character
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('start-adventure-button').click();

    // Skip tutorial if it appears
    const skipButton = page.getByText('Skip - Start Adventure');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Select an enemy
    await expect(page.getByText('Choose Enemy')).toBeVisible({ timeout: 10000 });
    const enemyOptions = await page.getByTestId(/enemy-option-\d+/).all();
    if (enemyOptions.length > 0) {
      await enemyOptions[0].click();
    }

    // Start the round using testID
    const fightButton = page.getByTestId('fight-enemy-button');
    await fightButton.click();

    // Wait for game board
    await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 15000 });

    // Try to make only valid matches (or none) to have a chance of completing challenge
    // For simplicity, we'll just wait and complete the round without making invalid matches
    await page.waitForTimeout(2000);

    // Complete round
    await page.getByTestId('game-menu-button').click();
    const exitRound = page.getByText('Exit Round');
    if (await exitRound.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exitRound.click();
    }

    // Wait for round summary
    await expect(page.getByText('ROUND 1 COMPLETE')).toBeVisible({ timeout: 10000 });

    // Verify challenge section exists
    await expect(page.getByText('Extra Challenge')).toBeVisible();

    // Check for either success or failure - depending on whether challenge was actually completed
    // The UI should clearly show one or the other
    const hasSuccess = await page.getByText('Challenge Completed!').isVisible().catch(() => false);
    const hasFailure = await page.getByText('Challenge Failed').isVisible().catch(() => false);

    // Must show one status (not both, not neither)
    expect(hasSuccess || hasFailure).toBe(true);
    expect(hasSuccess && hasFailure).toBe(false);

    // If successful, should show reward earned
    if (hasSuccess) {
      await expect(page.getByText('REWARD EARNED')).toBeVisible();
    }

    // If failed, should show reward missed
    if (hasFailure) {
      await expect(page.getByText('REWARD MISSED')).toBeVisible();
    }
  });

  test('displays different enemy tiers with appropriate colors', async ({ page }) => {
    // Start adventure mode
    await expect(page.getByText('NSHAPES')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('menu-adventure').click();

    // Select character
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('start-adventure-button').click();

    // Skip tutorial
    const skipButton = page.getByText('Skip - Start Adventure');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Verify enemy selection shows tier information
    await expect(page.getByText('Choose Enemy')).toBeVisible({ timeout: 10000 });
    // Check that first enemy option has tier text
    await expect(page.getByTestId('enemy-option-0').getByText(/Tier \d+/)).toBeVisible();
  });
});
