/**
 * The story, in as few words as it can be told.
 *
 * A star fell on the Summit and shattered. Every critter that pocketed a shard
 * has gone a bit wild. Each Set you make knocks a shard loose; the stars you
 * earn on a level ARE those shards. That is why foes drop stars, why stars
 * power your fighter, and why the last world is called Starfall Summit.
 *
 * `welcome` plays once, the first time Adventure is opened, and leads straight
 * into the first fight (components/StoryIntro.tsx). Keep every line short: it
 * is read on a phone, by someone who came to play.
 */

/** What is on stage while a beat's words are up */
export type StoryScene =
  /** A star falls on the mountain and shatters */
  | 'starfall'
  /** Critters, each holding a shard */
  | 'critters'
  /** Your fighter, ready to go */
  | 'hero';

export interface StoryBeat {
  scene: StoryScene;
  /** Big words (a handful) */
  title: string;
  /** One or two short sentences */
  body: string;
  /** The hero beat: said by your fighter */
  spoken?: boolean;
}

export const STORY: Record<'welcome', StoryBeat[]> = {
  welcome: [
    {
      scene: 'starfall',
      title: 'A star fell on the Summit.',
      body: 'It shattered, and golden star shards rained across the valley.',
    },
    {
      scene: 'critters',
      title: 'The critters found them first.',
      body: 'Three shards each… and every one of them has gone a little wild.',
    },
    {
      scene: 'hero',
      title: 'Let’s win them back!',
      body: 'Match 3 cards: each trait all the same, or all different.',
      spoken: true,
    },
  ],
};

/** The level ids whose foes stand in the 'critters' scene */
export const STORY_CRITTER_LEVELS = ['1-2', '1-1', '1-3'] as const;
