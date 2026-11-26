import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainMenu from '@/components/MainMenu';
import DifficultySelection from '@/components/DifficultySelection';
import FreePlayMode from '@/components/FreePlayMode';
import PrismSetup from '@/prism/components/PrismSetup';
import FieldGuide from '@/adventure/components/FieldGuide';
import UnlockReveal from '@/adventure/components/UnlockReveal';
import AdventureMode from '@/adventure/AdventureMode';
import { ALL_ARMORY_WEAPON_IDS } from '@/adventure/data/armory';
import { SUMMIT_UNLOCK_LEVEL_ID, isSummitUnlocked } from '@/adventure/data/features';
import { LEVELS, PRACTICE_LEVELS, getLevel } from '@/adventure/data/levels';
import { applyLevelResult, createNewSave } from '@/adventure/progress';
import { writeAdventureSave } from '@/adventure/save';
import { createInitialPrismMeta } from '@/prism/save';
import { createInitialSpireMeta, resetSpireStorage, writeSpireMeta, writeSpireRun } from '@/spire/save';
import { createSpireRun } from '@/spire/engine/runState';
import { FreePlayDifficultyStorage, LabsStorage } from '@/utils/freePlayStorage';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import { SavedGameStorage, storage } from '@/utils/storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: any) => ReactActual.createElement(View, props, props?.children);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy(
    { __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, any>,
    {
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
        return target[prop];
      },
    }
  );
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : () => undefined) });
  return {
    sfx: () => undefined,
    music: band,
    band,
    setMusicEnabled: () => undefined,
    setSfxOverride: () => undefined,
  };
});

jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID, character }: { testID?: string; character: string }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `fighter-avatar-${character}` }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `enemy-avatar-${enemy?.name ?? 'foe'}` }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `weapon-avatar-${weapon?.name ?? 'weapon'}` }),
  };
});

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 667 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={SAFE_METRICS}>{ui}</SafeAreaProvider>
);

describe('Wave 1 Classic Purge, Mode Gating & Free Play 1-Tap Launch', () => {
  beforeEach(() => {
    storage.clearAll();
    resetSpireStorage();
    FreePlayDifficultyStorage.clear();
    LabsStorage.clear();
    writeAdventureSave(createNewSave());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('[OB-03] Free Play 1-tap launch & persisted difficulty', () => {
    it('defaults newcomers to easy (2 traits) and switches default to medium once 1-5 is cleared', () => {
      expect(FreePlayDifficultyStorage.get()).toBeNull();
      expect(FreePlayDifficultyStorage.getDefault({})).toBe('easy');
      expect(FreePlayDifficultyStorage.getDefault({ '1-1': 3, '1-4': 3 })).toBe('easy');
      expect(FreePlayDifficultyStorage.getDefault({ '1-5': 1 })).toBe('medium');

      FreePlayDifficultyStorage.set('hard');
      expect(FreePlayDifficultyStorage.get()).toBe('hard');
      expect(FreePlayDifficultyStorage.getDefault({})).toBe('hard');
    });

    it('launches immediately on 1 tap, remembers LAST PLAYED, shows rule reminder & back arrow', () => {
      const onStart = jest.fn();
      const first = render(wrap(<DifficultySelection onStart={onStart} onExitGame={() => {}} />));
      expect(first.getByTestId('freeplay-badge-easy')).toHaveTextContent('RECOMMENDED');
      expect(first.getByTestId('freeplay-rule-reminder')).toHaveTextContent(
        'Find 3 cards where each trait is all the same or all different. No clock, no hearts.'
      );
      expect(first.getAllByLabelText('icon-ui/back-arrow').length).toBeGreaterThanOrEqual(1);
      expect(first.queryByText('Start Free Play')).toBeNull();

      fireEvent.press(first.getByTestId('freeplay-difficulty-hard'));
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onStart).toHaveBeenCalledWith('hard');
      expect(FreePlayDifficultyStorage.get()).toBe('hard');
      first.unmount();

      const second = render(wrap(<DifficultySelection onStart={onStart} onExitGame={() => {}} />));
      expect(second.getByTestId('freeplay-badge-hard')).toHaveTextContent('LAST PLAYED');
    });

    it('FreePlayMode enters live board in 1 tap from DifficultySelection and exits cleanly', () => {
      const onExit = jest.fn();
      const view = render(wrap(<FreePlayMode onExit={onExit} />));
      expect(view.getByTestId('difficulty-selection')).toBeTruthy();
      fireEvent.press(view.getByTestId('freeplay-difficulty-easy'));
      expect(view.getByTestId('free-play-screen')).toBeTruthy();
      fireEvent.press(view.getByText('Exit'));
      expect(onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe('[TP-01] Starfall Summit campaign milestone gate & UnlockReveal', () => {
    it('gates Starfall Summit behind 1-10 while grandfathering existing Summit players & active climbs', () => {
      expect(SUMMIT_UNLOCK_LEVEL_ID).toBe('1-10');
      expect(isSummitUnlocked({ stars: {} }, { totalRuns: 0 }, false)).toBe(false);
      expect(isSummitUnlocked({ stars: { '1-9': 3 } }, { totalRuns: 0 }, false)).toBe(false);
      expect(isSummitUnlocked({ stars: { '1-10': 1 } }, { totalRuns: 0 }, false)).toBe(true);
      expect(isSummitUnlocked({ stars: {} }, { totalRuns: 1 }, false)).toBe(true);
      expect(isSummitUnlocked({ stars: {} }, { totalRuns: 0 }, true)).toBe(true);
    });

    it('renders Starfall Summit as a locked teaser on fresh MainMenu and unlocks on 1-10 clear or grandfathering', () => {
      const onSelectSpire = jest.fn();
      const fresh = render(
        wrap(
          <MainMenu
            onSelectAdventure={() => {}}
            onSelectSpire={onSelectSpire}
            onSelectFreeplay={() => {}}
            onSelectOptions={() => {}}
          />
        )
      );
      const lockedBtn = fresh.getByTestId('menu-spire');
      expect(lockedBtn.props.accessibilityState?.disabled).toBe(true);
      expect(fresh.getByText(/Unlocks after 1-10/)).toBeTruthy();
      fireEvent.press(lockedBtn);
      expect(onSelectSpire).not.toHaveBeenCalled();
      fresh.unmount();

      // Clearing 1-10 unlocks Starfall Summit
      writeAdventureSave({ ...createNewSave(), stars: { '1-10': 1 } });
      const unlocked = render(
        wrap(
          <MainMenu
            onSelectAdventure={() => {}}
            onSelectSpire={onSelectSpire}
            onSelectFreeplay={() => {}}
            onSelectOptions={() => {}}
          />
        )
      );
      expect(unlocked.getByTestId('menu-spire').props.accessibilityState?.disabled).toBe(false);
      fireEvent.press(unlocked.getByTestId('menu-spire'));
      expect(onSelectSpire).toHaveBeenCalledTimes(1);
      unlocked.unmount();

      // Existing Summit players are grandfathered even on a 0-star Adventure save
      writeAdventureSave(createNewSave());
      writeSpireMeta({ ...createInitialSpireMeta(), totalRuns: 2 });
      const grandfathered = render(
        wrap(
          <MainMenu
            onSelectAdventure={() => {}}
            onSelectSpire={onSelectSpire}
            onSelectFreeplay={() => {}}
            onSelectOptions={() => {}}
          />
        )
      );
      expect(grandfathered.getByTestId('menu-spire').props.accessibilityState?.disabled).toBe(false);
      grandfathered.unmount();

      // Active saved climb is also grandfathered
      resetSpireStorage();
      writeSpireRun(createSpireRun('Orange Tabby', 0, 101));
      const activeRunMenu = render(
        wrap(
          <MainMenu
            onSelectAdventure={() => {}}
            onSelectSpire={onSelectSpire}
            onSelectFreeplay={() => {}}
            onSelectOptions={() => {}}
          />
        )
      );
      expect(activeRunMenu.getByTestId('menu-spire').props.accessibilityState?.disabled).toBe(false);
    });

    it('emits a celebratory Starfall Summit UnlockReveal on first 1-10 clear', () => {
      jest.useFakeTimers();
      const boss = getLevel('1-10');
      const res = applyLevelResult(createNewSave(), boss, 1, 0);
      expect(res.unlocks.some(u => u.kind === 'summit')).toBe(true);

      // Replaying 1-10 does not re-emit the Summit unlock
      const replay = applyLevelResult(res.save, boss, 2, 0);
      expect(replay.unlocks.some(u => u.kind === 'summit')).toBe(false);

      const onOpenSummit = jest.fn();
      const onDone = jest.fn();
      const view = render(
        wrap(
          <UnlockReveal
            unlocks={[{ kind: 'summit', star: 1 }]}
            save={res.save}
            onUseFighter={() => {}}
            onEquipCharm={() => {}}
            onOpenSummit={onOpenSummit}
            onDone={onDone}
          />
        )
      );
      expect(view.getByText('Starfall Summit Unlocked!')).toBeTruthy();
      fireEvent.press(view.getByTestId('unlock-reveal'));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(view.getByText('Starfall Summit Unlocked — climb where the star fell!')).toBeTruthy();
      fireEvent.press(view.getByTestId('unlock-primary'));
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onOpenSummit).toHaveBeenCalledTimes(1);
    });
  });

  describe('[TP-02] Prism Deck Labs gating & __DEV__ gate on Lab: Unlock All', () => {
    it('hides Prism Deck off default Day-1 MainMenu and reveals it only when Labs is enabled', () => {
      const def = render(
        wrap(
          <MainMenu
            onSelectAdventure={() => {}}
            onSelectSpire={() => {}}
            onSelectPrism={() => {}}
            onSelectFreeplay={() => {}}
            onSelectOptions={() => {}}
          />
        )
      );
      expect(def.queryByTestId('menu-prism')).toBeNull();
      def.unmount();

      const withProp = render(
        wrap(
          <MainMenu
            onSelectAdventure={() => {}}
            onSelectSpire={() => {}}
            onSelectPrism={() => {}}
            showPrismLabs
            onSelectFreeplay={() => {}}
            onSelectOptions={() => {}}
          />
        )
      );
      expect(withProp.getByTestId('menu-prism')).toBeTruthy();
      withProp.unmount();

      LabsStorage.set(true);
      const withStorage = render(
        wrap(
          <MainMenu
            onSelectAdventure={() => {}}
            onSelectSpire={() => {}}
            onSelectPrism={() => {}}
            onSelectFreeplay={() => {}}
            onSelectOptions={() => {}}
          />
        )
      );
      expect(withStorage.getByTestId('menu-prism')).toBeTruthy();
    });

    it('gates Lab: Unlock All strictly behind __DEV__ in PrismSetup', () => {
      const g = globalThis as unknown as { __DEV__: boolean };
      const origDev = g.__DEV__;
      const baseProps = {
        meta: createInitialPrismMeta(),
        activeRun: null,
        onStartStandard: () => {},
        onStartDaily: () => {},
        onResumeRun: () => {},
        onAbandonRun: () => {},
        onOpenTutorial: () => {},
        onBackupRestored: () => {},
        onExit: () => {},
      };

      try {
        g.__DEV__ = false;
        const prodView = render(wrap(<PrismSetup {...baseProps} />));
        expect(prodView.queryByTestId('prism-unlock-all')).toBeNull();
        expect(prodView.getByTestId('prism-deck-alchemist_grimoire').props.accessibilityState?.disabled).toBe(true);
        prodView.unmount();

        g.__DEV__ = true;
        const devView = render(wrap(<PrismSetup {...baseProps} />));
        expect(devView.getByTestId('prism-unlock-all')).toBeTruthy();
        fireEvent.press(devView.getByTestId('prism-unlock-all'));
        expect(devView.getByTestId('prism-deck-alchemist_grimoire').props.accessibilityState?.disabled).toBe(false);
      } finally {
        g.__DEV__ = origDev;
      }
    });
  });

  describe('[TP-04] & [TP-05] Classic UI purge, Replay 1-1 Walkthrough & content preservation', () => {
    it('never renders legacy Classic Tutorial or Resume Game buttons on MainMenu', () => {
      // Even if a legacy Classic save exists in storage, MainMenu never shows Classic Resume Game
      SavedGameStorage.save({
        characterName: 'Orange Tabby',
        playerStats: DEFAULT_PLAYER_STATS,
        weaponIds: [],
        round: 3,
        adventureDifficulty: 'medium',
        defeatedEnemies: [],
        awardedStretchGoalWeapons: [],
        gamePhase: 'enemy_select',
      });

      const menu = render(
        wrap(
          <MainMenu
            onSelectAdventure={() => {}}
            onSelectSpire={() => {}}
            onSelectFreeplay={() => {}}
            onSelectOptions={() => {}}
          />
        )
      );
      expect(menu.queryByTestId('menu-tutorial')).toBeNull();
      expect(menu.queryByTestId('menu-resume')).toBeNull();
      expect(menu.getByTestId('menu-options')).toBeTruthy();
    });

    it('offers Replay 1-1 Walkthrough in FieldGuide and launches 1-1 inside AdventureMode', () => {
      const onReplay = jest.fn();
      const guide = render(
        wrap(<FieldGuide save={createNewSave()} onClose={() => {}} onReplayWalkthrough={onReplay} />)
      );
      expect(guide.getByTestId('guide-replay-walkthrough')).toBeTruthy();
      expect(guide.getByText('Replay 1-1 Walkthrough')).toBeTruthy();
      fireEvent.press(guide.getByTestId('guide-replay-walkthrough'));
      expect(onReplay).toHaveBeenCalledTimes(1);
      guide.unmount();

      // End-to-end inside AdventureMode: Map -> Guide -> Replay 1-1 Walkthrough -> live 1-1 run
      const save = { ...createNewSave(), stars: { '1-1': 3 }, plays: { '1-1': 1 } };
      const adv = render(wrap(<AdventureMode initialSave={save} coldOpen={false} onExit={() => {}} />));
      fireEvent.press(adv.getByTestId('map-dock-guide'));
      fireEvent.press(adv.getByTestId('guide-replay-walkthrough'));
      expect(adv.getByTestId('run-stage')).toBeTruthy();
    });

    it('preserves all 59 campaign levels (+ practice) and all 64 Armory weapons while purging dead Classic files', () => {
      expect(LEVELS).toHaveLength(59);
      expect(PRACTICE_LEVELS.length).toBeGreaterThanOrEqual(1);
      expect(ALL_ARMORY_WEAPON_IDS).toHaveLength(64);

      const repoRoot = path.resolve(__dirname, '..');
      const deletedPaths = [
        'src/components/EnemySelection.tsx',
        'src/components/WeaponShop.tsx',
        'src/components/LevelUp.tsx',
        'src/components/LevelUpModal.tsx',
        'src/components/RoundSummary.tsx',
        'src/components/VictoryScreen.tsx',
        'src/components/GameOverScreen.tsx',
        'src/components/CharacterUnlockScreen.tsx',
        'src/components/WeaponGuide.tsx',
        'src/components/WeaponList.tsx',
        'src/components/WeaponPicker.tsx',
        'src/components/InventoryBar.tsx',
        'src/components/GameInfo.tsx',
        'src/components/GameMenu.tsx',
        'src/components/TutorialScreen.tsx',
        'src/components/TutorialPractice.tsx',
        'src/components/TutorialQuiz.tsx',
        'src/components/TutorialUITour.tsx',
        'src/components/RoundProgressChart.tsx',
        'src/components/CircularTimer.tsx',
        'src/components/KeywordText.tsx',
        'app/dev/play.tsx',
        'app/dev/store.tsx',
        'app/dev/victory.tsx',
        'specs/weapons-design.md',
        'specs/weapons-todo.md',
        'specs/enemy-design.md',
        'specs/enemy-implementation.md',
        'specs/enemies-tasks.md',
      ];
      for (const rel of deletedPaths) {
        expect(fs.existsSync(path.join(repoRoot, rel))).toBe(false);
      }
    });
  });
});
