/**
 * 200-Bounty Weapon-Linked Progression Web verification:
 *  - Exact 200 bounties (192 weapon-linked [64 × 3] + 8 general)
 *  - Verified ICON_REGISTRY icons, unique IDs/names, exact 192/192 evolution bijection
 *  - Formal BFS DAG reachability proof (64/64 weapons + 192/192 evos reachable, 0 cycles, 0 deadlocks)
 *  - `requiresWeapon` gating, single-fight vs cumulative `FightMetrics` evaluation, cross-weapon unlocks,
 *    and automatic first-evolution equipping on unlock.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon } from '@/adventure/data/armory';
import {
  BOUNTIES,
  BOUNTY_BY_ID,
  BOUNTY_EXCLUSIVE_L1,
  BOUNTY_EXCLUSIVE_L2,
  BOUNTY_EXCLUSIVE_WEAPON_IDS,
  GENERAL_BOUNTIES,
  WEAPON_BOUNTIES,
  bountyForEvolution,
  getWeaponBounties,
  isBountyExclusiveWeapon,
  isBountyUnlocked,
  weaponUnlockBountiesFor,
} from '@/adventure/data/bounties';
import { WEAPON_EVOLUTIONS, getWeaponEvolution } from '@/adventure/data/evolutions';
import { LEVELS, getLevel } from '@/adventure/data/levels';
import { starRewards } from '@/adventure/data/rewards';
import { createInitialFightMetrics } from '@/adventure/data/synergy';
import {
  STARTER_EVOLUTION_ID,
  applyLevelResult,
  createNewSave,
  equippedEvolutionOf,
} from '@/adventure/progress';
import { createRun } from '@/adventure/engine/run';
import type { AdventureSave, FightMetrics, RunState } from '@/adventure/types';

const ICON_SRC = fs.readFileSync(path.resolve(__dirname, '../src/components/Icon.tsx'), 'utf8');
const ICON_REGISTRY_BLOCK = ICON_SRC.slice(ICON_SRC.indexOf('const ICON_REGISTRY'));
const VALID_ICONS = new Set([...ICON_REGISTRY_BLOCK.matchAll(/^\s*'([^']+)':/gm)].map(m => m[1]));

describe('200-Bounty Progression Web — Catalog & Bijection Integrity', () => {
  it('contains exactly 200 unique bounties (192 weapon-linked [64 × 3] + 8 general) with valid icons & targets', () => {
    expect(BOUNTIES).toHaveLength(200);
    expect(BOUNTY_BY_ID.size).toBe(200);
    expect(WEAPON_BOUNTIES).toHaveLength(192);
    expect(GENERAL_BOUNTIES).toHaveLength(8);
    expect(BOUNTY_EXCLUSIVE_L1).toHaveLength(14);
    expect(BOUNTY_EXCLUSIVE_L2).toHaveLength(2);
    expect(BOUNTY_EXCLUSIVE_WEAPON_IDS).toHaveLength(16);

    const ids = new Set<string>();
    const names = new Set<string>();
    for (const b of BOUNTIES) {
      expect(ids.has(b.id)).toBe(false);
      ids.add(b.id);
      expect(names.has(b.name)).toBe(false);
      names.add(b.name);
      expect(VALID_ICONS.has(b.icon)).toBe(true);
      expect(b.description.length).toBeGreaterThan(8);
      expect(b.target).toBeGreaterThan(0);
      expect(b.reward.coins).toBeGreaterThan(0);
      if (b.requiresWeapon) {
        expect(getArmoryWeapon(b.requiresWeapon)).toBeDefined();
        expect([1, 2, 3]).toContain(b.tier);
      } else {
        expect(b.tier).toBe(0);
      }
      for (const wId of b.reward.weapons ?? []) {
        expect(getArmoryWeapon(wId)).toBeDefined();
      }
      if (b.reward.evolution) {
        expect(getWeaponEvolution(b.reward.evolution)).toBeDefined();
      }
    }

    // Every one of the 64 Armory weapons owns exactly 3 weapon-linked bounties (tiers 1, 2, 3)
    for (const wId of ALL_ARMORY_WEAPON_IDS) {
      const wb = getWeaponBounties(wId);
      expect(wb).toHaveLength(3);
      expect(wb.map(b => b.tier)).toEqual([1, 2, 3]);
    }
  });

  it('forms an exact 192/192 bijection across the 1-10 ★1 starter evolution + 191 bounty evolution rewards', () => {
    const unlockedEvos = new Map<string, string>();
    // 1-10 ★1 grants STARTER_EVOLUTION_ID
    const w1Boss = getLevel('1-10');
    const bossEvos = starRewards(w1Boss).map(r => r.evolution).filter((e): e is string => Boolean(e));
    expect(bossEvos).toContain(STARTER_EVOLUTION_ID);
    unlockedEvos.set(STARTER_EVOLUTION_ID, '1-10:star1');

    let bountyEvoCount = 0;
    for (const b of BOUNTIES) {
      if (!b.reward.evolution) continue;
      bountyEvoCount += 1;
      expect(unlockedEvos.has(b.reward.evolution)).toBe(false);
      unlockedEvos.set(b.reward.evolution, b.id);
      expect(bountyForEvolution(b.reward.evolution)?.id).toBe(b.id);
    }

    expect(bountyEvoCount).toBe(191);
    expect(unlockedEvos.size).toBe(192);
    for (const evo of WEAPON_EVOLUTIONS) {
      expect(unlockedEvos.has(evo.id)).toBe(true);
    }
  });

  it('proves via formal BFS DAG reachability that 64/64 weapons, 192/192 evos & 200/200 bounties are reachable with 0 cycles & 0 deadlocks', () => {
    // Layer 0: All weapons granted by Campaign star rewards (48) + starter evolution on 1-10
    const campaignWeapons = new Set<string>(
      LEVELS.flatMap(l => starRewards(l).flatMap(r => r.weapons ?? []))
    );
    expect(campaignWeapons.size).toBe(48);

    // Every Bounty-Exclusive weapon must NOT appear in campaign star rewards
    for (const exId of BOUNTY_EXCLUSIVE_WEAPON_IDS) {
      expect(campaignWeapons.has(exId)).toBe(false);
      expect(isBountyExclusiveWeapon(exId)).toBe(true);
      expect(weaponUnlockBountiesFor(exId).length).toBeGreaterThanOrEqual(1);
    }

    // Build weapon dependency layers via BFS from Layer 0 (campaign weapons + weapon-free general bounties)
    const ownedWeapons = new Set<string>(campaignWeapons);
    const ownedEvos = new Set<string>([STARTER_EVOLUTION_ID]);
    const completed = new Set<string>();
    const weaponLayer = new Map<string, number>();
    for (const w of campaignWeapons) weaponLayer.set(w, 0);

    let wave = 0;
    let progressed = true;
    while (progressed) {
      progressed = false;
      wave += 1;
      const newlyUnlockedWeapons: string[] = [];
      for (const b of BOUNTIES) {
        if (completed.has(b.id)) continue;
        if (b.requiresWeapon && !ownedWeapons.has(b.requiresWeapon)) continue;
        completed.add(b.id);
        progressed = true;
        if (b.reward.evolution) ownedEvos.add(b.reward.evolution);
        for (const w of b.reward.weapons ?? []) {
          if (!ownedWeapons.has(w)) {
            newlyUnlockedWeapons.push(w);
            const parentLayer = b.requiresWeapon ? (weaponLayer.get(b.requiresWeapon) ?? 0) : 0;
            weaponLayer.set(w, parentLayer + 1);
          }
        }
      }
      for (const w of newlyUnlockedWeapons) ownedWeapons.add(w);
      expect(wave).toBeLessThanOrEqual(5); // Bounded DAG depth, never infinite
    }

    // 100% reachability: 64/64 weapons, 192/192 evolutions, 200/200 bounties!
    expect(ownedWeapons.size).toBe(64);
    for (const id of ALL_ARMORY_WEAPON_IDS) expect(ownedWeapons.has(id)).toBe(true);
    expect(ownedEvos.size).toBe(192);
    expect(completed.size).toBe(200);

    // Strict layered DAG verification: L1 exclusives at layer 1, L2 capstones at layer 2 (0 cycles!)
    for (const wId of BOUNTY_EXCLUSIVE_L1) {
      expect(weaponLayer.get(wId)).toBe(1);
    }
    for (const wId of BOUNTY_EXCLUSIVE_L2) {
      expect(weaponLayer.get(wId)).toBe(2);
    }

    // Verify no bounty dependency cycle exists in the Bounty-Exclusive subgraph
    const adj = new Map<string, string[]>();
    for (const b of BOUNTIES) {
      if (!b.requiresWeapon) continue;
      for (const granted of b.reward.weapons ?? []) {
        if (!isBountyExclusiveWeapon(granted)) continue;
        const list = adj.get(b.requiresWeapon) ?? [];
        list.push(granted);
        adj.set(b.requiresWeapon, list);
      }
    }
    const color = new Map<string, 0 | 1 | 2>(); // 0=unvisited, 1=visiting, 2=done
    const hasCycle = (u: string): boolean => {
      color.set(u, 1);
      for (const v of adj.get(u) ?? []) {
        if (color.get(v) === 1) return true;
        if ((color.get(v) ?? 0) === 0 && hasCycle(v)) return true;
      }
      color.set(u, 2);
      return false;
    };
    for (const wId of ALL_ARMORY_WEAPON_IDS) {
      if ((color.get(wId) ?? 0) === 0) {
        expect(hasCycle(wId)).toBe(false);
      }
    }
  });
});

describe('200-Bounty Progression Web — Runtime Gating, Tracking & Auto-Equip', () => {
  const mkRunWithMetrics = (save: AdventureSave, partialMetrics: Partial<FightMetrics>): RunState => {
    const level = getLevel('1-10');
    const run = createRun(level, save, { seed: 42 });
    return {
      ...run,
      fightMetrics: {
        ...createInitialFightMetrics(run.board.length),
        ...partialMetrics,
      },
    };
  };

  it('strictly enforces requiresWeapon ownership AND equipped status in-fight', () => {
    const level = getLevel('1-10');
    const b1 = BOUNTY_BY_ID.get('bounty_blast_powder_1')!;
    expect(b1.requiresWeapon).toBe('blast-powder');

    // 1. Unowned weapon -> bounty locked & never advances
    const unownedSave: AdventureSave = {
      ...createNewSave(),
      bountiesUnlocked: true,
      armory: ['flint-spark'],
      charms: ['flint-spark'],
    };
    expect(isBountyUnlocked(unownedSave, b1)).toBe(false);
    const rUnowned = applyLevelResult(unownedSave, level, 1, 0, mkRunWithMetrics(unownedSave, { blasts: 10 }));
    expect(rUnowned.save.completedBounties).not.toContain(b1.id);
    expect(rUnowned.save.bountyProgress[b1.id]).toBeUndefined();

    // 2. Owned weapon, NOT equipped in-fight -> unlocked on board, but does NOT advance during this fight
    const unequippedSave: AdventureSave = {
      ...createNewSave(),
      bountiesUnlocked: true,
      armory: ['blast-powder', 'flint-spark'],
      charms: ['flint-spark'],
    };
    expect(isBountyUnlocked(unequippedSave, b1)).toBe(true);
    const rUnequipped = applyLevelResult(unequippedSave, level, 1, 0, mkRunWithMetrics(unequippedSave, { blasts: 10 }));
    expect(rUnequipped.save.completedBounties).not.toContain(b1.id);
    expect(rUnequipped.save.bountyProgress[b1.id]).toBeUndefined();

    // 3. Owned AND equipped in-fight -> completes, unlocks cross-weapon `chaos-conduit` & pays coins!
    const equippedSave: AdventureSave = {
      ...createNewSave(),
      bountiesUnlocked: true,
      armory: ['blast-powder'],
      charms: ['blast-powder'],
    };
    const rEq = applyLevelResult(equippedSave, level, 1, 0, mkRunWithMetrics(equippedSave, { blasts: 5 }));
    expect(rEq.completedBounties.map(b => b.id)).toContain(b1.id);
    expect(rEq.save.completedBounties).toContain(b1.id);
    expect(rEq.save.armory).toContain('chaos-conduit');
    // Newly unlocked weapon auto-equips into a free charm slot!
    expect(rEq.save.charms).toContain('chaos-conduit');
  });

  it('tracks single-fight peaks vs cumulative progress cleanly and auto-equips a weapon’s first unlocked evolution', () => {
    const level = getLevel('1-10');
    // rainbow-charm T1 is cumulative (5 rainbows across fights -> unlocks rainbow-charm:spectrum-flare)
    // rainbow-charm T2 is single_fight (4 rainbows in one fight -> unlocks collectors-album + collectors-album:foil-edition)
    const t1 = BOUNTY_BY_ID.get('bounty_rainbow_charm_1')!;
    const t2 = BOUNTY_BY_ID.get('bounty_rainbow_charm_2')!;
    expect(t1.scope).toBe('cumulative');
    expect(t2.scope).toBe('single_fight');

    let save: AdventureSave = {
      ...createNewSave(),
      bountiesUnlocked: true,
      armory: ['rainbow-charm'],
      charms: ['rainbow-charm'],
      stars: { '1-10': 1 }, // already cleared so star rewards don't confuse bounty checks
    };

    // Fight 1: 3 Rainbows -> T1 accumulates 3/5, T2 records single-fight best 3/4 (neither completes yet)
    const f1 = applyLevelResult(save, level, 1, 0, mkRunWithMetrics(save, { rainbows: 3 }));
    save = f1.save;
    expect(save.bountyProgress[t1.id]).toBe(3);
    expect(save.bountyProgress[t2.id]).toBe(3);
    expect(save.completedBounties).not.toContain(t1.id);
    expect(save.completedBounties).not.toContain(t2.id);

    // Fight 2: 2 Rainbows -> T1 hits 3+2=5 (completes!), T2 stays at peak 3/4 (does NOT sum to 5!)
    const f2 = applyLevelResult(save, level, 1, 0, mkRunWithMetrics(save, { rainbows: 2 }));
    save = f2.save;
    expect(f2.completedBounties.map(b => b.id)).toContain(t1.id);
    expect(save.completedBounties).toContain(t1.id);
    expect(save.bountyProgress[t1.id]).toBeUndefined(); // cleared once complete
    expect(save.completedBounties).not.toContain(t2.id);
    expect(save.bountyProgress[t2.id]).toBe(3);
    // First unlocked evolution for rainbow-charm auto-equips immediately!
    expect(save.unlockedWeaponEvolutions).toContain('rainbow-charm:spectrum-flare');
    expect(equippedEvolutionOf(save, 'rainbow-charm')).toBe('rainbow-charm:spectrum-flare');

    // Fight 3: 4 Rainbows in a single fight -> T2 completes, unlocks collectors-album + auto-equips its evolution!
    const f3 = applyLevelResult(save, level, 1, 0, mkRunWithMetrics(save, { rainbows: 4 }));
    save = f3.save;
    expect(f3.completedBounties.map(b => b.id)).toContain(t2.id);
    expect(save.armory).toContain('collectors-album');
    expect(save.unlockedWeaponEvolutions).toContain('collectors-album:foil-edition');
    expect(equippedEvolutionOf(save, 'collectors-album')).toBe('collectors-album:foil-edition');

    // Re-running does not double-complete or double-pay coins
    const f4 = applyLevelResult(save, level, 1, 0, mkRunWithMetrics(save, { rainbows: 4 }));
    expect(f4.completedBounties.map(b => b.id)).not.toContain(t2.id);
    expect(f4.bountyCoins).toBe(0);
  });
});
