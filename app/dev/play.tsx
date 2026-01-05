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
 * - ?autoplayer=true - Enable autoplayer mode
 */
export default function DevPlay() {
  const { autoplayer } = useLocalSearchParams<{ autoplayer?: string }>();

  return <Game devMode={true} autoPlayer={autoplayer === 'true'} />;
}
