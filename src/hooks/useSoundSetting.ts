import { useCallback, useEffect, useState } from 'react';
import { setAudioEnabled } from '@/utils/sounds';
import { SettingsStorage } from '@/utils/storage';

/**
 * The persisted "sound effects" setting.
 * `reloadKey` re-reads the stored value when it changes (e.g. each time a modal opens),
 * since another screen may have toggled it meanwhile.
 */
export function useSoundSetting(reloadKey?: unknown): [enabled: boolean, toggle: () => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(SettingsStorage.getSoundEnabled());
  }, [reloadKey]);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    setAudioEnabled(next);
    SettingsStorage.setSoundEnabled(next);
  }, [enabled]);

  return [enabled, toggle];
}
