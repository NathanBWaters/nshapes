import { Platform } from 'react-native';

/**
 * Cross-platform monospace font family.
 * iOS does not ship a font named `'monospace'` (it logs a missing-font warning
 * and falls back unpredictably), so map iOS cleanly to `'Menlo'`.
 */
export const MONO_FONT: string = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) ?? 'monospace';
