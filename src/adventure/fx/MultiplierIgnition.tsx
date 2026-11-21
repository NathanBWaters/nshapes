/**
 * Live Balatro-Style Score Equation Bar (`MultiplierIgnition`).
 *
 * Docked permanently in the HUD (never covering the card board, zero reflow):
 *   [ NEXT / LIVE / LAST ]  [ BASE  19.3 ]  ×  [ MULT  2× ]  =  [  39  ]  ?
 *   Cards 9 · +2.3 Blast · +3 Heavy Hitter · +5 Rally Horn · ×2 Rainbow
 *
 * - Before the first Set: displays your live primed NEXT SET equation so anyone
 *   joining a Twitch stream understands the build's engine immediately.
 * - When a Set lands: steps through every itemized Base contributor, Multiplier,
 *   Power boost, and Turn Follow-up using `src/utils/motion.ts` tokens (`MS`,
 *   `EASE`, `SPRING`, `STAGGER`, `cascadeDelay`, `SCALE`) with zero layout shift.
 * - After settling: stays cleanly readable as the persistent Last Set receipt
 *   until the next Set. Tapping anywhere opens the full itemized breakdown in
 *   `HudInspector` while pausing the clock.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { band } from '@/audio';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { cascadeDelay, EASE, MS, SCALE, SPRING, STAGGER } from '@/utils/motion';
import { arcanaRules, getArcana } from '../data/arcana';
import { PARRY_RULES } from '../data/parry';
import { SURGE_RULES } from '../data/rules';
import { growthModifiers } from '../data/weaponGrowth';
import { damageMultiplier } from '../data/weaponPower';
import { EVOLUTION_RULES, getRecipe, getSkillNode, liveRules, liveSources } from '../engine/sources';
import { PASSIVE_TUNING } from '../data/passives';
import type { Condition, Scale, Trigger } from '../rules/types';
import type { RunState, SetIgnition } from '../types';
import { INK } from '../components/ui';

export type HeatTier = 0 | 1 | 2 | 3;

export interface IgnitionStep {
  key: string;
  label: string;
  value: string;
  color: string;
  bg: string;
  kind: 'base' | 'mult' | 'extra';
}

export interface IgnitionPlan {
  steps: IgnitionStep[];
  total: number;
  heatTier: HeatTier;
  show: boolean;
}

export interface TallyStep {
  key: string;
  /** Short readable source name ("Cards", "Heavy Hitter", "Rainbow", "Rally Horn") */
  label: string;
  /** Formatted delta ("9", "+3", "×2", "+11") */
  value: string;
  kind: 'base' | 'mult' | 'bonus';
  /** Running equation numbers right after this step fires */
  baseAfter: number;
  multAfter: number;
  bonusAfter: number;
  note?: string;
}

export interface BalatroBreakdown {
  steps: TallyStep[];
  finalBase: number;
  finalMult: number;
  finalBonus: number;
  finalTotal: number;
  heatTier: HeatTier;
  /** Compact single-line summary pieces shown in Row 2 at rest */
  receiptLine: string;
}

export interface PrimedEquation {
  base: number;
  mult: number;
  total: number;
  items: { label: string; value: string; kind: 'base' | 'mult'; note?: string }[];
  summaryLine: string;
}

const fmt = (n: number): string => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1);
};

export const heatTierFor = (total: number): HeatTier =>
  total >= 200 ? 3 : total >= 60 ? 2 : total >= 20 ? 1 : 0;

/** Compact label helper so receipts read cleanly at 320px/375px phone widths. */
const shortLabel = (label: string): string => {
  const lower = label.toLowerCase();
  if (lower === 'rainbow strike') return 'Rainbow';
  if (lower.includes('perfect parry')) return 'Perfect Parry';
  if (lower.includes('counter parry')) return 'Parry';
  if (lower.includes('stagger')) return 'Stagger';
  if (lower.includes('active evolution')) return 'Evolved';
  if (lower.includes('hot streak')) return 'Hot Streak';
  if (lower.includes('next-set')) return 'Charged';
  if (lower.includes('surge')) return 'Surge';
  if (lower.includes('purity')) return 'Purity';
  if (lower.includes('traps')) return 'Traps';
  return label;
};

/**
 * Legacy-compatible flat step plan builder (preserved for existing unit tests & callers).
 */
export const buildIgnitionPlan = (ignition: SetIgnition): IgnitionPlan => {
  const m = ignition.math;
  const collateral = Object.values(m.collateral).reduce((s, n) => s + (n ?? 0), 0);
  const preSurgeBase = m.cards + collateral;
  const surge = m.surgeMultiplier && m.surgeMultiplier > 1 ? m.surgeMultiplier : 1;
  // Wave 1 unified Shading Surge ×5 directly inside multItems (add-first, multiply-second);
  // only emit the legacy pre-flat SURGE/GEAR split for older logs that omit Surge from multItems.
  const surgeInMult = (m.multItems ?? []).some(it => it.label.toLowerCase().includes('surge'));
  const legacyPreSurge = !surgeInMult && surge > 1 ? surge : 1;
  const baseWithFlat = Math.max(0, Math.round((preSurgeBase + m.flatBonus) * 10) / 10);
  const steps: IgnitionStep[] = [
    {
      key: 'base',
      label: m.flatBonus > 0 ? 'BASE' : 'SET',
      value: fmt(legacyPreSurge > 1 ? preSurgeBase : baseWithFlat),
      color: INK,
      bg: COLORS.canvasWhite,
      kind: 'base',
    },
  ];

  if (legacyPreSurge > 1) {
    steps.push({ key: 'surge', label: 'SURGE', value: `×${fmt(legacyPreSurge)}`, color: '#FFFFFF', bg: '#DB2777', kind: 'mult' });
    if (m.flatBonus > 0) {
      steps.push({ key: 'flat', label: 'GEAR', value: `+${fmt(m.flatBonus)}`, color: INK, bg: '#FEF3C7', kind: 'extra' });
    }
  }

  for (let i = 0; i < (m.multItems?.length ?? 0); i++) {
    const item = m.multItems![i];
    if (Math.abs(item.amount - 1) < 0.01) continue;
    const lower = item.label.toLowerCase();
    let short = item.label.toUpperCase();
    let bg = '#EA580C';
    let color = '#FFFFFF';
    if (lower.includes('surge')) { short = 'SURGE'; bg = '#DB2777'; }
    else if (lower.includes('rainbow')) { short = 'RAINBOW'; bg = '#D97706'; }
    else if (lower.includes('perfect parry')) { short = 'PERFECT PARRY'; bg = COLORS.actionYellow; color = INK; }
    else if (lower.includes('parry')) { short = 'PARRY'; bg = '#0F766E'; }
    else if (lower.includes('stagger')) { short = 'STAGGER'; bg = '#0D9488'; }
    else if (lower.includes('evolution')) { short = 'EVOLVED'; bg = '#C2410C'; }
    else if (lower.includes('hot streak')) { short = 'STREAK'; bg = '#EA580C'; }
    else if (lower.length > 12) short = item.label.slice(0, 10).toUpperCase();
    steps.push({ key: `m-${i}`, label: short, value: `×${fmt(item.amount)}`, color, bg, kind: 'mult' });
  }

  if (m.extra > 0) {
    steps.push({ key: 'extra', label: 'BONUS', value: `+${fmt(m.extra)}`, color: '#FFFFFF', bg: '#0D9488', kind: 'extra' });
  }

  if (m.powerMultiplier && m.powerMultiplier > 1.04) {
    steps.push({ key: 'power', label: 'POWER', value: `×${fmt(m.powerMultiplier)}`, color: '#FFFFFF', bg: '#DC2626', kind: 'mult' });
  }

  const total = Math.round(ignition.turnDamage ?? m.hit);
  const heatTier = heatTierFor(total);
  const show = steps.length >= 2 || total >= 10;
  return { steps: steps.slice(0, 6), total, heatTier, show };
};

/**
 * Pure Balatro tally builder: turns an engine `SetIgnition` into exact running
 * `BASE × MULT (+ BONUS) = TOTAL` steps so every single point is accounted for.
 */
export const buildBalatroBreakdown = (ignition: SetIgnition): BalatroBreakdown => {
  const m = ignition.math;
  const surge = m.surgeMultiplier && m.surgeMultiplier > 1 ? m.surgeMultiplier : 1;
  // Unified logs put Shading Surge ×5 directly in multItems (applied after all additions);
  // legacy saved logs applied surgeMultiplier only to cards + collateral before flatBonus.
  const surgeInMult = (m.multItems ?? []).some(it => it.label.toLowerCase().includes('surge'));
  const legacyPreSurge = !surgeInMult && surge > 1 ? surge : 1;
  const power = m.powerMultiplier && m.powerMultiplier > 1.01 ? m.powerMultiplier : 1;

  const steps: TallyStep[] = [];
  let base = m.cards * legacyPreSurge;
  let mult = 1;
  let bonus = 0;

  // 1. Opening Set Cards (including Power/Charged card points, or legacy pre-flat Surge)
  const cardLabel = legacyPreSurge > 1
    ? `Cards ${fmt(m.cards)} ×${fmt(legacyPreSurge)} Surge`
    : (m.cardBonus ?? 0) > 0
      ? `Cards ${m.baseCards ?? 3} (+${fmt(m.cardBonus!)})`
      : `${m.cardCount ?? 3} Cards`;
  steps.push({
    key: 'cards',
    label: cardLabel,
    value: fmt(base),
    kind: 'base',
    baseAfter: base,
    multAfter: mult,
    bonusAfter: bonus,
    note: m.cardBonusNote ?? `${m.cardCount ?? 3} matched cards`,
  });

  // 2. Collateral cards destroyed with the Set (Blast / Laser / Ricochet / Link)
  const collLabels: [keyof typeof m.collateral, string][] = [
    ['explosion', 'Blast'],
    ['laser', 'Laser'],
    ['ricochet', 'Ricochet'],
    ['connected', 'Link'],
  ];
  for (const [key, label] of collLabels) {
    const raw = m.collateral[key] ?? 0;
    if (raw <= 0) continue;
    const add = raw * legacyPreSurge;
    base += add;
    steps.push({
      key: `col-${key}`,
      label,
      value: `+${fmt(add)}`,
      kind: 'base',
      baseAfter: base,
      multAfter: mult,
      bonusAfter: bonus,
      note: 'collateral cards',
    });
  }

  // 3. Every itemized flat contributor (Piñata, Purity, Traps, Heavy Hitter, Weapons, Passives, Active Evolution, Growth)
  if (m.flatItems && m.flatItems.length > 0) {
    for (let i = 0; i < m.flatItems.length; i++) {
      const item = m.flatItems[i];
      if (item.amount === 0) continue;
      base = Math.max(0, base + item.amount);
      steps.push({
        key: `flat-${i}`,
        label: shortLabel(item.label),
        value: `${item.amount > 0 ? '+' : ''}${fmt(item.amount)}`,
        kind: 'base',
        baseAfter: base,
        multAfter: mult,
        bonusAfter: bonus,
        note: item.note,
      });
    }
  } else if (m.flatBonus !== 0) {
    base = Math.max(0, base + m.flatBonus);
    steps.push({
      key: 'flat-0',
      label: 'Gear',
      value: `${m.flatBonus > 0 ? '+' : ''}${fmt(m.flatBonus)}`,
      kind: 'base',
      baseAfter: base,
      multAfter: mult,
      bonusAfter: bonus,
      note: 'per-Set bonuses',
    });
  }

  // 4. Every itemized multiplier (Rainbow, Evolved, Parry, Stagger, Hot Streak, Arcana, etc.)
  for (let i = 0; i < (m.multItems?.length ?? 0); i++) {
    const item = m.multItems![i];
    if (Math.abs(item.amount - 1) < 0.01) continue;
    mult *= item.amount;
    steps.push({
      key: `mult-${i}`,
      label: shortLabel(item.label),
      value: `×${fmt(item.amount)}`,
      kind: 'mult',
      baseAfter: base,
      multAfter: mult,
      bonusAfter: bonus,
      note: item.note,
    });
  }

  // 5. Fight Power multiplier (applies to the Set hit & extras)
  if (power > 1.01) {
    mult *= power;
    steps.push({
      key: 'power',
      label: 'Power',
      value: `×${fmt(power)}`,
      kind: 'mult',
      baseAfter: base,
      multAfter: mult,
      bonusAfter: bonus,
      note: `${Math.round(m.powerPoints ?? 0)} scaling charge`,
    });
  }

  // 6. Post-mult extra Set damage (Purity chain, Traps defused — scaled by Power just like dealDamage)
  for (let i = 0; i < (m.extraItems?.length ?? 0); i++) {
    const item = m.extraItems![i];
    if (item.amount === 0) continue;
    const scaled = Math.round(item.amount * power * 10) / 10;
    bonus += scaled;
    steps.push({
      key: `extra-${i}`,
      label: shortLabel(item.label),
      value: `+${fmt(scaled)}`,
      kind: 'bonus',
      baseAfter: base,
      multAfter: mult,
      bonusAfter: bonus,
      note: item.note,
    });
  }

  // 7. Follow-up damage lines fired during the same turn (Rally Horn, Free Set, Piñata, Blast rules, etc.)
  for (let i = 0; i < (ignition.followUps?.length ?? 0); i++) {
    const f = ignition.followUps![i];
    if (f.amount <= 0) continue;
    bonus += f.amount;
    steps.push({
      key: `fu-${i}`,
      label: shortLabel(f.label),
      value: `+${fmt(f.amount)}`,
      kind: 'bonus',
      baseAfter: base,
      multAfter: mult,
      bonusAfter: bonus,
      note: 'triggered follow-up',
    });
  }

  const finalTotal = Math.round(ignition.turnDamage ?? m.hit);
  const receiptLine = steps
    .map(s => (s.key === 'cards' ? s.label : `${s.value} ${s.label}`))
    .join(' · ');

  return {
    steps,
    finalBase: Math.round(base * 10) / 10,
    finalMult: Math.round(mult * 100) / 100,
    finalBonus: Math.round(bonus * 10) / 10,
    finalTotal,
    heatTier: heatTierFor(finalTotal),
    receiptLine,
  };
};

const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

const scaleCountForState = (run: RunState, per: Scale): number => {
  switch (per) {
    case 'boardCard': return run.board.length;
    case 'missingHeart': return run.hearts !== null && run.maxHearts !== null ? Math.max(0, run.maxHearts - run.hearts) : 0;
    case 'heart': return run.hearts ?? 0;
    case 'hint': return run.stats.hints;
    case 'grace': return run.stats.graces;
    case 'link': return run.connections.length;
    case 'combo': return run.combo;
    case 'bonusCard': return run.board.filter(c => (c.bonusPoints ?? 0) > 0 || (c.bonusMoney ?? 0) > 0).length;
    case 'burning': return run.board.filter(c => c.onFire).length;
    case 'evolution': return run.activeEvolutions.length;
  }
};

const primedConditionsHold = (run: RunState, when: Condition[] | undefined): boolean => {
  if (!when?.length) return true;
  return when.every(c => {
    switch (c.kind) {
      case 'heartsAtMost': return run.hearts !== null && run.hearts <= c.n;
      case 'heartsFull': return run.hearts !== null && run.maxHearts !== null && run.hearts >= run.maxHearts;
      case 'comboAtLeast': return run.combo >= c.n;
      case 'noMistakesThisFight': return run.mistakes === 0;
      case 'evolutionActive': return run.activeEvolutions.length > 0;
      case 'boardAtLeast': return run.board.length >= c.n;
      case 'foeHpBelow': return run.foeMaxHp > 0 && run.foeHp > 0 && run.foeHp / run.foeMaxHp < c.fraction;
      // Chance, Rainbow, Hinted, diffCount, and timing depend on the exact Set played — don't promise them in NEXT
      default: return false;
    }
  });
};

const primedTriggerNote = (run: RunState, key: string, t: Trigger): string | null => {
  if (t.on === 'firstSetOfWave') return run.setsThisWave === 0 ? 'Wave opener primed' : null;
  if (t.on === 'everyNthSet') return t.n > 0 && (run.matches + 1) % t.n === 0 ? `Set #${run.matches + 1} (every ${ordinal(t.n)} Set) primed` : null;
  if (t.on === 'setsWithin') {
    const times = (run.ruleState[key]?.times ?? []).filter(x => run.elapsedMs - x <= t.withinMs);
    return times.length >= t.count - 1 ? `${t.count} fast Sets primed` : null;
  }
  if (t.on === 'set') return 'Triggers on next Set';
  return null;
};

const primedRuleLabel = (run: RunState, key: string, callout?: string): string => {
  const base = key.split('#')[0];
  if (base.startsWith('node:')) return getSkillNode(base.slice(5))?.name ?? callout?.replace(/!$/, '') ?? 'Skill';
  if (base.startsWith('evo:')) return getRecipe(base.slice(4))?.name ?? callout?.replace(/!$/, '') ?? 'Evolution';
  const slot = /^w(\d+):(.*)$/.exec(base);
  if (slot) return run.weapons[Number(slot[1])]?.name ?? slot[2];
  return callout?.replace(/!$/, '') ?? 'Bonus';
};

/**
 * Pure primed Next-Set preview: tells players & Twitch viewers what a plain
 * 3-card Set is primed to hit for RIGHT NOW before they tap anything.
 */
export const computePrimedEquation = (run: RunState): PrimedEquation => {
  const surge = run.surge?.active ? SURGE_RULES.multiplier : 1;
  const items: PrimedEquation['items'] = [];
  let base = 3;
  items.push({
    label: '3 cards',
    value: fmt(base),
    kind: 'base',
    note: 'Base 1 damage per card',
  });

  if (run.bonusDamagePerMatch !== 0) {
    base += run.bonusDamagePerMatch;
    items.push({ label: 'Heavy Hitter', value: `+${fmt(run.bonusDamagePerMatch)}`, kind: 'base', note: 'Workshop upgrade' });
  }

  const sourceInput = {
    skillNodes: run.skillNodes,
    weapons: run.weapons,
    activeEvolutions: run.activeEvolutions,
    growth: growthModifiers(run.growth ?? {}),
    blankEvolutionRules: run.blankEvolutionRules,
  };
  const sources = liveSources(sourceInput);
  let gearFlat = 0;
  let hintFlat = 0;
  for (const { source } of sources) {
    gearFlat += source.modifiers?.setDamage ?? 0;
    hintFlat += (source.modifiers?.hintHeldDamage ?? 0) * run.stats.hints;
  }
  if (gearFlat !== 0) {
    base += gearFlat;
    items.push({ label: 'Gear', value: `${gearFlat > 0 ? '+' : ''}${fmt(gearFlat)}`, kind: 'base', note: 'Standing charm & skill bonuses' });
  }
  if (hintFlat > 0) {
    base += hintFlat;
    items.push({ label: 'Hints held', value: `+${fmt(hintFlat)}`, kind: 'base', note: `${run.stats.hints} hints held` });
  }

  // Missing-heart Scrappy passive (Orange Tabby)
  if (run.passives.includes('scrappy') && run.hearts !== null && run.maxHearts !== null) {
    const missing = Math.max(0, run.maxHearts - run.hearts);
    const perHeart = PASSIVE_TUNING.scrappy['scrappy.perHeart'] +
      sources.reduce((s, x) => s + (x.source.modifiers?.passiveTuning?.['scrappy.perHeart'] ?? 0), 0);
    const scrappyDmg = missing * perHeart;
    if (scrappyDmg > 0) {
      base += scrappyDmg;
      items.push({ label: 'Scrappy', value: `+${fmt(scrappyDmg)}`, kind: 'base', note: `${missing} missing ♥` });
    }
  }

  // Snowball & Glass Sword standing bonuses
  const snowStep = sources.reduce((s, x) => s + (x.source.modifiers?.snowballStep ?? 0), 0);
  if (snowStep > 0 && run.gear.snowball > 0) {
    const snowDmg = run.gear.snowball * snowStep;
    base += snowDmg;
    items.push({ label: 'Snowball', value: `+${fmt(snowDmg)}`, kind: 'base', note: `${run.gear.snowball} Sets rolled` });
  }
  const glassDmg = sources.reduce((s, x) => s + (x.source.modifiers?.glassDamage ?? 0), 0);
  if (glassDmg > 0 && !run.gear.glassBroken) {
    base += glassDmg;
    items.push({ label: 'Glass Sword', value: `+${fmt(glassDmg)}`, kind: 'base', note: 'Unbroken window active' });
  }

  // Active Evolution flat bonus
  if (run.activeEvolutions.length > 0) {
    const evoFlat = run.activeEvolutions.length * EVOLUTION_RULES.setDamage;
    base += evoFlat;
    const names = run.activeEvolutions.map(e => getRecipe(e.id)?.name ?? 'Evolution').join(', ');
    items.push({ label: names, value: `+${fmt(evoFlat)}`, kind: 'base', note: 'Active Evolution bonus' });
  }

  // Primed deterministic Set-triggered flat damage rules (Rally Horn, Clarity Lens, Revenge Linker, War Drum, etc.)
  for (const kr of liveRules(sourceInput)) {
    const note = primedTriggerNote(run, kr.key, kr.rule.trigger);
    if (!note || !primedConditionsHold(run, kr.rule.when)) continue;
    let ruleFlat = 0;
    for (const e of kr.rule.effects) {
      if (e.do === 'damage' && e.amount > 0) {
        const times = e.per ? scaleCountForState(run, e.per) : 1;
        if (times > 0) ruleFlat += e.amount * times;
      } else if (e.do === 'cashIn') {
        const held = e.resource === 'hints' ? run.stats.hints : run.stats.graces;
        if (held > 0) ruleFlat += held * e.damageEach;
      }
    }
    if (ruleFlat > 0) {
      base += ruleFlat;
      items.push({
        label: primedRuleLabel(run, kr.key, kr.rule.callout),
        value: `+${fmt(ruleFlat)}`,
        kind: 'base',
        note,
      });
    }
  }
  base = Math.max(0, Math.round(base * 10) / 10);

  let mult = 1;
  if (surge > 1) {
    mult *= surge;
    items.push({
      label: 'Shading Surge',
      value: `×${fmt(surge)}`,
      kind: 'mult',
      note: '4-trait Shading Surge multiplier',
    });
  }
  if (run.activeEvolutions.length > 0) {
    if (run.stackEvolutionMultipliers) {
      for (const evo of run.activeEvolutions) {
        mult *= EVOLUTION_RULES.setMultiplier;
        items.push({
          label: getRecipe(evo.id)?.name ?? 'Evolved',
          value: `×${fmt(EVOLUTION_RULES.setMultiplier)}`,
          kind: 'mult',
          note: 'Active Evolution multiplier',
        });
      }
    } else {
      mult *= EVOLUTION_RULES.setMultiplier;
      const evoLabel =
        run.activeEvolutions.length === 1
          ? (getRecipe(run.activeEvolutions[0].id)?.name ?? 'Evolved')
          : 'Evolved';
      items.push({ label: evoLabel, value: `×${fmt(EVOLUTION_RULES.setMultiplier)}`, kind: 'mult', note: 'Active Evolution multiplier' });
    }
  }
  const a = arcanaRules(run.arcana);
  if ((a.damageScale ?? 1) !== 1) {
    const arc = run.arcana.map(getArcana).find(x => x.rules.damageScale !== undefined);
    mult *= a.damageScale!;
    items.push({ label: arc?.name ?? 'Arcana', value: `×${fmt(a.damageScale!)}`, kind: 'mult', note: 'Arcana Set multiplier' });
  }
  if (run.nextSetMultiplier > 1) {
    mult *= run.nextSetMultiplier;
    items.push({ label: 'Next Set', value: `×${fmt(run.nextSetMultiplier)}`, kind: 'mult', note: 'Charged for next Set' });
  }
  if (run.passive.hotStreak) {
    const hotMult = PASSIVE_TUNING.hot_streak['hotStreak.multiplier'] +
      sources.reduce((s, x) => s + (x.source.modifiers?.passiveTuning?.['hotStreak.multiplier'] ?? 0), 0);
    mult *= hotMult;
    items.push({ label: 'Hot Streak', value: `×${fmt(hotMult)}`, kind: 'mult', note: 'Sly Fox streak ready' });
  }
  if (run.parry?.phase === 'staggered') {
    mult *= PARRY_RULES.staggerDamageMult;
    items.push({ label: 'Staggered', value: `×${fmt(PARRY_RULES.staggerDamageMult)}`, kind: 'mult', note: 'Foe staggered by Parry' });
  }
  const power = damageMultiplier(run.power ?? 0);
  if (power > 1.01) {
    mult *= power;
    items.push({ label: 'Power', value: `×${fmt(power)}`, kind: 'mult', note: `${Math.round(run.power)} scaling charge` });
  }

  mult = Math.round(mult * 100) / 100;
  const total = Math.round(base * mult);
  const summaryLine = items.map((it, idx) => (idx === 0 ? it.label : `${it.value} ${it.label}`)).join(' · ');
  return { base, mult, total, items, summaryLine };
};

interface Props {
  ignition: SetIgnition | null;
  run?: RunState;
  enabled: boolean;
  /** Desktop landscape sidebar: allow 2 full lines of itemized receipt */
  wide?: boolean;
  onPress?: () => void;
}

const FlameTongue: React.FC<{ color: string; offset: number; delay: number; active: boolean }> = ({
  color,
  offset,
  delay,
  active,
}) => {
  const bob = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }
    const t = setTimeout(() => {
      bob.value = withRepeat(
        withSequence(
          withTiming(1, { duration: MS.quick, easing: EASE.drift }),
          withTiming(0, { duration: MS.quick + 20, easing: EASE.drift })
        ),
        -1
      );
    }, delay);
    return () => {
      clearTimeout(t);
      cancelAnimation(bob);
    };
  }, [active, delay, bob]);

  const anim = useAnimatedStyle(() => ({
    opacity: 0.72 + bob.value * 0.28,
    transform: [
      { translateY: -bob.value * 2.5 },
      { scaleY: 0.85 + bob.value * 0.3 },
      { rotate: `${offset > 0 ? 8 : -8}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[st.flame, { backgroundColor: color, left: `${50 + offset}%` as unknown as number }, anim]}
    />
  );
};

const fitReceiptParts = (parts: readonly string[], maxChars: number): string => {
  if (parts.length === 0) return '';
  let out = parts[0];
  let shown = 1;
  for (let i = 1; i < parts.length; i++) {
    const remaining = parts.length - i;
    const moreReserve = remaining > 1 ? ` · +${remaining} more`.length : 0;
    const candidate = `${out} · ${parts[i]}`;
    if (candidate.length + moreReserve > maxChars) {
      return `${out} · +${remaining} more`;
    }
    out = candidate;
    shown++;
  }
  return shown < parts.length ? `${out} · +${parts.length - shown} more` : out;
};

const MultiplierIgnition: React.FC<Props> = ({ ignition, run, enabled, wide = false, onPress }) => {
  const appActive = useAppActive();
  const sysReduced = useReducedMotion();
  const animate = enabled && !sysReduced;

  const breakdown = useMemo(() => (ignition ? buildBalatroBreakdown(ignition) : null), [ignition]);
  const primed = useMemo(() => (run ? computePrimedEquation(run) : null), [run]);

  const [stepIdx, setStepIdx] = useState<number>(-1);
  const [phase, setPhase] = useState<'primed' | 'tally' | 'settled'>('primed');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const baseScale = useSharedValue(1);
  const multScale = useSharedValue(1);
  const bonusScale = useSharedValue(1);
  const totalScale = useSharedValue(1);
  const tickerY = useSharedValue(0);
  const tickerOp = useSharedValue(1);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (!ignition || !breakdown) {
      setPhase('primed');
      setStepIdx(-1);
      baseScale.value = 1;
      multScale.value = 1;
      bonusScale.value = 1;
      totalScale.value = 1;
      tickerY.value = 0;
      tickerOp.value = 1;
      return;
    }

    const lastIdx = breakdown.steps.length - 1;

    // Reduced motion / effects off: show the exact finished Balatro receipt instantly, zero bounce/flames
    if (!animate) {
      setStepIdx(lastIdx);
      setPhase('settled');
      baseScale.value = 1;
      multScale.value = 1;
      bonusScale.value = 1;
      totalScale.value = 1;
      tickerY.value = 0;
      tickerOp.value = 1;
      return;
    }

    const popValue = (sv: { value: number }) => {
      sv.value = withSequence(
        withTiming(SCALE.pop, { duration: Math.round(MS.feedback * 0.55), easing: EASE.pop }),
        withTiming(1, { duration: Math.round(MS.feedback * 0.8), easing: EASE.ui })
      );
    };

    const flashTicker = () => {
      tickerY.value = 5;
      tickerOp.value = 0.6;
      tickerY.value = withTiming(0, { duration: Math.round(MS.feedback * 0.75), easing: EASE.enter });
      tickerOp.value = withTiming(1, { duration: Math.round(MS.feedback * 0.75), easing: EASE.enter });
    };

    // f0: immediately open tally on Step 0 (Cards base)
    setPhase('tally');
    setStepIdx(0);
    popValue(baseScale);
    flashTicker();

    // Step through every subsequent contributor on accelerating cascadeDelay (hits peak right around f16–f22)
    for (let i = 1; i < breakdown.steps.length; i++) {
      const idx = i;
      const step = breakdown.steps[idx];
      const delayMs = cascadeDelay(idx, STAGGER.item);
      timers.current.push(
        setTimeout(() => {
          setStepIdx(idx);
          flashTicker();
          if (step.kind === 'base') popValue(baseScale);
          else if (step.kind === 'mult') popValue(multScale);
          else popValue(bonusScale);
          // slot: 0 guarantees zero double-offset delay; amount climbs the musical pitch cleanly
          band.cue('multStep', { slot: 0, amount: idx });
        }, delayMs)
      );
    }

    // Payoff Slam: lands cleanly after the last step (right as the thrown Set hits the foe!)
    const slamAt = breakdown.steps.length > 1 ? cascadeDelay(breakdown.steps.length - 1, STAGGER.item) + 55 : 70;
    timers.current.push(
      setTimeout(() => {
        setPhase('settled');
        totalScale.value = 0.86;
        totalScale.value = withSequence(
          withTiming(SCALE.reward, { duration: Math.round(MS.feedback * 0.7), easing: EASE.pop }),
          withSpring(1, SPRING.lively)
        );
        band.cue('multSlam', { slot: 0, amount: breakdown.heatTier });
      }, slamAt)
    );

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [ignition, breakdown, animate, baseScale, multScale, bonusScale, totalScale, tickerY, tickerOp]);

  const baseAnim = useAnimatedStyle(() => ({ transform: [{ scale: baseScale.value }] }));
  const multAnim = useAnimatedStyle(() => ({ transform: [{ scale: multScale.value }] }));
  const bonusAnim = useAnimatedStyle(() => ({ transform: [{ scale: bonusScale.value }] }));
  const totalAnim = useAnimatedStyle(() => ({ transform: [{ scale: totalScale.value }] }));
  const tickerAnim = useAnimatedStyle(() => ({ opacity: tickerOp.value, transform: [{ translateY: tickerY.value }] }));
  const compactReceipt = useMemo(() => {
    if (!breakdown) return '';
    if (wide) return breakdown.receiptLine;
    const parts = breakdown.steps.map(s => (s.key === 'cards' ? s.label : `${s.value} ${s.label}`));
    return fitReceiptParts(parts, 56);
  }, [breakdown, wide]);
  const compactPrimed = useMemo(() => {
    if (!primed) return '';
    if (wide) return `Next Set: ${primed.summaryLine}`;
    const parts = primed.items.map((it, idx) => (idx === 0 ? it.label : `${it.value} ${it.label}`));
    return `Next: ${fitReceiptParts(parts, 50)}`;
  }, [primed, wide]);

  // If neither an ignition nor a live run is present, nothing to render
  if (!breakdown && !primed) return null;

  const showingSet = Boolean(breakdown && phase !== 'primed');
  const activeStep = showingSet && breakdown ? breakdown.steps[Math.max(0, Math.min(stepIdx, breakdown.steps.length - 1))] : null;

  const shownBase = showingSet && breakdown
    ? (phase === 'tally' && activeStep ? activeStep.baseAfter : breakdown.finalBase)
    : primed!.base;
  const shownMult = showingSet && breakdown
    ? (phase === 'tally' && activeStep ? activeStep.multAfter : breakdown.finalMult)
    : primed!.mult;
  const shownBonus = showingSet && breakdown
    ? (phase === 'tally' && activeStep ? activeStep.bonusAfter : breakdown.finalBonus)
    : 0;
  const shownTotal = showingSet && breakdown
    ? (phase === 'tally' ? Math.round(shownBase * shownMult + shownBonus) : breakdown.finalTotal)
    : primed!.total;
  const heatTier: HeatTier = showingSet && breakdown ? breakdown.heatTier : 0;

  const isBlazing = animate && phase === 'settled' && heatTier >= 2;
  const isNuclear = animate && phase === 'settled' && heatTier >= 3;
  const flamesActive = isBlazing && appActive;

  const tagText = !showingSet ? 'NEXT' : phase === 'tally' ? 'LIVE' : 'LAST';
  const row2Text = showingSet && breakdown
    ? (phase === 'tally' && activeStep
        ? `${activeStep.key === 'cards' ? activeStep.label : `${activeStep.value} ${activeStep.label}`}${activeStep.note ? ` · ${activeStep.note}` : ''}`
        : compactReceipt)
    : compactPrimed;

  const hasFinalBonus = showingSet && !!breakdown && breakdown.finalBonus > 0;
  const row2Color = showingSet && phase === 'tally' && activeStep
    ? (activeStep.kind === 'base' ? '#BAE6FD' : activeStep.kind === 'mult' ? '#FECACA' : '#FDE047')
    : '#F5F0E8';

  const inner = (
    <View
      style={[
        st.bar,
        showingSet && heatTier === 1 && st.barHot,
        showingSet && heatTier === 2 && st.barBlazing,
        showingSet && heatTier === 3 && st.barNuclear,
      ]}
    >
      {/* Row 1: Balanced 3-zone fixed-geometry Balatro Equation — ZERO horizontal reflow */}
      <View style={st.eqRow}>
        <View style={[st.tagPill, phase === 'tally' && st.tagPillLive]}>
          <Text style={[st.tagText, phase === 'tally' && st.tagTextLive]}>{tagText}</Text>
        </View>

        <View style={st.eqMath}>
          <Animated.View style={[st.basePill, baseAnim]} testID="score-base-pill">
            <Text style={st.pillCap}>BASE</Text>
            <Text style={st.pillVal} numberOfLines={1}>{fmt(shownBase)}</Text>
          </Animated.View>

          <Text style={st.op}>×</Text>

          <Animated.View style={[st.multPill, shownMult > 1.01 && st.multPillHot, multAnim]} testID="score-mult-pill">
            <Text style={st.pillCap}>MULT</Text>
            <Text style={st.pillVal} numberOfLines={1}>{fmt(shownMult)}×</Text>
          </Animated.View>

          {hasFinalBonus && (
            <>
              <Text style={[st.op, shownBonus <= 0 && { opacity: 0.3 }]}>+</Text>
              <Animated.View
                style={[st.bonusPill, shownBonus <= 0 && { opacity: 0.3 }, bonusAnim]}
                testID="score-bonus-pill"
              >
                <Text style={st.pillVal} numberOfLines={1}>{fmt(shownBonus)}</Text>
              </Animated.View>
            </>
          )}

          <Text style={st.op}>=</Text>

          <Animated.View style={[st.totalWrap, totalAnim]}>
            {isBlazing && (
              <>
                <FlameTongue color={isNuclear ? '#38BDF8' : '#FB923C'} offset={-24} delay={0} active={flamesActive} />
                <FlameTongue color={isNuclear ? '#FDE047' : '#FACC15'} offset={0} delay={70} active={flamesActive} />
                <FlameTongue color={isNuclear ? '#22D3EE' : '#F97316'} offset={22} delay={130} active={flamesActive} />
              </>
            )}
            <View
              style={[
                st.totalBadge,
                showingSet && heatTier === 1 && st.totalHot,
                showingSet && heatTier === 2 && st.totalBlazing,
                showingSet && heatTier === 3 && st.totalNuclear,
              ]}
            >
              <Text
                testID="multiplier-ignition-total"
                style={[st.totalText, showingSet && heatTier >= 2 && { color: '#FFFFFF' }]}
                numberOfLines={1}
              >
                {fmt(shownTotal)}
              </Text>
            </View>
          </Animated.View>
        </View>

        {onPress ? (
          <View style={st.infoDot}>
            <Text style={st.infoText}>?</Text>
          </View>
        ) : (
          <View style={{ width: 16 }} />
        )}
      </View>

      {/* Row 2: Fixed-height itemized source ticker → persistent receipt */}
      <Animated.View style={[st.receiptRow, wide && st.receiptRowWide, tickerAnim]}>
        <Text
          testID="score-receipt-line"
          style={[st.receiptText, { color: row2Color }]}
          numberOfLines={wide ? 2 : 1}
          ellipsizeMode="tail"
        >
          {row2Text}
        </Text>
      </Animated.View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID="multiplier-ignition"
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Score equation: Base ${fmt(shownBase)} times Mult ${fmt(shownMult)} equals ${fmt(shownTotal)} damage. Tap for full breakdown.`}
        style={st.wrap}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <View testID="multiplier-ignition" style={st.wrap}>
      {inner}
    </View>
  );
};

const st = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  bar: {
    backgroundColor: '#241E19',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    gap: 1.5,
    overflow: 'hidden',
  },
  barHot: {
    borderColor: '#D97706',
  },
  barBlazing: {
    borderColor: '#F97316',
    backgroundColor: '#2E1A12',
  },
  barNuclear: {
    borderColor: '#38BDF8',
    backgroundColor: '#162436',
  },
  eqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    minHeight: 22,
    paddingTop: 2.5,
  },
  eqMath: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
  },
  tagPill: {
    width: 32,
    alignItems: 'center',
    backgroundColor: '#3A2F26',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1.5,
  },
  tagPillLive: {
    backgroundColor: COLORS.actionYellow,
  },
  tagText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#D6CFC4',
  },
  tagTextLive: {
    color: INK,
  },
  basePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0E7490',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#164E63',
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 46,
    justifyContent: 'center',
  },
  multPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#9A3412',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#7C2D12',
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 44,
    justifyContent: 'center',
  },
  multPillHot: {
    backgroundColor: '#DC2626',
    borderColor: '#991B1B',
  },
  bonusPill: {
    backgroundColor: '#B45309',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#78350F',
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    justifyContent: 'center',
  },
  pillCap: {
    fontSize: 7,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.3,
  },
  pillVal: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  op: {
    fontSize: 11,
    fontWeight: '900',
    color: '#E7E0D6',
  },
  totalWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flame: {
    position: 'absolute',
    top: -2.5,
    width: 6.5,
    height: 7,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    marginLeft: -3.25,
  },
  totalBadge: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 7,
    paddingVertical: 0.5,
    minWidth: 32,
    alignItems: 'center',
  },
  totalHot: {
    backgroundColor: '#F59E0B',
  },
  totalBlazing: {
    backgroundColor: '#EA580C',
    borderColor: '#FDE047',
  },
  totalNuclear: {
    backgroundColor: '#0284C7',
    borderColor: '#7DD3FC',
  },
  totalText: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: '900',
    color: INK,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  infoDot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#3A2F26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#E7E0D6',
  },
  receiptRow: {
    height: 13,
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptRowWide: {
    height: 26,
  },
  receiptText: {
    flexShrink: 1,
    maxWidth: '100%',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});

export default MultiplierIgnition;
