/**
 * Looks up any weapon the adventure can hand out (Free Play weapons and the
 * adventure-only ones) at its Workshop upgrade tier.
 */
import type { Weapon } from '@/types';
import { WEAPONS } from '@/utils/gameDefinitions';
import type { AdventureWeapon } from '../types';
import type { Effect, Modifiers, Rule, RuleSource } from '../rules/types';
import { ADVENTURE_WEAPONS } from './adventureWeapons';
import { applyWeaponUpgradeTier } from './upgrades';

/**
 * How one Workshop tier strengthens a rule weapon. Each tier adds these to the
 * matching numbers in its rules and modifiers (War Drum: +2 power → +3/+4/+5).
 * Everything not listed (counts, every-Nth, multipliers) stays as authored.
 */
export const RULE_TIER_SCALING = {
  /** `empowerBoard.amount` */
  empower: 1,
  /** `damage.amount` */
  damage: 2,
  /** `armorCard.bounty` */
  bounty: 3,
  /** `chance` conditions, in percentage points (capped at 100) */
  chancePct: 5,
  /** `coins.amount` */
  coins: 1,
  /** `time.seconds` */
  seconds: 1,
  /** `simplify.ms`, `freeze.ms`, `extendEvolutions.ms` */
  ms: 1000,
  /** `modifiers.evolutionLikelihood` */
  evolutionLikelihood: 2,
  /** `modifiers.rainbowEvolutionLikelihood` */
  rainbowEvolutionLikelihood: 5,
} as const;

const scaleEffect = (e: Effect, t: number): Effect => {
  const k = RULE_TIER_SCALING;
  switch (e.do) {
    case 'empowerBoard': return { ...e, amount: e.amount + k.empower * t };
    case 'damage': return { ...e, amount: e.amount + k.damage * t };
    case 'armorCard': return { ...e, bounty: e.bounty + k.bounty * t };
    case 'coins': return { ...e, amount: e.amount + k.coins * t };
    case 'time': return { ...e, seconds: e.seconds + k.seconds * t };
    case 'simplify':
    case 'freeze':
    case 'extendEvolutions': return { ...e, ms: e.ms + k.ms * t };
    default: return e;
  }
};

const scaleRule = (r: Rule, t: number): Rule => ({
  ...r,
  when: r.when?.map(c => (c.kind === 'chance' ? { ...c, pct: Math.min(100, c.pct + RULE_TIER_SCALING.chancePct * t) } : c)),
  effects: r.effects.map(e => scaleEffect(e, t)),
});

const scaleModifiers = (m: Modifiers, t: number): Modifiers => ({
  ...m,
  ...(m.evolutionLikelihood !== undefined ? { evolutionLikelihood: m.evolutionLikelihood + RULE_TIER_SCALING.evolutionLikelihood * t } : {}),
  ...(m.rainbowEvolutionLikelihood !== undefined
    ? { rainbowEvolutionLikelihood: m.rainbowEvolutionLikelihood + RULE_TIER_SCALING.rainbowEvolutionLikelihood * t }
    : {}),
});

/** A rule source at Workshop tier `tier` (0 = as authored). */
export const scaleRuleSource = <T extends RuleSource>(source: T, tier: number): T =>
  tier <= 0
    ? source
    : {
        ...source,
        ...(source.rules ? { rules: source.rules.map(r => scaleRule(r, tier)) } : {}),
        ...(source.modifiers ? { modifiers: scaleModifiers(source.modifiers, tier) } : {}),
      };

const hasStatEffects = (w: Weapon) => Object.values(w.effects).some(v => typeof v === 'number' && v > 0);

const upgradeAdventureWeapon = (w: AdventureWeapon, tier: number): AdventureWeapon => {
  const withStats: AdventureWeapon = hasStatEffects(w) ? { ...w, ...applyWeaponUpgradeTier(w, tier) } : w;
  const scaled = scaleRuleSource({ ...withStats, shortDescription: w.shortDescription }, tier);
  const bonus = w.upgradeText?.(tier);
  return bonus ? { ...scaled, shortDescription: `${w.shortDescription} (${bonus})` } : scaled;
};

export const findAdventureWeapon = (id: string): AdventureWeapon | undefined => ADVENTURE_WEAPONS.find(w => w.id === id);

export const getArmoryWeapon = (id: string, weaponUpgrades?: Record<string, number>): Weapon | undefined => {
  const tier = weaponUpgrades?.[id] ?? 0;
  const adventure = findAdventureWeapon(id);
  if (adventure) return tier > 0 ? upgradeAdventureWeapon(adventure, tier) : adventure;
  const base = WEAPONS.find(w => w.id === id);
  if (!base) return undefined;
  return tier > 0 ? applyWeaponUpgradeTier(base, tier) : base;
};

/** The rules a held weapon brings into a fight (plain Free Play weapons bring none). */
export const weaponRuleSource = (w: Weapon): RuleSource => {
  const a = w as AdventureWeapon;
  return { rules: a.rules, modifiers: a.modifiers };
};
