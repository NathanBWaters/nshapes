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