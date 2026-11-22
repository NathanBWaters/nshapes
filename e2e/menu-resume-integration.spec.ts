import { test, expect } from '@playwright/test';

/**
 * Real-Browser Integration Suite: Main Menu ↔ Starfall Summit & Adventure Mode.
 *
 * Regression coverage for leaving to the Main Menu mid-run, resuming, and
 * launching Floor 3+ (including Elite encounters), plus Adventure Mode
 * Main Menu ↔ Map ↔ Preview ↔ Fight (Retreat) ↔ Main Menu ↔ Resume and
 * cross-mode interleaving.
 */
test.describe('Main Menu ↔ Mode Resume Integration (Summit & Adventure)', () => {
  test.describe.configure({ mode: 'serial' });

  test('Starfall Summit: climb to Floor 3 → leave to Main Menu → resume → start Floor 3 Elite battle → retreat → Main Menu → resume', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    await page.setViewportSize({ width: 375, height: 667 });
    // Seed 24 deterministically places Floor 1 Battle (Golden Mole) → Floor 2 Shop → Floor 3 Elite (Bully Boar) on lane 0
    await page.goto('/dev/spire?start=true&autoplay=true&seed=24');
    await expect(page.getByTestId('spire-map')).toBeVisible({ timeout: 20000 });

    // Floor 1: Battle (autoplay win + draft weapon)
    await page.getByTestId('spire-node-a1-r0-c0').click({ force: true });
    await expect(page.getByTestId('spire-encounter-preview')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('spire-enter-fight').click();
    await expect(page.getByTestId('spire-reward-screen')).toBeVisible({ timeout: 60000 });
    await page.getByTestId('spire-draft-pick-0').click();
    if (await page.getByTestId('spire-skill-pick-0').isVisible()) {
      await page.getByTestId('spire-skill-pick-0').click();
    }
    await page.getByTestId('spire-reward-continue').click();
    await expect(page.getByTestId('spire-map')).toBeVisible({ timeout: 10000 });

    // Floor 2: Shop → Leave back to Map
    await page.getByTestId('spire-node-a1-r1-c0').click({ force: true });
    await expect(page.getByTestId('spire-shop')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('spire-shop-leave').click();
    await expect(page.getByTestId('spire-map')).toBeVisible({ timeout: 10000 });

    // Leave to Main Menu (SpireHeader → SpireSetup → MainMenu)
    await page.getByTestId('spire-back-menu').click();
    await expect(page.getByTestId('spire-setup')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('spire-setup-back').click();
    await expect(page.getByTestId('menu-spire')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('menu-spire')).toContainText('Starfall Summit');
    await expect(page.getByTestId('menu-spire')).toContainText('LIVE RUN');

    // Resume from Main Menu → enter Floor 3 Elite battle (regression for `Unknown level spire-elite` crash!)
    await page.getByTestId('menu-spire').click();
    await expect(page.getByTestId('spire-resume-run')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('spire-resume-run').click();
    await expect(page.getByTestId('spire-map')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('spire-node-a1-r2-c0').click({ force: true });
    await expect(page.getByTestId('spire-encounter-preview')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('spire-preview-parry')).toBeVisible();
    await page.getByTestId('spire-enter-fight').click();
    await expect(page.getByTestId('run-stage')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('run-parry-bar')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);

    // Pause mid-battle → Retreat (−1 ♥) → Main Menu → Resume → Start Floor 3 Elite battle again
    await page.getByLabel('Pause').click();
    await page.getByText('Retreat (−1 ♥)').click();
    await expect(page.getByTestId('spire-encounter-preview')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('spire-back-menu').click();
    await page.getByTestId('spire-setup-back').click();
    await expect(page.getByTestId('menu-spire')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('menu-spire').click();
    await page.getByTestId('spire-resume-run').click();
    await expect(page.getByTestId('spire-encounter-preview')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('spire-enter-fight').click();
    await expect(page.getByTestId('run-stage')).toBeVisible({ timeout: 10000 });

    expect(errors).toEqual([]);
  });

  test('Adventure Mode: Main Menu ↔ Map ↔ Preview ↔ Fight (Retreat) ↔ Main Menu ↔ Cross-Mode Summit Resume', async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    await page.setViewportSize({ width: 375, height: 667 });

    // Start from Main Menu: enter Adventure Mode (fresh player → Story → Skip → 1-1 live fight)
    await page.goto('/');
    await expect(page.getByTestId('menu-adventure')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('menu-adventure').click();
    await expect(page.getByTestId('story-skip')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('story-skip').click();
    await expect(page.getByTestId('run-stage')).toBeVisible({ timeout: 10000 });

    // Pause → Retreat to Map → Return to Main Menu
    await page.getByLabel('Pause').click();
    await page.getByText('Retreat to map').click();
    await expect(page.getByTestId('map-play-next')).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Back to menu').click();
    await expect(page.getByTestId('menu-adventure')).toBeVisible({ timeout: 10000 });

    // Start a Starfall Summit run, enter Floor 1 preview, then leave to Main Menu
    await page.getByTestId('menu-spire').click();
    await expect(page.getByTestId('spire-start-climb')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('spire-start-climb').click();
    await expect(page.getByTestId('spire-map')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('spire-node-a1-r0-c0').click({ force: true });
    await expect(page.getByTestId('spire-encounter-preview')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('spire-back-menu').click();
    await page.getByTestId('spire-setup-back').click();

    // Main Menu shows LIVE RUN for Starfall Summit while Adventure Mode resumes smoothly into Map → Preview → Fight!
    await expect(page.getByTestId('menu-spire')).toContainText('Starfall Summit');
    await expect(page.getByTestId('menu-spire')).toContainText('LIVE RUN');
    await page.getByTestId('menu-adventure').click();
    await expect(page.getByTestId('map-play-next')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('map-play-next').click();
    await expect(page.getByTestId('preview-play')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('preview-play').click();
    await expect(page.getByTestId('run-stage')).toBeVisible({ timeout: 10000 });

    // Retreat back to Main Menu → Resume Starfall Summit straight back into Floor 1 preview → Fight!
    await page.getByLabel('Pause').click();
    await page.getByText('Retreat to map').click();
    await page.getByLabel('Back to menu').click();
    await page.getByTestId('menu-spire').click();
    await page.getByTestId('spire-resume-run').click();
    await expect(page.getByTestId('spire-encounter-preview')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('spire-enter-fight').click();
    await expect(page.getByTestId('run-stage')).toBeVisible({ timeout: 10000 });

    expect(errors).toEqual([]);
  });
});
