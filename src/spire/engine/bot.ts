/**
 * Headless Starfall Summit run simulator.
 *
 * Plays complete multi-Act roguelike climbs (Act 1 → Act 3 Boss → optional
 * Endless Act 4+) through the REAL `runReducer` and `BOTS` from Adventure Mode
 * with full Wave 1 agency: Belt Reordering (for Understudy), Evolution &
 * Evolution drafting, Gamble clash avoidance, Shop Lock / Sell / Purge / Reroll,
 * Reward Reroll, and risk-calibrated Glass Prism evaluation!
 */
import type { CharacterName } from '@/types';
import type { ArcanaId } from '@/adventure/types';
import { simulateRun, type BotProfile } from '@/adventure/engine/bot';
import { createRng } from '@/adventure/engine/rng';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { weaponRole, type WeaponRole } from '@/adventure/data/weaponRoles';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { inFamily } from '@/adventure/engine/sources';
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
  isSpireUpgradeMaxed,
  leaveCampfire,
  leaveEvent,
  leaveShop,
  leaveTreasure,
  MAX_SHOP_LOCKS,
  MAX_SUMMIT_WEAPONS,
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
  skipEventPendingWeapon,
  skipRewardArcana,
  skipRewardWeapon,
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

/** Count armed Evolution recipes for a weapon id list. */
const countArmedEvolutions = (weaponIds: readonly string[]): number => {
  let count = 0;
  for (const r of EVOLUTION_RECIPES) {
    if (r.families.every(fam => weaponIds.some(id => inFamily(id, fam)))) count += 1;
  }
  return count;
};

/** Holistic belt strength estimate (used to evaluate 6/6 weapon swaps cleanly). */
const scoreBelt = (weaponIds: readonly string[], weaponLevels: Record<string, number>): number => {
  const armed = countArmedEvolutions(weaponIds);
  let score = Math.min(armed, 7) * 2.5 + Math.max(0, armed - 7) * 0.5;

  for (let i = 0; i < weaponIds.length; i++) {
    const id = weaponIds[i];
    const lv = weaponLevels[id] ?? 1;
    score += lv * (ENGINE_ROLES.has(weaponRole(id)) ? 1.85 : 1.15);
    // Count each clashing pair once
    const rest = weaponIds.slice(i + 1);
    score -= clashesWithBelt(rest, id).length * 4.5;
  }
  return score;
};

interface WeaponDecision {
  score: number;
  replaceWeaponId?: string;
}

/**
 * Evaluate a weapon offer (direct add, +1 Lv upgrade, or 6/6 in-place swap)
 * accounting for Evolutions, weapon levels, and Gamble clashes.
 */
const evaluateWeaponOffer = (run: SpireRun, weaponId: string, offerLevel = 1): WeaponDecision => {
  const existingLv = run.weaponLevels[weaponId];
  if (existingLv !== undefined) {
    if (existingLv >= MAX_WEAPON_LEVEL) return { score: -10 };
    const targetLv = Math.min(MAX_WEAPON_LEVEL, Math.max(existingLv + 1, offerLevel));
    const lvGain = targetLv - existingLv;
    const basePerLv =
      run.weapons.length >= MAX_SUMMIT_WEAPONS
        ? 4.4
        : run.weapons.length >= 4
          ? 3.6
          : 2.6;
    let score = basePerLv * lvGain;
    if (ENGINE_ROLES.has(weaponRole(weaponId))) score += 1.4;
    if (targetLv >= 4) score += 0.8;
    return { score };
  }

  // Room left on the 6-weapon belt: evaluate direct addition
  if (run.weapons.length < MAX_SUMMIT_WEAPONS) {
    let score = 0;
    const newEvos = newEvolutionsArmedBy(run, weaponId).length;
    score += Math.min(newEvos, 3) * 3.0;

    if (ENGINE_ROLES.has(weaponRole(weaponId))) score += 1.2;
    score += (Math.min(MAX_WEAPON_LEVEL, Math.max(1, offerLevel)) - 1) * 1.1;
    score += run.weapons.length < 4 ? 1.2 : 0.4;

    const clashes = clashesWithBelt(run.weapons, weaponId).length;
    score -= clashes * 4.5;
    return { score };
  }

  // Belt is FULL (6/6): find the best held weapon to swap out if the net delta is meaningfully positive
  const baseVal = scoreBelt(run.weapons, run.weaponLevels);
  const incomingLv = Math.min(MAX_WEAPON_LEVEL, Math.max(1, offerLevel));
  let bestDropId: string | undefined;
  let bestDelta = -Infinity;

  for (let i = 0; i < run.weapons.length; i++) {
    const dropId = run.weapons[i];
    const nextWeapons = [...run.weapons];
    nextWeapons[i] = weaponId;
    const nextLevels = { ...run.weaponLevels };
    delete nextLevels[dropId];
    nextLevels[weaponId] = incomingLv;
    const delta = scoreBelt(nextWeapons, nextLevels) - baseVal;
    if (delta > bestDelta) {
      bestDelta = delta;
      bestDropId = dropId;
    }
  }

  return {
    score: bestDelta >= 1.5 ? bestDelta : bestDelta - 1.5,
    replaceWeaponId: bestDropId,
  };
};

/** True when taking `arcanaId` fits the run's build cleanly (risk-calibrated for Wave 2 kiss-curse Arcana). */
const isGoodArcana = (run: SpireRun, arcanaId: ArcanaId, bot: BotProfile): boolean => {
  if (run.arcana.length >= 3 || run.arcana.includes(arcanaId)) return false;
  if (arcanaId === 'scholars_gambit') return false;
  const isRainbowBuild =
    run.fighter === 'Emperor Penguin' || run.weapons.includes('rainbow-charm') || run.arcana.includes('prismatic_fever');
  if (arcanaId === 'monochrome_pact') {
    // Halves Rainbow / 3-diff damage (×0.5); only worth taking on non-Rainbow builds once the engine can spare it.
    return !isRainbowBuild && !run.arcana.includes('prismatic_fever') && (bot.name === 'expert' || run.act >= 2);
  }
  if (arcanaId === 'prismatic_fever' && run.arcana.includes('monochrome_pact')) return false;
  if (arcanaId === 'controlled_burn') {
    // Zeroes starting Graces and deals 2 Hearts on cooldown mistakes — avoid on fragile 5–6 Heart average runs.
    return bot.name === 'expert' || run.maxHearts >= 7 || run.fighter === 'Badger';
  }
  if (arcanaId === 'catalyst_resonance') {
    // Non-evolved Sets deal ×0.75 — only take once at least 2 Evolutions are armed (or Catalyst Prism is held).
    return countArmedEvolutions(run.weapons) >= 2 || run.weapons.includes('catalyst-prism');
  }
  if (arcanaId === 'glass_prism') {
    // Risk-calibrated Glass Prism: strong when max hearts are already lean (<= 4, e.g. high Ascension),
    // instead of sacrificing an 8+ heart Act 3 survival pool into Snare/Time-Bomb fights.
    return run.maxHearts <= 4 && (bot.name === 'expert' || run.hearts >= 3);
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
    const evosLost = Math.max(0, countArmedEvolutions(run.weapons) - countArmedEvolutions(other));
    const score = (hasClash ? -5 : 0) + evosLost * 3 + lv * 2 + (ENGINE_ROLES.has(weaponRole(id)) ? 1 : 0);
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
 * Simulate a full Starfall Summit climb for `fighter` at `ascension` with `bot`.
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
      const glassCapped = run.arcana.includes('glass_prism');
      const lowHp = run.hearts <= Math.ceil(run.maxHearts * 0.5) || (glassCapped && run.act >= 2);
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
        const bestDecisionOf = (r: SpireRun) => {
          let bestIdx = 0;
          let best: WeaponDecision = { score: -Infinity };
          r.reward!.weaponOptions.forEach((opt, i) => {
            const dec = evaluateWeaponOffer(r, opt.weaponId, opt.level);
            if (dec.score > best.score) {
              best = dec;
              bestIdx = i;
            }
          });
          return { idx: bestIdx, decision: best };
        };
        // Reroll weak reward offers when flush with coins
        if (!run.reward.weaponRerolled && bestDecisionOf(run).decision.score <= 1.2 && run.coins >= REWARD_REROLL_COST + 50) {
          run = rerollRewardWeapons(run);
        }
        const { idx: pickIdx, decision } = bestDecisionOf(run);
        const picked = run.reward!.weaponOptions[pickIdx];
        const isNewAtCap =
          picked && run.weaponLevels[picked.weaponId] === undefined && run.weapons.length >= MAX_SUMMIT_WEAPONS;
        if (isNewAtCap && (decision.score < 1.5 || !decision.replaceWeaponId)) {
          run = skipRewardWeapon(run);
        } else {
          run = optimizeBeltOrder(
            claimRewardWeapon(run, pickIdx, isNewAtCap ? decision.replaceWeaponId : undefined)
          );
        }
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
          if (!u.sold && !isSpireUpgradeMaxed(run, u.upgradeId) && run.coins >= u.price) {
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

        // Score & buy top shop weapons (upgrades prioritized at 4–6 weapons; swaps cleanly at 6/6!)
        const indices = (run.shop?.weapons ?? []).map((_, i) => i);
        const scoredOrder = indices
          .map(i => {
            const w = run.shop!.weapons[i];
            const dec = w.sold ? { score: -Infinity } : evaluateWeaponOffer(run, w.weaponId, w.level);
            return { i, score: dec.score };
          })
          .sort((a, b) => b.score - a.score);

        for (const item of scoredOrder) {
          const cur = run.shop?.weapons[item.i];
          if (!cur || cur.sold) continue;
          // Re-evaluate against current belt state (earlier purchases in this pass may have filled 6/6!)
          const dec = evaluateWeaponOffer(run, cur.weaponId, cur.level);
          const isUpgrade = run.weaponLevels[cur.weaponId] !== undefined;
          const isNewAtCap = !isUpgrade && run.weapons.length >= MAX_SUMMIT_WEAPONS;
          const worthBuying = isNewAtCap
            ? dec.score >= 2.2 && Boolean(dec.replaceWeaponId)
            : dec.score >= 1.5 || (cur.onSale && dec.score >= 0.5 && run.weapons.length < MAX_SUMMIT_WEAPONS);
          if (!worthBuying) continue;
          if (run.coins < cur.price && dec.score >= 3.5 && !isNewAtCap) {
            const sellId = findSellableWeapon(run);
            if (sellId && sellId !== cur.weaponId) run = shopSellWeapon(run, sellId);
          }
          // Recompute swap target if selling freed a slot
          const nowNewAtCap =
            run.weaponLevels[cur.weaponId] === undefined && run.weapons.length >= MAX_SUMMIT_WEAPONS;
          const finalDec = nowNewAtCap ? evaluateWeaponOffer(run, cur.weaponId, cur.level) : dec;
          if (nowNewAtCap && (finalDec.score < 2.2 || !finalDec.replaceWeaponId)) continue;
          if (run.coins >= cur.price) {
            run = optimizeBeltOrder(
              shopBuyWeapon(run, item.i, nowNewAtCap ? finalDec.replaceWeaponId : undefined)
            );
            bought = true;
          } else if (finalDec.score >= 3 && !cur.locked && run.shop && countShopLocks(run.shop) < MAX_SHOP_LOCKS) {
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
        const offer = run.treasure.weaponOffer;
        const dec = evaluateWeaponOffer(run, offer.weaponId, offer.level);
        const isNewAtCap =
          run.weaponLevels[offer.weaponId] === undefined && run.weapons.length >= MAX_SUMMIT_WEAPONS;
        const canTakeWeapon = !isNewAtCap || (dec.score >= 1.5 && Boolean(dec.replaceWeaponId));
        const arcGood = run.treasure.arcanaOffer ? isGoodArcana(run, run.treasure.arcanaOffer, bot) : false;
        const choice =
          canTakeWeapon && dec.score >= 2.2
            ? 'weapon'
            : arcGood
              ? 'arcana'
              : canTakeWeapon && dec.score >= 0.5
                ? 'weapon'
                : 'coins';
        run = optimizeBeltOrder(
          claimTreasure(run, choice, choice === 'weapon' && isNewAtCap ? dec.replaceWeaponId : undefined)
        );
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
        let bestDec: WeaponDecision = { score: -Infinity };
        opts.forEach((opt, i) => {
          const dec = evaluateWeaponOffer(run, opt.weaponId, opt.level);
          if (dec.score > bestDec.score) {
            bestDec = dec;
            pickIdx = i;
          }
        });
        const picked = opts[pickIdx];
        const isNewAtCap =
          picked && run.weaponLevels[picked.weaponId] === undefined && run.weapons.length >= MAX_SUMMIT_WEAPONS;
        if (isNewAtCap && (bestDec.score < 1.5 || !bestDec.replaceWeaponId)) {
          run = skipEventPendingWeapon(run);
        } else {
          run = optimizeBeltOrder(
            resolveEventPendingWeapon(run, pickIdx, isNewAtCap ? bestDec.replaceWeaponId : undefined)
          );
        }
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
