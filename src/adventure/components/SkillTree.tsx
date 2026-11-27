/**
 * One fighter's skill tree, drawn as a map (Clair Obscur style): round nodes
 * on a 7-column grid, linked by lines, grown from the fighter's two passive
 * roots. A node can be bought once anything it links to is owned. Every
 * fighter spends from all the stars earned (stars are not shared out between
 * fighters); refunds are free (a single node when nothing hangs off it, or the
 * whole fighter). Camp's ScrollView scrolls the map.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Modal, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { useModalMotion } from '@/components/ScreenTransition';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { BTN_PRESS, EASE, MS, OVERLAP, SCALE, SPRING, STAYS } from '@/utils/motion';
import { sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave, PassiveDef, SkillNode, TreePos } from '../types';
import { getFighter } from '../data/fighters';
import { getPassive } from '../data/passives';
import {
  ACTIVE_TREE_CAP,
  ACTIVE_TREE_CAP_RATIO,
  exclusiveConflictFor,
  getSkillNode,
  skillTreeOf,
  skillTreeRoots,
} from '../data/skillTrees';
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
import { companionVoice } from '../coach';
import CompanionBubble, { LivingBreath } from './CompanionBubble';
import { Btn, INK, TONE } from './ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

type TreeNodeStatus = NodeStatus | 'atCapacity' | 'exclusive';

const STATUS_LABEL: Record<TreeNodeStatus, string> = {
  owned: 'owned',
  buyable: 'can buy',
  needsStars: 'not enough stars',
  needsLink: 'locked',
  sealed: 'sealed',
  fighterLocked: 'locked',
  atCapacity: 'active capacity full',
  exclusive: 'exclusive choice locked',
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
  const reduced = useReducedMotion();
  const def = getFighter(fighter);
  const nodes = skillTreeOf(fighter);
  const roots = skillTreeRoots(fighter);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastBuy, setLastBuy] = useState<{ nodeId: string; seq: number } | null>(null);
  const selected = nodes.find(n => n.id === selectedId) ?? null;
  const lastSelectedRef = useRef<SkillNode | null>(selected);
  if (selected) lastSelectedRef.current = selected;
  const spentHere = fighterStarsSpent(save, fighter);
  const ownedForFighter = save.skillNodes[fighter] ?? [];
  const capRatio = Math.max(0, Math.min(1, spentHere / Math.max(1, ACTIVE_TREE_CAP)));
  const status = new Map<string, TreeNodeStatus>(
    nodes.map(n => {
      const base = nodeStatus(save, n.id);
      if (base === 'owned' || base === 'fighterLocked' || base === 'sealed' || base === 'needsLink') {
        return [n.id, base];
      }
      if (exclusiveConflictFor(ownedForFighter, n.id)) {
        return [n.id, 'exclusive'];
      }
      if (spentHere + n.cost > ACTIVE_TREE_CAP) {
        return [n.id, 'atCapacity'];
      }
      return [n.id, base];
    })
  );

  const rows = Math.max(...nodes.map(n => n.pos.row), ...roots.map(r => r.pos.row)) + 1;
  const g = geometry(width, rows);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  // Every link once: node–node pairs (a < b) and node–root links
  const rootPos = new Map(roots.map(r => [r.passive, r.pos]));
  const lines: { key: string; aId: string; bId: string; a: TreePos; b: TreePos; lit: boolean; frontier: boolean }[] = [];
  for (const n of nodes) {
    const owned = status.get(n.id) === 'owned';
    for (const other of n.links) {
      if (other < n.id) continue;
      const otherOwned = status.get(other) === 'owned';
      lines.push({
        key: `${n.id}~${other}`,
        aId: n.id,
        bId: other,
        a: n.pos,
        b: getSkillNode(other)!.pos,
        lit: owned && otherOwned,
        frontier: owned !== otherOwned,
      });
    }
    for (const p of n.roots) {
      lines.push({
        key: `${p}~${n.id}`,
        aId: p,
        bId: n.id,
        a: rootPos.get(p)!,
        b: n.pos,
        lit: owned,
        frontier: !owned,
      });
    }
  }

  // Newly lit lines touching the node just bought (draw golden beam from owned parent → bought node)
  const freshBeams = lastBuy && !reduced
    ? lines
        .filter(l => l.lit && (l.aId === lastBuy.nodeId || l.bId === lastBuy.nodeId))
        .map(l => {
          const from = l.aId === lastBuy.nodeId ? g.center(l.b) : g.center(l.a);
          const to = l.aId === lastBuy.nodeId ? g.center(l.a) : g.center(l.b);
          return { key: `${l.key}-${lastBuy.seq}`, from, to };
        })
    : [];

  const detailNode = selected ?? lastSelectedRef.current;

  return (
    <View style={st.root} testID={`skill-tree-${fighter}`}>
      <View style={st.head}>
        <TouchableOpacity testID="skill-tree-back" onPress={() => { sfx('back'); onBack(); }} style={st.back} accessibilityLabel="Back to fighters">
          <Icon name="ui/back-arrow" size={18} color={INK} noShadow />
        </TouchableOpacity>
        <LivingBreath seedKey={`skill-head-${fighter}`} size={42}>
          <FighterAvatar character={fighter} size={42} mood="anticipation" framed animate={false} />
        </LivingBreath>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{fighter}</Text>
          <Text style={st.sub}>Skill tree · {spentHere}★ spent here</Text>
        </View>
        <StarPool save={save} fighter={fighter} testID="skill-tree-stars" />
      </View>

      <View style={st.passives}>
        {def.passives.map(id => <PassiveCard key={id} passive={getPassive(id)} />)}
      </View>
      <View style={st.capacityBox} testID="skill-tree-capacity">
        <View style={st.capacityHead}>
          <Text style={st.capacityLabel}>ACTIVE CAPACITY ({Math.round(ACTIVE_TREE_CAP_RATIO * 100)}% BUILD CAP)</Text>
          <Text style={st.capacityValue}>{spentHere} / {ACTIVE_TREE_CAP}★</Text>
        </View>
        <CapacityBar ratio={capRatio} atCap={spentHere >= ACTIVE_TREE_CAP} reduced={reduced} />
      </View>
      {spentHere === 0 && availableStars(save, fighter) > 0 && (
        <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
          <CompanionBubble
            testID="skill-tree-welcome"
            character={fighter}
            mood="victory"
            text={`${companionVoice(fighter).cheer} Tap any glowing node next to a yellow passive to power me up! Respecs are always free.`}
          />
        </View>
      )}
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

        {/* Animated golden draw-on beams highlighting newly purchased skill links */}
        {freshBeams.map(beam => (
          <AnimatedLinkBeam key={beam.key} from={beam.from} to={beam.to} />
        ))}

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
            celebrateSeq={lastBuy?.nodeId === n.id ? lastBuy.seq : 0}
            reduced={reduced}
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
          onPress={() => { sfx('coin'); setSelectedId(null); setLastBuy(null); onChange(refundFighter(save, fighter)); }}
          style={{ alignSelf: 'center' }}
        />
      )}

      {detailNode && (
        <NodeDetail
          visible={Boolean(selected)}
          save={save}
          node={detailNode}
          status={status.get(detailNode.id) ?? 'needsLink'}
          onBuy={() => {
            sfx('levelup');
            setLastBuy(prev => ({ nodeId: detailNode.id, seq: (prev?.seq ?? 0) + 1 }));
            onChange(buyNode(save, detailNode.id));
            setSelectedId(null);
          }}
          onRefund={() => {
            sfx('coin');
            setLastBuy(null);
            onChange(refundNode(save, detailNode.id));
            setSelectedId(null);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </View>
  );
};

/** GPU-only scaleX capacity fill bar. */
const CapacityBar: React.FC<{ ratio: number; atCap: boolean; reduced: boolean }> = ({ ratio, atCap, reduced }) => {
  const fill = useSharedValue(ratio);
  useEffect(() => {
    if (reduced) {
      fill.value = ratio;
      return;
    }
    fill.value = withTiming(ratio, { duration: MS.move, easing: EASE.enterSoft });
    return () => cancelAnimation(fill);
  }, [ratio, reduced, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));

  return (
    <View style={st.capacityTrack}>
      <Animated.View
        style={[
          st.capacityFill,
          { backgroundColor: atCap ? COLORS.impactRed : COLORS.logicTeal },
          fillStyle,
        ]}
      />
    </View>
  );
};

/** Golden ink connector draw-on beam shooting from parent → just-bought node. */
const AnimatedLinkBeam: React.FC<{ from: { x: number; y: number }; to: { x: number; y: number } }> = ({ from, to }) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const progress = useSharedValue(0);
  const glowO = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    glowO.value = 0;
    progress.value = withDelay(OVERLAP.primaryMs, withTiming(1, { duration: MS.move, easing: EASE.enter }));
    glowO.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(1, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
        withTiming(1, { duration: MS.move, easing: EASE.ui }),
        withTiming(0, { duration: MS.panel, easing: EASE.enterSoft })
      )
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(glowO);
    };
  }, [progress, glowO]);

  const style = useAnimatedStyle(() => ({
    opacity: glowO.value,
    transform: [{ rotate: `${angle}rad` }, { scaleX: progress.value }],
  }));

  return (
    <Animated.View
      testID="skill-link-beam"
      pointerEvents="none"
      style={[
        st.linkBeam,
        {
          left: from.x,
          top: from.y - 4,
          width: len,
        },
        style,
      ]}
    />
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
  status: TreeNodeStatus;
  selected: boolean;
  celebrateSeq: number;
  reduced: boolean;
  size: number;
  center: { x: number; y: number };
  onPress: () => void;
}> = ({ node, status, selected, celebrateSeq, reduced, size, center, onPress }) => {
  const owned = status === 'owned';
  const reachable = status === 'buyable' || status === 'needsStars' || status === 'atCapacity';
  const locked = !owned && !reachable;
  /** Capstones (5★+) are diamonds */
  const capstone = node.cost >= 5;
  const box = capstone ? Math.round(size * 0.82) : size;

  const pressed = useSharedValue(0);
  const popScale = useSharedValue(1);
  const ringScale = useSharedValue(0.75);
  const ringO = useSharedValue(0);

  useEffect(() => {
    if (celebrateSeq === 0) return;
    if (reduced) {
      ringO.value = withSequence(
        STAYS.reduceMotion,
        withTiming<number>(0.85, { duration: OVERLAP.secondaryMs, easing: EASE.ui, ...STAYS }),
        withTiming<number>(0, { duration: MS.quick, easing: EASE.exitSoft, ...STAYS })
      );
      ringScale.value = 1.25;
      return;
    }
    popScale.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(SCALE.reward, { duration: MS.feedback, easing: EASE.enter }),
        withSpring(1, SPRING.playful)
      )
    );
    ringScale.value = 0.72;
    ringScale.value = withDelay(
      OVERLAP.primaryMs,
      withTiming(2.1, { duration: MS.panel + MS.feedback, easing: EASE.enterSoft })
    );
    ringO.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(0.95, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
        withTiming(0, { duration: MS.panel + OVERLAP.secondaryMs, easing: EASE.enterSoft })
      )
    );
  }, [celebrateSeq, reduced, popScale, ringScale, ringO]);

  useEffect(() => () => {
    cancelAnimation(pressed);
    cancelAnimation(popScale);
    cancelAnimation(ringScale);
    cancelAnimation(ringO);
  }, [pressed, popScale, ringScale, ringO]);

  const nodeAnimStyle = useAnimatedStyle(() => {
    const pressScale = reduced ? 1 : 1 - pressed.value * (1 - BTN_PRESS.scale);
    return {
      transform: [{ scale: popScale.value * pressScale }],
    };
  });

  const ringAnimStyle = useAnimatedStyle(() => ({
    opacity: ringO.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <AnimatedPressable
      testID={`skill-node-${node.id}`}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: BTN_PRESS.pressInMs, easing: EASE.ui });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, SPRING.snappy);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${node.name}, ${node.cost} stars, ${STATUS_LABEL[status]}`}
      style={[st.nodeWrap, { left: center.x - size / 2 - 8, top: center.y - size / 2, width: size + 16 }]}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          testID={celebrateSeq > 0 ? `skill-node-burst-${node.id}` : undefined}
          pointerEvents="none"
          style={[
            st.burstRing,
            { width: size, height: size, borderRadius: size / 2 },
            ringAnimStyle,
          ]}
        />
        <Animated.View style={nodeAnimStyle}>
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
        </Animated.View>
      </View>
      <Text style={[st.cost, owned && { color: '#7FE3D3' }, status === 'buyable' && { color: COLORS.actionYellow }]} numberOfLines={1}>
        {owned ? '✓' : status === 'sealed' ? `${node.requires?.starsEarned}★ earned` : `★${node.cost}`}
      </Text>
    </AnimatedPressable>
  );
};

const NodeDetail: React.FC<{
  visible: boolean;
  save: AdventureSave;
  node: SkillNode;
  status: TreeNodeStatus;
  onBuy: () => void;
  onRefund: () => void;
  onClose: () => void;
}> = ({ visible, save, node, status, onBuy, onRefund, onClose }) => {
  const { rendered, closing, backdropStyle, panelStyle, contentStyle } = useModalMotion(visible, {
    travelY: 36,
    sheet: true,
  });
  if (!rendered) return null;

  const neighbours = [...node.roots.map(p => getPassive(p).name), ...node.links.map(id => getSkillNode(id)!.name)];
  const blockers = status === 'owned' ? refundBlockers(save, node.id) : [];
  const exclusivePartner = node.exclusiveWith ? getSkillNode(node.exclusiveWith) : undefined;
  const spentHere = fighterStarsSpent(save, node.fighter);
  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose}>
      <View style={st.sheetWrap} pointerEvents={closing ? 'none' : 'auto'}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.sheetBackdrop, backdropStyle]} />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close details" />
        <Animated.View style={[st.detail, panelStyle]} testID="skill-detail">
          <Animated.View style={[{ gap: 8 }, contentStyle]}>
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
            {exclusivePartner && (
              <Text style={st.detailExclusive}>⇄ Mutually exclusive capstone choice with {exclusivePartner.name}</Text>
            )}
            <Text style={st.detailLinks}>Links to: {neighbours.join(', ')}</Text>
            {status === 'owned' ? (
              <Text style={st.detailNote}>
                {blockers.length > 0
                  ? `Owned. Refund ${blockers.map(b => b.name).join(', ')} first: ${blockers.length === 1 ? 'it hangs' : 'they hang'} off this node.`
                  : 'Owned. It is on in every fight with this fighter.'}
              </Text>
            ) : status === 'exclusive' && exclusivePartner ? (
              <Text style={st.detailNote}>Locked by {exclusivePartner.name}. Refund {exclusivePartner.name} first to swap to this capstone (respecs are free).</Text>
            ) : status === 'atCapacity' ? (
              <Text style={st.detailNote}>Active capacity full ({spentHere}/{ACTIVE_TREE_CAP}★). Refund {spentHere + node.cost - ACTIVE_TREE_CAP}★ elsewhere to slot {node.name} — respecs are free.</Text>
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
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  root: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 10 },
  back: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', fontSize: 16, color: INK },
  sub: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.7, fontVariant: ['tabular-nums'] },
  blurb: { color: TONE.onDusk, fontSize: 12, textAlign: 'center' },
  pool: { flexDirection: 'row', alignItems: 'baseline', gap: 2, backgroundColor: COLORS.deepOnyx, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  poolGlyph: { color: STAR, fontSize: 15, fontWeight: '900' },
  poolText: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 15, fontVariant: ['tabular-nums'] },
  poolSub: { color: '#B9B1A5', fontWeight: '700', fontSize: 11, fontVariant: ['tabular-nums'] },
  passives: { flexDirection: 'row', gap: 8 },
  passive: { flex: 1, backgroundColor: COLORS.actionYellow, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 8, gap: 3 },
  passiveHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passiveIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  passiveName: { flex: 1, fontWeight: '900', fontSize: 13, color: INK },
  passiveText: { fontSize: 10, color: INK },
  passiveTag: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, color: INK, opacity: 0.7 },
  map: { width: '100%', backgroundColor: '#3A2F27', borderRadius: 14, borderWidth: 2.5, borderColor: INK, overflow: 'hidden' },
  linkBeam: {
    position: 'absolute',
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.actionYellow,
    transformOrigin: 'left center',
  },
  burstRing: {
    position: 'absolute',
    borderWidth: 3.5,
    borderColor: COLORS.actionYellow,
  },
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
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 12 },
  sheetBackdrop: { backgroundColor: 'rgba(18,18,18,0.48)' },
  detail: { width: '100%', maxWidth: 520, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailName: { fontWeight: '900', fontSize: 16, color: INK },
  detailMeta: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.7 },
  detailText: { fontSize: 14, color: INK, lineHeight: 20 },
  detailLinks: { fontSize: 11, color: INK, opacity: 0.75 },
  detailExclusive: { fontSize: 11.5, fontWeight: '800', color: TONE.arcana },
  detailNote: { fontSize: 12, color: TONE.tradeoff, fontWeight: '700' },
  capacityBox: { backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2, borderColor: INK, paddingHorizontal: 10, paddingVertical: 7, gap: 5 },
  capacityHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capacityLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.9, color: INK, opacity: 0.78 },
  capacityValue: { fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  capacityTrack: { height: 7, borderRadius: 4, backgroundColor: '#E5DDD0', overflow: 'hidden', borderWidth: 1, borderColor: INK },
  capacityFill: { width: '100%', height: '100%', borderRadius: 3, transformOrigin: 'left center' },
});

export default SkillTree;
