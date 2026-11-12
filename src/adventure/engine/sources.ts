/**
 * Where a fight's rules come from (skill nodes, held weapons, active
 * evolutions) and how their standing modifiers add up. Pure: shared by the
 * engine and by the pre-fight loadout preview.
 */
import type { Weapon } from '@/types';
import type { EvolutionRecipe } from '../types';
import type { Modifiers, Rule, RuleSource, WeaponTriggerKind } from '../rules/types';
import { getSkillNode } from '../data/skillTrees';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { weaponRuleSource } from '../data/armory';

export const EVOLUTION_RULES = {
  /** % chance per refill batch while a recipe is armed */
  baseLikelihood: 12,
  /** Workshop "Evolution Lab": % per tier */
  labPerTier: 4,
  durationMs: 20000,
  perFight: 3,
  /** Every active evolution adds this to every Set */
  setDamage: 1,
} as const;

export { getSkillNode };

export const getRecipe = (id: string): EvolutionRecipe | undefined => EVOLUTION_RECIPES.find(r => r.id === id);

/** A weapon id belongs to a family when it is listed in it (or is an old copy id of one, `x-rare`). */
const inFamily = (weaponId: string, family: string[]) => family.some(p => weaponId === p || weaponId.startsWith(`${p}-`));

/** Unlocked recipes whose two families are both held, in recipe order. */
export const armedRecipesFor = (weapons: Weapon[], unlocked: readonly string[]): string[] =>
  EVOLUTION_RECIPES.filter(
    r => unlocked.includes(r.id) && r.families.every(fam => weapons.some(w => inFamily(w.id, fam)))
  ).map(r => r.id);

export interface KeyedRule {
  /** Stable for the whole fight: `node:<id>#i`, `w<slot>:<weaponId>#i`, `evo:<id>#i` */
  key: string;
  rule: Rule;
}

export interface SourceInputs {
  skillNodes: readonly string[];
  weapons: readonly Weapon[];
  activeEvolutions: readonly { id: string }[];
}

/** Every live rule source with a stable key prefix. */
export const liveSources = (s: SourceInputs): { key: string; source: RuleSource }[] => {
  const out: { key: string; source: RuleSource }[] = [];
  for (const id of s.skillNodes) {
    const n = getSkillNode(id);
    if (n) out.push({ key: `node:${id}`, source: n });
  }
  s.weapons.forEach((w, i) => {
    const src = weaponRuleSource(w);
    if (src.rules?.length || src.modifiers) out.push({ key: `w${i}:${w.id}`, source: src });
  });
  for (const e of s.activeEvolutions) {
    const r = getRecipe(e.id);
    if (r) out.push({ key: `evo:${e.id}`, source: r.source });
  }
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

/** Percent chance that a refill brings a Catalyst (before the Rainbow bonus). */
export const evolutionLikelihoodFor = (labTier: number, mods: Modifiers, catalystChanceScale = 1): number =>
  Math.max(0, (EVOLUTION_RULES.baseLikelihood + EVOLUTION_RULES.labPerTier * labTier + (mods.evolutionLikelihood ?? 0)) * catalystChanceScale);
