import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import Game from '@/components/Game';

/**
 * Dev Play Page
 *
 * Renders the standard Game component in dev mode.
 * Access dev tools through the MENU button -> Dev Tools.
 *
 * Available dev controls:
 * - Toggle timer on/off
 * - Reset board
 * - Add cards to board
 * - Change round (1-10)
 * - Change difficulty/attributes (3-5)
 * - Set cards on fire
 * - Make cards holographic
 * - Add graces
 * - Add legendary weapons by category
 * - Clear all weapons
 *
 * URL params:
 * - ?autoplayer=true - Enable autoplayer mode (alias: ?autoplay=true)
 * - ?enemy=Night%20Owl - Force specific enemy selection (skips enemy selection screen)
 * - ?timeout=false - Disable round timer for deterministic testing
 */
export default function DevPlay() {
  const params = useLocalSearchParams<{
    autoplayer?: string;
    autoplay?: string;
    enemy?: string;
    timeout?: string;
  }>();

  // Support both autoplayer and autoplay params
  const autoPlayerEnabled = params.autoplayer === 'true' || params.autoplay === 'true';
  const forcedEnemy = params.enemy || undefined;
  const disableTimeout = params.timeout === 'false';

  return (
    <Game
      devMode={true}
      autoPlayer={autoPlayerEnabled}
      forcedEnemy={forcedEnemy}
      disableTimeout={disableTimeout}
    />
  );
}
