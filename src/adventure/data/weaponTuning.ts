/**
 * Adventure's numbers for the 32 weapons it shares with Free Play
 * (utils/gameDefinitions.ts SHARED_WEAPONS), and each weapon's sharp role job.
 *
 * Design principles ([GP-11] & [GP-19]):
 *  1. Role purity: pure utility, survival, board, hint, and economy weapons
 *     amplify their real utility instead of bolting on homogenizing raw DPS riders.
 *  2. Crisp differentiation: every overlapping cluster (4 Hints, 4 Graces,
 *     4 Economy, 5 Links, 3 Echoes, 3 Time) has a non-overlapping one-sentence job.
 *  3. Clean integer whole stats: every `WHOLE_STATS` field uses explicit Lv 1–5
 *     integer breakpoints (`byLevel`), with zero fight-start fractional coin flips.
 *  4. Every chance stays at or below `EFFECT_CAPS` at Lv 5 + T4 + max growth.
 */
import type { Rule, RuleSource, Trigger } from '../rules/types';
import type { WeaponStatDef } from './weaponStats';
import { WEAPON_CADENCE, type LevelBreakpoints } from './weapons/schema';

type V = Record<string, number>;

export interface AdventureTuning {
  /** Level-1 numbers. `bridgeChance` is the trigger chance of a reacting weapon. */
  effects?: Record<string, number>;
  /** Gain per level, by the same keys */
  perLevel?: Record<string, number>;
  /** Explicit Lv 1–5 breakpoints (used for clean integer `WHOLE_STATS` progression) */
  byLevel?: Record<string, LevelBreakpoints>;
  /** Stat keys on `effects`/`bridgeChance` that the Workshop does not tune (levels only) */
  untunable?: readonly string[];
  /** Numbers that only the rider reads */
  extra?: Record<string, WeaponStatDef>;
  /** What else the weapon does in Adventure, from its current numbers */
  rider?: (v: V) => RuleSource;
}

const strike = (trigger: Trigger, amount: number, callout?: string): Rule => ({
  trigger,
  effects: [{ do: 'damage', amount }],
  ...(callout ? { callout } : {}),
});
const dmg = (label: string, base: number, perLevel: number): WeaponStatDef => ({ label, unit: 'dmg', base, perLevel });

/** Re-exported from `weapons/schema.ts` WEAPON_CADENCE so callers keep stable imports. */
export const ORACLE_WAIT_S = WEAPON_CADENCE.ORACLE_WAIT_S;
export const SEEKER_DAMAGE_PER_HINT = WEAPON_CADENCE.SEEKER_DAMAGE_PER_HINT;
export const MYSTIC_EVERY = WEAPON_CADENCE.MYSTIC_EVERY;
export const LIFE_LINK_PULSE_EVERY = WEAPON_CADENCE.LIFE_LINK_PULSE_EVERY;
export const WISDOM_XP_EVERY = WEAPON_CADENCE.WISDOM_XP_EVERY;
export const WISDOM_COIN_PCT = WEAPON_CADENCE.WISDOM_COIN_PCT;

export const ADVENTURE_TUNING: Record<string, AdventureTuning> = {
  // ── Damage ────────────────────────────────────────────────────────────────
  'blast-powder': { effects: { explosionChance: 18, explosionDamage: 0.5 }, perLevel: { explosionChance: 4, explosionDamage: 0.25 } },
  'flint-spark': { effects: { fireSpreadChance: 14, burnDamage: 0.5 }, perLevel: { fireSpreadChance: 2.5, burnDamage: 0.15 } },
  'prismatic-ray': { effects: { laserChance: 10, laserDamage: 0.5 }, perLevel: { laserChance: 2.5, laserDamage: 0.75 } },
  'chaos-shard': {
    effects: { ricochetChance: 18, ricochetChainChance: 22, ricochetDamage: 0.5 },
    perLevel: { ricochetChance: 4.5, ricochetChainChance: 5.5, ricochetDamage: 0.5 },
  },
  // Reliable single echo
  'echo-stone': {
    effects: { echoChance: 14 },
    perLevel: { echoChance: 2 },
    extra: { strike: dmg('Echo damage', 3, 1.75) },
    rider: v => ({ rules: [strike({ on: 'weapon', kind: 'echo' }, v.strike)] }),
  },
  // Active Weaver: high link rate, links persist across waves at Lv 3+
  connector: {
    effects: { connectionChance: 26 },
    perLevel: { connectionChance: 6 },
    extra: {
      persist: { label: 'Keep links between waves (Lv 3+)', unit: 'count', base: 0, perLevel: 0.25, byLevel: [0, 0, 1, 1, 1], tunable: false },
    },
    rider: v => (v.persist > 0 ? { modifiers: { keepLinks: 1 } } : {}),
  },
  // Opening Web: starts every wave with 2..6 pre-wired links (clean integers)
  'web-weaver': {
    effects: { startingConnections: 2 },
    perLevel: { startingConnections: 1 },
    byLevel: { startingConnections: [2, 3, 4, 5, 6] },
  },

  // ── Board ─────────────────────────────────────────────────────────────────
  'growth-seed': {
    effects: { boardGrowthChance: 14 },
    perLevel: { boardGrowthChance: 3.5 },
    rider: () => ({ rules: [{ trigger: { on: 'weapon', kind: 'growth' }, effects: [{ do: 'empowerBoard', amount: 1 }], callout: 'Bloom!' }] }),
  },
  // Pure board expansion: clean integer +2..+6 cards + overflow Catalyst & Power-card boost (no flat opening charge)
  'field-stone': {
    effects: { fieldSize: 2 },
    perLevel: { fieldSize: 1 },
    byLevel: { fieldSize: [2, 3, 4, 5, 6] },
    extra: {
      catalystBoost: { label: 'Overflow Catalyst chance', unit: '%', base: 4, perLevel: 2 },
    },
    rider: v => ({
      modifiers: { evolutionLikelihood: v.catalystBoost },
      rules: [
        {
          trigger: { on: 'waveStart' },
          when: [{ kind: 'boardAtLeast', n: WEAPON_CADENCE.FIELD_OVERFLOW_BOARD }],
          effects: [{ do: 'convert', to: 'power', count: 1 }],
          callout: 'Fertile Field!',
        },
        {
          trigger: { on: 'everyNthSet', n: WEAPON_CADENCE.FIELD_OVERFLOW_EVERY },
          when: [{ kind: 'boardAtLeast', n: WEAPON_CADENCE.FIELD_OVERFLOW_BOARD }],
          effects: [{ do: 'convert', to: 'power', count: 1 }],
        },
      ],
    }),
  },

  // ── Hearts (Survival) ─────────────────────────────────────────────────────
  // Pure survival tank: 14%→30% heal; overhealing at full hearts grants +1 Over-Shield (no raw DPS rider)
  'mending-charm': {
    effects: { healingChance: 14 },
    perLevel: { healingChance: 4 },
    rider: () => ({
      rules: [
        {
          trigger: { on: 'weapon', kind: 'heal' },
          when: [{ kind: 'heartsFull' }],
          effects: [{ do: 'shield', count: 1 }],
          callout: 'Over-Shield!',
        },
      ],
    }),
  },
  // Pure HP tank: clean integer +1..+3 max hearts + heals every wave start (2♥ at Lv 4+), no vigor DPS rider
  'life-vessel': {
    effects: { maxHealth: 1, health: 1 },
    perLevel: { maxHealth: 0.5, health: 0.5 },
    byLevel: { maxHealth: [1, 1, 2, 2, 3], health: [1, 1, 2, 2, 3] },
    extra: {
      waveHeal: { label: 'Wave-start heal', unit: 'count', base: 1, perLevel: 0.25, byLevel: [1, 1, 1, 2, 2], tunable: false },
    },
    rider: v => ({
      rules: [{ trigger: { on: 'waveStart' }, effects: [{ do: 'heal', amount: v.waveHeal }], callout: 'Vitality!' }],
    }),
  },
  'soul-harvest': {
    effects: { ricochetChance: 16, ricochetDamage: 0.5, bridgeChance: 24 },
    perLevel: { ricochetChance: 3.5, ricochetDamage: 0.25, bridgeChance: 6 },
    extra: { strike: dmg('Soul heal damage', 2, 0.75) },
    rider: v => ({ rules: [strike({ on: 'healed' }, v.strike, 'Soul Harvest!')] }),
  },
  // Clean integer hearts [1,1,2,2,3]; tunes blast, bridge, and pulse damage
  'life-link': {
    effects: { maxHealth: 1, health: 1, explosionChance: 12, bridgeChance: 35 },
    perLevel: { maxHealth: 0.5, health: 0.5, explosionChance: 2.5, bridgeChance: 6 },
    byLevel: { maxHealth: [1, 1, 2, 2, 3], health: [1, 1, 2, 2, 3] },
    untunable: ['maxHealth'],
    extra: { strike: dmg('Full-heart pulse damage', 5, 2) },
    rider: v => ({
      rules: [
        { trigger: { on: 'waveStart' }, effects: [{ do: 'shield', count: 1 }], callout: 'Life Ward!' },
        {
          trigger: { on: 'everyNthSet', n: LIFE_LINK_PULSE_EVERY },
          when: [{ kind: 'heartsFull' }],
          effects: [{ do: 'damage', amount: v.strike }, { do: 'explode', area: { shape: 'random', count: 2 } }],
          callout: 'Life Pulse!',
        },
      ],
    }),
  },

  // ── Graces (Survival) ─────────────────────────────────────────────────────
  // Safety Cushion: clean +2..+5 starting Graces + 20%→40% chance spent Grace isn't consumed (zero DPS rider)
  'second-chance': {
    effects: { graces: 2 },
    perLevel: { graces: 1 },
    byLevel: { graces: [2, 3, 3, 4, 5] },
    extra: { keepChance: { label: 'Grace keep chance', unit: '%', base: 20, perLevel: 5 } },
    rider: v => ({
      rules: [
        {
          trigger: { on: 'graceUsed' },
          when: [{ kind: 'chance', pct: v.keepChance }],
          effects: [{ do: 'grace', amount: 1 }],
          callout: 'Spared!',
        },
      ],
    }),
  },
  // Grace Generator: steady Grace gain per Set + refills 1 Grace on wave start (zero DPS rider)
  'fortune-token': {
    effects: { graceGainChance: 14 },
    perLevel: { graceGainChance: 3 },
    rider: () => ({
      rules: [{ trigger: { on: 'waveStart' }, effects: [{ do: 'grace', amount: 1 }], callout: 'Lucky Wave!' }],
    }),
  },
  // Blast-to-Grace Bridge: blasts generate Graces; spent Graces trigger a 2×2 blast
  'chaos-conduit': {
    effects: { explosionChance: 8, bridgeChance: 30 },
    perLevel: { explosionChance: 2, bridgeChance: 8 },
    rider: () => ({
      rules: [{ trigger: { on: 'graceUsed' }, effects: [{ do: 'explode', area: { shape: 'block', cols: 2, rows: 2 } }], callout: 'Chaos Blast!' }],
    }),
  },
  // Defensive Retaliator: clean integer graces [1,1,2,2,3], 50%→90% laser retaliation on Grace save
  'grace-conduit': {
    effects: { graces: 1, laserDamage: 0.75, bridgeChance: 50 },
    perLevel: { graces: 0.5, laserDamage: 0.5, bridgeChance: 10 },
    byLevel: { graces: [1, 1, 2, 2, 3] },
    untunable: ['graces', 'bridgeChance'],
  },

  // ── Hints (Insight) ───────────────────────────────────────────────────────
  // Hint Hoarder: generates hints + +1.5→+3 dmg per unspent hint held (rewards hoarding!)
  'seeker-lens': {
    effects: { hintGainChance: 15 },
    perLevel: { hintGainChance: 4 },
    extra: { perHint: dmg('Set damage per unspent hint', SEEKER_DAMAGE_PER_HINT, 0.375) },
    rider: v => ({ modifiers: { hintHeldDamage: v.perHint } }),
  },
  // Active Hint Bank: +2..+5 filled hint slots; using a hint freezes the clock for 2s→4s (zero raw DPS)
  'crystal-orb': {
    effects: { maxHints: 2, hints: 2 },
    perLevel: { maxHints: 1, hints: 1 },
    byLevel: { maxHints: [2, 3, 3, 4, 5], hints: [2, 3, 3, 4, 5] },
    extra: {
      freeze: { label: 'Clock freeze on hint', unit: 's', base: 2, perLevel: 0.5 },
    },
    rider: v => ({
      rules: [{ trigger: { on: 'hintUsed' }, effects: [{ do: 'freeze', ms: Math.round(v.freeze * 1000) }], callout: 'Time Stop!' }],
    }),
  },
  // Idle Radar: fast 4s auto-hint + clock refund on hinted Sets (pure comfort tool, zero raw DPS)
  'oracle-eye': {
    effects: { autoHintChance: 30, autoHintInterval: WEAPON_CADENCE.ORACLE_INTERVAL_MS },
    perLevel: { autoHintChance: 4 },
    extra: {
      refund: { label: 'Clock refund on hinted Set', unit: 's', base: 1, perLevel: 0.25 },
    },
    rider: v => ({
      rules: [{ trigger: { on: 'set' }, when: [{ kind: 'hintedSet' }], effects: [{ do: 'time', seconds: v.refund }], callout: 'Foreseen!' }],
    }),
  },
  // 2-Card Precision Sniper: 2-card auto-hints + hinted Sets snipe & every 3rd hinted Set primes ×1.5
  'mystic-sight': {
    effects: { enhancedHintChance: 30, autoHintChance: 20, autoHintInterval: 2000 },
    perLevel: { enhancedHintChance: 4, autoHintChance: 4 },
    extra: { snipe: dmg('Hinted Set sniper damage', 5, 2) },
    rider: v => ({
      rules: [
        {
          trigger: { on: 'set' },
          when: [{ kind: 'hintedSet' }],
          effects: [{ do: 'damage', amount: v.snipe }],
          callout: 'Third Eye!',
        },
        {
          trigger: { on: 'everyNthSet', n: MYSTIC_EVERY },
          when: [{ kind: 'hintedSet' }],
          effects: [{ do: 'nextSetMultiplier', times: 1.5 }],
          callout: 'Precision!',
        },
      ],
    }),
  },

  // ── Economy (Insight) ─────────────────────────────────────────────────────
  // Shop & Coin Magnate: 20%→40% coin procs + +20%→+40% all coins + steady windfalls (zero raw DPS)
  'fortunes-favor': {
    effects: { coinGainChance: 20 },
    perLevel: { coinGainChance: 5 },
    extra: { coinBonus: { label: 'All coin gains', unit: '%', base: 20, perLevel: 5 } },
    rider: v => ({
      modifiers: { coinPercent: v.coinBonus },
      rules: [{ trigger: { on: 'everyNthSet', n: 3 }, effects: [{ do: 'coins', amount: 2 }], callout: 'Windfall!' }],
    }),
  },
  // Gilded Board Alchemist: gilds cards; bonus cards pay 2× coins & can spawn a hint (zero raw DPS)
  'fortunes-blessing': {
    effects: { coinGainChance: 18, bridgeChance: 30 },
    perLevel: { coinGainChance: 4, bridgeChance: 7 },
    extra: { bonusHintChance: { label: 'Bonus-card hint chance', unit: '%', base: 40, perLevel: 10 } },
    rider: v => ({
      rules: [
        { trigger: { on: 'waveStart' }, effects: [{ do: 'convert', to: 'gold', count: 1 }], callout: 'Gilded!' },
        { trigger: { on: 'bonusCardMatched' }, effects: [{ do: 'coins', amount: 3 }], callout: 'Gilded!' },
        { trigger: { on: 'bonusCardMatched' }, when: [{ kind: 'chance', pct: v.bonusHintChance }], effects: [{ do: 'hint', amount: 1 }] },
      ],
    }),
  },
  // Rapid Level-Up Engine: 22%→42% XP + steady study XP + +1 level-up pick choice at Lv 3+ (zero raw DPS)
  'scholars-tome': {
    effects: { xpGainChance: 22 },
    perLevel: { xpGainChance: 5 },
    extra: {
      extraPicks: { label: 'Extra level-up choices (Lv 3+)', unit: 'count', base: 0, perLevel: 0.25, byLevel: [0, 0, 1, 1, 1], tunable: false },
    },
    rider: v => ({
      ...(v.extraPicks > 0 ? { modifiers: { pickOptions: v.extraPicks } } : {}),
      rules: [{ trigger: { on: 'everyNthSet', n: WEAPON_CADENCE.SCHOLAR_XP_EVERY }, effects: [{ do: 'xp', amount: 2 }], callout: 'Study!' }],
    }),
  },
  // XP-to-Gold Dividend Loop: XP spawns coins, wave openers prime ×1.1→×1.3 Set multiplier
  'wisdom-chain': {
    effects: { xpGainChance: 18, bridgeChance: 30 },
    perLevel: { xpGainChance: 4, bridgeChance: 7 },
    extra: { openerMult: { label: 'Wave opener boost', unit: '×', base: 1.1, perLevel: 0.05, tunable: false } },
    rider: v => ({
      modifiers: { coinPercent: WISDOM_COIN_PCT },
      rules: [
        { trigger: { on: 'everyNthSet', n: WISDOM_XP_EVERY }, effects: [{ do: 'xp', amount: 2 }], callout: 'Insight!' },
        { trigger: { on: 'firstSetOfWave' }, effects: [{ do: 'nextSetMultiplier', times: v.openerMult }], callout: 'Dividend!' },
      ],
    }),
  },

  // ── Time (Tempo) ──────────────────────────────────────────────────────────
  // Flat starting clock + standing clock slow
  'chrono-shard': {
    effects: { startingTime: 20 },
    perLevel: { startingTime: 10 },
    extra: { slow: { label: 'Clock slow', unit: '%', base: 5, perLevel: 2.5 } },
    rider: v => ({ modifiers: { clockSlowPct: v.slow } }),
  },
  // Mid-fight clock refills
  'time-drop': { effects: { timeGainChance: 10, timeGainAmount: 4 }, perLevel: { timeGainChance: 2.5, timeGainAmount: 0.75 } },
  // Time-to-echo bridge
  'temporal-rift': {
    effects: { timeGainChance: 8, timeGainAmount: 4, bridgeChance: 30 },
    perLevel: { timeGainChance: 2, timeGainAmount: 0.5, bridgeChance: 8 },
  },

  // ── Echoes & Links (Chains) ───────────────────────────────────────────────
  // Double-echo cascade
  'chain-reaction': {
    effects: { echoChance: 8, chainReactionChance: 28 },
    perLevel: { echoChance: 2, chainReactionChance: 9 },
    extra: { strike: dmg('Echo damage', 2, 1) },
    rider: v => ({ rules: [strike({ on: 'weapon', kind: 'echo' }, v.strike)] }),
  },
  // Echo-to-fire bridge
  'cascade-core': { effects: { echoChance: 9, burnDamage: 1, bridgeChance: 38 }, perLevel: { echoChance: 2.5, burnDamage: 0.5, bridgeChance: 6 } },
  // Branching Mesh: links fork into chains of 3
  'neural-network': { effects: { connectionChance: 14, bonusConnectionChance: 30 }, perLevel: { connectionChance: 3, bonusConnectionChance: 9 } },
  // Chrono-Link Conduit: clean integer starting links [1,2,2,3,4], +0.8s→+2.0s per linked card destroyed
  'echo-chamber': {
    effects: { startingConnections: 1, echoTimeBonusPerLink: 0.8 },
    perLevel: { startingConnections: 0.75, echoTimeBonusPerLink: 0.3 },
    byLevel: { startingConnections: [1, 2, 2, 3, 4] },
    untunable: ['startingConnections'],
  },
};
