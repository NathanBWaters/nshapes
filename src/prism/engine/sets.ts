/**
 * Core SET geometry, Wild card resolution, mismatch diagnostics,
 * 2-card Blueprint helper, 7-hand Pattern classifier, and deadlock-safe board dealing.
 */
import type {
  BlueprintNeed,
  PatternClassification,
  PatternHandId,
  PrismCard,
  PrismTrait,
  SetEvaluation,
  TraitCheck,
} from '../types';
import {
  COLOR_LABELS,
  PATTERN_HAND_BY_ID,
  PRISM_COLORS,
  PRISM_NUMBERS,
  PRISM_SHAPES,
  SHAPE_LABELS,
  isCardWild,
} from '../data/cards';
import { shuffleArray } from './rng';

const thirdOf = <T>(domain: readonly T[], a: T, b: T): T => {
  if (a === b) return a;
  for (const v of domain) {
    if (v !== a && v !== b) return v;
  }
  return domain[0];
};

const formatTraitValue = (trait: PrismTrait, value: string | number): string => {
  if (trait === 'color') return COLOR_LABELS[value as keyof typeof COLOR_LABELS] ?? String(value);
  if (trait === 'shape') return SHAPE_LABELS[value as keyof typeof SHAPE_LABELS] ?? String(value);
  return String(value);
};

const TRAIT_LABEL: Record<PrismTrait, string> = {
  color: 'Color',
  shape: 'Shape',
  number: 'Number',
};

/** Check whether 3 board indices form an orthogonally connected chain (line or L-bend). */
export const areIndicesAdjacentChain = (
  indices: readonly number[],
  boardCols: number = 3
): boolean => {
  if (indices.length !== 3) return false;
  const cols = Math.max(1, boardCols);
  const [a, b, c] = indices;
  if (a === b || b === c || a === c) return false;
  const isAdj = (i: number, j: number): boolean => {
    const r1 = Math.floor(i / cols);
    const c1 = i % cols;
    const r2 = Math.floor(j / cols);
    const c2 = j % cols;
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  };
  let edges = 0;
  if (isAdj(a, b)) edges += 1;
  if (isAdj(b, c)) edges += 1;
  if (isAdj(a, c)) edges += 1;
  return edges >= 2;
};

interface ResolvedTrait<T extends string | number> {
  check: TraitCheck;
  status: 'all_same' | 'all_diff' | 'mismatch';
  resolved: [T, T, T];
}

const evaluateTrait = <T extends string | number>(
  trait: PrismTrait,
  domain: readonly T[],
  cards: readonly [PrismCard, PrismCard, PrismCard],
  getter: (c: PrismCard) => T
): ResolvedTrait<T> => {
  const wildMask = [isCardWild(cards[0]), isCardWild(cards[1]), isCardWild(cards[2])];
  const wildCount = wildMask.filter(Boolean).length;
  const label = TRAIT_LABEL[trait];

  if (wildCount === 0) {
    const v0 = getter(cards[0]);
    const v1 = getter(cards[1]);
    const v2 = getter(cards[2]);
    const values = [formatTraitValue(trait, v0), formatTraitValue(trait, v1), formatTraitValue(trait, v2)];
    if (v0 === v1 && v1 === v2) {
      return {
        status: 'all_same',
        resolved: [v0, v1, v2],
        check: {
          trait,
          status: 'all_same',
          values,
          message: `${label}: all ${values[0]}`,
        },
      };
    }
    if (v0 !== v1 && v1 !== v2 && v0 !== v2) {
      return {
        status: 'all_diff',
        resolved: [v0, v1, v2],
        check: {
          trait,
          status: 'all_diff',
          values,
          message: `${label}: all different`,
        },
      };
    }
    // 2 of one value + 1 of another -> clear human diagnostic
    const pairVal = v0 === v1 || v0 === v2 ? v0 : v1;
    const oddVal = v0 === pairVal ? (v1 === pairVal ? v2 : v1) : v0;
    return {
      status: 'mismatch',
      resolved: [v0, v1, v2],
      check: {
        trait,
        status: 'mismatch',
        values,
        message: `${label}: 2 ${formatTraitValue(trait, pairVal)}, 1 ${formatTraitValue(trait, oddVal)}`,
      },
    };
  }

  if (wildCount === 1) {
    const wildIdx = wildMask.indexOf(true);
    const nonWildIdxs = [0, 1, 2].filter(i => i !== wildIdx);
    const va = getter(cards[nonWildIdxs[0]]);
    const vb = getter(cards[nonWildIdxs[1]]);
    const filled = thirdOf(domain, va, vb);
    const resolved: [T, T, T] = [
      wildIdx === 0 ? filled : getter(cards[0]),
      wildIdx === 1 ? filled : getter(cards[1]),
      wildIdx === 2 ? filled : getter(cards[2]),
    ];
    const isSame = va === vb;
    const values = resolved.map(v => formatTraitValue(trait, v));
    return {
      status: isSame ? 'all_same' : 'all_diff',
      resolved,
      check: {
        trait,
        status: isSame ? 'all_same' : 'all_diff',
        values,
        message: isSame ? `${label}: all ${values[0]} (Wild)` : `${label}: all different (Wild)`,
      },
    };
  }

  if (wildCount === 2) {
    const concreteIdx = wildMask.indexOf(false);
    const concreteVal = getter(cards[concreteIdx]);
    const remaining = domain.filter(v => v !== concreteVal);
    let remCursor = 0;
    const resolved = [0, 1, 2].map(i =>
      i === concreteIdx ? concreteVal : remaining[remCursor++]
    ) as [T, T, T];
    const values = resolved.map(v => formatTraitValue(trait, v));
    return {
      status: 'all_diff',
      resolved,
      check: {
        trait,
        status: 'all_diff',
        values,
        message: `${label}: all different (Wild)`,
      },
    };
  }

  // 3 Wilds -> all different across domain
  const resolved: [T, T, T] = [domain[0], domain[1], domain[2]];
  const values = resolved.map(v => formatTraitValue(trait, v));
  return {
    status: 'all_diff',
    resolved,
    check: {
      trait,
      status: 'all_diff',
      values,
      message: `${label}: all different (Wild)`,
    },
  };
};

/** Fast boolean check for whether 3 cards form a valid Set (Wild-aware). */
export const isValidSetCards = (cards: readonly PrismCard[]): boolean => {
  if (cards.length !== 3) return false;
  const [a, b, c] = cards;
  const wildCount = (isCardWild(a) ? 1 : 0) + (isCardWild(b) ? 1 : 0) + (isCardWild(c) ? 1 : 0);
  if (wildCount >= 1) return true;
  const ok = <T>(x: T, y: T, z: T): boolean => (x === y && y === z) || (x !== y && y !== z && x !== z);
  return ok(a.color, b.color, c.color) && ok(a.shape, b.shape, c.shape) && ok(a.number, b.number, c.number);
};

/**
 * Full 3-card Set evaluation:
 * - Wild-aware validation
 * - Per-trait diagnostics (including mismatch explanation)
 * - Classification into one of the 7 ranked Pattern Hands
 */
export const evaluateSet = (
  cards: readonly PrismCard[],
  indices?: readonly number[],
  boardCols: number = 3
): SetEvaluation => {
  if (cards.length !== 3) {
    return {
      isValid: false,
      traitChecks: [],
      mismatchReason: 'Select 3 cards to play a Set.',
      classification: null,
    };
  }

  const triple: [PrismCard, PrismCard, PrismCard] = [cards[0], cards[1], cards[2]];
  const colorEval = evaluateTrait('color', PRISM_COLORS, triple, c => c.color);
  const shapeEval = evaluateTrait('shape', PRISM_SHAPES, triple, c => c.shape);
  const numberEval = evaluateTrait('number', PRISM_NUMBERS, triple, c => c.number);

  const traitChecks: TraitCheck[] = [colorEval.check, shapeEval.check, numberEval.check];
  const mismatches = traitChecks.filter(t => t.status === 'mismatch');

  if (mismatches.length > 0) {
    return {
      isValid: false,
      traitChecks,
      mismatchReason: mismatches.map(m => m.message).join(' • '),
      classification: null,
    };
  }

  const sameTraits: PrismTrait[] = [];
  const diffTraits: PrismTrait[] = [];
  for (const tc of traitChecks) {
    if (tc.status === 'all_same') sameTraits.push(tc.trait);
    else diffTraits.push(tc.trait);
  }

  const isAdjacent = indices ? areIndicesAdjacentChain(indices, boardCols) : false;
  const isRainbow = diffTraits.length === 3;
  const isPureRun = diffTraits.length === 1;
  const isCloneTriple = diffTraits.length === 0;

  let handId: PatternHandId;
  if (isCloneTriple || (isRainbow && isAdjacent)) {
    handId = 'prismatic_crown';
  } else if (isAdjacent) {
    handId = 'adjacency_chain';
  } else if (isRainbow) {
    handId = 'true_rainbow';
  } else if (diffTraits.length === 1) {
    const diffTrait = diffTraits[0];
    if (diffTrait === 'color') handId = 'color_run';
    else if (diffTrait === 'shape') handId = 'shape_run';
    else handId = 'number_run';
  } else {
    handId = 'simple_triad';
  }

  const classification: PatternClassification = {
    handId,
    isAdjacent,
    isRainbow,
    isPureRun,
    isCloneTriple,
    sameTraits,
    diffTraits,
    resolvedColors: colorEval.resolved,
    resolvedShapes: shapeEval.resolved,
    resolvedNumbers: numberEval.resolved,
  };

  return {
    isValid: true,
    traitChecks,
    mismatchReason: null,
    classification,
  };
};

/**
 * 2-card Blueprint helper: computes the exact 3rd card traits needed to complete a Set
 * from 2 selected cards, plus which remaining board indices satisfy it.
 */
export const computeBlueprintNeed = (
  board: readonly PrismCard[],
  selectedIndices: readonly number[]
): BlueprintNeed | null => {
  if (selectedIndices.length !== 2) return null;
  const [i0, i1] = selectedIndices;
  const a = board[i0];
  const b = board[i1];
  if (!a || !b || i0 === i1) return null;

  if (isCardWild(a) || isCardWild(b)) {
    const matchingBoardIndices: number[] = [];
    for (let i = 0; i < board.length; i++) {
      if (i !== i0 && i !== i1) matchingBoardIndices.push(i);
    }
    return {
      color: 'any',
      shape: 'any',
      number: 'any',
      matchingBoardIndices,
      summary: 'Wild selected — any 3rd card completes a Set!',
    };
  }

  const color = thirdOf(PRISM_COLORS, a.color, b.color);
  const shape = thirdOf(PRISM_SHAPES, a.shape, b.shape);
  const number = thirdOf(PRISM_NUMBERS, a.number, b.number);

  const matchingBoardIndices: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (i === i0 || i === i1) continue;
    const card = board[i];
    if (isCardWild(card) || (card.color === color && card.shape === shape && card.number === number)) {
      matchingBoardIndices.push(i);
    }
  }

  const plural = number === 1 ? '' : 's';
  return {
    color,
    shape,
    number,
    matchingBoardIndices,
    summary: `Needs: ${number} ${COLOR_LABELS[color]} ${SHAPE_LABELS[shape]}${plural}`,
  };
};

export interface BoardSetMatch {
  indices: [number, number, number];
  handId: PatternHandId;
  rank: number;
}

/** Enumerate all valid 3-card Sets currently present on the board. */
export const findAllSetsOnBoard = (
  board: readonly PrismCard[],
  boardCols: number = 3
): BoardSetMatch[] => {
  const results: BoardSetMatch[] = [];
  const n = board.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const cards = [board[i], board[j], board[k]];
        if (!isValidSetCards(cards)) continue;
        const evalRes = evaluateSet(cards, [i, j, k], boardCols);
        if (evalRes.isValid && evalRes.classification) {
          const handId = evalRes.classification.handId;
          results.push({
            indices: [i, j, k],
            handId,
            rank: PATTERN_HAND_BY_ID[handId].rank,
          });
        }
      }
    }
  }
  return results;
};

/** Quick check for whether at least one valid Set exists on the board. */
export const hasAnySetOnBoard = (board: readonly PrismCard[]): boolean => {
  const n = board.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        if (isValidSetCards([board[i], board[j], board[k]])) return true;
      }
    }
  }
  return false;
};

export interface DeadlockSafeResult {
  board: PrismCard[];
  drawPile: PrismCard[];
  discardPile: PrismCard[];
  rngState: number;
  adjusted: boolean;
  toast: string | null;
}

/**
 * Guarantee that `board` contains at least one valid Set (deadlock-safe dealing).
 * 1. If a Set already exists, returns untouched.
 * 2. Otherwise reshuffles discard into draw if needed and searches for a 1-card swap
 *    from drawPile that creates a valid Set.
 * 3. If no 1-card swap suffices, pools all cards and searches for a valid 3-card Set
 *    to include on the board.
 * 4. If even a heavily pruned deck has zero valid Sets anywhere, grants a temporary
 *    Wild override on one board card so the player is never soft-locked!
 */
export const ensurePlayableBoard = (
  board: readonly PrismCard[],
  drawPile: readonly PrismCard[],
  discardPile: readonly PrismCard[],
  rngState: number
): DeadlockSafeResult => {
  const nextBoard = [...board];
  let nextDraw = [...drawPile];
  let nextDiscard = [...discardPile];
  let state = rngState;

  if (nextBoard.length < 3 || hasAnySetOnBoard(nextBoard)) {
    return {
      board: nextBoard,
      drawPile: nextDraw,
      discardPile: nextDiscard,
      rngState: state,
      adjusted: false,
      toast: null,
    };
  }

  // Combine discard into draw if draw is empty
  if (nextDraw.length === 0 && nextDiscard.length > 0) {
    const shuf = shuffleArray(nextDiscard, state);
    nextDraw = shuf.items;
    state = shuf.state;
    nextDiscard = [];
  }

  // Try swapping the last board slot with any card in drawPile that forms a Set with 2 existing board cards
  const swapSlot = nextBoard.length - 1;
  for (let d = 0; d < nextDraw.length; d++) {
    const candidate = nextDraw[d];
    let createsSet = false;
    for (let i = 0; i < nextBoard.length - 1 && !createsSet; i++) {
      for (let j = i + 1; j < nextBoard.length - 1; j++) {
        if (isValidSetCards([nextBoard[i], nextBoard[j], candidate])) {
          createsSet = true;
          break;
        }
      }
    }
    if (createsSet) {
      const displaced = nextBoard[swapSlot];
      nextBoard[swapSlot] = candidate;
      nextDraw.splice(d, 1, displaced);
      const shuf = shuffleArray(nextDraw, state);
      nextDraw = shuf.items;
      state = shuf.state;
      return {
        board: nextBoard,
        drawPile: nextDraw,
        discardPile: nextDiscard,
        rngState: state,
        adjusted: true,
        toast: 'No Set on board — Auto-reshuffled a fresh card!',
      };
    }
  }

  // Full deck search: pool board + draw + discard and deal a guaranteed Set onto the board
  const pool = [...nextBoard, ...nextDraw, ...nextDiscard];
  const targetSize = nextBoard.length;
  let foundTriple: [number, number, number] | null = null;
  for (let i = 0; i < pool.length - 2 && !foundTriple; i++) {
    for (let j = i + 1; j < pool.length - 1 && !foundTriple; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        if (isValidSetCards([pool[i], pool[j], pool[k]])) {
          foundTriple = [i, j, k];
          break;
        }
      }
    }
  }

  if (foundTriple) {
    const pickedSet = new Set<number>(foundTriple);
    const guaranteed = foundTriple.map(idx => pool[idx]);
    const restRaw = pool.filter((_, idx) => !pickedSet.has(idx));
    const shufRest = shuffleArray(restRaw, state);
    state = shufRest.state;
    const fillerCount = Math.max(0, targetSize - guaranteed.length);
    const assembledRaw = [...guaranteed, ...shufRest.items.slice(0, fillerCount)];
    const shufBoard = shuffleArray(assembledRaw, state);
    state = shufBoard.state;
    return {
      board: shufBoard.items,
      drawPile: shufRest.items.slice(fillerCount),
      discardPile: [],
      rngState: state,
      adjusted: true,
      toast: 'No Set on board — Deck auto-reshuffled!',
    };
  }

  // Extreme pruning fallback: no 3 cards in the entire deck form a Set -> grant temporary Wild!
  const emergencyBoard = nextBoard.map((c, idx) =>
    idx === 0 ? { ...c, tempWild: true } : c
  );
  return {
    board: emergencyBoard,
    drawPile: nextDraw,
    discardPile: nextDiscard,
    rngState: state,
    adjusted: true,
    toast: 'No Set possible in deck — Prism Surge stamped a Wild card!',
  };
};
