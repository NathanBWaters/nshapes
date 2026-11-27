/**
 * A creature taking a hit (docs/motion/reviews/foe-takes-hit.md): the impact
 * pose holds for a hit-stop of 2-4 frames, a chain of hits goes deeper instead
 * of restarting, and the in-game Effects switch keeps the body still. The
 * fighter cheers a Set (docs/motion/reviews/fighter-reacts-to-set.md) with a hop
 * released when the Set lands, raised by a streak, never a spin.
 */
import React from 'react';
import { Platform, View } from 'react-native';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { Svg } from 'react-native-svg';
import { EnemyAvatar, ENEMY_MOTION } from '@/components/enemies/EnemyAvatar';
import { getEnemyPersonality, getEnemyRigPivots } from '@/components/enemies/enemyRegistry';
import { CreatureDamageOverlay } from '@/components/creatures/CreatureDamageOverlay';
import { CreatureStage } from '@/components/creatures/CreatureStage';
import { RigLayers, RigVisualProvider } from '@/components/creatures/RigLayers';
import {
  BlinkLidEye,
  HalfBlinkLidEye,
  ShutBlinkEye,
  resolveBlinkStage,
} from '@/components/creatures/eyes';
import { ReactionChannels, useCreatureMotion } from '@/components/creatures/useCreatureMotion';
import {
  BURST_ARC_PRESETS,
  sampleBurstParticle,
  useEffectsDriver,
} from '@/components/creatures/useEffectsDriver';
import {
  SILHOUETTE_INK,
  StorybookGradient,
  StorybookToneDefs,
  SunlitRimStroke,
  toSilhouetteTree,
} from '@/components/illustration/primitives';
import { Bob, Btn, PopIn } from '@/adventure/components/ui';
import type { EnemyReactionType } from '@/utils/enemyAnimations';
import { FighterAvatar } from '@/components/fighters/FighterAvatar';
import { FX_TIMING } from '@/adventure/fx/script';
import { __setAppActiveForTests } from '@/utils/appLifecycle';
import { CHEER, HIT, MODAL_MOTION, MS, cheerIntensity, exitMs } from '@/utils/motion';

const FRAME = 16;

describe('hit tokens', () => {
  it('the impact pose arrives in one frame and holds for 2-4 frames', () => {
    expect(HIT.snapMs).toBeLessThanOrEqual(FRAME);
    for (const hold of [HIT.holdMs, HIT.critHoldMs, HIT.chainHoldMs]) {
      expect(hold).toBeGreaterThanOrEqual(2 * FRAME);
      expect(hold).toBeLessThanOrEqual(4 * FRAME);
    }
    expect(HIT.chainHoldMs).toBeLessThan(HIT.holdMs);
    expect(HIT.critHoldMs).toBeGreaterThan(HIT.holdMs);
  });

  it('a chain deepens a little and stops deepening', () => {
    expect(1 + HIT.chainGain * HIT.chainMax).toBeLessThanOrEqual(1.35);
    // Stars of one hit are over well under half a second (they are seen on every Set)
    expect(HIT.starsMs).toBeLessThan(450);
  });
});

describe('creature reactions', () => {
  const name = 'Junk Rat';
  const setup = (stillReactions = false) => {
    const playReaction = jest.fn();
    const config = { ...ENEMY_MOTION, playReaction };
    const hook = renderHook(
      ({ reaction }: { reaction: { type: EnemyReactionType; id: number } | null }) =>
        useCreatureMotion(config, {
          name,
          size: 80,
          mood: 'idle',
          healthState: 'pristine',
          personality: getEnemyPersonality(name, 1),
          pivots: getEnemyRigPivots(name),
          reaction,
          animate: true,
          stillReactions,
          lively: false,
          interactive: false,
        }),
      { initialProps: { reaction: null as { type: EnemyReactionType; id: number } | null } }
    );
    return { playReaction, hook };
  };

  // The chain is timed by Date.now; move it by hand (fake timers upset the frame loop's mock)
  let now = 1_000_000;
  const later = (ms: number) => {
    now += ms;
  };
  beforeEach(() => jest.spyOn(Date, 'now').mockImplementation(() => now));
  afterEach(() => jest.restoreAllMocks());

  it('counts a chain of the same hit and starts again after a pause', () => {
    const { playReaction, hook } = setup();
    const hit = (id: number, type: EnemyReactionType = 'pain') => act(() => hook.rerender({ reaction: { type, id } }));
    hit(1);
    later(187);
    hit(2);
    later(187);
    hit(3);
    later(187);
    hit(4);
    const chains = playReaction.mock.calls.map(c => c[3].chain);
    expect(chains).toEqual([0, 1, 2, HIT.chainMax]);

    later(HIT.chainWindowMs + 50);
    hit(5);
    expect(playReaction.mock.calls[4][3].chain).toBe(0);

    // A different reaction is not part of the chain
    later(100);
    hit(6, 'crit_pain');
    expect(playReaction.mock.calls[5][3].chain).toBe(0);
  });

  it('still reactions change the face but never move the body', () => {
    const { playReaction, hook } = setup(true);
    act(() => hook.rerender({ reaction: { type: 'pain', id: 1 } }));
    expect(playReaction).not.toHaveBeenCalled();
    expect(hook.result.current.activeReaction).toBe('pain');
  });

  it('a quiet foe still shows its hit', () => {
    const { getByTestId } = render(
      <EnemyAvatar enemy={name} size={64} quiet reaction={{ type: 'pain', id: 1 }} testID="foe" />
    );
    expect(getByTestId('foe')).toBeTruthy();
  });
});

describe('the fighter cheering a Set', () => {
  it('releases the hop on the frame the thrown Set reaches the foe', () => {
    // If the fight's flight time changes, the cheer must change with it (or be triggered on landing)
    expect(CHEER.releaseMs).toBe(FX_TIMING.flightMs);
  });

  it('a streak raises the same cheer, from the 2nd Set up to a cap', () => {
    expect(cheerIntensity(0)).toBe(0);
    expect(cheerIntensity(1)).toBe(0);
    expect(cheerIntensity(3)).toBeGreaterThan(cheerIntensity(2));
    expect(cheerIntensity(CHEER.streakFull)).toBe(1);
    expect(cheerIntensity(40)).toBe(1);
    expect(CHEER.liftMax / CHEER.liftMin).toBeLessThan(1.6);
  });

  it('a quiet fighter still shows its cheer', () => {
    const { getByTestId } = render(
      <FighterAvatar character="Orange Tabby" size={64} quiet streak={4} reaction={{ type: 'joy', id: 1 }} testID="fighter" />
    );
    expect(getByTestId('fighter')).toBeTruthy();
  });
});

describe('Phase 0 rig channels, deterministic scheduling, and 3-step blinks', () => {
  const name = 'Junk Rat';

  it('populates extended pawTx, pawRotate, headTx, scaleX, bodySkewX channels and massClass/speciesChoreography hooks', () => {
    const captured: { channels: ReactionChannels | null; massClass?: string } = {
      channels: null,
    };
    const speciesChoreography = jest.fn((_type, channels: ReactionChannels, _size, ctx) => {
      captured.channels = channels;
      captured.massClass = ctx.massClass;
      return true;
    });
    const fallbackPlayReaction = jest.fn();
    const config = { ...ENEMY_MOTION, playReaction: fallbackPlayReaction };

    const hook = renderHook(
      ({ reaction }: { reaction: { type: EnemyReactionType; id: number } | null }) =>
        useCreatureMotion(config, {
          name,
          size: 80,
          mood: 'idle',
          healthState: 'pristine',
          personality: getEnemyPersonality(name, 4),
          pivots: getEnemyRigPivots(name),
          reaction,
          animate: true,
          lively: false,
          interactive: false,
          massClass: 'boss',
          speciesChoreography,
        }),
      { initialProps: { reaction: null as { type: EnemyReactionType; id: number } | null } }
    );

    act(() => hook.rerender({ reaction: { type: 'attack', id: 1 } }));

    expect(speciesChoreography).toHaveBeenCalledTimes(1);
    expect(fallbackPlayReaction).not.toHaveBeenCalled();
    expect(captured.massClass).toBe('boss');
    expect(captured.channels?.pawTx?.value).toBe(0);
    expect(captured.channels?.pawRotate?.value).toBe(0);
    expect(captured.channels?.headTx?.value).toBe(0);
    expect(captured.channels?.scaleX?.value).toBe(1);
    expect(captured.channels?.bodySkewX?.value).toBe(0);
    expect(hook.result.current.blinkStage).toBe(0);
    expect(hook.result.current.lidClose.value).toBe(0);
    expect(hook.result.current.groundPenumbraStyle).toBeTruthy();
    expect(hook.result.current.bodyTy.value).toBe(0);
    expect(hook.result.current.reactionScaleY.value).toBe(1);
  });

  it('schedules idle blinks, fidgets, and gaze saccades deterministically without Math.random()', () => {
    jest.useFakeTimers();
    const randomSpy = jest.spyOn(Math, 'random');
    const rollsA: number[] = [];
    const rollsB: number[] = [];

    try {
      const hookA = renderHook(() =>
        useCreatureMotion(
          {
            ...ENEMY_MOTION,
            idleFidget: (roll) => {
              rollsA.push(roll);
            },
          },
          {
            name: 'Orange Tabby',
            size: 64,
            mood: 'idle',
            healthState: 'pristine',
            personality: getEnemyPersonality(name, 1),
            pivots: getEnemyRigPivots(name),
            reaction: null,
            animate: true,
            lively: true,
            interactive: false,
          }
        )
      );

      const hookB = renderHook(() =>
        useCreatureMotion(
          {
            ...ENEMY_MOTION,
            idleFidget: (roll) => {
              rollsB.push(roll);
            },
          },
          {
            name: 'Orange Tabby',
            size: 64,
            mood: 'idle',
            healthState: 'pristine',
            personality: getEnemyPersonality(name, 1),
            pivots: getEnemyRigPivots(name),
            reaction: null,
            animate: true,
            lively: true,
            interactive: false,
          }
        )
      );

      act(() => {
        jest.advanceTimersByTime(12_000);
      });

      expect(randomSpy).not.toHaveBeenCalled();
      expect(rollsA.length).toBeGreaterThanOrEqual(2);
      expect(rollsA).toEqual(rollsB);
      expect(hookA.result.current.gaze).toEqual(hookB.result.current.gaze);

      hookA.unmount();
      hookB.unmount();
    } finally {
      randomSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('supports 3-step upper-eyelid sweep in BlinkLidEye with backward-compatible isBlinking', () => {
    expect(resolveBlinkStage(undefined, false)).toBe(0);
    expect(resolveBlinkStage(undefined, true)).toBe(2);
    expect(resolveBlinkStage(1, false)).toBe(1);
    expect(resolveBlinkStage(0, true)).toBe(0);

    const openView = render(
      <Svg viewBox="0 0 100 100">
        <BlinkLidEye cx={40} cy={44} r={4.6} blinkStage={0}>
          <View testID="open-eye-child" />
        </BlinkLidEye>
      </Svg>
    );
    expect(openView.getByTestId('open-eye-child')).toBeTruthy();

    const halfView = render(
      <Svg viewBox="0 0 100 100">
        <BlinkLidEye cx={40} cy={44} r={4.6} blinkStage={1}>
          <View testID="open-eye-child" />
        </BlinkLidEye>
      </Svg>
    );
    expect(halfView.queryByTestId('open-eye-child')).toBeNull();
    const halfJson = JSON.stringify(halfView.toJSON());
    expect(halfJson).toContain('#383838');

    const shutView = render(
      <Svg viewBox="0 0 100 100">
        <BlinkLidEye cx={40} cy={44} r={4.6} isBlinking>
          <View testID="open-eye-child" />
        </BlinkLidEye>
      </Svg>
    );
    expect(shutView.queryByTestId('open-eye-child')).toBeNull();

    // Direct standalone HalfBlinkLidEye & ShutBlinkEye primitives render cleanly
    const direct = render(
      <Svg viewBox="0 0 100 100">
        <HalfBlinkLidEye cx={38} cy={44} r={4.5} darkMask lidFill="#FF9538" />
        <ShutBlinkEye cx={62} cy={44} r={4.5} />
      </Svg>
    );
    expect(direct.toJSON()).toBeTruthy();
  });

  it('keeps CreatureDamageOverlay bandages & KO stars mounted during fade-out before unmounting', () => {
    jest.useFakeTimers();
    try {
      const view = render(<CreatureDamageOverlay healthState="knocked_out" animate />);
      expect(view.getByTestId('fighter-damage-knocked_out')).toBeTruthy();
      expect(view.getByTestId('creature-ko-stars')).toBeTruthy();

      // Reviving from knocked_out -> scuffed keeps KO stars mounted while koPresence fades out
      view.rerender(<CreatureDamageOverlay healthState="scuffed" animate />);
      expect(view.getByTestId('creature-ko-stars')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(exitMs(MS.panel) + 16);
      });
      expect(view.queryByTestId('creature-ko-stars')).toBeNull();
      expect(view.getByTestId('fighter-damage-scuffed')).toBeTruthy();

      // Healing scuffed -> pristine keeps bandages mounted through exit fade before unmounting
      view.rerender(<CreatureDamageOverlay healthState="pristine" animate />);
      expect(view.getByTestId('fighter-damage-pristine')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(exitMs(MS.quick) + 16);
      });
      expect(view.queryByTestId('fighter-damage-pristine')).toBeNull();
      view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('exposes 5 staggered particle progress channels and parabolic burst presets in useEffectsDriver', () => {
    const { result, rerender, unmount } = renderHook(
      ({ activeReaction, reactionId }: { activeReaction: string | null; reactionId: number }) =>
        useEffectsDriver({
          animate: false,
          initialAmbientHz: 0.6,
          ambientHz: 0.6,
          presenceTargets: [0, 0, 0],
          fadeMs: 200,
          activeReaction,
          reactionId,
          burstMs: 480,
          staticBurstProgress: 0.55,
        }),
      { initialProps: { activeReaction: null as string | null, reactionId: 0 } }
    );

    expect(result.current.particleProgresses).toHaveLength(5);
    expect(BURST_ARC_PRESETS).toHaveLength(5);

    act(() => rerender({ activeReaction: 'joy', reactionId: 1 }));
    const values = result.current.particleProgresses.map(p => p.value);
    expect(values[0]).toBeGreaterThan(values[1]);
    expect(values[1]).toBeGreaterThan(values[4]);

    const pLeft = sampleBurstParticle(0.5, BURST_ARC_PRESETS[0]);
    const pRight = sampleBurstParticle(0.5, BURST_ARC_PRESETS[4]);
    expect(pLeft.tx).toBeLessThan(0);
    expect(pRight.tx).toBeGreaterThan(0);
    expect(pLeft.ty).toBeLessThan(0);
    expect(pLeft.opacity).toBeGreaterThan(0);
    unmount();
  });

  it('strips SunlitRimStroke & StorybookToneDefs cleanly in silhouette mode and supports RigLayers bodyStyle/CreatureStage dual shadow', () => {
    const stripped = toSilhouetteTree([
      <StorybookToneDefs
        key="defs"
        tones={[{ id: 'boss-body', lit: '#FFCC80', base: '#E65100', shadow: '#4A148C' }]}
      />,
      <StorybookGradient key="grad" id="boss-wing" lit="#FFFDF5" base="#64748B" shadow="#1E293B" />,
      <SunlitRimStroke key="rim" d="M 20 30 Q 40 20 60 30" />,
    ]);
    expect(React.Children.toArray(stripped).filter(Boolean)).toEqual([]);

    const stage = render(
      <CreatureStage
        size={80}
        testID="test-stage"
        accessibilityLabel="Test stage"
        interactive={false}
        onPress={() => {}}
        shadow={{ testID: 'test-shadow', minWidth: 12, minHeight: 4, style: {} }}
        rigRootStyle={{}}
        rig={
          <RigVisualProvider silhouette={false} facing="left">
            <RigLayers
              partStyles={{ bodyStyle: { opacity: 1 } }}
              skipAutoLighting
              skipFacingOffset
              tail={null}
              body={<SunlitRimStroke d="M 10 10 L 30 10" />}
              leftEar={null}
              rightEar={null}
              head={null}
              paws={null}
            />
          </RigVisualProvider>
        }
      />
    );
    expect(stage.getByTestId('test-shadow')).toBeTruthy();
    expect(stage.getByTestId('test-shadow-penumbra')).toBeTruthy();
    expect(SILHOUETTE_INK).toBe('#121212');
    stage.unmount();
  });
});

describe('Phase 0 tactile UI primitives (Btn, PopIn, Bob)', () => {
  const withReducedMotion = (reduced: boolean, fn: () => void) => {
    const origOs = Platform.OS;
    const g = globalThis as unknown as { window?: Record<string, unknown> };
    const hadWindow = 'window' in g && g.window !== undefined;
    const win = (hadWindow ? g.window! : (g.window = {})) as Record<string, unknown>;
    const origMatchMedia = win.matchMedia;
    win.matchMedia = () => ({
      matches: reduced,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    (Platform as { OS: string }).OS = 'web';
    try {
      fn();
    } finally {
      (Platform as { OS: string }).OS = origOs;
      if (hadWindow) {
        win.matchMedia = origMatchMedia;
      } else {
        delete g.window;
      }
    }
  };

  afterEach(() => {
    __setAppActiveForTests(true);
  });

  it('handles tactile press-in/press-out on Btn and respects disabled + reduced motion', () => {
    const onPress = jest.fn();
    const view = render(<Btn testID="tactile-btn" label="Fight" onPress={onPress} />);
    const btn = view.getByTestId('tactile-btn');
    fireEvent(btn, 'pressIn');
    fireEvent(btn, 'pressOut');
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);

    const disabledPress = jest.fn();
    const disabledView = render(
      <Btn testID="disabled-btn" label="Locked" disabled onPress={disabledPress} />
    );
    fireEvent.press(disabledView.getByTestId('disabled-btn'));
    expect(disabledPress).not.toHaveBeenCalled();

    withReducedMotion(true, () => {
      const rmView = render(<Btn testID="rm-btn" label="Quiet" onPress={onPress} small />);
      fireEvent(rmView.getByTestId('rm-btn'), 'pressIn');
      fireEvent(rmView.getByTestId('rm-btn'), 'pressOut');
      rmView.unmount();
    });
    view.unmount();
    disabledView.unmount();
  });

  it('supports PopIn visible exit transition with onExited callback and reduced-motion fade', () => {
    jest.useFakeTimers();
    try {
      const onExited = jest.fn();
      const view = render(
        <PopIn visible onExited={onExited}>
          <View testID="popin-child" />
        </PopIn>
      );
      expect(view.getByTestId('popin-child')).toBeTruthy();

      view.rerender(
        <PopIn visible={false} onExited={onExited}>
          <View testID="popin-child" />
        </PopIn>
      );
      expect(onExited).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(MODAL_MOTION.exitMs + 10);
      });
      expect(onExited).toHaveBeenCalledTimes(1);
      view.unmount();

      withReducedMotion(true, () => {
        const rmExited = jest.fn();
        const rmView = render(
          <PopIn visible={false} onExited={rmExited}>
            <View testID="rm-popin-child" />
          </PopIn>
        );
        act(() => {
          jest.advanceTimersByTime(MODAL_MOTION.exitMs);
        });
        expect(rmExited).toHaveBeenCalledTimes(1);
        rmView.unmount();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('gates Bob on useReducedMotion and useAppActive and accepts phase/delayMs props', () => {
    withReducedMotion(false, () => {
      const view = render(
        <Bob active amount={4} phase={Math.PI / 2} periodMs={1200}>
          <View testID="bob-node" />
        </Bob>
      );
      expect(view.getByTestId('bob-node')).toBeTruthy();

      act(() => {
        __setAppActiveForTests(false);
      });
      act(() => {
        __setAppActiveForTests(true);
      });
      view.rerender(
        <Bob active amount={4} delayMs={240}>
          <View testID="bob-node" />
        </Bob>
      );
      view.unmount();
    });

    withReducedMotion(true, () => {
      const rmView = render(
        <Bob active amount={4} phase={1.2}>
          <View testID="bob-rm-node" />
        </Bob>
      );
      expect(rmView.getByTestId('bob-rm-node')).toBeTruthy();
      rmView.unmount();
    });
  });
});
