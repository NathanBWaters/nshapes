import { renderHook, act } from '@testing-library/react-native';
import { useGameTimer } from '@/hooks/useGameTimer';

describe('useGameTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call onTick every second when isActive is true', () => {
    const onTick = jest.fn();

    renderHook(() => useGameTimer(true, onTick));

    // Should not be called immediately
    expect(onTick).not.toHaveBeenCalled();

    // Should be called after 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);

    // Should be called again after another second
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('should not call onTick when isActive is false', () => {
    const onTick = jest.fn();

    renderHook(() => useGameTimer(false, onTick));

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(onTick).not.toHaveBeenCalled();
  });

  it('should start ticking when isActive changes from false to true', () => {
    const onTick = jest.fn();

    const { rerender } = renderHook(
      ({ isActive }) => useGameTimer(isActive, onTick),
      { initialProps: { isActive: false } }
    );

    // Should not tick when inactive
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onTick).not.toHaveBeenCalled();

    // Activate the timer
    rerender({ isActive: true });

    // Should start ticking after activation
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('should stop ticking when isActive changes from true to false', () => {
    const onTick = jest.fn();

    const { rerender } = renderHook(
      ({ isActive }) => useGameTimer(isActive, onTick),
      { initialProps: { isActive: true } }
    );

    // Should tick when active
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);

    // Deactivate the timer
    rerender({ isActive: false });

    // Should stop ticking
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onTick).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('should resume ticking when reactivated (pause/resume)', () => {
    const onTick = jest.fn();

    const { rerender } = renderHook(
      ({ isActive }) => useGameTimer(isActive, onTick),
      { initialProps: { isActive: true } }
    );

    // Tick once
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);

    // Pause
    rerender({ isActive: false });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onTick).toHaveBeenCalledTimes(1); // Still 1

    // Resume
    rerender({ isActive: true });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(2); // Now 2
  });

  it('should use the latest onTick callback even when callback changes', () => {
    let counter = 0;
    const onTick1 = jest.fn(() => { counter = 1; });
    const onTick2 = jest.fn(() => { counter = 2; });

    const { rerender } = renderHook(
      ({ onTick }) => useGameTimer(true, onTick),
      { initialProps: { onTick: onTick1 } }
    );

    // Update callback without changing isActive
    rerender({ onTick: onTick2 });

    // The new callback should be used
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onTick2).toHaveBeenCalled();
    expect(counter).toBe(2);
  });

  it('should not restart interval when only callback changes', () => {
    const onTick1 = jest.fn();
    const onTick2 = jest.fn();

    const { rerender } = renderHook(
      ({ onTick }) => useGameTimer(true, onTick),
      { initialProps: { onTick: onTick1 } }
    );

    // Advance 500ms (halfway to first tick)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Change callback
    rerender({ onTick: onTick2 });

    // Advance another 500ms (completing first tick)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // The tick should have happened at the original interval
    expect(onTick1).not.toHaveBeenCalled();
    expect(onTick2).toHaveBeenCalledTimes(1);
  });

  it('should clean up interval on unmount', () => {
    const onTick = jest.fn();

    const { unmount } = renderHook(() => useGameTimer(true, onTick));

    // Tick once to confirm it's working
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);

    // Unmount
    unmount();

    // Should not tick after unmount
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onTick).toHaveBeenCalledTimes(1); // Still 1
  });

  it('should restart interval when key changes (simulates new game start)', () => {
    const onTick = jest.fn();

    // Start with key=1
    const { rerender } = renderHook(
      ({ isActive, key }) => useGameTimer(isActive, onTick, key),
      { initialProps: { isActive: true, key: 1 } }
    );

    // Tick once
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);

    // Advance 500ms (halfway to next tick)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Change key (simulates starting a new game with new startTime)
    // This should restart the interval from 0
    rerender({ isActive: true, key: 2 });

    // If interval restarted, we need to wait full 1000ms for next tick
    // If it didn't restart, tick would happen in 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });
    // Should still be 1 tick because interval restarted
    expect(onTick).toHaveBeenCalledTimes(1);

    // After full 1000ms from key change, should tick
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('should restart timer when isActive stays true but key changes (the bug fix case)', () => {
    const onTick = jest.fn();

    // Start game 1: isActive = true, key = 1000 (startTime)
    const { rerender } = renderHook(
      ({ isActive, key }) => useGameTimer(isActive, onTick, key),
      { initialProps: { isActive: true, key: 1000 } }
    );

    // Let timer tick a few times
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onTick).toHaveBeenCalledTimes(3);

    // "Exit game" - isActive becomes false
    rerender({ isActive: false, key: 1000 });

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onTick).toHaveBeenCalledTimes(3); // No new ticks

    // "Start new game" - isActive true, NEW key (new startTime)
    rerender({ isActive: true, key: 2000 });

    // Timer should restart and work correctly
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(4);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(5);
  });
});
