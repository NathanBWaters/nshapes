/**
 * Persistent top bar shown across all non-combat Starfall Summit screens
 * (Map, Preview, Shop, Campfire, Event, Treasure, Rewards).
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { CoinPill, Heart, INK, TONE } from '@/adventure/components/ui';
import { spireArmedRecipes } from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS } from '../engine/runState';
import type { SpireRun } from '../types';
import { SpireLightweightBreath, SpireStatPop, SpireTactilePressable } from './SpireMotion';

interface Props {
  run: SpireRun;
  onOpenBuild: () => void;
  onExitToMenu?: () => void;
  musicOn?: boolean;
  sfxOn?: boolean;
  onToggleAudio?: () => void;
}

const SpireHeader: React.FC<Props> = ({
  run,
  onOpenBuild,
  onExitToMenu,
  musicOn = true,
  sfxOn = true,
  onToggleAudio,
}) => {
  const armedCount = spireArmedRecipes(run).length;
  const actTag = run.endless ? `ENDLESS A${run.act}` : `ACT ${run.act}`;
  const audioAllOff = !musicOn && !sfxOn;
  const audioSfxOnly = !musicOn && sfxOn;
  const audioMusicOnly = musicOn && !sfxOn;
  const audioLabel = audioAllOff
    ? 'Audio muted — tap to turn music and sound effects on'
    : audioSfxOnly
      ? 'Sound effects only, music muted — tap to mute all'
      : audioMusicOnly
        ? 'Music only, sound effects muted — tap to mute all'
        : 'Music and sound effects on — tap to mute music';

  const prevHeartsRef = useRef(run.hearts);
  const [portraitPulse, setPortraitPulse] = useState(0);
  useEffect(() => {
    if (run.hearts !== prevHeartsRef.current) {
      prevHeartsRef.current = run.hearts;
      setPortraitPulse(n => n + 1);
    }
  }, [run.hearts]);

  return (
    <View style={st.bar} testID="spire-header">
      <View style={st.left}>
        {onExitToMenu && (
          <SpireTactilePressable
            testID="spire-back-menu"
            small
            onPress={onExitToMenu}
            style={st.backBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityLabel="Save and return to menu"
            accessibilityRole="button"
          >
            <Icon name="ui/back-arrow" size={16} color={INK} noShadow />
          </SpireTactilePressable>
        )}
        <SpireLightweightBreath keySeed={`header-${run.fighter}`} size={28} pulseKey={portraitPulse}>
          <FighterAvatar character={run.fighter} size={28} health={run.hearts} maxHealth={run.maxHearts} animate={false} />
        </SpireLightweightBreath>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <View style={st.metaRow}>
            <SpireStatPop value={`${run.act}-${run.floor}`}>
              <Text style={st.actText} numberOfLines={1}>
                {actTag} · FL {run.floor}
              </Text>
            </SpireStatPop>
            {run.isDaily && (
              <View style={st.dailyPill} testID="spire-header-daily-badge">
                <Text style={st.dailyText}>DAILY</Text>
              </View>
            )}
            {run.ascension > 0 && (
              <View style={st.ascPill}>
                <Text style={st.ascText}>A{run.ascension}</Text>
              </View>
            )}
          </View>
          <View style={st.heartsRow}>
            <SpireStatPop value={run.hearts} style={st.heartsPopWrap} testID="spire-header-hearts">
              <Heart size={13} />
              <Text style={st.heartsText}>
                {run.hearts}/{run.maxHearts}
              </Text>
            </SpireStatPop>
            {armedCount > 0 && (
              <SpireStatPop value={armedCount} style={st.evoPopWrap}>
                <Text style={st.evoText}>·</Text>
                <Icon name="sbed/electric" size={11} color={TONE.evoReady} noShadow />
                <Text style={st.evoText} numberOfLines={1}>
                  {armedCount}
                </Text>
              </SpireStatPop>
            )}
          </View>
        </View>
      </View>

      <View style={st.right}>
        <SpireStatPop value={run.coins} testID="spire-header-coins">
          <CoinPill coins={run.coins} compact />
        </SpireStatPop>
        {onToggleAudio && (
          <SpireTactilePressable
            testID="spire-toggle-audio"
            small
            onPress={onToggleAudio}
            style={[
              st.audioBtn,
              audioSfxOnly && st.audioBtnSfxOnly,
              audioAllOff && st.audioBtnMuted,
            ]}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityLabel={audioLabel}
            accessibilityRole="button"
          >
            <Icon
              name={audioMusicOnly ? 'delapouite/harp' : 'delapouite/sound-on'}
              size={16}
              color={audioAllOff ? TONE.spent : audioSfxOnly ? TONE.upside : INK}
              noShadow
            />
            {audioAllOff && <View pointerEvents="none" style={st.muteSlash} />}
          </SpireTactilePressable>
        )}
        <SpireStatPop value={run.weapons.length}>
          <SpireTactilePressable
            testID="spire-open-build"
            small
            onPress={onOpenBuild}
            style={st.buildBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityLabel="Inspect Summit build"
            accessibilityRole="button"
          >
            <Icon name="lorc/gems" size={14} color={INK} />
            <Text style={st.buildText}>
              {`${run.weapons.length}/${MAX_SUMMIT_WEAPONS}`}
            </Text>
          </SpireTactilePressable>
        </SpireStatPop>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    backgroundColor: COLORS.deepOnyx,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  ascText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.actionYellow,
  },
  dailyPill: {
    backgroundColor: '#7C3AED',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  dailyText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: COLORS.canvasWhite,
    letterSpacing: 0.4,
  },
  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heartsPopWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  evoPopWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
    color: TONE.evoReady,
    fontVariant: ['tabular-nums'],
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  audioBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  audioBtnSfxOnly: {
    backgroundColor: '#CCFBF1',
    borderColor: TONE.upside,
  },
  audioBtnMuted: {
    backgroundColor: '#E5E0D8',
    borderColor: TONE.spent,
  },
  muteSlash: {
    position: 'absolute',
    width: 22,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: COLORS.impactRed,
    transform: [{ rotate: '-45deg' }],
  },
  buildBtn: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: INK,
    borderRadius: 999,
    paddingHorizontal: 8,
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
