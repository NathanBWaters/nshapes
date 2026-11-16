import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OptionsMenu from '@/components/OptionsMenu';
import { loadAdventureSave, loadBattleHistory, recordBattle, writeAdventureSave } from '@/adventure/save';
import { createNewSave } from '@/adventure/progress';
import {
  CharacterUnlockStorage,
  CharacterWinsStorage,
  EndlessHighScoresStorage,
  LevelProgressStorage,
  SavedGameStorage,
  SettingsStorage,
  storage,
} from '@/utils/storage';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import { TUTORIAL_STORAGE_KEY } from '@/context/TutorialContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props: { name: string }) => ReactActual.createElement(View, { accessibilityLabel: `icon-${props.name}` }) };
});

describe('OptionsMenu — Reset Game & Start Over', () => {
  beforeEach(() => {
    storage.clearAll();
    jest.clearAllMocks();
  });

  const seedProgress = () => {
    writeAdventureSave({
      ...createNewSave(),
      coins: 450,
      lifetimeCoins: 900,
      coinsUnlocked: true,
      workshopUnlocked: true,
      stars: { '1-1': 3, '1-2': 2 },
      armory: ['blast-powder', 'flint-spark'],
      charms: ['blast-powder', 'flint-spark'],
      seenMechanics: ['set_rule', 'hearts'],
    });
    recordBattle([], {
      at: 1700000000000,
      levelId: '1-1',
      levelName: 'First Light',
      foe: 'Dozy Bunny',
      fighter: 'Orange Tabby',
      outcome: 'won',
      stars: 3,
      damage: 15,
      dpm: 180,
      biggestHit: 3,
      sets: 5,
      mistakes: 0,
      durationMs: 5000,
      coins: 20,
      evolutions: 0,
      weapons: [],
    });
    SavedGameStorage.save({
      characterName: 'Orange Tabby',
      playerStats: DEFAULT_PLAYER_STATS,
      weaponIds: ['blast-powder'],
      round: 4,
      adventureDifficulty: 'medium',
      defeatedEnemies: ['Junk Rat'],
      awardedStretchGoalWeapons: [],
      gamePhase: 'enemy_select',
    });
    CharacterWinsStorage.recordWin('Orange Tabby');
    EndlessHighScoresStorage.recordHighScore('Orange Tabby', 12);
    CharacterUnlockStorage.unlockCharacter('Corgi');
    LevelProgressStorage.recordCompletion(3, 'Orange Tabby');
    SettingsStorage.setSoundEnabled(false);
  };

  it('asks for confirmation first and leaves all saves untouched on CANCEL', () => {
    seedProgress();
    const onResetGame = jest.fn();
    const view = render(<OptionsMenu visible onClose={() => {}} onResetGame={onResetGame} />);

    fireEvent.press(view.getByTestId('options-reset-game'));
    expect(view.getByTestId('options-reset-confirm-box')).toBeTruthy();
    expect(loadAdventureSave().stars).toEqual({ '1-1': 3, '1-2': 2 });

    fireEvent.press(view.getByTestId('options-reset-cancel'));
    expect(view.queryByTestId('options-reset-confirm-box')).toBeNull();
    expect(onResetGame).not.toHaveBeenCalled();
    expect(loadAdventureSave().coins).toBe(450);
    expect(loadBattleHistory()).toHaveLength(1);
    expect(SavedGameStorage.hasSavedGame()).toBe(true);
  });

  it('wipes Adventure save, battle history, classic runs, unlocks and tutorial on START OVER while keeping sound preference', () => {
    seedProgress();
    const onResetGame = jest.fn();
    const view = render(<OptionsMenu visible onClose={() => {}} onResetGame={onResetGame} />);

    fireEvent.press(view.getByTestId('options-reset-game'));
    fireEvent.press(view.getByTestId('options-reset-confirm'));

    expect(onResetGame).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('options-reset-done')).toBeTruthy();

    const fresh = loadAdventureSave();
    expect(fresh).toEqual(createNewSave());
    expect(loadBattleHistory()).toEqual([]);
    expect(SavedGameStorage.hasSavedGame()).toBe(false);
    expect(CharacterWinsStorage.getWins()).toEqual({});
    expect(EndlessHighScoresStorage.getHighScores()).toEqual({});
    expect(CharacterUnlockStorage.isCharacterUnlocked('Corgi')).toBe(false);
    expect(LevelProgressStorage.getHighestUnlockedLevel()).toBe(1);
    expect(LevelProgressStorage.getAllCompletions()).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(TUTORIAL_STORAGE_KEY);
    // Sound setting is preserved
    expect(SettingsStorage.getSoundEnabled()).toBe(false);
  });
});
