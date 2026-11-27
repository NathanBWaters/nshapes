/**
 * The weapons you are holding, as a row in the fight HUD.
 *
 * Each slot renders:
 * - The weapon avatar + tap-to-inspect (pauses fight) + bump flourish
 * - Balatro-style trigger value popup (`+3`, `×2`, `+11`, `🔥4`) when it fires
 * - Per-Weapon Timed Evolution 5-state indicator directly on the slot:
 *   1. Idle: recessed 3px rail + tiny crystal dot (0% idle battery)
 *   2. Progressing: segmented micro-pips (target <= 5) or GPU scaleX bar (target > 5) + `2/3` pill + 1-shot pop
 *   3. Almost-Ready: warm amber fill + opacity-only pulsing anticipationRim + `1!` badge
 *   4. Evolved Active: golden actionYellow frame + evo icon + tabular-nums seconds pill + smooth 60fps drain bar (violet -> impactRed <= 5s + urgentRim) + lively spring pop
 *   5. Post-Expiry Cooldown (3s): muted silver tint + smooth 3000ms cooldown drain bar
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { useAppActive } from '@/hooks/useAppActive';
import type { Weapon } from '@/types';
import { COLORS } from '@/utils/colors';
import { EASE, exitMs, MS, SCALE, SPRING } from '@/utils/motion';
import { scaleText, useTextScale } from '@/utils/textSizeStorage';
import { growthStacks, type GrowthState } from '../data/weaponGrowth';
import type { ActiveWeaponCounter } from '../engine/fight';
import { EVOLUTION_CHASSIS } from '../engine/sources';
import type { BeltBadge, SetIgnition } from '../types';
import type { EvolutionLiveStateVM } from '../ui/evolutionViewModel';
import { Anchor, useBump } from './anchors';

export type { EvolutionLiveStateVM };

const GAP = 4;
const BADGE_HOLD_MS = 1350;
const URGENT_SEC = 5;

const BADGE_BG: Record<BeltBadge['kind'], string> = {
  flat: '#0E7490',
  mult: '#DC2626',
  fx: '#D97706',
};

const SPECIAL_EFFECT_COUNTER: Partial<Record<NonNullable<Weapon['specialEffect']>, ActiveWeaponCounter['type']>> = {
  fire: 'fire',
  explosive: 'explosion',
  laser: 'laser',
  hintGain: 'hint',
  graceGain: 'grace',
  timeGain: 'time',
  healing: 'healing',
};

/** Responsive target slot box size (px) fitting 3–6 slots cleanly on 375px portrait. */
const targetSlotBoxForCount = (count: number): number => {
  if (count <= 3) return 46;
  if (count === 4) return 42;
  if (count === 5) return 38;
  return 34;
};

/** Returns the active enemy counter dampening this weapon, if any. */
export const counterForWeapon = (
  weapon: Weapon,
  counters?: readonly ActiveWeaponCounter[]
): ActiveWeaponCounter | undefined => {
  if (!counters || counters.length === 0) return undefined;
  const byStat = counters.find(c => {
    const val = weapon.effects?.[c.stat];
    return typeof val === 'number' && val > 0;
  });
  if (byStat) return byStat;
  const specialType = weapon.specialEffect ? SPECIAL_EFFECT_COUNTER[weapon.specialEffect] : undefined;
  if (!specialType) return undefined;
  return counters.find(c => c.type === specialType);
};

interface BeltItemProps {
  weapon: Weapon;
  evo?: EvolutionLiveStateVM;
  boxSize: number;
  iconSize: number;
  stacks: number;
  counter?: ActiveWeaponCounter;
  badge?: BeltBadge;
  ignitionId?: number;
  active: boolean;
  effects: boolean;
  reduced: boolean;
  guardPress: boolean;
  noBottomBleed: boolean;
  onPress: () => void;
}

const BeltItem: React.FC<BeltItemProps> = ({
  weapon,
  evo,
  boxSize,
  iconSize,
  stacks,
  counter,
  badge,
  ignitionId,
  active,
  effects,
  reduced,
  guardPress,
  noBottomBleed,
  onPress,
}) => {
  const appActive = useAppActive();
  const sysReduced = useReducedMotion();
  const textScale = useTextScale();
  const motionOn = effects && !reduced && !sysReduced;
  const liveLoopsOn = active && appActive && motionOn;

  // [UI-16] Badge text follows Settings → Text Size (1.0× / 1.15×) above the 11px floor
  const badgeFont = { fontSize: scaleText(11, textScale), lineHeight: scaleText(13, textScale) };
  const pillFont = { fontSize: scaleText(10, textScale), lineHeight: scaleText(12, textScale) };

  const [fired, setFired] = useState(0);
  const [shownBadge, setShownBadge] = useState<BeltBadge | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const badgeOp = useSharedValue(0);
  const badgeScale = useSharedValue(1);
  const badgeY = useSharedValue(0);
  const slotScale = useSharedValue(1);
  const anticipationOp = useSharedValue(0);
  const urgentOp = useSharedValue(0);
  const railScaleX = useSharedValue(0);

  useBump(`weapon:${weapon.id}`, () => setFired(n => n + 1));

  // Derive 5-state evolution booleans
  const phase = evo?.phase;
  const isActive = phase === 'active';
  const isCooldown = phase === 'cooldown';
  const isCharging = phase === 'charging';
  const isAlmostReady = Boolean(isCharging && evo?.almostReady);
  const isProgressing = Boolean(isCharging && !isAlmostReady && (evo?.progress ?? 0) > 0);
  const isIdleEvo = Boolean(isCharging && !isAlmostReady && (evo?.progress ?? 0) === 0);

  const activeSecs = isActive ? Math.max(0, Math.ceil((evo?.activeRemainingMs ?? 0) / 1000)) : 0;
  const isUrgent = Boolean(isActive && activeSecs > 0 && activeSecs <= URGENT_SEC);
  const cooldownSecs = isCooldown ? Math.max(1, Math.ceil((evo?.cooldownRemainingMs ?? 0) / 1000)) : 0;
  const useSegmentedPips = Boolean(isCharging && evo && evo.target <= 5);

  // Trigger value popup badge animation
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!badge || !ignitionId) return;

    setShownBadge(badge);
    if (motionOn) {
      setFired(n => n + 1);
      badgeOp.value = withTiming(1, { duration: MS.feedback, easing: EASE.enter });
      badgeY.value = 5;
      badgeY.value = withTiming(0, { duration: MS.quick, easing: EASE.enter });
      badgeScale.value = 0.72;
      badgeScale.value = withSequence(
        withTiming(SCALE.pop, { duration: Math.round(MS.quick * 0.55), easing: EASE.pop }),
        withTiming(1, { duration: Math.round(MS.quick * 0.55), easing: EASE.ui })
      );
    } else {
      badgeOp.value = 1;
      badgeY.value = 0;
      badgeScale.value = 1;
    }

    const fadeOut = exitMs(MS.quick);
    timerRef.current = setTimeout(() => {
      badgeOp.value = withTiming(0, { duration: fadeOut, easing: EASE.exitSoft });
      timerRef.current = setTimeout(() => setShownBadge(null), fadeOut + 20);
    }, BADGE_HOLD_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimation(badgeOp);
      cancelAnimation(badgeScale);
      cancelAnimation(badgeY);
    };
  }, [badge, ignitionId, motionOn, badgeOp, badgeScale, badgeY]);

  // 1-shot SCALE.pop on progress tick + SPRING.lively pop on awakening entry
  const prevPhaseRef = useRef(phase);
  const prevProgressRef = useRef(evo?.progress ?? 0);
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const prevProgress = prevProgressRef.current;
    const curProgress = evo?.progress ?? 0;
    prevPhaseRef.current = phase;
    prevProgressRef.current = curProgress;

    if (!motionOn) {
      cancelAnimation(slotScale);
      slotScale.value = 1;
      return;
    }

    if (phase === 'active' && prevPhase !== 'active') {
      cancelAnimation(slotScale);
      slotScale.value = SCALE.reward;
      slotScale.value = withSpring(1, SPRING.lively);
      return () => cancelAnimation(slotScale);
    }

    if (phase === 'charging' && curProgress > prevProgress) {
      cancelAnimation(slotScale);
      slotScale.value = withSequence(
        withTiming(SCALE.pop, { duration: Math.round(MS.feedback * 0.55), easing: EASE.pop }),
        withTiming(1, { duration: Math.round(MS.feedback * 0.55), easing: EASE.ui })
      );
      return () => cancelAnimation(slotScale);
    }
    return undefined;
  }, [phase, evo?.progress, motionOn, slotScale]);

  // State 3: Almost-Ready battery-safe opacity-only anticipation rim pulse
  useEffect(() => {
    if (!isAlmostReady || !liveLoopsOn) {
      cancelAnimation(anticipationOp);
      anticipationOp.value = isAlmostReady ? 0.65 : 0;
      return;
    }
    anticipationOp.value = 0.22;
    anticipationOp.value = withRepeat(
      withTiming(0.95, { duration: MS.hero, easing: EASE.drift }),
      -1,
      true
    );
    return () => cancelAnimation(anticipationOp);
  }, [isAlmostReady, liveLoopsOn, anticipationOp]);

  // State 4 (<= 5s): Urgent battery-safe opacity-only rim pulse
  useEffect(() => {
    if (!isUrgent || !liveLoopsOn) {
      cancelAnimation(urgentOp);
      urgentOp.value = isUrgent ? 0.55 : 0;
      return;
    }
    urgentOp.value = 0.2;
    urgentOp.value = withRepeat(
      withTiming(0.95, { duration: MS.move, easing: EASE.drift }),
      -1,
      true
    );
    return () => cancelAnimation(urgentOp);
  }, [isUrgent, liveLoopsOn, urgentOp]);

  // GPU scaleX progress / smooth 60fps active drain / smooth 3000ms cooldown drain bar
  const evoProgress = evo?.progress ?? 0;
  const evoTarget = evo?.target ?? 1;
  const activeRemainingMs = evo?.activeRemainingMs ?? 0;
  const activeDurationMs = evo?.activeDurationMs ?? 1;
  const cooldownRemainingMs = evo?.cooldownRemainingMs ?? 0;

  useEffect(() => {
    if (!evo) {
      cancelAnimation(railScaleX);
      railScaleX.value = 0;
      return;
    }
    if (phase === 'active') {
      const frac = Math.max(0, Math.min(1, activeRemainingMs / Math.max(1, activeDurationMs)));
      cancelAnimation(railScaleX);
      railScaleX.value = frac;
      if (liveLoopsOn && activeRemainingMs > 0) {
        railScaleX.value = withTiming(0, { duration: activeRemainingMs, easing: EASE.linear });
      }
      return () => cancelAnimation(railScaleX);
    }
    if (phase === 'cooldown') {
      const cdTotal = EVOLUTION_CHASSIS.defaultCooldownMs;
      const frac = Math.max(0, Math.min(1, cooldownRemainingMs / Math.max(1, cdTotal)));
      cancelAnimation(railScaleX);
      railScaleX.value = frac;
      if (liveLoopsOn && cooldownRemainingMs > 0) {
        railScaleX.value = withTiming(0, { duration: cooldownRemainingMs, easing: EASE.linear });
      }
      return () => cancelAnimation(railScaleX);
    }
    // Tracking bar (used when target > 5; idle = 0)
    const frac = Math.max(0, Math.min(1, evoProgress / Math.max(1, evoTarget)));
    if (motionOn) {
      railScaleX.value = withTiming(frac, { duration: MS.quick, easing: EASE.state });
    } else {
      cancelAnimation(railScaleX);
      railScaleX.value = frac;
    }
    return () => cancelAnimation(railScaleX);
  }, [
    evo,
    phase,
    evoProgress,
    evoTarget,
    activeRemainingMs,
    activeDurationMs,
    cooldownRemainingMs,
    liveLoopsOn,
    motionOn,
    railScaleX,
  ]);

  // All animated styles strictly touch ONLY GPU-composited opacity / transform
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOp.value,
    transform: [{ translateY: badgeY.value }, { scale: badgeScale.value }],
  }));

  const slotAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: slotScale.value }],
  }));

  const anticipationRimStyle = useAnimatedStyle(() => ({
    opacity: anticipationOp.value,
  }));

  const urgentRimStyle = useAnimatedStyle(() => ({
    opacity: urgentOp.value,
  }));

  const railFillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: railScaleX.value }],
  }));

  const a11yParts = [weapon.name];
  if (stacks > 0) a11yParts.push(`grown ${Math.round(stacks)} times`);
  if (counter) a11yParts.push(`countered by foe −${counter.reduction}% (${counter.label})`);
  if (evo) {
    if (isActive) {
      a11yParts.push(`${evo.evolutionName} active, ${activeSecs} seconds remaining`);
    } else if (isCooldown) {
      a11yParts.push(`${evo.evolutionName} cooling down, ${cooldownSecs} seconds`);
    } else if (isAlmostReady) {
      a11yParts.push(`${evo.evolutionName} almost ready, ${evo.progress} of ${evo.target}, ${evo.conditionShort}`);
    } else {
      a11yParts.push(`${evo.evolutionName} ${evo.progress} of ${evo.target}, ${evo.conditionShort}`);
    }
  }

  // [UI-17] Guarantee >=44x44px touch target via hitSlop; [UI-15] keep bottom: 0 on portrait so it never bleeds into row-0 cards.
  const dx = Math.max(0, Math.ceil((44 - boxSize) / 2));
  const needY = Math.max(0, 44 - boxSize);
  const slotHitSlop = noBottomBleed
    ? { top: needY, bottom: 0, left: dx, right: dx }
    : { top: Math.ceil(needY / 2), bottom: Math.ceil(needY / 2), left: dx, right: dx };

  const railFillColor = isActive
    ? (isUrgent ? COLORS.impactRed : '#7C3AED')
    : isCooldown
      ? '#6B7280'
      : isAlmostReady
        ? '#D97706'
        : '#7C3AED';

  const remainingToTrigger = evo ? Math.max(1, evo.target - evo.progress) : 1;
  const pipArray = useMemo(() => {
    if (!useSegmentedPips || !evo) return null;
    return Array.from({ length: evo.target }, (_, i) => i);
  }, [useSegmentedPips, evo]);

  return (
    <Anchor name={`weapon:${weapon.id}`}>
      <Animated.View style={slotAnimStyle}>
        <TouchableOpacity
          onPress={guardPress ? NOOP_BELT_PRESS : onPress}
          onLongPress={guardPress ? onPress : undefined}
          delayLongPress={250}
          hitSlop={slotHitSlop}
          activeOpacity={guardPress ? 1 : 0.7}
          style={[
            st.item,
            { width: boxSize, height: boxSize },
            isAlmostReady && st.itemAlmostReady,
            isActive && st.itemEvolved,
            isCooldown && st.itemCooldown,
            counter && !isActive && st.itemCountered,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${a11yParts.join(', ')}: ${guardPress ? 'hold to inspect' : 'what it does'}`}
          testID={`belt-${weapon.id}`}
        >
          {/* Opacity-only pulsing anticipation rim (State 3: Almost-Ready) */}
          {isAlmostReady && (
            <Animated.View
              pointerEvents="none"
              testID={`belt-evo-anticipation-${weapon.id}`}
              style={[st.anticipationRim, anticipationRimStyle]}
            />
          )}

          {/* Opacity-only pulsing urgency rim (State 4 <= 5s) */}
          {isUrgent && (
            <Animated.View
              pointerEvents="none"
              testID={`belt-evo-urgent-${weapon.id}`}
              style={[st.urgentRim, urgentRimStyle]}
            />
          )}

          <View style={[st.avatarWrap, isCooldown && st.avatarCooldown]}>
            <WeaponAvatar weapon={weapon} size={iconSize} triggerKey={fired} />
          </View>

          {/* State 1: Idle tiny crystal dot indicating equipped evolution */}
          {isIdleEvo && (
            <View pointerEvents="none" style={st.idleEvoDot} testID={`belt-evo-idle-${weapon.id}`}>
              <Icon name="lorc/crystal-shine" size={8} color="#7C3AED" noShadow />
            </View>
          )}

          {/* State 4: Evolved Active mini evolution medallion */}
          {isActive && evo && !counter && (
            <View pointerEvents="none" style={st.evoMedallion} testID={`belt-evo-active-${weapon.id}`}>
              <Icon name={evo.icon} size={10} color={COLORS.slateCharcoal} noShadow />
            </View>
          )}

          {/* Bottom interior evolution rail (recessed idle / segmented pips / GPU scaleX bar / 60fps drain) */}
          {evo && (
            <View
              pointerEvents="none"
              style={[st.evoRail, isIdleEvo && st.evoRailIdle]}
              testID={`belt-evo-rail-${weapon.id}`}
            >
              {pipArray ? (
                <View style={st.pipRow}>
                  {pipArray.map(idx => {
                    const filled = idx < evo.progress;
                    const isFinalPip = isAlmostReady && idx === evo.target - 1;
                    return (
                      <View
                        key={idx}
                        style={[
                          st.pip,
                          filled && (isAlmostReady ? st.pipAmber : st.pipViolet),
                          isFinalPip && st.pipReadyNext,
                        ]}
                      />
                    );
                  })}
                </View>
              ) : (
                <Animated.View
                  style={[st.railFill, { backgroundColor: railFillColor }, railFillStyle]}
                />
              )}
            </View>
          )}

          {/* Enemy counter debuff indicator when the active foe weakens this weapon's category */}
          {counter && (
            <View style={st.counterBadge} testID={`belt-counter-${weapon.id}`} pointerEvents="none">
              <Text style={[st.counterBadgeText, badgeFont]} numberOfLines={1}>−{counter.reduction}%</Text>
            </View>
          )}

          {/* How far it has grown this fight */}
          {stacks > 0 && (
            <View style={st.stacks} testID={`belt-stacks-${weapon.id}`} pointerEvents="none">
              <Text style={[st.stacksText, badgeFont]}>+{Math.round(stacks)}</Text>
            </View>
          )}

          {/* Per-weapon evolution compact status pill (States 2, 3, 4, 5) */}
          {isProgressing && evo && (
            <View
              pointerEvents="none"
              style={[st.evoPill, st.evoPillProgress]}
              testID={`belt-evo-progress-${weapon.id}`}
            >
              <Text style={[st.evoPillText, st.evoPillProgressText, pillFont]} numberOfLines={1}>
                {evo.progress}/{evo.target}
              </Text>
            </View>
          )}

          {isAlmostReady && (
            <View
              pointerEvents="none"
              style={[st.evoPill, st.evoPillAlmost]}
              testID={`belt-evo-almost-${weapon.id}`}
            >
              <Text style={[st.evoPillText, st.evoPillLightText, pillFont]} numberOfLines={1}>
                {remainingToTrigger}!
              </Text>
            </View>
          )}

          {isActive && (
            <View
              pointerEvents="none"
              style={[st.evoPill, isUrgent ? st.evoPillUrgent : st.evoPillActive]}
              testID={`belt-evo-timer-${weapon.id}`}
            >
              <Text
                style={[st.evoPillText, isUrgent ? st.evoPillLightText : st.evoPillDarkText, pillFont]}
                numberOfLines={1}
              >
                {activeSecs}s
              </Text>
            </View>
          )}

          {isCooldown && (
            <View
              pointerEvents="none"
              style={[st.evoPill, st.evoPillCooldown]}
              testID={`belt-evo-cooldown-${weapon.id}`}
            >
              <Icon name="lorc/hourglass" size={8} color="#4B5563" noShadow />
              <Text style={[st.evoPillText, st.evoPillCooldownText, pillFont]} numberOfLines={1}>
                {cooldownSecs}s
              </Text>
            </View>
          )}

          {/* Balatro-style live value popup showing exact damage/mult/effect contributed */}
          {shownBadge && (
            <Animated.View
              pointerEvents="none"
              testID={`belt-badge-${weapon.id}`}
              style={[st.triggerBadge, { backgroundColor: BADGE_BG[shownBadge.kind] }, badgeStyle]}
            >
              <Text style={[st.triggerBadgeText, badgeFont]} numberOfLines={1}>{shownBadge.text}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Anchor>
  );
};

export interface GearBeltProps {
  weapons: readonly Weapon[];
  /** Live per-weapon timed evolution states matched by `weaponId` */
  evolutions?: readonly EvolutionLiveStateVM[];
  growth?: GrowthState;
  ignition?: SetIgnition | null;
  counters?: readonly ActiveWeaponCounter[];
  /** Whether the fight clock is actively ticking (pauses smooth drain & anticipation loops when halted) */
  active?: boolean;
  /** Adventure's Effects switch: off snaps bars/pips and disables pulsing loops */
  effects?: boolean;
  reduced?: boolean;
  width: number;
  /** Optional horizontal pixels reserved on the same row for docked Arcana pills */
  reservedRightPx?: number;
  /** [UI-15] Require long-press during active Parry wind-up or card selection on mobile portrait */
  guardPress?: boolean;
  /** [UI-15]/[UI-17] Keep hitSlop.bottom = 0 on portrait so touch target never encroaches row-0 cards */
  noBottomBleed?: boolean;
  onInspect: (w: Weapon) => void;
}

export const GearBelt: React.FC<GearBeltProps> = ({
  weapons,
  evolutions,
  growth,
  ignition,
  counters,
  active = true,
  effects,
  reduced = false,
  width,
  reservedRightPx = 0,
  guardPress = false,
  noBottomBleed = false,
  onInspect,
}) => {
  const evoByWeapon = useMemo(() => {
    const map = new Map<string, EvolutionLiveStateVM>();
    if (evolutions) {
      for (const item of evolutions) map.set(item.weaponId, item);
    }
    return map;
  }, [evolutions]);

  if (weapons.length === 0) return null;

  const avail = Math.max(120, (width > 0 ? width : 360) - 20 - reservedRightPx);
  const maxRoomBox = Math.floor((avail - GAP * (weapons.length - 1)) / weapons.length);
  const boxSize = Math.max(28, Math.min(targetSlotBoxForCount(weapons.length), maxRoomBox));
  const iconSize = Math.max(16, Math.min(26, boxSize - 13));
  const fxEnabled = effects ?? !reduced;

  return (
    <View style={st.belt} testID="gear-belt">
      {weapons.map(w => (
        <BeltItem
          key={w.id}
          weapon={w}
          evo={evoByWeapon.get(w.id)}
          boxSize={boxSize}
          iconSize={iconSize}
          stacks={growth ? growthStacks(growth, w.id) : 0}
          counter={counterForWeapon(w, counters)}
          badge={ignition?.beltBadges?.[w.id]}
          ignitionId={ignition?.id}
          active={active}
          effects={fxEnabled}
          reduced={reduced}
          guardPress={guardPress}
          noBottomBleed={noBottomBleed}
          onPress={() => onInspect(w)}
        />
      ))}
    </View>
  );
};

const NOOP_BELT_PRESS = () => {};

const st = StyleSheet.create({
  belt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    flexWrap: 'wrap',
    overflow: 'visible',
    paddingTop: 6,
    paddingBottom: 7,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.paperBeige,
    overflow: 'visible',
  },
  itemAlmostReady: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  itemEvolved: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
  },
  itemCooldown: {
    backgroundColor: '#E5E7EB',
    borderColor: '#9CA3AF',
  },
  itemCountered: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  anticipationRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  urgentRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.impactRed,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCooldown: {
    opacity: 0.62,
  },
  idleEvoDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    opacity: 0.72,
    zIndex: 3,
  },
  evoMedallion: {
    position: 'absolute',
    top: -6,
    left: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.canvasWhite,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  evoRail: {
    position: 'absolute',
    left: 3,
    right: 3,
    bottom: 2.5,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(18, 18, 18, 0.14)',
    overflow: 'hidden',
  },
  evoRailIdle: {
    height: 3,
    backgroundColor: 'rgba(18, 18, 18, 0.10)',
  },
  pipRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 1.5,
  },
  pip: {
    flex: 1,
    borderRadius: 1.5,
    backgroundColor: 'rgba(18, 18, 18, 0.12)',
  },
  pipViolet: {
    backgroundColor: '#7C3AED',
  },
  pipAmber: {
    backgroundColor: '#D97706',
  },
  pipReadyNext: {
    backgroundColor: '#FBBF24',
  },
  railFill: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    transformOrigin: 'left center',
  },
  evoPill: {
    position: 'absolute',
    bottom: -7,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 3.5,
    paddingVertical: 0.5,
    zIndex: 9,
  },
  evoPillProgress: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  evoPillAlmost: {
    backgroundColor: '#D97706',
    borderColor: COLORS.slateCharcoal,
  },
  evoPillActive: {
    backgroundColor: COLORS.actionYellow,
    borderColor: COLORS.slateCharcoal,
  },
  evoPillUrgent: {
    backgroundColor: COLORS.impactRed,
    borderColor: COLORS.slateCharcoal,
  },
  evoPillCooldown: {
    backgroundColor: '#F3F4F6',
    borderColor: '#9CA3AF',
  },
  evoPillText: {
    flexShrink: 1,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  evoPillProgressText: {
    color: '#4C1D95',
  },
  evoPillDarkText: {
    color: COLORS.slateCharcoal,
  },
  evoPillLightText: {
    color: '#FFFFFF',
  },
  evoPillCooldownText: {
    color: '#4B5563',
  },
  stacks: {
    position: 'absolute',
    top: -6,
    right: -5,
    minWidth: 18,
    paddingHorizontal: 3,
    borderRadius: 7,
    backgroundColor: COLORS.actionYellow,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
    zIndex: 5,
  },
  stacksText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.slateCharcoal,
    lineHeight: 13,
  },
  counterBadge: {
    position: 'absolute',
    top: -6,
    left: -5,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 6,
    backgroundColor: '#B91C1C',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
    zIndex: 7,
  },
  counterBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    lineHeight: 13,
  },
  triggerBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    zIndex: 14,
  },
  triggerBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.1,
    lineHeight: 13,
  },
});
