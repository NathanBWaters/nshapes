/** ★★★ challenge descriptions, live progress, and checks. */
import { createEnemy, isEnemyRegistered } from '@/utils/enemyFactory';
import '@/utils/enemies';
import type { ChallengeDef, LevelDef, RunState } from '../types';

const lastRegisteredFoe = (level: LevelDef): string | undefined =>
  [...level.foes].reverse().find(f => f.enemy && isEnemyRegistered(f.enemy))?.enemy;

export const describeChallenge = (level: LevelDef): string => {
  const c = level.challenge;
  switch (c.kind) {
    case 'noMistakes': return 'Win without a single wrong Set';
    case 'fullHearts': return 'Win without losing a heart';
    case 'movesLeft': return `Win with ${c.n}+ move${c.n === 1 ? '' : 's'} to spare`;
    case 'timeLeft': return `Win with ${c.n}+ seconds left`;
    case 'rainbows': return `Land ${c.n} Rainbow Strikes`;
    case 'streak': return `Make ${c.n} Sets in a row without a mistake`;
    case 'noGrace': return 'Win without using a grace';
    case 'hintsLeft': return `Win with ${c.n}+ hints unused`;
    case 'enemy': {
      const name = lastRegisteredFoe(level);
      return name ? createEnemy(name).defeatConditionText : 'Defeat the foe';
    }
  }
};

export interface ChallengeProgress {
  text: string;
  met: boolean;
  /** Can no longer be achieved this run */
  failed: boolean;
}

export const challengeProgress = (run: RunState): ChallengeProgress => {
  const c: ChallengeDef = run.level.challenge;
  const s = run.roundStats;
  const text = describeChallenge(run.level);
  switch (c.kind) {
    case 'noMistakes': return { text, met: run.mistakes === 0, failed: run.mistakes > 0 };
    case 'fullHearts': return { text, met: s.damageReceived === 0, failed: s.damageReceived > 0 };
    case 'movesLeft': return { text, met: (run.movesLeft ?? 0) >= c.n, failed: (run.movesLeft ?? 0) < c.n };
    case 'timeLeft': return { text, met: (run.timeLeft ?? 0) >= c.n, failed: (run.timeLeft ?? 0) < c.n };
    case 'rainbows': return { text: `${text} (${Math.min(s.allDifferentMatches, c.n)}/${c.n})`, met: s.allDifferentMatches >= c.n, failed: false };
    case 'streak': return { text: `${text} (best ${s.maxStreak}/${c.n})`, met: s.maxStreak >= c.n, failed: false };
    case 'noGrace': return { text, met: s.gracesUsed === 0, failed: s.gracesUsed > 0 };
    case 'hintsLeft': return { text, met: run.stats.hints >= c.n, failed: run.stats.hints < c.n };
    case 'enemy': {
      const met = run.foe.checkDefeatCondition(s);
      return { text, met, failed: false };
    }
  }
};
