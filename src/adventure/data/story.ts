/**
 * The story, in as few words as it can be told.
 *
 * A star fell over the summit and drove the wild critters mad — they raided
 * the valley, locked your animal friends in cages, and dropped Golden Cage Keys
 * along the road between levels. Walk over any Golden Key on the map to choose
 * which caged friend to free first, or climb where the star fell in Starfall Summit!
 *
 * `welcome` plays once, the first time Adventure is opened, and leads straight
 * into the first fight (components/StoryIntro.tsx). Keep every line short: it
 * is read on a phone, by someone who came to play.
 */
import type { CharacterName } from '@/types';

/** Shared one-line hook used on MainMenu so the title screen matches the opening story cleanly. */
export const STORY_TAGLINE = 'A star fell. The critters went wild.';

/** What is on stage while a beat's words are up */
export type StoryScene =
  /** A fallen star drives wild critters to raid, cage your friends, and scatter Golden Keys */
  | 'abduction'
  /** Winding valley road with Golden Keys between levels to free anyone you choose */
  | 'keys'
  /** Your fighter, ready to go rescue the crew */
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
      scene: 'abduction',
      title: 'Star shattered—critters went wild!',
      body: 'They hoarded Star Shards, caged your 5 friends, and dropped Golden Keys.',
    },
    {
      scene: 'keys',
      title: 'Walk over keys to free anyone!',
      body: 'Every Golden Key on the road lets you choose which caged friend to save first.',
    },
    {
      scene: 'hero',
      title: 'Hang tight—I’m coming!',
      body: 'Tap 3 cards below: each trait all the same, or all different.',
      spoken: true,
    },
  ],
};

/** The mischievous foes swooping in during the abduction cold-open */
export const STORY_RAIDER_LEVELS = ['2-4', '1-10'] as const;

/** Alias kept for any caller referencing the story's enemy levels */
export const STORY_CRITTER_LEVELS = STORY_RAIDER_LEVELS;

/** All 5 caged friends shown in Beat 1 (matching the 5 Golden Rescue Keys 1-to-1) */
export const STORY_CAPTIVE_FRIENDS: readonly CharacterName[] = [
  'Sly Fox',
  'Corgi',
  'Badger',
  'Emperor Penguin',
  'Pelican',
] as const;

/** Raider story callbacks acknowledging the cold-open abduction & stolen Golden Keys ([OB-19]). */
export const STORY_RAIDER_TAUNTS: Readonly<Record<string, string>> = {
  '1-10': 'Still hunting our Golden Keys? Nothing cracks this shell.',
  '2-4': 'Hey, those keys were ours—no free peeks in my woods!',
};

/** Boss-defeat narrative callbacks as you climb toward the shattered star at Starfall Summit ([OB-19]). */
export const STORY_BOSS_CALLBACKS: Readonly<Record<string, string>> = {
  '1-10': 'Iron Shell cracked! The raiders’ Golden Keys trail deeper into Whispering Woods.',
  '2-10': 'Venom’s web is torn! Warm Star Shards glow ahead in Ember Canyon.',
  '3-10': 'The Boar stands down! The fallen star’s trail climbs into Frozen Peaks.',
  '4-11': 'The Ancient Dragon yields! One final ascent remains: Starfall Summit.',
  '5-5': 'The Hydra falls and the shattered star shines whole over the valley again!',
};

/** Three-beat campaign finale after clearing 5-5 The Hydra ([OB-20]). */
export type EndingScene = 'star_restored' | 'reunion' | 'credits';

export interface EndingBeat {
  scene: EndingScene;
  eyebrow: string;
  title: string;
  body: string;
}

export const STORY_ENDING_BEATS: readonly EndingBeat[] = [
  {
    scene: 'star_restored',
    eyebrow: 'STARFALL SUMMIT',
    title: 'The fallen star shines whole!',
    body: 'Every Star Shard rises back into the summit sky, calming the wild critters across the valley.',
  },
  {
    scene: 'reunion',
    eyebrow: 'CREW REUNITED',
    title: 'Home safe together!',
    body: 'Every rescued friend gathers in Sunny Meadow to celebrate the road you conquered.',
  },
  {
    scene: 'credits',
    eyebrow: 'THANK YOU FOR PLAYING',
    title: 'The adventure continues!',
    body: 'Chase ★★★ across all 59 levels, forge new Evolutions, or test your build in Starfall Summit.',
  },
] as const;
