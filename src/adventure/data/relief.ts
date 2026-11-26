/**
 * [GP-18] Difficulty Relief ("Friendly Tailwind"), World 3–5 Loss-Streak Stuck Nudge,
 * Pre-1-8 Hidden Purse, Retreat Coin Retention & "Starfall Cauldron" Upward Wager.
 *
 * Pure data & helper functions consumed by progress.ts, save.ts, LevelPreview.tsx,
 * fightEvent.ts, and engine/run.ts. All save & parry extension fields are declared
 * optional via module augmentation so parallel Wave 2 lanes compile and merge cleanly.
 */
import type { AdventureSave, LevelDef } from '../types';
import { worldNumber } from './biomes';

/** Upward difficulty wager tier on LevelPreview (World 2+). */
export type CauldronWagerTier = 0 | 1 | 2;

/**
 * Runtime relief/wager modifier bundle passed into `createRun` / `AdventureRun`.
 * Mirrors Lane 2A's `RunReliefOptions` shape in `src/adventure/types.ts`.
 */
export interface RunReliefOptions {
  tailwindActive?: boolean;
  cauldronWager?: CauldronWagerTier;
  extraHearts?: number;
  timerScale?: number;
  parryWindupScale?: number;
  foeHpScale?: number;
  coinMultiplier?: number;
  starCap?: number;
}

declare module '../types' {
  interface AdventureSave {
    /** Consecutive 0★ defeats per levelId (reset to 0 on any ≥★ clear). */
    consecutiveLosses?: Record<string, number>;
    /** Coins quietly banked from pre-1-8 defeats; bursts open into `coins` when 1-8 unlocks coins. */
    hiddenPurse?: number;
    /** Active Starfall Cauldron upward coin wager (0 = Standard, 1 = Bold, 2 = Starfall). */
    cauldronWager?: CauldronWagerTier;
    /** Whether Friendly Tailwind relief is toggled ON for the next attempt. */
    tailwindActive?: boolean;
  }

  interface FoeDef {
    /** Optional Hydra boss head phase (1, 2, or 3) used by 5-5 while preserving canonical enemy: 'The Hydra' */
    hydraPhase?: 1 | 2 | 3;
  }

  interface ParrySpec {
    /** Optional per-archetype Stagger duration override (ms) for Counter/Heavy parries. */
    staggerMs?: number;
    /** Optional penalty magnitude override (hearts for `'heart'`, seconds for `'time'`). */
    penaltyAmount?: number;
    /** Optional Boss escalation cooldown tightening (ms) below 50% foe HP. */
    bossEnrageDeltaMs?: number;
  }

  interface RunState {
    /** True when Friendly Tailwind relief was active for this fight. */
    tailwindActive?: boolean;
    /** Active Starfall Cauldron upward wager tier for this fight (0 | 1 | 2). */
    cauldronWager?: CauldronWagerTier;
    /** Resolved relief/wager runtime modifiers. */
    relief?: RunReliefOptions;
  }
}

// ─── Friendly Tailwind (Loss-Streak Relief) ──────────────────────────────────

/**
 * Maximum stars earnable with Friendly Tailwind ON (`1` protects ★★/★★★ prestige
 * while guaranteeing road progress; tunable 1-line constant to `3` if desired).
 */
export const TAILWIND_STAR_CAP: 1 | 3 = 1;

/** Consecutive defeats on a level before Friendly Tailwind becomes available. */
export const TAILWIND_LOSS_THRESHOLD = 2;

/** Consecutive defeats on a World 3–5 level before the gentle 25s stuck-nudge activates. */
export const STUCK_NUDGE_LOSS_THRESHOLD = 3;

/** Seconds without a Set before World 3–5 3-loss stuck-nudge highlights a single card. */
export const LOSS_STREAK_ASSIST_STEPS: readonly number[] = [25];

/** Friendly Tailwind combat modifiers applied when toggled ON. */
export const FRIENDLY_TAILWIND = {
  extraHearts: 2,
  /** +20% clock / move budget */
  timerScale: 1.2,
  moveScale: 1.2,
  /** +25% slower Parry wind-ups */
  parryWindupScale: 1.25,
  starCap: TAILWIND_STAR_CAP,
} as const;

/** Minimum Sets matched in a fight to retain partial coins on Retreat. */
export const RETREAT_COIN_MIN_SETS = 5;

/** Share of earned fight coins retained when retreating after ≥ RETREAT_COIN_MIN_SETS. */
export const RETREAT_COIN_RETENTION = 0.5;

// ─── Pre-1-8 Hidden Purse (Progress Feel Before Coin Drops Unlock) ───────────

/** Coins quietly banked per pre-1-8 defeat (scales gently from 5¢ to 10¢ with progress). */
export const HIDDEN_PURSE_MIN_COINS = 5;
export const HIDDEN_PURSE_MAX_COINS = 10;

/** Compute how many coins a pre-1-8 defeat quietly tucks into the hidden purse (5–10¢). */
export const computeHiddenPurseDeposit = (matchesMade: number, foeHpPctRemaining: number): number => {
  const progressRatio = Math.max(0, Math.min(1, 1 - foeHpPctRemaining));
  const effort = Math.min(1, Math.max(0, matchesMade / 8));
  const blended = Math.max(progressRatio, effort * 0.6);
  return Math.round(
    HIDDEN_PURSE_MIN_COINS + blended * (HIDDEN_PURSE_MAX_COINS - HIDDEN_PURSE_MIN_COINS)
  );
};

// ─── Starfall Cauldron (World 2+ Optional Upward Coin Wager) ──────────────────

export interface CauldronWagerDef {
  tier: CauldronWagerTier;
  id: 'standard' | 'bold' | 'starfall';
  label: string;
  shortLabel: string;
  stakeCoins: number;
  foeHpScale: number;
  /** Multiplier on Parry wind-up duration (0.9 = 10% faster, 0.8 = 20% faster) */
  parryWindupScale: number;
  /** Multiplier on earned fight coin payout */
  coinMultiplier: number;
  summary: string;
}

export const CAULDRON_WAGERS: readonly CauldronWagerDef[] = [
  {
    tier: 0,
    id: 'standard',
    label: 'Standard',
    shortLabel: '0 · Standard',
    stakeCoins: 0,
    foeHpScale: 1,
    parryWindupScale: 1,
    coinMultiplier: 1,
    summary: 'Default rules, 1.0× coins.',
  },
  {
    tier: 1,
    id: 'bold',
    label: 'Bold Wager',
    shortLabel: '+1 · Bold (50¢)',
    stakeCoins: 50,
    foeHpScale: 1.25,
    parryWindupScale: 0.9,
    coinMultiplier: 1.5,
    summary: '+25% foe HP, 10% faster Parries → 1.5× coins + 2× stake on KO.',
  },
  {
    tier: 2,
    id: 'starfall',
    label: 'Starfall Wager',
    shortLabel: '+2 · Starfall (150¢)',
    stakeCoins: 150,
    foeHpScale: 1.5,
    parryWindupScale: 0.8,
    coinMultiplier: 2,
    summary: '+50% foe HP, 20% faster Parries → 2.0× coins + 2× stake on KO.',
  },
] as const;

export const getCauldronWager = (tier: CauldronWagerTier | number | undefined): CauldronWagerDef =>
  CAULDRON_WAGERS[tier === 1 || tier === 2 ? tier : 0];

/** True when Starfall Cauldron wagers are available on this level (World 2+, non-practice, coins unlocked). */
export const isCauldronAvailable = (level: LevelDef, save: Pick<AdventureSave, 'coinsUnlocked'>): boolean =>
  !level.rules.sandbox && !level.rules.noGear && save.coinsUnlocked && worldNumber(level.biome) >= 2;

/** True when the player can afford the chosen wager tier's upfront stake. */
export const canAffordCauldronWager = (save: Pick<AdventureSave, 'coins'>, tier: CauldronWagerTier): boolean =>
  save.coins >= getCauldronWager(tier).stakeCoins;

/** Number of consecutive defeats recorded on a level. */
export const consecutiveLossesFor = (
  save: Pick<AdventureSave, 'consecutiveLosses'>,
  levelId: string
): number => Math.max(0, save.consecutiveLosses?.[levelId] ?? 0);

/** True once the player has lost this level at least `TAILWIND_LOSS_THRESHOLD` times in a row. */
export const isTailwindOffered = (
  level: LevelDef,
  save: Pick<AdventureSave, 'consecutiveLosses'>
): boolean =>
  !level.rules.sandbox &&
  !level.rules.noGear &&
  level.starRule?.kind !== 'accuracy' &&
  consecutiveLossesFor(save, level.id) >= TAILWIND_LOSS_THRESHOLD;

/**
 * True when World 3–5 3-loss stuck-nudge (`LOSS_STREAK_ASSIST_STEPS = [25]`) should help
 * highlight a single card after 25 quiet seconds without spoiling the whole Set.
 */
export const shouldEnableLossStreakNudge = (
  level: LevelDef,
  save: Pick<AdventureSave, 'consecutiveLosses'>
): boolean =>
  !level.rules.sandbox &&
  worldNumber(level.biome) >= 3 &&
  consecutiveLossesFor(save, level.id) >= STUCK_NUDGE_LOSS_THRESHOLD;

/**
 * Resolve the effective `RunReliefOptions` bundle for a level attempt.
 * Friendly Tailwind and Starfall Cauldron wagers are mutually exclusive (Tailwind takes
 * precedence when enabled, zeroing any wager stake).
 */
export const resolveRunReliefOptions = (
  level: LevelDef,
  save: Pick<AdventureSave, 'coins' | 'coinsUnlocked' | 'consecutiveLosses' | 'cauldronWager' | 'tailwindActive'>,
  overrides?: { tailwindActive?: boolean; cauldronWager?: CauldronWagerTier }
): RunReliefOptions => {
  const tailwindRequested = overrides?.tailwindActive ?? Boolean(save.tailwindActive);
  const tailwindActive = tailwindRequested && isTailwindOffered(level, save);
  if (tailwindActive) {
    return {
      tailwindActive: true,
      cauldronWager: 0,
      extraHearts: FRIENDLY_TAILWIND.extraHearts,
      timerScale: FRIENDLY_TAILWIND.timerScale,
      parryWindupScale: FRIENDLY_TAILWIND.parryWindupScale,
      foeHpScale: 1,
      coinMultiplier: 1,
      starCap: FRIENDLY_TAILWIND.starCap,
    };
  }

  const requestedTier = overrides?.cauldronWager ?? save.cauldronWager ?? 0;
  const wagerTier: CauldronWagerTier =
    requestedTier > 0 && isCauldronAvailable(level, save) && canAffordCauldronWager(save, requestedTier)
      ? requestedTier
      : 0;
  const wager = getCauldronWager(wagerTier);
  return {
    tailwindActive: false,
    cauldronWager: wager.tier,
    extraHearts: 0,
    timerScale: 1,
    parryWindupScale: wager.parryWindupScale,
    foeHpScale: wager.foeHpScale,
    coinMultiplier: wager.coinMultiplier,
  };
};

/**
 * Compute Cauldron wager coin settlement after a fight ends:
 * - KO (`stars >= 2`): wins `stakeCoins` profit (player keeps stake + gains +stake; net delta `+stakeCoins` if stake wasn't deducted upfront, or `+2 * stakeCoins` if deducted upfront).
 *   We use net settlement in `applyLevelResult`:
 *   - On KO (`stars >= 2`): net `+stakeCoins` bonus (equivalent to staking upfront and winning `2×` back) + coin multiplier on fight coins!
 *   - On survival (`stars === 1`): stake returned (`0` net stake loss, standard coins).
 *   - On defeat (`stars === 0`): loses staked coins (`-Math.min(save.coins, stakeCoins)`).
 */
export const settleCauldronWager = (
  tier: CauldronWagerTier,
  stars: number,
  runCoins: number,
  availableCoins: number
): {
  /** Adjusted run coins after wager multiplier (only multiplied on KO) */
  adjustedRunCoins: number;
  /** Net stake gain/loss (+stake on KO, 0 on 1★ survival, -stake on 0★ defeat) */
  stakeDelta: number;
} => {
  const wager = getCauldronWager(tier);
  if (wager.tier === 0) {
    return { adjustedRunCoins: runCoins, stakeDelta: 0 };
  }
  if (stars >= 2) {
    return {
      adjustedRunCoins: Math.round(runCoins * wager.coinMultiplier),
      stakeDelta: wager.stakeCoins,
    };
  }
  if (stars === 1) {
    return { adjustedRunCoins: runCoins, stakeDelta: 0 };
  }
  return {
    adjustedRunCoins: runCoins,
    stakeDelta: -Math.min(Math.max(0, availableCoins), wager.stakeCoins),
  };
};

/** Compute coins retained when retreating partway through a fight (50% once ≥5 Sets matched). */
export const computeRetreatCoins = (matchesMade: number, earnedRunCoins: number, coinsUnlocked: boolean): number => {
  if (!coinsUnlocked || matchesMade < RETREAT_COIN_MIN_SETS || earnedRunCoins <= 0) return 0;
  return Math.floor(earnedRunCoins * RETREAT_COIN_RETENTION);
};

/** Apply Friendly Tailwind star cap cleanly without lowering an already-earned higher star rating. */
export const applyTailwindStarCap = (rawStars: number, tailwindActive: boolean): number =>
  tailwindActive ? Math.min(rawStars, TAILWIND_STAR_CAP) : rawStars;
