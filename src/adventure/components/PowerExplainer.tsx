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
import { UNDERSTUDY_ID } from '../data/adventureWeapons';
import {
  POWER_KNEE,
  SKILL_FEAT_POWER,
  formatPower,
  formatPowerGain,
  powerGainAtLevel,
  powerMultiplier,
  powerWatchPhrase,
} from '../data/weaponPower';
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
    .map((w, idx) => {
      if (w.id === UNDERSTUDY_ID) {
        const left = idx > 0 ? weapons[idx - 1] : undefined;
        if (!left || left.id === UNDERSTUDY_ID) {
          return { weapon: w, phrase: 'place beside a charm to copy its Power trigger', gain: null as string | null };
        }
        const effectiveLv = Math.max(w.level ?? 1, left.level ?? 1);
        return {
          weapon: w,
          phrase: `${powerWatchPhrase(left.id) ?? left.name} (copied from ${left.name})`,
          gain: formatPowerGain(powerGainAtLevel(left.id, effectiveLv)),
        };
      }
      const phrase = powerWatchPhrase(w.id);
      if (!phrase) return null;
      return {
        weapon: w,
        phrase,
        gain: formatPowerGain(powerGainAtLevel(w.id, w.level ?? 1)),
      };
    })
    .filter((x): x is { weapon: Weapon; phrase: string; gain: string | null } => x !== null);

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
        Power is your fight-wide damage multiplier. Every fight starts at ×1.0. Charm triggers, skill feats, and Evolutions raise Power—multiplying all damage you deal in the simple BASE × MULT equation.
      </Text>
      <Text style={st.note}>
        First {POWER_KNEE} Power adds +1.0× per point (up to ×{1 + POWER_KNEE}), then climbs smoothly as 2 + 2√(P − 2) forever. No penalty for a full charm belt, and upgrading a charm to Lv 5 doubles its Power yield (1.00× → 2.00×).
      </Text>
      <Text style={st.note}>
        Skill feats: Perfect Parry {formatPowerGain(SKILL_FEAT_POWER.perfectParry)}, Counter Parry {formatPowerGain(SKILL_FEAT_POWER.counterParry)}, 3-step Purity {formatPowerGain(SKILL_FEAT_POWER.purityChain3)}, Clutch Bomb (&lt;5s) {formatPowerGain(SKILL_FEAT_POWER.clutchBomb)}, Evolution {formatPowerGain(EVOLUTION_RULES.power)}.
      </Text>

      {(feeders.length > 0 || evolutionsTriggered > 0) && (
        <View style={st.feedList}>
          <Text style={st.feedHeader}>WHAT RAISES YOUR POWER</Text>
          {feeders.map(({ weapon, phrase, gain }) => (
            <View key={weapon.id} style={st.feedRow}>
              <WeaponAvatar weapon={weapon} size={18} />
              <Text style={st.feedText}>
                <Text style={st.bold}>{weapon.name}</Text> (Lv.{weapon.level}) · {gain ? `${gain} Power on ` : ''}{phrase}
              </Text>
            </View>
          ))}
          {evolutionsTriggered > 0 && (
            <View style={st.feedRow}>
              <Icon name="lorc/crystal-shine" size={16} color={TONE.evoReady} />
              <Text style={st.feedText}>
                <Text style={st.bold}>Evolution surge</Text> ×{evolutionsTriggered} · +{Math.round(evolutionsTriggered * EVOLUTION_RULES.power * 100) / 100} Power from fused weapons
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
