import { useState, useEffect, useRef, useCallback } from 'react';

const FIRE_BURN_DURATION = 250; // 0.25 seconds

interface UseBurnTimerOptions {
  isOnFire: boolean;
  fireStartTime: number | undefined;
  isPaused: boolean;
  onComplete?: () => void;
}

/**
 * Manages a burn timer that tracks progress from 0 to 1 over 7.5 seconds.
 * Supports pause/resume by tracking accumulated time rather than wall clock.
 * Calls onComplete exactly once when the timer finishes.
 */
export function useBurnTimer({
  isOnFire,
  fireStartTime,
  isPaused,
  onComplete,
}: UseBurnTimerOptions): number {
  const [progress, setProgress] = useState(0);

  const accumulatedTimeRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const completeCalledRef = useRef(false);

  // Stable callback reference
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Reset when fire starts
  useEffect(() => {
    if (isOnFire && fireStartTime) {
      completeCalledRef.current = false;
      accumulatedTimeRef.current = 0;
      lastTickRef.current = Date.now();
    }
  }, [isOnFire, fireStartTime]);

  // Update progress
  useEffect(() => {
    if (!isOnFire || !fireStartTime) {
      setProgress(0);
      accumulatedTimeRef.current = 0;
      lastTickRef.current = null;
      return;
    }

    if (isPaused) {
      lastTickRef.current = null;
      return;
    }

    const updateProgress = () => {
      const now = Date.now();

      if (lastTickRef.current !== null) {
        const delta = now - lastTickRef.current;
        accumulatedTimeRef.current += delta;
      }
      lastTickRef.current = now;

      const newProgress = Math.min(accumulatedTimeRef.current / FIRE_BURN_DURATION, 1);
      setProgress(newProgress);

      if (newProgress >= 1 && onCompleteRef.current && !completeCalledRef.current) {
        completeCalledRef.current = true;
        onCompleteRef.current();
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 100);
    return () => clearInterval(interval);
  }, [isOnFire, fireStartTime, isPaused]);

  return progress;
}
