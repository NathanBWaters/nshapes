import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import AdventureMode from '@/adventure/AdventureMode';
import SpireMode from '@/spire/components/SpireMode';
import PrismMode from '@/prism/components/PrismMode';
import { resetPrismStorage } from '@/prism/save';
import type { StarterDeckId } from '@/prism/types';
import type { CharacterName } from '@/types';
import { useTutorial } from '@/context/TutorialContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import {
  FreePlayDifficultyStorage,
  FreePlayRecordsStorage,
  LabsStorage,
} from '@/utils/freePlayStorage';
import MainMenu from './MainMenu';
import FreePlayMode from './FreePlayMode';
import OptionsMenu from './OptionsMenu';

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
  } | null>(() =>
    initialMode === 'summit'
      ? {
          seed: initialNumericSeed,
          daily: initialDaily,
          dailyDate: initialDailyDate,
          fighter: initialFighter,
          ascension: initialAscension,
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
  const [phase, setPhase] = useState<AppPhase>(() => initialPhaseFor(initialMode));

  const { resetTutorial } = useTutorial();

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

  const exitToMenu = useCallback(() => {
    setPhase('main_menu');
  }, []);

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
                setAdventureLaunchParams(null);
                setPhase('adventure');
              }}
              onSelectSpire={() => {
                setSummitLaunchParams(null);
                setPhase('spire');
              }}
              onSelectPrism={() => {
                setPrismLaunchParams(null);
                setPhase('prism');
              }}
              showPrismLabs={labsEnabled}
              onSelectFreeplay={() => {
                setFreePlayLaunchParams(null);
                setPhase('free_play');
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
            onExit={() => {
              setAdventureLaunchParams(null);
              exitToMenu();
            }}
            onOpenSummit={() => {
              setSummitLaunchParams(null);
              setPhase('spire');
            }}
            autoPlayer={autoPlayer}
            devLevelId={adventureLaunchParams?.levelId}
            devSeed={adventureLaunchParams?.seed}
          />
        );

      case 'spire':
        return (
          <SpireMode
            key={`spire-${resetRevision}-${summitLaunchParams?.seed ?? ''}-${summitLaunchParams?.daily ? '1' : '0'}`}
            onExit={() => {
              setSummitLaunchParams(null);
              exitToMenu();
            }}
            autoPlayer={autoPlayer}
            initialSeed={summitLaunchParams?.seed}
            initialDaily={summitLaunchParams?.daily}
            initialDailyDate={summitLaunchParams?.dailyDate}
            initialFighter={summitLaunchParams?.fighter}
            initialAscension={summitLaunchParams?.ascension}
          />
        );

      case 'prism':
        return (
          <PrismMode
            key={`prism-${resetRevision}-${prismLaunchParams?.seed ?? ''}-${prismLaunchParams?.daily ? '1' : '0'}`}
            onExit={() => {
              setPrismLaunchParams(null);
              exitToMenu();
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
              setFreePlayLaunchParams(null);
              exitToMenu();
            }}
            autoPlayer={autoPlayer}
            initialSubMode={freePlayLaunchParams?.daily ? 'daily' : undefined}
            initialDailyDate={freePlayLaunchParams?.dailyDate}
          />
        );
    }
  };

  return <View className="flex-1">{renderPhase()}</View>;
};

export default Game;
