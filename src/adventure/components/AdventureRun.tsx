/**
 * One fight. Wraps the shared GameBoard with the adventure HUD:
 * foe HP bar with running damage / combo / biggest-hit counters, hearts,
 * moves/clock, coins, XP, live passive chips, the weapon belt, evolution
 * rings, challenge ticker, coach marks, level-up picks and the between-wave shop.
 *
 * What happens in the fight is SHOWN by the effects stage (src/adventure/fx):
 * every fresh event becomes a beat of a cascade that plays over the HUD and
 * the board, and the fight clock stands still while it plays.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import Animated, { cancelAnimation, useSharedValue, useAnimatedStyle, withDelay, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GameBoard from '@/components/GameBoard';
import Icon, { type IconName } from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { useAppActive } from '@/hooks/useAppActive';
import { useEnemyConductor } from '@/hooks/useEnemyConductor';
import { useFighterConductor } from '@/hooks/useFighterConductor';
import { COLORS } from '@/utils/colors';
import { recordComponentRender, registerInterval } from '@/utils/perfWatchdog';
import type { Card, CardReward, CharacterName, Weapon } from '@/types';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import { band, music, sfx } from '@/audio';
import { moodOf, playSounds, soundsFor } from '@/audio/fightAudio';
import type { AdventureSave, EvolutionRecipe, FeatureFlag, LevelDef, PassiveId, RunEventType, RunState } from '../types';
import type { WeaponBuilds } from '../data/weaponStats';
import { createRun, runReducer, shopPrice, rerollCost, xpForLevel, type RunAction, type RunOverrides } from '../engine/run';
import { boardHasCounterSet } from '../engine/parry';
import { FightRecorder, type FightTape } from '../engine/replay';
import { challengeProgress } from '../engine/challenges';
import { GearChips, gearModifiers, hasGearChips } from './GearChips';
import { MECHANICS } from '../data/mechanics';
import { getBiome } from '../data/biomes';
import { FIGHTERS } from '../data/fighters';
import { foeDisplay } from '../data/foes';
import { comboWindowFor, getPassive, DEFAULT_COMBO_WINDOW_MS, PASSIVE_TUNING } from '../data/passives';
import { getArcana } from '../data/arcana';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { SURGE_RULES } from '../data/rules';
import { weaponLevelSuffix } from '../data/armory';
import { COACH_KEYS } from '../progress';
import { checksOfSet, computeLiveGuidance, describeSingleCardTraits, explainInvalidPick, fightRemarks, shouldShowDamageNumbers, shouldShowPassiveHud, showsTraitChecks, traitAddedBy } from '../coach';
import StageBubble from './StageBubble';
import TraitChecks, { TRAIT_CHECKS_HEIGHT } from './TraitChecks';
import { EVOLUTION_RULES } from '../engine/sources';
import { Anchor, AnchorsProvider, EVENT_FX, EvolutionCutIn, FxStage, GearBelt, KillCamOverlay, MultiplierIgnition, fxClock, scriptFor, useAnchors, useFightFx, type Beat } from '../fx';
import { Banner } from '../fx/visuals';
import { Btn, CoinPill, DARK, Eyebrow, Heart, INK, PopIn, TONE } from './ui';
import { EvolutionBanner, EvolutionRing, MegaFlash } from './RunFx';
import WeaponExplainer from './WeaponExplainer';
import PowerMeter from './PowerMeter';
import PowerExplainer from './PowerExplainer';
import HudInspector, { type HudInspectTarget } from './HudInspector';
import ParryIntentBar from './ParryIntentBar';
import { WeaponOfferRow } from './SharedCards';

const TICK_MS = 250;
/** A Set's cards are thrown at the foe, then the next ones are dealt: long enough to see the throw, short enough to keep moving */
const REPLACE_DELAY_MS = 560;

/** How long the foe's taunt is up as a fight (or a wave) opens, before your fighter speaks */
const FOE_TAUNT_MS = 2400;

/** How long the checks of the Set just made stay up (they also go as soon as the next card is picked) */
const LAST_SET_MS = 3200;

/**
 * The battle stage (fighter on the left, foe on the right) takes whatever
 * height the board does not need: tall on a nine-card board, where the fight
 * can be the star of the screen, compact once the board fills up (`min`, or
 * `minWide` on a window at least `wideFrom` wide). From `roomy` up, the words
 * get a row of their own (`speechPx`: two lines) above the two of them.
 * `chromePx` is roughly what the rest of the HUD takes.
 *
 * Its height is fixed for the fight: what is said never changes it, so the
 * board never moves. (A line too long for its room spills over the stage's
 * edge by a few pixels rather than pushing anything.)
 */
const STAGE = { min: 66, minWide: 104, wideFrom: 700, max: 184, chromePx: 132, roomy: 136, speechPx: 60 } as const;

/** Mode-agnostic HUD & pause chrome overrides so any higher-level mode can wrap AdventureRun. */
export interface FightChromeOptions {
  /** Replaces the 3-star challenge strip with a custom status banner (e.g. Act/Floor label) */
  statusBanner?: { icon: IconName; text: string; testID?: string };
  /** Subtitle line shown in the Pause modal */
  pauseSubtitle?: string;
  /** Always show damage, Power & passive chips regardless of campaign progression */
  alwaysShowHudStats?: boolean;
  /** Disable mid-fight Restart button (e.g. roguelike stakes) */
  allowRestart?: boolean;
  quitLabel?: string;
  quitHint?: string;
}

interface Props {
  level: LevelDef;
  save: AdventureSave;
  seed: number;
  autoPlayer?: boolean;
  onFinish: (run: RunState, tape: FightTape) => void;
  /** The player retreated or restarted: the fight as it stood */
  onQuit: (run: RunState, tape: FightTape) => void;
  onRestart: (run: RunState, tape: FightTape) => void;
  onCoachMarkSeen: (mechanicId: string) => void;
  /** Play the fight's effects (and hold the clock while they play). Off: numbers only, nothing waits. */
  effects?: boolean;
  onToggleEffects?: () => void;
  /** Optional engine overrides (persistent HP, uncapped loadout, custom weapon builds) */
  runOverrides?: RunOverrides;
  /** Optional explicit feature set (defaults to campaign progression for `level`) */
  featuresOverride?: Set<FeatureFlag>;
  /** Optional mode-agnostic HUD & pause chrome overrides */
  chrome?: FightChromeOptions;
}

/** The recipe an evolution event is about (the engine names it by id or by name). */
const recipeFor = (key: string | undefined): EvolutionRecipe | undefined =>
  key ? EVOLUTION_RECIPES.find(r => r.id === key || r.name === key) : undefined;

/** A tip the player has to accept. The fight is paused while one is showing. */
interface Tip {
  id: string;
  title: string;
  text: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  anchor?: 'top' | 'bottom';
  /** e.g. "Tip 2 of 3" */
  label?: string;
  /** The tip is about this fighter's own passives: shown only while playing them */
  fighter?: CharacterName;
}

/** First-time tips for each run event (several mechanics may wait on the same event). */
const COACH_BY_EVENT = new Map<RunEventType, Tip[]>();
for (const m of Object.values(MECHANICS)) {
  if (!m.coachMark) continue;
  const tip: Tip = { id: COACH_KEYS.event(m.id), title: m.title, text: m.coachMark.text, icon: m.icon, fighter: FIGHTERS.find(f => f.signature === m.id)?.name };
  COACH_BY_EVENT.set(m.coachMark.on, [...(COACH_BY_EVENT.get(m.coachMark.on) ?? []), tip]);
}

const AdventureRun: React.FC<Props> = ({
  level,
  save,
  seed,
  autoPlayer,
  onFinish,
  onQuit,
  onRestart,
  onCoachMarkSeen,
  effects = true,
  onToggleEffects,
  runOverrides,
  featuresOverride,
  chrome,
}) => {
  recordComponentRender('AdventureRun');
  const insets = useSafeAreaInsets();
  const appActive = useAppActive();
  // The save the fight started from and every action sent to it: enough to replay the fight (engine/replay.ts)
  const [startSave] = useState(save);
  const [run, setRun] = useState(() =>
    createRun(level, startSave, {
      seed,
      ...(featuresOverride ? { features: featuresOverride } : {}),
      ...(runOverrides ? { overrides: runOverrides } : {}),
    })
  );
  const runRef = useRef(run);
  runRef.current = run;
  const recorder = useRef(new FightRecorder(seed));
  // Reduce here, synchronously, so each recorded action is paired with exactly the state it was applied to
  const dispatch = useCallback((a: RunAction) => {
    const before = runRef.current;
    recorder.current.record(a, before);
    const next = runReducer(before, a);
    runRef.current = next;
    if (next !== before) setRun(next);
  }, []);
  const recordingOf = useCallback((): FightTape => ({
    recording: recorder.current.toJSON(),
    save: startSave,
    choices: recorder.current.choicesJSON(),
  }), [startSave]);
  const [paused, setPaused] = useState(false);
  const [hudHeight, setHudHeight] = useState(150);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [lastMatchTime, setLastMatchTime] = useState(Date.now());
  const [megaFlash, setMegaFlash] = useState(0);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  /** A weapon on the belt the player tapped to read about (the fight waits) */
  const [inspect, setInspect] = useState<Weapon | null>(null);
  /** The Power meter in the header was tapped to read about Power (the fight waits) */
  const [powerInfo, setPowerInfo] = useState(false);
  /** Another HUD chip/bar/goal was tapped to inspect (the fight waits) */
  const [hudInspect, setHudInspect] = useState<HudInspectTarget | null>(null);
  /** The first evolution ever: its cut-in also points at the countdown ring */
  const [evolutionHint, setEvolutionHint] = useState(false);
  const [boardSelectedCount, setBoardSelectedCount] = useState(0);
  const [boardSelectedCards, setBoardSelectedCards] = useState<Card[]>([]);
  const [mistakeNote, setMistakeNote] = useState<string | null>(null);
  const [mistakeCards, setMistakeCards] = useState<Card[] | null>(null);
  // The Set just made: the companion shows why it was one, trait by trait, until the next pick (coach.ts)
  const [lastSet, setLastSet] = useState<Card[] | null>(null);
  const [coachDismissed, setCoachDismissed] = useState(false);
  const [eventBannerNote, setEventBannerNote] = useState<string | null>(null);
  const anchors = useAnchors();
  const [tips, setTips] = useState<Tip[]>([]);
  const tip = tips[0] ?? null;
  const pushTip = useCallback((t: Tip) => setTips(q => (q.some(x => x.id === t.id) ? q : [...q, t])), []);
  const seenCoach = useRef(new Set(save.seenCoachMarks));
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const biome = getBiome(level.biome);
  const ended = run.status === 'won' || run.status === 'lost';
  /** A practice fight never ends by itself: the player leaves with Done */
  const practice = !!level.rules.sandbox;

  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);

  // The foe speaks first: its taunt, as the fight (and each wave) opens. Then your fighter has the stage.
  const taunt = level.rules.sandbox ? undefined : level.foes[run.wave]?.taunt;
  const [taunting, setTaunting] = useState(!!taunt);
  useEffect(() => {
    if (!taunt) {
      setTaunting(false);
      return;
    }
    setTaunting(true);
    const t = setTimeout(() => setTaunting(false), FOE_TAUNT_MS);
    return () => clearTimeout(t);
  }, [run.wave, taunt]);

  // If the player starts picking right away, cede the stage to live guidance at once
  useEffect(() => {
    if (taunting && (boardSelectedCount > 0 || run.matches > 0)) {
      setTaunting(false);
    }
  }, [taunting, boardSelectedCount, run.matches]);

  // The bell: a banner across the board as the fight opens (taps pass through it)
  const [opening, setOpening] = useState(true);
  useEffect(() => {
    // (rung a moment in, once the band has taken the stage)
    const bell = setTimeout(() => {
      if (!level.rules.sandbox) band.cue('wave');
    }, 260);
    const t = setTimeout(() => setOpening(false), 1500);
    return () => {
      clearTimeout(bell);
      clearTimeout(t);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dev only: expose the live run so browser scripts can play end-to-end
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web') (window as unknown as { __nshapesRun?: RunState }).__nshapesRun = run;
  }, [run]);
  // Dev only: `__nshapesFx.slow = 8` plays the effects in slow motion
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web') (window as unknown as { __nshapesFx?: typeof fxClock }).__nshapesFx = fxClock;
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    timeouts.current.push(setTimeout(fn, ms));
  }, []);

  // Music: the band follows the fight (src/audio/director.ts says what each state sounds like).
  // Battle arrangement for this biome, boss arrangement for bosses.
  const arrangement = level.isBoss ? 'boss' : biome.music;
  const timeTotal = useRef(run.timeLeft);
  const moodNow = (r: RunState, halted: boolean) =>
    moodOf(r, { arrangement, paused: halted, timeTotal: timeTotal.current, glassWindowMs: gearModifiers(r).glassWindowMs });
  useEffect(() => {
    band.enterFight(moodNow(runRef.current, false));
    return () => band.leaveFight();
  }, [arrangement]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (run.status === 'won' || run.status === 'lost') return;
    if (band.inFight) band.setMood(moodNow(run, paused || Boolean(tip) || Boolean(inspect) || powerInfo || Boolean(hudInspect)));
  }, [run, paused, tip, inspect, powerInfo, hudInspect]); // eslint-disable-line react-hooks/exhaustive-deps

  const halted = paused || Boolean(tip) || Boolean(inspect) || powerInfo || Boolean(hudInspect);
  const playing = run.status === 'playing' && !halted;

  // Auto-pause active timed fights whenever the user leaves the app/tab
  useEffect(() => {
    if (!appActive && run.status === 'playing' && !practice) {
      setPaused(true);
    }
  }, [appActive, run.status, practice]);

  // Zero blocking start-of-fight popups: guidance is shown live above the board while you play!
  useEffect(() => {
    const m = MECHANICS[level.introduces];
    if (m) {
      const key = COACH_KEYS.fightStart(m.id);
      if (!seenCoach.current.has(key)) {
        seenCoach.current.add(key);
        onCoachMarkSeen(key);
      }
    }
    if (practice) {
      const msg = 'Practice yard! Test any gear — tap DONE when ready.';
      setEventBannerNote(msg);
      later(() => setEventBannerNote(prev => (prev === msg ? null : prev)), 4500);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Low-time tick sound
  const secondsLeft = run.timeLeft !== null ? Math.ceil(run.timeLeft) : null;
  const hasHearts = run.hearts !== null && run.maxHearts !== null && run.maxHearts > 0;
  const fighterHealth = hasHearts ? run.hearts! : (run.status === 'lost' ? 0 : 3);
  const fighterMaxHealth = hasHearts ? run.maxHearts! : 3;
  const conductor = useFighterConductor({
    health: fighterHealth,
    maxHealth: fighterMaxHealth,
    remainingTime: secondsLeft ?? undefined,
    score: run.foeMaxHp - run.foeHp,
    targetScore: run.foeMaxHp,
    isActiveRound: playing,
  });
  const fighterMood = run.status === 'won' ? 'victory' : run.status === 'lost' ? 'defeat' : conductor.mood;

  const ui = run.foe.getUIModifiers();
  const inactivityRatio = ui.showInactivityBar
    ? ui.showInactivityBar.current / Math.max(1, ui.showInactivityBar.max)
    : 0;
  const enemyConductor = useEnemyConductor({
    enemyName: run.foeName,
    hp: run.foeHp,
    maxHp: run.foeMaxHp,
    isBoss: level.isBoss,
    inactivityRatio,
    isActiveCombat: playing,
  });
  const enemyMood = run.status === 'lost' ? 'victory' : enemyConductor.mood;

  const {
    triggerEntrance,
    triggerMatch,
    triggerMistake,
    triggerHint,
    setSelectedCount,
    setIsBoardIdle,
  } = conductor;
  const { triggerReaction: triggerEnemyReaction } = enemyConductor;
  useEffect(() => {
    triggerEntrance();
    triggerEnemyReaction('entrance');
  }, [triggerEntrance, triggerEnemyReaction]);

  // A beat of the cascade reached its target: the HUD reacts
  const foeShake = useSharedValue(0);
  const foeScale = useSharedValue(1);
  const screenShake = useSharedValue(0);
  const onLand = (beat: Beat) => {
    const { row, tier } = beat;
    if (row.shake) {
      foeShake.value = withSequence(withTiming(-8, { duration: 40 }), withTiming(8, { duration: 60 }), withTiming(-4, { duration: 50 }), withTiming(0, { duration: 50 }));
      foeScale.value = withSequence(withTiming(0.9, { duration: 60 }), withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }));
    }
    if (tier >= 2) {
      const amp = tier === 3 ? 10 : 6;
      screenShake.value = withSequence(withTiming(-amp, { duration: 40 }), withTiming(amp, { duration: 60 }), withTiming(-amp / 2, { duration: 50 }), withTiming(amp / 2, { duration: 50 }), withTiming(0, { duration: 50 }));
    }
    if (tier === 3) setMegaFlash(f => f + 1);
    switch (row.fighter) {
      case 'ecstatic': conductor.triggerReaction('ecstatic'); break;
      case 'pain': conductor.triggerReaction('pain'); break;
      case 'heal': conductor.triggerHeal(); break;
      case 'powerup': conductor.triggerPowerup(); break;
      case 'entrance': triggerEntrance(); break;
    }
    switch (row.enemy) {
      case 'criticalHit': triggerEnemyReaction('crit_pain'); break;
      case 'hit': triggerEnemyReaction('pain'); break;
      case 'gloat': triggerEnemyReaction('taunt'); break;
      case 'attack': triggerEnemyReaction('attack'); break;
      case 'regen': triggerEnemyReaction('regen'); break;
      case 'entrance': triggerEnemyReaction('entrance'); break;
    }
  };

  // The stage plays each move as a cascade; the band plays each stretch of it as it starts, in step with it
  const fx = useFightFx({
    anchors,
    reduced: !effects,
    onSegment: segment =>
      playSounds(soundsFor(segment.events, { weapons: runRef.current.weapons.map(w => w.id), combo: runRef.current.combo }), segment.stride),
    onLand,
  });

  // The fight clock stands still while a cascade plays, a cut-in waits, or the app is backgrounded
  const ticking = appActive && playing && !fx.busy;
  useEffect(() => {
    if (!ticking) return;
    const stopTrack = registerInterval('AdventureRun.clock');
    const iv = setInterval(() => dispatch({ type: 'TICK', ms: TICK_MS }), TICK_MS);
    return () => {
      clearInterval(iv);
      stopTrack();
    };
  }, [ticking, dispatch]);

  // Fresh events → a script for the stage, and first-time coach marks
  const lastEventId = useRef(0);
  useEffect(() => {
    const fresh = run.events.filter(e => e.id > lastEventId.current);
    if (fresh.length === 0) return;
    lastEventId.current = fresh[fresh.length - 1].id;
    // The cards of the Set itself are still in their slots: hand them to the stage so it can throw them at the foe
    const thrownIds = new Set(run.replacing);
    const staged = fresh.map(e =>
      (e.type === 'hit' && !e.text || e.type === 'rainbow' || e.type === 'surge_hit') && e.slots && !e.cards
        ? { ...e, cards: e.slots.map(i => (run.board[i] && thrownIds.has(run.board[i].id) && (run.board[i].health ?? 1) <= 1 && !run.board[i].stay ? run.board[i] : null)) }
        : e
    );
    fx.play(scriptFor(staged, { weapons: run.weapons, gridMs: band.gridMs, reduced: !effects }));
    for (const e of fresh) {
      if (e.type === 'evolution_start' && !seenCoach.current.has(COACH_KEYS.evolution)) {
        seenCoach.current.add(COACH_KEYS.evolution);
        onCoachMarkSeen(COACH_KEYS.evolution);
        const recipe = recipeFor(e.text);
        // With effects on, the cut-in itself explains the evolution
        if (effects) setEvolutionHint(true);
        else {
          pushTip({
            id: COACH_KEYS.evolution,
            title: `${recipe?.name ?? 'Evolution'} is live!`,
            text: `For ${EVOLUTION_RULES.durationMs / 1000} seconds: ${recipe?.activeText ?? 'your evolved rules are on.'} Every Set also deals ×${EVOLUTION_RULES.setMultiplier} and +${EVOLUTION_RULES.setDamage}. The ring by the HP bar shows the time left.`,
            icon: recipe?.icon ?? 'lorc/crystal-shine',
            anchor: 'top',
            label: 'Evolution',
          });
        }
      }
      if (e.type === 'power_up' && !seenCoach.current.has(COACH_KEYS.weaponGrowth)) {
        seenCoach.current.add(COACH_KEYS.weaponGrowth);
        onCoachMarkSeen(COACH_KEYS.weaponGrowth);
        const msg = 'Charm grew stronger for this fight! Tap your belt to see how.';
        setEventBannerNote(msg);
        later(() => setEventBannerNote(prev => (prev === msg ? null : prev)), 4500);
      }
      for (const cm of COACH_BY_EVENT.get(e.type) ?? []) {
        // A fighter's own tip is for that fighter (everyone chains Combos; only Sly Fox is paid for them)
        if (cm.fighter && cm.fighter !== run.fighter) continue;
        if (seenCoach.current.has(cm.id)) continue;
        seenCoach.current.add(cm.id);
        onCoachMarkSeen(cm.id);
        // Show reactive tips in the live non-blocking coach banner instead of freezing the board
        setEventBannerNote(cm.text);
        later(() => setEventBannerNote(prev => (prev === cm.text ? null : prev)), 4500);
      }
    }
    dispatch({ type: 'CLEAR_EVENTS', upTo: lastEventId.current - 20 });
  }, [run.events]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where everything is on screen can change with the board, the belt and the chips
  useEffect(() => {
    anchors.measure();
  }, [anchors, run.board.length, run.weapons.length, run.activeEvolutions.length, run.status, stage.w, stage.h, hudHeight]);
  const slotRef = useCallback((index: number) => anchors.ref(`slot:${index}`), [anchors]);

  // End of run → hand off to results after the finishing blow lands
  useEffect(() => {
    if (ended) band.finale(run.status === 'won');
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // The last cascade plays out first
    if (!ended || fx.busy) return;
    const t = setTimeout(() => onFinish(runRef.current, recordingOf()), effects ? 900 : 1300);
    return () => clearTimeout(t);
  }, [ended, fx.busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMatch = useCallback((cards: Card[], rewards: CardReward[], effects?: WeaponEffectResult, info?: { hinted: boolean }) => {
    setLastMatchTime(Date.now());
    setMistakeNote(null);
    setMistakeCards(null);
    setEventBannerNote(null);
    const graceUsed = rewards.some(r => r.effectType === 'grace');
    const isMegaMatch =
      Boolean(effects?.explosiveCards.length) ||
      Boolean(effects?.laserCards.length) ||
      Boolean(effects?.ricochetCards.length) ||
      cards.length > 3;
    const didHeal = rewards.some(r => (r.healing ?? 0) > 0) || Boolean(effects?.bonusHealing);
    triggerMatch({ isGraceMatch: graceUsed, isMegaMatch, didHeal });
    dispatch({ type: 'MATCH', cards, rewards, effects, hinted: info?.hinted });
    const ids = cards.map(c => c.id);
    later(() => dispatch({ type: 'REPLACE', ids }), REPLACE_DELAY_MS);
    // (the three picked cards come first; anything a weapon took with them follows)
    const picked = cards.slice(0, 3);
    setLastSet(picked);
    later(() => setLastSet(cur => (cur === picked ? null : cur)), LAST_SET_MS);
  }, [dispatch, triggerMatch, later]);

  const handleInvalid = useCallback((cards: Card[]) => {
    triggerMistake();
    triggerEnemyReaction('taunt');
    setMistakeNote(explainInvalidPick(cards, runRef.current.attributes, runRef.current.fighter));
    setMistakeCards(cards);
    setLastSet(null);
    dispatch({ type: 'INVALID', cards });
    const ids = cards.map(c => c.id);
    later(() => dispatch({ type: 'REPLACE', ids }), 520);
  }, [dispatch, triggerMistake, triggerEnemyReaction, later]);

  const handleBurn = useCallback((card: Card) => dispatch({ type: 'BURN', card }), [dispatch]);
  const handleUseHint = useCallback(() => {
    triggerHint();
    dispatch({ type: 'USE_HINT' });
    band.cue('hint');
  }, [dispatch, triggerHint]);

  const foeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: foeShake.value }, { scale: foeScale.value }] }));
  const screenStyle = useAnimatedStyle(() => ({ transform: [{ translateX: screenShake.value }] }));
  // Damage still in the air has not come off the bar yet (nor has that of events the stage is about to be handed)
  const incoming = effects ? run.events.reduce((sum, e) => (e.id > lastEventId.current && EVENT_FX[e.type]?.damage ? sum + (e.amount ?? 0) : sum), 0) : 0;
  const shownHp = Math.min(run.foeMaxHp, Math.round(run.foeHp + fx.pendingDamage + incoming));
  const challenge = challengeProgress(run);
  const gearMods = gearModifiers(run);
  const xpNeed = xpForLevel(run.xpLevel);
  const comboLive = run.elapsedMs - run.lastMatchAtMs <= comboWindowMs(run);
  const purityLive = run.features.has('purity') && run.purityChain > 0;
  const evolutionsOn = run.features.has('evolutions') && (run.armedRecipes.length > 0 || run.activeEvolutions.length > 0);
  const catalystOnBoard = run.board.some(c => c.hasEvolutionItem);
  const evolutionsLeft = run.evolutionCap - run.evolutionsTriggered;
  /** "2/3", or just the count where there is no limit (practice) */
  const evolutionsUsed = Number.isFinite(run.evolutionCap) ? `${run.evolutionsTriggered}/${run.evolutionCap}` : `${run.evolutionsTriggered} so far`;
  /** Armed recipes a Catalyst could still start: one that is running cannot be triggered again until it ends */
  const idleArmed = run.armedRecipes.filter(id => !run.activeEvolutions.some(a => a.id === id)).length;
  const leavePractice = () => { music.stop(); onFinish(runRef.current, recordingOf()); };

  const movesChip = run.movesLeft !== null && (
    <View style={[st.stat, run.movesLeft <= 2 && st.statWarn]}>
      <Icon name="lorc/archery-target" size={16} color={INK} />
      <Text style={st.statText}>{run.movesLeft} moves</Text>
    </View>
  );
  const keenEyeIds = useMemo(() => (run.passive.keenEyeCardId ? [run.passive.keenEyeCardId] : undefined), [run.passive.keenEyeCardId]);
  const showDamageHud = chrome?.alwaysShowHudStats ? true : shouldShowDamageNumbers(level, startSave);
  const showPassivesHud = chrome?.alwaysShowHudStats ? true : shouldShowPassiveHud(level, startSave);
  const parryCounterAvailable = useMemo(() => {
    if (!run.parry || run.parry.phase !== 'windup' || run.parry.spec.counter.kind === 'any') return true;
    return boardHasCounterSet(run.board, run.attributes, run.parry.spec.counter);
  }, [run.parry, run.board, run.attributes]);

  // Explain the POWER meter once the first time the player builds Charge in battle
  useEffect(() => {
    if (!showDamageHud || run.power < 1) return;
    if (seenCoach.current.has(COACH_KEYS.powerMeter)) return;
    seenCoach.current.add(COACH_KEYS.powerMeter);
    onCoachMarkSeen(COACH_KEYS.powerMeter);
    const msg = 'POWER × boosts all damage! Tap POWER above to see how.';
    setEventBannerNote(msg);
    later(() => setEventBannerNote(prev => (prev === msg ? null : prev)), 4500);
  }, [showDamageHud, run.power]); // eslint-disable-line react-hooks/exhaustive-deps
  const liveGuidance = useMemo(
    () =>
      computeLiveGuidance(run, {
        selectedCount: boardSelectedCount,
        selectedCards: boardSelectedCards,
        mistakeNote,
        mistakeCards,
        seenIntro: coachDismissed,
        noAssist: ui.disableAutoHint === true,
      }),
    [run, boardSelectedCount, boardSelectedCards, mistakeNote, mistakeCards, coachDismissed, ui.disableAutoHint]
  );
  const activeGlowIds = useMemo(() => {
    const merged = [...(keenEyeIds ?? []), ...(liveGuidance?.glowIds ?? [])];
    return merged.length > 0 ? [...new Set(merged)] : undefined;
  }, [keenEyeIds, liveGuidance]);
  const activeDimIds = useMemo(
    () => (liveGuidance && liveGuidance.dimIds.length > 0 ? liveGuidance.dimIds : undefined),
    [liveGuidance]
  );
  // Dev only: the cards being pointed at, so browser scripts can follow a lesson
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web') (window as unknown as { __nshapesLit?: string[] }).__nshapesLit = activeGlowIds ?? [];
  }, [activeGlowIds]);
  // A passing remark from your fighter (coach.ts fightRemarks): each is said once, and only into silence
  const [remark, setRemark] = useState<string | null>(null);
  const saidRemarks = useRef(new Set<string>());
  const remarks = fightRemarks(run, challenge.met);
  const nextRemark = remarks.find(r => !saidRemarks.current.has(r.key));
  useEffect(() => {
    if (!nextRemark) return;
    saidRemarks.current.add(nextRemark.key);
    const { text } = nextRemark;
    setRemark(text);
    later(() => setRemark(r => (r === text ? null : r)), 2600);
  }, [nextRemark?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // What went wrong with a pick is said at once (it beats a first-time tip about the same moment);
  // then tips, then guidance, then remarks
  const explaining = liveGuidance?.kind === 'mistake';
  const coachText = (explaining ? liveGuidance?.message : eventBannerNote ?? liveGuidance?.message ?? remark) ?? null;
  const coachKind = explaining ? 'mistake' : eventBannerNote ? 'event' : liveGuidance ? liveGuidance.kind : 'cheer';
  // While the rule is new, a strip above the board checks one trait at a time: the cards the companion is talking
  // about, else the Set just made (until the next card is picked)
  const traitChecks = showsTraitChecks(level);
  const checks =
    liveGuidance?.pills ??
    (boardSelectedCount === 1 && boardSelectedCards[0]
      ? describeSingleCardTraits(boardSelectedCards[0], run.attributes)
      : boardSelectedCount === 0
        ? checksOfSet(lastSet, run.attributes)
        : undefined);
  // The stage is as tall as the board can spare (see STAGE)
  const boardRows = Math.max(1, Math.ceil(run.board.length / 3));
  // (cards a little squatter than a playing card still read well, and leave the fight room to breathe on a short phone)
  const idealCardH = stage.w > 0 ? (Math.min(stage.w, 560) - 36) / 3 / 0.82 : 140;
  // (a wide window has width to burn and little height: there the two of them get a little more than the minimum)
  const stageMin = stage.w >= STAGE.wideFrom ? STAGE.minWide : STAGE.min;
  const chromePx = STAGE.chromePx + (traitChecks ? TRAIT_CHECKS_HEIGHT + 6 : 0) + (showDamageHud ? 52 : 0) + (run.parry ? 28 : 0);
  const stageH = stage.h > 0
    ? Math.round(Math.max(stageMin, Math.min(STAGE.max, stage.h - insets.top - chromePx - boardRows * (idealCardH + 6))))
    : 92;
  // Tall enough to give the companion's words their own row above the two fighters
  const roomyStage = stageH >= STAGE.roomy;
  const floorH = roomyStage ? stageH - STAGE.speechPx : stageH;
  const stageW = stage.w > 0 ? stage.w : 375;
  // Side by side on a compact stage, the two of them leave the middle for the words
  const foeSize = Math.round(Math.min(roomyStage ? 132 : Math.min(120, stageW * 0.2), floorH - (level.isBoss ? 4 : 12)));
  const fighterSize = Math.round(Math.max(36, Math.min(roomyStage ? 104 : Math.min(96, stageW * 0.15), floorH - 34)));
  // While the foe is taunting it has the floor (a wrong pick is still explained at once)
  const foeTalking = taunting && !!taunt && !explaining && !ended;
  const coachBubble = foeTalking ? (
    <StageBubble testID="run-foe-taunt" text={`“${taunt}”`} kind="foe" tail={roomyStage ? 'down-right' : 'right'} />
  ) : coachText && !ended ? (
    <StageBubble
      testID="run-coach-banner"
      text={coachText}
      kind={coachKind}
      tail={roomyStage ? 'down' : 'left'}
      onPress={
        // A lesson stays up; anything else can be tapped away
        coachKind !== 'lesson' && coachKind !== 'rescue'
          ? () => {
              setCoachDismissed(true);
              setEventBannerNote(null);
              setMistakeNote(null);
              setMistakeCards(null);
              setLastSet(null);
              setRemark(null);
            }
          : undefined
      }
    />
  ) : null;
  const hasHudRow =
    run.movesLeft !== null ||
    practice ||
    secondsLeft !== null ||
    (showPassivesHud && run.passives.length > 0) ||
    run.features.has('graces') ||
    run.features.has('coins') ||
    run.features.has('hints');
  const handleSelectedCount = useCallback((c: number) => {
    setBoardSelectedCount(c);
    setSelectedCount(c);
  }, [setSelectedCount]);
  const handleBoardIdle = useCallback((idle: boolean) => {
    setIsBoardIdle(idle);
  }, [setIsBoardIdle]);
  const foeAvatarEnemy = useMemo(
    () => ({ name: run.foeName, icon: run.foeIcon, tier: run.foe.tier }),
    [run.foeName, run.foeIcon, run.foe.tier]
  );
  return (
    <AnchorsProvider value={anchors}>
    <Animated.View
      style={[st.root, { backgroundColor: biome.colors.sky, paddingTop: insets.top }, screenStyle]}
      onLayout={e => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {/* What every anchor is measured against: the stage's own top-left corner */}
      <View ref={anchors.rootRef} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
      {/* ── HUD ─────────────────────────────────────────── */}
      <View style={st.hud} onLayout={e => setHudHeight(e.nativeEvent.layout.height)}>
        {/* Who you are fighting, and how much of it is left */}
        <View style={st.hudTop}>
          <TouchableOpacity onPress={() => setPaused(true)} style={st.pauseBtn} accessibilityLabel="Pause">
            <Text style={st.pauseText}>II</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="run-foe-inspect"
            onPress={() => { sfx('click'); setHudInspect({ kind: 'foe' }); }}
            style={{ flex: 1, minWidth: 0, gap: 2 }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Inspect foe: ${run.foeName}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <Text style={st.foeName} numberOfLines={1}>{run.foeName}</Text>
              {level.isBoss && <Text style={st.bossTag}>BOSS</Text>}
              {level.foes.length > 1 && <Text style={st.wave}>WAVE {run.wave + 1}/{level.foes.length}</Text>}
            </View>
            <HpBar hp={shownHp} max={run.foeMaxHp} endless={practice} />
            {ui.showInactivityBar && (
              <View style={st.idleTrack}>
                <View style={[st.idleFill, { width: `${Math.min(100, (ui.showInactivityBar.current / ui.showInactivityBar.max) * 100)}%` }]} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* The battle stage: your fighter on the left, the foe on the right, and what your fighter says */}
        <View testID="run-stage" style={[st.stage, { height: stageH, backgroundColor: biome.colors.sky }]}>
          <View pointerEvents="none" style={st.stageClip}>
            <View style={[st.stageGround, { backgroundColor: biome.colors.ground }]} />
          </View>
          {/* A tall stage has room for the words above the two of them (the room is kept, so the board never moves) */}
          {roomyStage && <View style={st.stageSpeech}>{coachBubble}</View>}
          <View style={st.stageFloor}>
            <View style={st.stageSide}>
              <Anchor name="fighter">
                <FighterAvatar
                  testID="adventure-run-fighter"
                  character={run.fighter}
                  size={fighterSize}
                  health={fighterHealth}
                  maxHealth={fighterMaxHealth}
                  mood={fighterMood}
                  reaction={conductor.reaction}
                  streak={conductor.streak}
                  animate={appActive}
                  interactive
                />
              </Anchor>
              {run.hearts !== null && run.maxHearts !== null && (
                <Anchor name="hearts"><Hearts hearts={run.hearts} max={run.maxHearts} /></Anchor>
              )}
            </View>

            <View style={st.stageMiddle}>
              {!roomyStage && coachBubble}
              {(showDamageHud || (run.combo > 1 && comboLive) || practice) && (
                <View style={st.counters}>
                  {showDamageHud && <Text testID="run-total-damage" style={st.counter} accessibilityLabel={`${run.totalDamage} total damage`}>⚔ {run.totalDamage}</Text>}
                  {showDamageHud && run.power > 0 && <PowerMeter points={run.power} onPress={() => { sfx('click'); setPowerInfo(true); }} />}
                  {run.combo > 1 && comboLive && (
                    // (the cascade calls out "COMBO ×N" as it lands; this is the running count)
                    <Anchor name="combo">
                      <View testID="run-combo" style={st.comboPill} accessibilityLabel={`Combo ×${run.combo}`}>
                        <Text style={st.comboText}>×{run.combo}</Text>
                      </View>
                    </Anchor>
                  )}
                  {showDamageHud && run.biggestHit > 0 && <Text testID="run-biggest-hit" style={st.counterDim}>best {run.biggestHit}</Text>}
                  {/* Practice: what a Set is worth with this build */}
                  {practice && run.matches > 0 && <Text testID="run-per-set" style={st.counterDim} accessibilityLabel={`${Math.round(run.totalDamage / run.matches)} damage per Set on average`}>avg {Math.round(run.totalDamage / run.matches)}</Text>}
                </View>
              )}
            </View>

            <Anchor name="foe">
              <Animated.View style={foeStyle}>
                <EnemyAvatar
                  testID="adventure-run-enemy"
                  enemy={foeAvatarEnemy}
                  size={foeSize}
                  hp={run.foeHp}
                  maxHp={run.foeMaxHp}
                  mood={enemyMood}
                  reaction={enemyConductor.reaction}
                  animate={appActive}
                  interactive
                />
              </Animated.View>
            </Anchor>
          </View>
        </View>

        {(hasHudRow || run.weapons.length > 0) && (
        <View style={st.hudRow}>
          {/* On an untimed level the moves are the clock */}
          {run.movesLeft !== null && (secondsLeft === null ? <Anchor name="clock">{movesChip}</Anchor> : movesChip)}
          {practice && (
            <Anchor name="clock">
              <View testID="run-no-clock" style={st.stat} accessibilityLabel="No clock">
                <Icon name="lorc/stopwatch" size={16} color={INK} />
                <Text style={st.statText}>∞</Text>
              </View>
            </Anchor>
          )}
          {secondsLeft !== null && (
            <Anchor name="clock">
              {/* Teal while a cascade plays: the clock is standing still */}
              <View
                testID="run-clock"
                accessibilityLabel={`${secondsLeft} seconds left${fx.busy ? ', waiting for effects' : ''}`}
                style={[st.stat, secondsLeft <= 10 && st.statWarn, ui.timerSpeedMultiplier && ui.timerSpeedMultiplier > 1 ? { borderColor: COLORS.impactOrange } : null, fx.busy && st.statHeld]}
              >
                <Icon name="lorc/stopwatch" size={16} color={fx.busy ? COLORS.logicTeal : INK} />
                <Text style={st.statText}>{secondsLeft}s</Text>
              </View>
            </Anchor>
          )}
          {showPassivesHud && run.passives.map(id => <Anchor key={id} name={`passive:${id}`}><PassiveChip id={id} run={run} onPress={() => { sfx('click'); setHudInspect({ kind: 'passive', id }); }} /></Anchor>)}
          {run.features.has('graces') && (
            <Anchor name="graces">
              <View style={st.stat}>
                <Icon name="lorc/clover" size={16} color={COLORS.logicTeal} />
                <Text style={st.statText}>{run.stats.graces}</Text>
              </View>
            </Anchor>
          )}
          {/* The weapons in play: each jumps & pops its live value badge when it contributes; tap one to read it */}
          <GearBelt weapons={run.weapons} growth={run.growth} ignition={run.lastSetIgnition} reduced={!effects} width={stage.w} onInspect={setInspect} />
          <View style={{ flex: 1 }} />
          {run.features.has('coins') && <Anchor name="coins"><CoinPill coins={run.coins} /></Anchor>}
          {run.features.has('hints') && (
            <Anchor name="hint">
            <TouchableOpacity
              testID="run-hint"
              onPress={() => run.stats.hints > 0 && !ui.disableManualHint && setHintTrigger(t => t + 1)}
              style={[st.hintBtn, (run.stats.hints <= 0 || ui.disableManualHint) && { opacity: 0.4 }]}
              accessibilityLabel="Use hint"
            >
              <Icon name="lorc/light-bulb" size={18} color={INK} />
              <Text style={st.statText}>{run.stats.hints}</Text>
            </TouchableOpacity>
            </Anchor>
          )}
        </View>
        )}

        {run.features.has('xp') && (
          <Anchor name="xp">
            <View style={st.xpTrack}>
              <View style={[st.xpFill, { width: `${(run.xp / xpNeed) * 100}%` }]} />
              <Text style={st.xpText}>LV {run.xpLevel + 1}</Text>
            </View>
          </Anchor>
        )}

        {/* Live Arcana, Escalating Purity, board effects & Evolution status strip */}
        {(run.arcana.length > 0 || purityLive || evolutionsOn || run.simplified || run.doubleNext > 0 || run.nextSetMultiplier > 1 || hasGearChips(gearMods)) && (
          <View style={st.synergyRow}>
            {run.arcana.map(id => (
              <TouchableOpacity
                key={id}
                testID="run-arcana-chip"
                style={st.arcanaChip}
                onPress={() => { sfx('click'); setHudInspect({ kind: 'arcana', id }); }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Inspect ${getArcana(id).name}`}
              >
                <Icon name={getArcana(id).icon} size={12} color={TONE.arcana} />
                <Text style={st.arcanaChipText}>{getArcana(id).numeral}</Text>
              </TouchableOpacity>
            ))}
            <GearChips
              run={run}
              mods={gearMods}
              onInspectWeapon={id => {
                const w = run.weapons.find(x => x.id === id);
                if (w) { sfx('click'); setInspect(w); }
              }}
            />
            {purityLive && (
              <TouchableOpacity
                testID="run-purity-chip"
                style={[st.purityChip, run.purityChain >= 2 && st.purityChipHot]}
                onPress={() => { sfx('click'); setHudInspect({ kind: 'buff', which: 'purity' }); }}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Icon name="lorc/lightning-branches" size={12} color={run.purityChain >= 2 ? TONE.upside : INK} />
                <Text style={st.purityChipText}>
                  {run.purityChain >= 2 ? `Purity ×${run.purityChain}` : `Purity 1`} · &gt;{run.lastDiffCount} diff next
                </Text>
              </TouchableOpacity>
            )}
            {run.doubleNext > 0 && (
              <TouchableOpacity
                testID="run-double-chip"
                style={[st.purityChip, st.purityChipHot]}
                onPress={() => { sfx('click'); setHudInspect({ kind: 'buff', which: 'double' }); }}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={st.purityChipText}>NEXT TRIGGER ×2{run.doubleNext > 1 ? ` (${run.doubleNext})` : ''}</Text>
              </TouchableOpacity>
            )}
            {run.nextSetMultiplier > 1 && (
              <TouchableOpacity
                testID="run-charged-chip"
                style={[st.purityChip, { backgroundColor: '#FFE8CC', borderColor: COLORS.impactOrange }]}
                onPress={() => { sfx('click'); setHudInspect({ kind: 'buff', which: 'charged' }); }}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={st.purityChipText}>NEXT SET ×{run.nextSetMultiplier}</Text>
              </TouchableOpacity>
            )}
            {run.simplified && (
              <TouchableOpacity
                testID="run-simplified-chip"
                style={[st.purityChip, st.purityChipHot]}
                onPress={() => { sfx('click'); setHudInspect({ kind: 'buff', which: 'simplified' }); }}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Icon name="lorc/third-eye" size={12} color={TONE.upside} />
                <Text style={st.purityChipText}>
                  All {run.simplified.attribute} {String(run.simplified.value)}{run.simplified.also ? ` and ${run.simplified.also.attribute} ${String(run.simplified.also.value)}` : ''} · {Math.ceil(run.simplified.remainingMs / 1000)}s
                </Text>
              </TouchableOpacity>
            )}
            {evolutionsOn && (
              <TouchableOpacity
                testID="run-evo-chip"
                onPress={() => { sfx('click'); setHudInspect({ kind: 'evolutions' }); }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={
                  idleArmed === 0
                    ? `Evolving, ${evolutionsUsed} used. No Catalyst until an evolution ends`
                    : `${idleArmed} evolutions armed, ${evolutionsUsed} used, ${Math.round(run.evolutionLikelihood)} percent catalyst chance`
                }
                style={[st.evoChip, catalystOnBoard && st.evoChipReady, evolutionsLeft <= 0 && { opacity: 0.55 }]}
              >
                <Icon name="lorc/crystal-shine" size={12} color={catalystOnBoard ? INK : TONE.arcana} />
                <Text style={st.evoChipText} numberOfLines={1}>
                  {evolutionsLeft <= 0
                    ? `Evolutions ${evolutionsUsed}`
                    : catalystOnBoard
                      ? 'CATALYST! Match it to evolve'
                      : idleArmed === 0
                        ? `Evolving · ${evolutionsUsed}`
                        : `${idleArmed} armed · ${Math.round(run.evolutionLikelihood)}% · ${evolutionsUsed}`}
                </Text>
              </TouchableOpacity>
            )}
            {run.activeEvolutions.map(a => {
              const recipe = recipeFor(a.id);
              return (
                <Anchor key={a.id} name={`evo:${a.id}`}>
                  <TouchableOpacity
                    onPress={() => { sfx('click'); setHudInspect({ kind: 'evolutions' }); }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Inspect ${recipe?.name ?? a.id} evolution`}
                  >
                    <EvolutionRing
                      icon={recipe?.icon ?? 'lorc/crystal-shine'}
                      name={recipe?.name ?? a.id}
                      remainingMs={a.remainingMs}
                      durationMs={a.durationMs}
                    />
                  </TouchableOpacity>
                </Anchor>
              );
            })}
          </View>
        )}

        {practice ? (
          // Nothing to win here: where the ★★★ goal would be, the way out
          <View style={st.challenge} testID="run-practice-bar">
            <Icon name="lorc/target-dummy" size={14} color={INK} />
            <Text style={st.challengeText} numberOfLines={1}>Practice: nothing to win, nothing to lose</Text>
            <TouchableOpacity testID="run-done" onPress={leavePractice} style={st.doneBtn} accessibilityRole="button" accessibilityLabel="Done practising">
              <Text style={st.doneText}>DONE</Text>
            </TouchableOpacity>
          </View>
        ) : chrome?.statusBanner ? (
          <View style={st.challenge} testID={chrome.statusBanner.testID}>
            <Icon name={chrome.statusBanner.icon} size={14} color={TONE.upside} />
            <Text style={st.challengeText} numberOfLines={1}>
              {chrome.statusBanner.text}
            </Text>
          </View>
        ) : level.id !== '1-1' ? (
          <ChallengeStrip text={challenge.text} met={challenge.met} failed={challenge.failed} onPress={() => { sfx('click'); setHudInspect({ kind: 'challenge' }); }} />
        ) : null}

        {/* The rule, one cell per trait, while it is new (always the same height: the board never moves) */}
        {traitChecks && <TraitChecks attributes={run.attributes} checks={ended ? null : checks} added={traitAddedBy(level)} />}

        {/* Docked Balatro-style Score Equation Bar (never covers cards; shows live primed math + real-time tally + receipt) */}
        {showDamageHud && (
          <MultiplierIgnition
            ignition={run.lastSetIgnition}
            run={run}
            enabled={effects}
            onPress={() => { sfx('click'); setHudInspect({ kind: 'score' }); }}
          />
        )}

      </View>

      {run.parry && (
        <ParryIntentBar
          parry={run.parry}
          active={playing && appActive}
          counterAvailable={parryCounterAvailable}
          onPress={() => { sfx('click'); setHudInspect({ kind: 'foe' }); }}
        />
      )}

      {run.surge && <SurgeBar surge={run.surge} active={playing && appActive} />}

      {/* ── Board ───────────────────────────────────────── */}
      <View ref={anchors.ref('board')} collapsable={false} style={st.boardWrap}>
        {/* Evolution pulse: a glow behind the cards, never a card border */}
        {run.activeEvolutions.length > 0 && <EvolutionGlow active={playing && appActive} />}
        {run.surge?.active && <SurgeGlow active={playing && appActive} />}
        {run.frozenMs > 0 && (
          <View style={st.frozen} pointerEvents="none">
            <Icon name="lorc/snowflake-1" size={18} color="#1D4ED8" />
            <Text style={st.frozenText}>FROZEN {Math.ceil(run.frozenMs / 1000)}s</Text>
          </View>
        )}
        <GameBoard
          cards={run.board}
          connections={run.connections}
          onMatch={handleMatch}
          onInvalidSelection={handleInvalid}
          playerStats={run.stats}
          weapons={run.weapons}
          isPlayerTurn={run.status === 'playing' && !halted && !fx.cutIn}
          activeAttributes={run.attributes}
          onUseHint={handleUseHint}
          triggerHint={hintTrigger}
          onCardBurn={handleBurn}
          isPaused={!ticking}
          lastMatchTime={lastMatchTime}
          autoPlayer={autoPlayer}
          enemy={run.foe}
          hideEnemyOverlay
          glowingCardIds={activeGlowIds}
          dimmedCardIds={activeDimIds}
          dimmedOpacity={liveGuidance?.dimOpacity}
          onSelectedCountChange={handleSelectedCount}
          onSelectedCardsChange={setBoardSelectedCards}
          onBoardIdleChange={handleBoardIdle}
          slotRef={slotRef}
          onSlotLayout={anchors.measure}
          quietRewards
        />
      </View>

      {/* Everything that is playing right now */}
      <FxStage fx={fx} anchors={anchors} size={stage} hideWeaponNameTags />
      <KillCamOverlay ignition={run.lastSetIgnition} anchors={anchors} stageSize={stage} enabled={effects && !practice} />
      {opening && effects && !practice && anchors.rect('board') && (
        <View style={st.openingLayer} pointerEvents="none" testID="run-opening">
          <Banner rect={anchors.rect('board')!} text={level.isBoss ? 'BOSS FIGHT!' : 'FIGHT!'} color={level.isBoss ? '#9F1239' : COLORS.deepOnyx} delay={120} />
        </View>
      )}
      {fx.cutIn && (
        <EvolutionCutIn
          key={fx.cutIn.key}
          recipes={fx.cutIn.recipes.map(recipeFor).filter((r): r is EvolutionRecipe => !!r)}
          weapons={run.weapons}
          seconds={Math.round((run.activeEvolutions.find(a => a.id === fx.cutIn?.recipes[0])?.durationMs ?? EVOLUTION_RULES.durationMs) / 1000)}
          size={stage}
          onDone={() => { setEvolutionHint(false); fx.dismissCutIn(); }}
          autoDismissMs={autoPlayer ? 1600 : undefined}
          hint={evolutionHint ? 'The ring by the HP bar counts down the time left.' : undefined}
        />
      )}
      {/* Effects off: evolutions get a small banner that does not stop the fight */}
      {fx.banner && (() => {
        const recipe = recipeFor(fx.banner.recipes[0]);
        return (
          <View style={[st.bannerWrap, { top: insets.top + hudHeight / 2 }]} pointerEvents="none">
            <EvolutionBanner
              name={recipe?.name ?? 'Evolution'}
              icon={recipe?.icon ?? 'lorc/crystal-shine'}
              text={recipe?.activeText ?? ''}
              seconds={EVOLUTION_RULES.durationMs / 1000}
              seq={fx.banner.key}
            />
          </View>
        );
      })()}
      <MegaFlash trigger={megaFlash} />

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

      {/* Level-up and shop wait for the cascade that earned them */}
      {run.status === 'pick' && !fx.busy && (
        <WeaponPick
          title="LEVEL UP!"
          subtitle="Pick one for this fight"
          options={run.pickOptions}
          weaponBuilds={run.weaponBuilds}
          onPick={w => { band.cue('weaponGet'); band.fire(w.id, 4); conductor.triggerPowerup(); dispatch({ type: 'PICK', weaponId: w.id }); }}
          onSkip={() => dispatch({ type: 'PICK', weaponId: null })}
        />
      )}

      {/* Between waves */}
      {run.status === 'intermission' && !fx.busy && (
        <Intermission run={run} dispatch={dispatch} onPurchase={() => conductor.triggerPowerup()} />
      )}

      <Modal visible={paused} transparent animationType="fade" onRequestClose={() => setPaused(false)}>
        <View style={st.overlay}>
          <PopIn style={st.panel}>
            <Text style={st.panelTitle}>PAUSED</Text>
            <Text style={st.panelSub}>
              {chrome?.pauseSubtitle ?? `${practice ? 'Practice' : level.id} · ${level.name}`}
            </Text>
            {run.weapons.length > 0 && (
              <View style={st.gearRow}>
                {run.weapons.map((w, i) => {
                  const level = run.weaponBuilds[w.id]?.level ?? 1;
                  return (
                    <View key={i} style={st.gearChip}>
                      <WeaponAvatar weapon={w} size={20} interactive />
                      <Text style={st.gearText} numberOfLines={1}>{w.name}{weaponLevelSuffix(level)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <Btn label="Resume" onPress={() => setPaused(false)} />
            {onToggleEffects && (
              <Btn
                testID="toggle-effects"
                small
                variant="secondary"
                label={effects ? 'Effects: on' : 'Effects: off'}
                onPress={onToggleEffects}
              />
            )}
            {chrome?.allowRestart !== false && (
              <Btn label={practice ? 'Start over' : 'Restart'} variant="secondary" onPress={() => { setPaused(false); onRestart(runRef.current, recordingOf()); }} />
            )}
            {practice ? (
              <>
                <Btn testID="pause-done" label="Done practising" variant="secondary" onPress={() => { setPaused(false); leavePractice(); }} />
                <Text style={st.panelHint}>Practice only: nothing here is banked, and nothing is lost.</Text>
              </>
            ) : (
              <>
                <Btn label={chrome?.quitLabel ?? 'Retreat to map'} variant="secondary" onPress={() => { setPaused(false); music.stop(); onQuit(runRef.current, recordingOf()); }} />
                <Text style={st.panelHint}>
                  {chrome?.quitHint ?? "Retreating forfeits this attempt, including the coins you've collected in it."}
                </Text>
              </>
            )}
            {onToggleEffects && (
              <Text style={st.panelHint}>
                {effects ? 'Effects on: the clock waits while they play.' : 'Effects off: numbers only, and the clock never waits.'}
              </Text>
            )}
          </PopIn>
        </View>
      </Modal>

      {/* A weapon from the belt, explained (the fight waits) */}
      <Modal visible={!!inspect} transparent animationType="fade" onRequestClose={() => setInspect(null)}>
        <View style={st.overlay}>
          <PopIn style={[st.panel, { padding: 12 }]}>
            {inspect && <WeaponExplainer weapon={run.weapons.find(w => w.id === inspect.id) ?? inspect} build={run.weaponBuilds[inspect.id]} growth={run.growth} defaultOpen />}
            <Btn testID="inspect-close" label="Back to the fight" onPress={() => setInspect(null)} />
          </PopIn>
        </View>
      </Modal>

      {/* Power meter, explained (the fight waits) */}
      <Modal visible={powerInfo} transparent animationType="fade" onRequestClose={() => setPowerInfo(false)}>
        <View style={st.overlay}>
          <PopIn style={[st.panel, { padding: 12 }]}>
            <PowerExplainer points={run.power} weapons={run.weapons} evolutionsTriggered={run.evolutionsTriggered} />
            <Btn testID="power-info-close" label="Back to the fight" onPress={() => setPowerInfo(false)} />
          </PopIn>
        </View>
      </Modal>

      {/* HUD inspector: foe / passive / ★★★ goal / Arcana / evolution / buff (the fight waits) */}
      <HudInspector
        target={hudInspect}
        run={run}
        shownHp={shownHp}
        challenge={challenge}
        knownEvolutions={new Set([...startSave.unlockedEvolutions, ...startSave.discoveredEvolutions, ...run.forgedRecipes])}
        onClose={() => setHudInspect(null)}
      />
    </Animated.View>
    </AnchorsProvider>
  );
};

/**
 * The foe's HP: the bar drops as each hit lands, and a pale trail shows what was just taken.
 * A practice dummy's bar never moves and reads ∞.
 */
const HpBar: React.FC<{ hp: number; max: number; endless?: boolean }> = ({ hp, max, endless }) => {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const fill = useSharedValue(pct);
  const trail = useSharedValue(pct);
  useEffect(() => {
    const rising = pct > fill.value;
    fill.value = withTiming(pct, { duration: 140, easing: Easing.out(Easing.quad) });
    trail.value = rising ? pct : withDelay(260, withTiming(pct, { duration: 340, easing: Easing.out(Easing.quad) }));
  }, [pct, fill, trail]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const trailStyle = useAnimatedStyle(() => ({ width: `${trail.value * 100}%` }));
  return (
    <View testID="run-foe-hp" style={st.hpTrack} accessibilityLabel={endless ? 'Foe health: endless' : `Foe health ${hp} of ${max}`}>
      <Animated.View style={[st.hpFill, st.hpTrail, trailStyle]} />
      <Animated.View style={[st.hpFill, { backgroundColor: pct > 0.5 ? COLORS.impactRed : pct > 0.25 ? COLORS.impactOrange : '#E53935' }, fillStyle]} />
      <Text style={[st.hpText, endless && st.hpEndless]}>{endless ? '∞' : `${hp} / ${max}`}</Text>
    </View>
  );
};

/**
 * The ★★★ goal, under the fight. It jumps each time it moves forward ("1/2"),
 * and turns teal with a tick when it is met, so progress toward the third
 * star is felt as it happens and not only read on the results screen.
 */
const ChallengeStrip: React.FC<{ text: string; met: boolean; failed: boolean; onPress?: () => void }> = ({ text, met, failed, onPress }) => {
  const pop = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    // (not on the way in: only when the words change during the fight)
    if (first.current) {
      first.current = false;
      return;
    }
    if (failed) return;
    pop.value = withSequence(withTiming(met ? 1.12 : 1.06, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) }));
    if (met) band.cue('star', { amount: 3 });
  }, [text, met, failed, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <TouchableOpacity
      testID="run-challenge"
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Three star goal: ${text}${met ? ', done' : ''}`}
    >
      <Animated.View style={[st.challenge, met && st.challengeMet, failed && { opacity: 0.55 }, style]}>
        <Text style={st.challengeStar}>★★★</Text>
        <Text style={[st.challengeText, failed && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{text}</Text>
        {met && <Icon name="lorc/checked-shield" size={14} color={COLORS.logicTeal} />}
      </Animated.View>
    </TouchableOpacity>
  );
};

/** Base tuning for a passive number (skill nodes can move it; the chips are a guide, the engine decides). */
const tune = (id: PassiveId, key: string): number => (PASSIVE_TUNING[id] as Record<string, number>)[key] ?? 0;

const comboWindowMs = (run: RunState): number =>
  comboWindowFor(run.passives.includes('combo') ? tune('combo', 'combo.windowMs') : DEFAULT_COMBO_WINDOW_MS, run.attributes.length);

/** One passive's live state. Lit when it is about to matter. */
const PassiveChip: React.FC<{ id: PassiveId; run: RunState; onPress?: () => void }> = ({ id, run, onPress }) => {
  const def = getPassive(id);
  const p = run.passive;
  const sinceSet = run.elapsedMs - run.lastMatchAtMs;
  let label = '';
  let lit = false;
  switch (id) {
    case 'nine_lives': label = p.nineLivesLeft > 0 ? `${p.nineLivesLeft} life` : 'used'; lit = p.nineLivesLeft > 0; break;
    case 'scrappy': {
      const missing = run.hearts !== null && run.maxHearts !== null ? run.maxHearts - run.hearts : 0;
      label = missing > 0 ? `+${missing * tune('scrappy', 'scrappy.perHeart')}` : '+0'; lit = missing > 0; break;
    }
    case 'combo': {
      const live = run.combo > 0 && sinceSet <= comboWindowMs(run);
      label = live ? `×${run.combo}` : 'combo'; lit = live; break;
    }
    case 'hot_streak': label = p.hotStreak ? '×2 ready' : 'streak'; lit = p.hotStreak; break;
    case 'grudge': label = p.grudge > 0 ? `+${p.grudge * tune('grudge', 'grudge.damage')}` : 'calm'; lit = p.grudge > 0; break;
    case 'thick_hide': label = p.thickHideLeft > 0 ? `${p.thickHideLeft} free` : 'spent'; lit = p.thickHideLeft > 0; break;
    case 'patience': {
      const wait = tune('patience', 'patience.msPerTrait') * run.attributes.length - sinceSet;
      label = run.matches === 0 || wait <= 0 ? 'ready' : `${Math.ceil(wait / 1000)}s`; lit = run.matches > 0 && wait <= 0; break;
    }
    case 'deep_freeze': label = run.frozenMs > 0 ? `${Math.ceil(run.frozenMs / 1000)}s` : 'rainbow'; lit = run.frozenMs > 0; break;
    case 'zoomies': label = `in ${p.zoomiesIn}`; lit = p.zoomiesIn <= 1; break;
    case 'fetch': label = 'fetch'; lit = false; break;
    case 'big_scoop': label = `in ${p.scoopIn}`; lit = p.scoopIn <= 1; break;
    case 'keen_eye': label = p.keenEyeCardId ? 'look!' : 'eye'; lit = !!p.keenEyeCardId; break;
  }
  return (
    <TouchableOpacity
      testID={`run-passive-${id}`}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[st.stat, lit && { backgroundColor: '#FFF1C7' }, !lit && { opacity: 0.6 }]}
      accessibilityLabel={`${def.name}: ${label}`}
    >
      <Icon name={def.icon} size={15} color={INK} />
      <Text style={st.statText}>{label}</Text>
    </TouchableOpacity>
  );
};

/** Soft pulsing glow behind the board while an evolution runs. */
const EvolutionGlow: React.FC<{ active: boolean }> = ({ active }) => {
  const o = useSharedValue(0.25);
  useEffect(() => {
    if (!active) {
      cancelAnimation(o);
      o.value = 0.25;
      return;
    }
    o.value = withRepeat(withSequence(withTiming(0.6, { duration: 500 }), withTiming(0.25, { duration: 500 })), -1);
    return () => cancelAnimation(o);
  }, [active, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View testID="evolution-glow" pointerEvents="none" style={[st.glow, style]} />;
};

/**
 * Shading Surge meter: fills toward the next surge while shading is off, then
 * drains through the ×5 window. Pulses in the last seconds before it starts.
 */
const SurgeBar: React.FC<{ surge: NonNullable<RunState['surge']>; active: boolean }> = ({ surge, active }) => {
  const secs = Math.ceil(surge.msLeft / 1000);
  const fill = surge.active ? surge.msLeft / SURGE_RULES.surgeMs : 1 - surge.msLeft / SURGE_RULES.calmMs;
  const imminent = !surge.active && surge.msLeft <= SURGE_RULES.warnMs;
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!active) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = imminent || surge.active
      ? withRepeat(withSequence(withTiming(1.04, { duration: 260 }), withTiming(1, { duration: 260 })), -1)
      : withTiming(1, { duration: 120 });
    return () => cancelAnimation(pulse);
  }, [active, imminent, surge.active, pulse]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const label = surge.active
    ? `SHADING SURGE · SETS ×${SURGE_RULES.multiplier} · ${secs}s`
    : imminent
      ? `SURGE IN ${secs}s · GET READY`
      : `Shading surge in ${secs}s`;
  return (
    <Animated.View
      testID="run-surge-bar"
      accessibilityLabel={label}
      style={[st.surgeBar, surge.active && st.surgeBarLive, imminent && st.surgeBarSoon, style]}
    >
      <View style={[st.surgeFill, { width: `${Math.max(0, Math.min(1, fill)) * 100}%` }, surge.active && st.surgeFillLive]} />
      <Icon name="lorc/stone-block" size={13} color={surge.active ? '#FFFFFF' : TONE.surge} />
      <Text style={[st.surgeText, surge.active && { color: '#FFFFFF' }]} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
};

const SurgeGlow: React.FC<{ active: boolean }> = ({ active }) => {
  const o = useSharedValue(0.2);
  useEffect(() => {
    if (!active) {
      cancelAnimation(o);
      o.value = 0.2;
      return;
    }
    o.value = withRepeat(withSequence(withTiming(0.5, { duration: 380 }), withTiming(0.2, { duration: 380 })), -1);
    return () => cancelAnimation(o);
  }, [active, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View testID="surge-glow" pointerEvents="none" style={[st.glow, { backgroundColor: TONE.surge }, style]} />;
};

/** Your hearts, under your fighter on the stage. */
const Hearts: React.FC<{ hearts: number; max: number }> = ({ hearts, max }) => {
  if (max > 5) {
    return (
      <View style={st.heartsPill} accessibilityLabel={`${hearts} of ${max} hearts`}>
        <Heart size={13} />
        <Text style={st.heartsText}>{hearts}/{max}</Text>
      </View>
    );
  }
  return (
    <View style={st.heartsPill} accessibilityLabel={`${hearts} of ${max} hearts`}>
      {Array.from({ length: max }).map((_, i) => (
        <Heart key={i} size={13} filled={i < hearts} />
      ))}
    </View>
  );
};

const WeaponPick: React.FC<{ title: string; subtitle: string; options: Weapon[]; weaponBuilds?: WeaponBuilds; onPick: (w: Weapon) => void; onSkip: () => void }> = ({ title, subtitle, options, weaponBuilds, onPick, onSkip }) => (
  <Modal visible transparent animationType="fade" onRequestClose={onSkip}>
    <View style={st.overlay}>
      <PopIn style={st.panel}>
        <Eyebrow text={title} />
        <Text style={st.panelSub}>{subtitle}</Text>
        {options.map((w, i) => {
          const level = weaponBuilds?.[w.id]?.level ?? 1;
          return (
            <WeaponOfferRow
              key={`${w.id}-${i}`}
              testID={`pick-${i}`}
              weapon={w}
              level={level}
              onPress={() => onPick(w)}
            />
          );
        })}
        <Btn label="Skip" variant="ghost" small onPress={onSkip} />
      </PopIn>
    </View>
  </Modal>
);

const Intermission: React.FC<{ run: RunState; dispatch: (a: RunAction) => void; onPurchase?: () => void }> = ({ run, dispatch, onPurchase }) => {
  const hasShop = run.features.has('shop');
  const next = run.level.foes[run.wave + 1];
  const nextDisplay = next ? foeDisplay(next) : null;
  const [tapTriggers, setTapTriggers] = useState<Record<number, number>>({});
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
                    <WeaponOfferRow
                      key={`${w.id}-${i}`}
                      testID={`shop-buy-${i}`}
                      weapon={w}
                      level={run.weaponBuilds[w.id]?.level ?? 1}
                      dimmed={!afford}
                      triggerKey={tapTriggers[i]}
                      right={<CoinPill coins={price} />}
                      onPress={() => {
                        setTapTriggers(prev => ({ ...prev, [i]: (prev[i] ?? 0) + 1 }));
                        if (afford) {
                          band.cue('register');
                          band.fire(w.id, 4);
                          onPurchase?.();
                          dispatch({ type: 'BUY', index: i });
                        }
                      }}
                    />
                  );
                })}
                {run.shopOptions.length === 0 && <Text style={st.panelSub}>Sold out!</Text>}
              </ScrollView>
              <Btn small variant="secondary" label={`Reroll (${rerollCost(run)}¢)`} disabled={run.coins < rerollCost(run)} onPress={() => { band.cue('reelSpin'); dispatch({ type: 'REROLL' }); }} />
            </>
          )}
          {next && nextDisplay && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <EnemyAvatar enemy={nextDisplay} size={30} mood="menacing" lightweight />
              <Text style={st.panelSub}>Next: {nextDisplay.name} · {next.hp} HP</Text>
            </View>
          )}
          <Btn testID="next-wave" label="Next wave" icon="lorc/crossed-swords" onPress={() => { band.cue('tap'); dispatch({ type: 'NEXT_WAVE' }); }} />
        </PopIn>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  root: { flex: 1 },
  hud: { backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, gap: 6 },
  hudTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bossTag: { fontWeight: '900', fontSize: 10, letterSpacing: 1.5, color: INK, backgroundColor: COLORS.actionYellow, borderWidth: 1.5, borderColor: INK, borderRadius: 4, paddingHorizontal: 5, overflow: 'hidden' },
  // The battle stage: a strip of the world the fight happens in
  stage: { borderRadius: 14, borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },
  // (the ground is clipped to the stage's corners; the words are not, so a long line can spill instead of pushing)
  stageClip: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 12, overflow: 'hidden' },
  stageGround: { position: 'absolute', left: -30, right: -30, bottom: -46, height: 74, borderRadius: 200, opacity: 0.75 },
  // The words sit at the bottom of their row, just above the fighter's head
  stageSpeech: { height: STAGE.speechPx, justifyContent: 'flex-end', paddingBottom: 8, zIndex: 2 },
  stageFloor: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  stageSide: { alignItems: 'center', gap: 2 },
  stageMiddle: { flex: 1, minWidth: 0, alignSelf: 'center', alignItems: 'center', gap: 4, paddingVertical: 2 },
  pauseBtn: { width: 34, height: 34, borderRadius: 6, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  pauseText: { fontWeight: '900', color: INK, letterSpacing: -1 },
  heartsPill: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  heartsText: { fontWeight: '900', color: INK, fontSize: 11, fontVariant: ['tabular-nums'] },
  foeName: { fontWeight: '900', fontSize: 15, color: INK, flexShrink: 1 },
  wave: { fontWeight: '900', fontSize: 11, color: INK, letterSpacing: 1 },
  hpTrack: { height: 20, borderRadius: 4, borderWidth: 2, borderColor: INK, backgroundColor: '#F1E9E0', overflow: 'hidden', justifyContent: 'center' },
  hpFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  hpTrail: { backgroundColor: '#FFE9A8' },
  hpText: { textAlign: 'center', fontWeight: '900', fontSize: 11, color: INK, fontVariant: ['tabular-nums'] },
  hpEndless: { fontSize: 16, lineHeight: 18, color: COLORS.canvasWhite },
  doneBtn: { backgroundColor: COLORS.actionYellow, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 2 },
  doneText: { fontWeight: '900', fontSize: 12, letterSpacing: 1, color: INK },
  idleTrack: { height: 5, borderRadius: 3, backgroundColor: '#EEE', overflow: 'hidden' },
  idleFill: { height: '100%', backgroundColor: COLORS.impactOrange },
  counters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingLeft: 8 },
  counter: { fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  counterHot: { color: COLORS.impactOrange },
  comboPill: { backgroundColor: COLORS.impactOrange, borderRadius: 999, borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingVertical: 1 },
  comboText: { fontSize: 13, fontWeight: '900', color: COLORS.canvasWhite, fontVariant: ['tabular-nums'] },
  counterDim: { fontSize: 10, fontWeight: '700', color: TONE.spent, fontVariant: ['tabular-nums'] },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 18, backgroundColor: '#FDE68A' },
  bannerWrap: { position: 'absolute', left: 0, right: 0, zIndex: 250 },
  openingLayer: { ...StyleSheet.absoluteFillObject, zIndex: 245 },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  statWarn: { backgroundColor: '#FFE1DE', borderColor: COLORS.impactRed },
  statHeld: { backgroundColor: '#D4F4EE', borderColor: COLORS.logicTeal },
  statText: { fontWeight: '900', color: INK, fontSize: 13, fontVariant: ['tabular-nums'] },
  hintBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, backgroundColor: COLORS.actionYellow },
  xpTrack: { height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.paperBeige, overflow: 'hidden', justifyContent: 'center' },
  xpFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#7AC8FF' },
  xpText: { fontSize: 9, fontWeight: '900', color: INK, textAlign: 'center' },
  synergyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  arcanaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: TONE.arcanaPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.arcana, paddingHorizontal: 7, paddingVertical: 2 },
  arcanaChipText: { fontSize: 10, fontWeight: '900', color: TONE.arcana },
  purityChip: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%', backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 7, paddingVertical: 2 },
  purityChipHot: { backgroundColor: '#CCFBF1', borderColor: TONE.upside },
  purityChipText: { flexShrink: 1, fontSize: 10, fontWeight: '800', color: INK },
  evoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', backgroundColor: TONE.comboPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.arcana, paddingHorizontal: 7, paddingVertical: 2 },
  evoChipReady: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  evoChipText: { flexShrink: 1, fontSize: 10, fontWeight: '900', color: INK },
  frozen: { position: 'absolute', top: 10, alignSelf: 'center', zIndex: 60, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#1D4ED8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  frozenText: { fontWeight: '900', color: '#1D4ED8', letterSpacing: 1 },
  challenge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.paperBeige, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  challengeMet: { backgroundColor: '#D4F4EE' },
  challengeStar: { color: '#E0A800', fontSize: 11, fontWeight: '900' },
  challengeText: { flex: 1, fontSize: 12, fontWeight: '700', color: INK },
  boardWrap: { flex: 1, padding: 6 },
  surgeBar: { marginHorizontal: 10, marginTop: 4, height: 22, borderRadius: 999, borderWidth: 2, borderColor: INK, backgroundColor: TONE.surgePale, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  surgeBarSoon: { borderColor: TONE.surge },
  surgeBarLive: { borderColor: TONE.surge, backgroundColor: '#9D174D' },
  surgeFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#FBCFE8' },
  surgeFillLive: { backgroundColor: TONE.surge },
  surgeText: { flexShrink: 1, fontSize: 11, fontWeight: '900', color: INK, letterSpacing: 0.5 },
  tipDim: { position: 'absolute', left: 0, right: 0, zIndex: 299, backgroundColor: 'rgba(10,10,10,0.5)' },
  tipWrap: { position: 'absolute', left: 0, right: 0, zIndex: 300, alignItems: 'center', paddingHorizontal: 12 },
  tipArrow: { width: 18, height: 18, backgroundColor: COLORS.actionYellow, transform: [{ rotate: '45deg' }], marginBottom: -11, alignSelf: 'flex-start', marginLeft: 70 },
  tipCard: { width: '100%', maxWidth: 460, backgroundColor: DARK.panel, borderRadius: 14, borderWidth: 1, borderColor: DARK.goldEdge(0.4), overflow: 'hidden' },
  tipRule: { height: 4, backgroundColor: COLORS.actionYellow },
  tipBody: { padding: 16, gap: 12 },
  tipHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: COLORS.actionYellow, alignItems: 'center', justifyContent: 'center' },
  tipEyebrow: { color: COLORS.actionYellow, fontWeight: '800', letterSpacing: 2, fontSize: 10, textTransform: 'uppercase' },
  tipTitle: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 20 },
  tipText: { color: DARK.text, fontSize: 16, lineHeight: 23 },
  tipBtn: { backgroundColor: COLORS.actionYellow, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  tipBtnText: { color: INK, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,18,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 420, backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 7, borderColor: INK, padding: 18, gap: 10 },
  panelTitle: { fontSize: 24, fontWeight: '900', color: INK, textAlign: 'center' },
  panelSub: { fontSize: 14, color: INK, textAlign: 'center', opacity: 0.85 },
  panelHint: { fontSize: 12, color: INK, opacity: 0.6, textAlign: 'center' },
  gearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  gearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, maxWidth: 160 },
  gearText: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: INK },
  pickCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2.5, borderBottomWidth: 4, borderRadius: 10, padding: 10, backgroundColor: COLORS.canvasWhite },
  pickIcon: { width: 46, height: 46, borderRadius: 8, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  pickName: { fontWeight: '900', color: INK, fontSize: 15 },
  pickRarity: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pickDesc: { fontSize: 13, color: INK, opacity: 0.85 },
});

export default AdventureRun;
