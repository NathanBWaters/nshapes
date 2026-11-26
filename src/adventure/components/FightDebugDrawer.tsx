/**
 * [TP-11] Dev-only collapsible in-fight live tuning drawer (`FightDebugDrawer`).
 *
 * Mounts cleanly into `AdventureRun` (benefiting both Adventure Mode & Starfall
 * Summit) and renders strictly in `__DEV__`:
 *  - State controls: Set Foe HP (1 / 25% / 50% / Full), Freeze Clock, Spawn
 *    Catalyst, Force Parry Wind-Up / Perfect Window, Force Shading Surge,
 *    Hot-Swap / Add Any Weapon (Lv 1–5), Set Hearts.
 *  - Inspection & Speed: Slow-Mo (`0.25×` / `0.5×` / `1×` wired to `fxClock`)
 *    + Layer Visibility Toggles (Hide FX / Dim Board / Show Anchors).
 *  - Live JSON Parameter Override store for `PARRY_RULES`, `SURGE_RULES`, and
 *    weapon stats + 1-tap "Copy Diff".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon } from '../data/armory';
import {
  applyDevOverridesJson,
  buildDevOverridesDiff,
  countActiveDevOverrides,
  getDevOverrides,
  resetDevOverrides,
  setDevLayers,
  setDevSlowMo,
  subscribeDevOverrides,
  type DevOverrides,
  type DevSlowMoRate,
} from '../engine/devOverrides';
import type { RunState } from '../types';
import { INK } from './ui';

export interface FightDebugActions {
  onSetFoeHp?: (hp: number) => void;
  onToggleFreezeClock?: () => void;
  onSpawnCatalyst?: () => void;
  onForceParry?: (window: 'windup' | 'perfect') => void;
  onForceSurge?: () => void;
  onHotSwapWeapon?: (weaponId: string, level: number) => void;
  onSetHearts?: (hearts: number) => void;
}

export interface FightDebugDrawerProps {
  run?: Pick<RunState, 'foeHp' | 'foeMaxHp' | 'hearts' | 'maxHearts' | 'weapons' | 'surge' | 'parry' | 'frozenMs'>;
  actions?: FightDebugActions;
  clockFrozen?: boolean;
  initialOpen?: boolean;
  testID?: string;
}

const SLOWMO_RATES: DevSlowMoRate[] = [0.25, 0.5, 1];
const LEVELS = [1, 2, 3, 4, 5] as const;

const defaultJsonOf = (snap: DevOverrides): string =>
  JSON.stringify(
    {
      parry: snap.parry,
      surge: snap.surge,
      weapons: snap.weapons,
    },
    null,
    2
  );

const FightDebugDrawer: React.FC<FightDebugDrawerProps> = ({
  run,
  actions,
  clockFrozen = false,
  initialOpen = false,
  testID = 'fight-debug-drawer',
}) => {
  const [open, setOpen] = useState(initialOpen);
  const [overrides, setOverrides] = useState<DevOverrides>(() => getDevOverrides());
  const [weaponQuery, setWeaponQuery] = useState('');
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>(ALL_ARMORY_WEAPON_IDS[0] ?? 'blast-powder');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [jsonText, setJsonText] = useState<string>(() => defaultJsonOf(getDevOverrides()));
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeDevOverrides(setOverrides), []);

  const weaponCatalog = useMemo(
    () =>
      ALL_ARMORY_WEAPON_IDS.map(id => getArmoryWeapon(id)).filter(
        (w): w is NonNullable<typeof w> => Boolean(w)
      ),
    []
  );

  const matchingWeapons = useMemo(() => {
    const q = weaponQuery.trim().toLowerCase();
    const list = q
      ? weaponCatalog.filter(w => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q))
      : weaponCatalog;
    return list.slice(0, 12);
  }, [weaponCatalog, weaponQuery]);

  // Strict dev-only runtime guard (in addition to production route/bundler stripping)
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return null;
  }

  const maxHp = Math.max(1, run?.foeMaxHp ?? 100);
  const maxHearts = Math.max(1, run?.maxHearts ?? 5);
  const activeCount = countActiveDevOverrides(overrides);

  const handleApplyJson = () => {
    const res = applyDevOverridesJson(jsonText);
    if (res.ok) {
      setJsonStatus('Applied live — takes effect on next Set.');
    } else {
      setJsonStatus(`Error: ${res.error}`);
    }
  };

  const handleReset = () => {
    resetDevOverrides();
    const fresh = getDevOverrides();
    setOverrides(fresh);
    setJsonText(defaultJsonOf(fresh));
    setJsonStatus('Overrides reset to stock.');
  };

  const handleCopyDiff = async () => {
    const diff = buildDevOverridesDiff(overrides);
    try {
      await Clipboard.setStringAsync(diff);
      setCopied(true);
      setJsonStatus('Copied diff to clipboard.');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setJsonStatus(diff);
    }
  };

  return (
    <View style={st.anchor} pointerEvents="box-none" testID={testID}>
      <TouchableOpacity
        testID="debug-drawer-toggle"
        onPress={() => setOpen(v => !v)}
        style={[st.pill, open && st.pillOpen]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close dev tuning drawer' : 'Open dev tuning drawer'}
      >
        <Icon name="lorc/gear-hammer" size={14} color={open ? INK : COLORS.actionYellow} noShadow />
        <Text style={[st.pillText, open && st.pillTextOpen]}>
          DEV{activeCount > 0 ? ` · ${activeCount}` : ''}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={st.drawer} testID="debug-drawer-panel">
          <View style={st.drawerHead}>
            <Text style={st.drawerTitle} numberOfLines={1}>LIVE FIGHT DEBUGGER</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={st.closeBtn} accessibilityLabel="Close debugger">
              <Text style={st.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={st.scroll} contentContainerStyle={st.body}>
            {/* 1. State Controls */}
            <Text style={st.section}>FOE HP ({run ? `${run.foeHp}/${run.foeMaxHp}` : '—'})</Text>
            <View style={st.chipRow}>
              <Chip testID="debug-foe-hp-1" label="1 HP" onPress={() => actions?.onSetFoeHp?.(1)} />
              <Chip testID="debug-foe-hp-25" label="25%" onPress={() => actions?.onSetFoeHp?.(Math.max(1, Math.round(maxHp * 0.25)))} />
              <Chip testID="debug-foe-hp-50" label="50%" onPress={() => actions?.onSetFoeHp?.(Math.max(1, Math.round(maxHp * 0.5)))} />
              <Chip testID="debug-foe-hp-100" label="Full" onPress={() => actions?.onSetFoeHp?.(maxHp)} />
            </View>

            <Text style={st.section}>FIGHT TRIGGERS & CLOCK</Text>
            <View style={st.chipRow}>
              <Chip
                testID="debug-freeze-clock"
                label={clockFrozen ? 'Unfreeze Clock' : 'Freeze Clock'}
                active={clockFrozen}
                onPress={() => actions?.onToggleFreezeClock?.()}
              />
              <Chip testID="debug-spawn-catalyst" label="Spawn Catalyst" onPress={() => actions?.onSpawnCatalyst?.()} />
              <Chip testID="debug-parry-windup" label="Parry Wind-Up" onPress={() => actions?.onForceParry?.('windup')} />
              <Chip testID="debug-parry-perfect" label="Perfect Window" onPress={() => actions?.onForceParry?.('perfect')} />
              <Chip
                testID="debug-force-surge"
                label={run?.surge?.active ? 'Surge: ON' : 'Force Surge'}
                active={Boolean(run?.surge?.active)}
                onPress={() => actions?.onForceSurge?.()}
              />
            </View>

            <Text style={st.section}>HEARTS ({run?.hearts ?? '∞'}/{run?.maxHearts ?? '∞'})</Text>
            <View style={st.chipRow}>
              <Chip testID="debug-hearts-1" label="1 ♥" onPress={() => actions?.onSetHearts?.(1)} />
              <Chip testID="debug-hearts-3" label="3 ♥" onPress={() => actions?.onSetHearts?.(3)} />
              <Chip testID="debug-hearts-full" label={`Full (${maxHearts} ♥)`} onPress={() => actions?.onSetHearts?.(maxHearts)} />
            </View>

            {/* 2. Hot-Swap Weapon */}
            <Text style={st.section}>HOT-SWAP / ADD WEAPON (LV 1–5)</Text>
            <TextInput
              testID="debug-weapon-search"
              value={weaponQuery}
              onChangeText={setWeaponQuery}
              placeholder="Search 64 weapons..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={st.input}
            />
            <View style={st.chipRow}>
              {matchingWeapons.map(w => (
                <Chip
                  key={w.id}
                  testID={`debug-weapon-opt-${w.id}`}
                  label={w.name}
                  active={selectedWeaponId === w.id}
                  onPress={() => setSelectedWeaponId(w.id)}
                />
              ))}
            </View>
            <View style={st.chipRow}>
              {LEVELS.map(lv => (
                <Chip
                  key={lv}
                  testID={`debug-weapon-lv-${lv}`}
                  label={`Lv ${lv}`}
                  active={selectedLevel === lv}
                  onPress={() => setSelectedLevel(lv)}
                />
              ))}
              <Chip
                testID="debug-weapon-apply"
                label="Add / Swap"
                primary
                onPress={() => actions?.onHotSwapWeapon?.(selectedWeaponId, selectedLevel)}
              />
            </View>

            {/* 3. Slow-Mo & Layer Visibility (Ep. #215) */}
            <Text style={st.section}>SLOW-MO & LAYER INSPECTION</Text>
            <View style={st.chipRow}>
              {SLOWMO_RATES.map(r => (
                <Chip
                  key={r}
                  testID={`debug-slowmo-${r}`}
                  label={`${r}×`}
                  active={overrides.slowMoRate === r}
                  onPress={() => setDevSlowMo(r)}
                />
              ))}
            </View>
            <View style={st.chipRow}>
              <Chip
                testID="debug-layer-fx"
                label={overrides.layers.hideFx ? 'FX: Hidden' : 'Hide FX'}
                active={overrides.layers.hideFx}
                onPress={() => setDevLayers({ hideFx: !overrides.layers.hideFx })}
              />
              <Chip
                testID="debug-layer-board"
                label={overrides.layers.dimBoard ? 'Board: Dim' : 'Dim Board'}
                active={overrides.layers.dimBoard}
                onPress={() => setDevLayers({ dimBoard: !overrides.layers.dimBoard })}
              />
              <Chip
                testID="debug-layer-anchors"
                label={overrides.layers.showAnchors ? 'Anchors: ON' : 'Show Anchors'}
                active={overrides.layers.showAnchors}
                onPress={() => setDevLayers({ showAnchors: !overrides.layers.showAnchors })}
              />
            </View>

            {/* 4. Live Parameter JSON Override */}
            <Text style={st.section}>LIVE PARAMETER OVERRIDES (JSON)</Text>
            <TextInput
              testID="debug-json-input"
              value={jsonText}
              onChangeText={setJsonText}
              multiline
              style={[st.input, st.jsonInput]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={st.chipRow}>
              <Chip testID="debug-json-apply" label="Apply JSON" primary onPress={handleApplyJson} />
              <Chip testID="debug-copy-diff" label={copied ? 'Copied!' : 'Copy Diff'} onPress={handleCopyDiff} />
              <Chip testID="debug-json-reset" label="Reset All" onPress={handleReset} />
            </View>
            {jsonStatus && (
              <Text style={st.statusText} testID="debug-json-status">{jsonStatus}</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const Chip: React.FC<{
  label: string;
  active?: boolean;
  primary?: boolean;
  onPress: () => void;
  testID?: string;
}> = ({ label, active, primary, onPress, testID }) => (
  <TouchableOpacity
    testID={testID}
    onPress={onPress}
    activeOpacity={0.8}
    style={[
      st.chip,
      active && st.chipActive,
      primary && st.chipPrimary,
    ]}
  >
    <Text style={[st.chipText, (active || primary) && st.chipTextDark]}>{label}</Text>
  </TouchableOpacity>
);

const st = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 200,
    alignItems: 'flex-end',
    maxWidth: 340,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.actionYellow,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillOpen: {
    backgroundColor: COLORS.actionYellow,
    borderColor: INK,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: COLORS.actionYellow,
  },
  pillTextOpen: {
    color: INK,
  },
  drawer: {
    marginTop: 6,
    width: 320,
    maxHeight: 460,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.actionYellow,
    overflow: 'hidden',
  },
  drawerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#1E293B',
  },
  drawerTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: COLORS.actionYellow,
  },
  closeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closeText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 13,
  },
  scroll: {
    maxHeight: 410,
  },
  body: {
    padding: 10,
    gap: 8,
  },
  section: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#94A3B8',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#0284C7',
  },
  chipPrimary: {
    backgroundColor: COLORS.actionYellow,
    borderColor: INK,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  chipTextDark: {
    color: INK,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
    color: '#F8FAFC',
    fontSize: 11.5,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  jsonInput: {
    minHeight: 74,
    fontFamily: MONO_FONT,
    textAlignVertical: 'top',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FDE047',
  },
});

export default FightDebugDrawer;
