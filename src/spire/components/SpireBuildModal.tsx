/**
 * Starfall Summit Build Inspector Modal.
 *
 * Reuses `WeaponExplainer.tsx` (single weapon explainer guardrail!) plus shared
 * domain cards (`FighterPassivesList`, `WeaponChip`, `ArmedEvolutionRow`,
 * `SkillNodeRow`, `ArcanaCard`) and Adventure's `UPGRADES` table.
 */
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { getUpgrade } from '@/adventure/data/upgrades';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import {
  ArcanaCard,
  ArmedEvolutionRow,
  FighterPassivesList,
  SkillNodeRow,
  WeaponChip,
} from '@/adventure/components/SharedCards';
import { Btn, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import Icon from '@/components/Icon';
import { ASCENSION_DESCRIPTIONS } from '../data/ascensions';
import { getSummitDailyMutator } from '../data/dailyModifiers';
import { getThemePack } from '../data/themePacks';
import { buildSpireWeaponBuilds, spireArmedRecipes, spireHeldWeapons } from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS } from '../engine/runState';
import type { SpireRun } from '../types';

interface Props {
  visible: boolean;
  run: SpireRun;
  onReorderWeapon?: (fromIndex: number, toIndex: number) => void;
  onClose: () => void;
}

const SpireBuildModal: React.FC<Props> = ({ visible, run, onReorderWeapon, onClose }) => {
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
  if (!visible) return null;

  const builds = buildSpireWeaponBuilds(run);
  const weapons = spireHeldWeapons(run);
  const armedIds = spireArmedRecipes(run);
  const armedRecipes = EVOLUTION_RECIPES.filter(r => armedIds.includes(r.id));
  const focusedWeapon = weapons.find(w => w.id === selectedWeaponId) ?? weapons[0] ?? null;
  const focusedIdx = focusedWeapon ? run.weapons.indexOf(focusedWeapon.id) : -1;

  const heavyTier = run.upgrades?.heavy_hitter ?? 0;
  const bonusDmg = heavyTier > 0 ? (getUpgrade('heavy_hitter').bonusDamage?.(heavyTier) ?? heavyTier) : 0;
  const bonusClock = (run.upgrades?.hourglass ?? 0) * 8;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close build inspector" />
        <PopIn style={st.sheet}>
          <View style={st.header}>
            <FighterAvatar character={run.fighter} size={44} health={run.hearts} maxHealth={run.maxHearts} animate={false} framed />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Eyebrow text={`Summit Build · Seed ${run.seed}`} />
              <Text style={st.title} numberOfLines={1}>{run.fighter}</Text>
              <Text style={st.sub}>
                ♥ {run.hearts}/{run.maxHearts} · {run.coins}¢ · +{bonusDmg} dmg · +{bonusClock}s clock
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} accessibilityLabel="Close">
              <Text style={st.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={st.body}>
            {/* Passives */}
            <Text style={st.section}>PASSIVES</Text>
            <FighterPassivesList fighter={run.fighter} />

            {/* Held Weapons (tap to inspect with WeaponExplainer) */}
            <View style={st.sectionRow}>
              <Text style={st.section}>
                {`WEAPONS (${weapons.length}/${MAX_SUMMIT_WEAPONS})`}
              </Text>
              {weapons.length >= MAX_SUMMIT_WEAPONS && (
                <View style={st.fullPill} testID="spire-build-full-badge">
                  <Text style={st.fullPillText}>FULL</Text>
                </View>
              )}
            </View>
            <View style={st.weaponGrid}>
              {weapons.map((w, i) => (
                <WeaponChip
                  key={`${w.id}-${i}`}
                  testID={`spire-build-weapon-${w.id}`}
                  weapon={w}
                  level={builds[w.id]?.level ?? 1}
                  active={focusedWeapon?.id === w.id}
                  onPress={() => setSelectedWeaponId(w.id)}
                />
              ))}
            </View>
            {onReorderWeapon && focusedWeapon && focusedIdx >= 0 && weapons.length > 1 && (
              <View style={st.reorderRow}>
                <Text style={st.reorderLabel}>
                  Slot {focusedIdx + 1}/{weapons.length} · {focusedWeapon.name}
                </Text>
                <View style={st.reorderBtns}>
                  <TouchableOpacity
                    testID="spire-build-move-left"
                    disabled={focusedIdx === 0}
                    onPress={() => onReorderWeapon(focusedIdx, focusedIdx - 1)}
                    style={[st.moveBtn, focusedIdx === 0 && { opacity: 0.35 }]}
                  >
                    <Text style={st.moveBtnText}>◀ Left</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="spire-build-move-right"
                    disabled={focusedIdx === weapons.length - 1}
                    onPress={() => onReorderWeapon(focusedIdx, focusedIdx + 1)}
                    style={[st.moveBtn, focusedIdx === weapons.length - 1 && { opacity: 0.35 }]}
                  >
                    <Text style={st.moveBtnText}>Right ▶</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {focusedWeapon && (
              <WeaponExplainer weapon={focusedWeapon} build={builds[focusedWeapon.id]} defaultOpen hidePowerNote />
            )}

            {/* Armed Evolutions */}
            <Text style={st.section}>ARMED EVOLUTIONS ({armedRecipes.length})</Text>
            {armedRecipes.length === 0 ? (
              <Text style={st.muted}>Draft synergy-badged weapons to arm 30-second Evolution power trips!</Text>
            ) : (
              <View style={st.cardGroup}>
                {armedRecipes.map(r => (
                  <ArmedEvolutionRow key={r.id} recipe={r} showFamily />
                ))}
              </View>
            )}

            {/* Drafted Skill Nodes */}
            {run.skillNodes.length > 0 && (
              <>
                <Text style={st.section}>MASTERED SKILL NODES ({run.skillNodes.length})</Text>
                <View style={st.cardGroup}>
                  {run.skillNodes.map(id => (
                    <SkillNodeRow key={id} nodeId={id} />
                  ))}
                </View>
              </>
            )}

            {/* Equipped Arcana */}
            {run.arcana.length > 0 && (
              <>
                <Text style={st.section}>ARCANA WILDCARDS ({run.arcana.length})</Text>
                <View style={st.cardGroup}>
                  {run.arcana.map(id => (
                    <ArcanaCard key={id} arcanaId={id} />
                  ))}
                </View>
              </>
            )}

            {/* Active Theme Packs (80/20 Focused Draft Pool) */}
            {run.themePacks && run.themePacks.length > 0 && (
              <>
                <Text style={st.section}>FOCUSED DRAFT PACKS (80/20 POOL)</Text>
                <View style={st.packRow} testID="spire-build-theme-packs">
                  {run.themePacks.map(packId => {
                    const pack = getThemePack(packId);
                    return (
                      <View key={pack.id} style={[st.packPill, { borderColor: pack.accentColor }]}>
                        <Icon name={pack.icon} size={13} color={pack.accentColor} />
                        <Text style={st.packPillText}>{pack.name}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Active Daily Mutator */}
            {run.isDaily && run.dailyMutatorId && (
              <>
                <Text style={st.section}>DAILY CLIMB MUTATOR ({run.dailyDate})</Text>
                {(() => {
                  const mut = getSummitDailyMutator(run.dailyMutatorId);
                  return (
                    <View style={[st.dailyMutatorCard, { borderColor: mut.accentColor }]}>
                      <Icon name={mut.icon} size={18} color={mut.accentColor} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.dailyMutatorTitle}>{mut.name}</Text>
                        <Text style={st.dailyMutatorDesc}>{mut.description}</Text>
                      </View>
                    </View>
                  );
                })()}
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  fullPill: { backgroundColor: '#FEF3C7', borderRadius: 4, borderWidth: 1, borderColor: '#D97706', paddingHorizontal: 5, paddingVertical: 1 },
  fullPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6, color: '#92400E' },
  cardGroup: { gap: 6 },
  muted: { fontSize: 12, color: TONE.spent },
  weaponGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#D6CFC4', paddingHorizontal: 8, paddingVertical: 6 },
  reorderLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: INK },
  reorderBtns: { flexDirection: 'row', gap: 6 },
  moveBtn: { backgroundColor: COLORS.canvasWhite, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 4 },
  moveBtnText: { fontSize: 10.5, fontWeight: '900', color: INK },
  packRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  packPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 9, paddingVertical: 4 },
  packPillText: { fontSize: 11, fontWeight: '900', color: INK },
  dailyMutatorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 9, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 7 },
  dailyMutatorTitle: { fontSize: 12, fontWeight: '900', color: INK },
  dailyMutatorDesc: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.85, lineHeight: 15 },
  ascLine: { fontSize: 11, color: INK, opacity: 0.85, lineHeight: 16 },
  footer: { padding: 12, borderTopWidth: 2, borderTopColor: INK, backgroundColor: COLORS.paperBeige },
});

export default SpireBuildModal;
