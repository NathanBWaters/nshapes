/**
 * Angry Birds 2–style Friend Rescue Modal.
 *
 * Triggered when the player walks over (or taps) a Golden Rescue Key along
 * the Adventure Map road. Shows every remaining caged friend with their
 * passives (reusing shared `FighterPassivesList`) so the player chooses ANY
 * friend to free first.
 *
 * Motion (brief: docs/motion/reviews/friend-rescue.md):
 * - Phase 1 (`pick`): modal dark backdrop fades in (`MS.quick`), picker sheet rises
 *   softly (`MS.move`, `EASE.enterSoft`).
 * - Phase 2 (`rescued`): Golden Key glides into the brass padlock (`MS.move`,
 *   `EASE.enter`), locks in for 2 frames, cranks 90° (`MS.quick`, `EASE.ui`,
 *   `keyFound` cue), then ON THE BREAK FRAME both forged iron cage halves burst
 *   outward (`MS.move`, `EASE.enter`), the padlock drops, one gold shockwave
 *   ring expands (`MS.panel`, `EASE.enterSoft`), `friendRescued` lands, and the
 *   freed friend leaps into `mood="victory"` (`SPRING.playful`). Details and
 *   buttons rise cleanly after the break (`STAGGER.item`).
 * - Reduced motion: skips travel/shatter/springs and cross-fades (`STAYS`,
 *   `MS.quick`) straight to the settled `FRIEND FREED!` celebration.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { band, sfx } from '@/audio';
import { FighterAvatar } from '@/components/fighters';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { KEY_PRIORITY, useKeyboardNav } from '@/hooks/useKeyboardNav';
import { COLORS } from '@/utils/colors';
import { EASE, exitMs, MS, SCALE, SPRING, STAGGER, STAYS } from '@/utils/motion';
import type { CharacterName } from '@/types';
import type { AdventureSave, FighterDef } from '../types';
import { getFighter } from '../data/fighters';
import { lockedFighters, type MapKeyDef } from '../data/mapKeys';
import { companionVoice } from '../coach';
import CompanionBubble from './CompanionBubble';
import { CageBarsSvg, CagePadlockSvg, GoldenKeyArt } from './RescueArt';
import { FighterPassivesList } from './SharedCards';
import { DARK, INK } from './ui';

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

/** Timing table for Phase 2 (Key-Turn → Split-Cage Shatter) in ms, built from `motion.ts` tokens */
const KEY_SLIDE_MS = MS.move;        // 280 ms: key rises into brass padlock
const KEY_HOLD_MS = 32;              // 2 frames: mechanical seat before turn
const KEY_TURN_AT = KEY_SLIDE_MS + KEY_HOLD_MS;
const KEY_TURN_MS = MS.quick;        // 180 ms: key cranks 0° → 90°
const BREAK_AT = KEY_TURN_AT + KEY_TURN_MS; // 492 ms (~f31): bars burst + sound lands + friend leaps!
const DETAIL_AT = (k: number) => BREAK_AT + 140 + k * STAGGER.item;

interface Props {
  keyDef: MapKeyDef | null;
  save: AdventureSave;
  /** Called immediately when the player confirms who to free (persists unlock & key claim). */
  onRescue: (keyId: string, fighter: CharacterName) => void;
  /** Switch active fighter to the newly rescued friend. */
  onUseFighter: (fighter: CharacterName) => void;
  /** Close modal (either after rescuing or after tapping "Save key for later"). */
  onClose: (deferred: boolean) => void;
}

const FriendRescueModal: React.FC<Props> = ({ keyDef, save, onRescue, onUseFighter, onClose }) => {
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const reduced = useReducedMotion();

  const [rescued, setRescued] = useState<CharacterName | null>(null);
  const [selected, setSelected] = useState<CharacterName | null>(null);
  const [cagedList, setCagedList] = useState<FighterDef[]>([]);

  // Reset modal session cleanly whenever a new key opens
  const openKeyId = keyDef?.id ?? null;
  useEffect(() => {
    if (!openKeyId) {
      setRescued(null);
      setSelected(null);
      setCagedList([]);
      return;
    }
    const caged = lockedFighters(save);
    setCagedList(caged);
    setRescued(null);
    setSelected(caged[0]?.name ?? null);
    // Snapshot locked list on open so claiming a friend doesn't yank the UI out from under Phase 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKeyId]);

  // Modal backdrop & entrance animation
  const backdrop = useSharedValue(0);
  const panelY = useSharedValue(reduced ? 0 : 28);
  const panelO = useSharedValue(0);

  useEffect(() => {
    if (!openKeyId) {
      backdrop.value = 0;
      panelO.value = 0;
      panelY.value = reduced ? 0 : 28;
      return;
    }
    backdrop.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS });
    panelO.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS });
    panelY.value = reduced ? 0 : withTiming(0, { duration: MS.move, easing: EASE.enterSoft });
  }, [openKeyId, reduced, backdrop, panelO, panelY]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelO.value,
    transform: [{ translateY: panelY.value }],
  }));

  if (!keyDef) return null;
  // Guard: if all friends are already unlocked and we aren't celebrating a rescue right now, render nothing
  if (!rescued && cagedList.length === 0) return null;

  const chosenFighter = selected ? getFighter(selected) : cagedList[0];

  const handleConfirmRescue = () => {
    if (!chosenFighter) return;
    sfx('confirm');
    onRescue(keyDef.id, chosenFighter.name);
    setRescued(chosenFighter.name);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => onClose(!rescued)}>
      <View
        testID="friend-rescue-modal"
        style={[st.overlay, { paddingTop: Math.max(insets.top + 8, 16), paddingBottom: Math.max(insets.bottom + 10, 16) }]}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.backdrop, backdropStyle]} />

        <Animated.View style={[st.frame, panelStyle]}>
          {rescued ? (
            <RescueCelebration
              key={rescued}
              fighter={rescued}
              currentFighter={save.selectedFighter}
              location={keyDef.location}
              reduced={reduced}
              onUse={() => {
                sfx('confirm');
                onUseFighter(rescued);
                onClose(false);
              }}
              onKeep={() => {
                sfx('click');
                onClose(false);
              }}
            />
          ) : (
            <RescuePicker
              keyDef={keyDef}
              caged={cagedList}
              selected={chosenFighter?.name ?? null}
              onSelect={name => {
                sfx('click');
                setSelected(name);
              }}
              onConfirm={handleConfirmRescue}
              onLater={() => {
                sfx('click');
                onClose(true);
              }}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Phase 1: Choose ANY Caged Friend to Free
// ---------------------------------------------------------------------------

const RescuePicker: React.FC<{
  keyDef: MapKeyDef;
  caged: FighterDef[];
  selected: CharacterName | null;
  onSelect: (name: CharacterName) => void;
  onConfirm: () => void;
  onLater: () => void;
}> = ({ keyDef, caged, selected, onSelect, onConfirm, onLater }) => {
  const chosen = caged.find(f => f.name === selected) ?? caged[0];

  // [UI-23]: Web keyboard controls for Friend Rescue picker (Arrow cycle, Enter/Space confirm, Esc defer)
  useKeyboardNav({
    enabled: caged.length > 0,
    priority: KEY_PRIORITY.OVERLAY,
    onConfirm,
    onCancel: onLater,
    onNavigate: dir => {
      if (caged.length <= 1) return;
      const curIdx = Math.max(0, caged.findIndex(f => f.name === chosen?.name));
      const delta = dir === 'up' || dir === 'left' ? -1 : 1;
      const next = caged[(curIdx + delta + caged.length) % caged.length];
      if (next) onSelect(next.name);
    },
  });

  return (
    <View style={st.pickerRoot} testID="rescue-picker">
      {/* Header crest */}
      <View style={st.header}>
        <View style={st.keyCrest}>
          <GoldenKeyArt size={38} />
        </View>
        <View style={st.headerBadge}>
          <Text style={st.headerBadgeText}>GOLDEN KEY · {keyDef.location.toUpperCase()}</Text>
        </View>
        <Text style={st.title}>FREE A FRIEND!</Text>
        <Text style={st.subtitle}>
          {caged.length === 1
            ? 'Your last caged friend is waiting—unlock their cage!'
            : `Pick any of your ${caged.length} caged friends to rescue right now.`}
        </Text>
      </View>

      {/* Scrollable roster of all remaining caged friends */}
      <ScrollView
        style={st.list}
        contentContainerStyle={st.listContent}
        showsVerticalScrollIndicator={false}
      >
        {caged.map(f => {
          const isSelected = f.name === chosen?.name;
          return (
            <TouchableOpacity
              key={f.name}
              testID={`rescue-option-${f.name}`}
              onPress={() => onSelect(f.name)}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Select ${f.name} to rescue: ${f.blurb}`}
              style={[st.card, isSelected && st.cardSelected]}
            >
              <View style={st.cardTop}>
                {/* Caged friend portrait */}
                <View style={[st.cageThumb, isSelected && st.cageThumbSelected]}>
                  <FighterAvatar
                    character={f.name}
                    size={52}
                    mood={isSelected ? 'anticipation' : 'urgent'}
                    animate={false}
                  />
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <CageBarsSvg width={66} height={66} side="full" />
                  </View>
                  <View style={st.miniLock} pointerEvents="none">
                    <CagePadlockSvg size={18} />
                  </View>
                </View>

                <View style={st.cardInfo}>
                  <View style={st.cardNameRow}>
                    <Text style={st.cardName}>{f.name}</Text>
                    {isSelected && (
                      <View style={st.selectedPill}>
                        <Text style={st.selectedPillText}>PICKED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={st.cardBlurb}>{f.blurb}</Text>
                </View>
              </View>

              {/* Reuse shared passives card (zero duplicate markup) */}
              <FighterPassivesList
                fighter={f.name}
                compact
                itemTestIdPrefix="rescue-passive"
                style={st.passivesInset}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pinned action bar */}
      <View style={st.footer}>
        <TouchableOpacity
          testID="rescue-confirm-btn"
          onPress={onConfirm}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={chosen ? `Free ${chosen.name}` : 'Free friend'}
          style={st.confirmBtn}
        >
          <GoldenKeyArt size={24} />
          <Text style={st.confirmBtnText}>
            {chosen ? `FREE ${chosen.name.toUpperCase()}!` : 'FREE FRIEND!'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="rescue-later-btn"
          onPress={onLater}
          activeOpacity={0.75}
          accessibilityRole="button"
          style={st.laterBtn}
        >
          <Text style={st.laterBtnText}>Save key for later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Phase 2: Key-Turn → Split-Cage Shatter → Joyous Leap Celebration
// ---------------------------------------------------------------------------

const RescueCelebration: React.FC<{
  fighter: CharacterName;
  currentFighter: CharacterName;
  location: string;
  reduced: boolean;
  onUse: () => void;
  onKeep: () => void;
}> = ({ fighter, currentFighter, location, reduced, onUse, onKeep }) => {
  const def = getFighter(fighter);
  const voice = companionVoice(fighter);
  const [freed, setFreed] = useState(reduced);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // [UI-23]: Web keyboard controls on celebration screen (Enter/Space play as rescued friend, Esc keep current)
  useKeyboardNav({
    enabled: true,
    priority: KEY_PRIORITY.OVERLAY,
    onConfirm: onUse,
    onCancel: onKeep,
  });

  // Animated values (strictly GPU transform + opacity)
  const keyY = useSharedValue(reduced ? 0 : 22);
  const keyRot = useSharedValue(0);
  const keyO = useSharedValue(reduced ? 0 : 1);

  const leftBarX = useSharedValue(0);
  const leftBarRot = useSharedValue(0);
  const rightBarX = useSharedValue(0);
  const rightBarRot = useSharedValue(0);
  const barsO = useSharedValue(reduced ? 0 : 1);

  const lockY = useSharedValue(0);
  const lockRot = useSharedValue(0);
  const lockO = useSharedValue(reduced ? 0 : 1);

  const ringScale = useSharedValue(0.5);
  const ringO = useSharedValue(0);

  const heroY = useSharedValue(0);
  const heroScale = useSharedValue(reduced ? 1 : 0.92);
  const heroO = useSharedValue(reduced ? 0 : 1);

  const d0O = useSharedValue(0);
  const d0Y = useSharedValue(reduced ? 0 : 12);
  const d1O = useSharedValue(0);
  const d1Y = useSharedValue(reduced ? 0 : 12);
  const d2O = useSharedValue(0);
  const d2Y = useSharedValue(reduced ? 0 : 12);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (reduced) {
      // Reduced motion: calm opacity cross-fade straight into settled unlocked state
      heroO.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS });
      d0O.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS });
      d1O.value = withDelay(40, withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
      d2O.value = withDelay(80, withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
      band.cue('friendRescued');
      return;
    }

    // 1. Key glides up into padlock (0 → KEY_SLIDE_MS)
    keyY.value = withTiming(0, { duration: KEY_SLIDE_MS, easing: EASE.enter });

    // 2. Mechanical seat (2 frames), then crank 90° (KEY_TURN_AT → BREAK_AT)
    keyRot.value = withDelay(KEY_TURN_AT, withTiming(90, { duration: KEY_TURN_MS, easing: EASE.ui }));
    timers.current.push(setTimeout(() => band.cue('keyFound'), KEY_TURN_AT));

    // 3. Key pops out cleanly right as cage bursts
    keyO.value = withDelay(BREAK_AT, withTiming(0, { duration: exitMs(MS.quick), easing: EASE.exitSoft }));

    // 4. HERO MOMENT (BREAK_AT): forged iron cage splits cleanly apart + padlock drops + one gold ring + friend leaps!
    leftBarX.value = withDelay(BREAK_AT, withTiming(-84, { duration: MS.move, easing: EASE.enter }));
    leftBarRot.value = withDelay(BREAK_AT, withTiming(-20, { duration: MS.move, easing: EASE.enter }));
    rightBarX.value = withDelay(BREAK_AT, withTiming(84, { duration: MS.move, easing: EASE.enter }));
    rightBarRot.value = withDelay(BREAK_AT, withTiming(20, { duration: MS.move, easing: EASE.enter }));
    barsO.value = withDelay(BREAK_AT + 70, withTiming(0, { duration: exitMs(MS.move), easing: EASE.exitSoft }));

    lockY.value = withDelay(BREAK_AT, withTiming(42, { duration: MS.quick, easing: EASE.exitSoft }));
    lockRot.value = withDelay(BREAK_AT, withTiming(24, { duration: MS.quick, easing: EASE.exitSoft }));
    lockO.value = withDelay(BREAK_AT, withTiming(0, { duration: MS.quick, easing: EASE.exitSoft }));

    ringO.value = withDelay(
      BREAK_AT,
      withSequence(
        withTiming(0.85, { duration: 48, easing: EASE.ui }),
        withTiming(0, { duration: MS.panel, easing: EASE.enterSoft })
      )
    );
    ringScale.value = withDelay(BREAK_AT, withTiming(1.85, { duration: MS.panel, easing: EASE.enterSoft }));

    // Freed friend leaps lightly on the exact cage-break frame (FighterAvatar's own
    // ecstatic reaction carries the full joyful hop, so keep wrapper lift restrained to avoid top-edge clipping)
    heroY.value = withDelay(
      BREAK_AT,
      withSequence(
        withTiming(-8, { duration: MS.feedback, easing: EASE.enter }),
        withSpring(0, SPRING.snappy)
      )
    );
    heroScale.value = withDelay(
      BREAK_AT,
      withSequence(
        withTiming(SCALE.pop, { duration: MS.feedback, easing: EASE.enter }),
        withSpring(1, SPRING.snappy)
      )
    );

    timers.current.push(
      setTimeout(() => {
        setFreed(true);
        band.cue('friendRescued');
      }, BREAK_AT)
    );

    // 5. Support details rise smoothly in order after the break
    d0O.value = withDelay(DETAIL_AT(0), withTiming(1, { duration: MS.quick, easing: EASE.ui }));
    d0Y.value = withDelay(DETAIL_AT(0), withTiming(0, { duration: MS.move, easing: EASE.enterSoft }));
    d1O.value = withDelay(DETAIL_AT(1), withTiming(1, { duration: MS.quick, easing: EASE.ui }));
    d1Y.value = withDelay(DETAIL_AT(1), withTiming(0, { duration: MS.move, easing: EASE.enterSoft }));
    d2O.value = withDelay(DETAIL_AT(2), withTiming(1, { duration: MS.quick, easing: EASE.ui }));
    d2Y.value = withDelay(DETAIL_AT(2), withTiming(0, { duration: MS.move, easing: EASE.enterSoft }));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // Run once per rescued fighter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fighter, reduced]);

  // Pre-break status line (fills the lower body during f0–f30 so there is zero empty black hole)
  const unlockingO = useSharedValue(reduced ? 0 : 1);
  useEffect(() => {
    if (reduced) return;
    unlockingO.value = withDelay(BREAK_AT - 40, withTiming(0, { duration: exitMs(MS.feedback), easing: EASE.exitSoft }));
  }, [reduced, unlockingO]);
  const unlockingStyle = useAnimatedStyle(() => ({ opacity: unlockingO.value }));

  const keyStyle = useAnimatedStyle(() => ({
    opacity: keyO.value,
    transform: [{ translateY: keyY.value }, { rotate: `${keyRot.value}deg` }],
  }));
  const leftBarStyle = useAnimatedStyle(() => ({
    opacity: barsO.value,
    transform: [{ translateX: leftBarX.value }, { rotate: `${leftBarRot.value}deg` }],
  }));
  const rightBarStyle = useAnimatedStyle(() => ({
    opacity: barsO.value,
    transform: [{ translateX: rightBarX.value }, { rotate: `${rightBarRot.value}deg` }],
  }));
  const lockStyle = useAnimatedStyle(() => ({
    opacity: lockO.value,
    transform: [{ translateY: lockY.value }, { rotate: `${lockRot.value}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringO.value,
    transform: [{ scale: ringScale.value }],
  }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroO.value,
    transform: [{ translateY: heroY.value }, { scale: heroScale.value }],
  }));
  const d0Style = useAnimatedStyle(() => ({ opacity: d0O.value, transform: [{ translateY: d0Y.value }] }));
  const d1Style = useAnimatedStyle(() => ({ opacity: d1O.value, transform: [{ translateY: d1Y.value }] }));
  const d2Style = useAnimatedStyle(() => ({ opacity: d2O.value, transform: [{ translateY: d2Y.value }] }));

  return (
    <ScrollView
      contentContainerStyle={st.celRoot}
      showsVerticalScrollIndicator={false}
      testID="rescue-celebration"
    >
      <View style={st.headerBadge}>
        <Text style={st.headerBadgeText}>
          {freed ? `FRIEND FREED · ${location.toUpperCase()}` : `GOLDEN KEY · ${location.toUpperCase()}`}
        </Text>
      </View>

      {/* Spotlight stage: cage + padlock + key + freed friend */}
      <View style={st.stage}>
        {/* Single golden shockwave ring */}
        <Animated.View pointerEvents="none" style={[st.shockRing, ringStyle]} />

        {/* Medallion backdrop */}
        <View style={[st.medallion, freed && st.medallionFreed]}>
          <Animated.View style={heroStyle}>
            <FighterAvatar
              testID="rescue-celebration-avatar"
              character={fighter}
              size={112}
              mood={freed ? 'victory' : 'urgent'}
              reaction={freed ? { type: 'ecstatic', id: 1 } : null}
              animate={!reduced}
            />
          </Animated.View>
        </View>

        {/* Split forged iron cage halves */}
        <Animated.View pointerEvents="none" style={[st.cageOverlay, leftBarStyle]}>
          <CageBarsSvg width={156} height={156} side="left" />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[st.cageOverlay, rightBarStyle]}>
          <CageBarsSvg width={156} height={156} side="right" />
        </Animated.View>

        {/* Brass padlock at bottom-center of cage */}
        <Animated.View pointerEvents="none" style={[st.lockAnchor, lockStyle]}>
          <CagePadlockSvg size={38} open={freed} />
        </Animated.View>

        {/* Golden Key gliding up into the lock and turning */}
        <Animated.View pointerEvents="none" style={[st.keyAnchor, keyStyle]}>
          <GoldenKeyArt size={50} />
        </Animated.View>
      </View>

      {/* Pre-break unlocking status occupies the heading slot while the key turns (zero empty hole) */}
      <View style={st.celHeadSlot}>
        {!reduced && (
          <Animated.View pointerEvents="none" style={[st.unlockingOverlay, unlockingStyle]}>
            <Text style={st.celEyebrow}>UNLOCKING CAGE…</Text>
            <Text style={st.celName}>{def.name}</Text>
            <Text style={st.celBlurb}>{def.blurb}</Text>
          </Animated.View>
        )}
        <Animated.View style={[st.celHead, d0Style]}>
          <Text style={st.celEyebrow}>RESCUED!</Text>
          <Text style={st.celName}>{def.name}</Text>
          <Text style={st.celBlurb}>{def.blurb}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[st.celDetails, d1Style]}>
        <CompanionBubble
          character={fighter}
          text={`${voice.hello} ${voice.cheer} Thanks for springing me!`}
          mood="victory"
          animate={false}
          avatarSize={34}
        />
        <FighterPassivesList fighter={fighter} style={st.celPassives} />
      </Animated.View>

      <Animated.View style={[st.celActions, d2Style]}>
        <TouchableOpacity
          testID="rescue-use-fighter"
          onPress={onUse}
          activeOpacity={0.85}
          accessibilityRole="button"
          style={st.confirmBtn}
        >
          <Text style={st.confirmBtnText}>PLAY AS {def.name.toUpperCase()}!</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="rescue-keep-fighter"
          onPress={onKeep}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={st.keepBtn}
        >
          <Text style={st.keepBtnText}>Keep {currentFighter}</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
};

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  backdrop: {
    backgroundColor: 'rgba(18, 17, 15, 0.84)',
  },
  frame: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '94%',
    backgroundColor: DARK.panel,
    borderRadius: 16,
    borderWidth: 2.5,
    borderBottomWidth: 6,
    borderColor: DARK.gold,
    overflow: 'hidden',
  },
  pickerRoot: {
    maxHeight: '100%',
  },
  header: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: DARK.goldEdge(0.22),
    backgroundColor: '#24221E',
    gap: 4,
  },
  keyCrest: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#342F22',
    borderWidth: 2,
    borderColor: DARK.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  headerBadge: {
    backgroundColor: DARK.gold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  headerBadgeText: {
    color: INK,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: COLORS.canvasWhite,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  subtitle: {
    color: DARK.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  list: {
    flexGrow: 0,
    maxHeight: 420,
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    padding: 10,
    gap: 8,
  },
  cardSelected: {
    backgroundColor: '#FFFCE6',
    borderColor: DARK.gold,
    borderWidth: 2.5,
    borderBottomWidth: 5,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cageThumb: {
    width: 66,
    height: 66,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cageThumbSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: INK,
  },
  miniLock: {
    position: 'absolute',
    bottom: 1,
    right: 2,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardName: {
    color: INK,
    fontSize: 16,
    fontWeight: '900',
  },
  selectedPill: {
    backgroundColor: DARK.gold,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  selectedPillText: {
    color: INK,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardBlurb: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  passivesInset: {
    marginTop: 0,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1.5,
    borderTopColor: DARK.goldEdge(0.22),
    backgroundColor: '#24221E',
    gap: 6,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DARK.gold,
    borderRadius: 10,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: INK,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  confirmBtnText: {
    color: INK,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  laterBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  laterBtnText: {
    color: DARK.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  // Celebration phase
  celRoot: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 12,
  },
  stage: {
    width: 176,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  shockRing: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 5,
    borderColor: DARK.gold,
  },
  medallion: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: '#2D2B27',
    borderWidth: 3,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionFreed: {
    backgroundColor: '#3A321C',
    borderColor: DARK.gold,
  },
  cageOverlay: {
    position: 'absolute',
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockAnchor: {
    position: 'absolute',
    bottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyAnchor: {
    position: 'absolute',
    bottom: -4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celHeadSlot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  celHead: {
    alignItems: 'center',
    gap: 3,
  },
  celEyebrow: {
    color: DARK.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  celName: {
    color: COLORS.canvasWhite,
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
  },
  celBlurb: {
    color: DARK.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  celDetails: {
    alignSelf: 'stretch',
    gap: 10,
  },
  celPassives: {
    backgroundColor: COLORS.paperBeige,
  },
  celActions: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 4,
  },
  keepBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: DARK.goldEdge(0.35),
    backgroundColor: '#2A2825',
  },
  keepBtnText: {
    color: DARK.text,
    fontSize: 13,
    fontWeight: '800',
  },
});

export default FriendRescueModal;
