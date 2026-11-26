import React, { createContext, memo, useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Polygon, Rect } from 'react-native-svg';
import { Card as CardType, Background } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import {
  cardBgPatternMeta,
  cardColorCode,
  cardColorHex,
  cardColorLabel,
  useColorblind,
} from '@/utils/cardColors';
import {
  CARD_SHAPE_GEOMETRY,
  CARD_STOCK_BORDER,
  CARD_STRIPE_PITCH,
  CARD_STROKE_WIDTH,
  CARD_SVG_HEIGHT,
  CARD_SVG_WIDTH,
  formatShapeName,
  getCardShapeColor,
  getCardStockBackground,
} from '@/utils/cardVisuals';
import { useBurnTimer } from '@/hooks/useBurnTimer';
import Icon, { type IconName } from './Icon';

/** Board-level static visual overlays (Mirror Shard, Tightrope, Catalyst target, Hot Potato timestamp, 5th background attribute). */
export interface CardBoardOverlay {
  mirrorCardIds?: ReadonlySet<string>;
  tightropeCardIds?: ReadonlySet<string>;
  catalystRecipeName?: string | null;
  potatoAtMs?: number;
  /** True when the 5th `background` attribute is active so White/Tinted/Dark codes render consistently in Colorblind Mode. */
  backgroundAttributeActive?: boolean;
}

const DEFAULT_CARD_BOARD_OVERLAY: CardBoardOverlay = {};
const CardBoardContext = createContext<CardBoardOverlay>(DEFAULT_CARD_BOARD_OVERLAY);
/** Whole-second fight clock (ms), ONLY subscribed to by timed Gamble countdown badges so plain Cards never re-render on ticks. */
const CardBoardClockContext = createContext<number | null>(null);

export const CardBoardProvider: React.FC<{
  overlay: CardBoardOverlay;
  clockMs: number | null;
  children?: React.ReactNode;
}> = ({ overlay, clockMs, children }) => (
  <CardBoardContext.Provider value={overlay}>
    <CardBoardClockContext.Provider value={clockMs}>{children}</CardBoardClockContext.Provider>
  </CardBoardContext.Provider>
);

const computeCountdownSec = (targetMs: number | undefined, elapsedMs: number | null): number | null => {
  if (targetMs === undefined || elapsedMs === null || !Number.isFinite(targetMs)) return null;
  return Math.max(0, Math.ceil((targetMs - elapsedMs) / 1000));
};

/** Max simultaneous bottom-left hazard/state chips before folding overflow into a `+N` pill. */
export const MAX_VISIBLE_STATE_CHIPS = 2;

/** Minimum hazard/state icon size (px) for mobile readability ([UI-12]). */
export const CARD_HAZARD_ICON_SIZE = 14;

interface GambleTimerBadgeProps {
  kind: 'thorn' | 'fuse' | 'curse' | 'potato';
  icon: IconName;
  targetMs: number;
  elapsedMsOverride?: number;
  hot?: boolean;
  urgentAtSec?: number;
  normalColor: string;
  normalBg: string;
  normalBorder: string;
}

const GambleTimerBadge: React.FC<GambleTimerBadgeProps> = memo(function GambleTimerBadge({
  kind,
  icon,
  targetMs,
  elapsedMsOverride,
  hot = false,
  urgentAtSec,
  normalColor,
  normalBg,
  normalBorder,
}) {
  const ctxClock = useContext(CardBoardClockContext);
  const nowMs = elapsedMsOverride !== undefined ? elapsedMsOverride : ctxClock;
  const secs = computeCountdownSec(targetMs, nowMs);
  const urgent = hot || (secs !== null && urgentAtSec !== undefined && secs <= urgentAtSec);
  const color = urgent ? '#FFFFFF' : normalColor;
  const bg = urgent ? COLORS.redSurface : normalBg;
  const border = urgent ? '#991B1B' : normalBorder;
  const label = secs !== null ? (hot ? `${secs}s!` : `${secs}s`) : undefined;

  return (
    <View
      testID={`card-timer-${kind}`}
      style={[styles.stateIndicator, styles.timerPill, { backgroundColor: bg, borderColor: border }]}
    >
      <Icon name={icon} size={CARD_HAZARD_ICON_SIZE} color={color} noShadow />
      {label !== undefined && (
        <Text style={[styles.stateIndicatorLabel, styles.timerPillLabel, { color }]}>{label}</Text>
      )}
    </View>
  );
});

const FogTimerBadge: React.FC<{ targetMs: number; elapsedMsOverride?: number }> = memo(function FogTimerBadge({
  targetMs,
  elapsedMsOverride,
}) {
  const ctxClock = useContext(CardBoardClockContext);
  const nowMs = elapsedMsOverride !== undefined ? elapsedMsOverride : ctxClock;
  const secs = computeCountdownSec(targetMs, nowMs);
  if (secs === null) return null;
  return (
    <View testID="card-timer-fog" style={styles.fogTimerBadge} pointerEvents="none">
      <Text style={styles.fogTimerText}>{secs}s</Text>
    </View>
  );
});

/** Subtle built-in perimeter dot pattern for Blueprint Mist (#E2ECF7) cards — keeps central shapes uncluttered. */
const MistPerimeterPattern: React.FC = memo(function MistPerimeterPattern() {
  return (
    <View testID="card-mist-pattern" pointerEvents="none" style={styles.patternLayer}>
      <Svg width="100%" height="100%" viewBox="0 0 100 130" preserveAspectRatio="none">
        {/* Top & bottom perimeter dots */}
        {[12, 24, 36, 48, 60, 72, 84].map(x => (
          <React.Fragment key={`tb-${x}`}>
            <Circle cx={x} cy={6} r={1.3} fill="rgba(59, 102, 155, 0.2)" />
            <Circle cx={x + 4} cy={124} r={1.3} fill="rgba(59, 102, 155, 0.2)" />
          </React.Fragment>
        ))}
        {/* Left & right perimeter dots */}
        {[18, 32, 46, 60, 74, 88, 102, 114].map(y => (
          <React.Fragment key={`lr-${y}`}>
            <Circle cx={5.5} cy={y} r={1.3} fill="rgba(59, 102, 155, 0.2)" />
            <Circle cx={94.5} cy={y} r={1.3} fill="rgba(59, 102, 155, 0.2)" />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
});

/** Colorblind 5th-attribute corner hatch (`dots` for Blueprint Mist, `diagonal-hatch` for charcoal, `none` for white). */
const ColorblindBgCornerPattern: React.FC<{ pattern: 'dots' | 'diagonal-hatch' }> = memo(
  function ColorblindBgCornerPattern({ pattern }) {
    if (pattern === 'dots') {
      return (
        <View testID="card-bg-pattern" pointerEvents="none" style={styles.patternLayer}>
          <Svg width="100%" height="100%" viewBox="0 0 100 130" preserveAspectRatio="none">
            {/* Subtle corner dot clusters */}
            <Circle cx={8} cy={118} r={1.8} fill="rgba(59, 102, 155, 0.38)" />
            <Circle cx={15} cy={122} r={1.8} fill="rgba(59, 102, 155, 0.38)" />
            <Circle cx={92} cy={118} r={1.8} fill="rgba(59, 102, 155, 0.38)" />
            <Circle cx={85} cy={122} r={1.8} fill="rgba(59, 102, 155, 0.38)" />
            <Circle cx={92} cy={12} r={1.8} fill="rgba(59, 102, 155, 0.38)" />
            <Circle cx={85} cy={8} r={1.8} fill="rgba(59, 102, 155, 0.38)" />
          </Svg>
        </View>
      );
    }
    return (
      <View testID="card-bg-pattern" pointerEvents="none" style={styles.patternLayer}>
        <Svg width="100%" height="100%" viewBox="0 0 100 130" preserveAspectRatio="none">
          {/* Corner diagonal hatch lines only — central shapes remain completely clear */}
          <Line x1={82} y1={2} x2={98} y2={18} stroke="rgba(255, 255, 255, 0.28)" strokeWidth={1.6} />
          <Line x1={89} y1={2} x2={98} y2={11} stroke="rgba(255, 255, 255, 0.28)" strokeWidth={1.6} />
          <Line x1={2} y1={112} x2={18} y2={128} stroke="rgba(255, 255, 255, 0.28)" strokeWidth={1.6} />
          <Line x1={2} y1={119} x2={11} y2={128} stroke="rgba(255, 255, 255, 0.28)" strokeWidth={1.6} />
          <Line x1={82} y1={128} x2={98} y2={112} stroke="rgba(255, 255, 255, 0.28)" strokeWidth={1.6} />
          <Line x1={89} y1={128} x2={98} y2={119} stroke="rgba(255, 255, 255, 0.28)" strokeWidth={1.6} />
        </Svg>
      </View>
    );
  }
);

/**
 * Hue-neutral SVG locked overlay (0% color wash over center shapes so CVD & standard
 * colors stay 100% true-hue):
 * - Frozen: crisp white/silver corner frost-crystal wedges (#E2E8F0 + #383838 1px etch) + frost lock badge.
 * - Cursed: neutral charcoal perimeter chain-crack diagonal stripes (rgba(18,18,18,0.22)) + #121212 padlock badge.
 */
const LockedPatternOverlay: React.FC<{ frozen: boolean }> = memo(function LockedPatternOverlay({ frozen }) {
  return (
    <View testID="card-locked" pointerEvents="none" style={styles.lockedOverlay}>
      <Svg width="100%" height="100%" viewBox="0 0 100 130" preserveAspectRatio="none">
        {frozen ? (
          <>
            {/* 4 crisp silver/white corner frost-crystal wedges (center 100% transparent) */}
            <Polygon points="0,0 24,0 14,10 18,18 8,16 0,24" fill="#E2E8F0" stroke="#383838" strokeWidth={1} />
            <Polygon points="100,0 76,0 86,10 82,18 92,16 100,24" fill="#E2E8F0" stroke="#383838" strokeWidth={1} />
            <Polygon points="0,130 24,130 14,120 18,112 8,114 0,106" fill="#E2E8F0" stroke="#383838" strokeWidth={1} />
            <Polygon points="100,130 76,130 86,120 82,112 92,114 100,106" fill="#E2E8F0" stroke="#383838" strokeWidth={1} />
          </>
        ) : (
          <>
            {/* Neutral dark charcoal perimeter chain-crack stripes along edges only (center clear) */}
            <Line x1={0} y1={14} x2={14} y2={0} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2.2} />
            <Line x1={0} y1={26} x2={26} y2={0} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2.2} />
            <Line x1={74} y1={0} x2={100} y2={26} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2.2} />
            <Line x1={86} y1={0} x2={100} y2={14} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2.2} />
            <Line x1={0} y1={104} x2={26} y2={130} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2.2} />
            <Line x1={0} y1={116} x2={14} y2={130} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2.2} />
            <Line x1={74} y1={130} x2={100} y2={104} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2.2} />
            <Line x1={86} y1={130} x2={100} y2={116} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2.2} />
            <Line x1={2} y1={46} x2={10} y2={38} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2} />
            <Line x1={2} y1={84} x2={10} y2={92} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2} />
            <Line x1={98} y1={46} x2={90} y2={38} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2} />
            <Line x1={98} y1={84} x2={90} y2={92} stroke="rgba(18, 18, 18, 0.22)" strokeWidth={2} />
          </>
        )}
      </Svg>
      <View
        testID="card-locked-badge"
        style={[styles.lockedCornerBadge, frozen ? styles.lockedBadgeFrozen : styles.lockedBadgeCursed]}
      >
        <Icon
          name={frozen ? 'lorc/snowflake-1' : 'lorc/padlock'}
          size={12}
          color={frozen ? COLORS.deepOnyx : COLORS.canvasWhite}
          noShadow
        />
      </View>
    </View>
  );
});

/** Non-border triangular top-corner ear-tab for Mirror Shard / Tightrope slots (selection border stays exclusive). */
const SlotEarTab: React.FC<{
  side: 'left' | 'right';
  color: string;
  testID: string;
}> = memo(function SlotEarTab({ side, color, testID }) {
  const points = side === 'left' ? '0,0 14,0 0,14' : '0,0 14,0 14,14';
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[styles.slotEarTab, side === 'left' ? styles.slotEarTabLeft : styles.slotEarTabRight]}
    >
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Polygon points={points} fill={color} />
      </Svg>
    </View>
  );
});

/** The snare icon points down; turn it to face the card the snare points at. */
const SNARE_ROTATION: Record<NonNullable<CardType['snare']>, string> = { down: '0deg', left: '90deg', up: '180deg', right: '-90deg' };

const canHoverWeb = (): boolean => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
};

// Compact 24x30 (1:1.25) SVG viewBox for optimal 320px mobile crowding & badge clearance
const SVG_WIDTH = CARD_SVG_WIDTH;
const SVG_HEIGHT = CARD_SVG_HEIGHT;
const STROKE_WIDTH = CARD_STROKE_WIDTH;

interface CardProps {
  card: CardType;
  onClick: (card: CardType) => void;
  disabled?: boolean;
  onBurnComplete?: (card: CardType) => void;
  isPaused?: boolean;
  isConnected?: boolean; // Whether this card is part of a connection (connector weapons)
  /** Optional direct fight clock (ms) override for timed Gamble countdowns */
  elapsedMs?: number;
  /** Optional direct Hot Potato next jump timestamp (ms) override */
  potatoAtMs?: number;
  /** Optional direct Mirror Shard slot highlight override */
  mirrorSlot?: boolean;
  /** Optional direct Tightrope valid slot highlight override */
  tightropeSlot?: boolean;
  /** Optional direct Catalyst target Evolution name override */
  catalystLabel?: string | null;
  /** Optional direct override indicating the 5th `background` attribute is active */
  showBackgroundCode?: boolean;
}

interface PrioritizedChip {
  key: string;
  priority: number;
  node: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
  card,
  onClick,
  disabled = false,
  onBurnComplete,
  isPaused = false,
  isConnected = false,
  elapsedMs,
  potatoAtMs,
  mirrorSlot,
  tightropeSlot,
  catalystLabel,
  showBackgroundCode,
}) => {
  const { shape, color, number, shading, selected, isHint, isDud, isFaceDown, hasCountdown, countdownTimer, hasBomb, bombTimer } = card;
  const boardOverlay = useContext(CardBoardContext);
  const colorblind = useColorblind();

  // Cards that cannot be selected (dud, face-down, or locked)
  const isUnselectable = isDud || isFaceDown || !!card.locked;
  const isMirrorSlot = (mirrorSlot ?? boardOverlay.mirrorCardIds?.has(card.id) ?? false) && !isDud && !isFaceDown;
  const isTightropeSlot = (tightropeSlot ?? boardOverlay.tightropeCardIds?.has(card.id) ?? false) && !isDud && !isFaceDown;
  const resolvedCatalystLabel = catalystLabel !== undefined ? catalystLabel : (boardOverlay.catalystRecipeName ?? null);
  const resolvedPotatoAtMs = potatoAtMs !== undefined ? potatoAtMs : boardOverlay.potatoAtMs;
  const bgAttrActive =
    showBackgroundCode ??
    boardOverlay.backgroundAttributeActive ??
    (card.background === 'beige' || card.background === 'charcoal');

  const [isHovered, setIsHovered] = useState(false);

  const handleBurnComplete = useCallback(() => {
    onBurnComplete?.(card);
  }, [onBurnComplete, card]);

  const fireProgress = useBurnTimer({
    isOnFire: card.onFire ?? false,
    fireStartTime: card.fireStartTime,
    isPaused,
    onComplete: handleBurnComplete,
  });

  // Desktop fine-pointer hover glow (shadow only; borders/outlines are strictly for selection)
  const handleHoverIn = useCallback(() => {
    if (!canHoverWeb() || selected || disabled || isUnselectable) return;
    setIsHovered(true);
  }, [selected, disabled, isUnselectable]);

  const handleHoverOut = useCallback(() => {
    setIsHovered(prev => (prev ? false : prev));
  }, []);

  // Multi-hit cards: health > 1 shows badge, health = 1 is regular (no badge), health = 0 means removed
  const hasHealthBadge = card.health !== undefined && card.health > 1;
  const visible = !isDud && !isFaceDown;
  const cbColorCode = colorblind && visible && !card.isWild ? cardColorCode(color, true) : '';
  const cbShapeColor = cardColorHex(color, card.background, true);
  const bgMeta = cardBgPatternMeta(card.background, colorblind);
  const showBgMicroTag = colorblind && visible && bgAttrActive;
  const hasCoinBadge = !!card.bonusMoney && card.bonusMoney > 0 && visible;
  const hasTopLeftBadges = Boolean(cbColorCode || showBgMicroTag || hasCoinBadge);
  const hasTopCenterBadges = Boolean((hasHealthBadge && visible) || isMirrorSlot || isTightropeSlot);

  // Get shape component based on shape type
  const getShapeComponent = () => {
    switch (shape) {
      case 'oval':
        return <Oval color={color} shading={shading} background={card.background} colorblind={colorblind} />;
      case 'squiggle':
        return <Squiggle color={color} shading={shading} background={card.background} colorblind={colorblind} />;
      case 'diamond':
        return <Diamond color={color} shading={shading} background={card.background} colorblind={colorblind} />;
      default:
        return null;
    }
  };

  // Render the appropriate number of shapes
  const shapes = [];
  for (let i = 0; i < number; i++) {
    shapes.push(
      <View key={i} style={styles.shapeContainer}>
        {getShapeComponent()}
      </View>
    );
  }

  const getCardStyle = () => {
    const stockBorder = card.background ? CARD_STOCK_BORDER[card.background] : undefined;
    const cardStyles: any[] = [
      styles.card,
      { backgroundColor: getCardBackgroundColor(card.background) },
      stockBorder && { borderColor: stockBorder },
    ];

    // Dud cards have special styling - grayed out white card
    if (isDud) {
      cardStyles.push(styles.dudCard);
      return cardStyles;
    }

    // Face-down cards have card-back styling
    if (isFaceDown) {
      cardStyles.push(styles.faceDownCard);
      return cardStyles;
    }

    // IMPORTANT: Borders/outlines are EXCLUSIVELY reserved for selection state.
    // Bombs, countdowns, fire, mirror, and tightrope NEVER override card borders.
    if (selected) {
      cardStyles.push(styles.selected);
    }

    // A pointed-out card that has been picked has been found: its warm fill gives way to the selection border.
    // On dark Charcoal stock, keep dark background and highlight with a warm golden frame so light-on-dark shapes stay legible.
    if (isHint && !selected) {
      cardStyles.push(card.background === 'charcoal' ? styles.hintDark : styles.hint);
    }

    if (disabled || isUnselectable) {
      cardStyles.push(styles.disabled);
    }

    return cardStyles;
  };

  /**
   * Unified prioritized bottom-left hazard & state chip tray (capped at MAX_VISIBLE_STATE_CHIPS = 2).
   * Priority:
   *  1. Urgent timers (Bomb / Countdown / Fuse / Thorn / Hot Potato timer)
   *  2. Snare / Curse / Frozen / Fire
   *  3. Debuffs (Tar / Rust / Shackle / Doubler / Untimed Hot)
   *  4. Passive marks (Magnet / Bounty / Chest / Twin / Connected)
   * Overflow folds cleanly into a compact `+N` pill.
   */
  const renderBottomLeftTray = () => {
    if (!visible) return null;
    const chips: PrioritizedChip[] = [];

    // Priority 1: Active Bomb / Countdown / Timed Gambles
    if (hasBomb) {
      const timer = bombTimer ?? 10;
      const isUrgent = timer <= 5;
      chips.push({
        key: 'bomb',
        priority: 10,
        node: (
          <View
            key="bomb"
            testID="card-timer-bomb"
            style={[styles.timerOverlay, styles.bombOverlay, isUrgent && styles.timerOverlayUrgent]}
          >
            <Icon name="lorc/time-bomb" size={16} color={isUrgent ? COLORS.canvasWhite : COLORS.redSurface} noShadow />
            <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
              {Math.ceil(timer)}s
            </Text>
          </View>
        ),
      });
    }

    if (hasCountdown && countdownTimer !== undefined) {
      const isUrgent = countdownTimer <= 5;
      chips.push({
        key: 'countdown',
        priority: 11,
        node: (
          <View
            key="countdown"
            testID="card-timer-countdown"
            style={[styles.timerOverlay, isUrgent && styles.timerOverlayUrgent]}
          >
            <Icon name="lorc/stopwatch" size={16} color={isUrgent ? COLORS.canvasWhite : COLORS.slateCharcoal} noShadow />
            <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
              {Math.ceil(countdownTimer)}s
            </Text>
          </View>
        ),
      });
    }

    if (card.fuseAt !== undefined) {
      chips.push({
        key: 'fuse',
        priority: 12,
        node: (
          <GambleTimerBadge
            key="fuse"
            kind="fuse"
            icon="delapouite/time-dynamite"
            targetMs={card.fuseAt}
            elapsedMsOverride={elapsedMs}
            hot={!!card.fuseHot}
            normalColor="#374151"
            normalBg="#F3F4F6"
            normalBorder="#4B5563"
          />
        ),
      });
    }

    if (card.thornAt !== undefined) {
      chips.push({
        key: 'thorn',
        priority: 13,
        node: (
          <GambleTimerBadge
            key="thorn"
            kind="thorn"
            icon="lorc/thorny-vine"
            targetMs={card.thornAt}
            elapsedMsOverride={elapsedMs}
            urgentAtSec={5}
            normalColor="#14532D"
            normalBg="#DCFCE7"
            normalBorder="#15803D"
          />
        ),
      });
    }

    const hasHotTimer = Boolean(card.hot && resolvedPotatoAtMs !== undefined && resolvedPotatoAtMs > 0);
    if (hasHotTimer) {
      chips.push({
        key: 'potato-timer',
        priority: 14,
        node: (
          <GambleTimerBadge
            key="potato-timer"
            kind="potato"
            icon="delapouite/potato"
            targetMs={resolvedPotatoAtMs!}
            elapsedMsOverride={elapsedMs}
            urgentAtSec={2}
            normalColor="#9A3412"
            normalBg="#FFEDD5"
            normalBorder="#EA580C"
          />
        ),
      });
    }

    const pushIconChip = (
      key: string,
      priority: number,
      icon: IconName,
      iconColor: string,
      opts?: { rotate?: string; label?: string }
    ) => {
      chips.push({
        key,
        priority,
        node: (
          <View key={key} style={styles.stateIndicator}>
            <View style={opts?.rotate ? { transform: [{ rotate: opts.rotate }] } : undefined}>
              <Icon name={icon} size={CARD_HAZARD_ICON_SIZE} color={iconColor} noShadow />
            </View>
            {opts?.label && <Text style={[styles.stateIndicatorLabel, { color: iconColor }]}>{opts.label}</Text>}
          </View>
        ),
      });
    };

    // Priority 2: Snare / Locked / Curse / Frozen / Fire
    if (card.snare) {
      pushIconChip('snare', 20, 'delapouite/plain-arrow', '#B45309', { rotate: SNARE_ROTATION[card.snare] });
    }
    if (card.cursedUntil !== undefined) {
      chips.push({
        key: 'curse',
        priority: 21,
        node: (
          <GambleTimerBadge
            key="curse"
            kind="curse"
            icon="lorc/cursed-star"
            targetMs={card.cursedUntil}
            elapsedMsOverride={elapsedMs}
            normalColor="#6B21A8"
            normalBg="#F3E8FF"
            normalBorder="#7E22CE"
          />
        ),
      });
    }
    if ((card.frozen ?? 0) > 0) {
      pushIconChip('frozen', 22, 'lorc/ice-cube', '#0369A1', { label: `${card.frozen}` });
    }
    if (card.onFire) {
      pushIconChip('fire', 23, 'lorc/campfire', COLORS.redSurface);
    }

    // Priority 3: Debuffs (Tar / Rust / Shackle / Doubler / Hot untimed)
    if (card.tar) {
      pushIconChip('tar', 30, 'delapouite/sticky-boot', '#1F2937', { label: card.tar === 1 ? '2' : '1' });
    }
    if ((card.rust ?? 0) > 0) {
      pushIconChip('rust', 31, 'delapouite/rusty-sword', '#92400E', { label: `-${card.rust}` });
    }
    if (card.shackle) {
      pushIconChip('shackle', 32, 'lorc/crossed-chains', '#334155');
    }
    if (card.doubler) {
      pushIconChip('doubler', 33, 'lorc/cursed-star', '#92400E', { label: '×2' });
    }
    if (card.hot && !hasHotTimer) {
      pushIconChip('hot', 34, 'delapouite/potato', '#C2410C');
    }

    // Priority 4: Passive Marks (Magnet / Bounty / Chest / Twin / Connected)
    if (card.magnet) {
      pushIconChip('magnet', 40, 'lorc/magnet', COLORS.redSurface);
    }
    if (card.bounty) {
      pushIconChip('bounty', 41, 'delapouite/pinata', '#BE185D', { label: `${card.bounty}` });
    }
    if (card.chest !== undefined) {
      pushIconChip('chest', 42, 'delapouite/mimic-chest', '#92400E', { label: `${Math.round(card.chest)}` });
    }
    if (card.twinOf) {
      pushIconChip('twin', 43, 'delapouite/gemini', '#6D28D9');
    }
    if (isConnected) {
      pushIconChip('connected', 44, 'lorc/linked-rings', COLORS.slateCharcoal);
    }

    if (chips.length === 0) return null;

    chips.sort((a, b) => a.priority - b.priority);
    const shown = chips.slice(0, MAX_VISIBLE_STATE_CHIPS);
    const overflow = chips.length - shown.length;

    return (
      <View style={styles.stateIndicatorContainer} pointerEvents="none">
        {shown.map(c => c.node)}
        {overflow > 0 && (
          <View testID="card-state-overflow" style={styles.overflowPill}>
            <Text style={styles.overflowPillText}>+{overflow}</Text>
          </View>
        )}
      </View>
    );
  };

  // Render face-down card back with "?" symbol
  const renderFaceDownContent = () => (
    <View style={styles.faceDownContent}>
      <View style={styles.faceDownPattern}>
        {card.fogFlipAt !== undefined ? (
          // Fog Lantern: this one flips up by itself, stronger
          <View style={styles.fogContent}>
            <Icon name="lorc/lantern-flame" size={20} color="#FDE68A" noShadow />
            <FogTimerBadge targetMs={card.fogFlipAt} elapsedMsOverride={elapsedMs} />
          </View>
        ) : (
          <Text style={styles.faceDownSymbol}>?</Text>
        )}
      </View>
    </View>
  );

  // Render dud card (blank/white card)
  const renderDudContent = () => (
    <View style={styles.dudContent}>
      {/* Empty card - visually blank */}
    </View>
  );

  // Web cursor style - applied separately to avoid TypeScript issues with reanimated
  const webCursorStyle = Platform.OS === 'web'
    ? { cursor: disabled ? 'default' : 'pointer' } as any
    : undefined;

  // Determine if click should be blocked
  const isClickDisabled = disabled || isUnselectable;

  const spokenColor = cardColorLabel(color, colorblind);
  const spokenShape = formatShapeName(shape).toLowerCase();
  const spokenBg = card.background ? bgMeta.a11yLabel : null;

  return (
    <TouchableOpacity
      testID={`card-${shape}-${color}-${number}-${shading}${isDud ? '-dud' : ''}${isFaceDown ? '-facedown' : ''}${hasBomb ? '-bomb' : ''}${hasCountdown ? '-countdown' : ''}`}
      accessibilityLabel={`${number} ${spokenColor} ${shading} ${spokenShape}${spokenBg ? ` on ${spokenBg}` : ''}${isDud ? ', dud' : ''}${isFaceDown ? ', face down' : ''}${card.hasEvolutionItem ? (card.evolutionReady ? (resolvedCatalystLabel ? (resolvedCatalystLabel === 'Pick Evo' ? ', evolution choice catalyst' : `, catalyst for ${resolvedCatalystLabel}`) : ', evolution ready') : ', dormant catalyst') : ''}${isMirrorSlot ? ', mirror slot' : ''}${isTightropeSlot ? ', on tightrope' : ''}${card.snare ? `, snare pointing ${card.snare}` : ''}${card.bounty ? `, bounty ${card.bounty}` : ''}`}
      style={[
        getCardStyle(),
        isHovered && !selected && !disabled && !isUnselectable && styles.hoveredCard,
        webCursorStyle,
      ]}
      onPress={() => !isClickDisabled && onClick(card)}
      disabled={isClickDisabled}
      // No press dim: the lift in CardMotion answers the tap (a 250 ms fade-back on release only blurred it)
      activeOpacity={1}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      // @ts-ignore - onHoverIn/Out are web-only props
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
    >
      {/* Blueprint Mist (#E2ECF7) built-in perimeter dot pattern */}
      {card.background === 'beige' && visible && <MistPerimeterPattern />}

      {/* 5th-attribute Colorblind corner hatch (`dots` for parchment, `diagonal-hatch` for charcoal) */}
      {showBgMicroTag && bgMeta.pattern !== 'none' && (
        <ColorblindBgCornerPattern pattern={bgMeta.pattern} />
      )}

      {/* Mirror Shard & Tightrope non-border top-corner triangular ear-tabs (selection border stays exclusive) */}
      {isMirrorSlot && <SlotEarTab side="left" color="#0284C7" testID="card-mirror-frame" />}
      {isTightropeSlot && <SlotEarTab side="right" color="#D97706" testID="card-tightrope-frame" />}

      {/* ZONE 1 (Top-Left): Colorblind code (O/B/P) + 5th-attr bg tag (W/T/D) + Coin (+N¢) horizontally side-by-side */}
      {hasTopLeftBadges && (
        <View testID="card-top-left-row" style={styles.topLeftRow} pointerEvents="none">
          {!!cbColorCode && (
            <View
              testID="card-colorblind-badge"
              style={[
                styles.colorblindBadge,
                {
                  backgroundColor: card.background === 'charcoal' ? 'rgba(18, 18, 18, 0.92)' : 'rgba(255, 255, 255, 0.96)',
                  borderColor: cbShapeColor,
                },
              ]}
            >
              <Text style={[styles.colorblindBadgeText, { color: cbShapeColor }]}>
                {cbColorCode}
              </Text>
            </View>
          )}
          {showBgMicroTag && (
            <View
              testID="card-bg-code-badge"
              style={[
                styles.bgCodeBadge,
                {
                  backgroundColor: bgMeta.badgeBg,
                  borderColor: bgMeta.badgeBorder,
                },
              ]}
            >
              <Text style={[styles.bgCodeBadgeText, { color: bgMeta.badgeText }]}>
                {bgMeta.code}
              </Text>
            </View>
          )}
          {hasCoinBadge && (
            <View testID="card-coin-badge" style={styles.coinBadge}>
              <Text style={styles.coinBadgeText}>+{card.bonusMoney}¢</Text>
            </View>
          )}
        </View>
      )}

      {/* ZONE 2 (Top-Center): Health armor pips (moved off top-right so zero Catalyst collision!) + Mirror/Tightrope badges */}
      {hasTopCenterBadges && (
        <View testID="card-top-center-row" style={styles.topCenterRow} pointerEvents="none">
          {isMirrorSlot && (
            <View testID="card-slot-mirror" style={styles.mirrorSlotBadge}>
              <Icon name="lorc/mirror-mirror" size={10} color="#0369A1" noShadow />
            </View>
          )}
          {hasHealthBadge && visible && (
            <View testID="card-health-badge" style={styles.healthBadge}>
              <Text style={styles.badgeText}>{'●'.repeat(card.health ?? 1)}</Text>
            </View>
          )}
          {isTightropeSlot && (
            <View testID="card-slot-tightrope" style={styles.tightropeSlotBadge}>
              <Icon name="delapouite/tightrope" size={10} color="#92400E" noShadow />
            </View>
          )}
        </View>
      )}

      {/* ZONE 3 (Top-Right): Hidden Evolution Catalyst ONLY (zero collision with armor health pips) */}
      {!!card.hasEvolutionItem && visible && (
        <>
          <View
            style={[styles.catalystBackdrop, { opacity: card.evolutionReady ? 0.24 : 0.14 }]}
            pointerEvents="none"
          >
            <Icon
              name="lorc/crystal-shine"
              size={34}
              color={card.evolutionReady ? '#D97706' : '#7C3AED'}
              noShadow
            />
          </View>
          <View
            testID="card-evolution-catalyst"
            style={[
              styles.badge,
              styles.badgeTopRight,
              card.evolutionReady ? styles.catalystBadgeReady : styles.catalystBadgeDormant,
              resolvedCatalystLabel ? (hasTopLeftBadges ? styles.catalystBadgeWithCoin : styles.catalystBadgeNamed) : null,
            ]}
            pointerEvents="none"
          >
            <Icon
              name="lorc/crystal-shine"
              size={10}
              color={card.evolutionReady ? COLORS.deepOnyx : '#5B21B6'}
              noShadow
            />
            {card.evolutionReady && (
              <Text
                testID="card-catalyst-name"
                style={styles.catalystBadgeText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {resolvedCatalystLabel || 'EVO'}
              </Text>
            )}
          </View>
        </>
      )}

      {/* ZONE 5 (Bottom-Right): Power / Charge bonus damage badge */}
      {((card.bonusPoints ?? 0) > 0 || (card.charge ?? 0) > 0) && visible && (
        <View style={[styles.badge, styles.powerBadge]} pointerEvents="none">
          <Text style={[styles.powerBadgeText, !(card.bonusPoints ?? 0) && styles.chargeBadgeText]}>
            +{(card.bonusPoints ?? 0) + (card.charge ?? 0)}
          </Text>
        </View>
      )}

      {/* Card content - depends on state */}
      {isDud ? (
        renderDudContent()
      ) : isFaceDown ? (
        renderFaceDownContent()
      ) : (
        <View nativeID="card-shapes" style={styles.shapesContainer}>
          {card.isWild ? (
            // Wild Card: no shapes of its own; it completes any Set
            <View testID="card-wild" style={styles.wildContent}>
              <Icon name="delapouite/card-joker" size={30} color="#4C1D95" noShadow />
              <Text style={styles.wildText}>WILD</Text>
            </View>
          ) : (
            shapes
          )}
        </View>
      )}

      {/* ZONE 4 (Bottom-Left): Unified prioritized hazard & state tray (max 2 simultaneous chips + +N overflow) */}
      {renderBottomLeftTray()}

      {/* Hue-neutral SVG locked overlay (0% color wash over center shapes) */}
      {card.locked && visible && <LockedPatternOverlay frozen={(card.frozen ?? 0) > 0} />}

      {/* Fire overlay — progressive ember tint (no border, borders are for selection only) */}
      {card.onFire && visible && (
        <View
          style={[
            styles.fireOverlay,
            {
              backgroundColor: `rgba(239, 68, 68, ${fireProgress * 0.25})`,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Double-stroke high-contrast selection inner yellow ring + crisp #121212 checkmark pip */}
      {selected && visible && (
        <>
          <View testID="card-selected-ring" pointerEvents="none" style={styles.selectedInnerRing} />
          <View testID="card-selected-check" pointerEvents="none" style={styles.selectedCheckPip}>
            <Text style={styles.selectedCheckText}>✓</Text>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

interface ShapeProps {
  color: string;
  shading: string;
  background?: Background;
  colorblind?: boolean;
}

// Get the appropriate universal CVD-safe shape color based on card stock
const getShapeColor = (color: string, background?: Background, _colorblind = false) =>
  getCardShapeColor(color, background);

const getCardBackgroundColor = (background?: Background) => getCardStockBackground(background);

// -45° diagonal hatch pattern ("\") for "striped" shading — cuts cleanly across Circle, Triangle, and chunky 8-vertex Bolt
const StripesPattern: React.FC<{ id: string; color: string }> = memo(function StripesPattern({ id, color }) {
  const pitch = CARD_STRIPE_PITCH;
  return (
    <Defs>
      <Pattern
        id={id}
        patternUnits="userSpaceOnUse"
        width={pitch}
        height={pitch}
        patternTransform="rotate(45)"
      >
        <Rect x="0" y="0" width={pitch} height={pitch / 2} fill={color} />
      </Pattern>
    </Defs>
  );
});

const getFill = (color: string, shading: string, patternId: string, background?: Background, colorblind = false) => {
  if (shading === 'solid') return getShapeColor(color, background, colorblind);
  if (shading === 'striped') return `url(#${patternId})`;
  return 'transparent';
};

// Slot 'oval' → Circle (smooth symmetric convex archetype)
const Oval: React.FC<ShapeProps> = memo(function Oval({ color, shading, background, colorblind = false }) {
  const strokeColor = getShapeColor(color, background, colorblind);
  const patternId = `stripes-circle-${color}-${background || 'white'}`;
  const { cx, cy, r } = CARD_SHAPE_GEOMETRY.circle;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shading === 'striped' && <StripesPattern id={patternId} color={strokeColor} />}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        fill={getFill(color, shading, patternId, background, colorblind)}
      />
    </Svg>
  );
});

// Slot 'diamond' → Triangle (sharp straight-edge convex archetype)
const Diamond: React.FC<ShapeProps> = memo(function Diamond({ color, shading, background, colorblind = false }) {
  const strokeColor = getShapeColor(color, background, colorblind);
  const patternId = `stripes-triangle-${color}-${background || 'white'}`;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shading === 'striped' && <StripesPattern id={patternId} color={strokeColor} />}
      <Polygon
        points={CARD_SHAPE_GEOMETRY.trianglePoints}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={getFill(color, shading, patternId, background, colorblind)}
      />
    </Svg>
  );
});

// Slot 'squiggle' → Chunky 8-vertex Bolt (crisp diagonal V1 pop-out; 52.6% clear interior, zero clip)
const Squiggle: React.FC<ShapeProps> = memo(function Squiggle({ color, shading, background, colorblind = false }) {
  const strokeColor = getShapeColor(color, background, colorblind);
  const patternId = `stripes-bolt-${color}-${background || 'white'}`;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shading === 'striped' && <StripesPattern id={patternId} color={strokeColor} />}
      <Polygon
        points={CARD_SHAPE_GEOMETRY.boltPoints}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={getFill(color, shading, patternId, background, colorblind)}
      />
    </Svg>
  );
});

const styles = StyleSheet.create({
  patternLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.module - 3,
    overflow: 'hidden',
    zIndex: 1,
  },
  powerBadge: {
    bottom: 3,
    right: 3,
    backgroundColor: '#383838',
    borderColor: '#121212',
  },
  powerBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFDE00',
  },
  chargeBadgeText: {
    color: '#FFFFFF',
  },
  topLeftRow: {
    position: 'absolute',
    top: 3,
    left: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 11,
  },
  coinBadge: {
    minWidth: 20,
    height: 16,
    borderRadius: RADIUS.button,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD54A',
    borderWidth: 1,
    borderColor: '#92400E',
  },
  coinBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#451A03',
  },
  colorblindBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  colorblindBadgeText: {
    fontSize: 10,
    lineHeight: 11,
    fontWeight: '900',
  },
  bgCodeBadge: {
    minWidth: 15,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  bgCodeBadgeText: {
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '900',
  },
  topCenterRow: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 10,
  },
  healthBadge: {
    borderRadius: RADIUS.button,
    minWidth: 20,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.redSurface,
    borderWidth: 1,
    borderColor: COLORS.deepOnyx,
  },
  catalystBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalystBadgeDormant: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: '#EDE9FE',
    borderColor: '#6D28D9',
  },
  catalystBadgeReady: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: COLORS.actionYellow,
    borderColor: COLORS.deepOnyx,
  },
  catalystBadgeNamed: {
    maxWidth: '88%',
    paddingHorizontal: 4,
  },
  catalystBadgeWithCoin: {
    maxWidth: '58%',
    paddingHorizontal: 4,
  },
  catalystBadgeText: {
    flexShrink: 1,
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.deepOnyx,
    letterSpacing: 0.3,
  },
  slotEarTab: {
    position: 'absolute',
    top: 0,
    width: 14,
    height: 14,
    overflow: 'hidden',
    zIndex: 8,
  },
  slotEarTabLeft: {
    left: 0,
    borderTopLeftRadius: RADIUS.module - 3,
  },
  slotEarTabRight: {
    right: 0,
    borderTopRightRadius: RADIUS.module - 3,
  },
  mirrorSlotBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tightropeSlotBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    gap: 2,
  },
  timerPillLabel: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    paddingRight: 0,
  },
  fogContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  fogTimerBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(18, 18, 18, 0.78)',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  fogTimerText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FDE68A',
    fontVariant: ['tabular-nums'],
  },
  card: {
    position: 'relative',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: RADIUS.module,
    // Use consistent borderWidth to prevent Safari flex layout recalculation on selection
    borderWidth: 3,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.canvasWhite,
    flex: 1,
    // Minimum touch target size for accessibility (48x48)
    minWidth: 48,
    minHeight: 48,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // High-contrast double-stroke selection frame: outer 3px #121212 + inset 3px #FFDE00 ring + ✓ pip
  selected: {
    borderColor: COLORS.deepOnyx,
    shadowColor: COLORS.deepOnyx,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  selectedInnerRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.module - 3,
    borderWidth: 3,
    borderColor: COLORS.actionYellow,
    zIndex: 15,
  },
  selectedCheckPip: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.deepOnyx,
    borderWidth: 1,
    borderColor: COLORS.actionYellow,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 16,
  },
  selectedCheckText: {
    fontSize: 10,
    lineHeight: 11,
    fontWeight: '900',
    color: COLORS.actionYellow,
  },
  // Pointed out: a warm fill on light cards, golden rim on dark charcoal cards
  hint: {
    backgroundColor: '#FFF3B0',
  },
  hintDark: {
    borderColor: '#FDE047',
    shadowColor: '#FDE047',
    shadowOpacity: 0.55,
    shadowRadius: 6,
  },
  // Note: Fire state is shown via small icon in bottom left, not border
  // Borders/outlines are EXCLUSIVELY for selection state
  fireOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.module - 2,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.module - 3,
    overflow: 'hidden',
    zIndex: 13,
  },
  lockedCornerBadge: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBadgeCursed: {
    backgroundColor: COLORS.deepOnyx,
    borderColor: COLORS.canvasWhite,
  },
  lockedBadgeFrozen: {
    backgroundColor: COLORS.canvasWhite,
    borderColor: COLORS.slateCharcoal,
  },
  wildContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  wildText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#4C1D95' },
  // State indicator icons & timers in one non-overlapping bottom-left flex row (capped at 2 + overflow)
  stateIndicatorContainer: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    maxWidth: '78%',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 2,
    zIndex: 12,
  },
  stateIndicator: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  stateIndicatorLabel: {
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    paddingRight: 1,
  },
  overflowPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.slateCharcoal,
    borderWidth: 1,
    borderColor: COLORS.deepOnyx,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.canvasWhite,
    fontVariant: ['tabular-nums'],
  },
  disabled: {
    opacity: 0.6,
  },
  // Dud card styling - blank/white unmatchable card
  dudCard: {
    backgroundColor: '#E5E5E5',
    borderColor: '#CCCCCC',
    opacity: 0.5,
  },
  dudContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Face-down card styling - card back with pattern
  faceDownCard: {
    backgroundColor: COLORS.slateCharcoal,
    borderColor: COLORS.deepOnyx,
  },
  faceDownContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceDownPattern: {
    width: '80%',
    height: '80%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
  },
  faceDownSymbol: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.canvasWhite,
    opacity: 0.8,
  },
  // Timer overlay (shared by countdown and bomb — sits inside bottom-left badge tray, never overrides card border)
  timerOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    gap: 2,
  },
  bombOverlay: {
    borderColor: COLORS.redSurface,
    backgroundColor: '#FEF2F2',
  },
  timerOverlayUrgent: {
    backgroundColor: COLORS.redSurface,
    borderColor: '#991B1B',
  },
  timerText: {
    fontSize: 10.5,
    fontWeight: '800',
    fontFamily: MONO_FONT,
    fontVariant: ['tabular-nums'],
    color: COLORS.slateCharcoal,
  },
  timerTextUrgent: {
    color: COLORS.canvasWhite,
  },
  shapeContainer: {
    height: '80%',
    width: '28%', // Sized to fit 3 shapes with spacing
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    zIndex: 2,
  },
  badge: {
    position: 'absolute',
    borderRadius: RADIUS.button,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  badgeTopRight: {
    top: 2,
    right: 2,
  },
  badgeText: {
    color: COLORS.canvasWhite,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: MONO_FONT,
  },
  hoveredCard: {
    shadowRadius: 8,
    shadowOpacity: 0.18,
  },
});

const areCardsShallowEqual = (a: CardType, b: CardType): boolean => {
  if (a === b) return true;
  const keysA = Object.keys(a) as (keyof CardType)[];
  const keysB = Object.keys(b) as (keyof CardType)[];
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
};

const areCardPropsEqual = (prev: CardProps, next: CardProps): boolean =>
  prev.disabled === next.disabled &&
  prev.isPaused === next.isPaused &&
  prev.isConnected === next.isConnected &&
  prev.elapsedMs === next.elapsedMs &&
  prev.potatoAtMs === next.potatoAtMs &&
  prev.mirrorSlot === next.mirrorSlot &&
  prev.tightropeSlot === next.tightropeSlot &&
  prev.catalystLabel === next.catalystLabel &&
  prev.showBackgroundCode === next.showBackgroundCode &&
  prev.onClick === next.onClick &&
  prev.onBurnComplete === next.onBurnComplete &&
  areCardsShallowEqual(prev.card, next.card);

export default memo(Card, areCardPropsEqual);
