import React from 'react';
import { Linking, Platform, Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import OptionsMenu from '@/components/OptionsMenu';
import { Chip } from '@/audio/chip';
import { __setAppActiveForTests } from '@/utils/appLifecycle';
import { SettingsStorage, storage } from '@/utils/storage';
import { loadPrismMeta, loadPrismRun, writePrismMeta, writePrismRun } from '@/prism/save';
import { createRun } from '@/prism/engine/run';
import { PRIVACY_POLICY_URL, SUPPORT_URL } from '@/utils/storeUrls';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import {
  CARD_DARK_COLORS,
  CARD_LIGHT_COLORS,
  CARD_SHAPE_GEOMETRY,
  CARD_STOCK_BACKGROUND,
  COLOR_BADGE_LETTER,
  COLOR_DISPLAY_NAME,
  SHAPE_DISPLAY_NAME,
  formatParryCounterMeta,
  getCardShapeColor,
} from '@/utils/cardVisuals';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { name: string }) =>
      ReactActual.createElement(View, { accessibilityLabel: `icon-${props.name}` }),
  };
});

describe('Mobile Store Readiness', () => {
  beforeEach(() => {
    storage.clearAll();
    jest.clearAllMocks();
    __setAppActiveForTests(true);
  });

  describe('AppErrorBoundary', () => {
    it('renders recovery UI when a child throws and recovers on retry', () => {
      let shouldThrow = true;
      const Boom = () => {
        if (shouldThrow) throw new Error('Simulated render crash');
        return <Text testID="recovered-child">All Good</Text>;
      };

      const view = render(
        <AppErrorBoundary>
          <Boom />
        </AppErrorBoundary>
      );

      expect(view.getByTestId('app-error-boundary')).toBeTruthy();
      expect(view.getByText(/Simulated render crash/)).toBeTruthy();

      shouldThrow = false;
      fireEvent.press(view.getByTestId('error-boundary-retry'));
      expect(view.getByTestId('recovered-child')).toBeTruthy();
    });
  });

  describe('OptionsMenu store compliance', () => {
    it('opens Privacy Policy and Support URLs and displays store + build version', () => {
      const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      const view = render(<OptionsMenu visible onClose={() => {}} />);

      fireEvent.press(view.getByTestId('options-privacy-link'));
      expect(openUrlSpy).toHaveBeenCalledWith(PRIVACY_POLICY_URL);

      fireEvent.press(view.getByTestId('options-support-link'));
      expect(openUrlSpy).toHaveBeenCalledWith(SUPPORT_URL);

      expect(view.getByTestId('options-version')).toBeTruthy();
      openUrlSpy.mockRestore();
    });

    it('also resets Prism Deck saved runs and career meta on Reset Game', () => {
      const run = createRun({ seed: 'TEST1' });
      writePrismRun(run);
      writePrismMeta({
        ...loadPrismMeta(),
        totalRuns: 5,
        victories: 2,
      });
      expect(loadPrismRun()).not.toBeNull();
      expect(loadPrismMeta().totalRuns).toBe(5);

      const view = render(<OptionsMenu visible onClose={() => {}} />);
      fireEvent.press(view.getByTestId('options-reset-game'));
      fireEvent.press(view.getByTestId('options-reset-confirm'));

      expect(loadPrismRun()).toBeNull();
      expect(loadPrismMeta().totalRuns).toBe(0);
    });
  });

  describe('Native audio defaults and soft-clipper fallback', () => {
    it('defaults sound enabled to true across platforms when unset', () => {
      expect(SettingsStorage.getSoundEnabled()).toBe(true);
    });

    it('wires Chip cleanly with WaveShaperNode fallback when createDynamicsCompressor is absent (react-native-audio-api)', () => {
      const makeParam = () => ({
        value: 0,
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        setTargetAtTime: jest.fn(),
        cancelScheduledValues: jest.fn(),
      });
      const makeNode = () => {
        const node: Record<string, unknown> = {
          gain: makeParam(),
          frequency: makeParam(),
          Q: makeParam(),
          delayTime: makeParam(),
          detune: makeParam(),
          type: 'lowpass',
          curve: null,
          oversample: 'none',
          buffer: null,
          connect: jest.fn((dest: unknown) => dest),
        };
        return node;
      };

      const fakeWaveShaper = makeNode();
      const fakeCtx = {
        sampleRate: 44100,
        currentTime: 0,
        destination: { channelCount: 2 },
        createGain: jest.fn(() => makeNode()),
        createBiquadFilter: jest.fn(() => makeNode()),
        createWaveShaper: jest.fn(() => fakeWaveShaper),
        createConvolver: jest.fn(() => makeNode()),
        createDelay: jest.fn(() => makeNode()),
        createPeriodicWave: jest.fn(() => ({})),
        createBuffer: jest.fn((channels: number, len: number) => ({
          getChannelData: () => new Float32Array(len),
          numberOfChannels: channels,
        })),
        // Intentionally omit createDynamicsCompressor to mirror react-native-audio-api
      } as unknown as BaseAudioContext;

      const c = new Chip();
      const restore = c.useContext(fakeCtx);
      try {
        expect(fakeCtx.createWaveShaper).toHaveBeenCalledTimes(1);
        expect(fakeWaveShaper.curve).toBeInstanceOf(Float32Array);
        expect((fakeWaveShaper.curve as Float32Array).length).toBe(256);
      } finally {
        restore();
      }
    });
  });

  describe('useAndroidBackHandler', () => {
    it('registers and cleans up BackHandler listener only on Android', () => {
      const BackHandler = require('react-native').BackHandler;
      const remove = jest.fn();
      const addSpy = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
      const origOs = Platform.OS;

      const Harness = ({ cb, enabled = true }: { cb: () => boolean; enabled?: boolean }) => {
        useAndroidBackHandler(cb, enabled);
        return null;
      };

      try {
        (Platform as { OS: string }).OS = 'ios';
        const iosView = render(<Harness cb={() => true} />);
        expect(addSpy).not.toHaveBeenCalled();
        iosView.unmount();

        (Platform as { OS: string }).OS = 'android';
        const cb = jest.fn(() => true);
        const androidView = render(<Harness cb={cb} />);
        expect(addSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
        const registered = addSpy.mock.calls[0][1] as () => boolean;
        expect(registered()).toBe(true);
        expect(cb).toHaveBeenCalledTimes(1);
        androidView.unmount();
        expect(remove).toHaveBeenCalledTimes(1);
      } finally {
        (Platform as { OS: string }).OS = origOs;
        addSpy.mockRestore();
      }
    });
  });

  describe('Zero-SET-overlap visual identity (cardVisuals)', () => {
    it('maps internal slots to Circle/Triangle/Bolt and Orange/Blue/Pink with O/B/P badges', () => {
      expect(SHAPE_DISPLAY_NAME).toEqual({
        oval: 'Circle',
        diamond: 'Triangle',
        squiggle: 'Bolt',
      });
      expect(COLOR_DISPLAY_NAME).toEqual({
        red: 'Orange',
        green: 'Blue',
        purple: 'Pink',
      });
      expect(COLOR_BADGE_LETTER).toEqual({
        red: 'O',
        green: 'B',
        purple: 'P',
      });
    });

    it('uses verified universal CVD-safe light/dark hexes and Blueprint Mist stock', () => {
      expect(CARD_LIGHT_COLORS).toEqual({
        red: '#DF5A00',
        green: '#007ED9',
        purple: '#940E65',
      });
      expect(CARD_DARK_COLORS).toEqual({
        red: '#FFAC24',
        green: '#7CE4FF',
        purple: '#E6459E',
      });
      expect(CARD_STOCK_BACKGROUND.beige).toBe('#E2ECF7');
      expect(getCardShapeColor('red', 'white')).toBe('#DF5A00');
      expect(getCardShapeColor('green', 'charcoal')).toBe('#7CE4FF');
      expect(getCardShapeColor('purple', 'charcoal')).toBe('#E6459E');
    });

    it('formats Parry counter labels with Trio, Orange/Blue/Pink, and Circles/Triangles/Bolts', () => {
      expect(formatParryCounterMeta({ kind: 'any' }).shortLabel).toBe('ANY TRIO');
      expect(formatParryCounterMeta({ kind: 'color', color: 'red' })).toMatchObject({
        shortLabel: 'ALL ORANGE',
        label: 'All Orange Trio',
        color: '#DF5A00',
      });
      expect(formatParryCounterMeta({ kind: 'color', color: 'green' }).shortLabel).toBe('ALL BLUE');
      expect(formatParryCounterMeta({ kind: 'color', color: 'purple' }).shortLabel).toBe('ALL PINK');
      expect(formatParryCounterMeta({ kind: 'shape', shape: 'oval' }).shortLabel).toBe('ALL CIRCLES');
      expect(formatParryCounterMeta({ kind: 'shape', shape: 'diamond' }).shortLabel).toBe('ALL TRIANGLES');
      expect(formatParryCounterMeta({ kind: 'shape', shape: 'squiggle' }).shortLabel).toBe('ALL BOLTS');
    });

    it('uses a pointed 6-vertex Pokemon-style lightning bolt centered in the 24x30 viewBox without clipping', () => {
      const vertices = CARD_SHAPE_GEOMETRY.boltPoints
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(',').map(Number) as [number, number]);

      expect(vertices).toHaveLength(6);
      for (const [x, y] of vertices) {
        expect(x).toBeGreaterThanOrEqual(1.1);
        expect(x).toBeLessThanOrEqual(22.9);
        expect(y).toBeGreaterThanOrEqual(1.1);
        expect(y).toBeLessThanOrEqual(28.9);
      }

      // Single pointed top apex and single pointed bottom apex (no flat horizontal bars)
      const minY = Math.min(...vertices.map(([, y]) => y));
      const maxY = Math.max(...vertices.map(([, y]) => y));
      expect(vertices.filter(([, y]) => Math.abs(y - minY) < 0.01)).toHaveLength(1);
      expect(vertices.filter(([, y]) => Math.abs(y - maxY) < 0.01)).toHaveLength(1);

      // 180-degree rotational symmetry around viewBox center (12, 15)
      for (let i = 0; i < 3; i++) {
        const [x1, y1] = vertices[i];
        const [x2, y2] = vertices[i + 3];
        expect((x1 + x2) / 2).toBeCloseTo(12, 4);
        expect((y1 + y2) / 2).toBeCloseTo(15, 4);
      }
    });
  });
});
