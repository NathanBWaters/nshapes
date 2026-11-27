import React, { memo, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { BlinkStage } from '@/components/creatures/types';
import { SILHOUETTE_INK } from '@/components/illustration/primitives';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { CreatureHealthState } from '@/utils/creatureAnimations';
import type { FighterAmbientMood } from '@/utils/fighterAnimations';
import { CHEER, THROW, seedFromKey } from '@/utils/motion';
import type { FighterOverlayReactionType } from './FighterEffectsOverlay';

export const FIGHTER_ATLAS_COLS = 8;
export const FIGHTER_ATLAS_ROWS = 7;
export const FIGHTER_IDLE_FRAME_COUNT = 48;
const FIGHTER_ATLAS_MAX_INDEX = 53;

/**
 * Packed 8×7 Gemini Omni 1.2 Flash + Nano Banana storybook sprite atlas (`1280×1120`, `160×160` cells):
 * - Frames `0..47`: 48 temporally-coherent 20–22 fps seamless video-loop idle frames
 *   (fixed global crop window for zero foot jitter, natural mid-loop blink baked in).
 * - Frames `48..53`: 6 crisp bespoke Disney acting poses (`blink`, `windup`, `attack`, `cheer`, `hurt`, `sleepy`).
 */
export const FIGHTER_FRAME = {
  idle0: 0,
  blink: 48,
  windup: 49,
  attack: 50,
  cheer: 51,
  hurt: 52,
  sleepy: 53,
} as const;

export type FighterFrameIndex = (typeof FIGHTER_FRAME)[keyof typeof FIGHTER_FRAME];

export const FIGHTER_SPRITE_ATLASES: Readonly<Record<string, ImageSourcePropType>> = {
  'Orange Tabby': require('../../../assets/fighters/orange-tabby.webp'),
  'Sly Fox': require('../../../assets/fighters/sly-fox.webp'),
  Badger: require('../../../assets/fighters/badger.webp'),
  Corgi: require('../../../assets/fighters/corgi.webp'),
  'Emperor Penguin': require('../../../assets/fighters/emperor-penguin.webp'),
  Pelican: require('../../../assets/fighters/pelican.webp'),
};

/**
 * Species-tuned native 24fps zero-seam Omni loop lengths and durations (~20–24 fps).
 * Acting poses always live at fixed atlas indices `48..53` across every 8×7 atlas.
 */
const SPECIES_IDLE_LOOP: Readonly<Record<string, { frames: number; cycleMs: number }>> = {
  'Orange Tabby': { frames: 48, cycleMs: 2400 },     // 20.0 fps
  'Sly Fox': { frames: 38, cycleMs: 1900 },          // 20.0 fps (exact native 24fps zero-seam subcycle)
  Badger: { frames: 46, cycleMs: 1920 },             // 24.0 fps (exact native 24fps boxer weave)
  Corgi: { frames: 48, cycleMs: 2160 },              // 22.2 fps (exuberant tippy-tap bounce)
  'Emperor Penguin': { frames: 48, cycleMs: 2400 },  // 20.0 fps (0.000-MSE regal palindrome flourish)
  Pelican: { frames: 48, cycleMs: 2180 },            // 22.0 fps (two full aerodynamic wing-flap cycles)
};

export function hasFighterSpriteAtlas(characterName: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIGHTER_SPRITE_ATLASES, characterName);
}

export function getFighterSpriteAtlas(characterName: string): ImageSourcePropType | undefined {
  return FIGHTER_SPRITE_ATLASES[characterName];
}

function moodTempoFactor(mood: FighterAmbientMood): number {
  switch (mood) {
    case 'urgent':
      return 0.78;
    case 'streak':
    case 'anticipation':
    case 'victory':
      return 0.86;
    case 'curious':
      return 0.94;
    default:
      return 1;
  }
}

export interface FighterSpriteRigProps {
  characterName: string;
  size: number;
  mood: FighterAmbientMood;
  healthState: CreatureHealthState;
  activeReaction: FighterOverlayReactionType | null;
  reactionKey: number;
  cheerReleaseMs?: number;
  blinkStage: BlinkStage;
  /** Whether the 6-frame idle sprite loop should run */
  animate: boolean;
  /** Lightweight hub/map chrome mode */
  lightweight?: boolean;
  /** Keep sprite pose static when in-game Effects switch is off */
  quiet?: boolean;
  /** Solid `#121212` silhouette audit mode (`[UI-07]`) */
  silhouette?: boolean;
}

/**
 * Illustrated Nano Banana 2D Hero Fighter sprite-loop rig.
 *
 * Renders one preloaded 4×3 WebP sprite atlas per hero (0 frame-load flicker,
 * 0 per-frame React re-renders, 0 layout thrash) driven on the GPU compositor
 * thread via Reanimated `transform: translateX/translateY`, layered seamlessly
 * underneath `FighterAvatar`'s Disney-12 Reanimated kinematics, coupled ground
 * shadow, and VFX overlays.
 */
export const FighterSpriteRig: React.FC<FighterSpriteRigProps> = memo(function FighterSpriteRig({
  characterName,
  size,
  mood,
  healthState,
  activeReaction,
  reactionKey,
  cheerReleaseMs,
  blinkStage,
  animate,
  lightweight = false,
  quiet = false,
  silhouette = false,
}) {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const atlasSource = FIGHTER_SPRITE_ATLASES[characterName];

  // Two-beat discrete acting pose sequencer (e.g., throw: windup -> attack; joy: windup -> cheer)
  const [reactionFrame, setReactionFrame] = useState<FighterFrameIndex | null>(null);

  useEffect(() => {
    if (!activeReaction) {
      setReactionFrame(null);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    switch (activeReaction) {
      case 'throw': {
        if (quiet || reducedMotion) {
          setReactionFrame(FIGHTER_FRAME.attack);
        } else {
          setReactionFrame(FIGHTER_FRAME.windup);
          timer = setTimeout(() => {
            timer = null;
            setReactionFrame(FIGHTER_FRAME.attack);
          }, THROW.windMs);
        }
        break;
      }
      case 'joy': {
        if (quiet || reducedMotion) {
          setReactionFrame(FIGHTER_FRAME.cheer);
        } else {
          const releaseMs = Math.max(CHEER.windMs, cheerReleaseMs ?? CHEER.releaseMs);
          setReactionFrame(FIGHTER_FRAME.windup);
          timer = setTimeout(() => {
            timer = null;
            setReactionFrame(FIGHTER_FRAME.cheer);
          }, releaseMs);
        }
        break;
      }
      case 'ecstatic':
      case 'pet':
      case 'dizzy_joy':
      case 'powerup':
      case 'heal':
      case 'entrance': {
        setReactionFrame(FIGHTER_FRAME.cheer);
        break;
      }
      case 'pain': {
        setReactionFrame(FIGHTER_FRAME.hurt);
        break;
      }
      case 'relief': {
        setReactionFrame(FIGHTER_FRAME.blink);
        break;
      }
      case 'hint': {
        setReactionFrame(FIGHTER_FRAME.windup);
        break;
      }
      default: {
        setReactionFrame(null);
      }
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [activeReaction, reactionKey, cheerReleaseMs, quiet, reducedMotion]);

  // Resolve static/acting override frame (`-1` means run the continuous 48-frame Omni video idle loop!)
  // Natural eye blinks are baked smoothly into the 48-frame video loop, so we never interrupt
  // mid-loop with a static blink frame (avoiding body/tail pops during blinks).
  let lockedFrame: FighterFrameIndex | -1 = -1;
  if (silhouette) {
    lockedFrame = FIGHTER_FRAME.idle0;
  } else if (healthState === 'knocked_out') {
    lockedFrame = FIGHTER_FRAME.sleepy;
  } else if (reactionFrame !== null) {
    lockedFrame = reactionFrame;
  } else if (mood === 'sleepy' || mood === 'defeat') {
    lockedFrame = FIGHTER_FRAME.sleepy;
  } else if (mood === 'victory') {
    lockedFrame = FIGHTER_FRAME.cheer;
  } else if (mood === 'anticipation' && !lightweight) {
    lockedFrame = FIGHTER_FRAME.windup;
  } else if (!animate || reducedMotion || quiet) {
    lockedFrame = FIGHTER_FRAME.idle0;
  }

  // Keep `blinkStage` referenced cleanly in props contract for compatibility with FighterAvatar
  void blinkStage;

  const shouldRunIdleLoop =
    Boolean(atlasSource) &&
    lockedFrame === -1 &&
    animate &&
    appActive &&
    !reducedMotion &&
    !quiet &&
    !silhouette;

  const loopProgress = useSharedValue(0);
  const overrideFrameSV = useSharedValue<number>(lockedFrame);

  useEffect(() => {
    overrideFrameSV.value = lockedFrame;
  }, [lockedFrame, overrideFrameSV]);

  const loopSpec = SPECIES_IDLE_LOOP[characterName] ?? { frames: FIGHTER_IDLE_FRAME_COUNT, cycleMs: 2400 };
  const idleFrameCount = loopSpec.frames;
  const cycleMs = Math.max(1200, Math.round(loopSpec.cycleMs * moodTempoFactor(mood)));
  const phaseOffset = (seedFromKey(characterName) * 7) % idleFrameCount;

  useEffect(() => {
    if (!shouldRunIdleLoop) {
      cancelAnimation(loopProgress);
      loopProgress.value = 0;
      return;
    }
    loopProgress.value = 0;
    loopProgress.value = withRepeat(
      withTiming(idleFrameCount, {
        duration: cycleMs,
        easing: Easing.linear,
      }),
      -1,
      false
    );
    return () => {
      cancelAnimation(loopProgress);
    };
  }, [shouldRunIdleLoop, idleFrameCount, cycleMs, loopProgress]);

  // Integer cell pixel size prevents 0.5px subpixel bleed between neighboring atlas cells on Web
  const cellSize = Math.max(16, Math.round(size));
  const atlasWidth = cellSize * FIGHTER_ATLAS_COLS;
  const atlasHeight = cellSize * FIGHTER_ATLAS_ROWS;

  const atlasOffsetStyle = useAnimatedStyle(() => {
    'worklet';
    const override = overrideFrameSV.value;
    const raw = Math.floor(loopProgress.value);
    const step = ((raw % idleFrameCount) + idleFrameCount) % idleFrameCount;
    const idx =
      override >= 0
        ? override
        : (step + phaseOffset) % idleFrameCount;
    const clampedIdx = idx < 0 ? 0 : idx > FIGHTER_ATLAS_MAX_INDEX ? FIGHTER_ATLAS_MAX_INDEX : idx;
    const col = clampedIdx % FIGHTER_ATLAS_COLS;
    const row = Math.floor(clampedIdx / FIGHTER_ATLAS_COLS);
    return {
      transform: [
        { translateX: -col * cellSize },
        { translateY: -row * cellSize },
      ],
    };
  });

  if (!atlasSource) return null;

  const webViewportStyle =
    Platform.OS === 'web'
      ? ({ contain: 'layout style paint' } as ViewStyle)
      : undefined;
  const webLayerStyle =
    Platform.OS === 'web'
      ? ({ willChange: 'transform' } as ViewStyle)
      : undefined;
  const webSilhouetteImgStyle =
    silhouette && Platform.OS === 'web'
      ? ({ filter: 'brightness(0)' } as any)
      : undefined;

  return (
    <View
      testID={silhouette ? 'fighter-sprite-silhouette' : 'fighter-sprite-viewport'}
      pointerEvents="none"
      style={[
        styles.viewport,
        webViewportStyle,
        { width: cellSize, height: cellSize },
      ]}
    >
      <Animated.View
        style={[
          { width: atlasWidth, height: atlasHeight },
          webLayerStyle,
          atlasOffsetStyle,
        ]}
      >
        <Image
          testID="fighter-sprite-atlas"
          source={atlasSource}
          resizeMode="stretch"
          accessibilityIgnoresInvertColors
          tintColor={silhouette && Platform.OS !== 'web' ? SILHOUETTE_INK : undefined}
          style={[
            { width: atlasWidth, height: atlasHeight },
            webSilhouetteImgStyle,
          ]}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    position: 'relative',
  },
});
