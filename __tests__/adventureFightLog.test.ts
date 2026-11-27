/**
 * The fight log (engine/fightLog.ts) and the replay's text (fightReplayText.ts):
 * every point of damage is accounted for, Sets and mistakes each get an entry,
 * and triggered effects name the weapon, skill node or evolution behind them.
 */
import { baseCardReward, runReducer } from '@/adventure/engine/run';
import { BOTS, simulateRun } from '@/adventure/engine/bot';
import { barePlan, investedPlan } from '@/adventure/engine/botBuilds';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { LEVELS } from '@/adventure/data/levels';
import { BASE_RULES, SURGE_RULES } from '@/adventure/data/rules';
import { createNewSave } from '@/adventure/progress';
import { describeLines, entrySummary, entryTitle, loggedCardPoints, setMathRows } from '@/adventure/components/fightReplayText';
import type { FightLogCard, FightLogLine, FightLogSetMath, RunState } from '@/adventure/types';
import { ALL_FEATURES, findSet, miss, playSet, relic, startFight, testLevel, tick, withWeapons } from './testUtils/adventureFight';

const sum = (s: RunState) => s.log.reduce((a, e) => a + e.damage, 0);
const freeSets = (s: RunState) => s.log.flatMap(e => e.lines).filter(l => l.text === 'Free Set').length;

describe('fight log', () => {
  it('opens with the fight start and records each Set with its cards and math', () => {
    let s = startFight();
    expect(s.log).toHaveLength(1);
    expect(s.log[0]).toMatchObject({ kind: 'wave', wave: 0, t: 0 });
    s = tick(s, 2000);
    s = playSet(s);
    const e = s.log[s.log.length - 1];
    expect(e.kind).toBe('set');
    expect(e.t).toBe(2000);
    expect(e.cards).toHaveLength(3);
    expect(e.set?.hit).toBe(e.setDamage);
    expect(e.set?.sinceLastMs).toBe(2000);
    expect(e.damage).toBe(s.totalDamage);
    expect(e.foeHp).toBe(s.foeHp);
    expect(setMathRows(e.set!).at(-1)).toEqual({ label: 'Set hit', value: `${e.set!.hit}`, total: true });
  });

  it('records mistakes with the hearts they cost', () => {
    const s = miss(startFight({ save: { selectedFighter: 'Corgi' } }));
    const e = s.log[s.log.length - 1];
    expect(e.kind).toBe('mistake');
    expect(e.heartsDelta).toBe(-1);
    expect(entrySummary(e)).toBe('lost 1 heart');
  });

  it('folds direct Set-triggered damage into Set math and names the weapon behind chained triggered damage', () => {
    let s = withWeapons(startFight(), relic([{ trigger: { on: 'set' }, effects: [{ do: 'damage', amount: 5 }], callout: 'Zap!' }]));
    s = playSet(s);
    const e = s.log[s.log.length - 1];
    expect(e.damage).toBe(e.setDamage);
    expect(e.set?.flatItems).toContainEqual(
      expect.objectContaining({ label: 'Test Relic', amount: 5, sourceRef: 'weapon:test-relic' })
    );
    expect(describeLines(e.lines, ['test-relic'], { excludeSetMathRules: true }).filter(l => l.label === 'Zap!')).toEqual([]);
    expect(entryTitle(e, 1)).toBe('Set #1');

    // Chained / non-Set triggered damage (e.g. on mistake) still appears as a named triggered line
    let m = withWeapons(startFight(), relic([{ trigger: { on: 'mistake' }, effects: [{ do: 'damage', amount: 5 }], callout: 'Zap!' }]));
    m = miss(m);
    const me = m.log[m.log.length - 1];
    expect(me.damage - me.setDamage).toBe(5);
    const lines = describeLines(me.lines);
    // The callout and its damage fold into one line
    expect(lines.filter(l => l.label === 'Zap!')).toEqual([{ label: 'Zap!', source: 'Test Relic', sourceRef: 'weapon:test-relic', count: 1, damage: 5 }]);
  });

  it('folds the clock into one entry per second, and only when something happened', () => {
    const s = tick(startFight(), 20_000, 100);
    expect(s.log).toHaveLength(1);
  });

  it('accounts for every point of damage in real bot fights', () => {
    for (const id of ['1-4', '2-3', '3-5', '4-2', '5-3']) {
      const level = LEVELS.find(l => l.id === id)!;
      for (const plan of [barePlan(level), investedPlan(level)]) {
        const { state } = simulateRun(level, createNewSave(), BOTS.average, 11, plan);
        expect(sum(state)).toBe(state.totalDamage);
        expect(state.log.filter(e => e.kind === 'set').length + freeSets(state)).toBe(state.matches);
        expect(state.log.filter(e => e.kind === 'mistake').length).toBe(state.mistakes);
        expect(state.log.every((e, i) => i === 0 || e.t >= state.log[i - 1].t)).toBe(true);
        for (const e of state.log) {
          if (e.kind === 'set') expect(e.setDamage).toBeLessThanOrEqual(e.damage);
          // The replay can label every line it records
          for (const l of describeLines(e.lines)) expect(l.label).toBeTruthy();
        }
      }
    }
  });

  it('a hint or a pick is its own entry', () => {
    let s = startFight();
    s = runReducer(s, { type: 'USE_HINT' });
    expect(s.log[s.log.length - 1].kind).toBe('hint');
    expect(findSet(s)).toBeDefined();
  });

  it('tracks Shading Surge (+12 & ×1.8) and Holo (+4 & ×1.2) multipliers in Set math and replay text (zero Power)', () => {
    let surged = startFight({
      save: { selectedFighter: 'Pelican' },
      level: testLevel({ foes: [{ name: 'Dummy', hp: 999 }], rules: { shadingSurge: true, timer: 300, boardSize: 15 } }),
      features: ['hearts'],
    });
    surged = tick(surged, SURGE_RULES.calmMs);
    expect(surged.surge?.active).toBe(true);
    surged = playSet(surged);
    const surgeEntry = surged.log[surged.log.length - 1];
    expect(surgeEntry.set?.surgeMultiplier).toBe(SURGE_RULES.multiplier);
    expect(surgeEntry.set?.hit).toBe(surgeEntry.setDamage);
    expect(surgeEntry.set?.hit).toBe(Math.round((6 + SURGE_RULES.flatBonus) * SURGE_RULES.multiplier));
    const surgeRows = setMathRows(surgeEntry.set!);
    const surgeMultMatches = surgeRows.filter(r => r.label === 'Shading Surge' && r.value.startsWith('×'));
    expect(surgeMultMatches).toHaveLength(1);
    expect(surgeMultMatches[0].value).toBe(`×${SURGE_RULES.multiplier}`);
    expect(entrySummary(surgeEntry)).toContain(`Surge ×${SURGE_RULES.multiplier}`);
    for (const l of describeLines(surgeEntry.lines)) expect(l.label).toBeTruthy();

    // Unified add-first math: flat bonuses (+4 Heavy Hitter + +12 Surge flat) sum with 6 base cards BEFORE ×1.8 Surge!
    let surgedFlat = startFight({
      save: { selectedFighter: 'Pelican', upgrades: { heavy_hitter: 2 } },
      level: testLevel({ foes: [{ name: 'Dummy', hp: 999 }], rules: { shadingSurge: true, timer: 300, boardSize: 15 } }),
      features: ['hearts'],
    });
    surgedFlat = tick(surgedFlat, SURGE_RULES.calmMs);
    surgedFlat = playSet(surgedFlat);
    const flatSurgeEntry = surgedFlat.log[surgedFlat.log.length - 1];
    const flatSurgeRows = setMathRows(flatSurgeEntry.set!);
    const subtotalRow = flatSurgeRows.find(r => r.subtotal);
    const surgeRowIdx = flatSurgeRows.findIndex(r => r.label === 'Shading Surge' && r.value.startsWith('×'));
    const subtotalIdx = flatSurgeRows.findIndex(r => r.subtotal);
    expect(subtotalRow?.value).toBe(String(6 + 4 + SURGE_RULES.flatBonus)); // 6 base + 4 Heavy Hitter + 12 Surge = 22
    expect(surgeRowIdx).toBeGreaterThan(subtotalIdx);
    expect(flatSurgeEntry.set?.hit).toBe(Math.round(22 * SURGE_RULES.multiplier)); // 22 × 1.8 = 39.6 → 40

    // Holo card adds +4 base & ×1.2 multiplier (and zero global Power scaling)
    let holoRun = startFight({ save: { selectedFighter: 'Pelican' }, features: ALL_FEATURES });
    const set = findSet(holoRun)!;
    holoRun = {
      ...holoRun,
      board: holoRun.board.map(c => (c.id === set[0].id ? { ...c, holo: true } : c)),
    };
    const matchCards = holoRun.board.filter(c => set.some(t => t.id === c.id));
    holoRun = runReducer(holoRun, { type: 'MATCH', cards: matchCards, rewards: matchCards.map(baseCardReward) });
    const holoEntry = holoRun.log[holoRun.log.length - 1];
    expect(holoEntry.set?.holoMultiplier).toBe(1 + BASE_RULES.holoCardMult);
    expect(entrySummary(holoEntry)).toContain('Holo ×1.2');
    expect(holoEntry.set?.hit).toBe(Math.round((6 + BASE_RULES.holoCardBonus) * 1.2));
  });

  it('splits 3 matched cards from card bonuses and itemizes Greedy Chest, Magnet & Workshop bonuses', () => {
    const chest = getArmoryWeapon('greedy-chest')!;
    const magnet = getArmoryWeapon('magnet')!;
    let s = startFight({
      save: { selectedFighter: 'Pelican', upgrades: { heavy_hitter: 2 } },
      features: ALL_FEATURES,
    });
    s = withWeapons(s, chest, magnet);
    const triple = findSet(s)!;
    const boostedIds = new Set([triple[0].id, triple[1].id]);
    const magnetizedId = triple[2].id;
    s = {
      ...s,
      board: s.board.map(c =>
        boostedIds.has(c.id)
          ? { ...c, bonusPoints: 2 }
          : c.id === magnetizedId
            ? { ...c, magnet: true }
            : c
      ),
    };
    const matchCards = s.board.filter(c => triple.some(t => t.id === c.id));
    s = runReducer(s, { type: 'MATCH', cards: matchCards, rewards: matchCards.map(baseCardReward) });
    const entry = s.log[s.log.length - 1];

    expect(entry.kind).toBe('set');
    expect(entry.cards?.map(loggedCardPoints)).toEqual([4, 4, 2]);
    expect(entry.cards?.[0].tags).toContain('Power +2');
    expect(entry.cards?.[2].tags).toContain('Magnet');
    expect(entry.set?.cardCount).toBe(3);
    expect(entry.set?.baseCards).toBe(6);
    expect(entry.set?.cardBonus).toBe(4);
    expect(entry.set?.cardBonusNote).toContain('2 Power cards (+4)');

    const rows = setMathRows(entry.set!, { lines: entry.lines, cards: entry.cards, held: ['greedy-chest', 'magnet'] });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '3 matched cards (2 dmg each)', value: '6' }),
        expect.objectContaining({ label: 'Bonus on those cards', value: '+4' }),
        expect.objectContaining({ label: 'Heavy Hitter', value: '+4' }),
        expect.objectContaining({ label: 'Magnet', sourceRef: 'weapon:magnet' }),
      ])
    );
    // Magnet was itemized in Set math, so it should not echo numberless under OTHER EFFECTS ON THIS MOVE
    const postLines = describeLines(entry.lines, ['greedy-chest', 'magnet'], { excludeSetMathRules: true });
    expect(postLines.some(l => l.label === 'Magnet!')).toBe(false);
  });

  it('reconstructs itemized card bonus, Greedy Chest, and Magnet for compact saved logs', () => {
    const legacyCards: FightLogCard[] = [
      { shape: 'oval', color: 'red', number: 1, shading: 'solid', tags: ['+2 dmg'] },
      { shape: 'oval', color: 'green', number: 2, shading: 'solid', tags: ['+2 dmg'] },
      { shape: 'oval', color: 'purple', number: 3, shading: 'solid', tags: [] },
    ];
    const legacyMath: FightLogSetMath = {
      cards: 10,
      collateral: {},
      flatBonus: 16,
      multiplier: 1.5,
      rainbow: false,
      extra: 0,
      hit: 39,
      diffTraits: 2,
      graceUsed: false,
      sinceLastMs: 5800,
      combo: 2,
    };
    const legacyLines: FightLogLine[] = [
      { type: 'rule', amount: 10, text: 'Greedy Chest!', source: 'Greedy Chest', sourceRef: 'weapon:greedy-chest' },
      { type: 'rule', amount: 6, text: 'Magnet!', source: 'Magnet', sourceRef: 'weapon:magnet' },
      { type: 'power_up', text: 'its floor rises by 2', source: 'Greedy Chest', sourceRef: 'weapon:greedy-chest' },
    ];

    const rows = setMathRows(legacyMath, { lines: legacyLines, cards: legacyCards, held: ['greedy-chest', 'magnet'] });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '3 matched cards (2 dmg each)', value: '6' }),
        expect.objectContaining({ label: 'Bonus on those cards', value: '+4' }),
        expect.objectContaining({ label: 'Greedy Chest', value: '+10', sourceRef: 'weapon:greedy-chest' }),
        expect.objectContaining({ label: 'Magnet', value: '+6', sourceRef: 'weapon:magnet' }),
        expect.objectContaining({ label: 'Base damage subtotal', value: '26', subtotal: true }),
        expect.objectContaining({ label: 'Multiplier', value: '×1.5' }),
        { label: 'Set hit', value: '39', total: true },
      ])
    );

    const postLines = describeLines(legacyLines, ['greedy-chest', 'magnet'], { excludeSetMathRules: true });
    expect(postLines.map(l => l.label)).toEqual([
      'Weapon scaled up: its floor rises by 2',
    ]);
  });
});
