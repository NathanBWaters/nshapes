/**
 * Sound effect utility for game audio feedback.
 * Provides platform-optimized audio playback with preloading.
 * Follows the haptics.ts pattern for graceful degradation.
 */

import { SettingsStorage } from './storage';

// Dynamically import expo-av to handle missing native module gracefully
let Audio: typeof import('expo-av').Audio | null = null;
type AVPlaybackSource = import('expo-av').AVPlaybackSource;

// Try to load expo-av - will fail gracefully if native module not available
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  console.warn('expo-av not available - sounds will be disabled');
}

// Sound categories for type safety
export type SoundCategory =
  | 'cardSlide'
  | 'laser'
  | 'explosion'
  | 'ricochet'
  | 'matchValid'
  | 'matchInvalid'
  | 'graceUsed'
  | 'gainHeart'
  | 'gainHint'
  | 'gainGrace'
  | 'gainMoney'
  | 'click'
  | 'confirm'
  | 'confirmExit'
  | 'gameOver';

// Sound pool for each category (allows random selection)
interface SoundPool {
  sources: AVPlaybackSource[];
  sounds: any[]; // Audio.Sound[] when Audio is available
  volume: number;
  currentIndex: number; // For alternating sounds
}

// Preloaded sound pools
const soundPools: Map<SoundCategory, SoundPool> = new Map();

// Audio enabled state (initialized from storage, can be toggled by user)
// Default to false - sound causes performance issues on iOS
let audioEnabled = false;
let audioInitialized = false;

// Initialize audio enabled state from storage
try {
  audioEnabled = SettingsStorage.getSoundEnabled();
} catch {
  // Storage not available yet, use default (off)
  audioEnabled = false;
}

// Sound definitions with require() for bundling
const SOUND_DEFINITIONS: Record<SoundCategory, { sources: AVPlaybackSource[]; volume: number }> = {
  cardSlide: {
    sources: [
      require('../../assets/sounds/cards/card-slide-1.ogg'),
      require('../../assets/sounds/cards/card-slide-2.ogg'),
      require('../../assets/sounds/cards/card-slide-3.ogg'),
      require('../../assets/sounds/cards/card-slide-4.ogg'),
      require('../../assets/sounds/cards/card-slide-5.ogg'),
      require('../../assets/sounds/cards/card-slide-6.ogg'),
      require('../../assets/sounds/cards/card-slide-7.ogg'),
      require('../../assets/sounds/cards/card-slide-8.ogg'),
    ],
    volume: 0.4,
  },
  laser: {
    sources: [
      require('../../assets/sounds/effects/laser3.ogg'),
      require('../../assets/sounds/effects/laser4.ogg'),
      require('../../assets/sounds/effects/laser5.ogg'),
    ],
    volume: 0.6,
  },
  explosion: {
    sources: [require('../../assets/sounds/effects/explosion.wav')],
    volume: 0.5,
  },
  ricochet: {
    sources: [require('../../assets/sounds/effects/ricochet.wav')],
    volume: 0.5,
  },
  matchValid: {
    sources: [
      require('../../assets/sounds/feedback/match-valid-1.ogg'),
      require('../../assets/sounds/feedback/match-valid-2.ogg'),
    ],
    volume: 0.7,
  },
  matchInvalid: {
    // Using error_006.ogg as primary; pepSound1.ogg available as match-invalid-alt.ogg
    sources: [require('../../assets/sounds/feedback/match-invalid.ogg')],
    // Alternative: sources: [require('../../assets/sounds/feedback/match-invalid-alt.ogg')],
    volume: 0.6,
  },
  graceUsed: {
    sources: [require('../../assets/sounds/feedback/grace-used.ogg')],
    volume: 0.7,
  },
  gainHeart: {
    sources: [require('../../assets/sounds/rewards/gain-heart.wav')],
    volume: 0.6,
  },
  gainHint: {
    sources: [require('../../assets/sounds/rewards/gain-hint.wav')],
    volume: 0.5,
  },
  gainGrace: {
    sources: [require('../../assets/sounds/rewards/gain-grace.wav')],
    volume: 0.5,
  },
  gainMoney: {
    sources: [require('../../assets/sounds/rewards/gain-money.wav')],
    volume: 0.4,
  },
  click: {
    // Alternates between click-1 and click-2
    sources: [
      require('../../assets/sounds/ui/click-1.ogg'),
      require('../../assets/sounds/ui/click-2.ogg'),
    ],
    volume: 0.3,
  },
  confirm: {
    sources: [require('../../assets/sounds/ui/confirm.ogg')],
    volume: 0.5,
  },
  confirmExit: {
    sources: [require('../../assets/sounds/ui/confirm-exit.ogg')],
    volume: 0.5,
  },
  gameOver: {
    sources: [require('../../assets/sounds/game/game-over.wav')],
    volume: 0.7,
  },
};

/**
 * Initialize audio mode for the app.
 * Call this once at app startup.
 */
export const initAudio = async (): Promise<void> => {
  if (audioInitialized || !Audio) return;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    audioInitialized = true;
  } catch (error) {
    console.warn('Failed to initialize audio mode:', error);
  }
};

/**
 * Preload a sound category for instant playback.
 * Call during app initialization or screen load.
 */
export const preloadSound = async (category: SoundCategory): Promise<void> => {
  if (!Audio) return; // Audio not available
  if (soundPools.has(category)) return; // Already preloaded

  const definition = SOUND_DEFINITIONS[category];
  if (!definition) return;

  try {
    const sounds: InstanceType<typeof Audio.Sound>[] = [];
    for (const source of definition.sources) {
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: false,
        volume: definition.volume,
      });
      sounds.push(sound);
    }

    soundPools.set(category, {
      sources: definition.sources,
      sounds,
      volume: definition.volume,
      currentIndex: 0,
    });
  } catch (error) {
    console.warn(`Failed to preload sound: ${category}`, error);
  }
};

/**
 * Preload multiple sound categories.
 */
export const preloadSounds = async (categories: SoundCategory[]): Promise<void> => {
  await Promise.all(categories.map(preloadSound));
};

/**
 * Preload all game sounds.
 * Call this during app initialization.
 */
export const preloadAllSounds = async (): Promise<void> => {
  const allCategories = Object.keys(SOUND_DEFINITIONS) as SoundCategory[];
  await preloadSounds(allCategories);
};

/**
 * Play a sound from a category.
 * - For categories with multiple sounds: alternates between them (click) or picks random (cardSlide, laser, matchValid)
 * - Non-blocking - fires and forgets.
 */
export const playSound = async (category: SoundCategory): Promise<void> => {
  if (!audioEnabled || !Audio) return;

  const pool = soundPools.get(category);

  if (!pool) {
    // Not preloaded - load and play on demand
    const definition = SOUND_DEFINITIONS[category];
    if (!definition) return;

    try {
      const randomIndex = Math.floor(Math.random() * definition.sources.length);
      const { sound } = await Audio.Sound.createAsync(definition.sources[randomIndex], {
        shouldPlay: true,
        volume: definition.volume,
      });
      // Clean up after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.warn(`Failed to play sound: ${category}`, error);
    }
    return;
  }

  // Play from preloaded pool
  try {
    let index: number;

    // Click sounds alternate, others pick random
    if (category === 'click') {
      index = pool.currentIndex;
      pool.currentIndex = (pool.currentIndex + 1) % pool.sounds.length;
    } else {
      index = Math.floor(Math.random() * pool.sounds.length);
    }

    const sound = pool.sounds[index];

    // Reset to beginning and play
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    console.warn(`Failed to play preloaded sound: ${category}`, error);
  }
};

/**
 * Play card dealing sounds with staggered timing.
 * @param count Number of cards being dealt
 * @param delayMs Delay between each card sound (default 50ms)
 */
export const playCardDealing = (count: number, delayMs: number = 50): void => {
  // Skip entirely if audio disabled - avoid setTimeout overhead
  if (!audioEnabled || !Audio) return;

  // Cap at reasonable number to avoid audio overload
  const maxSounds = Math.min(count, 8);
  for (let i = 0; i < maxSounds; i++) {
    setTimeout(() => playSound('cardSlide'), i * delayMs);
  }
};

/**
 * Toggle audio on/off.
 */
export const setAudioEnabled = (enabled: boolean): void => {
  audioEnabled = enabled;
};

/**
 * Check if audio is enabled.
 */
export const isAudioEnabled = (): boolean => audioEnabled;

/**
 * Unload all sounds to free memory.
 * Call when leaving game screens.
 */
export const unloadAllSounds = async (): Promise<void> => {
  for (const pool of soundPools.values()) {
    for (const sound of pool.sounds) {
      try {
        await sound.unloadAsync();
      } catch {
        // Ignore unload errors
      }
    }
  }
  soundPools.clear();
};
