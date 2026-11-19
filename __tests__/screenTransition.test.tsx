/**
 * The shared screen change (src/components/ScreenTransition.tsx): in jest it
 * swaps at once; played for real, the old screen is replaced only after its
 * exit, the latest of two quick changes wins, and taps are refused meanwhile.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import Animated from 'react-native-reanimated';
import { SCREEN_INSTANT, useScreenTransition, type ScreenTransitionControl } from '@/components/ScreenTransition';
import { MS, exitMs } from '@/utils/motion';

let control: ScreenTransitionControl;
const Host: React.FC<{ instant: boolean; screen: string }> = ({ instant, screen }) => {
  control = useScreenTransition({ instant });
  return (
    <Animated.View style={control.style} pointerEvents={control.leaving ? 'none' : 'auto'} testID="layer">
      <Text>{screen}</Text>
    </Animated.View>
  );
};

/** A screen that holds its own state, changed through the transition */
const App: React.FC<{ instant: boolean }> = ({ instant }) => {
  const [screen, setScreen] = React.useState('map');
  (globalThis as { __go?: (s: string) => void }).__go = (s: string) => control.go(() => setScreen(s), 1);
  return (
    <View>
      <Host instant={instant} screen={screen} />
    </View>
  );
};
const go = (s: string) => (globalThis as unknown as { __go: (s: string) => void }).__go(s);

describe('ScreenTransition', () => {
  afterEach(() => jest.useRealTimers());

  it('is instant under jest, so screen tests can look for the next screen at once', () => {
    expect(SCREEN_INSTANT).toBe(true);
    const view = render(<App instant />);
    act(() => go('camp'));
    expect(view.getByText('camp')).toBeTruthy();
  });

  it('played for real: the old screen stays (taking no taps) until its exit is over, and the latest change wins', () => {
    jest.useFakeTimers();
    const view = render(<App instant={false} />);
    act(() => go('camp'));
    // Leaving: still the map, and it takes no taps
    expect(view.getByText('map')).toBeTruthy();
    expect(view.getByTestId('layer').props.pointerEvents).toBe('none');
    // A second wish while the first exit runs: it is the one that arrives
    act(() => go('fight'));
    act(() => { jest.advanceTimersByTime(exitMs(MS.screen) + MS.feedback + 16); });
    expect(view.queryByText('map')).toBeNull();
    expect(view.queryByText('camp')).toBeNull();
    expect(view.getByText('fight')).toBeTruthy();
    expect(view.getByTestId('layer').props.pointerEvents).toBe('auto');
  });
});
