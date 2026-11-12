/**
 * Permanent Camp Workshop upgrades — Mechanic Upgrades (stats), loadout-size
 * items (Charm Belt, Tarot Deck, Evolution Lab: they change nothing in
 * PlayerStats; the engine reads `save.upgrades[id]`) and Armory Weapon
 * Upgrades. Which of them a player may buy is decided in progress.ts.
 */
import type { Weapon, WeaponRarity } from '@/types';
import type { UpgradeDef } from '../types';

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'heavy_hitter',
    name: 'Heavy Hitter',
    icon: 'lorc/fist',
    description: t => `+${t} damage on every Set`,
    costs: [300, 900, 2200],
    apply: s => s,
    bonusDamage: t => t,
    mechanic: 'set_rule',
  },
  {
    id: 'tough_hide',
    name: 'Tough Hide',
    icon: 'lorc/shining-heart',
    description: t => `+${t} max heart${t === 1 ? '' : 's'} in every fight`,
    costs: [250, 750, 1800],
    apply: (s, t) => ({ ...s, maxHealth: s.maxHealth + t, health: s.health + t }),
    mechanic: 'hearts',
  },
  {
    id: 'lucky_purse',
    name: 'Lucky Purse',
    icon: 'lorc/crown-coin',
    description: t => `+${t * 10}% coins earned`,
    costs: [150, 400, 900, 1600, 2600],
    apply: s => s,
    coinBonusPercent: t => t * 10,
    mechanic: 'coins',
  },
  {
    id: 'hourglass',
    name: 'Hourglass',
    icon: 'lorc/hourglass',
    description: t => `+${t * 8}s on timed levels`,
    costs: [200, 600, 1500],
    apply: (s, t, ctx) => (ctx.timed ? { ...s, startingTime: s.startingTime + t * 8 } : s),
    mechanic: 'timer',
  },
  {
    id: 'sharp_eyes',
    name: 'Sharp Eyes',
    icon: 'lorc/light-bulb',
    description: t => `+${t} starting hint${t === 1 ? '' : 's'}`,
    costs: [200, 600, 1400],
    apply: (s, t) => ({ ...s, hints: s.hints + t, maxHints: s.maxHints + t }),
    mechanic: 'hints',
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    icon: 'lorc/clover',
    description: t => `+${t} starting grace${t === 1 ? '' : 's'}`,
    costs: [250, 700, 1600],
    apply: (s, t) => ({ ...s, graces: s.graces + t }),
    mechanic: 'graces',
  },

  // ── Loadout size: nothing to stats; the engine and Camp read save.upgrades[id] ──
  {
    id: 'charm_belt',
    name: 'Charm Belt',
    icon: 'lorc/belt-buckles',
    description: t => `${3 + t} charm slots (+${t})`,
    costs: [300, 900, 2000],
    apply: s => s,
    mechanic: 'charm_slots',
  },
  {
    id: 'tarot_deck',
    name: 'Tarot Deck',
    icon: 'caro-asercion/tarot-10-wheel-of-fortune',
    description: t => `${1 + t} Arcana slots (+${t})`,
    costs: [800, 2400],
    apply: s => s,
    mechanic: 'arcana_slots',
  },
  {
    id: 'evolution_lab',
    name: 'Evolution Lab',
    icon: 'lorc/fizzing-flask',
    description: t => `+${t * 4}% evolution likelihood on every refill`,
    costs: [500, 1300, 2800],
    apply: s => s,
    mechanic: 'evolutions',
  },
];

export const getUpgrade = (id: string): UpgradeDef => {
  const u = UPGRADES.find(x => x.id === id);
  if (!u) throw new Error(`Unknown upgrade ${id}`);
  return u;
};

// ─── Armory Weapon Upgrades ─────────────────────────────────────────────────

export const MAX_WEAPON_UPGRADE_TIER = 3;

const WEAPON_UPGRADE_COSTS: Record<WeaponRarity, [number, number, number]> = {
  common: [80, 180, 340],
  rare: [120, 260, 480],
  epic: [180, 380, 680],
  legendary: [250, 520, 900],
};

export const getWeaponUpgradeCosts = (rarity: WeaponRarity): [number, number, number] =>
  WEAPON_UPGRADE_COSTS[rarity];

const EFFECT_LABELS: Record<string, string> = {
  explosionChance: 'blast chance',
  fireSpreadChance: 'fire chance',
  healingChance: 'heal chance',
  coinGainChance: 'coin chance',
  xpGainChance: 'XP chance',
  timeGainChance: 'time-gain chance',
  echoChance: 'echo chance',
  laserChance: 'laser chance',
  ricochetChance: 'ricochet chance',
  ricochetChainChance: 'chain chance',
  boardGrowthChance: 'growth chance',
  graceGainChance: 'grace chance',
  hintGainChance: 'hint chance',
  autoHintChance: 'auto-hint chance',
  enhancedHintChance: 'sight chance',
  chainReactionChance: 'chain blast',
  connectionChance: 'link chance',
  bonusConnectionChance: 'bonus link chance',
  startingTime: 's starting time',
  timeGainAmount: 's per time proc',
  fieldSize: 'starting board size',
  boardGrowthAmount: 'cards per growth',
  startingConnections: 'starting links',
  maxHealth: 'max heart',
  graces: 'starting grace',
  hints: 'starting hint',
  maxHints: 'hint slot',
  echoTimeBonusPerLink: 's per link',
};

/** The generic tier formula, for weapons without their own `tierEffects`. */
const formulaDeltas = (weapon: Weapon, tier: number): Record<string, number> => {
  const deltas: Record<string, number> = {};
  const entries = Object.entries(weapon.effects).filter(([, v]) => typeof v === 'number' && v > 0) as Array<[string, number]>;

  for (const [k, v] of entries) {
    if (k.endsWith('Chance') || k.endsWith('Percent')) {
      deltas[k] = Math.max(4, Math.round(v * 0.25)) * tier;
    } else if (k === 'startingTime' || k === 'timeGainAmount') {
      deltas[k] = 3 * tier;
    } else if (k === 'fieldSize' || k === 'boardGrowthAmount' || k === 'startingConnections') {
      deltas[k] = tier;
    } else if (k === 'maxHealth') {
      if (tier >= 2) deltas.maxHealth = tier - 1;
      if (tier >= 2) deltas.health = tier - 1;
      deltas.healingChance = (deltas.healingChance ?? 0) + 6 * tier;
    } else if (k === 'graces') {
      if (tier >= 2) deltas.graces = tier - 1;
      deltas.graceGainChance = (deltas.graceGainChance ?? 0) + 6 * tier;
    } else if (k === 'hints') {
      if (tier >= 2) deltas.hints = tier - 1;
      deltas.hintGainChance = (deltas.hintGainChance ?? 0) + 6 * tier;
    }
  }

  return deltas;
};

/** What Workshop `tier` adds to each effect: the weapon's own `tierEffects` level, else the generic formula. */
const computeEffectDeltas = (weapon: Weapon, tier: number): Record<string, number> => {
  if (tier <= 0) return {};
  const level = weapon.tierEffects?.[Math.min(tier, MAX_WEAPON_UPGRADE_TIER) - 1];
  if (!level) return formulaDeltas(weapon, tier);
  const deltas: Record<string, number> = {};
  for (const [k, v] of Object.entries(level)) {
    if (typeof v !== 'number') continue;
    const base = (weapon.effects as Record<string, unknown>)[k];
    deltas[k] = v - (typeof base === 'number' ? base : 0);
  }
  return deltas;
};

/** Return a copy of `weapon` enhanced by Workshop `tier` (0..3). Never mutates `WEAPONS`. */
export const applyWeaponUpgradeTier = (weapon: Weapon, tier: number): Weapon => {
  if (tier <= 0) return weapon;
  const deltas = computeEffectDeltas(weapon, tier);
  const nextEffects: Record<string, unknown> = { ...weapon.effects };
  for (const [k, delta] of Object.entries(deltas)) {
    const cur = typeof nextEffects[k] === 'number' ? (nextEffects[k] as number) : 0;
    nextEffects[k] = cur + delta;
  }
  const nextBridge = weapon.bridgeEffect
    ? {
        ...weapon.bridgeEffect,
        chance: Math.min(95, weapon.bridgeEffect.chance + Math.max(5, Math.round(weapon.bridgeEffect.chance * 0.2)) * tier),
      }
    : undefined;

  const bonusText = describeWeaponUpgradeBonus(weapon, tier);

  return {
    ...weapon,
    shortDescription: `${weapon.shortDescription} (${bonusText})`,
    effects: nextEffects as Weapon['effects'],
    ...(nextBridge ? { bridgeEffect: nextBridge } : {}),
  };
};

/** Human-readable summary of what Workshop `tier` (1..3) adds to `weapon`. */
export const describeWeaponUpgradeBonus = (weapon: Weapon, tier: number): string => {
  const t = Math.max(1, tier);
  const parts: string[] = [];
  const deltas = computeEffectDeltas(weapon, t);
  for (const [k, delta] of Object.entries(deltas)) {
    if (k === 'health' || delta <= 0) continue;
    const label = EFFECT_LABELS[k];
    if (!label) continue;
    if (k.endsWith('Chance') || k.endsWith('Percent')) {
      parts.push(`+${delta}% ${label}`);
    } else if (k === 'startingTime' || k === 'timeGainAmount' || k === 'echoTimeBonusPerLink') {
      parts.push(`+${delta}${label}`);
    } else {
      parts.push(`+${delta} ${label}${delta > 1 && !label.endsWith('s') && !label.endsWith('size') ? 's' : ''}`);
    }
  }
  if (weapon.bridgeEffect) {
    const boost = Math.max(5, Math.round(weapon.bridgeEffect.chance * 0.2)) * t;
    parts.push(`+${boost}% trigger chance`);
  }
  return parts.join(' · ') || `+${t * 5}% potency`;
};
