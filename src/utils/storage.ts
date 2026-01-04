import { createMMKV } from 'react-native-mmkv';

// Create a single MMKV instance for the app
export const storage = createMMKV({
  id: 'nshapes-storage',
});

// Storage keys
export const STORAGE_KEYS = {
  TUTORIAL_VIEWED: 'tutorial_viewed',
  CHARACTER_WINS: 'character_wins',
  ENDLESS_HIGH_SCORES: 'endless_high_scores',
} as const;

// Character wins type: maps character name to win count
export type CharacterWins = Record<string, number>;

// Endless high scores type: maps character name to highest round reached
export type EndlessHighScores = Record<string, number>;

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

// Endless high scores storage helpers
export const EndlessHighScoresStorage = {
  getHighScores: (): EndlessHighScores => {
    const data = storage.getString(STORAGE_KEYS.ENDLESS_HIGH_SCORES);
    if (!data) return {};
    try {
      return JSON.parse(data) as EndlessHighScores;
    } catch {
      return {};
    }
  },

  getHighScoreForCharacter: (characterName: string): number => {
    const scores = EndlessHighScoresStorage.getHighScores();
    return scores[characterName] ?? 0;
  },

  recordHighScore: (characterName: string, round: number): void => {
    const scores = EndlessHighScoresStorage.getHighScores();
    const currentBest = scores[characterName] ?? 0;
    if (round > currentBest) {
      scores[characterName] = round;
      storage.set(STORAGE_KEYS.ENDLESS_HIGH_SCORES, JSON.stringify(scores));
    }
  },

  resetHighScores: (): void => {
    storage.remove(STORAGE_KEYS.ENDLESS_HIGH_SCORES);
  },
};
