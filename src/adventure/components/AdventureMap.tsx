/**
 * The adventure map — a winding path of foe nodes through the worlds
 * (Angry Birds / Bloons style). Tap a node to open the level preview.
 *
 * Side paths (elite branches, fighter trials, practice) are secrets: a path is
 * not drawn at all until it opens, and the first time the map shows one its
 * trail draws itself out from the level it hangs off and its node pops in.
 * A branch can lead on to further branches.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TouchableOpacity, StyleSheet, useWindowDimensions, Platform, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withRepeat, withSequence, withSpring, withTiming, cancelAnimation } from 'react-native-reanimated';
import { BTN_PRESS, EASE, MS, SCALE, SPRING, STAGGER, STAYS, reducedMs } from '@/utils/motion';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { useAppActive } from '@/hooks/useAppActive';
import { COLORS } from '@/utils/colors';
import { recordComponentRender } from '@/utils/perfWatchdog';
import { band, sfx } from '@/audio';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { CharacterName } from '@/types';
import type { AdventureSave, LevelDef } from '../types';
import { MAIN_LEVELS, branchesOf } from '../data/levels';
import { MAP_KEYS, isMapKeyClaimed, isMapKeyReached, lockedFighters, mapKeyAfter, readyMapKeys, type MapKeyDef } from '../data/mapKeys';
import { BIOMES } from '../data/biomes';
import { BOUNTIES, isBountyUnlocked } from '../data/bounties';
import { levelFoe } from '../data/foes';
import { getMechanic } from '../data/mechanics';
import { getFighter } from '../data/fighters';
import { isFighterTrial, starRewards, unlockablesOf } from '../data/rewards';
import { freshPaths, hasUnspentStars, getFrontierLevel, getLockReason, isMechanicKnown, maxStars, openPaths, refundableCoins, totalStars, isBiomeOpen } from '../progress';
import { companionMapGreeting } from '../coach';
import { BiomeScenery } from './BiomeScenery';
import CompanionBubble from './CompanionBubble';
import { GoldenKeyArt } from './RescueArt';
import { Bob, CoinPill, INK, StarRow, TONE } from './ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ELITE = '#5B2333';
/** Practice paths: straw, not blood */
const PRACTICE = '#8A6420';
const ROW = 112;
/** Extra road breathing room between two main nodes that carry a Golden Rescue Key */
const KEY_EXTRA_ROW = 98;
/** Vertical step between branches that chain off one another */
const BRANCH_STEP = 92;
const BANNER = 132;
const TOP_PAD = 24;

/** A side path is drawn as dashes this far apart (the SVG trail and the arriving one share it) */
const DASH_STEP = 12;
/** A fresh path waits for the map to scroll to it, then lays one dash at a time, then its node pops */
const ARRIVE = { startMs: 700, dashMs: 55, popMs: 380, tagMs: 2000, betweenMs: 500 } as const;
/** Walking the fighter bubble from `afterLevel` onto a newly reached Golden Key */
const KEY_WALK_MS = 420;

interface Point { x: number; y: number }
interface NodePos { level: LevelDef; x: number; y: number; parent?: Point }
interface KeyPos { keyDef: MapKeyDef; x: number; y: number; from: Point }
interface BannerPos { biomeIndex: number; y: number; height: number }

/** Exact point on the `pathFor` cubic Bezier segment `a → b` at parameter `t` in [0, 1]. */
const cubicBezierAt = (a: Point, b: Point, t: number): Point => {
  const my = (a.y + b.y) / 2;
  const mt = 1 - t;
  return {
    x: mt * mt * mt * a.x + 3 * mt * mt * t * a.x + 3 * mt * t * t * b.x + t * t * t * b.x,
    y: mt * mt * mt * a.y + 3 * mt * mt * t * my + 3 * mt * t * t * my + t * t * t * b.y,
  };
};

const pathColor = (level: LevelDef): string => (level.rules.sandbox ? PRACTICE : ELITE);

/** Where each dash of the trail from `from` to `to` sits, and how it is turned. */
const dashesBetween = (from: Point, to: Point): { points: Point[]; angle: number } => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const count = Math.max(1, Math.floor((len - 1.5) / DASH_STEP) + 1);
  return {
    angle: Math.atan2(dy, dx),
    points: Array.from({ length: count }, (_, k) => {
      const d = 1.5 + k * DASH_STEP;
      return { x: from.x + (dx / len) * d, y: from.y + (dy / len) * d };
    }),
  };
};

/** An open side path and every open path that chains off it, depth first. */
const branchChain = (level: LevelDef, isOpen: (l: LevelDef) => boolean): LevelDef[] => [
  level,
  ...branchesOf(level.id).filter(isOpen).flatMap(b => branchChain(b, isOpen)),
];

/** Only open side paths take up room: a hidden one leaves no gap to give it away. */
const layout = (width: number, isOpen: (l: LevelDef) => boolean) => {
  const nodes: NodePos[] = [];
  const branches: NodePos[] = [];
  const banners: BannerPos[] = [];
  let y = TOP_PAD;
  let lastBiome = '';
  const amp = Math.min(120, width * 0.28);
  MAIN_LEVELS.forEach((level, i) => {
    if (level.biome !== lastBiome) {
      const bi = BIOMES.findIndex(b => b.id === level.biome);
      banners.push({ biomeIndex: bi, y, height: 0 });
      y += BANNER;
      lastBiome = level.biome;
    }
    const x = width / 2 + Math.sin(i * 0.95) * amp;
    const cy = y + ROW / 2;
    nodes.push({ level, x, y: cy });
    // Elite side paths branch off sideways, toward whichever side has room; a
    // second branch off the same level takes the other side. Chained branches
    // step down their side path.
    let longest = 1;
    branchesOf(level.id).filter(isOpen).forEach((b, k) => {
      const roomy = x < width / 2 ? 1 : -1;
      const side = k % 2 === 0 ? roomy : -roomy;
      const bx = Math.max(58, Math.min(width - 58, x + side * Math.min(150, width * 0.4)));
      const chain = branchChain(b, isOpen);
      longest = Math.max(longest, chain.length);
      chain.forEach((c, depth) => {
        const parent = depth === 0 ? { x, y: cy } : { x: bx, y: cy + 6 + (depth - 1) * BRANCH_STEP };
        branches.push({ level: c, x: bx, y: cy + 6 + depth * BRANCH_STEP, parent });
      });
    });
    const extraKeySpace = mapKeyAfter(level.id) ? KEY_EXTRA_ROW : 0;
    y += ROW + extraKeySpace + (longest - 1) * BRANCH_STEP;
  });
  // Place each Golden Rescue Key directly along the cubic Bezier road between its two nodes
  const nodeById = new Map(nodes.map(n => [n.level.id, n]));
  const mapKeys: KeyPos[] = [];
  for (const keyDef of MAP_KEYS) {
    const a = nodeById.get(keyDef.afterLevel);
    const b = nodeById.get(keyDef.beforeLevel);
    if (!a || !b) continue;
    const pt = cubicBezierAt(a, b, 0.50);
    mapKeys.push({ keyDef, x: pt.x, y: pt.y, from: { x: a.x, y: a.y } });
  }
  // biome band heights
  banners.forEach((b, i) => {
    const end = i + 1 < banners.length ? banners[i + 1].y : y + 40;
    b.height = end - b.y;
  });
  return { nodes, branches, mapKeys, banners, height: y + 60 };
};

const pathFor = (nodes: NodePos[]): string => {
  if (nodes.length === 0) return '';
  let d = `M ${nodes[0].x} ${nodes[0].y}`;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1];
    const b = nodes[i];
    const my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  return d;
};

interface Props {
  save: AdventureSave;
  onSelectLevel: (level: LevelDef) => void;
  /** Called when the player taps a ready Golden Rescue Key or finishes walking onto one */
  onOpenMapKey?: (keyId: string) => void;
  /** Golden Key id the fighter bubble is walking onto right now (Angry Birds 2 road walk-over) */
  walkingKeyId?: string | null;
  /** Called once the fighter bubble reaches `walkingKeyId` */
  onWalkKeyArrived?: (keyId: string) => void;
  onOpenCamp: () => void;
  onOpenGuide: () => void;
  onExit: () => void;
  highlightLevelId?: string | null;
  /** The arrival of these secret paths has played: remember it, so it plays once */
  onPathsRevealed?: (ids: string[]) => void;
  /** False when covered by modals/other tabs so background map animations pause */
  active?: boolean;
}

const AdventureMap: React.FC<Props> = ({
  save,
  onSelectLevel,
  onOpenMapKey,
  walkingKeyId,
  onWalkKeyArrived,
  onOpenCamp,
  onOpenGuide,
  onExit,
  highlightLevelId,
  onPathsRevealed,
  active = true,
}) => {
  recordComponentRender('AdventureMap');
  const { width: winW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const isLive = active && appActive && !reducedMotion;
  const onSelectLevelRef = useRef(onSelectLevel);
  onSelectLevelRef.current = onSelectLevel;
  const handleSelectNode = useCallback((level: LevelDef) => {
    onSelectLevelRef.current(level);
  }, []);
  const onOpenMapKeyRef = useRef(onOpenMapKey);
  onOpenMapKeyRef.current = onOpenMapKey;
  const handleOpenMapKey = useCallback((keyId: string) => {
    band.cue('keyFound');
    onOpenMapKeyRef.current?.(keyId);
  }, []);
  const width = Math.min(winW, 560);
  const openKey = openPaths(save).map(l => l.id).join(',');
  const { nodes, branches, mapKeys, banners, height } = useMemo(() => {
    const open = new Set(openKey.split(','));
    return layout(width, l => open.has(l.id));
  }, [width, openKey]);
  const frontier = getFrontierLevel(save);
  const scrollRef = useRef<ScrollView>(null);
  const stars = totalStars(save);
  const fighter = getFighter(save.selectedFighter);
  const campUnlocked = save.coinsUnlocked || save.armory.length > 0 || save.unlockedFighters.length > 1;
  const skillTreeKnown = isMechanicKnown(save, 'skill_tree') || Object.keys(save.skillNodes).length > 0;
  const showSkillNudge = skillTreeKnown && hasUnspentStars(save) && Object.keys(save.skillNodes).length === 0;
  const readyKeys = readyMapKeys(save);
  const firstReadyKey = readyKeys[0] ?? null;
  const hasLockedFriends = lockedFighters(save).length > 0;
  const walkingKey = walkingKeyId ? mapKeys.find(k => k.keyDef.id === walkingKeyId) ?? null : null;
  const guideMessage = companionMapGreeting(save, frontier, stars, showSkillNudge);

  // Secret paths the map is showing for the first time, and when each one arrives
  const freshKey = freshPaths(save).map(l => l.id).join(',');
  const arrivals = useMemo(() => {
    const out = new Map<string, { startMs: number; popMs: number }>();
    let at: number = reducedMotion ? 0 : ARRIVE.startMs;
    for (const b of branches) {
      if (!freshKey.split(',').includes(b.level.id)) continue;
      const trail = reducedMotion ? 0 : dashesBetween(b.parent!, b).points.length * ARRIVE.dashMs;
      out.set(b.level.id, { startMs: at, popMs: at + trail });
      at += trail + (reducedMotion ? 0 : ARRIVE.betweenMs);
    }
    return out;
  }, [branches, freshKey, reducedMotion]);

  // The arrival plays once: a chime as each node lands, then the save remembers it
  const onRevealedRef = useRef(onPathsRevealed);
  onRevealedRef.current = onPathsRevealed;
  useEffect(() => {
    if (arrivals.size === 0) return;
    const ids = [...arrivals.keys()];
    const pops = [...arrivals.values()].map(a => a.popMs);
    const timers = pops.map(ms => setTimeout(() => sfx('unlock'), ms));
    const revealDoneMs = reducedMotion
      ? ARRIVE.tagMs
      : Math.max(...pops) + ARRIVE.popMs + ARRIVE.tagMs;
    timers.push(setTimeout(() => onRevealedRef.current?.(ids), revealDoneMs));
    return () => timers.forEach(clearTimeout);
  }, [arrivals, reducedMotion]);

  // Scroll synchronously on first layout (zero 120ms teleport jump!) and smoothly when target shifts afterward
  const focusId = [...arrivals.keys()][0] ?? highlightLevelId ?? frontier.id;
  const targetY = useMemo(
    () => walkingKey?.y ?? [...nodes, ...branches].find(n => n.level.id === focusId)?.y,
    [walkingKey, nodes, branches, focusId]
  );
  const focusTargetKey = `${focusId}:${walkingKey?.keyDef.id ?? ''}`;
  const didInitialScrollRef = useRef(false);
  const lastFocusKeyRef = useRef(focusTargetKey);

  const handleContentSizeChange = useCallback(() => {
    if (didInitialScrollRef.current || targetY === undefined) return;
    didInitialScrollRef.current = true;
    lastFocusKeyRef.current = focusTargetKey;
    scrollRef.current?.scrollTo({ y: Math.max(0, targetY - 260), animated: false });
  }, [targetY, focusTargetKey]);

  useEffect(() => {
    if (targetY === undefined) return;
    if (!didInitialScrollRef.current) {
      // Fallback for test environments where onContentSizeChange does not fire
      didInitialScrollRef.current = true;
      lastFocusKeyRef.current = focusTargetKey;
      scrollRef.current?.scrollTo({ y: Math.max(0, targetY - 260), animated: false });
      return;
    }
    if (lastFocusKeyRef.current === focusTargetKey) return;
    lastFocusKeyRef.current = focusTargetKey;
    scrollRef.current?.scrollTo({ y: Math.max(0, targetY - 260), animated: !reducedMotion });
  }, [targetY, focusTargetKey, reducedMotion]);

  // Tactile press feedback for the bottom Play Next CTA
  const playPressed = useSharedValue(0);
  useEffect(() => () => cancelAnimation(playPressed), [playPressed]);
  const playNextAnimStyle = useAnimatedStyle(() =>
    reducedMotion
      ? { opacity: 1 - playPressed.value * (1 - BTN_PRESS.reducedOpacity) }
      : {
          transform: [
            { translateY: playPressed.value * BTN_PRESS.translateY },
            { scale: 1 - playPressed.value * (1 - BTN_PRESS.scale) },
          ],
        }
  );

  const unlockedNodes = nodes.filter(n => getLockReason(save, n.level) === null);
  const lastUnlocked = unlockedNodes[unlockedNodes.length - 1];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Only where you are and what you have: everything else lives at Camp */}
      <View style={s.topBar} testID="map-top-bar">
        <TouchableOpacity onPress={onExit} style={s.iconBtn} accessibilityLabel="Back to menu">
          <Icon name="ui/back-arrow" size={20} color={INK} noShadow />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>ADVENTURE</Text>
        <View style={s.starPill} testID="map-stars" accessibilityLabel={`${stars} of ${maxStars()} stars`}>
          <Text style={s.starGlyph}>★</Text>
          <Text style={s.starCount}>{stars}</Text>
        </View>
        {save.coinsUnlocked && <CoinPill coins={save.coins} />}
      </View>

      <View style={s.guideBanner}>
        <CompanionBubble
          testID="map-guide-banner"
          character={fighter.name}
          text={guideMessage}
          mood={firstReadyKey || stars === 0 ? 'victory' : 'curious'}
          animate={isLive}
          avatarSize={38}
          onPress={() =>
            firstReadyKey
              ? handleOpenMapKey(firstReadyKey.id)
              : showSkillNudge
                ? onOpenCamp()
                : onSelectLevel(frontier)
          }
        />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ alignItems: 'center' }}
        onContentSizeChange={handleContentSizeChange}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            { width, height, overflow: 'hidden' },
            Platform.OS === 'web' ? ({ contain: 'layout style' } as ViewStyle) : null,
          ]}
        >
          {banners.map(b => {
            const biome = BIOMES[b.biomeIndex];
            const open = isBiomeOpen(save, biome.id);
            const here = MAIN_LEVELS.filter(l => l.biome === biome.id);
            const earned = here.reduce((sum, l) => sum + (save.stars[l.id] ?? 0), 0);
            const totalBiomeStars = Math.max(1, here.length * 3);
            return (
              <View key={biome.id} style={[s.band, { top: b.y, height: b.height, backgroundColor: biome.colors.sky }]}>
                <BiomeScenery biome={biome} width={width} height={b.height} />
                <View style={s.bannerWrap}>
                  <View style={[s.banner, { borderColor: biome.colors.ink }]}>
                    <Text style={[s.bannerTitle, { color: biome.colors.ink }]}>{biome.name.toUpperCase()}</Text>
                    <Text style={[s.bannerSub, { color: biome.colors.ink }]}>{biome.subtitle}</Text>
                    {open ? (
                      // How much of this region's star is back in one piece (GPU scaleX fill)
                      <View style={s.worldProgress} testID={`map-world-progress-${biome.id}`} accessibilityLabel={`${earned} of ${here.length * 3} stars in ${biome.name}`}>
                        <WorldProgressBar ratio={earned / totalBiomeStars} reduced={reducedMotion} />
                        <Text style={[s.worldCount, { color: biome.colors.ink }]}>★ {earned}/{here.length * 3}</Text>
                      </View>
                    ) : (
                      <View style={s.gate}>
                        <Icon name="lorc/padlock" size={14} color={COLORS.canvasWhite} />
                        <Text style={s.gateText}>{biome.starGate} ★ to enter · you have {stars}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d={pathFor(nodes)} stroke="#FFFFFF" strokeWidth={14} fill="none" strokeLinecap="round" opacity={0.9} />
            {lastUnlocked && (
              <Path d={pathFor(unlockedNodes)} stroke={COLORS.actionYellow} strokeWidth={6} fill="none" strokeLinecap="round" />
            )}
            <Path d={pathFor(nodes)} stroke={INK} strokeWidth={2} fill="none" strokeDasharray="2 10" strokeLinecap="round" opacity={0.35} />
            {nodes.map(n => <Circle key={n.level.id} cx={n.x} cy={n.y} r={6} fill={INK} opacity={0.15} />)}
            {branches.filter(b => !arrivals.has(b.level.id)).map(b => (
              <Path
                key={b.level.id}
                d={`M ${b.parent!.x} ${b.parent!.y} L ${b.x} ${b.y}`}
                stroke={pathColor(b.level)}
                strokeWidth={5}
                strokeDasharray={`3 ${DASH_STEP - 3}`}
                strokeLinecap="round"
                fill="none"
              />
            ))}
          </Svg>

          {/* A path that just opened draws itself out, dash by dash, from the level it hangs off */}
          {branches.map(b => {
            const arrival = arrivals.get(b.level.id);
            if (!arrival) return null;
            const { points, angle } = dashesBetween(b.parent!, b);
            return points.map((pt, k) => (
              <TrailDash key={`${b.level.id}-${k}`} at={pt} angle={angle} color={pathColor(b.level)} delay={arrival.startMs + k * ARRIVE.dashMs} still={reducedMotion} />
            ));
          })}

          {/* Side path nodes */}
          {branches.map(n => (
            <MapNode
              key={n.level.id}
              node={n}
              save={save}
              isFrontier={false}
              isLive={isLive}
              onSelectLevel={handleSelectNode}
              fighterName={fighter.name}
              arriveAtMs={arrivals.get(n.level.id)?.popMs}
              still={reducedMotion}
            />
          ))}

          {/* Golden Rescue Keys sitting directly along the road between main nodes */}
          {mapKeys.map(kp => (
            <MapKeyNode
              key={kp.keyDef.id}
              item={kp}
              save={save}
              hasLockedFriends={hasLockedFriends}
              isLive={isLive}
              still={reducedMotion}
              onPress={handleOpenMapKey}
            />
          ))}

          {nodes.map(n => (
            <MapNode
              key={n.level.id}
              node={n}
              save={save}
              isFrontier={n.level.id === frontier.id}
              hideAvatar={Boolean(walkingKey)}
              isLive={isLive}
              onSelectLevel={handleSelectNode}
              fighterName={fighter.name}
              still={reducedMotion}
            />
          ))}

          {/* Fighter walking along the road right onto a newly reached Golden Key */}
          {walkingKey && (
            <KeyWalker
              key={walkingKey.keyDef.id}
              from={walkingKey.from}
              to={{ x: walkingKey.x, y: walkingKey.y }}
              fighterName={fighter.name}
              still={reducedMotion}
              onArrived={() => {
                band.cue('keyFound');
                onWalkKeyArrived?.(walkingKey.keyDef.id);
              }}
            />
          )}
        </View>
      </ScrollView>

      <View style={[s.dock, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 8), justifyContent: stars === 0 && !campUnlocked ? 'center' : 'space-between' }]}>
        {stars > 0 && <DockButton testID="map-dock-guide" icon="lorc/open-book" label="Guide" onPress={onOpenGuide} />}
        <AnimatedPressable
          testID="map-play-next"
          onPress={() => onSelectLevel(frontier)}
          onPressIn={() => {
            playPressed.value = withTiming(1, { duration: BTN_PRESS.pressInMs, easing: EASE.ui, ...(reducedMotion ? STAYS : {}) });
          }}
          onPressOut={() => {
            playPressed.value = reducedMotion
              ? withTiming(0, { duration: BTN_PRESS.pressInMs, easing: EASE.ui, ...STAYS })
              : withSpring(0, SPRING.snappy);
          }}
          accessibilityRole="button"
          style={[s.playNext, playNextAnimStyle]}
        >
          <FighterAvatar character={fighter.name} size={34} mood="anticipation" animate={isLive} lightweight />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.playNextLabel}>PLAY {frontier.id}</Text>
            <Text style={s.playNextSub} numberOfLines={1}>{frontier.name}</Text>
          </View>
        </AnimatedPressable>
        {(stars > 0 || campUnlocked) && (
          <DockButton
            testID="map-dock-camp"
            icon="lorc/campfire"
            label="Camp"
            onPress={onOpenCamp}
            disabled={!campUnlocked}
            badge={
              campUnlocked && (
                (skillTreeKnown && hasUnspentStars(save)) ||
                (save.workshopUnlocked && refundableCoins(save) === 0 && save.coins >= 60) ||
                (save.bountiesUnlocked && BOUNTIES.some(b => isBountyUnlocked(save, b) && !save.completedBounties.includes(b.id) && b.progress(save) / b.target >= 0.75))
              )
            }
          />
        )}
      </View>
    </View>
  );
};

/** GPU-only scaleX region star progress fill (zero layout width animation). */
const WorldProgressBar: React.FC<{ ratio: number; reduced: boolean }> = memo(function WorldProgressBar({ ratio, reduced }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const fill = useSharedValue(reduced ? clamped : 0);
  useEffect(() => {
    if (reduced) {
      fill.value = clamped;
      return;
    }
    fill.value = withTiming(clamped, { duration: MS.move, easing: EASE.enterSoft });
    return () => cancelAnimation(fill);
  }, [clamped, reduced, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));

  return (
    <View style={s.worldTrack}>
      <Animated.View style={[s.worldFill, fillStyle]} />
    </View>
  );
});

const DockButton: React.FC<{ testID?: string; icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void; disabled?: boolean; badge?: boolean }> = ({ testID, icon, label, onPress, disabled, badge }) => {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  useEffect(() => () => cancelAnimation(pressed), [pressed]);
  const animStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: disabled ? 0.35 : 1 - pressed.value * (1 - BTN_PRESS.reducedOpacity) }
      : {
          opacity: disabled ? 0.35 : 1,
          transform: [{ scale: 1 - pressed.value * (1 - BTN_PRESS.scale) }],
        }
  );
  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        pressed.value = withTiming(1, { duration: BTN_PRESS.pressInMs, easing: EASE.ui, ...(reduced ? STAYS : {}) });
      }}
      onPressOut={() => {
        pressed.value = reduced
          ? withTiming(0, { duration: BTN_PRESS.pressInMs, easing: EASE.ui, ...STAYS })
          : withSpring(0, SPRING.snappy);
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[s.dockBtn, animStyle]}
      accessibilityLabel={label}
    >
      <Icon name={disabled ? 'lorc/padlock' : icon} size={26} color={INK} />
      <Text style={s.dockLabel}>{label}</Text>
      {badge && <View style={s.badgeDot} />}
    </AnimatedPressable>
  );
};

/** One dash of a side path, laid down as the path draws itself toward its node. */
const TrailDash: React.FC<{ at: Point; angle: number; color: string; delay: number; still?: boolean }> = ({ at, angle, color, delay, still }) => {
  const t = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (!still) {
      t.value = withDelay(delay, withTiming(1, { duration: MS.feedback + 30, easing: EASE.enter }));
    }
    return () => cancelAnimation(t);
  }, [delay, still, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ rotate: `${angle}rad` }, { scale: 0.4 + 0.6 * t.value }] }));
  return <Animated.View pointerEvents="none" style={[s.dash, { left: at.x - 4, top: at.y - 2.5, backgroundColor: color }, style]} />;
};

/**
 * A node that was not on the map a moment ago: it pops in, a ring bursts from it, and a tag names the surprise.
 * `still` (reduced motion): node appears settled; tag gently crossfades in and clears cleanly via `STAYS`.
 */
const Arrival: React.FC<{ delay: number; size: number; still?: boolean; children: React.ReactNode }> = ({ delay, size, still, children }) => {
  const pop = useSharedValue(still ? 1 : 0);
  const ring = useSharedValue(0);
  const tag = useSharedValue(0);
  useEffect(() => {
    if (still) {
      pop.value = 1;
      ring.value = 0;
      const fadeDur = reducedMs(MS.quick);
      tag.value = withSequence(
        STAYS.reduceMotion,
        withTiming<number>(1, { duration: fadeDur, easing: EASE.ui, ...STAYS }),
        withDelay(Math.max(400, ARRIVE.tagMs - 500), withTiming<number>(0, { duration: fadeDur, easing: EASE.exitSoft, ...STAYS }), STAYS.reduceMotion)
      );
      return () => {
        cancelAnimation(pop);
        cancelAnimation(ring);
        cancelAnimation(tag);
      };
    }
    pop.value = withDelay(delay, withSequence(withTiming(1.2, { duration: MS.screen, easing: EASE.enter }), withTiming(1, { duration: MS.quick - 20, easing: EASE.enterSoft })));
    ring.value = withDelay(delay, withTiming(1, { duration: MS.hero - 80, easing: EASE.enterSoft }));
    tag.value = withDelay(delay + MS.feedback, withSequence(withTiming(1, { duration: MS.quick, easing: EASE.ui }), withDelay(ARRIVE.tagMs - 500, withTiming(0, { duration: MS.move, easing: EASE.exitSoft }))));
    return () => {
      cancelAnimation(pop);
      cancelAnimation(ring);
      cancelAnimation(tag);
    };
  }, [delay, still, pop, ring, tag]);
  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 4), transform: [{ scale: pop.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value === 0 ? 0 : 1 - ring.value, transform: [{ scale: 0.6 + ring.value * 1.6 }] }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tag.value,
    transform: [{ translateY: still ? 0 : (1 - tag.value) * 6 }],
  }));
  return (
    <View style={s.arrival} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[s.arrivalRing, { width: size, height: size, borderRadius: size / 2, top: 6 }, ringStyle]} />
      <Animated.View style={[s.arrival, popStyle]} pointerEvents="box-none">{children}</Animated.View>
      <Animated.View testID="secret-path-reveal" pointerEvents="none" style={[s.secretTag, tagStyle]}>
        <Text style={s.secretTagText}>SECRET PATH!</Text>
      </Animated.View>
    </View>
  );
};

/**
 * Angry Birds 2–style Golden Rescue Key sitting on the winding road between two
 * consecutive levels. Shows three clear states:
 *   1. Upcoming (silver-pewter preview ahead down the road)
 *   2. Ready & unclaimed (gleaming gold medallion + pulsing halo + "FREE FRIEND!")
 *   3. Claimed (gold badge celebrating the friend you freed right here)
 */
const MapKeyNode: React.FC<{
  item: KeyPos;
  save: AdventureSave;
  hasLockedFriends: boolean;
  isLive: boolean;
  still?: boolean;
  onPress: (keyId: string) => void;
}> = memo(function MapKeyNode({ item, save, hasLockedFriends, isLive, still, onPress }) {
  const { keyDef, x, y } = item;
  const reached = isMapKeyReached(save, keyDef);
  const claimed = isMapKeyClaimed(save, keyDef);
  const rescuedFighter = save.claimedMapKeys?.[keyDef.id] ?? null;
  const ready = reached && !claimed && hasLockedFriends;

  // Subtle expanding gold halo ring only while ready, active, and motion-enabled
  const halo = useSharedValue(0);
  const appActive = useAppActive();
  const haloLive = ready && isLive && appActive && !still;
  useEffect(() => {
    if (!haloLive) {
      cancelAnimation(halo);
      halo.value = 0;
      return;
    }
    halo.value = 0;
    halo.value = withRepeat(withTiming(1, { duration: MS.hero + MS.panel, easing: EASE.enterSoft }), -1);
    return () => cancelAnimation(halo);
  }, [haloLive, halo]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: halo.value === 0 ? 0 : (1 - halo.value) * 0.72,
    transform: [{ scale: 0.92 + halo.value * 0.65 }],
  }));

  // Press feedback matching MapNode
  const press = useSharedValue(1);
  useEffect(() => () => cancelAnimation(press), [press]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const pressIn = () => {
    if (!still && ready) press.value = withTiming(SCALE.press, { duration: MS.feedback / 2, easing: EASE.ui });
  };
  const pressOut = () => {
    if (!still && ready) {
      press.value = withSequence(
        withTiming(SCALE.press, { duration: MS.feedback / 2, easing: EASE.ui }),
        withSpring(1, SPRING.snappy)
      );
    }
  };

  if (claimed && rescuedFighter) {
    return (
      <View
        testID={`map-key-${keyDef.id}`}
        accessibilityLabel={`Golden Key redeemed: freed ${rescuedFighter}`}
        style={[s.keyWrap, { left: x - 54, top: y - 22 }]}
        pointerEvents="none"
      >
        <View style={s.keyClaimed}>
          <FighterAvatar character={rescuedFighter} size={26} mood="victory" animate={false} />
        </View>
        <View style={s.keyClaimedTag}>
          <Text style={s.keyClaimedText}>FREED</Text>
        </View>
      </View>
    );
  }

  const circle = (
    <Animated.View style={pressStyle}>
      <TouchableOpacity
        testID={`map-key-${keyDef.id}`}
        disabled={!ready}
        onPress={() => onPress(keyDef.id)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        accessibilityLabel={
          ready
            ? `Golden Key ready — tap to free a caged friend`
            : `Golden Key ahead — clear ${keyDef.afterLevel} to unlock a friend`
        }
        style={[s.keyCircle, ready ? s.keyCircleReady : s.keyCircleLocked]}
      >
        <GoldenKeyArt size={ready ? 32 : 24} dimmed={!ready} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[s.keyWrap, { left: x - 54, top: y - (ready ? 25 : 20) }]} pointerEvents="box-none">
      {ready && <Animated.View pointerEvents="none" style={[s.keyHalo, haloStyle]} />}
      {ready ? <Bob active={isLive} amount={3} phase={Math.PI * 1.32} periodMs={1320}>{circle}</Bob> : circle}
      {ready ? (
        <View style={s.keyReadyTag} pointerEvents="none">
          <Text style={s.keyReadyText}>FREE FRIEND!</Text>
        </View>
      ) : (
        <View style={s.keyLockedTag} pointerEvents="none">
          <Text style={s.keyLockedText}>KEY</Text>
        </View>
      )}
    </View>
  );
});

/** Fighter bubble smoothly walking from `afterLevel` onto a newly reached Golden Rescue Key. */
const KeyWalker: React.FC<{
  from: Point;
  to: Point;
  fighterName: CharacterName;
  still?: boolean;
  onArrived: () => void;
}> = ({ from, to, fighterName, still, onArrived }) => {
  const onArrivedRef = useRef(onArrived);
  onArrivedRef.current = onArrived;
  const dx = useSharedValue(still ? 0 : from.x - to.x);
  const dy = useSharedValue(still ? 0 : from.y - to.y);
  const hop = useSharedValue(1);

  useEffect(() => {
    if (still) {
      const t = setTimeout(() => onArrivedRef.current(), STAGGER.item);
      return () => clearTimeout(t);
    }
    dx.value = withTiming(0, { duration: KEY_WALK_MS, easing: EASE.enterSoft });
    dy.value = withTiming(0, { duration: KEY_WALK_MS, easing: EASE.enterSoft });
    hop.value = withSequence(
      withTiming(1.12, { duration: KEY_WALK_MS / 2, easing: EASE.enter }),
      withTiming(1, { duration: KEY_WALK_MS / 2, easing: EASE.ui })
    );
    const t = setTimeout(() => onArrivedRef.current(), KEY_WALK_MS + STAGGER.item);
    return () => {
      clearTimeout(t);
      cancelAnimation(dx);
      cancelAnimation(dy);
      cancelAnimation(hop);
    };
  }, [still, dx, dy, hop]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { translateY: dy.value }, { scale: hop.value }],
  }));

  return (
    <Animated.View
      testID="map-key-walker"
      pointerEvents="none"
      style={[s.keyWalker, { left: to.x - 20, top: to.y - 20 }, style]}
    >
      <FighterAvatar character={fighterName} size={32} mood="victory" animate={false} />
    </Animated.View>
  );
};

const MapNode: React.FC<{
  node: NodePos;
  save: AdventureSave;
  isFrontier: boolean;
  hideAvatar?: boolean;
  isLive: boolean;
  onSelectLevel: (level: LevelDef) => void;
  fighterName: CharacterName;
  /** A secret path the map shows for the first time: when its node pops in */
  arriveAtMs?: number;
  /** Reduced motion: arrive without animation */
  still?: boolean;
}> = memo(function MapNode({ node, save, isFrontier, hideAvatar, isLive, onSelectLevel, fighterName, arriveAtMs, still }) {
  const { level, x, y } = node;
  const lock = getLockReason(save, level);
  const locked = lock !== null;
  const stars = save.stars[level.id] ?? 0;
  const foe = levelFoe(level);
  const side = !!level.branchOf;
  const practice = !!level.rules.sandbox;
  const elite = side && !practice;
  const size = level.isBoss ? 78 : side ? 54 : 62;
  const isNew = !locked && !save.seenMechanics.includes(level.introduces);
  const mech = getMechanic(level.introduces);
  // The next foes down the road can be seen coming (dimmed); a region that is still gated keeps its padlocks
  const comingUp = lock?.kind === 'previous';
  // A star here that has not been won still hides something to unlock
  const hidesLoot = !practice && starRewards(level).some((reward, i) => i >= stars && unlockablesOf(reward).length > 0);

  // The press: the node sinks to SCALE.press at once and springs back, even on a tap too quick to hold it down
  const press = useSharedValue(1);
  useEffect(() => () => cancelAnimation(press), [press]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const pressIn = () => {
    if (!still) press.value = withTiming(SCALE.press, { duration: MS.feedback / 2, easing: EASE.ui });
  };
  const pressOut = () => {
    if (!still) press.value = withSequence(withTiming(SCALE.press, { duration: MS.feedback / 2, easing: EASE.ui }), withSpring(1, SPRING.snappy));
  };

  const nodeButton = (
    <Animated.View style={pressStyle}>
    <TouchableOpacity
      testID={`map-node-${level.id}`}
      onPress={() => onSelectLevel(level)}
      onPressIn={pressIn}
      onPressOut={pressOut}
      activeOpacity={0.85}
      accessibilityLabel={`${practice ? 'Practice' : `Level ${level.id}`} ${level.name}${locked ? ' locked' : ''}`}
      style={[
        s.node,
        { width: size, height: size, borderRadius: size / 2 },
        locked ? s.nodeLocked : practice ? s.nodePractice : elite ? s.nodeElite : stars === 3 ? s.nodePerfect : stars > 0 ? s.nodeDone : s.nodeOpen,
        isFrontier && s.nodeFrontier,
      ]}
    >
      {locked && comingUp ? (
        <View style={s.comingUp}>
          <EnemyAvatar enemy={foe} size={Math.round(size * 0.76)} mood="idle" lightweight animate={false} />
        </View>
      ) : locked ? (
        <Icon name="lorc/padlock" size={size * 0.55} color="#A69F95" />
      ) : (
        <EnemyAvatar
          enemy={foe}
          size={Math.round(size * 0.76)}
          mood={isFrontier ? 'menacing' : 'idle'}
          lightweight={!isFrontier || !isLive}
          animate={isFrontier && isLive}
        />
      )}
      {elite && (
        <View style={s.skull}><Icon name="lorc/daemon-skull" size={14} color={locked ? '#A69F95' : ELITE} /></View>
      )}
      {level.isBoss && (!locked || comingUp) && (
        <View style={s.crown}><Icon name="lorc/crown-coin" size={18} color={locked ? '#A69F95' : '#E0A800'} /></View>
      )}
      {locked && comingUp && (
        <View style={s.lockBadge}><Icon name="lorc/padlock" size={11} color="#8E877D" /></View>
      )}
      {hidesLoot && (
        <View style={[s.lootTag, locked && { opacity: 0.6 }]} testID={`map-loot-${level.id}`} accessibilityLabel="A reward is still hidden here">
          <Icon name="lorc/locked-chest" size={13} color={INK} />
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );

  const content = (
    <>
      {isFrontier ? <Bob active={isLive} phase={0} periodMs={1400}>{nodeButton}</Bob> : nodeButton}
      <View style={s.nodeMeta} pointerEvents="none">
        {/* Practice earns no stars */}
        {!locked && !practice && <StarRow stars={stars} size={15} />}
        <Text style={[s.nodeLabel, locked && { color: '#A69F95' }]}>
          {practice ? 'PRACTICE' : elite ? (isFighterTrial(level) ? 'TRIAL' : 'ELITE') : level.id}
        </Text>
      </View>
      {isNew && (
        <View style={s.newTag} pointerEvents="none">
          <Icon name={mech.icon} size={11} color={INK} />
          <Text style={s.newTagText}>NEW</Text>
        </View>
      )}
      {isFrontier && !hideAvatar && (
        <View style={s.avatar} pointerEvents="none">
          {/* Phase + period offset against frontier node so marker and node never bob in lockstep */}
          <Bob amount={3} active={isLive} phase={Math.PI * 0.78} periodMs={1540}>
            <View style={s.avatarBubble}>
              <FighterAvatar character={fighterName} size={30} mood="anticipation" animate={isLive} />
            </View>
          </Bob>
        </View>
      )}
    </>
  );

  return (
    <View style={[s.nodeWrap, { left: x - 60, top: y - size / 2 - 6 }]} pointerEvents="box-none">
      {arriveAtMs === undefined ? content : <Arrival delay={arriveAtMs} size={size} still={still}>{content}</Arrival>}
    </View>
  );
});

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8F6E3',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ contain: 'layout style' } as ViewStyle) : null),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 2,
    borderBottomColor: INK,
    zIndex: 10,
  },
  starPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.canvasWhite, borderColor: INK, borderWidth: 2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  starGlyph: { color: '#E0A800', fontSize: 15 },
  starCount: { fontWeight: '800', color: INK, fontSize: 14, fontVariant: ['tabular-nums'] },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  // The title gives way first on a narrow screen, so the stars and coins are never cut off
  title: { flex: 1, fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 16 },
  guideBanner: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
    zIndex: 9,
    ...(Platform.OS === 'web' ? ({ contain: 'layout style' } as ViewStyle) : null),
  },
  band: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  worldProgress: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  worldTrack: { width: 96, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.paperBeige, overflow: 'hidden' },
  worldFill: { width: '100%', height: '100%', backgroundColor: '#F5B800', transformOrigin: 'left center' },
  worldCount: { fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  comingUp: { opacity: 0.38 },
  lockBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 1.5, borderColor: '#B8B0A4', padding: 2 },
  lootTag: { position: 'absolute', bottom: -6, left: -8, backgroundColor: COLORS.actionYellow, borderRadius: 9, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 3, paddingVertical: 2 },
  bannerWrap: { alignItems: 'center', paddingTop: 22 },
  banner: { backgroundColor: COLORS.canvasWhite, borderWidth: 2, borderBottomWidth: 4, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8, alignItems: 'center', gap: 2 },
  bannerTitle: { fontWeight: '900', letterSpacing: 2, fontSize: 16 },
  bannerSub: { fontSize: 12, fontWeight: '600', opacity: 0.8 },
  gate: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '92%', backgroundColor: INK, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 4 },
  gateText: { flexShrink: 1, color: COLORS.canvasWhite, fontWeight: '800', fontSize: 11 },
  nodeWrap: { position: 'absolute', width: 120, alignItems: 'center' },
  node: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderBottomWidth: 6, borderColor: INK },
  nodeLocked: { backgroundColor: '#E9E4DC', borderColor: '#B8B0A4' },
  nodeOpen: { backgroundColor: COLORS.canvasWhite },
  nodeDone: { backgroundColor: TONE.coinPale },
  nodePerfect: { backgroundColor: COLORS.actionYellow },
  nodeElite: { backgroundColor: ELITE, borderColor: COLORS.deepOnyx },
  nodePractice: { backgroundColor: '#F6E3A8', borderColor: PRACTICE },
  dash: { position: 'absolute', width: 8, height: 5, borderRadius: 2.5 },
  arrival: { width: '100%', alignItems: 'center' },
  arrivalRing: { position: 'absolute', borderWidth: 4, borderColor: COLORS.actionYellow },
  secretTag: { position: 'absolute', top: -30, backgroundColor: COLORS.deepOnyx, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  secretTagText: { color: COLORS.actionYellow, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  skull: { position: 'absolute', top: -10, right: -6, backgroundColor: COLORS.canvasWhite, borderRadius: 11, borderWidth: 2, borderColor: INK, padding: 1 },
  nodeFrontier: { borderColor: COLORS.deepOnyx, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  crown: { position: 'absolute', top: -14, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2, borderColor: INK, padding: 1 },
  nodeMeta: { alignItems: 'center', marginTop: 2, gap: 1 },
  nodeLabel: { fontWeight: '900', color: INK, fontSize: 12, letterSpacing: 1 },
  newTag: { position: 'absolute', top: -4, right: 6, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.actionYellow, borderWidth: 1.5, borderColor: INK, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  newTagText: { fontSize: 9, fontWeight: '900', color: INK, letterSpacing: 1 },
  avatar: { position: 'absolute', left: -6, top: 4 },
  avatarBubble: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.canvasWhite, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  // Golden Rescue Key nodes along the road
  keyWrap: { position: 'absolute', width: 108, alignItems: 'center', zIndex: 4 },
  keyHalo: { position: 'absolute', top: 0, width: 50, height: 50, borderRadius: 25, borderWidth: 3.5, borderColor: COLORS.actionYellow },
  keyCircle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderBottomWidth: 5 },
  keyCircleReady: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.actionYellow, borderColor: INK },
  keyCircleLocked: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFECE6', borderColor: '#A69F95', borderBottomWidth: 4 },
  keyReadyTag: { marginTop: 3, backgroundColor: COLORS.deepOnyx, borderRadius: 999, borderWidth: 1.5, borderColor: COLORS.actionYellow, paddingHorizontal: 7, paddingVertical: 2 },
  keyReadyText: { color: COLORS.actionYellow, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  keyLockedTag: { marginTop: 2, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, borderWidth: 1, borderColor: '#B8B0A4', paddingHorizontal: 6, paddingVertical: 1 },
  keyLockedText: { color: '#7D766D', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  keyClaimed: { width: 42, height: 42, borderRadius: 21, backgroundColor: TONE.coinPale, borderWidth: 2.5, borderBottomWidth: 4, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  keyClaimedTag: { marginTop: 2, backgroundColor: COLORS.logicTeal, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 6, paddingVertical: 1 },
  keyClaimedText: { color: COLORS.canvasWhite, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  keyWalker: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.canvasWhite, borderWidth: 2.5, borderColor: INK, alignItems: 'center', justifyContent: 'center', zIndex: 8 },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 2,
    borderTopColor: INK,
    gap: 6,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ contain: 'layout style' } as ViewStyle) : null),
  },
  dockBtn: { alignItems: 'center', width: 58 },
  dockLabel: { fontSize: 10, fontWeight: '800', color: INK, marginTop: 2 },
  badgeDot: { position: 'absolute', top: -2, right: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.impactRed, borderWidth: 2, borderColor: COLORS.canvasWhite },
  playNext: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.actionYellow, borderWidth: 2, borderBottomWidth: 5, borderColor: INK, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, maxWidth: 260 },
  playNextLabel: { fontWeight: '900', fontSize: 16, color: INK, letterSpacing: 1 },
  playNextSub: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: INK },
});

export default AdventureMap;
