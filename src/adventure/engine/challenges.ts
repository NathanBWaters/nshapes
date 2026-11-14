/** ★★★ challenge descriptions, live progress, and checks. */
import type { ChallengeDef, LevelDef, RunState } from '../types';
import { levelDefeatCondition } from '../data/foes';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const describeChallenge = (level: LevelDef): string => {
  const c = level.challenge;
  switch (c.kind) {
    case 'noMistakes': return 'Win without a single wrong Set';
    case 'fullHearts': return 'Win without losing a heart';
    case 'movesLeft': return `Win with ${c.n}+ move${c.n === 1 ? '' : 's'} to spare`;
    case 'timeLeft': return `Win with ${c.n}+ seconds left`;
    case 'rainbows': return `Land ${plural(c.n, 'Rainbow Strike')}`;
    case 'streak': return `Make ${c.n} Sets in a row without a mistake`;
    case 'noGrace': return 'Win without using a grace';
    case 'hintsLeft': return `Win with ${c.n}+ hints unused`;
    case 'enemy': return levelDefeatCondition(level) ?? 'Defeat the foe';
    case 'useHints': return `Use ${plural(c.n, 'hint')}`;
    case 'graceSaves': return `Get saved by ${plural(c.n, 'grace')}`;
    case 'evolutions': return c.n === 1 ? 'Trigger an Evolution' : `Trigger ${c.n} Evolutions`;
    case 'defuseTraps': return `Defuse ${plural(c.n, 'trap')}`;
    case 'comboReach': return `Chain a ${c.n}-Set combo`;
    case 'bonusCards': return `Match ${plural(c.n, 'power or gold card')}`;
    case 'explosions': return `Set off ${plural(c.n, 'explosion')}`;
    case 'purityChain': return `Climb a ${c.n}-step Purity chain`;
    case 'levelUps': return `Level up ${c.n === 1 ? 'once' : `${c.n} times`}`;
    case 'shopBuys': return `Buy ${plural(c.n, 'weapon')} in the shop`;
    case 'bigHit': return `Deal ${c.n}+ damage in one Set`;
    case 'surgeSets': return c.n === 1 ? 'Make a Set during a Shading Surge' : `Make ${c.n} Sets during Shading Surges`;
  }
};

export interface ChallengeProgress {
  text: string;
  met: boolean;
  /** Can no longer be achieved this run */
  failed: boolean;
}

/** Live count toward a "do this n times" challenge, or null for pass/fail ones. */
export const challengeCount = (run: RunState, c: ChallengeDef): number | null => {
  const s = run.roundStats;
  switch (c.kind) {
    case 'rainbows': return s.allDifferentMatches;
    case 'streak': return s.maxStreak;
    case 'useHints': return s.hintsUsed;
    case 'graceSaves': return s.gracesUsed;
    case 'evolutions': return run.evolutionsTriggered;
    case 'defuseTraps': return run.trapsDefused;
    case 'comboReach': return run.maxCombo;
    case 'bonusCards': return run.bonusCardsMatched;
    case 'explosions': return run.explosionsTriggered;
    case 'purityChain': return run.maxPurityChain;
    case 'levelUps': return run.levelUpsTaken;
    case 'shopBuys': return run.shopBuys;
    case 'bigHit': return run.biggestHit;
    case 'surgeSets': return run.surge?.sets ?? 0;
    default: return null;
  }
};

export const challengeProgress = (run: RunState): ChallengeProgress => {
  const c: ChallengeDef = run.level.challenge;
  const s = run.roundStats;
  const text = describeChallenge(run.level);
  switch (c.kind) {
    case 'noMistakes': return { text, met: run.mistakes === 0, failed: run.mistakes > 0 };
    case 'fullHearts': return { text, met: s.damageReceived === 0, failed: s.damageReceived > 0 };
    case 'movesLeft': return { text, met: (run.movesLeft ?? 0) >= c.n, failed: (run.movesLeft ?? 0) < c.n };
    case 'timeLeft': return { text, met: (run.timeLeft ?? 0) >= c.n, failed: (run.timeLeft ?? 0) < c.n };
    case 'noGrace': return { text, met: s.gracesUsed === 0, failed: s.gracesUsed > 0 };
    case 'hintsLeft': return { text, met: run.stats.hints >= c.n, failed: run.stats.hints < c.n };
    case 'enemy': return { text, met: run.foe.checkDefeatCondition(s), failed: false };
    case 'streak': return { text: `${text} (best ${s.maxStreak}/${c.n})`, met: s.maxStreak >= c.n, failed: false };
    case 'bigHit': return { text: `${text} (best ${run.biggestHit})`, met: run.biggestHit >= c.n, failed: false };
    default: {
      const count = challengeCount(run, c) ?? 0;
      return { text: `${text} (${Math.min(count, c.n)}/${c.n})`, met: count >= c.n, failed: false };
    }
  }
};

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** The three star goals for a level, in plain words (preview + results). */
export const starGoals = (level: LevelDef, foeName: string): [string, string, string] => {
  const rule = level.starRule;
  if (rule?.kind === 'accuracy') {
    const mistakes = (n: number) => plural(n, 'mistake');
    return [
      `Beat ${foeName}`,
      `Beat ${foeName} with at most ${mistakes(rule.twoStarMax)}`,
      rule.threeStarMax === 0 ? `Beat ${foeName} with no mistakes` : `Beat ${foeName} with at most ${mistakes(rule.threeStarMax)}`,
    ];
  }
  const target = level.foes.length > 1 ? `all ${level.foes.length} waves` : foeName;
  const survive = level.rules.timer
    ? `Survive ${level.rules.timer} seconds`
    : `Still be standing after ${level.rules.moves} moves`;
  const defeat = level.rules.timer ? `Defeat ${target} before time runs out` : `Defeat ${target} within ${level.rules.moves} moves`;
  return [survive, defeat, `Defeat ${target}, and ${lowerFirst(describeChallenge(level))}`];
};
