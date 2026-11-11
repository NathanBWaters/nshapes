/**
 * Story beats. PLACEHOLDER TEXT — swap these for the real story later.
 * Each entry is a lesson page, so it gets the same card treatment as a
 * mechanic lesson (title, a few short paragraphs, optional demo).
 */
import type { LessonPage } from '../types';

export const STORY: Record<'welcome', LessonPage[]> = {
  welcome: [
    {
      title: 'The meadow needs you',
      body: [
        'Something has stirred up the creatures of the meadow, and they are picking fights with everyone.',
        'You fight back with your wits. Spot a Set of three cards and you land a hit.',
        'Win stars, earn coins, and recruit new fighters as you go.',
      ],
      demo: {
        type: 'icons',
        items: [
          { icon: 'lorc/crossed-swords', label: 'Beat foes' },
          { icon: 'lorc/crown-coin', label: 'Earn coins' },
          { icon: 'lorc/trophy', label: 'Unlock fighters' },
        ],
      },
    },
  ],
};
