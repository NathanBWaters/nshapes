/**
 * Hybrid Balance Fingerprinting (Node/Jest-only — never imported into RN bundles).
 *
 * Detects mechanical balance changes automatically with ZERO false positives on
 * cosmetic UI/copy/audio/motion work by combining:
 *  1. SHA-256 hashes of combat-math engine & global rule files (tagged by scope).
 *  2. Per-item canonical mechanical hashes of every Armory weapon, Evolution recipe,
 *     Fighter (passives + tuning + skill tree), Arcana, and Campaign level — stripping
 *     cosmetic strings (`name`, `description`, `flavor`, `icon`, `callout`, `taunt`).
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ARCANA } from '@/adventure/data/arcana';
import { ALL_ARMORY_WEAPON_IDS, armoryBaseWeapon } from '@/adventure/data/armory';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { FIGHTERS } from '@/adventure/data/fighters';
import { LEVELS } from '@/adventure/data/levels';
import { COMBO_MS_PER_EXTRA_TRAIT, DEFAULT_COMBO_WINDOW_MS, PASSIVE_TUNING } from '@/adventure/data/passives';
import { CAMPAIGN_STARS, SEALED_AT, TREE_BUDGET, skillTreeOf } from '@/adventure/data/skillTrees';
import { HINTED_SET_MS, WEAPON_GROWTH } from '@/adventure/data/weaponGrowth';
import {
  POWER_KNEE,
  POWER_LEVEL_FLOOR,
  POWER_SHARE,
  POWER_TAIL,
  powerPer,
  powerWatches,
} from '@/adventure/data/weaponPower';
import type { AdventureWeapon } from '@/adventure/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import type {
  BalanceCategory,
  BalanceEraInvalidation,
  BalanceEraScope,
  BalanceFingerprintsSnapshot,
  FightModeFilter,
} from './balanceEras';

export interface WatchedEngineFile {
  path: string;
  scope: 'global' | 'adventure' | 'spire';
}

/**
 * Combat-math engine & rule files whose modification invalidates telemetry at either
 * global, Adventure, or Starfall Summit scope.
 *
 * Intentionally excludes cosmetic/guide/UI/audio/copy/bot files (`weaponGuide.ts`,
 * `weaponRoles.ts`, `story.ts`, `biomes.ts`, `mechanics.ts`, `components/`, `audio/`).
 */
export const WATCHED_ENGINE_FILES: readonly WatchedEngineFile[] = [
  // Global combat engine & shared rules
  { path: 'src/adventure/engine/run.ts', scope: 'global' },
  { path: 'src/adventure/engine/fight.ts', scope: 'global' },
  { path: 'src/adventure/engine/gear.ts', scope: 'global' },
  { path: 'src/adventure/engine/evolutions.ts', scope: 'global' },
  { path: 'src/adventure/engine/growth.ts', scope: 'global' },
  { path: 'src/adventure/engine/hazards.ts', scope: 'global' },
  { path: 'src/adventure/engine/parry.ts', scope: 'global' },
  { path: 'src/adventure/engine/passives.ts', scope: 'global' },
  { path: 'src/adventure/engine/sets.ts', scope: 'global' },
  { path: 'src/adventure/engine/sources.ts', scope: 'global' },
  { path: 'src/adventure/engine/dealer.ts', scope: 'global' },
  { path: 'src/adventure/engine/surge.ts', scope: 'global' },
  { path: 'src/adventure/rules/engine.ts', scope: 'global' },
  { path: 'src/adventure/loadout.ts', scope: 'global' },
  { path: 'src/adventure/weaponLevels.ts', scope: 'global' },
  { path: 'src/adventure/data/rules.ts', scope: 'global' },
  { path: 'src/adventure/data/parry.ts', scope: 'global' },
  { path: 'src/adventure/data/weaponStats.ts', scope: 'global' },
  { path: 'src/adventure/data/upgrades.ts', scope: 'global' },
  { path: 'src/adventure/data/armory.ts', scope: 'global' },
  { path: 'src/adventure/data/foes.ts', scope: 'global' },
  { path: 'src/utils/weaponEffects.ts', scope: 'global' },
  { path: 'src/utils/matchResolution.ts', scope: 'global' },
  { path: 'src/utils/gameConfig.ts', scope: 'global' },
  { path: 'src/utils/enemyEffects.ts', scope: 'global' },
  { path: 'src/utils/enemyFactory.ts', scope: 'global' },
  // Starfall Summit (Spire) mode-specific balance files
  { path: 'src/spire/data/ascensions.ts', scope: 'spire' },
  { path: 'src/spire/data/encounters.ts', scope: 'spire' },
  { path: 'src/spire/data/events.ts', scope: 'spire' },
  { path: 'src/spire/engine/bridge.ts', scope: 'spire' },
  { path: 'src/spire/engine/runState.ts', scope: 'spire' },
  { path: 'src/spire/engine/mapGen.ts', scope: 'spire' },
];

export const VIRTUAL_GLOBAL_CONSTANTS_KEY = 'virtual:globalConstants';

const COSMETIC_KEYS = new Set([
  'name',
  'description',
  'shortDescription',
  'flavor',
  'flavorText',
  'icon',
  'callout',
  'taunt',
  'blurb',
  'look',
  'say',
  'text',
  'tagline',
  'upside',
  'tradeoff',
  'numeral',
  'familyText',
  'activeText',
  'recommended',
  'biome',
  'introduces',
  'pos',
]);

/** Recursively canonicalizes a value (sorted keys, strips cosmetic fields) for stable hashing. */
const canonicalize = (val: unknown, stripCosmetic: boolean = true): unknown => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : String(val);
  if (typeof val === 'string' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return val.map(v => canonicalize(v, stripCosmetic));
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    for (const [k, v] of entries) {
      if (v === undefined || typeof v === 'function') continue;
      if (stripCosmetic && COSMETIC_KEYS.has(k)) continue;
      out[k] = canonicalize(v, stripCosmetic);
    }
    return out;
  }
  return String(val);
};

const sha256Short = (content: string | Buffer): string =>
  crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

const hashMechanical = (payload: unknown): string =>
  sha256Short(JSON.stringify(canonicalize(payload, true)));

/** Computes per-item canonical mechanical hashes across weapons, evolutions, fighters, arcana, and levels. */
export const computeItemFingerprints = (): BalanceFingerprintsSnapshot['items'] => {
  const weapons: Record<string, string> = {};
  for (const id of [...ALL_ARMORY_WEAPON_IDS].sort()) {
    const base = armoryBaseWeapon(id) as AdventureWeapon | undefined;
    if (!base) continue;
    const growth = (WEAPON_GROWTH[id] ?? []).map(g => ({
      watch: g.watch,
      every: g.every,
      unbroken: g.unbroken,
      chance: g.chance,
      max: g.max,
      stat: g.stat,
      mods: g.mods,
      now: g.now,
      proc: g.proc,
    }));
    weapons[id] = hashMechanical({
      id,
      effects: base.effects,
      perLevel: base.perLevel,
      specialEffect: base.specialEffect,
      bridgeEffect: base.bridgeEffect,
      maxCount: base.maxCount,
      price: base.price,
      rules: base.rules,
      modifiers: base.modifiers,
      growth,
      powerPer: powerPer(id),
      powerWatches: powerWatches(id),
    });
  }

  const evolutions: Record<string, string> = {};
  for (const recipe of [...EVOLUTION_RECIPES].sort((a, b) => a.id.localeCompare(b.id))) {
    evolutions[recipe.id] = hashMechanical({
      id: recipe.id,
      families: recipe.families.map(f => [...f].sort()),
      source: recipe.source,
    });
  }

  const fighters: Record<string, string> = {};
  for (const fighter of [...FIGHTERS].sort((a, b) => a.name.localeCompare(b.name))) {
    const nodes = skillTreeOf(fighter.name)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(n => ({
        id: n.id,
        cost: n.cost,
        links: [...n.links].sort(),
        roots: [...n.roots].sort(),
        requires: n.requires,
        rules: n.rules,
        modifiers: n.modifiers,
      }));
    fighters[fighter.name] = hashMechanical({
      name: fighter.name,
      passives: fighter.passives,
      passiveTuning: fighter.passives.map(p => PASSIVE_TUNING[p]),
      tree: nodes,
    });
  }

  const arcana: Record<string, string> = {};
  for (const a of [...ARCANA].sort((x, y) => x.id.localeCompare(y.id))) {
    arcana[a.id] = hashMechanical({ id: a.id, rules: a.rules });
  }

  const levels: Record<string, string> = {};
  for (const lvl of [...LEVELS].sort((a, b) => a.id.localeCompare(b.id))) {
    levels[lvl.id] = hashMechanical({
      id: lvl.id,
      rules: lvl.rules,
      foes: lvl.foes.map(f => ({
        enemy: f.enemy,
        hp: f.hp,
        parry: f.parry,
      })),
      challenge: lvl.challenge,
      starRule: lvl.starRule,
      coinMultiplier: lvl.coinMultiplier,
      difficulty: lvl.difficulty,
      isBoss: lvl.isBoss,
      isElite: lvl.isElite,
      branchOf: lvl.branchOf,
      opensAt: lvl.opensAt,
    });
  }

  return { weapons, evolutions, fighters, arcana, levels };
};

/** Computes SHA-256 content hashes for all watched combat-math engine files + virtual global constants. */
export const computeEngineFileHashes = (repoRoot: string): Record<string, string> => {
  const out: Record<string, string> = {};

  out[VIRTUAL_GLOBAL_CONSTANTS_KEY] = hashMechanical({
    DEFAULT_PLAYER_STATS,
    DEFAULT_COMBO_WINDOW_MS,
    COMBO_MS_PER_EXTRA_TRAIT,
    HINTED_SET_MS,
    POWER_KNEE,
    POWER_TAIL,
    POWER_SHARE,
    POWER_LEVEL_FLOOR,
    CAMPAIGN_STARS,
    TREE_BUDGET,
    SEALED_AT,
  });

  for (const entry of WATCHED_ENGINE_FILES) {
    const abs = path.resolve(repoRoot, entry.path);
    if (!fs.existsSync(abs)) {
      out[entry.path] = 'MISSING';
      continue;
    }
    // Normalize CRLF -> LF so hashes are identical across macOS/Linux/Windows CI runners
    const normalized = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    out[entry.path] = sha256Short(normalized);
  }
  return out;
};

/** Computes the complete hybrid balance fingerprint snapshot for the repository. */
export const computeBalanceFingerprints = (repoRoot: string): BalanceFingerprintsSnapshot => ({
  engineFiles: computeEngineFileHashes(repoRoot),
  items: computeItemFingerprints(),
});

export interface BalanceFingerprintDiff {
  hasChanges: boolean;
  changedEngineFiles: string[];
  addedEngineFiles: string[];
  removedEngineFiles: string[];
  changedItems: Record<BalanceCategory, string[]>;
  addedItems: Record<BalanceCategory, string[]>;
  removedItems: Record<BalanceCategory, string[]>;
  inferredScope: BalanceEraScope;
  inferredInvalidation: BalanceEraInvalidation;
}

const CATEGORIES: readonly BalanceCategory[] = ['weapons', 'evolutions', 'fighters', 'arcana', 'levels'];

const FILE_SCOPE_MAP = new Map<string, WatchedEngineFile['scope']>(
  WATCHED_ENGINE_FILES.map(f => [f.path, f.scope])
);

const diffRecord = (
  prev: Record<string, string>,
  curr: Record<string, string>
): { changed: string[]; added: string[]; removed: string[] } => {
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const [k, v] of Object.entries(curr)) {
    if (!(k in prev)) added.push(k);
    else if (prev[k] !== v) changed.push(k);
  }
  for (const k of Object.keys(prev)) {
    if (!(k in curr)) removed.push(k);
  }
  changed.sort();
  added.sort();
  removed.sort();
  return { changed, added, removed };
};

/**
 * Compares two fingerprint snapshots and automatically infers whether the balance
 * change is global, mode-scoped, category-scoped, or granular to exact item IDs.
 */
export const diffBalanceFingerprints = (
  previous: BalanceFingerprintsSnapshot,
  current: BalanceFingerprintsSnapshot
): BalanceFingerprintDiff => {
  const eng = diffRecord(previous.engineFiles ?? {}, current.engineFiles ?? {});
  const changedItems: Record<BalanceCategory, string[]> = {
    weapons: [],
    evolutions: [],
    fighters: [],
    arcana: [],
    levels: [],
  };
  const addedItems: Record<BalanceCategory, string[]> = {
    weapons: [],
    evolutions: [],
    fighters: [],
    arcana: [],
    levels: [],
  };
  const removedItems: Record<BalanceCategory, string[]> = {
    weapons: [],
    evolutions: [],
    fighters: [],
    arcana: [],
    levels: [],
  };

  let anyItemDiff = false;
  for (const cat of CATEGORIES) {
    const d = diffRecord(previous.items?.[cat] ?? {}, current.items?.[cat] ?? {});
    changedItems[cat] = d.changed;
    addedItems[cat] = d.added;
    removedItems[cat] = d.removed;
    if (d.changed.length + d.added.length + d.removed.length > 0) anyItemDiff = true;
  }

  const allEngTouched = [...eng.changed, ...eng.added, ...eng.removed];
  const hasChanges = allEngTouched.length > 0 || anyItemDiff;

  // Infer invalidation scope automatically
  const globalEngineTouched = allEngTouched.some(
    f => f === VIRTUAL_GLOBAL_CONSTANTS_KEY || (FILE_SCOPE_MAP.get(f) ?? 'global') === 'global'
  );
  const spireEngineTouched = allEngTouched.some(f => FILE_SCOPE_MAP.get(f) === 'spire');
  const adventureEngineTouched = allEngTouched.some(f => FILE_SCOPE_MAP.get(f) === 'adventure');

  const invalidated: BalanceEraInvalidation = {};
  let inferredScope: BalanceEraScope = 'item';

  const touchedCats: BalanceCategory[] = [];
  const fullCategoryCats: BalanceCategory[] = [];
  for (const cat of CATEGORIES) {
    const ids = Array.from(new Set([...changedItems[cat], ...addedItems[cat], ...removedItems[cat]])).sort();
    if (ids.length === 0) continue;
    touchedCats.push(cat);
    const totalInCat = Math.max(1, Object.keys(current.items[cat]).length);
    // If >= 50% of a category changed (e.g., full level HP retune), promote to category-wide invalidation
    if (ids.length / totalInCat >= 0.5) {
      fullCategoryCats.push(cat);
    } else {
      invalidated[cat] = ids;
    }
  }

  if (globalEngineTouched) {
    inferredScope = 'global';
    invalidated.global = true;
    invalidated.modes = ['adventure', 'spire'];
    invalidated.categories = ['weapons', 'evolutions', 'fighters', 'arcana', 'levels'];
  } else {
    const modes: FightModeFilter[] = [];
    if (spireEngineTouched) modes.push('spire');
    if (adventureEngineTouched) modes.push('adventure');
    if (modes.length > 0) {
      invalidated.modes = modes;
      inferredScope = 'mode';
    }
    if (fullCategoryCats.length > 0) {
      invalidated.categories = fullCategoryCats;
      if (inferredScope === 'item') inferredScope = 'category';
    }
    if (
      inferredScope === 'item' &&
      touchedCats.length === 1 &&
      touchedCats[0] === 'levels' &&
      (invalidated.levels?.length ?? 0) === 0
    ) {
      inferredScope = 'category';
    }
  }

  return {
    hasChanges,
    changedEngineFiles: eng.changed,
    addedEngineFiles: eng.added,
    removedEngineFiles: eng.removed,
    changedItems,
    addedItems,
    removedItems,
    inferredScope,
    inferredInvalidation: invalidated,
  };
};
