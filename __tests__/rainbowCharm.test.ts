/**
 * Verifies that:
 *  1. Base Set matching is clean (all-different Sets deal 1× base damage with
 *     no built-in Rainbow multiplier when no Rainbow gear/Arcana is equipped).
 *  2. Rainbow Charm (`rainbow-charm`) grants the ×2 Rainbow multiplier, works
 *     immediately on 2-trait intro levels (1-3 All Kinds), levels up, grows
 *     during a fight, shows up in the Balatro equation & GearBelt badges, and
 *     is credited cleanly in Brotato BattleDamageStory.
 *  3. Campaign placement: Rainbow Charm replaces Flint Spark on 1-2 ★★, while
 *     Flint Spark moves later to World 2 (2-1 ★★).
 */
import { BASE_RULES } from '@/adventure/data/rules';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getLevel } from '@/adventure/data/levels';
import { arcanaRules } from '@/adventure/data/arcana';
import { buildDamageStory } from '@/adventure/engine/damageStory';
import { buildBalatroBreakdown } from '@/adventure/fx/MultiplierIgnition';
import { isRainbow } from '@/adventure/engine/sets';
import { createNewSave, applyLevelResult } from '@/adventure/progress';
import type { Card } from '@/types';
import { eventsOf, playSet, startFight, testLevel, withWeapons } from './testUtils/adventureFight';

const makeRainbowBoard = (base: Card[], attrs: ('shape' | 'color' | 'number')[]): Card[] => {
  const next = [...base];
  const rainbowCards: Pick<Card, 'shape' | 'color' | 'number'>[] = [
    { shape: 'oval', color: 'red', number: 1 },
    { shape: 'diamond', color: 'green', number: 2 },
    { shape: 'squiggle', color: 'purple', number: 3 },
  ];
  for (let i = 0; i < 3; i++) {
    next[i] = {
      ...next[i],
      shape: rainbowCards[i].shape,
      color: rainbowCards[i].color,
      number: attrs.includes('number') ? rainbowCards[i].number : 1,
      shading: 'solid',
      bonusPoints: undefined,
      bonusMoney: undefined,
    };
  }
  return next;
};

describe('clean base Rainbow rules & Rainbow Charm intro weapon', () => {
  it('removes built-in 2× Rainbow damage from the clean base game', () => {
    expect(BASE_RULES.rainbowMultiplier).toBe(1);

    let s = startFight({
      level: testLevel({ rules: { attributes: ['shape', 'color', 'number'], boardSize: 12 }, foes: [{ name: 'Target', icon: 'lorc/target-dummy', hp: 100 }] }),
      features: ['hearts', 'gear'],
    });
    s = { ...s, board: makeRainbowBoard(s.board, ['shape', 'color', 'number']) };
    const set = s.board.slice(0, 3);
    expect(isRainbow(set, s.attributes)).toBe(true);

    const after = playSet(s, set);
    const lastEntry = after.log[after.log.length - 1];
    expect(lastEntry.set?.multiplier).toBe(1);
    expect(lastEntry.set?.rainbow).toBe(false);
    expect(lastEntry.set?.multItems).toBeUndefined();
    expect(lastEntry.set?.hit).toBe(3);
    // Clean base hit emits 'hit', not a flashy 'rainbow' multiplier event
    expect(eventsOf(after, 'rainbow')).toHaveLength(0);
    expect(eventsOf(after, 'hit').length).toBeGreaterThanOrEqual(1);
    // All-different Sets are still tracked for challenges & bounties
    expect(after.roundStats.allDifferentMatches).toBe(1);
  });

  it('Rainbow Charm doubles all-different Sets (including 2-trait 1-3 All Kinds) and credits the weapon across Balatro UI, GearBelt & DamageStory', () => {
    const charm = getArmoryWeapon('rainbow-charm')!;
    expect(charm).toBeDefined();
    expect(charm.name).toBe('Rainbow Charm');

    // Works immediately on 2-trait level 1-3 (All Kinds)
    let s = withWeapons(
      startFight({
        level: getLevel('1-3'),
        features: ['hearts', 'gear'],
      }),
      charm
    );
    s = { ...s, board: makeRainbowBoard(s.board, ['shape', 'color']) };
    const set = s.board.slice(0, 3);
    expect(isRainbow(set, s.attributes)).toBe(true);

    const after = playSet(s, set);
    const lastEntry = after.log[after.log.length - 1];
    expect(lastEntry.set?.multiplier).toBe(2);
    expect(lastEntry.set?.rainbow).toBe(true);
    expect(lastEntry.set?.hit).toBe(6);
    expect(lastEntry.set?.multItems).toContainEqual(
      expect.objectContaining({ label: 'Rainbow Charm', amount: 2, sourceRef: 'weapon:rainbow-charm' })
    );
    expect(eventsOf(after, 'rainbow').length).toBeGreaterThanOrEqual(1);

    // Balatro breakdown names Rainbow Charm cleanly
    expect(after.lastSetIgnition).toBeTruthy();
    const breakdown = buildBalatroBreakdown(after.lastSetIgnition!);
    expect(breakdown.receiptLine).toContain('×2 Rainbow Charm');

    // GearBelt trigger badge shows ×2 on Rainbow Charm
    expect(after.lastSetIgnition!.beltBadges?.['rainbow-charm']).toEqual({ kind: 'mult', text: '×2' });

    // Brotato Damage Story attributes the bonus damage directly to Rainbow Charm
    const story = buildDamageStory(after);
    const charmSource = story.sources.find(src => src.weaponId === 'rainbow-charm');
    expect(charmSource).toBeDefined();
    expect(charmSource!.totalDamage).toBeCloseTo(3, 1);
  });

  it('grows Rainbow Charm multiplier every 2 Rainbow Sets and scales cleanly with weapon level', () => {
    const lv1 = getArmoryWeapon('rainbow-charm', { 'rainbow-charm': { level: 1, tuning: {} } })!;
    const lv3 = getArmoryWeapon('rainbow-charm', { 'rainbow-charm': { level: 3, tuning: {} } })!;
    expect(lv1.description).toContain('×2');
    expect(lv3.description).toContain('×2.5');

    let s = withWeapons(
      startFight({
        level: testLevel({ rules: { attributes: ['shape', 'color', 'number'], boardSize: 12 }, foes: [{ name: 'Target', icon: 'lorc/target-dummy', hp: 500 }] }),
        features: ['hearts', 'gear'],
      }),
      lv1
    );

    // Play 2 Rainbow Sets -> triggers +0.25× growth stack (×2 -> ×2.25)
    for (let i = 0; i < 2; i++) {
      s = { ...s, board: makeRainbowBoard(s.board, ['shape', 'color', 'number']) };
      s = playSet(s, s.board.slice(0, 3));
    }
    // 3rd Rainbow Set uses the grown ×2.25 multiplier
    s = { ...s, board: makeRainbowBoard(s.board, ['shape', 'color', 'number']) };
    s = playSet(s, s.board.slice(0, 3));
    const third = s.log[s.log.length - 1];
    expect(third.set?.multiplier).toBeCloseTo(2.25, 2);
  });

  it('places Rainbow Charm on 1-2 ★★ and moves Flint Spark later to World 2 (2-1 ★★)', () => {
    const l12 = getLevel('1-2');
    const l21 = getLevel('2-1');
    expect(l12.rewards.star2.weapons).toEqual(['rainbow-charm']);
    expect(l12.rewards.star2.weapons).not.toContain('flint-spark');
    expect(l21.rewards.star2.weapons).toContain('flint-spark');

    // Earning ★★ on 1-2 unlocks and auto-equips Rainbow Charm into the player's belt
    const applied = applyLevelResult(createNewSave(), l12, 2, 0);
    expect(applied.save.armory).toContain('rainbow-charm');
    expect(applied.save.charms).toContain('rainbow-charm');
    expect(applied.save.armory).not.toContain('flint-spark');
  });

  it('gives Monochrome Pact a real 0.5× Rainbow tradeoff while combining with Prismatic Fever to 1.5×', () => {
    expect(arcanaRules('monochrome_pact').rainbowMultiplier).toBe(0.5);
    expect(arcanaRules('prismatic_fever').rainbowMultiplier).toBe(3);
    expect(arcanaRules(['monochrome_pact', 'prismatic_fever']).rainbowMultiplier).toBeCloseTo(1.5);
  });
});
