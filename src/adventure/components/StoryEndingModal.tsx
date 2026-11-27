/**
 * [OB-20] Campaign Ending Ceremony (`5-5` The Hydra clear):
 *   Beat 1 (Star Restored): The Hydra breathes heavily and recedes as golden Star Shards reunite.
 *   Beat 2 (Full Crew Reunion): Painted sunrise meadow plate (`story-ending-plate.png`) with all
 *           rescued friends hopping in on a celebratory stagger and breathing alive out-of-phase.
 *   Beat 3 (Credits & Endless Torch-Pass): Living Champion portrait + credits card + Starfall Summit CTA.
 *
 * Skippable & pausable on every beat (`II` / `Esc`, `Skip`, Web `Enter`/`Space`),
 * pure GPU `transform`/`opacity` + lightweight GPU breathing (zero extra frame loops),
 * reduced-motion safe with `STAYS`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { MotionModal, useModalMotion } from '@/components/ScreenTransition';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { KEY_PRIORITY, useKeyboardNav } from '@/hooks/useKeyboardNav';
import { COLORS } from '@/utils/colors';
import {
  EASE,
  MS,
  OVERLAP,
  SPRING,
  STAGGER,
  STAYS,
  reducedMs,
  staggerDelay,
} from '@/utils/motion';
import { band, sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave } from '../types';
import { STORY_ENDING_BEATS } from '../data/story';
import { maxStars, totalStarsEarned } from '../progress';
import { LivingBreath } from './CompanionBubble';
import { DARK, INK } from './ui';

const STORY_ENDING_PLATE = require('../../../assets/backdrops/story-ending-plate.png');

const NIGHT = '#141B33';
const SUMMIT_DUSK = '#26214D';
const MEADOW_SKY = '#1D3E36';
const GOLD = COLORS.actionYellow;

const SKY_STARS: [number, number, number][] = [
  [0.1, 0.12, 3], [0.24, 0.22, 2], [0.38, 0.09, 2], [0.5, 0.16, 3],
  [0.64, 0.1, 2], [0.78, 0.24, 2], [0.89, 0.12, 3], [0.16, 0.36, 2],
];

const favoriteFighterOf = (save: AdventureSave): CharacterName => {
  const entries = Object.entries(save.bountyStats.fighterWins ?? {}) as [CharacterName, number][];
  if (entries.length === 0) return save.selectedFighter;
  entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return entries[0][0] ?? save.selectedFighter;
};

interface Props {
  visible: boolean;
  save: AdventureSave;
  onDone: () => void;
  onOpenSummit?: () => void;
}

const StoryEndingModal: React.FC<Props> = ({ visible, save, onDone, onOpenSummit }) => {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width: winW, height: winH } = useWindowDimensions();
  const width = Math.min(winW, 480);
  const stageH = Math.round(Math.max(220, Math.min(320, winH * 0.36)));

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const modal = useModalMotion(visible, { travelY: 18 });

  const beat = STORY_ENDING_BEATS[i] ?? STORY_ENDING_BEATS[0];
  const last = i === STORY_ENDING_BEATS.length - 1;

  // Beat copy & stats smooth directional settle on beat transitions
  const beatO = useSharedValue(1);
  const beatY = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    setI(0);
    setPaused(false);
    band.finale(true);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      beatY.value = 0;
      beatO.value = 0;
      beatO.value = withTiming(1, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS });
    } else {
      beatO.value = 0;
      beatY.value = 12;
      beatO.value = withDelay(
        OVERLAP.uiContentMs,
        withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS }),
        STAYS.reduceMotion
      );
      beatY.value = withDelay(
        OVERLAP.uiContentMs,
        withTiming(0, { duration: MS.move, easing: EASE.enterSoft })
      );
    }
    return () => {
      cancelAnimation(beatO);
      cancelAnimation(beatY);
    };
  }, [i, visible, reduced, beatO, beatY]);

  const beatCopyStyle = useAnimatedStyle(() => ({
    opacity: beatO.value,
    transform: [{ translateY: beatY.value }],
  }));

  const earnedStars = useMemo(() => totalStarsEarned(save), [save]);
  const totalPossibleStars = useMemo(() => maxStars(), []);
  const favoriteFighter = useMemo(() => favoriteFighterOf(save), [save]);
  const rescuedCrew = save.unlockedFighters.length > 0 ? save.unlockedFighters : [save.selectedFighter];

  const advance = useCallback(() => {
    setPaused(false);
    if (last) {
      sfx('confirm');
      onDone();
    } else {
      sfx('click');
      setI(cur => Math.min(STORY_ENDING_BEATS.length - 1, cur + 1));
    }
  }, [last, onDone]);

  const handleSkip = useCallback(() => {
    sfx('click');
    onDone();
  }, [onDone]);

  const togglePause = useCallback(() => {
    sfx('click');
    setPaused(p => !p);
  }, []);

  // [UI-23] Unified web keyboard shortcuts (`Enter`/`Space` advance or resume, `Esc` pause/resume)
  useKeyboardNav({
    enabled: visible,
    priority: KEY_PRIORITY.OVERLAY,
    onCancel: togglePause,
    onConfirm: () => {
      if (paused) {
        sfx('click');
        setPaused(false);
      } else {
        advance();
      }
    },
  });

  if (!modal.rendered) return null;

  return (
    <MotionModal visible={modal.rendered} interactive={!modal.closing} transparent onRequestClose={handleSkip}>
      <Animated.View
        testID="story-ending-modal"
        pointerEvents={modal.closing ? 'none' : 'auto'}
        style={[
          st.root,
          modal.backdropStyle,
          {
            backgroundColor: beat.scene === 'reunion' ? MEADOW_SKY : NIGHT,
            paddingTop: insets.top + 8,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={st.topRow}>
          <TouchableOpacity
            testID="ending-pause"
            onPress={togglePause}
            style={st.pauseBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={paused ? 'Resume ending' : 'Pause ending'}
          >
            <Text style={st.pauseText}>{paused ? '▶' : 'II'}</Text>
          </TouchableOpacity>
          <View style={st.dots}>
            {STORY_ENDING_BEATS.map((_, k) => (
              <View key={k} style={[st.dot, k === i && st.dotOn, k < i && st.dotDone]} />
            ))}
          </View>
          <TouchableOpacity
            testID="ending-skip"
            onPress={handleSkip}
            style={st.skipBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Skip ending ceremony"
          >
            <Text style={st.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {paused && (
          <TouchableOpacity
            testID="ending-paused-pill"
            onPress={togglePause}
            style={st.pausedPill}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={st.pausedPillText}>PAUSED — Tap to resume</Text>
          </TouchableOpacity>
        )}

        <ScrollView contentContainerStyle={st.scroll} bounces={false}>
          <View style={[st.stage, { width, height: stageH }]}>
            {beat.scene === 'star_restored' && (
              <StarRestoredScene width={width} height={stageH} reduced={reduced} paused={paused} />
            )}
            {beat.scene === 'reunion' && (
              <ReunionScene crew={rescuedCrew} reduced={reduced} paused={paused} />
            )}
            {beat.scene === 'credits' && (
              <CreditsScene fighter={favoriteFighter} reduced={reduced} paused={paused} />
            )}
          </View>

          <Animated.View style={[st.words, beatCopyStyle]}>
            <Text style={st.eyebrow}>{beat.eyebrow}</Text>
            <Text testID="ending-title" style={st.title}>{beat.title}</Text>
            <Text style={st.body}>{beat.body}</Text>
          </Animated.View>

          {beat.scene === 'reunion' && (
            <Animated.View testID="ending-stats" style={[st.statsGrid, beatCopyStyle]}>
              <View testID="ending-stat-stars" style={st.statCard}>
                <Icon name="lorc/flat-star" size={18} color={GOLD} />
                <Text style={st.statValue}>{earnedStars} / {totalPossibleStars}</Text>
                <Text style={st.statLabel}>Star Shards</Text>
              </View>
              <View testID="ending-stat-favorite" style={st.statCard}>
                <Icon name="lorc/crown" size={18} color={GOLD} />
                <Text style={st.statValue} numberOfLines={1}>{favoriteFighter}</Text>
                <Text style={st.statLabel}>Favorite Fighter</Text>
              </View>
              <View testID="ending-stat-sets" style={st.statCard}>
                <Icon name="lorc/checked-shield" size={18} color={GOLD} />
                <Text style={st.statValue}>{save.bountyStats.totalSets.toLocaleString()}</Text>
                <Text style={st.statLabel}>Sets Matched</Text>
              </View>
            </Animated.View>
          )}

          {beat.scene === 'credits' && (
            <Animated.View testID="ending-credits-card" style={[st.creditsCard, beatCopyStyle]}>
              <Text style={st.creditsTitle}>NSHAPES · STARFALL VALLEY</Text>
              <Text style={st.creditsLine}>59 Campaign Levels · 64 Armory Weapons · 6 Rescued Friends</Text>
              <Text style={st.creditsNote}>Built with joy for fast eyes, bold builds, and clever Trios.</Text>
            </Animated.View>
          )}
        </ScrollView>

        <View style={st.footer}>
          {last && onOpenSummit && (
            <TouchableOpacity
              testID="ending-summit"
              onPress={() => {
                sfx('confirm');
                onDone();
                onOpenSummit();
              }}
              style={st.summitBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Icon name="delapouite/falling-star" size={18} color={INK} />
              <Text style={st.ctaText}>Climb Starfall Summit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            testID={last ? 'ending-done' : 'ending-next'}
            onPress={advance}
            style={[st.cta, last && onOpenSummit && st.ctaSecondary]}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={[st.ctaText, last && onOpenSummit && st.ctaSecondaryText]}>
              {last ? 'Back to Map' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </MotionModal>
  );
};

const StarRestoredScene: React.FC<{ width: number; height: number; reduced: boolean; paused: boolean }> = ({
  width,
  height,
  reduced,
  paused,
}) => {
  const hydraOpacity = useSharedValue(reduced ? 0.28 : 0.92);
  const starScale = useSharedValue(reduced ? 1 : 0.45);
  const starOpacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      hydraOpacity.value = 0.28;
      starOpacity.value = withTiming(1, { duration: reducedMs(MS.move), easing: EASE.ui, ...STAYS });
      starScale.value = 1;
      return;
    }
    hydraOpacity.value = withTiming(0.28, { duration: MS.hero, easing: EASE.exitSoft });
    starOpacity.value = withDelay(MS.quick, withTiming(1, { duration: MS.move, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
    starScale.value = withDelay(MS.quick, withSpring(1, SPRING.playful));
    return () => {
      cancelAnimation(hydraOpacity);
      cancelAnimation(starOpacity);
      cancelAnimation(starScale);
    };
  }, [reduced, hydraOpacity, starOpacity, starScale]);

  const hydraStyle = useAnimatedStyle(() => ({ opacity: hydraOpacity.value }));
  const starStyle = useAnimatedStyle(() => ({
    opacity: starOpacity.value,
    transform: [{ scale: starScale.value }],
  }));

  return (
    <View style={st.sceneFill}>
      {SKY_STARS.map(([x, y, s], k) => (
        <View key={k} style={[st.skyStar, { left: x * width, top: y * height, width: s, height: s, borderRadius: s / 2 }]} />
      ))}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Polygon points={`0,${height} ${width * 0.28},${height * 0.42} ${width * 0.6},${height}`} fill={SUMMIT_DUSK} />
        <Polygon points={`${width * 0.42},${height} ${width * 0.78},${height * 0.36} ${width},${height}`} fill="#1F2954" />
      </Svg>
      <Animated.View style={[st.starMedallion, starStyle]}>
        <Icon name="delapouite/star-formation" size={64} color={GOLD} />
      </Animated.View>
      <Animated.View style={[st.hydraFadeWrap, hydraStyle]}>
        <LivingBreath seedKey="ending-hydra" size={72} active={!paused}>
          <EnemyAvatar
            enemy={{ name: 'The Hydra', icon: 'lorc/hydra', tier: 4 }}
            size={72}
            mood="cornered"
            animate={false}
            lightweight
          />
        </LivingBreath>
      </Animated.View>
    </View>
  );
};

const ReunionFriendChip: React.FC<{
  name: CharacterName;
  index: number;
  total: number;
  reduced: boolean;
  paused: boolean;
}> = ({ name, index, total, reduced, paused }) => {
  const delay = staggerDelay(index, total, STAGGER.item);
  const o = useSharedValue(reduced ? 0 : 0);
  const y = useSharedValue(reduced ? 0 : 18);
  const sx = useSharedValue(1);
  const sy = useSharedValue(reduced ? 1 : 0.84);

  useEffect(() => {
    if (reduced) {
      y.value = 0;
      sx.value = 1;
      sy.value = 1;
      o.value = withTiming(1, { duration: reducedMs(MS.move), easing: EASE.ui, ...STAYS });
    } else {
      o.value = withDelay(delay, withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
      y.value = withDelay(
        delay,
        withSequence(
          withTiming(-6, { duration: MS.quick, easing: EASE.enter }),
          withSpring(0, SPRING.playful)
        )
      );
      // Celebratory volume-preserving landing squash & spring recovery
      sy.value = withDelay(
        delay,
        withSequence(
          withTiming(1.12, { duration: MS.feedback, easing: EASE.enter }),
          withTiming(0.88, { duration: OVERLAP.secondaryMs, easing: EASE.ui }),
          withSpring(1, SPRING.lively)
        )
      );
      sx.value = withDelay(
        delay,
        withSequence(
          withTiming(1 / 1.12, { duration: MS.feedback, easing: EASE.enter }),
          withTiming(1 / 0.88, { duration: OVERLAP.secondaryMs, easing: EASE.ui }),
          withSpring(1, SPRING.lively)
        )
      );
    }
    return () => {
      cancelAnimation(o);
      cancelAnimation(y);
      cancelAnimation(sx);
      cancelAnimation(sy);
    };
  }, [delay, reduced, o, y, sx, sy]);

  const chipStyle = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }, { scaleX: sx.value }, { scaleY: sy.value }],
  }));

  return (
    <Animated.View testID={`ending-crew-${name}`} style={[st.crewChip, chipStyle]}>
      <LivingBreath seedKey={`ending-reunion-${name}`} size={62} active={!paused} amplitude={0.036}>
        <FighterAvatar character={name} size={62} mood="victory" animate={false} />
      </LivingBreath>
      <View style={st.crewNamePill}>
        <Text style={st.crewName} numberOfLines={1}>{name}</Text>
      </View>
    </Animated.View>
  );
};

const ReunionScene: React.FC<{ crew: readonly CharacterName[]; reduced: boolean; paused: boolean }> = ({
  crew,
  reduced,
  paused,
}) => {
  const plateO = useSharedValue(reduced ? 1 : 0);
  const plateS = useSharedValue(reduced ? 1 : 1.09);

  useEffect(() => {
    if (reduced) {
      plateO.value = withTiming(1, { duration: reducedMs(MS.move), easing: EASE.ui, ...STAYS });
      plateS.value = 1;
      return;
    }
    plateO.value = withTiming(1, { duration: MS.move, easing: EASE.ui, ...STAYS });
    plateS.value = withTiming(1, { duration: MS.panel, easing: EASE.enterSoft });
    return () => {
      cancelAnimation(plateO);
      cancelAnimation(plateS);
    };
  }, [reduced, plateO, plateS]);

  const plateStyle = useAnimatedStyle(() => ({
    opacity: plateO.value,
    transform: [{ scale: plateS.value }],
  }));

  return (
    <View style={[st.sceneFill, st.reunionWrap]}>
      <Animated.View style={[StyleSheet.absoluteFill, plateStyle]} pointerEvents="none">
        <Image
          testID="story-ending-backdrop"
          source={STORY_ENDING_PLATE}
          resizeMode="cover"
          style={st.backdropImage}
        />
        <View style={st.reunionScrim} />
      </Animated.View>
      <View testID="ending-crew-grid" style={st.crewRow}>
        {crew.map((name, idx) => (
          <ReunionFriendChip
            key={name}
            name={name}
            index={idx}
            total={crew.length}
            reduced={reduced}
            paused={paused}
          />
        ))}
      </View>
    </View>
  );
};

const CreditsScene: React.FC<{ fighter: CharacterName; reduced: boolean; paused: boolean }> = ({
  fighter,
  reduced,
  paused,
}) => {
  const ringO = useSharedValue(0);
  const ringS = useSharedValue(reduced ? 1 : 0.86);
  const pillO = useSharedValue(0);
  const pillY = useSharedValue(reduced ? 0 : 10);

  useEffect(() => {
    if (reduced) {
      ringS.value = 1;
      pillY.value = 0;
      ringO.value = withTiming(1, { duration: reducedMs(MS.move), easing: EASE.ui, ...STAYS });
      pillO.value = withTiming(1, { duration: reducedMs(MS.move), easing: EASE.ui, ...STAYS });
    } else {
      ringO.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS });
      ringS.value = withSpring(1, SPRING.lively);
      pillO.value = withDelay(
        OVERLAP.secondaryMs,
        withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS }),
        STAYS.reduceMotion
      );
      pillY.value = withDelay(
        OVERLAP.secondaryMs,
        withTiming(0, { duration: MS.quick, easing: EASE.enter })
      );
    }
    return () => {
      cancelAnimation(ringO);
      cancelAnimation(ringS);
      cancelAnimation(pillO);
      cancelAnimation(pillY);
    };
  }, [reduced, ringO, ringS, pillO, pillY]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringO.value,
    transform: [{ scale: ringS.value }],
  }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillO.value,
    transform: [{ translateY: pillY.value }],
  }));

  return (
    <View style={[st.sceneFill, st.creditsStage]}>
      <Image
        source={STORY_ENDING_PLATE}
        resizeMode="cover"
        style={[st.backdropImage, { opacity: 0.34 }]}
      />
      <Animated.View style={[st.trophyRing, ringStyle]}>
        <LivingBreath seedKey={`ending-champion-${fighter}`} size={92} active={!paused} amplitude={0.036}>
          <FighterAvatar character={fighter} size={92} mood="victory" animate={false} />
        </LivingBreath>
      </Animated.View>
      <Animated.View style={[st.crownPill, pillStyle]}>
        <Icon name="lorc/trophy" size={16} color={INK} />
        <Text style={st.crownPillText}>CHAMPION OF STARFALL VALLEY</Text>
      </Animated.View>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  topRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  pauseBtn: {
    position: 'absolute',
    left: 10,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: { color: '#E8ECFF', fontWeight: '900', fontSize: 13 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { width: 20, backgroundColor: GOLD },
  dotDone: { backgroundColor: 'rgba(255,222,0,0.55)' },
  skipBtn: { position: 'absolute', right: 10, minWidth: 44, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: '#D5DAF2', fontWeight: '800', fontSize: 14 },
  pausedPill: {
    marginTop: 4,
    backgroundColor: 'rgba(255,222,0,0.16)',
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pausedPillText: { color: GOLD, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 12 },
  stage: { overflow: 'hidden', borderRadius: 16, borderWidth: 2, borderColor: DARK.goldEdge(0.5), backgroundColor: 'rgba(10,12,24,0.35)' },
  sceneFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdropImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  reunionScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18, 22, 16, 0.14)' },
  skyStar: { position: 'absolute', backgroundColor: '#E8ECFF', opacity: 0.85 },
  starMedallion: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,222,0,0.18)',
    borderWidth: 3,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hydraFadeWrap: { position: 'absolute', bottom: 10, right: 16 },
  reunionWrap: { paddingHorizontal: 12, paddingTop: 44, justifyContent: 'flex-end', paddingBottom: 8 },
  crewRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: 6, columnGap: 8 },
  crewChip: { alignItems: 'center', width: 92, gap: 3 },
  crewNamePill: {
    backgroundColor: 'rgba(22, 20, 18, 0.78)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 253, 247, 0.28)',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    maxWidth: 92,
  },
  crewName: { color: COLORS.ivoryCard, fontWeight: '800', fontSize: 10.5 },
  creditsStage: { gap: 12 },
  trophyRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(28, 33, 56, 0.9)',
    borderWidth: 3,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GOLD,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: INK,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  crownPillText: { color: INK, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  words: { alignItems: 'center', gap: 6, maxWidth: 420 },
  eyebrow: { color: GOLD, fontWeight: '900', letterSpacing: 2.2, fontSize: 11, textTransform: 'uppercase' },
  title: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 25, lineHeight: 30, textAlign: 'center' },
  body: { color: '#D5DAF2', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 440 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(28,27,25,0.75)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: DARK.goldEdge(0.35),
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  statValue: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 15, textAlign: 'center', fontVariant: ['tabular-nums'] },
  statLabel: { color: DARK.muted, fontWeight: '700', fontSize: 11, textAlign: 'center' },
  creditsCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: DARK.panel,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: DARK.goldEdge(0.4),
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  creditsTitle: { color: GOLD, fontWeight: '900', letterSpacing: 1.8, fontSize: 13 },
  creditsLine: { color: DARK.text, fontWeight: '800', fontSize: 13, textAlign: 'center' },
  creditsNote: { color: DARK.muted, fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  footer: { alignSelf: 'stretch', paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  summitBtn: {
    alignSelf: 'stretch',
    maxWidth: 440,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 10,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: INK,
    paddingVertical: 14,
  },
  cta: {
    alignSelf: 'stretch',
    maxWidth: 440,
    width: '100%',
    backgroundColor: GOLD,
    borderRadius: 10,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: INK,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: DARK.goldEdge(0.45),
    borderBottomWidth: 3,
  },
  ctaText: { color: INK, fontWeight: '900', fontSize: 16, letterSpacing: 1.4, textTransform: 'uppercase' },
  ctaSecondaryText: { color: COLORS.canvasWhite },
});

export default StoryEndingModal;
