import { useEffect, useState } from 'react';
import { Platform, type TextStyle } from 'react-native';

/**
 * [UI-02] Semantic Tactile Tabletop Storybook Typography Stack.
 *
 * Harmonizes with iOS/Android/Web native store readiness:
 * - Never emits invalid `'monospace'` on iOS (maps cleanly to `'Menlo'`).
 * - Exposes `DISPLAY_FONT`, `BODY_FONT`, `MONO_FONT`, `FONT`, and `TEXT_STYLE`
 *   tokens so every screen shares one cohesive tabletop hierarchy.
 * - Loads web Google Fonts (`Inter`, `Plus Jakarta Sans`, `JetBrains Mono`)
 *   non-blockingly via `useAppFonts()` with instant, zero-flash system fallbacks
 *   for offline/native/Jest environments.
 */

export const DISPLAY_FONT: string =
  Platform.select({
    ios: 'AvenirNext-Heavy',
    android: 'sans-serif-black',
    web: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'sans-serif',
  }) ?? 'sans-serif';

export const BODY_FONT: string =
  Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'sans-serif',
  }) ?? 'sans-serif';

/**
 * Cross-platform monospace font family for tabular numeric counters, timers,
 * damage equations, and Player IDs.
 * iOS does not ship a font named `'monospace'`, so map iOS cleanly to `'Menlo'`.
 */
export const MONO_FONT: string =
  Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    web: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    default: 'monospace',
  }) ?? 'monospace';

export const FONT = {
  display: DISPLAY_FONT,
  body: BODY_FONT,
  mono: MONO_FONT,
} as const;

export type TextStyleToken =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'monoNum';

export const TEXT_STYLE: Record<TextStyleToken, TextStyle> = {
  display: {
    fontFamily: DISPLAY_FONT,
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 46,
    letterSpacing: 1.5,
  },
  h1: {
    fontFamily: DISPLAY_FONT,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
    letterSpacing: 0.8,
  },
  h2: {
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    letterSpacing: 0.6,
  },
  h3: {
    fontFamily: DISPLAY_FONT,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: 0.4,
  },
  body: {
    fontFamily: BODY_FONT,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: BODY_FONT,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  caption: {
    fontFamily: BODY_FONT,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  monoNum: {
    fontFamily: MONO_FONT,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
};

const WEB_FONT_STYLESHEET_ID = 'nshapes-storybook-fonts';
const WEB_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@700;800&family=Plus+Jakarta+Sans:wght@800&display=swap';

/**
 * Ensures the Storybook web font stack is requested once without ever blocking
 * first paint, offline play, native builds, or Jest rendering.
 */
export function ensureWebFontsLoaded(): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return true;
  }
  try {
    if (document.getElementById(WEB_FONT_STYLESHEET_ID)) {
      return true;
    }
    const link = document.createElement('link');
    link.id = WEB_FONT_STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = WEB_FONT_URL;
    document.head?.appendChild(link);
    return true;
  } catch {
    return true;
  }
}

/**
 * Root layout font hook: triggers non-blocking web font registration while
 * immediately reporting `loaded = true` so native & offline startup never stall.
 */
export function useAppFonts(): { loaded: boolean } {
  const [loaded, setLoaded] = useState(true);

  useEffect(() => {
    ensureWebFontsLoaded();
    setLoaded(true);
  }, []);

  return { loaded };
}
