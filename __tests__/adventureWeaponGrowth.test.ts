/**
 * Weapon growth: what each weapon watches for during a fight, and what a
 * stack gives (data/weaponGrowth.ts, engine/growth.ts).
 */
import type { Card } from '@/types';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import { WEAPON_GROWTH, NO_GROWTH, growthKey, growthStacks, growthText } from '@/adventure/data/weaponGrowth';
import { armoryBaseWeapon, getArmoryWeapon } from '@/adventure/data/armory';
import { MAX_TUNING_TIER, MAX_WEAPON_LEVEL, weaponStatDefs, weaponValues } from '@/adventure/data/weaponStats';
import { weaponGuide } from '@/adventure/data/weaponGuide';
import { EFFECT_CAPS, STAT_TO_CAP_TYPE } from '@/game/effectCaps';
import { PAIR_RECIPES } from '@/adventure/data/evolutionPairs';
import { createMaxedSave } from '@/adventure/progress';
import { startingLoadout } from '@/adventure/loadout';
import { runReducer } from '@/adventure/engine/run';
import { cornerSlots } from '@/adventure/engine/growth';
import type { AdventureWeapon, RunState } from '@/adventure/types';
import { eventsOf, plainRewards, startFight, testLevel, tick } from './testUtils/adventureFight';

const ARMORY = createMaxedSave().armory;
const held = (ids: string[], over: Parameters<typeof startFight>[0] = {}) =>
  startFight({ ...over, save: { armory: ids, charms: ids, ...(over.save ?? {}) } });

const makeFx = (over: Partial<WeaponEffectResult>): WeaponEffectResult => ({
  explosiveCards: [],
  laserCards: [],
  laserCount: 0,
  fireCards: [],
  ricochetCards: [],
  ricochetCount: 0,
  autoMatchedSets: [],
  bonusPoints: 0,
  bonusMoney: 0,
  bonusTime: 0,
  bonusGraces: 0,
  bonusHealing: 0,
  bonusHints: 0,
  bonusExperience: 0,
  bonusCoins: 0,
  boardGrowth: 0,
  notifications: [],
  timeGainTriggered: false,
  ...over,
});

type Traits = Pick<Card, 'shape' | 'color' | 'number'>;
/** Put these three cards on the given slots and match them (they must form a Set). */
const matchAt = (
  s: RunState,
  slots: number[],
  traits: Traits[],
  hinted = false,
  fx?: Partial<WeaponEffectResult>
): RunState => {
  const board = s.board.map((c, i) => {
    const k = slots.indexOf(i);
    return k < 0 ? c : { ...c, ...traits[k], shading: 'solid' as const };
  });
  const cards = slots.map(i => board[i]);
  const effects = fx ? makeFx(fx) : undefined;
  let next = runReducer({ ...s, board }, { type: 'MATCH', cards, rewards: plainRewards(cards), hinted, effects });
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
const SAME_NUMBER: Traits[] = [{ shape: 'oval', color: 'red', number: 2 }, { shape: 'diamond', color: 'red', number: 2 }, { shape: 'squiggle', color: 'red', number: 2 }];
const stacksOf = (s: RunState, id: string, track = 0) => s.growth[growthKey(id, track)]?.stacks ?? 0;
const weapon = (s: RunState, id: string) => s.weapons.find(w => w.id === id)! as AdventureWeapon;

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
        expect(def.stat || def.mods || def.now || def.proc).toBeTruthy();
        expect(growthText(def)).toMatch(/\((no limit|up to \d+ times)\)\.$/);
      }
    }
  });

  it('the board-size weapons that already snowball are left alone, while Blast Powder has modest growth', () => {
    for (const id of ['field-stone', 'growth-seed']) expect(WEAPON_GROWTH[id]).toBeUndefined();
    expect(WEAPON_GROWTH['blast-powder']).toHaveLength(1);
    expect(WEAPON_GROWTH['blast-powder'][0]).toMatchObject({ every: 3, max: 4, stat: { explosionDamage: 0.25 } });
  });
});

describe('weapons grow during a fight', () => {
  it('Mending Charm: every 4 Sets at full hearts adds +1% heal chance and 1 Over-Shield (pure survival, no raw DPS rider)', () => {
    let s = held(['mending-charm']);
    const beforeChance = s.stats.healingChance;
    for (let i = 0; i < 3; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'mending-charm')).toBe(0);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'mending-charm')).toBe(1);
    expect(s.stats.healingChance).toBe(beforeChance + 1);
    expect(s.freeMistakesLeft).toBeGreaterThanOrEqual(1);
    expect(eventsOf(s, 'power_up')).toHaveLength(1);
    expect(eventsOf(s, 'power_up')[0].source).toMatch(/^w0:mending-charm/);
    // Not at full hearts: no progress
    s = { ...s, hearts: s.maxHearts! - 1 };
    for (let i = 0; i < 4; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'mending-charm')).toBe(1);
  });

  it('Life Vessel: every 4 Sets at full hearts adds an empty max heart ([GP-09])', () => {
    let s = held(['life-vessel'], { features: ['hearts', 'gear', 'rainbow'] });
    const max = s.maxHearts!;
    for (let i = 0; i < 3; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(s.maxHearts).toBe(max);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(s.maxHearts).toBe(max + 1);
    expect(s.hearts).toBe(max);
  });

  it('Echo Stone: every 2 echoes adds +2% echo chance and +1 echo damage ([GP-09])', () => {
    let s = held(['echo-stone']);
    const chance = s.stats.echoChance;
    const w = weapon(s, 'echo-stone');
    s = matchAt(s, [0, 1, 2], SAME_NUMBER, false, { autoMatchedSets: [s.board.slice(3, 6)] });
    expect(stacksOf(s, 'echo-stone')).toBe(0);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER, false, { autoMatchedSets: [s.board.slice(3, 6)] });
    expect(stacksOf(s, 'echo-stone')).toBe(1);
    expect(s.stats.echoChance).toBe(chance + 2);
    expect(weapon(s, 'echo-stone').description).not.toBe(w.description);
    expect(weapon(s, 'echo-stone').description).toContain('hits the foe for 4');
  });

  it('Chrono Shard: starts at 5% clock slow and slows by 5% every 3 Sets, up to 5 stacks ([GP-09], [GP-11])', () => {
    let s = held(['chrono-shard'], { level: testLevel({ rules: { timer: 200, boardSize: 12 } }) });
    expect(cornerSlots(12)).toEqual([0, 2, 9, 11]);
    const drain = (x: RunState) => x.timeLeft! - tick(x, 10000, 1000).timeLeft!;
    // Base Lv1 Chrono Shard starts with 5% clock slow
    expect(drain(s)).toBeCloseTo(9.5);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'chrono-shard')).toBe(0);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'chrono-shard')).toBe(1);
    expect(drain(s)).toBeCloseTo(9.0);
    for (let i = 0; i < 15; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'chrono-shard')).toBe(5);
    expect(drain(s)).toBeLessThanOrEqual(7.5);
  });

  it('Chaos Shard: every 3 ricochets adds +3% ricochet chance, +0.25 dmg, and +3% ricochet heal chance ([GP-09])', () => {
    let s = held(['chaos-shard'], { level: testLevel({ rules: { hearts: 30 } }) });
    const chance = s.stats.ricochetChance;
    for (let i = 0; i < 3; i++) {
      s = matchAt(s, [0, 1, 2], SAME_NUMBER, false, { ricochetCards: [s.board[3]], ricochetCount: 1 });
    }
    expect(stacksOf(s, 'chaos-shard')).toBe(1);
    expect(s.stats.ricochetChance).toBe(chance + 3);
  });

  it('Seeker Lens: every hint held adds 1.5 dmg to a Set, and a Set made on a hint adds 1% hint chance ([GP-11])', () => {
    const level = testLevel({ rules: { startingHints: 3 }, foes: [{ name: 'Dummy', hp: 9999 }] });
    const plain = matchAt(startFight({ level }), [0, 1, 2], SAME_NUMBER);
    let s = held(['seeker-lens'], { level });
    const chance = s.stats.hintGainChance;
    const hints = s.stats.hints;
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(s.totalDamage - plain.totalDamage).toBe(Math.round(hints * 1.5));
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

describe('every trick weapon changes its own game as it grows', () => {
  const grown = (id: string, stacks: number, over: Parameters<typeof startFight>[0] = {}): RunState => {
    const s = held([id], over);
    // Stacks are put in by hand, then one plain Set lets the fight catch up with them
    return matchAt({ ...s, growth: { [growthKey(id, 0)]: { stacks, progress: 0 } } }, [3, 4, 5], SAME_NUMBER);
  };

  it('no two weapons share a scaling line', () => {
    const lines = Object.values(WEAPON_GROWTH).flat().map(def => def.gives);
    const repeats = lines.filter((line, i) => lines.indexOf(line) !== i);
    // Only the two vessels (Life Vessel, Soul Harvest) reach the same reward, by different roads
    expect(repeats).toEqual(['+1 max heart (it arrives empty)']);
  });

  it('Wild Card: more wild cards may be on the board at once', () => {
    const s = grown('wild-card', 2);
    const three = { ...s, board: s.board.map((c, i) => (i < 4 ? { ...c, isWild: true } : c)) };
    const after = runReducer(three, { type: 'TICK', ms: 250 });
    expect(after.board.filter(c => c.isWild)).toHaveLength(3);
    const plain = runReducer({ ...three, growth: {} }, { type: 'TICK', ms: 250 });
    expect(plain.board.filter(c => c.isWild)).toHaveLength(1);
  });

  it('Greedy Chest: every chest you open raises its floor, and a mistake never drops it lower', () => {
    let s = tick(held(['greedy-chest']), 1000);
    const floor = weapon(s, 'greedy-chest').modifiers!.chestStart!;
    const chestSlot = () => s.board.findIndex(c => c.chest !== undefined);
    expect(s.board[chestSlot()].chest).toBe(floor);
    for (let opened = 1; opened <= 4; opened++) {
      const at = chestSlot();
      const others = [0, 1, 2, 3].filter(i => i !== at).slice(0, 2);
      s = tick(matchAt(s, [at, ...others], SAME_NUMBER), 1000);
      // Three opens raise it, the fourth is past the limit
      expect(stacksOf(s, 'greedy-chest')).toBe(Math.min(3, opened));
      expect(s.board[chestSlot()].chest).toBe(floor + Math.min(3, opened));
    }
    // Leave it one Set, then miss: what it grew is lost, the raised floor is not
    const away = [0, 1, 2, 3, 4].filter(i => i !== chestSlot()).slice(0, 3);
    s = matchAt(s, away, SAME_NUMBER);
    expect(s.board[chestSlot()].chest).toBeGreaterThan(floor + 3);
    const cards = away.map(i => s.board[i]);
    s = runReducer(s, { type: 'INVALID', cards });
    expect(s.board[chestSlot()].chest).toBe(floor + 3);
  });

  it('Tar Pit: the pit spreads to more rows', () => {
    expect(new Set(held(['tar-pit']).board.map((c, i) => (c.tar ? Math.floor(i / 3) : -1)).filter(r => r >= 0)).size).toBe(1);
    const s = grown('tar-pit', 2);
    expect(new Set(s.board.map((c, i) => (c.tar ? Math.floor(i / 3) : -1)).filter(r => r >= 0)).size).toBe(3);
  });

  it('Glass Sword: a reforged sword survives a shatter, once per stack', () => {
    let s = grown('glass-sword', 1, { level: testLevel({ rules: { hearts: 30 } }) });
    s = missWith(s, [RED[0], RED[0], GREEN[1]]);
    expect(s.gear.glassBroken).toBe(false);
    expect(s.gear.glassSparesUsed).toBe(1);
    s = missWith(s, [RED[0], RED[0], GREEN[1]]);
    expect(s.gear.glassBroken).toBe(true);
  });

  it('Snowball: reaching its limit raises the limit', () => {
    let s = held(['snowball']);
    const cap = Math.round(weapon(s, 'snowball').modifiers!.snowballMax!);
    for (let i = 0; i < cap; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(stacksOf(s, 'snowball')).toBe(1);
    expect(Math.round(weapon(s, 'snowball').modifiers!.snowballMax!)).toBe(cap + 1);
  });

  it('Mirror Shard: reusing two spots makes it remember one Set further back', () => {
    let s = held(['mirror-shard']);
    s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    s = matchAt(s, [0, 1, 5], SAME_NUMBER);
    expect(stacksOf(s, 'mirror-shard')).toBe(1);
    // Two Sets ago used slot 2; the last one did not
    s = runReducer(s, { type: 'CLEAR_EVENTS', upTo: s.eventSeq });
    s = matchAt(s, [2, 7, 8], SAME_NUMBER);
    expect(eventsOf(s, 'rule').some(e => e.text === 'Mirror!')).toBe(true);
  });

  it('Bounty Poster: finished posters get bigger', () => {
    const s = grown('bounty-poster', 2);
    const next = runReducer({ ...s, gear: { ...s.gear, bounty: null } }, { type: 'TICK', ms: 250 });
    expect(next.gear.bounty!.left).toBe(5);
  });

  it('a stack that makes something more likely: Grace Conduit\'s spent graces start coming back', () => {
    const level = testLevel({ rules: { startingGraces: 1 }, foes: [{ name: 'Dummy', hp: 1e6 }] });
    let back = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = held(['grace-conduit'], { level, seed });
      s = { ...s, growth: { [growthKey('grace-conduit', 0)]: { stacks: 4, progress: 0 } } };
      const before = s.stats.graces;
      // A near miss that a grace covers
      const board = s.board.map((c, i) => (i < 3 ? { ...c, ...[RED[0], RED[1], { ...RED[2], color: 'green' as const }][i], shading: 'solid' as const } : c));
      const cards = board.slice(0, 3);
      const rewards = plainRewards(cards).map((r, i) => (i === 0 ? { ...r, effectType: 'grace' as const } : r));
      s = runReducer({ ...s, board }, { type: 'MATCH', cards, rewards });
      if (s.stats.graces >= before) back += 1;
    }
    // 4 stacks × 15% = 60%
    expect(back).toBeGreaterThan(12);
    expect(back).toBeLessThan(36);
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
    // start() already made 1 Catalyst Set; 2 more reach chrono-shard's first 3-Set stack
    s = matchAt(s, [0, 2, 5], SAME_NUMBER);
    s = matchAt(s, [0, 2, 5], SAME_NUMBER);
    expect(stacksOf(s, 'chrono-shard')).toBe(1);
    for (let i = 0; i < 15; i++) s = matchAt(s, [0, 2, 5], SAME_NUMBER);
    expect(stacksOf(s, 'chrono-shard')).toBe(5);
  });

  it('Catalyst Prism: each Catalyst matched makes evolutions 6 seconds longer (max 3 stacks), starting with that one', () => {
    const pair = PAIR_RECIPES.find(r => r.families.some(f => f[0] === 'catalyst-prism'))!;
    const ids = [pair.families[0][0], pair.families[1][0]];
    let s = held(ids, { save: { unlockedEvolutions: ['phoenix-pyre'] } });
    const board = s.board.map((c, i) => (i === 0 ? { ...c, hasEvolutionItem: true, evolutionReady: true } : c));
    s = matchAt({ ...s, board }, [0, 1, 2], SAME_NUMBER);
    expect(s.activeEvolutions[0].durationMs).toBe(36000);
    expect(WEAPON_GROWTH['catalyst-prism'][0].max).toBe(3);
    expect(WEAPON_GROWTH['encore-mask'][0].max).toBe(2);
  });
});

describe('Wave 2 weapons overhaul invariants & reworks', () => {
  it('zero Workshop clamp waste across ALL 64 weapons (bridgeChance ≤ 95%, all capped stats L5+T4+maxGrowth ≤ EFFECT_CAPS, zero dead rounded tiers)', () => {
    for (const id of ARMORY) {
      const base = armoryBaseWeapon(id)!;
      const defs = weaponStatDefs(base);
      const maxTuning = Object.fromEntries(Object.keys(defs).map(k => [k, MAX_TUNING_TIER]));
      const vals = weaponValues(base, { level: MAX_WEAPON_LEVEL, tuning: maxTuning });
      if (vals.bridgeChance !== undefined) {
        expect({ id, bridgeChance: vals.bridgeChance }).toEqual({ id, bridgeChance: expect.any(Number) });
        expect(vals.bridgeChance).toBeLessThanOrEqual(95);
      }
      if (vals.chainReactionChance !== undefined) expect(vals.chainReactionChance).toBeLessThanOrEqual(100);
      if (vals.bonusConnectionChance !== undefined) expect(vals.bonusConnectionChance).toBeLessThanOrEqual(100);

      // Every capped PlayerStats field at L5+T4 + full finite growth must stay at or below its EFFECT_CAPS ceiling!
      for (const [statKey, maxVal] of Object.entries(vals)) {
        const capType = STAT_TO_CAP_TYPE[statKey];
        if (!capType) continue;
        const cap = EFFECT_CAPS[capType].defaultCap;
        const growthAdd = (WEAPON_GROWTH[id] ?? []).reduce(
          (sum, g) => sum + (g.stat?.[statKey] ?? 0) * (g.max ?? 0),
          0
        );
        expect({ id, statKey, total: Math.round((maxVal + growthAdd) * 100) / 100, ok: maxVal + growthAdd <= cap }).toEqual({
          id,
          statKey,
          total: Math.round((maxVal + growthAdd) * 100) / 100,
          ok: true,
        });
      }

      // Every tunable AdventureWeapon stat must produce strictly different built rules/modifiers across tiers T0..T4 at every level L1..L5!
      const adv = base as AdventureWeapon;
      if (adv.stats && adv.build) {
        for (const [statKey, def] of Object.entries(adv.stats)) {
          if (def.tunable === false) continue;
          for (let lvl = 1; lvl <= MAX_WEAPON_LEVEL; lvl++) {
            const snapshots = [0, 1, 2, 3, 4].map(tier => {
              const built = getArmoryWeapon(id, { [id]: { level: lvl, tuning: { [statKey]: tier } } }) as AdventureWeapon;
              return JSON.stringify({ rules: built.rules, modifiers: built.modifiers });
            });
            expect({ id, statKey, lvl, distinctTiers: new Set(snapshots).size }).toEqual({ id, statKey, lvl, distinctTiers: 5 });
          }
        }
      }
    }
  });

  it('Crystal Orb L1 Workshop tuning grants guaranteed whole-unit starting hints without random fight-start rounding ([GP-19])', () => {
    const base = armoryBaseWeapon('crystal-orb')!;
    const lv1T4 = getArmoryWeapon('crystal-orb', { 'crystal-orb': { level: 1, tuning: { maxHints: 4 } } })!;
    expect(lv1T4.effects.maxHints).toBe(4);
    expect(lv1T4.effects.hints).toBe(4);
    // Deterministic regardless of rand()
    const save = { ...createMaxedSave(), charms: ['crystal-orb'], skillNodes: {}, equippedArcana: [], upgrades: {}, weaponTuning: { 'crystal-orb': { maxHints: 4 } } };
    const lv1Build = { 'crystal-orb': { level: 1, tuning: { maxHints: 4 } } };
    const highRoll = startingLoadout(testLevel({ rules: { startingHints: 0 } }), save, new Set(['hearts', 'gear', 'hints']), () => 0.1, { weaponBuilds: lv1Build });
    const lowRoll = startingLoadout(testLevel({ rules: { startingHints: 0 } }), save, new Set(['hearts', 'gear', 'hints']), () => 0.9, { weaponBuilds: lv1Build });
    expect(highRoll.stats.hints).toBe(4);
    expect(lowRoll.stats.hints).toBe(4);
    expect(base.effects.maxHints).toBe(2);
  });

  it('Life Link grants a wave mistake shield, scales maxHealth, and fires Life Pulse on every 4th Set at full hearts', () => {
    const lv1 = getArmoryWeapon('life-link', { 'life-link': { level: 1, tuning: {} } })!;
    const lv5 = getArmoryWeapon('life-link', { 'life-link': { level: 5, tuning: {} } })!;
    expect(lv5.effects.maxHealth).toBeGreaterThan(lv1.effects.maxHealth!);
    let s = held(['life-link'], { level: testLevel({ foes: [{ name: 'Dummy', hp: 9999 }] }) });
    // Wave opener mistake shield granted on fight start
    expect(s.freeMistakesLeft).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 4; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(eventsOf(s, 'rule').some(e => e.text === 'Life Pulse!')).toBe(true);
  });

  it('Revenge Linker fires active Tripwire on every 4th Set even on clean play, and caps hurt growth at 2', () => {
    let s = held(['revenge-linker'], { level: testLevel({ foes: [{ name: 'Dummy', hp: 9999 }] }) });
    for (let i = 0; i < 4; i++) s = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(eventsOf(s, 'rule').some(e => e.text === 'Tripwire!')).toBe(true);
    expect(s.connections.length).toBeGreaterThanOrEqual(1);
    expect(WEAPON_GROWTH['revenge-linker'].find(d => d.watch.on === 'hurt')?.max).toBe(2);
  });

  it('Oracle Eye is pure insight utility: 4s auto-hint and hinted Sets refund clock time without raw damage riders ([GP-11])', () => {
    const level = testLevel({ rules: { timer: 120 }, foes: [{ name: 'Dummy', hp: 9999 }] });
    const plain = matchAt(startFight({ level }), [0, 1, 2], SAME_NUMBER);
    let s = held(['oracle-eye'], { level });
    // Pure utility: zero flat damage rider on plain or hinted Sets
    const clean = matchAt(s, [0, 1, 2], SAME_NUMBER);
    expect(clean.totalDamage).toBe(plain.totalDamage);
    // Hinted Set refunds clock time (1s base + 0.25s from first hinted-Set growth stack)
    s = tick(s, 5000, 1000);
    const timeBefore = s.timeLeft!;
    const hinted = matchAt(s, [0, 1, 2], SAME_NUMBER, true);
    expect(hinted.timeLeft!).toBeCloseTo(timeBefore + 1.25);
    expect(getArmoryWeapon('oracle-eye')!.effects.autoHintInterval).toBe(4000);
  });

  it("Fortune's Blessing gilds a wave card and strikes on bonus cards; Wisdom Chain boosts coins and grants 5th-Set XP", () => {
    let fb = held(['fortunes-blessing'], { level: testLevel({ foes: [{ name: 'Dummy', hp: 9999 }] }) });
    expect(fb.board.some(c => (c.bonusMoney ?? 0) > 0)).toBe(true);

    let wc = held(['wisdom-chain'], { level: testLevel({ foes: [{ name: 'Dummy', hp: 9999 }] }) });
    expect(wc.coinBonusPercent).toBeGreaterThanOrEqual(15);
    for (let i = 0; i < 5; i++) wc = matchAt(wc, [0, 1, 2], SAME_NUMBER);
    expect(eventsOf(wc, 'rule').some(e => e.text === 'Insight!')).toBe(true);
  });

  it('Piñata guarantees 1 piñata at wave start, Greedy Chest starts at +3 and grows +3/Set, and Soul Harvest / Seeker Lens copy is accurate', () => {
    const s = held(['pinata']);
    expect(s.board.some(c => (c.bounty ?? 0) > 0 && (c.health ?? 1) > 1)).toBe(true);

    const chest = getArmoryWeapon('greedy-chest') as AdventureWeapon;
    expect(chest.modifiers!.chestStart).toBe(3);
    expect(chest.modifiers!.chestGrowth).toBe(3);

    expect(getArmoryWeapon('soul-harvest')!.description).toMatch(/every heal.*hits the foe/i);
    expect(weaponGuide('seeker-lens').tip).toMatch(/hoard/i);
    expect(weaponGuide('rainbow-charm').tip).toMatch(/Clarity Lens/i);
    expect(weaponGuide('rally-horn').tip).toMatch(/multipl/i);
  });
});
