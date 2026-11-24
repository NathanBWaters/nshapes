import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { BOSS_BLIND_BY_ID } from '../data/blinds';
import { isCardWild } from '../data/cards';
import { SPELL_BY_ID } from '../data/spells';
import {
  castSpell,
  clearSelection,
  discardSelected,
  playSelectedSet,
  previewSelection,
  reorderCharm,
  sellCharm,
  toggleCard,
} from '../engine/run';
import type { PrismColor, PrismNumber, PrismRun, PrismShape } from '../types';
import PrismCardTile from './PrismCardTile';
import PrismDeckModal from './PrismDeckModal';
import PrismJokerBelt from './PrismJokerBelt';
import PrismScoreBanner from './PrismScoreBanner';
import PrismSpellPocket from './PrismSpellPocket';
import { PRISM_COLORS, formatScore, playPrismSfx } from './prismTheme';

export interface PrismPlayScreenProps {
  run: PrismRun;
  blueprintAssist: boolean;
  colorblind: boolean;
  audioState: 'all' | 'sfx' | 'music' | 'muted';
  onToggleBlueprint: () => void;
  onToggleColorblind: () => void;
  onCycleAudio: () => void;
  onDispatch: (nextRun: PrismRun) => void;
  onOpenPauseMenu: () => void;
  /** Disable board keyboard shortcuts (e.g. while Pause Modal is open). */
  shortcutsDisabled?: boolean;
  /** Called when pressing Escape while Pause Modal is open. */
  onClosePauseMenu?: () => void;
}

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const DESKTOP_HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='] as const;

const KEY_TO_BOARD_INDEX: Record<string, number> = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  '0': 9,
  '-': 10,
  '=': 11,
};

const AUDIO_LABELS: Record<'all' | 'sfx' | 'music' | 'muted', string> = {
  all: 'All',
  sfx: 'SFX',
  music: 'Music',
  muted: 'Off',
};

const PrismPlayScreen: React.FC<PrismPlayScreenProps> = ({
  run,
  blueprintAssist,
  colorblind,
  audioState,
  onToggleBlueprint,
  onToggleColorblind,
  onCycleAudio,
  onDispatch,
  onOpenPauseMenu,
  shortcutsDisabled = false,
  onClosePauseMenu,
}) => {
  const { width } = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const isDesktop = width >= 900;

  const [deckModalTab, setDeckModalTab] = useState<'deck' | 'hands' | null>(null);
  const [activeSpellIndex, setActiveSpellIndex] = useState<number | null>(null);
  const [pendingSpellCardId, setPendingSpellCardId] = useState<string | null>(null);
  const [dismissedToast, setDismissedToast] = useState<string | null>(null);

  // Clear spell targeting if spell slot vanished or board changed out from under it
  const safeSpellIndex =
    activeSpellIndex !== null && activeSpellIndex >= 0 && activeSpellIndex < run.spells.length
      ? activeSpellIndex
      : null;

  const activeOwnedSpell = safeSpellIndex !== null ? run.spells[safeSpellIndex] : null;
  const activeSpellDef = activeOwnedSpell ? SPELL_BY_ID[activeOwnedSpell.spellId] : null;

  const pendingTargetCard = useMemo(() => {
    if (!pendingSpellCardId || !activeSpellDef?.supportsValueChoice) return null;
    return run.board.find(c => c.id === pendingSpellCardId) ?? null;
  }, [pendingSpellCardId, activeSpellDef, run.board]);

  // Reset dismissed toast whenever run produces a fresh toast string
  useEffect(() => {
    if (run.lastToast !== dismissedToast) {
      setDismissedToast(null);
    }
  }, [run.lastToast, dismissedToast]);

  const preview = useMemo(() => previewSelection(run), [run]);

  const bossDef = run.activeBossId ? BOSS_BLIND_BY_ID[run.activeBossId] : null;
  const debuffedColor = bossDef?.debuffedColor ?? null;
  const disabledCharmIndex = run.activeBossId === 'the_eclipse' ? 0 : null;

  const magnetMarkedIds = useMemo(() => {
    const ids = new Set<string>();
    run.charms.forEach((c, idx) => {
      if (disabledCharmIndex === idx) return;
      if (c.charmId === 'magnet' && c.state.magnetCardId) {
        ids.add(c.state.magnetCardId);
      }
    });
    return ids;
  }, [run.charms, disabledCharmIndex]);

  const hasActiveMirrorShard = useMemo(
    () =>
      run.charms.some(
        (c, idx) => c.charmId === 'mirror-shard' && disabledCharmIndex !== idx
      ),
    [run.charms, disabledCharmIndex]
  );

  const mirrorSlotSet = useMemo(
    () => new Set(hasActiveMirrorShard ? run.lastSetIndices : []),
    [hasActiveMirrorShard, run.lastSetIndices]
  );

  const blueprintMatchSet = useMemo(() => {
    if (!blueprintAssist || preview.selectedCount !== 2 || !preview.blueprintNeed) {
      return new Set<number>();
    }
    return new Set(preview.blueprintNeed.matchingBoardIndices);
  }, [blueprintAssist, preview]);

  const selectedSet = useMemo(() => new Set(run.selectedIndices), [run.selectedIndices]);

  const triggeredCharmIds = useMemo(() => {
    if (preview.isValidSet) return preview.triggeredCharmIds;
    if (run.selectedIndices.length === 0 && run.lastScoreBreakdown) {
      return run.lastScoreBreakdown.triggeredCharmIds;
    }
    return [];
  }, [preview.isValidSet, preview.triggeredCharmIds, run.selectedIndices.length, run.lastScoreBreakdown]);

  const cancelSpellMode = useCallback(() => {
    setActiveSpellIndex(null);
    setPendingSpellCardId(null);
  }, []);

  const handleSelectSpell = useCallback((spellIdx: number) => {
    setActiveSpellIndex(spellIdx);
    setPendingSpellCardId(null);
  }, []);

  const handleChooseSpellValue = useCallback(
    (value: PrismColor | PrismShape | PrismNumber) => {
      if (safeSpellIndex === null || !pendingSpellCardId) return;
      const next = castSpell(run, safeSpellIndex, pendingSpellCardId, value);
      playPrismSfx('spell');
      setActiveSpellIndex(null);
      setPendingSpellCardId(null);
      onDispatch(next);
    },
    [run, safeSpellIndex, pendingSpellCardId, onDispatch]
  );

  const handleCardPress = useCallback(
    (boardIdx: number) => {
      const card = run.board[boardIdx];
      if (!card) return;

      // Spell targeting mode intercepts board card clicks cleanly
      if (safeSpellIndex !== null && activeSpellDef) {
        if (activeSpellDef.supportsValueChoice) {
          playPrismSfx('select');
          setPendingSpellCardId(card.id);
          return;
        }
        const next = castSpell(run, safeSpellIndex, card.id);
        playPrismSfx('spell');
        setActiveSpellIndex(null);
        setPendingSpellCardId(null);
        onDispatch(next);
        return;
      }

      const alreadySelected = run.selectedIndices.includes(boardIdx);
      if (!alreadySelected && run.selectedIndices.length >= 3) {
        playPrismSfx('invalid');
        return;
      }

      const next = toggleCard(run, boardIdx);
      playPrismSfx(alreadySelected ? 'deselect' : 'select');
      onDispatch(next);
    },
    [run, safeSpellIndex, activeSpellDef, onDispatch]
  );

  const handlePlaySet = useCallback(() => {
    if (run.selectedIndices.length !== 3) {
      playPrismSfx('invalid');
      return;
    }
    if (!preview.isValidSet) {
      playPrismSfx('invalid');
      const next = playSelectedSet(run);
      onDispatch(next);
      return;
    }
    cancelSpellMode();
    const big = preview.wouldClearBlind || preview.estimatedTotal >= 1000;
    playPrismSfx(big ? 'big_hit' : 'play');
    const next = playSelectedSet(run);
    onDispatch(next);
  }, [run, preview, cancelSpellMode, onDispatch]);

  const handleDiscard = useCallback(() => {
    if (run.discardsLeft <= 0 || run.selectedIndices.length === 0 || run.selectedIndices.length > 3) {
      playPrismSfx('invalid');
      return;
    }
    cancelSpellMode();
    playPrismSfx('discard');
    const next = discardSelected(run);
    onDispatch(next);
  }, [run, cancelSpellMode, onDispatch]);

  const handleClear = useCallback(() => {
    if (safeSpellIndex !== null) {
      cancelSpellMode();
      playPrismSfx('click');
      return;
    }
    if (run.selectedIndices.length === 0) return;
    playPrismSfx('deselect');
    onDispatch(clearSelection(run));
  }, [run, safeSpellIndex, cancelSpellMode, onDispatch]);

  const handleReorderCharm = useCallback(
    (fromIndex: number, toIndex: number) => {
      onDispatch(reorderCharm(run, fromIndex, toIndex));
    },
    [run, onDispatch]
  );

  const handleSellCharm = useCallback(
    (index: number) => {
      onDispatch(sellCharm(run, index));
    },
    [run, onDispatch]
  );

  // Desktop web keyboard controls (cleaned up on unmount)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (shortcutsDisabled) {
          onClosePauseMenu?.();
        } else if (safeSpellIndex !== null) {
          cancelSpellMode();
        } else if (deckModalTab !== null) {
          setDeckModalTab(null);
        } else {
          onOpenPauseMenu();
        }
        return;
      }

      // Ignore all board shortcuts while Pause Modal or Deck/Hands Modal is open
      if (shortcutsDisabled || deckModalTab !== null) return;

      const boardIdx = KEY_TO_BOARD_INDEX[e.key];
      if (boardIdx !== undefined && boardIdx < run.board.length) {
        e.preventDefault();
        handleCardPress(boardIdx);
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        if (safeSpellIndex === null && preview.isValidSet) {
          e.preventDefault();
          handlePlaySet();
        }
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        if (run.discardsLeft > 0 && run.selectedIndices.length > 0) {
          e.preventDefault();
          handleDiscard();
        }
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        onToggleBlueprint();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    shortcutsDisabled,
    onClosePauseMenu,
    safeSpellIndex,
    deckModalTab,
    run.board.length,
    run.discardsLeft,
    run.selectedIndices.length,
    preview.isValidSet,
    cancelSpellMode,
    handleCardPress,
    handlePlaySet,
    handleDiscard,
    handleClear,
    onToggleBlueprint,
    onOpenPauseMenu,
  ]);

  const isInteractive = run.phase === 'playing';
  const canPlay = isInteractive && preview.isValidSet;
  const canDiscard =
    isInteractive &&
    run.discardsLeft > 0 &&
    run.selectedIndices.length > 0 &&
    run.selectedIndices.length <= 3;
  const canClear = isInteractive && (run.selectedIndices.length > 0 || safeSpellIndex !== null);

  const visibleToast =
    run.lastToast && run.lastToast !== dismissedToast ? run.lastToast : null;

  const cols = Math.max(1, run.boardCols || 3);
  const rows: number[][] = [];
  for (let i = 0; i < run.board.length; i += cols) {
    const row: number[] = [];
    for (let c = 0; c < cols && i + c < run.board.length; c++) {
      row.push(i + c);
    }
    rows.push(row);
  }

  const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : undefined;
  const showDesktopHotkeys = Platform.OS === 'web' && isDesktop;

  const renderHeaderToggles = (compactHeader: boolean) => (
    <View style={[styles.togglesRow, compactHeader && styles.togglesRowCompact]}>
      <TouchableOpacity
        testID="prism-toggle-blueprint"
        accessibilityRole="button"
        accessibilityLabel={`Blueprint Assist ${blueprintAssist ? 'on' : 'off'}`}
        onPress={onToggleBlueprint}
        style={[
          styles.headerToggleBtn,
          compactHeader && styles.headerToggleBtnMobile,
          blueprintAssist && styles.headerToggleBtnActive,
          webCursor,
        ]}
      >
        <Icon
          name="lorc/light-bulb"
          size={compactHeader ? 12 : 14}
          color={blueprintAssist ? '#121212' : PRISM_COLORS.textMuted}
          noShadow
        />
        <Text
          style={[
            styles.headerToggleText,
            blueprintAssist && styles.headerToggleTextActive,
          ]}
          numberOfLines={1}
        >
          Hint
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="prism-toggle-colorblind"
        accessibilityRole="button"
        accessibilityLabel={`Colorblind mode ${colorblind ? 'on' : 'off'}`}
        onPress={onToggleColorblind}
        style={[
          styles.headerToggleBtn,
          compactHeader && styles.headerToggleBtnMobile,
          colorblind && styles.headerToggleBtnActive,
          webCursor,
        ]}
      >
        <Icon
          name="lorc/third-eye"
          size={compactHeader ? 12 : 14}
          color={colorblind ? '#121212' : PRISM_COLORS.textMuted}
          noShadow
        />
        <Text
          style={[styles.headerToggleText, colorblind && styles.headerToggleTextActive]}
          numberOfLines={1}
        >
          CB
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="prism-toggle-audio"
        accessibilityRole="button"
        accessibilityLabel={`Audio ${audioState}`}
        onPress={onCycleAudio}
        style={[
          styles.headerToggleBtn,
          compactHeader && styles.headerToggleBtnMobile,
          audioState !== 'muted' && styles.headerToggleBtnWarm,
          webCursor,
        ]}
      >
        <Icon
          name="delapouite/sound-on"
          size={compactHeader ? 12 : 14}
          color={audioState === 'muted' ? PRISM_COLORS.textMuted : PRISM_COLORS.gold}
          noShadow
        />
        <Text style={styles.headerToggleText} numberOfLines={1}>
          {AUDIO_LABELS[audioState]}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="prism-pause"
        accessibilityRole="button"
        accessibilityLabel="Pause menu"
        onPress={() => {
          playPrismSfx('click');
          onOpenPauseMenu();
        }}
        style={[
          styles.headerToggleBtn,
          compactHeader && styles.headerToggleBtnMobile,
          webCursor,
        ]}
      >
        <Icon
          name="lorc/gear-hammer"
          size={compactHeader ? 12 : 14}
          color={PRISM_COLORS.textPrimary}
          noShadow
        />
        <Text style={styles.headerToggleText} numberOfLines={1}>
          Menu
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderBoardGrid = () => (
    <View style={[styles.boardGrid, !isDesktop && styles.boardGridMobile]}>
      {rows.map((rowIndices, rIdx) => (
        <View key={rIdx} style={[styles.boardRow, !isDesktop && styles.boardRowMobile]}>
          {rowIndices.map(boardIdx => {
            const card = run.board[boardIdx];
            if (!card) return null;
            const isDebuffed =
              debuffedColor !== null && !isCardWild(card) && card.color === debuffedColor;
            const isSelected = selectedSet.has(boardIdx);
            const isSpellTarget = safeSpellIndex !== null;
            const hotkey =
              showDesktopHotkeys && boardIdx < DESKTOP_HOTKEYS.length
                ? DESKTOP_HOTKEYS[boardIdx]
                : undefined;

            return (
              <View key={card.id} style={styles.boardCell}>
                <PrismCardTile
                  testID={`prism-card-${boardIdx}`}
                  card={card}
                  selected={isSelected || pendingSpellCardId === card.id}
                  disabled={!isInteractive}
                  debuffed={isDebuffed}
                  hotkeyLabel={hotkey}
                  highlightTarget={isSpellTarget}
                  dense={!isDesktop && rows.length >= 4}
                  animateDeal={run.handsPlayedThisBlind > 0 || run.discardsUsedThisBlind > 0}
                  isMagnetMarked={magnetMarkedIds.has(card.id)}
                  isMirrorSlot={mirrorSlotSet.has(boardIdx)}
                  isBlueprintMatch={blueprintMatchSet.has(boardIdx)}
                  colorblindOverride={colorblind}
                  onPress={isInteractive ? () => handleCardPress(boardIdx) : undefined}
                />
              </View>
            );
          })}
          {/* Keep partial last row aligned cleanly to the grid */}
          {rowIndices.length < cols &&
            Array.from({ length: cols - rowIndices.length }).map((_, fillerIdx) => (
              <View key={`filler-${fillerIdx}`} style={styles.boardCell} />
            ))}
        </View>
      ))}
    </View>
  );

  const renderActionBar = () => (
    <View style={[styles.actionBar, !isDesktop && styles.actionBarMobile]}>
      <TouchableOpacity
        testID="prism-play-set"
        accessibilityRole="button"
        accessibilityLabel={
          canPlay
            ? `Play Set for ${formatScore(preview.estimatedTotal)} points`
            : 'Play Set'
        }
        accessibilityState={{ disabled: !canPlay }}
        disabled={!canPlay}
        activeOpacity={0.88}
        onPress={handlePlaySet}
        style={[
          styles.playBtn,
          canPlay && styles.playBtnArmed,
          canPlay && preview.wouldClearBlind && styles.playBtnClear,
          !canPlay && styles.btnDisabled,
          webCursor,
        ]}
      >
        <Icon
          name="lorc/bright-explosion"
          size={17}
          color={canPlay ? '#121212' : PRISM_COLORS.textMuted}
          noShadow
        />
        <Text
          style={[styles.playBtnText, !canPlay && styles.playBtnTextDisabled]}
          numberOfLines={1}
        >
          {canPlay
            ? `PLAY SET (+${formatScore(preview.estimatedTotal)})`
            : `PLAY SET (${run.selectedIndices.length}/3)`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="prism-discard"
        accessibilityRole="button"
        accessibilityLabel={`Discard selected cards, ${run.discardsLeft} discards remaining`}
        accessibilityState={{ disabled: !canDiscard }}
        disabled={!canDiscard}
        activeOpacity={0.85}
        onPress={handleDiscard}
        style={[styles.discardBtn, !canDiscard && styles.btnDisabled, webCursor]}
      >
        <Icon
          name="lorc/recycle"
          size={15}
          color={canDiscard ? '#FFFFFF' : PRISM_COLORS.textMuted}
          noShadow
        />
        <Text
          style={[styles.discardBtnText, !canDiscard && styles.btnTextDisabled]}
          numberOfLines={1}
        >
          {run.selectedIndices.length > 0
            ? `DISCARD (${run.selectedIndices.length})`
            : 'DISCARD'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="prism-clear"
        accessibilityRole="button"
        accessibilityLabel="Clear selection"
        accessibilityState={{ disabled: !canClear }}
        disabled={!canClear}
        activeOpacity={0.85}
        onPress={handleClear}
        style={[styles.clearBtn, !canClear && styles.btnDisabled, webCursor]}
      >
        <Text style={[styles.clearBtnText, !canClear && styles.btnTextDisabled]}>
          Clear
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderToastBanner = () =>
    visibleToast ? (
      <TouchableOpacity
        testID="prism-toast"
        activeOpacity={0.9}
        onPress={() => setDismissedToast(visibleToast)}
        style={styles.toastBanner}
      >
        <Icon name="delapouite/sparkles" size={14} color={PRISM_COLORS.gold} noShadow />
        <Text style={styles.toastText} numberOfLines={2}>
          {visibleToast}
        </Text>
        <Text style={styles.toastDismiss}>✕</Text>
      </TouchableOpacity>
    ) : null;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {isDesktop ? (
        /* ── DESKTOP 2-COLUMN BALATRO FELT TABLE (>= 900px) ── */
        <View style={[styles.desktopSplit, { paddingBottom: Math.max(14, insets.bottom) }]}>
          {/* Left 320px Control & Score Rail */}
          <ScrollView
            style={styles.leftRail}
            contentContainerStyle={styles.leftRailContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Brand + Seed Strip */}
            <View style={styles.railBrandBar}>
              <View style={styles.brandTitleWrap}>
                <Icon name="delapouite/prism" size={18} color={PRISM_COLORS.gold} noShadow />
                <Text style={styles.brandTitle} numberOfLines={1}>
                  PRISM DECK
                </Text>
              </View>
              <View style={styles.seedBadge}>
                <Text style={styles.seedBadgeText}>
                  {run.isDaily ? 'DAILY' : run.seed}
                </Text>
              </View>
            </View>

            {/* Quick Header Toggles */}
            {renderHeaderToggles(false)}

            {/* Main Balatro Scoreboard + Blind Target + Hands/Discards/Gold */}
            <PrismScoreBanner
              run={run}
              preview={preview}
              blueprintAssist={blueprintAssist}
              vertical
            />

            {/* Deck & Pattern Hands Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                testID="prism-open-deck"
                accessibilityRole="button"
                accessibilityLabel="Open Deck viewer"
                onPress={() => {
                  playPrismSfx('click');
                  setDeckModalTab('deck');
                }}
                style={[styles.secondaryModalBtn, webCursor]}
              >
                <Icon name="delapouite/stack" size={15} color={PRISM_COLORS.gold} noShadow />
                <Text style={styles.secondaryModalBtnText}>
                  Deck ({run.drawPile.length}/{run.deck.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="prism-open-hands"
                accessibilityRole="button"
                accessibilityLabel="Open Pattern Hands reference"
                onPress={() => {
                  playPrismSfx('click');
                  setDeckModalTab('hands');
                }}
                style={[styles.secondaryModalBtn, webCursor]}
              >
                <Icon name="lorc/poker-hand" size={15} color={PRISM_COLORS.chipsBlue} noShadow />
                <Text style={styles.secondaryModalBtnText}>Hands</Text>
              </TouchableOpacity>
            </View>

            {/* Subtle Desktop Keyboard Hint */}
            {Platform.OS === 'web' && (
              <View style={styles.hotkeyLegend}>
                <Text style={styles.hotkeyLegendTitle}>SHORTCUTS</Text>
                <Text style={styles.hotkeyLegendText}>
                  {run.board.length <= 9 ? '1–9' : '1–9, 0, -, ='} Select • Space/Enter Play • D Discard • C Clear • H Hint • Esc Menu
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Right Flexible Felt Stage */}
          <ScrollView
            style={styles.rightStage}
            contentContainerStyle={styles.rightStageContent}
            showsVerticalScrollIndicator={false}
          >
            <PrismJokerBelt
              run={run}
              triggeredCharmIds={triggeredCharmIds}
              disabledCharmIndex={disabledCharmIndex}
              canReorder
              canSell
              onReorder={handleReorderCharm}
              onSell={handleSellCharm}
            />

            {renderToastBanner()}

            <View style={styles.boardStageCenter}>{renderBoardGrid()}</View>

            <PrismSpellPocket
              run={run}
              activeSpellIndex={safeSpellIndex}
              pendingTargetCard={pendingTargetCard}
              colorblind={colorblind}
              onSelectSpell={handleSelectSpell}
              onChooseValue={handleChooseSpellValue}
              onCancel={cancelSpellMode}
            />

            {renderActionBar()}
          </ScrollView>
        </View>
      ) : (
        /* ── MOBILE PORTRAIT LAYOUT (< 900px) ── */
        <View style={styles.mobileWrap}>
          {/* Single-row Compact Top Utility Header (~40px tall, zero wrap on 375px) */}
          <View style={styles.mobileHeader}>
            <View style={styles.mobileHeaderLeft}>
              <TouchableOpacity
                testID="prism-open-deck"
                accessibilityRole="button"
                accessibilityLabel={`Open Deck viewer, ${run.drawPile.length} cards in draw pile`}
                onPress={() => {
                  playPrismSfx('click');
                  setDeckModalTab('deck');
                }}
                style={[styles.mobileDeckBtn, webCursor]}
              >
                <Icon name="delapouite/stack" size={12} color={PRISM_COLORS.gold} noShadow />
                <Text style={styles.mobileDeckBtnText} numberOfLines={1}>
                  Deck
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="prism-open-hands"
                accessibilityRole="button"
                accessibilityLabel="Open Pattern Hands reference"
                onPress={() => {
                  playPrismSfx('click');
                  setDeckModalTab('hands');
                }}
                style={[styles.mobileDeckBtn, webCursor]}
              >
                <Icon name="lorc/poker-hand" size={12} color={PRISM_COLORS.chipsBlue} noShadow />
                <Text style={styles.mobileDeckBtnText} numberOfLines={1}>
                  Hands
                </Text>
              </TouchableOpacity>
            </View>

            {renderHeaderToggles(true)}
          </View>

          <ScrollView
            style={styles.mobileScroll}
            contentContainerStyle={styles.mobileScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <PrismScoreBanner
              run={run}
              preview={preview}
              blueprintAssist={blueprintAssist}
              compact
            />

            <PrismJokerBelt
              run={run}
              triggeredCharmIds={triggeredCharmIds}
              disabledCharmIndex={disabledCharmIndex}
              canReorder
              canSell
              onReorder={handleReorderCharm}
              onSell={handleSellCharm}
              compact
            />

            {renderToastBanner()}

            {renderBoardGrid()}

            <PrismSpellPocket
              run={run}
              activeSpellIndex={safeSpellIndex}
              pendingTargetCard={pendingTargetCard}
              colorblind={colorblind}
              compact
              onSelectSpell={handleSelectSpell}
              onChooseValue={handleChooseSpellValue}
              onCancel={cancelSpellMode}
            />
          </ScrollView>

          <View
            style={[
              styles.mobileActionFooter,
              { paddingBottom: Math.max(8, insets.bottom) },
            ]}
          >
            {renderActionBar()}
          </View>
        </View>
      )}

      {/* Deck & Pattern Hands Inspector Modal */}
      <PrismDeckModal
        visible={deckModalTab !== null}
        run={run}
        initialTab={deckModalTab ?? 'deck'}
        onClose={() => setDeckModalTab(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PRISM_COLORS.feltBg,
  },
  desktopSplit: {
    flex: 1,
    flexDirection: 'row',
    padding: 14,
    gap: 14,
  },
  leftRail: {
    width: 320,
    flexGrow: 0,
    flexShrink: 0,
  },
  leftRailContent: {
    gap: 10,
    paddingBottom: 12,
  },
  railBrandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  brandTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
    letterSpacing: 1.4,
  },
  seedBadge: {
    backgroundColor: PRISM_COLORS.feltDeep,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  seedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
    letterSpacing: 0.6,
  },
  togglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  togglesRowCompact: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 3,
  },
  headerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 38,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
  },
  headerToggleBtnMobile: {
    minHeight: 32,
    paddingHorizontal: 5,
    gap: 2,
    borderRadius: 7,
    flexShrink: 1,
  },
  headerToggleBtnActive: {
    backgroundColor: PRISM_COLORS.gold,
    borderColor: PRISM_COLORS.brassLight,
  },
  headerToggleBtnWarm: {
    borderColor: PRISM_COLORS.goldDark,
  },
  headerToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
    flexShrink: 1,
  },
  headerToggleTextActive: {
    color: '#121212',
    fontWeight: '900',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryModalBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  secondaryModalBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  hotkeyLegend: {
    backgroundColor: PRISM_COLORS.feltDeep,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(44, 89, 75, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  hotkeyLegendTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
    letterSpacing: 0.9,
  },
  hotkeyLegendText: {
    fontSize: 11,
    color: PRISM_COLORS.textMuted,
    lineHeight: 16,
  },
  rightStage: {
    flex: 1,
  },
  rightStageContent: {
    flexGrow: 1,
    gap: 10,
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  boardStageCenter: {
    width: '100%',
    maxWidth: 740,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  boardGrid: {
    width: '100%',
    gap: 10,
  },
  boardGridMobile: {
    gap: 5,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  boardRowMobile: {
    gap: 6,
  },
  boardCell: {
    flex: 1,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E3C30',
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  toastText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.brassLight,
  },
  toastDismiss: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.textMuted,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
    maxWidth: 740,
    alignSelf: 'center',
  },
  actionBarMobile: {
    gap: 7,
  },
  playBtn: {
    flex: 2,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 2,
    borderColor: PRISM_COLORS.feltBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  playBtnArmed: {
    backgroundColor: PRISM_COLORS.gold,
    borderColor: PRISM_COLORS.brassLight,
    borderBottomWidth: 4,
    borderBottomColor: PRISM_COLORS.goldDark,
  },
  playBtnClear: {
    backgroundColor: '#FDE047',
    borderColor: '#FFFFFF',
  },
  playBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#121212',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  playBtnTextDisabled: {
    color: PRISM_COLORS.textMuted,
  },
  discardBtn: {
    flex: 1.15,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#B91C1C',
    borderWidth: 2,
    borderColor: '#F87171',
    borderBottomWidth: 4,
    borderBottomColor: '#7F1D1D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  discardBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  clearBtn: {
    minWidth: 62,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  btnDisabled: {
    opacity: 0.42,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderColor: PRISM_COLORS.feltBorder,
    borderBottomWidth: 2,
  },
  btnTextDisabled: {
    color: PRISM_COLORS.textMuted,
  },
  mobileWrap: {
    flex: 1,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderBottomWidth: 1,
    borderBottomColor: PRISM_COLORS.feltBorder,
  },
  mobileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  mobileDeckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 32,
    paddingHorizontal: 5,
    borderRadius: 7,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    flexShrink: 1,
  },
  mobileDeckBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
    flexShrink: 1,
  },
  mobileScroll: {
    flex: 1,
  },
  mobileScrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 5,
  },
  mobileActionFooter: {
    paddingHorizontal: 8,
    paddingTop: 6,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderTopWidth: 1.5,
    borderTopColor: PRISM_COLORS.feltBorder,
  },
});

export default PrismPlayScreen;
