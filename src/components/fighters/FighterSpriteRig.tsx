import React, { memo, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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

export const FIGHTER_ATLAS_COLS = 4;
export const FIGHTER_ATLAS_ROWS = 3;
export const FIGHTER_IDLE_FRAME_COUNT = 6;

/**
 * Packed 4×3 Nano Banana storybook sprite atlas frame indices (`1024×768`, `256×256` cells):
 * - Row 0: `idle0`, `idle1`, `idle2`, `idle3` (6-frame seamless Disney idle cycle)
 * - Row 1: `idle4`, `idle5`, `blink`, `windup`
 * - Row 2: `attack`, `cheer`, `hurt`, `sleepy`
 */
export const FIGHTER_FRAME = {
  idle0: 0,
  idle1: 1,
  idle2: 2,
  idle3: 3,
  idle4: 4,
  idle5: 5,
  blink: 6,
  windup: 7,
  attack: 8,
  cheer: 9,
  hurt: 10,
  sleepy: 11,
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

/** Species-tuned 6-frame seamless idle cycle durations (ms) — animated on Disney 2s/3s (~6.5–9 fps). */
const SPECIES_IDLE_CYCLE_MS: Readonly<Record<string, number>> = {
  'Orange Tabby': 780,
  'Sly Fox': 840,
  Badger: 840,
  Corgi: 680,
  'Emperor Penguin': 960,
  Pelican: 720,
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

  // Resolve static/acting override frame (`-1` means run the continuous 6-frame idle loop!)
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
  } else if (blinkStage >= 2) {
    lockedFrame = FIGHTER_FRAME.blink;
  } else if (!animate || reducedMotion || quiet) {
    lockedFrame = FIGHTER_FRAME.idle0;
  }

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

  const baseCycleMs = SPECIES_IDLE_CYCLE_MS[characterName] ?? 800;
  const cycleMs = Math.max(480, Math.round(baseCycleMs * moodTempoFactor(mood)));
  const phaseOffset = seedFromKey(characterName) % FIGHTER_IDLE_FRAME_COUNT;

  useEffect(() => {
    if (!shouldRunIdleLoop) {
      cancelAnimation(loopProgress);
      loopProgress.value = 0;
      return;
    }
    const startDelay = (seedFromKey(characterName) % 5) * 28;
    loopProgress.value = 0;
    loopProgress.value = withDelay(
      startDelay,
      withRepeat(
        withTiming(FIGHTER_IDLE_FRAME_COUNT, {
          duration: cycleMs,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );
    return () => {
      cancelAnimation(loopProgress);
    };
  }, [shouldRunIdleLoop, characterName, cycleMs, loopProgress]);

  // Integer cell pixel size prevents 0.5px subpixel bleed between neighboring atlas cells on Web
  const cellSize = Math.max(16, Math.round(size));
  const atlasWidth = cellSize * FIGHTER_ATLAS_COLS;
  const atlasHeight = cellSize * FIGHTER_ATLAS_ROWS;

  const atlasOffsetStyle = useAnimatedStyle(() => {
    'worklet';
    const override = overrideFrameSV.value;
    const rawStep = Math.floor(loopProgress.value) % FIGHTER_IDLE_FRAME_COUNT;
    const idx =
      override >= 0
        ? override
        : (rawStep + phaseOffset) % FIGHTER_IDLE_FRAME_COUNT;
    const clampedIdx = idx < 0 ? 0 : idx > 11 ? 11 : idx;
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
