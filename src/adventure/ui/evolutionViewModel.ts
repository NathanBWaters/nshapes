/**
 * Pure UI view-model selectors for Per-Weapon Timed Evolutions, Synergy Graph
 * tags/hooks, live in-fight evolution trackers, and 3->4->5 (+6th) belt slots.
 *
 * Decouples UI screens (`WeaponExplainer`, `Camp`, `LevelPreview`, `FieldGuide`,
 * `GearBelt`, `AdventureRun`, Spire modals) from internal rule/data shapes.
 */
import type { IconName } from '@/components/Icon';
import type {
  AdventureSave,
  SynergyAttrId,
  SynergyRole,
  WeaponEvolutionDef,
  WeaponEvolutionPhase,
  WeaponEvolutionRuntime,
} from '../types';
import { getWeaponSynergyHooks, getWeaponSynergyProfile } from '../data/synergy';
import {
  evolutionConditionShort,
  evolutionConditionText,
  evolutionShortVerb,
  evolutionsForWeapon,
  getWeaponEvolution,
  resolvedEquippedEvolution,
} from '../data/evolutions';
import { bountyForEvolution } from '../data/bounties';
import { SLOT_4_UNLOCK_LEVEL_ID, SLOT_5_UNLOCK_LEVEL_ID, getWeaponSlotMilestone } from '../data/features';
import { unlockHint, weaponSlotMilestoneHint } from '../data/rewards';
import { charmSlotsOf } from '../loadout';
import { EVOLUTION_CHASSIS } from '../engine/sources';
import { SYNERGY_ATTR_META, SYNERGY_ROLE_META } from './synergyMeta';

export interface SynergyTagVM {
  id: SynergyAttrId;
  label: string;
  icon: IconName;
  color: string;
  paleBg: string;
  role: SynergyRole;
  glyph: '▲' | '◆' | '★';
  roleLabel: string;
  hookText: string;
  beltMatch: boolean;
}

export interface SynergyHookLineVM {
  id: string;
  attr: SynergyAttrId;
  label: string;
  icon: IconName;
  color: string;
  paleBg: string;
  role: SynergyRole;
  glyph: '▲' | '◆' | '★';
  roleLabel: string;
  summary: string;
  beltMatch: boolean;
}

export type EvolutionSlotLabel = 'CORE' | 'BRIDGE' | 'APEX';

const SLOT_LABELS: readonly [EvolutionSlotLabel, EvolutionSlotLabel, EvolutionSlotLabel] = [
  'CORE',
  'BRIDGE',
  'APEX',
];

export interface WeaponEvolutionVM {
  id: string;
  weaponId: string;
  slotIndex: 0 | 1 | 2;
  slotLabel: EvolutionSlotLabel;
  name: string;
  icon: IconName;
  accent: string;
  conditionShort: string;
  conditionFull: string;
  durationSec: number;
  effectText: string;
  shortVerb: string;
  synergyTags: readonly SynergyAttrId[];
  unlockBountyId?: string;
  unlockBountyTitle?: string;
  unlockHintText: string | null;
}

export interface WeaponEvolutionSummaryVM {
  weaponId: string;
  options: WeaponEvolutionVM[];
  equippedId: string | null;
  equipped: WeaponEvolutionVM | null;
  unlockedIds: readonly string[];
  unlockedSet: ReadonlySet<string>;
  unlockedCount: number;
  discoveredSet: ReadonlySet<string>;
}

export interface EvolutionLiveStateVM {
  weaponId: string;
  evolutionId: string;
  evolutionName: string;
  icon: IconName;
  accent: string;
  phase: WeaponEvolutionPhase;
  conditionShort: string;
  conditionFull: string;
  effectText: string;
  progress: number;
  target: number;
  almostReady: boolean;
  activeRemainingMs: number;
  activeDurationMs: number;
  cooldownRemainingMs: number;
  triggersThisFight: number;
}

export type HintSaveContext = Pick<AdventureSave, 'stars'> &
  Partial<Pick<AdventureSave, 'claimedMapKeys' | 'unlockedFighters' | 'armory'>>;

/**
 * Build the 1–3 concise, deduplicated Synergy tag pills shown on `WeaponExplainer`.
 * Producers come first, then Amplifiers, then Consumers, matching the weapon's hooks.
 */
export const buildWeaponSynergyTags = (
  weaponId: string,
  level = 1,
  beltSynergyIds?: ReadonlySet<SynergyAttrId>
): SynergyTagVM[] => {
  const profile = getWeaponSynergyProfile(weaponId);
  const hooks = getWeaponSynergyHooks(weaponId);
  const hookByAttr = new Map<SynergyAttrId, string>();
  for (const h of hooks) {
    if (!hookByAttr.has(h.attr)) hookByAttr.set(h.attr, h.summary(level));
  }

  const ordered: { attr: SynergyAttrId; role: SynergyRole }[] = [];
  const seen = new Set<SynergyAttrId>();
  const push = (attr: SynergyAttrId, role: SynergyRole) => {
    if (seen.has(attr)) return;
    seen.add(attr);
    ordered.push({ attr, role });
  };

  for (const a of profile.produces) push(a, 'producer');
  for (const a of profile.amplifies ?? []) push(a, 'amplifier');
  for (const a of profile.consumes) push(a, 'consumer');
  for (const h of hooks) push(h.attr, h.role);

  return ordered.slice(0, 3).map(({ attr, role }) => {
    const meta = SYNERGY_ATTR_META[attr];
    const roleMeta = SYNERGY_ROLE_META[role];
    return {
      id: attr,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      paleBg: meta.paleBg,
      role,
      glyph: roleMeta.glyph,
      roleLabel: roleMeta.label,
      hookText: hookByAttr.get(attr) ?? meta.description,
      beltMatch: Boolean(beltSynergyIds?.has(attr)),
    };
  });
};

/** Detailed 1–3 Synergy scaling hook lines shown inside expanded `WeaponExplainer`. */
export const buildWeaponSynergyHookLines = (
  weaponId: string,
  level = 1,
  beltSynergyIds?: ReadonlySet<SynergyAttrId>
): SynergyHookLineVM[] => {
  const hooks = getWeaponSynergyHooks(weaponId);
  return hooks.map(h => {
    const meta = SYNERGY_ATTR_META[h.attr];
    const roleMeta = SYNERGY_ROLE_META[h.role];
    return {
      id: h.id,
      attr: h.attr,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      paleBg: meta.paleBg,
      role: h.role,
      glyph: roleMeta.glyph,
      roleLabel: roleMeta.label,
      summary: h.summary(level),
      beltMatch: Boolean(beltSynergyIds?.has(h.attr)),
    };
  });
};

/** Map a single `WeaponEvolutionDef` into its UI view model (CVD-safe condition copy + bounty pointer). */
export const buildWeaponEvolutionVM = (
  def: WeaponEvolutionDef,
  opts?: {
    colorblind?: boolean;
    save?: HintSaveContext;
    labTier?: number;
  }
): WeaponEvolutionVM => {
  const colorblind = Boolean(opts?.colorblind);
  const labBonusMs = Math.max(0, opts?.labTier ?? 0) * EVOLUTION_CHASSIS.labDurationMsPerTier;
  const bounty = bountyForEvolution(def.id);
  const hint = unlockHint({ kind: 'evolution', id: def.id }, opts?.save);
  return {
    id: def.id,
    weaponId: def.weaponId,
    slotIndex: def.slotIndex,
    slotLabel: SLOT_LABELS[def.slotIndex] ?? 'CORE',
    name: def.name,
    icon: def.icon,
    accent: def.accent,
    conditionShort: evolutionConditionShort(def, colorblind),
    conditionFull: evolutionConditionText(def, colorblind),
    durationSec: Math.round((def.durationMs + labBonusMs) / 1000),
    effectText: def.tagline,
    shortVerb: evolutionShortVerb(def),
    synergyTags: def.synergyTags,
    unlockBountyId: bounty?.id,
    unlockBountyTitle: bounty?.name,
    unlockHintText: hint,
  };
};

/** Build the complete 1-of-3 evolution summary for one Armory weapon. */
export const buildWeaponEvolutionsForWeapon = (
  weaponId: string,
  opts?: {
    equippedEvolutionId?: string | null;
    unlockedEvolutionIds?: readonly string[];
    discoveredEvolutionIds?: readonly string[];
    allUnlocked?: boolean;
    colorblind?: boolean;
    save?: HintSaveContext;
    labTier?: number;
  }
): WeaponEvolutionSummaryVM => {
  const defs = evolutionsForWeapon(weaponId);
  const options = defs.map(d =>
    buildWeaponEvolutionVM(d, {
      colorblind: opts?.colorblind,
      save: opts?.save,
      labTier: opts?.labTier,
    })
  );

  const unlockedIds = opts?.allUnlocked
    ? defs.map(d => d.id)
    : (opts?.unlockedEvolutionIds ?? []).filter(id => defs.some(d => d.id === id));
  const unlockedSet = new Set(unlockedIds);
  const discoveredSet = new Set(opts?.discoveredEvolutionIds ?? []);

  const equippedMap = opts?.equippedEvolutionId
    ? { [weaponId]: opts.equippedEvolutionId }
    : undefined;
  const resolved = resolvedEquippedEvolution(
    weaponId,
    equippedMap,
    opts?.allUnlocked ? undefined : unlockedIds
  );
  const equipped = resolved ? options.find(o => o.id === resolved.id) ?? null : null;

  return {
    weaponId,
    options,
    equippedId: equipped?.id ?? null,
    equipped,
    unlockedIds,
    unlockedSet,
    unlockedCount: unlockedSet.size,
    discoveredSet,
  };
};

/** Map one live `WeaponEvolutionRuntime` from `RunState.weaponEvolutions` to HUD view-model state. */
export const buildEvolutionLiveState = (
  runtime: WeaponEvolutionRuntime,
  opts?: { colorblind?: boolean }
): EvolutionLiveStateVM | null => {
  const def = getWeaponEvolution(runtime.evoId);
  if (!def) return null;
  const colorblind = Boolean(opts?.colorblind);
  return {
    weaponId: runtime.weaponId,
    evolutionId: runtime.evoId,
    evolutionName: def.name,
    icon: def.icon,
    accent: def.accent,
    phase: runtime.phase,
    conditionShort: evolutionConditionShort(def, colorblind),
    conditionFull: evolutionConditionText(def, colorblind),
    effectText: def.tagline,
    progress: runtime.progress,
    target: Math.max(1, runtime.target),
    almostReady: runtime.almostReady,
    activeRemainingMs: Math.max(0, runtime.activeRemainingMs),
    activeDurationMs: Math.max(1, runtime.durationMs),
    cooldownRemainingMs: Math.max(0, runtime.cooldownRemainingMs),
    triggersThisFight: runtime.triggersCount,
  };
};

/** Map every live `WeaponEvolutionRuntime` on a fight into HUD view models. */
export const buildAllLiveEvolutions = (
  runtimes: readonly WeaponEvolutionRuntime[],
  opts?: { colorblind?: boolean }
): EvolutionLiveStateVM[] =>
  runtimes
    .map(r => buildEvolutionLiveState(r, opts))
    .filter((v): v is EvolutionLiveStateVM => Boolean(v));

export interface BeltSlotDescriptor {
  /** 0-based slot position in the visible belt strip */
  index: number;
  /** 1-based slot number (1..6) */
  slotNumber: 1 | 2 | 3 | 4 | 5 | 6;
  unlocked: boolean;
  /** Present only for locked ghost slots dangling next milestones */
  lockKind?: 'w1' | 'w2' | 'shop';
  badgeLabel?: 'W1' | 'W2' | 'SHOP';
  tooltip?: string;
}

/**
 * Describe all visible Weapon Belt slots (3 base -> 4th on W1 Boss `1-10` ->
 * 5th on W2 Boss `2-10` -> optional 6th via 1-tier Workshop `charm_belt`).
 *
 * Always shows 5 slots minimum (dangling W1 & W2 milestones per Sakurai Ep. #073),
 * and reveals the optional 6th `SHOP` ghost slot once W2 Boss (`2-10`) is cleared
 * (or already owned).
 */
export const buildBeltSlotDescriptors = (
  save: Pick<AdventureSave, 'stars' | 'upgrades' | 'workshopUnlocked'>
): BeltSlotDescriptor[] => {
  const unlockedCount = charmSlotsOf(save);
  const w1Cleared = (save.stars[SLOT_4_UNLOCK_LEVEL_ID] ?? 0) >= 1;
  const w2Cleared = (save.stars[SLOT_5_UNLOCK_LEVEL_ID] ?? 0) >= 1;
  const shopOwned = (save.upgrades?.charm_belt ?? 0) >= 1;

  const list: BeltSlotDescriptor[] = [];
  for (let i = 0; i < unlockedCount; i++) {
    list.push({
      index: i,
      slotNumber: (i + 1) as BeltSlotDescriptor['slotNumber'],
      unlocked: true,
    });
  }

  const lockedGhosts: {
    slotNumber: 4 | 5 | 6;
    lockKind: 'w1' | 'w2' | 'shop';
    badgeLabel: 'W1' | 'W2' | 'SHOP';
    tooltip: string;
  }[] = [];

  if (!w1Cleared) {
    const m = getWeaponSlotMilestone(4);
    lockedGhosts.push({
      slotNumber: 4,
      lockKind: 'w1',
      badgeLabel: m.badgeLabel,
      tooltip: m.tooltip,
    });
  }
  if (!w2Cleared) {
    const m = getWeaponSlotMilestone(5);
    lockedGhosts.push({
      slotNumber: 5,
      lockKind: 'w2',
      badgeLabel: m.badgeLabel,
      tooltip: m.tooltip,
    });
  }
  if (!shopOwned && (w2Cleared || (save.workshopUnlocked && unlockedCount >= 5))) {
    lockedGhosts.push({
      slotNumber: 6,
      lockKind: 'shop',
      badgeLabel: 'SHOP',
      tooltip: weaponSlotMilestoneHint(6),
    });
  }

  for (const ghost of lockedGhosts) {
    if (list.length >= 6) break;
    list.push({
      index: list.length,
      slotNumber: ghost.slotNumber,
      unlocked: false,
      lockKind: ghost.lockKind,
      badgeLabel: ghost.badgeLabel,
      tooltip: ghost.tooltip,
    });
  }

  return list;
};
