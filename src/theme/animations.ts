/**
 * NShapes Animation System
 * Centralized animation constants and presets for consistent motion design
 */

import { Easing } from 'react-native-reanimated';

// =============================================================================
// DURATIONS (in milliseconds)
// =============================================================================

export const DURATIONS = {
  instant: 50,
  fast: 100,
  normal: 200,
  moderate: 300,
  slow: 500,
  slower: 750,
  slowest: 1000,

  // Specific use cases
  press: 100,
  hover: 150,
  fade: 200,
  slide: 250,
  modal: 300,
  page: 350,
  staggerBase: 50,
} as const;

// =============================================================================
// EASING FUNCTIONS
// =============================================================================

export const EASINGS = {
  // Standard easings
  linear: Easing.linear,
  ease: Easing.ease,
  easeIn: Easing.in(Easing.ease),
  easeOut: Easing.out(Easing.ease),
  easeInOut: Easing.inOut(Easing.ease),

  // Smooth sine wave (for floating animations)
  sine: Easing.inOut(Easing.sin),
  sineIn: Easing.in(Easing.sin),
  sineOut: Easing.out(Easing.sin),

  // Bouncy spring-like
  bounce: Easing.bounce,
  elastic: Easing.elastic(1),

  // Cubic for smooth transitions
  cubicIn: Easing.in(Easing.cubic),
  cubicOut: Easing.out(Easing.cubic),
  cubicInOut: Easing.inOut(Easing.cubic),

  // Exponential for dramatic effects
  expoIn: Easing.in(Easing.exp),
  expoOut: Easing.out(Easing.exp),
  expoInOut: Easing.inOut(Easing.exp),
} as const;

// =============================================================================
// SPRING CONFIGS (for react-native-reanimated withSpring)
// =============================================================================

export const SPRINGS = {
  // Snappy, responsive spring
  snappy: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },

  // Gentle, smooth spring
  gentle: {
    damping: 20,
    stiffness: 100,
    mass: 1,
  },

  // Bouncy, playful spring
  bouncy: {
    damping: 10,
    stiffness: 180,
    mass: 1,
  },

  // Heavy, weighty spring
  heavy: {
    damping: 25,
    stiffness: 200,
    mass: 1.5,
  },

  // For pop-in animations (rewards, badges)
  popIn: {
    damping: 12,
    stiffness: 200,
    mass: 0.8,
  },

  // For press effects
  press: {
    damping: 20,
    stiffness: 300,
    mass: 0.5,
  },

  // ==========================================================================
  // DELIGHTFUL SPRINGS - Make the UI feel alive!
  // ==========================================================================

  // Eager response - elements that WANT to be interacted with
  eager: {
    damping: 8,
    stiffness: 250,
    mass: 0.6,
  },

  // Joyful bounce - for celebrations and successes
  joyful: {
    damping: 6,
    stiffness: 200,
    mass: 0.8,
  },

  // Wobbly - fun overshoot for playful elements
  wobbly: {
    damping: 7,
    stiffness: 180,
    mass: 0.9,
  },

  // Soft landing - gentle arrival with character
  softLand: {
    damping: 14,
    stiffness: 120,
    mass: 1,
  },

  // Quick snap - fast and decisive
  quickSnap: {
    damping: 18,
    stiffness: 400,
    mass: 0.4,
  },

  // Card flip - satisfying card interactions
  cardFlip: {
    damping: 12,
    stiffness: 160,
    mass: 0.7,
  },

  // Button squish - satisfying press feedback
  squish: {
    damping: 10,
    stiffness: 350,
    mass: 0.5,
  },

  // Celebration pop - for victories and achievements
  celebration: {
    damping: 5,
    stiffness: 220,
    mass: 0.7,
  },

  // Breathing - for idle pulsing animations
  breathing: {
    damping: 20,
    stiffness: 40,
    mass: 1,
  },
} as const;

// =============================================================================
// ANIMATION PRESETS
// =============================================================================

export const ANIMATION_PRESETS = {
  // Button press animation values
  press: {
    scale: 0.98,
    opacity: 0.9,
    duration: DURATIONS.press,
  },

  // Hover elevation animation values
  hover: {
    scale: 1.02,
    translateY: -2,
    duration: DURATIONS.hover,
  },

  // Card selection
  select: {
    scale: 1.05,
    duration: DURATIONS.normal,
  },

  // Fade transitions
  fade: {
    duration: DURATIONS.fade,
    easing: EASINGS.easeOut,
  },

  // Slide transitions
  slideUp: {
    duration: DURATIONS.slide,
    easing: EASINGS.cubicOut,
  },

  // Modal entrance
  modal: {
    duration: DURATIONS.modal,
    easing: EASINGS.cubicOut,
  },

  // Page/phase transitions
  page: {
    duration: DURATIONS.page,
    easing: EASINGS.easeInOut,
  },

  // Stagger delay for list items
  stagger: {
    delay: DURATIONS.staggerBase,
  },

  // Floating animation (MainMenu cards)
  float: {
    duration: 4000,
    amplitude: 20,
    easing: EASINGS.sine,
  },

  // Pulse animation (critical timer, badges)
  pulse: {
    duration: 400,
    scale: 1.08,
    easing: EASINGS.sine,
  },

  // Shimmer effect (holographic, loading)
  shimmer: {
    duration: 2500,
    easing: EASINGS.linear,
  },

  // Glow pulse (award tiles)
  glow: {
    riseTime: 200,
    fallTime: 300,
  },

  // ==========================================================================
  // DELIGHTFUL PRESETS - Spark joy in every interaction!
  // ==========================================================================

  // Button squish - satisfying tactile feedback
  buttonSquish: {
    scale: 0.92,
    duration: DURATIONS.fast,
    spring: 'squish',
  },

  // Card eager hover - cards that want to be picked
  cardEager: {
    scale: 1.05,
    translateY: -8,
    rotation: 1, // slight tilt in degrees
    duration: DURATIONS.fast,
    spring: 'eager',
  },

  // Card select - satisfying selection feedback
  cardSelect: {
    scale: 1.08,
    glow: true,
    spring: 'joyful',
  },

  // Reward pop - for when good things happen
  rewardPop: {
    initialScale: 0.3,
    overshootScale: 1.2,
    finalScale: 1,
    spring: 'celebration',
  },

  // Success bounce - celebratory bounce
  successBounce: {
    scale: 1.15,
    spring: 'joyful',
  },

  // Error shake - playful but clear error feedback
  errorShake: {
    translateX: [-10, 10, -8, 8, -4, 4, 0],
    duration: 400,
  },

  // Coin collect - satisfying currency feedback
  coinCollect: {
    scale: 1.3,
    opacity: 0,
    translateY: -30,
    duration: 400,
  },

  // Health pulse - heartbeat for health changes
  healthPulse: {
    scale: 1.25,
    duration: 200,
    spring: 'eager',
  },

  // Entrance slide with bounce
  entranceSlide: {
    fromY: 50,
    fromOpacity: 0,
    spring: 'wobbly',
  },

  // Stagger entrance for lists
  staggerEntrance: {
    delay: 60,
    fromY: 30,
    fromScale: 0.9,
    spring: 'softLand',
  },

  // Breathing idle - for elements waiting for attention
  breathingIdle: {
    scaleMin: 1,
    scaleMax: 1.03,
    duration: 2000,
  },

  // Wiggle attention - gentle attention-grabber
  wiggleAttention: {
    rotation: [-2, 2, -1.5, 1.5, -0.5, 0.5, 0],
    duration: 500,
  },

  // Match celebration - for successful SET matches
  matchCelebration: {
    scale: [1, 1.15, 0.95, 1.05, 1],
    opacity: [1, 1, 1, 0.9, 0],
    duration: 500,
  },

  // Level up fanfare
  levelUpFanfare: {
    scale: [0, 1.3, 0.9, 1.1, 1],
    rotation: [0, 10, -5, 3, 0],
    duration: 800,
  },
} as const;

// =============================================================================
// TRANSITION TYPES (for phase transitions)
// =============================================================================

export const TRANSITION_TYPES = {
  fade: 'fade',
  slideRight: 'slide_from_right',
  slideLeft: 'slide_from_left',
  slideUp: 'slide_from_bottom',
  slideDown: 'slide_from_top',
  scale: 'scale',
  none: 'none',
} as const;

export type TransitionType = typeof TRANSITION_TYPES[keyof typeof TRANSITION_TYPES];

// =============================================================================
// PHASE TRANSITION MAP
// =============================================================================

export const PHASE_TRANSITIONS: Record<string, TransitionType> = {
  'menu->character': TRANSITION_TYPES.slideRight,
  'character->difficulty': TRANSITION_TYPES.slideRight,
  'difficulty->round': TRANSITION_TYPES.fade,
  'round->shop': TRANSITION_TYPES.slideUp,
  'round->levelup': TRANSITION_TYPES.slideUp,
  'shop->round': TRANSITION_TYPES.slideDown,
  'levelup->round': TRANSITION_TYPES.slideDown,
  'round->victory': TRANSITION_TYPES.scale,
  'round->gameover': TRANSITION_TYPES.fade,
  'default': TRANSITION_TYPES.fade,
};
