/**
 * Starfall Spire — pure deterministic state machine.
 *
 * Every transition (node selection, fight completion, weapon/Arcana/skill
 * drafting, Merchant Shop purchases, Campfire rest/forge/meditate, Mystery
 * Events, Treasure Vaults, Act progression, Endless Starfall) is a pure
 * function on `SpireRun` so runs are 100% reproducible, auto-save cleanly,
 * and can be simulated end-to-end by the headless balance bot!
 */
import type { CharacterName } from '@/types';
import type { ArcanaId, RunState } from '@/adventure/types';
import { ARCANA } from '@/adventure/data/arcana';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { skillTreeOf } from '@/adventure/data/skillTrees';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { damagePerMinute } from '@/adventure/history';
import { createRng, type Rng } from '@/adventure/engine/rng';
import { ascensionModifiers } from '../data/ascensions';
import { generateSpireEncounter, SPIRE_WEAPON_POOL, STARTER_KITS } from '../data/encounters';
import { getSpireEvent } from '../data/events';
import { generateActMap, reachableNodeIds } from './mapGen';
import { newEvolutionsArmedBy } from './bridge';
import type {
  SpireCampfireState,
  SpireEncounter,
  SpireRewardBundle,
  SpireRun,
  SpireShopState,
  SpireShopUpgradeKind,
  SpireShopUpgradeOffer,
  SpireTreasureState,
} from '../types';

export const SKIP_WEAPON_COINS = 25;
export const REWARD_REROLL_COST = 20;

const withRng = <T>(run: SpireRun, fn: (rng: Rng) => { run: SpireRun; out?: T }): SpireRun => {
  const rng = createRng(run.rngState);
  const res = fn(rng);
  return { ...res.run, rngState: rng.state };
};

/** Pick `count` unheld weapons, biasing slot 0 toward a weapon that arms a NEW Evolution! */
export const rollSynergyWeapons = (
  run: Pick<SpireRun, 'weapons' | 'weaponLevels' | 'act'>,
  rng: Rng,
  count: number,
  minLevel = 1
): { weaponId: string; level: number }[] => {
  const unheld = SPIRE_WEAPON_POOL.filter(id => !run.weapons.includes(id));
  if (unheld.length === 0) return [];
  const synergy = unheld.filter(id => newEvolutionsArmedBy(run, id).length > 0);
  const chosen: string[] = [];

  if (synergy.length > 0 && rng.next() < 0.72) {
    chosen.push(rng.pick(synergy));
  }
  const remaining = rng.shuffle(unheld.filter(id => !chosen.includes(id)));
  for (const id of remaining) {
    if (chosen.length >= count) break;
    chosen.push(id);
  }

  return chosen.map(weaponId => {
    // Higher acts occasionally offer pre-levelled weapons so late pickups stay exciting!
    const bonusLv = run.act >= 3 && rng.next() < 0.45 ? 1 : run.act >= 2 && rng.next() < 0.25 ? 1 : 0;
    const level = Math.min(MAX_WEAPON_LEVEL, Math.max(minLevel, 1 + bonusLv));
    return { weaponId, level };
  });
};

/** Pick `count` Fighter Skill Tree nodes not yet owned (prioritizing nodes linked to already-owned nodes / roots!). */
export const rollSkillNodeOptions = (
  run: Pick<SpireRun, 'fighter' | 'skillNodes'>,
  rng: Rng,
  count: number
): string[] => {
  const tree = skillTreeOf(run.fighter);
  const owned = new Set(run.skillNodes);
  const unowned = tree.filter(n => !owned.has(n.id));
  if (unowned.length === 0) return [];
  // Prefer nodes adjacent to roots or owned nodes so the fighter's tree grows organically
  const frontier = unowned.filter(n => n.roots.length > 0 || n.links.some(l => owned.has(l)));
  const pool = frontier.length >= count ? frontier : unowned;
  return rng.shuffle(pool).slice(0, count).map(n => n.id);
};

/** Pick `count` Arcana wildcards not yet equipped. */
export const rollArcanaOptions = (
  run: Pick<SpireRun, 'arcana'>,
  rng: Rng,
  count: number
): ArcanaId[] => {
  const unheld = ARCANA.map(a => a.id).filter(id => !run.arcana.includes(id));
  return rng.shuffle(unheld).slice(0, count);
};

/** Add a weapon (or level it up if already held). */
export const grantSpireWeapon = (run: SpireRun, weaponId: string, level = 1): SpireRun => {
  const existing = run.weaponLevels[weaponId];
  if (existing !== undefined) {
    return {
      ...run,
      weaponLevels: {
        ...run.weaponLevels,
        [weaponId]: Math.min(MAX_WEAPON_LEVEL, existing + Math.max(1, level)),
      },
    };
  }
  return {
    ...run,
    weapons: [...run.weapons, weaponId],
    weaponLevels: { ...run.weaponLevels, [weaponId]: Math.min(MAX_WEAPON_LEVEL, Math.max(1, level)) },
  };
};

export const upgradeSpireWeapon = (run: SpireRun, weaponId: string, delta = 1): SpireRun => {
  const cur = run.weaponLevels[weaponId];
  if (cur === undefined) return run;
  return {
    ...run,
    weaponLevels: {
      ...run.weaponLevels,
      [weaponId]: Math.min(MAX_WEAPON_LEVEL, cur + delta),
    },
  };
};

const SHOP_UPGRADE_CATALOG: readonly {
  kind: SpireShopUpgradeKind;
  name: string;
  description: string;
  icon: SpireShopUpgradeOffer['icon'];
  basePrice: number;
}[] = [
  { kind: 'heavy_hitter', name: 'Heavy Hitter', description: '+1 flat damage on every Set.', icon: 'lorc/fist', basePrice: 70 },
  { kind: 'tough_hide', name: 'Vital Vessel', description: '+1 Max Heart & heal +1 ♥ now.', icon: 'lorc/shining-heart', basePrice: 75 },
  { kind: 'hourglass', name: 'Hourglass', description: '+10s on every future fight clock.', icon: 'lorc/hourglass', basePrice: 60 },
  { kind: 'sharp_eyes', name: 'Sharp Eyes', description: '+1 Starting Hint every fight.', icon: 'lorc/light-bulb', basePrice: 55 },
  { kind: 'second_wind', name: 'Second Wind', description: '+1 Starting Grace every fight.', icon: 'lorc/clover', basePrice: 60 },
  { kind: 'evolution_lab', name: 'Evolution Lab', description: '+5% Catalyst chance on every refill.', icon: 'lorc/fizzing-flask', basePrice: 80 },
];

const buildShopState = (run: SpireRun, rng: Rng, rerolls = 0): SpireShopState => {
  const asc = ascensionModifiers(run.ascension);
  const priceScale = asc.shopPriceScale * (1 + (run.act - 1) * 0.12);
  const offers = rollSynergyWeapons(run, rng, 4);
  const saleIdx = offers.length > 0 ? Math.floor(rng.next() * offers.length) : -1;

  const weapons = offers.map((o, i) => {
    const w = getArmoryWeapon(o.weaponId);
    const base = Math.max(40, Math.round(((w?.price ?? 25) * 2.2 + (o.level - 1) * 28) * priceScale));
    const onSale = i === saleIdx;
    return {
      weaponId: o.weaponId,
      level: o.level,
      price: onSale ? Math.max(25, Math.round(base * 0.55)) : base,
      onSale,
      sold: false,
    };
  });

  const arcanaIds = rollArcanaOptions(run, rng, 2);
  const arcana = arcanaIds.map(arcanaId => ({
    arcanaId,
    price: Math.round(95 * priceScale),
    sold: false,
  }));

  const upgrades = rng.shuffle([...SHOP_UPGRADE_CATALOG]).slice(0, 2).map(u => ({
    kind: u.kind,
    name: u.name,
    description: u.description,
    icon: u.icon,
    price: Math.round(u.basePrice * priceScale),
    sold: false,
  }));

  return {
    weapons,
    arcana,
    upgrades,
    healCost: Math.round(45 * priceScale),
    healAmount: Math.max(2, Math.ceil(run.maxHearts * 0.4)),
    healed: false,
    forgeCost: Math.round(65 * priceScale),
    forged: false,
    rerollCost: Math.round((25 + rerolls * 15) * asc.shopPriceScale),
    rerolls,
  };
};

// ─── Start Run ──────────────────────────────────────────────────────────────

export const createSpireRun = (fighter: CharacterName, ascension: number, seed: number): SpireRun => {
  const kit = STARTER_KITS[fighter];
  const asc = ascensionModifiers(ascension);
  const rng = createRng((seed ^ 0x51a2fa11) >>> 0);
  const maxHearts = Math.max(3, kit.maxHearts + asc.maxHeartsDelta);
  const coins = Math.max(20, kit.startingCoins + asc.startingCoinsDelta);
  const map = generateActMap(1, seed, ascension, []);

  return {
    version: 1,
    id: `spire-${seed}-${ascension}`,
    seed,
    rngState: rng.state,
    fighter,
    ascension,
    act: 1,
    endless: false,
    floor: 0,
    phase: 'map',
    hearts: maxHearts,
    maxHearts,
    coins,
    startingHints: kit.startingHints,
    startingGraces: kit.startingGraces,
    bonusClockSeconds: 0,
    bonusDamagePerMatch: 0,
    evolutionLabTier: 1, // Spire starts with Evolution Lab active so Catalysts flow early!
    extraEvolutionCap: 0,
    extraEvolutionLikelihood: 4,
    weapons: [kit.starterWeapon, kit.bonusWeapon],
    weaponLevels: { [kit.starterWeapon]: 1, [kit.bonusWeapon]: 1 },
    arcana: [],
    skillNodes: [],
    map,
    currentNodeId: null,
    activeEncounter: null,
    seenEvents: [],
    reward: null,
    shop: null,
    campfire: null,
    event: null,
    treasure: null,
    stats: {
      floorsCleared: 0,
      skirmishesWon: 0,
      elitesWon: 0,
      bossesWon: 0,
      totalDamage: 0,
      biggestHit: 0,
      peakDpm: 0,
      totalSets: 0,
      parries: 0,
      perfectParries: 0,
      evolutionsForged: 0,
      forgedRecipeIds: [],
      coinsSpent: 0,
      eventsResolved: 0,
    },
  };
};

// ─── Node Selection ─────────────────────────────────────────────────────────

export const selectSpireNode = (run: SpireRun, nodeId: string): SpireRun => {
  if (run.phase !== 'map') return run;
  const reachable = reachableNodeIds(run.map, run.currentNodeId);
  if (!reachable.includes(nodeId)) return run;
  const node = run.map.nodes.find(n => n.id === nodeId);
  if (!node) return run;

  const updatedMap = {
    ...run.map,
    nodes: run.map.nodes.map(n => (n.id === nodeId ? { ...n, visited: true } : n)),
  };
  const base: SpireRun = {
    ...run,
    map: updatedMap,
    currentNodeId: nodeId,
    floor: run.floor + 1,
    reward: null,
    shop: null,
    campfire: null,
    event: null,
    treasure: null,
  };

  if (node.kind === 'skirmish' || node.kind === 'elite' || node.kind === 'boss') {
    return {
      ...base,
      phase: 'preview',
      activeEncounter: node.encounter ?? null,
    };
  }

  if (node.kind === 'shop') {
    return withRng(base, rng => ({
      run: { ...base, phase: 'shop', shop: buildShopState(base, rng, 0) },
    }));
  }

  if (node.kind === 'campfire') {
    return withRng(base, rng => {
      const campfire: SpireCampfireState = {
        healAmount: Math.max(2, Math.ceil(base.maxHearts * 0.5)),
        skillOptions: rollSkillNodeOptions(base, rng, 3),
        resolved: false,
      };
      return { run: { ...base, phase: 'campfire', campfire } };
    });
  }

  if (node.kind === 'treasure') {
    return withRng(base, rng => {
      const offer = rollSynergyWeapons(base, rng, 1, 2)[0] ?? { weaponId: SPIRE_WEAPON_POOL[0], level: 2 };
      const arc = rollArcanaOptions(base, rng, 1)[0] ?? null;
      const treasure: SpireTreasureState = {
        coins: 55 + base.act * 25,
        weaponOffer: offer,
        arcanaOffer: arc,
        claimed: false,
      };
      return { run: { ...base, phase: 'treasure', treasure } };
    });
  }

  // Mystery Event
  const eventId = node.eventId ?? 'starfall_shrine';
  const seenEvents = base.seenEvents.includes(eventId) ? base.seenEvents : [...base.seenEvents, eventId];
  return {
    ...base,
    seenEvents,
    phase: 'event',
    event: { eventId, resolved: false },
  };
};

export const startSpireEncounter = (run: SpireRun): SpireRun => {
  if (run.phase !== 'preview' || !run.activeEncounter) return run;
  return { ...run, phase: 'fight' };
};

export const cancelSpirePreview = (run: SpireRun): SpireRun => {
  // Note: once a node is entered in Slay the Spire you're committed, OR allow peeking back cleanly if you haven't fought yet!
  if (run.phase !== 'preview') return run;
  return { ...run, phase: 'fight' };
};

// ─── Battle Completion ──────────────────────────────────────────────────────

/**
 * Resolve a finished Spire combat (`AdventureRun` handed back `RunState`).
 * In Starfall Spire, you MUST knock out the foe (`endReason === 'defeated'`) to
 * clear the floor—running out of time OR hearts ends the run!
 */
export const completeSpireBattle = (run: SpireRun, fight: RunState): SpireRun => {
  const enc = run.activeEncounter;
  if (!enc) return run;

  const won = fight.status === 'won' && fight.endReason === 'defeated';
  const dpm = damagePerMinute(fight);
  const mergedRecipes = [...new Set([...run.stats.forgedRecipeIds, ...fight.forgedRecipes])];

  const nextStats = {
    ...run.stats,
    floorsCleared: run.stats.floorsCleared + (won ? 1 : 0),
    skirmishesWon: run.stats.skirmishesWon + (won && enc.kind === 'skirmish' ? 1 : 0),
    elitesWon: run.stats.elitesWon + (won && enc.kind === 'elite' ? 1 : 0),
    bossesWon: run.stats.bossesWon + (won && enc.kind === 'boss' ? 1 : 0),
    totalDamage: run.stats.totalDamage + fight.totalDamage,
    biggestHit: Math.max(run.stats.biggestHit, fight.biggestHit),
    peakDpm: Math.max(run.stats.peakDpm, dpm),
    totalSets: run.stats.totalSets + fight.matches,
    parries: run.stats.parries + fight.parriesLanded,
    perfectParries: run.stats.perfectParries + fight.perfectParriesLanded,
    evolutionsForged: run.stats.evolutionsForged + fight.evolutionsTriggered,
    forgedRecipeIds: mergedRecipes,
  };

  if (!won) {
    return {
      ...run,
      hearts: 0,
      phase: 'defeat',
      stats: nextStats,
      defeatedBy: fight.foeName,
    };
  }

  // Carry over remaining hearts (clamped 1..maxHearts) + small post-fight breather on Bosses!
  const remainingHearts = Math.max(1, Math.min(run.maxHearts, fight.hearts ?? run.hearts));
  const parryBonusCoins = fight.parriesLanded * 4 + fight.perfectParriesLanded * 6;
  const coinsEarned = enc.coinReward + Math.round(fight.coins * 0.65) + parryBonusCoins;

  return withRng(run, rng => {
    const weaponOptions = rollSynergyWeapons(run, rng, 3, enc.kind === 'boss' ? 2 : 1);
    const arcanaOptions = enc.kind === 'elite' || enc.kind === 'boss' ? rollArcanaOptions(run, rng, 3) : [];
    const skillOptions = enc.kind === 'elite' || enc.kind === 'boss' ? rollSkillNodeOptions(run, rng, 3) : [];

    const reward: SpireRewardBundle = {
      nodeKind: enc.kind,
      foeName: fight.foeName,
      coinsEarned,
      parryBonusCoins,
      dpm,
      biggestHit: fight.biggestHit,
      parries: fight.parriesLanded,
      perfectParries: fight.perfectParriesLanded,
      weaponOptions,
      weaponClaimed: weaponOptions.length === 0,
      weaponRerolled: false,
      arcanaOptions,
      arcanaClaimed: arcanaOptions.length === 0,
      skillOptions,
      skillClaimed: skillOptions.length === 0,
      isActBoss: enc.kind === 'boss',
    };

    return {
      run: {
        ...run,
        hearts: remainingHearts,
        coins: run.coins + coinsEarned,
        phase: 'reward',
        reward,
        stats: nextStats,
      },
    };
  });
};

// ─── Post-Battle Rewards ────────────────────────────────────────────────────

export const claimRewardWeapon = (run: SpireRun, index: number): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.weaponClaimed) return run;
  const pick = run.reward.weaponOptions[index];
  if (!pick) return run;
  const next = grantSpireWeapon(run, pick.weaponId, pick.level);
  return { ...next, reward: { ...run.reward, weaponClaimed: true } };
};

export const rerollRewardWeapons = (run: SpireRun): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.weaponClaimed || run.reward.weaponRerolled) return run;
  if (run.coins < REWARD_REROLL_COST) return run;
  return withRng(run, rng => {
    const fresh = rollSynergyWeapons(run, rng, 3, run.reward!.isActBoss ? 2 : 1);
    return {
      run: {
        ...run,
        coins: run.coins - REWARD_REROLL_COST,
        stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + REWARD_REROLL_COST },
        reward: { ...run.reward!, weaponOptions: fresh, weaponRerolled: true },
      },
    };
  });
};

export const skipRewardWeapon = (run: SpireRun): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.weaponClaimed) return run;
  return {
    ...run,
    coins: run.coins + SKIP_WEAPON_COINS,
    reward: { ...run.reward, weaponClaimed: true },
  };
};

export const claimRewardArcana = (run: SpireRun, arcanaId: ArcanaId): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.arcanaClaimed) return run;
  if (!run.reward.arcanaOptions.includes(arcanaId)) return run;
  const arcana = run.arcana.includes(arcanaId) ? run.arcana : [...run.arcana, arcanaId];
  return { ...run, arcana, reward: { ...run.reward, arcanaClaimed: true } };
};

export const skipRewardArcana = (run: SpireRun): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.arcanaClaimed) return run;
  return { ...run, reward: { ...run.reward, arcanaClaimed: true } };
};

export const claimRewardSkillNode = (run: SpireRun, nodeId: string): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.skillClaimed) return run;
  if (!run.reward.skillOptions.includes(nodeId)) return run;
  const skillNodes = run.skillNodes.includes(nodeId) ? run.skillNodes : [...run.skillNodes, nodeId];
  return { ...run, skillNodes, reward: { ...run.reward, skillClaimed: true } };
};

export const skipRewardSkillNode = (run: SpireRun): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.skillClaimed) return run;
  return { ...run, reward: { ...run.reward, skillClaimed: true } };
};

export const finishSpireRewards = (run: SpireRun): SpireRun => {
  if (run.phase !== 'reward' || !run.reward) return run;
  const isBoss = run.reward.isActBoss;
  const cleaned: SpireRun = { ...run, reward: null, activeEncounter: null };
  if (!isBoss) {
    return { ...cleaned, phase: 'map' };
  }
  // Act 3 Boss beaten for the first time → SPIRE VICTORY (with option to Enter Endless Starfall!)
  if (cleaned.act === 3 && !cleaned.endless) {
    return { ...cleaned, phase: 'victory' };
  }
  // Act 1, Act 2, or Endless Act 4+ → advance smoothly to next Act with inter-act recovery!
  return advanceToNextAct(cleaned);
};

export const advanceToNextAct = (run: SpireRun): SpireRun => {
  const nextAct = run.act + 1;
  // Between Acts: restore 50% of missing hearts + +1 Max Heart reward for slaying an Act Boss!
  const nextMaxHearts = run.maxHearts + 1;
  const healed = Math.min(nextMaxHearts, run.hearts + Math.max(2, Math.ceil((nextMaxHearts - run.hearts) * 0.6)));
  const map = generateActMap(nextAct, run.seed, run.ascension, run.seenEvents);
  return {
    ...run,
    act: nextAct,
    maxHearts: nextMaxHearts,
    hearts: healed,
    map,
    currentNodeId: null,
    activeEncounter: null,
    reward: null,
    phase: 'map',
  };
};

export const enterEndlessSpire = (run: SpireRun): SpireRun => {
  if (run.phase !== 'victory') return run;
  return advanceToNextAct({ ...run, endless: true });
};

// ─── Merchant Shop ──────────────────────────────────────────────────────────

export const shopBuyWeapon = (run: SpireRun, index: number): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const offer = run.shop.weapons[index];
  if (!offer || offer.sold || run.coins < offer.price) return run;
  const next = grantSpireWeapon(run, offer.weaponId, offer.level);
  return {
    ...next,
    coins: run.coins - offer.price,
    stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + offer.price },
    shop: {
      ...run.shop,
      weapons: run.shop.weapons.map((w, i) => (i === index ? { ...w, sold: true } : w)),
    },
  };
};

export const shopBuyArcana = (run: SpireRun, index: number): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const offer = run.shop.arcana[index];
  if (!offer || offer.sold || run.coins < offer.price) return run;
  const arcana = run.arcana.includes(offer.arcanaId) ? run.arcana : [...run.arcana, offer.arcanaId];
  return {
    ...run,
    arcana,
    coins: run.coins - offer.price,
    stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + offer.price },
    shop: {
      ...run.shop,
      arcana: run.shop.arcana.map((a, i) => (i === index ? { ...a, sold: true } : a)),
    },
  };
};

export const shopBuyUpgrade = (run: SpireRun, index: number): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const offer = run.shop.upgrades[index];
  if (!offer || offer.sold || run.coins < offer.price) return run;
  let next: SpireRun = {
    ...run,
    coins: run.coins - offer.price,
    stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + offer.price },
    shop: {
      ...run.shop,
      upgrades: run.shop.upgrades.map((u, i) => (i === index ? { ...u, sold: true } : u)),
    },
  };
  switch (offer.kind) {
    case 'heavy_hitter':
      next = { ...next, bonusDamagePerMatch: next.bonusDamagePerMatch + 1 };
      break;
    case 'tough_hide':
      next = { ...next, maxHearts: next.maxHearts + 1, hearts: Math.min(next.maxHearts + 1, next.hearts + 1) };
      break;
    case 'hourglass':
      next = { ...next, bonusClockSeconds: next.bonusClockSeconds + 10 };
      break;
    case 'sharp_eyes':
      next = { ...next, startingHints: next.startingHints + 1 };
      break;
    case 'second_wind':
      next = { ...next, startingGraces: next.startingGraces + 1 };
      break;
    case 'evolution_lab':
      next = { ...next, evolutionLabTier: next.evolutionLabTier + 1, extraEvolutionLikelihood: next.extraEvolutionLikelihood + 1 };
      break;
  }
  return next;
};

export const shopBuyHeal = (run: SpireRun): SpireRun => {
  if (run.phase !== 'shop' || !run.shop || run.shop.healed) return run;
  if (run.coins < run.shop.healCost || run.hearts >= run.maxHearts) return run;
  return {
    ...run,
    hearts: Math.min(run.maxHearts, run.hearts + run.shop.healAmount),
    coins: run.coins - run.shop.healCost,
    stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + run.shop.healCost },
    shop: { ...run.shop, healed: true },
  };
};

export const shopForgeWeapon = (run: SpireRun, weaponId: string): SpireRun => {
  if (run.phase !== 'shop' || !run.shop || run.shop.forged) return run;
  const curLv = run.weaponLevels[weaponId];
  if (curLv === undefined || curLv >= MAX_WEAPON_LEVEL || run.coins < run.shop.forgeCost) return run;
  const upgraded = upgradeSpireWeapon(run, weaponId, 1);
  return {
    ...upgraded,
    coins: run.coins - run.shop.forgeCost,
    stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + run.shop.forgeCost },
    shop: { ...run.shop, forged: true },
  };
};

export const shopReroll = (run: SpireRun): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  if (run.coins < run.shop.rerollCost) return run;
  const cost = run.shop.rerollCost;
  const nextRerolls = run.shop.rerolls + 1;
  return withRng(run, rng => {
    const fresh = buildShopState(run, rng, nextRerolls);
    return {
      run: {
        ...run,
        coins: run.coins - cost,
        stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + cost },
        shop: { ...fresh, healed: run.shop!.healed, forged: run.shop!.forged },
      },
    };
  });
};

export const leaveShop = (run: SpireRun): SpireRun => {
  if (run.phase !== 'shop') return run;
  return { ...run, shop: null, phase: 'map' };
};

// ─── Campfire (Rest / Forge / Meditate) ─────────────────────────────────────

export const campfireRest = (run: SpireRun): SpireRun => {
  if (run.phase !== 'campfire' || !run.campfire || run.campfire.resolved) return run;
  const before = run.hearts;
  const after = Math.min(run.maxHearts, before + run.campfire.healAmount);
  const gained = after - before;
  return {
    ...run,
    hearts: after,
    campfire: {
      ...run.campfire,
      resolved: true,
      outcomeText: gained > 0 ? `Rested by the embers and recovered +${gained} ♥ (${after}/${run.maxHearts}).` : 'Already at full hearts — warmed up for the climb!',
    },
  };
};

export const campfireForge = (run: SpireRun, weaponId: string): SpireRun => {
  if (run.phase !== 'campfire' || !run.campfire || run.campfire.resolved) return run;
  const cur = run.weaponLevels[weaponId];
  if (cur === undefined || cur >= MAX_WEAPON_LEVEL) return run;
  const next = upgradeSpireWeapon(run, weaponId, 1);
  const wName = getArmoryWeapon(weaponId)?.name ?? weaponId;
  return {
    ...next,
    campfire: {
      ...run.campfire,
      resolved: true,
      outcomeText: `Forged ${wName} to Level ${cur + 1}!`,
    },
  };
};

export const campfireMeditate = (run: SpireRun, nodeId: string): SpireRun => {
  if (run.phase !== 'campfire' || !run.campfire || run.campfire.resolved) return run;
  if (!run.campfire.skillOptions.includes(nodeId)) return run;
  const skillNodes = run.skillNodes.includes(nodeId) ? run.skillNodes : [...run.skillNodes, nodeId];
  const nodeName = skillTreeOf(run.fighter).find(n => n.id === nodeId)?.name ?? 'Technique';
  return {
    ...run,
    skillNodes,
    campfire: {
      ...run.campfire,
      resolved: true,
      outcomeText: `Mastered ${nodeName} for the rest of this Spire climb!`,
    },
  };
};

export const leaveCampfire = (run: SpireRun): SpireRun => {
  if (run.phase !== 'campfire') return run;
  return { ...run, campfire: null, phase: 'map' };
};

// ─── Treasure Vault ─────────────────────────────────────────────────────────

export const claimTreasure = (run: SpireRun, choice: 'weapon' | 'arcana' | 'coins'): SpireRun => {
  if (run.phase !== 'treasure' || !run.treasure || run.treasure.claimed) return run;
  const t = run.treasure;
  let next: SpireRun = { ...run, coins: run.coins + t.coins };
  let outcomeText = `Claimed ${t.coins}¢`;

  if (choice === 'weapon') {
    next = grantSpireWeapon(next, t.weaponOffer.weaponId, t.weaponOffer.level);
    const wName = getArmoryWeapon(t.weaponOffer.weaponId)?.name ?? t.weaponOffer.weaponId;
    outcomeText = `Claimed ${t.coins}¢ + ${wName} (Lv ${t.weaponOffer.level})!`;
  } else if (choice === 'arcana' && t.arcanaOffer) {
    const arcana = next.arcana.includes(t.arcanaOffer) ? next.arcana : [...next.arcana, t.arcanaOffer];
    const name = ARCANA.find(a => a.id === t.arcanaOffer)?.name ?? t.arcanaOffer;
    next = { ...next, arcana };
    outcomeText = `Claimed ${t.coins}¢ + Arcana: ${name}!`;
  } else {
    const bonus = 60 + run.act * 20;
    next = { ...next, coins: next.coins + bonus };
    outcomeText = `Haul doubled! Claimed ${t.coins + bonus}¢ total!`;
  }

  return { ...next, treasure: { ...t, claimed: true, outcomeText } };
};

export const leaveTreasure = (run: SpireRun): SpireRun => {
  if (run.phase !== 'treasure') return run;
  return { ...run, treasure: null, phase: 'map' };
};

// ─── Mystery Events ─────────────────────────────────────────────────────────

export const chooseEventOption = (run: SpireRun, optionId: string): SpireRun => {
  if (run.phase !== 'event' || !run.event || run.event.resolved) return run;
  const ev = getSpireEvent(run.event.eventId);
  const opt = ev.options.find(o => o.id === optionId);
  if (!opt) return run;
  if (opt.minCoins && run.coins < opt.minCoins) return run;
  if (opt.minHearts && run.hearts < opt.minHearts) return run;

  return withRng(run, rng => {
    let next: SpireRun = {
      ...run,
      stats: { ...run.stats, eventsResolved: run.stats.eventsResolved + 1 },
    };
    let outcomeTitle = opt.label;
    let outcomeText = 'You continue up the Spire.';
    let ambushEncounter: SpireEncounter | undefined;
    let pendingWeaponOptions: { weaponId: string; level: number }[] | undefined;
    let pendingSkillOptions: string[] | undefined;
    let pendingForge = false;

    const key = `${ev.id}:${optionId}`;
    switch (key) {
      case 'starfall_shrine:absorb':
        next = { ...next, hearts: Math.max(1, next.hearts - 1), extraEvolutionLikelihood: next.extraEvolutionLikelihood + 6 };
        pendingWeaponOptions = rollSynergyWeapons(next, rng, 3, 2);
        outcomeText = 'Starlight sears your paws (−1 ♥, +6% Catalyst chance). Pick a Level 2 weapon!';
        break;
      case 'starfall_shrine:dust':
        next = { ...next, coins: next.coins + 65 };
        outcomeText = 'You sweep 65¢ of shimmering starlight dust into your pouch.';
        break;
      case 'starfall_shrine:rest':
        next = { ...next, hearts: Math.min(next.maxHearts, next.hearts + 2) };
        outcomeText = `Warm starlight restores +2 ♥ (${next.hearts}/${next.maxHearts}).`;
        break;

      case 'cursed_anvil:superforge':
        next = { ...next, hearts: Math.max(1, next.hearts - 1) };
        pendingForge = true;
        outcomeText = 'The anvil kicks back (−1 ♥). Choose a weapon to jump +2 Levels!';
        break;
      case 'cursed_anvil:temper': {
        const upgradeable = next.weapons.filter(id => (next.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL);
        if (upgradeable.length > 0) {
          const wId = rng.pick(upgradeable);
          next = upgradeSpireWeapon(next, wId, 1);
          const wName = getArmoryWeapon(wId)?.name ?? wId;
          outcomeText = `${wName} gleams brighter — upgraded to Level ${next.weaponLevels[wId]}!`;
        } else {
          next = { ...next, coins: next.coins + 50 };
          outcomeText = 'All weapons already maxed — pocketed +50¢ of star-iron instead!';
        }
        break;
      }
      case 'cursed_anvil:salvage':
        next = { ...next, bonusDamagePerMatch: next.bonusDamagePerMatch + 1 };
        outcomeText = 'Reinforced your strike: +1 flat damage on every Set!';
        break;

      case 'mirror_pond:study':
        next = { ...next, coins: next.coins - 35, stats: { ...next.stats, coinsSpent: next.stats.coinsSpent + 35 } };
        pendingSkillOptions = rollSkillNodeOptions(next, rng, 3);
        outcomeText = 'Your reflection reveals three techniques — choose one to master!';
        break;
      case 'mirror_pond:drink':
        next = { ...next, hearts: next.maxHearts };
        outcomeText = `Crystal water restores you to full health (${next.hearts}/${next.maxHearts} ♥)!`;
        break;
      case 'mirror_pond:coin':
        next = { ...next, startingGraces: next.startingGraces + 1, startingHints: next.startingHints + 1 };
        outcomeText = 'Ripples bless your journey: +1 Starting Grace and +1 Starting Hint!';
        break;

      case 'wandering_alchemist:arcana': {
        const pool = rollArcanaOptions(next, rng, 1);
        if (pool.length > 0) {
          const id = pool[0];
          next = { ...next, arcana: [...next.arcana, id] };
          const def = ARCANA.find(a => a.id === id);
          outcomeText = `Wild magic swirls! You gained Arcana: ${def?.name ?? id}.`;
        } else {
          next = { ...next, coins: next.coins + 75 };
          outcomeText = 'You already hold every Arcana — the alchemist hands you +75¢ instead!';
        }
        break;
      }
      case 'wandering_alchemist:heart':
        next = { ...next, maxHearts: next.maxHearts + 1, hearts: Math.min(next.maxHearts + 1, next.hearts + 2) };
        outcomeText = `Hearty tonic! +1 Max Heart & healed +2 ♥ (${next.hearts}/${next.maxHearts}).`;
        break;
      case 'wandering_alchemist:catalyst':
        next = {
          ...next,
          extraEvolutionLikelihood: next.extraEvolutionLikelihood + 8,
          extraEvolutionCap: next.extraEvolutionCap + 1,
        };
        outcomeText = 'Catalysts surge (+8% chance & +1 Evolution per fight)!';
        break;

      case 'gamblers_dice:high_stakes': {
        next = { ...next, coins: next.coins - 45, stats: { ...next.stats, coinsSpent: next.stats.coinsSpent + 45 } };
        if (rng.next() < 0.65) {
          const prize = rollSynergyWeapons(next, rng, 1, 2)[0];
          next = { ...next, coins: next.coins + 135 };
          if (prize) next = grantSpireWeapon(next, prize.weaponId, prize.level);
          const wName = prize ? getArmoryWeapon(prize.weaponId)?.name ?? prize.weaponId : 'bonus loot';
          outcomeTitle = 'JACKPOT!';
          outcomeText = `Double sixes! Won +135¢ and ${wName} (Lv ${prize?.level ?? 2})!`;
        } else {
          outcomeTitle = 'Snake Eyes…';
          outcomeText = 'The fox grins and sweeps your 45¢ off the felt.';
        }
        break;
      }
      case 'gamblers_dice:safe_roll':
        next = { ...next, coins: next.coins + 40 };
        outcomeText = 'You pocket a crisp +40¢ and tip your hat.';
        break;
      case 'gamblers_dice:leave':
        next = { ...next, bonusClockSeconds: next.bonusClockSeconds + 8 };
        outcomeText = 'Time saved! +8s added to every future fight clock.';
        break;

      case 'sleeping_hoard:wake': {
        const enc = generateSpireEncounter({
          act: next.act,
          row: Math.min(5, next.floor % 6),
          kind: 'elite',
          ascension: next.ascension,
          rng,
          id: `ambush-${next.floor}`,
        });
        ambushEncounter = { ...enc, coinReward: enc.coinReward * 2 };
        outcomeTitle = 'THE GUARDIAN AWAKES!';
        outcomeText = `${enc.name} lunges from the treasure pile! Victory pays DOUBLE coins + full Elite loot!`;
        break;
      }
      case 'sleeping_hoard:sneak':
        next = { ...next, coins: next.coins + 55 };
        outcomeText = 'Silent paws! You slip away with +55¢.';
        break;

      case 'ancient_library:technique':
        pendingSkillOptions = rollSkillNodeOptions(next, rng, 3);
        outcomeText = 'Three forgotten scrolls unfurl — choose a Fighter Skill Node!';
        break;
      case 'ancient_library:fusion':
        next = {
          ...next,
          extraEvolutionLikelihood: next.extraEvolutionLikelihood + 10,
          extraEvolutionCap: next.extraEvolutionCap + 1,
        };
        outcomeText = 'Fusion mastery! +10% Catalyst chance and +1 Evolution per fight!';
        break;
      case 'ancient_library:clarity':
        next = { ...next, startingHints: next.startingHints + 2, bonusClockSeconds: next.bonusClockSeconds + 10 };
        outcomeText = 'Sharp mind! +2 Starting Hints and +10s on every future clock.';
        break;

      case 'bounty_camp:arsenal':
        next = {
          ...next,
          maxHearts: Math.max(3, next.maxHearts - 1),
          hearts: Math.min(Math.max(3, next.maxHearts - 1), next.hearts),
          coins: next.coins + 85,
        };
        pendingWeaponOptions = rollSynergyWeapons(next, rng, 3, 2);
        outcomeText = 'Blood pact sealed (−1 Max ♥, +85¢). Pick a Level 2 weapon!';
        break;
      case 'bounty_camp:patch':
        next = {
          ...next,
          hearts: Math.min(next.maxHearts, next.hearts + 2),
          startingGraces: next.startingGraces + 1,
        };
        outcomeText = `Patched up (+2 ♥) and gifted +1 Starting Grace!`;
        break;
      case 'bounty_camp:spar':
        next = { ...next, bonusDamagePerMatch: next.bonusDamagePerMatch + 2 };
        outcomeText = 'Sharpened form! +2 flat damage on every Set.';
        break;

      case 'shady_peddler:buy_crate': {
        next = { ...next, coins: next.coins - 55, stats: { ...next.stats, coinsSpent: next.stats.coinsSpent + 55 } };
        const prize = rollSynergyWeapons(next, rng, 1, 3)[0];
        if (prize) {
          next = grantSpireWeapon(next, prize.weaponId, 3);
          const wName = getArmoryWeapon(prize.weaponId)?.name ?? prize.weaponId;
          outcomeText = `Inside the crate: a pristine Level 3 ${wName}!`;
        } else {
          next = { ...next, coins: next.coins + 110 };
          outcomeText = 'A stash of rare gold coins (+110¢)!';
        }
        break;
      }
      case 'shady_peddler:haggle':
        next = { ...next, startingHints: next.startingHints + 1, startingGraces: next.startingGraces + 1, coins: next.coins + 25 };
        outcomeText = 'Smart haggle! Gained +1 Hint, +1 Grace, and +25¢.';
        break;

      case 'prism_obelisk:attune': {
        next = { ...next, hearts: Math.max(1, next.hearts - 1) };
        const upgradeable = rng.shuffle(next.weapons.filter(id => (next.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL));
        const picked = upgradeable.slice(0, 2);
        for (const wId of picked) next = upgradeSpireWeapon(next, wId, 1);
        const names = picked.map(id => getArmoryWeapon(id)?.name ?? id).join(' & ');
        outcomeText = picked.length
          ? `Prism lightning surges (−1 ♥) — upgraded ${names}!`
          : 'Your belt is already maxed — gained +2 flat Set damage instead!';
        if (!picked.length) next = { ...next, bonusDamagePerMatch: next.bonusDamagePerMatch + 2 };
        break;
      }
      case 'prism_obelisk:prism_shard':
        next = {
          ...next,
          bonusDamagePerMatch: next.bonusDamagePerMatch + 2,
          extraEvolutionLikelihood: next.extraEvolutionLikelihood + 6,
        };
        outcomeText = 'Prism resonance! +2 flat Set damage & +6% Catalyst chance.';
        break;
      case 'prism_obelisk:bask':
        next = { ...next, maxHearts: next.maxHearts + 1, hearts: Math.min(next.maxHearts + 1, next.hearts + 1) };
        outcomeText = `Restorative glow! +1 Max Heart & +1 ♥ (${next.hearts}/${next.maxHearts}).`;
        break;
    }

    return {
      run: {
        ...next,
        event: {
          eventId: ev.id,
          resolved: true,
          outcomeTitle,
          outcomeText,
          ...(ambushEncounter ? { ambushEncounter } : {}),
          ...(pendingWeaponOptions?.length ? { pendingWeaponOptions } : {}),
          ...(pendingSkillOptions?.length ? { pendingSkillOptions } : {}),
          ...(pendingForge ? { pendingForge: true } : {}),
        },
      },
    };
  });
};

export const resolveEventPendingWeapon = (run: SpireRun, index: number): SpireRun => {
  if (run.phase !== 'event' || !run.event?.pendingWeaponOptions) return run;
  const pick = run.event.pendingWeaponOptions[index];
  if (!pick) return run;
  const next = grantSpireWeapon(run, pick.weaponId, pick.level);
  const wName = getArmoryWeapon(pick.weaponId)?.name ?? pick.weaponId;
  return {
    ...next,
    event: {
      ...run.event,
      pendingWeaponOptions: undefined,
      outcomeText: `Claimed ${wName} (Lv ${pick.level})!`,
    },
  };
};

export const resolveEventPendingSkill = (run: SpireRun, nodeId: string): SpireRun => {
  if (run.phase !== 'event' || !run.event?.pendingSkillOptions) return run;
  if (!run.event.pendingSkillOptions.includes(nodeId)) return run;
  const skillNodes = run.skillNodes.includes(nodeId) ? run.skillNodes : [...run.skillNodes, nodeId];
  const nodeName = skillTreeOf(run.fighter).find(n => n.id === nodeId)?.name ?? 'Technique';
  return {
    ...run,
    skillNodes,
    event: {
      ...run.event,
      pendingSkillOptions: undefined,
      outcomeText: `Mastered ${nodeName}!`,
    },
  };
};

export const resolveEventPendingForge = (run: SpireRun, weaponId: string): SpireRun => {
  if (run.phase !== 'event' || !run.event?.pendingForge) return run;
  const next = upgradeSpireWeapon(run, weaponId, 2);
  const wName = getArmoryWeapon(weaponId)?.name ?? weaponId;
  return {
    ...next,
    event: {
      ...run.event,
      pendingForge: undefined,
      outcomeText: `Overclocked ${wName} to Level ${next.weaponLevels[weaponId]}!`,
    },
  };
};

export const leaveEvent = (run: SpireRun): SpireRun => {
  if (run.phase !== 'event' || !run.event) return run;
  if (run.event.ambushEncounter) {
    return {
      ...run,
      activeEncounter: run.event.ambushEncounter,
      event: null,
      phase: 'preview',
    };
  }
  return { ...run, event: null, phase: 'map' };
};
