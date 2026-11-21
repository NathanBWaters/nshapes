/**
 * Starfall Summit — Campfire Node (Rest / Forge Weapon / Meditate for a real Fighter Skill Tree Node).
 *
 * Reuses `WeaponExplainer.tsx` and shared `WeaponOfferRow` / `SkillNodeRow`.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { SkillNodeRow, WeaponOfferRow } from '@/adventure/components/SharedCards';
import { Btn, DARK, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import { buildSpireWeaponBuilds, spireHeldWeapons } from '../engine/bridge';
import type { SpireCampfireState, SpireRun } from '../types';
import SpireBeltBar from './SpireBeltBar';

interface Props {
  run: SpireRun;
  campfire: SpireCampfireState;
  onRest: () => void;
  onForge: (weaponId: string) => void;
  onMeditate: (nodeId: string) => void;
  onReorderWeapon?: (fromIndex: number, toIndex: number) => void;
  onLeave: () => void;
}

const SpireCampfire: React.FC<Props> = ({ run, campfire, onRest, onForge, onMeditate, onReorderWeapon, onLeave }) => {
  const [subMode, setSubMode] = useState<'main' | 'forge' | 'meditate'>('main');
  const [focusedForgeId, setFocusedForgeId] = useState<string | null>(null);

  const held = spireHeldWeapons(run);
  const builds = buildSpireWeaponBuilds(run);
  const forgeable = held.filter(w => (run.weaponLevels[w.id] ?? 1) < MAX_WEAPON_LEVEL);
  const availSkills = campfire.skillOptions.filter(id => !run.skillNodes.includes(id));
  const focusedWeapon = forgeable.find(w => w.id === focusedForgeId) ?? forgeable[0] ?? null;

  return (
    <View style={st.root} testID="spire-campfire">
      <ScrollView contentContainerStyle={st.body}>
        <PopIn style={st.heroCard}>
          <View style={st.heroRow}>
            <FighterAvatar character={run.fighter} size={56} health={run.hearts} maxHealth={run.maxHearts} mood="idle" />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Eyebrow text="CAMPFIRE" color="#FED7AA" />
              <Text style={st.title}>Crackling Embers</Text>
              <Text style={st.sub}>Take one action before ascending the Summit.</Text>
            </View>
            <Icon name="lorc/campfire" size={38} color="#F97316" />
          </View>
        </PopIn>

        {campfire.resolved ? (
          <PopIn style={st.outcomeCard}>
            <Text style={st.outcomeTitle}>Ready to Climb!</Text>
            <Text style={st.outcomeText}>{campfire.outcomeText}</Text>
            <Btn testID="spire-campfire-leave" label="Return to Map" icon="lorc/mountaintop" onPress={() => { sfx('confirm'); onLeave(); }} />
          </PopIn>
        ) : subMode === 'main' ? (
          <View style={st.options}>
            <TouchableOpacity
              testID="spire-campfire-rest"
              onPress={() => { band.cue('heal'); onRest(); }}
              style={[st.optCard, { borderColor: '#DC2626' }]}
              activeOpacity={0.85}
            >
              <View style={[st.optIcon, { backgroundColor: '#FEE2E2' }]}>
                <Icon name="lorc/shining-heart" size={26} color="#DC2626" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.optTitle}>Rest</Text>
                <Text style={st.optDesc}>
                  Heal +{campfire.healAmount} ♥ ({Math.min(run.maxHearts, run.hearts + campfire.healAmount)}/{run.maxHearts} Hearts).
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              testID="spire-campfire-forge-open"
              disabled={forgeable.length === 0}
              onPress={() => { sfx('click'); setSubMode('forge'); }}
              style={[st.optCard, { borderColor: '#D97706' }, forgeable.length === 0 && { opacity: 0.45 }]}
              activeOpacity={0.85}
            >
              <View style={[st.optIcon, { backgroundColor: '#FEF3C7' }]}>
                <Icon name="lorc/anvil" size={26} color="#B45309" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.optTitle}>Forge</Text>
                <Text style={st.optDesc}>Upgrade any held weapon by +1 Level for the rest of this run.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              testID="spire-campfire-meditate-open"
              disabled={availSkills.length === 0}
              onPress={() => { sfx('click'); setSubMode('meditate'); }}
              style={[st.optCard, { borderColor: TONE.upside }, availSkills.length === 0 && { opacity: 0.45 }]}
              activeOpacity={0.85}
            >
              <View style={[st.optIcon, { backgroundColor: '#CCFBF1' }]}>
                <Icon name="lorc/meditation" size={26} color={TONE.upside} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.optTitle}>Meditate</Text>
                <Text style={st.optDesc}>Unlock 1 of 3 real {run.fighter} Skill Tree nodes for this climb!</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : subMode === 'forge' ? (
          <View style={st.subCard}>
            <Text style={st.secTitle}>CHOOSE A WEAPON TO FORGE (+1 LEVEL)</Text>
            <View style={{ gap: 8 }}>
              {forgeable.map(w => {
                const lv = builds[w.id]?.level ?? 1;
                return (
                  <WeaponOfferRow
                    key={w.id}
                    weapon={w}
                    level={lv}
                    subtitle={`Level ${lv} → Level ${lv + 1}`}
                    focused={focusedWeapon?.id === w.id}
                    onPress={() => setFocusedForgeId(w.id)}
                    right={
                      <Btn
                        testID={`spire-campfire-forge-${w.id}`}
                        small
                        label="Forge"
                        onPress={() => { band.cue('levelUp'); onForge(w.id); }}
                      />
                    }
                  />
                );
              })}
            </View>
            {focusedWeapon && <WeaponExplainer weapon={focusedWeapon} build={builds[focusedWeapon.id]} />}
            <Btn small variant="secondary" label="Back" onPress={() => setSubMode('main')} />
          </View>
        ) : (
          <View style={st.subCard}>
            <Text style={st.secTitle}>CHOOSE A {run.fighter.toUpperCase()} SKILL NODE</Text>
            <View style={{ gap: 8 }}>
              {availSkills.map((id, i) => (
                <SkillNodeRow
                  key={id}
                  testID={`spire-campfire-skill-${i}`}
                  nodeId={id}
                  onPress={() => { band.cue('levelUp'); onMeditate(id); }}
                />
              ))}
            </View>
            <Btn small variant="secondary" label="Back" onPress={() => setSubMode('main')} />
          </View>
        )}

        {/* Quick belt inspection & reordering while resting by the campfire */}
        {subMode === 'main' && (
          <SpireBeltBar
            run={run}
            onReorder={onReorderWeapon}
            title="INSPECT & REORDER BELT"
            compact
            testIDPrefix="spire-campfire-belt"
          />
        )}
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  body: { padding: 14, gap: 12, maxWidth: 500, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  heroCard: { backgroundColor: DARK.panel, borderRadius: 14, borderWidth: 2.5, borderColor: '#F97316', padding: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '900', color: DARK.text },
  sub: { fontSize: 12, color: DARK.muted },
  options: { gap: 10 },
  optCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 3, borderBottomWidth: 6, padding: 12 },
  optIcon: { width: 48, height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 17, fontWeight: '900', color: INK },
  optDesc: { fontSize: 12, color: INK, opacity: 0.85, lineHeight: 17 },
  outcomeCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 16, gap: 10 },
  outcomeTitle: { fontSize: 20, fontWeight: '900', color: INK, textAlign: 'center' },
  outcomeText: { fontSize: 14, color: INK, textAlign: 'center', lineHeight: 20 },
  subCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 10 },
  secTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
});

export default SpireCampfire;
