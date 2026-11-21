/**
 * Adventure's numbers for the weapons it shares with Free Play
 * (utils/gameDefinitions.ts WEAPONS), and the extra thing each one does here.
 *
 * Three rules shape this table (docs/balance-philosophy.md, "Weapons"):
 *  1. EVERY weapon does something you can see, alone, at level 1. A proc
 *     weapon fires about once in five Sets from the start, not once a fight.
 *  2. Support weapons hit back. Hearts, hints, graces, coins and XP each come
 *     with a strike on the foe (`rider`), so no charm slot is a dead slot.
 *  3. A weapon that reacts to another weapon's effect (the old "bridge"
 *     weapons) brings a little of that effect itself, so it works alone and
 *     takes off when paired.
 *
 * `effects` and `perLevel` replace the Free Play numbers (and may add stats
 * the Free Play weapon doesn't have). `extra` are numbers that only drive the
 * `rider`: rules and modifiers built from the weapon's current numbers, in the
 * shared vocabulary (rules/types.ts). Levels and Workshop tuning grow all of
 * them (data/weaponStats.ts). Chances stay under the stat caps
 * (game/effectCaps.ts) at level 5 with full tuning.
 */
import type { Rule, RuleSource, Trigger } from '../rules/types';
import type { WeaponStatDef } from './weaponStats';

type V = Record<string, number>;

export interface AdventureTuning {
  /** Level-1 numbers. `bridgeChance` is the trigger chance of a reacting weapon. */
  effects?: Record<string, number>;
  /** Gain per level, by the same keys */
  perLevel?: Record<string, number>;
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

/** Oracle Eye: auto-hint idle wait in seconds (BASE_WAIT_TIME 8s − autoHintInterval 3s = 5s) */
export const ORACLE_WAIT_S = 5;
/** Seeker Lens: Set damage per hint you are holding */
export const SEEKER_DAMAGE_PER_HINT = 1;
/** Mystic Sight: every Nth Set */
export const MYSTIC_EVERY = 3;
/** Life Link: every Nth Set at full hearts unleashes a Life Pulse */
export const LIFE_LINK_PULSE_EVERY = 4;
/** Wisdom Chain: every Nth Set grants bonus XP */
export const WISDOM_XP_EVERY = 5;
/** Wisdom Chain: standing % coin bonus */
export const WISDOM_COIN_PCT = 15;

export const ADVENTURE_TUNING: Record<string, AdventureTuning> = {
  // ── Damage ────────────────────────────────────────────────────────────────
  'blast-powder': { effects: { explosionChance: 18, explosionDamage: 0.5 }, perLevel: { explosionChance: 4, explosionDamage: 0.25 } },
  'flint-spark': { effects: { fireSpreadChance: 20, burnDamage: 0.75 }, perLevel: { fireSpreadChance: 4, burnDamage: 0.35 } },
  'prismatic-ray': { effects: { laserChance: 10, laserDamage: 0.5 }, perLevel: { laserChance: 2.5, laserDamage: 0.75 } },
  'chaos-shard': {
    effects: { ricochetChance: 18, ricochetChainChance: 22, ricochetDamage: 0.5 },
    perLevel: { ricochetChance: 4.5, ricochetChainChance: 5.5, ricochetDamage: 0.5 },
  },
  'echo-stone': {
    effects: { echoChance: 14 },
    perLevel: { echoChance: 2 },
    extra: { strike: dmg('Echo damage', 3, 1.75) },
    rider: v => ({ rules: [strike({ on: 'weapon', kind: 'echo' }, v.strike)] }),
  },
  connector: { effects: { connectionChance: 25 }, perLevel: { connectionChance: 6 } },
  'web-weaver': { effects: { startingConnections: 2 }, perLevel: { startingConnections: 1 } },

  // ── Board ─────────────────────────────────────────────────────────────────
  'growth-seed': {
    effects: { boardGrowthChance: 15 },
    perLevel: { boardGrowthChance: 5 },
    rider: () => ({ rules: [{ trigger: { on: 'weapon', kind: 'growth' }, effects: [{ do: 'empowerBoard', amount: 1 }], callout: 'Bloom!' }] }),
  },
  'field-stone': {
    effects: { fieldSize: 2 },
    perLevel: { fieldSize: 1 },
    extra: { charge: { label: 'Opening power per card', unit: 'dmg', base: 1, perLevel: 0.5, tunable: false } },
    rider: v => ({ rules: [{ trigger: { on: 'waveStart' }, effects: [{ do: 'empowerBoard', amount: Math.round(v.charge * 2) / 2 }] }] }),
  },

  // ── Hearts ────────────────────────────────────────────────────────────────
  'mending-charm': {
    effects: { healingChance: 12 },
    perLevel: { healingChance: 4 },
    extra: { overheal: dmg('Overheal damage', 4, 1) },
    rider: v => ({
      rules: [{ trigger: { on: 'weapon', kind: 'heal' }, when: [{ kind: 'heartsFull' }], effects: [{ do: 'damage', amount: v.overheal }], callout: 'Overheal!' }],
    }),
  },
  'life-vessel': {
    extra: { vigor: dmg('Set damage at full hearts', 1, 0.5) },
    rider: v => ({ modifiers: { conditionalDamage: [{ when: [{ kind: 'heartsFull' }], amount: v.vigor }] } }),
  },
  'soul-harvest': {
    effects: { ricochetChance: 16, ricochetDamage: 0.5, bridgeChance: 24 },
    perLevel: { ricochetChance: 3.5, ricochetDamage: 0.25, bridgeChance: 6 },
    extra: { strike: dmg('Soul heal damage', 4, 1.5) },
    rider: v => ({ rules: [strike({ on: 'healed' }, v.strike, 'Soul Harvest!')] }),
  },
  'life-link': {
    effects: { maxHealth: 1, health: 1, explosionChance: 10, bridgeChance: 35 },
    perLevel: { maxHealth: 0.5, health: 0.5, explosionChance: 2.5, bridgeChance: 6 },
    extra: { strike: dmg('Full-heart pulse damage', 4, 1.5) },
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

  // ── Graces ────────────────────────────────────────────────────────────────
  'second-chance': {
    extra: { strike: dmg('Damage per grace save', 4, 2) },
    rider: v => ({ rules: [strike({ on: 'graceUsed' }, v.strike, 'Close call!')] }),
  },
  'fortune-token': {
    effects: { graceGainChance: 12 },
    perLevel: { graceGainChance: 3.5 },
    extra: { strike: dmg('Damage per grace gained', 4, 1) },
    rider: v => ({ rules: [strike({ on: 'weapon', kind: 'grace' }, v.strike)] }),
  },
  'chaos-conduit': {
    effects: { explosionChance: 8, bridgeChance: 30 },
    perLevel: { explosionChance: 2, bridgeChance: 8 },
  },
  'grace-conduit': {
    effects: { graces: 1, laserDamage: 0.5, bridgeChance: 38 },
    perLevel: { graces: 0.5, laserDamage: 0.5, bridgeChance: 6 },
  },

  // ── Hints ─────────────────────────────────────────────────────────────────
  'seeker-lens': {
    effects: { hintGainChance: 15 },
    perLevel: { hintGainChance: 4.5 },
    extra: { strike: dmg('Damage per hint found', 3, 0.75) },
    // Hoard them: every hint you are holding is worth damage on every Set
    rider: v => ({ rules: [strike({ on: 'weapon', kind: 'hint' }, v.strike)], modifiers: { hintHeldDamage: SEEKER_DAMAGE_PER_HINT } }),
  },
  'crystal-orb': {
    effects: { maxHints: 1, hints: 1 },
    perLevel: { maxHints: 1, hints: 1 },
    extra: {
      strike: dmg('Damage per hint used', 3, 1.5),
      insight: dmg('Hinted Set bonus', 3, 1),
    },
    rider: v => ({ rules: [strike({ on: 'hintUsed' }, v.strike)], modifiers: { hintedSetDamage: v.insight } }),
  },
  'oracle-eye': {
    effects: { autoHintChance: 24, autoHintInterval: 3000 },
    perLevel: { autoHintChance: 4 },
    extra: {
      insight: dmg('Hinted Set bonus', 4, 1.5),
      clarity: dmg('Clean-play Set bonus', 2, 0.5),
    },
    rider: v => ({
      modifiers: {
        hintedSetDamage: v.insight,
        conditionalDamage: [{ when: [{ kind: 'noMistakesThisFight' }], amount: v.clarity }],
      },
    }),
  },
  'mystic-sight': {
    effects: { enhancedHintChance: 30, autoHintChance: 16, autoHintInterval: 2000 },
    perLevel: { enhancedHintChance: 3, autoHintChance: 3 },
    extra: { third: dmg('Third Eye damage', 4, 1.5) },
    rider: v => ({ rules: [strike({ on: 'everyNthSet', n: MYSTIC_EVERY }, v.third, 'Third Eye!')] }),
  },
  'fortunes-blessing': {
    effects: { coinGainChance: 18, bridgeChance: 30 },
    perLevel: { coinGainChance: 4, bridgeChance: 7 },
    extra: { strike: dmg('Gold & bonus-card strike', 5, 1.5) },
    rider: v => ({
      rules: [
        { trigger: { on: 'waveStart' }, effects: [{ do: 'convert', to: 'gold', count: 1 }], callout: 'Gilded!' },
        { trigger: { on: 'bonusCardMatched' }, effects: [{ do: 'damage', amount: v.strike }], callout: 'Gilded!' },
      ],
    }),
  },

  // ── Coins & XP ────────────────────────────────────────────────────────────
  'fortunes-favor': {
    extra: { strike: dmg('Damage per bonus coin', 2, 0.25) },
    rider: v => ({ rules: [strike({ on: 'weapon', kind: 'coin' }, v.strike)] }),
  },
  'scholars-tome': {
    extra: { strike: dmg('Damage per bonus XP', 2, 0.25) },
    rider: v => ({ rules: [strike({ on: 'weapon', kind: 'xp' }, v.strike)] }),
  },
  'wisdom-chain': {
    effects: { xpGainChance: 18, bridgeChance: 30 },
    perLevel: { xpGainChance: 4, bridgeChance: 7 },
    extra: { strike: dmg('Dividend strike per coin', 3, 1) },
    rider: v => ({
      modifiers: { coinPercent: WISDOM_COIN_PCT },
      rules: [
        { trigger: { on: 'everyNthSet', n: WISDOM_XP_EVERY }, effects: [{ do: 'xp', amount: 2 }], callout: 'Insight!' },
        strike({ on: 'weapon', kind: 'coin' }, v.strike, 'Dividend!'),
      ],
    }),
  },

  // ── Time ──────────────────────────────────────────────────────────────────
  'chrono-shard': { effects: { startingTime: 20 }, perLevel: { startingTime: 10 } },
  'time-drop': { effects: { timeGainChance: 10, timeGainAmount: 4 }, perLevel: { timeGainChance: 2.5, timeGainAmount: 0.75 } },
  'temporal-rift': {
    effects: { timeGainChance: 8, timeGainAmount: 4, bridgeChance: 30 },
    perLevel: { timeGainChance: 2, timeGainAmount: 0.5, bridgeChance: 8 },
  },

  // ── Echoes & links ────────────────────────────────────────────────────────
  'chain-reaction': {
    effects: { echoChance: 8, chainReactionChance: 25 },
    perLevel: { echoChance: 2, chainReactionChance: 9 },
    extra: { strike: dmg('Echo damage', 2, 1) },
    rider: v => ({ rules: [strike({ on: 'weapon', kind: 'echo' }, v.strike)] }),
  },
  'cascade-core': { effects: { echoChance: 9, burnDamage: 1, bridgeChance: 38 }, perLevel: { echoChance: 2.5, burnDamage: 0.5, bridgeChance: 6 } },
  'neural-network': { effects: { connectionChance: 14, bonusConnectionChance: 25 }, perLevel: { connectionChance: 3, bonusConnectionChance: 9 } },
  'echo-chamber': { effects: { startingConnections: 1, echoTimeBonusPerLink: 0.5 }, perLevel: { startingConnections: 0.25, echoTimeBonusPerLink: 0.25 } },
};
