/**
 * The cold open: three short beats that say why you are here, then straight
 * into the first fight. Plays once, the first time Adventure is opened.
 *
 * Tap anywhere to move on; Skip jumps to the fight. Every animation runs once
 * (nothing loops), and reduced motion shows each scene already settled.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { sfx } from '@/audio';
import type { CharacterName } from '@/types';
import { STORY, STORY_CRITTER_LEVELS, type StoryBeat } from '../data/story';
import { getLevel } from '../data/levels';
import { levelFoe } from '../data/foes';
import { INK } from './ui';

const NIGHT = '#141B33';
const DUSK = '#27305A';
const GOLD = COLORS.actionYellow;
const SCENE_H = 280;

/** Where the fixed stars sit, as fractions of the scene (hand-placed so none hides behind the mountain) */
const SKY: [number, number, number][] = [
  [0.08, 0.12, 3], [0.2, 0.3, 2], [0.31, 0.08, 2], [0.44, 0.2, 3], [0.58, 0.07, 2], [0.7, 0.26, 2],
  [0.83, 0.1, 3], [0.93, 0.32, 2], [0.14, 0.5, 2], [0.88, 0.52, 2], [0.5, 0.42, 2], [0.26, 0.6, 2],
];

/** Where each shard flies once the star breaks: [dx, dy] in scene widths/heights */
const SHARDS: [number, number][] = [[-0.34, 0.1], [-0.2, -0.16], [-0.06, -0.26], [0.1, -0.22], [0.24, -0.1], [0.36, 0.12], [0.02, 0.2]];

interface Props {
  fighter: CharacterName;
  onDone: () => void;
}

const StoryIntro: React.FC<Props> = ({ fighter, onDone }) => {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, 480);
  const beats = STORY.welcome;
  const [i, setI] = useState(0);
  const beat = beats[i];
  const last = i === beats.length - 1;

  const next = () => {
    if (last) {
      sfx('confirm');
      onDone();
    } else {
      sfx('click');
      setI(i + 1);
    }
  };

  return (
    <View testID="story-intro" style={[st.root, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={st.topRow}>
        <View style={st.dots}>
          {beats.map((_, k) => <View key={k} style={[st.dot, k === i && st.dotOn, k < i && st.dotDone]} />)}
        </View>
        {!last && (
          <TouchableOpacity testID="story-skip" onPress={() => { sfx('click'); onDone(); }} style={st.skip} accessibilityRole="button" accessibilityLabel="Skip the story">
            <Text style={st.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tap anywhere on the scene or the words to move on */}
      <TouchableOpacity activeOpacity={1} onPress={next} style={st.body} accessibilityRole="button" accessibilityLabel={`${beat.title} ${beat.body} Tap to continue`}>
        <View style={[st.scene, { width, height: SCENE_H }]}>
          <Scene key={i} beat={beat} width={width} fighter={fighter} />
        </View>
        <Words key={`w${i}`} beat={beat} fighter={fighter} />
      </TouchableOpacity>

      <View style={st.footer}>
        <TouchableOpacity testID="story-next" onPress={next} style={st.cta} activeOpacity={0.85} accessibilityRole="button">
          <Text style={st.ctaText}>{last ? 'Let’s go!' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/** The words of a beat rise in a moment after its scene starts. */
const Words: React.FC<{ beat: StoryBeat; fighter: CharacterName }> = ({ beat, fighter }) => {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) p.value = withDelay(beat.scene === 'starfall' ? 950 : 250, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    // once per beat (the component is keyed by beat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 10 }] }));
  return (
    <Animated.View style={[st.words, style]}>
      {beat.spoken && <Text style={st.speaker}>{fighter}</Text>}
      <Text style={st.title}>{beat.spoken ? `“${beat.title}”` : beat.title}</Text>
      <Text style={st.text}>{beat.body}</Text>
    </Animated.View>
  );
};

const Scene: React.FC<{ beat: StoryBeat; width: number; fighter: CharacterName }> = ({ beat, width, fighter }) => {
  switch (beat.scene) {
    case 'starfall': return <Starfall width={width} />;
    case 'critters': return <Critters width={width} />;
    case 'hero': return <Hero width={width} fighter={fighter} />;
  }
};

const Sky: React.FC<{ width: number }> = ({ width }) => (
  <>
    {SKY.map(([x, y, s], k) => (
      <View key={k} style={[st.skyStar, { left: x * width, top: y * SCENE_H, width: s, height: s, borderRadius: s / 2 }]} />
    ))}
  </>
);

/** The Summit: a far peak with a snow cap. */
const Mountain: React.FC<{ width: number }> = ({ width }) => {
  const peak = { x: width * 0.5, y: SCENE_H * 0.36 };
  const base = SCENE_H;
  return (
    <Svg width={width} height={SCENE_H} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Polygon points={`${width * 0.02},${base} ${width * 0.3},${SCENE_H * 0.62} ${width * 0.46},${base}`} fill="#1D2547" />
      <Polygon points={`${width * 0.6},${base} ${width * 0.8},${SCENE_H * 0.58} ${width},${base}`} fill="#1D2547" />
      <Polygon points={`${width * 0.14},${base} ${peak.x},${peak.y} ${width * 0.86},${base}`} fill={DUSK} />
      <Polygon points={`${peak.x - width * 0.09},${peak.y + SCENE_H * 0.16} ${peak.x},${peak.y} ${peak.x + width * 0.09},${peak.y + SCENE_H * 0.16} ${peak.x + width * 0.03},${peak.y + SCENE_H * 0.12} ${peak.x - width * 0.02},${peak.y + SCENE_H * 0.17}`} fill="#E8ECFF" />
    </Svg>
  );
};

/** Beat 1: the star streaks down to the peak, flashes, and breaks into shards. */
const Starfall: React.FC<{ width: number }> = ({ width }) => {
  const reduced = useReducedMotion();
  const fall = useSharedValue(reduced ? 1 : 0);
  const burst = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    fall.value = withDelay(250, withTiming(1, { duration: 620, easing: Easing.in(Easing.quad) }));
    burst.value = withDelay(870, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    const t = setTimeout(() => sfx('unlock'), 870);
    return () => clearTimeout(t);
    // once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const from = { x: width * 0.92, y: -30 };
  const to = { x: width * 0.5, y: SCENE_H * 0.36 };
  const starStyle = useAnimatedStyle(() => ({
    opacity: fall.value >= 1 ? 0 : 1,
    transform: [
      { translateX: from.x + (to.x - from.x) * fall.value - 26 },
      { translateY: from.y + (to.y - from.y) * fall.value - 26 },
      { rotate: `${fall.value * 200}deg` },
      { scale: 0.7 + 0.5 * fall.value },
    ],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: burst.value <= 0 ? 0 : Math.max(0, 0.85 - burst.value * 1.6),
    transform: [{ scale: 0.4 + burst.value * 2.4 }],
  }));
  return (
    <>
      <Sky width={width} />
      <Mountain width={width} />
      <Animated.View pointerEvents="none" style={[st.flash, { left: to.x - 60, top: to.y - 60 }, flashStyle]} />
      {SHARDS.map(([dx, dy], k) => <Shard key={k} burst={burst} at={to} dx={dx * width} dy={dy * SCENE_H} big={k % 3 === 0} />)}
      <Animated.View pointerEvents="none" style={[st.abs, starStyle]}>
        <Text style={st.bigStar}>★</Text>
      </Animated.View>
    </>
  );
};

/** One piece of the broken star: flung out from the peak, then it settles a little lower. */
const Shard: React.FC<{ burst: ReturnType<typeof useSharedValue<number>>; at: { x: number; y: number }; dx: number; dy: number; big: boolean }> = ({ burst, at, dx, dy, big }) => {
  const size = big ? 26 : 18;
  const style = useAnimatedStyle(() => {
    const t = burst.value;
    return {
      opacity: t <= 0 ? 0 : 1,
      transform: [
        { translateX: at.x + dx * t - size / 2 },
        // out and up first, then gravity
        { translateY: at.y + dy * t + 46 * t * t - size / 2 },
        { rotate: `${t * 140 * (dx < 0 ? -1 : 1)}deg` },
        { scale: 0.5 + 0.5 * Math.min(1, t * 2) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[st.abs, style]}>
      <Text style={{ fontSize: size, lineHeight: size * 1.1, color: GOLD }}>★</Text>
    </Animated.View>
  );
};

/** Beat 2: three critters, each with a shard over its head. */
const Critters: React.FC<{ width: number }> = ({ width }) => {
  const size = Math.min(104, Math.floor((width - 48) / 3));
  return (
    <>
      <Sky width={width} />
      <View style={[st.ground, { backgroundColor: '#1D2547' }]} />
      <View style={st.critterRow}>
        {STORY_CRITTER_LEVELS.map((id, k) => (
          <Rise key={id} delay={k * 140}>
            <Text style={st.critterShard}>★</Text>
            <EnemyAvatar enemy={levelFoe(getLevel(id))} size={k === 1 ? size : Math.round(size * 0.86)} mood={k === 1 ? 'menacing' : 'idle'} reaction={{ type: 'entrance', id: k + 1 }} />
          </Rise>
        ))}
      </View>
    </>
  );
};

/** Beat 3: your fighter, front and centre. */
const Hero: React.FC<{ width: number; fighter: CharacterName }> = ({ width, fighter }) => (
  <>
    <Sky width={width} />
    <View style={[st.ground, { backgroundColor: '#1D2547' }]} />
    <View style={st.heroWrap}>
      <Rise delay={0}>
        <FighterAvatar character={fighter} size={Math.min(170, width * 0.44)} mood="anticipation" reaction={{ type: 'entrance', id: 1 }} />
      </Rise>
    </View>
  </>
);

/** Its children pop up into place once. */
const Rise: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) p.value = withDelay(delay, withSequence(withTiming(1.08, { duration: 220, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 140 })));
    // once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 2), transform: [{ translateY: (1 - Math.min(1, p.value)) * 24 }, { scale: 0.7 + 0.3 * p.value }] }));
  return <Animated.View style={[{ alignItems: 'center' }, style]}>{children}</Animated.View>;
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT, alignItems: 'center' },
  topRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 36, paddingHorizontal: 16 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { width: 20, backgroundColor: GOLD },
  dotDone: { backgroundColor: 'rgba(255,222,0,0.55)' },
  skip: { position: 'absolute', right: 12, paddingHorizontal: 10, paddingVertical: 6 },
  skipText: { color: '#B9C0E0', fontWeight: '800', fontSize: 14 },
  body: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 18 },
  scene: { overflow: 'hidden' },
  abs: { position: 'absolute', left: 0, top: 0 },
  skyStar: { position: 'absolute', backgroundColor: '#E8ECFF', opacity: 0.8 },
  flash: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFF6C2' },
  bigStar: { fontSize: 52, lineHeight: 56, color: GOLD, textShadowColor: '#FFF6C2', textShadowRadius: 12 },
  ground: { position: 'absolute', left: -40, right: -40, bottom: -70, height: 150, borderRadius: 300 },
  critterRow: { position: 'absolute', left: 0, right: 0, bottom: 26, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  critterShard: { fontSize: 22, lineHeight: 26, color: GOLD, textShadowColor: '#FFF6C2', textShadowRadius: 8 },
  heroWrap: { position: 'absolute', left: 0, right: 0, bottom: 30, alignItems: 'center' },
  words: { alignSelf: 'stretch', alignItems: 'center', gap: 8, paddingHorizontal: 24, minHeight: 124 },
  speaker: { color: GOLD, fontWeight: '900', letterSpacing: 2, fontSize: 11, textTransform: 'uppercase' },
  title: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 26, lineHeight: 31, textAlign: 'center' },
  text: { color: '#D5DAF2', fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 380 },
  footer: { alignSelf: 'stretch', paddingHorizontal: 20, alignItems: 'center' },
  cta: { alignSelf: 'stretch', maxWidth: 440, width: '100%', backgroundColor: GOLD, borderRadius: 10, borderWidth: 2, borderBottomWidth: 5, borderColor: INK, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: INK, fontWeight: '900', fontSize: 17, letterSpacing: 1.5, textTransform: 'uppercase' },
});

export default StoryIntro;
