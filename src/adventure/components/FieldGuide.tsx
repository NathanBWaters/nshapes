/**
 * Field Guide & Evolution Recipe Guide.
 *   Mechanics: every mechanic you've met, in campaign order, plus level hazards.
 *   Fighters:  each fighter's two passives and how skill trees work.
 *   Recipes:   every evolution — the two families that arm it, what it does
 *              for 20 seconds, and whether your current charms arm it.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { sfx } from '@/audio';
import type { AdventureSave, MechanicDef, UnlockableFeature } from '../types';
import { LEVELS } from '../data/levels';
import { FIGHTERS } from '../data/fighters';
import { getPassive } from '../data/passives';
import { MECHANICS } from '../data/mechanics';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { CAMPAIGN_FEATURES } from '../data/features';
import { unlockHint, unlockSource } from '../data/rewards';
import { buildAdaptiveEvolutionMechanic, evolutionsMechanicId } from '../lessons';
import { armedRecipes, isMechanicKnown, recipeFamiliesHeld } from '../progress';
import MechanicIntro from './MechanicIntro';
import { Silhouette } from './rewards';
import { INK, TONE } from './ui';

interface Entry {
  m: MechanicDef;
  where: string;
  known: boolean;
}

const featureEntry = (save: AdventureSave, id: UnlockableFeature): Entry => {
  const feature = CAMPAIGN_FEATURES[id];
  const source = unlockSource({ kind: 'feature', id });
  // "1-8+": from that level on, rather than one of its star rewards
  const where = !source || source.via === 'bounty' ? '' : source.via === 'clear' ? `${source.level.id}+` : source.level.id;
  return { m: MECHANICS[feature.mechanic], where, known: save[feature.saveFlag] };
};

interface Props {
  save: AdventureSave;
  onClose: () => void;
}

type GuideTab = 'mechanics' | 'fighters' | 'recipes';

const TAB_META: Record<GuideTab, { icon: React.ComponentProps<typeof Icon>['name']; title: string }> = {
  mechanics: { icon: 'lorc/open-book', title: 'FIELD GUIDE' },
  fighters: { icon: 'lorc/tree-branch', title: 'FIGHTERS' },
  recipes: { icon: 'lorc/crystal-shine', title: 'RECIPE GUIDE' },
};

const FieldGuide: React.FC<Props> = ({ save, onClose }) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<GuideTab>('mechanics');
  const [open, setOpen] = useState<MechanicDef | null>(null);
  const evoId = evolutionsMechanicId();
  const evoKnown = save.unlockedEvolutions.length > 0 || save.discoveredEvolutions.length > 0;
  const candidates: (Entry | null)[] = [
    ...LEVELS.map(l => ({ m: MECHANICS[l.introduces], where: l.id, known: isMechanicKnown(save, l.introduces) })),
    ...FIGHTERS.map(f => ({ m: MECHANICS[f.signature], where: 'Fighter', known: save.unlockedFighters.includes(f.name) })),
    featureEntry(save, 'coins'),
    featureEntry(save, 'workshop'),
    evoId ? { m: MECHANICS[evoId], where: 'Evolutions', known: evoKnown } : null,
    { m: MECHANICS.arcana_cards, where: 'Arcana', known: save.unlockedArcana.length > 0 },
    featureEntry(save, 'bounties'),
  ];
  // One entry per mechanic (a mechanic can be both taught by a level and listed here); the
  // evolutions entry is written around the player's own first recipe
  const entries: Entry[] = [];
  for (const e of candidates) {
    if (!e?.m || entries.some(x => x.m.id === e.m.id)) continue;
    entries.push(e.m.id === evoId ? { ...e, m: buildAdaptiveEvolutionMechanic(save), known: e.known || evoKnown } : e);
  }
  const known = entries.filter(e => e.known).length;
  const unlockedRecipeCount = new Set([...save.unlockedEvolutions, ...save.discoveredEvolutions]).size;
  const armed = armedRecipes(save);
  const hazardsSeen = {
    timeBombs: LEVELS.some(l => l.rules.hazards?.timeBombs && (save.plays[l.id] ?? 0) > 0),
    snares: LEVELS.some(l => l.rules.hazards?.snares && (save.plays[l.id] ?? 0) > 0),
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity onPress={onClose} style={st.back} accessibilityLabel="Back to map">
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Icon name={TAB_META[tab].icon} size={22} color={INK} />
        <Text style={st.title}>{TAB_META[tab].title}</Text>
        <View style={{ flex: 1 }} />
        <Text style={st.count}>
          {tab === 'mechanics'
            ? `${known}/${entries.length}`
            : tab === 'fighters'
              ? `${save.unlockedFighters.length}/${FIGHTERS.length}`
              : `${unlockedRecipeCount}/${EVOLUTION_RECIPES.length}`}
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
          testID="guide-tab-fighters"
          onPress={() => { sfx('click'); setTab('fighters'); }}
          style={[st.tab, tab === 'fighters' && st.tabOn]}
        >
          <Icon name="lorc/tree-branch" size={16} color={INK} />
          <Text style={st.tabText}>FIGHTERS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="guide-tab-recipes"
          onPress={() => { sfx('click'); setTab('recipes'); }}
          style={[st.tab, tab === 'recipes' && st.tabOn]}
        >
          <Icon name="lorc/crystal-shine" size={16} color={INK} />
          <Text style={st.tabText}>RECIPES ({unlockedRecipeCount}/{EVOLUTION_RECIPES.length})</Text>
        </TouchableOpacity>
      </View>

      {tab === 'mechanics' && (
        <ScrollView contentContainerStyle={[st.grid, { paddingBottom: insets.bottom + 24 }]}>
          {entries.map(({ m, where, known: k }) => (
            <TouchableOpacity key={m.id} disabled={!k} onPress={() => setOpen(m)} style={[st.entry, !k && st.entryLocked]} activeOpacity={0.85}>
              <View style={st.icon}><Icon name={k ? m.icon : 'lorc/uncertainty'} size={28} color={k ? INK : '#A69F95'} /></View>
              <Text style={st.name} numberOfLines={2}>{k ? m.title : '???'}</Text>
              <Text style={st.where}>{where}</Text>
            </TouchableOpacity>
          ))}
          <View style={[st.howCard, { width: '100%' }]} testID="guide-hazards">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="lorc/wolf-trap" size={20} color={TONE.tradeoff} />
              <Text style={st.howTitle}>Hazards</Text>
            </View>
            <Text style={st.howBody}>
              {hazardsSeen.timeBombs
                ? 'Time Bomb: a card with a fuse counts down. Match it before it reaches 0, or lose a heart and the card is replaced.'
                : 'Time Bomb: ??? (met in World 1)'}
            </Text>
            <Text style={st.howBody}>
              {hazardsSeen.snares
                ? 'Snare: an arrow in the corner points at a neighbour. Matching the snared card costs a heart; matching the card it points at defuses it for +4 damage.'
                : 'Snare: ??? (met in World 2)'}
            </Text>
          </View>
        </ScrollView>
      )}

      {tab === 'fighters' && (
        <ScrollView contentContainerStyle={[st.recipesWrap, { paddingBottom: insets.bottom + 24 }]}>
          <View style={st.howCard} testID="guide-skill-trees">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="lorc/tree-branch" size={20} color={TONE.combo} />
              <Text style={st.howTitle}>Passives & Skill Trees</Text>
            </View>
            <Text style={st.howBody}>
              Every fighter plays by two passives that are always on. Each passive grows a branch of 10 skill nodes.{'\n'}
              Spend stars on nodes at Camp. Stars come from one shared pool, and spending never re-locks a world.{'\n'}
              A node needs the one above it. Refunding a whole branch is free, any time.
            </Text>
          </View>
          {FIGHTERS.map(f => {
            const met = save.unlockedFighters.includes(f.name);
            return (
              <View key={f.name} style={[st.recipeCard, met && st.recipeCardDiscovered]} testID={`guide-fighter-${f.name}`}>
                <View style={st.recipeHead}>
                  <View style={st.recipeAvatar}>
                    {met ? <Icon name={f.icon} size={30} color={INK} /> : <Silhouette icon={f.icon} size={22} light />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.recipeName}>{met ? f.name : '??? Fighter'}</Text>
                    <Text style={st.recipeBadge}>{met ? f.blurb : unlockHint({ kind: 'fighter', id: f.name }) ?? ''}</Text>
                  </View>
                </View>
                {met && f.passives.map(id => {
                  const p = getPassive(id);
                  return (
                    <View key={id} style={st.reqRow}>
                      <Icon name={p.icon} size={16} color={INK} />
                      <Text style={st.reqText}><Text style={{ fontWeight: '900' }}>{p.name}: </Text>{p.text}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      {tab === 'recipes' && (
        <ScrollView contentContainerStyle={[st.recipesWrap, { paddingBottom: insets.bottom + 24 }]}>
          <View style={st.howCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="lorc/crystal-shine" size={20} color={TONE.combo} />
              <Text style={st.howTitle}>How Evolutions Work</Text>
            </View>
            <Text style={st.howBody}>
              1. Unlock a recipe in the campaign. It is ARMED in any fight where your charms (or picks and buys) hold both of its weapon families.{'\n'}
              2. While a recipe is armed, refills can bring an Evolution Catalyst card. The Evolution Lab and some weapons make it more likely.{'\n'}
              3. Match the Catalyst in any Set: the evolution runs for 20 seconds, with its own rules and +1 damage on every Set. Up to 3 per fight.
            </Text>
          </View>

          {EVOLUTION_RECIPES.map(r => {
            const forged = save.discoveredEvolutions.includes(r.id);
            const unlocked = forged || save.unlockedEvolutions.includes(r.id);
            const isArmed = armed.some(a => a.id === r.id);
            const held = recipeFamiliesHeld(save, r);
            return (
              <View
                key={r.id}
                testID={`recipe-${r.id}`}
                style={[st.recipeCard, unlocked && st.recipeCardDiscovered]}
              >
                <View style={st.recipeHead}>
                  <View style={[st.recipeAvatar, forged && { borderColor: '#FFD700', backgroundColor: '#FFFBEB' }, !forged && unlocked && { borderColor: TONE.combo, backgroundColor: TONE.comboPale }]}>
                    {unlocked ? (
                      <Icon name={r.icon} size={30} color={INK} />
                    ) : (
                      <Silhouette icon={r.icon} size={24} light />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={st.recipeName}>{unlocked ? r.name : '??? Evolution'}</Text>
                    <Text style={[st.recipeBadge, { color: isArmed ? TONE.upside : forged ? TONE.tradeoff : unlocked ? TONE.combo : '#6B7280' }]}>
                      {!unlocked ? 'LOCKED' : [isArmed ? 'ARMED BY YOUR CHARMS' : forged ? null : 'UNLOCKED', forged ? 'EVOLVED BEFORE' : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>

                {unlocked ? (
                  <>
                    <Text style={st.recipeDesc}>{r.activeText}</Text>
                    {forged && <Text style={st.recipeHint}>“{r.flavor}”</Text>}
                    <View style={st.recipeReqs}>
                      <View style={st.reqRow}>
                        <Icon name="lorc/gems" size={14} color={INK} />
                        <Text style={st.reqText}>
                          <Text style={{ fontWeight: '900' }}>Families: </Text>{r.familyText}
                          {!isArmed && (held[0] || held[1]) ? '  (one equipped)' : ''}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={st.recipeReqs}>
                    <View style={st.reqRow}>
                      <Icon name="lorc/padlock" size={14} color="#6B7280" />
                      <Text style={st.reqText}><Text style={{ fontWeight: '900' }}>Unlock: </Text>{unlockHint({ kind: 'evolution', id: r.id })}</Text>
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
  tabText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: INK },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12, justifyContent: 'center', maxWidth: 620, alignSelf: 'center' },
  entry: { width: 104, alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, padding: 8 },
  entryLocked: { borderColor: TONE.spentEdge, backgroundColor: '#EFEAE2' },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12, fontWeight: '800', color: INK, textAlign: 'center' },
  where: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.6 },
  recipesWrap: { padding: 12, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  howCard: { backgroundColor: TONE.comboPale, borderRadius: 10, borderWidth: 2, borderColor: INK, padding: 12, gap: 6 },
  howTitle: { fontWeight: '900', fontSize: 14, color: INK },
  howBody: { fontSize: 12, lineHeight: 18, color: INK },
  recipeCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: '#B8B0A4', padding: 12, gap: 8 },
  recipeCardDiscovered: { borderColor: INK, backgroundColor: '#FFFDF7' },
  recipeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recipeAvatar: { width: 54, height: 54, borderRadius: 12, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  recipeName: { fontWeight: '900', fontSize: 16, color: INK },
  recipeBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  recipeDesc: { fontSize: 13, color: INK, fontWeight: '700' },
  recipeHint: { fontSize: 12, color: INK, fontStyle: 'italic', opacity: 0.85 },
  recipeReqs: { backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8, gap: 4 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { flex: 1, fontSize: 12, color: INK },
});

export default FieldGuide;
