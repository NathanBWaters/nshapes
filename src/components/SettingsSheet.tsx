/**
 * [UI-21] Unified Global Settings Sheet & 1-Tap `<PauseAudioPills>`.
 *
 * Consolidates every player preference into one truthful, accessible sheet:
 * - Audio & Haptics: independent Music (`MusicStorage`), Sound Effects (`SoundStorage`),
 *   and Haptics (`HapticsStorage`)
 * - Visual Comfort: Fight Effects (synced cleanly with `save.effectsOn` & global MMKV),
 *   Screen Shake (`ScreenShakeStorage`), Screen Flash (`ScreenFlashStorage`) — always visible
 *   even when OS Reduced Motion is enabled
 * - Colorblind Mode (`ColorblindStorage`) with a LIVE 3-card preview across White,
 *   Blueprint Mist (`#E2ECF7`), and Charcoal (`#383838`) using real `<Card>` components
 * - Text Size (`Normal` / `Large`, persisted in MMKV with live sample preview)
 * - Controls & Guides: Keyboard Controls launcher (`KeybindingSheet`), Replay 1-1 Walkthrough
 * - Save Backup Code export & checksummed restore (`src/adventure/saveShare.ts` [TP-18])
 * - Data & Store Compliance: Gameplay Analytics opt-out, Player ID copy, Privacy Policy,
 *   Support & FAQ, guarded Reset Game, and version caption
 *
 * Also exports `<PauseAudioPills>` (`pause-toggle-music`, `pause-toggle-sfx`,
 * `pause-toggle-haptics`, `"All Settings"`) for 1-line drop-in inside AdventureRun Pause & Camp.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Card as CardType } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { PRIVACY_POLICY_URL, STORE_VERSION, SUPPORT_URL } from '@/utils/storeUrls';
import { useSoundSetting } from '@/hooks/useSoundSetting';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { KEY_PRIORITY, useKeyboardNav } from '@/hooks/useKeyboardNav';
import { setMusicEnabled, setSfxOverride } from '@/audio';
import { setAudioEnabled } from '@/utils/sounds';
import { triggerHaptic } from '@/utils/haptics';
import { HapticsStorage } from '@/utils/hapticsStorage';
import { ScreenFlashStorage, ScreenShakeStorage } from '@/utils/fxSettingsStorage';
import {
  TEXT_SIZE_SCALES,
  TextSizeStorage,
  useTextSize,
  type TextSizeMode,
} from '@/utils/textSizeStorage';
import {
  ColorblindStorage,
  MusicStorage,
  resetAllClassicStorage,
  SoundStorage,
  storage,
} from '@/utils/storage';
import { analyticsOptedOut, playerCode, setAnalyticsEnabled } from '@/analytics/posthog';
import { loadAdventureSave, resetAdventureSave, writeAdventureSave } from '@/adventure/save';
import { exportFullSaveBackup, importFullSaveBackup } from '@/adventure/saveShare';
import { resetSpireStorage } from '@/spire/save';
import { resetPrismStorage } from '@/prism/save';
import SvgDefault from 'react-native-svg';
import { version as BUILD_VERSION } from '../../package.json';
import { cardBgPatternMeta, cardColorCode, cardColorHex } from '@/utils/cardColors';
import { getCardStockBackground } from '@/utils/cardVisuals';
import Animated from 'react-native-reanimated';
import Card, { CardBoardProvider } from './Card';
import Icon from './Icon';
import KeybindingSheet from './KeybindingSheet';
import { MotionModal, useModalMotion } from './ScreenTransition';

/** True whenever `react-native-svg` default export is a valid React element type (always true at runtime; guards legacy Jest mocks). */
const CAN_RENDER_LIVE_SVG_CARD =
  typeof SvgDefault === 'function' || typeof SvgDefault === 'string';

// ─── Global Fight Effects MMKV Store (zero storage.ts edits) ────────────────
// Text Size lives in ONE place: `src/utils/textSizeStorage.ts` ([UI-16]).

export const FIGHT_EFFECTS_STORAGE_KEY = 'fight_effects_enabled';
export { TEXT_SIZE_STORAGE_KEY } from '@/utils/textSizeStorage';

export type TextSizeSetting = TextSizeMode;

type BoolListener = (v: boolean) => void;

const fightEffectsListeners = new Set<BoolListener>();

let fightEffectsFallback = true;

const hasMmkv = (): boolean =>
  Boolean(
    storage &&
      typeof storage.getBoolean === 'function' &&
      typeof storage.getString === 'function' &&
      typeof storage.set === 'function'
  );

/** Reactive MMKV store for Fight Effects synced cleanly with Adventure `save.effectsOn`. */
export const FightEffectsStorage = {
  get: (): boolean => {
    if (hasMmkv()) {
      const stored = storage.getBoolean(FIGHT_EFFECTS_STORAGE_KEY);
      if (stored !== undefined) return stored;
    }
    try {
      return loadAdventureSave().effectsOn;
    } catch {
      return fightEffectsFallback;
    }
  },

  set: (enabled: boolean): void => {
    fightEffectsFallback = enabled;
    if (hasMmkv()) {
      storage.set(FIGHT_EFFECTS_STORAGE_KEY, enabled);
    }
    try {
      const current = loadAdventureSave();
      if (current.effectsOn !== enabled) {
        writeAdventureSave({ ...current, effectsOn: enabled });
      }
    } catch {
      // ignore save errors in isolated tests
    }
    fightEffectsListeners.forEach(fn => {
      try {
        fn(enabled);
      } catch {
        // ignore subscriber errors
      }
    });
  },

  subscribe: (listener: BoolListener): (() => void) => {
    fightEffectsListeners.add(listener);
    return () => {
      fightEffectsListeners.delete(listener);
    };
  },
};

/**
 * Backward-compatible alias of the single reactive `TextSizeStorage` ([UI-16] + [UI-21]).
 * Not a second store: every read/write/subscription goes through `src/utils/textSizeStorage.ts`,
 * so `useTextScale()` consumers (AdventureRun, GearBelt, HudInspector, LevelPreview,
 * WeaponExplainer) re-render the instant Text Size changes here.
 */
export const SettingsTextSizeStorage = {
  get: (): TextSizeSetting => TextSizeStorage.get(),
  set: (size: TextSizeSetting): void => TextSizeStorage.set(size),
  scaleOf: (size: TextSizeSetting): number => TEXT_SIZE_SCALES[size],
  subscribe: (listener: (size: TextSizeSetting) => void): (() => void) =>
    TextSizeStorage.subscribe(listener),
};

// ─── Live 3-Card Preview Fixtures (White / Blueprint Mist / Charcoal) ───────

const PREVIEW_CARDS: readonly {
  id: string;
  card: CardType;
  stockLabel: string;
  colorLabel: string;
  cbTag: string;
}[] = [
  {
    id: 'white',
    card: {
      id: 'settings-preview-white',
      shape: 'oval',
      color: 'red',
      number: 1,
      shading: 'solid',
      background: 'white',
      selected: false,
    },
    stockLabel: 'White',
    colorLabel: 'Orange',
    cbTag: 'W · O',
  },
  {
    id: 'mist',
    card: {
      id: 'settings-preview-mist',
      shape: 'diamond',
      color: 'green',
      number: 2,
      shading: 'striped',
      background: 'beige',
      selected: false,
    },
    stockLabel: 'Mist',
    colorLabel: 'Blue',
    cbTag: 'M · B',
  },
  {
    id: 'charcoal',
    card: {
      id: 'settings-preview-charcoal',
      shape: 'squiggle',
      color: 'purple',
      number: 3,
      shading: 'open',
      background: 'charcoal',
      selected: false,
    },
    stockLabel: 'Charcoal',
    colorLabel: 'Pink',
    cbTag: 'D · P',
  },
] as const;

const PREVIEW_BOARD_OVERLAY = { backgroundAttributeActive: true } as const;
const NOOP = () => {};

async function copyTextToClipboard(text: string): Promise<boolean> {
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
    // clipboard may be blocked in unsecure context
  }
  return false;
}

// ─── Shared SettingsSheet Component ─────────────────────────────────────────

export interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after Reset Game clears all saved progress. */
  onResetGame?: () => void;
  /** Optional controlled Fight Effects state (e.g. AdventureMode `save.effectsOn`). */
  effectsOn?: boolean;
  /** Optional controlled Fight Effects toggle handler (e.g. AdventureMode). */
  onToggleEffects?: () => void;
  /** Optional Music change callback (e.g. mirroring into Adventure `save.musicOn`). */
  onMusicChange?: (enabled: boolean) => void;
  /** Optional callback to launch the 1-1 walkthrough directly from Settings. */
  onReplayWalkthrough?: () => void;
  /** Optional callback after a Save Backup Code is successfully restored. */
  onSaveRestored?: () => void;
  /** Hide the destructive Reset Game section when opened mid-battle (default true). */
  showReset?: boolean;
}

const readMusicPref = (): boolean =>
  typeof MusicStorage?.get === 'function' ? MusicStorage.get() : true;
const readSoundPref = (): boolean =>
  typeof SoundStorage?.get === 'function' ? SoundStorage.get() : true;
const readColorblindPref = (): boolean =>
  typeof ColorblindStorage?.get === 'function' ? ColorblindStorage.get() : false;

export const SettingsSheet: React.FC<SettingsSheetProps> = (props) => {
  const [mounted, setMounted] = useState(props.visible);
  useEffect(() => {
    if (props.visible && !mounted) setMounted(true);
  }, [props.visible, mounted]);
  if (!mounted && !props.visible) return null;
  return <SettingsSheetBody {...props} />;
};

const SettingsSheetBody: React.FC<SettingsSheetProps> = ({
  visible,
  onClose,
  onResetGame,
  effectsOn: controlledEffectsOn,
  onToggleEffects: controlledOnToggleEffects,
  onMusicChange,
  onReplayWalkthrough,
  onSaveRestored,
  showReset = true,
}) => {
  const osReducedMotion = useReducedMotion();

  // Audio & Haptics
  const [soundEnabled, toggleSoundSetting] = useSoundSetting(visible);
  const [musicEnabled, setMusicEnabledState] = useState(readMusicPref);
  const [hapticsEnabled, setHapticsEnabledState] = useState(() => HapticsStorage.get());

  // Visual Comfort
  const [localEffectsOn, setLocalEffectsOn] = useState(() => FightEffectsStorage.get());
  const [shakeEnabled, setShakeEnabledState] = useState(() => ScreenShakeStorage.get());
  const [flashEnabled, setFlashEnabledState] = useState(() => ScreenFlashStorage.get());

  // Readability & Accessibility
  const [colorblindOn, setColorblindOn] = useState(readColorblindPref);
  // Reactive read of the single global TextSizeStorage (no local copy to drift out of sync)
  const textSize = useTextSize();

  // Sub-sheets & Data Controls
  const [showKeybindings, setShowKeybindings] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(() => !analyticsOptedOut());
  const [copiedCode, setCopiedCode] = useState(false);
  const [backupCode, setBackupCode] = useState<string | null>(null);
  const [backupCopied, setBackupCopied] = useState(false);
  const [showRestoreBox, setShowRestoreBox] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  // Reset confirmation
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const effectiveEffectsOn =
    controlledEffectsOn !== undefined ? controlledEffectsOn : localEffectsOn;

  useEffect(() => {
    if (!visible) {
      setShowKeybindings(false);
      return;
    }
    setMusicEnabledState(readMusicPref());
    setHapticsEnabledState(HapticsStorage.get());
    setLocalEffectsOn(FightEffectsStorage.get());
    setShakeEnabledState(ScreenShakeStorage.get());
    setFlashEnabledState(ScreenFlashStorage.get());
    setColorblindOn(readColorblindPref());
    setAnalyticsOn(!analyticsOptedOut());
    setCopiedCode(false);
    setBackupCode(null);
    setBackupCopied(false);
    setShowRestoreBox(false);
    setRestoreInput('');
    setRestoreError(null);
    setRestoreSuccess(false);
    setConfirmingReset(false);
    setResetDone(false);
  }, [visible]);

  // Keep synced with external mutations (e.g. PauseAudioPills or other screens)
  useEffect(() => {
    if (!visible) return;
    const unsubs = [
      typeof MusicStorage?.subscribe === 'function' ? MusicStorage.subscribe(setMusicEnabledState) : undefined,
      HapticsStorage.subscribe(setHapticsEnabledState),
      FightEffectsStorage.subscribe(setLocalEffectsOn),
      ScreenShakeStorage.subscribe(setShakeEnabledState),
      ScreenFlashStorage.subscribe(setFlashEnabledState),
      typeof ColorblindStorage?.subscribe === 'function' ? ColorblindStorage.subscribe(setColorblindOn) : undefined,
    ];
    return () => {
      unsubs.forEach(u => u?.());
    };
  }, [visible]);

  // Escape closes SettingsSheet (paused while KeybindingSheet is stacked on top)
  useKeyboardNav({
    enabled: visible && !showKeybindings,
    priority: KEY_PRIORITY.MODAL,
    onCancel: onClose,
  });

  const handleToggleMusic = () => {
    const next = !musicEnabled;
    setMusicEnabledState(next);
    MusicStorage.set(next);
    if (typeof setMusicEnabled === 'function') {
      setMusicEnabled(next);
    }
    onMusicChange?.(next);
  };

  const handleToggleSfx = () => {
    if (!MusicStorage.hasValue()) {
      MusicStorage.set(musicEnabled);
    }
    const next = !soundEnabled;
    toggleSoundSetting();
    if (typeof setSfxOverride === 'function') {
      setSfxOverride(next);
    }
  };

  const handleToggleHaptics = () => {
    const next = !hapticsEnabled;
    setHapticsEnabledState(next);
    HapticsStorage.set(next);
    if (next) {
      void triggerHaptic('light');
    }
  };

  const handleToggleEffects = () => {
    const next = !effectiveEffectsOn;
    setLocalEffectsOn(next);
    FightEffectsStorage.set(next);
    controlledOnToggleEffects?.();
  };

  const handleToggleShake = () => {
    const next = !shakeEnabled;
    setShakeEnabledState(next);
    ScreenShakeStorage.set(next);
  };

  const handleToggleFlash = () => {
    const next = !flashEnabled;
    setFlashEnabledState(next);
    ScreenFlashStorage.set(next);
  };

  const handleToggleColorblind = () => {
    const next = !colorblindOn;
    setColorblindOn(next);
    ColorblindStorage.set(next);
  };

  const handleSelectTextSize = (size: TextSizeSetting) => {
    TextSizeStorage.set(size);
  };

  const handleToggleAnalytics = () => {
    const next = !analyticsOn;
    setAnalyticsEnabled(next);
    setAnalyticsOn(next);
  };

  const handleExportBackup = async () => {
    const exported = exportFullSaveBackup();
    setBackupCode(exported);
    setRestoreError(null);
    setRestoreSuccess(false);
    const copied = await copyTextToClipboard(exported);
    setBackupCopied(copied);
  };

  const handleImportBackup = () => {
    setRestoreError(null);
    setRestoreSuccess(false);
    const res = importFullSaveBackup(restoreInput);
    if (!res.ok) {
      setRestoreError(res.error);
      return;
    }
    setRestoreSuccess(true);
    setRestoreInput('');
    setShowRestoreBox(false);
    onSaveRestored?.();
  };

  const handleConfirmReset = () => {
    resetAdventureSave();
    resetSpireStorage();
    resetPrismStorage();
    resetAllClassicStorage();
    try {
      const tutorialMod = require('@/context/TutorialContext') as {
        resetTutorialStorage?: () => Promise<void>;
      };
      if (typeof tutorialMod?.resetTutorialStorage === 'function') {
        void tutorialMod.resetTutorialStorage();
      }
    } catch {
      // AsyncStorage may be unavailable in isolated native-less unit test environments
    }
    setConfirmingReset(false);
    setResetDone(true);
    onResetGame?.();
  };

  const openExternalUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {
      /* ignore if browser handler unavailable */
    });
  };

  const code = playerCode();

  const handleCopyCode = async () => {
    const copied = await copyTextToClipboard(code);
    if (copied) setCopiedCode(true);
  };

  const textScale = TEXT_SIZE_SCALES[textSize];
  const { rendered, closing, backdropStyle, panelStyle, contentStyle } = useModalMotion(visible, {
    travelY: 32,
    sheet: true,
  });

  if (!rendered && !showKeybindings) return null;

  return (
    <>
      <MotionModal
        visible={rendered}
        interactive={!closing}
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.overlay} testID="settings-sheet" pointerEvents={closing ? 'none' : 'auto'}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlayBackdrop, backdropStyle]} />
          <Animated.View style={[styles.container, panelStyle]}>
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Icon name="lorc/gear-hammer" size={20} color={COLORS.canvasWhite} noShadow />
                <Text style={styles.headerText}>SETTINGS</Text>
              </View>
              <TouchableOpacity
                testID="options-close"
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close Settings"
                style={styles.closeButton}
              >
                <Icon name="lorc/cross-mark" size={16} color={COLORS.canvasWhite} noShadow />
              </TouchableOpacity>
            </View>

            <Animated.View style={[{ flexShrink: 1 }, contentStyle]}>
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.content}
              bounces={false}
            >
              {/* ─── Audio & Touch ─── */}
              <Text style={styles.groupHeading}>AUDIO &amp; TOUCH</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Icon name="delapouite/harp" size={20} color={COLORS.slateCharcoal} noShadow />
                  <Text style={styles.settingText}>Music</Text>
                </View>
                <TouchableOpacity
                  testID="options-music-toggle"
                  accessibilityRole="button"
                  accessibilityState={{ checked: musicEnabled }}
                  style={[
                    styles.toggleButton,
                    musicEnabled ? styles.toggleButtonOn : styles.toggleButtonOff,
                  ]}
                  onPress={handleToggleMusic}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      musicEnabled ? styles.toggleTextOn : styles.toggleTextOff,
                    ]}
                  >
                    {musicEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Icon name="delapouite/sound-on" size={20} color={COLORS.slateCharcoal} noShadow />
                  <Text style={styles.settingText}>Sound Effects</Text>
                </View>
                <TouchableOpacity
                  testID="options-sfx-toggle"
                  accessibilityRole="button"
                  accessibilityState={{ checked: soundEnabled }}
                  style={[
                    styles.toggleButton,
                    soundEnabled ? styles.toggleButtonOn : styles.toggleButtonOff,
                  ]}
                  onPress={handleToggleSfx}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      soundEnabled ? styles.toggleTextOn : styles.toggleTextOff,
                    ]}
                  >
                    {soundEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Icon name="lorc/echo-ripples" size={20} color={COLORS.slateCharcoal} noShadow />
                  <View style={styles.labelCol}>
                    <Text style={styles.settingText}>Haptics</Text>
                    <Text style={styles.settingSubtext}>Impact vibration on supported devices</Text>
                  </View>
                </View>
                <TouchableOpacity
                  testID="options-haptics-toggle"
                  accessibilityRole="button"
                  accessibilityState={{ checked: hapticsEnabled }}
                  style={[
                    styles.toggleButton,
                    hapticsEnabled ? styles.toggleButtonOn : styles.toggleButtonOff,
                  ]}
                  onPress={handleToggleHaptics}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      hapticsEnabled ? styles.toggleTextOn : styles.toggleTextOff,
                    ]}
                  >
                    {hapticsEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ─── Visual Comfort & Motion ─── */}
              <Text style={styles.groupHeading}>VISUAL COMFORT</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Icon name="delapouite/sparkles" size={20} color={COLORS.slateCharcoal} noShadow />
                  <View style={styles.labelCol}>
                    <Text style={styles.settingText}>Fight Effects</Text>
                    <Text style={styles.settingSubtext}>
                      {osReducedMotion
                        ? 'OS Reduced Motion detected — calm visuals stay active'
                        : 'Combat bursts, card throws & animated flourishes'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  testID="options-effects-toggle"
                  accessibilityRole="button"
                  accessibilityState={{ checked: effectiveEffectsOn }}
                  style={[
                    styles.toggleButton,
                    effectiveEffectsOn ? styles.toggleButtonOn : styles.toggleButtonOff,
                  ]}
                  onPress={handleToggleEffects}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      effectiveEffectsOn ? styles.toggleTextOn : styles.toggleTextOff,
                    ]}
                  >
                    {effectiveEffectsOn ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Icon name="lorc/big-wave" size={20} color={COLORS.slateCharcoal} noShadow />
                  <View style={styles.labelCol}>
                    <Text style={styles.settingText}>Screen Shake</Text>
                    <Text style={styles.settingSubtext}>Camera punch on big hits &amp; parries</Text>
                  </View>
                </View>
                <TouchableOpacity
                  testID="options-shake-toggle"
                  accessibilityRole="button"
                  accessibilityState={{ checked: shakeEnabled }}
                  style={[
                    styles.toggleButton,
                    shakeEnabled ? styles.toggleButtonOn : styles.toggleButtonOff,
                  ]}
                  onPress={handleToggleShake}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      shakeEnabled ? styles.toggleTextOn : styles.toggleTextOff,
                    ]}
                  >
                    {shakeEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Icon name="lorc/sun" size={20} color={COLORS.slateCharcoal} noShadow />
                  <View style={styles.labelCol}>
                    <Text style={styles.settingText}>Screen Flash</Text>
                    <Text style={styles.settingSubtext}>Brief impact &amp; evolution edge flashes</Text>
                  </View>
                </View>
                <TouchableOpacity
                  testID="options-flash-toggle"
                  accessibilityRole="button"
                  accessibilityState={{ checked: flashEnabled }}
                  style={[
                    styles.toggleButton,
                    flashEnabled ? styles.toggleButtonOn : styles.toggleButtonOff,
                  ]}
                  onPress={handleToggleFlash}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      flashEnabled ? styles.toggleTextOn : styles.toggleTextOff,
                    ]}
                  >
                    {flashEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ─── Readability & Colorblind Live Preview ─── */}
              <Text style={styles.groupHeading}>READABILITY &amp; ACCESSIBILITY</Text>

              <View style={styles.colorblindBlock}>
                <View style={styles.settingRowNoBorder}>
                  <View style={styles.settingLabel}>
                    <Icon name="lorc/spectacles" size={20} color={COLORS.slateCharcoal} noShadow />
                    <View style={styles.labelCol}>
                      <Text style={styles.settingText}>Colorblind Mode</Text>
                      <Text style={styles.settingSubtext}>
                        High-visibility O/B/P &amp; W/M/D card badges
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    testID="options-colorblind-toggle"
                    accessibilityRole="button"
                    accessibilityState={{ checked: colorblindOn }}
                    style={[
                      styles.toggleButton,
                      colorblindOn ? styles.toggleButtonOn : styles.toggleButtonOff,
                    ]}
                    onPress={handleToggleColorblind}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        colorblindOn ? styles.toggleTextOn : styles.toggleTextOff,
                      ]}
                    >
                      {colorblindOn ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.previewStrip} testID="settings-colorblind-preview">
                  <CardBoardProvider overlay={PREVIEW_BOARD_OVERLAY} clockMs={null}>
                    <View style={styles.previewCardsRow}>
                      {PREVIEW_CARDS.map(item => {
                        const shapeHex = cardColorHex(item.card.color, item.card.background, colorblindOn);
                        const bgHex = getCardStockBackground(item.card.background);
                        const bgMeta = cardBgPatternMeta(item.card.background, colorblindOn);
                        const cbCode = cardColorCode(item.card.color, colorblindOn);
                        return (
                          <View key={item.id} style={styles.previewCardCol}>
                            <View style={styles.previewCardFrame} pointerEvents="none">
                              {CAN_RENDER_LIVE_SVG_CARD ? (
                                <Card card={item.card} onClick={NOOP} disabled />
                              ) : (
                                <View
                                  style={[
                                    styles.previewFallbackCard,
                                    { backgroundColor: bgHex },
                                  ]}
                                >
                                  {colorblindOn && (
                                    <View style={styles.previewFallbackBadgeRow}>
                                      <Text style={[styles.previewFallbackBadge, { color: shapeHex }]}>
                                        {cbCode}
                                      </Text>
                                      <Text style={[styles.previewFallbackBadge, { color: bgMeta.badgeText }]}>
                                        {bgMeta.code}
                                      </Text>
                                    </View>
                                  )}
                                  <View style={[styles.previewFallbackDot, { backgroundColor: shapeHex }]} />
                                </View>
                              )}
                            </View>
                            <Text style={styles.previewCaption}>
                              {colorblindOn
                                ? item.cbTag
                                : `${item.stockLabel} · ${item.colorLabel}`}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </CardBoardProvider>
                </View>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Icon name="lorc/open-book" size={20} color={COLORS.slateCharcoal} noShadow />
                  <View style={styles.labelCol}>
                    <Text style={styles.settingText}>Text Size</Text>
                    <Text
                      testID="options-text-size-sample"
                      style={[styles.settingSubtext, { fontSize: Math.round(11 * textScale) }]}
                    >
                      Sample: Match 3 cards to fire your loadout!
                    </Text>
                  </View>
                </View>
                <View style={styles.segmentedGroup}>
                  <TouchableOpacity
                    testID="options-text-size-normal"
                    accessibilityRole="button"
                    accessibilityState={{ selected: textSize === 'normal' }}
                    onPress={() => handleSelectTextSize('normal')}
                    style={[
                      styles.segmentBtn,
                      textSize === 'normal' ? styles.segmentBtnOn : styles.segmentBtnOff,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        textSize === 'normal' ? styles.toggleTextOn : styles.toggleTextOff,
                      ]}
                    >
                      Normal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="options-text-size-large"
                    accessibilityRole="button"
                    accessibilityState={{ selected: textSize === 'large' }}
                    onPress={() => handleSelectTextSize('large')}
                    style={[
                      styles.segmentBtn,
                      textSize === 'large' ? styles.segmentBtnOn : styles.segmentBtnOff,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        textSize === 'large' ? styles.toggleTextOn : styles.toggleTextOff,
                      ]}
                    >
                      Large
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ─── Controls & Walkthrough ─── */}
              <Text style={styles.groupHeading}>CONTROLS &amp; GUIDE</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Icon name="lorc/gear-hammer" size={20} color={COLORS.slateCharcoal} noShadow />
                  <View style={styles.labelCol}>
                    <Text style={styles.settingText}>Keyboard Controls</Text>
                    <Text style={styles.settingSubtext}>Customize board hotkeys &amp; swap Confirm/Back</Text>
                  </View>
                </View>
                <TouchableOpacity
                  testID="options-keyboard-controls"
                  accessibilityRole="button"
                  style={[styles.toggleButton, styles.actionOutlineButton]}
                  onPress={() => setShowKeybindings(true)}
                >
                  <Text style={styles.actionOutlineText}>KEYS</Text>
                </TouchableOpacity>
              </View>

              {onReplayWalkthrough && (
                <View style={styles.settingRow}>
                  <View style={styles.settingLabel}>
                    <Icon name="lorc/return-arrow" size={20} color={COLORS.slateCharcoal} noShadow />
                    <View style={styles.labelCol}>
                      <Text style={styles.settingText}>Replay 1-1 Walkthrough</Text>
                      <Text style={styles.settingSubtext}>Practice the opening guided level again</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    testID="options-replay-walkthrough"
                    accessibilityRole="button"
                    style={[styles.toggleButton, styles.actionOutlineButton]}
                    onPress={() => {
                      onClose();
                      onReplayWalkthrough();
                    }}
                  >
                    <Text style={styles.actionOutlineText}>PLAY</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ─── Save Backup Code ([TP-18]) ─── */}
              <Text style={styles.groupHeading}>SAVE BACKUP CODE</Text>

              <View style={styles.backupBox} testID="settings-save-backup">
                <View style={styles.backupHeader}>
                  <Icon name="lorc/scroll-unfurled" size={20} color={COLORS.slateCharcoal} noShadow />
                  <View style={styles.labelCol}>
                    <Text style={styles.settingText}>Export or Restore Save</Text>
                    <Text style={styles.settingSubtext}>
                      Transfer Adventure &amp; Starfall Summit progress between browsers or devices
                    </Text>
                  </View>
                </View>

                <View style={styles.backupButtonsRow}>
                  <TouchableOpacity
                    testID="options-backup-export"
                    accessibilityRole="button"
                    style={[styles.backupBtn, styles.toggleButtonOn]}
                    onPress={handleExportBackup}
                  >
                    <Text style={[styles.toggleButtonText, styles.toggleTextOn]}>
                      {backupCopied ? 'COPIED CODE' : 'EXPORT CODE'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="options-backup-restore-toggle"
                    accessibilityRole="button"
                    style={[styles.backupBtn, styles.actionOutlineButton]}
                    onPress={() => {
                      setShowRestoreBox(v => !v);
                      setRestoreError(null);
                      setRestoreSuccess(false);
                    }}
                  >
                    <Text style={styles.actionOutlineText}>
                      {showRestoreBox ? 'HIDE RESTORE' : 'RESTORE CODE'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {backupCode && (
                  <View style={styles.backupCodeDisplay}>
                    <Text
                      testID="options-backup-code"
                      selectable
                      numberOfLines={3}
                      style={styles.backupCodeText}
                    >
                      {backupCode}
                    </Text>
                  </View>
                )}

                {showRestoreBox && (
                  <View style={styles.restorePanel}>
                    <TextInput
                      testID="options-backup-input"
                      value={restoreInput}
                      onChangeText={setRestoreInput}
                      placeholder="Paste NSHAPES1:... code here"
                      placeholderTextColor="#6B655D"
                      autoCapitalize="none"
                      autoCorrect={false}
                      multiline
                      style={styles.restoreInput}
                    />
                    <TouchableOpacity
                      testID="options-backup-import"
                      accessibilityRole="button"
                      style={[styles.backupBtn, styles.toggleButtonOn]}
                      onPress={handleImportBackup}
                    >
                      <Text style={[styles.toggleButtonText, styles.toggleTextOn]}>
                        APPLY BACKUP
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {restoreError && (
                  <Text testID="options-backup-error" style={styles.backupErrorText}>
                    {restoreError}
                  </Text>
                )}
                {restoreSuccess && (
                  <Text testID="options-backup-success" style={styles.backupSuccessText}>
                    Save restored cleanly! Previous save was backed up first.
                  </Text>
                )}
              </View>

              {/* ─── Privacy, Player ID & Reset ─── */}
              <Text style={styles.groupHeading}>DATA &amp; SUPPORT</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Icon name="delapouite/chart" size={20} color={COLORS.slateCharcoal} noShadow />
                  <Text style={styles.settingText}>Gameplay Analytics</Text>
                </View>
                <TouchableOpacity
                  testID="options-analytics-toggle"
                  accessibilityRole="button"
                  accessibilityState={{ checked: analyticsOn }}
                  style={[
                    styles.toggleButton,
                    analyticsOn ? styles.toggleButtonOn : styles.toggleButtonOff,
                  ]}
                  onPress={handleToggleAnalytics}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      analyticsOn ? styles.toggleTextOn : styles.toggleTextOff,
                    ]}
                  >
                    {analyticsOn ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.labelCol}>
                  <Text style={styles.settingText}>Player ID</Text>
                  <Text style={styles.playerCodeText} testID="options-player-code">
                    {code}
                  </Text>
                </View>
                <TouchableOpacity
                  testID="options-copy-player-code"
                  accessibilityRole="button"
                  style={[styles.toggleButton, styles.toggleButtonOff]}
                  onPress={handleCopyCode}
                >
                  <Text style={[styles.toggleButtonText, styles.toggleTextOff]}>
                    {copiedCode ? 'COPIED' : 'COPY'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.legalLinksRow}>
                <TouchableOpacity
                  testID="options-privacy-link"
                  accessibilityRole="link"
                  style={styles.legalLinkButton}
                  onPress={() => openExternalUrl(PRIVACY_POLICY_URL)}
                >
                  <Text style={styles.legalLinkText}>Privacy Policy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="options-support-link"
                  accessibilityRole="link"
                  style={styles.legalLinkButton}
                  onPress={() => openExternalUrl(SUPPORT_URL)}
                >
                  <Text style={styles.legalLinkText}>Support &amp; FAQ</Text>
                </TouchableOpacity>
              </View>

              {showReset && (
                <View style={styles.resetBlock}>
                  <View style={styles.resetHeaderRow}>
                    <View style={[styles.settingLabel, { flex: 1 }]}>
                      <Icon name="lorc/recycle" size={20} color={COLORS.redSurface} noShadow />
                      <View style={styles.labelCol}>
                        <Text style={styles.settingText}>Reset Game</Text>
                        <Text style={styles.resetSubtext}>
                          Erase all stars, unlocks &amp; saved progress
                        </Text>
                      </View>
                    </View>
                    {!confirmingReset && (
                      <TouchableOpacity
                        testID="options-reset-game"
                        accessibilityRole="button"
                        accessibilityLabel="Reset Game"
                        style={[
                          styles.toggleButton,
                          resetDone ? styles.resetDoneBadge : styles.resetOutlineButton,
                        ]}
                        onPress={() => {
                          setResetDone(false);
                          setConfirmingReset(true);
                        }}
                      >
                        {resetDone ? (
                          <View style={styles.resetDoneInline}>
                            <Icon name="lorc/checked-shield" size={14} color={COLORS.canvasWhite} noShadow />
                            <Text style={[styles.toggleButtonText, styles.toggleTextOn]}>DONE</Text>
                          </View>
                        ) : (
                          <Text style={[styles.toggleButtonText, styles.resetOutlineText]}>RESET</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {confirmingReset && (
                    <View style={styles.confirmBox} testID="options-reset-confirm-box">
                      <Text style={styles.confirmWarningText}>
                        Start over from scratch? This permanently erases all Adventure stars, coins,
                        weapons, fighters, battle history, and saved runs.
                      </Text>
                      <View style={styles.confirmButtonsRow}>
                        <TouchableOpacity
                          testID="options-reset-cancel"
                          accessibilityRole="button"
                          style={[styles.confirmActionBtn, styles.toggleButtonOff]}
                          onPress={() => setConfirmingReset(false)}
                        >
                          <Text style={[styles.toggleButtonText, styles.toggleTextOff]}>CANCEL</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          testID="options-reset-confirm"
                          accessibilityRole="button"
                          style={[styles.confirmActionBtn, styles.dangerSolidButton]}
                          onPress={handleConfirmReset}
                        >
                          <Text style={[styles.toggleButtonText, styles.toggleTextOn]}>
                            START OVER
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {resetDone && !confirmingReset && (
                    <Text style={styles.resetDoneText} testID="options-reset-done">
                      All progress cleared — ready for a fresh start!
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.versionCaption} testID="options-version">
                NShapes v{STORE_VERSION} (build {BUILD_VERSION})
              </Text>
            </ScrollView>

            <TouchableOpacity
              testID="options-done"
              style={styles.doneButton}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.doneButtonText}>DONE</Text>
            </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </View>
      </MotionModal>

      <KeybindingSheet visible={showKeybindings} onClose={() => setShowKeybindings(false)} />
    </>
  );
};

// ─── 1-Tap Pause Audio Pills (Drop-In for AdventureRun Pause & Camp) ────────

export interface PauseAudioPillsProps {
  /** Optional external handler for "All Settings". When omitted, mounts an inline SettingsSheet. */
  onOpenAllSettings?: () => void;
  /** Optional callback mirrored to Adventure `save.musicOn`. */
  onMusicChange?: (enabled: boolean) => void;
  /** Optional callback forwarded to built-in fallback SettingsSheet. */
  onReplayWalkthrough?: () => void;
  /** Optional controlled effects state forwarded to built-in fallback SettingsSheet. */
  effectsOn?: boolean;
  onToggleEffects?: () => void;
  /** Optional save-restored callback forwarded to built-in fallback SettingsSheet. */
  onSaveRestored?: () => void;
}

export const PauseAudioPills: React.FC<PauseAudioPillsProps> = ({
  onOpenAllSettings,
  onMusicChange,
  onReplayWalkthrough,
  effectsOn,
  onToggleEffects,
  onSaveRestored,
}) => {
  const [musicOn, setMusicOn] = useState(readMusicPref);
  const [sfxOn, setSfxOn] = useState(readSoundPref);
  const [hapticsOn, setHapticsOn] = useState(() => HapticsStorage.get());
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setMusicOn(readMusicPref());
    setSfxOn(readSoundPref());
    setHapticsOn(HapticsStorage.get());
    const unsubs = [
      typeof MusicStorage?.subscribe === 'function' ? MusicStorage.subscribe(setMusicOn) : undefined,
      typeof SoundStorage?.subscribe === 'function' ? SoundStorage.subscribe(setSfxOn) : undefined,
      HapticsStorage.subscribe(setHapticsOn),
    ];
    return () => {
      unsubs.forEach(u => u?.());
    };
  }, []);

  const toggleMusic = useCallback(() => {
    const next = !musicOn;
    setMusicOn(next);
    MusicStorage.set(next);
    if (typeof setMusicEnabled === 'function') {
      setMusicEnabled(next);
    }
    onMusicChange?.(next);
  }, [musicOn, onMusicChange]);

  const toggleSfx = useCallback(() => {
    if (!MusicStorage.hasValue()) {
      MusicStorage.set(musicOn);
    }
    const next = !sfxOn;
    setSfxOn(next);
    setAudioEnabled(next);
    SoundStorage.set(next);
    if (typeof setSfxOverride === 'function') {
      setSfxOverride(next);
    }
  }, [musicOn, sfxOn]);

  const toggleHaptics = useCallback(() => {
    const next = !hapticsOn;
    setHapticsOn(next);
    HapticsStorage.set(next);
    if (next) {
      void triggerHaptic('light');
    }
  }, [hapticsOn]);

  const handleOpenSettings = () => {
    if (onOpenAllSettings) {
      onOpenAllSettings();
    } else {
      setSheetOpen(true);
    }
  };

  return (
    <View style={pillStyles.wrap} testID="pause-audio-pills">
      <View style={pillStyles.row}>
        <TouchableOpacity
          testID="pause-toggle-music"
          accessibilityRole="button"
          accessibilityState={{ checked: musicOn }}
          accessibilityLabel={`Music ${musicOn ? 'on' : 'off'}`}
          onPress={toggleMusic}
          style={[pillStyles.pill, musicOn ? pillStyles.pillOn : pillStyles.pillOff]}
        >
          <Icon
            name="delapouite/harp"
            size={15}
            color={musicOn ? COLORS.canvasWhite : COLORS.slateCharcoal}
            noShadow
          />
          <Text style={[pillStyles.pillText, musicOn ? pillStyles.textOn : pillStyles.textOff]}>
            Music {musicOn ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="pause-toggle-sfx"
          accessibilityRole="button"
          accessibilityState={{ checked: sfxOn }}
          accessibilityLabel={`Sound Effects ${sfxOn ? 'on' : 'off'}`}
          onPress={toggleSfx}
          style={[pillStyles.pill, sfxOn ? pillStyles.pillOn : pillStyles.pillOff]}
        >
          <Icon
            name="delapouite/sound-on"
            size={15}
            color={sfxOn ? COLORS.canvasWhite : COLORS.slateCharcoal}
            noShadow
          />
          <Text style={[pillStyles.pillText, sfxOn ? pillStyles.textOn : pillStyles.textOff]}>
            SFX {sfxOn ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="pause-toggle-haptics"
          accessibilityRole="button"
          accessibilityState={{ checked: hapticsOn }}
          accessibilityLabel={`Haptics ${hapticsOn ? 'on' : 'off'}`}
          onPress={toggleHaptics}
          style={[pillStyles.pill, hapticsOn ? pillStyles.pillOn : pillStyles.pillOff]}
        >
          <Icon
            name="lorc/echo-ripples"
            size={15}
            color={hapticsOn ? COLORS.canvasWhite : COLORS.slateCharcoal}
            noShadow
          />
          <Text style={[pillStyles.pillText, hapticsOn ? pillStyles.textOn : pillStyles.textOff]}>
            Haptics {hapticsOn ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        testID="pause-all-settings"
        accessibilityRole="button"
        accessibilityLabel="All Settings"
        onPress={handleOpenSettings}
        style={pillStyles.allSettingsBtn}
      >
        <Icon name="lorc/gear-hammer" size={16} color={COLORS.deepOnyx} noShadow />
        <Text style={pillStyles.allSettingsText}>All Settings</Text>
      </TouchableOpacity>

      {!onOpenAllSettings && (
        <SettingsSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onMusicChange={onMusicChange}
          onReplayWalkthrough={onReplayWalkthrough}
          effectsOn={effectsOn}
          onToggleEffects={onToggleEffects}
          onSaveRestored={onSaveRestored}
          showReset={false}
        />
      )}
    </View>
  );
};

const pillStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flex: 1,
    minWidth: 92,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
  },
  pillOn: {
    backgroundColor: COLORS.tealSurface,
    borderColor: COLORS.tealSurface,
  },
  pillOff: {
    backgroundColor: COLORS.paperBeige,
  },
  pillText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  textOn: {
    color: COLORS.canvasWhite,
  },
  textOff: {
    color: COLORS.slateCharcoal,
  },
  allSettingsBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  allSettingsText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.deepOnyx,
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  overlayBackdrop: {
    backgroundColor: 'rgba(18, 18, 18, 0.72)',
  },
  container: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2.5,
    borderBottomWidth: 6,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  scrollArea: {
    flexShrink: 1,
  },
  header: {
    backgroundColor: COLORS.tealSurface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    flexShrink: 1,
    color: COLORS.canvasWhite,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupHeading: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: COLORS.tealSurface,
    marginTop: 10,
    marginBottom: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  settingRowNoBorder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  settingLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelCol: {
    flex: 1,
    minWidth: 0,
  },
  settingText: {
    flexShrink: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.deepOnyx,
  },
  settingSubtext: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.slateCharcoal,
    marginTop: 2,
  },
  colorblindBlock: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
    gap: 8,
  },
  previewStrip: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D9D2C7',
    padding: 8,
  },
  previewCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  previewCardCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
  },
  previewCardFrame: {
    width: '100%',
    height: 76,
  },
  previewFallbackCard: {
    flex: 1,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    gap: 4,
  },
  previewFallbackBadgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  previewFallbackBadge: {
    fontSize: 11,
    fontWeight: '900',
  },
  previewFallbackDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  previewCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
  },
  segmentedGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
  },
  segmentBtnOn: {
    backgroundColor: COLORS.tealSurface,
    borderColor: COLORS.tealSurface,
  },
  segmentBtnOff: {
    backgroundColor: COLORS.paperBeige,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  toggleButton: {
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 72,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonOn: {
    backgroundColor: COLORS.tealSurface,
  },
  toggleButtonOff: {
    backgroundColor: COLORS.paperBeige,
  },
  actionOutlineButton: {
    backgroundColor: COLORS.canvasWhite,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
  },
  actionOutlineText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.deepOnyx,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  toggleTextOn: {
    color: COLORS.canvasWhite,
  },
  toggleTextOff: {
    color: COLORS.slateCharcoal,
  },
  backupBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D9D2C7',
    padding: 10,
    gap: 8,
    marginBottom: 6,
  },
  backupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backupButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  backupBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.button,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupCodeDisplay: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CFC8BD',
    padding: 8,
  },
  backupCodeText: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: COLORS.deepOnyx,
  },
  restorePanel: {
    gap: 8,
  },
  restoreInput: {
    minHeight: 56,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    padding: 8,
    fontFamily: MONO_FONT,
    fontSize: 12,
    color: COLORS.deepOnyx,
    textAlignVertical: 'top',
  },
  backupErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.redSurface,
  },
  backupSuccessText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.tealSurface,
  },
  playerCodeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: MONO_FONT,
    color: COLORS.slateCharcoal,
    marginTop: 2,
  },
  legalLinksRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  legalLinkButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.tealSurface,
  },
  resetBlock: {
    paddingVertical: 10,
    gap: 10,
  },
  resetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  resetSubtext: {
    flexShrink: 1,
    fontSize: 11.5,
    color: COLORS.slateCharcoal,
    marginTop: 2,
  },
  resetOutlineButton: {
    backgroundColor: COLORS.canvasWhite,
    borderWidth: 1.5,
    borderColor: COLORS.redSurface,
  },
  resetOutlineText: {
    color: COLORS.redSurface,
  },
  resetDoneBadge: {
    backgroundColor: COLORS.tealSurface,
  },
  resetDoneInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confirmBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.redSurface,
    padding: 12,
    gap: 10,
  },
  confirmWarningText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.deepOnyx,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmActionBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerSolidButton: {
    backgroundColor: COLORS.redSurface,
  },
  resetDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.tealSurface,
  },
  versionCaption: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.slateCharcoal,
    opacity: 0.65,
    paddingTop: 6,
    paddingBottom: 10,
  },
  doneButton: {
    backgroundColor: COLORS.actionYellow,
    margin: 14,
    marginTop: 0,
    minHeight: 48,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: COLORS.deepOnyx,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});

export default SettingsSheet;
