/**
 * Prism Deck — Setup & Daily Challenge Hub.
 *
 * Features:
 * - Active Run Resume Banner with 2-tap confirmed Abandon
 * - Standard Run tab: 5 Starter Decks + Lab Unlock-All toggle + editable Seed + Randomizer
 * - Daily Challenge tab: today's deterministic seed, Daily Mutator spotlight, streak & clears
 * - Portable Save Backup Code export/import modal
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import {
  DAILY_MUTATOR_BY_ID,
  STARTER_DECKS,
  STARTER_DECK_BY_ID,
  exportPrismBackupCode,
  generateRandomSeed,
  getDailyMutatorForDate,
  getDailySeed,
  getTodayDateString,
  importPrismBackupCode,
  isDeckUnlocked,
  normalizeSeed,
} from '@/prism';
import type { PrismMeta, PrismRun, StarterDeckId } from '@/prism';
import { PRISM_COLORS, formatScore, playPrismSfx } from './prismTheme';

export interface PrismSetupProps {
  meta: PrismMeta;
  activeRun: PrismRun | null;
  initialTab?: 'standard' | 'daily';
  initialSeed?: string;
  initialDeckId?: StarterDeckId;
  initialDailyDate?: string;
  sharedBannerText?: string | null;
  storageWarning?: string | null;
  onDismissStorageWarning?: () => void;
  onStartStandard: (options: { deckId: StarterDeckId; seed: string }) => void;
  onStartDaily: (dailyDate: string) => void;
  onResumeRun: () => void;
  onAbandonRun: () => void;
  onOpenTutorial: () => void;
  onBackupRestored: (meta: PrismMeta, run: PrismRun | null) => void;
  onExit: () => void;
}

const copyToClipboard = async (text: string): Promise<boolean> => {
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
    // Clipboard blocked or unavailable
  }
  return false;
};

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const PrismSetup: React.FC<PrismSetupProps> = ({
  meta,
  activeRun,
  initialTab = 'standard',
  initialSeed = '',
  initialDeckId = 'classic_prism',
  initialDailyDate,
  sharedBannerText,
  storageWarning,
  onDismissStorageWarning,
  onStartStandard,
  onStartDaily,
  onResumeRun,
  onAbandonRun,
  onOpenTutorial,
  onBackupRestored,
  onExit,
}) => {
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const [tab, setTab] = useState<'standard' | 'daily'>(initialTab);
  const canUseLabUnlock = typeof __DEV__ !== 'undefined' && __DEV__;
  const [unlockAllLab, setUnlockAllLab] = useState(false);
  const effectiveUnlockAll = canUseLabUnlock && unlockAllLab;
  const [selectedDeck, setSelectedDeck] = useState<StarterDeckId>(() =>
    initialDeckId && (isDeckUnlocked(initialDeckId, meta) || initialDeckId === 'classic_prism')
      ? initialDeckId
      : 'classic_prism'
  );
  const [seedInput, setSeedInput] = useState(() => normalizeSeed(initialSeed));
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const abandonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmStartKind, setConfirmStartKind] = useState<'standard' | 'daily' | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Backup drawer/modal state
  const [backupOpen, setBackupOpen] = useState(false);
  const [exportedCode, setExportedCode] = useState('');
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    return () => {
      if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
    };
  }, []);

  const hasResumableRun = Boolean(
    activeRun && activeRun.phase !== 'victory' && activeRun.phase !== 'defeat'
  );

  const todayDate = initialDailyDate || getTodayDateString();
  const dailySeed = getDailySeed(todayDate);
  const dailyMutatorId = getDailyMutatorForDate(todayDate);
  const dailyMutator = DAILY_MUTATOR_BY_ID[dailyMutatorId];
  const todayCleared = meta.completedDailyDates.includes(todayDate);
  const todayBestScore = meta.dailyBestScores[todayDate] ?? 0;

  const handleFirstAbandonTap = () => {
    playPrismSfx('click');
    setConfirmingAbandon(true);
    if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
    abandonTimerRef.current = setTimeout(() => {
      setConfirmingAbandon(false);
    }, 4500);
  };

  const handleConfirmAbandon = () => {
    if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
    setConfirmingAbandon(false);
    playPrismSfx('lose');
    onAbandonRun();
  };

  const handleCancelAbandon = () => {
    if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
    setConfirmingAbandon(false);
    playPrismSfx('click');
  };

  const clearConfirmStart = () => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    setConfirmStartKind(null);
  };

  const armConfirmStart = (kind: 'standard' | 'daily') => {
    playPrismSfx('click');
    setConfirmStartKind(kind);
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = setTimeout(() => {
      setConfirmStartKind(null);
    }, 4500);
  };

  const handleStartStandard = () => {
    if (hasResumableRun && confirmStartKind !== 'standard') {
      armConfirmStart('standard');
      return;
    }
    clearConfirmStart();
    playPrismSfx('play');
    const cleanSeed = normalizeSeed(seedInput);
    onStartStandard({ deckId: selectedDeck, seed: cleanSeed });
  };

  const handleStartDaily = () => {
    if (hasResumableRun && confirmStartKind !== 'daily') {
      armConfirmStart('daily');
      return;
    }
    clearConfirmStart();
    playPrismSfx('play');
    onStartDaily(todayDate);
  };

  const handleOpenBackup = () => {
    playPrismSfx('click');
    setExportedCode(exportPrismBackupCode(true));
    setCopiedBackup(false);
    setRestoreStatus(null);
    setBackupOpen(true);
  };

  const handleCopyBackup = async () => {
    const code = exportedCode || exportPrismBackupCode(true);
    setExportedCode(code);
    const copied = await copyToClipboard(code);
    playPrismSfx(copied ? 'buy' : 'click');
    setCopiedBackup(true);
  };

  const handleRestoreBackup = () => {
    const res = importPrismBackupCode(restoreInput);
    if (!res.ok) {
      playPrismSfx('invalid');
      setRestoreStatus({ ok: false, message: res.error });
      return;
    }
    if (res.storageError) {
      playPrismSfx('invalid');
      setRestoreStatus({
        ok: false,
        message: `Backup parsed, but browser storage failed: ${res.storageError}`,
      });
      return;
    }
    playPrismSfx('win');
    setRestoreStatus({
      ok: true,
      message: `Restored! ${res.meta.victories} wins, Best Ante ${res.meta.bestAnte}, ${res.meta.unlockedDecks.length}/5 decks${res.run ? ' + active run' : ''}.`,
    });
    setRestoreInput('');
    onBackupRestored(res.meta, res.run);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(12, insets.bottom) }]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable
          testID="prism-exit-menu"
          onPress={() => {
            playPrismSfx('click');
            onExit();
          }}
          accessibilityLabel="Back to Main Menu"
          style={({ pressed }) => [
            styles.headerBtn,
            pressed && styles.pressed,
            Platform.OS === 'web' && { cursor: 'pointer' as never },
          ]}
        >
          <Icon name="ui/back-arrow" size={18} color={PRISM_COLORS.textPrimary} />
          <Text style={styles.headerBtnText}>Menu</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.brandRow}>
            <Icon name="lorc/crystal-shine" size={20} color={PRISM_COLORS.gold} />
            <Text style={styles.brandTitle}>PRISM DECK</Text>
          </View>
        </View>

        <Pressable
          testID="prism-backup-open"
          onPress={handleOpenBackup}
          accessibilityLabel="Save Backup"
          style={({ pressed }) => [
            styles.headerBtn,
            pressed && styles.pressed,
            Platform.OS === 'web' && { cursor: 'pointer' as never },
          ]}
        >
          <Icon name="lorc/backup" size={18} color={PRISM_COLORS.gold} />
          <Text style={styles.headerBtnText}>Backup</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerWrap}>
          {/* Storage Warning Banner */}
          {storageWarning && (
            <View style={styles.warningBanner}>
              <Icon name="lorc/laser-warning" size={18} color={PRISM_COLORS.gold} />
              <Text style={styles.warningText}>
                Save storage warning ({storageWarning}). Use Backup to copy your code.
              </Text>
              {onDismissStorageWarning && (
                <Pressable onPress={onDismissStorageWarning} style={styles.dismissBtn}>
                  <Text style={styles.dismissText}>OK</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Shared Link Banner */}
          {sharedBannerText && (
            <View style={styles.sharedBanner}>
              <Icon name="delapouite/sparkles" size={16} color={PRISM_COLORS.gold} />
              <Text style={styles.sharedBannerText}>{sharedBannerText}</Text>
            </View>
          )}

          {/* Active Run Resume Banner */}
          {hasResumableRun && activeRun && (
            <View style={styles.resumeCard}>
              <View style={styles.resumeHeaderRow}>
                <View style={styles.resumeInfo}>
                  <View style={styles.liveTagRow}>
                    <View style={styles.liveTag}>
                      <Text style={styles.liveTagText}>
                        {activeRun.isDaily ? 'LIVE DAILY' : 'ACTIVE RUN'}
                      </Text>
                    </View>
                    <Text style={styles.resumeDeckName}>
                      {STARTER_DECK_BY_ID[activeRun.deckId]?.name ?? 'Prism Standard'}
                    </Text>
                  </View>
                  <Text style={styles.resumeSub}>
                    {activeRun.isEndless ? `Endless Ante ${activeRun.ante}` : `Ante ${activeRun.ante} / 8`} ·{' '}
                    ${activeRun.gold} · {activeRun.charms.length}/{activeRun.maxCharms} Charms · Seed{' '}
                    {activeRun.seed}
                  </Text>
                </View>
              </View>

              <View style={styles.resumeActions}>
                <Pressable
                  testID="prism-resume-run"
                  onPress={() => {
                    playPrismSfx('play');
                    onResumeRun();
                  }}
                  style={({ pressed }) => [
                    styles.resumePrimaryBtn,
                    pressed && styles.pressed,
                    Platform.OS === 'web' && { cursor: 'pointer' as never },
                  ]}
                >
                  <Text style={styles.resumePrimaryText}>
                    Resume Ante {activeRun.ante} · ${activeRun.gold}
                  </Text>
                </Pressable>

                {!confirmingAbandon ? (
                  <Pressable
                    testID="prism-abandon-run"
                    onPress={handleFirstAbandonTap}
                    style={({ pressed }) => [
                      styles.abandonBtn,
                      pressed && styles.pressed,
                      Platform.OS === 'web' && { cursor: 'pointer' as never },
                    ]}
                  >
                    <Text style={styles.abandonBtnText}>Abandon</Text>
                  </Pressable>
                ) : (
                  <View style={styles.confirmAbandonRow}>
                    <Pressable
                      onPress={handleCancelAbandon}
                      style={({ pressed }) => [
                        styles.cancelSmallBtn,
                        pressed && styles.pressed,
                        Platform.OS === 'web' && { cursor: 'pointer' as never },
                      ]}
                    >
                      <Text style={styles.cancelSmallText}>Keep</Text>
                    </Pressable>
                    <Pressable
                      testID="prism-confirm-abandon"
                      onPress={handleConfirmAbandon}
                      style={({ pressed }) => [
                        styles.confirmAbandonBtn,
                        pressed && styles.pressed,
                        Platform.OS === 'web' && { cursor: 'pointer' as never },
                      ]}
                    >
                      <Text style={styles.confirmAbandonText}>Confirm Abandon?</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Mode Tabs: Standard Run | Daily Challenge */}
          <View style={styles.tabBar}>
            <Pressable
              testID="prism-tab-standard"
              accessibilityRole="button"
              onPress={() => {
                playPrismSfx('click');
                clearConfirmStart();
                setTab('standard');
              }}
              style={[styles.tabBtn, tab === 'standard' && styles.tabBtnActive]}
            >
              <Icon
                name="delapouite/prism"
                size={18}
                color={tab === 'standard' ? PRISM_COLORS.feltBg : PRISM_COLORS.textMuted}
              />
              <Text style={[styles.tabText, tab === 'standard' && styles.tabTextActive]}>
                Standard Run
              </Text>
            </Pressable>

            <Pressable
              testID="prism-tab-daily"
              accessibilityRole="button"
              onPress={() => {
                playPrismSfx('click');
                clearConfirmStart();
                setTab('daily');
              }}
              style={[styles.tabBtn, tab === 'daily' && styles.tabBtnActive]}
            >
              <Icon
                name="lorc/rainbow-star"
                size={18}
                color={tab === 'daily' ? PRISM_COLORS.feltBg : PRISM_COLORS.gold}
              />
              <Text style={[styles.tabText, tab === 'daily' && styles.tabTextActive]}>
                Daily Challenge
              </Text>
              {todayCleared && (
                <View style={styles.clearedDot}>
                  <Text style={styles.clearedDotText}>✓</Text>
                </View>
              )}
            </Pressable>
          </View>

          {tab === 'standard' ? (
            <View style={styles.sectionStack}>
              {/* Starter Deck Picker Header + Dev-only Lab Toggle */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>STARTER DECKS (5)</Text>
                {canUseLabUnlock && (
                  <Pressable
                    testID="prism-unlock-all"
                    onPress={() => {
                      playPrismSfx('click');
                      setUnlockAllLab(prev => !prev);
                    }}
                    style={({ pressed }) => [
                      styles.labToggle,
                      effectiveUnlockAll && styles.labToggleActive,
                      pressed && styles.pressed,
                      Platform.OS === 'web' && { cursor: 'pointer' as never },
                    ]}
                  >
                    <Icon
                      name="lorc/fizzing-flask"
                      size={14}
                      color={effectiveUnlockAll ? PRISM_COLORS.feltBg : PRISM_COLORS.gold}
                    />
                    <Text style={[styles.labToggleText, effectiveUnlockAll && styles.labToggleTextActive]}>
                      Lab: Unlock All {effectiveUnlockAll ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* 5 Starter Decks Grid */}
              <View style={[styles.deckGrid, isWide && styles.deckGridWide]}>
                {STARTER_DECKS.map(deck => {
                  const naturallyUnlocked = isDeckUnlocked(deck.id, meta);
                  const unlocked = naturallyUnlocked || effectiveUnlockAll;
                  const active = selectedDeck === deck.id;
                  const wins = meta.deckWins[deck.id] ?? 0;

                  return (
                    <Pressable
                      key={deck.id}
                      testID={`prism-deck-${deck.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !unlocked, selected: active }}
                      disabled={!unlocked}
                      onPress={() => {
                        if (!unlocked) return;
                        playPrismSfx('select');
                        setSelectedDeck(deck.id);
                      }}
                      style={({ pressed }) => [
                        styles.deckCard,
                        isWide && styles.deckCardWide,
                        active && styles.deckCardSelected,
                        !unlocked && styles.deckCardLocked,
                        pressed && unlocked && styles.pressed,
                        Platform.OS === 'web' && unlocked && { cursor: 'pointer' as never },
                      ]}
                    >
                      <View style={styles.deckTopRow}>
                        <View style={[styles.deckIconBox, { borderColor: deck.accentColor }]}>
                          <Icon
                            name={unlocked ? deck.icon : 'lorc/padlock'}
                            size={22}
                            color={unlocked ? deck.accentColor : PRISM_COLORS.textMuted}
                          />
                        </View>
                        <View style={styles.deckTitleBlock}>
                          <View style={styles.deckNameRow}>
                            <Text style={styles.deckName}>{deck.name}</Text>
                            {wins > 0 && (
                              <View style={styles.winPill}>
                                <Text style={styles.winPillText}>★ {wins}</Text>
                              </View>
                            )}
                            {!naturallyUnlocked && effectiveUnlockAll && (
                              <View style={styles.labPill}>
                                <Text style={styles.labPillText}>LAB</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.deckStatsLine}>
                            {deck.baseHands}H · {deck.baseDiscards}D · {deck.baseBoardSize} Cards · $
                            {deck.startingGold}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.deckDesc}>{deck.description}</Text>

                      {!naturallyUnlocked && (
                        <Text style={styles.deckUnlockText}>
                          Unlock: {deck.unlockRequirement}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Seed Input & Randomizer */}
              <View style={styles.seedCard}>
                <Text style={styles.sectionLabel}>RUN SEED (OPTIONAL)</Text>
                <View style={styles.seedRow}>
                  <TextInput
                    testID="prism-seed-input"
                    value={seedInput}
                    onChangeText={t => setSeedInput(normalizeSeed(t))}
                    placeholder="Random seed (e.g. PRISM777)"
                    placeholderTextColor={PRISM_COLORS.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={24}
                    style={styles.seedInput}
                  />
                  <Pressable
                    testID="prism-seed-random"
                    onPress={() => {
                      playPrismSfx('reroll');
                      setSeedInput(generateRandomSeed());
                    }}
                    accessibilityLabel="Randomize Seed"
                    style={({ pressed }) => [
                      styles.randomBtn,
                      pressed && styles.pressed,
                      Platform.OS === 'web' && { cursor: 'pointer' as never },
                    ]}
                  >
                    <Icon name="delapouite/rolling-dices" size={20} color={PRISM_COLORS.gold} />
                    <Text style={styles.randomBtnText}>Roll</Text>
                  </Pressable>
                </View>
              </View>

              {/* Career Snapshot */}
              {meta.totalRuns > 0 && (
                <View style={styles.careerStrip}>
                  <View style={styles.careerCell}>
                    <Text style={styles.careerVal}>{meta.victories}</Text>
                    <Text style={styles.careerKey}>WINS</Text>
                  </View>
                  <View style={styles.careerCell}>
                    <Text style={styles.careerVal}>A{meta.bestAnte}</Text>
                    <Text style={styles.careerKey}>BEST ANTE</Text>
                  </View>
                  <View style={styles.careerCell}>
                    <Text style={styles.careerVal}>{formatScore(meta.bestSingleSet)}</Text>
                    <Text style={styles.careerKey}>BEST SET</Text>
                  </View>
                  <View style={styles.careerCell}>
                    <Text style={styles.careerVal}>{meta.totalRuns}</Text>
                    <Text style={styles.careerKey}>RUNS</Text>
                  </View>
                </View>
              )}

              {/* Primary CTA + 45s Intro */}
              <View style={styles.ctaStack}>
                {hasResumableRun && confirmStartKind === 'standard' ? (
                  <View style={styles.replaceConfirmBox}>
                    <Text style={styles.replaceConfirmText}>
                      Replace your active Ante {activeRun?.ante} run?
                    </Text>
                    <View style={styles.replaceConfirmRow}>
                      <Pressable
                        testID="prism-cancel-start-run"
                        accessibilityRole="button"
                        onPress={() => {
                          playPrismSfx('click');
                          clearConfirmStart();
                        }}
                        style={({ pressed }) => [
                          styles.replaceCancelBtn,
                          pressed && styles.pressed,
                          Platform.OS === 'web' && { cursor: 'pointer' as never },
                        ]}
                      >
                        <Text style={styles.replaceCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        testID="prism-start-run"
                        accessibilityRole="button"
                        onPress={handleStartStandard}
                        style={({ pressed }) => [
                          styles.replaceConfirmBtn,
                          pressed && styles.pressed,
                          Platform.OS === 'web' && { cursor: 'pointer' as never },
                        ]}
                      >
                        <Text style={styles.replaceConfirmBtnText}>Replace Live Run?</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    testID="prism-start-run"
                    accessibilityRole="button"
                    onPress={handleStartStandard}
                    style={({ pressed }) => [
                      styles.primaryBrassBtn,
                      pressed && styles.pressed,
                      Platform.OS === 'web' && { cursor: 'pointer' as never },
                    ]}
                  >
                    <Icon name="lorc/crystal-shine" size={22} color={PRISM_COLORS.feltBg} />
                    <Text style={styles.primaryBrassText}>
                      Start Run · {STARTER_DECK_BY_ID[selectedDeck].name}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  testID="prism-open-tutorial"
                  accessibilityRole="button"
                  onPress={() => {
                    playPrismSfx('click');
                    onOpenTutorial();
                  }}
                  style={({ pressed }) => [
                    styles.tutorialBtn,
                    pressed && styles.pressed,
                    Platform.OS === 'web' && { cursor: 'pointer' as never },
                  ]}
                >
                  <Icon name="lorc/open-book" size={18} color={PRISM_COLORS.gold} />
                  <Text style={styles.tutorialBtnText}>45s Interactive Intro</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Daily Challenge Tab */
            <View style={styles.sectionStack}>
              <View style={styles.dailyHeroCard}>
                <View style={styles.dailyDateRow}>
                  <View style={styles.dailyDatePill}>
                    <Text style={styles.dailyDateText}>{todayDate}</Text>
                  </View>
                  <View
                    style={[
                      styles.dailyStatusPill,
                      todayCleared && styles.dailyStatusPillDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dailyStatusText,
                        todayCleared && styles.dailyStatusTextDone,
                      ]}
                    >
                      {todayCleared ? 'CLEARED TODAY ✓' : 'UNPLAYED TODAY'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dailyHeadline}>Everyone Plays the Exact Same Seed</Text>
                <Text style={styles.dailySeedText}>Seed: {dailySeed}</Text>

                {/* Mutator Spotlight */}
                <View
                  style={[
                    styles.mutatorSpotlight,
                    { borderColor: dailyMutator.accentColor },
                  ]}
                >
                  <View
                    style={[
                      styles.mutatorIconBox,
                      { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: dailyMutator.accentColor },
                    ]}
                  >
                    <Icon name={dailyMutator.icon} size={28} color={dailyMutator.accentColor} />
                  </View>
                  <View style={styles.mutatorTextWrap}>
                    <Text style={styles.mutatorEyebrow}>TODAY&apos;S DAILY MUTATOR</Text>
                    <Text style={styles.mutatorName}>{dailyMutator.name}</Text>
                    <Text style={styles.mutatorDesc}>{dailyMutator.description}</Text>
                  </View>
                </View>

                {/* Daily Streak & Stats */}
                <View style={styles.dailyStatsRow}>
                  <View style={styles.dailyStatBox}>
                    <Text style={styles.dailyStatVal}>{meta.dailyStreak}</Text>
                    <Text style={styles.dailyStatLabel}>STREAK</Text>
                  </View>
                  <View style={styles.dailyStatBox}>
                    <Text style={styles.dailyStatVal}>{meta.bestDailyStreak}</Text>
                    <Text style={styles.dailyStatLabel}>BEST STREAK</Text>
                  </View>
                  <View style={styles.dailyStatBox}>
                    <Text style={styles.dailyStatVal}>{meta.completedDailyDates.length}</Text>
                    <Text style={styles.dailyStatLabel}>CLEARS</Text>
                  </View>
                  {todayBestScore > 0 && (
                    <View style={styles.dailyStatBox}>
                      <Text style={styles.dailyStatVal}>{formatScore(todayBestScore)}</Text>
                      <Text style={styles.dailyStatLabel}>TODAY BEST</Text>
                    </View>
                  )}
                </View>

                {hasResumableRun && confirmStartKind === 'daily' ? (
                  <View style={styles.replaceConfirmBox}>
                    <Text style={styles.replaceConfirmText}>
                      Replace your active Ante {activeRun?.ante} run with Today&apos;s Daily?
                    </Text>
                    <View style={styles.replaceConfirmRow}>
                      <Pressable
                        testID="prism-cancel-start-daily"
                        accessibilityRole="button"
                        onPress={() => {
                          playPrismSfx('click');
                          clearConfirmStart();
                        }}
                        style={({ pressed }) => [
                          styles.replaceCancelBtn,
                          pressed && styles.pressed,
                          Platform.OS === 'web' && { cursor: 'pointer' as never },
                        ]}
                      >
                        <Text style={styles.replaceCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        testID="prism-start-daily"
                        accessibilityRole="button"
                        onPress={handleStartDaily}
                        style={({ pressed }) => [
                          styles.replaceConfirmBtn,
                          pressed && styles.pressed,
                          Platform.OS === 'web' && { cursor: 'pointer' as never },
                        ]}
                      >
                        <Text style={styles.replaceConfirmBtnText}>Replace Live Run?</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    testID="prism-start-daily"
                    accessibilityRole="button"
                    onPress={handleStartDaily}
                    style={({ pressed }) => [
                      styles.primaryBrassBtn,
                      pressed && styles.pressed,
                      Platform.OS === 'web' && { cursor: 'pointer' as never },
                    ]}
                  >
                    <Icon name="lorc/rainbow-star" size={22} color={PRISM_COLORS.feltBg} />
                    <Text style={styles.primaryBrassText}>
                      {todayCleared ? "Replay Today's Daily" : "Play Today's Daily"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Portable Save Backup Modal */}
      <Modal
        visible={backupOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBackupOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Icon name="lorc/backup" size={20} color={PRISM_COLORS.gold} />
                <Text style={styles.modalTitle}>Save Backup Code</Text>
              </View>
              <Pressable
                testID="prism-backup-close"
                onPress={() => setBackupOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.modalDesc}>
              Export your Prism Deck career stats, unlocked decks, Daily streak, and active run as a
              portable checksummed code to move between devices.
            </Text>

            <Pressable
              testID="prism-backup-copy"
              onPress={handleCopyBackup}
              style={({ pressed }) => [
                styles.primaryBrassBtn,
                pressed && styles.pressed,
                Platform.OS === 'web' && { cursor: 'pointer' as never },
              ]}
            >
              <Text style={styles.primaryBrassText}>
                {copiedBackup ? 'Copied Backup Code ✓' : 'Copy Backup Code'}
              </Text>
            </Pressable>

            {exportedCode.length > 0 && (
              <Text style={styles.codePreview} numberOfLines={2} ellipsizeMode="middle">
                {exportedCode}
              </Text>
            )}

            <View style={styles.modalDivider} />

            <Text style={styles.sectionLabel}>PASTE &amp; RESTORE CODE</Text>
            <TextInput
              testID="prism-backup-input"
              value={restoreInput}
              onChangeText={setRestoreInput}
              placeholder="Paste PRISM1:... backup code"
              placeholderTextColor={PRISM_COLORS.textMuted}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.restoreInput}
            />

            <Pressable
              testID="prism-backup-restore"
              disabled={restoreInput.trim().length === 0}
              onPress={handleRestoreBackup}
              style={({ pressed }) => [
                styles.restoreBtn,
                restoreInput.trim().length === 0 && styles.btnDisabled,
                pressed && restoreInput.trim().length > 0 && styles.pressed,
                Platform.OS === 'web' && restoreInput.trim().length > 0 && { cursor: 'pointer' as never },
              ]}
            >
              <Text style={styles.restoreBtnText}>Restore Backup</Text>
            </Pressable>

            {restoreStatus && (
              <View
                style={[
                  styles.restoreStatusBox,
                  restoreStatus.ok ? styles.restoreOk : styles.restoreErr,
                ]}
              >
                <Text style={styles.restoreStatusText}>{restoreStatus.message}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltSurface,
    gap: 8,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: PRISM_COLORS.gold,
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
    maxWidth: 820,
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
    color: PRISM_COLORS.textPrimary,
  },
  dismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  dismissText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  sharedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: PRISM_COLORS.chipsBlue,
  },
  sharedBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  resumeCard: {
    backgroundColor: PRISM_COLORS.feltElevated,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PRISM_COLORS.gold,
    padding: 14,
    gap: 12,
  },
  resumeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resumeInfo: {
    flex: 1,
    gap: 4,
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  liveTag: {
    backgroundColor: PRISM_COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
    letterSpacing: 0.6,
  },
  resumeDeckName: {
    fontSize: 15,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  resumeSub: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
  },
  resumeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  resumePrimaryBtn: {
    flex: 1,
    minWidth: 180,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  resumePrimaryText: {
    fontSize: 14,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
  },
  abandonBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abandonBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FCA5A5',
  },
  confirmAbandonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelSmallBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSmallText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  confirmAbandonBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmAbandonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 4,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  tabBtnActive: {
    backgroundColor: PRISM_COLORS.gold,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
  },
  tabTextActive: {
    color: PRISM_COLORS.feltBg,
  },
  clearedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PRISM_COLORS.econGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearedDotText: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
  },
  sectionStack: {
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: PRISM_COLORS.textMuted,
  },
  labToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
    backgroundColor: PRISM_COLORS.feltSurface,
  },
  labToggleActive: {
    backgroundColor: PRISM_COLORS.gold,
    borderColor: '#FFF3C4',
  },
  labToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  labToggleTextActive: {
    color: PRISM_COLORS.feltBg,
  },
  deckGrid: {
    gap: 10,
  },
  deckGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  deckCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 13,
    gap: 8,
  },
  deckCardWide: {
    width: '48.8%',
  },
  deckCardSelected: {
    borderColor: PRISM_COLORS.gold,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  deckCardLocked: {
    opacity: 0.62,
  },
  deckTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deckIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: PRISM_COLORS.feltBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  deckNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  deckName: {
    fontSize: 15,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  winPill: {
    backgroundColor: 'rgba(242, 201, 76, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  winPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  labPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  labPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.chipsBlue,
  },
  deckStatsLine: {
    fontSize: 12,
    color: PRISM_COLORS.gold,
    fontWeight: '700',
    marginTop: 2,
  },
  deckDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: PRISM_COLORS.textMuted,
  },
  deckUnlockText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.chipsBlue,
  },
  seedCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 12,
    gap: 8,
  },
  seedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  seedInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltBg,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
    letterSpacing: 1,
  },
  randomBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
    backgroundColor: PRISM_COLORS.feltElevated,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  randomBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  careerStrip: {
    flexDirection: 'row',
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  careerCell: {
    flex: 1,
    alignItems: 'center',
  },
  careerVal: {
    fontSize: 16,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  careerKey: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
    marginTop: 2,
  },
  ctaStack: {
    gap: 10,
  },
  primaryBrassBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: PRISM_COLORS.gold,
    borderWidth: 2,
    borderColor: '#FFF3C4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  primaryBrassText: {
    fontSize: 16,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
    letterSpacing: 0.4,
  },
  tutorialBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  tutorialBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  dailyHeroCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
    padding: 16,
    gap: 14,
  },
  dailyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  dailyDatePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
  },
  dailyDateText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  dailyStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderWidth: 1,
    borderColor: PRISM_COLORS.chipsBlue,
  },
  dailyStatusPillDone: {
    backgroundColor: 'rgba(52, 211, 153, 0.18)',
    borderColor: PRISM_COLORS.econGreen,
  },
  dailyStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.chipsBlue,
  },
  dailyStatusTextDone: {
    color: PRISM_COLORS.econGreen,
  },
  dailyHeadline: {
    fontSize: 20,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  dailySeedText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
    marginTop: -8,
  },
  mutatorSpotlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  mutatorIconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutatorTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  mutatorEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: PRISM_COLORS.gold,
  },
  mutatorName: {
    fontSize: 17,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  mutatorDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: PRISM_COLORS.textMuted,
  },
  dailyStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dailyStatBox: {
    flex: 1,
    minWidth: 74,
    backgroundColor: PRISM_COLORS.feltBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  dailyStatVal: {
    fontSize: 18,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  dailyStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 12, 10, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PRISM_COLORS.goldDark,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  modalDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: PRISM_COLORS.textMuted,
  },
  codePreview: {
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    color: PRISM_COLORS.textMuted,
    backgroundColor: PRISM_COLORS.feltBg,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
  },
  modalDivider: {
    height: 1,
    backgroundColor: PRISM_COLORS.feltBorder,
    marginVertical: 2,
  },
  restoreInput: {
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltBg,
    padding: 10,
    fontSize: 12,
    color: PRISM_COLORS.textPrimary,
    textAlignVertical: 'top',
  },
  restoreBtn: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.chipsBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRISM_COLORS.chipsBlue,
  },
  restoreStatusBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  restoreOk: {
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    borderColor: PRISM_COLORS.econGreen,
  },
  restoreErr: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: PRISM_COLORS.danger,
  },
  restoreStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  replaceConfirmBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.danger,
    padding: 12,
    gap: 10,
  },
  replaceConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
    textAlign: 'center',
  },
  replaceConfirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  replaceCancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  replaceConfirmBtn: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  replaceConfirmBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});

export default PrismSetup;
