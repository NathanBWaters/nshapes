/**
 * Permanent Camp Workshop upgrades — Mechanic Upgrades (stats) and loadout-size
 * items (Charm Belt, Tarot Deck, Evolution Lab: they change nothing in
 * PlayerStats; the engine reads `save.upgrades[id]`). Weapon tuning lives in
 * data/weaponStats.ts. Which of them a player may buy is decided in progress.ts.
 */
import type { WeaponRarity } from '@/types';
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

// ─── Old Workshop weapon levels ─────────────────────────────────────────────

/**
 * What the Workshop used to charge per weapon level, by the weapon's old
 * rarity. Levels are now found in the world only (data/weaponStats.ts); these
 * prices refund what an older save spent (progress.ts migrateWeaponIds).
 */
export const LEGACY_WEAPON_LEVEL_COSTS: Record<WeaponRarity, readonly [number, number, number]> = {
  common: [80, 180, 340],
  rare: [120, 260, 480],
  epic: [180, 380, 680],
  legendary: [250, 520, 900],
};
