/**
 * Every weapon is a member of the band, and every evolution amplifies its voice.
 *
 * A weapon's VOICE is an instrument plus a one-bar riff. Riffs are written in
 * steps above the root of whatever chord is playing (0 root, 2 third, 4 fifth,
 * 7 octave; odd steps are passing notes), so any riff fits any bar in any key
 * or mode, and any two riffs harmonise. Holding the weapon puts the riff in
 * the music; the weapon firing plays its STING (the riff's notes as one quick
 * run) and turns its riff up for the next bars. A build you can hear.
 *
 * An evolution's THEME is anchored to its owning weapon's voice plus one of
 * three variant harmonic companions & grooves (0 = Core/Kinetic, 1 = Tactical/
 * Tempo, 2 = Wild/Escalation): 64 weapons × 3 variants = 192 unique themes,
 * nothing hand-recorded.
 *
 * Pure data and pure functions. __tests__/audioScore.test.ts checks every
 * Armory weapon has a voice and no two weapons or evolutions sound the same.
 */
import type { DrumId, InstrumentId } from './instruments';
import { hashOf, type ModeName } from './theory';

export interface WeaponVoice {
  inst: InstrumentId;
  /**
   * 16 steps of one bar. A digit is a note that many scale steps above the
   * chord root, `-` holds it, `.` rests.
   */
  riff: string;
  /** Octave of the riff's root (4 = around middle C) */
  octave: number;
  /** A drum figure the weapon adds: 16 steps, `x` hits `drum`, `o` hits `drum2` */
  beat?: string;
  drum?: DrumId;
  drum2?: DrumId;
  /** Where it sits between the left (-1) and right (1) speaker */
  pan: number;
  /** One line for the sound studio and the Armory: why it sounds like this */
  why: string;
}

type Row = [inst: InstrumentId, octave: number, riff: string, why: string, extra?: Partial<WeaponVoice>];

const ROWS: Record<string, Row> = {
  // ── Damage: the brass and the big drums ───────────────────────────────────
  'blast-powder': ['brass', 2, '0.......0..4....', 'Low brass and a kettledrum: every boom lands on the beat.', { beat: 'x.......x..x....', drum: 'timpani' }],
  'rainbow-charm': ['celesta', 5, '0.2.4.7.9.7.4.2.', 'A shimmering celesta arpeggio climbing the full spectrum.'],
  'flint-spark': ['banjo', 4, '..4.7...4.7.9...', 'A flicking banjo over a crackling fire.', { beat: '..x...x...x...x.', drum: 'crackle' }],
  'prismatic-ray': ['saw', 4, '0247....0247....', 'A beam of light sweeping up the chord.'],
  'chaos-shard': ['steel', 5, '7.0.9.2.7.4.0.9.', 'Steel-drum pings that leap about like a ricochet.'],
  'war-drum': ['horn', 2, '0---------------', 'A taiko pattern with a war horn held under it.', { beat: 'x..x..x.x..x.xx.', drum: 'taiko' }],
  'rally-horn': ['horn', 3, '0.4.7---....4.7-', 'A hunting-horn call: charge!'],
  pinata: ['toy', 5, '4.2.4.7.4.2.0...', 'A toy piano and a rattle full of sweets.', { beat: '.x.x.x.x.x.x.x.x', drum: 'shaker' }],
  'amplifier-coil': ['clav', 3, '0.07.0.70.07.4..', 'A funky electric clavinet: plugged in and humming.'],

  // ── Tricks: one clear solo instrument each, something to listen for ───────
  magnet: ['theremin', 4, '4-------2-----0-', 'A theremin sliding down: the pull of the magnet.'],
  'bounty-poster': ['whistle', 5, '7-4.7-9-7---4...', 'A lone whistle from a western.'],
  'mirror-shard': ['vibes', 5, '0.2.4.7..7.4.2.0', 'A phrase and its mirror image.'],
  'odd-one-out': ['pizz', 4, '2.2.2.2.2.2.5.2.', 'The same plucked note, with one that does not belong.'],
  'collectors-album': ['musicbox', 5, '0..2..4..7......', 'Three pages, then the music box plays the fourth note.'],
  snowball: ['glock', 6, '0.......0...0.00', 'Sleigh bells and a glockenspiel that gets busier as it rolls.', { beat: '....x...x.x.xxxx', drum: 'sleigh' }],
  'glass-sword': ['glass', 6, '7-------9-------', 'A glass harmonica: pure, high and easy to break.'],
  'devils-bargain': ['organ', 3, '0-----6-5-----4-', 'A church organ walking downstairs.'],
  tightrope: ['flute', 5, '0.1.2.3.4.3.2.1.', 'A flute placing one careful step after another.'],
  understudy: ['chipSoft', 5, '2...2...4...2...', 'A quiet blip shadowing the tune from the wings.'],

  // ── Board gambles: the uneasy corner of the band ──────────────────────────
  'cursed-idol': ['choir', 3, '0-------1-------', 'A low choir leaning on a note that wants to move.'],
  'chain-gang': ['pizz', 2, '0..0....0..0....', 'A work song: bass plucks and chains on the backbeat.', { beat: '....x.......x..o', drum: 'chain', drum2: 'anvil' }],
  'thorn-bush': ['pluck', 5, '9..7..9..7..9.7.', 'Prickly plucks that cut across the beat.'],
  rust: ['accordion', 3, '7-6-5-4-........', 'A wheezing old squeezebox running out of air.'],
  'tar-pit': ['sub', 2, '0-----0---4-----', 'A slow, sticky sub-bass you can feel.', { beat: 'x.........x.....', drum: 'thud' }],
  decoy: ['celesta', 5, '4.5.....4.5.....', 'Two notes a step apart: which one is real?'],
  'long-fuse': ['clav', 4, '........0.2.4567', 'A fuse ticking, then racing up to the bang.', { beat: 'x...x...x.x.xxxx', drum: 'tick' }],
  'ice-block': ['celesta', 6, '7-----9-----4---', 'Slow icicles, high up.'],
  'greedy-chest': ['glock', 5, '0...02..024.0247', 'One more coin each time: the run grows as you wait.'],
  'hot-potato': ['marimba', 4, '0..7..0..7..0.7.', 'A marimba bouncing from hand to hand.'],
  'twin-seed': ['kalimba', 4, '0.0.4.4.2.2.7.7.', 'Every note comes as a pair.'],
  'fog-lantern': ['horn', 2, '0-----------4---', 'A foghorn across the water.'],

  // ── Board: the wide, slow instruments ─────────────────────────────────────
  'field-stone': ['strings', 3, '0-------4-------', 'Strings spreading out: a bigger field.'],
  'growth-seed': ['kalimba', 5, '0.2.4.7.9.......', 'A kalimba growing up the chord like a shoot.'],
  'clarity-lens': ['bell', 5, '0.......4.......', 'Two clear bells and a lot of space.'],
  'wild-card': ['accordion', 4, '0.4.2.7.1.5.3.9.', 'A circus accordion that goes anywhere it likes.'],

  // ── Hearts & graces: the warm instruments ─────────────────────────────────
  'mending-charm': ['harp', 4, '0.2.4.7.4.2.....', 'A harp rolling the chord: the sound of a heart coming back.'],
  'life-vessel': ['strings', 4, '2---------------', 'One warm held note. More hearts, more warmth.'],
  'life-link': ['choir', 4, '4-------2-------', 'A choir that answers when you are hurt.'],
  'soul-harvest': ['theremin', 3, '0---4---7---4---', 'A ghostly theremin collecting what is left.'],
  'revenge-linker': ['brass', 3, '....0.0.....0.4.', 'Angry brass stabs on the off-beat.'],
  'second-chance': ['vibes', 4, '4.....2.....0...', 'A close call, falling gently back home.'],
  'fortune-token': ['musicbox', 6, '7...4...9...7...', 'A lucky charm on a music box.'],
  'grace-conduit': ['harp', 5, '7.4.2.0.........', 'A harp falling like a held breath let go.'],
  'chaos-conduit': ['steel', 4, '0..2..4..9..7...', 'Steel drums stumbling into a blast.'],

  // ── Hints, coins & XP: glass, coins and books ─────────────────────────────
  'seeker-lens': ['pluck', 4, '0...4...0...7...', 'A plucked question: is it here? Or here?'],
  'crystal-orb': ['glass', 5, '4-----------7---', 'A crystal bowl ringing.'],
  'oracle-eye': ['flute', 4, '0-----2-----4---', 'A patient flute: wait, and it tells you.'],
  'mystic-sight': ['celesta', 4, '0.4.9.....0.4.9.', 'Three notes, the third one the surprise.'],
  'fortunes-favor': ['glock', 6, '4.7.4.7.........', 'Two coins clinking.'],
  'fortunes-blessing': ['bell', 6, '0...2...4...7...', 'Bells counting out a small fortune.'],
  'scholars-tome': ['organ', 4, '0-2-4-2-0-2-4-7-', 'A patient study in thirds.'],
  'wisdom-chain': ['marimba', 5, '0.2.0.4.0.7.0.9.', 'Each answer reaches one step further.'],

  // ── Time & evolutions: clocks and curtain calls ───────────────────────────
  'chrono-shard': ['bell', 4, '0-------........', 'A clock tower and the tick-tock under it.', { beat: 'x...o...x...o...', drum: 'woodblock', drum2: 'woodblockLo' }],
  'time-drop': ['toy', 4, '7.....4.....7...', 'Drops of time landing in a tin cup.', { beat: '..x...x...x...x.', drum: 'woodblockLo' }],
  'temporal-rift': ['saw', 3, '7654............', 'Time running backwards.'],
  'catalyst-prism': ['bell', 5, '0.4.7.9.7.4.....', 'Light through a prism, up and back.'],
  'encore-mask': ['brass', 4, '0.0.4---....7---', 'The theatre band strikes up again: encore!'],

  // ── Echoes & links: things that repeat ────────────────────────────────────
  'echo-stone': ['pluck', 5, '7...7.7.........', 'A note, and its echo, and its echo.'],
  'chain-reaction': ['clav', 5, '0.2.4.0.2.4.0.2.', 'Three notes knocking each other over, round and round.'],
  'cascade-core': ['harp', 6, '9.7.4.2.0.......', 'A waterfall down the harp.'],
  connector: ['pizz', 5, '0...7...0...7...', 'Two plucked notes, tied together.'],
  'web-weaver': ['vibes', 6, '0.4.7.4.0.4.7.4.', 'A web spun out of one chord.'],
  'neural-network': ['chipSoft', 6, '0.7.2.9.4.7.2.0.', 'Blips firing across the network.'],
  'echo-chamber': ['flute', 6, '4-------....4...', 'A flute in a very large room.'],
};

/** Left-to-right seat of a voice: stable per weapon, never dead centre (the tune lives there). */
const seatOf = (id: string): number => {
  const h = hashOf(id);
  const side = h & 1 ? 1 : -1;
  return side * (0.25 + ((h >>> 3) % 5) * 0.1);
};

export const WEAPON_VOICES: Record<string, WeaponVoice> = Object.fromEntries(
  Object.entries(ROWS).map(([id, [inst, octave, riff, why, extra]]) => [id, { inst, octave, riff, why, pan: seatOf(id), ...extra }])
);

/** A weapon nobody wrote a voice for still gets one, from its id: never silent, never the same as its neighbour. */
const FALLBACK_INSTS: InstrumentId[] = ['pluck', 'marimba', 'kalimba', 'pizz', 'celesta', 'vibes', 'harp', 'steel'];
const FALLBACK_STEPS = [0, 2, 4, 7, 9];
const fallbackVoice = (id: string): WeaponVoice => {
  let h = hashOf(id);
  const next = (n: number) => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    return (h >>> 8) % n;
  };
  const riff = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 && next(3) > 0 ? String(FALLBACK_STEPS[next(5)]) : '.')).join('');
  return { inst: FALLBACK_INSTS[next(FALLBACK_INSTS.length)], octave: 4 + next(2), riff: riff.replace(/^\./, '0'), pan: seatOf(id), why: 'A voice made from its name.' };
};

/** Base id of a weapon held in a run ("blast-powder", from rule keys like "w2:blast-powder#0" or "weapon:blast-powder"). */
export const weaponIdOf = (source: string): string | null => {
  const m = /^(?:w\d*|weapon):([a-z0-9-]+?)(#\d+)?$/.exec(source);
  return m ? m[1] : null;
};
/** Evolution id from an evolution's rule key ("evo:blast-powder:cluster-charge#0" or legacy "evo:phoenix-pyre#1"). */
export const evolutionIdOf = (source: string): string | null => {
  const m = /^evo:([a-z0-9-]+(?::[a-z0-9-]+)?)(#\d+)?$/.exec(source);
  return m ? m[1] : null;
};
/** Back-compat alias for `evolutionIdOf`. */
export const recipeIdOf = evolutionIdOf;

export const hasWeaponVoice = (id: string): boolean => id in WEAPON_VOICES;
const made = new Map<string, WeaponVoice>();
export const weaponVoice = (id: string): WeaponVoice => {
  const known = WEAPON_VOICES[id] ?? made.get(id);
  if (known) return known;
  const voice = fallbackVoice(id);
  made.set(id, voice);
  return voice;
};

/** The notes of a riff, in order: [step, start (0–15), length in steps]. */
export const riffNotes = (riff: string): [step: number, at: number, len: number][] => {
  const out: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const c = riff[i];
    if (c === undefined || c < '0' || c > '9') continue;
    let len = 1;
    while (i + len < 16 && riff[i + len] === '-') len++;
    out.push([c.charCodeAt(0) - 48, i, len]);
  }
  return out;
};

/** The weapon's calling card: the first notes of its riff that differ, as one quick upward-sorted run (at most four). */
export const stingOf = (voice: WeaponVoice): number[] => {
  const seen: number[] = [];
  for (const [step] of riffNotes(voice.riff)) if (!seen.includes(step)) seen.push(step);
  const run = seen.slice(0, 4);
  return run.length > 1 ? run : [run[0] ?? 0, (run[0] ?? 0) + 4];
};

/** Everything that makes one voice different from another, as one string. */
export const voiceSignature = (v: WeaponVoice): string => `${v.inst}|${v.octave}|${v.riff}|${v.beat ?? ''}|${v.drum ?? ''}`;

// ─── Evolutions ─────────────────────────────────────────────────────────────

export type EvolutionGroove = 'fourFloor' | 'gallop' | 'breakbeat' | 'march';
export type EvolutionVariantIndex = 0 | 1 | 2;

export interface EvolutionTheme {
  /** Owning Armory weapon whose voice anchors this evolution's lead & riff */
  weaponId: string;
  /** Variant slot on the weapon: 0 = Core/Kinetic, 1 = Tactical/Tempo, 2 = Wild/Escalation */
  variantIndex: EvolutionVariantIndex;
  /** Single-element weapon list for band spotlight exclusion */
  weapons: [string];
  /** Scale steps above the tonic of the opening fanfare: weapon sting + variant companion answer + climax */
  fanfare: number[];
  /** Semitones the whole band rises while it is active (2..7) */
  lift: number;
  /** Steps brighter the mode becomes (the tune turns sunnier) */
  brighten: number;
  groove: EvolutionGroove;
  /** [lead (weapon voice), harmonic companion (variant timbre)] that carry the fanfare & active layer */
  insts: [InstrumentId, InstrumentId];
}

const LIFTS = [2, 3, 4, 5, 7] as const;
/** A fanfare needs instruments that speak quickly: slow swells borrow the brass. */
const SLOW: InstrumentId[] = ['strings', 'choir', 'glass', 'theremin', 'sub', 'horn'];
const fanfareInst = (inst: InstrumentId): InstrumentId => (SLOW.includes(inst) ? 'brass' : inst);

/** Disjoint companion timbres per variant so Evo A / B / C of every weapon sound unmistakably distinct. */
const VARIANT_COMPANIONS: Record<EvolutionVariantIndex, readonly InstrumentId[]> = {
  0: ['brass', 'glock', 'bell', 'marimba'],       // Core / Kinetic: bright octave brass/chime
  1: ['vibes', 'flute', 'harp', 'kalimba'],       // Tactical / Tempo: perfect-fifth counter-melody
  2: ['celesta', 'saw', 'steel', 'musicbox'],     // Wild / Escalation: triad arpeggio synth/bell
};

/** Variant-shaped melodic answer patterns (scale steps above chord root) so every weapon × variant has a bespoke cadence. */
const VARIANT_ANSWERS: Record<EvolutionVariantIndex, readonly (readonly number[])[]> = {
  // Variant 0 (Core / Kinetic): bright octave lifts & sunlit triadic leaps
  0: [
    [4, 7],
    [2, 7],
    [4, 9],
    [7, 9],
    [2, 4, 7],
    [0, 4, 7],
  ],
  // Variant 1 (Tactical / Tempo): fifth-anchored counter-melodies & syncopated turns
  1: [
    [4, 6, 7],
    [5, 4, 7],
    [4, 7, 6],
    [2, 6, 4],
    [4, 5, 9],
    [6, 4, 9],
  ],
  // Variant 2 (Wild / Escalation): soaring triad arpeggios & heroic climbs
  2: [
    [0, 2, 4, 7],
    [2, 4, 7, 9],
    [0, 4, 7, 9],
    [4, 7, 9, 11],
    [2, 7, 4, 9],
    [0, 4, 2, 7],
  ],
};

/** Pick a companion instrument distinct from the weapon's lead voice so the harmony always pops. */
const pickCompanion = (variantIndex: EvolutionVariantIndex, lead: InstrumentId, h: number): InstrumentId => {
  const pool = VARIANT_COMPANIONS[variantIndex];
  const start = (h >>> 5) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(start + i) % pool.length];
    if (candidate !== lead) return candidate;
  }
  return pool[start];
};

/**
 * Deterministic per-weapon evolution theme from its id, owning weapon, and variant index (0 | 1 | 2).
 *
 * - Lead is ALWAYS `weaponVoice(weaponId)` so players recognize which weapon evolved.
 * - Variant 0 (Core / Kinetic): bright octave brass/chime companion, `fourFloor` groove, major/Lydian lift.
 * - Variant 1 (Tactical / Tempo): perfect-fifth counter-melody companion, `gallop` groove, tempo drive.
 * - Variant 2 (Wild / Escalation): triad arpeggio synth/bell companion, `breakbeat`/`march` groove, heroic climb.
 */
export const evolutionTheme = (
  evoId: string,
  weaponId: string,
  variantIndex: EvolutionVariantIndex = 0
): EvolutionTheme => {
  const h = hashOf(evoId);
  const v = weaponVoice(weaponId);
  const leadInst = fanfareInst(v.inst);
  const companionInst = pickCompanion(variantIndex, leadInst, h);
  const baseSting = stingOf(v);

  const patterns = VARIANT_ANSWERS[variantIndex];
  const pattern = patterns[(h >>> 9) % patterns.length];
  const anchor = variantIndex === 1 ? baseSting[baseSting.length - 1] % 3 : variantIndex === 2 ? baseSting[0] % 2 : 0;
  const answer = pattern.map(step => step + anchor);

  const preClimax = [...baseSting, ...answer];
  if (preClimax.length < 4) preClimax.push(4);
  const peak = Math.max(...preClimax);
  const baseClimax = 7 + ((h >>> 13) % 3) * 2;
  const climax = baseClimax >= peak ? baseClimax : peak + 2;

  const groove: EvolutionGroove =
    variantIndex === 0 ? 'fourFloor' : variantIndex === 1 ? 'gallop' : ((h >>> 2) & 1) === 0 ? 'breakbeat' : 'march';
  const brighten = variantIndex === 0 ? 1 : variantIndex === 1 ? 1 + ((h >>> 3) % 2) : 2;
  const lift = LIFTS[(h + variantIndex) % LIFTS.length];

  return {
    weaponId,
    variantIndex,
    weapons: [weaponId],
    fanfare: [...preClimax, climax],
    lift,
    brighten,
    groove,
    insts: [leadInst, companionInst],
  };
};

export const themeSignature = (t: EvolutionTheme): string =>
  `${t.fanfare.join(',')}|${t.lift}|${t.brighten}|${t.groove}|${t.insts.join('+')}`;

/** How an evolution re-colours the mode it lands on. */
export const brightened = (mode: ModeName, theme: EvolutionTheme, shadeFn: (m: ModeName, steps: number) => ModeName): ModeName =>
  shadeFn(mode, -theme.brighten);
