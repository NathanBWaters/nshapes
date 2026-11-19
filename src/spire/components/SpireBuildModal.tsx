/**
 * Starfall Spire Build Inspector Modal.
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

  const builds = buildSpireWeaponBuilds(run);
  const weapons = spireHeldWeapons(run);
  const armedIds = spireArmedRecipes(run);
  const armedRecipes = EVOLUTION_RECIPES.filter(r => armedIds.includes(r.id));
  const focusedWeapon = weapons.find(w => w.id === selectedWeaponId) ?? weapons[0] ?? null;

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
              <Eyebrow text={`Spire Build · Seed ${run.seed}`} />
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
            <Text style={st.section}>WEAPONS ({weapons.length} · UNCAPPED)</Text>
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
  muted: { fontSize: 12, color: TONE.spent },
  weaponGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ascLine: { fontSize: 11, color: INK, opacity: 0.85, lineHeight: 16 },
  footer: { padding: 12, borderTopWidth: 2, borderTopColor: INK, backgroundColor: COLORS.paperBeige },
});

export default SpireBuildModal;
