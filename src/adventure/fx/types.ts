/**
 * Fight effects: the shared vocabulary.
 *
 * An EVENT (engine) becomes a BEAT (fx/script.ts) that looks the way its ROW
 * in the catalog says (fx/catalog.ts), and the STAGE (fx/FxStage.tsx) plays
 * the beats over the fight, aiming at ANCHORS: named places of the HUD and
 * the board (fx/anchors.tsx).
 */
import type { Card } from '@/types';
import type { RunEvent } from '../types';

/** A place on the fight screen the effects can aim at. HUD parts register under these names. */
export type AnchorName =
  | 'foe' | 'fighter' | 'hearts' | 'clock' | 'coins' | 'hint' | 'graces' | 'xp' | 'combo' | 'board'
  | `weapon:${string}` | `passive:${string}` | `evo:${string}` | `arcana:${string}` | `slot:${number}`;

/** In the stage's own coordinates (its top-left corner is 0,0) */
export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

/** What plays on a card */
export type BoardFx =
  /** A spiky comic explosion; the card under it shatters */
  | 'burst'
  /** A beam along a row or column (or from the source to each card); cards under it are vaporised */
  | 'beam'
  /** A bolt that jumps from card to card */
  | 'zap'
  /** Flames licking up the card */
  | 'flame'
  /** Twinkles: the card got better (power, gold, a Catalyst, a hint) */
  | 'sparkle'
  /** A dark puff: the foe did something to the card */
  | 'puff'
  /** A ring that grows out of the card */
  | 'ring';

/** What flies from where it happened to the part of the HUD it pays into */
export type OrbKind = 'damage' | 'rainbow' | 'coin' | 'heart' | 'time' | 'hint' | 'grace' | 'xp' | 'dark' | 'spark';

/** A wash across the whole board */
export type SweepKind = 'frost' | 'gold' | 'teal' | 'whirl' | 'dark' | 'rainbow' | 'surge';

export type FighterReaction = 'ecstatic' | 'heal' | 'powerup' | 'pain' | 'entrance';
export type EnemyReaction = 'criticalHit' | 'hit' | 'gloat' | 'attack' | 'regen' | 'entrance';

/** How one kind of fight event looks. Everything is optional: a row uses the parts it needs. */
export interface FxRow {
  /** Colour of the board effect, the orbs and the ring where they land */
  color: string;
  /** What plays on the cards the event names */
  board?: BoardFx;
  sweep?: SweepKind;
  /** What flies, and to which part of the HUD */
  orb?: OrbKind;
  to?: AnchorName;
  /**
   * Where it starts when the event names no cards and no weapon, skill or
   * evolution caused it: 'set' = the cards of the Set that led to it.
   */
  from?: 'set' | AnchorName;
  /** HUD parts that jump when it lands (the target and the source always do) */
  bump?: AnchorName[];
  /** A ring around the fighter: a save, a shield, a charge */
  aura?: boolean;
  /** Text that pops where it lands */
  label?: (e: RunEvent) => string | null;
  labelColor?: string;
  /** The event's amount is damage dealt to the foe right then: it comes off the HP bar as the beat lands */
  damage?: boolean;
  /**
   * Happens over and over on the fight clock (a fuse ticking, a foe healing):
   * it plays, but never holds the clock, and not more than about once a second.
   */
  ambient?: boolean;
  /** Foe portrait shakes */
  shake?: boolean;
  fighter?: FighterReaction;
  enemy?: EnemyReaction;
}

/** 0 normal · 1 big (≥10) · 2 huge (≥25, screen shake) · 3 MEGA (≥50, flash) */
export type HitTier = 0 | 1 | 2 | 3;

/** Who caused a beat: a held weapon, an active evolution, or one of the fighter's skills */
export interface BeatSource {
  /** "weapon:<id>" | "evo:<id>" | "node:<id>" */
  ref: string;
  name: string;
  /** Where it lives on the HUD */
  anchor: AnchorName;
}

/** One event, ready to play. Times are ms after its segment starts. */
export interface Beat {
  key: string;
  event: RunEvent;
  row: FxRow;
  at: number;
  /** When it reaches its target: the number pops, the HUD reacts, the damage comes off the HP bar */
  land: number;
  /** How long it stays mounted */
  life: number;
  /** Cards it plays on */
  slots: number[];
  /** What was on those cards before it removed them (null = the card stayed) */
  ghosts: (Card | null)[];
  /** Cards its orbs start from (its own, or the Set's) */
  launch: number[];
  source: BeatSource | null;
  label: string | null;
  /** Position among the labels landing on the same place, so they fan out instead of stacking */
  lane: number;
  /** Its step in the chain (0 for the Set that leads it) */
  step: number;
  /** The Set that leads the cascade: its number is the big one, on the foe itself */
  lead: boolean;
  /** Name its source under it (only the first beat of each source in a cascade does) */
  named: boolean;
  tier: HitTier;
  /** HP it takes off the foe's bar as it lands */
  damage: number;
  /** Something flies from where it happened to the row's target */
  flies: boolean;
  /** Bad news from your own gear: the label shakes, nothing flies */
  sour: boolean;
  /** Text only (effects are off, or the chain is too long to draw it all) */
  quiet: boolean;
}

/** A stretch of beats that plays through, or an evolution cut-in that waits for a tap. */
export type Segment =
  | { kind: 'beats'; events: RunEvent[]; beats: Beat[]; total: number; stride: number }
  | { kind: 'cutIn'; recipes: string[] };

export interface Script {
  segments: Segment[];
}
