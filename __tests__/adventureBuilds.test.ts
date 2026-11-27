/**
 * Builds: how the balance bots gear up (engine/botBuilds.ts), and a sweep for
 * broken combinations.
 *
 * The sweep plays a training dummy (a World 4 board, 25 Sets, a foe that can't
 * fall) with the average bot and measures damage per Set (per Set, not per
 * second, so weapons that add time aren't counted as damage). Weapons are at
 * their best: level 5 and every number tuned to ×1.5. It checks:
 *   - every weapon on its own, and representative per-weapon timed evolutions;
 *   - every fighter's full skill tree with the best single weapons and
 *     top evolved weapons;
 *   - a spread of random endgame builds (fighter, full tree, charms, evolutions, Arcana).
 * "Broken" means far ahead of the field (limits below), not merely strong.
 *
 * The last block checks the other end (docs/balance-philosophy.md): no
 * per-weapon evolution is a dead pick. In a real timed fight with nothing
 * picked up along the way, evolutions out-damage their weapon without it.
 * ADVENTURE_BUILDS_REPORT=1 prints the tables.
 */
import { getLevel } from '@/adventure/data/levels';
import { createMaxedSave } from '@/adventure/progress';
import { BOTS, simulateRun } from '@/adventure/engine/bot';
import {
  buyTree,
  chooseCharms,
  chooseEquippedEvolutions,
  DAMAGE_WEAPONS,
  gearUp,
  starsOnReaching,
  STAR_SHARE,
  TREE_STYLES,
} from '@/adventure/engine/botBuilds';
import { createRng } from '@/adventure/engine/rng';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { weaponStatLines, MAX_TUNING_TIER, MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { skillTreeOf, TREE_BUDGET, SEALED_AT } from '@/adventure/data/skillTrees';
import { WEAPON_EVOLUTIONS } from '@/adventure/data/evolutions';
import { beltSynergyOverlap } from '@/adventure/data/synergy';
import { ARCANA, arcanaRules } from '@/adventure/data/arcana';
import { PARTNER_WEAPONS } from '@/adventure/balance/targets';
import { getFeaturesForLevel } from '@/adventure/loadout';
import type { AdventureSave, ArcanaId, LevelDef } from '@/adventure/types';
import type { CharacterName } from '@/types';

const RUNS = 6;
const PARTNER_ANCHOR = 'blast-powder';
const PARTNER_ANCHOR_EVO = 'blast-powder:cluster-charge';

/** How far ahead of the field a build may get before it counts as broken. */
const LIMITS = {
  /** An evolved weapon vs the strongest base single weapon */
  evolvedVsBestSingle: 1.9,
  /** A fighter's best build vs that fighter's best single damage weapon */
  fighterComboVsSingle: 2.0,
  /** A fighter's best build vs the median fighter's best build */
  fighterVsField: 1.6,
  /** Any random endgame build vs the median random build */
  randomVsMedian: 2.75,
};

/** How little an evolution may add before it counts as a dead pick. */
const FLOORS = {
  /** An evolved weapon with its evolution on vs the same loadout with that evolution off */
  evolutionLift: 1.04,
  /** The median evolution lift across all 192 per-weapon evolutions */
  medianEvolutionLift: 1.15,
};

const ref = getLevel('4-4');
const DUMMY: LevelDef = {
  ...ref,
  // Keeps 4-4's id so the dummy sits at 4-4 on the map and gets every campaign feature taught by then
  id: ref.id,
  foes: [{ name: 'Training Dummy', icon: ref.foes[0].icon, hp: 1e7, parry: null }],
  // A fixed five-trait board without the Shading Surge, so the comparison stays stable
  rules: {
    ...ref.rules,
    attributes: ['shape', 'color', 'number', 'shading', 'background'],
    boardSize: 18,
    shadingSurge: undefined,
    timer: undefined,
    moves: 25,
    hearts: 10,
    hazards: undefined,
  },
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
  return {
    ...m,
    upgrades: {},
    skillNodes: {},
    charms: [],
    equippedArcana: [],
    equippedEvolutions: {},
    legacyWeaponTiers,
    weaponTuning,
  };
};

const SAVE = endgameSave();

const evoSaveFor = (base: AdventureSave, evoId: string, weaponId: string, enabled: boolean): AdventureSave => {
  const isPartner = PARTNER_WEAPONS.includes(weaponId);
  const charms = isPartner ? [PARTNER_ANCHOR, weaponId] : [weaponId];
  if (enabled) {
    return {
      ...base,
      charms,
      unlockedWeaponEvolutions: isPartner ? [PARTNER_ANCHOR_EVO, evoId] : [evoId],
      equippedEvolutions: isPartner ? { [PARTNER_ANCHOR]: PARTNER_ANCHOR_EVO, [weaponId]: evoId } : { [weaponId]: evoId },
    };
  }
  return {
    ...base,
    charms,
    unlockedWeaponEvolutions: isPartner ? [PARTNER_ANCHOR_EVO] : [],
    equippedEvolutions: isPartner ? { [PARTNER_ANCHOR]: PARTNER_ANCHOR_EVO } : {},
  };
};

/** A real timed fight (3 minutes, 5 hearts) against the same foe that can't fall. */
const TIMED: LevelDef = { ...DUMMY, rules: { ...DUMMY.rules, moves: undefined, timer: 180, hearts: 5 } };
const FLOOR_RUNS = 10;
/**
 * Ten fights is a noisy sample, above all for a build that can die and end a fight early.
 * A reading under a floor is taken again over this many fights before it counts.
 */
const RECHECK_RUNS = 60;
/** Mean total damage in the timed fight, with nothing picked up or bought on the way. */
const totalDamage = (save: AdventureSave, bot = BOTS.average, runs = FLOOR_RUNS) => {
  let sum = 0;
  for (let i = 0; i < runs; i++) sum += simulateRun(TIMED, save, bot, 1000 + i * 7919, undefined, { skipPicks: true }).state.totalDamage;
  return sum / runs;
};

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

  it('a bot builds Synergy-overlapping belts, equips unlocked per-weapon evolutions, and tries almost every weapon', () => {
    const triedWeapons = new Set<string>();
    const triedEvos = new Set<string>();
    let synergisticBelts = 0;
    const runs = 400;
    for (let i = 0; i < runs; i++) {
      const rng = createRng(i);
      const charms = chooseCharms(SAVE, rng);
      const eq = chooseEquippedEvolutions(SAVE, charms, rng);
      if (charms.some(w => beltSynergyOverlap(w, charms).length > 0)) synergisticBelts += 1;
      for (const w of charms) {
        triedWeapons.add(w);
        if (eq[w]) triedEvos.add(eq[w]);
      }
    }
    expect(synergisticBelts / runs).toBeGreaterThanOrEqual(0.6);
    expect(triedWeapons.size).toBeGreaterThanOrEqual(Math.floor(SAVE.armory.length * 0.9));
    expect(triedEvos.size).toBeGreaterThanOrEqual(Math.floor(WEAPON_EVOLUTIONS.length * 0.8));
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
  /** Per-weapon evolutions by damage per Set (filled by the first sweep) */
  const evoStrength: { id: string; weaponId: string; dps: number }[] = [];

  it('weapons and per-weapon evolutions: no evolved weapon runs away from the best single weapon', () => {
    const singles = SAVE.armory.map(id => ({ id, ...measure({ ...SAVE, charms: [id] }) }));
    const best = Math.max(...singles.filter(s => DAMAGE_WEAPONS.includes(s.id)).map(s => s.dps));
    report.push(`best single ${fmt(best)}: ` + [...singles].sort((a, b) => b.dps - a.dps).slice(0, 6).map(s => `${s.id} ${fmt(s.dps)}`).join(', '));
    // Single weapons: none is far ahead of the strongest damage weapon
    for (const s of singles) expect(s.dps).toBeLessThanOrEqual(best * 1.25);

    const features = getFeaturesForLevel(DUMMY, SAVE);
    expect(features.has('evolutions')).toBe(true);
    const runawayEvos: { id: string; dps: number; cap: number }[] = [];
    for (const evo of WEAPON_EVOLUTIONS) {
      const m = measure(evoSaveFor(SAVE, evo.id, evo.weaponId, true));
      evoStrength.push({ id: evo.id, weaponId: evo.weaponId, dps: m.dps });
      const cap = best * (PARTNER_WEAPONS.includes(evo.weaponId) ? LIMITS.evolvedVsBestSingle * 1.2 : LIMITS.evolvedVsBestSingle);
      if (m.dps > cap) runawayEvos.push({ id: evo.id, dps: Number(m.dps.toFixed(2)), cap: Number(cap.toFixed(2)) });
    }
    expect(runawayEvos).toEqual([]);
  }, 180_000);

  it('full skill trees: no fighter-and-evolution pairing runs away, and no fighter runs away from the field', () => {
    const topEvos = [...evoStrength].sort((a, b) => b.dps - a.dps).slice(0, 15);
    const bestBuilds: number[] = [];
    for (const fighter of SAVE.unlockedFighters as CharacterName[]) {
      const save = { ...SAVE, selectedFighter: fighter, skillNodes: { [fighter]: buyTree(fighter, TREE_BUDGET, 'spread', createRng(1)) } };
      const singles = DAMAGE_WEAPONS.map(id => measure({ ...save, charms: [id] }).dps);
      const single = Math.max(...singles);
      const combos = topEvos.map(ev => ({
        id: ev.id,
        dps: measure(evoSaveFor(save, ev.id, ev.weaponId, true)).dps,
      }));
      const top = combos.reduce((a, b) => (b.dps > a.dps ? b : a));
      report.push(`${fighter.padEnd(16)} best single ${fmt(single)} · best evo ${top.id} ${fmt(top.dps)} (×${fmt(top.dps / single)})`);
      const cap = single * LIMITS.fighterComboVsSingle;
      expect({ fighter, topId: top.id, dps: Number(top.dps.toFixed(2)), single: Number(single.toFixed(2)), cap: Number(cap.toFixed(2)), ok: top.dps <= cap }).toEqual({
        fighter,
        topId: top.id,
        dps: Number(top.dps.toFixed(2)),
        single: Number(single.toFixed(2)),
        cap: Number(cap.toFixed(2)),
        ok: true,
      });
      bestBuilds.push(Math.max(single, top.dps));
    }
    const mid = median(bestBuilds);
    for (const b of bestBuilds) expect(b).toBeLessThanOrEqual(mid * LIMITS.fighterVsField);
  }, 180_000);

  it('random endgame builds (fighter, full tree, charms, evolutions, Arcana): none runs far ahead of the rest', () => {
    const builds = Array.from({ length: 30 }, (_, i) => {
      const rng = createRng(500 + i);
      const fighter = rng.pick(SAVE.unlockedFighters);
      const slots = 3 + Math.floor(rng.next() * 4);
      const arcanaCount = Math.floor(rng.next() * 4);
      const arcana: ArcanaId[] = [];
      for (const aId of rng.shuffle(ARCANA.map(a => a.id))) {
        if (arcana.length >= arcanaCount) break;
        // Never pair contradictory monochrome_pact + prismatic_fever
        if (aId === 'monochrome_pact' && arcana.includes('prismatic_fever')) continue;
        if (aId === 'prismatic_fever' && arcana.includes('monochrome_pact')) continue;
        arcana.push(aId);
      }
      const stars: Record<string, number> = {
        ...(slots >= 4 ? { '1-10': 1 } : {}),
        ...(slots >= 5 ? { '2-10': 1 } : {}),
      };
      const save: AdventureSave = {
        ...SAVE,
        stars,
        selectedFighter: fighter,
        upgrades: { ...(slots >= 6 ? { charm_belt: 1 } : {}), tarot_deck: 2 },
        skillNodes: { [fighter]: buyTree(fighter, TREE_BUDGET, 'spread', rng) },
        equippedArcana: arcana,
      };
      const charms = chooseCharms(save, rng);
      const equippedEvolutions = chooseEquippedEvolutions(save, charms, rng);
      const hpScale = arcanaRules(arcana).foeHpScale ?? 1;
      const m = measure({ ...save, charms, equippedEvolutions });
      return { label: `${fighter} [${charms.join(', ')}] {${arcana.join(', ')}}`, dps: m.dps / hpScale, evolutions: m.evolutions };
    });
    const mid = median(builds.map(b => b.dps));
    const sorted = [...builds].sort((a, b) => b.dps - a.dps);
    report.push(`random builds: median ${fmt(mid)}, top: ` + sorted.slice(0, 3).map(b => `${fmt(b.dps)} ${b.label}`).join(' | '));
    const cap = mid * LIMITS.randomVsMedian;
    expect({ top: sorted[0].label, dps: Number(sorted[0].dps.toFixed(2)), mid: Number(mid.toFixed(2)), cap: Number(cap.toFixed(2)), ok: sorted[0].dps <= cap }).toEqual({
      top: sorted[0].label,
      dps: Number(sorted[0].dps.toFixed(2)),
      mid: Number(mid.toFixed(2)),
      cap: Number(cap.toFixed(2)),
      ok: true,
    });
  }, 120_000);
});

describe('no evolution is a dead pick (endgame weapons, a timed fight, no picks)', () => {
  it('the Understudy and the Encore Mask add damage beside what they need', () => {
    const blast = totalDamage({ ...SAVE, charms: ['blast-powder'] });
    const copied = totalDamage({ ...SAVE, charms: ['blast-powder', 'understudy'] });
    const anchorBase = totalDamage(evoSaveFor(SAVE, PARTNER_ANCHOR_EVO, PARTNER_ANCHOR, true));
    const encore = totalDamage({
      ...evoSaveFor(SAVE, PARTNER_ANCHOR_EVO, PARTNER_ANCHOR, true),
      charms: [PARTNER_ANCHOR, 'encore-mask'],
    });
    report.push(`understudy beside Blast Powder ×${fmt(copied / blast)}, Encore Mask beside evolved Blast Powder ×${fmt(encore / anchorBase)}`);
    expect(copied).toBeGreaterThan(blast * 1.1);
    expect(encore).toBeGreaterThan(anchorBase * 1.02);
  });

  it('every per-weapon evolution out-damages its weapon without it, and the typical one is meaningful', () => {
    const liftOf = (evoId: string, weaponId: string, runs: number) =>
      totalDamage(evoSaveFor(SAVE, evoId, weaponId, true), BOTS.average, runs) /
      Math.max(1, totalDamage(evoSaveFor(SAVE, evoId, weaponId, false), BOTS.average, runs));
    const lifts = WEAPON_EVOLUTIONS.map(evo => {
      const quick = liftOf(evo.id, evo.weaponId, FLOOR_RUNS);
      return { id: evo.id, lift: quick >= FLOORS.evolutionLift ? quick : liftOf(evo.id, evo.weaponId, RECHECK_RUNS) };
    });
    const sorted = [...lifts].sort((a, b) => a.lift - b.lift);
    report.push(`evolution lift: median ×${fmt(median(lifts.map(l => l.lift)))}, weakest ` + sorted.slice(0, 8).map(l => `${l.id} ×${fmt(l.lift)}`).join(', '));
    report.push('evolution lift, strongest: ' + sorted.slice(-8).map(l => `${l.id} ×${fmt(l.lift)}`).join(', '));
    for (const l of lifts) expect({ id: l.id, ok: l.lift >= FLOORS.evolutionLift }).toEqual({ id: l.id, ok: true });
    expect(median(lifts.map(l => l.lift))).toBeGreaterThanOrEqual(FLOORS.medianEvolutionLift);
  }, 300_000);
});
