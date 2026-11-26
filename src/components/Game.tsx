import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import AdventureMode from '@/adventure/AdventureMode';
import SpireMode from '@/spire/components/SpireMode';
import PrismMode from '@/prism/components/PrismMode';
import { resetPrismStorage } from '@/prism/save';
import type { StarterDeckId } from '@/prism/types';
import { useTutorial } from '@/context/TutorialContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { FreePlayDifficultyStorage, LabsStorage } from '@/utils/freePlayStorage';
import MainMenu from './MainMenu';
import FreePlayMode from './FreePlayMode';
import OptionsMenu from './OptionsMenu';

interface GameProps {
  autoPlayer?: boolean;
  /** Enables experimental Labs entries (e.g. Prism Deck on Main Menu) */
  labsEnabled?: boolean;
  /** Optional deep-link mode (e.g. `?labs=1&mode=prism&seed=...`) */
  initialMode?: 'prism';
  initialSeed?: string;
  initialDaily?: boolean;
  initialDailyDate?: string;
  initialDeckId?: StarterDeckId;
}

type AppPhase = 'main_menu' | 'adventure' | 'spire' | 'prism' | 'free_play';

/**
 * Lean top-level app router between MainMenu, Adventure Mode, Starfall Summit,
 * Free Play, and Labs-gated Prism Deck.
 */
const Game: React.FC<GameProps> = ({
  autoPlayer = false,
  labsEnabled = false,
  initialMode,
  initialSeed,
  initialDaily,
  initialDailyDate,
  initialDeckId,
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
  const [phase, setPhase] = useState<AppPhase>(initialMode === 'prism' ? 'prism' : 'main_menu');

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
              onSelectAdventure={() => setPhase('adventure')}
              onSelectSpire={() => setPhase('spire')}
              onSelectPrism={() => {
                setPrismLaunchParams(null);
                setPhase('prism');
              }}
              showPrismLabs={labsEnabled}
              onSelectFreeplay={() => setPhase('free_play')}
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
            key={`adv-${resetRevision}`}
            onExit={exitToMenu}
            onOpenSummit={() => setPhase('spire')}
            autoPlayer={autoPlayer}
          />
        );

      case 'spire':
        return (
          <SpireMode
            key={`spire-${resetRevision}`}
            onExit={exitToMenu}
            autoPlayer={autoPlayer}
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
            key={`freeplay-${resetRevision}`}
            onExit={exitToMenu}
            autoPlayer={autoPlayer}
          />
        );
    }
  };

  return <View className="flex-1">{renderPhase()}</View>;
};

export default Game;
