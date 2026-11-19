/**
 * Starfall Spire Build Inspector Modal.
 *
 * Reuses `WeaponExplainer.tsx` (single weapon explainer guardrail!), `FighterAvatar`,
 * `WeaponAvatar`, `ARCANA`, `EVOLUTION_RECIPES`, and `SKILL_NODES`.
 */
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import { getFighter } from '@/adventure/data/fighters';
import { getPassive } from '@/adventure/data/passives';
import { getArcana } from '@/adventure/data/arcana';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { getSkillNode } from '@/adventure/data/skillTrees';
import { weaponLevelSuffix } from '@/adventure/data/armory';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { Btn, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { ASCENSION_DESCRIPTIONS } from '../data/ascensions';
import { buildSpireWeaponBuilds, spireArmedRecipes, spireHeldWeapons } from '../engine/bridge';
import type { SpireRun } from '../types';

interface Props {
  visible: boolean;
  run: SpireRun;
  onClose: () => void;
}

const SpireBuildModal: React.FC<Props> = ({ visible, run, onClose }) => {
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
  if (!visible) return null;

  const fighter = getFighter(run.fighter);
  const builds = buildSpireWeaponBuilds(run);
  const weapons = spireHeldWeapons(run);
  const armedIds = spireArmedRecipes(run);
  const armedRecipes = EVOLUTION_RECIPES.filter(r => armedIds.includes(r.id));
  const focusedWeapon = weapons.find(w => w.id === selectedWeaponId) ?? weapons[0] ?? null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close build inspector" />
        <PopIn style={st.sheet}>
          <View style={st.header}>
            <FighterAvatar character={run.fighter} size={44} health={run.hearts} maxHealth={run.maxHearts} animate={false} framed />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Eyebrow text={`Spire Build · Seed ${run.seed}`} />
              <Text style={st.title} numberOfLines={1}>{run.fighter}</Text>
              <Text style={st.sub}>
                ♥ {run.hearts}/{run.maxHearts} · {run.coins}¢ · +{run.bonusDamagePerMatch} dmg · +{run.bonusClockSeconds}s clock
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} accessibilityLabel="Close">
              <Text style={st.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={st.body}>
            {/* Passives */}
            <Text style={st.section}>PASSIVES</Text>
            <View style={st.cardGroup}>
              {fighter.passives.map(pid => {
                const p = getPassive(pid);
                return (
                  <View key={pid} style={st.rowCard}>
                    <Icon name={p.icon} size={16} color={INK} />
                    <Text style={st.rowText}>
                      <Text style={st.bold}>{p.name}: </Text>{p.text}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Held Weapons (tap to inspect with WeaponExplainer) */}
            <Text style={st.section}>WEAPONS ({weapons.length} · UNCAPPED)</Text>
            <View style={st.weaponGrid}>
              {weapons.map((w, i) => {
                const lv = builds[w.id]?.level ?? 1;
                const active = focusedWeapon?.id === w.id;
                return (
                  <TouchableOpacity
                    key={`${w.id}-${i}`}
                    testID={`spire-build-weapon-${w.id}`}
                    onPress={() => setSelectedWeaponId(w.id)}
                    style={[st.weaponChip, active && st.weaponChipActive]}
                    activeOpacity={0.8}
                  >
                    <WeaponAvatar weapon={w} size={22} />
                    <Text style={st.weaponChipText} numberOfLines={1}>
                      {w.name}{weaponLevelSuffix(lv)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {focusedWeapon && (
              <WeaponExplainer weapon={focusedWeapon} build={builds[focusedWeapon.id]} defaultOpen />
            )}

            {/* Armed Evolutions */}
            <Text style={st.section}>ARMED EVOLUTIONS ({armedRecipes.length})</Text>
            {armedRecipes.length === 0 ? (
              <Text style={st.muted}>Draft synergy-badged weapons to arm 30-second Evolution power trips!</Text>
            ) : (
              <View style={st.cardGroup}>
                {armedRecipes.map(r => (
                  <View key={r.id} style={st.evoCard}>
                    <Icon name={r.icon} size={16} color={TONE.evoReady} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.evoName}>{r.name} · {r.familyText}</Text>
                      <Text style={st.rowText}>{r.activeText}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Drafted Skill Nodes */}
            {run.skillNodes.length > 0 && (
              <>
                <Text style={st.section}>MASTERED SKILL NODES ({run.skillNodes.length})</Text>
                <View style={st.cardGroup}>
                  {run.skillNodes.map(id => {
                    const node = getSkillNode(id);
                    if (!node) return null;
                    return (
                      <View key={id} style={st.rowCard}>
                        <Icon name={node.icon} size={16} color={TONE.upside} />
                        <Text style={st.rowText}>
                          <Text style={st.bold}>{node.name}: </Text>{node.text}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Equipped Arcana */}
            {run.arcana.length > 0 && (
              <>
                <Text style={st.section}>ARCANA WILDCARDS ({run.arcana.length})</Text>
                <View style={st.cardGroup}>
                  {run.arcana.map(id => {
                    const a = getArcana(id);
                    return (
                      <View key={id} style={st.rowCard}>
                        <Icon name={a.icon} size={16} color={INK} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={st.arcanaName}>{a.numeral} · {a.name}</Text>
                          <Text style={[st.rowText, { color: TONE.upside }]}>▲ {a.upside}</Text>
                          <Text style={[st.rowText, { color: TONE.tradeoff }]}>▼ {a.tradeoff}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Active Ascensions */}
            {run.ascension > 0 && (
              <>
                <Text style={st.section}>ASCENSION {run.ascension} ACTIVE RULES</Text>
                <View style={st.cardGroup}>
                  {ASCENSION_DESCRIPTIONS.slice(1, run.ascension + 1).map((d, idx) => (
                    <Text key={idx} style={st.ascLine}>
                      • A{idx + 1}: {d}
                    </Text>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={st.footer}>
            <Btn label="Close" onPress={onClose} />
          </View>
        </PopIn>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,18,0.62)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  sheet: { width: '100%', maxWidth: 460, maxHeight: '90%', backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: COLORS.paperBeige, borderBottomWidth: 2, borderBottomColor: INK },
  title: { fontSize: 18, fontWeight: '900', color: INK },
  sub: { fontSize: 11, fontWeight: '800', color: INK, opacity: 0.78 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontWeight: '900', color: INK, fontSize: 14 },
  body: { padding: 12, gap: 10 },
  section: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, color: TONE.spent, marginTop: 4 },
  cardGroup: { gap: 6 },
  rowCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#D6CFC4', padding: 8 },
  evoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: TONE.coinPale, borderRadius: 8, borderWidth: 1.5, borderColor: TONE.evoReady, padding: 8 },
  evoName: { fontSize: 12, fontWeight: '900', color: INK },
  arcanaName: { fontSize: 12, fontWeight: '900', color: INK },
  rowText: { flex: 1, fontSize: 12, lineHeight: 17, color: INK },
  bold: { fontWeight: '900' },
  muted: { fontSize: 12, color: TONE.spent },
  weaponGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weaponChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.paperBeige, borderWidth: 2, borderColor: '#C9C2B8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, maxWidth: '100%' },
  weaponChipActive: { backgroundColor: TONE.selected, borderColor: INK },
  weaponChipText: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: INK },
  ascLine: { fontSize: 11, color: INK, opacity: 0.85, lineHeight: 16 },
  footer: { padding: 12, borderTopWidth: 2, borderTopColor: INK, backgroundColor: COLORS.paperBeige },
});

export default SpireBuildModal;
