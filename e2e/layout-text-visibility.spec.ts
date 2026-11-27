import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile Pixel-Geometry Text Visibility Audit
 *
 * Programmatically catches React Native / react-native-web text clipping & horizontal overflow
 * bugs (such as flexShrink: 0 / minWidth: auto pushing text off the right edge of mobile viewports)
 * across every critical screen and modal in the app.
 */
async function assertAllTextVisible(page: Page, contextLabel: string): Promise<void> {
  const violations = await page.evaluate((label) => {
    const out: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (document.documentElement.scrollWidth > vw + 2) {
      out.push(`[${label}] Document horizontal overflow: scrollWidth=${document.documentElement.scrollWidth} > innerWidth=${vw}`);
    }

    const criticalSelector = [
      '[data-testid="story-intro"]',
      '[data-testid="map-guide-banner"]',
      '[data-testid="preview-coach"]',
      '[data-testid="preview-lesson"]',
      '[data-testid="run-coach-banner"]',
      '[data-testid="run-foe-taunt"]',
      '[data-testid="results-companion-bubble"]',
      '[data-testid="results-star-breakdown"]',
      '[data-testid="results-actions"]',
      '[data-testid="lesson-modal"]',
      '[data-testid="unlock-modal"]',
    ].join(', ');

    const isHidden = (el: Element): boolean => {
      let cur: Element | null = el;
      while (cur && cur !== document.body) {
        const cs = getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
          return true;
        }
        if (cur.getAttribute('aria-hidden') === 'true') {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? '').trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.closest('svg')) continue;
      if (isHidden(parent)) continue;

      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (rect.width <= 0.5 || rect.height <= 0.5) continue;

      // Skip nodes that belong to a horizontal ScrollView carousel, while checking the carousel itself fits
      let hScroller: Element | null = null;
      const clippingAncestors: { el: Element; rect: DOMRect }[] = [];
      let anc: Element | null = parent.parentElement;
      while (anc && anc !== document.body) {
        const cs = getComputedStyle(anc);
        if (
          (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
          anc.scrollWidth > anc.clientWidth + 2
        ) {
          hScroller = anc;
          break;
        }
        if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') {
          clippingAncestors.push({ el: anc, rect: anc.getBoundingClientRect() });
        }
        anc = anc.parentElement;
      }

      if (hScroller) {
        const sr = hScroller.getBoundingClientRect();
        if (sr.left < -2 || sr.right > vw + 2) {
          out.push(
            `[${label}] Horizontal scroller overflows viewport (${Math.round(sr.left)}..${Math.round(sr.right)} vs 0..${vw}) around "${text.slice(0, 40)}"`
          );
        }
        continue;
      }

      // Check 1: No rendered text extends past left/right edge of mobile viewport
      if (rect.left < -2 || rect.right > vw + 2) {
        out.push(
          `[${label}] Text clipped off viewport (${Math.round(rect.left)}..${Math.round(rect.right)} vs 0..${vw}): "${text.slice(0, 60)}"`
        );
        continue;
      }

      // Check 2: No text extends outside an overflow-clipping ancestor unless intentional ellipsis
      const parentStyle = getComputedStyle(parent);
      const allowsEllipsis = parentStyle.textOverflow === 'ellipsis' && !parent.closest(criticalSelector);
      if (!allowsEllipsis) {
        for (const ca of clippingAncestors) {
          if (ca.rect.width <= 1) continue;
          if (rect.left < ca.rect.left - 3 || rect.right > ca.rect.right + 3) {
            out.push(
              `[${label}] Text clipped by ancestor (${Math.round(rect.left)}..${Math.round(rect.right)} vs box ${Math.round(ca.rect.left)}..${Math.round(ca.rect.right)}): "${text.slice(0, 60)}"`
            );
            break;
          }
        }
      }

      // Check 3: Critical onboarding, companion bubbles, star breakdown, and modals must not silently truncate
      if (parent.closest(criticalSelector)) {
        if (parent.scrollWidth > parent.clientWidth + 3) {
          out.push(
            `[${label}] Critical UI text overflows/truncates its box (scrollWidth=${parent.scrollWidth} > clientWidth=${parent.clientWidth}): "${text.slice(0, 60)}"`
          );
        }
        if (rect.top >= 0 && rect.bottom <= vh && rect.height > 2000) {
          out.push(`[${label}] Implausible text box height ${rect.height} for "${text.slice(0, 40)}"`);
        }
      }
    }

    return out;
  }, contextLabel);

  expect(violations, `Layout/text clipping violations on ${contextLabel}`).toEqual([]);
}

test.describe('Mobile Text Visibility & Zero-Clipping Guardrails', () => {
  test.describe.configure({ mode: 'serial' });

  test('First-minute Adventure onboarding screens fit 100% of text on 375px and 320px viewports', async ({ page }) => {
    test.setTimeout(60_000);
    for (const vp of [
      { width: 375, height: 667 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(vp);

      // A brand-new player: the story (three beats), then straight onto the guided 1-1 board
      await page.goto('/dev/adventure?save=fresh');
      await expect(page.getByTestId('story-intro')).toBeVisible({ timeout: 20000 });
      for (let beat = 1; beat <= 3; beat++) {
        // (the words of a beat rise in a moment after its scene starts)
        await page.waitForTimeout(beat === 1 ? 1500 : 700);
        await assertAllTextVisible(page, `Story beat ${beat} (${vp.width}x${vp.height})`);
        await page.getByTestId('story-next').click();
      }
      // [OB-15] Coaching-first opening: 1-1 suppresses the foe taunt and opens straight onto live coaching
      await expect(page.getByTestId('run-coach-banner')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('run-foe-taunt')).toHaveCount(0);
      await expect(page.getByTestId('run-stage')).toBeVisible();
      await page.waitForTimeout(400);
      await assertAllTextVisible(page, `1-1 Guided Board (${vp.width}x${vp.height})`);

      // The same save from the map: its greeting, and the 1-1 preview sheet
      await page.goto('/dev/adventure?save=fresh&intro=false');
      await expect(page.getByTestId('map-guide-banner')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('map-play-next')).toBeVisible();
      await page.waitForTimeout(350);
      await assertAllTextVisible(page, `Fresh Map (${vp.width}x${vp.height})`);

      // Frontier node gently bobs via <Bob>, so click directly without Playwright stability wait
      await page.getByTestId('map-node-1-1').click({ force: true });
      await expect(page.getByTestId('preview-coach')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('preview-play')).toBeVisible();
      await page.waitForTimeout(350);
      await assertAllTextVisible(page, `1-1 Preview (${vp.width}x${vp.height})`);
    }
  });

  test('Completing 1-1 renders UnlockReveal and LevelResults star breakdown with zero text clipping on 375px mobile', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/adventure?save=fresh&autoplay=true');
    // Skip the story: the first fight starts at once and plays itself
    await expect(page.getByTestId('story-skip')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('story-skip').click();

    await expect(page.getByTestId('unlock-reveal')).toBeVisible({ timeout: 45000 });
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, 'UnlockReveal Pre-Reveal (375x667)');

    await page.getByTestId('unlock-reveal').click();
    await expect(page.getByTestId('unlock-primary')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(400);
    await assertAllTextVisible(page, 'UnlockReveal Revealed Card (375x667)');
    // ...and so is the button that moves on from a reward
    await expect(page.getByTestId('unlock-primary')).toBeInViewport();

    await page.getByTestId('unlock-primary').click();
    await expect(page.getByTestId('results-companion-bubble')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('results-star-breakdown')).toBeVisible();
    // What to do next is pinned under the results: on screen without scrolling
    await expect(page.getByTestId('results-next')).toBeInViewport();
    await page.waitForTimeout(400);
    await assertAllTextVisible(page, '1-1 LevelResults & Star Breakdown (375x667)');
  });

  test('Main Menu, Options Reset, MechanicIntro (1-2), Camp tabs & Field Guide fit 100% of text on 375px mobile', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 375, height: 667 });

    // Main Menu & Options Menu Reset confirmation
    await page.goto('/');
    await expect(page.getByTestId('menu-adventure')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(300);
    await assertAllTextVisible(page, 'Main Menu (375x667)');

    await page.getByTestId('menu-options').click();
    await expect(page.getByTestId('options-reset-game')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(250);
    await assertAllTextVisible(page, 'Options Menu (375x667)');

    await page.getByTestId('options-reset-game').click();
    await expect(page.getByTestId('options-reset-confirm-box')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);
    await assertAllTextVisible(page, 'Options Reset Confirmation (375x667)');

    // 1-2 Preview: the level's lesson card (the new mechanic and its picture), and the full page behind it
    await page.goto('/dev/adventure?save=before:1-2');
    await expect(page.getByTestId('map-play-next')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('map-play-next').click();
    await expect(page.getByTestId('preview-lesson')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, '1-2 Preview (375x667)');

    await page.getByTestId('preview-lesson').click();
    await expect(page.getByTestId('lesson-modal')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, '1-2 MechanicIntro (375x667)');
    await page.getByTestId('mechanic-intro-ok').click();

    // Fight! starts the fight straight from the sheet: the 1-2 board with its battle stage
    await page.getByTestId('preview-play').click();
    await expect(page.getByTestId('run-stage')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('run-coach-banner')).toBeVisible();
    await page.waitForTimeout(400);
    await assertAllTextVisible(page, '1-2 Fight (375x667)');

    // Maxed Map, Field Guide & Camp screens
    await page.goto('/dev/adventure?save=maxed');
    await expect(page.getByTestId('map-play-next')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, 'Maxed Adventure Map (375x667)');

    await page.getByTestId('map-dock-guide').click();
    await expect(page.getByTestId('guide-tab-evolutions')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await assertAllTextVisible(page, 'FieldGuide Mechanics (375x667)');

    await page.getByTestId('guide-tab-evolutions').click();
    await page.waitForTimeout(250);
    await assertAllTextVisible(page, 'FieldGuide Evolutions (375x667)');

    await page.getByLabel('Back to map').click();
    await expect(page.getByTestId('map-dock-camp')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('map-dock-camp').click();
    await expect(page.getByTestId('camp-tab-fighters')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await assertAllTextVisible(page, 'Camp Menu (375x667)');

    for (const tabId of ['fighters', 'armory', 'arcana', 'workshop', 'bounties'] as const) {
      await page.getByTestId(`camp-tab-${tabId}`).click();
      await page.waitForTimeout(300);
      await assertAllTextVisible(page, `Camp ${tabId} (375x667)`);
      if (tabId === 'armory') {
        // Verify WeaponExplainer 1-of-3 Evolution selector & 1-tap swap fit cleanly on 375px portrait
        await page.getByTestId('camp-armory-blast-powder').click();
        await expect(page.getByTestId('weapon-explainer-evo-selector-blast-powder')).toBeVisible({ timeout: 5000 });
        await page.getByTestId('evo-option-blast-powder:napalm-payload').click();
        await page.waitForTimeout(250);
        await assertAllTextVisible(page, 'Camp Armory WeaponExplainer 1-of-3 Evo Picker (375x667)');
      }
      if (tabId === 'bounties') {
        // Verify 200-bounty mobile layout across Evos & By Weapon filter tabs
        await expect(page.getByTestId('bounty-total-count')).toContainText('/200');
        await page.getByTestId('bounty-filter-evos').click();
        await page.waitForTimeout(200);
        await assertAllTextVisible(page, 'Camp 200-Bounty Board Evos Tab (375x667)');
        await page.getByTestId('bounty-filter-by_weapon').click();
        await page.waitForTimeout(200);
        await assertAllTextVisible(page, 'Camp 200-Bounty Board By Weapon Tab (375x667)');
      }
      await page.getByLabel('Back to camp').click();
      await expect(page.getByTestId('camp-tab-fighters')).toBeVisible({ timeout: 5000 });
    }

    // 5-Slot GearBelt Portrait Fit (375x667) with active per-weapon evolution rails
    const fiveWeapons = ['blast-powder', 'flint-spark', 'prismatic-ray', 'echo-stone', 'war-drum'];
    await page.goto(`/dev/adventure?save=maxed&level=2-4&weapons=${fiveWeapons.join(',')}&intro=false`);
    await expect(page.getByTestId('run-stage')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('gear-belt')).toBeVisible({ timeout: 10000 });
    for (const id of fiveWeapons) {
      const box = await page.getByTestId(`belt-${id}`).boundingBox();
      expect(box, `5-slot GearBelt slot belt-${id} should have bounding box`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(376);
    }
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, '5-Slot GearBelt Portrait Fight (375x667)');
  });

  test('iPad / Tablet portrait (768x1024) Main Menu, Options (Privacy & Support), and Adventure Map render with zero clipping', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await expect(page.getByTestId('menu-adventure')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, 'Main Menu (iPad 768x1024)');

    await page.getByTestId('menu-options').click();
    await expect(page.getByTestId('options-privacy-link')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('options-support-link')).toBeVisible();
    await page.waitForTimeout(300);
    await assertAllTextVisible(page, 'Options Menu (iPad 768x1024)');

    await page.goto('/dev/adventure?save=maxed&intro=false');
    await expect(page.getByTestId('map-play-next')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, 'Maxed Adventure Map (iPad 768x1024)');
  });
});
