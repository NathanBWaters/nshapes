/**
 * Prism Deck — Root Mode Controller.
 *
 * Manages:
 * - First-visit 45s interactive tutorial (auto-shown once, replayable from Setup)
 * - Setup / Daily Challenge hub & URL-shared seed/daily pre-population
 * - Phase routing: blind_select ⇄ playing ⇄ shop ⇄ victory (→ Endless!) / defeat
 * - MMKV persistence, single-fire career meta recording, and quota-safe warning banner
 * - Decoupled Music/SFX/Colorblind/Blueprint settings and safe Pause Modal
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from '@/components/Icon';
import { music, setMusicEnabled, setSfxOverride } from '@/audio';
import { setAudioEnabled } from '@/utils/sounds';
import { ColorblindStorage, MusicStorage, SoundStorage, storage } from '@/utils/storage';
import {
  STARTER_DECK_BY_ID,
  buyShopCharm,
  buySpell,
  buyStarChart,
  buyVoucher,
  cashOutToShop,
  clearPrismStorageError,
  continueEndless,
  createRun,
  getPrismStorageError,
  getTodayDateString,
  leaveShop,
  loadPrismMeta,
  loadPrismRun,
  normalizeSeed,
  recordPrismRunEnd,
  reorderCharm,
  rerollShop,
  selectBlind,
  sellCharm,
  skipBlind,
  writePrismRun,
} from '@/prism';
import type { PrismMeta, PrismRun, StarterDeckId } from '@/prism';
import PrismBlindSelect from './PrismBlindSelect';
import PrismCashOutOverlay from './PrismCashOutOverlay';
import PrismPlayScreen from './PrismPlayScreen';
import PrismResults from './PrismResults';
import PrismSetup from './PrismSetup';
import PrismShop from './PrismShop';
import PrismTutorial from './PrismTutorial';
import { PRISM_COLORS, playPrismSfx } from './prismTheme';

export interface PrismModeProps {
  onExit: () => void;
  initialSeed?: string;
  initialDaily?: boolean;
  initialDailyDate?: string;
  initialDeckId?: StarterDeckId;
}

const TUTORIAL_KEY = 'prism_v1_tutorial_completed';
const BLUEPRINT_KEY = 'prism_v1_blueprint_assist';

const readTutorialCompleted = (meta: PrismMeta): boolean => {
  if (meta.totalRuns > 0) return true;
  try {
    return storage.getBoolean(TUTORIAL_KEY) === true;
  } catch {
    return false;
  }
};

const writeTutorialCompleted = (): void => {
  try {
    storage.set(TUTORIAL_KEY, true);
  } catch {
    // ignore storage errors
  }
};

const readBlueprintAssist = (): boolean => {
  try {
    return storage.getBoolean(BLUEPRINT_KEY) ?? true;
  } catch {
    return true;
  }
};

const writeBlueprintAssist = (enabled: boolean): void => {
  try {
    storage.set(BLUEPRINT_KEY, enabled);
  } catch {
    // ignore storage errors
  }
};

const safeGetBool = (getter: (() => boolean) | undefined, fallback: boolean): boolean => {
  try {
    return typeof getter === 'function' ? getter() : fallback;
  } catch {
    return fallback;
  }
};

const PrismMode: React.FC<PrismModeProps> = ({
  onExit,
  initialSeed,
  initialDaily,
  initialDailyDate,
  initialDeckId,
}) => {
  const [meta, setMeta] = useState<PrismMeta>(() => loadPrismMeta());
  const [run, setRun] = useState<PrismRun | null>(() => loadPrismRun());

  const cleanInitialSeed = normalizeSeed(initialSeed);
  const hasUrlLaunch = Boolean(cleanInitialSeed || initialDaily || initialDailyDate);

  const hasInitialActiveRun = Boolean(
    run && run.phase !== 'victory' && run.phase !== 'defeat'
  );

  const [showTutorial, setShowTutorial] = useState<boolean>(
    () => !hasUrlLaunch && !hasInitialActiveRun && !readTutorialCompleted(meta)
  );
  const [inSetup, setInSetup] = useState<boolean>(true);
  const [newlyUnlockedDecks, setNewlyUnlockedDecks] = useState<StarterDeckId[]>([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(() => getPrismStorageError());

  // Settings (reactive with shared storage gateways)
  const [musicOn, setMusicOn] = useState<boolean>(() => safeGetBool(MusicStorage?.get, true));
  const [sfxOn, setSfxOn] = useState<boolean>(() => safeGetBool(SoundStorage?.get, true));
  const [colorblind, setColorblind] = useState<boolean>(() =>
    safeGetBool(ColorblindStorage?.get, false)
  );
  const [blueprintAssist, setBlueprintAssist] = useState<boolean>(readBlueprintAssist);

  // Pause modal state
  const [pauseOpen, setPauseOpen] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guard so `recordPrismRunEnd` fires at most once per run outcome (prevents double-counting on re-renders)
  const recordedEndKeysRef = useRef<Set<string>>(new Set());

  const syncStorageWarning = useCallback(() => {
    const err = getPrismStorageError();
    setStorageWarning(err);
  }, []);

  // Subscribe to global sound/music/colorblind stores
  useEffect(() => {
    const unsubMusic =
      typeof MusicStorage?.subscribe === 'function'
        ? MusicStorage.subscribe(v => setMusicOn(v))
        : undefined;
    const unsubSfx =
      typeof SoundStorage?.subscribe === 'function'
        ? SoundStorage.subscribe(v => setSfxOn(v))
        : undefined;
    const unsubCb =
      typeof ColorblindStorage?.subscribe === 'function'
        ? ColorblindStorage.subscribe(v => setColorblind(v))
        : undefined;
    return () => {
      unsubMusic?.();
      unsubSfx?.();
      unsubCb?.();
    };
  }, []);

  useEffect(() => {
    setMusicEnabled(musicOn);
  }, [musicOn]);

  useEffect(() => {
    setSfxOverride(sfxOn);
    if (typeof setAudioEnabled === 'function') {
      setAudioEnabled(sfxOn);
    }
  }, [sfxOn]);

  // Play calm tabletop theme while inside Prism Deck; stop cleanly on unmount
  useEffect(() => {
    music.play('map');
    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      setSfxOverride(null);
      music.stop();
    };
  }, []);

  const audioState: 'all' | 'sfx' | 'music' | 'muted' =
    musicOn && sfxOn ? 'all' : sfxOn ? 'sfx' : musicOn ? 'music' : 'muted';

  const handleToggleMusic = useCallback(() => {
    const next = !musicOn;
    setMusicOn(next);
    if (typeof MusicStorage?.set === 'function') MusicStorage.set(next);
    playPrismSfx('click');
  }, [musicOn]);

  const handleToggleSfx = useCallback(() => {
    const next = !sfxOn;
    if (typeof MusicStorage?.hasValue === 'function' && !MusicStorage.hasValue()) {
      MusicStorage.set(musicOn);
    }
    setSfxOn(next);
    if (typeof SoundStorage?.set === 'function') SoundStorage.set(next);
    if (typeof setAudioEnabled === 'function') setAudioEnabled(next);
    setSfxOverride(next);
    if (next) {
      playPrismSfx('click');
    }
  }, [musicOn, sfxOn]);

  const handleCycleAudio = useCallback(() => {
    // Cycle: all -> sfx -> muted -> all (and music-only -> muted)
    const nextMusic = audioState === 'muted';
    const nextSfx = audioState === 'all' || audioState === 'muted';
    setMusicOn(nextMusic);
    setSfxOn(nextSfx);
    if (typeof MusicStorage?.set === 'function') MusicStorage.set(nextMusic);
    if (typeof SoundStorage?.set === 'function') SoundStorage.set(nextSfx);
    if (typeof setAudioEnabled === 'function') setAudioEnabled(nextSfx);
    setSfxOverride(nextSfx);
    if (nextSfx) {
      playPrismSfx('click');
    }
  }, [audioState]);

  const handleToggleColorblind = useCallback(() => {
    const next = !colorblind;
    setColorblind(next);
    if (typeof ColorblindStorage?.set === 'function') ColorblindStorage.set(next);
    playPrismSfx('click');
  }, [colorblind]);

  const handleToggleBlueprint = useCallback(() => {
    setBlueprintAssist(prev => {
      const next = !prev;
      writeBlueprintAssist(next);
      return next;
    });
    playPrismSfx('click');
  }, []);

  const commitRun = useCallback(
    (next: PrismRun) => {
      setRun(next);
      let recordedErr: string | null = null;

      if (next.phase === 'victory' || next.phase === 'defeat') {
        const recordKey = `${next.runId}:${next.phase}:${next.isEndless ? 'endless' : 'main'}`;
        if (!recordedEndKeysRef.current.has(recordKey)) {
          recordedEndKeysRef.current.add(recordKey);
          const currentMeta = loadPrismMeta();
          const prevUnlocked = new Set(currentMeta.unlockedDecks);
          const updatedMeta = recordPrismRunEnd(
            next,
            next.phase === 'victory' ? true : undefined
          );
          recordedErr = getPrismStorageError();
          const freshUnlocks = updatedMeta.unlockedDecks.filter(id => !prevUnlocked.has(id));
          setMeta(updatedMeta);
          setNewlyUnlockedDecks(freshUnlocks);
          playPrismSfx(next.phase === 'victory' ? 'win' : 'lose');
        }
        if (next.phase === 'defeat') {
          writePrismRun(null);
        } else {
          writePrismRun(next);
        }
      } else {
        writePrismRun(next);
      }

      const finalErr = recordedErr ?? getPrismStorageError();
      if (finalErr) {
        setStorageWarning(finalErr);
      } else {
        syncStorageWarning();
      }
    },
    [syncStorageWarning]
  );

  const handleStartStandard = useCallback(
    ({ deckId, seed }: { deckId: StarterDeckId; seed: string }) => {
      const fresh = createRun({
        deckId,
        seed: seed || undefined,
      });
      setNewlyUnlockedDecks([]);
      setInSetup(false);
      setPauseOpen(false);
      commitRun(fresh);
    },
    [commitRun]
  );

  const handleStartDaily = useCallback(
    (dailyDate: string) => {
      const fresh = createRun({
        isDaily: true,
        dailyDate: dailyDate || getTodayDateString(),
        deckId: 'classic_prism',
      });
      setNewlyUnlockedDecks([]);
      setInSetup(false);
      setPauseOpen(false);
      commitRun(fresh);
    },
    [commitRun]
  );

  const handleResumeRun = useCallback(() => {
    if (run && run.phase !== 'victory' && run.phase !== 'defeat') {
      setInSetup(false);
    }
  }, [run]);

  const handleAbandonRun = useCallback(() => {
    writePrismRun(null);
    setRun(null);
    setNewlyUnlockedDecks([]);
    syncStorageWarning();
  }, [syncStorageWarning]);

  const handleReplaySameSeed = useCallback(() => {
    if (!run) return;
    const fresh = createRun(
      run.isDaily && run.dailyDate
        ? { isDaily: true, dailyDate: run.dailyDate, deckId: run.deckId }
        : { seed: run.seed, deckId: run.deckId }
    );
    setNewlyUnlockedDecks([]);
    setPauseOpen(false);
    setConfirmRestart(false);
    setInSetup(false);
    commitRun(fresh);
  }, [run, commitRun]);

  const handleContinueEndless = useCallback(() => {
    if (!run || run.phase !== 'victory') return;
    setNewlyUnlockedDecks([]);
    commitRun(continueEndless(run));
  }, [run, commitRun]);

  const handleExitToMenu = useCallback(() => {
    if (run && (run.phase === 'victory' || run.phase === 'defeat')) {
      writePrismRun(null);
    } else if (run) {
      writePrismRun(run);
    }
    setPauseOpen(false);
    music.stop();
    onExit();
  }, [run, onExit]);

  const handleSaveAndReturnToSetup = useCallback(() => {
    if (run && (run.phase === 'victory' || run.phase === 'defeat')) {
      writePrismRun(null);
      setRun(null);
    } else if (run) {
      writePrismRun(run);
    }
    setPauseOpen(false);
    setConfirmRestart(false);
    setInSetup(true);
    syncStorageWarning();
  }, [run, syncStorageWarning]);

  const handleCompleteTutorial = useCallback(() => {
    writeTutorialCompleted();
    setShowTutorial(false);
  }, []);

  const handleDismissWarning = useCallback(() => {
    clearPrismStorageError();
    setStorageWarning(null);
  }, []);

  const handleFirstRestartTap = () => {
    playPrismSfx('click');
    setConfirmRestart(true);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => setConfirmRestart(false), 4500);
  };

  // Shared link banner message for Setup
  const sharedBannerText =
    initialDaily || initialDailyDate
      ? `Opened Daily Challenge link${initialDailyDate ? ` (${initialDailyDate})` : ''} — ready to play!`
      : cleanInitialSeed
        ? `Loaded shared Seed "${cleanInitialSeed}" — pick a deck and hit Start Run!`
        : null;

  // ── 1. 45-Second Interactive Cold Open Tutorial ────────────────────────────
  if (showTutorial) {
    return <PrismTutorial onComplete={handleCompleteTutorial} />;
  }

  // ── 2. Setup / Daily Hub ───────────────────────────────────────────────────
  if (inSetup || !run) {
    return (
      <PrismSetup
        meta={meta}
        activeRun={run}
        initialTab={initialDaily || initialDailyDate ? 'daily' : 'standard'}
        initialSeed={cleanInitialSeed}
        initialDeckId={initialDeckId}
        initialDailyDate={initialDailyDate}
        sharedBannerText={sharedBannerText}
        storageWarning={storageWarning}
        onDismissStorageWarning={handleDismissWarning}
        onStartStandard={handleStartStandard}
        onStartDaily={handleStartDaily}
        onResumeRun={handleResumeRun}
        onAbandonRun={handleAbandonRun}
        onOpenTutorial={() => setShowTutorial(true)}
        onBackupRestored={(restoredMeta, restoredRun) => {
          setMeta(restoredMeta);
          setRun(restoredRun);
          syncStorageWarning();
        }}
        onExit={handleExitToMenu}
      />
    );
  }

  // ── 3. Victory / Defeat / Endless Summary ──────────────────────────────────
  if (run.phase === 'victory' || run.phase === 'defeat') {
    return (
      <PrismResults
        run={run}
        newlyUnlockedDecks={newlyUnlockedDecks}
        storageWarning={storageWarning}
        onDismissStorageWarning={handleDismissWarning}
        onContinueEndless={run.phase === 'victory' ? handleContinueEndless : undefined}
        onReplaySeed={handleReplaySameSeed}
        onNewRun={handleSaveAndReturnToSetup}
        onMainMenu={handleExitToMenu}
      />
    );
  }

  // ── 4. Active Run Phases (Blind Select / Playing / Shop) + Pause Modal ─────
  return (
    <View style={styles.root}>
      {storageWarning && (
        <View style={styles.floatingWarning}>
          <Icon name="lorc/laser-warning" size={16} color={PRISM_COLORS.gold} />
          <Text style={styles.floatingWarningText}>
            Storage unavailable ({storageWarning}). Progress may not persist on reload.
          </Text>
          <Pressable onPress={handleDismissWarning} style={styles.floatingWarningClose}>
            <Text style={styles.floatingWarningCloseText}>OK</Text>
          </Pressable>
        </View>
      )}

      {run.phase === 'blind_select' && (
        <PrismBlindSelect
          run={run}
          onPlayBlind={() => commitRun(selectBlind(run))}
          onSkipBlind={() => commitRun(skipBlind(run))}
          onReorderCharm={(from, to) => commitRun(reorderCharm(run, from, to))}
          onSellCharm={idx => commitRun(sellCharm(run, idx))}
          onOpenPause={() => setPauseOpen(true)}
        />
      )}

      {(run.phase === 'playing' || run.phase === 'cash_out') && (
        <PrismPlayScreen
          run={run}
          blueprintAssist={blueprintAssist}
          colorblind={colorblind}
          audioState={audioState}
          shortcutsDisabled={pauseOpen || run.phase === 'cash_out'}
          onToggleBlueprint={handleToggleBlueprint}
          onToggleColorblind={handleToggleColorblind}
          onCycleAudio={handleCycleAudio}
          onDispatch={commitRun}
          onOpenPauseMenu={() => setPauseOpen(true)}
          onClosePauseMenu={() => {
            setPauseOpen(false);
            setConfirmRestart(false);
          }}
        />
      )}

      {run.phase === 'cash_out' && (
        <PrismCashOutOverlay
          run={run}
          disabled={pauseOpen}
          onCashOut={() => commitRun(cashOutToShop(run))}
        />
      )}

      {run.phase === 'shop' && (
        <PrismShop
          run={run}
          onBuyCharm={idx => commitRun(buyShopCharm(run, idx))}
          onBuyStarChart={idx => commitRun(buyStarChart(run, idx))}
          onBuySpell={idx => commitRun(buySpell(run, idx))}
          onBuyVoucher={() => commitRun(buyVoucher(run))}
          onReroll={() => commitRun(rerollShop(run))}
          onReorderCharm={(from, to) => commitRun(reorderCharm(run, from, to))}
          onSellCharm={idx => commitRun(sellCharm(run, idx))}
          onLeaveShop={() => commitRun(leaveShop(run))}
          onOpenPause={() => setPauseOpen(true)}
        />
      )}

      {/* Safe Pause Modal (no accidental 1-tap forfeit) */}
      <Modal
        visible={pauseOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPauseOpen(false);
          setConfirmRestart(false);
        }}
      >
        <View style={styles.pauseBackdrop}>
          <View style={styles.pauseCard} testID="prism-pause-modal">
            <View style={styles.pauseHeader}>
              <View style={styles.pauseTitleRow}>
                <Icon name="lorc/crystal-shine" size={20} color={PRISM_COLORS.gold} />
                <Text style={styles.pauseTitle}>PAUSED</Text>
              </View>
              <Text style={styles.pauseMeta}>
                {run.isEndless ? `Endless Ante ${run.ante}` : `Ante ${run.ante}`} ·{' '}
                {STARTER_DECK_BY_ID[run.deckId]?.name ?? 'Prism'} · Seed {run.seed}
              </Text>
            </View>

            {/* Quick Preferences */}
            <View style={styles.togglesGrid}>
              <Pressable
                testID="prism-pause-music"
                onPress={handleToggleMusic}
                style={[styles.toggleRow, musicOn && styles.toggleRowOn]}
              >
                <Icon name="delapouite/harp" size={16} color={musicOn ? PRISM_COLORS.gold : PRISM_COLORS.textMuted} />
                <Text style={styles.toggleLabel}>Music</Text>
                <Text style={[styles.toggleState, musicOn && styles.toggleStateOn]}>
                  {musicOn ? 'ON' : 'OFF'}
                </Text>
              </Pressable>

              <Pressable
                testID="prism-pause-sfx"
                onPress={handleToggleSfx}
                style={[styles.toggleRow, sfxOn && styles.toggleRowOn]}
              >
                <Icon name="delapouite/sound-on" size={16} color={sfxOn ? PRISM_COLORS.gold : PRISM_COLORS.textMuted} />
                <Text style={styles.toggleLabel}>Sound FX</Text>
                <Text style={[styles.toggleState, sfxOn && styles.toggleStateOn]}>
                  {sfxOn ? 'ON' : 'OFF'}
                </Text>
              </Pressable>

              <Pressable
                testID="prism-pause-colorblind"
                onPress={handleToggleColorblind}
                style={[styles.toggleRow, colorblind && styles.toggleRowOn]}
              >
                <Icon name="lorc/third-eye" size={16} color={colorblind ? PRISM_COLORS.gold : PRISM_COLORS.textMuted} />
                <Text style={styles.toggleLabel}>Colorblind</Text>
                <Text style={[styles.toggleState, colorblind && styles.toggleStateOn]}>
                  {colorblind ? 'ON' : 'OFF'}
                </Text>
              </Pressable>

              <Pressable
                testID="prism-pause-blueprint"
                onPress={handleToggleBlueprint}
                style={[styles.toggleRow, blueprintAssist && styles.toggleRowOn]}
              >
                <Icon name="lorc/light-bulb" size={16} color={blueprintAssist ? PRISM_COLORS.gold : PRISM_COLORS.textMuted} />
                <Text style={styles.toggleLabel}>Blueprint Aid</Text>
                <Text style={[styles.toggleState, blueprintAssist && styles.toggleStateOn]}>
                  {blueprintAssist ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
            </View>

            {/* Safe Navigation Buttons */}
            <View style={styles.pauseBtnStack}>
              <Pressable
                testID="prism-pause-resume"
                onPress={() => {
                  playPrismSfx('click');
                  setPauseOpen(false);
                  setConfirmRestart(false);
                }}
                style={({ pressed }) => [
                  styles.pausePrimaryBtn,
                  pressed && styles.pressed,
                  Platform.OS === 'web' && { cursor: 'pointer' as never },
                ]}
              >
                <Text style={styles.pausePrimaryText}>Resume Run</Text>
              </Pressable>

              {!confirmRestart ? (
                <Pressable
                  testID="prism-pause-restart"
                  onPress={handleFirstRestartTap}
                  style={({ pressed }) => [
                    styles.pauseSecondaryBtn,
                    pressed && styles.pressed,
                    Platform.OS === 'web' && { cursor: 'pointer' as never },
                  ]}
                >
                  <Text style={styles.pauseSecondaryText}>Restart Same Seed</Text>
                </Pressable>
              ) : (
                <View style={styles.confirmRow}>
                  <Pressable
                    onPress={() => setConfirmRestart(false)}
                    style={styles.confirmCancelBtn}
                  >
                    <Text style={styles.pauseSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    testID="prism-pause-confirm-restart"
                    onPress={() => {
                      playPrismSfx('play');
                      handleReplaySameSeed();
                    }}
                    style={styles.confirmDangerBtn}
                  >
                    <Text style={styles.confirmDangerText}>Confirm Restart?</Text>
                  </Pressable>
                </View>
              )}

              <Pressable
                testID="prism-pause-setup"
                onPress={() => {
                  playPrismSfx('click');
                  handleSaveAndReturnToSetup();
                }}
                style={({ pressed }) => [
                  styles.pauseSecondaryBtn,
                  pressed && styles.pressed,
                  Platform.OS === 'web' && { cursor: 'pointer' as never },
                ]}
              >
                <Text style={styles.pauseSecondaryText}>Save &amp; Exit to Setup</Text>
              </Pressable>

              <Pressable
                testID="prism-pause-menu"
                onPress={() => {
                  playPrismSfx('click');
                  handleExitToMenu();
                }}
                style={({ pressed }) => [
                  styles.pauseSubtleBtn,
                  pressed && styles.pressed,
                  Platform.OS === 'web' && { cursor: 'pointer' as never },
                ]}
              >
                <Text style={styles.pauseSubtleText}>Save &amp; Main Menu</Text>
              </Pressable>
            </View>
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
  floatingWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(242, 201, 76, 0.16)',
    borderBottomWidth: 1,
    borderBottomColor: PRISM_COLORS.gold,
  },
  floatingWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  floatingWarningClose: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  floatingWarningCloseText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  pauseBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 12, 10, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  pauseCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: PRISM_COLORS.goldDark,
    padding: 18,
    gap: 14,
  },
  pauseHeader: {
    gap: 4,
    alignItems: 'center',
  },
  pauseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pauseTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: PRISM_COLORS.gold,
  },
  pauseMeta: {
    fontSize: 12,
    color: PRISM_COLORS.textMuted,
    textAlign: 'center',
  },
  togglesGrid: {
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltBg,
  },
  toggleRowOn: {
    borderColor: PRISM_COLORS.goldDark,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  toggleState: {
    fontSize: 12,
    fontWeight: '900',
    color: PRISM_COLORS.textMuted,
  },
  toggleStateOn: {
    color: PRISM_COLORS.gold,
  },
  pauseBtnStack: {
    gap: 8,
  },
  pausePrimaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.gold,
    borderWidth: 2,
    borderColor: '#FFF3C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausePrimaryText: {
    fontSize: 15,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
  },
  pauseSecondaryBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseSecondaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  pauseSubtleBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseSubtleText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDangerBtn: {
    flex: 1.5,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDangerText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});

export default PrismMode;
