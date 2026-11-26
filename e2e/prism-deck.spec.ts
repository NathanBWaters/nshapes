import * as fs from 'fs';
import * as path from 'path';
import { test, expect, type Page } from '@playwright/test';

/**
 * Real-Browser E2E & Visual/Layout Verification Suite for Prism Deck.
 *
 * Covers:
 * - Flow A: Main Menu subtitle + 45s Interactive Tutorial (3 steps + invalid trap + Repaint spell)
 * - Flow B: Full Roguelike Run Loop (5 Starter Decks, Lab Unlock All, Seed, Blind Select,
 *           Blueprint Assist, Live Score Preview, Play Set, Discard, Spells, Deck/Hands modal,
 *           Colorblind, Audio, Desktop Hotkeys, Shop Payout/Buy/Reorder/Reroll, Reload Persistence)
 * - Flow C: URL Deep Link (?mode=prism&seed=SHARE99), Save Backup (PRISM1:), Daily Mutator & Share Card
 * - Flow D: Mobile Portrait (375x667) & Small Phone (320x568) Visual & Layout Audit
 */

const QA_SCREENSHOT_DIR = process.env.PRISM_QA_SCREENSHOT_DIR;

async function captureQaScreenshot(page: Page, filename: string): Promise<void> {
  if (!QA_SCREENSHOT_DIR) return;
  fs.mkdirSync(QA_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(QA_SCREENSHOT_DIR, filename),
    fullPage: false,
  });
}

function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return errors;
}

interface ParsedBoardCard {
  idx: number;
  wild: boolean;
  number: number | null;
  color: 'red' | 'green' | 'purple' | null;
  shape: 'oval' | 'squiggle' | 'diamond' | null;
  edition: string | null;
  debuffed: boolean;
  label: string;
}

async function readBoardCards(page: Page): Promise<ParsedBoardCard[]> {
  const COLOR_ALIAS: Record<string, 'red' | 'green' | 'purple'> = {
    orange: 'red',
    red: 'red',
    blue: 'green',
    teal: 'green',
    green: 'green',
    pink: 'purple',
    purple: 'purple',
  };
  const SHAPE_ALIAS: Record<string, 'oval' | 'squiggle' | 'diamond'> = {
    circle: 'oval',
    oval: 'oval',
    bolt: 'squiggle',
    moon: 'squiggle',
    squiggle: 'squiggle',
    triangle: 'diamond',
    diamond: 'diamond',
  };
  const cards: ParsedBoardCard[] = [];
  for (let i = 0; i < 15; i++) {
    const loc = page.getByTestId(`prism-card-${i}`);
    if ((await loc.count()) === 0) break;
    const label = (await loc.getAttribute('aria-label')) ?? '';
    const isWild = /^Wild\b/i.test(label);
    const debuffed = /\bdebuffed\b/i.test(label);
    const match = label.match(/^([123])\s+(orange|blue|pink|teal|red|green|purple)\s+(circle|bolt|moon|triangle|oval|squiggle|diamond)/i);
    const editionMatch = label.match(/,\s*(Foil|Holo|Polychrome|Glass|Gold|Wild)/i);
    cards.push({
      idx: i,
      wild: isWild,
      number: match ? Number(match[1]) : null,
      color: match ? (COLOR_ALIAS[match[2].toLowerCase()] ?? null) : null,
      shape: match ? (SHAPE_ALIAS[match[3].toLowerCase()] ?? null) : null,
      edition: editionMatch ? editionMatch[1].toLowerCase() : null,
      debuffed,
      label,
    });
  }
  return cards;
}

function isTraitValid(values: (string | number | null)[]): boolean {
  const concrete = values.filter((v): v is string | number => v !== null);
  if (concrete.length <= 2) return true;
  const [a, b, c] = concrete;
  return (a === b && b === c) || (a !== b && b !== c && a !== c);
}

function isValidSetTriple(a: ParsedBoardCard, b: ParsedBoardCard, c: ParsedBoardCard): boolean {
  const trio = [a, b, c];
  const nums = trio.map(x => (x.wild ? null : x.number));
  const cols = trio.map(x => (x.wild ? null : x.color));
  const shps = trio.map(x => (x.wild ? null : x.shape));
  return isTraitValid(nums) && isTraitValid(cols) && isTraitValid(shps);
}

function scoreTripleHeuristic(
  a: ParsedBoardCard,
  b: ParsedBoardCard,
  c: ParsedBoardCard,
  mode: 'high' | 'low'
): number {
  const trio = [a, b, c];
  const distinctTraits = (['number', 'color', 'shape'] as const).reduce((acc, trait) => {
    const concrete = trio.filter(x => !x.wild).map(x => x[trait]);
    const uniq = new Set(concrete);
    const allDiff = concrete.length <= 1 || uniq.size === concrete.length;
    return acc + (allDiff ? 1 : 0);
  }, 0);
  const editions = trio.filter(x => x.edition !== null || x.wild).length;
  const pips = trio.reduce((sum, x) => sum + (x.number ?? 3), 0);
  const squiggleBonus = trio.some(x => x.shape === 'squiggle') ? 0.5 : 0;
  const score = distinctTraits * 100 + editions * 40 + pips + squiggleBonus;
  return mode === 'high' ? score : -score;
}

async function findValidSetOnBoard(
  page: Page,
  mode: 'high' | 'low' = 'high'
): Promise<[number, number, number] | null> {
  const cards = await readBoardCards(page);
  let best: { triple: [number, number, number]; score: number } | null = null;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        if (isValidSetTriple(cards[i], cards[j], cards[k])) {
          const score = scoreTripleHeuristic(cards[i], cards[j], cards[k], mode);
          if (!best || score > best.score) {
            best = { triple: [i, j, k], score };
          }
        }
      }
    }
  }
  return best ? best.triple : null;
}

async function assertNoHorizontalOverflowOrClipping(
  page: Page,
  contextLabel: string
): Promise<void> {
  const violations = await page.evaluate(label => {
    const out: string[] = [];
    const vw = window.innerWidth;

    if (document.documentElement.scrollWidth > vw + 2) {
      out.push(
        `[${label}] Document horizontal overflow: scrollWidth=${document.documentElement.scrollWidth} > innerWidth=${vw}`
      );
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
      const clippingAncestors: { rect: DOMRect }[] = [];
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
          clippingAncestors.push({ rect: anc.getBoundingClientRect() });
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

test.describe('Prism Deck — Real-Browser E2E & Visual QA Suite', () => {
  test('Flow A: Main Menu + 45s Interactive Tutorial on Desktop (1280x800)', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = attachErrorCollector(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/?labs=1');
    await expect(page.getByTestId('menu-prism')).toBeVisible({ timeout: 20_000 });

    // Verify updated subtitle & absence of legacy "Match-Three" copy
    await expect(page.getByText('Pattern-Matching Roguelike', { exact: false })).toBeVisible();
    await expect(page.getByText('Match-Three', { exact: false })).toHaveCount(0);

    // Enter Prism Deck on a fresh save → auto-launches PrismTutorial
    await page.getByTestId('menu-prism').click();
    await expect(page.getByTestId('prism-tutorial-skip')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('STEP 1 OF 3', { exact: false })).toBeVisible();

    // Step 1: tap 3 Red Diamonds → play valid Set → advances to Step 2
    await page.getByTestId('prism-tutorial-card-0').click();
    await page.getByTestId('prism-tutorial-card-1').click();
    await page.getByTestId('prism-tutorial-card-2').click();
    await expect(page.getByTestId('prism-tutorial-play')).toContainText('PLAY TRIO!');
    await page.getByTestId('prism-tutorial-play').click();
    await expect(page.getByTestId('prism-tutorial-celebration')).toBeVisible();
    await page.getByTestId('prism-tutorial-next').click();

    // Step 2: intentionally tap INVALID 3-card combo (the trap!) → verify inline feedback & ZERO penalty
    await expect(page.getByText('STEP 2 OF 3', { exact: false })).toBeVisible();
    await page.getByTestId('prism-tutorial-card-0').click();
    await page.getByTestId('prism-tutorial-card-1').click();
    await page.getByTestId('prism-tutorial-card-2').click(); // trap: 3 Red Diamonds (2 reds + 1 green)
    const diag = page.getByTestId('prism-tutorial-diagnostic');
    await expect(diag).toBeVisible();
    await expect(diag).toContainText('zero punishment');
    await expect(diag).toContainText('Color ✗');
    await expect(diag).toContainText('Shape ✓');
    await expect(diag).toContainText('Number ✓');
    // Tapping Check Set gives zero penalty and keeps user on Step 2
    await page.getByTestId('prism-tutorial-play').click();
    await expect(page.getByText('Zero penalty! Check the red X pill', { exact: false })).toBeVisible();

    // Swap out trap card (idx 2) for 3 Purple Diamonds (idx 3) → valid True Rainbow!
    await page.getByTestId('prism-tutorial-card-2').click();
    await page.getByTestId('prism-tutorial-card-3').click();
    await expect(page.getByTestId('prism-tutorial-play')).toContainText('PLAY TRIO!');
    await page.getByTestId('prism-tutorial-play').click();
    await expect(page.getByTestId('prism-tutorial-celebration')).toBeVisible();
    await expect(page.getByTestId('prism-tutorial-celebration')).toContainText('True Rainbow');
    await page.getByTestId('prism-tutorial-next').click();

    // Step 3: use Repaint spell on top-right 3 Red Diamonds (idx 2) → Purple to forge Prismatic Crown >= 250
    await expect(page.getByText('STEP 3 OF 3', { exact: false })).toBeVisible();
    await page.getByTestId('prism-tutorial-spell-repaint').click();
    await page.getByTestId('prism-tutorial-card-2').click();
    await page.getByTestId('prism-tutorial-repaint-purple').click();
    await expect(page.getByTestId('prism-tutorial-spell-repaint')).toContainText('Repaint Used');

    await page.getByTestId('prism-tutorial-card-0').click();
    await page.getByTestId('prism-tutorial-card-1').click();
    await page.getByTestId('prism-tutorial-card-2').click();
    await expect(page.getByText('Rainbow Charm ×2', { exact: false })).toBeVisible();
    await page.getByTestId('prism-tutorial-play').click();

    await expect(page.getByTestId('prism-tutorial-celebration')).toBeVisible();
    await expect(page.getByTestId('prism-tutorial-celebration')).toContainText('Blind Smashed');
    await page.getByTestId('prism-tutorial-finish').click();

    // Completes tutorial and enters PrismSetup
    await expect(page.getByTestId('prism-start-run')).toBeVisible({ timeout: 10_000 });
    expect(errors).toEqual([]);
  });

  test('Flow B: Full Roguelike Run Loop + Deck/Hands/Spells/Shop/Reorder/Reload Persistence (1280x800)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = attachErrorCollector(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/?labs=1');
    await expect(page.getByTestId('menu-prism')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('menu-prism').click();
    await expect(page.getByTestId('prism-tutorial-skip')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('prism-tutorial-skip').click();
    await expect(page.getByTestId('prism-start-run')).toBeVisible({ timeout: 10_000 });

    // Verify all 5 Starter Decks render
    for (const deckId of [
      'classic_prism',
      'gilded_ledger',
      'alchemist_grimoire',
      'vast_table',
      'glass_mirage',
    ]) {
      await expect(page.getByTestId(`prism-deck-${deckId}`)).toBeVisible();
    }

    // Verify "Lab: Unlock All" toggle unlocks Spellcraft (Alchemist) Deck
    await expect(page.getByTestId('prism-deck-alchemist_grimoire')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await page.getByTestId('prism-unlock-all').click();
    await expect(page.getByTestId('prism-unlock-all')).toContainText('ON');
    await expect(page.getByTestId('prism-deck-alchemist_grimoire')).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await page.getByTestId('prism-deck-alchemist_grimoire').click();

    // Custom Seed input PLAYTEST42
    await page.getByTestId('prism-seed-input').fill('PLAYTEST42');
    await expect(page.getByTestId('prism-seed-input')).toHaveValue('PLAYTEST42');
    await page.getByTestId('prism-start-run').click();

    // Blind Select: verify Small / Big / Boss Blinds visible
    await expect(page.getByTestId('prism-blind-card-small')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('prism-blind-card-big')).toBeVisible();
    await expect(page.getByTestId('prism-blind-card-boss')).toBeVisible();
    await page.waitForTimeout(300);
    await captureQaScreenshot(page, 'qa-prism-blindselect.png');

    // Play Small Blind cleanly
    await page.getByTestId('prism-play-blind').click();
    await expect(page.getByTestId('prism-card-0')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('prism-card-8')).toBeVisible();
    await expect(page.getByTestId('prism-card-9')).toHaveCount(0);

    // Select 2 cards → verify Blueprint Assist toggle + Blueprint Need pill
    await page.getByTestId('prism-card-0').click();
    await page.getByTestId('prism-card-1').click();
    const bpBtn = page.getByTestId('prism-toggle-blueprint');
    const bpLabelBefore = (await bpBtn.getAttribute('aria-label')) ?? '';
    if (bpLabelBefore.includes('on')) {
      await expect(page.getByTestId('prism-blueprint-pill')).toBeVisible();
      await bpBtn.click();
      await expect(page.getByTestId('prism-blueprint-pill')).toHaveCount(0);
      await bpBtn.click();
      await expect(page.getByTestId('prism-blueprint-pill')).toBeVisible();
    } else {
      await bpBtn.click();
      await expect(page.getByTestId('prism-blueprint-pill')).toBeVisible();
    }
    await page.getByTestId('prism-clear').click();

    // Find a low-scoring valid Set first so Hand 1 always decrements Hands (4 → 3) & increases score
    // before clearing Small Blind (600), ensuring every mid-blind control runs cleanly
    const firstSet = await findValidSetOnBoard(page, 'low');
    expect(firstSet, 'Board must contain at least one valid Set').not.toBeNull();
    const [a, b, c] = firstSet!;
    await page.getByTestId(`prism-card-${a}`).click();
    await page.getByTestId(`prism-card-${b}`).click();
    await page.getByTestId(`prism-card-${c}`).click();

    const playBtn = page.getByTestId('prism-play-set');
    await expect(playBtn).toBeEnabled();
    await expect(playBtn).toContainText('PLAY TRIO (+');
    await page.waitForTimeout(350);

    // Capture desktop Play Screen screenshot showing 9-card felt table, fixed Squiggle, live preview, and Belt
    await captureQaScreenshot(page, 'qa-prism-desktop-play.png');

    // Play the Set → verify Hands decrement by 1, +SCORE hit badge & score receipt appear
    const handsBefore = Number((await page.getByTestId('prism-hands-left').innerText()).trim());
    await playBtn.click();
    await page.waitForTimeout(250);

    const clearedOnHand1 = await page.getByTestId('prism-cash-out-overlay').isVisible();
    if (!clearedOnHand1) {
      const handsAfter = Number((await page.getByTestId('prism-hands-left').innerText()).trim());
      expect(handsAfter).toBe(handsBefore - 1);
      await expect(page.getByTestId('prism-last-hit-badge')).toBeVisible();
      await expect(page.getByTestId('prism-score-receipt')).toBeVisible();
      await expect(page.getByTestId('prism-score-receipt')).toContainText('LAST:');
    }

    // If we cleared Small Blind on hand 1, we'll test Discard/Spells/Deck/CB/Audio/Hotkeys on Big Blind;
    // otherwise test them right here before finishing Small Blind!
    const runPlayControlsAudit = async () => {
      // Test DISCARD on 2 cards → verify Discards decrement
      const discardsBefore = Number(
        (await page.getByTestId('prism-discards-left').innerText()).trim()
      );
      expect(discardsBefore).toBeGreaterThan(0);
      await page.getByTestId('prism-card-0').click();
      await page.getByTestId('prism-card-1').click();
      await page.getByTestId('prism-discard').click();
      const discardsAfter = Number(
        (await page.getByTestId('prism-discards-left').innerText()).trim()
      );
      expect(discardsAfter).toBe(discardsBefore - 1);

      // Test casting starter Spell (prism-spell-0 = Repaint) on board card 0
      await expect(page.getByTestId('prism-spell-0')).toBeVisible();
      const card0LabelBefore = (await page.getByTestId('prism-card-0').getAttribute('aria-label')) ?? '';
      await page.getByTestId('prism-spell-0').click();
      await expect(page.getByTestId('prism-spell-targeting-bar')).toBeVisible();
      await page.getByTestId('prism-card-0').click();
      if (await page.getByTestId('prism-spell-value-picker').isVisible()) {
        const nextColor = /\b(orange|red)\b/i.test(card0LabelBefore) ? 'green' : 'red';
        await page.getByTestId(`prism-spell-val-${nextColor}`).click();
      }
      await expect(page.getByTestId('prism-spell-targeting-bar')).toHaveCount(0);
      await expect(page.getByTestId('prism-toast')).toBeVisible();

      // Open Deck modal and switch to Hands tab → verify content renders & closes
      await page.getByTestId('prism-open-deck').click();
      await expect(page.getByText('TOTAL DECK', { exact: true })).toBeVisible();
      await page.getByTestId('prism-modal-tab-hands').click();
      await expect(page.getByText('Prismatic Crown', { exact: true })).toBeVisible();
      await expect(page.getByText('True Rainbow', { exact: true })).toBeVisible();
      await page.getByTestId('prism-deck-modal-close').click();
      await expect(page.getByTestId('prism-modal-tab-hands')).toHaveCount(0);

      // Toggle Colorblind Mode & Audio → verify zero errors
      await page.getByTestId('prism-toggle-colorblind').click();
      await expect(page.getByTestId('prism-toggle-colorblind')).toHaveAttribute(
        'aria-label',
        'Colorblind mode on'
      );
      await page.getByTestId('prism-toggle-colorblind').click();
      await expect(page.getByTestId('prism-toggle-colorblind')).toHaveAttribute(
        'aria-label',
        'Colorblind mode off'
      );

      const audioBtn = page.getByTestId('prism-toggle-audio');
      const audioBefore = (await audioBtn.innerText()).trim();
      await audioBtn.click();
      const audioAfter = (await audioBtn.innerText()).trim();
      expect(audioAfter).not.toBe(audioBefore);
      await audioBtn.click();
      await audioBtn.click();

      // Test desktop keyboard shortcuts: 1, 2 (select), C (clear), H (toggle hint), Escape (pause)
      await page.keyboard.press('1');
      await page.keyboard.press('2');
      await expect(page.getByTestId('prism-play-set')).toContainText('(2/3)');
      await page.keyboard.press('c');
      await expect(page.getByTestId('prism-play-set')).toContainText('(0/3)');

      const hintLabelBefore = (await page.getByTestId('prism-toggle-blueprint').getAttribute('aria-label')) ?? '';
      await page.keyboard.press('h');
      const hintLabelAfter = (await page.getByTestId('prism-toggle-blueprint').getAttribute('aria-label')) ?? '';
      expect(hintLabelAfter).not.toBe(hintLabelBefore);
      await page.keyboard.press('h');

      await page.keyboard.press('Escape');
      await expect(page.getByTestId('prism-pause-modal')).toBeVisible();

      // Keyboard lockout behind Pause: 1 / D / Enter must be ignored while Pause is open
      const handsWhilePaused = (await page.getByTestId('prism-hands-left').innerText()).trim();
      const discardsWhilePaused = (await page.getByTestId('prism-discards-left').innerText()).trim();
      await page.keyboard.press('1');
      await page.keyboard.press('d');
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('prism-pause-modal')).toBeVisible();
      await expect(page.getByTestId('prism-play-set')).toContainText('(0/3)');
      await expect(page.getByTestId('prism-hands-left')).toHaveText(handsWhilePaused);
      await expect(page.getByTestId('prism-discards-left')).toHaveText(discardsWhilePaused);

      // Escape closes Pause cleanly
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('prism-pause-modal')).toHaveCount(0);
    };

    if (!clearedOnHand1) {
      await runPlayControlsAudit();

      // Also cast Glass Stamp (now prism-spell-0) on a card in the next valid Set to ensure crisp Blind clear
      const nextSet = await findValidSetOnBoard(page, 'high');
      expect(nextSet).not.toBeNull();
      if (await page.getByTestId('prism-spell-0').isVisible()) {
        await page.getByTestId('prism-spell-0').click();
        await page.getByTestId(`prism-card-${nextSet![0]}`).click();
      }

      // Play valid Sets until Blind clears into the Balatro Cash Out Overlay
      for (let attempt = 0; attempt < 5; attempt++) {
        if (await page.getByTestId('prism-cash-out-overlay').isVisible()) break;
        const set = await findValidSetOnBoard(page, 'high');
        expect(set, 'Board should have a playable Set').not.toBeNull();
        await page.getByTestId(`prism-card-${set![0]}`).click();
        await page.getByTestId(`prism-card-${set![1]}`).click();
        await page.getByTestId(`prism-card-${set![2]}`).click();
        await page.getByTestId('prism-play-set').click();
        await page.waitForTimeout(250);
      }
    }

    // Verify Balatro Cash Out Overlay appears over the felt table before opening Shop
    await expect(page.getByTestId('prism-cash-out-overlay')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('prism-cash-out-overlay')).toContainText('BLIND CLEARED!');
    await expect(page.getByTestId('prism-cash-out-overlay')).toContainText('Unused Hands');
    await page.waitForTimeout(300);
    await captureQaScreenshot(page, 'qa-prism-cashout-desktop.png');
    await page.getByTestId('prism-cash-out-btn').click();

    // Enter PrismShop → verify Payout Breakdown
    await expect(page.getByTestId('prism-shop-leave')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('prism-shop-payout')).toBeVisible();
    await expect(page.getByTestId('prism-shop-payout')).toContainText('Base +$');
    await expect(page.getByTestId('prism-shop-payout')).toContainText('Unused Hands +$');
    await expect(page.getByTestId('prism-shop-payout')).toContainText('Interest +$');
    await page.waitForTimeout(300);

    // Capture desktop Shop screenshot
    await captureQaScreenshot(page, 'qa-prism-shop-desktop.png');

    // Buy the cheapest affordable Charm (Spellcraft starts with 1 Charm → now 2 Charms so we can reorder!)
    let boughtCharm = false;
    let cheapestCharmIdx = -1;
    let cheapestCharmPrice = Infinity;
    for (let i = 0; i < 3; i++) {
      const btn = page.getByTestId(`prism-shop-charm-${i}`);
      const isDisabled = (await btn.getAttribute('aria-disabled')) === 'true';
      if (!isDisabled) {
        const txt = await btn.innerText();
        const priceMatch = txt.match(/\$(\d+)/);
        const price = priceMatch ? Number(priceMatch[1]) : 0;
        if (price < cheapestCharmPrice) {
          cheapestCharmPrice = price;
          cheapestCharmIdx = i;
        }
      }
    }
    if (cheapestCharmIdx >= 0) {
      await page.getByTestId(`prism-shop-charm-${cheapestCharmIdx}`).click();
      await expect(page.getByTestId(`prism-shop-charm-${cheapestCharmIdx}`)).toContainText('SOLD');
      boughtCharm = true;
    }
    expect(boughtCharm, 'Should be able to buy at least one Charm in Shop').toBe(true);

    // Inspect & Reorder Charm on belt
    const slot0Before = (await page.getByTestId('prism-charm-slot-0').getAttribute('aria-label')) ?? '';
    const slot1Before = (await page.getByTestId('prism-charm-slot-1').getAttribute('aria-label')) ?? '';
    await page.getByTestId('prism-charm-slot-0').click();
    await expect(page.getByTestId('prism-charm-inspector')).toBeVisible();
    await page.getByTestId('prism-charm-move-right').click();
    const slot0After = (await page.getByTestId('prism-charm-slot-0').getAttribute('aria-label')) ?? '';
    const slot1After = (await page.getByTestId('prism-charm-slot-1').getAttribute('aria-label')) ?? '';
    expect(slot0After).toBe(slot1Before);
    expect(slot1After).toBe(slot0Before);

    // Buy a Star Chart
    let boughtChart = false;
    for (let i = 0; i < 2; i++) {
      const btn = page.getByTestId(`prism-shop-chart-${i}`);
      const isDisabled = (await btn.getAttribute('aria-disabled')) === 'true';
      if (!isDisabled) {
        await btn.click();
        await expect(btn).toContainText('SOLD');
        boughtChart = true;
        break;
      }
    }
    expect(boughtChart, 'Should be able to buy a Star Chart in Shop').toBe(true);

    // Click Reroll (if gold fell below reroll cost after buying Charm + Star Chart, sell a charm)
    const rerollBtn = page.getByTestId('prism-shop-reroll');
    if ((await rerollBtn.getAttribute('aria-disabled')) === 'true') {
      await page.getByTestId('prism-charm-slot-1').click();
      await page.getByTestId('prism-charm-sell').click();
    }
    await expect(rerollBtn).not.toHaveAttribute('aria-disabled', 'true');
    const rerollLabelBefore = (await rerollBtn.innerText()).trim();
    await rerollBtn.click();
    const rerollLabelAfter = (await rerollBtn.innerText()).trim();
    expect(rerollLabelAfter).not.toBe(rerollLabelBefore);

    // Leave Shop → Next Blind
    await page.getByTestId('prism-shop-leave').click();
    await expect(page.getByTestId('prism-blind-card-big')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('prism-blind-card-small')).toContainText('CLEARED');
    await expect(page.getByTestId('prism-blind-card-big')).toContainText('UP NEXT');

    // Capture exact gold before reload
    const goldTextBeforeReload = (
      await page.locator('text=/^\\$\\d+$/').first().innerText()
    ).trim();

    // If we cleared Small Blind on hand 1 above, run the Play controls audit now on Big Blind before reload?
    // Wait: better to test reload persistence right here on Blind Select, then resume, then skip Big Blind!
    await page.reload();
    await expect(page.getByTestId('menu-prism')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('menu-prism')).toContainText('LIVE RUN');
    await expect(page.getByTestId('menu-prism')).toContainText('Ante 1');
    await expect(page.getByTestId('menu-prism')).toContainText(goldTextBeforeReload);

    // Resume directly back into the exact Ante/Blind/Gold state — first verify 2-tap "Replace Live Run?" guard!
    await page.getByTestId('menu-prism').click();
    await expect(page.getByTestId('prism-resume-run')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('prism-resume-run')).toContainText('Ante 1');
    await expect(page.getByTestId('prism-resume-run')).toContainText(goldTextBeforeReload);

    await page.getByTestId('prism-start-run').click();
    await expect(page.getByTestId('prism-start-run')).toContainText('Replace Live Run?');
    await expect(page.getByTestId('prism-cancel-start-run')).toBeVisible();
    await page.getByTestId('prism-cancel-start-run').click();
    await expect(page.getByTestId('prism-resume-run')).toBeVisible();

    await page.getByTestId('prism-resume-run').click();

    await expect(page.getByTestId('prism-blind-card-big')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('prism-blind-card-small')).toContainText('CLEARED');
    await expect(page.getByTestId('prism-blind-card-big')).toContainText('UP NEXT');
    await expect(page.locator('text=/^\\$\\d+$/').first()).toHaveText(goldTextBeforeReload);

    if (clearedOnHand1) {
      await page.getByTestId('prism-play-blind').click();
      await expect(page.getByTestId('prism-card-0')).toBeVisible({ timeout: 10_000 });
      await runPlayControlsAudit();
    } else {
      // Also exercise Skip for Tag on Big Blind
      await page.getByTestId('prism-skip-blind').click();
      await expect(page.getByTestId('prism-blind-card-big')).toContainText('SKIPPED');
      await expect(page.getByTestId('prism-blind-card-boss')).toContainText('UP NEXT');
    }

    expect(errors).toEqual([]);
  });

  test('Flow C: URL Deep Link (?mode=prism&seed=SHARE99) + Save Backup + Daily Challenge + Share Card', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = attachErrorCollector(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate directly to deep link (with Labs enabled) → bypasses tutorial and pre-populates seed SHARE99
    await page.goto('/?labs=1&mode=prism&seed=SHARE99');
    await expect(page.getByTestId('prism-seed-input')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('prism-seed-input')).toHaveValue('SHARE99');
    await expect(page.getByText('Loaded shared Seed "SHARE99"', { exact: false })).toBeVisible();

    // Open Setup Save Backup modal → verify export code starts with PRISM1:
    await page.getByTestId('prism-backup-open').click();
    await expect(page.getByTestId('prism-backup-copy')).toBeVisible();
    await expect(page.getByText(/^PRISM1:/)).toBeVisible();
    await page.getByTestId('prism-backup-copy').click();
    await expect(page.getByTestId('prism-backup-copy')).toContainText('Copied Backup Code');
    await page.getByTestId('prism-backup-close').click();

    // Switch to Daily tab → start Today's Daily → verify Daily Mutator active
    await page.getByTestId('prism-tab-daily').click();
    await expect(page.getByText("TODAY'S DAILY MUTATOR", { exact: false })).toBeVisible();
    await page.getByTestId('prism-start-daily').click();

    // On Blind Select, verify Daily Mutator chip is rendered
    await expect(page.getByTestId('prism-blind-card-small')).toBeVisible({ timeout: 10_000 });
    const mutatorNames = [
      'Golden Rush',
      'Rainbow Fever',
      'Glass House',
      'Tight Quarters',
      'Spellstorm',
      'Charm Parade',
      'Wild Twist',
    ];
    const bodyText = await page.locator('body').innerText();
    expect(
      mutatorNames.some(name => bodyText.includes(name)),
      `Expected one of the Daily Mutators (${mutatorNames.join(', ')}) to be visible on Blind Select`
    ).toBe(true);

    // Skip Small + Big Blind → enter Ante 1 Boss Blind → play lowest-scoring sets to reach Results & verify Share Card
    await page.getByTestId('prism-skip-blind').click();
    await page.getByTestId('prism-skip-blind').click();
    await page.getByTestId('prism-play-blind').click();
    await expect(page.getByTestId('prism-card-0')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('prism-boss-rule')).toBeVisible();

    for (let hand = 0; hand < 8; hand++) {
      if (await page.getByTestId('prism-share-run').isVisible()) break;
      if (await page.getByTestId('prism-cash-out-overlay').isVisible()) break;
      if (await page.getByTestId('prism-shop-leave').isVisible()) break;
      const set = await findValidSetOnBoard(page, 'low');
      if (!set) break;
      await page.getByTestId(`prism-card-${set[0]}`).click();
      await page.getByTestId(`prism-card-${set[1]}`).click();
      await page.getByTestId(`prism-card-${set[2]}`).click();
      await page.getByTestId('prism-play-set').click();
      await page.waitForTimeout(200);
    }

    if (await page.getByTestId('prism-share-run').isVisible()) {
      await expect(page.getByText('SPOILER-FREE SHARE CARD')).toBeVisible();
      await expect(page.getByText('Prism Deck', { exact: false })).toBeVisible();
      await page.getByTestId('prism-share-run').click();
      await expect(page.getByTestId('prism-share-run')).toContainText('Copied Share Card!');
    }

    expect(errors).toEqual([]);
  });

  test('Flow D: Mobile Portrait (375x667) & Small Phone (320x568) Visual & Layout Audit', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = attachErrorCollector(page);

    // 1. Small Phone 320x568 Main Menu audit
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/?labs=1');
    await expect(page.getByTestId('menu-prism')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(300);
    await assertNoHorizontalOverflowOrClipping(page, 'Main Menu (320x568)');
    for (const id of ['menu-adventure', 'menu-spire', 'menu-prism', 'menu-freeplay', 'menu-options']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `${id} should have bounding box on 320x568`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(321);
    }

    // 2. Mobile Portrait 375x667 Main Menu audit + screenshot
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    await assertNoHorizontalOverflowOrClipping(page, 'Main Menu (375x667)');
    await captureQaScreenshot(page, 'qa-menu-mobile.png');

    // 3. Prism Setup at 375x667
    await page.getByTestId('menu-prism').click();
    await expect(page.getByTestId('prism-tutorial-skip')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('prism-tutorial-skip').click();
    await expect(page.getByTestId('prism-start-run')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(250);
    await assertNoHorizontalOverflowOrClipping(page, 'Prism Setup (375x667)');
    const startBtnBox = await page.getByTestId('prism-start-run').boundingBox();
    expect(startBtnBox!.height).toBeGreaterThanOrEqual(40);

    // Use deterministic seed for crisp mobile run
    await page.getByTestId('prism-seed-input').fill('MOBILE42');
    await page.getByTestId('prism-start-run').click();

    // 4. Prism Blind Select at 375x667
    await expect(page.getByTestId('prism-play-blind')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(250);
    await assertNoHorizontalOverflowOrClipping(page, 'Prism Blind Select (375x667)');
    const playBlindBox = await page.getByTestId('prism-play-blind').boundingBox();
    expect(playBlindBox!.height).toBeGreaterThanOrEqual(40);

    // 5. Prism Play Screen at 375x667 with Colorblind ON
    await page.getByTestId('prism-play-blind').click();
    await expect(page.getByTestId('prism-card-0')).toBeVisible({ timeout: 10_000 });

    // Enable Colorblind Mode
    await page.getByTestId('prism-toggle-colorblind').click();
    await expect(page.getByTestId('prism-toggle-colorblind')).toHaveAttribute(
      'aria-label',
      'Colorblind mode on'
    );
    await page.waitForTimeout(300);

    await assertNoHorizontalOverflowOrClipping(page, 'Prism Play Screen (375x667)');

    // Verify primary action buttons >= 40px and fit cleanly above the fold within 375x667
    let actionBarTop = 667;
    for (const btnId of ['prism-play-set', 'prism-discard', 'prism-clear']) {
      const box = await page.getByTestId(btnId).boundingBox();
      expect(box, `${btnId} should be visible`).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(40);
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(376);
      expect(box!.y + box!.height).toBeLessThanOrEqual(668);
      actionBarTop = Math.min(actionBarTop, box!.y);
    }

    // Verify ALL 9 cards on the 3×3 default board are visible, tappable, within 375px width, AND cleanly above the sticky action bar (zero scroll!)
    for (let i = 0; i < 9; i++) {
      const cardLoc = page.getByTestId(`prism-card-${i}`);
      await expect(cardLoc).toBeVisible();
      const box = await cardLoc.boundingBox();
      expect(box, `prism-card-${i} should have valid box`).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(60);
      expect(box!.height).toBeGreaterThanOrEqual(64);
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(376);
      expect(box!.y, `prism-card-${i} top must be on-screen`).toBeGreaterThanOrEqual(0);
      expect(
        box!.y + box!.height,
        `prism-card-${i} bottom (${Math.round(box!.y + box!.height)}px) must fit above action bar (${Math.round(actionBarTop)}px)`
      ).toBeLessThanOrEqual(actionBarTop + 1);
    }
    await expect(page.getByTestId('prism-card-9')).toHaveCount(0);

    // Capture mobile Play Screen screenshot with Colorblind ON
    await captureQaScreenshot(page, 'qa-prism-mobile-play.png');

    // Clear Small Blind on mobile → verify Cash Out overlay → audit Prism Shop at 375x667
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await page.getByTestId('prism-cash-out-overlay').isVisible()) break;
      const set = await findValidSetOnBoard(page, 'high');
      expect(set).not.toBeNull();
      await page.getByTestId(`prism-card-${set![0]}`).click();
      await page.getByTestId(`prism-card-${set![1]}`).click();
      await page.getByTestId(`prism-card-${set![2]}`).click();
      await page.getByTestId('prism-play-set').click();
      await page.waitForTimeout(250);
    }

    await expect(page.getByTestId('prism-cash-out-overlay')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('prism-cash-out-btn').click();
    await expect(page.getByTestId('prism-shop-leave')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(300);
    await assertNoHorizontalOverflowOrClipping(page, 'Prism Shop (375x667)');
    for (const btnId of ['prism-shop-reroll', 'prism-shop-leave']) {
      const box = await page.getByTestId(btnId).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(40);
      expect(box!.x + box!.width).toBeLessThanOrEqual(376);
    }

    expect(errors).toEqual([]);
  });
});
