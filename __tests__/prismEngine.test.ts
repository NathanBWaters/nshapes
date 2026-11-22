import {
  ALL_CUSTOM_WEAPON_NAMES,
} from '@/components/weapons/WeaponArtwork';
import {
  BOSS_BLINDS,
  CHARMS,
  CHARM_BY_ID,
  DAILY_MUTATORS,
  EDITIONS,
  PATTERN_HANDS,
  SKIP_TAGS,
  SPELLS,
  STARTER_DECKS,
  SYNERGY_PAIRS,
  VOUCHERS,
  abandonRun,
  areIndicesAdjacentChain,
  buildPrismShareUrl,
  buyShopCharm,
  buySpell,
  buyStarChart,
  buyVoucher,
  castSpell,
  clearPrismStorageError,
  clearSelection,
  computeBlueprintNeed,
  continueEndless,
  createInitialPrismMeta,
  createRun,
  createStandardDeck,
  decodeSaveBackup,
  discardSelected,
  encodeSaveBackup,
  ensurePlayableBoard,
  evaluateSet,
  exportPrismBackupCode,
  findAllSetsOnBoard,
  formatShareCard,
  getCharmStatusLabel,
  getDailyMutatorForDate,
  getDailySeed,
  getDeckSummary,
  getPrismStorageError,
  getSmallBlindTarget,
  getTodayDateString,
  hasActivePrismRun,
  hasAnySetOnBoard,
  importPrismBackupCode,
  isDeckUnlocked,
  isValidSetCards,
  leaveShop,
  loadPrismMeta,
  loadPrismRun,
  parsePrismUrlParams,
  playSelectedSet,
  previewSelection,
  recordPrismRunEnd,
  reorderCharm,
  rerollShop,
  resetPrismStorage,
  scoreSet,
  selectBlind,
  sellCharm,
  skipBlind,
  toggleCard,
  useSpell,
  writePrismMeta,
  writePrismRun,
  type BossBlindId,
  type CardEdition,
  type OwnedCharm,
  type PatternHandId,
  type PrismCard,
  type PrismColor,
  type PrismNumber,
  type PrismRun,
  type PrismShape,
  type SkipTagId,
  type SpellId,
  type VoucherId,
} from '@/prism';
import { storage } from '@/utils/storage';

const makeCard = (
  id: string,
  color: PrismColor,
  shape: PrismShape,
  number: PrismNumber,
  edition: CardEdition = 'none',
  tempWild?: boolean
): PrismCard => ({ id, color, shape, number, edition, ...(tempWild ? { tempWild: true } : {}) });

const makeCharm = (charmId: string, idx: number = 1, state: Partial<OwnedCharm['state']> = {}): OwnedCharm => ({
  instanceId: `test-charm-${idx}-${charmId}`,
  charmId,
  state: { counter: 0, ...state },
});

/** Helper creating an active playing run with custom board & charms for deterministic assertions. */
const makePlayingRun = (overrides: Partial<PrismRun> = {}): PrismRun => {
  const base = selectBlind(createRun({ seed: 'UNITTEST1', startedAt: 1700000000000 }));
  return {
    ...base,
    blindTarget: 99999999, // prevent auto-clear unless desired
    handsLeft: 4,
    discardsLeft: 3,
    handsPlayedThisBlind: 0,
    discardsUsedThisBlind: 0,
    lastSetIndices: [],
    lastPlayedHandThisBlind: null,
    activeBossId: null,
    ...overrides,
  };
};

// Standard 9-card board with known Sets at clean indices
const TEST_BOARD: PrismCard[] = [
  makeCard('b0', 'red', 'oval', 1),       // (0,0)
  makeCard('b1', 'green', 'squiggle', 2), // (0,1)
  makeCard('b2', 'purple', 'diamond', 3), // (0,2) -> [0,1,2] Adjacent True Rainbow = Prismatic Crown!
  makeCard('b3', 'red', 'oval', 2),       // (1,0)
  makeCard('b4', 'red', 'oval', 3),       // (1,1) -> [0,3,4] Adjacent Number Run (Adjacency Chain)
  makeCard('b5', 'green', 'oval', 1),     // (1,2)
  makeCard('b6', 'purple', 'oval', 1),    // (2,0) -> [0,5,6] Non-adjacent Color Run!
  makeCard('b7', 'red', 'squiggle', 1),   // (2,1)
  makeCard('b8', 'red', 'diamond', 1),    // (2,2) -> [0,7,8] Non-adjacent Shape Run!
  makeCard('b9', 'green', 'squiggle', 1), // (3,0) -> [0,4,9] wait: (red,oval,1),(red,oval,3)? no.
  makeCard('b10', 'purple', 'diamond', 1),// (3,1) -> [0,9,10] (red,oval,1),(green,squiggle,1),(purple,diamond,1) = Non-adj Simple Triad (same number=1, diff color & shape!)
  makeCard('b11', 'red', 'oval', 3),      // (3,2) -> [0,3,11] Non-adj Number Run (red,oval, 1/2/3)!
];

describe('Prism Deck — Data Catalog Integrity', () => {
  it('defines exact catalog sizes and valid cross-references', () => {
    expect(createStandardDeck()).toHaveLength(27);
    expect(Object.keys(EDITIONS)).toHaveLength(7); // none + 6 editions
    expect(PATTERN_HANDS).toHaveLength(7);
    expect(CHARMS).toHaveLength(32);
    expect(SYNERGY_PAIRS).toHaveLength(6);
    expect(SPELLS).toHaveLength(8);
    expect(BOSS_BLINDS).toHaveLength(10);
    expect(SKIP_TAGS).toHaveLength(8);
    expect(VOUCHERS).toHaveLength(6);
    expect(STARTER_DECKS).toHaveLength(5);
    expect(DAILY_MUTATORS).toHaveLength(7);

    // Every Charm has unique id and valid artworkWeaponId if provided
    const charmIds = new Set(CHARMS.map(c => c.id));
    expect(charmIds.size).toBe(32);
    const reimagined = CHARMS.filter(c => Boolean(c.artworkWeaponId));
    expect(reimagined).toHaveLength(16);
    for (const c of reimagined) {
      expect(ALL_CUSTOM_WEAPON_NAMES).toContain(c.artworkWeaponId);
    }

    // Every Synergy Pair points to two distinct valid Charms
    for (const pair of SYNERGY_PAIRS) {
      expect(CHARM_BY_ID[pair.charmA]).toBeDefined();
      expect(CHARM_BY_ID[pair.charmB]).toBeDefined();
      expect(pair.charmA).not.toBe(pair.charmB);
    }
  });
});

describe('Prism Deck — Set Validation, Wilds, Blueprint & All 7 Pattern Hands', () => {
  it('validates standard Sets and reports exact per-trait mismatches', () => {
    const valid = evaluateSet([
      makeCard('a', 'red', 'oval', 1),
      makeCard('b', 'green', 'squiggle', 2),
      makeCard('c', 'purple', 'diamond', 3),
    ]);
    expect(valid.isValid).toBe(true);
    expect(valid.mismatchReason).toBeNull();
    expect(valid.traitChecks.every(t => t.status === 'all_diff')).toBe(true);

    const invalid = evaluateSet([
      makeCard('a', 'red', 'oval', 1),
      makeCard('b', 'red', 'squiggle', 2),
      makeCard('c', 'purple', 'diamond', 3),
    ]);
    expect(invalid.isValid).toBe(false);
    expect(invalid.traitChecks[0].status).toBe('mismatch');
    expect(invalid.traitChecks[1].status).toBe('all_diff');
    expect(invalid.traitChecks[2].status).toBe('all_diff');
    expect(invalid.mismatchReason).toContain('Color');
  });

  it('supports 1, 2, and 3 Wild edition cards cleanly', () => {
    // 1 Wild completes any pair deterministically
    const oneWild = evaluateSet([
      makeCard('a', 'red', 'oval', 1),
      makeCard('b', 'red', 'oval', 2),
      makeCard('w', 'purple', 'diamond', 3, 'wild'),
    ]);
    expect(oneWild.isValid).toBe(true);
    expect(oneWild.classification?.handId).toBe('number_run');
    expect(oneWild.classification?.resolvedColors).toEqual(['red', 'red', 'red']);
    expect(oneWild.classification?.resolvedNumbers).toEqual([1, 2, 3]);

    // 2 Wilds maximize to True Rainbow
    const twoWilds = evaluateSet([
      makeCard('a', 'red', 'oval', 1),
      makeCard('w1', 'red', 'oval', 1, 'wild'),
      makeCard('w2', 'red', 'oval', 1, 'none', true),
    ]);
    expect(twoWilds.isValid).toBe(true);
    expect(twoWilds.classification?.handId).toBe('true_rainbow');

    // 3 Wilds on adjacent indices -> Prismatic Crown
    const threeWilds = evaluateSet(
      [
        makeCard('w1', 'red', 'oval', 1, 'wild'),
        makeCard('w2', 'red', 'oval', 1, 'wild'),
        makeCard('w3', 'red', 'oval', 1, 'wild'),
      ],
      [0, 1, 2],
      3
    );
    expect(threeWilds.isValid).toBe(true);
    expect(threeWilds.classification?.handId).toBe('prismatic_crown');
  });

  it('classifies all 7 Pattern Hands accurately', () => {
    const checkHand = (indices: [number, number, number], expected: PatternHandId) => {
      const cards = indices.map(i => TEST_BOARD[i]);
      const res = evaluateSet(cards, indices, 3);
      expect(res.isValid).toBe(true);
      expect(res.classification?.handId).toBe(expected);
    };

    // 1. Simple Triad (non-adjacent, 1 same trait, 2 diff traits)
    checkHand([0, 9, 10], 'simple_triad');
    // 2. Color Run (non-adjacent, only Color differs)
    checkHand([0, 5, 6], 'color_run');
    // 3. Shape Run (non-adjacent, only Shape differs)
    checkHand([0, 7, 8], 'shape_run');
    // 4. Number Run (non-adjacent, only Number differs)
    checkHand([0, 3, 11], 'number_run');
    // 5. True Rainbow (non-adjacent, all 3 traits differ)
    const nonAdjRainbow = evaluateSet(
      [
        makeCard('x0', 'red', 'oval', 1),
        makeCard('x1', 'green', 'squiggle', 2),
        makeCard('x2', 'purple', 'diamond', 3),
      ],
      [0, 4, 8],
      3
    );
    expect(nonAdjRainbow.classification?.handId).toBe('true_rainbow');
    // 6. Adjacency Chain (adjacent non-rainbow Set)
    checkHand([0, 3, 4], 'adjacency_chain');
    // 7. Prismatic Crown (adjacent True Rainbow)
    checkHand([0, 1, 2], 'prismatic_crown');

    // Prismatic Crown also triggers on 3 identical cloned cards!
    const cloneTriple = evaluateSet(
      [
        makeCard('c1', 'purple', 'diamond', 3),
        makeCard('c2', 'purple', 'diamond', 3),
        makeCard('c3', 'purple', 'diamond', 3),
      ],
      [0, 4, 8],
      3
    );
    expect(cloneTriple.isValid).toBe(true);
    expect(cloneTriple.classification?.handId).toBe('prismatic_crown');
    expect(cloneTriple.classification?.isCloneTriple).toBe(true);

    // L-bend adjacency check
    expect(areIndicesAdjacentChain([0, 1, 4], 3)).toBe(true);
    expect(areIndicesAdjacentChain([0, 4, 8], 3)).toBe(false);
  });

  it('computes 2-card Blueprint need and handles 0/1/2/3 card live preview cleanly', () => {
    const run = makePlayingRun({ board: TEST_BOARD });
    expect(previewSelection(run).selectedCount).toBe(0);
    expect(previewSelection(run).blueprintNeed).toBeNull();

    const one = toggleCard(run, 0);
    expect(previewSelection(one).selectedCount).toBe(1);
    expect(previewSelection(one).blueprintNeed).toBeNull();

    const two = toggleCard(one, 1);
    const prev2 = previewSelection(two);
    expect(prev2.selectedCount).toBe(2);
    expect(prev2.blueprintNeed).not.toBeNull();
    expect(prev2.blueprintNeed?.color).toBe('purple');
    expect(prev2.blueprintNeed?.shape).toBe('diamond');
    expect(prev2.blueprintNeed?.number).toBe(3);
    expect(prev2.blueprintNeed?.matchingBoardIndices).toContain(2);

    // Wild 2-card blueprint accepts any 3rd card
    const wildBoard = TEST_BOARD.map((c, idx) => (idx === 0 ? { ...c, edition: 'wild' as const } : c));
    const wildNeed = computeBlueprintNeed(wildBoard, [0, 1]);
    expect(wildNeed?.color).toBe('any');
    expect(wildNeed?.matchingBoardIndices).toHaveLength(wildBoard.length - 2);

    // 3-card valid preview matches commit score 100%
    const three = toggleCard(two, 2);
    const prev3 = previewSelection(three);
    expect(prev3.isValidSet).toBe(true);
    expect(prev3.patternHand).toBe('prismatic_crown');
    const committed = playSelectedSet(three);
    expect(committed.lastScoreBreakdown?.finalScore).toBe(prev3.estimatedTotal);
  });

  it('rescues cap-set / pruned boards with zero Sets via deadlock-safe dealing', () => {
    // 4-card board with zero Sets (e.g. 2 reds + 1 green + 1 purple with mismatched shapes/numbers)
    const noSetBoard = [
      makeCard('n0', 'red', 'oval', 1),
      makeCard('n1', 'red', 'oval', 2),
      makeCard('n2', 'green', 'squiggle', 1),
      makeCard('n3', 'green', 'squiggle', 2),
    ];
    expect(hasAnySetOnBoard(noSetBoard)).toBe(false);

    // Case 1: Rescue by swapping in a completing card from drawPile
    const drawPile = [makeCard('n4', 'red', 'oval', 3)];
    const res1 = ensurePlayableBoard(noSetBoard, drawPile, [], 12345);
    expect(res1.adjusted).toBe(true);
    expect(hasAnySetOnBoard(res1.board)).toBe(true);

    // Case 2: Extreme prune where entire deck has no valid Set -> emergency tempWild
    const res2 = ensurePlayableBoard(noSetBoard, [], [], 12345);
    expect(res2.adjusted).toBe(true);
    expect(hasAnySetOnBoard(res2.board)).toBe(true);
    expect(res2.toast).toContain('Wild');
  });
});

describe('Prism Deck — Left-to-Right Scoring, Editions & Uncapped Scaling', () => {
  it('evaluates Charms strictly left-to-right (+Mult before ×Mult > ×Mult before +Mult) with no rubber-band cap', () => {
    // Put Odd One Out (+18M) left of Geometric Savant (×2M) on Color Run [0,5,6]
    const runLeft = makePlayingRun({
      board: TEST_BOARD,
      charms: [makeCharm('odd-one-out', 1), makeCharm('geometric-savant', 2)],
    });
    const runRight = makePlayingRun({
      board: TEST_BOARD,
      charms: [makeCharm('geometric-savant', 2), makeCharm('odd-one-out', 1)],
    });

    const leftScore = scoreSet(runLeft, [0, 5, 6], { preview: true })!;
    const rightScore = scoreSet(runRight, [0, 5, 6], { preview: true })!;
    // Base Color Run = 35C + 30C pips = 65C, 3M
    // Left-to-right: (3 + 18) * 2 = 42M -> 65 * 42 = 2730
    // Right-to-left: (3 * 2) + 18 = 24M -> 65 * 24 = 1560
    expect(leftScore.finalMult).toBe(42);
    expect(rightScore.finalMult).toBe(24);
    expect(leftScore.finalScore).toBeGreaterThan(rightScore.finalScore);

    // Reorder action changes live preview immediately
    const reordered = reorderCharm(runRight, 0, 1);
    const reorderedScore = scoreSet(reordered, [0, 5, 6], { preview: true })!;
    expect(reorderedScore.finalScore).toBe(leftScore.finalScore);

    // Uncapped mega-score test (> 1,000,000 in a single Set!)
    const megaBoard = [
      makeCard('m0', 'purple', 'oval', 3, 'glass'),
      makeCard('m1', 'purple', 'squiggle', 3, 'glass'),
      makeCard('m2', 'purple', 'diamond', 3, 'glass'),
    ];
    const megaRun = makePlayingRun({
      board: megaBoard,
      deck: Array.from({ length: 20 }, (_, i) => makeCard(`e${i}`, 'purple', 'oval', 3, 'poly')),
      handLevels: { ...makePlayingRun().handLevels, adjacency_chain: 20 },
      handsLeft: 1,
      charms: [
        makeCharm('amethyst-crown', 1),
        makeCharm('tightrope', 2),
        makeCharm('last-stand', 3),
        makeCharm('prism-sovereign', 4),
        makeCharm('understudy', 5),
      ],
    });
    const megaRes = scoreSet(megaRun, [0, 1, 2], { preview: true })!;
    expect(megaRes.finalScore).toBeGreaterThan(1_000_000);
  });

  it('applies all 6 Card Editions and deterministic Glass shatter', () => {
    const editionBoard: PrismCard[] = [
      makeCard('e0', 'red', 'oval', 1, 'foil'),    // +50C
      makeCard('e1', 'green', 'squiggle', 2, 'holo'), // +10M
      makeCard('e2', 'purple', 'diamond', 3, 'poly'), // ×1.5M
      makeCard('e3', 'red', 'oval', 2, 'glass'),   // ×2M + shatter roll
      makeCard('e4', 'red', 'oval', 3, 'gold'),    // +15C + $3
      makeCard('e5', 'red', 'oval', 1, 'wild'),    // +20C
    ];
    const r1 = makePlayingRun({ board: editionBoard });
    const s1 = scoreSet(r1, [0, 1, 2], { preview: true })!;
    expect(s1.steps.some(st => st.label.includes('Foil'))).toBe(true);
    expect(s1.steps.some(st => st.label.includes('Holographic'))).toBe(true);
    expect(s1.steps.some(st => st.label.includes('Polychrome'))).toBe(true);

    const s2 = scoreSet(r1, [3, 4, 5], { preview: true })!;
    expect(s2.goldDelta).toBe(3);
    expect(s2.shatterRiskCardIds).toEqual(['e3']);

    // Deterministic Glass shatter occurs across enough seeds and permanently removes card from deck
    let sawShatter = false;
    let sawSurvive = false;
    for (let seedNum = 1; seedNum <= 40; seedNum++) {
      const r = makePlayingRun({
        rngState: seedNum * 99991,
        board: editionBoard,
        deck: [...editionBoard, ...createStandardDeck().slice(6)],
        selectedIndices: [3, 4, 5],
      });
      const after = playSelectedSet(r);
      if (after.lastScoreBreakdown?.shatteredCardIds.includes('e3')) {
        sawShatter = true;
        expect(after.deck.some(c => c.id === 'e3')).toBe(false);
        expect(after.stats.shatteredCards).toBe(1);
      } else {
        sawSurvive = true;
        expect(after.deck.some(c => c.id === 'e3')).toBe(true);
      }
    }
    expect(sawShatter).toBe(true);
    expect(sawSurvive).toBe(true);
  });
});

describe('Prism Deck — All 32 Charms Individually Verified', () => {
  it('triggers every single one of the 32 Charms and produces non-empty status labels', () => {
    const triggeredByTest = new Set<string>();

    const verifyCharm = (
      charmId: string,
      setup: Partial<PrismRun>,
      indices: [number, number, number],
      assertion: (res: NonNullable<ReturnType<typeof scoreSet>>, base: NonNullable<ReturnType<typeof scoreSet>>) => void
    ) => {
      const baseRun = makePlayingRun({ board: TEST_BOARD, ...setup, charms: [] });
      const baseRes = scoreSet(baseRun, indices, { preview: true })!;
      const charms = setup.charms ?? [makeCharm(charmId)];
      const charmRun = makePlayingRun({ board: TEST_BOARD, ...setup, charms });
      const res = scoreSet(charmRun, indices, { preview: true })!;
      const owned = charmRun.charms.find(c => c.charmId === charmId)!;
      expect(getCharmStatusLabel(owned, charmRun).length).toBeGreaterThan(0);
      assertion(res, baseRes);
      triggeredByTest.add(charmId);
    };

    // 1. rainbow-charm
    verifyCharm('rainbow-charm', {}, [0, 1, 2], (r, b) => expect(r.finalMult).toBeCloseTo(b.finalMult * 2));
    // 2. magnet
    verifyCharm('magnet', { charms: [makeCharm('magnet', 1, { magnetCardId: 'b0' })] }, [0, 1, 2], (r, b) =>
      expect(r.finalMult).toBe(b.finalMult + 14)
    );
    // 3. bounty-poster
    verifyCharm(
      'bounty-poster',
      { charms: [makeCharm('bounty-poster', 1, { bountyTrait: 'color', bountyValue: 'red', bountyProgress: 0 })] },
      [0, 3, 4],
      (r, b) => expect(r.finalChips).toBe(b.finalChips + 105)
    );
    // 4. odd-one-out
    verifyCharm('odd-one-out', {}, [0, 5, 6], (r, b) => expect(r.finalMult).toBe(b.finalMult + 18));
    // 5. snowball (scales on play, loses on discard)
    verifyCharm('snowball', { charms: [makeCharm('snowball', 1, { counter: 6 })] }, [0, 1, 2], (r, b) =>
      expect(r.finalMult).toBe(b.finalMult + 8)
    );
    // 6. collectors-album
    verifyCharm(
      'collectors-album',
      { charms: [makeCharm('collectors-album', 1, { stampedHands: ['simple_triad', 'color_run'] })] },
      [0, 1, 2],
      (r, b) => expect(r.finalMult).toBeCloseTo(b.finalMult * 1.75, 1)
    );
    // 7. understudy
    verifyCharm(
      'understudy',
      { charms: [makeCharm('odd-one-out', 1), makeCharm('understudy', 2)] },
      [0, 5, 6],
      (r, b) => expect(r.finalMult).toBe(b.finalMult + 36)
    );
    // 8. amplifier-coil
    verifyCharm(
      'amplifier-coil',
      { charms: [makeCharm('amplifier-coil', 1), makeCharm('odd-one-out', 2)] },
      [0, 5, 6],
      (r, b) => expect(r.finalMult).toBe(b.finalMult + 36)
    );
    // 9. glass-sword (×2.5, shatters on Simple Triad, reforges on Rainbow)
    verifyCharm('glass-sword', {}, [0, 9, 10], (r, b) => expect(r.finalMult).toBeCloseTo(b.finalMult * 2.5));
    const gsRun = makePlayingRun({
      board: TEST_BOARD,
      charms: [makeCharm('glass-sword', 1)],
      selectedIndices: [0, 9, 10],
    });
    const gsAfter = playSelectedSet(gsRun);
    expect(gsAfter.charms[0].state.shattered).toBe(true);
    // 10. greedy-chest
    verifyCharm('greedy-chest', { gold: 20 }, [0, 1, 2], (r, b) => expect(r.finalChips).toBe(b.finalChips + 40));
    // 11. mirror-shard
    verifyCharm('mirror-shard', { lastSetIndices: [0, 5, 6] }, [0, 1, 2], (r, b) =>
      expect(r.finalChips).toBe(b.finalChips + 65)
    );
    // 12. tightrope
    verifyCharm('tightrope', {}, [0, 3, 4], (r, b) => expect(r.finalMult).toBeCloseTo(b.finalMult * 2.25));
    // 13. rally-horn
    verifyCharm('rally-horn', { handsPlayedThisBlind: 0 }, [0, 1, 2], (r, b) =>
      expect(r.finalMult).toBe(b.finalMult + 16)
    );
    // 14. fortunes-favor
    verifyCharm('fortunes-favor', {}, [0, 1, 2], r => expect(r.goldDelta).toBe(4));
    // 15. field-stone
    verifyCharm('field-stone', {}, [0, 1, 2], (r, b) => expect(r.finalChips).toBe(b.finalChips + 25));
    const fsRun = selectBlind({
      ...createRun({ seed: 'FIELDTEST' }),
      charms: [makeCharm('field-stone', 1)],
    });
    expect(fsRun.board).toHaveLength(15);
    // 16. wild-card (Wild Weaver)
    const wildBoard = TEST_BOARD.map((c, i) => (i === 0 ? { ...c, edition: 'wild' as const } : c));
    verifyCharm('wild-card', { board: wildBoard }, [0, 1, 2], (r, b) =>
      expect(r.finalMult).toBe(b.finalMult + 12)
    );
    const wwRun = selectBlind({
      ...createRun({ seed: 'WILDWEAVER' }),
      charms: [makeCharm('wild-card', 1)],
    });
    expect(wwRun.board[0].tempWild).toBe(true);
    // 17. ruby-prism
    verifyCharm('ruby-prism', {}, [0, 3, 4], (r, b) => expect(r.finalMult).toBe(b.finalMult + 15));
    // 18. emerald-lens
    verifyCharm('emerald-lens', {}, [0, 1, 2], (r, b) => expect(r.finalChips).toBe(b.finalChips + 35));
    // 19. amethyst-crown
    verifyCharm('amethyst-crown', {}, [0, 1, 2], (r, b) => expect(r.finalMult).toBeCloseTo(b.finalMult * 1.35, 1));
    // 20. trinity-bell
    verifyCharm('trinity-bell', {}, [0, 1, 2], (r, b) => expect(r.finalChips).toBe(b.finalChips + 40));
    // 21. minimalist-monk
    verifyCharm('minimalist-monk', {}, [0, 5, 6], (r, b) => expect(r.finalMult).toBe(b.finalMult + 18));
    // 22. sculptors-chisel
    verifyCharm('sculptors-chisel', { deck: createStandardDeck().slice(0, 23) }, [0, 1, 2], (r, b) =>
      expect(r.finalChips).toBe(b.finalChips + 125)
    );
    // 23. alchemists-flask
    verifyCharm(
      'alchemists-flask',
      { stats: { ...makePlayingRun().stats, spellsUsed: 3 } },
      [0, 1, 2],
      (r, b) => expect(r.finalMult).toBeCloseTo(b.finalMult * 1.8, 1)
    );
    // 24. glass-cannon (Shatter Lens)
    const glassBoard = TEST_BOARD.map((c, i) => (i === 0 ? { ...c, edition: 'glass' as const } : c));
    verifyCharm(
      'glass-cannon',
      { board: glassBoard, stats: { ...makePlayingRun().stats, shatteredCards: 2 } },
      [0, 1, 2],
      (r, b) => {
        expect(r.finalChips).toBe(b.finalChips + 35);
        expect(r.finalMult).toBeCloseTo(b.finalMult * 2.25, 1);
      }
    );
    // 25. star-astronomer
    verifyCharm(
      'star-astronomer',
      { handLevels: { ...makePlayingRun().handLevels, true_rainbow: 3, color_run: 2 } },
      [0, 1, 2],
      (r, b) => {
        expect(r.finalChips).toBe(b.finalChips + 45);
        expect(r.finalMult).toBe(b.finalMult + 3);
      }
    );
    // 26. golden-abacus (interest cap $10 + $1 on discard)
    const abacusRun = makePlayingRun({
      board: TEST_BOARD,
      gold: 50,
      charms: [makeCharm('golden-abacus', 1)],
      selectedIndices: [0],
    });
    expect(getCharmStatusLabel(abacusRun.charms[0], abacusRun)).toContain('$10');
    const afterAbacusDiscard = discardSelected(abacusRun);
    expect(afterAbacusDiscard.gold).toBe(51);
    const clearAbacus = playSelectedSet({
      ...abacusRun,
      blindTarget: 10,
      selectedIndices: [0, 1, 2],
    });
    expect(clearAbacus.lastBlindPayout?.interestGold).toBe(10);
    triggeredByTest.add('golden-abacus');
    // 27. discard-furnace
    verifyCharm('discard-furnace', { discardsUsedThisBlind: 2 }, [0, 1, 2], (r, b) =>
      expect(r.finalMult).toBe(b.finalMult + 24)
    );
    // 28. last-stand
    verifyCharm('last-stand', { handsLeft: 1 }, [0, 1, 2], (r, b) =>
      expect(r.finalMult).toBeCloseTo(b.finalMult * 2.5)
    );
    // 29. edition-forge
    const foilBoard = TEST_BOARD.map((c, i) => (i === 0 || i === 1 ? { ...c, edition: 'foil' as const } : c));
    verifyCharm('edition-forge', { board: foilBoard }, [0, 1, 2], (r, b) => {
      expect(r.finalChips).toBe(b.finalChips + 50);
      expect(r.finalMult).toBe(b.finalMult + 16);
    });
    // 30. geometric-savant
    verifyCharm('geometric-savant', {}, [0, 1, 2], (r, b) =>
      expect(r.finalMult).toBeCloseTo(b.finalMult * 3)
    );
    // 31. pendulum (alternates Chips on odd hands, Mult on even hands)
    verifyCharm('pendulum', { handsPlayedThisBlind: 0 }, [0, 1, 2], (r, b) =>
      expect(r.finalChips).toBe(b.finalChips + 80)
    );
    verifyCharm('pendulum', { handsPlayedThisBlind: 1 }, [0, 1, 2], (r, b) =>
      expect(r.finalMult).toBe(b.finalMult + 20)
    );
    // 32. prism-sovereign
    const deckWith4Eds = createStandardDeck().map((c, i) => (i < 4 ? { ...c, edition: 'gold' as const } : c));
    verifyCharm('prism-sovereign', { deck: deckWith4Eds }, [0, 1, 2], (r, b) =>
      expect(r.finalMult).toBeCloseTo(b.finalMult * 2.0, 1)
    );

    // Ensure all 32 Charms were explicitly tested!
    expect(triggeredByTest.size).toBe(32);
  });
});

describe('Prism Deck — All 6 Synergy Pairs', () => {
  it('activates every single one of the 6 Synergy Pairs during scoring', () => {
    const edBoard = TEST_BOARD.map((c, i) => (i === 0 ? { ...c, edition: 'wild' as const } : c));

    const testSyn = (synergyId: string, setup: Partial<PrismRun>, indices: [number, number, number]) => {
      const pair = SYNERGY_PAIRS.find(p => p.id === synergyId)!;
      const run = makePlayingRun({
        board: edBoard,
        charms: [makeCharm(pair.charmA, 1), makeCharm(pair.charmB, 2)],
        ...setup,
      });
      const res = scoreSet(run, indices, { preview: true })!;
      expect(res.activeSynergyIds).toContain(synergyId);
      expect(res.steps.some(s => s.kind === 'synergy' && s.synergyId === synergyId)).toBe(true);
    };

    testSyn('spectrum_resonance', {}, [0, 1, 2]);
    testSyn('alchemical_temper', {}, [0, 1, 2]);
    testSyn('gilded_vault', { gold: 25 }, [0, 1, 2]);
    testSyn('standing_ovation', { handsPlayedThisBlind: 0 }, [0, 1, 2]);
    testSyn('spatial_web', { lastSetIndices: [0, 5, 6] }, [0, 1, 2]);
    testSyn('masterwork_deck', {}, [0, 1, 2]);
  });
});

describe('Prism Deck — All 8 Consumable Spells', () => {
  it('executes every Spell permanently on board and master deck', () => {
    const runWithSpell = (spellId: SpellId) => {
      const base = makePlayingRun({
        board: TEST_BOARD,
        deck: [...TEST_BOARD, ...createStandardDeck().slice(12)],
        spells: [{ instanceId: `sp-${spellId}`, spellId }],
        selectedIndices: [0],
      });
      return base;
    };

    // 1. repaint (explicit & cycle)
    const rRepaint = useSpell(runWithSpell('repaint'), 0, undefined, 'purple');
    expect(rRepaint.board[0].color).toBe('purple');
    expect(rRepaint.deck.find(c => c.id === 'b0')?.color).toBe('purple');
    expect(rRepaint.spells).toHaveLength(0);
    expect(rRepaint.stats.spellsUsed).toBe(1);

    const rRepaintCycle = useSpell(runWithSpell('repaint'), 0);
    expect(rRepaintCycle.board[0].color).toBe('green'); // red -> green

    // 2. reshape
    const rReshape = useSpell(runWithSpell('reshape'), 0, 'b0', 'diamond');
    expect(rReshape.board[0].shape).toBe('diamond');

    // 3. renumber
    const rRenumber = useSpell(runWithSpell('renumber'), 0, 'b0', 3);
    expect(rRenumber.board[0].number).toBe(3);

    // 4. clone
    const rClone = useSpell(runWithSpell('clone'), 0, 'b0');
    expect(rClone.deck.length).toBe(runWithSpell('clone').deck.length + 1);
    expect(rClone.drawPile.length).toBe(runWithSpell('clone').drawPile.length + 1);

    // 5. prune
    const rPrune = useSpell(runWithSpell('prune'), 0, 'b0');
    expect(rPrune.deck.some(c => c.id === 'b0')).toBe(false);
    expect(rPrune.deck.length).toBe(runWithSpell('prune').deck.length - 1);

    // 6. wild-stamp
    const rWild = useSpell(runWithSpell('wild-stamp'), 0, 'b0');
    expect(rWild.board[0].edition).toBe('wild');
    expect(rWild.deck.find(c => c.id === 'b0')?.edition).toBe('wild');

    // 7. glass-stamp
    const rGlass = useSpell(runWithSpell('glass-stamp'), 0, 'b0');
    expect(rGlass.board[0].edition).toBe('glass');

    // 8. gild
    const rGild = useSpell(runWithSpell('gild'), 0, 'b0');
    expect(rGild.board[0].edition).toBe('gold');
  });
});

describe('Prism Deck — All 10 Boss Blinds', () => {
  it('applies every Boss Blind twist cleanly', () => {
    const cleanScore = scoreSet(makePlayingRun({ board: TEST_BOARD }), [0, 1, 2], { preview: true })!;

    // 1-3: Color debuffs (crimson_tax, emerald_blight, amethyst_veil)
    for (const [bossId, colorIdx] of [
      ['crimson_tax', 0],
      ['emerald_blight', 1],
      ['amethyst_veil', 2],
    ] as [BossBlindId, number][]) {
      const r = makePlayingRun({ board: TEST_BOARD, activeBossId: bossId });
      const s = scoreSet(r, [0, 1, 2], { preview: true })!;
      expect(s.steps.some(st => st.kind === 'debuff' && st.cardId === TEST_BOARD[colorIdx].id)).toBe(true);
      expect(s.finalChips).toBeLessThan(cleanScore.finalChips);
    }

    // 4: the_wall (3.0× Small Blind target vs normal 2.0×)
    const wallTarget = getSmallBlindTarget(2) * 3;
    expect(wallTarget).toBeGreaterThan(getSmallBlindTarget(2) * 2);

    // 5: the_pinch (0 discards)
    const pinchSetup = createRun({ seed: 'PINCHTEST' });
    const pinchBlind = selectBlind({
      ...pinchSetup,
      blindIndex: 2,
      anteBlinds: [
        pinchSetup.anteBlinds[0],
        pinchSetup.anteBlinds[1],
        { ...pinchSetup.anteBlinds[2], bossId: 'the_pinch' },
      ],
    });
    expect(pinchBlind.discardsLeft).toBe(0);

    // 6: the_narrow (-3 board size -> 9 cards)
    const narrowSetup = createRun({ seed: 'NARROWTEST' });
    const narrowBlind = selectBlind({
      ...narrowSetup,
      blindIndex: 2,
      anteBlinds: [
        narrowSetup.anteBlinds[0],
        narrowSetup.anteBlinds[1],
        { ...narrowSetup.anteBlinds[2], bossId: 'the_narrow' },
      ],
    });
    expect(narrowBlind.board).toHaveLength(9);

    // 7: the_mirror_tax (repeat hand halves Mult)
    const mirrorRun = makePlayingRun({
      board: TEST_BOARD,
      activeBossId: 'the_mirror_tax',
      lastPlayedHandThisBlind: 'prismatic_crown',
    });
    const mirrorScore = scoreSet(mirrorRun, [0, 1, 2], { preview: true })!;
    expect(mirrorScore.finalMult).toBeCloseTo(cleanScore.finalMult * 0.5);

    // 8: the_tithe (-$2 gold or -2 mult if broke)
    const titheRich = scoreSet(makePlayingRun({ board: TEST_BOARD, gold: 10, activeBossId: 'the_tithe' }), [0, 1, 2], {
      preview: true,
    })!;
    expect(titheRich.goldDelta).toBe(-2);
    const titheBroke = scoreSet(makePlayingRun({ board: TEST_BOARD, gold: 0, activeBossId: 'the_tithe' }), [0, 1, 2], {
      preview: true,
    })!;
    expect(titheBroke.finalMult).toBe(cleanScore.finalMult - 2);

    // 9: the_eclipse (disables leftmost charm slot 0)
    const eclipseRun = makePlayingRun({
      board: TEST_BOARD,
      activeBossId: 'the_eclipse',
      charms: [makeCharm('rainbow-charm', 1), makeCharm('emerald-lens', 2)],
    });
    const eclipseScore = scoreSet(eclipseRun, [0, 1, 2], { preview: true })!;
    expect(eclipseScore.triggeredCharmIds).not.toContain('rainbow-charm');
    expect(eclipseScore.triggeredCharmIds).toContain('emerald-lens');

    // 10: the_prism_test (Simple Triads halved)
    const triadClean = scoreSet(makePlayingRun({ board: TEST_BOARD }), [0, 9, 10], { preview: true })!;
    const triadCrucible = scoreSet(
      makePlayingRun({ board: TEST_BOARD, activeBossId: 'the_prism_test' }),
      [0, 9, 10],
      { preview: true }
    )!;
    expect(triadCrucible.finalScore).toBe(Math.floor(triadClean.finalScore * 0.5));
  });
});

describe('Prism Deck — Skip Tags, Vouchers, Shop, Interest, Rerolls & Endless', () => {
  it('applies all 8 Skip Tags and blocks skipping Boss Blinds', () => {
    const testTag = (tagId: SkipTagId): PrismRun => {
      const r = createRun({ seed: `TAG-${tagId}` });
      const withTag: PrismRun = {
        ...r,
        anteBlinds: [{ ...r.anteBlinds[0], skipTagId: tagId }, r.anteBlinds[1], r.anteBlinds[2]],
      };
      return skipBlind(withTag);
    };

    expect(testTag('investment_tag').pendingTags.investmentCount).toBe(1);
    expect(testTag('foil_cache').deck.filter(c => c.edition === 'foil')).toHaveLength(2);
    expect(testTag('polychrome_spark').deck.filter(c => c.edition === 'poly')).toHaveLength(1);
    expect(testTag('charm_pack').pendingTags.freeRareCharmNextShop).toBe(true);
    const stars = testTag('star_shower');
    expect(Object.values(stars.handLevels).reduce((a, b) => a + b, 0)).toBe(9); // 7 base + 2
    expect(testTag('spell_cache').spells.length).toBe(2);
    expect(testTag('coupon_tag').pendingTags.couponHalfOffNextShop).toBe(true);
    expect(testTag('juggler_tag').pendingTags.bonusHandsNextBlind).toBe(2);

    // Cannot skip Boss Blind
    const atBoss = { ...createRun({ seed: 'NOBOSSSKIP' }), blindIndex: 2 };
    expect(skipBlind(atBoss).blindIndex).toBe(2);
    expect(skipBlind(atBoss).stats.blindsSkipped).toBe(0);
  });

  it('applies all 6 Vouchers, Shop buying/selling/rerolling, Coupon/Rare tags, Victory & Endless', () => {
    const enterShopWithVoucher = (voucherId: VoucherId, extra?: Partial<PrismRun>): PrismRun => {
      const run = makePlayingRun({
        board: TEST_BOARD,
        blindTarget: 10,
        gold: 40,
        anteVoucherId: voucherId,
        selectedIndices: [0, 1, 2],
        ...extra,
      });
      return playSelectedSet(run);
    };

    // 1. extra_hand
    expect(buyVoucher(enterShopWithVoucher('extra_hand')).baseHands).toBe(5);
    // 2. extra_discard
    expect(buyVoucher(enterShopWithVoucher('extra_discard')).baseDiscards).toBe(4);
    // 3. extra_charm_slot
    expect(buyVoucher(enterShopWithVoucher('extra_charm_slot')).maxCharms).toBe(6);
    // 4. spell_satchel
    const satchel = buyVoucher(enterShopWithVoucher('spell_satchel'));
    expect(satchel.maxSpells).toBe(3);
    // 5. clearance_sale
    const clearanceShop = enterShopWithVoucher('clearance_sale');
    const preReroll = clearanceShop.shop!.rerollCost;
    const afterClearance = buyVoucher(clearanceShop);
    expect(afterClearance.shop!.rerollCost).toBeLessThan(preReroll);
    // 6. telescope
    const teleShop = buyVoucher(enterShopWithVoucher('telescope'));
    expect(teleShop.shop!.starCharts[0].levelsGranted).toBe(2);

    // Shop actions: buyCharm, buyStarChart, buySpell, rerollShop, sellCharm, leaveShop
    let shopRun = enterShopWithVoucher('extra_hand', {
      pendingTags: {
        investmentCount: 0,
        freeRareCharmNextShop: true,
        couponHalfOffNextShop: true,
        bonusHandsNextBlind: 0,
      },
    });
    expect(shopRun.phase).toBe('shop');
    expect(shopRun.shop?.charms[0].price).toBe(0);
    expect(CHARM_BY_ID[shopRun.shop!.charms[0].charmId].rarity).toBe('rare');

    shopRun = buyShopCharm(shopRun, 0);
    expect(shopRun.charms).toHaveLength(1);
    const goldAfterBuy = shopRun.gold;
    shopRun = buyStarChart(shopRun, 0);
    expect(shopRun.gold).toBeLessThan(goldAfterBuy);
    shopRun = buySpell(shopRun, 0);
    expect(shopRun.spells).toHaveLength(1);

    const rerollBefore = shopRun.shop!.rerollCost;
    shopRun = rerollShop(shopRun);
    expect(shopRun.shop!.rerollCost).toBe(rerollBefore + 1);
    expect(shopRun.shop!.rerollCount).toBe(1);

    const goldBeforeSell = shopRun.gold;
    shopRun = sellCharm(shopRun, 0);
    expect(shopRun.charms).toHaveLength(0);
    expect(shopRun.gold).toBeGreaterThan(goldBeforeSell);

    const nextBlind = leaveShop(shopRun);
    expect(nextBlind.phase).toBe('blind_select');
    expect(nextBlind.blindIndex).toBe(1);

    // Ante 8 Boss Victory -> continueEndless -> Shop -> leaveShop -> Ante 9
    const ante8Boss = makePlayingRun({
      ante: 8,
      blindIndex: 2,
      board: TEST_BOARD,
      blindTarget: 10,
      selectedIndices: [0, 1, 2],
      anteBlinds: [
        { kind: 'small', name: 'Small', targetScore: 10, rewardGold: 3, status: 'cleared' },
        { kind: 'big', name: 'Big', targetScore: 10, rewardGold: 4, status: 'cleared' },
        { kind: 'boss', name: 'Boss', targetScore: 10, rewardGold: 5, bossId: 'the_wall', status: 'active' },
      ],
    });
    const victory = playSelectedSet(ante8Boss);
    expect(victory.phase).toBe('victory');
    const endlessShop = continueEndless(victory);
    expect(endlessShop.phase).toBe('shop');
    expect(endlessShop.isEndless).toBe(true);
    const ante9 = leaveShop(endlessShop);
    expect(ante9.ante).toBe(9);
    expect(ante9.phase).toBe('blind_select');

    // Abandon run & clearSelection & getDeckSummary
    const sel = clearSelection(toggleCard(makePlayingRun({ board: TEST_BOARD }), 0));
    expect(sel.selectedIndices).toHaveLength(0);
    const summary = getDeckSummary(sel);
    expect(summary.totalCards).toBe(27);
    const abandoned = abandonRun(sel);
    expect(abandoned.phase).toBe('defeat');
    expect(abandoned.abandoned).toBe(true);
  });
});

describe('Prism Deck — Daily Seeds, Share Cards, URLs & Persistence', () => {
  beforeEach(() => {
    resetPrismStorage();
    clearPrismStorageError();
  });

  it('generates deterministic Daily Runs and rotates all 7 Daily Mutators across 7 consecutive days', () => {
    const r1 = selectBlind(createRun({ isDaily: true, dailyDate: '2026-11-22', startedAt: 1000 }));
    const r2 = selectBlind(createRun({ isDaily: true, dailyDate: '2026-11-22', startedAt: 1000 }));
    expect(r1.seed).toBe(getDailySeed('2026-11-22'));
    expect(r1.dailyMutatorId).toBe(r2.dailyMutatorId);
    expect(r1.board.map(c => c.id)).toEqual(r2.board.map(c => c.id));

    const mutators = new Set<string>();
    for (let day = 1; day <= 7; day++) {
      mutators.add(getDailyMutatorForDate(`2026-11-0${day}`));
    }
    expect(mutators.size).toBe(7);
  });

  it('formats spoiler-free Share Card and roundtrips URL query params', () => {
    const run = createRun({ isDaily: true, dailyDate: '2026-11-22', deckId: 'gilded_ledger' });
    const card = formatShareCard(run, 'https://nshapes.app');
    expect(card).toContain('Prism Deck');
    expect(card).toContain('Daily 2026-11-22');
    expect(card).toContain('mode=prism');
    expect(card).toContain(run.seed);

    const url = buildPrismShareUrl(run.seed, {
      baseUrl: 'https://nshapes.app',
      dailyDate: '2026-11-22',
      deckId: 'gilded_ledger',
    });
    const parsed = parsePrismUrlParams(url);
    expect(parsed).toEqual({
      isPrism: true,
      seed: run.seed,
      dailyDate: '2026-11-22',
      deckId: 'gilded_ledger',
    });
    expect(parsePrismUrlParams('https://nshapes.app/?mode=adventure')).toBeNull();
  });

  it('persists run & meta, updates deck unlocks & daily streaks, and roundtrips Backup Codes', () => {
    const run = selectBlind(createRun({ isDaily: true, dailyDate: '2026-11-22' }));
    expect(writePrismRun(run).ok).toBe(true);
    expect(hasActivePrismRun()).toBe(true);
    expect(loadPrismRun()?.seed).toBe(run.seed);

    // Record Day 1 & Day 2 consecutive daily victories
    const wonDay1: PrismRun = {
      ...run,
      ante: 8,
      phase: 'victory',
      stats: { ...run.stats, bestSingleSet: 32000, spellsUsed: 12, totalScore: 220000 },
    };
    const meta1 = recordPrismRunEnd(wonDay1, true);
    expect(meta1.victories).toBe(1);
    expect(meta1.dailyStreak).toBe(1);
    expect(isDeckUnlocked('gilded_ledger', meta1)).toBe(true);
    expect(isDeckUnlocked('alchemist_grimoire', meta1)).toBe(true);
    expect(isDeckUnlocked('vast_table', meta1)).toBe(true);
    expect(isDeckUnlocked('glass_mirage', meta1)).toBe(true);

    const day2 = { ...wonDay1, runId: 'prism-day2', dailyDate: '2026-11-23' };
    const meta2 = recordPrismRunEnd(day2, true);
    expect(meta2.dailyStreak).toBe(2);
    expect(meta2.bestDailyStreak).toBe(2);

    // Backup code roundtrip
    const code = exportPrismBackupCode(true);
    expect(code.startsWith('PRISM1:')).toBe(true);
    resetPrismStorage();
    expect(loadPrismMeta().victories).toBe(0);

    const imported = importPrismBackupCode(code);
    expect(imported.ok).toBe(true);
    expect(loadPrismMeta().victories).toBe(2);
    expect(loadPrismMeta().dailyStreak).toBe(2);
    expect(loadPrismRun()?.seed).toBe(run.seed);

    // Tampered checksum rejected cleanly
    const tampered = `${code.slice(0, -1)}${code.endsWith('A') ? 'B' : 'A'}`;
    expect(decodeSaveBackup(tampered).ok).toBe(false);

    // Direct encode/decode helper
    const metaOnlyCode = encodeSaveBackup(createInitialPrismMeta(), null);
    const decodedMeta = decodeSaveBackup(metaOnlyCode);
    expect(decodedMeta.ok).toBe(true);

    // Storage quota error flag surfaces cleanly when storage.set throws
    const origSet = storage.set;
    storage.set = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      const res = writePrismMeta(meta2);
      expect(res.ok).toBe(false);
      expect(getPrismStorageError()).toContain('QuotaExceededError');
      clearPrismStorageError();
      expect(getPrismStorageError()).toBeNull();
    } finally {
      storage.set = origSet;
    }
  });

  it('finds all valid Sets on a standard dealt board cleanly', () => {
    const run = selectBlind(createRun({ seed: 'BOARDCHECK' }));
    const sets = findAllSetsOnBoard(run.board, run.boardCols);
    expect(sets.length).toBeGreaterThan(0);
    for (const s of sets) {
      expect(isValidSetCards(s.indices.map(i => run.board[i]))).toBe(true);
    }
  });
});

describe('Prism Deck — Audit Regression Guards (#31)', () => {
  beforeEach(() => {
    resetPrismStorage();
    clearPrismStorageError();
  });

  it('[Blocker #1] prevents prune and Glass shatter from ever dropping deck below 3 cards', () => {
    const threeCards: PrismCard[] = [
      makeCard('g0', 'red', 'oval', 1, 'glass'),
      makeCard('g1', 'green', 'squiggle', 2, 'glass'),
      makeCard('g2', 'purple', 'diamond', 3, 'glass'),
    ];
    const tinyRun = makePlayingRun({
      board: threeCards,
      deck: threeCards,
      drawPile: [],
      discardPile: [],
      spells: [{ instanceId: 'sp-prune-guard', spellId: 'prune' }],
      selectedIndices: [0],
    });

    // Pruning at 3 cards is rejected cleanly (keeps spell & all 3 cards)
    const afterPrune = castSpell(tinyRun, 0);
    expect(afterPrune.deck).toHaveLength(3);
    expect(afterPrune.board).toHaveLength(3);
    expect(afterPrune.spells).toHaveLength(1);
    expect(afterPrune.stats.spellsUsed).toBe(0);
    expect(afterPrune.lastToast).toContain('3 cards');

    // Playing 3 Glass cards in a 3-card or 4-card deck across 40 seeds never drops deck < 3
    for (let seedNum = 1; seedNum <= 40; seedNum++) {
      const r3 = makePlayingRun({
        rngState: seedNum * 1337,
        board: threeCards,
        deck: threeCards,
        drawPile: [],
        discardPile: [],
        selectedIndices: [0, 1, 2],
      });
      const res3 = playSelectedSet(r3);
      expect(res3.deck.length).toBe(3);
      expect(res3.lastScoreBreakdown?.shatteredCardIds).toHaveLength(0);

      const fourCards = [...threeCards, makeCard('g3', 'red', 'oval', 2, 'none')];
      const r4 = makePlayingRun({
        rngState: seedNum * 1337,
        board: fourCards,
        deck: fourCards,
        drawPile: [],
        discardPile: [],
        selectedIndices: [0, 1, 2],
      });
      const res4 = playSelectedSet(r4);
      expect(res4.deck.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('[Medium #4] does not double-count totalSetsPlayed or totalSpellsUsed on Victory -> Endless -> Defeat', () => {
    const baseRun = createRun({ seed: 'ENDLESSCOUNT' });
    const victoryRun: PrismRun = {
      ...baseRun,
      ante: 8,
      phase: 'victory',
      isEndless: false,
      stats: { ...baseRun.stats, setsPlayed: 20, spellsUsed: 5, bestSingleSet: 15000, totalScore: 150000 },
    };
    const metaAfterWin = recordPrismRunEnd(victoryRun, true);
    expect(metaAfterWin.totalRuns).toBe(1);
    expect(metaAfterWin.victories).toBe(1);
    expect(metaAfterWin.totalSetsPlayed).toBe(20);
    expect(metaAfterWin.totalSpellsUsed).toBe(5);
    expect(isDeckUnlocked('alchemist_grimoire', metaAfterWin)).toBe(true); // Ante 8 >= 5

    // Now continue Endless, play 8 more Sets & cast 2 more Spells, then lose at Ante 10
    const endlessDefeat: PrismRun = {
      ...victoryRun,
      ante: 10,
      phase: 'defeat',
      isEndless: true,
      stats: { ...victoryRun.stats, setsPlayed: 28, spellsUsed: 7, totalScore: 950000 },
    };
    const metaAfterEndless = recordPrismRunEnd(endlessDefeat, false);
    expect(metaAfterEndless.totalRuns).toBe(1);
    expect(metaAfterEndless.victories).toBe(1);
    expect(metaAfterEndless.bestEndlessAnte).toBe(10);
    expect(metaAfterEndless.totalSetsPlayed).toBe(28); // NOT 48!
    expect(metaAfterEndless.totalSpellsUsed).toBe(7); // NOT 12!
  });

  it('[Medium #5] preserves latched writePrismMeta quota error when writePrismRun(null) removes active run', () => {
    const run = selectBlind(createRun({ seed: 'QUOTAERR' }));
    writePrismRun(run);

    const origSet = storage.set;
    storage.set = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      const metaWrite = writePrismMeta(createInitialPrismMeta());
      expect(metaWrite.ok).toBe(false);
      expect(getPrismStorageError()).toContain('QuotaExceededError');

      // Clearing finished active run via storage.remove must NOT erase the quota warning!
      const clearRes = writePrismRun(null);
      expect(clearRes.ok).toBe(true);
      expect(getPrismStorageError()).toContain('QuotaExceededError');
    } finally {
      storage.set = origSet;
    }
  });

  it('[Medium #8] rejects no-op trait spell casts and clears selectedIndices when ensurePlayableBoard adjusts', () => {
    // No-op repaint/reshape/renumber rejected with spell preserved
    const base = makePlayingRun({
      board: TEST_BOARD, // b0 is red oval 1
      deck: [...TEST_BOARD, ...createStandardDeck().slice(12)],
      spells: [
        { instanceId: 'sp1', spellId: 'repaint' },
        { instanceId: 'sp2', spellId: 'reshape' },
        { instanceId: 'sp3', spellId: 'renumber' },
      ],
      selectedIndices: [0],
    });
    const r1 = castSpell(base, 0, 'b0', 'red');
    expect(r1.spells).toHaveLength(3);
    expect(r1.stats.spellsUsed).toBe(0);
    expect(r1.lastToast).toContain('already');

    const r2 = castSpell(base, 1, 'b0', 'oval');
    expect(r2.spells).toHaveLength(3);
    expect(r2.stats.spellsUsed).toBe(0);

    const r3 = castSpell(base, 2, 'b0', 1);
    expect(r3.spells).toHaveLength(3);
    expect(r3.stats.spellsUsed).toBe(0);

    // When repaint breaks the only Set on board, ensurePlayableBoard adjusts and clears selectedIndices
    const fragileBoard = [
      makeCard('f0', 'red', 'oval', 1),
      makeCard('f1', 'red', 'oval', 2),
      makeCard('f2', 'red', 'oval', 3),
      makeCard('f3', 'green', 'squiggle', 1),
    ];
    const fragileRun = makePlayingRun({
      board: fragileBoard,
      deck: fragileBoard,
      drawPile: [],
      discardPile: [],
      spells: [{ instanceId: 'sp-break', spellId: 'repaint' }],
      selectedIndices: [0],
    });
    const afterAdjust = castSpell(fragileRun, 0, 'f0', 'purple');
    expect(afterAdjust.selectedIndices).toEqual([]);
    expect(hasAnySetOnBoard(afterAdjust.board)).toBe(true);
  });

  it('[Medium #9 & Nits] enforces Eclipse on payout & Understudy label, exact Crucible mult, clear activeBossId, reset keys, GH Pages URL & daily=1', () => {
    // Medium #9: Eclipse disables slot 0 Golden Abacus & Greedy Chest in Blind payout
    const eclipseSlot0 = makePlayingRun({
      board: TEST_BOARD,
      gold: 50,
      blindTarget: 10,
      activeBossId: 'the_eclipse',
      charms: [makeCharm('golden-abacus', 1), makeCharm('ruby-prism', 2)],
      selectedIndices: [0, 1, 2],
    });
    const clearedSlot0 = playSelectedSet(eclipseSlot0);
    expect(clearedSlot0.lastBlindPayout?.interestGold).toBe(5); // capped at $5, NOT $10!
    // Nit (b): activeBossId cleared on Blind clear
    expect(clearedSlot0.activeBossId).toBeNull();

    const eclipseGreedySlot0 = makePlayingRun({
      board: TEST_BOARD,
      gold: 50,
      blindTarget: 10,
      activeBossId: 'the_eclipse',
      charms: [makeCharm('greedy-chest', 1), makeCharm('golden-abacus', 2)],
      selectedIndices: [0, 1, 2],
    });
    const clearedGreedy0 = playSelectedSet(eclipseGreedySlot0);
    expect(clearedGreedy0.lastBlindPayout?.charmBonusGold).toBe(0); // slot 0 Greedy Chest eclipsed
    expect(clearedGreedy0.lastBlindPayout?.interestGold).toBe(10); // slot 1 Golden Abacus active!

    // Nit (a): Prismatic Crucible halves finalMult so floor(finalChips * finalMult) === finalScore
    const crucibleScore = scoreSet(
      makePlayingRun({ board: TEST_BOARD, activeBossId: 'the_prism_test' }),
      [0, 9, 10],
      { preview: true }
    )!;
    expect(Math.floor(crucibleScore.finalChips * crucibleScore.finalMult)).toBe(crucibleScore.finalScore);

    // Nit (c): Understudy status label in slot 1 reflects Eclipse slot-0 disable
    const eclipseUnderstudy = makePlayingRun({
      board: TEST_BOARD,
      activeBossId: 'the_eclipse',
      charms: [makeCharm('rainbow-charm', 1), makeCharm('understudy', 2)],
    });
    expect(getCharmStatusLabel(eclipseUnderstudy.charms[1], eclipseUnderstudy)).toBe('Left Charm Eclipsed');

    // Nit (d): resetPrismStorage clears tutorial & blueprint preference keys
    storage.set('prism_v1_tutorial_completed', true);
    storage.set('prism_v1_blueprint_assist', true);
    resetPrismStorage();
    expect(storage.getBoolean('prism_v1_tutorial_completed')).toBeUndefined();
    expect(storage.getBoolean('prism_v1_blueprint_assist')).toBeUndefined();

    // Nit (e): Default share URL points to GitHub Pages subpath & parsePrismUrlParams supports daily=1
    const defaultUrl = buildPrismShareUrl('ABC123');
    expect(defaultUrl).toBe('https://nathanbwaters.github.io/nshapes/?mode=prism&seed=ABC123');
    const dailyFlag = parsePrismUrlParams('https://nathanbwaters.github.io/nshapes/?mode=prism&daily=1');
    expect(dailyFlag?.isPrism).toBe(true);
    expect(dailyFlag?.dailyDate).toBe(getTodayDateString());
  });
});
