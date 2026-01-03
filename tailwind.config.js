/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Colors from design system
      colors: {
        // Primary
        'action-yellow': '#FFDE00',
        'slate-charcoal': '#383838',
        'deep-onyx': '#121212',
        'canvas-white': '#FFFFFF',
        // Secondary
        'paper-beige': '#F4EFEA',
        'logic-teal': '#16AA98',
        'impact-orange': '#FF9538',
        'impact-red': '#FF7169',
        // Tutorial
        'tutorial-blue': '#3B82F6',
        // Rarity
        'rarity-common': '#383838',
        'rarity-rare': '#1976D2',
        'rarity-legendary': '#D97706',
      },
      // Spacing (4px base)
      spacing: {
        'xxs': '2px',
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '48px',
        'xxxl': '64px',
      },
      // Border radius
      borderRadius: {
        'button': '4px',
        'module': '12px',
        'container': '24px',
      },
      // Font sizes
      fontSize: {
        'xs': ['10px', { lineHeight: '1.2' }],
        'sm': ['12px', { lineHeight: '1.5' }],
        'md': ['14px', { lineHeight: '1.5' }],
        'lg': ['16px', { lineHeight: '1.5' }],
        'xl': ['18px', { lineHeight: '1.5' }],
        'xxl': ['20px', { lineHeight: '1.2' }],
        'xxxl': ['24px', { lineHeight: '1.2' }],
        'display': ['32px', { lineHeight: '1.2' }],
      },
      // Shadows (for web)
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.08)',
        'md': '0 2px 4px rgba(0, 0, 0, 0.12)',
        'lg': '0 4px 8px rgba(0, 0, 0, 0.16)',
        'xl': '0 8px 16px rgba(0, 0, 0, 0.20)',
      },
      // Z-index scale
      zIndex: {
        'dropdown': '10',
        'sticky': '20',
        'fixed': '30',
        'modal-backdrop': '40',
        'modal': '50',
        'popover': '60',
        'tooltip': '70',
        'notification': '80',
      },
      // Animation durations
      transitionDuration: {
        'instant': '50ms',
        'fast': '100ms',
        'normal': '200ms',
        'moderate': '300ms',
        'slow': '500ms',
      },
      // Animation timing functions
      transitionTimingFunction: {
        'ease-out-cubic': 'cubic-bezier(0.33, 1, 0.68, 1)',
        'ease-in-cubic': 'cubic-bezier(0.32, 0, 0.67, 0)',
        'ease-in-out-cubic': 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      // Opacity scale
      opacity: {
        'disabled': '0.4',
        'muted': '0.6',
        'subtle': '0.7',
        'hover': '0.8',
        'active': '0.9',
      },
    },
  },
  plugins: [],
};
