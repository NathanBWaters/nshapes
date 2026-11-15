/**
 * One analytics event per Adventure fight (`fight_ended`): a flat summary to
 * query, plus the recording and starting save that replay it exactly
 * (engine/replay.ts `replayFight(getLevel(level_id), save, recording)`, on the
 * engine of `app_version`).
 */
import type { BattleRecord } from '@/adventure/history';
import type { FightTape } from '@/adventure/engine/replay';
import type { LevelDef, RunState } from '@/adventure/types';
import { capture } from './posthog';

export const FIGHT_EVENT = 'fight_ended';

export const fightEventProps = (level: LevelDef, run: RunState, record: BattleRecord, tape: FightTape) => ({
  level_id: level.id,
  level_name: level.name,
  world: Number(level.id.split('-')[0]) || null,
  side_path: !!level.branchOf,
  boss: !!level.isBoss,
  practice: !!level.rules.sandbox,
  foe: record.foe,
  fighter: record.fighter,
  outcome: record.outcome,
  end_reason: run.endReason ?? null,
  stars: record.stars,
  // How many times this level had been started before this fight
  attempt: (tape.save.plays?.[level.id] ?? 0) + 1,
  best_stars_before: tape.save.stars?.[level.id] ?? 0,
  total_stars_before: Object.values(tape.save.stars ?? {}).reduce((a, b) => a + b, 0),
  damage: record.damage,
  dpm: record.dpm,
  biggest_hit: record.biggestHit,
  sets: record.sets,
  mistakes: record.mistakes,
  duration_ms: record.durationMs,
  hearts_left: run.hearts,
  max_hearts: run.maxHearts,
  coins: record.coins,
  evolutions: record.evolutions,
  power: record.power ?? null,
  waves_reached: run.wave,
  xp_level: run.xpLevel,
  weapons: record.weapons,
  charms: tape.save.charms,
  arcana: run.arcana,
  skill_nodes: run.skillNodes.length,
  seed: tape.recording.seed,
  recording_format: tape.recording.format,
  recording: tape.recording,
  save: tape.save,
});

export const trackFight = (level: LevelDef, run: RunState, record: BattleRecord, tape: FightTape) =>
  capture(FIGHT_EVENT, fightEventProps(level, run, record, tape));
