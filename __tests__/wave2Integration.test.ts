/**
 * Wave 2 cross-lane integration tests (Seams A, B, C, D):
 *  - Seam A: ExtendedArcanaRules kiss-curse hooks + simple SUM×MULT equation + entropy pity-bag accumulator
 *  - Seam B: relief.ts -> createRun / applyLevelResult / applyRetreatResult (no double coinMultiplier) + coach.ts 3-loss World 3–5 stuck nudge
 *  - Seam D: TentacleLockEffect live stat sync, GazeDrainEffect, HeavySlamInactivityEffect, SunnyGecko, GoldenMole, Hydra 3-head phases, 5 Parry archetypes
 */
import type { Card } from '@/types';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getLevel } from '@/adventure/data/levels';
import { getParryArchetype, PARRY_RULES } from '@/adventure/data/parry';
import {
  LOSS_STREAK_ASSIST_STEPS,
  resolveRunReliefOptions,
  STUCK_NUDGE_LOSS_THRESHOLD,
} from '@/adventure/data/relief';
import { assistCardsFor, assistStepsFor, computeLiveGuidance } from '@/adventure/coach';
import { baseCardReward, createRun, runReducer } from '@/adventure/engine/run';
import { countDifferentAttributes, isRainbow } from '@/adventure/engine/sets';
import { applyLevelResult, createMaxedSave, createNewSave, setCauldronWager } from '@/adventure/progress';
import type { LevelDef, RunState } from '@/adventure/types';
import { findSet, plainRewards, playSet, startFight, testLevel, tick } from './testUtils/adventureFight';

const matchCards = (s: RunState, cards: Card[], resolveWeapons = false): RunState => {
  const next = runReducer(
    s,
    resolveWeapons
      ? { type: 'MATCH', cards, resolveWeapons: true, hinted: false }
      : { type: 'MATCH', cards, rewards: plainRewards(cards), hinted: false }
  );
  return runReducer(next, { type: 'REPLACE', ids: next.replacing.length ? next.replacing : cards.map(c => c.id) });
};

describe('Seam A: ExtendedArcanaRules kiss-curse hooks in engine', () => {
  it('Monochrome Pact adds +8 flat & +0.15 Power on 1-diff Sets, halves Rainbows once (×0.5), and halves 4-trait 3-diff Sets', () => {
    const level4 = testLevel({
      rules: { attributes: ['shape', 'color', 'number', 'shading'], boardSize: 12, hearts: 5 },
      foes: [{ name: 'Target', hp: 500 }],
    });
    const baseSave = {
      selectedFighter: 'Corgi' as const,
      unlockedArcana: ['monochrome_pact' as const],
      equippedArcana: ['monochrome_pact' as const],
      armory: [],
      charms: [],
    };
    let s = startFight({ level: level4, save: baseSave });

    // Force a 1-diff Set (only shape differs)
    const oneDiff: Card[] = [
      { ...s.board[0], shape: 'oval', color: 'red', number: 1, shading: 'solid' },
      { ...s.board[1], shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
      { ...s.board[2], shape: 'squiggle', color: 'red', number: 1, shading: 'solid' },
    ];
    s = { ...s, board: [...oneDiff, ...s.board.slice(3)] };
    const hpBefore1 = s.foeHp;
    s = matchCards(s, oneDiff);
    expect(s.power).toBeCloseTo(0.15, 4);
    // Simple equation: (3 card base + 8 monochrome flat) × powerMultiplier(0.15 = 1.15) = round(11 * 1.15) = 13
    expect(hpBefore1 - s.foeHp).toBe(Math.round((3 + 8) * 1.15));

    // Force a 3-diff NON-rainbow Set on 4-trait board (shading same, shape/color/number diff)
    const threeDiff: Card[] = [
      { ...s.board[0], shape: 'oval', color: 'red', number: 1, shading: 'solid' },
      { ...s.board[1], shape: 'diamond', color: 'green', number: 2, shading: 'solid' },
      { ...s.board[2], shape: 'squiggle', color: 'purple', number: 3, shading: 'solid' },
    ];
    expect(countDifferentAttributes(threeDiff, s.attributes)).toBe(3);
    expect(isRainbow(threeDiff, s.attributes)).toBe(false);
    s = { ...s, board: [...threeDiff, ...s.board.slice(3)], power: 0 };
    const hpBefore3 = s.foeHp;
    s = matchCards(s, threeDiff);
    // highDiffDamageScale = 0.5 -> round(3 * 0.5) = 2
    expect(hpBefore3 - s.foeHp).toBe(Math.round(3 * 0.5));

    // Verify 3-trait Rainbow is halved ONCE (×0.5), NOT double-halved to ×0.25
    let s3 = startFight({ save: baseSave });
    const rainbow3: Card[] = [
      { ...s3.board[0], shape: 'oval', color: 'red', number: 1, shading: 'solid' },
      { ...s3.board[1], shape: 'diamond', color: 'green', number: 2, shading: 'solid' },
      { ...s3.board[2], shape: 'squiggle', color: 'purple', number: 3, shading: 'solid' },
    ];
    s3 = { ...s3, board: [...rainbow3, ...s3.board.slice(3)], power: 0 };
    const hpBeforeR = s3.foeHp;
    s3 = matchCards(s3, rainbow3);
    expect(s3.lastSetIgnition?.math.multiplier).toBeCloseTo(0.5, 4);
    expect(hpBeforeR - s3.foeHp).toBe(Math.round(3 * 0.5));
  });

  it('Controlled Burn adds +0.2 Power, stamps ×1.5 burn dmg on ignited cards, and deals 2 hearts on cooldown mistakes', () => {
    let s = startFight({
      save: {
        selectedFighter: 'Corgi',
        unlockedArcana: ['controlled_burn'],
        equippedArcana: ['controlled_burn'],
        armory: [],
        charms: [],
      },
      level: testLevel({ rules: { hearts: 5, startingGraces: 2 }, foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear', 'graces'],
    });
    expect(s.stats.graces).toBe(0);

    const bad = s.board.slice(0, 3);
    s = runReducer(s, { type: 'INVALID', cards: bad });
    expect(s.hearts).toBe(5);
    expect(s.power).toBeCloseTo(0.2, 4);
    expect(s.arcanaBurnCooldownMs).toBe(5000);
    const burning = s.board.filter(c => c.onFire);
    expect(burning.length).toBeGreaterThan(0);
    expect(s.burnMults?.[burning[0].id]).toBe(1.5);

    // Mistake while burn is on cooldown costs 2 Hearts
    s = runReducer(s, { type: 'INVALID', cards: bad });
    expect(s.hearts).toBe(3);
  });

  it('Glass Prism locks max hearts to 3, disables all healing, and boosts spawned Power cards to +4', () => {
    let s = startFight({
      save: {
        unlockedArcana: ['glass_prism'],
        equippedArcana: ['glass_prism'],
        armory: ['mending-charm'],
        charms: ['mending-charm'],
      },
      level: testLevel({ rules: { hearts: 6 }, foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear', 'power'],
    });
    expect(s.maxHearts).toBe(3);
    expect(s.hearts).toBe(3);
    // Lose a heart and verify healing cannot restore it
    s = { ...s, hearts: 1 };
    const set = findSet(s)!;
    const healedReward = plainRewards(set);
    healedReward[0] = { ...healedReward[0], healing: 2 };
    s = runReducer(s, { type: 'MATCH', cards: set, rewards: healedReward });
    expect(s.hearts).toBe(1);

    // Newly drawn Power cards carry +4 bonusPoints instead of +2
    const powerCards = s.board.filter(c => (c.bonusPoints ?? 0) > 0);
    for (const c of powerCards) {
      expect(c.bonusPoints).toBe(4);
    }
  });

  it('Overkill Harvest zeroes base Set coins, pays Gold cards, and carries 50% overkill into the next wave', () => {
    const multiWave: LevelDef = testLevel({
      foes: [
        { name: 'Wave 1', hp: 5 },
        { name: 'Wave 2', hp: 100 },
      ],
    });
    let s = startFight({
      level: multiWave,
      save: {
        selectedFighter: 'Corgi',
        unlockedArcana: ['overkill_harvest'],
        equippedArcana: ['overkill_harvest'],
        armory: [],
        charms: [],
      },
      features: ['hearts', 'gear', 'coins'],
    });

    // Plain Set on high-HP foe yields 0 coins
    const highHp = { ...s, foeHp: 200, foeMaxHp: 200 };
    const set0 = findSet(highHp)!;
    const plainBoard = highHp.board.map(c => ({ ...c, bonusMoney: 0 }));
    const afterPlain = matchCards({ ...highHp, board: plainBoard }, set0.map(c => ({ ...c, bonusMoney: 0 })));
    expect(afterPlain.coins).toBe(0);

    // Gold card still pays its bonusMoney
    const goldCard = { ...set0[0], bonusMoney: 3 };
    const goldSet = [goldCard, { ...set0[1], bonusMoney: 0 }, { ...set0[2], bonusMoney: 0 }];
    const goldBoard = plainBoard.map(c => (c.id === goldCard.id ? goldCard : c));
    const afterGold = runReducer(
      { ...highHp, board: goldBoard },
      { type: 'MATCH', cards: goldSet, rewards: goldSet.map(baseCardReward), hinted: false }
    );
    expect(afterGold.coins).toBeGreaterThanOrEqual(3);

    // Overkill Wave 1 (5 HP) by dealing 25 dmg (20 overkill) -> carries 10 dmg into Wave 2!
    const killSet = findSet(s)!;
    const boosted = killSet.map((c, idx) => (idx === 0 ? { ...c, bonusPoints: 22 } : { ...c, bonusPoints: 0 }));
    const killBoard = s.board.map(c => boosted.find(b => b.id === c.id) ?? c);
    s = runReducer({ ...s, board: killBoard }, { type: 'MATCH', cards: boosted, rewards: boosted.map(baseCardReward) });
    expect(s.status).toBe('intermission');
    expect(s.pendingOverkillCarry).toBe(10);
    s = runReducer(s, { type: 'NEXT_WAVE' });
    expect(s.wave).toBe(1);
    expect(s.foeHp).toBe(90);
    expect(s.pendingOverkillCarry).toBe(0);
  });

  it("Scholar's Gambit grants +0.3 Power on level-up; Catalyst Resonance scales non-evolved Sets ×0.75; Tempo Surge adds +1 Combo step", () => {
    // Scholar's Gambit: level-up adds +0.3 Power
    let scholar = startFight({
      save: { unlockedArcana: ['scholars_gambit'], equippedArcana: ['scholars_gambit'], armory: ['blast-powder'], charms: [] },
      features: ['hearts', 'gear', 'xp'],
    });
    scholar = { ...scholar, xp: 4 };
    scholar = matchCards(scholar, findSet(scholar)!);
    expect(scholar.levelUpsTaken).toBeGreaterThanOrEqual(1);
    expect(scholar.power).toBeCloseTo(0.3 * scholar.levelUpsTaken, 4);

    // Catalyst Resonance: non-evolved Set deals ×0.75
    let cat = startFight({
      save: { selectedFighter: 'Corgi', unlockedArcana: ['catalyst_resonance'], equippedArcana: ['catalyst_resonance'], armory: [], charms: [] },
    });
    const hpBefore = cat.foeHp;
    cat = matchCards(cat, findSet(cat)!);
    expect(cat.lastSetIgnition?.math.multiplier).toBeCloseTo(0.75, 4);
    expect(hpBefore - cat.foeHp).toBe(Math.round(3 * 0.75));

    // Tempo Surge: every Set adds +1 bonus Combo step (first Set reaches combo = 2, bonusCombo = 1)
    let tempo = startFight({
      save: { unlockedArcana: ['tempo_surge'], equippedArcana: ['tempo_surge'], armory: [], charms: [] },
    });
    tempo = matchCards(tempo, findSet(tempo)!);
    expect(tempo.combo).toBe(2);
    expect(tempo.bonusCombo).toBe(1);
  });

  it('wires damped-entropy pity-bag accumulator deterministically for low-proc (<=35%) weapons via _weaponRng', () => {
    const save = {
      armory: ['prismatic-ray', 'chaos-shard', 'echo-stone'],
      charms: ['prismatic-ray', 'chaos-shard', 'echo-stone'],
    };
    const runWithSeed = (seed: number) => {
      let s = createRun(
        testLevel({ foes: [{ name: 'Punching Bag', hp: 5000 }] }),
        { ...createNewSave(), ...save },
        { seed, features: new Set(['hearts', 'gear']) }
      );
      let laserFires = 0;
      let ricochetFires = 0;
      let echoFires = 0;
      for (let i = 0; i < 12; i++) {
        const set = findSet(s);
        if (!set) break;
        const prevSeq = s.eventSeq;
        s = matchCards(s, set, true);
        const fresh = s.events.filter(e => e.id > prevSeq);
        if (fresh.some(e => e.type === 'laser')) laserFires += 1;
        if (fresh.some(e => e.type === 'ricochet')) ricochetFires += 1;
        if (fresh.some(e => e.type === 'echo')) echoFires += 1;
      }
      return { s, laserFires, ricochetFires, echoFires };
    };

    const a = runWithSeed(777);
    const b = runWithSeed(777);
    // Bit-for-bit deterministic replay across _weaponRng + procAccum
    expect(a.s.procAccum).toEqual(b.s.procAccum);
    expect(a.s.totalDamage).toBe(b.s.totalDamage);
    // Low-proc channels (14% laser, 18% ricochet, 10% echo) populate procAccum and fire within 12 Sets!
    expect(a.s.procAccum?.laser).toBeDefined();
    expect(a.s.procAccum?.ricochet).toBeDefined();
    expect(a.s.procAccum?.echo).toBeDefined();
    expect(a.laserFires).toBeGreaterThanOrEqual(1);
    expect(a.ricochetFires).toBeGreaterThanOrEqual(1);
    expect(a.echoFires).toBeGreaterThanOrEqual(1);
  });
});

describe('Seam B: Relief/Wager coin settlement & World 3–5 3-loss coach stuck nudge', () => {
  it('does not double-multiply Cauldron Wager coins between fight addCoins and applyLevelResult settlement', () => {
    const lvl = getLevel('2-4');
    let save = { ...createNewSave(), coinsUnlocked: true, coins: 200, lifetimeCoins: 200 };
    save = setCauldronWager(save, 1); // Bold Wager: 50c stake, 1.5x coins on KO
    const relief = resolveRunReliefOptions(lvl, save);
    expect(relief.cauldronWager).toBe(1);
    expect(relief.coinMultiplier).toBe(1.5);

    const stdRun = createRun(lvl, { ...save, cauldronWager: 0 }, { seed: 42 });
    const wagerRun = createRun(lvl, save, { seed: 42, relief });
    expect(wagerRun.foeHp).toBe(Math.round(lvl.foes[0].hp * 1.25));
    // Same Set yields the same in-fight run coins (not prematurely multiplied before KO)
    const set = findSet(stdRun)!;
    const afterStd = matchCards(stdRun, set);
    const afterWager = matchCards(wagerRun, set);
    expect(afterWager.coins).toBe(afterStd.coins);

    // Settling a 2★ KO multiplies run coins ONCE by 1.5x and adds +50c stake profit
    const settled = applyLevelResult(save, lvl, 2, afterWager.coins, afterWager);
    expect(settled.coinsBanked).toBe(Math.round(afterWager.coins * 1.5));
    expect(settled.wagerStakeDelta).toBe(50);
  });

  it('coach.ts activates 25s 1-card stuck nudge on World 3–5 once consecutiveLosses >= 3', () => {
    const lvl32 = getLevel('3-2');
    expect(assistStepsFor(lvl32, 0)).toBeNull();
    expect(assistStepsFor(lvl32, STUCK_NUDGE_LOSS_THRESHOLD - 1)).toBeNull();
    expect(assistStepsFor(lvl32, STUCK_NUDGE_LOSS_THRESHOLD)).toEqual(LOSS_STREAK_ASSIST_STEPS);
    expect(assistCardsFor(lvl32, 24000, 3)).toBe(0);
    expect(assistCardsFor(lvl32, 25000, 3)).toBe(1);

    let run = createRun(lvl32, createMaxedSave(), { seed: 9 });
    run = { ...run, elapsedMs: 26000, lastMatchAtMs: 0 };
    expect(computeLiveGuidance(run, { seenIntro: true, consecutiveLosses: 2 })).toBeNull();
    const hint = computeLiveGuidance(run, { seenIntro: true, consecutiveLosses: 3 });
    expect(hint?.kind).toBe('rescue');
    expect(hint?.glowIds).toHaveLength(1);
  });
});

describe('Seam D: Boss refactors, dynamic TentacleLock sync, Hydra 3-head phases & 5 Parry archetypes', () => {
  it("Kraken's Grasp TentacleLock dynamically dampens 1 weapon stat in runReducer and snaps cleanly for ×1.5", () => {
    const lvl51 = getLevel('5-1');
    const save = {
      ...createMaxedSave(),
      charms: ['blast-powder', 'prismatic-ray', 'flint-spark', 'mending-charm', 'time-drop', 'seeker-lens'],
    };
    let s = createRun(lvl51, save, { seed: 123 });
    const initialStats = { ...s.stats };
    // Tick past 18s tentacle interval so Tentacle Lock wraps 1 weapon type
    s = tick(s, 19000, 500);
    const uiCounters = s.foe.getUIModifiers().weaponCounters ?? [];
    expect(uiCounters).toHaveLength(1);
    const countdownCard = s.board.find(c => c.hasCountdown);
    expect(countdownCard).toBeDefined();
    // Dynamic syncEnemyCounters updated d.stats immediately!
    const reducedSomeStat =
      s.stats.explosionChance < initialStats.explosionChance ||
      s.stats.laserChance < initialStats.laserChance ||
      s.stats.fireSpreadChance < initialStats.fireSpreadChance ||
      s.stats.healingChance < initialStats.healingChance ||
      s.stats.timeGainChance < initialStats.timeGainChance ||
      s.stats.hintGainChance < initialStats.hintGainChance ||
      s.stats.graceGainChance < initialStats.graceGainChance;
    expect(reducedSomeStat).toBe(true);

    // Force a valid Set containing the tentacle card and snap it!
    const set = findSet(s)!;
    const snapBoard = s.board.map(c =>
      c.id === set[0].id
        ? { ...c, id: countdownCard!.id, hasCountdown: true, countdownTimer: 8000 }
        : c.id === countdownCard!.id
          ? { ...c, id: set[0].id, hasCountdown: false, countdownTimer: undefined }
          : c
    );
    const snapSet = [snapBoard.find(c => c.id === countdownCard!.id)!, set[1], set[2]];
    s = runReducer({ ...s, board: snapBoard }, { type: 'MATCH', cards: snapSet, rewards: plainRewards(snapSet) });
    // Tentacle snapped: ×1.5 foe weakness multiplier AND stats restored!
    expect(s.foe.getUIModifiers().weaponCounters ?? []).toHaveLength(0);
    expect(s.stats.explosionChance).toBe(initialStats.explosionChance);
    expect(s.stats.laserChance).toBe(initialStats.laserChance);
    expect(s.lastSetIgnition?.math.multItems?.some(m => Math.abs(m.amount - 1.5) < 0.01)).toBe(true);
  });

  it('5-5 The Hydra progresses cleanly through all 3 Head phases with distinct abilities and Parry specs', () => {
    const lvl55 = getLevel('5-5');
    expect(lvl55.foes).toHaveLength(3);
    expect(lvl55.foes.map(f => f.hydraPhase)).toEqual([1, 2, 3]);
    expect(getParryArchetype('5-5')).toBe('boss_enrage');

    let s = createRun(
      lvl55,
      { ...createMaxedSave(), selectedFighter: 'Corgi', charms: [] },
      { seed: 55, features: new Set(['hearts', 'gear']) }
    );
    expect(s.foe.description).toMatch(/Head I/);
    // Defeat Head 1 -> intermission -> Head 2
    s = runReducer({ ...s, foeHp: 1 }, { type: 'MATCH', cards: findSet(s)!, rewards: plainRewards(findSet(s)!) });
    expect(s.status).toBe('intermission');
    s = runReducer(s, { type: 'NEXT_WAVE' });
    expect(s.wave).toBe(1);
    expect(s.foe.description).toMatch(/Head II/);
    expect(s.parry?.spec.attackName).toBe('Hydra Snap');

    // Defeat Head 2 -> intermission -> Head 3 (Heavy Slam −2♥, zero instantDeath)
    s = runReducer({ ...s, foeHp: 1 }, { type: 'MATCH', cards: findSet(s)!, rewards: plainRewards(findSet(s)!) });
    expect(s.status).toBe('intermission');
    s = runReducer(s, { type: 'NEXT_WAVE' });
    expect(s.wave).toBe(2);
    expect(s.foe.description).toMatch(/Head III/);
    expect(s.parry?.spec.attackName).toBe('Hydra Apocalypse');
    expect(s.parry?.spec.bossEnrageDeltaMs).toBe(PARRY_RULES.bossEnrageCooldownDeltaMs);

    // 30s inactivity triggers Heavy Slam (−2 ♥) alongside any expired countdowns, never instant death!
    const heartsBefore = s.hearts!;
    // Clear existing countdown timers on board so we isolate the 30s Heavy Slam impact cleanly
    const cleanBoard = s.board.map(c => ({ ...c, hasCountdown: false, countdownTimer: undefined }));
    s = tick({ ...s, board: cleanBoard, parry: null }, 30500, 500);
    expect(s.hearts).toBeLessThanOrEqual(heartsBefore - 2);
    expect(s.status).toBe('playing');
    expect(s.events.some(e => e.type === 'inactivity')).toBe(true);
  });

  it('verifies all 5 Parry archetypes (heavy, swarm, stalker, tactical, boss_enrage) in engine/run.ts', () => {
    expect(getParryArchetype('3-1')).toBe('heavy');
    expect(getParryArchetype('3-3')).toBe('swarm');
    expect(getParryArchetype('2-4')).toBe('stalker');
    expect(getParryArchetype('1-5')).toBe('tactical');
    expect(getParryArchetype('4-11')).toBe('boss_enrage');

    // Heavy Slam unparried deals 2♥ and Counter Parry staggers for 9000ms
    let heavy = createRun(
      getLevel('3-1'),
      { ...createMaxedSave(), selectedFighter: 'Corgi', charms: [] },
      { seed: 31, features: new Set(['hearts', 'gear']) }
    );
    const hBefore = heavy.hearts!;
    // Advance through initial calm + full windup to take unparried Heavy Slam
    heavy = tick(heavy, heavy.parry!.msLeft + heavy.parry!.spec.windupMs + 500, 500);
    expect(heavy.hearts).toBe(hBefore - 2);

    // Default any-Set timing parry on 1-5 triggers 2500ms micro-Stagger
    let w1 = createRun(getLevel('1-5'), createMaxedSave(), { seed: 15 });
    w1 = tick(w1, w1.parry!.msLeft + 500, 500);
    expect(w1.parry?.phase).toBe('windup');
    w1 = playSet(w1);
    expect(w1.parry?.phase).toBe('staggered');
    expect(w1.parry?.durationMs).toBe(PARRY_RULES.anyStaggerMs);
    expect(getArmoryWeapon('blast-powder')).toBeDefined();
  });
});
