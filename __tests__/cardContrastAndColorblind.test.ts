/**
 * Verification suite for [UI-08], [UI-09], [UI-10], [UI-11], [UI-12], and [UI-14]:
 * - WCAG 2.1 contrast ratios (>=3.0:1 card graphical shapes, >=4.5:1 button surfaces)
 * - Grayscale luminance stagger (>=8% pairwise separation across all 4 card palettes)
 * - Viénot 1999 CVD simulation RGB distances (>=90 across Protanopia / Deuteranopia / Tritanopia)
 * - 1:1 Colorblind Orange (O) / Blue (B) / Plum (P) & 5th-attribute W/T/D propagation
 * - Double-stroke selection frame & removal of all 4 card border-rule violations
 * - Non-colliding card badge zones, capped hazard tray (<=2 + +N), >=14px hazard icons
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import Card, { CARD_HAZARD_ICON_SIZE, CardBoardProvider, MAX_VISIBLE_STATE_CHIPS } from '@/components/Card';
import OptionsMenu from '@/components/OptionsMenu';
import { GearChips, gearModifiers, wantedLabel } from '@/adventure/components/GearChips';
import HudInspector from '@/adventure/components/HudInspector';
import { parryCounterMeta } from '@/adventure/data/parry';
import {
  computeLiveGuidance,
  describeSingleCardTraits,
  describeValidSetWhy,
  evaluateTripleTraits,
  explainInvalidPick,
  predictThirdCard,
} from '@/adventure/coach';
import { getLevel } from '@/adventure/data/levels';
import { createRun } from '@/adventure/engine/run';
import { createNewSave } from '@/adventure/progress';
import { COLORS } from '@/utils/colors';
import {
  CARD_PALETTES,
  COLORBLIND_COLOR_CODES,
  COLORBLIND_COLOR_LABELS,
  cardBgPatternMeta,
  cardColorCode,
  cardColorHex,
  cardColorLabel,
  formatChallengeText,
} from '@/utils/cardColors';
import { BACKGROUND_COLORS } from '@/utils/gameConfig';
import { ColorblindStorage, storage } from '@/utils/storage';
import type { Card as CardType, Color } from '@/types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : () => undefined) });
  return { sfx: () => undefined, music: band, band, setMusicEnabled: () => undefined, setSfxOverride: () => undefined };
});

jest.mock('@/components/fighters', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ character }: { character: string }) =>
      R.createElement(View, { accessibilityLabel: `fighter-avatar-${character}` }),
  };
});

jest.mock('@/components/enemies', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ enemy }: { enemy?: { name?: string } }) =>
      R.createElement(View, { accessibilityLabel: `enemy-avatar-${enemy?.name ?? 'foe'}` }),
  };
});

jest.mock('@/components/Icon', () => {
  const R = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name, size, color }: { name: string; size?: number; color?: string }) =>
    R.createElement(View, {
      testID: `mock-icon-${name}`,
      accessibilityLabel: `icon-${name}`,
      iconSize: size,
      iconColor: color,
    });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('react-native-svg', () => {
  const R = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: any) => R.createElement(View, props, props?.children);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy(
    { __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, any>,
    {
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
        return target[prop];
      },
    }
  );
});

// ─── WCAG 2.1 Luminance, Contrast & Viénot 1999 CVD Math ────────────────────

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

const srgbToLinear = (c255: number): number => {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const linearToSrgb = (lin: number): number => {
  const clamped = Math.max(0, Math.min(1, lin));
  const c = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return c * 255;
};

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (hexA: string, hexB: string): number => {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// Viénot, Brettel & Mollon (1999) linearized-sRGB CVD simulation matrices
type CvdKind = 'protan' | 'deutan' | 'tritan';
const VIENOT_MATRICES: Record<CvdKind, readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const simulateCvdRgb = (hex: string, kind: CvdKind): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const m = VIENOT_MATRICES[kind];
  const sr = m[0][0] * r + m[0][1] * g + m[0][2] * b;
  const sg = m[1][0] * r + m[1][1] * g + m[1][2] * b;
  const sb = m[2][0] * r + m[2][1] * g + m[2][2] * b;
  return [linearToSrgb(sr), linearToSrgb(sg), linearToSrgb(sb)];
};

const rgbDistance = (a: [number, number, number], b: [number, number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const minPairwiseCvdDistance = (hexes: readonly string[], kind: CvdKind): number => {
  const sims = hexes.map(h => simulateCvdRgb(h, kind));
  let min = Infinity;
  for (let i = 0; i < sims.length; i++) {
    for (let j = i + 1; j < sims.length; j++) {
      min = Math.min(min, rgbDistance(sims[i], sims[j]));
    }
  }
  return min;
};

const minPairwiseLuminanceStep = (hexes: readonly string[]): number => {
  const lums = hexes.map(relativeLuminance).sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < lums.length; i++) {
    min = Math.min(min, lums[i] - lums[i - 1]);
  }
  return min;
};

const mkCard = (overrides: Partial<CardType> = {}): CardType => ({
  id: 'c-1',
  shape: 'oval',
  color: 'red',
  number: 2,
  shading: 'solid',
  background: 'white',
  selected: false,
  ...overrides,
});

function collectNodes(node: any, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;
  out.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectNodes(child, out);
  }
  return out;
}

describe('[UI-08] [UI-09] [UI-14] WCAG Contrast, Grayscale Stagger & Viénot CVD Separation', () => {
  it('replaces #808080 beige with warm parchment #F5E8C8 (~81.3% lum) and keeps >=3.0:1 graphical contrast on every card surface', () => {
    expect(BACKGROUND_COLORS.white).toBe('#FFFFFF');
    expect(BACKGROUND_COLORS.beige).toBe('#F5E8C8');
    expect(BACKGROUND_COLORS.charcoal).toBe('#383838');

    const beigeLum = relativeLuminance(BACKGROUND_COLORS.beige);
    expect(beigeLum).toBeGreaterThan(0.8);
    expect(beigeLum).toBeLessThan(0.83);

    const colors: Color[] = ['red', 'green', 'purple'];
    for (const cb of [false, true]) {
      for (const c of colors) {
        const lightHex = cardColorHex(c, 'white', cb);
        expect(contrastRatio(lightHex, BACKGROUND_COLORS.white)).toBeGreaterThanOrEqual(3.0);
        expect(contrastRatio(lightHex, BACKGROUND_COLORS.beige)).toBeGreaterThanOrEqual(3.0);

        const darkHex = cardColorHex(c, 'charcoal', cb);
        expect(contrastRatio(darkHex, BACKGROUND_COLORS.charcoal)).toBeGreaterThanOrEqual(3.0);
      }
    }
  });

  it('staggers grayscale luminance by >=8% across all 3 colors in every card palette', () => {
    const palettes = [
      Object.values(CARD_PALETTES.standard.light),
      Object.values(CARD_PALETTES.standard.dark),
      Object.values(CARD_PALETTES.colorblind.light),
      Object.values(CARD_PALETTES.colorblind.dark),
    ];
    for (const triplet of palettes) {
      expect(minPairwiseLuminanceStep(triplet)).toBeGreaterThanOrEqual(0.08);
    }
  });

  it('maintains Viénot Protanopia, Deuteranopia, and Tritanopia RGB distance >= 90 across all Colorblind & Standard Light palettes', () => {
    const cvdKinds: CvdKind[] = ['protan', 'deutan', 'tritan'];
    const cbLight = Object.values(CARD_PALETTES.colorblind.light);
    const cbDark = Object.values(CARD_PALETTES.colorblind.dark);
    const stdLight = Object.values(CARD_PALETTES.standard.light);

    for (const kind of cvdKinds) {
      expect(minPairwiseCvdDistance(cbLight, kind)).toBeGreaterThanOrEqual(90);
      expect(minPairwiseCvdDistance(cbDark, kind)).toBeGreaterThanOrEqual(90);
      expect(minPairwiseCvdDistance(stdLight, kind)).toBeGreaterThanOrEqual(90);
    }
  });

  it('verifies >=4.5:1 WCAG AA contrast for all white-on-surface button tokens and high-contrast double-stroke selection', () => {
    expect(COLORS.tealSurface).toBe('#0F766E');
    expect(COLORS.redSurface).toBe('#DC2626');
    expect(COLORS.orangeSurface).toBe('#C2410C');

    expect(contrastRatio('#FFFFFF', COLORS.tealSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', COLORS.redSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', COLORS.orangeSurface)).toBeGreaterThanOrEqual(4.5);

    // Double-stroke selection: outer #121212 + inner #FFDE00
    expect(contrastRatio(COLORS.deepOnyx, BACKGROUND_COLORS.white)).toBeGreaterThanOrEqual(15);
    expect(contrastRatio(COLORS.deepOnyx, BACKGROUND_COLORS.beige)).toBeGreaterThanOrEqual(14);
    expect(contrastRatio(COLORS.deepOnyx, COLORS.actionYellow)).toBeGreaterThanOrEqual(13);
    expect(contrastRatio(COLORS.actionYellow, BACKGROUND_COLORS.charcoal)).toBeGreaterThanOrEqual(8);
  });
});

describe('[UI-10] End-to-End 1:1 Colorblind Propagation (Orange (O) / Blue (B) / Plum (P) & 5th Attribute W/T/D)', () => {
  beforeEach(() => {
    storage.clearAll();
    ColorblindStorage.set(false);
  });

  afterEach(() => {
    ColorblindStorage.set(false);
  });

  it('aligns labels, single-letter codes, parry metadata, GearChips, and coach output 1:1', () => {
    expect(COLORBLIND_COLOR_CODES).toEqual({ red: 'O', green: 'B', purple: 'P' });
    expect(COLORBLIND_COLOR_LABELS).toEqual({ red: 'orange', green: 'blue', purple: 'plum' });

    const expected: Record<Color, { label: string; code: string; hex: string }> = {
      red: { label: 'orange', code: 'O', hex: '#D55E00' },
      green: { label: 'blue', code: 'B', hex: '#0064A8' },
      purple: { label: 'plum', code: 'P', hex: '#5E1742' },
    };

    for (const c of ['red', 'green', 'purple'] as Color[]) {
      const exp = expected[c];
      expect(cardColorLabel(c, true)).toBe(exp.label);
      expect(cardColorCode(c, true)).toBe(exp.code);
      expect(cardColorHex(c, 'white', true)).toBe(exp.hex);

      // Parry counter metadata matches 1:1
      const parry = parryCounterMeta({ kind: 'color', color: c }, true);
      expect(parry.shortLabel).toBe(`ALL ${exp.label.toUpperCase()} (${exp.code})`);
      expect(parry.color).toBe(exp.hex);
      expect(parry.explain.toLowerCase()).toContain(`${exp.label} (${exp.code.toLowerCase()})`);

      // GearChips wantedLabel matches 1:1
      expect(wantedLabel('color', c, true)).toBe(`${exp.label} (${exp.code})`);
      expect(wantedLabel('color', c, false)).toBe(c);
    }

    // Standard mode keeps red / green / purple unchanged
    expect(parryCounterMeta({ kind: 'color', color: 'green' }, false).shortLabel).toBe('ALL GREEN');
    expect(formatChallengeText('Make 2 all-red Sets', true)).toBe('Make 2 all-orange (O) Sets');
    expect(formatChallengeText('Make 2 all-green Sets', true)).toBe('Make 2 all-blue (B) Sets');
    expect(formatChallengeText('Make 2 all-purple Sets', true)).toBe('Make 2 all-plum (P) Sets');
    expect(formatChallengeText('Make 2 all-red Sets', false)).toBe('Make 2 all-red Sets');
  });

  it('propagates Colorblind Orange/Blue/Plum through all coach.ts helpers and live guidance', () => {
    const c1 = mkCard({ id: 'a', shape: 'diamond', color: 'red', number: 1 });
    const c2 = mkCard({ id: 'b', shape: 'oval', color: 'red', number: 2 });
    const c3Bad = mkCard({ id: 'c', shape: 'squiggle', color: 'green', number: 3 });
    const c3Good = mkCard({ id: 'd', shape: 'squiggle', color: 'red', number: 3 });

    expect(explainInvalidPick([c1, c2, c3Bad], ['shape', 'color'], 'Orange Tabby', true)).toBe(
      'Almost! Color was 2 orange + 1 blue.'
    );
    expect(describeValidSetWhy([c1, c2, c3Good], ['shape', 'color'], true)).toBe(
      'All orange, all different shapes.'
    );
    expect(evaluateTripleTraits([c1, c2, c3Bad], ['shape', 'color'], true)[0].label).toBe(
      'Color: 2 orange + 1 blue'
    );
    expect(describeSingleCardTraits(c3Bad, ['shape', 'color'], true)[0].detail).toBe('blue');

    const pred = predictThirdCard([c1, c2], ['shape', 'color'], [c1, c2, c3Good], true)!;
    expect(pred.neededSummary).toBe('an orange squiggle');
    expect(pred.pills[0].label).toBe('Color: same → orange');

    const run = createRun(getLevel('1-1'), createNewSave(), { seed: 42 });
    const step = computeLiveGuidance(run, { colorblind: true })!;
    expect(step.message).not.toMatch(/\b(red|green|purple)\b/i);
    expect(step.message).toMatch(/\b(orange|blue|plum)\b/i);
  });

  it('renders Card O/B/P badge, Colorblind accessibilityLabel, 5th-attribute W/T/D tags, and hue-neutral locked overlays', () => {
    ColorblindStorage.set(true);

    // Green card on beige parchment with 5th attribute active -> B + T + parchment pattern + bg pattern + accessible blue/tinted
    const greenBeige = render(
      React.createElement(
        CardBoardProvider,
        { overlay: { backgroundAttributeActive: true }, clockMs: null },
        React.createElement(Card, {
          card: mkCard({ color: 'green', background: 'beige', bonusMoney: 2 }),
          onClick: () => {},
        })
      )
    );
    expect(greenBeige.getByTestId('card-colorblind-badge')).toHaveTextContent('B');
    expect(greenBeige.getByTestId('card-bg-code-badge')).toHaveTextContent('T');
    expect(greenBeige.getByTestId('card-parchment-pattern')).toBeTruthy();
    expect(greenBeige.getByTestId('card-bg-pattern')).toBeTruthy();
    expect(greenBeige.getByTestId('card-coin-badge')).toHaveTextContent('+2¢');
    // Top-left badges sit horizontally side-by-side (never vertically stacked down into shapes)
    expect(StyleSheet.flatten(greenBeige.getByTestId('card-top-left-row').props.style).flexDirection).toBe('row');
    expect(greenBeige.getByLabelText(/2 blue solid oval on tinted \(T\)/)).toBeTruthy();
    greenBeige.unmount();

    // Red card on charcoal -> O + D + diagonal-hatch pattern
    const redDark = render(
      React.createElement(
        CardBoardProvider,
        { overlay: { backgroundAttributeActive: true }, clockMs: null },
        React.createElement(Card, {
          card: mkCard({ color: 'red', background: 'charcoal' }),
          onClick: () => {},
        })
      )
    );
    expect(redDark.getByTestId('card-colorblind-badge')).toHaveTextContent('O');
    expect(redDark.getByTestId('card-bg-code-badge')).toHaveTextContent('D');
    expect(redDark.getByTestId('card-bg-pattern')).toBeTruthy();
    expect(cardBgPatternMeta('charcoal', true).pattern).toBe('diagonal-hatch');
    expect(cardBgPatternMeta('beige', true).pattern).toBe('dots');
    expect(cardBgPatternMeta('white', true).pattern).toBe('none');
    redDark.unmount();

    // Locked cursed & frozen cards use hue-neutral SVG overlays with ZERO translucent purple/cyan washes
    for (const lockedCard of [
      mkCard({ id: 'cursed', locked: true, cursedUntil: 9000 }),
      mkCard({ id: 'frozen', locked: true, frozen: 2 }),
    ]) {
      const view = render(React.createElement(Card, { card: lockedCard, onClick: () => {} }));
      const lockedOverlay = view.getByTestId('card-locked');
      const flat = StyleSheet.flatten(lockedOverlay.props.style) ?? {};
      expect(flat.backgroundColor).toBeUndefined();
      expect(view.getByTestId('card-locked-badge')).toBeTruthy();
      view.unmount();
    }
  });

  it('propagates live Colorblind labels & verified hexes into GearChips and HudInspector parry view', () => {
    ColorblindStorage.set(true);

    const save = {
      ...createNewSave(),
      armory: ['bounty-poster'],
      charms: ['bounty-poster'],
    };
    const baseRun = createRun(getLevel('2-9'), save, { seed: 7, features: new Set(['hearts', 'gear']) });
    const runWithGreenBounty = {
      ...baseRun,
      gear: { ...baseRun.gear, bounty: { attribute: 'color' as const, value: 'green', left: 2 } },
    };
    const mods = gearModifiers(runWithGreenBounty);
    const chips = render(React.createElement(GearChips, { run: runWithGreenBounty, mods }));
    expect(chips.getByTestId('run-bounty-chip')).toHaveTextContent('blue (B) · 2');
    const dotStyle = StyleSheet.flatten(chips.getByTestId('run-bounty-color-dot').props.style);
    expect(dotStyle.backgroundColor).toBe('#0064A8');
    chips.unmount();

    // Level 2-9 (Prism Burst) has `{ kind: 'color', color: 'green' }` parry counter -> ALL BLUE (B)
    const inspector = render(
      React.createElement(HudInspector, {
        target: { kind: 'foe' },
        run: runWithGreenBounty,
        shownHp: runWithGreenBounty.foeHp,
        challenge: { text: 'Make 2 all-green Sets', met: false, failed: false },
        onClose: () => {},
      })
    );
    expect(inspector.getByText(/COUNTER: ALL BLUE \(B\)/)).toBeTruthy();
    inspector.unmount();
  });
});

describe('[UI-11] [UI-12] [UI-14] Double-Stroke Selection, Zero Border Violations, Badge Zones & Options WCAG', () => {
  beforeEach(() => {
    storage.clearAll();
    ColorblindStorage.set(false);
  });

  it('renders high-contrast double-stroke selection border + checkmark pip and removes all 4 border-rule violations', () => {
    // 1. Selected card: outer #121212 border + inset #FFDE00 ring + ✓ pip
    const selectedView = render(
      React.createElement(Card, { card: mkCard({ selected: true }), onClick: () => {} })
    );
    const cardRoot = selectedView.getByTestId('card-oval-red-2-solid');
    expect(StyleSheet.flatten(cardRoot.props.style).borderColor).toBe(COLORS.deepOnyx);
    expect(StyleSheet.flatten(selectedView.getByTestId('card-selected-ring').props.style).borderColor).toBe(
      COLORS.actionYellow
    );
    expect(selectedView.getByTestId('card-selected-check')).toHaveTextContent('✓');
    selectedView.unmount();

    // 2. Violations #1 & #2 removed: Bomb & Countdown cards keep standard slateCharcoal border
    const bombView = render(
      React.createElement(Card, {
        card: mkCard({ hasBomb: true, bombTimer: 4, hasCountdown: true, countdownTimer: 3 }),
        onClick: () => {},
      })
    );
    const bombCardRoot = bombView.getByTestId('card-oval-red-2-solid-bomb-countdown');
    expect(StyleSheet.flatten(bombCardRoot.props.style).borderColor).toBe(COLORS.slateCharcoal);
    // Urgent bomb timer pill uses WCAG AA redSurface fill (#DC2626)
    expect(StyleSheet.flatten(bombView.getByTestId('card-timer-bomb').props.style).backgroundColor).toBe(
      COLORS.redSurface
    );
    bombView.unmount();

    // 3. Violations #3 & #4 removed: Mirror & Tightrope use non-border triangular corner ear-tabs
    const slotView = render(
      React.createElement(Card, {
        card: mkCard(),
        mirrorSlot: true,
        tightropeSlot: true,
        onClick: () => {},
      })
    );
    const mirrorTab = StyleSheet.flatten(slotView.getByTestId('card-mirror-frame').props.style);
    const tightropeTab = StyleSheet.flatten(slotView.getByTestId('card-tightrope-frame').props.style);
    expect(mirrorTab.borderWidth).toBeUndefined();
    expect(mirrorTab.borderColor).toBeUndefined();
    expect(tightropeTab.borderWidth).toBeUndefined();
    expect(tightropeTab.borderColor).toBeUndefined();
    expect(mirrorTab.width).toBe(14);
    expect(tightropeTab.width).toBe(14);
    slotView.unmount();
  });

  it('separates armor health pips from top-right Catalyst, caps bottom-left hazard chips to 2 + overflow, and enforces >=14px hazard icons', () => {
    expect(MAX_VISIBLE_STATE_CHIPS).toBe(2);
    expect(CARD_HAZARD_ICON_SIZE).toBeGreaterThanOrEqual(14);

    // Armored Catalyst card + 5 simultaneous hazards/states
    const heavyCard = mkCard({
      health: 3,
      hasEvolutionItem: true,
      evolutionReady: true,
      hasBomb: true,
      bombTimer: 9,
      snare: 'right',
      onFire: true,
      magnet: true,
      twinOf: 'other-card',
    });

    const view = render(
      React.createElement(Card, { card: heavyCard, catalystLabel: 'Wildfire', onClick: () => {} })
    );

    // Health badge sits in top-center (NOT top-right) with WCAG redSurface background
    const health = view.getByTestId('card-health-badge');
    const healthStyle = StyleSheet.flatten(health.props.style);
    expect(healthStyle.backgroundColor).toBe(COLORS.redSurface);
    expect(healthStyle.right).toBeUndefined();

    // Catalyst badge stays cleanly in top-right
    const catalyst = view.getByTestId('card-evolution-catalyst');
    const catalystStyle = StyleSheet.flatten(catalyst.props.style);
    expect(catalystStyle.right).toBe(2);
    expect(catalystStyle.top).toBe(2);

    // Bottom-left tray shows top 2 priority hazards (bomb + snare) + '+3' overflow pill
    expect(view.getByTestId('card-timer-bomb')).toBeTruthy();
    expect(view.getByTestId('card-state-overflow')).toHaveTextContent('+3');

    // Snare arrow icon size is >= 14px
    const snareIcon = view.getByTestId('mock-icon-delapouite/plain-arrow');
    expect(snareIcon.props.iconSize).toBeGreaterThanOrEqual(14);
    view.unmount();
  });

  it('uses WCAG-AA tealSurface / redSurface tokens and updated O/B/P copy in OptionsMenu', () => {
    const view = render(React.createElement(OptionsMenu, { visible: true, onClose: () => {} }));
    expect(view.getByText('High-contrast palette & O/B/P labels')).toBeTruthy();

    // Verify header and ON toggles use tealSurface (#0F766E)
    const nodes = collectNodes(view.toJSON());
    const tealHeader = nodes.find(
      n => n.type === 'View' && StyleSheet.flatten(n.props?.style)?.backgroundColor === COLORS.tealSurface
    );
    expect(tealHeader).toBeTruthy();

    // Open confirm reset -> START OVER button uses redSurface (#DC2626)
    fireEvent.press(view.getByTestId('options-reset-game'));
    const confirmBtn = view.getByTestId('options-reset-confirm');
    expect(StyleSheet.flatten(confirmBtn.props.style).backgroundColor).toBe(COLORS.redSurface);
    view.unmount();
  });
});
