import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Character } from '@/types';
import { COLORS } from '@/utils/colors';
import { useReducedMotion } from '@/utils/animation';
import {
  FighterAmbientMood,
  FighterReactionEvent,
  FighterReactionType,
  getFighterHealthState,
  getFighterPersonality,
  resolveFighterExpression,
} from '@/utils/fighterAnimations';
import {
  BadgerRig,
  CREATURE_PIVOTS,
  CorgiRig,
  DEFAULT_CREATURE_PIVOTS,
  EmperorPenguinRig,
  FallbackFighterRig,
  OrangeTabbyRig,
  PelicanRig,
  SlyFoxRig,
} from './creatures';
import { FighterDamageOverlay } from './FighterDamageOverlay';
import { FighterEffectsOverlay } from './FighterEffectsOverlay';

export interface FighterAvatarProps {
  /** Character object or character name (defaults to 'Orange Tabby') */
  character?: Character | string | null;
  /** Pixel width & height of the avatar (default 56) */
  size?: number;
  /** Current fighter HP (defaults to maxHealth = pristine) */
  health?: number;
  /** Max fighter HP (defaults to 3) */
  maxHealth?: number;
  /** Continuous ambient mood */
  mood?: FighterAmbientMood;
  /** Discrete one-shot reaction event ({ type, id }) */
  reaction?: FighterReactionEvent | null;
  /** Current consecutive match streak (shows subtle badge/glow when >= 3 and framed) */
  streak?: number;
  /** Whether continuous idle/reaction animations run (default true) */
  animate?: boolean;
  /** Whether tapping the fighter pets them (blush + heart, 5x = zoomie spin!) */
  interactive?: boolean;
  /** Optional callback when the player pets the fighter */
  onPet?: (reactionType: 'pet' | 'dizzy_joy') => void;
  /** Render inside a tactile NShapes portrait frame badge (ideal for HUD & headers) */
  framed?: boolean;
  /** Optional container style */
  style?: StyleProp<ViewStyle>;
  /** Optional testID */
  testID?: string;
}

const PET_STREAK_WINDOW_MS = 2400;
const PET_ZOOMIE_THRESHOLD = 5;

export const FighterAvatar: React.FC<FighterAvatarProps> = ({
  character,
  size = 56,
  health,
  maxHealth = 3,
  mood = 'idle',
  reaction = null,
  streak = 0,
  animate = true,
  interactive = false,
  onPet,
  framed = false,
  style,
  testID,
}) => {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;

  const characterName =
    typeof character === 'string'
      ? character
      : character?.name ?? 'Orange Tabby';
  const characterIcon = typeof character === 'object' && character ? character.icon : undefined;

  const personality = useMemo(() => getFighterPersonality(characterName), [characterName]);
  const pivots = CREATURE_PIVOTS[characterName] ?? DEFAULT_CREATURE_PIVOTS;
  const healthState = useMemo(
    () => getFighterHealthState(health, maxHealth),
    [health, maxHealth]
  );

  // Active reaction state (combines external `reaction` prop + local tap-to-pet reactions)
  const [activeReaction, setActiveReaction] = useState<FighterReactionType | null>(
    reaction?.type ?? null
  );
  const [activeReactionKey, setActiveReactionKey] = useState<number>(reaction?.id ?? 0);
  const [isBlinking, setIsBlinking] = useState(false);

  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const petTimestampsRef = useRef<number[]>([]);
  const localIdCounterRef = useRef<number>(100000);

  // Shared values for whole-body + articulated joint choreography
  const breath = useSharedValue(0); // -1 .. +1
  const wag = useSharedValue(0); // -1 .. +1
  const sway = useSharedValue(0); // -1 .. +1
  const earTwitch = useSharedValue(0); // 0 .. 1

  const bodyTx = useSharedValue(0);
  const bodyTy = useSharedValue(0);
  const bodyScaleX = useSharedValue(1);
  const bodyScaleY = useSharedValue(1);
  const bodyRotate = useSharedValue(0);

  const headRotate = useSharedValue(0);
  const headTy = useSharedValue(0);
  const leftEarExtra = useSharedValue(0);
  const rightEarExtra = useSharedValue(0);
  const pawBounce = useSharedValue(0);

  // Trigger choreography for a discrete reaction
  const playReactionChoreography = useCallback(
    (type: FighterReactionType, id: number) => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
      setActiveReaction(type);
      setActiveReactionKey(id);

      const holdMs = personality.reactionHoldMs[type] ?? 850;
      reactionTimerRef.current = setTimeout(() => {
        setActiveReaction(null);
      }, holdMs);

      if (!shouldAnimate) {
        return;
      }

      const jumpPx = Math.max(6, size * 0.22);
      const recoilPx = Math.max(4, size * 0.14);

      // Reset transient channels before firing new reaction
      cancelAnimation(bodyTx);
      cancelAnimation(bodyTy);
      cancelAnimation(bodyScaleX);
      cancelAnimation(bodyScaleY);
      cancelAnimation(bodyRotate);

      switch (type) {
        case 'joy': {
          // Squash -> spring leap -> happy wiggle!
          bodyScaleX.value = withSequence(
            withTiming(1.16, { duration: 85 }),
            withTiming(0.9, { duration: 150 }),
            withSpring(1, { damping: 9, stiffness: 210 })
          );
          bodyScaleY.value = withSequence(
            withTiming(0.84, { duration: 85 }),
            withTiming(1.14, { duration: 150 }),
            withSpring(1, { damping: 9, stiffness: 210 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.05, { duration: 85 }),
            withTiming(-jumpPx, { duration: 180, easing: Easing.out(Easing.quad) }),
            withSpring(0, { damping: 8, stiffness: 190 })
          );
          bodyRotate.value = withSequence(
            withTiming(-9, { duration: 140 }),
            withTiming(9, { duration: 160 }),
            withSpring(0, { damping: 10, stiffness: 200 })
          );
          leftEarExtra.value = withSequence(
            withTiming(-18, { duration: 150 }),
            withSpring(0, { damping: 8, stiffness: 180 })
          );
          rightEarExtra.value = withSequence(
            withTiming(18, { duration: 150 }),
            withSpring(0, { damping: 8, stiffness: 180 })
          );
          pawBounce.value = withSequence(
            withTiming(-size * 0.08, { duration: 180 }),
            withSpring(0, { damping: 8, stiffness: 180 })
          );
          break;
        }

        case 'ecstatic':
        case 'dizzy_joy': {
          // Big crouch -> soaring leap + full celebratory 360 spin!
          bodyScaleX.value = withSequence(
            withTiming(1.2, { duration: 90 }),
            withTiming(0.88, { duration: 160 }),
            withSpring(1, { damping: 8, stiffness: 200 })
          );
          bodyScaleY.value = withSequence(
            withTiming(0.8, { duration: 90 }),
            withTiming(1.18, { duration: 160 }),
            withSpring(1, { damping: 8, stiffness: 200 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.06, { duration: 90 }),
            withTiming(-jumpPx * 1.3, { duration: 230, easing: Easing.out(Easing.cubic) }),
            withSpring(0, { damping: 7, stiffness: 180 })
          );
          bodyRotate.value = withSequence(
            withTiming(360, { duration: 620, easing: Easing.out(Easing.back(1.2)) }),
            withTiming(0, { duration: 1 })
          );
          break;
        }

        case 'pain': {
          // Sharp horizontal impact recoil + wince flatten + pinned-back ears!
          bodyTx.value = withSequence(
            withTiming(-recoilPx, { duration: 55 }),
            withTiming(recoilPx, { duration: 65 }),
            withTiming(-recoilPx * 0.75, { duration: 65 }),
            withTiming(recoilPx * 0.75, { duration: 65 }),
            withTiming(-recoilPx * 0.35, { duration: 60 }),
            withTiming(0, { duration: 70 })
          );
          bodyScaleX.value = withSequence(
            withTiming(1.18, { duration: 80 }),
            withSpring(1, { damping: 9, stiffness: 220 })
          );
          bodyScaleY.value = withSequence(
            withTiming(0.82, { duration: 80 }),
            withSpring(1, { damping: 9, stiffness: 220 })
          );
          bodyRotate.value = withSequence(
            withTiming(-11, { duration: 80 }),
            withTiming(8, { duration: 100 }),
            withSpring(0, { damping: 10, stiffness: 200 })
          );
          leftEarExtra.value = withSequence(
            withTiming(16, { duration: 90 }),
            withSpring(0, { damping: 10, stiffness: 160 })
          );
          rightEarExtra.value = withSequence(
            withTiming(-16, { duration: 90 }),
            withSpring(0, { damping: 10, stiffness: 160 })
          );
          break;
        }

        case 'relief': {
          // Startled mini-duck -> relieved upward sigh & 'Phew!' head tilt!
          bodyScaleY.value = withSequence(
            withTiming(0.88, { duration: 95 }),
            withTiming(1.07, { duration: 240 }),
            withTiming(1, { duration: 260 })
          );
          bodyScaleX.value = withSequence(
            withTiming(1.1, { duration: 95 }),
            withTiming(0.96, { duration: 240 }),
            withTiming(1, { duration: 260 })
          );
          headRotate.value = withSequence(
            withTiming(11, { duration: 220 }),
            withTiming(11, { duration: 350 }),
            withSpring(0, { damping: 10, stiffness: 170 })
          );
          break;
        }

        case 'heal': {
          // Warm buoyant float + gentle sway
          bodyTy.value = withSequence(
            withTiming(-jumpPx * 0.75, { duration: 340, easing: Easing.out(Easing.sin) }),
            withTiming(0, { duration: 420, easing: Easing.inOut(Easing.sin) })
          );
          bodyScaleX.value = withSequence(
            withTiming(1.07, { duration: 320 }),
            withTiming(1, { duration: 380 })
          );
          bodyScaleY.value = withSequence(
            withTiming(1.07, { duration: 320 }),
            withTiming(1, { duration: 380 })
          );
          break;
        }

        case 'powerup': {
          // Charge crouch -> heroic upward surge!
          bodyScaleX.value = withSequence(
            withTiming(1.14, { duration: 110 }),
            withTiming(1.16, { duration: 220 }),
            withSpring(1, { damping: 8, stiffness: 200 })
          );
          bodyScaleY.value = withSequence(
            withTiming(0.86, { duration: 110 }),
            withTiming(1.18, { duration: 220 }),
            withSpring(1, { damping: 8, stiffness: 200 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.04, { duration: 110 }),
            withTiming(-jumpPx * 0.85, { duration: 220 }),
            withSpring(0, { damping: 9, stiffness: 190 })
          );
          break;
        }

        case 'hint': {
          // Curious head-cock + single radar ear perk!
          headRotate.value = withSequence(
            withTiming(14, { duration: 160, easing: Easing.out(Easing.back(1.5)) }),
            withTiming(14, { duration: 380 }),
            withSpring(0, { damping: 10, stiffness: 180 })
          );
          leftEarExtra.value = withSequence(
            withTiming(-18, { duration: 150 }),
            withTiming(-18, { duration: 380 }),
            withSpring(0, { damping: 9, stiffness: 180 })
          );
          break;
        }

        case 'pet': {
          // Happy cozy squish + affectionate nuzzle wiggle!
          bodyScaleX.value = withSequence(
            withTiming(1.16, { duration: 100 }),
            withTiming(0.95, { duration: 140 }),
            withSpring(1, { damping: 8, stiffness: 200 })
          );
          bodyScaleY.value = withSequence(
            withTiming(0.85, { duration: 100 }),
            withTiming(1.08, { duration: 140 }),
            withSpring(1, { damping: 8, stiffness: 200 })
          );
          headRotate.value = withSequence(
            withTiming(-9, { duration: 130 }),
            withTiming(9, { duration: 150 }),
            withSpring(0, { damping: 9, stiffness: 180 })
          );
          break;
        }

        case 'entrance': {
          // Peppy battle-ready hop!
          bodyScaleX.value = withSequence(
            withTiming(0.9, { duration: 80 }),
            withSpring(1, { damping: 8, stiffness: 220 })
          );
          bodyScaleY.value = withSequence(
            withTiming(1.12, { duration: 120 }),
            withSpring(1, { damping: 8, stiffness: 220 })
          );
          bodyTy.value = withSequence(
            withTiming(-jumpPx * 0.65, { duration: 150 }),
            withSpring(0, { damping: 8, stiffness: 200 })
          );
          leftEarExtra.value = withSequence(
            withTiming(-14, { duration: 140 }),
            withSpring(0, { damping: 9, stiffness: 190 })
          );
          rightEarExtra.value = withSequence(
            withTiming(14, { duration: 140 }),
            withSpring(0, { damping: 9, stiffness: 190 })
          );
          break;
        }
      }
    },
    [
      personality,
      shouldAnimate,
      size,
      bodyTx,
      bodyTy,
      bodyScaleX,
      bodyScaleY,
      bodyRotate,
      headRotate,
      leftEarExtra,
      rightEarExtra,
      pawBounce,
    ]
  );

  // Watch external `reaction` prop
  const lastExternalIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (reaction && reaction.id !== lastExternalIdRef.current) {
      lastExternalIdRef.current = reaction.id;
      playReactionChoreography(reaction.type, reaction.id);
    }
  }, [reaction, playReactionChoreography]);

  // Clean up reaction timer on unmount
  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
    };
  }, []);

  // Continuous ambient breathing, tail wagging & body sway loops
  useEffect(() => {
    if (!shouldAnimate || healthState === 'knocked_out') {
      cancelAnimation(breath);
      cancelAnimation(wag);
      cancelAnimation(sway);
      breath.value = 0;
      wag.value = 0;
      sway.value = 0;
      return;
    }

    const speedMult =
      mood === 'anticipation'
        ? 2.1
        : mood === 'urgent'
          ? 2.5
          : mood === 'victory'
            ? 2.2
            : mood === 'streak'
              ? 1.45
              : mood === 'sleepy'
                ? 0.55
                : healthState === 'critical'
                  ? 1.55 // Heavy low-HP panting!
                  : 1.0;

    const halfBreath = Math.max(180, Math.round(personality.breathCycleMs / 2 / speedMult));
    const halfWag = Math.max(
      110,
      Math.round(
        personality.tailCycleMs /
          2 /
          (mood === 'anticipation' || mood === 'victory' ? 2.4 : speedMult)
      )
    );
    const halfSway = Math.max(240, Math.round((personality.breathCycleMs * 0.85) / speedMult));

    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: halfBreath, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: halfBreath, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    if (mood !== 'defeat') {
      wag.value = withRepeat(
        withSequence(
          withTiming(1, { duration: halfWag, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: halfWag, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      wag.value = 0;
    }

    sway.value = withRepeat(
      withSequence(
        withTiming(1, { duration: halfSway, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: halfSway, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(breath);
      cancelAnimation(wag);
      cancelAnimation(sway);
    };
  }, [shouldAnimate, healthState, mood, personality, breath, wag, sway]);

  // Natural randomized eye blinking + spontaneous single-ear flicks!
  useEffect(() => {
    if (!shouldAnimate || healthState === 'knocked_out') {
      setIsBlinking(false);
      return;
    }

    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    let openTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleNext = () => {
      const nextMs = 2500 + Math.floor(Math.random() * 2700);
      blinkTimeout = setTimeout(() => {
        if (cancelled) return;
        setIsBlinking(true);

        // 45% chance of a subtle spontaneous ear/flipper twitch alongside or between blinks!
        if (Math.random() < 0.45) {
          earTwitch.value = withSequence(
            withTiming(1, { duration: 90 }),
            withTiming(-0.4, { duration: 90 }),
            withTiming(0, { duration: 120 })
          );
        }

        openTimeout = setTimeout(() => {
          if (cancelled) return;
          setIsBlinking(false);
          scheduleNext();
        }, 140);
      }, nextMs);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (blinkTimeout) clearTimeout(blinkTimeout);
      if (openTimeout) clearTimeout(openTimeout);
    };
  }, [shouldAnimate, healthState, earTwitch]);

  // Tap-to-pet handler (5 rapid pets = zoomie spin easter egg!)
  const handlePress = useCallback(() => {
    if (!interactive) return;
    const now = Date.now();
    const recent = petTimestampsRef.current.filter((t) => now - t < PET_STREAK_WINDOW_MS);
    recent.push(now);
    petTimestampsRef.current = recent;

    localIdCounterRef.current += 1;
    if (recent.length >= PET_ZOOMIE_THRESHOLD) {
      petTimestampsRef.current = [];
      playReactionChoreography('dizzy_joy', localIdCounterRef.current);
      onPet?.('dizzy_joy');
    } else {
      playReactionChoreography('pet', localIdCounterRef.current);
      onPet?.('pet');
    }
  }, [interactive, playReactionChoreography, onPet]);

  const expression = useMemo(
    () =>
      resolveFighterExpression({
        healthState,
        mood,
        activeReaction,
        isBlinking,
      }),
    [healthState, mood, activeReaction, isBlinking]
  );

  // Precompute pixel offsets from center (50, 50) for each anatomical joint
  const headDx = ((pivots.head.x - 50) / 100) * size;
  const headDy = ((pivots.head.y - 50) / 100) * size;
  const leftDx = ((pivots.leftEar.x - 50) / 100) * size;
  const leftDy = ((pivots.leftEar.y - 50) / 100) * size;
  const rightDx = ((pivots.rightEar.x - 50) / 100) * size;
  const rightDy = ((pivots.rightEar.y - 50) / 100) * size;
  const tailDx = ((pivots.tail.x - 50) / 100) * size;
  const tailDy = ((pivots.tail.y - 50) / 100) * size;

  const breathAmp = personality.breathIntensity * (healthState === 'critical' ? 1.45 : 1);
  const idleTiltAmp = personality.idleTiltDeg;
  const earAmp = personality.earSwayDeg;
  const tailAmp = personality.tailWagDeg;

  // Whole-rig animated style (breathing squash/stretch, victory dance, critical grit tremble, KO slump)
  const rigRootStyle = useAnimatedStyle(() => {
    const isKO = healthState === 'knocked_out';
    const isDefeat = mood === 'defeat';
    const isVictory = mood === 'victory';
    const isAnticipation = mood === 'anticipation';
    const isUrgent = mood === 'urgent';
    const isCritical = healthState === 'critical';

    const victoryHop = isVictory ? -Math.abs(breath.value) * size * 0.11 : 0;
    const anticipationLean = isAnticipation ? -size * 0.035 : 0;
    const slumpY = isKO ? size * 0.07 : isDefeat ? size * 0.045 : 0;
    const gritJitterX =
      isUrgent
        ? sway.value * 1.6
        : isCritical && !activeReaction
          ? sway.value * 0.9
          : 0;

    const postureRotate = isKO
      ? -10
      : isDefeat
        ? -5
        : isVictory
          ? sway.value * 7.5
          : sway.value * idleTiltAmp;

    const sx = bodyScaleX.value * (1 - breath.value * breathAmp * 0.45);
    const sy =
      bodyScaleY.value *
      (isKO ? 0.92 : 1 + breath.value * breathAmp);

    return {
      transform: [
        { translateX: bodyTx.value + gritJitterX },
        { translateY: bodyTy.value + victoryHop + anticipationLean + slumpY },
        { rotate: `${bodyRotate.value + postureRotate}deg` },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });

  // Head pivot animated style
  const headStyle = useAnimatedStyle(() => {
    const moodHeadTilt =
      mood === 'curious'
        ? 6.5
        : mood === 'sleepy'
          ? 4.5
          : mood === 'defeat'
            ? -6
            : sway.value * 1.8;
    const moodHeadY =
      mood === 'sleepy'
        ? size * 0.025
        : mood === 'defeat'
          ? size * 0.03
          : -breath.value * size * 0.012;

    return {
      transform: [
        { translateX: headDx },
        { translateY: headDy + headTy.value + moodHeadY },
        { rotate: `${headRotate.value + moodHeadTilt}deg` },
        { translateX: -headDx },
        { translateY: -headDy },
      ],
    };
  });

  // Left ear / flipper / wing pivot animated style
  const leftEarStyle = useAnimatedStyle(() => {
    const moodOffset =
      mood === 'curious'
        ? -10
        : mood === 'anticipation'
          ? -12
          : mood === 'sleepy' || mood === 'defeat'
            ? 8
            : 0;
    const rot =
      breath.value * earAmp +
      earTwitch.value * -12 +
      moodOffset +
      leftEarExtra.value;

    return {
      transform: [
        { translateX: leftDx },
        { translateY: leftDy },
        { rotate: `${rot}deg` },
        { translateX: -leftDx },
        { translateY: -leftDy },
      ],
    };
  });

  // Right ear / flipper / wing pivot animated style
  const rightEarStyle = useAnimatedStyle(() => {
    const moodOffset =
      mood === 'anticipation'
        ? 12
        : mood === 'sleepy' || mood === 'defeat'
          ? -8
          : 0;
    const rot =
      -breath.value * earAmp +
      moodOffset +
      rightEarExtra.value;

    return {
      transform: [
        { translateX: rightDx },
        { translateY: rightDy },
        { rotate: `${rot}deg` },
        { translateX: -rightDx },
        { translateY: -rightDy },
      ],
    };
  });

  // Tail / oracle halo / throat pouch pivot animated style
  const tailStyle = useAnimatedStyle(() => {
    const amp = mood === 'anticipation' || mood === 'victory' ? tailAmp * 1.35 : tailAmp;
    const rot = wag.value * amp;
    return {
      transform: [
        { translateX: tailDx },
        { translateY: tailDy },
        { rotate: `${rot}deg` },
        { translateX: -tailDx },
        { translateY: -tailDy },
      ],
    };
  });

  // Front paws / feet animated style
  const pawStyle = useAnimatedStyle(() => {
    const tippyTap =
      mood === 'anticipation' || mood === 'victory'
        ? -Math.abs(wag.value) * size * 0.035
        : 0;
    return {
      transform: [{ translateY: pawBounce.value + tippyTap }],
    };
  });

  const renderCreatureRig = () => {
    const rigProps = {
      size,
      expression,
      healthState,
      headStyle,
      leftEarStyle,
      rightEarStyle,
      tailStyle,
      pawStyle,
    };

    switch (characterName) {
      case 'Orange Tabby':
        return <OrangeTabbyRig {...rigProps} />;
      case 'Sly Fox':
        return <SlyFoxRig {...rigProps} />;
      case 'Emperor Penguin':
        return <EmperorPenguinRig {...rigProps} />;
      case 'Corgi':
        return <CorgiRig {...rigProps} />;
      case 'Pelican':
        return <PelicanRig {...rigProps} />;
      case 'Badger':
        return <BadgerRig {...rigProps} />;
      default:
        return (
          <FallbackFighterRig
            {...rigProps}
            characterName={characterName}
            iconOverride={characterIcon}
          />
        );
    }
  };

  const isCriticalFrame = healthState === 'critical' || healthState === 'knocked_out';
  const isStreakFrame = streak >= 3 || mood === 'streak' || mood === 'victory';

  const frameDynamicStyle: ViewStyle | undefined = framed
    ? {
        width: size,
        height: size,
        borderRadius: Math.max(10, Math.round(size * 0.24)),
        borderWidth: 2,
        borderColor: isCriticalFrame
          ? COLORS.impactRed
          : isStreakFrame
            ? COLORS.actionYellow
            : COLORS.slateCharcoal,
        backgroundColor: isCriticalFrame
          ? '#FFF1F2'
          : isStreakFrame
            ? '#FFFBEB'
            : COLORS.paperBeige,
      }
    : {
        width: size,
        height: size,
      };

  const stageContent = (
    <View
      style={[styles.stageBase, frameDynamicStyle, style]}
      testID={testID ?? 'fighter-avatar'}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={`${characterName} fighter (${healthState})`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, rigRootStyle]}>
        {renderCreatureRig()}
        <FighterDamageOverlay
          healthState={healthState}
          headStyle={headStyle}
          animate={shouldAnimate}
        />
      </Animated.View>

      <FighterEffectsOverlay
        activeReaction={activeReaction}
        reactionId={activeReactionKey}
        mood={mood}
        personality={personality}
        animate={shouldAnimate}
      />

      {/* Streak mini-pill when framed in HUD and on a 3+ match streak! */}
      {framed && streak >= 3 && (
        <View style={styles.streakBadge} pointerEvents="none" testID="fighter-streak-badge">
          <Text style={styles.streakBadgeText}>{streak}x</Text>
        </View>
      )}
    </View>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={4}
        testID={testID ? `${testID}-pressable` : 'fighter-avatar-pressable'}
      >
        {stageContent}
      </Pressable>
    );
  }

  return stageContent;
};

const styles = StyleSheet.create({
  stageBase: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  streakBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
  },
  streakBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.slateCharcoal,
  },
});

export default FighterAvatar;
