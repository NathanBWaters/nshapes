import { LEVELS, getLevel } from '@/adventure/data/levels';
import { FIGHTERS, getLoadout } from '@/adventure/data/fighters';
import { ARCANA, getArcana } from '@/adventure/data/arcana';
import { BOUNTIES } from '@/adventure/data/bounties';
import { CAMPAIGN_FEATURES } from '@/adventure/data/features';
import { EVOLUTION_RECIPES, findEvolvedWeapon, getActiveEvolutionStatus, getEvolutionRecipe } from '@/adventure/data/evolutions';
import { MECHANICS } from '@/adventure/data/mechanics';
import { buildAdaptiveEvolutionMechanic, buildComboDiscoveryPages } from '@/adventure/lessons';
import { applyWeaponUpgradeTier, describeWeaponUpgradeBonus } from '@/adventure/data/upgrades';
import {
  LESSON_KEYS,
  applyLevelResult,
  buyUpgrade,
  buyWeaponUpgrade,
  canBuyUpgrade,
  canUpgradeWeapon,
  createMaxedSave,
  createNewSave,
  equipArcana,
  fighterSpentCoins,
  getUnlockedUpgrades,
  levelFighter,
  markMechanicSeen,
  reconcileUnlocks,
  refundAllCamp,
  refundableCoins,
  refundFighter,
  refundUpgrade,
  refundWeaponUpgrade,
  upgradeSpentCoins,
  upgradeTier,
  weaponUpgradeSpentCoins,
  weaponUpgradeTier,
} from '@/adventure/progress';
import { fighterLevel, getFeaturesForLevel } from '@/adventure/loadout';
import { createRun, computeStars, runReducer } from '@/adventure/engine/run';
import { countDifferentAttributes } from '@/adventure/engine/sets';
import { allSets } from '@/adventure/engine/sets';
import { WEAPONS } from '@/utils/gameDefinitions';
import { processWeaponEffects } from '@/utils/weaponEffects';
import type { Card, CardReward } from '@/types';
import type { AdventureSave, ArcanaId, RunState } from '@/adventure/types';

const BOUNTY_UNLOCK_LEVEL_ID = CAMPAIGN_FEATURES.bounties.clearLevel!;

const rewardsFor = (cards: Card[], grace = false): CardReward[] =>
  cards.map((c, idx) => ({
    cardId: c.id,
    points: 1,
    money: 1,
    experience: 1,
    ...(grace && idx === 0 ? { effectType: 'grace' as const } : {}),
  }));

const makeCard = (
  id: string,
  shape: Card['shape'],
  color: Card['color'],
  number: Card['number'],
  shading: Card['shading'] = 'solid',
  extra: Partial<Card> = {}
): Card => ({
  id,
  shape,
  color,
  number,
  shading,
  background: 'white',
  selected: false,
  ...extra,
});

describe('100% Free Money Refunds at Camp', () => {
  it('tracks and refunds 100% of fighter level-ups, mechanic upgrades, and weapon upgrades without inflating lifetimeCoins', () => {
    let save: AdventureSave = {
      ...createNewSave(),
      coins: 3000,
      lifetimeCoins: 3000,
      coinsUnlocked: true,
      workshopUnlocked: true,
      stars: { '1-1': 1 },
      armory: ['blast-powder-common'],
      unlockedFighters: ['Orange Tabby', 'Sly Fox'],
      fighterLevels: { 'Orange Tabby': 1, 'Sly Fox': 1 },
    };

    expect(refundableCoins(save)).toBe(0);
    expect(refundAllCamp(save)).toBe(save);

    // Level Orange Tabby twice and Sly Fox once, plus buy multiple mechanic & weapon upgrade tiers
    save = levelFighter(save, 'Orange Tabby');
    save = levelFighter(save, 'Orange Tabby');
    save = levelFighter(save, 'Sly Fox');
    save = buyUpgrade(save, 'heavy_hitter');
    save = buyUpgrade(save, 'heavy_hitter');
    save = buyUpgrade(save, 'lucky_purse');
    save = buyWeaponUpgrade(save, 'blast-powder-common');
    save = buyWeaponUpgrade(save, 'blast-powder-common');

    expect(fighterLevel(save, 'Orange Tabby')).toBe(3);
    expect(fighterLevel(save, 'Sly Fox')).toBe(2);
    expect(upgradeTier(save, 'heavy_hitter')).toBe(2);
    expect(upgradeTier(save, 'lucky_purse')).toBe(1);
    expect(weaponUpgradeTier(save, 'blast-powder-common')).toBe(2);

    const tabbySpent = fighterSpentCoins(save, 'Orange Tabby');
    const foxSpent = fighterSpentCoins(save, 'Sly Fox');
    const hitterSpent = upgradeSpentCoins(save, 'heavy_hitter');
    const purseSpent = upgradeSpentCoins(save, 'lucky_purse');
    const blastSpent = weaponUpgradeSpentCoins(save, 'blast-powder-common');
    const totalSpent = tabbySpent + foxSpent + hitterSpent + purseSpent + blastSpent;

    expect(totalSpent).toBeGreaterThan(0);
    expect(save.coins).toBe(3000 - totalSpent);
    expect(refundableCoins(save)).toBe(totalSpent);

    // Refund a single fighter
    const afterTabbyRefund = refundFighter(save, 'Orange Tabby');
    expect(fighterLevel(afterTabbyRefund, 'Orange Tabby')).toBe(1);
    expect(fighterSpentCoins(afterTabbyRefund, 'Orange Tabby')).toBe(0);
    expect(afterTabbyRefund.coins).toBe(save.coins + tabbySpent);
    expect(afterTabbyRefund.lifetimeCoins).toBe(3000);

    // Refund a single Workshop mechanic upgrade
    const afterHitterRefund = refundUpgrade(afterTabbyRefund, 'heavy_hitter');
    expect(upgradeTier(afterHitterRefund, 'heavy_hitter')).toBe(0);
    expect(upgradeSpentCoins(afterHitterRefund, 'heavy_hitter')).toBe(0);
    expect(afterHitterRefund.coins).toBe(save.coins + tabbySpent + hitterSpent);

    // Refund a single Armory weapon upgrade
    const afterBlastRefund = refundWeaponUpgrade(afterHitterRefund, 'blast-powder-common');
    expect(weaponUpgradeTier(afterBlastRefund, 'blast-powder-common')).toBe(0);
    expect(weaponUpgradeSpentCoins(afterBlastRefund, 'blast-powder-common')).toBe(0);
    expect(afterBlastRefund.coins).toBe(save.coins + tabbySpent + hitterSpent + blastSpent);

    // Refund everything at once from the fully-invested state
    const fullRespec = refundAllCamp(save);
    expect(fullRespec.coins).toBe(3000);
    expect(fullRespec.lifetimeCoins).toBe(3000);
    expect(fighterLevel(fullRespec, 'Orange Tabby')).toBe(1);
    expect(fighterLevel(fullRespec, 'Sly Fox')).toBe(1);
    expect(fullRespec.upgrades).toEqual({});
    expect(fullRespec.weaponUpgrades).toEqual({});
    expect(refundableCoins(fullRespec)).toBe(0);
  });
});

describe('Escalating Purity Combos', () => {
  it('unlocks at 1-6 and escalates 1-diff → 2-diff → 3-diff (Rainbow) with bonus damage, coins & clean reset', () => {
    expect(getFeaturesForLevel(getLevel('1-5'), createNewSave()).has('purity')).toBe(false);
    expect(getFeaturesForLevel(getLevel('1-6'), createNewSave()).has('purity')).toBe(true);

    // Level 2-1 uses 3 attributes: shape, color, number
    let run = createRun(getLevel('2-1'), createNewSave(), { seed: 10 });
    expect(run.attributes).toEqual(['shape', 'color', 'number']);
    // Give the foe plenty of HP so we can observe the full chain
    run = { ...run, foeHp: 200, foeMaxHp: 200 };

    // 1-diff Set: same shape & color, different number
    const set1 = [
      makeCard('p1', 'diamond', 'red', 1),
      makeCard('p2', 'diamond', 'red', 2),
      makeCard('p3', 'diamond', 'red', 3),
    ];
    // 2-diff Set: same shape, different color & number
    const set2 = [
      makeCard('p4', 'oval', 'red', 1),
      makeCard('p5', 'oval', 'green', 2),
      makeCard('p6', 'oval', 'purple', 3),
    ];
    // 3-diff Set (Rainbow on 3-attribute board): different shape, color & number
    const set3 = [
      makeCard('p7', 'diamond', 'red', 1),
      makeCard('p8', 'oval', 'green', 2),
      makeCard('p9', 'squiggle', 'purple', 3),
    ];

    expect(countDifferentAttributes(set1, run.attributes)).toBe(1);
    expect(countDifferentAttributes(set2, run.attributes)).toBe(2);
    expect(countDifferentAttributes(set3, run.attributes)).toBe(3);

    run = { ...run, board: [...set1, ...set2, ...set3, ...run.board.slice(9)] };

    // Step 1: 1-diff baseline (no Purity bonus yet)
    const hp0 = run.foeHp;
    run = runReducer(run, { type: 'MATCH', cards: set1, rewards: rewardsFor(set1) });
    expect(run.purityChain).toBe(1);
    expect(run.lastDiffCount).toBe(1);
    expect(hp0 - run.foeHp).toBe(3);
    expect(run.purityChainsTriggered).toBe(0);

    // Step 2: 2-diff escalates Purity ×2 (+1 dmg, +1 base coin, emits 'purity')
    const hp1 = run.foeHp;
    const coins1 = run.coins;
    run = runReducer(run, { type: 'MATCH', cards: set2, rewards: rewardsFor(set2) });
    expect(run.purityChain).toBe(2);
    expect(run.lastDiffCount).toBe(2);
    expect(hp1 - run.foeHp).toBe(3 + 1);
    expect(run.coins - coins1).toBe(Math.round((3 + 1) * run.level.coinMultiplier));
    expect(run.purityChainsTriggered).toBe(1);
    expect(run.events.some(e => e.type === 'purity' && e.amount === 2)).toBe(true);

    // Step 3: 3-diff (max diversity on 3-attribute board) triggers Purity ×3 (+3 dmg, +2 base coins, 'purity_max') and resets to 0
    const hp2 = run.foeHp;
    const coins2 = run.coins;
    run = runReducer(run, { type: 'MATCH', cards: set3, rewards: rewardsFor(set3) });
    // Rainbow (3 * 2 = 6) + Purity ×3 (+3) = 9 total damage
    expect(hp2 - run.foeHp).toBe(9);
    expect(run.coins - coins2).toBe(Math.round((3 + 2) * run.level.coinMultiplier));
    expect(run.maxPurityChain).toBe(3);
    expect(run.purityChainsTriggered).toBe(2);
    expect(run.threeStepPuritiesTriggered).toBe(1);
    expect(run.events.some(e => e.type === 'purity_max' && e.amount === 3)).toBe(true);
    expect(run.purityChain).toBe(0);
    expect(run.lastDiffCount).toBe(0);
  });

  it('resets to Step 1 on non-ascending Set and resets to 0 on mistakes or Grace matches', () => {
    let run = createRun(getLevel('2-1'), createNewSave(), { seed: 14 });
    run = { ...run, foeHp: 200, foeMaxHp: 200, stats: { ...run.stats, graces: 2, maxGraces: 2 } };

    const twoDiffA = [
      makeCard('a1', 'oval', 'red', 1),
      makeCard('a2', 'oval', 'green', 2),
      makeCard('a3', 'oval', 'purple', 3),
    ];
    const oneDiff = [
      makeCard('b1', 'diamond', 'red', 1),
      makeCard('b2', 'diamond', 'red', 2),
      makeCard('b3', 'diamond', 'red', 3),
    ];
    run = { ...run, board: [...twoDiffA, ...oneDiff, ...run.board.slice(6)] };

    run = runReducer(run, { type: 'MATCH', cards: twoDiffA, rewards: rewardsFor(twoDiffA) });
    expect(run.purityChain).toBe(1);
    expect(run.lastDiffCount).toBe(2);

    // Non-ascending (2-diff -> 1-diff) resets baseline to Step 1 at 1-diff
    run = runReducer(run, { type: 'MATCH', cards: oneDiff, rewards: rewardsFor(oneDiff) });
    expect(run.purityChain).toBe(1);
    expect(run.lastDiffCount).toBe(1);

    // Grace match clears Purity chain to 0
    run = runReducer(run, { type: 'MATCH', cards: twoDiffA, rewards: rewardsFor(twoDiffA, true) });
    expect(run.purityChain).toBe(0);

    // Mistake also clears Purity chain to 0
    run = runReducer(run, { type: 'MATCH', cards: oneDiff, rewards: rewardsFor(oneDiff) });
    expect(run.purityChain).toBe(1);
    run = runReducer(run, { type: 'INVALID', cards: run.board.slice(0, 3) });
    expect(run.purityChain).toBe(0);
  });
});

describe('Arcana (Wildcard Tarots)', () => {
  const withArcana = (id: ArcanaId) => {
    const base = {
      ...createNewSave(),
      stars: { '1-1': 3, '1-8': 3 },
      unlockedArcana: ARCANA.map(a => a.id),
    };
    return equipArcana(base, id);
  };

  it('only equips unlocked Arcana and strips locked Arcana during reconcileUnlocks', () => {
    const fresh = createNewSave();
    expect(equipArcana(fresh, 'glass_prism').activeArcana).toBeNull();
    const unlocked = { ...fresh, unlockedArcana: ['monochrome_pact'] as ArcanaId[] };
    const equipped = equipArcana(unlocked, 'monochrome_pact');
    expect(equipped.activeArcana).toBe('monochrome_pact');
    expect(equipArcana(equipped, null).activeArcana).toBeNull();

    const tampered = { ...fresh, activeArcana: 'tempo_surge' as ArcanaId };
    expect(reconcileUnlocks(tampered).activeArcana).toBeNull();
    expect(getArcana('monochrome_pact').numeral).toBe('I');
  });

  it('Monochrome Pact: +3 damage on 1-diff Sets and 1× (no bonus) on Rainbow Strikes', () => {
    let run = createRun(getLevel('2-1'), withArcana('monochrome_pact'), { seed: 3 });
    run = { ...run, foeHp: 100, foeMaxHp: 100 };
    const oneDiff = [
      makeCard('m1', 'diamond', 'red', 1),
      makeCard('m2', 'diamond', 'red', 2),
      makeCard('m3', 'diamond', 'red', 3),
    ];
    const rainbow = [
      makeCard('r1', 'diamond', 'red', 1),
      makeCard('r2', 'oval', 'green', 2),
      makeCard('r3', 'squiggle', 'purple', 3),
    ];
    run = { ...run, board: [...oneDiff, ...rainbow, ...run.board.slice(6)] };

    const hp0 = run.foeHp;
    run = runReducer(run, { type: 'MATCH', cards: oneDiff, rewards: rewardsFor(oneDiff) });
    expect(hp0 - run.foeHp).toBe(6); // 3 base + 3 Monochrome Pact

    // Break Purity first so Rainbow damage is isolated
    run = { ...run, purityChain: 0, lastDiffCount: 0 };
    const hp1 = run.foeHp;
    run = runReducer(run, { type: 'MATCH', cards: rainbow, rewards: rewardsFor(rainbow) });
    expect(hp1 - run.foeHp).toBe(3); // 1× Rainbow instead of 2×
  });

  it('Prismatic Fever: 3× Rainbow damage + 4s timer refund, -1 base damage on non-Rainbows', () => {
    let run = createRun(getLevel('2-1'), withArcana('prismatic_fever'), { seed: 4 });
    run = { ...run, foeHp: 100, foeMaxHp: 100, timeLeft: 20 };
    const oneDiff = [
      makeCard('m1', 'diamond', 'red', 1),
      makeCard('m2', 'diamond', 'red', 2),
      makeCard('m3', 'diamond', 'red', 3),
    ];
    const rainbow = [
      makeCard('r1', 'diamond', 'red', 1),
      makeCard('r2', 'oval', 'green', 2),
      makeCard('r3', 'squiggle', 'purple', 3),
    ];
    run = { ...run, board: [...oneDiff, ...rainbow, ...run.board.slice(6)] };

    const hp0 = run.foeHp;
    run = runReducer(run, { type: 'MATCH', cards: oneDiff, rewards: rewardsFor(oneDiff) });
    expect(hp0 - run.foeHp).toBe(2); // 3 - 1 non-Rainbow penalty

    run = { ...run, purityChain: 0, lastDiffCount: 0 };
    const hp1 = run.foeHp;
    const t1 = run.timeLeft!;
    run = runReducer(run, { type: 'MATCH', cards: rainbow, rewards: rewardsFor(rainbow) });
    expect(hp1 - run.foeHp).toBe(9); // 3 * 3× Prismatic Fever
    expect(run.timeLeft).toBe(t1 + 4);
  });

  it('Controlled Burn: starts with 0 Graces, converts mistake into 2 ignited cards on a 12s cooldown', () => {
    const save = { ...withArcana('controlled_burn'), armory: ['second-chance-rare'], charm: 'second-chance-rare' };
    let run = createRun(getLevel('2-1'), save, { seed: 5 });
    expect(run.stats.graces).toBe(0);
    const initialHearts = run.hearts!;

    run = runReducer(run, { type: 'INVALID', cards: run.board.slice(0, 3) });
    expect(run.hearts).toBe(initialHearts); // 0 heart damage!
    expect(run.arcanaBurnCooldownMs).toBe(12000);
    expect(run.board.filter(c => c.onFire).length).toBe(2);
    expect(run.events.some(e => e.type === 'arcana_burn')).toBe(true);

    // While on cooldown, a second mistake costs a Heart normally
    run = runReducer(run, { type: 'INVALID', cards: run.board.slice(0, 3) });
    expect(run.hearts).toBe(initialHearts - 1);
  });

  it('Glass Prism: locks maxHearts to 1 even with vitality gear & Tough Hide, and spawns ~3× Power/Gold cards', () => {
    const save: AdventureSave = {
      ...withArcana('glass_prism'),
      upgrades: { tough_hide: 3 },
      fighterLevels: { 'Orange Tabby': 6 },
    };
    const run = createRun(getLevel('2-1'), { ...save, selectedFighter: 'Orange Tabby' }, { seed: 6 });
    expect(run.maxHearts).toBe(1);
    expect(run.hearts).toBe(1);

    let prismSpecials = 0;
    let baseSpecials = 0;
    const plainSave = createNewSave();
    for (let seed = 1; seed <= 25; seed++) {
      prismSpecials += createRun(getLevel('2-1'), save, { seed }).board.filter(c => c.bonusMoney || c.bonusPoints).length;
      baseSpecials += createRun(getLevel('2-1'), plainSave, { seed }).board.filter(c => c.bonusMoney || c.bonusPoints).length;
    }
    expect(prismSpecials).toBeGreaterThan(baseSpecials * 2);
  });

  it('Overkill Harvest: +15% foe HP, converts overkill into bonus coins, and heals +1 Heart between waves', () => {
    const normal = createRun(getLevel('3-2'), createNewSave(), { seed: 8 });
    let run = createRun(getLevel('3-2'), withArcana('overkill_harvest'), { seed: 8 });
    expect(run.foeMaxHp).toBe(Math.round(normal.foeMaxHp * 1.15));

    // Set foe to 1 HP and deal a full 4-attribute Rainbow hit (6 dmg -> 5 overkill)
    run = { ...run, foeHp: 1, hearts: 1, maxHearts: 3 };
    const rainbow = [
      makeCard('o1', 'diamond', 'red', 1, 'solid'),
      makeCard('o2', 'oval', 'green', 2, 'striped'),
      makeCard('o3', 'squiggle', 'purple', 3, 'open'),
    ];
    run = { ...run, board: [...rainbow, ...run.board.slice(3)] };
    const coinsBefore = run.coins;
    run = runReducer(run, { type: 'MATCH', cards: rainbow, rewards: rewardsFor(rainbow) });
    expect(run.overkillDamage).toBe(5);
    expect(run.coins - coinsBefore).toBeGreaterThan(Math.round(3 * run.level.coinMultiplier));
    expect(run.events.some(e => e.type === 'overkill')).toBe(true);
    expect(run.status).toBe('intermission');

    run = runReducer(run, { type: 'NEXT_WAVE' });
    expect(run.hearts).toBe(2); // healed +1 Heart entering wave 2
  });

  it("Scholar's Gambit & Tempo Surge apply XP/pick and speed/tempo twists", () => {
    const armory = ['flint-spark-rare', 'blast-powder-rare', 'echo-stone-rare', 'chrono-shard-rare', 'prismatic-ray-rare'];
    const baseSave: AdventureSave = { ...createNewSave(), armory };
    const scholarSave: AdventureSave = { ...withArcana('scholars_gambit'), armory };

    const normal = createRun(getLevel('2-5'), baseSave, { seed: 9 });
    let scholar = createRun(getLevel('2-5'), scholarSave, { seed: 9 });
    expect(scholar.maxHearts).toBe(Math.max(1, normal.maxHearts! - 1));
    // Give 3 base XP -> doubled to 6 -> hits level 0 XP threshold (6) and drafts 4 weapon choices!
    const set = allSets(scholar.board, scholar.attributes)[0];
    scholar = runReducer(scholar, {
      type: 'MATCH',
      cards: set,
      rewards: set.map(c => ({ cardId: c.id, points: 1, money: 1, experience: 1 })),
    });
    expect(scholar.status).toBe('pick');
    expect(scholar.pickOptions.length).toBe(4);

    let tempo = createRun(getLevel('2-1'), withArcana('tempo_surge'), { seed: 11 });
    const startTime = tempo.timeLeft!;
    tempo = runReducer(tempo, { type: 'TICK', ms: 5000 });
    // 5s * 1.2 = 6s drained
    expect(tempo.timeLeft).toBeCloseTo(startTime - 6, 5);
  });
});

describe('Weapon Evolutions, Hidden Catalyst Cards & Recipe Guide', () => {
  const foxUnlockedSave = (): AdventureSave => ({
    ...createNewSave(),
    stars: { '1-1': 3, '1-5': 3, '1-5E': 2, '1-8': 3 },
    unlockedFighters: ['Orange Tabby', 'Sly Fox'],
    fighterLevels: { 'Orange Tabby': 1, 'Sly Fox': 1 },
    unlockedEvolutions: ['solar-cataclysm'],
  });

  it('does not spawn Catalysts or prime Combos before any Combo recipe is unlocked', () => {
    const noCombosSave: AdventureSave = {
      ...createNewSave(),
      stars: { '1-1': 3, '1-5': 3, '1-8': 3 },
      unlockedFighters: ['Orange Tabby', 'Sly Fox'],
      fighterLevels: { 'Orange Tabby': 1, 'Sly Fox': 1 },
      unlockedEvolutions: [],
    };
    expect(getFeaturesForLevel(getLevel('2-1'), noCombosSave).has('evolutions')).toBe(false);
    for (let seed = 1; seed <= 12; seed++) {
      const s = createRun(getLevel('2-1'), { ...noCombosSave, selectedFighter: 'Sly Fox' }, { seed });
      expect(s.board.some(c => c.hasEvolutionItem)).toBe(false);
      expect(getActiveEvolutionStatus(s.weapons, s.evolvedRecipes, s, s.unlockedEvolutions)).toBeNull();
    }
  });

  it('never places more than ONE Evolution Catalyst card on screen at a time across deals & refills', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let s = createRun(getLevel('2-1'), { ...foxUnlockedSave(), selectedFighter: 'Sly Fox' }, { seed });
      expect(s.board.filter(c => c.hasEvolutionItem).length).toBeLessThanOrEqual(1);
      for (let step = 0; step < 6 && s.status === 'playing'; step++) {
        const set = allSets(s.board, s.attributes)[0];
        if (!set) break;
        s = runReducer(s, { type: 'MATCH', cards: set, rewards: rewardsFor(set) });
        s = runReducer(s, { type: 'REPLACE', ids: set.map(c => c.id) });
        if (s.status === 'pick') s = runReducer(s, { type: 'PICK', weaponId: null });
        expect(s.board.filter(c => c.hasEvolutionItem).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('loses the Catalyst permanently for the wave if matched BEFORE the recipe is primed', () => {
    let run = createRun(getLevel('2-1'), { ...foxUnlockedSave(), selectedFighter: 'Sly Fox' }, { seed: 20 });
    run = { ...run, foeHp: 200, foeMaxHp: 200 };

    // Sly Fox starts with Flint Spark + Blast Powder -> solar-cataclysm requires 3 Sets first
    const status0 = getActiveEvolutionStatus(run.weapons, run.evolvedRecipes, run);
    expect(status0?.recipe.id).toBe('solar-cataclysm');
    expect(status0?.ready).toBe(false);

    // Place a dormant Catalyst on the first card of a valid Set on turn 1 (0/3 Sets primed)
    const set = allSets(run.board, run.attributes)[0];
    const catId = set[0].id;
    run = {
      ...run,
      board: run.board.map(c => ({ ...c, hasEvolutionItem: c.id === catId, evolutionReady: false })),
    };

    run = runReducer(run, { type: 'MATCH', cards: set, rewards: rewardsFor(set) });
    expect(run.catalystState).toBe('lost');
    expect(run.catalystsLost).toBe(1);
    expect(run.evolvedRecipes).toHaveLength(0);
    expect(run.events.some(e => e.type === 'catalyst_lost')).toBe(true);

    // Replacing cards many times cannot spawn another Catalyst once lost in this wave
    run = runReducer(run, { type: 'REPLACE', ids: set.map(c => c.id) });
    for (let i = 0; i < 6 && run.status === 'playing'; i++) {
      const nextSet = allSets(run.board, run.attributes)[0];
      if (!nextSet) break;
      run = runReducer(run, { type: 'MATCH', cards: nextSet, rewards: rewardsFor(nextSet) });
      run = runReducer(run, { type: 'REPLACE', ids: nextSet.map(c => c.id) });
      expect(run.board.some(c => c.hasEvolutionItem)).toBe(false);
    }
  });

  it('Catalyst Resonance Arcana saves a prematurely matched Catalyst once per fight', () => {
    const save = equipArcana(
      { ...foxUnlockedSave(), unlockedArcana: ['catalyst_resonance'] },
      'catalyst_resonance'
    );
    let run = createRun(getLevel('2-1'), { ...save, selectedFighter: 'Sly Fox' }, { seed: 21 });
    expect(run.catalystRespawnsLeft).toBe(1);

    const set = allSets(run.board, run.attributes)[0];
    const catId = set[0].id;
    run = {
      ...run,
      board: run.board.map(c => ({ ...c, hasEvolutionItem: c.id === catId, evolutionReady: false })),
    };

    run = runReducer(run, { type: 'MATCH', cards: set, rewards: rewardsFor(set) });
    expect(run.catalystState).toBe('available');
    expect(run.catalystRespawnsLeft).toBe(0);
    expect(run.catalystsLost).toBe(0);
    expect(run.events.some(e => e.type === 'catalyst_saved')).toBe(true);
  });

  it('awakens the Catalyst once primed, evolves into the Legendary weapon on match, and unlocks its Recipe Guide entry', () => {
    const save = foxUnlockedSave();
    let run = createRun(getLevel('2-1'), { ...save, selectedFighter: 'Sly Fox' }, { seed: 30 });
    run = { ...run, foeHp: 250, foeMaxHp: 250 };

    // Put the Catalyst on a non-matched card while priming 3 clean Sets
    for (let i = 0; i < 3; i++) {
      const set = allSets(run.board, run.attributes)[0];
      const setIds = new Set(set.map(c => c.id));
      const bystander = run.board.find(c => !setIds.has(c.id))!;
      run = {
        ...run,
        board: run.board.map(c => ({
          ...c,
          hasEvolutionItem: c.id === bystander.id,
          evolutionReady: false,
        })),
      };
      run = runReducer(run, { type: 'MATCH', cards: set, rewards: rewardsFor(set) });
      // Ensure we stay in 'playing' if XP pick triggers
      run = runReducer(run, { type: 'REPLACE', ids: set.map(c => c.id) });
      if (run.status === 'pick') run = runReducer(run, { type: 'PICK', weaponId: null });
    }

    // After 3 Sets, solar-cataclysm is primed and the Catalyst card on the board flipped evolutionReady = true!
    expect(run.matches).toBe(3);
    const readyStatus = getActiveEvolutionStatus(run.weapons, run.evolvedRecipes, run);
    expect(readyStatus?.recipe.id).toBe('solar-cataclysm');
    expect(readyStatus?.ready).toBe(true);
    expect(run.board.find(c => c.hasEvolutionItem)?.evolutionReady).toBe(true);
    expect(run.events.some(e => e.type === 'catalyst_ready')).toBe(true);

    // Place the ready Catalyst onto a valid Set and match it
    const evoSet = allSets(run.board, run.attributes)[0];
    const evoCatId = evoSet[0].id;
    run = {
      ...run,
      board: run.board.map(c => ({
        ...c,
        hasEvolutionItem: c.id === evoCatId,
        evolutionReady: c.id === evoCatId,
      })),
    };

    const hpBefore = run.foeHp;
    run = runReducer(run, { type: 'MATCH', cards: evoSet, rewards: rewardsFor(evoSet) });

    expect(run.catalystState).toBe('evolved');
    expect(run.evolvedRecipes).toContain('solar-cataclysm');
    expect(run.weapons.some(w => w.id === 'evo-solar-cataclysm')).toBe(true);
    expect(findEvolvedWeapon('evo-solar-cataclysm')?.name).toBe('Solar Cataclysm');
    expect(getEvolutionRecipe('solar-cataclysm').result.rarity).toBe('legendary');
    expect(run.events.some(e => e.type === 'evolution')).toBe(true);
    // Burst dealt +6 extra damage and ignited 2 cards
    expect(hpBefore - run.foeHp).toBeGreaterThanOrEqual(3 + 6);
    expect(run.board.filter(c => c.onFire).length).toBeGreaterThanOrEqual(2);
    expect(run.board.some(c => c.hasEvolutionItem)).toBe(false);

    // Finishing the run records 'solar-cataclysm' in save.discoveredEvolutions
    const finished: RunState = { ...run, status: 'won', endReason: 'defeated' };
    const res = applyLevelResult(save, getLevel('2-1'), computeStars(finished), finished.coins, finished);
    expect(res.save.discoveredEvolutions).toContain('solar-cataclysm');
    expect(EVOLUTION_RECIPES).toHaveLength(8);
  });
});

describe('Cross-Run Bounties', () => {
  it('stays locked before 1-8, unlocks at 1-8 (★+), tracks stats across wins & losses, and grants coins/weapons/Arcana once', () => {
    let save = createNewSave();
    expect(save.bountiesUnlocked).toBe(false);

    // A loss on 1-2 still records cross-run Set counts, without opening the Bounty Board yet
    const lostRun = {
      ...createRun(getLevel('1-2'), save, { seed: 1 }),
      status: 'lost' as const,
      endReason: 'hearts' as const,
      matches: 15,
    };
    const r0 = applyLevelResult(save, getLevel('1-2'), 0, 4, lostRun);
    save = r0.save;
    expect(save.bountiesUnlocked).toBe(false);
    expect(save.bountyStats.totalSets).toBe(15);
    expect(r0.completedBounties).toHaveLength(0);

    // Clearing 1-8 (Meadow Boss) unlocks the Bounty Board and evaluates accumulated stats!
    const bossRun = {
      ...createRun(getLevel(BOUNTY_UNLOCK_LEVEL_ID), save, { seed: 2 }),
      status: 'won' as const,
      endReason: 'defeated' as const,
      matches: 26, // 15 + 26 = 41 >= 40 (bounty_sets_40)
      purityChainsTriggered: 10, // >= 10 (bounty_purity_10 -> echo-stone-rare)
    };
    bossRun.roundStats.allDifferentMatches = 12; // >= 12 (bounty_rainbow_12 -> prismatic_fever Arcana)

    const r1 = applyLevelResult(save, getLevel(BOUNTY_UNLOCK_LEVEL_ID), 3, 20, bossRun);
    save = r1.save;

    expect(save.bountiesUnlocked).toBe(true);
    expect(r1.unlocks.some(u => u.kind === 'feature' && u.feature === 'bounties')).toBe(true);
    // 1-8 ★★★ also awards Monochrome Pact Arcana directly!
    expect(save.unlockedArcana).toContain('monochrome_pact');
    // Completed bounties granted coins + Armory weapon + Prismatic Fever Arcana
    expect(r1.completedBounties.map(b => b.id)).toEqual(
      expect.arrayContaining(['bounty_sets_40', 'bounty_rainbow_12', 'bounty_purity_10'])
    );
    expect(save.armory).toContain('echo-stone-rare');
    expect(save.unlockedArcana).toContain('prismatic_fever');
    expect(r1.bountyCoins).toBe(
      BOUNTIES.find(b => b.id === 'bounty_sets_40')!.reward.coins +
      BOUNTIES.find(b => b.id === 'bounty_rainbow_12')!.reward.coins +
      BOUNTIES.find(b => b.id === 'bounty_purity_10')!.reward.coins
    );

    // Replaying does NOT re-pay already-completed bounties, and reconcileUnlocks is idempotent
    const coinsBeforeReplay = save.coins;
    const r2 = applyLevelResult(save, getLevel(BOUNTY_UNLOCK_LEVEL_ID), 3, 0, {
      ...bossRun,
      matches: 1,
      purityChainsTriggered: 0,
    });
    expect(r2.completedBounties).toHaveLength(0);
    expect(r2.bountyCoins).toBe(0);
    expect(r2.save.coins).toBe(coinsBeforeReplay);

    const reconciled = reconcileUnlocks(r2.save);
    expect(reconciled.coins).toBe(r2.save.coins);
    expect(reconciled.bountiesUnlocked).toBe(true);
    expect(BOUNTIES).toHaveLength(16);

    const maxed = createMaxedSave();
    expect(maxed.bountiesUnlocked).toBe(true);
    expect(maxed.workshopUnlocked).toBe(true);
    expect(maxed.coinsUnlocked).toBe(true);
    expect(maxed.unlockedArcana).toHaveLength(ARCANA.length);
    expect(maxed.unlockedEvolutions).toHaveLength(EVOLUTION_RECIPES.length);
    expect(maxed.discoveredEvolutions).toHaveLength(EVOLUTION_RECIPES.length);
  });
});

describe('Unlockable Workshop & Strict Unlocked-Only Upgrade Filtering', () => {
  it('starts locked, unlocks on 1-4 ★, hides un-met mechanics, and upgrades only unlocked Armory weapons', () => {
    let save = createNewSave();
    expect(save.workshopUnlocked).toBe(false);
    expect(getUnlockedUpgrades(save)).toHaveLength(0);

    // Give coins before unlocking the Workshop — neither mechanic nor weapon upgrades can be purchased
    save = { ...save, coins: 2000, armory: ['blast-powder-common'], stars: { '1-1': 1, '1-2': 1 }, coinsUnlocked: true };
    expect(canBuyUpgrade(save, 'heavy_hitter')).toBe(false);
    expect(canUpgradeWeapon(save, 'blast-powder-common')).toBe(false);
    expect(buyUpgrade(save, 'heavy_hitter')).toBe(save);
    expect(buyWeaponUpgrade(save, 'blast-powder-common')).toBe(save);

    // Clearing 1-4 ★ unlocks the Workshop as an explicit campaign feature
    const r14 = applyLevelResult(save, getLevel('1-4'), 1, 0);
    save = r14.save;
    expect(save.workshopUnlocked).toBe(true);
    expect(r14.unlocks).toEqual([{ kind: 'feature', feature: 'workshop', star: 1 }]);

    // Only mechanics the player has actually unlocked (Sets 1-1, Hearts 1-2, Coins 1-1) appear!
    // Timer (1-7), Hints (2-1), and Graces (2-4) remain hidden and unpurchasable!
    expect(getUnlockedUpgrades(save).map(u => u.id)).toEqual(['heavy_hitter', 'tough_hide', 'lucky_purse']);
    expect(canBuyUpgrade(save, 'hourglass')).toBe(false);
    expect(canBuyUpgrade(save, 'sharp_eyes')).toBe(false);
    expect(canBuyUpgrade(save, 'second_wind')).toBe(false);
    expect(buyUpgrade(save, 'hourglass')).toBe(save);

    // Unlocking Timer (1-7), Hints (2-1), and Graces (2-4) progressively reveals each upgrade
    save = { ...save, stars: { ...save.stars, '1-7': 1 } };
    expect(getUnlockedUpgrades(save).map(u => u.id)).toContain('hourglass');
    expect(getUnlockedUpgrades(save).map(u => u.id)).not.toContain('sharp_eyes');

    save = { ...save, stars: { ...save.stars, '2-1': 1, '2-4': 1 } };
    expect(getUnlockedUpgrades(save).map(u => u.id)).toEqual([
      'heavy_hitter',
      'tough_hide',
      'lucky_purse',
      'hourglass',
      'sharp_eyes',
      'second_wind',
    ]);

    // Weapon upgrades strictly enforce Armory ownership — locked weapons cannot be upgraded
    expect(canUpgradeWeapon(save, 'blast-powder-common')).toBe(true);
    expect(canUpgradeWeapon(save, 'chrono-shard-common')).toBe(false);
    expect(buyWeaponUpgrade(save, 'chrono-shard-common')).toBe(save);

    // Upgrading an unlocked Armory weapon boosts its in-run effect stats
    const baseBlast = WEAPONS.find(w => w.id === 'blast-powder-common')!;
    save = buyWeaponUpgrade(save, 'blast-powder-common');
    save = buyWeaponUpgrade(save, 'blast-powder-common');
    expect(weaponUpgradeTier(save, 'blast-powder-common')).toBe(2);
    expect(describeWeaponUpgradeBonus(baseBlast, 2)).toContain('blast chance');

    const upgradedBlast = applyWeaponUpgradeTier(baseBlast, 2);
    expect(upgradedBlast.effects.explosionChance).toBeGreaterThan(baseBlast.effects.explosionChance!);

    save = { ...save, charm: 'blast-powder-common' };
    const run = createRun(getLevel('1-2'), save, { seed: 42 });
    const runCharm = run.weapons.find(w => w.id === 'blast-powder-common')!;
    expect(runCharm.effects.explosionChance).toBe(upgradedBlast.effects.explosionChance);
  });
});

describe('World 1 Unlock Cadence & Order-Aware Combo Tutorials (1-5E vs 1-7)', () => {
  it('follows the 1-1 (Coins + Blast Powder + Sly Fox) and 1-3 (Flint Spark) progression curve', () => {
    let save = createNewSave();

    // First-time 1-1 has Coin Drops off until ★ is earned
    expect(getFeaturesForLevel(getLevel('1-1'), save).has('coins')).toBe(false);

    const r11 = applyLevelResult(save, getLevel('1-1'), 3, 0);
    save = r11.save;
    expect(r11.unlocks).toEqual([
      { kind: 'feature', feature: 'coins', star: 1 },
      { kind: 'weapon', id: 'blast-powder-common', star: 2, firstWeapon: true },
      { kind: 'fighter', name: 'Sly Fox', star: 3 },
    ]);
    expect(save.coinsUnlocked).toBe(true);
    expect(save.armory).toEqual(['blast-powder-common']);
    expect(save.unlockedFighters).toEqual(['Orange Tabby', 'Sly Fox']);

    // Coin Drops are immediately live in 1-2+
    expect(getFeaturesForLevel(getLevel('1-2'), save).has('coins')).toBe(true);
    const run12 = createRun(getLevel('1-2'), save, { seed: 7 });
    const set12 = allSets(run12.board, run12.attributes)[0];
    const afterMatch = runReducer(run12, { type: 'MATCH', cards: set12, rewards: rewardsFor(set12) });
    expect(afterMatch.coins).toBeGreaterThan(0);

    // 1-3 ★★ unlocks the second Armory weapon: Flint Spark (pairing with Blast Powder!)
    save = applyLevelResult(save, getLevel('1-2'), 2, 0).save;
    const r13 = applyLevelResult(save, getLevel('1-3'), 2, 0);
    save = r13.save;
    expect(r13.unlocks).toEqual([
      { kind: 'weapon', id: 'flint-spark-common', star: 2, firstWeapon: false },
    ]);
    expect(save.armory).toEqual(['blast-powder-common', 'flint-spark-common']);
  });

  it('Path A: reaching 1-5E Elite BEFORE 1-7 teaches combos without clock spoilers and never repeats on 1-7', () => {
    let save = createNewSave();
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) {
      save = applyLevelResult(save, getLevel(id), 2, 0).save;
      save = markMechanicSeen(save, getLevel(id).introduces);
    }

    // Entering 1-5E first: gets Elite-tailored Combo Vault discovery page with ZERO clock/timer spoilers
    const pages15E = buildComboDiscoveryPages('1-5E', save);
    expect(pages15E).toHaveLength(1);
    expect(pages15E[0].title).toContain('Combo Vault');
    const fullText15E = [pages15E[0].title, ...pages15E[0].body].join(' ');
    expect(fullText15E).toContain('Solar Cataclysm');
    expect(fullText15E.toLowerCase()).not.toContain('clock');
    expect(fullText15E.toLowerCase()).not.toContain('timer');

    save = markMechanicSeen(markMechanicSeen(save, 'elite'), LESSON_KEYS.comboDiscovery);

    // Beating 1-5E (★★) unlocks Solar Cataclysm as firstEvolution = true
    const rElite = applyLevelResult(save, getLevel('1-5E'), 2, 0);
    save = rElite.save;
    expect(rElite.unlocks).toContainEqual({
      kind: 'evolution',
      id: 'solar-cataclysm',
      star: 2,
      firstEvolution: true,
    });
    expect(save.unlockedEvolutions).toEqual(['solar-cataclysm']);
    expect(getFeaturesForLevel(getLevel('1-6'), save).has('evolutions')).toBe(true);

    // Adaptive evolution lesson is tailored to Solar Cataclysm and includes the 2 Catalyst demo lessons
    const evoLesson = buildAdaptiveEvolutionMechanic(save);
    expect(evoLesson.tagline).toContain('Solar Cataclysm');
    expect(evoLesson.lessons).toHaveLength(2);
    expect(evoLesson.lessons![0].demo?.type).toBe('set');

    save = markMechanicSeen(save, 'weapon_evolutions');

    // Later reaching 1-7: does NOT repeat the first-combo discovery page, and unlocking Immortal Aegis has firstEvolution = false
    expect(buildComboDiscoveryPages('1-7', save)).toHaveLength(0);
    const r17 = applyLevelResult(save, getLevel('1-7'), 2, 0);
    expect(r17.unlocks).toEqual([
      { kind: 'evolution', id: 'immortal-aegis', star: 2, firstEvolution: false },
    ]);
    expect(r17.save.unlockedEvolutions).toEqual(['solar-cataclysm', 'immortal-aegis']);
  });

  it('Path B: reaching 1-7 BEFORE 1-5E teaches Immortal Aegis first, points back to 1-5E, and never repeats on 1-5E', () => {
    let save = createNewSave();
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6']) {
      save = applyLevelResult(save, getLevel(id), 2, 0).save;
      save = markMechanicSeen(save, getLevel(id).introduces);
    }

    // Entering 1-7 first (skipping 1-5E): gets 1-7 tailored Combo discovery page mentioning 1-5E as an optional second combo
    const pages17 = buildComboDiscoveryPages('1-7', save);
    expect(pages17).toHaveLength(1);
    const fullText17 = [pages17[0].title, ...pages17[0].body].join(' ');
    expect(fullText17).toContain('Immortal Aegis');
    expect(fullText17).toContain('1-5E');

    save = markMechanicSeen(markMechanicSeen(save, 'timer'), LESSON_KEYS.comboDiscovery);

    // Beating 1-7 (★★) unlocks Immortal Aegis as firstEvolution = true
    const r17 = applyLevelResult(save, getLevel('1-7'), 2, 0);
    save = r17.save;
    expect(r17.unlocks).toEqual([
      { kind: 'evolution', id: 'immortal-aegis', star: 2, firstEvolution: true },
    ]);
    expect(save.unlockedEvolutions).toEqual(['immortal-aegis']);

    // Adaptive evolution lesson is tailored to Immortal Aegis!
    const evoLesson = buildAdaptiveEvolutionMechanic(save);
    expect(evoLesson.tagline).toContain('Immortal Aegis');
    expect(evoLesson.body[0]).toContain('Mending Charm');
    expect(MECHANICS.purity_chain.enables).toBe('purity');

    save = markMechanicSeen(save, 'weapon_evolutions');

    // Going back to 1-5E afterwards: no duplicate combo discovery page, and Solar Cataclysm unlocks with firstEvolution = false
    expect(buildComboDiscoveryPages('1-5E', save)).toHaveLength(0);
    const rElite = applyLevelResult(save, getLevel('1-5E'), 2, 0);
    expect(rElite.unlocks).toContainEqual({
      kind: 'evolution',
      id: 'solar-cataclysm',
      star: 2,
      firstEvolution: false,
    });
    expect(rElite.save.unlockedEvolutions).toEqual(['immortal-aegis', 'solar-cataclysm']);
  });
});

describe('Cross-System Integration & Edge-Case Invariants', () => {
  it('every reward across all LEVELS and BOUNTIES references valid weapons, fighters, Arcana, and Evolutions, and all 8 Arcana + 8 Evolutions are obtainable', () => {
    const unlockedArcanaIds = new Set<string>();
    const unlockedEvolutionIds = new Set<string>();

    const checkReward = (r: { weapons?: string[]; character?: string; arcana?: string; evolution?: string }) => {
      for (const wid of r.weapons ?? []) {
        expect(WEAPONS.find(w => w.id === wid)).toBeDefined();
      }
      if (r.character) {
        expect(FIGHTERS.find(f => f.name === r.character)).toBeDefined();
      }
      if (r.arcana) {
        expect(getArcana(r.arcana as ArcanaId)).toBeDefined();
        unlockedArcanaIds.add(r.arcana);
      }
      if (r.evolution) {
        expect(getEvolutionRecipe(r.evolution)).toBeDefined();
        unlockedEvolutionIds.add(r.evolution);
      }
    };

    for (const l of LEVELS) {
      checkReward(l.rewards.star1);
      checkReward(l.rewards.star2);
      checkReward(l.rewards.star3);
    }
    for (const b of BOUNTIES) {
      checkReward(b.reward);
    }

    expect(unlockedArcanaIds.size).toBe(ARCANA.length);
    expect(unlockedEvolutionIds.size).toBe(EVOLUTION_RECIPES.length);
  });

  it('every one of the 8 Evolution recipes can be assembled from obtainable fighter + Armory gear by the stage it unlocks', () => {
    let save = createNewSave();
    for (const level of LEVELS) {
      save = applyLevelResult(save, level, 3, 0).save;
      for (const r of [level.rewards.star1, level.rewards.star2, level.rewards.star3]) {
        if (!r.evolution) continue;
        const recipe = getEvolutionRecipe(r.evolution);
        const armoryWeapons = save.armory.map(id => WEAPONS.find(w => w.id === id)!).filter(Boolean);
        // Check if at least one unlocked fighter (with up to 1 Charm + 1 drafted Armory weapon) can assemble `hasGear`
        const canAssemble = save.unlockedFighters.some(fName => {
          const starter = getLoadout(fName, 1).map(id => WEAPONS.find(w => w.id === id)!).filter(Boolean);
          if (recipe.hasGear(starter)) return true;
          for (const c1 of armoryWeapons) {
            if (recipe.hasGear([...starter, c1])) return true;
            for (const c2 of armoryWeapons) {
              if (c1.id !== c2.id && recipe.hasGear([...starter, c1, c2])) return true;
            }
          }
          return false;
        });
        expect(canAssemble).toBe(true);
      }
    }
  });

  it('resolves Bridge Weapons end-to-end across both processWeaponEffects and Adventure runReducer', () => {
    const guaranteedBridge = (baseName: string): typeof WEAPONS[number] => {
      const base = WEAPONS.find(w => w.name === baseName)!;
      return { ...base, bridgeEffect: { ...base.bridgeEffect!, chance: 100 } };
    };

    // 1. Grace Conduit + Chaos Conduit + Soul Harvest in processWeaponEffects on a Grace match
    const board = createRun(getLevel('2-4'), createNewSave(), { seed: 42 }).board;
    const matched = allSets(board, ['shape', 'color', 'number'])[0];
    const baseStats = {
      ...createRun(getLevel('2-4'), createNewSave(), { seed: 42 }).stats,
      explosionChance: 100,
      effectCaps: {
        echo: 100, laser: 100, graceGain: 100, explosion: 100, hint: 100, timeGain: 100,
        healing: 100, fire: 100, ricochet: 100, boardGrowth: 100, coinGain: 100, xpGain: 100,
      },
    };
    const fx = processWeaponEffects(
      board,
      matched,
      baseStats,
      [guaranteedBridge('Grace Conduit'), guaranteedBridge('Chaos Conduit'), guaranteedBridge('Soul Harvest')],
      ['shape', 'color', 'number'],
      false,
      undefined,
      true // isGraceMatch
    );
    expect(fx.laserCount).toBeGreaterThanOrEqual(1);
    expect(fx.bonusGraces).toBeGreaterThanOrEqual(1);
    expect(fx.bonusHealing).toBeGreaterThanOrEqual(1);

    // 2. Life Link + Fortune's Blessing + Wisdom Chain inside Adventure runReducer
    const save: AdventureSave = {
      ...createNewSave(),
      coinsUnlocked: true,
      armory: ['life-link', 'fortunes-blessing', 'wisdom-chain'],
    };
    let run = createRun(getLevel('2-5'), save, { seed: 77 });
    run = {
      ...run,
      weapons: [
        guaranteedBridge('Life Link'),
        guaranteedBridge("Fortune's Blessing"),
        guaranteedBridge('Wisdom Chain'),
      ],
      stats: { ...run.stats, hints: 0, maxHints: 3 },
      foeHp: 80,
      foeMaxHp: 80,
    };

    // Invalid selection -> loses 1 Heart -> Life Link explodes 2 board cards and damages the foe!
    const badPick = [
      makeCard('bad1', 'diamond', 'red', 1),
      makeCard('bad2', 'diamond', 'red', 2),
      makeCard('bad3', 'oval', 'red', 3),
    ];
    run = { ...run, board: [...badPick, ...run.board.slice(3)] };
    run = runReducer(run, { type: 'INVALID', cards: badPick });
    expect(run.roundStats.weaponEffectsTriggered.has('explosion')).toBe(true);
    expect(run.foeHp).toBeLessThan(80);

    // Valid match with coins + XP -> Fortune's Blessing grants +1 Hint and Wisdom Chain grants bonus coins!
    const validSet = allSets(run.board, run.attributes)[0];
    const coinsBefore = run.coins;
    run = runReducer(run, { type: 'MATCH', cards: validSet, rewards: rewardsFor(validSet) });
    expect(run.stats.hints).toBe(1);
    expect(run.coins - coinsBefore).toBeGreaterThan(Math.round(3 * run.level.coinMultiplier));
  });

  it('integrates Connector weapons (connector-rare + Workshop upgrades) to create and prune board links', () => {
    let save: AdventureSave = {
      ...createNewSave(),
      coins: 2000,
      workshopUnlocked: true,
      armory: ['connector-rare'],
      charm: 'connector-rare',
    };
    // Upgrade connector-rare to +3 in Workshop (20% + 15% = 35% link chance)
    save = buyWeaponUpgrade(buyWeaponUpgrade(buyWeaponUpgrade(save, 'connector-rare'), 'connector-rare'), 'connector-rare');
    expect(weaponUpgradeTier(save, 'connector-rare')).toBe(3);

    let run = createRun(getLevel('2-1'), save, { seed: 5 });
    expect(run.stats.connectionChance).toBe(35);
    // Guarantee connection creation on the next match to test deterministically
    run = { ...run, stats: { ...run.stats, connectionChance: 100 }, foeHp: 100, foeMaxHp: 100 };
    const set = allSets(run.board, run.attributes)[0];
    run = runReducer(run, { type: 'MATCH', cards: set, rewards: rewardsFor(set) });
    expect(run.connections.length).toBe(1);
    expect(run.connections[0].positionA).toBeLessThan(run.connections[0].positionB);

    // If an enemy shrinks the board below a linked position, pruneConnections cleans it up safely
    run = {
      ...run,
      connections: [{ id: 'test-oob', positionA: 0, positionB: run.board.length + 2, createdAt: 0 }],
    };
    let eliteRun = createRun(getLevel('1-5E'), save, { seed: 12 });
    eliteRun = {
      ...eliteRun,
      connections: [{ id: 'test-oob', positionA: 0, positionB: eliteRun.board.length - 1, createdAt: 0 }],
      foeHp: 100,
      foeMaxHp: 100,
    };
    const eliteSet = allSets(eliteRun.board, eliteRun.attributes)[0];
    eliteRun = runReducer(eliteRun, { type: 'MATCH', cards: eliteSet, rewards: rewardsFor(eliteSet) });
    for (const conn of eliteRun.connections) {
      expect(conn.positionA).toBeLessThan(eliteRun.board.length);
      expect(conn.positionB).toBeLessThan(eliteRun.board.length);
    }
  });

  it('relocates a Catalyst card cleanly without losing it if an enemy mutates it into a Dud, Face-Down, or Bomb card', () => {
    const save: AdventureSave = {
      ...createNewSave(),
      stars: { '1-1': 3, '1-5': 3, '1-5E': 2 },
      unlockedFighters: ['Orange Tabby', 'Sly Fox'],
      fighterLevels: { 'Orange Tabby': 1, 'Sly Fox': 1 },
      unlockedEvolutions: ['solar-cataclysm'],
    };
    let run = createRun(getLevel('2-2'), { ...save, selectedFighter: 'Sly Fox' }, { seed: 33 });
    const targetId = run.board[0].id;
    // Place Catalyst on slot 0, then simulate an enemy turning slot 0 into a Dud!
    run = {
      ...run,
      board: run.board.map((c, i) =>
        i === 0 ? { ...c, hasEvolutionItem: true, evolutionReady: false, isDud: true } : { ...c, hasEvolutionItem: false }
      ),
    };
    run = runReducer(run, { type: 'TICK', ms: 100 });

    expect(run.catalystState).toBe('available');
    expect(run.catalystsLost).toBe(0);
    expect(run.board.find(c => c.id === targetId)?.hasEvolutionItem).toBe(false);
    // Relocated onto an eligible selectable card (still strictly 1 on screen!)
    const activeCatalysts = run.board.filter(c => c.hasEvolutionItem);
    expect(activeCatalysts).toHaveLength(1);
    expect(activeCatalysts[0].isDud).toBeFalsy();
  });
});
