import React from 'react';
import { render, act } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { Svg } from 'react-native-svg';
import type { ReactionChannels } from '@/components/creatures/types';
import { CreatureEyes } from '@/components/fighters/creatures/FacialFeatures';
import { FighterAvatar } from '@/components/fighters/FighterAvatar';
import { FighterBuildAura, deriveBuildTheme } from '@/components/fighters/FighterBuildAura';
import { FighterEffectsOverlay } from '@/components/fighters/FighterEffectsOverlay';
import {
  getFighterMassClass,
  getFighterPersonality,
  getFighterSpeciesChoreography,
  getFighterSpeciesFidget,
} from '@/components/fighters/fighterRegistry';
import { CHARACTERS } from '@/utils/gameDefinitions';
import { ACCESSIBLE, HIT, MODAL_MOTION, OVERLAP, SMEAR, SQUASH_TIER, THROW } from '@/utils/motion';

const mockWithTiming = jest.fn();
const mockWithDelay = jest.fn();
const mockWithRepeat = jest.fn();
const mockCancelAnimation = jest.fn();
let mockAppActive = true;
let mockReducedMotion = false;
let mockFrameCallbackCalls: boolean[] = [];

jest.mock('@/hooks/useAppActive', () => ({
  useAppActive: () => mockAppActive,
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock('@/hooks/useGuardedFrameCallback', () => ({
  useGuardedFrameCallback: (_cb: unknown, autostart = true) => {
    mockFrameCallbackCalls.push(Boolean(autostart));
    return { setActive: jest.fn(), callbackId: 0, isActive: Boolean(autostart) };
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
});
