import React from 'react';
import { fireEvent, render, renderHook, act } from '@testing-library/react-native';
import { LEVELS } from '@/adventure/data/levels';
import { foeDisplay } from '@/adventure/data/foes';
import { EnemyAvatar } from '@/components/enemies';
import { ALL_CUSTOM_ENEMY_RIG_NAMES } from '@/components/enemies/rigs';
import { hasEnemyCreature } from '@/components/enemies/enemyRegistry';
import { GENERIC_GEM_WEAPON_NAMES } from '@/components/weapons/WeaponArtwork';
import { WeaponAvatar, ALL_CUSTOM_WEAPON_NAMES, getWeaponTapStyle } from '@/components/weapons';
import { useEnemyConductor } from '@/hooks/useEnemyConductor';
import {
  ENEMY_MOOD_MOTION,
  getEnemyHealthState,
  resolveEnemyAmbientMood,
  resolveEnemyExpression,
} from '@/utils/enemyAnimations';
import { computeMoodLoopRates, computeMoodPoseTargets } from '@/utils/creatureAnimations';
import { getEnemyNames } from '@/utils/enemyFactory';
import { WEAPONS } from '@/utils/gameDefinitions';

describe('Custom Enemy Rigs & Procedural Animation Engine', () => {
  it('explicitly covers every registered Tier 1-4 enemy in ALL_CUSTOM_ENEMY_RIG_NAMES', () => {
    const registeredNames = getEnemyNames();
    expect(registeredNames.length).toBeGreaterThanOrEqual(50);

    const rigSet = new Set(ALL_CUSTOM_ENEMY_RIG_NAMES);
    const missing = registeredNames.filter((name) => !rigSet.has(name));
    expect(missing).toEqual([]);
  });

  it('explicitly covers every Adventure Mode foe across all 37 levels', () => {
    const rigSet = new Set(ALL_CUSTOM_ENEMY_RIG_NAMES);
    const adventureFoeNames = new Set<string>();

    for (const level of LEVELS) {
      for (const foeSpec of level.foes) {
        adventureFoeNames.add(foeDisplay(foeSpec).name);
      }
    }

    const missing = Array.from(adventureFoeNames).filter((name) => !rigSet.has(name));
    expect(missing).toEqual([]);
  });

  it('resolves every registered enemy and adventure foe to a registry creature (none fall back to the crest)', () => {
    const names = new Set<string>(getEnemyNames());
    for (const level of LEVELS) {
      for (const foeSpec of level.foes) names.add(foeDisplay(foeSpec).name);
    }
    const usingFallbackCrest: string[] = [];
    const unresolved = Array.from(names).filter(
      (name) => !hasEnemyCreature(name) && !usingFallbackCrest.includes(name)
    );
    expect(unresolved).toEqual([]);
  });

  it('renders every custom enemy rig cleanly without errors', () => {
    for (const enemyName of ALL_CUSTOM_ENEMY_RIG_NAMES) {
      const { getByTestId, unmount } = render(
        <EnemyAvatar
          testID={`enemy-${enemyName}`}
          enemy={enemyName}
          size={64}
          hp={2}
          maxHp={4}
          mood="menacing"
          framed
        />
      );
      expect(getByTestId(`enemy-${enemyName}`)).toBeTruthy();
      unmount();
    }
  });

  it('maps progressive HP wear states and renders battle-damage overlays', () => {
    expect(getEnemyHealthState(10, 10)).toBe('pristine');
    expect(getEnemyHealthState(7, 10)).toBe('scuffed');
    expect(getEnemyHealthState(4, 10)).toBe('battered');
    expect(getEnemyHealthState(2, 10)).toBe('critical');
    expect(getEnemyHealthState(0, 10)).toBe('knocked_out');

    const { getByTestId, getByLabelText, rerender } = render(
      <EnemyAvatar testID="wear-foe" enemy="The Hydra" hp={4} maxHp={10} />
    );
    expect(getByTestId('enemy-damage-overlay')).toBeTruthy();
    expect(getByLabelText('The Hydra enemy (battered)')).toBeTruthy();

    rerender(<EnemyAvatar testID="wear-foe" enemy="The Hydra" hp={0} maxHp={10} />);
    expect(getByLabelText('The Hydra enemy (knocked_out)')).toBeTruthy();
  });

  it('resolves continuous loop rates, posture targets, moods, and expressions cleanly', () => {
    expect(
      resolveEnemyAmbientMood({ hp: 5, maxHp: 10, isBoss: true, isActiveCombat: true })
    ).toBe('enraged');
    expect(resolveEnemyAmbientMood({ hp: 2, maxHp: 10, isActiveCombat: true })).toBe('cornered');
    expect(resolveEnemyAmbientMood({ hp: 10, maxHp: 10, naturallySleepy: true })).toBe('sleepy');
    expect(resolveEnemyAmbientMood({ hp: 0, maxHp: 10 })).toBe('defeat');

    expect(
      resolveEnemyExpression({
        healthState: 'knocked_out',
        mood: 'menacing',
        activeReaction: 'taunt',
        isBlinking: false,
      })
    ).toBe('ko');
    expect(
      resolveEnemyExpression({
        healthState: 'pristine',
        mood: 'menacing',
        activeReaction: 'pain',
        isBlinking: false,
      })
    ).toBe('wince');
    expect(
      resolveEnemyExpression({
        healthState: 'pristine',
        mood: 'menacing',
        activeReaction: 'taunt',
        isBlinking: false,
      })
    ).toBe('wicked_glee');
    expect(
      resolveEnemyExpression({
        healthState: 'pristine',
        mood: 'menacing',
        activeReaction: 'attack',
        isBlinking: false,
      })
    ).toBe('enraged');

    const rates = computeMoodLoopRates(ENEMY_MOOD_MOTION, 'enraged', 'battered', 2400, 1400);
    expect(rates.breathHz).toBeGreaterThan(0);
    expect(rates.wagHz).toBeGreaterThan(0);

    const pose = computeMoodPoseTargets(ENEMY_MOOD_MOTION, 'menacing', 'pristine', 64, -0.3, 0);
    expect(pose.leanX).toBeLessThan(0);
    expect(pose.leanY).toBeGreaterThan(0);
    expect(pose.postureStretchY).toBeLessThan(1);
  });

  it('triggers poke on 1x tap and rage_spin easter egg on 5x rapid taps', () => {
    const onPoke = jest.fn();
    const { getByTestId } = render(
      <EnemyAvatar
        testID="interactive-enemy"
        enemy="Goblin Saboteur"
        interactive
        onPoke={onPoke}
      />
    );

    const target = getByTestId('interactive-enemy');
    fireEvent.press(target);
    expect(onPoke).toHaveBeenLastCalledWith('poke');

    fireEvent.press(target);
    fireEvent.press(target);
    fireEvent.press(target);
    fireEvent.press(target);
    expect(onPoke).toHaveBeenLastCalledWith('rage_spin');
  });

  it('orchestrates live combat reactions via useEnemyConductor', () => {
    const { result } = renderHook(() =>
      useEnemyConductor({
        enemyName: 'Ancient Dragon',
        hp: 12,
        maxHp: 30,
        isBoss: true,
      })
    );

    expect(result.current.mood).toBe('enraged');

    act(() => result.current.triggerReaction('pain'));
    expect(result.current.reaction?.type).toBe('pain');

    act(() => result.current.triggerReaction('crit_pain'));
    expect(result.current.reaction?.type).toBe('crit_pain');

    act(() => result.current.triggerReaction('taunt'));
    expect(result.current.reaction?.type).toBe('taunt');

    act(() => result.current.triggerReaction('attack'));
    expect(result.current.reaction?.type).toBe('attack');

    act(() => result.current.triggerReaction('regen'));
    expect(result.current.reaction?.type).toBe('regen');
  });
});

describe('Custom Weapon Relics & Single-Tap Animation', () => {
  const uniqueWeaponNames = Array.from(new Set(WEAPONS.map((w) => w.name)));

  it('explicitly covers all 50 unique weapons in ALL_CUSTOM_WEAPON_NAMES', () => {
    expect(uniqueWeaponNames.length).toBe(50);
    const customSet = new Set(ALL_CUSTOM_WEAPON_NAMES);
    const missing = uniqueWeaponNames.filter((name) => !customSet.has(name));
    expect(missing).toEqual([]);
  });

  it('gives every weapon its own relic or an explicit generic-gem entry', () => {
    const custom = new Set(ALL_CUSTOM_WEAPON_NAMES);
    const gem = new Set(GENERIC_GEM_WEAPON_NAMES);
    const names = new Set(WEAPONS.map((w) => w.name));
    const unresolved = Array.from(names).filter((name) => !custom.has(name) && !gem.has(name));
    expect(unresolved).toEqual([]);
    expect(GENERIC_GEM_WEAPON_NAMES.filter((name) => custom.has(name))).toEqual([]);
  });

  it('maps weapons across all 8 category tap-animation archetypes', () => {
    expect(getWeaponTapStyle('Blast Powder')).toBe('explosive');
    expect(getWeaponTapStyle('Prismatic Ray')).toBe('laser');
    expect(getWeaponTapStyle('Chrono Shard')).toBe('chrono');
    expect(getWeaponTapStyle('Life Vessel')).toBe('vitality');
    expect(getWeaponTapStyle("Scholar's Tome")).toBe('tome');
    expect(getWeaponTapStyle("Fortune's Favor")).toBe('coin');
    expect(getWeaponTapStyle('Link Stone')).toBe('connector');
    expect(getWeaponTapStyle('Oracle Eye')).toBe('arcane');
  });

  it('renders every weapon relic cleanly across all rarities and fires single tap animation on press or triggerKey', () => {
    for (const weapon of WEAPONS) {
      const { getByTestId, unmount } = render(
        <WeaponAvatar testID={`weapon-${weapon.id}`} weapon={weapon} size={40} />
      );
      expect(getByTestId(`weapon-${weapon.id}`)).toBeTruthy();
      unmount();
    }

    const onPress = jest.fn();
    const { getByTestId, rerender } = render(
      <WeaponAvatar
        testID="interactive-weapon"
        weapon={WEAPONS[0]}
        size={48}
        interactive
        onPress={onPress}
        triggerKey={0}
      />
    );

    fireEvent.press(getByTestId('interactive-weapon'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getByTestId('weapon-tap-burst')).toBeTruthy();

    rerender(
      <WeaponAvatar
        testID="interactive-weapon"
        weapon={WEAPONS[0]}
        size={48}
        interactive
        onPress={onPress}
        triggerKey={1}
      />
    );
    expect(getByTestId('interactive-weapon')).toBeTruthy();
  });
});
