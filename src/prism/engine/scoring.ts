/**
 * True Balatro-style left-to-right scoring pipeline for Prism Deck.
 *
 * Order of operations (strictly deterministic, zero hidden caps):
 *  1. Pattern Hand base Chips & Mult (scaled by Star Chart hand level)
 *  2. Scored cards left-to-right (pips = Number × 10, Editions: Foil/Holo/Poly/Glass/Gold/Wild, Boss color debuffs)
 *  3. Charms strictly left-to-right (supporting Understudy left-copy, Amplifier Coil right-retrigger, Eclipse Boss slot-0 disable)
 *  4. Active Synergy Pair bonuses
 *  5. Boss Blind post-modifiers (No Repeats, The Tithe, Prismatic Crucible)
 *  6. Deterministic Glass shatter rolls & Charm runtime state updates (only on commit, never mutating preview)
 */
import type {
  OwnedCharm,
  PatternClassification,
  PatternHandId,
  PrismCard,
  PrismColor,
  PrismNumber,
  PrismRun,
  PrismShape,
  PrismTrait,
  ScoreResult,
  ScoreStep,
} from '../types';
import {
  EDITIONS,
  PRISM_COLORS,
  PRISM_NUMBERS,
  PRISM_SHAPES,
  formatCardLabel,
  getCardBaseChips,
  getPatternHandStats,
  hasCardEdition,
  isCardWild,
} from '../data/cards';
import {
  CHARM_BY_ID,
  getActiveSynergies,
  getDeckEditionCount,
  getTotalHandLevelUps,
} from '../data/charms';
import { BOSS_BLIND_BY_ID } from '../data/blinds';
import { evaluateSet } from './sets';
import { nextFloat, pickOne } from './rng';

const roundMult = (m: number): number => Math.round(m * 100) / 100;

interface SingleCharmEval {
  triggered: boolean;
  chipsDelta: number;
  multDelta: number;
  xMult: number;
  goldDelta: number;
  note?: string;
  /** Optional update to this charm's runtime state after commit. */
  nextState?: OwnedCharm['state'];
  nextRngState?: number;
}

export const pickNextBountyTarget = (
  rngState: number,
  prevValue?: string
): { trait: PrismTrait; value: string; state: number } => {
  const candidates: { trait: PrismTrait; value: string }[] = [
    ...PRISM_COLORS.map(v => ({ trait: 'color' as const, value: v })),
    ...PRISM_SHAPES.map(v => ({ trait: 'shape' as const, value: v })),
    ...PRISM_NUMBERS.map(v => ({ trait: 'number' as const, value: String(v) })),
  ];
  const filtered = prevValue ? candidates.filter(c => c.value !== prevValue) : candidates;
  const pick = pickOne(filtered, rngState);
  return { trait: pick.item.trait, value: pick.item.value, state: pick.state };
};

interface CharmEvalContext {
  run: PrismRun;
  selectedCards: readonly [PrismCard, PrismCard, PrismCard];
  selectedIndices: readonly [number, number, number];
  debuffedFlags: readonly [boolean, boolean, boolean];
  classification: PatternClassification;
  rngState: number;
  isCommit: boolean;
}

const evaluateSingleCharm = (
  charm: OwnedCharm,
  ctx: CharmEvalContext
): SingleCharmEval => {
  const { run, selectedCards, selectedIndices, debuffedFlags, classification } = ctx;
  const handId = classification.handId;
  const isRainbowLike = classification.isRainbow || handId === 'prismatic_crown';
  const isRun = handId === 'color_run' || handId === 'shape_run' || handId === 'number_run';
  const isAdjacentLike = classification.isAdjacent || handId === 'adjacency_chain' || handId === 'prismatic_crown';

  // Count non-debuffed cards matching resolved color/shape/number/edition
  const activeIndices = [0, 1, 2].filter(i => !debuffedFlags[i]);
  const countColor = (color: PrismColor): number =>
    activeIndices.filter(i => classification.resolvedColors[i] === color).length;
  const countNumber = (num: PrismNumber): number =>
    activeIndices.filter(i => classification.resolvedNumbers[i] === num).length;
  const countShape = (shape: PrismShape): number =>
    activeIndices.filter(i => classification.resolvedShapes[i] === shape).length;
  const countWilds = (): number => activeIndices.filter(i => isCardWild(selectedCards[i])).length;
  const countEditions = (): number => activeIndices.filter(i => hasCardEdition(selectedCards[i])).length;
  const countGlass = (): number => activeIndices.filter(i => selectedCards[i].edition === 'glass').length;

  const noTrigger: SingleCharmEval = {
    triggered: false,
    chipsDelta: 0,
    multDelta: 0,
    xMult: 1,
    goldDelta: 0,
  };

  switch (charm.charmId) {
    case 'rainbow-charm': {
      if (!isRainbowLike) return noTrigger;
      return { triggered: true, chipsDelta: 0, multDelta: 0, xMult: 2, goldDelta: 0, note: 'Rainbow ×2' };
    }

    case 'magnet': {
      const targetId = charm.state.magnetCardId;
      if (!targetId) return noTrigger;
      const hit = selectedCards.some(c => c.id === targetId);
      if (!hit) return noTrigger;
      return {
        triggered: true,
        chipsDelta: 0,
        multDelta: 14,
        xMult: 1,
        goldDelta: 0,
        note: 'Marked card +14M',
      };
    }

    case 'bounty-poster': {
      const trait = charm.state.bountyTrait;
      const val = charm.state.bountyValue;
      if (!trait || !val) return noTrigger;
      let matches = 0;
      if (trait === 'color') matches = countColor(val as PrismColor);
      else if (trait === 'shape') matches = countShape(val as PrismShape);
      else matches = countNumber(Number(val) as PrismNumber);
      if (matches <= 0) return noTrigger;

      let nextState = charm.state;
      let nextRng = ctx.rngState;
      if (ctx.isCommit) {
        const totalProg = (charm.state.bountyProgress ?? 0) + matches;
        if (totalProg >= 3) {
          const next = pickNextBountyTarget(nextRng, val);
          nextRng = next.state;
          nextState = {
            ...charm.state,
            bountyTrait: next.trait,
            bountyValue: next.value,
            bountyProgress: 0,
          };
        } else {
          nextState = { ...charm.state, bountyProgress: totalProg };
        }
      }
      return {
        triggered: true,
        chipsDelta: matches * 35,
        multDelta: 0,
        xMult: 1,
        goldDelta: 0,
        note: `${matches} Wanted (+${matches * 35}C)`,
        nextState,
        nextRngState: nextRng,
      };
    }

    case 'odd-one-out': {
      if (!isRun) return noTrigger;
      return { triggered: true, chipsDelta: 0, multDelta: 18, xMult: 1, goldDelta: 0, note: 'Pure Run +18M' };
    }

    case 'snowball': {
      // Gains +2 Mult on every Set played (applies the new total on this Set!)
      const nextMult = charm.state.counter + 2;
      return {
        triggered: true,
        chipsDelta: 0,
        multDelta: nextMult,
        xMult: 1,
        goldDelta: 0,
        note: `Snowball +${nextMult}M`,
        nextState: ctx.isCommit ? { ...charm.state, counter: nextMult } : undefined,
      };
    }

    case 'collectors-album': {
      const prevStamped = charm.state.stampedHands ?? [];
      const hasHand = prevStamped.includes(handId);
      const nextStamped: PatternHandId[] = hasHand ? prevStamped : [...prevStamped, handId];
      const mult = roundMult(1 + nextStamped.length * 0.25);
      return {
        triggered: true,
        chipsDelta: 0,
        multDelta: 0,
        xMult: mult,
        goldDelta: 0,
        note: `${nextStamped.length}/7 Hands (×${mult})`,
        nextState: ctx.isCommit && !hasHand ? { ...charm.state, stampedHands: nextStamped } : undefined,
      };
    }

    case 'glass-sword': {
      if (charm.state.shattered) {
        if (isRainbowLike) {
          return {
            triggered: true,
            chipsDelta: 0,
            multDelta: 0,
            xMult: 2.5,
            goldDelta: 0,
            note: 'Reforged! ×2.5',
            nextState: ctx.isCommit ? { ...charm.state, shattered: false } : undefined,
          };
        }
        return noTrigger;
      }
      if (handId === 'simple_triad') {
        return {
          triggered: true,
          chipsDelta: 0,
          multDelta: 0,
          xMult: 2.5,
          goldDelta: 0,
          note: '×2.5 (Shatters after!)',
          nextState: ctx.isCommit ? { ...charm.state, shattered: true } : undefined,
        };
      }
      return { triggered: true, chipsDelta: 0, multDelta: 0, xMult: 2.5, goldDelta: 0, note: 'Glass Sword ×2.5' };
    }

    case 'greedy-chest': {
      const bonus = Math.max(0, run.gold) * 2;
      if (bonus <= 0) return noTrigger;
      return {
        triggered: true,
        chipsDelta: bonus,
        multDelta: 0,
        xMult: 1,
        goldDelta: 0,
        note: `$${run.gold} → +${bonus}C`,
      };
    }

    case 'mirror-shard': {
      if (run.lastSetIndices.length === 0) return noTrigger;
      const overlaps = selectedIndices.some(i => run.lastSetIndices.includes(i));
      if (!overlaps) return noTrigger;
      return { triggered: true, chipsDelta: 65, multDelta: 0, xMult: 1, goldDelta: 0, note: 'Slot reused +65C' };
    }

    case 'tightrope': {
      if (!isAdjacentLike) return noTrigger;
      return { triggered: true, chipsDelta: 0, multDelta: 0, xMult: 2.25, goldDelta: 0, note: 'Adjacent ×2.25' };
    }

    case 'rally-horn': {
      const isFirstOrLast = run.handsPlayedThisBlind === 0 || run.handsLeft === 1;
      if (!isFirstOrLast) return noTrigger;
      return {
        triggered: true,
        chipsDelta: 0,
        multDelta: 16,
        xMult: 1,
        goldDelta: 0,
        note: run.handsPlayedThisBlind === 0 ? 'Opening Hand +16M' : 'Final Hand +16M',
      };
    }

    case 'fortunes-favor': {
      const gold = isRainbowLike ? 4 : 2;
      return {
        triggered: true,
        chipsDelta: 0,
        multDelta: 0,
        xMult: 1,
        goldDelta: gold,
        note: `+$${gold}`,
      };
    }

    case 'field-stone': {
      return { triggered: true, chipsDelta: 25, multDelta: 0, xMult: 1, goldDelta: 0, note: '+25C' };
    }

    case 'wild-card': {
      const w = countWilds();
      if (w <= 0) return noTrigger;
      return {
        triggered: true,
        chipsDelta: 0,
        multDelta: w * 12,
        xMult: 1,
        goldDelta: 0,
        note: `${w} Wild (+${w * 12}M)`,
      };
    }

    case 'ruby-prism': {
      const reds = countColor('red');
      if (reds <= 0) return noTrigger;
      return { triggered: true, chipsDelta: 0, multDelta: reds * 5, xMult: 1, goldDelta: 0, note: `${reds} Red (+${reds * 5}M)` };
    }

    case 'emerald-lens': {
      const greens = countColor('green');
      if (greens <= 0) return noTrigger;
      return { triggered: true, chipsDelta: greens * 35, multDelta: 0, xMult: 1, goldDelta: 0, note: `${greens} Green (+${greens * 35}C)` };
    }

    case 'amethyst-crown': {
      const purples = countColor('purple');
      if (purples <= 0) return noTrigger;
      const x = roundMult(Math.pow(1.35, purples));
      return { triggered: true, chipsDelta: 0, multDelta: 0, xMult: x, goldDelta: 0, note: `${purples} Purple (×${x})` };
    }

    case 'trinity-bell': {
      const threes = countNumber(3);
      if (threes <= 0) return noTrigger;
      return { triggered: true, chipsDelta: threes * 40, multDelta: 0, xMult: 1, goldDelta: 0, note: `${threes} Threes (+${threes * 40}C)` };
    }

    case 'minimalist-monk': {
      const ones = countNumber(1);
      if (ones <= 0) return noTrigger;
      return { triggered: true, chipsDelta: 0, multDelta: ones * 6, xMult: 1, goldDelta: 0, note: `${ones} Ones (+${ones * 6}M)` };
    }

    case 'sculptors-chisel': {
      const below = Math.max(0, 27 - run.deck.length);
      const chips = 25 + below * 25;
      return { triggered: true, chipsDelta: chips, multDelta: 0, xMult: 1, goldDelta: 0, note: `+${chips}C` };
    }

    case 'alchemists-flask': {
      const x = roundMult(1.2 + run.stats.spellsUsed * 0.2);
      return { triggered: true, chipsDelta: 0, multDelta: 0, xMult: x, goldDelta: 0, note: `×${x}` };
    }

    case 'glass-cannon': {
      const glassScored = countGlass();
      const x = roundMult(1.25 + run.stats.shatteredCards * 0.5);
      const chips = glassScored * 35;
      return {
        triggered: true,
        chipsDelta: chips,
        multDelta: 0,
        xMult: x,
        goldDelta: 0,
        note: chips > 0 ? `+${chips}C, ×${x}` : `×${x}`,
      };
    }

    case 'star-astronomer': {
      const ups = getTotalHandLevelUps(run);
      if (ups <= 0) return noTrigger;
      return {
        triggered: true,
        chipsDelta: ups * 15,
        multDelta: ups,
        xMult: 1,
        goldDelta: 0,
        note: `+${ups * 15}C +${ups}M`,
      };
    }

    case 'golden-abacus': {
      // Passive econ charm (interest cap $10 + $1 on discard) — doesn't alter Set score
      return noTrigger;
    }

    case 'discard-furnace': {
      const mult = run.discardsUsedThisBlind * 12;
      if (mult <= 0) return noTrigger;
      return {
        triggered: true,
        chipsDelta: 0,
        multDelta: mult,
        xMult: 1,
        goldDelta: 0,
        note: `${run.discardsUsedThisBlind} Discards (+${mult}M)`,
      };
    }

    case 'last-stand': {
      if (run.handsLeft !== 1) return noTrigger;
      return { triggered: true, chipsDelta: 0, multDelta: 0, xMult: 2.5, goldDelta: 0, note: 'Final Hand ×2.5' };
    }

    case 'edition-forge': {
      const eds = countEditions();
      if (eds <= 0) return noTrigger;
      return {
        triggered: true,
        chipsDelta: eds * 25,
        multDelta: eds * 8,
        xMult: 1,
        goldDelta: 0,
        note: `${eds} Edition (+${eds * 25}C +${eds * 8}M)`,
      };
    }

    case 'geometric-savant': {
      if (handId === 'prismatic_crown') {
        return { triggered: true, chipsDelta: 0, multDelta: 0, xMult: 3, goldDelta: 0, note: 'Crown ×3' };
      }
      if (isRun) {
        return { triggered: true, chipsDelta: 0, multDelta: 0, xMult: 2, goldDelta: 0, note: 'Pure Run ×2' };
      }
      return noTrigger;
    }

    case 'pendulum': {
      const isOddHand = run.handsPlayedThisBlind % 2 === 0; // 0th -> 1st hand (odd)
      if (isOddHand) {
        return { triggered: true, chipsDelta: 80, multDelta: 0, xMult: 1, goldDelta: 0, note: 'Odd Hand +80C' };
      }
      return { triggered: true, chipsDelta: 0, multDelta: 20, xMult: 1, goldDelta: 0, note: 'Even Hand +20M' };
    }

    case 'prism-sovereign': {
      const deckEds = getDeckEditionCount(run);
      if (deckEds <= 0) return noTrigger;
      const x = roundMult(1 + deckEds * 0.25);
      return {
        triggered: true,
        chipsDelta: 0,
        multDelta: 0,
        xMult: x,
        goldDelta: 0,
        note: `${deckEds} Ed. (×${x})`,
      };
    }

    case 'understudy':
    case 'amplifier-coil':
    default:
      return noTrigger;
  }
};

/**
 * Evaluate the complete Balatro-style left-to-right scoring pipeline for 3 selected cards.
 * Pass `{ preview: true }` to compute an exact live score preview with zero RNG consumption
 * or state mutation; pass `{ preview: false }` when committing a played Set.
 */
export const scoreSet = (
  run: PrismRun,
  selectedIndices: readonly number[],
  options: { preview?: boolean } = {}
): ScoreResult | null => {
  if (selectedIndices.length !== 3) return null;
  const i0 = selectedIndices[0];
  const i1 = selectedIndices[1];
  const i2 = selectedIndices[2];
  const c0 = run.board[i0];
  const c1 = run.board[i1];
  const c2 = run.board[i2];
  if (!c0 || !c1 || !c2) return null;

  const cards: [PrismCard, PrismCard, PrismCard] = [c0, c1, c2];
  const idxTriple: [number, number, number] = [i0, i1, i2];
  const evaluation = evaluateSet(cards, idxTriple, run.boardCols);
  if (!evaluation.isValid || !evaluation.classification) return null;

  const classification = evaluation.classification;
  const handId = classification.handId;
  const level = run.handLevels[handId] ?? 1;
  const { def: handDef, chips: baseChips, mult: baseMult } = getPatternHandStats(handId, level);

  const isCommit = !options.preview;
  let rngState = run.rngState;
  let chips = baseChips;
  let mult = baseMult;
  let goldDelta = 0;

  const steps: ScoreStep[] = [
    {
      kind: 'hand',
      label: `${handDef.name} Lv.${level}`,
      chipsDelta: baseChips,
      multDelta: baseMult,
      chipsAfter: chips,
      multAfter: mult,
    },
  ];

  // ── 2. Scored Cards Left-to-Right ─────────────────────────────────────────
  const bossDef = run.activeBossId ? BOSS_BLIND_BY_ID[run.activeBossId] : null;
  const debuffedColor = bossDef?.debuffedColor ?? null;
  const debuffedFlags: [boolean, boolean, boolean] = [false, false, false];
  const shatterRiskCardIds: string[] = [];

  for (let i = 0; i < 3; i++) {
    const card = cards[i];
    // Wild cards bypass color-specific Boss debuffs
    const isDebuffed = debuffedColor !== null && !isCardWild(card) && card.color === debuffedColor;
    debuffedFlags[i] = isDebuffed;

    if (isDebuffed) {
      steps.push({
        kind: 'debuff',
        cardId: card.id,
        label: `${formatCardLabel(card)} (Debuffed)`,
        chipsDelta: 0,
        multDelta: 0,
        chipsAfter: chips,
        multAfter: mult,
        debuffed: true,
        note: bossDef?.name,
      });
      continue;
    }

    const baseCardChips = getCardBaseChips(card);
    chips += baseCardChips;
    steps.push({
      kind: 'card',
      cardId: card.id,
      label: formatCardLabel(card),
      chipsDelta: baseCardChips,
      multDelta: 0,
      chipsAfter: chips,
      multAfter: mult,
    });

    const effectiveEdition = card.edition !== 'none' ? card.edition : card.tempWild ? 'wild' : 'none';
    if (effectiveEdition !== 'none') {
      const ed = EDITIONS[effectiveEdition];
      if (ed.chipsBonus) chips += ed.chipsBonus;
      if (ed.multBonus) mult = roundMult(mult + ed.multBonus);
      if (ed.xMult !== 1) mult = roundMult(mult * ed.xMult);
      if (ed.goldBonus) goldDelta += ed.goldBonus;
      if (effectiveEdition === 'glass') shatterRiskCardIds.push(card.id);

      steps.push({
        kind: 'edition',
        cardId: card.id,
        label: `${ed.name} Edition`,
        chipsDelta: ed.chipsBonus,
        multDelta: ed.multBonus,
        xMult: ed.xMult !== 1 ? ed.xMult : undefined,
        goldDelta: ed.goldBonus || undefined,
        chipsAfter: chips,
        multAfter: mult,
      });
    }
  }

  // ── 3. Charms Strictly Left-to-Right ──────────────────────────────────────
  const updatedCharms: OwnedCharm[] = run.charms.map(c => ({
    ...c,
    state: {
      ...c.state,
      stampedHands: c.state.stampedHands ? [...c.state.stampedHands] : undefined,
    },
  }));
  const triggeredCharmSet = new Set<string>();
  const isEclipse = run.activeBossId === 'the_eclipse';

  const applyCharmStep = (
    sourceCharm: OwnedCharm,
    slotIndex: number,
    displayLabel: string,
    ownerSlotForHighlight: number,
    mutateOwnerState: boolean
  ) => {
    const res = evaluateSingleCharm(sourceCharm, {
      run,
      selectedCards: cards,
      selectedIndices: idxTriple,
      debuffedFlags,
      classification,
      rngState,
      isCommit: isCommit && mutateOwnerState,
    });
    if (res.nextRngState !== undefined) {
      rngState = res.nextRngState;
    }
    if (mutateOwnerState && res.nextState) {
      updatedCharms[slotIndex] = { ...updatedCharms[slotIndex], state: res.nextState };
    }
    if (!res.triggered) return;

    triggeredCharmSet.add(updatedCharms[ownerSlotForHighlight].charmId);
    if (res.chipsDelta) chips += res.chipsDelta;
    if (res.multDelta) mult = roundMult(mult + res.multDelta);
    if (res.xMult !== 1) mult = roundMult(mult * res.xMult);
    if (res.goldDelta) goldDelta += res.goldDelta;

    steps.push({
      kind: 'charm',
      charmId: updatedCharms[ownerSlotForHighlight].charmId,
      charmSlot: ownerSlotForHighlight,
      label: displayLabel,
      chipsDelta: res.chipsDelta,
      multDelta: res.multDelta,
      xMult: res.xMult !== 1 ? res.xMult : undefined,
      goldDelta: res.goldDelta || undefined,
      chipsAfter: chips,
      multAfter: mult,
      note: res.note,
    });
  };

  for (let i = 0; i < updatedCharms.length; i++) {
    const owned = updatedCharms[i];
    const def = CHARM_BY_ID[owned.charmId];
    if (!def) continue;

    if (isEclipse && i === 0) {
      steps.push({
        kind: 'debuff',
        charmId: owned.charmId,
        charmSlot: i,
        label: `${def.name} (Eclipsed)`,
        chipsDelta: 0,
        multDelta: 0,
        chipsAfter: chips,
        multAfter: mult,
        debuffed: true,
        note: 'The Eclipse',
      });
      continue;
    }

    if (owned.charmId === 'understudy') {
      // Copies the Charm immediately to its LEFT (using pre-hand snapshot so preview === commit!)
      if (i > 0) {
        const left = run.charms[i - 1];
        const leftEclipsed = isEclipse && i - 1 === 0;
        if (left && !leftEclipsed && left.charmId !== 'understudy' && left.charmId !== 'amplifier-coil') {
          const leftDef = CHARM_BY_ID[left.charmId];
          applyCharmStep(left, i - 1, `Understudy → ${leftDef?.name ?? left.charmId}`, i, false);
        }
      }
      continue;
    }

    if (owned.charmId === 'amplifier-coil') {
      // Retrigger happens when evaluating slot i + 1; mark as triggered if right charm triggers
      continue;
    }

    // Standard Charm trigger
    applyCharmStep(owned, i, def.name, i, true);

    // Check if the Charm immediately to the LEFT is an active Amplifier Coil -> Retrigger!
    if (i > 0) {
      const left = run.charms[i - 1];
      const leftEclipsed = isEclipse && i - 1 === 0;
      if (left && !leftEclipsed && left.charmId === 'amplifier-coil') {
        const prevStepCount = steps.length;
        applyCharmStep(run.charms[i], i, `${def.name} (Amplified!)`, i, false);
        if (steps.length > prevStepCount) {
          triggeredCharmSet.add('amplifier-coil');
        }
      }
    }
  }

  // ── 4. Active Synergy Pairs ───────────────────────────────────────────────
  const activeSynergies = getActiveSynergies(run);
  const activeSynergyIds: string[] = [];
  const activeCardIdxs = [0, 1, 2].filter(i => !debuffedFlags[i]);
  const nonDebuffedEditions = activeCardIdxs.filter(i => hasCardEdition(cards[i])).length;
  const nonDebuffedWilds = activeCardIdxs.filter(i => isCardWild(cards[i])).length;
  const isRainbowLike = classification.isRainbow || handId === 'prismatic_crown';
  const isAdjacentLike = classification.isAdjacent || handId === 'adjacency_chain' || handId === 'prismatic_crown';
  const overlapsPrevSet = idxTriple.some(i => run.lastSetIndices.includes(i));
  const isFirstOrLast = run.handsPlayedThisBlind === 0 || run.handsLeft === 1;

  for (const syn of activeSynergies) {
    let synChips = 0;
    let synMult = 0;
    let synX = 1;
    let synGold = 0;
    let triggered = false;

    switch (syn.id) {
      case 'spectrum_resonance': {
        if (isRainbowLike) {
          synX = 1.5;
          triggered = true;
        }
        if (nonDebuffedWilds > 0) {
          synChips += nonDebuffedWilds * 40;
          triggered = true;
        }
        break;
      }
      case 'alchemical_temper': {
        if (nonDebuffedEditions > 0) {
          synChips = 50;
          synX = 1.5;
          triggered = true;
        }
        break;
      }
      case 'gilded_vault': {
        synGold = 2;
        synMult = Math.floor(Math.max(0, run.gold) / 5);
        triggered = true;
        break;
      }
      case 'standing_ovation': {
        if (isFirstOrLast) {
          synX = 1.75;
          triggered = true;
        }
        break;
      }
      case 'spatial_web': {
        if (isAdjacentLike || overlapsPrevSet) {
          synChips = 75;
          synMult = 15;
          triggered = true;
        }
        break;
      }
      case 'masterwork_deck': {
        if (nonDebuffedEditions > 0 || run.deck.length < 27) {
          synX = 1.6;
          triggered = true;
        }
        break;
      }
    }

    if (triggered) {
      activeSynergyIds.push(syn.id);
      if (synChips) chips += synChips;
      if (synMult) mult = roundMult(mult + synMult);
      if (synX !== 1) mult = roundMult(mult * synX);
      if (synGold) goldDelta += synGold;

      steps.push({
        kind: 'synergy',
        synergyId: syn.id,
        label: `Synergy: ${syn.name}`,
        chipsDelta: synChips,
        multDelta: synMult,
        xMult: synX !== 1 ? synX : undefined,
        goldDelta: synGold || undefined,
        chipsAfter: chips,
        multAfter: mult,
      });
    }
  }

  // ── 5. Boss Blind Post-Modifiers ──────────────────────────────────────────
  if (run.activeBossId === 'the_mirror_tax' && run.lastPlayedHandThisBlind === handId) {
    mult = Math.max(1, roundMult(mult * 0.5));
    steps.push({
      kind: 'boss',
      bossId: 'the_mirror_tax',
      label: 'No Repeats (Repeat Hand ×0.5M)',
      chipsDelta: 0,
      multDelta: 0,
      xMult: 0.5,
      chipsAfter: chips,
      multAfter: mult,
      debuffed: true,
    });
  }

  if (run.activeBossId === 'the_tithe') {
    if (run.gold + goldDelta >= 2) {
      goldDelta -= 2;
      steps.push({
        kind: 'boss',
        bossId: 'the_tithe',
        label: 'The Tithe (-$2 Gold)',
        chipsDelta: 0,
        multDelta: 0,
        goldDelta: -2,
        chipsAfter: chips,
        multAfter: mult,
        debuffed: true,
      });
    } else {
      const nextM = Math.max(1, roundMult(mult - 2));
      const deltaM = roundMult(nextM - mult);
      mult = nextM;
      steps.push({
        kind: 'boss',
        bossId: 'the_tithe',
        label: 'The Tithe (Unpaid: -2 Mult)',
        chipsDelta: 0,
        multDelta: deltaM,
        chipsAfter: chips,
        multAfter: mult,
        debuffed: true,
      });
    }
  }

  if (run.activeBossId === 'the_prism_test' && handId === 'simple_triad') {
    mult = roundMult(mult * 0.5);
    steps.push({
      kind: 'boss',
      bossId: 'the_prism_test',
      label: 'Prismatic Crucible (Simple Triad ×0.5M)',
      chipsDelta: 0,
      multDelta: 0,
      xMult: 0.5,
      chipsAfter: chips,
      multAfter: mult,
      debuffed: true,
    });
  }

  const finalScore = Math.max(0, Math.floor(chips * mult));

  // ── 6. Deterministic Glass Shatter Rolls (Commit Only) ────────────────────
  // Guard: never shatter below 3 cards in deck (prevents permanent soft-lock).
  const shatteredCardIds: string[] = [];
  if (isCommit) {
    let remainingDeckSize = run.deck.length;
    for (const cardId of shatterRiskCardIds) {
      const roll = nextFloat(rngState);
      rngState = roll.state;
      if (roll.value < EDITIONS.glass.shatterChance && remainingDeckSize > 3) {
        shatteredCardIds.push(cardId);
        remainingDeckSize -= 1;
      }
    }
  }

  return {
    isValid: true,
    patternHand: handId,
    patternHandName: handDef.name,
    patternHandLevel: level,
    classification,
    steps,
    finalChips: chips,
    finalMult: mult,
    finalScore,
    goldDelta,
    triggeredCharmIds: Array.from(triggeredCharmSet),
    activeSynergyIds,
    shatteredCardIds,
    shatterRiskCardIds,
    updatedCharms,
    nextRngState: rngState,
  };
};
