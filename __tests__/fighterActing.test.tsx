import React from 'react';
import { render, renderHook, fireEvent, act } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { Svg } from 'react-native-svg';
import MainMenu from '@/components/MainMenu';
import type { ReactionChannels } from '@/components/creatures/types';
import { useCreatureMotion } from '@/components/creatures/useCreatureMotion';
import { CreatureEyes } from '@/components/fighters/creatures/FacialFeatures';
import {
  FIGHTER_MOTION,
  FighterAvatar,
  getFighterThrowWindMs,
} from '@/components/fighters/FighterAvatar';
import { FighterBuildAura, deriveBuildTheme } from '@/components/fighters/FighterBuildAura';
import { FighterEffectsOverlay } from '@/components/fighters/FighterEffectsOverlay';
import {
  FIGHTER_ATLAS_COLS,
  FIGHTER_ATLAS_MAX_INDEX,
  FIGHTER_ATLAS_ROWS,
  FIGHTER_CLIPS,
  FIGHTER_CLIP_DURATION_MS,
  FIGHTER_IDLE_FRAME_COUNT,
  FIGHTER_SPRITE_ATLASES,
  FighterSpriteRig,
  getSpriteMoodTempo,
  hasFighterSpriteAtlas,
} from '@/components/fighters/FighterSpriteRig';
import {
  getFighterMassClass,
  getFighterPersonality,
  getFighterPivots,
  getFighterSpeciesChoreography,
  getFighterSpeciesFidget,
} from '@/components/fighters/fighterRegistry';
import { CHARACTERS } from '@/utils/gameDefinitions';
import {
  ACCESSIBLE,
  CHEER,
  HIT,
  MODAL_MOTION,
  OVERLAP,
  SMEAR,
  SPRITE_TX,
  SQUASH_TIER,
  THROW,
} from '@/utils/motion';

const mockWithTiming = jest.fn();
const mockWithDelay = jest.fn();
const mockWithRepeat = jest.fn();
const mockCancelAnimation = jest.fn();
let mockAppActive = true;
let mockReducedMotion = false;
let mockFrameCallbackCalls: boolean[] = [];
let mockCapturedFrameCallbacks: {
  cb: (info: { timeSincePreviousFrame: number | null }) => void;
  active: boolean;
}[] = [];
let mockCapturedAnimatedStyleFns: (() => Record<string, unknown>)[] = [];

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { name: string }) =>
      ReactActual.createElement(View, { accessibilityLabel: `icon-${props.name}` }),
  };
});

jest.mock('@/hooks/useAppActive', () => ({
  useAppActive: () => mockAppActive,
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock('@/hooks/useGuardedFrameCallback', () => ({
  useGuardedFrameCallback: (
    cb: (info: { timeSincePreviousFrame: number | null }) => void,
    autostart = true
  ) => {
    const active = Boolean(autostart) && mockAppActive;
    mockFrameCallbackCalls.push(active);
    mockCapturedFrameCallbacks.push({ cb, active });
    return { setActive: jest.fn(), callbackId: 0, isActive: active };
  },
}));

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default ?? actual,
    withTiming: (...args: unknown[]) => {
      mockWithTiming(...args);
      return actual.withTiming(...args);
    },
    withDelay: (...args: unknown[]) => {
      mockWithDelay(...args);
      return actual.withDelay(...args);
    },
    withRepeat: (...args: unknown[]) => {
      mockWithRepeat(...args);
      return actual.withRepeat(...args);
    },
    cancelAnimation: (...args: unknown[]) => {
      mockCancelAnimation(...args);
      return actual.cancelAnimation(...args);
    },
    useAnimatedStyle: (fn: () => Record<string, unknown>, ...rest: unknown[]) => {
      mockCapturedAnimatedStyleFns.push(fn);
      return actual.useAnimatedStyle(fn, ...rest);
    },
  };
});

type JsonNode = {
  type?: string;
  props?: Record<string, unknown>;
  children?: (JsonNode | string)[] | null;
};

function collectSvgPaths(node: JsonNode | JsonNode[] | string | null | undefined, out: string[] = []): string[] {
  if (!node || typeof node === 'string') return out;
  if (Array.isArray(node)) {
    for (const c of node) collectSvgPaths(c, out);
    return out;
  }
  if (node.type === 'Path' && typeof node.props?.d === 'string') {
    out.push(node.props.d);
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) collectSvgPaths(c, out);
  }
  return out;
}

function makeFullChannels(): ReactionChannels {
  const sv = (initial: number) => ({ value: initial }) as unknown as SharedValue<number>;
  return {
    bodyTx: sv(0),
    bodyTy: sv(0),
    reactionScaleY: sv(1),
    bodyRotate: sv(0),
    headRotate: sv(0),
    headTy: sv(0),
    leftEarExtra: sv(0),
    rightEarExtra: sv(0),
    tailExtra: sv(0),
    pawBounce: sv(0),
    pawTx: sv(0),
    pawRotate: sv(0),
    headTx: sv(0),
    scaleX: sv(1),
    bodySkewX: sv(0),
  };
}

describe('Lane 1 — Hero Fighter Species Acting, 3-Step Blinks, Lightweight Breath & Polish', () => {
  beforeEach(() => {
    mockAppActive = true;
    mockReducedMotion = false;
    mockFrameCallbackCalls = [];
    mockCapturedFrameCallbacks = [];
    mockCapturedAnimatedStyleFns = [];
    mockWithTiming.mockClear();
    mockWithDelay.mockClear();
    mockWithRepeat.mockClear();
    mockCancelAnimation.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('1. 3-Step Organic Upper-Eyelid Blinks (`FacialFeatures.tsx`)', () => {
    it('renders distinct SVG geometry for blinkStage 0 (open), 1 (HalfBlinkLidEye), and 2 (ShutBlinkEye)', () => {
      const open = render(
        <Svg viewBox="0 0 100 100">
          <CreatureEyes expression="normal" blinkStage={0} lidFill="#FF9538" />
        </Svg>
      );
      const half = render(
        <Svg viewBox="0 0 100 100">
          <CreatureEyes expression="normal" blinkStage={1} lidFill="#FF9538" />
        </Svg>
      );
      const shut = render(
        <Svg viewBox="0 0 100 100">
          <CreatureEyes expression="normal" blinkStage={2} lidFill="#FF9538" />
        </Svg>
      );

      const openPaths = collectSvgPaths(open.toJSON() as JsonNode);
      const halfPaths = collectSvgPaths(half.toJSON() as JsonNode);
      const shutPaths = collectSvgPaths(shut.toJSON() as JsonNode);

      // Open normal eyes are Circles (0 Path arcs); Stage 1 renders lid fill + iris crescent + upper lid arc (>= 6 paths); Stage 2 renders 2 shut arcs
      expect(openPaths.length).toBe(0);
      expect(halfPaths.length).toBeGreaterThanOrEqual(4);
      expect(shutPaths.length).toBe(2);
      expect(halfPaths).not.toEqual(shutPaths);

      open.unmount();
      half.unmount();
      shut.unmount();
    });

    it('preserves high-priority expressions (happy, wince, ko) even if blinkStage is non-zero', () => {
      const happy0 = render(
        <Svg viewBox="0 0 100 100">
          <CreatureEyes expression="happy" blinkStage={0} />
        </Svg>
      );
      const happy1 = render(
        <Svg viewBox="0 0 100 100">
          <CreatureEyes expression="happy" blinkStage={1} />
        </Svg>
      );
      expect(collectSvgPaths(happy1.toJSON() as JsonNode)).toEqual(
        collectSvgPaths(happy0.toJSON() as JsonNode)
      );
      happy0.unmount();
      happy1.unmount();
    });
  });

  describe('2. Distinct Species-Specific Choreography, Fidgets & Mass Classes (All 6 Fighters)', () => {
    it('assigns exact Disney-12 mass classes to all 6 fighters', () => {
      expect(getFighterMassClass('Orange Tabby')).toBe('standard');
      expect(getFighterMassClass('Sly Fox')).toBe('nimble');
      expect(getFighterMassClass('Badger')).toBe('heavy');
      expect(getFighterMassClass('Corgi')).toBe('nimble');
      expect(getFighterMassClass('Emperor Penguin')).toBe('standard');
      expect(getFighterMassClass('Pelican')).toBe('standard');
      expect(getFighterMassClass('Unknown')).toBe('standard');
    });

    it('executes distinct species throw choreographies across all 6 fighters using Phase 0 channels', () => {
      const signatures = new Map<string, number[]>();

      for (const char of CHARACTERS) {
        const choreo = getFighterSpeciesChoreography(char.name);
        expect(choreo).toBeDefined();

        mockWithTiming.mockClear();
        const ch = makeFullChannels();
        const handled = choreo!('throw', ch, 80, { chain: 0, intensity: 0, compact: false });
        expect(handled).toBe(true);

        const targets = mockWithTiming.mock.calls.map(([v]) => Number(v));
        expect(targets.length).toBeGreaterThanOrEqual(8);
        signatures.set(char.name, targets);
      }

      // Key species signatures verified by exact numeric contracts:
      // 1) Orange Tabby: deep pounce crouch (0.84) + high-paw diagonal swipe (-34°) + strike smear
      const tabby = signatures.get('Orange Tabby')!;
      expect(tabby).toContain(0.84);
      expect(tabby).toContain(-34);
      expect(tabby).toContain(-SMEAR.strikeSkewDeg);

      // 2) Sly Fox: tight horizontal rogue dart (`lungeTx * 1.25`, `+18°` body rotate)
      const fox = signatures.get('Sly Fox')!;
      expect(fox).toContain(80 * THROW.lungeTxRatio * 1.25);
      expect(fox).toContain(18);

      // 3) Badger: heavy rear uppercut cock-back (-12°, 0.80 squash) -> attached haymaker cross jab (+17°, pawTx +0.13*size)
      const badger = signatures.get('Badger')!;
      expect(badger).toContain(-12);
      expect(badger).toContain(17);
      expect(badger).toContain(0.8);
      expect(badger).toContain(80 * 0.13);

      // 4) Emperor Penguin: tall upright draw-up (`scaleY: 1.06`) + sweeping casting flipper (`-34°` -> `+24°`)
      const penguin = signatures.get('Emperor Penguin')!;
      expect(penguin).toContain(1.06);
      expect(penguin).toContain(24);
      expect(penguin).not.toContain(0.8); // never hunches like heavy brawler

      // 5) Pelican: bill-scoop pullback (-15°) -> forward pouch-heave sling (+14° headRotate)
      const pelican = signatures.get('Pelican')!;
      expect(pelican).toContain(-15);
      expect(pelican).toContain(14);

      // 6) Corgi: exuberant loaf lunge + splayed radar ears (-22° / +22°)
      const corgi = signatures.get('Corgi')!;
      expect(corgi).toContain(-22);
      expect(corgi).toContain(22);

      // Every single fighter produces a unique throw numeric signature
      const serialized = new Set(Array.from(signatures.values()).map((v) => v.join(',')));
      expect(serialized.size).toBe(6);
    });

    it('executes distinct species cheer (`joy`/`ecstatic`) and `speciesFidget` acts for all 6 fighters', () => {
      for (const char of CHARACTERS) {
        const choreo = getFighterSpeciesChoreography(char.name)!;
        const fidget = getFighterSpeciesFidget(char.name)!;
        expect(fidget).toBeDefined();

        // Both fidget bands (low roll & mid roll) return true; high roll (>0.8) leaves calm quiet blink
        expect(fidget(0.15, makeFullChannels(), 80)).toBe(true);
        expect(fidget(0.55, makeFullChannels(), 80)).toBe(true);
        expect(fidget(0.92, makeFullChannels(), 80)).toBe(false);

        // Joy & ecstatic handled; pain falls back to shared Sakurai HIT grammar
        expect(choreo('joy', makeFullChannels(), 80, { chain: 0, intensity: 0.5, cheerReleaseMs: 240 })).toBe(true);
        expect(choreo('ecstatic', makeFullChannels(), 80, { chain: 0, intensity: 1 })).toBe(true);
        expect(choreo('pain', makeFullChannels(), 80, { chain: 0, intensity: 0 })).toBe(false);
      }

      // Badger cheer stays grounded (low stomp +0.045*size into shadow, heavy squash)
      mockWithTiming.mockClear();
      getFighterSpeciesChoreography('Badger')!('ecstatic', makeFullChannels(), 80, { chain: 0, intensity: 1 });
      const badgerCheerTargets = mockWithTiming.mock.calls.map(([v]) => Number(v));
      expect(badgerCheerTargets).toContain(SQUASH_TIER.heavy.squashY);
      expect(badgerCheerTargets).toContain(80 * 0.045);

      // Corgi cheer performs playful plush crouch (0.78) + butt-wiggle (-7° / +7°) + frantic nub wag (36° / -36°)
      mockWithTiming.mockClear();
      getFighterSpeciesChoreography('Corgi')!('ecstatic', makeFullChannels(), 80, { chain: 0, intensity: 1 });
      const corgiCheerTargets = mockWithTiming.mock.calls.map(([v]) => Number(v));
      expect(corgiCheerTargets).toContain(SQUASH_TIER.playful.squashY);
      expect(corgiCheerTargets).toContain(36);
      expect(corgiCheerTargets).toContain(-36);
    });
  });

  describe('3. Living Lightweight Breath & Animated Streak Pill / Frame Highlight (`FighterAvatar.tsx`)', () => {
    it('runs battery-safe GPU-only lightweight breathing with ZERO active frame loops and cancels on unmount', () => {
      const { unmount } = render(
        <FighterAvatar character="Corgi" size={56} lightweight animate={true} testID="lw-corgi" />
      );

      // Every useGuardedFrameCallback registered in lightweight mode MUST be inactive (0 frame loops!)
      expect(mockFrameCallbackCalls.every((active) => active === false)).toBe(true);
      // GPU-only withRepeat breathing started
      expect(mockWithRepeat).toHaveBeenCalled();

      mockCancelAnimation.mockClear();
      unmount();
      expect(mockCancelAnimation).toHaveBeenCalled();
    });

    it('halts lightweight breathing immediately when app is backgrounded or reduced motion is enabled', () => {
      mockReducedMotion = true;
      const reducedView = render(
        <FighterAvatar character="Orange Tabby" size={56} lightweight animate={true} />
      );
      expect(mockWithRepeat).not.toHaveBeenCalled();
      reducedView.unmount();

      mockReducedMotion = false;
      mockAppActive = false;
      const bgView = render(
        <FighterAvatar character="Orange Tabby" size={56} lightweight animate={true} />
      );
      expect(mockWithRepeat).not.toHaveBeenCalled();
      bgView.unmount();
    });

    it('animates framed 3x streak pill & frame highlight cleanly on enter and keeps badge mounted during exit', () => {
      jest.useFakeTimers();
      const { queryByTestId, getByTestId, rerender } = render(
        <FighterAvatar character="Orange Tabby" size={72} framed streak={0} />
      );
      expect(queryByTestId('fighter-streak-badge')).toBeNull();
      expect(queryByTestId('fighter-frame-highlight')).toBeNull();

      // Enter streak 3x: badge and frame highlight mount with overlapping action delay (`OVERLAP.primaryMs`)
      mockWithDelay.mockClear();
      rerender(<FighterAvatar character="Orange Tabby" size={72} framed streak={3} />);
      expect(getByTestId('fighter-streak-badge')).toBeTruthy();
      expect(getByTestId('fighter-frame-highlight')).toBeTruthy();
      expect(mockWithDelay.mock.calls.some(([ms]) => ms === OVERLAP.primaryMs)).toBe(true);

      // Exit streak back to 0: stays mounted during `MODAL_MOTION.exitMs` exit animation, then unmounts cleanly!
      rerender(<FighterAvatar character="Orange Tabby" size={72} framed streak={0} />);
      expect(queryByTestId('fighter-streak-badge')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(MODAL_MOTION.exitMs + OVERLAP.primaryMs + 32);
      });
      expect(queryByTestId('fighter-streak-badge')).toBeNull();
      expect(queryByTestId('fighter-frame-highlight')).toBeNull();
    });
  });

  describe('4. FighterBuildAura Lifecycle & Storybook Polish (`FighterBuildAura.tsx`)', () => {
    it('animates strictly when active & unreduced, cancels on unmount, and keeps static aura under reduced motion', () => {
      const theme = deriveBuildTheme(['flint_spark'], 1, 2);
      expect(theme).not.toBeNull();

      const activeView = render(<FighterBuildAura theme={theme} size={50} />);
      expect(activeView.getByTestId('fighter-build-aura')).toBeTruthy();
      expect(mockWithRepeat).toHaveBeenCalledTimes(2); // pulse + orbit

      mockCancelAnimation.mockClear();
      activeView.unmount();
      expect(mockCancelAnimation).toHaveBeenCalled();

      // Reduced motion keeps the visual aura rendered cleanly with zero infinite loops
      mockWithRepeat.mockClear();
      mockReducedMotion = true;
      const reducedView = render(<FighterBuildAura theme={theme} size={50} />);
      expect(reducedView.getByTestId('fighter-build-aura')).toBeTruthy();
      expect(mockWithRepeat).not.toHaveBeenCalled();
      reducedView.unmount();
    });

    it('keeps reduced-motion reaction bursts mounted through ACCESSIBLE.fadeMs exit fade (zero POP-OUT)', () => {
      jest.useFakeTimers();
      const personality = getFighterPersonality('Badger');
      const { getByTestId, queryByTestId, rerender } = render(
        <FighterEffectsOverlay
          activeReaction="throw"
          reactionId={1}
          mood="idle"
          personality={personality}
          size={80}
          animate={false}
        />
      );
      expect(getByTestId('fighter-fx-throw')).toBeTruthy();

      // Clear activeReaction: stays mounted while fading out via ACCESSIBLE.fadeMs, then unmounts cleanly
      mockWithTiming.mockClear();
      rerender(
        <FighterEffectsOverlay
          activeReaction={null}
          reactionId={1}
          mood="idle"
          personality={personality}
          size={80}
          animate={false}
        />
      );
      expect(queryByTestId('fighter-fx-throw')).toBeTruthy();
      expect(
        mockWithTiming.mock.calls.some(
          ([to, cfg]) =>
            to === 0 &&
            typeof cfg === 'object' &&
            cfg !== null &&
            (cfg as { duration?: number }).duration === ACCESSIBLE.fadeMs
        )
      ).toBe(true);

      act(() => {
        jest.advanceTimersByTime(ACCESSIBLE.fadeMs + HIT.snapMs + 16);
      });
      expect(queryByTestId('fighter-fx-throw')).toBeNull();
    });
  });

  describe('5. Option B 8x8 Hybrid Sprite State Machine (`FighterSpriteRig.tsx` & `useCreatureMotion.ts`)', () => {
    it('enforces the locked 8x8 (64-slot) atlas contract and reports availability for all 6 heroes', () => {
      expect(FIGHTER_ATLAS_COLS).toBe(8);
      expect(FIGHTER_ATLAS_ROWS).toBe(8);
      expect(FIGHTER_IDLE_FRAME_COUNT).toBe(32);
      expect(FIGHTER_ATLAS_MAX_INDEX).toBe(63);
      expect(FIGHTER_CLIPS.idle).toEqual({ start: 0, count: 32, fps: 16 });
      expect(FIGHTER_CLIPS.windup).toEqual({ start: 32, count: 4, fps: 16 });
      expect(FIGHTER_CLIPS.attack).toEqual({ start: 36, count: 8, fps: 20 });
      expect(FIGHTER_CLIPS.cheer).toEqual({ start: 44, count: 8, fps: 16 });
      expect(FIGHTER_CLIPS.hurt).toEqual({ start: 52, count: 6, fps: 16 });
      expect(FIGHTER_CLIPS.sleepy).toEqual({ start: 58, count: 6, fps: 8 });
      expect(getFighterThrowWindMs('Badger')).toBe(HIT.snapMs * 3);
      expect(getFighterThrowWindMs('Orange Tabby')).toBe(THROW.windMs);

      for (const hero of ['Orange Tabby', 'Sly Fox', 'Badger', 'Corgi', 'Emperor Penguin', 'Pelican']) {
        expect(hasFighterSpriteAtlas(hero)).toBe(true);
        expect(FIGHTER_SPRITE_ATLASES[hero]).toBeDefined();
      }
      expect(hasFighterSpriteAtlas('Mystery Capybara')).toBe(false);
    });

    it('(a) advances monotonic idle clock continuously across idle -> curious -> streak -> urgent without resetting', () => {
      const hook = renderHook(
        ({ mood }: { mood: 'idle' | 'curious' | 'streak' | 'urgent' }) =>
          useCreatureMotion(FIGHTER_MOTION, {
            name: 'Orange Tabby',
            size: 74,
            mood,
            healthState: 'pristine',
            personality: getFighterPersonality('Orange Tabby'),
            pivots: getFighterPivots('Orange Tabby'),
            massClass: getFighterMassClass('Orange Tabby'),
            atlasBakedIdle: true,
            spriteTempo: getSpriteMoodTempo(mood),
            reaction: null,
            animate: true,
            lively: true,
            interactive: false,
          }),
        { initialProps: { mood: 'idle' as 'idle' | 'curious' | 'streak' | 'urgent' } }
      );

      const stepFrames = (count: number, dtMs = 16) => {
        const latest = mockCapturedFrameCallbacks[mockCapturedFrameCallbacks.length - 1];
        expect(latest?.active).toBe(true);
        for (let i = 0; i < count; i++) {
          latest.cb({ timeSincePreviousFrame: dtMs });
        }
      };

      stepFrames(10, 16);
      const clockAfterIdle = hook.result.current.spriteClockMs.value;
      const idleSecAfterIdle = hook.result.current.spriteIdleSec.value;
      expect(clockAfterIdle).toBe(160);
      expect(idleSecAfterIdle).toBeCloseTo(0.16, 3);

      // Transition idle -> curious -> streak -> urgent: monotonic clocks NEVER reset to 0!
      hook.rerender({ mood: 'curious' });
      stepFrames(10, 16);
      expect(hook.result.current.spriteClockMs.value).toBe(320);
      expect(hook.result.current.spriteIdleSec.value).toBeGreaterThan(idleSecAfterIdle + 0.16);

      const idleSecAfterCurious = hook.result.current.spriteIdleSec.value;
      hook.rerender({ mood: 'streak' });
      stepFrames(10, 16);
      expect(hook.result.current.spriteClockMs.value).toBe(480);
      expect(hook.result.current.spriteIdleSec.value).toBeGreaterThan(idleSecAfterCurious + 0.165);

      const idleSecAfterStreak = hook.result.current.spriteIdleSec.value;
      hook.rerender({ mood: 'urgent' });
      stepFrames(10, 16);
      expect(hook.result.current.spriteClockMs.value).toBe(640);
      expect(hook.result.current.spriteIdleSec.value).toBeGreaterThan(idleSecAfterStreak + 0.18);
      hook.unmount();

      // In active FighterAvatar, idle -> curious -> streak triggers ZERO crossfade resets and ZERO extra frame loops
      mockWithTiming.mockClear();
      mockWithRepeat.mockClear();
      mockFrameCallbackCalls = [];
      const view = render(
        <FighterAvatar character="Orange Tabby" size={74} mood="idle" animate={true} />
      );
      expect(mockFrameCallbackCalls.filter(Boolean)).toHaveLength(1);
      expect(mockWithRepeat).not.toHaveBeenCalled();

      mockWithTiming.mockClear();
      mockCancelAnimation.mockClear();
      view.rerender(<FighterAvatar character="Orange Tabby" size={74} mood="curious" animate={true} />);
      view.rerender(<FighterAvatar character="Orange Tabby" size={74} mood="streak" animate={true} />);
      // No sprite blend timing fired on idle -> curious -> streak!
      expect(
        mockWithTiming.mock.calls.some(
          ([, cfg]) => (cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.moodBlendMs
        )
      ).toBe(false);
      view.unmount();
    });

    it('(b) captures cheerReleaseMs ONCE per reactionKey so async leadImpactMs updates mid-joy NEVER snap back to windup', () => {
      const clockMs = { value: 1000 } as unknown as SharedValue<number>;
      const idleSec = { value: 1.0 } as unknown as SharedValue<number>;
      const painHitstop = { value: HIT.holdMs } as unknown as SharedValue<number>;

      const view = render(
        <FighterSpriteRig
          characterName="Orange Tabby"
          size={80}
          mood="idle"
          healthState="pristine"
          activeReaction="joy"
          reactionKey={1}
          cheerReleaseMs={240}
          painHitstopMs={painHitstop}
          spriteClockMs={clockMs}
          spriteIdleSec={idleSec}
          animate={true}
        />
      );

      // Advance clock past releaseMs (240ms) into the cheer clip (t = 1300ms -> 300ms elapsed)
      clockMs.value = 1300;
      idleSec.value = 1.3;
      mockWithTiming.mockClear();
      mockCancelAnimation.mockClear();

      // Async `leadImpactMs` update arrives with same `reactionKey = 1`
      view.rerender(
        <FighterSpriteRig
          characterName="Orange Tabby"
          size={80}
          mood="idle"
          healthState="pristine"
          activeReaction="joy"
          reactionKey={1}
          cheerReleaseMs={265}
          painHitstopMs={painHitstop}
          spriteClockMs={clockMs}
          spriteIdleSec={idleSec}
          animate={true}
        />
      );

      // Must be a strict no-op: zero transition re-triggers, zero blend restarts, zero windup snaps
      expect(mockWithTiming).not.toHaveBeenCalled();
      expect(mockCancelAnimation).not.toHaveBeenCalled();
      view.unmount();
    });

    it('(c) mounts dual-layer single-texture crossfade with unique fighter-sprite-atlas testID and SPRITE_TX blend matrix', () => {
      const view = render(
        <FighterAvatar character="Orange Tabby" size={80} mood="idle" animate={true} />
      );
      expect(view.getByTestId('fighter-sprite-viewport')).toBeTruthy();
      expect(view.getAllByTestId('fighter-sprite-atlas')).toHaveLength(1);
      const primary = view.getByTestId('fighter-sprite-atlas');
      const secondary = view.getByTestId('fighter-sprite-atlas-prev');
      // Both layers share the exact same preloaded texture reference (0 extra VRAM)
      expect(secondary.props.source).toBe(primary.props.source);

      // Smooth 64ms mood blend on idle -> anticipation
      mockWithTiming.mockClear();
      view.rerender(
        <FighterAvatar character="Orange Tabby" size={80} mood="anticipation" animate={true} />
      );
      expect(
        mockWithTiming.mock.calls.some(
          ([to, cfg]) => to === 1 && (cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.moodBlendMs
        )
      ).toBe(true);

      // Smooth 96ms sleepy bridge blend on anticipation -> sleepy
      mockWithTiming.mockClear();
      view.rerender(
        <FighterAvatar character="Orange Tabby" size={80} mood="sleepy" animate={true} />
      );
      expect(
        mockWithTiming.mock.calls.some(
          ([to, cfg]) => to === 1 && (cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.sleepBlendMs
        )
      ).toBe(true);

      // 0ms Sakurai snap on pain (no 64/96ms crossfade blur on combat impacts)
      mockWithTiming.mockClear();
      view.rerender(
        <FighterAvatar
          character="Orange Tabby"
          size={80}
          mood="idle"
          reaction={{ type: 'pain', id: 1 }}
          animate={true}
        />
      );
      expect(
        mockWithTiming.mock.calls.some(
          ([to, cfg]) =>
            to === 1 &&
            ((cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.moodBlendMs ||
              (cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.sleepBlendMs)
        )
      ).toBe(false);
      view.unmount();

      // Silhouette mode keeps unique fighter-sprite-atlas without secondary crossfade layer
      const sil = render(
        <FighterAvatar character="Orange Tabby" size={64} silhouette animate={false} />
      );
      expect(sil.getByTestId('fighter-sprite-silhouette')).toBeTruthy();
      expect(sil.getAllByTestId('fighter-sprite-atlas')).toHaveLength(1);
      expect(sil.queryByTestId('fighter-sprite-atlas-prev')).toBeNull();
      sil.unmount();

      // Reduced motion uses calm ACCESSIBLE.fadeMs crossfades (zero strobe!)
      mockReducedMotion = true;
      const rm = render(
        <FighterAvatar character="Orange Tabby" size={80} mood="idle" animate={true} />
      );
      mockWithTiming.mockClear();
      rm.rerender(
        <FighterAvatar character="Orange Tabby" size={80} mood="sleepy" animate={true} />
      );
      expect(
        mockWithTiming.mock.calls.some(
          ([to, cfg]) => to === 1 && (cfg as { duration?: number } | undefined)?.duration === ACCESSIBLE.fadeMs
        )
      ).toBe(true);
      rm.unmount();
    });

    it('(d) atlasBakedIdle disables redundant procedural idle breath/fidgets while keeping combat reactions & aligned Badger holds', () => {
      jest.useFakeTimers();
      const speciesFidget = jest.fn(() => true);
      const speciesChoreography = jest.fn(() => true);

      const hook = renderHook(
        ({ reaction }: { reaction: { type: 'throw' | 'joy' | 'pain'; id: number } | null }) =>
          useCreatureMotion(FIGHTER_MOTION, {
            name: 'Badger',
            size: 80,
            mood: 'victory',
            healthState: 'pristine',
            personality: getFighterPersonality('Badger'),
            pivots: getFighterPivots('Badger'),
            massClass: 'heavy',
            atlasBakedIdle: true,
            speciesChoreography,
            speciesFidget,
            reaction,
            animate: true,
            lively: true,
            interactive: false,
          }),
        { initialProps: { reaction: null as { type: 'throw' | 'joy' | 'pain'; id: number } | null } }
      );

      // Advance 12s of idle/victory time: zero procedural blinks, zero gaze shifts, zero fidget body warps!
      act(() => {
        jest.advanceTimersByTime(12_000);
      });
      expect(speciesFidget).not.toHaveBeenCalled();
      expect(hook.result.current.blinkStage).toBe(0);
      expect(hook.result.current.isBlinking).toBe(false);

      // Combat reaction choreography STILL runs 100%, and heavy Badger's `joy` settles at exact
      // clip completion (`CHEER.releaseMs + 500ms = 740ms`), NOT massTimeMult-inflated `1125ms`!
      act(() => {
        hook.rerender({ reaction: { type: 'joy', id: 1 } });
      });
      expect(speciesChoreography).toHaveBeenCalledTimes(1);
      expect(hook.result.current.activeReaction).toBe('joy');

      const expectedJoyHoldMs = CHEER.releaseMs + FIGHTER_CLIP_DURATION_MS.cheer; // 740ms
      act(() => {
        jest.advanceTimersByTime(expectedJoyHoldMs - 20);
      });
      expect(hook.result.current.activeReaction).toBe('joy');

      act(() => {
        jest.advanceTimersByTime(30);
      });
      expect(hook.result.current.activeReaction).toBeNull();
      hook.unmount();
    });

    it('(e) runs lightweight sprite loop with 0 active frame loops and halts immediately on background or reduced motion', () => {
      mockFrameCallbackCalls = [];
      mockWithRepeat.mockClear();
      const lw = render(
        <FighterAvatar character="Orange Tabby" size={74} mood="idle" lightweight animate={true} />
      );
      expect(lw.getByTestId('fighter-sprite-viewport')).toBeTruthy();
      expect(lw.getByTestId('fighter-sprite-atlas')).toBeTruthy();
      expect(mockFrameCallbackCalls.every((active) => active === false)).toBe(true);
      expect(mockWithRepeat).toHaveBeenCalledTimes(1);

      // Mood changes in lightweight mode do NOT reset or restart the GPU loop
      lw.rerender(
        <FighterAvatar character="Orange Tabby" size={74} mood="curious" lightweight animate={true} />
      );
      lw.rerender(
        <FighterAvatar character="Orange Tabby" size={74} mood="streak" lightweight animate={true} />
      );
      expect(mockWithRepeat).toHaveBeenCalledTimes(1);

      mockCancelAnimation.mockClear();
      lw.unmount();
      expect(mockCancelAnimation).toHaveBeenCalled();

      // Backgrounding immediately halts sprite loop without starting a new withRepeat
      mockWithRepeat.mockClear();
      mockFrameCallbackCalls = [];
      mockAppActive = false;
      const bgView = render(
        <FighterAvatar character="Sly Fox" size={64} mood="idle" lightweight animate={true} />
      );
      expect(bgView.getByTestId('fighter-sprite-atlas')).toBeTruthy();
      expect(mockFrameCallbackCalls.every((active) => active === false)).toBe(true);
      expect(mockWithRepeat).not.toHaveBeenCalled();
      bgView.unmount();

      // Reduced motion keeps static neutral pose with zero infinite loops and zero frame loops
      mockAppActive = true;
      mockReducedMotion = true;
      mockWithRepeat.mockClear();
      mockFrameCallbackCalls = [];
      const rmView = render(
        <FighterAvatar character="Pelican" size={64} mood="idle" lightweight animate={true} />
      );
      expect(rmView.getByTestId('fighter-sprite-atlas')).toBeTruthy();
      expect(mockFrameCallbackCalls.every((active) => active === false)).toBe(true);
      expect(mockWithRepeat).not.toHaveBeenCalled();
      rmView.unmount();
    });

    it('(f) runs Phase B UI-thread crossfade (`SPRITE_TX.sleepBlendMs`) from bridge 58 -> 59 in sleepy and 58 -> 63 in KO', () => {
      const clockMs = { value: 0 } as unknown as SharedValue<number>;
      const idleSec = { value: 0 } as unknown as SharedValue<number>;
      const painHitstop = { value: HIT.holdMs } as unknown as SharedValue<number>;

      mockCapturedAnimatedStyleFns = [];
      const view = render(
        <FighterSpriteRig
          characterName="Orange Tabby"
          size={80}
          mood="sleepy"
          healthState="pristine"
          activeReaction={null}
          reactionKey={0}
          painHitstopMs={painHitstop}
          spriteClockMs={clockMs}
          spriteIdleSec={idleSec}
          animate={true}
        />
      );
      // FighterSpriteRig registers 3 worklets in order: settleWrapStyle, currAtlasStyle, prevAtlasStyle
      const [, evalCurr, evalPrev] = mockCapturedAnimatedStyleFns.slice(-3);

      // Before Phase B (`112ms < 125ms`): pure standing drowsy bridge 58
      clockMs.value = 112;
      expect(evalCurr().transform).toEqual([{ translateX: -2 * 80 }, { translateY: -7 * 80 }]);
      expect(evalCurr().opacity).toBe(1);
      expect(evalPrev().opacity).toBe(0);

      // Midpoint of Phase B (`125ms + 48ms = 173ms`): smooth crossfade from standing bridge 58 (col 2, row 7) -> curled 59 (col 3, row 7)
      clockMs.value = 173;
      const currLayerMid = evalCurr();
      const prevLayerMid = evalPrev();
      expect(currLayerMid.opacity).toBeCloseTo(0.5, 2);
      expect(prevLayerMid.opacity as number).toBeGreaterThan(0.5);
      expect(prevLayerMid.opacity as number).toBeLessThan(0.8);
      expect(prevLayerMid.transform).toEqual([{ translateX: -2 * 80 }, { translateY: -7 * 80 }]);
      expect(currLayerMid.transform).toEqual([{ translateX: -3 * 80 }, { translateY: -7 * 80 }]);

      // After Phase B completes (`125ms + 96ms = 221ms`): pure curled frame 59 with prev opacity 0
      clockMs.value = 224;
      expect(evalCurr().opacity).toBe(1);
      expect(evalPrev().opacity).toBe(0);
      view.unmount();

      // Verify identical Phase B crossfade for `knocked_out` (`58 -> 63`: col 7, row 7)
      clockMs.value = 0;
      mockCapturedAnimatedStyleFns = [];
      const koView = render(
        <FighterSpriteRig
          characterName="Orange Tabby"
          size={80}
          mood="idle"
          healthState="knocked_out"
          activeReaction={null}
          reactionKey={0}
          painHitstopMs={painHitstop}
          spriteClockMs={clockMs}
          spriteIdleSec={idleSec}
          animate={true}
        />
      );
      const [, evalKoCurr, evalKoPrev] = mockCapturedAnimatedStyleFns.slice(-3);
      clockMs.value = 173;
      const koCurr = evalKoCurr();
      const koPrev = evalKoPrev();
      expect(koCurr.opacity).toBeCloseTo(0.5, 2);
      expect(koPrev.opacity as number).toBeGreaterThan(0.5);
      expect(koPrev.transform).toEqual([{ translateX: -2 * 80 }, { translateY: -7 * 80 }]);
      expect(koCurr.transform).toEqual([{ translateX: -7 * 80 }, { translateY: -7 * 80 }]);
      koView.unmount();
    });

    it('(g) crossfades MainMenu mascot tap over SPRITE_TX.swapBlendMs without a blank white flash and unmounts outgoing layer cleanly', () => {
      jest.useFakeTimers();
      const menu = render(
        <MainMenu
          onSelectAdventure={jest.fn()}
          onSelectFreeplay={jest.fn()}
          onSelectOptions={jest.fn()}
        />
      );

      expect(menu.getByTestId('main-menu-mascot')).toBeTruthy();
      expect(menu.queryByTestId('main-menu-mascot-outgoing')).toBeNull();

      mockWithTiming.mockClear();
      mockFrameCallbackCalls = [];
      fireEvent.press(menu.getByTestId('main-menu-mascot-tap'));

      // Both outgoing previous mascot and incoming mascot are mounted during the 112ms dual-layer crossfade
      expect(menu.getByTestId('main-menu-mascot-outgoing')).toBeTruthy();
      expect(menu.getByTestId('main-menu-mascot-prev')).toBeTruthy();
      expect(menu.getByTestId('main-menu-mascot')).toBeTruthy();
      // Outgoing mascot is static lightweight (`animate={false}`), adding ZERO extra active frame loops
      expect(mockFrameCallbackCalls.filter(Boolean).length).toBeLessThanOrEqual(1);
      expect(
        mockWithTiming.mock.calls.some(
          ([to, cfg]) => to === 1 && (cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.swapBlendMs
        )
      ).toBe(true);

      // Outgoing layer unmounts cleanly once the swap crossfade finishes
      act(() => {
        jest.advanceTimersByTime(SPRITE_TX.swapBlendMs + 20);
      });
      expect(menu.queryByTestId('main-menu-mascot-outgoing')).toBeNull();
      menu.unmount();

      // Reduced motion crossfades calmly over ACCESSIBLE.fadeMs before unmounting
      mockReducedMotion = true;
      mockWithTiming.mockClear();
      const rmMenu = render(
        <MainMenu
          onSelectAdventure={jest.fn()}
          onSelectFreeplay={jest.fn()}
          onSelectOptions={jest.fn()}
        />
      );
      fireEvent.press(rmMenu.getByTestId('main-menu-mascot-tap'));
      expect(rmMenu.getByTestId('main-menu-mascot-outgoing')).toBeTruthy();
      expect(
        mockWithTiming.mock.calls.some(
          ([to, cfg]) => to === 1 && (cfg as { duration?: number } | undefined)?.duration === ACCESSIBLE.fadeMs
        )
      ).toBe(true);
      act(() => {
        jest.advanceTimersByTime(ACCESSIBLE.fadeMs + 20);
      });
      expect(rmMenu.queryByTestId('main-menu-mascot-outgoing')).toBeNull();
      rmMenu.unmount();
    });
  });
});
