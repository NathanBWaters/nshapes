/**
 * Unlock reveal — every new fighter or weapon gets its own full-screen moment:
 * a silhouette on a field of light, a tap to reveal, then a card explaining
 * exactly how the new thing works and a button to start using it.
 *
 * Motion (review: docs/motion/reviews/unlock-reveal.md): the dark screen comes up,
 * then the medallion. The tap winds the medallion in (SCALE.windup), it turns edge-on
 * like a card and comes round showing the reward (the swap happens on the edge, never
 * in sight), lands with one accent ring and its sound; then the name, the companion and
 * the card rise in after it, and only then does the new fighter act. No flash.
 * Reduced motion: the faces cross-fade, nothing turns, rays stand still.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, withSpring, Easing, cancelAnimation, runOnJS, ReduceMotion } from 'react-native-reanimated';
import { EASE, exitMs, MS, SCALE, SPRING, STAGGER } from '@/utils/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { useAppActive } from '@/hooks/useAppActive';
import { COLORS } from '@/utils/colors';
import { band, sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId, UnlockableFeature } from '../types';
import { charmSlots, equippedArcanaOf, equippedCharms, weaponBuilds, type Unlock } from '../progress';
import { getFighter } from '../data/fighters';
import { getPassive } from '../data/passives';
import { getArcana } from '../data/arcana';
import { getArmoryWeapon } from '../data/armory';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { CAMPAIGN_FEATURES } from '../data/features';
import { LEVELS, getLevel } from '../data/levels';
import { levelFoe } from '../data/foes';
import { isFighterTrial } from '../data/rewards';
import { MECHANICS, getMechanic } from '../data/mechanics';
import { DARK, INK } from './ui';
import { describeUnlock } from './rewards';
import { evolutionsMechanicId } from '../lessons';
import { companionVoice } from '../coach';
import CompanionBubble from './CompanionBubble';
import { REVEAL_EXIT_MS } from './ResultsMotion';

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

const GOLD = DARK.gold;
const TEXT = DARK.text;
const MUTED = DARK.muted;

/** Weapon text was written for score-based modes. In Adventure a point is a point of damage. */
const adventureText = (t: string) => t.replace(/\+(\d+) points?/g, '+$1 damage');

/** The tap winds the medallion in for this long, then it turns */
const WINDUP_MS = MS.feedback;
/** Each half of the turn (to edge-on, and back round) */
const TURN_MS = MS.feedback;
/** Held edge-on for 2 frames: the face is swapped here, out of sight */
const EDGE_HOLD_MS = 32;
/** About when the face is swapped: by the turn itself, on the frame it is edge-on (inside the hold) */
const SWAP_MS = WINDUP_MS + TURN_MS + 16;
/** The reward has come round to full width (the spring takes ~7 frames from edge-on): its ring and its sound land here */
const LAND_MS = WINDUP_MS + TURN_MS + EDGE_HOLD_MS + 144;
/**
 * The words follow the medallion: name, companion, then the card with the buttons.
 * After the first unlock of a row the player knows the rhythm: the words come tighter.
 */
const detailAt = (k: number, quick = false) => LAND_MS + (quick ? 60 : 100) + k * (quick ? STAGGER.card : STAGGER.item);
/** The revealed creature starts acting once its name is up */
const ACT_MS = detailAt(3) + MS.move;
/** Next unlock: the words leave while the medallion turns back edge-on */
const LEAVE_MS = exitMs(MS.quick);

/** Opening: the dark screen, then the headline, then the medallion */
const OPEN_TEXT_MS = MS.quick - 40;
const OPEN_HERO_MS = OPEN_TEXT_MS + 80;

/** Rises into place `delay` ms after it mounts (remount it with a key to play again). Reduced motion: fades. */
/** Fades still play under reduced motion (Reanimated would otherwise jump them to the end): they carry the meaning */
const KEEP = ReduceMotion.Never;

const Rise: React.FC<{ delay: number; reduced: boolean; style?: object; children: React.ReactNode }> = ({ delay, reduced, style, children }) => {
  const o = useSharedValue(0);
  const y = useSharedValue(reduced ? 0 : 14);
  useEffect(() => {
    o.value = withDelay(reduced ? Math.round(delay / 3) : delay, withTiming(1, { duration: MS.quick, easing: EASE.ui, reduceMotion: KEEP }), KEEP);
    if (!reduced) y.value = withDelay(delay, withTiming(0, { duration: MS.move, easing: EASE.enter }));
  }, [delay, reduced, o, y]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
};

const Rays: React.FC<{ color: string; still: boolean }> = ({ color, still }) => {
  const appActive = useAppActive();
  const rot = useSharedValue(0);
  useEffect(() => {
    if (!appActive || still) {
      cancelAnimation(rot);
      return;
    }
    rot.value = 0;
    rot.value = withRepeat(withTiming(360, { duration: 26000, easing: Easing.linear }), -1);
    return () => cancelAnimation(rot);
  }, [appActive, still, rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  return (
    <Animated.View style={[st.rays, style]} pointerEvents="none">
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={i} style={[st.ray, { backgroundColor: color, transform: [{ rotate: `${i * 15}deg` }] }]} />
      ))}
    </Animated.View>
  );
};

interface Props {
  unlocks: Unlock[];
  save: AdventureSave;
  onUseFighter: (name: CharacterName) => void;
  onEquipCharm: (id: string) => void;
  onSwapCharm?: (replaceId: string, withId: string) => void;
  onEquipArcana?: (id: ArcanaId) => void;
  /** Go to the screen a newly unlocked feature lives on (offered on the last reveal only) */
  onOpenFeature?: (feature: UnlockableFeature) => void;
  /** Go and look at a secret path on the map (offered on the last reveal only) */
  onShowPath?: (levelId: string) => void;
  /** Jump straight into Starfall Summit when unlocked (offered on the last reveal only) */
  onOpenSummit?: () => void;
  onDone: () => void;
}

const UnlockReveal: React.FC<Props> = ({ unlocks, save, onUseFighter, onEquipCharm, onSwapCharm, onEquipArcana, onOpenFeature, onShowPath, onOpenSummit, onDone }) => {
  // (read from the context, so the reveal also stands alone where there is no safe-area provider)
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  /** The revealed creature acts only once its name is up (its leap must not compete with the turn) */
  const [acting, setActing] = useState(false);
  const backdrop = useSharedValue(0);
  const opened = useSharedValue(0);
  const press = useSharedValue(1);
  const turn = useSharedValue(1);
  /** Reduced motion: the medallion's face cross-fades instead of turning */
  const face = useSharedValue(1);
  /** The words on screen (headline, details, buttons) leaving for the next unlock */
  const leave = useSharedValue(1);
  /** Closing: the medallion sinks (0→1) as the dark lifts */
  const sink = useSharedValue(0);
  /** 1 while closing: the medallion then fades with the words (with or without reduced motion) */
  const closing = useSharedValue(0);
  const [exiting, setExiting] = useState(false);
  const ring = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const revealing = useRef(false);
  const soundPlayed = useRef(false);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    clearTimers();
    setI(0);
    setRevealed(false);
    setActing(false);
    setExiting(false);
    sink.value = 0;
    closing.value = 0;
    press.value = 1;
    turn.value = 1;
    face.value = 1;
    leave.value = 1;
    revealing.current = false;
    soundPlayed.current = false;
    // The dark screen first, then what is on it: no words over the results' words
    backdrop.value = 0;
    backdrop.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, reduceMotion: KEEP });
    opened.value = reduced ? 1 : 0;
    if (!reduced) opened.value = withDelay(OPEN_HERO_MS, withSpring(1, SPRING.lively));
  }, [unlocks]); // eslint-disable-line react-hooks/exhaustive-deps

  // A weapon the player already owns growing a level is good news, not a mystery: it is shown at once.
  // (After a boss a dozen of these can arrive together; a tap to unwrap each one made the win drag.)
  const current = unlocks[i];
  const isLevelUp = current?.kind === 'weapon' && current.level !== undefined;
  useEffect(() => {
    if (isLevelUp) {
      setRevealed(true);
      setActing(true);
    }
  }, [i, isLevelUp]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  // The medallion arrives from 0.7 on a lively spring; its fade is flat and quick (opacity never bounces)
  const openStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, opened.value * 2.5) * (closing.value > 0 ? leave.value : 1),
    transform: [{ translateY: sink.value * 48 }, { scale: 0.7 + 0.3 * opened.value }],
  }));
  const leaveStyle = useAnimatedStyle(() => ({ opacity: leave.value }));
  const heroStyle = useAnimatedStyle(() => ({ opacity: face.value, transform: [{ scale: press.value }, { scaleX: turn.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value <= 0 || ring.value >= 1 ? 0 : 0.85 * (1 - ring.value),
    transform: [{ scale: 0.95 + ring.value * 0.75 }],
  }));

  const u = unlocks[i];
  if (!u) return null;

  const display = describeUnlock(u);
  const { icon, accent } = display;
  const fighter = u.kind === 'fighter' ? getFighter(u.name) : null;
  const w = u.kind === 'weapon' ? getArmoryWeapon(u.id, weaponBuilds(save)) : null;
  const arcana = u.kind === 'arcana' ? getArcana(u.id) : null;
  const evo = u.kind === 'evolution' ? EVOLUTION_RECIPES.find(r => r.id === u.id) ?? null : null;
  const feature = u.kind === 'feature' ? CAMPAIGN_FEATURES[u.feature] : null;
  const path = u.kind === 'path' ? getLevel(u.levelId) : null;
  const isSummit = u.kind === 'summit';
  const last = i + 1 >= unlocks.length;
  // Offered only when it is the final reveal, so the remaining ones are not skipped
  const openFeature = feature?.open && last && onOpenFeature ? feature.open : null;
  // A fighter with a trial still to play learns its passives there, so the reveal stays short
  const trial = fighter && !save.seenMechanics.includes(fighter.signature)
    ? LEVELS.find(l => l.branchOf && l.introduces === fighter.signature) ?? null
    : null;
  const evoId = evolutionsMechanicId();
  const evoMechanic = evo && evoId ? MECHANICS[evoId] : null;

  // A weapon is introduced by its own voice, a recipe by its fanfare: on the frame the reward lands
  const playUnlockSound = () => {
    if (soundPlayed.current) return;
    soundPlayed.current = true;
    if (u.kind === 'weapon') band.audition(u.id);
    else if (u.kind === 'evolution') band.auditionEvolution(u.id);
    else sfx('unlock');
  };

  /** Unlock CTA responsiveness the instant the face swaps (`SWAP_MS`), never locking until `ACT_MS` ([OB-06]). */
  const onSwapVisible = () => {
    setRevealed(true);
    revealing.current = false;
  };

  /** Tapping again during the 0–256ms turn snaps immediately to revealed so zero taps are swallowed. */
  const snapReveal = () => {
    clearTimers();
    cancelAnimation(press);
    cancelAnimation(turn);
    cancelAnimation(face);
    press.value = 1;
    turn.value = 1;
    face.value = 1;
    setRevealed(true);
    setActing(true);
    revealing.current = false;
    playUnlockSound();
  };

  const reveal = () => {
    if (revealed) return;
    if (revealing.current) {
      snapReveal();
      return;
    }
    revealing.current = true;
    soundPlayed.current = false;
    if (reduced) {
      // The faces cross-fade through the dark: no wind-up, no turn, no ring
      face.value = withSequence(
        KEEP,
        withTiming(0, { duration: MS.feedback, easing: EASE.ui, reduceMotion: KEEP }, finished => { if (finished) runOnJS(onSwapVisible)(); }),
        withTiming(1, { duration: MS.quick, easing: EASE.ui, reduceMotion: KEEP })
      );
      later(MS.feedback + 16, () => { onSwapVisible(); playUnlockSound(); });
      later(MS.feedback + MS.quick, () => setActing(true));
      return;
    }
    // Wind in, turn edge-on (EASE.impact: it speeds into the edge), hold, swap the face, come round on a spring
    press.value = withSequence(
      withTiming(SCALE.windup, { duration: WINDUP_MS, easing: EASE.ui }),
      withDelay(TURN_MS + EDGE_HOLD_MS, withSpring(1, SPRING.lively))
    );
    turn.value = withDelay(
      WINDUP_MS,
      withSequence(
        // Swapped by the turn itself once it is edge-on, so the old face is never seen to change
        withTiming(0, { duration: TURN_MS, easing: EASE.impact }, finished => { if (finished) runOnJS(onSwapVisible)(); }),
        withDelay(EDGE_HOLD_MS, withSpring(1, SPRING.lively))
      )
    );
    ring.value = 0;
    ring.value = withDelay(LAND_MS, withTiming(1, { duration: MS.move, easing: EASE.enter }));
    // Unlock CTA right at SWAP_MS (256ms) so the footer CTA is 100% live the moment it rises into view!
    later(SWAP_MS, onSwapVisible);
    later(LAND_MS, playUnlockSound);
    later(ACT_MS, () => setActing(true));
  };

  const goNext = (next: number) => {
    // Whatever the last reveal still had scheduled (its creature's act) belongs to it, not to the next one
    clearTimers();
    setRevealed(false);
    setActing(false);
    setI(next);
    leave.value = 1;
    // The next silhouette comes round from edge-on, the way the last reward went
    if (!reduced) turn.value = withDelay(EDGE_HOLD_MS / 2, withSpring(1, SPRING.lively));
    face.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, reduceMotion: KEEP });
    revealing.current = false;
    soundPlayed.current = false;
  };
  const claimAll = () => {
    if (exiting) return;
    clearTimers();
    cancelAnimation(press);
    cancelAnimation(turn);
    cancelAnimation(face);
    cancelAnimation(leave);
    cancelAnimation(backdrop);
    revealing.current = true;
    setExiting(true);
    sfx('unlock');
    onDone();
  };
  const advance = () => {
    // Cancel pending reveal timers immediately so stale setActing/sound callbacks never fire after advancing
    clearTimers();
    if (i + 1 >= unlocks.length) {
      // The way out: the words go first, the medallion sinks back into the results as the dark lifts,
      // then the results take over (their rows turn over into what was just won)
      if (revealing.current) return;
      revealing.current = true;
      setExiting(true);
      closing.value = 1;
      leave.value = withTiming(0, { duration: LEAVE_MS, easing: EASE.exitSoft, reduceMotion: KEEP });
      if (!reduced) {
        press.value = withTiming(0.6, { duration: REVEAL_EXIT_MS, easing: EASE.exitSoft });
        sink.value = withTiming(1, { duration: REVEAL_EXIT_MS, easing: EASE.exitSoft });
      }
      backdrop.value = withDelay(LEAVE_MS, withTiming(0, { duration: REVEAL_EXIT_MS - LEAVE_MS, easing: EASE.exitSoft, reduceMotion: KEEP }, f => { if (f) runOnJS(onDone)(); }), KEEP);
      return;
    }
    if (revealing.current) return;
    revealing.current = true;
    const next = i + 1;
    // The words leave (quick, flat) while the reward turns back edge-on; the next one is swapped in on the edge
    leave.value = withTiming(0, { duration: LEAVE_MS, easing: EASE.exitSoft, reduceMotion: KEEP });
    if (reduced) {
      face.value = withTiming(0, { duration: LEAVE_MS, easing: EASE.ui, reduceMotion: KEEP }, finished => { if (finished) runOnJS(goNext)(next); });
      return;
    }
    turn.value = withTiming(0, { duration: TURN_MS, easing: EASE.impact }, finished => { if (finished) runOnJS(goNext)(next); });
  };

  const charmEquipped = u.kind === 'weapon' && equippedCharms(save).includes(u.id);
  const charmsFull = equippedCharms(save).length >= charmSlots(save);
  const arcanaEquipped = u.kind === 'arcana' && equippedArcanaOf(save).includes(u.id);
  const sourceLabel = path ? 'Secret' : isSummit ? 'New mode' : u.star === 0 ? 'Bounty reward' : `${'★'.repeat(u.star)} reward`;
  return (
    <Modal visible transparent animationType="none">
      {/* Closing, it no longer takes taps: the results' buttons are usable from the first frame of the way out */}
      <View testID="unlock-modal" pointerEvents={exiting ? 'none' : 'auto'} style={[st.overlay, { paddingTop: insets.top }]}>
        <Animated.View style={[StyleSheet.absoluteFill, st.backdrop, backdropStyle]} pointerEvents="none" />
        {unlocks.length > 1 && !exiting && (
          <View style={[st.topActions, { top: Math.max(insets.top, 8) + 6 }]}>
            <TouchableOpacity
              testID="unlock-claim-all"
              onPress={claimAll}
              style={st.claimAllBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Claim all ${unlocks.length - i} remaining rewards`}
            >
              <Text style={st.claimAllText}>Claim All ({unlocks.length - i})</Text>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView contentContainerStyle={st.scroll} bounces={false}>
          <Animated.View style={leaveStyle}>
          <Rise key={`heads-${i}`} delay={i === 0 ? OPEN_TEXT_MS : 0} reduced={reduced} style={st.heads}>
            <Text style={st.eyebrow}>{sourceLabel}{unlocks.length > 1 ? `  ·  ${i + 1} of ${unlocks.length}` : ''}</Text>
            <Text style={st.headline}>{display.headline}</Text>
          </Rise>
          </Animated.View>

          <Animated.View style={[st.heroWrap, openStyle]}>
            <Rays color={accent} still={reduced} />
            <Animated.View pointerEvents="none" style={[st.revealRing, { borderColor: accent }, ringStyle]} />
            <Animated.View style={[st.hero, { borderColor: accent, backgroundColor: revealed ? COLORS.canvasWhite : '#151413' }, heroStyle]} onTouchEnd={revealed ? undefined : reveal}>
              {revealed && fighter ? (
                <FighterAvatar
                  testID="unlock-revealed-fighter"
                  character={fighter.name}
                  size={116}
                  mood="victory"
                  reaction={acting ? { type: 'ecstatic', id: i + 1 } : null}
                  interactive
                />
              ) : revealed && w ? (
                <WeaponAvatar
                  testID="unlock-revealed-weapon"
                  weapon={w}
                  size={108}
                  interactive
                />
              ) : revealed && path ? (
                <EnemyAvatar testID="unlock-revealed-path" enemy={levelFoe(path)} size={108} mood="idle" reaction={acting ? { type: 'entrance', id: i + 1 } : null} interactive />
              ) : (
                <Icon name={icon} size={92} color={revealed ? INK : '#050505'} />
              )}
              {!revealed && <Text style={st.heroQ}>?</Text>}
            </Animated.View>
          </Animated.View>

          {!revealed ? (
            <Rise key={`tease-${i}`} delay={i === 0 ? OPEN_HERO_MS + MS.feedback : MS.feedback} reduced={reduced}>
              <Text style={st.tease}>{display.tease}</Text>
            </Rise>
          ) : (
            <Animated.View key={`detail-${i}`} style={[{ alignSelf: 'stretch', gap: 12, alignItems: 'center' }, leaveStyle]}>
              <Rise delay={isLevelUp ? 0 : detailAt(0, i > 0) - SWAP_MS} reduced={reduced} style={{ alignItems: 'center', gap: 4 }}>
                <Text style={st.name}>{display.name}</Text>
                {display.badge && <Text style={[st.rarity, { color: accent }]}>{display.badge}</Text>}
              </Rise>

              <Rise delay={isLevelUp ? STAGGER.item : detailAt(1, i > 0) - SWAP_MS} reduced={reduced} style={{ alignSelf: 'stretch' }}>
              <CompanionBubble
                character={fighter ? fighter.name : save.selectedFighter}
                tone="dark"
                mood="victory"
                avatarSize={38}
                text={
                  fighter
                    ? `${companionVoice(fighter.name).hello} I’m ${fighter.name}. Pick me whenever you like!`
                    : isSummit
                      ? `${companionVoice(save.selectedFighter).cheer} Starfall Summit is open — climb where the star fell!`
                      : u.kind === 'weapon' && u.firstWeapon
                        ? `${companionVoice(save.selectedFighter).cheer} Our first weapon! I clipped it on. It fires by itself.`
                        : `${companionVoice(save.selectedFighter).cheer} Look what we won!`
                }
                style={{ alignSelf: 'stretch' }}
              />
              </Rise>

              <Rise delay={isLevelUp ? 2 * STAGGER.item : detailAt(2, i > 0) - SWAP_MS} reduced={reduced} style={{ alignSelf: 'stretch' }}>
              <View style={st.card}>
                <Text style={st.cardTitle}>{path ? 'What is it?' : 'How it works'}</Text>
                {path && (
                  <>
                    <Text style={st.rowBody}>
                      {path.rules.sandbox
                        ? getMechanic(path.introduces).body[0]
                        : isFighterTrial(path)
                          ? `A side level built around one fighter: ${getMechanic(path.introduces).title}. It is optional and has its own stars and rewards.`
                          : `An optional fight against ${levelFoe(path).name}: tougher than the main path, with its own stars and better loot.`}
                    </Text>
                    {path.rules.sandbox && <Text style={st.rowBody}>{getMechanic(path.introduces).body[2]}</Text>}
                    <Text style={st.note}>It was not on the map until now. Secret paths only show up once you earn them.</Text>
                  </>
                )}
                {fighter && (trial ? (
                  <>
                    <Text style={st.rowBody}>
                      Plays by two passives: {fighter.passives.map(id => getPassive(id).name).join(' & ')}.
                    </Text>
                    <Text style={st.note}>Their trial, {trial.id} {trial.name}, now hangs off the map: it teaches both passives.</Text>
                  </>
                ) : (
                  <>
                    {fighter.passives.map(id => {
                      const p = getPassive(id);
                      return (
                        <View key={id} style={st.row}>
                          <View style={st.rowIcon}><Icon name={p.icon} size={22} color={INK} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={st.rowTitle}>{p.name} <Text style={st.rowTag}>ALWAYS ON</Text></Text>
                            <Text style={st.rowBody}>{p.text}</Text>
                          </View>
                        </View>
                      );
                    })}
                    <Text style={st.note}>Spend stars in {fighter.name}'s skill tree at Camp to grow these passives.</Text>
                  </>
                ))}
                {w && (
                  <>
                    {u.kind === 'weapon' && u.level !== undefined && (
                      <Text style={[st.rowBody, { color: '#5EEAD4' }]}>
                        Level {u.level}: {w.shortDescription}
                      </Text>
                    )}
                    <Text style={st.rowBody}>{adventureText(w.description)}</Text>
                    {/* The very first weapon: one plain sentence is enough */}
                    {w.flavorText && !(u.kind === 'weapon' && u.firstWeapon) ? <Text style={st.note}>{adventureText(w.flavorText)}</Text> : null}
                    {u.kind === 'weapon' && u.firstWeapon && (
                      <View style={st.charmBox}>
                        <Text style={st.rowTitle}>Already on your belt</Text>
                        <Text style={st.rowBody}>Nothing to press: it fires by itself as you make Sets.</Text>
                      </View>
                    )}
                    {charmsFull && !charmEquipped && onSwapCharm && (
                      <View style={st.charmBox} testID="unlock-swap-box">
                        <Text style={st.rowTitle}>Swap onto your belt now:</Text>
                        <View style={st.swapRow}>
                          {equippedCharms(save).map(equippedId => {
                            const equippedWeapon = getArmoryWeapon(equippedId, weaponBuilds(save));
                            if (!equippedWeapon) return null;
                            return (
                              <TouchableOpacity
                                key={equippedId}
                                testID={`unlock-swap-${equippedId}`}
                                onPress={() => {
                                  band.audition(w.id);
                                  onSwapCharm(equippedId, w.id);
                                }}
                                style={st.swapBtn}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={`Swap ${equippedWeapon.name} out for ${w.name}`}
                              >
                                <WeaponAvatar weapon={equippedWeapon} size={24} />
                                <Text style={st.swapBtnText}>Swap {equippedWeapon.name}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </>
                )}
                {evo && (
                  <>
                    <Text style={[st.rowBody, { color: '#5EEAD4' }]}>Armed by: {evo.familyText}</Text>
                    <Text style={st.rowBody}>For 30 seconds: {evo.activeText}</Text>
                    <Text style={st.note}>{evo.flavor}</Text>
                    {u.kind === 'evolution' && u.firstEvolution && evoMechanic && (
                      <View style={st.charmBox}>
                        <Text style={st.rowTitle}>How evolutions work</Text>
                        {evoMechanic.body.map((p, k) => <Text key={k} style={st.rowBody}>{p}</Text>)}
                      </View>
                    )}
                  </>
                )}
                {feature && getMechanic(feature.mechanic).body.map((p, k) => (
                  <Text key={k} style={st.rowBody}>{p}</Text>
                ))}
                {feature?.id === 'coins' && (
                  <Text style={[st.rowBody, { color: '#FCD34D', fontWeight: '800' }]}>
                    Your purse already holds {save.coins.toLocaleString()}¢ from your Star Shards!
                  </Text>
                )}
                {arcana && (
                  <>
                    <Text style={st.rowBody}>{arcana.tagline}</Text>
                    <Text style={[st.rowBody, { color: '#5EEAD4' }]}>▲ {arcana.upside}</Text>
                    <Text style={[st.rowBody, { color: '#FCD34D' }]}>▼ {arcana.tradeoff}</Text>
                    <Text style={st.note}>Equip or remove Arcana anytime at Camp or on the level preview sheet.</Text>
                  </>
                )}
                {isSummit && (
                  <>
                    <Text style={[st.rowBody, { color: '#5EEAD4', fontWeight: '800' }]}>
                      Starfall Summit Unlocked — climb where the star fell!
                    </Text>
                    <Text style={st.rowBody}>
                      Draft Armory weapons, forge Evolutions, parry bosses, and push into Endless across a 3-Act roguelike climb.
                    </Text>
                    <Text style={st.note}>Now unlocked on the Main Menu whenever you want a fresh run.</Text>
                  </>
                )}
              </View>
              </Rise>
            </Animated.View>
          )}
        </ScrollView>

        {/* What to do with it: always in reach, whatever the screen size */}
        <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          {!revealed ? (
            <Rise key={`reveal-${i}`} delay={i === 0 ? OPEN_HERO_MS + MS.feedback : MS.feedback} reduced={reduced} style={st.footerInner}>
            <TouchableOpacity testID="unlock-reveal" onPress={reveal} style={st.cta} activeOpacity={0.85}>
              <Text style={st.ctaText}>Reveal</Text>
            </TouchableOpacity>
            </Rise>
          ) : (
            <Animated.View style={[st.footerInner, leaveStyle]}>
            <Rise key={`act-${i}`} delay={isLevelUp ? 2 * STAGGER.item : detailAt(2, i > 0) - SWAP_MS} reduced={reduced} style={st.footerInner}>
        {fighter && (
          <>
            <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); onUseFighter(fighter.name); advance(); }} style={st.cta} activeOpacity={0.85}>
              <Text style={st.ctaText}>Fight as {fighter.name}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={advance} style={st.secondary}>
              <Text style={st.secondaryText}>Keep {save.selectedFighter} for now</Text>
            </TouchableOpacity>
          </>
        )}
        {w && (
          charmEquipped || charmsFull ? (
            <>
              {!charmEquipped && <Text style={st.note}>Your charm slots are full. Swap charms on the level preview or at Camp.</Text>}
              <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
                <Text style={st.ctaText}>{charmEquipped ? 'Equipped ✓  Continue' : 'Continue'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); onEquipCharm(w.id); advance(); }} style={st.cta} activeOpacity={0.85}>
                <Text style={st.ctaText}>Equip as charm</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={advance} style={st.secondary}>
                <Text style={st.secondaryText}>Leave it in the Armory</Text>
              </TouchableOpacity>
            </>
          )
        )}
        {evo && (
          <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
            <Text style={st.ctaText}>{last ? 'Awesome!' : 'Continue'}</Text>
          </TouchableOpacity>
        )}
        {feature && (
          openFeature ? (
            <>
              <TouchableOpacity
                testID="unlock-primary"
                onPress={() => {
                  sfx('confirm');
                  onDone();
                  onOpenFeature?.(feature.id);
                }}
                style={st.cta}
                activeOpacity={0.85}
              >
                <Text style={st.ctaText}>{openFeature.label}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={advance} style={st.secondary}>
                <Text style={st.secondaryText}>Stay on results</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
              <Text style={st.ctaText}>{last ? 'Awesome!' : 'Continue'}</Text>
            </TouchableOpacity>
          )
        )}
        {path && (
          last && onShowPath ? (
            <>
              <TouchableOpacity
                testID="unlock-primary"
                onPress={() => { sfx('confirm'); onDone(); onShowPath(path.id); }}
                style={st.cta}
                activeOpacity={0.85}
              >
                <Text style={st.ctaText}>Show me on the map</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="unlock-later" onPress={advance} style={st.secondary}>
                <Text style={st.secondaryText}>Later</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
              <Text style={st.ctaText}>Continue</Text>
            </TouchableOpacity>
          )
        )}
        {arcana && (
          arcanaEquipped ? (
            <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
              <Text style={st.ctaText}>Equipped ✓  Continue</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                testID="unlock-primary"
                onPress={() => { sfx('confirm'); onEquipArcana?.(arcana.id); advance(); }}
                style={st.cta}
                activeOpacity={0.85}
              >
                <Text style={st.ctaText}>Equip {arcana.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={advance} style={st.secondary}>
                <Text style={st.secondaryText}>Keep current rules for now</Text>
              </TouchableOpacity>
            </>
          )
        )}
        {isSummit && (
          last && onOpenSummit ? (
            <>
              <TouchableOpacity
                testID="unlock-primary"
                onPress={() => { sfx('confirm'); onDone(); onOpenSummit(); }}
                style={st.cta}
                activeOpacity={0.85}
              >
                <Text style={st.ctaText}>Climb Starfall Summit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={advance} style={st.secondary}>
                <Text style={st.secondaryText}>Stay on results</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
              <Text style={st.ctaText}>{last ? 'Awesome!' : 'Continue'}</Text>
            </TouchableOpacity>
          )
        )}
            </Rise>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  // Opaque: whatever is behind it (the results screen) would only be noise
  overlay: { flex: 1 },
  backdrop: { backgroundColor: '#0B0B0C' },
  topActions: { position: 'absolute', right: 14, zIndex: 20 },
  claimAllBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: DARK.goldEdge(0.5),
    backgroundColor: 'rgba(28,27,25,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimAllText: { color: GOLD, fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  // Top-aligned, so the headline and the medallion stay put when the details arrive under them
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'flex-start', padding: 20, paddingTop: 54, paddingBottom: 12, gap: 12, maxWidth: 460, width: '100%', alignSelf: 'center' },
  footer: { alignSelf: 'center', width: '100%', maxWidth: 460, minHeight: 74, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  footerInner: { alignSelf: 'stretch', gap: 4, alignItems: 'center' },
  heads: { alignItems: 'center', gap: 12 },
  revealRing: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 4 },
  eyebrow: { color: GOLD, fontWeight: '800', letterSpacing: 2.5, fontSize: 12, textTransform: 'uppercase' },
  headline: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 28, textAlign: 'center' },
  heroWrap: { width: 210, height: 200, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  rays: { position: 'absolute', width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 5, height: 240, opacity: 0.16, borderRadius: 3 },
  hero: { width: 150, height: 150, borderRadius: 75, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  heroQ: { position: 'absolute', color: GOLD, fontSize: 64, fontWeight: '900' },
  tease: { color: MUTED, fontSize: 16, textAlign: 'center' },
  name: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 30, textAlign: 'center' },
  rarity: { fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  card: { alignSelf: 'stretch', backgroundColor: DARK.panel, borderRadius: 12, borderWidth: 1, borderColor: DARK.goldEdge(0.3), padding: 14, gap: 12 },
  cardTitle: { color: GOLD, fontWeight: '800', letterSpacing: 2, fontSize: 11, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 16, flexShrink: 1 },
  rowTag: { color: MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  rowBody: { color: TEXT, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  note: { color: MUTED, fontSize: 13, fontStyle: 'italic', flexShrink: 1 },
  charmBox: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 10, gap: 6 },
  swapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1.5, borderColor: DARK.goldEdge(0.5), borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
  swapBtnText: { color: COLORS.canvasWhite, fontWeight: '800', fontSize: 13, flexShrink: 1 },
  cta: { alignSelf: 'stretch', backgroundColor: GOLD, borderRadius: 8, paddingVertical: 15, alignItems: 'center' },
  ctaText: { color: INK, fontWeight: '900', fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
  secondary: { paddingVertical: 8 },
  secondaryText: { color: MUTED, fontWeight: '700', textDecorationLine: 'underline' },
});

export default UnlockReveal;
