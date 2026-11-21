import { test, expect, type Page } from '@playwright/test';

const SHOT_DIR = process.env.SPIRE_SHOT_DIR || '';

async function maybeShot(page: Page, name: string): Promise<void> {
  if (!SHOT_DIR) return;
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false });
}

async function assertAllTextVisible(page: Page, contextLabel: string): Promise<void> {
  const violations = await page.evaluate((label) => {
    const out: string[] = [];
    const vw = window.innerWidth;

    if (document.documentElement.scrollWidth > vw + 2) {
      out.push(`[${label}] Document horizontal overflow: scrollWidth=${document.documentElement.scrollWidth} > innerWidth=${vw}`);
    }

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

      if (rect.left < -2 || rect.right > vw + 2) {
        out.push(
          `[${label}] Text clipped off viewport (${Math.round(rect.left)}..${Math.round(rect.right)} vs 0..${vw}): "${text.slice(0, 60)}"`
        );
        continue;
      }

      const parentStyle = getComputedStyle(parent);
      const allowsEllipsis = parentStyle.textOverflow === 'ellipsis';
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
    }

    return out;
  }, contextLabel);

  expect(violations, `Layout/text clipping violations on ${contextLabel}`).toEqual([]);
}

test.describe('Set-Parrying, Multiplier Ignition, Kill-Cam & Starfall Summit E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('Main Menu exposes Starfall Summit cleanly on 375px and 320px viewports', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    for (const vp of [
      { width: 375, height: 667 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(vp);
      await page.goto('/');
      await expect(page.getByTestId('menu-adventure')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('menu-spire')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('menu-spire')).toContainText('Starfall Summit');
      await expect(page.getByTestId('menu-spire')).not.toContainText(/spire/i);
      await expect(page.getByTestId('menu-spire')).toBeInViewport();
      await page.waitForTimeout(300);
      await assertAllTextVisible(page, `Main Menu (${vp.width}x${vp.height})`);
      if (vp.width === 375) await maybeShot(page, '01-main-menu-375');
    }

    // Clicking Starfall Summit launches SpireSetup directly
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByTestId('menu-spire').click();
    await expect(page.getByTestId('spire-setup')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('spire-setup')).toContainText('STARFALL SUMMIT');
    await expect(page.getByTestId('spire-setup')).not.toContainText(/spire/i);
    await expect(page.getByTestId('spire-start-climb')).toBeVisible();
    await expect(page.getByTestId('spire-start-climb')).toContainText('Begin Summit Climb');
    await page.waitForTimeout(300);
    await assertAllTextVisible(page, 'Summit Setup via Main Menu (375x667)');
    await maybeShot(page, '02-spire-setup-375');

    // Switch fighter & verify starter kit updates cleanly
    await page.getByTestId('spire-fighter-Badger').click();
    await expect(page.getByTestId('spire-starter-kit')).toContainText('Bloodline');
    await assertAllTextVisible(page, 'Summit Setup Badger (375x667)');

    await page.getByTestId('spire-fighter-Corgi').click();
    await expect(page.getByTestId('spire-starter-kit')).toContainText('Shard Garden');
    await assertAllTextVisible(page, 'Summit Setup Corgi (375x667)');

    expect(pageErrors).toEqual([]);
  });

  test('Adventure Mode shows ParryPreviewCard UP FRONT before battle and ParryIntentBar + Ignition live in fight', async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.setViewportSize({ width: 375, height: 667 });
    // World 2 level with a specific Set-Parry Counter requirement
    await page.goto('/dev/adventure?save=before:2-4&autoplay=true');
    await expect(page.getByTestId('map-play-next')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('map-play-next').click();

    await expect(page.getByTestId('preview-parry')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('preview-parry').scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, 'Adventure 2-4 Preview with ParryPreviewCard (375x667)');
    await maybeShot(page, '03-adventure-parry-preview-375');

    // Enter battle and confirm live ParryIntentBar renders cleanly on the stage
    await page.getByTestId('preview-play').click();
    await expect(page.getByTestId('run-stage')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('run-parry-bar')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1800);
    await assertAllTextVisible(page, 'Adventure 2-4 Live Fight with ParryIntentBar (375x667)');
    await maybeShot(page, '04-adventure-live-fight-375');

    expect(pageErrors).toEqual([]);
  });

  test('Full Starfall Summit playable loop: Setup → Map → Preview (Parry) → Build Modal → Autoplay Fight → Rewards → Map', async ({ page }) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/spire?start=true&fighter=Orange%20Tabby&seed=4242&autoplay=true');

    // 1. Act 1 branching map
    await expect(page.getByTestId('spire-map')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('spire-header')).toBeVisible();
    await page.waitForTimeout(400);
    await assertAllTextVisible(page, 'Summit Act 1 Map (375x667)');
    await maybeShot(page, '05-spire-map-375');

    // 2. Open Build Modal (reusing WeaponExplainer)
    await page.getByTestId('spire-open-build').click();
    await expect(page.getByTestId('spire-build-weapon-blast-powder')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(250);
    await assertAllTextVisible(page, 'Summit Build Inspector Modal (375x667)');
    await maybeShot(page, '06-spire-build-modal-375');
    await page.getByLabel('Close', { exact: true }).click();

    // 3. Select Row 0 entrance battle node → Encounter Preview with ParryPreviewCard UP FRONT
    await page.getByTestId('spire-node-a1-r0-c0').click({ force: true });
    await expect(page.getByTestId('spire-encounter-preview')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('spire-preview-parry')).toBeVisible();
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, 'Summit Encounter Preview (375x667)');
    await maybeShot(page, '07-spire-encounter-preview-375');

    // 4. Enter Combat (shared AdventureRun with Set-Parry & Ignition + autoplay)
    await page.getByTestId('spire-enter-fight').click();
    await expect(page.getByTestId('run-stage')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('run-parry-bar')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1600);
    await maybeShot(page, '08-spire-live-fight-375');

    // 5. Autoplay wins the Floor 1 battle → SpireRewardScreen (WeaponExplainer + FightReplay!)
    await expect(page.getByTestId('spire-reward-screen')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('spire-weapon-draft')).toBeVisible();
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, 'Summit Post-Battle Rewards (375x667)');
    await maybeShot(page, '09-spire-rewards-375');

    // 6. Claim a weapon & return to Map on Row 1!
    await page.getByTestId('spire-draft-pick-0').click();
    await page.getByTestId('spire-reward-continue').click();
    await expect(page.getByTestId('spire-map')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(350);
    await assertAllTextVisible(page, 'Summit Map Floor 2 (375x667)');

    // Also sanity-check 320px narrow viewport on Summit Map & Setup
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(250);
    await assertAllTextVisible(page, 'Summit Map (320x568)');

    expect(pageErrors).toEqual([]);
  });

  test('Summit Merchant Shop, Campfire, Mystery Event & Treasure Vault render cleanly and operate end-to-end', async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.setViewportSize({ width: 375, height: 667 });

    // 1. Merchant Shop (reuses WeaponExplainer + buying + healing + forging)
    await page.goto('/dev/spire?room=shop&seed=4242');
    await expect(page.getByTestId('spire-shop')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(300);
    await assertAllTextVisible(page, 'Summit Merchant Shop (375x667)');
    await maybeShot(page, '10-spire-shop-375');
    await page.getByTestId('spire-shop-heal').click();
    await page.getByTestId('spire-shop-leave').click();
    await expect(page.getByTestId('spire-map')).toBeVisible({ timeout: 5000 });

    // 2. Campfire (Rest / Forge / Meditate)
    await page.goto('/dev/spire?room=campfire&seed=4242');
    await expect(page.getByTestId('spire-campfire')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);
    await assertAllTextVisible(page, 'Summit Campfire (375x667)');
    await maybeShot(page, '11-spire-campfire-375');
    await page.getByTestId('spire-campfire-rest').click();
    await expect(page.getByTestId('spire-campfire-leave')).toBeVisible({ timeout: 5000 });

    // 3. Mystery Event (handles direct resolution AND multi-step skill/weapon/forge pickers!)
    await page.goto('/dev/spire?room=event&seed=4242');
    await expect(page.getByTestId('spire-event')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);
    await assertAllTextVisible(page, 'Summit Mystery Event (375x667)');
    await maybeShot(page, '12-spire-event-375');
    await page.getByTestId('spire-event-opt-0').click();
    await page.waitForTimeout(250);
    if (await page.getByTestId('spire-event-skill-0').isVisible()) {
      await assertAllTextVisible(page, 'Summit Mystery Event Skill Picker (375x667)');
      await page.getByTestId('spire-event-skill-0').click();
    } else if (await page.getByTestId('spire-event-weapon-0').isVisible()) {
      await page.getByTestId('spire-event-weapon-0').click();
    } else if (await page.locator('[data-testid^="spire-event-forge-"]').first().isVisible()) {
      await page.locator('[data-testid^="spire-event-forge-"]').first().click();
    }
    await expect(page.getByTestId('spire-event-leave')).toBeVisible({ timeout: 5000 });

    // 4. Treasure Vault
    await page.goto('/dev/spire?room=treasure&seed=4242');
    await expect(page.getByTestId('spire-treasure')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);
    await assertAllTextVisible(page, 'Summit Treasure Vault (375x667)');
    await maybeShot(page, '13-spire-treasure-375');
    await page.getByTestId('spire-treasure-coins').click();
    await expect(page.getByTestId('spire-treasure-leave')).toBeVisible({ timeout: 5000 });

    // 5. Full 6/6 Belt in Merchant Shop: Swap button opens inline Swap Picker cleanly at 375px
    await page.goto('/dev/spire?room=shop&fullBelt=true&seed=4242');
    await expect(page.getByTestId('spire-shop')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('spire-open-build')).toContainText('6/6');
    await expect(page.getByTestId('spire-shop-belt-full')).toContainText('BELT 6/6');
    await page.waitForTimeout(250);
    await assertAllTextVisible(page, 'Summit Shop Full 6/6 Belt (375x667)');
    // Click the trailing new swap candidate in the 4-slot shop to open the inline Swap Picker
    const swapCandidate = page.locator('[data-testid^="spire-shop-weapon-"]', { hasText: /^Swap / }).first();
    await expect(swapCandidate).toBeVisible({ timeout: 5000 });
    await swapCandidate.click();
    await expect(page.getByTestId('spire-shop-swap-panel')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(250);
    await assertAllTextVisible(page, 'Summit Shop 6/6 Inline Swap Picker (375x667)');
    await page.locator('[data-testid^="spire-shop-swap-drop-"]').first().click();
    await expect(page.getByTestId('spire-shop-swap-panel')).toBeHidden({ timeout: 5000 });
    await expect(page.getByTestId('spire-open-build')).toContainText('6/6');

    expect(pageErrors).toEqual([]);
  });
});
