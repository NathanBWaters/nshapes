/**
 * Comprehensive verification suite for Wave 5 Lane C:
 * - [UI-21] Unified global SettingsSheet, OptionsMenu wrapper, live 3-card Colorblind preview,
 *           Save Backup Code export/restore, Text Size, Fight Effects/Shake/Flash/Haptics,
 *           and 1-tap <PauseAudioPills>
 * - [UI-23] Customizable MMKV Keybindings (per-profile, duplicate bindings, Confirm/Cancel swap,
 *           presets), useKeyboardNav global modal z-priority stack & text-input guard,
 *           KeybindingSheet visual diagram, and Web keyboard wiring across MainMenu,
 *           AdventureMode, UnlockReveal, FriendRescueModal, DefeatOverlay & StoryEndingModal
 * - [UI-18] Dominant 2x Hero MainMenu Storybook panel, live Fighter + Frontier Foe matchup,
 *           unified 1-sentence pitch, compact 0-star "Other Modes" shelf, DOJO link,
 *           >=44x44 tap targets ([UI-17]), and zero raw OS emojis ([UI-03])
 */
import React from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  FightEffectsStorage,
  PauseAudioPills,
  SettingsSheet,
  SettingsTextSizeStorage,
} from '@/components/SettingsSheet';
import OptionsMenu from '@/components/OptionsMenu';
import KeybindingSheet from '@/components/KeybindingSheet';
import MainMenu, { UNIFIED_ELEVATOR_PITCH } from '@/components/MainMenu';
import AdventureMode from '@/adventure/AdventureMode';
import UnlockReveal from '@/adventure/components/UnlockReveal';
import FriendRescueModal from '@/adventure/components/FriendRescueModal';
import DefeatOverlay from '@/adventure/components/DefeatOverlay';
import StoryEndingModal from '@/adventure/components/StoryEndingModal';
import {
  cardIndexForKey,
  DEFAULT_KEYBINDINGS,
  formatActionKeys,
  getDuplicateKeyMap,
  KeybindingsStorage,
  matchesAction,
} from '@/utils/keybindings';
import {
  __resetKeyboardNavForTests,
  getKeyboardNavStackSize,
  KEY_PRIORITY,
  useKeyboardNav,
} from '@/hooks/useKeyboardNav';
import { HapticsStorage } from '@/utils/hapticsStorage';
import { ScreenFlashStorage, ScreenShakeStorage } from '@/utils/fxSettingsStorage';
import { ColorblindStorage, MusicStorage, SoundStorage, storage } from '@/utils/storage';
import { createNewSave, applyLevelResult } from '@/adventure/progress';
import { loadAdventureSave, writeAdventureSave } from '@/adventure/save';
import { encodeFullSaveBackup } from '@/adventure/saveShare';
import { createRun } from '@/adventure/engine/run';
import { getLevel } from '@/adventure/data/levels';
import { getMapKey } from '@/adventure/data/mapKeys';
import { createInitialSpireMeta, resetSpireStorage } from '@/spire/save';
import { LabsStorage } from '@/utils/freePlayStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: Record<string, unknown>) =>
      ReactActual.createElement(View, props, props?.children);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy(
    { __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, unknown>,
    {
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
        return target[prop];
      },
    }
  );
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

const mockBandPlayScreenMusic = jest.fn();
const mockBandStop = jest.fn();
const mockSetMusicEnabled = jest.fn();
const mockSetSfxOverride = jest.fn();

jest.mock('@/audio', () => {
  const band = new Proxy(
    {
      inFight: false,
      current: 'title',
      playScreenMusic: (...args: unknown[]) => mockBandPlayScreenMusic(...args),
      stop: (...args: unknown[]) => mockBandStop(...args),
    },
    {
      get(target, key: string) {
        if (key in target) return (target as Record<string, unknown>)[key];
        return () => undefined;
      },
    }
  );
  return {
    sfx: () => undefined,
    music: band,
    band,
    setMusicEnabled: (...args: unknown[]) => mockSetMusicEnabled(...args),
    setSfxOverride: (...args: unknown[]) => mockSetSfxOverride(...args),
  };
});

jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID, character }: { testID?: string; character: string }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `fighter-avatar-${character}` }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy?: { name?: string } }) =>
      ReactActual.createElement(View, {
        testID,
        accessibilityLabel: `enemy-avatar-${enemy?.name ?? 'foe'}`,
      }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon?: { name?: string } }) =>
      ReactActual.createElement(View, {
        testID,
        accessibilityLabel: `weapon-avatar-${weapon?.name ?? 'weapon'}`,
      }),
  };
});

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 667 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={SAFE_METRICS}>{ui}</SafeAreaProvider>
);

/** Non-destructive Web `window.addEventListener` key dispatcher that preserves Jest/React globals. */
const withWebPlatform = (
  fn: (win: {
    dispatchKey: (
      key: string,
      opts?: {
        metaKey?: boolean;
        ctrlKey?: boolean;
        altKey?: boolean;
        target?: { tagName?: string; isContentEditable?: boolean } | null;
      }
    ) => boolean;
    listenerCount: (type?: string) => number;
  }) => void
) => {
  const origOs = Platform.OS;
  const g = globalThis as unknown as { window?: Record<string, unknown> };
  const hadWindow = 'window' in g && g.window !== undefined;
  const targetWin = (hadWindow ? g.window! : (g.window = {})) as Record<string, unknown>;
  const origAdd = targetWin.addEventListener;
  const origRemove = targetWin.removeEventListener;
  const origMatchMedia = targetWin.matchMedia;

  const listeners = new Map<string, Set<(e: unknown) => void>>();
  targetWin.addEventListener = (type: string, cb: (e: unknown) => void) => {
    let set = listeners.get(type);
    if (!set) {
      set = new Set();
      listeners.set(type, set);
    }
    set.add(cb);
  };
  targetWin.removeEventListener = (type: string, cb: (e: unknown) => void) => {
    listeners.get(type)?.delete(cb);
  };
  targetWin.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  const dispatchKey = (
    key: string,
    opts?: {
      metaKey?: boolean;
      ctrlKey?: boolean;
      altKey?: boolean;
      target?: { tagName?: string; isContentEditable?: boolean } | null;
    }
  ) => {
    const prevented = { value: false };
    const event = {
      key,
      metaKey: Boolean(opts?.metaKey),
      ctrlKey: Boolean(opts?.ctrlKey),
      altKey: Boolean(opts?.altKey),
      target: opts?.target ?? null,
      preventDefault: () => {
        prevented.value = true;
      },
    };
    const set = listeners.get('keydown');
    if (set) {
      [...set].forEach(cb => cb(event));
    }
    return prevented.value;
  };
  const listenerCount = (type = 'keydown') => listeners.get(type)?.size ?? 0;

  (Platform as { OS: string }).OS = 'web';
  try {
    fn({ dispatchKey, listenerCount });
  } finally {
    cleanup();
    __resetKeyboardNavForTests();
    (Platform as { OS: string }).OS = origOs;
    if (hadWindow) {
      targetWin.addEventListener = origAdd;
      targetWin.removeEventListener = origRemove;
      targetWin.matchMedia = origMatchMedia;
    } else {
      delete g.window;
    }
  }
};

describe('Wave 5 Lane C — Menu Hierarchy, Global Settings & Desktop Keyboard Controls', () => {
  beforeEach(() => {
    storage.clearAll();
    resetSpireStorage();
    LabsStorage.clear();
    writeAdventureSave(createNewSave());
    KeybindingsStorage.reset();
    FightEffectsStorage.set(true);
    SettingsTextSizeStorage.set('normal');
    HapticsStorage.set(true);
    ScreenShakeStorage.set(true);
    ScreenFlashStorage.set(true);
    ColorblindStorage.set(false);
    __resetKeyboardNavForTests();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    __resetKeyboardNavForTests();
    jest.useRealTimers();
  });

  // ─── [UI-21] SettingsSheet, OptionsMenu Wrapper & PauseAudioPills ─────────

  describe('[UI-21] Unified SettingsSheet, OptionsMenu wrapper & PauseAudioPills', () => {
    it('toggles Music, SFX, Haptics, Fight Effects, Screen Shake, Screen Flash & Text Size cleanly', () => {
      const onReplay = jest.fn();
      const onClose = jest.fn();
      const view = render(
        wrap(
          <OptionsMenu
            visible
            onClose={onClose}
            onReplayWalkthrough={onReplay}
          />
        )
      );

      // >=44x44 close button ([UI-17])
      const closeStyle = StyleSheet.flatten(view.getByTestId('options-close').props.style);
      expect(closeStyle.minWidth).toBeGreaterThanOrEqual(44);
      expect(closeStyle.minHeight).toBeGreaterThanOrEqual(44);

      // Audio & Touch
      fireEvent.press(view.getByTestId('options-music-toggle'));
      expect(MusicStorage.get()).toBe(false);
      expect(mockSetMusicEnabled).toHaveBeenCalledWith(false);

      fireEvent.press(view.getByTestId('options-sfx-toggle'));
      expect(SoundStorage.get()).toBe(false);

      fireEvent.press(view.getByTestId('options-haptics-toggle'));
      expect(HapticsStorage.get()).toBe(false);

      // Visual Comfort
      fireEvent.press(view.getByTestId('options-effects-toggle'));
      expect(FightEffectsStorage.get()).toBe(false);
      expect(loadAdventureSave().effectsOn).toBe(false);

      fireEvent.press(view.getByTestId('options-shake-toggle'));
      expect(ScreenShakeStorage.get()).toBe(false);

      fireEvent.press(view.getByTestId('options-flash-toggle'));
      expect(ScreenFlashStorage.get()).toBe(false);

      // Text Size
      fireEvent.press(view.getByTestId('options-text-size-large'));
      expect(SettingsTextSizeStorage.get()).toBe('large');
      expect(view.getByTestId('options-text-size-large').props.accessibilityState?.selected).toBe(true);

      // Replay 1-1 Walkthrough
      fireEvent.press(view.getByTestId('options-replay-walkthrough'));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onReplay).toHaveBeenCalledTimes(1);
    });

    it('updates live 3-card Colorblind preview across White, Blueprint Mist & Charcoal instantly', () => {
      const view = render(wrap(<SettingsSheet visible onClose={() => {}} />));
      expect(view.getByTestId('settings-colorblind-preview')).toBeTruthy();

      // Standard mode: 3 live Cards across White / Mist / Charcoal without O/B/P letter badges
      expect(view.getByText('White · Orange')).toBeTruthy();
      expect(view.getByText('Mist · Blue')).toBeTruthy();
      expect(view.getByText('Charcoal · Pink')).toBeTruthy();
      expect(view.queryAllByTestId('card-colorblind-badge')).toHaveLength(0);

      // Toggle Colorblind Mode ON -> live 3-card preview updates immediately with O/B/P & W/M/D badges
      fireEvent.press(view.getByTestId('options-colorblind-toggle'));
      expect(ColorblindStorage.get()).toBe(true);
      expect(view.getByText('W · O')).toBeTruthy();
      expect(view.getByText('M · B')).toBeTruthy();
      expect(view.getByText('D · P')).toBeTruthy();
      expect(view.getAllByTestId('card-colorblind-badge')).toHaveLength(3);
      expect(view.getAllByTestId('card-bg-code-badge')).toHaveLength(3);
    });

    it('exports and restores checksummed Save Backup Codes ([TP-18]) and rejects tampered codes', () => {
      const richSave = {
        ...createNewSave(),
        coins: 321,
        stars: { '1-1': 3, '1-2': 2 },
        plays: { '1-1': 1, '1-2': 1 },
      };
      writeAdventureSave(richSave);

      const onSaveRestored = jest.fn();
      const view = render(
        wrap(<SettingsSheet visible onClose={() => {}} onSaveRestored={onSaveRestored} />)
      );

      // Export produces a checksummed NSHAPES1:... backup code
      fireEvent.press(view.getByTestId('options-backup-export'));
      const exportedText = String(view.getByTestId('options-backup-code').props.children);
      expect(exportedText.startsWith('NSHAPES1:')).toBe(true);

      // Reset current save to blank, then test invalid & valid restores
      writeAdventureSave(createNewSave());
      expect(loadAdventureSave().coins).toBe(0);

      fireEvent.press(view.getByTestId('options-backup-restore-toggle'));
      fireEvent.changeText(view.getByTestId('options-backup-input'), 'NSHAPES1:BADCHK:abc');
      fireEvent.press(view.getByTestId('options-backup-import'));
      expect(view.getByTestId('options-backup-error')).toBeTruthy();
      expect(loadAdventureSave().coins).toBe(0);

      // Valid restore recovers coins & stars cleanly
      const validBackup = encodeFullSaveBackup(richSave, createInitialSpireMeta(), null);
      fireEvent.changeText(view.getByTestId('options-backup-input'), validBackup);
      fireEvent.press(view.getByTestId('options-backup-import'));
      expect(view.getByTestId('options-backup-success')).toBeTruthy();
      expect(onSaveRestored).toHaveBeenCalledTimes(1);
      expect(loadAdventureSave().coins).toBe(321);
      expect(loadAdventureSave().stars['1-1']).toBe(3);
    });

    it('renders <PauseAudioPills> with 1-tap Music, SFX, Haptics toggles and All Settings launcher', () => {
      const onOpenAllSettings = jest.fn();
      const onMusicChange = jest.fn();
      const view = render(
        wrap(
          <PauseAudioPills
            onOpenAllSettings={onOpenAllSettings}
            onMusicChange={onMusicChange}
          />
        )
      );

      fireEvent.press(view.getByTestId('pause-toggle-music'));
      expect(MusicStorage.get()).toBe(false);
      expect(onMusicChange).toHaveBeenCalledWith(false);

      fireEvent.press(view.getByTestId('pause-toggle-sfx'));
      expect(SoundStorage.get()).toBe(false);

      fireEvent.press(view.getByTestId('pause-toggle-haptics'));
      expect(HapticsStorage.get()).toBe(false);

      fireEvent.press(view.getByTestId('pause-all-settings'));
      expect(onOpenAllSettings).toHaveBeenCalledTimes(1);
    });

    it('opens built-in fallback SettingsSheet from <PauseAudioPills> when onOpenAllSettings is omitted', () => {
      const standalone = render(wrap(<PauseAudioPills />));
      fireEvent.press(standalone.getByTestId('pause-all-settings'));
      expect(standalone.getByTestId('settings-sheet')).toBeTruthy();
    });
  });

  // ─── [UI-23] Keybindings Store, useKeyboardNav Stack & KeybindingSheet ────

  describe('[UI-23] Keybindings persistence, duplicates, swap, z-priority stack & KeybindingSheet', () => {
    it('supports default 1-9/0/-/= & QWE/ASD/ZXC bindings, per-profile MMKV storage, duplicate bindings & confirm/cancel swap', () => {
      // Defaults cover both numeric 1-9/0/-/= and spatial QWE/ASD/ZXC grids
      expect(cardIndexForKey('1')).toBe(0);
      expect(cardIndexForKey('q')).toBe(0);
      expect(cardIndexForKey('Q')).toBe(0);
      expect(cardIndexForKey('9')).toBe(8);
      expect(cardIndexForKey('c')).toBe(8);
      expect(cardIndexForKey('0')).toBe(9);
      expect(cardIndexForKey('-')).toBe(10);
      expect(cardIndexForKey('=')).toBe(11);
      expect(matchesAction('Enter', 'confirm')).toBe(true);
      expect(matchesAction(' ', 'confirm')).toBe(true);
      expect(matchesAction('Escape', 'cancel')).toBe(true);
      expect(matchesAction('h', 'hint')).toBe(true);
      expect(matchesAction('R', 'retry')).toBe(true);
      expect(matchesAction('s', 'sacrifice')).toBe(true);

      // Duplicate binding allowed (binding 'h' to retry leaves hint bound to 'h' too!)
      const afterDupe = KeybindingsStorage.bindAction('retry', 'h');
      expect(afterDupe.hint).toContain('h');
      expect(afterDupe.retry).toContain('h');
      expect(getDuplicateKeyMap(afterDupe).h).toEqual(expect.arrayContaining(['hint', 'retry']));

      // Confirm / Cancel atomic swap without lockout
      const swapped = KeybindingsStorage.swapConfirmCancel();
      expect(swapped.confirm).toEqual(['Escape']);
      expect(swapped.cancel).toEqual(['Enter', ' ']);

      // Independent second profile remains at defaults
      expect(KeybindingsStorage.get('profile-b')).toEqual(DEFAULT_KEYBINDINGS);

      // Reset restores default profile cleanly
      const reset = KeybindingsStorage.reset();
      expect(reset).toEqual(DEFAULT_KEYBINDINGS);
      expect(formatActionKeys(reset.confirm)).toBe('ENTER / SPACE');
    });

    it('enforces global modal z-priority capture, ignores editable inputs & cleans up window listeners', () => {
      withWebPlatform(win => {
        const screenConfirm = jest.fn();
        const modalConfirm = jest.fn();
        const modalCancel = jest.fn();

        const Harness = ({ modalOpen }: { modalOpen: boolean }) => {
          useKeyboardNav({
            enabled: true,
            priority: KEY_PRIORITY.SCREEN,
            onConfirm: screenConfirm,
          });
          useKeyboardNav({
            enabled: modalOpen,
            priority: KEY_PRIORITY.MODAL,
            onConfirm: modalConfirm,
            onCancel: modalCancel,
          });
          return <View />;
        };

        const view = render(<Harness modalOpen={false} />);
        expect(getKeyboardNavStackSize()).toBe(1);
        expect(win.listenerCount('keydown')).toBe(1);

        // Text inputs are ignored
        act(() => {
          win.dispatchKey('Enter', { target: { tagName: 'INPUT' } });
          win.dispatchKey('Enter', { target: { tagName: 'TEXTAREA' } });
          win.dispatchKey('Enter', { ctrlKey: true });
        });
        expect(screenConfirm).not.toHaveBeenCalled();

        // Base screen receives Enter when no modal is open
        act(() => {
          win.dispatchKey('Enter');
        });
        expect(screenConfirm).toHaveBeenCalledTimes(1);

        // Opening modal preempts base screen completely
        view.rerender(<Harness modalOpen />);
        expect(getKeyboardNavStackSize()).toBe(2);
        act(() => {
          win.dispatchKey('Enter');
          win.dispatchKey('Escape');
        });
        expect(screenConfirm).toHaveBeenCalledTimes(1);
        expect(modalConfirm).toHaveBeenCalledTimes(1);
        expect(modalCancel).toHaveBeenCalledTimes(1);

        // Unmount cleans up stack and window listener completely
        view.unmount();
        expect(getKeyboardNavStackSize()).toBe(0);
        expect(win.listenerCount('keydown')).toBe(0);
      });
    });

    it('KeybindingSheet binds keys from visual diagram & action rows, allows duplicates, swaps Confirm/Cancel & resets', () => {
      withWebPlatform(win => {
        const onClose = jest.fn();
        const view = render(wrap(<KeybindingSheet visible onClose={onClose} />));

        expect(view.getByTestId('keybinding-visual-diagram')).toBeTruthy();

        // Click diagram Card #1 -> press 'k' -> Card #1 updates to K
        fireEvent.press(view.getByTestId('keybinding-diagram-card_0'));
        expect(view.getByTestId('keybinding-listening-banner')).toBeTruthy();
        act(() => {
          win.dispatchKey('k');
        });
        expect(KeybindingsStorage.get().card_0).toEqual(['k']);
        expect(view.getByTestId('keybinding-status')).toBeTruthy();

        // Add secondary key to Hint using Add Extra Key mode (binding 'k' also allowed as duplicate!)
        fireEvent.press(view.getByTestId('keybinding-mode-add'));
        fireEvent.press(view.getByTestId('keybinding-action-hint'));
        act(() => {
          win.dispatchKey('k');
        });
        expect(KeybindingsStorage.get().hint).toEqual(['h', 'k']);
        expect(view.getByTestId('keybinding-shared-hint')).toBeTruthy();

        // Swap Confirm/Cancel button
        fireEvent.press(view.getByTestId('keybinding-swap-confirm-cancel'));
        expect(KeybindingsStorage.get().confirm).toEqual(['Escape']);

        // Reset defaults
        fireEvent.press(view.getByTestId('keybinding-reset-defaults'));
        expect(KeybindingsStorage.get().confirm).toEqual(['Enter', ' ']);
        expect(KeybindingsStorage.get().card_0).toEqual(['1', 'q']);

        // Escape closes KeybindingSheet when not listening
        act(() => {
          win.dispatchKey('Escape');
        });
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('stacks KeybindingSheet cleanly over SettingsSheet so Escape closes only KeybindingSheet first', () => {
      withWebPlatform(win => {
        const onCloseSettings = jest.fn();
        const view = render(wrap(<SettingsSheet visible onClose={onCloseSettings} />));

        fireEvent.press(view.getByTestId('options-keyboard-controls'));
        expect(view.getByTestId('keybinding-sheet')).toBeTruthy();

        // First Escape closes KeybindingSheet only
        act(() => {
          win.dispatchKey('Escape');
        });
        expect(onCloseSettings).not.toHaveBeenCalled();

        // Second Escape closes SettingsSheet
        act(() => {
          win.dispatchKey('Escape');
        });
        expect(onCloseSettings).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ─── [UI-18] MainMenu Hero Hierarchy, DOJO Link & Mash-to-Play ────────────

  describe('[UI-18] MainMenu 2x Hero card, compact 0-star shelf, DOJO link & mash-to-play', () => {
    it('renders dominant Hero Play card with Fighter + Frontier Foe, unified pitch, compact Other Modes & DOJO link', () => {
      const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      const onSelectAdventure = jest.fn();
      const onSelectSpire = jest.fn();
      const onSelectFreeplay = jest.fn();
      const onSelectOptions = jest.fn();

      const view = render(
        wrap(
          <MainMenu
            onSelectAdventure={onSelectAdventure}
            onSelectSpire={onSelectSpire}
            onSelectFreeplay={onSelectFreeplay}
            onSelectOptions={onSelectOptions}
          />
        )
      );

      // Preserves NSHAPES title, unified pitch, Hero live avatars, and AU-20 title music
      expect(view.getByText('NSHAPES')).toBeTruthy();
      expect(view.getByTestId('menu-pitch')).toHaveTextContent(UNIFIED_ELEVATOR_PITCH);
      expect(view.getByTestId('main-menu-mascot')).toBeTruthy();
      expect(view.getByTestId('menu-frontier-foe')).toBeTruthy();
      expect(mockBandPlayScreenMusic).toHaveBeenCalledWith('title');

      // 0-star fresh save renders compact "Other Modes" shelf with expand toggle while preserving Summit lock
      expect(view.getByTestId('menu-other-modes-compact')).toBeTruthy();
      expect(view.getByTestId('menu-spire').props.accessibilityState?.disabled).toBe(true);
      fireEvent.press(view.getByTestId('menu-other-modes-toggle'));
      expect(view.queryByTestId('menu-other-modes-compact')).toBeNull();
      expect(view.getByTestId('menu-freeplay')).toBeTruthy();

      // DOJO link opens cleanly
      fireEvent.press(view.getByTestId('menu-dojo-link'));
      expect(openUrlSpy).toHaveBeenCalledWith(expect.stringContaining('/dojo/index.html'));

      // Zero raw OS pictographic emojis anywhere in MainMenu tree
      const serialized = JSON.stringify(view.toJSON());
      expect(/[\u{1F300}-\u{1FAFF}]/u.test(serialized)).toBe(false);

      openUrlSpy.mockRestore();
    });

    it('supports Web Enter/Space mash-to-play on MainMenu and respects SettingsSheet modal preemption', () => {
      withWebPlatform(win => {
        const onSelectAdventure = jest.fn();
        const Harness = ({ optionsOpen }: { optionsOpen: boolean }) => (
          <>
            <MainMenu
              onSelectAdventure={onSelectAdventure}
              onSelectSpire={() => {}}
              onSelectFreeplay={() => {}}
              onSelectOptions={() => {}}
            />
            <OptionsMenu visible={optionsOpen} onClose={() => {}} />
          </>
        );

        const view = render(wrap(<Harness optionsOpen={false} />));
        act(() => {
          win.dispatchKey('Enter');
        });
        expect(onSelectAdventure).toHaveBeenCalledTimes(1);

        // When OptionsMenu/SettingsSheet is open, Enter must NOT leak to MainMenu
        view.rerender(wrap(<Harness optionsOpen />));
        act(() => {
          win.dispatchKey(' ');
        });
        expect(onSelectAdventure).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ─── [UI-23] + [UI-21] AdventureMode & Overlay Keyboard Wiring ────────────

  describe('[UI-23] + [UI-21] AdventureMode, UnlockReveal, FriendRescueModal, DefeatOverlay & StoryEndingModal', () => {
    it('wires Enter/Escape mash-to-play & global SettingsSheet inside AdventureMode without breaking ActiveOverlay mutex', () => {
      withWebPlatform(win => {
        const advSave = {
          ...createNewSave(),
          stars: { '1-1': 3 },
          plays: { '1-1': 1 },
          seenMechanics: ['set_rule', 'hearts'],
        };
        const onExit = jest.fn();
        const view = render(
          wrap(<AdventureMode initialSave={advSave} coldOpen={false} onExit={onExit} />)
        );

        // Open global SettingsSheet via Map trigger -> Escape closes it cleanly
        fireEvent.press(view.getByTestId('adventure-settings-trigger'));
        expect(view.getByTestId('settings-sheet')).toBeTruthy();
        act(() => {
          win.dispatchKey('Escape');
        });
        expect(view.queryByTestId('settings-sheet')).toBeNull();

        // Enter on Map opens frontier LevelPreview -> Escape closes Preview
        act(() => {
          win.dispatchKey('Enter');
        });
        expect(view.getByTestId('preview-play')).toBeTruthy();
        act(() => {
          win.dispatchKey('Escape');
        });

        // Enter on Map -> Enter on Preview launches live fight (full mash-to-play!)
        act(() => {
          win.dispatchKey('Enter');
        });
        expect(view.getByTestId('preview-play')).toBeTruthy();
        act(() => {
          win.dispatchKey('Enter');
        });
        expect(view.getByTestId('run-stage')).toBeTruthy();
      });
    });

    it('supports Enter/Escape keyboard flow on UnlockReveal, FriendRescueModal, DefeatOverlay & StoryEndingModal', () => {
      withWebPlatform(win => {
        jest.useFakeTimers();

        // 1. UnlockReveal: Enter reveals -> Enter confirms primary action
        const onEquip = jest.fn();
        const onUnlockDone = jest.fn();
        const unlockView = render(
          wrap(
            <UnlockReveal
              unlocks={[{ kind: 'weapon', id: 'blast-powder', star: 1, firstWeapon: false }]}
              save={createNewSave()}
              onUseFighter={() => {}}
              onEquipCharm={onEquip}
              onDone={onUnlockDone}
            />
          )
        );
        act(() => {
          win.dispatchKey('Enter');
          jest.advanceTimersByTime(600);
        });
        act(() => {
          win.dispatchKey('Enter');
          jest.advanceTimersByTime(600);
        });
        expect(onEquip).toHaveBeenCalledWith('blast-powder');
        unlockView.unmount();

        // 2. FriendRescueModal: ArrowDown switches selection, Enter rescues, Enter equips
        const onRescue = jest.fn();
        const onUseFighter = jest.fn();
        const onCloseRescue = jest.fn();
        const keyDef = getMapKey('key-1')!;
        const rescueView = render(
          wrap(
            <FriendRescueModal
              keyDef={keyDef}
              save={createNewSave()}
              onRescue={onRescue}
              onUseFighter={onUseFighter}
              onClose={onCloseRescue}
            />
          )
        );
        act(() => {
          win.dispatchKey('ArrowDown');
        });
        act(() => {
          win.dispatchKey('Enter');
        });
        expect(onRescue).toHaveBeenCalledTimes(1);
        const rescuedName = onRescue.mock.calls[0][1];
        act(() => {
          win.dispatchKey('Enter');
        });
        expect(onUseFighter).toHaveBeenCalledWith(rescuedName);
        expect(onCloseRescue).toHaveBeenCalledWith(false);
        rescueView.unmount();

        // 3. DefeatOverlay: R retries (honoring customized retry key!), Escape maps back
        const lvl = getLevel('1-2');
        const save = createNewSave();
        const lostRun = {
          ...createRun(lvl, save, { seed: 7 }),
          status: 'lost' as const,
          endReason: 'hearts' as const,
          hearts: 0,
        };
        const res = applyLevelResult(save, lvl, 0, 0, lostRun);
        const onRetry = jest.fn();
        const onMap = jest.fn();
        KeybindingsStorage.bindAction('retry', 'x');
        const defeatView = render(
          wrap(
            <DefeatOverlay
              level={lvl}
              run={lostRun}
              result={res}
              onRetry={onRetry}
              onFullBreakdown={() => {}}
              onCamp={() => {}}
              onMap={onMap}
            />
          )
        );
        act(() => {
          win.dispatchKey('x');
          win.dispatchKey('Escape');
        });
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onMap).toHaveBeenCalledTimes(1);
        defeatView.unmount();
        KeybindingsStorage.reset();

        // 4. StoryEndingModal: Escape pauses, Enter resumes, Enter advances all 3 beats to onDone
        const onEndingDone = jest.fn();
        const endingView = render(
          wrap(<StoryEndingModal visible save={save} onDone={onEndingDone} />)
        );
        act(() => {
          win.dispatchKey('Escape');
        });
        expect(endingView.getByTestId('ending-paused-pill')).toBeTruthy();
        act(() => {
          win.dispatchKey('Enter'); // resumes
        });
        expect(endingView.queryByTestId('ending-paused-pill')).toBeNull();
        act(() => {
          win.dispatchKey('Enter'); // beat 1 -> 2
        });
        act(() => {
          win.dispatchKey('Enter'); // beat 2 -> 3
        });
        act(() => {
          win.dispatchKey(' '); // beat 3 -> done
        });
        expect(onEndingDone).toHaveBeenCalledTimes(1);
        endingView.unmount();
      });
    });
  });
});
