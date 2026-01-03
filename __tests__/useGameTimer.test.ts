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
});
