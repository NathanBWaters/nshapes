/**
 * Adventure progression: save migration, the shared star pool, skill trees,
 * charm and Arcana slots, the Workshop, rewards and bounties. Pure logic, no UI.
 */
import { LEVELS, MAIN_LEVELS, getLevel } from '@/adventure/data/levels';
import { FIGHTERS } from '@/adventure/data/fighters';
import { ARCANA, getArcana } from '@/adventure/data/arcana';
import { BOUNTIES } from '@/adventure/data/bounties';
import { BIOMES } from '@/adventure/data/biomes';
import { CAMPAIGN_FEATURES } from '@/adventure/data/features';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { SEALED_AT, SKILL_NODES, getSkillNode, skillTreeOf, skillTreeRoots } from '@/adventure/data/skillTrees';
import { UPGRADES } from '@/adventure/data/upgrades';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { starRewards } from '@/adventure/data/rewards';
import {
  LEGACY_FIGHTER_LEVEL_COSTS,
  MAX_ARCANA_SLOTS,
  MAX_CHARM_SLOTS,
  applyLevelResult,
  arcanaSlots,
  armedRecipes,
  availableStars,
  buyNode,
  buyUpgrade,
  buyTuning,
  canBuyNode,
  canBuyUpgrade,
  canTune,
  charmSlots,
  createMaxedSave,
  createNewSave,
  equipArcana,
  equipCharm,
  equippedArcanaOf,
  equippedCharms,
  getLockReason,
  getUnlockedUpgrades,
  isBiomeOpen,
  migrateSave,
  nodeStatus,
  reconcileUnlocks,
  recipesArmedBy,
  refundAllCamp,
  refundBlockers,
  refundNode,
  canRefundNode,
  fighterStarsSpent,
  refundFighter,
  refundUpgrade,
  refundableCoins,
  starsSpent,
  toggleArcana,
  toggleCharm,
  totalStarsEarned,
  unequipArcana,
  unequipCharm,
  upgradeSpentCoins,
  upgradeTier,
  tuningSpent,
  weaponLevel,
  weaponBuilds,
} from '@/adventure/progress';
import { loadAdventureSave } from '@/adventure/save';
import type { AdventureSave, ArcanaId, SkillNode } from '@/adventure/types';
import type { CharacterName } from '@/types';

const mockKvStore = new Map<string, string>();
jest.mock('@/utils/storage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockKvStore.get(key)),
    set: jest.fn((key: string, val: string) => {
      mockKvStore.set(key, val);
    }),
  },
}));

/** Every weapon the campaign hands out, in the order levels list them. */
const CAMPAIGN_WEAPONS = [...new Set(LEVELS.flatMap(l => starRewards(l).flatMap(r => r.weapons ?? [])))];

/** Every star on the first `n` main levels. */
const starsOnFirst = (n: number, stars = 3): Record<string, number> =>
  Object.fromEntries(MAIN_LEVELS.slice(0, n).map(l => [l.id, stars]));

const ALL_MAIN_STARS = starsOnFirst(MAIN_LEVELS.length);

/** Nodes that hang straight off one of the fighter's passives. */
const rootAdjacent = (fighter: CharacterName): SkillNode[] => skillTreeOf(fighter).filter(n => n.roots.length > 0);

/** Tabby node by its key (`0-1`, `x-1`, `cap-1`...). */
const tabby = (key: string): SkillNode => getSkillNode(`tabby-${key}`)!;

/** A save that has earned exactly `total` stars. */
const withStars = (save: AdventureSave, total: number): AdventureSave => {
  const stars: Record<string, number> = {};
  let left = total;
  for (const l of LEVELS) {
    if (left <= 0) break;
    stars[l.id] = Math.min(3, left);
    left -= stars[l.id];
  }
  return { ...save, stars };
};

describe('Save migration from the v1 shape', () => {
  const v1 = (): AdventureSave => ({
    ...createNewSave(),
    coins: 100,
    lifetimeCoins: 5000,
    stars: starsOnFirst(6),
    unlockedFighters: ['Orange Tabby', 'Sly Fox'],
    armory: CAMPAIGN_WEAPONS.slice(0, 2),
    unlockedArcana: [ARCANA[0].id],
    fighterLevels: { 'Orange Tabby': 4, 'Sly Fox': 2 },
    charm: CAMPAIGN_WEAPONS[1],
    activeArcana: ARCANA[0].id,
  });
  const REFUND = 60 + 120 + 200 + 60;

  it('refunds every coin spent on fighter levels with the old cost table, then clears them', () => {
    expect(LEGACY_FIGHTER_LEVEL_COSTS).toEqual([60, 120, 200, 320, 480, 700, 1000, 1400, 1900]);
    const migrated = migrateSave(v1());
    expect(migrated.coins).toBe(100 + REFUND);
    expect(migrated.lifetimeCoins).toBe(5000);
    expect(migrated.fighterLevels).toEqual({});
    // Running it again pays nothing twice
    expect(migrateSave(migrated).coins).toBe(migrated.coins);
  });

  it('moves the single charm into charms and the single Arcana into equippedArcana', () => {
    const migrated = migrateSave(v1());
    expect(migrated.charm).toBeNull();
    expect(migrated.charms).toEqual([CAMPAIGN_WEAPONS[1]]);
    expect(migrated.activeArcana).toBeNull();
    expect(migrated.equippedArcana).toEqual([ARCANA[0].id]);
  });

  it('a level-10 fighter refunds the whole old table', () => {
    const migrated = migrateSave({ ...v1(), fighterLevels: { 'Orange Tabby': 10 } });
    expect(migrated.coins).toBe(100 + LEGACY_FIGHTER_LEVEL_COSTS.reduce((a, b) => a + b, 0));
  });

  it('loadAdventureSave migrates a stored v1 save, refunds old Workshop weapon levels, and writes it back once', () => {
    mockKvStore.clear();
    const stored: Record<string, unknown> = { ...v1(), weaponUpgrades: { [CAMPAIGN_WEAPONS[0]]: 2 } };
    // A real v1 save has none of the new fields
    delete stored.charms;
    delete stored.equippedArcana;
    delete stored.skillNodes;
    mockKvStore.set('adventure_v2_save', JSON.stringify(stored));
    const loaded = loadAdventureSave();
    // Workshop weapon levels are found in the world now: the 2 bought ones come back as coins (common prices)
    expect(loaded.coins).toBe(100 + REFUND + 80 + 180);
    expect(loaded.charms).toEqual([CAMPAIGN_WEAPONS[1]]);
    expect(loaded.equippedArcana).toEqual([ARCANA[0].id]);
    expect(loaded.skillNodes).toEqual({});
    expect(loaded.weaponUpgrades).toEqual({});
    const written = JSON.parse(mockKvStore.get('adventure_v2_save')!);
    expect(written.fighterLevels).toEqual({});
    expect(written.charm).toBeNull();
    // Loading again does not refund again
    expect(loadAdventureSave().coins).toBe(loaded.coins);
  });
});

describe('Star pool', () => {
  it('available = earned − spent across every tree; star gates read earned stars', () => {
    const fighter: CharacterName = 'Orange Tabby';
    const [n1, n2] = rootAdjacent(fighter);
    let save = withStars(createNewSave(), 30);
    expect(totalStarsEarned(save)).toBe(30);
    expect(starsSpent(save)).toBe(0);
    expect(availableStars(save)).toBe(30);

    save = buyNode(buyNode(save, n1.id), n2.id);
    expect(starsSpent(save)).toBe(n1.cost + n2.cost);
    expect(availableStars(save)).toBe(30 - n1.cost - n2.cost);
    expect(totalStarsEarned(save)).toBe(30);

    // Spending never re-locks a world
    for (const b of BIOMES.filter(x => x.starGate <= 30)) expect(isBiomeOpen(save, b.id)).toBe(true);
  });
});

describe('Skill trees', () => {
  const SLUGS: Record<CharacterName, string> = {
    'Orange Tabby': 'tabby', 'Sly Fox': 'fox', Badger: 'badger', 'Emperor Penguin': 'penguin', Corgi: 'corgi', Pelican: 'pelican',
  };

  it('every fighter has a connected web: symmetric links, unique cells, reachable from the passives, with loops', () => {
    expect(new Set(SKILL_NODES.map(n => n.id)).size).toBe(SKILL_NODES.length);
    for (const f of FIGHTERS) {
      const nodes = skillTreeOf(f.name);
      const ids = new Set(nodes.map(n => n.id));
      expect(nodes.length).toBeGreaterThanOrEqual(22);
      expect(nodes.length).toBeLessThanOrEqual(26);

      // Every old two-branch node is still there, so saves keep what they own
      for (const b of [0, 1]) for (let d = 1; d <= 10; d++) expect(ids.has(`${SLUGS[f.name]}-${b}-${d}`)).toBe(true);

      // One node per cell (the passive roots included), all inside the 7-column grid
      const roots = skillTreeRoots(f.name);
      expect(roots.map(r => r.passive)).toEqual(f.passives);
      const cells = [...nodes.map(n => n.pos), ...roots.map(r => r.pos)].map(p => `${p.col},${p.row}`);
      expect(new Set(cells).size).toBe(cells.length);
      for (const n of nodes) {
        expect(n.pos.col).toBeGreaterThanOrEqual(0);
        expect(n.pos.col).toBeLessThanOrEqual(6);
      }

      // Links are symmetric, stay inside the tree and never point at themselves
      let edges = 0;
      for (const n of nodes) {
        for (const other of n.links) {
          expect(other).not.toBe(n.id);
          expect(ids.has(other)).toBe(true);
          expect(getSkillNode(other)!.links).toContain(n.id);
          edges++;
        }
        for (const p of n.roots) expect(f.passives).toContain(p);
      }
      edges /= 2;

      // Both passives grow something, and every node can be reached from them
      for (const p of f.passives) expect(nodes.some(n => n.roots.includes(p))).toBe(true);
      const seen = new Set(nodes.filter(n => n.roots.length > 0).map(n => n.id));
      const queue = [...seen];
      while (queue.length) for (const next of getSkillNode(queue.shift()!)!.links) if (!seen.has(next)) { seen.add(next); queue.push(next); }
      expect(seen.size).toBe(nodes.length);

      // Branches fork and rejoin: more links than a plain tree would need
      const rootLinks = nodes.reduce((sum, n) => sum + n.roots.length, 0);
      expect(edges + rootLinks).toBeGreaterThan(nodes.length + 2);
    }
  });

  it('costs follow the role: cheap next to the passives, 1-6 each, 60-75 per fighter, one sealed capstone', () => {
    for (const f of FIGHTERS) {
      const nodes = skillTreeOf(f.name);
      const total = nodes.reduce((sum, n) => sum + n.cost, 0);
      expect(total).toBeGreaterThanOrEqual(60);
      expect(total).toBeLessThanOrEqual(75);
      for (const n of nodes) {
        expect(n.cost).toBeGreaterThanOrEqual(1);
        expect(n.cost).toBeLessThanOrEqual(6);
      }
      // Every passive has a 1-star way in
      for (const p of f.passives) expect(nodes.some(n => n.roots.includes(p) && n.cost === 1)).toBe(true);
      const sealed = nodes.filter(n => n.requires);
      expect(sealed).toHaveLength(1);
      expect(sealed[0].requires).toEqual({ starsEarned: SEALED_AT });
      // Sealed at World 4's star gate
      expect(BIOMES.some(b => b.starGate === SEALED_AT)).toBe(true);
    }
  });

  it('node text is short and true in any buying order (no "was X" claims)', () => {
    for (const n of SKILL_NODES) {
      expect(n.text.length).toBeLessThanOrEqual(90);
      expect(n.text).not.toMatch(/\(was /);
      expect(n.rules?.length || n.modifiers).toBeTruthy();
    }
  });

  it('buys by adjacency: a node opens once anything it links to (or its passive) is owned', () => {
    let save = withStars(createNewSave(), 30);
    // Purr Punch hangs off Nine Lives; Lick Wounds and Catnip hang off Purr Punch
    expect(tabby('0-1').roots).toEqual(['nine_lives']);
    expect(nodeStatus(save, tabby('0-1').id)).toBe('buyable');
    expect(nodeStatus(save, tabby('1-2').id)).toBe('needsLink');
    expect(canBuyNode(save, tabby('1-2').id)).toBe(false);
    expect(buyNode(save, tabby('1-2').id)).toBe(save);

    save = buyNode(save, tabby('0-1').id);
    expect(nodeStatus(save, tabby('0-1').id)).toBe('owned');
    // Buying an owned node again changes nothing
    expect(buyNode(save, tabby('0-1').id)).toBe(save);
    expect(nodeStatus(save, tabby('1-2').id)).toBe('buyable');
    expect(nodeStatus(save, tabby('0-5').id)).toBe('buyable');
    // Scrappy's side needs only its own passive
    expect(nodeStatus(save, tabby('1-1').id)).toBe('buyable');
  });

  it('branches rejoin: the crossroads opens from either passive', () => {
    const base = withStars(createNewSave(), 40);
    const x = tabby('x-1');
    expect(nodeStatus(base, x.id)).toBe('needsLink');

    // Nine Lives side: Warm Lap → Hot-Blooded → crossroads
    let left = buyNode(buyNode(base, tabby('0-2').id), tabby('1-3').id);
    expect(nodeStatus(left, x.id)).toBe('buyable');
    left = buyNode(left, x.id);
    expect(left.skillNodes['Orange Tabby']).toContain(x.id);

    // Scrappy side: Street Smarts → Last Breath → crossroads
    const right = buyNode(buyNode(base, tabby('1-4').id), tabby('0-6').id);
    expect(right.skillNodes['Orange Tabby']).toEqual([tabby('1-4').id, tabby('0-6').id]);
    expect(nodeStatus(right, x.id)).toBe('buyable');
  });

  it('not enough stars, sealed capstones and locked fighters', () => {
    let save = withStars(createNewSave(), 3);
    save = buyNode(save, tabby('0-1').id);
    save = buyNode(save, tabby('1-2').id);
    expect(availableStars(save)).toBe(0);
    expect(nodeStatus(save, tabby('0-3').id)).toBe('needsStars');

    // The claw tip is sealed until World 4's star gate, even with a path to it
    const cap = tabby('cap-1');
    expect(cap.requires?.starsEarned).toBe(SEALED_AT);
    const path = { 'Orange Tabby': [tabby('0-2').id, tabby('1-5').id, tabby('1-6').id] };
    const early = { ...withStars(createNewSave(), SEALED_AT - 1), skillNodes: path };
    expect(nodeStatus(early, cap.id)).toBe('sealed');
    expect(buyNode(early, cap.id)).toBe(early);
    const late = { ...withStars(createNewSave(), SEALED_AT + 4), skillNodes: path };
    expect(nodeStatus(late, cap.id)).toBe('buyable');
    expect(buyNode(late, cap.id).skillNodes['Orange Tabby']).toContain(cap.id);

    const locked = FIGHTERS.find(f => !createNewSave().unlockedFighters.includes(f.name))!;
    expect(nodeStatus(withStars(createNewSave(), 20), rootAdjacent(locked.name)[0].id)).toBe('fighterLocked');
  });

  it('refunds one node when nothing hangs off it, or the whole fighter, for free', () => {
    const fighter: CharacterName = 'Orange Tabby';
    let save = withStars(createNewSave(), 60);
    for (const key of ['0-1', '0-5', '1-2', '0-3']) save = buyNode(save, tabby(key).id);
    const spent = ['0-1', '0-5', '1-2', '0-3'].reduce((sum, k) => sum + tabby(k).cost, 0);
    expect(fighterStarsSpent(save, fighter)).toBe(spent);

    // Catnip hangs only off Purr Punch: Purr Punch can't go first
    expect(refundBlockers(save, tabby('0-1').id).map(n => n.id)).toEqual([tabby('0-5').id]);
    expect(canRefundNode(save, tabby('0-1').id)).toBe(false);
    expect(refundNode(save, tabby('0-1').id)).toBe(save);

    // Lick Wounds sits in a loop (Purr Punch and Spare Life both touch Nine Lives): free to go
    expect(canRefundNode(save, tabby('1-2').id)).toBe(true);
    save = refundNode(save, tabby('0-5').id);
    expect(availableStars(save)).toBe(60 - spent + tabby('0-5').cost);
    save = refundNode(save, tabby('0-1').id);
    expect(save.skillNodes[fighter]).toEqual([tabby('1-2').id, tabby('0-3').id]);
    // Not owned: nothing to refund
    expect(refundNode(save, tabby('0-1').id)).toBe(save);

    const afterFighter = refundFighter(save, fighter);
    expect(afterFighter.skillNodes[fighter]).toBeUndefined();
    expect(availableStars(afterFighter)).toBe(60);
  });

  it('reconcileUnlocks keeps only nodes still connected to a passive, and hands everything back if the trees cost more than earned', () => {
    const fighter: CharacterName = 'Orange Tabby';
    const broken: AdventureSave = {
      ...withStars(createNewSave(), 30),
      // Sunbeam's only way in is Catnip (not owned); a Fox node filed under Tabby; a removed node
      skillNodes: { [fighter]: [tabby('0-1').id, tabby('0-9').id, 'fox-0-1', 'no-such-node'] },
    };
    expect(reconcileUnlocks(broken).skillNodes).toEqual({ [fighter]: [tabby('0-1').id] });

    const overspent: AdventureSave = { ...withStars(createNewSave(), 2), skillNodes: { [fighter]: [tabby('0-1').id, tabby('1-2').id, tabby('0-3').id] } };
    expect(reconcileUnlocks(overspent).skillNodes).toEqual({});
  });
});

describe('Charm slots', () => {
  const armory = CAMPAIGN_WEAPONS.slice(0, 7);
  const base = (): AdventureSave => ({ ...createNewSave(), armory, workshopUnlocked: true, coins: 10000, stars: ALL_MAIN_STARS });

  it('start at 3; Charm Belt adds one per tier up to 6', () => {
    let save = base();
    expect(charmSlots(save)).toBe(3);
    const belt = UPGRADES.find(u => u.id === 'charm_belt')!;
    expect(belt.costs).toEqual([300, 900, 2000]);
    for (let t = 1; t <= belt.costs.length; t++) {
      save = buyUpgrade(save, 'charm_belt');
      expect(charmSlots(save)).toBe(3 + t);
    }
    expect(charmSlots(save)).toBe(MAX_CHARM_SLOTS);
    expect(charmSlots({ ...save, upgrades: { charm_belt: 9 } })).toBe(MAX_CHARM_SLOTS);
  });

  it('equips only Armory weapons, never twice, and does nothing when full', () => {
    let save = base();
    save = equipCharm(save, armory[0]);
    save = equipCharm(save, armory[0]);
    expect(save.charms).toEqual([armory[0]]);
    expect(equipCharm(save, 'not-a-weapon')).toBe(save);
    save = equipCharm(equipCharm(save, armory[1]), armory[2]);
    expect(equippedCharms(save)).toEqual(armory.slice(0, 3));
    expect(equipCharm(save, armory[3])).toBe(save);
    save = unequipCharm(save, armory[1]);
    expect(equippedCharms(save)).toEqual([armory[0], armory[2]]);
    save = toggleCharm(save, armory[3]);
    save = toggleCharm(save, armory[0]);
    expect(equippedCharms(save)).toEqual([armory[2], armory[3]]);
  });

  it('refunding the Charm Belt takes off what no longer fits', () => {
    let save = buyUpgrade(base(), 'charm_belt');
    for (const id of armory.slice(0, 4)) save = equipCharm(save, id);
    expect(equippedCharms(save)).toHaveLength(4);
    save = refundUpgrade(save, 'charm_belt');
    expect(save.charms).toEqual(armory.slice(0, 3));
  });

  it('a won weapon goes straight into a free slot', () => {
    const level = LEVELS.find(l => starRewards(l).some(r => r.weapons?.length))!;
    const star = starRewards(level).findIndex(r => r.weapons?.length) + 1;
    const result = applyLevelResult(createNewSave(), level, star, 0);
    expect(result.save.charms).toContain(starRewards(level)[star - 1].weapons![0]);
  });
});

describe('Arcana slots', () => {
  const owned = ARCANA.slice(0, 3).map(a => a.id) as ArcanaId[];
  const base = (): AdventureSave => ({ ...createNewSave(), unlockedArcana: owned, workshopUnlocked: true, coins: 10000, stars: ALL_MAIN_STARS });

  it('start at 1; Tarot Deck adds slots up to 3 and is sold once two Arcana are owned', () => {
    let save = base();
    expect(arcanaSlots(save)).toBe(1);
    expect(UPGRADES.find(u => u.id === 'tarot_deck')!.costs).toEqual([800, 2400]);
    expect(canBuyUpgrade({ ...save, unlockedArcana: [owned[0]] }, 'tarot_deck')).toBe(false);
    expect(canBuyUpgrade(save, 'tarot_deck')).toBe(true);
    save = buyUpgrade(buyUpgrade(save, 'tarot_deck'), 'tarot_deck');
    expect(arcanaSlots(save)).toBe(MAX_ARCANA_SLOTS);
  });

  it('with one slot equipping swaps; with more it fills, then makes room by dropping the oldest', () => {
    let save = base();
    save = equipArcana(save, owned[0]);
    save = equipArcana(save, owned[1]);
    expect(equippedArcanaOf(save)).toEqual([owned[1]]);
    save = buyUpgrade(save, 'tarot_deck');
    save = equipArcana(save, owned[0]);
    expect(equippedArcanaOf(save)).toEqual([owned[1], owned[0]]);
    save = equipArcana(save, owned[2]);
    expect(equippedArcanaOf(save)).toEqual([owned[0], owned[2]]);
    save = unequipArcana(save, owned[0]);
    expect(equippedArcanaOf(save)).toEqual([owned[2]]);
    save = toggleArcana(save, owned[2]);
    expect(equippedArcanaOf(save)).toEqual([]);
    const locked = ARCANA.find(a => !owned.includes(a.id))!;
    expect(equipArcana(save, locked.id)).toBe(save);
  });
});

describe('Workshop', () => {
  it('sells Charm Belt, Tarot Deck and Evolution Lab next to the mechanic upgrades, all refundable at 100%', () => {
    for (const id of ['charm_belt', 'tarot_deck', 'evolution_lab']) expect(UPGRADES.some(u => u.id === id)).toBe(true);
    expect(UPGRADES.find(u => u.id === 'evolution_lab')!.costs).toHaveLength(3);

    const armory = CAMPAIGN_WEAPONS.slice(0, 1);
    let save: AdventureSave = {
      ...createNewSave(),
      coins: 20000,
      lifetimeCoins: 20000,
      workshopUnlocked: true,
      armory,
      unlockedArcana: ARCANA.slice(0, 2).map(a => a.id),
      unlockedEvolutions: EVOLUTION_RECIPES.slice(0, 1).map(r => r.id),
      stars: ALL_MAIN_STARS,
    };
    expect(refundableCoins(save)).toBe(0);
    expect(refundAllCamp(save)).toBe(save);

    for (const u of getUnlockedUpgrades(save)) save = buyUpgrade(save, u.id);
    save = buyTuning(save, armory[0], Object.keys(getArmoryWeapon(armory[0])!.effects)[0]);
    const spent = 20000 - save.coins;
    expect(spent).toBeGreaterThan(0);
    expect(refundableCoins(save)).toBe(spent);
    expect(upgradeTier(save, 'charm_belt')).toBe(1);
    expect(upgradeSpentCoins(save, 'charm_belt')).toBe(300);
    expect(tuningSpent(save, armory[0])).toBe(60);

    const respec = refundAllCamp(save);
    expect(respec.coins).toBe(20000);
    expect(respec.lifetimeCoins).toBe(20000);
    expect(respec.upgrades).toEqual({});
    expect(respec.weaponTuning).toEqual({});
  });

  it('stays locked until the Workshop feature is unlocked, and tuning needs the weapon', () => {
    const armory = ['blast-powder'];
    const save: AdventureSave = { ...createNewSave(), coins: 5000, armory, stars: ALL_MAIN_STARS };
    expect(canBuyUpgrade(save, 'charm_belt')).toBe(false);
    expect(canTune(save, 'blast-powder', 'explosionChance')).toBe(false);
    const open = { ...save, workshopUnlocked: true };
    expect(canTune(open, 'blast-powder', 'explosionChance')).toBe(true);
    expect(canTune(open, 'blast-powder', 'noSuchStat')).toBe(false);
    expect(canTune(open, 'echo-stone', 'echoChance')).toBe(false);
    expect(buyTuning(open, 'echo-stone', 'echoChance')).toBe(open);
  });
});

describe('Weapon levels (found in the world) and tuning (Workshop)', () => {
  /** Main-path levels whose star rewards name this weapon, in campaign order. */
  const sourcesOf = (id: string) =>
    MAIN_LEVELS.flatMap(l => starRewards(l).flatMap((r, i) => ((r.weapons ?? []).includes(id) ? [{ level: l, star: i + 1 }] : [])));

  /** Earn the given star on a level (and every star before it) with a save that has stars up to there. */
  const earn = (save: AdventureSave, levelId: string, star: number) =>
    applyLevelResult({ ...save, stars: { ...save.stars, [levelId]: star - 1 } }, getLevel(levelId), star, 0);

  it('no reward names a merged copy, a Mastery weapon or a bundle; no weapon is found more than 5 times', () => {
    const named = [...LEVELS.flatMap(l => starRewards(l)), ...BOUNTIES.map(b => b.reward)].flatMap(r => r.weapons ?? []);
    for (const id of named) expect(getArmoryWeapon(id)?.id).toBe(id);
    expect(named.filter(id => /-(common|rare|legendary)$/.test(id))).toEqual([]);
    expect(named.filter(id => id.includes('mastery'))).toEqual([]);
    const counts = new Map<string, number>();
    for (const id of named) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [, n] of counts) expect(n).toBeLessThanOrEqual(5);
  });

  it('the first copy found unlocks the weapon; each later one is +1 level, with a reveal', () => {
    const [first, second] = sourcesOf('blast-powder');
    const a = earn(createNewSave(), first.level.id, first.star);
    expect(a.save.armory).toContain('blast-powder');
    expect(a.unlocks.find(u => u.kind === 'weapon')).toMatchObject({ id: 'blast-powder', firstWeapon: true });
    expect(weaponLevel(a.save, 'blast-powder')).toBe(1);

    const b = earn(a.save, second.level.id, second.star);
    expect(b.save.armory.filter(id => id === 'blast-powder')).toHaveLength(1);
    expect(weaponLevel(b.save, 'blast-powder')).toBe(2);
    expect(b.unlocks.find(u => u.kind === 'weapon')).toMatchObject({ id: 'blast-powder', level: 2 });
    expect(getArmoryWeapon('blast-powder', weaponBuilds(b.save))!.effects.explosionChance).toBe(18);
    // Levels are not purchases: nothing to refund
    expect(refundableCoins(b.save)).toBe(0);

    // Loading the save again (which re-grants every earned reward) never stacks the level twice
    const reloaded = reconcileUnlocks(reconcileUnlocks(b.save));
    expect(weaponLevel(reloaded, 'blast-powder')).toBe(2);
    expect(reloaded.coins).toBe(b.save.coins);
  });

  it('tuning multiplies one number of the levelled weapon, tier by tier, and refunds in full', () => {
    const [first, second] = sourcesOf('blast-powder');
    let save = earn(createNewSave(), first.level.id, first.star).save;
    save = { ...earn(save, second.level.id, second.star).save, workshopUnlocked: true, coins: 5000 };
    for (let i = 0; i < 4; i++) save = buyTuning(save, 'blast-powder', 'explosionChance');
    expect(5000 - save.coins).toBe(60 + 150 + 320 + 600);
    expect(canTune(save, 'blast-powder', 'explosionChance')).toBe(false);
    const w = getArmoryWeapon('blast-powder', weaponBuilds(save))!;
    // Level 2: 18% blast ×1.5; damage per card untouched (+1)
    expect(w.effects.explosionChance).toBe(27);
    expect(w.effects.explosionDamage).toBe(1);
    // A later copy found raises the base; the multiplier keeps applying
    const third = sourcesOf('blast-powder')[2];
    const leveled = earn(save, third.level.id, third.star).save;
    expect(getArmoryWeapon('blast-powder', weaponBuilds(leveled))!.effects.explosionChance).toBe(36);
    expect(tuningSpent(save, 'blast-powder')).toBe(1130);
    expect(refundAllCamp(save).coins).toBe(5000);
  });

  it('migrates old weapon ids: copies merge, stronger copies set a level floor, bundles become their main weapon, Workshop levels are refunded', () => {
    const old: AdventureSave = {
      ...createNewSave(),
      coins: 1000,
      armory: ['blast-powder-common', 'blast-powder-rare', 'inferno-charge', 'explosion-mastery', 'war-drum-rare', 'oracle-eye-rare', 'entropy-engine'],
      charms: ['blast-powder-rare', 'blast-powder-common', 'explosion-mastery'],
      weaponUpgrades: { 'blast-powder-common': 1, 'inferno-charge': 2, 'explosion-mastery': 1 },
    };
    const m = migrateSave(old);
    expect(m.armory).toEqual(['blast-powder', 'war-drum', 'oracle-eye', 'chaos-shard']);
    expect(m.charms).toEqual(['blast-powder']);
    expect(m.legacyWeaponTiers).toEqual({ 'blast-powder': 2, 'war-drum': 1, 'oracle-eye': 2, 'chaos-shard': 2 });
    expect(m.weaponUpgrades).toEqual({});
    // Blast Powder (common) tier 1, Inferno Charge (epic) tiers 1-2 and Explosion Mastery (rare) tier 1, at the prices paid
    expect(m.coins).toBe(1000 + 80 + 180 + 380 + 120);
    expect(migrateSave(m)).toEqual(m);

    const loaded = reconcileUnlocks(old);
    expect(weaponLevel(loaded, 'blast-powder')).toBe(3);
    expect(weaponLevel(loaded, 'war-drum')).toBe(2);
  });

  it('loadAdventureSave writes a migrated weapon save back once', () => {
    mockKvStore.clear();
    const stored = { ...createNewSave(), coins: 10, armory: ['flint-spark-rare'], charms: ['flint-spark-rare'], weaponUpgrades: { 'flint-spark-rare': 1 } };
    mockKvStore.set('adventure_v2_save', JSON.stringify(stored));
    const loaded = loadAdventureSave();
    expect(loaded.armory).toEqual(['flint-spark']);
    expect(loaded.coins).toBe(10 + 120);
    expect(JSON.parse(mockKvStore.get('adventure_v2_save')!).armory).toEqual(['flint-spark']);
    expect(loadAdventureSave().coins).toBe(loaded.coins);
  });
});

describe('Evolutions armed by charms', () => {
  it('a recipe is armed when the weapons hold one of each family, and only once it is unlocked', () => {
    for (const r of EVOLUTION_RECIPES) {
      expect(r.families).toHaveLength(2);
      const a = r.families[0][0];
      const b = r.families[1][0];
      expect(recipesArmedBy([a, b], [r.id]).map(x => x.id)).toEqual([r.id]);
      expect(recipesArmedBy([a], [r.id])).toEqual([]);
      expect(recipesArmedBy([a, b], [])).toEqual([]);
    }
  });

  it('armedRecipes reads the equipped charms of a save', () => {
    const recipe = EVOLUTION_RECIPES.find(r =>
      r.families.every(f => CAMPAIGN_WEAPONS.some(id => f.some(p => id === p || id.startsWith(`${p}-`))))
    )!;
    expect(recipe).toBeDefined();
    const ids = recipe.families.map(f => CAMPAIGN_WEAPONS.find(id => f.some(p => id === p || id.startsWith(`${p}-`)))!);
    const save: AdventureSave = { ...createNewSave(), armory: ids, charms: ids, unlockedEvolutions: [recipe.id] };
    expect(armedRecipes(save).map(x => x.id)).toEqual([recipe.id]);
    expect(armedRecipes({ ...save, charms: [ids[0]] })).toEqual([]);
  });
});

describe('Rewards & unlocks', () => {
  it('every reward points at a real weapon, fighter, Arcana and recipe; all of them can be won', () => {
    const arcana = new Set<string>();
    const recipes = new Set<string>();
    const check = (r: { weapons?: string[]; character?: string; arcana?: ArcanaId; evolution?: string }) => {
      for (const id of r.weapons ?? []) expect(getArmoryWeapon(id)).toBeDefined();
      if (r.character) expect(FIGHTERS.find(f => f.name === r.character)).toBeDefined();
      if (r.arcana) {
        expect(getArcana(r.arcana)).toBeDefined();
        arcana.add(r.arcana);
      }
      if (r.evolution) {
        expect(EVOLUTION_RECIPES.find(x => x.id === r.evolution)).toBeDefined();
        recipes.add(r.evolution);
      }
    };
    LEVELS.forEach(l => starRewards(l).forEach(check));
    BOUNTIES.forEach(b => check(b.reward));
    expect(arcana.size).toBe(ARCANA.length);
    expect(recipes.size).toBe(EVOLUTION_RECIPES.length);
  });

  it('branches open at ★★ on their parent, even when the parent is itself a branch', () => {
    const branches = LEVELS.filter(l => l.branchOf);
    expect(branches.length).toBeGreaterThan(0);
    for (const b of branches) {
      const parentId = b.branchOf!;
      const save: AdventureSave = { ...createNewSave(), stars: { ...ALL_MAIN_STARS } };
      expect(getLockReason({ ...save, stars: { ...save.stars, [parentId]: 1 } }, b)).toEqual(expect.objectContaining({ kind: 'branch', parentId }));
      expect(getLockReason({ ...save, stars: { ...save.stars, [parentId]: 2 } }, b)).toBeNull();
    }
  });

  it('createMaxedSave unlocks everything, maxes the Workshop and leaves every star unspent', () => {
    const maxed = createMaxedSave();
    expect(maxed.unlockedFighters).toHaveLength(FIGHTERS.length);
    expect(maxed.unlockedArcana).toHaveLength(ARCANA.length);
    expect(maxed.unlockedEvolutions).toHaveLength(EVOLUTION_RECIPES.length);
    expect(maxed.skillNodes).toEqual({});
    expect(availableStars(maxed)).toBe(LEVELS.length * 3);
    expect(charmSlots(maxed)).toBe(MAX_CHARM_SLOTS);
    expect(arcanaSlots(maxed)).toBe(MAX_ARCANA_SLOTS);
    expect(equippedCharms(maxed)).toHaveLength(Math.min(MAX_CHARM_SLOTS, maxed.armory.length));
    for (const u of UPGRADES) expect(upgradeTier(maxed, u.id)).toBe(u.costs.length);
    expect(maxed.workshopUnlocked && maxed.bountiesUnlocked && maxed.coinsUnlocked).toBe(true);
  });

  it('reconcileUnlocks grants what earned stars now unlock without paying coins twice', () => {
    const level = LEVELS.find(l => starRewards(l).some(r => r.weapons?.length || r.character))!;
    const save: AdventureSave = { ...createNewSave(), stars: { [level.id]: 3 } };
    const reconciled = reconcileUnlocks(save);
    for (const r of starRewards(level)) {
      for (const id of r.weapons ?? []) expect(reconciled.armory).toContain(id);
      if (r.character) expect(reconciled.unlockedFighters).toContain(r.character);
    }
    expect(reconciled.coins).toBe(save.coins);
    expect(reconcileUnlocks(reconciled)).toEqual(reconciled);
  });
});

describe('Cross-run bounties', () => {
  const unlockLevel = getLevel(CAMPAIGN_FEATURES.bounties.clearLevel!);

  it('stay locked until their level is cleared, then pay out once', () => {
    let save = createNewSave();
    expect(save.bountiesUnlocked).toBe(false);
    const r = applyLevelResult(save, unlockLevel, 1, 0);
    save = r.save;
    expect(save.bountiesUnlocked).toBe(true);
    expect(r.unlocks.some(u => u.kind === 'feature' && u.feature === 'bounties')).toBe(true);

    const boosted = { ...save, bountyStats: { ...save.bountyStats, totalSets: 100000 } };
    const bounty = BOUNTIES.find(b => !save.completedBounties.includes(b.id) && b.progress(save) < b.target && b.progress(boosted) >= b.target);
    expect(bounty).toBeDefined();
    const done = applyLevelResult(boosted, unlockLevel, 1, 0);
    expect(done.completedBounties.map(b => b.id)).toContain(bounty!.id);
    expect(done.bountyCoins).toBeGreaterThanOrEqual(bounty!.reward.coins);
    const again = applyLevelResult(done.save, unlockLevel, 1, 0);
    expect(again.completedBounties.map(b => b.id)).not.toContain(bounty!.id);
    expect(again.bountyCoins).toBe(0);
  });
});
