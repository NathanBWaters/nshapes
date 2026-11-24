/**
 * Prism Deck — Balatro-Style "Blind Cleared / Cash Out" Overlay.
 *
 * Keeps the victorious felt table visible underneath so players feel the
 * final Set smash past the Blind target, inspect their itemized gold payout
 * (Blind Reward + Unused Hands + Interest + Charms/Tags), and deliberately
 * cash out into the Shop instead of teleporting instantaneously.
 */
import React, { useEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { SPRING } from '@/utils/motion';
import { BOSS_BLIND_BY_ID } from '../data/blinds';
import type { PrismRun } from '../types';
import { PRISM_COLORS, formatMult, formatScore, playPrismSfx } from './prismTheme';

export interface PrismCashOutOverlayProps {
  run: PrismRun;
  disabled?: boolean;
  onCashOut: () => void;
}

const PrismCashOutOverlay: React.FC<PrismCashOutOverlayProps> = ({
  run,
  disabled = false,
  onCashOut,
}) => {
  const offer = run.anteBlinds[run.blindIndex];
  const bossDef = offer?.bossId ? BOSS_BLIND_BY_ID[offer.bossId] : null;
  const blindName = bossDef ? bossDef.name : (offer?.name ?? 'Blind');
  const payout = run.lastBlindPayout;
  const lastResult = run.lastScoreBreakdown;

  // Finite spring entrance (GPU-only transform + opacity, zero infinite loops)
  const cardScale = useSharedValue(0.92);
  const cardY = useSharedValue(16);

  useEffect(() => {
    cardScale.value = withSpring(1, SPRING.playful);
    cardY.value = withSpring(0, SPRING.playful);
  }, [cardScale, cardY]);

  // Allow Enter / Space on desktop web to cash out cleanly (unless Pause modal is open)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || disabled) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playPrismSfx('buy');
        onCashOut();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, onCashOut]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }, { scale: cardScale.value }],
  }));

  const handsUsed = Math.max(1, run.handsPlayedThisBlind);
  const handsUnused = Math.max(0, run.handsLeft);
  const totalGold = payout?.totalGold ?? 0;

  return (
    <View testID="prism-cash-out-overlay" style={styles.backdrop}>
      <Animated.View style={[styles.card, cardAnimStyle]}>
        {/* Trophy Header */}
        <View style={styles.header}>
          <View style={styles.trophyBadge}>
            <Icon name="lorc/trophy" size={24} color="#121212" noShadow />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>BLIND CLEARED!</Text>
            <Text style={styles.title} numberOfLines={1}>
              {blindName}
            </Text>
          </View>
          <View style={styles.scoreChip}>
            <Text style={styles.scoreChipValue}>{formatScore(run.blindScore)}</Text>
            <Text style={styles.scoreChipSub}>/ {formatScore(run.blindTarget)}</Text>
          </View>
        </View>

        {/* Winning Set & Hands Summary */}
        <View style={styles.summaryCol}>
          <View style={styles.summaryPill}>
            <Icon name="lorc/poker-hand" size={13} color={PRISM_COLORS.chipsBlue} noShadow />
            <Text style={styles.summaryPillText}>
              Cleared in {handsUsed} Hand{handsUsed === 1 ? '' : 's'}
            </Text>
          </View>
          {lastResult && (
            <View style={[styles.summaryPill, styles.winningSetPill]}>
              <Text style={styles.winningSetName} numberOfLines={1}>
                {lastResult.patternHandName}
              </Text>
              <Text style={styles.winningSetMath} numberOfLines={1}>
                {formatScore(lastResult.finalChips)} × {formatMult(lastResult.finalMult)} = +
                {formatScore(lastResult.finalScore)}
              </Text>
            </View>
          )}
        </View>

        {/* Itemized Balatro Payout Ledger */}
        {payout && (
          <View style={styles.ledger}>
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>Blind Reward</Text>
              <Text style={styles.ledgerValue}>+${payout.blindReward}</Text>
            </View>

            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>
                Unused Hands ({handsUnused} left)
              </Text>
              <Text
                style={[
                  styles.ledgerValue,
                  payout.unusedHandsGold === 0 && styles.ledgerValueMuted,
                ]}
              >
                +${payout.unusedHandsGold}
              </Text>
            </View>

            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>Interest ($1 per $5 banked)</Text>
              <Text
                style={[
                  styles.ledgerValue,
                  payout.interestGold === 0 && styles.ledgerValueMuted,
                ]}
              >
                +${payout.interestGold}
              </Text>
            </View>

            {payout.charmBonusGold > 0 && (
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>Charm Gold Bonus</Text>
                <Text style={styles.ledgerValue}>+${payout.charmBonusGold}</Text>
              </View>
            )}

            {payout.investmentTagGold > 0 && (
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>Investment Tag Payout</Text>
                <Text style={styles.ledgerValue}>+${payout.investmentTagGold}</Text>
              </View>
            )}

            <View style={styles.ledgerDivider} />

            <View style={styles.ledgerRow}>
              <View>
                <Text style={styles.totalLabel}>TOTAL PAYOUT</Text>
                <Text style={styles.bankSubtext}>Bank now: ${run.gold}</Text>
              </View>
              <Text style={styles.totalValue}>+${totalGold}</Text>
            </View>
          </View>
        )}

        {/* Primary Cash Out CTA */}
        <Pressable
          testID="prism-cash-out-btn"
          accessibilityRole="button"
          accessibilityLabel={`Cash Out plus ${totalGold} dollars to Shop`}
          onPress={() => {
            playPrismSfx('buy');
            onCashOut();
          }}
          style={({ pressed }) => [
            styles.cashOutBtn,
            pressed && styles.cashOutBtnPressed,
            Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          ]}
        >
          <Icon name="lorc/crown-coin" size={20} color="#121212" noShadow />
          <Text style={styles.cashOutBtnText}>
            Cash Out (+${totalGold}) → Shop
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 16, 13, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    zIndex: 40,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: PRISM_COLORS.gold,
    padding: 18,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trophyBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: PRISM_COLORS.econGreen,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  scoreChip: {
    alignItems: 'flex-end',
    backgroundColor: PRISM_COLORS.feltBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreChipValue: {
    fontSize: 16,
    fontWeight: '900',
    color: PRISM_COLORS.econGreen,
    fontVariant: ['tabular-nums'],
  },
  scoreChipSub: {
    fontSize: 11,
    fontWeight: '600',
    color: PRISM_COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  summaryCol: {
    gap: 8,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRISM_COLORS.feltBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  winningSetPill: {
    justifyContent: 'space-between',
    borderColor: 'rgba(242, 201, 76, 0.45)',
  },
  winningSetName: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
    flexShrink: 1,
  },
  winningSetMath: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  ledger: {
    backgroundColor: PRISM_COLORS.feltBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 14,
    gap: 9,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ledgerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: PRISM_COLORS.textMuted,
  },
  ledgerValue: {
    fontSize: 14,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
    fontVariant: ['tabular-nums'],
  },
  ledgerValueMuted: {
    color: PRISM_COLORS.textMuted,
    opacity: 0.65,
  },
  ledgerDivider: {
    height: 1,
    backgroundColor: PRISM_COLORS.feltBorder,
    marginVertical: 2,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    color: PRISM_COLORS.textPrimary,
  },
  bankSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: PRISM_COLORS.textMuted,
    marginTop: 1,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
    fontVariant: ['tabular-nums'],
  },
  cashOutBtn: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PRISM_COLORS.gold,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PRISM_COLORS.goldDark,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  cashOutBtnPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  cashOutBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#121212',
    letterSpacing: 0.3,
  },
});

export default PrismCashOutOverlay;
