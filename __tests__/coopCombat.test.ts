/**
 * Starfall Summit 2P Co-Op Combat Engine unit tests:
 * - Solo parity & 100% inertness of co-op actions in solo mode
 * - `COOP_SYNC_BOSS` (HP reconciliation, multi-wave safety, authoritative KO, ally hit FX, Cross-Parry stagger)
 * - `COOP_SYNC_SYNERGY` (party-wide max/delta merge + live `evaluateWeaponSynergyDamage` scaling)
 * - `COOP_RECEIVE_GIFT` (`wild_card`, `heal`, `cleanse`)
 * - Golden Cage (`caged: true` at 0 hearts, board lock, `COOP_SET_CAGED { caged: false }` revive + hazard cleanse)
 * - `COOP_FORCE_DEFEAT` (both caged & shared clock expiry)
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { createRun, runReducer } from '@/adventure/engine/run';
import { allSets } from '@/adventure/engine/sets';
import { getLevel } from '@/adventure/data/levels';
import { createMaxedSave, createNewSave } from '@/adventure/progress';
import CoopAllyHud from '@/adventure/components/CoopAllyHud';
import CoopCageOverlay from '@/adventure/components/CoopCageOverlay';
import type { FeatureFlag, LevelDef, RunState } from '@/adventure/types';
import type { Card } from '@/types';

const COOP_TEST_FEATURES = new Set<FeatureFlag>([
  'hearts',
  'gear',
  'power',
  'rainbow',
  'purity',
  'coins',
  'hints',
  'graces',
  'evolutions',
]);

jest.mock('@/components/Icon', () => {
  const mockReact = require('react');
  const { Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return mockReact.createElement(RNText, null, name);
  };
});

jest.mock('@/components/fighters', () => {
  const mockReact = require('react');
  const { Text: RNText } = require('react-native');
  return {
    FighterAvatar: ({ character }: { character: string }) =>
      mockReact.createElement(RNText, { testID: 'coop-ally-avatar' }, character),
  };
});

const makeCombatLevel = (overrides?: Partial<LevelDef>): LevelDef => {
  const base = getLevel('2-6');
  return {
    ...base,
    id: 'coop-test-1',
    name: 'Co-Op Test Arena',
    rules: {
      ...base.rules,
      hearts: 4,
      timer: 120,
      moves: undefined,
      sandbox: false,
    },
    foes: [
      {
        enemy: 'Greedy Squirrel',
        hp: 200,
        parry: {
          attackName: 'Acorn Slam',
          icon: 'lorc/sword-clash',
          counter: { kind: 'any' },
          cooldownMs: 8000,
          windupMs: 8000,
          perfectWindowMs: 3000,
          penalty: 'heart',
          staggerMs: 6000,
        },
      },
    ],
    ...overrides,
  };
};

const pickInvalidThree = (board: Card[], attrs: RunState['attributes']): Card[] => {
  const validKeys = new Set(
    allSets(board, attrs).map(s =>
      s
        .map(c => c.id)
        .sort()
        .join('|')
    )
  );
  for (let i = 0; i < board.length; i++) {
    for (let j = i + 1; j < board.length; j++) {
      for (let k = j + 1; k < board.length; k++) {
        const key = [board[i].id, board[j].id, board[k].id].sort().join('|');
        if (!validKeys.has(key)) return [board[i], board[j], board[k]];
      }
    }
  }
  throw new Error('Could not find an invalid 3-card selection');
};

describe('Starfall Summit 2P Co-Op Combat Engine', () => {
  describe('solo parity and inertness', () => {
    it('leaves solo RunState untouched and treats all co-op actions as strict no-ops', () => {
      const level = makeCombatLevel();
      const save = createNewSave();
      const solo = createRun(level, save, { seed: 42 });

      expect(solo.isCoop).toBeUndefined();
      expect(solo.caged).toBeUndefined();

      expect(runReducer(solo, { type: 'COOP_SYNC_BOSS', foeHp: 10 })).toBe(solo);
      expect(runReducer(solo, { type: 'COOP_SYNC_SYNERGY', counters: { burn: 20 } })).toBe(solo);
      expect(runReducer(solo, { type: 'COOP_RECEIVE_GIFT', gift: 'wild_card' })).toBe(solo);
      expect(runReducer(solo, { type: 'COOP_RECEIVE_GIFT', gift: 'heal' })).toBe(solo);
      expect(runReducer(solo, { type: 'COOP_RECEIVE_GIFT', gift: 'cleanse' })).toBe(solo);
      expect(runReducer(solo, { type: 'COOP_SET_CAGED', caged: true })).toBe(solo);
      expect(runReducer(solo, { type: 'COOP_FORCE_DEFEAT', reason: 'both_caged' })).toBe(solo);
    });

    it('still ends a solo fight immediately as lost at 0 hearts instead of caging', () => {
      const level = makeCombatLevel();
      const save = { ...createNewSave(), selectedFighter: 'Sly Fox' as const };
      let s = createRun(level, save, {
        seed: 77,
        features: COOP_TEST_FEATURES,
        overrides: { startingHearts: 1 },
      });
      expect(s.hearts).toBe(1);

      const bad = pickInvalidThree(s.board, s.attributes);
      s = runReducer(s, { type: 'INVALID', cards: bad });

      expect(s.hearts).toBe(0);
      expect(s.status).toBe('lost');
      expect(s.endReason).toBe('hearts');
      expect(s.caged).toBeUndefined();
    });
  });

  describe('COOP_SYNC_BOSS', () => {
    it('reconciles foeHp/foeMaxHp and emits an ally hit event with applied damage', () => {
      const level = makeCombatLevel();
      const save = createNewSave();
      let s = createRun(level, save, { seed: 101, overrides: { isCoop: true } });
      expect(s.isCoop).toBe(true);
      expect(s.foeHp).toBe(200);

      s = runReducer(s, {
        type: 'COOP_SYNC_BOSS',
        foeHp: 158,
        foeMaxHp: 200,
        allyHit: { amount: 42, allyName: 'Fox' },
      });

      expect(s.foeHp).toBe(158);
      expect(s.foeMaxHp).toBe(200);
      expect(s.status).toBe('playing');
      const hitEv = s.events.find(e => e.type === 'hit' && e.text === 'Fox');
      expect(hitEv).toBeDefined();
      expect(hitEv?.amount).toBe(42);
      expect(hitEv?.clock).toBe(true);
      // Ally damage does not inflate local player's totalDamage counter
      expect(s.totalDamage).toBe(0);
    });

    it('never triggers premature solo victory when waves remain, and wins cleanly on the final wave', () => {
      const multiWave = makeCombatLevel({
        foes: [
          { name: 'Wave 1 Guard', icon: 'lorc/crab', hp: 100 },
          { name: 'Wave 2 Boss', icon: 'lorc/dragon-head', hp: 150 },
        ],
      });
      const save = createNewSave();
      let s = createRun(multiWave, save, { seed: 102, overrides: { isCoop: true } });

      // Wave 0 HP hits 0 -> enters intermission, NOT won!
      s = runReducer(s, { type: 'COOP_SYNC_BOSS', foeHp: 0 });
      expect(s.foeHp).toBe(0);
      expect(s.status).toBe('intermission');
      expect(s.endReason).toBeNull();

      // Advance to Wave 1 (final wave) -> authoritative HP 0 transitions cleanly to won!
      s = runReducer(s, { type: 'NEXT_WAVE' });
      expect(s.wave).toBe(1);
      expect(s.status).toBe('playing');

      s = runReducer(s, { type: 'COOP_SYNC_BOSS', foeHp: 0 });
      expect(s.foeHp).toBe(0);
      expect(s.status).toBe('won');
      expect(s.endReason).toBe('defeated');
      expect(s.events.some(e => e.type === 'foe_defeated')).toBe(true);
    });

    it('syncs ally Cross-Parry into staggered state, emits real parry/perfect_parry feedback, and boosts local Set damage', () => {
      const level = makeCombatLevel();
      const save = { ...createNewSave(), selectedFighter: 'Sly Fox' as const, charms: [] };
      const baseRun = createRun(level, save, { seed: 202, overrides: { isCoop: true } });
      const sets = allSets(baseRun.board, baseRun.attributes);
      expect(sets.length).toBeGreaterThan(0);
      const chosenSet = sets[0];

      // Baseline damage without stagger
      const calmAfter = runReducer(baseRun, { type: 'MATCH', cards: chosenSet, resolveWeapons: true });
      const calmDmg = calmAfter.totalDamage;

      // Cross-Parry stagger from ally Penguin (Perfect!)
      let staggeredRun = runReducer(baseRun, {
        type: 'COOP_SYNC_BOSS',
        foeHp: baseRun.foeHp,
        parry: {
          phase: 'staggered',
          msLeft: 7000,
          durationMs: 7000,
          crossParry: { perfect: true, allyName: 'Penguin' },
        },
      });

      expect(staggeredRun.parry?.phase).toBe('staggered');
      expect(staggeredRun.parry?.msLeft).toBe(7000);
      expect(staggeredRun.parriesLanded).toBe(1);
      expect(staggeredRun.perfectParriesLanded).toBe(1);
      expect(staggeredRun.synergy.parries).toBeGreaterThanOrEqual(2);
      expect(staggeredRun.events.some(e => e.type === 'perfect_parry')).toBe(true);

      // Re-syncing staggered snapshot without crossParry is idempotent (no duplicate parry event)
      const prevEventsCount = staggeredRun.events.filter(e => e.type === 'parry' || e.type === 'perfect_parry').length;
      staggeredRun = runReducer(staggeredRun, {
        type: 'COOP_SYNC_BOSS',
        foeHp: staggeredRun.foeHp,
        parry: { phase: 'staggered', msLeft: 5500, durationMs: 7000 },
      });
      expect(staggeredRun.parry?.msLeft).toBe(5500);
      expect(staggeredRun.events.filter(e => e.type === 'parry' || e.type === 'perfect_parry').length).toBe(prevEventsCount);

      // Local Set against Cross-Parry staggered foe deals significantly more damage (+8 flat & ×1.35 mult)
      const staggeredAfter = runReducer(staggeredRun, { type: 'MATCH', cards: chosenSet, resolveWeapons: true });
      expect(staggeredAfter.totalDamage).toBeGreaterThan(calmDmg);
      expect(staggeredAfter.lastSetIgnition?.staggered).toBe(true);
    });

    it('emits standard parry event for non-perfect ally Cross-Parry', () => {
      const level = makeCombatLevel();
      const save = createNewSave();
      let s = createRun(level, save, { seed: 205, overrides: { isCoop: true } });

      s = runReducer(s, {
        type: 'COOP_SYNC_BOSS',
        foeHp: s.foeHp,
        parry: {
          phase: 'staggered',
          msLeft: 5000,
          crossParry: { perfect: false, allyName: 'Corgi' },
        },
      });

      expect(s.parry?.phase).toBe('staggered');
      expect(s.parriesLanded).toBe(1);
      expect(s.perfectParriesLanded).toBe(0);
      expect(s.events.some(e => e.type === 'parry')).toBe(true);
    });
  });

  describe('COOP_SYNC_SYNERGY', () => {
    it('merges party-wide counters (max) and additive deltas, scaling weapon Synergy hooks naturally', () => {
      const level = makeCombatLevel();
      const save = {
        ...createMaxedSave(),
        selectedFighter: 'Sly Fox' as const,
        charms: ['flint-spark'],
        equippedArcana: [],
        equippedEvolutions: {},
        unlockedWeaponEvolutions: [],
      };
      const baseRun = createRun(level, save, {
        seed: 303,
        features: COOP_TEST_FEATURES,
        overrides: { isCoop: true },
      });
      const sets = allSets(baseRun.board, baseRun.attributes);
      expect(sets.length).toBeGreaterThan(0);
      const chosenSet = sets[0];

      // Baseline Match with burn = 0
      const baseAfter = runReducer(baseRun, { type: 'MATCH', cards: chosenSet, resolveWeapons: true });
      const baseHit = baseAfter.lastSetIgnition?.math.hit ?? baseAfter.totalDamage;

      // Sync party-wide burn = 15 (counters) + 5 (deltas) = 20 -> Flint & Spark scales off Burn!
      let boosted = runReducer(baseRun, {
        type: 'COOP_SYNC_SYNERGY',
        counters: { burn: 15, marks: 6 },
      });
      expect(boosted.synergy.burn).toBe(15);
      expect(boosted.synergy.marks).toBe(6);

      // Lower incoming counter never decreases local synergy
      boosted = runReducer(boosted, {
        type: 'COOP_SYNC_SYNERGY',
        counters: { burn: 4 },
        deltas: { burn: 5 },
      });
      expect(boosted.synergy.burn).toBe(20);
      expect(boosted.synergyPeak.burn).toBe(20);
      expect(boosted.fightMetrics.synergy.burn).toBe(20);

      const boostedAfter = runReducer(boosted, { type: 'MATCH', cards: chosenSet, resolveWeapons: true });
      const boostedHit = boostedAfter.lastSetIgnition?.math.hit ?? boostedAfter.totalDamage;
      expect(boostedHit).toBeGreaterThan(baseHit);
      expect((boostedAfter.lastSetIgnition?.math.synergyBonus ?? 0)).toBeGreaterThan(
        baseAfter.lastSetIgnition?.math.synergyBonus ?? 0
      );
    });
  });

  describe('COOP_RECEIVE_GIFT', () => {
    it('wild_card marks a selectable board card isWild: true', () => {
      const level = makeCombatLevel();
      const save = createNewSave();
      const s0 = createRun(level, save, { seed: 404, overrides: { isCoop: true } });
      const wildBefore = s0.board.filter(c => c.isWild).length;

      const s1 = runReducer(s0, { type: 'COOP_RECEIVE_GIFT', gift: 'wild_card', fromName: 'Fox' });
      const wildAfter = s1.board.filter(c => c.isWild).length;

      expect(wildAfter).toBe(wildBefore + 1);
      expect(s1.events.some(e => e.type === 'rule' && (e.text ?? '').includes('WILD CARD'))).toBe(true);
    });

    it('heal restores +1 heart up to maxHearts and emits heal event', () => {
      const level = makeCombatLevel();
      const save = createNewSave();
      let s = createRun(level, save, {
        seed: 405,
        features: COOP_TEST_FEATURES,
        overrides: { isCoop: true, startingHearts: 2 },
      });
      expect(s.hearts).toBe(2);
      expect(s.maxHearts).toBe(4);

      s = runReducer(s, { type: 'COOP_RECEIVE_GIFT', gift: 'heal', fromName: 'Pelican' });
      expect(s.hearts).toBe(3);
      expect(s.events.some(e => e.type === 'heal' && e.amount === 1)).toBe(true);

      s = runReducer(s, { type: 'COOP_RECEIVE_GIFT', gift: 'heal', fromName: 'Pelican' });
      expect(s.hearts).toBe(4);
      // Capped at maxHearts
      s = runReducer(s, { type: 'COOP_RECEIVE_GIFT', gift: 'heal', fromName: 'Pelican' });
      expect(s.hearts).toBe(4);
    });

    it('cleanse removes curse, ice, dud, and face-down hazards from a board card', () => {
      const level = makeCombatLevel();
      const save = createNewSave();
      const s0 = createRun(level, save, { seed: 406, overrides: { isCoop: true } });

      // Inject hazardous cards onto the board
      const dirtyBoard = s0.board.map((c, idx) =>
        idx === 0
          ? { ...c, isDud: true, locked: true, cursedUntil: 99_000, frozen: 2, isFaceDown: true }
          : c
      );
      const dirtyState: RunState = { ...s0, board: dirtyBoard };

      const cleansed = runReducer(dirtyState, {
        type: 'COOP_RECEIVE_GIFT',
        gift: 'cleanse',
        fromName: 'Corgi',
      });

      const target = cleansed.board[0];
      expect(target.isDud).toBe(false);
      expect(target.locked).toBe(false);
      expect(target.cursedUntil).toBeUndefined();
      expect(target.frozen).toBeUndefined();
      expect(target.isFaceDown).toBe(false);
      expect(cleansed.synergy.hazards).toBeGreaterThan(dirtyState.synergy.hazards);
      expect(cleansed.events.some(e => e.type === 'rule' && (e.text ?? '').includes('CLEANSED'))).toBe(true);
    });
  });

  describe('Golden Cage, revive, and COOP_FORCE_DEFEAT', () => {
    it('traps player in the Golden Cage at 0 hearts, locks board actions, and revives with 2 hearts + cleansed hazards', () => {
      const level = makeCombatLevel();
      const save = { ...createNewSave(), selectedFighter: 'Sly Fox' as const };
      let s = createRun(level, save, {
        seed: 505,
        features: COOP_TEST_FEATURES,
        overrides: { isCoop: true, startingHearts: 1 },
      });
      expect(s.hearts).toBe(1);
      expect(s.caged).toBe(false);

      // Miss a Set at 1 heart -> enters Golden Cage instead of losing!
      const bad = pickInvalidThree(s.board, s.attributes);
      s = runReducer(s, { type: 'INVALID', cards: bad });
      expect(s.hearts).toBe(0);
      expect(s.caged).toBe(true);
      expect(s.status).toBe('playing');

      // While caged, board actions (MATCH, INVALID, USE_HINT) are blocked
      const sets = allSets(s.board, s.attributes);
      expect(sets.length).toBeGreaterThan(0);
      expect(runReducer(s, { type: 'MATCH', cards: sets[0], resolveWeapons: true })).toBe(s);
      expect(runReducer(s, { type: 'INVALID', cards: bad })).toBe(s);
      expect(runReducer(s, { type: 'USE_HINT' })).toBe(s);

      // Heal gift cannot bypass Golden Cage
      const afterHealGift = runReducer(s, { type: 'COOP_RECEIVE_GIFT', gift: 'heal' });
      expect(afterHealGift.caged).toBe(true);
      expect(afterHealGift.hearts).toBe(0);

      // Add hazards onto the board while caged to verify revive cleanses them all
      const hazardous: RunState = {
        ...s,
        board: s.board.map((c, idx) =>
          idx === 0
            ? { ...c, isDud: true, locked: true, cursedUntil: 80_000 }
            : idx === 1
              ? { ...c, frozen: 3, isFaceDown: true, hasBomb: true }
              : c
        ),
        timeBombIds: [s.board[1].id],
      };

      // Ally completes rescue -> COOP_SET_CAGED { caged: false } revives with 2 hearts + cleanses board!
      const revived = runReducer(hazardous, {
        type: 'COOP_SET_CAGED',
        caged: false,
        rescuedByName: 'Fox',
      });
      expect(revived.caged).toBe(false);
      expect(revived.hearts).toBe(2);
      expect(revived.status).toBe('playing');
      expect(revived.board[0].isDud).toBe(false);
      expect(revived.board[0].locked).toBe(false);
      expect(revived.board[0].cursedUntil).toBeUndefined();
      expect(revived.board[1].frozen).toBeUndefined();
      expect(revived.board[1].isFaceDown).toBe(false);
      expect(revived.board[1].hasBomb).toBe(false);
      expect(revived.timeBombIds).toHaveLength(0);
      expect(revived.events.some(e => e.type === 'heal')).toBe(true);

      // Board is unlocked again and MATCH succeeds!
      const revivedSets = allSets(revived.board, revived.attributes);
      expect(revivedSets.length).toBeGreaterThan(0);
      const afterMatch = runReducer(revived, { type: 'MATCH', cards: revivedSets[0], resolveWeapons: true });
      expect(afterMatch.matches).toBe(revived.matches + 1);
      expect(afterMatch.totalDamage).toBeGreaterThan(0);
    });

    it('caps revive hearts by maxHearts when maxHearts < 2', () => {
      const level = makeCombatLevel({ rules: { ...makeCombatLevel().rules, hearts: 1 } });
      const save = { ...createNewSave(), selectedFighter: 'Sly Fox' as const };
      let s = createRun(level, save, {
        seed: 506,
        features: COOP_TEST_FEATURES,
        overrides: { isCoop: true },
      });
      expect(s.maxHearts).toBe(1);

      s = runReducer(s, { type: 'COOP_SET_CAGED', caged: true });
      expect(s.caged).toBe(true);
      expect(s.hearts).toBe(0);

      s = runReducer(s, { type: 'COOP_SET_CAGED', caged: false });
      expect(s.caged).toBe(false);
      expect(s.hearts).toBe(1);
    });

    it('ends the fight as lost on COOP_FORCE_DEFEAT for both_caged and time_up', () => {
      const level = makeCombatLevel();
      const save = createNewSave();
      const s0 = createRun(level, save, {
        seed: 601,
        features: COOP_TEST_FEATURES,
        overrides: { isCoop: true },
      });

      const bothCaged = runReducer(s0, { type: 'COOP_FORCE_DEFEAT', reason: 'both_caged' });
      expect(bothCaged.status).toBe('lost');
      expect(bothCaged.endReason).toBe('hearts');
      expect(bothCaged.caged).toBe(true);
      expect(bothCaged.hearts).toBe(0);

      const timedOut = runReducer(s0, { type: 'COOP_FORCE_DEFEAT', reason: 'time_up' });
      expect(timedOut.status).toBe('lost');
      expect(timedOut.endReason).toBe('hearts');
      expect(timedOut.timeLeft).toBe(0);
      expect(timedOut.events.some(e => e.type === 'time_up')).toBe(true);
    });
  });

  describe('Twin-Critter Co-Op Stage UI components', () => {
    it('renders CoopAllyHud status, combo, quick-gift action, and RESCUE badge when caged', () => {
      const onSendGift = jest.fn();
      const view = render(
        React.createElement(CoopAllyHud, {
          allyFighter: 'Sly Fox',
          allyName: 'Fox',
          allyHearts: 3,
          allyMaxHearts: 4,
          allyCaged: false,
          allyConnected: true,
          allyCombo: 4,
          heroSize: 64,
          giftCharge: 4,
          giftChargeMax: 4,
          onSendGift,
          effects: false,
        })
      );

      expect(view.getByText('Fox')).toBeTruthy();
      expect(view.getByText('3/4')).toBeTruthy();
      expect(view.getByText('×4')).toBeTruthy();
      fireEvent.press(view.getByTestId('coop-send-gift-btn'));
      expect(onSendGift).toHaveBeenCalledWith('wild_card');

      view.rerender(
        React.createElement(CoopAllyHud, {
          allyFighter: 'Sly Fox',
          allyName: 'Fox',
          allyHearts: 0,
          allyMaxHearts: 4,
          allyCaged: true,
          allyRescueProgress: 2,
          allyRescueNeeded: 3,
          allyConnected: true,
          allyCombo: 0,
          heroSize: 64,
          giftCharge: 0,
          giftChargeMax: 4,
          onSendGift,
          effects: false,
        })
      );

      expect(view.getByTestId('coop-ally-rescue-badge')).toBeTruthy();
      expect(view.getByText('RESCUE! 2/3')).toBeTruthy();
      expect(view.queryByTestId('coop-send-gift-btn')).toBeNull();
    });

    it('renders CoopCageOverlay progress text and dispatches cheer emote on tap', () => {
      const onCheer = jest.fn();
      const view = render(
        React.createElement(CoopCageOverlay, {
          visible: true,
          allyName: 'Penguin',
          rescueProgress: 1,
          rescueNeeded: 3,
          effects: false,
          onCheer,
        })
      );

      expect(view.getByTestId('coop-cage-overlay')).toBeTruthy();
      expect(view.getByTestId('coop-cage-progress')).toBeTruthy();
      expect(
        view.getByText('Waiting for Penguin: 1/3 Sets or 1 Parry to break you free!')
      ).toBeTruthy();
      expect(view.getByText('delapouite/bird-cage')).toBeTruthy();

      fireEvent.press(view.getByTestId('coop-cage-cheer-btn'));
      expect(onCheer).toHaveBeenCalledWith('cheer');

      view.rerender(
        React.createElement(CoopCageOverlay, {
          visible: false,
          allyName: 'Penguin',
          rescueProgress: 3,
          rescueNeeded: 3,
          effects: false,
          onCheer,
        })
      );
      expect(view.queryByTestId('coop-cage-overlay')).toBeNull();
    });
  });
});
