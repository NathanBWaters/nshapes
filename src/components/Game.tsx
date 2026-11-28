import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import AdventureMode from '@/adventure/AdventureMode';
import SpireMode from '@/spire/components/SpireMode';
import PrismMode from '@/prism/components/PrismMode';
import { resetPrismStorage } from '@/prism/save';
import type { StarterDeckId } from '@/prism/types';
import type { CharacterName } from '@/types';
import { useTutorial } from '@/context/TutorialContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { COLORS } from '@/utils/colors';
import { MS } from '@/utils/motion';
import {
  FreePlayDifficultyStorage,
  FreePlayRecordsStorage,
  LabsStorage,
} from '@/utils/freePlayStorage';
import MainMenu from './MainMenu';
import FreePlayMode from './FreePlayMode';
import OptionsMenu from './OptionsMenu';
import { useScreenTransition, type ScreenDirection } from './ScreenTransition';

interface GameProps {
  autoPlayer?: boolean;
  /** Enables experimental Labs entries (e.g. Prism Deck on Main Menu) */
  labsEnabled?: boolean;
  /** Optional deep-link mode (`?mode=summit|adventure|freeplay|prism&seed=...&daily=YYYY-MM-DD`) */
  initialMode?: 'prism' | 'summit' | 'adventure' | 'freeplay';
  initialSeed?: string;
  initialNumericSeed?: number;
  initialDaily?: boolean;
  initialDailyDate?: string;
  initialDeckId?: StarterDeckId;
  initialLevelId?: string;
  initialFighter?: CharacterName;
  initialAscension?: number;
  initialCoopCode?: string;
  initialCoopServer?: string;
}

type AppPhase = 'main_menu' | 'adventure' | 'spire' | 'prism' | 'free_play';

const initialPhaseFor = (mode?: GameProps['initialMode']): AppPhase => {
  switch (mode) {
    case 'prism':
      return 'prism';
    case 'summit':
      return 'spire';
    case 'adventure':
      return 'adventure';
    case 'freeplay':
      return 'free_play';
    default:
      return 'main_menu';
  }
};

/**
 * Lean top-level app router between MainMenu, Adventure Mode, Starfall Summit,
 * Free Play, and Labs-gated Prism Deck.
 */
const Game: React.FC<GameProps> = ({
  autoPlayer = false,
  labsEnabled = false,
  initialMode,
  initialSeed,
  initialNumericSeed,
  initialDaily,
  initialDailyDate,
  initialDeckId,
  initialLevelId,
  initialFighter,
  initialAscension,
  initialCoopCode,
  initialCoopServer,
}) => {
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [resetRevision, setResetRevision] = useState(0);
  const [prismLaunchParams, setPrismLaunchParams] = useState<{
    seed?: string;
    daily?: boolean;
    dailyDate?: string;
    deckId?: StarterDeckId;
  } | null>(() =>
    initialMode === 'prism'
      ? { seed: initialSeed, daily: initialDaily, dailyDate: initialDailyDate, deckId: initialDeckId }
      : null
  );
  const [summitLaunchParams, setSummitLaunchParams] = useState<{
    seed?: number;
    daily?: boolean;
    dailyDate?: string;
    fighter?: CharacterName;
    ascension?: number;
    coopCode?: string;
    coopServer?: string;
  } | null>(() =>
    initialMode === 'summit' || initialCoopCode
      ? {
          seed: initialNumericSeed,
          daily: initialDaily,
          dailyDate: initialDailyDate,
          fighter: initialFighter,
          ascension: initialAscension,
          coopCode: initialCoopCode,
          coopServer: initialCoopServer,
        }
      : null
  );
  const [adventureLaunchParams, setAdventureLaunchParams] = useState<{
    levelId?: string;
    seed?: number;
  } | null>(() =>
    initialMode === 'adventure' && initialLevelId
      ? { levelId: initialLevelId, seed: initialNumericSeed }
      : null
  );
  const [freePlayLaunchParams, setFreePlayLaunchParams] = useState<{
    daily?: boolean;
    dailyDate?: string;
  } | null>(() =>
    initialMode === 'freeplay' && initialDaily
      ? { daily: true, dailyDate: initialDailyDate }
      : null
  );
  const [phase, setPhase] = useState<AppPhase>(() =>
    initialPhaseFor(initialMode ?? (initialCoopCode ? 'summit' : undefined))
  );
  // Crisp vertical route transition (0px horizontal viewport drift even under heavy CI CPU throttling)
  const transition = useScreenTransition({ enterOnMount: false, axis: 'y', durationMs: MS.quick });

  const { resetTutorial } = useTutorial();

  const goPhase = useCallback(
    (next: AppPhase, direction: ScreenDirection, beforeSwap?: () => void) => {
      transition.go(() => {
        beforeSwap?.();
        setPhase(next);
      }, direction);
    },
    [transition]
  );

  // Android hardware back button handling for Main Menu / Options modal (sub-modes own their own back stack)
  useAndroidBackHandler(
    () => {
      if (showOptionsModal) {
        setShowOptionsModal(false);
        return true;
      }
      return false;
    },
    phase === 'main_menu'
  );

  const exitToMenu = useCallback((clearParams?: () => void) => {
    goPhase('main_menu', -1, clearParams);
  }, [goPhase]);

  const handleResetGame = useCallback(() => {
    resetTutorial();
    resetPrismStorage();
    FreePlayDifficultyStorage.clear();
    FreePlayRecordsStorage.clear();
    LabsStorage.clear();
    setResetRevision(r => r + 1);
  }, [resetTutorial]);

  const renderPhase = () => {
    switch (phase) {
      case 'main_menu':
        return (
          <>
            <MainMenu
              key={`menu-${resetRevision}`}
              onSelectAdventure={() => {
                goPhase('adventure', 1, () => setAdventureLaunchParams(null));
              }}
              onSelectSpire={() => {
                goPhase('spire', 1, () => setSummitLaunchParams(null));
              }}
              onSelectPrism={() => {
                goPhase('prism', 1, () => setPrismLaunchParams(null));
              }}
              showPrismLabs={labsEnabled}
              onSelectFreeplay={() => {
                goPhase('free_play', 1, () => setFreePlayLaunchParams(null));
              }}
              onSelectOptions={() => setShowOptionsModal(true)}
            />
            <OptionsMenu
              visible={showOptionsModal}
              onClose={() => setShowOptionsModal(false)}
              onResetGame={handleResetGame}
            />
          </>
        );

      case 'adventure':
        return (
          <AdventureMode
            key={`adv-${resetRevision}-${adventureLaunchParams?.levelId ?? ''}-${adventureLaunchParams?.seed ?? ''}`}
            hostTransition
            onExit={() => {
              exitToMenu(() => setAdventureLaunchParams(null));
            }}
            onOpenSummit={() => {
              goPhase('spire', 1, () => setSummitLaunchParams(null));
            }}
            autoPlayer={autoPlayer}
            devLevelId={adventureLaunchParams?.levelId}
            devSeed={adventureLaunchParams?.seed}
          />
        );

      case 'spire':
        return (
          <SpireMode
            key={`spire-${resetRevision}-${summitLaunchParams?.seed ?? ''}-${summitLaunchParams?.daily ? '1' : '0'}-${summitLaunchParams?.coopCode ?? ''}`}
            onExit={() => {
              exitToMenu(() => setSummitLaunchParams(null));
            }}
            autoPlayer={autoPlayer}
            initialSeed={summitLaunchParams?.seed}
            initialDaily={summitLaunchParams?.daily}
            initialDailyDate={summitLaunchParams?.dailyDate}
            initialFighter={summitLaunchParams?.fighter}
            initialAscension={summitLaunchParams?.ascension}
            initialCoopCode={summitLaunchParams?.coopCode}
            initialCoopServer={summitLaunchParams?.coopServer}
          />
        );

      case 'prism':
        return (
          <PrismMode
            key={`prism-${resetRevision}-${prismLaunchParams?.seed ?? ''}-${prismLaunchParams?.daily ? '1' : '0'}`}
            onExit={() => {
              exitToMenu(() => setPrismLaunchParams(null));
            }}
            initialSeed={prismLaunchParams?.seed}
            initialDaily={prismLaunchParams?.daily}
            initialDailyDate={prismLaunchParams?.dailyDate}
            initialDeckId={prismLaunchParams?.deckId}
          />
        );

      case 'free_play':
        return (
          <FreePlayMode
            key={`freeplay-${resetRevision}-${freePlayLaunchParams?.daily ? freePlayLaunchParams.dailyDate ?? '1' : '0'}`}
            onExit={() => {
              exitToMenu(() => setFreePlayLaunchParams(null));
            }}
            autoPlayer={autoPlayer}
            initialSubMode={freePlayLaunchParams?.daily ? 'daily' : undefined}
            initialDailyDate={freePlayLaunchParams?.dailyDate}
          />
        );
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.screen, transition.style]}
        pointerEvents={transition.leaving ? 'none' : 'auto'}
      >
        {renderPhase()}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paperBeige, overflow: 'hidden' },
  screen: { flex: 1 },
});

export default Game;
