/**
 * The cold open: three short beats showing wild critters hoarding Star Shards &
 * caging all 5 animal friends, Golden Keys scattered along the road so you can
 * free whoever you pick first, and your fighter with a live interactive 3-card
 * micro-Set (Orange Triangle, Orange Circle, Orange Bolt) that launches 1-1!
 *
 * [OB-05] Two-stage tap (early body tap snaps current beat to settled; second
 * tap advances; explicit Next / Let's go! CTA advances immediately), live
 * tappable Beat-3 micro-Set, top-left Pause (`II` / `Esc`), and always-visible
 * `Skip`. Every animation runs once (nothing loops), uses `src/utils/motion.ts`
 * tokens on GPU transform/opacity only, and reduced motion starts settled.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
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
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import {
  ARC,
  CREATURE_FX,
  EASE,
  HIT,
  MS,
  OVERLAP,
  SPRING,
  STAGGER,
  STAYS,
  reducedMs,
  sampleJumpArcY,
} from '@/utils/motion';
import { band, sfx } from '@/audio';
import type { Card as CardType, CharacterName } from '@/types';
import { STORY, STORY_CAPTIVE_FRIENDS, STORY_RAIDER_LEVELS, type StoryBeat } from '../data/story';
import { getLevel } from '../data/levels';
import { levelFoe } from '../data/foes';
import { LivingBreath } from './CompanionBubble';
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
const CAGE_GAP_MS = 32;                      // tight 2-frame ripple across the cages
const CAGE_DROP_MS = MS.quick;               // 180 ms impact fall
const CAGE_ALL_LANDED_MS = CAGE_FIRST_MS + CAGE_GAP_MS * 2 + CAGE_DROP_MS; // 484 ms (~f30)
const KEY_SCATTER_FIRST_MS = CAGE_ALL_LANDED_MS + 32;  // 516 ms: keys pop out right after cages slam
const ABDUCTION_WORDS_MS = CAGE_ALL_LANDED_MS + 96;    // 580 ms: title rises cleanly once cages settle
const BEAT_HERO_COMPLETE_MS = 260;                     // crisp transition after tapping all 3 Beat-3 cards

interface Props {
  fighter: CharacterName;
  onDone: () => void;
}

const StoryIntro: React.FC<Props> = ({ fighter, onDone }) => {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width: winW, height: winH } = useWindowDimensions();
  const width = Math.min(winW, 480);
  const sceneH = sceneHeightFor(winH);
  const beats = STORY.welcome;
  const [i, setI] = useState(0);
  const [beatSettled, setBeatSettled] = useState(reduced);
  const [paused, setPaused] = useState(false);
  const beat = beats[i];
  const last = i === beats.length - 1;

  // [AU-20]: Dusk story music on mount, brightening to Ionian on Beat 3 Hero reveal
  useEffect(() => {
    if (typeof band?.playScreenMusic === 'function') {
      band.playScreenMusic('story');
    }
    return () => {
      if (typeof band?.stop === 'function' && band.current === 'story') {
        band.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof band?.setStoryHeroMode === 'function') {
      band.setStoryHeroMode(beat.scene === 'hero');
    }
  }, [beat.scene]);

  // Reset settlement per beat and mark settled once the beat's words have arrived (pauses cleanly when paused)
  useEffect(() => {
    setBeatSettled(reduced);
  }, [i, reduced]);

  useEffect(() => {
    if (reduced || beatSettled || paused) return;
    const ms = beat.scene === 'abduction' ? ABDUCTION_WORDS_MS : MS.quick + MS.move;
    const t = setTimeout(() => setBeatSettled(true), ms);
    return () => clearTimeout(t);
  }, [beat.scene, reduced, beatSettled, paused]);

  const next = useCallback(() => {
    setPaused(false);
    if (last) {
      sfx('confirm');
      onDone();
    } else {
      sfx('click');
      setI(cur => cur + 1);
    }
  }, [last, onDone]);

  const handleBodyPress = useCallback(() => {
    if (paused) {
      sfx('click');
      setPaused(false);
      return;
    }
    if (!beatSettled) {
      sfx('click');
      setBeatSettled(true);
      return;
    }
    next();
  }, [paused, beatSettled, next]);

  const handleSkip = useCallback(() => {
    sfx('click');
    onDone();
  }, [onDone]);

  const togglePause = useCallback(() => {
    sfx('click');
    setPaused(p => !p);
  }, []);

  // Web keyboard support: Esc pauses/resumes; Enter/Space advances (or resumes when paused)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
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
          next();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused, togglePause, next]);

  // Smooth directional entrance on each beat swap (`MS.screen`, `EASE.enterSoft`, `STAYS` reduced-motion safe)
  const beatO = useSharedValue(1);
  const beatX = useSharedValue(0);
  useEffect(() => {
    if (i === 0) return;
    beatO.value = 0;
    if (reduced) {
      beatX.value = 0;
      beatO.value = withTiming(1, { duration: reducedMs(MS.screen), easing: EASE.ui, ...STAYS });
    } else {
      beatX.value = 26;
      beatO.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS });
      beatX.value = withTiming(0, { duration: MS.screen, easing: EASE.enterSoft });
    }
    return () => {
      cancelAnimation(beatO);
      cancelAnimation(beatX);
    };
  }, [i, reduced, beatO, beatX]);
  const beatStageStyle = useAnimatedStyle(() => ({
    opacity: beatO.value,
    transform: [{ translateX: beatX.value }],
  }));

  return (
    <View testID="story-intro" style={[st.root, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={st.topRow}>
        <TouchableOpacity
          testID="story-pause"
          onPress={togglePause}
          style={st.pauseBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Resume story' : 'Pause story'}
        >
          <Text style={st.pauseText}>{paused ? '▶' : 'II'}</Text>
        </TouchableOpacity>
        <View style={st.dots}>
          {beats.map((_, k) => <View key={k} style={[st.dot, k === i && st.dotOn, k < i && st.dotDone]} />)}
        </View>
        <TouchableOpacity
          testID="story-skip"
          onPress={handleSkip}
          style={st.skip}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Skip the story"
        >
          <Text style={st.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {paused && (
        <TouchableOpacity
          testID="story-paused-pill"
          onPress={togglePause}
          style={st.pausedPill}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Paused. Tap to resume"
        >
          <Text style={st.pausedPillText}>PAUSED — Tap to resume</Text>
        </TouchableOpacity>
      )}

      {/* Beat 3 keeps the interactive cards directly tappable without triggering body advance */}
      <Animated.View style={[{ flex: 1, width: '100%' }, beatStageStyle]}>
        {beat.scene === 'hero' ? (
          <View style={st.body}>
            <View style={[st.scene, { width, height: sceneH }]}>
              <Hero
                key={i}
                width={width}
                height={sceneH}
                fighter={fighter}
                settled={beatSettled}
                paused={paused}
                onCompleteSet={onDone}
              />
            </View>
            <TouchableOpacity
              testID="story-body"
              activeOpacity={1}
              onPress={handleBodyPress}
              style={st.wordsTap}
              accessibilityRole="button"
              accessibilityLabel={`${beat.title} ${beat.body}`}
            >
              <Words key={`w${i}`} beat={beat} fighter={fighter} settled={beatSettled} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            testID="story-body"
            activeOpacity={1}
            onPress={handleBodyPress}
            style={st.body}
            accessibilityRole="button"
            accessibilityLabel={`${beat.title} ${beat.body} Tap to continue`}
          >
            <View style={[st.scene, { width, height: sceneH }]}>
              <Scene key={i} beat={beat} width={width} height={sceneH} fighter={fighter} settled={beatSettled} paused={paused} onCompleteSet={onDone} />
            </View>
            <Words key={`w${i}`} beat={beat} fighter={fighter} settled={beatSettled} />
          </TouchableOpacity>
        )}
      </Animated.View>

      <View style={st.footer}>
        <TouchableOpacity testID="story-next" onPress={next} style={st.cta} activeOpacity={0.85} accessibilityRole="button">
          <Text style={st.ctaText}>{last ? 'Let’s go!' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/** The words of a beat rise in smoothly right on the hero moment (or snap immediately when settled/reduced). */
const Words: React.FC<{ beat: StoryBeat; fighter: CharacterName; settled: boolean }> = ({ beat, fighter, settled }) => {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced || settled ? 1 : 0);
  useEffect(() => {
    if (reduced || settled) {
      cancelAnimation(p);
      p.value = 1;
      return;
    }
    const delay = beat.scene === 'abduction' ? ABDUCTION_WORDS_MS : MS.quick;
    p.value = withDelay(delay, withTiming(1, { duration: MS.move, easing: EASE.enterSoft }));
    return () => cancelAnimation(p);
  }, [beat.scene, reduced, settled, p]);
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

interface SceneSize {
  width: number;
  height: number;
  settled: boolean;
  paused: boolean;
}

const Scene: React.FC<SceneSize & { beat: StoryBeat; fighter: CharacterName; onCompleteSet: () => void }> = ({
  beat,
  width,
  height,
  fighter,
  settled,
  paused,
  onCompleteSet,
}) => {
  switch (beat.scene) {
    case 'abduction': return <Abduction width={width} height={height} settled={settled} paused={paused} />;
    case 'keys': return <KeysRoad width={width} height={height} settled={settled} paused={paused} />;
    case 'hero': return <Hero width={width} height={height} fighter={fighter} settled={settled} paused={paused} onCompleteSet={onCompleteSet} />;
  }
};

const Sky: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <>
    {SKY.map(([x, y, s], k) => (
      <View key={k} style={[st.skyStar, { left: x * width, top: y * height, width: s, height: s, borderRadius: s / 2 }]} />
    ))}
  </>
);

/** Distant valley silhouettes behind the meadow stage. */
const ValleyBackdrop: React.FC<{ width: number; height: number }> = ({ width, height: h }) => {
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
// Beat 1: Wild critters hoard Star Shards, cage all 5 friends, & scatter keys
// ---------------------------------------------------------------------------

const FRONT_CAPTIVES = STORY_CAPTIVE_FRIENDS.slice(0, 3);
const BACK_CAPTIVES = STORY_CAPTIVE_FRIENDS.slice(3, 5);

const Abduction: React.FC<SceneSize> = ({ width, height: h, settled, paused }) => {
  const reduced = useReducedMotion();
  const snap = reduced || settled;
  const [cagedCount, setCagedCount] = useState(snap ? STORY_CAPTIVE_FRIENDS.length : 0);

  const friendSize = Math.round(Math.min(68, (width - 68) / 3.5, h * 0.25));
  const cageSize = Math.round(friendSize * 1.24);
  const backFriendSize = Math.round(friendSize * 0.74);
  const backCageSize = Math.round(backFriendSize * 1.24);
  const raiderSize = Math.round(Math.min(68, width * 0.17, h * 0.24));

  useEffect(() => {
    if (snap) {
      setCagedCount(STORY_CAPTIVE_FRIENDS.length);
      return;
    }
    if (paused) return;
    const timers: ReturnType<typeof setTimeout>[] = STORY_CAPTIVE_FRIENDS.map((_, idx) =>
      setTimeout(() => {
        setCagedCount(c => Math.max(c, idx + 1));
        if (idx === 1) band.cue('foeDud');
      }, CAGE_FIRST_MS + Math.min(idx, 3) * CAGE_GAP_MS + CAGE_DROP_MS)
    );
    timers.push(setTimeout(() => band.cue('keyFound'), KEY_SCATTER_FIRST_MS + 120));
    return () => timers.forEach(clearTimeout);
  }, [snap, paused]);

  return (
    <>
      <Sky width={width} height={h} />
      <ValleyBackdrop width={width} height={h} />
      <View style={[st.ground, { backgroundColor: '#213B40' }]} />

      {/* Gleaming shattered Star Shard crest high above the valley */}
      <View style={st.shardCrest} pointerEvents="none">
        <Icon name="delapouite/falling-star" size={26} color={GOLD} />
      </View>

      {/* Mischievous enemy critters swooping down from upper corners */}
      <View style={st.raiderRow} pointerEvents="none">
        {STORY_RAIDER_LEVELS.map((levelId, idx) => (
          <RaiderSwoop
            key={levelId}
            fromX={idx === 0 ? -96 : 96}
            fromY={-74}
            delay={RAIDER_START_MS + idx * 56}
            settled={snap}
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

      {/* Back row: 2 smaller cages tucked slightly behind (completes all 5 caged friends = 5 Golden Keys!) */}
      <View style={[st.captiveBackRow, { bottom: Math.round(58 + cageSize * 0.52) }]} pointerEvents="none">
        {BACK_CAPTIVES.map((name, idx) => (
          <View key={name} testID={`story-captive-${name}`} style={[st.captiveSlot, { width: backCageSize, height: backCageSize, opacity: 0.92 }]}>
            <FighterAvatar
              character={name}
              size={backFriendSize}
              mood={cagedCount > idx + 3 ? 'urgent' : 'victory'}
              animate={false}
            />
            <DroppingCage
              size={backCageSize}
              delay={CAGE_FIRST_MS + (idx + 1) * CAGE_GAP_MS}
              settled={snap}
            />
          </View>
        ))}
      </View>

      {/* Front row: 3 friends standing in the valley — iron cages slam down right over them */}
      <View style={st.captiveRow} pointerEvents="none">
        {FRONT_CAPTIVES.map((name, idx) => (
          <View key={name} testID={`story-captive-${name}`} style={[st.captiveSlot, { width: cageSize, height: cageSize }]}>
            <FighterAvatar
              character={name}
              size={friendSize}
              mood={cagedCount > idx ? 'urgent' : 'victory'}
              animate={false}
            />
            <DroppingCage
              size={cageSize}
              delay={CAGE_FIRST_MS + idx * CAGE_GAP_MS}
              settled={snap}
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
            settled={snap}
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
  settled: boolean;
  children: React.ReactNode;
}> = ({ fromX, fromY, delay, settled, children }) => {
  const x = useSharedValue(settled ? 0 : fromX);
  const y = useSharedValue(settled ? 0 : fromY);
  const o = useSharedValue(settled ? 1 : 0);

  useEffect(() => {
    if (settled) {
      cancelAnimation(x);
      cancelAnimation(y);
      cancelAnimation(o);
      x.value = 0;
      y.value = 0;
      o.value = 1;
      return;
    }
    o.value = withDelay(delay, withTiming(1, { duration: MS.feedback, easing: EASE.ui }));
    x.value = withDelay(delay, withTiming(0, { duration: MS.move, easing: EASE.enter }));
    y.value = withDelay(delay, withTiming(0, { duration: MS.move, easing: EASE.enter }));
    return () => {
      cancelAnimation(x);
      cancelAnimation(y);
      cancelAnimation(o);
    };
  }, [settled, delay, x, y, o]);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
};

/** Iron cage + brass padlock slamming down over a friend with a 2-frame impact squash. */
const DroppingCage: React.FC<{ size: number; delay: number; settled: boolean }> = ({ size, delay, settled }) => {
  const y = useSharedValue(settled ? 0 : -118);
  const o = useSharedValue(settled ? 1 : 0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);

  useEffect(() => {
    if (settled) {
      cancelAnimation(y);
      cancelAnimation(o);
      cancelAnimation(sx);
      cancelAnimation(sy);
      y.value = 0;
      o.value = 1;
      sx.value = 1;
      sy.value = 1;
      return;
    }
    o.value = withDelay(delay, withTiming(1, { duration: OVERLAP.uiContentMs, easing: EASE.ui }));
    y.value = withDelay(delay, withTiming(0, { duration: CAGE_DROP_MS, easing: EASE.impact }));
    sx.value = withDelay(
      delay + CAGE_DROP_MS,
      withSequence(
        withTiming(1.09, { duration: STAGGER.card, easing: EASE.ui }),
        withSpring(1, SPRING.snappy)
      )
    );
    sy.value = withDelay(
      delay + CAGE_DROP_MS,
      withSequence(
        withTiming(0.91, { duration: STAGGER.card, easing: EASE.ui }),
        withSpring(1, SPRING.snappy)
      )
    );
    return () => {
      cancelAnimation(y);
      cancelAnimation(o);
      cancelAnimation(sx);
      cancelAnimation(sy);
    };
  }, [settled, delay, y, o, sx, sy]);

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
  settled: boolean;
}> = ({ fromX, fromY, tilt, delay, settled }) => {
  const x = useSharedValue(settled ? 0 : fromX);
  const y = useSharedValue(settled ? 0 : fromY);
  const s = useSharedValue(settled ? 1 : 0.45);
  const rot = useSharedValue(settled ? tilt : tilt - 48);
  const o = useSharedValue(settled ? 1 : 0);

  useEffect(() => {
    if (settled) {
      cancelAnimation(x);
      cancelAnimation(y);
      cancelAnimation(s);
      cancelAnimation(rot);
      cancelAnimation(o);
      x.value = 0;
      y.value = 0;
      s.value = 1;
      rot.value = tilt;
      o.value = 1;
      return;
    }
    o.value = withDelay(delay, withTiming(1, { duration: MS.feedback, easing: EASE.ui }));
    x.value = withDelay(delay, withTiming(0, { duration: MS.move, easing: EASE.enterSoft }));
    y.value = withDelay(
      delay,
      withSequence(
        withTiming(fromY - 14, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
        withSpring(0, SPRING.snappy)
      )
    );
    s.value = withDelay(delay, withSpring(1, SPRING.snappy));
    rot.value = withDelay(delay, withTiming(tilt, { duration: MS.move, easing: EASE.enterSoft }));
    return () => {
      cancelAnimation(x);
      cancelAnimation(y);
      cancelAnimation(s);
      cancelAnimation(rot);
      cancelAnimation(o);
    };
  }, [settled, delay, fromY, tilt, x, y, s, rot, o]);

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

const KeysRoad: React.FC<SceneSize> = ({ width, height: h, settled, paused }) => {
  const reduced = useReducedMotion();
  const snap = reduced || settled;
  const keyScale = useSharedValue(snap ? 1 : 0.72);
  const keyO = useSharedValue(snap ? 1 : 0);
  const barsSplit = useSharedValue(snap ? 1 : 0);
  const friendPop = useSharedValue(snap ? 1 : 0.88);

  useEffect(() => {
    if (snap) {
      cancelAnimation(keyO);
      cancelAnimation(keyScale);
      cancelAnimation(barsSplit);
      cancelAnimation(friendPop);
      keyO.value = 1;
      keyScale.value = 1;
      barsSplit.value = 1;
      friendPop.value = 1;
      return;
    }
    if (paused) return;
    const barsSplitAtMs = MS.move + STAGGER.item;
    keyO.value = withDelay(CREATURE_FX.fidgetFastMs, withTiming(1, { duration: MS.quick, easing: EASE.ui }));
    keyScale.value = withDelay(CREATURE_FX.fidgetFastMs, withSpring(1, SPRING.playful));
    barsSplit.value = withDelay(barsSplitAtMs, withTiming(1, { duration: MS.move, easing: EASE.enterSoft }));
    friendPop.value = withDelay(barsSplitAtMs + HIT.snapMs, withSpring(1, SPRING.playful));
    const t = setTimeout(() => band.cue('keyFound'), barsSplitAtMs);
    return () => {
      clearTimeout(t);
      cancelAnimation(keyO);
      cancelAnimation(keyScale);
      cancelAnimation(barsSplit);
      cancelAnimation(friendPop);
    };
  }, [snap, paused, keyO, keyScale, barsSplit, friendPop]);

  const keyStyle = useAnimatedStyle(() => ({
    opacity: keyO.value,
    transform: [{ scale: keyScale.value }],
  }));
  const leftBarStyle = useAnimatedStyle(() => {
    const t = barsSplit.value;
    const arcY = sampleJumpArcY(t, 12, ARC.jumpApexT) + 20 * t * t;
    return {
      opacity: 1 - t * 0.85,
      transform: [{ translateX: -t * 28 }, { translateY: arcY }, { rotate: `${-t * 16}deg` }],
    };
  });
  const rightBarStyle = useAnimatedStyle(() => {
    const t = barsSplit.value;
    const arcY = sampleJumpArcY(t, 12, ARC.jumpApexT) + 20 * t * t;
    return {
      opacity: 1 - t * 0.85,
      transform: [{ translateX: t * 28 }, { translateY: arcY }, { rotate: `${t * 16}deg` }],
    };
  });
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
            <LivingBreath seedKey="story-keys-corgi" size={76} active={!paused && !reduced}>
              <FighterAvatar character="Corgi" size={76} mood="victory" animate={false} />
            </LivingBreath>
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
// Beat 3: Your starting fighter + Golden Key + LIVE interactive 3-card micro-Set!
// Cards render as Orange Triangle, Orange Circle, Orange Bolt (v0.1.173 identity).
// ---------------------------------------------------------------------------

const HERO_PREVIEW_CARDS: CardType[] = [
  { id: 'story-c1', shape: 'diamond', color: 'red', number: 1, shading: 'solid', selected: false },
  { id: 'story-c2', shape: 'oval', color: 'red', number: 1, shading: 'solid', selected: false },
  { id: 'story-c3', shape: 'squiggle', color: 'red', number: 1, shading: 'solid', selected: false },
];

const HERO_CARD_LABELS = ['Orange Triangle', 'Orange Circle', 'Orange Bolt'] as const;

const Hero: React.FC<SceneSize & { fighter: CharacterName; onCompleteSet: () => void }> = ({
  width,
  height,
  fighter,
  settled,
  paused,
  onCompleteSet,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!completed || paused) return;
    const t = setTimeout(() => onCompleteSet(), BEAT_HERO_COMPLETE_MS);
    return () => clearTimeout(t);
  }, [completed, paused, onCompleteSet]);

  const toggleCard = (id: string) => {
    if (completed || paused) return;
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        sfx('click');
        return prev.filter(x => x !== id);
      }
      const next = [...prev, id];
      if (next.length >= HERO_PREVIEW_CARDS.length) {
        sfx('match');
        setCompleted(true);
      } else {
        sfx('click');
      }
      return next;
    });
  };

  const fighterSize = Math.round(Math.min(126, width * 0.34, height * 0.42));
  const cardW = height < 260 ? 48 : 54;
  const cardH = Math.round(cardW * 1.34);
  return (
    <>
      <Sky width={width} height={height} />
      <View style={[st.ground, { backgroundColor: '#1B3038' }]} />
      <View style={st.heroWrap}>
        <Rise delay={0} settled={settled}>
          <View style={st.heroRow}>
            <FighterAvatar
              character={fighter}
              size={fighterSize}
              mood={completed ? 'victory' : 'anticipation'}
              reaction={completed ? { type: 'ecstatic', id: 2 } : { type: 'entrance', id: 1 }}
            />
            <View style={st.heroKeyMedallion}>
              <GoldenKeyArt size={34} />
            </View>
          </View>
        </Rise>
        <Rise delay={MS.quick} settled={settled}>
          <View style={st.miniSetCol}>
            <View style={st.miniCardsRow}>
              {HERO_PREVIEW_CARDS.map((card, idx) => {
                const isSelected = selectedIds.includes(card.id);
                return (
                  <TouchableOpacity
                    key={card.id}
                    testID={`story-hero-card-${idx}`}
                    onPress={() => toggleCard(card.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`${HERO_CARD_LABELS[idx]}${isSelected ? ', selected' : ''}`}
                    style={[
                      st.heroCardBtn,
                      { width: cardW, height: cardH },
                      isSelected && st.heroCardSelected,
                    ]}
                  >
                    <View pointerEvents="none" style={{ flex: 1 }}>
                      <Card card={{ ...card, selected: isSelected }} onClick={() => {}} isPaused />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View
              testID={completed ? 'story-hero-set-complete' : 'story-hero-set-prompt'}
              style={[st.miniSetBadge, completed && st.miniSetBadgeDone]}
            >
              <Text style={st.miniSetBadgeText}>
                {completed
                  ? '✓ SET! ALL ORANGE · 3 SHAPES!'
                  : selectedIds.length === 0
                    ? 'TAP ALL 3 ORANGE CARDS → SET!'
                    : `${HERO_PREVIEW_CARDS.length - selectedIds.length} MORE TO COMPLETE SET!`}
              </Text>
            </View>
          </View>
        </Rise>
      </View>
    </>
  );
};

/** Its children rise smoothly into place once (reduced motion / settled: immediate). */
const Rise: React.FC<{ delay: number; settled: boolean; children: React.ReactNode }> = ({ delay, settled, children }) => {
  const reduced = useReducedMotion();
  const snap = reduced || settled;
  const o = useSharedValue(snap ? 1 : 0);
  const y = useSharedValue(snap ? 0 : 18);
  const s = useSharedValue(snap ? 1 : 0.9);
  useEffect(() => {
    if (snap) {
      cancelAnimation(o);
      cancelAnimation(y);
      cancelAnimation(s);
      o.value = 1;
      y.value = 0;
      s.value = 1;
      return;
    }
    o.value = withDelay(delay, withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
    y.value = withDelay(delay, withTiming(0, { duration: MS.move, easing: EASE.enterSoft }));
    s.value = withDelay(delay, withSpring(1, SPRING.lively));
    return () => {
      cancelAnimation(o);
      cancelAnimation(y);
      cancelAnimation(s);
    };
  }, [snap, delay, o, y, s]);
  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }, { scale: s.value }],
  }));
  return <Animated.View style={[{ alignItems: 'center' }, style]}>{children}</Animated.View>;
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT, alignItems: 'center' },
  topRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  pauseBtn: {
    position: 'absolute',
    left: 10,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: { color: '#E8ECFF', fontWeight: '900', fontSize: 13, letterSpacing: -0.5 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { width: 20, backgroundColor: GOLD },
  dotDone: { backgroundColor: 'rgba(255,222,0,0.55)' },
  skip: { position: 'absolute', right: 10, minWidth: 44, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: '#B9C0E0', fontWeight: '800', fontSize: 14 },
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
  body: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 14 },
  wordsTap: { alignSelf: 'stretch', alignItems: 'center' },
  scene: { overflow: 'hidden' },
  skyStar: { position: 'absolute', backgroundColor: '#E8ECFF', opacity: 0.8 },
  ground: { position: 'absolute', left: -40, right: -40, bottom: -70, height: 150, borderRadius: 300 },
  shardCrest: { position: 'absolute', top: 6, alignSelf: 'center', opacity: 0.92 },
  // Beat 1: Abduction
  raiderRow: { position: 'absolute', left: 0, right: 0, top: 14, flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 32 },
  captiveBackRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 48 },
  captiveRow: { position: 'absolute', left: 0, right: 0, bottom: 52, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12 },
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
  // Beat 3: Hero interactive micro-Set
  heroWrap: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center', gap: 8 },
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
  miniSetCol: { alignItems: 'center', gap: 6 },
  miniCardsRow: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  heroCardBtn: { transform: [{ translateY: 0 }] },
  heroCardSelected: { transform: [{ translateY: -6 }] },
  miniSetBadge: { backgroundColor: COLORS.tealSurface, borderRadius: 999, borderWidth: 1.5, borderColor: '#FFF6C2', paddingHorizontal: 10, paddingVertical: 3 },
  miniSetBadgeDone: { backgroundColor: '#15803D', borderColor: GOLD },
  miniSetBadgeText: { color: COLORS.canvasWhite, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  words: { alignSelf: 'stretch', alignItems: 'center', gap: 8, paddingHorizontal: 24, minHeight: 112 },
  speaker: { flexShrink: 1, color: GOLD, fontWeight: '900', letterSpacing: 2, fontSize: 11, textTransform: 'uppercase' },
  title: { flexShrink: 1, color: COLORS.canvasWhite, fontWeight: '900', fontSize: 24, lineHeight: 29, textAlign: 'center' },
  text: { flexShrink: 1, color: '#D5DAF2', fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 380 },
  footer: { alignSelf: 'stretch', paddingHorizontal: 20, alignItems: 'center' },
  cta: { alignSelf: 'stretch', maxWidth: 440, width: '100%', backgroundColor: GOLD, borderRadius: 10, borderWidth: 2, borderBottomWidth: 5, borderColor: INK, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: INK, fontWeight: '900', fontSize: 17, letterSpacing: 1.5, textTransform: 'uppercase' },
});

export default StoryIntro;
