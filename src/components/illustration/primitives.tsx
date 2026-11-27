import React from 'react';
import { Defs, G, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import { COLORS } from '@/utils/colors';

/** Outline ink shared by every hand-drawn creature, weapon and effect. */
export const STROKE = COLORS.slateCharcoal;

/** Solid-black fill used by the [UI-07] Silhouette Audit mode. */
export const SILHOUETTE_INK = COLORS.deepOnyx;

export interface OverheadShadeDefsProps {
  /** Unique gradient id inside the current <Svg> layer */
  id?: string;
  /** Peak warm top-left highlight opacity (default 0.22) */
  highlightOpacity?: number;
  /** Peak cool bottom-right shadow opacity (default 0.18) */
  shadowOpacity?: number;
}

/**
 * [UI-05] Reusable 2-tone overhead directional lighting gradient `<Defs>`:
 * warm sunlit top-left illumination (`#FFFDF5`) transitioning into a cool
 * bottom-right bounce shadow (`#1E293B`). Static SVG `<Defs>` — zero frame cost.
 */
export function OverheadShadeDefs({
  id = 'nshapes-overhead-shade',
  highlightOpacity = 0.22,
  shadowOpacity = 0.18,
}: OverheadShadeDefsProps) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0.14" y1="0.06" x2="0.86" y2="0.94">
        <Stop offset="0" stopColor="#FFFDF5" stopOpacity={highlightOpacity} />
        <Stop offset="0.46" stopColor="#FFFDF5" stopOpacity={0} />
        <Stop offset="0.62" stopColor="#1E293B" stopOpacity={0} />
        <Stop offset="1" stopColor="#1E293B" stopOpacity={shadowOpacity} />
      </LinearGradient>
    </Defs>
  );
}

export interface TwoToneGradientProps {
  id: string;
  /** Warm upper-left lit tone */
  lit: string;
  /** Primary mid-tone */
  base: string;
  /** Cool lower-right shadow tone */
  shadow: string;
}

/**
 * [UI-05] Three-stop directional coat/shell `<LinearGradient>` anchored to NShapes'
 * upper-left overhead light source (`0.15, 0.05` → `0.85, 0.95`).
 */
export function TwoToneGradient({ id, lit, base, shadow }: TwoToneGradientProps) {
  return (
    <LinearGradient id={id} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
      <Stop offset="0" stopColor={lit} stopOpacity={1} />
      <Stop offset="0.52" stopColor={base} stopOpacity={1} />
      <Stop offset="1" stopColor={shadow} stopOpacity={1} />
    </LinearGradient>
  );
}

export interface StorybookTone {
  id: string;
  /** Warm upper-left sunlit highlight stop */
  lit: string;
  /** Core storybook mid-tone stop */
  base: string;
  /** Cool bottom-right bounce shadow stop */
  shadow: string;
  /** Optional midpoint offset (default `0.52`) */
  midOffset?: number;
}

export interface StorybookGradientProps extends StorybookTone {
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
}

/**
 * Shared 3-stop Tactile Tabletop Storybook `<LinearGradient>` matching Hero Fighters'
 * warm upper-left (`#FFFDF5`) → cool lower-right (`#1E293B`) lighting without runtime
 * node-doubling via `applyOverheadLightingTree`.
 */
export function StorybookGradient({
  id,
  lit,
  base,
  shadow,
  midOffset = 0.52,
  x1 = '0.15',
  y1 = '0.05',
  x2 = '0.85',
  y2 = '0.95',
}: StorybookGradientProps) {
  return (
    <LinearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      <Stop offset="0" stopColor={lit} stopOpacity={1} />
      <Stop offset={String(midOffset)} stopColor={base} stopOpacity={1} />
      <Stop offset="1" stopColor={shadow} stopOpacity={1} />
    </LinearGradient>
  );
}

/** Convenience `<Defs>` wrapper declaring multiple 3-stop storybook gradients cleanly in one pass. */
export function StorybookToneDefs({ tones }: { tones: readonly StorybookTone[] }) {
  return (
    <Defs>
      {tones.map((t) => (
        <StorybookGradient
          key={t.id}
          id={t.id}
          lit={t.lit}
          base={t.base}
          shadow={t.shadow}
          midOffset={t.midOffset}
        />
      ))}
    </Defs>
  );
}

export interface SunlitRimStrokeProps {
  /** SVG path tracing the upper-left backlit edge of the form */
  d: string;
  /** Warm sunlit rim ink (default `#FFFDF5` per `style_guide.md` Pillar 4) */
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

/**
 * Crisp upper-left warm sunlit rim stroke matching Hero Fighters' painted lighting.
 * Automatically stripped by `toSilhouetteTree` in Silhouette Audit mode (`#121212`).
 */
export function SunlitRimStroke({
  d,
  stroke = '#FFFDF5',
  strokeWidth = 2.4,
  opacity = 0.55,
}: SunlitRimStrokeProps) {
  return (
    <Path
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={opacity}
    />
  );
}

const SKIP_SILHOUETTE_TYPES = new Set([
  'Defs',
  'LinearGradient',
  'RadialGradient',
  'Stop',
  'ClipPath',
  'OverheadShadeDefs',
  'TwoToneGradient',
  'StorybookGradient',
  'StorybookToneDefs',
  'SunlitRimStroke',
]);

function elementTypeName(type: unknown): string {
  if (typeof type === 'string') return type;
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || '';
  }
  return '';
}

/**
 * [UI-07] Pure recursive SVG tree transformer for cross-platform solid-black
 * Silhouette Audit (`#121212`). Flattens every opaque shape fill & stroke into
 * solid ink while stripping translucent lighting washes so character silhouettes
 * can be verified cleanly on iOS, Android, Web, and Jest.
 */
export function toSilhouetteTree(node: React.ReactNode): React.ReactNode {
  return React.Children.map(node, (child) => {
    if (!React.isValidElement(child)) return child;

    const props = child.props as Record<string, unknown>;
    const name = elementTypeName(child.type);

    if (SKIP_SILHOUETTE_TYPES.has(name)) {
      return null;
    }

    // Skip subtle translucent shading washes/highlights that shouldn't expand the black contour
    if (typeof props.opacity === 'number' && props.opacity < 0.45) {
      return null;
    }

    const nextProps: Record<string, unknown> = {};

    if (typeof props.fill === 'string' && props.fill !== 'none' && props.fill !== 'transparent') {
      nextProps.fill = SILHOUETTE_INK;
    }
    if (typeof props.stroke === 'string' && props.stroke !== 'none' && props.stroke !== 'transparent') {
      nextProps.stroke = SILHOUETTE_INK;
    }
    if (typeof props.opacity === 'number' && props.opacity >= 0.45) {
      nextProps.opacity = 1;
    }

    if (props.children !== undefined) {
      return React.cloneElement(child, nextProps, toSilhouetteTree(props.children as React.ReactNode));
    }
    return React.cloneElement(child, nextProps);
  });
}

const SHADABLE_SHAPES = new Set(['Path', 'Ellipse', 'Circle', 'Polygon', 'Rect']);

/**
 * [UI-05] & [UI-06] Pure recursive SVG transformer that overlays a matching-geometry
 * 2-tone overhead directional light/shadow gradient onto primary outlined shapes
 * (shapes that have both a solid fill and an ink outline stroke) without ever
 * bleeding outside the creature contour or requiring SVG `<Mask>`.
 * When `isBoss` is true, strengthens outer silhouette contours (`3.6`) while
 * keeping internal texture strokes refined (`<= 2.2`) so massive bosses read
 * with real physical scale density (Sakurai Ep. #063).
 */
export function applyOverheadLightingTree(
  node: React.ReactNode,
  gradId: string,
  isBoss = false
): React.ReactNode {
  return React.Children.map(node, (child, idx) => {
    if (!React.isValidElement(child)) return child;

    const props = child.props as Record<string, unknown>;
    const name = elementTypeName(child.type);

    if (name === 'G' || child.type === React.Fragment) {
      if (props.children !== undefined) {
        return React.cloneElement(
          child,
          {},
          applyOverheadLightingTree(props.children as React.ReactNode, gradId, isBoss)
        );
      }
      return child;
    }

    const strokeWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : 0;
    const hasSolidFill =
      typeof props.fill === 'string' &&
      props.fill !== 'none' &&
      props.fill !== 'transparent' &&
      !props.fill.startsWith('url(');
    const hasOutline =
      typeof props.stroke === 'string' &&
      props.stroke !== 'none' &&
      strokeWidth >= 2.6;

    const el = child as React.ReactElement<Record<string, unknown>>;

    if (SHADABLE_SHAPES.has(name) && hasSolidFill && hasOutline) {
      const baseShape = isBoss
        ? React.cloneElement(el, { strokeWidth: Math.max(3.6, strokeWidth) })
        : el;
      const shadeOverlay = React.cloneElement(el, {
        key: `shade-${idx}`,
        fill: `url(#${gradId})`,
        stroke: 'none',
        strokeWidth: 0,
      });
      return (
        <G key={`lit-${idx}`}>
          {baseShape}
          {shadeOverlay}
        </G>
      );
    }

    if (isBoss && strokeWidth > 0 && strokeWidth < 2.6) {
      return React.cloneElement(el, { strokeWidth: Math.min(2.2, strokeWidth) });
    }

    return child;
  });
}

interface Sparkle4Props {
  cx: number;
  cy: number;
  r: number;
  fill?: string;
  strokeWidth?: number;
}

/** Four-point concave sparkle. */
export function Sparkle4({ cx, cy, r, fill = COLORS.actionYellow, strokeWidth = 1.4 }: Sparkle4Props) {
  return (
    <Path
      d={`M ${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z`}
      fill={fill}
      stroke={STROKE}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  );
}

interface StarBurstProps {
  cx: number;
  cy: number;
  /** Tip radius */
  outer: number;
  /** Notch radius */
  inner: number;
  /** Number of tips (5 = classic star, 8 = impact burst) */
  tips?: number;
  fill?: string;
  strokeWidth?: number;
}

/** Outlined star with `tips` points, first tip pointing up. */
export function StarBurst({
  cx,
  cy,
  outer,
  inner,
  tips = 5,
  fill = COLORS.actionYellow,
  strokeWidth = 1.6,
}: StarBurstProps) {
  const pts: string[] = [];
  for (let i = 0; i < tips * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / tips;
    const dist = i % 2 === 0 ? outer : inner;
    pts.push(`${(cx + Math.cos(angle) * dist).toFixed(1)},${(cy + Math.sin(angle) * dist).toFixed(1)}`);
  }
  return (
    <Polygon
      points={pts.join(' ')}
      fill={fill}
      stroke={STROKE}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  );
}
