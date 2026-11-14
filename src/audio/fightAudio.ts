/**
 * The bridge between a fight and the band.
 *
 *   moodOf(run)       what the director needs to know about the fight
 *   soundsFor(events) what the fresh events should sound like, as data
 *   playSounds(...)   hands that to the band
 *
 * `soundsFor` is pure, so the mapping is tested without any audio. The events
 * of one move are played as a CHAIN: the Set's own hit first, then each thing
 * it set off one 32nd note later and one step higher, like a slot machine
 * counting out a win. A long chain ends on the cash register.
 */
import type { RunEvent, RunEventType, RunState } from '@/adventure/types';
import { band, type CueName } from './band';
import type { FightAlerts, FightMood } from './director';
import { ownerOfEvent } from '@/adventure/data/weaponGuide';
import { weaponIdOf } from './voices';

/**
 * What each fight event sounds like. A full Record, so a new event type has
 * to be given a row. `null` = silent here (the band hears about it another
 * way: the streak ladder, the mood).
 */
export const EVENT_CUE: Record<RunEventType, CueName | null> = {
  hit: null, // the payout (below)
  rainbow: 'rainbow',
  heal: 'heal',
  hurt: 'hurt',
  grace: 'graceSave',
  coins: 'coins',
  levelup: 'levelUp',
  foe_defeated: 'foeDefeated',
  wave: 'wave',
  regen: 'foeRegen',
  dud: 'foeDud',
  face_down: 'foeHide',
  countdown: 'foeFuse',
  bomb: 'foeFuse',
  triple: 'foeMove',
  shuffle: 'foeShuffle',
  attr_shift: 'foeMove',
  card_removed: 'foeHide',
  time_stolen: 'foeSteal',
  inactivity: 'foeGrowl',
  fire: 'fire',
  hint: 'hint',
  mistake: 'mistake',
  time_up: 'toll',
  moves_out: 'toll',
  time_gain: 'timeGain',
  nine_lives: 'nineLives',
  combo: null, // the streak ladder rings it
  hot_streak: 'hotStreak',
  hot_streak_hit: 'bigHit',
  grudge: 'grudge',
  grudge_release: 'bigHit',
  thick_hide: 'shield',
  patience: 'patience',
  freeze: 'freeze',
  redeal: 'redeal',
  scoop: 'scoop',
  keen_eye: 'twinkle',
  fetch: 'fetch',
  free_mistake: 'phew',
  rule: 'ding',
  blast: 'blast',
  laser: 'laser',
  ricochet: 'ricochet',
  doubled: 'doubled',
  double_ready: 'armed',
  charged: 'charged',
  empowered: 'warDrum',
  simplified: 'clarity',
  simplify_end: 'clarityEnd',
  pinata: 'pinata',
  pinata_break: 'pinataBreak',
  link: 'link',
  purity: 'purity',
  purity_max: 'rainbow',
  catalyst_spawn: 'catalyst',
  evolution_start: null, // the band hears the evolution in the mood and plays its theme
  evolution_end: null,
  trap_placed: 'trapSet',
  trap_defused: 'trapDefused',
  trap_sprung: 'trapSprung',
  arcana_burn: 'burn',
  overkill: 'overkill',
  echo: 'ding', // the echo weapon's own sting speaks for it
  link_burst: 'link',
  grow: 'twinkle',
};

/** Events whose `amount` is damage to the foe: together they size the hit */
const DAMAGE: ReadonlySet<RunEventType> = new Set<RunEventType>([
  'hit', 'rainbow', 'blast', 'laser', 'ricochet', 'hot_streak_hit', 'grudge_release', 'pinata_break', 'trap_defused',
]);

/** Damage of one move that makes a hit big, huge and MEGA (the same steps the floating numbers grow at) */
export const HIT_SIZES = [10, 25, 50] as const;
export const hitSize = (damage: number): number => HIT_SIZES.filter(s => damage >= s).length;

/** Callouts that are a trick weapon going wrong */
export const SOUR_CALLS = ['Off the rope', 'Glass Sword shattered', 'Thorns bite', 'Fuse burnt out', 'The curse spreads', 'Rust'] as const;
export const isSour = (e: RunEvent): boolean =>
  e.type === 'rule' && ((e.amount ?? 0) < 0 || (e.text !== undefined && SOUR_CALLS.some(c => e.text!.startsWith(c))));

/** A chain this long ends on the cash register */
export const JACKPOT_CHAIN = 5;
/** Most sounds one move may make (the rest of a huge chain is felt, not heard) */
export const MAX_CHAIN = 12;

export type FightSound =
  | { kind: 'payout'; combo: number; tier: number; rainbow: boolean }
  | { kind: 'cue'; name: CueName; amount: number; slot: number }
  | { kind: 'sting'; weapon: string; slot: number };

/** The Set's own hit: it is the payout, never a link of the chain */
export const isSetHit = (e: RunEvent): boolean => e.type === 'hit' && !e.text;

/** The weapon an event speaks for: the one whose rule caused it, or the held weapon that owns that kind of event */
export const weaponOfEvent = (e: RunEvent, held: readonly string[]): string | null =>
  (e.source ? weaponIdOf(e.source) : null) ?? ownerOfEvent(e.type, e.text, held);

/**
 * Does this event take a step of the chain? The effects on screen
 * (src/adventure/fx/script.ts) ask the same question, so sound and picture
 * step together. `setHit`: the events include a Set's own hit.
 */
export const takesChainSlot = (e: RunEvent, held: readonly string[], setHit: boolean): boolean => {
  if (isSetHit(e) || (e.type === 'rainbow' && setHit)) return false;
  if (isSour(e)) return true;
  return (e.type === 'hit' ? 'ding' : EVENT_CUE[e.type]) !== null || weaponOfEvent(e, held) !== null;
};

/** The chain's first step when a Set leads it: the payout rings first */
export const CHAIN_LEAD = 2;

export const soundsFor = (events: readonly RunEvent[], ctx: { weapons: readonly string[]; combo: number }): FightSound[] => {
  const out: FightSound[] = [];
  const damage = events.reduce((sum, e) => sum + (DAMAGE.has(e.type) ? e.amount ?? 0 : 0), 0);
  const setHit = events.some(isSetHit);
  const rainbow = events.some(e => e.type === 'rainbow');
  if (setHit) out.push({ kind: 'payout', combo: Math.max(1, ctx.combo), tier: hitSize(damage), rainbow });

  let slot = setHit ? CHAIN_LEAD : 0;
  let chain = 0;
  const stung = new Set<string>();
  for (const e of events) {
    if (out.length >= MAX_CHAIN) break;
    if (isSetHit(e) || (e.type === 'rainbow' && setHit)) continue;
    // Bad news from your own gear (a shattered sword, a thorn that bit) never sounds like a win
    if (isSour(e)) {
      out.push({ kind: 'cue', name: 'sour', amount: 0, slot });
      slot += 1;
      continue;
    }
    const weapon = weaponOfEvent(e, ctx.weapons);
    const cue = e.type === 'hit' ? 'ding' : EVENT_CUE[e.type];
    // A weapon speaks for itself: its sting replaces the plain "ding" of a rule or a bonus hit
    const plain = cue === 'ding' && weapon !== null;
    if (cue && !plain) out.push({ kind: 'cue', name: cue, amount: e.amount ?? 0, slot });
    if (weapon && !stung.has(weapon)) {
      stung.add(weapon);
      out.push({ kind: 'sting', weapon, slot: cue && !plain ? slot + 1 : slot });
    }
    if (cue || weapon) {
      slot += 1;
      chain += 1;
    }
  }
  if (setHit && chain >= JACKPOT_CHAIN) out.push({ kind: 'cue', name: 'register', amount: chain, slot: slot + 1 });
  return out;
};

/**
 * `stride`: how many 32nd notes one step of the chain lasts. The effects on
 * screen pick it (a short chain plays slower, so each step can be read) and
 * pass it here, so every sound lands with its picture.
 */
export const playSounds = (sounds: readonly FightSound[], stride = 1): void => {
  for (const s of sounds) {
    if (s.kind === 'payout') band.payout(s);
    else if (s.kind === 'cue') band.cue(s.name, { amount: s.amount, slot: s.slot * stride });
    else band.fire(s.weapon, s.slot * stride);
  }
};

// ─── Mood ───────────────────────────────────────────────────────────────────

/** Warnings last this long before the thing happens */
export const ALERT_MS = { potato: 2500, thorn: 5000, glass: 2500, bombSeconds: 5 } as const;

export const alertsOf = (run: RunState, glassWindowMs = 0): FightAlerts => {
  const now = run.elapsedMs;
  return {
    cursed: run.board.filter(c => c.cursedUntil !== undefined).length,
    potatoSoon: run.board.some(c => c.hot) && run.gear.potatoAtMs - now <= ALERT_MS.potato,
    fuseHot: run.board.filter(c => c.fuseHot).length,
    thornSoon: run.board.some(c => c.thornAt !== undefined && c.thornAt - now <= ALERT_MS.thorn),
    glassLow: glassWindowMs > 0 && !run.gear.glassBroken && now - run.gear.glassSinceMs >= glassWindowMs - ALERT_MS.glass,
    bombSoon: run.board.some(c =>
      (c.hasBomb && (c.bombTimer ?? Infinity) <= ALERT_MS.bombSeconds) || (c.hasCountdown && (c.countdownTimer ?? Infinity) <= ALERT_MS.bombSeconds)),
  };
};

/** How much longer the band waits before thinning out, per trait beyond three */
export const IDLE_PATIENCE_PER_TRAIT = 0.4;

/** Untimed levels count moves: each move left is worth this many "seconds" to the director's clock */
const SECONDS_PER_MOVE = 4;

export const moodOf = (
  run: RunState,
  o: { arrangement: string; paused: boolean; timeTotal: number | null; glassWindowMs?: number }
): FightMood => {
  const timed = run.timeLeft !== null;
  const moves = !timed && run.movesLeft !== null;
  return {
    arrangement: o.arrangement,
    boss: Boolean(run.level.isBoss),
    status: run.status,
    paused: o.paused,
    hearts: run.hearts,
    maxHearts: run.maxHearts,
    timeLeft: timed ? run.timeLeft : moves ? (run.movesLeft as number) * SECONDS_PER_MOVE : null,
    timeTotal: timed ? o.timeTotal ?? run.timeLeft : moves ? 400 : null,
    foeHp: run.foeMaxHp > 0 ? Math.max(0, run.foeHp) / run.foeMaxHp : 0,
    wave: run.wave,
    waves: run.level.foes.length,
    combo: run.combo,
    hotStreak: run.passive.hotStreak,
    evolutions: run.activeEvolutions.map(e => e.id),
    evolutionEndsMs: run.activeEvolutions.reduce((min, e) => Math.min(min, e.remainingMs), Infinity),
    // A harder board takes longer to read: the band's patience grows with every trait beyond three
    idleMs: Math.max(0, run.elapsedMs - run.lastMatchAtMs) / (1 + IDLE_PATIENCE_PER_TRAIT * Math.max(0, run.attributes.length - 3)),
    frozen: run.frozenMs > 0,
    weapons: run.weapons.map(w => w.id),
    alerts: alertsOf(run, o.glassWindowMs),
  };
};
