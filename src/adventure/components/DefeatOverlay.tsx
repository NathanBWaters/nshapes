/**
 * [OB-13] + [OB-17] In-Place Defeat Overlay for `<250ms` Instant Retry.
 *
 * Mounts directly over the paused board (zero ScreenTransition unmount!) so
 * tapping `RETRY` (or pressing `Enter`/`Space`/`R` on Web) puts fresh live
 * cards under the player's thumb in `<250ms` while preserving single-event
 * `fight_ended` telemetry and offering:
 *   - Cause of defeat + near-miss readout ("Prickle had just 4 HP left!")
 *   - Pre-`1-8` "Closest Yet!" foe-damage progress bar + hidden coin purse note
 *   - Context-aware `diagnoseResultTip` + 1-tap "Arm <Recipe> & Retry" / Skill Tree / Workshop
 *   - Optional Friendly Tailwind relief toggle (`consecutiveLosses >= 2`)
 *   - Compact links to Full Breakdown (`LevelResults`), Camp, and Map
 *
 * Pure GPU `transform`/`opacity` one-shot entrance (`MS.quick = 180ms`), zero infinite loops.
 */
import React, { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { KEY_PRIORITY, useKeyboardNav } from '@/hooks/useKeyboardNav';
import { useColorblind } from '@/utils/cardColors';
import { COLORS } from '@/utils/colors';
import { EASE, MODAL_MOTION, MS, STAYS, reducedMs } from '@/utils/motion';
import { sfx } from '@/audio';
import type { LevelDef, RunState } from '../types';
import type { ResultApplication } from '../progress';
import { isTailwindOffered, TAILWIND_STAR_CAP } from '../data/relief';
import { diagnoseResultTip } from '../coach';
import CompanionBubble, { LivingBreath } from './CompanionBubble';
import { DARK, INK, TONE } from './ui';

export interface DefeatOverlayProps {
  level: LevelDef;
  run: RunState;
  result: ResultApplication;
  onRetry: () => void;
  onFullBreakdown: () => void;
  onCamp: (tab?: 'fighters' | 'workshop') => void;
  onMap: () => void;
  onArmRecipeAndRetry?: (recipeId: string) => void;
  onToggleTailwind?: (active: boolean) => void;
}

const causeOfDefeat = (run: RunState): string => {
  if (run.endReason === 'hearts' || (run.hearts !== null && run.hearts <= 0)) return 'Out of Hearts';
  if (run.timeLeft !== null && run.timeLeft <= 0) return 'Out of Time';
  if (run.movesLeft !== null && run.movesLeft <= 0) return 'Out of Moves';
  return 'Defeated';
};

const DefeatOverlay: React.FC<DefeatOverlayProps> = ({
  level,
  run,
  result,
  onRetry,
  onFullBreakdown,
  onCamp,
  onMap,
  onArmRecipeAndRetry,
  onToggleTailwind,
}) => {
  const reduced = useReducedMotion();
  const colorblind = useColorblind();
  const backdropO = useSharedValue(0);
  const op = useSharedValue(0);
  const y = useSharedValue(reduced ? 0 : 18);
  const s = useSharedValue(reduced ? 1 : MODAL_MOTION.popInFromScale);
  const barFill = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      y.value = 0;
      s.value = 1;
      barFill.value = 1;
      backdropO.value = withTiming(1, { duration: reducedMs(MS.feedback), easing: EASE.ui, ...STAYS });
      op.value = withTiming(1, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS });
    } else {
      backdropO.value = withTiming(1, { duration: MODAL_MOTION.backdropEnterMs, easing: EASE.ui, ...STAYS });
      op.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS });
      y.value = withTiming(0, { duration: MS.quick, easing: EASE.enterSoft });
      s.value = withTiming(1, { duration: MS.quick, easing: EASE.enter });
      barFill.value = withDelay(MODAL_MOTION.contentLagMs, withTiming(1, { duration: MS.move, easing: EASE.enterSoft }));
    }
    return () => {
      cancelAnimation(backdropO);
      cancelAnimation(op);
      cancelAnimation(y);
      cancelAnimation(s);
      cancelAnimation(barFill);
    };
  }, [reduced, backdropO, op, y, s, barFill]);

  const handleKeyboardRetry = useCallback(() => {
    sfx('confirm');
    onRetry();
  }, [onRetry]);

  // [UI-23] Unified web keyboard shortcuts (`Enter`/`Space` confirm, `R` instant retry, `Esc` back to map)
  useKeyboardNav({
    enabled: true,
    priority: KEY_PRIORITY.OVERLAY,
    onConfirm: handleKeyboardRetry,
    onRetry: handleKeyboardRetry,
    onCancel: onMap,
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropO.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: y.value }, { scale: s.value }],
  }));

  const hpPctRemaining = run.foeMaxHp > 0 ? Math.max(0, Math.min(1, run.foeHp / run.foeMaxHp)) : 1;
  const dealtPct = Math.round((1 - hpPctRemaining) * 100);
  const dealtScale = Math.max(0.04, Math.min(1, dealtPct / 100));
  const bestHpPct = result.save.bestFoeHpPct?.[level.id] ?? hpPctRemaining;
  const bestDealtPct = Math.round((1 - Math.max(0, Math.min(1, bestHpPct))) * 100);
  const bestScale = Math.max(0, Math.min(1, bestDealtPct / 100));
  const fillBarStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0.001, dealtScale * barFill.value) }],
  }));
  const bestBarStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0.001, bestScale * barFill.value) }],
  }));
  const hpLeft = Math.max(1, Math.ceil(run.foeHp));
  const nearMiss = run.foeHp > 0 && hpPctRemaining <= 0.25;
  const showPreCoinsProgress = !result.save.coinsUnlocked;
  const diagnostic = diagnoseResultTip(level, run, 0, result.save, colorblind);
  const offerTailwind = isTailwindOffered(level, result.save);
  const tailwindOn = Boolean(result.save.tailwindActive);

  const handleQuickAction = () => {
    const qa = diagnostic?.quickAction;
    if (!qa) return;
    sfx('confirm');
    if (qa.kind === 'arm_recipe' && qa.payload && onArmRecipeAndRetry) {
      onArmRecipeAndRetry(qa.payload);
    } else if (qa.kind === 'open_tree') {
      onCamp('fighters');
    } else if (qa.kind === 'open_workshop') {
      onCamp('workshop');
    }
  };

  return (
    <Animated.View testID="defeat-overlay" style={[st.backdrop, backdropStyle]}>
      <Animated.View style={[st.panel, panelStyle]}>
        <ScrollView contentContainerStyle={st.scroll} bounces={false}>
          <View style={st.header}>
            <View style={st.causePill}>
              <Text testID="defeat-cause" style={st.causeText}>{causeOfDefeat(run).toUpperCase()}</Text>
            </View>
            <View style={st.matchup}>
              <LivingBreath seedKey={`defeat-fighter-${run.fighter}`} size={46}>
                <FighterAvatar character={run.fighter} size={46} mood="defeat" animate={false} framed />
              </LivingBreath>
              <Text style={st.vsText}>VS</Text>
              <LivingBreath seedKey={`defeat-foe-${run.foeName}`} size={46}>
                <EnemyAvatar
                  enemy={{ name: run.foeName, icon: run.foeIcon, tier: run.foe.tier }}
                  size={46}
                  hp={run.foeHp}
                  maxHp={run.foeMaxHp}
                  mood="victory"
                  animate={false}
                  lightweight
                  framed
                />
              </LivingBreath>
            </View>
            <Text style={st.title}>{level.id} · {level.name}</Text>
            {nearMiss ? (
              <Text testID="defeat-near-miss" style={st.nearMiss}>
                So close! {run.foeName} had just {hpLeft} HP left!
              </Text>
            ) : (
              <Text style={st.sub}>
                {run.foeName} survived with {hpLeft} / {run.foeMaxHp} HP ({dealtPct}% dealt)
              </Text>
            )}
          </View>

          {/* Pre-1-8 visible progress so early defeats feel forward-moving ([OB-13]) */}
          {showPreCoinsProgress && (
            <View testID="defeat-closest-bar" style={st.progressBox}>
              <View style={st.progressHead}>
                <Text style={st.progressLabel}>
                  {result.isClosestYet ? 'CLOSEST YET!' : 'PROGRESS TOWARD KO'}
                </Text>
                <Text style={st.progressPct}>
                  {dealtPct}% dealt{bestDealtPct > dealtPct ? ` · best ${bestDealtPct}%` : ''}
                </Text>
              </View>
              <View style={st.progressTrack}>
                {bestDealtPct > dealtPct && (
                  <Animated.View style={[st.progressBestFill, bestBarStyle]} />
                )}
                <Animated.View style={[st.progressFill, fillBarStyle]} />
              </View>
              {(result.hiddenPurseDeposited ?? 0) > 0 && (
                <Text testID="defeat-hidden-purse" style={st.purseNote}>
                  +{result.hiddenPurseDeposited}¢ quietly saved toward your Loot Purse!
                </Text>
              )}
            </View>
          )}

          {/* Context-aware diagnostic tip & 1-tap fix ([OB-17]) */}
          {diagnostic && (
            <View style={st.tipBlock}>
              <CompanionBubble
                testID="defeat-tip"
                character={run.fighter}
                mood="anticipation"
                tone="warn"
                avatarSize={32}
                text={diagnostic.text}
                style={{ alignSelf: 'stretch' }}
              />
              {diagnostic.quickAction && (
                <TouchableOpacity
                  testID="defeat-quick-action"
                  onPress={handleQuickAction}
                  style={st.quickActionBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Icon
                    name={
                      diagnostic.quickAction.kind === 'arm_recipe'
                        ? 'lorc/crystal-shine'
                        : diagnostic.quickAction.kind === 'open_tree'
                          ? 'lorc/flat-star'
                          : 'lorc/gear-hammer'
                    }
                    size={16}
                    color={INK}
                  />
                  <Text style={st.quickActionText}>{diagnostic.quickAction.label}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Optional Friendly Tailwind relief after 2 consecutive losses ([GP-18]) */}
          {offerTailwind && onToggleTailwind && (
            <TouchableOpacity
              testID="defeat-tailwind-toggle"
              onPress={() => {
                sfx('click');
                onToggleTailwind(!tailwindOn);
              }}
              style={[st.tailwindRow, tailwindOn && st.tailwindRowOn]}
              activeOpacity={0.82}
              accessibilityRole="switch"
              accessibilityState={{ checked: tailwindOn }}
            >
              <Icon name="lorc/feather" size={16} color={tailwindOn ? COLORS.tealSurface : INK} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.tailwindTitle}>
                  Friendly Tailwind: {tailwindOn ? 'ON' : 'OFF'}
                </Text>
                <Text style={st.tailwindSub}>
                  +2♥, +20% time/moves, 25% slower Parries (clears road at {TAILWIND_STAR_CAP}★)
                </Text>
              </View>
              <View style={[st.tailwindPill, tailwindOn && st.tailwindPillOn]}>
                <Text style={[st.tailwindPillText, tailwindOn && st.tailwindPillTextOn]}>
                  {tailwindOn ? 'ON' : 'TRY'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Oversized instant-retry CTA + compact secondary navigation */}
        <View style={st.actions}>
          <TouchableOpacity
            testID="defeat-retry"
            onPress={() => {
              sfx('confirm');
              onRetry();
            }}
            style={st.retryBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Retry level immediately"
          >
            <Icon name="lorc/return-arrow" size={20} color={INK} />
            <Text style={st.retryText}>RETRY</Text>
          </TouchableOpacity>

          <View style={st.secondaryRow}>
            <TouchableOpacity
              testID="defeat-breakdown"
              onPress={() => {
                sfx('click');
                onFullBreakdown();
              }}
              style={st.secBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={st.secText}>Full Breakdown</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="defeat-camp"
              onPress={() => {
                sfx('click');
                onCamp();
              }}
              style={st.secBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={st.secText}>Camp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="defeat-map"
              onPress={() => {
                sfx('click');
                onMap();
              }}
              style={st.secBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={st.secText}>Map</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 480,
    backgroundColor: 'rgba(18, 16, 16, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  panel: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '92%',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 16,
    borderWidth: 3,
    borderBottomWidth: 7,
    borderColor: INK,
    overflow: 'hidden',
  },
  scroll: { padding: 14, gap: 10 },
  header: {
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#25191A',
    margin: -14,
    marginBottom: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.impactRed,
  },
  causePill: {
    backgroundColor: COLORS.redSurface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  causeText: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
  matchup: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  vsText: { color: DARK.muted, fontWeight: '900', fontSize: 11, letterSpacing: 1.4 },
  title: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 18, textAlign: 'center' },
  nearMiss: { color: COLORS.actionYellow, fontWeight: '900', fontSize: 13.5, textAlign: 'center' },
  sub: { color: '#E5DDD5', fontWeight: '700', fontSize: 12.5, textAlign: 'center' },
  progressBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D97706',
    padding: 10,
    gap: 6,
  },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  progressLabel: { fontSize: 11, fontWeight: '900', color: '#92400E', letterSpacing: 0.8 },
  progressPct: { fontSize: 11.5, fontWeight: '800', color: INK, fontVariant: ['tabular-nums'] },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F3E8D0',
    borderWidth: 1.5,
    borderColor: INK,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBestFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FDE68A',
    transformOrigin: 'left center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.tealSurface,
    transformOrigin: 'left center',
  },
  purseNote: { fontSize: 11.5, fontWeight: '800', color: TONE.coin, textAlign: 'center' },
  tipBlock: { gap: 8 },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: INK,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  quickActionText: { color: INK, fontWeight: '900', fontSize: 13 },
  tailwindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: INK,
    padding: 9,
  },
  tailwindRowOn: {
    backgroundColor: '#CCFBF1',
    borderColor: COLORS.tealSurface,
  },
  tailwindTitle: { fontSize: 12.5, fontWeight: '900', color: INK },
  tailwindSub: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.78 },
  tailwindPill: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tailwindPillOn: { backgroundColor: COLORS.tealSurface, borderColor: COLORS.tealSurface },
  tailwindPillText: { fontSize: 10.5, fontWeight: '900', color: INK },
  tailwindPillTextOn: { color: COLORS.canvasWhite },
  actions: {
    borderTopWidth: 2,
    borderTopColor: INK,
    backgroundColor: COLORS.paperBeige,
    padding: 12,
    gap: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 10,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: INK,
    paddingVertical: 14,
  },
  retryText: { color: INK, fontWeight: '900', fontSize: 18, letterSpacing: 1.6 },
  secondaryRow: { flexDirection: 'row', gap: 6 },
  secBtn: {
    flex: 1,
    minHeight: 40,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  secText: { color: INK, fontWeight: '800', fontSize: 12, textAlign: 'center' },
});

export default DefeatOverlay;
