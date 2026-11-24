import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Subscribe to the Android hardware back button while `enabled` is true.
 * Return `true` from `onBack` to indicate the press was handled (preventing
 * abrupt app exit), or `false` to allow default system behavior.
 */
export function useAndroidBackHandler(onBack: () => boolean, enabled = true): void {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
      handlerRef.current()
    );
    return () => subscription.remove();
  }, [enabled]);
}
