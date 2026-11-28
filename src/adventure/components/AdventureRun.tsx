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
import Animated, { cancelAnimation, useSharedValue, useAnimatedStyle, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardBoardProvider, type CardBoardOverlay } from '@/components/Card';
import GameBoard from '@/components/GameBoard';
import Icon, { type IconName } from '@/components/Icon';
import { PauseAudioPills, SettingsSheet } from '@/components/SettingsSheet';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import type { FighterAvatarReactionEvent } from '@/components/fighters/FighterAvatar';
import { FighterBuildAura, deriveBuildTheme } from '@/components/fighters/FighterBuildAura';
import { WeaponAvatar } from '@/components/weapons';
import { useAppActive } from '@/hooks/useAppActive';
import { useCombatShake } from '@/hooks/useCombatShake';
import { KEY_PRIORITY, useKeyboardNav } from '@/hooks/useKeyboardNav';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useEnemyConductor } from '@/hooks/useEnemyConductor';
import { useFighterConductor } from '@/hooks/useFighterConductor';
import { COLORS } from '@/utils/colors';
import {
  triggerEvolutionHaptic,
  triggerHealHaptic,
  triggerHurtHaptic,
  triggerImpactHaptic,
  triggerKoHaptic,
  triggerParryHaptic,
} from '@/utils/haptics';
import { formatCardTraitValue, formatChallengeText, getColorblindMode, useColorblind } from '@/utils/cardColors';
import { ACCESSIBLE, EASE, MS, OVERLAP, SPRING, STAYS } from '@/utils/motion';
import { recordComponentRender, registerInterval } from '@/utils/perfWatchdog';
import { scaleText, useTextScale } from '@/utils/textSizeStorage';
import type { Card, CardReward, CharacterName, Weapon } from '@/types';
import { getAdjacentIndices, type WeaponEffectResult } from '@/utils/weaponEffects';
import { band, music, sfx } from '@/audio';
import { moodOf, playSounds, soundsFor } from '@/audio/fightAudio';
import type {
  AdventureSave,
  CoopCombatGiftKind,
  CoopCombatSession,
  FeatureFlag,
  LevelDef,
  ParryRequirement,
  PassiveId,
  RunEventType,
  RunReliefOptions,
  RunState,
  SynergyAttrId,
  SynergyCounters,
} from '../types';
import type { WeaponBuilds } from '../data/weaponStats';
import { activeEnemyCounters, computeStars, createRun, isSacrificeUnlocked, runReducer, shopPrice, rerollCost, xpForLevel, type RunAction, type RunOverrides } from '../engine/run';
import { boardHasCounterSet } from '../engine/parry';
import { randomSeed } from '../engine/rng';
import { FightRecorder, type FightTape } from '../engine/replay';
import { challengeProgress } from '../engine/challenges';
import { GearChips, gearModifiers, hasTrickGearChips } from './GearChips';
import { growthStacks } from '../data/weaponGrowth';
import { MECHANICS } from '../data/mechanics';
import { getBiome } from '../data/biomes';
import { FIGHTERS } from '../data/fighters';
import { foeDisplay } from '../data/foes';
import { MAIN_LEVELS } from '../data/levels';
import { STORY_RAIDER_TAUNTS } from '../data/story';
import { comboWindowFor, getPassive, DEFAULT_COMBO_WINDOW_MS, PASSIVE_TUNING } from '../data/passives';
import { arcanaShortName, getArcana } from '../data/arcana';
import { getWeaponEvolution } from '../data/evolutions';
import { SURGE_RULES } from '../data/rules';
import { weaponLevelSuffix } from '../data/armory';
import { consecutiveLossesFor } from '../data/relief';
import { COACH_KEYS, type ResultApplication } from '../progress';
import {
  EVO_ALMOST_COACH_KEY,
  checksOfSet,
  computeLiveGuidance,
  describeSingleCardTraits,
  evoAlmostOnboardingCallout,
  explainInvalidPick,
  fightRemarks,
  foeMidFightBark,
  parryOnboardingCallout,
  resolvePracticeFeatures,
  resolvePracticeLevel,
  shouldShowDamageNumbers,
  shouldShowPassiveHud,
  showsTraitChecks,
  traitAddedBy,
} from '../coach';
import StageBackdrop from './StageBackdrop';
import StageBubble from './StageBubble';
import TraitChecks, { TRAIT_CHECKS_HEIGHT } from './TraitChecks';
import { EVOLUTION_CHASSIS, activeWeaponEvolutions } from '../engine/sources';
import { Anchor, AnchorsProvider, EVENT_FX, EvolutionCutIn, FX_TIMING, FxStage, GearBelt, KillCamOverlay, MultiplierIgnition, SLOWMO_HOLD_MS, SLOWMO_IMPACT_DELAY_MS, SLOWMO_REDUCED_TOTAL_MS, SLOWMO_RELEASE_MS, SLOWMO_SETTLE_PAD_MS, fxClock, scriptFor, useAnchors, useFightFx, type Beat } from '../fx';
import type { EvolutionCutInEntry } from '../fx/EvolutionCutIn';
import { combatShakeKindOf, hitKindOf } from '../fx/catalog';
import { SLOWMO_BOSS_EXTRA_HOLD_MS, SLOWMO_BRISK_TOTAL_MS, resolveKillCamMode } from '../fx/KillCamOverlay';
import { evolutionIdOfEvent, flightFor } from '../fx/script';
import { counterForWeapon } from '../fx/GearBelt';
import { buildAllLiveEvolutions } from '../ui/evolutionViewModel';
import { beltSynergyAttrSet } from '../ui/synergyMeta';
import { Banner } from '../fx/visuals';
import { Btn, CoinPill, DARK, Eyebrow, Heart, INK, PopIn, TONE } from './ui';
import { EvolutionBanner, MegaFlash, type EvolutionBannerEntry } from './RunFx';
import DefeatFreezeOverlay, { resolveFatalSource } from './DefeatFreezeOverlay';
import DefeatOverlay from './DefeatOverlay';
import WeaponExplainer from './WeaponExplainer';
import HudInspector, { type HudInspectTarget } from './HudInspector';
import ParryIntentBar from './ParryIntentBar';
import CoopAllyHud from './CoopAllyHud';
import CoopCageOverlay from './CoopCageOverlay';
import { WeaponOfferRow } from './SharedCards';
import { getDevOverrides, subscribeDevOverrides, type DevOverrides } from '../engine/devOverrides';
import FightDebugDrawer, { type FightDebugActions } from './FightDebugDrawer';
import TrainingLabBar, { type DummyMode, type TrainingLabActions } from './TrainingLabBar';

const TICK_MS = 250;
const COOP_GIFT_CHARGE_MAX = 4;
const shortCoopName = (raw?: string): string => {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'Ally';
  if (trimmed.length <= 8) return trimmed;
  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1];
  return last && last.length <= 9 ? last : trimmed.slice(0, 8);
};
const COOP_EMOTE_LABELS: Readonly<Record<string, string>> = {
  cheer: 'cheers you on!',
  nice: 'says NICE SET!',
  parry: 'calls PARRY READY!',
  help: 'needs backup!',
  gift: 'sent a gift!',
  ready: 'is ready!',
};
/** [FX-21] Picked Set cards refill right after thrown flight clears slots (was 560 ms) */
const REPLACE_DELAY_MS = 260;
/** [FX-21] Collateral weapon-destroyed cards refill after blast/beam bursts finish painting */
const REPLACE_COLLATERAL_DELAY_MS = 460;
/** [FX-21] Invalid-pick refill delay right after CardMotion's 300 ms miss-leave fade (was 520 ms) */
const REPLACE_INVALID_DELAY_MS = 380;

/** How long the foe's taunt is up as a fight (or a wave) opens, before your fighter speaks */
const FOE_TAUNT_MS = 2400;
/** [OB-15] Capped taunt length on mechanic-intro levels so opening coaching shows quickly */
const INTRO_TAUNT_MS = 900;
/** [OB-16] Non-blocking banner hold before auto-advancing shopless waves (e.g. 3-3) */
const AUTO_WAVE_MS = 650;

/** Defeat metadata recorded once by AdventureMode when DefeatOverlay mounts ([OB-13]). */
export interface RecordedDefeat {
  result: ResultApplication;
  bestDpm: number | null;
  fightId: string;
  recordAt: number;
}

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
const STAGE = {
  minShort: 44,
  min: 52,
  minMid: 62,
  wideH: 156,
  wideFrom: 900,
  maxGuide: 112,
  maxSparse: 98,
  chromePx: 112,
  roomy: 94,
  speechPx: 38,
} as const;

/** [UI-17]/[UI-15] Compute >=44x44px touch target hitSlop; portrait lower-rail uses bottom: 0 to protect row-0 cards. */
const hitSlopFor = (w: number, h: number, noBottomBleed = false) => {
  const dx = Math.max(0, Math.ceil((44 - w) / 2));
  const needY = Math.max(0, 44 - h);
  if (noBottomBleed) return { top: needY, bottom: 0, left: dx, right: dx };
  const dy = Math.ceil(needY / 2);
  return { top: dy, bottom: dy, left: dx, right: dx };
};

/** 1-time session flag for the unobtrusive hold-to-inspect mid-Set tooltip ([UI-15]). */
let hudInspectTipShown = false;
const NOOP = () => {};

export const resetHudInspectTipForTest = () => {
  hudInspectTipShown = false;
};

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
  /** True when timing out counts as a defeat rather than a 1★ survival (e.g. Starfall Summit) */
  requireKnockoutToWin?: boolean;
  /** True for starless modes so KillCam uses knockout/untouched copy instead of 1–3★ tiers */
  starlessVictory?: boolean;
  /** True when the current fight is an Elite encounter (Starfall Summit) */
  isEliteEncounter?: boolean;
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
  /** Optional relief / Tailwind / Cauldron Wager run options ([GP-10] / [GP-16]) */
  relief?: RunReliefOptions;
  /** Optional explicit feature set (defaults to campaign progression for `level`) */
  featuresOverride?: Set<FeatureFlag>;
  /** Optional mode-agnostic HUD & pause chrome overrides */
  chrome?: FightChromeOptions;
  /** [OB-13] Record a defeat once and display DefeatOverlay in-place over the paused board */
  onDefeatRecorded?: (run: RunState, tape: FightTape) => RecordedDefeat;
  /** [OB-13] Open full LevelResults breakdown from DefeatOverlay without re-recording telemetry */
  onShowDefeatBreakdown?: (run: RunState, recorded: RecordedDefeat) => void;
  /** [OB-13] Commit staged defeat telemetry and return fresh save/relief for `<250ms` in-place retry */
  onDefeatRetryStart?: () => { save: AdventureSave; relief: RunReliefOptions };
  /** [OB-13] Jump from DefeatOverlay directly into Camp (optionally to Skill Tree, Workshop, Armory, or Bounties) */
  onDefeatCamp?: (tab?: 'fighters' | 'workshop' | 'armory' | 'bounties') => void;
  /** [OB-13] Return to the World Map from DefeatOverlay */
  onDefeatMap?: () => void;
  /** [OB-13] Toggle Friendly Tailwind directly from DefeatOverlay */
  onToggleTailwind?: (active: boolean) => void;
  /** True when mounted as a quick retry (skips opening FIGHT! banner & foe taunt) */
  initialIsRetry?: boolean;
  /** [TP-12] Optional label & direct return handler when 1-4D Training Lab was launched from Camp or LevelPreview */
  sandboxReturnLabel?: string;
  onSandboxReturn?: () => void;
  /** Optional decoupled 2P Co-Op session (Starfall Summit Duo; zero WebSocket dependency) */
  coopSession?: CoopCombatSession;
}

const parryCounterForDummyMode = (mode?: DummyMode): ParryRequirement => {
  switch (mode) {
    case 'counter_color':
      return { kind: 'color', color: 'red' };
    case 'counter_shape':
      return { kind: 'shape', shape: 'oval' };
    case 'counter_rainbow':
      return { kind: 'all_different' };
    default:
      return { kind: 'any' };
  }
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
  relief,
  featuresOverride,
  chrome,
  onDefeatRecorded,
  onShowDefeatBreakdown,
  onDefeatRetryStart,
  onDefeatCamp,
  onDefeatMap,
  onToggleTailwind,
  initialIsRetry = false,
  sandboxReturnLabel,
  onSandboxReturn,
  coopSession,
}) => {
  recordComponentRender('AdventureRun');
  const isCoop = Boolean(coopSession || runOverrides?.isCoop);
  const coopSessionRef = useRef(coopSession);
  coopSessionRef.current = coopSession;
  const insets = useSafeAreaInsets();
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const colorblind = useColorblind();
  const textScale = useTextScale();
  // The save the fight started from and every action sent to it: enough to replay the fight (engine/replay.ts)
  const [startSave, setStartSave] = useState(save);
  const [activeRelief, setActiveRelief] = useState(relief);
  const [isRetry, setIsRetry] = useState(initialIsRetry);
  const [attemptKey, setAttemptKey] = useState(0);
  const [defeatOverlay, setDefeatOverlay] = useState<{ run: RunState; recorded: RecordedDefeat } | null>(null);
  const [defeatFreezeActive, setDefeatFreezeActive] = useState(false);
  const defeatHandledRef = useRef(false);
  const defeatFreezeStartedRef = useRef(false);
  const finaleFiredRef = useRef(false);
  const finishedFiredRef = useRef(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finaleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // [FX-23] Unified Beat.onLand sync bus state for MultiplierIgnition & KillCamOverlay
  const [leadLandSeq, setLeadLandSeq] = useState(0);
  const [leadImpactMs, setLeadImpactMs] = useState<number>(FX_TIMING.flightMs);
  const [lethalLanded, setLethalLanded] = useState(false);
  const pendingDamageRef = useRef(0);
  // [OB-11] Dynamic 1-4D Back Field resolves only traits & features unlocked in save
  const effectiveLevel = useMemo(() => resolvePracticeLevel(level, startSave), [level, startSave]);
  const effectiveOverrides = useMemo<RunOverrides | undefined>(() => {
    if (!runOverrides && !isCoop) return undefined;
    return isCoop ? { ...runOverrides, isCoop: true } : runOverrides;
  }, [runOverrides, isCoop]);
  const [run, setRun] = useState(() => {
    const resolved = resolvePracticeLevel(level, save);
    const resolvedFeatures = featuresOverride ?? resolvePracticeFeatures(level, save);
    return createRun(resolved, save, {
      seed,
      ...(resolvedFeatures ? { features: resolvedFeatures } : {}),
      ...(effectiveOverrides ? { overrides: effectiveOverrides } : {}),
      ...(relief ? { relief } : {}),
    });
  });
  const runRef = useRef(run);
  runRef.current = run;
  const recorder = useRef(new FightRecorder(seed));
  const pendingCoopParryRef = useRef<{ perfect: boolean; staggerMs: number } | null>(null);
  const pendingCoopSynergyRef = useRef<Partial<SynergyCounters>>({});
  const [coopOutboundTick, setCoopOutboundTick] = useState(0);
  // Reduce here, synchronously, so each recorded action is paired with exactly the state it was applied to
  const dispatch = useCallback((a: RunAction) => {
    const before = runRef.current;
    recorder.current.record(a, before);
    const next = runReducer(before, a);
    runRef.current = next;
    if (next !== before) {
      if (coopSessionRef.current) {
        let queuedOutbound = false;
        if (a.type === 'MATCH' && next.parriesLanded > before.parriesLanded) {
          const perfect = next.perfectParriesLanded > before.perfectParriesLanded;
          const staggerMs = next.parry?.phase === 'staggered' ? next.parry.msLeft : 0;
          pendingCoopParryRef.current = { perfect, staggerMs };
          queuedOutbound = true;
        }
        if (a.type !== 'COOP_SYNC_SYNERGY' && a.type !== 'COOP_SYNC_BOSS') {
          for (const key of Object.keys(next.synergy) as SynergyAttrId[]) {
            const delta = next.synergy[key] - before.synergy[key];
            if (delta > 0) {
              pendingCoopSynergyRef.current[key] = (pendingCoopSynergyRef.current[key] ?? 0) + delta;
              queuedOutbound = true;
            }
          }
        }
        if (queuedOutbound) setCoopOutboundTick(t => t + 1);
      }
      setRun(next);
    }
  }, []);
  const recordingOf = useCallback((): FightTape => ({
    recording: recorder.current.toJSON(),
    save: startSave,
    choices: recorder.current.choicesJSON(),
  }), [startSave]);
  const [paused, setPaused] = useState(false);
  /** [UI-21] Global SettingsSheet opened from Pause → "All Settings" (the fight stays paused underneath) */
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** [UI-23] Keyboard card-slot hotkey + Backspace clear, handed to GameBoard's tap path */
  const [keyCardSlot, setKeyCardSlot] = useState<{ index: number; seq: number } | null>(null);
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0);
  const [hudHeight, setHudHeight] = useState(150);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [lastMatchTime, setLastMatchTime] = useState(Date.now());
  const [megaFlash, setMegaFlash] = useState(0);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const stageWidthRef = useRef(375);
  stageWidthRef.current = stage.w > 0 ? stage.w : 375;
  /** A weapon on the belt the player tapped to read about (the fight waits) */
  const [inspect, setInspect] = useState<Weapon | null>(null);
  /** Another HUD chip/bar/goal was tapped to inspect (the fight waits) */
  const [hudInspect, setHudInspect] = useState<HudInspectTarget | null>(null);
  /** [UI-15] 1-time subtle tip teaching hold-to-inspect mid-Set on portrait touchscreens */
  const [showInspectGuardTip, setShowInspectGuardTip] = useState(false);
  /** The first evolution ever: its cut-in also points at the belt timer */
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
  /** [OB-08] Evolutions that already showed their cut-in once (repeat awakenings use non-blocking banner) */
  const seenCutInEvosRef = useRef<Set<string>>(new Set(save.discoveredEvolutions));
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const biome = getBiome(effectiveLevel.biome);
  const ended = run.status === 'won' || run.status === 'lost';
  /** A practice fight never ends by itself: the player leaves with Done */
  const practice = !!effectiveLevel.rules.sandbox;
  const isDevBuild = typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
  const [devOverrides, setDevOverrides] = useState<DevOverrides>(() => getDevOverrides());
  useEffect(() => (isDevBuild ? subscribeDevOverrides(setDevOverrides) : undefined), [isDevBuild]);
  const [dummyMode, setDummyMode] = useState<DummyMode>('immortal');
  const activeEvoCount = useMemo(
    () => activeWeaponEvolutions(run.weaponEvolutions).length,
    [run.weaponEvolutions]
  );
  const liveEvolutions = useMemo(
    () => buildAllLiveEvolutions(run.weaponEvolutions, { colorblind }),
    [run.weaponEvolutions, colorblind]
  );
  const liveEvoByWeapon = useMemo(
    () => new Map(liveEvolutions.map(e => [e.weaponId, e])),
    [liveEvolutions]
  );
  const beltWeaponIds = useMemo(() => run.weapons.map(w => w.id), [run.weapons]);
  const buildTheme = useMemo(
    () => deriveBuildTheme(run.weapons.map(w => w.id), activeEvoCount, run.arcana.length),
    [run.weapons, activeEvoCount, run.arcana.length]
  );

  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);

  // [OB-15] + [OB-19]: Coaching-first opening! Suppress taunt on 1-1 & retries; cap at 900ms on mechanic-intro levels.
  const isFirstLevel = effectiveLevel.id === MAIN_LEVELS[0].id;
  const isMechanicIntroLevel = !startSave.seenMechanics.includes(effectiveLevel.introduces);
  const rawTaunt = effectiveLevel.rules.sandbox
    ? undefined
    : (run.wave === 0 && STORY_RAIDER_TAUNTS[effectiveLevel.id]
      ? STORY_RAIDER_TAUNTS[effectiveLevel.id]
      : effectiveLevel.foes[run.wave]?.taunt);
  const tauntDurationMs = isFirstLevel || isRetry ? 0 : isMechanicIntroLevel ? INTRO_TAUNT_MS : FOE_TAUNT_MS;
  const taunt = tauntDurationMs > 0 ? rawTaunt : undefined;
  const [taunting, setTaunting] = useState(!!taunt);
  useEffect(() => {
    setTaunting(Boolean(taunt && tauntDurationMs > 0));
  }, [run.wave, taunt, tauntDurationMs, attemptKey]);

  // If the player starts picking right away, cede the stage to live guidance at once
  useEffect(() => {
    if (taunting && (boardSelectedCount > 0 || run.matches > 0)) {
      setTaunting(false);
    }
  }, [taunting, boardSelectedCount, run.matches]);

  // The bell: a banner across the board as the fight opens (skipped on instant retries per [OB-13])
  const [opening, setOpening] = useState(!initialIsRetry);
  const openingBellFiredRef = useRef(false);
  useEffect(() => {
    if (isRetry) {
      setOpening(false);
      return;
    }
    openingBellFiredRef.current = false;
    setOpening(true);
  }, [isRetry, attemptKey]);

  // Pause opening & foe-taunt dismiss timers whenever backgrounded or paused so zero
  // React re-renders or StageBubble animations fire in a hidden tab.
  useEffect(() => {
    if (!taunting || !taunt || tauntDurationMs <= 0 || !appActive || paused) return;
    const t = setTimeout(() => setTaunting(false), tauntDurationMs);
    return () => clearTimeout(t);
  }, [taunting, taunt, tauntDurationMs, appActive, paused]);

  useEffect(() => {
    if (!opening || isRetry || !appActive || paused) return;
    const t = setTimeout(() => setOpening(false), 1100);
    return () => clearTimeout(t);
  }, [opening, isRetry, appActive, paused]);

  const openingBoardRect = anchors.rect('board');
  const hasOpeningBoardRect = Boolean(openingBoardRect);
  useEffect(() => {
    if (!opening || isRetry || practice || openingBellFiredRef.current) return;
    if (effects && !hasOpeningBoardRect) return;
    openingBellFiredRef.current = true;
    // Sync opening bell chime to the exact visual slam frame of the FIGHT! banner (delay 120ms + 48ms slam arrival)
    const slamDelayMs = effects ? 168 : 0;
    const bell = setTimeout(() => {
      band.cue('wave');
    }, slamDelayMs);
    return () => clearTimeout(bell);
  }, [opening, isRetry, practice, effects, hasOpeningBoardRect, attemptKey]);

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
    if (band.inFight) band.setMood(moodNow(run, paused || Boolean(tip) || Boolean(inspect) || Boolean(hudInspect)));
  }, [run, paused, tip, inspect, hudInspect]); // eslint-disable-line react-hooks/exhaustive-deps

  const halted = paused || Boolean(tip) || Boolean(inspect) || Boolean(hudInspect);
  const playing = run.status === 'playing' && !halted;

  // Auto-pause active timed fights whenever the user leaves the app/tab (solo only; co-op stays live)
  useEffect(() => {
    if (!appActive && !isCoop && run.status === 'playing' && !practice) {
      setPaused(true);
    }
  }, [appActive, isCoop, run.status, practice]);

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
  const fighterMood = run.status === 'won' ? 'victory' : run.status === 'lost' || run.caged ? 'defeat' : conductor.mood;

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
    // Stagger foe arrival behind fighter (`OVERLAP.secondaryMs` = 64ms) for clean left-to-right staging
    const t = setTimeout(() => triggerEnemyReaction('entrance'), OVERLAP.secondaryMs);
    return () => clearTimeout(t);
  }, [triggerEntrance, triggerEnemyReaction, attemptKey]);

  // [FX-01] Foe impact transform collision removed: EnemyAvatar is the single transform owner.
  // [FX-18] Unified deterministic, viewport-scaled, ScreenShakeStorage- & ReducedMotion-gated combat shake + victory push-in.
  const { triggerCombatShake, cancelCombatShake, shakeValues } = useCombatShake({
    enabled: effects,
    reduced: reducedMotion,
    stageW: stage.w || 375,
  });
  const victoryZoom = useSharedValue(1);
  const victoryPanY = useSharedValue(0);

  useEffect(() => () => {
    cancelCombatShake();
    cancelAnimation(victoryZoom);
    cancelAnimation(victoryPanY);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (finaleTimerRef.current) clearTimeout(finaleTimerRef.current);
  }, [cancelCombatShake, victoryZoom, victoryPanY]);

  // [FX-23] Unified Beat.onLand sync bus: coordinates MultiplierIgnition slam, KillCamOverlay,
  // viewport-scaled combat shake, creature reactions, fighter vocal calls, and impact haptics.
  const onLand = (beat: Beat) => {
    const { row, tier } = beat;
    const evType = beat.event.type;

    if (beat.lead) {
      setLeadLandSeq(s => s + 1);
    }
    if (beat.damage > 0) {
      pendingDamageRef.current = Math.max(0, pendingDamageRef.current - beat.damage);
    }
    if (
      runRef.current.status === 'won' &&
      ((beat.damage > 0 && pendingDamageRef.current <= 0) || evType === 'foe_defeated')
    ) {
      setLethalLanded(true);
    }

    const shakeKind = combatShakeKindOf(evType, tier);
    if (!beat.quiet && shakeKind) {
      triggerCombatShake(shakeKind, stageWidthRef.current);
    }
    if (tier === 3 && effects && !reducedMotion && runRef.current.status === 'playing') setMegaFlash(f => f + 1);
    switch (row.fighter) {
      case 'ecstatic': conductor.triggerReaction('ecstatic'); break;
      case 'pain': conductor.triggerReaction('pain'); break;
      case 'heal': conductor.triggerHeal(); break;
      case 'powerup': conductor.triggerPowerup(); break;
      case 'entrance': triggerEntrance(); break;
    }
    switch (row.enemy) {
      case 'criticalHit':
        triggerEnemyReaction('crit_pain', { hitTier: tier, hitKind: hitKindOf(evType), moveKind: evType });
        break;
      case 'hit':
        triggerEnemyReaction('pain', { hitTier: tier, hitKind: hitKindOf(evType), moveKind: evType });
        break;
      case 'gloat': triggerEnemyReaction('taunt'); break;
      case 'attack': triggerEnemyReaction('attack'); break;
      case 'regen': triggerEnemyReaction('regen'); break;
      case 'entrance': triggerEnemyReaction('entrance'); break;
    }
    // [AU-07]: Short scale-locked fighter vocal calls (1.8s per-fighter cooldown enforced in band)
    if (typeof band?.fighterCall === 'function') {
      if (evType === 'parry' || evType === 'perfect_parry') {
        band.fighterCall(runRef.current.fighter, 'signature');
      } else if (evType === 'hurt' || evType === 'foe_strike' || row.fighter === 'pain') {
        band.fighterCall(runRef.current.fighter, 'hurt');
      } else if (row.fighter === 'ecstatic' || tier >= 2) {
        band.fighterCall(runRef.current.fighter, 'cheer');
      }
    }
    // [AU-21]: Impact-synced priority-scaled combat haptics aligned to exact beat landing frame
    if (evType === 'perfect_parry') {
      void triggerParryHaptic(true);
    } else if (evType === 'parry') {
      void triggerParryHaptic(false);
    } else if (evType === 'foe_defeated') {
      void triggerKoHaptic(Boolean(level.isBoss) || runRef.current.lastSetIgnition?.parryKind === 'perfect');
    } else if (evType === 'hurt' || evType === 'foe_strike') {
      void triggerHurtHaptic();
    } else if (evType === 'heal' || evType === 'breather') {
      void triggerHealHaptic();
    } else if (evType === 'evolution_start') {
      void triggerEvolutionHaptic();
    } else if (row.damage || beat.damage > 0) {
      void triggerImpactHaptic(tier);
    }
  };

  // The stage plays each move as a cascade; the band plays each stretch of it as it starts, in step with it
  const fx = useFightFx({
    anchors,
    reduced: !effects,
    onSegment: segment => {
      const slip = playSounds(
        soundsFor(segment.events, { weapons: runRef.current.weapons.map(w => w.id), combo: runRef.current.combo }),
        segment.stride
      );
      const clampedSlip = typeof slip === 'number' && Number.isFinite(slip) ? Math.max(0, Math.min(32, slip)) : 0;
      const leadBeat = segment.beats.find(b => b.lead);
      if (leadBeat) {
        const plannedImpact = leadBeat.land > 0 ? leadBeat.land + clampedSlip : flightFor(band.gridMs) + clampedSlip;
        setLeadImpactMs(plannedImpact);
      }
      return slip;
    },
    onLand,
  });

  // The fight clock stands still while a cascade plays, a cut-in waits, or the app is backgrounded.
  // In 2P Co-Op, cascades stay non-blocking so remote sync never stalls either player's clock.
  const ticking = appActive && playing && (isCoop || !fx.busy);
  const clockHeld = !isCoop && fx.busy;
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
    const fightEnded = run.status === 'won' || run.status === 'lost';
    // [OB-08] Repeat awakenings use non-blocking EvolutionBanner (first awakening plays full Cut-In)
    const bannerOnlyEvolutions = new Set(seenCutInEvosRef.current);
    const nextScript = scriptFor(staged, {
      weapons: run.weapons,
      gridMs: band.gridMs,
      reduced: !effects,
      skipCutIn: fightEnded,
      bannerOnlyEvolutions,
      bannerOnlyRecipes: bannerOnlyEvolutions,
      forceBanner: isCoop,
    });
    const addedDamage = nextScript.segments.reduce(
      (sum, seg) => sum + (seg.kind === 'beats' ? seg.beats.reduce((d, b) => d + b.damage, 0) : 0),
      0
    );
    if (addedDamage > 0) pendingDamageRef.current += addedDamage;
    fx.play(nextScript);
    for (const e of fresh) {
      if (e.type === 'evolution_start') {
        const eid = evolutionIdOfEvent(e);
        if (eid) {
          seenCutInEvosRef.current.add(eid);
        }
      }
      if (!fightEnded && !isCoop && e.type === 'evolution_start' && !seenCoach.current.has(COACH_KEYS.evolution)) {
        seenCoach.current.add(COACH_KEYS.evolution);
        onCoachMarkSeen(COACH_KEYS.evolution);
        const eid = evolutionIdOfEvent(e);
        const evoDef = eid ? getWeaponEvolution(eid) : undefined;
        const durSec = Math.max(1, Math.round((evoDef?.durationMs ?? 18_000) / 1000));
        // With effects on, the cut-in itself explains the evolution
        if (effects) setEvolutionHint(true);
        else {
          pushTip({
            id: COACH_KEYS.evolution,
            title: `${evoDef?.name ?? 'Evolution'} awakened!`,
            text: `For ${durSec} seconds: ${evoDef?.tagline ?? 'your evolved weapon is live.'} Every Set also deals +${EVOLUTION_CHASSIS.setFlatDamage} base and +${EVOLUTION_CHASSIS.setAdditiveMult}× mult. Watch the gold timer bar on your weapon belt.`,
            icon: evoDef?.icon ?? 'lorc/crystal-shine',
            anchor: 'top',
            label: 'Evolution',
          });
        }
      }
      if (e.type === 'power_up' && !seenCoach.current.has(COACH_KEYS.weaponGrowth)) {
        seenCoach.current.add(COACH_KEYS.weaponGrowth);
        onCoachMarkSeen(COACH_KEYS.weaponGrowth);
        const msg = 'Weapon grew stronger for this fight! Tap your belt to see how.';
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
  }, [anchors, run.board.length, run.weapons.length, activeEvoCount, run.status, stage.w, stage.h, hudHeight]);
  const slotRef = useCallback((index: number) => anchors.ref(`slot:${index}`), [anchors]);

  // End of run → [FX-08] Stakes-split KillCamOverlay (victory) or 300 ms DefeatFreezeOverlay → DefeatOverlay (defeat)
  const endedAtRef = useRef<number | null>(null);
  const slowMoCinema = effects && !reducedMotion && !practice;
  const victoryImpactDelay = run.lastSetIgnition?.lethal ? SLOWMO_IMPACT_DELAY_MS : 0;
  const isVictoryRun = (s: RunState) => s.status === 'won' && (!chrome?.requireKnockoutToWin || s.endReason === 'defeated');
  const fightVictory = isVictoryRun(run);
  const previousBestStars = startSave.stars[level.id] ?? 0;
  const victoryStars = chrome?.starlessVictory ? null : computeStars(run);
  const isEliteFight = Boolean(chrome?.isEliteEncounter || level.branchOf);
  const killCamMode = resolveKillCamMode({
    isBoss: Boolean(level.isBoss),
    isElite: isEliteFight,
    previousBestStars,
    stars: victoryStars,
  });
  const killCamHoldMs = SLOWMO_HOLD_MS + (level.isBoss ? SLOWMO_BOSS_EXTRA_HOLD_MS : 0);
  const fatalSource = useMemo(
    () => (ended && !fightVictory && !practice ? resolveFatalSource(run) : null),
    [ended, fightVictory, practice, run]
  );

  const fireFinaleOnce = useCallback((won: boolean) => {
    if (finaleFiredRef.current) return;
    finaleFiredRef.current = true;
    band.finale(won);
  }, []);

  const handleKillCamImpact = useCallback(() => {
    if (!slowMoCinema || killCamMode !== 'full') return;
    if (level.isBoss) {
      triggerCombatShake('large', stageWidthRef.current);
    }
    victoryZoom.value = withSequence(
      withTiming(1.045, { duration: MS.hero * 0.72, easing: EASE.enterSoft }),
      withDelay(killCamHoldMs - MS.hero * 0.72, withTiming(1, { duration: SLOWMO_RELEASE_MS, easing: EASE.exitSoft }))
    );
    victoryPanY.value = withSequence(
      withTiming(10, { duration: MS.hero * 0.72, easing: EASE.enterSoft }),
      withDelay(killCamHoldMs - MS.hero * 0.72, withTiming(0, { duration: SLOWMO_RELEASE_MS, easing: EASE.exitSoft }))
    );
    if (finaleTimerRef.current) clearTimeout(finaleTimerRef.current);
    finaleTimerRef.current = setTimeout(() => {
      finaleTimerRef.current = null;
      fireFinaleOnce(true);
    }, killCamHoldMs);
  }, [slowMoCinema, killCamMode, level.isBoss, triggerCombatShake, victoryZoom, victoryPanY, killCamHoldMs, fireFinaleOnce]);

  const handleKillCamSkip = useCallback(() => {
    if (finishedFiredRef.current) return;
    finishedFiredRef.current = true;
    finaleFiredRef.current = true; // KillCamOverlay invokes band.finale(true) on skip
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (finaleTimerRef.current) {
      clearTimeout(finaleTimerRef.current);
      finaleTimerRef.current = null;
    }
    cancelAnimation(victoryZoom);
    cancelAnimation(victoryPanY);
    victoryZoom.value = 1;
    victoryPanY.value = 0;
    onFinish(runRef.current, recordingOf());
  }, [onFinish, recordingOf, victoryZoom, victoryPanY]);

  const handleDefeatFreezeComplete = useCallback(() => {
    setDefeatFreezeActive(false);
    if (defeatHandledRef.current || finishedFiredRef.current) return;
    if (!practice && onDefeatRecorded) {
      defeatHandledRef.current = true;
      const recorded = onDefeatRecorded(runRef.current, recordingOf());
      setDefeatOverlay({ run: runRef.current, recorded });
    } else {
      finishedFiredRef.current = true;
      onFinish(runRef.current, recordingOf());
    }
  }, [practice, onDefeatRecorded, onFinish, recordingOf]);

  useEffect(() => {
    if (!ended) return;
    endedAtRef.current = Date.now();
    const won = isVictoryRun(run);
    // Full KillCam holds band.finale(true) until impact + killCamHoldMs (or tap-to-skip)
    if (won && slowMoCinema && killCamMode === 'full') {
      // Safety fallback in case KillCam impact callback didn't fire (e.g. non-flying win)
      if (finaleTimerRef.current) clearTimeout(finaleTimerRef.current);
      finaleTimerRef.current = setTimeout(() => {
        finaleTimerRef.current = null;
        fireFinaleOnce(true);
      }, victoryImpactDelay + killCamHoldMs + 160);
      return () => {
        if (finaleTimerRef.current) {
          clearTimeout(finaleTimerRef.current);
          finaleTimerRef.current = null;
        }
      };
    }
    fireFinaleOnce(won);
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // If a fight ends while an Evolution cut-in is open or queued, dismiss it so victory/defeat flows smoothly
    if (ended && fx.cutIn) {
      setEvolutionHint(false);
      fx.dismissCutIn();
    }
  }, [ended, fx.cutIn, fx.dismissCutIn]);
  useEffect(() => {
    // The last cascade plays out first; hand off right as KillCam finishes or trigger 300 ms DefeatFreezeOverlay!
    if (!ended || fx.busy || finishedFiredRef.current) return;
    const won = isVictoryRun(runRef.current);
    if (!won && !practice) {
      if (!defeatFreezeStartedRef.current && !defeatHandledRef.current) {
        defeatFreezeStartedRef.current = true;
        setDefeatFreezeActive(true);
      }
      return;
    }
    const targetMs = slowMoCinema
      ? killCamMode === 'full'
        ? victoryImpactDelay + killCamHoldMs + SLOWMO_RELEASE_MS + SLOWMO_SETTLE_PAD_MS
        : victoryImpactDelay + SLOWMO_BRISK_TOTAL_MS
      : SLOWMO_REDUCED_TOTAL_MS;
    const elapsed = endedAtRef.current ? Date.now() - endedAtRef.current : 0;
    const wait = Math.max(80, targetMs - elapsed);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    finishTimerRef.current = setTimeout(() => {
      finishTimerRef.current = null;
      if (finishedFiredRef.current) return;
      finishedFiredRef.current = true;
      onFinish(runRef.current, recordingOf());
    }, wait);
    return () => {
      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
  }, [ended, fx.busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep DefeatOverlay's Tailwind toggle synced when parent updates `save.tailwindActive`
  useEffect(() => {
    setDefeatOverlay(cur =>
      cur && cur.recorded.result.save.tailwindActive !== save.tailwindActive
        ? {
            ...cur,
            recorded: {
              ...cur.recorded,
              result: {
                ...cur.recorded.result,
                save: { ...cur.recorded.result.save, tailwindActive: save.tailwindActive },
              },
            },
          }
        : cur
    );
  }, [save.tailwindActive]);

  // [OB-13] `<250ms` in-place retry: fresh seed, fresh recorder, skips ScreenTransition, FIGHT! banner, and foe taunt
  const handleInstantRetry = useCallback(
    () => {
      const refreshed = onDefeatRetryStart?.();
      const nextSave = refreshed?.save ?? save;
      const nextRelief = refreshed?.relief ?? activeRelief;
      const nextSeed = randomSeed();
      const nextLevel = resolvePracticeLevel(level, nextSave);
      const nextFeatures = featuresOverride ?? resolvePracticeFeatures(level, nextSave);
      const nextRun = createRun(nextLevel, nextSave, {
        seed: nextSeed,
        ...(nextFeatures ? { features: nextFeatures } : {}),
        ...(runOverrides ? { overrides: runOverrides } : {}),
        ...(nextRelief ? { relief: nextRelief } : {}),
      });
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      if (finaleTimerRef.current) {
        clearTimeout(finaleTimerRef.current);
        finaleTimerRef.current = null;
      }
      recorder.current = new FightRecorder(nextSeed);
      lastEventId.current = 0;
      endedAtRef.current = null;
      defeatHandledRef.current = false;
      defeatFreezeStartedRef.current = false;
      finaleFiredRef.current = false;
      finishedFiredRef.current = false;
      pendingDamageRef.current = 0;
      saidRemarks.current.clear();
      saidFoeBarks.current.clear();
      timeTotal.current = nextRun.timeLeft;
      runRef.current = nextRun;
      setStartSave(nextSave);
      setActiveRelief(nextRelief);
      setRun(nextRun);
      setDefeatOverlay(null);
      setDefeatFreezeActive(false);
      setLethalLanded(false);
      setLeadLandSeq(0);
      setIsRetry(true);
      setAttemptKey(k => k + 1);
      setOpening(false);
      setTaunting(false);
      setPaused(false);
      setMistakeNote(null);
      setMistakeCards(null);
      setLastSet(null);
      setEventBannerNote(null);
      setRemark(null);
      setFoeBark(null);
      setBoardSelectedCount(0);
      setBoardSelectedCards([]);
      setLastMatchTime(Date.now());
      band.enterFight(moodNow(nextRun, false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onDefeatRetryStart, save, activeRelief, level, featuresOverride, runOverrides]
  );

  // [OB-16] Auto-advance shopless waves (e.g. 3-3) with a non-blocking banner instead of an empty modal
  const autoWaveIntermission = run.status === 'intermission' && !fx.busy && !run.features.has('shop');
  useEffect(() => {
    if (!autoWaveIntermission) return;
    band.cue('wave');
    const t = setTimeout(() => dispatch({ type: 'NEXT_WAVE' }), AUTO_WAVE_MS);
    return () => clearTimeout(t);
  }, [autoWaveIntermission, dispatch]);

  const markSurgeGuidedProgress = useCallback(() => {
    if (!seenCoach.current.has(COACH_KEYS.surgeGuided1)) {
      seenCoach.current.add(COACH_KEYS.surgeGuided1);
      onCoachMarkSeen(COACH_KEYS.surgeGuided1);
    } else if (!seenCoach.current.has(COACH_KEYS.surgeGuided2)) {
      seenCoach.current.add(COACH_KEYS.surgeGuided2);
      onCoachMarkSeen(COACH_KEYS.surgeGuided2);
    }
  }, [onCoachMarkSeen]);

  const prevSurgeActiveRef = useRef(false);
  useEffect(() => {
    const active = Boolean(run.surge?.active);
    if (prevSurgeActiveRef.current && !active) {
      markSurgeGuidedProgress();
    }
    prevSurgeActiveRef.current = active;
  }, [run.surge?.active, markSurgeGuidedProgress]);

  const handleMatch = useCallback((cards: Card[], rewards: CardReward[], effects?: WeaponEffectResult, info?: { hinted: boolean }) => {
    setLastMatchTime(Date.now());
    setMistakeNote(null);
    setMistakeCards(null);
    setEventBannerNote(null);
    if (runRef.current.surge?.active) markSurgeGuidedProgress();
    const graceUsed = rewards.some(r => r.effectType === 'grace');
    const isMegaMatch =
      Boolean(effects?.explosiveCards.length) ||
      Boolean(effects?.laserCards.length) ||
      Boolean(effects?.ricochetCards.length) ||
      cards.length > 3;
    const didHeal = rewards.some(r => (r.healing ?? 0) > 0) || Boolean(effects?.bonusHealing);
    triggerMatch({
      isGraceMatch: graceUsed,
      isMegaMatch,
      didHeal,
      useThrow: !graceUsed && !didHeal && !isMegaMatch,
    });
    dispatch({ type: 'MATCH', cards, rewards, effects, hinted: info?.hinted });
    // [FX-21] Picked Set cards refill right after thrown flight (260 ms); collateral weapon blasts refill at 460 ms
    const picked = cards.slice(0, 3);
    const pickedIds = picked.map(c => c.id);
    const collateralIds = cards.slice(3).map(c => c.id);
    later(() => dispatch({ type: 'REPLACE', ids: pickedIds }), REPLACE_DELAY_MS);
    if (collateralIds.length > 0) {
      later(() => dispatch({ type: 'REPLACE', ids: collateralIds }), REPLACE_COLLATERAL_DELAY_MS);
    }
    setLastSet(picked);
    later(() => setLastSet(cur => (cur === picked ? null : cur)), LAST_SET_MS);
  }, [dispatch, triggerMatch, later, markSurgeGuidedProgress]);

  // Defensive Grace Save ([GP-04]): consumes 1 Grace, spares heart, cycles 3 cards, 0 base Set damage
  const handleGraceSave = useCallback((cards: Card[]) => {
    setLastMatchTime(Date.now());
    setMistakeNote(null);
    setMistakeCards(null);
    setEventBannerNote(null);
    triggerMatch({ isGraceMatch: true, isMegaMatch: false, didHeal: false });
    dispatch({ type: 'GRACE_SAVE', cards });
    const ids = cards.map(c => c.id);
    later(() => dispatch({ type: 'REPLACE', ids }), REPLACE_DELAY_MS);
  }, [dispatch, triggerMatch, later]);

  const handleInvalid = useCallback((cards: Card[]) => {
    triggerMistake();
    triggerEnemyReaction('taunt');
    setMistakeNote(explainInvalidPick(cards, runRef.current.attributes, runRef.current.fighter, getColorblindMode()));
    setMistakeCards(cards);
    setLastSet(null);
    dispatch({ type: 'INVALID', cards });
    const ids = cards.map(c => c.id);
    later(() => dispatch({ type: 'REPLACE', ids }), REPLACE_INVALID_DELAY_MS);
  }, [dispatch, triggerMistake, triggerEnemyReaction, later]);

  const handleBurn = useCallback((card: Card) => dispatch({ type: 'BURN', card }), [dispatch]);
  const handleUseHint = useCallback(() => {
    triggerHint();
    dispatch({ type: 'USE_HINT' });
    band.cue('hint');
  }, [dispatch, triggerHint]);

  const screenStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeValues.translateX.value },
      { translateY: shakeValues.translateY.value + victoryPanY.value },
      { rotate: `${shakeValues.rotateDeg.value}deg` },
      { scale: victoryZoom.value },
    ],
  }));
  // Damage still in the air has not come off the bar yet (nor has that of events the stage is about to be handed)
  const incoming = effects ? run.events.reduce((sum, e) => (e.id > lastEventId.current && EVENT_FX[e.type]?.damage ? sum + (e.amount ?? 0) : sum), 0) : 0;
  const shownHp = Math.min(run.foeMaxHp, Math.round(run.foeHp + fx.pendingDamage + incoming));
  const challenge = challengeProgress(run);
  const gearMods = gearModifiers(run);
  const xpNeed = xpForLevel(run.xpLevel);
  const comboLive = run.elapsedMs - run.lastMatchAtMs <= comboWindowMs(run);
  const purityLive = run.features.has('purity') && run.purityChain > 0;
  const enemyCounters = useMemo(
    () => activeEnemyCounters({ foe: run.foe, stats: run.stats, baseChances: run.baseChances }),
    [run.foe, run.stats, run.baseChances]
  );

  const mirrorActive = (gearMods.mirrorDamage ?? 0) > 0;
  const mirrorDepth = Math.round(gearMods.mirrorDepth ?? 0);
  const tightropeActive = (gearMods.tightropeDamage ?? 0) > 0;
  const mirrorCardIds = useMemo(() => {
    if (!mirrorActive || run.gear.lastSetSlots.length === 0) return undefined;
    const slots = [run.gear.lastSetSlots, ...run.gear.mirrorMemory.slice(0, mirrorDepth)].flat();
    const ids = new Set<string>();
    for (const idx of slots) {
      const id = run.board[idx]?.id;
      if (id) ids.add(id);
    }
    return ids.size > 0 ? ids : undefined;
  }, [mirrorActive, mirrorDepth, run.board, run.gear.lastSetSlots, run.gear.mirrorMemory]);
  const tightropeCardIds = useMemo(() => {
    if (!tightropeActive || run.gear.lastSetSlots.length === 0) return undefined;
    const ids = new Set<string>();
    for (const idx of run.gear.lastSetSlots) {
      const selfId = run.board[idx]?.id;
      if (selfId) ids.add(selfId);
      for (const adj of getAdjacentIndices(idx, run.board.length)) {
        const adjId = run.board[adj]?.id;
        if (adjId) ids.add(adjId);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [tightropeActive, run.board, run.gear.lastSetSlots]);
  const hasHotPotatoCard = useMemo(() => run.board.some(c => !!c.hot), [run.board]);
  const potatoAtMs = hasHotPotatoCard && run.gear.potatoAtMs > 0 ? run.gear.potatoAtMs : undefined;
  const hasTimedGambleCard = useMemo(
    () =>
      run.board.some(
        c =>
          c.thornAt !== undefined ||
          c.fuseAt !== undefined ||
          c.cursedUntil !== undefined ||
          c.fogFlipAt !== undefined ||
          (!!c.hot && run.gear.potatoAtMs > 0)
      ),
    [run.board, run.gear.potatoAtMs]
  );
  const gambleClockMs = hasTimedGambleCard ? Math.floor(run.elapsedMs / 1000) * 1000 : null;
  const hasBackgroundAttribute = run.attributes.includes('background');
  const cardBoardOverlay = useMemo<CardBoardOverlay>(
    () => ({
      mirrorCardIds,
      tightropeCardIds,
      potatoAtMs,
      backgroundAttributeActive: hasBackgroundAttribute,
    }),
    [mirrorCardIds, tightropeCardIds, potatoAtMs, hasBackgroundAttribute]
  );
  const leavePractice = useCallback(() => {
    music.stop();
    if (onSandboxReturn) {
      onSandboxReturn();
      return;
    }
    onFinish(runRef.current, recordingOf());
  }, [onSandboxReturn, onFinish, recordingOf]);

  const trainingLabActions = useMemo<TrainingLabActions>(
    () => ({
      onSwapFighter: fighter => dispatch({ type: 'DEV_SWAP_LOADOUT', fighter }),
      onToggleWeapon: weaponId => dispatch({ type: 'DEV_SWAP_LOADOUT', toggleWeaponId: weaponId }),
      onToggleArcana: arcanaId => dispatch({ type: 'DEV_SWAP_LOADOUT', toggleArcanaId: arcanaId }),
      onTriggerEvo: () => dispatch({ type: 'DEV_TRIGGER_EVO' }),
      onAdvanceEvo: () => dispatch({ type: 'DEV_ADVANCE_EVO' }),
      onTriggerParry: mode =>
        dispatch({ type: 'DEV_TRIGGER_PARRY', window: 'windup', counter: parryCounterForDummyMode(mode ?? dummyMode) }),
      onToggleSurge: () => dispatch({ type: 'DEV_TOGGLE_SURGE' }),
      onChangeDummyMode: mode => {
        setDummyMode(mode);
        if (mode === 'immortal') {
          dispatch({ type: 'DEV_TRIGGER_PARRY', clear: true });
          if (runRef.current.surge?.active) dispatch({ type: 'DEV_TOGGLE_SURGE', active: false });
        } else if (mode === 'surge_drill') {
          dispatch({ type: 'DEV_TRIGGER_PARRY', clear: true });
          dispatch({ type: 'DEV_TOGGLE_SURGE', active: true });
        } else {
          if (runRef.current.surge?.active) dispatch({ type: 'DEV_TOGGLE_SURGE', active: false });
          dispatch({ type: 'DEV_TRIGGER_PARRY', window: 'windup', counter: parryCounterForDummyMode(mode) });
        }
      },
      onResetDummy: () => dispatch({ type: 'DEV_RESET_DUMMY' }),
      onReturn: leavePractice,
    }),
    [dispatch, dummyMode, leavePractice]
  );

  const debugActions = useMemo<FightDebugActions>(
    () => ({
      onSetFoeHp: hp => dispatch({ type: 'DEV_SET_FOE_HP', hp }),
      onToggleFreezeClock: () => dispatch({ type: 'DEV_FREEZE_CLOCK' }),
      onTriggerEvo: () => dispatch({ type: 'DEV_TRIGGER_EVO' }),
      onAdvanceEvo: () => dispatch({ type: 'DEV_ADVANCE_EVO' }),
      onForceParry: window => dispatch({ type: 'DEV_TRIGGER_PARRY', window }),
      onForceSurge: () => dispatch({ type: 'DEV_TOGGLE_SURGE' }),
      onHotSwapWeapon: (weaponId, lv) => dispatch({ type: 'DEV_SWAP_LOADOUT', weaponId, weaponLevel: lv }),
      onSetHearts: hearts => dispatch({ type: 'DEV_SET_HEARTS', hearts }),
    }),
    [dispatch]
  );

  const movesChip = run.movesLeft !== null && (
    <View style={[st.stat, run.movesLeft <= 2 && st.statWarn]}>
      <Icon name="lorc/archery-target" size={13} color={INK} />
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

  // ── Starfall Summit 2P Co-Op Combat Synchronization (zero WebSocket coupling) ──
  const [localGiftSets, setLocalGiftSets] = useState(0);
  const [allyReaction, setAllyReaction] = useState<FighterAvatarReactionEvent | null>(null);
  const [coopToast, setCoopToast] = useState<string | null>(null);
  const allyReactionSeqRef = useRef(0);
  const seenInboundEventIdsRef = useRef<Set<string>>(new Set());
  const lastSyncedBossHpRef = useRef<number | null>(null);
  const lastSyncedBossMaxHpRef = useRef<number | null>(null);
  const lastSyncedParryKeyRef = useRef<string | null>(null);
  const prevPropLocalCagedRef = useRef<boolean>(Boolean(coopSession?.state.localCaged));
  const lastReportedDmgRef = useRef(run.totalDamage);
  const unackedLocalDmgRef = useRef(0);
  const lastReportedMatchesRef = useRef(run.matches);
  const lastReportedHeartRef = useRef<{ hearts: number; maxHearts: number; caged: boolean } | null>(null);
  const lastReportedCounterRef = useRef<boolean | null>(null);
  const coopOutcomeReportedRef = useRef(false);

  const pulseAllyReaction = useCallback((type: FighterAvatarReactionEvent['type']) => {
    allyReactionSeqRef.current += 1;
    setAllyReaction({ type, id: allyReactionSeqRef.current });
  }, []);

  const showCoopCallout = useCallback(
    (msg: string) => {
      setCoopToast(msg);
      later(() => setCoopToast(cur => (cur === msg ? null : cur)), 3000);
    },
    [later]
  );

  // Outbound: local damage & local gift charge meter
  useEffect(() => {
    if (!coopSession) return;
    const dmgDelta = Math.round(run.totalDamage - lastReportedDmgRef.current);
    const matchDelta = run.matches - lastReportedMatchesRef.current;
    if (matchDelta > 0) {
      lastReportedMatchesRef.current = run.matches;
      const cap = coopSession.state.giftChargeMax ?? COOP_GIFT_CHARGE_MAX;
      setLocalGiftSets(c => Math.min(cap, c + matchDelta));
    }
    if (dmgDelta > 0) {
      lastReportedDmgRef.current = run.totalDamage;
      unackedLocalDmgRef.current += dmgDelta;
      coopSession.callbacks.onDealDamage({
        amount: dmgDelta,
        combo: run.combo,
        isRainbow: Boolean(matchDelta > 0 && run.lastSetIgnition?.math.rainbow),
        isSet: matchDelta > 0,
      });
    }
  }, [coopSession, run.totalDamage, run.matches, run.combo, run.lastSetIgnition]);

  // Outbound: local Parry / Perfect Parry and Synergy counter increments (never echoes remote syncs)
  useEffect(() => {
    if (!coopSession) return;
    const parryOut = pendingCoopParryRef.current;
    if (parryOut) {
      pendingCoopParryRef.current = null;
      coopSession.callbacks.onParryLanded(parryOut);
    }
    const synOut = pendingCoopSynergyRef.current;
    if (Object.keys(synOut).length > 0) {
      pendingCoopSynergyRef.current = {};
      coopSession.callbacks.onSynergyDelta(synOut);
    }
  }, [coopSession, coopOutboundTick]);

  // Outbound: local hearts & Golden Cage state transitions
  useEffect(() => {
    if (!coopSession || run.hearts === null || run.maxHearts === null) return;
    const cur = {
      hearts: run.hearts,
      maxHearts: run.maxHearts,
      caged: Boolean(run.caged),
    };
    const prev = lastReportedHeartRef.current;
    if (prev && prev.hearts === cur.hearts && prev.maxHearts === cur.maxHearts && prev.caged === cur.caged) {
      return;
    }
    lastReportedHeartRef.current = cur;
    if (prev !== null) {
      coopSession.callbacks.onHeartStateChange(cur);
    }
  }, [coopSession, run.hearts, run.maxHearts, run.caged]);

  // Outbound: board counter availability during Parry wind-up (for duo fairness stall)
  const inParryWindup = run.parry?.phase === 'windup';
  useEffect(() => {
    if (!coopSession) return;
    if (!inParryWindup) {
      lastReportedCounterRef.current = null;
      return;
    }
    if (lastReportedCounterRef.current !== parryCounterAvailable) {
      lastReportedCounterRef.current = parryCounterAvailable;
      coopSession.callbacks.onBoardCounterStatus(parryCounterAvailable);
    }
  }, [coopSession, inParryWindup, parryCounterAvailable]);

  // Outbound: notify co-op session once when fight settles
  useEffect(() => {
    if (!coopSession || !ended || coopOutcomeReportedRef.current) return;
    coopOutcomeReportedRef.current = true;
    coopSession.callbacks.onCoopFightOutcome?.(isVictoryRun(run) ? 'won' : 'lost', run);
  }, [coopSession, ended, run]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inbound: consume authoritative event pulses, boss HP, parry state, shared synergy, cage & outcome
  useEffect(() => {
    if (!coopSession) return;
    const cs = coopSession.state;

    // 1. Consume deduplicated inbound event pulses first (so ally_hit pairs atomically with boss HP drop)
    let syncedBossInPulse = false;
    for (const ev of cs.inboundEvents) {
      if (seenInboundEventIdsRef.current.has(ev.id)) continue;
      seenInboundEventIdsRef.current.add(ev.id);
      if (seenInboundEventIdsRef.current.size > 240) {
        const first = seenInboundEventIdsRef.current.values().next().value;
        if (first !== undefined) seenInboundEventIdsRef.current.delete(first);
      }

      if (ev.kind === 'ally_hit') {
        const who = shortCoopName(ev.allyName ?? cs.allyName);
        const dmg = Math.max(1, Math.round(ev.amount));
        syncedBossInPulse = true;
        lastSyncedBossHpRef.current = cs.sharedBossHp;
        lastSyncedBossMaxHpRef.current = cs.sharedBossMaxHp;
        setTaunting(false);
        dispatch({
          type: 'COOP_SYNC_BOSS',
          foeHp: cs.sharedBossHp,
          foeMaxHp: cs.sharedBossMaxHp,
          allyHit: { amount: dmg, allyName: who, isRainbow: ev.isRainbow },
        });
        pulseAllyReaction(ev.isBig || ev.isRainbow || dmg >= 30 ? 'ecstatic' : 'throw');
        showCoopCallout(ev.isRainbow ? `${who} RAINBOW +${dmg}!` : `${who} landed +${dmg}!`);
      } else if (ev.kind === 'cross_parry') {
        const who = shortCoopName(ev.allyName ?? cs.allyName);
        syncedBossInPulse = true;
        lastSyncedBossHpRef.current = cs.sharedBossHp;
        lastSyncedBossMaxHpRef.current = cs.sharedBossMaxHp;
        setTaunting(false);
        dispatch({
          type: 'COOP_SYNC_BOSS',
          foeHp: cs.sharedBossHp,
          foeMaxHp: cs.sharedBossMaxHp,
          parry: {
            phase: 'staggered',
            msLeft: ev.staggerMs ?? cs.sharedParryMsLeft,
            durationMs: ev.staggerMs ?? cs.sharedParryDurationMs,
            crossParry: { perfect: ev.perfect, allyName: who },
          },
        });
        pulseAllyReaction('ecstatic');
        showCoopCallout(ev.perfect ? `${who} PERFECT CROSS-PARRY!` : `${who} CROSS-PARRIED!`);
      } else if (ev.kind === 'gift_received') {
        const who = shortCoopName(ev.fromName ?? cs.allyName);
        dispatch({ type: 'COOP_RECEIVE_GIFT', gift: ev.gift, fromName: who });
        pulseAllyReaction('joy');
        if (ev.gift === 'heal') {
          conductor.triggerHeal();
          void triggerHealHaptic();
          showCoopCallout(`${who} sent +1 ♥ HEAL!`);
        } else if (ev.gift === 'wild_card') {
          conductor.triggerPowerup();
          showCoopCallout(`${who} sent a WILD CARD!`);
        } else {
          conductor.triggerPowerup();
          showCoopCallout(`${who} CLEANSED your board!`);
        }
      } else if (ev.kind === 'ally_rescued') {
        const who = shortCoopName(ev.rescuedName ?? cs.allyName);
        if (ev.isLocal) {
          dispatch({ type: 'COOP_SET_CAGED', caged: false, rescuedByName: shortCoopName(cs.allyName) });
          conductor.triggerHeal();
          void triggerHealHaptic();
          showCoopCallout(`${shortCoopName(cs.allyName)} broke your cage! +2 ♥`);
        } else {
          pulseAllyReaction('ecstatic');
          showCoopCallout(`${who} broke free!`);
        }
      } else if (ev.kind === 'ally_emote') {
        const who = shortCoopName(ev.fromName ?? cs.allyName);
        const phrase = COOP_EMOTE_LABELS[ev.emote] ?? `says "${ev.emote}"`;
        pulseAllyReaction('joy');
        showCoopCallout(`${who} ${phrase}`);
      }
    }

    // 2. Reconcile authoritative shared Boss HP & Parry state (e.g. reconnect SNAPSHOT or server updates)
    const hpChangedFromServer =
      lastSyncedBossHpRef.current !== cs.sharedBossHp ||
      lastSyncedBossMaxHpRef.current !== cs.sharedBossMaxHp;
    const parryKey = cs.sharedParryPhase
      ? `${cs.sharedParryPhase}:${Math.round((cs.sharedParryMsLeft ?? 0) / 500)}`
      : null;
    const parryChangedFromServer = parryKey !== null && lastSyncedParryKeyRef.current !== parryKey;

    if (!syncedBossInPulse && (hpChangedFromServer || parryChangedFromServer)) {
      const prevServerHp = lastSyncedBossHpRef.current;
      const isInitialSync = prevServerHp === null;
      if (prevServerHp !== null && cs.sharedBossHp < prevServerHp) {
        unackedLocalDmgRef.current = Math.max(0, unackedLocalDmgRef.current - (prevServerHp - cs.sharedBossHp));
      }
      lastSyncedBossHpRef.current = cs.sharedBossHp;
      lastSyncedBossMaxHpRef.current = cs.sharedBossMaxHp;
      if (parryKey !== null) lastSyncedParryKeyRef.current = parryKey;
      const upwardGap = cs.sharedBossHp - runRef.current.foeHp;
      const shouldApplyHp =
        cs.sharedBossHp === 0 ||
        cs.sharedBossMaxHp !== runRef.current.foeMaxHp ||
        cs.sharedBossHp < runRef.current.foeHp ||
        (!isInitialSync && hpChangedFromServer && upwardGap > unackedLocalDmgRef.current);
      if (shouldApplyHp || parryChangedFromServer) {
        dispatch({
          type: 'COOP_SYNC_BOSS',
          foeHp: shouldApplyHp ? cs.sharedBossHp : runRef.current.foeHp,
          foeMaxHp: cs.sharedBossMaxHp,
          ...(parryChangedFromServer && cs.sharedParryPhase
            ? {
                parry: {
                  phase: cs.sharedParryPhase,
                  msLeft: cs.sharedParryMsLeft,
                  durationMs: cs.sharedParryDurationMs,
                },
              }
            : {}),
        });
      }
    }

    // 3. Reconcile party-wide Synergy Graph counters
    if (cs.sharedSynergy) {
      const hasIncrease = (Object.entries(cs.sharedSynergy) as [SynergyAttrId, number | undefined][]).some(
        ([k, v]) => typeof v === 'number' && v > (runRef.current.synergy[k] ?? 0)
      );
      if (hasIncrease) {
        dispatch({ type: 'COOP_SYNC_SYNERGY', counters: cs.sharedSynergy });
      }
    }

    // 4. Reconcile authoritative local Golden Cage state (transitions only — never overrides optimistic cage)
    const prevPropCaged = prevPropLocalCagedRef.current;
    prevPropLocalCagedRef.current = cs.localCaged;
    if (cs.localCaged && !runRef.current.caged) {
      dispatch({ type: 'COOP_SET_CAGED', caged: true });
    } else if (prevPropCaged && !cs.localCaged && runRef.current.caged) {
      dispatch({ type: 'COOP_SET_CAGED', caged: false, rescuedByName: cs.allyName });
      conductor.triggerHeal();
      void triggerHealHaptic();
      showCoopCallout(`${cs.allyName} broke your cage! +2 ♥`);
    }

    // 5. Reconcile authoritative room fight outcome (both caged, shared timeout, or authoritative KO)
    if (cs.sharedOutcome === 'lost' && runRef.current.status === 'playing') {
      dispatch({ type: 'COOP_FORCE_DEFEAT', reason: cs.sharedDefeatReason ?? 'both_caged' });
    } else if (cs.sharedOutcome === 'won' && runRef.current.status === 'playing') {
      dispatch({ type: 'COOP_SYNC_BOSS', foeHp: 0, foeMaxHp: cs.sharedBossMaxHp });
    }
  }, [coopSession, dispatch, pulseAllyReaction, showCoopCallout, conductor]);

  const handleSendCoopGift = useCallback(
    (gift: CoopCombatGiftKind) => {
      const cs = coopSessionRef.current;
      if (!cs) return;
      setLocalGiftSets(0);
      sfx('click');
      conductor.triggerPowerup();
      cs.callbacks.onSendGift(gift);
      const who = shortCoopName(cs.state.allyName);
      showCoopCallout(
        gift === 'heal'
          ? `Sent +1 ♥ Heal to ${who}!`
          : gift === 'wild_card'
            ? `Sent WILD CARD to ${who}!`
            : `Cleansed ${who}'s board!`
      );
    },
    [conductor, showCoopCallout]
  );

  const handleCageCheer = useCallback((emote: string) => {
    sfx('click');
    coopSessionRef.current?.callbacks.onSendEmote?.(emote);
  }, []);

  // [OB-10] Live Set-Parry & Counter-Parry onboarding StageBubble callout on first wind-up / golden window / counter
  useEffect(() => {
    if (ended || practice) return;
    const callout = parryOnboardingCallout(run.parry, {
      colorblind,
      seenWindup: seenCoach.current.has(COACH_KEYS.parryFirstWindup),
      seenPerfect: seenCoach.current.has(COACH_KEYS.parryFirstPerfect),
      seenCounter: seenCoach.current.has(COACH_KEYS.counterParryFirst),
    });
    if (!callout) return;
    seenCoach.current.add(callout.key);
    onCoachMarkSeen(callout.key);
    setEventBannerNote(callout.text);
    later(() => setEventBannerNote(prev => (prev === callout.text ? null : prev)), 4500);
  }, [run.parry?.phase, run.parry?.warned, run.parry?.msLeft, ended, practice, colorblind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Non-blocking StageBubble callout the first time any equipped weapon hits Almost-Ready
  const hasAlmostReadyEvo = run.weaponEvolutions.some(e => e.phase === 'charging' && e.almostReady);
  useEffect(() => {
    if (ended || practice || !hasAlmostReadyEvo) return;
    const callout = evoAlmostOnboardingCallout(run, {
      seenEvoAlmost: seenCoach.current.has(EVO_ALMOST_COACH_KEY),
      colorblind,
    });
    if (!callout) return;
    seenCoach.current.add(callout.key);
    onCoachMarkSeen(callout.key);
    setEventBannerNote(callout.text);
    later(() => setEventBannerNote(prev => (prev === callout.text ? null : prev)), 4500);
  }, [hasAlmostReadyEvo, ended, practice, colorblind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tactical Sacrifice / Redraw ([GP-05]): unlocked from 2-6 onward (and practice) when hearts > 1
  const sacrificeUnlocked = isSacrificeUnlocked(level) && run.hearts !== null && run.maxHearts !== null;
  const sacrificeTimed = run.timeLeft !== null;
  const sacrificeCdSec = Math.ceil((run.sacrificeCooldownMs ?? 0) / 1000);
  const sacrificeOnCooldown = sacrificeTimed ? sacrificeCdSec > 0 : Boolean(run.sacrificeUsedThisWave);
  const canSacrifice =
    playing &&
    !fx.cutIn &&
    sacrificeUnlocked &&
    run.hearts !== null &&
    run.hearts > 1 &&
    !sacrificeOnCooldown;
  const handleSacrifice = useCallback(() => {
    if (!canSacrifice) return;
    sfx('hit');
    triggerMistake();
    setMistakeNote(null);
    setMistakeCards(null);
    setEventBannerNote(null);
    dispatch({ type: 'SACRIFICE', cardIds: boardSelectedCards.map(c => c.id) });
  }, [canSacrifice, dispatch, triggerMistake, boardSelectedCards]);

  // [UI-23] Desktop web keyboard controls on the shared z-priority stack:
  // SettingsSheet (MODAL, mounted last) > Pause / HUD inspectors (MODAL) > board (SCREEN).
  // Board keys never fire beneath Pause, inspectors, tips, evolution picks, level-up/shop, cut-ins or defeat.
  const inspectorOpen = Boolean(inspect) || Boolean(hudInspect);
  const keyboardBoardBlocked =
    ended ||
    Boolean(run.caged) ||
    Boolean(defeatOverlay) ||
    defeatFreezeActive ||
    Boolean(tip) ||
    Boolean(fx.cutIn) ||
    run.status === 'pick' ||
    run.status === 'intermission';
  useKeyboardNav({
    enabled: !keyboardBoardBlocked && !paused && !inspectorOpen,
    priority: KEY_PRIORITY.SCREEN,
    onCancel: () => setPaused(true),
    onHint: run.features.has('hints')
      ? () => {
          if (playing && run.stats.hints > 0 && !ui.disableManualHint) setHintTrigger(t => t + 1);
        }
      : undefined,
    // `S` is Sacrifice wherever Sacrifice exists; elsewhere it stays a card-slot key
    onSacrifice: sacrificeUnlocked ? handleSacrifice : undefined,
    onClear: () => setClearSelectionTrigger(t => t + 1),
    onCardSlot: index => {
      if (!playing || fx.cutIn || index >= run.board.length) return;
      setKeyCardSlot(prev => ({ index, seq: (prev?.seq ?? 0) + 1 }));
    },
  });
  useKeyboardNav({
    enabled: inspectorOpen && !paused,
    priority: KEY_PRIORITY.MODAL,
    onCancel: () => {
      setInspect(null);
      setHudInspect(null);
    },
  });
  useKeyboardNav({
    enabled: paused && !settingsOpen,
    priority: KEY_PRIORITY.MODAL,
    onCancel: () => setPaused(false),
  });
  const effectiveMistakeNote =
    mistakeCards && mistakeCards.length === 3
      ? explainInvalidPick(mistakeCards, run.attributes, run.fighter, colorblind)
      : mistakeNote;
  const consecutiveLosses = consecutiveLossesFor(startSave, effectiveLevel.id);
  const surgeGuidedCount =
    (seenCoach.current.has(COACH_KEYS.surgeGuided1) ? 1 : 0) +
    (seenCoach.current.has(COACH_KEYS.surgeGuided2) ? 1 : 0);
  const liveGuidance = useMemo(
    () =>
      computeLiveGuidance(run, {
        selectedCount: boardSelectedCount,
        selectedCards: boardSelectedCards,
        mistakeNote: effectiveMistakeNote,
        mistakeCards,
        seenIntro: coachDismissed,
        noAssist: ui.disableAutoHint === true,
        colorblind,
        consecutiveLosses,
        surgeGuidedCount,
      }),
    [run, boardSelectedCount, boardSelectedCards, effectiveMistakeNote, mistakeCards, coachDismissed, ui.disableAutoHint, colorblind, consecutiveLosses, surgeGuidedCount]
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
  // [OB-15] Passing remarks from your fighter: queued cleanly and auto-dismiss timer ONLY ticks while actually visible!
  const [remark, setRemark] = useState<string | null>(null);
  const saidRemarks = useRef(new Set<string>());
  const remarks = fightRemarks(run, challenge.met);
  const nextRemark = remarks.find(r => !saidRemarks.current.has(r.key));
  useEffect(() => {
    if (!nextRemark) return;
    saidRemarks.current.add(nextRemark.key);
    setRemark(nextRemark.text);
  }, [nextRemark?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // [OB-15] Short Boss/Elite mid-fight reaction bark at 50% HP or Staggered
  const [foeBark, setFoeBark] = useState<string | null>(null);
  const saidFoeBarks = useRef(new Set<string>());
  const nextFoeBark = foeMidFightBark(run);
  useEffect(() => {
    if (!nextFoeBark || saidFoeBarks.current.has(nextFoeBark.key)) return;
    saidFoeBarks.current.add(nextFoeBark.key);
    setFoeBark(nextFoeBark.text);
  }, [nextFoeBark?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // What went wrong with a pick is said at once (it beats a first-time tip about the same moment);
  // then tips, then guidance, then remarks
  const explaining = liveGuidance?.kind === 'mistake';
  const coachText = (explaining ? liveGuidance?.message : eventBannerNote ?? liveGuidance?.message ?? remark) ?? null;
  const coachKind = explaining ? 'mistake' : eventBannerNote ? 'event' : liveGuidance ? liveGuidance.kind : 'cheer';
  // While the rule is new, a strip above the board checks one trait at a time: the cards the companion is talking
  // about, else the Set just made (until the next card is picked)
  const traitChecks = showsTraitChecks(effectiveLevel);
  const checks =
    liveGuidance?.pills ??
    (boardSelectedCount === 1 && boardSelectedCards[0]
      ? describeSingleCardTraits(boardSelectedCards[0], run.attributes, colorblind)
      : boardSelectedCount === 0
        ? checksOfSet(lastSet, run.attributes, colorblind)
        : undefined);
  // Responsive layout: on wide desktop/landscape viewports dock HUD in a clean left rail so the board gets full height
  const isWide = stage.w >= STAGE.wideFrom && stage.w > stage.h;
  const isShortPhone = !isWide && stage.h > 0 && stage.h <= 700;
  const hudPanelW = isWide
    ? Math.min(390, Math.max(350, Math.round(stage.w * 0.305)))
    : stage.w > 0
      ? stage.w
      : 375;

  // The stage height is fixed for the fight so the board never jumps while playing.
  // [UI-13] Reserve generous >=72px card height on 5-6 row mobile portrait boards.
  const boardRows = Math.max(1, Math.ceil(run.board.length / 3));
  const compactBoardRows = !isWide && boardRows >= 5;
  const idealCardH = stage.w > 0 ? (Math.min(stage.w, 560) - 36) / 3 / 0.82 : 140;
  const chromePx = STAGE.chromePx + (traitChecks ? TRAIT_CHECKS_HEIGHT + 4 : 0) + (showDamageHud ? 28 : 0) + (run.parry || run.surge ? 25 : 0);
  const stageH = isWide
    ? STAGE.wideH
    : boardRows >= 5
      ? (isShortPhone ? STAGE.minShort : STAGE.min)
      : boardRows === 4
        ? (isShortPhone ? 52 : STAGE.minMid)
        : stage.h > 0
          ? Math.round(
              Math.max(
                76,
                Math.min(
                  effectiveLevel.id === '1-1' ? STAGE.maxGuide : STAGE.maxSparse,
                  stage.h - insets.top - chromePx - boardRows * (idealCardH + 5)
                )
              )
            )
          : 96;
  const roomyStage = isWide || stageH >= STAGE.roomy;
  const compactStage = !roomyStage;
  const fighterSize = roomyStage
    ? Math.round(
        Math.max(
          54,
          Math.min(isWide ? (effectiveLevel.isBoss ? 84 : 92) : (effectiveLevel.isBoss ? 64 : 74), stageH - 22)
        )
      )
    : Math.round(Math.max(34, Math.min(effectiveLevel.isBoss ? 40 : 44, stageH - 10)));
  // [UI-06] Amplify Boss foeSize differential (>=1.4x fighterSize on all viewports) & Elite boost (1.2x).
  const baseFoeSize = roomyStage
    ? Math.round(Math.min(isWide ? 104 : 80, stageH - 18))
    : Math.round(Math.max(36, Math.min(48, stageH - 8)));
  const foeSize = effectiveLevel.isBoss
    ? Math.max(
        Math.ceil(fighterSize * 1.4),
        roomyStage ? Math.round(Math.min(isWide ? 124 : 96, stageH - 4)) : Math.round(Math.min(62, stageH + 8))
      )
    : isEliteFight
      ? Math.max(Math.ceil(fighterSize * 1.2), baseFoeSize)
      : baseFoeSize;
  // While the foe is taunting (or barking mid-fight), it speaks on its side
  const foeSpeechText = taunting && taunt ? taunt : foeBark;
  const foeTalking = !!foeSpeechText && !explaining && !ended;
  // On compact stages, wait until active damage callouts clear before showing transient event tips / passing remarks
  const holdTransientBubble =
    compactStage &&
    (fx.busy || fx.beats.length > 0) &&
    !foeTalking &&
    !explaining &&
    coachKind !== 'lesson' &&
    coachKind !== 'rescue';

  // [OB-15] Visibility-gated remark & foe-bark timers so compact-phone cascades never starve passing quips!
  const remarkVisible = appActive && remark !== null && coachText === remark && !ended && !halted && !holdTransientBubble && (isWide || !foeTalking);
  useEffect(() => {
    if (!remarkVisible || !remark) return;
    const text = remark;
    const t = setTimeout(() => setRemark(cur => (cur === text ? null : cur)), 2600);
    return () => clearTimeout(t);
  }, [remarkVisible, remark]);

  const foeBarkVisible = appActive && foeBark !== null && !(taunting && taunt) && !ended && !halted && !explaining && !(compactStage && (fx.busy || fx.beats.length > 0));
  useEffect(() => {
    if (!foeBarkVisible || !foeBark) return;
    const text = foeBark;
    const t = setTimeout(() => setFoeBark(cur => (cur === text ? null : cur)), 2200);
    return () => clearTimeout(t);
  }, [foeBarkVisible, foeBark]);

  const fighterBubbleNode =
    coachText && !ended && !holdTransientBubble ? (
      <StageBubble
        testID="run-coach-banner"
        text={coachText}
        kind={coachKind}
        tail={roomyStage ? 'down' : 'left'}
        compact={compactStage}
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

  const foeBubbleNode = foeTalking ? (
    <StageBubble
      testID={taunting && taunt ? 'run-foe-taunt' : 'run-foe-bark'}
      text={`“${foeSpeechText}”`}
      kind="foe"
      tail={roomyStage ? 'down-right' : 'right'}
      compact={compactStage}
      enterDelayMs={opening && !isRetry && taunting && effects ? 200 : 0}
    />
  ) : null;

  // [OB-15] On wide desktop, render fighter tip (left) and foe taunt/bark (right) simultaneously!
  const coachBubble =
    isWide && fighterBubbleNode && foeBubbleNode ? (
      <View style={st.dualSpeechRow} pointerEvents="box-none">
        <View style={st.dualSpeechHalf}>{fighterBubbleNode}</View>
        <View style={st.dualSpeechHalf}>{foeBubbleNode}</View>
      </View>
    ) : (
      foeBubbleNode ?? fighterBubbleNode
    );
  const hasRichResources =
    (showPassivesHud && run.passives.length > 0) ||
    run.features.has('graces') ||
    run.features.has('coins') ||
    run.features.has('hints') ||
    sacrificeUnlocked;
  const hasResourceRow =
    run.movesLeft !== null ||
    practice ||
    secondsLeft !== null ||
    hasRichResources;
  const hasBeltDock =
    run.weapons.length > 0 || run.arcana.length > 0;
  // In sparse early fights (e.g. 1-2..1-4: moves + 1-3 weapons, no passives/coins/hints), merge moves + belt into ONE row
  const useSingleSparseRow = !hasRichResources && (hasResourceRow || run.weapons.length > 0);
  // Flow synergy chips right beside a small weapon belt (<= 3 weapons, no Arcana, e.g. Summit Act 1!) to kill empty right-side voids
  const inlineSynergyOnBelt =
    !useSingleSparseRow &&
    hasBeltDock &&
    run.weapons.length > 0 &&
    run.weapons.length <= 3 &&
    run.arcana.length === 0;
  const hasAnySynergyItems =
    purityLive ||
    Boolean(run.simplified) ||
    run.doubleNext > 0 ||
    run.nextSetMultiplier > 1 ||
    hasTrickGearChips(gearMods);
  const hasSynergyChips = !inlineSynergyOnBelt && hasAnySynergyItems;
  // [UI-15] Protect mobile portrait thumb-zone during active Parry wind-ups or card selection
  const thumbZoneGuarded = !isWide && (run.parry?.phase === 'windup' || boardSelectedCount > 0);
  const openHudInspect = useCallback(
    (target: HudInspectTarget) => {
      sfx('click');
      if (!isWide && !hudInspectTipShown) {
        hudInspectTipShown = true;
        setShowInspectGuardTip(true);
      } else {
        setShowInspectGuardTip(false);
      }
      setHudInspect(target);
    },
    [isWide]
  );
  const openWeaponInspect = useCallback(
    (weapon: Weapon) => {
      sfx('click');
      if (!isWide && !hudInspectTipShown) {
        hudInspectTipShown = true;
        setShowInspectGuardTip(true);
      } else {
        setShowInspectGuardTip(false);
      }
      setInspect(weapon);
    },
    [isWide]
  );
  // [UI-13] Collapse ChallengeStrip into top-bar star badge once met/failed on 5-6 row portrait boards
  const collapseChallengeToTopBar =
    !practice && !chrome?.statusBanner && level.id !== '1-1' && compactBoardRows && (challenge.met || challenge.failed);

  const beltReservedRightPx =
    run.arcana.length * 64 +
    (useSingleSparseRow && (run.movesLeft !== null || practice || secondsLeft !== null) ? 84 : 0);
  const dualThreat = Boolean(run.parry && run.surge) && !isWide;
  const boardMaxWidth = isWide ? Math.min(760, Math.max(480, Math.round((stage.h - 20) * 0.94))) : undefined;
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
  const railHitSlop = hitSlopFor(44, 24, !isWide);

  const renderSynergyItems = () => (
    <>
      <GearChips
        run={run}
        mods={gearMods}
        guardPress={thumbZoneGuarded}
        noBottomBleed={!isWide}
        onInspectWeapon={id => {
          const w = run.weapons.find(x => x.id === id);
          if (w) openWeaponInspect(w);
        }}
      />
      {purityLive && (
        <TouchableOpacity
          testID="run-purity-chip"
          style={[st.purityChip, run.purityChain >= 2 && st.purityChipHot]}
          onPress={thumbZoneGuarded ? NOOP : () => openHudInspect({ kind: 'buff', which: 'purity' })}
          onLongPress={thumbZoneGuarded ? () => openHudInspect({ kind: 'buff', which: 'purity' }) : undefined}
          delayLongPress={250}
          hitSlop={railHitSlop}
          activeOpacity={thumbZoneGuarded ? 1 : 0.75}
          accessibilityRole="button"
          accessibilityLabel={`Purity chain times ${Math.max(1, run.purityChain)}, next needs ${run.lastDiffCount + 1} or more varied traits`}
        >
          <Icon name="lorc/lightning-branches" size={12} color={run.purityChain >= 2 ? TONE.upside : INK} />
          <Text style={[st.purityChipText, { fontSize: scaleText(11, textScale) }]} numberOfLines={1}>
            Purity ×{Math.max(1, run.purityChain)} · {run.lastDiffCount + 1}+ varied
          </Text>
        </TouchableOpacity>
      )}
      {run.doubleNext > 0 && (
        <TouchableOpacity
          testID="run-double-chip"
          style={[st.purityChip, st.purityChipHot]}
          onPress={thumbZoneGuarded ? NOOP : () => openHudInspect({ kind: 'buff', which: 'double' })}
          onLongPress={thumbZoneGuarded ? () => openHudInspect({ kind: 'buff', which: 'double' }) : undefined}
          delayLongPress={250}
          hitSlop={railHitSlop}
          activeOpacity={thumbZoneGuarded ? 1 : 0.75}
          accessibilityRole="button"
        >
          <Text style={[st.purityChipText, { fontSize: scaleText(11, textScale) }]}>NEXT ×2{run.doubleNext > 1 ? ` (${run.doubleNext})` : ''}</Text>
        </TouchableOpacity>
      )}
      {run.nextSetMultiplier > 1 && (
        <TouchableOpacity
          testID="run-charged-chip"
          style={[st.purityChip, { backgroundColor: '#FFE8CC', borderColor: COLORS.impactOrange }]}
          onPress={thumbZoneGuarded ? NOOP : () => openHudInspect({ kind: 'buff', which: 'charged' })}
          onLongPress={thumbZoneGuarded ? () => openHudInspect({ kind: 'buff', which: 'charged' }) : undefined}
          delayLongPress={250}
          hitSlop={railHitSlop}
          activeOpacity={thumbZoneGuarded ? 1 : 0.75}
          accessibilityRole="button"
        >
          <Text style={[st.purityChipText, { fontSize: scaleText(11, textScale) }]}>SET ×{run.nextSetMultiplier}</Text>
        </TouchableOpacity>
      )}
      {run.simplified && (
        <TouchableOpacity
          testID="run-simplified-chip"
          style={[st.purityChip, st.purityChipHot]}
          onPress={thumbZoneGuarded ? NOOP : () => openHudInspect({ kind: 'buff', which: 'simplified' })}
          onLongPress={thumbZoneGuarded ? () => openHudInspect({ kind: 'buff', which: 'simplified' }) : undefined}
          delayLongPress={250}
          hitSlop={railHitSlop}
          activeOpacity={thumbZoneGuarded ? 1 : 0.75}
          accessibilityRole="button"
        >
          <Icon name="lorc/third-eye" size={12} color={TONE.upside} />
          <Text style={[st.purityChipText, { fontSize: scaleText(11, textScale) }]} numberOfLines={1}>
            All {run.simplified.attribute} {formatCardTraitValue(run.simplified.attribute, run.simplified.value, colorblind)}{run.simplified.also ? ` + ${run.simplified.also.attribute} ${formatCardTraitValue(run.simplified.also.attribute, run.simplified.also.value, colorblind)}` : ''} · {Math.ceil(run.simplified.remainingMs / 1000)}s
          </Text>
        </TouchableOpacity>
      )}
    </>
  );

  const parryBarNode = run.parry ? (
    thumbZoneGuarded ? (
      <TouchableOpacity
        testID="run-parry-guard"
        onPress={NOOP}
        onLongPress={() => openHudInspect({ kind: 'foe' })}
        delayLongPress={250}
        hitSlop={{ top: 18, bottom: 0, left: 4, right: 4 }}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel="Hold to inspect foe parry details"
        style={dualThreat ? { flex: 1.45, minWidth: 0 } : { flex: 1, minWidth: 0 }}
      >
        <ParryIntentBar
          parry={run.parry}
          active={ticking}
          counterAvailable={parryCounterAvailable}
          compact={dualThreat}
          effects={effects}
        />
      </TouchableOpacity>
    ) : (
      <ParryIntentBar
        parry={run.parry}
        active={ticking}
        counterAvailable={parryCounterAvailable}
        compact={dualThreat}
        effects={effects}
        onPress={() => openHudInspect({ kind: 'foe' })}
      />
    )
  ) : null;

  const threatRail = (run.parry || run.surge) ? (
    isWide ? (
      <View style={st.threatRailStacked}>
        {run.parry && (
          <View style={st.threatRowSlot}>
            <ParryIntentBar
              parry={run.parry}
              active={ticking}
              counterAvailable={parryCounterAvailable}
              effects={effects}
              onPress={() => openHudInspect({ kind: 'foe' })}
            />
          </View>
        )}
        {run.surge && (
          <View style={st.threatRowSlot}>
            <SurgeBar surge={run.surge} active={ticking} effects={effects} />
          </View>
        )}
      </View>
    ) : (
      <View style={st.threatRail}>
        {parryBarNode}
        {run.surge && <SurgeBar surge={run.surge} active={ticking} compact={dualThreat} effects={effects} />}
      </View>
    )
  ) : null;

  return (
    <AnchorsProvider value={anchors} quiet={!effects}>
    <Animated.View
      style={[st.root, isWide && st.rootWide, { backgroundColor: biome.colors.sky, paddingTop: insets.top }, screenStyle]}
      onLayout={e => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {/* What every anchor is measured against: the stage's own top-left corner */}
      <View ref={anchors.rootRef} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
      {/* ── HUD ─────────────────────────────────────────── */}
      <View
        style={[st.hud, (isShortPhone || compactBoardRows) && st.hudCompact, isWide && [st.hudWide, { width: hudPanelW }]]}
        onLayout={e => setHudHeight(e.nativeEvent.layout.height)}
      >
        {/* Who you are fighting, inline Summit act/floor badge, and HP */}
        <View style={st.hudTop}>
          <TouchableOpacity
            testID="run-pause"
            onPress={() => setPaused(true)}
            hitSlop={hitSlopFor(36, 36)}
            style={st.pauseBtn}
            accessibilityRole="button"
            accessibilityLabel="Pause"
          >
            <Text style={st.pauseText}>II</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="run-foe-inspect"
            onPress={() => openHudInspect({ kind: 'foe' })}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            style={{ flex: 1, minWidth: 0, gap: 2 }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Inspect foe: ${run.foeName}`}
          >
            <View style={st.foeNameRow}>
              <Text style={[st.foeName, { fontSize: scaleText(13.5, textScale) }]} numberOfLines={1}>{run.foeName}</Text>
              {level.isBoss && <Text style={st.bossTag}>BOSS</Text>}
              {level.foes.length > 1 && <Text style={st.wave}>W{run.wave + 1}/{level.foes.length}</Text>}
              {collapseChallengeToTopBar && (
                <TouchableOpacity
                  testID="run-challenge-collapsed"
                  onPress={() => openHudInspect({ kind: 'challenge' })}
                  hitSlop={hitSlopFor(44, 22)}
                  style={[st.collapsedChallengePill, challenge.met && st.challengeMet, challenge.failed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Three star goal: ${formatChallengeText(challenge.text, colorblind)}${challenge.met ? ', met' : ', missed'}`}
                >
                  <Text style={st.challengeStar}>★★★</Text>
                  {challenge.met && <Icon name="lorc/checked-shield" size={12} color={COLORS.tealSurface} />}
                </TouchableOpacity>
              )}
              {chrome?.statusBanner && (
                <View style={st.statusPill} testID={chrome.statusBanner.testID}>
                  <Icon name={chrome.statusBanner.icon} size={11} color={TONE.upside} />
                  <Text style={st.statusPillText} numberOfLines={1}>{chrome.statusBanner.text}</Text>
                </View>
              )}
            </View>
            <HpBar hp={shownHp} max={run.foeMaxHp} endless={practice} />
            {ui.showInactivityBar && (
              <View style={st.idleTrack}>
                <View
                  style={[
                    st.idleFill,
                    {
                      transform: [
                        { scaleX: Math.max(0.0001, Math.min(1, ui.showInactivityBar.current / Math.max(1, ui.showInactivityBar.max))) },
                      ],
                    },
                  ]}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Battle stage (painted paper-cut tabletop diorama backdrop + embedded XP progress rim) */}
        <View testID="run-stage" style={[st.stage, compactStage && st.stageCompact, run.features.has('xp') && st.stageWithXp, { height: stageH, backgroundColor: biome.colors.sky }]}>
          <View pointerEvents="none" style={st.stageClip}>
            <StageBackdrop
              biomeId={effectiveLevel.biome}
              skyColor={biome.colors.sky}
              groundColor={biome.colors.ground}
              inkColor={biome.colors.ink}
              compact={compactStage}
            />
            {run.features.has('xp') && (
              <View style={st.xpRimTrack}>
                <View
                  style={[
                    st.xpRimFill,
                    { transform: [{ scaleX: Math.max(0.04, Math.min(1, run.xp / Math.max(1, xpNeed))) }] },
                  ]}
                />
              </View>
            )}
          </View>
          {run.features.has('xp') && (
            <View style={st.xpBadgeWrap} pointerEvents="none">
              <Anchor name="xp">
                <View style={st.xpBadge}>
                  <Text style={st.xpBadgeText}>LV {run.xpLevel + 1}</Text>
                </View>
              </Anchor>
            </View>
          )}
          {/* Co-Op inbound callout toast anchored cleanly at top-center edge below Boss HP bar */}
          {coopToast && !ended && (
            <View pointerEvents="none" style={st.coopToastWrap} testID="coop-callout-toast">
              <View style={st.coopToastPill}>
                <Icon name="lorc/two-shadows" size={10} color="#0F766E" noShadow />
                <Text style={st.coopToastText} numberOfLines={1}>
                  {coopToast}
                </Text>
              </View>
            </View>
          )}
          {/* On roomy stages, speech bubble floats cleanly near the top without reserving blank sky when silent */}
          {roomyStage && coachBubble && <View style={st.stageSpeechOverlay} pointerEvents="box-none">{coachBubble}</View>}
          <View style={st.stageFloor}>
            <View style={coopSession ? st.stageHeroesGroup : undefined}>
              <View style={[st.stageSide, compactStage && st.stageSideCompact]}>
                <Anchor name="fighter">
                  <View style={{ position: 'relative', width: fighterSize, height: fighterSize }}>
                    <FighterBuildAura
                      theme={buildTheme}
                      size={fighterSize}
                      quiet={!effects || reducedMotion}
                      testID="adventure-run-fighter-aura"
                    />
                    <FighterAvatar
                      testID="adventure-run-fighter"
                      character={run.fighter}
                      size={fighterSize}
                      health={fighterHealth}
                      maxHealth={fighterMaxHealth}
                      mood={fighterMood}
                      reaction={conductor.reaction}
                      streak={conductor.streak}
                      cheerReleaseMs={leadImpactMs}
                      animate={appActive}
                      quiet={!effects}
                      interactive
                    />
                  </View>
                </Anchor>
                {run.hearts !== null && run.maxHearts !== null && (
                  <Anchor name="hearts"><Hearts hearts={run.hearts} max={run.maxHearts} compact={compactStage} /></Anchor>
                )}
              </View>
              {coopSession && (
                <CoopAllyHud
                  allyFighter={coopSession.state.allyFighter}
                  allyName={coopSession.state.allyName}
                  allyHearts={coopSession.state.allyHearts}
                  allyMaxHearts={coopSession.state.allyMaxHearts}
                  allyCaged={coopSession.state.allyCaged}
                  allyRescueProgress={coopSession.state.allyRescueProgress}
                  allyRescueNeeded={coopSession.state.allyRescueNeeded}
                  allyConnected={coopSession.state.allyConnected}
                  allyCombo={coopSession.state.allyCombo}
                  allyReaction={allyReaction}
                  heroSize={fighterSize}
                  compact={compactStage}
                  effects={effects}
                  ended={ended}
                  giftCharge={coopSession.state.giftCharge ?? localGiftSets}
                  giftChargeMax={coopSession.state.giftChargeMax ?? COOP_GIFT_CHARGE_MAX}
                  onSendGift={handleSendCoopGift}
                  giftsDisabled={Boolean(run.caged) || halted}
                />
              )}
            </View>

            <View style={[st.stageMiddle, compactStage && st.stageMiddleCompact]}>
              {compactStage && coachBubble ? (
                <View style={st.compactBubbleSlot} pointerEvents="box-none">{coachBubble}</View>
              ) : ((run.combo > 1 && comboLive) || (practice && run.matches > 0)) ? (
                <View style={st.counters}>
                  {run.combo > 1 && comboLive && (
                    <Anchor name="combo">
                      <View testID="run-combo" style={st.comboPill} accessibilityLabel={`Combo ×${run.combo}`}>
                        <Text style={st.comboText}>×{run.combo}</Text>
                      </View>
                    </Anchor>
                  )}
                  {practice && run.matches > 0 && <Text testID="run-per-set" style={st.counterDim} accessibilityLabel={`${Math.round(run.totalDamage / run.matches)} damage per Set on average`}>avg {Math.round(run.totalDamage / run.matches)}</Text>}
                </View>
              ) : null}
            </View>

            <Anchor name="foe">
              <View style={st.foeStageWrap}>
                {effectiveLevel.isBoss && (
                  <View
                    testID="run-boss-aura"
                    pointerEvents="none"
                    style={[
                      st.bossShadowHalo,
                      {
                        width: Math.round(foeSize * 0.88),
                        height: Math.max(9, Math.round(foeSize * 0.16)),
                        borderRadius: Math.round(foeSize * 0.44),
                      },
                    ]}
                  />
                )}
                <EnemyAvatar
                  testID="adventure-run-enemy"
                  enemy={foeAvatarEnemy}
                  size={foeSize}
                  hp={run.foeHp}
                  maxHp={run.foeMaxHp}
                  mood={enemyMood}
                  reaction={enemyConductor.reaction}
                  hitTier={enemyConductor.reaction?.hitTier}
                  hitKind={enemyConductor.reaction?.hitKind}
                  hideImpactStars={true}
                  animate={appActive}
                  quiet={!effects}
                  interactive
                />
              </View>
            </Anchor>
          </View>
        </View>

        {/* Locked Zero-Orphan Resource & Belt Rails */}
        {useSingleSparseRow ? (
          <View style={st.sparseRow}>
            {run.movesLeft !== null && (secondsLeft === null ? <Anchor name="clock">{movesChip}</Anchor> : movesChip)}
            {practice && (
              <Anchor name="clock">
                <View testID="run-no-clock" style={st.stat} accessibilityLabel="No clock">
                  <Icon name="lorc/stopwatch" size={13} color={INK} />
                  <Text style={st.statText}>∞</Text>
                </View>
              </Anchor>
            )}
            {secondsLeft !== null && (
              <Anchor name="clock">
                <View
                  testID="run-clock"
                  accessibilityLabel={`${secondsLeft} seconds left${clockHeld ? ', waiting for effects' : ''}`}
                  style={[st.stat, secondsLeft <= 10 && st.statWarn, ui.timerSpeedMultiplier && ui.timerSpeedMultiplier > 1 ? { borderColor: COLORS.impactOrange } : null, clockHeld && st.statHeld]}
                >
                  <Icon name="lorc/stopwatch" size={13} color={clockHeld ? COLORS.logicTeal : INK} />
                  <Text style={st.statText}>{secondsLeft}s</Text>
                </View>
              </Anchor>
            )}
            <GearBelt
              weapons={run.weapons}
              evolutions={liveEvolutions}
              growth={run.growth}
              ignition={run.lastSetIgnition}
              counters={enemyCounters}
              active={ticking}
              effects={effects}
              reduced={!effects}
              width={hudPanelW}
              reservedRightPx={beltReservedRightPx}
              guardPress={thumbZoneGuarded}
              noBottomBleed={!isWide}
              onInspect={openWeaponInspect}
            />
          </View>
        ) : (
          <>
            {hasResourceRow && (
              <View style={st.resourceRow}>
                <View style={st.resourceLeft}>
                  {run.movesLeft !== null && (secondsLeft === null ? <Anchor name="clock">{movesChip}</Anchor> : movesChip)}
                  {practice && (
                    <Anchor name="clock">
                      <View testID="run-no-clock" style={st.stat} accessibilityLabel="No clock">
                        <Icon name="lorc/stopwatch" size={13} color={INK} />
                        <Text style={st.statText}>∞</Text>
                      </View>
                    </Anchor>
                  )}
                  {secondsLeft !== null && (
                    <Anchor name="clock">
                      <View
                        testID="run-clock"
                        accessibilityLabel={`${secondsLeft} seconds left${clockHeld ? ', waiting for effects' : ''}`}
                        style={[st.stat, secondsLeft <= 10 && st.statWarn, ui.timerSpeedMultiplier && ui.timerSpeedMultiplier > 1 ? { borderColor: COLORS.impactOrange } : null, clockHeld && st.statHeld]}
                      >
                        <Icon name="lorc/stopwatch" size={13} color={clockHeld ? COLORS.logicTeal : INK} />
                        <Text style={st.statText}>{secondsLeft}s</Text>
                      </View>
                    </Anchor>
                  )}
                  {showPassivesHud && run.passives.map(id => (
                    <Anchor key={id} name={`passive:${id}`}>
                      <PassiveChip
                        id={id}
                        run={run}
                        collapseIdle={!isWide}
                        guardPress={thumbZoneGuarded}
                        noBottomBleed={!isWide}
                        onPress={() => openHudInspect({ kind: 'passive', id })}
                      />
                    </Anchor>
                  ))}
                  {run.features.has('graces') && (
                    <Anchor name="graces">
                      <TouchableOpacity
                        testID="run-graces-chip"
                        style={st.stat}
                        onPress={thumbZoneGuarded ? NOOP : () => openHudInspect({ kind: 'buff', which: 'graces' })}
                        onLongPress={thumbZoneGuarded ? () => openHudInspect({ kind: 'buff', which: 'graces' }) : undefined}
                        delayLongPress={250}
                        hitSlop={hitSlopFor(38, 24, !isWide)}
                        activeOpacity={thumbZoneGuarded ? 1 : 0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`${run.stats.graces} Graces (forgive 1-trait near-miss)`}
                      >
                        <Icon name="lorc/clover" size={13} color={COLORS.tealSurface} />
                        <Text style={st.statText}>{run.stats.graces}</Text>
                      </TouchableOpacity>
                    </Anchor>
                  )}
                </View>
                <View style={st.resourceRight}>
                  {run.features.has('coins') && <Anchor name="coins"><CoinPill coins={run.coins} compact /></Anchor>}
                  {sacrificeUnlocked && (
                    <TouchableOpacity
                      testID="run-sacrifice"
                      onPress={handleSacrifice}
                      disabled={!canSacrifice}
                      hitSlop={hitSlopFor(44, 30, !isWide)}
                      activeOpacity={0.75}
                      style={[
                        st.sacrificeBtn,
                        boardSelectedCards.length > 0 && canSacrifice && st.sacrificeBtnArmed,
                        !canSacrifice && { opacity: 0.4 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        sacrificeOnCooldown
                          ? sacrificeTimed
                            ? `Sacrifice cooling down, ${sacrificeCdSec} seconds left`
                            : 'Sacrifice already used this wave'
                          : run.hearts !== null && run.hearts <= 1
                            ? 'Sacrifice requires more than 1 heart'
                            : 'Sacrifice 1 heart to redraw 3 cards and deal 6 shockwave damage'
                      }
                    >
                      <Icon name="lorc/recycle" size={12} color="#991B1B" />
                      <Text style={st.sacrificeText} numberOfLines={1}>
                        {sacrificeOnCooldown
                          ? (sacrificeTimed ? `${sacrificeCdSec}s` : '1/w')
                          : isWide
                            ? 'SACRIFICE 1♥'
                            : '1♥'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {run.features.has('hints') && (
                    <Anchor name="hint">
                      <TouchableOpacity
                        testID="run-hint"
                        onPress={() => run.stats.hints > 0 && !ui.disableManualHint && setHintTrigger(t => t + 1)}
                        hitSlop={hitSlopFor(44, 30, !isWide)}
                        style={[st.hintBtn, (run.stats.hints <= 0 || ui.disableManualHint) && { opacity: 0.4 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Use hint"
                      >
                        <Icon name="lorc/light-bulb" size={14} color={INK} />
                        <Text style={st.statText}>{run.stats.hints}</Text>
                      </TouchableOpacity>
                    </Anchor>
                  )}
                </View>
              </View>
            )}

            {hasBeltDock && (
              <View style={[st.beltDockRow, inlineSynergyOnBelt && st.beltDockRowWrap]}>
                <GearBelt
                  weapons={run.weapons}
                  evolutions={liveEvolutions}
                  growth={run.growth}
                  ignition={run.lastSetIgnition}
                  counters={enemyCounters}
                  active={ticking}
                  effects={effects}
                  reduced={!effects}
                  width={hudPanelW}
                  reservedRightPx={beltReservedRightPx}
                  guardPress={thumbZoneGuarded}
                  noBottomBleed={!isWide}
                  onInspect={openWeaponInspect}
                />
                {inlineSynergyOnBelt && hasAnySynergyItems ? (
                  <View style={st.inlineSynergyDock}>{renderSynergyItems()}</View>
                ) : run.arcana.length > 0 ? (
                  <View style={st.rightDock}>
                    {run.arcana.map(id => {
                      const arc = getArcana(id);
                      const short = arcanaShortName(id);
                      return (
                        <TouchableOpacity
                          key={id}
                          testID="run-arcana-chip"
                          style={st.arcanaChip}
                          onPress={thumbZoneGuarded ? NOOP : () => openHudInspect({ kind: 'arcana', id })}
                          onLongPress={thumbZoneGuarded ? () => openHudInspect({ kind: 'arcana', id }) : undefined}
                          delayLongPress={250}
                          hitSlop={railHitSlop}
                          activeOpacity={thumbZoneGuarded ? 1 : 0.75}
                          accessibilityRole="button"
                          accessibilityLabel={`Inspect ${arc.name}`}
                        >
                          <Icon name={arc.icon} size={12} color={TONE.arcana} />
                          <Text style={st.arcanaChipText} numberOfLines={1}>{short}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}

        {/* Live Trick trackers, Escalating Purity, board effects & armed Evolution chip */}
        {hasSynergyChips && (
          <View style={st.synergyRow}>{renderSynergyItems()}</View>
        )}

        {practice ? (
          <>
            {!onSandboxReturn && (
              // Nothing to win here: where the ★★★ goal would be, the way out
              <View style={st.challenge} testID="run-practice-bar">
                <Icon name="lorc/target-dummy" size={13} color={INK} />
                <Text style={[st.challengeText, { fontSize: scaleText(11, textScale) }]} numberOfLines={1}>Practice: nothing to win, nothing to lose</Text>
                <TouchableOpacity testID="run-done" onPress={leavePractice} hitSlop={hitSlopFor(56, 26, !isWide)} style={st.doneBtn} accessibilityRole="button" accessibilityLabel="Done practising">
                  <Text style={st.doneText}>DONE</Text>
                </TouchableOpacity>
              </View>
            )}
            <TrainingLabBar
              save={startSave}
              run={run}
              dummyMode={dummyMode}
              returnLabel={sandboxReturnLabel ?? 'Back to Map'}
              actions={trainingLabActions}
            />
          </>
        ) : !chrome?.statusBanner && level.id !== '1-1' && !collapseChallengeToTopBar ? (
          <ChallengeStrip
            text={formatChallengeText(challenge.text, colorblind)}
            met={challenge.met}
            failed={challenge.failed}
            guardPress={thumbZoneGuarded}
            noBottomBleed={!isWide}
            onPress={() => openHudInspect({ kind: 'challenge' })}
          />
        ) : null}

        {/* The rule, one cell per trait, while it is new (always the same height: the board never moves) */}
        {traitChecks && <TraitChecks attributes={run.attributes} checks={ended ? null : checks} added={traitAddedBy(level)} />}

        {/* Docked Balatro-style Score Equation Bar (slim 1-row pill at rest on mobile; expands floating receipt during tally beat) */}
        {showDamageHud && (
          <MultiplierIgnition
            ignition={run.lastSetIgnition}
            run={run}
            enabled={effects}
            wide={isWide}
            landSeq={leadLandSeq}
            impactMs={leadImpactMs}
            guardPress={thumbZoneGuarded}
            onPress={() => openHudInspect({ kind: 'score' })}
          />
        )}

        {/* Unified Threat Rail docked cleanly inside the HUD frame (zero gap moat above the board!) */}
        {threatRail}

        {/* Desktop landscape sidebar: Live Build & Arcana Console fills lower sidebar cleanly (tap any weapon for canonical WeaponExplainer) */}
        {isWide && (run.weapons.length > 0 || run.arcana.length > 0) && (
          <View style={st.wideConsole}>
            {run.weapons.length > 0 && (
              <View style={st.wideConsoleBlock}>
                <Text style={st.wideConsoleEyebrow}>EQUIPPED WEAPONS ({run.weapons.length}) · TAP TO INSPECT</Text>
                <View style={st.wideWeaponGrid}>
                  {run.weapons.map(w => {
                    const lv = run.weaponBuilds[w.id]?.level ?? 1;
                    const stacks = run.growth ? growthStacks(run.growth, w.id) : 0;
                    const ctr = counterForWeapon(w, enemyCounters);
                    const evo = liveEvoByWeapon.get(w.id);
                    const evoActive = evo?.phase === 'active';
                    const evoCooldown = evo?.phase === 'cooldown';
                    const evoAlmost = Boolean(evo?.phase === 'charging' && evo.almostReady);
                    const evoSecs = evoActive ? Math.max(0, Math.ceil(evo!.activeRemainingMs / 1000)) : 0;
                    const evoCdSecs = evoCooldown ? Math.max(1, Math.ceil(evo!.cooldownRemainingMs / 1000)) : 0;
                    const evoPct = evo
                      ? evoActive
                        ? Math.max(0, Math.min(1, evo.activeRemainingMs / Math.max(1, evo.activeDurationMs)))
                        : evoCooldown
                          ? Math.max(0, Math.min(1, evo.cooldownRemainingMs / Math.max(1, EVOLUTION_CHASSIS.defaultCooldownMs)))
                          : Math.max(0, Math.min(1, evo.progress / Math.max(1, evo.target)))
                      : 0;
                    const evoUrgent = evoActive && evoSecs <= 5;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        testID={`wide-weapon-${w.id}`}
                        style={[
                          st.wideWeaponRow,
                          evoAlmost && st.wideWeaponRowAlmost,
                          evoActive && st.wideWeaponRowEvolved,
                          evoCooldown && st.wideWeaponRowCooldown,
                          ctr && !evoActive && st.wideWeaponRowCountered,
                        ]}
                        onPress={() => openWeaponInspect(w)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Inspect ${w.name}`}
                      >
                        <View style={st.wideWeaponHead}>
                          <WeaponAvatar weapon={w} size={20} />
                          <Text style={st.wideWeaponName} numberOfLines={1}>
                            {w.name}{weaponLevelSuffix(lv)}
                          </Text>
                          {ctr && <Text style={st.wideWeaponCounter}>−{ctr.reduction}%</Text>}
                          {stacks > 0 && <Text style={st.wideWeaponStack}>+{Math.round(stacks)}</Text>}
                        </View>
                        {evo && (
                          <View style={st.wideEvoBlock}>
                            <View style={st.wideEvoLine}>
                              <Icon
                                name={evoActive ? evo.icon : evoCooldown ? 'lorc/hourglass' : 'lorc/crystal-shine'}
                                size={10}
                                color={evoUrgent ? COLORS.impactRed : evoAlmost ? '#B45309' : evoCooldown ? '#6B7280' : '#6D28D9'}
                                noShadow
                              />
                              <Text
                                style={[
                                  st.wideEvoText,
                                  evoAlmost && st.wideEvoTextAlmost,
                                  evoUrgent && st.wideEvoTextUrgent,
                                  evoCooldown && st.wideEvoTextCooldown,
                                ]}
                                numberOfLines={1}
                              >
                                {evoActive
                                  ? `${evo.evolutionName} · ${evoSecs}s`
                                  : evoCooldown
                                    ? `Cooldown · ${evoCdSecs}s`
                                    : evoAlmost
                                      ? `${evo.conditionShort} · ${Math.max(1, evo.target - evo.progress)} LEFT!`
                                      : `${evo.conditionShort} · ${evo.progress}/${evo.target}`}
                              </Text>
                            </View>
                            <View style={st.wideEvoTrack}>
                              <View
                                style={[
                                  st.wideEvoFill,
                                  {
                                    transform: [{ scaleX: evoPct }],
                                    backgroundColor: evoUrgent
                                      ? COLORS.impactRed
                                      : evoAlmost
                                        ? '#D97706'
                                        : evoCooldown
                                          ? '#6B7280'
                                          : '#7C3AED',
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            {run.arcana.length > 0 && (
              <View style={st.wideConsoleBlock}>
                <Text style={st.wideConsoleEyebrow}>ACTIVE ARCANA</Text>
                <View style={st.wideArcanaList}>
                  {run.arcana.map(id => {
                    const arc = getArcana(id);
                    return (
                      <TouchableOpacity
                        key={id}
                        style={st.wideArcanaRow}
                        onPress={() => openHudInspect({ kind: 'arcana', id })}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Inspect ${arc.name}`}
                      >
                        <Icon name={arc.icon} size={13} color={TONE.arcana} />
                        <Text style={st.wideArcanaName} numberOfLines={1}>{arc.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Board ───────────────────────────────────────── */}
      <View
        ref={anchors.ref('board')}
        testID="run-board-wrap"
        collapsable={false}
        style={[st.boardWrap, isWide && st.boardWrapWide]}
      >
        <View style={[st.boardInner, !isWide && st.boardInnerPortraitClip, boardMaxWidth ? { maxWidth: boardMaxWidth } : null, isDevBuild && devOverrides.layers.dimBoard && { opacity: 0.35 }]}>
          {/* Evolution pulse: a glow behind the cards, never a card border */}
          {activeEvoCount > 0 && <EvolutionGlow active={playing && appActive} effects={effects} />}
          {run.surge?.active && <SurgeGlow active={playing && appActive} effects={effects} />}
          {run.frozenMs > 0 && (
            <View style={st.frozen} pointerEvents="none">
              <Icon name="lorc/snowflake-1" size={18} color="#1D4ED8" />
              <Text style={st.frozenText}>FROZEN {Math.ceil(run.frozenMs / 1000)}s</Text>
            </View>
          )}
          <CardBoardProvider overlay={cardBoardOverlay} clockMs={gambleClockMs}>
            <GameBoard
              key={attemptKey}
              cards={run.board}
              connections={run.connections}
              onMatch={handleMatch}
              onGraceSave={handleGraceSave}
              allowSelectClogged={canSacrifice}
              onInvalidSelection={handleInvalid}
              playerStats={run.stats}
              weapons={run.weapons}
              procAccum={run.procAccum}
              isPlayerTurn={run.status === 'playing' && !run.caged && !halted && !fx.cutIn}
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
              effects={effects}
              triggerCardSlot={keyCardSlot}
              triggerClearSelection={clearSelectionTrigger}
            />
          </CardBoardProvider>
          {coopSession && Boolean(run.caged) && !ended && (
            <CoopCageOverlay
              visible={Boolean(run.caged)}
              allyName={coopSession.state.allyName}
              rescueProgress={coopSession.state.rescueProgress}
              rescueNeeded={coopSession.state.rescueNeeded}
              effects={effects}
              onCheer={handleCageCheer}
            />
          )}
        </View>
      </View>

      {/* Everything that is playing right now */}
      {!(isDevBuild && devOverrides.layers.hideFx) && (
        <FxStage fx={fx} anchors={anchors} size={stage} effects={effects} hideWeaponNameTags suppressKoBanner={fightVictory && !practice} />
      )}
      <KillCamOverlay
        ignition={run.lastSetIgnition}
        victory={fightVictory && !practice}
        stars={victoryStars}
        endReason={run.endReason}
        damageReceived={run.roundStats.damageReceived}
        mistakes={run.mistakes}
        hasHearts={hasHearts}
        heartsLeft={run.hearts}
        isBoss={Boolean(level.isBoss)}
        isElite={isEliteFight}
        impactDelayMs={victoryImpactDelay}
        cinemaMode={killCamMode}
        triggerNow={fightVictory && !practice ? (run.lastSetIgnition?.lethal && slowMoCinema ? lethalLanded : true) : false}
        onImpact={handleKillCamImpact}
        onSkip={handleKillCamSkip}
        anchors={anchors}
        stageSize={stage}
        enabled={effects && !practice}
        reduced={reducedMotion}
      />
      {/* [FX-08] 300 ms Defeat Freeze-Frame + crimson fatal-source ring handing off at 0 ms into DefeatOverlay */}
      <DefeatFreezeOverlay
        active={defeatFreezeActive}
        fatal={fatalSource}
        anchors={anchors}
        stageSize={stage}
        enabled={effects && !practice}
        reduced={reducedMotion}
        onComplete={handleDefeatFreezeComplete}
      />
      {opening && effects && !practice && anchors.rect('board') && (
        <View style={st.openingLayer} pointerEvents="none" testID="run-opening">
          <Banner rect={anchors.rect('board')!} text={level.isBoss ? 'BOSS FIGHT!' : 'FIGHT!'} color={level.isBoss ? '#9F1239' : COLORS.deepOnyx} delay={120} />
        </View>
      )}
      {/* Non-blocking wave transition banner for shopless waves (e.g. 3-3) ([OB-16]) */}
      {autoWaveIntermission && anchors.rect('board') && (
        <View style={st.openingLayer} pointerEvents="none" testID="run-wave-banner">
          <Banner rect={anchors.rect('board')!} text={`WAVE ${run.wave + 2}!`} color={COLORS.deepOnyx} delay={0} />
        </View>
      )}
      {!ended && fx.cutIn && (() => {
        const entries: EvolutionCutInEntry[] = [];
        for (const id of fx.cutIn.recipes) {
          const def = getWeaponEvolution(id);
          if (!def) continue;
          const rt = run.weaponEvolutions.find(e => e.evoId === id);
          const weapon = run.weapons.find(w => w.id === def.weaponId);
          const durationSec = Math.max(1, Math.round((rt?.durationMs ?? def.durationMs) / 1000));
          entries.push({ evolution: def, weapon, durationSec });
        }
        if (entries.length === 0) return null;
        return (
          <EvolutionCutIn
            key={fx.cutIn.key}
            evolutions={entries}
            weapons={run.weapons}
            size={stage}
            onDone={() => { setEvolutionHint(false); fx.dismissCutIn(); }}
            autoDismissMs={autoPlayer ? 1600 : undefined}
            hint={evolutionHint ? 'Watch the gold timer bar right on your weapon belt!' : undefined}
          />
        );
      })()}
      {/* Repeat or effects-off awakenings get a crisp non-blocking banner ([OB-08] + [AU-13]) */}
      {!ended && fx.banner && (() => {
        const entries: EvolutionBannerEntry[] = [];
        for (const id of fx.banner.recipes) {
          const def = getWeaponEvolution(id);
          if (!def) continue;
          const rt = run.weaponEvolutions.find(e => e.evoId === id);
          const weapon = run.weapons.find(w => w.id === def.weaponId);
          const secs = Math.max(1, Math.round((rt?.durationMs ?? def.durationMs) / 1000));
          entries.push({ id: def.id, name: def.name, icon: def.icon, text: def.tagline, seconds: secs, weapon });
        }
        if (entries.length === 0) return null;
        return (
          <View style={[st.bannerWrap, { top: insets.top + hudHeight / 2 }]} pointerEvents="none">
            <EvolutionBanner entries={entries} seq={fx.banner.key} />
          </View>
        );
      })()}
      <MegaFlash trigger={megaFlash} enabled={effects} stageW={stage.w || 375} />

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

      {/* Between waves (only shown as a modal when Shop is unlocked; shopless waves auto-advance per [OB-16]) */}
      {run.status === 'intermission' && !fx.busy && run.features.has('shop') && (
        <Intermission run={run} dispatch={dispatch} onPurchase={() => conductor.triggerPowerup()} />
      )}

      {/* [OB-13] In-place Defeat Overlay for `<250ms` instant retry without ScreenTransition */}
      {defeatOverlay && (
        <DefeatOverlay
          level={effectiveLevel}
          run={defeatOverlay.run}
          result={defeatOverlay.recorded.result}
          onRetry={() => handleInstantRetry()}
          onFullBreakdown={() => {
            const cur = defeatOverlay;
            setDefeatOverlay(null);
            onShowDefeatBreakdown?.(cur.run, cur.recorded);
          }}
          onCamp={tab => {
            setDefeatOverlay(null);
            onDefeatCamp?.(tab);
          }}
          onMap={() => {
            setDefeatOverlay(null);
            onDefeatMap?.();
          }}
          onToggleTailwind={onToggleTailwind}
        />
      )}

      <Modal visible={paused && !settingsOpen} transparent animationType="fade" onRequestClose={() => setPaused(false)}>
        <View style={st.overlay}>
          <TouchableOpacity testID="pause-backdrop" style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setPaused(false)} accessibilityLabel="Resume fight" />
          <PopIn style={st.panel}>
            <Text style={st.panelTitle}>PAUSED</Text>
            <Text style={[st.panelSub, { fontSize: scaleText(14, textScale) }]}>
              {chrome?.pauseSubtitle ?? `${practice ? 'Practice' : level.id} · ${level.name}`}
            </Text>
            {/* [UI-13]/[UI-03] Fight stats moved out of active play into Pause summary with registered Icon */}
            {showDamageHud && (run.totalDamage > 0 || run.biggestHit > 0 || run.matches > 0) && (
              <View style={st.pauseStatsRow} testID="pause-battle-summary">
                <View style={st.pauseStatPill} testID="pause-total-damage">
                  <Icon name="lorc/crossed-swords" size={14} color={INK} />
                  <Text style={st.pauseStatText}>{run.totalDamage} dmg</Text>
                </View>
                {run.biggestHit > 0 && (
                  <View style={st.pauseStatPill} testID="pause-biggest-hit">
                    <Text style={st.pauseStatText}>best {run.biggestHit}</Text>
                  </View>
                )}
                <View style={st.pauseStatPill}>
                  <Text style={st.pauseStatText}>{run.matches} Sets</Text>
                </View>
              </View>
            )}
            {run.weapons.length > 0 && (
              <View style={st.gearRow}>
                {run.weapons.map((w, i) => {
                  const wLv = run.weaponBuilds[w.id]?.level ?? 1;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={st.gearChip}
                      onPress={() => { setPaused(false); openWeaponInspect(w); }}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Inspect ${w.name}`}
                    >
                      <WeaponAvatar weapon={w} size={20} />
                      <Text style={st.gearText} numberOfLines={1}>{w.name}{weaponLevelSuffix(wLv)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <Btn label="Resume" onPress={() => setPaused(false)} />
            {/* [UI-21] 1-tap Music / SFX / Haptics + All Settings without leaving the fight */}
            <PauseAudioPills onOpenAllSettings={() => setSettingsOpen(true)} />
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

      {/* [UI-21] Global SettingsSheet from Pause → All Settings; closing it returns to Pause (the fight waits) */}
      {settingsOpen && (
        <SettingsSheet
          visible
          onClose={() => setSettingsOpen(false)}
          showReset={false}
          effectsOn={onToggleEffects ? effects : undefined}
          onToggleEffects={onToggleEffects}
        />
      )}

      {/* A weapon from the belt, explained (the fight waits; 1-tap dimmed backdrop dismiss per [UI-15]) */}
      <Modal visible={!!inspect} transparent animationType="fade" onRequestClose={() => setInspect(null)}>
        <View style={st.overlay} testID="weapon-inspect-modal">
          <TouchableOpacity testID="inspect-backdrop" style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setInspect(null)} accessibilityLabel="Close weapon details" />
          <PopIn style={[st.panel, { padding: 12 }]}>
            {inspect && (() => {
              const liveWeapon = run.weapons.find(w => w.id === inspect.id) ?? inspect;
              return (
                <WeaponExplainer
                  weapon={liveWeapon}
                  build={run.weaponBuilds[inspect.id]}
                  growth={run.growth}
                  counter={counterForWeapon(liveWeapon, enemyCounters)}
                  evolutionMode="live"
                  liveEvolution={liveEvoByWeapon.get(liveWeapon.id) ?? null}
                  equippedEvolutionId={run.equippedEvolutions?.[liveWeapon.id] ?? null}
                  unlockedEvolutionIds={run.unlockedWeaponEvolutions}
                  beltSynergyIds={beltSynergyAttrSet(beltWeaponIds, liveWeapon.id)}
                  evolutionLabTier={startSave.upgrades?.evolution_lab ?? 0}
                  defaultOpen
                />
              );
            })()}
            {showInspectGuardTip && (
              <View style={st.inspectGuardTip} testID="hud-inspect-guard-tip">
                <Icon name="lorc/light-bulb" size={14} color="#92400E" />
                <Text style={st.inspectGuardTipText}>Tip: Hold any chip or tap ? to inspect mid-Set.</Text>
              </View>
            )}
            <Btn testID="inspect-close" label="Back to the fight" onPress={() => setInspect(null)} />
          </PopIn>
        </View>
      </Modal>

      {/* [TP-11] Dev-only live fight tuning drawer */}
      {isDevBuild && (
        <FightDebugDrawer
          run={run}
          clockFrozen={Boolean(run.devClockFrozen)}
          actions={debugActions}
        />
      )}

      {/* HUD inspector: foe / passive / ★★★ goal / Arcana / evolution / buff (the fight waits) */}
      <HudInspector
        target={hudInspect}
        run={run}
        shownHp={shownHp}
        challenge={challenge}
        knownEvolutions={new Set([...startSave.discoveredEvolutions, ...(run.forgedEvolutions ?? [])])}
        showGuardTip={showInspectGuardTip}
        onClose={() => setHudInspect(null)}
      />
    </Animated.View>
    </AnchorsProvider>
  );
};

/**
 * The foe's HP: [FX-24] GPU-composited `scaleX` bar + non-resetting pale damage trail
 * (zero per-frame Yoga/CSS layout `width` recalculation). A practice dummy's bar reads ∞.
 */
const HpBar: React.FC<{ hp: number; max: number; endless?: boolean }> = ({ hp, max, endless }) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const fill = useSharedValue(pct);
  const trail = useSharedValue(pct);
  const trailTargetRef = useRef(pct);
  const trailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prevTarget = trailTargetRef.current;
    trailTargetRef.current = pct;

    if (!appActive || reducedMotion) {
      if (trailTimerRef.current) {
        clearTimeout(trailTimerRef.current);
        trailTimerRef.current = null;
      }
      cancelAnimation(fill);
      cancelAnimation(trail);
      fill.value = pct;
      trail.value = pct;
      return;
    }

    const rising = pct > prevTarget;
    fill.value = withTiming(pct, { duration: MS.feedback, easing: EASE.enter });
    if (rising) {
      if (trailTimerRef.current) {
        clearTimeout(trailTimerRef.current);
        trailTimerRef.current = null;
      }
      cancelAnimation(trail);
      trail.value = pct;
    } else if (!trailTimerRef.current) {
      // Non-resetting catch-up timer so rapid multi-beat cascades smoothly drain trail instead of freezing forever
      trailTimerRef.current = setTimeout(() => {
        trailTimerRef.current = null;
        trail.value = withTiming(trailTargetRef.current, { duration: MS.move, easing: EASE.ui });
      }, 220);
    } else {
      // Trail catch-up is already scheduled; when it fires it will read the latest trailTargetRef.current
    }
  }, [pct, appActive, reducedMotion, fill, trail]);

  useEffect(() => () => {
    if (trailTimerRef.current) {
      clearTimeout(trailTimerRef.current);
      trailTimerRef.current = null;
    }
    cancelAnimation(fill);
    cancelAnimation(trail);
  }, [fill, trail]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value <= 0.001 ? 0 : 1,
    transform: [{ scaleX: Math.max(0.0001, fill.value) }],
  }));
  const trailStyle = useAnimatedStyle(() => ({
    opacity: trail.value <= 0.001 ? 0 : 1,
    transform: [{ scaleX: Math.max(0.0001, trail.value) }],
  }));
  return (
    <View testID="run-foe-hp" style={st.hpTrack} accessibilityLabel={endless ? 'Foe health: endless' : `Foe health ${hp} of ${max}`}>
      <Animated.View testID="run-foe-hp-trail" style={[st.hpFill, st.hpTrail, trailStyle]} />
      <Animated.View
        testID="run-foe-hp-fill"
        style={[
          st.hpFill,
          { backgroundColor: endless ? COLORS.redSurface : pct > 0.5 ? COLORS.redSurface : pct > 0.25 ? COLORS.orangeSurface : '#B91C1C' },
          fillStyle,
        ]}
      />
      {endless ? (
        <Text style={[st.hpText, st.hpEndless]}>∞</Text>
      ) : (
        <View style={st.hpTextPill} pointerEvents="none">
          <Text style={st.hpText}>{`${hp} / ${max}`}</Text>
        </View>
      )}
    </View>
  );
};

/**
 * The ★★★ goal, under the fight. It jumps each time it moves forward ("1/2"),
 * and turns teal with a tick when it is met, so progress toward the third
 * star is felt as it happens and not only read on the results screen.
 */
const ChallengeStrip: React.FC<{
  text: string;
  met: boolean;
  failed: boolean;
  guardPress?: boolean;
  noBottomBleed?: boolean;
  onPress?: () => void;
}> = ({ text, met, failed, guardPress = false, noBottomBleed = false, onPress }) => {
  const reducedMotion = useReducedMotion();
  const textScale = useTextScale();
  const pop = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    // (not on the way in: only when the words change during the fight)
    if (first.current) {
      first.current = false;
      return;
    }
    if (failed) return;
    if (!reducedMotion) {
      cancelAnimation(pop);
      pop.value = withSequence(
        withTiming(met ? 1.1 : 1.05, { duration: 80, easing: EASE.enter }),
        withSpring(1, SPRING.snappy)
      );
    }
    if (met) band.cue('star', { amount: 3 });
    return () => cancelAnimation(pop);
  }, [text, met, failed, reducedMotion, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <TouchableOpacity
      testID="run-challenge"
      onPress={guardPress ? NOOP : onPress}
      onLongPress={guardPress ? onPress : undefined}
      delayLongPress={250}
      hitSlop={hitSlopFor(180, 24, noBottomBleed)}
      disabled={!onPress}
      activeOpacity={guardPress ? 1 : 0.75}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Three star goal: ${text}${met ? ', done' : ''}`}
    >
      <Animated.View style={[st.challenge, met && st.challengeMet, failed && { opacity: 0.55 }, style]}>
        <Text style={st.challengeStar}>★★★</Text>
        <Text style={[st.challengeText, { fontSize: scaleText(11, textScale) }, failed && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{text}</Text>
        {met && <Icon name="lorc/checked-shield" size={14} color={COLORS.tealSurface} />}
      </Animated.View>
    </TouchableOpacity>
  );
};

/** Base tuning for a passive number (skill nodes can move it; the chips are a guide, the engine decides). */
const tune = (id: PassiveId, key: string): number => (PASSIVE_TUNING[id] as Record<string, number>)[key] ?? 0;

const comboWindowMs = (run: RunState): number =>
  comboWindowFor(run.passives.includes('combo') ? tune('combo', 'combo.windowMs') : DEFAULT_COMBO_WINDOW_MS, run.attributes.length);

/** One passive's live state. Lit when primed/active; collapses idle state into a compact dim indicator on portrait ([UI-13]). */
const PassiveChip: React.FC<{
  id: PassiveId;
  run: RunState;
  collapseIdle?: boolean;
  guardPress?: boolean;
  noBottomBleed?: boolean;
  onPress?: () => void;
}> = ({ id, run, collapseIdle = false, guardPress = false, noBottomBleed = false, onPress }) => {
  const textScale = useTextScale();
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
      label = run.matches === 0 || wait <= 0 ? 'ready' : `${Math.ceil(wait / 1000)}s`;
      lit = run.matches > 0 && wait <= 2000;
      break;
    }
    case 'deep_freeze': label = run.frozenMs > 0 ? `${Math.ceil(run.frozenMs / 1000)}s` : 'rainbow'; lit = run.frozenMs > 0; break;
    case 'zoomies': label = `in ${p.zoomiesIn}`; lit = p.zoomiesIn <= 2; break;
    case 'fetch': label = 'fetch'; lit = false; break;
    case 'big_scoop': label = `in ${p.scoopIn}`; lit = p.scoopIn <= 2; break;
    case 'keen_eye': label = p.keenEyeCardId ? 'look!' : 'eye'; lit = !!p.keenEyeCardId; break;
  }
  const compactIdle = collapseIdle && !lit;
  return (
    <TouchableOpacity
      testID={`run-passive-${id}`}
      onPress={guardPress ? NOOP : onPress}
      onLongPress={guardPress ? onPress : undefined}
      delayLongPress={250}
      hitSlop={hitSlopFor(compactIdle ? 24 : 44, 24, noBottomBleed)}
      disabled={!onPress}
      activeOpacity={guardPress ? 1 : 0.75}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ expanded: !compactIdle }}
      style={[
        st.stat,
        lit && { backgroundColor: '#FFF1C7' },
        compactIdle && st.passiveIdlePip,
        !lit && !compactIdle && { opacity: 0.6 },
      ]}
      accessibilityLabel={`${def.name}: ${label}`}
    >
      <Icon name={def.icon} size={13} color={INK} />
      {!compactIdle && <Text style={[st.statText, { fontSize: scaleText(11, textScale) }]} numberOfLines={1}>{label}</Text>}
    </TouchableOpacity>
  );
};

/** Soft pulsing glow behind the board while an evolution runs ([FX-14] gated on appActive, effects & reducedMotion). */
const EvolutionGlow: React.FC<{ active: boolean; effects?: boolean }> = ({ active, effects = true }) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const shouldPulse = active && appActive && effects && !reducedMotion;
  const o = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(o);
    if (!shouldPulse) {
      if (!appActive) {
        o.value = 0.32;
      } else {
        o.value = withTiming(0.32, { duration: ACCESSIBLE.fadeMs, easing: EASE.ui, ...STAYS });
      }
      return () => cancelAnimation(o);
    }
    o.value = withSequence(
      withTiming(0.24, { duration: MS.quick, easing: EASE.ui }),
      withRepeat(withTiming(0.54, { duration: 680, easing: EASE.drift }), -1, true)
    );
    return () => cancelAnimation(o);
  }, [shouldPulse, appActive, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View testID="evolution-glow" pointerEvents="none" style={[st.glow, style]} />;
};

/**
 * Shading Surge meter: [FX-24] 60fps GPU `scaleX` fill interpolated over `TICK_MS`,
 * plus [FX-14] border-accent rim pulse gated strictly on `active && appActive && effects && !reducedMotion`
 * (zero text scaling jitter).
 */
const SurgeBar: React.FC<{
  surge: NonNullable<RunState['surge']>;
  active: boolean;
  compact?: boolean;
  effects?: boolean;
}> = ({
  surge,
  active,
  compact = false,
  effects = true,
}) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const secs = Math.ceil(surge.msLeft / 1000);
  const durationMs = surge.active ? SURGE_RULES.surgeMs : SURGE_RULES.calmMs;
  const fill = Math.max(0, Math.min(1, surge.active ? surge.msLeft / SURGE_RULES.surgeMs : 1 - surge.msLeft / SURGE_RULES.calmMs));
  const imminent = !surge.active && surge.msLeft <= SURGE_RULES.warnMs;

  const fillSv = useSharedValue(fill);
  const prevSurgeActiveRef = useRef(surge.active);
  const glideActive = active && appActive && effects && !reducedMotion && durationMs > 0;

  useEffect(() => {
    const phaseChanged = prevSurgeActiveRef.current !== surge.active;
    prevSurgeActiveRef.current = surge.active;

    if (!glideActive) {
      cancelAnimation(fillSv);
      fillSv.value = fill;
      return;
    }

    if (phaseChanged || Math.abs(fillSv.value - fill) > 0.14) {
      cancelAnimation(fillSv);
      fillSv.value = fill;
    }

    const delta = TICK_MS / durationMs;
    const nextFill = surge.active ? Math.max(0, fill - delta) : Math.min(1, fill + delta);
    fillSv.value = withTiming(nextFill, { duration: TICK_MS, easing: EASE.linear });

    return () => cancelAnimation(fillSv);
  }, [fill, surge.active, durationMs, glideActive, fillSv]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fillSv.value <= 0.001 ? 0 : 1,
    transform: [{ scaleX: Math.max(0.0001, fillSv.value) }],
  }));

  // Border-accent pulse overlay (GPU opacity only — never scales bar text!)
  const rimPulse = useSharedValue(0);
  const shouldPulse = active && appActive && effects && !reducedMotion && (imminent || surge.active);
  useEffect(() => {
    if (!shouldPulse) {
      cancelAnimation(rimPulse);
      rimPulse.value = imminent || surge.active ? 0.45 : 0;
      return;
    }
    rimPulse.value = 0.2;
    rimPulse.value = withRepeat(withTiming(0.95, { duration: MS.move, easing: EASE.drift }), -1, true);
    return () => cancelAnimation(rimPulse);
  }, [shouldPulse, imminent, surge.active, rimPulse]);
  const rimStyle = useAnimatedStyle(() => ({ opacity: rimPulse.value }));

  const fullLabel = surge.active
    ? `SHADING SURGE · SETS ×${SURGE_RULES.multiplier} · ${secs}s`
    : imminent
      ? `SURGE IN ${secs}s · GET READY`
      : `Shading surge in ${secs}s`;
  const label = compact
    ? surge.active
      ? `×${SURGE_RULES.multiplier} SURGE ${secs}s`
      : imminent
        ? `SURGE ${secs}s!`
        : `Surge ${secs}s`
    : fullLabel;
  return (
    <View
      testID="run-surge-bar"
      accessibilityLabel={fullLabel}
      style={[
        st.surgeBar,
        compact && st.surgeBarCompact,
        surge.active && st.surgeBarLive,
        imminent && st.surgeBarSoon,
      ]}
    >
      <Animated.View
        testID="surge-bar-fill"
        pointerEvents="none"
        style={[st.surgeFill, surge.active && st.surgeFillLive, fillStyle]}
      />
      {(imminent || surge.active) && (
        <Animated.View
          pointerEvents="none"
          testID="surge-bar-pulse-ring"
          style={[st.surgePulseRing, surge.active && st.surgePulseRingLive, rimStyle]}
        />
      )}
      <Icon name="lorc/stone-block" size={compact ? 11 : 13} color={surge.active ? '#FFFFFF' : TONE.surge} />
      <Text style={[st.surgeText, compact && st.surgeTextCompact, surge.active && { color: '#FFFFFF' }]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

const SurgeGlow: React.FC<{ active: boolean; effects?: boolean }> = ({ active, effects = true }) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const shouldPulse = active && appActive && effects && !reducedMotion;
  const o = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(o);
    if (!shouldPulse) {
      if (!appActive) {
        o.value = 0.28;
      } else {
        o.value = withTiming(0.28, { duration: ACCESSIBLE.fadeMs, easing: EASE.ui, ...STAYS });
      }
      return () => cancelAnimation(o);
    }
    o.value = withSequence(
      withTiming(0.2, { duration: MS.quick, easing: EASE.ui }),
      withRepeat(withTiming(0.48, { duration: 540, easing: EASE.drift }), -1, true)
    );
    return () => cancelAnimation(o);
  }, [shouldPulse, appActive, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View testID="surge-glow" pointerEvents="none" style={[st.glow, { backgroundColor: TONE.surge }, style]} />;
};

/** Your hearts, under your fighter on a roomy stage or beside them on a compact stage. */
const Hearts: React.FC<{ hearts: number; max: number; compact?: boolean }> = ({ hearts, max, compact = false }) => {
  if (max > 5 || (compact && max > 3)) {
    return (
      <View style={[st.heartsPill, compact && st.heartsPillCompact]} accessibilityLabel={`${hearts} of ${max} hearts`}>
        <Heart size={compact ? 11 : 13} />
        <Text style={[st.heartsText, compact && st.heartsTextCompact]}>{hearts}/{max}</Text>
      </View>
    );
  }
  return (
    <View style={[st.heartsPill, compact && st.heartsPillCompact]} accessibilityLabel={`${hearts} of ${max} hearts`}>
      {Array.from({ length: max }).map((_, i) => (
        <Heart key={i} size={compact ? 11 : 13} filled={i < hearts} />
      ))}
    </View>
  );
};

const WeaponPick: React.FC<{ title: string; subtitle: string; options: Weapon[]; weaponBuilds?: WeaponBuilds; onPick: (w: Weapon) => void; onSkip: () => void }> = ({ title, subtitle, options, weaponBuilds, onPick, onSkip }) => {
  // [AU-13] Fire staggered slot-reel clunks right as the level-up options mount on screen
  useEffect(() => {
    const b = band as typeof band & { playWeaponPickReelStop?: () => void };
    if (typeof b.playWeaponPickReelStop === 'function') {
      b.playWeaponPickReelStop();
      return;
    }
    if (!band?.inFight && typeof band?.cue === 'function') {
      const ts = [0, 75, 150].map((ms, slot) => setTimeout(() => band.cue('reelStop', { slot }), ms));
      return () => ts.forEach(clearTimeout);
    }
  }, []);

  return (
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
};

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
  rootWide: { flexDirection: 'row' },
  hud: { backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 3, gap: 3.5, zIndex: 20 },
  hudCompact: { paddingTop: 3, paddingBottom: 2, gap: 2.5 },
  hudWide: { borderBottomWidth: 0, borderRightWidth: 2, borderRightColor: INK, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 8, justifyContent: 'flex-start' },
  hudTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  foeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bossTag: { fontWeight: '900', fontSize: 11, letterSpacing: 1, color: INK, backgroundColor: COLORS.actionYellow, borderWidth: 1.5, borderColor: INK, borderRadius: 4, paddingHorizontal: 4.5, overflow: 'hidden' },
  collapsedChallengePill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2.5, backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 6, paddingVertical: 1 },
  statusPill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '58%', backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1, borderColor: '#C9C2B8', paddingHorizontal: 6, paddingVertical: 1 },
  statusPillText: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: INK },
  // The battle stage: a strip of the world the fight happens in
  stage: { borderRadius: 12, borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 3, overflow: 'visible' },
  stageCompact: { borderRadius: 10, paddingHorizontal: 7, paddingTop: 2, paddingBottom: 2 },
  stageWithXp: { paddingBottom: 6 },
  // (the sky gradient, horizon silhouette, ground and embedded XP rim are clipped cleanly to the stage's rounded corners)
  stageClip: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 10, overflow: 'hidden' },
  xpRimTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: 'rgba(241, 233, 224, 0.85)', borderTopWidth: 1, borderTopColor: 'rgba(56, 56, 56, 0.35)', overflow: 'hidden' },
  xpRimFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#5EB8FF', transformOrigin: 'left center' },
  xpBadgeWrap: { position: 'absolute', bottom: 1, left: 0, right: 0, alignItems: 'center', zIndex: 8 },
  xpBadge: { backgroundColor: COLORS.canvasWhite, borderRadius: 999, borderWidth: 1, borderColor: INK, paddingHorizontal: 6, paddingVertical: 0.5 },
  xpBadgeText: { fontSize: 11, lineHeight: 13, fontWeight: '900', color: INK, letterSpacing: 0.2 },
  stageSpeechOverlay: { position: 'absolute', top: 4, left: 8, right: 8, zIndex: 20 },
  coopToastWrap: { position: 'absolute', top: -10, left: 10, right: 10, alignItems: 'center', zIndex: 40 },
  coopToastPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDFA', borderRadius: 999, borderWidth: 1.5, borderColor: '#0F766E', paddingHorizontal: 8, paddingVertical: 1.5, maxWidth: '84%' },
  coopToastText: { flexShrink: 1, fontSize: 10.5, fontWeight: '900', color: '#115E59' },
  dualSpeechRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  dualSpeechHalf: { flex: 1, minWidth: 0 },
  stageFloor: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  stageHeroesGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, flexShrink: 1, minWidth: 0 },
  stageSide: { alignItems: 'center', gap: 2 },
  stageSideCompact: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  stageMiddle: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', paddingBottom: 3 },
  stageMiddleCompact: { justifyContent: 'flex-start', paddingTop: 2, paddingBottom: 10 },
  compactBubbleSlot: { width: '100%', zIndex: 25, alignItems: 'center', justifyContent: 'center' },
  foeStageWrap: { position: 'relative', alignItems: 'center', justifyContent: 'flex-end' },
  bossShadowHalo: { position: 'absolute', bottom: -1, backgroundColor: 'rgba(18, 18, 18, 0.32)' },
  pauseBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  pauseText: { fontWeight: '900', fontSize: 13, color: INK, letterSpacing: -1 },
  heartsPill: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  heartsPillCompact: { paddingHorizontal: 4.5, paddingVertical: 0.5, marginBottom: 3, marginLeft: 2 },
  heartsText: { fontWeight: '900', color: INK, fontSize: 11, fontVariant: ['tabular-nums'] },
  heartsTextCompact: { fontSize: 11 },
  foeName: { fontWeight: '900', fontSize: 13.5, color: INK, flexShrink: 1 },
  wave: { fontWeight: '900', fontSize: 11, color: INK, letterSpacing: 0.5 },
  hpTrack: { height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: INK, backgroundColor: '#F1E9E0', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  hpFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transformOrigin: 'left center' },
  hpTrail: { backgroundColor: '#FFE9A8' },
  hpTextPill: { backgroundColor: 'rgba(255, 253, 247, 0.9)', paddingHorizontal: 6, borderRadius: 3 },
  hpText: { textAlign: 'center', fontWeight: '900', fontSize: 11, color: INK, fontVariant: ['tabular-nums'] },
  hpEndless: { fontSize: 15, lineHeight: 16, color: COLORS.canvasWhite },
  doneBtn: { backgroundColor: COLORS.actionYellow, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 2 },
  doneText: { fontWeight: '900', fontSize: 11, letterSpacing: 1, color: INK },
  idleTrack: { height: 4, borderRadius: 2, backgroundColor: '#EEE', overflow: 'hidden', position: 'relative' },
  idleFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: COLORS.impactOrange, transformOrigin: 'left center' },
  counters: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 5, rowGap: 1, paddingHorizontal: 4 },
  counter: { fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  counterHot: { color: COLORS.orangeSurface },
  comboPill: { backgroundColor: COLORS.orangeSurface, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 6, paddingVertical: 0.5 },
  comboText: { fontSize: 11.5, fontWeight: '900', color: COLORS.canvasWhite, fontVariant: ['tabular-nums'] },
  counterDim: { fontSize: 11, fontWeight: '800', color: 'rgba(56, 56, 56, 0.86)', fontVariant: ['tabular-nums'] },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 14, backgroundColor: '#FDE68A' },
  bannerWrap: { position: 'absolute', left: 0, right: 0, zIndex: 250 },
  openingLayer: { ...StyleSheet.absoluteFillObject, zIndex: 245 },
  sparseRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'nowrap' },
  resourceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  resourceLeft: { flexDirection: 'row', alignItems: 'center', gap: 3.5, flex: 1, minWidth: 0, flexWrap: 'nowrap' },
  resourceRight: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  beltDockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  beltDockRowWrap: { flexWrap: 'wrap', justifyContent: 'flex-start', rowGap: 3 },
  inlineSynergyDock: { flex: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 3.5 },
  rightDock: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 3.5, flexShrink: 0 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 24, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 999, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite, flexShrink: 1 },
  passiveIdlePip: { width: 24, height: 24, paddingHorizontal: 0, justifyContent: 'center', opacity: 0.45, flexShrink: 0 },
  statWarn: { backgroundColor: '#FFE1DE', borderColor: COLORS.impactRed },
  statHeld: { backgroundColor: '#D4F4EE', borderColor: COLORS.logicTeal },
  statText: { flexShrink: 1, fontWeight: '900', color: INK, fontSize: 11, fontVariant: ['tabular-nums'] },
  hintBtn: { flexDirection: 'row', alignItems: 'center', gap: 2.5, minHeight: 30, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1.5, borderBottomWidth: 2.5, borderColor: INK, backgroundColor: COLORS.actionYellow },
  sacrificeBtn: { flexDirection: 'row', alignItems: 'center', gap: 2.5, minHeight: 30, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1.5, borderBottomWidth: 2.5, borderColor: '#991B1B', backgroundColor: '#FEE2E2' },
  sacrificeBtnArmed: { backgroundColor: '#FECACA', borderColor: '#7F1D1D' },
  sacrificeText: { flexShrink: 1, fontWeight: '900', color: '#991B1B', fontSize: 11, fontVariant: ['tabular-nums'] },
  synergyRow: { flexDirection: 'row', alignItems: 'center', gap: 3.5, flexWrap: 'wrap' },
  arcanaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 22, backgroundColor: TONE.arcanaPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.arcana, paddingHorizontal: 6.5, paddingVertical: 1.5 },
  arcanaChipText: { flexShrink: 1, fontSize: 11, fontWeight: '900', color: TONE.arcana },
  purityChip: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 22, maxWidth: '100%', backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 6.5, paddingVertical: 1.5 },
  purityChipHot: { backgroundColor: '#CCFBF1', borderColor: TONE.upside },
  purityChipText: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: INK },
  evoChip: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 22, maxWidth: '100%', backgroundColor: TONE.comboPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.arcana, paddingHorizontal: 6.5, paddingVertical: 1.5 },
  evoChipReady: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  evoChipText: { flexShrink: 1, fontSize: 11, fontWeight: '900', color: INK },
  frozen: { position: 'absolute', top: 10, alignSelf: 'center', zIndex: 60, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#1D4ED8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  frozenText: { fontWeight: '900', fontSize: 12, color: '#1D4ED8', letterSpacing: 1 },
  challenge: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 22, backgroundColor: COLORS.paperBeige, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  challengeMet: { backgroundColor: '#D4F4EE' },
  challengeStar: { color: '#E0A800', fontSize: 11, fontWeight: '900' },
  challengeText: { flex: 1, fontSize: 11, fontWeight: '700', color: INK },
  threatRail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  threatRailStacked: { flexDirection: 'column', gap: 5 },
  threatRowSlot: { flexDirection: 'row', width: '100%' },
  wideConsole: { flex: 1, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 1.5, borderColor: '#D6CFC4', padding: 10, gap: 10 },
  wideConsoleBlock: { gap: 5 },
  wideConsoleEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, color: TONE.spent },
  wideWeaponGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  wideWeaponRow: { width: '48.5%', flexDirection: 'column', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 7, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 6, paddingVertical: 5, minHeight: 38 },
  wideWeaponRowAlmost: { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
  wideWeaponRowEvolved: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  wideWeaponRowCooldown: { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF' },
  wideWeaponRowCountered: { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
  wideWeaponHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  wideWeaponName: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: '800', color: INK },
  wideWeaponCounter: { fontSize: 11, fontWeight: '900', color: '#B91C1C', fontVariant: ['tabular-nums'] },
  wideWeaponStack: { fontSize: 11, fontWeight: '900', color: INK, backgroundColor: COLORS.actionYellow, borderRadius: 4, paddingHorizontal: 3.5, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  wideEvoBlock: { gap: 2 },
  wideEvoLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  wideEvoText: { flex: 1, flexShrink: 1, fontSize: 9.5, fontWeight: '800', color: '#4C1D95', fontVariant: ['tabular-nums'] },
  wideEvoTextAlmost: { color: '#92400E', fontWeight: '900' },
  wideEvoTextUrgent: { color: '#B91C1C', fontWeight: '900' },
  wideEvoTextCooldown: { color: '#4B5563' },
  wideEvoTrack: { height: 3, borderRadius: 1.5, backgroundColor: 'rgba(18, 18, 18, 0.14)', overflow: 'hidden' },
  wideEvoFill: { width: '100%', height: '100%', borderRadius: 1.5, transformOrigin: 'left center' },
  wideArcanaList: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  wideArcanaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: TONE.arcanaPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.arcana, paddingHorizontal: 8, paddingVertical: 4 },
  wideArcanaName: { flexShrink: 1, fontSize: 11, fontWeight: '900', color: TONE.arcana },
  // [UI-15] 8px non-interactive dead-zone buffer below st.hud on mobile portrait + top clip on boardInner
  boardWrap: { flex: 1, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 },
  boardWrapWide: { padding: 12, alignItems: 'center', justifyContent: 'center' },
  boardInner: { flex: 1, width: '100%', position: 'relative' },
  boardInnerPortraitClip: { overflow: 'hidden' },
  surgeBar: { flex: 1, minWidth: 0, minHeight: 22, borderRadius: 999, borderWidth: 1.5, borderColor: INK, backgroundColor: TONE.surgePale, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 1, gap: 4 },
  surgeBarCompact: { flex: 1, paddingHorizontal: 6 },
  surgeBarSoon: { borderColor: TONE.surge },
  surgeBarLive: { borderColor: TONE.surge, backgroundColor: '#9D174D' },
  surgeFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#FBCFE8', transformOrigin: 'left center' },
  surgeFillLive: { backgroundColor: TONE.surge },
  surgePulseRing: { ...StyleSheet.absoluteFillObject, borderRadius: 999, borderWidth: 2, borderColor: TONE.surge },
  surgePulseRingLive: { borderColor: '#FFFDF5' },
  surgeText: { flexShrink: 1, fontSize: 11, fontWeight: '900', color: INK, letterSpacing: 0.2, fontVariant: ['tabular-nums'] },
  surgeTextCompact: { fontSize: 11, letterSpacing: 0.1 },
  tipDim: { position: 'absolute', left: 0, right: 0, zIndex: 299, backgroundColor: 'rgba(10,10,10,0.5)' },
  tipWrap: { position: 'absolute', left: 0, right: 0, zIndex: 300, alignItems: 'center', paddingHorizontal: 12 },
  tipArrow: { width: 18, height: 18, backgroundColor: COLORS.actionYellow, transform: [{ rotate: '45deg' }], marginBottom: -11, alignSelf: 'flex-start', marginLeft: 70 },
  tipCard: { width: '100%', maxWidth: 460, backgroundColor: DARK.panel, borderRadius: 14, borderWidth: 1, borderColor: DARK.goldEdge(0.4), overflow: 'hidden' },
  tipRule: { height: 4, backgroundColor: COLORS.actionYellow },
  tipBody: { padding: 16, gap: 12 },
  tipHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: COLORS.actionYellow, alignItems: 'center', justifyContent: 'center' },
  tipEyebrow: { color: COLORS.actionYellow, fontWeight: '800', letterSpacing: 2, fontSize: 11, textTransform: 'uppercase' },
  tipTitle: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 20 },
  tipText: { color: DARK.text, fontSize: 16, lineHeight: 23 },
  tipBtn: { backgroundColor: COLORS.actionYellow, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  tipBtnText: { color: INK, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,18,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 420, backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 7, borderColor: INK, padding: 18, gap: 10 },
  panelTitle: { fontSize: 24, fontWeight: '900', color: INK, textAlign: 'center' },
  panelSub: { fontSize: 14, color: INK, textAlign: 'center', opacity: 0.85 },
  panelHint: { fontSize: 12, color: INK, opacity: 0.65, textAlign: 'center' },
  pauseStatsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 },
  pauseStatPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 9, paddingVertical: 3 },
  pauseStatText: { fontSize: 12, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  inspectGuardTip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1.5, borderColor: '#D97706', paddingHorizontal: 10, paddingVertical: 6 },
  inspectGuardTipText: { flex: 1, flexShrink: 1, fontSize: 11.5, fontWeight: '800', color: '#92400E' },
  gearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  gearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderColor: INK, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, maxWidth: 170, minHeight: 32 },
  gearText: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: INK },
  pickCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2.5, borderBottomWidth: 4, borderRadius: 10, padding: 10, backgroundColor: COLORS.canvasWhite },
  pickIcon: { width: 46, height: 46, borderRadius: 8, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  pickName: { fontWeight: '900', color: INK, fontSize: 15 },
  pickRarity: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  pickDesc: { fontSize: 13, color: INK, opacity: 0.85 },
});

export default AdventureRun;
