/**
 * [OB-20] Campaign Ending Ceremony (`5-5` The Hydra clear):
 *   Beat 1 (Star Restored): The Hydra fades and golden Star Shards reunite in the summit sky.
 *   Beat 2 (Full Crew Reunion): All rescued friends gather in Sunny Meadow with personalized stats.
 *   Beat 3 (Credits & Endless Torch-Pass): Clean credits card + Back to Map / Climb Starfall Summit.
 *
 * Skippable & pausable on every beat (`II` / `Esc`, `Skip`, Web `Enter`/`Space`),
 * pure GPU `transform`/`opacity` one-shot motion (zero infinite loops), reduced-motion safe.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { EASE, MS, SPRING } from '@/utils/motion';
import { band, sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave } from '../types';
import { STORY_ENDING_BEATS } from '../data/story';
import { maxStars, totalStarsEarned } from '../progress';
import { DARK, INK } from './ui';

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
  const stageH = Math.round(Math.max(210, Math.min(320, winH * 0.36)));

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const beat = STORY_ENDING_BEATS[i] ?? STORY_ENDING_BEATS[0];
  const last = i === STORY_ENDING_BEATS.length - 1;

  useEffect(() => {
    if (!visible) return;
    setI(0);
    setPaused(false);
    band.finale(true);
  }, [visible]);

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

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (paused) {
          sfx('click');
          setPaused(false);
        } else {
          advance();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, paused, togglePause, advance]);

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={handleSkip}>
      <View
        testID="story-ending-modal"
        style={[
          st.root,
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
            {beat.scene === 'star_restored' && <StarRestoredScene width={width} height={stageH} reduced={reduced} />}
            {beat.scene === 'reunion' && <ReunionScene crew={rescuedCrew} reduced={reduced} />}
            {beat.scene === 'credits' && <CreditsScene fighter={favoriteFighter} reduced={reduced} />}
          </View>

          <View style={st.words}>
            <Text style={st.eyebrow}>{beat.eyebrow}</Text>
            <Text testID="ending-title" style={st.title}>{beat.title}</Text>
            <Text style={st.body}>{beat.body}</Text>
          </View>

          {beat.scene === 'reunion' && (
            <View testID="ending-stats" style={st.statsGrid}>
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
            </View>
          )}

          {beat.scene === 'credits' && (
            <View testID="ending-credits-card" style={st.creditsCard}>
              <Text style={st.creditsTitle}>NSHAPES · STARFALL VALLEY</Text>
              <Text style={st.creditsLine}>59 Campaign Levels · 64 Armory Weapons · 6 Rescued Friends</Text>
              <Text style={st.creditsNote}>Built with joy for fast eyes, bold builds, and clever Trios.</Text>
            </View>
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
      </View>
    </Modal>
  );
};

const StarRestoredScene: React.FC<{ width: number; height: number; reduced: boolean }> = ({ width, height, reduced }) => {
  const hydraOpacity = useSharedValue(reduced ? 0.22 : 0.9);
  const starScale = useSharedValue(reduced ? 1 : 0.45);
  const starOpacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    hydraOpacity.value = withTiming(0.22, { duration: MS.hero, easing: EASE.exitSoft });
    starOpacity.value = withDelay(180, withTiming(1, { duration: MS.move, easing: EASE.ui }));
    starScale.value = withDelay(180, withSpring(1, SPRING.playful));
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
        <EnemyAvatar
          enemy={{ name: 'The Hydra', icon: 'lorc/hydra', tier: 4 }}
          size={72}
          mood="cornered"
          animate={false}
          lightweight
        />
      </Animated.View>
    </View>
  );
};

const ReunionScene: React.FC<{ crew: readonly CharacterName[]; reduced: boolean }> = ({ crew, reduced }) => {
  const pop = useSharedValue(reduced ? 1 : 0.85);
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    o.value = withTiming(1, { duration: MS.move, easing: EASE.ui });
    pop.value = withSpring(1, SPRING.lively);
    return () => {
      cancelAnimation(o);
      cancelAnimation(pop);
    };
  }, [reduced, o, pop]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: pop.value }] }));
  return (
    <View style={[st.sceneFill, st.reunionWrap]}>
      <View style={st.meadowHill} />
      <Animated.View testID="ending-crew-grid" style={[st.crewRow, style]}>
        {crew.map(name => (
          <View key={name} testID={`ending-crew-${name}`} style={st.crewChip}>
            <FighterAvatar character={name} size={62} mood="victory" animate={false} />
            <Text style={st.crewName} numberOfLines={1}>{name}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const CreditsScene: React.FC<{ fighter: CharacterName; reduced: boolean }> = ({ fighter, reduced }) => {
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    o.value = withTiming(1, { duration: MS.move, easing: EASE.ui });
    return () => cancelAnimation(o);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[st.sceneFill, st.creditsStage, style]}>
      <View style={st.trophyRing}>
        <FighterAvatar character={fighter} size={92} mood="victory" animate={false} />
      </View>
      <View style={st.crownPill}>
        <Icon name="lorc/trophy" size={16} color={INK} />
        <Text style={st.crownPillText}>CHAMPION OF STARFALL VALLEY</Text>
      </View>
    </Animated.View>
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
  stage: { overflow: 'hidden', borderRadius: 16, borderWidth: 1.5, borderColor: DARK.goldEdge(0.35), backgroundColor: 'rgba(10,12,24,0.35)' },
  sceneFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  reunionWrap: { padding: 12 },
  meadowHill: { position: 'absolute', left: -40, right: -40, bottom: -60, height: 120, borderRadius: 240, backgroundColor: '#295745' },
  crewRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  crewChip: { alignItems: 'center', width: 92, gap: 2 },
  crewName: { color: COLORS.canvasWhite, fontWeight: '800', fontSize: 11 },
  creditsStage: { gap: 12 },
  trophyRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#2B3354',
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
  statValue: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 15, textAlign: 'center' },
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
