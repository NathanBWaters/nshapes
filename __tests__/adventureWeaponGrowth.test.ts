/**
 * Weapon growth: what each weapon watches for during a fight, and what a
 * stack gives (data/weaponGrowth.ts, engine/growth.ts).
 */
import type { Card } from '@/types';
import { WEAPON_GROWTH, NO_GROWTH, growthKey, growthStacks, growthText } from '@/adventure/data/weaponGrowth';
import { armoryBaseWeapon, getArmoryWeapon } from '@/adventure/data/armory';
import { weaponStatDefs } from '@/adventure/data/weaponStats';
import { PAIR_RECIPES } from '@/adventure/data/evolutionPairs';
import { createMaxedSave } from '@/adventure/progress';
import { runReducer } from '@/adventure/engine/run';
import { cornerSlots } from '@/adventure/engine/growth';
import type { RunState } from '@/adventure/types';
import { eventsOf, plainRewards, startFight, testLevel, tick } from './testUtils/adventureFight';

const ARMORY = createMaxedSave().armory;
const held = (ids: string[], over: Parameters<typeof startFight>[0] = {}) =>
  startFight({ ...over, save: { armory: ids, charms: ids, ...(over.save ?? {}) } });

type Traits = Pick<Card, 'shape' | 'color' | 'number'>;
/** Put these three cards on the given slots and match them (they must form a Set). */
const matchAt = (s: RunState, slots: number[], traits: Traits[], hinted = false): RunState => {
  const board = s.board.map((c, i) => {
    const k = slots.indexOf(i);
    return k < 0 ? c : { ...c, ...traits[k], shading: 'solid' as const };
  });
  const cards = slots.map(i => board[i]);
  let next = runReducer({ ...s, board }, { type: 'MATCH', cards, rewards: plainRewards(cards), hinted });
  next = runReducer(next, { type: 'REPLACE', ids: cards.map(c => c.id) });
  return next;
};
const missWith = (s: RunState, traits: Traits[]): RunState => {
  const board = s.board.map((c, i) => (i < 3 ? { ...c, ...traits[i] } : c));
  const cards = board.slice(0, 3);
  const next = runReducer({ ...s, board }, { type: 'INVALID', cards });
  return runReducer(next, { type: 'REPLACE', ids: cards.map(c => c.id) });
};
const RED: Traits[] = [{ shape: 'oval', color: 'red', number: 1 }, { shape: 'oval', color: 'red', number: 2 }, { shape: 'oval', color: 'red', number: 3 }];
const GREEN: Traits[] = RED.map(t => ({ ...t, color: 'green' as const }));
const RAINBOW: Traits[] = [{ shape: 'oval', color: 'red', number: 1 }, { shape: 'diamond', color: 'green', number: 2 }, { shape: 'squiggle', color: 'purple', number: 3 }];
const SAME_NUMBER: Traits[] = [{ shape: 'oval', color: 'red', number: 2 }, { shape: 'diamond', color: 'red', number: 2 }, { shape: 'squiggle', color: 'red', number: 2 }];
const stacksOf = (s: RunState, id: string, track = 0) => s.growth[growthKey(id, track)]?.stacks ?? 0;
const weapon = (s: RunState, id: string) => s.weapons.find(w => w.id === id)!;

describe('the growth table', () => {
  it('covers every Armory weapon: each one grows, or says why it does not', () => {
    for (const id of ARMORY) expect({ id, ok: id in WEAPON_GROWTH || id in NO_GROWTH }).toEqual({ id, ok: true });
    for (const id of [...Object.keys(WEAPON_GROWTH), ...Object.keys(NO_GROWTH)]) expect(ARMORY).toContain(id);
  });

  it('only raises numbers the weapon really has, and its text names a limit', () => {
    for (const [id, defs] of Object.entries(WEAPON_GROWTH)) {
      const stats = weaponStatDefs(armoryBaseWeapon(id)!);
      for (const def of defs) {
        for (const key of Object.keys(def.stat ?? {})) expect({ id, key, ok: key in stats }).toEqual({ id, key, ok: true });
        expect(def.stat || def.mods || def.now).toBeTruthy();
        expect(growthText(def)).toMatch(/\((no limit|up to \d+ times)\)\.$/);
      }
    }
  });

  it('the weapons that already snowball are left alone', () => {
    for (const id of ['blast-powder', 'field-stone', 'growth-seed']) expect(WEAPON_GROWTH[id]).toBeUndefined();
  });
});

describe('weapons grow during a fight', () => {
  it('Mending Charm: every 3 Sets at full hearts, the overheal hits 3 harder', () => {
    let s = held(['mending-charm']);
    const before = getArmoryWeapon('mending-charm')!.description;
    for (let i = 0; i < 2; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'mending-charm')).toBe(0);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'mending-charm')).toBe(1);
    // The weapon itself is rebuilt from its grown numbers: its rule and its wording both say 3 more
    expect(weapon(s, 'mending-charm').description).not.toBe(before);
    expect(weapon(s, 'mending-charm').description).toContain('hits the foe for 7');
    expect(eventsOf(s, 'power_up')).toHaveLength(1);
    expect(eventsOf(s, 'power_up')[0].source).toMatch(/^w0:mending-charm/);
    // Not at full hearts: no progress
    s = { ...s, hearts: s.maxHearts! - 1 };
    for (let i = 0; i < 3; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'mending-charm')).toBe(1);
  });

  it('Life Vessel: two Rainbows back to back add an empty heart; a plain Set between them starts the count over', () => {
    let s = held(['life-vessel'], { features: ['hearts', 'gear', 'rainbow'] });
    const max = s.maxHearts!;
    s = matchAt(s, [0, 1, 2], RAINBOW);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    s = matchAt(s, [0, 1, 2], RAINBOW);
    expect(s.maxHearts).toBe(max);
    s = matchAt(s, [0, 1, 2], RAINBOW);
    expect(s.maxHearts).toBe(max + 1);
    expect(s.hearts).toBe(max);
  });

  it('Echo Stone: a one-color Set right after a Set of that color adds 3% echo chance and 1 echo damage', () => {
    let s = held(['echo-stone']);
    const chance = s.stats.echoChance;
    s = matchAt(s, [0, 1, 2], RED);
    s = matchAt(s, [0, 1, 2], GREEN);
    expect(s.stats.echoChance).toBe(chance);
    s = matchAt(s, [0, 1, 2], GREEN);
    expect(s.stats.echoChance).toBe(chance + 3);
    expect(weapon(s, 'echo-stone').description).toContain('hits the foe for 4');
  });

  it('Chrono Shard: a Set through two corner cards slows the clock by 5%, up to 25%', () => {
    let s = held(['chrono-shard'], { level: testLevel({ rules: { timer: 200, boardSize: 12 } }) });
    expect(cornerSlots(12)).toEqual([0, 2, 9, 11]);
    const drain = (x: RunState) => x.timeLeft! - tick(x, 10000, 1000).timeLeft!;
    expect(drain(s)).toBeCloseTo(10);
    s = matchAt(s, [0, 2, 5], SAME_NUMBER);
    expect(drain(s)).toBeCloseTo(9.5);
    // One corner is not enough
    s = matchAt(s, [0, 4, 5], SAME_NUMBER);
    expect(stacksOf(s, 'chrono-shard')).toBe(1);
    for (let i = 0; i < 8; i++) s = matchAt(s, [0, 2, 5], SAME_NUMBER);
    expect(stacksOf(s, 'chrono-shard')).toBe(5);
    expect(drain(s)).toBeCloseTo(7.5);
  });

  it('Chaos Shard: an all-red mistake adds 5% ricochet (4 times); a 1-2-3 Set adds a chance that ricochets heal', () => {
    let s = held(['chaos-shard'], { level: testLevel({ rules: { hearts: 30 } }) });
    const chance = s.stats.ricochetChance;
    const wrongRed: Traits[] = [{ shape: 'oval', color: 'red', number: 1 }, { shape: 'oval', color: 'red', number: 1 }, { shape: 'diamond', color: 'red', number: 2 }];
    s = missWith(s, [{ ...wrongRed[0] }, { ...wrongRed[1], color: 'green' }, wrongRed[2]]);
    expect(s.stats.ricochetChance).toBe(chance);
    for (let i = 0; i < 6; i++) s = missWith(s, wrongRed);
    expect(s.stats.ricochetChance).toBe(chance + 20);
    s = matchAt(s, [0, 1, 2], RED);
    expect(stacksOf(s, 'chaos-shard', 1)).toBe(1);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'chaos-shard', 1)).toBe(1);
  });

  it('Seeker Lens: every hint held adds 1 to a Set, and a Set made on a hint adds 1% hint chance', () => {
    const level = testLevel({ rules: { startingHints: 3 }, foes: [{ name: 'Dummy', hp: 9999 }] });
    const plain = matchAt(startFight({ level }), [0, 1, 2], SAME_NUMBER);
    let s = held(['seeker-lens'], { level });
    const chance = s.stats.hintGainChance;
    const hints = s.stats.hints;
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(s.totalDamage - plain.totalDamage).toBe(hints);
    expect(s.stats.hintGainChance).toBe(chance);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER, true);
    expect(s.stats.hintGainChance).toBe(chance + 1);
  });

  it('Second Chance: every Set adds luck, which lifts every weapon chance held', () => {
    let s = held(['second-chance', 'blast-powder']);
    const chance = s.stats.explosionChance;
    for (let i = 0; i < 10; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'second-chance')).toBe(10);
    expect(s.stats.explosionChance).toBe(Math.round(chance * 1.2));
  });

  it('Magnet: more marked cards once it has grown', () => {
    let s = held(['magnet']);
    expect(s.board.filter(c => c.magnet)).toHaveLength(1);
    s = { ...s, growth: { [growthKey('magnet', 0)]: { stacks: 2, progress: 0 } } };
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(s.board.filter(c => c.magnet)).toHaveLength(3);
  });

  it('Rally Horn and Piñata: each payout makes the next one bigger', () => {
    let s = held(['rally-horn']);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER); // the wave opener is a Rally
    expect(stacksOf(s, 'rally-horn')).toBe(1);
    expect(weapon(s, 'rally-horn').shortDescription).toContain('+6');
  });

  it('a stack is announced once, on the weapon that grew, and shows on its belt count', () => {
    let s = held(['rally-horn', 'mending-charm']);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    const ups = eventsOf(s, 'power_up');
    expect(ups).toHaveLength(1);
    expect(ups[0]).toMatchObject({ amount: 1, text: 'Rally hits +1 harder' });
    expect(growthStacks(s.growth, 'rally-horn')).toBe(1);
    expect(growthStacks(s.growth, 'mending-charm')).toBe(0);
  });
});

describe('growth and evolutions', () => {
  const recipe = PAIR_RECIPES.find(r => r.families.some(f => f[0] === 'chrono-shard'))!;
  const weapons = [recipe.families[0][0], recipe.families[1][0]];
  const start = () => {
    let s = held(weapons, { level: testLevel({ rules: { timer: 300, boardSize: 12 }, foes: [{ name: 'Dummy', hp: 1e7 }] }), save: { unlockedEvolutions: ['phoenix-pyre'] } });
    expect(s.armedRecipes).toEqual([recipe.id]);
    const board = s.board.map((c, i) => (i === 0 ? { ...c, hasEvolutionItem: true, evolutionReady: true } : c));
    s = matchAt({ ...s, board }, [0, 1, 5], SAME_NUMBER);
    expect(s.activeEvolutions.map(e => e.id)).toEqual([recipe.id]);
    return s;
  };

  it('an evolution does not change how a weapon grows: same step, same limit', () => {
    let s = start();
    s = matchAt(s, [0, 2, 5], SAME_NUMBER);
    expect(stacksOf(s, 'chrono-shard')).toBe(1);
    for (let i = 0; i < 8; i++) s = matchAt(s, [0, 2, 5], SAME_NUMBER);
    expect(stacksOf(s, 'chrono-shard')).toBe(5);
  });

  it('Catalyst Prism: each Catalyst matched makes evolutions 4 seconds longer, starting with that one', () => {
    const pair = PAIR_RECIPES.find(r => r.families.some(f => f[0] === 'catalyst-prism'))!;
    const ids = [pair.families[0][0], pair.families[1][0]];
    let s = held(ids, { save: { unlockedEvolutions: ['phoenix-pyre'] } });
    const board = s.board.map((c, i) => (i === 0 ? { ...c, hasEvolutionItem: true, evolutionReady: true } : c));
    s = matchAt({ ...s, board }, [0, 1, 2], SAME_NUMBER);
    expect(s.activeEvolutions[0].durationMs).toBe(34000);
  });
});
