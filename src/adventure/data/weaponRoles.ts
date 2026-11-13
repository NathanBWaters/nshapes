/**
 * What each weapon is for, so the Armory can shelve 50+ weapons by job
 * instead of in the order they were found. One role per weapon;
 * __tests__/adventureTrickWeapons.test.ts checks none is missing.
 */
export type WeaponRole = 'damage' | 'gambles' | 'board' | 'survival' | 'insight' | 'tempo' | 'chains' | 'tricks';

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

const BY_ROLE: Record<WeaponRole, string[]> = {
  damage: ['blast-powder', 'flint-spark', 'prismatic-ray', 'chaos-shard', 'war-drum', 'rally-horn', 'pinata', 'amplifier-coil'],
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

/** The role of a weapon (unknown ids shelve under Damage). */
export const weaponRole = (id: string): WeaponRole => ROLE_OF[id] ?? 'damage';
export const hasWeaponRole = (id: string): boolean => id in ROLE_OF;
