/**
 * Field Guide & Evolution Recipe Guide.
 *   Mechanics: every mechanic you've met, in campaign order.
 *   Recipes:   all 8 Weapon Evolutions — discovered ones in full detail,
 *              undiscovered ones with recipe & catalyst hints.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS, getRarityColor } from '@/utils/colors';
import { sfx } from '@/audio';
import type { AdventureSave, MechanicDef } from '../types';
import { LEVELS } from '../data/levels';
import { FIGHTERS } from '../data/fighters';
import { MECHANICS, buildAdaptiveEvolutionMechanic } from '../data/mechanics';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import MechanicIntro from './MechanicIntro';
import { Silhouette } from './UnlockReveal';
import { INK } from './ui';

interface Props {
  save: AdventureSave;
  onClose: () => void;
}

const FieldGuide: React.FC<Props> = ({ save, onClose }) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'mechanics' | 'recipes'>('mechanics');
  const [open, setOpen] = useState<MechanicDef | null>(null);
  const entries: Array<{ m: MechanicDef; where: string; known: boolean }> = [
    ...LEVELS.map(l => ({ m: MECHANICS[l.introduces], where: l.id, known: save.seenMechanics.includes(l.introduces) || (save.stars[l.id] ?? 0) > 0 })),
    ...FIGHTERS.map(f => ({ m: MECHANICS[f.signature], where: 'Fighter', known: save.unlockedFighters.includes(f.name) })),
    { m: MECHANICS.coins, where: '1-1', known: save.coinsUnlocked },
    { m: MECHANICS.workshop, where: '1-4', known: save.workshopUnlocked },
    { m: buildAdaptiveEvolutionMechanic(save), where: 'Combos', known: save.unlockedEvolutions.length > 0 || save.discoveredEvolutions.length > 0 },
    { m: MECHANICS.arcana_cards, where: 'Arcana', known: save.unlockedArcana.length > 0 },
    { m: MECHANICS.bounty_board, where: '1-8+', known: save.bountiesUnlocked },
  ];
  const known = entries.filter(e => e.known).length;
  const unlockedRecipeCount = new Set([...save.unlockedEvolutions, ...save.discoveredEvolutions]).size;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity onPress={onClose} style={st.back} accessibilityLabel="Back to map">
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Icon name={tab === 'mechanics' ? 'lorc/open-book' : 'lorc/crystal-shine'} size={22} color={INK} />
        <Text style={st.title}>{tab === 'mechanics' ? 'FIELD GUIDE' : 'RECIPE GUIDE'}</Text>
        <View style={{ flex: 1 }} />
        <Text style={st.count}>
          {tab === 'mechanics' ? `${known}/${entries.length}` : `${unlockedRecipeCount}/${EVOLUTION_RECIPES.length}`}
        </Text>
      </View>

      <View style={st.tabs}>
        <TouchableOpacity
          testID="guide-tab-mechanics"
          onPress={() => { sfx('click'); setTab('mechanics'); }}
          style={[st.tab, tab === 'mechanics' && st.tabOn]}
        >
          <Icon name="lorc/open-book" size={16} color={INK} />
          <Text style={st.tabText}>MECHANICS ({known}/{entries.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="guide-tab-recipes"
          onPress={() => { sfx('click'); setTab('recipes'); }}
          style={[st.tab, tab === 'recipes' && st.tabOn]}
        >
          <Icon name="lorc/crystal-shine" size={16} color={INK} />
          <Text style={st.tabText}>RECIPE GUIDE ({unlockedRecipeCount}/{EVOLUTION_RECIPES.length})</Text>
        </TouchableOpacity>
      </View>

      {tab === 'mechanics' ? (
        <ScrollView contentContainerStyle={[st.grid, { paddingBottom: insets.bottom + 24 }]}>
          {entries.map(({ m, where, known: k }) => (
            <TouchableOpacity key={m.id} disabled={!k} onPress={() => setOpen(m)} style={[st.entry, !k && st.entryLocked]} activeOpacity={0.85}>
              <View style={st.icon}><Icon name={k ? m.icon : 'lorc/uncertainty'} size={28} color={k ? INK : '#A69F95'} /></View>
              <Text style={st.name} numberOfLines={2}>{k ? m.title : '???'}</Text>
              <Text style={st.where}>{where}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[st.recipesWrap, { paddingBottom: insets.bottom + 24 }]}>
          <View style={st.howCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="lorc/crystal-shine" size={20} color="#7C3AED" />
              <Text style={st.howTitle}>How Weapon Combos Work</Text>
            </View>
            <Text style={st.howBody}>
              1. Unlock a Weapon Combo recipe in the campaign, then bring its required weapons into a fight.{'\n'}
              2. At most ONE card on screen hides a Catalyst crystal behind its shapes.{'\n'}
              3. Wait until the Catalyst badge turns gold (EVO), then match a Set with it! Matching a Catalyst card before you are ready shatters it!
            </Text>
          </View>

          {EVOLUTION_RECIPES.map(r => {
            const forged = save.discoveredEvolutions.includes(r.id);
            const unlocked = forged || save.unlockedEvolutions.includes(r.id);
            return (
              <View
                key={r.id}
                testID={`recipe-${r.id}`}
                style={[st.recipeCard, unlocked && st.recipeCardDiscovered]}
              >
                <View style={st.recipeHead}>
                  <View style={[st.recipeAvatar, forged && { borderColor: getRarityColor('legendary'), backgroundColor: '#FFFBEB' }, !forged && unlocked && { borderColor: '#7C3AED', backgroundColor: '#F5F3FF' }]}>
                    {unlocked ? (
                      <WeaponAvatar weapon={r.result} size={42} interactive />
                    ) : (
                      <Silhouette icon={r.result.icon ?? 'lorc/crystal-shine'} size={24} light />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={st.recipeName}>{unlocked ? r.result.name : '??? Weapon Combo'}</Text>
                    <Text style={[st.recipeBadge, { color: forged ? '#B45309' : unlocked ? '#7C3AED' : '#6B7280' }]}>
                      {forged ? 'FORGED COMBO' : unlocked ? 'UNLOCKED RECIPE · READY TO FORGE' : 'LOCKED COMBO'}
                    </Text>
                  </View>
                </View>

                {forged ? (
                  <>
                    <Text style={st.recipeDesc}>{r.result.description}</Text>
                    <Text style={st.recipeBurst}>Evolution Burst: {r.burstText}</Text>
                  </>
                ) : unlocked ? (
                  <Text style={st.recipeDesc}>{r.result.description}</Text>
                ) : (
                  <Text style={st.recipeHint}>“{r.mysteryHint}”</Text>
                )}

                {unlocked ? (
                  <View style={st.recipeReqs}>
                    <View style={st.reqRow}>
                      <Icon name="lorc/gems" size={14} color={INK} />
                      <Text style={st.reqText}><Text style={{ fontWeight: '900' }}>Weapons: </Text>{r.gearRequirementText}</Text>
                    </View>
                    <View style={st.reqRow}>
                      <Icon name="lorc/crystal-shine" size={14} color="#7C3AED" />
                      <Text style={st.reqText}><Text style={{ fontWeight: '900' }}>Awaken: </Text>{r.primeRequirementText} + match Catalyst card</Text>
                    </View>
                  </View>
                ) : (
                  <View style={st.recipeReqs}>
                    <View style={st.reqRow}>
                      <Icon name="lorc/padlock" size={14} color="#6B7280" />
                      <Text style={st.reqText}><Text style={{ fontWeight: '900' }}>Unlock: </Text>{r.unlockHint}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
      <MechanicIntro mechanic={open} onClose={() => setOpen(null)} cta="Close" quiz={false} dismissible />
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paperBeige },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 16 },
  count: { fontWeight: '900', color: INK },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10, maxWidth: 620, width: '100%', alignSelf: 'center' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#B8B0A4', backgroundColor: COLORS.canvasWhite },
  tabOn: { backgroundColor: COLORS.actionYellow, borderColor: INK, borderBottomWidth: 4 },
  tabText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: INK },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12, justifyContent: 'center', maxWidth: 620, alignSelf: 'center' },
  entry: { width: 104, alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, padding: 8 },
  entryLocked: { borderColor: '#CFC8BD', backgroundColor: '#EFEAE2' },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12, fontWeight: '800', color: INK, textAlign: 'center' },
  where: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.6 },
  recipesWrap: { padding: 12, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  howCard: { backgroundColor: '#F5F3FF', borderRadius: 10, borderWidth: 2, borderColor: INK, padding: 12, gap: 6 },
  howTitle: { fontWeight: '900', fontSize: 14, color: INK },
  howBody: { fontSize: 12, lineHeight: 18, color: INK },
  recipeCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: '#B8B0A4', padding: 12, gap: 8 },
  recipeCardDiscovered: { borderColor: INK, backgroundColor: '#FFFDF7' },
  recipeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recipeAvatar: { width: 54, height: 54, borderRadius: 12, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  recipeName: { fontWeight: '900', fontSize: 16, color: INK },
  recipeBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  recipeDesc: { fontSize: 13, color: INK, fontWeight: '700' },
  recipeBurst: { fontSize: 12, color: '#0F766E', fontWeight: '800' },
  recipeHint: { fontSize: 12, color: INK, fontStyle: 'italic', opacity: 0.85 },
  recipeReqs: { backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8, gap: 4 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { flex: 1, fontSize: 12, color: INK },
});

export default FieldGuide;
