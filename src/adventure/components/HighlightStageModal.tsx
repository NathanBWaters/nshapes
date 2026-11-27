/**
 * [TP-13] Slow-motion visual highlight playback modal (`HighlightStageModal`).
 *
 * Reconstructs any logged Set move on a compact `FxStage` + `MultiplierIgnition`
 * stage driven by `fxClock` at `0.5×` slow-motion (with `0.5×` / `1×` toggle
 * and 1-tap Replay button, strictly restoring `fxClock.slow` on unmount/close
 * and honoring `useReducedMotion()`).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { useModalMotion } from '@/components/ScreenTransition';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import {
  Anchor,
  AnchorsProvider,
  FxStage,
  GearBelt,
  MultiplierIgnition,
  fxClock,
  scriptFor,
  useAnchors,
  useFightFx,
} from '../fx';
import type { MoveSnapshot } from '../engine/replay';
import type { RunState } from '../types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import { INK } from './ui';

export type HighlightSpeed = 0.5 | 1;

interface Props {
  visible: boolean;
  snapshot: MoveSnapshot | null;
  onClose: () => void;
  testID?: string;
}

const HighlightStageModal: React.FC<Props> = ({
  visible,
  snapshot,
  onClose,
  testID = 'highlight-stage-modal',
}) => {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const anchors = useAnchors();
  const [stage, setStage] = useState({ w: 340, h: 360 });
  const [speed, setSpeed] = useState<HighlightSpeed>(0.5);
  const [playNonce, setPlayNonce] = useState(0);
  const savedSlowRef = useRef<number | null>(null);

  const fx = useFightFx({ anchors, reduced: reducedMotion });

  // Sync fxClock.slow while modal is open and strictly restore on close/unmount
  useEffect(() => {
    if (!visible) {
      if (savedSlowRef.current !== null) {
        fxClock.slow = savedSlowRef.current;
        savedSlowRef.current = null;
      }
      return;
    }
    if (savedSlowRef.current === null) {
      savedSlowRef.current = fxClock.slow;
    }
    fxClock.slow = reducedMotion ? 1 : speed === 0.5 ? 2 : 1;
    return () => {
      if (savedSlowRef.current !== null) {
        fxClock.slow = savedSlowRef.current;
        savedSlowRef.current = null;
      }
    };
  }, [visible, speed, reducedMotion]);

  const triggerPlayback = useCallback(() => {
    if (!snapshot) return;
    fxClock.slow = reducedMotion ? 1 : speed === 0.5 ? 2 : 1;
    const script = scriptFor(snapshot.events, {
      weapons: snapshot.weapons,
      reduced: reducedMotion,
    });
    fx.play(script);
    setPlayNonce(n => n + 1);
  }, [snapshot, speed, reducedMotion, fx]);

  // Auto-play once when opened with a snapshot
  useEffect(() => {
    if (!visible || !snapshot) return;
    const t = setTimeout(() => {
      triggerPlayback();
    }, 60);
    return () => clearTimeout(t);
  }, [visible, snapshot, triggerPlayback]);

  const activeIgnition = useMemo(() => {
    if (!snapshot?.ignition) return null;
    return { ...snapshot.ignition, id: snapshot.ignition.id * 1000 + playNonce };
  }, [snapshot?.ignition, playNonce]);

  /** Lightweight RunState stub so MultiplierIgnition's initial mount frame never reads null primed state. */
  const previewRun = useMemo(() => {
    if (!snapshot) return undefined;
    return {
      board: snapshot.boardBefore,
      connections: [],
      weapons: snapshot.weapons,
      skillNodes: [],
      activeEvolutions: [],
      growth: {},
      stats: { ...DEFAULT_PLAYER_STATS },
      passives: [],
      passive: {
        nineLivesLeft: 0,
        hotStreak: false,
        grudge: 0,
        thickHideLeft: 0,
        zoomiesIn: 0,
        scoopIn: 0,
        keenEyeCardId: null,
      },
      gear: {
        bounty: null,
        lastSetSlots: [],
        snowball: 0,
        album: [],
        glassBroken: false,
        glassSinceMs: 0,
        tarRow: null,
        potatoAtMs: 0,
        mirrorMemory: [],
        glassSparesUsed: 0,
      },
      ruleState: {},
      arcana: [],
      surge: null,
      parry: null,
      hearts: snapshot.entry.hearts,
      maxHearts: snapshot.entry.hearts,
      foeHp: snapshot.foeHpBefore,
      foeMaxHp: snapshot.foeMaxHp,
      bonusDamagePerMatch: 0,
      nextSetMultiplier: 1,
      frozenMs: 0,
      power: snapshot.entry.set?.powerPoints ?? 0,
      combo: snapshot.entry.set?.combo ?? 0,
      matches: 0,
      mistakes: 0,
      setsThisWave: 0,
      elapsedMs: snapshot.entry.t,
    } as unknown as RunState;
  }, [snapshot]);

  const lastSnapshotRef = useRef<MoveSnapshot | null>(snapshot);
  if (snapshot) lastSnapshotRef.current = snapshot;
  const activeSnapshot = snapshot ?? lastSnapshotRef.current;

  const { rendered, closing, backdropStyle, panelStyle, contentStyle } = useModalMotion(
    visible && Boolean(snapshot),
    { travelY: 28 }
  );

  if (!rendered || !activeSnapshot) return null;

  const boardCards = activeSnapshot.boardBefore.slice(0, 12);
  const hpBeforeRatio =
    activeSnapshot.foeMaxHp > 0
      ? Math.max(0, Math.min(1, activeSnapshot.foeHpBefore / activeSnapshot.foeMaxHp))
      : 1;
  const hpAfterRatio =
    activeSnapshot.foeMaxHp > 0
      ? Math.max(0, Math.min(1, activeSnapshot.foeHpAfter / activeSnapshot.foeMaxHp))
      : 0;

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose} testID={testID}>
      <View
        style={[st.backdrop, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
        pointerEvents={closing ? 'none' : 'auto'}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.backdropScrim, backdropStyle]} />
        <AnchorsProvider value={anchors}>
          <Animated.View style={[st.card, panelStyle]}>
            {/* Header */}
            <View style={st.header}>
              <Icon name="lorc/bright-explosion" size={18} color={COLORS.impactOrange} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.eyebrow}>HIGHLIGHT REPLAY · {reducedMotion ? 'STATIC' : `${speed}×`}</Text>
                <Text style={st.title} numberOfLines={1}>
                  {activeSnapshot.entry.damage} dmg vs {activeSnapshot.foeName}
                </Text>
              </View>
              <TouchableOpacity
                testID="highlight-close"
                onPress={onClose}
                style={st.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close highlight replay"
              >
                <Icon name="lorc/cross-mark" size={16} color={INK} />
              </TouchableOpacity>
            </View>

            <Animated.View style={contentStyle}>
            {/* Interactive Playback Stage */}
            <View
              style={st.stage}
              testID="highlight-fx-stage"
              onLayout={e =>
                setStage({
                  w: e.nativeEvent.layout.width,
                  h: e.nativeEvent.layout.height,
                })
              }
            >
              <View ref={anchors.rootRef} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />

              {/* Compact Combat HUD */}
              <View style={st.hud}>
                <View style={st.hudRow}>
                  <Anchor name="fighter">
                    <FighterAvatar character={activeSnapshot.fighter} size={38} framed animate={false} />
                  </Anchor>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={st.foeLabel} numberOfLines={1}>
                      {activeSnapshot.foeName} · {activeSnapshot.foeHpBefore} → {activeSnapshot.foeHpAfter} HP
                    </Text>
                    <View style={st.hpTrack}>
                      <View style={[st.hpGhost, { transform: [{ scaleX: hpBeforeRatio }] }]} />
                      <View style={[st.hpFill, { transform: [{ scaleX: hpAfterRatio }] }]} />
                    </View>
                  </View>
                  <Anchor name="foe">
                    <View style={st.foeBox}>
                      <EnemyAvatar
                        enemy={{ name: activeSnapshot.foeName, icon: activeSnapshot.foeIcon, tier: 1 }}
                        size={38}
                        lightweight
                      />
                    </View>
                  </Anchor>
                </View>

                {activeSnapshot.weapons.length > 0 && (
                  <GearBelt weapons={activeSnapshot.weapons} width={stage.w} onInspect={() => {}} />
                )}

                {activeIgnition && (
                  <MultiplierIgnition
                    ignition={activeIgnition}
                    run={previewRun}
                    enabled={!reducedMotion}
                  />
                )}
              </View>

              {/* Mini Board */}
              <View ref={anchors.ref('board')} collapsable={false} style={st.board}>
                {[0, 1, 2, 3].map(row => (
                  <View key={row} style={st.boardRow}>
                    {[0, 1, 2].map(col => {
                      const idx = row * 3 + col;
                      const card = boardCards[idx];
                      return (
                        <View
                          key={idx}
                          ref={anchors.ref(`slot:${idx}`)}
                          collapsable={false}
                          onLayout={anchors.measure}
                          style={st.slot}
                        >
                          {card && <Card card={card} onClick={() => {}} disabled isPaused />}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              <FxStage fx={fx} anchors={anchors} size={stage} />
            </View>

            {/* Controls: 0.5× / 1× toggle + Replay */}
            <View style={st.controls}>
              <View style={st.speedRow}>
                {([0.5, 1] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    testID={`highlight-speed-${s}`}
                    onPress={() => setSpeed(s)}
                    style={[st.speedPill, speed === s && st.speedPillOn]}
                    activeOpacity={0.85}
                    accessibilityState={{ selected: speed === s }}
                  >
                    <Text style={[st.speedText, speed === s && st.speedTextOn]}>
                      {s === 0.5 ? '0.5× Slow-Mo' : '1× Real-Time'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                testID="highlight-replay"
                onPress={triggerPlayback}
                style={st.replayBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Replay highlight"
              >
                <Icon name="lorc/cycle" size={15} color={INK} />
                <Text style={st.replayBtnText}>Replay</Text>
              </TouchableOpacity>
            </View>
            </Animated.View>
          </Animated.View>
        </AnchorsProvider>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  backdropScrim: {
    backgroundColor: 'rgba(18,18,18,0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: INK,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.actionYellow,
    borderBottomWidth: 2,
    borderBottomColor: INK,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: INK,
    opacity: 0.72,
  },
  title: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    color: INK,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    backgroundColor: '#E8F3E4',
    position: 'relative',
    overflow: 'hidden',
  },
  hud: {
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    padding: 8,
    gap: 6,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foeLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
    color: INK,
  },
  hpTrack: {
    height: 12,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: '#F1E9E0',
    overflow: 'hidden',
    position: 'relative',
  },
  hpGhost: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FCA5A5',
    transformOrigin: 'left center',
  },
  hpFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.impactRed,
    transformOrigin: 'left center',
  },
  foeBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: {
    paddingVertical: 8,
    paddingHorizontal: 36,
    gap: 5,
  },
  boardRow: {
    flexDirection: 'row',
    gap: 5,
  },
  slot: {
    flex: 1,
    aspectRatio: 1.05,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 10,
    backgroundColor: COLORS.paperBeige,
    borderTopWidth: 2,
    borderTopColor: INK,
  },
  speedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  speedPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: COLORS.canvasWhite,
  },
  speedPillOn: {
    backgroundColor: COLORS.logicTeal,
  },
  speedText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: INK,
  },
  speedTextOn: {
    color: COLORS.canvasWhite,
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: INK,
    backgroundColor: COLORS.actionYellow,
  },
  replayBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: INK,
  },
});

export default HighlightStageModal;
