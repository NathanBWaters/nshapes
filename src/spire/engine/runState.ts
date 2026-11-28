/**
 * Starfall Summit — pure deterministic state machine.
 *
 * Every transition (node selection, fight completion, weapon/Arcana/skill
 * drafting, Merchant Shop purchases, Campfire rest/forge/meditate, Mystery
 * Events, Treasure Vaults, Act progression, Endless Starfall) is a pure
 * function on `SpireRun` so runs are 100% reproducible, auto-save cleanly,
 * and can be simulated end-to-end by the headless balance bot!
 */
import type { CharacterName } from '@/types';
import type { ArcanaId, RunState, SynergyAttrId } from '@/adventure/types';
import { ARCANA } from '@/adventure/data/arcana';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { skillTreeOf } from '@/adventure/data/skillTrees';
import { getUpgrade } from '@/adventure/data/upgrades';
import { weaponRole } from '@/adventure/data/weaponRoles';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { damagePerMinute } from '@/adventure/history';
import { mergeSpireDamageLedger } from '@/adventure/engine/damageStory';
import { createRng, type Rng } from '@/adventure/engine/rng';
import type { SummitDailyMutatorId } from '@/adventure/dailySeed';
import { ascensionModifiers } from '../data/ascensions';
import { dailyMutatorModifiers, getDailySummitConfig } from '../data/dailyModifiers';
import { generateSpireEncounter, SPIRE_WEAPON_POOL, STARTER_KITS } from '../data/encounters';
import { getSpireEvent, SPIRE_EVENTS } from '../data/events';
import { defaultEvolutionForWeapon, getWeaponEvolution } from '@/adventure/data/evolutions';
import { beltSynergyOverlap, weaponSynergyAttrs } from '@/adventure/data/synergy';
import { generateActMap, reachableNodeIds } from './mapGen';
import type {
  SpireCampfireState,
  SpireEncounter,
  SpireLockedShopItems,
  SpireRewardBundle,
  SpireRun,
  SpireShopArcanaOffer,
  SpireShopState,
  SpireShopUpgradeKind,
  SpireShopUpgradeOffer,
  SpireShopWeaponOffer,
  SpireTreasureState,
} from '../types';

export const MAX_SUMMIT_WEAPONS = 6;
export const SKIP_WEAPON_COINS = 25;
export const REWARD_REROLL_COST = 20;
export const MAX_SHOP_LOCKS = 2;
export const ARCANA_PURGE_COST = 40;

const withRng = <T>(run: SpireRun, fn: (rng: Rng) => { run: SpireRun; out?: T }): SpireRun => {
  const rng = createRng(run.rngState);
  const res = fn(rng);
  return { ...res.run, rngState: rng.state };
};

/** Pure mid-fight XP items are excluded from Summit offers (progression lives on the Summit map). */
export const SPIRE_EXCLUDED_WEAPONS: ReadonlySet<string> = new Set(['scholars-tome', 'wisdom-chain']);
export const SPIRE_EXCLUDED_ARCANA: ReadonlySet<ArcanaId> = new Set(['scholars_gambit']);
const ENGINE_ROLES: ReadonlySet<string> = new Set(['damage', 'tricks', 'gambles', 'chains']);

const recordSeenEnemy = (seenEnemies: readonly string[] | undefined, name?: string | null): string[] => {
  const list = seenEnemies ? [...seenEnemies] : [];
  if (name && !list.includes(name)) list.push(name);
  return list;
};

/**
 * Brotato-inspired invisible shop/draft weighting constants (adapted from Brotato's
 * `item_service.gd` weapon & wanted-tag pool rules):
 *  - Held weapon upgrades (Brotato's 20% Same Weapon pool) are handled via `upgradeSlots`,
 *    shuffled evenly across all upgradeable weapons currently on the belt.
 *  - For every new (unheld) weapon slot:
 *    - `15%` base chance (+15% on Floor 1 tapering −3% per floor down to 0% by Floor 6+,
 *      matching Brotato's Waves 1–5 early-build ramp) to draw from unheld weapons related
 *      to your current belt (weighted by shared Synergy Graph attributes + matching role).
 *    - `5%` flat chance (Brotato's Character `wanted_tags` rule) to draw from unheld
 *      weapons matching your fighter's built-in synergy affinity.
 *    - Remaining `65%` (Floor 1) → `80%` (Floor 6+) draws uniformly from ALL unheld Summit
 *      weapons so every climb stays mostly even, surprising, and open across all 62 weapons.
 */
export const BROTATO_RELATED_BASE_CHANCE = 0.15;
export const BROTATO_EARLY_FLOOR_BONUS_MAX = 0.15;
export const BROTATO_EARLY_FLOOR_DECAY = 0.03;
export const BROTATO_FIGHTER_TAG_CHANCE = 0.05;
export const DAILY_FAVORED_ROLE_CHANCE = 0.25;

/** Invisible per-fighter synergy tag affinities (Brotato's 5% `wanted_tags` equivalent). */
export const FIGHTER_WANTED_TAGS: Readonly<Record<CharacterName, readonly SynergyAttrId[]>> = {
  'Orange Tabby': ['destruction', 'vitality'],
  'Sly Fox': ['streaks', 'marks'],
  Corgi: ['field_size', 'destruction'],
  Badger: ['destruction', 'vitality'],
  'Emperor Penguin': ['prism', 'holo'],
  Pelican: ['echoes', 'burn'],
};

/**
 * Brotato-style belt-related sub-pool chance for a given climb floor:
 *  - Floor 1: 30% (`15% + 15%`)
 *  - Floor 2: 27% (`15% + 12%`)
 *  - Floor 3: 24% (`15% + 9%`)
 *  - Floor 4: 21% (`15% + 6%`)
 *  - Floor 5: 18% (`15% + 3%`)
 *  - Floor 6+: 15% baseline
 */
export const brotatoRelatedPoolChance = (floor: number): number => {
  const effectiveFloor = Math.max(1, Math.floor(floor));
  const earlyBonus = Math.max(
    0,
    BROTATO_EARLY_FLOOR_BONUS_MAX - (effectiveFloor - 1) * BROTATO_EARLY_FLOOR_DECAY
  );
  return Math.round((BROTATO_RELATED_BASE_CHANCE + earlyBonus) * 1000) / 1000;
};

const pickWeighted = <T>(entries: readonly { item: T; weight: number }[], rng: Rng): T => {
  let total = 0;
  for (const e of entries) total += e.weight;
  let cursor = rng.next() * total;
  for (const e of entries) {
    cursor -= e.weight;
    if (cursor <= 0) return e.item;
  }
  return entries[entries.length - 1].item;
};

/**
 * Roll `count` weapon offers for drafts, shops, vaults & events under the 6-weapon belt cap:
 *  - Below 6 weapons: new weapons lead (mostly uniform across all 62 Summit weapons with
 *    invisible Brotato-style subtle synergy & fighter-tag weighting) while offering a +1 Level
 *    upgrade slot often enough (especially at 3–5 weapons) to create tall-vs-wide tension.
 *  - At 6/6 (belt full): prioritize held-weapon +1 Level upgrades (2 in 3-slot drafts,
 *    2–3 in 4-slot shops, 75% in 1-slot vaults) alongside 1–2 swap/pivot candidates.
 *    If all 6 held weapons are already Lv 5, fill cleanly with fresh swap candidates.
 */
export const rollSynergyWeapons = (
  run: Pick<SpireRun, 'weapons' | 'weaponLevels' | 'act'> & {
    fighter?: CharacterName;
    floor?: number;
    dailyMutatorId?: SummitDailyMutatorId;
  },
  rng: Rng,
  count: number,
  minLevel = 1,
  opts?: { allowUpgrade?: boolean; excludeIds?: ReadonlySet<string> }
): { weaponId: string; level: number }[] => {
  if (count <= 0) return [];
  const excluded = opts?.excludeIds;
  const unheld = SPIRE_WEAPON_POOL.filter(
    id => !run.weapons.includes(id) && !SPIRE_EXCLUDED_WEAPONS.has(id) && !excluded?.has(id)
  );
  const upgradeable = run.weapons.filter(
    id => (run.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL && !excluded?.has(id)
  );
  const beltFull = run.weapons.length >= MAX_SUMMIT_WEAPONS;
  const canOfferUpgrade = (opts?.allowUpgrade ?? true) && upgradeable.length > 0;

  let upgradeSlots = 0;
  if (canOfferUpgrade) {
    if (beltFull) {
      if (count === 1) {
        upgradeSlots = rng.next() < 0.75 ? 1 : 0;
      } else if (count === 2) {
        upgradeSlots = 1;
      } else if (count === 3) {
        upgradeSlots = Math.min(2, upgradeable.length);
      } else {
        const desired = upgradeable.length >= 3 && rng.next() < 0.5 ? 3 : 2;
        upgradeSlots = Math.min(upgradeable.length, count - 1, desired);
      }
    } else if (count >= 3) {
      const upgradeChance = run.weapons.length >= 5 ? 0.9 : run.weapons.length >= 3 ? 0.7 : 0.45;
      if (rng.next() < upgradeChance) {
        upgradeSlots = 1;
      }
    }
  }
  const newCount = Math.min(unheld.length, count - upgradeSlots);

  const effectiveFloor = run.floor !== undefined ? Math.max(1, run.floor) : run.act <= 1 ? 1 : 6;
  const relatedChanceBase = brotatoRelatedPoolChance(effectiveFloor);
  const wantedTags = run.fighter ? new Set(FIGHTER_WANTED_TAGS[run.fighter] ?? []) : null;
  const favoredRole = run.dailyMutatorId
    ? dailyMutatorModifiers(run.dailyMutatorId).favoredRole
    : undefined;

  const chosen: string[] = [];
  for (let slot = 0; slot < newCount; slot++) {
    const avail = unheld.filter(id => !chosen.includes(id));
    if (avail.length === 0) break;

    const mutatorAvail = favoredRole ? avail.filter(id => weaponRole(id) === favoredRole) : [];
    // Weight the subtle related sub-pool by total synergy/role connections across held belt weapons
    // so leaning into an archetype organically concentrates its related odds (like Brotato's weapon classes).
    const relatedWeighted: { item: string; weight: number }[] = [];
    for (const id of avail) {
      let weight = 0;
      const candRole = weaponRole(id);
      for (const heldId of run.weapons) {
        weight += beltSynergyOverlap(id, [heldId]).length;
        if (weaponRole(heldId) === candRole) weight += 1;
      }
      if (weight > 0) relatedWeighted.push({ item: id, weight });
    }
    const fighterAvail = wantedTags
      ? avail.filter(id => weaponSynergyAttrs(id).some(attr => wantedTags.has(attr)))
      : [];

    const mutatorChance = mutatorAvail.length > 0 ? DAILY_FAVORED_ROLE_CHANCE : 0;
    const relatedChance = relatedWeighted.length > 0 ? relatedChanceBase : 0;
    const fighterChance = fighterAvail.length > 0 ? BROTATO_FIGHTER_TAG_CHANCE : 0;

    const roll = rng.next();
    let pick: string;
    if (roll < mutatorChance) {
      pick = rng.pick(mutatorAvail);
    } else if (roll < mutatorChance + relatedChance) {
      pick = pickWeighted(relatedWeighted, rng);
    } else if (roll < mutatorChance + relatedChance + fighterChance) {
      pick = rng.pick(fighterAvail);
    } else {
      pick = rng.pick(avail);
    }
    chosen.push(pick);
  }

  const actFloor = run.act >= 3 ? 3 : run.act === 2 ? 2 : 1;
  const newOffers = chosen.map(weaponId => {
    const bonusLv = run.act === 1 && rng.next() < 0.3 ? 1 : run.act >= 2 && rng.next() < 0.35 ? 1 : 0;
    const level = Math.min(MAX_WEAPON_LEVEL, Math.max(minLevel, actFloor + bonusLv));
    return { weaponId, level };
  });

  // +1 Level upgrades for existing held weapons — split evenly across distinct upgradeable belt weapons (Brotato's Same Weapon rule)
  const upgradeOffers: { weaponId: string; level: number }[] = [];
  const upgradeTarget = Math.min(upgradeable.length, count - newOffers.length);
  if (upgradeSlots > 0 && upgradeTarget > 0) {
    const orderedUp = rng.shuffle(upgradeable);
    for (const upId of orderedUp) {
      if (upgradeOffers.length >= upgradeTarget) break;
      const nextLv = Math.min(MAX_WEAPON_LEVEL, Math.max((run.weaponLevels[upId] ?? 1) + 1, minLevel));
      upgradeOffers.push({ weaponId: upId, level: nextLv });
    }
  }

  // At 6/6 lead with upgrades followed by swap candidates; below 6 lead with new weapons
  return beltFull ? [...upgradeOffers, ...newOffers] : [...newOffers, ...upgradeOffers];
};

/** Pick `count` Fighter Skill Tree nodes not yet owned (prioritizing nodes linked to already-owned nodes / roots!). */
export const rollSkillNodeOptions = (
  run: Pick<SpireRun, 'fighter' | 'skillNodes'>,
  rng: Rng,
  count: number
): string[] => {
  if (count <= 0) return [];
  const tree = skillTreeOf(run.fighter);
  const owned = new Set(run.skillNodes);
  const seen = new Set<string>();
  const unowned = tree.filter(n => {
    if (owned.has(n.id) || seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
  if (unowned.length === 0) return [];
  // Prefer nodes adjacent to roots or owned nodes so the fighter's tree grows organically
  const frontier = unowned.filter(n => n.roots.length > 0 || n.links.some(l => owned.has(l)));
  const pool = frontier.length >= count ? frontier : unowned;
  return rng.shuffle(pool).slice(0, count).map(n => n.id);
};

/** Pick `count` Arcana wildcards not yet equipped (excluding XP-only Arcana unused in Starfall Summit). */
export const rollArcanaOptions = (
  run: Pick<SpireRun, 'arcana'>,
  rng: Rng,
  count: number
): ArcanaId[] => {
  if (count <= 0) return [];
  const owned = new Set(run.arcana);
  const seen = new Set<ArcanaId>();
  const unheld = ARCANA.map(a => a.id).filter(id => {
    if (owned.has(id) || SPIRE_EXCLUDED_ARCANA.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return rng.shuffle(unheld).slice(0, count);
};

/**
 * Add a weapon (capped strictly at `MAX_SUMMIT_WEAPONS = 6`), or level it up by
 * at least +1 (or to `level` if higher) when already held.
 * If NOT held and the belt is already at 6/6, returns `run` unchanged.
 */
export const grantSpireWeapon = (run: SpireRun, weaponId: string, level = 1): SpireRun => {
  const existing = run.weaponLevels[weaponId];
  if (existing !== undefined) {
    const nextLv = Math.min(MAX_WEAPON_LEVEL, Math.max(existing + 1, level));
    return {
      ...run,
      weaponLevels: {
        ...run.weaponLevels,
        [weaponId]: nextLv,
      },
    };
  }
  if (run.weapons.length >= MAX_SUMMIT_WEAPONS) return run;
  const defEvo = defaultEvolutionForWeapon(weaponId);
  const equippedEvolutions = {
    ...(run.equippedEvolutions ?? {}),
    ...(defEvo && !run.equippedEvolutions?.[weaponId] ? { [weaponId]: defEvo.id } : {}),
  };
  return {
    ...run,
    weapons: [...run.weapons, weaponId],
    weaponLevels: { ...run.weaponLevels, [weaponId]: Math.min(MAX_WEAPON_LEVEL, Math.max(1, level)) },
    equippedEvolutions,
  };
};

/**
 * Replace a held weapon in place (preserving its exact belt slot index for Understudy!)
 * with a new unheld weapon at `clamp(level, 1, MAX_WEAPON_LEVEL)`.
 * Guards against invalid `dropWeaponId` or an already-held `newWeaponId`.
 */
export const replaceSpireWeapon = (
  run: SpireRun,
  dropWeaponId: string,
  newWeaponId: string,
  level = 1
): SpireRun => {
  const dropIdx = run.weapons.indexOf(dropWeaponId);
  if (dropIdx < 0) return run;
  if (dropWeaponId === newWeaponId) return run;
  if (run.weaponLevels[newWeaponId] !== undefined || run.weapons.includes(newWeaponId)) return run;
  const clampedLv = Math.min(MAX_WEAPON_LEVEL, Math.max(1, level));
  const weapons = [...run.weapons];
  weapons[dropIdx] = newWeaponId;
  const weaponLevels = { ...run.weaponLevels };
  delete weaponLevels[dropWeaponId];
  weaponLevels[newWeaponId] = clampedLv;
  const equippedEvolutions = { ...(run.equippedEvolutions ?? {}) };
  delete equippedEvolutions[dropWeaponId];
  const defEvo = defaultEvolutionForWeapon(newWeaponId);
  if (defEvo && !equippedEvolutions[newWeaponId]) equippedEvolutions[newWeaponId] = defEvo.id;
  return { ...run, weapons, weaponLevels, equippedEvolutions };
};

/** Switch which of the 3 per-weapon timed evolutions is equipped on a held Summit weapon. */
export const equipSpireWeaponEvolution = (
  run: SpireRun,
  weaponId: string,
  evoId: string
): SpireRun => {
  if (!run.weapons.includes(weaponId)) return run;
  const def = getWeaponEvolution(evoId);
  if (!def || def.weaponId !== weaponId) return run;
  return {
    ...run,
    equippedEvolutions: {
      ...(run.equippedEvolutions ?? {}),
      [weaponId]: evoId,
    },
  };
};

/**
 * Shared acquisition helper enforcing the 6-weapon belt cap:
 * - Held weapon → upgrades immediately (no swap needed).
 * - New weapon with room (`< 6`) → adds directly.
 * - New weapon at full belt (`>= 6`) → requires a valid held `replaceWeaponId`; returns `null` otherwise.
 */
const acquireSpireWeapon = (
  run: SpireRun,
  weaponId: string,
  level: number,
  replaceWeaponId?: string
): SpireRun | null => {
  if (run.weaponLevels[weaponId] !== undefined) {
    return grantSpireWeapon(run, weaponId, level);
  }
  if (run.weapons.length < MAX_SUMMIT_WEAPONS) {
    return grantSpireWeapon(run, weaponId, level);
  }
  if (!replaceWeaponId || !run.weapons.includes(replaceWeaponId)) {
    return null;
  }
  return replaceSpireWeapon(run, replaceWeaponId, weaponId, level);
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

/** Reorder a weapon on the Summit belt (critical for positioning Understudy next to its target!). */
export const reorderSpireWeapon = (run: SpireRun, fromIndex: number, toIndex: number): SpireRun => {
  if (
    fromIndex < 0 ||
    fromIndex >= run.weapons.length ||
    toIndex < 0 ||
    toIndex >= run.weapons.length ||
    fromIndex === toIndex
  ) {
    return run;
  }
  const weapons = [...run.weapons];
  const [moved] = weapons.splice(fromIndex, 1);
  weapons.splice(toIndex, 0, moved);
  return { ...run, weapons };
};

/** 50% of base Summit shop value refunded when selling a held weapon. */
export const spireWeaponSellValue = (weaponId: string, level = 1): number => {
  const w = getArmoryWeapon(weaponId);
  const lv = Math.max(1, Math.min(MAX_WEAPON_LEVEL, level));
  const shopBase = Math.max(40, Math.round((w?.price ?? 25) * 2.1 + (lv - 1) * 22));
  return Math.max(15, Math.round(shopBase * 0.5));
};

/** Count currently locked unsold wares across all shelves of a Summit Shop. */
export const countShopLocks = (shop: SpireShopState): number =>
  shop.weapons.filter(w => w.locked && !w.sold).length +
  shop.arcana.filter(a => a.locked && !a.sold).length +
  shop.upgrades.filter(u => u.locked && !u.sold).length;

const extractLockedShop = (shop: SpireShopState): SpireLockedShopItems | undefined => {
  const weapons = shop.weapons.filter(w => w.locked && !w.sold).map(w => ({ ...w, locked: true }));
  const arcana = shop.arcana.filter(a => a.locked && !a.sold).map(a => ({ ...a, locked: true }));
  const upgrades = shop.upgrades.filter(u => u.locked && !u.sold).map(u => ({ ...u, locked: true }));
  if (weapons.length + arcana.length + upgrades.length === 0) return undefined;
  return { weapons, arcana, upgrades };
};

/** Canonical Adventure `UPGRADES` offered in the Summit Merchant's Tent (slot-cap upgrades omitted since Summit uses a fixed 6-weapon belt). */
export const SPIRE_SHOP_UPGRADE_IDS: readonly SpireShopUpgradeKind[] = [
  'heavy_hitter',
  'tough_hide',
  'lucky_purse',
  'hourglass',
  'sharp_eyes',
  'second_wind',
  'evolution_lab',
];

/** Maximum tier supported by a canonical Adventure Workshop upgrade in Starfall Summit. */
export const maxSpireUpgradeTier = (id: SpireShopUpgradeKind): number =>
  getUpgrade(id).costs.length;

/** True when a run has already reached or exceeded the maximum tier for a shop upgrade. */
export const isSpireUpgradeMaxed = (
  run: Pick<SpireRun, 'upgrades'>,
  id: SpireShopUpgradeKind
): boolean => (run.upgrades?.[id] ?? 0) >= maxSpireUpgradeTier(id);

const bumpUpgrade = (run: SpireRun, id: SpireShopUpgradeKind, delta = 1): SpireRun => ({
  ...run,
  upgrades: { ...(run.upgrades ?? {}), [id]: (run.upgrades?.[id] ?? 0) + delta },
});

const shopPriceScaleOf = (run: SpireRun): number =>
  ascensionModifiers(run.ascension).shopPriceScale *
  dailyMutatorModifiers(run.dailyMutatorId).shopPriceScale *
  (1 + (run.act - 1) * 0.12);

export const standaloneWeaponShopPrice = (
  weaponId: string,
  level: number,
  priceScale: number,
  onSale = false
): number => {
  const w = getArmoryWeapon(weaponId);
  const base = Math.max(40, Math.round(((w?.price ?? 25) * 2.1 + (level - 1) * 22) * priceScale));
  return onSale ? Math.max(25, Math.round(base * 0.55)) : base;
};

const buildShopState = (
  run: SpireRun,
  rng: Rng,
  rerolls = 0,
  carryLocked?: SpireLockedShopItems
): SpireShopState => {
  const asc = ascensionModifiers(run.ascension);
  const priceScale = shopPriceScaleOf(run);

  // Carry forward locked unsold offers (capped at MAX_SHOP_LOCKS total)
  let lockBudget = MAX_SHOP_LOCKS;
  const keptWeapons: SpireShopWeaponOffer[] = [];
  for (const lw of carryLocked?.weapons ?? []) {
    if (
      lockBudget <= 0 ||
      lw.sold ||
      SPIRE_EXCLUDED_WEAPONS.has(lw.weaponId) ||
      keptWeapons.some(w => w.weaponId === lw.weaponId)
    ) {
      continue;
    }
    const heldLv = run.weaponLevels[lw.weaponId];
    if (heldLv !== undefined && heldLv >= MAX_WEAPON_LEVEL) continue;
    if (heldLv === undefined && lw.level > 1) {
      // Weapon is no longer held (e.g. locked an upgrade offer, then sold the weapon):
      // reset to a standalone Lv 1 offer so it cannot grant a cheap high-level rebuy.
      keptWeapons.push({
        ...lw,
        level: 1,
        price: standaloneWeaponShopPrice(lw.weaponId, 1, priceScale, lw.onSale),
        sold: false,
        locked: true,
      });
    } else {
      const level = heldLv !== undefined ? Math.min(MAX_WEAPON_LEVEL, Math.max(lw.level, heldLv + 1)) : lw.level;
      keptWeapons.push({ ...lw, level, sold: false, locked: true });
    }
    lockBudget -= 1;
  }

  const keptArcana: SpireShopArcanaOffer[] = [];
  for (const la of carryLocked?.arcana ?? []) {
    if (
      lockBudget <= 0 ||
      la.sold ||
      run.arcana.includes(la.arcanaId) ||
      SPIRE_EXCLUDED_ARCANA.has(la.arcanaId) ||
      keptArcana.some(a => a.arcanaId === la.arcanaId)
    ) {
      continue;
    }
    keptArcana.push({ ...la, sold: false, locked: true });
    lockBudget -= 1;
  }

  const keptUpgrades: SpireShopUpgradeOffer[] = [];
  for (const lu of carryLocked?.upgrades ?? []) {
    if (
      lockBudget <= 0 ||
      lu.sold ||
      isSpireUpgradeMaxed(run, lu.upgradeId) ||
      keptUpgrades.some(u => u.upgradeId === lu.upgradeId)
    ) {
      continue;
    }
    keptUpgrades.push({ ...lu, sold: false, locked: true });
    lockBudget -= 1;
  }

  const keptWeaponIds = new Set(keptWeapons.map(w => w.weaponId));
  const freshOffers = rollSynergyWeapons(run, rng, Math.max(0, 4 - keptWeapons.length), 1, {
    allowUpgrade: true,
    excludeIds: keptWeaponIds,
  });
  const saleIdx = freshOffers.length > 0 ? Math.floor(rng.next() * freshOffers.length) : -1;

  const freshWeapons: SpireShopWeaponOffer[] = freshOffers.map((o, i) => {
    const isUpgrade = run.weaponLevels[o.weaponId] !== undefined;
    const onSale = i === saleIdx;
    const upgradeBase = Math.round(52 * priceScale);
    const price = isUpgrade
      ? onSale
        ? Math.max(25, Math.round(upgradeBase * 0.55))
        : upgradeBase
      : standaloneWeaponShopPrice(o.weaponId, o.level, priceScale, onSale);
    return {
      weaponId: o.weaponId,
      level: o.level,
      price,
      onSale,
      sold: false,
      locked: false,
    };
  });
  const weapons = [...keptWeapons, ...freshWeapons];

  const keptArcanaIds = new Set(keptArcana.map(a => a.arcanaId));
  const freshArcanaIds = rollArcanaOptions({ arcana: [...run.arcana, ...keptArcanaIds] }, rng, Math.max(0, 2 - keptArcana.length));
  const arcana: SpireShopArcanaOffer[] = [
    ...keptArcana,
    ...freshArcanaIds.map(arcanaId => ({
      arcanaId,
      price: Math.round(75 * priceScale),
      sold: false,
      locked: false,
    })),
  ];

  const keptUpgradeIds = new Set(keptUpgrades.map(u => u.upgradeId));
  const freshUpgrades: SpireShopUpgradeOffer[] = rng
    .shuffle(
      SPIRE_SHOP_UPGRADE_IDS.filter(
        id => !keptUpgradeIds.has(id) && !isSpireUpgradeMaxed(run, id)
      )
    )
    .slice(0, Math.max(0, 2 - keptUpgrades.length))
    .map(upgradeId => {
      const def = getUpgrade(upgradeId);
      const basePrice = Math.round(48 + (def.costs[0] ?? 200) * 0.065);
      return {
        upgradeId,
        price: Math.round(basePrice * priceScale),
        sold: false,
        locked: false,
      };
    });
  const upgrades = [...keptUpgrades, ...freshUpgrades];

  return {
    weapons,
    arcana,
    upgrades,
    healCost: Math.round(45 * priceScale),
    healAmount: Math.max(2, Math.ceil(run.maxHearts * 0.4)),
    healed: false,
    forgeCost: Math.round(55 * priceScale),
    forged: false,
    rerollCost: Math.round((25 + rerolls * 15) * asc.shopPriceScale),
    rerolls,
  };
};

// ─── Start Run ──────────────────────────────────────────────────────────────

export interface CreateSpireRunOptions {
  daily?: { dateKey: string; mutatorId: SummitDailyMutatorId };
}

export const createSpireRun = (
  fighter: CharacterName,
  ascension: number,
  seed: number,
  options?: CreateSpireRunOptions
): SpireRun => {
  const kit = STARTER_KITS[fighter];
  const asc = ascensionModifiers(ascension);
  const dailyMutatorId = options?.daily?.mutatorId;
  const dailyMod = dailyMutatorModifiers(dailyMutatorId);
  const rng = createRng((seed ^ 0x51a2fa11) >>> 0);
  const maxHearts = Math.max(3, kit.maxHearts + asc.maxHeartsDelta + dailyMod.maxHeartsDelta);
  const coins = Math.max(20, kit.startingCoins + asc.startingCoinsDelta + dailyMod.startingCoinsDelta);
  const map = generateActMap(1, seed, ascension, [], [], dailyMutatorId);

  const upgrades: Record<string, number> = {
    evolution_lab: 1, // Starfall Summit starts with Evolution Lab active (+2s evolution duration)
    ...(dailyMod.heavyHitterBonus > 0 ? { heavy_hitter: dailyMod.heavyHitterBonus } : {}),
  };

  const starterEvo = defaultEvolutionForWeapon(kit.starterWeapon);
  const bonusEvo = defaultEvolutionForWeapon(kit.bonusWeapon);
  const equippedEvolutions: Record<string, string> = {
    ...(starterEvo ? { [kit.starterWeapon]: starterEvo.id } : {}),
    ...(bonusEvo ? { [kit.bonusWeapon]: bonusEvo.id } : {}),
  };

  return {
    version: 1,
    id: options?.daily ? `spire-daily-${options.daily.dateKey}-${seed}` : `spire-${seed}-${ascension}`,
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
    startingHints: kit.startingHints + dailyMod.startingHintsDelta,
    startingGraces: kit.startingGraces + dailyMod.startingGracesDelta,
    upgrades,
    extraEvolutionDurationMs: dailyMod.extraEvolutionDurationMs,
    extraEvolutionChargeBonus: dailyMod.extraEvolutionChargeBonus,
    weapons: [kit.starterWeapon, kit.bonusWeapon],
    weaponLevels: { [kit.starterWeapon]: 2, [kit.bonusWeapon]: 2 },
    equippedEvolutions,
    arcana: [],
    skillNodes: [],
    map,
    currentNodeId: null,
    activeEncounter: null,
    seenEvents: [],
    seenEnemies: [],
    seenSpecificCounter: false,
    ...(options?.daily
      ? {
          isDaily: true,
          dailyDate: options.daily.dateKey,
          dailyMutatorId: options.daily.mutatorId,
        }
      : {}),
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

/** Create a deterministic Daily Starfall Summit climb for the given UTC `YYYY-MM-DD` date. */
export const createDailySpireRun = (dateKey?: string | null): SpireRun => {
  const cfg = getDailySummitConfig(dateKey);
  return createSpireRun(cfg.fighter, cfg.ascension, cfg.seed, {
    daily: { dateKey: cfg.dateKey, mutatorId: cfg.mutator.id },
  });
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
      prevNodeId: run.currentNodeId,
      phase: 'preview',
      activeEncounter: node.encounter ?? null,
    };
  }

  if (node.kind === 'shop') {
    return withRng(base, rng => ({
      run: { ...base, lockedShop: undefined, phase: 'shop', shop: buildShopState(base, rng, 0, base.lockedShop) },
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

  // Mystery Event — runtime safety guard swaps to an unseen event if this event was already visited
  return withRng(base, rng => {
    let eventId = node.eventId ?? 'starfall_shrine';
    if (base.seenEvents.includes(eventId)) {
      const unseen = SPIRE_EVENTS.map(e => e.id).filter(id => !base.seenEvents.includes(id));
      if (unseen.length > 0) {
        eventId = rng.pick(unseen);
      }
    }
    const seenEvents = base.seenEvents.includes(eventId) ? base.seenEvents : [...base.seenEvents, eventId];
    const offeredArcana = eventId === 'wandering_alchemist' ? rollArcanaOptions(base, rng, 1)[0] : undefined;
    return {
      run: {
        ...base,
        seenEvents,
        phase: 'event',
        event: { eventId, resolved: false, ...(offeredArcana ? { offeredArcana } : {}) },
      },
    };
  });
};

export const startSpireEncounter = (run: SpireRun): SpireRun => {
  if (run.phase !== 'preview' || !run.activeEncounter) return run;
  const hasSpecificCounter = run.activeEncounter.parry.counter.kind !== 'any';
  return {
    ...run,
    prevNodeId: undefined,
    phase: 'fight',
    seenEnemies: recordSeenEnemy(run.seenEnemies, run.activeEncounter.name),
    seenSpecificCounter: run.seenSpecificCounter || hasSpecificCounter,
  };
};

export const cancelSpirePreview = (run: SpireRun): SpireRun => {
  if (run.phase !== 'preview') return run;
  if (run.prevNodeId !== undefined) {
    const currentId = run.currentNodeId;
    return {
      ...run,
      phase: 'map',
      activeEncounter: null,
      currentNodeId: run.prevNodeId,
      prevNodeId: undefined,
      floor: Math.max(0, run.floor - 1),
      map: currentId
        ? {
            ...run.map,
            nodes: run.map.nodes.map(n => (n.id === currentId ? { ...n, visited: false } : n)),
          }
        : run.map,
    };
  }
  // Committed encounters (post-retreat or event ambushes) cannot be backed out of to the map;
  // doing so would skip a visited combat/Boss node without winning it.
  if ((run.retreats ?? 0) > 0 || run.activeEncounter?.id?.startsWith('ambush')) {
    return run;
  }
  return { ...run, phase: 'map', activeEncounter: null };
};

/**
 * Abandoning a live Summit battle is NEVER a free same-seed reset:
 *  - If at 1 ♥, retreating forfeits the run cleanly (`phase: 'defeat'`).
 *  - Otherwise it costs 1 ♥ and increments `retreats` (reshuffling the board seed)
 *    before returning to the pre-battle briefing.
 */
export const retreatSpireBattle = (run: SpireRun, foeName?: string): SpireRun => {
  if (run.phase !== 'fight') return run;
  if (run.hearts <= 1) {
    return {
      ...run,
      hearts: 0,
      phase: 'defeat',
      prevNodeId: undefined,
      defeatedBy: foeName ?? run.activeEncounter?.name ?? 'Retreated',
    };
  }
  return {
    ...run,
    hearts: run.hearts - 1,
    retreats: (run.retreats ?? 0) + 1,
    prevNodeId: undefined,
    phase: 'preview',
  };
};

// ─── Battle Completion ──────────────────────────────────────────────────────

/**
 * Resolve a finished Summit combat (`AdventureRun` handed back `RunState`).
 * In Starfall Summit, you MUST knock out the foe (`endReason === 'defeated'`) to
 * clear the floor—running out of time OR hearts ends the run!
 */
export const completeSpireBattle = (run: SpireRun, fight: RunState): SpireRun => {
  const enc = run.activeEncounter;
  if (!enc) return run;

  const won = fight.status === 'won' && fight.endReason === 'defeated';
  const seenEnemies = recordSeenEnemy(run.seenEnemies, enc.name);
  const dpm = damagePerMinute(fight);
  const mergedRecipes = [...new Set([...run.stats.forgedRecipeIds, ...fight.forgedEvolutions])];
  const { sourceDamage, floorLedger } = mergeSpireDamageLedger(
    run.stats.sourceDamage,
    run.stats.floorLedger,
    run.floor,
    fight
  );

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
    sourceDamage,
    floorLedger,
  };

  if (!won) {
    return {
      ...run,
      hearts: 0,
      phase: 'defeat',
      seenEnemies,
      stats: nextStats,
      defeatedBy: fight.foeName,
    };
  }

  // Carry over remaining hearts (clamped 1..maxHearts) + small post-fight breather on Bosses!
  const remainingHearts = Math.max(1, Math.min(run.maxHearts, fight.hearts ?? run.hearts));
  const dailyParryBonus = dailyMutatorModifiers(run.dailyMutatorId).parryBonusCoins;
  const parryBonusCoins =
    fight.parriesLanded * (4 + dailyParryBonus) + fight.perfectParriesLanded * 6;
  // Cap per-fight bonus coins so overkill_harvest / coin builds stay rewarding without flooding the Summit shop with 5,000+ unspendable gold
  const maxFightCoins = 75 + run.act * 25;
  const fightCoinBonus = Math.min(maxFightCoins, Math.round(fight.coins * 0.5));
  const coinsEarned = enc.coinReward + fightCoinBonus + parryBonusCoins;

  return withRng(run, rng => {
    const minWeaponLv =
      enc.kind === 'boss'
        ? Math.min(4, run.act + 1)
        : enc.kind === 'elite'
          ? Math.min(3, run.act + 1)
          : 1;
    const weaponOptions = rollSynergyWeapons(run, rng, 3, minWeaponLv);
    // Offer early Skill Nodes on every odd Skirmish win (starting Floor 1!) plus every Elite & Boss,
    // and offer an early Act 1 Arcana wildcard on the 2nd Skirmish win plus every Elite & Boss!
    const earlySkill = enc.kind === 'skirmish' && nextStats.skirmishesWon % 2 === 1;
    const earlyArcana = enc.kind === 'skirmish' && nextStats.skirmishesWon === 2;
    const arcanaOptions = enc.kind === 'elite' || enc.kind === 'boss' || earlyArcana ? rollArcanaOptions(run, rng, 3) : [];
    const skillOptions = enc.kind === 'elite' || enc.kind === 'boss' || earlySkill ? rollSkillNodeOptions(run, rng, 3) : [];

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
        seenEnemies,
        reward,
        stats: nextStats,
      },
    };
  });
};

// ─── Post-Battle Rewards ────────────────────────────────────────────────────

export const claimRewardWeapon = (run: SpireRun, index: number, replaceWeaponId?: string): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.weaponClaimed) return run;
  const pick = run.reward.weaponOptions[index];
  if (!pick) return run;
  const next = acquireSpireWeapon(run, pick.weaponId, pick.level, replaceWeaponId);
  if (!next) return run;
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
  if (run.arcana.includes(arcanaId)) return run;
  return { ...run, arcana: [...run.arcana, arcanaId], reward: { ...run.reward, arcanaClaimed: true } };
};

export const skipRewardArcana = (run: SpireRun): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.arcanaClaimed) return run;
  return { ...run, reward: { ...run.reward, arcanaClaimed: true } };
};

export const claimRewardSkillNode = (run: SpireRun, nodeId: string): SpireRun => {
  if (run.phase !== 'reward' || !run.reward || run.reward.skillClaimed) return run;
  if (!run.reward.skillOptions.includes(nodeId)) return run;
  if (run.skillNodes.includes(nodeId)) return run;
  return { ...run, skillNodes: [...run.skillNodes, nodeId], reward: { ...run.reward, skillClaimed: true } };
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
  // Act 3 Boss beaten for the first time → SUMMIT VICTORY (with option to Enter Endless Starfall!)
  if (cleaned.act === 3 && !cleaned.endless) {
    return { ...cleaned, phase: 'victory' };
  }
  // Act 1, Act 2, or Endless Act 4+ → advance smoothly to next Act with inter-act recovery!
  return advanceToNextAct(cleaned);
};

export const advanceToNextAct = (run: SpireRun): SpireRun => {
  const nextAct = run.act + 1;
  // Between Acts: restore 50% of missing hearts + +1 Max Heart reward for defeating an Act Boss!
  const nextMaxHearts = run.maxHearts + 1;
  const healed = Math.min(nextMaxHearts, run.hearts + Math.max(2, Math.ceil((nextMaxHearts - run.hearts) * 0.6)));
  const map = generateActMap(nextAct, run.seed, run.ascension, run.seenEvents, run.seenEnemies ?? [], run.dailyMutatorId);
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

export const shopBuyWeapon = (run: SpireRun, index: number, replaceWeaponId?: string): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const offer = run.shop.weapons[index];
  if (!offer || offer.sold || run.coins < offer.price) return run;
  const next = acquireSpireWeapon(run, offer.weaponId, offer.level, replaceWeaponId);
  if (!next) return run;
  const swappedOut =
    run.weaponLevels[offer.weaponId] === undefined && run.weapons.length >= MAX_SUMMIT_WEAPONS
      ? replaceWeaponId
      : undefined;
  const priceScale = swappedOut ? shopPriceScaleOf(run) : 1;
  return {
    ...next,
    coins: run.coins - offer.price,
    stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + offer.price },
    shop: {
      ...run.shop,
      weapons: run.shop.weapons.map((w, i) => {
        if (i === index) return { ...w, sold: true, locked: false };
        if (swappedOut && !w.sold && w.weaponId === swappedOut) {
          return {
            ...w,
            level: 1,
            locked: false,
            price: standaloneWeaponShopPrice(w.weaponId, 1, priceScale, w.onSale),
          };
        }
        return w;
      }),
    },
  };
};

export const shopBuyArcana = (run: SpireRun, index: number): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const offer = run.shop.arcana[index];
  if (!offer || offer.sold || run.coins < offer.price) return run;
  if (run.arcana.includes(offer.arcanaId)) return run;
  return {
    ...run,
    arcana: [...run.arcana, offer.arcanaId],
    coins: run.coins - offer.price,
    stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + offer.price },
    shop: {
      ...run.shop,
      arcana: run.shop.arcana.map((a, i) => (i === index ? { ...a, sold: true, locked: false } : a)),
    },
  };
};

export const shopBuyUpgrade = (run: SpireRun, index: number): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const offer = run.shop.upgrades[index];
  if (!offer || offer.sold || run.coins < offer.price) return run;
  if (isSpireUpgradeMaxed(run, offer.upgradeId)) return run;
  let next: SpireRun = bumpUpgrade(
    {
      ...run,
      coins: run.coins - offer.price,
      stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + offer.price },
      shop: {
        ...run.shop,
        upgrades: run.shop.upgrades.map((u, i) => (i === index ? { ...u, sold: true, locked: false } : u)),
      },
    },
    offer.upgradeId,
    1
  );
  // Tough Hide also updates Summit's persistent maxHearts & heals +1 ♥ immediately
  if (offer.upgradeId === 'tough_hide') {
    next = { ...next, maxHearts: next.maxHearts + 1, hearts: Math.min(next.maxHearts + 1, next.hearts + 1) };
  }
  return next;
};

/** Toggle a lock on an unsold shop item (up to MAX_SHOP_LOCKS=2 total across shelves). */
export const shopToggleLock = (
  run: SpireRun,
  kind: 'weapon' | 'arcana' | 'upgrade',
  index: number
): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  const shop = run.shop;
  const lockedCount = countShopLocks(shop);

  if (kind === 'weapon') {
    const item = shop.weapons[index];
    if (!item || item.sold) return run;
    if (!item.locked && lockedCount >= MAX_SHOP_LOCKS) return run;
    return {
      ...run,
      shop: {
        ...shop,
        weapons: shop.weapons.map((w, i) => (i === index ? { ...w, locked: !w.locked } : w)),
      },
    };
  }
  if (kind === 'arcana') {
    const item = shop.arcana[index];
    if (!item || item.sold || (!item.locked && run.arcana.includes(item.arcanaId))) return run;
    if (!item.locked && lockedCount >= MAX_SHOP_LOCKS) return run;
    return {
      ...run,
      shop: {
        ...shop,
        arcana: shop.arcana.map((a, i) => (i === index ? { ...a, locked: !a.locked } : a)),
      },
    };
  }
  const item = shop.upgrades[index];
  if (!item || item.sold || (!item.locked && isSpireUpgradeMaxed(run, item.upgradeId))) return run;
  if (!item.locked && lockedCount >= MAX_SHOP_LOCKS) return run;
  return {
    ...run,
    shop: {
      ...shop,
      upgrades: shop.upgrades.map((u, i) => (i === index ? { ...u, locked: !u.locked } : u)),
    },
  };
};

/** Sell a held weapon in the Summit Shop for 50% of shop value (must keep at least 1 weapon). */
export const shopSellWeapon = (run: SpireRun, weaponId: string): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  if (run.weapons.length <= 1 || !run.weapons.includes(weaponId)) return run;
  const lv = run.weaponLevels[weaponId] ?? 1;
  const refund = spireWeaponSellValue(weaponId, lv);
  const priceScale = shopPriceScaleOf(run);
  const nextLevels = { ...run.weaponLevels };
  delete nextLevels[weaponId];
  const nextEvos = { ...(run.equippedEvolutions ?? {}) };
  delete nextEvos[weaponId];
  return {
    ...run,
    coins: run.coins + refund,
    weapons: run.weapons.filter(id => id !== weaponId),
    weaponLevels: nextLevels,
    equippedEvolutions: nextEvos,
    shop: {
      ...run.shop,
      // Reset any unsold upgrade offer for this weapon to standalone Lv 1 so
      // selling a high-level weapon can never be paired with a cheap upgrade rebuy.
      weapons: run.shop.weapons.map(w =>
        !w.sold && w.weaponId === weaponId
          ? {
              ...w,
              level: 1,
              locked: false,
              price: standaloneWeaponShopPrice(w.weaponId, 1, priceScale, w.onSale),
            }
          : w
      ),
    },
  };
};

/** Purge an unwanted Arcana in the Summit Shop for ARCANA_PURGE_COST (40¢). */
export const shopPurgeArcana = (run: SpireRun, arcanaId: ArcanaId): SpireRun => {
  if (run.phase !== 'shop' || !run.shop) return run;
  if (!run.arcana.includes(arcanaId) || run.coins < ARCANA_PURGE_COST) return run;
  return {
    ...run,
    coins: run.coins - ARCANA_PURGE_COST,
    stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + ARCANA_PURGE_COST },
    arcana: run.arcana.filter(id => id !== arcanaId),
  };
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
  const locked = extractLockedShop(run.shop);
  return withRng(run, rng => {
    const fresh = buildShopState(run, rng, nextRerolls, locked);
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
  const lockedShop = run.shop ? extractLockedShop(run.shop) : undefined;
  return { ...run, shop: null, lockedShop, phase: 'map' };
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
  if (run.skillNodes.includes(nodeId)) return run;
  const skillNodes = [...run.skillNodes, nodeId];
  const nodeName = skillTreeOf(run.fighter).find(n => n.id === nodeId)?.name ?? 'Technique';
  return {
    ...run,
    skillNodes,
    campfire: {
      ...run.campfire,
      resolved: true,
      outcomeText: `Mastered ${nodeName} for the rest of this climb!`,
    },
  };
};

export const leaveCampfire = (run: SpireRun): SpireRun => {
  if (run.phase !== 'campfire') return run;
  return { ...run, campfire: null, phase: 'map' };
};

// ─── Treasure Vault ─────────────────────────────────────────────────────────

export const claimTreasure = (
  run: SpireRun,
  choice: 'weapon' | 'arcana' | 'coins',
  replaceWeaponId?: string
): SpireRun => {
  if (run.phase !== 'treasure' || !run.treasure || run.treasure.claimed) return run;
  const t = run.treasure;
  let next: SpireRun = { ...run, coins: run.coins + t.coins };
  let outcomeText = `Claimed ${t.coins}¢`;

  if (choice === 'weapon') {
    const acquired = acquireSpireWeapon(next, t.weaponOffer.weaponId, t.weaponOffer.level, replaceWeaponId);
    if (!acquired) return run;
    const isUpgrade = run.weaponLevels[t.weaponOffer.weaponId] !== undefined;
    const swappedOut = !isUpgrade && run.weapons.length >= MAX_SUMMIT_WEAPONS ? replaceWeaponId : undefined;
    next = acquired;
    const wName = getArmoryWeapon(t.weaponOffer.weaponId)?.name ?? t.weaponOffer.weaponId;
    const finalLv = next.weaponLevels[t.weaponOffer.weaponId] ?? t.weaponOffer.level;
    if (swappedOut) {
      const dropName = getArmoryWeapon(swappedOut)?.name ?? swappedOut;
      outcomeText = `Claimed ${t.coins}¢ & swapped ${dropName} for ${wName} (Lv ${finalLv})!`;
    } else if (isUpgrade) {
      outcomeText = `Claimed ${t.coins}¢ & upgraded ${wName} to Lv ${finalLv}!`;
    } else {
      outcomeText = `Claimed ${t.coins}¢ + ${wName} (Lv ${finalLv})!`;
    }
  } else if (choice === 'arcana' && t.arcanaOffer && !next.arcana.includes(t.arcanaOffer)) {
    const arcana = [...next.arcana, t.arcanaOffer];
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
    let outcomeText = 'You continue up the trail.';
    let ambushEncounter: SpireEncounter | undefined;
    let pendingWeaponOptions: { weaponId: string; level: number }[] | undefined;
    let pendingSkillOptions: string[] | undefined;
    let pendingArcanaOffer: ArcanaId | undefined;
    let pendingForge = false;
    let pendingForgeDelta: number | undefined;

    const key = `${ev.id}:${optionId}`;
    switch (key) {
      case 'starfall_shrine:absorb':
        next = { ...next, hearts: Math.max(1, next.hearts - 1), extraEvolutionDurationMs: next.extraEvolutionDurationMs + 3000 };
        pendingWeaponOptions = rollSynergyWeapons(next, rng, 3, 2);
        outcomeText = 'Starlight sears your paws (−1 ♥, +3s evolution duration). Pick a Level 2 weapon!';
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
        pendingForgeDelta = 2;
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
        next = bumpUpgrade(next, 'heavy_hitter', 1);
        outcomeText = 'Reinforced your strike: +1 flat damage on every Set!';
        break;

      case 'mirror_pond:study': {
        const skillOpts = rollSkillNodeOptions(next, rng, 3);
        if (skillOpts.length > 0) {
          next = { ...next, coins: next.coins - 35, stats: { ...next.stats, coinsSpent: next.stats.coinsSpent + 35 } };
          pendingSkillOptions = skillOpts;
          outcomeText = `Your reflection reveals ${skillOpts.length === 1 ? 'a final technique' : `${skillOpts.length} techniques`} — choose one to master!`;
        } else {
          next = { ...next, coins: next.coins + 45 };
          outcomeText = 'You have already mastered every fighter technique — your reflection leaves +45¢ in tribute!';
        }
        break;
      }
      case 'mirror_pond:drink':
        next = { ...next, hearts: next.maxHearts };
        outcomeText = `Crystal water restores you to full health (${next.hearts}/${next.maxHearts} ♥)!`;
        break;
      case 'mirror_pond:coin':
        next = { ...next, startingGraces: next.startingGraces + 1, startingHints: next.startingHints + 1 };
        outcomeText = 'Ripples bless your journey: +1 Starting Grace and +1 Starting Hint!';
        break;

      case 'wandering_alchemist:arcana': {
        const preRolled =
          run.event?.offeredArcana && !next.arcana.includes(run.event.offeredArcana) && !SPIRE_EXCLUDED_ARCANA.has(run.event.offeredArcana)
            ? run.event.offeredArcana
            : undefined;
        const offerId = preRolled ?? rollArcanaOptions(next, rng, 1)[0];
        if (offerId) {
          pendingArcanaOffer = offerId;
          const def = ARCANA.find(a => a.id === offerId);
          outcomeTitle = def ? `Arcana Offer · ${def.name}` : 'Arcana Offer';
          outcomeText = 'Inspect the Tarot vial carefully — Accept its kiss-curse power or Decline safely.';
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
          extraEvolutionDurationMs: next.extraEvolutionDurationMs + 3000,
          extraEvolutionChargeBonus: next.extraEvolutionChargeBonus + 1,
        };
        outcomeText = 'Overdrive tonic! +1 evolution progress tick & +3s evolution duration!';
        break;

      case 'gamblers_dice:high_stakes': {
        next = { ...next, coins: next.coins - 45, stats: { ...next.stats, coinsSpent: next.stats.coinsSpent + 45 } };
        if (rng.next() < 0.65) {
          next = { ...next, coins: next.coins + 135 };
          outcomeTitle = 'JACKPOT!';
          if (next.weapons.length >= MAX_SUMMIT_WEAPONS) {
            const upgradeable = next.weapons.filter(id => (next.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL);
            if (upgradeable.length > 0) {
              const wId = rng.pick(upgradeable);
              next = upgradeSpireWeapon(next, wId, 1);
              const wName = getArmoryWeapon(wId)?.name ?? wId;
              outcomeText = `Double sixes! Won +135¢ and upgraded ${wName} to Lv ${next.weaponLevels[wId]}!`;
            } else {
              next = { ...next, coins: next.coins + 100 };
              outcomeText = 'Double sixes! Belt maxed (6/6) — won +235¢ jackpot gold!';
            }
          } else {
            const prize = rollSynergyWeapons(next, rng, 1, 2, { allowUpgrade: false })[0];
            if (prize) next = grantSpireWeapon(next, prize.weaponId, prize.level);
            const wName = prize ? getArmoryWeapon(prize.weaponId)?.name ?? prize.weaponId : 'bonus loot';
            outcomeText = `Double sixes! Won +135¢ and ${wName} (Lv ${prize?.level ?? 2})!`;
          }
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
        next = bumpUpgrade(next, 'hourglass', 1);
        outcomeText = 'Time saved! +8s added to every future fight clock.';
        break;

      case 'sleeping_hoard:wake': {
        const excludeEnemies = new Set<string>(next.seenEnemies ?? []);
        const mapEnemies = new Set<string>();
        for (const n of next.map.nodes) {
          if (n.encounter?.name) {
            excludeEnemies.add(n.encounter.name);
            mapEnemies.add(n.encounter.name);
          }
        }
        const enc = generateSpireEncounter({
          act: next.act,
          row: Math.min(5, next.floor % 6),
          kind: 'elite',
          ascension: next.ascension,
          rng,
          id: `ambush-${next.floor}`,
          excludeEnemies,
          mustExcludeEnemies: mapEnemies,
          dailyMutatorId: next.dailyMutatorId,
        });
        next = { ...next, seenEnemies: recordSeenEnemy(next.seenEnemies, enc.name) };
        ambushEncounter = { ...enc, coinReward: enc.coinReward * 2 };
        outcomeTitle = 'THE GUARDIAN AWAKES!';
        outcomeText = `${enc.name} lunges from the treasure pile! Victory pays DOUBLE coins + full Elite loot!`;
        break;
      }
      case 'sleeping_hoard:sneak':
        next = { ...next, coins: next.coins + 55 };
        outcomeText = 'Silent paws! You slip away with +55¢.';
        break;

      case 'ancient_library:technique': {
        const skillOpts = rollSkillNodeOptions(next, rng, 3);
        if (skillOpts.length > 0) {
          pendingSkillOptions = skillOpts;
          outcomeText = `${skillOpts.length === 1 ? 'One final forgotten scroll unfurls' : `${skillOpts.length} forgotten scrolls unfurl`} — choose a Fighter Skill Node!`;
        } else {
          next = { ...next, coins: next.coins + 65 };
          outcomeText = 'You already know every treatise in the archive — you pocket +65¢ of rare star-ink instead!';
        }
        break;
      }
      case 'ancient_library:fusion':
        next = {
          ...next,
          extraEvolutionDurationMs: next.extraEvolutionDurationMs + 4000,
          extraEvolutionChargeBonus: next.extraEvolutionChargeBonus + 1,
        };
        outcomeText = 'Evolution mastery! +1 evolution progress tick and +4s evolution duration!';
        break;
      case 'ancient_library:clarity':
        next = bumpUpgrade(bumpUpgrade(next, 'sharp_eyes', 2), 'hourglass', 1);
        outcomeText = 'Sharp mind! +2 Starting Hints and +8s on every future clock.';
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
        next = bumpUpgrade(next, 'heavy_hitter', 2);
        outcomeText = 'Sharpened form! +2 flat damage on every Set.';
        break;

      case 'shady_peddler:buy_crate': {
        next = { ...next, coins: next.coins - 55, stats: { ...next.stats, coinsSpent: next.stats.coinsSpent + 55 } };
        if (next.weapons.length >= MAX_SUMMIT_WEAPONS) {
          const upgradeable = next.weapons.filter(id => (next.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL);
          const newPrize = rollSynergyWeapons(next, rng, 1, 3, { allowUpgrade: false })[0];
          const options: { weaponId: string; level: number }[] = [];
          if (upgradeable.length > 0) {
            const engineUp = upgradeable.filter(id => ENGINE_ROLES.has(weaponRole(id)));
            const pickUp = rng.pick(engineUp.length > 0 ? engineUp : upgradeable);
            const targetLv = Math.min(MAX_WEAPON_LEVEL, Math.max((next.weaponLevels[pickUp] ?? 1) + 1, 3));
            options.push({ weaponId: pickUp, level: targetLv });
          }
          if (newPrize) {
            options.push({ weaponId: newPrize.weaponId, level: Math.max(3, newPrize.level) });
          }
          if (options.length > 0) {
            pendingWeaponOptions = options;
            outcomeText =
              upgradeable.length > 0
                ? 'Belt full (6/6)! Boost a held weapon to Lv 3+ or swap in a Level 3 Synergy Weapon!'
                : 'Belt maxed (6/6)! Inside the crate: a pristine Level 3 Synergy Weapon to swap in (or skip for +25¢)!';
          } else {
            next = { ...next, coins: next.coins + 110 };
            outcomeText = 'A stash of rare gold coins (+110¢)!';
          }
        } else {
          const prize = rollSynergyWeapons(next, rng, 1, 3, { allowUpgrade: false })[0];
          if (prize) {
            next = grantSpireWeapon(next, prize.weaponId, 3);
            const wName = getArmoryWeapon(prize.weaponId)?.name ?? prize.weaponId;
            outcomeText = `Inside the crate: a pristine Level 3 ${wName}!`;
          } else {
            next = { ...next, coins: next.coins + 110 };
            outcomeText = 'A stash of rare gold coins (+110¢)!';
          }
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
        if (!picked.length) next = bumpUpgrade(next, 'heavy_hitter', 2);
        break;
      }
      case 'prism_obelisk:prism_shard':
        next = {
          ...bumpUpgrade(next, 'heavy_hitter', 2),
          extraEvolutionDurationMs: next.extraEvolutionDurationMs + 3000,
        };
        outcomeText = 'Prism resonance! +2 flat Set damage & +3s evolution duration.';
        break;
      case 'prism_obelisk:bask':
        next = { ...next, maxHearts: next.maxHearts + 1, hearts: Math.min(next.maxHearts + 1, next.hearts + 1) };
        outcomeText = `Restorative glow! +1 Max Heart & +1 ♥ (${next.hearts}/${next.maxHearts}).`;
        break;

      case 'starlight_forge:channel': {
        const upgradeable = next.weapons.filter(id => (next.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL);
        if (upgradeable.length > 0) {
          next = {
            ...next,
            coins: next.coins - 40,
            stats: { ...next.stats, coinsSpent: next.stats.coinsSpent + 40 },
            extraEvolutionDurationMs: next.extraEvolutionDurationMs + 2000,
          };
          pendingForge = true;
          pendingForgeDelta = 1;
          outcomeText = 'Starlight flows through the cairn (−40¢, +2s evolution duration). Choose a weapon to forge +1 Level!';
        } else {
          next = { ...next, extraEvolutionDurationMs: next.extraEvolutionDurationMs + 3000 };
          outcomeText = 'Every weapon is already maxed — the cairn infuses your belt with +3s evolution duration for free!';
        }
        break;
      }
      case 'starlight_forge:attune_cairn':
        next = {
          ...next,
          extraEvolutionDurationMs: next.extraEvolutionDurationMs + 3000,
          extraEvolutionChargeBonus: next.extraEvolutionChargeBonus + 1,
        };
        outcomeText = 'Starfall sparks orbit your belt (+1 evolution progress tick & +3s evolution duration)!';
        break;
      case 'starlight_forge:rest_cairn':
        next = {
          ...next,
          hearts: Math.min(next.maxHearts, next.hearts + 2),
          coins: next.coins + 35,
        };
        outcomeText = `Caught your breath by the cairn (+2 ♥, ${next.hearts}/${next.maxHearts}) and pocketed +35¢!`;
        break;

      case 'echoing_cavern:train': {
        const skillOpts = rollSkillNodeOptions(next, rng, 3);
        if (skillOpts.length > 0) {
          pendingSkillOptions = skillOpts;
          outcomeText = `Your echo demonstrates ${skillOpts.length === 1 ? 'a final technique' : `${skillOpts.length} techniques`} — choose a Fighter Skill Node!`;
        } else {
          next = { ...next, coins: next.coins + 65 };
          outcomeText = 'You have already mastered every fighter technique — you uncover +65¢ glittering in the cavern wall!';
        }
        break;
      }
      case 'echoing_cavern:listen':
        next = {
          ...next,
          startingGraces: next.startingGraces + 1,
          startingHints: next.startingHints + 2,
        };
        outcomeText = 'Crystal acoustics sharpen your senses (+1 Starting Grace & +2 Starting Hints)!';
        break;
      case 'echoing_cavern:strike':
        next = bumpUpgrade(next, 'heavy_hitter', 1);
        outcomeText = 'Resonance crystal shattered! +1 flat damage on every Set.';
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
          ...(pendingArcanaOffer ? { pendingArcanaOffer } : {}),
          ...(pendingForge ? { pendingForge: true, ...(pendingForgeDelta !== undefined ? { pendingForgeDelta } : {}) } : {}),
        },
      },
    };
  });
};

export const resolveEventPendingArcana = (run: SpireRun, accept: boolean): SpireRun => {
  if (run.phase !== 'event' || !run.event?.pendingArcanaOffer) return run;
  const offerId = run.event.pendingArcanaOffer;
  const def = ARCANA.find(a => a.id === offerId);
  const name = def?.name ?? offerId;
  if (!accept || run.arcana.includes(offerId)) {
    return {
      ...run,
      event: {
        ...run.event,
        pendingArcanaOffer: undefined,
        outcomeTitle: accept ? 'Already Bound' : 'Declined',
        outcomeText: accept
          ? `You already hold ${name} — you leave the vial corked.`
          : `You corked the vial and politely declined ${name}.`,
      },
    };
  }
  const arcana = [...run.arcana, offerId];
  return {
    ...run,
    arcana,
    event: {
      ...run.event,
      pendingArcanaOffer: undefined,
      outcomeTitle: `Bound ${name}!`,
      outcomeText: `Wild magic swirls — ${name} is now active for the rest of your climb!`,
    },
  };
};

export const resolveEventPendingWeapon = (
  run: SpireRun,
  index: number,
  replaceWeaponId?: string
): SpireRun => {
  if (run.phase !== 'event' || !run.event?.pendingWeaponOptions) return run;
  const pick = run.event.pendingWeaponOptions[index];
  if (!pick) return run;
  const next = acquireSpireWeapon(run, pick.weaponId, pick.level, replaceWeaponId);
  if (!next) return run;
  const isUpgrade = run.weaponLevels[pick.weaponId] !== undefined;
  const swappedOut = !isUpgrade && run.weapons.length >= MAX_SUMMIT_WEAPONS ? replaceWeaponId : undefined;
  const wName = getArmoryWeapon(pick.weaponId)?.name ?? pick.weaponId;
  const finalLv = next.weaponLevels[pick.weaponId] ?? pick.level;
  const outcomeText = swappedOut
    ? `Swapped ${getArmoryWeapon(swappedOut)?.name ?? swappedOut} for ${wName} (Lv ${finalLv})!`
    : isUpgrade
      ? `Upgraded ${wName} to Lv ${finalLv}!`
      : `Claimed ${wName} (Lv ${finalLv})!`;
  return {
    ...next,
    event: {
      ...run.event,
      pendingWeaponOptions: undefined,
      outcomeText,
    },
  };
};

export const skipEventPendingWeapon = (run: SpireRun): SpireRun => {
  if (run.phase !== 'event' || !run.event?.pendingWeaponOptions?.length) return run;
  return {
    ...run,
    coins: run.coins + SKIP_WEAPON_COINS,
    event: {
      ...run.event,
      pendingWeaponOptions: undefined,
      outcomeText: `Kept your current belt and pocketed +${SKIP_WEAPON_COINS}¢ instead!`,
    },
  };
};

export const resolveEventPendingSkill = (run: SpireRun, nodeId: string): SpireRun => {
  if (run.phase !== 'event' || !run.event?.pendingSkillOptions) return run;
  if (!run.event.pendingSkillOptions.includes(nodeId)) return run;
  if (run.skillNodes.includes(nodeId)) return run;
  const skillNodes = [...run.skillNodes, nodeId];
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
  const delta = run.event.pendingForgeDelta ?? 2;
  const next = upgradeSpireWeapon(run, weaponId, delta);
  const wName = getArmoryWeapon(weaponId)?.name ?? weaponId;
  return {
    ...next,
    event: {
      ...run.event,
      pendingForge: undefined,
      pendingForgeDelta: undefined,
      outcomeText: `${delta >= 2 ? 'Overclocked' : 'Tempered'} ${wName} to Level ${next.weaponLevels[weaponId]}!`,
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
