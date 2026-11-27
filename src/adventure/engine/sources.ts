/**
 * Where a fight's rules come from (skill nodes, held weapons + their Synergy
 * Graph cross-edges, active per-weapon timed evolutions, weapon growth) and
 * how their standing modifiers add up. Pure: shared by the engine and by
 * pre-fight loadout previews.
 */
import type { Weapon } from '@/types';
import type { SynergyCounters, WeaponEvolutionRuntime } from '../types';
import type { Modifiers, Rule, RuleSource, WeaponTriggerKind } from '../rules/types';
import type { WeaponBuilds } from '../data/weaponStats';
import { getSkillNode } from '../data/skillTrees';
import { getWeaponEvolution } from '../data/evolutions';
import { weaponRuleSource } from '../data/armory';
import { UNDERSTUDY_ID } from '../data/adventureWeapons';
import {
  evaluateWeaponSynergyModifiers,
  weaponSynergyRules,
  type SynergyEvalContext,
} from '../data/synergy';

/** Universal Evolved-Weapon Chassis constants (spec-combat-synergy.md §6.3). */
export const EVOLUTION_CHASSIS = {
  /** Flat base damage added to every Set per currently active evolved weapon */
  setFlatDamage: 8,
  /** Additive Set multiplier per active evolved weapon: 1 + activeCount * 0.20 */
  setAdditiveMult: 0.2,
  /** Instant base damage burst dealt when any weapon evolution ignites */
  ignitionBurstDamage: 18,
  /** Default recharge cooldown (ms) after an evolution expires before charging resumes */
  defaultCooldownMs: 3000,
  /** Extra active duration (ms) per Workshop Evolution Lab tier */
  labDurationMsPerTier: 2000,
} as const;

export { getSkillNode, getWeaponEvolution };

/** Currently active per-weapon timed evolution trackers. */
export const activeWeaponEvolutions = (
  evos: readonly WeaponEvolutionRuntime[]
): WeaponEvolutionRuntime[] => evos.filter(e => e.phase === 'active');

/**
 * Effective weapon ID for scaling/Synergy lookups at belt slot `index`.
 * Understudy copies its immediate left neighbor (when present and not another Understudy).
 */
export const effectiveWeaponIdAt = (weapons: readonly Weapon[], index: number): string => {
  const w = weapons[index];
  if (!w) return '';
  if (w.id === UNDERSTUDY_ID && index > 0) {
    const left = weapons[index - 1];
    if (left && left.id !== UNDERSTUDY_ID) return left.id;
  }
  return w.id;
};

/** Effective weapon level for Synergy hook scaling at belt slot `index`. */
export const effectiveWeaponLevelAt = (
  weapons: readonly Weapon[],
  index: number,
  builds?: WeaponBuilds
): number => {
  const w = weapons[index];
  if (!w) return 1;
  const ownLv = builds?.[w.id]?.level ?? w.level ?? 1;
  if (w.id === UNDERSTUDY_ID && index > 0) {
    const left = weapons[index - 1];
    if (left && left.id !== UNDERSTUDY_ID) {
      const leftLv = builds?.[left.id]?.level ?? left.level ?? 1;
      return Math.max(ownLv, leftLv);
    }
  }
  return ownLv;
};

export interface KeyedRule {
  /** Stable for the whole fight: `node:<id>#i`, `w<slot>:<weaponId>#i`, `evo:<evoId>#i` */
  key: string;
  rule: Rule;
}

export interface SourceInputs {
  skillNodes: readonly string[];
  weapons: readonly Weapon[];
  /** Per-weapon timed evolution trackers (only `phase === 'active'` entries contribute live sources) */
  weaponEvolutions: readonly WeaponEvolutionRuntime[];
  /** Optional weapon build levels for Synergy `modPerStep` scaling */
  weaponBuilds?: WeaponBuilds;
  /** Optional live 15-node Synergy Graph counters for `modPerStep` modifiers */
  synergy?: SynergyCounters;
  /** Optional live hearts/clock/links context for special Synergy hooks */
  synergyCtx?: SynergyEvalContext;
  /** Standing modifiers from weapon growth this fight (data/weaponGrowth.ts) */
  growth?: Modifiers;
  /** Lab-only override: omit each active Evolution's bespoke rules/modifiers (keeps universal chassis) */
  blankEvolutionRules?: boolean;
}

/** Every live rule source with a stable key prefix. */
export const liveSources = (s: SourceInputs): { key: string; source: RuleSource }[] => {
  const out: { key: string; source: RuleSource }[] = [];
  for (const id of s.skillNodes) {
    const n = getSkillNode(id);
    if (n) out.push({ key: `node:${id}`, source: n });
  }
  s.weapons.forEach((w, i) => {
    const baseSrc = weaponRuleSource(w);
    const effId = effectiveWeaponIdAt(s.weapons, i);
    const effLv = effectiveWeaponLevelAt(s.weapons, i, s.weaponBuilds);
    const synRules: Rule[] =
      w.id === UNDERSTUDY_ID && effId !== UNDERSTUDY_ID
        ? [...weaponSynergyRules(UNDERSTUDY_ID), ...weaponSynergyRules(effId)]
        : weaponSynergyRules(w.id);
    const synMods = s.synergy
      ? evaluateWeaponSynergyModifiers(effId, effLv, s.synergy, s.synergyCtx)
      : undefined;
    const hasSynMods = synMods && Object.keys(synMods).length > 0;
    const rules = synRules.length > 0 ? [...(baseSrc.rules ?? []), ...synRules] : baseSrc.rules;
    const modifiers = hasSynMods ? combineModifiers([baseSrc.modifiers, synMods]) : baseSrc.modifiers;
    if (rules?.length || (modifiers && Object.keys(modifiers).length > 0)) {
      out.push({
        key: `w${i}:${w.id}`,
        source: {
          ...(rules?.length ? { rules } : {}),
          ...(modifiers && Object.keys(modifiers).length > 0 ? { modifiers } : {}),
        },
      });
    }
  });
  if (!s.blankEvolutionRules) {
    for (const e of s.weaponEvolutions) {
      if (e.phase !== 'active') continue;
      const def = getWeaponEvolution(e.evoId);
      if (def) out.push({ key: `evo:${e.evoId}`, source: def.source });
    }
  }
  if (s.growth && Object.keys(s.growth).length > 0) out.push({ key: 'growth', source: { modifiers: s.growth } });
  return out;
};

export const liveRules = (s: SourceInputs): KeyedRule[] =>
  liveSources(s).flatMap(({ key, source }) => (source.rules ?? []).map((rule, i) => ({ key: `${key}#${i}`, rule })));

/** Values add up, `*Scale` values multiply, lists concatenate, flags OR. */
export const combineModifiers = (list: (Modifiers | undefined)[]): Modifiers => {
  const out: Modifiers = {};
  const num = out as Record<string, unknown>;
  for (const m of list) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      if (v === undefined) continue;
      if (typeof v === 'number') {
        num[k] = ((num[k] as number | undefined) ?? 0) + v;
      } else if (typeof v === 'boolean') {
        num[k] = Boolean(num[k]) || v;
      } else if (k === 'conditionalDamage') {
        out.conditionalDamage = [...(out.conditionalDamage ?? []), ...(v as NonNullable<Modifiers['conditionalDamage']>)];
      } else if (k === 'conditionalMultiplier') {
        out.conditionalMultiplier = [
          ...(out.conditionalMultiplier ?? []),
          ...(v as NonNullable<Modifiers['conditionalMultiplier']>),
        ];
      } else if (k === 'weaponChanceScale') {
        const scale = { ...(out.weaponChanceScale ?? {}) };
        for (const [kind, f] of Object.entries(v as Record<WeaponTriggerKind, number>)) {
          scale[kind as WeaponTriggerKind] = (scale[kind as WeaponTriggerKind] ?? 1) * f;
        }
        out.weaponChanceScale = scale;
      } else if (k === 'passiveTuning') {
        const t = { ...(out.passiveTuning ?? {}) };
        for (const [key, d] of Object.entries(v as Record<string, number>)) t[key] = (t[key] ?? 0) + d;
        out.passiveTuning = t;
      }
    }
  }
  return out;
};

export const modifiersOf = (s: SourceInputs): Modifiers => combineModifiers(liveSources(s).map(x => x.source.modifiers));
