import { createMMKV } from 'react-native-mmkv';

// Create a single MMKV instance for the app
export const storage = createMMKV({
  id: 'nshapes-storage',
});

// Storage keys
export const STORAGE_KEYS = {
  TUTORIAL_VIEWED: 'tutorial_viewed',
  CHARACTER_WINS: 'character_wins',
} as const;

// Character wins type: maps character name to win count
export type CharacterWins = Record<string, number>;

// Tutorial storage helpers
export const TutorialStorage = {
  hasViewedTutorial: (): boolean => {
    return storage.getBoolean(STORAGE_KEYS.TUTORIAL_VIEWED) ?? false;
  },

  markTutorialViewed: (): void => {
    storage.set(STORAGE_KEYS.TUTORIAL_VIEWED, true);
  },

  resetTutorialViewed: (): void => {
    storage.remove(STORAGE_KEYS.TUTORIAL_VIEWED);
  },
};

// Character wins storage helpers
export const CharacterWinsStorage = {
  getWins: (): CharacterWins => {
    const data = storage.getString(STORAGE_KEYS.CHARACTER_WINS);
    if (!data) return {};
    try {
      return JSON.parse(data) as CharacterWins;
    } catch {
      return {};
    }
  },

  getWinsForCharacter: (characterName: string): number => {
    const wins = CharacterWinsStorage.getWins();
    return wins[characterName] ?? 0;
  },

  recordWin: (characterName: string): void => {
    const wins = CharacterWinsStorage.getWins();
    wins[characterName] = (wins[characterName] ?? 0) + 1;
    storage.set(STORAGE_KEYS.CHARACTER_WINS, JSON.stringify(wins));
  },

  resetWins: (): void => {
    storage.remove(STORAGE_KEYS.CHARACTER_WINS);
  },
};
