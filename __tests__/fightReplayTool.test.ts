/**
 * Analysis tool: replay real players' fights from analytics events.
 *
 *   FIGHTS=fights.json npm run fights:replay
 *
 * `fights.json` holds `fight_ended` event properties (an array, or a PostHog
 * query result whose rows are [properties], or a raw capture batch). Each fight is replayed on this
 * checkout's engine (use the commit of the event's `app_version` for older
 * events), checked against the numbers the player saw, and its fight log is
 * written next to the input as `<name>.replayed.json` and printed in short.
 *
 * Without FIGHTS this suite only checks that it loads.
 */
import * as fs from 'fs';
import { replayFight, type FightRecording } from '@/adventure/engine/replay';
import { getLevel, PRACTICE_LEVELS } from '@/adventure/data/levels';
import type { AdventureSave } from '@/adventure/types';

interface FightEvent {
  level_id: string;
  app_version?: string;
  outcome?: string;
  damage: number;
  sets: number;
  mistakes: number;
  duration_ms: number;
  recording: FightRecording;
  save: AdventureSave;
}

const FILE = process.env.FIGHTS;

const load = (file: string): FightEvent[] => {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows: unknown[] = Array.isArray(raw) ? raw : raw.results ?? raw.batch ?? [];
  return rows
    .map(r => (Array.isArray(r) ? r[0] : r))
    .map(r => (typeof r === 'string' ? JSON.parse(r) : r))
    .map(r => (r && typeof r === 'object' && 'properties' in r ? (r as { properties: unknown }).properties : r)) as FightEvent[];
};

describe('fight replay tool', () => {
  it('loads', () => {
    expect(typeof replayFight).toBe('function');
  });

  (FILE ? it : it.skip)('replays every fight in FIGHTS', () => {
    const fights = load(FILE!).filter(f => f?.recording && f.save);
    const out = fights.map(f => {
      const level = PRACTICE_LEVELS.find(l => l.id === f.level_id) ?? getLevel(f.level_id);
      const s = replayFight(level, f.save, f.recording);
      const seen = { damage: f.damage, sets: f.sets, mistakes: f.mistakes, duration_ms: f.duration_ms };
      const replayed = { damage: s.totalDamage, sets: s.matches, mistakes: s.mistakes, duration_ms: s.elapsedMs };
      const matches = JSON.stringify(seen) === JSON.stringify(replayed);
      // eslint-disable-next-line no-console
      console.log(`${f.level_id} ${f.outcome ?? ''} v${f.app_version ?? '?'} ${matches ? 'replays exactly' : `DIFFERS (seen ${JSON.stringify(seen)}, replayed ${JSON.stringify(replayed)})`}`);
      return { level_id: f.level_id, app_version: f.app_version, matches, seen, replayed, status: s.status, endReason: s.endReason, log: s.log };
    });
    fs.writeFileSync(FILE!.replace(/\.json$/, '') + '.replayed.json', JSON.stringify(out, null, 1));
    expect(fights.length).toBeGreaterThan(0);
  });
});

