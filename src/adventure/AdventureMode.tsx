/**
 * Adventure Mode root: map ⇄ preview ⇄ lesson ⇄ run ⇄ results ⇄ unlock reveals,
 * plus Camp (fighters, armory, Arcana, Workshop, Bounties, battle history), the
 * Field Guide, and the 5-5 Hydra ending ceremony. Owns the save and the battle
 * history and persists every change.
 *
 * [TP-17] Uses a single discriminated-union `ActiveOverlay` state machine +
 * monotonic `navEpochRef` so overlapping modals and stale `starsLandedMs` timer
 * races are impossible by construction.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { useScreenTransition, type ScreenDirection } from '@/components/ScreenTransition';
import Icon from '@/components/Icon';
import { FightEffectsStorage, SettingsSheet } from '@/components/SettingsSheet';
import { COLORS } from '@/utils/colors';
import { MusicStorage, SoundStorage } from '@/utils/storage';
import { band, music, setMusicEnabled, setSfxOverride, sfx } from '@/audio';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { KEY_PRIORITY, useKeyboardNav } from '@/hooks/useKeyboardNav';
import type { AdventureSave, FeatureDestination, LevelDef, MechanicDef, RunState } from './types';
import { MAIN_LEVELS, getLevel, mainIndexOf } from './data/levels';
import { getMapKey, isMapKeyClaimed, isMapKeyReached, lockedFighters, mapKeyAfter } from './data/mapKeys';
import { CAMPAIGN_FEATURES } from './data/features';
import { MECHANICS } from './data/mechanics';
import {
  applyLevelResult,
  applyRetreatResult,
  armRecipePair,
  claimMapKey,
  equipArcana,
  equipCharm,
  getFrontierLevel,
  hasUnspentStars,
  isLevelUnlocked,
  LESSON_KEYS,
  markCoachMarkSeen,
  markEndingSeen,
  markMechanicSeen,
  markPathsRevealed,
  setCauldronWager,
  setTailwindActive,
  swapCharm,
  toggleArcana,
  toggleCharm,
  type ResultApplication,
  type Unlock,
} from './progress';
import { resolveRunReliefOptions } from './data/relief';
import { isFirstVisit, lessonsDueBefore, taughtOnPreview, type LessonPlan } from './lessons';
import { loadAdventureSave, loadBattleHistory, recordBattle, saveBattleFeedback, writeAdventureSave } from './save';
import type { FightTape } from './engine/replay';
import {
  commitAdventureFight,
  markReplayOpened,
  rateFight,
  stageAdventureFight,
  trackFight,
  type FunRating,
  type FunTag,
} from '@/analytics/fightEvent';
import { battleRecord, bestDpmOn, wasFought, type BattleRecord } from './history';
import { computeStars } from './engine/run';
import { randomSeed } from './engine/rng';
import AdventureMap from './components/AdventureMap';
import LevelPreview from './components/LevelPreview';
import MechanicIntro from './components/MechanicIntro';
import AdventureRun, { type RecordedDefeat } from './components/AdventureRun';
import LevelResults from './components/LevelResults';
import UnlockReveal from './components/UnlockReveal';
import Camp, { type CampTab } from './components/Camp';
import FieldGuide from './components/FieldGuide';
import FriendRescueModal from './components/FriendRescueModal';
import StoryIntro from './components/StoryIntro';
import StoryEndingModal from './components/StoryEndingModal';
import { starsLandedMs } from './components/ui';

type SandboxReturn =
  | { kind: 'camp'; tab?: CampTab; returnLevelId?: string }
  | { kind: 'preview'; levelId: string };

type Screen =
  /** The cold open: the story, then straight into the first fight */
  | { kind: 'story' }
  | { kind: 'map'; highlight?: string | null }
  | { kind: 'run'; levelId: string; seed: number; isRetry?: boolean; sandboxReturn?: SandboxReturn }
  /** `bestDpm`: the best damage per minute on this level before this battle (null: first time) */
  | {
      kind: 'results';
      levelId: string;
      run: RunState;
      stars: number;
      result: ResultApplication;
      bestDpm: number | null;
      fightId: string;
      recordAt: number;
      funRating: FunRating | null;
      funTags: FunTag[];
    }
  | { kind: 'camp'; tab?: CampTab; returnLevelId?: string }
  | { kind: 'guide' };

/** Lessons still to play before a fight starts; the first one is on screen. */
interface Teaching {
  plans: LessonPlan[];
  level: LevelDef;
}

/**
 * [TP-17] Single discriminated-union overlay mutex: concurrent overlapping
 * modals (preview + lesson + unlocks + rescue + ending) are impossible by construction.
 */
type ActiveOverlay =
  | { kind: 'none' }
  | { kind: 'preview'; level: LevelDef }
  | { kind: 'teaching'; teaching: Teaching }
  | { kind: 'reference'; mechanic: MechanicDef; returnPreviewLevel?: LevelDef }
  | { kind: 'unlocks'; unlocks: Unlock[]; pendingEnding?: boolean }
  | { kind: 'rescue'; keyId: string }
  | { kind: 'ending' }
  | { kind: 'settings' };

/**
 * How deep each screen sits: a change to a screen as deep or deeper comes in
 * from the right ("deeper"), a change to a shallower one from the left ("back").
 */
const DEPTH: Record<Screen['kind'], number> = { story: 1, map: 1, camp: 2, guide: 2, run: 2, results: 2 };

const screenFor = (d: FeatureDestination, returnLevelId?: string): Screen => ({ kind: 'camp', tab: d.tab, returnLevelId });

interface Props {
  onExit: () => void;
  /** Optional shortcut when Starfall Summit unlocks on clearing 1-10 or finishing 5-5 */
  onOpenSummit?: () => void;
  autoPlayer?: boolean;
  /** Dev: start with a specific save */
  initialSave?: AdventureSave;
  /**
   * A brand-new player opens on the story and goes straight into the first
   * fight, not on a map of padlocks (default). False: always open on the map.
   */
  coldOpen?: boolean;
  /** Dev (/dev/results): open on the results of this fight, as if it had just been won. Not recorded or sent. */
  devResult?: { levelId: string; run: RunState; stars: number };
  /** Dev (/dev/adventure?rescue=key-1): open the Friend Rescue modal directly for a map key */
  devRescueKeyId?: string;
  /** Dev (/dev/adventure?level=5-4): jump straight into a live fight for this level id */
  devLevelId?: string;
  /** Dev (/dev/adventure?seed=4242): deterministic fight seed when devLevelId is used */
  devSeed?: number;
}

const AdventureMode: React.FC<Props> = ({
  onExit,
  onOpenSummit,
  autoPlayer,
  initialSave,
  coldOpen = true,
  devResult,
  devRescueKeyId,
  devLevelId,
  devSeed,
}) => {
  const [save, setSaveState] = useState<AdventureSave>(() => initialSave ?? loadAdventureSave());
  const saveRef = useRef(save);
  saveRef.current = save;
  const [history, setHistory] = useState<BattleRecord[]>(loadBattleHistory);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [screen, setScreenNow] = useState<Screen>(() =>
    devLevelId
      ? { kind: 'run', levelId: devLevelId, seed: devSeed ?? randomSeed() }
      : coldOpen && isFirstVisit(save)
        ? { kind: 'story' }
        : { kind: 'map' }
  );
  // Every change of screen goes through the one shared transition (src/components/ScreenTransition.tsx)
  const transition = useScreenTransition();
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const reducedMotion = useReducedMotion();

  // [TP-17] Single overlay state machine + monotonic navEpochRef guarding all delayed callbacks
  const [overlay, setOverlay] = useState<ActiveOverlay>(() =>
    devRescueKeyId ? { kind: 'rescue', keyId: devRescueKeyId } : { kind: 'none' }
  );
  /** Put away by hand, the sheet slides down; leaving with its screen (Fight!, Camp), it fades with it */
  const [previewExit, setPreviewExit] = useState<'slide' | 'screen' | 'cut'>('slide');
  const [unlocksRevealed, setUnlocksRevealed] = useState(true);
  const [walkingKeyId, setWalkingKeyId] = useState<string | null>(null);
  const deferredKeyIds = useRef<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const navEpochRef = useRef(0);

  const clearPendingTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  /** Change screen: increments navEpochRef, clears stale timers, closes transient overlays, then runs `also` */
  const setScreen = useCallback((next: Screen, also?: () => void) => {
    navEpochRef.current += 1;
    clearPendingTimers();
    const direction: ScreenDirection = DEPTH[next.kind] >= DEPTH[screenRef.current.kind] ? 1 : -1;
    transition.go(() => {
      setOverlay({ kind: 'none' });
      setScreenNow(next);
      also?.();
    }, direction);
  }, [transition, clearPendingTimers]);

  const setSave = useCallback((next: AdventureSave | ((s: AdventureSave) => AdventureSave)) => {
    setSaveState(prev => {
      const value = typeof next === 'function' ? next(prev) : next;
      saveRef.current = value;
      writeAdventureSave(value);
      return value;
    });
  }, []);

  useAndroidBackHandler(() => {
    if (overlay.kind === 'settings') {
      setOverlay({ kind: 'none' });
      return true;
    }
    if (overlay.kind === 'reference') {
      setOverlay(
        overlay.returnPreviewLevel
          ? { kind: 'preview', level: overlay.returnPreviewLevel }
          : { kind: 'none' }
      );
      return true;
    }
    if (overlay.kind === 'preview') {
      setPreviewExit('slide');
      setOverlay({ kind: 'none' });
      return true;
    }
    if (overlay.kind === 'ending') {
      setSave(markEndingSeen);
      setOverlay({ kind: 'none' });
      return true;
    }
    if (overlay.kind === 'teaching' || overlay.kind === 'rescue' || overlay.kind === 'unlocks' || !unlocksRevealed) {
      return true;
    }
    if (screen.kind === 'camp' || screen.kind === 'guide' || screen.kind === 'results') {
      setScreen({ kind: 'map' });
      return true;
    }
    if (screen.kind === 'run') {
      if (screen.sandboxReturn) {
        const ret = screen.sandboxReturn;
        if (ret.kind === 'camp') {
          setScreen({ kind: 'camp', tab: ret.tab, returnLevelId: ret.returnLevelId });
        } else {
          const retLvl = getLevel(ret.levelId);
          setScreen({ kind: 'map', highlight: retLvl.id }, () => setOverlay({ kind: 'preview', level: retLvl }));
        }
      }
      return true;
    }
    onExit();
    return true;
  });

  // Decoupled audio controls: Music (MusicStorage / Camp switch) and SFX (SoundStorage)
  // operate independently so players can mute background music while keeping crisp SFX.
  const [musicPref, setMusicPref] = useState<boolean>(() => {
    if (typeof MusicStorage?.hasValue === 'function' && MusicStorage.hasValue()) {
      return MusicStorage.get();
    }
    const stored = typeof MusicStorage?.get === 'function' ? MusicStorage.get() : true;
    return save.musicOn && stored;
  });
  const [sfxPref, setSfxPref] = useState<boolean>(() =>
    typeof SoundStorage?.get === 'function' ? SoundStorage.get() : save.musicOn
  );
  const prevSaveMusicOn = useRef(save.musicOn);

  useEffect(() => {
    const unsubMusic = typeof MusicStorage?.subscribe === 'function' ? MusicStorage.subscribe(setMusicPref) : undefined;
    const unsubSfx = typeof SoundStorage?.subscribe === 'function' ? SoundStorage.subscribe(setSfxPref) : undefined;
    return () => {
      unsubMusic?.();
      unsubSfx?.();
    };
  }, []);

  useEffect(() => {
    if (save.musicOn !== prevSaveMusicOn.current) {
      prevSaveMusicOn.current = save.musicOn;
      setMusicPref(save.musicOn);
      if (typeof MusicStorage?.set === 'function') {
        MusicStorage.set(save.musicOn);
      }
    }
  }, [save.musicOn]);

  useEffect(() => {
    setMusicEnabled(musicPref);
  }, [musicPref]);

  useEffect(() => {
    setSfxOverride(sfxPref);
  }, [sfxPref]);

  useEffect(() => () => setSfxOverride(null), []);

  // Map / Field Guide music (StoryIntro plays 'story' and Camp plays 'camp' via [AU-20])
  useEffect(() => {
    if (screen.kind === 'map' || screen.kind === 'guide') {
      if (typeof band?.playScreenMusic === 'function') band.playScreenMusic('map');
      else music.play('map');
    }
  }, [screen.kind]);

  useEffect(() => () => {
    navEpochRef.current += 1;
    commitAdventureFight('unmount');
    music.stop();
    clearPendingTimers();
  }, [clearPendingTimers]);

  const startRun = useCallback((level: LevelDef, opts?: { also?: () => void; isRetry?: boolean }) => {
    setUnlocksRevealed(true);
    setScreen({ kind: 'run', levelId: level.id, seed: randomSeed(), ...(opts?.isRetry ? { isRetry: true } : {}) }, opts?.also);
  }, [setScreen]);

  const handlePlay = (level: LevelDef) => {
    sfx('confirm');
    // The sheet is part of the screen that leaves: it fades out with the map, as one
    // picture, and is taken away at the swap (never a frame of bare map before the fight)
    setPreviewExit('cut');
    if (level.id === MAIN_LEVELS[0].id) {
      setSave(s => markMechanicSeen(s, LESSON_KEYS.mechanic(level.introduces)));
      startRun(level);
      return;
    }
    // What the preview sheet already taught is simply recorded; anything bigger gets its own lesson first
    const due = lessonsDueBefore(level, save);
    const taught = due.filter(p => taughtOnPreview(p, level));
    const plans = due.filter(p => !taughtOnPreview(p, level));
    if (taught.length > 0) setSave(s => taught.flatMap(p => p.marks).reduce(markMechanicSeen, s));
    if (plans.length > 0) {
      // A lesson card comes first, over the map: the sheet fades under it
      setPreviewExit('screen');
      setOverlay({ kind: 'teaching', teaching: { plans, level } });
    } else {
      startRun(level);
    }
  };

  /** The story is over (or skipped): the first fight starts at once, with no map and no preview in between. */
  const startFirstFight = () => {
    const first = MAIN_LEVELS[0];
    setSave(s => markMechanicSeen(s, LESSON_KEYS.mechanic(first.introduces)));
    startRun(first);
  };

  /** The lesson on screen was accepted: record it, then show the next one or start the fight. */
  const finishLesson = ({ plans: [done, ...rest], level }: Teaching) => {
    setSave(s => done.marks.reduce(markMechanicSeen, s));
    if (rest.length > 0) setOverlay({ kind: 'teaching', teaching: { plans: rest, level } });
    else {
      setOverlay({ kind: 'none' });
      startRun(level);
    }
  };

  const remember = useCallback((record: BattleRecord) => {
    setHistory(h => {
      const next = recordBattle(h, record);
      historyRef.current = next;
      return next;
    });
  }, []);

  /** The results screen, then (once the stars have landed) epoch-guarded UnlockReveal and/or 5-5 Ending Ceremony */
  const showResults = useCallback((
    level: LevelDef,
    run: RunState,
    stars: number,
    result: ResultApplication,
    bestDpm: number | null,
    fightId: string,
    at: number,
    opts?: { triggerEnding?: boolean }
  ) => {
    const triggerEnding = Boolean(opts?.triggerEnding);
    setScreen({
      kind: 'results',
      levelId: level.id,
      run,
      stars,
      result,
      bestDpm,
      fightId,
      recordAt: at,
      funRating: null,
      funTags: [],
    }, () => {
      const epoch = navEpochRef.current;
      if (result.unlocks.length > 0) {
        // Let the stars land first, then give each unlock its own moment (epoch-guarded against rapid taps!)
        setUnlocksRevealed(false);
        timers.current.push(
          setTimeout(() => {
            if (navEpochRef.current !== epoch) return;
            setOverlay({ kind: 'unlocks', unlocks: result.unlocks, pendingEnding: triggerEnding });
          }, starsLandedMs(stars))
        );
      } else {
        setUnlocksRevealed(true);
        if (triggerEnding) {
          timers.current.push(
            setTimeout(() => {
              if (navEpochRef.current !== epoch) return;
              setOverlay({ kind: 'ending' });
            }, starsLandedMs(stars))
          );
        }
      }
    });
  }, [setScreen]);

  const handleFinish = (level: LevelDef, run: RunState, tape: FightTape) => {
    const before = saveRef.current;
    const stars = computeStars(run);
    const result = applyLevelResult(before, level, stars, run.coins, run);
    setSave(result.save);
    const bestDpm = bestDpmOn(historyRef.current, level.id);
    const at = Date.now();
    const fightId = `${at}-${tape.recording.seed}`;
    const record = battleRecord(level, run, {
      at,
      stars,
      coins: result.coinsBanked + result.starCoins + result.bountyCoins,
      fightId,
    });
    remember(record);
    stageAdventureFight(level, run, record, tape, { fightId, afterSave: result.save });
    const triggerEnding = level.id === '5-5' && stars >= 1 && !before.endingSeen;
    showResults(level, run, stars, result, bestDpm, fightId, at, { triggerEnding });
  };

  /** [OB-13] Record a defeat once when DefeatOverlay mounts over the paused board (1 wide fight_ended event!). */
  const handleDefeatRecorded = useCallback((level: LevelDef, run: RunState, tape: FightTape): RecordedDefeat => {
    const before = saveRef.current;
    const result = applyLevelResult(before, level, 0, run.coins, run);
    setSave(result.save);
    const bestDpm = bestDpmOn(historyRef.current, level.id);
    const at = Date.now();
    const fightId = `${at}-${tape.recording.seed}`;
    const record = battleRecord(level, run, {
      at,
      stars: 0,
      coins: result.coinsBanked + result.starCoins + result.bountyCoins,
      fightId,
    });
    remember(record);
    stageAdventureFight(level, run, record, tape, { fightId, afterSave: result.save });
    return { result, bestDpm, fightId, recordAt: at };
  }, [setSave, remember]);

  /** [OB-13] Commit staged defeat telemetry and return fresh save/relief for `<250ms` in-place retry. */
  const handleDefeatRetryStart = useCallback((level: LevelDef, opts?: { armRecipeId?: string }) => {
    commitAdventureFight('defeat_retry');
    let nextSave = saveRef.current;
    if (opts?.armRecipeId) {
      nextSave = armRecipePair(nextSave, opts.armRecipeId);
      setSave(nextSave);
    }
    const nextRelief = resolveRunReliefOptions(level, nextSave);
    return { save: nextSave, relief: nextRelief };
  }, [setSave]);

  // Dev: the results of a canned fight, through the same path as a real one (the save is not written)
  useEffect(() => {
    if (!devResult) return;
    const level = getLevel(devResult.levelId);
    const result = applyLevelResult(save, level, devResult.stars, devResult.run.coins, devResult.run);
    setSaveState(result.save);
    saveRef.current = result.save;
    showResults(level, devResult.run, devResult.stars, result, null, `dev-${devResult.levelId}-${devResult.stars}`, Date.now());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** A fight left partway through (retreat or restart) is still a battle, once a move was made. */
  const handleLeft = (level: LevelDef, run: RunState, tape: FightTape) => {
    if (!wasFought(run)) return;
    const { save: nextSave, coinsRetained } = applyRetreatResult(saveRef.current, level, run);
    if (coinsRetained > 0) setSave(nextSave);
    const at = Date.now();
    const fightId = `${at}-${tape.recording.seed}`;
    const record = battleRecord(level, run, { at, left: true, coins: coinsRetained, fightId });
    remember(record);
    trackFight(level, run, record, tape, { fightId, afterSave: nextSave });
  };

  const handleResultsRateFun = (rating: FunRating | null, tags: FunTag[]) => {
    setScreenNow(prev => (prev.kind === 'results' ? { ...prev, funRating: rating, funTags: tags } : prev));
    if (screen.kind !== 'results') return;
    const { fightId, recordAt, levelId } = screen;
    setHistory(h => {
      const next = saveBattleFeedback(h, { fightId, at: recordAt, levelId }, { funRating: rating, funTags: tags });
      historyRef.current = next;
      return next;
    });
    rateFight(fightId, { funRating: rating, funTags: tags }, { source: 'results' });
  };

  const handleCampRateBattle = (battle: BattleRecord, rating: FunRating | null, tags: FunTag[]) => {
    const match = { fightId: battle.fightId, at: battle.at, levelId: battle.levelId };
    setHistory(h => {
      const next = saveBattleFeedback(h, match, { funRating: rating, funTags: tags });
      historyRef.current = next;
      return next;
    });
    rateFight(
      battle.fightId ?? `${battle.at}-${battle.levelId}`,
      { funRating: rating, funTags: tags },
      { source: 'history' }
    );
  };

  /** Next stop on the main path (an elite branch leads back to the map). */
  const nextLevelAfter = (level: LevelDef): LevelDef | null =>
    level.branchOf ? null : MAIN_LEVELS[mainIndexOf(level) + 1] ?? null;

  /** Unclaimed, reached Golden Rescue Key sitting right after `levelId` (Angry Birds 2 walk-over). */
  const readyKeyAfter = (levelId: string) => {
    const key = mapKeyAfter(levelId);
    if (!key) return null;
    if (!isMapKeyReached(save, key) || isMapKeyClaimed(save, key)) return null;
    if (lockedFighters(save).length === 0) return null;
    if (deferredKeyIds.current.has(key.id)) return null;
    return key;
  };

  // [UI-23] Unified web keyboard navigation across Map, Preview, Reference, Camp, FieldGuide & Results
  useKeyboardNav({
    enabled: screen.kind === 'map' && overlay.kind === 'none',
    priority: KEY_PRIORITY.SCREEN,
    onConfirm: () => {
      const frontier = getFrontierLevel(save);
      setWalkingKeyId(null);
      sfx('click');
      setOverlay({ kind: 'preview', level: frontier });
    },
    onCancel: () => transition.go(() => { music.stop(); onExit(); }, -1),
  });

  useKeyboardNav({
    enabled: overlay.kind === 'preview',
    priority: KEY_PRIORITY.SHEET,
    onConfirm: () => {
      if (overlay.kind === 'preview') {
        handlePlay(overlay.level);
      }
    },
    onCancel: () => {
      setPreviewExit('slide');
      setOverlay({ kind: 'none' });
    },
  });

  useKeyboardNav({
    enabled: overlay.kind === 'reference',
    priority: KEY_PRIORITY.MODAL,
    onCancel: () =>
      setOverlay(
        overlay.kind === 'reference' && overlay.returnPreviewLevel
          ? { kind: 'preview', level: overlay.returnPreviewLevel }
          : { kind: 'none' }
      ),
  });

  useKeyboardNav({
    enabled: (screen.kind === 'camp' || screen.kind === 'guide') && overlay.kind === 'none',
    priority: KEY_PRIORITY.SCREEN,
    onCancel: () => setScreen({ kind: 'map' }),
  });

  useKeyboardNav({
    enabled: screen.kind === 'results' && overlay.kind === 'none' && unlocksRevealed,
    priority: KEY_PRIORITY.SCREEN,
    onConfirm: () => {
      if (screen.kind !== 'results') return;
      const lvl = getLevel(screen.levelId);
      const nxt = nextLevelAfter(lvl);
      const canNext = screen.stars > 0 && Boolean(nxt && isLevelUnlocked(save, nxt));
      if (canNext && nxt) {
        commitAdventureFight('results_next');
        const key = readyKeyAfter(lvl.id);
        if (key) {
          setScreen({ kind: 'map', highlight: lvl.id }, () => setWalkingKeyId(key.id));
        } else {
          const nextIsNew = !save.seenMechanics.includes(nxt.introduces);
          if (!nextIsNew && !nxt.isBoss && !hasUnspentStars(save)) {
            startRun(nxt);
          } else {
            setOverlay({ kind: 'preview', level: nxt });
          }
        }
      } else {
        commitAdventureFight('results_retry');
        startRun(lvl, { isRetry: true });
      }
    },
    onRetry: () => {
      if (screen.kind !== 'results') return;
      const lvl = getLevel(screen.levelId);
      commitAdventureFight('results_retry');
      startRun(lvl, { isRetry: true });
    },
    onCancel: () => {
      if (screen.kind !== 'results') return;
      const lvl = getLevel(screen.levelId);
      const nxt = nextLevelAfter(lvl);
      commitAdventureFight('results_map');
      const key = readyKeyAfter(lvl.id);
      setScreen(
        { kind: 'map', highlight: key ? lvl.id : nxt && isLevelUnlocked(save, nxt) ? nxt.id : lvl.id },
        () => { if (key) setWalkingKeyId(key.id); }
      );
    },
  });

  const previewLevel = overlay.kind === 'preview' ? overlay.level : null;
  const activeTeaching = overlay.kind === 'teaching' ? overlay.teaching : null;
  const activeReference = overlay.kind === 'reference' ? overlay.mechanic : null;
  const activeUnlocks = overlay.kind === 'unlocks' ? overlay.unlocks : [];
  const activeRescueKeyId = overlay.kind === 'rescue' ? overlay.keyId : null;

  let body: React.ReactNode = null;
  if (screen.kind === 'story') {
    body = <StoryIntro fighter={save.selectedFighter} onDone={startFirstFight} />;
  } else if (screen.kind === 'map') {
    const mapActive = overlay.kind === 'none';
    body = (
      <AdventureMap
        save={save}
        active={mapActive}
        highlightLevelId={screen.highlight}
        walkingKeyId={walkingKeyId}
        onOpenMapKey={keyId => { setWalkingKeyId(null); setOverlay({ kind: 'rescue', keyId }); }}
        onWalkKeyArrived={keyId => { setWalkingKeyId(null); setOverlay({ kind: 'rescue', keyId }); }}
        onPathsRevealed={ids => setSave(s => markPathsRevealed(s, ids))}
        onSelectLevel={l => { setWalkingKeyId(null); sfx('click'); setOverlay({ kind: 'preview', level: l }); }}
        onOpenCamp={() => { setWalkingKeyId(null); sfx('confirm'); setScreen({ kind: 'camp' }); }}
        onOpenGuide={() => { setWalkingKeyId(null); sfx('confirm'); setScreen({ kind: 'guide' }); }}
        onExit={() => transition.go(() => { music.stop(); onExit(); }, -1)}
      />
    );
  } else if (screen.kind === 'run') {
    const level = getLevel(screen.levelId);
    const relief = resolveRunReliefOptions(level, save);
    const sandboxReturn = screen.sandboxReturn;
    const handleSandboxReturn = sandboxReturn
      ? () => {
          if (sandboxReturn.kind === 'camp') {
            setScreen({ kind: 'camp', tab: sandboxReturn.tab, returnLevelId: sandboxReturn.returnLevelId });
          } else {
            const retLvl = getLevel(sandboxReturn.levelId);
            setScreen({ kind: 'map', highlight: retLvl.id }, () => setOverlay({ kind: 'preview', level: retLvl }));
          }
        }
      : undefined;
    body = (
      <AdventureRun
        key={`${screen.levelId}-${screen.seed}`}
        level={level}
        save={save}
        seed={screen.seed}
        relief={relief}
        initialIsRetry={screen.isRetry}
        sandboxReturnLabel={sandboxReturn ? (sandboxReturn.kind === 'preview' ? 'Back to Preview' : 'Back to Camp') : undefined}
        onSandboxReturn={handleSandboxReturn}
        autoPlayer={autoPlayer}
        onFinish={(run, tape) => handleFinish(level, run, tape)}
        onQuit={(run, tape) => { handleLeft(level, run, tape); setScreen({ kind: 'map', highlight: level.id }); }}
        onRestart={(run, tape) => { handleLeft(level, run, tape); startRun(level, { isRetry: true }); }}
        onCoachMarkSeen={id => setSave(s => markCoachMarkSeen(s, id))}
        onDefeatRecorded={(run, tape) => handleDefeatRecorded(level, run, tape)}
        onShowDefeatBreakdown={(run, recorded) => {
          showResults(level, run, 0, recorded.result, recorded.bestDpm, recorded.fightId, recorded.recordAt);
        }}
        onDefeatRetryStart={opts => handleDefeatRetryStart(level, opts)}
        onDefeatCamp={tab => {
          commitAdventureFight('results_camp');
          setScreen({ kind: 'camp', tab, returnLevelId: level.id });
        }}
        onDefeatMap={() => {
          commitAdventureFight('results_map');
          setScreen({ kind: 'map', highlight: level.id });
        }}
        onToggleTailwind={active => setSave(s => setTailwindActive(s, active))}
        effects={save.effectsOn && !reducedMotion}
        // A device that asks for reduced motion keeps effects off
        onToggleEffects={reducedMotion ? undefined : () => setSave(s => ({ ...s, effectsOn: !s.effectsOn }))}
      />
    );
  } else if (screen.kind === 'results') {
    const level = getLevel(screen.levelId);
    const next = nextLevelAfter(level);
    body = (
      <LevelResults
        level={level}
        run={screen.run}
        stars={screen.stars}
        result={screen.result}
        bestDpm={screen.bestDpm}
        unlocksRevealed={unlocksRevealed}
        nextLevel={next}
        nextUnlocked={!!next && isLevelUnlocked(save, next)}
        funRating={screen.funRating}
        funTags={screen.funTags}
        onRateFun={handleResultsRateFun}
        onReplayOpened={() => markReplayOpened(screen.fightId)}
        onRetry={() => { commitAdventureFight('results_retry'); startRun(level, { isRetry: true }); }}
        onArmRecipeAndRetry={recipeId => {
          commitAdventureFight('results_retry');
          setSave(s => armRecipePair(s, recipeId));
          startRun(level, { isRetry: true });
        }}
        onWatchEnding={level.id === '5-5' ? () => setOverlay({ kind: 'ending' }) : undefined}
        onNext={() => {
          commitAdventureFight('results_next');
          const key = readyKeyAfter(level.id);
          if (key) {
            setScreen({ kind: 'map', highlight: level.id }, () => setWalkingKeyId(key.id));
          } else if (next) {
            // [OB-16] Keep LevelPreview for NEW mechanics, bosses, or unspent loadout/stars; fast-launch already-seen repeat levels!
            const nextIsNew = !save.seenMechanics.includes(next.introduces);
            if (!nextIsNew && !next.isBoss && !hasUnspentStars(save)) {
              startRun(next);
            } else {
              setOverlay({ kind: 'preview', level: next });
            }
          }
        }}
        onMap={() => {
          commitAdventureFight('results_map');
          const key = readyKeyAfter(level.id);
          setScreen(
            { kind: 'map', highlight: key ? level.id : next && isLevelUnlocked(save, next) ? next.id : level.id },
            () => { if (key) setWalkingKeyId(key.id); }
          );
        }}
        onCamp={requestedTab => {
          commitAdventureFight('results_camp');
          // Land on the requested tab (e.g. Skill Tree / Workshop quick-action), the unlocked feature tab, or Bounties
          const tab: CampTab | undefined =
            requestedTab ??
            screen.result.unlocks.flatMap(u => (u.kind === 'feature' ? [CAMPAIGN_FEATURES[u.feature].open?.destination.tab] : []))[0] ??
            (screen.result.completedBounties.length > 0 ? 'bounties' : undefined);
          const returnLevelId = next && isLevelUnlocked(save, next) ? next.id : level.id;
          setScreen({ kind: 'camp', tab, returnLevelId });
        }}
      />
    );
  } else if (screen.kind === 'camp') {
    const returnLevel = screen.returnLevelId ? getLevel(screen.returnLevelId) : null;
    body = (
      <Camp
        save={save}
        history={history}
        initialTab={screen.tab}
        returnLevel={returnLevel}
        onReturnToLevel={lvl => {
          sfx('confirm');
          // [OB-16] Skip the Map + LevelPreview detour when the level's mechanic is already seen!
          const extraLessons = lessonsDueBefore(lvl, save).filter(p => !taughtOnPreview(p, lvl));
          if (extraLessons.length === 0 && save.seenMechanics.includes(lvl.introduces)) {
            startRun(lvl);
          } else {
            setScreen({ kind: 'map', highlight: lvl.id }, () => setOverlay({ kind: 'preview', level: lvl }));
          }
        }}
        onChange={setSave}
        onRateBattle={handleCampRateBattle}
        onTestLoadout={activeTab => {
          setScreen({
            kind: 'run',
            levelId: '1-4D',
            seed: randomSeed(),
            sandboxReturn: {
              kind: 'camp',
              tab: activeTab ?? screen.tab,
              returnLevelId: screen.returnLevelId,
            },
          });
        }}
        onClose={() => setScreen({ kind: 'map' })}
      />
    );
  } else if (screen.kind === 'guide') {
    body = (
      <FieldGuide
        save={save}
        onReplayWalkthrough={() => startRun(MAIN_LEVELS[0])}
        onClose={() => setScreen({ kind: 'map' })}
      />
    );
  }

  return (
    <View style={st.root}>
      <Animated.View style={[st.screen, transition.style]} pointerEvents={transition.leaving ? 'none' : 'auto'}>
        {body}
        {/* Inside the screen layer: the sheet leaves with its screen, and its layer's one opacity keeps them one picture */}
        <LevelPreview
          level={previewLevel}
          save={save}
          exit={previewExit}
          onClose={() => { setPreviewExit('slide'); setOverlay({ kind: 'none' }); }}
          onPlay={handlePlay}
          onSelectFighter={f => { sfx('click'); setSave(s => ({ ...s, selectedFighter: f })); }}
          onSelectCharm={id => { sfx('click'); setSave(s => toggleCharm(s, id)); }}
          onArmRecipe={recipeId => { sfx('confirm'); setSave(s => armRecipePair(s, recipeId)); }}
          onSelectArcana={id => { sfx('click'); setSave(s => toggleArcana(s, id)); }}
          onToggleTailwind={active => { sfx('click'); setSave(s => setTailwindActive(s, active)); }}
          onSelectWager={tier => { sfx('click'); setSave(s => setCauldronWager(s, tier)); }}
          onApplyLoadout={nextSave => setSave(nextSave)}
          onTestLoadout={
            previewLevel && !previewLevel.rules.sandbox
              ? () => {
                  sfx('confirm');
                  const lvlId = previewLevel.id;
                  setPreviewExit('cut');
                  setScreen({
                    kind: 'run',
                    levelId: '1-4D',
                    seed: randomSeed(),
                    sandboxReturn: { kind: 'preview', levelId: lvlId },
                  });
                }
              : undefined
          }
          onShowMechanic={id =>
            setOverlay({
              kind: 'reference',
              mechanic: MECHANICS[id],
              returnPreviewLevel: previewLevel ?? undefined,
            })
          }
          onOpenCamp={tab => {
            // The lesson was read and is being acted on: it counts as seen, and the fight waits on the map
            sfx('confirm');
            const returnLevelId = previewLevel?.id;
            if (previewLevel) setSave(s => markMechanicSeen(s, LESSON_KEYS.mechanic(previewLevel.introduces)));
            setPreviewExit('cut');
            setScreen({ kind: 'camp', tab, returnLevelId });
          }}
        />
      </Animated.View>
      {activeTeaching ? (
        <MechanicIntro
          mechanic={activeTeaching.plans[0].mechanic}
          prelude={activeTeaching.plans[0].prelude}
          fighter={save.selectedFighter}
          brief
          cta={activeTeaching.plans.length > 1 ? `Next: ${activeTeaching.plans[1].mechanic.title}` : activeTeaching.level.rules.sandbox ? 'Start practising' : 'Let\'s play!'}
          onClose={() => finishLesson(activeTeaching)}
        />
      ) : (
        <MechanicIntro
          mechanic={activeReference}
          fighter={save.selectedFighter}
          cta="Close"
          quiz={false}
          dismissible
          onClose={() =>
            setOverlay(
              overlay.kind === 'reference' && overlay.returnPreviewLevel
                ? { kind: 'preview', level: overlay.returnPreviewLevel }
                : { kind: 'none' }
            )
          }
        />
      )}
      {activeUnlocks.length > 0 && (
        <UnlockReveal
          unlocks={activeUnlocks}
          save={save}
          onUseFighter={name => setSave(s => ({ ...s, selectedFighter: name }))}
          onEquipCharm={id => setSave(s => equipCharm(s, id))}
          onSwapCharm={(replaceId, withId) => { sfx('confirm'); setSave(s => swapCharm(s, replaceId, withId)); }}
          onEquipArcana={id => setSave(s => equipArcana(s, id))}
          onOpenFeature={feature => {
            const open = CAMPAIGN_FEATURES[feature].open;
            if (open) {
              let returnLevelId: string | undefined;
              if (screen.kind === 'results') {
                const lvl = getLevel(screen.levelId);
                const nxt = MAIN_LEVELS[mainIndexOf(lvl) + 1] ?? null;
                returnLevelId = nxt && isLevelUnlocked(save, nxt) ? nxt.id : screen.levelId;
              }
              setScreen(screenFor(open.destination, returnLevelId));
            }
          }}
          onShowPath={id => setScreen({ kind: 'map', highlight: id })}
          onOpenSummit={onOpenSummit ? () => { clearPendingTimers(); music.stop(); onOpenSummit(); } : undefined}
          onDone={() => {
            const openEndingNext = overlay.kind === 'unlocks' && Boolean(overlay.pendingEnding);
            setUnlocksRevealed(true);
            setOverlay(openEndingNext ? { kind: 'ending' } : { kind: 'none' });
          }}
        />
      )}
      <FriendRescueModal
        keyDef={activeRescueKeyId ? getMapKey(activeRescueKeyId) ?? null : null}
        save={save}
        onRescue={(keyId, fighterName) => {
          deferredKeyIds.current.delete(keyId);
          setSave(s => claimMapKey(s, keyId, fighterName));
        }}
        onUseFighter={fighterName => setSave(s => ({ ...s, selectedFighter: fighterName }))}
        onClose={deferred => {
          if (deferred && activeRescueKeyId) deferredKeyIds.current.add(activeRescueKeyId);
          setOverlay({ kind: 'none' });
        }}
      />
      <StoryEndingModal
        visible={overlay.kind === 'ending'}
        save={save}
        onDone={() => {
          setSave(markEndingSeen);
          setOverlay({ kind: 'none' });
        }}
        onOpenSummit={onOpenSummit ? () => {
          setSave(markEndingSeen);
          clearPendingTimers();
          music.stop();
          onOpenSummit();
        } : undefined}
      />
      {/* [UI-21] Non-overlapping >=44x44 global Settings trigger on Adventure Map */}
      {screen.kind === 'map' && overlay.kind === 'none' && (
        <TouchableOpacity
          testID="adventure-settings-trigger"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          activeOpacity={0.85}
          onPress={() => {
            sfx('click');
            setOverlay({ kind: 'settings' });
          }}
          style={st.settingsFab}
        >
          <Icon name="lorc/gear-hammer" size={20} color={COLORS.slateCharcoal} noShadow />
        </TouchableOpacity>
      )}
      {overlay.kind === 'settings' && (
        <SettingsSheet
          visible
          onClose={() => setOverlay({ kind: 'none' })}
          effectsOn={save.effectsOn}
          onToggleEffects={() => {
            const next = !save.effectsOn;
            FightEffectsStorage.set(next);
            setSave(s => ({ ...s, effectsOn: next }));
          }}
          onMusicChange={enabled => {
            prevSaveMusicOn.current = enabled;
            setSave(s => (s.musicOn === enabled ? s : { ...s, musicOn: enabled }));
          }}
          onReplayWalkthrough={() => {
            setOverlay({ kind: 'none' });
            startRun(MAIN_LEVELS[0]);
          }}
          onSaveRestored={() => {
            const reloaded = loadAdventureSave();
            setSaveState(reloaded);
            saveRef.current = reloaded;
          }}
          onResetGame={() => {
            const fresh = loadAdventureSave();
            setSaveState(fresh);
            saveRef.current = fresh;
            const freshHistory = loadBattleHistory();
            setHistory(freshHistory);
            historyRef.current = freshHistory;
            setOverlay({ kind: 'none' });
            setScreen({ kind: 'map' });
          }}
        />
      )}
    </View>
  );
};

const st = StyleSheet.create({
  // Paper shows for the frame or two between one screen leaving and the next arriving
  root: { flex: 1, backgroundColor: COLORS.paperBeige },
  screen: { flex: 1 },
  settingsFab: {
    position: 'absolute',
    right: 12,
    bottom: 92,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.canvasWhite,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
});

export default AdventureMode;
