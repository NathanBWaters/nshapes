/**
 * Wave 5 cross-lane seams ([UI-16] + [UI-21] + [UI-23]):
 * 1. SettingsSheet Text Size ↔ the single global `TextSizeStorage` (no duplicate store):
 *    toggling in Settings re-renders every `useTextScale()` consumer instantly.
 * 2. AdventureRun Pause → 1-tap `<PauseAudioPills>` (Music / SFX / Haptics / All Settings) and
 *    Camp's ≥44px "Settings" launcher (replacing the mislabeled "Sound: on/off" toggle) opening the
 *    global SettingsSheet while mirroring `save.musicOn` / `save.effectsOn`.
 * 3. AdventureRun `useKeyboardNav`: card-slot hotkeys, H hint, S sacrifice, Backspace clear,
 *    Escape pause/resume, and z-priority so board keys never fire beneath Pause, inspectors or Settings.
 */
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FightEffectsStorage, SettingsSheet, SettingsTextSizeStorage } from '@/components/SettingsSheet';
import AdventureRun from '@/adventure/components/AdventureRun';
import Camp from '@/adventure/components/Camp';
import { MAIN_LEVELS, PRACTICE_LEVELS } from '@/adventure/data/levels';
import { COACH_KEYS, applyLevelResult, createNewSave } from '@/adventure/progress';
import { writeAdventureSave } from '@/adventure/save';
import type { AdventureSave, FeatureFlag } from '@/adventure/types';
import { __resetKeyboardNavForTests } from '@/hooks/useKeyboardNav';
import { KeybindingsStorage } from '@/utils/keybindings';
import { HapticsStorage } from '@/utils/hapticsStorage';
import { MusicStorage, SoundStorage, storage } from '@/utils/storage';
import { TextSizeStorage, useTextScale } from '@/utils/textSizeStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: Record<string, unknown>) => ReactActual.createElement(View, props, props?.children);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy({ __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, unknown>, {
    get(target, prop: string) {
      if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
      return target[prop];
    },
  });
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('@/audio', () => {
  const band = new Proxy(
    { inFight: false, current: 'title', gridMs: 62.5 },
    {
      get(target, key: string) {
        if (key in target) return (target as Record<string, unknown>)[key];
        return () => undefined;
      },
    }
  );
  return { sfx: () => undefined, music: band, band, setMusicEnabled: () => undefined, setSfxOverride: () => undefined };
});

jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID }: { testID?: string }) => ReactActual.createElement(View, { testID }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID }: { testID?: string }) => ReactActual.createElement(View, { testID }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID }: { testID?: string }) => ReactActual.createElement(View, { testID }),
  };
});

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const wrap = (ui: React.ReactElement) => <SafeAreaProvider initialMetrics={SAFE_METRICS}>{ui}</SafeAreaProvider>;
const noop = () => {};
type ReactTestInstance = ReturnType<ReturnType<typeof render>['getByTestId']>;

/** Fake web `window` keydown bus (the hook is a no-op off web). */
const withWebPlatform = (fn: (dispatchKey: (key: string) => void) => void) => {
  const origOs = Platform.OS;
  const g = globalThis as unknown as { window?: Record<string, unknown> };
  const hadWindow = 'window' in g && g.window !== undefined;
  const win = (hadWindow ? g.window! : (g.window = {})) as Record<string, unknown>;
  const origAdd = win.addEventListener;
  const origRemove = win.removeEventListener;
  const origMatchMedia = win.matchMedia;
  win.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
  const listeners = new Set<(e: unknown) => void>();
  win.addEventListener = (type: string, cb: (e: unknown) => void) => {
    if (type === 'keydown') listeners.add(cb);
  };
  win.removeEventListener = (type: string, cb: (e: unknown) => void) => {
    if (type === 'keydown') listeners.delete(cb);
  };
  const dispatchKey = (key: string) => {
    act(() => {
      const event = { key, metaKey: false, ctrlKey: false, altKey: false, target: null, preventDefault: noop };
      [...listeners].forEach(cb => cb(event));
    });
  };
  (Platform as { OS: string }).OS = 'web';
  try {
    fn(dispatchKey);
  } finally {
    cleanup();
    __resetKeyboardNavForTests();
    (Platform as { OS: string }).OS = origOs;
    if (hadWindow) {
      win.addEventListener = origAdd;
      win.removeEventListener = origRemove;
      win.matchMedia = origMatchMedia;
    } else {
      delete g.window;
    }
  }
};

const practice = PRACTICE_LEVELS[0];
const readySave = (): AdventureSave => {
  let save = createNewSave();
  for (const l of MAIN_LEVELS.slice(0, 4)) save = applyLevelResult(save, l, 2, 0).save;
  return {
    ...save,
    seenMechanics: [...MAIN_LEVELS.map(l => l.introduces), practice.introduces],
    seenCoachMarks: [COACH_KEYS.fightStart(practice.introduces), COACH_KEYS.passives('Orange Tabby')],
  };
};
const FEATURES: FeatureFlag[] = ['hearts', 'hints', 'graces'];
const renderRun = () =>
  render(
    wrap(
      <AdventureRun
        level={practice}
        save={readySave()}
        seed={4242}
        onFinish={noop}
        onQuit={noop}
        onRestart={noop}
        onCoachMarkSeen={noop}
        featuresOverride={new Set(FEATURES)}
        effects={false}
      />
    )
  );

/** Board card pressables, in slot order (their a11y label starts "<n> <color> <shading> <shape>"). */
const CARD_LABEL = /^(\d+) (orange|blue|pink|red|green|purple) (solid|striped|open) /;
const selectedFlags = (view: ReturnType<typeof render>) =>
  view.getAllByLabelText(CARD_LABEL).map(c => Boolean(c.props.accessibilityState?.selected));

beforeEach(() => {
  storage.clearAll();
  writeAdventureSave(createNewSave());
  KeybindingsStorage.reset();
  TextSizeStorage.set('normal');
  FightEffectsStorage.set(true);
  HapticsStorage.set(true);
  MusicStorage.set(true);
  SoundStorage.set(true);
  __resetKeyboardNavForTests();
});

afterEach(() => {
  cleanup();
  __resetKeyboardNavForTests();
});

describe('Seam 1 — SettingsSheet Text Size drives the single global TextSizeStorage', () => {
  const ScaleProbe = () => <Text testID="scale-probe">{String(useTextScale())}</Text>;

  it('toggling Large in Settings instantly re-scales every useTextScale() consumer', () => {
    const view = render(
      wrap(
        <>
          <ScaleProbe />
          <SettingsSheet visible onClose={noop} />
        </>
      )
    );
    expect(view.getByTestId('scale-probe')).toHaveTextContent('1');

    fireEvent.press(view.getByTestId('options-text-size-large'));
    expect(TextSizeStorage.get()).toBe('large');
    expect(SettingsTextSizeStorage.get()).toBe('large');
    expect(view.getByTestId('scale-probe')).toHaveTextContent('1.15');
    expect(view.getByTestId('options-text-size-large').props.accessibilityState?.selected).toBe(true);

    // External writes (any screen) flow back into the open sheet: one store, zero drift
    act(() => TextSizeStorage.set('normal'));
    expect(view.getByTestId('scale-probe')).toHaveTextContent('1');
    expect(view.getByTestId('options-text-size-normal').props.accessibilityState?.selected).toBe(true);

    // The legacy alias is a pass-through, not a second store
    act(() => SettingsTextSizeStorage.set('large'));
    expect(TextSizeStorage.get()).toBe('large');
    expect(view.getByTestId('scale-probe')).toHaveTextContent('1.15');
  });

  it('scales live AdventureRun HUD text when Text Size is Large', () => {
    TextSizeStorage.set('large');
    const view = renderRun();
    const foeLabel = view.getByTestId('run-foe-inspect');
    const texts = foeLabel.findAll((n: ReactTestInstance) => n.props?.numberOfLines === 1 && n.props?.style !== undefined);
    const sizes = texts
      .map((t: ReactTestInstance) => StyleSheet.flatten(t.props.style)?.fontSize)
      .filter((n: unknown): n is number => typeof n === 'number');
    expect(sizes).toContain(15.5); // 13.5px foe name × 1.15, rounded to the half pixel
  });
});

describe('Seam 2 — Pause audio pills in AdventureRun & the Camp Settings launcher', () => {
  it('Pause shows 1-tap Music / SFX / Haptics pills and All Settings opens the global sheet over the paused fight', () => {
    withWebPlatform(dispatchKey => {
      const view = renderRun();
      fireEvent.press(view.getByTestId('run-pause'));
      expect(view.getByText('PAUSED')).toBeTruthy();
      expect(view.getByTestId('pause-audio-pills')).toBeTruthy();

      fireEvent.press(view.getByTestId('pause-toggle-music'));
      expect(MusicStorage.get()).toBe(false);
      fireEvent.press(view.getByTestId('pause-toggle-sfx'));
      expect(SoundStorage.get()).toBe(false);
      fireEvent.press(view.getByTestId('pause-toggle-haptics'));
      expect(HapticsStorage.get()).toBe(false);

      // All Settings: the global sheet replaces the Pause card (no destructive Reset mid-fight)
      fireEvent.press(view.getByTestId('pause-all-settings'));
      expect(view.getByTestId('settings-sheet')).toBeTruthy();
      expect(view.queryByText('PAUSED')).toBeNull();
      expect(view.queryByTestId('options-reset-game')).toBeNull();

      // Escape closes Settings first (top of the z-stack), back to Pause; Escape again resumes
      dispatchKey('Escape');
      expect(view.queryByTestId('settings-sheet')).toBeNull();
      expect(view.getByText('PAUSED')).toBeTruthy();
      dispatchKey('Escape');
      expect(view.queryByText('PAUSED')).toBeNull();
    });
  });

  it('Camp replaces the mislabeled Sound toggle with a ≥44px Settings button that opens the global sheet', () => {
    const save = createNewSave();
    const onChange = jest.fn();
    const view = render(wrap(<Camp save={save} history={[]} onChange={onChange} onClose={noop} />));

    expect(view.queryByTestId('camp-toggle-sound')).toBeNull();
    expect(view.queryByText(/^Sound: (on|off)$/)).toBeNull();
    const btn = view.getByTestId('camp-open-settings');
    const style = StyleSheet.flatten(btn.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(view.getAllByLabelText('icon-lorc/gear-hammer').length).toBeGreaterThan(0);
    // Zero raw pictographic emojis in the Camp hub
    expect(/[\u{1F300}-\u{1FAFF}]/u.test(JSON.stringify(view.toJSON()))).toBe(false);

    fireEvent.press(btn);
    expect(view.getByTestId('settings-sheet')).toBeTruthy();

    // Fight Effects stays mirrored into save.effectsOn + FightEffectsStorage
    fireEvent.press(view.getByTestId('options-effects-toggle'));
    expect(FightEffectsStorage.get()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith({ ...save, effectsOn: false });

    // Music stays mirrored into save.musicOn + MusicStorage
    fireEvent.press(view.getByTestId('options-music-toggle'));
    expect(MusicStorage.get()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith({ ...save, musicOn: false });

    fireEvent.press(view.getByTestId('options-done'));
    expect(view.queryByTestId('settings-sheet')).toBeNull();
  });

  it('Camp mirrors its quick Effects switch into FightEffectsStorage', () => {
    const save = createNewSave();
    const onChange = jest.fn();
    const view = render(wrap(<Camp save={save} history={[]} onChange={onChange} onClose={noop} />));
    fireEvent.press(view.getByTestId('camp-toggle-effects'));
    expect(FightEffectsStorage.get()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith({ ...save, effectsOn: false });
  });
});

describe('Seam 3 — AdventureRun desktop keyboard controls on the z-priority stack', () => {
  it('card-slot keys toggle cards, Backspace clears, H hints and S sacrifices', () => {
    withWebPlatform(dispatchKey => {
      const view = renderRun();
      expect(selectedFlags(view).some(Boolean)).toBe(false);

      dispatchKey('1');
      expect(selectedFlags(view)[0]).toBe(true);
      dispatchKey('w'); // QWE/ASD/ZXC spatial alias for slot 2
      expect(selectedFlags(view).slice(0, 2)).toEqual([true, true]);
      dispatchKey('1'); // toggles slot 1 back off
      expect(selectedFlags(view).slice(0, 2)).toEqual([false, true]);

      dispatchKey('Backspace');
      expect(selectedFlags(view).some(Boolean)).toBe(false);

      // H spends a hint exactly like the HUD button
      expect(view.getByTestId('run-hint')).toHaveTextContent('3');
      dispatchKey('h');
      expect(view.getByTestId('run-hint')).toHaveTextContent('2');

      // S sacrifices 1 heart where Sacrifice exists (instead of selecting slot 5)
      expect(view.getByLabelText('4 of 4 hearts')).toBeTruthy();
      dispatchKey('s');
      expect(view.getByLabelText('3 of 4 hearts')).toBeTruthy();
      expect(selectedFlags(view)[4]).toBe(false);
    });
  });

  it('Escape toggles Pause and board keys never fire beneath Pause or a HUD inspector', () => {
    withWebPlatform(dispatchKey => {
      const view = renderRun();

      dispatchKey('Escape');
      expect(view.getByText('PAUSED')).toBeTruthy();
      dispatchKey('1');
      dispatchKey('h');
      expect(selectedFlags(view).some(Boolean)).toBe(false);
      expect(view.getByTestId('run-hint')).toHaveTextContent('3');
      dispatchKey('Escape');
      expect(view.queryByText('PAUSED')).toBeNull();

      fireEvent.press(view.getByTestId('run-foe-inspect'));
      expect(view.getByTestId('hud-inspector-modal')).toBeTruthy();
      dispatchKey('2');
      expect(selectedFlags(view).some(Boolean)).toBe(false);
      dispatchKey('Escape'); // closes the inspector, does not pause
      expect(view.queryByTestId('hud-inspector-modal')).toBeNull();
      expect(view.queryByText('PAUSED')).toBeNull();

      dispatchKey('2');
      expect(selectedFlags(view)[1]).toBe(true);
    });
  });
});
