/**
 * The adaptive score, without any audio: the theory it runs on, a voice for
 * every weapon and a theme for every evolution, the director (fight state →
 * mix) and the bridge from fight events to cues. docs/sound-design.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Platform } from 'react-native';
import { EVENT_CUE, HIT_SIZES, JACKPOT_CHAIN, MAX_CHAIN, alertsOf, hitSize, moodOf, soundsFor, type FightSound } from '@/audio/fightAudio';
import { ambience, biomeToAmbienceKind } from '@/audio/ambience';
import { band, CUE_NAMES, CUE_TIER, IMMEDIATE_CUES, PAYOUT_TIER_GAIN } from '@/audio/band';
import {
  chip,
  foldFreq,
  makeSoftClipCurve,
  MASTER_BUS,
  MAX_OSC_FREQ_HZ,
  MAX_VOICES,
  REVERB_SECONDS,
  resolveSpace,
  SFX_BUS_GAIN,
  SFX_TIER_GAINS,
  SOFT_CLIP_CEILING,
} from '@/audio/chip';
import { DIRECTOR, NO_ALERTS, capAlerts, direct, resolveLeadMode, restingMix, worldTone, type FightMood } from '@/audio/director';
import { FIGHTER_VOICE_IDS, FIGHTER_VOICE_META } from '@/audio/fighterVoices';
import { DRUMS, INSTRUMENTS, subDrop } from '@/audio/instruments';
import { setMusicEnabled, setSfxEnabled } from '@/audio';
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
import * as songsMod from '@/audio/songs';
import { ARRANGEMENTS, INTRO_PICKUP, THEME, THEME_B, THEME_BATTLE_B } from '@/audio/songs';
import { EVOLUTION_IDS, RECIPE_IDS, themeOf } from '@/audio/themes';
import {
  BRIGHTNESS, MODES, PROGRESSIONS, chordRoot, degreeToMidi, degreeToSemis, hashOf, isMinor, ladderDegree, ladderRung, LADDER_TOP,
  midiToFreq, nextGridTime, parseNote, shade, strum,
} from '@/audio/theory';
import {
  WEAPON_VOICES, evolutionIdOf, evolutionTheme, hasWeaponVoice, recipeIdOf, riffNotes, stingOf, themeSignature, voiceSignature, weaponIdOf, weaponVoice,
} from '@/audio/voices';
import { WEAPON_EVOLUTIONS, evolutionsForWeapon } from '@/adventure/data/evolutions';
import { ownerOfEvent } from '@/adventure/data/weaponGuide';
import { BIOMES } from '@/adventure/data/biomes';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { createMaxedSave } from '@/adventure/progress';
import type { RunEvent, RunEventType } from '@/adventure/types';
import { __setAppActiveForTests } from '@/utils/appLifecycle';
import {
  __setHapticsModuleForTests,
  selectionHaptic,
  triggerHaptic,
  triggerHurtHaptic,
  triggerImpactHaptic,
  triggerKoHaptic,
  triggerParryHaptic,
  triggerStarStampHaptic,
} from '@/utils/haptics';
import { HapticsStorage } from '@/utils/hapticsStorage';
import { MusicStorage, SettingsStorage, SoundStorage, storage } from '@/utils/storage';
import { playSet, startFight, testLevel, tick, withWeapons } from './testUtils/adventureFight';

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
    for (const tok of [...INTRO_PICKUP, ...THEME, ...THEME_B, ...THEME_BATTLE_B]) {
      if (tok === '-' || tok === '.') continue;
      expect({ tok, parsed: parseNote(tok) !== null }).toEqual({ tok, parsed: true });
    }
    expect(INTRO_PICKUP).toHaveLength(16);
    expect(THEME).toHaveLength(128);
    expect(THEME_B).toHaveLength(128);
    expect(THEME_BATTLE_B).toHaveLength(128);
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

  it('reads the weapon or evolution id out of a rule or anchor key', () => {
    expect(weaponIdOf('w2:war-drum#0')).toBe('war-drum');
    expect(weaponIdOf('w:pinata')).toBe('pinata');
    expect(weaponIdOf('weapon:blast-powder')).toBe('blast-powder');
    expect(weaponIdOf('evo:blast-powder:cluster-charge#0')).toBeNull();
    expect(weaponIdOf('node:tabby-purr#0')).toBeNull();
    expect(evolutionIdOf('evo:blast-powder:cluster-charge#0')).toBe('blast-powder:cluster-charge');
    expect(recipeIdOf('evo:blast-powder:cluster-charge#0')).toBe('blast-powder:cluster-charge');
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
  it('every one of the 192 per-weapon evolutions has a theme anchored to its owning weapon voice', () => {
    expect(WEAPON_EVOLUTIONS).toHaveLength(192);
    expect(EVOLUTION_IDS).toHaveLength(192);
    expect(RECIPE_IDS).toEqual(EVOLUTION_IDS);
    for (const evo of WEAPON_EVOLUTIONS) {
      const t = themeOf(evo.id);
      expect(t.weaponId).toBe(evo.weaponId);
      expect(t.variantIndex).toBe(evo.slotIndex);
      expect(t.weapons).toEqual([evo.weaponId]);
      expect({ evo: evo.id, id: t.weaponId, voiced: hasWeaponVoice(t.weaponId) }).toEqual({
        evo: evo.id,
        id: t.weaponId,
        voiced: true,
      });
      expect(t.insts[0]).not.toBe(t.insts[1]);
      expect(t.fanfare.length).toBeGreaterThanOrEqual(5);
      expect(t.lift).toBeGreaterThanOrEqual(2);
      expect(t.lift).toBeLessThanOrEqual(7);
      expect(t.brighten).toBeGreaterThanOrEqual(1);
      // The fanfare ends on its highest note
      expect(t.fanfare[t.fanfare.length - 1]).toBeGreaterThanOrEqual(7);
      expect(t.fanfare[t.fanfare.length - 1]).toBe(Math.max(...t.fanfare));
    }
    // Every weapon's 3 variants (A/B/C) use distinct grooves & companions
    for (const weaponId of createMaxedSave().armory) {
      const variants = evolutionsForWeapon(weaponId);
      expect(variants).toHaveLength(3);
      const grooves = new Set(variants.map(v => themeOf(v.id).groove));
      const companions = new Set(variants.map(v => themeOf(v.id).insts[1]));
      expect(grooves.size).toBe(3);
      expect(companions.size).toBe(3);
    }
  });

  it('no two evolutions across all 192 share the same theme signature', () => {
    const seen = new Map<string, string>();
    for (const evo of WEAPON_EVOLUTIONS) {
      const sig = themeSignature(themeOf(evo.id));
      expect({ id: evo.id, sameAs: seen.get(sig) }).toEqual({ id: evo.id, sameAs: undefined });
      seen.set(sig, evo.id);
    }
  });

  it('a theme is deterministic and an unknown evolution id still gets a valid fallback', () => {
    const evo = WEAPON_EVOLUTIONS[0];
    expect(evolutionTheme(evo.id, evo.weaponId, evo.slotIndex)).toEqual(themeOf(evo.id));
    expect(themeOf('not-a-recipe').fanfare.length).toBeGreaterThanOrEqual(5);
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

  it('the band thins out gradually when the player has not made a Set, flooring lead at 0.35 and filter at 9500 Hz ([AU-18])', () => {
    const active = direct(mood({ foeHp: 0.6, weapons: ['magnet', 'rust'] }));
    const early = direct(mood({ foeHp: 0.6, idleMs: DIRECTOR.idleStartMs + 2000, weapons: ['magnet', 'rust'] }));
    const thin = direct(mood({ foeHp: 0.6, idleMs: DIRECTOR.idleThinMs, weapons: ['magnet', 'rust'] }));
    const midFade = direct(mood({ foeHp: 0.6, idleMs: (DIRECTOR.idleThinMs + DIRECTOR.idleQuietMs) / 2, weapons: ['magnet', 'rust'] }));
    const quiet = direct(mood({ foeHp: 0.6, idleMs: DIRECTOR.idleQuietMs, weapons: ['magnet', 'rust'] }));
    // Continuous smooth monotonic descent without silencing melody dead or going underwater
    expect(early.intensity).toBeLessThan(active.intensity);
    expect(thin.intensity).toBeLessThan(early.intensity);
    expect(midFade.intensity).toBeLessThan(thin.intensity);
    expect(quiet.intensity).toBeLessThan(midFade.intensity);
    expect(midFade.leadGain).toBeGreaterThan(DIRECTOR.idleLeadFloor);
    expect(midFade.leadGain).toBeLessThan(thin.leadGain);
    expect(quiet.leadGain).toBe(DIRECTOR.idleLeadFloor);
    expect(midFade.filterHz).toBeLessThan(active.filterHz);
    expect(quiet.filterHz).toBe(DIRECTOR.idleFilterFloorHz);
    expect(quiet.level).toBeLessThan(active.level);
    expect([active.lead, thin.lead, quiet.lead]).toEqual([true, true, true]);
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

  it('every event has a row, catalyst_spawn is removed, and every row names a real cue', () => {
    for (const cue of Object.values(EVENT_CUE)) if (cue) expect(CUE_NAMES).toContain(cue);
    expect(Object.keys(EVENT_CUE).length).toBe(80);
    expect('catalyst_spawn' in EVENT_CUE).toBe(false);
    expect(EVENT_CUE.evo_almost).toBe('evoAlmost');
    expect(EVENT_CUE.evo_progress).toBe('evoProgress');
    expect(EVENT_CUE.evo_charge).toBe('evoCharge');
    expect(EVENT_CUE.holo_spawn).toBe('twinkle');
    expect(EVENT_CUE.marked).toBe('armed');
  });

  it('rate-limits Tier C evo_progress to max 1 per Set, mutes it on evo_almost/evolution_start, and avoids stray weapon stings', () => {
    const multiTick = soundsFor(
      [
        ev('hit', 12),
        ev('evo_progress', 0.33, '1/3', 'weapon:blast-powder'),
        ev('evo_progress', 0.66, '2/3', 'weapon:war-drum'),
        ev('evo_progress', 0.5, '2/4', 'weapon:flint-spark'),
      ],
      { weapons: ['blast-powder', 'war-drum', 'flint-spark'], combo: 2 }
    );
    expect(names(multiTick)).toEqual(['payout:1', 'evoProgress']);
    expect(multiTick[1]).toMatchObject({ kind: 'cue', name: 'evoProgress', amount: 0.66 });

    const withAlmost = soundsFor(
      [
        ev('hit', 12),
        ev('evo_progress', 0.5, '1/2', 'weapon:blast-powder'),
        ev('evo_almost', undefined, '1 LEFT!', 'weapon:war-drum'),
      ],
      { weapons: ['blast-powder', 'war-drum'], combo: 2 }
    );
    expect(names(withAlmost)).toEqual(['payout:1', 'evoAlmost']);

    const withStart = soundsFor(
      [
        ev('evolution_start', undefined, WEAPON_EVOLUTIONS[0].id, 'weapon:blast-powder'),
        ev('evo_progress', 0.5, '1/2', 'weapon:war-drum'),
        ev('evolution_end', undefined, WEAPON_EVOLUTIONS[0].name, 'weapon:blast-powder'),
      ],
      { weapons: ['blast-powder', 'war-drum'], combo: 2 }
    );
    expect(withStart).toEqual([]);

    const charged = soundsFor(
      [ev('evo_charge', 1, 'Charge!', 'w0:catalyst-prism#0')],
      { weapons: ['catalyst-prism'], combo: 1 }
    );
    expect(names(charged)).toEqual(['evoCharge', 'sting:catalyst-prism']);
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

    // Active per-weapon timed evolutions flow cleanly from run.weaponEvolutions into moodOf
    const evoA = WEAPON_EVOLUTIONS[0];
    const evoB = WEAPON_EVOLUTIONS[3];
    const withActiveEvos = {
      ...s,
      weaponEvolutions: [
        { weaponId: evoA.weaponId, evoId: evoA.id, phase: 'charging' as const, progress: 2, target: 3, almostReady: true, activeRemainingMs: 0, durationMs: evoA.durationMs, cooldownRemainingMs: 0, triggersCount: 0 },
        { weaponId: evoB.weaponId, evoId: evoB.id, phase: 'active' as const, progress: 0, target: 3, almostReady: false, activeRemainingMs: 4200, durationMs: evoB.durationMs, cooldownRemainingMs: 0, triggersCount: 1 },
      ],
    };
    const evolvedMood = moodOf(withActiveEvos, { arrangement: 'woods', paused: false, timeTotal: s.timeLeft });
    expect(evolvedMood.evolutions).toEqual([evoB.id]);
    expect(evolvedMood.evolutionEndsMs).toBe(4200);
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
    band.evolve(WEAPON_EVOLUTIONS[0].id);
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
        // Test every arrangement (including peaks with leadOctave: 12) at full intensity + all 3 evolution variants
        const variantEvos = [0, 1, 2].map(slot => WEAPON_EVOLUTIONS.find(e => e.slotIndex === slot)!);
        for (const [idx, arrangement] of Object.keys(ARRANGEMENTS).entries()) {
          band.renderScript(
            3,
            [
              {
                at: 0,
                mood: mood({
                  arrangement,
                  foeHp: 0.1,
                  combo: 15,
                  evolutions: [variantEvos[idx % 3].id],
                  evolutionEndsMs: 20000,
                  weapons: ['snowball', 'glass-sword', 'fortunes-favor', 'cascade-core'],
                }),
              },
            ],
            0.05
          );
        }

        // Test payout across combos 1..20 + high-register & evolution cues
        for (let combo = 1; combo <= 20; combo++) {
          band.payout({ combo, tier: 3, rainbow: combo === 20 });
        }
        band.cue('coins', { amount: 12, slot: 8 });
        band.cue('ding', { slot: 12 });
        band.cue('killCamShatter');
        band.cue('star', { amount: 3 });
        band.cue('keyFound');
        band.cue('friendRescued');
        band.cue('arcanaGain');
        band.cue('catalyst');
        band.cue('evoAlmost');
        band.cue('evoProgress', { amount: 0.9 });
        band.cue('evoCharge');
        band.cue('evoEnd');

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

// ─── Wave 3 Audio Mastery ([AU-04..AU-11, AU-13, AU-16..AU-21]) ────────────

describe('Wave 3 Audio Mastery: 4-tier priority, transients, room split, immediate cues, 16-bar music, ambience & haptics', () => {
  const createAudioSpyCtx = (sampleRate = 44100) => {
    const convolvers: { buffer: { length: number } | null }[] = [];
    const delays: { delayTime: { value: number } }[] = [];
    const filters: { type: string; frequency: { value: number }; Q: { value: number }; gain: { value: number } }[] = [];
    const oscStarts: { startAt: number; stopAt: number; freq: number }[] = [];
    const oscStopCalls: { stopAt?: number }[] = [];
    const bufSources: { loop: boolean; start: jest.Mock; stop: jest.Mock }[] = [];

    const makeParam = (initial = 0) => {
      const p = {
        value: initial,
        setValueAtTime: jest.fn((v: number) => { p.value = v; }),
        linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        setTargetAtTime: jest.fn(),
        cancelScheduledValues: jest.fn(),
      };
      return p;
    };

    const ctx: Record<string, any> = {
      sampleRate,
      currentTime: 1.0,
      state: 'running',
      destination: { channelCount: 2, connect: jest.fn() },
      createGain: jest.fn(() => ({
        gain: makeParam(1),
        channelCount: 2,
        channelCountMode: 'max',
        channelInterpretation: 'speakers',
        connect: jest.fn((d: unknown) => d),
        disconnect: jest.fn(),
      })),
      createBiquadFilter: jest.fn(() => {
        const f = {
          type: 'lowpass',
          frequency: makeParam(350),
          Q: makeParam(1),
          gain: makeParam(0),
          connect: jest.fn((d: unknown) => d),
          disconnect: jest.fn(),
        };
        filters.push(f);
        return f;
      }),
      createDynamicsCompressor: jest.fn(() => ({
        threshold: makeParam(-24),
        knee: makeParam(30),
        ratio: makeParam(12),
        attack: makeParam(0.003),
        release: makeParam(0.25),
        connect: jest.fn((d: unknown) => d),
      })),
      createWaveShaper: jest.fn(() => ({ curve: null, oversample: 'none', connect: jest.fn((d: unknown) => d) })),
      createConvolver: jest.fn(() => {
        const c = { buffer: null as { length: number } | null, connect: jest.fn((d: unknown) => d) };
        convolvers.push(c);
        return c;
      }),
      createDelay: jest.fn(() => {
        const d = { delayTime: makeParam(0), connect: jest.fn((dest: unknown) => dest) };
        delays.push(d);
        return d;
      }),
      createStereoPanner: jest.fn(() => ({ pan: makeParam(0), connect: jest.fn((d: unknown) => d) })),
      createPeriodicWave: jest.fn(() => ({})),
      createBuffer: jest.fn((_ch: number, len: number) => ({
        length: len,
        getChannelData: () => new Float32Array(len),
      })),
      createBufferSource: jest.fn(() => {
        const s = {
          buffer: null,
          loop: false,
          start: jest.fn(),
          stop: jest.fn(),
          connect: jest.fn((d: unknown) => d),
          disconnect: jest.fn(),
        };
        bufSources.push(s);
        return s;
      }),
      createOscillator: jest.fn(() => {
        const entry = { startAt: 0, stopAt: 0, freq: 440 };
        const freq = makeParam(440);
        const origSet = freq.setValueAtTime;
        freq.setValueAtTime = jest.fn((v: number) => {
          entry.freq = v;
          origSet(v);
        });
        return {
          type: 'sine',
          frequency: freq,
          detune: makeParam(0),
          setPeriodicWave: jest.fn(),
          start: jest.fn((at = 0) => {
            entry.startAt = at;
            oscStarts.push(entry);
          }),
          stop: jest.fn((at?: number) => {
            entry.stopAt = at ?? 0;
            oscStopCalls.push({ stopAt: at });
          }),
          connect: jest.fn((d: unknown) => d),
          disconnect: jest.fn(),
        };
      }),
    };

    return { ctx: ctx as unknown as BaseAudioContext, convolvers, delays, filters, oscStarts, oscStopCalls, bufSources };
  };

  afterEach(() => {
    ambience.stop();
    band.stop();
    chip.setMonitorMode('flat');
    __setAppActiveForTests(true);
    __setHapticsModuleForTests(null);
    audioFlags.music = true;
    audioFlags.sfx = true;
    storage.clearAll();
  });

  it('[AU-04] wires 4-tier SFX priority bus (S/A/B/C), SFX-to-SFX ducking, <=18 MEGA+Rainbow voices, and priority voice-stealing', () => {
    const mock = createAudioSpyCtx(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      // Exact bus gain calibration
      expect(chip.sfxBus?.gain.value).toBeCloseTo(SFX_BUS_GAIN, 4);
      expect(chip.sfxTiers.S?.gain.value).toBeCloseTo(SFX_TIER_GAINS.S, 4);
      expect(chip.sfxTiers.A?.gain.value).toBeCloseTo(SFX_TIER_GAINS.A, 4);
      expect(chip.sfxTiers.B?.gain.value).toBeCloseTo(SFX_TIER_GAINS.B, 4);
      expect(chip.sfxTiers.C?.gain.value).toBeCloseTo(SFX_TIER_GAINS.C, 4);
      expect(chip.sfxDuckGain).not.toBeNull();

      // Every cue has an explicit priority tier (including new evolution & Arcana cues) and monotonic payout gains
      for (const name of CUE_NAMES) expect(['S', 'A', 'B', 'C']).toContain(CUE_TIER[name]);
      expect(CUE_TIER.evoAlmost).toBe('A');
      expect(CUE_TIER.evoCharge).toBe('B');
      expect(CUE_TIER.arcanaGain).toBe('B');
      expect(CUE_TIER.catalyst).toBe('B');
      expect(CUE_TIER.evoProgress).toBe('C');
      expect(CUE_TIER.evoEnd).toBe('C');
      expect(PAYOUT_TIER_GAIN[0]).toBeLessThan(PAYOUT_TIER_GAIN[1]);
      expect(PAYOUT_TIER_GAIN[1]).toBeLessThan(PAYOUT_TIER_GAIN[2]);
      expect(PAYOUT_TIER_GAIN[2]).toBeLessThan(PAYOUT_TIER_GAIN[3]);

      // Tier S & A trigger music + SFX-to-SFX ducking
      const duckSpy = jest.spyOn(chip, 'duck');
      const duckSfxSpy = jest.spyOn(chip, 'duckSfx');
      band.cue('parryWarn');
      band.cue('parry');
      band.cue('foeStrike');
      band.cue('blast');
      band.cue('levelUp');
      expect(duckSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
      expect(duckSfxSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
      duckSpy.mockRestore();
      duckSfxSpy.mockRestore();

      // MEGA + Rainbow payout voice budget stays <= 18 voices (down from ~45)
      const beforeMega = chip.voiceCount;
      band.payout({ combo: 12, tier: 3, rainbow: true });
      const megaVoices = chip.voiceCount - beforeMega;
      expect(megaVoices).toBeGreaterThan(6);
      expect(megaVoices).toBeLessThanOrEqual(18);

      // Redundant multSlam subDrop/crash suppressed within 120 ms of heavy T3 payout
      const beforeSuppressed = chip.voiceCount;
      band.cue('multSlam', { amount: 3 });
      const suppressedVoices = chip.voiceCount - beforeSuppressed;
      band.atTime(5.0, () => {
        const beforeFull = chip.voiceCount;
        band.cue('multSlam', { amount: 3 });
        const fullVoices = chip.voiceCount - beforeFull;
        expect(suppressedVoices).toBeLessThan(fullVoices);
      });

      // Voice-stealing: fill MAX_VOICES (56) with Tier C voices, then fire Tier S hurt — steals oldest Tier C instead of dropping!
      const mockSteal = createAudioSpyCtx(44100);
      const restoreSteal = chip.useContext(mockSteal.ctx);
      try {
        for (let i = 0; i < MAX_VOICES; i++) {
          chip.play(INSTRUMENTS.kalimba, { freq: 440, at: 1.0 + i * 0.0001, dur: 2.0, bus: 'sfx', tier: 'C', space: 'dry' });
        }
        expect(chip.activeVoices).toBe(MAX_VOICES);
        const beforeS = chip.voiceCount;
        chip.play(INSTRUMENTS.brassStab, { freq: 220, at: 1.05, dur: 0.3, bus: 'sfx', tier: 'S' });
        expect(chip.voiceCount).toBe(beforeS + 1);
        expect(chip.stolenVoices).toBeGreaterThanOrEqual(1);
      } finally {
        restoreSteal();
      }
    } finally {
      restore();
    }
  });

  it('[AU-05] caps concurrent board alerts to top 2 threats (1 on lastHeart + racing clock) in lethality order', () => {
    const allSix = {
      cursed: 3,
      potatoSoon: true,
      fuseHot: 2,
      thornSoon: true,
      glassLow: true,
      bombSoon: true,
    };
    const top2 = capAlerts(allSix, 2);
    expect(top2).toEqual({
      bombSoon: true,
      fuseHot: 2,
      potatoSoon: false,
      thornSoon: false,
      glassLow: false,
      cursed: 0,
    });

    const withoutTop2 = capAlerts({ ...allSix, bombSoon: false, fuseHot: 0 }, 2);
    expect(withoutTop2).toEqual({
      bombSoon: false,
      fuseHot: 0,
      potatoSoon: true,
      thornSoon: true,
      glassLow: false,
      cursed: 0,
    });

    const crisis = direct(mood({ hearts: 1, maxHearts: 4, timeLeft: 5, timeTotal: 120, alerts: allSix }));
    expect(crisis.heartbeat).toBe(true);
    expect(crisis.clock).toBe(2);
    expect(crisis.alerts).toEqual({
      bombSoon: true,
      fuseHot: 0,
      potatoSoon: false,
      thornSoon: false,
      glassLow: false,
      cursed: 0,
    });
  });

  it('[AU-06] exposes Tier S immediate playKillCamRiser & playKillCamShatter with <=2600 Hz glock folding', () => {
    expect(CUE_TIER.killCamRiser).toBe('S');
    expect(CUE_TIER.killCamShatter).toBe('S');
    expect(IMMEDIATE_CUES.has('killCamRiser')).toBe(true);
    expect(IMMEDIATE_CUES.has('killCamShatter')).toBe(true);

    const mock = createAudioSpyCtx(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      const playSpy = jest.spyOn(chip, 'play');
      band.playKillCamRiser();
      band.playKillCamShatter();
      expect(playSpy.mock.calls.length).toBeGreaterThan(5);
      for (const [, opts] of playSpy.mock.calls) {
        expect(opts.freq).toBeLessThanOrEqual(2600);
        expect(opts.tier).toBe('S');
      }
      playSpy.mockRestore();
    } finally {
      restore();
    }
  });

  it('[AU-07] synthesizes 6 distinct scale-locked fighter voices <=2400 Hz with 1.8 s per-fighter cooldown', () => {
    expect(FIGHTER_VOICE_IDS).toHaveLength(6);
    const signatures = new Set(FIGHTER_VOICE_IDS.map(f => `${FIGHTER_VOICE_META[f].primaryInst}+${FIGHTER_VOICE_META[f].secondary}`));
    expect(signatures.size).toBe(6);

    const mock = createAudioSpyCtx(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      const playSpy = jest.spyOn(chip, 'play');
      for (const fighter of FIGHTER_VOICE_IDS) {
        expect(band.fighterCall(fighter, 'signature', { bypassCooldown: true })).toBe(true);
        expect(band.fighterCall(fighter, 'cheer', { bypassCooldown: true })).toBe(true);
        expect(band.fighterCall(fighter, 'hurt', { bypassCooldown: true })).toBe(true);
      }
      for (const [, opts] of playSpy.mock.calls) {
        expect(opts.freq).toBeLessThanOrEqual(2400);
        expect(opts.tier).toBe('B');
      }
      playSpy.mockRestore();

      // Cooldown blocks rapid duplicate calls for same fighter inside 1.8 s, allows another fighter immediately, then re-allows after 1.8 s
      band.atTime(10.0, () => {
        expect(band.fighterCall('Orange Tabby', 'signature')).toBe(true);
        expect(band.fighterCall('Orange Tabby', 'cheer')).toBe(false);
        expect(band.fighterCall('Sly Fox', 'signature')).toBe(true);
      });
      band.atTime(12.0, () => {
        expect(band.fighterCall('Orange Tabby', 'cheer')).toBe(true);
      });
    } finally {
      restore();
    }
  });

  it('[AU-08] [AU-09] [AU-10] delivers dry hitstop transients, brassStab 5ms attack, plucked o.dur decay, 0.35s SFX room & zero SFX echo', () => {
    expect(INSTRUMENTS.brassStab.a).toBe(0.005);
    expect(INSTRUMENTS.brassStab.space).toBe('sfxRoom');
    expect(typeof DRUMS.impactCrack).toBe('function');
    expect(typeof DRUMS.impactPunch).toBe('function');

    const mock = createAudioSpyCtx(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      // [AU-10]: Single 1.7s Hall convolver + dedicated 0.35s SFX Room convolver + ONLY 1 DelayNode (music echo only)
      expect(mock.convolvers).toHaveLength(2);
      const lengths = mock.convolvers.map(c => c.buffer?.length ?? 0).sort((a, b) => a - b);
      expect(lengths[0]).toBe(Math.floor(44100 * REVERB_SECONDS.sfxRoom));
      expect(lengths[1]).toBe(Math.floor(44100 * REVERB_SECONDS.hall));
      expect(mock.delays).toHaveLength(1);
      expect(chip.reverbConfig.sfxEchoEnabled).toBe(false);

      // Space clamping rules
      expect(resolveSpace('sfx', undefined, 'hall', 'B')).toBe('sfxRoom');
      expect(resolveSpace('sfx', undefined, 'echo', 'B')).toBe('sfxRoom');
      expect(resolveSpace('sfx', 'echo', 'echo', 'A')).toBe('sfxRoom');
      expect(resolveSpace('sfx', 'hall', 'hall', 'S')).toBe('hall');
      expect(resolveSpace('sfx', undefined, 'room', 'C')).toBe('dry');

      // [AU-09]: Plucked (s === 0) bell (d: 1.1s) with o.dur = 0.15s ends crisply around 0.20s instead of 1.76s
      mock.oscStarts.length = 0;
      chip.play(INSTRUMENTS.bell, { freq: 880, at: 2.0, dur: 0.15, bus: 'sfx', tier: 'B' });
      expect(mock.oscStarts.length).toBeGreaterThan(0);
      for (const osc of mock.oscStarts) {
        expect(osc.stopAt - osc.startAt).toBeLessThan(0.25);
      }

      // [AU-08]: Dry impactCrack & impactPunch finish inside hitstop (<85 ms total stop time)
      mock.oscStarts.length = 0;
      DRUMS.impactCrack(3.0, 1, 'sfx', undefined, false, 'A');
      DRUMS.impactPunch(3.0, 1, 'sfx', undefined, false, 'A');
      expect(mock.oscStarts.length).toBeGreaterThanOrEqual(2);
      for (const osc of mock.oscStarts) {
        expect(osc.stopAt - osc.startAt).toBeLessThan(0.09);
      }
    } finally {
      restore();
    }
  });

  it('[AU-11] & [AU-13] fires all 24 reactive cues immediately (4ms lookahead), preserves fast multStep tallies, and removes premature setMood evolve/reelStop', () => {
    const expectedImmediate: (typeof CUE_NAMES)[number][] = [
      'tap', 'back', 'slowMoDefeat', 'star', 'starSwoosh', 'rankSeal', 'storyClimax', 'keyFound', 'friendRescued',
      'mistake', 'hurt', 'parryWarn', 'parry', 'perfectParry', 'foeStrike', 'hint',
      'multStep', 'multSlam', 'register', 'weaponGet', 'reelSpin', 'reelStop', 'killCamRiser', 'killCamShatter',
    ];
    for (const name of expectedImmediate) expect(IMMEDIATE_CUES.has(name)).toBe(true);
    expect(IMMEDIATE_CUES.size).toBe(24);

    const mock = createAudioSpyCtx(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      // Immediate cues use 4 ms lookahead instead of snapping to a distant 32nd-note grid
      const playSpy = jest.spyOn(chip, 'play');
      band.atTime(2.0, () => {
        band.cue('mistake');
        expect(playSpy.mock.calls.length).toBeGreaterThan(0);
        expect(playSpy.mock.calls[0][1].at).toBeCloseTo(2.004, 3);
      });

      // Rapid accelerating multStep calls (different amounts) are never silently dropped
      playSpy.mockClear();
      for (let step = 1; step <= 6; step++) {
        band.atTime(3.0 + step * 0.012, () => {
          band.cue('multStep', { slot: 0, amount: step });
        });
      }
      expect(playSpy.mock.calls.length).toBeGreaterThanOrEqual(6);

      // [AU-13]: setMood() must NOT prematurely call evolve() or reelStop
      const evolveSpy = jest.spyOn(band, 'evolve');
      const cueSpy = jest.spyOn(band, 'cue');
      band.setMood(mood());
      band.setMood(mood({ evolutions: [WEAPON_EVOLUTIONS[0].id], status: 'pick' }));
      expect(evolveSpy).not.toHaveBeenCalled();
      expect(cueSpy).not.toHaveBeenCalledWith('reelStop', expect.anything());

      // Mount-synced APIs fire cleanly on demand
      playSpy.mockClear();
      band.playCutInEvolve(WEAPON_EVOLUTIONS[0].id);
      expect(evolveSpy).toHaveBeenCalledWith(WEAPON_EVOLUTIONS[0].id, { immediate: true, leadMs: 90 });

      cueSpy.mockClear();
      band.playWeaponPickReelStop();
      expect(cueSpy).toHaveBeenCalledTimes(3);
      expect(cueSpy).toHaveBeenNthCalledWith(1, 'reelStop', { slot: 0, amount: 0, afterMs: 0 });
      expect(cueSpy).toHaveBeenNthCalledWith(2, 'reelStop', { slot: 0, amount: 1, afterMs: 75 });
      expect(cueSpy).toHaveBeenNthCalledWith(3, 'reelStop', { slot: 0, amount: 2, afterMs: 150 });

      playSpy.mockRestore();
      evolveSpy.mockRestore();
      cueSpy.mockRestore();
    } finally {
      restore();
    }
  });

  it('[AU-16] configures Phone Sim 300-5kHz Mono & Low Vol -12 dB monitor modes, reports live diagnostics & ships audition checklist', () => {
    const mock = createAudioSpyCtx(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      chip.setMonitorMode('phone');
      expect(chip.monitorMode).toBe('phone');
      expect(mock.filters.some(f => f.type === 'highpass' && f.frequency.value === 300)).toBe(true);
      expect(mock.filters.some(f => f.type === 'lowpass' && f.frequency.value === 5000)).toBe(true);

      chip.setMonitorMode('lowVol');
      expect(chip.monitorMode).toBe('lowVol');

      chip.setMonitorMode('flat');
      const diag = chip.getDiagnostics();
      expect(diag.maxVoices).toBe(MAX_VOICES);
      expect(diag.monitorMode).toBe('flat');
      expect(diag.tiers.S.count).toBeGreaterThanOrEqual(0);
    } finally {
      restore();
    }

    const checklistPath = path.resolve(__dirname, '..', 'docs', 'sound-audition-checklist.md');
    expect(fs.existsSync(checklistPath)).toBe(true);
    const text = fs.readFileSync(checklistPath, 'utf8');
    expect(text).toContain('Environment A');
    expect(text).toContain('Environment B');
    expect(text).toContain('Environment C');
    expect(text).toContain('Environment D');
  });

  it('[AU-17] [AU-18] [AU-19] [AU-20] cleans dead songs exports, ships 16-bar A-B + 136 BPM Summit + maxTempo 1.18 + Ionian hook + biome ambience', () => {
    // [AU-17]: Dead CHORDS & JINGLES removed
    expect('CHORDS' in songsMod).toBe(false);
    expect('JINGLES' in songsMod).toBe(false);

    // Every battle arrangement uses 16-bar A-B battle form; smooth BPM progression
    expect(ARRANGEMENTS.meadow.bpm).toBe(118);
    expect(ARRANGEMENTS.woods.bpm).toBe(122);
    expect(ARRANGEMENTS.canyon.bpm).toBe(128);
    expect(ARRANGEMENTS.peaks.bpm).toBe(124);
    expect(ARRANGEMENTS.summit.bpm).toBe(136);
    expect(ARRANGEMENTS.boss.bpm).toBe(148);
    for (const k of ['meadow', 'woods', 'canyon', 'peaks', 'summit', 'boss']) {
      expect(ARRANGEMENTS[k].useB).toBe(true);
      expect(ARRANGEMENTS[k].sectionB).toBe('battle');
    }

    // [AU-18]: maxTempo 1.18 caps peak boss <= 175 BPM and non-boss World 5 resolves to 'summit'
    expect(DIRECTOR.maxTempo).toBe(1.18);
    expect(ARRANGEMENTS.boss.bpm * DIRECTOR.maxTempo).toBeLessThan(175);
    expect(worldTone('summit').mode).toBe('mixolydian');
    const summitRun = startFight({ level: testLevel({ id: '5-1', biome: 'summit', isBoss: false }) });
    const summitMood = moodOf(summitRun, { arrangement: 'boss', paused: false, timeTotal: summitRun.timeLeft });
    expect(summitMood.arrangement).toBe('summit');

    // [AU-19]: Canonical Ionian THEME hook preserved on bright/neutral worlds; dark states flatten deliberately
    for (const bright of ['title', 'camp', 'map', 'meadow', 'canyon', 'peaks', 'summit']) {
      expect(resolveLeadMode(bright, 'mixolydian', false)).toBe('ionian');
      expect(resolveLeadMode(bright, 'lydian', false)).toBe('ionian');
      expect(resolveLeadMode(bright, 'dorian', true)).toBe('dorian'); // lastHeart danger flattens!
    }
    expect(resolveLeadMode('woods', 'dorian', false)).toBe('dorian');
    expect(resolveLeadMode('boss', 'aeolian', false)).toBe('aeolian');
    expect(resolveLeadMode('story', 'aeolian', false)).toBe('aeolian');

    // [AU-20]: Non-battle screen tracks + biome ambience lifecycle
    expect(ARRANGEMENTS.title.bpm).toBe(96);
    expect(ARRANGEMENTS.story.bpm).toBe(88);
    expect(ARRANGEMENTS.camp.bpm).toBe(98);
    expect(restingMix('title').drums).toBe(0);
    expect(restingMix('story').drums).toBe(0);
    expect(biomeToAmbienceKind('camp')).toBe('campfire');
    expect(biomeToAmbienceKind('summit')).toBe('mountainWind');
    expect(biomeToAmbienceKind('woods')).toBe('woodlandBreeze');
    expect(biomeToAmbienceKind('meadow')).toBe('meadowAir');

    const mock = createAudioSpyCtx(44100);
    const restore = chip.useContext(mock.ctx);
    try {
      // [AU-17]: 16-bar battle passage plays both A-section (THEME) and B-section (THEME_BATTLE_B)
      const beforePassage = chip.voiceCount;
      band.renderPassage([{ arrangement: 'summit', bars: 16 }], 0.05);
      expect(chip.voiceCount - beforePassage).toBeGreaterThan(80);

      ambience.setBiome('camp');
      expect(ambience.isPlaying).toBe(true);
      expect(ambience.activeKind).toBe('campfire');

      // Muting Music alone keeps biome ambience softly alive while SFX is ON
      setMusicEnabled(false);
      expect(ambience.isPlaying).toBe(true);

      // Backgrounding immediately stops ambience
      __setAppActiveForTests(false);
      expect(ambience.isPlaying).toBe(false);
      __setAppActiveForTests(true);
      expect(ambience.isPlaying).toBe(true);

      // Muting BOTH Music & SFX stops ambience completely
      setSfxEnabled(false);
      expect(ambience.isPlaying).toBe(false);
    } finally {
      restore();
    }
  });

  it('[AU-21] gates scaled impact, parry, hurt, KO & star-stamp haptics by MMKV HapticsStorage and routes RoundFunPrompt cleanly', async () => {
    jest.useFakeTimers();
    const origOs = Platform.OS;
    const impactAsync = jest.fn(async (_style: unknown) => undefined);
    const notificationAsync = jest.fn(async (_type: unknown) => undefined);
    const selectionAsync = jest.fn(async () => undefined);
    const mockHaptics = {
      ImpactFeedbackStyle: { Light: 'L', Medium: 'M', Heavy: 'H' },
      NotificationFeedbackType: { Success: 'S', Error: 'E', Warning: 'W' },
      impactAsync,
      notificationAsync,
      selectionAsync,
    };

    try {
      Platform.OS = 'ios';
      __setHapticsModuleForTests(mockHaptics);
      expect(HapticsStorage.get()).toBe(true);

      const seen: boolean[] = [];
      const unsub = HapticsStorage.subscribe(v => seen.push(v));

      await triggerImpactHaptic(0);
      await triggerImpactHaptic(1);
      await triggerImpactHaptic(2);
      await triggerImpactHaptic(3);
      expect(impactAsync.mock.calls.map(c => c[0])).toEqual(['L', 'M', 'H', 'H']);

      await triggerParryHaptic(false);
      await triggerParryHaptic(true);
      await triggerHurtHaptic();
      expect(impactAsync).toHaveBeenLastCalledWith('M');
      expect(notificationAsync.mock.calls.map(c => c[0])).toEqual(['S', 'E']);

      impactAsync.mockClear();
      notificationAsync.mockClear();
      await triggerKoHaptic(true);
      expect(impactAsync).toHaveBeenCalledWith('H');
      jest.advanceTimersByTime(100);
      expect(notificationAsync).toHaveBeenCalledWith('S');

      impactAsync.mockClear();
      notificationAsync.mockClear();
      await triggerStarStampHaptic(0);
      await triggerStarStampHaptic(1);
      await triggerStarStampHaptic(2);
      jest.advanceTimersByTime(80);
      expect(impactAsync.mock.calls.map(c => c[0])).toEqual(['M', 'M', 'H']);
      expect(notificationAsync).toHaveBeenCalledWith('S');

      // Disabling HapticsStorage silences every haptic trigger
      impactAsync.mockClear();
      notificationAsync.mockClear();
      selectionAsync.mockClear();
      HapticsStorage.set(false);
      expect(seen).toEqual([false]);
      expect(HapticsStorage.get()).toBe(false);

      await triggerHaptic('heavy');
      await selectionHaptic();
      await triggerImpactHaptic(3);
      await triggerParryHaptic(true);
      await triggerHurtHaptic();
      await triggerKoHaptic(true);
      await triggerStarStampHaptic(2);
      jest.advanceTimersByTime(200);
      expect(impactAsync).not.toHaveBeenCalled();
      expect(notificationAsync).not.toHaveBeenCalled();
      expect(selectionAsync).not.toHaveBeenCalled();
      unsub();

      // RoundFunPrompt must route through @/utils/haptics instead of importing expo-haptics directly
      const promptSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'components', 'RoundFunPrompt.tsx'), 'utf8');
      expect(promptSrc).not.toContain("from 'expo-haptics'");
      expect(promptSrc).toContain("from '@/utils/haptics'");
    } finally {
      Platform.OS = origOs;
      jest.useRealTimers();
    }
  });
});
