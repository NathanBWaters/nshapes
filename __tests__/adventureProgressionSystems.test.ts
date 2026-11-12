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
import { SKILL_NODES, skillTreeOf } from '@/adventure/data/skillTrees';
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
  branchDepth,
  buyNode,
  buyUpgrade,
  buyWeaponUpgrade,
  canBuyNode,
  canBuyUpgrade,
  canUpgradeWeapon,
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
  refundBranch,
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
  weaponUpgradeSpentCoins,
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

const branch = (fighter: CharacterName, b: 0 | 1): SkillNode[] =>
  skillTreeOf(fighter).filter(n => n.branch === b).sort((x, y) => x.depth - y.depth);

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

  it('loadAdventureSave migrates a stored v1 save, keeps weapon upgrade tiers, and writes it back once', () => {
    mockKvStore.clear();
    const stored: Record<string, unknown> = { ...v1(), weaponUpgrades: { [CAMPAIGN_WEAPONS[0]]: 2 } };
    // A real v1 save has none of the new fields
    delete stored.charms;
    delete stored.equippedArcana;
    delete stored.skillNodes;
    mockKvStore.set('adventure_v2_save', JSON.stringify(stored));
    const loaded = loadAdventureSave();
    expect(loaded.coins).toBe(100 + REFUND);
    expect(loaded.charms).toEqual([CAMPAIGN_WEAPONS[1]]);
    expect(loaded.equippedArcana).toEqual([ARCANA[0].id]);
    expect(loaded.skillNodes).toEqual({});
    expect(loaded.weaponUpgrades).toEqual({ [CAMPAIGN_WEAPONS[0]]: 2 });
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
    const [n1, n2] = branch(fighter, 0);
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
  it('every fighter has two branches of 10 nodes with the spec cost curve (28 per branch)', () => {
    const DEPTH_COSTS = [1, 1, 1, 2, 2, 3, 3, 4, 5, 6];
    for (const f of FIGHTERS) {
      expect(skillTreeOf(f.name)).toHaveLength(20);
      for (const b of [0, 1] as const) {
        const chain = branch(f.name, b);
        expect(chain.map(n => n.depth)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(chain.map(n => n.cost)).toEqual(DEPTH_COSTS);
      }
    }
    expect(new Set(SKILL_NODES.map(n => n.id)).size).toBe(SKILL_NODES.length);
  });

  it('buys in order only: depth 1 first, never skipping, never past the stars you have', () => {
    const fighter: CharacterName = 'Orange Tabby';
    const chain = branch(fighter, 0);
    let save = withStars(createNewSave(), 4);

    expect(nodeStatus(save, chain[0].id)).toBe('buyable');
    expect(nodeStatus(save, chain[1].id)).toBe('needsParent');
    expect(canBuyNode(save, chain[1].id)).toBe(false);
    expect(buyNode(save, chain[1].id)).toBe(save);

    save = buyNode(save, chain[0].id);
    expect(nodeStatus(save, chain[0].id)).toBe('owned');
    expect(branchDepth(save, fighter, 0)).toBe(1);
    // Buying an owned node again changes nothing
    expect(buyNode(save, chain[0].id)).toBe(save);

    save = buyNode(save, chain[1].id);
    save = buyNode(save, chain[2].id);
    expect(branchDepth(save, fighter, 0)).toBe(3);
    expect(availableStars(save)).toBe(1);
    // Depth 4 costs 2: not enough stars
    expect(nodeStatus(save, chain[3].id)).toBe('needsStars');
    expect(buyNode(save, chain[3].id)).toBe(save);
    // The other branch only needs its passive
    expect(nodeStatus(save, branch(fighter, 1)[0].id)).toBe('buyable');
  });

  it('locked fighters cannot buy nodes', () => {
    const locked = FIGHTERS.find(f => !createNewSave().unlockedFighters.includes(f.name))!;
    const save = withStars(createNewSave(), 20);
    expect(nodeStatus(save, branch(locked.name, 0)[0].id)).toBe('fighterLocked');
  });

  it('refunds whole branches (tip down) and whole fighters for free', () => {
    const fighter: CharacterName = 'Orange Tabby';
    let save = withStars(createNewSave(), 60);
    for (const n of branch(fighter, 0).slice(0, 5)) save = buyNode(save, n.id);
    for (const n of branch(fighter, 1).slice(0, 3)) save = buyNode(save, n.id);
    const spentB0 = branch(fighter, 0).slice(0, 5).reduce((a, n) => a + n.cost, 0);
    const spentB1 = branch(fighter, 1).slice(0, 3).reduce((a, n) => a + n.cost, 0);
    expect(starsSpent(save)).toBe(spentB0 + spentB1);

    const afterBranch = refundBranch(save, fighter, 0);
    expect(branchDepth(afterBranch, fighter, 0)).toBe(0);
    expect(branchDepth(afterBranch, fighter, 1)).toBe(3);
    expect(availableStars(afterBranch)).toBe(60 - spentB1);

    const afterFighter = refundFighter(save, fighter);
    expect(afterFighter.skillNodes[fighter]).toBeUndefined();
    expect(availableStars(afterFighter)).toBe(60);
  });

  it('reconcileUnlocks drops nodes with a missing parent and hands back everything if the trees cost more than earned', () => {
    const fighter: CharacterName = 'Orange Tabby';
    const chain = branch(fighter, 0);
    const broken: AdventureSave = { ...withStars(createNewSave(), 30), skillNodes: { [fighter]: [chain[0].id, chain[2].id, 'no-such-node'] } };
    expect(reconcileUnlocks(broken).skillNodes).toEqual({ [fighter]: [chain[0].id] });

    const overspent: AdventureSave = { ...withStars(createNewSave(), 2), skillNodes: { [fighter]: chain.slice(0, 4).map(n => n.id) } };
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
    save = buyWeaponUpgrade(save, armory[0]);
    const spent = 20000 - save.coins;
    expect(spent).toBeGreaterThan(0);
    expect(refundableCoins(save)).toBe(spent);
    expect(upgradeTier(save, 'charm_belt')).toBe(1);
    expect(upgradeSpentCoins(save, 'charm_belt')).toBe(300);
    expect(weaponUpgradeSpentCoins(save, armory[0])).toBeGreaterThan(0);

    const respec = refundAllCamp(save);
    expect(respec.coins).toBe(20000);
    expect(respec.lifetimeCoins).toBe(20000);
    expect(respec.upgrades).toEqual({});
    expect(respec.weaponUpgrades).toEqual({});
  });

  it('stays locked until the Workshop feature is unlocked, and weapon upgrades need the weapon', () => {
    const armory = CAMPAIGN_WEAPONS.slice(0, 1);
    const save: AdventureSave = { ...createNewSave(), coins: 5000, armory, stars: ALL_MAIN_STARS };
    expect(canBuyUpgrade(save, 'charm_belt')).toBe(false);
    expect(canUpgradeWeapon(save, armory[0])).toBe(false);
    const open = { ...save, workshopUnlocked: true };
    expect(canUpgradeWeapon(open, armory[0])).toBe(true);
    expect(canUpgradeWeapon(open, CAMPAIGN_WEAPONS[1])).toBe(false);
    expect(buyWeaponUpgrade(open, CAMPAIGN_WEAPONS[1])).toBe(open);
  });
});

describe('Evolutions armed by charms', () => {
  it('a recipe is armed when the weapons hold one of each family, and only once it is unlocked', () => {
    for (const r of EVOLUTION_RECIPES) {
      expect(r.families).toHaveLength(2);
      const a = `${r.families[0][0]}-common`;
      const b = `${r.families[1][0]}-rare`;
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
