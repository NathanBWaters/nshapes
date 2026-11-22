/**
 * Prism Deck — Classic 3-Blind Ante Selector (Small, Big, Boss).
 *
 * Displays Target Score, Base Reward, Skip-Blind Tag rewards, and Boss Blind
 * rule twists alongside the reorderable Charm Belt and Deck/Hands modal.
 */
import React, { useContext, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import {
  BOSS_BLIND_BY_ID,
  DAILY_MUTATOR_BY_ID,
  SKIP_TAG_BY_ID,
  VICTORY_ANTE,
} from '@/prism';
import type { BlindOffer, PrismRun } from '@/prism';
import PrismDeckModal from './PrismDeckModal';
import PrismJokerBelt from './PrismJokerBelt';
import { PRISM_COLORS, formatScore, playPrismSfx } from './prismTheme';

export interface PrismBlindSelectProps {
  run: PrismRun;
  onPlayBlind: () => void;
  onSkipBlind: () => void;
  onReorderCharm: (fromIndex: number, toIndex: number) => void;
  onSellCharm: (index: number) => void;
  onOpenPause: () => void;
}

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const PrismBlindSelect: React.FC<PrismBlindSelectProps> = ({
  run,
  onPlayBlind,
  onSkipBlind,
  onReorderCharm,
  onSellCharm,
  onOpenPause,
}) => {
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const { width } = useWindowDimensions();
  const isWide = width >= 820;

  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [deckTab, setDeckTab] = useState<'deck' | 'hands'>('deck');

  const mutator = run.dailyMutatorId ? DAILY_MUTATOR_BY_ID[run.dailyMutatorId] : null;
  const activeOffer = run.anteBlinds[run.blindIndex];

  const pendingBadges: string[] = [];
  if (run.pendingTags.investmentCount > 0) {
    pendingBadges.push(`Investment: +$${run.pendingTags.investmentCount * 15} after Boss`);
  }
  if (run.pendingTags.freeRareCharmNextShop) {
    pendingBadges.push('Next Shop: Free Rare Charm');
  }
  if (run.pendingTags.couponHalfOffNextShop) {
    pendingBadges.push('Next Shop: 50% OFF Coupon');
  }
  if (run.pendingTags.bonusHandsNextBlind > 0) {
    pendingBadges.push(`Next Blind: +${run.pendingTags.bonusHandsNextBlind} Hands`);
  }

  const openViewer = (tab: 'deck' | 'hands') => {
    playPrismSfx('click');
    setDeckTab(tab);
    setDeckModalOpen(true);
  };

  const renderBlindCard = (offer: BlindOffer, idx: number) => {
    const isCurrent = idx === run.blindIndex && offer.status === 'upcoming';
    const isCleared = offer.status === 'cleared';
    const isSkipped = offer.status === 'skipped';
    const isLocked = idx > run.blindIndex && offer.status === 'upcoming';
    const isBoss = offer.kind === 'boss';
    const bossDef = offer.bossId ? BOSS_BLIND_BY_ID[offer.bossId] : null;
    const tagDef = offer.skipTagId ? SKIP_TAG_BY_ID[offer.skipTagId] : null;

    const kindLabel =
      offer.kind === 'small' ? 'SMALL BLIND' : offer.kind === 'big' ? 'BIG BLIND' : 'BOSS BLIND';
    const cardIcon = isBoss
      ? bossDef?.icon ?? 'lorc/dragon-head'
      : offer.kind === 'big'
        ? 'lorc/crown-coin'
        : 'delapouite/token';
    const accent = isBoss
      ? bossDef?.accentColor ?? PRISM_COLORS.multRed
      : offer.kind === 'big'
        ? PRISM_COLORS.gold
        : PRISM_COLORS.chipsBlue;

    const statusBadge = isCurrent
      ? { text: 'UP NEXT', bg: PRISM_COLORS.gold, color: PRISM_COLORS.feltBg }
      : isCleared
        ? { text: 'CLEARED ✓', bg: 'rgba(52, 211, 153, 0.22)', color: PRISM_COLORS.econGreen }
        : isSkipped
          ? { text: 'SKIPPED', bg: 'rgba(242, 201, 76, 0.16)', color: PRISM_COLORS.gold }
          : { text: 'UPCOMING', bg: PRISM_COLORS.feltBg, color: PRISM_COLORS.textMuted };

    return (
      <View
        key={`${offer.kind}-${idx}`}
        testID={`prism-blind-card-${offer.kind}`}
        style={[
          styles.blindCard,
          isWide && styles.blindCardWide,
          isCurrent && styles.blindCardActive,
          (isCleared || isSkipped) && styles.blindCardDone,
          isLocked && styles.blindCardLocked,
          isBoss && isCurrent && { borderColor: accent },
        ]}
      >
        {/* Top Tag + Status Row */}
        <View style={styles.blindTopRow}>
          <Text style={[styles.blindKindLabel, { color: accent }]}>{kindLabel}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusBadge.bg }]}>
            <Text style={[styles.statusPillText, { color: statusBadge.color }]}>
              {statusBadge.text}
            </Text>
          </View>
        </View>

        {/* Blind Emblem & Name */}
        <View style={styles.blindIdentityRow}>
          <View style={[styles.blindIconCircle, { borderColor: accent }]}>
            <Icon name={cardIcon} size={26} color={accent} />
          </View>
          <View style={styles.blindTitleWrap}>
            <Text style={styles.blindName}>{offer.name}</Text>
            <Text style={styles.blindRewardText}>
              Reward: <Text style={styles.goldText}>+${offer.rewardGold}</Text> + Hands &amp; Interest
            </Text>
          </View>
        </View>

        {/* Target Score Box */}
        <View style={styles.scoreTargetBox}>
          <Text style={styles.scoreTargetLabel}>SCORE AT LEAST</Text>
          <Text style={[styles.scoreTargetVal, isBoss && styles.scoreTargetBoss]}>
            {formatScore(offer.targetScore)}
          </Text>
        </View>

        {/* Boss Rule OR Skip Tag Reward */}
        {isBoss && bossDef ? (
          <View style={[styles.bossRuleBox, { borderColor: bossDef.accentColor }]}>
            <View style={styles.bossRuleHeader}>
              <Icon name="lorc/laser-warning" size={15} color={bossDef.accentColor} />
              <Text style={[styles.bossRuleShort, { color: PRISM_COLORS.textPrimary }]}>
                {bossDef.shortRule}
              </Text>
            </View>
            <Text style={styles.bossRuleDesc}>{bossDef.description}</Text>
          </View>
        ) : tagDef ? (
          <View style={styles.skipTagBox}>
            <View style={styles.skipTagHeader}>
              <Icon name={tagDef.icon} size={17} color={tagDef.accentColor} />
              <Text style={styles.skipTagTitle}>Skip Tag: {tagDef.name}</Text>
            </View>
            <Text style={styles.skipTagDesc}>{tagDef.description}</Text>
          </View>
        ) : null}

        {/* Action Buttons on Current Blind */}
        {isCurrent && (
          <View style={styles.blindBtnStack}>
            <Pressable
              testID="prism-play-blind"
              onPress={() => {
                playPrismSfx('play');
                onPlayBlind();
              }}
              style={({ pressed }) => [
                styles.playBlindBtn,
                pressed && styles.pressed,
                Platform.OS === 'web' && { cursor: 'pointer' as never },
              ]}
            >
              <Text style={styles.playBlindText}>Play {offer.kind === 'boss' ? 'Boss Blind' : offer.name}</Text>
            </Pressable>

            {!isBoss && tagDef && (
              <Pressable
                testID="prism-skip-blind"
                onPress={() => {
                  playPrismSfx('reroll');
                  onSkipBlind();
                }}
                style={({ pressed }) => [
                  styles.skipBlindBtn,
                  pressed && styles.pressed,
                  Platform.OS === 'web' && { cursor: 'pointer' as never },
                ]}
              >
                <Icon name={tagDef.icon} size={16} color={PRISM_COLORS.gold} />
                <Text style={styles.skipBlindText}>Skip for {tagDef.name}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(12, insets.bottom) }]}>
      {/* Top HUD Bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <View style={[styles.antePill, run.isEndless && styles.antePillEndless]}>
            <Icon
              name={run.isEndless ? 'various-artists/infinity' : 'delapouite/prism'}
              size={16}
              color={run.isEndless ? PRISM_COLORS.xMultPurple : PRISM_COLORS.gold}
            />
            <Text style={styles.antePillText}>
              {run.isEndless ? `Endless Ante ${run.ante}` : `Ante ${run.ante} / ${VICTORY_ANTE}`}
            </Text>
          </View>

          <View style={styles.moneyPill}>
            <Text style={styles.moneyPillText}>${run.gold}</Text>
          </View>

          {mutator && (
            <View style={styles.mutatorChip}>
              <Icon name={mutator.icon} size={14} color={mutator.accentColor} />
              <Text style={styles.mutatorChipText}>{mutator.name}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          <Pressable
            testID="prism-blind-deck-btn"
            onPress={() => openViewer('deck')}
            style={({ pressed }) => [
              styles.hudBtn,
              pressed && styles.pressed,
              Platform.OS === 'web' && { cursor: 'pointer' as never },
            ]}
          >
            <Icon name="delapouite/stack" size={16} color={PRISM_COLORS.textPrimary} />
            <Text style={styles.hudBtnText}>Deck ({run.deck.length})</Text>
          </Pressable>

          <Pressable
            testID="prism-blind-hands-btn"
            onPress={() => openViewer('hands')}
            style={({ pressed }) => [
              styles.hudBtn,
              pressed && styles.pressed,
              Platform.OS === 'web' && { cursor: 'pointer' as never },
            ]}
          >
            <Icon name="lorc/poker-hand" size={16} color={PRISM_COLORS.gold} />
            <Text style={styles.hudBtnText}>Hands</Text>
          </Pressable>

          <Pressable
            testID="prism-blind-pause"
            onPress={() => {
              playPrismSfx('click');
              onOpenPause();
            }}
            accessibilityLabel="Pause Menu"
            style={({ pressed }) => [
              styles.iconOnlyBtn,
              pressed && styles.pressed,
              Platform.OS === 'web' && { cursor: 'pointer' as never },
            ]}
          >
            <Icon name="lorc/gear-hammer" size={18} color={PRISM_COLORS.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerWrap}>
          {/* Charm Belt Summary (reorder before Boss!) */}
          <PrismJokerBelt
            run={run}
            canReorder
            canSell
            onReorder={onReorderCharm}
            onSell={onSellCharm}
            compact
          />

          {/* Toast & Pending Tag Effects */}
          {run.lastToast && (
            <View style={styles.toastBar}>
              <Icon name="delapouite/sparkles" size={15} color={PRISM_COLORS.gold} />
              <Text style={styles.toastText}>{run.lastToast}</Text>
            </View>
          )}

          {pendingBadges.length > 0 && (
            <View style={styles.pendingRow}>
              {pendingBadges.map(badge => (
                <View key={badge} style={styles.pendingChip}>
                  <Text style={styles.pendingChipText}>{badge}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Section Title */}
          <View style={styles.stageHeader}>
            <Text style={styles.stageEyebrow}>
              {activeOffer ? `CHOOSE YOUR APPROACH · ${activeOffer.name.toUpperCase()}` : 'ANTE BLINDS'}
            </Text>
            <Text style={styles.stageHint}>
              Play each Blind to earn Gold &amp; visit the Shop, or Skip Small/Big Blinds to claim their Tag.
            </Text>
          </View>

          {/* 3-Blind Row / Stack */}
          <View style={[styles.blindsWrap, isWide && styles.blindsWrapWide]}>
            {run.anteBlinds.map((offer, idx) => renderBlindCard(offer, idx))}
          </View>
        </View>
      </ScrollView>

      <PrismDeckModal
        visible={deckModalOpen}
        run={run}
        initialTab={deckTab}
        onClose={() => setDeckModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PRISM_COLORS.feltBg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderBottomWidth: 1,
    borderBottomColor: PRISM_COLORS.feltBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  antePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
  },
  antePillEndless: {
    borderColor: PRISM_COLORS.xMultPurple,
  },
  antePillText: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  moneyPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(242, 201, 76, 0.16)',
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.gold,
  },
  moneyPillText: {
    fontSize: 14,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  mutatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: PRISM_COLORS.feltBg,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
  },
  mutatorChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  hudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
  },
  hudBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  iconOnlyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
    paddingBottom: 28,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 1040,
    gap: 12,
  },
  toastBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(242, 201, 76, 0.14)',
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  pendingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pendingChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: PRISM_COLORS.chipsBlue,
  },
  pendingChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.chipsBlue,
  },
  stageHeader: {
    gap: 3,
  },
  stageEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: PRISM_COLORS.gold,
  },
  stageHint: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
  },
  blindsWrap: {
    gap: 12,
  },
  blindsWrapWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  blindCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 14,
    gap: 12,
  },
  blindCardWide: {
    flex: 1,
  },
  blindCardActive: {
    borderWidth: 2,
    borderColor: PRISM_COLORS.gold,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  blindCardDone: {
    opacity: 0.58,
  },
  blindCardLocked: {
    opacity: 0.72,
  },
  blindTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  blindKindLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  blindIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  blindIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: PRISM_COLORS.feltBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blindTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  blindName: {
    fontSize: 18,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  blindRewardText: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
    marginTop: 2,
  },
  goldText: {
    color: PRISM_COLORS.gold,
    fontWeight: '900',
  },
  scoreTargetBox: {
    backgroundColor: PRISM_COLORS.feltBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  scoreTargetLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: PRISM_COLORS.textMuted,
  },
  scoreTargetVal: {
    fontSize: 24,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
    marginTop: 2,
  },
  scoreTargetBoss: {
    color: PRISM_COLORS.multRed,
  },
  bossRuleBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    padding: 10,
    gap: 4,
  },
  bossRuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bossRuleShort: {
    fontSize: 13,
    fontWeight: '900',
  },
  bossRuleDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: PRISM_COLORS.textMuted,
  },
  skipTagBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltBg,
    padding: 10,
    gap: 4,
  },
  skipTagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skipTagTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
    flex: 1,
  },
  skipTagDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: PRISM_COLORS.textMuted,
  },
  blindBtnStack: {
    marginTop: 'auto',
    gap: 8,
  },
  playBlindBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.gold,
    borderWidth: 2,
    borderColor: '#FFF3C4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  playBlindText: {
    fontSize: 15,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
  },
  skipBlindBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
    backgroundColor: PRISM_COLORS.feltSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  skipBlindText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});

export default PrismBlindSelect;
