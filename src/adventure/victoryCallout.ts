import type { RunState } from './types';

export interface VictoryCalloutInput {
  /** Earned stars (1–3) in Adventure Mode, or `null` in starless modes (Starfall Summit) */
  stars: number | null;
  /** How the fight ended */
  endReason: RunState['endReason'];
  /** Total health lost during this fight (`run.roundStats.damageReceived`) */
  damageReceived: number;
  /** Invalid selections made during this fight (`run.mistakes`) */
  mistakes: number;
  /** Whether this fight tracks player hearts (`hearts !== null && maxHearts > 0`) */
  hasHearts: boolean;
  /** Hearts remaining at fight end (`run.hearts`) */
  heartsLeft: number | null;
  /** Boss encounter (`level.isBoss`) */
  isBoss?: boolean;
  /** Elite encounter (Starfall Summit elites) */
  isElite?: boolean;
  /** Final blow landed via a Perfect Parry */
  isPerfectParryKo?: boolean;
  /** Final Set damage (for knockout eyebrows) */
  finalBlowDmg?: number;
  /** Practice / sandbox run */
  practice?: boolean;
  /** Beat prior best DPM on this level (for LevelResults rank seal) */
  newBest?: boolean;
}

export interface VictoryCallout {
  /** Primary victory headline (shared between KillCamOverlay and LevelResults) */
  headline: string;
  /** Secondary context eyebrow shown above the KillCam headline */
  eyebrow: string;
  /** Wax-stamped rank seal on LevelResults (null for practice or defeat) */
  rankSeal: { label: string; accent: 'gold' | 'teal' | 'coral' } | null;
}

/**
 * Resolve honest, star-aware victory copy shared by the end-of-fight KillCam
 * banner and the LevelResults crest so they never contradict each other.
 *
 * Adventure Mode (1–3★):
 * - 1★ → "NICE JOB!" (never "FLAWLESS", never "FOE VANQUISHED" on survival)
 * - 2★ → "GREAT WORK!"
 * - 3★ without losing health → "FLAWLESS VICTORY!"
 * - 3★ after losing health, down to 1♥ → "CLUTCH VICTORY!"
 * - 3★ after losing health (>1♥ left) → "HEROIC VICTORY!"
 *
 * Starless modes (Starfall Summit, `stars === null`):
 * - Distinguishes untouched/flawless clears, 1♥ clutches, bosses, elites, and Perfect Parry K.O.s.
 */
export const resolveVictoryCallout = ({
  stars,
  endReason,
  damageReceived,
  mistakes,
  hasHearts,
  heartsLeft,
  isBoss = false,
  isElite = false,
  isPerfectParryKo = false,
  finalBlowDmg = 0,
  practice = false,
  newBest = false,
}: VictoryCalloutInput): VictoryCallout => {
  if (practice) {
    return {
      headline: 'PRACTICE OVER',
      eyebrow: 'PRACTICE COMPLETE',
      rankSeal: null,
    };
  }

  const knockedOut = endReason === 'defeated';
  const noHealthLost = damageReceived <= 0;
  const downToOneHeart = !noHealthLost && hasHearts && heartsLeft === 1;
  const dmg = Math.round(finalBlowDmg);
  const blowEyebrow = dmg > 0 ? `FINAL BLOW · ${dmg} DMG` : 'FOE VANQUISHED';

  // Defeat
  if (stars === 0 || endReason === 'hearts') {
    return {
      headline: 'DEFEATED',
      eyebrow: 'FIGHT OVER',
      rankSeal: null,
    };
  }

  // ── Adventure Mode (1–3 Stars) ────────────────────────────────────────────
  if (stars !== null) {
    if (stars <= 1) {
      return {
        headline: 'NICE JOB!',
        eyebrow: knockedOut ? '★☆☆ · STAGE CLEAR' : '★☆☆ · STAGE SURVIVED',
        rankSeal: newBest
          ? { label: 'NEW RECORD', accent: 'coral' }
          : knockedOut
            ? { label: 'STAGE CLEAR', accent: 'gold' }
            : { label: 'SURVIVED', accent: 'gold' },
      };
    }

    if (stars === 2) {
      const eyebrow = isPerfectParryKo && knockedOut
        ? '★★☆ · PERFECT PARRY K.O.'
        : isBoss && knockedOut
          ? '★★☆ · BOSS VANQUISHED'
          : knockedOut
            ? `★★☆ · ${blowEyebrow}`
            : '★★☆ · STAGE CLEAR';
      const rankSeal: VictoryCallout['rankSeal'] = isBoss && knockedOut
        ? { label: 'BOSS SLAYER', accent: 'gold' }
        : newBest
          ? { label: 'NEW RECORD', accent: 'coral' }
          : noHealthLost && hasHearts
            ? { label: 'UNSCATHED', accent: 'teal' }
            : { label: 'GREAT WORK', accent: 'teal' };
      return { headline: 'GREAT WORK!', eyebrow, rankSeal };
    }

    // 3 Stars — distinguish untouched (Flawless) vs. lost health (Clutch / Heroic)
    if (noHealthLost) {
      const eyebrow = isPerfectParryKo && knockedOut
        ? '★★★ · UNTOUCHED PARRY K.O.'
        : isBoss && knockedOut
          ? '★★★ · UNTOUCHED BOSS SLAYER'
          : hasHearts && mistakes === 0
            ? '★★★ · UNTOUCHED · ZERO MISSES'
            : hasHearts
              ? '★★★ · NOT A SCRATCH'
              : mistakes === 0
                ? '★★★ · ZERO MISTAKES'
                : '★★★ · ALL 3 STARS';
      const rankSeal: VictoryCallout['rankSeal'] = isBoss && knockedOut
        ? { label: 'BOSS SLAYER', accent: 'gold' }
        : newBest
          ? { label: 'NEW RECORD', accent: 'coral' }
          : hasHearts
            ? { label: 'UNTOUCHED', accent: 'teal' }
            : mistakes === 0
              ? { label: 'ZERO MISSES', accent: 'teal' }
              : { label: '3★ MASTER', accent: 'gold' };
      return { headline: 'FLAWLESS VICTORY!', eyebrow, rankSeal };
    }

    if (downToOneHeart) {
      const eyebrow = isBoss && knockedOut
        ? '★★★ · BOSS DOWN · 1 HEART LEFT'
        : isPerfectParryKo && knockedOut
          ? '★★★ · LAST-HEART PARRY K.O.'
          : '★★★ · LAST HEART STANDING';
      const rankSeal: VictoryCallout['rankSeal'] = isBoss && knockedOut
        ? { label: 'BOSS SLAYER', accent: 'gold' }
        : newBest
          ? { label: 'NEW RECORD', accent: 'coral' }
          : { label: 'CLUTCH 3★', accent: 'coral' };
      return { headline: 'CLUTCH VICTORY!', eyebrow, rankSeal };
    }

    const eyebrow = isPerfectParryKo && knockedOut
      ? '★★★ · BATTLE-SCARRED PARRY K.O.'
      : isBoss && knockedOut
        ? '★★★ · BATTLE-SCARRED BOSS SLAYER'
        : '★★★ · BATTLE-SCARRED';
    const rankSeal: VictoryCallout['rankSeal'] = isBoss && knockedOut
      ? { label: 'BOSS SLAYER', accent: 'gold' }
      : newBest
        ? { label: 'NEW RECORD', accent: 'coral' }
        : { label: 'BATTLE-TESTED', accent: 'gold' };
    return { headline: 'HEROIC VICTORY!', eyebrow, rankSeal };
  }

  // ── Starfall Summit (Starless Knockout Mode) ──────────────────────────────
  if (isPerfectParryKo && knockedOut) {
    return {
      headline: 'PERFECT PARRY K.O.!',
      eyebrow: noHealthLost ? 'UNTOUCHED COUNTER' : dmg > 0 ? `FINAL BLOW · ${dmg} DMG` : 'COUNTER FINISH',
      rankSeal: null,
    };
  }

  if (isBoss) {
    return {
      headline: noHealthLost ? 'FLAWLESS BOSS K.O.!' : 'BOSS VANQUISHED!',
      eyebrow: noHealthLost ? 'NOT A SCRATCH' : dmg > 0 ? `FINAL BLOW · ${dmg} DMG` : 'ACT BOSS DEFEATED',
      rankSeal: null,
    };
  }

  if (isElite) {
    return {
      headline: noHealthLost ? 'FLAWLESS ELITE K.O.!' : 'ELITE VANQUISHED!',
      eyebrow: noHealthLost ? 'NOT A SCRATCH' : dmg > 0 ? `FINAL BLOW · ${dmg} DMG` : 'ELITE DEFEATED',
      rankSeal: null,
    };
  }

  if (noHealthLost && mistakes === 0) {
    return {
      headline: 'FLAWLESS VICTORY!',
      eyebrow: 'UNTOUCHED · FLOOR CLEARED',
      rankSeal: null,
    };
  }

  if (noHealthLost) {
    return {
      headline: 'CLEAN VICTORY!',
      eyebrow: dmg > 0 ? `NOT A SCRATCH · ${dmg} DMG` : 'NOT A SCRATCH',
      rankSeal: null,
    };
  }

  if (downToOneHeart) {
    return {
      headline: 'CLUTCH VICTORY!',
      eyebrow: 'LAST HEART STANDING',
      rankSeal: null,
    };
  }

  return {
    headline: 'GREAT WORK!',
    eyebrow: dmg > 0 ? `FINAL BLOW · ${dmg} DMG` : 'FLOOR CLEARED',
    rankSeal: null,
  };
};
