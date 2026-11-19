/**
 * Starfall Spire — Pre-Battle Encounter Briefing.
 *
 * Reuses `ParryPreviewCard` (showing the foe's Counter-Set UP FRONT before the
 * fight begins!), `FoeAbilityCard`, `HazardNotices`, `ShadingSurgeNotice`,
 * `spireEncounterLoadout` (via Adventure's `startingLoadout`), `EnemyAvatar`,
 * `Skulls`, `Heart`, and shared `ui.tsx`.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { COLORS } from '@/utils/colors';
import { getBiome } from '@/adventure/data/biomes';
import { foeDisplay } from '@/adventure/data/foes';
import ParryPreviewCard from '@/adventure/components/ParryPreviewCard';
import { FoeAbilityCard, HazardNotices, ShadingSurgeNotice } from '@/adventure/components/SharedCards';
import { Btn, CoinPill, Eyebrow, Heart, INK, PopIn, Skulls, TONE } from '@/adventure/components/ui';
import { spireEncounterLoadout } from '../engine/bridge';
import type { SpireEncounter, SpireRun } from '../types';

interface Props {
  run: SpireRun;
  encounter: SpireEncounter;
  onFight: () => void;
  onInspectBuild: () => void;
}

const SpireEncounterPreview: React.FC<Props> = ({ run, encounter, onFight, onInspectBuild }) => {
  const biome = getBiome(encounter.biome);
  const foeDef = encounter.foes[0];
  const foe = foeDisplay(foeDef);
  const loadout = spireEncounterLoadout(run, encounter);
  const armed = loadout.armedRecipes.length;
  const totalClock = loadout.timer ?? encounter.timer;
  const isBoss = encounter.kind === 'boss';
  const isElite = encounter.kind === 'elite';

  return (
    <View style={[st.root, { backgroundColor: biome.colors.sky }]} testID="spire-encounter-preview">
      <ScrollView contentContainerStyle={st.body}>
        <PopIn style={st.card}>
          <View style={[st.header, { backgroundColor: isBoss ? '#FEF3C7' : isElite ? '#FEE2E2' : COLORS.paperBeige }]}>
            <View style={st.headerTop}>
              <Eyebrow
                text={isBoss ? `ACT ${run.act} BOSS` : isElite ? 'ELITE ENCOUNTER' : `FLOOR ${run.floor} BATTLE`}
                color={isBoss ? COLORS.actionYellow : isElite ? '#FCA5A5' : '#D4F4EE'}
              />
              <Skulls n={encounter.difficulty} />
            </View>
            <View style={st.foeRow}>
              <View style={[st.portrait, isBoss && st.portraitBoss, isElite && st.portraitElite]}>
                <EnemyAvatar
                  enemy={foe}
                  size={isBoss ? 78 : 66}
                  mood={isBoss ? 'enraged' : 'menacing'}
                  reaction={{ type: 'entrance', id: 1 }}
                  interactive
                />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={st.foeName}>{foe.name}</Text>
                <Text style={st.hpLine}>{foeDef.hp.toLocaleString()} HP · {totalClock}s clock</Text>
                <View style={st.metaChips}>
                  <View style={st.metaChip}>
                    <Heart size={13} />
                    <Text style={st.metaChipText}>{run.hearts}/{run.maxHearts}</Text>
                  </View>
                  <View style={st.metaChip}>
                    <Icon name="lorc/gems" size={13} color={TONE.evoReady} />
                    <Text style={st.metaChipText}>{armed} evo{armed === 1 ? '' : 's'} armed</Text>
                  </View>
                </View>
              </View>
            </View>
            {foeDef.taunt && (
              <View style={st.tauntBox}>
                <Text style={st.tauntText}>“{foeDef.taunt}”</Text>
              </View>
            )}
          </View>

          <View style={st.content}>
            <FoeAbilityCard foe={foe} showAvatar={false} />

            {/* Shared Set-Parry Pre-Battle Briefing */}
            <ParryPreviewCard spec={encounter.parry} testID="spire-preview-parry" />

            {encounter.shadingSurge && <ShadingSurgeNotice />}

            {encounter.hazards && <HazardNotices hazards={encounter.hazards} testID="spire-preview-hazards" />}

            {/* Loot Preview */}
            <View style={st.lootRow}>
              <Text style={st.lootLabel}>VICTORY LOOT</Text>
              <View style={st.lootPills}>
                <CoinPill coins={encounter.coinReward} />
                <View style={st.lootPill}>
                  <Icon name="lorc/gems" size={13} color={INK} />
                  <Text style={st.lootPillText}>{isBoss ? 'Lv 2 Weapon Draft' : 'Weapon Draft'}</Text>
                </View>
                {(isElite || isBoss) && (
                  <View style={[st.lootPill, { backgroundColor: TONE.coinPale, borderColor: INK }]}>
                    <Icon name="lorc/crystal-wand" size={13} color={TONE.upside} />
                    <Text style={[st.lootPillText, { color: INK }]}>Arcana + Skill Node</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={st.actions}>
              <Btn testID="spire-enter-fight" label="FIGHT!" icon="lorc/crossed-swords" onPress={onFight} />
              <Btn small variant="secondary" label="Inspect My Build" icon="lorc/gems" onPress={onInspectBuild} />
            </View>
          </View>
        </PopIn>
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 14, alignItems: 'center', paddingBottom: 28 },
  card: { width: '100%', maxWidth: 480, backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, overflow: 'hidden' },
  header: { padding: 12, gap: 8, borderBottomWidth: 2, borderBottomColor: INK },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  foeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  portrait: { width: 78, height: 78, borderRadius: 12, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  portraitBoss: { width: 88, height: 88, backgroundColor: '#FFFBEB', borderColor: '#B45309', borderWidth: 3 },
  portraitElite: { backgroundColor: '#FEF2F2', borderColor: '#991B1B', borderWidth: 2.5 },
  foeName: { fontSize: 20, fontWeight: '900', color: INK },
  hpLine: { fontSize: 13, fontWeight: '800', color: '#991B1B', fontVariant: ['tabular-nums'] },
  metaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 2 },
  metaChipText: { fontSize: 11, fontWeight: '800', color: INK },
  tauntBox: { backgroundColor: COLORS.canvasWhite, borderRadius: 8, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 10, paddingVertical: 6 },
  tauntText: { fontSize: 12, fontStyle: 'italic', fontWeight: '700', color: INK },
  content: { padding: 12, gap: 10 },
  lootRow: { backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 1.5, borderColor: '#D6CFC4', padding: 10, gap: 6 },
  lootLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  lootPills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  lootPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 4 },
  lootPillText: { fontSize: 11, fontWeight: '800', color: INK },
  actions: { gap: 8, marginTop: 4 },
});

export default SpireEncounterPreview;
