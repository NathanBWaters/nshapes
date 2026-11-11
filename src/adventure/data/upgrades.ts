/**
 * Permanent Camp upgrades — expensive on purpose, so replaying levels for
 * coins (Vampire Survivors style) always has something to buy.
 */
import type { UpgradeDef } from '../types';

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'tough_hide',
    name: 'Tough Hide',
    icon: 'lorc/shining-heart',
    description: t => `+${t} max heart${t === 1 ? '' : 's'} in every fight`,
    costs: [250, 750, 1800],
    apply: (s, t) => ({ ...s, maxHealth: s.maxHealth + t, health: s.health + t }),
  },
  {
    id: 'heavy_hitter',
    name: 'Heavy Hitter',
    icon: 'lorc/fist',
    description: t => `+${t} damage on every Set`,
    costs: [300, 900, 2200],
    apply: s => s,
    bonusDamage: t => t,
  },
  {
    id: 'lucky_purse',
    name: 'Lucky Purse',
    icon: 'lorc/crown-coin',
    description: t => `+${t * 10}% coins earned`,
    costs: [150, 400, 900, 1600, 2600],
    apply: s => s,
    coinBonusPercent: t => t * 10,
  },
  {
    id: 'sharp_eyes',
    name: 'Sharp Eyes',
    icon: 'lorc/light-bulb',
    description: t => `+${t} starting hint${t === 1 ? '' : 's'} (once hints are unlocked)`,
    costs: [200, 600, 1400],
    apply: (s, t) => ({ ...s, hints: s.hints + t, maxHints: s.maxHints + t }),
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    icon: 'lorc/clover',
    description: t => `+${t} starting grace${t === 1 ? '' : 's'} (once graces are unlocked)`,
    costs: [250, 700, 1600],
    apply: (s, t) => ({ ...s, graces: s.graces + t }),
  },
  {
    id: 'hourglass',
    name: 'Hourglass',
    icon: 'lorc/hourglass',
    description: t => `+${t * 8}s on timed levels`,
    costs: [200, 600, 1500],
    apply: (s, t, ctx) => (ctx.timed ? { ...s, startingTime: s.startingTime + t * 8 } : s),
  },
];

export const getUpgrade = (id: string): UpgradeDef => {
  const u = UPGRADES.find(x => x.id === id);
  if (!u) throw new Error(`Unknown upgrade ${id}`);
  return u;
};
