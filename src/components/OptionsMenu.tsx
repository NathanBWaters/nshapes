/**
 * Thin backwards-compatible wrapper around the unified global `SettingsSheet` ([UI-21]).
 * Preserves all existing `OptionsMenuProps` and store-readiness / reset testIDs.
 */
import React from 'react';
import { SettingsSheet, type SettingsSheetProps } from './SettingsSheet';

export interface OptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onResetGame?: () => void;
  onReplayWalkthrough?: SettingsSheetProps['onReplayWalkthrough'];
  effectsOn?: SettingsSheetProps['effectsOn'];
  onToggleEffects?: SettingsSheetProps['onToggleEffects'];
  onSaveRestored?: SettingsSheetProps['onSaveRestored'];
}

const OptionsMenu: React.FC<OptionsMenuProps> = ({
  visible,
  onClose,
  onResetGame,
  onReplayWalkthrough,
  effectsOn,
  onToggleEffects,
  onSaveRestored,
}) => (
  <SettingsSheet
    visible={visible}
    onClose={onClose}
    onResetGame={onResetGame}
    onReplayWalkthrough={onReplayWalkthrough}
    effectsOn={effectsOn}
    onToggleEffects={onToggleEffects}
    onSaveRestored={onSaveRestored}
  />
);

export default OptionsMenu;
