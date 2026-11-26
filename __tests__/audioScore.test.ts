/**
 * The adaptive score, without any audio: the theory it runs on, a voice for
 * every weapon and a theme for every evolution, the director (fight state →
 * mix) and the bridge from fight events to cues. docs/sound-design.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Platform } from 'react-native';
import { EVENT_CUE, HIT_SIZES, JACKPOT_CHAIN, MAX_CHAIN, alertsOf, hitSize, moodOf, soundsFor, type FightSound } from '@/audio/fightAudio';
import { band, CUE_NAMES } from '@/audio/band';
import { chip, foldFreq, makeSoftClipCurve, MASTER_BUS, MAX_OSC_FREQ_HZ, SOFT_CLIP_CEILING } from '@/audio/chip';
import { DIRECTOR, NO_ALERTS, direct, restingMix, worldTone, type FightMood } from '@/audio/director';
import { DRUMS, INSTRUMENTS, subDrop } from '@/audio/instruments';
import {
  __setNativeAudioForTests,
  CUE_TO_NATIVE,
  NATIVE_CUE_ASSETS,
  NATIVE_LOOP_ASSETS,
  nativeBridge,
  resolveCueKey,
  resolveNativeLoop,
  resolveWeaponStingKey,
  type NativeAudioModule,
  type NativeSoundHandle,
} from '@/audio/nativeBridge';
import { audioFlags } from '@/audio/settings';
import { ARRANGEMENTS, THEME, THEME_B } from '@/audio/songs';
import { themeOf } from '@/audio/themes';
import {
  BRIGHTNESS, MODES, PROGRESSIONS, chordRoot, degreeToMidi, degreeToSemis, hashOf, isMinor, ladderDegree, ladderRung, LADDER_TOP,
  midiToFreq, nextGridTime, parseNote, shade, strum,
} from '@/audio/theory';
import {
  WEAPON_VOICES, evolutionTheme, hasWeaponVoice, recipeIdOf, riffNotes, stingOf, themeSignature, voiceSignature, weaponIdOf, weaponVoice,
} from '@/audio/voices';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { ownerOfEvent } from '@/adventure/data/weaponGuide';
import { BIOMES } from '@/adventure/data/biomes';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { createMaxedSave } from '@/adventure/progress';
import type { RunEvent, RunEventType } from '@/adventure/types';
import { __setAppActiveForTests } from '@/utils/appLifecycle';
import { MusicStorage, SettingsStorage, SoundStorage, storage } from '@/utils/storage';
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

  it('the band thins out gradually when the player has not made a Set, softening lead & highs before resting', () => {
    const active = direct(mood({ foeHp: 0.6, weapons: ['magnet', 'rust'] }));
    const early = direct(mood({ foeHp: 0.6, idleMs: DIRECTOR.idleStartMs + 2000, weapons: ['magnet', 'rust'] }));
    const thin = direct(mood({ foeHp: 0.6, idleMs: DIRECTOR.idleThinMs, weapons: ['magnet', 'rust'] }));
    const midFade = direct(mood({ foeHp: 0.6, idleMs: (DIRECTOR.idleThinMs + DIRECTOR.idleQuietMs) / 2, weapons: ['magnet', 'rust'] }));
    const quiet = direct(mood({ foeHp: 0.6, idleMs: DIRECTOR.idleQuietMs, weapons: ['magnet', 'rust'] }));
    // Continuous smooth monotonic descent rather than sharp cliffs
    expect(early.intensity).toBeLessThan(active.intensity);
    expect(thin.intensity).toBeLessThan(early.intensity);
    expect(midFade.intensity).toBeLessThan(thin.intensity);
    expect(quiet.intensity).toBeLessThan(midFade.intensity);
    expect(midFade.leadGain).toBeGreaterThan(0);
    expect(midFade.leadGain).toBeLessThan(thin.leadGain);
    expect(quiet.leadGain).toBe(0);
    expect(midFade.filterHz).toBeLessThan(active.filterHz);
    expect(quiet.filterHz).toBeLessThan(midFade.filterHz);
    expect(quiet.level).toBeLessThan(active.level);
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

  it('registers slow-mo defeat, Angry Birds star stamp, and damage story crescendo cues safely without Web Audio', () => {
    expect(CUE_NAMES).toContain('slowMoDefeat');
    expect(CUE_NAMES).toContain('starSwoosh');
    expect(CUE_NAMES).toContain('star');
    expect(CUE_NAMES).toContain('rankSeal');
    expect(CUE_NAMES).toContain('storyClimax');
    expect(() => band.slowMoDefeat({ boss: true, perfectParry: true })).not.toThrow();
    expect(() => band.storyBeat({ weaponId: 'war-drum', step: 0, totalSteps: 5 })).not.toThrow();
    expect(() => band.storyBeat({ step: 4, totalSteps: 5 })).not.toThrow();
    expect(() => band.finale(true)).not.toThrow();
  });
});

// ─── [AU-01] .ogg -> .m4a Asset Migration & iOS Compatibility ───────────────

describe('[AU-01] AAC .m4a sound assets (zero .ogg remaining)', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const soundsDir = path.join(repoRoot, 'assets', 'sounds');

  const walkFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...walkFiles(full));
      else out.push(full);
    }
    return out;
  };

  it('contains zero .ogg or uncompressed .wav files anywhere under assets/sounds/', () => {
    const all = walkFiles(soundsDir);
    const oggs = all.filter(f => f.toLowerCase().endsWith('.ogg'));
    const wavs = all.filter(f => f.toLowerCase().endsWith('.wav'));
    const m4as = all.filter(f => f.toLowerCase().endsWith('.m4a'));
    expect(oggs).toEqual([]);
    expect(wavs).toEqual([]);
    expect(m4as.length).toBeGreaterThanOrEqual(26);
    for (const file of m4as) {
      expect(fs.statSync(file).size).toBeGreaterThan(100);
    }
  });

  it('has zero .ogg or .wav references in src/utils/sounds.ts and every required asset exists', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src', 'utils', 'sounds.ts'), 'utf8');
    expect(src).not.toMatch(/\.ogg\b/i);
    expect(src).not.toMatch(/\.wav\b/i);
    const matches = [...src.matchAll(/require\(['"]\.\.\/\.\.\/(assets\/sounds\/[^'"]+)['"]\)/g)];
    expect(matches.length).toBe(26);
    for (const m of matches) {
      expect(fs.existsSync(path.join(repoRoot, m[1]))).toBe(true);
    }
  });
});

// ─── [AU-02] Native Adventure & Starfall Summit Bridge ─────────────────────

describe('[AU-02] native audio bridge & pre-rendered .m4a pack', () => {
  const repoRoot = path.resolve(__dirname, '..');

  const createMockNativeAudio = () => {
    const handles: { source: unknown; opts: unknown; handle: NativeSoundHandle }[] = [];
    const setAudioModeAsync = jest.fn(async () => undefined);
    const createAsync = jest.fn(async (source: unknown, opts?: { shouldPlay?: boolean; isLooping?: boolean; volume?: number }) => {
      const handle: NativeSoundHandle = {
        playAsync: jest.fn(async () => undefined),
        pauseAsync: jest.fn(async () => undefined),
        stopAsync: jest.fn(async () => undefined),
        unloadAsync: jest.fn(async () => undefined),
        setPositionAsync: jest.fn(async () => undefined),
        setVolumeAsync: jest.fn(async () => undefined),
        setIsLoopingAsync: jest.fn(async () => undefined),
      };
      handles.push({ source, opts, handle });
      return { sound: handle };
    });
    const mod: NativeAudioModule = { setAudioModeAsync, Sound: { createAsync } };
    return { mod, handles, setAudioModeAsync, createAsync };
  };

  afterEach(() => {
    __setNativeAudioForTests(null);
    __setAppActiveForTests(true);
    audioFlags.music = true;
    audioFlags.sfx = true;
    band.stop();
  });

  it('bundles pre-rendered .m4a loops for every arrangement and maps all 77 cues & 64 weapons', () => {
    for (const arr of Object.keys(ARRANGEMENTS)) {
      const loopKey = resolveNativeLoop(arr);
      expect(loopKey in NATIVE_LOOP_ASSETS).toBe(true);
      const file = path.join(repoRoot, 'assets', 'sounds', 'native', 'loops', `${loopKey}.m4a`);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(10_000);
    }
    expect(resolveNativeLoop('summit')).toBe('boss');

    for (const cueKey of Object.keys(NATIVE_CUE_ASSETS)) {
      const file = path.join(repoRoot, 'assets', 'sounds', 'native', 'cues', `${cueKey}.m4a`);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(1_000);
    }

    for (const name of CUE_NAMES) {
      expect(CUE_TO_NATIVE[name] in NATIVE_CUE_ASSETS).toBe(true);
      expect(resolveCueKey(name, 3) in NATIVE_CUE_ASSETS).toBe(true);
    }
    expect(resolveCueKey('star', 1)).toBe('star-1');
    expect(resolveCueKey('star', 2)).toBe('star-2');
    expect(resolveCueKey('star', 3)).toBe('star-3');
    expect(resolveCueKey('multSlam', 3)).toBe('payout-3');

    const rolesUsed = new Set<string>();
    for (const id of createMaxedSave().armory) {
      const key = resolveWeaponStingKey(id);
      expect(key in NATIVE_CUE_ASSETS).toBe(true);
      rolesUsed.add(key);
    }
    expect(rolesUsed.size).toBe(6);
  });

  it('delegates band music loops, cues, payouts, weapon stings, and lifecycle pause/resume on native', async () => {
    const mock = createMockNativeAudio();
    __setNativeAudioForTests(mock.mod);

    band.play('meadow');
    await Promise.resolve();
    await Promise.resolve();

    expect(mock.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    expect(mock.createAsync).toHaveBeenCalledWith(
      NATIVE_LOOP_ASSETS.meadow,
      expect.objectContaining({ shouldPlay: true, isLooping: true })
    );
    expect(nativeBridge.activeTrack).toBe('meadow');

    // Combat feedback on native plays real pre-rendered cues & ducks BGM
    band.select(1);
    band.payout({ combo: 4, tier: 2, rainbow: true });
    band.fire('blast-powder');
    band.cue('perfectParry');
    band.evolve(EVOLUTION_RECIPES[0].id);
    await Promise.resolve();
    await Promise.resolve();

    const loadedSources = mock.handles.map(h => h.source);
    expect(loadedSources).toContain(NATIVE_CUE_ASSETS['select-1']);
    expect(loadedSources).toContain(NATIVE_CUE_ASSETS['payout-2']);
    expect(loadedSources).toContain(NATIVE_CUE_ASSETS['sting-brass']);
    expect(loadedSources).toContain(NATIVE_CUE_ASSETS['perfect-parry']);
    expect(loadedSources).toContain(NATIVE_CUE_ASSETS.evolve);

    // Backgrounding pauses the looping BGM; foregrounding resumes it
    const bgmHandle = mock.handles[0].handle;
    __setAppActiveForTests(false);
    expect(bgmHandle.pauseAsync).toHaveBeenCalled();

    __setAppActiveForTests(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(bgmHandle.playAsync).toHaveBeenCalled();

    // Finale stops BGM and plays victory fanfare
    band.finale(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(bgmHandle.stopAsync).toHaveBeenCalled();
    expect(mock.handles.map(h => h.source)).toContain(NATIVE_CUE_ASSETS.victory);
  });
});

// ─── [AU-03] Native SOUND_ENABLED Default = true & Staged Preloading ───────

describe('[AU-03] native sound default true & bounded staged preload', () => {
  afterEach(() => {
    storage.clearAll();
  });

  it('defaults SoundStorage and MusicStorage to true on native iOS/Android and honors explicit opt-out', () => {
    const origOs = Platform.OS;
    try {
      for (const os of ['ios', 'android', 'web'] as const) {
        Platform.OS = os;
        storage.clearAll();
        expect(SettingsStorage.getSoundEnabled()).toBe(true);
        expect(SoundStorage.get()).toBe(true);
        expect(MusicStorage.get()).toBe(true);
      }
      Platform.OS = 'ios';
      SettingsStorage.setSoundEnabled(false);
      expect(SettingsStorage.getSoundEnabled()).toBe(false);
      expect(MusicStorage.get()).toBe(false);
    } finally {
      Platform.OS = origOs;
    }
  });

  it('preloads core sounds first and caps concurrent Audio.Sound.createAsync calls at <= 3', async () => {
    let inFlight = 0;
    let peakInFlight = 0;
    const loadedOrder: unknown[] = [];
    const setAudioModeAsync = jest.fn(async () => undefined);
    const createAsync = jest.fn(async (src: unknown) => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      loadedOrder.push(src);
      await Promise.resolve();
      inFlight -= 1;
      return {
        sound: {
          setPositionAsync: jest.fn(async () => undefined),
          playAsync: jest.fn(async () => undefined),
          unloadAsync: jest.fn(async () => undefined),
          setOnPlaybackStatusUpdate: jest.fn(),
        },
      };
    });

    await jest.isolateModulesAsync(async () => {
      const actualSounds = jest.requireActual<typeof import('@/utils/sounds')>('@/utils/sounds');
      actualSounds.__setFallbackAudioForTests({ setAudioModeAsync, Sound: { createAsync } });
      try {
        await actualSounds.initAudio();
        expect(setAudioModeAsync).toHaveBeenCalledWith({
          playsInSilentModeIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        expect(actualSounds.PRELOAD_MAX_CONCURRENT).toBe(3);
        expect(actualSounds.CORE_SOUND_CATEGORIES).toEqual(['click', 'confirm', 'confirmExit', 'matchValid', 'matchInvalid']);
        await actualSounds.preloadAllSounds();
        expect(createAsync).toHaveBeenCalledTimes(26);
        expect(peakInFlight).toBeLessThanOrEqual(actualSounds.PRELOAD_MAX_CONCURRENT);
      } finally {
        actualSounds.__setFallbackAudioForTests(null);
      }
    });
  });
});

// ─── [AU-14] Pitch Folding & FM Nyquist Guard + [AU-15] Phone Mastering ────

describe('[AU-14] & [AU-15] pitch folding, FM Nyquist safety & phone-speaker master bus', () => {
  interface RecordedOsc {
    type: string;
    freq: number;
    targetIsParam: boolean;
  }

  const createInspectableContext = (sampleRate = 44100) => {
    const oscs: RecordedOsc[] = [];
    const filters: { type: string; frequency: { value: number }; Q: { value: number }; gain: { value: number } }[] = [];
    const compressors: {
      threshold: { value: number };
      knee: { value: number };
      ratio: { value: number };
      attack: { value: number };
      release: { value: number };
    }[] = [];
    const shapers: { curve: Float32Array | null; oversample: string }[] = [];
    const gains: { gain: { value: number }; isModDepth?: boolean }[] = [];

    const makeParam = (initial = 0) => {
      const p = {
        value: initial,
        __isAudioParam: true,
        setValueAtTime: jest.fn((v: number, _at?: number) => { p.value = v; }),
        linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        setTargetAtTime: jest.fn(),
        cancelScheduledValues: jest.fn(),
      };
      return p;
    };

    const ctx: Record<string, any> = {
      sampleRate,
      currentTime: 0,
      destination: { channelCount: 2, connect: jest.fn() },
      createGain: jest.fn(() => {
        const g: Record<string, any> = {
          gain: makeParam(1),
          connect: jest.fn((dest: any) => {
            if (dest && dest.__isAudioParam) g.isModDepth = true;
            return dest;
          }),
        };
        gains.push(g as any);
        return g;
      }),
      createBiquadFilter: jest.fn(() => {
        const f = {
          type: 'lowpass',
          frequency: makeParam(350),
          Q: makeParam(1),
          gain: makeParam(0),
          connect: jest.fn((dest: unknown) => dest),
        };
        filters.push(f);
        return f;
      }),
      createDynamicsCompressor: jest.fn(() => {
        const c = {
          threshold: makeParam(-24),
          knee: makeParam(30),
          ratio: makeParam(12),
          attack: makeParam(0.003),
          release: makeParam(0.25),
          connect: jest.fn((dest: unknown) => dest),
        };
        compressors.push(c);
        return c;
      }),
      createWaveShaper: jest.fn(() => {
        const s = {
          curve: null as Float32Array | null,
          oversample: 'none',
          connect: jest.fn((dest: unknown) => dest),
        };
        shapers.push(s);
        return s;
      }),
      createConvolver: jest.fn(() => ({ buffer: null, connect: jest.fn((d: unknown) => d) })),
      createDelay: jest.fn(() => ({ delayTime: makeParam(0), connect: jest.fn((d: unknown) => d) })),
      createStereoPanner: jest.fn(() => ({ pan: makeParam(0), connect: jest.fn((d: unknown) => d) })),
      createPeriodicWave: jest.fn(() => ({})),
      createBuffer: jest.fn((_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) })),
      createBufferSource: jest.fn(() => ({ buffer: null, loop: false, start: jest.fn(), stop: jest.fn(), connect: jest.fn((d: unknown) => d) })),
      createOscillator: jest.fn(() => {
        const rec: RecordedOsc = { type: 'sine', freq: 440, targetIsParam: false };
        const freqParam = makeParam(440);
        const origSet = freqParam.setValueAtTime;
        freqParam.setValueAtTime = jest.fn((v: number, at?: number) => {
          rec.freq = v;
          origSet(v, at);
        });
        const osc = {
          get type() { return rec.type; },
          set type(v: string) { rec.type = v; },
          frequency: freqParam,
          detune: makeParam(0),
          setPeriodicWave: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          connect: jest.fn((dest: any) => {
            // Detect FM modulator / vibrato LFO wired into a GainNode that feeds carrier.frequency
            const origDestConnect = dest?.connect;
            if (typeof origDestConnect === 'function') {
              dest.connect = jest.fn((next: any) => {
                if (next && next.__isAudioParam) rec.targetIsParam = true;
                return origDestConnect(next);
              });
            }
            return dest;
          }),
        };
        oscs.push(rec);
        return osc;
      }),
    };

    return { ctx: ctx as unknown as BaseAudioContext, oscs, filters, compressors, shapers, gains };
  };

  it('octave-folds high frequencies cleanly without flat-clamping pitch class', () => {
    expect(foldFreq(440, 2600)).toBe(440);
    expect(foldFreq(2600, 2600)).toBe(2600);
    // D8 (4698.64 Hz) folds cleanly to D7 (2349.32 Hz)
    expect(foldFreq(4698.64, 2600)).toBeCloseTo(2349.32, 2);
    // Extreme combo rung (18795 Hz) folds into (1300, 2600] preserving octave ratio
    const folded = foldFreq(18795, 2600);
    expect(folded).toBeGreaterThan(1300);
    expect(folded).toBeLessThanOrEqual(2600);
    expect(18795 / folded).toBeCloseTo(8, 5);
  });

  it('keeps all melodic/ladder notes <= 2,600 Hz and all FM modulators < 0.42 * sampleRate across combo 1..20 & all worlds', () => {
    for (const sampleRate of [44100, 22050]) {
      const mock = createInspectableContext(sampleRate);
      const restore = chip.useContext(mock.ctx);
      try {
        // Test every arrangement (including peaks with leadOctave: 12) at full intensity + evolution
        for (const arrangement of Object.keys(ARRANGEMENTS)) {
          band.renderScript(
            3,
            [
              {
                at: 0,
                mood: mood({
                  arrangement,
                  foeHp: 0.1,
                  combo: 15,
                  evolutions: [EVOLUTION_RECIPES[0].id],
                  evolutionEndsMs: 20000,
                  weapons: ['snowball', 'glass-sword', 'fortunes-favor', 'cascade-core'],
                }),
              },
            ],
            0.05
          );
        }

        // Test payout across combos 1..20 + high-register cues
        for (let combo = 1; combo <= 20; combo++) {
          band.payout({ combo, tier: 3, rainbow: combo === 20 });
        }
        band.cue('coins', { amount: 12, slot: 8 });
        band.cue('ding', { slot: 12 });
        band.cue('killCamShatter');
        band.cue('star', { amount: 3 });
        band.cue('keyFound');
        band.cue('friendRescued');
        band.cue('catalyst');

        // Separate audio-rate FM modulators from melodic carriers & partials
        const modulators = mock.oscs.filter(o => o.targetIsParam && o.freq > 20);
        const carriersAndPartials = mock.oscs.filter(o => !o.targetIsParam);
        expect(carriersAndPartials.length).toBeGreaterThan(100);

        // No FM modulator may ever reach or exceed 0.42 * sampleRate (fixes 49 kHz glock Nyquist aliasing)
        for (const m of modulators) {
          expect(m.freq).toBeLessThan(sampleRate * 0.42);
        }

        // Check melodic fundamentals directly via chip.play spy: peaks + combo 1..20 must stay <= 2,600 Hz
        const playSpy = jest.spyOn(chip, 'play');
        const toneSpy = jest.spyOn(chip, 'tone');
        try {
          band.renderScript(2, [{ at: 0, mood: mood({ arrangement: 'peaks', foeHp: 0.1, combo: 15 }) }], 0.05);
          for (let combo = 1; combo <= 20; combo++) band.payout({ combo, tier: 3, rainbow: true });
          for (const [, opts] of playSpy.mock.calls) {
            expect(opts.freq).toBeLessThanOrEqual(2600);
          }
          for (const [opts] of toneSpy.mock.calls) {
            expect(opts.freq).toBeLessThanOrEqual(2600);
          }
        } finally {
          playSpy.mockRestore();
          toneSpy.mockRestore();
        }
      } finally {
        restore();
      }
    }
  });

  it('enforces the 4,200 Hz emergency clamp, retunes sleigh <= 4,200 Hz, and skips high-frequency FM modulators', () => {
    const mock = createInspectableContext(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      DRUMS.sleigh(0, 1, 'sfx');
      const sleighFreqs = mock.oscs.map(o => o.freq);
      expect(sleighFreqs).toEqual([3100, 3650, 4100]);
      for (const f of sleighFreqs) expect(f).toBeLessThanOrEqual(MAX_OSC_FREQ_HZ);

      mock.oscs.length = 0;
      // 9,000 Hz glock: carrier clamped to 4,200 Hz, FM mod (4,200 * 7 = 29,400 Hz >= 0.42 * 44,100) skipped!
      chip.play(INSTRUMENTS.glock, { freq: 9000, at: 0, dur: 0.2, bus: 'sfx' });
      expect(mock.oscs.some(o => o.freq === MAX_OSC_FREQ_HZ)).toBe(true);
      expect(mock.oscs.filter(o => o.targetIsParam)).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('wires the [AU-15] phone-speaker master chain (70 Hz HPF, 4 kHz -3 dB shelf, 10.5 kHz LPF, 20:1/1ms limiter, tanh soft-clipper)', () => {
    const mock = createInspectableContext(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      expect(chip.master?.gain.value).toBeCloseTo(MASTER_BUS.gain, 4);
      const hpf = mock.filters.find(f => f.type === 'highpass');
      const presence = mock.filters.find(f => f.type === 'peaking');
      const lpf = mock.filters.find(f => f.type === 'lowpass' && f.frequency.value === MASTER_BUS.lpfHz);
      expect(hpf?.frequency.value).toBe(70);
      expect(hpf?.Q.value).toBeCloseTo(0.707, 3);
      expect(presence?.frequency.value).toBe(4000);
      expect(presence?.Q.value).toBeCloseTo(0.9, 3);
      expect(presence?.gain.value).toBe(-3);
      expect(lpf?.frequency.value).toBe(10500);

      expect(mock.compressors).toHaveLength(1);
      expect(mock.compressors[0].threshold.value).toBe(-6);
      expect(mock.compressors[0].knee.value).toBe(2);
      expect(mock.compressors[0].ratio.value).toBe(20);
      expect(mock.compressors[0].attack.value).toBe(0.001);
      expect(mock.compressors[0].release.value).toBe(0.09);

      expect(mock.shapers).toHaveLength(1);
      const curve = mock.shapers[0].curve!;
      expect(curve).toHaveLength(4096);
      expect(curve[0]).toBeCloseTo(-SOFT_CLIP_CEILING, 4);
      expect(curve[curve.length - 1]).toBeCloseTo(SOFT_CLIP_CEILING, 4);
      expect(Math.abs(curve[Math.floor(curve.length / 2)])).toBeLessThan(0.002);
      // Verify curve matches makeSoftClipCurve and stays strictly bounded below 1.0
      const fresh = makeSoftClipCurve();
      expect(fresh[0]).toBeCloseTo(curve[0], 6);
      for (let i = 1; i < fresh.length; i++) {
        expect(fresh[i]).toBeGreaterThanOrEqual(fresh[i - 1]);
        expect(Math.abs(fresh[i])).toBeLessThanOrEqual(SOFT_CLIP_CEILING + 1e-6);
      }
    } finally {
      restore();
    }
  });

  it('injects warm 2nd & 3rd bass harmonics on sub, kick, timpani, taiko, thud & subDrop and keeps mono fold-down pan safe', () => {
    expect(INSTRUMENTS.sub.partials).toEqual([[2, 0.32], [3, 0.14]]);
    const mock = createInspectableContext(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      const checkWarm = (fn: () => void, fund: number) => {
        mock.oscs.length = 0;
        fn();
        const freqs = mock.oscs.map(o => o.freq);
        expect(freqs).toContain(fund);
        expect(freqs).toContain(fund * 2);
        expect(freqs).toContain(fund * 3);
      };
      checkWarm(() => DRUMS.kick(0, 1, 'music'), 155);
      checkWarm(() => DRUMS.timpani(0, 1, 'sfx'), 98);
      checkWarm(() => DRUMS.taiko(0, 1, 'sfx'), 120);
      checkWarm(() => DRUMS.thud(0, 1, 'sfx'), 90);
      checkWarm(() => subDrop(0, 1, 'sfx'), 110);
    } finally {
      restore();
    }

    // Mono fold-down safety: every weapon pan sits strictly inside [-1, 1] with equal-power panning
    for (const v of Object.values(WEAPON_VOICES)) {
      expect(v.pan).toBeGreaterThanOrEqual(-1);
      expect(v.pan).toBeLessThanOrEqual(1);
    }
  });
});
