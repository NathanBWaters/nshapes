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
    case 'colorSets': return `Make ${plural(c.n, `all-${c.color} Set`)}`;
    case 'sameColorSets': return `Make ${plural(c.n, 'single-color Set')}`;
    case 'allDiffSets': return `Make ${plural(c.n, 'all-different Set')}`;
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
    case 'colorSets': return run.colorSets[c.color];
    case 'sameColorSets': return s.allSameColorMatches;
    case 'allDiffSets': return s.allDifferentMatches;
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

/** The three star goals for a level, in plain words (preview + results). */
export const starGoals = (level: LevelDef, foeName: string): [string, string, string] => {
  const rule = level.starRule;
  if (rule?.kind === 'accuracy') {
    const mistakes = (n: number) => plural(n, 'mistake');
    return [
      `Beat ${foeName}`,
      `At most ${mistakes(rule.twoStarMax)}`,
      rule.threeStarMax === 0 ? 'Zero mistakes' : `At most ${mistakes(rule.threeStarMax)}`,
    ];
  }
  const target = level.foes.length > 1 ? `all ${level.foes.length} waves` : foeName;
  const survive = level.rules.timer
    ? `Survive ${level.rules.timer}s`
    : `Finish all ${level.rules.moves} moves`;
  return [survive, `Knock out ${target}`, `${describeChallenge(level)}`];
};

export interface StarCheckRow {
  star: 1 | 2 | 3;
  earned: boolean;
  goal: string;
  /** Plain-English reason why the player hit or missed this star */
  reason: string;
}

/** Post-battle checklist explaining why each star (★, ★★, ★★★) was or was not earned. */
export const explainStarBreakdown = (level: LevelDef, run: RunState, stars: number): [StarCheckRow, StarCheckRow, StarCheckRow] => {
  const goals = starGoals(level, run.foeName);
  const rule = level.starRule;
  if (rule?.kind === 'accuracy') {
    const m = run.mistakes;
    const mText = `${m} mistake${m === 1 ? '' : 's'}`;
    return [
      {
        star: 1,
        earned: stars >= 1,
        goal: goals[0],
        reason: stars >= 1 ? `${run.matches} matches!` : 'Stopped early',
      },
      {
        star: 2,
        earned: stars >= 2,
        goal: goals[1],
        reason: stars >= 2 ? mText : `${mText} (max ${rule.twoStarMax})`,
      },
      {
        star: 3,
        earned: stars >= 3,
        goal: goals[2],
        reason: stars >= 3 ? (m === 0 ? 'Flawless!' : mText) : `${mText} (max ${rule.threeStarMax})`,
      },
    ];
  }

  const s = run.roundStats;
  const c = level.challenge;
  const prog = challengeProgress(run);
  const count = challengeCount(run, c);
  const hpLeft = Math.max(1, Math.ceil(run.foeHp));

  const lostHearts = run.hearts !== null && run.hearts <= 0;
  const star1Reason =
    stars >= 1
      ? 'Cleared!'
      : lostHearts
        ? 'Ran out of hearts'
        : run.movesLeft !== null && run.movesLeft <= 0
          ? 'Out of moves'
          : 'Not cleared';
  const star2Reason =
    stars >= 2
      ? 'Knocked out!'
      : lostHearts
        ? 'Ran out of hearts'
        : `${hpLeft} HP left`;

  let star3Reason = 'Complete!';
  if (stars >= 3) {
    if (count !== null && 'n' in c) star3Reason = `${count}/${c.n} done!`;
    else if (c.kind === 'bigHit') star3Reason = `Best hit ${run.biggestHit}!`;
    else if (c.kind === 'noMistakes') star3Reason = '0 mistakes!';
    else if (c.kind === 'fullHearts') star3Reason = 'No hearts lost!';
    else if (c.kind === 'enemy') star3Reason = 'Boss goal met!';
  } else if (prog.met && stars < 2) {
    star3Reason = stars === 0 ? 'Goal met, but lost ♥' : 'Goal met — need ★★ KO too';
  } else {
    switch (c.kind) {
      case 'noMistakes':
        star3Reason = `${run.mistakes} mistake${run.mistakes === 1 ? '' : 's'} (need 0)`;
        break;
      case 'fullHearts':
        star3Reason = 'Lost a heart';
        break;
      case 'movesLeft':
        star3Reason = `${run.movesLeft ?? 0} left (need ${c.n}+)`;
        break;
      case 'timeLeft':
        star3Reason = `${Math.max(0, Math.floor(run.timeLeft ?? 0))}s left (need ${c.n}s+)`;
        break;
      case 'noGrace':
        star3Reason = `Used ${s.gracesUsed} grace${s.gracesUsed === 1 ? '' : 's'}`;
        break;
      case 'hintsLeft':
        star3Reason = `${run.stats.hints} unused (need ${c.n}+)`;
        break;
      case 'bigHit':
        star3Reason = `Best hit ${run.biggestHit} (need ${c.n}+)`;
        break;
      case 'streak':
        star3Reason = `Best ${s.maxStreak}/${c.n} in a row`;
        break;
      case 'enemy':
        star3Reason = 'Boss goal missed';
        break;
      default: {
        const n = 'n' in c ? c.n : 0;
        star3Reason = `${count ?? 0}/${n} done`;
        break;
      }
    }
  }

  return [
    { star: 1, earned: stars >= 1, goal: goals[0], reason: star1Reason },
    { star: 2, earned: stars >= 2, goal: goals[1], reason: star2Reason },
    { star: 3, earned: stars >= 3, goal: `${goals[2]} (+ KO)`, reason: star3Reason },
  ];
};
