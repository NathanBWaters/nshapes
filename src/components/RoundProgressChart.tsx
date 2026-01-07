import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '@/utils/colors';

export interface RoundScore {
  round: number;
  target: number;
  actual?: number; // undefined for future rounds
}

interface RoundProgressChartProps {
  /** Array of round data - should have 10 entries */
  roundScores: RoundScore[];
  /** Current round (1-10) - animates this round's blue bar on mount */
  currentRound?: number;
  /** Chart height in pixels */
  height?: number;
  /** Animation duration in ms (default 600) */
  animationDuration?: number;
}

// Animated bar component for the current round
const AnimatedBlueBar: React.FC<{
  blueHeight: number;
  animationDuration: number;
  shouldAnimate: boolean;
}> = ({ blueHeight, animationDuration, shouldAnimate }) => {
  const animatedHeight = useRef(new Animated.Value(shouldAnimate ? 0 : blueHeight)).current;

  useEffect(() => {
    if (shouldAnimate && blueHeight > 0) {
      // Small delay to ensure component is visible before animating
      const timer = setTimeout(() => {
        Animated.timing(animatedHeight, {
          toValue: blueHeight,
          duration: animationDuration,
          useNativeDriver: false, // height animation requires non-native
        }).start();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldAnimate, blueHeight, animationDuration]);

  if (blueHeight <= 0) return null;

  return (
    <Animated.View
      style={[
        styles.blueBar,
        { height: animatedHeight }
      ]}
    />
  );
};

const RoundProgressChart: React.FC<RoundProgressChartProps> = ({
  roundScores,
  currentRound,
  height = 160,
  animationDuration = 600,
}) => {
  // Max value is the highest of any target OR actual score
  const allValues = roundScores.flatMap(r => [r.target, r.actual ?? 0]);
  const maxValue = Math.max(...allValues);

  // Calculate middle y-axis value (round to nice number)
  const midValue = Math.round(maxValue / 2 / 10) * 10;

  // Bar dimensions
  const barWidth = 24;
  const barGap = 6;
  const chartHeight = height - 40; // Leave room for labels

  // Minimum bar height so small values are still visible
  const MIN_BAR_HEIGHT = 8;

  // Calculate bar heights as percentage of max, with minimum
  const getBarHeight = (value: number): number => {
    if (value <= 0) return 0;
    const height = (value / maxValue) * chartHeight;
    return Math.max(height, MIN_BAR_HEIGHT);
  };

  return (
    <View style={styles.container}>
      {/* Y-axis labels */}
      <View style={[styles.yAxis, { height: chartHeight }]}>
        <Text style={styles.yAxisLabel}>{maxValue}</Text>
        <Text style={styles.yAxisLabel}>{midValue}</Text>
        <Text style={styles.yAxisLabel}>0</Text>
      </View>

      {/* Chart area */}
      <View style={styles.chartArea}>
        {/* Bars container */}
        <View style={[styles.barsContainer, { height: chartHeight }]}>
          {roundScores.map((round) => {
            const targetHeight = getBarHeight(round.target);
            const actualHeight = round.actual !== undefined
              ? getBarHeight(round.actual)
              : 0;

            // Calculate excess (blue portion above yellow)
            const excessHeight = Math.max(0, actualHeight - targetHeight);
            // The blue minimum when actual >= target
            const minBlueHeight = round.actual !== undefined && round.actual >= round.target ? 3 : 0;
            const blueHeight = Math.max(excessHeight, minBlueHeight);

            const isCurrentRound = currentRound === round.round;
            const isCompleted = round.actual !== undefined;

            return (
              <View
                key={round.round}
                style={[
                  styles.barColumn,
                  { width: barWidth, marginHorizontal: barGap / 2 }
                ]}
              >
                {/* Stacked bar */}
                <View style={styles.barStack}>
                  {/* Blue excess (on top) - animated only for current round */}
                  {isCurrentRound ? (
                    <AnimatedBlueBar
                      blueHeight={blueHeight}
                      animationDuration={animationDuration}
                      shouldAnimate={true}
                    />
                  ) : (
                    blueHeight > 0 && (
                      <View
                        style={[
                          styles.blueBar,
                          { height: blueHeight }
                        ]}
                      />
                    )
                  )}

                  {/* Yellow target */}
                  <View
                    style={[
                      styles.yellowBar,
                      { height: targetHeight },
                      isCurrentRound && styles.currentRoundBar,
                      !isCompleted && styles.futureRoundBar,
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* X-axis labels */}
        <View style={styles.xAxis}>
          {roundScores.map((round) => (
            <View
              key={round.round}
              style={[
                styles.xLabelContainer,
                { width: barWidth, marginHorizontal: barGap / 2 }
              ]}
            >
              <Text
                style={[
                  styles.xAxisLabel,
                  currentRound === round.round && styles.xAxisLabelCurrent,
                ]}
              >
                {round.round}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  yAxis: {
    width: 28,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  yAxisLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: COLORS.slateCharcoal,
    opacity: 0.6,
  },
  chartArea: {
    flex: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.slateCharcoal,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  barStack: {
    width: '100%',
    alignItems: 'center',
  },
  yellowBar: {
    width: '100%',
    backgroundColor: COLORS.actionYellow,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  blueBar: {
    width: '100%',
    backgroundColor: COLORS.logicTeal,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  currentRoundBar: {
    // Highlight current round with a subtle shadow effect instead of border
  },
  futureRoundBar: {
    opacity: 0.4,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 4,
    marginLeft: 1, // Align with border
  },
  xLabelContainer: {
    alignItems: 'center',
  },
  xAxisLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: COLORS.slateCharcoal,
  },
  xAxisLabelCurrent: {
    fontWeight: '700',
    color: COLORS.deepOnyx,
  },
});

export default RoundProgressChart;
