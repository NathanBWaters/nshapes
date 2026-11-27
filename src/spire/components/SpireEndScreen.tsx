/**
 * Starfall Summit — Victory (with Enter Endless Starfall!) & Defeat Summary Screen.
 *
 * Reuses `FighterAvatar`, `WeaponAvatar`, `FightReplay`, and shared `ui.tsx`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import Icon from '@/components/Icon';
import RoundFunPrompt from '@/components/RoundFunPrompt';
import type { FunRating, FunTag } from '@/analytics/fightEvent';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { EASE, MS, OVERLAP, SCALE, SPRING, STAGGER, STAYS, reducedMs } from '@/utils/motion';
import { buildDamageStory, buildSpireRunDamageStory } from '@/adventure/engine/damageStory';
import BattleDamageStory from '@/adventure/components/BattleDamageStory';
import FightReplay from '@/adventure/components/FightReplay';
import { WeaponChip } from '@/adventure/components/SharedCards';
import { Btn, DARK, Eyebrow, INK, TONE } from '@/adventure/components/ui';
import { sfx } from '@/audio';
import { buildSpireWeaponBuilds, spireHeldWeapons } from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS } from '../engine/runState';
import { computeSpireRating, formatSpireShareCard } from '../engine/share';
import type { SpireLastFightSnapshot, SpireRun } from '../types';
import { SPIRE_MOTION_INSTANT, SpireCountUp, SpireStaggerItem } from './SpireMotion';

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const Clipboard = await import('expo-clipboard');
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(text);
      return true;
    }
  } catch {
    // Clipboard unavailable
  }
  return false;
};

interface Props {
  run: SpireRun;
  victory: boolean;
  lastFight: SpireLastFightSnapshot | null;
  funRating?: FunRating | null;
  funTags?: readonly FunTag[];
  onRateFun?: (rating: FunRating | null, tags: FunTag[]) => void;
  onReplayOpened?: () => void;
  onEnterEndless?: () => void;
  onNewRun: () => void;
  onExitToMenu: () => void;
}

const SpireEndScreen: React.FC<Props> = ({
  run,
  victory,
  lastFight,
  funRating = null,
  funTags = [],
  onRateFun,
  onReplayOpened,
  onEnterEndless,
  onNewRun,
  onExitToMenu,
}) => {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [replayOpen, setReplayOpen] = useState(false);
  const [storyScope, setStoryScope] = useState<'climb' | 'final'>('climb');
  const [copiedShare, setCopiedShare] = useState(false);
  const [heroReactionId, setHeroReactionId] = useState(0);
  const held = spireHeldWeapons(run);
  const builds = useMemo(() => buildSpireWeaponBuilds(run), [run]);
  const rating = useMemo(() => computeSpireRating(run, victory), [run, victory]);
  const shareCard = useMemo(() => formatSpireShareCard(run, victory), [run, victory]);

  // Staged Run Climax Arc (tight, punchy, zero empty hero box frames!):
  // Beat 1 (0ms): Hero card rises + crest stamps in immediately + ceremonial golden sunburst blooms
  // Beat 2 (+96ms): Champion enters & triggers ecstatic celebration (or solemn slump)
  // Beat 3 (+160ms): Summit Rating counts up + GPU scaleX percentile bar sweeps cleanly
  // Beat 4 (+240ms): Run stats grid staggers & counts up
  // Beat 5 (+340ms): Share card & actions settle calmly last
  const crestScale = useSharedValue(SPIRE_MOTION_INSTANT || reduced ? 1 : victory ? SCALE.slam : 0.78);
  const crestY = useSharedValue(SPIRE_MOTION_INSTANT || reduced ? 0 : victory ? -12 : -6);
  const crestOp = useSharedValue(SPIRE_MOTION_INSTANT ? 1 : 0);
  const raysScale = useSharedValue(SPIRE_MOTION_INSTANT || reduced ? 1 : 0.78);
  const raysOp = useSharedValue(SPIRE_MOTION_INSTANT || reduced ? (victory ? 0.2 : 0) : 0);
  const barFill = useSharedValue(SPIRE_MOTION_INSTANT || reduced ? rating.percentile / 100 : 0);
  const [barW, setBarW] = useState(0);

  useEffect(() => {
    if (SPIRE_MOTION_INSTANT) return;
    if (reduced) {
      crestScale.value = 1;
      crestY.value = 0;
      crestOp.value = withTiming(1, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS });
      raysOp.value = victory
        ? withTiming(0.2, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS })
        : 0;
      barFill.value = rating.percentile / 100;
      return;
    }
    crestOp.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS });
    crestY.value = withTiming(0, { duration: MS.quick, easing: victory ? EASE.impact : EASE.enterSoft });
    crestScale.value = withSequence(
      withTiming(victory ? 0.92 : 1.04, { duration: MS.quick, easing: victory ? EASE.impact : EASE.enter }),
      withSpring(1, victory ? SPRING.playful : SPRING.heavy)
    );
    if (victory) {
      raysOp.value = withDelay(
        OVERLAP.primaryMs,
        withSequence(
          withTiming(0.34, { duration: MS.quick, easing: EASE.enter }),
          withTiming(0.2, { duration: MS.move, easing: EASE.ui })
        )
      );
      raysScale.value = withDelay(
        OVERLAP.primaryMs,
        withSequence(
          withTiming(1.12, { duration: MS.quick, easing: EASE.enter }),
          withSpring(1, SPRING.settle)
        )
      );
    }
    barFill.value = withDelay(
      MS.quick,
      withTiming(rating.percentile / 100, { duration: MS.panel + MS.feedback, easing: EASE.enterSoft })
    );
    const cheerTimer = setTimeout(() => {
      if (victory) setHeroReactionId(1);
    }, MS.feedback);
    return () => {
      clearTimeout(cheerTimer);
      cancelAnimation(crestScale);
      cancelAnimation(crestY);
      cancelAnimation(crestOp);
      cancelAnimation(raysScale);
      cancelAnimation(raysOp);
      cancelAnimation(barFill);
    };
  }, [victory, reduced, rating.percentile, crestScale, crestY, crestOp, raysScale, raysOp, barFill]);

  const crestAnim = useAnimatedStyle(() => ({
    opacity: crestOp.value,
    transform: [{ translateY: crestY.value }, { scale: crestScale.value }],
  }));
  const raysAnim = useAnimatedStyle(() => ({
    opacity: raysOp.value,
    transform: [{ scale: raysScale.value }],
  }));
  // GPU-only scaleX anchored at the left edge via translateX(-w/2) → scaleX → translateX(w/2)
  const barAnim = useAnimatedStyle(() => {
    const frac = Math.max(0.02, Math.min(1, barFill.value));
    const half = barW / 2;
    return {
      transform: [{ translateX: -half }, { scaleX: frac }, { translateX: half }],
    };
  });

  const handleCopyShare = async () => {
    await copyToClipboard(shareCard);
    sfx('click');
    setCopiedShare(true);
  };
  const climbStory = useMemo(
    () => buildSpireRunDamageStory(run.stats.sourceDamage, run.stats.floorLedger),
    [run.stats.sourceDamage, run.stats.floorLedger]
  );
  const finalFightStory = useMemo(() => (lastFight ? buildDamageStory(lastFight.run) : null), [lastFight]);
  const activeStory =
    storyScope === 'final' && finalFightStory && finalFightStory.totalDamage > 0
      ? finalFightStory
      : climbStory ?? finalFightStory;
  const canToggleScope = !!(climbStory && finalFightStory && finalFightStory.totalDamage > 0 && (run.stats.floorLedger?.length ?? 0) > 1);

  return (
    <View style={[st.root, { paddingTop: insets.top }]} testID={victory ? 'spire-victory' : 'spire-defeat'}>
      <ScrollView contentContainerStyle={[st.body, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
        {/* Beat 1 & 2: Hero Crest, Ceremonial Sunburst & Living Champion */}
        <SpireStaggerItem index={0} count={1} distance={22} hero style={[st.hero, victory ? st.heroWin : st.heroLose]}>
          {victory && (
            <Animated.View pointerEvents="none" style={[st.raysWrap, raysAnim]}>
              <Svg width={320} height={220} viewBox="0 0 320 220">
                {Array.from({ length: 12 }).map((_, i) => {
                  const a0 = ((i * 30 - 6) * Math.PI) / 180;
                  const a1 = ((i * 30 + 6) * Math.PI) / 180;
                  const cx = 160;
                  const cy = 92;
                  const r = 190;
                  const x1 = cx + Math.cos(a0) * r;
                  const y1 = cy + Math.sin(a0) * r;
                  const x2 = cx + Math.cos(a1) * r;
                  const y2 = cy + Math.sin(a1) * r;
                  return <Polygon key={i} points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`} fill="#FFE033" />;
                })}
              </Svg>
            </Animated.View>
          )}
          <Animated.View style={crestAnim} testID="spire-end-crest">
            <Icon
              name={victory ? 'lorc/crown' : 'lorc/daemon-skull'}
              size={44}
              color={victory ? COLORS.actionYellow : '#FCA5A5'}
            />
          </Animated.View>
          <SpireStaggerItem index={0} count={2} baseDelayMs={OVERLAP.primaryMs} gapMs={STAGGER.card} distance={10} style={st.heroTitleBlock}>
            <Eyebrow
              text={victory ? `ASCENSION ${run.ascension} CLEARED!` : run.endless ? `ENDLESS ACT ${run.act} · FLOOR ${run.floor}` : `ACT ${run.act} · FLOOR ${run.floor}`}
              color={victory ? COLORS.actionYellow : '#FECACA'}
            />
            <Text style={st.title}>{victory ? 'SUMMIT CONQUERED!' : 'CLIMB ENDED'}</Text>
            <Text style={st.sub}>
              {victory
                ? `${run.fighter} shattered the Starfall Summit! Ascension ${run.ascension + 1} is now unlocked.`
                : `${run.fighter} fell to ${run.defeatedBy ?? 'the Summit'} on Floor ${run.floor}.`}
            </Text>
          </SpireStaggerItem>
          <SpireStaggerItem index={1} count={2} baseDelayMs={OVERLAP.secondaryMs} gapMs={STAGGER.item} distance={12}>
            <FighterAvatar
              character={run.fighter}
              size={68}
              health={victory ? run.hearts : 0}
              maxHealth={run.maxHearts}
              mood={victory ? 'victory' : 'defeat'}
              reaction={victory && heroReactionId > 0 ? { type: 'ecstatic', id: heroReactionId } : null}
            />
          </SpireStaggerItem>
        </SpireStaggerItem>

        {/* Beat 3: Summit Rating & GPU Percentile Bar (`[TP-19]`) */}
        <SpireStaggerItem index={0} count={4} baseDelayMs={MS.quick} gapMs={STAGGER.item}>
          <View style={st.ratingCard} testID="spire-end-rating">
            <View style={st.ratingTop}>
              <View style={[st.tierPill, { backgroundColor: rating.tierColor }]}>
                <Text style={st.tierPillText}>{rating.tierName.toUpperCase()} TIER</Text>
              </View>
              {run.isDaily && run.dailyDate && (
                <Text style={st.dailyTag}>DAILY · {run.dailyDate}</Text>
              )}
            </View>
            <SpireCountUp
              target={rating.rating}
              delayMs={MS.quick + OVERLAP.primaryMs}
              ticks={10}
              prefix="Summit Rating "
              style={st.ratingValue}
            />
            <Text style={st.ratingPercentile}>
              Outscored ~{rating.percentile}% of climbers
            </Text>
            <View
              style={st.ratingTrack}
              onLayout={e => setBarW(Math.floor(e.nativeEvent.layout.width))}
            >
              <Animated.View style={[st.ratingFill, barAnim]} />
            </View>
            <View style={st.breakdownRow}>
              <Text style={st.breakdownChip}>Floors +{rating.floorPoints}</Text>
              <Text style={st.breakdownChip}>DPM +{rating.dpmPoints}</Text>
              <Text style={st.breakdownChip}>Parries +{rating.parryPoints}</Text>
              {rating.evolutionPoints > 0 && (
                <Text style={st.breakdownChip}>Evos +{rating.evolutionPoints}</Text>
              )}
              {rating.ascensionMultiplier > 1 && (
                <Text style={st.breakdownChip}>×{rating.ascensionMultiplier} Asc</Text>
              )}
            </View>
          </View>
        </SpireStaggerItem>

        {/* Cumulative Damage Story (Full Climb + optional Final Fight toggle) */}
        {activeStory && activeStory.totalDamage > 0 && (
          <BattleDamageStory
            story={activeStory}
            title={activeStory === climbStory ? 'FULL CLIMB DAMAGE' : 'FINAL FIGHT DAMAGE'}
            weaponBuilds={activeStory === finalFightStory && lastFight ? lastFight.builds : builds}
            startDelayMs={380}
            reduced={reduced}
            hidePowerNote
            testID="spire-end-damage-story"
            headerRight={
              canToggleScope ? (
                <View style={st.scopeToggle}>
                  <TouchableOpacity
                    testID="spire-story-scope-climb"
                    onPress={() => { sfx('click'); setStoryScope('climb'); }}
                    style={[st.scopeBtn, storyScope === 'climb' && st.scopeBtnActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.scopeBtnText, storyScope === 'climb' && st.scopeBtnTextActive]}>Climb</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="spire-story-scope-final"
                    onPress={() => { sfx('click'); setStoryScope('final'); }}
                    style={[st.scopeBtn, storyScope === 'final' && st.scopeBtnActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.scopeBtnText, storyScope === 'final' && st.scopeBtnTextActive]}>Last</Text>
                  </TouchableOpacity>
                </View>
              ) : undefined
            }
          />
        )}

        {/* Beat 4: Staggered Run Stats Grid with Count-Up */}
        <SpireStaggerItem index={1} count={4} baseDelayMs={MS.move} gapMs={STAGGER.item}>
          <View style={st.statsCard}>
            <Text style={st.sec}>RUN SUMMARY · SEED #{run.seed}</Text>
            <View style={st.statGrid}>
              <Metric index={0} label="Floors" numericValue={run.stats.floorsCleared} />
              <Metric index={1} label="Peak DPM" numericValue={Math.round(run.stats.peakDpm)} />
              <Metric index={2} label="Biggest Hit" numericValue={Math.round(run.stats.biggestHit)} />
              <Metric index={3} label="Total Dmg" numericValue={Math.round(run.stats.totalDamage)} />
              <Metric index={4} label="Parries" value={`${run.stats.parries} (★${run.stats.perfectParries})`} />
              <Metric index={5} label="Evolutions" numericValue={run.stats.evolutionsForged} />
            </View>

            <Text style={st.sec}>FINAL ARSENAL ({held.length}/{MAX_SUMMIT_WEAPONS} WEAPONS · {run.skillNodes.length} SKILLS · {run.arcana.length} ARCANA)</Text>
            <View style={st.gearWrap}>
              {held.map((w, i) => (
                <WeaponChip key={`${w.id}-${i}`} weapon={w} level={builds[w.id]?.level ?? 1} />
              ))}
            </View>

            {lastFight && (
              <Btn
                small
                variant="secondary"
                label="See Final Fight Replay"
                icon="delapouite/scroll-quill"
                onPress={() => { sfx('click'); onReplayOpened?.(); setReplayOpen(true); }}
              />
            )}
          </View>
        </SpireStaggerItem>

        {/* Spoiler-Free Share Card + Seed URL (`[TP-19]`) */}
        <SpireStaggerItem index={2} count={4} baseDelayMs={MS.move} gapMs={STAGGER.item}>
          <View style={st.statsCard} testID="spire-end-share-card">
            <Text style={st.sec}>SPOILER-FREE SHARE CARD</Text>
            <Text style={st.sharePreview}>{shareCard}</Text>
            <Btn
              testID="spire-end-copy-share"
              small
              variant={copiedShare ? 'secondary' : 'primary'}
              label={copiedShare ? 'Copied Share Card ✓' : 'Copy Share Card & Seed Link'}
              icon="lorc/scroll-unfurled"
              onPress={handleCopyShare}
            />
          </View>
        </SpireStaggerItem>

        {onRateFun && (
          <RoundFunPrompt
            rating={funRating}
            tags={funTags}
            onChange={onRateFun}
            compact
            title={victory ? 'Was that climb fun?' : 'Was that fight fun?'}
            testIDPrefix="spire-end-fun"
          />
        )}

        {/* Beat 5: Action Buttons Settle Last */}
        <SpireStaggerItem index={3} count={4} baseDelayMs={MS.move + STAGGER.item} gapMs={STAGGER.item}>
          <View style={st.actions}>
            {victory && onEnterEndless && (
              <Btn
                testID="spire-enter-endless"
                label="Enter Endless Starfall (Act 4+)"
                icon="various-artists/infinity"
                onPress={() => { sfx('confirm'); onEnterEndless(); }}
              />
            )}
            <Btn
              testID="spire-play-again"
              variant={victory ? 'secondary' : 'primary'}
              label={victory ? 'Claim Victory & New Setup' : 'Climb Again'}
              icon="lorc/mountaintop"
              onPress={() => { sfx('confirm'); onNewRun(); }}
            />
            <Btn
              testID="spire-end-menu"
              variant="secondary"
              label="Return to Main Menu"
              onPress={() => { sfx('click'); onExitToMenu(); }}
            />
          </View>
        </SpireStaggerItem>
      </ScrollView>

      {lastFight && (
        <FightReplay
          visible={replayOpen}
          run={lastFight.run}
          onClose={() => setReplayOpen(false)}
        />
      )}
    </View>
  );
};

const Metric: React.FC<{
  index: number;
  label: string;
  value?: string;
  numericValue?: number;
}> = ({ index, label, value, numericValue }) => (
  <SpireStaggerItem
    index={index}
    count={6}
    baseDelayMs={MS.move + OVERLAP.primaryMs}
    gapMs={STAGGER.card}
    distance={8}
    style={st.metric}
  >
    {numericValue !== undefined && numericValue > 0 ? (
      <SpireCountUp
        target={numericValue}
        delayMs={MS.move + OVERLAP.secondaryMs + index * STAGGER.card}
        ticks={7}
        style={st.metricVal}
      />
    ) : (
      <Text style={st.metricVal}>{value ?? String(numericValue ?? 0)}</Text>
    )}
    <Text style={st.metricLabel}>{label}</Text>
  </SpireStaggerItem>
);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  body: { padding: 14, gap: 12, maxWidth: 500, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: 16, borderWidth: 3, borderBottomWidth: 6, padding: 18, alignItems: 'center', gap: 8, overflow: 'hidden' },
  raysWrap: { position: 'absolute', top: -24, alignItems: 'center', justifyContent: 'center' },
  heroTitleBlock: { alignItems: 'center', gap: 6 },
  heroWin: { backgroundColor: DARK.panel, borderColor: COLORS.actionYellow },
  heroLose: { backgroundColor: '#2A181B', borderColor: '#DC2626' },
  ratingCard: { backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 14, gap: 6, alignItems: 'center' },
  ratingTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tierPillText: { fontSize: 10, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 1 },
  dailyTag: { fontSize: 10, fontWeight: '900', color: COLORS.actionYellow, letterSpacing: 0.8 },
  ratingValue: { fontSize: 22, fontWeight: '900', color: COLORS.canvasWhite, fontVariant: ['tabular-nums'] },
  ratingPercentile: { fontSize: 13, fontWeight: '800', color: '#99F6E4' },
  ratingTrack: { width: '100%', height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden', marginTop: 2 },
  ratingFill: { width: '100%', height: '100%', backgroundColor: COLORS.actionYellow, borderRadius: 999 },
  breakdownRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: 3 },
  breakdownChip: { fontSize: 10, fontWeight: '800', color: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, fontVariant: ['tabular-nums'] },
  sharePreview: { backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#D6CFC4', padding: 10, fontSize: 11, lineHeight: 16, color: INK, fontFamily: MONO_FONT },
  title: { fontSize: 26, fontWeight: '900', color: DARK.text, letterSpacing: 1, textAlign: 'center' },
  sub: { fontSize: 13, color: DARK.muted, textAlign: 'center', lineHeight: 19 },
  statsCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 14, gap: 10 },
  sec: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '30%', flexGrow: 1, minWidth: 92, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#D6CFC4', paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  metricVal: { fontSize: 15, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 10, fontWeight: '800', color: TONE.spent },
  gearWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scopeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.paperBeige,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: INK,
    padding: 1.5,
    gap: 2,
  },
  scopeBtn: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  scopeBtnActive: {
    backgroundColor: INK,
  },
  scopeBtnText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: INK,
  },
  scopeBtnTextActive: {
    color: COLORS.actionYellow,
  },
  actions: { gap: 8 },
});

export default SpireEndScreen;
