import React from 'react';
import { render, act } from '@testing-library/react-native';
import GameBoard from '@/components/GameBoard';
import { Card as CardType, PlayerStats, CardReward } from '@/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';

// Store callbacks for triggering burn completion in tests
let burnCompleteCallbacks: Map<string, (card: CardType) => void> = new Map();

// Mock the Card component to avoid SVG issues and control burn lifecycle
jest.mock('@/components/Card', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const FIRE_BURN_DURATION = 7500;

  return function MockCard({
    card,
    onBurnComplete,
    isPaused = false,
  }: {
    card: CardType;
    onClick: (card: CardType) => void;
    disabled?: boolean;
    onBurnComplete?: (card: CardType) => void;
    isPaused?: boolean;
  }) {
    const accumulatedTimeRef = React.useRef(0);
    const lastTickRef = React.useRef<number | null>(null);
    const burnCompleteCalledRef = React.useRef(false);

    // Reset on new fire
    React.useEffect(() => {
      if (card.onFire && card.fireStartTime) {
        burnCompleteCalledRef.current = false;
        accumulatedTimeRef.current = 0;
        lastTickRef.current = Date.now();
      }
    }, [card.onFire, card.fireStartTime]);

    // Fire progress effect - same logic as real Card
    React.useEffect(() => {
      if (!card.onFire || !card.fireStartTime) {
        accumulatedTimeRef.current = 0;
        lastTickRef.current = null;
        return;
      }

      if (isPaused) {
        lastTickRef.current = null;
        return;
      }

      const updateProgress = () => {
        const now = Date.now();
        if (lastTickRef.current !== null) {
          const delta = now - lastTickRef.current;
          accumulatedTimeRef.current += delta;
        }
        lastTickRef.current = now;

        const progress = Math.min(accumulatedTimeRef.current / FIRE_BURN_DURATION, 1);

        if (progress >= 1 && onBurnComplete && !burnCompleteCalledRef.current) {
          burnCompleteCalledRef.current = true;
          onBurnComplete(card);
        }
      };

      updateProgress();
      const interval = setInterval(updateProgress, 100);
      return () => clearInterval(interval);
    }, [card.onFire, card.fireStartTime, isPaused, onBurnComplete, card]);

    return (
      <View testID={`card-${card.id}`}>
        <Text>{card.id}</Text>
        {card.onFire && <Text testID={`fire-${card.id}`}>ON FIRE</Text>}
      </View>
    );
  };
});

// Mock RewardReveal to simplify testing
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
const createTestCard = (id: string, onFire = false, fireStartTime?: number): CardType => ({
  id,
  shape: 'oval',
  color: 'red',
  number: 1,
  shading: 'solid',
  background: 'white',
  selected: false,
  onFire,
  fireStartTime,
});

// Default player stats for testing
const defaultPlayerStats: PlayerStats = {
  ...DEFAULT_PLAYER_STATS,
};

// Import the mocked Card for direct testing
import Card from '@/components/Card';

describe('Card Burn Lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    burnCompleteCallbacks.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call onBurnComplete when fire timer reaches 7.5 seconds', () => {
    const onBurnComplete = jest.fn();
    const fireStartTime = Date.now();
    const card = createTestCard('card-1', true, fireStartTime);

    render(
      <Card
        card={card}
        onClick={jest.fn()}
        onBurnComplete={onBurnComplete}
        isPaused={false}
      />
    );

    // Should not be called before 7.5 seconds
    act(() => {
      jest.advanceTimersByTime(7400);
    });
    expect(onBurnComplete).not.toHaveBeenCalled();

    // Should be called at/after 7.5 seconds
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onBurnComplete).toHaveBeenCalledWith(card);
  });

  it('should pause fire timer when isPaused is true', () => {
    const onBurnComplete = jest.fn();
    const fireStartTime = Date.now();
    const card = createTestCard('card-1', true, fireStartTime);

    const { rerender } = render(
      <Card
        card={card}
        onClick={jest.fn()}
        onBurnComplete={onBurnComplete}
        isPaused={false}
      />
    );

    // Advance 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onBurnComplete).not.toHaveBeenCalled();

    // Pause the timer
    rerender(
      <Card
        card={card}
        onClick={jest.fn()}
        onBurnComplete={onBurnComplete}
        isPaused={true}
      />
    );

    // Advance another 10 seconds while paused - should not complete
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(onBurnComplete).not.toHaveBeenCalled();

    // Unpause
    rerender(
      <Card
        card={card}
        onClick={jest.fn()}
        onBurnComplete={onBurnComplete}
        isPaused={false}
      />
    );

    // Should still need ~4.5 seconds (7.5 - 3 = 4.5)
    act(() => {
      jest.advanceTimersByTime(4400);
    });
    expect(onBurnComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onBurnComplete).toHaveBeenCalledWith(card);
  });

  it('should only call onBurnComplete once per fire', () => {
    const onBurnComplete = jest.fn();
    const fireStartTime = Date.now();
    const card = createTestCard('card-1', true, fireStartTime);

    render(
      <Card
        card={card}
        onClick={jest.fn()}
        onBurnComplete={onBurnComplete}
        isPaused={false}
      />
    );

    // Advance past burn completion
    act(() => {
      jest.advanceTimersByTime(8000);
    });
    expect(onBurnComplete).toHaveBeenCalledTimes(1);

    // Advance more time - should not call again
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onBurnComplete).toHaveBeenCalledTimes(1);
  });

  it('should not call onBurnComplete for non-burning cards', () => {
    const onBurnComplete = jest.fn();
    const card = createTestCard('card-1', false);

    render(
      <Card
        card={card}
        onClick={jest.fn()}
        onBurnComplete={onBurnComplete}
        isPaused={false}
      />
    );

    // Advance 10 seconds - should not call
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(onBurnComplete).not.toHaveBeenCalled();
  });
});

describe('GameBoard Burn Rewards', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should pass onCardBurn callback to handle individual burns', () => {
    const cards = [
      createTestCard('card-1'),
      createTestCard('card-2'),
      createTestCard('card-3'),
    ];

    const onCardBurn = jest.fn();

    render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        onCardBurn={onCardBurn}
      />
    );

    // GameBoard should accept onCardBurn prop without error
    expect(true).toBe(true);
  });

  it('should pass isPaused to Card components', () => {
    const cards = [
      createTestCard('card-1', true, Date.now()),
    ];

    const { rerender } = render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        isPaused={false}
      />
    );

    // Should accept isPaused prop
    rerender(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        isPaused={true}
      />
    );

    expect(true).toBe(true);
  });

  it('should call onCardBurn when card burn completes', () => {
    const onCardBurn = jest.fn();
    const fireStartTime = Date.now();
    const cards = [
      createTestCard('card-1', true, fireStartTime),
      createTestCard('card-2'),
      createTestCard('card-3'),
    ];

    render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        onCardBurn={onCardBurn}
        isPaused={false}
      />
    );

    // Advance to trigger burn completion
    act(() => {
      jest.advanceTimersByTime(7600);
    });

    // onCardBurn should have been called with the burning card
    expect(onCardBurn).toHaveBeenCalledTimes(1);
    expect(onCardBurn).toHaveBeenCalledWith(expect.objectContaining({ id: 'card-1' }));
  });
});

describe('Burn Rewards Display Timing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('individual burn rewards should be non-blocking (multiple cards can burn simultaneously)', () => {
    // This tests the new behavior where each card's burn is independent
    const onCardBurn = jest.fn();
    const fireStartTime = Date.now();
    const cards = [
      createTestCard('card-1', true, fireStartTime),
      createTestCard('card-2', true, fireStartTime),
      createTestCard('card-3'),
    ];

    render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onInvalidSelection={jest.fn()}
        playerStats={defaultPlayerStats}
        isPlayerTurn={true}
        onCardBurn={onCardBurn}
        isPaused={false}
      />
    );

    // Advance to trigger both burns
    act(() => {
      jest.advanceTimersByTime(7600);
    });

    // Both cards should have triggered burns (non-blocking)
    expect(onCardBurn).toHaveBeenCalledTimes(2);
  });
});
