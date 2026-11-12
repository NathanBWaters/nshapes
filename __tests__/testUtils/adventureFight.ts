/**
 * Fixture levels, saves and moves for adventure engine tests. Levels are built
 * here (not read from data/levels.ts) so engine tests don't move when content
 * is retuned.
 */
import type { Card, CardReward, Weapon } from '@/types';
import type { AdventureSave, AdventureWeapon, FeatureFlag, LevelDef, LevelRules, RunState } from '@/adventure/types';
import type { Modifiers, Rule } from '@/adventure/rules/types';
import { createNewSave } from '@/adventure/progress';
import { createRun, runReducer } from '@/adventure/engine/run';
import { allSets } from '@/adventure/engine/sets';

export const ALL_FEATURES: FeatureFlag[] = ['hearts', 'gear', 'power', 'rainbow', 'purity', 'coins', 'hints', 'graces', 'xp', 'evolutions', 'shop'];

export const testLevel = (over: Partial<Omit<LevelDef, 'rules'>> & { rules?: Partial<LevelRules> } = {}): LevelDef => {
  const { rules, ...rest } = over;
  return {
    id: 'test',
    biome: 'meadow',
    name: 'Test Field',
    introduces: 'set_rule',
    foes: [{ name: 'Dummy', hp: 999 }],
    challenge: { kind: 'noMistakes' },
    coinMultiplier: 1,
    difficulty: 1,
    rewards: { star1: { coins: 1 }, star2: { coins: 1 }, star3: { coins: 1 } },
    ...rest,
    rules: { attributes: ['shape', 'color', 'number'], hearts: 5, ...rules },
  };
};

export const testSave = (over: Partial<AdventureSave> = {}): AdventureSave => ({
  ...createNewSave(),
  unlockedFighters: ['Orange Tabby', 'Sly Fox', 'Badger', 'Emperor Penguin', 'Corgi', 'Pelican'],
  ...over,
});

export interface FightOptions {
  level?: LevelDef;
  save?: Partial<AdventureSave>;
  features?: FeatureFlag[];
  seed?: number;
}

export const startFight = (o: FightOptions = {}): RunState =>
  createRun(o.level ?? testLevel(), testSave(o.save), {
    seed: o.seed ?? 1,
    features: new Set(o.features ?? ALL_FEATURES),
  });

/** A relic that carries rules, for injecting into a run's held weapons. */
export const relic = (rules: Rule[], modifiers?: Modifiers, id = 'test-relic'): Weapon => {
  const w: AdventureWeapon = {
    id, name: 'Test Relic', rarity: 'common', level: 1, description: '', shortDescription: '', price: 1, effects: {}, rules, modifiers,
  };
  return w;
};

export const withWeapons = (s: RunState, ...weapons: Weapon[]): RunState => ({ ...s, weapons: [...s.weapons, ...weapons] });

export const plainRewards = (cards: Card[]): CardReward[] => cards.map(c => ({ cardId: c.id, points: 1, money: 1, experience: 1 }));

/** Any Set on the board that `ok` accepts (default: the first one). */
export const findSet = (s: RunState, ok: (set: Card[]) => boolean = () => true): Card[] | undefined =>
  allSets(s.board, s.attributes).find(ok);

/** Match a Set (default: the first one) and replace its cards, like the UI does. */
export const playSet = (s: RunState, set: Card[] | undefined = findSet(s)): RunState => {
  if (!set) throw new Error('no Set on the board');
  let next = runReducer(s, { type: 'MATCH', cards: set, rewards: plainRewards(set) });
  next = runReducer(next, { type: 'REPLACE', ids: set.map(c => c.id) });
  return next;
};

export const miss = (s: RunState): RunState => {
  const wrong = s.board.slice(0, 3);
  const next = runReducer(s, { type: 'INVALID', cards: wrong });
  return runReducer(next, { type: 'REPLACE', ids: wrong.map(c => c.id) });
};

export const tick = (s: RunState, ms: number, step = 250): RunState => {
  let next = s;
  for (let t = 0; t < ms; t += step) next = runReducer(next, { type: 'TICK', ms: Math.min(step, ms - t) });
  return next;
};

export const eventsOf = (s: RunState, type: string) => s.events.filter(e => e.type === type);
