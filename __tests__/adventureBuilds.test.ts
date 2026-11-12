/**
 * Builds: how the balance bots gear up (engine/botBuilds.ts), and a sweep for
 * broken combinations.
 *
 * The sweep plays a training dummy (a World 4 board, 25 Sets, a foe that can't
 * fall) with the average bot and measures damage per Set (per Set, not per
 * second, so weapons that add time aren't counted as damage). Weapons are at
 * their best: level 5 and every number tuned to ×1.5. It checks:
 *   - every weapon on its own, and every pair that arms an evolution;
 *   - every fighter's full skill tree with the best single weapons and every recipe;
 *   - a spread of random endgame builds (fighter, full tree, charms, Arcana).
 * "Broken" means far ahead of the field (limits below), not merely strong:
 * a recipe is meant to beat its two halves. ADVENTURE_BUILDS_REPORT=1 prints the tables.
 */
import { getLevel } from '@/adventure/data/levels';
import { createMaxedSave } from '@/adventure/progress';
import { BOTS, simulateRun } from '@/adventure/engine/bot';
import { armableRecipes, buyTree, chooseCharms, gearUp, starsOnReaching, STAR_SHARE, TREE_STYLES } from '@/adventure/engine/botBuilds';
import { createRng } from '@/adventure/engine/rng';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { weaponStatLines, MAX_TUNING_TIER, MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { skillTreeOf, TREE_BUDGET, SEALED_AT } from '@/adventure/data/skillTrees';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { ARCANA } from '@/adventure/data/arcana';
import { getFeaturesForLevel } from '@/adventure/loadout';
import type { AdventureSave, LevelDef } from '@/adventure/types';
import type { CharacterName } from '@/types';

const RUNS = 6;

/** How far ahead of the field a build may get before it counts as broken. */
const LIMITS = {
  /** A recipe pair vs the strongest single weapon */
  pairVsBestSingle: 1.75,
  /** A fighter's best build vs that fighter's best single damage weapon */
  fighterComboVsSingle: 2,
  /** A fighter's best build vs the median fighter's best build */
  fighterVsField: 1.6,
  /** Any random endgame build vs the median random build */
  randomVsMedian: 2.75,
};

const ref = getLevel('4-4');
const DUMMY: LevelDef = {
  ...ref,
  // Keeps 4-4's id so the dummy sits at 4-4 on the map and gets every campaign feature taught by then
  id: ref.id,
  foes: [{ name: 'Training Dummy', icon: ref.foes[0].icon, hp: 1e7 }],
  rules: { ...ref.rules, timer: undefined, moves: 25, hearts: 10, hazards: undefined },
  challenge: { kind: 'noMistakes' },
};

/** Everything unlocked, every weapon at level 5 with every number at the top tuning tier; no Workshop upgrades. */
const endgameSave = (): AdventureSave => {
  const m = createMaxedSave();
  const legacyWeaponTiers = Object.fromEntries(m.armory.map(id => [id, MAX_WEAPON_LEVEL - 1]));
  const weaponTuning = Object.fromEntries(
    m.armory.map(id => {
      const lines = weaponStatLines(getArmoryWeapon(id)!, { level: MAX_WEAPON_LEVEL, tuning: {} });
      return [id, Object.fromEntries(lines.filter(l => l.tunable).map(l => [l.key, MAX_TUNING_TIER]))];
    })
  );
  return { ...m, upgrades: {}, skillNodes: {}, charms: [], equippedArcana: [], legacyWeaponTiers, weaponTuning };
};

const SAVE = endgameSave();
const DAMAGE_WEAPONS = ['blast-powder', 'flint-spark', 'prismatic-ray', 'chaos-shard'];

/** Mean damage per Set on the dummy (`dps` below), and mean evolutions started. */
const measure = (save: AdventureSave) => {
  let dps = 0;
  let evolutions = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = simulateRun(DUMMY, save, BOTS.average, 1000 + i * 7919);
    dps += r.state.totalDamage / Math.max(1, r.state.matches);
    evolutions += r.state.evolutionsTriggered;
  }
  return { dps: dps / RUNS, evolutions: evolutions / RUNS };
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const report: string[] = [];
const fmt = (x: number) => x.toFixed(2);

afterAll(() => {
  if (process.env.ADVENTURE_BUILDS_REPORT) console.log(report.join('\n'));
});

describe('bot gear-up', () => {
  const fighters = SAVE.unlockedFighters as CharacterName[];

  it.each(TREE_STYLES)('the %s style spends the stars it has on nodes it can reach', style => {
    for (const fighter of fighters) {
      const tree = skillTreeOf(fighter);
      for (const stars of [0, 7, 30, 80, SEALED_AT - 1, 120, TREE_BUDGET]) {
        const owned = buyTree(fighter, stars, style, createRng(stars + 1));
        const nodes = owned.map(id => tree.find(n => n.id === id)!);
        const spent = nodes.reduce((a, n) => a + n.cost, 0);
        expect(spent).toBeLessThanOrEqual(stars);
        // Nothing reachable and affordable is left over
        const left = stars - spent;
        const set = new Set(owned);
        const reachable = tree.filter(n => !set.has(n.id) && (n.roots.length > 0 || n.links.some(l => set.has(l))));
        expect(reachable.filter(n => n.cost <= left && !(n.requires && stars < n.requires.starsEarned))).toEqual([]);
        // Sealed nodes stay sealed until enough stars are earned
        for (const n of nodes) if (n.requires) expect(stars).toBeGreaterThanOrEqual(n.requires.starsEarned);
      }
      // A full budget buys the whole tree
      expect(buyTree(fighter, TREE_BUDGET, style, createRng(9)).length).toBe(tree.length);
    }
  });

  it('a planner reaches a capstone once it can afford the path', () => {
    for (const fighter of fighters) {
      const owned = buyTree(fighter, 120, 'plan', createRng(3));
      expect(owned.some(id => id.includes('-cap-'))).toBe(true);
    }
  });

  it('a bot usually brings both halves of a recipe it owns, and tries every recipe across runs', () => {
    const tried = new Set<string>();
    let armed = 0;
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      const charms = chooseCharms(SAVE, createRng(i));
      const recipes = armableRecipes({ ...SAVE, armory: charms });
      if (recipes.length) armed += 1;
      for (const r of recipes) tried.add(r.id);
    }
    expect(armed / runs).toBeGreaterThanOrEqual(0.55);
    expect([...tried].sort()).toEqual(EVOLUTION_RECIPES.map(r => r.id).sort());
  });

  it('a campaign bot has the stars its skill would have earned, and spends them on its fighter', () => {
    const level = getLevel('3-5');
    const stars = starsOnReaching(level, STAR_SHARE.average);
    expect(stars).toBeGreaterThan(0);
    const fighters = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const save = gearUp(SAVE, { stars, fighter: 'any' }, seed);
      fighters.add(save.selectedFighter);
      const spent = (save.skillNodes[save.selectedFighter] ?? []).reduce((a, id) => a + skillTreeOf(save.selectedFighter).find(n => n.id === id)!.cost, 0);
      expect(spent).toBeLessThanOrEqual(stars);
      expect(spent).toBeGreaterThan(stars * 0.8);
    }
    expect(fighters.size).toBeGreaterThanOrEqual(4);
  });
});

describe('no broken builds (endgame weapons on a training dummy)', () => {
  it('weapons and evolution pairs: no recipe runs away from the best single weapon, and every recipe fires', () => {
    const singles = SAVE.armory.map(id => ({ id, ...measure({ ...SAVE, charms: [id] }) }));
    const best = Math.max(...singles.filter(s => DAMAGE_WEAPONS.includes(s.id)).map(s => s.dps));
    report.push(`best single ${fmt(best)}: ` + [...singles].sort((a, b) => b.dps - a.dps).slice(0, 6).map(s => `${s.id} ${fmt(s.dps)}`).join(', '));
    // Single weapons: none is far ahead of the strongest damage weapon
    for (const s of singles) expect(s.dps).toBeLessThanOrEqual(best * 1.25);

    const features = getFeaturesForLevel(DUMMY, SAVE);
    expect(features.has('evolutions')).toBe(true);
    for (const recipe of armableRecipes(SAVE)) {
      const rows = recipe.options[0].flatMap(a => recipe.options[1].map(b => ({ pair: `${a}+${b}`, ...measure({ ...SAVE, charms: [a, b] }) })));
      const top = rows.reduce((a, b) => (b.dps > a.dps ? b : a));
      const fired = rows.reduce((a, r) => a + r.evolutions, 0) / rows.length;
      report.push(`${recipe.id.padEnd(15)} best ${top.pair} ${fmt(top.dps)} (×${fmt(top.dps / best)} best single) · ${fmt(fired)} evolutions / fight`);
      expect(top.dps).toBeLessThanOrEqual(best * LIMITS.pairVsBestSingle);
      // Bots get to play it: a held recipe starts at least once in an average fight
      expect(fired).toBeGreaterThan(0.15);
    }
  });

  it('full skill trees: no fighter-and-recipe pairing runs away, and no fighter runs away from the field', () => {
    const recipes = armableRecipes(SAVE);
    const bestBuilds: number[] = [];
    for (const fighter of SAVE.unlockedFighters as CharacterName[]) {
      const save = { ...SAVE, selectedFighter: fighter, skillNodes: { [fighter]: buyTree(fighter, TREE_BUDGET, 'spread', createRng(1)) } };
      const singles = DAMAGE_WEAPONS.map(id => measure({ ...save, charms: [id] }).dps);
      const single = Math.max(...singles);
      const combos = recipes.map(r => ({ id: r.id, dps: measure({ ...save, charms: [r.options[0][0], r.options[1][0]] }).dps }));
      const top = combos.reduce((a, b) => (b.dps > a.dps ? b : a));
      report.push(`${fighter.padEnd(16)} best single ${fmt(single)} · best recipe ${top.id} ${fmt(top.dps)} (×${fmt(top.dps / single)})`);
      expect(top.dps).toBeLessThanOrEqual(single * LIMITS.fighterComboVsSingle);
      bestBuilds.push(Math.max(single, top.dps));
    }
    const mid = median(bestBuilds);
    for (const b of bestBuilds) expect(b).toBeLessThanOrEqual(mid * LIMITS.fighterVsField);
  });

  it('random endgame builds (fighter, full tree, charms, Arcana): none runs far ahead of the rest', () => {
    const builds = Array.from({ length: 30 }, (_, i) => {
      const rng = createRng(500 + i);
      const fighter = rng.pick(SAVE.unlockedFighters);
      const slots = 3 + Math.floor(rng.next() * 4);
      const arcana = rng.shuffle(ARCANA.map(a => a.id)).slice(0, Math.floor(rng.next() * 4));
      const save: AdventureSave = {
        ...SAVE,
        selectedFighter: fighter,
        upgrades: { charm_belt: slots - 3, tarot_deck: 2 },
        skillNodes: { [fighter]: buyTree(fighter, TREE_BUDGET, 'spread', rng) },
        equippedArcana: arcana,
      };
      const charms = chooseCharms(save, rng);
      return { label: `${fighter} [${charms.join(', ')}] {${arcana.join(', ')}}`, ...measure({ ...save, charms }) };
    });
    const mid = median(builds.map(b => b.dps));
    const sorted = [...builds].sort((a, b) => b.dps - a.dps);
    report.push(`random builds: median ${fmt(mid)}, top: ` + sorted.slice(0, 3).map(b => `${fmt(b.dps)} ${b.label}`).join(' | '));
    expect(sorted[0].dps).toBeLessThanOrEqual(mid * LIMITS.randomVsMedian);
  });
});
