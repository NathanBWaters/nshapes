/**
 * The story, in as few words as it can be told.
 *
 * A star fell over the summit and drove the wild critters mad — they raided
 * the valley, locked your animal friends in cages, and dropped Golden Cage Keys
 * along the road between levels. Walk over any Golden Key on the map to choose
 * which caged friend to free first, or climb where the star fell in Starfall Spire!
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
      title: 'A star fell—critters went wild!',
      body: 'They caged your friends and scattered Golden Keys across the valley.',
    },
    {
      scene: 'keys',
      title: 'Walk over keys to free anyone!',
      body: 'Every Golden Key on the road lets you choose which caged friend to save first.',
    },
    {
      scene: 'hero',
      title: 'Hang tight—I’m coming!',
      body: 'Match 3 cards: each trait all the same, or all different.',
      spoken: true,
    },
  ],
};

/** The mischievous foes swooping in during the abduction cold-open */
export const STORY_RAIDER_LEVELS = ['2-4', '1-10'] as const;

/** Alias kept for any caller referencing the story's enemy levels */
export const STORY_CRITTER_LEVELS = STORY_RAIDER_LEVELS;

/** Friends shown getting caged in Beat 1 */
export const STORY_CAPTIVE_FRIENDS: readonly CharacterName[] = ['Sly Fox', 'Corgi', 'Badger'] as const;
