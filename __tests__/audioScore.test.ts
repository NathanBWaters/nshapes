/**
 * The adaptive score, without any audio: the theory it runs on, a voice for
 * every weapon and a theme for every evolution, the director (fight state →
 * mix) and the bridge from fight events to cues. docs/sound-design.md.
 */
import { EVENT_CUE, HIT_SIZES, JACKPOT_CHAIN, MAX_CHAIN, alertsOf, hitSize, moodOf, soundsFor, type FightSound } from '@/audio/fightAudio';
import { CUE_NAMES } from '@/audio/band';
import { DIRECTOR, NO_ALERTS, direct, restingMix, worldTone, type FightMood } from '@/audio/director';
import { INSTRUMENTS } from '@/audio/instruments';
import { ARRANGEMENTS, THEME, THEME_B } from '@/audio/songs';
import { themeOf } from '@/audio/themes';
import {
  BRIGHTNESS, MODES, PROGRESSIONS, chordRoot, degreeToMidi, degreeToSemis, hashOf, isMinor, ladderDegree, ladderRung, LADDER_TOP,
  midiToFreq, nextGridTime, parseNote, shade, strum,
} from '@/audio/theory';
import {
  WEAPON_VOICES, evolutionTheme, hasWeaponVoice, ownerOfEvent, recipeIdOf, riffNotes, stingOf, themeSignature, voiceSignature, weaponIdOf, weaponVoice,
} from '@/audio/voices';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { BIOMES } from '@/adventure/data/biomes';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { createMaxedSave } from '@/adventure/progress';
import type { RunEvent, RunEventType } from '@/adventure/types';
import { playSet, startFight, tick, withWeapons } from './testUtils/adventureFight';

const mood = (over: Partial<FightMood> = {}): FightMood => ({
  arrangement: 'meadow', boss: false, status: 'playing', paused: false, hearts: 4, maxHearts: 4, timeLeft: 120, timeTotal: 120,
  foeHp: 1, wave: 0, waves: 1, combo: 0, hotStreak: false, evolutions: [], evolutionEndsMs: Infinity, idleMs: 0, frozen: false,
  weapons: [], alerts: NO_ALERTS, ...over,
});

describe('theory', () => {
  it('every mode is seven different notes inside one octave, starting on the tonic', () => {
    for (const mode of BRIGHTNESS) {
      const notes = MODES[mode];
      expect(notes).toHaveLength(7);
      expect(notes[0]).toBe(0);
      expect([...notes].sort((a, b) => a - b)).toEqual(notes);
      expect(notes[6]).toBeLessThan(12);
    }
  });

  it('modes are ordered brightest to darkest: each one lowers notes of the last, never raises one', () => {
    for (let i = 1; i < BRIGHTNESS.length; i++) {
      const brighter = MODES[BRIGHTNESS[i - 1]];
      const darker = MODES[BRIGHTNESS[i]];
      expect(darker.every((n, d) => n <= brighter[d])).toBe(true);
      expect(darker.some((n, d) => n < brighter[d])).toBe(true);
    }
  });

  it('shade walks the list and stops at the ends', () => {
    expect(shade('ionian', 1)).toBe('mixolydian');
    expect(shade('ionian', -1)).toBe('lydian');
    expect(shade('lydian', -3)).toBe('lydian');
    expect(shade('dorian', 5)).toBe('aeolian');
    expect(isMinor('dorian')).toBe(true);
    expect(isMinor('mixolydian')).toBe(false);
  });

  it('degrees wrap by octaves in both directions', () => {
    expect(degreeToSemis('ionian', 0)).toBe(0);
    expect(degreeToSemis('ionian', 7)).toBe(12);
    expect(degreeToSemis('ionian', 9)).toBe(16);
    expect(degreeToSemis('ionian', -1)).toBe(-1);
    expect(degreeToSemis('aeolian', 2)).toBe(3);
    expect(degreeToMidi('ionian', 0, 0, 4)).toBe(60);
    expect(midiToFreq(69)).toBeCloseTo(440);
  });

  it('no chord of any loop is diminished: every root has a perfect fifth above it in its mode', () => {
    for (const mode of BRIGHTNESS) {
      expect(PROGRESSIONS[mode]).toHaveLength(4);
      for (let bar = 0; bar < 4; bar++) {
        const root = chordRoot(mode, bar);
        expect({ mode, bar, fifth: degreeToSemis(mode, root + 4) - degreeToSemis(mode, root) }).toEqual({ mode, bar, fifth: 7 });
      }
      expect(chordRoot(mode, 0)).toBe(0);
      expect(chordRoot(mode, 4)).toBe(chordRoot(mode, 0));
    }
  });

  it('the tune is written in notes the theory can read', () => {
    for (const tok of [...THEME, ...THEME_B]) {
      if (tok === '-' || tok === '.') continue;
      expect({ tok, parsed: parseNote(tok) !== null }).toEqual({ tok, parsed: true });
    }
    expect(parseNote('E5')).toEqual({ degree: 2, octave: 5 });
  });

  it('the streak ladder only ever climbs, and has no half-step in it', () => {
    for (const mode of BRIGHTNESS) {
      let last = -Infinity;
      for (let rung = 0; rung <= LADDER_TOP + 8; rung++) {
        const semis = degreeToSemis(mode, ladderDegree(mode, rung));
        expect(semis).toBeGreaterThan(last);
        if (last !== -Infinity) expect(semis - last).toBeGreaterThanOrEqual(2);
        last = semis;
      }
    }
    expect(ladderRung(1)).toBe(0);
    expect(ladderRung(4)).toBe(3);
    expect(ladderRung(99)).toBe(LADDER_TOP);
    expect(ladderRung(0)).toBe(0);
  });

  it('a strum is the chord: root, third, fifth, octave', () => {
    expect(strum(3)).toEqual([3, 5, 7, 10]);
  });

  it('cues wait for the next grid line, never an earlier one', () => {
    expect(nextGridTime(1.01, 1, 0.1)).toBeCloseTo(1.1);
    expect(nextGridTime(1.0, 1, 0.1)).toBeCloseTo(1.0);
    expect(nextGridTime(0.73, 1, 0.1)).toBeCloseTo(0.8);
    expect(nextGridTime(5, 1, 0)).toBe(5);
  });

  it('the hash is stable', () => {
    expect(hashOf('blast-powder')).toBe(hashOf('blast-powder'));
    expect(hashOf('blast-powder')).not.toBe(hashOf('flint-spark'));
  });
});

describe('weapon voices', () => {
  const armory = createMaxedSave().armory;

  it('every Armory weapon has a hand-written voice', () => {
    expect(armory.length).toBeGreaterThanOrEqual(60);
    for (const id of armory) expect({ id, voiced: hasWeaponVoice(id) }).toEqual({ id, voiced: true });
  });

  it('every voice belongs to a real weapon', () => {
    for (const id of Object.keys(WEAPON_VOICES)) expect({ id, real: getArmoryWeapon(id) !== undefined }).toEqual({ id, real: true });
  });

  it('every riff is one bar of notes, holds and rests that starts with a sound somewhere', () => {
    for (const [id, v] of Object.entries(WEAPON_VOICES)) {
      expect({ id, riff: v.riff, ok: /^[0-9.\-]{16}$/.test(v.riff) }).toEqual({ id, riff: v.riff, ok: true });
      expect(v.riff[0]).not.toBe('-');
      expect(riffNotes(v.riff).length).toBeGreaterThan(0);
      expect(INSTRUMENTS[v.inst]).toBeDefined();
      expect(v.octave).toBeGreaterThanOrEqual(2);
      expect(v.octave).toBeLessThanOrEqual(6);
      if (v.beat) {
        expect({ id, beat: v.beat, ok: /^[xo.]{16}$/.test(v.beat) }).toEqual({ id, beat: v.beat, ok: true });
        expect(v.drum).toBeDefined();
        if (v.beat.includes('o')) expect(v.drum2).toBeDefined();
      }
      expect(Math.abs(v.pan)).toBeGreaterThan(0.2);
      expect(v.why.length).toBeGreaterThan(10);
    }
  });

  it('no two weapons sound the same', () => {
    const seen = new Map<string, string>();
    for (const [id, v] of Object.entries(WEAPON_VOICES)) {
      const sig = voiceSignature(v);
      expect({ id, sameAs: seen.get(sig) }).toEqual({ id, sameAs: undefined });
      seen.set(sig, id);
    }
  });

  it('riffs lean on the chord: most notes are the root, third, fifth or their octaves', () => {
    const chordTones = new Set([0, 2, 4, 7, 9]);
    for (const [id, v] of Object.entries(WEAPON_VOICES)) {
      const notes = riffNotes(v.riff);
      const inChord = notes.filter(([step]) => chordTones.has(step)).length;
      expect({ id, share: inChord / notes.length >= 0.5 }).toEqual({ id, share: true });
    }
  });

  it('a sting is two to four notes from the riff', () => {
    for (const v of Object.values(WEAPON_VOICES)) {
      const sting = stingOf(v);
      expect(sting.length).toBeGreaterThanOrEqual(2);
      expect(sting.length).toBeLessThanOrEqual(4);
    }
    expect(stingOf(WEAPON_VOICES['prismatic-ray'])).toEqual([0, 2, 4, 7]);
  });

  it('a weapon nobody wrote a voice for still gets a stable one', () => {
    const a = weaponVoice('some-future-weapon');
    expect(a).toBe(weaponVoice('some-future-weapon'));
    expect(/^[0-9.\-]{16}$/.test(a.riff)).toBe(true);
    expect(riffNotes(a.riff).length).toBeGreaterThan(0);
    expect(voiceSignature(a)).not.toBe(voiceSignature(weaponVoice('another-future-weapon')));
  });

  it('reads the weapon or recipe out of a rule key', () => {
    expect(weaponIdOf('w2:war-drum#0')).toBe('war-drum');
    expect(weaponIdOf('w:pinata')).toBe('pinata');
    expect(weaponIdOf('evo:phoenix-pyre#1')).toBeNull();
    expect(weaponIdOf('node:tabby-purr#0')).toBeNull();
    expect(recipeIdOf('evo:phoenix-pyre#1')).toBe('phoenix-pyre');
    expect(recipeIdOf('w2:war-drum#0')).toBeNull();
  });

  it('events with no rule behind them find the held weapon that caused them', () => {
    const held = ['mending-charm', 'blast-powder', 'magnet', 'greedy-chest'];
    expect(ownerOfEvent('blast', undefined, held)).toBe('blast-powder');
    expect(ownerOfEvent('heal', undefined, held)).toBe('mending-charm');
    expect(ownerOfEvent('rule', 'Magnet!', held)).toBe('magnet');
    expect(ownerOfEvent('rule', 'Greedy Chest!', held)).toBe('greedy-chest');
    expect(ownerOfEvent('laser', undefined, held)).toBeNull();
    expect(ownerOfEvent('rule', 'Something else', held)).toBeNull();
  });
});

describe('evolution themes', () => {
  it('every recipe has a theme made from two real weapon voices', () => {
    expect(EVOLUTION_RECIPES.length).toBeGreaterThanOrEqual(200);
    for (const r of EVOLUTION_RECIPES) {
      const t = themeOf(r.id);
      expect(t.weapons).toHaveLength(2);
      for (const id of t.weapons) expect({ recipe: r.id, id, voiced: hasWeaponVoice(id) }).toEqual({ recipe: r.id, id, voiced: true });
      expect(t.weapons[0]).not.toBe(t.weapons[1]);
      expect(t.fanfare.length).toBeGreaterThanOrEqual(5);
      expect(t.lift).toBeGreaterThanOrEqual(2);
      expect(t.lift).toBeLessThanOrEqual(7);
      expect(t.brighten).toBeGreaterThanOrEqual(1);
      // The fanfare ends on its highest note
      expect(t.fanfare[t.fanfare.length - 1]).toBeGreaterThanOrEqual(7);
    }
  });

  it('no two recipes have the same theme', () => {
    const seen = new Map<string, string>();
    for (const r of EVOLUTION_RECIPES) {
      const sig = `${themeSignature(themeOf(r.id))}|${themeOf(r.id).weapons.join('+')}`;
      expect({ id: r.id, sameAs: seen.get(sig) }).toEqual({ id: r.id, sameAs: undefined });
      seen.set(sig, r.id);
    }
  });

  it('a theme is the same every time and an unknown recipe still gets one', () => {
    const r = EVOLUTION_RECIPES[0];
    expect(evolutionTheme(r.id, r.families)).toEqual(themeOf(r.id));
    expect(themeOf('not-a-recipe').fanfare.length).toBeGreaterThan(0);
  });
});

describe('the director', () => {
  it('every world and every arrangement has a home key and mode', () => {
    for (const name of Object.keys(ARRANGEMENTS)) expect(worldTone(name).mode).toBeDefined();
    for (const b of Object.values(BIOMES)) expect({ music: b.music, known: b.music in ARRANGEMENTS }).toEqual({ music: b.music, known: true });
    expect(restingMix('map').lead).toBe(true);
    // Walking from the map into any fight never changes key
    for (const name of Object.keys(ARRANGEMENTS)) expect({ name, key: worldTone(name).key }).toEqual({ name, key: worldTone('map').key });
  });

  it('losing hearts turns the tune darker, and the last heart adds a heartbeat and muffles the band', () => {
    const full = direct(mood());
    const half = direct(mood({ hearts: 2 }));
    const last = direct(mood({ hearts: 1 }));
    expect(full.mode).toBe('ionian');
    expect(half.mode).toBe('mixolydian');
    expect(last.mode).toBe('dorian');
    expect(full.heartbeat).toBe(false);
    expect(half.heartbeat).toBe(false);
    expect(last.heartbeat).toBe(true);
    expect(last.filterHz).toBeLessThan(full.filterHz);
  });

  it('a level with no hearts, or a single heart from the start, never sounds like danger', () => {
    expect(direct(mood({ hearts: null, maxHearts: null })).heartbeat).toBe(false);
    expect(direct(mood({ hearts: null, maxHearts: null })).mode).toBe('ionian');
    expect(direct(mood({ hearts: 1, maxHearts: 1 })).heartbeat).toBe(false);
  });

  it('the clock ticks when time is short, races at the end, and speeds the band up', () => {
    const plenty = direct(mood({ timeLeft: 100 }));
    const short = direct(mood({ timeLeft: 18 }));
    const racing = direct(mood({ timeLeft: 5 }));
    expect([plenty.clock, short.clock, racing.clock]).toEqual([0, 1, 2]);
    expect(short.tempo).toBeGreaterThan(plenty.tempo);
    expect(racing.tempo).toBeGreaterThan(short.tempo);
    expect(direct(mood({ timeLeft: null, timeTotal: null })).clock).toBe(0);
    // A short level does not tick from the first second
    expect(direct(mood({ timeLeft: 30, timeTotal: 30 })).clock).toBe(0);
  });

  it('the band fills in as the foe falls and the streak grows', () => {
    const start = direct(mood({ weapons: ['magnet'] }));
    const mid = direct(mood({ foeHp: 0.5, combo: 3, weapons: ['magnet'] }));
    const end = direct(mood({ foeHp: 0.1, combo: 6, weapons: ['magnet'] }));
    expect(mid.intensity).toBeGreaterThan(start.intensity);
    expect(end.intensity).toBeGreaterThan(mid.intensity);
    expect(end.drums).toBeGreaterThanOrEqual(mid.drums);
    expect(mid.drums).toBeGreaterThanOrEqual(start.drums);
    expect(end.counter).toBe(true);
    expect(start.counter).toBe(false);
    expect(end.finisher).toBe(true);
    expect(mid.finisher).toBe(false);
    expect(direct(mood({ foeHp: 0 })).finisher).toBe(false);
  });

  it('a streak speeds the band up, up to a cap', () => {
    expect(direct(mood({ combo: 3 })).tempo).toBeGreaterThan(direct(mood({ combo: 1 })).tempo);
    expect(direct(mood({ combo: 50 })).tempo).toBeCloseTo(1 + DIRECTOR.comboTempoCap);
    expect(direct(mood({ combo: 50, timeLeft: 3, hotStreak: true, evolutions: ['x'] })).tempo).toBeLessThanOrEqual(DIRECTOR.maxTempo);
  });

  it('the band thins out when the player has not made a Set, then the tune drops out', () => {
    const active = direct(mood({ foeHp: 0.6, weapons: ['magnet', 'rust'] }));
    const thin = direct(mood({ foeHp: 0.6, idleMs: DIRECTOR.idleThinMs, weapons: ['magnet', 'rust'] }));
    const quiet = direct(mood({ foeHp: 0.6, idleMs: DIRECTOR.idleQuietMs, weapons: ['magnet', 'rust'] }));
    expect(thin.intensity).toBeLessThan(active.intensity);
    expect(quiet.intensity).toBeLessThan(thin.intensity);
    expect([active.lead, thin.lead, quiet.lead]).toEqual([true, true, false]);
    expect(quiet.spotlights).toBe(1);
  });

  it('an evolution lifts the key by its theme, brightens the mode and drives the drums', () => {
    const before = direct(mood({ foeHp: 0.6 }), () => ({ lift: 4, brighten: 1 }));
    const during = direct(mood({ foeHp: 0.6, evolutions: ['a'], evolutionEndsMs: 20000 }), () => ({ lift: 4, brighten: 1 }));
    const two = direct(mood({ foeHp: 0.6, evolutions: ['a', 'b'], evolutionEndsMs: 20000 }), () => ({ lift: 4, brighten: 1 }));
    expect(before.lift).toBe(0);
    expect(during.lift).toBe(4);
    expect(two.lift).toBe(5);
    expect(during.mode).toBe('lydian');
    expect(during.drums).toBe(3);
    expect(during.tempo).toBeGreaterThan(before.tempo);
    expect(during.evolutionFading).toBe(false);
    expect(direct(mood({ evolutions: ['a'], evolutionEndsMs: 3000 })).evolutionFading).toBe(true);
    // An evolution on your last heart is still brighter than no evolution on your last heart
    const hurt = direct(mood({ hearts: 1 }));
    const hurtEvolved = direct(mood({ hearts: 1, evolutions: ['a'], evolutionEndsMs: 20000 }));
    expect(BRIGHTNESS.indexOf(hurtEvolved.mode)).toBeLessThan(BRIGHTNESS.indexOf(hurt.mode));
  });

  it('each wave is a semitone higher, up to two', () => {
    expect(direct(mood({ wave: 1, waves: 4 })).lift).toBe(1);
    expect(direct(mood({ wave: 3, waves: 4 })).lift).toBe(2);
  });

  it('picks, the shop and pause slow and muffle the music; the warnings stop', () => {
    const alerts = { ...NO_ALERTS, cursed: 2, potatoSoon: true };
    const playing = direct(mood({ alerts, weapons: ['magnet'] }));
    const pick = direct(mood({ status: 'pick', alerts, weapons: ['magnet'], timeLeft: 3, hearts: 1 }));
    const paused = direct(mood({ paused: true, alerts, weapons: ['magnet'] }));
    expect(playing.alerts.cursed).toBe(2);
    expect(pick.lounge).toBe(true);
    expect(pick.tempo).toBeLessThan(1);
    expect(pick.filterHz).toBeLessThan(playing.filterHz);
    expect(pick.clock).toBe(0);
    expect(pick.heartbeat).toBe(false);
    expect(pick.alerts).toEqual(NO_ALERTS);
    expect(paused.filterHz).toBeLessThan(pick.filterHz);
    expect(paused.level).toBeLessThan(1);
    expect(paused.drums).toBe(0);
  });

  it('Deep Freeze stops the drums and the tune and slows everything down', () => {
    const frozen = direct(mood({ frozen: true }));
    expect(frozen.frozen).toBe(true);
    expect(frozen.drums).toBe(0);
    expect(frozen.lead).toBe(false);
    expect(frozen.pad).toBe(true);
    expect(frozen.tempo).toBeLessThan(0.8);
  });

  it('weapon riffs take turns: nobody with no weapons, more of them as the fight heats up', () => {
    expect(direct(mood()).spotlights).toBe(0);
    expect(direct(mood({ weapons: ['magnet', 'rust', 'decoy'] })).spotlights).toBe(2);
    expect(direct(mood({ weapons: ['magnet', 'rust', 'decoy'], foeHp: 0.1, combo: 5 })).spotlights).toBe(3);
  });
});

describe('fight events → sounds', () => {
  const ev = (type: RunEventType, amount?: number, text?: string, source?: string): RunEvent => ({ id: 1, type, amount, text, source });
  const names = (sounds: FightSound[]) => sounds.map(s => (s.kind === 'cue' ? s.name : s.kind === 'sting' ? `sting:${s.weapon}` : `payout:${s.tier}`));

  it('every event has a row, and every row names a real cue', () => {
    for (const cue of Object.values(EVENT_CUE)) if (cue) expect(CUE_NAMES).toContain(cue);
    expect(Object.keys(EVENT_CUE).length).toBeGreaterThan(50);
  });

  it("a Set's own hit is the payout, sized by everything the move dealt", () => {
    expect(names(soundsFor([ev('hit', 3)], { weapons: [], combo: 1 }))).toEqual(['payout:0']);
    expect(names(soundsFor([ev('hit', 6), ev('blast', 5)], { weapons: [], combo: 2 }))).toEqual(['payout:1', 'blast']);
    expect(hitSize(HIT_SIZES[0] - 1)).toBe(0);
    expect(hitSize(HIT_SIZES[1])).toBe(2);
    expect(hitSize(HIT_SIZES[2] + 100)).toBe(3);
    const big = soundsFor([ev('hit', 60)], { weapons: [], combo: 7 })[0];
    expect(big).toEqual({ kind: 'payout', combo: 7, tier: 3, rainbow: false });
  });

  it('a Rainbow Set rings through the payout instead of twice', () => {
    const sounds = soundsFor([ev('hit', 5), ev('rainbow', 12)], { weapons: [], combo: 1 });
    expect(sounds).toEqual([{ kind: 'payout', combo: 1, tier: 1, rainbow: true }]);
  });

  it('what a move sets off plays as a chain: each effect one slot later', () => {
    const sounds = soundsFor([ev('hit', 4), ev('coins', 3), ev('blast', 4), ev('heal', 1)], { weapons: [], combo: 1 });
    expect(names(sounds)).toEqual(['payout:0', 'coins', 'blast', 'heal']);
    const slots = sounds.filter(s => s.kind === 'cue').map(s => (s.kind === 'cue' ? s.slot : -1));
    expect(slots).toEqual([2, 3, 4]);
  });

  it('a weapon speaks for itself: a rule from a weapon plays its sting, once per move', () => {
    const sounds = soundsFor(
      [ev('hit', 4), ev('rule', 3, 'Third Eye!', 'w1:mystic-sight#0'), ev('hit', 3, 'Echo', 'w1:mystic-sight#0'), ev('rule', 5, 'Magnet!')],
      { weapons: ['mystic-sight', 'magnet'], combo: 1 }
    );
    expect(names(sounds)).toEqual(['payout:0', 'sting:mystic-sight', 'sting:magnet']);
  });

  it('a blast with Blast Powder held is the boom and then the weapon', () => {
    const sounds = soundsFor([ev('hit', 4), ev('blast', 6)], { weapons: ['blast-powder'], combo: 1 });
    expect(names(sounds)).toEqual(['payout:1', 'blast', 'sting:blast-powder']);
  });

  it('a long chain ends on the cash register, and a huge one is capped', () => {
    const chain = [ev('hit', 4), ...Array.from({ length: JACKPOT_CHAIN }, (_, i) => ev('rule', 1, `Thing ${i}`))];
    expect(names(soundsFor(chain, { weapons: [], combo: 1 })).pop()).toBe('register');
    const short = [ev('hit', 4), ...Array.from({ length: JACKPOT_CHAIN - 1 }, (_, i) => ev('rule', 1, `Thing ${i}`))];
    expect(names(soundsFor(short, { weapons: [], combo: 1 }))).not.toContain('register');
    const huge = [ev('hit', 4), ...Array.from({ length: 40 }, (_, i) => ev('rule', 1, `Thing ${i}`))];
    expect(soundsFor(huge, { weapons: [], combo: 1 }).length).toBeLessThanOrEqual(MAX_CHAIN + 1);
  });

  it('a trick weapon going wrong sounds sour, not like a win, and its weapon stays quiet', () => {
    const held = ['tightrope', 'glass-sword', 'rust'];
    expect(names(soundsFor([ev('hit', 2), ev('rule', 0.5, 'Off the rope')], { weapons: held, combo: 1 }))).toEqual(['payout:0', 'sour']);
    expect(names(soundsFor([ev('rule', undefined, 'Glass Sword shattered (too slow)')], { weapons: held, combo: 0 }))).toEqual(['sour']);
    expect(names(soundsFor([ev('hit', 2), ev('rule', -3, 'Rust')], { weapons: held, combo: 1 }))).toEqual(['payout:0', 'sour']);
    expect(names(soundsFor([ev('hit', 2), ev('rule', 4, 'Tightrope')], { weapons: held, combo: 1 }))).toEqual(['payout:0', 'sting:tightrope']);
  });

  it('things that happen on their own (a foe move, a mistake) sound without a payout', () => {
    expect(names(soundsFor([ev('mistake'), ev('hurt', 1)], { weapons: [], combo: 0 }))).toEqual(['mistake', 'hurt']);
    expect(names(soundsFor([ev('shuffle')], { weapons: [], combo: 0 }))).toEqual(['foeShuffle']);
    expect(soundsFor([ev('combo', 3), ev('evolution_start', undefined, 'x')], { weapons: [], combo: 3 })).toEqual([]);
  });
});

describe('the fight the band hears', () => {
  it('reads the mood from a real fight', () => {
    const s = startFight();
    const m = moodOf(s, { arrangement: 'woods', paused: false, timeTotal: s.timeLeft });
    expect(m.arrangement).toBe('woods');
    expect(m.status).toBe('playing');
    expect(m.foeHp).toBe(1);
    expect(m.combo).toBe(0);
    expect(m.evolutions).toEqual([]);
    expect(m.alerts).toEqual(NO_ALERTS);
    expect(m.weapons).toEqual(s.weapons.map(w => w.id));
  });

  it('a Set raises the combo, lowers the foe and resets the idle clock', () => {
    let s = tick({ ...startFight(), foeHp: 200, foeMaxHp: 200 }, 6000);
    const before = moodOf(s, { arrangement: 'meadow', paused: false, timeTotal: s.timeLeft });
    s = playSet(s);
    const after = moodOf(s, { arrangement: 'meadow', paused: false, timeTotal: s.timeLeft });
    expect(before.idleMs).toBeGreaterThan(4000);
    expect(after.idleMs).toBeLessThan(before.idleMs);
    expect(after.combo).toBeGreaterThan(before.combo);
    expect(after.foeHp).toBeLessThan(before.foeHp);
  });

  it('events carry the rule that caused them, so the band can name the weapon', () => {
    const drum = getArmoryWeapon('war-drum')!;
    let s = withWeapons({ ...startFight(), foeHp: 500, foeMaxHp: 500 }, drum);
    for (let i = 0; i < 6; i++) s = playSet(s);
    const sourced = s.events.filter(e => e.source);
    expect(sourced.length).toBeGreaterThan(0);
    for (const e of sourced) expect(typeof e.source).toBe('string');
  });

  it('hears what is on the board', () => {
    const s = startFight();
    const board = s.board.map((c, i) =>
      i === 0 ? { ...c, cursedUntil: s.elapsedMs + 5000, locked: true } : i === 1 ? { ...c, fuseHot: true, fuseAt: s.elapsedMs + 2000 } : i === 2 ? { ...c, thornAt: s.elapsedMs + 3000 } : c
    );
    const alerts = alertsOf({ ...s, board });
    expect(alerts.cursed).toBe(1);
    expect(alerts.fuseHot).toBe(1);
    expect(alerts.thornSoon).toBe(true);
    expect(alerts.potatoSoon).toBe(false);
    expect(alertsOf({ ...s, board: s.board.map((c, i) => (i === 0 ? { ...c, thornAt: s.elapsedMs + 60000 } : c)) }).thornSoon).toBe(false);
  });
});
