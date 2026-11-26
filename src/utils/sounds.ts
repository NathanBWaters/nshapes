/**
 * Sound effect utility for game audio feedback.
 * Provides platform-optimized audio playback with staged non-blocking preloading.
 * Follows the haptics.ts pattern for graceful degradation.
 */

import { InteractionManager, Platform } from 'react-native';
import { getIsAppActive } from './appLifecycle';
import { SettingsStorage, SoundStorage } from './storage';
import { sfx, band, audioSupported, setSfxEnabled, type SfxName } from '@/audio';

/**
 * On the web, every sound is synthesized by the chip (src/audio) — no files
 * are downloaded. Native uses the bundled AAC-LC .m4a samples via expo-av.
 */
const useChip = Platform.OS === 'web' && typeof audioSupported === 'function' && audioSupported();

const CHIP_SFX: Record<SoundCategory, SfxName> = {
  cardSlide: 'deal',
  laser: 'laser',
  explosion: 'explosion',
  ricochet: 'ricochet',
  matchValid: 'match',
  matchInvalid: 'invalid',
  graceUsed: 'grace',
  gainHeart: 'heart',
  gainHint: 'hint',
  gainGrace: 'graceGain',
  gainMoney: 'coin',
  click: 'click',
  confirm: 'confirm',
  confirmExit: 'back',
  gameOver: 'gameOver',
};

/** Sounds the band takes over during an Adventure / Starfall Summit fight */
const BAND_OWNED: ReadonlySet<SoundCategory> = new Set<SoundCategory>([
  'matchValid',
  'matchInvalid',
  'graceUsed',
  'explosion',
  'laser',
  'ricochet',
  'click',
]);

/** Core UI & match feedback cues preloaded first after initial frame ([AU-03]). */
export const CORE_SOUND_CATEGORIES: readonly SoundCategory[] = [
  'click',
  'confirm',
  'confirmExit',
  'matchValid',
  'matchInvalid',
];

/** Max concurrent Audio.Sound.createAsync calls so cold boot never drops frames on iOS ([AU-03]). */
export const PRELOAD_MAX_CONCURRENT = 3;

/**
 * A card was tapped. In an Adventure fight the first, second and third card
 * sound the root, third and fifth of the chord the music is on, so a Set
 * spells a chord. Everywhere else it is the plain click.
 */
export const playSelect = (selectedCount: number): void => {
  // The band has its own switch (Adventure's sound button), so ask it first on both web & native
  if (band.inFight) {
    if (selectedCount > 0) band.select(selectedCount);
    else band.deselect();
    return;
  }
  if (!audioEnabled) return;
  void playSound('click');
};

// Dynamically import expo-av to handle missing native module gracefully
let Audio: typeof import('expo-av').Audio | null = null;
type AVPlaybackSource = import('expo-av').AVPlaybackSource;

// Try to load expo-av only on native (Web synthesizes audio via src/audio)
if (!useChip) {
  try {
    Audio = require('expo-av').Audio;
  } catch {
    console.warn('expo-av not available - sounds will be disabled');
  }
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

// Preloaded sound pools + in-flight dedupe
const soundPools: Map<SoundCategory, SoundPool> = new Map();
const loadingPools: Map<SoundCategory, Promise<void>> = new Map();

// Audio enabled state (initialized from storage, defaults true on both web & native [AU-03])
let audioEnabled = true;
let audioInitialized = false;

// Initialize audio enabled state from storage
try {
  audioEnabled = SettingsStorage.getSoundEnabled();
  if (typeof setSfxEnabled === 'function') {
    setSfxEnabled(audioEnabled);
  }
} catch {
  // Storage not available yet, default to enabled
  audioEnabled = true;
}

// Keep module-level SFX state synced whenever SoundStorage changes from any screen
// (Options, Prism Deck, Starfall Summit, etc.). Guarded for partial Jest mocks.
if (typeof SoundStorage?.subscribe === 'function') {
  SoundStorage.subscribe((enabled) => {
    audioEnabled = enabled;
    if (typeof setSfxEnabled === 'function') {
      setSfxEnabled(enabled);
    }
  });
}

// Sound definitions with require() for bundling — 100% iOS/Android compatible AAC-LC .m4a ([AU-01])
const SOUND_DEFINITIONS: Record<SoundCategory, { sources: AVPlaybackSource[]; volume: number }> = {
  cardSlide: {
    sources: [
      require('../../assets/sounds/cards/card-slide-1.m4a'),
      require('../../assets/sounds/cards/card-slide-2.m4a'),
      require('../../assets/sounds/cards/card-slide-3.m4a'),
      require('../../assets/sounds/cards/card-slide-4.m4a'),
      require('../../assets/sounds/cards/card-slide-5.m4a'),
      require('../../assets/sounds/cards/card-slide-6.m4a'),
      require('../../assets/sounds/cards/card-slide-7.m4a'),
      require('../../assets/sounds/cards/card-slide-8.m4a'),
    ],
    volume: 0.4,
  },
  laser: {
    sources: [
      require('../../assets/sounds/effects/laser3.m4a'),
      require('../../assets/sounds/effects/laser4.m4a'),
      require('../../assets/sounds/effects/laser5.m4a'),
    ],
    volume: 0.6,
  },
  explosion: {
    sources: [require('../../assets/sounds/effects/explosion.m4a')],
    volume: 0.5,
  },
  ricochet: {
    sources: [require('../../assets/sounds/effects/ricochet.m4a')],
    volume: 0.5,
  },
  matchValid: {
    sources: [
      require('../../assets/sounds/feedback/match-valid-1.m4a'),
      require('../../assets/sounds/feedback/match-valid-2.m4a'),
    ],
    volume: 0.7,
  },
  matchInvalid: {
    sources: [require('../../assets/sounds/feedback/match-invalid.m4a')],
    volume: 0.6,
  },
  graceUsed: {
    sources: [require('../../assets/sounds/feedback/grace-used.m4a')],
    volume: 0.7,
  },
  gainHeart: {
    sources: [require('../../assets/sounds/rewards/gain-heart.m4a')],
    volume: 0.6,
  },
  gainHint: {
    sources: [require('../../assets/sounds/rewards/gain-hint.m4a')],
    volume: 0.5,
  },
  gainGrace: {
    sources: [require('../../assets/sounds/rewards/gain-grace.m4a')],
    volume: 0.5,
  },
  gainMoney: {
    sources: [require('../../assets/sounds/rewards/gain-money.m4a')],
    volume: 0.4,
  },
  click: {
    // Alternates between click-1 and click-2
    sources: [
      require('../../assets/sounds/ui/click-1.m4a'),
      require('../../assets/sounds/ui/click-2.m4a'),
    ],
    volume: 0.3,
  },
  confirm: {
    sources: [require('../../assets/sounds/ui/confirm.m4a')],
    volume: 0.5,
  },
  confirmExit: {
    sources: [require('../../assets/sounds/ui/confirm-exit.m4a')],
    volume: 0.5,
  },
  gameOver: {
    sources: [require('../../assets/sounds/game/game-over.m4a')],
    volume: 0.7,
  },
};

/**
 * Initialize audio mode for the app.
 * Call this once at app startup.
 * Respects iOS hardware mute switch by default (`playsInSilentModeIOS: false`).
 */
export const initAudio = async (): Promise<void> => {
  if (audioInitialized || !Audio || useChip) return;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    audioInitialized = true;
  } catch (error) {
    console.warn('Failed to initialize audio mode:', error);
  }
};

/**
 * Run async tasks with a strict concurrency cap so iOS/Android main-thread
 * audio decoder setup never bursts or drops frames during cold boot.
 */
const runWithConcurrency = async <T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> => {
  const cap = Math.max(1, limit);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(cap, items.length) }, async () => {
    while (nextIndex < items.length) {
      const idx = nextIndex;
      nextIndex += 1;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
};

/**
 * Preload a sound category for instant playback (capped concurrency per clip).
 */
const preloadSound = async (category: SoundCategory): Promise<void> => {
  if (!Audio || useChip) return; // Audio not available, or synthesized instead
  if (soundPools.has(category)) return; // Already preloaded
  const existing = loadingPools.get(category);
  if (existing) return existing;

  const definition = SOUND_DEFINITIONS[category];
  if (!definition) return;

  const task = (async () => {
    try {
      const sounds: InstanceType<typeof Audio.Sound>[] = new Array(definition.sources.length);
      const indices = definition.sources.map((_, i) => i);
      await runWithConcurrency(indices, PRELOAD_MAX_CONCURRENT, async (i) => {
        const { sound } = await Audio!.Sound.createAsync(definition.sources[i], {
          shouldPlay: false,
          volume: definition.volume,
        });
        sounds[i] = sound;
      });

      soundPools.set(category, {
        sources: definition.sources,
        sounds: sounds.filter(Boolean),
        volume: definition.volume,
        currentIndex: 0,
      });
    } catch (error) {
      console.warn(`Failed to preload sound: ${category}`, error);
    } finally {
      loadingPools.delete(category);
    }
  })();

  loadingPools.set(category, task);
  return task;
};

/**
 * Preload multiple sound categories with bounded concurrency (max 3 concurrent createAsync calls).
 */
const preloadSounds = async (categories: readonly SoundCategory[]): Promise<void> => {
  if (!Audio || useChip) return;
  for (const category of categories) {
    await preloadSound(category);
  }
};

/**
 * Preload immediate core UI and match feedback sounds first ([AU-03]).
 */
export const preloadCoreSounds = async (): Promise<void> => {
  if (!Audio || useChip) return;
  await preloadSounds(CORE_SOUND_CATEGORIES);
};

/**
 * Preload non-core combat & reward sound pools quietly in the background.
 */
const preloadRemainingSounds = async (): Promise<void> => {
  if (!Audio || useChip) return;
  const coreSet = new Set<SoundCategory>(CORE_SOUND_CATEGORIES);
  const rest = (Object.keys(SOUND_DEFINITIONS) as SoundCategory[]).filter((cat) => !coreSet.has(cat));
  await preloadSounds(rest);
};

/**
 * Staged non-blocking preload of all game sounds ([AU-03]).
 * Defers until after the first interactive frame, loads core UI/match clips first,
 * then streams combat/reward pools with bounded concurrency (max 3 concurrent decodes).
 */
export const preloadAllSounds = async (): Promise<void> => {
  if (!Audio || useChip) return;
  await new Promise<void>((resolve) => {
    const start = () => {
      void preloadCoreSounds()
        .then(() => preloadRemainingSounds())
        .finally(resolve);
    };
    if (typeof InteractionManager?.runAfterInteractions === 'function') {
      InteractionManager.runAfterInteractions(start);
    } else {
      start();
    }
  });
};

/**
 * Play a sound from a category.
 * - For categories with multiple sounds: alternates between them (click) or picks random (cardSlide, laser, matchValid)
 * - Non-blocking - fires and forgets.
 */
export const playSound = async (category: SoundCategory): Promise<void> => {
  if (!audioEnabled || !getIsAppActive()) return;
  // In an Adventure / Starfall Summit fight the band plays these itself (web chip or nativeBridge)
  if (band.inFight && BAND_OWNED.has(category)) return;
  if (useChip) {
    sfx(CHIP_SFX[category]);
    return;
  }
  if (!Audio) return;

  const pool = soundPools.get(category);

  if (!pool || pool.sounds.length === 0) {
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
          void sound.unloadAsync().catch(() => undefined);
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
  if (!audioEnabled || (!Audio && !useChip)) return;

  // Cap at reasonable number to avoid audio overload
  const maxSounds = Math.min(count, 8);
  for (let i = 0; i < maxSounds; i++) {
    setTimeout(() => {
      void playSound('cardSlide');
    }, i * delayMs);
  }
};

/**
 * Toggle audio on/off.
 */
export const setAudioEnabled = (enabled: boolean): void => {
  audioEnabled = enabled;
  if (typeof setSfxEnabled === 'function') {
    setSfxEnabled(enabled);
  }
};

/**
 * Check if audio is enabled.
 */
export const isAudioEnabled = (): boolean => audioEnabled;
