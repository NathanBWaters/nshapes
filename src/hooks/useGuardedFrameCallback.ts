import { useEffect } from 'react';
import { useFrameCallback, type FrameCallback, type FrameInfo } from 'react-native-reanimated';
import { registerFrameLoop } from '@/utils/perfWatchdog';
import { useAppActive } from './useAppActive';

/**
 * Single sanctioned Reanimated `useFrameCallback` wrapper.
 * Automatically gates execution on `useAppActive()` and reports active loops
 * to `perfWatchdog` so background or runaway UI-thread loops are caught immediately.
 */
export function useGuardedFrameCallback(
  callback: (frameInfo: FrameInfo) => void,
  isActive: boolean,
  debugLabel: string
): FrameCallback {
  const appActive = useAppActive();
  const shouldRun = Boolean(isActive) && appActive;

  useEffect(() => {
    if (!shouldRun) return;
    return registerFrameLoop(debugLabel);
  }, [shouldRun, debugLabel]);

  return useFrameCallback(callback, shouldRun);
}
