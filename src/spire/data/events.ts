/**
 * Starfall Spire — 10 handcrafted Mystery Events.
 *
 * Every choice has a concrete, readable trade-off or boon; outcomes are
 * resolved deterministically through the Spire run RNG.
 */
import type { IconName } from '@/components/Icon';

export interface SpireEventOption {
  id: string;
  label: string;
  detail: string;
  /** Optional minimum coins required to choose */
  minCoins?: number;
  /** Optional minimum hearts > cost required so a choice never silently self-KOs */
  minHearts?: number;
  /** Optional requirement to hold at least 1 upgradeable weapon */
  needsWeapon?: boolean;
  tone?: 'bold' | 'safe' | 'neutral';
}

export interface SpireEventDef {
  id: string;
  title: string;
  icon: IconName;
  accent: string;
  story: string;
  options: SpireEventOption[];
}

export const SPIRE_EVENTS: readonly SpireEventDef[] = [
  {
    id: 'starfall_shrine',
    title: 'The Shattered Star Shrine',
    icon: 'delapouite/falling-star',
    accent: '#D97706',
    story:
      'A glowing meteorite hums in a stone basin. Touching the core burns your paws—but the starlight thrums with raw evolution energy.',
    options: [
      {
        id: 'absorb',
        label: 'Absorb the Core',
        detail: 'Lose 1 ♥ → Draft a Level 2 weapon & gain +6% Catalyst chance.',
        minHearts: 2,
        tone: 'bold',
      },
      {
        id: 'dust',
        label: 'Pocket the Starlight Dust',
        detail: 'Gain +65¢ with zero risk.',
        tone: 'safe',
      },
      {
        id: 'rest',
        label: 'Warm by the Basin',
        detail: 'Heal +2 ♥.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'cursed_anvil',
    title: 'The Runic Anvil',
    icon: 'lorc/anvil',
    accent: '#B91C1C',
    story:
      'Sparks leap off an abandoned star-iron anvil. One hammer blow could supercharge a charm—if you endure the recoil.',
    options: [
      {
        id: 'superforge',
        label: 'Overclock Forge',
        detail: 'Lose 1 ♥ → Upgrade a chosen weapon by +2 Levels (up to Lv 5).',
        minHearts: 2,
        needsWeapon: true,
        tone: 'bold',
      },
      {
        id: 'temper',
        label: 'Careful Polish',
        detail: 'Upgrade a random weapon by +1 Level for free.',
        needsWeapon: true,
        tone: 'safe',
      },
      {
        id: 'salvage',
        label: 'Salvage Star-Iron',
        detail: 'Gain +1 Heavy Hitter damage on every Set.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'mirror_pond',
    title: 'The Mirror Pond',
    icon: 'lorc/mirror-mirror',
    accent: '#0F766E',
    story:
      'Beneath the glassy surface, another version of your fighter practices techniques you have not mastered yet.',
    options: [
      {
        id: 'study',
        label: 'Learn from Your Reflection',
        detail: 'Pay 35¢ → Draft 1 of 3 real Fighter Skill Tree nodes.',
        minCoins: 35,
        tone: 'bold',
      },
      {
        id: 'drink',
        label: 'Drink the Starlight',
        detail: 'Restore to FULL Hearts.',
        tone: 'safe',
      },
      {
        id: 'coin',
        label: 'Toss a Lucky Coin',
        detail: 'Gain +1 Starting Grace & +1 Starting Hint for the rest of the run.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'wandering_alchemist',
    title: 'The Wandering Alchemist',
    icon: 'lorc/fizzing-flask',
    accent: '#7C3AED',
    story:
      'A hooded frog uncorks three bubbling vials on a folding crate. “First sip’s on the house, climber. Choose your chaos!”',
    options: [
      {
        id: 'arcana',
        label: 'Drink the Violet Tarot Tonic',
        detail: 'Gain a random Arcana wildcard (kiss-curse power!).',
        tone: 'bold',
      },
      {
        id: 'heart',
        label: 'Drink the Crimson Brew',
        detail: '+1 Max Heart & Heal +2 ♥.',
        tone: 'safe',
      },
      {
        id: 'catalyst',
        label: 'Pocket the Catalyst Flask',
        detail: '+8% Evolution Catalyst chance & +1 Evolution per fight.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'gamblers_dice',
    title: "The Gambler's Table",
    icon: 'delapouite/rolling-dices',
    accent: '#CA8A04',
    story:
      'Two star-etched dice rattle in a brass cup. A grinning fox-merchant taps the felt: “Double your gold—or walk with pocket change.”',
    options: [
      {
        id: 'high_stakes',
        label: 'Roll High Stakes (45¢)',
        detail: '65% chance: win +135¢ & a free Weapon! 35% chance: lose 45¢.',
        minCoins: 45,
        tone: 'bold',
      },
      {
        id: 'safe_roll',
        label: 'Take the House Freebie',
        detail: 'Guaranteed +40¢.',
        tone: 'safe',
      },
      {
        id: 'leave',
        label: 'Keep Walking',
        detail: 'Gain +8s on every future timed fight.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'sleeping_hoard',
    title: "The Sleeping Guardian's Hoard",
    icon: 'skoll/open-treasure-chest',
    accent: '#9F1239',
    story:
      'A massive treasure pile glitters behind a snoring Elite guardian. You could snag a pouch quietly—or wake it for the whole vault.',
    options: [
      {
        id: 'wake',
        label: 'Challenge the Guardian!',
        detail: 'Fight an immediate Elite for DOUBLE coins + full Elite loot!',
        tone: 'bold',
      },
      {
        id: 'sneak',
        label: 'Tiptoe with a Pouch',
        detail: 'Safely grab +55¢ without waking anyone.',
        tone: 'safe',
      },
    ],
  },
  {
    id: 'ancient_library',
    title: 'The Starfall Archive',
    icon: 'lorc/open-book',
    accent: '#2563EB',
    story:
      'Floating scrolls spiral around an ancient stone pedestal. Half are fighter treatises; half are forgotten fusion schematics.',
    options: [
      {
        id: 'technique',
        label: 'Master a Forbidden Technique',
        detail: 'Draft 1 of 3 Fighter Skill Tree nodes for free!',
        tone: 'bold',
      },
      {
        id: 'fusion',
        label: 'Transcribe Fusion Schematics',
        detail: '+10% Catalyst chance & +1 Evolution allowed per fight.',
        tone: 'safe',
      },
      {
        id: 'clarity',
        label: 'Memorize Pattern Tables',
        detail: '+2 Starting Hints & +10s on every future clock.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'bounty_camp',
    title: "Bounty Hunter's Arsenal",
    icon: 'lorc/crossed-swords',
    accent: '#EA580C',
    story:
      'A scarred veteran sharpens blades by the trail. “Your hearts look healthy. Trade me some grit and I’ll arm you to the teeth.”',
    options: [
      {
        id: 'arsenal',
        label: 'Blood Pact for Gear',
        detail: 'Lose 1 Max ♥ (min 3) → Draft a Level 2 weapon + gain +85¢.',
        minHearts: 4,
        tone: 'bold',
      },
      {
        id: 'patch',
        label: 'Share Bandages',
        detail: 'Heal +2 ♥ & gain +1 Starting Grace.',
        tone: 'safe',
      },
      {
        id: 'spar',
        label: 'Quick Sparring Drill',
        detail: '+2 Heavy Hitter damage on every Set.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'shady_peddler',
    title: 'The Mystery Crate',
    icon: 'lorc/locked-chest',
    accent: '#6D28D9',
    story:
      'A raccoon waves you into an alcove beside a vibrating wooden crate stamped with three gold stars.',
    options: [
      {
        id: 'buy_crate',
        label: 'Crack Open the Crate (55¢)',
        detail: 'Receive a guaranteed Level 3 Synergy Weapon!',
        minCoins: 55,
        tone: 'bold',
      },
      {
        id: 'haggle',
        label: 'Trade for Trail Supplies',
        detail: 'Free +1 Starting Hint, +1 Starting Grace & +25¢.',
        tone: 'safe',
      },
    ],
  },
  {
    id: 'prism_obelisk',
    title: 'The Prism Obelisk',
    icon: 'delapouite/prism',
    accent: '#DB2777',
    story:
      'Beams of red, green, and violet light split through a towering crystal obelisk, echoing with the rhythm of Shading Surge.',
    options: [
      {
        id: 'attune',
        label: 'Attune Your Belt',
        detail: 'Upgrade TWO random held weapons by +1 Level, take 1 ♥ recoil.',
        minHearts: 2,
        needsWeapon: true,
        tone: 'bold',
      },
      {
        id: 'prism_shard',
        label: 'Harvest a Prism Shard',
        detail: 'Gain +2 Heavy Hitter damage & +6% Catalyst chance.',
        tone: 'safe',
      },
      {
        id: 'bask',
        label: 'Bask in Warm Light',
        detail: '+1 Max Heart & Heal +1 ♥.',
        tone: 'neutral',
      },
    ],
  },
];

export const getSpireEvent = (id: string): SpireEventDef =>
  SPIRE_EVENTS.find(e => e.id === id) ?? SPIRE_EVENTS[0];
