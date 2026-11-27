/**
 * Camp — between fights. It opens on a menu of its sections; each section's
 * back button returns to the menu:
 *   Fighters: each fighter's two passives and their star-bought Skill Tree
 *   Armory:   weapons unlocked so far (filter/sort/search, Auto-Equip, 3 Presets, belt reorder)
 *   Arcana:   tarot wildcards that bend the rules (equip into Arcana slots)
 *   Workshop: coin upgrades (Charm Belt, Tarot Deck, Evolution Lab, mechanics, weapon tuning)
 *   Bounties: cross-run milestones (BountyBoard.tsx)
 *   History:  every battle fought, with its damage per minute (BattleHistory.tsx)
 * Every purchase is refundable at 100%.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { type IconName } from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { FighterBuildAura, deriveBuildTheme } from '@/components/fighters/FighterBuildAura';
import { WeaponAvatar } from '@/components/weapons';
import type { FighterReactionEvent, FighterReactionType } from '@/utils/fighterAnimations';
import { COLORS } from '@/utils/colors';
import type { CharacterName, Weapon } from '@/types';
import { band, sfx } from '@/audio';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AdventureSave, LevelDef, UpgradeDef } from '../types';
import { BOUNTIES } from '../data/bounties';
import { summarize, type BattleRecord } from '../history';
import { analyticsOptedOut, setAnalyticsEnabled } from '@/analytics/posthog';
import type { FunRating, FunTag } from '@/analytics/fightEvent';
import { FIGHTERS } from '../data/fighters';
import { readyMapKeys } from '../data/mapKeys';
import { MAX_TUNING_TIER, MAX_WEAPON_LEVEL, TUNING_MULTIPLIERS, formatStat, weaponStatLines } from '../data/weaponStats';
import { ARCANA } from '../data/arcana';
import { UNDERSTUDY_ID } from '../data/adventureWeapons';
import { charmWeapons, getArmoryWeapon, weaponLevelSuffix } from '../data/armory';
import { WEAPON_ROLES, weaponRole, type WeaponRole } from '../data/weaponRoles';
import { unlockHint } from '../data/rewards';
import { GoldenKeyArt } from './RescueArt';
import {
  arcanaSlots,
  availableStars,
  fighterStarsSpent,
  buyTuning,
  buyUpgrade,
  canBuyUpgrade,
  canTune,
  charmSlots,
  charmSynergyWithEquipped,
  equippedArcanaOf,
  equippedCharms,
  getUnlockedUpgrades,
  hasUnspentStars,
  refundAllCamp,
  refundTuning,
  refundUpgrade,
  refundableCoins,
  toggleArcana,
  toggleCharm,
  upgradeCost,
  upgradeSpentCoins,
  upgradeTier,
  tuningCost,
  tuningSpent,
  weaponBuild,
  weaponBuilds,
  weaponLevel,
  weaponLevelsInWorld,
} from '../progress';
import {
  DEFAULT_PRESET_NAMES,
  applyLoadoutPreset,
  autoBuildLoadout,
  filterAndSortArmory,
  loadLoadoutPresets,
  reorderCharmSlots,
  saveLoadoutPreset,
  type ArmoryQuickFilter,
  type ArmorySortMode,
  type LoadoutPreset,
} from '../loadoutPresets';
import SkillTree, { StarPool } from './SkillTree';
import BattleHistory from './BattleHistory';
import WeaponExplainer from './WeaponExplainer';
import BountyBoard from './BountyBoard';
import CompanionBubble from './CompanionBubble';
import { ArcanaCard, FighterPassivesList } from './SharedCards';
import { companionVoice } from '../coach';
import { Btn, CoinPill, INK, PopIn, TONE } from './ui';

export type CampTab = 'fighters' | 'armory' | 'arcana' | 'workshop' | 'bounties' | 'history';

/** The sections of Camp, in menu order. */
const SECTIONS: { id: CampTab; title: string; icon: IconName }[] = [
  { id: 'fighters', title: 'Fighters', icon: 'lorc/tree-branch' },
  { id: 'armory', title: 'Armory', icon: 'lorc/gems' },
  { id: 'arcana', title: 'Arcana', icon: 'lorc/crystal-wand' },
  { id: 'workshop', title: 'Workshop', icon: 'lorc/gear-hammer' },
  { id: 'bounties', title: 'Bounties', icon: 'lorc/trophy' },
  { id: 'history', title: 'History', icon: 'delapouite/scroll-quill' },
];

const LOADOUT_TABS: ReadonlySet<CampTab> = new Set(['fighters', 'armory', 'arcana', 'workshop']);

/** How one section reads on the menu. */
interface SectionStatus {
  sub: string;
  /** Not open yet: `sub` says how to open it */
  locked?: boolean;
  /** Something here wants attention */
  badge?: boolean;
}

interface Props {
  save: AdventureSave;
  /** Every battle fought, oldest first */
  history?: readonly BattleRecord[];
  onChange: (save: AdventureSave) => void;
  onRateBattle?: (battle: BattleRecord, rating: FunRating | null, tags: FunTag[]) => void;
  onClose: () => void;
  /** Open straight on this section (its back button still leads to the menu) */
  initialTab?: CampTab;
  /** Level to jump back into from Camp when arriving from a preview/result */
  returnLevel?: LevelDef | null;
  onReturnToLevel?: (level: LevelDef) => void;
  /** [TP-12] 1-tap jump into 1-4D Training Lab sandbox with current build */
  onTestLoadout?: (activeTab?: CampTab | null) => void;
}

const NO_BATTLES: readonly BattleRecord[] = [];

/** The player's Armory, in the order it was won. */
const armoryWeapons = (save: AdventureSave): Weapon[] =>
  save.armory.map(id => getArmoryWeapon(id)).filter((w): w is Weapon => !!w);

/** Workshop items that change the loadout itself, listed first. */
const LOADOUT_UPGRADES = ['charm_belt', 'tarot_deck', 'evolution_lab'];

const QUICK_FILTERS: { id: ArmoryQuickFilter; label: string; icon?: IconName }[] = [
  { id: 'all', label: 'All' },
  { id: 'fuses', label: 'Fuses', icon: 'lorc/crystal-shine' },
  { id: 'equipped', label: 'Equipped' },
  { id: 'lv2plus', label: 'Lv 2+' },
];

const SORT_MODES: { id: ArmorySortMode; label: string }[] = [
  { id: 'shelves', label: 'Shelves' },
  { id: 'fuses', label: 'Fuses First' },
  { id: 'level', label: 'Highest Lv' },
  { id: 'az', label: 'A–Z' },
];

const Camp: React.FC<Props> = ({
  save,
  history = NO_BATTLES,
  onChange,
  onRateBattle,
  onClose,
  initialTab,
  returnLevel,
  onReturnToLevel,
  onTestLoadout,
}) => {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  /** The open section; null is the menu */
  const [tab, setTab] = useState<CampTab | null>(initialTab ?? null);
  const [analyticsOn, setAnalyticsOn] = useState(() => !analyticsOptedOut());
  const [treeFighter, setTreeFighter] = useState<CharacterName | null>(null);
  const [reactions, setReactions] = useState<Partial<Record<CharacterName, FighterReactionEvent>>>({});
  const [armoryTapCounts, setArmoryTapCounts] = useState<Record<string, number>>({});
  const [slotsFullNote, setSlotsFullNote] = useState<'charms' | null>(null);
  /** The Armory weapon tapped last: explained in full under the slots */
  const [armoryFocus, setArmoryFocus] = useState<string | null>(null);
  /** [GP-21] Armory filter, search, sort, belt swap selection, Auto-Equip undo, and 3 Presets */
  const [quickFilter, setQuickFilter] = useState<ArmoryQuickFilter>('all');
  const [roleFilter, setRoleFilter] = useState<WeaponRole | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<ArmorySortMode>('shelves');
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [autoUndo, setAutoUndo] = useState<{ prevSave: AdventureSave; summary: string } | null>(null);
  const [presets, setPresets] = useState<(LoadoutPreset | null)[]>(() => loadLoadoutPresets());
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const reactionSeq = useRef(0);

  useEffect(() => {
    setTab(initialTab ?? null);
  }, [initialTab]);

  // [AU-20]: Cozy campfire vibes + harp + pizz in Camp; stop cleanly on unmount if still on camp
  useEffect(() => {
    if (typeof band?.playScreenMusic === 'function') {
      band.playScreenMusic('camp');
    }
    return () => {
      if (typeof band?.stop === 'function' && band.current === 'camp') {
        band.stop();
      }
    };
  }, []);

  const open = (next: CampTab | null) => {
    setTab(next);
    setTreeFighter(null);
    setSlotsFullNote(null);
    setSelectedSlot(null);
  };

  const fireFighterReaction = (name: CharacterName, type: FighterReactionType) => {
    reactionSeq.current += 1;
    setReactions(prev => ({ ...prev, [name]: { type, id: reactionSeq.current } }));
  };

  const totalRefundable = refundableCoins(save);
  const charms = equippedCharms(save);
  const slots = charmSlots(save);
  const arcana = equippedArcanaOf(save);
  const builds = weaponBuilds(save);
  const unlockedUpgrades = getUnlockedUpgrades(save);
  const loadoutUpgrades = unlockedUpgrades.filter(u => LOADOUT_UPGRADES.includes(u.id));
  const mechanicUpgrades = unlockedUpgrades.filter(u => !LOADOUT_UPGRADES.includes(u.id));
  const buildTheme = useMemo(
    () => deriveBuildTheme(charms, 0, arcana.length),
    [charms, arcana.length]
  );

  const filteredArmory = useMemo(
    () =>
      filterAndSortArmory(save, {
        quick: quickFilter,
        role: roleFilter,
        query: searchQuery,
        sort: sortMode,
      }),
    [save, quickFilter, roleFilter, searchQuery, sortMode]
  );

  const understudyIdx = charms.indexOf(UNDERSTUDY_ID);
  const understudyTarget = understudyIdx > 0 ? getArmoryWeapon(charms[understudyIdx - 1], builds) : null;

  /** [UI-20] Concise 1-line "Next goal" callout on the Camp hub. */
  const nextGoal = useMemo(() => {
    if (readyMapKeys(save).length > 0) {
      return 'Next goal: Tap the Golden Key on the map to rescue a new fighter!';
    }
    const freeStars = availableStars(save, save.selectedFighter);
    if (freeStars > 0) {
      return `Next goal: Spend ${freeStars}★ on ${save.selectedFighter}'s Skill Tree.`;
    }
    if (charms.length < Math.min(slots, save.armory.length)) {
      return `Next goal: Fill your open weapon belt slot (${charms.length}/${slots} equipped).`;
    }
    if (save.workshopUnlocked && totalRefundable === 0 && save.coins >= 60) {
      return `Next goal: Spend ${save.coins}¢ in the Workshop (100% refundable anytime).`;
    }
    if (returnLevel) {
      return `Next goal: Tune your build and jump back into ${returnLevel.id} ${returnLevel.name}.`;
    }
    return 'Next goal: Experiment with weapon pairs to discover new Evolutions!';
  }, [save, charms.length, slots, totalRefundable, returnLevel]);

  const handleSlotTap = (idx: number) => {
    const id = charms[idx];
    if (!id) {
      setSelectedSlot(null);
      return;
    }
    if (selectedSlot === null) {
      sfx('click');
      setSelectedSlot(idx);
      setArmoryFocus(id);
      return;
    }
    if (selectedSlot === idx) {
      setSelectedSlot(null);
      return;
    }
    sfx('confirm');
    onChange(reorderCharmSlots(save, selectedSlot, idx));
    setSelectedSlot(null);
  };

  const handleNudgeSlot = (from: number, to: number) => {
    if (to < 0 || to >= charms.length) return;
    sfx('click');
    onChange(reorderCharmSlots(save, from, to));
    setSelectedSlot(to);
  };

  const handleAutoEquip = () => {
    const prevSave = save;
    const result = autoBuildLoadout(save, returnLevel);
    sfx('confirm');
    setAutoUndo({ prevSave, summary: result.summary });
    setSelectedSlot(null);
    onChange(result.save);
  };

  const handleSavePreset = (slot: 0 | 1 | 2) => {
    sfx('confirm');
    const updated = saveLoadoutPreset(slot, save, DEFAULT_PRESET_NAMES[slot]);
    setPresets(updated);
    setPresetNotice(`Saved "${DEFAULT_PRESET_NAMES[slot]}" (${charms.length} weapons)`);
  };

  const handleLoadPreset = (slot: 0 | 1 | 2) => {
    const p = presets[slot];
    if (!p) {
      handleSavePreset(slot);
      return;
    }
    sfx('confirm');
    onChange(applyLoadoutPreset(save, p));
    setPresetNotice(`Loaded "${p.name}"`);
    setSelectedSlot(null);
  };

  const renderUpgrade = (u: UpgradeDef) => {
    const tier = upgradeTier(save, u.id);
    const cost = upgradeCost(save, u.id);
    const spent = upgradeSpentCoins(save, u.id);
    return (
      <PopIn key={u.id} style={st.upgrade}>
        <View testID={`camp-upgrade-${u.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={st.portrait}><Icon name={u.icon} size={30} color={INK} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.fighterName}>{u.name}</Text>
            <Text style={st.fighterBlurb}>{tier > 0 ? `Now: ${u.description(tier)}` : u.description(1)}</Text>
            {tier > 0 && cost !== null && <Text style={st.nextTier}>Next: {u.description(tier + 1)}</Text>}
            <View style={{ flexDirection: 'row', gap: 3, marginTop: 2 }}>
              {u.costs.map((_, i) => <View key={i} style={[st.tierPip, i < tier && st.tierPipOn]} />)}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {cost !== null ? (
              <Btn
                small
                testID={`camp-buy-upgrade-${u.id}`}
                label={`${cost}¢`}
                icon="lorc/crown-coin"
                disabled={!canBuyUpgrade(save, u.id)}
                onPress={() => { sfx('unlock'); onChange(buyUpgrade(save, u.id)); }}
              />
            ) : (
              <Text style={st.maxed}>MAX</Text>
            )}
            {spent > 0 && (
              <TouchableOpacity
                testID={`camp-refund-upgrade-${u.id}`}
                onPress={() => { sfx('coin'); onChange(refundUpgrade(save, u.id)); }}
                style={st.refundChip}
                activeOpacity={0.85}
              >
                <Icon name="lorc/recycle" size={12} color={INK} />
                <Text style={st.refundChipText}>+{spent}¢</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </PopIn>
    );
  };

  const renderArmoryTile = (w: Weapon) => {
    const slot = charms.indexOf(w.id);
    const equipped = slot >= 0;
    const wLevel = weaponLevel(save, w.id);
    const shown = equipped ? charmWeapons(charms, builds)[slot] : getArmoryWeapon(w.id, builds);
    return (
      <TouchableOpacity
        key={w.id}
        testID={`camp-armory-${w.id}`}
        onPress={() => {
          setArmoryTapCounts(prev => ({ ...prev, [w.id]: (prev[w.id] ?? 0) + 1 }));
          setArmoryFocus(w.id);
          if (!equipped && charms.length >= slots) {
            sfx('back');
            setSlotsFullNote('charms');
            return;
          }
          band.audition(w.id);
          setSlotsFullNote(null);
          setSelectedSlot(null);
          onChange(toggleCharm(save, w.id));
        }}
        activeOpacity={0.85}
        accessibilityState={{ selected: equipped }}
        style={[
          st.armoryItem,
          { borderColor: equipped ? COLORS.actionYellow : TONE.spentEdge },
          equipped && { backgroundColor: TONE.selected },
        ]}
      >
        <WeaponAvatar weapon={w} size={36} triggerKey={armoryTapCounts[w.id]} />
        <Text style={st.armoryName} numberOfLines={1}>{w.name}{weaponLevelSuffix(wLevel)}</Text>
        <Text style={[st.armoryRarity, { color: TONE.spent }]}>{equipped ? `slot ${slot + 1}` : `level ${wLevel}`}</Text>
        {!equipped && charmSynergyWithEquipped(save, w.id) && (
          <View style={st.fusesBadge}>
            <Icon name="lorc/crystal-shine" size={10} color={TONE.combo} noShadow />
            <Text style={{ fontSize: 10, fontWeight: '900', color: TONE.combo }}>FUSES</Text>
          </View>
        )}
        <Text style={st.armoryDesc} numberOfLines={3}>{shown?.shortDescription}</Text>
      </TouchableOpacity>
    );
  };

  const battles = summarize(history);
  const statusOf = (id: CampTab): SectionStatus => {
    switch (id) {
      case 'fighters':
        return { sub: `${save.selectedFighter} · ${availableStars(save, save.selectedFighter)}★ to spend on skills`, badge: hasUnspentStars(save) };
      case 'armory':
        return {
          sub: save.armory.length === 0 ? 'No weapons yet. Some stars unlock one.' : `${charms.length}/${slots} weapons equipped · ${save.armory.length} unlocked`,
          badge: charms.length < Math.min(slots, save.armory.length),
        };
      case 'arcana':
        return { sub: save.unlockedArcana.length === 0 ? 'None found yet' : `${arcana.length}/${arcanaSlots(save)} equipped · ${save.unlockedArcana.length} found` };
      case 'workshop':
        return save.workshopUnlocked
          ? {
              sub: totalRefundable > 0 ? `Upgrades and weapon tuning · ${totalRefundable}¢ invested` : 'Upgrades and weapon tuning',
              badge: totalRefundable === 0 && save.coins >= 60,
            }
          : { sub: `${unlockHint({ kind: 'feature', id: 'workshop' }, save) ?? 'Keep playing'} to open`, locked: true };
      case 'bounties':
        return save.bountiesUnlocked
          ? {
              sub: `${save.completedBounties.length}/${BOUNTIES.length} claimed`,
              badge: BOUNTIES.some(b => !save.completedBounties.includes(b.id) && b.progress(save) / b.target >= 0.75),
            }
          : { sub: `${unlockHint({ kind: 'feature', id: 'bounties' }, save) ?? 'Keep playing'} to open`, locked: true };
      case 'history':
        return { sub: battles.battles === 0 ? 'No battles yet' : `${battles.battles} ${battles.battles === 1 ? 'battle' : 'battles'} · best ${battles.bestDpm.toLocaleString()} damage / min` };
    }
  };

  // Bounties bring their own screen; its back button returns to the menu
  if (tab === 'bounties') return <BountyBoard save={save} onClose={() => open(null)} backLabel="Back to camp" />;

  const section = SECTIONS.find(x => x.id === tab);
  const showTestLoadoutBtn = Boolean(onTestLoadout) && (tab === null || LOADOUT_TABS.has(tab));

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity
          onPress={() => { sfx('back'); if (tab) open(null); else onClose(); }}
          style={st.back}
          accessibilityLabel={tab ? 'Back to camp' : 'Back to map'}
        >
          <Icon name="ui/back-arrow" size={20} color={INK} noShadow />
        </TouchableOpacity>
        <Icon name={section?.icon ?? 'lorc/campfire'} size={24} color={section ? INK : COLORS.impactOrange} />
        <Text style={st.title} numberOfLines={1}>{(section?.title ?? 'Camp').toUpperCase()}</Text>
        <View style={{ flex: 1 }} />
        {showTestLoadoutBtn && (
          <TouchableOpacity
            testID="camp-test-loadout"
            onPress={() => { sfx('confirm'); onTestLoadout?.(tab); }}
            style={st.testLoadoutBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Test Loadout in Training Lab"
          >
            <Icon name="lorc/target-dummy" size={16} color={INK} />
            <Text style={st.testLoadoutText} numberOfLines={1}>TEST</Text>
          </TouchableOpacity>
        )}
        {/* Only what this page spends: stars on fighters (or before coins unlock), coins everywhere else */}
        {tab === 'fighters' || !save.coinsUnlocked ? <StarPool save={save} testID="camp-stars" /> : <CoinPill coins={save.coins} />}
      </View>

      {totalRefundable > 0 && tab === 'workshop' && save.workshopUnlocked && (
        <View style={st.refundBanner}>
          <View style={{ flex: 1 }}>
            <Text style={st.refundBannerTitle}>100% Free Respec</Text>
            <Text style={st.refundBannerSub}>Experiment freely — get every spent coin back anytime.</Text>
          </View>
          <TouchableOpacity
            testID="camp-refund-all"
            onPress={() => { sfx('coin'); onChange(refundAllCamp(save)); }}
            style={st.refundAllBtn}
            activeOpacity={0.85}
          >
            <Icon name="lorc/recycle" size={15} color={INK} />
            <Text style={st.refundAllText}>Refund All (+{totalRefundable}¢)</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 24 }]}>
        {tab === null && (
          <>
            {/* [UI-20] Subtle 1-line "Next goal" callout on Camp hub */}
            <View style={st.nextGoalBanner} testID="camp-next-goal">
              <Icon name="lorc/compass" size={16} color={COLORS.actionYellow} />
              <Text style={st.nextGoalText} numberOfLines={2}>{nextGoal}</Text>
            </View>

            {SECTIONS.map(x => {
              const status = statusOf(x.id);
              return (
                <TouchableOpacity
                  key={x.id}
                  testID={`camp-tab-${x.id}`}
                  disabled={status.locked}
                  onPress={() => { sfx('click'); open(x.id); }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${x.title}: ${status.sub}`}
                  accessibilityState={{ disabled: !!status.locked }}
                  style={[st.menuRow, status.locked && st.menuRowLocked]}
                >
                  <View style={st.menuIcon}>
                    <Icon name={status.locked ? 'lorc/padlock' : x.icon} size={28} color={INK} />
                    {status.badge && <View style={st.menuBadge} testID={`camp-badge-${x.id}`} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={st.menuTitle}>{x.title}</Text>
                    <Text style={st.menuSub} numberOfLines={2}>{status.sub}</Text>
                  </View>
                  {!status.locked && <Text style={st.menuChevron}>›</Text>}
                </TouchableOpacity>
              );
            })}

            <Text style={st.sectionLabel}>QUICK SETTINGS</Text>
            <View style={st.settings}>
              <Btn
                testID="camp-toggle-sound"
                small
                variant="secondary"
                icon="delapouite/sound-on"
                label={save.musicOn ? 'Sound: on' : 'Sound: off'}
                onPress={() => onChange({ ...save, musicOn: !save.musicOn })}
                style={{ flex: 1 }}
              />
              {/* A device that asks for reduced motion keeps effects off */}
              {!reducedMotion && (
                <Btn
                  testID="camp-toggle-effects"
                  small
                  variant="secondary"
                  icon="lorc/bright-explosion"
                  label={save.effectsOn ? 'Effects: on' : 'Effects: off'}
                  onPress={() => { sfx('click'); onChange({ ...save, effectsOn: !save.effectsOn }); }}
                  style={{ flex: 1 }}
                />
              )}
              <Btn
                testID="camp-toggle-analytics"
                small
                variant="secondary"
                icon="delapouite/chart"
                label={analyticsOn ? 'Analytics: on' : 'Analytics: off'}
                onPress={() => {
                  sfx('click');
                  const next = !analyticsOn;
                  setAnalyticsEnabled(next);
                  setAnalyticsOn(next);
                }}
                style={{ flex: 1 }}
              />
            </View>
            {!reducedMotion && (
              <Text style={st.blurb}>
                {save.effectsOn ? 'Effects on: the fight clock waits while they play.' : 'Effects off: numbers only, and the clock never waits.'}
              </Text>
            )}
          </>
        )}

        {tab === 'history' && <BattleHistory history={history} onRateBattle={onRateBattle} />}

        {tab === 'fighters' && treeFighter && (
          <SkillTree save={save} fighter={treeFighter} onChange={onChange} onBack={() => setTreeFighter(null)} />
        )}

        {tab === 'fighters' && !treeFighter && (
          <>
            <Text style={st.blurb}>Every fighter plays by two passives. Spend stars in their skill trees to bend those rules. Every fighter can spend every star you have earned, so grow them all at once. Refunds are free.</Text>
            {readyMapKeys(save).length > 0 && (
              <TouchableOpacity
                testID="camp-key-ready-banner"
                onPress={onClose}
                activeOpacity={0.85}
                style={st.keyReadyBanner}
              >
                <GoldenKeyArt size={26} />
                <View style={{ flex: 1 }}>
                  <Text style={st.keyReadyTitle}>Golden Key Ready on the Map!</Text>
                  <Text style={st.keyReadySub}>Head back to the map and tap the Golden Key to free any caged friend.</Text>
                </View>
              </TouchableOpacity>
            )}
            {FIGHTERS.map(f => {
              const unlocked = save.unlockedFighters.includes(f.name);
              const selected = save.selectedFighter === f.name;
              const spent = fighterStarsSpent(save, f.name);
              return (
                <View
                  key={f.name}
                  testID={`camp-fighter-${f.name}`}
                  style={[st.fighter, !unlocked && { opacity: 0.55 }, selected && { borderColor: COLORS.deepOnyx, backgroundColor: TONE.selected }]}
                >
                  <View style={st.fighterHead}>
                    {unlocked ? (
                      <View style={{ position: 'relative' }}>
                        {selected && (
                          <FighterBuildAura
                            theme={buildTheme}
                            size={50}
                            quiet={!save.effectsOn}
                            testID="camp-fighter-build-aura"
                          />
                        )}
                        <FighterAvatar
                          testID={`camp-fighter-avatar-${f.name}`}
                          character={f.name}
                          size={50}
                          mood={selected ? 'anticipation' : 'idle'}
                          reaction={reactions[f.name] ?? null}
                          animate={selected || Boolean(reactions[f.name])}
                          framed
                          interactive
                        />
                      </View>
                    ) : (
                      <View style={st.portrait}><Icon name="lorc/padlock" size={30} color={INK} /></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={st.fighterName}>{unlocked ? f.name : 'Caged Friend'}</Text>
                      <Text style={st.fighterBlurb}>
                        {unlocked ? f.blurb : `${unlockHint({ kind: 'fighter', id: f.name }, save) ?? 'Find a Golden Key on the map to free this friend.'}`}
                      </Text>
                    </View>
                    {unlocked && !selected && (
                      <Btn
                        small
                        variant="secondary"
                        label="Use"
                        onPress={() => {
                          sfx('confirm');
                          fireFighterReaction(f.name, 'joy');
                          onChange({ ...save, selectedFighter: f.name });
                        }}
                      />
                    )}
                    {selected && <View style={st.usingTag}><Text style={st.usingText}>USING</Text></View>}
                  </View>
                  {unlocked && (
                    <>
                      <FighterPassivesList fighter={f.name} itemTestIdPrefix="camp-passive" />
                      <TouchableOpacity
                        testID={`camp-open-tree-${f.name}`}
                        onPress={() => { sfx('confirm'); fireFighterReaction(f.name, 'powerup'); setTreeFighter(f.name); }}
                        style={st.treeBtn}
                        activeOpacity={0.85}
                      >
                        <Icon name="lorc/tree-branch" size={16} color={INK} />
                        <Text style={st.treeBtnText}>Skill tree</Text>
                        <Text style={st.treeBtnSub}>{`${availableStars(save, f.name)}★ left`}{spent > 0 ? ` · ${spent}★ spent` : ''}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}

        {tab === 'workshop' && (
          !save.workshopUnlocked ? (
            <View testID="camp-workshop-locked" style={st.lockedWorkshop}>
              <View style={st.portrait}><Icon name="lorc/padlock" size={30} color={INK} /></View>
              <Text style={st.fighterName}>Workshop Locked</Text>
              <Text style={[st.fighterBlurb, { textAlign: 'center' }]}>
                {unlockHint({ kind: 'feature', id: 'workshop' }, save)} to unlock the ability to upgrade your unlocked mechanics and tune your Armory weapons!
              </Text>
            </View>
          ) : (
            <>
              {totalRefundable === 0 && save.coins >= 60 && (
                <CompanionBubble
                  testID="camp-workshop-welcome"
                  character={save.selectedFighter}
                  mood="victory"
                  text={`${companionVoice(save.selectedFighter).cheer} Spend coins on upgrades or weapon tuning — every coin refunds 100% anytime!`}
                />
              )}
              <Text style={st.blurb}>
                Upgrade your loadout, any mechanic you have met, and tune your Armory weapons. Refundable at 100% value anytime.
              </Text>

              {loadoutUpgrades.length > 0 && (
                <>
                  <Text style={st.sectionLabel}>LOADOUT</Text>
                  <Text style={st.slotLine}>Weapon slots {slots}/6 · Arcana slots {arcanaSlots(save)}/3</Text>
                  {loadoutUpgrades.map(renderUpgrade)}
                </>
              )}

              <Text style={st.sectionLabel}>MECHANIC UPGRADES</Text>
              {mechanicUpgrades.length === 0 ? (
                <Text style={st.blurb}>Play further in the campaign to unlock mechanics to upgrade.</Text>
              ) : (
                mechanicUpgrades.map(renderUpgrade)
              )}

              <Text style={st.sectionLabel}>WEAPON TUNING</Text>
              <Text style={st.blurb}>
                Weapons level up when you find them again in the world (repeat star and bounty rewards): every number gets a flat boost. Tuning multiplies one number on top.
              </Text>
              {save.armory.length === 0 ? (
                <Text style={st.blurb}>Unlock weapons in your Armory to tune them here.</Text>
              ) : (
                armoryWeapons(save).map(base => {
                  const build = weaponBuild(save, base.id);
                  const w = getArmoryWeapon(base.id, { [base.id]: build }) ?? base;
                  const level = weaponLevel(save, base.id);
                  const inWorld = weaponLevelsInWorld(base.id);
                  const spent = tuningSpent(save, base.id);
                  return (
                    <PopIn key={base.id} style={[st.upgrade, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <View testID={`camp-weapon-upgrade-${base.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={st.portrait}>
                          <WeaponAvatar weapon={w} size={34} interactive />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={st.fighterName}>{w.name} · Lv {level}</Text>
                          <View style={{ flexDirection: 'row', gap: 3 }} accessibilityLabel={`Level ${level} of ${MAX_WEAPON_LEVEL}`}>
                            {Array.from({ length: MAX_WEAPON_LEVEL }).map((_, i) => (
                              <View key={i} style={[st.tierPip, i < level && st.tierPipOn, i >= inWorld && st.tierPipAbsent]} />
                            ))}
                          </View>
                          <Text style={st.fighterBlurb}>
                            {level < inWorld
                              ? `${inWorld - level} more ${inWorld - level === 1 ? 'copy' : 'copies'} to find in the world`
                              : 'Every copy in the world found'}
                          </Text>
                        </View>
                        {spent > 0 && (
                          <TouchableOpacity
                            testID={`camp-refund-weapon-${base.id}`}
                            onPress={() => { sfx('coin'); onChange(refundTuning(save, base.id)); }}
                            style={st.refundChip}
                            activeOpacity={0.85}
                          >
                            <Icon name="lorc/recycle" size={12} color={INK} />
                            <Text style={st.refundChipText}>+{spent}¢</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {weaponStatLines(base, build).map(line => {
                        const cost = tuningCost(save, base.id, line.key);
                        return (
                          <View key={line.key} style={st.tuneRow} testID={`camp-tune-row-${base.id}-${line.key}`}>
                            <View style={{ flex: 1 }}>
                              <Text style={st.tuneLabel}>{line.label}</Text>
                              <Text style={st.tuneValue}>
                                {formatStat(line.unit, line.value)}
                                {line.tier > 0 ? <Text style={st.tuneMath}>  ({formatStat(line.unit, line.levelled)} ×{line.multiplier})</Text> : null}
                              </Text>
                            </View>
                            {line.tunable ? (
                              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                  {Array.from({ length: MAX_TUNING_TIER }).map((_, i) => (
                                    <View key={i} style={[st.tunePip, i < line.tier && st.tierPipOn]} />
                                  ))}
                                </View>
                                {cost !== null ? (
                                  <Btn
                                    small
                                    testID={`camp-tune-${base.id}-${line.key}`}
                                    label={`×${TUNING_MULTIPLIERS[line.tier + 1]} · ${cost}¢`}
                                    disabled={!canTune(save, base.id, line.key)}
                                    onPress={() => { sfx('unlock'); onChange(buyTuning(save, base.id, line.key)); }}
                                  />
                                ) : (
                                  <Text style={st.maxed}>MAX</Text>
                                )}
                              </View>
                            ) : (
                              <Text style={st.tuneMath}>levels only</Text>
                            )}
                          </View>
                        );
                      })}
                    </PopIn>
                  );
                })
              )}
            </>
          )
        )}

        {tab === 'armory' && (
          <>
            <Text style={st.blurb}>
              Tap a weapon to equip or inspect. Tap an equipped belt slot to reorder (◀ / ▶) so Understudy copies its left partner!
            </Text>

            {/* Interactive reorderable Weapon Belt */}
            <View style={st.slotRow} testID="camp-charm-slots">
              {Array.from({ length: slots }).map((_, i) => {
                const id = charms[i];
                const w = id ? getArmoryWeapon(id, builds) : undefined;
                const isSel = selectedSlot === i;
                return (
                  <View key={i} style={st.slotWrap}>
                    <TouchableOpacity
                      testID={`camp-slot-${i}`}
                      disabled={!w}
                      onPress={() => handleSlotTap(i)}
                      activeOpacity={0.85}
                      accessibilityLabel={w ? `Slot ${i + 1}: ${w.name}. Tap to reorder` : `Empty slot ${i + 1}`}
                      style={[
                        st.slot,
                        w && { borderColor: INK, borderStyle: 'solid', backgroundColor: COLORS.canvasWhite },
                        isSel && st.slotSelected,
                      ]}
                    >
                      {w ? <WeaponAvatar weapon={w} size={26} /> : <Text style={st.slotEmpty}>+</Text>}
                    </TouchableOpacity>
                    <Text style={st.slotNo}>{i + 1}</Text>
                    {w && isSel && (
                      <View style={st.nudgeRow}>
                        <TouchableOpacity
                          testID={`camp-slot-left-${i}`}
                          disabled={i === 0}
                          onPress={() => handleNudgeSlot(i, i - 1)}
                          style={[st.nudgeBtn, i === 0 && st.nudgeBtnDisabled]}
                          accessibilityLabel={`Move ${w.name} left`}
                        >
                          <Text style={st.nudgeText}>◀</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          testID={`camp-slot-right-${i}`}
                          disabled={i >= charms.length - 1}
                          onPress={() => handleNudgeSlot(i, i + 1)}
                          style={[st.nudgeBtn, i >= charms.length - 1 && st.nudgeBtnDisabled]}
                          accessibilityLabel={`Move ${w.name} right`}
                        >
                          <Text style={st.nudgeText}>▶</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
              <Text style={st.slotCount}>{charms.length}/{slots}</Text>
            </View>

            {understudyIdx === 0 && (
              <View style={st.understudyWarn} testID="camp-understudy-warning">
                <Icon name="lorc/two-shadows" size={14} color="#92400E" />
                <Text style={st.understudyWarnText}>Understudy is in Slot 1 — tap it and press ▶ Move right to copy a partner!</Text>
              </View>
            )}
            {understudyIdx > 0 && understudyTarget && (
              <View style={st.understudyLink} testID="camp-understudy-link">
                <Icon name="lorc/two-shadows" size={14} color="#0F766E" />
                <Text style={st.understudyLinkText}>Slot {understudyIdx + 1} Understudy ← COPIES {understudyTarget.name}</Text>
              </View>
            )}

            {slotsFullNote === 'charms' && (
              <Text testID="camp-charms-full" style={st.fullNote}>All {slots} weapon slots are full. Tap an equipped weapon to take it off{slots < 6 ? ', or add a slot with the Charm Belt in the Workshop' : ''}.</Text>
            )}

            {/* [GP-21] Auto-Equip + 3 Named Loadout Presets */}
            {save.armory.length > 0 && (
              <View style={st.loadoutTools}>
                <View style={st.toolRow}>
                  <TouchableOpacity
                    testID="camp-auto-equip"
                    onPress={handleAutoEquip}
                    style={st.autoEquipBtn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={returnLevel ? `Auto-Equip for ${returnLevel.name}` : 'Auto-Equip best loadout'}
                  >
                    <Icon name="delapouite/sparkles" size={15} color={INK} />
                    <Text style={st.autoEquipText} numberOfLines={1}>
                      {returnLevel ? `Auto-Equip for ${returnLevel.name}` : 'Auto-Equip Best'}
                    </Text>
                  </TouchableOpacity>
                  {autoUndo && (
                    <TouchableOpacity
                      testID="camp-auto-equip-undo"
                      onPress={() => {
                        sfx('back');
                        onChange(autoUndo.prevSave);
                        setAutoUndo(null);
                      }}
                      style={st.undoBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={st.undoText}>Undo</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {autoUndo && <Text style={st.toolNote}>{autoUndo.summary}</Text>}

                {/* 3 saved Loadout Presets */}
                <View style={st.presetRow} testID="camp-presets">
                  {([0, 1, 2] as const).map(idx => {
                    const p = presets[idx];
                    const defaultName = DEFAULT_PRESET_NAMES[idx];
                    return (
                      <View key={idx} style={st.presetSlot}>
                        <TouchableOpacity
                          testID={`camp-preset-load-${idx}`}
                          onPress={() => handleLoadPreset(idx)}
                          style={[st.presetLoadBtn, p && st.presetLoadBtnSaved]}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={p ? `Load ${p.name} preset (${p.charms.length} weapons)` : `Save current build to ${defaultName}`}
                        >
                          <Text style={st.presetName} numberOfLines={1}>{p?.name ?? defaultName}</Text>
                          <Text style={st.presetMeta} numberOfLines={1}>{p ? `${p.charms.length} wpns` : 'Empty'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          testID={`camp-preset-save-${idx}`}
                          onPress={() => handleSavePreset(idx)}
                          style={st.presetSaveBtn}
                          activeOpacity={0.85}
                          accessibilityLabel={`Save current build to ${defaultName}`}
                        >
                          <Text style={st.presetSaveText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                {presetNotice && <Text style={st.toolNote}>{presetNotice}</Text>}
              </View>
            )}

            {/* [GP-21] Sticky Filter, Search & Sort Strip */}
            {save.armory.length > 0 && (
              <View style={st.filterPanel} testID="camp-armory-filters">
                <View style={st.searchRow}>
                  <Icon name="lorc/magnifying-glass" size={15} color={INK} />
                  <TextInput
                    testID="camp-armory-search"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search weapons by name or effect..."
                    placeholderTextColor="rgba(56,56,56,0.5)"
                    style={st.searchInput}
                    accessibilityLabel="Search Armory weapons"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
                      <Text style={st.clearText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipStrip}>
                  {QUICK_FILTERS.map(f => (
                    <TouchableOpacity
                      key={f.id}
                      testID={`camp-filter-${f.id}`}
                      onPress={() => { sfx('click'); setQuickFilter(f.id); }}
                      style={[st.filterChip, quickFilter === f.id && st.filterChipOn]}
                    >
                      {f.icon && <Icon name={f.icon} size={11} color={INK} noShadow />}
                      <Text style={[st.filterChipText, quickFilter === f.id && st.filterChipTextOn]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={st.chipDivider} />
                  {SORT_MODES.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      testID={`camp-sort-${m.id}`}
                      onPress={() => { sfx('click'); setSortMode(m.id); }}
                      style={[st.sortChip, sortMode === m.id && st.sortChipOn]}
                    >
                      <Text style={[st.sortChipText, sortMode === m.id && st.sortChipTextOn]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipStrip}>
                  <TouchableOpacity
                    testID="camp-role-all"
                    onPress={() => { sfx('click'); setRoleFilter('all'); }}
                    style={[st.roleChip, roleFilter === 'all' && st.roleChipOn]}
                  >
                    <Text style={[st.roleChipText, roleFilter === 'all' && st.roleChipTextOn]}>All Roles</Text>
                  </TouchableOpacity>
                  {WEAPON_ROLES.map(r => (
                    <TouchableOpacity
                      key={r.id}
                      testID={`camp-role-${r.id}`}
                      onPress={() => { sfx('click'); setRoleFilter(r.id); }}
                      style={[st.roleChip, roleFilter === r.id && st.roleChipOn]}
                    >
                      <Text style={[st.roleChipText, roleFilter === r.id && st.roleChipTextOn]}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {save.armory.length === 0 && <Text style={st.blurb}>Nothing here yet. Some stars unlock a weapon.</Text>}

            {save.armory.length > 0 && filteredArmory.length === 0 && (
              <Text style={st.blurb} testID="camp-armory-empty-filter">No weapons match this filter. Try switching back to All.</Text>
            )}

            {sortMode === 'shelves' ? (
              WEAPON_ROLES.map(role => {
                const shelf = filteredArmory.filter(w => weaponRole(w.id) === role.id);
                if (shelf.length === 0) return null;
                return (
                  <View key={role.id} testID={`camp-armory-shelf-${role.id}`} style={st.shelf}>
                    <View style={st.shelfHead}>
                      <Text style={st.shelfTitle}>{role.label}</Text>
                      <Text style={st.shelfBlurb}>{role.blurb}</Text>
                    </View>
                    <View style={st.armory}>{shelf.map(renderArmoryTile)}</View>
                  </View>
                );
              })
            ) : (
              <View style={st.armory} testID="camp-armory-sorted-grid">
                {filteredArmory.map(renderArmoryTile)}
              </View>
            )}
            <Text style={st.blurb}>More weapons are out there…</Text>
          </>
        )}

        {tab === 'arcana' && (
          <>
            <Text style={st.blurb}>
              Equip up to {arcanaSlots(save)} Arcana to twist the rules of a fight ({arcana.length}/{arcanaSlots(save)} equipped). Tap an equipped Arcana again to take it off.
            </Text>
            {ARCANA.map(a => {
              const unlocked = save.unlockedArcana.includes(a.id);
              const equipped = arcana.includes(a.id);
              return (
                <ArcanaCard
                  key={a.id}
                  arcanaId={a.id}
                  tarot
                  showTagline
                  selected={equipped}
                  badgeText={equipped ? 'ACTIVE' : undefined}
                  lockedText={!unlocked ? `Unlock: ${unlockHint({ kind: 'arcana', id: a.id }, save)}` : undefined}
                  testID={`camp-arcana-${a.id}`}
                  onPress={() => {
                    sfx('confirm');
                    onChange(toggleArcana(save, a.id));
                  }}
                />
              );
            })}
          </>
        )}
      </ScrollView>

      {/* The weapon tapped last, explained. Docked under the list, so reading it never means scrolling back up. */}
      {tab === 'armory' && armoryFocus && (() => {
        const w = getArmoryWeapon(armoryFocus, builds);
        return w ? (
          <View style={[st.dock, { paddingBottom: insets.bottom + 8 }]} testID="camp-armory-guide">
            <TouchableOpacity onPress={() => setArmoryFocus(null)} style={st.dockClose} accessibilityLabel="Hide weapon details">
              <Text style={st.dockCloseText}>✕</Text>
            </TouchableOpacity>
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={st.dockBody}>
              <WeaponExplainer key={armoryFocus} weapon={w} build={builds[armoryFocus]} badge={charms.includes(armoryFocus) ? 'Equipped' : 'Not equipped'} defaultOpen />
            </ScrollView>
          </View>
        ) : null;
      })()}

      {returnLevel && onReturnToLevel && !(tab === 'armory' && armoryFocus) && (
        <View testID="camp-return-bar" style={[st.returnBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Btn
            testID="camp-return-fight"
            icon="lorc/crossed-swords"
            label={`Ready: ${returnLevel.id} ${returnLevel.name}`}
            onPress={() => onReturnToLevel(returnLevel)}
          />
        </View>
      )}
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.walnutFrame },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: COLORS.ivoryCard, borderBottomWidth: 2, borderBottomColor: INK },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 18, flexShrink: 1 },
  testLoadoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.actionYellow, borderRadius: 8, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, paddingHorizontal: 8, paddingVertical: 5, minHeight: 34 },
  testLoadoutText: { flexShrink: 1, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, color: INK },
  nextGoalBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.walnutSurface, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.walnutBorder, paddingHorizontal: 10, paddingVertical: 8 },
  nextGoalText: { flex: 1, flexShrink: 1, fontSize: 12, fontWeight: '700', color: COLORS.actionYellow, lineHeight: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.ivoryCard, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, paddingVertical: 10, paddingHorizontal: 12 },
  menuRowLocked: { backgroundColor: '#E9E4DC', borderColor: '#8E877D', opacity: 0.8 },
  menuIcon: { width: 50, height: 50, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  menuBadge: { position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.impactRed, borderWidth: 2, borderColor: COLORS.canvasWhite },
  menuTitle: { fontWeight: '900', fontSize: 17, color: INK, letterSpacing: 1, textTransform: 'uppercase' },
  menuSub: { fontSize: 12, color: INK, opacity: 0.8 },
  menuChevron: { fontSize: 26, fontWeight: '900', color: INK, opacity: 0.5 },
  settings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dock: { borderTopWidth: 2, borderTopColor: INK, backgroundColor: COLORS.walnutSurface, paddingTop: 8 },
  dockBody: { paddingHorizontal: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  dockClose: { position: 'absolute', top: -14, right: 12, zIndex: 2, width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  dockCloseText: { fontWeight: '900', color: INK, fontSize: 12 },
  body: { padding: 12, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  blurb: { color: TONE.onDusk, fontSize: 13, textAlign: 'center', marginVertical: 4 },
  fighter: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  fighterHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  portrait: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  fighterName: { fontWeight: '900', fontSize: 16, color: INK },
  fighterBlurb: { fontSize: 12, color: INK, opacity: 0.8 },
  usingTag: { backgroundColor: INK, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  usingText: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  passives: { gap: 6 },
  passive: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8 },
  passiveName: { fontWeight: '900', fontSize: 13, color: INK },
  passiveText: { fontSize: 12, color: INK, opacity: 0.85 },
  treeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.actionYellow, borderRadius: 8, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, paddingHorizontal: 10, paddingVertical: 8 },
  treeBtnText: { fontWeight: '900', fontSize: 13, color: INK, letterSpacing: 1, textTransform: 'uppercase' },
  treeBtnSub: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '700', color: INK, opacity: 0.75 },
  maxed: { fontWeight: '900', color: COLORS.logicTeal, letterSpacing: 1, fontSize: 12 },
  nextTier: { fontSize: 11, color: TONE.upside, fontWeight: '700' },
  slotLine: { color: TONE.onDusk, fontSize: 12, fontWeight: '700' },
  slotRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  slot: { width: 42, height: 42, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.walnutBorder, alignItems: 'center', justifyContent: 'center' },
  slotSelected: { borderColor: COLORS.actionYellow, borderWidth: 3, backgroundColor: '#FFFBEB' },
  slotEmpty: { color: COLORS.walnutBorder, fontWeight: '900', fontSize: 18 },
  slotCount: { color: TONE.onDusk, fontWeight: '900', marginLeft: 4, marginTop: 12 },
  nudgeRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  nudgeBtn: { backgroundColor: COLORS.actionYellow, borderRadius: 4, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 5, paddingVertical: 1 },
  nudgeBtnDisabled: { opacity: 0.35 },
  nudgeText: { fontSize: 10, fontWeight: '900', color: INK },
  understudyWarn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1.5, borderColor: '#D97706', paddingHorizontal: 10, paddingVertical: 6 },
  understudyWarnText: { flex: 1, flexShrink: 1, fontSize: 11.5, fontWeight: '800', color: '#92400E' },
  understudyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#CCFBF1', borderRadius: 8, borderWidth: 1.5, borderColor: '#0F766E', paddingHorizontal: 10, paddingVertical: 5 },
  understudyLinkText: { flex: 1, flexShrink: 1, fontSize: 11.5, fontWeight: '800', color: '#0F766E' },
  loadoutTools: { backgroundColor: COLORS.walnutSurface, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.walnutBorder, padding: 8, gap: 6 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autoEquipBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.actionYellow, borderRadius: 8, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, paddingHorizontal: 10, paddingVertical: 7 },
  autoEquipText: { flexShrink: 1, fontSize: 12, fontWeight: '900', color: INK },
  undoBtn: { backgroundColor: COLORS.ivoryCard, borderRadius: 8, borderWidth: 2, borderColor: INK, paddingHorizontal: 10, paddingVertical: 7 },
  undoText: { fontSize: 12, fontWeight: '900', color: INK },
  toolNote: { fontSize: 11, fontWeight: '700', color: COLORS.actionYellow, textAlign: 'center' },
  presetRow: { flexDirection: 'row', gap: 6 },
  presetSlot: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  presetLoadBtn: { flex: 1, backgroundColor: COLORS.walnutFrame, borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.walnutBorder, paddingHorizontal: 6, paddingVertical: 5 },
  presetLoadBtnSaved: { backgroundColor: COLORS.ivoryCard, borderColor: INK },
  presetName: { fontSize: 11, fontWeight: '900', color: COLORS.actionYellow },
  presetMeta: { fontSize: 9.5, fontWeight: '700', color: '#9CA3AF' },
  presetSaveBtn: { backgroundColor: COLORS.paperBeige, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 6, paddingVertical: 6 },
  presetSaveText: { fontSize: 10, fontWeight: '900', color: INK },
  filterPanel: { backgroundColor: COLORS.ivoryCard, borderRadius: 10, borderWidth: 2, borderColor: INK, padding: 8, gap: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#C5BCB0', paddingHorizontal: 8, paddingVertical: 4 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: INK, paddingVertical: 3 },
  clearText: { fontSize: 13, fontWeight: '900', color: INK, paddingHorizontal: 4 },
  chipStrip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipDivider: { width: 1.5, height: 18, backgroundColor: '#D8D0C4', marginHorizontal: 2 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.paperBeige },
  fusesBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  filterChipOn: { backgroundColor: COLORS.actionYellow },
  filterChipText: { fontSize: 11, fontWeight: '800', color: INK },
  filterChipTextOn: { fontWeight: '900', color: INK },
  sortChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1.5, borderColor: '#B8B0A4', backgroundColor: COLORS.canvasWhite },
  sortChipOn: { backgroundColor: COLORS.logicTeal, borderColor: INK },
  sortChipText: { fontSize: 10.5, fontWeight: '800', color: INK },
  sortChipTextOn: { color: COLORS.canvasWhite },
  roleChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#C5BCB0', backgroundColor: '#FAF7F2' },
  roleChipOn: { backgroundColor: INK, borderColor: INK },
  roleChipText: { fontSize: 10.5, fontWeight: '700', color: INK },
  roleChipTextOn: { color: COLORS.canvasWhite, fontWeight: '900' },
  fullNote: { color: COLORS.actionYellow, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12 },
  lockedWorkshop: { alignItems: 'center', gap: 8, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 20, marginTop: 8 },
  sectionLabel: { color: COLORS.actionYellow, fontWeight: '900', fontSize: 11, letterSpacing: 2, marginTop: 8, marginBottom: 2 },
  tierPip: { width: 18, height: 6, borderRadius: 2, backgroundColor: '#E2DBD0' },
  tierPipOn: { backgroundColor: COLORS.logicTeal },
  armory: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  shelf: { gap: 6, marginTop: 14 },
  shelfHead: { alignItems: 'center', gap: 1 },
  shelfTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.actionYellow },
  shelfBlurb: { fontSize: 11, color: TONE.onDusk, opacity: 0.85, textAlign: 'center' },
  slotWrap: { alignItems: 'center', gap: 1 },
  slotNo: { fontSize: 9, fontWeight: '900', color: TONE.onDusk, opacity: 0.8 },
  armoryItem: { width: 120, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2.5, padding: 8, alignItems: 'center', gap: 2 },
  armoryName: { fontWeight: '900', fontSize: 12, color: INK },
  tuneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#E2DBCF', paddingTop: 6, marginTop: 6 },
  tuneLabel: { fontSize: 11, fontWeight: '800', color: INK },
  tuneValue: { fontSize: 14, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  tuneMath: { fontSize: 10, fontWeight: '700', color: TONE.spent },
  tunePip: { width: 8, height: 5, borderRadius: 2, backgroundColor: '#D8D0C4' },
  tierPipAbsent: { opacity: 0.25 },
  armoryRarity: { fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  armoryDesc: { fontSize: 10, color: INK, textAlign: 'center', opacity: 0.8 },
  refundBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: TONE.coinPale, maxWidth: 536, alignSelf: 'center', width: '94%' },
  refundBannerTitle: { fontWeight: '900', fontSize: 13, color: INK },
  refundBannerSub: { fontSize: 11, color: INK, opacity: 0.8 },
  refundAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.canvasWhite, borderRadius: 8, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, paddingHorizontal: 10, paddingVertical: 6 },
  refundAllText: { fontWeight: '900', fontSize: 12, color: INK },
  refundChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 7, paddingVertical: 4 },
  refundChipText: { fontSize: 11, fontWeight: '800', color: INK },
  arcanaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12 },
  arcanaTarot: { width: 56, height: 74, borderRadius: 8, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center', gap: 4 },
  arcanaNumeral: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: INK },
  arcanaUpside: { fontSize: 12, fontWeight: '800', color: TONE.upside },
  arcanaTradeoff: { fontSize: 12, fontWeight: '700', color: TONE.tradeoff },
  returnBar: { padding: 12, backgroundColor: COLORS.paperBeige, borderTopWidth: 2, borderTopColor: INK },
  keyReadyBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: TONE.coinPale, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12 },
  keyReadyTitle: { fontWeight: '900', fontSize: 14, color: INK },
  keyReadySub: { fontSize: 12, fontWeight: '600', color: INK, opacity: 0.85 },
});

export default Camp;
