/**
 * useResponsive - Responsive layout hook
 * Provides breakpoint detection and responsive values
 */

import { useWindowDimensions } from 'react-native';
import { BREAKPOINTS, Breakpoint } from '../theme';

interface ResponsiveValues {
  /** Current viewport width */
  width: number;
  /** Current viewport height */
  height: number;
  /** Current breakpoint name */
  breakpoint: Breakpoint;
  /** Whether in landscape orientation */
  isLandscape: boolean;
  /** Whether on mobile breakpoint */
  isMobile: boolean;
  /** Whether on tablet breakpoint */
  isTablet: boolean;
  /** Whether on desktop breakpoint */
  isDesktop: boolean;
  /** Whether on wide breakpoint */
  isWide: boolean;
  /** Number of columns for game board */
  boardColumns: number;
  /** Number of columns for selection grids */
  gridColumns: number;
  /** Spacing multiplier based on screen size */
  spacingMultiplier: number;
}

export function useResponsive(): ResponsiveValues {
  const { width, height } = useWindowDimensions();

  const breakpoint: Breakpoint =
    width >= BREAKPOINTS.wide
      ? 'wide'
      : width >= BREAKPOINTS.desktop
        ? 'desktop'
        : width >= BREAKPOINTS.tablet
          ? 'tablet'
          : 'mobile';

  const isLandscape = width > height;
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isDesktop = breakpoint === 'desktop';
  const isWide = breakpoint === 'wide';

  // Dynamic values based on breakpoint
  const boardColumns = isDesktop || isWide ? 4 : 3;

  const gridColumns =
    isWide ? 4 :
    isDesktop ? 4 :
    isTablet ? 3 : 2;

  const spacingMultiplier =
    isWide ? 1.5 :
    isDesktop ? 1.25 :
    isTablet ? 1.1 : 1;

  return {
    width,
    height,
    breakpoint,
    isLandscape,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    boardColumns,
    gridColumns,
    spacingMultiplier,
  };
}

/**
 * Get a responsive value based on breakpoint
 */
export function getResponsiveValue<T>(
  breakpoint: Breakpoint,
  values: Partial<Record<Breakpoint, T>> & { mobile: T }
): T {
  // Try to get value for current breakpoint, falling back to smaller breakpoints
  if (breakpoint === 'wide' && values.wide !== undefined) return values.wide;
  if ((breakpoint === 'wide' || breakpoint === 'desktop') && values.desktop !== undefined) return values.desktop;
  if ((breakpoint === 'wide' || breakpoint === 'desktop' || breakpoint === 'tablet') && values.tablet !== undefined) return values.tablet;
  return values.mobile;
}

export default useResponsive;
