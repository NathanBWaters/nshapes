import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePWASafeAreaInsets } from '@/hooks/usePWASafeAreaInsets';
import { trackFreePlayFight, type FunRating } from '@/analytics/fightEvent';
import {
  dailySeedFor,
  evaluateFreePlayDaily,
  formatFreePlayDailyShareCard,
  FREE_PLAY_DAILY_DURATION_SEC,
  normalizeDateKey,
  type FreePlayDailyEvaluation,
} from '@/adventure/dailySeed';
import { createRng, type Rng } from '@/adventure/engine/rng';
import { loadAdventureSave } from '@/adventure/save';
import { dealBoardAndDeck, getBoardSize } from '@/game/board';
import { createInitialGameState } from '@/game/gameState';
import type { GameState } from '@/game/types';
import { useAppActive } from '@/hooks/useAppActive';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { useFighterConductor } from '@/hooks/useFighterConductor';
import { useParticles } from '@/hooks/useParticles';
import type { AttributeName, Card, CardReward, FreePlayDifficulty } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { FreePlayRecordsStorage, type FreePlayRecords } from '@/utils/freePlayStorage';
import { ATTRIBUTE_SCALING, getAdjustedLevelFromXP } from '@/utils/gameConfig';
import { calculatePlayerTotalStats, initializePlayer } from '@/utils/gameDefinitions';
import {
  createDeck,
  findAllCombinations,
  isValidCombination,
  sameCardAttributes,
} from '@/utils/gameUtils';
import { triggerHaptic } from '@/utils/haptics';
import { band } from '@/audio';
import { registerInterval } from '@/utils/perfWatchdog';
import { playCardDealing, playSound } from '@/utils/sounds';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import DifficultySelection from './DifficultySelection';
import FreePlayHeader from './FreePlayHeader';
import GameBoard from './GameBoard';
import Icon from './Icon';
import Notification from './Notification';

export type FreePlaySubMode = 'zen' | 'daily';

export interface FreePlayModeProps {
  onExit: () => void;
  autoPlayer?: boolean;
  /** Optional deep-link launch directly into Daily 3-Min Score Attack (`?mode=freeplay&daily=YYYY-MM-DD`). */
  initialSubMode?: FreePlaySubMode;
  initialDailyDate?: string;
}

const ZEN_MILESTONES = new Set([10, 25, 50]);

const formatClock = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatSprintTime = (ms: number | null): string => {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return '—';
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const m = Math.floor(secs / 60);
  const rem = (secs % 60).toFixed(0).padStart(2, '0');
  return `${m}:${rem}`;
};

/**
 * Ensure `board` contains at least one valid Set by swapping its last slot with
 * a completing card from `deck` if needed (deterministic, zero Math.random()).
 */
const ensureSolvableBoard = (
  board: Card[],
  deck: Card[],
  activeAttributes: AttributeName[]
): { board: Card[]; deck: Card[] } => {
  if (board.length < 3 || deck.length === 0) return { board, deck };
  if (findAllCombinations(board, activeAttributes).length > 0) return { board, deck };
  const nextBoard = [...board];
  const nextDeck = [...deck];
  for (let i = 0; i < nextBoard.length - 1; i++) {
    for (let j = i + 1; j < nextBoard.length - 1; j++) {
      const idx = nextDeck.findIndex(
        c => isValidCombination([nextBoard[i], nextBoard[j], c], activeAttributes).isValid
      );
      if (idx >= 0) {
        const swappedOut = nextBoard[nextBoard.length - 1];
        nextBoard[nextBoard.length - 1] = { ...nextDeck[idx], selected: false };
        nextDeck[idx] = { ...swappedOut, selected: false };
        return { board: nextBoard, deck: nextDeck };
      }
    }
  }
  return { board: nextBoard, deck: nextDeck };
};

/**
 * Deterministic Daily Free Play deal: identical deck order for every player on
 * the same UTC calendar date (`YYYY-MM-DD`) via Mulberry32 PRNG.
 */
export const dealDeterministicFreePlayBoard = (
  activeAttributes: AttributeName[],
  fieldSize: number,
  seed: number
): { board: Card[]; deck: Card[]; rng: Rng } => {
  const rng = createRng(seed);
  const size = getBoardSize(activeAttributes, fieldSize);
  const shuffled = rng.shuffle(createDeck(activeAttributes));
  const rawBoard = shuffled.slice(0, size).map(c => ({ ...c, selected: false }));
  const rawDeck = shuffled.slice(size).map(c => ({ ...c, selected: false }));
  const ensured = ensureSolvableBoard(rawBoard, rawDeck, activeAttributes);
  return { ...ensured, rng };
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const Clipboard = await import('expo-clipboard');
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(text);
      return true;
    }
  } catch {
    // Clipboard blocked or unavailable
  }
  return false;
};

const createEmptyFreePlayState = (characterName: string): GameState => {
  const activeAttributes: AttributeName[] = [...ATTRIBUTE_SCALING.difficultyPresets.easy];
  return createInitialGameState({
    player: initializePlayer('player1', 'Player 1', characterName),
    activeAttributes,
  });
};

/**
 * Goal-driven Free Play mode (`[GP-24]`):
 *  1. Zen Endless — 1-tap launch from DifficultySelection, persists Personal Best
 *     Streak, Fastest 10-Set Sprint & Total Sets Found with milestone chimes at
 *     10 / 25 / 50 Sets.
 *  2. Daily 3-Minute Score Attack — deterministic UTC date seed (`YYYY-MM-DD`),
 *     Bronze / Silver / Gold / Starfall medals, GSP-style Pattern Power percentile
 *     framing, and spoiler-free Share Card.
 */
const FreePlayMode: React.FC<FreePlayModeProps> = ({
  onExit,
  autoPlayer = false,
  initialSubMode,
  initialDailyDate,
}) => {
  const insets = usePWASafeAreaInsets();
  const defaultCharacter = useMemo(() => {
    try {
      return loadAdventureSave().selectedFighter || 'Orange Tabby';
    } catch {
      return 'Orange Tabby';
    }
  }, []);

  const dailyDateKey = useMemo(() => normalizeDateKey(initialDailyDate), [initialDailyDate]);

  const [records, setRecords] = useState<FreePlayRecords>(() => FreePlayRecordsStorage.load());
  const [subMode, setSubMode] = useState<FreePlaySubMode | null>(null);
  const [difficulty, setDifficulty] = useState<FreePlayDifficulty | null>(null);
  const [state, setState] = useState<GameState>(() => createEmptyFreePlayState(defaultCharacter));
  const [mistakes, setMistakes] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [sessionBestStreak, setSessionBestStreak] = useState(0);
  const [dailySecondsLeft, setDailySecondsLeft] = useState(FREE_PLAY_DAILY_DURATION_SEC);
  const [dailyResults, setDailyResults] = useState<{
    evaluation: FreePlayDailyEvaluation;
    shareCard: string;
    isNewBest: boolean;
  } | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const [hasActiveHint, setHasActiveHint] = useState(false);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [clearHintTrigger, setClearHintTrigger] = useState(0);
  const [lastMatchTime, setLastMatchTime] = useState<number>(() => Date.now());
  const [funRating, setFunRating] = useState<FunRating | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  const sessionRef = useRef<{
    fightId: string;
    startedAt: number;
    difficulty: FreePlayDifficulty;
    subMode: FreePlaySubMode;
  } | null>(null);
  const sprintStartRef = useRef<number>(Date.now());
  const dailyRngRef = useRef<Rng | null>(null);
  const replaceTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dailyFinishedRef = useRef(false);

  const clearPendingTimers = useCallback(() => {
    replaceTimersRef.current.forEach(clearTimeout);
    replaceTimersRef.current = [];
  }, []);

  useEffect(() => clearPendingTimers, [clearPendingTimers]);

  // [AU-20]: Gentle lounge continuation of title theme in Free Play
  useEffect(() => {
    if (typeof band?.playScreenMusic === 'function') {
      band.playScreenMusic('freeplay');
    }
    return () => {
      if (typeof band?.stop === 'function' && band.current === 'title') {
        band.stop();
      }
    };
  }, []);

  const appActive = useAppActive();
  const { spawnParticles, Particles } = useParticles();
  const totalStats = useMemo(() => calculatePlayerTotalStats(state.player), [state.player]);
  const isPlayingBoard = difficulty !== null && dailyResults === null;

  const fighter = useFighterConductor({
    health: totalStats.health,
    maxHealth: totalStats.maxHealth,
    score: state.score,
    targetScore: state.targetScore,
    isActiveRound: isPlayingBoard,
  });

  useEffect(() => {
    if (isPlayingBoard) {
      fighter.triggerEntrance();
    }
  }, [isPlayingBoard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut for hints on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !isPlayingBoard || typeof window === 'undefined') return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        if (hasActiveHint) {
          setClearHintTrigger(t => t + 1);
        } else if ((totalStats.hints ?? 0) > 0) {
          setHintTrigger(t => t + 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlayingBoard, hasActiveHint, totalStats.hints]);

  const startZenEndless = useCallback(
    (chosen: FreePlayDifficulty) => {
      clearPendingTimers();
      dailyRngRef.current = null;
      dailyFinishedRef.current = false;
      const activeAttributes: AttributeName[] = [...ATTRIBUTE_SCALING.difficultyPresets[chosen]];
      const player = initializePlayer('player1', 'Player 1', defaultCharacter);
      const stats = calculatePlayerTotalStats(player);
      const rawDeal = dealBoardAndDeck(activeAttributes, stats.fieldSize, 1);
      const { board, deck } = ensureSolvableBoard(rawDeal.board, rawDeal.deck, activeAttributes);

      setState(
        createInitialGameState({
          player,
          activeAttributes,
          board,
          deck,
          started: true,
        })
      );
      setSubMode('zen');
      setDifficulty(chosen);
      setDailyResults(null);
      setCopiedShare(false);
      setMistakes(0);
      setSessionStreak(0);
      setSessionBestStreak(0);
      setHasActiveHint(false);
      setHintTrigger(0);
      setClearHintTrigger(0);
      const now = Date.now();
      setLastMatchTime(now);
      sprintStartRef.current = now;
      setFunRating(null);
      setNotification(null);
      sessionRef.current = {
        fightId: `fp-zen-${now}`,
        startedAt: now,
        difficulty: chosen,
        subMode: 'zen',
      };
    },
    [clearPendingTimers, defaultCharacter]
  );

  const startDailyScoreAttack = useCallback(
    (dateOverride?: string) => {
      clearPendingTimers();
      dailyFinishedRef.current = false;
      const dayKey = normalizeDateKey(dateOverride ?? dailyDateKey);
      const seed = dailySeedFor('freeplay', dayKey);
      const activeAttributes: AttributeName[] = [...ATTRIBUTE_SCALING.difficultyPresets.medium];
      const player = initializePlayer('player1', 'Player 1', defaultCharacter);
      const stats = calculatePlayerTotalStats(player);
      const { board, deck, rng } = dealDeterministicFreePlayBoard(
        activeAttributes,
        stats.fieldSize,
        seed
      );
      dailyRngRef.current = rng;

      setState(
        createInitialGameState({
          player,
          activeAttributes,
          board,
          deck,
          started: true,
        })
      );
      setSubMode('daily');
      setDifficulty('medium');
      setDailySecondsLeft(FREE_PLAY_DAILY_DURATION_SEC);
      setDailyResults(null);
      setCopiedShare(false);
      setMistakes(0);
      setSessionStreak(0);
      setSessionBestStreak(0);
      setHasActiveHint(false);
      setHintTrigger(0);
      setClearHintTrigger(0);
      const now = Date.now();
      setLastMatchTime(now);
      sprintStartRef.current = now;
      setFunRating(null);
      setNotification({
        message: `Daily Meadow · ${dayKey} — 3:00 on the clock!`,
        type: 'info',
      });
      sessionRef.current = {
        fightId: `fp-daily-${dayKey}-${now}`,
        startedAt: now,
        difficulty: 'medium',
        subMode: 'daily',
      };
    },
    [clearPendingTimers, dailyDateKey, defaultCharacter]
  );

  // Deep-link launch directly into Daily 3-Min Score Attack (`?mode=freeplay&daily=YYYY-MM-DD`)
  useEffect(() => {
    if (initialSubMode === 'daily') {
      startDailyScoreAttack(dailyDateKey);
    }
    // Only auto-start on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalizeDailyRun = useCallback(() => {
    if (dailyFinishedRef.current) return;
    dailyFinishedRef.current = true;
    clearPendingTimers();

    const sets = state.foundCombinations.length;
    const elapsedSec = Math.max(1, FREE_PLAY_DAILY_DURATION_SEC - dailySecondsLeft);
    const evaluation = evaluateFreePlayDaily({
      sets,
      mistakes,
      elapsedSec,
      bestStreak: sessionBestStreak,
    });
    const { records: nextRecords, isNewBest } = FreePlayRecordsStorage.recordDailyRun({
      dateKey: dailyDateKey,
      sets: evaluation.sets,
      setsPerMin: evaluation.setsPerMin,
      mistakes: evaluation.mistakes,
      patternPower: evaluation.patternPower,
      medal: evaluation.medal,
    });
    setRecords(nextRecords);

    const shareCard = formatFreePlayDailyShareCard({
      dateKey: dailyDateKey,
      evaluation,
    });

    if (sessionRef.current) {
      trackFreePlayFight({
        fightId: sessionRef.current.fightId,
        difficulty: 'medium',
        fighter: state.player.character.name,
        weapons: state.player.weapons.map(w => w.id),
        sets,
        mistakes,
        score: evaluation.patternPower,
        durationMs: elapsedSec * 1000,
        funRating,
      });
      sessionRef.current = null;
    }

    playSound('confirm');
    setDailyResults({ evaluation, shareCard, isNewBest });
  }, [
    clearPendingTimers,
    dailyDateKey,
    dailySecondsLeft,
    funRating,
    mistakes,
    sessionBestStreak,
    state.foundCombinations.length,
    state.player.character.name,
    state.player.weapons,
  ]);

  // Battery-guarded 1s countdown clock for Daily 3-Minute Score Attack
  useEffect(() => {
    if (subMode !== 'daily' || dailyResults !== null || !appActive) return;
    const unregister = registerInterval('freeplay-daily-clock');
    const id = setInterval(() => {
      setDailySecondsLeft(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      clearInterval(id);
      unregister();
    };
  }, [subMode, dailyResults, appActive]);

  useEffect(() => {
    if (subMode === 'daily' && dailyResults === null && dailySecondsLeft <= 0) {
      finalizeDailyRun();
    }
  }, [subMode, dailyResults, dailySecondsLeft, finalizeDailyRun]);

  const handleExit = useCallback(() => {
    clearPendingTimers();
    if (sessionRef.current) {
      const sets = state.foundCombinations.length;
      if (sets + mistakes > 0 || funRating !== null) {
        trackFreePlayFight({
          fightId: sessionRef.current.fightId,
          difficulty: sessionRef.current.difficulty,
          fighter: state.player.character.name,
          weapons: state.player.weapons.map(w => w.id),
          sets,
          mistakes,
          score: state.score,
          durationMs: Math.max(0, Date.now() - sessionRef.current.startedAt),
          funRating,
        });
      }
      sessionRef.current = null;
    }
    onExit();
  }, [
    clearPendingTimers,
    funRating,
    mistakes,
    onExit,
    state.foundCombinations.length,
    state.player.character.name,
    state.player.weapons,
    state.score,
  ]);

  const returnToHub = useCallback(() => {
    clearPendingTimers();
    sessionRef.current = null;
    setDailyResults(null);
    setDifficulty(null);
    setSubMode(null);
    setNotification(null);
  }, [clearPendingTimers]);

  useAndroidBackHandler(() => {
    if (dailyResults) {
      returnToHub();
    } else if (difficulty !== null) {
      handleExit();
    } else {
      onExit();
    }
    return true;
  });

  const replaceMatchedCards = useCallback((cardsToReplace: Card[]) => {
    let dealtCount = 0;
    const activeRng = dailyRngRef.current;

    setState(prevState => {
      const remainingDeck = [...prevState.deck];
      const replaceIds = new Set(cardsToReplace.map(c => c.id));
      const remainingBoardCards = prevState.board.filter(c => !replaceIds.has(c.id));
      const newCards: Card[] = [];

      for (let i = 0; i < cardsToReplace.length; i++) {
        if (remainingDeck.length === 0) {
          const freshDeck = createDeck(prevState.activeAttributes);
          const orderedRefill = activeRng ? activeRng.shuffle(freshDeck) : freshDeck;
          for (const card of orderedRefill) {
            if (
              !remainingDeck.some(c => sameCardAttributes(c, card)) &&
              !remainingBoardCards.some(c => sameCardAttributes(c, card)) &&
              !newCards.some(c => sameCardAttributes(c, card))
            ) {
              remainingDeck.push(card);
            }
          }
        }
        if (remainingDeck.length > 0) {
          if (activeRng) {
            // Deterministic FIFO draw from pre-shuffled Daily deck
            const drawn = remainingDeck.shift()!;
            newCards.push({ ...drawn, selected: false });
          } else {
            const randomIndex = Math.floor(Math.random() * remainingDeck.length);
            newCards.push({ ...remainingDeck[randomIndex], selected: false });
            remainingDeck.splice(randomIndex, 1);
          }
        }
      }

      dealtCount = newCards.length;
      const updatedBoard = [...prevState.board];
      let nextIdx = 0;
      for (let idx = 0; idx < updatedBoard.length; idx++) {
        if (replaceIds.has(updatedBoard[idx].id) && nextIdx < newCards.length) {
          updatedBoard[idx] = newCards[nextIdx++];
        }
      }

      const ensured = ensureSolvableBoard(updatedBoard, remainingDeck, prevState.activeAttributes);
      return {
        ...prevState,
        board: ensured.board,
        deck: ensured.deck,
      };
    });

    if (dealtCount > 0) {
      playCardDealing(dealtCount, 30);
    }
  }, []);

  const handleMatchStart = useCallback(() => {
    const { width } = Dimensions.get('window');
    spawnParticles(50, { x: width / 2, y: 40 }, 'sparkle');
  }, [spawnParticles]);

  const handleValidMatch = useCallback(
    (cards: Card[], rewards: CardReward[], weaponEffects?: WeaponEffectResult) => {
      const now = Date.now();
      setLastMatchTime(now);
      const isGraceMatch = rewards.length > 0 && rewards[0].effectType === 'grace';

      let totalPoints = 0;
      let totalExperience = 0;
      let totalHints = 0;
      rewards.forEach(r => {
        totalPoints += r.points || 0;
        totalExperience += r.experience || 0;
        totalHints += r.hint || 0;
      });
      if (weaponEffects) {
        totalHints += weaponEffects.bonusHints;
        totalExperience += weaponEffects.bonusExperience;
        if (weaponEffects.bonusHints > 0) playSound('gainHint');
      }

      fighter.triggerMatch({ isGraceMatch, isMegaMatch: false, didHeal: false });

      const nextStreak = sessionStreak + 1;
      const nextSessionSets = state.foundCombinations.length + 1;
      setSessionStreak(nextStreak);
      setSessionBestStreak(prev => Math.max(prev, nextStreak));

      if (subMode === 'zen') {
        let tenSetElapsedMs: number | null = null;
        if (nextSessionSets % 10 === 0) {
          tenSetElapsedMs = Math.max(500, now - sprintStartRef.current);
          sprintStartRef.current = now;
        }
        const { records: nextRecords, newFastestTen } = FreePlayRecordsStorage.recordZenSet({
          streak: nextStreak,
          tenSetElapsedMs,
        });
        setRecords(nextRecords);

        if (ZEN_MILESTONES.has(nextSessionSets) || (nextSessionSets > 50 && nextSessionSets % 50 === 0)) {
          playSound('confirm');
          const sprintSuffix =
            tenSetElapsedMs !== null
              ? ` · 10-Set Sprint ${formatSprintTime(tenSetElapsedMs)}${newFastestTen ? ' (NEW BEST!)' : ''}`
              : '';
          setNotification({
            message: `${nextSessionSets} Sets Found!${sprintSuffix}`,
            type: 'success',
          });
        } else if (newFastestTen && tenSetElapsedMs !== null) {
          playSound('confirm');
          setNotification({
            message: `New Fastest 10-Set Sprint: ${formatSprintTime(tenSetElapsedMs)}!`,
            type: 'success',
          });
        }
      }

      setState(prevState => {
        const playerTotalStats = calculatePlayerTotalStats(prevState.player);
        const newExperience = (prevState.player.stats.experience || 0) + totalExperience;
        const newLevel = getAdjustedLevelFromXP(newExperience);
        return {
          ...prevState,
          score: prevState.score + totalPoints,
          foundCombinations: [...prevState.foundCombinations, cards],
          player: {
            ...prevState.player,
            stats: {
              ...prevState.player.stats,
              experience: newExperience,
              level: newLevel,
              hints: Math.min(prevState.player.stats.hints + totalHints, playerTotalStats.maxHints),
            },
          },
        };
      });

      const timer = setTimeout(() => {
        replaceMatchedCards(cards);
      }, subMode === 'daily' ? 450 : 1500);
      replaceTimersRef.current.push(timer);
    },
    [fighter, replaceMatchedCards, sessionStreak, state.foundCombinations.length, subMode]
  );

  const handleInvalidMatch = useCallback(
    (cardsToReplace: Card[]) => {
      setMistakes(m => m + 1);
      setSessionStreak(0);
      fighter.triggerMistake({ savedByGrace: false });
      const validation = isValidCombination(cardsToReplace, state.activeAttributes);
      const wrongAttr = validation.invalidAttributes[0];
      setNotification({
        message: wrongAttr ? `Not a Set — check ${wrongAttr}` : 'Not a valid Set',
        type: 'info',
      });
      if (cardsToReplace.length === 3) {
        replaceMatchedCards(cardsToReplace);
      }
    },
    [fighter, replaceMatchedCards, state.activeAttributes]
  );

  const handleUseHint = useCallback(() => {
    fighter.triggerHint();
    setState(prevState => ({
      ...prevState,
      player: {
        ...prevState.player,
        stats: {
          ...prevState.player.stats,
          hints: Math.max(0, prevState.player.stats.hints - 1),
        },
      },
    }));
  }, [fighter]);

  const handleCopyDailyShare = useCallback(async () => {
    if (!dailyResults) return;
    await copyToClipboard(dailyResults.shareCard);
    triggerHaptic('light');
    playSound('click');
    setCopiedShare(true);
  }, [dailyResults]);

  // ── 1. Launch Hub (1-Tap Zen DifficultySelection + Daily 3-Min Score Attack Dock) ──
  if (difficulty === null) {
    const todayEntry = records.dailyHistory[dailyDateKey];
    const hasZenStats = records.zen.totalSets > 0;

    return (
      <View style={styles.container}>
        <View style={styles.hubFlex}>
          <DifficultySelection onStart={startZenEndless} onExitGame={onExit} />
        </View>

        <View
          style={[styles.dailyDock, { paddingBottom: Math.max(12, insets.bottom + 8) }]}
          testID="freeplay-mode-dock"
        >
          {hasZenStats && (
            <View style={styles.zenBestsRow} testID="freeplay-zen-bests">
              <Text style={styles.zenBestText}>
                Zen Bests · Streak {records.zen.bestStreak} · 10-Set {formatSprintTime(records.zen.fastestTenSetMs)} · {records.zen.totalSets} Sets
              </Text>
            </View>
          )}

          <Pressable
            testID="freeplay-daily-launch"
            accessibilityRole="button"
            accessibilityLabel={`Start Daily 3-Minute Score Attack for ${dailyDateKey}`}
            onPress={() => {
              triggerHaptic('light');
              playSound('click');
              startDailyScoreAttack(dailyDateKey);
            }}
            style={({ pressed }) => [
              styles.dailyCard,
              pressed && styles.pressed,
              Platform.OS === 'web' && { cursor: 'pointer' as never },
            ]}
          >
            <View style={styles.dailyIconBox}>
              <Icon name="lorc/stopwatch" size={24} color={COLORS.deepOnyx} noShadow />
            </View>
            <View style={styles.dailyTextWrap}>
              <View style={styles.dailyTitleRow}>
                <Text style={styles.dailyTitle}>Daily 3-Min Score Attack</Text>
                <View style={styles.dailyDatePill}>
                  <Text style={styles.dailyDatePillText}>{dailyDateKey}</Text>
                </View>
              </View>
              <Text style={styles.dailySub} numberOfLines={2}>
                {todayEntry
                  ? `Today's Best: ${todayEntry.bestSets} Sets (${todayEntry.bestSetsPerMin}/min) · Streak ${records.dailyStreak}d`
                  : 'Same deterministic deck worldwide · Bronze / Silver / Gold / Starfall medals'}
              </Text>
            </View>
            <View style={styles.dailyPlayBtn}>
              <Text style={styles.dailyPlayBtnText}>3:00 ▶</Text>
            </View>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── 2. Daily 3-Minute Score Attack Results Screen ──
  if (subMode === 'daily' && dailyResults) {
    const { evaluation, shareCard, isNewBest } = dailyResults;
    return (
      <View
        style={[styles.container, { paddingTop: insets.top }]}
        testID="freeplay-daily-results"
      >
        <View style={styles.resultsTopBar}>
          <TouchableOpacity
            testID="freeplay-daily-back"
            onPress={returnToHub}
            style={styles.resultsBackBtn}
            accessibilityLabel="Back to Free Play hub"
          >
            <Icon name="ui/back-arrow" size={16} color={COLORS.canvasWhite} noShadow />
            <Text style={styles.resultsBackText}>Hub</Text>
          </TouchableOpacity>
          <Text style={styles.resultsEyebrow}>DAILY MEADOW · {dailyDateKey}</Text>
          <View style={{ width: 58 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.resultsBody,
            { paddingBottom: Math.max(24, insets.bottom + 16) },
          ]}
        >
          <View style={styles.medalHero}>
            <Text style={styles.medalEmoji}>{evaluation.medalEmoji}</Text>
            <View style={[styles.medalPill, { backgroundColor: evaluation.medalColor }]}>
              <Text style={styles.medalPillText}>
                {evaluation.medalLabel.toUpperCase()} MEDAL{isNewBest ? ' · NEW BEST!' : ''}
              </Text>
            </View>
            <Text style={styles.resultsBigSets}>
              {evaluation.sets} {evaluation.sets === 1 ? 'Set' : 'Sets'} Found
            </Text>
            <Text style={styles.resultsPace}>
              {evaluation.setsPerMin} Sets/min · {evaluation.mistakes}{' '}
              {evaluation.mistakes === 1 ? 'Mistake' : 'Mistakes'} · Best Streak {evaluation.bestStreak}
            </Text>
            {evaluation.nextMedalLabel && (
              <Text style={styles.nextMedalHint}>
                {evaluation.setsToNextMedal} more {evaluation.setsToNextMedal === 1 ? 'Set' : 'Sets'} to reach{' '}
                {evaluation.nextMedalLabel}!
              </Text>
            )}
          </View>

          {/* GSP-Style Positive Percentile Framing Card */}
          <View style={styles.powerCard} testID="freeplay-daily-power">
            <Text style={styles.powerEyebrow}>{evaluation.tierName.toUpperCase()}</Text>
            <Text style={styles.powerValue}>
              Pattern Power {evaluation.patternPower.toLocaleString('en-US')}
            </Text>
            <Text style={styles.powerPercentile}>
              Sharper than {evaluation.percentile}% of challengers
            </Text>
            <View style={styles.percentileTrack}>
              <View style={[styles.percentileFill, { width: `${evaluation.percentile}%` }]} />
            </View>
          </View>

          {/* Spoiler-Free Share Card */}
          <View style={styles.shareBox} testID="freeplay-daily-share-card">
            <Text style={styles.shareLabel}>SPOILER-FREE SHARE CARD</Text>
            <Text style={styles.sharePreview}>{shareCard}</Text>
            <TouchableOpacity
              testID="freeplay-daily-copy-share"
              onPress={handleCopyDailyShare}
              style={[styles.copyBtn, copiedShare && styles.copyBtnDone]}
              accessibilityRole="button"
              accessibilityLabel="Copy Daily Meadow share card"
            >
              <Icon
                name="lorc/scroll-unfurled"
                size={15}
                color={copiedShare ? COLORS.canvasWhite : COLORS.deepOnyx}
                noShadow
              />
              <Text style={[styles.copyBtnText, copiedShare && styles.copyBtnTextDone]}>
                {copiedShare ? 'Copied Share Card ✓' : 'Copy Share Card'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.resultsActions}>
            <TouchableOpacity
              testID="freeplay-daily-replay"
              onPress={() => startDailyScoreAttack(dailyDateKey)}
              style={styles.primaryActionBtn}
            >
              <Text style={styles.primaryActionText}>Replay Today&apos;s Seed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="freeplay-daily-to-zen"
              onPress={returnToHub}
              style={styles.secondaryActionBtn}
            >
              <Text style={styles.secondaryActionText}>Switch to Zen Endless</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="freeplay-daily-exit-menu"
              onPress={onExit}
              style={styles.ghostActionBtn}
            >
              <Text style={styles.ghostActionText}>Return to Main Menu</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── 3. Live Board (Zen Endless or Daily 3-Min Score Attack) ──
  const liveDailyEval =
    subMode === 'daily'
      ? evaluateFreePlayDaily({
          sets: state.foundCombinations.length,
          mistakes,
          elapsedSec: Math.max(1, FREE_PLAY_DAILY_DURATION_SEC - dailySecondsLeft),
          bestStreak: sessionBestStreak,
        })
      : null;

  return (
    <View nativeID="free-play-screen" style={styles.container} testID="free-play-screen">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <FreePlayHeader
        character={state.player.character}
        playerStats={totalStats}
        fighterMood={fighter.mood}
        fighterReaction={fighter.reaction}
        fighterStreak={fighter.streak}
        hasActiveHint={hasActiveHint}
        onHintPress={() => setHintTrigger(t => t + 1)}
        onClearHint={() => setClearHintTrigger(t => t + 1)}
        matchCount={state.foundCombinations.length}
        onExit={handleExit}
        funRating={funRating}
        onRateFun={setFunRating}
      />

      {subMode === 'daily' && liveDailyEval ? (
        <View style={styles.dailyHudBar} testID="freeplay-daily-hud">
          <View
            style={[
              styles.timerPill,
              dailySecondsLeft <= 30 && styles.timerPillWarn,
              dailySecondsLeft <= 10 && styles.timerPillUrgent,
            ]}
          >
            <Icon name="lorc/stopwatch" size={14} color={COLORS.canvasWhite} noShadow />
            <Text style={styles.timerText} testID="freeplay-daily-timer">
              {formatClock(dailySecondsLeft)}
            </Text>
          </View>
          <Text style={styles.hudChip}>
            {liveDailyEval.medalEmoji} {liveDailyEval.medalLabel}
          </Text>
          <Text style={styles.hudChip}>{liveDailyEval.setsPerMin}/min</Text>
          <Text style={styles.hudChip}>Daily {dailyDateKey}</Text>
          <TouchableOpacity
            testID="freeplay-daily-finish-now"
            onPress={finalizeDailyRun}
            style={styles.finishNowBtn}
            accessibilityRole="button"
            accessibilityLabel="Finish Daily Score Attack early"
          >
            <Text style={styles.finishNowText}>Finish</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.zenStrip} testID="freeplay-zen-strip">
          <Text style={styles.zenStripText}>
            ZEN · Streak {sessionStreak} (Best {records.zen.bestStreak}) · 10-Set Best{' '}
            {formatSprintTime(records.zen.fastestTenSetMs)} · Total {records.zen.totalSets}
          </Text>
        </View>
      )}

      <View style={styles.boardContainer}>
        <GameBoard
          cards={state.board}
          onMatch={handleValidMatch}
          onMatchStart={handleMatchStart}
          onInvalidSelection={handleInvalidMatch}
          playerStats={totalStats}
          weapons={state.player.weapons}
          isPlayerTurn={true}
          activeAttributes={state.activeAttributes}
          onSelectedCountChange={fighter.setSelectedCount}
          onBoardIdleChange={fighter.setIsBoardIdle}
          onHintStateChange={setHasActiveHint}
          onUseHint={handleUseHint}
          triggerHint={hintTrigger > 0 ? hintTrigger : undefined}
          triggerClearHint={clearHintTrigger > 0 ? clearHintTrigger : undefined}
          isPaused={!appActive}
          lastMatchTime={lastMatchTime}
          autoPlayer={autoPlayer}
          connections={state.connections}
        />
      </View>

      <Particles />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  hubFlex: {
    flex: 1,
  },
  dailyDock: {
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 2,
    borderTopColor: COLORS.slateCharcoal,
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
    alignItems: 'center',
  },
  zenBestsRow: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  zenBestText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    fontFamily: MONO_FONT,
  },
  dailyCard: {
    width: '100%',
    maxWidth: 540,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.module,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  dailyIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  dailyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  dailyTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: COLORS.deepOnyx,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dailyDatePill: {
    backgroundColor: COLORS.deepOnyx,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  dailyDatePillText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: COLORS.actionYellow,
    fontFamily: MONO_FONT,
  },
  dailySub: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.deepOnyx,
    opacity: 0.85,
    lineHeight: 15,
  },
  dailyPlayBtn: {
    backgroundColor: COLORS.deepOnyx,
    borderRadius: RADIUS.button,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dailyPlayBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: COLORS.actionYellow,
    fontFamily: MONO_FONT,
  },
  dailyHudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.logicTeal,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  timerPillWarn: {
    backgroundColor: '#C2410C',
  },
  timerPillUrgent: {
    backgroundColor: '#DC2626',
  },
  timerText: {
    color: COLORS.canvasWhite,
    fontSize: 12.5,
    fontWeight: '900',
    fontFamily: MONO_FONT,
  },
  hudChip: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    fontFamily: MONO_FONT,
  },
  finishNowBtn: {
    marginLeft: 'auto',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  finishNowText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
  },
  zenStrip: {
    backgroundColor: COLORS.paperBeige,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  zenStripText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    fontFamily: MONO_FONT,
  },
  boardContainer: {
    flex: 1,
  },
  resultsTopBar: {
    minHeight: 48,
    backgroundColor: COLORS.logicTeal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.slateCharcoal,
  },
  resultsBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: RADIUS.button,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultsBackText: {
    color: COLORS.canvasWhite,
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  resultsEyebrow: {
    color: COLORS.canvasWhite,
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  resultsBody: {
    padding: 16,
    gap: 14,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  medalHero: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: COLORS.slateCharcoal,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  medalEmoji: {
    fontSize: 42,
  },
  medalPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  medalPillText: {
    color: COLORS.canvasWhite,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resultsBigSets: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.deepOnyx,
  },
  resultsPace: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
  },
  nextMedalHint: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F766E',
    marginTop: 2,
  },
  powerCard: {
    backgroundColor: '#1E293B',
    borderRadius: RADIUS.module,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: COLORS.deepOnyx,
    padding: 14,
    gap: 5,
    alignItems: 'center',
  },
  powerEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: COLORS.actionYellow,
  },
  powerValue: {
    fontSize: 21,
    fontWeight: '900',
    color: COLORS.canvasWhite,
    fontFamily: MONO_FONT,
  },
  powerPercentile: {
    fontSize: 13,
    fontWeight: '800',
    color: '#99F6E4',
  },
  percentileTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    marginTop: 4,
  },
  percentileFill: {
    height: '100%',
    backgroundColor: COLORS.actionYellow,
    borderRadius: 999,
  },
  shareBox: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
    gap: 8,
  },
  shareLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: COLORS.slateCharcoal,
    opacity: 0.7,
  },
  sharePreview: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D6CFC4',
    padding: 10,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.deepOnyx,
    fontFamily: MONO_FONT,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  copyBtnDone: {
    backgroundColor: '#0F766E',
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.deepOnyx,
  },
  copyBtnTextDone: {
    color: COLORS.canvasWhite,
  },
  resultsActions: {
    gap: 8,
  },
  primaryActionBtn: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.deepOnyx,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  secondaryActionBtn: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  ghostActionBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  ghostActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    opacity: 0.78,
  },
});

export default FreePlayMode;
