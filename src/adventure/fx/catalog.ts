/**
 * How every fight event looks: ONE row per event type.
 *
 * It is a full Record, so the type checker refuses a new event type until it
 * has a row here (`null` = deliberately nothing to see, with the reason).
 * The rows are data; the stage (fx/FxStage.tsx) is the only thing that draws.
 *
 * The same effect looks the same whoever caused it: a laser from a weapon,
 * a skill node or an evolution is the same laser. What differs is who jumps
 * on the HUD when it fires (the weapon on the belt, the passive's chip, the
 * evolution's ring), which the script works out from the event's source.
 */
import { COLORS } from '@/utils/colors';
import type { RunEvent, RunEventType } from '../types';
import type { FxRow } from './types';

/** The effects' own colours. One meaning each, the same everywhere. */
export const FX_COLOR = {
  hit: '#F0483E',
  rainbow: '#9333EA',
  blast: '#FF7A1A',
  laser: '#19C2E6',
  ricochet: '#F5B800',
  fire: '#F0483E',
  link: '#7B68EE',
  echo: '#8B5CF6',
  heal: COLORS.logicTeal,
  coin: '#E0A800',
  /** Coin-coloured words: the coin yellow is too pale to read as text */
  coinText: '#B07D00',
  time: '#3B82F6',
  hint: '#D9A400',
  grace: '#16A34A',
  xp: '#3B9BE8',
  frost: '#3B82F6',
  combo: '#F97316',
  purity: '#0D9488',
  buff: '#D97706',
  evo: '#7C3AED',
  pinata: '#DB2777',
  surge: '#DB2777',
  shield: COLORS.logicTeal,
  foe: '#9F1239',
  sour: '#B91C1C',
  ink: COLORS.slateCharcoal,
} as const;

const C = FX_COLOR;
const n = (e: RunEvent) => e.amount ?? 0;
const fmt = (x: number) => String(Math.round(x * 10) / 10);

/** "−12", or "Burn −12" when the hit names what it came from */
const hitLabel = (e: RunEvent) => (e.text ? `${e.text} −${fmt(n(e))}` : `−${fmt(n(e))}`);
/** "BLAST −6" when it dealt its own damage, "BLAST!" when its damage is part of the Set's hit */
const destroyLabel = (word: string) => (e: RunEvent) => (n(e) > 0 ? `${word} −${fmt(n(e))}` : `${word}!`);
/** A weapon's callout: "Mirror! +4", "Rust −1", "Curse broken ×2" */
const ruleLabel = (e: RunEvent) => {
  const text = e.text ?? '!';
  if (text.includes('×') || e.slots || !e.amount || !Number.isFinite(e.amount)) return text;
  return e.amount > 0 ? `${text} +${fmt(e.amount)}` : `${text} −${fmt(-e.amount)}`;
};

export const EVENT_FX: Record<RunEventType, FxRow | null> = {
  // ── Your hits: something flies from the cards to the foe ─────────────────
  hit: { color: C.hit, board: 'ring', orb: 'damage', to: 'foe', from: 'fighter', damage: true, shake: true, enemy: 'hit', label: hitLabel },
  rainbow: { color: C.rainbow, board: 'ring', orb: 'rainbow', to: 'foe', damage: true, shake: true, fighter: 'ecstatic', enemy: 'criticalHit', label: e => `RAINBOW −${fmt(n(e))}` },
  blast: { color: C.blast, board: 'burst', orb: 'damage', to: 'foe', damage: true, shake: true, enemy: 'hit', label: destroyLabel('BLAST') },
  laser: { color: C.laser, board: 'beam', orb: 'damage', to: 'foe', damage: true, shake: true, enemy: 'hit', label: destroyLabel('LASER') },
  ricochet: { color: C.ricochet, board: 'zap', orb: 'damage', to: 'foe', damage: true, enemy: 'hit', label: destroyLabel('RICOCHET') },
  link_burst: { color: C.link, board: 'zap', orb: 'damage', to: 'foe', enemy: 'hit', label: () => 'LINKED!' },
  echo: { color: C.echo, board: 'ring', orb: 'damage', to: 'foe', enemy: 'hit', label: () => 'ECHO!' },
  fire: { color: C.fire, board: 'flame', label: () => 'BURNING' },
  pinata_break: { color: C.pinata, board: 'burst', orb: 'damage', to: 'foe', damage: true, shake: true, fighter: 'ecstatic', enemy: 'criticalHit', label: e => `PIÑATA −${fmt(n(e))}` },
  overkill: { color: C.coin, orb: 'coin', from: 'foe', to: 'coins', labelColor: C.coinText, label: e => `OVERKILL +${fmt(n(e))}` },

  // ── What a Set pays into the HUD ─────────────────────────────────────────
  heal: { color: C.heal, orb: 'heart', from: 'set', to: 'hearts', fighter: 'heal', label: e => `+${n(e) || 1}♥` },
  coins: { color: C.coin, orb: 'coin', from: 'set', to: 'coins', labelColor: C.coinText, label: e => `+${n(e)}¢` },
  time_gain: { color: C.time, orb: 'time', from: 'set', to: 'clock', label: e => `+${fmt(n(e))}s` },
  hint: { color: C.hint, orb: 'hint', from: 'set', to: 'hint', labelColor: C.coinText, label: e => `+${n(e) || 1} hint` },
  grace: { color: C.grace, aura: true, bump: ['graces'], label: () => 'GRACE!' },
  levelup: { color: C.xp, orb: 'xp', from: 'set', to: 'xp', fighter: 'powerup', label: () => 'LEVEL UP!' },
  grow: { color: C.grace, board: 'sparkle', label: e => `+${n(e)} ${n(e) === 1 ? 'card' : 'cards'}` },

  // ── Getting hurt, and what saves you ─────────────────────────────────────
  hurt: { color: C.foe, orb: 'dark', from: 'foe', to: 'hearts', enemy: 'gloat', labelColor: C.sour, label: e => `−${n(e) || 1}♥` },
  // The board's own red flash and shake show the miss; the heart it costs is `hurt`
  mistake: null,
  nine_lives: { color: C.shield, aura: true, bump: ['passive:nine_lives', 'hearts'], fighter: 'heal', label: () => 'NINE LIVES!' },
  // Practice: out of hearts, so they come back
  breather: { color: C.heal, aura: true, orb: 'heart', from: 'fighter', to: 'hearts', fighter: 'heal', label: () => 'HEARTS REFILLED' },
  thick_hide: { color: C.shield, aura: true, bump: ['passive:thick_hide'], fighter: 'heal', label: () => 'THICK HIDE!' },
  free_mistake: { color: C.shield, aura: true, label: () => 'NO HARM' },
  arcana_burn: { color: C.fire, aura: true, label: () => 'CONTROLLED BURN!' },

  // ── The foe's moves: something dark flies from the foe ───────────────────
  dud: { color: C.foe, board: 'puff', orb: 'dark', from: 'foe', to: 'board', enemy: 'attack', label: () => 'DUD' },
  face_down: { color: C.foe, board: 'puff', orb: 'dark', from: 'foe', to: 'board', enemy: 'attack', label: () => 'HIDDEN' },
  // The foe's fuse warns again and again as it burns down: a pulse on the card, nothing more
  countdown: { color: C.sour, board: 'ring', ambient: true },
  bomb: { color: C.foe, board: 'puff', orb: 'dark', from: 'foe', to: 'board', enemy: 'attack', label: () => 'BOMB' },
  triple: { color: C.foe, board: 'puff', orb: 'dark', from: 'foe', to: 'board', enemy: 'attack', label: () => 'ARMORED' },
  attr_shift: { color: C.foe, board: 'puff', orb: 'dark', from: 'foe', to: 'board', enemy: 'attack', label: () => 'CHANGED' },
  card_removed: { color: C.foe, board: 'puff', orb: 'dark', from: 'foe', to: 'board', enemy: 'attack', label: () => 'CARD TAKEN' },
  shuffle: { color: C.foe, sweep: 'dark', enemy: 'attack', label: () => 'SHUFFLED!' },
  time_stolen: { color: C.foe, orb: 'dark', from: 'foe', to: 'clock', fighter: 'pain', enemy: 'attack', labelColor: C.sour, label: () => 'TIME STOLEN' },
  inactivity: { color: C.foe, orb: 'dark', from: 'foe', to: 'fighter', fighter: 'pain', enemy: 'attack', labelColor: C.sour, label: () => 'TOO SLOW!' },
  regen: { color: C.heal, from: 'foe', board: 'sparkle', ambient: true, enemy: 'regen', label: e => `+${fmt(n(e))} HP` },
  trap_placed: { color: C.foe, board: 'puff', orb: 'dark', from: 'foe', to: 'board', enemy: 'attack', label: e => (e.text === 'bomb' ? 'TIME BOMB' : 'SNARE') },
  trap_defused: { color: C.shield, board: 'sparkle', orb: 'damage', to: 'foe', enemy: 'hit', label: e => (n(e) > 0 ? `DEFUSED +${fmt(n(e))}` : 'DEFUSED!') },
  trap_sprung: { color: C.sour, board: 'burst', from: 'hearts', fighter: 'pain', enemy: 'gloat', labelColor: C.sour, label: () => 'SPRUNG!' },

  // ── The fight itself ─────────────────────────────────────────────────────
  foe_defeated: { color: C.blast, from: 'foe', board: 'burst', bump: ['foe'], fighter: 'ecstatic', label: () => 'K.O.!' },
  wave: { color: C.ink, sweep: 'gold', fighter: 'entrance', enemy: 'entrance', label: e => `WAVE ${n(e)}` },
  time_up: { color: C.time, bump: ['clock'], label: () => "TIME'S UP" },
  moves_out: { color: C.ink, bump: ['clock'], label: () => 'OUT OF MOVES' },

  // ── Fighter passives: the passive's own chip jumps ───────────────────────
  combo: { color: C.combo, bump: ['passive:combo', 'combo'], fighter: 'ecstatic', label: e => `COMBO ×${n(e)}` },
  hot_streak: { color: C.combo, aura: true, bump: ['passive:hot_streak'], fighter: 'powerup', label: () => 'HOT STREAK READY' },
  hot_streak_hit: { color: C.combo, orb: 'spark', from: 'passive:hot_streak', to: 'foe', fighter: 'ecstatic', enemy: 'criticalHit', label: e => `HOT STREAK ×${fmt(n(e))}` },
  grudge: { color: '#7A3E00', aura: true, bump: ['passive:grudge'], label: e => `GRUDGE ${n(e) || ''}`.trim() },
  grudge_release: { color: '#7A3E00', orb: 'spark', from: 'passive:grudge', to: 'foe', fighter: 'ecstatic', enemy: 'criticalHit', label: e => `GRUDGE +${fmt(n(e))}` },
  patience: { color: C.frost, orb: 'spark', from: 'passive:patience', to: 'foe', enemy: 'hit', label: e => `PATIENCE +${fmt(n(e))}` },
  freeze: { color: C.frost, sweep: 'frost', bump: ['passive:deep_freeze', 'clock'], fighter: 'ecstatic', label: () => 'FROZEN!' },
  redeal: { color: C.combo, sweep: 'whirl', bump: ['passive:zoomies'], fighter: 'ecstatic', label: () => 'ZOOMIES!' },
  scoop: { color: C.heal, aura: true, bump: ['passive:big_scoop'], fighter: 'ecstatic', enemy: 'criticalHit', label: () => 'BIG SCOOP!' },
  keen_eye: { color: C.hint, board: 'sparkle', bump: ['passive:keen_eye'], ambient: true },
  fetch: { color: C.coin, board: 'sparkle', bump: ['passive:fetch'], label: () => 'FETCH!' },

  // ── Shading Surge: a wash over the board as shading switches on and off ──
  surge_warn: { color: C.surge, bump: ['clock'], label: e => `SURGE IN ${n(e)}s` },
  surge_start: { color: C.surge, sweep: 'surge', fighter: 'powerup', label: e => `SHADING SURGE ×${fmt(n(e))}!` },
  surge_end: { color: C.surge, sweep: 'surge', label: () => 'SURGE OVER' },
  surge_hit: { color: C.surge, board: 'ring', orb: 'damage', to: 'foe', damage: true, shake: true, fighter: 'ecstatic', enemy: 'criticalHit', label: e => `SURGE −${fmt(n(e))}` },

  // ── Weapons, skills and evolutions that change what comes next ───────────
  rule: { color: C.rainbow, board: 'sparkle', orb: 'spark', to: 'foe', label: ruleLabel },
  doubled: { color: C.rainbow, aura: true, label: () => '×2!' },
  double_ready: { color: C.rainbow, aura: true, label: () => 'NEXT ×2' },
  charged: { color: C.combo, aura: true, label: e => `NEXT SET ×${fmt(n(e))}` },
  empowered: { color: C.buff, sweep: 'gold', fighter: 'powerup', label: e => `WAR DRUM +${fmt(n(e))}` },
  simplified: { color: C.purity, sweep: 'teal', label: () => 'CLARITY!' },
  simplify_end: { color: C.purity, sweep: 'teal', label: () => 'CLARITY ENDS' },
  pinata: { color: C.pinata, board: 'sparkle', label: () => 'PIÑATA!' },
  link: { color: C.link, board: 'zap', label: () => 'LINKED' },
  purity: { color: C.purity, orb: 'spark', from: 'set', to: 'foe', label: e => `PURITY ×${n(e)}!` },
  purity_max: { color: C.rainbow, orb: 'rainbow', from: 'set', to: 'foe', sweep: 'rainbow', fighter: 'ecstatic', enemy: 'criticalHit', label: e => `MAX PURITY ×${n(e)}!` },
  catalyst_spawn: { color: C.buff, board: 'sparkle', label: () => 'CATALYST!' },
  // The Catalyst card erupts; then the cut-in takes the screen (fx/EvolutionCutIn.tsx)
  evolution_start: { color: C.evo, board: 'burst', sweep: 'rainbow', fighter: 'ecstatic', enemy: 'criticalHit' },
  evolution_end: { color: C.evo, sweep: 'dark', label: e => `${e.text ?? 'Evolution'} ends` },
};
