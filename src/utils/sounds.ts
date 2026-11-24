/**
 * Sound effect utility for game audio feedback.
 * Routes all SFX across iOS, Android, and Web through the unified synthesizer chip
 * (`src/audio`) — zero external audio files, zero `.ogg` iOS incompatibilities.
 */

import { getIsAppActive } from './appLifecycle';
import { SettingsStorage, SoundStorage } from './storage';
import { sfx, band, audioSupported, setSfxEnabled, unlockAudio, type SfxName } from '@/audio';

const isChipReady = (): boolean =>
  typeof audioSupported === 'function' && audioSupported();

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

/** Sounds the band takes over during an Adventure fight */
const BAND_OWNED: ReadonlySet<SoundCategory> = new Set<SoundCategory>([
  'matchValid',
  'matchInvalid',
  'graceUsed',
  'explosion',
  'laser',
  'ricochet',
  'click',
]);

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

// Audio enabled state (initialized from storage, can be toggled by user)
let audioEnabled = true;

try {
  audioEnabled = SettingsStorage.getSoundEnabled();
  if (typeof setSfxEnabled === 'function') {
    setSfxEnabled(audioEnabled);
  }
} catch {
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

/**
 * A card was tapped. In an Adventure fight the first, second and third card
 * sound the root, third and fifth of the chord the music is on, so a Set
 * spells a chord. Everywhere else it is the plain click.
 */
export const playSelect = (selectedCount: number): void => {
  if (isChipReady() && band.inFight) {
    if (selectedCount > 0) band.select(selectedCount);
    else band.deselect();
    return;
  }
  if (!audioEnabled) return;
  void playSound('click');
};

/**
 * Initialize audio for the app.
 * Call once at startup; hardware audio contexts stay suspended until active/unlocked.
 */
export const initAudio = async (): Promise<void> => {
  if (!audioEnabled || !getIsAppActive() || !isChipReady()) return;
  if (typeof unlockAudio === 'function') {
    unlockAudio();
  }
};

/**
 * No-op retained for API compatibility: all sounds are synthesized procedurally
 * by `src/audio/chip.ts` with zero file preloading required.
 */
export const preloadAllSounds = async (): Promise<void> => {
  return;
};

/**
 * Play a synthesized sound from a category.
 * Non-blocking — fires and forgets.
 */
export const playSound = async (category: SoundCategory): Promise<void> => {
  if (!audioEnabled || !getIsAppActive() || !isChipReady()) return;
  // In an Adventure fight the band plays these itself, in key and on the beat (src/audio/fightAudio.ts)
  if (band.inFight && BAND_OWNED.has(category)) return;
  sfx(CHIP_SFX[category]);
};

/**
 * Play card dealing sounds with staggered timing.
 * @param count Number of cards being dealt
 * @param delayMs Delay between each card sound (default 50ms)
 */
export const playCardDealing = (count: number, delayMs: number = 50): void => {
  if (!audioEnabled || !isChipReady()) return;
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
