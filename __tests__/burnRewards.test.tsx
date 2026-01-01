import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import GameBoard from '@/components/GameBoard';
import { Card, PlayerStats, CardReward } from '@/types';

// Mock the Card and RewardReveal components to simplify testing
jest.mock('@/components/Card', () => {
  const { View, Text } = require('react-native');
  return function MockCard({ card }: { card: Card }) {
    return (
      <View testID={`card-${card.id}`}>
        <Text>{card.id}</Text>
      </View>
    );
  };
});

jest.mock('@/components/RewardReveal', () => {
  const { View, Text } = require('react-native');
  return function MockRewardReveal({ reward }: { reward: CardReward }) {
    return (
      <View testID={`reward-${reward.cardId}`}>
        <Text>{reward.effectType || 'reward'}</Text>
      </View>
    );
  };
});

// Helper to create test cards
const createTestCard = (id: string): Card => ({
  id,
  shape: 'oval',
  color: 'red',
  number: 1,
  shading: 'solid',
  background: 'white',
  selected: false,
});

// Default player stats for testing
const defaultPlayerStats: PlayerStats = {
  maxHealth: 5,
  startingBoardSize: 12,
  startingTime: 60,
  bonusTimeOnMatch: 0,
  mulligans: 0,
  hints: 0,
  explosionChance: 0,
  growthChance: 0,
  fireStarterChance: 0,
  laserChance: 0,
  pointMultiplier: 1,
  moneyMultiplier: 1,
  healingChance: 0,
  hintChance: 0,
  holographicChance: 0,
  autoHintChance: 0,
  autoHintInterval: 10000,
  fortuneChance: 0,
};

describe('GameBoard Burn Rewards', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should display burn rewards when pendingBurnRewards is set', () => {
    const cards = [
      createTestCard('card-1'),
      createTestCard('card-2'),
      createTestCard('card-3'),
    ];

    const burnRewards: CardReward[] = [
      { cardId: 'card-1', points: 1, money: 1, effectType: 'fire' },
    ];

    const { getByTestId, queryByTestId } = render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        pendingBurnRewards={burnRewards}
        onBurnRewardsComplete={jest.fn()}
      />
    );

    // Should show reward for card-1
    expect(getByTestId('reward-card-1')).toBeTruthy();
    // Should show regular cards for others
    expect(getByTestId('card-card-2')).toBeTruthy();
    expect(getByTestId('card-card-3')).toBeTruthy();
  });

  it('should clear burn rewards after 500ms timeout', async () => {
    const cards = [
      createTestCard('card-1'),
      createTestCard('card-2'),
      createTestCard('card-3'),
    ];

    const burnRewards: CardReward[] = [
      { cardId: 'card-1', points: 1, money: 1, effectType: 'fire' },
    ];

    const onBurnRewardsComplete = jest.fn();

    const { queryByTestId, rerender } = render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        pendingBurnRewards={burnRewards}
        onBurnRewardsComplete={onBurnRewardsComplete}
      />
    );

    // Reward should be visible initially
    expect(queryByTestId('reward-card-1')).toBeTruthy();

    // Advance timer by 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Callback should have been called
    expect(onBurnRewardsComplete).toHaveBeenCalledWith(['card-1']);

    // Simulate parent clearing pendingBurnRewards after callback
    rerender(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        pendingBurnRewards={undefined}
        onBurnRewardsComplete={onBurnRewardsComplete}
      />
    );

    // Reward should be cleared
    expect(queryByTestId('reward-card-1')).toBeNull();
  });

  it('should call onBurnRewardsComplete with correct card IDs', () => {
    const cards = [
      createTestCard('card-1'),
      createTestCard('card-2'),
      createTestCard('card-3'),
    ];

    const burnRewards: CardReward[] = [
      { cardId: 'card-1', points: 1, money: 1, effectType: 'fire' },
      { cardId: 'card-2', points: 1, money: 1, effectType: 'fire' },
    ];

    const onBurnRewardsComplete = jest.fn();

    render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        pendingBurnRewards={burnRewards}
        onBurnRewardsComplete={onBurnRewardsComplete}
      />
    );

    // Advance timer
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onBurnRewardsComplete).toHaveBeenCalledWith(['card-1', 'card-2']);
  });

  it('should NOT accumulate rewards when callback reference changes', () => {
    const cards = [
      createTestCard('card-1'),
      createTestCard('card-2'),
      createTestCard('card-3'),
    ];

    const burnRewards: CardReward[] = [
      { cardId: 'card-1', points: 1, money: 1, effectType: 'fire' },
    ];

    const onBurnRewardsComplete1 = jest.fn();
    const onBurnRewardsComplete2 = jest.fn();

    const { rerender, queryAllByTestId } = render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        pendingBurnRewards={burnRewards}
        onBurnRewardsComplete={onBurnRewardsComplete1}
      />
    );

    // Should have exactly 1 reward showing
    expect(queryAllByTestId(/^reward-/)).toHaveLength(1);

    // Simulate callback reference changing (this was the bug)
    rerender(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        pendingBurnRewards={burnRewards}
        onBurnRewardsComplete={onBurnRewardsComplete2}
      />
    );

    // Should STILL have exactly 1 reward (not 2 - this was the bug)
    expect(queryAllByTestId(/^reward-/)).toHaveLength(1);

    // Advance timer
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // The latest callback should be called (using ref)
    expect(onBurnRewardsComplete2).toHaveBeenCalledWith(['card-1']);
    // First callback should NOT be called
    expect(onBurnRewardsComplete1).not.toHaveBeenCalled();
  });

  it('should handle multiple callback changes without accumulating rewards', () => {
    const cards = [
      createTestCard('card-1'),
      createTestCard('card-2'),
      createTestCard('card-3'),
    ];

    const burnRewards: CardReward[] = [
      { cardId: 'card-1', points: 1, money: 1, effectType: 'fire' },
    ];

    const { rerender, queryAllByTestId } = render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        pendingBurnRewards={burnRewards}
        onBurnRewardsComplete={jest.fn()}
      />
    );

    // Change callback multiple times rapidly (simulating React re-renders)
    for (let i = 0; i < 10; i++) {
      rerender(
        <GameBoard
          cards={cards}
          onMatch={jest.fn()}
          onInvalidSelection={jest.fn()}
          playerStats={defaultPlayerStats}
          isPlayerTurn={true}
          pendingBurnRewards={burnRewards}
          onBurnRewardsComplete={jest.fn()}
        />
      );
    }

    // Should STILL have exactly 1 reward (not 10+)
    expect(queryAllByTestId(/^reward-/)).toHaveLength(1);
  });

  it('should clear rewards within 500ms, not hang for >10 seconds', () => {
    const cards = [
      createTestCard('card-1'),
      createTestCard('card-2'),
      createTestCard('card-3'),
    ];

    const burnRewards: CardReward[] = [
      { cardId: 'card-1', points: 1, money: 1, effectType: 'fire' },
    ];

    const onBurnRewardsComplete = jest.fn();

    render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        pendingBurnRewards={burnRewards}
        onBurnRewardsComplete={onBurnRewardsComplete}
      />
    );

    // Should NOT be called before 500ms
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(onBurnRewardsComplete).not.toHaveBeenCalled();

    // Should be called at 500ms
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(onBurnRewardsComplete).toHaveBeenCalledTimes(1);

    // Should NOT be called again even after 10+ seconds
    act(() => {
      jest.advanceTimersByTime(15000);
    });
    expect(onBurnRewardsComplete).toHaveBeenCalledTimes(1);
  });
});
