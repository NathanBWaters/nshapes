import { useEffect, useRef } from 'react';
import { registerInterval } from '@/utils/perfWatchdog';
import { useAppActive } from './useAppActive';

interface UseAutoHintOptions {
  autoHintChance: number;
  autoHintInterval: number;
  isPaused: boolean;
  hasActiveHint: boolean;
  lastMatchTime: number | undefined;
  onTrigger: () => void;
}

const BASE_WAIT_TIME = 8000;  // 8 seconds after last match (responsive during active Set fights)
const MIN_WAIT_TIME = 3000;   // Minimum 3 second wait
const CHECK_INTERVAL = 1500;  // Check every 1.5 seconds

/**
 * Manages auto-hint timing.
 * Triggers a hint after a configurable delay since the last match.
 * Respects pause state and active hint display.
 */
export function useAutoHint({
  autoHintChance,
  autoHintInterval,
  isPaused,
  hasActiveHint,
  lastMatchTime,
  onTrigger,
}: UseAutoHintOptions): void {
  const appActive = useAppActive();
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  useEffect(() => {
    if (autoHintChance <= 0 || isPaused || !appActive) return;

    const actualWaitTime = Math.max(MIN_WAIT_TIME, BASE_WAIT_TIME - autoHintInterval);

    const stopTrack = registerInterval('useAutoHint');
    const intervalId = setInterval(() => {
      if (hasActiveHint) return;

      const timeSinceMatch = lastMatchTime ? Date.now() - lastMatchTime : Infinity;
      if (timeSinceMatch < actualWaitTime) return;

      if (Math.random() * 100 < autoHintChance) {
        onTriggerRef.current();
      }
    }, CHECK_INTERVAL);

    return () => {
      clearInterval(intervalId);
      stopTrack();
    };
  }, [autoHintChance, autoHintInterval, isPaused, appActive, hasActiveHint, lastMatchTime]);
}
