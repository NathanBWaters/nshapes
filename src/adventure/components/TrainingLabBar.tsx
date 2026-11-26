/**
 * [TP-12] Player-facing Training Lab sandbox bar for `1-4D` (The Back Field).
 *
 * Graduates dev tools into an effortless customization sandbox (Sakurai Ep. #180
 * Pillar 4 & #193 Debug Mode):
 *  - Live Rolling 15s DPS & Peak Hit Meter + Trigger Counter + Reset Dummy
 *  - 1-tap "Spawn Catalyst" (when an Evolution is armed), "Trigger Parry",
 *    and "Toggle Surge"
 *  - Dummy Mode selector: Immortal Dummy, Timing Parry Dummy, Counter-Parry
 *    Drill (All Orange / All Circles / Rainbow), Shading Surge Drill
 *  - Inline Hot-Swap drawer for unlocked Fighters, Armory Weapons, and Arcana
 *  - 1-tap "Back to Camp" / "Back to Preview" with zero map detour
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import type { CharacterName } from '@/types';
import { COLORS } from '@/utils/colors';
import { ARCANA } from '../data/arcana';
import { getArmoryWeapon } from '../data/armory';
import { FIGHTERS } from '../data/fighters';
import { weaponBuilds } from '../progress';
import type { AdventureSave, ArcanaId, FightLogEntry, RunState } from '../types';
import { INK, TONE } from './ui';

export type DummyMode =
  | 'immortal'
  | 'timing_parry'
  | 'counter_color'
  | 'counter_shape'
  | 'counter_rainbow'
  | 'surge_drill';

export interface DummyModeMeta {
  id: DummyMode;
  label: string;
  shortLabel: string;
  icon: IconName;
  description: string;
}

export const DUMMY_MODES: readonly DummyModeMeta[] = [
  {
    id: 'immortal',
    label: 'Immortal Dummy',
    shortLabel: 'Immortal',
    icon: 'lorc/target-dummy',
    description: 'Soaks unlimited damage so you can measure sustained 15s DPS and Peak Hits.',
  },
  {
    id: 'timing_parry',
    label: 'Timing Parry Dummy',
    shortLabel: 'Timing Parry',
    icon: 'lorc/sword-clash',
    description: 'Winds up periodic strikes—match any Trio to Parry, or hit the final golden window for Perfect Parry.',
  },
  {
    id: 'counter_color',
    label: 'Counter Drill: All Orange',
    shortLabel: 'All Orange',
    icon: 'lorc/crystal-shine',
    description: 'Rehearse Color Counter-Parries by matching 3 Orange cards during wind-up.',
  },
  {
    id: 'counter_shape',
    label: 'Counter Drill: All Circles',
    shortLabel: 'All Circles',
    icon: 'lorc/diamond-hard',
    description: 'Rehearse Shape Counter-Parries by matching 3 Circles during wind-up.',
  },
  {
    id: 'counter_rainbow',
    label: 'Counter Drill: Rainbow',
    shortLabel: 'Rainbow',
    icon: 'lorc/rainbow-star',
    description: 'Rehearse Rainbow Counter-Parries (every active trait all different).',
  },
  {
    id: 'surge_drill',
    label: 'Shading Surge Drill',
    shortLabel: 'Surge Drill',
    icon: 'lorc/power-lightning',
    description: 'Practice high-multiplier 4-trait Shading Surge bursts on demand.',
  },
];

export interface RollingDpsStats {
  /** Damage per second across the last `windowMs` (default 15,000ms) */
  dps: number;
  /** Highest single-entry damage recorded in this sandbox session */
  peakHit: number;
  /** Total triggered effects / weapon lines fired across this session */
  triggerCount: number;
  /** Raw damage dealt inside the rolling window */
  windowDamage: number;
}

/** Pure rolling 15s DPS, Peak Hit, and Trigger Counter computed directly from `run.log`. */
export const computeRollingDps = (
  log: readonly FightLogEntry[],
  nowMs: number,
  windowMs = 15_000
): RollingDpsStats => {
  const cutoff = Math.max(0, nowMs - windowMs);
  let windowDamage = 0;
  let peakHit = 0;
  let triggerCount = 0;

  for (const entry of log) {
    if (entry.damage > peakHit) peakHit = entry.damage;
    if (entry.t >= cutoff) {
      windowDamage += entry.damage;
    }
    triggerCount += entry.lines.length;
  }

  const effectiveSec = Math.max(1, Math.min(windowMs, Math.max(nowMs, 1000)) / 1000);
  return {
    dps: Math.round((windowDamage / effectiveSec) * 10) / 10,
    peakHit,
    triggerCount,
    windowDamage,
  };
};

export interface TrainingLabActions {
  onSwapFighter?: (fighter: CharacterName) => void;
  onToggleWeapon?: (weaponId: string) => void;
  onToggleArcana?: (arcanaId: ArcanaId) => void;
  onSpawnCatalyst?: () => void;
  onTriggerParry?: (mode?: DummyMode) => void;
  onToggleSurge?: () => void;
  onChangeDummyMode?: (mode: DummyMode) => void;
  onResetDummy?: () => void;
  onReturn?: () => void;
}

export interface TrainingLabBarProps {
  save: AdventureSave;
  run: Pick<
    RunState,
    | 'fighter'
    | 'weapons'
    | 'arcana'
    | 'armedRecipes'
    | 'surge'
    | 'parry'
    | 'elapsedMs'
    | 'biggestHit'
    | 'log'
    | 'totalDamage'
  >;
  dummyMode?: DummyMode;
  /** e.g. "Back to Camp" or "Back to Preview" */
  returnLabel?: string;
  actions?: TrainingLabActions;
  testID?: string;
}

type SwapTab = 'fighter' | 'weapons' | 'arcana';

const TrainingLabBar: React.FC<TrainingLabBarProps> = ({
  save,
  run,
  dummyMode = 'immortal',
  returnLabel = 'Back to Camp',
  actions,
  testID = 'training-lab-bar',
}) => {
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapTab, setSwapTab] = useState<SwapTab>('weapons');
  const [activeMode, setActiveMode] = useState<DummyMode>(dummyMode);

  const metrics = useMemo(() => {
    const computed = computeRollingDps(run.log, run.elapsedMs, 15_000);
    return {
      ...computed,
      peakHit: Math.max(computed.peakHit, run.biggestHit),
    };
  }, [run.log, run.elapsedMs, run.biggestHit]);

  const builds = useMemo(() => weaponBuilds(save), [save]);
  const heldWeaponIds = useMemo(() => new Set(run.weapons.map(w => w.id)), [run.weapons]);
  const hasArmedEvo = run.armedRecipes.length > 0;
  const surgeActive = Boolean(run.surge?.active);
  const modeMeta = DUMMY_MODES.find(m => m.id === activeMode) ?? DUMMY_MODES[0];

  const handleSelectMode = (mode: DummyMode) => {
    setActiveMode(mode);
    actions?.onChangeDummyMode?.(mode);
  };

  return (
    <View style={st.root} testID={testID}>
      {/* Top row: Live 15s DPS · Peak Hit · Triggers · Reset · 1-tap Return */}
      <View style={st.topRow}>
        <View style={st.metricPill} testID="training-lab-dps">
          <Text style={st.metricLabel}>15s DPS</Text>
          <Text style={st.metricVal}>{metrics.dps.toFixed(1)}</Text>
        </View>
        <View style={st.metricPill} testID="training-lab-peak">
          <Text style={st.metricLabel}>PEAK</Text>
          <Text style={st.metricVal}>{metrics.peakHit}</Text>
        </View>
        <View style={st.metricPill} testID="training-lab-triggers">
          <Text style={st.metricLabel}>PROCS</Text>
          <Text style={st.metricVal}>{metrics.triggerCount}</Text>
        </View>
        <TouchableOpacity
          testID="training-lab-reset"
          onPress={() => actions?.onResetDummy?.()}
          style={st.iconBtn}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Reset Training Dummy"
        >
          <Icon name="lorc/recycle" size={14} color={INK} />
          <Text style={st.iconBtnText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="training-lab-return"
          onPress={() => actions?.onReturn?.()}
          style={st.returnBtn}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={returnLabel}
        >
          <Text style={st.returnBtnText} numberOfLines={1}>{returnLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Action Strip: Hot-Swap · Spawn Catalyst · Trigger Parry · Toggle Surge */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.actionRow}>
        <TouchableOpacity
          testID="training-lab-swap-toggle"
          onPress={() => setSwapOpen(v => !v)}
          style={[st.actionPill, swapOpen && st.actionPillOn]}
          activeOpacity={0.85}
        >
          <Icon name="lorc/gems" size={13} color={INK} />
          <Text style={st.actionText}>{swapOpen ? 'Hide Build ▲' : 'Hot-Swap Build ▼'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="training-lab-catalyst"
          disabled={!hasArmedEvo}
          onPress={() => actions?.onSpawnCatalyst?.()}
          style={[st.actionPill, hasArmedEvo ? st.actionEvo : st.actionDisabled]}
          activeOpacity={0.85}
          accessibilityState={{ disabled: !hasArmedEvo }}
        >
          <Icon name="lorc/crystal-shine" size={13} color={INK} />
          <Text style={st.actionText}>
            {hasArmedEvo ? 'Spawn Catalyst' : 'No Evo Armed'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="training-lab-parry"
          onPress={() => actions?.onTriggerParry?.(activeMode)}
          style={st.actionPill}
          activeOpacity={0.85}
        >
          <Icon name="lorc/sword-clash" size={13} color={INK} />
          <Text style={st.actionText}>Trigger Parry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="training-lab-surge"
          onPress={() => actions?.onToggleSurge?.()}
          style={[st.actionPill, surgeActive && st.actionSurgeOn]}
          activeOpacity={0.85}
        >
          <Icon name="lorc/power-lightning" size={13} color={surgeActive ? COLORS.canvasWhite : INK} />
          <Text style={[st.actionText, surgeActive && { color: COLORS.canvasWhite }]}>
            {surgeActive ? 'Surge: ON' : 'Toggle Surge'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Dummy Mode Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.modeRow}>
        {DUMMY_MODES.map(m => {
          const on = activeMode === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              testID={`training-dummy-${m.id}`}
              onPress={() => handleSelectMode(m.id)}
              style={[st.modeChip, on && st.modeChipOn]}
              activeOpacity={0.85}
              accessibilityState={{ selected: on }}
            >
              <Text style={[st.modeChipText, on && st.modeChipTextOn]}>{m.shortLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={st.modeHint} testID="training-dummy-desc">{modeMeta.description}</Text>

      {/* Expandable Hot-Swap Build Tray */}
      {swapOpen && (
        <View style={st.swapTray} testID="training-lab-swap-tray">
          <View style={st.swapTabs}>
            {(
              [
                { id: 'fighter', label: `Fighter (${run.fighter})` },
                { id: 'weapons', label: `Weapons (${run.weapons.length})` },
                { id: 'arcana', label: `Arcana (${run.arcana.length})` },
              ] as const
            ).map(t => (
              <TouchableOpacity
                key={t.id}
                testID={`training-swap-tab-${t.id}`}
                onPress={() => setSwapTab(t.id)}
                style={[st.swapTab, swapTab === t.id && st.swapTabOn]}
              >
                <Text style={st.swapTabText} numberOfLines={1}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {swapTab === 'fighter' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.swapItems}>
              {FIGHTERS.filter(f => save.unlockedFighters.includes(f.name)).map(f => {
                const selected = f.name === run.fighter;
                return (
                  <TouchableOpacity
                    key={f.name}
                    testID={`training-swap-fighter-${f.name}`}
                    onPress={() => actions?.onSwapFighter?.(f.name)}
                    style={[st.swapItem, selected && st.swapItemOn]}
                  >
                    <Icon name={f.icon} size={16} color={INK} />
                    <Text style={st.swapItemText}>{f.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {swapTab === 'weapons' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.swapItems}>
              {save.armory.length === 0 ? (
                <Text style={st.emptySwap}>Unlock Armory weapons to hot-swap them here.</Text>
              ) : (
                save.armory.map(id => {
                  const w = getArmoryWeapon(id, builds);
                  if (!w) return null;
                  const equipped = heldWeaponIds.has(id);
                  return (
                    <TouchableOpacity
                      key={id}
                      testID={`training-swap-weapon-${id}`}
                      onPress={() => actions?.onToggleWeapon?.(id)}
                      style={[st.swapItem, equipped && st.swapItemOn]}
                    >
                      <WeaponAvatar weapon={w} size={18} />
                      <Text style={st.swapItemText}>{w.name}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          {swapTab === 'arcana' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.swapItems}>
              {save.unlockedArcana.length === 0 ? (
                <Text style={st.emptySwap}>Unlock Arcana in the campaign to test rule twists here.</Text>
              ) : (
                ARCANA.filter(a => save.unlockedArcana.includes(a.id)).map(a => {
                  const equipped = run.arcana.includes(a.id);
                  return (
                    <TouchableOpacity
                      key={a.id}
                      testID={`training-swap-arcana-${a.id}`}
                      onPress={() => actions?.onToggleArcana?.(a.id)}
                      style={[st.swapItem, equipped && st.swapItemOn]}
                    >
                      <Icon name={a.icon} size={14} color={INK} />
                      <Text style={st.swapItemText}>{a.name}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const st = StyleSheet.create({
  root: {
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metricPill: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: INK,
    opacity: 0.65,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  iconBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: INK,
  },
  returnBtn: {
    marginLeft: 'auto',
    backgroundColor: COLORS.actionYellow,
    borderRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: INK,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 150,
  },
  returnBtnText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    color: INK,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  actionPillOn: {
    backgroundColor: COLORS.actionYellow,
  },
  actionEvo: {
    backgroundColor: TONE.comboPale,
    borderColor: TONE.combo,
  },
  actionSurgeOn: {
    backgroundColor: '#DB2777',
    borderColor: INK,
  },
  actionDisabled: {
    opacity: 0.48,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '900',
    color: INK,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C5BCB0',
    backgroundColor: COLORS.canvasWhite,
  },
  modeChipOn: {
    backgroundColor: INK,
    borderColor: INK,
  },
  modeChipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: INK,
  },
  modeChipTextOn: {
    color: COLORS.canvasWhite,
  },
  modeHint: {
    fontSize: 11,
    fontWeight: '600',
    color: INK,
    opacity: 0.78,
  },
  swapTray: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: INK,
    padding: 7,
    gap: 6,
  },
  swapTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  swapTab: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C5BCB0',
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
  },
  swapTabOn: {
    backgroundColor: COLORS.actionYellow,
    borderColor: INK,
  },
  swapTabText: {
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: '900',
    color: INK,
  },
  swapItems: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#C5BCB0',
    backgroundColor: COLORS.paperBeige,
  },
  swapItemOn: {
    backgroundColor: TONE.selected,
    borderColor: INK,
  },
  swapItemText: {
    fontSize: 11,
    fontWeight: '800',
    color: INK,
  },
  emptySwap: {
    fontSize: 11,
    fontStyle: 'italic',
    color: INK,
    opacity: 0.7,
    paddingVertical: 4,
  },
});

export default TrainingLabBar;
