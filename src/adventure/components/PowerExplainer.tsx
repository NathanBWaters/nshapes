/**
 * Explains Power in plain English wherever the Power chip appears
 * (in-fight top bar, Results screen, Battle History, and Fight Replay).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import type { Weapon } from '@/types';
import { COLORS } from '@/utils/colors';
import { EVOLUTION_RULES } from '../engine/sources';
import { NO_POWER, POWER_KNEE, formatPower, powerMultiplier, powerWatchPhrase } from '../data/weaponPower';
import { INK, TONE } from './ui';

export interface PowerExplainerProps {
  /** Raw Power points earned (when recorded) */
  points?: number;
  /** Multiplier snapshot when raw points aren't recorded (e.g. legacy BattleRecord or Set math row) */
  multiplier?: number;
  /** Weapons in the loadout to list what feeds Power */
  weapons?: Weapon[];
  /** Number of Evolution bursts that added a jump of Power */
  evolutionsTriggered?: number;
  /** Optional subtitle ("At this Set", "Peak this fight", etc.) */
  subtitle?: string;
  /** Compact padding for inline drawers inside a Set inspector row */
  compact?: boolean;
  testID?: string;
}

const fmtMult = (m: number): string =>
  `×${m >= 100 ? Math.round(m) : m >= 10 ? m.toFixed(1).replace(/\.0$/, '') : m.toFixed(1)}`;

const PowerExplainer: React.FC<PowerExplainerProps> = ({
  points,
  multiplier,
  weapons = [],
  evolutionsTriggered = 0,
  subtitle,
  compact = false,
  testID = 'power-explainer',
}) => {
  const multValue = points !== undefined ? powerMultiplier(points) : (multiplier ?? 1);
  const multLabel = points !== undefined ? formatPower(points) : fmtMult(multValue);
  const hot = multValue >= 5;
  const feeders = weapons
    .map(w => ({ weapon: w, phrase: powerWatchPhrase(w.id) }))
    .filter((x): x is { weapon: Weapon; phrase: string } => x.phrase !== null);
  const nonFeeders = weapons.filter(w => NO_POWER.has(w.id));

  return (
    <View style={[st.box, compact && st.boxCompact]} testID={testID}>
      <View style={st.header}>
        <View style={st.titleRow}>
          <Icon name="lorc/power-lightning" size={16} color={hot ? COLORS.impactRed : INK} />
          <Text style={st.title}>WHAT IS POWER?</Text>
        </View>
        <View style={[st.pill, { backgroundColor: hot ? COLORS.actionYellow : TONE.coinPale }]}>
          <Text style={st.pillText}>{multLabel}</Text>
        </View>
      </View>

      {subtitle && <Text style={st.subtitle}>{subtitle}</Text>}

      <Text style={st.body}>
        Power is your fight-wide damage multiplier. Every fight starts at ×1.0. Whenever your gear does its thing, Power climbs—and multiplies every point of damage you deal for the rest of the fight (Set hits, bonuses, and explosions).
      </Text>
      <Text style={st.note}>
        Early on, every +1 Power adds +1.0× to your damage (up to ×{1 + POWER_KNEE}), then climbs gently so huge builds stay fun and balanced. Unlike capped weapon effects, Power never stops climbing.
      </Text>

      {(feeders.length > 0 || nonFeeders.length > 0 || evolutionsTriggered > 0) && (
        <View style={st.feedList}>
          <Text style={st.feedHeader}>WHAT RAISED YOUR POWER</Text>
          {feeders.map(({ weapon, phrase }) => (
            <View key={weapon.id} style={st.feedRow}>
              <WeaponAvatar weapon={weapon} size={18} />
              <Text style={st.feedText}>
                <Text style={st.bold}>{weapon.name}</Text> (Lv.{weapon.level}) · feeds Power on {phrase}
              </Text>
            </View>
          ))}
          {nonFeeders.map(w => (
            <View key={w.id} style={st.feedRow}>
              <WeaponAvatar weapon={w} size={18} />
              <Text style={st.feedText}>
                <Text style={st.bold}>{w.name}</Text> · copies the weapon on its left, does not feed Power itself
              </Text>
            </View>
          ))}
          {evolutionsTriggered > 0 && (
            <View style={st.feedRow}>
              <Icon name="lorc/crystal-shine" size={16} color={TONE.evoReady} />
              <Text style={st.feedText}>
                <Text style={st.bold}>Evolution surge</Text> ×{evolutionsTriggered} · +{evolutionsTriggered * EVOLUTION_RULES.power} Power from fused weapons
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const st = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFDF7',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: INK,
    padding: 12,
    gap: 8,
  },
  boxCompact: {
    padding: 10,
    gap: 6,
    backgroundColor: COLORS.canvasWhite,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: INK },
  pill: { borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 13, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  subtitle: { fontSize: 11, fontWeight: '800', color: TONE.upside },
  body: { fontSize: 12, lineHeight: 17, color: INK },
  note: { fontSize: 11, lineHeight: 15, color: INK, opacity: 0.78 },
  feedList: {
    borderTopWidth: 1,
    borderTopColor: '#E6DFD3',
    paddingTop: 8,
    gap: 6,
  },
  feedHeader: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: INK, opacity: 0.65 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedText: { flex: 1, fontSize: 11.5, lineHeight: 15, color: INK },
  bold: { fontWeight: '900' },
});

export default PowerExplainer;
