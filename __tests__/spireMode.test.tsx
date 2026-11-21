/**
 * Starfall Spire — unit, map integrity, event coverage, UI reuse, and persistence tests.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FIGHTERS } from '@/adventure/data/fighters';
import { ALL_ARMORY_WEAPON_IDS } from '@/adventure/data/armory';
import { getUpgrade } from '@/adventure/data/upgrades';
import { loadAdventureSave, writeAdventureSave } from '@/adventure/save';
import { createNewSave } from '@/adventure/progress';
import { generateActMap, reachableNodeIds } from '@/spire/engine/mapGen';
import { SPIRE_EVENTS } from '@/spire/data/events';
import { SPIRE_WEAPON_POOL, STARTER_KITS } from '@/spire/data/encounters';
import {
  ARCANA_PURGE_COST,
  MAX_SHOP_LOCKS,
  SPIRE_EXCLUDED_WEAPONS,
  campfireForge,
  campfireMeditate,
  campfireRest,
  cancelSpirePreview,
  chooseEventOption,
  claimRewardWeapon,
  claimTreasure,
  completeSpireBattle,
  createSpireRun,
  enterEndlessSpire,
  leaveShop,
  reorderSpireWeapon,
  resolveEventPendingArcana,
  retreatSpireBattle,
  rollArcanaOptions,
  rollSynergyWeapons,
  selectSpireNode,
  shopBuyUpgrade,
  shopBuyWeapon,
  shopPurgeArcana,
  shopReroll,
  shopSellWeapon,
  shopToggleLock,
  spireWeaponSellValue,
  startSpireEncounter,
} from '@/spire/engine/runState';
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
import { createInitialSpireMeta, loadSpireRun, resetSpireStorage, syncSpireDiscoveriesToAdventure, writeSpireRun } from '@/spire/save';
import { createRng } from '@/adventure/engine/rng';
import { createRun } from '@/adventure/engine/run';
import { simulateRun, BOTS } from '@/adventure/engine/bot';
import SpireSetup from '@/spire/components/SpireSetup';
import SpireMap from '@/spire/components/SpireMap';
import SpireEncounterPreview from '@/spire/components/SpireEncounterPreview';
import SpireShop from '@/spire/components/SpireShop';
import SpireCampfire from '@/spire/components/SpireCampfire';
import SpireEvent from '@/spire/components/SpireEvent';
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
  return { FighterAvatar: ({ character }: { character: string }) => <RNText>{character}</RNText> };
});
jest.mock('@/components/weapons', () => {
  const { Text: RNText } = require('react-native');
  return { WeaponAvatar: ({ weapon }: { weapon: { name: string } }) => <RNText>{weapon.name}</RNText> };
});

describe('Starfall Spire — Map DAG, Events & Shared Engine Bridge', () => {
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

    // Retreating at 1 ♥ forfeits cleanly to defeat (no infinite save-scumming!)
    const atOneHeart = { ...inFight, hearts: 1 };
    const forfeited = retreatSpireBattle(atOneHeart, 'Lazy Sloth');
    expect(forfeited.phase).toBe('defeat');
    expect(forfeited.hearts).toBe(0);
    expect(forfeited.defeatedBy).toBe('Lazy Sloth');
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

  it('supports Brotato Shop locking (cap 2, survives rerolls & next Shop), weapon selling, Arcana purging, and belt reordering', () => {
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

  it('bridges Spire encounters seamlessly into Adventure createRun with persistent HP and uncapped weapons', () => {
    let run = createSpireRun('Orange Tabby', 0, 777);
    run = { ...run, hearts: 3, weapons: SPIRE_WEAPON_POOL.slice(0, 8) };
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
    expect(fight.weapons.length).toBe(8);
    expect(fight.parry?.spec.attackName).toBe(enc.parry.attackName);
  });

  it('all 10 Mystery Events resolve every option deterministically without errors', () => {
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
    resetSpireStorage();
  });
});

describe('Starfall Spire — Shared UI Components Render Cleanly', () => {
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
    // Floor-1 Act Boss full preview modal (Monster Train Ring-1 Seraph rule)
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
});
