import React, { useState, useCallback } from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { View, Text, Pressable } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useGameTimer } from '@/hooks/useGameTimer';

/**
 * These tests verify that the Adventure Mode timer works correctly
 * by testing the exact state flow and hook behavior that Game.tsx uses.
 */

describe('Adventure Mode Timer - State Flow Simulation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * This test simulates the exact state flow in Game.tsx's startAdventure function
   * to verify that the timer starts correctly after all state updates.
   */
  it('should start timer immediately when gamePhase becomes round and gameStarted becomes true', () => {
    // Simulate the state that Game.tsx uses for isTimerActive calculation
    const TestComponent = () => {
      const [gamePhase, setGamePhase] = useState<'main_menu' | 'round'>('main_menu');
      const [state, setState] = useState({
        gameStarted: false,
        gameEnded: false,
        remainingTime: 60,
      });
      const [isMenuOpen] = useState(false);

      // Exactly how Game.tsx calculates isTimerActive
      const isTimerActive = gamePhase === 'round' &&
        state.gameStarted &&
        !state.gameEnded &&
        state.remainingTime > 0 &&
        !isMenuOpen;

      // Exactly how Game.tsx uses the timer hook
      useGameTimer(isTimerActive, () => {
        setState(prev => ({
          ...prev,
          remainingTime: Math.max(0, prev.remainingTime - 1),
        }));
      });

      // Simulate startAdventure function (batched state updates)
      const startAdventure = useCallback(() => {
        // This mimics initGame setting gameStarted: false
        setState({
          gameStarted: false,
          gameEnded: false,
          remainingTime: 60,
        });

        // Then setting gameStarted: true (this is a separate setState call in Game.tsx)
        setState(prev => ({
          ...prev,
          gameStarted: true,
        }));

        // Finally setting gamePhase to 'round'
        setGamePhase('round');
      }, []);

      return (
        <View>
          <Text testID="time">{state.remainingTime}</Text>
          <Text testID="phase">{gamePhase}</Text>
          <Text testID="started">{state.gameStarted.toString()}</Text>
          <Pressable testID="start-btn" onPress={startAdventure}>
            <Text>Start</Text>
          </Pressable>
        </View>
      );
    };

    const { getByTestId } = render(<TestComponent />);

    // Initial state
    expect(getByTestId('time').props.children).toBe(60);
    expect(getByTestId('phase').props.children).toBe('main_menu');
    expect(getByTestId('started').props.children).toBe('false');

    // Start the game (simulates startAdventure)
    fireEvent.press(getByTestId('start-btn'));

    // After starting: gamePhase should be 'round' and gameStarted should be true
    expect(getByTestId('phase').props.children).toBe('round');
    expect(getByTestId('started').props.children).toBe('true');
    expect(getByTestId('time').props.children).toBe(60); // Still 60, interval hasn't fired yet

    // Advance time by 1 second - timer should tick
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(getByTestId('time').props.children).toBe(59);

    // Advance time by 2 more seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(getByTestId('time').props.children).toBe(57);
  });

  /**
   * This test verifies that the timer pauses when the menu is opened.
   */
  it('should pause timer when menu is opened (isMenuOpen becomes true)', () => {
    const TestComponent = () => {
      const [gamePhase] = useState<'main_menu' | 'round'>('round');
      const [state, setState] = useState({
        gameStarted: true,
        gameEnded: false,
        remainingTime: 60,
      });
      const [isMenuOpen, setIsMenuOpen] = useState(false);

      const isTimerActive = gamePhase === 'round' &&
        state.gameStarted &&
        !state.gameEnded &&
        state.remainingTime > 0 &&
        !isMenuOpen;

      useGameTimer(isTimerActive, () => {
        setState(prev => ({
          ...prev,
          remainingTime: Math.max(0, prev.remainingTime - 1),
        }));
      });

      return (
        <View>
          <Text testID="time">{state.remainingTime}</Text>
          <Pressable testID="menu-btn" onPress={() => setIsMenuOpen(prev => !prev)}>
            <Text>Menu</Text>
          </Pressable>
        </View>
      );
    };

    const { getByTestId } = render(<TestComponent />);

    // Timer should be running
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(getByTestId('time').props.children).toBe(58);

    // Open menu (pause timer)
    fireEvent.press(getByTestId('menu-btn'));

    // Timer should be paused - advance time but time shouldn't decrease
    const timeBeforePause = getByTestId('time').props.children;
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(getByTestId('time').props.children).toBe(timeBeforePause);

    // Close menu (resume timer)
    fireEvent.press(getByTestId('menu-btn'));

    // Timer should resume
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(getByTestId('time').props.children).toBe(timeBeforePause - 1);
  });

  /**
   * This test verifies the exact batched state update pattern used in startAdventure.
   * The key issue this catches: initGame does a DIRECT state replacement (setState(newObject)),
   * followed by a functional update (setState(prev => ({...prev, gameStarted: true}))).
   */
  it('should handle batched state updates correctly (direct + functional setState)', () => {
    const TestComponent = () => {
      const [state, setState] = useState({
        gameStarted: false,
        remainingTime: 0,
        player: { stats: { startingTime: 5 } },
      });
      const [gamePhase, setGamePhase] = useState<'main_menu' | 'round'>('main_menu');

      const isTimerActive = gamePhase === 'round' &&
        state.gameStarted &&
        state.remainingTime > 0;

      useGameTimer(isTimerActive, () => {
        setState(prev => ({
          ...prev,
          remainingTime: Math.max(0, prev.remainingTime - 1),
        }));
      });

      // This mimics the EXACT pattern in startAdventure:
      // 1. initGame does: setState({ ...new complete state with gameStarted: false... })
      // 2. startAdventure does: setState(prev => ({ ...prev, gameStarted: true }))
      // 3. startAdventure does: setState(prev => ({ ...prev, remainingTime: prev.remainingTime + bonus }))
      // 4. startAdventure does: setGamePhase('round')
      const simulateStartAdventure = () => {
        // Step 1: initGame - DIRECT state replacement (gameStarted: false)
        setState({
          gameStarted: false,
          remainingTime: 60,
          player: { stats: { startingTime: 5 } },
        });

        // Step 2: Functional update to set gameStarted: true
        setState(prev => ({
          ...prev,
          gameStarted: true,
        }));

        // Step 3: Functional update to add time bonus
        setState(prev => ({
          ...prev,
          remainingTime: prev.remainingTime + prev.player.stats.startingTime,
        }));

        // Step 4: Set game phase
        setGamePhase('round');
      };

      return (
        <View>
          <Text testID="time">{state.remainingTime}</Text>
          <Text testID="started">{state.gameStarted.toString()}</Text>
          <Text testID="phase">{gamePhase}</Text>
          <Pressable testID="start-btn" onPress={simulateStartAdventure}>
            <Text>Start</Text>
          </Pressable>
        </View>
      );
    };

    const { getByTestId } = render(<TestComponent />);

    // Start adventure
    fireEvent.press(getByTestId('start-btn'));

    // Verify state is correct after batched updates
    expect(getByTestId('phase').props.children).toBe('round');
    expect(getByTestId('started').props.children).toBe('true');
    expect(getByTestId('time').props.children).toBe(65); // 60 + 5 bonus

    // Verify timer starts
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(getByTestId('time').props.children).toBe(64);
  });
});

describe('Adventure Mode Timer - Edge Cases', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should stop timer when remainingTime reaches 0', () => {
    const onTick = jest.fn();

    const { rerender } = renderHook(
      ({ isActive }) => useGameTimer(isActive, onTick),
      { initialProps: { isActive: true } }
    );

    // Timer ticks
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onTick).toHaveBeenCalledTimes(2);

    // Simulate time running out (isActive becomes false because remainingTime <= 0)
    rerender({ isActive: false });

    // Timer should stop
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onTick).toHaveBeenCalledTimes(2); // Still 2, not 5
  });

  it('should handle rapid pause/resume without losing ticks', () => {
    const onTick = jest.fn();

    const { rerender } = renderHook(
      ({ isActive }) => useGameTimer(isActive, onTick),
      { initialProps: { isActive: true } }
    );

    // Timer ticks once
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);

    // Rapid pause/resume
    rerender({ isActive: false });
    rerender({ isActive: true });

    // Timer should resume
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(2);
  });
});
