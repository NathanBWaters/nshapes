import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ROUND_REQUIREMENTS } from '@/utils/gameDefinitions';
import { COLORS, RADIUS } from '@/utils/colors';

interface RoundScoreboardProps {
  currentRound: number;
  currentScore: number;
}

const RoundScoreboard: React.FC<RoundScoreboardProps> = ({
  currentRound,
  currentScore
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get current round requirement
  const currentRequirement = ROUND_REQUIREMENTS.find(r => r.round === currentRound) ||
    { round: currentRound, targetScore: 3, time: 60 };

  // Calculate progress percentage
  const progressPercentage = Math.min((currentScore / currentRequirement.targetScore) * 100, 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ROUND PROGRESS</Text>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text style={styles.expandButtonText}>
            {isExpanded ? 'HIDE' : 'DETAILS'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPercentage}%` },
              progressPercentage >= 100 && styles.progressBarComplete,
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentScore}/{currentRequirement.targetScore}
        </Text>
      </View>

      {isExpanded && (
        <ScrollView horizontal style={styles.tableContainer}>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.columnRound]}>ROUND</Text>
              <Text style={[styles.tableHeaderCell, styles.columnTarget]}>TARGET</Text>
              <Text style={[styles.tableHeaderCell, styles.columnTime]}>TIME</Text>
            </View>

            {/* Rows */}
            {ROUND_REQUIREMENTS.map(req => (
              <View
                key={req.round}
                style={[
                  styles.tableRow,
                  req.round === currentRound && styles.tableRowCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.tableCell,
                    styles.columnRound,
                    req.round === currentRound && styles.tableCellCurrent,
                    req.round < currentRound && styles.tableCellPast,
                  ]}
                >
                  {req.round}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.columnTarget,
                    req.round === currentRound && styles.tableCellCurrent,
                    req.round < currentRound && styles.tableCellPast,
                  ]}
                >
                  {req.targetScore} pts
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.columnTime,
                    req.round === currentRound && styles.tableCellCurrent,
                    req.round < currentRound && styles.tableCellPast,
                  ]}
                >
                  {req.time}s
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  headerTitle: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
  expandButton: {
    backgroundColor: COLORS.deepOnyx,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.button,
  },
  expandButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  progressBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
    borderRadius: RADIUS.button,
  },
  progressBarComplete: {
    backgroundColor: COLORS.actionYellow,
  },
  progressText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'monospace',
    minWidth: 50,
    textAlign: 'right',
  },
  tableContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  table: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.slateCharcoal,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  tableRowCurrent: {
    backgroundColor: COLORS.actionYellow,
  },
  tableCell: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  tableCellCurrent: {
    fontWeight: '700',
    color: COLORS.deepOnyx,
  },
  tableCellPast: {
    opacity: 0.5,
  },
  columnRound: {
    width: 60,
  },
  columnTarget: {
    width: 80,
  },
  columnTime: {
    width: 50,
  },
});

export default RoundScoreboard;
