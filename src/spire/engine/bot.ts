/**
 * Headless Starfall Spire run simulator.
 *
 * Plays complete multi-Act roguelike climbs (Act 1 → Act 3 Boss → optional
 * Endless Act 4+) through the REAL `runReducer` and `BOTS` from Adventure Mode
 * with full Wave 1 agency: Belt Reordering (for Understudy), Role Set Bonus &
 * Evolution drafting, Gamble clash avoidance, Shop Lock / Sell / Purge / Reroll,
 * Reward Reroll, and risk-calibrated Glass Prism evaluation!
 */
import type { CharacterName } from '@/types';
import type { ArcanaId } from '@/adventure/types';
import { simulateRun, type BotProfile } from '@/adventure/engine/bot';
import { createRng } from '@/adventure/engine/rng';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { activeRoleBonuses, weaponRole, type WeaponRole } from '@/adventure/data/weaponRoles';
import { getSpireEvent } from '../data/events';
import { reachableNodeIds } from './mapGen';
import {
  clashesWithBelt,
  newEvolutionsArmedBy,
  SPIRE_FIGHT_FEATURES,
  spireEncounterToLevel,
  spireRunOverrides,
  spireRunToVirtualSave,
} from './bridge';
import {
  ARCANA_PURGE_COST,
  campfireForge,
  campfireMeditate,
  campfireRest,
  chooseEventOption,
  claimRewardArcana,
  claimRewardSkillNode,
  claimRewardWeapon,
  claimTreasure,
  completeSpireBattle,
  countShopLocks,
  createSpireRun,
  enterEndlessSpire,
  finishSpireRewards,
  leaveCampfire,
  leaveEvent,
  leaveShop,
  leaveTreasure,
  MAX_SHOP_LOCKS,
  reorderSpireWeapon,
  rerollRewardWeapons,
  resolveEventPendingArcana,
  resolveEventPendingForge,
  resolveEventPendingSkill,
  resolveEventPendingWeapon,
  REWARD_REROLL_COST,
  selectSpireNode,
  shopBuyArcana,
  shopBuyHeal,
  shopBuyUpgrade,
  shopBuyWeapon,
  shopForgeWeapon,
  shopPurgeArcana,
  shopReroll,
  shopSellWeapon,
  shopToggleLock,
  skipRewardArcana,
  startSpireEncounter,
} from './runState';
import type { SpireRun } from '../types';

export interface SpireSimResult {
  run: SpireRun;
  wonAct1: boolean;
  wonAct2: boolean;
  wonAct3: boolean;
  wonAct4: boolean;
  finalAct: number;
  finalFloor: number;
}

const ENGINE_ROLES: ReadonlySet<WeaponRole> = new Set(['damage', 'tricks', 'gambles', 'chains']);
const PARTNER_IDS: ReadonlySet<string> = new Set(['understudy', 'encore-mask']);

/** Position Understudy immediately right of the highest-level non-partner engine weapon on the belt. */
const optimizeBeltOrder = (run: SpireRun): SpireRun => {
  const idx = run.weapons.indexOf('understudy');
  if (idx < 0 || run.weapons.length < 2) return run;
  let bestTarget = -1;
  let bestScore = -1;
  for (let i = 0; i < run.weapons.length; i++) {
    const id = run.weapons[i];
    if (PARTNER_IDS.has(id)) continue;
    const lv = run.weaponLevels[id] ?? 1;
    const score = lv * 10 + (ENGINE_ROLES.has(weaponRole(id)) ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestTarget = i;
    }
  }
  if (bestTarget < 0) return run;
  // Target index after moving Understudy so it sits right after `bestTarget`
  const desired = idx < bestTarget ? bestTarget : Math.min(run.weapons.length - 1, bestTarget + 1);
  if (idx === desired) return run;
  return reorderSpireWeapon(run, idx, desired);
};

/** Score a candidate weapon offer for drafting/shopping using Evolutions, Role Set breakpoints, upgrades & clash avoidance. */
const scoreWeaponOffer = (run: SpireRun, weaponId: string): number => {
  const isUpgrade = run.weaponLevels[weaponId] !== undefined;
  let score = 0;
  if (isUpgrade) {
    const lv = run.weaponLevels[weaponId] ?? 1;
    if (lv >= MAX_WEAPON_LEVEL) return -5;
    score += run.weapons.length >= 5 ? 3.5 : 2;
    if (ENGINE_ROLES.has(weaponRole(weaponId))) score += 1;
    return score;
  }
  const newEvos = newEvolutionsArmedBy(run, weaponId).length;
  score += newEvos * 3;

  // Check if adding this weapon unlocks a 2 / 4 / 6 Role Set Bonus tier!
  const beforeTiers = activeRoleBonuses(run.weapons).reduce((s, b) => s + b.tier, 0);
  const afterTiers = activeRoleBonuses([...run.weapons, weaponId]).reduce((s, b) => s + b.tier, 0);
  if (afterTiers > beforeTiers) score += 2;
  if (ENGINE_ROLES.has(weaponRole(weaponId))) score += 1;

  // Penalize registered Gamble/Board anti-synergies
  const clashes = clashesWithBelt(run.weapons, weaponId).length;
  score -= clashes * 4;
  return score;
};

/** True when taking `arcanaId` fits the run's build cleanly (Glass Prism allowed when healthy or expert!). */
const isGoodArcana = (run: SpireRun, arcanaId: ArcanaId, bot: BotProfile): boolean => {
  if (run.arcana.length >= 3 || run.arcana.includes(arcanaId)) return false;
  if (arcanaId === 'scholars_gambit') return false;
  const isRainbowBuild =
    run.fighter === 'Emperor Penguin' || run.weapons.includes('rainbow-charm') || run.arcana.includes('prismatic_fever');
  if (arcanaId === 'monochrome_pact' && (isRainbowBuild || run.arcana.includes('prismatic_fever'))) return false;
  if (arcanaId === 'prismatic_fever' && run.arcana.includes('monochrome_pact')) return false;
  if (arcanaId === 'glass_prism') {
    // Allow Glass Prism on expert runs, or on average runs with a safe heart buffer
    return bot.name === 'expert' || (run.maxHearts >= 4 && run.hearts >= 3);
  }
  return true;
};

/** Find a redundant Lv 1–2 off-role/clashing weapon that can be sold in the shop. */
const findSellableWeapon = (run: SpireRun): string | null => {
  if (run.weapons.length < 6) return null;
  let worstId: string | null = null;
  let worstScore = Infinity;
  for (const id of run.weapons) {
    const lv = run.weaponLevels[id] ?? 1;
    if (lv > 2) continue;
    const other = run.weapons.filter(x => x !== id);
    const hasClash = clashesWithBelt(other, id).length > 0;
    const beforeTiers = activeRoleBonuses(run.weapons).reduce((s, b) => s + b.tier, 0);
    const afterTiers = activeRoleBonuses(other).reduce((s, b) => s + b.tier, 0);
    const breaksRole = afterTiers < beforeTiers;
    const score = (hasClash ? -5 : 0) + (breaksRole ? 4 : 0) + lv * 2 + (ENGINE_ROLES.has(weaponRole(id)) ? 1 : 0);
    if (score < worstScore) {
      worstScore = score;
      worstId = id;
    }
  }
  return worstScore <= 3 ? worstId : null;
};

/** Pick the best weapon on the belt to forge (+1 level). */
const bestForgeTarget = (run: SpireRun): string | undefined => {
  const candidates = run.weapons.filter(id => (run.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL);
  if (!candidates.length) return undefined;
  return [...candidates].sort((a, b) => {
    const aEng = ENGINE_ROLES.has(weaponRole(a)) ? 1 : 0;
    const bEng = ENGINE_ROLES.has(weaponRole(b)) ? 1 : 0;
    return bEng - aEng || (run.weaponLevels[b] ?? 1) - (run.weaponLevels[a] ?? 1);
  })[0];
};

/**
 * Simulate a full Starfall Spire climb for `fighter` at `ascension` with `bot`.
 * Stops after beating Act 3 (or after Act `maxAct` when `playEndless: true`).
 */
export const simulateSpireClimb = (o: {
  fighter: CharacterName;
  ascension: number;
  seed: number;
  bot: BotProfile;
  playEndless?: boolean;
  maxAct?: number;
}): SpireSimResult => {
  const { fighter, ascension, seed, bot, playEndless = false, maxAct = playEndless ? 4 : 3 } = o;
  const decisionRng = createRng((seed ^ 0x7f4a7c15) >>> 0);
  let run = createSpireRun(fighter, ascension, seed);
  let wonAct1 = false;
  let wonAct2 = false;
  let wonAct3 = false;
  let wonAct4 = false;

  for (let guard = 0; guard < 140; guard++) {
    if (run.phase === 'defeat') break;
    if (run.phase === 'victory') {
      wonAct3 = true;
      if (!playEndless || run.act >= maxAct) break;
      run = enterEndlessSpire(run);
      continue;
    }
    if (run.act > maxAct) break;

    if (run.phase === 'map') {
      const ids = reachableNodeIds(run.map, run.currentNodeId);
      if (ids.length === 0) break;
      const nodes = ids.map(id => run.map.nodes.find(n => n.id === id)!);
      const lowHp = run.hearts <= Math.ceil(run.maxHearts * 0.5);
      const picked =
        (lowHp ? nodes.find(n => n.kind === 'campfire' || n.kind === 'treasure' || n.kind === 'shop') : null) ??
        (run.coins >= 65 ? nodes.find(n => n.kind === 'shop') : null) ??
        (!lowHp ? nodes.find(n => n.kind === 'elite') : null) ??
        nodes.find(n => n.kind === 'treasure' || n.kind === 'campfire') ??
        decisionRng.pick(nodes);
      run = selectSpireNode(run, picked.id);
      continue;
    }

    if (run.phase === 'preview') {
      run = optimizeBeltOrder(run);
      run = startSpireEncounter(run);
      continue;
    }

    if (run.phase === 'fight' && run.activeEncounter) {
      const level = spireEncounterToLevel(run, run.activeEncounter);
      const save = spireRunToVirtualSave(run);
      const overrides = spireRunOverrides(run);
      const fightSeed = (run.seed ^ (run.floor * 7919) ^ (run.act * 104729)) >>> 0;
      const sim = simulateRun(level, save, bot, fightSeed, undefined, {
        skipPicks: true,
        features: new Set(SPIRE_FIGHT_FEATURES),
        overrides,
      });
      const wasBossAct = run.activeEncounter.kind === 'boss' ? run.act : 0;
      run = completeSpireBattle(run, sim.state);
      if (run.phase === 'reward' && wasBossAct > 0) {
        if (wasBossAct === 1) wonAct1 = true;
        if (wasBossAct === 2) wonAct2 = true;
        if (wasBossAct === 3) wonAct3 = true;
        if (wasBossAct === 4) wonAct4 = true;
      }
      continue;
    }

    if (run.phase === 'reward' && run.reward) {
      if (!run.reward.weaponClaimed && run.reward.weaponOptions.length > 0) {
        const bestScoreOf = (r: SpireRun) =>
          Math.max(...r.reward!.weaponOptions.map(opt => scoreWeaponOffer(r, opt.weaponId)));
        // Reroll weak reward offers when flush with coins
        if (!run.reward.weaponRerolled && bestScoreOf(run) <= 1 && run.coins >= REWARD_REROLL_COST + 50) {
          run = rerollRewardWeapons(run);
        }
        const opts = run.reward!.weaponOptions;
        let pickIdx = 0;
        let pickScore = -Infinity;
        opts.forEach((opt, i) => {
          const sc = scoreWeaponOffer(run, opt.weaponId);
          if (sc > pickScore) {
            pickScore = sc;
            pickIdx = i;
          }
        });
        run = optimizeBeltOrder(claimRewardWeapon(run, pickIdx));
      }
      if (run.reward && !run.reward.skillClaimed && run.reward.skillOptions.length > 0) {
        run = claimRewardSkillNode(run, run.reward.skillOptions[0]);
      }
      if (run.reward && !run.reward.arcanaClaimed && run.reward.arcanaOptions.length > 0) {
        const safe = run.reward.arcanaOptions.find(a => isGoodArcana(run, a, bot));
        run = safe ? claimRewardArcana(run, safe) : skipRewardArcana(run);
      }
      run = finishSpireRewards(run);
      continue;
    }

    if (run.phase === 'shop' && run.shop) {
      // 1. Heal if hurt
      if (run.hearts <= Math.ceil(run.maxHearts * 0.65) && run.coins >= run.shop.healCost && !run.shop.healed) {
        run = shopBuyHeal(run);
      }

      // 2. Purge any contradictory Arcana if holding excess gold
      const isRainbowBuild =
        run.fighter === 'Emperor Penguin' || run.weapons.includes('rainbow-charm') || run.arcana.includes('prismatic_fever');
      if (run.coins >= Math.max(90, ARCANA_PURGE_COST) && isRainbowBuild && run.arcana.includes('monochrome_pact')) {
        run = shopPurgeArcana(run, 'monochrome_pact');
      }

      const buyPass = () => {
        let bought = false;
        // Buy Workshop upgrades first (always-on run-wide power!)
        for (let i = 0; i < (run.shop?.upgrades.length ?? 0); i++) {
          const u = run.shop!.upgrades[i];
          if (!u.sold && run.coins >= u.price) {
            run = shopBuyUpgrade(run, i);
            bought = true;
          }
        }

        // Forge strongest engine weapon
        if (run.shop && !run.shop.forged && run.coins >= run.shop.forgeCost) {
          const target = bestForgeTarget(run);
          if (target) {
            run = optimizeBeltOrder(shopForgeWeapon(run, target));
            bought = true;
          }
        }

        // Score & buy top shop weapons (selling a weak/clashing Lv1-2 weapon if needed to afford a high-score Evolution piece!)
        const order = (run.shop?.weapons ?? [])
          .map((w, i) => ({ w, i, score: scoreWeaponOffer(run, w.weaponId) }))
          .sort((a, b) => b.score - a.score);
        for (const item of order) {
          const cur = run.shop?.weapons[item.i];
          if (!cur || cur.sold) continue;
          const worthBuying = item.score >= 1.5 || (cur.onSale && item.score >= 0.5 && run.weapons.length < 8);
          if (!worthBuying) continue;
          if (run.coins < cur.price && item.score >= 3) {
            const sellId = findSellableWeapon(run);
            if (sellId) run = shopSellWeapon(run, sellId);
          }
          if (run.coins >= cur.price) {
            run = optimizeBeltOrder(shopBuyWeapon(run, item.i));
            bought = true;
          } else if (item.score >= 3 && !cur.locked && run.shop && countShopLocks(run.shop) < MAX_SHOP_LOCKS) {
            // Lock unaffordable high-synergy weapon for the next Merchant visit!
            run = shopToggleLock(run, 'weapon', item.i);
          }
        }

        // Buy synergistic Arcana
        for (let i = 0; i < (run.shop?.arcana.length ?? 0); i++) {
          const a = run.shop!.arcana[i];
          if (!a.sold && run.coins >= a.price && isGoodArcana(run, a.arcanaId, bot)) {
            run = shopBuyArcana(run, i);
            bought = true;
          }
        }
        return bought;
      };

      buyPass();
      // Reroll while still holding enough gold to keep upgrading/shopping
      for (let r = 0; r < 6 && run.shop; r++) {
        if (run.coins < run.shop.rerollCost + 40) break;
        run = shopReroll(run);
        buyPass();
      }
      run = leaveShop(run);
      continue;
    }

    if (run.phase === 'campfire' && run.campfire) {
      if (!run.campfire.resolved) {
        if (run.hearts <= Math.ceil(run.maxHearts * 0.65)) {
          run = campfireRest(run);
        } else if (run.campfire.skillOptions.length > 0 && run.skillNodes.length < 4) {
          run = campfireMeditate(run, run.campfire.skillOptions[0]);
        } else {
          const target = bestForgeTarget(run);
          run = target ? optimizeBeltOrder(campfireForge(run, target)) : campfireRest(run);
        }
      }
      run = leaveCampfire(run);
      continue;
    }

    if (run.phase === 'treasure' && run.treasure) {
      if (!run.treasure.claimed) {
        const wScore = scoreWeaponOffer(run, run.treasure.weaponOffer.weaponId);
        const arcGood = run.treasure.arcanaOffer ? isGoodArcana(run, run.treasure.arcanaOffer, bot) : false;
        const choice = wScore >= 2 ? 'weapon' : arcGood ? 'arcana' : wScore >= 0 ? 'weapon' : 'coins';
        run = optimizeBeltOrder(claimTreasure(run, choice));
      }
      run = leaveTreasure(run);
      continue;
    }

    if (run.phase === 'event' && run.event) {
      if (!run.event.resolved) {
        const ev = getSpireEvent(run.event.eventId);
        const viable = ev.options.filter(opt => {
          if (opt.minCoins && run.coins < opt.minCoins) return false;
          if (opt.minHearts && run.hearts < opt.minHearts) return false;
          if (opt.needsWeapon && !run.weapons.some(id => (run.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL)) return false;
          return true;
        });
        const preferred =
          (run.hearts <= 3 ? viable.find(o => o.tone === 'safe' || o.tone === 'neutral') : viable.find(o => o.id !== 'wake')) ??
          viable[0];
        if (preferred) run = chooseEventOption(run, preferred.id);
      }
      if (run.event?.pendingWeaponOptions?.length) {
        const opts = run.event.pendingWeaponOptions;
        let pickIdx = 0;
        let bestSc = -Infinity;
        opts.forEach((opt, i) => {
          const sc = scoreWeaponOffer(run, opt.weaponId);
          if (sc > bestSc) {
            bestSc = sc;
            pickIdx = i;
          }
        });
        run = optimizeBeltOrder(resolveEventPendingWeapon(run, pickIdx));
      }
      if (run.event?.pendingSkillOptions?.length) {
        run = resolveEventPendingSkill(run, run.event.pendingSkillOptions[0]);
      }
      if (run.event?.pendingArcanaOffer) {
        run = resolveEventPendingArcana(run, isGoodArcana(run, run.event.pendingArcanaOffer, bot));
      }
      if (run.event?.pendingForge) {
        const target = bestForgeTarget(run);
        if (target) run = optimizeBeltOrder(resolveEventPendingForge(run, target));
      }
      run = leaveEvent(run);
      continue;
    }

    break;
  }

  return {
    run,
    wonAct1,
    wonAct2,
    wonAct3,
    wonAct4,
    finalAct: run.act,
    finalFloor: run.floor,
  };
};
