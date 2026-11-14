/**
 * The adventure map — a winding path of foe nodes through the worlds
 * (Angry Birds / Bloons style). Tap a node to open the level preview.
 *
 * Side paths (elite branches, fighter trials, practice) are secrets: a path is
 * not drawn at all until it opens, and the first time the map shows one its
 * trail draws itself out from the level it hangs off and its node pops in.
 * A branch can lead on to further branches.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSequence, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { sfx } from '@/audio';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { CharacterName } from '@/types';
import type { AdventureSave, LevelDef } from '../types';
import { MAIN_LEVELS, branchesOf } from '../data/levels';
import { BIOMES } from '../data/biomes';
import { levelFoe } from '../data/foes';
import { getMechanic } from '../data/mechanics';
import { getFighter } from '../data/fighters';
import { isFighterTrial } from '../data/rewards';
import { freshPaths, hasUnspentStars, getFrontierLevel, getLockReason, maxStars, openPaths, totalStars, isBiomeOpen } from '../progress';
import { Bob, CoinPill, INK, StarRow, TONE } from './ui';

const ELITE = '#5B2333';
/** Practice paths: straw, not blood */
const PRACTICE = '#8A6420';
const ROW = 112;
/** Vertical step between branches that chain off one another */
const BRANCH_STEP = 92;
const BANNER = 132;
const TOP_PAD = 24;

/** A side path is drawn as dashes this far apart (the SVG trail and the arriving one share it) */
const DASH_STEP = 12;
/** A fresh path waits for the map to scroll to it, then lays one dash at a time, then its node pops */
const ARRIVE = { startMs: 700, dashMs: 55, popMs: 380, tagMs: 2000, betweenMs: 500 } as const;

interface Point { x: number; y: number }
interface NodePos { level: LevelDef; x: number; y: number; parent?: Point }
interface BannerPos { biomeIndex: number; y: number; height: number }

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
    y += ROW + (longest - 1) * BRANCH_STEP;
  });
  // biome band heights
  banners.forEach((b, i) => {
    const end = i + 1 < banners.length ? banners[i + 1].y : y + 40;
    b.height = end - b.y;
  });
  return { nodes, branches, banners, height: y + 60 };
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
  onOpenCamp: () => void;
  onOpenGuide: () => void;
  onExit: () => void;
  highlightLevelId?: string | null;
  /** The arrival of these secret paths has played: remember it, so it plays once */
  onPathsRevealed?: (ids: string[]) => void;
}

const AdventureMap: React.FC<Props> = ({ save, onSelectLevel, onOpenCamp, onOpenGuide, onExit, highlightLevelId, onPathsRevealed }) => {
  const { width: winW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const width = Math.min(winW, 560);
  const openKey = openPaths(save).map(l => l.id).join(',');
  const { nodes, branches, banners, height } = useMemo(() => {
    const open = new Set(openKey.split(','));
    return layout(width, l => open.has(l.id));
  }, [width, openKey]);
  const frontier = getFrontierLevel(save);
  const scrollRef = useRef<ScrollView>(null);
  const stars = totalStars(save);
  const fighter = getFighter(save.selectedFighter);
  const campUnlocked = save.coinsUnlocked || save.armory.length > 0 || save.unlockedFighters.length > 1 || save.coins > 0 || save.lifetimeCoins > 0;

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
    timers.push(setTimeout(() => onRevealedRef.current?.(ids), Math.max(...pops) + ARRIVE.popMs + ARRIVE.tagMs));
    return () => timers.forEach(clearTimeout);
  }, [arrivals, reducedMotion]);

  // Scroll so a path that just opened, else the level asked for, else the frontier is in view
  const focusId = [...arrivals.keys()][0] ?? highlightLevelId ?? frontier.id;
  useEffect(() => {
    const target = [...nodes, ...branches].find(n => n.level.id === focusId);
    if (!target) return;
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, target.y - 260), animated: true }), 120);
    return () => clearTimeout(t);
  }, [nodes, branches, focusId]);

  const unlockedNodes = nodes.filter(n => getLockReason(save, n.level) === null);
  const lastUnlocked = unlockedNodes[unlockedNodes.length - 1];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Only where you are and what you have: everything else lives at Camp */}
      <View style={s.topBar} testID="map-top-bar">
        <TouchableOpacity onPress={onExit} style={s.iconBtn} accessibilityLabel="Back to menu">
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>ADVENTURE</Text>
        <View style={s.starPill} testID="map-stars" accessibilityLabel={`${stars} of ${maxStars()} stars`}>
          <Text style={s.starGlyph}>★</Text>
          <Text style={s.starCount}>{stars}</Text>
        </View>
        {(save.coinsUnlocked || save.coins > 0 || save.lifetimeCoins > 0) && <CoinPill coins={save.coins} />}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={{ width, height }}>
          {banners.map(b => {
            const biome = BIOMES[b.biomeIndex];
            const open = isBiomeOpen(save, biome.id);
            return (
              <View key={biome.id} style={[s.band, { top: b.y, height: b.height, backgroundColor: biome.colors.sky }]}>
                <View style={[s.ground, { backgroundColor: biome.colors.ground }]} />
                {biome.decor.map((d, i) => (
                  <View key={i} style={[s.decor, { top: 40 + ((i * 197) % Math.max(60, b.height - 80)), left: i % 2 === 0 ? 8 + i * 6 : undefined, right: i % 2 === 1 ? 10 + i * 4 : undefined }]}>
                    <Icon name={d} size={30 + (i % 2) * 10} color={biome.colors.ground} />
                  </View>
                ))}
                <View style={s.bannerWrap}>
                  <View style={[s.banner, { borderColor: biome.colors.ink }]}>
                    <Text style={[s.bannerTitle, { color: biome.colors.ink }]}>{biome.name.toUpperCase()}</Text>
                    <Text style={[s.bannerSub, { color: biome.colors.ink }]}>{biome.subtitle}</Text>
                    {!open && (
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
              onPress={() => onSelectLevel(n.level)}
              fighterName={fighter.name}
              arriveAtMs={arrivals.get(n.level.id)?.popMs}
              still={reducedMotion}
            />
          ))}

          {nodes.map(n => (
            <MapNode
              key={n.level.id}
              node={n}
              save={save}
              isFrontier={n.level.id === frontier.id}
              onPress={() => onSelectLevel(n.level)}
              fighterName={fighter.name}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[s.dock, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 8) }]}>
        <DockButton testID="map-dock-guide" icon="lorc/open-book" label="Guide" onPress={onOpenGuide} />
        <TouchableOpacity testID="map-play-next" onPress={() => onSelectLevel(frontier)} style={s.playNext} activeOpacity={0.85}>
          <FighterAvatar character={fighter.name} size={34} mood="anticipation" />
          <View style={{ flex: 1 }}>
            <Text style={s.playNextLabel}>PLAY {frontier.id}</Text>
            <Text style={s.playNextSub} numberOfLines={1}>{frontier.name}</Text>
          </View>
        </TouchableOpacity>
        <DockButton testID="map-dock-camp" icon="lorc/campfire" label="Camp" onPress={onOpenCamp} disabled={!campUnlocked} badge={campUnlocked && hasUnspentStars(save)} />
      </View>
    </View>
  );
};

const DockButton: React.FC<{ testID?: string; icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void; disabled?: boolean; badge?: boolean }> = ({ testID, icon, label, onPress, disabled, badge }) => (
  <TouchableOpacity testID={testID} onPress={onPress} disabled={disabled} accessibilityState={{ disabled: !!disabled }} style={[s.dockBtn, disabled && { opacity: 0.35 }]} accessibilityLabel={label}>
    <Icon name={disabled ? 'lorc/padlock' : icon} size={26} color={INK} />
    <Text style={s.dockLabel}>{label}</Text>
    {badge && <View style={s.badgeDot} />}
  </TouchableOpacity>
);

/** One dash of a side path, laid down as the path draws itself toward its node. */
const TrailDash: React.FC<{ at: Point; angle: number; color: string; delay: number; still?: boolean }> = ({ at, angle, color, delay, still }) => {
  const t = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (!still) t.value = withDelay(delay, withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }));
  }, [delay, still, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ rotate: `${angle}rad` }, { scale: 0.4 + 0.6 * t.value }] }));
  return <Animated.View pointerEvents="none" style={[s.dash, { left: at.x - 4, top: at.y - 2.5, backgroundColor: color }, style]} />;
};

/**
 * A node that was not on the map a moment ago: it pops in, a ring bursts from it, and a tag names the surprise.
 * `still` (reduced motion): it is simply there, with its tag.
 */
const Arrival: React.FC<{ delay: number; size: number; still?: boolean; children: React.ReactNode }> = ({ delay, size, still, children }) => {
  const pop = useSharedValue(still ? 1 : 0);
  const ring = useSharedValue(0);
  const tag = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    pop.value = withDelay(delay, withSequence(withTiming(1.2, { duration: 220, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) })));
    ring.value = withDelay(delay, withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }));
    tag.value = withDelay(delay + 120, withSequence(withTiming(1, { duration: 180 }), withDelay(ARRIVE.tagMs - 500, withTiming(0, { duration: 300 }))));
  }, [delay, still, pop, ring, tag]);
  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 4), transform: [{ scale: pop.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value === 0 ? 0 : 1 - ring.value, transform: [{ scale: 0.6 + ring.value * 1.6 }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value, transform: [{ translateY: (1 - tag.value) * 6 }] }));
  return (
    <View style={s.arrival} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[s.arrivalRing, { width: size, height: size, borderRadius: size / 2, top: 6 }, ringStyle]} />
      <Animated.View style={[s.arrival, popStyle]} pointerEvents="box-none">{children}</Animated.View>
      <Animated.View pointerEvents="none" style={[s.secretTag, tagStyle]}>
        <Text style={s.secretTagText}>SECRET PATH!</Text>
      </Animated.View>
    </View>
  );
};

const MapNode: React.FC<{
  node: NodePos;
  save: AdventureSave;
  isFrontier: boolean;
  onPress: () => void;
  fighterName: CharacterName;
  /** A secret path the map shows for the first time: when its node pops in */
  arriveAtMs?: number;
  /** Reduced motion: arrive without animation */
  still?: boolean;
}> = ({ node, save, isFrontier, onPress, fighterName, arriveAtMs, still }) => {
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

  const content = (
    <>
      <Bob active={isFrontier}>
        <TouchableOpacity
          testID={`map-node-${level.id}`}
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityLabel={`${practice ? 'Practice' : `Level ${level.id}`} ${level.name}${locked ? ' locked' : ''}`}
          style={[
            s.node,
            { width: size, height: size, borderRadius: size / 2 },
            locked ? s.nodeLocked : practice ? s.nodePractice : elite ? s.nodeElite : stars === 3 ? s.nodePerfect : stars > 0 ? s.nodeDone : s.nodeOpen,
            isFrontier && s.nodeFrontier,
          ]}
        >
          {locked ? (
            <Icon name="lorc/padlock" size={size * 0.55} color="#A69F95" />
          ) : (
            <EnemyAvatar
              enemy={foe}
              size={Math.round(size * 0.76)}
              mood={isFrontier ? 'menacing' : 'idle'}
              lightweight
            />
          )}
          {elite && (
            <View style={s.skull}><Icon name="lorc/daemon-skull" size={14} color={locked ? '#A69F95' : ELITE} /></View>
          )}
          {level.isBoss && !locked && (
            <View style={s.crown}><Icon name="lorc/crown-coin" size={18} color="#E0A800" /></View>
          )}
        </TouchableOpacity>
      </Bob>
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
      {isFrontier && (
        <View style={s.avatar} pointerEvents="none">
          <Bob amount={3}>
            <View style={s.avatarBubble}>
              <FighterAvatar character={fighterName} size={30} mood="anticipation" />
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
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8F6E3' },
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
  starCount: { fontWeight: '800', color: INK, fontSize: 14 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  // The title gives way first on a narrow screen, so the stars and coins are never cut off
  title: { flex: 1, fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 16 },
  band: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  ground: { position: 'absolute', left: -40, right: -40, bottom: -60, height: 120, borderRadius: 200, opacity: 0.6 },
  decor: { position: 'absolute', opacity: 0.55 },
  bannerWrap: { alignItems: 'center', paddingTop: 22 },
  banner: { backgroundColor: COLORS.canvasWhite, borderWidth: 2, borderBottomWidth: 4, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8, alignItems: 'center', gap: 2 },
  bannerTitle: { fontWeight: '900', letterSpacing: 2, fontSize: 16 },
  bannerSub: { fontSize: 12, fontWeight: '600', opacity: 0.8 },
  gate: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: INK, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 4 },
  gateText: { color: COLORS.canvasWhite, fontWeight: '800', fontSize: 11 },
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
  dock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 10, backgroundColor: COLORS.canvasWhite, borderTopWidth: 2, borderTopColor: INK, gap: 6 },
  dockBtn: { alignItems: 'center', width: 58 },
  dockLabel: { fontSize: 10, fontWeight: '800', color: INK, marginTop: 2 },
  badgeDot: { position: 'absolute', top: -2, right: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.impactRed, borderWidth: 2, borderColor: COLORS.canvasWhite },
  playNext: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.actionYellow, borderWidth: 2, borderBottomWidth: 5, borderColor: INK, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, maxWidth: 260 },
  playNextLabel: { fontWeight: '900', fontSize: 16, color: INK, letterSpacing: 1 },
  playNextSub: { fontSize: 12, fontWeight: '600', color: INK },
});

export default AdventureMap;
