/**
 * Every weapon is a member of the band, and every evolution is a duet.
 *
 * A weapon's VOICE is an instrument plus a one-bar riff. Riffs are written in
 * steps above the root of whatever chord is playing (0 root, 2 third, 4 fifth,
 * 7 octave; odd steps are passing notes), so any riff fits any bar in any key
 * or mode, and any two riffs harmonise. Holding the weapon puts the riff in
 * the music; the weapon firing plays its STING (the riff's notes as one quick
 * run) and turns its riff up for the next bars. A build you can hear.
 *
 * An evolution's THEME is made from its two weapons: both stings as one
 * fanfare, both riffs together an octave up on the power instrument, a key
 * lift and a brighter mode. 204 recipes, 204 themes, nothing hand-recorded.
 *
 * Pure data and pure functions. __tests__/audioVoices.test.ts checks every
 * Armory weapon has a voice and no two weapons or recipes sound the same.
 */
import type { RunEventType } from '@/adventure/types';
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
  /** Fight events with no rule behind them that this weapon is the cause of (a blast, a heal…) */
  events?: RunEventType[];
  /** Callout texts that mean this weapon paid out (trick weapons announce themselves by name) */
  calls?: string[];
  /** One line for the sound studio and the Armory: why it sounds like this */
  why: string;
}

type Row = [inst: InstrumentId, octave: number, riff: string, why: string, extra?: Partial<WeaponVoice>];

const ROWS: Record<string, Row> = {
  // ── Damage: the brass and the big drums ───────────────────────────────────
  'blast-powder': ['brass', 2, '0.......0..4....', 'Low brass and a kettledrum: every boom lands on the beat.', { beat: 'x.......x..x....', drum: 'timpani', events: ['blast'] }],
  'flint-spark': ['banjo', 4, '..4.7...4.7.9...', 'A flicking banjo over a crackling fire.', { beat: '..x...x...x...x.', drum: 'crackle', events: ['fire'] }],
  'prismatic-ray': ['saw', 4, '0247....0247....', 'A beam of light sweeping up the chord.', { events: ['laser'] }],
  'chaos-shard': ['steel', 5, '7.0.9.2.7.4.0.9.', 'Steel-drum pings that leap about like a ricochet.', { events: ['ricochet'] }],
  'war-drum': ['horn', 2, '0---------------', 'A taiko pattern with a war horn held under it.', { beat: 'x..x..x.x..x.xx.', drum: 'taiko', events: ['empowered'] }],
  'rally-horn': ['horn', 3, '0.4.7---....4.7-', 'A hunting-horn call: charge!', { events: ['charged'] }],
  pinata: ['toy', 5, '4.2.4.7.4.2.0...', 'A toy piano and a rattle full of sweets.', { beat: '.x.x.x.x.x.x.x.x', drum: 'shaker', events: ['pinata', 'pinata_break'] }],
  'amplifier-coil': ['clav', 3, '0.07.0.70.07.4..', 'A funky electric clavinet: plugged in and humming.', { events: ['doubled', 'double_ready'] }],

  // ── Tricks: one clear solo instrument each, something to listen for ───────
  magnet: ['theremin', 4, '4-------2-----0-', 'A theremin sliding down: the pull of the magnet.', { calls: ['Magnet'] }],
  'bounty-poster': ['whistle', 5, '7-4.7-9-7---4...', 'A lone whistle from a western.', { calls: ['Bounty'] }],
  'mirror-shard': ['vibes', 5, '0.2.4.7..7.4.2.0', 'A phrase and its mirror image.', { calls: ['Mirror'] }],
  'odd-one-out': ['pizz', 4, '2.2.2.2.2.2.5.2.', 'The same plucked note, with one that does not belong.', { calls: ['Odd one out'] }],
  'collectors-album': ['musicbox', 5, '0..2..4..7......', 'Three pages, then the music box plays the fourth note.', { calls: ['Album'] }],
  snowball: ['glock', 6, '0.......0...0.00', 'Sleigh bells and a glockenspiel that gets busier as it rolls.', { beat: '....x...x.x.xxxx', drum: 'sleigh', calls: ['Snowball'] }],
  'glass-sword': ['glass', 6, '7-------9-------', 'A glass harmonica: pure, high and easy to break.', { calls: ['Glass Sword'] }],
  'devils-bargain': ['organ', 3, '0-----6-5-----4-', 'A church organ walking downstairs.', { calls: ["Devil's Bargain"] }],
  tightrope: ['flute', 5, '0.1.2.3.4.3.2.1.', 'A flute placing one careful step after another.', { calls: ['Tightrope'] }],
  understudy: ['chipSoft', 5, '2...2...4...2...', 'A quiet blip shadowing the tune from the wings.'],

  // ── Board gambles: the uneasy corner of the band ──────────────────────────
  'cursed-idol': ['choir', 3, '0-------1-------', 'A low choir leaning on a note that wants to move.', { calls: ['Curse'] }],
  'chain-gang': ['pizz', 2, '0..0....0..0....', 'A work song: bass plucks and chains on the backbeat.', { beat: '....x.......x..o', drum: 'chain', drum2: 'anvil', calls: ['Chain Gang'] }],
  'thorn-bush': ['pluck', 5, '9..7..9..7..9.7.', 'Prickly plucks that cut across the beat.', { calls: ['Thorns'] }],
  rust: ['accordion', 3, '7-6-5-4-........', 'A wheezing old squeezebox running out of air.'],
  'tar-pit': ['sub', 2, '0-----0---4-----', 'A slow, sticky sub-bass you can feel.', { beat: 'x.........x.....', drum: 'thud', calls: ['Tar Pit'] }],
  decoy: ['celesta', 5, '4.5.....4.5.....', 'Two notes a step apart: which one is real?', { calls: ['Decoy'] }],
  'long-fuse': ['clav', 4, '........0.2.4567', 'A fuse ticking, then racing up to the bang.', { beat: 'x...x...x.x.xxxx', drum: 'tick', calls: ['Short fuse', 'Fuse'] }],
  'ice-block': ['celesta', 6, '7-----9-----4---', 'Slow icicles, high up.', { calls: ['Thawed', 'Ice'] }],
  'greedy-chest': ['glock', 5, '0...02..024.0247', 'One more coin each time: the run grows as you wait.', { calls: ['Greedy Chest'] }],
  'hot-potato': ['marimba', 4, '0..7..0..7..0.7.', 'A marimba bouncing from hand to hand.', { calls: ['Hot Potato'] }],
  'twin-seed': ['kalimba', 4, '0.0.4.4.2.2.7.7.', 'Every note comes as a pair.', { calls: ['Twin'] }],
  'fog-lantern': ['horn', 2, '0-----------4---', 'A foghorn across the water.', { calls: ['The fog lifts'] }],

  // ── Board: the wide, slow instruments ─────────────────────────────────────
  'field-stone': ['strings', 3, '0-------4-------', 'Strings spreading out: a bigger field.'],
  'growth-seed': ['kalimba', 5, '0.2.4.7.9.......', 'A kalimba growing up the chord like a shoot.', { calls: ['Bloom'] }],
  'clarity-lens': ['bell', 5, '0.......4.......', 'Two clear bells and a lot of space.', { events: ['simplified'] }],
  'wild-card': ['accordion', 4, '0.4.2.7.1.5.3.9.', 'A circus accordion that goes anywhere it likes.'],

  // ── Hearts & graces: the warm instruments ─────────────────────────────────
  'mending-charm': ['harp', 4, '0.2.4.7.4.2.....', 'A harp rolling the chord: the sound of a heart coming back.', { events: ['heal'] }],
  'life-vessel': ['strings', 4, '2---------------', 'One warm held note. More hearts, more warmth.'],
  'life-link': ['choir', 4, '4-------2-------', 'A choir that answers when you are hurt.'],
  'soul-harvest': ['theremin', 3, '0---4---7---4---', 'A ghostly theremin collecting what is left.'],
  'revenge-linker': ['brass', 3, '....0.0.....0.4.', 'Angry brass stabs on the off-beat.'],
  'second-chance': ['vibes', 4, '4.....2.....0...', 'A close call, falling gently back home.', { events: ['grace'] }],
  'fortune-token': ['musicbox', 6, '7...4...9...7...', 'A lucky charm on a music box.'],
  'grace-conduit': ['harp', 5, '7.4.2.0.........', 'A harp falling like a held breath let go.'],
  'chaos-conduit': ['steel', 4, '0..2..4..9..7...', 'Steel drums stumbling into a blast.'],

  // ── Hints, coins & XP: glass, coins and books ─────────────────────────────
  'seeker-lens': ['pluck', 4, '0...4...0...7...', 'A plucked question: is it here? Or here?', { events: ['hint'] }],
  'crystal-orb': ['glass', 5, '4-----------7---', 'A crystal bowl ringing.'],
  'oracle-eye': ['flute', 4, '0-----2-----4---', 'A patient flute: wait, and it tells you.', { events: ['patience'] }],
  'mystic-sight': ['celesta', 4, '0.4.9.....0.4.9.', 'Three notes, the third one the surprise.'],
  'fortunes-favor': ['glock', 6, '4.7.4.7.........', 'Two coins clinking.', { events: ['coins'] }],
  'fortunes-blessing': ['bell', 6, '0...2...4...7...', 'Bells counting out a small fortune.'],
  'scholars-tome': ['organ', 4, '0-2-4-2-0-2-4-7-', 'A patient study in thirds.'],
  'wisdom-chain': ['marimba', 5, '0.2.0.4.0.7.0.9.', 'Each answer reaches one step further.'],

  // ── Time & evolutions: clocks and curtain calls ───────────────────────────
  'chrono-shard': ['bell', 4, '0-------........', 'A clock tower and the tick-tock under it.', { beat: 'x...o...x...o...', drum: 'woodblock', drum2: 'woodblockLo' }],
  'time-drop': ['toy', 4, '7.....4.....7...', 'Drops of time landing in a tin cup.', { beat: '..x...x...x...x.', drum: 'woodblockLo', events: ['time_gain'] }],
  'temporal-rift': ['saw', 3, '7654............', 'Time running backwards.'],
  'catalyst-prism': ['bell', 5, '0.4.7.9.7.4.....', 'Light through a prism, up and back.', { events: ['catalyst_spawn'] }],
  'encore-mask': ['brass', 4, '0.0.4---....7---', 'The theatre band strikes up again: encore!'],

  // ── Echoes & links: things that repeat ────────────────────────────────────
  'echo-stone': ['pluck', 5, '7...7.7.........', 'A note, and its echo, and its echo.'],
  'chain-reaction': ['clav', 5, '0.2.4.0.2.4.0.2.', 'Three notes knocking each other over, round and round.'],
  'cascade-core': ['harp', 6, '9.7.4.2.0.......', 'A waterfall down the harp.'],
  connector: ['pizz', 5, '0...7...0...7...', 'Two plucked notes, tied together.', { events: ['link'] }],
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

/** Base id of a weapon held in a run ("blast-powder", also from a rule key like "w2:blast-powder#0"). */
export const weaponIdOf = (source: string): string | null => {
  const m = /^w\d*:([a-z0-9-]+?)(#\d+)?$/.exec(source);
  return m ? m[1] : null;
};
/** Recipe id from an evolution's rule key ("evo:phoenix-pyre#1"). */
export const recipeIdOf = (source: string): string | null => {
  const m = /^evo:([a-z0-9-]+?)(#\d+)?$/.exec(source);
  return m ? m[1] : null;
};

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

/** Which held weapon a sourceless event belongs to (the first that claims it). */
export const ownerOfEvent = (type: RunEventType, text: string | undefined, held: readonly string[]): string | null => {
  for (const id of held) {
    const v = WEAPON_VOICES[id];
    if (!v) continue;
    if (text && v.calls?.some(c => text.startsWith(c))) return id;
  }
  for (const id of held) if (WEAPON_VOICES[id]?.events?.includes(type)) return id;
  return null;
};

// ─── Evolutions ─────────────────────────────────────────────────────────────

export type EvolutionGroove = 'fourFloor' | 'gallop' | 'breakbeat' | 'march';

export interface EvolutionTheme {
  /** The two ingredient weapons whose voices it is made of */
  weapons: [string, string];
  /** Scale steps above the tonic of the opening fanfare: weapon one's sting, weapon two's, then the octave */
  fanfare: number[];
  /** Semitones the whole band rises while it is active */
  lift: number;
  /** Steps brighter the mode becomes (the tune turns sunnier) */
  brighten: number;
  groove: EvolutionGroove;
  /** The two instruments that carry the fanfare */
  insts: [InstrumentId, InstrumentId];
}

const LIFTS = [2, 3, 4, 5, 7];
const GROOVES: EvolutionGroove[] = ['fourFloor', 'gallop', 'breakbeat', 'march'];
/** A fanfare needs instruments that speak quickly: slow swells borrow the brass. */
const SLOW: InstrumentId[] = ['strings', 'choir', 'glass', 'theremin', 'sub', 'horn'];
const fanfareInst = (inst: InstrumentId): InstrumentId => (SLOW.includes(inst) ? 'brass' : inst);

/** The theme of a recipe, from its id and the first weapon of each of its two families. */
export const evolutionTheme = (recipeId: string, families: readonly [readonly string[], readonly string[]]): EvolutionTheme => {
  const a = families[0][0] ?? recipeId;
  const b = families[1][0] ?? recipeId;
  const h = hashOf(recipeId);
  const va = weaponVoice(a);
  const vb = weaponVoice(b);
  const second = stingOf(vb).map(s => s + 2); // answered a third higher: a duet, not an echo
  return {
    weapons: [a, b],
    fanfare: [...stingOf(va), ...second, 7 + (h % 3) * 2],
    lift: LIFTS[h % LIFTS.length],
    brighten: 1 + ((h >>> 4) % 2),
    groove: GROOVES[(h >>> 7) % GROOVES.length],
    insts: [fanfareInst(va.inst), fanfareInst(vb.inst)],
  };
};

export const themeSignature = (t: EvolutionTheme): string => `${t.fanfare.join(',')}|${t.lift}|${t.brighten}|${t.groove}|${t.insts.join('+')}`;

/** How an evolution re-colours the mode it lands on. */
export const brightened = (mode: ModeName, theme: EvolutionTheme, shadeFn: (m: ModeName, steps: number) => ModeName): ModeName =>
  shadeFn(mode, -theme.brighten);
