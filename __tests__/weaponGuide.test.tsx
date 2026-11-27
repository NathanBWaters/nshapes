/**
 * The weapon guide is the one place a weapon is explained (before a fight in
 * the level preview, in Camp Armory, after a fight in the replay, and across
 * Starfall Summit). These tests are the guard: a new Armory weapon with no
 * guide row, no description, no synergy hooks, no voice, or fewer than 3
 * evolutions fails here, and the single WeaponExplainer card is rendered for
 * every weapon there is.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { WEAPON_EVOLUTIONS, evolutionsForWeapon, evolutionShortVerb } from '@/adventure/data/evolutions';
import { getWeaponSynergyProfile } from '@/adventure/data/synergy';
import { describeLines, fightSummary, gearStatText, gearStats, weaponOfLine } from '@/adventure/components/fightReplayText';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { WEAPON_GUIDE, WEAPON_KINDS, hasWeaponGuide, ownerOfEvent, weaponGuide } from '@/adventure/data/weaponGuide';
import { hasWeaponRole } from '@/adventure/data/weaponRoles';
import { hasWeaponVoice } from '@/audio/voices';
import { createMaxedSave, weaponBuilds } from '@/adventure/progress';
import type { FightLogEntry, FightLogLine } from '@/adventure/types';
import { playSet, startFight, withWeapons } from './testUtils/adventureFight';

jest.mock('@/audio', () => {
  const band = { audition: jest.fn(), auditionEvolution: jest.fn(), inFight: false };
  return { band, music: band, sfx: jest.fn() };
});

jest.mock('@/components/Icon', () => {
  const { Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});

const save = createMaxedSave();
const armory = save.armory;

describe('the weapon guide covers every weapon', () => {
  it('every Armory weapon has a guide row, a role, a voice, synergy hooks, 3 evolutions, and clean description (zero Catalyst/Power leaks)', () => {
    expect(armory).toHaveLength(64);
    expect(WEAPON_EVOLUTIONS).toHaveLength(192);
    for (const id of armory) {
      const w = getArmoryWeapon(id, weaponBuilds(save));
      const profile = getWeaponSynergyProfile(id);
      const evos = evolutionsForWeapon(id);
      expect({
        id,
        guide: hasWeaponGuide(id),
        role: hasWeaponRole(id),
        voice: hasWeaponVoice(id),
        synergyHooks: profile.hooks.length >= 1,
        evoCount: evos.length,
      }).toEqual({
        id,
        guide: true,
        role: true,
        voice: true,
        synergyHooks: true,
        evoCount: 3,
      });
      const desc = w?.description ?? '';
      expect({ id, described: desc.length >= 20 }).toEqual({ id, described: true });
      // Ensure zero stale Catalyst card or global Power-meter copy leaks
      expect(desc).not.toMatch(/Catalyst card|\+\d+(\.\d+)? Power/i);
      expect(weaponGuide(id).tip).not.toMatch(/Catalyst card|\+\d+(\.\d+)? Power/i);
    }
  });

  it('every guide row belongs to a real weapon', () => {
    for (const id of Object.keys(WEAPON_GUIDE)) expect({ id, real: getArmoryWeapon(id) !== undefined }).toEqual({ id, real: true });
  });

  it('every row says when the weapon works and how to play it, in a sentence', () => {
    for (const [id, g] of Object.entries(WEAPON_GUIDE)) {
      expect(WEAPON_KINDS[g.kind]).toBeDefined();
      expect({ id, tip: g.tip.length >= 25 && /[.!?]$/.test(g.tip) }).toEqual({ id, tip: true });
      if (g.look) expect({ id, look: g.look.text.length >= 15 }).toEqual({ id, look: true });
    }
  });

  it('a weapon with no row is explained without crashing (and the first test catches it)', () => {
    expect(weaponGuide('not-a-weapon')).toEqual({ kind: 'always', tip: '' });
  });

  it('no two weapons claim the same callout', () => {
    const seen = new Map<string, string>();
    for (const [id, g] of Object.entries(WEAPON_GUIDE)) {
      for (const call of g.calls ?? []) {
        expect({ call, id, also: seen.get(call) }).toEqual({ call, id, also: undefined });
        seen.set(call, id);
      }
    }
  });

  it('finds the weapon behind an event that has no rule', () => {
    const held = ['mending-charm', 'blast-powder', 'magnet'];
    expect(ownerOfEvent('blast', undefined, held)).toBe('blast-powder');
    expect(ownerOfEvent('rule', 'Magnet!', held)).toBe('magnet');
    expect(ownerOfEvent('laser', undefined, held)).toBeNull();
  });
});

describe('the explainer card', () => {
  it('renders for every weapon in the game, closed and open, with Synergy chips and Evolutions', () => {
    for (const id of armory) {
      const w = getArmoryWeapon(id, weaponBuilds(save))!;
      const view = render(<WeaponExplainer weapon={w} build={weaponBuilds(save)[id]} />);
      expect(view.getByTestId(`weapon-explainer-what-${id}`).props.children).toBe(w.description);
      expect(view.getByTestId(`weapon-explainer-synergy-${id}`)).toBeTruthy();
      expect(view.getByTestId(`weapon-explainer-evo-summary-${id}`)).toBeTruthy();
      expect(view.queryByTestId(`weapon-explainer-more-${id}`)).toBeNull();
      fireEvent.press(view.getByTestId(`weapon-explainer-toggle-${id}`));
      expect(view.getByTestId(`weapon-explainer-more-${id}`)).toBeTruthy();
      expect(view.getByText(weaponGuide(id).tip, { exact: false })).toBeTruthy();
      view.unmount();
    }
  });

  it('shows what the weapon did after a fight', () => {
    const w = getArmoryWeapon('blast-powder')!;
    const view = render(<WeaponExplainer weapon={w} result={{ text: 'Fired 3 times · 12 damage (20% of the fight).', share: 0.2 }} />);
    expect(view.getByTestId('weapon-explainer-result-blast-powder')).toBeTruthy();
    expect(view.getByText('Fired 3 times · 12 damage (20% of the fight).')).toBeTruthy();
  });

  it('plays the weapon when you ask to hear it', () => {
    const { band } = jest.requireMock('@/audio');
    const w = getArmoryWeapon('magnet')!;
    const view = render(<WeaponExplainer weapon={w} defaultOpen />);
    fireEvent.press(view.getByTestId('weapon-explainer-sound-magnet'));
    expect(band.audition).toHaveBeenCalledWith('magnet');
  });

  it('[TP-10] renders [Parameter] bracket accessibility labels and clean integer stats', () => {
    const w = getArmoryWeapon('life-vessel', { 'life-vessel': { level: 3, tuning: { maxHealth: 2 } } })!;
    const view = render(<WeaponExplainer weapon={w} build={{ level: 3, tuning: { maxHealth: 2 } }} defaultOpen />);
    expect(view.getByLabelText('[Extra hearts] 3')).toBeTruthy();
    expect(view.getByText('T2')).toBeTruthy();
  });

  it('[TP-10] displays clean [Parameter] stats alongside Synergy Scaling hooks (zero Power scaling text)', () => {
    const build = { level: 3, tuning: {} };
    const w = getArmoryWeapon('blast-powder', { 'blast-powder': build })!;
    const view = render(<WeaponExplainer weapon={w} build={build} defaultOpen />);
    expect(view.getByLabelText('[Blast chance] 26%')).toBeTruthy();
    expect(view.getByTestId('weapon-explainer-scaling-blast-powder')).toBeTruthy();
    expect(view.getByText('SYNERGY SCALING')).toBeTruthy();
    expect(view.queryByText(/Power \(Lv/i)).toBeNull();
  });

  it('supports 1-of-3 Evolution selection (1-tap equip, audition motif, locked bounty jump) and read-only live inspect', () => {
    const { band } = jest.requireMock('@/audio');
    band.auditionEvolution.mockClear();

    const w = getArmoryWeapon('blast-powder')!;
    const [evoA, evoB, evoC] = evolutionsForWeapon('blast-powder');
    const onSelectEvolution = jest.fn();
    const onJumpToBounty = jest.fn();

    // Every evolution shortVerb fits compact HUD copy budget
    for (const evo of WEAPON_EVOLUTIONS) {
      expect(evolutionShortVerb(evo).length).toBeLessThanOrEqual(58);
    }

    const selectView = render(
      <WeaponExplainer
        weapon={w}
        evolutionMode="select"
        showEvolutionsWhenClosed
        equippedEvolutionId={evoA.id}
        unlockedEvolutionIds={[evoA.id, evoB.id]}
        onSelectEvolution={onSelectEvolution}
        onJumpToBounty={onJumpToBounty}
      />
    );
    expect(selectView.getByTestId('weapon-explainer-evo-selector-blast-powder')).toBeTruthy();
    expect(selectView.getByTestId(`evo-active-${evoA.id}`)).toBeTruthy();
    fireEvent.press(selectView.getByTestId(`evo-option-${evoB.id}`));
    expect(onSelectEvolution).toHaveBeenCalledWith('blast-powder', evoB.id);
    expect(band.auditionEvolution).toHaveBeenCalledWith(evoB.id);

    fireEvent.press(selectView.getByTestId(`evo-bounty-jump-${evoC.id}`));
    expect(onJumpToBounty).toHaveBeenCalledTimes(1);
    selectView.unmount();

    // Read-only live inspect mode shows live progress without interactive switcher
    const liveView = render(
      <WeaponExplainer
        weapon={w}
        evolutionMode="live"
        liveEvolution={{
          weaponId: 'blast-powder',
          evolutionId: evoA.id,
          evolutionName: evoA.name,
          icon: evoA.icon,
          accent: evoA.accent,
          phase: 'charging',
          conditionShort: '3 Blasts',
          conditionFull: evoA.conditionText,
          effectText: evolutionShortVerb(evoA),
          progress: 2,
          target: 3,
          almostReady: true,
          activeRemainingMs: 0,
          activeDurationMs: evoA.durationMs,
          cooldownRemainingMs: 0,
          triggersThisFight: 0,
        }}
      />
    );
    expect(liveView.getByTestId('weapon-explainer-live-evo-blast-powder')).toBeTruthy();
    expect(liveView.getByText('ALMOST! 2/3')).toBeTruthy();
    expect(liveView.queryByTestId('weapon-explainer-evo-selector-blast-powder')).toBeNull();
    liveView.unmount();
  });
});

describe('what each weapon did in a fight', () => {
  const line = (over: Partial<FightLogLine>): FightLogLine => ({ type: 'rule', ...over });
  const entry = (lines: FightLogLine[]): FightLogEntry =>
    ({ t: 0, wave: 0, kind: 'set', damage: 0, setDamage: 0, coins: 0, xp: 0, hearts: 3, heartsDelta: 0, foeHp: 1, foeMaxHp: 1, lines });

  it('credits a line to the rule that caused it, or to the held weapon that owns that kind of event', () => {
    const held = ['blast-powder', 'magnet'];
    expect(weaponOfLine(line({ type: 'hit', sourceRef: 'weapon:war-drum' }), held)).toBe('war-drum');
    expect(weaponOfLine(line({ type: 'blast', amount: 4 }), held)).toBe('blast-powder');
    expect(weaponOfLine(line({ text: 'Magnet!', amount: 5 }), held)).toBe('magnet');
    expect(weaponOfLine(line({ type: 'hit', sourceRef: 'evo:blast-powder:cluster-charge' }), held)).toBeNull();
    expect(weaponOfLine(line({ type: 'heal' }), held)).toBeNull();
  });

  it('counts firings once per move and adds up damage', () => {
    const held = ['blast-powder', 'magnet', 'cursed-idol'];
    const stats = gearStats([
      entry([line({ type: 'blast', amount: 4 }), line({ type: 'blast', amount: 2 }), line({ text: 'Magnet!', amount: 5 })]),
      entry([line({ type: 'blast', amount: 3 }), line({ type: 'hit', amount: 7, source: 'Cluster Charge', sourceRef: 'evo:blast-powder:cluster-charge' })]),
      entry([line({ text: 'Curse broken ×1.35', amount: 1.35 })]),
    ], held);
    expect(stats['weapon:blast-powder']).toEqual({ fired: 2, damage: 9 });
    expect(stats['weapon:magnet']).toEqual({ fired: 1, damage: 5 });
    expect(stats['evo:blast-powder:cluster-charge']).toEqual({ fired: 1, damage: 7 });
    // A multiplier is not damage
    expect(stats['weapon:cursed-idol']).toEqual({ fired: 1, damage: 0 });
  });

  it('says it in words', () => {
    expect(gearStatText({ fired: 6, damage: 48 }, 240, 'other')).toBe('Fired 6 times · 48 damage (20% of the fight).');
    expect(gearStatText({ fired: 1, damage: 0 }, 240, 'other')).toBe('Fired 1 time.');
    expect(gearStatText(undefined, 240, 'other')).toBe('Did not fire this fight.');
    expect(gearStatText(undefined, 240, 'always')).toBe('Always on: its bonus is inside your Set hits.');
    expect(fightSummary({ totalDamage: 200, ms: 92000, sets: 14, mistakes: 1, setDamage: 120, best: { name: 'Blast Powder', damage: 40 } }))
      .toBe('You dealt 200 damage in 1:32, with 14 Sets and 1 mistake. 60% came from your Sets and 40% from what they set off. Blast Powder did the most: 40 damage.');
  });

  it('replay lines name the weapon behind a blast so it can be opened and explained', () => {
    const lines = describeLines([line({ type: 'blast', amount: 4 })], ['blast-powder']);
    expect(lines[0].sourceRef).toBe('weapon:blast-powder');
    expect(describeLines([line({ type: 'blast', amount: 4 })])[0].sourceRef).toBeUndefined();
  });

  it('a real fight log carries a ref for every rule source', () => {
    let s = withWeapons({ ...startFight(), foeHp: 500, foeMaxHp: 500 }, getArmoryWeapon('war-drum')!, getArmoryWeapon('mystic-sight')!);
    for (let i = 0; i < 8; i++) s = playSet(s);
    const sourced = s.log.flatMap(e => e.lines).filter(l => l.source);
    expect(sourced.length).toBeGreaterThan(0);
    for (const l of sourced) expect(l.sourceRef).toMatch(/^(weapon|node|evo):/);
    const stats = gearStats(s.log, s.weapons.map(w => w.id));
    expect(Object.keys(stats).some(ref => ref.startsWith('weapon:'))).toBe(true);
  });
});
