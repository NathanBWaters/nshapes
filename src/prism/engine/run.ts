/**
 * Pure immutable state reducer & lifecycle actions for Prism Deck.
 * Every action returns a new `PrismRun` without mutating inputs, keeping
 * rendering, undo/preview, persistence, and headless balance simulation 100% deterministic.
 */
import type {
  AnteRecord,
  BlindKind,
  BlindOffer,
  BlindPayoutBreakdown,
  BossBlindId,
  CardEdition,
  CharmRarity,
  CreateRunOptions,
  DailyMutatorId,
  OwnedCharm,
  OwnedSpell,
  PatternHandId,
  PrismCard,
  PrismColor,
  PrismNumber,
  PrismRun,
  PrismShape,
  SelectionPreview,
  ShopCharmOffer,
  ShopSpellOffer,
  ShopStarChartOffer,
  ShopState,
  SkipTagId,
  SpellId,
  StarterDeckId,
  VoucherId,
} from '../types';
import {
  PATTERN_HANDS,
  PATTERN_HAND_BY_ID,
  PRISM_COLORS,
  PRISM_NUMBERS,
  PRISM_SHAPES,
  createInitialHandLevels,
  createStandardDeck,
  cycleColor,
  cycleNumber,
  cycleShape,
  hasCardEdition,
} from '../data/cards';
import {
  CHARMS,
  CHARM_BY_ID,
  getActiveSynergies,
  getCharmSellValue,
} from '../data/charms';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import {
  BLIND_REWARD_GOLD,
  BOSS_BLINDS,
  BOSS_BLIND_BY_ID,
  SKIP_TAGS,
  SKIP_TAG_BY_ID,
  STARTER_DECK_BY_ID,
  VICTORY_ANTE,
  VOUCHERS,
  VOUCHER_BY_ID,
  getBlindTarget,
} from '../data/blinds';
import {
  generateRandomSeed,
  getDailyMutatorForDate,
  getDailySeed,
  hashStringToSeed,
  nextFloat,
  normalizeDailyDate,
  normalizeSeed,
  pickOne,
  shuffleArray,
} from './rng';
import {
  computeBlueprintNeed,
  ensurePlayableBoard,
  evaluateSet,
} from './sets';
import { pickNextBountyTarget, scoreSet } from './scoring';

const createEmptyHandPlayCounts = (): Record<PatternHandId, number> => ({
  simple_triad: 0,
  color_run: 0,
  shape_run: 0,
  number_run: 0,
  true_rainbow: 0,
  adjacency_chain: 0,
  prismatic_crown: 0,
});

const createOwnedCharm = (
  charmId: string,
  seq: number,
  rngState: number
): { charm: OwnedCharm; nextSeq: number; rngState: number } => {
  let state = rngState;
  const runtimeState: OwnedCharm['state'] = { counter: 0 };
  if (charmId === 'bounty-poster') {
    const pick = pickNextBountyTarget(state);
    state = pick.state;
    runtimeState.bountyTrait = pick.trait;
    runtimeState.bountyValue = pick.value;
    runtimeState.bountyProgress = 0;
  } else if (charmId === 'collectors-album') {
    runtimeState.stampedHands = [];
  } else if (charmId === 'glass-sword') {
    runtimeState.shattered = false;
  }
  return {
    charm: {
      instanceId: `charm-${seq}`,
      charmId,
      state: runtimeState,
    },
    nextSeq: seq + 1,
    rngState: state,
  };
};

const createOwnedSpell = (
  spellId: SpellId,
  seq: number
): { spell: OwnedSpell; nextSeq: number } => ({
  spell: { instanceId: `spell-${seq}`, spellId },
  nextSeq: seq + 1,
});

const getBossTargetMutatorMultiplier = (mutatorId: DailyMutatorId | null): number => {
  if (mutatorId === 'golden_rush') return 1.15;
  if (mutatorId === 'wildcard_wednesday') return 1.1;
  return 1.0;
};

/** Generate the 3 Blinds (Small, Big, Boss) + Skip Tags + Ante Voucher for a given Ante. */
const generateAnteSchedule = (
  ante: number,
  seenBossIds: readonly BossBlindId[],
  ownedVouchers: readonly VoucherId[],
  dailyMutatorId: DailyMutatorId | null,
  rngState: number
): {
  blinds: [BlindOffer, BlindOffer, BlindOffer];
  bossId: BossBlindId;
  voucherId: VoucherId | null;
  rngState: number;
} => {
  let state = rngState;

  // Pick 2 distinct Skip Tags for Small and Big Blinds
  const tagIds = SKIP_TAGS.map(t => t.id);
  const tag1Pick = pickOne(tagIds, state);
  state = tag1Pick.state;
  const tag2Pick = pickOne(tagIds.filter(id => id !== tag1Pick.item), state);
  state = tag2Pick.state;

  // Pick a Boss Blind avoiding repeats until all 10 have been seen
  let bossPool = BOSS_BLINDS.map(b => b.id).filter(id => !seenBossIds.includes(id));
  if (bossPool.length === 0) bossPool = BOSS_BLINDS.map(b => b.id);
  // Keep Ante 1 welcoming: avoid The Monolith and Prismatic Crucible on Ante 1
  if (ante === 1) {
    const gentle = bossPool.filter(id => id !== 'the_wall' && id !== 'the_prism_test');
    if (gentle.length > 0) bossPool = gentle;
  }
  const bossPick = pickOne(bossPool, state);
  state = bossPick.state;
  const bossId = bossPick.item;
  const bossDef = BOSS_BLIND_BY_ID[bossId];

  const bossExtraMult = getBossTargetMutatorMultiplier(dailyMutatorId);

  const blinds: [BlindOffer, BlindOffer, BlindOffer] = [
    {
      kind: 'small',
      name: 'Small Blind',
      targetScore: getBlindTarget(ante, 'small'),
      rewardGold: BLIND_REWARD_GOLD.small,
      skipTagId: tag1Pick.item,
      status: 'upcoming',
    },
    {
      kind: 'big',
      name: 'Big Blind',
      targetScore: getBlindTarget(ante, 'big'),
      rewardGold: BLIND_REWARD_GOLD.big,
      skipTagId: tag2Pick.item,
      status: 'upcoming',
    },
    {
      kind: 'boss',
      name: bossDef.name,
      targetScore: getBlindTarget(ante, 'boss', bossId, bossExtraMult),
      rewardGold: BLIND_REWARD_GOLD.boss,
      bossId,
      status: 'upcoming',
    },
  ];

  // Pick 1 unowned Voucher for this Ante
  const availableVouchers = VOUCHERS.map(v => v.id).filter(id => !ownedVouchers.includes(id));
  let voucherId: VoucherId | null = null;
  if (availableVouchers.length > 0) {
    const vPick = pickOne(availableVouchers, state);
    state = vPick.state;
    voucherId = vPick.item;
  }

  return { blinds, bossId, voucherId, rngState: state };
};

const stampRandomDeckCards = (
  deck: readonly PrismCard[],
  edition: Exclude<CardEdition, 'none'>,
  count: number,
  rngState: number
): { deck: PrismCard[]; stampedIds: string[]; rngState: number } => {
  const nextDeck = deck.map(c => ({ ...c }));
  let state = rngState;
  const stampedIds: string[] = [];

  for (let n = 0; n < count; n++) {
    let candidates = nextDeck
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => c.edition === 'none');
    if (candidates.length === 0) {
      candidates = nextDeck
        .map((c, idx) => ({ c, idx }))
        .filter(({ c }) => c.edition !== edition);
    }
    if (candidates.length === 0) break;
    const pick = pickOne(candidates, state);
    state = pick.state;
    nextDeck[pick.item.idx] = { ...nextDeck[pick.item.idx], edition };
    stampedIds.push(nextDeck[pick.item.idx].id);
  }

  return { deck: nextDeck, stampedIds, rngState: state };
};

/** Create a brand-new deterministic Prism Deck run. */
export const createRun = (options: CreateRunOptions = {}): PrismRun => {
  const isDaily = Boolean(options.isDaily || options.dailyDate);
  const dailyDate = isDaily ? normalizeDailyDate(options.dailyDate) : null;
  const dailyMutatorId: DailyMutatorId | null = isDaily && dailyDate
    ? getDailyMutatorForDate(dailyDate)
    : null;

  const seed = isDaily && dailyDate
    ? getDailySeed(dailyDate)
    : normalizeSeed(options.seed) || generateRandomSeed(options.startedAt);

  const deckId: StarterDeckId = options.deckId ?? 'classic_prism';
  const deckDef = STARTER_DECK_BY_ID[deckId] ?? STARTER_DECK_BY_ID.classic_prism;

  let rngState = hashStringToSeed(`${seed}:${deckId}`);
  let nextSeq = 1;

  let deck = createStandardDeck();
  let gold = deckDef.startingGold;
  let baseHands = deckDef.baseHands;
  let baseDiscards = deckDef.baseDiscards;
  let baseBoardSize = deckDef.baseBoardSize;
  let maxCharms = deckDef.baseCharmSlots;
  let maxSpells = deckDef.baseSpellSlots;
  const unusedHandGoldBonus = deckDef.unusedHandGoldBonus;
  const handLevels = createInitialHandLevels();
  const charms: OwnedCharm[] = [];
  const spells: OwnedSpell[] = [];

  // Apply Starter Deck bonuses
  if (deckId === 'gilded_ledger') {
    const res = stampRandomDeckCards(deck, 'gold', 2, rngState);
    deck = res.deck;
    rngState = res.rngState;
  } else if (deckId === 'alchemist_grimoire') {
    const cRes = createOwnedCharm('alchemists-flask', nextSeq, rngState);
    charms.push(cRes.charm);
    nextSeq = cRes.nextSeq;
    rngState = cRes.rngState;
    const s1 = createOwnedSpell('repaint', nextSeq);
    spells.push(s1.spell);
    nextSeq = s1.nextSeq;
    const s2 = createOwnedSpell('glass-stamp', nextSeq);
    spells.push(s2.spell);
    nextSeq = s2.nextSeq;
  } else if (deckId === 'glass_mirage') {
    const gRes = stampRandomDeckCards(deck, 'glass', 4, rngState);
    deck = gRes.deck;
    rngState = gRes.rngState;
    const wRes = stampRandomDeckCards(deck, 'wild', 1, rngState);
    deck = wRes.deck;
    rngState = wRes.rngState;
  }

  // Apply Daily Mutator twists
  if (dailyMutatorId === 'golden_rush') {
    gold += 10;
  } else if (dailyMutatorId === 'rainbow_fever') {
    handLevels.true_rainbow = 3;
    handLevels.prismatic_crown = 3;
  } else if (dailyMutatorId === 'glass_house') {
    const gRes = stampRandomDeckCards(deck, 'glass', 5, rngState);
    deck = gRes.deck;
    rngState = gRes.rngState;
  } else if (dailyMutatorId === 'tight_quarters') {
    baseBoardSize = Math.max(6, baseBoardSize - 3);
    baseHands += 1;
    baseDiscards += 1;
  } else if (dailyMutatorId === 'spellstorm') {
    for (let i = 0; i < 2 && spells.length < maxSpells; i++) {
      const sp = pickOne(SPELLS, rngState);
      rngState = sp.state;
      const created = createOwnedSpell(sp.item.id, nextSeq);
      spells.push(created.spell);
      nextSeq = created.nextSeq;
    }
  } else if (dailyMutatorId === 'six_charms') {
    maxCharms += 1;
    const commons = CHARMS.filter(c => c.rarity === 'common' && !charms.some(o => o.charmId === c.id));
    if (commons.length > 0) {
      const pick = pickOne(commons, rngState);
      rngState = pick.state;
      const created = createOwnedCharm(pick.item.id, nextSeq, rngState);
      charms.push(created.charm);
      nextSeq = created.nextSeq;
      rngState = created.rngState;
    }
  } else if (dailyMutatorId === 'wildcard_wednesday') {
    const wRes = stampRandomDeckCards(deck, 'wild', 2, rngState);
    deck = wRes.deck;
    rngState = wRes.rngState;
  }

  const schedule = generateAnteSchedule(1, [], [], dailyMutatorId, rngState);
  rngState = schedule.rngState;

  const firstRecord: AnteRecord = {
    ante: 1,
    small: 'pending',
    big: 'pending',
    boss: 'pending',
    bossId: schedule.bossId,
  };

  return {
    version: 1,
    runId: `prism-${seed}-${options.startedAt ?? Date.now()}`,
    seed,
    rngState,
    nextInstanceSeq: nextSeq,

    deckId,
    isDaily,
    dailyDate,
    dailyMutatorId,

    phase: 'blind_select',
    isEndless: false,
    abandoned: false,

    ante: 1,
    blindIndex: 0,
    anteBlinds: schedule.blinds,
    anteHistory: [firstRecord],
    seenBossIds: [schedule.bossId],

    gold,
    baseHands,
    baseDiscards,
    baseBoardSize,
    boardCols: 3,
    maxCharms,
    maxSpells,
    unusedHandGoldBonus,

    deck,
    charms,
    spells,
    vouchers: [],
    handLevels,
    starChartsUsed: 0,
    pendingTags: {
      investmentCount: 0,
      freeRareCharmNextShop: false,
      couponHalfOffNextShop: false,
      bonusHandsNextBlind: 0,
    },

    blindScore: 0,
    blindTarget: schedule.blinds[0].targetScore,
    handsLeft: baseHands,
    discardsLeft: baseDiscards,
    handsPlayedThisBlind: 0,
    discardsUsedThisBlind: 0,
    board: [],
    drawPile: [],
    discardPile: [],
    selectedIndices: [],
    lastSetIndices: [],
    lastPlayedHandThisBlind: null,
    activeBossId: null,

    shop: null,
    anteVoucherId: schedule.voucherId,
    lastScoreBreakdown: null,
    lastBlindPayout: null,
    lastToast: null,

    stats: {
      setsPlayed: 0,
      discardsUsed: 0,
      spellsUsed: 0,
      shatteredCards: 0,
      bestSingleSet: 0,
      totalScore: 0,
      totalGoldEarned: 0,
      blindsCleared: 0,
      blindsSkipped: 0,
      handPlayCounts: createEmptyHandPlayCounts(),
    },
    startedAt: options.startedAt ?? Date.now(),
  };
};

/** Compute effective board size for the active Blind (respecting Field Stone & Narrow Table Boss). */
export const getEffectiveBoardSize = (run: PrismRun, bossId: BossBlindId | null): number => {
  const hasFieldStone = run.charms.some((c, idx) =>
    c.charmId === 'field-stone' && !(bossId === 'the_eclipse' && idx === 0)
  );
  let size = run.baseBoardSize + (hasFieldStone ? 3 : 0);
  if (bossId === 'the_narrow') size -= 3;
  return Math.max(6, Math.min(15, size));
};

const drawCardsIntoSlots = (
  board: readonly PrismCard[],
  slotIndices: readonly number[],
  drawPile: readonly PrismCard[],
  discardPile: readonly PrismCard[],
  rngState: number
): { board: PrismCard[]; drawPile: PrismCard[]; discardPile: PrismCard[]; rngState: number } => {
  const nextBoard = [...board];
  let nextDraw = [...drawPile];
  let nextDiscard = [...discardPile];
  let state = rngState;

  // Sort slots descending if removing, or refill in place
  const emptySlots: number[] = [];
  for (const slot of slotIndices) {
    if (nextDraw.length === 0 && nextDiscard.length > 0) {
      const shuf = shuffleArray(nextDiscard, state);
      nextDraw = shuf.items;
      state = shuf.state;
      nextDiscard = [];
    }
    const drawn = nextDraw.shift();
    if (drawn) {
      nextBoard[slot] = drawn;
    } else {
      emptySlots.push(slot);
    }
  }

  // If deck is tiny and couldn't fill all vacated slots, compact board cleanly
  const compacted = emptySlots.length > 0
    ? nextBoard.filter((_, idx) => !emptySlots.includes(idx))
    : nextBoard;

  return {
    board: compacted,
    drawPile: nextDraw,
    discardPile: nextDiscard,
    rngState: state,
  };
};

const refreshMagnetMark = (
  charms: readonly OwnedCharm[],
  board: readonly PrismCard[],
  rngState: number,
  forceRepick: boolean
): { charms: OwnedCharm[]; rngState: number } => {
  let state = rngState;
  const next = charms.map(c => {
    if (c.charmId !== 'magnet') return c;
    const stillOnBoard = !forceRepick && c.state.magnetCardId && board.some(card => card.id === c.state.magnetCardId);
    if (stillOnBoard || board.length === 0) return c;
    const pick = pickOne(board, state);
    state = pick.state;
    return { ...c, state: { ...c.state, magnetCardId: pick.item.id } };
  });
  return { charms: next, rngState: state };
};

/** Enter the current Blind from `blind_select`, dealing a deadlock-safe board. */
export const selectBlind = (run: PrismRun): PrismRun => {
  if (run.phase !== 'blind_select') return run;
  const currentOffer = run.anteBlinds[run.blindIndex];
  if (!currentOffer) return run;

  const bossId = currentOffer.kind === 'boss' ? currentOffer.bossId ?? null : null;
  let state = run.rngState;

  // Build fresh shuffled draw pile from master deck (stripping any lingering tempWild)
  const freshDeck = run.deck.map(c => (c.tempWild ? { ...c, tempWild: undefined } : { ...c }));
  const shuf = shuffleArray(freshDeck, state);
  state = shuf.state;

  const boardSize = Math.min(getEffectiveBoardSize(run, bossId), shuf.items.length);
  let board = shuf.items.slice(0, boardSize);
  let drawPile = shuf.items.slice(boardSize);
  let discardPile: PrismCard[] = [];

  // Wild Weaver: stamp board[0] as tempWild for this Blind (unless eclipsed in slot 0)
  const hasActiveWildWeaver = run.charms.some((c, idx) =>
    c.charmId === 'wild-card' && !(bossId === 'the_eclipse' && idx === 0)
  );
  if (hasActiveWildWeaver && board.length > 0) {
    board = board.map((c, idx) => (idx === 0 ? { ...c, tempWild: true } : c));
  }

  // Guarantee at least 1 valid Set on board
  const safe = ensurePlayableBoard(board, drawPile, discardPile, state);
  board = safe.board;
  drawPile = safe.drawPile;
  discardPile = safe.discardPile;
  state = safe.rngState;

  // Reset per-blind Charm states (Glass Sword reforges, Magnet picks a fresh mark)
  let nextCharms = run.charms.map(c =>
    c.charmId === 'glass-sword' ? { ...c, state: { ...c.state, shattered: false } } : c
  );
  const mag = refreshMagnetMark(nextCharms, board, state, true);
  nextCharms = mag.charms;
  state = mag.rngState;

  const nextBlinds = run.anteBlinds.map((b, idx) =>
    idx === run.blindIndex ? { ...b, status: 'active' as const } : b
  ) as [BlindOffer, BlindOffer, BlindOffer];

  const handsLeft = run.baseHands + run.pendingTags.bonusHandsNextBlind;
  const discardsLeft = bossId === 'the_pinch' ? 0 : run.baseDiscards;

  return {
    ...run,
    phase: 'playing',
    rngState: state,
    anteBlinds: nextBlinds,
    charms: nextCharms,
    pendingTags: {
      ...run.pendingTags,
      bonusHandsNextBlind: 0,
    },
    blindScore: 0,
    blindTarget: currentOffer.targetScore,
    handsLeft,
    discardsLeft,
    handsPlayedThisBlind: 0,
    discardsUsedThisBlind: 0,
    board,
    drawPile,
    discardPile,
    selectedIndices: [],
    lastSetIndices: [],
    lastPlayedHandThisBlind: null,
    activeBossId: bossId,
    lastScoreBreakdown: null,
    lastBlindPayout: null,
    lastToast: safe.toast,
  };
};

/** Skip a Small or Big Blind (never Boss) to claim its Skip Tag reward and advance to the next Blind. */
export const skipBlind = (run: PrismRun): PrismRun => {
  if (run.phase !== 'blind_select') return run;
  const offer = run.anteBlinds[run.blindIndex];
  if (!offer || offer.kind === 'boss' || !offer.skipTagId) return run;

  const tagId: SkipTagId = offer.skipTagId;
  const tagDef = SKIP_TAG_BY_ID[tagId];
  let state = run.rngState;
  let nextSeq = run.nextInstanceSeq;
  let deck = run.deck;
  let gold = run.gold;
  let totalGoldEarned = run.stats.totalGoldEarned;
  const handLevels = { ...run.handLevels };
  let starChartsUsed = run.starChartsUsed;
  const spells = [...run.spells];
  const pendingTags = { ...run.pendingTags };
  let toast = `Skipped ${offer.name} — ${tagDef.name}!`;

  switch (tagId) {
    case 'investment_tag':
      pendingTags.investmentCount += 1;
      toast = `${tagDef.name}: +$15 after this Ante's Boss!`;
      break;
    case 'foil_cache': {
      const res = stampRandomDeckCards(deck, 'foil', 2, state);
      deck = res.deck;
      state = res.rngState;
      toast = `${tagDef.name}: Stamped ${res.stampedIds.length} Foil cards!`;
      break;
    }
    case 'polychrome_spark': {
      const res = stampRandomDeckCards(deck, 'poly', 1, state);
      deck = res.deck;
      state = res.rngState;
      toast = `${tagDef.name}: Stamped a Polychrome card!`;
      break;
    }
    case 'charm_pack':
      pendingTags.freeRareCharmNextShop = true;
      toast = `${tagDef.name}: Free Rare Charm in next Shop!`;
      break;
    case 'star_shower': {
      const allHandIds = PATTERN_HANDS.map(h => h.id);
      const p1 = pickOne(allHandIds, state);
      state = p1.state;
      const p2 = pickOne(allHandIds.filter(id => id !== p1.item), state);
      state = p2.state;
      handLevels[p1.item] += 1;
      handLevels[p2.item] += 1;
      starChartsUsed += 2;
      toast = `${tagDef.name}: ${PATTERN_HAND_BY_ID[p1.item].name} & ${PATTERN_HAND_BY_ID[p2.item].name} leveled up!`;
      break;
    }
    case 'spell_cache': {
      let granted = 0;
      let overflowGold = 0;
      for (let i = 0; i < 2; i++) {
        if (spells.length < run.maxSpells) {
          const sp = pickOne(SPELLS, state);
          state = sp.state;
          const created = createOwnedSpell(sp.item.id, nextSeq);
          spells.push(created.spell);
          nextSeq = created.nextSeq;
          granted += 1;
        } else {
          overflowGold += 4;
        }
      }
      gold += overflowGold;
      totalGoldEarned += overflowGold;
      toast = overflowGold > 0
        ? `${tagDef.name}: +${granted} Spell(s) & +$${overflowGold} overflow!`
        : `${tagDef.name}: Added ${granted} Spells!`;
      break;
    }
    case 'coupon_tag':
      pendingTags.couponHalfOffNextShop = true;
      toast = `${tagDef.name}: Next Shop is 50% off!`;
      break;
    case 'juggler_tag':
      pendingTags.bonusHandsNextBlind += 2;
      toast = `${tagDef.name}: +2 Hands for the next Blind!`;
      break;
  }

  const nextBlinds = run.anteBlinds.map((b, idx) =>
    idx === run.blindIndex ? { ...b, status: 'skipped' as const } : b
  ) as [BlindOffer, BlindOffer, BlindOffer];

  const nextHistory = run.anteHistory.map(rec => {
    if (rec.ante !== run.ante) return rec;
    if (offer.kind === 'small') return { ...rec, small: 'skipped' as const };
    return { ...rec, big: 'skipped' as const };
  });

  const nextBlindIndex = Math.min(2, run.blindIndex + 1);

  return {
    ...run,
    rngState: state,
    nextInstanceSeq: nextSeq,
    deck,
    gold,
    handLevels,
    starChartsUsed,
    spells,
    pendingTags,
    blindIndex: nextBlindIndex,
    blindTarget: nextBlinds[nextBlindIndex].targetScore,
    anteBlinds: nextBlinds,
    anteHistory: nextHistory,
    lastToast: toast,
    stats: {
      ...run.stats,
      blindsSkipped: run.stats.blindsSkipped + 1,
      totalGoldEarned,
    },
  };
};

/** Toggle selection of a board card index (up to 3 selected). */
export const toggleCard = (run: PrismRun, boardIndex: number): PrismRun => {
  if (run.phase !== 'playing') return run;
  if (boardIndex < 0 || boardIndex >= run.board.length) return run;

  const existingPos = run.selectedIndices.indexOf(boardIndex);
  if (existingPos >= 0) {
    const next = run.selectedIndices.filter(i => i !== boardIndex);
    return { ...run, selectedIndices: next, lastToast: null };
  }
  if (run.selectedIndices.length >= 3) {
    return run;
  }
  return {
    ...run,
    selectedIndices: [...run.selectedIndices, boardIndex],
    lastToast: null,
  };
};

/** Clear all currently selected cards on the board. */
export const clearSelection = (run: PrismRun): PrismRun => {
  if (run.selectedIndices.length === 0) return run;
  return { ...run, selectedIndices: [] };
};

const applyDiscount = (basePrice: number, hasClearance: boolean, hasCoupon: boolean): number => {
  let price = basePrice;
  if (hasClearance) price = Math.max(1, Math.floor(price * 0.75));
  if (hasCoupon) price = Math.max(1, Math.floor(price * 0.5));
  return price;
};

const pickRarityForAnte = (ante: number, rngState: number): { rarity: CharmRarity; state: number } => {
  const roll = nextFloat(rngState);
  const v = roll.value;
  if (ante <= 2) {
    if (v < 0.62) return { rarity: 'common', state: roll.state };
    if (v < 0.92) return { rarity: 'uncommon', state: roll.state };
    return { rarity: 'rare', state: roll.state };
  }
  if (ante <= 5) {
    if (v < 0.46) return { rarity: 'common', state: roll.state };
    if (v < 0.84) return { rarity: 'uncommon', state: roll.state };
    return { rarity: 'rare', state: roll.state };
  }
  if (v < 0.34) return { rarity: 'common', state: roll.state };
  if (v < 0.74) return { rarity: 'uncommon', state: roll.state };
  return { rarity: 'rare', state: roll.state };
};

const getMostPlayedHand = (run: PrismRun): PatternHandId => {
  let best: PatternHandId = 'true_rainbow';
  let bestCount = -1;
  for (const h of PATTERN_HANDS) {
    const count = run.stats.handPlayCounts[h.id] ?? 0;
    if (count > bestCount || (count === bestCount && h.rank > PATTERN_HAND_BY_ID[best].rank)) {
      best = h.id;
      bestCount = count;
    }
  }
  return best;
};

const generateShopOffers = (
  run: PrismRun,
  rngState: number,
  options: { freeRareSlot: boolean; couponDiscount: boolean; keepVoucher?: ShopState['voucher'] }
): {
  charms: ShopCharmOffer[];
  starCharts: ShopStarChartOffer[];
  spells: ShopSpellOffer[];
  voucher: ShopState['voucher'];
  rngState: number;
} => {
  let state = rngState;
  const hasClearance = run.vouchers.includes('clearance_sale');
  const hasSpellSatchel = run.vouchers.includes('spell_satchel');
  const hasTelescope = run.vouchers.includes('telescope');

  // 3 Charm offers (no duplicates with owned or within the same roll)
  const ownedIds = new Set(run.charms.map(c => c.charmId));
  const pickedCharmIds = new Set<string>();
  const charms: ShopCharmOffer[] = [];

  for (let i = 0; i < 3; i++) {
    const forceRare = i === 0 && options.freeRareSlot;
    let rarity: CharmRarity;
    if (forceRare) {
      rarity = 'rare';
    } else {
      const rPick = pickRarityForAnte(run.ante, state);
      rarity = rPick.rarity;
      state = rPick.state;
    }

    let pool = CHARMS.filter(c => c.rarity === rarity && !ownedIds.has(c.id) && !pickedCharmIds.has(c.id));
    if (pool.length === 0) {
      pool = CHARMS.filter(c => !ownedIds.has(c.id) && !pickedCharmIds.has(c.id));
    }
    if (pool.length === 0) break;

    const pick = pickOne(pool, state);
    state = pick.state;
    pickedCharmIds.add(pick.item.id);
    charms.push({
      charmId: pick.item.id,
      price: forceRare ? 0 : applyDiscount(pick.item.cost, hasClearance, options.couponDiscount),
      sold: false,
      freeFromTag: forceRare || undefined,
    });
  }

  // 2 Star Chart offers
  const starCharts: ShopStarChartOffer[] = [];
  const pickedHands = new Set<PatternHandId>();
  const levelsGranted = hasTelescope ? 2 : 1;
  const baseChartPrice = 4;

  for (let i = 0; i < 2; i++) {
    let handId: PatternHandId;
    if (i === 0 && hasTelescope) {
      handId = getMostPlayedHand(run);
    } else {
      const pool = PATTERN_HANDS.map(h => h.id).filter(id => !pickedHands.has(id));
      const pick = pickOne(pool, state);
      state = pick.state;
      handId = pick.item;
    }
    pickedHands.add(handId);
    starCharts.push({
      handId,
      levelsGranted,
      price: applyDiscount(baseChartPrice, hasClearance, options.couponDiscount),
      sold: false,
    });
  }

  // 2 Spell offers (3 with Spell Satchel)
  const spellCount = hasSpellSatchel ? 3 : 2;
  const spells: ShopSpellOffer[] = [];
  const pickedSpells = new Set<SpellId>();
  for (let i = 0; i < spellCount; i++) {
    const pool = SPELLS.filter(s => !pickedSpells.has(s.id));
    if (pool.length === 0) break;
    const pick = pickOne(pool, state);
    state = pick.state;
    pickedSpells.add(pick.item.id);
    spells.push({
      spellId: pick.item.id,
      price: applyDiscount(pick.item.cost, hasClearance, options.couponDiscount),
      sold: false,
    });
  }

  // Ante Voucher (persists across Small/Big/Boss shops of this Ante until purchased)
  let voucher: ShopState['voucher'] = null;
  if (options.keepVoucher !== undefined) {
    voucher = options.keepVoucher;
  } else if (run.anteVoucherId && !run.vouchers.includes(run.anteVoucherId)) {
    const vDef = VOUCHER_BY_ID[run.anteVoucherId];
    voucher = {
      voucherId: vDef.id,
      price: applyDiscount(vDef.cost, hasClearance, false),
      sold: false,
    };
  }

  return { charms, starCharts, spells, voucher, rngState: state };
};

const openShopForRun = (run: PrismRun): PrismRun => {
  const hasClearance = run.vouchers.includes('clearance_sale');
  const baseReroll = run.dailyMutatorId === 'golden_rush' ? 2 : 4;
  const rerollCost = hasClearance ? Math.max(1, Math.floor(baseReroll * 0.75)) : baseReroll;

  const freeRareSlot = run.pendingTags.freeRareCharmNextShop;
  const couponDiscount = run.pendingTags.couponHalfOffNextShop;

  const built = generateShopOffers(run, run.rngState, {
    freeRareSlot,
    couponDiscount,
  });

  const shop: ShopState = {
    charms: built.charms,
    starCharts: built.starCharts,
    spells: built.spells,
    voucher: built.voucher,
    rerollCost,
    rerollCount: 0,
    discountedFromTag: couponDiscount,
  };

  return {
    ...run,
    phase: 'shop',
    rngState: built.rngState,
    shop,
    pendingTags: {
      ...run.pendingTags,
      freeRareCharmNextShop: false,
      couponHalfOffNextShop: false,
    },
  };
};

const computeBlindPayout = (run: PrismRun, handsRemaining: number, clearedKind: BlindKind): BlindPayoutBreakdown => {
  const blindReward = BLIND_REWARD_GOLD[clearedKind];
  const unusedHandsGold = Math.max(0, handsRemaining) * run.unusedHandGoldBonus;

  const activeCharms = run.activeBossId === 'the_eclipse' ? run.charms.slice(1) : run.charms;
  const hasAbacus = activeCharms.some(c => c.charmId === 'golden-abacus');
  const interestCap = hasAbacus ? 10 : 5;
  const interestGold = Math.min(interestCap, Math.floor(Math.max(0, run.gold) / 5));

  const greedyChests = activeCharms.filter(c => c.charmId === 'greedy-chest').length;
  const charmBonusGold = greedyChests * 3;

  const investmentTagGold = clearedKind === 'boss' ? run.pendingTags.investmentCount * 15 : 0;
  const totalGold = blindReward + unusedHandsGold + interestGold + charmBonusGold + investmentTagGold;

  return {
    blindReward,
    unusedHandsGold,
    interestGold,
    charmBonusGold,
    investmentTagGold,
    totalGold,
  };
};

/** Commit the 3 selected cards as a played Set, scoring left-to-right and advancing state. */
export const playSelectedSet = (run: PrismRun): PrismRun => {
  if (run.phase !== 'playing') return run;
  if (run.selectedIndices.length !== 3) {
    return { ...run, lastToast: 'Select 3 cards to play a Set.' };
  }

  const selectedCards = run.selectedIndices.map(i => run.board[i]).filter(Boolean);
  if (selectedCards.length !== 3) return run;

  const check = evaluateSet(selectedCards, run.selectedIndices, run.boardCols);
  if (!check.isValid) {
    return {
      ...run,
      lastToast: check.mismatchReason ?? 'Not a valid Set.',
    };
  }

  const result = scoreSet(run, run.selectedIndices, { preview: false });
  if (!result) return run;

  let state = result.nextRngState;
  const newHandsLeft = Math.max(0, run.handsLeft - 1);
  const newBlindScore = run.blindScore + result.finalScore;
  const newGold = Math.max(0, run.gold + result.goldDelta);

  // Permanently remove any shattered Glass cards from master deck
  const shatteredSet = new Set(result.shatteredCardIds);
  const nextDeck = shatteredSet.size > 0
    ? run.deck.filter(c => !shatteredSet.has(c.id))
    : run.deck;

  const nextHandCounts = {
    ...run.stats.handPlayCounts,
    [result.patternHand]: (run.stats.handPlayCounts[result.patternHand] ?? 0) + 1,
  };

  const nextStats = {
    ...run.stats,
    setsPlayed: run.stats.setsPlayed + 1,
    shatteredCards: run.stats.shatteredCards + result.shatteredCardIds.length,
    bestSingleSet: Math.max(run.stats.bestSingleSet, result.finalScore),
    totalScore: run.stats.totalScore + result.finalScore,
    totalGoldEarned: run.stats.totalGoldEarned + Math.max(0, result.goldDelta),
    handPlayCounts: nextHandCounts,
  };

  const shatterToast = result.shatteredCardIds.length > 0
    ? `${result.shatteredCardIds.length} Glass card shattered!`
    : null;

  // ── Check Blind Clear ─────────────────────────────────────────────────────
  if (newBlindScore >= run.blindTarget) {
    const clearedOffer = run.anteBlinds[run.blindIndex];
    const clearedKind = clearedOffer.kind;
    const prePayoutRun: PrismRun = {
      ...run,
      gold: newGold,
      deck: nextDeck,
      charms: result.updatedCharms,
    };
    const payout = computeBlindPayout(prePayoutRun, newHandsLeft, clearedKind);
    const goldAfterPayout = newGold + payout.totalGold;

    const nextBlinds = run.anteBlinds.map((b, idx) =>
      idx === run.blindIndex ? { ...b, status: 'cleared' as const } : b
    ) as [BlindOffer, BlindOffer, BlindOffer];

    const nextHistory = run.anteHistory.map(rec => {
      if (rec.ante !== run.ante) return rec;
      if (clearedKind === 'small') return { ...rec, small: 'cleared' as const };
      if (clearedKind === 'big') return { ...rec, big: 'cleared' as const };
      return { ...rec, boss: 'cleared' as const };
    });

    let nextSpells = [...run.spells];
    let nextSeq = run.nextInstanceSeq;
    let extraToast = shatterToast;
    if (clearedKind === 'boss' && run.dailyMutatorId === 'spellstorm' && nextSpells.length < run.maxSpells) {
      const sp = pickOne(SPELLS, state);
      state = sp.state;
      const created = createOwnedSpell(sp.item.id, nextSeq);
      nextSpells.push(created.spell);
      nextSeq = created.nextSeq;
      extraToast = `Spellstorm granted ${sp.item.name}!`;
    }

    const clearedRun: PrismRun = {
      ...run,
      rngState: state,
      nextInstanceSeq: nextSeq,
      gold: goldAfterPayout,
      deck: nextDeck,
      charms: result.updatedCharms,
      spells: nextSpells,
      anteBlinds: nextBlinds,
      anteHistory: nextHistory,
      pendingTags: clearedKind === 'boss'
        ? { ...run.pendingTags, investmentCount: 0 }
        : run.pendingTags,
      blindScore: newBlindScore,
      handsLeft: newHandsLeft,
      handsPlayedThisBlind: run.handsPlayedThisBlind + 1,
      selectedIndices: [],
      lastSetIndices: [...run.selectedIndices],
      lastPlayedHandThisBlind: result.patternHand,
      activeBossId: null,
      lastScoreBreakdown: result,
      lastBlindPayout: payout,
      lastToast: extraToast ?? `${clearedOffer.name} cleared! +$${payout.totalGold}`,
      stats: {
        ...nextStats,
        blindsCleared: nextStats.blindsCleared + 1,
        totalGoldEarned: nextStats.totalGoldEarned + payout.totalGold,
      },
    };

    // Ante 8 Boss Victory!
    if (clearedKind === 'boss' && run.ante === VICTORY_ANTE && !run.isEndless) {
      return {
        ...clearedRun,
        phase: 'victory',
        shop: null,
        lastToast: 'Ante 8 Boss Defeated — Prism Deck Victory!',
      };
    }

    // Pause on the felt table for the Balatro-style Blind Cleared / Cash Out tally before opening the Shop
    return {
      ...clearedRun,
      phase: 'cash_out',
      shop: null,
    };
  }

  // ── Check Defeat (Out of Hands) ───────────────────────────────────────────
  if (newHandsLeft === 0) {
    const failedKind = run.anteBlinds[run.blindIndex].kind;
    const nextBlinds = run.anteBlinds.map((b, idx) =>
      idx === run.blindIndex ? { ...b, status: 'failed' as const } : b
    ) as [BlindOffer, BlindOffer, BlindOffer];

    const nextHistory = run.anteHistory.map(rec => {
      if (rec.ante !== run.ante) return rec;
      if (failedKind === 'small') return { ...rec, small: 'failed' as const };
      if (failedKind === 'big') return { ...rec, big: 'failed' as const };
      return { ...rec, boss: 'failed' as const };
    });

    return {
      ...run,
      phase: 'defeat',
      rngState: state,
      gold: newGold,
      deck: nextDeck,
      charms: result.updatedCharms,
      anteBlinds: nextBlinds,
      anteHistory: nextHistory,
      blindScore: newBlindScore,
      handsLeft: 0,
      handsPlayedThisBlind: run.handsPlayedThisBlind + 1,
      selectedIndices: [],
      lastSetIndices: [...run.selectedIndices],
      lastPlayedHandThisBlind: result.patternHand,
      activeBossId: null,
      lastScoreBreakdown: result,
      lastToast: shatterToast ?? 'Out of Hands — Run Ended.',
      stats: nextStats,
    };
  }

  // ── Continue Blind: Move non-shattered scored cards to discard & refill ───
  const survivorsToDiscard = selectedCards
    .filter(c => !shatteredSet.has(c.id))
    .map(c => (c.tempWild ? { ...c, tempWild: undefined } : c));
  const nextDiscardPile = [...run.discardPile, ...survivorsToDiscard];

  const refilled = drawCardsIntoSlots(
    run.board,
    run.selectedIndices,
    run.drawPile,
    nextDiscardPile,
    state
  );
  state = refilled.rngState;

  // Guarantee playable board (auto-reshuffle if zero Sets remain)
  const safe = ensurePlayableBoard(refilled.board, refilled.drawPile, refilled.discardPile, state);
  state = safe.rngState;

  // Move Magnet mark if its marked card was just used or left the board
  const magnetWasUsed = result.updatedCharms.some(
    c => c.charmId === 'magnet' && selectedCards.some(sc => sc.id === c.state.magnetCardId)
  );
  const mag = refreshMagnetMark(result.updatedCharms, safe.board, state, magnetWasUsed);
  state = mag.rngState;

  return {
    ...run,
    rngState: state,
    gold: newGold,
    deck: nextDeck,
    charms: mag.charms,
    blindScore: newBlindScore,
    handsLeft: newHandsLeft,
    handsPlayedThisBlind: run.handsPlayedThisBlind + 1,
    board: safe.board,
    drawPile: safe.drawPile,
    discardPile: safe.discardPile,
    selectedIndices: [],
    lastSetIndices: [...run.selectedIndices],
    lastPlayedHandThisBlind: result.patternHand,
    lastScoreBreakdown: result,
    lastToast: safe.toast ?? shatterToast,
    stats: nextStats,
  };
};

/** Discard 1-3 selected board cards and draw replacements (costs 1 Discard). */
export const discardSelected = (run: PrismRun): PrismRun => {
  if (run.phase !== 'playing') return run;
  if (run.discardsLeft <= 0) return { ...run, lastToast: 'No Discards left this Blind.' };
  if (run.selectedIndices.length === 0 || run.selectedIndices.length > 3) {
    return { ...run, lastToast: 'Select 1 to 3 cards to discard.' };
  }

  const discardedCards = run.selectedIndices
    .map(i => run.board[i])
    .filter(Boolean)
    .map(c => (c.tempWild ? { ...c, tempWild: undefined } : c));
  const nextDiscardPile = [...run.discardPile, ...discardedCards];

  let state = run.rngState;
  const refilled = drawCardsIntoSlots(
    run.board,
    run.selectedIndices,
    run.drawPile,
    nextDiscardPile,
    state
  );
  state = refilled.rngState;

  const safe = ensurePlayableBoard(refilled.board, refilled.drawPile, refilled.discardPile, state);
  state = safe.rngState;

  // Snowball loses 4 Mult (min 0) on Discard; Golden Abacus grants +$1
  let nextCharms = run.charms.map(c =>
    c.charmId === 'snowball'
      ? { ...c, state: { ...c.state, counter: Math.max(0, c.state.counter - 4) } }
      : c
  );
  const mag = refreshMagnetMark(nextCharms, safe.board, state, false);
  nextCharms = mag.charms;
  state = mag.rngState;

  const abacusBonus = run.charms.some((c, idx) =>
    c.charmId === 'golden-abacus' && !(run.activeBossId === 'the_eclipse' && idx === 0)
  )
    ? 1
    : 0;

  return {
    ...run,
    rngState: state,
    gold: run.gold + abacusBonus,
    charms: nextCharms,
    discardsLeft: run.discardsLeft - 1,
    discardsUsedThisBlind: run.discardsUsedThisBlind + 1,
    board: safe.board,
    drawPile: safe.drawPile,
    discardPile: safe.discardPile,
    selectedIndices: [],
    lastToast: safe.toast ?? (abacusBonus > 0 ? 'Discarded (+$1 Abacus)' : null),
    stats: {
      ...run.stats,
      discardsUsed: run.stats.discardsUsed + 1,
      totalGoldEarned: run.stats.totalGoldEarned + abacusBonus,
    },
  };
};

/**
 * Cast a Consumable Spell from `run.spells[spellIndex]` targeting a board card.
 * If `targetCardId` is omitted and exactly 1 card is selected on board, targets that selected card.
 * For `repaint`, `reshape`, `renumber`, passing `targetValue` sets the exact trait value; omitting cycles it.
 *
 * Exported as both `castSpell` (recommended in React components to satisfy `react-hooks/rules-of-hooks`)
 * and `useSpell` (alias).
 */
export const castSpell = (
  run: PrismRun,
  spellIndex: number,
  targetCardId?: string,
  targetValue?: PrismColor | PrismShape | PrismNumber | string | number
): PrismRun => {
  if (run.phase !== 'playing') return run;
  const ownedSpell = run.spells[spellIndex];
  if (!ownedSpell) return run;

  let boardSlot = -1;
  if (targetCardId) {
    boardSlot = run.board.findIndex(c => c.id === targetCardId);
  } else if (run.selectedIndices.length === 1) {
    boardSlot = run.selectedIndices[0];
  }

  if (boardSlot < 0 || boardSlot >= run.board.length) {
    return { ...run, lastToast: 'Select 1 card on the board to cast this Spell.' };
  }

  const target = run.board[boardSlot];
  const spellDef = SPELL_BY_ID[ownedSpell.spellId];
  let state = run.rngState;
  let nextSeq = run.nextInstanceSeq;
  let nextDeck = run.deck.map(c => ({ ...c }));
  let nextBoard = run.board.map(c => ({ ...c }));
  let nextDraw = [...run.drawPile];
  let nextDiscard = [...run.discardPile];
  let toast = `Cast ${spellDef.name}!`;

  const syncDeckCard = (updated: PrismCard) => {
    const deckIdx = nextDeck.findIndex(c => c.id === updated.id);
    if (deckIdx >= 0) {
      nextDeck[deckIdx] = { ...updated, tempWild: undefined };
    }
  };

  switch (ownedSpell.spellId) {
    case 'repaint': {
      const hasExplicit =
        typeof targetValue === 'string' && PRISM_COLORS.includes(targetValue as PrismColor);
      if (hasExplicit && targetValue === target.color) {
        return { ...run, lastToast: 'Card is already that Color — pick a different Color.' };
      }
      const nextColor: PrismColor = hasExplicit
        ? (targetValue as PrismColor)
        : cycleColor(target.color);
      const updated = { ...target, color: nextColor };
      nextBoard[boardSlot] = updated;
      syncDeckCard(updated);
      toast = `Repainted card to ${nextColor.toUpperCase()}!`;
      break;
    }

    case 'reshape': {
      const hasExplicit =
        typeof targetValue === 'string' && PRISM_SHAPES.includes(targetValue as PrismShape);
      if (hasExplicit && targetValue === target.shape) {
        return { ...run, lastToast: 'Card is already that Shape — pick a different Shape.' };
      }
      const nextShape: PrismShape = hasExplicit
        ? (targetValue as PrismShape)
        : cycleShape(target.shape);
      const updated = { ...target, shape: nextShape };
      nextBoard[boardSlot] = updated;
      syncDeckCard(updated);
      toast = `Reshaped card to ${nextShape.toUpperCase()}!`;
      break;
    }

    case 'renumber': {
      const numVal = typeof targetValue === 'string' ? Number(targetValue) : targetValue;
      const hasExplicit =
        typeof numVal === 'number' && PRISM_NUMBERS.includes(numVal as PrismNumber);
      if (hasExplicit && numVal === target.number) {
        return { ...run, lastToast: 'Card already has that Number — pick a different Number.' };
      }
      const nextNum: PrismNumber = hasExplicit
        ? (numVal as PrismNumber)
        : cycleNumber(target.number);
      const updated = { ...target, number: nextNum };
      nextBoard[boardSlot] = updated;
      syncDeckCard(updated);
      toast = `Renumbered card to ${nextNum}!`;
      break;
    }

    case 'clone': {
      const cloned: PrismCard = {
        id: `card-clone-${nextSeq}`,
        color: target.color,
        shape: target.shape,
        number: target.number,
        edition: target.edition,
      };
      nextSeq += 1;
      nextDeck.push(cloned);
      const inserted = shuffleArray([...nextDraw, cloned], state);
      nextDraw = inserted.items;
      state = inserted.state;
      toast = 'Cloned card shuffled into your deck!';
      break;
    }

    case 'prune': {
      if (run.deck.length <= 3) {
        return { ...run, lastToast: 'Cannot prune below 3 cards — deck needs at least 1 Set!' };
      }
      nextDeck = nextDeck.filter(c => c.id !== target.id);
      const refilled = drawCardsIntoSlots(nextBoard, [boardSlot], nextDraw, nextDiscard, state);
      nextBoard = refilled.board;
      nextDraw = refilled.drawPile;
      nextDiscard = refilled.discardPile;
      state = refilled.rngState;
      toast = `Pruned card permanently (${nextDeck.length} cards left).`;
      break;
    }

    case 'wild-stamp': {
      const updated: PrismCard = { ...target, edition: 'wild' };
      nextBoard[boardSlot] = updated;
      syncDeckCard(updated);
      toast = 'Stamped permanent WILD edition!';
      break;
    }

    case 'glass-stamp': {
      const updated: PrismCard = { ...target, edition: 'glass' };
      nextBoard[boardSlot] = updated;
      syncDeckCard(updated);
      toast = 'Stamped permanent GLASS edition (×2 Mult)!';
      break;
    }

    case 'gild': {
      const updated: PrismCard = { ...target, edition: 'gold' };
      nextBoard[boardSlot] = updated;
      syncDeckCard(updated);
      toast = 'Stamped permanent GOLD edition (+$3)!';
      break;
    }
  }

  // Ensure board remains playable after mutation / pruning
  const safe = ensurePlayableBoard(nextBoard, nextDraw, nextDiscard, state);
  nextBoard = safe.board;
  nextDraw = safe.drawPile;
  nextDiscard = safe.discardPile;
  state = safe.rngState;

  const mag = refreshMagnetMark(run.charms, nextBoard, state, false);
  state = mag.rngState;

  const nextSpells = run.spells.filter((_, idx) => idx !== spellIndex);

  return {
    ...run,
    rngState: state,
    nextInstanceSeq: nextSeq,
    deck: nextDeck,
    board: nextBoard,
    drawPile: nextDraw,
    discardPile: nextDiscard,
    charms: mag.charms,
    spells: nextSpells,
    selectedIndices: ownedSpell.spellId === 'prune' || safe.adjusted ? [] : run.selectedIndices,
    lastToast: safe.toast ?? toast,
    stats: {
      ...run.stats,
      spellsUsed: run.stats.spellsUsed + 1,
    },
  };
};

/** Alias of `castSpell` (use `castSpell` inside React component event handlers to avoid `rules-of-hooks`). */
export const useSpell = castSpell;

/** Reorder a Charm in the Charm bar (left-to-right order directly changes scoring!). */
export const reorderCharm = (run: PrismRun, fromIndex: number, toIndex: number): PrismRun => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= run.charms.length ||
    toIndex >= run.charms.length
  ) {
    return run;
  }
  const next = [...run.charms];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return { ...run, charms: next };
};

/** Sell an owned Charm for half its purchase cost (minimum $1). */
export const sellCharm = (run: PrismRun, charmIndex: number): PrismRun => {
  if (run.phase === 'victory' || run.phase === 'defeat') return run;
  const owned = run.charms[charmIndex];
  if (!owned) return run;

  const refund = getCharmSellValue(owned.charmId);
  const def = CHARM_BY_ID[owned.charmId];
  const nextCharms = run.charms.filter((_, idx) => idx !== charmIndex);
  return {
    ...run,
    gold: run.gold + refund,
    charms: nextCharms,
    lastToast: `Sold ${def?.name ?? owned.charmId} for +$${refund}.`,
    stats: {
      ...run.stats,
      totalGoldEarned: run.stats.totalGoldEarned + refund,
    },
  };
};

/** Purchase a Charm from the active Shop. */
export const buyShopCharm = (run: PrismRun, offerIndex: number): PrismRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const offer = run.shop.charms[offerIndex];
  if (!offer || offer.sold) return run;
  if (run.charms.length >= run.maxCharms) {
    return { ...run, lastToast: `Charm slots full (${run.maxCharms}/${run.maxCharms}) — sell a Charm first.` };
  }
  if (run.gold < offer.price) {
    return { ...run, lastToast: `Need $${offer.price} Gold.` };
  }

  const created = createOwnedCharm(offer.charmId, run.nextInstanceSeq, run.rngState);
  const nextOffers = run.shop.charms.map((o, idx) => (idx === offerIndex ? { ...o, sold: true } : o));
  const def = CHARM_BY_ID[offer.charmId];

  return {
    ...run,
    rngState: created.rngState,
    nextInstanceSeq: created.nextSeq,
    gold: run.gold - offer.price,
    charms: [...run.charms, created.charm],
    shop: { ...run.shop, charms: nextOffers },
    lastToast: `Bought ${def?.name ?? offer.charmId}!`,
  };
};

/** Purchase a Star Chart from the active Shop to permanently level up a Pattern Hand. */
export const buyStarChart = (run: PrismRun, offerIndex: number): PrismRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const offer = run.shop.starCharts[offerIndex];
  if (!offer || offer.sold) return run;
  if (run.gold < offer.price) {
    return { ...run, lastToast: `Need $${offer.price} Gold.` };
  }

  const nextLevels = {
    ...run.handLevels,
    [offer.handId]: (run.handLevels[offer.handId] ?? 1) + offer.levelsGranted,
  };
  const nextCharts = run.shop.starCharts.map((o, idx) => (idx === offerIndex ? { ...o, sold: true } : o));
  const handName = PATTERN_HAND_BY_ID[offer.handId].name;

  return {
    ...run,
    gold: run.gold - offer.price,
    handLevels: nextLevels,
    starChartsUsed: run.starChartsUsed + offer.levelsGranted,
    shop: { ...run.shop, starCharts: nextCharts },
    lastToast: `${handName} upgraded to Lv.${nextLevels[offer.handId]}!`,
  };
};

/** Purchase a Consumable Spell from the active Shop. */
export const buySpell = (run: PrismRun, offerIndex: number): PrismRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const offer = run.shop.spells[offerIndex];
  if (!offer || offer.sold) return run;
  if (run.spells.length >= run.maxSpells) {
    return { ...run, lastToast: `Spell slots full (${run.maxSpells}/${run.maxSpells}).` };
  }
  if (run.gold < offer.price) {
    return { ...run, lastToast: `Need $${offer.price} Gold.` };
  }

  const created = createOwnedSpell(offer.spellId, run.nextInstanceSeq);
  const nextOffers = run.shop.spells.map((o, idx) => (idx === offerIndex ? { ...o, sold: true } : o));
  const def = SPELL_BY_ID[offer.spellId];

  return {
    ...run,
    nextInstanceSeq: created.nextSeq,
    gold: run.gold - offer.price,
    spells: [...run.spells, created.spell],
    shop: { ...run.shop, spells: nextOffers },
    lastToast: `Bought ${def.name} Spell!`,
  };
};

/** Purchase the current Ante's permanent Voucher from the Shop. */
export const buyVoucher = (run: PrismRun): PrismRun => {
  if (run.phase !== 'shop' || !run.shop || !run.shop.voucher || run.shop.voucher.sold) return run;
  const offer = run.shop.voucher;
  if (run.gold < offer.price) {
    return { ...run, lastToast: `Need $${offer.price} Gold.` };
  }

  const voucherId = offer.voucherId;
  const vDef = VOUCHER_BY_ID[voucherId];
  let baseHands = run.baseHands;
  let baseDiscards = run.baseDiscards;
  let maxCharms = run.maxCharms;
  let maxSpells = run.maxSpells;
  let shop = { ...run.shop, voucher: { ...offer, sold: true } };

  switch (voucherId) {
    case 'extra_hand':
      baseHands += 1;
      break;
    case 'extra_discard':
      baseDiscards += 1;
      break;
    case 'extra_charm_slot':
      maxCharms += 1;
      break;
    case 'spell_satchel':
      maxSpells += 1;
      break;
    case 'clearance_sale':
      // Immediately discount remaining unsold items & reroll in current shop
      shop = {
        ...shop,
        rerollCost: Math.max(1, Math.floor(shop.rerollCost * 0.75)),
        charms: shop.charms.map(c =>
          c.sold || c.freeFromTag ? c : { ...c, price: Math.max(1, Math.floor(c.price * 0.75)) }
        ),
        starCharts: shop.starCharts.map(s =>
          s.sold ? s : { ...s, price: Math.max(1, Math.floor(s.price * 0.75)) }
        ),
        spells: shop.spells.map(s =>
          s.sold ? s : { ...s, price: Math.max(1, Math.floor(s.price * 0.75)) }
        ),
      };
      break;
    case 'telescope':
      // Upgrade remaining unsold Star Charts in current shop to +2 levels
      shop = {
        ...shop,
        starCharts: shop.starCharts.map(s => (s.sold ? s : { ...s, levelsGranted: 2 })),
      };
      break;
  }

  return {
    ...run,
    gold: run.gold - offer.price,
    baseHands,
    baseDiscards,
    maxCharms,
    maxSpells,
    vouchers: [...run.vouchers, voucherId],
    anteVoucherId: null,
    shop,
    lastToast: `Voucher activated: ${vDef.name}!`,
  };
};

/** Reroll the Shop's Charms, Star Charts, and Spells (escalating cost per reroll). */
export const rerollShop = (run: PrismRun): PrismRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  if (run.gold < run.shop.rerollCost) {
    return { ...run, lastToast: `Need $${run.shop.rerollCost} Gold to reroll.` };
  }

  const built = generateShopOffers(run, run.rngState, {
    freeRareSlot: false,
    couponDiscount: run.shop.discountedFromTag,
    keepVoucher: run.shop.voucher,
  });

  return {
    ...run,
    rngState: built.rngState,
    gold: run.gold - run.shop.rerollCost,
    shop: {
      charms: built.charms,
      starCharts: built.starCharts,
      spells: built.spells,
      voucher: built.voucher,
      rerollCost: run.shop.rerollCost + 1,
      rerollCount: run.shop.rerollCount + 1,
      discountedFromTag: run.shop.discountedFromTag,
    },
    lastToast: 'Shop rerolled!',
  };
};

/** Cash out after clearing a Blind and open the Shop. */
export const cashOutToShop = (run: PrismRun): PrismRun => {
  if (run.phase !== 'cash_out') return run;
  return openShopForRun(run);
};

/** Leave the Shop and advance to the next Blind (or next Ante after Boss). */
export const leaveShop = (run: PrismRun): PrismRun => {
  if (run.phase !== 'shop') return run;

  if (run.blindIndex < 2) {
    const nextIndex = run.blindIndex + 1;
    return {
      ...run,
      phase: 'blind_select',
      blindIndex: nextIndex,
      blindTarget: run.anteBlinds[nextIndex].targetScore,
      shop: null,
      lastToast: null,
    };
  }

  // Boss was just cleared -> advance to next Ante!
  const nextAnte = run.ante + 1;
  const schedule = generateAnteSchedule(
    nextAnte,
    run.seenBossIds,
    run.vouchers,
    run.dailyMutatorId,
    run.rngState
  );

  const nextRecord: AnteRecord = {
    ante: nextAnte,
    small: 'pending',
    big: 'pending',
    boss: 'pending',
    bossId: schedule.bossId,
  };

  return {
    ...run,
    phase: 'blind_select',
    rngState: schedule.rngState,
    ante: nextAnte,
    blindIndex: 0,
    anteBlinds: schedule.blinds,
    anteHistory: [...run.anteHistory, nextRecord],
    seenBossIds: [...run.seenBossIds, schedule.bossId],
    anteVoucherId: schedule.voucherId,
    blindTarget: schedule.blinds[0].targetScore,
    shop: null,
    lastToast: nextAnte > VICTORY_ANTE ? `Entering Endless Ante ${nextAnte}!` : `Welcome to Ante ${nextAnte}!`,
  };
};

/** From Ante 8 Victory screen, enter Endless Mode (opens the Ante 8 post-Boss Shop first!). */
export const continueEndless = (run: PrismRun): PrismRun => {
  if (run.phase !== 'victory') return run;
  const endlessRun: PrismRun = {
    ...run,
    isEndless: true,
    lastToast: 'Endless Mode unlocked — spend your Boss winnings!',
  };
  return openShopForRun(endlessRun);
};

/** Abandon an active run cleanly (marks defeat + abandoned flag). */
export const abandonRun = (run: PrismRun): PrismRun => {
  if (run.phase === 'victory' || run.phase === 'defeat') return run;
  return {
    ...run,
    phase: 'defeat',
    abandoned: true,
    shop: null,
    lastToast: 'Run abandoned.',
  };
};

/**
 * Live selection preview for 0, 1, 2, or 3 selected cards BEFORE committing!
 * - 0 or 1 card: cleanly returns empty/zero preview.
 * - 2 cards: returns `blueprintNeed` detailing the exact 3rd card traits needed.
 * - 3 invalid cards: returns `traitChecks` & `mismatchReason`.
 * - 3 valid cards: returns full Pattern Hand, triggered Charms, active Synergies,
 *   step-by-step Chips/Mult breakdown, Gold estimate, shatter risk, and `wouldClearBlind`.
 */
export const previewSelection = (run: PrismRun): SelectionPreview => {
  const count = run.selectedIndices.length;
  const baseActiveSynergies = getActiveSynergies(run).map(s => s.id);

  if (count < 2) {
    return {
      selectedCount: count,
      isValidSet: false,
      blueprintNeed: null,
      traitChecks: [],
      mismatchReason: null,
      patternHand: null,
      patternHandName: null,
      patternHandLevel: 0,
      triggeredCharmIds: [],
      activeSynergyIds: baseActiveSynergies,
      steps: [],
      estimatedChips: 0,
      estimatedMult: 0,
      estimatedTotal: 0,
      estimatedGold: 0,
      shatterRiskCardIds: [],
      wouldClearBlind: false,
    };
  }

  if (count === 2) {
    return {
      selectedCount: 2,
      isValidSet: false,
      blueprintNeed: computeBlueprintNeed(run.board, run.selectedIndices),
      traitChecks: [],
      mismatchReason: null,
      patternHand: null,
      patternHandName: null,
      patternHandLevel: 0,
      triggeredCharmIds: [],
      activeSynergyIds: baseActiveSynergies,
      steps: [],
      estimatedChips: 0,
      estimatedMult: 0,
      estimatedTotal: 0,
      estimatedGold: 0,
      shatterRiskCardIds: [],
      wouldClearBlind: false,
    };
  }

  // 3 selected cards
  const cards = run.selectedIndices.map(i => run.board[i]).filter(Boolean);
  const evalRes = evaluateSet(cards, run.selectedIndices, run.boardCols);
  if (!evalRes.isValid) {
    return {
      selectedCount: count,
      isValidSet: false,
      blueprintNeed: null,
      traitChecks: evalRes.traitChecks,
      mismatchReason: evalRes.mismatchReason,
      patternHand: null,
      patternHandName: null,
      patternHandLevel: 0,
      triggeredCharmIds: [],
      activeSynergyIds: baseActiveSynergies,
      steps: [],
      estimatedChips: 0,
      estimatedMult: 0,
      estimatedTotal: 0,
      estimatedGold: 0,
      shatterRiskCardIds: [],
      wouldClearBlind: false,
    };
  }

  const scored = scoreSet(run, run.selectedIndices, { preview: true });
  if (!scored) {
    return {
      selectedCount: count,
      isValidSet: false,
      blueprintNeed: null,
      traitChecks: evalRes.traitChecks,
      mismatchReason: 'Unable to score selection.',
      patternHand: null,
      patternHandName: null,
      patternHandLevel: 0,
      triggeredCharmIds: [],
      activeSynergyIds: baseActiveSynergies,
      steps: [],
      estimatedChips: 0,
      estimatedMult: 0,
      estimatedTotal: 0,
      estimatedGold: 0,
      shatterRiskCardIds: [],
      wouldClearBlind: false,
    };
  }

  return {
    selectedCount: 3,
    isValidSet: true,
    blueprintNeed: null,
    traitChecks: evalRes.traitChecks,
    mismatchReason: null,
    patternHand: scored.patternHand,
    patternHandName: scored.patternHandName,
    patternHandLevel: scored.patternHandLevel,
    triggeredCharmIds: scored.triggeredCharmIds,
    activeSynergyIds: scored.activeSynergyIds,
    steps: scored.steps,
    estimatedChips: scored.finalChips,
    estimatedMult: scored.finalMult,
    estimatedTotal: scored.finalScore,
    estimatedGold: scored.goldDelta,
    shatterRiskCardIds: scored.shatterRiskCardIds,
    wouldClearBlind: run.blindScore + scored.finalScore >= run.blindTarget,
  };
};

export interface DeckSummary {
  totalCards: number;
  drawPileCount: number;
  discardPileCount: number;
  editionCount: number;
  byColor: Record<PrismColor, number>;
  byShape: Record<PrismShape, number>;
  byNumber: Record<PrismNumber, number>;
  byEdition: Record<CardEdition, number>;
}

/** Selector helper summarizing master deck composition for a Deck Viewer modal. */
export const getDeckSummary = (run: PrismRun): DeckSummary => {
  const byColor: Record<PrismColor, number> = { red: 0, green: 0, purple: 0 };
  const byShape: Record<PrismShape, number> = { oval: 0, squiggle: 0, diamond: 0 };
  const byNumber: Record<PrismNumber, number> = { 1: 0, 2: 0, 3: 0 };
  const byEdition: Record<CardEdition, number> = {
    none: 0,
    foil: 0,
    holo: 0,
    poly: 0,
    glass: 0,
    gold: 0,
    wild: 0,
  };

  let editionCount = 0;
  for (const card of run.deck) {
    byColor[card.color] += 1;
    byShape[card.shape] += 1;
    byNumber[card.number] += 1;
    byEdition[card.edition] += 1;
    if (hasCardEdition(card)) editionCount += 1;
  }

  return {
    totalCards: run.deck.length,
    drawPileCount: run.drawPile.length,
    discardPileCount: run.discardPile.length,
    editionCount,
    byColor,
    byShape,
    byNumber,
    byEdition,
  };
};
