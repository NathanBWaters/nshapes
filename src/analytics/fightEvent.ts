/**
 * Game analytics schema & single-event emitter (`fight_ended`).
 *
 * Strictly enforces the ONE-EVENT-PER-GAME rule:
 * - Adventure finished rounds stage `fight_ended` via `stageAdventureFight`
 *   while results are visible, merge player 👍/👎 + tag feedback directly into
 *   the staged event (`rateFight` -> `updateFightFeedbackInAnalytics`), and
 *   dispatch the single wide event on leaving results / app background.
 * - Abandoned/restarted Adventure fights, Free Play sessions, and Classic runs
 *   also emit at most one `fight_ended` wide event each.
 * - `replayFight(getLevel(level_id), save, recording)` deterministically rebuilds
 *   every Adventure fight server-side or locally.
 */
import { MAIN_LEVELS, mainIndexOf } from '@/adventure/data/levels';
import type { BattleRecord } from '@/adventure/history';
import type { FightTape } from '@/adventure/engine/replay';
import type { AdventureSave, LevelDef, RunState } from '@/adventure/types';
import {
  capture,
  commitStagedEvent,
  stageEvent,
  updateFightFeedbackInAnalytics,
  type FightProfileUpdate,
} from './posthog';

export const FIGHT_EVENT = 'fight_ended';
export const FIGHT_RATED_EVENT = 'fight_rated';

export type FunRating = 'up' | 'down';

export type FunTag =
  | 'great_build'
  | 'close_call'
  | 'satisfying_combos'
  | 'fair_challenge'
  | 'unfair_rng'
  | 'too_hard'
  | 'too_slow'
  | 'confusing';

export const POSITIVE_FUN_TAGS: readonly { id: FunTag; label: string }[] = [
  { id: 'great_build', label: 'Great build' },
  { id: 'close_call', label: 'Close call' },
  { id: 'satisfying_combos', label: 'Juicy combos' },
  { id: 'fair_challenge', label: 'Fair challenge' },
];

export const NEGATIVE_FUN_TAGS: readonly { id: FunTag; label: string }[] = [
  { id: 'too_hard', label: 'Too punishing' },
  { id: 'unfair_rng', label: 'Bad board RNG' },
  { id: 'too_slow', label: 'Too slow' },
  { id: 'confusing', label: 'Confusing' },
];

export const FUN_TAG_LABELS: Record<FunTag, string> = {
  great_build: 'Great build',
  close_call: 'Close call',
  satisfying_combos: 'Juicy combos',
  fair_challenge: 'Fair challenge',
  too_hard: 'Too punishing',
  unfair_rng: 'Bad board RNG',
  too_slow: 'Too slow',
  confusing: 'Confusing',
};

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

const medianOf = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? Math.round(sorted[mid])
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/** 1-based position along the campaign main path (side branches map to their root main level's ordinal). */
export const levelOrderOf = (level: LevelDef): number => {
  const direct = MAIN_LEVELS.findIndex(l => l.id === level.id);
  if (direct >= 0) return direct + 1;
  const root = mainIndexOf(level);
  return root >= 0 ? root + 1 : 0;
};

export interface SpireFightMeta {
  runId: string;
  act: number;
  floor: number;
  ascension: number;
  endless: boolean;
  nodeKind: 'skirmish' | 'elite' | 'boss';
  weaponLevels: Readonly<Record<string, number>>;
  parries: number;
  perfectParries: number;
}

export interface FightEventExtras {
  fightId?: string;
  funRating?: FunRating | null;
  funTags?: FunTag[];
  replayOpened?: boolean;
  afterSave?: AdventureSave;
  spire?: SpireFightMeta;
}

const highestWorldFromSave = (save: AdventureSave, wonWorld: number | null): number => {
  let highest = wonWorld ?? 1;
  for (const [id, stars] of Object.entries(save.stars ?? {})) {
    if ((stars ?? 0) > 0) {
      const w = Number(id.split('-')[0]) || 1;
      if (w > highest) highest = w;
    }
  }
  return highest;
};

export const fightEventProps = (
  level: LevelDef,
  run: RunState,
  record: BattleRecord,
  tape: FightTape,
  extras: FightEventExtras = {}
) => {
  const world = Number(level.id.split('-')[0]) || null;
  const fightId = extras.fightId ?? record.fightId ?? `${record.at}-${tape.recording.seed}`;
  const funRating = extras.funRating ?? record.funRating ?? null;
  const funTags = extras.funTags ?? record.funTags ?? [];
  const funScore = funRating === 'up' ? 1 : funRating === 'down' ? 0 : null;

  const findTimes = run.log
    .filter(e => e.kind === 'set' && e.set && e.set.sinceLastMs > 0)
    .map(e => e.set!.sinceLastMs);
  const medianFindMs = medianOf(findTimes);
  const maxDroughtMs = findTimes.length > 0 ? Math.max(...findTimes) : Math.round(run.elapsedMs);

  const triggeredDamage = run.log.reduce((sum, e) => sum + Math.max(0, e.damage - e.setDamage), 0);
  const triggeredDamageShare = record.damage > 0 ? round3(triggeredDamage / record.damage) : 0;
  const biggestHitShare = record.damage > 0 ? round3(record.biggestHit / record.damage) : 0;
  const foeHpPctLeft = run.foeMaxHp > 0 ? round3(Math.max(0, run.foeHp) / run.foeMaxHp) : 0;
  const closeCall =
    (record.outcome === 'won' && run.hearts !== null && run.hearts <= 1) ||
    (record.outcome === 'lost' && foeHpPctLeft <= 0.15);
  const diedWithHints = record.outcome === 'lost' && (run.stats.hints ?? 0) > 0;
  // Sets made on a card that was being pointed out: a guided step, the companion's stuck help, a hint or an auto-hint.
  // With `max_drought_ms` it says how much a player leans on help, and where.
  const helpedSets = tape.recording.actions.filter(x => 'a' in x && x.a.type === 'MATCH' && x.a.hinted === true).length;

  const totalStarsBefore = Object.values(tape.save.stars ?? {}).reduce((a, b) => a + b, 0);
  const levelsClearedBefore = Object.values(tape.save.stars ?? {}).filter(s => s > 0).length;
  const accuracy =
    record.sets + record.mistakes > 0 ? round3(record.sets / (record.sets + record.mistakes)) : null;

  const spire = extras.spire;
  return {
    fight_id: fightId,
    mode: spire ? 'spire' : 'adventure',
    level_id: level.id,
    level_name: level.name,
    level_order: spire ? spire.floor : levelOrderOf(level),
    world: spire ? spire.act : world,
    side_path: !!level.branchOf,
    boss: !!level.isBoss,
    practice: !!level.rules.sandbox,
    ...(spire
      ? {
          spire_run_id: spire.runId,
          spire_act: spire.act,
          spire_floor: spire.floor,
          spire_ascension: spire.ascension,
          spire_endless: spire.endless,
          spire_node_kind: spire.nodeKind,
          spire_weapon_levels: spire.weaponLevels,
          parries: spire.parries,
          perfect_parries: spire.perfectParries,
        }
      : {}),
    foe: record.foe,
    fighter: record.fighter,
    outcome: record.outcome,
    end_reason: run.endReason ?? null,
    stars: record.stars,
    // How many times this level had been started before this fight
    attempt: (tape.save.plays?.[level.id] ?? 0) + 1,
    best_stars_before: tape.save.stars?.[level.id] ?? 0,
    total_stars_before: totalStarsBefore,
    levels_cleared_before: levelsClearedBefore,
    damage: record.damage,
    dpm: record.dpm,
    biggest_hit: record.biggestHit,
    biggest_hit_share: biggestHitShare,
    triggered_damage: triggeredDamage,
    triggered_damage_share: triggeredDamageShare,
    sets: record.sets,
    mistakes: record.mistakes,
    accuracy,
    duration_ms: record.durationMs,
    median_find_ms: medianFindMs,
    max_drought_ms: maxDroughtMs,
    hearts_left: run.hearts,
    max_hearts: run.maxHearts,
    foe_hp_left: Math.max(0, Math.round(run.foeHp)),
    foe_max_hp: run.foeMaxHp,
    foe_hp_pct_left: foeHpPctLeft,
    close_call: closeCall,
    died_with_hints: diedWithHints,
    helped_sets: helpedSets,
    hints_used: run.roundStats?.hintsUsed ?? 0,
    graces_used: run.roundStats?.gracesUsed ?? 0,
    coins: record.coins,
    evolutions: record.evolutions,
    evolutions_forged: run.forgedRecipes,
    power: record.power ?? null,
    waves_reached: run.wave,
    xp_level: run.xpLevel,
    weapons: record.weapons,
    weapons_offered: tape.choices?.offered ?? [],
    weapons_picked: tape.choices?.picked ?? [],
    weapons_bought: tape.choices?.bought ?? [],
    shop_rerolls: tape.choices?.rerolls ?? run.rerolls,
    charms: tape.save.charms,
    arcana: run.arcana,
    skill_nodes: run.skillNodes.length,
    fun_rating: funRating,
    fun_score: funScore,
    fun_tags: funTags,
    replay_opened: extras.replayOpened ?? false,
    seed: tape.recording.seed,
    recording_format: tape.recording.format,
    recording: tape.recording,
    save: tape.save,
  };
};

const buildAdventureProfileDelta = (
  level: LevelDef,
  run: RunState,
  record: BattleRecord,
  tape: FightTape,
  extras: FightEventExtras
): FightProfileUpdate => {
  if (extras.spire) {
    return {
      mode: 'spire',
      outcome: record.outcome,
      durationMs: record.durationMs,
      fighter: record.fighter,
      weapons: record.weapons,
      funRating: extras.funRating ?? record.funRating ?? null,
    };
  }
  const saveAfter = extras.afterSave ?? tape.save;
  const world = Number(level.id.split('-')[0]) || 1;
  return {
    mode: 'adventure',
    outcome: record.outcome,
    durationMs: record.durationMs,
    fighter: record.fighter,
    weapons: record.weapons,
    levelOrder: levelOrderOf(level),
    levelId: level.id,
    world,
    highestWorldUnlocked: highestWorldFromSave(saveAfter, record.outcome === 'won' ? world : null),
    levelsClearedCount: Object.values(saveAfter.stars ?? {}).filter(s => (s ?? 0) > 0).length,
    starsTotal: Object.values(saveAfter.stars ?? {}).reduce((a, b) => a + (b ?? 0), 0),
    unlocksCount:
      (saveAfter.armory?.length ?? 0) +
      (saveAfter.unlockedFighters?.length ?? 0) +
      (saveAfter.unlockedArcana?.length ?? 0),
    funRating: extras.funRating ?? record.funRating ?? null,
  };
};

/**
 * Stages `fight_ended` while the results screen is displayed so any 👍/👎 feedback
 * merges directly into that single event without inflating event volume.
 */
export const stageAdventureFight = (
  level: LevelDef,
  run: RunState,
  record: BattleRecord,
  tape: FightTape,
  extras: FightEventExtras = {}
): string => {
  const fightId = extras.fightId ?? record.fightId ?? `${record.at}-${tape.recording.seed}`;
  const props = fightEventProps(level, run, record, tape, { ...extras, fightId });
  const profileDelta = buildAdventureProfileDelta(level, run, record, tape, extras);
  stageEvent(FIGHT_EVENT, props, { fightId, profileDelta });
  return fightId;
};

/** Stages a Starfall Spire `fight_ended` event while the reward/end screen is visible so 👍/👎 feedback merges in place. */
export const stageSpireFight = (
  level: LevelDef,
  run: RunState,
  record: BattleRecord,
  tape: FightTape,
  extras: FightEventExtras & { spire: SpireFightMeta }
): string => stageAdventureFight(level, run, record, tape, extras);

/** Flushes a staged Adventure `fight_ended` event when leaving results or backgrounding. */
export const commitAdventureFight = (reason: string = 'navigation'): boolean =>
  commitStagedEvent(reason, true);

/** Flushes a staged Starfall Spire `fight_ended` event when leaving rewards/end screen or backgrounding. */
export const commitSpireFight = (reason: string = 'spire_navigation'): boolean =>
  commitStagedEvent(reason, true);

/**
 * Updates fun rating & tags on an active staged `fight_ended` event (emitting 0 extra
 * events), or falls back to a lightweight retrospective `fight_rated` event only if the
 * fight was already flushed to PostHog earlier (e.g. rated later from Camp -> History).
 */
export const rateFight = (
  fightId: string,
  feedback: { funRating: FunRating | null; funTags: FunTag[] },
  extra: { replayOpened?: boolean; source?: 'results' | 'history' | 'free_play' | 'classic' | 'spire' } = {}
): { updatedStaged: boolean } => {
  const updatedStaged = updateFightFeedbackInAnalytics(fightId, feedback, {
    replayOpened: extra.replayOpened,
  });
  if (!updatedStaged && feedback.funRating !== null && extra.source === 'history') {
    capture(FIGHT_RATED_EVENT, {
      fight_id: fightId,
      fun_rating: feedback.funRating,
      fun_score: feedback.funRating === 'up' ? 1 : 0,
      fun_tags: feedback.funTags,
      source: 'history',
    });
  }
  return { updatedStaged };
};

/** Marks on the currently staged event whether the player inspected FightReplay without overwriting ratings. */
export const markReplayOpened = (fightId: string): boolean =>
  updateFightFeedbackInAnalytics(fightId, {}, { replayOpened: true });

/** Sends one `fight_ended` event immediately (used for abandoned/restarted mid-fight runs). */
export const trackFight = (
  level: LevelDef,
  run: RunState,
  record: BattleRecord,
  tape: FightTape,
  extras: FightEventExtras = {}
) =>
  capture(FIGHT_EVENT, fightEventProps(level, run, record, tape, extras), {
    profileDelta: buildAdventureProfileDelta(level, run, record, tape, extras),
  });

export interface FreePlayFightPayload {
  fightId: string;
  difficulty: string;
  fighter: string;
  weapons: string[];
  sets: number;
  mistakes: number;
  score: number;
  durationMs: number;
  funRating: FunRating | null;
}

/** Emits a single wide `fight_ended` event when a Free Play session ends with at least one Set or mistake. */
export const trackFreePlayFight = (p: FreePlayFightPayload) => {
  const funScore = p.funRating === 'up' ? 1 : p.funRating === 'down' ? 0 : null;
  const accuracy = p.sets + p.mistakes > 0 ? round3(p.sets / (p.sets + p.mistakes)) : null;
  capture(
    FIGHT_EVENT,
    {
      fight_id: p.fightId,
      mode: 'free_play',
      level_id: `freeplay-${p.difficulty}`,
      level_name: `Free Play (${p.difficulty})`,
      difficulty: p.difficulty,
      outcome: 'left',
      fighter: p.fighter,
      weapons: p.weapons,
      sets: p.sets,
      mistakes: p.mistakes,
      accuracy,
      damage: p.score,
      duration_ms: Math.max(0, Math.round(p.durationMs)),
      fun_rating: p.funRating,
      fun_score: funScore,
      fun_tags: [],
    },
    {
      profileDelta: {
        mode: 'free_play',
        outcome: 'left',
        durationMs: p.durationMs,
        fighter: p.fighter,
        weapons: p.weapons,
        funRating: p.funRating,
      },
    }
  );
};

export interface ClassicRoundPayload {
  fightId: string;
  outcome: 'won' | 'lost' | 'left';
  difficulty: string;
  round: number;
  foe?: string;
  fighter: string;
  weapons: string[];
  sets: number;
  mistakes: number;
  score: number;
  targetScore: number;
  durationMs: number;
  funRating: FunRating | null;
  funTags?: FunTag[];
}

/** Emits a single wide `fight_ended` event when a Classic run finishes or exits. */
export const trackClassicRound = (p: ClassicRoundPayload) => {
  const funScore = p.funRating === 'up' ? 1 : p.funRating === 'down' ? 0 : null;
  const accuracy = p.sets + p.mistakes > 0 ? round3(p.sets / (p.sets + p.mistakes)) : null;
  capture(
    FIGHT_EVENT,
    {
      fight_id: p.fightId,
      mode: 'classic',
      level_id: `classic-r${p.round}`,
      level_name: `Classic Round ${p.round}`,
      difficulty: p.difficulty,
      outcome: p.outcome,
      waves_reached: p.round,
      foe: p.foe ?? null,
      fighter: p.fighter,
      weapons: p.weapons,
      sets: p.sets,
      mistakes: p.mistakes,
      accuracy,
      damage: p.score,
      foe_max_hp: p.targetScore,
      duration_ms: Math.max(0, Math.round(p.durationMs)),
      fun_rating: p.funRating,
      fun_score: funScore,
      fun_tags: p.funTags ?? [],
    },
    {
      profileDelta: {
        mode: 'classic',
        outcome: p.outcome,
        durationMs: p.durationMs,
        fighter: p.fighter,
        weapons: p.weapons,
        funRating: p.funRating,
      },
    }
  );
};
