/**
 * Comprehensive verification for Wave 2 Lane C:
 *  - [GP-07] 5 foe Parry archetypes, 2.5s micro-Stagger, Boss Escalation, v0.1.173 colorblind meta
 *  - [GP-09] Simultaneous external board pressure cap (<= 2; 3 reserved for 5-5)
 *  - [GP-14] Orange Tabby baseline buff + Golden Key #1 pulled forward to 1-4 <-> 1-5
 *  - [GP-16] World 1 early flair (Sunny Gecko, Golden Mole), refactored bosses, zero legacy target-score copy
 *  - [GP-17] LONG_ROUNDS 1.25x, recalibrated POWER xN HP curve, zero instantDeath across all enemies
 *  - [GP-18] Softened star gates (10/24/46/76), Friendly Tailwind, 3-loss W3-5 stuck nudge,
 *            50% retreat coin retention, pre-1-8 hidden purse, Starfall Cauldron wagers,
 *            save persistence, fightEvent telemetry, and LevelPreview UI controls.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Card } from '@/types';
import { BIOMES } from '@/adventure/data/biomes';
import { FIGHTERS, FIGHTER_RESCUE_BADGES, ORANGE_TABBY_BASELINE } from '@/adventure/data/fighters';
import { createFoe, foeDisplay } from '@/adventure/data/foes';
import {
  LEVELS,
  LONG_ROUNDS,
  MAX_EXTERNAL_PRESSURES,
  PRACTICE_LEVELS,
  externalPressuresOf,
  getLevel,
} from '@/adventure/data/levels';
import { MAP_KEYS } from '@/adventure/data/mapKeys';
import {
  PARRY_RULES,
  effectiveParryCooldownMs,
  getParryArchetype,
  parryCounterMeta,
  parryPenaltyText,
  resolveParrySpec,
  type ParryArchetype,
} from '@/adventure/data/parry';
import { PASSIVE_TUNING } from '@/adventure/data/passives';
import {
  CAULDRON_WAGERS,
  FRIENDLY_TAILWIND,
  LOSS_STREAK_ASSIST_STEPS,
  RETREAT_COIN_MIN_SETS,
  RETREAT_COIN_RETENTION,
  STUCK_NUDGE_LOSS_THRESHOLD,
  TAILWIND_LOSS_THRESHOLD,
  TAILWIND_STAR_CAP,
  applyTailwindStarCap,
  canAffordCauldronWager,
  computeHiddenPurseDeposit,
  computeRetreatCoins,
  consecutiveLossesFor,
  isCauldronAvailable,
  isTailwindOffered,
  resolveRunReliefOptions,
  settleCauldronWager,
  shouldEnableLossStreakNudge,
} from '@/adventure/data/relief';
import { validateCampaignHpCurve } from '@/adventure/balance/tuner';
import { describeChallenge } from '@/adventure/engine/challenges';
import { createRun } from '@/adventure/engine/run';
import {
  applyLevelResult,
  applyRetreatResult,
  createNewSave,
  createSaveBefore,
  setCauldronWager,
  setTailwindActive,
} from '@/adventure/progress';
import { hydrateAdventureSave } from '@/adventure/save';
import { battleRecord } from '@/adventure/history';
import { fightEventProps } from '@/analytics/fightEvent';
import LevelPreview from '@/adventure/components/LevelPreview';
import { createEnemy, getEnemyNames } from '@/utils/enemyFactory';
import { createGoldenMole } from '@/utils/enemies/tier1/goldenMole';
import { createSunnyGecko } from '@/utils/enemies/tier1/sunnyGecko';
import { createHydraHead } from '@/utils/enemies/tier4/theHydra';

jest.mock('@/components/fighters', () => {
  const { Text: RNText } = require('react-native');
  return {
    FighterAvatar: ({ character }: { character: string }) => <RNText>{character}</RNText>,
  };
});

jest.mock('@/components/enemies', () => {
  const { Text: RNText } = require('react-native');
  return {
    EnemyAvatar: ({ enemy }: { enemy: string | { name: string } }) => (
      <RNText>{typeof enemy === 'string' ? enemy : enemy.name}</RNText>
    ),
  };
});

jest.mock('@/components/weapons', () => {
  const { Text: RNText } = require('react-native');
  return {
    WeaponAvatar: ({ weapon }: { weapon: { name: string } }) => <RNText>{weapon.name}</RNText>,
  };
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

const INSETS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
};
const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={INSETS}>{node}</SafeAreaProvider>;

const makeBoard = (count = 12): Card[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `card-${i}`,
    shape: 'oval' as const,
    color: 'red' as const,
    number: 1 as const,
    shading: 'solid' as const,
    selected: false,
  }));

describe('[GP-07] 5 Foe Parry Archetypes & v0.1.173 Colorblind Preservation', () => {
  it('registers all 5 archetypes across campaign levels and enables 2.5s default micro-Stagger', () => {
    expect(PARRY_RULES.anyStaggerMs).toBe(2500);
    expect(PARRY_RULES.counterStaggerMs).toBe(5000);
    expect(PARRY_RULES.heavyStaggerMs).toBe(9000);

    const seen = new Set<ParryArchetype>();
    for (const level of LEVELS) {
      const arch = getParryArchetype(level.id);
      if (arch) seen.add(arch);
    }
    expect(seen).toEqual(new Set<ParryArchetype>(['heavy', 'swarm', 'stalker', 'tactical', 'boss_enrage']));

    // Boss Escalation tightens cooldown by -2,000ms below 50% foe HP
    const hydraParry = resolveParrySpec(getLevel('5-5'))!;
    expect(hydraParry.bossEnrageDeltaMs).toBe(2000);
    expect(effectiveParryCooldownMs(hydraParry, 0.75)).toBe(hydraParry.cooldownMs);
    expect(effectiveParryCooldownMs(hydraParry, 0.49)).toBe(hydraParry.cooldownMs - 2000);
    expect(parryPenaltyText('heart', 2)).toBe('Unparried: −2 ♥');
    expect(parryPenaltyText('time', 4)).toBe('Unparried: −4s');
  });

  it('preserves v0.1.173 Circle/Triangle/Bolt × Orange/Blue/Pink colorblind parry meta', () => {
    expect(parryCounterMeta({ kind: 'shape', shape: 'oval' }).label).toBe('All Circles Trio');
    expect(parryCounterMeta({ kind: 'shape', shape: 'diamond' }).label).toBe('All Triangles Trio');
    expect(parryCounterMeta({ kind: 'shape', shape: 'squiggle' }).label).toBe('All Bolts Trio');

    expect(parryCounterMeta({ kind: 'color', color: 'red' }, false).label).toBe('All Orange Trio');
    expect(parryCounterMeta({ kind: 'color', color: 'green' }, false).label).toBe('All Blue Trio');
    expect(parryCounterMeta({ kind: 'color', color: 'purple' }, false).label).toBe('All Pink Trio');

    expect(parryCounterMeta({ kind: 'color', color: 'red' }, true).label).toContain('(O)');
    expect(parryCounterMeta({ kind: 'color', color: 'green' }, true).label).toContain('(B)');
    expect(parryCounterMeta({ kind: 'color', color: 'purple' }, true).label).toContain('(P)');
  });
});

describe('[GP-09] & [GP-17] Campaign Preservation, Pressure Cap, LONG_ROUNDS & HP Curve', () => {
  it('preserves all 59 campaign levels + 1-4D practice and enforces <= 2 external pressures (3 only on 5-5)', () => {
    expect(LEVELS).toHaveLength(59);
    expect(PRACTICE_LEVELS.map(l => l.id)).toEqual(['1-4D']);
    expect(MAX_EXTERNAL_PRESSURES).toBe(2);

    for (const level of LEVELS) {
      const pressures = externalPressuresOf(level);
      const cap = level.id === '5-5' ? 3 : MAX_EXTERNAL_PRESSURES;
      expect(pressures.length).toBeLessThanOrEqual(cap);
    }
    expect(externalPressuresOf(getLevel('5-5')).length).toBe(3);
  });

  it('tightens LONG_ROUNDS to 1.25x, keeps timers crisp, and maintains a monotonic campaign HP curve', () => {
    expect(LONG_ROUNDS).toEqual({ fromWorldAfter: 'meadow', foeHp: 1.25, timer: 1.25 });

    // Key POWER xN recalibrated anchor points
    expect(getLevel('1-10').foes.reduce((s, f) => s + f.hp, 0)).toBeGreaterThanOrEqual(150);
    expect(getLevel('1-10').foes.reduce((s, f) => s + f.hp, 0)).toBeLessThanOrEqual(220);
    expect(getLevel('2-10').foes.reduce((s, f) => s + f.hp, 0)).toBeGreaterThanOrEqual(750);
    expect(getLevel('2-10').foes.reduce((s, f) => s + f.hp, 0)).toBeLessThanOrEqual(1100);
    expect(getLevel('3-10').foes.reduce((s, f) => s + f.hp, 0)).toBeGreaterThanOrEqual(2800);
    expect(getLevel('3-10').foes.reduce((s, f) => s + f.hp, 0)).toBeLessThanOrEqual(4200);
    expect(getLevel('4-11').rules.timer).toBe(160);
    expect(getLevel('5-5').rules.timer).toBe(180);
    expect(getLevel('5-5').foes.reduce((s, f) => s + f.hp, 0)).toBe(14000);

    // Non-boss W2-5 timers stay crisp in [75s, 110s]
    for (const l of LEVELS) {
      const w = Number(l.id.split('-')[0]);
      if (w >= 2 && !l.isBoss && typeof l.rules.timer === 'number') {
        expect(l.rules.timer).toBeGreaterThanOrEqual(75);
        expect(l.rules.timer).toBeLessThanOrEqual(110);
      }
    }

    const curve = validateCampaignHpCurve(LEVELS);
    expect(curve.violations).toEqual([]);
  });

  it('has ZERO legacy target-score / Achieve minimum copy on any campaign level challenge', () => {
    for (const level of LEVELS) {
      const text = describeChallenge(level);
      expect(text.toLowerCase()).not.toContain('target score');
      expect(text.toLowerCase()).not.toContain('achieve minimum');
      expect(text.toLowerCase()).not.toContain('beat target');
    }
  });

  it('eliminates instantDeath across every registered enemy in favor of telegraphed Heavy Slams', () => {
    const board = makeBoard(12);
    for (const name of getEnemyNames()) {
      const enemy = createEnemy(name);
      enemy.onRoundStart(board);
      const tick = enemy.onTick(60000, board);
      expect({ name, instantDeath: tick.instantDeath }).toEqual({ name, instantDeath: false });
    }
  });
});

describe('[GP-14] Beginner Fighter Buff & Golden Rescue Key #1 Placement', () => {
  it('buffs Orange Tabby baseline tuning and moves key-1 forward to 1-4 <-> 1-5', () => {
    expect(ORANGE_TABBY_BASELINE).toEqual({ scrappyBase: 1, scrappyPerHeart: 1.5, wave1PounceShield: 1 });
    expect(PASSIVE_TUNING.scrappy['scrappy.base']).toBe(1);
    expect(PASSIVE_TUNING.scrappy['scrappy.perHeart']).toBe(1.5);
    expect(PASSIVE_TUNING.nine_lives['nineLives.waveShield']).toBe(1);
    expect(FIGHTERS.find(f => f.name === 'Orange Tabby')?.blurb.toLowerCase()).toContain('pounce shield');
    expect(Object.keys(FIGHTER_RESCUE_BADGES)).toHaveLength(5);

    expect(MAP_KEYS[0]).toMatchObject({
      id: 'key-1',
      afterLevel: '1-4',
      beforeLevel: '1-5',
      location: 'Sunny Meadow Glade',
    });
  });
});

describe('[GP-16] World 1 Early Foe Flair & Hydra 3-Head Phases', () => {
  it('Sunny Gecko (1-4) flips 1 card face-down every 3 Sets for 3s then reveals it', () => {
    expect(getLevel('1-4').foes[0].enemy).toBe('Sunny Gecko');
    const gecko = createSunnyGecko();
    const board = makeBoard(12);
    gecko.onRoundStart(board);

    gecko.onValidMatch([board[0], board[1], board[2]], board);
    gecko.onValidMatch([board[0], board[1], board[2]], board);
    expect(gecko.onTick(500, board).cardModifications).toHaveLength(0);

    gecko.onValidMatch([board[0], board[1], board[2]], board);
    const hop = gecko.onTick(100, board);
    expect(hop.cardModifications).toHaveLength(1);
    expect(hop.cardModifications[0].changes.isFaceDown).toBe(true);
    const hiddenId = hop.cardModifications[0].cardId;

    const reveal = gecko.onTick(3000, board);
    expect(reveal.cardsToFlip).toContain(hiddenId);
  });

  it('Golden Mole (1-8) keeps a gleaming +2c Gold card on the board and replaces it once cleared', () => {
    expect(getLevel('1-8').foes[0].enemy).toBe('Golden Mole');
    const mole = createGoldenMole();
    const board = makeBoard(12);
    const start = mole.onRoundStart(board);
    expect(start.cardModifications).toHaveLength(1);
    expect(start.cardModifications[0].changes.bonusMoney).toBe(2);
    const goldId = start.cardModifications[0].cardId;

    // While the Gold card is still present, tick leaves it alone
    const withGold = board.map(c => (c.id === goldId ? { ...c, bonusMoney: 2 } : c));
    expect(mole.onTick(1000, withGold).cardModifications).toHaveLength(0);

    // Once the Gold card is cleared from the board, Golden Mole gleams a fresh card
    const withoutGold = board.filter(c => c.id !== goldId);
    const respawn = mole.onTick(1000, withoutGold);
    expect(respawn.cardModifications).toHaveLength(1);
    expect(respawn.cardModifications[0].changes.bonusMoney).toBe(2);
  });

  it('5-5 builds 3 distinct Hydra Head phases while preserving canonical enemy "The Hydra"', () => {
    const finale = getLevel('5-5');
    expect(finale.foes).toHaveLength(3);
    expect(finale.foes.every(f => f.enemy === 'The Hydra')).toBe(true);
    expect(finale.foes.map(f => f.hydraPhase)).toEqual([1, 2, 3]);

    const f1 = createFoe(finale.foes[0]);
    const f2 = createFoe(finale.foes[1]);
    const f3 = createFoe(finale.foes[2]);
    expect(f1.foe.description).toBe(createHydraHead(1).description);
    expect(f2.foe.description).toBe(createHydraHead(2).description);
    expect(f3.foe.description).toBe(createHydraHead(3).description);
    expect(foeDisplay(finale.foes[0]).name).toBe('The Hydra');
    expect(foeDisplay(finale.foes[1]).ability).not.toBe(foeDisplay(finale.foes[0]).ability);
  });
});

describe('[GP-18] Softened Star Gates, Friendly Tailwind, Hidden Purse, Retreat Coins & Starfall Cauldron', () => {
  it('softens biome star gates to 0 / 10 / 24 / 46 / 76', () => {
    expect(BIOMES.map(b => b.starGate)).toEqual([0, 10, 24, 46, 76]);
  });

  it('tracks consecutive losses, offers Friendly Tailwind at >=2 losses, caps Tailwind wins at 1 star, and triggers W3-5 stuck nudge at >=3 losses', () => {
    expect(TAILWIND_LOSS_THRESHOLD).toBe(2);
    expect(TAILWIND_STAR_CAP).toBe(1);
    expect(STUCK_NUDGE_LOSS_THRESHOLD).toBe(3);
    expect(LOSS_STREAK_ASSIST_STEPS).toEqual([25]);

    const level32 = getLevel('3-2');
    const level15 = getLevel('1-5');
    let save = createSaveBefore('3-2');
    expect(isTailwindOffered(level32, save)).toBe(false);

    // Loss #1
    save = applyLevelResult(save, level32, 0, 10).save;
    expect(consecutiveLossesFor(save, '3-2')).toBe(1);
    expect(isTailwindOffered(level32, save)).toBe(false);

    // Loss #2 -> Tailwind offered!
    save = applyLevelResult(save, level32, 0, 10).save;
    expect(consecutiveLossesFor(save, '3-2')).toBe(2);
    expect(isTailwindOffered(level32, save)).toBe(true);
    expect(shouldEnableLossStreakNudge(level32, save)).toBe(false);

    // Loss #3 on W3 -> Stuck nudge kicks in (never on World 1)!
    save = applyLevelResult(save, level32, 0, 10).save;
    expect(consecutiveLossesFor(save, '3-2')).toBe(3);
    expect(shouldEnableLossStreakNudge(level32, save)).toBe(true);
    expect(shouldEnableLossStreakNudge(level15, { consecutiveLosses: { '1-5': 4 } })).toBe(false);

    // Enable Tailwind -> relief options apply +2 hearts, 1.2x timer, 1.25x parry windup, and 1-star cap
    save = setTailwindActive(save, true);
    const relief = resolveRunReliefOptions(level32, save);
    expect(relief.tailwindActive).toBe(true);
    expect(relief.extraHearts).toBe(FRIENDLY_TAILWIND.extraHearts);
    expect(relief.timerScale).toBe(FRIENDLY_TAILWIND.timerScale);
    expect(relief.parryWindupScale).toBe(FRIENDLY_TAILWIND.parryWindupScale);
    expect(relief.starCap).toBe(TAILWIND_STAR_CAP);
    expect(applyTailwindStarCap(3, true)).toBe(1);
    expect(applyTailwindStarCap(3, false)).toBe(3);

    // Winning with Tailwind caps awarded stars at 1, resets consecutiveLosses, and clears tailwindActive
    const winRes = applyLevelResult(save, level32, 3, 20, undefined, { tailwindActive: true });
    expect(winRes.tailwindActive).toBe(true);
    expect(winRes.save.stars['3-2']).toBe(1);
    expect(consecutiveLossesFor(winRes.save, '3-2')).toBe(0);
    expect(winRes.save.tailwindActive).toBe(false);
  });

  it('banks pre-1-8 defeat coins into hiddenPurse (5-10c) and bursts them open when 1-8 unlocks coins', () => {
    expect(computeHiddenPurseDeposit(0, 1)).toBe(5);
    expect(computeHiddenPurseDeposit(10, 0)).toBe(10);

    let save = createSaveBefore('1-5');
    expect(save.coinsUnlocked).toBe(false);

    const run1 = { ...createRun(getLevel('1-5'), save, { seed: 1 }), matches: 4, foeHp: 20, foeMaxHp: 40 };
    const loss1 = applyLevelResult(save, getLevel('1-5'), 0, 0, run1);
    expect(loss1.hiddenPurseDeposited).toBeGreaterThanOrEqual(5);
    expect(loss1.hiddenPurseDeposited).toBeLessThanOrEqual(10);
    save = loss1.save;

    const run2 = { ...createRun(getLevel('1-5'), save, { seed: 2 }), matches: 8, foeHp: 4, foeMaxHp: 40 };
    const loss2 = applyLevelResult(save, getLevel('1-5'), 0, 0, run2);
    expect(loss2.hiddenPurseDeposited).toBeGreaterThanOrEqual(5);
    save = loss2.save;
    const banked = save.hiddenPurse ?? 0;
    expect(banked).toBeGreaterThanOrEqual(10);

    // Clearing 1-8 unlocks coins and bursts the hidden purse directly into save.coins!
    const coinsBefore = save.coins;
    const unlockRes = applyLevelResult(save, getLevel('1-8'), 1, 20);
    expect(unlockRes.save.coinsUnlocked).toBe(true);
    expect(unlockRes.hiddenPurseBurst).toBe(banked);
    expect(unlockRes.save.hiddenPurse).toBe(0);
    expect(unlockRes.save.coins).toBeGreaterThanOrEqual(coinsBefore + 20 + banked);
  });

  it('retains 50% of earned coins on retreat when >= 5 Sets were found (0% below 5 Sets)', () => {
    expect(RETREAT_COIN_MIN_SETS).toBe(5);
    expect(RETREAT_COIN_RETENTION).toBe(0.5);
    expect(computeRetreatCoins(4, 40, true)).toBe(0);
    expect(computeRetreatCoins(5, 40, true)).toBe(20);
    expect(computeRetreatCoins(6, 40, false)).toBe(0);

    const save = { ...createSaveBefore('2-3'), coins: 100 };
    const earlyRetreat = applyRetreatResult(save, getLevel('2-3'), { matches: 4, coins: 40 });
    expect(earlyRetreat.coinsRetained).toBe(0);
    expect(earlyRetreat.save.coins).toBe(100);

    const deepRetreat = applyRetreatResult(save, getLevel('2-3'), { matches: 6, coins: 41 });
    expect(deepRetreat.coinsRetained).toBe(20);
    expect(deepRetreat.save.coins).toBe(120);
  });

  it('handles Starfall Cauldron 3-tier wagers (0 / +1 50c / +2 150c), settlement, save hydration, and telemetry', () => {
    expect(CAULDRON_WAGERS.map(w => [w.tier, w.stakeCoins, w.coinMultiplier])).toEqual([
      [0, 0, 1],
      [1, 50, 1.5],
      [2, 150, 2],
    ]);

    const w1Save = createSaveBefore('1-5');
    expect(isCauldronAvailable(getLevel('1-5'), w1Save)).toBe(false);

    let w2Save = { ...createSaveBefore('2-4'), coins: 200 };
    expect(isCauldronAvailable(getLevel('2-4'), w2Save)).toBe(true);
    expect(canAffordCauldronWager(w2Save, 2)).toBe(true);

    // KO (+1 Bold Wager): 1.5x run coins + 50c net stake win
    expect(settleCauldronWager(1, 2, 100, 200)).toEqual({
      adjustedRunCoins: 150,
      stakeDelta: 50,
    });
    // 1★ survival returns stake cleanly
    expect(settleCauldronWager(2, 1, 60, 200)).toEqual({
      adjustedRunCoins: 60,
      stakeDelta: 0,
    });
    // 0★ defeat forfeits 150c stake
    expect(settleCauldronWager(2, 0, 30, 200)).toEqual({
      adjustedRunCoins: 30,
      stakeDelta: -150,
    });

    w2Save = setCauldronWager(w2Save, 1);
    expect(w2Save.cauldronWager).toBe(1);

    const winWithWager = applyLevelResult(w2Save, getLevel('2-4'), 2, 100, undefined, { cauldronWager: 1 });
    expect(winWithWager.wagerStakeDelta).toBe(50);
    expect(winWithWager.coinsBanked).toBe(150);

    const loseWithWager = applyLevelResult({ ...w2Save, cauldronWager: 2 }, getLevel('2-4'), 0, 0, undefined, { cauldronWager: 2 });
    expect(loseWithWager.wagerStakeDelta).toBe(-150);
    expect(loseWithWager.save.coins).toBe(50);
    expect(loseWithWager.save.cauldronWager).toBe(0);

    // Save hydration sanitizes bad values and preserves valid relief fields
    const hydrated = hydrateAdventureSave({
      ...createNewSave(),
      consecutiveLosses: { '3-2': 3, bad: -2 },
      hiddenPurse: 14,
      cauldronWager: 2,
      tailwindActive: true,
    })!;
    expect(hydrated).not.toBeNull();
    expect(hydrated.consecutiveLosses).toEqual({ '3-2': 3 });
    expect(hydrated.hiddenPurse).toBe(14);
    expect(hydrated.cauldronWager).toBe(2);
    expect(hydrated.tailwindActive).toBe(true);

    // Telemetry wide event stamps tailwindActive & cauldronWager
    const lvl24 = getLevel('2-4');
    const run = createRun(lvl24, w2Save, { seed: 42 });
    const record = battleRecord(lvl24, run, { at: 1000, stars: 2, coins: 0 });
    const tape = {
      save: w2Save,
      recording: { format: 1 as const, levelId: lvl24.id, seed: 42, actions: [] },
    };
    const props = fightEventProps(lvl24, run, record, tape, { tailwindActive: true, cauldronWager: 2 });
    expect(props.tailwindActive).toBe(true);
    expect(props.cauldronWager).toBe(2);
  });

  it('renders Friendly Tailwind toggle and Starfall Cauldron wager selector in LevelPreview', () => {
    const level32 = getLevel('3-2');
    const save = {
      ...createSaveBefore('3-2'),
      coins: 200,
      consecutiveLosses: { '3-2': 3 },
      tailwindActive: false,
      cauldronWager: 0 as const,
    };
    const onToggleTailwind = jest.fn();
    const onSelectWager = jest.fn();

    const view = render(
      wrap(
        <LevelPreview
          level={level32}
          save={save}
          onClose={() => {}}
          onPlay={() => {}}
          onSelectFighter={() => {}}
          onSelectCharm={() => {}}
          onShowMechanic={() => {}}
          onToggleTailwind={onToggleTailwind}
          onSelectWager={onSelectWager}
        />
      )
    );

    expect(view.getByTestId('preview-tailwind-card')).toBeTruthy();
    expect(view.getByTestId('preview-stuck-nudge')).toBeTruthy();
    expect(view.getByTestId('preview-cauldron')).toBeTruthy();

    fireEvent.press(view.getByTestId('preview-wager-1'));
    expect(onSelectWager).toHaveBeenCalledWith(1);

    fireEvent.press(view.getByTestId('preview-tailwind-toggle'));
    expect(onToggleTailwind).toHaveBeenCalledWith(true);
    // Turning Tailwind ON automatically clears Cauldron wager
    expect(onSelectWager).toHaveBeenCalledWith(0);
  });
});
