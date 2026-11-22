/**
 * Prism Deck — Balatro-Style Shop Between Blinds.
 *
 * Displays last Blind payout breakdown, reorderable/sellable Charm Belt,
 * Held Spells strip, 3 Charms (with live SYNERGY! telegraphing), 2 Star Charts,
 * 2-3 Spells, 1 Ante Voucher, Reroll, Deck/Hands viewer, and Next Blind CTA.
 */
import React, { useContext, useMemo, useState } from 'react';
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
import { WeaponArtwork } from '@/components/weapons/WeaponArtwork';
import {
  CHARM_BY_ID,
  PATTERN_HAND_BY_ID,
  SPELL_BY_ID,
  VICTORY_ANTE,
  VOUCHER_BY_ID,
  getPatternHandStats,
  getSynergiesForCharm,
} from '@/prism';
import type { CharmRole, PrismRun } from '@/prism';
import PrismDeckModal from './PrismDeckModal';
import PrismJokerBelt from './PrismJokerBelt';
import { PRISM_COLORS, playPrismSfx, roleColor } from './prismTheme';

export interface PrismShopProps {
  run: PrismRun;
  onBuyCharm: (offerIndex: number) => void;
  onBuyStarChart: (offerIndex: number) => void;
  onBuySpell: (offerIndex: number) => void;
  onBuyVoucher: () => void;
  onReroll: () => void;
  onReorderCharm: (fromIndex: number, toIndex: number) => void;
  onSellCharm: (index: number) => void;
  onLeaveShop: () => void;
  onOpenPause: () => void;
}

const ROLE_LABELS: Record<CharmRole, string> = {
  chips: '+Chips',
  mult: '+Mult',
  xmult: '×Mult',
  econ: 'Econ',
  utility: 'Utility',
};

const RARITY_LABELS: Record<'common' | 'uncommon' | 'rare', string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
};

const ARTWORK_RARITY: Record<'common' | 'uncommon' | 'rare', 'common' | 'rare' | 'epic'> = {
  common: 'common',
  uncommon: 'rare',
  rare: 'epic',
};

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const PrismShop: React.FC<PrismShopProps> = ({
  run,
  onBuyCharm,
  onBuyStarChart,
  onBuySpell,
  onBuyVoucher,
  onReroll,
  onReorderCharm,
  onSellCharm,
  onLeaveShop,
  onOpenPause,
}) => {
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const { width } = useWindowDimensions();
  const isWide = width >= 820;

  const [deckModalOpen, setDeckModalOpen] = useState(false);

  const shop = run.shop;
  const ownedCharmIds = useMemo(
    () => new Set(run.charms.map(c => c.charmId)),
    [run.charms]
  );

  if (!shop) return null;

  const charmBeltFull = run.charms.length >= run.maxCharms;
  const spellPocketFull = run.spells.length >= run.maxSpells;
  const canReroll = run.gold >= shop.rerollCost;
  const isAfterBoss = run.blindIndex >= 2;
  const payout = run.lastBlindPayout;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(8, insets.bottom) }]}>
      {/* Top Shop Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Icon name="lorc/cash" size={20} color={PRISM_COLORS.gold} />
          <View>
            <Text style={styles.shopTitle}>PRISM SHOP</Text>
            <Text style={styles.shopSub}>
              {run.isEndless ? `Endless Ante ${run.ante}` : `Ante ${run.ante} / ${VICTORY_ANTE}`}
              {shop.discountedFromTag ? ' · 50% OFF COUPON' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.goldPill}>
            <Text style={styles.goldPillText}>${run.gold}</Text>
          </View>
          <Pressable
            testID="prism-shop-pause"
            onPress={() => {
              playPrismSfx('click');
              onOpenPause();
            }}
            accessibilityLabel="Pause Menu"
            style={({ pressed }) => [
              styles.pauseBtn,
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
          {/* Last Blind Payout Breakdown */}
          {payout && (
            <View style={styles.payoutBar} testID="prism-shop-payout">
              <Text style={styles.payoutLabel}>LAST BLIND PAYOUT</Text>
              <View style={styles.payoutChips}>
                <Text style={styles.payoutItem}>Base +${payout.blindReward}</Text>
                <Text style={styles.payoutSep}>·</Text>
                <Text style={styles.payoutItem}>Unused Hands +${payout.unusedHandsGold}</Text>
                <Text style={styles.payoutSep}>·</Text>
                <Text style={styles.payoutItem}>Interest +${payout.interestGold}</Text>
                {payout.charmBonusGold > 0 && (
                  <>
                    <Text style={styles.payoutSep}>·</Text>
                    <Text style={styles.payoutItem}>Charms +${payout.charmBonusGold}</Text>
                  </>
                )}
                {payout.investmentTagGold > 0 && (
                  <>
                    <Text style={styles.payoutSep}>·</Text>
                    <Text style={styles.payoutItem}>Investment +${payout.investmentTagGold}</Text>
                  </>
                )}
                <Text style={styles.payoutSep}>=</Text>
                <Text style={styles.payoutTotal}>+${payout.totalGold}</Text>
              </View>
            </View>
          )}

          {/* Owned Charm Belt (reorder & sell directly in shop) */}
          <PrismJokerBelt
            run={run}
            canReorder
            canSell
            onReorder={onReorderCharm}
            onSell={onSellCharm}
          />

          {/* Held Spells Strip */}
          <View style={styles.heldSpellsBar}>
            <Text style={styles.heldSpellsLabel}>
              SPELL POCKET ({run.spells.length}/{run.maxSpells})
            </Text>
            <View style={styles.heldSpellsRow}>
              {run.spells.length === 0 ? (
                <Text style={styles.heldEmptyText}>No Spells held — buy below to bend your deck.</Text>
              ) : (
                run.spells.map(sp => {
                  const def = SPELL_BY_ID[sp.spellId];
                  return (
                    <View key={sp.instanceId} style={styles.heldSpellChip}>
                      <Icon name={def.icon} size={14} color={def.accentColor} />
                      <Text style={styles.heldSpellText}>{def.name}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Toast */}
          {run.lastToast && (
            <View style={styles.toastStrip}>
              <Icon name="delapouite/sparkles" size={14} color={PRISM_COLORS.gold} />
              <Text style={styles.toastText}>{run.lastToast}</Text>
            </View>
          )}

          {/* SHELF 1: CHARMS (3 slots) */}
          <View style={styles.shelfSection}>
            <View style={styles.shelfHeaderRow}>
              <Text style={styles.shelfTitle}>CHARMS</Text>
              <Text style={styles.shelfSub}>
                Belt {run.charms.length}/{run.maxCharms} · Triggers left-to-right
              </Text>
            </View>
            <View style={[styles.shelfGrid, isWide && styles.shelfGrid3Col]}>
              {shop.charms.map((offer, idx) => {
                const def = CHARM_BY_ID[offer.charmId];
                if (!def) return null;
                const synergies = getSynergiesForCharm(def.id);
                const completedSynergy = synergies.find(pair => {
                  const partner = pair.charmA === def.id ? pair.charmB : pair.charmA;
                  return ownedCharmIds.has(partner);
                });
                const potentialSynergy = !completedSynergy ? synergies[0] : null;
                const potentialPartnerId = potentialSynergy
                  ? potentialSynergy.charmA === def.id
                    ? potentialSynergy.charmB
                    : potentialSynergy.charmA
                  : null;
                const canAfford = run.gold >= offer.price;
                const disabled = offer.sold || charmBeltFull || !canAfford;
                const rColor = roleColor(def.role);

                return (
                  <Pressable
                    key={`${offer.charmId}-${idx}`}
                    testID={`prism-shop-charm-${idx}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    onPress={() => {
                      if (disabled) return;
                      playPrismSfx('buy');
                      onBuyCharm(idx);
                    }}
                    style={({ pressed }) => [
                      styles.offerCard,
                      isWide && styles.offerCard3Col,
                      completedSynergy && !offer.sold && styles.synergyOfferCard,
                      offer.sold && styles.offerCardSold,
                      !offer.sold && disabled && styles.offerCardUnaffordable,
                      pressed && !disabled && styles.pressed,
                      Platform.OS === 'web' && !disabled && { cursor: 'pointer' as never },
                    ]}
                  >
                    {/* Glowing SYNERGY! Pill */}
                    {completedSynergy && !offer.sold && (
                      <View style={styles.synergyBanner} testID={`prism-shop-synergy-${idx}`}>
                        <Icon name={completedSynergy.icon} size={14} color={PRISM_COLORS.feltBg} />
                        <Text style={styles.synergyBannerText}>
                          SYNERGY! {completedSynergy.name}
                        </Text>
                      </View>
                    )}

                    <View style={styles.offerTopRow}>
                      <View style={[styles.artworkBox, { borderColor: def.accentColor }]}>
                        {def.artworkWeaponId ? (
                          <WeaponArtwork name={def.artworkWeaponId} rarity={ARTWORK_RARITY[def.rarity]} />
                        ) : (
                          <Icon name={def.icon} size={28} color={def.accentColor} />
                        )}
                      </View>

                      <View style={styles.offerTitleWrap}>
                        <Text style={styles.offerName}>{def.name}</Text>
                        <View style={styles.badgeRow}>
                          <View style={[styles.rolePill, { borderColor: rColor }]}>
                            <Text style={[styles.rolePillText, { color: rColor }]}>
                              {ROLE_LABELS[def.role]}
                            </Text>
                          </View>
                          <Text style={styles.rarityText}>{RARITY_LABELS[def.rarity]}</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.offerDesc}>{def.description}</Text>

                    {completedSynergy && !offer.sold && (
                      <Text style={styles.synergyBonusNote}>{completedSynergy.description}</Text>
                    )}
                    {potentialSynergy && potentialPartnerId && !offer.sold && (
                      <Text style={styles.synergyHintText}>
                        Pairs with {CHARM_BY_ID[potentialPartnerId]?.name ?? potentialPartnerId}
                      </Text>
                    )}

                    <View style={styles.buyRow}>
                      <View
                        style={[
                          styles.priceBtn,
                          offer.sold && styles.priceBtnSold,
                          !offer.sold && !disabled && styles.priceBtnBuyable,
                        ]}
                      >
                        <Text
                          style={[
                            styles.priceBtnText,
                            !offer.sold && !disabled && styles.priceBtnTextBuyable,
                          ]}
                        >
                          {offer.sold
                            ? 'SOLD'
                            : charmBeltFull
                              ? 'Belt Full'
                              : offer.price === 0 || offer.freeFromTag
                                ? 'FREE!'
                                : `Buy · $${offer.price}`}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* SHELF 2 & 3: STAR CHARTS (2) & SPELLS (2-3) */}
          <View style={[styles.splitRow, isWide && styles.splitRowWide]}>
            {/* Star Charts */}
            <View style={[styles.shelfSection, isWide && styles.splitCol]}>
              <View style={styles.shelfHeaderRow}>
                <Text style={styles.shelfTitle}>STAR CHARTS</Text>
                <Text style={styles.shelfSub}>Permanent Hand upgrades</Text>
              </View>
              <View style={styles.stackGap}>
                {shop.starCharts.map((offer, idx) => {
                  const hand = PATTERN_HAND_BY_ID[offer.handId];
                  const curLv = run.handLevels[offer.handId] ?? 1;
                  const nextLv = curLv + offer.levelsGranted;
                  const curStats = getPatternHandStats(offer.handId, curLv);
                  const nextStats = getPatternHandStats(offer.handId, nextLv);
                  const disabled = offer.sold || run.gold < offer.price;

                  return (
                    <Pressable
                      key={`${offer.handId}-${idx}`}
                      testID={`prism-shop-chart-${idx}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => {
                        if (disabled) return;
                        playPrismSfx('buy');
                        onBuyStarChart(idx);
                      }}
                      style={({ pressed }) => [
                        styles.compactOfferCard,
                        offer.sold && styles.offerCardSold,
                        !offer.sold && disabled && styles.offerCardUnaffordable,
                        pressed && !disabled && styles.pressed,
                        Platform.OS === 'web' && !disabled && { cursor: 'pointer' as never },
                      ]}
                    >
                      <View style={[styles.smallIconBox, { borderColor: hand.accentColor }]}>
                        <Icon name="delapouite/falling-star" size={22} color={hand.accentColor} />
                      </View>
                      <View style={styles.compactMid}>
                        <View style={styles.compactTitleRow}>
                          <Text style={styles.offerName}>{hand.name}</Text>
                          <Text style={styles.levelJumpText}>
                            Lv.{curLv} → Lv.{nextLv}
                          </Text>
                        </View>
                        <Text style={styles.statJumpText}>
                          {curStats.chips}×{curStats.mult} →{' '}
                          <Text style={styles.statJumpHighlight}>
                            {nextStats.chips} Chips × {nextStats.mult} Mult
                          </Text>
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.priceTagPill,
                          !offer.sold && !disabled && styles.priceBtnBuyable,
                        ]}
                      >
                        <Text
                          style={[
                            styles.priceTagText,
                            !offer.sold && !disabled && styles.priceBtnTextBuyable,
                          ]}
                        >
                          {offer.sold ? 'SOLD' : `$${offer.price}`}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Spells */}
            <View style={[styles.shelfSection, isWide && styles.splitCol]}>
              <View style={styles.shelfHeaderRow}>
                <Text style={styles.shelfTitle}>SPELLS</Text>
                <Text style={styles.shelfSub}>
                  Pocket {run.spells.length}/{run.maxSpells}
                </Text>
              </View>
              <View style={styles.stackGap}>
                {shop.spells.map((offer, idx) => {
                  const def = SPELL_BY_ID[offer.spellId];
                  const disabled = offer.sold || spellPocketFull || run.gold < offer.price;

                  return (
                    <Pressable
                      key={`${offer.spellId}-${idx}`}
                      testID={`prism-shop-spell-${idx}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => {
                        if (disabled) return;
                        playPrismSfx('buy');
                        onBuySpell(idx);
                      }}
                      style={({ pressed }) => [
                        styles.compactOfferCard,
                        offer.sold && styles.offerCardSold,
                        !offer.sold && disabled && styles.offerCardUnaffordable,
                        pressed && !disabled && styles.pressed,
                        Platform.OS === 'web' && !disabled && { cursor: 'pointer' as never },
                      ]}
                    >
                      <View style={[styles.smallIconBox, { borderColor: def.accentColor }]}>
                        <Icon name={def.icon} size={22} color={def.accentColor} />
                      </View>
                      <View style={styles.compactMid}>
                        <View style={styles.compactTitleRow}>
                          <Text style={styles.offerName}>{def.name}</Text>
                          <Text style={styles.spellShortText}>{def.shortLabel}</Text>
                        </View>
                        <Text style={styles.offerDescCompact}>{def.description}</Text>
                      </View>
                      <View
                        style={[
                          styles.priceTagPill,
                          !offer.sold && !disabled && styles.priceBtnBuyable,
                        ]}
                      >
                        <Text
                          style={[
                            styles.priceTagText,
                            !offer.sold && !disabled && styles.priceBtnTextBuyable,
                          ]}
                        >
                          {offer.sold
                            ? 'SOLD'
                            : spellPocketFull
                              ? 'Pocket Full'
                              : `$${offer.price}`}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* SHELF 4: ANTE VOUCHER (1 slot) */}
          <View style={styles.shelfSection}>
            <View style={styles.shelfHeaderRow}>
              <Text style={styles.shelfTitle}>ANTE VOUCHER</Text>
              <Text style={styles.shelfSub}>1 permanent upgrade per Ante</Text>
            </View>
            {shop.voucher ? (
              (() => {
                const vDef = VOUCHER_BY_ID[shop.voucher.voucherId];
                const disabled = shop.voucher.sold || run.gold < shop.voucher.price;
                return (
                  <Pressable
                    testID="prism-shop-voucher"
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    onPress={() => {
                      if (disabled) return;
                      playPrismSfx('big_hit');
                      onBuyVoucher();
                    }}
                    style={({ pressed }) => [
                      styles.voucherCard,
                      shop.voucher?.sold && styles.offerCardSold,
                      !shop.voucher?.sold && disabled && styles.offerCardUnaffordable,
                      pressed && !disabled && styles.pressed,
                      Platform.OS === 'web' && !disabled && { cursor: 'pointer' as never },
                    ]}
                  >
                    <View style={[styles.smallIconBox, { borderColor: vDef.accentColor }]}>
                      <Icon name={vDef.icon} size={24} color={vDef.accentColor} />
                    </View>
                    <View style={styles.compactMid}>
                      <View style={styles.compactTitleRow}>
                        <Text style={styles.offerName}>{vDef.name}</Text>
                        <View style={styles.permBadge}>
                          <Text style={styles.permBadgeText}>PERMANENT</Text>
                        </View>
                      </View>
                      <Text style={styles.offerDescCompact}>{vDef.description}</Text>
                    </View>
                    <View
                      style={[
                        styles.priceTagPill,
                        !shop.voucher.sold && !disabled && styles.priceBtnBuyable,
                      ]}
                    >
                      <Text
                        style={[
                          styles.priceTagText,
                          !shop.voucher.sold && !disabled && styles.priceBtnTextBuyable,
                        ]}
                      >
                        {shop.voucher.sold ? 'OWNED' : `$${shop.voucher.price}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })()
            ) : (
              <View style={styles.voucherClaimedCard} testID="prism-shop-voucher">
                <Icon name="lorc/checked-shield" size={18} color={PRISM_COLORS.econGreen} />
                <Text style={styles.voucherClaimedText}>
                  This Ante&apos;s Voucher has already been claimed!
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Footer Action Bar */}
      <View style={styles.footerBar}>
        <Pressable
          testID="prism-shop-reroll"
          disabled={!canReroll}
          onPress={() => {
            if (!canReroll) return;
            playPrismSfx('reroll');
            onReroll();
          }}
          style={({ pressed }) => [
            styles.rerollBtn,
            !canReroll && styles.btnDisabled,
            pressed && canReroll && styles.pressed,
            Platform.OS === 'web' && canReroll && { cursor: 'pointer' as never },
          ]}
        >
          <Icon name="lorc/cycle" size={16} color={PRISM_COLORS.chipsBlue} />
          <Text style={styles.rerollBtnText}>Reroll (${shop.rerollCost})</Text>
        </Pressable>

        <Pressable
          testID="prism-shop-deck"
          onPress={() => {
            playPrismSfx('click');
            setDeckModalOpen(true);
          }}
          style={({ pressed }) => [
            styles.deckBtn,
            pressed && styles.pressed,
            Platform.OS === 'web' && { cursor: 'pointer' as never },
          ]}
        >
          <Icon name="delapouite/stack" size={16} color={PRISM_COLORS.textPrimary} />
          <Text style={styles.deckBtnText}>Deck / Hands</Text>
        </Pressable>

        <Pressable
          testID="prism-shop-leave"
          onPress={() => {
            playPrismSfx('click');
            onLeaveShop();
          }}
          style={({ pressed }) => [
            styles.leaveBtn,
            pressed && styles.pressed,
            Platform.OS === 'web' && { cursor: 'pointer' as never },
          ]}
        >
          <Text style={styles.leaveBtnText}>
            {isAfterBoss ? `Next Ante (${run.ante + 1}) →` : 'Next Blind →'}
          </Text>
        </Pressable>
      </View>

      <PrismDeckModal
        visible={deckModalOpen}
        run={run}
        initialTab="deck"
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderBottomWidth: 1,
    borderBottomColor: PRISM_COLORS.feltBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shopTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: PRISM_COLORS.gold,
  },
  shopSub: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goldPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(242, 201, 76, 0.18)',
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.gold,
  },
  goldPillText: {
    fontSize: 16,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  pauseBtn: {
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
    padding: 14,
    alignItems: 'center',
    paddingBottom: 24,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 1040,
    gap: 12,
  },
  payoutBar: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
  },
  payoutLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: PRISM_COLORS.textMuted,
  },
  payoutChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  payoutItem: {
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  payoutSep: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
  },
  payoutTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  heldSpellsBar: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  heldSpellsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: PRISM_COLORS.textMuted,
  },
  heldSpellsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  heldEmptyText: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
  },
  heldSpellChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
  },
  heldSpellText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  toastStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(242, 201, 76, 0.14)',
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
  },
  toastText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  shelfSection: {
    gap: 8,
  },
  shelfHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  shelfTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: PRISM_COLORS.gold,
  },
  shelfSub: {
    fontSize: 11,
    color: PRISM_COLORS.textMuted,
  },
  shelfGrid: {
    gap: 10,
  },
  shelfGrid3Col: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  offerCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 12,
    gap: 8,
  },
  offerCard3Col: {
    flex: 1,
  },
  synergyOfferCard: {
    borderWidth: 2,
    borderColor: PRISM_COLORS.gold,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  offerCardSold: {
    opacity: 0.45,
  },
  offerCardUnaffordable: {
    opacity: 0.72,
  },
  synergyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: PRISM_COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  synergyBannerText: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
    letterSpacing: 0.4,
  },
  offerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  artworkBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: PRISM_COLORS.feltBg,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  offerName: {
    fontSize: 14,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rolePill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: PRISM_COLORS.feltBg,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rarityText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  offerDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: PRISM_COLORS.textMuted,
  },
  synergyBonusNote: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    color: PRISM_COLORS.gold,
  },
  synergyHintText: {
    fontSize: 11,
    color: PRISM_COLORS.xMultPurple,
    fontWeight: '700',
  },
  buyRow: {
    marginTop: 'auto',
    paddingTop: 4,
  },
  priceBtn: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  priceBtnBuyable: {
    backgroundColor: PRISM_COLORS.gold,
    borderColor: '#FFF3C4',
  },
  priceBtnSold: {
    backgroundColor: PRISM_COLORS.feltBg,
  },
  priceBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.textMuted,
  },
  priceBtnTextBuyable: {
    color: PRISM_COLORS.feltBg,
  },
  splitRow: {
    gap: 12,
  },
  splitRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  splitCol: {
    flex: 1,
  },
  stackGap: {
    gap: 8,
  },
  compactOfferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 10,
  },
  smallIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: PRISM_COLORS.feltBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactMid: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  compactTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  levelJumpText: {
    fontSize: 12,
    fontWeight: '900',
    color: PRISM_COLORS.chipsBlue,
  },
  statJumpText: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
  },
  statJumpHighlight: {
    color: PRISM_COLORS.textPrimary,
    fontWeight: '800',
  },
  spellShortText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.econGreen,
  },
  offerDescCompact: {
    fontSize: 11,
    lineHeight: 16,
    color: PRISM_COLORS.textMuted,
  },
  priceTagPill: {
    minWidth: 62,
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceTagText: {
    fontSize: 12,
    fontWeight: '900',
    color: PRISM_COLORS.textMuted,
    textAlign: 'center',
  },
  voucherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.xMultPurple,
    padding: 12,
  },
  permBadge: {
    backgroundColor: 'rgba(192, 132, 252, 0.22)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  permBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.xMultPurple,
  },
  voucherClaimedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltSurface,
  },
  voucherClaimedText: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
    fontWeight: '700',
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderTopWidth: 1,
    borderTopColor: PRISM_COLORS.feltBorder,
  },
  rerollBtn: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.chipsBlue,
    backgroundColor: PRISM_COLORS.feltElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rerollBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.chipsBlue,
  },
  deckBtn: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deckBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  leaveBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.gold,
    borderWidth: 2,
    borderColor: '#FFF3C4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  leaveBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});

export default PrismShop;
