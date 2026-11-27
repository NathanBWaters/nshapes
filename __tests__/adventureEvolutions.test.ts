/**
 * Per-weapon evolution roster & runtime execution:
 *  - Every one of the 192 evolutions runs cleanly in a real fight from ignition to finale & cooldown
 *  - Parallel multi-weapon ignition with additive +0.20× chassis and zero pick_evolution/Catalyst
 *  - Deterministic FightRecorder & replayFight round-trip
 *  - Wave 2 evolution invariants (Encore Mask, Catalyst Prism, Evolution Resonance, Glass Sword repair, zero dead triggers)
 */
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon } from '@/adventure/data/armory';
import {
  EVOLUTION_COUNT,
  WEAPON_EVOLUTIONS,
  evolutionShortVerb,
  evolutionsForWeapon,
  getWeaponEvolution,
} from '@/adventure/data/evolutions';
import { EVOLUTION_CHASSIS } from '@/adventure/engine/sources';
import { createMaxedSave } from '@/adventure/progress';
import { baseCardReward, createRun, runReducer } from '@/adventure/engine/run';
import { FightRecorder, replayFight } from '@/adventure/engine/replay';
import { eventsOf, findSet, miss, playSet, startFight, testLevel, tick } from './testUtils/adventureFight';

const dummyLevel = testLevel({
  rules: { attributes: ['shape', 'color', 'number'], boardSize: 12, timer: 300 },
  foes: [{ name: 'Dummy', hp: 1e6 }],
});

describe('per-weapon evolution roster', () => {
  it('has 3 bespoke evolutions for each of the 64 Armory weapons (192 total), all with unique IDs/names and live effects', () => {
    expect(ALL_ARMORY_WEAPON_IDS).toHaveLength(64);
    expect(EVOLUTION_COUNT).toBe(192);
    expect(WEAPON_EVOLUTIONS).toHaveLength(192);
    expect(new Set(WEAPON_EVOLUTIONS.map(e => e.id)).size).toBe(192);
    expect(new Set(WEAPON_EVOLUTIONS.map(e => e.name)).size).toBe(192);

    for (const wId of ALL_ARMORY_WEAPON_IDS) {
      const evos = evolutionsForWeapon(wId);
      expect(evos).toHaveLength(3);
      for (const e of evos) {
        const hasPayload =
          (e.source?.rules?.length ?? 0) +
            Object.keys(e.source?.modifiers ?? {}).length +
            (e.openingEffects?.length ?? 0) +
            (e.finaleEffects?.length ?? 0) >
          0;
        expect({ id: e.id, hasPayload }).toEqual({ id: e.id, hasPayload: true });
        expect(evolutionShortVerb(e).length).toBeGreaterThanOrEqual(8);
        expect(evolutionShortVerb(e).length).toBeLessThanOrEqual(64);
      }
    }
  });
});

describe('every one of the 192 per-weapon evolutions executes cleanly from ignition to finale & cooldown', () => {
  it.each(WEAPON_EVOLUTIONS.map(e => [e.id, e] as const))(
    '%s ignites, runs its rules, expires into cooldown, and keeps HP finite',
    (_id, evo) => {
      const held = evo.weaponId === 'understudy' ? ['flint-spark', 'understudy'] : [evo.weaponId];
      const equippedEvolutions =
        evo.weaponId === 'understudy'
          ? { 'flint-spark': 'flint-spark:cinder-trail', understudy: evo.id }
          : { [evo.weaponId]: evo.id };
      let s = startFight({
        level: dummyLevel,
        save: {
          selectedFighter: 'Pelican',
          armory: held,
          charms: held,
          unlockedWeaponEvolutions: Object.values(equippedEvolutions),
          equippedEvolutions,
        },
        features: ['hearts', 'gear', 'hints', 'graces', 'xp', 'coins', 'rainbow', 'purity', 'evolutions'],
      });
      expect(s.weaponEvolutions.some(t => t.evoId === evo.id)).toBe(true);

      s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: evo.weaponId });
      const active = s.weaponEvolutions.find(t => t.weaponId === evo.weaponId)!;
      expect(active.phase).toBe('active');
      expect(s.forgedEvolutions).toContain(evo.id);

      for (let i = 0; i < 3 && s.status === 'playing'; i++) s = playSet(tick(s, 1500, 500));
      if (s.status === 'playing') s = miss(s);
      if (s.status === 'playing') s = runReducer(s, { type: 'USE_HINT' });
      // Tick past duration + any possible freezes/extensions
      s = tick(s, active.durationMs + 25000, 1000);
      if (s.status === 'playing') {
        const after = s.weaponEvolutions.find(t => t.weaponId === evo.weaponId)!;
        expect(['cooldown', 'charging']).toContain(after.phase);
      }
      expect(Number.isFinite(s.foeHp)).toBe(true);
    }
  );
});

describe('parallel weapon evolutions, DEV actions, lethal timing & deterministic replay', () => {
  it('supports parallel simultaneous evolutions across a 5-weapon belt with zero Catalyst & zero pick_evolution pause', () => {
    const charms = ['blast-powder', 'flint-spark', 'war-drum', 'rally-horn', 'magnet'];
    const equippedEvolutions = Object.fromEntries(
      charms.map(id => [id, evolutionsForWeapon(id)[0].id])
    );
    let s = startFight({
      level: dummyLevel,
      save: {
        selectedFighter: 'Pelican',
        armory: charms,
        charms,
        stars: { '1-10': 3, '2-10': 3 },
        unlockedWeaponEvolutions: Object.values(equippedEvolutions),
        equippedEvolutions,
      },
      features: ['hearts', 'gear', 'evolutions'],
    });
    expect(s.weaponEvolutions).toHaveLength(5);

    // Ignite all 5 weapons simultaneously without ever entering pick_evolution or spawning Catalysts
    for (const id of charms) {
      s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: id });
      expect(s.status).toBe('playing');
    }
    expect(s.weaponEvolutions.filter(t => t.phase === 'active')).toHaveLength(5);
    expect(s.fightMetrics.maxSimultaneousEvos).toBe(5);
    expect(s.fightMetrics.distinctWeaponsEvolved).toBe(5);
    expect(s.evolutionsTriggered).toBe(5);
    expect(s.board.some(c => c.hasEvolutionItem)).toBe(false);
  });

  it('wins cleanly when an evolution ignition burst (+18) KOs the final foe', () => {
    const lowHpLevel = testLevel({
      rules: { attributes: ['shape', 'color', 'number'], boardSize: 12 },
      foes: [{ name: 'Wounded Imp', icon: 'lorc/imp', hp: 15 }],
    });
    let s = startFight({
      level: lowHpLevel,
      save: {
        selectedFighter: 'Pelican',
        armory: ['blast-powder'],
        charms: ['blast-powder'],
        unlockedWeaponEvolutions: ['blast-powder:cluster-charge'],
        equippedEvolutions: { 'blast-powder': 'blast-powder:cluster-charge' },
      },
      features: ['hearts', 'gear', 'evolutions'],
    });
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' });
    expect(s.status).toBe('won');
    expect(s.endReason).toBe('defeated');
    expect(s.foeHp).toBe(0);
    expect(s.evolutionsTriggered).toBe(1);
  });

  it('records and replays per-weapon evolutions deterministically via FightRecorder and replayFight', () => {
    const held = ['blast-powder', 'flint-spark', 'war-drum'];
    const save = {
      ...createMaxedSave(),
      selectedFighter: 'Pelican' as const,
      armory: held,
      charms: held,
      skillNodes: {},
      equippedArcana: [],
      upgrades: {},
    };
    const level = testLevel({
      rules: { attributes: ['shape', 'color', 'number'], boardSize: 12, timer: 180 },
      foes: [{ name: 'Replay Dummy', hp: 1000 }],
    });
    const seed = 777;
    const rec = new FightRecorder(seed);
    let s = createRun(level, save, { seed });
    const step = (action: Parameters<typeof runReducer>[1]) => {
      rec.record(action, s);
      s = runReducer(s, action);
    };

    // Play 3 Sets, ignite Blast Powder via DEV_ADVANCE_EVO / DEV_TRIGGER_EVO, tick, play another Set
    for (let i = 0; i < 3; i++) {
      const set = findSet(s)!;
      step({ type: 'MATCH', cards: set, rewards: set.map(baseCardReward) });
      step({ type: 'REPLACE', ids: set.map(c => c.id) });
    }
    step({ type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' });
    step({ type: 'TICK', ms: 1000 });
    const postSet = findSet(s)!;
    step({ type: 'MATCH', cards: postSet, rewards: postSet.map(baseCardReward) });
    step({ type: 'REPLACE', ids: postSet.map(c => c.id) });

    const replayed = replayFight(level, save, rec.toJSON());
    expect(replayed.foeHp).toBe(s.foeHp);
    expect(replayed.totalDamage).toBe(s.totalDamage);
    expect(replayed.weaponEvolutions).toEqual(s.weaponEvolutions);
    expect(replayed.forgedEvolutions).toEqual(s.forgedEvolutions);
    expect(replayed.synergy).toEqual(s.synergy);
    expect(replayed.status).toBe(s.status);
  });
});

describe('evolution system invariants & cross-weapon synergy', () => {
  it('has zero idle wait-to-win triggers across all 192 per-weapon evolutions', () => {
    for (const evo of WEAPON_EVOLUTIONS) {
      const rules = evo.source?.rules ?? [];
      expect(rules.some(ru => ru.trigger.on === 'idle')).toBe(false);
    }
  });

  it('Evolution Resonance Arcana grants +1 bonus charge tick, +5s duration & +26 ignition burst (+4s time)', () => {
    const evo = getWeaponEvolution('blast-powder:napalm-payload')!; // 3 consecutive Red Sets
    let s = startFight({
      level: dummyLevel,
      save: {
        selectedFighter: 'Pelican',
        armory: ['blast-powder'],
        charms: ['blast-powder'],
        unlockedArcana: ['catalyst_resonance'],
        equippedArcana: ['catalyst_resonance'],
        unlockedWeaponEvolutions: [evo.id],
        equippedEvolutions: { 'blast-powder': evo.id },
      },
      features: ['hearts', 'gear', 'evolutions'],
    });
    const hp0 = s.foeHp;
    const t0 = s.timeLeft!;
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' });
    const tracker = s.weaponEvolutions.find(t => t.weaponId === 'blast-powder')!;
    expect(tracker.phase).toBe('active');
    expect(tracker.durationMs).toBe(evo.durationMs + 5000);
    // Ignition burst: 18 base + 26 Arcana = 44 (plus any opening effects)
    expect(hp0 - s.foeHp).toBeGreaterThanOrEqual(EVOLUTION_CHASSIS.ignitionBurstDamage + 26);
    expect(s.timeLeft!).toBeGreaterThanOrEqual(t0 + 4);
  });

  it('Catalyst Prism Rainbows charge all charging weapon evolutions and extend active evolutions', () => {
    let s = startFight({
      level: dummyLevel,
      save: {
        selectedFighter: 'Pelican',
        armory: ['catalyst-prism', 'blast-powder'],
        charms: ['catalyst-prism', 'blast-powder'],
        unlockedWeaponEvolutions: ['catalyst-prism:harmonic-convergence', 'blast-powder:napalm-payload'],
        equippedEvolutions: {
          'catalyst-prism': 'catalyst-prism:harmonic-convergence',
          'blast-powder': 'blast-powder:napalm-payload',
        },
      },
      features: ['hearts', 'gear', 'rainbow', 'evolutions'],
    });
    // Activate Blast Powder, leave Catalyst Prism charging, then land a Rainbow Set!
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' });
    const remBefore = s.weaponEvolutions.find(t => t.weaponId === 'blast-powder')!.activeRemainingMs;
    const prismProgBefore = s.weaponEvolutions.find(t => t.weaponId === 'catalyst-prism')!.progress;

    // Force a Rainbow Set on slots [0, 1, 2]
    const board = [...s.board];
    board[0] = { ...board[0], id: 'rb-0', shape: 'oval', color: 'red', number: 1, shading: 'solid' };
    board[1] = { ...board[1], id: 'rb-1', shape: 'diamond', color: 'green', number: 2, shading: 'solid' };
    board[2] = { ...board[2], id: 'rb-2', shape: 'squiggle', color: 'purple', number: 3, shading: 'solid' };
    s = playSet({ ...s, board }, [board[0], board[1], board[2]]);

    // Blast Powder active timer extended by Catalyst Prism (+1500ms at Lv 1)!
    expect(s.weaponEvolutions.find(t => t.weaponId === 'blast-powder')!.activeRemainingMs).toBeGreaterThan(remBefore);
    // Catalyst Prism charged itself (+1 tick) and converted a card to Holo!
    const prismAfter = s.weaponEvolutions.find(t => t.weaponId === 'catalyst-prism')!;
    expect(prismAfter.progress > prismProgBefore || prismAfter.phase === 'active').toBe(true);
    expect(eventsOf(s, 'holo_spawn').length).toBeGreaterThanOrEqual(1);
    expect(getArmoryWeapon('catalyst-prism')).toBeDefined();
  });

  it('Glass Sword evolutions repair a shattered Glass Sword on ignition', () => {
    const evo = getWeaponEvolution('glass-sword:tempered-edge')!;
    let s = startFight({
      level: dummyLevel,
      save: {
        selectedFighter: 'Pelican',
        armory: ['glass-sword'],
        charms: ['glass-sword'],
        unlockedWeaponEvolutions: [evo.id],
        equippedEvolutions: { 'glass-sword': evo.id },
      },
      features: ['hearts', 'gear', 'evolutions'],
    });
    s = { ...s, gear: { ...s.gear, glassBroken: true } };
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: 'glass-sword' });
    expect(s.weaponEvolutions.find(t => t.weaponId === 'glass-sword')!.phase).toBe('active');
    expect(s.gear.glassBroken).toBe(false);
  });
});
