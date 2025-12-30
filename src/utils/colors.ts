// NShapes Style Guide Colors - "The Core Stack"
// Retro-Modern Enterprise aesthetic with high-contrast, geometric design

export const COLORS = {
  // Primary Colors
  actionYellow: '#FFDE00',    // Primary CTA, notifications, eyebrow banners
  slateCharcoal: '#383838',   // Primary text, headers, borders, strokes
  deepOnyx: '#121212',        // Dark backgrounds, terminal windows
  canvasWhite: '#FFFFFF',     // Card backgrounds, primary text on dark

  // Secondary & Accent Colors
  paperBeige: '#F4EFEA',      // Layout backgrounds, unfilled progress bars
  logicTeal: '#16AA98',       // Success states, positive indicators
  impactOrange: '#FF9538',    // Warnings, secondary highlights
  impactRed: '#FF7169',       // Errors, damage indicators

  // Semantic Colors (derived from palette)
  success: '#16AA98',         // Logic Teal
  error: '#FF7169',           // Impact Red variant
  warning: '#FF9538',         // Impact Orange
  info: '#383838',            // Slate Charcoal
};

// Border radius standards
export const RADIUS = {
  button: 4,      // CTA buttons
  module: 12,     // Cards, modules
  container: 24,  // Top-level screen containers
};

// Border widths
export const BORDERS = {
  thin: 1,
  standard: 2,
};

// Typography weights (Inter font family)
export const FONT_WEIGHTS = {
  light: '300' as const,
  regular: '400' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};
