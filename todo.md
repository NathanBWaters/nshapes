# NShapes World-Class UI/UX Improvement Plan

A comprehensive roadmap to achieve Stripe-level polish and Clash of Clans-level delight.

**Ralph Wiggum Compatible:** Each task is atomic, self-contained, and has clear completion criteria.

---

## Alive UI Philosophy

The difference between a good UI and a magical one is **ambient life**. The interface should feel like it's breathing, waiting, alive - even when the user isn't touching anything.

### The 7 Principles of Alive UI

1. **Nothing is ever truly still**
   - Elements have subtle idle animations (gentle float, soft pulse, micro-sway)
   - Even "static" elements breathe with barely perceptible motion

2. **Anticipation before action**
   - Buttons subtly "inhale" (grow 1-2%) when hovered before the click
   - Elements lean toward where they're about to go

3. **Organic timing is everything**
   - Never use identical durations - vary by ±10-20%
   - Stagger animations with slight randomness (not mechanical 50ms, 100ms, 150ms)
   - Use sine waves and perlin noise for natural movement

4. **The UI notices you**
   - Elements react subtly to cursor proximity (before hover)
   - Cards lean slightly toward the pointer
   - Idle animations pause/slow when user is active, resume when idle

5. **Layered depth creates life**
   - Background elements move slower than foreground (parallax)
   - Shadows shift subtly with "light source" movement
   - Multiple animation layers at different speeds

6. **Celebratory excess on success**
   - Victories explode with particles, flashes, shakes
   - Numbers don't just appear - they burst, bounce, settle
   - Sound + haptic + visual all sync for maximum dopamine

7. **Personality in every interaction**
   - Character icons aren't static - they blink, breathe, react
   - Weapons have subtle shimmer based on rarity
   - Fire actually flickers, holo cards actually shimmer

---

## How to Use with Ralph Wiggum

```bash
/ralph-loop "Work through todo.md. Find the next uncompleted task (marked with [ ]). Complete it, verify it works, mark it [x], then stop." --max-iterations 50
```

**Rules for each iteration:**
1. Find the first task marked `[ ]`
2. Complete that single task
3. Verify it works (build passes, no errors)
4. Mark it `[x]` in this file
5. Exit cleanly (Claude will be re-invoked for next task)

---

## TASK QUEUE

### Phase 1: Design System Foundation

#### Task 1.1: Create spacing tokens utility
**File:** `src/utils/spacing.ts`
**Completion Criteria:** File exists with exported SPACING object containing xs/sm/md/lg/xl/2xl/3xl values
```
- [x] Create src/utils/spacing.ts with:
  export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  } as const;
  export type SpacingKey = keyof typeof SPACING;
```

#### Task 1.2: Create typography tokens utility
**File:** `src/utils/typography.ts`
**Completion Criteria:** File exists with exported TEXT_STYLES object
```
- [x] Create src/utils/typography.ts with text style definitions:
  - caption: { fontSize: 11, fontWeight: '400', lineHeight: 13 }
  - bodySm: { fontSize: 13, fontWeight: '400', lineHeight: 18 }
  - body: { fontSize: 15, fontWeight: '400', lineHeight: 22 }
  - bodyLg: { fontSize: 17, fontWeight: '400', lineHeight: 25 }
  - h4: { fontSize: 19, fontWeight: '600', lineHeight: 25 }
  - h3: { fontSize: 22, fontWeight: '600', lineHeight: 29 }
  - h2: { fontSize: 28, fontWeight: '700', lineHeight: 34 }
  - h1: { fontSize: 36, fontWeight: '700', lineHeight: 40 }
  - display: { fontSize: 48, fontWeight: '900', lineHeight: 48 }
```

#### Task 1.3: Create animation tokens utility
**File:** `src/utils/animation.ts`
**Completion Criteria:** File exists with DURATION, EASING exports
```
- [x] Create src/utils/animation.ts with:
  export const DURATION = {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 400,
    slower: 600,
  } as const;

  export const EASING = {
    easeOutExpo: [0.16, 1, 0.3, 1],
    easeOutBack: [0.34, 1.56, 0.64, 1],
    spring: { tension: 120, friction: 6 },
    bounce: { tension: 180, friction: 12 },
  } as const;
```

#### Task 1.4: Create shadow tokens utility
**File:** `src/utils/shadows.ts`
**Completion Criteria:** File exists with SHADOWS and GLOWS exports
```
- [x] Create src/utils/shadows.ts with:
  export const SHADOWS = {
    sm: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    md: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6 },
    lg: { shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15 },
    xl: { shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 25 },
  } as const;

  export const GLOWS = {
    common: { shadowColor: '#383838', shadowOpacity: 0.3, shadowRadius: 8 },
    rare: { shadowColor: '#1976D2', shadowOpacity: 0.4, shadowRadius: 12 },
    legendary: { shadowColor: '#FF9538', shadowOpacity: 0.5, shadowRadius: 16 },
    selection: { shadowColor: '#FFDE00', shadowOpacity: 0.6, shadowRadius: 12 },
  } as const;
```

#### Task 1.5: Create design system barrel export
**File:** `src/utils/designSystem.ts`
**Completion Criteria:** File re-exports all design tokens from one place
```
- [x] Create src/utils/designSystem.ts that re-exports:
  export * from './spacing';
  export * from './typography';
  export * from './animation';
  export * from './shadows';
```

---

### Phase 2: Reusable UI Components

#### Task 2.1: Create AnimatedButton component
**File:** `src/components/ui/AnimatedButton.tsx`
**Completion Criteria:** Component exists with scale animation on press (0.95 down, 1.02 overshoot on release)
```
- [x] Create AnimatedButton.tsx with:
  - Animated.View wrapper with useAnimatedStyle
  - onPressIn: scale to 0.95, reduce shadow
  - onPressOut: scale to 1.02, then settle to 1.0
  - Uses DURATION.fast and EASING.easeOutBack from animation.ts
  - Props: onPress, children, variant ('primary' | 'secondary'), disabled
  - Primary variant uses Action Yellow (#FFDE00)
  - Secondary variant uses transparent with charcoal border
```

#### Task 2.2: Create AnimatedCard component
**File:** `src/components/ui/AnimatedCard.tsx`
**Completion Criteria:** Component has lift animation on selection with shadow increase
```
- [x] Create AnimatedCard.tsx with:
  - Animated scale (1.0 → 1.05) on selected prop
  - Shadow increases when selected (md → lg)
  - Yellow border when selected
  - Uses withSpring from react-native-reanimated
  - Props: selected, onPress, children, style
```

#### Task 2.3: Create particle emitter hook
**File:** `src/hooks/useParticles.ts`
**Completion Criteria:** Hook returns spawn function and Particles component
```
- [x] Create useParticles.ts with:
  - State array of particle objects { id, x, y, vx, vy, rotation, opacity, type }
  - spawnParticles(count, origin, type) function
  - useEffect that runs animation loop updating positions
  - Particles component that renders all active particles
  - Particle types: 'sparkle' | 'confetti' | 'explosion'
  - Particles remove themselves when opacity <= 0
```

#### Task 2.4: Create confetti burst component
**File:** `src/components/effects/ConfettiBurst.tsx`
**Completion Criteria:** Component renders animated confetti when triggered
```
- [x] Create ConfettiBurst.tsx with:
  - Uses useParticles hook
  - trigger prop that spawns 30 confetti particles when true
  - Particles have random colors, sizes, rotation
  - Particles fall with gravity, rotate, fade out
  - Duration ~2 seconds
```

#### Task 2.5: Create screen shake hook
**File:** `src/hooks/useScreenShake.ts` (if doesn't exist, enhance existing)
**Completion Criteria:** Hook provides shake function with intensity parameter
```
- [x] Enhance or create useScreenShake.ts:
  - shake(intensity: 'light' | 'medium' | 'heavy') function
  - light: 2px offset, 100ms
  - medium: 5px offset, 150ms
  - heavy: 10px offset, 200ms with decay
  - Returns translateX, translateY animated values
  - Uses withSequence for shake pattern
```

#### Task 2.6: Create number counter animation component
**File:** `src/components/ui/AnimatedCounter.tsx`
**Completion Criteria:** Component animates counting from 0 to value
```
- [x] Create AnimatedCounter.tsx with:
  - value prop (target number)
  - duration prop (default 600ms)
  - Counts up from previous value to new value
  - Uses easeOutExpo easing
  - Optional prefix/suffix props
  - Monospace font styling
```

---

### Phase 3: Core Gameplay Polish

#### Task 3.1: Enhance card selection animation in Card.tsx
**File:** `src/components/Card.tsx`
**Completion Criteria:** Selected cards scale up 1.05x with enhanced shadow
```
- [x] Update Card.tsx:
  - Wrap card in Animated.View
  - When isSelected: scale(1.05), shadow increases to SHADOWS.lg
  - Use withSpring animation with EASING.spring config
  - Add subtle translateY: -4 lift effect
  - Transition duration: DURATION.fast
```

#### Task 3.2: Add card deselection bounce
**File:** `src/components/Card.tsx`
**Completion Criteria:** Deselected cards have slight bounce settle animation
```
- [x] Update Card.tsx:
  - When isSelected goes false: scale briefly to 0.98, then 1.0
  - Use withSequence for the bounce effect
  - Total duration ~200ms
```

#### Task 3.3: Add match success screen flash
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** Brief white flash overlay on successful match
```
- [x] Update GameBoard.tsx:
  - Add Animated.View overlay with white background
  - On match success: flash opacity 0 → 0.3 → 0 over 150ms
  - Use useSharedValue for flash opacity
  - Trigger from handleMatch success case
```

#### Task 3.4: Add match failure shake animation
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** Cards shake and flash red on failed match
```
- [x] Update GameBoard.tsx:
  - On match failure: trigger screen shake (medium intensity)
  - Add red flash overlay (opacity 0 → 0.2 → 0)
  - Selected cards should individually shake before deselecting
  - Duration ~300ms total
```

#### Task 3.5: Animate holographic card shimmer
**File:** `src/components/Card.tsx`
**Completion Criteria:** Holographic cards have animated rainbow gradient
```
- [x] Update Card.tsx holographic styling:
  - Add useSharedValue for shimmer position
  - Animate linear gradient position continuously
  - Use withRepeat + withTiming for infinite loop
  - Gradient moves diagonally across card (4s cycle)
  - Colors: purple → blue → cyan → green → yellow → red → purple
```

#### Task 3.6: Enhance fire card flickering
**File:** `src/components/Card.tsx`
**Completion Criteria:** Fire cards have animated flickering border
```
- [x] Update Card.tsx fire styling:
  - Add rapid opacity fluctuation to fire border (0.7 → 1.0)
  - Use withRepeat + withSequence for flicker pattern
  - Randomize timing slightly for organic feel
  - Add subtle ember particles rising (use useParticles)
```

#### Task 3.7: Add explosion particle effect
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** Explosions spawn debris particles from card positions
```
- [x] Update GameBoard.tsx explosion handling:
  - Import useParticles hook
  - On explosion trigger: spawn 15 explosion particles at card center
  - Particles burst outward in all directions
  - Particles fade over 500ms
  - Combine with existing screen shake
```

#### Task 3.8: Add laser beam effect
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** Laser fires visible beam across row/column
```
- [x] Update GameBoard.tsx laser handling:
  - Create LaserBeam component (Animated.View with gradient)
  - On laser trigger: beam appears and extends across row/column
  - Beam has glowing effect (yellow/white center, orange edges)
  - Beam fades out after reaching edge (~400ms total)
  - Add subtle glow trail
```

#### Task 3.9: Animate new card entry
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** Replacement cards slide in from top with bounce
```
- [x] Update GameBoard.tsx card replacement:
  - Track which cards are newly added
  - New cards start with translateY: -100, opacity: 0
  - Animate to translateY: 0, opacity: 1 with bounce
  - Stagger animation by 50ms per card
  - Use withSpring for bounce landing
```

---

### Phase 4: Screen-by-Screen Improvements

#### Task 4.1: Add Victory Screen confetti
**File:** `src/components/VictoryScreen.tsx`
**Completion Criteria:** Confetti bursts when victory screen appears
```
- [x] Update VictoryScreen.tsx:
  - Import ConfettiBurst component
  - Trigger confetti on mount (useEffect with empty deps)
  - Position confetti emitter at top-center
  - 50 particles, gold/yellow/white colors
```

#### Task 4.2: Add Victory Screen stat counters
**File:** `src/components/VictoryScreen.tsx`
**Completion Criteria:** Stats animate counting up on appear
```
- [x] Update VictoryScreen.tsx:
  - Import AnimatedCounter component
  - Replace static score/gold/XP numbers with AnimatedCounter
  - Stagger the counters: score starts at 0ms, gold at 300ms, XP at 600ms
  - Add subtle scale pulse on counter completion
```

#### Task 4.3: Soften Game Over screen
**File:** `src/components/Game.tsx` (Game Over section)
**Completion Criteria:** Game over uses muted red, gentle fade-in
```
- [x] Update Game.tsx game over section:
  - Change banner from bright red to muted #CC4444
  - Add fade-in animation for entire modal (opacity 0→1, 400ms)
  - Add encouraging message based on round reached
  - Retry button uses Action Yellow (hopeful, not punishing)
```

#### Task 4.4: Add Level Up confetti and sparkle
**File:** `src/components/LevelUp.tsx`
**Completion Criteria:** Level up screen has celebration effects
```
- [x] Update LevelUp.tsx:
  - Add ConfettiBurst on mount
  - Add sparkle particles around "FREE" badge
  - Sparkles use gold color, float upward
  - 20 sparkles spawned, 3s duration
```

#### Task 4.5: Animate weapon selection glow
**File:** `src/components/LevelUp.tsx` and `src/components/WeaponShop.tsx`
**Completion Criteria:** Selected weapon has pulsing golden glow
```
- [x] Update both files:
  - When weapon is selected/focused: add animated glow
  - Glow pulses opacity (0.4 → 0.7) over 1s, repeating
  - Use GLOWS.selection as base shadow
  - Stop pulse when different weapon selected
```

#### Task 4.6: Add purchase animation to shop
**File:** `src/components/WeaponShop.tsx`
**Completion Criteria:** Purchased weapon animates to inventory bar
```
- [x] Update WeaponShop.tsx:
  - On purchase: weapon icon scales down and translates toward inventory
  - Add particle trail during flight
  - Inventory bar briefly pulses when weapon arrives
  - Total animation ~500ms
```

#### Task 4.7: Enhance Round Summary counters
**File:** `src/components/RoundSummary.tsx`
**Completion Criteria:** All stat numbers use AnimatedCounter with stagger
```
- [x] Update RoundSummary.tsx:
  - Import AnimatedCounter
  - Replace static numbers with AnimatedCounter
  - Stagger: matches 0ms, score 150ms, gold 300ms, XP 450ms
  - Add coin sound placeholder (console.log for now)
```

#### Task 4.8: Add Main Menu parallax effect
**File:** `src/components/MainMenu.tsx`
**Completion Criteria:** Floating cards respond to mouse/tilt with parallax
```
- [x] Update MainMenu.tsx:
  - On web: track mouse position, offset cards based on distance from center
  - Cards further from center move more (parallax layers)
  - Subtle effect: max 10px offset
  - Smooth interpolation using withSpring
  - Optional: mobile tilt support using DeviceMotion (can skip for now)
```

---

### Phase 5: Mobile-Specific Improvements

#### Task 5.1: Add haptic feedback utility
**File:** `src/utils/haptics.ts`
**Completion Criteria:** Utility provides light/medium/heavy haptic functions
```
- [x] Create haptics.ts:
  - Import expo-haptics
  - Export triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error')
  - light: ImpactFeedbackStyle.Light
  - medium: ImpactFeedbackStyle.Medium
  - heavy: ImpactFeedbackStyle.Heavy
  - success: NotificationFeedbackType.Success
  - error: NotificationFeedbackType.Error
  - Wrap in try-catch, no-op on web
```

#### Task 5.2: Add haptics to card selection
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** Card selection triggers light haptic
```
- [x] Update GameBoard.tsx:
  - Import triggerHaptic from haptics.ts
  - On card selection: triggerHaptic('light')
  - On match success: triggerHaptic('success')
  - On match failure: triggerHaptic('error')
```

#### Task 5.3: Add haptics to buttons
**File:** `src/components/ui/AnimatedButton.tsx`
**Completion Criteria:** Button press triggers light haptic
```
- [x] Update AnimatedButton.tsx:
  - Import triggerHaptic
  - On press: triggerHaptic('light')
```

#### Task 5.4: Redesign mobile game header - compact mode
**File:** `src/components/GameInfo.tsx`
**Completion Criteria:** Header uses 2-row layout on mobile with essential stats
```
- [x] Update GameInfo.tsx:
  - Detect mobile via Dimensions or Platform
  - Mobile layout: Row 1 = Health, Timer, Score | Row 2 = Round, Money, Graces, Hints
  - Increase font size on mobile (use body instead of caption)
  - Add proper spacing between stat groups
  - Use SPACING tokens
```

#### Task 5.5: Increase touch targets
**File:** `src/components/Card.tsx`
**Completion Criteria:** Card touch area is at least 48x48px
```
- [x] Update Card.tsx:
  - Wrap TouchableOpacity in View with minHeight/minWidth 48
  - Use hitSlop to extend touch area if needed
  - Ensure no overlapping touch areas in grid
```

---

### Phase 6: Desktop-Specific Improvements

#### Task 6.1: Add hover states to AnimatedButton
**File:** `src/components/ui/AnimatedButton.tsx`
**Completion Criteria:** Button lifts and glows on hover (web only)
```
- [x] Update AnimatedButton.tsx:
  - Add onMouseEnter/onMouseLeave handlers (web only via Platform.OS)
  - On hover: translateY: -2, shadow increases
  - Smooth transition using withSpring
  - Add cursor: 'pointer' style
```

#### Task 6.2: Add hover states to weapon cards
**File:** `src/components/WeaponShop.tsx` and `src/components/LevelUp.tsx`
**Completion Criteria:** Weapon options lift on hover
```
- [x] Update both files:
  - Add hover state tracking for each weapon option
  - On hover: scale(1.02), shadow increase, subtle glow
  - Use Platform.OS check for web-only behavior
```

#### Task 6.3: Add hover to game cards
**File:** `src/components/Card.tsx`
**Completion Criteria:** Cards have subtle hover effect (web only)
```
- [x] Update Card.tsx:
  - Add isHovered state (web only)
  - On hover: faint glow, no scale (to differentiate from selection)
  - Use borderColor shift or very subtle shadow
  - Ensure hover doesn't conflict with selection state
```

#### Task 6.4: Add keyboard shortcuts display
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** Show "Press H for hint" on web
```
- [x] Update GameBoard.tsx:
  - On web: show small hint text near hint button
  - Text: "Press H for hint" in caption size
  - Only show if hints > 0
  - Style: muted color, doesn't distract from gameplay
```

#### Task 6.5: Implement keyboard hint shortcut
**File:** `src/components/Game.tsx`
**Completion Criteria:** Pressing H uses a hint (web only)
```
- [x] Update Game.tsx:
  - Add useEffect with keyboard event listener (web only)
  - On 'h' or 'H' keypress: call useHint function if available
  - Clean up listener on unmount
```

---

### Phase 7: Polish & Refinement

#### Task 7.1: Add page transition wrapper
**File:** `src/components/ScreenTransition.tsx`
**Completion Criteria:** Component fades children in on mount
```
- [x] Create ScreenTransition.tsx:
  - Animated.View wrapper
  - On mount: opacity 0→1, translateY 20→0
  - Duration: DURATION.normal
  - Easing: EASING.easeOutExpo
  - Props: children, style
```

#### Task 7.2: Wrap major screens in ScreenTransition
**Files:** Game.tsx phase renders, MainMenu.tsx, VictoryScreen.tsx
**Completion Criteria:** Screen changes have fade transition
```
- [x] Update screens to use ScreenTransition:
  - CharacterSelection wrapped
  - WeaponShop wrapped
  - LevelUp wrapped
  - RoundSummary wrapped
  - VictoryScreen wrapped
  - Each screen fades in smoothly
```

#### Task 7.3: Add button component to MainMenu
**File:** `src/components/MainMenu.tsx`
**Completion Criteria:** Menu buttons use AnimatedButton
```
- [x] Update MainMenu.tsx:
  - Replace TouchableOpacity buttons with AnimatedButton
  - Keep existing styling but get press animation
  - Adventure = primary variant, others = secondary
```

#### Task 7.4: Ensure reduced motion support
**File:** `src/utils/animation.ts`
**Completion Criteria:** Animations respect prefers-reduced-motion
```
- [x] Update animation.ts:
  - Add prefersReducedMotion check (AccessibilityInfo on native, media query on web)
  - Export useReducedMotion hook
  - When reduced motion: durations become instant, springs become timing
```

#### Task 7.5: Add loading skeleton component
**File:** `src/components/ui/Skeleton.tsx`
**Completion Criteria:** Component shows animated shimmer placeholder
```
- [x] Create Skeleton.tsx:
  - Animated gradient that moves left to right
  - Props: width, height, borderRadius
  - Uses Paper Beige as base, lighter shimmer moving across
  - Infinite animation loop
```

---

### Phase 8: Ambient Life & Idle Animations (THE MAGIC)

> This phase is what separates good from magical. These animations run continuously, making the UI feel alive even when no one is touching it.

#### Task 8.1: Create breathing animation hook
**File:** `src/hooks/useBreathing.ts`
**Completion Criteria:** Hook provides subtle scale oscillation (0.98 → 1.02) on a sine wave
```
- [x] Create useBreathing.ts:
  - Returns animated scale value that oscillates continuously
  - Uses sin wave: scale = 1 + 0.02 * sin(time * speed)
  - Props: speed (default 0.5 = ~4s cycle), intensity (default 0.02)
  - Uses withRepeat + withTiming or requestAnimationFrame
  - Very subtle - should be felt more than seen
```

#### Task 8.2: Create floating animation hook
**File:** `src/hooks/useFloating.ts`
**Completion Criteria:** Hook provides gentle Y-axis floating motion
```
- [x] Create useFloating.ts:
  - Returns animated translateY that floats up/down
  - Sine wave motion: translateY = amplitude * sin(time * speed)
  - Props: amplitude (default 4px), speed (default 0.3), offset (for stagger)
  - offset prop allows multiple items to float out of sync
  - Organic, dreamy feel - like floating on water
```

#### Task 8.3: Add idle card breathing on game board
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** Cards gently breathe when board is idle (no selection for 3+ seconds)
```
- [x] Update GameBoard.tsx:
  - Track lastInteractionTime state
  - After 3s of no selection: enable breathing on all cards
  - Cards breathe at slightly different rates (offset by index)
  - When user selects card: immediately pause breathing
  - Very subtle effect (scale 0.99 → 1.01)
```

#### Task 8.4: Add character icon blinking animation
**File:** `src/components/CharacterIcon.tsx` (create if doesn't exist)
**Completion Criteria:** Character icons occasionally blink (eyes close briefly)
```
- [x] Create or update CharacterIcon.tsx:
  - Every 3-6 seconds (random interval): blink animation
  - Blink = brief squash on Y axis (scaleY 1 → 0.1 → 1 over 150ms)
  - Random timing prevents mechanical feel
  - Optional: double-blink occasionally (20% chance)
  - Makes characters feel alive and watching
```

#### Task 8.5: Add weapon icon shimmer based on rarity
**File:** `src/components/WeaponIcon.tsx` (create if doesn't exist)
**Completion Criteria:** Legendary weapons have constant subtle shimmer, rare have occasional glint
```
- [x] Create or update WeaponIcon.tsx:
  - Legendary: continuous rainbow shimmer animation (slow, 6s cycle)
  - Rare: occasional glint animation every 4-8s (light streak passes across)
  - Common: static, no animation
  - Shimmer is a diagonal light band that passes across icon
  - Creates visual hierarchy - legendaries demand attention
```

#### Task 8.6: Add ambient floating particles to main menu
**File:** `src/components/MainMenu.tsx`
**Completion Criteria:** Subtle sparkle particles drift slowly across background
```
- [x] Update MainMenu.tsx:
  - Spawn 10-15 ambient particles on mount
  - Particles drift slowly (random direction, ~30s to cross screen)
  - Particles are tiny (4-8px), low opacity (0.2-0.4)
  - When particle exits viewport: respawn at random edge
  - Colors: white, pale yellow, pale blue
  - Creates magical, alive atmosphere
```

#### Task 8.7: Add cursor proximity glow effect on game cards
**File:** `src/components/Card.tsx`
**Completion Criteria:** Cards glow slightly brighter when cursor is nearby (web only)
```
- [x] Update Card.tsx (web only):
  - Track cursor position globally
  - Calculate distance from cursor to each card center
  - Cards within 100px of cursor get subtle glow increase
  - Glow intensity = inversely proportional to distance
  - Creates "attention spotlight" effect - UI notices you
  - Smooth interpolation as cursor moves
```

#### Task 8.8: Add anticipation animation to buttons
**File:** `src/components/ui/AnimatedButton.tsx`
**Completion Criteria:** Buttons "inhale" slightly on hover before press
```
- [x] Update AnimatedButton.tsx:
  - On hover start: scale to 1.02 over 200ms (the inhale)
  - Hold at 1.02 while hovering
  - On press: scale to 0.95 (feels like pressing down from elevated state)
  - On release: scale to 1.05 then settle to 1.0
  - Creates anticipation - button is "ready" to be pressed
```

#### Task 8.9: Add score counter idle pulse
**File:** `src/components/GameInfo.tsx`
**Completion Criteria:** Score display has subtle pulse animation when score is high
```
- [x] Update GameInfo.tsx:
  - When score > 500: score display starts gentle pulse
  - Pulse intensity increases with score (max at 1000+)
  - Pulse = scale 1.0 → 1.03 → 1.0 over 1s
  - Color shifts slightly toward gold during pulse
  - Creates excitement - high score feels important
```

#### Task 8.10: Add timer urgency animation
**File:** `src/components/GameInfo.tsx` or timer component
**Completion Criteria:** Timer pulses increasingly fast as time runs out
```
- [x] Update timer display:
  - When < 30s: timer starts gentle pulse (once per 2s)
  - When < 15s: pulse speeds up (once per 1s), color shifts to orange
  - When < 5s: rapid pulse (twice per 1s), color is red, scale 1.05
  - Timer number shakes slightly in final 3 seconds
  - Creates urgency without being annoying
```

#### Task 8.11: Add health heart beat animation
**File:** `src/components/GameInfo.tsx`
**Completion Criteria:** Health hearts pulse like heartbeats, faster when low
```
- [x] Update health display:
  - Hearts have constant gentle "beat" animation (scale pulse)
  - Full health: slow beat (~1 per 2s)
  - Half health: medium beat (~1 per 1s)
  - Low health (1-2 hearts): rapid beat (~2 per 1s), red glow
  - Heartbeat is a quick scale up (1.0 → 1.15) then slow settle
  - Makes health feel visceral and alive
```

#### Task 8.12: Add hint orb floating animation
**File:** `src/components/GameInfo.tsx`
**Completion Criteria:** Hint counter has floating orb animation
```
- [x] Update hint display:
  - Hint icon gently floats up/down (useFloating, 3px amplitude)
  - When hints are available: subtle glow pulse
  - When hint is used: orb "releases" with particle burst
  - Orb color intensity = number of hints available
  - Makes hints feel like magical resources
```

#### Task 8.13: Add idle suggestion animation
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** After 10s idle, a random card gets subtle "try me" pulse
```
- [x] Update GameBoard.tsx:
  - Track idle time (no card selection)
  - After 10s: pick a random card from a valid set
  - That card gets gentle attention pulse (glow + scale)
  - Pulse repeats every 3s until user interacts
  - Very subtle - a nudge, not a hint
  - Stops immediately on any interaction
```

#### Task 8.14: Add weapon inventory breathing
**File:** `src/components/InventoryBar.tsx`
**Completion Criteria:** Weapon icons in inventory bar breathe gently
```
- [x] Update InventoryBar.tsx:
  - All weapon icons have gentle breathing animation
  - Each icon has slight offset (staggered breathing)
  - Legendary weapons breathe slower and larger
  - Creates sense that weapons are powerful, alive
  - Pause breathing during scroll
```

#### Task 8.15: Add background gradient animation to game board
**File:** `src/components/GameBoard.tsx`
**Completion Criteria:** Background has very subtle color shift animation
```
- [x] Update GameBoard.tsx background:
  - Background color shifts very slowly between Paper Beige variants
  - Cycle takes 30-60 seconds (barely noticeable)
  - Optional: color responds to game state (warmer when timer low)
  - Creates subtle environmental life
  - Must be VERY subtle - more felt than seen
```

---

## COMPLETION TRACKING

**Phase 1:** 5/5 complete ✅
**Phase 2:** 6/6 complete ✅
**Phase 3:** 9/9 complete ✅
**Phase 4:** 8/8 complete ✅
**Phase 5:** 5/5 complete ✅
**Phase 6:** 5/5 complete ✅
**Phase 7:** 5/5 complete ✅
**Phase 8:** 15/15 complete ✅

**Total:** 58/58 tasks complete ✅

---

## Success Criteria

When all tasks are marked `[x]`, the UI should:

### The "Alive" Test
- [ ] **Idle Life:** Leave the game untouched for 30 seconds - does it still feel alive? (breathing cards, floating particles, pulsing elements)
- [ ] **Anticipation:** Hover over a button - does it "notice" you before you click?
- [ ] **Organic Motion:** Watch any animation - does it feel natural or mechanical?
- [ ] **Layered Depth:** Move your cursor across the screen - do elements respond at different speeds?
- [ ] **Celebration:** Complete a match - does it feel AMAZING?

### Technical Requirements
- Feel responsive and "juicy" on every interaction
- Have consistent spacing and typography
- Show celebratory effects on achievements
- Work excellently on both desktop and mobile
- Respect accessibility preferences
- Maintain 60fps performance during all animations
- No animation should block user input

### The Gasp Test
> "When someone first opens the app, they should gasp at how beautiful and alive it feels."

---

## Animation Reference

### Idle Animation Intensities
| Element | Animation | Intensity | Cycle |
|---------|-----------|-----------|-------|
| Cards (idle) | Breathing | ±1% scale | 4s |
| Health hearts | Heartbeat | ±15% scale | 2s (normal) |
| Hints orb | Floating | ±3px Y | 3s |
| Weapons | Breathing | ±2% scale | 5s |
| Legendary weapons | Shimmer | 100% | 6s |
| Timer (urgent) | Pulse | ±5% scale | 0.5s |
| Background | Color shift | ±2% | 30s |

### Interaction Animation Timings
| Action | Duration | Easing | Notes |
|--------|----------|--------|-------|
| Button hover | 200ms | easeOutExpo | Scale to 1.02 |
| Button press | 100ms | easeOut | Scale to 0.95 |
| Button release | 250ms | easeOutBack | Scale 1.05→1.0 |
| Card select | 150ms | spring | Scale 1.05, lift 4px |
| Card deselect | 200ms | spring | Bounce settle |
| Match success | 300ms | - | Flash + particles |
| Match failure | 300ms | - | Shake + red flash |
| Screen transition | 400ms | easeOutExpo | Fade + slide |

---

*Run with Ralph Wiggum to complete all tasks autonomously.*
