/**
 * A creature taking a hit (docs/motion/reviews/foe-takes-hit.md): the impact
 * pose holds for a hit-stop of 2-4 frames, a chain of hits goes deeper instead
 * of restarting, and the in-game Effects switch keeps the body still. The
 * fighter cheers a Set (docs/motion/reviews/fighter-reacts-to-set.md) with a hop
 * released when the Set lands, raised by a streak, never a spin.
 */
import React from 'react';
import { act, render, renderHook } from '@testing-library/react-native';
import { EnemyAvatar, ENEMY_MOTION } from '@/components/enemies/EnemyAvatar';
import { getEnemyPersonality, getEnemyRigPivots } from '@/components/enemies/enemyRegistry';
import { useCreatureMotion } from '@/components/creatures/useCreatureMotion';
import type { EnemyReactionType } from '@/utils/enemyAnimations';
import { FighterAvatar } from '@/components/fighters/FighterAvatar';
import { FX_TIMING } from '@/adventure/fx/script';
import { CHEER, HIT, cheerIntensity } from '@/utils/motion';

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
