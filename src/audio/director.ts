/**
 * The director: reads the state of a fight and decides how the band plays.
 *
 * Pure. A FightMood goes in (hearts, clock, foe, streak, evolutions, what is
 * on the board) and a Mix comes out (mode, leadMode, tempo, key, which layers
 * play, how muffled the music is). The band (src/audio/band.ts) only follows
 * the Mix, so "what does the music tell the player" is all in this one file.
 *
 * What you can hear, and what it means:
 *   the tune turning minor      you are losing hearts
 *   a heartbeat, music muffled  one heart left
 *   tick-tock, then faster      the clock is running out
 *   more of the band playing    the foe is falling; you are on a streak
 *   the band softening gently   you have not made a Set in a while (never dead)
 *   a drum roll under it all    the foe is nearly down: finish it
 *   everything a key higher     an evolution is live (each recipe has its own theme)
 *   the music slowing, mellow   level-up pick or the shop: take your time
 */
import { shade, type ModeName } from './theory';

export interface FightAlerts {
  /** Cursed cards on the board */
  cursed: number;
  /** The Hot Potato is about to jump */
  potatoSoon: boolean;
  /** Fuses in their last seconds */
  fuseHot: number;
  /** A thorn card is about to bite */
  thornSoon: boolean;
  /** The Glass Sword's window is nearly shut */
  glassLow: boolean;
  /** A foe's bomb or countdown card is close to going off */
  bombSoon: boolean;
}

export const NO_ALERTS: FightAlerts = { cursed: 0, potatoSoon: false, fuseHot: 0, thornSoon: false, glassLow: false, bombSoon: false };

/**
 * Cap concurrent board alert layers to the top `max` most lethal threats ([AU-05]).
 * Strict lethality priority:
 *   1. bombSoon -> 2. fuseHot -> 3. potatoSoon -> 4. thornSoon -> 5. glassLow -> 6. cursed
 */
export const capAlerts = (alerts: FightAlerts, max = 2): FightAlerts => {
  const limit = Math.max(0, Math.floor(max));
  if (limit === 0) return NO_ALERTS;
  const out: FightAlerts = { ...NO_ALERTS };
  let kept = 0;

  if (alerts.bombSoon && kept < limit) {
    out.bombSoon = true;
    kept += 1;
  }
  if (alerts.fuseHot > 0 && kept < limit) {
    out.fuseHot = alerts.fuseHot;
    kept += 1;
  }
  if (alerts.potatoSoon && kept < limit) {
    out.potatoSoon = true;
    kept += 1;
  }
  if (alerts.thornSoon && kept < limit) {
    out.thornSoon = true;
    kept += 1;
  }
  if (alerts.glassLow && kept < limit) {
    out.glassLow = true;
    kept += 1;
  }
  if (alerts.cursed > 0 && kept < limit) {
    out.cursed = alerts.cursed;
    kept += 1;
  }
  return out;
};

export interface FightMood {
  /** The world's arrangement (title, story, camp, map, meadow, woods, canyon, peaks, summit, boss) */
  arrangement: string;
  boss: boolean;
  status: 'playing' | 'pick' | 'pick_evolution' | 'intermission' | 'won' | 'lost';
  paused: boolean;
  /** null = this level has no hearts */
  hearts: number | null;
  maxHearts: number | null;
  /** Seconds left and the level's starting clock; null = untimed */
  timeLeft: number | null;
  timeTotal: number | null;
  /** Foe HP left, 0..1 */
  foeHp: number;
  wave: number;
  waves: number;
  combo: number;
  hotStreak: boolean;
  /** Active recipe ids, oldest first */
  evolutions: string[];
  /** ms until the next evolution ends (Infinity when none) */
  evolutionEndsMs: number;
  /** ms since the player's last Set */
  idleMs: number;
  /** Deep Freeze: the clock and the foe stand still */
  frozen: boolean;
  /** Held weapon ids, in slot order */
  weapons: string[];
  alerts: FightAlerts;
}

export interface Mix {
  arrangement: string;
  /** Harmonic mode used by chords, bass, arpeggio, counter-melody and cues */
  mode: ModeName;
  /**
   * Mode used by the THEME signature lead hook ([AU-19]):
   * stays canonical 'ionian' across bright/neutral worlds so the hook stays
   * hummable, applying modal lead-flattening strictly in deliberate dark states
   * (woods Dorian, boss Aeolian, story abduction, or lastHeart danger).
   */
  leadMode: ModeName;
  /** Semitones above the world's home key */
  lift: number;
  /** Tempo as a multiple of the arrangement's own */
  tempo: number;
  /** 0..1: how much of the band is playing */
  intensity: number;
  /** 0 none · 1 light · 2 full · 3 driving (extra hats and claps) */
  drums: 0 | 1 | 2 | 3;
  lead: boolean;
  /** Smooth 0..1 gain for the lead melody (floored at 0.35 during idle scanning so music never dies) */
  leadGain: number;
  arp: boolean;
  pad: boolean;
  /** The tune harmonised a third below */
  counter: boolean;
  /** Low-pass on the music, Hz */
  filterHz: number;
  /** Music level, 0..1 */
  level: number;
  heartbeat: boolean;
  /** 0 none · 1 tick-tock · 2 racing */
  clock: 0 | 1 | 2;
  /** Drum roll: the foe is nearly down */
  finisher: boolean;
  /** Mellow half-speed feel between waves and on level-up picks */
  lounge: boolean;
  frozen: boolean;
  /** How many weapon riffs take a turn each bar */
  spotlights: number;
  evolutions: string[];
  /** The newest evolution is about to end: its layer flickers */
  evolutionFading: boolean;
  weapons: string[];
  alerts: FightAlerts;
}

/**
 * Each world's home key (semitones above C) and mode. Every world shares the
 * map's key, so walking from the map into a fight never transposes the tune:
 * the home note stays put and only the colour (the mode) changes. Key changes
 * are kept for things that happen IN a fight (a new wave, an evolution).
 */
export const WORLD_TONE: Record<string, { key: number; mode: ModeName }> = {
  title: { key: 0, mode: 'ionian' },
  story: { key: 0, mode: 'aeolian' },
  camp: { key: 0, mode: 'ionian' },
  map: { key: 0, mode: 'ionian' },
  meadow: { key: 0, mode: 'ionian' },
  woods: { key: 0, mode: 'dorian' },
  canyon: { key: 0, mode: 'mixolydian' },
  peaks: { key: 0, mode: 'lydian' },
  summit: { key: 0, mode: 'mixolydian' },
  boss: { key: 0, mode: 'aeolian' },
};
export const worldTone = (arrangement: string) => WORLD_TONE[arrangement] ?? WORLD_TONE.map;

/** Arrangements where deliberate dark modal lead-flattening is part of the drama ([AU-19]). */
export const DARK_LEAD_ARRANGEMENTS: ReadonlySet<string> = new Set(['woods', 'boss', 'story']);

/** Resolve the mode for the THEME lead hook ([AU-19]). */
export const resolveLeadMode = (arrangement: string, harmonicMode: ModeName, lastHeart: boolean): ModeName => {
  if (lastHeart || DARK_LEAD_ARRANGEMENTS.has(arrangement)) return harmonicMode;
  return 'ionian';
};

export const DIRECTOR = {
  /** Clock: tick-tock starts here (share of the clock left, and never before this many seconds) */
  clockShare: 0.25,
  clockSeconds: 20,
  /** Clock: racing ticks */
  racingSeconds: 8,
  /** Foe HP share under which the drum roll starts */
  finisherHp: 0.2,
  /** Idle ([AU-18]): gentle fade during deep scanning, never going silent or underwater */
  idleStartMs: 10000,
  idleThinMs: 16000,
  idleQuietMs: 34000,
  idleLeadFloor: 0.35,
  idleFilterFloorHz: 9500,
  /** An evolution's layer flickers for its last seconds */
  evolutionFadeMs: 5000,
  /** Tempo: each Set of a streak adds this, up to `comboTempoCap` */
  comboTempo: 0.02,
  comboTempoCap: 0.1,
  /** [AU-18]: 1.18 caps 148 BPM boss at ~175 BPM & 136 BPM summit at ~160 BPM */
  maxTempo: 1.18,
} as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** The calm Mix the map, title, story, and camp screens play. */
export const restingMix = (arrangement: string): Mix => {
  const mode = worldTone(arrangement).mode;
  const isDrumless = arrangement === 'title' || arrangement === 'story';
  const isCamp = arrangement === 'camp';
  return {
    arrangement,
    mode,
    leadMode: resolveLeadMode(arrangement, mode, false),
    lift: 0,
    tempo: 1,
    intensity: isDrumless ? 0.35 : isCamp ? 0.42 : 0.5,
    drums: isDrumless ? 0 : isCamp ? 1 : 2,
    lead: true,
    leadGain: 1,
    arp: false,
    pad: isDrumless || isCamp,
    counter: false,
    filterHz: 18000,
    level: isDrumless ? 0.85 : isCamp ? 0.88 : 1,
    heartbeat: false,
    clock: 0,
    finisher: false,
    lounge: false,
    frozen: false,
    spotlights: 0,
    evolutions: [],
    evolutionFading: false,
    weapons: [],
    alerts: NO_ALERTS,
  };
};

/** How bright each evolution makes the tune, by recipe id. Set by the band from the recipe's theme. */
export type Brighten = (recipeId: string) => { lift: number; brighten: number };

export const direct = (m: FightMood, themeOf: Brighten = () => ({ lift: 2, brighten: 1 })): Mix => {
  const home = worldTone(m.arrangement);
  const playing = m.status === 'playing' && !m.paused;
  const between = m.status === 'pick' || m.status === 'pick_evolution' || m.status === 'intermission';

  // Hearts → how dark the tune is
  const hasHearts = m.hearts !== null && m.maxHearts !== null && m.maxHearts > 0;
  const heartShare = hasHearts ? (m.hearts as number) / (m.maxHearts as number) : 1;
  const lastHeart = hasHearts && (m.maxHearts as number) > 1 && (m.hearts as number) <= 1;
  const danger = lastHeart ? 2 : heartShare <= 0.5 ? 1 : 0;

  // Evolutions → brighter and higher (the first sets the colour, each extra one adds a semitone)
  const first = m.evolutions.length > 0 ? themeOf(m.evolutions[0]) : null;
  const lift = (first ? first.lift + (m.evolutions.length - 1) : 0) + Math.min(2, Math.max(0, m.wave));
  const mode = shade(home.mode, danger - (first ? first.brighten : 0));
  const leadMode = resolveLeadMode(m.arrangement, mode, lastHeart);

  // Clock
  const timed = m.timeLeft !== null && m.timeTotal !== null && m.timeTotal > 0;
  const t = timed ? (m.timeLeft as number) : Infinity;
  const clock: Mix['clock'] = !playing || !timed ? 0
    : t <= DIRECTOR.racingSeconds ? 2
    : t <= Math.min(DIRECTOR.clockSeconds, (m.timeTotal as number) * DIRECTOR.clockShare) ? 1 : 0;

  // Tempo
  let tempo = 1 + Math.min(DIRECTOR.comboTempoCap, Math.max(0, m.combo - 1) * DIRECTOR.comboTempo);
  if (clock === 1) tempo += 0.05;
  if (clock === 2) tempo += 0.12;
  if (m.evolutions.length > 0) tempo += 0.06;
  if (m.hotStreak) tempo += 0.02;
  tempo = Math.min(DIRECTOR.maxTempo, tempo);
  if (between) tempo = 0.84;
  if (m.frozen && playing) tempo = 0.6;

  // Intensity: the foe falling, the fight going on, the streak, the evolution.
  // [AU-18]: Idle eases gently from 10 s -> 34 s, preserving warm lead presence (0.35 floor) and 9,500 Hz filter floor.
  const idleActive = playing && m.evolutions.length === 0;
  const idleFade = idleActive
    ? clamp01((m.idleMs - DIRECTOR.idleStartMs) / Math.max(1, DIRECTOR.idleQuietMs - DIRECTOR.idleStartMs))
    : 0;
  const idleLeadFade = idleActive
    ? clamp01((m.idleMs - DIRECTOR.idleThinMs) / Math.max(1, DIRECTOR.idleQuietMs - DIRECTOR.idleThinMs))
    : 0;
  const idleQuiet = idleActive && m.idleMs >= DIRECTOR.idleQuietMs;
  const waveShare = m.waves > 1 ? m.wave / (m.waves - 1) : 0;
  let intensity = 0.22 + 0.33 * (1 - clamp01(m.foeHp)) + 0.1 * clamp01(waveShare) + 0.2 * clamp01((m.combo - 1) / 4)
    + (m.evolutions.length > 0 ? 0.3 : 0) + (m.boss ? 0.1 : 0) + (m.hotStreak ? 0.05 : 0) - idleFade * 0.34;
  intensity = clamp01(intensity);
  if (between) intensity = 0.3;

  const finisher = playing && m.foeHp > 0 && m.foeHp <= DIRECTOR.finisherHp;
  const evolving = m.evolutions.length > 0;

  // Warm low-pass floor (9,500 Hz) & lead floor (0.35) so deep thinking stays focused, never dead
  const idleFilterHz = Math.round(18000 - idleFade * (18000 - DIRECTOR.idleFilterFloorHz));
  const filterHz = m.paused ? 700 : between ? 2600 : m.frozen ? 1800 : lastHeart ? 3400 : idleFilterHz;
  const level = m.paused ? 0.55 : between ? 0.8 : Math.round((1 - idleFade * 0.12) * 100) / 100;
  const leadGain = m.frozen ? 0 : Math.round((1 - idleLeadFade * (1 - DIRECTOR.idleLeadFloor)) * 100) / 100;

  // [AU-05]: Cap concurrent board alerts to top 2 urgent threats (or top 1 during lastHeart + racing clock)
  const alertCap = lastHeart && clock === 2 ? 1 : 2;

  return {
    arrangement: m.arrangement,
    mode,
    leadMode,
    lift,
    tempo,
    intensity,
    drums: m.frozen || m.paused ? 0 : between ? 1 : evolving || intensity >= 0.8 ? 3 : intensity >= 0.42 ? 2 : 1,
    lead: !m.frozen,
    leadGain,
    arp: !between && (evolving || intensity >= 0.55),
    pad: m.frozen || between || intensity >= 0.35 || lastHeart || idleFade > 0.25,
    counter: !between && intensity >= 0.7,
    filterHz,
    level,
    heartbeat: playing && lastHeart,
    clock,
    finisher,
    lounge: between,
    frozen: m.frozen && playing,
    spotlights: m.weapons.length === 0 ? 0 : between || idleQuiet ? 1 : intensity >= 0.7 ? 3 : 2,
    evolutions: m.evolutions,
    evolutionFading: evolving && m.evolutionEndsMs <= DIRECTOR.evolutionFadeMs,
    weapons: m.weapons,
    alerts: playing ? capAlerts(m.alerts, alertCap) : NO_ALERTS,
  };
};
