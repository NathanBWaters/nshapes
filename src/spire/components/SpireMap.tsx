/**
 * Starfall Spire — Branching Act Map.
 *
 * Renders the 7-row Slay-the-Spire DAG from Bottom (Row 0 Entrance) upward to
 * the Top (Row 6 Act Boss) with crisp SVG connecting lines, color-coded node
 * badges, bobbing reachable choices, and Act Boss preview.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Svg, Line } from 'react-native-svg';
import Icon, { type IconName } from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { COLORS } from '@/utils/colors';
import { getBiome } from '@/adventure/data/biomes';
import { foeDisplay } from '@/adventure/data/foes';
import { Bob, Eyebrow, INK, TONE } from '@/adventure/components/ui';
import { sfx } from '@/audio';
import { reachableNodeIds } from '../engine/mapGen';
import type { SpireNode, SpireNodeKind, SpireRun } from '../types';

interface Props {
  run: SpireRun;
  onSelectNode: (nodeId: string) => void;
}

const NODE_STYLE: Record<SpireNodeKind, { label: string; icon: IconName; bg: string; fg: string; border: string }> = {
  skirmish: { label: 'Battle', icon: 'lorc/crossed-swords', bg: COLORS.canvasWhite, fg: INK, border: INK },
  elite: { label: 'Elite', icon: 'lorc/daemon-skull', bg: '#FEE2E2', fg: '#991B1B', border: '#991B1B' },
  shop: { label: 'Shop', icon: 'lorc/crown-coin', bg: '#FEF9C3', fg: '#854D0E', border: '#A16207' },
  campfire: { label: 'Campfire', icon: 'lorc/campfire', bg: '#FFEDD5', fg: '#9A3412', border: '#C2410C' },
  event: { label: 'Mystery', icon: 'lorc/uncertainty', bg: '#F3E8FF', fg: '#6B21A8', border: '#7C3AED' },
  treasure: { label: 'Vault', icon: 'skoll/open-treasure-chest', bg: '#CCFBF1', fg: '#115E59', border: '#0F766E' },
  boss: { label: 'ACT BOSS', icon: 'lorc/crown', bg: COLORS.actionYellow, fg: INK, border: INK },
};

const ROW_H = 82;
const TOP_PAD = 36;
const BOSS_ROW_EXTRA = 22;

const SpireMap: React.FC<Props> = ({ run, onSelectNode }) => {
  const scrollRef = useRef<ScrollView>(null);
  const [canvasW, setCanvasW] = useState(340);
  const [viewH, setViewH] = useState(0);
  const { map } = run;
  const biome = getBiome(map.biome);
  const reachable = useMemo(() => new Set(reachableNodeIds(map, run.currentNodeId)), [map, run.currentNodeId]);

  // Row 6 (Boss) sits at the top (y = TOP_PAD); Row 0 (Entrance) at the bottom
  const totalH = TOP_PAD + BOSS_ROW_EXTRA + map.rows * ROW_H + 24;
  const centerX = (col: number, isBoss: boolean) => {
    if (isBoss) return canvasW / 2;
    const margin = Math.max(46, canvasW * 0.16);
    const span = Math.max(100, canvasW - margin * 2);
    return margin + (span * col) / Math.max(1, map.cols - 1);
  };
  const centerY = (row: number) => {
    const inv = map.rows - 1 - row;
    return TOP_PAD + (inv === 0 ? 18 : BOSS_ROW_EXTRA + inv * ROW_H);
  };

  // Auto-scroll to the player's next reachable row (Row 0 bottom on Act start, climbing upward!)
  const targetRow = useMemo(() => {
    const nextNode = map.nodes.find(n => reachable.has(n.id));
    return nextNode ? nextNode.row : 0;
  }, [map.nodes, reachable]);

  useEffect(() => {
    if (viewH <= 0) return;
    const y = Math.max(0, centerY(targetRow) - viewH * 0.55);
    scrollRef.current?.scrollTo({ y, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewH, map.act, targetRow]);

  const nodeById = useMemo(() => new Map(map.nodes.map(n => [n.id, n])), [map.nodes]);
  const bossNode = map.nodes.find(n => n.kind === 'boss');
  const bossFoe = bossNode?.encounter ? foeDisplay(bossNode.encounter.foes[0]) : null;

  return (
    <View style={[st.root, { backgroundColor: biome.colors.sky }]} testID="spire-map">
      <View style={st.actBanner}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow text={run.endless ? `ENDLESS ACT ${map.act}` : `ACT ${map.act} OF 3`} color={run.endless ? '#E9D5FF' : COLORS.actionYellow} />
          <Text style={st.actTitle} numberOfLines={1}>{map.title}</Text>
          <Text style={st.actSub} numberOfLines={2}>{map.subtitle}</Text>
        </View>
        {bossFoe && (
          <View style={st.bossPreview}>
            <EnemyAvatar enemy={bossFoe} size={40} mood="enraged" lightweight animate={false} />
            <Text style={st.bossPreviewText} numberOfLines={1}>{bossFoe.name}</Text>
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        onLayout={e => setViewH(Math.floor(e.nativeEvent.layout.height))}
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={st.prompt}>
          {run.currentNodeId ? 'Choose your next room upward ↑' : 'Pick any entrance battle to begin ↑'}
        </Text>

        <View
          style={[st.canvas, { height: totalH }]}
          onLayout={e => {
            const w = Math.floor(e.nativeEvent.layout.width);
            if (w > 100) setCanvasW(w);
          }}
        >
          {/* SVG Path Edges */}
          <Svg width={canvasW} height={totalH} style={StyleSheet.absoluteFill} pointerEvents="none">
            {map.nodes.flatMap(from =>
              from.next.map(toId => {
                const to = nodeById.get(toId);
                if (!to) return null;
                const x1 = centerX(from.col, from.kind === 'boss');
                const y1 = centerY(from.row);
                const x2 = centerX(to.col, to.kind === 'boss');
                const y2 = centerY(to.row);
                const isNextEdge = from.id === run.currentNodeId && reachable.has(to.id);
                const isVisitedEdge = from.visited && to.visited;
                return (
                  <Line
                    key={`${from.id}-${to.id}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isNextEdge ? COLORS.actionYellow : isVisitedEdge ? TONE.upside : 'rgba(56,56,56,0.32)'}
                    strokeWidth={isNextEdge ? 4.5 : isVisitedEdge ? 4 : 2.5}
                    strokeDasharray={isNextEdge || isVisitedEdge ? undefined : '6,5'}
                  />
                );
              })
            )}
          </Svg>

          {/* Interactive Nodes */}
          {map.nodes.map(node => (
            <MapNodeButton
              key={node.id}
              node={node}
              x={centerX(node.col, node.kind === 'boss')}
              y={centerY(node.row)}
              isCurrent={node.id === run.currentNodeId}
              isReachable={reachable.has(node.id)}
              onPress={() => {
                sfx('confirm');
                onSelectNode(node.id);
              }}
            />
          ))}
        </View>

        {/* Legend */}
        <View style={st.legend}>
          {(['skirmish', 'elite', 'shop', 'campfire', 'event', 'treasure'] as SpireNodeKind[]).map(k => (
            <View key={k} style={st.legendItem}>
              <Icon name={NODE_STYLE[k].icon} size={13} color={NODE_STYLE[k].fg} />
              <Text style={st.legendText}>{NODE_STYLE[k].label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const MapNodeButton: React.FC<{
  node: SpireNode;
  x: number;
  y: number;
  isCurrent: boolean;
  isReachable: boolean;
  onPress: () => void;
}> = ({ node, x, y, isCurrent, isReachable, onPress }) => {
  const cfg = NODE_STYLE[node.kind];
  const isBoss = node.kind === 'boss';
  const w = isBoss ? 132 : 84;
  const h = isBoss ? 56 : 54;
  const foeName = node.encounter?.name;

  const inner = (
    <TouchableOpacity
      testID={`spire-node-${node.id}`}
      disabled={!isReachable}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${cfg.label}${foeName ? `: ${foeName}` : ''}${isReachable ? ', available' : ''}`}
      style={[
        st.node,
        {
          width: w,
          height: h,
          backgroundColor: node.visited ? '#E5E0D8' : cfg.bg,
          borderColor: isReachable ? INK : isCurrent ? TONE.upside : cfg.border,
          borderWidth: isReachable ? 3 : 2,
          borderBottomWidth: isReachable ? 5 : 3,
          opacity: isReachable || isCurrent ? 1 : node.visited ? 0.65 : 0.72,
        },
      ]}
    >
      <View style={st.nodeTop}>
        <Icon name={cfg.icon} size={isBoss ? 20 : 18} color={node.visited ? TONE.spent : cfg.fg} />
        {node.visited && <Text style={st.doneCheck}>✓</Text>}
      </View>
      <Text style={[st.nodeLabel, { color: node.visited ? TONE.spent : cfg.fg }]} numberOfLines={1}>
        {isBoss ? (foeName ?? cfg.label) : cfg.label}
      </Text>
      {isReachable && (
        <View style={st.goBadge}>
          <Text style={st.goText}>GO</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={{ position: 'absolute', left: x - w / 2, top: y - h / 2 }}>
      {isReachable ? <Bob active amount={4}>{inner}</Bob> : inner}
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1 },
  actBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK, paddingHorizontal: 12, paddingVertical: 8 },
  actTitle: { fontSize: 16, fontWeight: '900', color: INK, marginTop: 2 },
  actSub: { fontSize: 11, color: TONE.spent, lineHeight: 15 },
  bossPreview: { alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 96 },
  bossPreviewText: { fontSize: 9, fontWeight: '900', color: INK, marginTop: 2 },
  scrollContent: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 28, alignItems: 'center', width: '100%' },
  prompt: { fontSize: 12, fontWeight: '900', color: INK, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: INK, overflow: 'hidden' },
  canvas: { width: '100%', maxWidth: 480, position: 'relative', marginTop: 6 },
  node: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, gap: 2 },
  nodeTop: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nodeLabel: { fontSize: 10, fontWeight: '900', textAlign: 'center', width: '100%' },
  doneCheck: { fontSize: 11, fontWeight: '900', color: TONE.upside },
  goBadge: { position: 'absolute', top: -8, right: -6, backgroundColor: COLORS.actionYellow, borderWidth: 1.5, borderColor: INK, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  goText: { fontSize: 8, fontWeight: '900', color: INK },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 10, borderWidth: 1.5, borderColor: INK, padding: 8, maxWidth: 460 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 10, fontWeight: '800', color: INK },
});

export default SpireMap;
