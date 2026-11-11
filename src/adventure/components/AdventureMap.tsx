/**
 * The adventure map — a winding path of foe nodes through four biomes
 * (Angry Birds / Bloons style). Tap a node to open the level preview.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { AdventureSave, LevelDef } from '../types';
import { MAIN_LEVELS, branchesOf } from '../data/levels';
import { BIOMES } from '../data/biomes';
import { levelFoe } from '../data/foes';
import { getMechanic } from '../data/mechanics';
import { getFighter } from '../data/fighters';
import { getFrontierLevel, getLockReason, maxStars, totalStars, isBiomeOpen } from '../progress';
import { Bob, CoinPill, INK, StarRow } from './ui';

const ELITE = '#5B2333';
const ROW = 112;
const BANNER = 132;
const TOP_PAD = 24;

interface NodePos { level: LevelDef; x: number; y: number; parent?: { x: number; y: number } }
interface BannerPos { biomeIndex: number; y: number; height: number }

const layout = (width: number) => {
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
    nodes.push({ level, x, y: y + ROW / 2 });
    // Elite side paths branch off sideways, toward whichever side has room
    branchesOf(level.id).forEach(b => {
      const side = x < width / 2 ? 1 : -1;
      const bx = Math.max(58, Math.min(width - 58, x + side * Math.min(150, width * 0.4)));
      branches.push({ level: b, x: bx, y: y + ROW / 2 + 6, parent: { x, y: y + ROW / 2 } });
    });
    y += ROW;
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
  musicOn: boolean;
  onToggleMusic: () => void;
}

const AdventureMap: React.FC<Props> = ({ save, onSelectLevel, onOpenCamp, onOpenGuide, onExit, highlightLevelId, musicOn, onToggleMusic }) => {
  const { width: winW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width = Math.min(winW, 560);
  const { nodes, branches, banners, height } = useMemo(() => layout(width), [width]);
  const frontier = getFrontierLevel(save);
  const scrollRef = useRef<ScrollView>(null);
  const stars = totalStars(save);
  const fighter = getFighter(save.selectedFighter);
  const campUnlocked = (save.stars['1-6'] ?? 0) > 0 || save.coins > 0 || save.lifetimeCoins > 0;

  // Scroll so the frontier node is in view
  useEffect(() => {
    const target = nodes.find(n => n.level.id === (highlightLevelId ?? frontier.id));
    if (!target) return;
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, target.y - 260), animated: true }), 120);
    return () => clearTimeout(t);
  }, [nodes, frontier.id, highlightLevelId]);

  const unlockedNodes = nodes.filter(n => getLockReason(save, n.level) === null);
  const lastUnlocked = unlockedNodes[unlockedNodes.length - 1];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={onExit} style={s.iconBtn} accessibilityLabel="Back to menu">
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Text style={s.title}>ADVENTURE</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onToggleMusic} style={[s.iconBtn, !musicOn && { opacity: 0.4 }]} accessibilityLabel={musicOn ? 'Mute music' : 'Play music'}>
          <Icon name="delapouite/sound-on" size={18} color={INK} />
        </TouchableOpacity>
        <View style={s.starPill}><Text style={s.starGlyph}>★</Text><Text style={s.starCount}>{stars}/{maxStars()}</Text></View>
        <CoinPill coins={save.coins} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={{ width, height }}>
          {/* Biome bands */}
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

          {/* Path */}
          <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d={pathFor(nodes)} stroke="#FFFFFF" strokeWidth={14} fill="none" strokeLinecap="round" opacity={0.9} />
            {lastUnlocked && (
              <Path d={pathFor(unlockedNodes)} stroke={COLORS.actionYellow} strokeWidth={6} fill="none" strokeLinecap="round" />
            )}
            <Path d={pathFor(nodes)} stroke={INK} strokeWidth={2} fill="none" strokeDasharray="2 10" strokeLinecap="round" opacity={0.35} />
            {nodes.map(n => <Circle key={n.level.id} cx={n.x} cy={n.y} r={6} fill={INK} opacity={0.15} />)}
            {branches.map(b => (
              <Path
                key={b.level.id}
                d={`M ${b.parent!.x} ${b.parent!.y} L ${b.x} ${b.y}`}
                stroke={getLockReason(save, b.level) ? '#B8B0A4' : ELITE}
                strokeWidth={5}
                strokeDasharray="3 9"
                strokeLinecap="round"
                fill="none"
              />
            ))}
          </Svg>

          {/* Elite branch nodes */}
          {branches.map(n => (
            <MapNode key={n.level.id} node={n} save={save} isFrontier={false} onPress={() => onSelectLevel(n.level)} fighterIcon={fighter.icon} />
          ))}

          {/* Nodes */}
          {nodes.map(n => (
            <MapNode
              key={n.level.id}
              node={n}
              save={save}
              isFrontier={n.level.id === frontier.id}
              onPress={() => onSelectLevel(n.level)}
              fighterIcon={fighter.icon}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom dock */}
      <View style={[s.dock, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 8) }]}>
        <DockButton icon="lorc/open-book" label="Field Guide" onPress={onOpenGuide} />
        <TouchableOpacity testID="map-play-next" onPress={() => onSelectLevel(frontier)} style={s.playNext} activeOpacity={0.85}>
          <Icon name={fighter.icon} size={26} color={INK} />
          <View>
            <Text style={s.playNextLabel}>PLAY {frontier.id}</Text>
            <Text style={s.playNextSub} numberOfLines={1}>{frontier.name}</Text>
          </View>
        </TouchableOpacity>
        <DockButton icon="lorc/campfire" label="Camp" onPress={onOpenCamp} disabled={!campUnlocked} badge={campUnlocked && save.coins >= 60} />
      </View>
    </View>
  );
};

const DockButton: React.FC<{ icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void; disabled?: boolean; badge?: boolean }> = ({ icon, label, onPress, disabled, badge }) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} style={[s.dockBtn, disabled && { opacity: 0.35 }]} accessibilityLabel={label}>
    <Icon name={disabled ? 'lorc/padlock' : icon} size={26} color={INK} />
    <Text style={s.dockLabel}>{label}</Text>
    {badge && <View style={s.badgeDot} />}
  </TouchableOpacity>
);

const MapNode: React.FC<{ node: NodePos; save: AdventureSave; isFrontier: boolean; onPress: () => void; fighterIcon: React.ComponentProps<typeof Icon>['name'] }> = ({ node, save, isFrontier, onPress, fighterIcon }) => {
  const { level, x, y } = node;
  const lock = getLockReason(save, level);
  const locked = lock !== null;
  const stars = save.stars[level.id] ?? 0;
  const foe = levelFoe(level);
  const elite = !!level.branchOf;
  const size = level.isBoss ? 78 : elite ? 54 : 62;
  const isNew = !locked && !save.seenMechanics.includes(level.introduces);
  const mech = getMechanic(level.introduces);

  return (
    <View style={[s.nodeWrap, { left: x - 60, top: y - size / 2 - 6 }]} pointerEvents="box-none">
      <Bob active={isFrontier}>
        <TouchableOpacity
          testID={`map-node-${level.id}`}
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityLabel={`Level ${level.id} ${level.name}${locked ? ' locked' : ''}`}
          style={[
            s.node,
            { width: size, height: size, borderRadius: size / 2 },
            locked ? s.nodeLocked : elite ? s.nodeElite : stars === 3 ? s.nodePerfect : stars > 0 ? s.nodeDone : s.nodeOpen,
            isFrontier && s.nodeFrontier,
          ]}
        >
          <Icon name={locked ? 'lorc/padlock' : foe.icon} size={size * 0.55} color={locked ? '#A69F95' : elite ? COLORS.canvasWhite : INK} />
          {elite && (
            <View style={s.skull}><Icon name="lorc/daemon-skull" size={14} color={locked ? '#A69F95' : ELITE} /></View>
          )}
          {level.isBoss && !locked && (
            <View style={s.crown}><Icon name="lorc/crown-coin" size={18} color="#E0A800" /></View>
          )}
        </TouchableOpacity>
      </Bob>
      <View style={s.nodeMeta} pointerEvents="none">
        {!locked && <StarRow stars={stars} size={15} />}
        <Text style={[s.nodeLabel, locked && { color: '#A69F95' }]}>{elite ? (locked ? 'ELITE ★★' : 'ELITE') : level.id}</Text>
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
              <Icon name={fighterIcon} size={22} color={INK} />
            </View>
          </Bob>
        </View>
      )}
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
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 16 },
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
  nodeDone: { backgroundColor: '#FFF6C2' },
  nodePerfect: { backgroundColor: COLORS.actionYellow },
  nodeElite: { backgroundColor: ELITE, borderColor: COLORS.deepOnyx },
  skull: { position: 'absolute', top: -10, right: -6, backgroundColor: COLORS.canvasWhite, borderRadius: 11, borderWidth: 2, borderColor: INK, padding: 1 },
  nodeFrontier: { borderColor: COLORS.deepOnyx, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  crown: { position: 'absolute', top: -14, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2, borderColor: INK, padding: 1 },
  nodeMeta: { alignItems: 'center', marginTop: 2, gap: 1 },
  nodeLabel: { fontWeight: '900', color: INK, fontSize: 12, letterSpacing: 1 },
  newTag: { position: 'absolute', top: -4, right: 6, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.actionYellow, borderWidth: 1.5, borderColor: INK, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  newTagText: { fontSize: 9, fontWeight: '900', color: INK, letterSpacing: 1 },
  avatar: { position: 'absolute', left: -6, top: 4 },
  avatarBubble: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.canvasWhite, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  dock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, backgroundColor: COLORS.canvasWhite, borderTopWidth: 2, borderTopColor: INK, gap: 10 },
  dockBtn: { alignItems: 'center', width: 72 },
  dockLabel: { fontSize: 11, fontWeight: '800', color: INK, marginTop: 2 },
  badgeDot: { position: 'absolute', top: -2, right: 14, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.impactRed, borderWidth: 2, borderColor: COLORS.canvasWhite },
  playNext: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.actionYellow, borderWidth: 2, borderBottomWidth: 5, borderColor: INK, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, maxWidth: 260 },
  playNextLabel: { fontWeight: '900', fontSize: 16, color: INK, letterSpacing: 1 },
  playNextSub: { fontSize: 12, fontWeight: '600', color: INK },
});

export default AdventureMap;
