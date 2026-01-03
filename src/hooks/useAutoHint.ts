import { useEffect, useRef } from 'react';

interface UseAutoHintOptions {
  autoHintChance: number;
  autoHintInterval: number;
  isPaused: boolean;
  hasActiveHint: boolean;
  lastMatchTime: number | undefined;
  onTrigger: () => void;
}

const BASE_WAIT_TIME = 15000; // 15 seconds after last match
const MIN_WAIT_TIME = 5000;   // Minimum 5 second wait
const CHECK_INTERVAL = 2000;  // Check every 2 seconds

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
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  useEffect(() => {
    if (autoHintChance <= 0 || isPaused) return;

    const actualWaitTime = Math.max(MIN_WAIT_TIME, BASE_WAIT_TIME - autoHintInterval);

    const intervalId = setInterval(() => {
      if (hasActiveHint) return;

      const timeSinceMatch = lastMatchTime ? Date.now() - lastMatchTime : Infinity;
      if (timeSinceMatch < actualWaitTime) return;

      if (Math.random() * 100 < autoHintChance) {
        onTriggerRef.current();
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [autoHintChance, autoHintInterval, isPaused, hasActiveHint, lastMatchTime]);
}
