/**
 * One fighter's skill tree: two branches of 10 nodes, each growing from one of
 * the fighter's passives. Stars come from one shared pool; refunds are free and
 * take back a whole branch at a time.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave, PassiveDef, SkillNode } from '../types';
import { getFighter } from '../data/fighters';
import { getPassive } from '../data/passives';
import { skillTreeOf } from '../data/skillTrees';
import {
  availableStars,
  branchSpent,
  buyNode,
  nodeStatus,
  refundBranch,
  refundFighter,
  totalStarsEarned,
  type NodeStatus,
} from '../progress';
import { Btn, INK, TONE } from './ui';

const STAR = '#E0A800';

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
  needsParent: 'locked',
  fighterLocked: 'locked',
};

/** Stars available out of stars earned, as shown on Camp and the tree. */
export const StarPool: React.FC<{ save: AdventureSave; testID?: string }> = ({ save, testID }) => (
  <View testID={testID} style={st.pool} accessibilityLabel={`${availableStars(save)} of ${totalStarsEarned(save)} stars available`}>
    <Text style={st.poolGlyph}>★</Text>
    <Text style={st.poolText}>{availableStars(save)}</Text>
    <Text style={st.poolSub}>/ {totalStarsEarned(save)}</Text>
  </View>
);

const SkillTree: React.FC<Props> = ({ save, fighter, onChange, onBack }) => {
  const def = getFighter(fighter);
  const nodes = skillTreeOf(fighter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = nodes.find(n => n.id === selectedId) ?? null;
  const spentHere = branchSpent(save, fighter, 0) + branchSpent(save, fighter, 1);

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
        <StarPool save={save} testID="skill-tree-stars" />
      </View>
      <Text style={st.blurb}>
        Spend stars from every fighter's shared pool. Each node needs the one above it. Refunds are free, any time.
      </Text>

      <View style={st.columns}>
        {def.passives.map((passiveId, branchIndex) => {
          const branch = branchIndex as 0 | 1;
          const chain = nodes.filter(n => n.branch === branch).sort((a, b) => a.depth - b.depth);
          const spent = branchSpent(save, fighter, branch);
          return (
            <View key={passiveId} style={st.column}>
              <PassiveRoot passive={getPassive(passiveId)} />
              {spent > 0 ? (
                <TouchableOpacity
                  testID={`skill-refund-branch-${branch}`}
                  onPress={() => { sfx('coin'); setSelectedId(null); onChange(refundBranch(save, fighter, branch)); }}
                  style={st.refund}
                  accessibilityLabel={`Refund branch, get ${spent} stars back`}
                >
                  <Icon name="lorc/recycle" size={12} color={INK} />
                  <Text style={st.refundText}>Refund branch +{spent}★</Text>
                </TouchableOpacity>
              ) : (
                <View style={st.refundSpacer} />
              )}
              {chain.map(node => (
                <React.Fragment key={node.id}>
                  <View style={[st.link, nodeStatus(save, node.id) === 'owned' && st.linkOwned]} />
                  <NodeCard
                    node={node}
                    status={nodeStatus(save, node.id)}
                    selected={node.id === selectedId}
                    onPress={() => { sfx('click'); setSelectedId(node.id === selectedId ? null : node.id); }}
                  />
                </React.Fragment>
              ))}
            </View>
          );
        })}
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
          node={selected}
          status={nodeStatus(save, selected.id)}
          parentName={nodes.find(n => n.branch === selected.branch && n.depth === selected.depth - 1)?.name ?? getPassive(def.passives[selected.branch]).name}
          available={availableStars(save)}
          onBuy={() => { sfx('levelup'); onChange(buyNode(save, selected.id)); setSelectedId(null); }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </View>
  );
};

const PassiveRoot: React.FC<{ passive: PassiveDef }> = ({ passive }) => (
  <View style={st.root2} testID={`skill-passive-${passive.id}`}>
    <View style={st.rootIcon}><Icon name={passive.icon} size={22} color={INK} /></View>
    <Text style={st.rootName}>{passive.name}</Text>
    <Text style={st.rootText} numberOfLines={4}>{passive.text}</Text>
    <Text style={st.rootTag}>PASSIVE · FREE</Text>
  </View>
);

const NodeCard: React.FC<{ node: SkillNode; status: NodeStatus; selected: boolean; onPress: () => void }> = ({ node, status, selected, onPress }) => {
  const owned = status === 'owned';
  const locked = status === 'needsParent' || status === 'fighterLocked';
  return (
    <TouchableOpacity
      testID={`skill-node-${node.id}`}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${node.name}, ${node.cost} stars, ${STATUS_LABEL[status]}`}
      style={[
        st.node,
        owned && st.nodeOwned,
        status === 'buyable' && st.nodeBuyable,
        locked && st.nodeLocked,
        selected && st.nodeSelected,
      ]}
    >
      <View style={st.nodeTop}>
        <View style={[st.nodeIcon, owned && { backgroundColor: COLORS.canvasWhite }]}>
          <Icon name={locked ? 'lorc/padlock' : node.icon} size={16} color={locked ? TONE.spent : INK} />
        </View>
        <Text style={st.nodeName} numberOfLines={2}>{node.name}</Text>
      </View>
      <Text style={[st.nodeText, locked && { opacity: 0.7 }]} numberOfLines={3}>{node.text}</Text>
      <View style={st.nodeFoot}>
        <Text style={st.depth}>{node.depth}</Text>
        {owned ? (
          <Text style={st.ownedTag}>✓ OWNED</Text>
        ) : (
          <View style={[st.cost, status === 'buyable' && st.costBuyable]}>
            <Text style={[st.costText, status !== 'buyable' && { color: TONE.spent }]}>★{node.cost}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const NodeDetail: React.FC<{
  node: SkillNode;
  status: NodeStatus;
  parentName: string;
  available: number;
  onBuy: () => void;
  onClose: () => void;
}> = ({ node, status, parentName, available, onBuy, onClose }) => (
  <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={st.sheetWrap}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close details" />
      <View style={st.detail} testID="skill-detail">
        <View style={st.detailHead}>
          <View style={st.rootIcon}><Icon name={node.icon} size={22} color={INK} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.detailName}>{node.name}</Text>
            <Text style={st.detailMeta}>Branch {node.branch + 1} · depth {node.depth} · ★{node.cost}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={st.back} accessibilityLabel="Close details">
            <Text style={{ fontWeight: '900', color: INK }}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={st.detailText}>{node.text}</Text>
        {status === 'owned' ? (
          <Text style={st.detailNote}>Owned. It is on in every fight with this fighter.</Text>
        ) : status === 'needsParent' ? (
          <Text style={st.detailNote}>Needs {parentName} first.</Text>
        ) : status === 'needsStars' ? (
          <Text style={st.detailNote}>Needs {node.cost}★, you have {available}★. Earn more stars on the map or refund another branch.</Text>
        ) : status === 'fighterLocked' ? (
          <Text style={st.detailNote}>Unlock this fighter first.</Text>
        ) : null}
        <Btn testID="skill-buy" label={status === 'owned' ? 'Owned' : `Buy for ${node.cost}★`} disabled={status !== 'buyable'} onPress={onBuy} />
      </View>
    </View>
  </Modal>
);

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
  columns: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  column: { flex: 1, alignItems: 'stretch' },
  root2: { backgroundColor: COLORS.actionYellow, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 8, alignItems: 'center', gap: 3 },
  rootIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  rootName: { fontWeight: '900', fontSize: 13, color: INK, textAlign: 'center' },
  rootText: { fontSize: 10, color: INK, textAlign: 'center' },
  rootTag: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, color: INK, opacity: 0.7 },
  refund: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, backgroundColor: COLORS.canvasWhite, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingVertical: 4 },
  refundText: { fontSize: 10, fontWeight: '900', color: INK },
  refundSpacer: { height: 6 },
  link: { width: 4, height: 10, alignSelf: 'center', backgroundColor: '#6B5A49' },
  linkOwned: { backgroundColor: COLORS.actionYellow },
  node: { backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: '#B8B0A4', padding: 7, gap: 4 },
  nodeOwned: { backgroundColor: '#D4F4EE', borderColor: COLORS.logicTeal },
  nodeBuyable: { borderColor: INK },
  nodeLocked: { backgroundColor: '#E9E4DC', opacity: 0.75 },
  nodeSelected: { borderColor: COLORS.actionYellow, borderBottomWidth: 5 },
  nodeTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nodeIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  nodeName: { flex: 1, fontWeight: '900', fontSize: 12, color: INK },
  nodeText: { fontSize: 10, color: INK, lineHeight: 13 },
  nodeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  depth: { fontSize: 9, fontWeight: '900', color: TONE.spent },
  ownedTag: { fontSize: 9, fontWeight: '900', color: COLORS.logicTeal, letterSpacing: 1 },
  cost: { borderRadius: 999, borderWidth: 1.5, borderColor: TONE.spentEdge, paddingHorizontal: 7, paddingVertical: 1 },
  costBuyable: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  costText: { fontSize: 11, fontWeight: '900', color: INK },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(18,18,18,0.45)', padding: 12 },
  detail: { width: '100%', maxWidth: 520, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailName: { fontWeight: '900', fontSize: 16, color: INK },
  detailMeta: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.7 },
  detailText: { fontSize: 14, color: INK, lineHeight: 20 },
  detailNote: { fontSize: 12, color: TONE.tradeoff, fontWeight: '700' },
});

export default SkillTree;
