import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import GameBoard from '@/components/GameBoard';
import { Card as CardType, PlayerStats, CardReward } from '@/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';

// Mock the Card component to simplify testing
jest.mock('@/components/Card', () => {
  const React = require('react');
  const { TouchableOpacity, Text, View } = require('react-native');

  return function MockCard({
    card,
    onClick,
    disabled,
  }: {
    card: CardType;
    onClick: (card: CardType) => void;
    disabled?: boolean;
    onBurnComplete?: (card: CardType) => void;
    isPaused?: boolean;
  }) {
    return (
      <TouchableOpacity
        testID={`card-${card.id}`}
        onPress={() => !disabled && onClick(card)}
        disabled={disabled}
      >
        <Text>{card.id}</Text>
        <View testID={`card-shape-${card.shape}`} />
        <View testID={`card-color-${card.color}`} />
        <View testID={`card-number-${card.number}`} />
      </TouchableOpacity>
    );
  };
});

// Mock RewardReveal to display a testable element
jest.mock('@/components/RewardReveal', () => {
  const { View, Text } = require('react-native');

  return function MockRewardReveal({ reward }: { reward: { cardId: string; effectType?: string; points?: number; money?: number } }) {
    return (
      <View testID={`reward-reveal-${reward.cardId}`}>
        <Text testID={`reward-effect-${reward.cardId}`}>{reward.effectType || 'match'}</Text>
        {reward.points && <Text testID={`reward-points-${reward.cardId}`}>+{reward.points}</Text>}
        {reward.money && <Text testID={`reward-money-${reward.cardId}`}>${reward.money}</Text>}
      </View>
    );
  };
});

// Helper to create test cards that form a valid SET
const createValidSetCards = (): CardType[] => [
  {
    id: 'card-1',
    shape: 'diamond',
    color: 'red',
    number: 1,
    shading: 'solid',
    background: 'white',
    selected: false,
  },
  {
    id: 'card-2',
    shape: 'diamond',
    color: 'green',
    number: 1,
    shading: 'solid',
    background: 'white',
    selected: false,
  },
  {
    id: 'card-3',
    shape: 'diamond',
    color: 'purple',
    number: 1,
    shading: 'solid',
    background: 'white',
    selected: false,
  },
];

// Create additional cards to fill the board
const createFillerCards = (): CardType[] => [
  {
    id: 'card-4',
    shape: 'oval',
    color: 'red',
    number: 2,
    shading: 'striped',
    background: 'white',
    selected: false,
  },
  {
    id: 'card-5',
    shape: 'squiggle',
    color: 'green',
    number: 3,
    shading: 'open',
    background: 'white',
    selected: false,
  },
  {
    id: 'card-6',
    shape: 'diamond',
    color: 'purple',
    number: 2,
    shading: 'striped',
    background: 'white',
    selected: false,
  },
];

// Default player stats for testing
const defaultPlayerStats: PlayerStats = {
  ...DEFAULT_PLAYER_STATS,
};

describe('Match Rewards Display', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call onMatch immediately when valid SET is selected', () => {
    const cards = [...createValidSetCards(), ...createFillerCards()];
    const onMatch = jest.fn();

    const { getByTestId } = render(
      <GameBoard
        cards={cards}
        onMatch={onMatch}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        activeAttributes={['shape', 'color', 'number']}
      />
    );

    // Select 3 cards that form a valid SET
    fireEvent.press(getByTestId('card-card-1'));
    fireEvent.press(getByTestId('card-card-2'));
    fireEvent.press(getByTestId('card-card-3'));

    // Advance past the 200ms selection delay
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // onMatch should be called immediately (not after 1.5s)
    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(onMatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'card-1' }),
        expect.objectContaining({ id: 'card-2' }),
        expect.objectContaining({ id: 'card-3' }),
      ]),
      expect.any(Array), // rewards
      expect.any(Object) // weaponEffects
    );
  });

  it('should show RewardReveal components for matched cards', () => {
    const cards = [...createValidSetCards(), ...createFillerCards()];
    const onMatch = jest.fn();

    const { getByTestId, queryByTestId } = render(
      <GameBoard
        cards={cards}
        onMatch={onMatch}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        activeAttributes={['shape', 'color', 'number']}
      />
    );

    // Initially, reward reveals should not exist
    expect(queryByTestId('reward-reveal-card-1')).toBeNull();
    expect(queryByTestId('reward-reveal-card-2')).toBeNull();
    expect(queryByTestId('reward-reveal-card-3')).toBeNull();

    // Select 3 cards that form a valid SET
    fireEvent.press(getByTestId('card-card-1'));
    fireEvent.press(getByTestId('card-card-2'));
    fireEvent.press(getByTestId('card-card-3'));

    // Advance past the 200ms selection delay
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // RewardReveal components should now be displayed
    expect(getByTestId('reward-reveal-card-1')).toBeTruthy();
    expect(getByTestId('reward-reveal-card-2')).toBeTruthy();
    expect(getByTestId('reward-reveal-card-3')).toBeTruthy();
  });

  it('should clear rewards after 1.5 seconds', () => {
    const cards = [...createValidSetCards(), ...createFillerCards()];
    const onMatch = jest.fn();

    const { getByTestId, queryByTestId } = render(
      <GameBoard
        cards={cards}
        onMatch={onMatch}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        activeAttributes={['shape', 'color', 'number']}
      />
    );

    // Select 3 cards that form a valid SET
    fireEvent.press(getByTestId('card-card-1'));
    fireEvent.press(getByTestId('card-card-2'));
    fireEvent.press(getByTestId('card-card-3'));

    // Advance past the 200ms selection delay
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // Verify rewards are showing
    expect(getByTestId('reward-reveal-card-1')).toBeTruthy();

    // Advance to just before 1.5s clear time
    act(() => {
      jest.advanceTimersByTime(1400);
    });

    // Rewards should still be visible
    expect(queryByTestId('reward-reveal-card-1')).toBeTruthy();

    // Advance past 1.5s
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Rewards should be cleared
    expect(queryByTestId('reward-reveal-card-1')).toBeNull();
  });

  it('should include rewards with points and money in onMatch callback', () => {
    const cards = [...createValidSetCards(), ...createFillerCards()];
    const onMatch = jest.fn();

    const { getByTestId } = render(
      <GameBoard
        cards={cards}
        onMatch={onMatch}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        activeAttributes={['shape', 'color', 'number']}
      />
    );

    // Select 3 cards that form a valid SET
    fireEvent.press(getByTestId('card-card-1'));
    fireEvent.press(getByTestId('card-card-2'));
    fireEvent.press(getByTestId('card-card-3'));

    // Advance past the 200ms selection delay
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // Verify rewards contain expected properties
    const [, rewards] = onMatch.mock.calls[0];
    expect(rewards.length).toBe(3); // One reward per matched card
    expect(rewards[0]).toMatchObject({
      cardId: expect.any(String),
      points: expect.any(Number),
      money: expect.any(Number),
      experience: expect.any(Number),
    });
  });
});

describe('Grace Match Rewards Display', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show grace effect type when grace saves a near-miss', () => {
    // Create cards that are almost a valid SET (1 attribute wrong)
    const cards: CardType[] = [
      {
        id: 'card-1',
        shape: 'diamond',
        color: 'red',
        number: 1,
        shading: 'solid',
        background: 'white',
        selected: false,
      },
      {
        id: 'card-2',
        shape: 'diamond',
        color: 'green',
        number: 1,
        shading: 'solid',
        background: 'white',
        selected: false,
      },
      {
        id: 'card-3',
        shape: 'diamond',
        color: 'red', // Same as card-1, making color invalid (not all same, not all different)
        number: 1,
        shading: 'solid',
        background: 'white',
        selected: false,
      },
      ...createFillerCards(),
    ];

    const playerStatsWithGrace: PlayerStats = {
      ...defaultPlayerStats,
      graces: 1,
    };

    const onMatch = jest.fn();

    const { getByTestId } = render(
      <GameBoard
        cards={cards}
        onMatch={onMatch}
        onInvalidSelection={jest.fn()}
        playerStats={playerStatsWithGrace}
        isPlayerTurn={true}
        activeAttributes={['shape', 'color', 'number']}
      />
    );

    // Select the near-miss cards
    fireEvent.press(getByTestId('card-card-1'));
    fireEvent.press(getByTestId('card-card-2'));
    fireEvent.press(getByTestId('card-card-3'));

    // Advance past the 200ms selection delay
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // onMatch should be called (grace saves the match)
    expect(onMatch).toHaveBeenCalledTimes(1);

    // First reward should have grace effectType
    const [, rewards] = onMatch.mock.calls[0];
    expect(rewards[0].effectType).toBe('grace');
  });
});
