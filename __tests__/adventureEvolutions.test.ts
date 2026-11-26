/**
 * The evolution roster: 4 evolutions per Armory weapon, every pair arms at
 * most one recipe, and every recipe forges and runs in a real fight.
 */
import {
  EVOLUTION_RECIPES,
  EVOLUTION_SHORT_VERBS,
  SIGNATURE_RECIPES,
  SIGNATURE_RECIPE_IDS,
  evolutionShortVerb,
  isSignatureRecipe,
} from '@/adventure/data/evolutions';
import { PAIR_RECIPES } from '@/adventure/data/evolutionPairs';
import { TRICK_WEAPON_IDS } from '@/adventure/data/adventureWeapons';
import { findAdventureWeapon } from '@/adventure/data/armory';
import { createMaxedSave } from '@/adventure/progress';
import { baseCardReward, createRun, runReducer } from '@/adventure/engine/run';
import { FightRecorder, replayFight } from '@/adventure/engine/replay';
import { xpForLevel } from '@/adventure/engine/fight';
import { setPowerEnabled } from '@/adventure/data/weaponPower';
import { eventsOf, findSet, miss, playSet, startFight, testLevel, tick } from './testUtils/adventureFight';
import type { RunState } from '@/adventure/types';

const ARMORY = createMaxedSave().armory;
/** The classic weapons have 4 recipes each (about 8 they sit in); the trick weapons have 2 each (3 they sit in) */
const CLASSIC = ARMORY.filter(id => !TRICK_WEAPON_IDS.includes(id));
const arms = (families: [string[], string[]], a: string, b: string) =>
  (families[0].includes(a) && families[1].includes(b)) || (families[0].includes(b) && families[1].includes(a));

describe('evolution roster', () => {
  it('has 4 evolutions per classic weapon and 2 per trick weapon', () => {
    expect(EVOLUTION_RECIPES).toHaveLength(CLASSIC.length * 4 + TRICK_WEAPON_IDS.length * 2);
    expect(SIGNATURE_RECIPES.length + PAIR_RECIPES.length).toBe(EVOLUTION_RECIPES.length);
  });

  it('ids, names and icons are unique, and every recipe has rules or modifiers', () => {
    for (const key of ['id', 'name', 'icon'] as const) {
      expect(new Set(EVOLUTION_RECIPES.map(r => r[key])).size).toBe(EVOLUTION_RECIPES.length);
    }
    for (const r of EVOLUTION_RECIPES) {
      expect((r.source.rules?.length ?? 0) + Object.keys(r.source.modifiers ?? {}).length).toBeGreaterThan(0);
      expect(r.activeText.length).toBeLessThanOrEqual(130);
    }
  });

  it('pair recipes use two different Armory weapons, and no pair of weapons arms two recipes', () => {
    for (const p of PAIR_RECIPES) {
      const [[a], [b]] = p.families;
      expect(ARMORY).toContain(a);
      expect(ARMORY).toContain(b);
      expect(a).not.toBe(b);
      expect(EVOLUTION_RECIPES.filter(r => arms(r.families, a, b)).map(r => r.id)).toEqual([p.id]);
    }
  });

  it('every classic weapon sits in at least 6 recipes and every trick weapon in at least 3', () => {
    for (const id of ARMORY) {
      const n = EVOLUTION_RECIPES.filter(r => r.families.some(f => f.includes(id))).length;
      expect({ id, enough: n >= (TRICK_WEAPON_IDS.includes(id) ? 3 : 6) }).toEqual({ id, enough: true });
    }
  });
});

describe('every evolution runs', () => {
  const catalystOn = (s: RunState): RunState => {
    const set = findSet(s)!;
    return { ...s, board: s.board.map(c => (c.id === set[0].id ? { ...c, hasEvolutionItem: true, evolutionReady: true } : c)) };
  };

  it.each(PAIR_RECIPES.map(r => [r.id, r] as const))('%s forges from its two weapons and runs to its finale', (_id, r) => {
    const held = [r.families[0][0], r.families[1][0]];
    // Knowing any recipe arms them all
    let s = startFight({ save: { armory: held, charms: held, unlockedEvolutions: ['phoenix-pyre'] } });
    expect(s.armedRecipes).toEqual([r.id]);
    s = catalystOn(s);
    s = playSet(s, findSet(s, set => set.some(c => c.hasEvolutionItem))!);
    expect(s.activeEvolutions.map(e => e.id)).toEqual([r.id]);
    expect(s.forgedRecipes).toContain(r.id);
    for (let i = 0; i < 4 && s.status === 'playing'; i++) s = playSet(tick(s, 3000, 1000));
    if (s.status === 'playing') s = miss(s);
    if (s.status === 'playing') s = runReducer(s, { type: 'USE_HINT' });
    s = tick(s, 35000, 1000); // freezes pause the evolution clock too
    // (a fight that ended on the way, e.g. thorns on a Devil's Bargain, stops its clock)
    if (s.status === 'playing') expect(s.activeEvolutions).toEqual([]);
    expect(Number.isFinite(s.foeHp)).toBe(true);
  });
});

describe('a Catalyst never re-triggers an evolution that is running', () => {
  // Every refill brings a Catalyst whenever one is allowed
  const level = testLevel({ rules: { evolutionLikelihood: 100 }, foes: [{ name: 'Dummy', hp: 1e7 }] });
  const fight = (held: string[]) => startFight({ level, save: { armory: held, charms: held, unlockedEvolutions: ['phoenix-pyre'] } });
  const hasCatalyst = (s: RunState) => s.board.some(c => c.hasEvolutionItem);
  /** Put the Catalyst on a card of a Set and match that Set. */
  const matchCatalyst = (s: RunState): RunState => {
    const set = findSet(s)!;
    const board = s.board.map(c => ({ ...c, hasEvolutionItem: c.id === set[0].id, evolutionReady: c.id === set[0].id }));
    return playSet({ ...s, board }, set.map(c => board.find(b => b.id === c.id)!));
  };
  const clearEvents = (s: RunState) => runReducer(s, { type: 'CLEAR_EVENTS', upTo: s.eventSeq });

  it('with one recipe armed, no Catalyst appears until the evolution has ended', () => {
    const recipe = PAIR_RECIPES[0];
    let s = fight([recipe.families[0][0], recipe.families[1][0]]);
    expect(s.armedRecipes).toEqual([recipe.id]);
    s = matchCatalyst(s);
    expect(s.activeEvolutions.map(e => e.id)).toEqual([recipe.id]);
    s = clearEvents(s);
    for (let i = 0; i < 8; i++) {
      s = playSet(s);
      expect(hasCatalyst(s)).toBe(false);
    }
    expect(eventsOf(s, 'catalyst_spawn')).toEqual([]);
    expect(s.evolutionsTriggered).toBe(1);

    // Once it is over, the next refill can bring one again
    s = tick(s, 60000, 1000);
    expect(s.activeEvolutions).toEqual([]);
    s = playSet(s);
    expect(hasCatalyst(s)).toBe(true);
  });

  it('with two recipes armed, the first Catalyst offers both choices, the second auto-starts the last idle recipe, and then no Catalyst appears', () => {
    // Three weapons that arm exactly two recipes
    let held: string[] | null = null;
    for (const a of PAIR_RECIPES) {
      for (const b of PAIR_RECIPES) {
        if (a === b || held) continue;
        const weapons = [...new Set([a.families[0][0], a.families[1][0], b.families[0][0], b.families[1][0]])];
        if (weapons.length === 3 && fight(weapons).armedRecipes.length === 2) held = weapons;
      }
      if (held) break;
    }
    expect(held).not.toBeNull();
    let s = fight(held!);
    const [first, second] = EVOLUTION_RECIPES.map(r => r.id).filter(id => s.armedRecipes.includes(id));

    // 2 idle armed -> Catalyst opens pick_evolution with both recipes (and REPLACE does not spawn a second Catalyst while picking)
    s = matchCatalyst(s);
    expect(s.status).toBe('pick_evolution');
    expect(new Set(s.evolutionPickOptions)).toEqual(new Set([first, second]));
    expect(hasCatalyst(s)).toBe(false);
    s = runReducer(s, { type: 'PICK_EVOLUTION', recipeId: first });
    expect(s.status).toBe('playing');
    expect(s.activeEvolutions.map(e => e.id)).toEqual([first]);
    const left = s.activeEvolutions[0].remainingMs;

    // Only 1 idle recipe remains, so a Catalyst spawns pre-loaded for `second` and auto-ignites it without a modal
    s = playSet(s);
    expect(hasCatalyst(s)).toBe(true);
    expect(s.catalystRecipeId).toBe(second);
    s = matchCatalyst(s);
    expect(s.status).toBe('playing');
    expect(s.activeEvolutions.map(e => e.id).sort()).toEqual([first, second].sort());
    // The first was not restarted
    expect(s.activeEvolutions.find(e => e.id === first)!.remainingMs).toBeLessThanOrEqual(left);
    expect(s.evolutionsTriggered).toBe(2);

    // Both are running: nothing left to start
    s = clearEvents(s);
    for (let i = 0; i < 8; i++) {
      s = playSet(s);
      expect(hasCatalyst(s)).toBe(false);
    }
    expect(eventsOf(s, 'catalyst_spawn')).toEqual([]);
    expect(s.evolutionsTriggered).toBe(2);
  });
});

describe('evolution choice (pick 1 of up to 3 randomly chosen)', () => {
  beforeEach(() => setPowerEnabled(false));
  afterEach(() => setPowerEnabled(true));

  const dummyLevel = testLevel({
    rules: { attributes: ['shape', 'color', 'number'], boardSize: 12, evolutionLikelihood: 100 },
    foes: [{ name: 'Dummy', hp: 1e6 }],
  });

  const placeOnSet = (s: RunState): RunState => {
    const set = findSet(s)!;
    const board = s.board.map(c => ({ ...c, hasEvolutionItem: c.id === set[0].id, evolutionReady: c.id === set[0].id }));
    return { ...s, board };
  };

  const matchCatalyst = (s: RunState): RunState => {
    const primed = s.board.some(c => c.hasEvolutionItem) ? s : placeOnSet(s);
    const set = findSet(primed, cards => cards.some(c => c.hasEvolutionItem))!;
    return playSet(primed, set);
  };

  it('auto-starts immediately without entering pick_evolution when only 1 idle evolution is armed', () => {
    const recipe = PAIR_RECIPES[0];
    const held = [recipe.families[0][0], recipe.families[1][0]];
    let s = startFight({
      level: dummyLevel,
      save: { selectedFighter: 'Pelican', armory: held, charms: held, unlockedEvolutions: ['phoenix-pyre'] },
      features: ['hearts', 'gear', 'evolutions'],
    });
    expect(s.armedRecipes).toEqual([recipe.id]);
    // Natural refill sets catalystRecipeId to the exact single idle recipe
    s = playSet(s);
    expect(s.board.some(c => c.hasEvolutionItem)).toBe(true);
    expect(s.catalystRecipeId).toBe(recipe.id);

    s = matchCatalyst(s);
    expect(s.status).toBe('playing');
    expect(s.evolutionPickOptions).toEqual([]);
    expect(s.activeEvolutions.map(e => e.id)).toEqual([recipe.id]);
  });

  it('enters pick_evolution with 2 distinct options, pauses gameplay actions, starts option #2, and preserves triggering Set multiplier on opening burst', () => {
    // 3 weapons arming exactly 2 recipes
    let held: string[] | null = null;
    for (const a of PAIR_RECIPES) {
      for (const b of PAIR_RECIPES) {
        if (a === b || held) continue;
        const weapons = [...new Set([a.families[0][0], a.families[1][0], b.families[0][0], b.families[1][0]])];
        if (weapons.length !== 3) continue;
        const probe = startFight({
          level: dummyLevel,
          save: { selectedFighter: 'Pelican', armory: weapons, charms: weapons, unlockedEvolutions: ['phoenix-pyre'] },
          features: ['hearts', 'gear', 'evolutions'],
        });
        if (probe.armedRecipes.length === 2) {
          held = weapons;
          break;
        }
      }
      if (held) break;
    }
    expect(held).not.toBeNull();

    let s = startFight({
      level: dummyLevel,
      save: { selectedFighter: 'Pelican', armory: held!, charms: held!, unlockedEvolutions: ['phoenix-pyre'] },
      features: ['hearts', 'gear', 'hints', 'evolutions'],
    });
    // Natural refill spawns Catalyst with catalystRecipeId === null (2+ idle -> choice!)
    s = playSet(s);
    expect(s.board.some(c => c.hasEvolutionItem)).toBe(true);
    expect(s.catalystRecipeId).toBeNull();

    // Charge nextSetMultiplier to ×2 so we verify it is preserved onto the opening +10 burst -> 20 dmg!
    s = { ...placeOnSet({ ...s, board: s.board.map(c => ({ ...c, hasEvolutionItem: false, evolutionReady: false })) }), nextSetMultiplier: 2 };
    s = matchCatalyst(s);
    expect(s.status).toBe('pick_evolution');
    expect(s.evolutionPickOptions).toHaveLength(2);
    expect(new Set(s.evolutionPickOptions).size).toBe(2);
    expect(s.evolutionPickContext?.setMultiplier).toBeGreaterThanOrEqual(2);

    // Gameplay actions are safely ignored while choosing an evolution
    const elapsedBefore = s.elapsedMs;
    expect(runReducer(s, { type: 'TICK', ms: 1000 }).elapsedMs).toBe(elapsedBefore);
    const anySet = findSet(s)!;
    expect(runReducer(s, { type: 'MATCH', cards: anySet, rewards: anySet.map(baseCardReward) })).toBe(s);
    expect(runReducer(s, { type: 'INVALID', cards: anySet })).toBe(s);
    expect(runReducer(s, { type: 'USE_HINT' })).toBe(s);

    // Pick option #2 specifically
    const option2 = s.evolutionPickOptions![1];
    const mult = s.evolutionPickContext!.setMultiplier;
    const afterPick = runReducer(s, { type: 'PICK_EVOLUTION', recipeId: option2 });
    expect(afterPick.status).toBe('playing');
    expect(afterPick.evolutionPickOptions).toEqual([]);
    expect(afterPick.evolutionPickContext).toBeUndefined();
    expect(afterPick.activeEvolutions.map(e => e.id)).toEqual([option2]);
    const recipe2 = EVOLUTION_RECIPES.find(r => r.id === option2)!;
    // Opening burst (+10) multiplied by preserved setMultiplier!
    expect(afterPick.log[afterPick.log.length - 1].lines).toContainEqual({
      type: 'hit',
      amount: Math.round(10 * mult),
      text: recipe2.name,
    });
  });

  it('draws 3 distinct random idle options when 5+ evolutions are armed, varies across seeds, and excludes already-running evolutions', () => {
    const sixWeapons = ['blast-powder', 'mending-charm', 'flint-spark', 'echo-stone', 'prismatic-ray', 'second-chance'];
    const makeRun = (seed: number) =>
      startFight({
        seed,
        level: dummyLevel,
        save: {
          selectedFighter: 'Pelican',
          upgrades: { charm_belt: 3 },
          armory: sixWeapons,
          charms: sixWeapons,
          unlockedEvolutions: ['phoenix-pyre'],
        },
        features: ['hearts', 'gear', 'evolutions'],
      });

    const sampleSets: string[] = [];
    for (const seed of [11, 29, 73, 151, 307, 619, 1009, 2027]) {
      const s0 = makeRun(seed);
      expect(s0.armedRecipes.length).toBeGreaterThanOrEqual(5);
      const s1 = matchCatalyst(s0);
      expect(s1.status).toBe('pick_evolution');
      const opts = s1.evolutionPickOptions ?? [];
      expect(opts).toHaveLength(3);
      expect(new Set(opts).size).toBe(3);
      for (const id of opts) expect(s0.armedRecipes).toContain(id);
      sampleSets.push([...opts].sort().join(','));
    }
    // Different seeds produce different random 3-recipe draws
    expect(new Set(sampleSets).size).toBeGreaterThan(1);

    // Pick one evolution, then match a second Catalyst: the running evolution must NEVER be offered again
    let run = makeRun(42);
    run = matchCatalyst(run);
    const chosenFirst = run.evolutionPickOptions![0];
    run = runReducer(run, { type: 'PICK_EVOLUTION', recipeId: chosenFirst });
    expect(run.activeEvolutions.map(e => e.id)).toEqual([chosenFirst]);

    // Trigger a second Catalyst while chosenFirst is still active
    run = matchCatalyst({ ...run, board: run.board.map(c => ({ ...c, hasEvolutionItem: false, evolutionReady: false })) });
    expect(run.status).toBe('pick_evolution');
    expect(run.evolutionPickOptions).toHaveLength(3);
    expect(run.evolutionPickOptions).not.toContain(chosenFirst);
  });

  it('opens pick_evolution before level-up pick when a Catalyst Set also levels up, then transitions cleanly into pick', () => {
    const held = ['blast-powder', 'mending-charm', 'flint-spark'];
    let s = startFight({
      level: dummyLevel,
      save: {
        selectedFighter: 'Pelican',
        armory: [...held, 'echo-stone', 'prismatic-ray', 'chrono-shard'],
        charms: held,
        unlockedEvolutions: ['phoenix-pyre'],
      },
      features: ['hearts', 'gear', 'xp', 'evolutions'],
    });
    expect(s.armedRecipes.length).toBeGreaterThanOrEqual(2);
    // Position XP 1 point below level-up so the Catalyst Set triggers both Evolution choice AND Level-Up!
    s = { ...placeOnSet(s), xp: xpForLevel(s.xpLevel) - 1 };
    const set = findSet(s, cards => cards.some(c => c.hasEvolutionItem))!;
    s = runReducer(s, {
      type: 'MATCH',
      cards: set,
      rewards: set.map(c => ({ cardId: c.id, points: 1, experience: 1 })),
    });
    expect(s.pendingPicks).toBeGreaterThanOrEqual(1);
    expect(s.status).toBe('pick_evolution');
    expect((s.evolutionPickOptions?.length ?? 0)).toBeGreaterThanOrEqual(2);

    // Pick an evolution -> cleanly transitions to level-up 'pick'!
    const chosen = s.evolutionPickOptions![0];
    s = runReducer(s, { type: 'PICK_EVOLUTION', recipeId: chosen });
    expect(s.activeEvolutions.map(e => e.id)).toEqual([chosen]);
    expect(s.status).toBe('pick');
    expect(s.pickOptions.length).toBeGreaterThan(0);

    // Pick a weapon -> returns cleanly to 'playing'
    s = runReducer(s, { type: 'PICK', weaponId: s.pickOptions[0].id });
    expect(s.status).toBe('playing');
  });

  it('wins the fight cleanly when the opening burst inside PICK_EVOLUTION KOs the final foe', () => {
    const held = ['blast-powder', 'mending-charm', 'flint-spark'];
    // 10 HP foe: Set deals 3 -> 7 HP left -> pick_evolution opens -> +10 burst KOs!
    const lowHpLevel = testLevel({
      rules: { attributes: ['shape', 'color', 'number'], boardSize: 12 },
      foes: [{ name: 'Wounded Imp', icon: 'lorc/imp', hp: 10 }],
    });
    let s = startFight({
      level: lowHpLevel,
      save: { selectedFighter: 'Pelican', armory: held, charms: held, unlockedEvolutions: ['phoenix-pyre'] },
      features: ['hearts', 'gear', 'evolutions'],
    });
    expect(s.armedRecipes.length).toBeGreaterThanOrEqual(2);
    s = matchCatalyst(s);
    expect(s.status).toBe('pick_evolution');
    expect(s.foeHp).toBeGreaterThan(0);

    const chosen = s.evolutionPickOptions![0];
    s = runReducer(s, { type: 'PICK_EVOLUTION', recipeId: chosen });
    expect(s.status).toBe('won');
    expect(s.endReason).toBe('defeated');
    expect(s.foeHp).toBe(0);
    expect(s.evolutionsTriggered).toBe(1);
    expect(s.lastSetIgnition?.lethal).toBe(true);
  });

  it('records and replays PICK_EVOLUTION deterministically through FightRecorder and replayFight', () => {
    const held = ['blast-powder', 'mending-charm', 'flint-spark', 'echo-stone'];
    const save = {
      ...createMaxedSave(),
      selectedFighter: 'Pelican' as const,
      armory: held,
      charms: held,
      upgrades: { charm_belt: 1 },
      unlockedEvolutions: ['phoenix-pyre'],
      skillNodes: {},
      equippedArcana: [],
    };
    const level = testLevel({
      rules: { attributes: ['shape', 'color', 'number'], boardSize: 12, evolutionLikelihood: 100 },
      foes: [{ name: 'Replay Dummy', hp: 500 }],
    });
    const seed = 777;
    const rec = new FightRecorder(seed);
    let s = createRun(level, save, { seed });
    const step = (action: Parameters<typeof runReducer>[1]) => {
      rec.record(action, s);
      s = runReducer(s, action);
    };
    // Match sets until a Catalyst spawns naturally, then match the Catalyst and pick option #2
    let sawPick = false;
    for (let i = 0; i < 6 && !sawPick; i++) {
      const catSet = findSet(s, cards => cards.some(c => c.hasEvolutionItem));
      const set = catSet ?? findSet(s)!;
      step({ type: 'MATCH', cards: set, rewards: set.map(baseCardReward) });
      step({ type: 'REPLACE', ids: set.map(c => c.id) });
      if (s.status === 'pick_evolution') {
        sawPick = true;
        step({ type: 'PICK_EVOLUTION', recipeId: s.evolutionPickOptions![1] });
      }
    }
    expect(sawPick).toBe(true);
    expect(s.evolutionsTriggered).toBe(1);

    const replayed = replayFight(level, save, rec.toJSON());
    expect(replayed.foeHp).toBe(s.foeHp);
    expect(replayed.totalDamage).toBe(s.totalDamage);
    expect(replayed.activeEvolutions).toEqual(s.activeEvolutions);
    expect(replayed.forgedRecipes).toEqual(s.forgedRecipes);
    expect(replayed.status).toBe(s.status);
  });
});

describe('Wave 2 evolution overhaul invariants & live behavior', () => {
  const byId = (id: string) => {
    const r = EVOLUTION_RECIPES.find(x => x.id === id);
    if (!r) throw new Error(`Missing recipe ${id}`);
    return r;
  };
  const level = testLevel({
    rules: { attributes: ['shape', 'color', 'number'], boardSize: 12 },
    foes: [{ name: 'Dummy', hp: 1e6 }],
  });
  const startActive = (recipeId: string, extraFeatures: ('hearts' | 'gear' | 'hints' | 'graces' | 'xp' | 'coins' | 'evolutions')[] = []) => {
    const r = byId(recipeId);
    const held = [r.families[0][0], r.families[1][0]];
    let s = startFight({
      level,
      save: { selectedFighter: 'Pelican', armory: held, charms: held, unlockedEvolutions: ['phoenix-pyre'] },
      features: ['hearts', 'gear', 'hints', 'graces', 'xp', 'coins', 'evolutions', ...extraFeatures],
    });
    const set = findSet(s)!;
    s = { ...s, board: s.board.map(c => (c.id === set[0].id ? { ...c, hasEvolutionItem: true, evolutionReady: true } : c)) };
    s = playSet(s, findSet(s, cards => cards.some(c => c.hasEvolutionItem))!);
    expect(s.activeEvolutions.map(e => e.id)).toEqual([recipeId]);
    return s;
  };

  it('has zero idle/slow wait-to-win triggers and zero dead parent triggers across all 208 recipes', () => {
    for (const r of EVOLUTION_RECIPES) {
      const rules = r.source.rules ?? [];
      expect(rules.some(ru => ru.trigger.on === 'idle')).toBe(false);
      expect(rules.some(ru => ru.when?.some(c => c.kind === 'timeSinceLastSetAtLeast'))).toBe(false);
      expect(
        r.source.modifiers?.conditionalDamage?.some(cd => cd.when.some(c => c.kind === 'timeSinceLastSetAtLeast')) ?? false
      ).toBe(false);

      // Field Stone without Growth Seed must never listen for weapon:growth
      const hasField = r.families.some(f => f.includes('field-stone'));
      const hasGrowth = r.families.some(f => f.includes('growth-seed'));
      if (hasField && !hasGrowth) {
        expect(rules.some(ru => ru.trigger.on === 'weapon' && ru.trigger.kind === 'growth')).toBe(false);
      }

      // Mystic Sight without a hint-gaining parent must never listen for weapon:hint
      const hasMystic = r.families.some(f => f.includes('mystic-sight'));
      if (hasMystic) {
        expect(rules.some(ru => ru.trigger.on === 'weapon' && ru.trigger.kind === 'hint')).toBe(false);
      }
    }

    // All Encore Mask recipes have evolutionStart rules so Encore Mask's opening replay always fires
    for (const r of EVOLUTION_RECIPES.filter(x => x.families.some(f => f.includes('encore-mask')))) {
      expect(r.source.rules?.some(ru => ru.trigger.on === 'evolutionStart')).toBe(true);
    }

    // Spark Plug does not put `time` (a WEAPON_KIND) before `doubleNext` on linkDestroyed
    const sparkPlug = byId('spark-plug');
    const linkRule = sparkPlug.source.rules?.find(ru => ru.trigger.on === 'linkDestroyed');
    expect(linkRule?.effects.some(e => e.do === 'time')).toBe(false);
  });

  it('safe-bet has no mistake-refund loop and rewards hinted Sets with damage + grace', () => {
    const safeBet = byId('safe-bet');
    expect(safeBet.source.rules?.some(ru => ru.trigger.on === 'mistake')).toBe(false);
    const s = startActive('safe-bet');
    const gracesBefore = s.stats.graces;
    const hpBefore = s.foeHp;
    const set = findSet(s)!;
    const after = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(c => ({ cardId: c.id, points: 1 })), hinted: true });
    expect(after.stats.graces).toBeGreaterThanOrEqual(Math.min(after.stats.maxGraces, gracesBefore + 1));
    expect(eventsOf(after, 'rule').some(e => e.text === 'Safe bet!')).toBe(true);
    expect(hpBefore - after.foeHp).toBeGreaterThan(6);
  });

  it('cutting-edge grows a 12-card + Lv1 Field Stone board to 18 and fires a column laser', () => {
    const r = byId('cutting-edge');
    expect(r.source.rules?.some(ru => ru.effects.some(e => e.do === 'laser' && e.area.shape === 'column'))).toBe(true);
    const s = startActive('cutting-edge');
    // 12 base + 2 Lv1 Field Stone + 4 growBoard = 18 cards -> threshold met!
    expect(s.board.length).toBeGreaterThanOrEqual(18);
    const after = playSet(s);
    expect(eventsOf(after, 'laser').length).toBeGreaterThan(0);
  });

  it('cosmic-tome grants scaled XP per active evolution on every Set', () => {
    const s = startActive('cosmic-tome');
    const xpBefore = s.xp;
    const after = playSet(s);
    expect(after.xp).toBeGreaterThan(xpBefore);
  });

  it('compass-walk removes Tightrope off-rope penalty and marks extra Magnet cards on start', () => {
    const s = startActive('compass-walk');
    // 1 base Magnet + 2 added by start -> at least 2 magnets live on board
    expect(s.board.filter(c => c.magnet).length).toBeGreaterThanOrEqual(2);
    expect(byId('compass-walk').source.modifiers?.offRopeBonus).toBe(0.5);
  });

  it('looking-glass and knife-edge repair a shattered Glass Sword on evolution start', () => {
    for (const id of ['looking-glass', 'knife-edge'] as const) {
      const r = byId(id);
      const held = [r.families[0][0], r.families[1][0]];
      let s = startFight({
        level,
        save: { selectedFighter: 'Pelican', armory: held, charms: held, unlockedEvolutions: ['phoenix-pyre'] },
        features: ['hearts', 'gear', 'evolutions'],
      });
      s = { ...s, gear: { ...s.gear, glassBroken: true } };
      const set = findSet(s)!;
      s = { ...s, board: s.board.map(c => (c.id === set[0].id ? { ...c, hasEvolutionItem: true, evolutionReady: true } : c)) };
      s = playSet(s, findSet(s, cards => cards.some(c => c.hasEvolutionItem))!);
      expect(s.activeEvolutions.map(e => e.id)).toEqual([id]);
      expect(s.gear.glassBroken).toBe(false);
    }
  });

  it('gold-detector adds a Magnet mark and feeds Greedy Chest on start', () => {
    const s = startActive('gold-detector');
    expect(s.board.filter(c => c.magnet).length).toBeGreaterThanOrEqual(2);
    const chest = s.board.find(c => c.chest !== undefined);
    const baseChestStart = findAdventureWeapon('greedy-chest')?.modifiers?.chestStart ?? 3;
    expect(chest?.chest ?? 0).toBeGreaterThanOrEqual(baseChestStart + 6);
  });

  it('sticker-swap and trading-cards wire Trick payoffs into stampAlbum', () => {
    const trading = startActive('trading-cards');
    expect(trading.gear.album.length).toBeGreaterThanOrEqual(1);
    expect(byId('sticker-swap').source.rules?.some(ru => ru.trigger.on === 'trick' && ru.trigger.kind === 'odd' && ru.effects.some(e => e.do === 'stampAlbum'))).toBe(true);
  });

  it('ancient-relic and deep-winter fast-forward slow trick timers with advanceTricks', () => {
    for (const id of ['ancient-relic', 'deep-winter'] as const) {
      const rules = byId(id).source.rules ?? [];
      expect(rules.some(ru => ru.trigger.on === 'evolutionStart' && ru.effects.some(e => e.do === 'advanceTricks'))).toBe(true);
      expect(rules.some(ru => ru.trigger.on === 'set' && ru.effects.some(e => e.do === 'advanceTricks'))).toBe(true);
    }
    const winter = startActive('deep-winter');
    const ice = winter.board.find(c => (c.frozen ?? 0) > 0);
    // Base iceSets=7, -2 from modifier -> 5, chipped on start & Catalyst Set -> <= 4
    if (ice) expect(ice.frozen!).toBeLessThanOrEqual(4);
  });

  it('standing-ovation replays its evolutionStart rules through Encore Mask at finale', () => {
    let s = startActive('standing-ovation');
    expect(s.doubleNext).toBeGreaterThanOrEqual(1);
    const hpBeforeEnd = s.foeHp;
    const duration = s.activeEvolutions[0]?.remainingMs ?? 35000;
    s = tick(s, duration + 2000, 1000);
    expect(s.activeEvolutions).toEqual([]);
    // Encore Mask hit (+10 or +14) + finale blast & +10 + replayed evolutionStart (+8)
    expect(hpBeforeEnd - s.foeHp).toBeGreaterThanOrEqual(28);
  });

  it('purity-lens rewards both 1-diff Sets and Rainbow Sets', () => {
    const r = byId('purity-lens');
    expect(r.source.modifiers?.conditionalDamage?.some(cd => cd.when.some(c => c.kind === 'diffCount' && c.n === 1))).toBe(true);
    expect(r.source.modifiers?.rainbowMultiplierBonus).toBeGreaterThan(0);
    expect(r.source.rules?.some(ru => ru.trigger.on === 'rainbow')).toBe(true);
  });

  it('[GP-12] all 208 recipes have <=55-char shortVerbs and all 9 signature recipes are flagged', () => {
    expect(EVOLUTION_RECIPES).toHaveLength(208);
    expect(SIGNATURE_RECIPES).toHaveLength(9);
    expect(SIGNATURE_RECIPE_IDS.size).toBe(9);
    for (const r of SIGNATURE_RECIPES) {
      expect(isSignatureRecipe(r.id)).toBe(true);
    }
    for (const r of PAIR_RECIPES) {
      expect(isSignatureRecipe(r.id)).toBe(false);
    }
    for (const r of EVOLUTION_RECIPES) {
      expect(EVOLUTION_SHORT_VERBS[r.id]).toBeDefined();
      const verb = evolutionShortVerb(r);
      expect({ id: r.id, len: verb.length, ok: verb.length >= 10 && verb.length <= 55 }).toEqual({
        id: r.id,
        len: verb.length,
        ok: true,
      });
    }
  });
});
