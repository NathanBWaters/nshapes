import { useEffect, useRef } from 'react';

/**
 * Runs a callback every second when active.
 * Cleans up properly on deactivation or unmount.
 */
export function useGameTimer(isActive: boolean, onTick: () => void): void {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      onTickRef.current();
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);
}
