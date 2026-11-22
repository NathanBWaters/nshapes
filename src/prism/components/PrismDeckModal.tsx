import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from '@/components/Icon';
import { ColorblindStorage } from '@/utils/storage';
import {
  COLOR_LABELS,
  PATTERN_HANDS,
  PRISM_COLORS as CARD_COLOR_LIST,
  PRISM_NUMBERS,
  PRISM_SHAPES,
  SHAPE_LABELS,
  SPECIAL_EDITIONS,
  getPatternHandStats,
  hasCardEdition,
} from '../data/cards';
import { getDeckSummary } from '../engine/run';
import type { PrismCard, PrismRun } from '../types';
import PrismCardTile from './PrismCardTile';
import {
  PRISM_COLORS,
  editionMeta,
  formatMult,
  formatScore,
  getPrismShapeColor,
  playPrismSfx,
} from './prismTheme';

export interface PrismDeckModalProps {
  visible: boolean;
  run: PrismRun;
  initialTab?: 'deck' | 'hands';
  onClose: () => void;
}

type DeckFilter = 'all' | 'draw' | 'discard' | 'editions';

const getColorblindSafe = (): boolean =>
  typeof ColorblindStorage?.get === 'function' ? ColorblindStorage.get() : false;

const subscribeColorblindSafe = (onStoreChange: () => void): (() => void) =>
  typeof ColorblindStorage?.subscribe === 'function'
    ? ColorblindStorage.subscribe(() => onStoreChange())
    : () => {};

const COLOR_ORDER = { red: 0, green: 1, purple: 2 } as const;
const SHAPE_ORDER = { oval: 0, squiggle: 1, diamond: 2 } as const;

const sortCards = (cards: readonly PrismCard[]): PrismCard[] =>
  [...cards].sort((a, b) => {
    const edA = hasCardEdition(a) ? 0 : 1;
    const edB = hasCardEdition(b) ? 0 : 1;
    if (edA !== edB) return edA - edB;
    if (COLOR_ORDER[a.color] !== COLOR_ORDER[b.color]) return COLOR_ORDER[a.color] - COLOR_ORDER[b.color];
    if (SHAPE_ORDER[a.shape] !== SHAPE_ORDER[b.shape]) return SHAPE_ORDER[a.shape] - SHAPE_ORDER[b.shape];
    return a.number - b.number;
  });

const PrismDeckModal: React.FC<PrismDeckModalProps> = ({
  visible,
  run,
  initialTab = 'deck',
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<'deck' | 'hands'>(initialTab);
  const [deckFilter, setDeckFilter] = useState<DeckFilter>('all');

  const colorblind = useSyncExternalStore(
    subscribeColorblindSafe,
    getColorblindSafe,
    getColorblindSafe
  );

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      setDeckFilter('all');
    }
  }, [visible, initialTab]);

  const summary = useMemo(() => getDeckSummary(run), [run]);
  const rankedHands = useMemo(
    () => [...PATTERN_HANDS].sort((a, b) => b.rank - a.rank),
    []
  );

  const visibleCards = useMemo(() => {
    if (deckFilter === 'draw') return sortCards(run.drawPile);
    if (deckFilter === 'discard') return sortCards(run.discardPile);
    if (deckFilter === 'editions') return sortCards(run.deck.filter(c => hasCardEdition(c)));
    return sortCards(run.deck);
  }, [deckFilter, run.deck, run.drawPile, run.discardPile]);

  const gridCols = width >= 720 ? 5 : 3;
  const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header: Tabs + Close */}
          <View style={styles.header}>
            <View style={styles.tabRow}>
              <TouchableOpacity
                testID="prism-modal-tab-deck"
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'deck' }}
                onPress={() => {
                  playPrismSfx('click');
                  setActiveTab('deck');
                }}
                style={[
                  styles.tabBtn,
                  activeTab === 'deck' && styles.tabBtnActive,
                  webCursor,
                ]}
              >
                <Icon
                  name="delapouite/stack"
                  size={15}
                  color={activeTab === 'deck' ? '#121212' : PRISM_COLORS.textMuted}
                  noShadow
                />
                <Text
                  style={[styles.tabText, activeTab === 'deck' && styles.tabTextActive]}
                >
                  Deck ({summary.totalCards})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="prism-modal-tab-hands"
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'hands' }}
                onPress={() => {
                  playPrismSfx('click');
                  setActiveTab('hands');
                }}
                style={[
                  styles.tabBtn,
                  activeTab === 'hands' && styles.tabBtnActive,
                  webCursor,
                ]}
              >
                <Icon
                  name="lorc/poker-hand"
                  size={15}
                  color={activeTab === 'hands' ? '#121212' : PRISM_COLORS.textMuted}
                  noShadow
                />
                <Text
                  style={[styles.tabText, activeTab === 'hands' && styles.tabTextActive]}
                >
                  Pattern Hands (7)
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="prism-deck-modal-close"
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              onPress={() => {
                playPrismSfx('click');
                onClose();
              }}
              style={[styles.closeBtn, webCursor]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'deck' ? (
              <>
                {/* Draw Pile vs Discard Pile vs Master Summary */}
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>TOTAL DECK</Text>
                    <Text style={styles.summaryValue}>{summary.totalCards}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>DRAW PILE</Text>
                    <Text style={[styles.summaryValue, { color: PRISM_COLORS.chipsBlue }]}>
                      {summary.drawPileCount}
                    </Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>DISCARD</Text>
                    <Text style={[styles.summaryValue, { color: PRISM_COLORS.multRed }]}>
                      {summary.discardPileCount}
                    </Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>EDITIONS</Text>
                    <Text style={[styles.summaryValue, { color: PRISM_COLORS.gold }]}>
                      {summary.editionCount}
                    </Text>
                  </View>
                </View>

                {/* Trait Breakdowns */}
                <View style={styles.breakdownCard}>
                  <View style={styles.breakdownGroup}>
                    <Text style={styles.breakdownTitle}>COLORS</Text>
                    <View style={styles.pillRow}>
                      {CARD_COLOR_LIST.map(c => (
                        <View key={c} style={styles.countChip}>
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: getPrismShapeColor(c, colorblind) },
                            ]}
                          />
                          <Text style={styles.countChipText}>
                            {COLOR_LABELS[c]}: {summary.byColor[c]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.breakdownGroup}>
                    <Text style={styles.breakdownTitle}>SHAPES</Text>
                    <View style={styles.pillRow}>
                      {PRISM_SHAPES.map(s => (
                        <View key={s} style={styles.countChip}>
                          <Text style={styles.countChipText}>
                            {SHAPE_LABELS[s]}: {summary.byShape[s]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.breakdownGroup}>
                    <Text style={styles.breakdownTitle}>NUMBERS</Text>
                    <View style={styles.pillRow}>
                      {PRISM_NUMBERS.map(n => (
                        <View key={n} style={styles.countChip}>
                          <Text style={styles.countChipText}>
                            {n}s: {summary.byNumber[n]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.breakdownGroup}>
                    <Text style={styles.breakdownTitle}>EDITIONS</Text>
                    <View style={styles.pillRow}>
                      {SPECIAL_EDITIONS.map(ed => {
                        const meta = editionMeta(ed);
                        const count = summary.byEdition[ed];
                        return (
                          <View
                            key={ed}
                            style={[
                              styles.countChip,
                              count > 0 && { borderColor: meta.color },
                            ]}
                          >
                            <View style={[styles.dot, { backgroundColor: meta.color }]} />
                            <Text
                              style={[
                                styles.countChipText,
                                count > 0 && { color: PRISM_COLORS.textPrimary },
                              ]}
                            >
                              {meta.label}: {count}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Pile Filter Pills */}
                <View style={styles.filterRow}>
                  {(
                    [
                      { id: 'all', label: `All (${run.deck.length})` },
                      { id: 'draw', label: `Draw (${run.drawPile.length})` },
                      { id: 'discard', label: `Discard (${run.discardPile.length})` },
                      { id: 'editions', label: `Editions (${summary.editionCount})` },
                    ] as const
                  ).map(f => (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => {
                        playPrismSfx('click');
                        setDeckFilter(f.id);
                      }}
                      style={[
                        styles.filterBtn,
                        deckFilter === f.id && styles.filterBtnActive,
                        webCursor,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          deckFilter === f.id && styles.filterTextActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Visual Card Grid */}
                {visibleCards.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>No cards in this pile right now.</Text>
                  </View>
                ) : (
                  <View style={styles.cardsGrid}>
                    {visibleCards.map(card => (
                      <View
                        key={card.id}
                        style={{
                          width: `${Math.floor(1000 / gridCols) / 10}%`,
                          padding: 4,
                        }}
                      >
                        <PrismCardTile card={card} compact disabled />
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              /* Pattern Hands Reference Tab */
              <View style={styles.handsList}>
                <Text style={styles.handsIntro}>
                  Higher-ranking Pattern Hands start with bigger base Chips × Mult. Level them up in the Shop with Star Charts!
                </Text>

                {rankedHands.map(hand => {
                  const level = run.handLevels[hand.id] ?? 1;
                  const stats = getPatternHandStats(hand.id, level);
                  const playedCount = run.stats.handPlayCounts[hand.id] ?? 0;

                  return (
                    <View key={hand.id} style={styles.handRowCard}>
                      <View style={styles.handRowTop}>
                        <View style={styles.handTitleGroup}>
                          <View
                            style={[
                              styles.handAccentPill,
                              { backgroundColor: hand.accentColor },
                            ]}
                          >
                            <Text style={styles.handAccentRank}>#{hand.rank}</Text>
                          </View>
                          <Text style={styles.handRowName} numberOfLines={1}>
                            {hand.name}
                          </Text>
                          <View style={styles.handLevelPill}>
                            <Text style={styles.handLevelText}>Lv.{level}</Text>
                          </View>
                        </View>

                        <View style={styles.handMathGroup}>
                          <View style={styles.miniChips}>
                            <Text style={styles.miniChipsText}>
                              {formatScore(stats.chips)}
                            </Text>
                          </View>
                          <Text style={styles.miniX}>×</Text>
                          <View style={styles.miniMult}>
                            <Text style={styles.miniMultText}>
                              {formatMult(stats.mult)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Text style={styles.handRuleText}>{hand.ruleSummary}</Text>

                      <View style={styles.handFooterRow}>
                        <Text style={styles.handNextLevel}>
                          Next level: +{hand.levelChips} Chips, +{hand.levelMult} Mult
                        </Text>
                        <Text style={styles.handPlayedCount}>
                          Played {playedCount}×
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 14, 10, 0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  sheet: {
    width: '100%',
    maxWidth: 740,
    maxHeight: '90%',
    backgroundColor: PRISM_COLORS.feltBg,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: PRISM_COLORS.goldDark,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderBottomWidth: 1.5,
    borderBottomColor: PRISM_COLORS.feltBorder,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  tabBtnActive: {
    backgroundColor: PRISM_COLORS.gold,
    borderColor: PRISM_COLORS.brassLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
  },
  tabTextActive: {
    color: '#121212',
    fontWeight: '900',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  bodyScroll: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 14,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 19,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  breakdownCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 10,
    gap: 8,
  },
  breakdownGroup: {
    gap: 4,
  },
  breakdownTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
    letterSpacing: 0.9,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  countChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterBtn: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: PRISM_COLORS.feltElevated,
    borderColor: PRISM_COLORS.gold,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  filterTextActive: {
    color: PRISM_COLORS.gold,
    fontWeight: '900',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  emptyBox: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  handsList: {
    gap: 9,
  },
  handsIntro: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
    lineHeight: 17,
  },
  handRowCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 11,
    gap: 6,
  },
  handRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  handTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  handAccentPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  handAccentRank: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  handRowName: {
    fontSize: 14,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
    flexShrink: 1,
  },
  handLevelPill: {
    backgroundColor: PRISM_COLORS.feltDeep,
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  handLevelText: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  handMathGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniChips: {
    backgroundColor: PRISM_COLORS.chipsBg,
    borderWidth: 1,
    borderColor: PRISM_COLORS.chipsBlue,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  miniChipsText: {
    fontSize: 12,
    fontWeight: '900',
    color: PRISM_COLORS.chipsBlue,
  },
  miniX: {
    fontSize: 12,
    fontWeight: '900',
    color: PRISM_COLORS.multRed,
  },
  miniMult: {
    backgroundColor: PRISM_COLORS.multBg,
    borderWidth: 1,
    borderColor: PRISM_COLORS.multRed,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  miniMultText: {
    fontSize: 12,
    fontWeight: '900',
    color: PRISM_COLORS.multRed,
  },
  handRuleText: {
    fontSize: 12,
    color: PRISM_COLORS.textPrimary,
    lineHeight: 17,
  },
  handFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  handNextLevel: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  handPlayedCount: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.brassLight,
  },
});

export default PrismDeckModal;
