/**
 * One weapon, explained. THE SOLE weapon description card across NShapes
 * (Armory, LevelPreview, In-Fight Inspect, FightReplay, BattleHistory,
 * BattleDamageStory, and every Starfall Summit offer/shop/build screen).
 *
 * Closed: avatar, name/level, kind/role, full-sentence description, 1–3
 * color-coded Synergy Graph tag chips (glowing teal when linked to your belt),
 * and a 1-line Equipped Evolution bar.
 * Expanded (or inline when `showEvolutionsWhenClosed`): 1-of-3 Per-Weapon Timed
 * Evolution radio selector (1-tap equip + audio motif + locked Bounty jump),
 * Synergy scaling hooks, 2s animated `WeaponDemoClip`, play tips, numbers, and
 * instrument audition.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { band, sfx } from '@/audio';
import { INSTRUMENT_NAMES } from '@/audio/instruments';
import { weaponVoice } from '@/audio/voices';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Weapon } from '@/types';
import { useColorblind } from '@/utils/cardColors';
import { COLORS } from '@/utils/colors';
import { EASE, MS, SCALE, SPRING } from '@/utils/motion';
import { scaleText, useTextScale } from '@/utils/textSizeStorage';
import type { SynergyAttrId } from '../types';
import { armoryBaseWeapon, weaponLevelSuffix } from '../data/armory';
import { WEAPON_KINDS, weaponGuide } from '../data/weaponGuide';
import { NO_GROWTH, WEAPON_GROWTH, growthKey, growthText, type GrowthState } from '../data/weaponGrowth';
import { WEAPON_ROLES, weaponRole } from '../data/weaponRoles';
import { BASE_BUILD, formatStat, weaponStatLines, type WeaponBuild } from '../data/weaponStats';
import { bracketParam } from '../data/weapons/schema';
import type { ActiveWeaponCounter } from '../engine/fight';
import {
  buildWeaponEvolutionsForWeapon,
  buildWeaponSynergyHookLines,
  buildWeaponSynergyTags,
  type EvolutionLiveStateVM,
  type HintSaveContext,
  type WeaponEvolutionVM,
} from '../ui/evolutionViewModel';
import { SYNERGY_ATTR_META } from '../ui/synergyMeta';
import { INK } from './ui';
import WeaponDemoClip from './WeaponDemoClip';

export type WeaponExplainerEvoMode = 'select' | 'live' | 'preview' | 'none';

export interface WeaponExplainerProps {
  weapon: Weapon;
  /** Level and tuning, for the numbers (defaults to level 1, untuned) */
  build?: WeaponBuild;
  /** A small label on the right of the name: "Equipped", "Preview"… */
  badge?: string;
  /** After a fight: what it did, in words, and its share of the damage (0..1) for the bar */
  result?: { text: string; share?: number };
  /** In a fight: how far the weapon has grown so far */
  growth?: GrowthState;
  /** Optional active enemy counter dampening this weapon right now */
  counter?: ActiveWeaponCounter;
  /** Start with "more" open */
  defaultOpen?: boolean;
  /**
   * How per-weapon timed evolutions render inside this card:
   * - `'select'`: Camp Armory / LevelPreview / SpireBuildModal (1-tap radio equip among 3 evos)
   * - `'live'`: In-fight weapon inspect (live condition progress, active timer, trigger count)
   * - `'preview'`: Read-only equipped + 3-evo peek (Spire offers, FightReplay, BattleHistory)
   * - `'none'`: Hide evolution section (e.g., early tutorial before evolutions unlock)
   */
  evolutionMode?: WeaponExplainerEvoMode;
  /** Equipped evolution ID for this weapon */
  equippedEvolutionId?: string | null;
  /** Unlocked evolution IDs for this weapon (Adventure save `unlockedWeaponEvolutions`) */
  unlockedEvolutionIds?: readonly string[];
  /** Treat all 3 evolutions for this weapon as unlocked (e.g., Starfall Summit / sandbox) */
  allEvolutionsUnlocked?: boolean;
  /** Live in-fight evolution tracker when `evolutionMode === 'live'` */
  liveEvolution?: EvolutionLiveStateVM | null;
  /** Called immediately on 1-tap selection of an unlocked evolution in `'select'` mode */
  onSelectEvolution?: (weaponId: string, evolutionId: string) => void;
  /** Called when tapping a locked evolution's Bounty unlock pill */
  onJumpToBounty?: (bountyId: string) => void;
  /** Synergy attributes active on OTHER belt weapons so matching tags glow teal */
  beltSynergyIds?: ReadonlySet<SynergyAttrId>;
  /** Render the 1-of-3 evolution picker immediately even while "more" details are collapsed */
  showEvolutionsWhenClosed?: boolean;
  /** Workshop Evolution Lab tier (+2s per tier shown on duration chips) */
  evolutionLabTier?: number;
  /** Optional Adventure save context for contextual unlock hints */
  saveContext?: HintSaveContext;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const roleLabel = (id: string) => WEAPON_ROLES.find(r => r.id === weaponRole(id))?.label ?? '';

const WeaponExplainer: React.FC<WeaponExplainerProps> = ({
  weapon,
  build = BASE_BUILD,
  badge,
  result,
  growth,
  counter,
  defaultOpen = false,
  evolutionMode = 'preview',
  equippedEvolutionId,
  unlockedEvolutionIds,
  allEvolutionsUnlocked = false,
  liveEvolution,
  onSelectEvolution,
  onJumpToBounty,
  beltSynergyIds,
  showEvolutionsWhenClosed = false,
  evolutionLabTier = 0,
  saveContext,
  style,
  testID,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [taps, setTaps] = useState(0);
  const textScale = useTextScale();
  const colorblind = useColorblind();
  const reducedMotion = useReducedMotion();

  const guide = weaponGuide(weapon.id);
  const kind = WEAPON_KINDS[guide.kind];
  const base = armoryBaseWeapon(weapon.id);
  const stats = base ? weaponStatLines(base, build) : [];
  const voice = weaponVoice(weapon.id);
  const grows = WEAPON_GROWTH[weapon.id] ?? [];

  const synergyTags = useMemo(
    () => buildWeaponSynergyTags(weapon.id, build.level, beltSynergyIds),
    [weapon.id, build.level, beltSynergyIds]
  );

  const synergyHooks = useMemo(
    () => buildWeaponSynergyHookLines(weapon.id, build.level, beltSynergyIds),
    [weapon.id, build.level, beltSynergyIds]
  );

  const evoSummary = useMemo(
    () =>
      evolutionMode === 'none'
        ? null
        : buildWeaponEvolutionsForWeapon(weapon.id, {
            equippedEvolutionId,
            unlockedEvolutionIds,
            allUnlocked: allEvolutionsUnlocked || (evolutionMode === 'preview' && unlockedEvolutionIds === undefined),
            colorblind,
            save: saveContext,
            labTier: evolutionLabTier,
          }),
    [
      evolutionMode,
      weapon.id,
      equippedEvolutionId,
      unlockedEvolutionIds,
      allEvolutionsUnlocked,
      colorblind,
      saveContext,
      evolutionLabTier,
    ]
  );

  const hasEvolutions = Boolean(evoSummary && evoSummary.options.length > 0);
  const showFullSelect = evolutionMode === 'select' && hasEvolutions && (open || showEvolutionsWhenClosed);
  const showLivePanel = evolutionMode === 'live' && Boolean(liveEvolution);
  const showClosedEvoBar =
    evolutionMode !== 'none' &&
    hasEvolutions &&
    !showFullSelect &&
    !showLivePanel;

  const handleEquipEvolution = (evo: WeaponEvolutionVM) => {
    sfx('confirm');
    if (typeof band?.auditionEvolution === 'function') {
      band.auditionEvolution(evo.id);
    }
    onSelectEvolution?.(weapon.id, evo.id);
  };

  return (
    <View style={[st.card, style]} testID={testID ?? `weapon-explainer-${weapon.id}`}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.85}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${weapon.name}: ${open ? 'hide' : 'show'} more`}
        testID={`weapon-explainer-toggle-${weapon.id}`}
      >
        <View style={st.head}>
          <WeaponAvatar weapon={weapon} size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View style={st.nameRow}>
              <Text style={[st.name, { fontSize: scaleText(16, textScale) }]} numberOfLines={1}>
                {weapon.name}{weaponLevelSuffix(build.level)}
              </Text>
              {badge && <Text style={st.badge}>{badge}</Text>}
            </View>
            <View style={st.tags}>
              <View style={[st.kind, { backgroundColor: kind.color }]}>
                <Text style={st.kindText}>{kind.label.toUpperCase()}</Text>
              </View>
              <Text style={[st.role, { fontSize: scaleText(11, textScale) }]} numberOfLines={1}>
                {roleLabel(weapon.id)}
              </Text>
            </View>
          </View>
          <Text style={st.caret}>{open ? '▲' : '▼'}</Text>
        </View>

        <Text
          style={[
            st.what,
            {
              fontSize: scaleText(15, textScale),
              lineHeight: Math.round(scaleText(15, textScale) * 1.4),
            },
          ]}
          testID={`weapon-explainer-what-${weapon.id}`}
        >
          {weapon.description}
        </Text>

        {/* 1–3 Color-Coded Synergy Graph Tag Chips (teal highlight when matching belt) */}
        {synergyTags.length > 0 && (
          <View style={st.synergyStrip} testID={`weapon-explainer-synergy-${weapon.id}`}>
            {synergyTags.map(tag => (
              <View
                key={tag.id}
                testID={`weapon-synergy-chip-${weapon.id}-${tag.id}`}
                accessibilityLabel={`${tag.roleLabel} ${tag.label}${tag.beltMatch ? ', matches your belt' : ''}`}
                style={[
                  st.synergyChip,
                  { backgroundColor: tag.paleBg, borderColor: tag.beltMatch ? COLORS.logicTeal : tag.color },
                  tag.beltMatch && st.synergyChipMatch,
                ]}
              >
                <Text style={[st.synergyGlyph, { color: tag.color }]}>{tag.glyph}</Text>
                <Icon name={tag.icon} size={11} color={tag.color} noShadow />
                <Text style={[st.synergyChipLabel, { color: INK }]} numberOfLines={1}>
                  {tag.label}
                </Text>
                {tag.beltMatch && (
                  <Icon name="delapouite/sparkles" size={10} color={COLORS.logicTeal} noShadow />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Closed 1-line Equipped Evolution summary bar */}
        {showClosedEvoBar && evoSummary && (
          <View
            style={[
              st.closedEvoBar,
              evoSummary.equipped ? st.closedEvoBarArmed : st.closedEvoBarLocked,
            ]}
            testID={`weapon-explainer-evo-summary-${weapon.id}`}
          >
            <Icon
              name={evoSummary.equipped ? 'lorc/crystal-shine' : 'lorc/padlock'}
              size={13}
              color={evoSummary.equipped ? '#7C3AED' : '#78716C'}
              noShadow
            />
            {evoSummary.equipped ? (
              <Text style={st.closedEvoText} numberOfLines={1}>
                <Text style={st.closedEvoName}>EVO: {evoSummary.equipped.name}</Text>
                {` · ${evoSummary.equipped.conditionShort} · ${evoSummary.equipped.durationSec}s`}
              </Text>
            ) : (
              <Text style={st.closedEvoLockedText} numberOfLines={1}>
                0/3 Evolutions — Unlock via Bounties
              </Text>
            )}
            {evolutionMode === 'select' && (
              <Text style={st.closedEvoSwitch}>
                {evoSummary.unlockedCount > 0 ? `Switch (${evoSummary.unlockedCount}/3)` : 'View 3'}
              </Text>
            )}
          </View>
        )}

        {counter && (
          <View style={st.counterAlert} testID={`weapon-explainer-counter-${weapon.id}`}>
            <Icon name="lorc/broken-shield" size={14} color="#B91C1C" />
            <Text style={[st.counterAlertText, { fontSize: scaleText(12, textScale) }]}>
              Foe counter (−{counter.reduction}%): {counter.label} reduced from {counter.baseChance}% to {counter.effectiveChance}%.
            </Text>
          </View>
        )}

        {result && (
          <View style={st.result} testID={`weapon-explainer-result-${weapon.id}`}>
            <Text style={st.resultLabel}>THIS FIGHT</Text>
            <Text style={[st.resultText, { fontSize: scaleText(14, textScale) }]}>{result.text}</Text>
            {result.share !== undefined && result.share > 0 && (
              <View style={st.track}>
                <View style={[st.bar, { transform: [{ scaleX: Math.max(0.03, Math.min(1, result.share)) }] }]} />
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* In-Fight Live Evolution Status Panel (read-only; zero switcher mid-combat) */}
      {showLivePanel && liveEvolution && (
        <LiveEvolutionCard live={liveEvolution} textScale={textScale} />
      )}

      {/* Interactive 1-of-3 Evolution Radio Selector (Camp Armory / LevelPreview / SpireBuildModal) */}
      {showFullSelect && evoSummary && (
        <View style={st.evoSection} testID={`weapon-explainer-evo-selector-${weapon.id}`}>
          <View style={st.evoSectionHead}>
            <Icon name="lorc/crystal-shine" size={14} color="#7C3AED" noShadow />
            <Text style={st.evoSectionTitle} numberOfLines={1}>EVOLUTION (1 OF 3)</Text>
            <View style={st.evoCountPill}>
              <Text style={st.evoCountText}>{evoSummary.unlockedCount}/3</Text>
            </View>
          </View>
          <Text style={st.evoChassisNote}>
            Ignite in-fight for +18 burst, +8 base dmg &amp; +0.2× mult (re-triggerable).
          </Text>
          <View style={st.evoOptionList}>
            {evoSummary.options.map(opt => {
              const isUnlocked = evoSummary.unlockedSet.has(opt.id);
              const isEquipped = evoSummary.equippedId === opt.id;
              return (
                <EvoOptionCard
                  key={opt.id}
                  option={opt}
                  unlocked={isUnlocked}
                  equipped={isEquipped}
                  interactive={Boolean(onSelectEvolution)}
                  reduced={reducedMotion}
                  textScale={textScale}
                  onSelect={() => handleEquipEvolution(opt)}
                  onJumpToBounty={
                    opt.unlockBountyId && onJumpToBounty
                      ? () => {
                          sfx('click');
                          onJumpToBounty(opt.unlockBountyId!);
                        }
                      : undefined
                  }
                />
              );
            })}
          </View>
        </View>
      )}

      {open && (
        <View style={st.more} testID={`weapon-explainer-more-${weapon.id}`}>
          {/* Read-only Evolution preview inside expanded details (Spire offers / FightReplay / History) */}
          {evolutionMode === 'preview' && evoSummary && evoSummary.options.length > 0 && (
            <View style={st.evoSection} testID={`weapon-explainer-evo-preview-${weapon.id}`}>
              <View style={st.evoSectionHead}>
                <Icon name="lorc/crystal-shine" size={14} color="#7C3AED" noShadow />
                <Text style={st.evoSectionTitle} numberOfLines={1}>
                  EVOLUTIONS ({evoSummary.options.length})
                </Text>
              </View>
              <View style={st.evoOptionList}>
                {evoSummary.options.map(opt => (
                  <EvoOptionCard
                    key={opt.id}
                    option={opt}
                    unlocked={evoSummary.unlockedSet.has(opt.id)}
                    equipped={evoSummary.equippedId === opt.id}
                    interactive={false}
                    reduced={reducedMotion}
                    textScale={textScale}
                  />
                ))}
              </View>
            </View>
          )}

          <WeaponDemoClip weaponId={weapon.id} />

          {/* Synergy Scaling Hooks (replaces legacy global Power scaling) */}
          {(synergyHooks.length > 0 || grows.length > 0 || Boolean(NO_GROWTH[weapon.id])) && (
            <View style={st.scalingBox} testID={`weapon-explainer-scaling-${weapon.id}`}>
              <View style={st.scalingHead}>
                <Icon name="lorc/tree-branch" size={14} color="#0F766E" noShadow />
                <Text style={st.scalingTitle} numberOfLines={1}>SYNERGY SCALING</Text>
              </View>
              {synergyHooks.map(hook => (
                <View key={hook.id} style={st.hookLine}>
                  <View
                    style={[
                      st.hookBadge,
                      {
                        backgroundColor: hook.paleBg,
                        borderColor: hook.beltMatch ? COLORS.logicTeal : hook.color,
                      },
                    ]}
                  >
                    <Text style={[st.hookBadgeText, { color: hook.color }]}>
                      {hook.glyph} {hook.label}
                    </Text>
                  </View>
                  <Text
                    style={[
                      st.hookText,
                      {
                        fontSize: scaleText(13, textScale),
                        lineHeight: Math.round(scaleText(13, textScale) * 1.38),
                      },
                    ]}
                  >
                    {hook.summary}
                  </Text>
                </View>
              ))}
              {(grows.length > 0 || Boolean(NO_GROWTH[weapon.id])) && (
                <Text
                  style={[
                    st.growthText,
                    {
                      fontSize: scaleText(12.5, textScale),
                      lineHeight: Math.round(scaleText(12.5, textScale) * 1.38),
                    },
                  ]}
                >
                  <Text style={st.rowTitle}>In-fight growth: </Text>
                  {grows.length === 0
                    ? NO_GROWTH[weapon.id]
                    : grows
                        .map((def, i) => {
                          const stacks = growth?.[growthKey(weapon.id, i)]?.stacks ?? 0;
                          return `${growthText(def)}${stacks > 0 ? ` Now: ${stacks}${def.max ? `/${def.max}` : ''}.` : ''}`;
                        })
                        .join(' ')}
                </Text>
              )}
            </View>
          )}

          <Row icon="lorc/crystal-shine" title={kind.label} color={kind.color} textScale={textScale}>
            {kind.blurb}
          </Row>

          {guide.look && (
            <View style={st.row}>
              <View style={[st.mark, { borderColor: guide.look.color ?? INK }]}>
                <Icon name={guide.look.icon ?? 'lorc/magnifying-glass'} size={16} color={guide.look.color ?? INK} />
              </View>
              <Text
                style={[
                  st.rowText,
                  {
                    fontSize: scaleText(14, textScale),
                    lineHeight: Math.round(scaleText(14, textScale) * 1.42),
                  },
                ]}
              >
                <Text style={st.rowTitle}>Look for: </Text>
                {guide.look.text}
              </Text>
            </View>
          )}

          {!!guide.tip && (
            <Row icon="lorc/light-bulb" title="How to play it" color="#B45309" textScale={textScale}>
              {guide.tip}
            </Row>
          )}

          {stats.length > 0 && (
            <View style={st.numbers}>
              {stats.map(line => (
                <View
                  key={line.key}
                  style={st.number}
                  accessibilityLabel={`${bracketParam(line.label)} ${formatStat(line.unit, line.value)}`}
                >
                  <View style={st.numberHead}>
                    <Text style={[st.numberValue, { fontSize: scaleText(16, textScale) }]}>
                      {formatStat(line.unit, line.value)}
                    </Text>
                    {line.tier > 0 && <Text style={st.tierTag}>{`T${line.tier}`}</Text>}
                  </View>
                  <Text style={[st.numberLabel, { fontSize: scaleText(11, textScale) }]}>{line.label}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={() => {
              setTaps(t => t + 1);
              band.audition(weapon.id);
            }}
            style={st.sound}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Hear ${weapon.name}`}
            testID={`weapon-explainer-sound-${weapon.id}`}
          >
            <Icon name="delapouite/sound-on" size={16} color={INK} />
            <Text
              style={[
                st.rowText,
                {
                  fontSize: scaleText(14, textScale),
                  lineHeight: Math.round(scaleText(14, textScale) * 1.42),
                },
              ]}
            >
              <Text style={st.rowTitle}>{taps > 0 ? 'Playing: ' : 'Hear it: '}</Text>
              {INSTRUMENT_NAMES[voice.inst]}. {voice.why}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/** One of the 3 radio-selectable Evolution cards inside `WeaponExplainer`. */
const EvoOptionCard: React.FC<{
  option: WeaponEvolutionVM;
  unlocked: boolean;
  equipped: boolean;
  interactive: boolean;
  reduced: boolean;
  textScale: number;
  onSelect?: () => void;
  onJumpToBounty?: () => void;
}> = ({ option, unlocked, equipped, interactive, reduced, textScale, onSelect, onJumpToBounty }) => {
  const prevEquipped = useRef(equipped);
  const popScale = useSharedValue(1);

  useEffect(() => {
    if (equipped && !prevEquipped.current && !reduced) {
      popScale.value = withSequence(
        withTiming(SCALE.pop, { duration: MS.feedback, easing: EASE.pop }),
        withSpring(1, SPRING.snappy)
      );
    }
    prevEquipped.current = equipped;
  }, [equipped, reduced, popScale]);

  useEffect(() => () => cancelAnimation(popScale), [popScale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: popScale.value }],
  }));

  const canEquip = interactive && unlocked && !equipped && Boolean(onSelect);

  const cardBody = (
    <View
      style={[
        st.evoCard,
        equipped && st.evoCardActive,
        !unlocked && st.evoCardLocked,
      ]}
    >
      <View style={st.evoCardTop}>
        <View
          style={[
            st.evoIconBox,
            equipped && { backgroundColor: COLORS.actionYellow, borderColor: INK },
            !unlocked && { backgroundColor: '#EAE4DA', borderColor: '#A8A29E' },
          ]}
        >
          <Icon
            name={unlocked ? option.icon : 'lorc/padlock'}
            size={16}
            color={unlocked ? INK : '#78716C'}
            noShadow
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <View style={st.evoTitleRow}>
            <Text
              style={[st.evoName, !unlocked && st.evoNameLocked, { fontSize: scaleText(13.5, textScale) }]}
              numberOfLines={1}
            >
              {option.name}
            </Text>
            <Text style={st.evoSlotPill}>{option.slotLabel}</Text>
          </View>
          <View style={st.evoMetaRow}>
            <Icon name="lorc/archery-target" size={11} color={unlocked ? '#6D28D9' : '#78716C'} noShadow />
            <Text style={[st.evoCond, !unlocked && st.evoTextMuted]} numberOfLines={2}>
              {option.conditionFull}
            </Text>
          </View>
        </View>
        <View style={st.evoRightCol}>
          {equipped ? (
            <View style={st.evoActiveBadge} testID={`evo-active-${option.id}`}>
              <Text style={st.evoActiveText}>ACTIVE</Text>
            </View>
          ) : canEquip ? (
            <View style={st.evoSelectPill}>
              <Text style={st.evoSelectText}>EQUIP</Text>
            </View>
          ) : !unlocked ? (
            <Text style={st.evoLockedTag}>LOCKED</Text>
          ) : null}
          <View style={st.evoDurRow}>
            <Icon name="lorc/stopwatch" size={10} color={INK} noShadow />
            <Text style={st.evoDurText}>{option.durationSec}s</Text>
          </View>
        </View>
      </View>

      <Text
        style={[
          st.evoEffect,
          !unlocked && st.evoTextMuted,
          { fontSize: scaleText(12, textScale), lineHeight: Math.round(scaleText(12, textScale) * 1.38) },
        ]}
      >
        {option.effectText}
      </Text>

      {option.synergyTags.length > 0 && (
        <View style={st.evoSynergyRow}>
          {option.synergyTags.map(attr => {
            const meta = SYNERGY_ATTR_META[attr];
            return (
              <View key={attr} style={[st.evoSynPill, { backgroundColor: meta.paleBg, borderColor: meta.color }]}>
                <Icon name={meta.icon} size={9} color={meta.color} noShadow />
                <Text style={[st.evoSynText, { color: INK }]}>{meta.label}</Text>
              </View>
            );
          })}
        </View>
      )}

      {!unlocked && (option.unlockBountyTitle || option.unlockHintText) && (
        onJumpToBounty ? (
          <TouchableOpacity
            testID={`evo-bounty-jump-${option.id}`}
            onPress={onJumpToBounty}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`View bounty to unlock ${option.name}`}
            style={st.bountyJumpPill}
          >
            <Icon name="lorc/trophy" size={11} color="#92400E" noShadow />
            <Text style={st.bountyJumpText} numberOfLines={1}>
              {option.unlockBountyTitle
                ? `Unlock via Bounty: ${option.unlockBountyTitle}`
                : option.unlockHintText}
            </Text>
            <Text style={st.bountyJumpArrow}>›</Text>
          </TouchableOpacity>
        ) : (
          <View style={st.bountyHintRow}>
            <Icon name="lorc/trophy" size={11} color="#78716C" noShadow />
            <Text style={st.bountyHintText} numberOfLines={2}>
              {option.unlockHintText ?? `Unlock via Bounty: ${option.unlockBountyTitle}`}
            </Text>
          </View>
        )
      )}
    </View>
  );

  if (interactive && unlocked && onSelect) {
    return (
      <Animated.View style={animStyle}>
        <TouchableOpacity
          testID={`evo-option-${option.id}`}
          onPress={onSelect}
          activeOpacity={0.85}
          accessibilityRole="radio"
          accessibilityState={{ checked: equipped }}
          accessibilityLabel={`${option.name} evolution: ${option.conditionFull}. ${equipped ? 'Active' : 'Tap to equip'}`}
        >
          {cardBody}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animStyle} testID={`evo-option-${option.id}`}>
      {cardBody}
    </Animated.View>
  );
};

/** Read-only in-fight live Evolution status block (`evolutionMode="live"`). */
const LiveEvolutionCard: React.FC<{ live: EvolutionLiveStateVM; textScale: number }> = ({ live, textScale }) => {
  const ratio =
    live.phase === 'active'
      ? Math.max(0, Math.min(1, live.activeRemainingMs / live.activeDurationMs))
      : live.phase === 'cooldown'
        ? Math.max(0, Math.min(1, live.cooldownRemainingMs / 3000))
        : Math.max(0, Math.min(1, live.progress / live.target));
  const secsLeft = Math.ceil((live.phase === 'active' ? live.activeRemainingMs : live.cooldownRemainingMs) / 1000);

  const badgeText =
    live.phase === 'active'
      ? `ACTIVE · ${secsLeft}s`
      : live.phase === 'cooldown'
        ? `COOLING · ${secsLeft}s`
        : live.almostReady
          ? `ALMOST! ${live.progress}/${live.target}`
          : `${live.progress}/${live.target}`;

  return (
    <View
      testID={`weapon-explainer-live-evo-${live.weaponId}`}
      style={[
        st.liveEvoCard,
        live.phase === 'active' && st.liveEvoActive,
        live.phase === 'charging' && live.almostReady && st.liveEvoAlmost,
      ]}
    >
      <View style={st.liveEvoHead}>
        <Icon name={live.icon} size={16} color={INK} noShadow />
        <Text style={[st.evoName, { fontSize: scaleText(13.5, textScale) }]} numberOfLines={1}>
          {live.evolutionName}
        </Text>
        <View
          style={[
            st.liveEvoPill,
            live.phase === 'active' && { backgroundColor: COLORS.actionYellow },
            live.phase === 'charging' && live.almostReady && { backgroundColor: '#FDE68A' },
          ]}
        >
          <Text style={st.liveEvoPillText}>{badgeText}</Text>
        </View>
      </View>
      <Text style={[st.evoCond, { fontSize: scaleText(12, textScale) }]}>
        Trigger: {live.conditionFull}
      </Text>
      <View style={st.liveTrack}>
        <View
          style={[
            st.liveFill,
            {
              backgroundColor:
                live.phase === 'active'
                  ? live.activeRemainingMs <= 5000
                    ? COLORS.impactRed
                    : '#7C3AED'
                  : live.phase === 'cooldown'
                    ? '#94A3B8'
                    : live.almostReady
                      ? '#D97706'
                      : '#7C3AED',
              transform: [{ scaleX: Math.max(0.02, ratio) }],
            },
          ]}
        />
      </View>
      <Text style={[st.evoEffect, { fontSize: scaleText(12, textScale) }]}>{live.effectText}</Text>
      {live.triggersThisFight > 0 && (
        <Text style={st.liveCountText}>
          Triggered {live.triggersThisFight}× this fight · +8 base &amp; +0.2× mult while active
        </Text>
      )}
    </View>
  );
};

const Row: React.FC<{
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  color: string;
  textScale: number;
  children: React.ReactNode;
}> = ({ icon, title, color, textScale, children }) => (
  <View style={st.row}>
    <View style={[st.mark, { borderColor: color }]}>
      <Icon name={icon} size={16} color={color} />
    </View>
    <Text
      style={[
        st.rowText,
        {
          fontSize: scaleText(14, textScale),
          lineHeight: Math.round(scaleText(14, textScale) * 1.42),
        },
      ]}
    >
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
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: '900', color: INK },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: INK,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kind: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  kindText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, color: COLORS.canvasWhite },
  role: { flexShrink: 1, fontSize: 11, fontWeight: '600', color: INK, opacity: 0.65 },
  caret: { fontSize: 12, color: INK, opacity: 0.6, paddingHorizontal: 4 },
  what: { fontSize: 15, lineHeight: 21, color: INK, marginTop: 6 },

  // Synergy tag chips
  synergyStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  synergyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  synergyChipMatch: { borderWidth: 2 },
  synergyGlyph: { fontSize: 11, fontWeight: '900' },
  synergyChipLabel: { flexShrink: 1, fontSize: 11, fontWeight: '800' },

  // Closed 1-line equipped evolution bar
  closedEvoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  closedEvoBarArmed: { backgroundColor: '#FAF5FF', borderColor: '#C4B5FD' },
  closedEvoBarLocked: { backgroundColor: COLORS.paperBeige, borderColor: '#D6CFC4' },
  closedEvoText: { flex: 1, flexShrink: 1, fontSize: 11.5, fontWeight: '700', color: INK },
  closedEvoName: { fontWeight: '900', color: '#5B21B6' },
  closedEvoLockedText: { flex: 1, flexShrink: 1, fontSize: 11.5, fontWeight: '700', color: '#78716C' },
  closedEvoSwitch: { fontSize: 11, fontWeight: '900', color: '#6D28D9' },

  // 1-of-3 Evolution Selector
  evoSection: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#E6E0D7',
    paddingTop: 8,
  },
  evoSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  evoSectionTitle: { flex: 1, flexShrink: 1, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, color: '#5B21B6' },
  evoCountPill: {
    backgroundColor: '#F3E8FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C4B5FD',
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  evoCountText: { fontSize: 11, fontWeight: '900', color: '#5B21B6', fontVariant: ['tabular-nums'] },
  evoChassisNote: { fontSize: 11, fontWeight: '600', color: INK, opacity: 0.72 },
  evoOptionList: { gap: 6 },
  evoCard: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C5BCB0',
    padding: 8,
    gap: 5,
  },
  evoCardActive: {
    backgroundColor: '#FFFBEB',
    borderColor: INK,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  evoCardLocked: {
    backgroundColor: COLORS.paperBeige,
    borderColor: '#B8B0A4',
    borderStyle: 'dashed',
  },
  evoCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  evoIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  evoName: { flexShrink: 1, fontSize: 13.5, fontWeight: '900', color: INK },
  evoNameLocked: { color: '#57534E' },
  evoSlotPill: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: '#6D28D9',
    backgroundColor: '#F3E8FF',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  evoMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  evoCond: { flex: 1, flexShrink: 1, fontSize: 11.5, fontWeight: '800', color: '#4C1D95' },
  evoTextMuted: { color: '#78716C' },
  evoRightCol: { alignItems: 'flex-end', gap: 3 },
  evoActiveBadge: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  evoActiveText: { fontSize: 11, fontWeight: '900', color: INK, letterSpacing: 0.4 },
  evoSelectPill: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  evoSelectText: { fontSize: 11, fontWeight: '900', color: INK, letterSpacing: 0.4 },
  evoLockedTag: { fontSize: 11, fontWeight: '900', color: '#78716C', letterSpacing: 0.4 },
  evoDurRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  evoDurText: { fontSize: 11, fontWeight: '800', color: INK, opacity: 0.72, fontVariant: ['tabular-nums'] },
  evoEffect: { fontSize: 12, fontWeight: '700', color: INK, lineHeight: 16.5 },
  evoSynergyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  evoSynPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  evoSynText: { fontSize: 11, fontWeight: '800' },
  bountyJumpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 5,
    minHeight: 32,
  },
  bountyJumpText: { flex: 1, flexShrink: 1, fontSize: 11, fontWeight: '800', color: '#92400E' },
  bountyJumpArrow: { fontSize: 14, fontWeight: '900', color: '#92400E' },
  bountyHintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2 },
  bountyHintText: { flex: 1, flexShrink: 1, fontSize: 11, fontWeight: '700', color: '#78716C' },

  // Live in-fight inspect evolution panel
  liveEvoCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#7C3AED',
    padding: 9,
    gap: 5,
  },
  liveEvoActive: { backgroundColor: '#FFFBEB', borderColor: INK },
  liveEvoAlmost: { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
  liveEvoHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveEvoPill: {
    marginLeft: 'auto',
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  liveEvoPillText: { fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  liveTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E5DFD5',
    overflow: 'hidden',
  },
  liveFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    transformOrigin: 'left center',
  },
  liveCountText: { fontSize: 11, fontWeight: '800', color: '#5B21B6' },

  // Synergy Scaling Hooks box (expanded)
  scalingBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0F766E',
    padding: 9,
    gap: 6,
  },
  scalingHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scalingTitle: { flex: 1, flexShrink: 1, fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#0F766E' },
  hookLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  hookBadge: {
    borderRadius: 6,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 1,
  },
  hookBadgeText: { fontSize: 11, fontWeight: '900' },
  hookText: { flex: 1, flexShrink: 1, fontSize: 13, fontWeight: '700', color: INK },
  growthText: { fontSize: 12.5, color: INK, opacity: 0.88, paddingTop: 2 },

  counterAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  counterAlertText: { flex: 1, flexShrink: 1, fontSize: 12, lineHeight: 17, fontWeight: '800', color: '#991B1B' },
  result: { marginTop: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8, gap: 3 },
  resultLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3, color: INK, opacity: 0.65 },
  resultText: { fontSize: 14, fontWeight: '700', color: INK },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E6E0D7', overflow: 'hidden', marginTop: 2 },
  bar: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#eb6834', transformOrigin: 'left center' },
  more: { gap: 10, borderTopWidth: 1, borderTopColor: '#E6E0D7', paddingTop: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.canvasWhite,
  },
  rowText: { flex: 1, flexShrink: 1, fontSize: 14, lineHeight: 20, color: INK },
  rowTitle: { fontWeight: '900' },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  number: { backgroundColor: COLORS.paperBeige, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 92 },
  numberHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  numberValue: { fontSize: 16, fontWeight: '900', color: INK },
  tierTag: {
    fontSize: 11,
    fontWeight: '900',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  numberLabel: { fontSize: 11, color: INK, opacity: 0.7 },
  sound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 10,
    minHeight: 44,
  },
});

export default WeaponExplainer;
