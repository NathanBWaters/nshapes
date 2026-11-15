import { useEffect, useRef } from 'react';
import { registerInterval } from '@/utils/perfWatchdog';
import { useAppActive } from './useAppActive';

/**
 * Runs a callback every second when active and the app is foregrounded.
 * Cleans up properly on deactivation, backgrounding, or unmount.
 *
 * @param isActive - Whether the timer should be running
 * @param onTick - Callback to run every second
 * @param key - Optional key that when changed forces timer recreation
 */
export function useGameTimer(isActive: boolean, onTick: () => void, key?: number): void {
  const appActive = useAppActive();
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!isActive || !appActive) return;

    const stopTrack = registerInterval('useGameTimer');
    const interval = setInterval(() => {
      onTickRef.current();
    }, 1000);

    return () => {
      clearInterval(interval);
      stopTrack();
    };
  }, [isActive, appActive, key]);
}
