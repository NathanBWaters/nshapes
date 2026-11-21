import React, { createContext, memo, useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import Svg, { Ellipse, Path, Polygon, Defs, Pattern, Rect } from 'react-native-svg';
import { Card as CardType, Background } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { BACKGROUND_COLORS } from '@/utils/gameConfig';
import { useBurnTimer } from '@/hooks/useBurnTimer';
import Icon, { type IconName } from './Icon';

/** Board-level static visual overlays (Mirror Shard, Tightrope, Catalyst target, Hot Potato timestamp). */
export interface CardBoardOverlay {
  mirrorCardIds?: ReadonlySet<string>;
  tightropeCardIds?: ReadonlySet<string>;
  catalystRecipeName?: string | null;
  potatoAtMs?: number;
}

const DEFAULT_CARD_BOARD_OVERLAY: CardBoardOverlay = {};
const CardBoardContext = createContext<CardBoardOverlay>(DEFAULT_CARD_BOARD_OVERLAY);
/** Whole-second fight clock (ms), ONLY subscribed to by timed Gamble countdown badges so plain Cards never re-render on ticks. */
const CardBoardClockContext = createContext<number | null>(null);

export const CardBoardProvider: React.FC<{
  overlay: CardBoardOverlay;
  clockMs: number | null;
  children: React.ReactNode;
}> = ({ overlay, clockMs, children }) => (
  <CardBoardContext.Provider value={overlay}>
    <CardBoardClockContext.Provider value={clockMs}>{children}</CardBoardClockContext.Provider>
  </CardBoardContext.Provider>
);

const computeCountdownSec = (targetMs: number | undefined, elapsedMs: number | null): number | null => {
  if (targetMs === undefined || elapsedMs === null || !Number.isFinite(targetMs)) return null;
  return Math.max(0, Math.ceil((targetMs - elapsedMs) / 1000));
};

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
  const color = urgent ? '#B91C1C' : normalColor;
  const bg = urgent ? '#FEE2E2' : normalBg;
  const border = urgent ? '#DC2626' : normalBorder;
  const label = secs !== null ? (hot ? `${secs}s!` : `${secs}s`) : undefined;

  return (
    <View
      testID={`card-timer-${kind}`}
      style={[styles.stateIndicator, styles.timerPill, { backgroundColor: bg, borderColor: border }]}
    >
      <Icon name={icon} size={10} color={color} noShadow />
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

// SVG viewBox dimensions (1:2 width:height ratio)
const SVG_WIDTH = 20;
const SVG_HEIGHT = 40;
const STROKE_WIDTH = 2;

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
}) => {
  const { shape, color, number, shading, selected, isHint, isDud, isFaceDown, hasCountdown, countdownTimer, hasBomb, bombTimer } = card;
  const boardOverlay = useContext(CardBoardContext);

  // Cards that cannot be selected (dud or face-down)
  const isUnselectable = isDud || isFaceDown || !!card.locked;
  const isMirrorSlot = (mirrorSlot ?? boardOverlay.mirrorCardIds?.has(card.id) ?? false) && !isDud && !isFaceDown;
  const isTightropeSlot = (tightropeSlot ?? boardOverlay.tightropeCardIds?.has(card.id) ?? false) && !isDud && !isFaceDown;
  const resolvedCatalystLabel = catalystLabel !== undefined ? catalystLabel : (boardOverlay.catalystRecipeName ?? null);
  const resolvedPotatoAtMs = potatoAtMs !== undefined ? potatoAtMs : boardOverlay.potatoAtMs;

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
  // Default health is 1 (undefined treated as 1). Badge shows remaining hits needed.
  const hasHealthBadge = card.health !== undefined && card.health > 1;

  // Get shape component based on shape type
  const getShapeComponent = () => {
    switch (shape) {
      case 'oval':
        return <Oval color={color} shading={shading} background={card.background} />;
      case 'squiggle':
        return <Squiggle color={color} shading={shading} background={card.background} />;
      case 'diamond':
        return <Diamond color={color} shading={shading} background={card.background} />;
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
    const cardStyles: any[] = [
      styles.card,
      { backgroundColor: getCardBackgroundColor(card.background) }
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

    // Fire state is shown via small icon, not border (borders reserved for selection)

    // Bomb cards have urgent red border
    if (hasBomb) {
      cardStyles.push(styles.bombCard);
    }

    // Countdown cards have urgent styling
    if (hasCountdown) {
      cardStyles.push(styles.countdownCard);
    }

    if (selected) {
      cardStyles.push(styles.selected);
    }

    // A pointed-out card that has been picked has been found: its warm fill gives way to the selection border
    if (isHint && !selected) {
      cardStyles.push(styles.hint);
    }

    if (disabled || isUnselectable) {
      cardStyles.push(styles.disabled);
    }

    return cardStyles;
  };

  // Health badge for multi-hit cards (used by enemy system)
  // Shows remaining hits needed when health > 1
  const getHealthBadge = () => {
    if (!hasHealthBadge) return null;

    // Show health pips (●●● → ●● → ●)
    const pips = '●'.repeat(card.health ?? 1);
    return (
      <View style={[styles.badge, styles.badgeTopRight, { backgroundColor: COLORS.impactRed }]}>
        <Text style={styles.badgeText}>{pips}</Text>
      </View>
    );
  };

  // State indicator icons in bottom left corner
  // These are small icons (1/5 size of shapes) that show card state
  // IMPORTANT: Outlines/borders are ONLY for selection - use icons for other states
  const renderStateIndicators = () => {
    const indicators: { icon: IconName; color: string; rotate?: string; label?: string }[] = [];
    const visible = !isDud && !isFaceDown;

    if (card.onFire && visible) {
      indicators.push({ icon: 'lorc/campfire', color: '#EF4444' }); // Red fire
    }

    if (isConnected && visible) {
      indicators.push({ icon: 'lorc/linked-rings', color: COLORS.slateCharcoal }); // Gray connection
    }

    // Snare trap: an arrow pointing at the neighbour that defuses it
    if (card.snare && visible) {
      indicators.push({ icon: 'delapouite/plain-arrow', color: '#B45309', rotate: SNARE_ROTATION[card.snare] });
    }

    // Magnet: the marked card (a Set that includes it hits harder)
    if (card.magnet && visible) {
      indicators.push({ icon: 'lorc/magnet', color: '#DC2626' });
    }

    // Twin Seed: this card has an identical twin on the board
    if (card.twinOf && visible) {
      indicators.push({ icon: 'delapouite/gemini', color: '#7C3AED' });
    }

    // Board tricks (adventure/engine/gear.ts). Decoys are unmarked on purpose.
    // Timed Gambles render dedicated countdown badges (subscribing to 1Hz clock context only when mounted).
    if (card.doubler && visible) indicators.push({ icon: 'lorc/cursed-star', color: '#B45309', label: '×2' });
    if (card.shackle && visible) indicators.push({ icon: 'lorc/crossed-chains', color: '#475569' });
    if ((card.rust ?? 0) > 0 && visible) indicators.push({ icon: 'delapouite/rusty-sword', color: '#B45309', label: `-${card.rust}` });
    if (card.tar && visible) indicators.push({ icon: 'delapouite/sticky-boot', color: '#1F2937', label: card.tar === 1 ? '2' : '1' });
    if ((card.frozen ?? 0) > 0 && visible) indicators.push({ icon: 'lorc/ice-cube', color: '#0284C7', label: `${card.frozen}` });
    if (card.chest !== undefined && visible) indicators.push({ icon: 'delapouite/mimic-chest', color: '#B45309', label: `${Math.round(card.chest)}` });
    const hasHotTimer = Boolean(card.hot && visible && resolvedPotatoAtMs !== undefined && resolvedPotatoAtMs > 0);
    if (card.hot && visible && !hasHotTimer) indicators.push({ icon: 'delapouite/potato', color: '#EA580C' });

    // Piñata bounty: bonus damage when this armored card finally breaks
    if (card.bounty && visible) {
      indicators.push({ icon: 'delapouite/pinata', color: '#DB2777', label: `${card.bounty}` });
    }

    const hasCurseTimer = card.cursedUntil !== undefined && visible;
    const hasThornTimer = card.thornAt !== undefined && visible;
    const hasFuseTimer = card.fuseAt !== undefined && visible;

    if (indicators.length === 0 && !hasCurseTimer && !hasThornTimer && !hasFuseTimer && !hasHotTimer) return null;

    return (
      <>
        {indicators.map((indicator, index) => (
          <View key={index} style={styles.stateIndicator}>
            <View style={indicator.rotate ? { transform: [{ rotate: indicator.rotate }] } : undefined}>
              <Icon name={indicator.icon} size={10} color={indicator.color} noShadow />
            </View>
            {indicator.label && <Text style={[styles.stateIndicatorLabel, { color: indicator.color }]}>{indicator.label}</Text>}
          </View>
        ))}
        {hasCurseTimer && (
          <GambleTimerBadge
            kind="curse"
            icon="lorc/cursed-star"
            targetMs={card.cursedUntil!}
            elapsedMsOverride={elapsedMs}
            normalColor="#6B21A8"
            normalBg="#F3E8FF"
            normalBorder="#7E22CE"
          />
        )}
        {hasThornTimer && (
          <GambleTimerBadge
            kind="thorn"
            icon="lorc/thorny-vine"
            targetMs={card.thornAt!}
            elapsedMsOverride={elapsedMs}
            urgentAtSec={5}
            normalColor="#14532D"
            normalBg="#DCFCE7"
            normalBorder="#15803D"
          />
        )}
        {hasFuseTimer && (
          <GambleTimerBadge
            kind="fuse"
            icon="delapouite/time-dynamite"
            targetMs={card.fuseAt!}
            elapsedMsOverride={elapsedMs}
            hot={!!card.fuseHot}
            normalColor="#374151"
            normalBg="#F3F4F6"
            normalBorder="#4B5563"
          />
        )}
        {hasHotTimer && (
          <GambleTimerBadge
            kind="potato"
            icon="delapouite/potato"
            targetMs={resolvedPotatoAtMs!}
            elapsedMsOverride={elapsedMs}
            urgentAtSec={2}
            normalColor="#9A3412"
            normalBg="#FFEDD5"
            normalBorder="#EA580C"
          />
        )}
      </>
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

  const renderCountdownOverlay = () => {
    if (!hasCountdown || countdownTimer === undefined) return null;

    const isUrgent = countdownTimer <= 5;
    return (
      <View style={[styles.timerOverlay, isUrgent && styles.timerOverlayUrgent]}>
        <Icon name="lorc/stopwatch" size={16} color={isUrgent ? COLORS.impactRed : COLORS.slateCharcoal} noShadow />
        <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
          {Math.ceil(countdownTimer)}s
        </Text>
      </View>
    );
  };

  const renderBombOverlay = () => {
    if (!hasBomb) return null;

    const timer = bombTimer ?? 10;
    const isUrgent = timer <= 5;
    return (
      <View style={[styles.timerOverlay, styles.bombOverlay, isUrgent && styles.timerOverlayUrgent]}>
        <Icon name="lorc/time-bomb" size={16} color={isUrgent ? COLORS.impactRed : COLORS.slateCharcoal} noShadow />
        <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
          {Math.ceil(timer)}s
        </Text>
      </View>
    );
  };

  // Web cursor style - applied separately to avoid TypeScript issues with reanimated
  const webCursorStyle = Platform.OS === 'web'
    ? { cursor: disabled ? 'default' : 'pointer' } as any
    : undefined;

  // Determine if click should be blocked
  const isClickDisabled = disabled || isUnselectable;

  return (
    <TouchableOpacity
      testID={`card-${shape}-${color}-${number}-${shading}${isDud ? '-dud' : ''}${isFaceDown ? '-facedown' : ''}${hasBomb ? '-bomb' : ''}${hasCountdown ? '-countdown' : ''}`}
      accessibilityLabel={`${number} ${color} ${shading} ${shape}${card.background ? ` on ${card.background}` : ''}${isDud ? ', dud' : ''}${isFaceDown ? ', face down' : ''}${card.hasEvolutionItem ? (card.evolutionReady ? (resolvedCatalystLabel ? (resolvedCatalystLabel === 'Pick Evo' ? ', evolution choice catalyst' : `, catalyst for ${resolvedCatalystLabel}`) : ', evolution ready') : ', dormant catalyst') : ''}${isMirrorSlot ? ', mirror slot' : ''}${isTightropeSlot ? ', on tightrope' : ''}${card.snare ? `, snare pointing ${card.snare}` : ''}${card.bounty ? `, bounty ${card.bounty}` : ''}`}
      style={[
        getCardStyle(),
        isHovered && !selected && !disabled && !isUnselectable && styles.hoveredCard,
        // Note: Fire state shown via icon, not border styling
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
      {/* Mirror Shard & Tightrope slot accents: inset inside outer border so selection border stays unmistakable */}
      {isMirrorSlot && <View testID="card-mirror-frame" pointerEvents="none" style={styles.mirrorInnerFrame} />}
      {isTightropeSlot && (
        <View
          testID="card-tightrope-frame"
          pointerEvents="none"
          style={[styles.tightropeInnerFrame, isMirrorSlot && styles.tightropeInnerFrameNested]}
        />
      )}
      {(isMirrorSlot || isTightropeSlot) && (
        <View style={styles.slotMarkRow} pointerEvents="none">
          {isMirrorSlot && (
            <View testID="card-slot-mirror" style={styles.mirrorSlotBadge}>
              <Icon name="lorc/mirror-mirror" size={9} color="#0369A1" noShadow />
            </View>
          )}
          {isTightropeSlot && (
            <View testID="card-slot-tightrope" style={styles.tightropeSlotBadge}>
              <Icon name="delapouite/tightrope" size={9} color="#B45309" noShadow />
            </View>
          )}
        </View>
      )}

      {/* Health badge for multi-hit cards */}
      {getHealthBadge()}

      {/* Power card: extra damage when matched (adventure mode). A charged card (board-wide boost) shows its extra damage in a plainer badge. */}
      {((card.bonusPoints ?? 0) > 0 || (card.charge ?? 0) > 0) && !isDud && !isFaceDown && (
        <View style={[styles.badge, styles.powerBadge]} pointerEvents="none">
          <Text style={[styles.powerBadgeText, !(card.bonusPoints ?? 0) && styles.chargeBadgeText]}>
            +{(card.bonusPoints ?? 0) + (card.charge ?? 0)}
          </Text>
        </View>
      )}

      {/* Golden card: extra coins when matched (adventure mode) */}
      {!!card.bonusMoney && card.bonusMoney > 0 && !isDud && !isFaceDown && (
        <View style={[styles.badge, styles.coinBadge]} pointerEvents="none">
          <Text style={styles.coinBadgeText}>+{card.bonusMoney}¢</Text>
        </View>
      )}

      {/* Hidden Evolution Catalyst: crystal watermark behind shapes + corner indicator (no card border!) */}
      {!!card.hasEvolutionItem && !isDud && !isFaceDown && (
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
              resolvedCatalystLabel ? (card.bonusMoney ? styles.catalystBadgeWithCoin : styles.catalystBadgeNamed) : null,
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
              <Icon name="delapouite/card-joker" size={30} color="#7C3AED" noShadow />
              <Text style={styles.wildText}>WILD</Text>
            </View>
          ) : (
            shapes
          )}
        </View>
      )}

      {/* Unified bottom-left badge tray: enemy timers + state/gamble indicators side-by-side (zero overlap) */}
      <View style={styles.stateIndicatorContainer} pointerEvents="none">
        {renderCountdownOverlay()}
        {renderBombOverlay()}
        {renderStateIndicators()}
      </View>

      {/* Cursed or frozen: visible but out of play (a wash over the card, never a border) */}
      {card.locked && !isDud && !isFaceDown && (
        <View testID="card-locked" pointerEvents="none" style={[styles.lockedOverlay, (card.frozen ?? 0) > 0 ? styles.frozenOverlay : styles.cursedOverlay]} />
      )}

      {/* Fire overlay - progressive darkening (no border, borders are for selection only) */}
      {card.onFire && !isDud && !isFaceDown && (
        <View
          style={[
            styles.fireOverlay,
            {
              backgroundColor: `rgba(239, 68, 68, ${fireProgress * 0.3})`,
            }
          ]}
          pointerEvents="none"
        />
      )}
    </TouchableOpacity>
  );
};

interface ShapeProps {
  color: string;
  shading: string;
  background?: Background;
}

const getBorderColor = (color: string) => {
  switch (color) {
    case 'red': return COLORS.impactRed;
    case 'green': return COLORS.logicTeal;
    case 'purple': return '#7C3AED';
    default: return COLORS.slateCharcoal;
  }
};

// Get lightened colors for charcoal background (better contrast)
const getLightColor = (color: string) => {
  switch (color) {
    case 'red': return '#FF9999';
    case 'green': return '#66CCBB';
    case 'purple': return '#B39DDB';
    default: return COLORS.canvasWhite;
  }
};

// Get the appropriate shape color based on background
const getShapeColor = (color: string, background?: Background) => {
  if (background === 'charcoal') {
    return getLightColor(color);
  }
  return getBorderColor(color);
};

const getCardBackgroundColor = (background?: Background) => {
  if (!background || background === 'white') {
    return COLORS.canvasWhite;
  }
  return BACKGROUND_COLORS[background];
};

// Stripe pattern for "striped" shading
const StripesPattern: React.FC<{ id: string; color: string }> = memo(function StripesPattern({ id, color }) {
  return (
    <Defs>
      <Pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4">
        <Rect x="0" y="0" width="4" height="2" fill={color} />
      </Pattern>
    </Defs>
  );
});

const getFill = (color: string, shading: string, patternId: string, background?: Background) => {
  if (shading === 'solid') return getShapeColor(color, background);
  if (shading === 'striped') return `url(#${patternId})`;
  return 'transparent';
};

const Oval: React.FC<ShapeProps> = memo(function Oval({ color, shading, background }) {
  const strokeColor = getShapeColor(color, background);
  const patternId = `stripes-oval-${color}-${background || 'white'}`;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shading === 'striped' && <StripesPattern id={patternId} color={strokeColor} />}
      <Ellipse
        cx={SVG_WIDTH / 2}
        cy={SVG_HEIGHT / 2}
        rx={(SVG_WIDTH - STROKE_WIDTH) / 2}
        ry={(SVG_HEIGHT - STROKE_WIDTH) / 2}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        fill={getFill(color, shading, patternId, background)}
      />
    </Svg>
  );
});

const Diamond: React.FC<ShapeProps> = memo(function Diamond({ color, shading, background }) {
  const strokeColor = getShapeColor(color, background);
  const patternId = `stripes-diamond-${color}-${background || 'white'}`;
  // Diamond points: top, right, bottom, left
  const points = `${SVG_WIDTH / 2},${STROKE_WIDTH} ${SVG_WIDTH - STROKE_WIDTH},${SVG_HEIGHT / 2} ${SVG_WIDTH / 2},${SVG_HEIGHT - STROKE_WIDTH} ${STROKE_WIDTH},${SVG_HEIGHT / 2}`;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shading === 'striped' && <StripesPattern id={patternId} color={strokeColor} />}
      <Polygon
        points={points}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        fill={getFill(color, shading, patternId, background)}
      />
    </Svg>
  );
});

const Squiggle: React.FC<ShapeProps> = memo(function Squiggle({ color, shading, background }) {
  const strokeColor = getShapeColor(color, background);
  const patternId = `stripes-squiggle-${color}-${background || 'white'}`;
  // S-curve squiggle path (scaled for 20x40 viewBox)
  const d = `
    M 3,5
    C 0,10 0,17 6,20
    C 12,23 12,30 9,35
    Q 7,38 10,39
    C 13,38 13,36 11,35
    C 8,31 8,25 14,20
    C 20,15 20,10 17,5
    Q 15,2 12,2
    Q 6,2 3,5
    Z
  `;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shading === 'striped' && <StripesPattern id={patternId} color={strokeColor} />}
      <Path
        d={d}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        fill={getFill(color, shading, patternId, background)}
      />
    </Svg>
  );
});

const styles = StyleSheet.create({
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
  coinBadge: {
    top: 3,
    left: 3,
    backgroundColor: '#FFD54A',
    borderWidth: 1,
    borderColor: '#B07D00',
  },
  coinBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#5C3D00',
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
    maxWidth: '64%',
    paddingHorizontal: 4,
  },
  catalystBadgeText: {
    flexShrink: 1,
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.deepOnyx,
    letterSpacing: 0.3,
  },
  mirrorInnerFrame: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: RADIUS.module - 3,
    borderWidth: 2,
    borderColor: 'rgba(14, 165, 233, 0.72)',
    backgroundColor: 'rgba(224, 242, 254, 0.14)',
  },
  tightropeInnerFrame: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: RADIUS.module - 3,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(217, 119, 6, 0.82)',
  },
  tightropeInnerFrameNested: {
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: RADIUS.module - 5,
  },
  slotMarkRow: {
    position: 'absolute',
    top: 2,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 2,
    zIndex: 9,
  },
  mirrorSlotBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tightropeSlotBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    gap: 2,
  },
  timerPillLabel: {
    fontSize: 9,
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
  selected: {
    borderColor: COLORS.actionYellow,
    // borderWidth removed - now using consistent 3px border
    shadowColor: COLORS.actionYellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    elevation: 8,
  },
  // Pointed out: a warm fill (never a border: those are for selection)
  hint: {
    backgroundColor: '#FFF3B0',
  },
  // Note: Fire state is shown via small icon in bottom left, not border
  // Borders/outlines are EXCLUSIVELY for selection state
  fireOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.module - 2, // Slightly smaller to not overlap card border
  },
  lockedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 6 },
  cursedOverlay: { backgroundColor: 'rgba(88, 28, 135, 0.38)' },
  frozenOverlay: { backgroundColor: 'rgba(125, 211, 252, 0.5)' },
  wildContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  wildText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#7C3AED' },
  // State indicator icons & timers in one non-overlapping bottom-left flex row
  stateIndicatorContainer: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
    zIndex: 12,
  },
  stateIndicator: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    flexDirection: 'row',
    gap: 1,
    paddingHorizontal: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  stateIndicatorLabel: {
    fontSize: 8,
    fontWeight: '900',
    paddingRight: 1,
  },
  disabled: {
    opacity: 0.6,
  },
  // Dud card styling - blank/white unmatchable card
  dudCard: {
    backgroundColor: '#E5E5E5', // Grayed out
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
  // Countdown card - urgent timer border
  countdownCard: {
    borderColor: COLORS.impactOrange,
    shadowColor: COLORS.impactOrange,
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  // Bomb card - red urgent border
  bombCard: {
    borderColor: COLORS.impactRed,
    shadowColor: COLORS.impactRed,
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  // Timer overlay (shared by countdown and bomb — sits inside bottom-left badge tray)
  timerOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    gap: 2,
  },
  bombOverlay: {
    borderColor: COLORS.impactRed,
    backgroundColor: 'rgba(255, 113, 105, 0.15)',
  },
  timerOverlayUrgent: {
    backgroundColor: 'rgba(255, 113, 105, 0.3)',
    borderColor: COLORS.impactRed,
  },
  timerText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: COLORS.slateCharcoal,
  },
  timerTextUrgent: {
    color: COLORS.impactRed,
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
  badgeTopLeft: {
    top: 2,
    left: 2,
  },
  badgeBottomRight: {
    bottom: 2,
    right: 2,
  },
  badgeBottomLeft: {
    bottom: 2,
    left: 2,
  },
  badgeText: {
    color: COLORS.canvasWhite,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  badgeEmoji: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.canvasWhite,
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
  prev.onClick === next.onClick &&
  prev.onBurnComplete === next.onBurnComplete &&
  areCardsShallowEqual(prev.card, next.card);

export default memo(Card, areCardPropsEqual);
