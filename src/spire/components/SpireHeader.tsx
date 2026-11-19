/**
 * Persistent top bar shown across all non-combat Starfall Spire screens
 * (Map, Preview, Shop, Campfire, Event, Treasure, Rewards).
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { CoinPill, Heart, INK, TONE } from '@/adventure/components/ui';
import { spireArmedRecipes } from '../engine/bridge';
import type { SpireRun } from '../types';

interface Props {
  run: SpireRun;
  onOpenBuild: () => void;
  onExitToMenu?: () => void;
}

const SpireHeader: React.FC<Props> = ({ run, onOpenBuild, onExitToMenu }) => {
  const armedCount = spireArmedRecipes(run).length;
  const actTag = run.endless ? `ENDLESS A${run.act}` : `ACT ${run.act}`;

  return (
    <View style={st.bar} testID="spire-header">
      <View style={st.left}>
        {onExitToMenu && (
          <TouchableOpacity
            testID="spire-back-menu"
            onPress={onExitToMenu}
            style={st.backBtn}
            accessibilityLabel="Save and return to menu"
            accessibilityRole="button"
          >
            <Icon name="lorc/return-arrow" size={16} color={INK} />
          </TouchableOpacity>
        )}
        <FighterAvatar character={run.fighter} size={30} health={run.hearts} maxHealth={run.maxHearts} animate={false} />
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <View style={st.metaRow}>
            <Text style={st.actText} numberOfLines={1}>
              {actTag} · FL {run.floor}
            </Text>
            {run.ascension > 0 && (
              <View style={st.ascPill}>
                <Text style={st.ascText}>A{run.ascension}</Text>
              </View>
            )}
          </View>
          <View style={st.heartsRow}>
            <Heart size={13} />
            <Text style={st.heartsText}>
              {run.hearts}/{run.maxHearts}
            </Text>
            {armedCount > 0 && (
              <Text style={st.evoText} numberOfLines={1}>
                · ⚡{armedCount}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={st.right}>
        <CoinPill coins={run.coins} />
        <TouchableOpacity
          testID="spire-open-build"
          onPress={onOpenBuild}
          style={st.buildBtn}
          accessibilityLabel="Inspect Spire build"
          accessibilityRole="button"
        >
          <Icon name="lorc/gems" size={14} color={INK} />
          <Text style={st.buildText}>{run.weapons.length}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    color: INK,
    letterSpacing: 0.4,
  },
  ascPill: {
    backgroundColor: TONE.arcana,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  ascText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.canvasWhite,
  },
  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heartsText: {
    fontSize: 12,
    fontWeight: '900',
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  evoText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    color: TONE.arcana,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: INK,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  buildText: {
    fontSize: 12,
    fontWeight: '900',
    color: INK,
    fontVariant: ['tabular-nums'],
  },
});

export default SpireHeader;
