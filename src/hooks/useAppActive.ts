import { useSyncExternalStore } from 'react';
import { getIsAppActive, subscribeAppActive } from '@/utils/appLifecycle';

const getServerSnapshot = () => true;

/** React hook returning true when the app/tab is actively visible in the foreground. */
export function useAppActive(): boolean {
  return useSyncExternalStore(subscribeAppActive, getIsAppActive, getServerSnapshot);
}
