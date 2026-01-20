import { createMMKV } from 'react-native-mmkv';
import type { PlayerStats, AdventureDifficulty } from '@/types';

// Create a single MMKV instance for the app
export const storage = createMMKV({
  id: 'nshapes-storage',
});

// Storage keys
export const STORAGE_KEYS = {
  TUTORIAL_VIEWED: 'tutorial_viewed',
  CHARACTER_WINS: 'character_wins',
  ENDLESS_HIGH_SCORES: 'endless_high_scores',
  ADVENTURE_HIGH_ROUNDS: 'adventure_high_rounds',
  SOUND_ENABLED: 'sound_enabled',
  UNLOCKED_CHARACTERS: 'unlocked_characters',
  SAVED_ADVENTURE_GAME: 'saved_adventure_game',
} as const;

// Character wins type: maps character name to win count
export type CharacterWins = Record<string, number>;

// Endless high scores type: maps character name to highest round reached
export type EndlessHighScores = Record<string, number>;

// Adventure high rounds type: maps character name to furthest round reached
export type AdventureHighRounds = Record<string, number>;

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

// Adventure high rounds storage helpers
export const AdventureHighRoundStorage = {
  getHighRounds: (): AdventureHighRounds => {
    const data = storage.getString(STORAGE_KEYS.ADVENTURE_HIGH_ROUNDS);
    if (!data) return {};
    try {
      return JSON.parse(data) as AdventureHighRounds;
    } catch {
      return {};
    }
  },

  getHighRoundForCharacter: (characterName: string): number => {
    const rounds = AdventureHighRoundStorage.getHighRounds();
    return rounds[characterName] ?? 0;
  },

  recordHighRound: (characterName: string, round: number): void => {
    const rounds = AdventureHighRoundStorage.getHighRounds();
    const currentBest = rounds[characterName] ?? 0;
    if (round > currentBest) {
      rounds[characterName] = round;
      storage.set(STORAGE_KEYS.ADVENTURE_HIGH_ROUNDS, JSON.stringify(rounds));
    }
  },

  resetHighRounds: (): void => {
    storage.remove(STORAGE_KEYS.ADVENTURE_HIGH_ROUNDS);
  },
};

// Settings storage helpers
export const SettingsStorage = {
  getSoundEnabled: (): boolean => {
    // Default to false - sound causes performance issues on iOS
    return storage.getBoolean(STORAGE_KEYS.SOUND_ENABLED) ?? false;
  },

  setSoundEnabled: (enabled: boolean): void => {
    storage.set(STORAGE_KEYS.SOUND_ENABLED, enabled);
  },
};

// Character unlock constants
const DEFAULT_UNLOCKED = ['Orange Tabby', 'Sly Fox', 'Emperor Penguin'];
const LOCKED_ORDER = ['Corgi', 'Pelican', 'Badger'];

// Character unlock storage helpers
export const CharacterUnlockStorage = {
  getUnlockedCharacters: (): string[] => {
    const data = storage.getString(STORAGE_KEYS.UNLOCKED_CHARACTERS);
    if (!data) return [...DEFAULT_UNLOCKED];
    try {
      return JSON.parse(data) as string[];
    } catch {
      return [...DEFAULT_UNLOCKED];
    }
  },

  unlockCharacter: (characterName: string): void => {
    const unlocked = CharacterUnlockStorage.getUnlockedCharacters();
    if (!unlocked.includes(characterName)) {
      unlocked.push(characterName);
      storage.set(STORAGE_KEYS.UNLOCKED_CHARACTERS, JSON.stringify(unlocked));
    }
  },

  isCharacterUnlocked: (characterName: string): boolean => {
    return CharacterUnlockStorage.getUnlockedCharacters().includes(characterName);
  },

  getNextLockedCharacter: (): string | null => {
    const unlocked = CharacterUnlockStorage.getUnlockedCharacters();
    return LOCKED_ORDER.find(c => !unlocked.includes(c)) || null;
  },

  resetUnlocks: (): void => {
    storage.remove(STORAGE_KEYS.UNLOCKED_CHARACTERS);
  },
};

// Saved adventure game state - for resuming interrupted games
// Version allows for future migrations if the save format changes
const SAVED_GAME_VERSION = 1;

export interface SavedGameState {
  version: number;
  savedAt: number; // Timestamp

  // Character
  characterName: string;

  // Player stats (experience, money, level, health, graces, hints, etc.)
  playerStats: PlayerStats;

  // Weapons by ID (not full objects - enables resilience to weapon changes)
  weaponIds: string[];

  // Game progress
  round: number;
  adventureDifficulty: AdventureDifficulty;
  defeatedEnemies: string[];
  awardedStretchGoalWeapons: string[];

  // Screen to resume to
  gamePhase: string;
}

// Saved adventure game storage helpers
export const SavedGameStorage = {
  hasSavedGame: (): boolean => {
    return storage.getString(STORAGE_KEYS.SAVED_ADVENTURE_GAME) !== undefined;
  },

  save: (state: Omit<SavedGameState, 'version' | 'savedAt'>): void => {
    const saveData: SavedGameState = {
      ...state,
      version: SAVED_GAME_VERSION,
      savedAt: Date.now(),
    };
    storage.set(STORAGE_KEYS.SAVED_ADVENTURE_GAME, JSON.stringify(saveData));
  },

  load: (): SavedGameState | null => {
    const data = storage.getString(STORAGE_KEYS.SAVED_ADVENTURE_GAME);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data) as SavedGameState;
      // Version check - if format changes in future, handle migration here
      if (parsed.version !== SAVED_GAME_VERSION) {
        console.warn('Saved game version mismatch, clearing saved game');
        SavedGameStorage.clear();
        return null;
      }
      return parsed;
    } catch {
      console.warn('Failed to parse saved game, clearing');
      SavedGameStorage.clear();
      return null;
    }
  },

  clear: (): void => {
    storage.remove(STORAGE_KEYS.SAVED_ADVENTURE_GAME);
  },
};
