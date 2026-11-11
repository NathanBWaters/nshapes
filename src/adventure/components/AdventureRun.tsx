/**
 * One fight. Wraps the shared GameBoard with the adventure HUD:
 * foe HP bar, hearts, moves/clock, coins, XP, challenge ticker, coach marks,
 * level-up picks and the between-wave shop.
 */
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GameBoard from '@/components/GameBoard';
import Icon from '@/components/Icon';
import { COLORS, getRarityColor } from '@/utils/colors';
import type { Card, CardReward, Weapon } from '@/types';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import { music, sfx } from '@/audio';
import type { AdventureSave, LevelDef, RunEvent, RunState } from '../types';
import { createRun, runReducer, shopPrice, rerollCost, xpForLevel, type RunAction } from '../engine/run';
import { challengeProgress } from '../engine/challenges';
import { MECHANICS } from '../data/mechanics';
import { getBiome } from '../data/biomes';
import { ABILITIES, ABILITY_TUNING } from '../data/abilities';
import { Btn, CoinPill, Eyebrow, Heart, INK, PopIn } from './ui';

const TICK_MS = 250;
const REPLACE_DELAY_MS = 950;

interface Props {
  level: LevelDef;
  save: AdventureSave;
  seed: number;
  autoPlayer?: boolean;
  onFinish: (run: RunState) => void;
  onQuit: () => void;
  onRestart: () => void;
  onCoachMarkSeen: (mechanicId: string) => void;
}

const SFX_FOR_EVENT: Partial<Record<RunEvent['type'], Parameters<typeof sfx>[0]>> = {
  hit: 'hit', rainbow: 'rainbow', hurt: 'hurt', coins: 'coin', levelup: 'levelup', heal: 'heart',
  foe_defeated: 'foeDefeated', wave: 'wave', regen: 'graceGain', time_stolen: 'back', shuffle: 'whoosh',
  nine_lives: 'heart', grudge_release: 'explosion', ability_ready: 'star2', freeze: 'freeze', redeal: 'whoosh', scoop: 'match',
};

/** A tip the player has to accept. The fight is paused while one is showing. */
interface Tip {
  id: string;
  title: string;
  text: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  anchor?: 'top' | 'bottom';
  /** e.g. "Tip 2 of 3" */
  label?: string;
}

// first-time tips keyed by the run event that triggers them
const COACH_BY_EVENT = Object.values(MECHANICS).reduce<Record<string, Tip>>((acc, m) => {
  if (m.coachMark) acc[m.coachMark.on] = { id: m.id, title: m.title, text: m.coachMark.text, icon: m.icon };
  return acc;
}, {});

const AdventureRun: React.FC<Props> = ({ level, save, seed, autoPlayer, onFinish, onQuit, onRestart, onCoachMarkSeen }) => {
  const insets = useSafeAreaInsets();
  const [run, dispatchRaw] = useReducer(runReducer, undefined, () => createRun(level, save, { seed }));
  const runRef = useRef(run);
  runRef.current = run;
  const dispatch = useCallback((a: RunAction) => dispatchRaw(a), []);
  const [paused, setPaused] = useState(false);
  const [hudHeight, setHudHeight] = useState(150);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [lastMatchTime, setLastMatchTime] = useState(Date.now());
  const [floaters, setFloaters] = useState<Array<{ id: number; text: string; color: string }>>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const tip = tips[0] ?? null;
  const pushTip = useCallback((t: Tip) => setTips(q => (q.some(x => x.id === t.id) ? q : [...q, t])), []);
  const seenCoach = useRef(new Set(save.seenCoachMarks));
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const biome = getBiome(level.biome);
  const ended = run.status === 'won' || run.status === 'lost';

  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);

  // Dev only: expose the live run so browser scripts can play end-to-end
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web') (window as unknown as { __nshapesRun?: RunState }).__nshapesRun = run;
  }, [run]);
  const later = (fn: () => void, ms: number) => {
    timeouts.current.push(setTimeout(fn, ms));
  };

  // Music: battle arrangement for this biome, boss arrangement for bosses
  useEffect(() => {
    music.play(level.isBoss ? 'boss' : biome.music);
  }, [level.isBoss, biome.music]);

  // Clock
  const playing = run.status === 'playing' && !paused && !tip;

  // First fight with a new mechanic: walk through its tips before anything moves
  useEffect(() => {
    const m = MECHANICS[level.introduces];
    const key = `start_${m.id}`;
    if (!m.fightTips?.length || seenCoach.current.has(key)) return;
    seenCoach.current.add(key);
    onCoachMarkSeen(key);
    const n = m.fightTips.length;
    m.fightTips.forEach((t, i) => pushTip({ id: `${key}_${i}`, title: t.title, text: t.text, icon: m.icon, anchor: t.anchor, label: n > 1 ? `Tip ${i + 1} of ${n}` : 'Tip' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => dispatch({ type: 'TICK', ms: TICK_MS }), TICK_MS);
    return () => clearInterval(iv);
  }, [playing, dispatch]);

  // Low-time tick sound
  const secondsLeft = run.timeLeft !== null ? Math.ceil(run.timeLeft) : null;
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft <= 5 && secondsLeft > 0 && run.status === 'playing') sfx('tick');
  }, [secondsLeft, run.status]);

  // Events → sfx, floating numbers, foe shake, coach marks
  const foeShake = useSharedValue(0);
  const foeScale = useSharedValue(1);
  const lastEventId = useRef(0);
  useEffect(() => {
    const fresh = run.events.filter(e => e.id > lastEventId.current);
    if (fresh.length === 0) return;
    lastEventId.current = fresh[fresh.length - 1].id;
    for (const e of fresh) {
      const s = SFX_FOR_EVENT[e.type];
      if (s) sfx(s);
      if (e.type === 'hit' || e.type === 'rainbow') {
        foeShake.value = withSequence(withTiming(-8, { duration: 40 }), withTiming(8, { duration: 60 }), withTiming(-4, { duration: 50 }), withTiming(0, { duration: 50 }));
        foeScale.value = withSequence(withTiming(0.9, { duration: 60 }), withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }));
        addFloater(e.type === 'rainbow' ? `RAINBOW −${e.amount}` : `−${e.amount}`, e.type === 'rainbow' ? '#9333EA' : COLORS.impactRed);
      }
      if (e.type === 'regen') addFloater(`+${e.amount}`, COLORS.logicTeal);
      if (e.type === 'combo') addFloater(`COMBO ×${e.amount}`, COLORS.impactOrange);
      if (e.type === 'grudge_release') addFloater(`GRUDGE +${e.amount}`, '#7A3E00');
      if (e.type === 'nine_lives') addFloater('NINE LIVES!', COLORS.logicTeal);
      if (e.type === 'scoop') {
        const ids = runRef.current.ability?.scooped ?? [];
        setLastMatchTime(Date.now());
        later(() => dispatch({ type: 'REPLACE', ids }), REPLACE_DELAY_MS);
      }
      if (e.type === 'ability_ready' && runRef.current.ability) {
        const def = ABILITIES[runRef.current.ability.id];
        const key = `ability_${def.id}`;
        if (!seenCoach.current.has(key)) {
          seenCoach.current.add(key);
          onCoachMarkSeen(key);
          pushTip({ id: key, title: `${def.name} is ready`, text: `${def.short} Tap the glowing button to use it.`, icon: def.icon, anchor: 'top' });
        }
      }
      if (e.type === 'coins') addFloater(`+${e.amount}¢`, '#B07D00');
      const cm = COACH_BY_EVENT[e.type];
      if (cm && !seenCoach.current.has(cm.id)) {
        seenCoach.current.add(cm.id);
        onCoachMarkSeen(cm.id);
        pushTip(cm);
      }
    }
    dispatch({ type: 'CLEAR_EVENTS', upTo: lastEventId.current - 20 });
  }, [run.events]); // eslint-disable-line react-hooks/exhaustive-deps

  const floaterSeq = useRef(0);
  const addFloater = (text: string, color: string) => {
    const id = ++floaterSeq.current;
    setFloaters(f => [...f.slice(-5), { id, text, color }]);
    later(() => setFloaters(f => f.filter(x => x.id !== id)), 1100);
  };

  // End of run → hand off to results after the finishing blow lands
  useEffect(() => {
    if (!ended) return;
    music.stop();
    sfx(run.status === 'won' ? 'victory' : 'gameOver');
    const t = setTimeout(() => onFinish(runRef.current), 1300);
    return () => clearTimeout(t);
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps

  // Board callbacks
  const handleMatch = useCallback((cards: Card[], rewards: CardReward[], effects?: WeaponEffectResult) => {
    setLastMatchTime(Date.now());
    dispatch({ type: 'MATCH', cards, rewards, effects });
    const ids = cards.map(c => c.id);
    later(() => dispatch({ type: 'REPLACE', ids }), REPLACE_DELAY_MS);
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInvalid = useCallback((cards: Card[]) => {
    dispatch({ type: 'INVALID', cards });
    const ids = cards.map(c => c.id);
    later(() => dispatch({ type: 'REPLACE', ids }), 520);
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBurn = useCallback((card: Card) => dispatch({ type: 'BURN', card }), [dispatch]);
  const handleUseHint = useCallback(() => {
    dispatch({ type: 'USE_HINT' });
    sfx('hint');
  }, [dispatch]);

  const foeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: foeShake.value }, { scale: foeScale.value }] }));
  const hpPct = run.foeMaxHp > 0 ? run.foeHp / run.foeMaxHp : 0;
  const challenge = challengeProgress(run);
  const ui = run.foe.getUIModifiers();
  const xpNeed = xpForLevel(run.xpLevel);

  return (
    <View style={[st.root, { backgroundColor: biome.colors.sky, paddingTop: insets.top }]}>
      {/* ── HUD ─────────────────────────────────────────── */}
      <View style={st.hud} onLayout={e => setHudHeight(e.nativeEvent.layout.height)}>
        <View style={st.hudTop}>
          <TouchableOpacity onPress={() => setPaused(true)} style={st.pauseBtn} accessibilityLabel="Pause">
            <Text style={st.pauseText}>II</Text>
          </TouchableOpacity>

          <Animated.View style={[st.foePortrait, level.isBoss && { backgroundColor: COLORS.actionYellow }, foeStyle]}>
            <Icon name={run.foeIcon} size={38} color={INK} />
          </Animated.View>

          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={st.foeName} numberOfLines={1}>{run.foeName}</Text>
              {level.foes.length > 1 && <Text style={st.wave}>WAVE {run.wave + 1}/{level.foes.length}</Text>}
            </View>
            <View style={st.hpTrack}>
              <View style={[st.hpFill, { width: `${Math.max(0, hpPct * 100)}%`, backgroundColor: hpPct > 0.5 ? COLORS.impactRed : hpPct > 0.25 ? COLORS.impactOrange : '#E53935' }]} />
              <Text style={st.hpText}>{run.foeHp} / {run.foeMaxHp}</Text>
            </View>
            {ui.showInactivityBar && (
              <View style={st.idleTrack}>
                <View style={[st.idleFill, { width: `${Math.min(100, (ui.showInactivityBar.current / ui.showInactivityBar.max) * 100)}%` }]} />
              </View>
            )}
          </View>

          {/* Floating damage numbers */}
          <View style={st.floaters} pointerEvents="none">
            {floaters.map(f => <Floater key={f.id} text={f.text} color={f.color} />)}
          </View>
        </View>

        <View style={st.hudRow}>
          <Hearts hearts={run.hearts} max={run.maxHearts} />
          {run.movesLeft !== null && (
            <View style={[st.stat, run.movesLeft <= 2 && st.statWarn]}>
              <Icon name="lorc/archery-target" size={16} color={INK} />
              <Text style={st.statText}>{run.movesLeft} moves</Text>
            </View>
          )}
          {secondsLeft !== null && (
            <View style={[st.stat, secondsLeft <= 10 && st.statWarn, ui.timerSpeedMultiplier && ui.timerSpeedMultiplier > 1 ? { borderColor: COLORS.impactOrange } : null]}>
              <Icon name="lorc/stopwatch" size={16} color={INK} />
              <Text style={st.statText}>{secondsLeft}s</Text>
            </View>
          )}
          {run.ability && <AbilityWidget run={run} onFire={() => dispatch({ type: 'ABILITY' })} />}
          {run.features.has('graces') && (
            <View style={st.stat}>
              <Icon name="lorc/clover" size={16} color={COLORS.logicTeal} />
              <Text style={st.statText}>{run.stats.graces}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {run.features.has('coins') && <CoinPill coins={run.coins} />}
          {run.features.has('hints') && (
            <TouchableOpacity
              testID="run-hint"
              onPress={() => run.stats.hints > 0 && !ui.disableManualHint && setHintTrigger(t => t + 1)}
              style={[st.hintBtn, (run.stats.hints <= 0 || ui.disableManualHint) && { opacity: 0.4 }]}
              accessibilityLabel="Use hint"
            >
              <Icon name="lorc/light-bulb" size={18} color={INK} />
              <Text style={st.statText}>{run.stats.hints}</Text>
            </TouchableOpacity>
          )}
        </View>

        {run.features.has('xp') && (
          <View style={st.xpTrack}>
            <View style={[st.xpFill, { width: `${(run.xp / xpNeed) * 100}%` }]} />
            <Text style={st.xpText}>LV {run.xpLevel + 1}</Text>
          </View>
        )}

        <View style={[st.challenge, challenge.met && { backgroundColor: '#D4F4EE' }, challenge.failed && { opacity: 0.55 }]}>
          <Text style={st.challengeStar}>★★★</Text>
          <Text style={[st.challengeText, challenge.failed && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{challenge.text}</Text>
          {challenge.met && <Icon name="lorc/checked-shield" size={14} color={COLORS.logicTeal} />}
        </View>
      </View>

      {/* ── Board ───────────────────────────────────────── */}
      <View style={st.boardWrap}>
        {!!run.ability?.frozenMs && (
          <View style={st.frozen} pointerEvents="none">
            <Icon name="lorc/snowflake-1" size={18} color="#1D4ED8" />
            <Text style={st.frozenText}>FROZEN {Math.ceil(run.ability.frozenMs / 1000)}s</Text>
          </View>
        )}
        <GameBoard
          cards={run.board}
          onMatch={handleMatch}
          onInvalidSelection={handleInvalid}
          playerStats={run.stats}
          weapons={run.weapons}
          isPlayerTurn={run.status === 'playing' && !paused && !tip}
          activeAttributes={run.attributes}
          onUseHint={handleUseHint}
          triggerHint={hintTrigger}
          onCardBurn={handleBurn}
          isPaused={!playing}
          lastMatchTime={lastMatchTime}
          autoPlayer={autoPlayer}
          enemy={run.foe}
          hideEnemyOverlay
        />
      </View>

      {/* Tip: pauses the fight until accepted. The part it talks about stays lit. */}
      {tip && !ended && (() => {
        const hudBottom = insets.top + hudHeight;
        const aboutHud = tip.anchor !== 'bottom';
        return (
          <>
            {/* dim everything except what the tip is pointing at */}
            <View style={[st.tipDim, aboutHud ? { top: hudBottom, bottom: 0 } : { top: 0, height: hudBottom }]} />
            <View style={[st.tipWrap, aboutHud ? { top: hudBottom + 2 } : { bottom: Math.max(insets.bottom, 12) + 8 }]} pointerEvents="box-none">
              {aboutHud && <View style={st.tipArrow} />}
              <View style={st.tipCard}>
                <View style={st.tipRule} />
                <View style={st.tipBody}>
                  <View style={st.tipHead}>
                    <View style={st.tipIcon}><Icon name={tip.icon} size={22} color={INK} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.tipEyebrow}>{tip.label ?? 'Tip'}</Text>
                      <Text style={st.tipTitle}>{tip.title}</Text>
                    </View>
                  </View>
                  <Text style={st.tipText}>{tip.text}</Text>
                  <TouchableOpacity testID="tip-ok" onPress={() => { sfx('click'); setTips(q => q.slice(1)); }} style={st.tipBtn} activeOpacity={0.85}>
                    <Text style={st.tipBtnText}>Got it</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        );
      })()}

      {/* Level-up pick */}
      {run.status === 'pick' && (
        <WeaponPick
          title="LEVEL UP!"
          subtitle="Pick one for this fight"
          options={run.pickOptions}
          onPick={w => { sfx('confirm'); dispatch({ type: 'PICK', weaponId: w.id }); }}
          onSkip={() => dispatch({ type: 'PICK', weaponId: null })}
        />
      )}

      {/* Between waves */}
      {run.status === 'intermission' && (
        <Intermission run={run} dispatch={dispatch} />
      )}

      {/* Pause */}
      <Modal visible={paused} transparent animationType="fade" onRequestClose={() => setPaused(false)}>
        <View style={st.overlay}>
          <PopIn style={st.panel}>
            <Text style={st.panelTitle}>PAUSED</Text>
            <Text style={st.panelSub}>{level.id} · {level.name}</Text>
            {run.weapons.length > 0 && (
              <View style={st.gearRow}>
                {run.weapons.map((w, i) => (
                  <View key={i} style={[st.gearChip, { borderColor: getRarityColor(w.rarity) }]}>
                    {w.icon && <Icon name={w.icon} size={16} color={INK} />}
                    <Text style={st.gearText} numberOfLines={1}>{w.name}</Text>
                  </View>
                ))}
              </View>
            )}
            <Btn label="Resume" onPress={() => setPaused(false)} />
            <Btn label="Restart" variant="secondary" onPress={() => { setPaused(false); onRestart(); }} />
            <Btn label="Retreat to map" variant="secondary" onPress={() => { setPaused(false); music.stop(); onQuit(); }} />
            <Text style={st.panelHint}>Retreating forfeits this attempt. Coins you've collected are still banked.</Text>
          </PopIn>
        </View>
      </Modal>
    </View>
  );
};

/** Fighter ability: active = charge button, passive = live status chip. */
const AbilityWidget: React.FC<{ run: RunState; onFire: () => void }> = ({ run, onFire }) => {
  const a = run.ability!;
  const def = ABILITIES[a.id];
  if (def.kind === 'active') {
    const ready = a.charge >= a.max && run.status === 'playing';
    return (
      <TouchableOpacity
        testID="run-ability"
        onPress={() => ready && onFire()}
        activeOpacity={0.85}
        accessibilityLabel={`${def.name}${ready ? ' ready' : ` ${a.charge} of ${a.max}`}`}
        style={[st.ability, ready && st.abilityReady]}
      >
        <Icon name={def.icon} size={18} color={INK} />
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {Array.from({ length: a.max }).map((_, i) => <View key={i} style={[st.pip, i < a.charge && st.pipOn]} />)}
        </View>
      </TouchableOpacity>
    );
  }
  let label = '';
  let lit = false;
  if (a.id === 'nine_lives') { label = a.spent ? 'used' : '1 life'; lit = !a.spent; }
  if (a.id === 'combo') {
    const live = a.combo > 0 && run.elapsedMs - run.lastMatchAtMs <= ABILITY_TUNING.comboWindowMs;
    label = live ? `×${a.combo}` : 'combo'; lit = live;
  }
  if (a.id === 'grudge') { label = a.grudge > 0 ? `+${a.grudge * ABILITY_TUNING.grudgeDamage}` : 'calm'; lit = a.grudge > 0; }
  return (
    <View style={[st.stat, lit && { backgroundColor: '#FFF1C7' }, !lit && { opacity: 0.6 }]} accessibilityLabel={`${def.name}: ${label}`}>
      <Icon name={def.icon} size={15} color={INK} />
      <Text style={st.statText}>{label}</Text>
    </View>
  );
};

const Hearts: React.FC<{ hearts: number | null; max: number | null }> = ({ hearts, max }) => {
  if (hearts === null || max === null) {
    return (
      <View style={st.stat}>
        <Heart />
        <Text style={st.statText}>∞</Text>
      </View>
    );
  }
  if (max > 6) {
    return (
      <View style={st.stat}>
        <Heart />
        <Text style={st.statText}>{hearts}/{max}</Text>
      </View>
    );
  }
  return (
    <View style={[st.stat, { gap: 1 }]} accessibilityLabel={`${hearts} of ${max} hearts`}>
      {Array.from({ length: max }).map((_, i) => (
        <Heart key={i} size={17} filled={i < hearts} />
      ))}
    </View>
  );
};

const Floater: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  const y = useSharedValue(0);
  const o = useSharedValue(1);
  useEffect(() => {
    y.value = withTiming(-46, { duration: 1000, easing: Easing.out(Easing.cubic) });
    o.value = withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 400 }));
  }, [y, o]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: o.value }));
  return <Animated.Text style={[st.floater, { color }, s]}>{text}</Animated.Text>;
};

export const WeaponPick: React.FC<{ title: string; subtitle: string; options: Weapon[]; onPick: (w: Weapon) => void; onSkip: () => void }> = ({ title, subtitle, options, onPick, onSkip }) => (
  <Modal visible transparent animationType="fade" onRequestClose={onSkip}>
    <View style={st.overlay}>
      <PopIn style={st.panel}>
        <Eyebrow text={title} />
        <Text style={st.panelSub}>{subtitle}</Text>
        {options.map((w, i) => (
          <TouchableOpacity key={`${w.id}-${i}`} testID={`pick-${i}`} onPress={() => onPick(w)} style={[st.pickCard, { borderColor: getRarityColor(w.rarity) }]} activeOpacity={0.85}>
            <View style={[st.pickIcon, { backgroundColor: COLORS.paperBeige }]}>{w.icon && <Icon name={w.icon} size={28} color={INK} />}</View>
            <View style={{ flex: 1 }}>
              <Text style={st.pickName}>{w.name} <Text style={[st.pickRarity, { color: getRarityColor(w.rarity) === COLORS.rarityCommon ? '#8E877D' : getRarityColor(w.rarity) }]}>{w.rarity.toUpperCase()}</Text></Text>
              <Text style={st.pickDesc}>{w.shortDescription}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <Btn label="Skip" variant="ghost" small onPress={onSkip} />
      </PopIn>
    </View>
  </Modal>
);

const Intermission: React.FC<{ run: RunState; dispatch: (a: RunAction) => void }> = ({ run, dispatch }) => {
  const hasShop = run.features.has('shop');
  const next = run.level.foes[run.wave + 1];
  return (
    <Modal visible transparent animationType="fade">
      <View style={st.overlay}>
        <PopIn style={st.panel}>
          <Eyebrow text={`Wave ${run.wave + 1} cleared!`} color="#9BE3D8" />
          <Text style={st.panelTitle}>{hasShop ? 'SHOP' : 'Catch your breath'}</Text>
          {hasShop && (
            <>
              <Text style={st.panelSub}>Buy gear for this fight, or bank every coin for Camp.</Text>
              <CoinPill coins={run.coins} style={{ alignSelf: 'center' }} />
              <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
                {run.shopOptions.map((w, i) => {
                  const price = shopPrice(w);
                  const afford = run.coins >= price;
                  return (
                    <TouchableOpacity key={`${w.id}-${i}`} onPress={() => { if (afford) { sfx('coin'); dispatch({ type: 'BUY', index: i }); } }} style={[st.pickCard, { borderColor: getRarityColor(w.rarity), opacity: afford ? 1 : 0.5 }]} activeOpacity={0.85}>
                      <View style={st.pickIcon}>{w.icon && <Icon name={w.icon} size={26} color={INK} />}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.pickName}>{w.name}</Text>
                        <Text style={st.pickDesc}>{w.shortDescription}</Text>
                      </View>
                      <CoinPill coins={price} />
                    </TouchableOpacity>
                  );
                })}
                {run.shopOptions.length === 0 && <Text style={st.panelSub}>Sold out!</Text>}
              </ScrollView>
              <Btn small variant="secondary" label={`Reroll (${rerollCost(run)}¢)`} disabled={run.coins < rerollCost(run)} onPress={() => dispatch({ type: 'REROLL' })} />
            </>
          )}
          {next && <Text style={st.panelSub}>Next: {next.name ?? next.enemy} · {next.hp} HP</Text>}
          <Btn testID="next-wave" label="Next wave" icon="lorc/crossed-swords" onPress={() => { sfx('wave'); dispatch({ type: 'NEXT_WAVE' }); }} />
        </PopIn>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  root: { flex: 1 },
  hud: { backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, gap: 6 },
  hudTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pauseBtn: { width: 34, height: 34, borderRadius: 6, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  pauseText: { fontWeight: '900', color: INK, letterSpacing: -1 },
  foePortrait: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderBottomWidth: 5, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  foeName: { fontWeight: '900', fontSize: 15, color: INK, flexShrink: 1 },
  wave: { fontWeight: '900', fontSize: 11, color: INK, letterSpacing: 1 },
  hpTrack: { height: 20, borderRadius: 4, borderWidth: 2, borderColor: INK, backgroundColor: '#F1E9E0', overflow: 'hidden', justifyContent: 'center' },
  hpFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  hpText: { textAlign: 'center', fontWeight: '900', fontSize: 11, color: INK, fontVariant: ['tabular-nums'] },
  idleTrack: { height: 5, borderRadius: 3, backgroundColor: '#EEE', overflow: 'hidden' },
  idleFill: { height: '100%', backgroundColor: COLORS.impactOrange },
  floaters: { position: 'absolute', left: 100, top: 0, alignItems: 'flex-start' },
  floater: { position: 'absolute', fontWeight: '900', fontSize: 20, textShadowColor: '#FFF', textShadowRadius: 4 },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  statWarn: { backgroundColor: '#FFE1DE', borderColor: COLORS.impactRed },
  statText: { fontWeight: '900', color: INK, fontSize: 13, fontVariant: ['tabular-nums'] },
  hintBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, backgroundColor: COLORS.actionYellow },
  xpTrack: { height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.paperBeige, overflow: 'hidden', justifyContent: 'center' },
  xpFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#7AC8FF' },
  xpText: { fontSize: 9, fontWeight: '900', color: INK, textAlign: 'center' },
  ability: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 2, borderBottomWidth: 3, borderColor: '#B8B0A4', backgroundColor: COLORS.paperBeige },
  abilityReady: { borderColor: INK, backgroundColor: '#9BE3D8' },
  pip: { width: 6, height: 10, borderRadius: 2, backgroundColor: '#D9D2C7' },
  pipOn: { backgroundColor: COLORS.logicTeal },
  frozen: { position: 'absolute', top: 10, alignSelf: 'center', zIndex: 60, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#1D4ED8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  frozenText: { fontWeight: '900', color: '#1D4ED8', letterSpacing: 1 },
  challenge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.paperBeige, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  challengeStar: { color: '#E0A800', fontSize: 11, fontWeight: '900' },
  challengeText: { flex: 1, fontSize: 12, fontWeight: '700', color: INK },
  boardWrap: { flex: 1, padding: 6 },
  tipDim: { position: 'absolute', left: 0, right: 0, zIndex: 299, backgroundColor: 'rgba(10,10,10,0.5)' },
  tipWrap: { position: 'absolute', left: 0, right: 0, zIndex: 300, alignItems: 'center', paddingHorizontal: 12 },
  tipArrow: { width: 18, height: 18, backgroundColor: COLORS.actionYellow, transform: [{ rotate: '45deg' }], marginBottom: -11, alignSelf: 'flex-start', marginLeft: 70 },
  tipCard: { width: '100%', maxWidth: 460, backgroundColor: '#1C1B19', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,222,0,0.4)', overflow: 'hidden' },
  tipRule: { height: 4, backgroundColor: COLORS.actionYellow },
  tipBody: { padding: 16, gap: 12 },
  tipHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: COLORS.actionYellow, alignItems: 'center', justifyContent: 'center' },
  tipEyebrow: { color: COLORS.actionYellow, fontWeight: '800', letterSpacing: 2, fontSize: 10, textTransform: 'uppercase' },
  tipTitle: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 20 },
  tipText: { color: '#F1ECE4', fontSize: 16, lineHeight: 23 },
  tipBtn: { backgroundColor: COLORS.actionYellow, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  tipBtnText: { color: INK, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,18,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 420, backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 7, borderColor: INK, padding: 18, gap: 10 },
  panelTitle: { fontSize: 24, fontWeight: '900', color: INK, textAlign: 'center' },
  panelSub: { fontSize: 14, color: INK, textAlign: 'center', opacity: 0.85 },
  panelHint: { fontSize: 12, color: INK, opacity: 0.6, textAlign: 'center' },
  gearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  gearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, maxWidth: 160 },
  gearText: { fontSize: 11, fontWeight: '800', color: INK },
  pickCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2.5, borderBottomWidth: 4, borderRadius: 10, padding: 10, backgroundColor: COLORS.canvasWhite },
  pickIcon: { width: 46, height: 46, borderRadius: 8, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  pickName: { fontWeight: '900', color: INK, fontSize: 15 },
  pickRarity: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pickDesc: { fontSize: 13, color: INK, opacity: 0.85 },
});

export default AdventureRun;
