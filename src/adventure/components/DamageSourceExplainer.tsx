/**
 * One non-weapon damage source, explained.
 *
 * Shared card matching `WeaponExplainer.tsx`'s exact visual craft for every
 * non-weapon entry in `BattleDamageStory` (Adventure `LevelResults` and
 * Starfall Summit `SpireRewardScreen` / `SpireEndScreen`) and `FightReplay`:
 * Per-Weapon Timed Evolutions, Synergy Hooks, Holo Cards, Set-Parry Counters,
 * Shading Surge, Rainbow Strike, Purity Chain, Trap Defusal, Skill Tree Nodes,
 * Fighter Passives, Arcana, Workshop Upgrades, Matched Sets, and Board FX.
 *
 * GUARDRAIL: Weapons MUST NEVER use this component — every weapon description
 * UI goes exclusively through `WeaponExplainer.tsx`.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { ARCANA } from '../data/arcana';
import { getArmoryWeapon } from '../data/armory';
import { getWeaponEvolution } from '../data/evolutions';
import { FIGHTERS } from '../data/fighters';
import { PARRY_RULES } from '../data/parry';
import { PASSIVES } from '../data/passives';
import { BASE_RULES, SURGE_RULES } from '../data/rules';
import { SYNERGY_ATTR_META } from '../data/synergy';
import { UPGRADES } from '../data/upgrades';
import type { DamageSourceKind } from '../engine/damageStory';
import { EVOLUTION_CHASSIS, getSkillNode } from '../engine/sources';
import type { PassiveId, SynergyAttrId } from '../types';
import { INK, TONE } from './ui';

export interface DamageSourceDetailRow {
  icon: IconName;
  title: string;
  color: string;
  text: string;
}

export interface ResolvedDamageSourceCopy {
  title: string;
  icon: IconName;
  categoryLabel: string;
  categoryColor: string;
  subtitle: string;
  what: string;
  details: DamageSourceDetailRow[];
}

export interface DamageSourceExplainerProps {
  /** Canonical non-weapon source id (`evo:<id>`, `node:<id>`, `passive:<id>`, `arcana:<id>`, `upgrade:<id>`, `bonus:*`, `synergy:*`, `set:*`, `fx:*`) */
  sourceId: string;
  /** Display name fallback (or override when canonical data is absent) */
  name?: string;
  /** Optional kind hint used for unknown/custom fallback ids */
  kind?: DamageSourceKind;
  /** Icon fallback */
  icon?: IconName;
  /** Accent color from chart/series (tints the 44x44 icon medallion and share bar) */
  accentColor?: string;
  /** Optional gold badge pill on the right of the title (e.g. "MVP", "32% DMG") */
  badge?: string;
  /** Optional subtitle override */
  subtitle?: string;
  /** Optional fallback plain-English description */
  description?: string;
  /** After a fight/climb: what it did, in words, and its share of the damage (0..1) for the bar */
  result?: { text: string; share?: number };
  /** Uppercase label above the result strip ("THIS FIGHT" or "THIS CLIMB") */
  scopeLabel?: string;
  /** Start with the collapsible "more" drawer open */
  defaultOpen?: boolean;
  testID?: string;
}

const CATEGORY_COLORS = {
  evolution: '#7C3AED',
  synergy: '#0F766E',
  holo: '#7C3AED',
  parry: '#B91C1C',
  surge: '#BE185D',
  skill: '#1D4ED8',
  passive: '#0F766E',
  arcana: TONE.arcana,
  upgrade: '#0369A1',
  sets: INK,
  cardBonus: '#C2410C',
  bonus: '#475569',
} as const;

const isHex6 = (c?: string): c is string => Boolean(c && /^#[0-9a-fA-F]{6}$/.test(c));

/** Resolve canonical title, category, plain-English description, and expandable details for any non-weapon source id. */
export const resolveDamageSourceCopy = (opts: {
  sourceId: string;
  name?: string;
  kind?: DamageSourceKind;
  icon?: IconName;
  subtitle?: string;
  description?: string;
}): ResolvedDamageSourceCopy => {
  const { sourceId, name, kind, icon, subtitle, description } = opts;
  const colon = sourceId.indexOf(':');
  const prefix = colon >= 0 ? sourceId.slice(0, colon) : sourceId;
  const rawId = colon >= 0 ? sourceId.slice(colon + 1) : '';

  // 1. Per-Weapon Timed Evolution (`evo:<weaponId>:<slug>`)
  if (prefix === 'evo') {
    const evo = getWeaponEvolution(rawId);
    const parentWeapon = evo ? getArmoryWeapon(evo.weaponId) : undefined;
    const secs = evo ? Math.round(evo.durationMs / 1000) : 18;
    const multPct = Math.round(EVOLUTION_CHASSIS.setAdditiveMult * 100);
    const universalNote = `Lasts ${secs}s on top of +${EVOLUTION_CHASSIS.ignitionBurstDamage} opening burst, +${EVOLUTION_CHASSIS.setFlatDamage} flat base damage, and +${multPct}% Set multiplier (stacks across active Evolutions).`;
    const details: DamageSourceDetailRow[] = [];
    if (parentWeapon) {
      details.push({
        icon: parentWeapon.icon as IconName,
        title: 'Weapon',
        color: CATEGORY_COLORS.evolution,
        text: `${parentWeapon.name} — pick 1 of 3 evolutions in Camp Armory before battle.`,
      });
    }
    if (evo?.conditionText) {
      details.push({
        icon: 'lorc/archery-target',
        title: 'How to trigger',
        color: TONE.upside,
        text: `${evo.conditionText} (re-triggerable after a ${Math.round((evo.cooldownMs ?? EVOLUTION_CHASSIS.defaultCooldownMs) / 1000)}s cooldown).`,
      });
    }
    if (evo && evo.synergyTags.length > 0) {
      const tagLabels = evo.synergyTags.map(t => SYNERGY_ATTR_META[t]?.label ?? t).join(' · ');
      details.push({
        icon: 'delapouite/sparkles',
        title: 'Synergy tags',
        color: CATEGORY_COLORS.synergy,
        text: tagLabels,
      });
    }
    return {
      title: evo?.name ?? name ?? rawId,
      icon: (evo?.icon as IconName | undefined) ?? icon ?? 'lorc/crystal-shine',
      categoryLabel: 'EVOLUTION',
      categoryColor: evo?.accent ?? CATEGORY_COLORS.evolution,
      subtitle: subtitle ?? (parentWeapon ? `${parentWeapon.name} · ${secs}s Evolution` : 'Weapon Evolution'),
      what: evo ? `${evo.tagline} ${universalNote}` : (description ?? universalNote),
      details,
    };
  }

  // 2. Synergy Graph Hooks (`synergy:<attr>` or `bonus:synergy`)
  if (prefix === 'synergy' || sourceId === 'bonus:synergy') {
    const attrMeta = rawId && rawId in SYNERGY_ATTR_META ? SYNERGY_ATTR_META[rawId as SynergyAttrId] : undefined;
    return {
      title: attrMeta ? `${attrMeta.label} Synergy` : (name ?? 'Synergy Hooks'),
      icon: attrMeta?.icon ?? icon ?? 'delapouite/sparkles',
      categoryLabel: 'SYNERGY',
      categoryColor: attrMeta?.color ?? CATEGORY_COLORS.synergy,
      subtitle: subtitle ?? 'Synergy Graph Scaling',
      what: attrMeta
        ? `${attrMeta.description} Weapons sharing ${attrMeta.label} feed each other's base damage all fight long.`
        : 'Base damage added by your belt weapons feeding off live Synergy Graph counters (Burn, Blast, Links, Holo, Echoes, Streaks, and more).',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How to build it',
          color: CATEGORY_COLORS.synergy,
          text: 'Pair Producer weapons (▲) with Consumer weapons (◆) that share a Synergy tag so every action scales your whole belt.',
        },
      ],
    };
  }

  // 3. Holo Cards (`bonus:holo` / `set:holo`)
  if (sourceId === 'bonus:holo' || sourceId === 'set:holo') {
    const holoPct = Math.round(BASE_RULES.holoCardMult * 100);
    return {
      title: name ?? 'Holo Shine',
      icon: icon ?? 'delapouite/sparkles',
      categoryLabel: 'HOLO',
      categoryColor: CATEGORY_COLORS.holo,
      subtitle: subtitle ?? 'Holo Card Bonus',
      what: `Each Holo card matched adds +${BASE_RULES.holoCardBonus} base damage and +${holoPct}% additive Set multiplier (×1.2 / ×1.4 / ×1.6 for 1 / 2 / 3 Holo cards).`,
      details: [
        {
          icon: 'delapouite/sparkles',
          title: 'How to spawn more',
          color: CATEGORY_COLORS.holo,
          text: 'Weapons like Field Stone, Catalyst Prism, Ice Block, and several Weapon Evolutions convert board cards into Holo.',
        },
      ],
    };
  }

  // 4. Skill Tree Node (`node:<id>`)
  if (prefix === 'node') {
    const node = getSkillNode(rawId);
    const details: DamageSourceDetailRow[] = [];
    if (node) {
      details.push({
        icon: 'lorc/tree-branch',
        title: 'Skill tree',
        color: CATEGORY_COLORS.skill,
        text: `${node.fighter} skill node (${node.cost}★). Always active once learned.`,
      });
      if (node.roots.length > 0) {
        const rootNames = node.roots
          .map(pid => PASSIVES[pid]?.name)
          .filter(Boolean)
          .join(' & ');
        if (rootNames) {
          details.push({
            icon: 'lorc/spark-spirit',
            title: 'Grows from',
            color: CATEGORY_COLORS.passive,
            text: `Branches directly off ${rootNames}.`,
          });
        }
      }
      if (node.requires?.starsEarned) {
        details.push({
          icon: 'lorc/flat-star',
          title: 'Capstone',
          color: '#B45309',
          text: `Sealed capstone unlocked once you earn ${node.requires.starsEarned} campaign stars.`,
        });
      }
    }
    return {
      title: node?.name ?? name ?? rawId,
      icon: (node?.icon as IconName | undefined) ?? icon ?? 'lorc/spark-spirit',
      categoryLabel: 'SKILL NODE',
      categoryColor: CATEGORY_COLORS.skill,
      subtitle: subtitle ?? (node ? `${node.fighter} · Skill Tree` : 'Skill Tree'),
      what: node?.text ?? description ?? 'A passive skill node unlocked on your fighter skill tree.',
      details,
    };
  }

  // 5. Fighter Passive (`passive:<id>`)
  if (prefix === 'passive') {
    const pid = rawId as PassiveId;
    const passive = PASSIVES[pid];
    const owner = FIGHTERS.find(f => f.passives.includes(pid));
    const details: DamageSourceDetailRow[] = [];
    if (owner) {
      details.push({
        icon: owner.icon,
        title: owner.name,
        color: CATEGORY_COLORS.passive,
        text: owner.blurb,
      });
    }
    details.push({
      icon: 'lorc/tree-branch',
      title: 'How to grow it',
      color: CATEGORY_COLORS.skill,
      text: "Always on from the first second of every battle. Strengthen it through nodes on this fighter's Skill Tree.",
    });
    return {
      title: passive?.name ?? name ?? rawId,
      icon: (passive?.icon as IconName | undefined) ?? icon ?? 'lorc/spark-spirit',
      categoryLabel: 'PASSIVE',
      categoryColor: CATEGORY_COLORS.passive,
      subtitle: subtitle ?? (owner ? `${owner.name} Passive` : 'Fighter Passive'),
      what: passive?.text ?? description ?? 'Signature passive ability always active for this fighter.',
      details,
    };
  }

  // 6. Arcana (`arcana:<id>`)
  if (prefix === 'arcana') {
    const arc = ARCANA.find(a => a.id === rawId);
    const details: DamageSourceDetailRow[] = [];
    if (arc) {
      details.push(
        {
          icon: 'lorc/crystal-shine',
          title: 'Boon (Upside)',
          color: TONE.upside,
          text: arc.upside,
        },
        {
          icon: 'lorc/broken-shield',
          title: 'Curse (Tradeoff)',
          color: TONE.tradeoff,
          text: arc.tradeoff,
        }
      );
    }
    return {
      title: arc ? `${arc.numeral} · ${arc.name}` : (name ?? rawId),
      icon: (arc?.icon as IconName | undefined) ?? icon ?? 'caro-asercion/tarot-10-wheel-of-fortune',
      categoryLabel: 'ARCANA',
      categoryColor: CATEGORY_COLORS.arcana,
      subtitle: subtitle ?? arc?.tagline ?? 'Tarot Rule Twist',
      what: arc ? `${arc.upside} Tradeoff: ${arc.tradeoff}` : (description ?? 'Tarot wildcard that twists battle rules with a boon and a tradeoff.'),
      details,
    };
  }

  // 7. Workshop / Run Upgrade (`upgrade:<id>`)
  if (prefix === 'upgrade') {
    const upgrade = UPGRADES.find(u => u.id === rawId);
    const details: DamageSourceDetailRow[] = [];
    if (upgrade) {
      details.push(
        {
          icon: 'lorc/gear-hammer',
          title: 'Tiers',
          color: CATEGORY_COLORS.upgrade,
          text: upgrade.costs.map((_, i) => `Tier ${i + 1}: ${upgrade.description(i + 1)}`).join(' · '),
        },
        {
          icon: 'lorc/light-bulb',
          title: 'Always active',
          color: TONE.upside,
          text: 'Boosts every fight automatically once unlocked in the Camp Workshop or bought during a run.',
        }
      );
    }
    return {
      title: upgrade?.name ?? name ?? rawId,
      icon: (upgrade?.icon as IconName | undefined) ?? icon ?? 'lorc/gear-hammer',
      categoryLabel: 'UPGRADE',
      categoryColor: CATEGORY_COLORS.upgrade,
      subtitle: subtitle ?? 'Workshop Upgrade',
      what: upgrade
        ? `${upgrade.description(1)} per tier — a permanent upgrade that boosts every fight.`
        : (description ?? 'Permanent upgrade that boosts every fight.'),
      details,
    };
  }

  // 8. Combat Mechanics & Special Sources
  if (sourceId === 'bonus:parry') {
    const perfectWin = (PARRY_RULES.perfectWindowMs / 1000).toFixed(1).replace(/\.0$/, '');
    const perfectStagger = Math.round(PARRY_RULES.perfectStaggerMs / 1000);
    return {
      title: name ?? 'Set-Parry Counter',
      icon: icon ?? 'lorc/sword-clash',
      categoryLabel: 'PARRY',
      categoryColor: CATEGORY_COLORS.parry,
      subtitle: subtitle ?? 'Combat Mechanic',
      what: `Matching the foe's telegraphed Counter-Set interrupts their attack, adds +${PARRY_RULES.counterParryFlat} base & ×${PARRY_RULES.counterParryMult} (or +${PARRY_RULES.perfectParryFlat} & ×${PARRY_RULES.perfectParryMult} in the golden Perfect Parry window), and Staggers the foe (+${PARRY_RULES.staggerFlatBonus} & ×${PARRY_RULES.staggerDamageMult}).`,
      details: [
        {
          icon: 'lorc/stopwatch',
          title: 'Perfect Parry',
          color: '#B45309',
          text: `Land the Counter-Set inside the final ${perfectWin}s golden window for +${PARRY_RULES.perfectParryFlat} base, ×${PARRY_RULES.perfectParryMult}, +${PARRY_RULES.perfectParryCoins}¢, +1 Evolution progress tick, and an ${perfectStagger}s Stagger.`,
        },
        {
          icon: 'lorc/sword-clash',
          title: 'Stagger window',
          color: CATEGORY_COLORS.parry,
          text: `While Staggered, follow-up Sets gain +${PARRY_RULES.staggerFlatBonus} base & ×${PARRY_RULES.staggerDamageMult} and stack cleanly with Rainbow, Evolutions, Holo, and Shading Surge.`,
        },
      ],
    };
  }

  if (sourceId === 'bonus:surge') {
    const calmSec = Math.round(SURGE_RULES.calmMs / 1000);
    const surgeSec = Math.round(SURGE_RULES.surgeMs / 1000);
    const warnSec = Math.round(SURGE_RULES.warnMs / 1000);
    return {
      title: name ?? 'Shading Surge',
      icon: icon ?? 'lorc/power-lightning',
      categoryLabel: 'SURGE',
      categoryColor: CATEGORY_COLORS.surge,
      subtitle: subtitle ?? 'Combat Mechanic',
      what: `Every ${calmSec} seconds, Shading Surge adds a 4th trait (shading) for ${surgeSec} seconds, granting +${SURGE_RULES.flatBonus} flat base damage and ×${SURGE_RULES.multiplier} on every Set.`,
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How to play it',
          color: CATEGORY_COLORS.surge,
          text: `Watch for the ${warnSec}-second heads-up warning. Stack a Rainbow Set, Holo card, Parry, or active Weapon Evolution inside Shading Surge for massive spikes.`,
        },
      ],
    };
  }

  if (sourceId === 'bonus:rainbow') {
    return {
      title: name ?? 'Rainbow Strike',
      icon: icon ?? 'lorc/rainbow-star',
      categoryLabel: 'BONUS',
      categoryColor: '#7C3AED',
      subtitle: subtitle ?? 'Combat Mechanic',
      what: 'Sets where all 3 cards differ in every active trait (different shape, color, count, etc.) trigger Rainbow bonuses, Prism synergy, and multipliers.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How to spot it',
          color: '#7C3AED',
          text: 'Pick three cards that share nothing in common. Pairs strongly with Rainbow Charm, Catalyst Prism, Clarity Lens, and Prismatic Fever.',
        },
      ],
    };
  }

  if (sourceId === 'bonus:purity') {
    return {
      title: name ?? 'Purity Chain',
      icon: icon ?? 'lorc/crystal-shine',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.passive,
      subtitle: subtitle ?? 'Combat Mechanic',
      what: 'Escalating across diversity tiers (1-diff → 2-diff → Rainbow) builds a Purity streak that folds escalating flat base damage into your Set before multipliers.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How to chain it',
          color: CATEGORY_COLORS.passive,
          text: 'Step up your Set diversity in consecutive moves so the escalating base damage gets multiplied by Rainbow, Holo, Evolutions, Parry, and Shading Surge.',
        },
      ],
    };
  }

  if (sourceId === 'bonus:traps') {
    return {
      title: name ?? 'Trap Defusal',
      icon: icon ?? 'lorc/checked-shield',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.passive,
      subtitle: subtitle ?? 'Combat Mechanic',
      what: 'Defusing Time Bombs or Snares folds bonus damage straight into BASE before multipliers — Time Bombs hurl at the foe (up to +24 Clutch base under 5s) and feed Hazards synergy.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How to play it',
          color: CATEGORY_COLORS.passive,
          text: 'Clear Time Bombs safely, or dare a Hot (<8s) or Clutch (<5s) defusal to convert enemy hazards into huge multiplied base damage and Hazards stacks.',
        },
      ],
    };
  }

  if (sourceId === 'set:cards') {
    const perCard = BASE_RULES.cardBasePoints;
    return {
      title: name ?? 'Matched Sets',
      icon: icon ?? 'lorc/crossed-swords',
      categoryLabel: 'SETS',
      categoryColor: CATEGORY_COLORS.sets,
      subtitle: subtitle ?? 'Core Damage',
      what: `Base damage from every valid 3-card Set you matched (${perCard} per card = ${perCard * 3} per Set), summed with card bonuses, Synergy hooks, and flat bonuses before multipliers apply.`,
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How Set math works',
          color: CATEGORY_COLORS.sets,
          text: `Every matched card starts at ${perCard} base damage (${perCard * 3} per Set). Power cards, Holo cards, Synergy hooks, and active Evolutions stack into this base before Set multipliers fire.`,
        },
      ],
    };
  }

  if (sourceId === 'set:card_bonus') {
    return {
      title: name ?? 'Power, Holo & Charged Cards',
      icon: icon ?? 'lorc/flat-star',
      categoryLabel: 'CARDS',
      categoryColor: CATEGORY_COLORS.cardBonus,
      subtitle: subtitle ?? 'Board Card Bonus',
      what: `Extra base damage stored on Power cards (+${BASE_RULES.powerCardBonus}), Holo cards (+${BASE_RULES.holoCardBonus} & ×1.2), War Drum charges, and Gamble bonus cards — added into your Set before multipliers.`,
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'Why it hits hard',
          color: CATEGORY_COLORS.cardBonus,
          text: 'Bonus points printed on a card count as base Set damage, so Holo, Active Evolutions, Rainbow, Parry, and Shading Surge multipliers amplify them directly.',
        },
      ],
    };
  }

  // 9. Board FX & Follow-up Effects (`fx:*`)
  if (sourceId === 'fx:burn') {
    return {
      title: name ?? 'Burn Damage',
      icon: icon ?? 'lorc/candle-flame',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.cardBonus,
      subtitle: subtitle ?? 'Board Effect',
      what: 'Burning cards scorch the foe over time as they smolder and break, feeding Burn synergy and inheriting active Set multipliers.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'Tip',
          color: CATEGORY_COLORS.cardBonus,
          text: 'Let burning cards finish on their own while you match fresh Sets — they pay out damage automatically and fuel Burn Synergy hooks.',
        },
      ],
    };
  }

  if (sourceId === 'fx:blast') {
    return {
      title: name ?? 'Explosions',
      icon: icon ?? 'lorc/bright-explosion',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.parry,
      subtitle: subtitle ?? 'Board Effect',
      what: "Explosions shatter neighboring cards around your matched Set, folding every destroyed card's points into your damage and feeding Blast synergy.",
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'Tip',
          color: CATEGORY_COLORS.parry,
          text: 'Sets near the center of the board touch more neighboring cards and produce bigger blasts.',
        },
      ],
    };
  }

  if (sourceId === 'fx:laser') {
    return {
      title: name ?? 'Laser Beams',
      icon: icon ?? 'lorc/lightning-arc',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.skill,
      subtitle: subtitle ?? 'Board Effect',
      what: 'Laser beams sweep across an entire row or column, clearing every card in their path for bonus damage.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'Tip',
          color: CATEGORY_COLORS.skill,
          text: 'Growing the board adds more cards to every row and column laser sweep.',
        },
      ],
    };
  }

  if (sourceId === 'fx:ricochet') {
    return {
      title: name ?? 'Ricochets',
      icon: icon ?? 'lorc/bouncing-sword',
      categoryLabel: 'BONUS',
      categoryColor: '#7C3AED',
      subtitle: subtitle ?? 'Board Effect',
      what: 'Ricochet shards bounce randomly across the board, shattering extra cards and chaining bonus hits into the foe.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'Tip',
          color: '#7C3AED',
          text: 'Each bounce can trigger another bounce and feed extra damage and Blast synergy directly into your combos.',
        },
      ],
    };
  }

  if (sourceId === 'fx:link') {
    return {
      title: name ?? 'Linked Cards',
      icon: icon ?? 'lorc/lightning-branches',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.passive,
      subtitle: subtitle ?? 'Board Effect',
      what: 'Linked cards are tethered in pairs — matching or destroying one pulls its partner down with it for bonus damage and Links synergy.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'Tip',
          color: CATEGORY_COLORS.passive,
          text: 'Look for matching link rings on cards; clearing one side triggers its tethered partner for free.',
        },
      ],
    };
  }

  if (sourceId === 'fx:triggered') {
    return {
      title: name ?? 'Triggered Effects',
      icon: icon ?? 'lorc/bright-explosion',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.bonus,
      subtitle: subtitle ?? 'Combat Effect',
      what: 'Follow-up damage triggered immediately after your Sets by active combat rules, board effects, and item procs.',
      details: [],
    };
  }

  // 10. Named generic combat bonuses & clean fallback
  if (sourceId === 'bonus:arcana') {
    return {
      title: name ?? 'Arcana',
      icon: icon ?? 'caro-asercion/tarot-10-wheel-of-fortune',
      categoryLabel: 'ARCANA',
      categoryColor: CATEGORY_COLORS.arcana,
      subtitle: subtitle ?? 'Combined Tarot Rule Twists',
      what: 'Combined damage bonus from your active Arcana cards. Each Arcana rewrites battle rules with an upside and a tradeoff.',
      details: [],
    };
  }

  if (sourceId === 'bonus:flat') {
    return {
      title: name ?? 'Set Bonuses',
      icon: icon ?? 'lorc/spark-spirit',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.bonus,
      subtitle: subtitle ?? 'Combat Bonus',
      what: 'Flat bonus damage added directly into your Sets before Set multipliers apply.',
      details: [],
    };
  }

  if (sourceId === 'bonus:mult') {
    return {
      title: name ?? 'Set Multipliers',
      icon: icon ?? 'lorc/power-lightning',
      categoryLabel: 'BONUS',
      categoryColor: '#7C3AED',
      subtitle: subtitle ?? 'Combat Multiplier',
      what: 'Combined multiplier bonuses (Holo, Active Evolutions, Rainbow, Parry, Shading Surge) that amplify your matched cards and flat Set damage together.',
      details: [],
    };
  }

  if (sourceId === 'bonus:next_set_boost') {
    return {
      title: name ?? 'Next-Set Boost',
      icon: icon ?? 'lorc/power-lightning',
      categoryLabel: 'BONUS',
      categoryColor: '#7C3AED',
      subtitle: subtitle ?? 'Saved Multiplier',
      what: 'A stored next-Set multiplier charged up by an earlier skill, weapon, or Evolution trigger and cashed in on your next Set.',
      details: [],
    };
  }

  if (sourceId.startsWith('bonus:') && sourceId.endsWith('_weakness')) {
    return {
      title: name ?? 'Foe Weakness',
      icon: icon ?? 'lorc/sword-clash',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.parry,
      subtitle: subtitle ?? 'Foe Vulnerability',
      what: "Bonus vulnerability damage dealt when you exploit this foe's weakness.",
      details: [],
    };
  }

  // Generic fallback keyed off `kind`
  const fallbackCategory =
    kind === 'evolution'
      ? { label: 'EVOLUTION', color: CATEGORY_COLORS.evolution, sub: 'Weapon Evolution' }
      : kind === 'skill'
        ? { label: 'SKILL NODE', color: CATEGORY_COLORS.skill, sub: 'Skill Tree' }
        : kind === 'passive'
          ? { label: 'PASSIVE', color: CATEGORY_COLORS.passive, sub: 'Fighter Passive' }
          : kind === 'set'
            ? { label: 'SETS', color: CATEGORY_COLORS.sets, sub: 'Core Damage' }
            : { label: 'BONUS', color: CATEGORY_COLORS.bonus, sub: 'Combat Mechanic' };

  return {
    title: name ?? (rawId || sourceId),
    icon: icon ?? 'lorc/spark-spirit',
    categoryLabel: fallbackCategory.label,
    categoryColor: fallbackCategory.color,
    subtitle: subtitle ?? fallbackCategory.sub,
    what: description ?? 'Bonus damage contributed during combat alongside your matched Sets and gear.',
    details: [],
  };
};

const DamageSourceExplainer: React.FC<DamageSourceExplainerProps> = ({
  sourceId,
  name,
  kind,
  icon,
  accentColor,
  badge,
  subtitle,
  description,
  result,
  scopeLabel = 'THIS FIGHT',
  defaultOpen = false,
  testID,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const info = resolveDamageSourceCopy({ sourceId, name, kind, icon, subtitle, description });
  const hasMore = info.details.length > 0;

  const medallionBorder = accentColor ?? info.categoryColor;
  const medallionBg = isHex6(medallionBorder) ? `${medallionBorder}1F` : COLORS.paperBeige;
  const barColor = accentColor ?? '#eb6834';

  return (
    <View style={st.card} testID={testID ?? `damage-source-explainer-${sourceId}`}>
      <TouchableOpacity
        disabled={!hasMore}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.85}
        accessibilityRole={hasMore ? 'button' : undefined}
        accessibilityState={hasMore ? { expanded: open } : undefined}
        accessibilityLabel={hasMore ? `${info.title}: ${open ? 'hide' : 'show'} more` : info.title}
        testID={`damage-source-toggle-${sourceId}`}
      >
        <View style={st.head}>
          <View
            style={[
              st.medallion,
              {
                backgroundColor: medallionBg,
                borderColor: medallionBorder,
              },
            ]}
          >
            <Icon name={info.icon} size={24} color={info.categoryColor} />
          </View>
          <View style={st.titleBlock}>
            <View style={st.nameRow}>
              <Text style={st.name} numberOfLines={1}>
                {info.title}
              </Text>
              {badge && <Text style={st.badge}>{badge}</Text>}
            </View>
            <View style={st.tags}>
              <View style={[st.kind, { backgroundColor: info.categoryColor }]}>
                <Text style={st.kindText}>{info.categoryLabel}</Text>
              </View>
              {!!info.subtitle && (
                <Text style={st.subtitle} numberOfLines={1}>
                  {info.subtitle}
                </Text>
              )}
            </View>
          </View>
          {hasMore && <Text style={st.caret}>{open ? '▲' : '▼'}</Text>}
        </View>

        <Text style={st.what} testID={`damage-source-what-${sourceId}`}>
          {info.what}
        </Text>

        {result && (
          <View style={st.result} testID={`damage-source-result-${sourceId}`}>
            <Text style={st.resultLabel}>{scopeLabel}</Text>
            <Text style={st.resultText}>{result.text}</Text>
            {result.share !== undefined && result.share > 0 && (
              <View style={st.track}>
                <View
                  style={[
                    st.bar,
                    {
                      width: `${Math.max(3, Math.min(100, result.share * 100))}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {open && hasMore && (
        <View style={st.more} testID={`damage-source-more-${sourceId}`}>
          {info.details.map((row, idx) => (
            <DetailRow key={`${row.title}-${idx}`} icon={row.icon} title={row.title} color={row.color}>
              {row.text}
            </DetailRow>
          ))}
        </View>
      )}
    </View>
  );
};

const DetailRow: React.FC<{
  icon: IconName;
  title: string;
  color: string;
  children: React.ReactNode;
}> = ({ icon, title, color, children }) => (
  <View style={st.row}>
    <View style={[st.mark, { borderColor: color }]}>
      <Icon name={icon} size={16} color={color} />
    </View>
    <Text style={st.rowText}>
      <Text style={st.rowTitle}>{title}: </Text>
      {children}
    </Text>
  </View>
);

const st = StyleSheet.create({
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: INK,
    borderBottomWidth: 4,
    padding: 12,
    gap: 8,
    width: '100%',
    maxWidth: '100%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  medallion: {
    width: 44,
    height: 44,
    borderRadius: 11,
    borderWidth: 2,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '900',
    color: INK,
  },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    color: INK,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
    flexShrink: 0,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  kind: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  kindText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: COLORS.canvasWhite,
  },
  subtitle: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: INK,
    opacity: 0.65,
  },
  caret: {
    fontSize: 12,
    color: INK,
    opacity: 0.6,
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  what: {
    fontSize: 15,
    lineHeight: 21,
    color: INK,
    marginTop: 8,
    flexShrink: 1,
  },
  result: {
    marginTop: 8,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 8,
    gap: 3,
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: INK,
    opacity: 0.6,
  },
  resultText: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
    flexShrink: 1,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E6E0D7',
    overflow: 'hidden',
    marginTop: 2,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#eb6834',
  },
  more: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E6E0D7',
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minWidth: 0,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.canvasWhite,
    flexShrink: 0,
  },
  rowText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: INK,
  },
  rowTitle: {
    fontWeight: '900',
  },
});

export default DamageSourceExplainer;
