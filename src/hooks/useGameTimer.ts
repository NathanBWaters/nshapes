import { useEffect, useRef } from 'react';

/**
 * Runs a callback every second when active.
 * Cleans up properly on deactivation or unmount.
 *
 * @param isActive - Whether the timer should be running
 * @param onTick - Callback to run every second
 * @param key - Optional key that when changed forces timer recreation
 */
export function useGameTimer(isActive: boolean, onTick: () => void, key?: number): void {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      onTickRef.current();
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, key]);
}
