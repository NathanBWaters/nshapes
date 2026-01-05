This comprehensive style guide for **NShapes** is based on a "Retro-Modern Enterprise" aesthetic—highly technical, high-contrast, and geometric. It utilizes a bold "construction" color palette (Yellow/Black) grounded by warm off-whites and clean teals.

---

# NShapes UI Style Guide: "The Core Stack"

## 1. Core Color Palette

The visual identity relies on sharp contrast to guide the player's eye. Use these hex codes for consistent UI rendering.

### Primary Colors

* **Action Yellow:** `#FFDE00`
* *Usage:* Primary Call-to-Action (CTA) buttons, critical notification badges, active state indicators, and top-level "Eyebrow" banners.


* **Slate Charcoal:** `#383838`
* *Usage:* Primary text, headers, button borders, iconography strokes, and "Dark Mode" interactive elements.


* **Deep Onyx:** `#121212`
* *Usage:* Main footer backgrounds, terminal windows, and high-intensity contrast areas.


* **Canvas White:** `#FFFFFF`
* *Usage:* Main card backgrounds, modal windows, and primary text when layered over dark colors.



### Secondary & Accent Colors

* **Paper Beige:** `#F4EFEA`
* *Usage:* Layout section backgrounds, alternating row colors in tables, and "unfilled" progress bars.


* **Logic Teal:** `#16AA98`
* *Usage:* Success states, positive data trends, and "Flow" indicators in logic diagrams.


* **Impact Orange:** `#FF9538` (Secondary: `#FF7169`)
* *Usage:* Warnings, logic connectors, and secondary highlights.



---

## 2. Typography

The interface uses a mix of high-legibility sans-serif for navigation and a precise monospace for data.

### Typeface A: `Inter` (Sans-Serif)

* **Role:** Primary UI Font (Menus, Headers, Body text).
* **Weights & Game Usage:**
* **Light (300):** Metadata, subtle tooltips.
* **Regular (400):** Standard body text, lore descriptions.
* **Semi-Bold (600):** Sub-headers, secondary buttons.
* **Bold (700):** Level titles, H1/H2 headers.



### Typeface B: `AeonikMono` (Monospace)

* **Role:** Numerical data tables, coordinates, logic block labels, and terminal outputs.
* **Styling:** Always regular weight. High contrast (Black on White or White on Black).

---

## 3. UI Component Library

### A. Buttons & Interactables

Favor sharp geometry and solid fills over gradients.

**1. Primary CTA ("The Action Button")**

* **Background:** `Action Yellow (#FFDE00)`
* **Text Color:** `Slate Charcoal (#383838)`
* **Typography:** Bold (700), All Caps.
* **Border:** 1px solid `#383838`.
* **Hover State:** Lighten background by 5%; add 2px offset shadow.
* **Shape:** Rectangular with a 4px border-radius.

**2. System/Secondary Button**

* **Background:** Transparent.
* **Border:** 2px Solid `Slate Charcoal (#383838)`.
* **Text Color:** `Slate Charcoal (#383838)`.
* **Hover State:** Invert (Background becomes charcoal, text becomes white).

### B. Cards & Modules

Used for inventory, system upgrades, or mission briefings.

**1. Data Module**

* **Background:** `#FFFFFF`.
* **Border:** 1px Solid `#383838`.
* **Radius:** `12px`.
* **Content:** Hero image at the top, followed by a Bold H3 header and regular body text.

**2. Terminal Overlay**

* **Background:** `Deep Onyx (#121212)`.
* **Border:** Top-weighted bezel in `#383838`.
* **Text:** `#FFFFFF` Monospace.

### C. Iconography & Geometry

* **Style:** Stroke-based (Outline) art.
* **Weight:** 1.5pt to 2pt line width.
* **Shapes:** Heavily geometric. Icons should fit within a square or circular container with consistent padding.

---

## 4. Visual Decorations

### The "Eyebrow" Banner

* **Visual:** A thin 30px-40px high strip at the top of a screen.
* **Color:** `Action Yellow (#FFDE00)`.
* **Text:** Centered, All Caps, Black (`#000000`).

### Connection Logic (Skill Trees / Pipelines)

* **Lines:** Solid `#383838`, 2px width.
* **Connectors:** 90-degree "Pipe" turns. Avoid soft diagonals to maintain the technical "NShapes" feel.
* **Flow Indicators:** Use `Logic Teal` animated dots moving along lines to represent active data/resource flow.

### Graphic Motifs

* **Corner Accents:** 45-degree corner cuts on large containers.
* **Stamps:** Small circular or hexagonal icons used as badges or "Certified" stamps for completed objectives.

---

## 5. Layout Standards

### System Menu (Main Menu)

* **Alignment:** Center-justified text blocks.
* **Visual weight:** 60% White space / 40% High-contrast modules.
* **Action:** Prominent Yellow CTA centered or bottom-aligned.

### Resource Grid (HUD/Inventory)

* **Structure:** Square grid system.
* **Rounded Corners:** Grid items should use a `24px` radius for a "friendly-tech" look.
* **Interaction:** Scale up 1.1x on selection/hover.

---

## 6. Implementation Checklist

1. **High Contrast:** Ensure all interactive elements have a clear outline or solid fill in a primary color.
2. **Corner Consistency:** Use `4px` for buttons, `12px` for modules, and `24px` for top-level screen containers.
3. **Border Logic:** Use `#383838` for all strokes to simulate a technical "blueprinted" look.
4. **Shadows:** Use only subtle, non-colored drop shadows to provide depth to modules.
5. **Tooltips:**
* Background: `#383838`.
* Text: Canvas White.
* Typography: Inter Light (300).



---

## 7. Sample Module Markdown

*(For internal documentation and prototype testing)*

```markdown
<div style="border: 2px solid #383838; border-radius: 12px; padding: 20px; background: #FFFFFF; max-width: 320px; font-family: 'Inter', sans-serif;">
  <div style="background: #F4EFEA; height: 120px; border-radius: 8px; margin-bottom: 12px; border: 1px dashed #383838; display: flex; align-items: center; justify-content: center;">
    <span style="color: #383838; font-weight: 700;">N-SHAPE PREVIEW</span>
  </div>
  <h3 style="color: #383838; margin: 0 0 5px 0; font-weight: 700; text-transform: uppercase;">Standard Logic Module</h3>
  <p style="color: #383838; font-size: 14px; line-height: 1.4; margin-bottom: 15px;">
    Optimized for handling core data throughput and basic logic transformations.
  </p>
  <button style="background: #FFDE00; color: #383838; border: 1px solid #383838; padding: 12px; font-weight: 700; border-radius: 4px; cursor: pointer; width: 100%; text-transform: uppercase;">
    Initialize Module
  </button>
</div>

```

Would you like me to create specific variations for the HUD (Heads-Up Display) or a Pause Menu based on these styles?

---

## 8. Spacing Scale (8px Grid System)

All spacing should use these tokens for consistency:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight spacing, icon gaps |
| `sm` | 8px | Default inner padding, small gaps |
| `md` | 16px | Standard padding, section gaps |
| `lg` | 24px | Large gaps, card padding |
| `xl` | 32px | Section spacing, modal padding |
| `2xl` | 48px | Major section dividers |
| `3xl` | 64px | Screen-level spacing |

---

## 9. Typography Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `caption` | 11px | 400 | 1.2 | Badges, metadata |
| `body-sm` | 13px | 400 | 1.4 | Secondary text, descriptions |
| `body` | 15px | 400 | 1.5 | Standard body text |
| `body-lg` | 17px | 400 | 1.5 | Emphasized body text |
| `h4` | 19px | 600 | 1.3 | Section sub-headers |
| `h3` | 22px | 600 | 1.3 | Card titles, section headers |
| `h2` | 28px | 700 | 1.2 | Screen sub-titles |
| `h1` | 36px | 700 | 1.1 | Screen titles |
| `display` | 48px | 900 | 1.0 | Hero text, victory screens |

---

## 10. Animation Guidelines

### Timing Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `instant` | 100ms | linear | Immediate feedback |
| `fast` | 150ms | easeOut | Micro-interactions, button press |
| `normal` | 250ms | easeOutExpo | Standard transitions |
| `slow` | 400ms | easeOutExpo | Page transitions, reveals |
| `slower` | 600ms | spring | Celebrations, emphasis |

### Easing Curves

```
easeOutExpo: cubic-bezier(0.16, 1, 0.3, 1)     // Snappy, professional
easeOutBack: cubic-bezier(0.34, 1.56, 0.64, 1) // Playful overshoot
spring: { tension: 120, friction: 6 }           // Bouncy, delightful
bounce: { tension: 180, friction: 12 }          // Quick bounce
```

### Animation Principles

1. **Purpose:** Every animation should communicate something
2. **100ms Rule:** All interactions must show feedback within 100ms
3. **Stagger Pattern:** Animate list items 50-100ms apart
4. **Reduced Motion:** Always respect user preferences
5. **Performance:** Use native driver for all animations

---

## 11. Shadow System

### Elevation Levels

| Level | Shadow | Usage |
|-------|--------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle cards |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Raised elements |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Focused elements |

### Glow Effects (Rarity-Based)

```
glow-common:    0 0 8px rgba(56, 56, 56, 0.3)
glow-rare:      0 0 12px rgba(25, 118, 210, 0.4)
glow-legendary: 0 0 16px rgba(255, 149, 56, 0.5)
glow-selection: 0 0 12px rgba(255, 222, 0, 0.6)
```

---

## 12. Platform-Specific Guidelines

### Desktop Optimizations

* **Hover States:** All interactive elements must have hover feedback
  * Buttons: Lighten 5%, lift 2px, increase shadow
  * Cards: Scale 1.02, add glow
  * Links: Underline, color shift

* **Keyboard Navigation:**
  * Visible focus ring (2px offset, Action Yellow)
  * Tab order follows visual hierarchy
  * Enter/Space for activation
  * Escape to dismiss modals

* **Tooltips:**
  * Delay: 400ms before showing
  * Duration: 150ms fade in
  * Position: Above element, centered

* **Cursor:** Always `pointer` on clickable elements

### Mobile Optimizations

* **Touch Targets:** Minimum 48x48px hit area
* **Haptic Feedback:**
  * Light: Selection, hover-equivalent
  * Medium: Success, confirmation
  * Heavy: Error, failure, damage

* **Gestures:**
  * Swipe to dismiss notifications
  * Long-press for details (hover alternative)
  * Pull-to-refresh where applicable

* **Modals:** Use bottom sheets on mobile (slide up from bottom)
* **Safe Areas:** Respect notch and home indicator areas

---

## 13. Micro-Interaction Patterns

### Button Press Sequence

```
1. Press Start (0ms):   scale(0.95), shadow reduce, slight darken
2. Press Hold:          maintain pressed state
3. Release (150ms):     scale(1.02) overshoot, shadow increase
4. Settle (100ms):      scale(1.0), return to default
```

### Card Selection Sequence

```
1. Touch Start:         scale(1.02), add selection shadow
2. Selection Confirm:   Yellow border appears, subtle pulse
3. Third Card Select:   All 3 cards pulse together
4. Match Success:       Burst animation, particles, screen flash
5. Match Failure:       Shake animation, red flash, settle down
```

### Number Counter Animation

```
Duration: 600ms
Easing: easeOutExpo
Steps: Tick through intermediate values
Sound: Satisfying tick on each step
Final: Slight scale pulse on completion
```

---

## 14. Sound Design Guidelines

### Volume Hierarchy

| Category | Volume | Notes |
|----------|--------|-------|
| Effects | 70% | Game actions, explosions |
| UI | 50% | Button clicks, navigation |
| Music | 40% | Background, ducks during effects |

### Sound Characteristics

* **Style:** Clean, technical, satisfying
* **Duration:** Short (50-200ms for UI, 300-800ms for effects)
* **Layering:** Multiple sounds can play simultaneously
* **Variation:** Slight pitch/timing variations prevent repetition fatigue

### Key Sounds Needed

* Button click (soft, satisfying)
* Card select (subtle pop)
* Match success (triumphant chime)
* Match failure (gentle error)
* Explosion (impactful boom)
* Laser (sci-fi beam)
* Coin collect (satisfying clink)
* Level up (celebratory jingle)
* Victory (fanfare)
* Timer warning (escalating tension)

---

## 15. Particle Effect Guidelines

### Particle Types

| Type | Use Case | Physics |
|------|----------|---------|
| Sparkle | Success, highlights | Float upward, fade |
| Confetti | Victory, celebrations | Fall with gravity, rotate |
| Explosion | Card destruction | Burst outward, fade |
| Smoke | Fire effects | Rise slowly, expand, fade |
| Coin | Rewards | Arc toward counter |

### Performance Guidelines

* Pool particles (reuse, don't recreate)
* Limit simultaneous particles (50 max)
* Use native driver for all particle animations
* Reduce particle count on low-end devices