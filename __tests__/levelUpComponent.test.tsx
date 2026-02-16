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
import { LevelUpOption, FusionWeapon, PlayerStats } from '@/types';
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

jest.mock('@/components/KeywordText', () => {
  const { Text } = require('react-native');
  return function MockKeywordText({ children, style }: { children: React.ReactNode; style?: object }) {
    return <Text style={style}>{children}</Text>;
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Create test FusionWeapon
const createTestFusionWeapon = (id: string): FusionWeapon => ({
  id: `test-weapon-${id}`,
  name: 'Blast Powder',
  type: 'weapon',
  level: 1,
  fusionTier: 0,
  icon: 'lorc/cat',
  description: 'Test weapon description',
  shortDescription: 'Test short desc',
  flavorText: 'Test flavor text',
  levelEffects: {
    1: { explosionChance: 10 },
    2: { explosionChance: 15 },
    3: { explosionChance: 20 },
  },
});

// Create test LevelUpOption
const createTestOption = (id: string, type: 'new' | 'upgrade' = 'new'): LevelUpOption => ({
  type,
  item: createTestFusionWeapon(id),
  slotInfo: type === 'upgrade' ? { slotType: 'weapons', slotIndex: 0 } : undefined,
});

const defaultProps = {
  options: [
    createTestOption('1'),
    createTestOption('2'),
    createTestOption('3'),
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

    it('shows "Get Item" on final level-up with new item', () => {
      const { getByText } = render(
        <LevelUp
          {...defaultProps}
          targetLevel={8}
          hasMoreLevelUps={false}
        />
      );

      expect(getByText('Get Item')).toBeTruthy();
    });

    it('shows "Upgrade Item" when focused on upgrade option', () => {
      const upgradeOptions = [
        createTestOption('1', 'upgrade'),
        createTestOption('2', 'upgrade'),
        createTestOption('3', 'upgrade'),
      ];

      const { getByText } = render(
        <LevelUp
          {...defaultProps}
          options={upgradeOptions}
          targetLevel={8}
          hasMoreLevelUps={false}
        />
      );

      expect(getByText('Upgrade Item')).toBeTruthy();
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
      expect(getByText('Get Item')).toBeTruthy();
    });
  });
});
