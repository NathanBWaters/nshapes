/**
 * The cold open: three short beats showing wild critters caging your animal
 * friends, Golden Keys scattered along the road so you can free whoever you
 * pick first, and your fighter ready to dive straight into the first battle.
 *
 * Tap anywhere to move on; Skip jumps to the fight. Every animation runs once
 * (nothing loops), uses `src/utils/motion.ts` tokens on GPU transform/opacity
 * only, and reduced motion shows every scene already settled cleanly on f0.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '@/components/Card';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { EASE, MS, SPRING, STAYS } from '@/utils/motion';
import { band, sfx } from '@/audio';
import type { Card as CardType, CharacterName } from '@/types';
import { STORY, STORY_CAPTIVE_FRIENDS, STORY_RAIDER_LEVELS, type StoryBeat } from '../data/story';
import { getLevel } from '../data/levels';
import { levelFoe } from '../data/foes';
import { CageBarsSvg, CagePadlockSvg, GoldenKeyArt } from './RescueArt';
import { INK } from './ui';

const NIGHT = '#141B33';
const DUSK = '#27305A';
const GOLD = COLORS.actionYellow;
/** The scene is as tall as the screen can spare (a short phone still has room for the words) */
const sceneHeightFor = (windowHeight: number): number => Math.round(Math.max(230, Math.min(380, windowHeight * 0.43)));

/** Fixed stars in the valley night sky */
const SKY: [number, number, number][] = [
  [0.08, 0.1, 3], [0.22, 0.24, 2], [0.34, 0.08, 2], [0.5, 0.14, 3], [0.64, 0.07, 2], [0.76, 0.22, 2],
  [0.88, 0.1, 3], [0.93, 0.3, 2], [0.14, 0.42, 2], [0.87, 0.44, 2],
];

/** Abduction choreography timings (ms) — derived from `src/utils/motion.ts` tokens */
const RAIDER_START_MS = 80;                  // f5: raiders swoop in
const CAGE_FIRST_MS = 240;                   // f15: first cage starts dropping
const CAGE_GAP_MS = 32;                      // tight 2-frame ripple across the 3 cages
const CAGE_DROP_MS = MS.quick;               // 180 ms impact fall
const CAGE_ALL_LANDED_MS = CAGE_FIRST_MS + CAGE_GAP_MS * 2 + CAGE_DROP_MS; // 484 ms (~f30)
const KEY_SCATTER_FIRST_MS = CAGE_ALL_LANDED_MS + 32;  // 516 ms: keys pop out right after all 3 cages slam
const ABDUCTION_WORDS_MS = CAGE_ALL_LANDED_MS + 96;    // 580 ms: title rises cleanly once cages settle

interface Props {
  fighter: CharacterName;
  onDone: () => void;
}

const StoryIntro: React.FC<Props> = ({ fighter, onDone }) => {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const width = Math.min(winW, 480);
  const sceneH = sceneHeightFor(winH);
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
        <View style={[st.scene, { width, height: sceneH }]}>
          <Scene key={i} beat={beat} width={width} height={sceneH} fighter={fighter} />
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

/** The words of a beat rise in smoothly right on the hero moment (or appear settled under reduced motion). */
const Words: React.FC<{ beat: StoryBeat; fighter: CharacterName }> = ({ beat, fighter }) => {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) {
      const delay = beat.scene === 'abduction' ? ABDUCTION_WORDS_MS : MS.quick;
      p.value = withDelay(delay, withTiming(1, { duration: MS.move, easing: EASE.enterSoft }));
    }
    // once per beat (keyed by beat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 10 }],
  }));
  return (
    <Animated.View style={[st.words, style]}>
      {beat.spoken && <Text style={st.speaker}>{fighter}</Text>}
      <Text style={st.title}>{beat.spoken ? `“${beat.title}”` : beat.title}</Text>
      <Text style={st.text}>{beat.body}</Text>
    </Animated.View>
  );
};

interface SceneSize { width: number; height: number }

const Scene: React.FC<SceneSize & { beat: StoryBeat; fighter: CharacterName }> = ({ beat, width, height, fighter }) => {
  switch (beat.scene) {
    case 'abduction': return <Abduction width={width} height={height} />;
    case 'keys': return <KeysRoad width={width} height={height} />;
    case 'hero': return <Hero width={width} height={height} fighter={fighter} />;
  }
};

const Sky: React.FC<SceneSize> = ({ width, height }) => (
  <>
    {SKY.map(([x, y, s], k) => (
      <View key={k} style={[st.skyStar, { left: x * width, top: y * height, width: s, height: s, borderRadius: s / 2 }]} />
    ))}
  </>
);

/** Distant valley silhouettes behind the meadow stage. */
const ValleyBackdrop: React.FC<SceneSize> = ({ width, height: h }) => {
  const base = h;
  return (
    <Svg width={width} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Polygon points={`0,${base} ${width * 0.24},${h * 0.44} ${width * 0.5},${base}`} fill="#1D2547" />
      <Polygon points={`${width * 0.48},${base} ${width * 0.78},${h * 0.38} ${width},${base}`} fill="#1D2547" />
      <Polygon points={`${width * 0.28},${base} ${width * 0.52},${h * 0.48} ${width * 0.78},${base}`} fill={DUSK} />
      <Polygon points={`0,${base} ${width * 0.32},${h * 0.72} ${width * 0.68},${base}`} fill="#1B3038" />
      <Polygon points={`${width * 0.35},${base} ${width * 0.75},${h * 0.74} ${width},${base}`} fill="#1E353A" />
    </Svg>
  );
};

// ---------------------------------------------------------------------------
// Beat 1: Evil critters swoop in, drop iron cages over your friends, & scatter keys
// ---------------------------------------------------------------------------

const Abduction: React.FC<SceneSize> = ({ width, height: h }) => {
  const reduced = useReducedMotion();
  const [cagedCount, setCagedCount] = useState(reduced ? STORY_CAPTIVE_FRIENDS.length : 0);

  const friendSize = Math.round(Math.min(72, (width - 68) / 3.4, h * 0.27));
  const cageSize = Math.round(friendSize * 1.24);
  const raiderSize = Math.round(Math.min(72, width * 0.18, h * 0.26));

  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = STORY_CAPTIVE_FRIENDS.map((_, idx) =>
      setTimeout(() => {
        setCagedCount(c => Math.max(c, idx + 1));
        if (idx === 1) band.cue('foeDud');
      }, CAGE_FIRST_MS + idx * CAGE_GAP_MS + CAGE_DROP_MS)
    );
    timers.push(setTimeout(() => band.cue('keyFound'), KEY_SCATTER_FIRST_MS + 120));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  return (
    <>
      <Sky width={width} height={h} />
      <ValleyBackdrop width={width} height={h} />
      <View style={[st.ground, { backgroundColor: '#213B40' }]} />

      {/* Mischievous enemy critters swooping down from upper corners */}
      <View style={st.raiderRow} pointerEvents="none">
        {STORY_RAIDER_LEVELS.map((levelId, idx) => (
          <RaiderSwoop
            key={levelId}
            fromX={idx === 0 ? -96 : 96}
            fromY={-74}
            delay={RAIDER_START_MS + idx * 56}
            reduced={reduced}
          >
            <EnemyAvatar
              enemy={levelFoe(getLevel(levelId))}
              size={raiderSize}
              mood="menacing"
              animate={false}
              lightweight
            />
          </RaiderSwoop>
        ))}
      </View>

      {/* Three friends standing in the valley — iron cages slam down right over them */}
      <View style={st.captiveRow} pointerEvents="none">
        {STORY_CAPTIVE_FRIENDS.map((name, idx) => (
          <View key={name} style={[st.captiveSlot, { width: cageSize, height: cageSize }]}>
            <FighterAvatar
              character={name}
              size={friendSize}
              mood={cagedCount > idx ? 'urgent' : 'victory'}
              animate={false}
            />
            <DroppingCage
              size={cageSize}
              delay={CAGE_FIRST_MS + idx * CAGE_GAP_MS}
              reduced={reduced}
            />
          </View>
        ))}
      </View>

      {/* Three gleaming Golden Keys scattered across the valley foreground */}
      <View style={st.droppedKeysRow} pointerEvents="none">
        {([-1, 0, 1] as const).map((slot, idx) => (
          <ScatteredKey
            key={slot}
            fromX={-slot * 34}
            fromY={-56}
            tilt={slot * 16}
            delay={KEY_SCATTER_FIRST_MS + idx * 64}
            reduced={reduced}
          />
        ))}
      </View>
    </>
  );
};

/** Raider enemy swooping into its hovering perch from an upper corner. */
const RaiderSwoop: React.FC<{
  fromX: number;
  fromY: number;
  delay: number;
  reduced: boolean;
  children: React.ReactNode;
}> = ({ fromX, fromY, delay, reduced, children }) => {
  const x = useSharedValue(reduced ? 0 : fromX);
  const y = useSharedValue(reduced ? 0 : fromY);
  const o = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    o.value = withDelay(delay, withTiming(1, { duration: MS.feedback, easing: EASE.ui }));
    x.value = withDelay(delay, withTiming(0, { duration: MS.move, easing: EASE.enter }));
    y.value = withDelay(delay, withTiming(0, { duration: MS.move, easing: EASE.enter }));
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
};

/** Iron cage + brass padlock slamming down over a friend with a 2-frame impact squash. */
const DroppingCage: React.FC<{ size: number; delay: number; reduced: boolean }> = ({ size, delay, reduced }) => {
  const y = useSharedValue(reduced ? 0 : -118);
  const o = useSharedValue(reduced ? 1 : 0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    o.value = withDelay(delay, withTiming(1, { duration: 48, easing: EASE.ui }));
    y.value = withDelay(delay, withTiming(0, { duration: CAGE_DROP_MS, easing: EASE.impact }));
    sx.value = withDelay(
      delay + CAGE_DROP_MS,
      withSequence(
        withTiming(1.09, { duration: 40, easing: EASE.ui }),
        withSpring(1, SPRING.snappy)
      )
    );
    sy.value = withDelay(
      delay + CAGE_DROP_MS,
      withSequence(
        withTiming(0.91, { duration: 40, easing: EASE.ui }),
        withSpring(1, SPRING.snappy)
      )
    );
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }, { scaleX: sx.value }, { scaleY: sy.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.cageDropWrap, style]}>
      <CageBarsSvg width={size} height={size} side="full" />
      <View style={st.cageMiniLock}>
        <CagePadlockSvg size={Math.round(size * 0.26)} />
      </View>
    </Animated.View>
  );
};

/** Golden Key tumbling from the raiders onto the valley road. */
const ScatteredKey: React.FC<{
  fromX: number;
  fromY: number;
  tilt: number;
  delay: number;
  reduced: boolean;
}> = ({ fromX, fromY, tilt, delay, reduced }) => {
  const x = useSharedValue(reduced ? 0 : fromX);
  const y = useSharedValue(reduced ? 0 : fromY);
  const s = useSharedValue(reduced ? 1 : 0.45);
  const rot = useSharedValue(reduced ? tilt : tilt - 48);
  const o = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    o.value = withDelay(delay, withTiming(1, { duration: MS.feedback, easing: EASE.ui }));
    x.value = withDelay(delay, withTiming(0, { duration: MS.move, easing: EASE.enterSoft }));
    y.value = withDelay(
      delay,
      withSequence(
        withTiming(fromY - 14, { duration: 80, easing: EASE.enter }),
        withSpring(0, SPRING.snappy)
      )
    );
    s.value = withDelay(delay, withSpring(1, SPRING.snappy));
    rot.value = withDelay(delay, withTiming(tilt, { duration: MS.move, easing: EASE.enterSoft }));
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rot.value}deg` }, { scale: s.value }],
  }));

  return (
    <Animated.View style={[st.keyBadge, style]}>
      <GoldenKeyArt size={30} />
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Beat 2: Winding map road with a Golden Key between two nodes → opens ANY friend!
// ---------------------------------------------------------------------------

const KeysRoad: React.FC<SceneSize> = ({ width, height: h }) => {
  const reduced = useReducedMotion();
  const keyScale = useSharedValue(reduced ? 1 : 0.72);
  const keyO = useSharedValue(reduced ? 1 : 0);
  const barsSplit = useSharedValue(reduced ? 1 : 0);
  const friendPop = useSharedValue(reduced ? 1 : 0.88);

  useEffect(() => {
    if (reduced) return;
    keyO.value = withDelay(80, withTiming(1, { duration: MS.quick, easing: EASE.ui }));
    keyScale.value = withDelay(80, withSpring(1, SPRING.playful));
    barsSplit.value = withDelay(340, withTiming(1, { duration: MS.move, easing: EASE.enterSoft }));
    friendPop.value = withDelay(360, withSpring(1, SPRING.playful));
    const t = setTimeout(() => band.cue('keyFound'), 340);
    return () => clearTimeout(t);
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyStyle = useAnimatedStyle(() => ({
    opacity: keyO.value,
    transform: [{ scale: keyScale.value }],
  }));
  const leftBarStyle = useAnimatedStyle(() => ({
    opacity: 1 - barsSplit.value * 0.85,
    transform: [{ translateX: -barsSplit.value * 26 }, { rotate: `${-barsSplit.value * 14}deg` }],
  }));
  const rightBarStyle = useAnimatedStyle(() => ({
    opacity: 1 - barsSplit.value * 0.85,
    transform: [{ translateX: barsSplit.value * 26 }, { rotate: `${barsSplit.value * 14}deg` }],
  }));
  const friendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: friendPop.value }],
  }));

  const roadY = Math.round(h * 0.68);
  const leftX = Math.round(width * 0.19);
  const midX = Math.round(width * 0.5);
  const rightX = Math.round(width * 0.81);

  return (
    <>
      <Sky width={width} height={h} />
      <View style={[st.ground, { backgroundColor: '#1E3A3F' }]} />

      {/* Winding road between two level stones with the Golden Key right in between */}
      <Svg width={width} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={`M ${leftX - 24} ${roadY + 12} Q ${midX} ${roadY - 22} ${rightX + 24} ${roadY + 12}`}
          stroke="#FFFFFF"
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
          opacity={0.9}
        />
        <Path
          d={`M ${leftX - 24} ${roadY + 12} Q ${midX} ${roadY - 22} ${midX} ${roadY - 5}`}
          stroke={GOLD}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={leftX} cy={roadY + 5} r={16} fill={GOLD} stroke={INK} strokeWidth={3} />
        <Circle cx={rightX} cy={roadY + 5} r={16} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
      </Svg>

      {/* Freed friend preview glowing above the road key */}
      <View style={[st.keysPreviewStage, { top: Math.max(12, Math.round(h * 0.1)) }]} pointerEvents="none">
        <View style={st.keysMedallion}>
          <Animated.View style={friendStyle}>
            <FighterAvatar character="Corgi" size={76} mood="victory" animate={false} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, st.centerAbs, leftBarStyle]}>
            <CageBarsSvg width={94} height={94} side="left" />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, st.centerAbs, rightBarStyle]}>
            <CageBarsSvg width={94} height={94} side="right" />
          </Animated.View>
        </View>
        <View style={st.miniSetBadge}>
          <Text style={st.miniSetBadgeText}>YOUR CHOICE · FREE ANY FRIEND!</Text>
        </View>
      </View>

      {/* Gleaming Golden Key sitting directly on the map path */}
      <Animated.View
        pointerEvents="none"
        style={[st.roadKeyMedallion, { left: midX - 26, top: roadY - 31 }, keyStyle]}
      >
        <GoldenKeyArt size={34} />
      </Animated.View>
    </>
  );
};

// ---------------------------------------------------------------------------
// Beat 3: Your starting fighter + Golden Key + crisp 3-card Set hint
// ---------------------------------------------------------------------------

const HERO_PREVIEW_CARDS: CardType[] = [
  { id: 'story-c1', shape: 'diamond', color: 'red', number: 1, shading: 'solid', selected: false },
  { id: 'story-c2', shape: 'oval', color: 'red', number: 1, shading: 'solid', selected: false },
  { id: 'story-c3', shape: 'squiggle', color: 'red', number: 1, shading: 'solid', selected: false },
];

const Hero: React.FC<SceneSize & { fighter: CharacterName }> = ({ width, height, fighter }) => {
  const fighterSize = Math.round(Math.min(136, width * 0.36, height * 0.45));
  const cardW = height < 260 ? 40 : 46;
  const cardH = Math.round(cardW * 1.34);
  return (
    <>
      <Sky width={width} height={height} />
      <View style={[st.ground, { backgroundColor: '#1B3038' }]} />
      <View style={st.heroWrap}>
        <Rise delay={0}>
          <View style={st.heroRow}>
            <FighterAvatar character={fighter} size={fighterSize} mood="anticipation" reaction={{ type: 'entrance', id: 1 }} />
            <View style={st.heroKeyMedallion}>
              <GoldenKeyArt size={34} />
            </View>
          </View>
        </Rise>
        <Rise delay={MS.quick}>
          <View pointerEvents="none" style={st.miniSetCol}>
            <View style={st.miniCardsRow}>
              {HERO_PREVIEW_CARDS.map(card => (
                <View key={card.id} style={{ width: cardW, height: cardH }}>
                  <Card card={card} onClick={() => {}} disabled isPaused />
                </View>
              ))}
            </View>
            <View style={st.miniSetBadge}>
              <Text style={st.miniSetBadgeText}>✓ SET → FREE FRIENDS!</Text>
            </View>
          </View>
        </Rise>
      </View>
    </>
  );
};

/** Its children rise smoothly into place once (reduced motion: immediate calm fade). */
const Rise: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => {
  const reduced = useReducedMotion();
  const o = useSharedValue(reduced ? 1 : 0);
  const y = useSharedValue(reduced ? 0 : 18);
  const s = useSharedValue(reduced ? 1 : 0.9);
  useEffect(() => {
    if (reduced) return;
    o.value = withDelay(delay, withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
    y.value = withDelay(delay, withTiming(0, { duration: MS.move, easing: EASE.enterSoft }));
    s.value = withDelay(delay, withSpring(1, SPRING.lively));
    // once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }, { scale: s.value }],
  }));
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
  body: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 16 },
  scene: { overflow: 'hidden' },
  skyStar: { position: 'absolute', backgroundColor: '#E8ECFF', opacity: 0.8 },
  ground: { position: 'absolute', left: -40, right: -40, bottom: -70, height: 150, borderRadius: 300 },
  // Beat 1: Abduction
  raiderRow: { position: 'absolute', left: 0, right: 0, top: 14, flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 32 },
  captiveRow: { position: 'absolute', left: 0, right: 0, bottom: 54, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 14 },
  captiveSlot: { alignItems: 'center', justifyContent: 'center' },
  cageDropWrap: { alignItems: 'center', justifyContent: 'center' },
  cageMiniLock: { position: 'absolute', bottom: -2 },
  droppedKeysRow: { position: 'absolute', left: 0, right: 0, bottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 34 },
  keyBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GOLD,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Beat 2: Keys road
  keysPreviewStage: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 6 },
  keysMedallion: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2B3354',
    borderWidth: 3,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerAbs: { alignItems: 'center', justifyContent: 'center' },
  roadKeyMedallion: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GOLD,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Beat 3: Hero
  heroWrap: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center', gap: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroKeyMedallion: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GOLD,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSetCol: { alignItems: 'center', gap: 5 },
  miniCardsRow: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  miniSetBadge: { backgroundColor: COLORS.logicTeal, borderRadius: 999, borderWidth: 1.5, borderColor: '#FFF6C2', paddingHorizontal: 10, paddingVertical: 2 },
  miniSetBadgeText: { color: COLORS.canvasWhite, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  words: { alignSelf: 'stretch', alignItems: 'center', gap: 8, paddingHorizontal: 24, minHeight: 112 },
  speaker: { flexShrink: 1, color: GOLD, fontWeight: '900', letterSpacing: 2, fontSize: 11, textTransform: 'uppercase' },
  title: { flexShrink: 1, color: COLORS.canvasWhite, fontWeight: '900', fontSize: 24, lineHeight: 29, textAlign: 'center' },
  text: { flexShrink: 1, color: '#D5DAF2', fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 380 },
  footer: { alignSelf: 'stretch', paddingHorizontal: 20, alignItems: 'center' },
  cta: { alignSelf: 'stretch', maxWidth: 440, width: '100%', backgroundColor: GOLD, borderRadius: 10, borderWidth: 2, borderBottomWidth: 5, borderColor: INK, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: INK, fontWeight: '900', fontSize: 17, letterSpacing: 1.5, textTransform: 'uppercase' },
});

export default StoryIntro;
