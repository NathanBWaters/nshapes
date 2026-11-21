/**
 * One non-weapon damage source, explained.
 *
 * Shared card matching `WeaponExplainer.tsx`'s exact visual craft for every
 * non-weapon entry in `BattleDamageStory` (Adventure `LevelResults` and
 * Starfall Summit `SpireRewardScreen` / `SpireEndScreen`) and `FightReplay`:
 * Evolutions, Set-Parry Counters, Shading Surge, Rainbow Strike, Purity Chain,
 * Trap Defusal, Skill Tree Nodes, Fighter Passives, Arcana,
 * Workshop Upgrades, Matched Sets, Power Cards, Power Scaling, and Board FX.
 *
 * GUARDRAIL: Weapons MUST NEVER use this component — every weapon description
 * UI goes exclusively through `WeaponExplainer.tsx`.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { ARCANA } from '../data/arcana';
import { FIGHTERS } from '../data/fighters';
import { PARRY_RULES } from '../data/parry';
import { PASSIVES } from '../data/passives';
import { SURGE_RULES } from '../data/rules';
import { UPGRADES } from '../data/upgrades';
import type { DamageSourceKind } from '../engine/damageStory';
import { EVOLUTION_RULES, getRecipe, getSkillNode } from '../engine/sources';
import type { PassiveId } from '../types';
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
  /** Canonical non-weapon source id (`evo:<id>`, `node:<id>`, `passive:<id>`, `arcana:<id>`, `upgrade:<id>`, `bonus:*`, `set:*`, `power:*`, `fx:*`) */
  sourceId: string;
  /** Display name fallback (or override when canonical data is absent) */
  name?: string;
  /** Optional kind hint used for unknown/custom fallback ids */
  kind?: DamageSourceKind;
  /** Icon fallback */
  icon?: IconName;
  /** Accent color from chart/series (tints the 44×44 icon medallion and share bar) */
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
  evolution: '#B45309',
  parry: '#B91C1C',
  surge: '#BE185D',
  skill: '#1D4ED8',
  passive: '#0F766E',
  arcana: TONE.arcana,
  upgrade: '#0369A1',
  sets: INK,
  power: '#C2410C',
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

  // 1. Evolution (`evo:<id>`)
  if (prefix === 'evo') {
    const recipe = getRecipe(rawId);
    const secs = Math.round(EVOLUTION_RULES.durationMs / 1000);
    const universalNote = `Lasts ${secs}s on top of +${EVOLUTION_RULES.startDamage} opening hit, +${EVOLUTION_RULES.setDamage} flat Set damage, and ×${EVOLUTION_RULES.setMultiplier} Set damage.`;
    const details: DamageSourceDetailRow[] = [];
    if (recipe?.familyText) {
      details.push({
        icon: 'lorc/crystal-shine',
        title: 'Recipe pair',
        color: CATEGORY_COLORS.evolution,
        text: recipe.familyText,
      });
    }
    details.push({
      icon: 'lorc/light-bulb',
      title: 'How to trigger',
      color: TONE.upside,
      text: 'Hold both parent items and match a glowing Catalyst card on the board.',
    });
    if (recipe?.flavor) {
      details.push({
        icon: 'lorc/open-book',
        title: 'Lore',
        color: TONE.arcana,
        text: recipe.flavor,
      });
    }
    return {
      title: recipe?.name ?? name ?? rawId,
      icon: (recipe?.icon as IconName | undefined) ?? icon ?? 'lorc/crystal-shine',
      categoryLabel: 'EVOLUTION',
      categoryColor: CATEGORY_COLORS.evolution,
      subtitle: subtitle ?? recipe?.familyText ?? 'Weapon Evolution',
      what: recipe ? `${recipe.activeText} ${universalNote}` : (description ?? universalNote),
      details,
    };
  }

  // 2. Skill Tree Node (`node:<id>`)
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
          color: CATEGORY_COLORS.evolution,
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

  // 3. Fighter Passive (`passive:<id>`)
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
      text: "Always on from the first second of every battle. Power it up through nodes on this fighter's Skill Tree.",
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

  // 4. Arcana (`arcana:<id>`)
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

  // 5. Workshop / Run Upgrade (`upgrade:<id>`)
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

  // 6. Combat Mechanics & Special Sources
  if (sourceId === 'bonus:parry') {
    const perfectWin = (PARRY_RULES.perfectWindowMs / 1000).toFixed(1).replace(/\.0$/, '');
    const perfectStagger = Math.round(PARRY_RULES.perfectStaggerMs / 1000);
    return {
      title: name ?? 'Set-Parry Counter',
      icon: icon ?? 'lorc/sword-clash',
      categoryLabel: 'PARRY',
      categoryColor: CATEGORY_COLORS.parry,
      subtitle: subtitle ?? 'Combat Mechanic',
      what: `Matching the foe's telegraphed Counter-Set interrupts their attack, multiplies that Set by ×${PARRY_RULES.counterParryMult} (or ×${PARRY_RULES.perfectParryMult} in the golden Perfect Parry window), and Staggers the foe so follow-up hits deal ×${PARRY_RULES.staggerDamageMult} damage.`,
      details: [
        {
          icon: 'lorc/stopwatch',
          title: 'Perfect Parry',
          color: CATEGORY_COLORS.evolution,
          text: `Land the Counter-Set inside the final ${perfectWin}s golden window for ×${PARRY_RULES.perfectParryMult} damage, +${PARRY_RULES.perfectParryCoins} coins, and an ${perfectStagger}s Stagger.`,
        },
        {
          icon: 'lorc/sword-clash',
          title: 'Stagger window',
          color: CATEGORY_COLORS.parry,
          text: `While Staggered, follow-up Sets deal ×${PARRY_RULES.staggerDamageMult} damage and stack cleanly with Rainbow, Evolutions, and Shading Surge.`,
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
      what: `Every ${calmSec} seconds, Shading Surge adds a 4th trait (shading) for ${surgeSec} seconds and multiplies every Set's combined damage by ×${SURGE_RULES.multiplier}.`,
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How to play it',
          color: CATEGORY_COLORS.surge,
          text: `Watch for the ${warnSec}-second heads-up warning. Stack a Rainbow Set, Parry, or active Evolution inside Shading Surge for massive spikes.`,
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
      what: 'Sets where all 3 cards differ in every active trait (different shape, color, count, etc.) trigger Rainbow bonuses and multipliers.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How to spot it',
          color: '#7C3AED',
          text: 'Pick three cards that share nothing in common. Pairs strongly with Rainbow Charm, Clarity Lens, and Prismatic Fever.',
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
      what: 'Matching consecutive Sets with the same number of differing traits builds a Purity streak that adds escalating bonus damage into your Set before multipliers.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How to chain it',
          color: CATEGORY_COLORS.passive,
          text: 'Repeat Sets of the same purity tier in a row so the escalating flat bonus gets multiplied by Rainbow, Parry, and Shading Surge.',
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
      what: 'Matching Time Bombs or Snares before they go off defuses them and folds bonus damage straight into your Set before multipliers.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How to play it',
          color: CATEGORY_COLORS.passive,
          text: 'Clear ticking Time Bombs and pointed Snare targets early to protect your hearts and convert enemy hazards into multiplied damage.',
        },
      ],
    };
  }

  if (sourceId === 'set:cards') {
    return {
      title: name ?? 'Matched Sets',
      icon: icon ?? 'lorc/crossed-swords',
      categoryLabel: 'SETS',
      categoryColor: CATEGORY_COLORS.sets,
      subtitle: subtitle ?? 'Core Damage',
      what: 'Base damage from every valid 3-card Set you matched, summed together with all flat bonuses before your multipliers apply.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'How Set math works',
          color: CATEGORY_COLORS.sets,
          text: 'Every matched card starts at 1 base damage (3 per Set). Flat bonuses, Power cards, and collateral cards add into this base before Set multipliers fire.',
        },
      ],
    };
  }

  if (sourceId === 'set:card_bonus') {
    return {
      title: name ?? 'Power & Charged Cards',
      icon: icon ?? 'lorc/flat-star',
      categoryLabel: 'POWER',
      categoryColor: CATEGORY_COLORS.power,
      subtitle: subtitle ?? 'Board Card Bonus',
      what: 'Extra base damage stored on Power cards, War Drum charges, and Gamble bonus cards — added into your Set before multipliers.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'Why it hits hard',
          color: CATEGORY_COLORS.power,
          text: 'Bonus points printed on a card count as base Set damage, so Rainbow, Parry, Evolution, and Shading Surge multipliers amplify them directly.',
        },
      ],
    };
  }

  if (sourceId === 'power:scale') {
    return {
      title: name ?? 'Power Scaling',
      icon: icon ?? 'lorc/power-lightning',
      categoryLabel: 'POWER',
      categoryColor: CATEGORY_COLORS.power,
      subtitle: subtitle ?? 'Adventure Scaling',
      what: "Adventure Mode's in-fight Power meter climbs as your charms trigger, multiplying all damage you deal across the fight.",
      details: [
        {
          icon: 'lorc/power-lightning',
          title: 'How it scales',
          color: CATEGORY_COLORS.power,
          text: 'Every fight starts at ×1.0. Weapon triggers and Evolution bursts raise Power for the rest of the battle, multiplying Sets, blasts, lasers, and burns alike.',
        },
      ],
    };
  }

  // 8. Board FX & Follow-up Effects (`fx:*`)
  if (sourceId === 'fx:burn') {
    return {
      title: name ?? 'Burn Damage',
      icon: icon ?? 'lorc/candle-flame',
      categoryLabel: 'BONUS',
      categoryColor: CATEGORY_COLORS.power,
      subtitle: subtitle ?? 'Board Effect',
      what: 'Burning cards scorch the foe over time as they smolder and break, inheriting your active Set multipliers.',
      details: [
        {
          icon: 'lorc/light-bulb',
          title: 'Tip',
          color: CATEGORY_COLORS.power,
          text: 'Let burning cards finish on their own while you match fresh Sets — they pay out damage automatically.',
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
      what: "Explosions shatter neighboring cards around your matched Set, folding every destroyed card's points into your damage.",
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
          text: 'Each bounce can trigger another bounce and feed extra damage directly into your combos.',
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
      what: 'Linked cards are tethered in pairs — matching or destroying one pulls its partner down with it for bonus damage.',
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

  // 9. Named generic combat bonuses & clean fallback
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
      what: 'Combined multiplier bonuses that amplify your matched cards and flat Set damage together.',
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
            : kind === 'power'
              ? { label: 'POWER', color: CATEGORY_COLORS.power, sub: 'Power Scaling' }
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
