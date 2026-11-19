/**
 * Headless Starfall Spire run simulator.
 *
 * Plays complete multi-Act roguelike climbs (Act 1 → Act 3 Boss → optional
 * Endless Act 4+) through the REAL `runReducer` and `BOTS` from Adventure Mode
 * so we can mathematically verify & tune Starfall Spire's balance curve!
 */
import type { CharacterName } from '@/types';
import { simulateRun, type BotProfile } from '@/adventure/engine/bot';
import { createRng } from '@/adventure/engine/rng';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { getSpireEvent } from '../data/events';
import { reachableNodeIds } from './mapGen';
import {
  newEvolutionsArmedBy,
  SPIRE_FIGHT_FEATURES,
  spireEncounterToLevel,
  spireRunOverrides,
  spireRunToVirtualSave,
} from './bridge';
import {
  campfireForge,
  campfireMeditate,
  campfireRest,
  chooseEventOption,
  claimRewardArcana,
  claimRewardSkillNode,
  claimRewardWeapon,
  claimTreasure,
  completeSpireBattle,
  createSpireRun,
  enterEndlessSpire,
  finishSpireRewards,
  leaveCampfire,
  leaveEvent,
  leaveShop,
  leaveTreasure,
  resolveEventPendingForge,
  resolveEventPendingSkill,
  resolveEventPendingWeapon,
  selectSpireNode,
  shopBuyHeal,
  shopBuyUpgrade,
  shopBuyWeapon,
  shopForgeWeapon,
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

  for (let guard = 0; guard < 120; guard++) {
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
      // Smart human-like routing: rest when hurt, visit shops when flush, take elites when healthy!
      const lowHp = run.hearts <= Math.ceil(run.maxHearts * 0.5);
      const picked =
        (lowHp ? nodes.find(n => n.kind === 'campfire' || n.kind === 'treasure' || n.kind === 'shop') : null) ??
        (run.coins >= 120 ? nodes.find(n => n.kind === 'shop') : null) ??
        (!lowHp ? nodes.find(n => n.kind === 'elite') : null) ??
        nodes.find(n => n.kind === 'treasure' || n.kind === 'campfire') ??
        decisionRng.pick(nodes);
      run = selectSpireNode(run, picked.id);
      continue;
    }

    if (run.phase === 'preview') {
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
        // Prefer weapons that arm a NEW Evolution!
        const synIdx = run.reward.weaponOptions.findIndex(opt => newEvolutionsArmedBy(run, opt.weaponId).length > 0);
        run = claimRewardWeapon(run, synIdx >= 0 ? synIdx : 0);
      }
      if (run.reward && !run.reward.skillClaimed && run.reward.skillOptions.length > 0) {
        run = claimRewardSkillNode(run, run.reward.skillOptions[0]);
      }
      if (run.reward && !run.reward.arcanaClaimed && run.reward.arcanaOptions.length > 0) {
        // Pick helpful non-glass Arcana (skip glass_prism when low on hearts)
        const safe = run.reward.arcanaOptions.find(a => a !== 'glass_prism' && a !== 'scholars_gambit');
        run = safe ? claimRewardArcana(run, safe) : skipRewardArcana(run);
      }
      run = finishSpireRewards(run);
      continue;
    }

    if (run.phase === 'shop' && run.shop) {
      if (run.hearts <= Math.ceil(run.maxHearts * 0.6) && run.coins >= run.shop.healCost && !run.shop.healed) {
        run = shopBuyHeal(run);
      }
      // Buy synergy or sale weapon if affordable
      for (let i = 0; i < (run.shop?.weapons.length ?? 0); i++) {
        const w = run.shop!.weapons[i];
        if (!w.sold && run.coins >= w.price && (w.onSale || newEvolutionsArmedBy(run, w.weaponId).length > 0)) {
          run = shopBuyWeapon(run, i);
        }
      }
      // Buy useful upgrade if affordable
      for (let i = 0; i < (run.shop?.upgrades.length ?? 0); i++) {
        const u = run.shop!.upgrades[i];
        if (!u.sold && run.coins >= u.price) {
          run = shopBuyUpgrade(run, i);
        }
      }
      // Forge strongest weapon if still rich
      if (run.shop && !run.shop.forged && run.coins >= run.shop.forgeCost) {
        const target = run.weapons.find(id => (run.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL);
        if (target) run = shopForgeWeapon(run, target);
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
          const target = run.weapons.find(id => (run.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL);
          run = target ? campfireForge(run, target) : campfireRest(run);
        }
      }
      run = leaveCampfire(run);
      continue;
    }

    if (run.phase === 'treasure' && run.treasure) {
      if (!run.treasure.claimed) {
        run = claimTreasure(run, 'weapon');
      }
      run = leaveTreasure(run);
      continue;
    }

    if (run.phase === 'event' && run.event) {
      if (!run.event.resolved) {
        const ev = getSpireEvent(run.event.eventId);
        // Prefer safe/neutral choices when low on HP, bold otherwise (avoid waking ambush at 1-2 hearts)
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
        run = resolveEventPendingWeapon(run, 0);
      }
      if (run.event?.pendingSkillOptions?.length) {
        run = resolveEventPendingSkill(run, run.event.pendingSkillOptions[0]);
      }
      if (run.event?.pendingForge) {
        const target = run.weapons.find(id => (run.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL);
        if (target) run = resolveEventPendingForge(run, target);
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
