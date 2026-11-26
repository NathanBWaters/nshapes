import { useEffect, useRef } from 'react';
import {
  cancelAnimation,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { EASE, STAYS } from '@/utils/motion';
import { useAppActive } from './useAppActive';

export const FIRE_BURN_DURATION = 250; // 0.25 seconds

interface UseBurnTimerOptions {
  isOnFire: boolean;
  fireStartTime: number | undefined;
  isPaused: boolean;
  onComplete?: () => void;
}

/**
 * [FX-25] Manages a 0.25s card burn lifecycle with ZERO `setInterval` polling
 * and ZERO React re-renders during the burn:
 *  - One pause-aware `setTimeout` triggers `onComplete` exactly once.
 *  - A Reanimated `SharedValue<number>` drives the 60fps GPU burn overlay opacity
 *    via `withTiming(1, { duration: remainingMs, easing: EASE.linear, ...STAYS })`,
 *    freezing cleanly via `cancelAnimation` whenever paused or backgrounded.
 */
export function useBurnTimer({
  isOnFire,
  fireStartTime,
  isPaused,
  onComplete,
}: UseBurnTimerOptions): SharedValue<number> {
  const appActive = useAppActive();
  const effectivePaused = Boolean(isPaused) || !appActive;
  const burnProgress = useSharedValue(0);

  const accumulatedTimeRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const completeCalledRef = useRef(false);
  const activeKeyRef = useRef<number | null>(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isOnFire || !fireStartTime) {
      cancelAnimation(burnProgress);
      burnProgress.value = 0;
      accumulatedTimeRef.current = 0;
      startedAtRef.current = null;
      completeCalledRef.current = false;
      activeKeyRef.current = null;
      return;
    }

    // New burn instance: reset progress and accumulation once
    if (activeKeyRef.current !== fireStartTime) {
      activeKeyRef.current = fireStartTime;
      completeCalledRef.current = false;
      accumulatedTimeRef.current = 0;
      startedAtRef.current = null;
      cancelAnimation(burnProgress);
      burnProgress.value = 0;
    }

    if (completeCalledRef.current) {
      burnProgress.value = 1;
      return;
    }

    if (effectivePaused) {
      cancelAnimation(burnProgress);
      burnProgress.value = Math.min(1, accumulatedTimeRef.current / FIRE_BURN_DURATION);
      startedAtRef.current = null;
      return;
    }

    const remainingMs = Math.max(0, FIRE_BURN_DURATION - accumulatedTimeRef.current);
    if (remainingMs <= 0) {
      burnProgress.value = 1;
      if (!completeCalledRef.current) {
        completeCalledRef.current = true;
        onCompleteRef.current?.();
      }
      return;
    }

    startedAtRef.current = Date.now();
    burnProgress.value = Math.min(1, accumulatedTimeRef.current / FIRE_BURN_DURATION);
    burnProgress.value = withTiming(1, {
      duration: remainingMs,
      easing: EASE.linear,
      ...STAYS,
    });

    const timeout = setTimeout(() => {
      startedAtRef.current = null;
      accumulatedTimeRef.current = FIRE_BURN_DURATION;
      burnProgress.value = 1;
      if (!completeCalledRef.current) {
        completeCalledRef.current = true;
        onCompleteRef.current?.();
      }
    }, remainingMs);

    return () => {
      clearTimeout(timeout);
      cancelAnimation(burnProgress);
      if (startedAtRef.current !== null && !completeCalledRef.current) {
        accumulatedTimeRef.current = Math.min(
          FIRE_BURN_DURATION,
          accumulatedTimeRef.current + Math.max(0, Date.now() - startedAtRef.current)
        );
        startedAtRef.current = null;
        burnProgress.value = Math.min(1, accumulatedTimeRef.current / FIRE_BURN_DURATION);
      }
    };
  }, [isOnFire, fireStartTime, effectivePaused, burnProgress]);

  return burnProgress;
}
