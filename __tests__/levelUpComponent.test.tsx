/**
 * Component tests for LevelUp screen
 *
 * Tests that the LevelUp component correctly displays:
 * - The target level number
 * - Dynamic button text based on pending level-ups
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import LevelUp from '@/components/LevelUp';
import { Weapon, PlayerStats } from '@/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';

// Mock dependencies
jest.mock('@/components/Icon', () => {
  const { View } = require('react-native');
  return function MockIcon() {
    return <View testID="mock-icon" />;
  };
});

jest.mock('@/components/GameMenu', () => {
  const { View } = require('react-native');
  return function MockGameMenu() {
    return <View testID="mock-game-menu" />;
  };
});

jest.mock('@/components/InventoryBar', () => {
  const { View } = require('react-native');
  return function MockInventoryBar() {
    return <View testID="mock-inventory-bar" />;
  };
});

jest.mock('@/components/effects/ConfettiBurst', () => {
  const { View } = require('react-native');
  return {
    ConfettiBurst: function MockConfettiBurst() {
      return <View testID="mock-confetti" />;
    },
  };
});

jest.mock('@/components/ScreenTransition', () => {
  const { View } = require('react-native');
  return {
    ScreenTransition: function MockScreenTransition({ children }: { children: React.ReactNode }) {
      return <View testID="mock-screen-transition">{children}</View>;
    },
  };
});

jest.mock('@/utils/sounds', () => ({
  playSound: jest.fn(),
}));

// Create test weapons
const createTestWeapon = (id: string): Weapon => ({
  id: `test-weapon-${id}`,
  name: 'Blast Powder',
  level: 1,
  rarity: 'common',
  price: 10,
  icon: 'lorc/cat',
  description: 'Test weapon description',
  shortDescription: 'Test short desc',
  flavorText: 'Test flavor text',
  effects: {
    explosionChance: 10,
  },
});

const defaultProps = {
  options: [
    createTestWeapon('Weapon 1'),
    createTestWeapon('Weapon 2'),
    createTestWeapon('Weapon 3'),
  ],
  onSelect: jest.fn(),
  onReroll: jest.fn(),
  rerollCost: 10,
  playerMoney: 100,
  freeRerolls: 0,
  playerStats: DEFAULT_PLAYER_STATS as PlayerStats,
  playerWeapons: [],
  onExitGame: jest.fn(),
};

describe('LevelUp Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Level number display', () => {
    it('displays the target level number', () => {
      const { getByText } = render(
        <LevelUp
          {...defaultProps}
          targetLevel={7}
          hasMoreLevelUps={false}
        />
      );

      expect(getByText('Level 7')).toBeTruthy();
    });

    it('displays level 1 for first level-up', () => {
      const { getByText } = render(
        <LevelUp
          {...defaultProps}
          targetLevel={1}
          hasMoreLevelUps={false}
        />
      );

      expect(getByText('Level 1')).toBeTruthy();
    });

    it('displays high level numbers correctly', () => {
      const { getByText } = render(
        <LevelUp
          {...defaultProps}
          targetLevel={15}
          hasMoreLevelUps={false}
        />
      );

      expect(getByText('Level 15')).toBeTruthy();
    });
  });

  describe('Button text', () => {
    it('shows "Next Level Up" when more level-ups pending', () => {
      const { getByText } = render(
        <LevelUp
          {...defaultProps}
          targetLevel={6}
          hasMoreLevelUps={true}
        />
      );

      expect(getByText('Next Level Up')).toBeTruthy();
    });

    it('shows "Select Weapon" on final level-up', () => {
      const { getByText } = render(
        <LevelUp
          {...defaultProps}
          targetLevel={8}
          hasMoreLevelUps={false}
        />
      );

      expect(getByText('Select Weapon')).toBeTruthy();
    });
  });

  describe('Multi-level-up sequence', () => {
    it('first screen of double level-up shows correct state', () => {
      // Simulating first screen when player gained 2 levels (5 → 7)
      const { getByText } = render(
        <LevelUp
          {...defaultProps}
          targetLevel={6}
          hasMoreLevelUps={true}
        />
      );

      expect(getByText('Level 6')).toBeTruthy();
      expect(getByText('Next Level Up')).toBeTruthy();
    });

    it('second screen of double level-up shows correct state', () => {
      // Simulating second screen when player gained 2 levels (5 → 7)
      const { getByText } = render(
        <LevelUp
          {...defaultProps}
          targetLevel={7}
          hasMoreLevelUps={false}
        />
      );

      expect(getByText('Level 7')).toBeTruthy();
      expect(getByText('Select Weapon')).toBeTruthy();
    });
  });
});
