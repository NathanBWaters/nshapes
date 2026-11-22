/**
 * Prism Deck — Victory (Ante 8), Defeat, & Endless Summary Screen.
 *
 * Features:
 * - Outcome Hero, Career Stats, Final Charm Belt & Vouchers
 * - Newly Unlocked Starter Decks celebration
 * - Gleaming "Continue Endless (Ante 9+)" CTA on Ante 8 Victory
 * - 1-Tap Spoiler-Free Wordle-style Share Card with live preview & URL copy
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import {
  DAILY_MUTATOR_BY_ID,
  STARTER_DECK_BY_ID,
  VICTORY_ANTE,
  VOUCHER_BY_ID,
  formatShareCard,
} from '@/prism';
import type { PrismRun, StarterDeckId } from '@/prism';
import PrismJokerBelt from './PrismJokerBelt';
import { PRISM_COLORS, formatScore, playPrismSfx } from './prismTheme';

export interface PrismResultsProps {
  run: PrismRun;
  newlyUnlockedDecks: StarterDeckId[];
  storageWarning?: string | null;
  onDismissStorageWarning?: () => void;
  onContinueEndless?: () => void;
  onReplaySeed: () => void;
  onNewRun: () => void;
  onMainMenu: () => void;
}

const getWebBaseUrl = (): string | undefined => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const cleanPath = (window.location.pathname ?? '')
      .replace(/\/index\.html$/i, '')
      .replace(/\/+$/, '');
    return `${window.location.origin}${cleanPath}`;
  }
  return undefined;
};

const copyShareText = async (text: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const Clipboard = await import('expo-clipboard');
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(text);
      return true;
    }
  } catch {
    // Clipboard unavailable
  }
  return false;
};

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const PrismResults: React.FC<PrismResultsProps> = ({
  run,
  newlyUnlockedDecks,
  storageWarning,
  onDismissStorageWarning,
  onContinueEndless,
  onReplaySeed,
  onNewRun,
  onMainMenu,
}) => {
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const isVictory = run.phase === 'victory';
  const isEndlessLegend = run.phase === 'defeat' && run.isEndless;

  const deckDef = STARTER_DECK_BY_ID[run.deckId] ?? STARTER_DECK_BY_ID.classic_prism;
  const mutatorDef = run.dailyMutatorId ? DAILY_MUTATOR_BY_ID[run.dailyMutatorId] : null;

  const shareText = useMemo(
    () => formatShareCard(run, getWebBaseUrl()),
    [run]
  );

  const hero = isVictory
    ? {
        icon: 'lorc/crown' as const,
        accent: PRISM_COLORS.gold,
        title: 'VICTORY!',
        subtitle: `Ante ${VICTORY_ANTE} Boss Defeated · ${deckDef.name}`,
      }
    : isEndlessLegend
      ? {
          icon: 'lorc/star-swirl' as const,
          accent: PRISM_COLORS.xMultPurple,
          title: 'ENDLESS LEGEND',
          subtitle: `Conquered into Endless Ante ${run.ante} · ${deckDef.name}`,
        }
      : {
          icon: 'lorc/skull-crack' as const,
          accent: PRISM_COLORS.multRed,
          title: 'RUN ENDED',
          subtitle: run.abandoned
            ? `Abandoned at Ante ${run.ante} · ${deckDef.name}`
            : `Stopped at Ante ${run.ante} · ${deckDef.name}`,
        };

  const handleCopyShare = async () => {
    await copyShareText(shareText);
    playPrismSfx('buy');
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 3200);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(12, insets.bottom) }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerWrap}>
          {/* Non-blocking Storage Warning Banner */}
          {storageWarning && (
            <View style={styles.warningBanner} testID="prism-results-storage-warning">
              <Icon name="lorc/laser-warning" size={16} color={PRISM_COLORS.gold} />
              <Text style={styles.warningText}>
                Save storage warning ({storageWarning}). Copy your Share Card or use Backup in Setup.
              </Text>
              {onDismissStorageWarning && (
                <Pressable
                  accessibilityRole="button"
                  onPress={onDismissStorageWarning}
                  style={styles.warningDismissBtn}
                >
                  <Text style={styles.warningDismissText}>OK</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Outcome Hero */}
          <View style={[styles.heroCard, { borderColor: hero.accent }]}>
            <View style={[styles.heroIconRing, { borderColor: hero.accent }]}>
              <Icon name={hero.icon} size={38} color={hero.accent} />
            </View>

            <Text style={[styles.heroTitle, { color: hero.accent }]}>{hero.title}</Text>
            <Text style={styles.heroSubtitle}>{hero.subtitle}</Text>

            {run.isDaily && run.dailyDate && (
              <View style={styles.dailyBadge}>
                <Icon name="lorc/rainbow-star" size={14} color={PRISM_COLORS.gold} />
                <Text style={styles.dailyBadgeText}>
                  Daily {run.dailyDate}
                  {mutatorDef ? ` · ${mutatorDef.name}` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Gleaming Endless CTA on Ante 8 Victory */}
          {isVictory && onContinueEndless && (
            <Pressable
              testID="prism-continue-endless"
              onPress={() => {
                playPrismSfx('big_hit');
                onContinueEndless();
              }}
              style={({ pressed }) => [
                styles.endlessCta,
                pressed && styles.pressed,
                Platform.OS === 'web' && { cursor: 'pointer' as never },
              ]}
            >
              <Icon name="various-artists/infinity" size={24} color={PRISM_COLORS.feltBg} />
              <View style={styles.endlessTextWrap}>
                <Text style={styles.endlessTitle}>Continue Endless (Ante 9+) →</Text>
                <Text style={styles.endlessSub}>
                  Keep your Charms, spend Boss Gold in the Shop, and chase uncapped combos!
                </Text>
              </View>
            </Pressable>
          )}

          {/* Newly Unlocked Starter Decks */}
          {newlyUnlockedDecks.length > 0 && (
            <View style={styles.unlockBanner} testID="prism-results-unlocks">
              <View style={styles.unlockHeader}>
                <Icon name="lorc/trophy" size={18} color={PRISM_COLORS.gold} />
                <Text style={styles.unlockTitle}>
                  NEW STARTER DECK{newlyUnlockedDecks.length > 1 ? 'S' : ''} UNLOCKED!
                </Text>
              </View>
              {newlyUnlockedDecks.map(deckId => {
                const unlocked = STARTER_DECK_BY_ID[deckId];
                if (!unlocked) return null;
                return (
                  <View key={deckId} style={styles.unlockRow}>
                    <Icon name={unlocked.icon} size={20} color={unlocked.accentColor} />
                    <View style={styles.unlockRowText}>
                      <Text style={styles.unlockDeckName}>{unlocked.name}</Text>
                      <Text style={styles.unlockDeckDesc}>{unlocked.description}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Run Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {run.isEndless ? `Endless ${run.ante}` : `${run.ante} / ${VICTORY_ANTE}`}
              </Text>
              <Text style={styles.statLabel}>ANTE REACHED</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: PRISM_COLORS.gold }]}>
                {formatScore(run.stats.bestSingleSet)}
              </Text>
              <Text style={styles.statLabel}>BEST SINGLE SET</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{run.stats.setsPlayed}</Text>
              <Text style={styles.statLabel}>SETS PLAYED</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: PRISM_COLORS.econGreen }]}>
                ${run.stats.totalGoldEarned}
              </Text>
              <Text style={styles.statLabel}>GOLD EARNED</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{run.stats.blindsCleared}</Text>
              <Text style={styles.statLabel}>BLINDS CLEARED</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValueSeed}>{run.seed}</Text>
              <Text style={styles.statLabel}>SEED</Text>
            </View>
          </View>

          {/* Final Charm Belt */}
          <View style={styles.beltWrap}>
            <Text style={styles.sectionLabel}>FINAL CHARM BELT</Text>
            <PrismJokerBelt run={run} compact />
            {run.vouchers.length > 0 && (
              <View style={styles.vouchersRow}>
                {run.vouchers.map(vId => {
                  const v = VOUCHER_BY_ID[vId];
                  return (
                    <View key={vId} style={styles.voucherChip}>
                      <Icon name={v.icon} size={13} color={v.accentColor} />
                      <Text style={styles.voucherChipText}>{v.name}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 1-Tap Spoiler-Free Share Card */}
          <View style={styles.shareCard}>
            <View style={styles.shareHeaderRow}>
              <Text style={styles.sectionLabel}>SPOILER-FREE SHARE CARD</Text>
              <Text style={styles.shareSubNote}>Includes playable Seed link</Text>
            </View>
            <View style={styles.sharePreviewBox}>
              <Text style={styles.sharePreviewText}>{shareText}</Text>
            </View>
            <Pressable
              testID="prism-share-run"
              onPress={handleCopyShare}
              style={({ pressed }) => [
                styles.shareBtn,
                copied && styles.shareBtnCopied,
                pressed && styles.pressed,
                Platform.OS === 'web' && { cursor: 'pointer' as never },
              ]}
            >
              <Icon
                name={copied ? 'lorc/checked-shield' : 'delapouite/scroll-quill'}
                size={18}
                color={copied ? PRISM_COLORS.feltBg : PRISM_COLORS.gold}
              />
              <Text style={[styles.shareBtnText, copied && styles.shareBtnTextCopied]}>
                {copied ? 'Copied Share Card!' : 'Copy Share Card & Seed Link'}
              </Text>
            </Pressable>
          </View>

          {/* Action CTAs */}
          <View style={styles.ctaRow}>
            <Pressable
              testID="prism-replay-seed"
              onPress={() => {
                playPrismSfx('play');
                onReplaySeed();
              }}
              style={({ pressed }) => [
                styles.secondaryCta,
                pressed && styles.pressed,
                Platform.OS === 'web' && { cursor: 'pointer' as never },
              ]}
            >
              <Icon name="lorc/cycle" size={16} color={PRISM_COLORS.chipsBlue} />
              <Text style={styles.secondaryCtaText}>Replay Same Seed</Text>
            </Pressable>

            <Pressable
              testID="prism-new-run"
              onPress={() => {
                playPrismSfx('click');
                onNewRun();
              }}
              style={({ pressed }) => [
                styles.primaryCta,
                pressed && styles.pressed,
                Platform.OS === 'web' && { cursor: 'pointer' as never },
              ]}
            >
              <Text style={styles.primaryCtaText}>New Run</Text>
            </Pressable>

            <Pressable
              testID="prism-results-menu"
              onPress={() => {
                playPrismSfx('click');
                onMainMenu();
              }}
              style={({ pressed }) => [
                styles.secondaryCta,
                pressed && styles.pressed,
                Platform.OS === 'web' && { cursor: 'pointer' as never },
              ]}
            >
              <Text style={styles.secondaryCtaText}>Main Menu</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PRISM_COLORS.feltBg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
    paddingBottom: 32,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 720,
    gap: 14,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 201, 76, 0.14)',
    borderWidth: 1,
    borderColor: PRISM_COLORS.gold,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  warningDismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  warningDismissText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  heroCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 18,
    borderWidth: 2,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  heroIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    backgroundColor: PRISM_COLORS.feltBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
    textAlign: 'center',
  },
  dailyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
    marginTop: 4,
  },
  dailyBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  endlessCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: PRISM_COLORS.gold,
    borderWidth: 2,
    borderColor: '#FFF3C4',
  },
  endlessTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  endlessTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
  },
  endlessSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#25332E',
    marginTop: 2,
  },
  unlockBanner: {
    backgroundColor: 'rgba(242, 201, 76, 0.14)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.gold,
    padding: 14,
    gap: 10,
  },
  unlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    color: PRISM_COLORS.gold,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 10,
    padding: 10,
  },
  unlockRowText: {
    flex: 1,
    minWidth: 0,
  },
  unlockDeckName: {
    fontSize: 14,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  unlockDeckDesc: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 100,
    width: '30%',
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  statValueSeed: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.chipsBlue,
    letterSpacing: 0.6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
    marginTop: 3,
    textAlign: 'center',
  },
  beltWrap: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: PRISM_COLORS.textMuted,
  },
  vouchersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  voucherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
  },
  voucherChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  shareCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 14,
    gap: 10,
  },
  shareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  shareSubNote: {
    fontSize: 11,
    color: PRISM_COLORS.chipsBlue,
    fontWeight: '700',
  },
  sharePreviewBox: {
    backgroundColor: PRISM_COLORS.feltBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 12,
  },
  sharePreviewText: {
    fontSize: 12,
    lineHeight: 18,
    color: PRISM_COLORS.textPrimary,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  shareBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.gold,
    backgroundColor: PRISM_COLORS.feltElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  shareBtnCopied: {
    backgroundColor: PRISM_COLORS.econGreen,
    borderColor: PRISM_COLORS.econGreen,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  shareBtnTextCopied: {
    color: PRISM_COLORS.feltBg,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryCta: {
    flex: 1,
    minWidth: 120,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.gold,
    borderWidth: 2,
    borderColor: '#FFF3C4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
  },
  secondaryCta: {
    flex: 1,
    minWidth: 120,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  secondaryCtaText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});

export default PrismResults;
