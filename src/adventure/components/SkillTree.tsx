/**
 * One fighter's skill tree, drawn as a map (Clair Obscur style): round nodes
 * on a 7-column grid, linked by lines, grown from the fighter's two passive
 * roots. A node can be bought once anything it links to is owned. Every
 * fighter spends from all the stars earned (stars are not shared out between
 * fighters); refunds are free (a single node when nothing hangs off it, or the
 * whole fighter). Camp's ScrollView scrolls the map.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, type LayoutChangeEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave, PassiveDef, SkillNode, TreePos } from '../types';
import { getFighter } from '../data/fighters';
import { getPassive } from '../data/passives';
import { getSkillNode, skillTreeOf, skillTreeRoots } from '../data/skillTrees';
import {
  availableStars,
  maxStars,
  buyNode,
  fighterStarsSpent,
  nodeStatus,
  refundBlockers,
  refundFighter,
  refundNode,
  totalStarsEarned,
  type NodeStatus,
} from '../progress';
import { Btn, INK, TONE } from './ui';

const STAR = '#E0A800';
const COLS = 7;
/** Map width before the first layout pass (and in tests, where layout never runs) */
const DEFAULT_WIDTH = 340;
const LINE = '#8A7B6B';
const LINE_OWNED = COLORS.actionYellow;

interface Props {
  save: AdventureSave;
  fighter: CharacterName;
  onChange: (save: AdventureSave) => void;
  onBack: () => void;
}

const STATUS_LABEL: Record<NodeStatus, string> = {
  owned: 'owned',
  buyable: 'can buy',
  needsStars: 'not enough stars',
  needsLink: 'locked',
  sealed: 'sealed',
  fighterLocked: 'locked',
};

/**
 * With a fighter: the stars that fighter can still spend, out of stars earned.
 * Without one (Camp header): stars earned, out of the campaign's total.
 */
export const StarPool: React.FC<{ save: AdventureSave; fighter?: CharacterName; testID?: string }> = ({ save, fighter, testID }) => {
  const value = fighter ? availableStars(save, fighter) : totalStarsEarned(save);
  const of = fighter ? totalStarsEarned(save) : maxStars();
  const label = fighter ? `${value} of ${of} stars left for ${fighter}` : `${value} of ${of} stars earned`;
  return (
    <View testID={testID} style={st.pool} accessibilityLabel={label}>
      <Text style={st.poolGlyph}>★</Text>
      <Text style={st.poolText}>{value}</Text>
      <Text style={st.poolSub}>/ {of}</Text>
    </View>
  );
};

/** Pixel geometry of the map for a given width. */
const geometry = (width: number, rows: number) => {
  const cell = width / COLS;
  const node = Math.min(46, Math.round(cell * 0.72));
  const root = Math.round(node * 1.3);
  const rowH = Math.max(cell, node + 24);
  const center = (p: TreePos) => ({ x: (p.col + 0.5) * cell, y: p.row * rowH + root / 2 + 6 });
  return { cell, node, root, rowH, center, height: (rows - 1) * rowH + root + 24 };
};

const SkillTree: React.FC<Props> = ({ save, fighter, onChange, onBack }) => {
  const def = getFighter(fighter);
  const nodes = skillTreeOf(fighter);
  const roots = skillTreeRoots(fighter);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = nodes.find(n => n.id === selectedId) ?? null;
  const spentHere = fighterStarsSpent(save, fighter);
  const status = new Map(nodes.map(n => [n.id, nodeStatus(save, n.id)]));

  const rows = Math.max(...nodes.map(n => n.pos.row), ...roots.map(r => r.pos.row)) + 1;
  const g = geometry(width, rows);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  // Every link once: node–node pairs (a < b) and node–root links
  const rootPos = new Map(roots.map(r => [r.passive, r.pos]));
  const lines: { key: string; a: TreePos; b: TreePos; lit: boolean; frontier: boolean }[] = [];
  for (const n of nodes) {
    const owned = status.get(n.id) === 'owned';
    for (const other of n.links) {
      if (other < n.id) continue;
      const otherOwned = status.get(other) === 'owned';
      lines.push({ key: `${n.id}~${other}`, a: n.pos, b: getSkillNode(other)!.pos, lit: owned && otherOwned, frontier: owned !== otherOwned });
    }
    for (const p of n.roots) lines.push({ key: `${p}~${n.id}`, a: rootPos.get(p)!, b: n.pos, lit: owned, frontier: !owned });
  }

  return (
    <View style={st.root} testID={`skill-tree-${fighter}`}>
      <View style={st.head}>
        <TouchableOpacity testID="skill-tree-back" onPress={() => { sfx('back'); onBack(); }} style={st.back} accessibilityLabel="Back to fighters">
          <Icon name="lorc/return-arrow" size={18} color={INK} />
        </TouchableOpacity>
        <FighterAvatar character={fighter} size={42} mood="anticipation" framed />
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{fighter}</Text>
          <Text style={st.sub}>Skill tree · {spentHere}★ spent here</Text>
        </View>
        <StarPool save={save} fighter={fighter} testID="skill-tree-stars" />
      </View>

      <View style={st.passives}>
        {def.passives.map(id => <PassiveCard key={id} passive={getPassive(id)} />)}
      </View>
      <Text style={st.blurb}>
        Grow out from either passive (the big yellow nodes): any node linked to one you own can be bought. Tap a node to read it. Refunds are free.
      </Text>

      <View style={[st.map, { height: g.height }]} onLayout={onLayout} testID="skill-map">
        <Svg width={width} height={g.height} style={StyleSheet.absoluteFill}>
          {lines.map(l => {
            const a = g.center(l.a), b = g.center(l.b);
            return (
              <Line
                key={l.key}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={l.lit ? LINE_OWNED : l.frontier ? '#E9DFD2' : LINE}
                strokeWidth={l.lit ? 5 : l.frontier ? 2.5 : 2}
                strokeDasharray={l.frontier ? '5,4' : undefined}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>

        {roots.map(({ passive, pos }) => {
          const p = getPassive(passive);
          const c = g.center(pos);
          return (
            <View
              key={passive}
              testID={`skill-root-${passive}`}
              accessibilityLabel={`${p.name}, passive, free`}
              style={[st.rootNode, { width: g.root, height: g.root, borderRadius: g.root / 2, left: c.x - g.root / 2, top: c.y - g.root / 2 }]}
            >
              <Icon name={p.icon} size={Math.round(g.root * 0.5)} color={INK} />
            </View>
          );
        })}

        {nodes.map(n => (
          <MapNode
            key={n.id}
            node={n}
            status={status.get(n.id)!}
            selected={n.id === selectedId}
            size={g.node}
            center={g.center(n.pos)}
            onPress={() => { sfx('click'); setSelectedId(n.id === selectedId ? null : n.id); }}
          />
        ))}
      </View>

      <View style={st.legend}>
        <Legend color={COLORS.logicTeal} label="Owned" />
        <Legend color={COLORS.actionYellow} label="Can buy" />
        <Legend color="#7A6B5D" label="Locked" />
        <Legend color={INK} label="◆ Capstone" diamond />
      </View>

      {spentHere > 0 && (
        <Btn
          testID="skill-refund-fighter"
          small
          variant="secondary"
          icon="lorc/recycle"
          label={`Refund all ${spentHere}★`}
          onPress={() => { sfx('coin'); setSelectedId(null); onChange(refundFighter(save, fighter)); }}
          style={{ alignSelf: 'center' }}
        />
      )}

      {selected && (
        <NodeDetail
          save={save}
          node={selected}
          status={status.get(selected.id)!}
          onBuy={() => { sfx('levelup'); onChange(buyNode(save, selected.id)); setSelectedId(null); }}
          onRefund={() => { sfx('coin'); onChange(refundNode(save, selected.id)); setSelectedId(null); }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </View>
  );
};

const PassiveCard: React.FC<{ passive: PassiveDef }> = ({ passive }) => (
  <View style={st.passive} testID={`skill-passive-${passive.id}`}>
    <View style={st.passiveHead}>
      <View style={st.passiveIcon}><Icon name={passive.icon} size={16} color={INK} /></View>
      <Text style={st.passiveName} numberOfLines={1}>{passive.name}</Text>
    </View>
    <Text style={st.passiveText} numberOfLines={4}>{passive.text}</Text>
    <Text style={st.passiveTag}>PASSIVE · FREE</Text>
  </View>
);

const Legend: React.FC<{ color: string; label: string; diamond?: boolean }> = ({ color, label, diamond }) => (
  <View style={st.legendItem}>
    {!diamond && <View style={[st.legendDot, { borderColor: color }]} />}
    <Text style={st.legendText}>{label}</Text>
  </View>
);

const MapNode: React.FC<{
  node: SkillNode;
  status: NodeStatus;
  selected: boolean;
  size: number;
  center: { x: number; y: number };
  onPress: () => void;
}> = ({ node, status, selected, size, center, onPress }) => {
  const owned = status === 'owned';
  const reachable = status === 'buyable' || status === 'needsStars';
  const locked = !owned && !reachable;
  /** Capstones (5★+) are diamonds */
  const capstone = node.cost >= 5;
  const box = capstone ? Math.round(size * 0.82) : size;
  return (
    <TouchableOpacity
      testID={`skill-node-${node.id}`}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={`${node.name}, ${node.cost} stars, ${STATUS_LABEL[status]}`}
      style={[st.nodeWrap, { left: center.x - size / 2 - 8, top: center.y - size / 2, width: size + 16 }]}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={[
            st.node,
            { width: box, height: box, borderRadius: capstone ? 6 : size / 2 },
            capstone && { transform: [{ rotate: '45deg' }] },
            owned && st.nodeOwned,
            status === 'buyable' && st.nodeBuyable,
            status === 'needsStars' && st.nodeNeedsStars,
            locked && st.nodeLocked,
            selected && st.nodeSelected,
          ]}
        >
          <View style={capstone ? { transform: [{ rotate: '-45deg' }] } : undefined}>
            <Icon
              name={locked ? 'lorc/padlock' : node.icon}
              size={Math.round(size * (locked ? 0.38 : 0.5))}
              color={owned ? COLORS.canvasWhite : locked ? '#A89A8B' : INK}
            />
          </View>
        </View>
      </View>
      <Text style={[st.cost, owned && { color: '#7FE3D3' }, status === 'buyable' && { color: COLORS.actionYellow }]} numberOfLines={1}>
        {owned ? '✓' : status === 'sealed' ? `${node.requires?.starsEarned}★ earned` : `★${node.cost}`}
      </Text>
    </TouchableOpacity>
  );
};

const NodeDetail: React.FC<{
  save: AdventureSave;
  node: SkillNode;
  status: NodeStatus;
  onBuy: () => void;
  onRefund: () => void;
  onClose: () => void;
}> = ({ save, node, status, onBuy, onRefund, onClose }) => {
  const neighbours = [...node.roots.map(p => getPassive(p).name), ...node.links.map(id => getSkillNode(id)!.name)];
  const blockers = status === 'owned' ? refundBlockers(save, node.id) : [];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.sheetWrap}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close details" />
        <View style={st.detail} testID="skill-detail">
          <View style={st.detailHead}>
            <View style={st.passiveIcon}><Icon name={node.icon} size={18} color={INK} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.detailName}>{node.name}</Text>
              <Text style={st.detailMeta}>★{node.cost}{node.requires ? ` · sealed until ${node.requires.starsEarned}★ earned` : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.back} accessibilityLabel="Close details">
              <Text style={{ fontWeight: '900', color: INK }}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={st.detailText}>{node.text}</Text>
          <Text style={st.detailLinks}>Links to: {neighbours.join(', ')}</Text>
          {status === 'owned' ? (
            <Text style={st.detailNote}>
              {blockers.length > 0
                ? `Owned. Refund ${blockers.map(b => b.name).join(', ')} first: ${blockers.length === 1 ? 'it hangs' : 'they hang'} off this node.`
                : 'Owned. It is on in every fight with this fighter.'}
            </Text>
          ) : status === 'needsLink' ? (
            <Text style={st.detailNote}>Buy a node it links to first.</Text>
          ) : status === 'sealed' ? (
            <Text style={st.detailNote}>Sealed until you have earned {node.requires?.starsEarned}★ in all (you have {totalStarsEarned(save)}★).</Text>
          ) : status === 'needsStars' ? (
            <Text style={st.detailNote}>Needs {node.cost}★, {node.fighter} has {availableStars(save, node.fighter)}★ left. Earn more stars on the map or refund some of {node.fighter}'s nodes.</Text>
          ) : status === 'fighterLocked' ? (
            <Text style={st.detailNote}>Unlock this fighter first.</Text>
          ) : null}
          {status === 'owned' ? (
            <Btn testID="skill-refund-node" variant="secondary" icon="lorc/recycle" label={`Refund +${node.cost}★`} disabled={blockers.length > 0} onPress={onRefund} />
          ) : (
            <Btn testID="skill-buy" label={`Buy for ${node.cost}★`} disabled={status !== 'buyable'} onPress={onBuy} />
          )}
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  root: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 10 },
  back: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', fontSize: 16, color: INK },
  sub: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.7 },
  blurb: { color: TONE.onDusk, fontSize: 12, textAlign: 'center' },
  pool: { flexDirection: 'row', alignItems: 'baseline', gap: 2, backgroundColor: COLORS.deepOnyx, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  poolGlyph: { color: STAR, fontSize: 15, fontWeight: '900' },
  poolText: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 15, fontVariant: ['tabular-nums'] },
  poolSub: { color: '#B9B1A5', fontWeight: '700', fontSize: 11 },
  passives: { flexDirection: 'row', gap: 8 },
  passive: { flex: 1, backgroundColor: COLORS.actionYellow, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 8, gap: 3 },
  passiveHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passiveIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  passiveName: { flex: 1, fontWeight: '900', fontSize: 13, color: INK },
  passiveText: { fontSize: 10, color: INK },
  passiveTag: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, color: INK, opacity: 0.7 },
  map: { width: '100%', backgroundColor: '#3A2F27', borderRadius: 14, borderWidth: 2.5, borderColor: INK, overflow: 'hidden' },
  rootNode: { position: 'absolute', backgroundColor: COLORS.actionYellow, borderWidth: 2.5, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  nodeWrap: { position: 'absolute', alignItems: 'center' },
  node: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige, borderWidth: 2, borderColor: TONE.lockedEdge },
  nodeOwned: { backgroundColor: COLORS.logicTeal, borderColor: COLORS.canvasWhite },
  nodeBuyable: { backgroundColor: COLORS.canvasWhite, borderColor: COLORS.actionYellow, borderWidth: 3.5 },
  nodeNeedsStars: { backgroundColor: COLORS.canvasWhite, borderColor: '#A89A8B' },
  nodeLocked: { backgroundColor: '#5B4E43', borderColor: '#7A6B5D' },
  nodeSelected: { borderColor: COLORS.canvasWhite, borderWidth: 4 },
  cost: { marginTop: 1, fontSize: 9, fontWeight: '900', color: '#D9CFC2', fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, backgroundColor: COLORS.canvasWhite },
  legendText: { fontSize: 10, fontWeight: '700', color: TONE.onDusk },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(18,18,18,0.45)', padding: 12 },
  detail: { width: '100%', maxWidth: 520, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailName: { fontWeight: '900', fontSize: 16, color: INK },
  detailMeta: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.7 },
  detailText: { fontSize: 14, color: INK, lineHeight: 20 },
  detailLinks: { fontSize: 11, color: INK, opacity: 0.75 },
  detailNote: { fontSize: 12, color: TONE.tradeoff, fontWeight: '700' },
});

export default SkillTree;
