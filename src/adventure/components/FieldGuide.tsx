/**
 * Field Guide & Per-Weapon Evolution Codex.
 *   Rules:      every mechanic you've met, in campaign order, plus level hazards.
 *   Fighters:   each fighter's two passives and how skill trees work.
 *   Evolutions: all 192 per-weapon timed evolutions (64 Armory weapons × 3),
 *               searchable & filterable by Unlocked / Triggered / Locked.
 *   Critters:   discovered fighters and defeated foes.
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { useColorblind } from '@/utils/cardColors';
import { COLORS } from '@/utils/colors';
import { sfx } from '@/audio';
import type { AdventureSave, MechanicDef, UnlockableFeature } from '../types';
import { ALL_ARMORY_WEAPON_IDS, armoryBaseWeapon } from '../data/armory';
import { LEVELS, PRACTICE_LEVELS, isPathHidden } from '../data/levels';
import { FIGHTERS } from '../data/fighters';
import { getPassive } from '../data/passives';
import { MECHANICS } from '../data/mechanics';
import { EVOLUTION_COUNT, evolutionsForWeapon } from '../data/evolutions';
import { CAMPAIGN_FEATURES } from '../data/features';
import { unlockHint, unlockSource } from '../data/rewards';
import { buildAdaptiveEvolutionMechanic, evolutionsMechanicId } from '../lessons';
import { equippedEvolutionOf, isMechanicKnown } from '../progress';
import { buildWeaponEvolutionVM, type WeaponEvolutionVM } from '../ui/evolutionViewModel';
import CritterGallery, { collectGalleryFoes } from './CritterGallery';
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
  const where = !source || source.via === 'bounty' ? '' : source.via === 'clear' ? `${source.level.id}+` : source.level.id;
  return { m: MECHANICS[feature.mechanic], where, known: save[feature.saveFlag] };
};

interface Props {
  save: AdventureSave;
  onClose: () => void;
  /** Launch 1-1 (First Light) with guided hints to review how Sets work */
  onReplayWalkthrough?: () => void;
}

type GuideTab = 'mechanics' | 'fighters' | 'evolutions' | 'critters';
type EvoFilter = 'all' | 'unlocked' | 'discovered' | 'locked';

const TAB_META: Record<GuideTab, { icon: React.ComponentProps<typeof Icon>['name']; title: string }> = {
  mechanics: { icon: 'lorc/open-book', title: 'FIELD GUIDE' },
  fighters: { icon: 'lorc/tree-branch', title: 'FIGHTERS' },
  evolutions: { icon: 'lorc/crystal-shine', title: 'EVOLUTIONS' },
  critters: { icon: 'lorc/cat', title: 'CRITTER GALLERY' },
};

interface WeaponEvoGroup {
  weaponId: string;
  weaponName: string;
  ownedWeapon: boolean;
  equippedEvoId: string | null;
  unlockedCount: number;
  items: {
    vm: WeaponEvolutionVM;
    unlocked: boolean;
    discovered: boolean;
    equipped: boolean;
  }[];
}

const FieldGuide: React.FC<Props> = ({ save, onClose, onReplayWalkthrough }) => {
  const insets = useSafeAreaInsets();
  const colorblind = useColorblind();
  const [tab, setTab] = useState<GuideTab>('mechanics');
  const [open, setOpen] = useState<MechanicDef | null>(null);
  const [evoQuery, setEvoQuery] = useState('');
  const [evoFilter, setEvoFilter] = useState<EvoFilter>('all');

  const evoId = evolutionsMechanicId();
  const unlockedEvoSet = useMemo(() => new Set(save.unlockedWeaponEvolutions ?? []), [save.unlockedWeaponEvolutions]);
  const discoveredEvoSet = useMemo(() => new Set(save.discoveredEvolutions ?? []), [save.discoveredEvolutions]);
  const ownedWeaponSet = useMemo(() => new Set(save.armory ?? []), [save.armory]);
  const evoKnown = unlockedEvoSet.size > 0 || discoveredEvoSet.size > 0;
  const labTier = save.upgrades?.evolution_lab ?? 0;

  const candidates: (Entry | null)[] = [
    ...LEVELS.map(l => ({
      m: MECHANICS[l.introduces],
      where: isPathHidden(l, save) ? 'Secret path' : l.id,
      known: isMechanicKnown(save, l.introduces),
    })),
    ...PRACTICE_LEVELS.filter(l => isMechanicKnown(save, l.introduces)).map(l => ({
      m: MECHANICS[l.introduces],
      where: 'Practice',
      known: true,
    })),
    ...FIGHTERS.map(f => ({
      m: MECHANICS[f.signature],
      where: 'Fighter',
      known: save.unlockedFighters.includes(f.name),
    })),
    featureEntry(save, 'coins'),
    featureEntry(save, 'workshop'),
    evoId ? { m: MECHANICS[evoId], where: 'Evolutions', known: evoKnown } : null,
    { m: MECHANICS.arcana_cards, where: 'Arcana', known: save.unlockedArcana.length > 0 },
    featureEntry(save, 'bounties'),
  ];

  const entries: Entry[] = [];
  for (const e of candidates) {
    if (!e?.m || entries.some(x => x.m.id === e.m.id)) continue;
    entries.push(e.m.id === evoId ? { ...e, m: buildAdaptiveEvolutionMechanic(save), known: e.known || evoKnown } : e);
  }
  const known = entries.filter(e => e.known).length;
  const unlockedEvoCount = unlockedEvoSet.size;
  const discoveredEvoCount = discoveredEvoSet.size;
  const galleryFoes = collectGalleryFoes(save);
  const discoveredCritters = save.unlockedFighters.length + galleryFoes.filter(f => f.defeated).length;
  const totalCritters = FIGHTERS.length + galleryFoes.length;
  const hazardsSeen = {
    timeBombs: LEVELS.some(l => l.rules.hazards?.timeBombs && (save.plays[l.id] ?? 0) > 0),
    snares: LEVELS.some(l => l.rules.hazards?.snares && (save.plays[l.id] ?? 0) > 0),
  };

  const evoGroups = useMemo<WeaponEvoGroup[]>(() => {
    const q = evoQuery.trim().toLowerCase();
    const out: WeaponEvoGroup[] = [];
    for (const weaponId of ALL_ARMORY_WEAPON_IDS) {
      const w = armoryBaseWeapon(weaponId);
      if (!w) continue;
      const defs = evolutionsForWeapon(weaponId);
      if (defs.length === 0) continue;
      const equippedId = equippedEvolutionOf(save, weaponId);
      let unlockedInWeapon = 0;
      const items = defs
        .map(d => {
          const unlocked = unlockedEvoSet.has(d.id);
          const discovered = discoveredEvoSet.has(d.id);
          if (unlocked) unlockedInWeapon++;
          const vm = buildWeaponEvolutionVM(d, { colorblind, save, labTier });
          return { vm, unlocked, discovered, equipped: equippedId === d.id };
        })
        .filter(item => {
          if (evoFilter === 'unlocked' && !item.unlocked) return false;
          if (evoFilter === 'discovered' && !item.discovered) return false;
          if (evoFilter === 'locked' && item.unlocked) return false;
          if (q.length > 0) {
            const hay = `${w.name} ${item.vm.name} ${item.vm.conditionFull} ${item.vm.effectText} ${item.vm.unlockBountyTitle ?? ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
      if (items.length === 0) continue;
      out.push({
        weaponId,
        weaponName: w.name,
        ownedWeapon: ownedWeaponSet.has(weaponId),
        equippedEvoId: equippedId,
        unlockedCount: unlockedInWeapon,
        items,
      });
    }
    // Owned weapons with unlocked evolutions rise to the top for instant relevance
    return out.sort((a, b) => {
      if (a.unlockedCount !== b.unlockedCount) return b.unlockedCount - a.unlockedCount;
      if (a.ownedWeapon !== b.ownedWeapon) return a.ownedWeapon ? -1 : 1;
      return a.weaponName.localeCompare(b.weaponName);
    });
  }, [evoQuery, evoFilter, save, unlockedEvoSet, discoveredEvoSet, ownedWeaponSet, colorblind, labTier]);

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity onPress={onClose} style={st.back} accessibilityLabel="Back to map">
          <Icon name="ui/back-arrow" size={20} color={INK} noShadow />
        </TouchableOpacity>
        <Icon name={TAB_META[tab].icon} size={22} color={INK} />
        <Text style={st.title} numberOfLines={1}>{TAB_META[tab].title}</Text>
        <View style={{ flex: 1 }} />
        <Text style={st.count}>
          {tab === 'mechanics'
            ? `${known}/${entries.length}`
            : tab === 'fighters'
              ? `${save.unlockedFighters.length}/${FIGHTERS.length}`
              : tab === 'critters'
                ? `${discoveredCritters}/${totalCritters}`
                : `${unlockedEvoCount}/${EVOLUTION_COUNT}`}
        </Text>
      </View>

      <View style={st.tabs}>
        <TouchableOpacity
          testID="guide-tab-mechanics"
          onPress={() => { sfx('click'); setTab('mechanics'); }}
          style={[st.tab, tab === 'mechanics' && st.tabOn]}
        >
          <Icon name="lorc/open-book" size={14} color={INK} />
          <Text style={st.tabText} numberOfLines={1}>RULES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="guide-tab-fighters"
          onPress={() => { sfx('click'); setTab('fighters'); }}
          style={[st.tab, tab === 'fighters' && st.tabOn]}
        >
          <Icon name="lorc/tree-branch" size={14} color={INK} />
          <Text style={st.tabText} numberOfLines={1}>FIGHTERS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="guide-tab-evolutions"
          onPress={() => { sfx('click'); setTab('evolutions'); }}
          style={[st.tab, tab === 'evolutions' && st.tabOn]}
        >
          <Icon name="lorc/crystal-shine" size={14} color={INK} />
          <Text style={st.tabText} numberOfLines={1}>EVOS ({unlockedEvoCount}/{EVOLUTION_COUNT})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="guide-tab-critters"
          onPress={() => { sfx('click'); setTab('critters'); }}
          style={[st.tab, tab === 'critters' && st.tabOn]}
        >
          <Icon name="lorc/cat" size={14} color={INK} />
          <Text style={st.tabText} numberOfLines={1}>CRITTERS</Text>
        </TouchableOpacity>
      </View>

      {tab === 'mechanics' && (
        <ScrollView contentContainerStyle={[st.grid, { paddingBottom: insets.bottom + 24 }]}>
          {onReplayWalkthrough && (
            <TouchableOpacity
              testID="guide-replay-walkthrough"
              accessibilityRole="button"
              accessibilityLabel="Replay 1-1 Walkthrough"
              onPress={() => {
                sfx('confirm');
                onReplayWalkthrough();
              }}
              style={st.walkthroughCard}
              activeOpacity={0.85}
            >
              <View style={st.walkthroughIcon}>
                <Icon name="lorc/crossed-swords" size={22} color={INK} />
              </View>
              <View style={st.walkthroughTextWrap}>
                <Text style={st.walkthroughTitle}>Replay 1-1 Walkthrough</Text>
                <Text style={st.walkthroughSub}>
                  Play First Light (2 traits, 9 cards, live guided hints) to review the Set rule.
                </Text>
              </View>
            </TouchableOpacity>
          )}
          {entries.map(({ m, where, known: k }) => (
            <TouchableOpacity
              key={m.id}
              disabled={!k}
              onPress={() => setOpen(m)}
              style={[st.entry, !k && st.entryLocked]}
              activeOpacity={0.85}
            >
              <View style={st.icon}>
                <Icon name={k ? m.icon : 'lorc/uncertainty'} size={28} color={k ? INK : '#A69F95'} />
              </View>
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
                ? 'Snare: an arrow in the corner points at a neighbour. Matching the snared card costs a heart; matching the card it points at defuses it for +8 base damage.'
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
              <Text style={st.howTitle}>Passives &amp; Skill Trees</Text>
            </View>
            <Text style={st.howBody}>
              Every fighter plays by two passives that are always on. Their skill tree is a web that grows out from both passives.{'\n'}
              Spend stars on nodes at Camp. Every fighter can spend every star you have earned, so you can grow all of them at once. Spending never re-locks a world.{'\n'}
              A node opens once something it links to is owned. Refunds are free, any time.
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
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.recipeName}>{met ? f.name : '??? Fighter'}</Text>
                    <Text style={st.recipeBadge}>{met ? f.blurb : unlockHint({ kind: 'fighter', id: f.name }, save) ?? ''}</Text>
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

      {tab === 'evolutions' && (
        <FlatList
          data={evoGroups}
          keyExtractor={g => g.weaponId}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          contentContainerStyle={[st.recipesWrap, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            <View style={{ gap: 10 }}>
              <View style={st.howCard} testID="guide-evolutions-how">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="lorc/crystal-shine" size={20} color={TONE.combo} />
                  <Text style={st.howTitle}>Per-Weapon Timed Evolutions ({EVOLUTION_COUNT})</Text>
                </View>
                <Text style={st.howBody}>
                  1. Every Armory weapon has 3 bespoke Evolutions unlocked via Weapon Bounties ({unlockedEvoCount}/{EVOLUTION_COUNT} unlocked · {discoveredEvoCount} triggered).{'\n'}
                  2. Equip 1 Evolution per weapon in the Armory or Level Preview.{'\n'}
                  3. Hit that weapon’s in-fight trigger to ignite: +18 burst damage, +8 Set base damage, +0.2× mult, and bespoke powers for 15–28s — re-triggerable after a 3s cooldown!
                </Text>
              </View>

              <View style={st.filterCard}>
                <View style={st.searchRow}>
                  <Icon name="lorc/magnifying-glass" size={14} color={INK} />
                  <TextInput
                    testID="guide-evo-search"
                    value={evoQuery}
                    onChangeText={setEvoQuery}
                    placeholder="Search weapon, evolution, or trigger..."
                    placeholderTextColor="rgba(56,56,56,0.5)"
                    style={st.searchInput}
                    accessibilityLabel="Search Evolutions"
                  />
                  {evoQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setEvoQuery('')} accessibilityLabel="Clear search">
                      <Icon name="lorc/cross-mark" size={13} color={INK} />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={st.filterRow}>
                  {(
                    [
                      { id: 'all', label: 'All (192)' },
                      { id: 'unlocked', label: `Unlocked (${unlockedEvoCount})` },
                      { id: 'discovered', label: `Triggered (${discoveredEvoCount})` },
                      { id: 'locked', label: 'Locked' },
                    ] as const
                  ).map(f => (
                    <TouchableOpacity
                      key={f.id}
                      testID={`guide-evo-filter-${f.id}`}
                      onPress={() => { sfx('click'); setEvoFilter(f.id); }}
                      style={[st.filterPill, evoFilter === f.id && st.filterPillOn]}
                    >
                      <Text style={[st.filterPillText, evoFilter === f.id && st.filterPillTextOn]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={st.emptyBox}>
              <Text style={st.howBody}>No evolutions match this filter yet.</Text>
            </View>
          }
          renderItem={({ item: group }) => {
            const w = armoryBaseWeapon(group.weaponId);
            return (
              <View style={[st.recipeCard, group.unlockedCount > 0 && st.recipeCardDiscovered]} testID={`guide-evo-weapon-${group.weaponId}`}>
                <View style={st.weaponGroupHead}>
                  {w && <WeaponAvatar weapon={w} size={32} />}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.weaponGroupName} numberOfLines={1}>{group.weaponName}</Text>
                    <Text style={st.weaponGroupSub}>
                      {group.ownedWeapon ? 'In Armory' : 'Locked weapon'} · {group.unlockedCount}/3 unlocked
                    </Text>
                  </View>
                  <View style={st.pipsRow}>
                    {[0, 1, 2].map(idx => (
                      <View
                        key={idx}
                        style={[st.evoPip, idx < group.unlockedCount && st.evoPipOn]}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  {group.items.map(({ vm, unlocked, discovered, equipped }) => (
                    <View
                      key={vm.id}
                      testID={`guide-evo-${vm.id}`}
                      style={[
                        st.evoItemRow,
                        equipped && st.evoItemEquipped,
                        !unlocked && st.evoItemLocked,
                      ]}
                    >
                      <View style={[st.evoMiniIcon, unlocked && { backgroundColor: '#F3E8FF', borderColor: INK }]}>
                        <Icon
                          name={unlocked ? vm.icon : 'lorc/padlock'}
                          size={15}
                          color={unlocked ? INK : '#78716C'}
                          noShadow
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <View style={st.evoItemTop}>
                          <Text style={st.evoItemName} numberOfLines={1}>{vm.name}</Text>
                          <Text style={st.evoItemTag}>
                            {equipped
                              ? 'EQUIPPED'
                              : discovered
                                ? 'TRIGGERED'
                                : unlocked
                                  ? 'UNLOCKED'
                                  : vm.slotLabel}
                          </Text>
                        </View>
                        <Text style={st.evoItemCond}>
                          Trigger: {vm.conditionFull} · {vm.durationSec}s
                        </Text>
                        <Text style={st.evoItemDesc}>{vm.effectText}</Text>
                        {!unlocked && vm.unlockHintText && (
                          <Text style={st.evoItemHint}>Unlock: {vm.unlockHintText}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          }}
        />
      )}

      {tab === 'critters' && (
        <CritterGallery mode="gallery" save={save} bottomInset={insets.bottom} />
      )}

      <MechanicIntro mechanic={open} onClose={() => setOpen(null)} cta="Close" quiz={false} dismissible />
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paperBeige },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { flexShrink: 1, fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 16 },
  count: { fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 10, maxWidth: 620, width: '100%', alignSelf: 'center' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, borderWidth: 2, borderColor: '#B8B0A4', backgroundColor: COLORS.canvasWhite },
  tabOn: { backgroundColor: COLORS.actionYellow, borderColor: INK, borderBottomWidth: 4 },
  tabText: { flexShrink: 1, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, color: INK },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12, justifyContent: 'center', maxWidth: 620, alignSelf: 'center' },
  walkthroughCard: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.actionYellow, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, padding: 12, minHeight: 56 },
  walkthroughIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.canvasWhite, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  walkthroughTextWrap: { flex: 1, minWidth: 0, gap: 2 },
  walkthroughTitle: { fontSize: 14, fontWeight: '900', color: INK, flexShrink: 1 },
  walkthroughSub: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: INK, opacity: 0.85, flexShrink: 1 },
  entry: { width: 104, alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, padding: 8 },
  entryLocked: { borderColor: TONE.spentEdge, backgroundColor: '#EFEAE2' },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12, fontWeight: '800', color: INK, textAlign: 'center' },
  where: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.6 },
  recipesWrap: { padding: 12, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  howCard: { backgroundColor: TONE.comboPale, borderRadius: 10, borderWidth: 2, borderColor: INK, padding: 12, gap: 6 },
  howTitle: { fontWeight: '900', fontSize: 14, color: INK },
  howBody: { fontSize: 12, lineHeight: 18, color: INK },
  filterCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2, borderColor: INK, padding: 8, gap: 7 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#C5BCB0', paddingHorizontal: 8, paddingVertical: 4 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: INK, paddingVertical: 3 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  filterPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1.5, borderColor: '#B8B0A4', backgroundColor: COLORS.paperBeige },
  filterPillOn: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  filterPillText: { fontSize: 11, fontWeight: '800', color: INK },
  filterPillTextOn: { fontWeight: '900', color: INK },
  emptyBox: { padding: 20, alignItems: 'center' },
  recipeCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: '#B8B0A4', padding: 12, gap: 8 },
  recipeCardDiscovered: { borderColor: INK, backgroundColor: '#FFFDF7' },
  recipeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recipeAvatar: { width: 54, height: 54, borderRadius: 12, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  recipeName: { fontWeight: '900', fontSize: 16, color: INK },
  recipeBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { flex: 1, fontSize: 12, color: INK },
  weaponGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weaponGroupName: { flexShrink: 1, fontWeight: '900', fontSize: 15, color: INK },
  weaponGroupSub: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.68 },
  pipsRow: { flexDirection: 'row', gap: 3 },
  evoPip: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: '#A8A29E', backgroundColor: COLORS.paperBeige },
  evoPipOn: { backgroundColor: '#7C3AED', borderColor: INK },
  evoItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#C5BCB0', padding: 8 },
  evoItemEquipped: { backgroundColor: '#FFFBEB', borderColor: INK },
  evoItemLocked: { opacity: 0.82, borderStyle: 'dashed' },
  evoMiniIcon: { width: 28, height: 28, borderRadius: 7, borderWidth: 1.5, borderColor: '#A8A29E', backgroundColor: '#EAE4DA', alignItems: 'center', justifyContent: 'center' },
  evoItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  evoItemName: { flex: 1, flexShrink: 1, fontSize: 13, fontWeight: '900', color: INK },
  evoItemTag: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5, color: '#6D28D9' },
  evoItemCond: { fontSize: 11.5, fontWeight: '800', color: '#4C1D95' },
  evoItemDesc: { fontSize: 12, color: INK, lineHeight: 16 },
  evoItemHint: { fontSize: 11, fontWeight: '700', color: '#92400E', marginTop: 2 },
});

export default FieldGuide;
