/**
 * Starfall Summit — unit, map integrity, uniqueness invariants, event coverage, UI reuse, and persistence tests.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FIGHTERS } from '@/adventure/data/fighters';
import { ALL_ARMORY_WEAPON_IDS } from '@/adventure/data/armory';
import { ARCANA } from '@/adventure/data/arcana';
import { skillTreeOf } from '@/adventure/data/skillTrees';
import { getUpgrade } from '@/adventure/data/upgrades';
import { loadAdventureSave, writeAdventureSave } from '@/adventure/save';
import { createNewSave } from '@/adventure/progress';
import { generateActMap, reachableNodeIds } from '@/spire/engine/mapGen';
import { SPIRE_EVENTS } from '@/spire/data/events';
import {
  ACT_LEVEL_POOLS,
  SPIRE_WEAPON_POOL,
  STARTER_KITS,
  canonicalLevelEnemyName,
} from '@/spire/data/encounters';
import {
  ARCANA_PURGE_COST,
  MAX_SHOP_LOCKS,
  MAX_SUMMIT_WEAPONS,
  SPIRE_EXCLUDED_ARCANA,
  SPIRE_EXCLUDED_WEAPONS,
  SPIRE_SHOP_UPGRADE_IDS,
  advanceToNextAct,
  campfireForge,
  campfireMeditate,
  campfireRest,
  cancelSpirePreview,
  chooseEventOption,
  claimRewardArcana,
  claimRewardSkillNode,
  claimRewardWeapon,
  claimTreasure,
  completeSpireBattle,
  createSpireRun,
  enterEndlessSpire,
  grantSpireWeapon,
  isSpireUpgradeMaxed,
  leaveShop,
  maxSpireUpgradeTier,
  reorderSpireWeapon,
  replaceSpireWeapon,
  resolveEventPendingArcana,
  resolveEventPendingForge,
  resolveEventPendingSkill,
  resolveEventPendingWeapon,
  retreatSpireBattle,
  rollArcanaOptions,
  rollSkillNodeOptions,
  rollSynergyWeapons,
  selectSpireNode,
  shopBuyArcana,
  shopBuyUpgrade,
  shopBuyWeapon,
  shopPurgeArcana,
  shopReroll,
  shopSellWeapon,
  shopToggleLock,
  skipEventPendingWeapon,
  spireWeaponSellValue,
  startSpireEncounter,
} from '@/spire/engine/runState';
import { simulateSpireClimb } from '@/spire/engine/bot';
import {
  SPIRE_FIGHT_FEATURES,
  clashesWithBelt,
  spireArmedRecipes,
  spireEncounterLoadout,
  spireEncounterToLevel,
  spireHeldWeapons,
  spireRunOverrides,
  spireRunToVirtualSave,
} from '@/spire/engine/bridge';
import {
  createInitialSpireMeta,
  loadSpireRun,
  resetSpireStorage,
  syncSpireDiscoveriesToAdventure,
  writeSpireMeta,
  writeSpireRun,
} from '@/spire/save';
import { createRng } from '@/adventure/engine/rng';
import { createRun } from '@/adventure/engine/run';
import { simulateRun, BOTS } from '@/adventure/engine/bot';
import MainMenu from '@/components/MainMenu';
import SpireSetup from '@/spire/components/SpireSetup';
import SpireHeader from '@/spire/components/SpireHeader';
import SpireBeltBar from '@/spire/components/SpireBeltBar';
import SpireMap from '@/spire/components/SpireMap';
import SpireEncounterPreview from '@/spire/components/SpireEncounterPreview';
import SpireShop from '@/spire/components/SpireShop';
import SpireCampfire from '@/spire/components/SpireCampfire';
import SpireEvent from '@/spire/components/SpireEvent';
import SpireTreasure from '@/spire/components/SpireTreasure';
import SpireBuildModal from '@/spire/components/SpireBuildModal';
import SpireRewardScreen from '@/spire/components/SpireRewardScreen';
import SpireEndScreen from '@/spire/components/SpireEndScreen';

jest.mock('@/components/Icon', () => {
  const { Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});
jest.mock('@/components/enemies', () => {
  const { Text: RNText } = require('react-native');
  return { EnemyAvatar: ({ enemy }: { enemy: { name: string } }) => <RNText>{enemy.name}</RNText> };
});
jest.mock('@/components/fighters', () => {
  const { Text: RNText } = require('react-native');
  return {
    FighterAvatar: ({ character }: { character: string | { name: string } }) => (
      <RNText>{typeof character === 'string' ? character : character.name}</RNText>
    ),
  };
});
jest.mock('@/components/weapons', () => {
  const { Text: RNText } = require('react-native');
  return { WeaponAvatar: ({ weapon }: { weapon: { name: string } }) => <RNText>{weapon.name}</RNText> };
});

describe('Starfall Summit — Map DAG, Events & Shared Engine Bridge', () => {
  it('generates clean, deterministic, fully connected 7-row Act maps for Acts 1..4', () => {
    for (const act of [1, 2, 3, 4]) {
      const m1 = generateActMap(act, 12345, 0);
      const m2 = generateActMap(act, 12345, 0);
      expect(m1).toEqual(m2);
      expect(m1.rows).toBe(7);

      const boss = m1.nodes.find(n => n.kind === 'boss');
      expect(boss).toBeDefined();
      expect(boss?.row).toBe(6);
      expect(boss?.encounter?.parry).toBeDefined();

      // Every row 0..5 node has at least one valid outgoing edge, and all row 5 nodes reach the Boss
      const ids = new Set(m1.nodes.map(n => n.id));
      for (const n of m1.nodes) {
        if (n.row < 6) {
          expect(n.next.length).toBeGreaterThanOrEqual(1);
          for (const target of n.next) expect(ids.has(target)).toBe(true);
        }
        if (n.row === 5) expect(n.next).toEqual([boss!.id]);
      }
      expect(reachableNodeIds(m1, null)).toHaveLength(3);
    }
  });

  it('every fighter has a valid Level 2 starter kit that arms a Floor 1 Evolution in the shared pool', () => {
    for (const f of FIGHTERS) {
      const kit = STARTER_KITS[f.name];
      expect(kit).toBeDefined();
      expect(SPIRE_WEAPON_POOL).toContain(kit.starterWeapon);
      expect(SPIRE_WEAPON_POOL).toContain(kit.bonusWeapon);
      const run = createSpireRun(f.name, 0, 1001);
      expect(run.weaponLevels[kit.starterWeapon]).toBe(2);
      expect(run.weaponLevels[kit.bonusWeapon]).toBe(2);
      expect(spireArmedRecipes(run).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('runs item-driven Spire fights with zero generic Power scaling, stacking Evolution multipliers, and anti-bloat drafts', () => {
    let run = createSpireRun('Corgi', 0, 4242);
    const firstId = reachableNodeIds(run.map, null)[0];
    run = selectSpireNode(run, firstId);
    const enc = run.activeEncounter!;
    const overrides = spireRunOverrides(run);
    expect(overrides.powerScaling).toBe(0);
    expect(overrides.stackEvolutionMultipliers).toBe(true);

    const sim = simulateRun(spireEncounterToLevel(run, enc), spireRunToVirtualSave(run), BOTS.expert, 777, undefined, {
      skipPicks: true,
      features: new Set(SPIRE_FIGHT_FEATURES),
      overrides,
    });
    expect(sim.state.power).toBe(0);
    expect(sim.state.totalDamage).toBeGreaterThan(0);

    // First Skirmish win grants an early Fighter Skill Node draft
    const afterWin = completeSpireBattle(run, { ...sim.state, status: 'won', endReason: 'defeated', foeHp: 0 });
    expect(afterWin.phase).toBe('reward');
    expect(afterWin.reward?.skillOptions.length).toBeGreaterThan(0);

    // Drafts & Arcana exclude dead XP-only items (scholars-tome + wisdom-chain) and include upgrade offers for held weapons
    expect(SPIRE_EXCLUDED_WEAPONS.has('scholars-tome')).toBe(true);
    expect(SPIRE_EXCLUDED_WEAPONS.has('wisdom-chain')).toBe(true);
    const rng = createRng(12345);
    let sawUpgrade = false;
    for (let i = 0; i < 40; i++) {
      const offers = rollSynergyWeapons(run, rng, 3);
      expect(offers.some(o => o.weaponId === 'scholars-tome' || o.weaponId === 'wisdom-chain')).toBe(false);
      if (offers.some(o => run.weaponLevels[o.weaponId] !== undefined)) sawUpgrade = true;
    }
    expect(sawUpgrade).toBe(true);
    const arcanaPool = rollArcanaOptions({ arcana: [] }, createRng(99), 20);
    expect(arcanaPool).not.toContain('scholars_gambit');
  });

  it('fixes cancelSpirePreview (returns to map cleanly) and retreatSpireBattle (costs 1 ♥ or forfeits on 1 ♥)', () => {
    const start = createSpireRun('Orange Tabby', 0, 1234);
    const firstId = reachableNodeIds(start.map, null)[0];
    const inPreview = selectSpireNode(start, firstId);
    expect(inPreview.phase).toBe('preview');
    expect(inPreview.floor).toBe(1);

    // Backing out of pre-fight preview returns to 'map' and restores unvisited state
    const backedOut = cancelSpirePreview(inPreview);
    expect(backedOut.phase).toBe('map');
    expect(backedOut.activeEncounter).toBeNull();
    expect(backedOut.currentNodeId).toBeNull();
    expect(backedOut.floor).toBe(0);
    expect(backedOut.map.nodes.find(n => n.id === firstId)?.visited).toBe(false);

    // Entering combat commits the node; retreating costs 1 ♥ and increments retreats (new seed)
    const inFight = startSpireEncounter(inPreview);
    expect(inFight.phase).toBe('fight');
    const retreated = retreatSpireBattle(inFight, 'Lazy Sloth');
    expect(retreated.phase).toBe('preview');
    expect(retreated.hearts).toBe(inFight.hearts - 1);
    expect(retreated.retreats).toBe(1);

    // After retreating (or on an event ambush), cancelSpirePreview is a no-op — cannot skip a committed fight!
    expect(cancelSpirePreview(retreated)).toBe(retreated);
    const ambushPreview = {
      ...inPreview,
      prevNodeId: undefined,
      activeEncounter: { ...inPreview.activeEncounter!, id: 'ambush-1' },
    };
    expect(cancelSpirePreview(ambushPreview)).toBe(ambushPreview);

    // Retreating at 1 ♥ forfeits cleanly to defeat (no infinite save-scumming!)
    const atOneHeart = { ...inFight, hearts: 1 };
    const forfeited = retreatSpireBattle(atOneHeart, 'Lazy Sloth');
    expect(forfeited.phase).toBe('defeat');
    expect(forfeited.hearts).toBe(0);
    expect(forfeited.defeatedBy).toBe('Lazy Sloth');
  });

  it('prevents shopSellWeapon + upgrade offer free-upgrade / free-gold exploit in-shop and across locked next-shop', () => {
    let run = createSpireRun('Orange Tabby', 0, 7771);
    const shopNodes = run.map.nodes.filter(n => n.kind === 'shop');
    const shop1 = shopNodes[0]!;
    run = selectSpireNode(
      {
        ...run,
        coins: 100,
        weapons: ['blast-powder', 'flint-spark'],
        weaponLevels: { 'blast-powder': 4, 'flint-spark': 2 },
        map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shop1.id ? { ...n, row: 0 } : n)) },
      },
      shop1.id
    );
    expect(run.phase).toBe('shop');

    // Inject an on-sale Lv 5 upgrade offer for held Lv 4 blast-powder (29¢ < 60¢ sell value)
    const withUpgradeShelf = {
      ...run,
      shop: {
        ...run.shop!,
        weapons: [
          { weaponId: 'blast-powder', level: 5, price: 29, onSale: true, sold: false, locked: true },
          ...run.shop!.weapons.slice(1),
        ],
      },
    };
    const afterSell = shopSellWeapon(withUpgradeShelf, 'blast-powder');
    const resetOffer = afterSell.shop!.weapons[0];
    expect(resetOffer.level).toBe(1);
    expect(resetOffer.locked).toBe(false);
    expect(resetOffer.price).toBeGreaterThanOrEqual(25);
    // Re-buying only grants Lv 1 (never a free Lv 5 upgrade!)
    const afterRebuy = shopBuyWeapon(afterSell, 0);
    expect(afterRebuy.weaponLevels['blast-powder']).toBe(1);
    // Even if holding Lv 1 and selling+rebuying the on-sale Lv 1 offer, net coins cannot increase
    const lv1Refund = spireWeaponSellValue('blast-powder', 1);
    expect(resetOffer.price).toBeGreaterThan(lv1Refund);

    // Cross-shop locked upgrade exploit: if a Lv 5 upgrade was locked and the weapon is no longer held
    // when entering a later shop, buildShopState resets it to standalone Lv 1
    const shop2 = shopNodes[1] ?? shop1;
    const beforeNextShop = {
      ...leaveShop(withUpgradeShelf),
      weapons: ['flint-spark'],
      weaponLevels: { 'flint-spark': 2 },
      currentNodeId: null,
      map: {
        ...run.map,
        nodes: run.map.nodes.map(n => (n.id === shop2.id ? { ...n, row: 0, visited: false } : n)),
      },
    };
    const nextShop = selectSpireNode(beforeNextShop, shop2.id);
    const carried = nextShop.shop!.weapons.find(w => w.weaponId === 'blast-powder');
    expect(carried).toBeDefined();
    expect(carried!.level).toBe(1);
    expect(carried!.price).toBeGreaterThan(lv1Refund);
  });

  it('makes Wandering Alchemist preview the exact Arcana and support Accept or Decline cleanly', () => {
    let run = createSpireRun('Pelican', 0, 8080);
    const evNode = run.map.nodes.find(n => n.kind === 'event')!;
    run = selectSpireNode(
      {
        ...run,
        map: {
          ...run.map,
          nodes: run.map.nodes.map(n => (n.id === evNode.id ? { ...n, row: 0, eventId: 'wandering_alchemist' } : n)),
        },
      },
      evNode.id
    );
    expect(run.phase).toBe('event');
    expect(run.event?.offeredArcana).toBeDefined();

    // Choosing the Arcana option previews it without forcing it onto run.arcana yet
    const offered = chooseEventOption(run, 'arcana');
    expect(offered.event?.pendingArcanaOffer).toBe(run.event?.offeredArcana);
    expect(offered.arcana).toHaveLength(0);

    // Declining keeps run.arcana empty
    const declined = resolveEventPendingArcana(offered, false);
    expect(declined.arcana).toHaveLength(0);
    expect(declined.event?.pendingArcanaOffer).toBeUndefined();

    // Accepting binds the exact offered Arcana
    const accepted = resolveEventPendingArcana(offered, true);
    expect(accepted.arcana).toEqual([offered.event?.pendingArcanaOffer]);
    expect(accepted.event?.pendingArcanaOffer).toBeUndefined();
  });

  it('supports Shop item locking (cap 2, survives rerolls & next Shop), weapon selling, Arcana purging, and belt reordering', () => {
    let run = createSpireRun('Corgi', 0, 9001);
    run = { ...run, coins: 300, arcana: ['monochrome_pact'] };
    const shopNodes = run.map.nodes.filter(n => n.kind === 'shop');
    const shop1 = shopNodes[0]!;
    run = selectSpireNode(
      { ...run, map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shop1.id ? { ...n, row: 0 } : n)) } },
      shop1.id
    );
    expect(run.phase).toBe('shop');

    // Lock up to MAX_SHOP_LOCKS=2 items; 3rd lock is ignored
    const lockedW0 = run.shop!.weapons[0].weaponId;
    const lockedU0 = run.shop!.upgrades[0].upgradeId;
    run = shopToggleLock(run, 'weapon', 0);
    run = shopToggleLock(run, 'upgrade', 0);
    const beforeThirdLock = run;
    run = shopToggleLock(run, 'weapon', 1);
    expect(run).toBe(beforeThirdLock);
    expect(MAX_SHOP_LOCKS).toBe(2);

    // Reroll preserves both locked items!
    run = shopReroll(run);
    expect(run.shop!.weapons.some(w => w.weaponId === lockedW0 && w.locked)).toBe(true);
    expect(run.shop!.upgrades.some(u => u.upgradeId === lockedU0 && u.locked)).toBe(true);

    // Sell a held weapon (50% refund); cannot sell last weapon
    const sellTarget = run.weapons[1];
    const expectedRefund = spireWeaponSellValue(sellTarget, run.weaponLevels[sellTarget] ?? 1);
    const coinsBeforeSell = run.coins;
    run = shopSellWeapon(run, sellTarget);
    expect(run.weapons).not.toContain(sellTarget);
    expect(run.coins).toBe(coinsBeforeSell + expectedRefund);
    // Holding only 1 weapon now — selling is blocked!
    expect(run.weapons).toHaveLength(1);
    expect(shopSellWeapon(run, run.weapons[0])).toBe(run);

    // Purge unwanted Arcana for 40¢
    const coinsBeforePurge = run.coins;
    run = shopPurgeArcana(run, 'monochrome_pact');
    expect(run.arcana).toEqual([]);
    expect(run.coins).toBe(coinsBeforePurge - ARCANA_PURGE_COST);

    // Leaving Shop persists locked items into run.lockedShop and carries them into the NEXT shop!
    run = leaveShop(run);
    expect(run.lockedShop?.weapons.some(w => w.weaponId === lockedW0)).toBe(true);
    expect(run.lockedShop?.upgrades.some(u => u.upgradeId === lockedU0)).toBe(true);

    const shop2 = run.map.nodes.find(n => n.kind === 'shop' && n.id !== shop1.id) ?? { ...shop1, id: 'shop-next', visited: false };
    run = selectSpireNode(
      {
        ...run,
        currentNodeId: null,
        map: {
          ...run.map,
          nodes: [
            ...run.map.nodes.filter(n => n.id !== shop2.id),
            { ...shop2, row: 0, visited: false },
          ],
        },
      },
      shop2.id
    );
    expect(run.phase).toBe('shop');
    expect(run.shop!.weapons.some(w => w.weaponId === lockedW0 && w.locked)).toBe(true);
    expect(run.shop!.upgrades.some(u => u.upgradeId === lockedU0 && u.locked)).toBe(true);

    // Belt reordering lets players move Understudy beside any chosen weapon
    let beltRun = createSpireRun('Badger', 0, 777);
    beltRun = {
      ...beltRun,
      weapons: ['prismatic-ray', 'life-vessel', 'understudy'],
      weaponLevels: { 'prismatic-ray': 2, 'life-vessel': 2, understudy: 2 },
    };
    beltRun = reorderSpireWeapon(beltRun, 2, 1);
    expect(beltRun.weapons).toEqual(['prismatic-ray', 'understudy', 'life-vessel']);
    expect(spireHeldWeapons(beltRun).map(w => w.id)).toEqual(['prismatic-ray', 'understudy', 'life-vessel']);

    // Severe Gamble clash detector catches all 4 documented anti-synergy pairs
    expect(clashesWithBelt(['chain-gang'], 'long-fuse')).toHaveLength(1);
    expect(clashesWithBelt(['greedy-chest'], 'cursed-idol')).toHaveLength(1);
    expect(clashesWithBelt(['ice-block'], 'neural-network')).toHaveLength(1);
    expect(clashesWithBelt(['twin-seed'], 'chain-reaction')).toHaveLength(1);
    expect(clashesWithBelt(['blast-powder'], 'mending-charm')).toHaveLength(0);
  });

  it('bridges Spire encounters seamlessly into Adventure createRun with persistent HP and all 6 Summit weapons', () => {
    let run = createSpireRun('Orange Tabby', 0, 777);
    const six = SPIRE_WEAPON_POOL.slice(0, MAX_SUMMIT_WEAPONS);
    run = { ...run, hearts: 3, weapons: six, weaponLevels: Object.fromEntries(six.map(id => [id, 2])) };
    const firstId = reachableNodeIds(run.map, null)[0];
    run = selectSpireNode(run, firstId);
    expect(run.phase).toBe('preview');
    const enc = run.activeEncounter!;
    const fight = createRun(spireEncounterToLevel(run, enc), spireRunToVirtualSave(run), {
      seed: 101,
      features: new Set(SPIRE_FIGHT_FEATURES),
      overrides: spireRunOverrides(run),
    });
    expect(fight.hearts).toBe(3);
    expect(fight.weapons.length).toBe(MAX_SUMMIT_WEAPONS);
    expect(fight.parry?.spec.attackName).toBe(enc.parry.attackName);
  });

  it('all 12 Mystery Events resolve every option deterministically without errors', () => {
    expect(SPIRE_EVENTS).toHaveLength(12);
    expect(new Set(SPIRE_EVENTS.map(e => e.id)).size).toBe(12);
    for (const ev of SPIRE_EVENTS) {
      for (const opt of ev.options) {
        let run = createSpireRun('Sly Fox', 0, 999);
        run = {
          ...run,
          coins: 200,
          hearts: 5,
          maxHearts: 6,
          phase: 'event',
          event: { eventId: ev.id, resolved: false },
        };
        const after = chooseEventOption(run, opt.id);
        expect(after.event?.resolved).toBe(true);
        expect(after.event?.outcomeText).toBeTruthy();
        expect(after.event?.outcomeText).not.toMatch(/spire/i);
        if (after.event?.pendingForge) {
          const wId = after.weapons[0];
          const beforeLv = after.weaponLevels[wId];
          const expectedDelta = ev.id === 'starlight_forge' ? 1 : 2;
          const forged = resolveEventPendingForge(after, wId);
          expect(forged.weaponLevels[wId]).toBe(Math.min(5, beforeLv + expectedDelta));
        }
      }
    }
  });

  it('supports shop buying, rerolling, campfire rest/forge/meditate, treasure, and Endless transition', () => {
    let run = createSpireRun('Badger', 0, 555);
    run = { ...run, coins: 300, hearts: 3 };
    // Enter a shop node
    const shopNode = run.map.nodes.find(n => n.kind === 'shop')!;
    run = { ...run, currentNodeId: null };
    run = selectSpireNode({ ...run, map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0 } : n)) } }, shopNode.id);
    expect(run.phase).toBe('shop');
    const beforeWeapons = run.weapons.length;
    run = shopBuyWeapon(run, 0);
    expect(run.weapons.length).toBe(beforeWeapons + 1);
    run = shopReroll(run);
    expect(run.shop?.rerolls).toBe(1);
    run = leaveShop(run);
    expect(run.phase).toBe('map');

    // Campfire rest, forge, meditate
    const campBase = { ...run, phase: 'campfire' as const, campfire: { healAmount: 3, skillOptions: ['badger-0-1'], resolved: false } };
    const beforeLv = campBase.weaponLevels[run.weapons[0]] ?? 1;
    expect(campfireRest(campBase).hearts).toBe(6);
    expect(campfireForge(campBase, run.weapons[0]).weaponLevels[run.weapons[0]]).toBe(beforeLv + 1);
    expect(campfireMeditate(campBase, 'badger-0-1').skillNodes).toContain('badger-0-1');

    // Treasure
    const treasBase = { ...run, phase: 'treasure' as const, treasure: { coins: 80, weaponOffer: { weaponId: 'blast-powder', level: 2 }, arcanaOffer: 'tempo_surge' as const, claimed: false } };
    const afterTreas = claimTreasure(treasBase, 'arcana');
    expect(afterTreas.arcana).toContain('tempo_surge');

    // Endless transition
    const winState = { ...run, act: 3, phase: 'victory' as const };
    const endless = enterEndlessSpire(winState);
    expect(endless.endless).toBe(true);
    expect(endless.act).toBe(4);
    expect(endless.phase).toBe('map');
  });

  it('persists Spire runs cleanly and syncs discovered Evolutions back to Adventure save', () => {
    resetSpireStorage();
    const run = createSpireRun('Corgi', 0, 2026);
    writeSpireRun(run);
    expect(loadSpireRun()?.id).toBe(run.id);

    writeAdventureSave(createNewSave());
    syncSpireDiscoveriesToAdventure(['phoenix-pyre']);
    expect(loadAdventureSave().discoveredEvolutions).toContain('phoenix-pyre');
    resetSpireStorage();
    expect(loadSpireRun()).toBeNull();
  });

  it('reuses Adventure ALL_ARMORY_WEAPON_IDS, canonical UPGRADES, and startingLoadout without duplicate specs', () => {
    // Shared Armory weapon pool is the exact canonical reference
    expect(SPIRE_WEAPON_POOL).toBe(ALL_ARMORY_WEAPON_IDS);

    // Shop upgrades reference canonical Adventure UPGRADES and flow directly into startingLoadout
    let run = createSpireRun('Orange Tabby', 0, 31337);
    run = { ...run, coins: 400 };
    const shopNode = run.map.nodes.find(n => n.kind === 'shop')!;
    run = selectSpireNode(
      { ...run, map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0 } : n)) } },
      shopNode.id
    );
    expect(run.shop?.upgrades.length).toBeGreaterThan(0);
    for (const offer of run.shop!.upgrades) {
      expect(getUpgrade(offer.upgradeId).name).toBeTruthy();
    }
    const boughtId = run.shop!.upgrades[0].upgradeId;
    const beforeTier = run.upgrades[boughtId] ?? 0;
    run = shopBuyUpgrade(run, 0);
    expect(run.upgrades[boughtId]).toBe(beforeTier + 1);

    // Shared startingLoadout reflects Spire's hourglass & heavy_hitter upgrades cleanly
    const withUpgrades = { ...run, upgrades: { ...run.upgrades, heavy_hitter: 2, hourglass: 1 } };
    const firstFight = withUpgrades.map.nodes.find(n => n.encounter)!.encounter!;
    const loadout = spireEncounterLoadout(withUpgrades, firstFight);
    expect(loadout.bonusDamagePerMatch).toBe(2);
    expect(loadout.timer).toBe(firstFight.timer + 8);
  });

  it('migrates legacy saved Spire runs with flat upgrade counters and legacy shop offer kind safely', () => {
    resetSpireStorage();
    const fresh = createSpireRun('Pelican', 0, 8888);
    const legacy = {
      ...fresh,
      upgrades: undefined,
      seenEnemies: undefined,
      bonusDamagePerMatch: 2,
      bonusClockSeconds: 16,
      evolutionLabTier: 2,
      shop: {
        weapons: [],
        arcana: [],
        upgrades: [{ kind: 'heavy_hitter', price: 70, sold: false }],
        healCost: 45,
        healAmount: 2,
        healed: false,
        forgeCost: 65,
        forged: false,
        rerollCost: 25,
        rerolls: 0,
      },
    };
    writeSpireRun(legacy as unknown as typeof fresh);
    const loaded = loadSpireRun();
    expect(loaded?.upgrades.heavy_hitter).toBe(2);
    expect(loaded?.upgrades.hourglass).toBe(2);
    expect(loaded?.upgrades.evolution_lab).toBe(2);
    expect(loaded?.shop?.upgrades[0].upgradeId).toBe('heavy_hitter');
    expect(loaded?.seenEnemies).toEqual([]);
    resetSpireStorage();
  });
});

describe('Starfall Summit — Programmatic Uniqueness & No-Duplicate Invariants', () => {
  it('ACT_LEVEL_POOLS has 53 strictly non-overlapping levels & canonical enemies across tiers and Acts 1–3', () => {
    const allLevelIds = new Set<string>();
    const allEnemyNames = new Set<string>();
    let totalEntries = 0;

    for (const act of [1, 2, 3] as const) {
      for (const tier of ['skirmish', 'elite', 'boss'] as const) {
        const pool = ACT_LEVEL_POOLS[act][tier];
        expect(pool.length).toBeGreaterThan(0);
        for (const lvlId of pool) {
          totalEntries += 1;
          expect(allLevelIds.has(lvlId)).toBe(false);
          allLevelIds.add(lvlId);
          const enemyName = canonicalLevelEnemyName(lvlId);
          expect(allEnemyNames.has(enemyName)).toBe(false);
          allEnemyNames.add(enemyName);
        }
      }
    }

    expect(totalEntries).toBe(53);
    expect(allLevelIds.size).toBe(53);
    expect(allEnemyNames.size).toBe(53);
  });

  it('enforces ZERO duplicate enemies & ZERO duplicate events on any Act map and across Acts 1–3 (60 seeds + ambushes + Endless)', () => {
    for (let i = 0; i < 60; i++) {
      const seed = 1000 + i * 7919;
      const asc = i % 2 === 0 ? 0 : 5; // test both A0 and A5 (+1 extra elite per act)
      let run = createSpireRun('Orange Tabby', asc, seed);

      const climbEnemiesSeen = new Set<string>();
      const climbEventsVisited = new Set<string>();
      const allMapEnemiesAcross3Acts = new Set<string>();

      for (const act of [1, 2, 3]) {
        expect(run.act).toBe(act);
        const combatNodes = run.map.nodes.filter(n => n.encounter);
        const mapEnemyNames = combatNodes.map(n => n.encounter!.name);

        // Zero duplicate enemies on this Act map
        expect(new Set(mapEnemyNames).size).toBe(mapEnemyNames.length);
        // Zero overlap with previously fought enemies OR prior Acts' maps
        for (const name of mapEnemyNames) {
          expect(climbEnemiesSeen.has(name)).toBe(false);
          expect(allMapEnemiesAcross3Acts.has(name)).toBe(false);
          allMapEnemiesAcross3Acts.add(name);
        }

        // Zero duplicate events on this Act map, and none previously visited
        const eventNodes = run.map.nodes.filter(n => n.kind === 'event');
        const mapEventIds = eventNodes.map(n => n.eventId!);
        expect(new Set(mapEventIds).size).toBe(mapEventIds.length);
        for (const evId of mapEventIds) {
          expect(climbEventsVisited.has(evId)).toBe(false);
        }

        // Simulate fighting an entrance skirmish, an elite, and the Act boss (plus a sleeping_hoard ambush!)
        const sampleCombats = [
          run.map.nodes.find(n => n.kind === 'skirmish')!,
          run.map.nodes.find(n => n.kind === 'elite')!,
          run.map.nodes.find(n => n.kind === 'boss')!,
        ];
        for (const cn of sampleCombats) {
          const enc = cn.encounter!;
          expect(climbEnemiesSeen.has(enc.name)).toBe(false);
          climbEnemiesSeen.add(enc.name);
          run = startSpireEncounter({ ...run, phase: 'preview', activeEncounter: enc });
          expect(run.seenEnemies).toContain(enc.name);
        }

        // Trigger a sleeping_hoard:wake ambush and verify it NEVER duplicates any seen or map enemy
        const ambushRun = chooseEventOption(
          {
            ...run,
            phase: 'event',
            event: { eventId: 'sleeping_hoard', resolved: false },
          },
          'wake'
        );
        const ambushName = ambushRun.event?.ambushEncounter?.name;
        expect(ambushName).toBeTruthy();
        expect(climbEnemiesSeen.has(ambushName!)).toBe(false);
        expect(mapEnemyNames).not.toContain(ambushName);
        expect(ambushRun.seenEnemies).toContain(ambushName);
        climbEnemiesSeen.add(ambushName!);
        run = { ...ambushRun, phase: 'map', event: null };

        // Visit all 3 event nodes on this Act map
        for (const evNode of eventNodes) {
          const exposed = {
            ...run,
            currentNodeId: null,
            phase: 'map' as const,
            map: {
              ...run.map,
              nodes: run.map.nodes.map(n => (n.id === evNode.id ? { ...n, row: 0, visited: false } : n)),
            },
          };
          const entered = selectSpireNode(exposed, evNode.id);
          const chosenEv = entered.event!.eventId;
          expect(climbEventsVisited.has(chosenEv)).toBe(false);
          climbEventsVisited.add(chosenEv);
          run = { ...entered, phase: 'map', event: null };
        }

        if (act < 3) {
          run = advanceToNextAct(run);
        }
      }
      expect(climbEventsVisited.size).toBe(9);
    }

    // Runtime safety guard in selectSpireNode swaps to an unseen event if node.eventId was already seen
    const guardRun = createSpireRun('Pelican', 0, 5150);
    const evNode = guardRun.map.nodes.find(n => n.kind === 'event')!;
    const alreadySeenId = evNode.eventId!;
    const swapped = selectSpireNode(
      {
        ...guardRun,
        seenEvents: [alreadySeenId],
        map: {
          ...guardRun.map,
          nodes: guardRun.map.nodes.map(n => (n.id === evNode.id ? { ...n, row: 0 } : n)),
        },
      },
      evNode.id
    );
    expect(swapped.event?.eventId).toBeDefined();
    expect(swapped.event?.eventId).not.toBe(alreadySeenId);

    // Deep Endless fallback: even after all 12 events & all 53 enemies are seen, an Act map STILL has zero duplicates
    const allEvents = SPIRE_EVENTS.map(e => e.id);
    const allEnemies = [1, 2, 3].flatMap(a =>
      (['skirmish', 'elite', 'boss'] as const).flatMap(k =>
        ACT_LEVEL_POOLS[a as 1 | 2 | 3][k].map(canonicalLevelEnemyName)
      )
    );
    const endlessMap = generateActMap(6, 9999, 5, allEvents, allEnemies);
    const endlessEventIds = endlessMap.nodes.filter(n => n.kind === 'event').map(n => n.eventId!);
    const endlessEnemies = endlessMap.nodes.filter(n => n.encounter).map(n => n.encounter!.name);
    expect(new Set(endlessEventIds).size).toBe(endlessEventIds.length);
    expect(new Set(endlessEnemies).size).toBe(endlessEnemies.length);
  });

  it('simulated full 3-Act climbs across all 6 fighters have zero duplicate fought enemies and zero duplicate visited events', () => {
    for (let i = 0; i < 12; i++) {
      const fighter = FIGHTERS[i % FIGHTERS.length].name;
      const res = simulateSpireClimb({ fighter, ascension: 0, seed: 3000 + i * 1009, bot: BOTS.expert });
      expect(new Set(res.run.seenEnemies).size).toBe(res.run.seenEnemies.length);
      expect(new Set(res.run.seenEvents).size).toBe(res.run.seenEvents.length);
    }
  }, 60_000);

  it('never re-offers any owned Fighter Skill Node across Rewards, Campfire, Mirror Pond, Archive, and Echoing Cavern', () => {
    const fighter = 'Orange Tabby' as const;
    const allNodes = skillTreeOf(fighter).map(n => n.id);
    expect(allNodes.length).toBeGreaterThanOrEqual(6);

    let run = createSpireRun(fighter, 0, 7070);
    run = { ...run, coins: 500 };

    // Acquire nodes one by one and verify EVERY offer source strictly excludes all owned nodes
    for (let step = 0; step < allNodes.length; step++) {
      const owned = new Set(run.skillNodes);

      // 1. rollSkillNodeOptions
      const rolled = rollSkillNodeOptions(run, createRng(100 + step), 3);
      expect(new Set(rolled).size).toBe(rolled.length);
      for (const id of rolled) expect(owned.has(id)).toBe(false);

      // 2. Campfire Meditate
      const campNode = run.map.nodes.find(n => n.kind === 'campfire')!;
      const inCamp = selectSpireNode(
        {
          ...run,
          currentNodeId: null,
          phase: 'map',
          map: {
            ...run.map,
            nodes: run.map.nodes.map(n => (n.id === campNode.id ? { ...n, row: 0, visited: false } : n)),
          },
        },
        campNode.id
      );
      for (const id of inCamp.campfire!.skillOptions) expect(owned.has(id)).toBe(false);

      // 3. Mirror Pond, Starfall Archive, Echoing Cavern
      for (const [evId, optId] of [
        ['mirror_pond', 'study'],
        ['ancient_library', 'technique'],
        ['echoing_cavern', 'train'],
      ] as const) {
        const res = chooseEventOption(
          { ...run, phase: 'event', event: { eventId: evId, resolved: false } },
          optId
        );
        for (const id of res.event?.pendingSkillOptions ?? []) {
          expect(owned.has(id)).toBe(false);
        }
      }

      // Claim next skill node via reward / campfire / event alternately, and verify duplicate claim is blocked
      const nextSkill = rolled[0];
      expect(nextSkill).toBeDefined();
      run = { ...run, skillNodes: [...run.skillNodes, nextSkill] };

      // Explicit alreadyOwned safeguards refuse re-adding an owned skill node
      const dupReward = claimRewardSkillNode(
        {
          ...run,
          phase: 'reward',
          reward: {
            nodeKind: 'elite',
            foeName: 'Test',
            coinsEarned: 50,
            parryBonusCoins: 0,
            dpm: 100,
            biggestHit: 10,
            parries: 0,
            perfectParries: 0,
            weaponOptions: [],
            weaponClaimed: true,
            weaponRerolled: false,
            arcanaOptions: [],
            arcanaClaimed: true,
            skillOptions: [nextSkill],
            skillClaimed: false,
            isActBoss: false,
          },
        },
        nextSkill
      );
      expect(dupReward.skillNodes.filter(id => id === nextSkill)).toHaveLength(1);

      const dupCamp = campfireMeditate(
        { ...run, phase: 'campfire', campfire: { healAmount: 2, skillOptions: [nextSkill], resolved: false } },
        nextSkill
      );
      expect(dupCamp.skillNodes.filter(id => id === nextSkill)).toHaveLength(1);

      const dupEv = resolveEventPendingSkill(
        { ...run, phase: 'event', event: { eventId: 'ancient_library', resolved: true, pendingSkillOptions: [nextSkill] } },
        nextSkill
      );
      expect(dupEv.skillNodes.filter(id => id === nextSkill)).toHaveLength(1);
    }

    // When ALL skill nodes are owned: rollSkillNodeOptions is empty & Mirror Pond doesn't waste 35¢
    expect(rollSkillNodeOptions(run, createRng(999), 3)).toEqual([]);
    const coinsBefore = run.coins;
    const mirrorMaxed = chooseEventOption(
      { ...run, phase: 'event', event: { eventId: 'mirror_pond', resolved: false } },
      'study'
    );
    expect(mirrorMaxed.event?.pendingSkillOptions).toBeUndefined();
    expect(mirrorMaxed.coins).toBeGreaterThan(coinsBefore);
  });

  it('never re-offers any owned Arcana across Rewards, Shop (fresh/reroll/locked carry-over), Vault, and Wandering Alchemist', () => {
    const eligibleArcana = ARCANA.map(a => a.id).filter(id => !SPIRE_EXCLUDED_ARCANA.has(id));
    let run = createSpireRun('Badger', 0, 8181);
    run = { ...run, coins: 2000 };
    const shopNode = run.map.nodes.find(n => n.kind === 'shop')!;
    const treasNode = run.map.nodes.find(n => n.kind === 'treasure')!;
    const evNode = run.map.nodes.find(n => n.kind === 'event')!;

    // Lock an Arcana in Shop 1, leave, acquire it elsewhere, then enter Shop 2 → carried lock MUST be dropped!
    let s1 = selectSpireNode(
      { ...run, map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0 } : n)) } },
      shopNode.id
    );
    const lockedArcanaId = s1.shop!.arcana[0].arcanaId;
    s1 = shopToggleLock(s1, 'arcana', 0);
    s1 = leaveShop(s1);
    expect(s1.lockedShop?.arcana.some(a => a.arcanaId === lockedArcanaId)).toBe(true);

    // Acquire that same Arcana before Shop 2
    const afterAcquire = { ...s1, arcana: [...s1.arcana, lockedArcanaId], currentNodeId: null };
    const s2 = selectSpireNode(
      {
        ...afterAcquire,
        map: {
          ...afterAcquire.map,
          nodes: afterAcquire.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0, visited: false } : n)),
        },
      },
      shopNode.id
    );
    expect(s2.shop!.arcana.some(a => a.arcanaId === lockedArcanaId)).toBe(false);

    // Acquire every eligible Arcana and verify NO source re-offers owned Arcana (including rerolls)
    for (const arcId of eligibleArcana) {
      const owned = new Set(run.arcana);
      for (const id of rollArcanaOptions(run, createRng(200 + owned.size), 3)) {
        expect(owned.has(id)).toBe(false);
      }

      let shopRun = selectSpireNode(
        {
          ...run,
          currentNodeId: null,
          phase: 'map',
          map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0, visited: false } : n)) },
        },
        shopNode.id
      );
      for (const offer of shopRun.shop!.arcana) expect(owned.has(offer.arcanaId)).toBe(false);
      shopRun = shopReroll(shopRun);
      for (const offer of shopRun.shop!.arcana) expect(owned.has(offer.arcanaId)).toBe(false);

      const treasRun = selectSpireNode(
        {
          ...run,
          currentNodeId: null,
          phase: 'map',
          map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === treasNode.id ? { ...n, row: 0, visited: false } : n)) },
        },
        treasNode.id
      );
      if (treasRun.treasure?.arcanaOffer) expect(owned.has(treasRun.treasure.arcanaOffer)).toBe(false);

      const alchRun = selectSpireNode(
        {
          ...run,
          currentNodeId: null,
          phase: 'map',
          seenEvents: [],
          map: {
            ...run.map,
            nodes: run.map.nodes.map(n => (n.id === evNode.id ? { ...n, row: 0, visited: false, eventId: 'wandering_alchemist' } : n)),
          },
        },
        evNode.id
      );
      if (alchRun.event?.offeredArcana) expect(owned.has(alchRun.event.offeredArcana)).toBe(false);

      run = { ...run, arcana: [...run.arcana, arcId] };

      // Guard direct duplicate claim attempts
      expect(
        claimRewardArcana(
          {
            ...run,
            phase: 'reward',
            reward: {
              nodeKind: 'elite',
              foeName: 'Test',
              coinsEarned: 50,
              parryBonusCoins: 0,
              dpm: 100,
              biggestHit: 10,
              parries: 0,
              perfectParries: 0,
              weaponOptions: [],
              weaponClaimed: true,
              weaponRerolled: false,
              arcanaOptions: [arcId],
              arcanaClaimed: false,
              skillOptions: [],
              skillClaimed: true,
              isActBoss: false,
            },
          },
          arcId
        ).arcana.filter(id => id === arcId)
      ).toHaveLength(1);
      expect(
        shopBuyArcana(
          {
            ...shopRun,
            arcana: run.arcana,
            shop: { ...shopRun.shop!, arcana: [{ arcanaId: arcId, price: 50, sold: false }] },
          },
          0
        ).arcana.filter(id => id === arcId)
      ).toHaveLength(1);
    }

    // All Arcana owned → Shop has 0 Arcana offers, Vault has null arcanaOffer, Alchemist gives fallback coins
    const allOwnedShop = selectSpireNode(
      {
        ...run,
        currentNodeId: null,
        phase: 'map',
        map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0, visited: false } : n)) },
      },
      shopNode.id
    );
    expect(allOwnedShop.shop!.arcana).toEqual([]);
    const allOwnedTreas = selectSpireNode(
      {
        ...run,
        currentNodeId: null,
        phase: 'map',
        map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === treasNode.id ? { ...n, row: 0, visited: false } : n)) },
      },
      treasNode.id
    );
    expect(allOwnedTreas.treasure!.arcanaOffer).toBeNull();
    const allOwnedAlch = chooseEventOption(
      { ...run, phase: 'event', event: { eventId: 'wandering_alchemist', resolved: false } },
      'arcana'
    );
    expect(allOwnedAlch.event?.pendingArcanaOffer).toBeUndefined();
    expect(allOwnedAlch.coins).toBe(run.coins + 75);
  });

  it('never re-offers maxed Shop Upgrades (fresh, rerolled, or locked carry-over) and blocks buying past max tier', () => {
    let run = createSpireRun('Corgi', 0, 9292);
    run = { ...run, coins: 5000 };
    const shopNode = run.map.nodes.find(n => n.kind === 'shop')!;

    // 1. Lock an upgrade at maxTier - 1 in Shop 1, max it before Shop 2, verify Shop 2 drops the carried lock!
    const heavyMax = maxSpireUpgradeTier('heavy_hitter');
    expect(heavyMax).toBe(3);
    let s1 = selectSpireNode(
      {
        ...run,
        upgrades: { ...run.upgrades, heavy_hitter: heavyMax - 1 },
        map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0 } : n)) },
      },
      shopNode.id
    );
    s1 = {
      ...s1,
      shop: {
        ...s1.shop!,
        upgrades: [{ upgradeId: 'heavy_hitter', price: 65, sold: false, locked: true }],
      },
    };
    const left = leaveShop(s1);
    expect(left.lockedShop?.upgrades[0].upgradeId).toBe('heavy_hitter');

    // Max heavy_hitter via event before Shop 2
    const afterEvent = chooseEventOption(
      { ...left, phase: 'event', event: { eventId: 'cursed_anvil', resolved: false } },
      'salvage'
    );
    expect(isSpireUpgradeMaxed(afterEvent, 'heavy_hitter')).toBe(true);

    const s2 = selectSpireNode(
      {
        ...afterEvent,
        phase: 'map',
        event: null,
        currentNodeId: null,
        map: {
          ...afterEvent.map,
          nodes: afterEvent.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0, visited: false } : n)),
        },
      },
      shopNode.id
    );
    expect(s2.shop!.upgrades.some(u => u.upgradeId === 'heavy_hitter')).toBe(false);

    // 2. Buying a maxed upgrade is blocked cleanly
    const blockedBuy = shopBuyUpgrade(
      {
        ...s2,
        shop: { ...s2.shop!, upgrades: [{ upgradeId: 'heavy_hitter', price: 65, sold: false }] },
      },
      0
    );
    expect(blockedBuy.upgrades.heavy_hitter).toBe(heavyMax);
    expect(blockedBuy.coins).toBe(s2.coins);

    // 3. Max several upgrades and reroll 30 times: NONE of the maxed upgrades ever appear!
    const maxedIds = ['heavy_hitter', 'evolution_lab', 'tough_hide'] as const;
    const partialMaxedUpgrades: Record<string, number> = {};
    for (const id of maxedIds) partialMaxedUpgrades[id] = maxSpireUpgradeTier(id);

    let rolledShop = selectSpireNode(
      {
        ...run,
        upgrades: partialMaxedUpgrades,
        map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0, visited: false } : n)) },
      },
      shopNode.id
    );
    for (let r = 0; r < 30; r++) {
      for (const u of rolledShop.shop!.upgrades) {
        expect(isSpireUpgradeMaxed(rolledShop, u.upgradeId)).toBe(false);
        expect(maxedIds).not.toContain(u.upgradeId);
      }
      rolledShop = shopReroll(rolledShop);
    }

    // 4. Max ALL 7 upgrades → Shop upgrade shelf is strictly empty across fresh shops & rerolls!
    const allMaxed: Record<string, number> = {};
    for (const id of SPIRE_SHOP_UPGRADE_IDS) allMaxed[id] = maxSpireUpgradeTier(id);
    const fullMaxShop = selectSpireNode(
      {
        ...run,
        upgrades: allMaxed,
        map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0, visited: false } : n)) },
      },
      shopNode.id
    );
    expect(fullMaxShop.shop!.upgrades).toEqual([]);
    expect(shopReroll(fullMaxShop).shop!.upgrades).toEqual([]);
  });
});

describe('Starfall Summit — Shared UI Components Render Cleanly & Zero-"Spire" Guardrail', () => {
  it('renders SpireSetup, SpireMap, SpireEncounterPreview (with ParryPreviewCard), SpireShop (with WeaponExplainer), SpireCampfire & SpireBuildModal', () => {
    const run = createSpireRun('Orange Tabby', 0, 4242);

    const safeMetrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
    const setup = render(
      <SafeAreaProvider initialMetrics={safeMetrics}>
        <SpireSetup
          activeRun={null}
          meta={createInitialSpireMeta()}
          onStartNew={() => {}}
          onResume={() => {}}
          onAbandonActive={() => {}}
          onExit={() => {}}
        />
      </SafeAreaProvider>
    );
    expect(setup.getByTestId('spire-setup')).toBeTruthy();
    expect(setup.getByTestId('spire-start-climb')).toBeTruthy();

    const map = render(<SpireMap run={run} onSelectNode={() => {}} onReorderWeapon={() => {}} />);
    expect(map.getByTestId('spire-map')).toBeTruthy();
    // Floor-1 Act Boss full preview modal (plan ahead for the Act Boss)
    fireEvent.press(map.getByTestId('spire-map-boss-preview'));
    expect(map.getByTestId('spire-map-boss-modal')).toBeTruthy();
    expect(map.getByTestId('spire-map-boss-parry')).toBeTruthy();
    fireEvent.press(map.getByTestId('spire-map-boss-close'));
    expect(map.queryByTestId('spire-map-boss-modal')).toBeNull();

    const firstId = reachableNodeIds(run.map, null)[0];
    const inPreview = selectSpireNode(run, firstId);
    const preview = render(
      <SpireEncounterPreview
        run={inPreview}
        encounter={inPreview.activeEncounter!}
        onFight={() => {}}
        onInspectBuild={() => {}}
      />
    );
    expect(preview.getByTestId('spire-preview-parry')).toBeTruthy();

    const shopNode = run.map.nodes.find(n => n.kind === 'shop')!;
    const inShop = selectSpireNode(
      { ...run, map: { ...run.map, nodes: run.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0 } : n)) } },
      shopNode.id
    );
    const shopView = render(
      <SpireShop
        run={inShop}
        shop={inShop.shop!}
        onBuyWeapon={() => {}}
        onBuyArcana={() => {}}
        onBuyUpgrade={() => {}}
        onBuyHeal={() => {}}
        onForgeWeapon={() => {}}
        onReroll={() => {}}
        onLeave={() => {}}
      />
    );
    expect(shopView.getByTestId('spire-shop')).toBeTruthy();

    const campView = render(
      <SpireCampfire
        run={run}
        campfire={{ healAmount: 3, skillOptions: ['tabby-0-1'], resolved: false }}
        onRest={() => {}}
        onForge={() => {}}
        onMeditate={() => {}}
        onLeave={() => {}}
      />
    );
    expect(campView.getByTestId('spire-campfire')).toBeTruthy();

    const buildView = render(<SpireBuildModal visible run={run} onClose={() => {}} />);
    expect(buildView.getByTestId('spire-build-weapon-blast-powder')).toBeTruthy();

    // Ensure claimRewardWeapon works cleanly as well
    const rewardRun = claimRewardWeapon(
      {
        ...run,
        phase: 'reward',
        reward: {
          nodeKind: 'skirmish',
          foeName: 'Lazy Sloth',
          coinsEarned: 50,
          parryBonusCoins: 4,
          dpm: 500,
          biggestHit: 40,
          parries: 1,
          perfectParries: 0,
          weaponOptions: [{ weaponId: 'war-drum', level: 1 }],
          weaponClaimed: false,
          weaponRerolled: false,
          arcanaOptions: [],
          arcanaClaimed: true,
          skillOptions: [],
          skillClaimed: true,
          isActBoss: false,
        },
      },
      0
    );
    expect(rewardRun.weapons).toContain('war-drum');

    // Shared RoundFunPrompt renders on SpireRewardScreen & SpireEndScreen and reports 👍/👎 clicks
    const onRateReward = jest.fn();
    const rewardPromptView = render(
      <SafeAreaProvider initialMetrics={safeMetrics}>
        <SpireRewardScreen
          run={run}
          reward={{
            nodeKind: 'skirmish',
            foeName: 'Lazy Sloth',
            coinsEarned: 50,
            parryBonusCoins: 0,
            dpm: 400,
            biggestHit: 35,
            parries: 0,
            perfectParries: 0,
            weaponOptions: [{ weaponId: 'war-drum', level: 1 }],
            weaponClaimed: false,
            weaponRerolled: false,
            arcanaOptions: [],
            arcanaClaimed: true,
            skillOptions: [],
            skillClaimed: true,
            isActBoss: false,
          }}
          lastFight={null}
          funRating={null}
          funTags={[]}
          onRateFun={onRateReward}
          onClaimWeapon={() => {}}
          onRerollWeapons={() => {}}
          onSkipWeapon={() => {}}
          onClaimArcana={() => {}}
          onSkipArcana={() => {}}
          onClaimSkill={() => {}}
          onSkipSkill={() => {}}
          onContinue={() => {}}
        />
      </SafeAreaProvider>
    );
    expect(rewardPromptView.getByTestId('spire-reward-fun-prompt')).toBeTruthy();
    fireEvent.press(rewardPromptView.getByTestId('spire-reward-fun-up'));
    expect(onRateReward).toHaveBeenCalledWith('up', []);

    const onRateEnd = jest.fn();
    const endPromptView = render(
      <SafeAreaProvider initialMetrics={safeMetrics}>
        <SpireEndScreen
          run={{ ...run, phase: 'defeat', defeatedBy: 'Lazy Sloth' }}
          victory={false}
          lastFight={null}
          funRating={null}
          funTags={[]}
          onRateFun={onRateEnd}
          onNewRun={() => {}}
          onExitToMenu={() => {}}
        />
      </SafeAreaProvider>
    );
    expect(endPromptView.getByTestId('spire-end-fun-prompt')).toBeTruthy();
    fireEvent.press(endPromptView.getByTestId('spire-end-fun-down'));
    expect(onRateEnd).toHaveBeenCalledWith('down', []);
  });

  it('renders explicit EVO details & Clash warnings on SpireShop/SpireRewardScreen and Accept/Decline on Wandering Alchemist', () => {
    const base = createSpireRun('Orange Tabby', 0, 1111);
    const clashRun = {
      ...base,
      coins: 200,
      weapons: ['blast-powder', 'chain-gang'],
      weaponLevels: { 'blast-powder': 2, 'chain-gang': 2 },
      arcana: ['monochrome_pact' as const],
    };
    const onToggleLock = jest.fn();
    const onSell = jest.fn();
    const onPurge = jest.fn();
    const shopView = render(
      <SpireShop
        run={clashRun}
        shop={{
          weapons: [
            { weaponId: 'long-fuse', level: 2, price: 65, sold: false },
            { weaponId: 'pinata', level: 2, price: 65, sold: false },
          ],
          arcana: [],
          upgrades: [],
          healCost: 45,
          healAmount: 2,
          healed: false,
          forgeCost: 55,
          forged: false,
          rerollCost: 25,
          rerolls: 0,
        }}
        onBuyWeapon={() => {}}
        onBuyArcana={() => {}}
        onBuyUpgrade={() => {}}
        onBuyHeal={() => {}}
        onForgeWeapon={() => {}}
        onReroll={() => {}}
        onToggleLock={onToggleLock}
        onSellWeapon={onSell}
        onPurgeArcana={onPurge}
        onReorderWeapon={() => {}}
        onLeave={() => {}}
      />
    );
    expect(shopView.getByTestId('spire-shop-clash-0')).toBeTruthy();
    expect(shopView.getByTestId('spire-shop-evo-1')).toBeTruthy();
    fireEvent.press(shopView.getByTestId('spire-shop-lock-weapon-0'));
    expect(onToggleLock).toHaveBeenCalledWith('weapon', 0);
    fireEvent.press(shopView.getByTestId('spire-shop-belt-sell-chain-gang'));
    expect(onSell).toHaveBeenCalledWith('chain-gang');
    fireEvent.press(shopView.getByTestId('spire-shop-purge-arcana-monochrome_pact'));
    expect(onPurge).toHaveBeenCalledWith('monochrome_pact');

    // Reward screen also renders clash warning & explicit Evo card
    const rewardView = render(
      <SpireRewardScreen
        run={clashRun}
        reward={{
          nodeKind: 'skirmish',
          foeName: 'Lazy Sloth',
          coinsEarned: 50,
          parryBonusCoins: 0,
          dpm: 400,
          biggestHit: 35,
          parries: 0,
          perfectParries: 0,
          weaponOptions: [
            { weaponId: 'long-fuse', level: 2 },
            { weaponId: 'pinata', level: 2 },
          ],
          weaponClaimed: false,
          weaponRerolled: false,
          arcanaOptions: [],
          arcanaClaimed: true,
          skillOptions: [],
          skillClaimed: true,
          isActBoss: false,
        }}
        lastFight={null}
        onClaimWeapon={() => {}}
        onRerollWeapons={() => {}}
        onSkipWeapon={() => {}}
        onClaimArcana={() => {}}
        onSkipArcana={() => {}}
        onClaimSkill={() => {}}
        onSkipSkill={() => {}}
        onContinue={() => {}}
      />
    );
    expect(rewardView.getByTestId('spire-draft-clash-0')).toBeTruthy();
    expect(rewardView.getByTestId('spire-draft-evo-1')).toBeTruthy();

    // Wandering Alchemist shows explicit preview + Accept / Decline buttons
    const onResolveArcana = jest.fn();
    const evView = render(
      <SpireEvent
        run={base}
        eventState={{
          eventId: 'wandering_alchemist',
          resolved: true,
          pendingArcanaOffer: 'glass_prism',
          outcomeTitle: 'Arcana Offer · Glass Prism',
          outcomeText: 'Inspect before binding!',
        }}
        onChoose={() => {}}
        onPickWeapon={() => {}}
        onPickSkill={() => {}}
        onPickForge={() => {}}
        onResolveArcana={onResolveArcana}
        onLeave={() => {}}
      />
    );
    expect(evView.getByTestId('spire-event-arcana-offer')).toBeTruthy();
    fireEvent.press(evView.getByTestId('spire-event-arcana-decline'));
    expect(onResolveArcana).toHaveBeenCalledWith(false);
    fireEvent.press(evView.getByTestId('spire-event-arcana-accept'));
    expect(onResolveArcana).toHaveBeenCalledWith(true);
  });

  it('displays clear Tier X/Y badges for Shop Upgrades and renders ZERO user-facing "Spire" copy across every Summit & Menu UI', () => {
    const safeMetrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
    const collectVisibleCopy = (node: unknown, out: string[] = []): string[] => {
      if (node == null) return out;
      if (typeof node === 'string' || typeof node === 'number') {
        const s = String(node).trim();
        if (s) out.push(s);
        return out;
      }
      if (Array.isArray(node)) {
        for (const child of node) collectVisibleCopy(child, out);
        return out;
      }
      if (typeof node === 'object') {
        const obj = node as { props?: Record<string, unknown>; children?: unknown[] };
        if (typeof obj.props?.accessibilityLabel === 'string') {
          out.push(obj.props.accessibilityLabel);
        }
        if (obj.children) collectVisibleCopy(obj.children, out);
      }
      return out;
    };

    const assertNoSpireText = (label: string, tree: unknown) => {
      const strings = collectVisibleCopy(tree);
      const offenders = strings.filter(s => /spire/i.test(s));
      expect({ screen: label, offenders }).toEqual({ screen: label, offenders: [] });
      return strings.join('\n');
    };

    resetSpireStorage();
    const baseRun = createSpireRun('Orange Tabby', 1, 4242);

    // 1. MainMenu (fresh, meta with wins, and live run)
    const menuFresh = render(
      <MainMenu
        onSelectAdventure={() => {}}
        onSelectSpire={() => {}}
        onSelectFreeplay={() => {}}
        onSelectOptions={() => {}}
      />
    );
    expect(assertNoSpireText('MainMenu (fresh)', menuFresh.toJSON())).toContain('Starfall Summit');

    writeSpireMeta({ ...createInitialSpireMeta(), totalRuns: 3, victories: 1, bestFloor: 21, highestAscensionUnlocked: 1 });
    const menuMeta = render(
      <MainMenu
        onSelectAdventure={() => {}}
        onSelectSpire={() => {}}
        onSelectFreeplay={() => {}}
        onSelectOptions={() => {}}
      />
    );
    expect(assertNoSpireText('MainMenu (meta)', menuMeta.toJSON())).toContain('Starfall Summit');

    writeSpireRun(baseRun);
    const menuLive = render(
      <MainMenu
        onSelectAdventure={() => {}}
        onSelectSpire={() => {}}
        onSelectFreeplay={() => {}}
        onSelectOptions={() => {}}
      />
    );
    expect(assertNoSpireText('MainMenu (live)', menuLive.toJSON())).toContain('Starfall Summit');
    resetSpireStorage();

    // 2. SpireSetup (fresh & active run)
    const setupFresh = render(
      <SafeAreaProvider initialMetrics={safeMetrics}>
        <SpireSetup activeRun={null} meta={createInitialSpireMeta()} onStartNew={() => {}} onResume={() => {}} onAbandonActive={() => {}} onExit={() => {}} />
      </SafeAreaProvider>
    );
    const setupText = assertNoSpireText('SpireSetup (fresh)', setupFresh.toJSON());
    expect(setupText).toContain('STARFALL SUMMIT');
    expect(setupText).toContain('Begin Summit Climb');

    const setupActive = render(
      <SafeAreaProvider initialMetrics={safeMetrics}>
        <SpireSetup activeRun={baseRun} meta={createInitialSpireMeta()} onStartNew={() => {}} onResume={() => {}} onAbandonActive={() => {}} onExit={() => {}} />
      </SafeAreaProvider>
    );
    assertNoSpireText('SpireSetup (active)', setupActive.toJSON());

    // 3. SpireHeader & SpireBuildModal
    const header = render(<SpireHeader run={baseRun} onOpenBuild={() => {}} onExitToMenu={() => {}} />);
    expect(assertNoSpireText('SpireHeader', header.toJSON())).toContain('Inspect Summit build');

    const modal = render(<SpireBuildModal visible run={baseRun} onClose={() => {}} />);
    expect(assertNoSpireText('SpireBuildModal', modal.toJSON())).toContain(`Summit Build · Seed ${baseRun.seed}`);

    // 4. SpireMap & EncounterPreview
    const mapView = render(<SpireMap run={baseRun} onSelectNode={() => {}} onReorderWeapon={() => {}} />);
    assertNoSpireText('SpireMap', mapView.toJSON());

    const firstId = reachableNodeIds(baseRun.map, null)[0];
    const inPreview = selectSpireNode(baseRun, firstId);
    const previewView = render(
      <SpireEncounterPreview run={inPreview} encounter={inPreview.activeEncounter!} onFight={() => {}} onInspectBuild={() => {}} onBack={() => {}} />
    );
    assertNoSpireText('SpireEncounterPreview', previewView.toJSON());

    // 5. SpireShop (also verify Tier X/Y badge renders on upgrade offers!)
    const shopView = render(
      <SpireShop
        run={{ ...baseRun, coins: 300, upgrades: { ...baseRun.upgrades, heavy_hitter: 1 } }}
        shop={{
          weapons: [{ weaponId: 'war-drum', level: 2, price: 65, sold: false }],
          arcana: [{ arcanaId: 'tempo_surge', price: 75, sold: false }],
          upgrades: [
            { upgradeId: 'heavy_hitter', price: 65, sold: false },
            { upgradeId: 'evolution_lab', price: 80, sold: false, locked: true },
          ],
          healCost: 45,
          healAmount: 2,
          healed: false,
          forgeCost: 55,
          forged: false,
          rerollCost: 25,
          rerolls: 0,
        }}
        onBuyWeapon={() => {}}
        onBuyArcana={() => {}}
        onBuyUpgrade={() => {}}
        onBuyHeal={() => {}}
        onForgeWeapon={() => {}}
        onReroll={() => {}}
        onLeave={() => {}}
      />
    );
    const shopText = assertNoSpireText('SpireShop', shopView.toJSON());
    expect(shopText).toContain('Heavy Hitter (Tier 2/3)');
    expect(shopText).toContain('Evolution Lab (Tier 2/3 · Locked)');

    // 6. SpireCampfire (main + resolved meditate outcome)
    const campView = render(
      <SpireCampfire
        run={baseRun}
        campfire={{ healAmount: 3, skillOptions: ['tabby-0-1'], resolved: false }}
        onRest={() => {}}
        onForge={() => {}}
        onMeditate={() => {}}
        onLeave={() => {}}
      />
    );
    expect(assertNoSpireText('SpireCampfire', campView.toJSON())).toContain('ascending the Summit');

    const meditated = campfireMeditate(
      { ...baseRun, phase: 'campfire', campfire: { healAmount: 3, skillOptions: ['tabby-0-1'], resolved: false } },
      'tabby-0-1'
    );
    const campDone = render(
      <SpireCampfire run={meditated} campfire={meditated.campfire!} onRest={() => {}} onForge={() => {}} onMeditate={() => {}} onLeave={() => {}} />
    );
    assertNoSpireText('SpireCampfire (meditated)', campDone.toJSON());

    // 7. SpireEvent (all 12 Mystery Events!)
    for (const ev of SPIRE_EVENTS) {
      const evView = render(
        <SpireEvent
          run={{ ...baseRun, coins: 200 }}
          eventState={{ eventId: ev.id, resolved: false }}
          onChoose={() => {}}
          onPickWeapon={() => {}}
          onPickSkill={() => {}}
          onPickForge={() => {}}
          onResolveArcana={() => {}}
          onLeave={() => {}}
        />
      );
      assertNoSpireText(`SpireEvent (${ev.id})`, evView.toJSON());
    }

    // 8. SpireTreasure
    const treasView = render(
      <SpireTreasure
        run={baseRun}
        treasure={{ coins: 80, weaponOffer: { weaponId: 'war-drum', level: 2 }, arcanaOffer: 'tempo_surge', claimed: false }}
        onClaim={() => {}}
        onLeave={() => {}}
      />
    );
    assertNoSpireText('SpireTreasure', treasView.toJSON());

    // 9. SpireRewardScreen (Act 3 Boss victory button)
    const rewardView = render(
      <SafeAreaProvider initialMetrics={safeMetrics}>
        <SpireRewardScreen
          run={{ ...baseRun, act: 3 }}
          reward={{
            nodeKind: 'boss',
            foeName: 'The Hydra',
            coinsEarned: 130,
            parryBonusCoins: 10,
            dpm: 900,
            biggestHit: 120,
            parries: 2,
            perfectParries: 1,
            weaponOptions: [{ weaponId: 'war-drum', level: 3 }],
            weaponClaimed: false,
            weaponRerolled: false,
            arcanaOptions: ['tempo_surge'],
            arcanaClaimed: false,
            skillOptions: ['tabby-0-1'],
            skillClaimed: false,
            isActBoss: true,
          }}
          lastFight={null}
          onClaimWeapon={() => {}}
          onRerollWeapons={() => {}}
          onSkipWeapon={() => {}}
          onClaimArcana={() => {}}
          onSkipArcana={() => {}}
          onClaimSkill={() => {}}
          onSkipSkill={() => {}}
          onContinue={() => {}}
        />
      </SafeAreaProvider>
    );
    expect(assertNoSpireText('SpireRewardScreen (Act 3 Boss)', rewardView.toJSON())).toContain('Claim Summit Victory!');

    // 10. SpireEndScreen (Victory & Defeat with undefined defeatedBy)
    const winView = render(
      <SafeAreaProvider initialMetrics={safeMetrics}>
        <SpireEndScreen run={{ ...baseRun, act: 3, phase: 'victory' }} victory lastFight={null} onEnterEndless={() => {}} onNewRun={() => {}} onExitToMenu={() => {}} />
      </SafeAreaProvider>
    );
    expect(assertNoSpireText('SpireEndScreen (victory)', winView.toJSON())).toContain('SUMMIT CONQUERED!');

    const loseView = render(
      <SafeAreaProvider initialMetrics={safeMetrics}>
        <SpireEndScreen run={{ ...baseRun, phase: 'defeat', defeatedBy: undefined }} victory={false} lastFight={null} onNewRun={() => {}} onExitToMenu={() => {}} />
      </SafeAreaProvider>
    );
    expect(assertNoSpireText('SpireEndScreen (defeat)', loseView.toJSON())).toContain('the Summit');
  });
});

describe('Starfall Summit — Strict 6-Weapon Cap (MAX_SUMMIT_WEAPONS = 6) & Inline Swap Flow', () => {
  const makeFullBeltRun = (levels = 2) => {
    const base = createSpireRun('Orange Tabby', 0, 6060);
    const six = ['blast-powder', 'mending-charm', 'flint-spark', 'understudy', 'war-drum', 'snowball'];
    return {
      ...base,
      coins: 300,
      weapons: six,
      weaponLevels: Object.fromEntries(six.map(id => [id, levels])),
    };
  };

  it('enforces MAX_SUMMIT_WEAPONS = 6 in grantSpireWeapon and preserves slot order & clean weaponLevels in replaceSpireWeapon', () => {
    expect(MAX_SUMMIT_WEAPONS).toBe(6);
    const full = makeFullBeltRun(2);
    expect(full.weapons).toHaveLength(6);

    // Adding a 7th unheld weapon via grantSpireWeapon is strictly blocked (returns unchanged!)
    const blocked = grantSpireWeapon(full, 'echo-stone', 3);
    expect(blocked).toBe(full);
    expect(blocked.weapons).toHaveLength(6);
    expect(blocked.weapons).not.toContain('echo-stone');
    expect(blocked.weaponLevels['echo-stone']).toBeUndefined();

    // Upgrading an already-held weapon via grantSpireWeapon succeeds even at 6/6!
    const upgraded = grantSpireWeapon(full, 'blast-powder', 3);
    expect(upgraded.weapons).toHaveLength(6);
    expect(upgraded.weaponLevels['blast-powder']).toBe(3);

    // replaceSpireWeapon replaces in place (preserving slot index 2 right before Understudy at slot 3!)
    const swapped = replaceSpireWeapon(full, 'flint-spark', 'echo-stone', 4);
    expect(swapped.weapons).toHaveLength(6);
    expect(swapped.weapons[2]).toBe('echo-stone');
    expect(swapped.weapons[3]).toBe('understudy');
    expect(swapped.weaponLevels['flint-spark']).toBeUndefined();
    expect(swapped.weaponLevels['echo-stone']).toBe(4);
    expect(Object.keys(swapped.weaponLevels)).toHaveLength(6);

    // Clamps incoming level to 1..5 and guards invalid dropId or already-held newWeaponId
    const clampedHigh = replaceSpireWeapon(full, 'snowball', 'echo-stone', 99);
    expect(clampedHigh.weaponLevels['echo-stone']).toBe(5);
    const clampedLow = replaceSpireWeapon(full, 'snowball', 'echo-stone', 0);
    expect(clampedLow.weaponLevels['echo-stone']).toBe(1);
    expect(replaceSpireWeapon(full, 'not-held', 'echo-stone', 2)).toBe(full);
    expect(replaceSpireWeapon(full, 'snowball', 'blast-powder', 2)).toBe(full);
    expect(replaceSpireWeapon(full, 'snowball', 'snowball', 2)).toBe(full);
  });

  it('enforces <= 6 weapons across Draft, Shop, Treasure Vault, and Mystery Event swaps (and upgrades without swapping)', () => {
    const full = makeFullBeltRun(2);

    // 1. Reward Draft: new weapon at 6/6 requires replaceWeaponId; held weapon upgrades directly
    const rewardState = {
      ...full,
      phase: 'reward' as const,
      reward: {
        nodeKind: 'skirmish' as const,
        foeName: 'Lazy Sloth',
        coinsEarned: 50,
        parryBonusCoins: 0,
        dpm: 500,
        biggestHit: 50,
        parries: 0,
        perfectParries: 0,
        weaponOptions: [
          { weaponId: 'blast-powder', level: 3 },
          { weaponId: 'echo-stone', level: 3 },
        ],
        weaponClaimed: false,
        weaponRerolled: false,
        arcanaOptions: [],
        arcanaClaimed: true,
        skillOptions: [],
        skillClaimed: true,
        isActBoss: false,
      },
    };
    // Missing or invalid replaceWeaponId is a safe no-op
    expect(claimRewardWeapon(rewardState, 1)).toBe(rewardState);
    expect(claimRewardWeapon(rewardState, 1, 'not-held')).toBe(rewardState);
    // Valid swap replaces in place & marks claimed
    const draftSwapped = claimRewardWeapon(rewardState, 1, 'snowball');
    expect(draftSwapped.weapons).toHaveLength(6);
    expect(draftSwapped.weapons[5]).toBe('echo-stone');
    expect(draftSwapped.weaponLevels['snowball']).toBeUndefined();
    expect(draftSwapped.weaponLevels['echo-stone']).toBe(3);
    expect(draftSwapped.reward?.weaponClaimed).toBe(true);
    // Upgrade option requires NO replaceWeaponId
    const draftUp = claimRewardWeapon(rewardState, 0);
    expect(draftUp.weapons).toHaveLength(6);
    expect(draftUp.weaponLevels['blast-powder']).toBe(3);
    expect(draftUp.reward?.weaponClaimed).toBe(true);

    // 2. Merchant Shop: new weapon at 6/6 requires replaceWeaponId, resets any other unsold offer for dropped weapon
    const shopState = {
      ...full,
      phase: 'shop' as const,
      shop: {
        weapons: [
          { weaponId: 'echo-stone', level: 3, price: 70, sold: false, locked: false },
          { weaponId: 'snowball', level: 3, price: 52, sold: false, locked: true },
        ],
        arcana: [],
        upgrades: [],
        healCost: 45,
        healAmount: 2,
        healed: false,
        forgeCost: 55,
        forged: false,
        rerollCost: 25,
        rerolls: 0,
      },
    };
    expect(shopBuyWeapon(shopState, 0)).toBe(shopState);
    const shopSwapped = shopBuyWeapon(shopState, 0, 'snowball');
    expect(shopSwapped.weapons).toHaveLength(6);
    expect(shopSwapped.weapons[5]).toBe('echo-stone');
    expect(shopSwapped.coins).toBe(full.coins - 70);
    expect(shopSwapped.shop?.weapons[0].sold).toBe(true);
    // Unsold upgrade offer for dropped snowball resets to standalone Lv 1 (prevents cheap rebuy exploit)
    expect(shopSwapped.shop?.weapons[1].level).toBe(1);
    expect(shopSwapped.shop?.weapons[1].locked).toBe(false);
    // Buying an upgrade in shop works directly at 6/6 without replaceWeaponId
    const shopUp = shopBuyWeapon(shopState, 1);
    expect(shopUp.weapons).toHaveLength(6);
    expect(shopUp.weaponLevels['snowball']).toBe(3);

    // 3. Treasure Vault: new weapon requires replaceWeaponId; upgrade works directly
    const treasNew = {
      ...full,
      phase: 'treasure' as const,
      treasure: {
        coins: 80,
        weaponOffer: { weaponId: 'echo-stone', level: 3 },
        arcanaOffer: null,
        claimed: false,
      },
    };
    expect(claimTreasure(treasNew, 'weapon')).toBe(treasNew);
    const treasSwapped = claimTreasure(treasNew, 'weapon', 'war-drum');
    expect(treasSwapped.weapons).toHaveLength(6);
    expect(treasSwapped.weapons[4]).toBe('echo-stone');
    expect(treasSwapped.coins).toBe(full.coins + 80);
    expect(treasSwapped.treasure?.claimed).toBe(true);

    // 4. Mystery Events: pendingWeaponOptions swap + blind auto-grant events at 6/6 never exceed 6
    const evPending = {
      ...full,
      phase: 'event' as const,
      event: {
        eventId: 'starfall_shrine',
        resolved: true,
        pendingWeaponOptions: [{ weaponId: 'echo-stone', level: 2 }],
      },
    };
    expect(resolveEventPendingWeapon(evPending, 0)).toBe(evPending);
    const evSwapped = resolveEventPendingWeapon(evPending, 0, 'war-drum');
    expect(evSwapped.weapons).toHaveLength(6);
    expect(evSwapped.weapons[4]).toBe('echo-stone');
    expect(evSwapped.event?.pendingWeaponOptions).toBeUndefined();

    const evSkipped = skipEventPendingWeapon(evPending);
    expect(evSkipped.weapons).toEqual(full.weapons);
    expect(evSkipped.coins).toBe(full.coins + 25);
    expect(evSkipped.event?.pendingWeaponOptions).toBeUndefined();

    // Gambler's Dice high_stakes at 6/6 (upgradeable & all-maxed) NEVER exceeds 6 and always pays real value on win
    let sawUpgradedWin = false;
    let sawMaxedJackpot = false;
    for (let s = 1; s <= 30; s++) {
      const rUp = chooseEventOption(
        { ...full, rngState: s * 1337, phase: 'event', event: { eventId: 'gamblers_dice', resolved: false } },
        'high_stakes'
      );
      expect(rUp.weapons).toHaveLength(6);
      if (rUp.event?.outcomeTitle === 'JACKPOT!') {
        const sumLv = Object.values(rUp.weaponLevels).reduce((a, b) => a + b, 0);
        expect(sumLv).toBe(13); // 6*2 + 1 upgrade!
        expect(rUp.coins).toBe(full.coins - 45 + 135);
        sawUpgradedWin = true;
      }

      const maxed = makeFullBeltRun(5);
      const rMax = chooseEventOption(
        { ...maxed, rngState: s * 1337, phase: 'event', event: { eventId: 'gamblers_dice', resolved: false } },
        'high_stakes'
      );
      expect(rMax.weapons).toHaveLength(6);
      if (rMax.event?.outcomeTitle === 'JACKPOT!') {
        expect(rMax.coins).toBe(maxed.coins - 45 + 235);
        sawMaxedJackpot = true;
      }
    }
    expect(sawUpgradedWin).toBe(true);
    expect(sawMaxedJackpot).toBe(true);

    // Shady Peddler buy_crate at 6/6 NEVER exceeds 6 and opens pendingWeaponOptions (upgrade + Lv 3 swap candidate)
    const crateAtFull = chooseEventOption(
      { ...full, phase: 'event', event: { eventId: 'shady_peddler', resolved: false } },
      'buy_crate'
    );
    expect(crateAtFull.weapons).toHaveLength(6);
    expect(crateAtFull.event?.pendingWeaponOptions?.length).toBeGreaterThanOrEqual(2);
    expect(crateAtFull.event!.pendingWeaponOptions!.some(o => full.weapons.includes(o.weaponId) && o.level >= 3)).toBe(true);
    expect(crateAtFull.event!.pendingWeaponOptions!.some(o => !full.weapons.includes(o.weaponId) && o.level >= 3)).toBe(true);
  });

  it('rollSynergyWeapons prioritizes upgrades at 6/6 and fills cleanly with swap candidates when all 6 are maxed', () => {
    const full = makeFullBeltRun(2);
    const rng = createRng(4242);

    // 3-slot draft at 6/6 with upgradeable weapons: 2 held upgrades + 1 new swap candidate
    for (let i = 0; i < 20; i++) {
      const draft3 = rollSynergyWeapons(full, rng, 3, 1);
      expect(draft3).toHaveLength(3);
      const upgrades = draft3.filter(o => full.weaponLevels[o.weaponId] !== undefined);
      const news = draft3.filter(o => full.weaponLevels[o.weaponId] === undefined);
      expect(upgrades).toHaveLength(2);
      expect(news).toHaveLength(1);
    }

    // 4-slot shop at 6/6 with upgradeable weapons: 2–3 held upgrades + 1–2 new swap candidates
    for (let i = 0; i < 20; i++) {
      const shop4 = rollSynergyWeapons(full, rng, 4, 1);
      expect(shop4).toHaveLength(4);
      const upgrades = shop4.filter(o => full.weaponLevels[o.weaponId] !== undefined);
      const news = shop4.filter(o => full.weaponLevels[o.weaponId] === undefined);
      expect(upgrades.length).toBeGreaterThanOrEqual(2);
      expect(upgrades.length).toBeLessThanOrEqual(3);
      expect(news.length).toBeGreaterThanOrEqual(1);
    }

    // All 6 held weapons maxed (Lv 5): fills cleanly with 3 fresh unheld swap candidates
    const maxed = makeFullBeltRun(5);
    const maxedOffers = rollSynergyWeapons(maxed, rng, 3, 2);
    expect(maxedOffers).toHaveLength(3);
    expect(maxedOffers.every(o => maxed.weaponLevels[o.weaponId] === undefined)).toBe(true);
  });

  it('renders 6/6 badges and interactive inline Swap pickers on SpireRewardScreen, SpireShop, SpireTreasure & SpireEvent with zero "Spire" text', () => {
    const full = makeFullBeltRun(2);
    const collectStrings = (node: unknown, out: string[] = []): string[] => {
      if (node == null) return out;
      if (typeof node === 'string' || typeof node === 'number') {
        const s = String(node).trim();
        if (s) out.push(s);
        return out;
      }
      if (Array.isArray(node)) {
        for (const c of node) collectStrings(c, out);
        return out;
      }
      if (typeof node === 'object') {
        const obj = node as { props?: Record<string, unknown>; children?: unknown[] };
        if (typeof obj.props?.accessibilityLabel === 'string') out.push(obj.props.accessibilityLabel);
        if (obj.children) collectStrings(obj.children, out);
      }
      return out;
    };
    const assertZeroSpire = (tree: unknown) => {
      const all = collectStrings(tree);
      expect(all.filter(s => /spire/i.test(s))).toEqual([]);
      return all.join('\n');
    };

    // Header, BeltBar & BuildModal show 6/6 and FULL indicator (zero "UNCAPPED" or "Spire")
    const header = render(<SpireHeader run={full} onOpenBuild={() => {}} />);
    expect(assertZeroSpire(header.toJSON())).toContain('6/6');

    const belt = render(<SpireBeltBar run={full} onReorder={() => {}} />);
    expect(belt.getByTestId('spire-belt-full-badge')).toBeTruthy();
    expect(assertZeroSpire(belt.toJSON())).toContain('6/6');

    const modal = render(<SpireBuildModal visible run={full} onClose={() => {}} />);
    expect(modal.getByTestId('spire-build-full-badge')).toBeTruthy();
    const modalCopy = assertZeroSpire(modal.toJSON());
    expect(modalCopy).toContain('6/6');
    expect(modalCopy).not.toMatch(/uncapped/i);

    // 1. SpireRewardScreen inline Swap flow
    const onClaimReward = jest.fn();
    const rewardView = render(
      <SpireRewardScreen
        run={full}
        reward={{
          nodeKind: 'skirmish',
          foeName: 'Lazy Sloth',
          coinsEarned: 50,
          parryBonusCoins: 0,
          dpm: 500,
          biggestHit: 40,
          parries: 0,
          perfectParries: 0,
          weaponOptions: [
            { weaponId: 'blast-powder', level: 3 },
            { weaponId: 'echo-stone', level: 3 },
          ],
          weaponClaimed: false,
          weaponRerolled: false,
          arcanaOptions: [],
          arcanaClaimed: true,
          skillOptions: [],
          skillClaimed: true,
          isActBoss: false,
        }}
        lastFight={null}
        onClaimWeapon={onClaimReward}
        onRerollWeapons={() => {}}
        onSkipWeapon={() => {}}
        onClaimArcana={() => {}}
        onSkipArcana={() => {}}
        onClaimSkill={() => {}}
        onSkipSkill={() => {}}
        onContinue={() => {}}
      />
    );
    // Option 0 is Upgrade → claims directly
    fireEvent.press(rewardView.getByTestId('spire-draft-pick-0'));
    expect(onClaimReward).toHaveBeenCalledWith(0);
    // Option 1 is New at 6/6 → opens Swap picker instead of calling onClaimReward yet
    fireEvent.press(rewardView.getByTestId('spire-draft-pick-1'));
    expect(onClaimReward).toHaveBeenCalledTimes(1);
    expect(rewardView.getByTestId('spire-draft-swap-panel')).toBeTruthy();
    expect(assertZeroSpire(rewardView.toJSON())).toContain('Belt Full (6/6)');
    fireEvent.press(rewardView.getByTestId('spire-draft-swap-drop-snowball'));
    expect(onClaimReward).toHaveBeenCalledWith(1, 'snowball');

    // 2. SpireShop inline Swap flow
    const onBuyShop = jest.fn();
    const shopView = render(
      <SpireShop
        run={full}
        shop={{
          weapons: [{ weaponId: 'echo-stone', level: 3, price: 65, sold: false }],
          arcana: [],
          upgrades: [],
          healCost: 45,
          healAmount: 2,
          healed: false,
          forgeCost: 55,
          forged: false,
          rerollCost: 25,
          rerolls: 0,
        }}
        onBuyWeapon={onBuyShop}
        onBuyArcana={() => {}}
        onBuyUpgrade={() => {}}
        onBuyHeal={() => {}}
        onForgeWeapon={() => {}}
        onReroll={() => {}}
        onLeave={() => {}}
      />
    );
    expect(assertZeroSpire(shopView.toJSON())).toContain('Swap 65¢');
    fireEvent.press(shopView.getByTestId('spire-shop-weapon-0'));
    expect(onBuyShop).not.toHaveBeenCalled();
    expect(shopView.getByTestId('spire-shop-swap-panel')).toBeTruthy();
    assertZeroSpire(shopView.toJSON());
    fireEvent.press(shopView.getByTestId('spire-shop-swap-drop-war-drum'));
    expect(onBuyShop).toHaveBeenCalledWith(0, 'war-drum');

    // 3. SpireTreasure inline Swap flow
    const onClaimTreas = jest.fn();
    const treasView = render(
      <SpireTreasure
        run={full}
        treasure={{ coins: 80, weaponOffer: { weaponId: 'echo-stone', level: 3 }, arcanaOffer: null, claimed: false }}
        onClaim={onClaimTreas}
        onLeave={() => {}}
      />
    );
    fireEvent.press(treasView.getByTestId('spire-treasure-weapon-btn'));
    expect(onClaimTreas).not.toHaveBeenCalled();
    expect(treasView.getByTestId('spire-treasure-swap-panel')).toBeTruthy();
    assertZeroSpire(treasView.toJSON());
    fireEvent.press(treasView.getByTestId('spire-treasure-swap-drop-snowball'));
    expect(onClaimTreas).toHaveBeenCalledWith('weapon', 'snowball');

    // 4. SpireEvent inline Swap flow
    const onPickEvWeapon = jest.fn();
    const onSkipEvWeapon = jest.fn();
    const evView = render(
      <SpireEvent
        run={full}
        eventState={{
          eventId: 'shady_peddler',
          resolved: true,
          pendingWeaponOptions: [{ weaponId: 'echo-stone', level: 3 }],
          outcomeTitle: 'Crate',
          outcomeText: 'Swap or skip!',
        }}
        onChoose={() => {}}
        onPickWeapon={onPickEvWeapon}
        onSkipWeapon={onSkipEvWeapon}
        onPickSkill={() => {}}
        onPickForge={() => {}}
        onLeave={() => {}}
      />
    );
    fireEvent.press(evView.getByTestId('spire-event-weapon-0'));
    expect(onPickEvWeapon).not.toHaveBeenCalled();
    expect(evView.getByTestId('spire-event-swap-panel')).toBeTruthy();
    assertZeroSpire(evView.toJSON());
    fireEvent.press(evView.getByTestId('spire-event-swap-drop-flint-spark'));
    expect(onPickEvWeapon).toHaveBeenCalledWith(0, 'flint-spark');
    fireEvent.press(evView.getByTestId('spire-event-weapon-skip'));
    expect(onSkipEvWeapon).toHaveBeenCalledTimes(1);
  });
});
