import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import AdventureMap from '@/adventure/components/AdventureMap';
import AdventureRun from '@/adventure/components/AdventureRun';
import { getLevel } from '@/adventure/data/levels';
import { createRun, runReducer } from '@/adventure/engine/run';
import { createMaxedSave, createNewSave } from '@/adventure/progress';
import Card from '@/components/Card';
import GameBoard from '@/components/GameBoard';
import { EnemyAvatar } from '@/components/enemies/EnemyAvatar';
import { FighterAvatar } from '@/components/fighters/FighterAvatar';
import { useAppActive } from '@/hooks/useAppActive';
import { useAutoHint } from '@/hooks/useAutoHint';
import { useAutoPlayer } from '@/hooks/useAutoPlayer';
import { useBurnTimer } from '@/hooks/useBurnTimer';
import { useGameTimer } from '@/hooks/useGameTimer';
import type { Card as CardType } from '@/types';
import { __setAppActiveForTests, getIsAppActive } from '@/utils/appLifecycle';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import {
  MAX_CONCURRENT_FRAME_LOOPS,
  getPerfSnapshot,
  installPerfWatchdog,
  registerFrameLoop,
  resetPerfViolations,
} from '@/utils/perfWatchdog';

const mockUseFrameCallback = jest.fn();
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default ?? actual,
    useFrameCallback: (...args: unknown[]) => {
      mockUseFrameCallback(...args);
      if (typeof actual.useFrameCallback === 'function') {
        return actual.useFrameCallback(...args);
      }
      return { setActive: jest.fn(), callbackId: 0, isActive: Boolean(args[1] ?? true) };
    },
  };
});

const mockUseBurnTimer = jest.fn();
jest.mock('@/hooks/useBurnTimer', () => {
  const actual = jest.requireActual('@/hooks/useBurnTimer');
  return {
    __esModule: true,
    ...actual,
    useBurnTimer: (...args: unknown[]) => {
      mockUseBurnTimer(...args);
      return actual.useBurnTimer(...args);
    },
  };
});

const mockUseScreenShake = jest.fn();
jest.mock('@/hooks/useScreenShake', () => {
  const actual = jest.requireActual('@/hooks/useScreenShake');
  return {
    __esModule: true,
    ...actual,
    useScreenShake: (...args: unknown[]) => {
      mockUseScreenShake(...args);
      return actual.useScreenShake(...args);
    },
  };
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: Record<string, unknown>) =>
      ReactActual.createElement(View, props, props?.children as React.ReactNode);
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

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const makeParam = () => ({
  value: 0,
  setValueAtTime: jest.fn(),
  linearRampToValueAtTime: jest.fn(),
  exponentialRampToValueAtTime: jest.fn(),
  setTargetAtTime: jest.fn(),
  cancelScheduledValues: jest.fn(),
});

const makeNode = () => ({
  connect: jest.fn((dest: unknown) => dest),
});

function createMockAudioContext() {
  const ctx: Record<string, any> = {
    sampleRate: 22050,
    currentTime: 0,
    state: 'running',
    destination: { channelCount: 2, ...makeNode() },
    createGain: jest.fn(() => ({ gain: makeParam(), ...makeNode() })),
    createDynamicsCompressor: jest.fn(() => ({
      threshold: makeParam(),
      knee: makeParam(),
      ratio: makeParam(),
      attack: makeParam(),
      release: makeParam(),
      ...makeNode(),
    })),
    createBiquadFilter: jest.fn(() => ({
      type: 'lowpass',
      frequency: makeParam(),
      Q: makeParam(),
      ...makeNode(),
    })),
    createConvolver: jest.fn(() => ({ buffer: null, ...makeNode() })),
    createDelay: jest.fn(() => ({ delayTime: makeParam(), ...makeNode() })),
    createStereoPanner: jest.fn(() => ({ pan: makeParam(), ...makeNode() })),
    createOscillator: jest.fn(() => ({
      type: 'sine',
      frequency: makeParam(),
      detune: makeParam(),
      setPeriodicWave: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      ...makeNode(),
    })),
    createBuffer: jest.fn((_channels: number, len: number) => ({
      getChannelData: jest.fn(() => new Float32Array(len)),
    })),
    createBufferSource: jest.fn(() => ({
      buffer: null,
      loop: false,
      start: jest.fn(),
      stop: jest.fn(),
      ...makeNode(),
    })),
    createPeriodicWave: jest.fn(() => ({})),
    suspend: jest.fn(async () => {
      ctx.state = 'suspended';
    }),
    resume: jest.fn(async () => {
      ctx.state = 'running';
    }),
  };
  return ctx;
}

const makeBoardCards = (): CardType[] => {
  const shapes: CardType['shape'][] = ['oval', 'squiggle', 'diamond'];
  const colors: CardType['color'][] = ['red', 'green', 'purple'];
  const shadings: CardType['shading'][] = ['solid', 'striped', 'open'];
  return Array.from({ length: 12 }, (_, idx) => ({
    id: `card-${idx}`,
    shape: shapes[idx % 3],
    color: colors[Math.floor(idx / 3) % 3],
    number: ((idx % 3) + 1) as CardType['number'],
    shading: shadings[(idx + Math.floor(idx / 3)) % 3],
    selected: false,
  }));
};

beforeEach(() => {
  mockUseFrameCallback.mockClear();
  mockUseBurnTimer.mockClear();
  mockUseScreenShake.mockClear();
  resetPerfViolations();
});

afterEach(() => {
  __setAppActiveForTests(true);
  mockUseFrameCallback.mockClear();
  mockUseBurnTimer.mockClear();
  mockUseScreenShake.mockClear();
  resetPerfViolations();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Performance, Battery, and Background Lifecycle', () => {
  describe('appLifecycle & useAppActive', () => {
    it('tracks __setAppActiveForTests and notifies useAppActive subscribers', () => {
      const { result } = renderHook(() => useAppActive());
      expect(result.current).toBe(true);
      expect(getIsAppActive()).toBe(true);

      act(() => {
        __setAppActiveForTests(false);
      });
      expect(result.current).toBe(false);
      expect(getIsAppActive()).toBe(false);

      act(() => {
        __setAppActiveForTests(true);
      });
      expect(result.current).toBe(true);
    });

    it('responds to Web visibilitychange, pagehide, and pageshow events', () => {
      const origOs = Platform.OS;
      const origWindow = Object.getOwnPropertyDescriptor(global, 'window');
      const origDocument = Object.getOwnPropertyDescriptor(global, 'document');
      const docListeners: Record<string, (() => void)[]> = {};
      const winListeners: Record<string, (() => void)[]> = {};

      const mockDocument = {
        visibilityState: 'visible',
        addEventListener: jest.fn((evt: string, fn: () => void) => {
          docListeners[evt] = docListeners[evt] ?? [];
          docListeners[evt].push(fn);
        }),
      };
      const mockWindow = {
        addEventListener: jest.fn((evt: string, fn: () => void) => {
          winListeners[evt] = winListeners[evt] ?? [];
          winListeners[evt].push(fn);
        }),
      };

      try {
        Platform.OS = 'web';
        Object.defineProperty(global, 'document', { value: mockDocument, configurable: true, writable: true });
        Object.defineProperty(global, 'window', { value: mockWindow, configurable: true, writable: true });

        let lifecycleMod!: typeof import('@/utils/appLifecycle');
        jest.isolateModules(() => {
          lifecycleMod = require('@/utils/appLifecycle');
        });

        expect(lifecycleMod.getIsAppActive()).toBe(true);

        mockDocument.visibilityState = 'hidden';
        docListeners.visibilitychange.forEach(fn => fn());
        expect(lifecycleMod.getIsAppActive()).toBe(false);

        mockDocument.visibilityState = 'visible';
        winListeners.pageshow.forEach(fn => fn());
        expect(lifecycleMod.getIsAppActive()).toBe(true);

        winListeners.pagehide.forEach(fn => fn());
        expect(lifecycleMod.getIsAppActive()).toBe(false);

        docListeners.resume.forEach(fn => fn());
        expect(lifecycleMod.getIsAppActive()).toBe(true);

        docListeners.freeze.forEach(fn => fn());
        expect(lifecycleMod.getIsAppActive()).toBe(false);
      } finally {
        Platform.OS = origOs;
        if (origWindow) Object.defineProperty(global, 'window', origWindow);
        else delete (global as Record<string, unknown>).window;
        if (origDocument) Object.defineProperty(global, 'document', origDocument);
        else delete (global as Record<string, unknown>).document;
      }
    });
  });

  describe('Web Audio background silence & resume', () => {
    it('suspends AudioContext and prevents the 1-note-per-3s background leak, then resumes in foreground', async () => {
      jest.useFakeTimers();
      const origOs = Platform.OS;
      const origWindow = Object.getOwnPropertyDescriptor(global, 'window');
      const origDocument = Object.getOwnPropertyDescriptor(global, 'document');
      const origNav = Object.getOwnPropertyDescriptor(global, 'navigator');

      const mockCtx = createMockAudioContext();
      const MockAudioCtor = jest.fn(() => mockCtx);
      const mockNav = { audioSession: { type: 'ambient' } };
      const mockDocument = {
        visibilityState: 'visible',
        addEventListener: jest.fn(),
      };
      const mockWindow = {
        AudioContext: MockAudioCtor,
        addEventListener: jest.fn(),
      };

      let lifecycleMod!: typeof import('@/utils/appLifecycle');
      let audioMod!: typeof import('@/audio');
      let chipMod!: typeof import('@/audio/chip');

      try {
        Platform.OS = 'web';
        Object.defineProperty(global, 'document', { value: mockDocument, configurable: true, writable: true });
        Object.defineProperty(global, 'window', { value: mockWindow, configurable: true, writable: true });
        Object.defineProperty(global, 'navigator', { value: mockNav, configurable: true, writable: true });

        jest.isolateModules(() => {
          lifecycleMod = require('@/utils/appLifecycle');
          chipMod = require('@/audio/chip');
          audioMod = require('@/audio');
        });

        lifecycleMod.__setAppActiveForTests(true);
        audioMod.setMusicEnabled(true);
        audioMod.setSfxEnabled(true);
        audioMod.unlockAudio();
        audioMod.music.play('map');

        // Advance time in foreground so the sequencer emits notes
        for (let i = 0; i < 6; i++) {
          mockCtx.currentTime += 0.05;
          jest.advanceTimersByTime(50);
        }
        const voicesWhileActive = chipMod.chip.voiceCount;
        expect(voicesWhileActive).toBeGreaterThan(0);
        expect(mockNav.audioSession.type).toBe('playback');

        // Background transition: band must halt, context must suspend, audioSession yields
        lifecycleMod.__setAppActiveForTests(false);
        expect(mockCtx.suspend).toHaveBeenCalledTimes(1);
        expect(mockCtx.state).toBe('suspended');
        expect(mockNav.audioSession.type).toBe('ambient');

        // Simulate 15s of background iOS timer wakeups (~every 3s)
        for (let i = 0; i < 5; i++) {
          mockCtx.currentTime += 3;
          jest.advanceTimersByTime(3000);
        }
        audioMod.sfx('click');
        expect(chipMod.chip.voiceCount).toBe(voicesWhileActive);

        // Foreground return: context resumes and band picks back up
        mockCtx.resume.mockClear();
        lifecycleMod.__setAppActiveForTests(true);
        await Promise.resolve();
        await Promise.resolve();
        expect(mockCtx.resume).toHaveBeenCalledTimes(1);
        expect(mockCtx.state).toBe('running');

        for (let i = 0; i < 6; i++) {
          mockCtx.currentTime += 0.05;
          jest.advanceTimersByTime(50);
        }
        expect(chipMod.chip.voiceCount).toBeGreaterThan(voicesWhileActive);

        // Muting both music and sfx suspends the live AudioContext so DSP nodes idle cleanly
        mockCtx.suspend.mockClear();
        audioMod.setMusicEnabled(false);
        audioMod.setSfxEnabled(false);
        expect(mockCtx.suspend).toHaveBeenCalledTimes(1);
        expect(mockNav.audioSession.type).toBe('ambient');
      } finally {
        audioMod?.music.stop();
        Platform.OS = origOs;
        if (origWindow) Object.defineProperty(global, 'window', origWindow);
        else delete (global as Record<string, unknown>).window;
        if (origDocument) Object.defineProperty(global, 'document', origDocument);
        else delete (global as Record<string, unknown>).document;
        if (origNav) Object.defineProperty(global, 'navigator', origNav);
        else delete (global as Record<string, unknown>).navigator;
      }
    });
  });

  describe('AdventureRun background auto-pause', () => {
    it('auto-pauses timed fights and stops the tick clock when backgrounded', () => {
      jest.useFakeTimers();
      const maxed = createMaxedSave();
      const save = {
        ...createNewSave(),
        seenMechanics: maxed.seenMechanics,
        seenCoachMarks: maxed.seenCoachMarks,
      };
      const level = getLevel('2-3'); // 60s timed fight

      const { getByTestId, getByText, queryByText } = render(
        <SafeAreaProvider initialMetrics={SAFE_METRICS}>
          <AdventureRun
            level={level}
            save={save}
            seed={42}
            effects={false}
            onFinish={jest.fn()}
            onQuit={jest.fn()}
            onRestart={jest.fn()}
            onCoachMarkSeen={jest.fn()}
          />
        </SafeAreaProvider>
      );

      expect(queryByText('PAUSED')).toBeNull();
      const initialClock = getByTestId('run-clock').props.accessibilityLabel;
      expect(initialClock).toMatch(/^\d+ seconds left$/);

      act(() => {
        jest.advanceTimersByTime(2000);
      });
      const afterTwoSecClock = getByTestId('run-clock').props.accessibilityLabel;
      expect(afterTwoSecClock).not.toBe(initialClock);

      act(() => {
        __setAppActiveForTests(false);
      });
      expect(getByText('PAUSED')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(10000);
      });
      // Clock must not advance while backgrounded/paused
      expect(getByTestId('run-clock').props.accessibilityLabel).toBe(afterTwoSecClock);
    });
  });

  describe('Creature & Avatar animation gating', () => {
    it('disables useFrameCallback in lightweight mode and when app is backgrounded', () => {
      const bunny = { name: 'Dozy Bunny', icon: 'delapouite/rabbit', tier: 1 } as const;
      render(<EnemyAvatar enemy={bunny} lightweight />);
      expect(mockUseFrameCallback).toHaveBeenCalled();
      expect(mockUseFrameCallback.mock.calls.every(call => call[1] === false)).toBe(true);

      mockUseFrameCallback.mockClear();
      render(<EnemyAvatar enemy={bunny} />);
      expect(mockUseFrameCallback.mock.calls.some(call => call[1] === true)).toBe(true);

      mockUseFrameCallback.mockClear();
      act(() => {
        __setAppActiveForTests(false);
      });
      expect(mockUseFrameCallback).toHaveBeenCalled();
      expect(mockUseFrameCallback.mock.calls.every(call => call[1] === false)).toBe(true);

      mockUseFrameCallback.mockClear();
      act(() => {
        __setAppActiveForTests(true);
      });
      render(<FighterAvatar character="Orange Tabby" />);
      expect(mockUseFrameCallback.mock.calls.some(call => call[1] === true)).toBe(true);

      mockUseFrameCallback.mockClear();
      act(() => {
        __setAppActiveForTests(false);
      });
      expect(mockUseFrameCallback).toHaveBeenCalled();
      expect(mockUseFrameCallback.mock.calls.every(call => call[1] === false)).toBe(true);
    });
  });

  describe('GameBoard one-shot idle timer & Card memoization', () => {
    it('fires onBoardIdleChange once at 8000ms without polling and respects isPaused', () => {
      jest.useFakeTimers();
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const cards = makeBoardCards();
      const onIdle = jest.fn();

      setIntervalSpy.mockClear();
      render(
        <GameBoard
          cards={cards}
          onMatch={jest.fn()}
          onInvalidSelection={jest.fn()}
          playerStats={DEFAULT_PLAYER_STATS}
          isPlayerTurn={true}
          onBoardIdleChange={onIdle}
        />
      );

      // Zero 1Hz idle polling intervals registered by GameBoard
      expect(setIntervalSpy.mock.calls.some(call => call[1] === 1000)).toBe(false);
      expect(onIdle).toHaveBeenLastCalledWith(false);

      act(() => {
        jest.advanceTimersByTime(7900);
      });
      expect(onIdle).not.toHaveBeenCalledWith(true);

      act(() => {
        jest.advanceTimersByTime(150);
      });
      expect(onIdle).toHaveBeenCalledWith(true);
      const callsAtIdle = onIdle.mock.calls.length;

      act(() => {
        jest.advanceTimersByTime(10000);
      });
      expect(onIdle.mock.calls.length).toBe(callsAtIdle);

      const pausedIdle = jest.fn();
      render(
        <GameBoard
          cards={cards}
          onMatch={jest.fn()}
          onInvalidSelection={jest.fn()}
          playerStats={DEFAULT_PLAYER_STATS}
          isPlayerTurn={true}
          isPaused={true}
          onBoardIdleChange={pausedIdle}
        />
      );
      act(() => {
        jest.advanceTimersByTime(15000);
      });
      expect(pausedIdle).not.toHaveBeenCalledWith(true);
    });

    it('skips Card re-render on shallow-equal cloned card props', () => {
      const card = makeBoardCards()[0];
      const onClick = jest.fn();

      const { rerender } = render(<Card card={card} onClick={onClick} />);
      expect(mockUseBurnTimer).toHaveBeenCalledTimes(1);

      rerender(<Card card={{ ...card }} onClick={onClick} />);
      expect(mockUseBurnTimer).toHaveBeenCalledTimes(1);

      rerender(<Card card={{ ...card, selected: true }} onClick={onClick} />);
      expect(mockUseBurnTimer).toHaveBeenCalledTimes(2);
    });
  });

  describe('Render isolation & reducer structural-sharing budgets', () => {
    it('keeps GameBoard and all 12 Cards at 0 re-renders across 10 AdventureRun 250ms clock ticks', () => {
      jest.useFakeTimers();
      const maxed = createMaxedSave();
      const save = {
        ...createNewSave(),
        seenMechanics: maxed.seenMechanics,
        seenCoachMarks: maxed.seenCoachMarks,
      };
      const level = getLevel('2-3');

      let commits = 0;
      const onQuit = jest.fn();
      const onFinish = jest.fn();
      const onRestart = jest.fn();
      const onCoachMarkSeen = jest.fn();

      const { getByTestId } = render(
        <SafeAreaProvider initialMetrics={SAFE_METRICS}>
          <React.Profiler id="AdventureRun" onRender={() => { commits += 1; }}>
            <AdventureRun
              level={level}
              save={save}
              seed={42}
              effects={false}
              onFinish={onFinish}
              onQuit={onQuit}
              onRestart={onRestart}
              onCoachMarkSeen={onCoachMarkSeen}
            />
          </React.Profiler>
        </SafeAreaProvider>
      );

      const initialClock = getByTestId('run-clock').props.accessibilityLabel;
      commits = 0;
      mockUseScreenShake.mockClear();
      mockUseBurnTimer.mockClear();

      for (let i = 0; i < 10; i++) {
        act(() => {
          jest.advanceTimersByTime(250);
        });
      }

      expect(commits).toBeGreaterThanOrEqual(8);
      expect(getByTestId('run-clock').props.accessibilityLabel).not.toBe(initialClock);
      expect(mockUseScreenShake).toHaveBeenCalledTimes(0);
      expect(mockUseBurnTimer).toHaveBeenCalledTimes(0);
    });

    it('re-renders only the clicked Card (never all 12 Cards) when selecting a single card on GameBoard', () => {
      const cards = makeBoardCards();
      const { getAllByTestId } = render(
        <GameBoard
          cards={cards}
          onMatch={jest.fn()}
          onInvalidSelection={jest.fn()}
          playerStats={DEFAULT_PLAYER_STATS}
          isPlayerTurn={true}
        />
      );

      mockUseBurnTimer.mockClear();
      fireEvent.press(getAllByTestId('card-oval-red-1-solid')[0]);

      expect(mockUseBurnTimer.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(mockUseBurnTimer.mock.calls.length).toBeLessThanOrEqual(2);
    });

    it('preserves strict === reference identity on board, connections, events, stats, weapons, attributes, and foe across 20 TICKs', () => {
      const initial = createRun(getLevel('2-3'), createNewSave(), { seed: 42 });
      let cur = initial;
      for (let i = 0; i < 20; i++) {
        cur = runReducer(cur, { type: 'TICK', ms: 250 });
      }

      expect(cur.elapsedMs).toBe(initial.elapsedMs + 5000);
      expect(cur.board).toBe(initial.board);
      expect(cur.connections).toBe(initial.connections);
      expect(cur.events).toBe(initial.events);
      expect(cur.stats).toBe(initial.stats);
      expect(cur.weapons).toBe(initial.weapons);
      expect(cur.attributes).toBe(initial.attributes);
      expect(cur.foe).toBe(initial.foe);
    });
  });

  describe('perfWatchdog frame-loop & background zero-work budgets', () => {
    it('caps 60-node AdventureMap concurrent frame loops at <= 6 when active and drops to 0 when inactive', () => {
      const maxed = createMaxedSave();
      const onSelectLevel = jest.fn();
      const onOpenCamp = jest.fn();
      const onOpenGuide = jest.fn();
      const onExit = jest.fn();

      const { rerender, unmount } = render(
        <SafeAreaProvider initialMetrics={SAFE_METRICS}>
          <AdventureMap
            save={maxed}
            onSelectLevel={onSelectLevel}
            onOpenCamp={onOpenCamp}
            onOpenGuide={onOpenGuide}
            onExit={onExit}
            active={true}
          />
        </SafeAreaProvider>
      );

      const snap = getPerfSnapshot();
      expect(snap.activeFrameLoops).toBeGreaterThan(0);
      expect(snap.activeFrameLoops).toBeLessThanOrEqual(6);
      expect(snap.violations).toEqual([]);

      rerender(
        <SafeAreaProvider initialMetrics={SAFE_METRICS}>
          <AdventureMap
            save={maxed}
            onSelectLevel={onSelectLevel}
            onOpenCamp={onOpenCamp}
            onOpenGuide={onOpenGuide}
            onExit={onExit}
            active={false}
          />
        </SafeAreaProvider>
      );

      expect(getPerfSnapshot().activeFrameLoops).toBe(0);

      unmount();
      expect(getPerfSnapshot().activeFrameLoops).toBe(0);
    });

    it('drops all Free Play timer intervals and frame loops to 0 with zero watchdog violations when backgrounded', () => {
      jest.useFakeTimers();
      const stopWatchdog = installPerfWatchdog();
      const cards = makeBoardCards();
      const onTick = jest.fn();
      const onTrigger = jest.fn();
      const onSelectCard = jest.fn();

      const TimerHarness: React.FC = () => {
        useGameTimer(true, onTick);
        useBurnTimer({ isOnFire: true, fireStartTime: 1000, isPaused: false });
        useAutoHint({
          autoHintChance: 50,
          autoHintInterval: 0,
          isPaused: false,
          hasActiveHint: false,
          lastMatchTime: 1000,
          onTrigger,
        });
        useAutoPlayer({
          isActive: true,
          isPaused: false,
          cards,
          activeAttributes: ['shape', 'color', 'number', 'shading'],
          matchedCardIds: [],
          graces: 0,
          onSelectCard,
        });
        return <FighterAvatar character="Orange Tabby" />;
      };

      try {
        render(<TimerHarness />);

        const fgSnap = getPerfSnapshot();
        expect(fgSnap.activeIntervals).toBeGreaterThanOrEqual(4);
        expect(fgSnap.activeFrameLoops).toBeGreaterThan(0);

        act(() => {
          __setAppActiveForTests(false);
        });
        act(() => {
          jest.advanceTimersByTime(15000);
        });

        const bgSnap = getPerfSnapshot();
        expect(bgSnap.activeFrameLoops).toBe(0);
        expect(bgSnap.activeIntervals).toBe(0);
        expect(bgSnap.violations).toEqual([]);
      } finally {
        stopWatchdog();
      }
    });

    it('flags excessive-frame-loops when concurrent frame loops exceed MAX_CONCURRENT_FRAME_LOOPS', () => {
      const cleanups: (() => void)[] = [];
      for (let i = 0; i < MAX_CONCURRENT_FRAME_LOOPS + 1; i++) {
        cleanups.push(registerFrameLoop(`test-leak-${i}`));
      }

      expect(getPerfSnapshot().violations.some(v => v.kind === 'excessive-frame-loops')).toBe(true);

      cleanups.forEach(fn => fn());
      expect(getPerfSnapshot().activeFrameLoops).toBe(0);
      resetPerfViolations();
    });
  });
});
