/**
 * What each weapon is for, so the Armory can shelve 50+ weapons by job
 * instead of in the order they were found. One role per weapon;
 * __tests__/adventureTrickWeapons.test.ts checks none is missing.
 *
 * Also defines Brotato-style Role Set Bonuses unlocked at 2 / 4 / 6 held
 * weapons of the same role.
 */
import type { Modifiers } from '../rules/types';

export type WeaponRole = 'damage' | 'gambles' | 'board' | 'survival' | 'insight' | 'tempo' | 'chains' | 'tricks';

export type RoleBonusTier = 2 | 4 | 6;

export interface RoleBonusTierDef {
  tier: RoleBonusTier;
  summary: string;
  modifiers: Modifiers;
}

export interface ActiveRoleBonus {
  role: WeaponRole;
  label: string;
  count: number;
  tier: RoleBonusTier;
  nextTier: RoleBonusTier | null;
  summary: string;
  modifiers: Modifiers;
}

export interface RoleBonusProgress {
  role: WeaponRole;
  label: string;
  count: number;
  activeTier: RoleBonusTier | null;
  nextTier: RoleBonusTier | null;
  activeSummary: string | null;
  nextSummary: string | null;
}

export const WEAPON_ROLES: { id: WeaponRole; label: string; blurb: string }[] = [
  { id: 'damage', label: 'Damage', blurb: 'Blasts, fire, lasers and big hits.' },
  { id: 'tricks', label: 'Tricks', blurb: 'Something to hunt for or keep up, every Set.' },
  { id: 'gambles', label: 'Board gambles', blurb: 'They make your board harder. Pull it off and they pay the most.' },
  { id: 'board', label: 'Board', blurb: 'Bigger, stranger, stronger boards.' },
  { id: 'survival', label: 'Hearts & graces', blurb: 'Stay alive, and hit back while you do.' },
  { id: 'insight', label: 'Hints, coins & XP', blurb: 'See more, earn more, level faster.' },
  { id: 'tempo', label: 'Time & evolutions', blurb: 'More clock, more Catalysts, longer power trips.' },
  { id: 'chains', label: 'Echoes & links', blurb: 'Free Sets and cards that fall together.' },
];

export const ROLE_SET_BONUSES: Record<WeaponRole, readonly RoleBonusTierDef[]> = {
  damage: [
    { tier: 2, summary: '+1 Set dmg', modifiers: { setDamage: 1 } },
    { tier: 4, summary: '+3 Set dmg', modifiers: { setDamage: 3 } },
    { tier: 6, summary: '+6 Set dmg & +0.25× Rainbow', modifiers: { setDamage: 6, rainbowMultiplierBonus: 0.25 } },
  ],
  tricks: [
    { tier: 2, summary: '+2 Trick Set dmg', modifiers: { setDamage: 2 } },
    { tier: 4, summary: '+4 Trick Set dmg', modifiers: { setDamage: 4 } },
    { tier: 6, summary: '+8 Trick Set dmg', modifiers: { setDamage: 8 } },
  ],
  gambles: [
    { tier: 2, summary: '+15% Gamble payouts', modifiers: { gambleBonusPct: 15 } },
    { tier: 4, summary: '+35% Gamble payouts', modifiers: { gambleBonusPct: 35 } },
    { tier: 6, summary: '+60% Gamble payouts', modifiers: { gambleBonusPct: 60 } },
  ],
  board: [
    { tier: 2, summary: '+1 starting card', modifiers: { startingBoardCards: 1 } },
    { tier: 4, summary: '+2 starting cards', modifiers: { startingBoardCards: 2 } },
    { tier: 6, summary: '+3 starting cards', modifiers: { startingBoardCards: 3 } },
  ],
  survival: [
    { tier: 2, summary: '+1 max heart', modifiers: { maxHearts: 1 } },
    {
      tier: 4,
      summary: '+2 max hearts & +4 dmg at full ♥',
      modifiers: { maxHearts: 2, conditionalDamage: [{ when: [{ kind: 'heartsFull' }], amount: 4 }] },
    },
    {
      tier: 6,
      summary: '+3 max hearts & +8 dmg at full ♥',
      modifiers: { maxHearts: 3, conditionalDamage: [{ when: [{ kind: 'heartsFull' }], amount: 8 }] },
    },
  ],
  insight: [
    { tier: 2, summary: '+1 hint & +1 dmg/hint held', modifiers: { startingHints: 1, hintHeldDamage: 1 } },
    { tier: 4, summary: '+2 hints & +2 dmg/hint held', modifiers: { startingHints: 2, hintHeldDamage: 2 } },
    { tier: 6, summary: '+3 hints & +3 dmg/hint held', modifiers: { startingHints: 3, hintHeldDamage: 3 } },
  ],
  tempo: [
    { tier: 2, summary: '+3s (+10%) Evolution duration', modifiers: { evolutionDurationMs: 3000 } },
    { tier: 4, summary: '+6s (+20%) Evolution duration', modifiers: { evolutionDurationMs: 6000 } },
    {
      tier: 6,
      summary: '+10s (+35%) Evolution duration & +1 Evo cap',
      modifiers: { evolutionDurationMs: 10000, extraEvolutionsPerFight: 1 },
    },
  ],
  chains: [
    { tier: 2, summary: '+1 starting link & +1 Set dmg', modifiers: { startingLinks: 1, setDamage: 1 } },
    { tier: 4, summary: '+2 starting links, +5 Set dmg & +5% echo', modifiers: { startingLinks: 2, setDamage: 5, bonusEchoChance: 5 } },
    {
      tier: 6,
      summary: '+3 starting links, +16 Set dmg, +10% echo, +12% Catalyst & +6s/+1 Evo',
      modifiers: {
        startingLinks: 3,
        setDamage: 16,
        bonusEchoChance: 10,
        evolutionLikelihood: 12,
        evolutionDurationMs: 6000,
        extraEvolutionsPerFight: 1,
      },
    },
  ],
};

const BY_ROLE: Record<WeaponRole, string[]> = {
  damage: ['blast-powder', 'rainbow-charm', 'flint-spark', 'prismatic-ray', 'chaos-shard', 'war-drum', 'rally-horn', 'pinata', 'amplifier-coil'],
  tricks: ['magnet', 'bounty-poster', 'mirror-shard', 'odd-one-out', 'collectors-album', 'snowball', 'glass-sword', 'devils-bargain', 'tightrope', 'understudy'],
  gambles: ['cursed-idol', 'chain-gang', 'thorn-bush', 'rust', 'tar-pit', 'decoy', 'long-fuse', 'ice-block', 'greedy-chest', 'hot-potato', 'twin-seed', 'fog-lantern'],
  board: ['field-stone', 'growth-seed', 'clarity-lens', 'wild-card'],
  survival: ['mending-charm', 'life-vessel', 'life-link', 'soul-harvest', 'revenge-linker', 'second-chance', 'fortune-token', 'grace-conduit', 'chaos-conduit'],
  insight: ['seeker-lens', 'crystal-orb', 'oracle-eye', 'mystic-sight', 'fortunes-favor', 'fortunes-blessing', 'scholars-tome', 'wisdom-chain'],
  tempo: ['chrono-shard', 'time-drop', 'temporal-rift', 'catalyst-prism', 'encore-mask'],
  chains: ['echo-stone', 'chain-reaction', 'cascade-core', 'connector', 'web-weaver', 'neural-network', 'echo-chamber'],
};

const ROLE_OF: Record<string, WeaponRole> = Object.fromEntries(
  (Object.entries(BY_ROLE) as [WeaponRole, string[]][]).flatMap(([role, ids]) => ids.map(id => [id, role]))
);

const ROLE_LABEL: Record<WeaponRole, string> = Object.fromEntries(
  WEAPON_ROLES.map(r => [r.id, r.label])
) as Record<WeaponRole, string>;

/** The role of a weapon (unknown ids shelve under Damage). */
export const weaponRole = (id: string): WeaponRole => ROLE_OF[id] ?? 'damage';
export const hasWeaponRole = (id: string): boolean => id in ROLE_OF;
export const roleLabel = (role: WeaponRole): string => ROLE_LABEL[role];

const extractIds = (weapons: readonly (string | { id: string })[]): string[] =>
  weapons.map(w => (typeof w === 'string' ? w : w.id));

const roleCounts = (weapons: readonly (string | { id: string })[]): Map<WeaponRole, number> => {
  const counts = new Map<WeaponRole, number>();
  for (const id of extractIds(weapons)) {
    // Only count registered Armory weapons so synthetic test relics do not trigger role sets
    if (!hasWeaponRole(id)) continue;
    const role = ROLE_OF[id];
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return counts;
};

/** Active Brotato-style 2/4/6 Role Set Bonuses for a loadout (highest reached tier per role). */
export const activeRoleBonuses = (weapons: readonly (string | { id: string })[]): ActiveRoleBonus[] => {
  const counts = roleCounts(weapons);
  const out: ActiveRoleBonus[] = [];
  for (const [role, count] of counts.entries()) {
    const tiers = ROLE_SET_BONUSES[role];
    let best: RoleBonusTierDef | null = null;
    for (const def of tiers) {
      if (count >= def.tier) best = def;
    }
    if (!best) continue;
    const next = tiers.find(def => def.tier > best!.tier)?.tier ?? null;
    out.push({
      role,
      label: ROLE_LABEL[role],
      count,
      tier: best.tier,
      nextTier: next,
      summary: best.summary,
      modifiers: best.modifiers,
    });
  }
  return out.sort((a, b) => b.tier - a.tier || b.count - a.count || a.role.localeCompare(b.role));
};

/** Role progress for every role with at least 1 held weapon (useful for Shop/Armory badges). */
export const roleBonusProgress = (weapons: readonly (string | { id: string })[]): RoleBonusProgress[] => {
  const counts = roleCounts(weapons);
  const out: RoleBonusProgress[] = [];
  for (const [role, count] of counts.entries()) {
    const tiers = ROLE_SET_BONUSES[role];
    let best: RoleBonusTierDef | null = null;
    for (const def of tiers) {
      if (count >= def.tier) best = def;
    }
    const nextDef = tiers.find(def => def.tier > (best?.tier ?? 0)) ?? null;
    out.push({
      role,
      label: ROLE_LABEL[role],
      count,
      activeTier: best?.tier ?? null,
      nextTier: nextDef?.tier ?? null,
      activeSummary: best?.summary ?? null,
      nextSummary: nextDef?.summary ?? null,
    });
  }
  return out.sort((a, b) => (b.activeTier ?? 0) - (a.activeTier ?? 0) || b.count - a.count || a.role.localeCompare(b.role));
};
