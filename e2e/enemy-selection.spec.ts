import { test, expect } from '@playwright/test';

// All valid tier 1 enemy names
const TIER_1_ENEMIES = [
  'Junk Rat',
  'Stalking Wolf',
  'Shifting Chameleon',
  'Burrowing Mole',
  'Masked Bandit',
  'Wild Goose',
  'Thieving Raven',
  'Stinging Scorpion',
  'Night Owl',
  'Swift Bee',
  'Trap Weaver',
  'Circling Vulture',
  'Iron Shell',
  'Ticking Viper',
  'Wet Crab',
  'Foggy Frog',
  'Shadow Bat',
  'Spiny Hedgehog',
  'Lazy Sloth',
  'Punishing Ermine',
  'Greedy Squirrel',
  'Sneaky Mouse',
];

test.describe('Enemy Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('shows 3 valid tier 1 enemies when starting adventure mode', async ({ page }) => {
    // Wait for main menu to load
    await expect(page.getByText('NSHAPES')).toBeVisible({ timeout: 10000 });

    // Click Adventure mode
    await page.getByTestId('menu-adventure').click();

    // Wait for character selection
    await expect(page.getByText('Choose Your Character')).toBeVisible({ timeout: 5000 });

    // Wait for auto-select and click Start Adventure
    await expect(page.getByText('Start Adventure')).toBeVisible({ timeout: 3000 });
    await page.getByTestId('start-adventure-button').click();

    // Handle tutorial prompt if it appears
    const skipButton = page.getByText('Skip - Start Adventure');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Wait for enemy selection screen
    await expect(page.getByText('Choose Enemy')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Select Your Opponent')).toBeVisible();

    // Verify we have exactly 3 enemy options
    const enemyOption0 = page.getByTestId('enemy-option-0');
    const enemyOption1 = page.getByTestId('enemy-option-1');
    const enemyOption2 = page.getByTestId('enemy-option-2');

    await expect(enemyOption0).toBeVisible();
    await expect(enemyOption1).toBeVisible();
    await expect(enemyOption2).toBeVisible();

    // Get the enemy names from each option
    const enemyNames: string[] = [];
    for (const option of [enemyOption0, enemyOption1, enemyOption2]) {
      const text = await option.textContent();
      // Extract enemy name - it's the text before "Tier"
      const match = text?.match(/^(.+?)Tier/);
      if (match) {
        enemyNames.push(match[1].trim());
      }
    }

    // Verify we found 3 enemy names
    expect(enemyNames).toHaveLength(3);

    // Verify none of them are "Dummy"
    for (const name of enemyNames) {
      expect(name).not.toBe('Dummy');
      expect(TIER_1_ENEMIES).toContain(name);
    }

    // Verify all show "Tier 1"
    for (const option of [enemyOption0, enemyOption1, enemyOption2]) {
      await expect(option.getByText('Tier 1')).toBeVisible();
    }
  });
});
