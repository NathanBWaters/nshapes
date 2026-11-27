/**
 * Unit & stress tests for Wave 1 Lane C (`[TP-15]`, `[TP-16]`, `[TP-18]`, `[TP-03]`):
 *  - Deterministic RNG injection across enemies, weapons, matchResolution, runReducer & bot (zero Math.random leaks)
 *  - Unbiased Fisher-Yates shuffle
 *  - Zero-Set board refill deadlock prevention across 10,000 refills (3T/4T/5T + dud-heavy foes)
 *  - Guaranteed Counter-Parry card construction & unlimited genuine-unsolvable fairness stalls
 *  - Checksummed Save Backup Codes (`NSHAPES1:...`) for Adventure & Starfall Summit
 *  - Graceful `version > 1` backup-preserving hydration in `adventure/save.ts`
 *  - Transactional `mergeDiscoveredEvolutions` / `syncSpireDiscoveriesToAdventure`
 *  - `/dev/summit` & `/dev/spire` alias parity
 */
import * as fs from 'fs';
import * as path from 'path';
import type { AttributeName, Card } from '@/types';
import { WEAPON_EVOLUTIONS } from '@/adventure/data/evolutions';
import { getWeaponBounties } from '@/adventure/data/bounties';
import { getLevel } from '@/adventure/data/levels';
import { PARRY_RULES } from '@/adventure/data/parry';
import { BOTS, simulateRun } from '@/adventure/engine/bot';
import { begin, ensureBoardHasSet, finish, refill, type FightHooks } from '@/adventure/engine/fight';
import { boardHasCounterSet } from '@/adventure/engine/parry';
import { createRng } from '@/adventure/engine/rng';
import { createRun, runReducer } from '@/adventure/engine/run';
import { allSets, hasAnySet } from '@/adventure/engine/sets';
import {
  BOUNTY_EXCLUSIVE_CAPSTONE_LEVEL,
  weaponLevel,
} from '@/adventure/weaponLevels';
import {
  applyLoadoutPreset,
  loadLoadoutPresets,
  saveLoadoutPreset,
} from '@/adventure/loadoutPresets';
import {
  LEGACY_CHARM_BELT_EXTRA_COSTS,
  SLOT_4_UNLOCK_LEVEL,
  SLOT_5_UNLOCK_LEVEL,
  STARTER_EVOLUTION_ID,
  charmSlots,
  createMaxedSave,
  createNewSave,
  legacyCharmBeltRefund,
  migrateSave,
  reconcileUnlocks,
} from '@/adventure/progress';
import {
  ADVENTURE_BACKUP_KEY,
  ADVENTURE_IMPORT_BACKUP_KEY,
  ADVENTURE_SAVE_KEY,
  loadAdventureSave,
  mergeDiscoveredEvolutions,
  writeAdventureSave,
} from '@/adventure/save';
import {
  decodeBase64Url,
  decodeFullSaveBackup,
  encodeBase64Url,
  encodeFullSaveBackup,
  exportFullSaveBackup,
  importFullSaveBackup,
  SAVE_BACKUP_PREFIX,
} from '@/adventure/saveShare';
import type { LevelDef, ParryRequirement, ParrySpec } from '@/adventure/types';
import { createSpireRun } from '@/spire/engine/runState';
import {
  createInitialSpireMeta,
  loadSpireMeta,
  loadSpireRun,
  resetSpireStorage,
  syncSpireDiscoveriesToAdventure,
  writeSpireMeta,
  writeSpireRun,
} from '@/spire/save';
import { createEnemy } from '@/utils/enemyFactory';
import { shuffleWithRng } from '@/utils/enemyEffects';
import { DEFAULT_PLAYER_STATS, WEAPONS, rollBridgeEffects } from '@/utils/gameDefinitions';
import { resolveMatch } from '@/utils/matchResolution';
import { storage } from '@/utils/storage';
import { processWeaponEffects } from '@/utils/weaponEffects';
import { findSet, plainRewards, tick } from './testUtils/adventureFight';

const REPO_ROOT = path.resolve(__dirname, '..');

const mkCard = (
  id: string,
  shape: Card['shape'],
  color: Card['color'],
  number: Card['number'],
  shading: Card['shading'] = 'solid',
  background: Card['background'] = 'white',
  extra: Partial<Card> = {}
): Card => ({
  id,
  shape,
  color,
  number,
  shading,
  background,
  selected: false,
  ...extra,
});

const NOOP_HOOKS: FightHooks = { autoSet: () => undefined };

// =============================================================================
// [TP-15] Deterministic RNG Injection & Elimination of Math.random Monkey-Patches
// =============================================================================

describe('[TP-15] deterministic RNG injection & source guardrails', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('removes global Math.random monkey-patching and biased shuffles from owned files', () => {
    const runSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/adventure/engine/run.ts'), 'utf8');
    const botSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/adventure/engine/bot.ts'), 'utf8');
    const enemyFxSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/utils/enemyEffects.ts'), 'utf8');
    const goblinSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/utils/enemies/tier2/goblinSaboteur.ts'), 'utf8');
    const boardSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/components/GameBoard.tsx'), 'utf8');
    const captureSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts/motion/capture.mjs'), 'utf8');

    expect(runSrc).not.toMatch(/withFoeDice/);
    expect(runSrc).not.toMatch(/Math\.random\s*=/);
    expect(botSrc).not.toMatch(/Math\.random\s*=/);
    expect(enemyFxSrc).not.toMatch(/\.sort\(\(\)\s*=>\s*Math\.random\(\)\s*-\s*0\.5\)/);
    expect(goblinSrc).not.toMatch(/\.sort\(\(\)\s*=>\s*Math\.random\(\)\s*-\s*0\.5\)/);
    expect(boardSrc).not.toMatch(/\.sort\(\(\)\s*=>\s*Math\.random\(\)\s*-\s*0\.5\)/);
    expect(captureSrc).not.toMatch(/new Error\(\)\.stack/);
  });

  it('runs createRun, runReducer (with resolveWeapons), foes, and simulateRun with ZERO Math.random calls', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Unexpected Math.random() leak during seeded simulation!');
    });

    const save = createMaxedSave();
    // Covers Goblin Saboteur, Trap Weaver, Junk Rat, Foggy Frog, Shifting Chameleon, Dragon
    for (const levelId of ['1-1', '2-6', '3-2', '3-8', '4-11']) {
      const level = getLevel(levelId);
      const r1 = simulateRun(level, save, BOTS.average, 2026);
      const r2 = simulateRun(level, save, BOTS.average, 2026);
      expect(r1.state.totalDamage).toBe(r2.state.totalDamage);
      expect(r1.state.matches).toBe(r2.state.matches);
      expect(r1.state.rng).toBe(r2.state.rng);
      expect(r1.state.foeRng).toBe(r2.state.foeRng);
      expect(r1.stars).toBe(r2.stars);
    }

    // Direct enemy + weapon + matchResolution calls with injected RNG
    const rngA = createRng(999);
    const rngB = createRng(999);
    const goblinA = createEnemy('Goblin Saboteur', rngA.next);
    const goblinB = createEnemy('Goblin Saboteur', rngB.next);
    expect(goblinA.getStatModifiers()).toEqual(goblinB.getStatModifiers());

    const run = createRun(getLevel('3-2'), save, { seed: 321 });
    const set = findSet(run)!;
    expect(set).toBeTruthy();
    const res1 = resolveMatch({
      board: run.board,
      selected: set,
      playerStats: { ...DEFAULT_PLAYER_STATS, explosionChance: 50, laserChance: 45, ricochetChance: 40, fireSpreadChance: 40 },
      weapons: WEAPONS.slice(0, 12),
      activeAttributes: run.attributes,
      connections: [],
      graceUsed: false,
      rng: createRng(77).next,
    });
    const res2 = resolveMatch({
      board: run.board,
      selected: set,
      playerStats: { ...DEFAULT_PLAYER_STATS, explosionChance: 50, laserChance: 45, ricochetChance: 40, fireSpreadChance: 40 },
      weapons: WEAPONS.slice(0, 12),
      activeAttributes: run.attributes,
      connections: [],
      graceUsed: false,
      rng: createRng(77).next,
    });
    expect(res1.cards.map(c => c.id)).toEqual(res2.cards.map(c => c.id));
    expect(res1.weaponEffects.notifications).toEqual(res2.weaponEffects.notifications);

    // Direct processWeaponEffects & rollBridgeEffects with injected RNG
    processWeaponEffects(run.board, set, { ...DEFAULT_PLAYER_STATS, healingChance: 50, coinGainChance: 150 }, WEAPONS, run.attributes, false, undefined, false, createRng(55).next);
    rollBridgeEffects('onDestruction', WEAPONS, createRng(55).next);

    expect(randomSpy).not.toHaveBeenCalled();
  });

  it('shuffleWithRng uses unbiased Fisher-Yates without mutating input', () => {
    const input = [0, 1, 2, 3] as const;
    const rng = createRng(1337);
    const counts = new Map<string, number>();
    const trials = 4800;
    for (let i = 0; i < trials; i++) {
      const out = shuffleWithRng(input, rng.next);
      expect(input).toEqual([0, 1, 2, 3]);
      const key = out.join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // 4! = 24 permutations; expected ~200 each
    expect(counts.size).toBe(24);
    for (const c of counts.values()) {
      expect(c).toBeGreaterThan(120);
      expect(c).toBeLessThan(290);
    }
  });
});

// =============================================================================
// [TP-16] Zero-Set Refill Deadlock Fix & Counter-Parry Card Guarantee
// =============================================================================

describe('[TP-16] zero-Set refill deadlock fix & Counter-Parry fairness', () => {
  const makeCustomLevel = (
    attrs: AttributeName[],
    opts: { boardSize?: number; foeEnemy?: string; parry?: ParrySpec | null } = {}
  ): LevelDef => ({
    id: 'tp16-test',
    biome: 'peaks',
    name: 'Fairness Forge',
    introduces: 'timer',
    rules: { attributes: attrs, boardSize: opts.boardSize ?? 12, timer: 120, hearts: 5 },
    foes: [
      {
        enemy: opts.foeEnemy,
        name: opts.foeEnemy ?? 'Test Golem',
        icon: 'lorc/sword-clash',
        hp: 500,
        parry: opts.parry ?? null,
      },
    ],
    challenge: { kind: 'noMistakes' },
    coinMultiplier: 1,
    difficulty: 3,
    rewards: { star1: { coins: 10 }, star2: { coins: 20 }, star3: { coins: 30 } },
  });

  it('never commits a deadlocked zero-Set board across 10,000 refills (3T, 4T, 5T, and dud-heavy foes)', () => {
    const save = { ...createNewSave(), charms: [], equippedArcana: [] };
    const configs: { attrs: AttributeName[]; boardSize: number; foe?: string; refills: number }[] = [
      { attrs: ['shape', 'color', 'number'], boardSize: 9, refills: 2500 },
      { attrs: ['shape', 'color', 'number', 'shading'], boardSize: 12, foe: 'Junk Rat', refills: 3000 },
      { attrs: ['shape', 'color', 'number', 'shading'], boardSize: 12, foe: 'Lurking Shark', refills: 2000 },
      { attrs: ['shape', 'color', 'number', 'shading', 'background'], boardSize: 15, foe: 'Ancient Dragon', refills: 2500 },
    ];

    let totalRefills = 0;
    let deadlocks = 0;

    for (const cfg of configs) {
      const level = makeCustomLevel(cfg.attrs, { boardSize: cfg.boardSize, foeEnemy: cfg.foe });
      let s = createRun(level, save, { seed: 404 + cfg.boardSize });
      expect(hasAnySet(s.board, s.attributes)).toBe(true);

      const d = begin(s, NOOP_HOOKS);
      for (let i = 0; i < cfg.refills; i++) {
        // Pick 3 slots (or a valid Set's slots) to recycle & refill
        const sets = allSets(d.board, d.attributes);
        const picked = sets.length > 0 ? sets[0] : d.board.slice(0, 3);
        const indices = picked
          .map(c => d.board.findIndex(b => b.id === c.id))
          .filter(idx => idx >= 0)
          .slice(0, 3);
        if (indices.length > 0) {
          refill(d, indices, { quiet: true });
          totalRefills += 1;
          if (!hasAnySet(d.board, d.attributes)) deadlocks += 1;
        }
      }
      s = finish(d, s);
    }

    expect(totalRefills).toBe(10_000);
    expect(deadlocks).toBe(0);
  });

  it('deterministically constructs a valid Set when a board is forced into zero-Set state', () => {
    const attrs: AttributeName[] = ['shape', 'color', 'number', 'shading'];
    const level = makeCustomLevel(attrs, { boardSize: 6 });
    const s = createRun(level, createNewSave(), { seed: 7 });
    // Construct 6 cards containing ZERO valid Sets (every card has number 1 or 2; no 3 same-number valid triples)
    const capBoard: Card[] = [
      mkCard('c0', 'oval', 'red', 1, 'solid'),
      mkCard('c1', 'oval', 'red', 2, 'solid'),
      mkCard('c2', 'oval', 'green', 1, 'striped'),
      mkCard('c3', 'diamond', 'green', 2, 'striped'),
      mkCard('c4', 'diamond', 'purple', 1, 'open'),
      mkCard('c5', 'squiggle', 'red', 1, 'striped'),
    ];
    expect(hasAnySet(capBoard, attrs)).toBe(false);

    const d = begin({ ...s, board: capBoard }, NOOP_HOOKS);
    const fixed = [...d.board];
    const ok = ensureBoardHasSet(d, fixed, [0]);
    expect(ok).toBe(true);
    expect(hasAnySet(fixed, attrs)).toBe(true);
  });

  const counterCases: [string, AttributeName[], ParryRequirement][] = [
    ['ALL RED (3T)', ['shape', 'color', 'number'], { kind: 'color', color: 'red' }],
    ['ALL GREEN (4T)', ['shape', 'color', 'number', 'shading'], { kind: 'color', color: 'green' }],
    ['ALL PURPLE (5T)', ['shape', 'color', 'number', 'shading', 'background'], { kind: 'color', color: 'purple' }],
    ['ALL OVALS (3T)', ['shape', 'color', 'number'], { kind: 'shape', shape: 'oval' }],
    ['ALL SQUIGGLES (4T)', ['shape', 'color', 'number', 'shading'], { kind: 'shape', shape: 'squiggle' }],
    ['ALL DIFFERENT (3T)', ['shape', 'color', 'number'], { kind: 'all_different' }],
    ['ALL DIFFERENT (4T)', ['shape', 'color', 'number', 'shading'], { kind: 'all_different' }],
    ['ALL DIFFERENT (5T)', ['shape', 'color', 'number', 'shading', 'background'], { kind: 'all_different' }],
    ['EXACT 2 SAME (3T)', ['shape', 'color', 'number'], { kind: 'exact_same', count: 2 }],
    ['EXACT 2 SAME (4T)', ['shape', 'color', 'number', 'shading'], { kind: 'exact_same', count: 2 }],
    ['EXACT 2 DIFF (3T)', ['shape', 'color', 'number'], { kind: 'exact_diff', count: 2 }],
    ['EXACT 2 DIFF (4T)', ['shape', 'color', 'number', 'shading'], { kind: 'exact_diff', count: 2 }],
    ['SAME NUMBER (3T)', ['shape', 'color', 'number'], { kind: 'same_number' }],
    ['DIFF NUMBER (4T)', ['shape', 'color', 'number', 'shading'], { kind: 'diff_number' }],
  ];

  it.each(counterCases)(
    'guarantees a solvable Counter-Parry board after a single non-counter clear: %s',
    (_label, attrs, counter) => {
      const level = makeCustomLevel(attrs, {
        boardSize: 12,
        parry: {
          attackName: 'Test Strike',
          icon: 'lorc/sword-clash',
          counter,
          cooldownMs: 8000,
          windupMs: 14000,
          perfectWindowMs: 3500,
          penalty: 'heart',
        },
      });
      const save = { ...createNewSave(), charms: [], equippedArcana: [] };
      let s = createRun(level, save, { seed: 4242 });
      // Advance into windup
      s = tick(s, 7000, 500);
      expect(s.parry?.phase).toBe('windup');

      // Force a board that has a valid Set in slots 0..2 but ZERO matching Counter-Sets
      let strippedBoard: Card[];
      if (counter.kind === 'color') {
        const other = counter.color === 'red' ? 'green' : 'red';
        strippedBoard = s.board.map((c, i) =>
          i < 3
            ? mkCard(c.id, (['oval', 'diamond', 'squiggle'] as const)[i], other, 1, 'solid', 'white')
            : { ...c, color: other, isWild: false }
        );
      } else if (counter.kind === 'shape') {
        const other = counter.shape === 'oval' ? 'diamond' : 'oval';
        strippedBoard = s.board.map((c, i) =>
          i < 3
            ? mkCard(c.id, other, (['red', 'green', 'purple'] as const)[i], 1, 'solid', 'white')
            : { ...c, shape: other, isWild: false }
        );
      } else if (counter.kind === 'same_number') {
        // Put numbers [1,2,3] on slots 0..2 and make rest duds so no same-number Set exists
        strippedBoard = s.board.map((c, i) =>
          i < 3
            ? mkCard(c.id, 'oval', 'red', (i + 1) as 1 | 2 | 3, 'solid', 'white')
            : { ...c, isDud: true, isWild: false }
        );
      } else if (counter.kind === 'diff_number') {
        // All cards have number 1 so no 1-2-3 Set exists
        strippedBoard = s.board.map((c, i) =>
          i < 3
            ? mkCard(c.id, (['oval', 'diamond', 'squiggle'] as const)[i], 'red', 1, 'solid', 'white')
            : { ...c, number: 1 as const, isWild: false }
        );
      } else {
        // For all_different, exact_same(2), exact_diff(2):
        // Slots 0..2 differ ONLY in shape (diff=1) or all identical (diff=0), rest duds so zero matching Counter-Sets exist
        const diffForSlots = counter.kind === 'exact_same' && attrs.length === 3 ? 0 : 1;
        strippedBoard = s.board.map((c, i) =>
          i < 3
            ? mkCard(
                c.id,
                diffForSlots === 0 ? 'oval' : (['oval', 'diamond', 'squiggle'] as const)[i],
                'red',
                1,
                'solid',
                'white'
              )
            : { ...c, isDud: true, isWild: false }
        );
      }

      s = { ...s, board: strippedBoard };
      expect(boardHasCounterSet(s.board, s.attributes, counter)).toBe(false);

      const nonCounterSet = s.board.slice(0, 3);
      const msBefore = s.parry!.msLeft;
      s = runReducer(s, { type: 'MATCH', cards: nonCounterSet, rewards: plainRewards(nonCounterSet) });
      // Fairness stall triggered!
      expect(s.parry!.stallsUsed).toBe(1);
      expect(s.parry!.msLeft).toBeGreaterThanOrEqual(msBefore);

      // Single REPLACE refill must now guarantee a valid Counter-Set on the board!
      s = runReducer(s, { type: 'REPLACE', ids: nonCounterSet.map(c => c.id) });
      expect(hasAnySet(s.board, s.attributes)).toBe(true);
      expect(boardHasCounterSet(s.board, s.attributes, counter)).toBe(true);
    }
  );

  it('continues granting fairness stalls past maxFairnessStalls when hazards physically prevent any Counter-Set', () => {
    const attrs: AttributeName[] = ['shape', 'color', 'number'];
    const level = makeCustomLevel(attrs, {
      boardSize: 12,
      parry: {
        attackName: 'Crimson Cleave',
        icon: 'lorc/sword-clash',
        counter: { kind: 'color', color: 'red' },
        cooldownMs: 8000,
        windupMs: 12000,
        perfectWindowMs: 3500,
        penalty: 'heart',
      },
    });
    let s = createRun(level, createNewSave(), { seed: 77 });
    s = tick(s, 7500, 500);
    expect(s.parry?.phase).toBe('windup');

    // Simulate already having used maxFairnessStalls (2), still on a board with 0 red cards
    const greenBoard = s.board.map((c, i) =>
      i < 3
        ? mkCard(c.id, (['oval', 'diamond', 'squiggle'] as const)[i], 'green', 1)
        : { ...c, color: 'green' as const }
    );
    s = {
      ...s,
      board: greenBoard,
      parry: { ...s.parry!, msLeft: 4000, stallsUsed: PARRY_RULES.maxFairnessStalls },
    };

    const nonCounter = s.board.slice(0, 3);
    const next = runReducer(s, { type: 'MATCH', cards: nonCounter, rewards: plainRewards(nonCounter) });
    expect(next.parry!.stallsUsed).toBe(PARRY_RULES.maxFairnessStalls + 1);
    expect(next.parry!.msLeft).toBe(4000 + PARRY_RULES.fairnessStallMs);
  });
});

// =============================================================================
// [TP-18] Checksummed Save Backup Codes, version > 1 Hydration & Transactional Sync
// =============================================================================

describe('[TP-18] save backup codes, version > 1 fallback & transactional evolution sync', () => {
  const mem = new Map<string, string>();
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mem.clear();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(storage, 'getString').mockImplementation((k: string) => mem.get(k));
    jest.spyOn(storage, 'set').mockImplementation((k: string, v: string | number | boolean | ArrayBuffer) => {
      mem.set(k, String(v));
    });
    jest.spyOn(storage, 'remove').mockImplementation((k: string) => {
      return mem.delete(k);
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('base64url codec handles ASCII and multi-byte UTF-8 (emoji & accents) cleanly', () => {
    const sample = 'Piñata 🔥 Orange Tabby ★ 1-10 — Starfall Summit ✦';
    const encoded = encodeBase64Url(sample);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBase64Url(encoded)).toBe(sample);
  });

  it('encodes, validates, exports, and restores full Adventure + Starfall Summit saves', () => {
    const adv = {
      ...createMaxedSave(),
      coins: 1234,
      stars: { '1-1': 3, '1-2': 3, '2-4': 2 },
      discoveredEvolutions: ['phoenix-pyre', 'sunbeam-burst'],
      selectedFighter: 'Sly Fox' as const,
    };
    const meta = {
      ...createInitialSpireMeta(),
      totalRuns: 9,
      victories: 4,
      highestAscensionUnlocked: 5,
      highestAscensionCleared: 4,
      bestFloor: 21,
      bestBiggestHit: 4820,
      fighterWins: { 'Sly Fox': 3, Corgi: 1 },
    };
    const run = createSpireRun('Sly Fox', 3, 9876);

    writeAdventureSave(adv);
    writeSpireMeta(meta);
    writeSpireRun(run);

    const code = exportFullSaveBackup();
    expect(code.startsWith(`${SAVE_BACKUP_PREFIX}:`)).toBe(true);

    // Tampered code must fail checksum and NEVER overwrite storage
    const tampered = `${code.slice(0, -1)}${code.endsWith('A') ? 'B' : 'A'}`;
    const badRes = importFullSaveBackup(tampered);
    expect(badRes.ok).toBe(false);
    if (!badRes.ok) expect(badRes.error).toMatch(/checksum/i);

    // Wrong prefix / empty / truncated
    expect(decodeFullSaveBackup('').ok).toBe(false);
    expect(decodeFullSaveBackup('PRISM1:000000:abc').ok).toBe(false);
    expect(decodeFullSaveBackup(`${SAVE_BACKUP_PREFIX}:BADCHK:`).ok).toBe(false);

    // Wipe storage, then import backup code (even with whitespace/newlines wrapped in!)
    mem.clear();
    resetSpireStorage();
    expect(loadAdventureSave().coins).toBe(0);
    expect(loadSpireMeta().totalRuns).toBe(0);
    expect(loadSpireRun()).toBeNull();

    // Seed a decoy save before import so we verify pre-import backup snapshot is preserved
    writeAdventureSave({ ...createNewSave(), coins: 77 });
    const wrappedCode = `${code.slice(0, 24)}\n  ${code.slice(24)}  `;
    const imported = importFullSaveBackup(wrappedCode);
    expect(imported.ok).toBe(true);

    expect(loadAdventureSave().coins).toBe(1234);
    expect(loadAdventureSave().selectedFighter).toBe('Sly Fox');
    expect(loadAdventureSave().stars['2-4']).toBe(2);
    expect(loadSpireMeta().highestAscensionCleared).toBe(4);
    expect(loadSpireMeta().fighterWins['Sly Fox']).toBe(3);
    expect(loadSpireRun()?.seed).toBe(9876);
    expect(loadSpireRun()?.ascension).toBe(3);

    // Verify pre-import snapshot was backed up before overwrite
    expect(mem.get(ADVENTURE_IMPORT_BACKUP_KEY)).toBeDefined();
    expect(JSON.parse(mem.get(ADVENTURE_IMPORT_BACKUP_KEY)!).coins).toBe(77);

    // Also verify null spireRun encodes & restores cleanly
    const noRunCode = encodeFullSaveBackup(adv, meta, null);
    const decodedNoRun = decodeFullSaveBackup(noRunCode);
    expect(decodedNoRun.ok).toBe(true);
    if (decodedNoRun.ok) expect(decodedNoRun.spireRun).toBeNull();
  });

  it('gracefully hydrates future version > 1 Adventure saves while preserving raw backup untouched', () => {
    const futurePayload = {
      ...createNewSave(),
      version: 2,
      coins: 888,
      stars: { '1-1': 3, '1-2': 2 },
      selectedFighter: 'Badger',
      futureModeUnlock: true,
    };
    const rawFuture = JSON.stringify(futurePayload);
    mem.set(ADVENTURE_SAVE_KEY, rawFuture);

    const loaded = loadAdventureSave();
    // Best-effort hydration keeps all known progress!
    expect(loaded.version).toBe(1);
    expect(loaded.coins).toBe(888);
    expect(loaded.stars['1-1']).toBe(3);
    expect(loaded.stars['1-2']).toBe(2);
    expect(loaded.selectedFighter).toBe('Badger');
    // Untouched raw backup saved in BACKUP_KEY
    expect(mem.get(ADVENTURE_BACKUP_KEY)).toBe(rawFuture);
    // Primary KEY was NEVER overwritten or downgraded!
    expect(mem.get(ADVENTURE_SAVE_KEY)).toBe(rawFuture);
  });

  it('backs up and resets truly corrupt or version < 1 saves', () => {
    const badRaw = '{"version":0,"coins":99}';
    mem.set(ADVENTURE_SAVE_KEY, badRaw);
    const loaded = loadAdventureSave();
    expect(loaded.coins).toBe(0);
    expect(mem.get(ADVENTURE_BACKUP_KEY)).toBe(badRaw);
  });

  it('syncs Starfall Summit evolution discoveries transactionally via mergeDiscoveredEvolutions', () => {
    const [evoA, evoB, evoC] = WEAPON_EVOLUTIONS.map(r => r.id);
    const base = {
      ...createNewSave(),
      coins: 555,
      stars: { '1-1': 3 },
      discoveredEvolutions: [evoA],
    };
    writeAdventureSave(base);

    syncSpireDiscoveriesToAdventure([evoA, evoB, evoB]);
    const after = loadAdventureSave();
    expect(after.coins).toBe(555);
    expect(after.stars['1-1']).toBe(3);
    expect(after.discoveredEvolutions).toEqual([evoA, evoB]);

    // Re-syncing already-known IDs is a no-op (does not rewrite storage)
    const setCallsBefore = (storage.set as jest.Mock).mock.calls.length;
    mergeDiscoveredEvolutions([evoA, evoB]);
    expect((storage.set as jest.Mock).mock.calls.length).toBe(setCallsBefore);

    // Syncing against a future version > 1 save preserves version and unknown fields without downgrading!
    const futureRaw = JSON.stringify({
      ...base,
      version: 2,
      futureBadge: 'starfall-hero',
      discoveredEvolutions: [evoA],
    });
    mem.set(ADVENTURE_SAVE_KEY, futureRaw);
    syncSpireDiscoveriesToAdventure([evoC]);
    const storedAfterFutureSync = JSON.parse(mem.get(ADVENTURE_SAVE_KEY)!);
    expect(storedAfterFutureSync.version).toBe(2);
    expect(storedAfterFutureSync.futureBadge).toBe('starfall-hero');
    expect(storedAfterFutureSync.discoveredEvolutions).toEqual([evoA, evoC]);

    // Syncing against unparseable corrupt JSON never clobbers KEY
    mem.clear();
    mem.set(ADVENTURE_SAVE_KEY, '{corrupt json');
    const res = mergeDiscoveredEvolutions([evoC]);
    expect(res).toBeNull();
    expect(mem.get(ADVENTURE_SAVE_KEY)).toBe('{corrupt json');
    expect(mem.get(ADVENTURE_BACKUP_KEY)).toBe('{corrupt json');
  });

  it('idempotently migrates v1 saves: charm_belt tier 2-3 refund, veteran evo goodwill credit, W1/W2 slots, Bounty-Exclusive Lv 1-5 & LoadoutPreset evos', () => {
    // 1. Legacy charm_belt tier 3 refunds 900 + 2000 = 2900 coins ONCE and clamps to tier 1
    expect(LEGACY_CHARM_BELT_EXTRA_COSTS).toEqual([900, 2000]);
    expect(legacyCharmBeltRefund(1)).toBe(0);
    expect(legacyCharmBeltRefund(2)).toBe(900);
    expect(legacyCharmBeltRefund(3)).toBe(2900);

    const legacyBelt = { ...createNewSave(), coins: 100, upgrades: { charm_belt: 3 } };
    const mBelt = migrateSave(legacyBelt);
    expect(mBelt.coins).toBe(100 + 2900);
    expect(mBelt.upgrades.charm_belt).toBe(1);
    // Idempotent: second migration pays 0
    expect(migrateSave(mBelt).coins).toBe(mBelt.coins);

    // 2. Veteran goodwill credit: legacy pair evolutions grant Evo A for equipped/highest-level Armory weapons ONCE
    const veteran = {
      ...createNewSave(),
      armory: ['blast-powder', 'flint-spark', 'war-drum'],
      charms: ['flint-spark', 'war-drum'],
      stars: { [SLOT_4_UNLOCK_LEVEL]: 3, [SLOT_5_UNLOCK_LEVEL]: 3 },
      unlockedEvolutions: ['phoenix-pyre', 'sunbeam-burst'],
      discoveredEvolutions: ['phoenix-pyre', 'sunbeam-burst', 'inferno', 'aftershock'],
    };
    const rec = reconcileUnlocks(veteran);
    expect(rec.legacyEvoMigrated).toBe(true);
    expect(rec.unlockedWeaponEvolutions).toContain(STARTER_EVOLUTION_ID);
    expect(rec.unlockedWeaponEvolutions).toContain('flint-spark:cinder-trail');
    expect(rec.unlockedWeaponEvolutions).toContain('war-drum:battle-cadence');
    // Equipped weapons auto-get their unlocked evolutions equipped
    expect(rec.equippedEvolutions['flint-spark']).toBe('flint-spark:cinder-trail');
    // Idempotent: re-reconciling grants no extra evolutions
    const rec2 = reconcileUnlocks(rec);
    expect(rec2.unlockedWeaponEvolutions).toEqual(rec.unlockedWeaponEvolutions);

    // 3. W1 (1-10) grants 4th slot, W2 (2-10) grants 5th slot, optional charm_belt grants 6th
    const s0 = createNewSave();
    expect(charmSlots(s0)).toBe(3);
    expect(charmSlots({ ...s0, stars: { [SLOT_4_UNLOCK_LEVEL]: 1 } })).toBe(4);
    expect(charmSlots({ ...s0, stars: { [SLOT_4_UNLOCK_LEVEL]: 1, [SLOT_5_UNLOCK_LEVEL]: 1 } })).toBe(5);
    expect(charmSlots({ ...s0, stars: { [SLOT_4_UNLOCK_LEVEL]: 1, [SLOT_5_UNLOCK_LEVEL]: 1 }, upgrades: { charm_belt: 1 } })).toBe(6);

    // 4. Bounty-Exclusive Lv 1 -> 5 progression (own 3 bounties + 5-5 clear)
    const exId = 'chaos-conduit';
    const exBounties = getWeaponBounties(exId).map(b => b.id);
    expect(exBounties).toHaveLength(3);
    let exSave = { ...createNewSave(), armory: [exId], completedBounties: ['bounty_blast_powder_1'] };
    expect(weaponLevel(exSave, exId)).toBe(1);
    exSave = { ...exSave, completedBounties: [...exSave.completedBounties, exBounties[0]] };
    expect(weaponLevel(exSave, exId)).toBe(2);
    exSave = { ...exSave, completedBounties: [...exSave.completedBounties, exBounties[1]] };
    expect(weaponLevel(exSave, exId)).toBe(3);
    exSave = { ...exSave, completedBounties: [...exSave.completedBounties, exBounties[2]] };
    expect(weaponLevel(exSave, exId)).toBe(4);
    exSave = { ...exSave, stars: { [BOUNTY_EXCLUSIVE_CAPSTONE_LEVEL]: 1 } };
    expect(weaponLevel(exSave, exId)).toBe(5);

    // 5. LoadoutPreset persists and safely restores equippedEvolutions (ignoring locked/mismatched evos)
    const presetSource = {
      ...createMaxedSave(),
      charms: ['blast-powder', 'flint-spark'],
      equippedEvolutions: {
        ...createMaxedSave().equippedEvolutions,
        'blast-powder': 'blast-powder:napalm-payload',
        'flint-spark': 'flint-spark:hellfire-corona',
      },
    };
    saveLoadoutPreset(0, presetSource, 'Napalm');
    const loadedPresets = loadLoadoutPresets();
    expect(loadedPresets[0]?.equippedEvolutions).toEqual({
      'blast-powder': 'blast-powder:napalm-payload',
      'flint-spark': 'flint-spark:hellfire-corona',
    });

    // Applying to a save that only unlocked blast-powder:napalm-payload restores only the unlocked one!
    const partialSave = {
      ...createNewSave(),
      armory: ['blast-powder', 'flint-spark'],
      unlockedWeaponEvolutions: ['blast-powder:napalm-payload', 'flint-spark:cinder-trail'],
      equippedEvolutions: { 'blast-powder': 'blast-powder:cluster-charge', 'flint-spark': 'flint-spark:cinder-trail' },
    };
    const applied = applyLoadoutPreset(partialSave, loadedPresets[0]!);
    expect(applied.charms).toEqual(['blast-powder', 'flint-spark']);
    expect(applied.equippedEvolutions['blast-powder']).toBe('blast-powder:napalm-payload');
    expect(applied.equippedEvolutions['flint-spark']).toBe('flint-spark:cinder-trail'); // locked hellfire-corona ignored
  });
});

// =============================================================================
// [TP-03] /dev/summit Route & /dev/spire Alias Parity
// =============================================================================

describe('[TP-03] /dev/summit studio route & /dev/spire alias', () => {
  it('app/dev/summit.tsx defines DevSummit and app/dev/spire.tsx re-exports it cleanly', () => {
    const summitSrc = fs.readFileSync(path.join(REPO_ROOT, 'app/dev/summit.tsx'), 'utf8');
    const spireSrc = fs.readFileSync(path.join(REPO_ROOT, 'app/dev/spire.tsx'), 'utf8');
    expect(summitSrc).toMatch(/export default function DevSummit/);
    expect(spireSrc).toMatch(/export \{ default \} from '\.\/summit'/);
  });
});
