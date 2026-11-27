/**
 * Cross-Run Weapon-Linked 200-Bounty Board (Camp -> Bounties).
 *
 * Built around three scalable layers (spec-ui-systems.md §6.1):
 *   1. Sticky Command Bar: progress count, search input, 6 filter tabs
 *      (Open / Equipped / Weapons / Evos / By Weapon / Done).
 *   2. Pinned "Try Next / Almost Done" Hero Rail (top of Open tab) with 1-tap
 *      `Equip <Weapon>` (+ inline belt swap when full).
 *   3. Virtualized FlatList (stagger capped to first 8 rows) with crisp
 *      `Requires <Weapon> -> Unlocks <Weapon/Evo>` card layout, deep-link
 *      `highlightBountyId` focus, and a collapsed undiscovered teaser footer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { EASE, MS, STAGGER, staggerDelay } from '@/utils/motion';
import { sfx } from '@/audio';
import type { AdventureSave, BountyDef } from '../types';
import { getArcana } from '../data/arcana';
import { getArmoryWeapon } from '../data/armory';
import {
  BOUNTIES,
  getBounty,
  getWeaponBounties,
  isBountyWeaponOwned,
} from '../data/bounties';
import { getWeaponEvolution } from '../data/evolutions';
import { unlockHint } from '../data/rewards';
import { charmSlots, equippedCharms, weaponBuilds } from '../progress';
import { CoinPill, INK, PopIn, TONE } from './ui';

export type BountyTab = 'open' | 'equipped' | 'weapons' | 'evos' | 'by_weapon' | 'done';

const TABS: readonly { id: BountyTab; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'equipped', label: 'Equipped' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'evos', label: 'Evos' },
  { id: 'by_weapon', label: 'By Weapon' },
  { id: 'done', label: 'Done' },
];

export interface BountyBoardProps {
  save: AdventureSave;
  onClose: () => void;
  /** Where the back button leads, for screen readers */
  backLabel?: string;
  /** Deep-link from WeaponExplainer locked evolution -> switches tab & scrolls to this bounty */
  highlightBountyId?: string | null;
  /** 1-tap equip a bounty's required weapon into an open belt slot */
  onEquipWeapon?: (weaponId: string) => void;
  /** Inline 1-tap belt swap when every slot is full */
  onSwapWeapon?: (replaceId: string, withId: string) => void;
  /** Optional jump straight to Camp Armory focused on a weapon */
  onJumpToArmory?: (weaponId?: string) => void;
}

const matchesQuery = (b: BountyDef, q: string): boolean => {
  if (!q) return true;
  const reqW = b.requiresWeapon ? getArmoryWeapon(b.requiresWeapon) : undefined;
  const rewW = b.rewardWeaponId ? getArmoryWeapon(b.rewardWeaponId) : undefined;
  const rewEvo = b.rewardEvolutionId ? getWeaponEvolution(b.rewardEvolutionId) : undefined;
  const evoParent = rewEvo ? getArmoryWeapon(rewEvo.weaponId) : undefined;
  const hay = [
    b.name,
    b.description,
    reqW?.name ?? '',
    rewW?.name ?? '',
    rewEvo?.name ?? '',
    evoParent?.name ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
};

const BountyBoard: React.FC<BountyBoardProps> = ({
  save,
  onClose,
  backLabel = 'Back to map',
  highlightBountyId = null,
  onEquipWeapon,
  onSwapWeapon,
  onJumpToArmory,
}) => {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<BountyTab>('open');
  const [query, setQuery] = useState('');
  const [expandedWeapons, setExpandedWeapons] = useState<Record<string, boolean>>({});
  const [swappingKey, setSwappingKey] = useState<string | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(highlightBountyId);
  const listRef = useRef<FlatList<BountyDef>>(null);

  const doneSet = useMemo(() => new Set(save.completedBounties), [save.completedBounties]);
  const belt = useMemo(() => equippedCharms(save), [save]);
  const beltSet = useMemo(() => new Set(belt), [belt]);
  const slots = charmSlots(save);
  const beltFull = belt.length >= slots;
  const builds = useMemo(() => weaponBuilds(save), [save]);
  const cleanQuery = query.trim().toLowerCase();

  // Deep-link from WeaponExplainer locked evolution pill
  useEffect(() => {
    if (!highlightBountyId) return;
    const target = getBounty(highlightBountyId);
    setFocusedId(highlightBountyId);
    setQuery('');
    if (!target) return;
    if (doneSet.has(target.id)) {
      setTab('done');
    } else if (!isBountyWeaponOwned(save, target)) {
      setTab('open');
      setHiddenOpen(true);
    } else {
      setTab('open');
    }
  }, [highlightBountyId, doneSet, save]);

  const ownedOpenBounties = useMemo(
    () => BOUNTIES.filter(b => !doneSet.has(b.id) && isBountyWeaponOwned(save, b)),
    [doneSet, save]
  );

  const hiddenByLockedWeapon = useMemo(() => {
    const groups = new Map<string, BountyDef[]>();
    for (const b of BOUNTIES) {
      if (doneSet.has(b.id) || isBountyWeaponOwned(save, b) || !b.requiresWeapon) continue;
      const arr = groups.get(b.requiresWeapon);
      if (arr) arr.push(b);
      else groups.set(b.requiresWeapon, [b]);
    }
    return [...groups.entries()].map(([weaponId, list]) => ({ weaponId, list }));
  }, [doneSet, save]);

  const hiddenCount = useMemo(
    () => hiddenByLockedWeapon.reduce((sum, g) => sum + g.list.length, 0),
    [hiddenByLockedWeapon]
  );

  // Pinned "Try Next / Almost Done" Hero Rail (at most 3 cards on Open tab with empty search)
  const heroBounties = useMemo(() => {
    if (tab !== 'open' || cleanQuery.length > 0) return [];
    const picks: BountyDef[] = [];
    const seen = new Set<string>();

    // Priority 1: Newly opened T1 bounties for the player's most recently unlocked weapons
    for (let idx = save.armory.length - 1; idx >= 0 && picks.length < 2; idx--) {
      const wId = save.armory[idx];
      const fresh = getWeaponBounties(wId).find(
        b => !doneSet.has(b.id) && b.tier === 1 && b.progress(save) === 0
      );
      if (fresh && !seen.has(fresh.id)) {
        seen.add(fresh.id);
        picks.push(fresh);
      }
    }

    // Priority 2: Closest-to-completion open bounties (>= 60%)
    const almostDone = ownedOpenBounties
      .filter(b => !seen.has(b.id) && b.progress(save) / b.target >= 0.6)
      .sort((a, b) => b.progress(save) / b.target - a.progress(save) / a.target);
    for (const b of almostDone) {
      if (picks.length >= 3) break;
      seen.add(b.id);
      picks.push(b);
    }

    // Fallback: top open bounty on an unequipped weapon to nudge experimentation
    if (picks.length === 0 && ownedOpenBounties.length > 0) {
      picks.push(ownedOpenBounties[0]);
    }
    return picks;
  }, [tab, cleanQuery, save, doneSet, ownedOpenBounties]);

  const listItems = useMemo(() => {
    if (tab === 'by_weapon') return [];
    let pool: BountyDef[];
    if (tab === 'done') {
      pool = BOUNTIES.filter(b => doneSet.has(b.id));
    } else if (tab === 'equipped') {
      pool = ownedOpenBounties.filter(b => Boolean(b.requiresWeapon && beltSet.has(b.requiresWeapon)));
    } else if (tab === 'weapons') {
      pool = ownedOpenBounties.filter(b => Boolean(b.rewardWeaponId));
    } else if (tab === 'evos') {
      pool = ownedOpenBounties.filter(b => Boolean(b.rewardEvolutionId));
    } else {
      pool = ownedOpenBounties;
    }

    const filtered = cleanQuery ? pool.filter(b => matchesQuery(b, cleanQuery)) : pool;

    return [...filtered].sort((a, b) => {
      if (focusedId) {
        if (a.id === focusedId) return -1;
        if (b.id === focusedId) return 1;
      }
      if (tab === 'done') return a.name.localeCompare(b.name);
      const aPct = Math.min(1, a.progress(save) / a.target);
      const bPct = Math.min(1, b.progress(save) / b.target);
      if (bPct !== aPct) return bPct - aPct;
      const aHeld = a.requiresWeapon && beltSet.has(a.requiresWeapon) ? 1 : 0;
      const bHeld = b.requiresWeapon && beltSet.has(b.requiresWeapon) ? 1 : 0;
      if (bHeld !== aHeld) return bHeld - aHeld;
      return a.tier - b.tier || a.name.localeCompare(b.name);
    });
  }, [tab, doneSet, ownedOpenBounties, beltSet, cleanQuery, focusedId, save]);

  // Scroll to highlighted bounty when present in the active list
  useEffect(() => {
    if (!focusedId || tab === 'by_weapon') return;
    const idx = listItems.findIndex(b => b.id === focusedId);
    if (idx >= 0) {
      const timer = setTimeout(() => {
        listRef.current?.scrollToIndex({ index: idx, animated: !reduced, viewPosition: 0.2 });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [focusedId, listItems, tab, reduced]);

  const weaponGroups = useMemo(() => {
    if (tab !== 'by_weapon') return [];
    return save.armory
      .map(weaponId => {
        const w = getArmoryWeapon(weaponId, builds);
        const bounties = getWeaponBounties(weaponId);
        return { weaponId, weapon: w, bounties };
      })
      .filter(g => {
        if (!g.weapon || g.bounties.length === 0) return false;
        if (!cleanQuery) return true;
        return (
          g.weapon.name.toLowerCase().includes(cleanQuery) ||
          g.bounties.some(b => matchesQuery(b, cleanQuery))
        );
      })
      .sort((a, b) => {
        const aBelt = beltSet.has(a.weaponId) ? 1 : 0;
        const bBelt = beltSet.has(b.weaponId) ? 1 : 0;
        if (bBelt !== aBelt) return bBelt - aBelt;
        const aOpen = a.bounties.filter(x => !doneSet.has(x.id)).length;
        const bOpen = b.bounties.filter(x => !doneSet.has(x.id)).length;
        if (bOpen !== aOpen) return bOpen - aOpen;
        return a.weapon!.name.localeCompare(b.weapon!.name);
      });
  }, [tab, save.armory, builds, cleanQuery, beltSet, doneSet]);

  const handleEquipTap = useCallback(
    (cardKey: string, weaponId: string) => {
      if (!onEquipWeapon && !onSwapWeapon) {
        onJumpToArmory?.(weaponId);
        return;
      }
      if (!beltFull && onEquipWeapon) {
        sfx('confirm');
        onEquipWeapon(weaponId);
        setSwappingKey(null);
      } else if (onSwapWeapon) {
        sfx('click');
        setSwappingKey(cur => (cur === cardKey ? null : cardKey));
      } else {
        onJumpToArmory?.(weaponId);
      }
    },
    [beltFull, onEquipWeapon, onSwapWeapon, onJumpToArmory]
  );

  const tabCounts = useMemo(
    () => ({
      open: ownedOpenBounties.length,
      equipped: ownedOpenBounties.filter(b => Boolean(b.requiresWeapon && beltSet.has(b.requiresWeapon))).length,
      weapons: ownedOpenBounties.filter(b => Boolean(b.rewardWeaponId)).length,
      evos: ownedOpenBounties.filter(b => Boolean(b.rewardEvolutionId)).length,
      by_weapon: save.armory.length,
      done: save.completedBounties.length,
    }),
    [ownedOpenBounties, beltSet, save.armory.length, save.completedBounties.length]
  );

  const renderBountyCard = useCallback(
    (b: BountyDef, index: number, cardKey: string, isHero = false) => {
      const done = doneSet.has(b.id);
      const raw = b.progress(save);
      const cur = done ? b.target : Math.min(b.target, raw);
      const pct = Math.min(1, cur / b.target);
      const reqW = b.requiresWeapon ? getArmoryWeapon(b.requiresWeapon, builds) : undefined;
      const isOnBelt = Boolean(b.requiresWeapon && beltSet.has(b.requiresWeapon));
      const isFocused = focusedId === b.id;
      const isSwapping = swappingKey === cardKey;

      const rewardW = b.rewardWeaponId ? getArmoryWeapon(b.rewardWeaponId) : undefined;
      const rewardWOwned = Boolean(b.rewardWeaponId && save.armory.includes(b.rewardWeaponId));
      const rewardEvo = b.rewardEvolutionId ? getWeaponEvolution(b.rewardEvolutionId) : undefined;
      const rewardEvoParent = rewardEvo ? getArmoryWeapon(rewardEvo.weaponId) : undefined;
      const rewardArc = b.rewardArcanaId ? getArcana(b.rewardArcanaId) : undefined;

      const canEquipCta = Boolean(!done && b.requiresWeapon && !isOnBelt && (onEquipWeapon || onSwapWeapon || onJumpToArmory));
      const scopeLabel = b.scope === 'single_fight' ? '1 FIGHT' : b.scope === 'save' ? 'CAREER' : 'CUMULATIVE';
      const barLabel = b.scope === 'single_fight' && !done && cur > 0 ? `Best ${cur} / ${b.target}` : `${cur} / ${b.target}`;

      const cardContent = (
        <View
          testID={`bounty-card-${b.id}`}
          style={[
            st.card,
            done && st.cardDone,
            isHero && st.cardHero,
            isFocused && st.cardFocused,
          ]}
        >
          {/* Top Requirement Bridge: WITH <Weapon> + [ON BELT ✓] / [EQUIP] */}
          <View style={st.bridgeRow}>
            {reqW ? (
              <View style={st.reqLeft}>
                <WeaponAvatar weapon={reqW} size={22} />
                <Text style={st.reqText} numberOfLines={1}>
                  WITH: {reqW.name.toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={st.reqLeft}>
                <Icon name="lorc/trophy" size={14} color="#B45309" />
                <Text style={st.reqText} numberOfLines={1}>
                  GENERAL BOUNTY
                </Text>
              </View>
            )}

            <View style={st.bridgeRight}>
              <View style={st.scopePill}>
                <Text style={st.scopeText}>{scopeLabel}</Text>
              </View>
              {!done && b.requiresWeapon && isOnBelt && (
                <View style={st.onBeltPill}>
                  <Text style={st.onBeltText}>ON BELT ✓</Text>
                </View>
              )}
              {canEquipCta && b.requiresWeapon && (
                <TouchableOpacity
                  testID={`bounty-equip-${b.id}`}
                  onPress={() => handleEquipTap(cardKey, b.requiresWeapon!)}
                  style={st.equipBtn}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Equip ${reqW?.name ?? b.requiresWeapon}`}
                >
                  <Text style={st.equipBtnText}>{isSwapping ? 'CANCEL' : 'EQUIP'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Inline 1-tap swap bar when belt is full */}
          {isSwapping && b.requiresWeapon && onSwapWeapon && (
            <View style={st.swapStrip} testID={`bounty-swap-${b.id}`}>
              <Text style={st.swapPrompt}>Belt full — swap out:</Text>
              <View style={st.swapBtns}>
                {belt.map(eqId => {
                  const eqW = getArmoryWeapon(eqId, builds);
                  if (!eqW) return null;
                  return (
                    <TouchableOpacity
                      key={eqId}
                      onPress={() => {
                        sfx('confirm');
                        onSwapWeapon(eqId, b.requiresWeapon!);
                        setSwappingKey(null);
                      }}
                      style={st.swapChip}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                    >
                      <WeaponAvatar weapon={eqW} size={18} />
                      <Text style={st.swapChipText} numberOfLines={1}>{eqW.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Objective Head */}
          <View style={st.head}>
            <View style={[st.iconBox, done && { backgroundColor: COLORS.actionYellow }]}>
              <Icon name={b.icon} size={22} color={INK} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={st.nameRow}>
                <Text style={st.name} numberOfLines={1}>{b.name}</Text>
                {done ? (
                  <View style={st.claimedTag}>
                    <Text style={st.claimedText}>CLAIMED ✓</Text>
                  </View>
                ) : b.tier > 0 ? (
                  <View style={st.tierTag}>
                    <Text style={st.tierText}>T{b.tier}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={st.desc}>{b.description}</Text>
            </View>
          </View>

          <BountyProgressBar
            ratio={pct}
            color={done ? COLORS.logicTeal : COLORS.actionYellow}
            label={barLabel}
            reduced={reduced}
          />

          {/* Color-coded Reward Strip: REWARD -> Unlocks Weapon / Evo + Coins */}
          <View style={st.rewardsRow}>
            {rewardW && (
              <View style={[st.rewardStrip, st.rewardStripWeapon, done && st.chipDone]}>
                <WeaponAvatar weapon={rewardW} size={20} />
                <Text style={[st.rewardStripText, done && { color: TONE.spent }]} numberOfLines={1}>
                  {rewardWOwned ? `Lv Up: ${rewardW.name}` : `Unlocks Weapon: ${rewardW.name}`}
                </Text>
              </View>
            )}
            {rewardEvo && (
              <View style={[st.rewardStrip, st.rewardStripEvo, done && st.chipDone]}>
                {rewardEvoParent && <WeaponAvatar weapon={rewardEvoParent} size={20} />}
                <Icon name="lorc/crystal-shine" size={12} color={done ? TONE.spent : '#6D28D9'} />
                <Text style={[st.rewardStripTextEvo, done && { color: TONE.spent }]} numberOfLines={1}>
                  {rewardEvoParent ? `${rewardEvoParent.name}: ${rewardEvo.name}` : rewardEvo.name}
                </Text>
              </View>
            )}
            {rewardArc && (
              <View style={[st.rewardStrip, st.rewardStripEvo, done && st.chipDone]}>
                <Icon name={rewardArc.icon} size={14} color={done ? TONE.spent : '#6D28D9'} />
                <Text style={[st.rewardStripTextEvo, done && { color: TONE.spent }]} numberOfLines={1}>
                  Arcana: {rewardArc.name}
                </Text>
              </View>
            )}
            <View style={[st.coinChip, done && st.chipDone]}>
              <Icon name="lorc/crown-coin" size={12} color={done ? TONE.spent : TONE.coin} />
              <Text style={[st.coinText, done && { color: TONE.spent }]}>+{b.reward.coins}¢</Text>
            </View>
          </View>
        </View>
      );

      // Cap stagger animation to first 8 cards so 200-bounty lists stay silky 60fps
      if (!isHero && index < 8) {
        return (
          <PopIn delay={staggerDelay(index, 8, STAGGER.card)}>
            {cardContent}
          </PopIn>
        );
      }
      return cardContent;
    },
    [
      doneSet,
      save,
      builds,
      beltSet,
      focusedId,
      swappingKey,
      onEquipWeapon,
      onSwapWeapon,
      onJumpToArmory,
      reduced,
      handleEquipTap,
      belt,
    ]
  );

  const listHeader = useMemo(() => {
    if (heroBounties.length === 0) return null;
    return (
      <View style={st.heroRail} testID="bounty-hero-rail">
        <View style={st.heroRailHead}>
          <Icon name="delapouite/sparkles" size={13} color={COLORS.actionYellow} />
          <Text style={st.heroRailTitle}>TRY NEXT & ALMOST DONE</Text>
        </View>
        {heroBounties.map((b, idx) => (
          <View key={`hero-${b.id}`}>
            {renderBountyCard(b, idx, `hero-${b.id}`, true)}
          </View>
        ))}
      </View>
    );
  }, [heroBounties, renderBountyCard]);

  const listFooter = useMemo(() => {
    if (tab === 'done' || hiddenCount === 0) return null;
    return (
      <View style={st.hiddenWrap} testID="bounty-hidden-footer">
        <TouchableOpacity
          testID="bounty-hidden-toggle"
          onPress={() => { sfx('click'); setHiddenOpen(v => !v); }}
          style={st.hiddenHead}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityState={{ expanded: hiddenOpen }}
        >
          <Icon name="lorc/padlock" size={16} color={TONE.onDusk} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.hiddenTitle} numberOfLines={1}>
              +{hiddenCount} More Bounties Hidden
            </Text>
            <Text style={st.hiddenSub} numberOfLines={2}>
              Unlock more Armory weapons to open their Bounty chains!
            </Text>
          </View>
          <Text style={st.hiddenCaret}>{hiddenOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {hiddenOpen && (
          <View style={st.hiddenList}>
            {hiddenByLockedWeapon.map(({ weaponId, list }) => {
              const w = getArmoryWeapon(weaponId);
              const hint = unlockHint({ kind: 'weapon', id: weaponId }, save);
              const hasFocused = Boolean(focusedId && list.some(b => b.id === focusedId));
              return (
                <View key={weaponId} style={[st.hiddenRow, hasFocused && st.hiddenRowFocused]}>
                  <Icon name={w?.icon ?? 'lorc/padlock'} size={16} color={TONE.onDusk} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.hiddenRowName} numberOfLines={1}>
                      {w?.name ?? weaponId} (+{list.length} Bounties)
                    </Text>
                    {!!hint && (
                      <Text style={st.hiddenRowHint} numberOfLines={2}>{hint}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }, [tab, hiddenCount, hiddenOpen, hiddenByLockedWeapon, save, focusedId]);

  const completedCount = save.completedBounties.length;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      {/* Layer 1: Sticky Command Bar */}
      <View style={st.top}>
        <TouchableOpacity onPress={() => { sfx('back'); onClose(); }} style={st.back} accessibilityLabel={backLabel}>
          <Icon name="ui/back-arrow" size={20} color={INK} noShadow />
        </TouchableOpacity>
        <Icon name="lorc/trophy" size={22} color="#D97706" />
        <Text style={st.title}>BOUNTIES</Text>
        <Text style={st.count} testID="bounty-total-count">{completedCount}/{BOUNTIES.length}</Text>
        <View style={{ flex: 1 }} />
        <CoinPill coins={save.coins} />
      </View>

      <View style={st.commandBar}>
        <View style={st.searchRow}>
          <Icon name="lorc/magnifying-glass" size={14} color={TONE.spent} />
          <TextInput
            testID="bounty-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search weapon, evolution, or goal..."
            placeholderTextColor="#8B8174"
            style={st.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              testID="bounty-search-clear"
              onPress={() => { sfx('click'); setQuery(''); }}
              style={st.searchClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon name="lorc/cross-mark" size={12} color={INK} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.tabsRow}
        >
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                testID={`bounty-filter-${t.id}`}
                onPress={() => { sfx('click'); setTab(t.id); }}
                style={[st.filterBtn, active && st.filterBtnOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[st.filterText, active && { color: INK }]}>
                  {t.label.toUpperCase()} ({tabCounts[t.id]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Layer 2 & 3: Virtualized FlatList */}
      {tab === 'by_weapon' ? (
        <FlatList
          testID="bounty-by-weapon-list"
          data={weaponGroups}
          keyExtractor={item => item.weaponId}
          contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 24 }]}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListEmptyComponent={
            <Text style={st.emptyText}>Unlock Armory weapons to see their Bounty chains here.</Text>
          }
          ListFooterComponent={listFooter}
          renderItem={({ item }) => {
            const w = item.weapon!;
            const isExpanded = Boolean(expandedWeapons[item.weaponId]);
            const doneCount = item.bounties.filter(b => doneSet.has(b.id)).length;
            const onBelt = beltSet.has(item.weaponId);
            return (
              <View style={st.groupCard}>
                <TouchableOpacity
                  testID={`bounty-weapon-group-${item.weaponId}`}
                  onPress={() => {
                    sfx('click');
                    setExpandedWeapons(prev => ({ ...prev, [item.weaponId]: !prev[item.weaponId] }));
                  }}
                  style={st.groupHead}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <WeaponAvatar weapon={w} size={30} />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={st.groupName} numberOfLines={1}>{w.name}</Text>
                    <View style={st.pipRow}>
                      {item.bounties.map(b => (
                        <View
                          key={b.id}
                          style={[st.pip, doneSet.has(b.id) ? st.pipDone : st.pipOpen]}
                        />
                      ))}
                      <Text style={st.pipCount}>{doneCount}/{item.bounties.length}</Text>
                    </View>
                  </View>
                  {onBelt ? (
                    <View style={st.onBeltPill}>
                      <Text style={st.onBeltText}>ON BELT ✓</Text>
                    </View>
                  ) : (onEquipWeapon || onSwapWeapon) ? (
                    <TouchableOpacity
                      onPress={() => handleEquipTap(`grp-${item.weaponId}`, item.weaponId)}
                      style={st.equipBtn}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                    >
                      <Text style={st.equipBtnText}>EQUIP</Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text style={st.groupCaret}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {swappingKey === `grp-${item.weaponId}` && onSwapWeapon && (
                  <View style={st.swapStrip}>
                    <Text style={st.swapPrompt}>Belt full — swap out:</Text>
                    <View style={st.swapBtns}>
                      {belt.map(eqId => {
                        const eqW = getArmoryWeapon(eqId, builds);
                        if (!eqW) return null;
                        return (
                          <TouchableOpacity
                            key={eqId}
                            onPress={() => {
                              sfx('confirm');
                              onSwapWeapon(eqId, item.weaponId);
                              setSwappingKey(null);
                            }}
                            style={st.swapChip}
                            activeOpacity={0.82}
                          >
                            <WeaponAvatar weapon={eqW} size={18} />
                            <Text style={st.swapChipText} numberOfLines={1}>{eqW.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                {isExpanded && (
                  <View style={st.groupBody}>
                    {item.bounties.map((b, idx) => (
                      <View key={b.id}>
                        {renderBountyCard(b, idx + 8, `grp-${b.id}`, false)}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          ref={listRef}
          testID="bounty-list"
          data={listItems}
          keyExtractor={item => item.id}
          contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 24 }]}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          onScrollToIndexFailed={() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: false });
          }}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={
            <Text style={st.emptyText}>
              {cleanQuery
                ? 'No matching bounties found.'
                : tab === 'equipped'
                  ? 'Equip a weapon on your belt to see its active bounties here.'
                  : tab === 'done'
                    ? 'Complete bounties in Adventure fights to build your trophy log!'
                    : 'All open bounties in this tab are complete!'}
            </Text>
          }
          renderItem={({ item, index }) => renderBountyCard(item, index, `${tab}-${item.id}`, false)}
        />
      )}
    </View>
  );
};

/** GPU-only scaleX bounty progress bar. */
const BountyProgressBar: React.FC<{ ratio: number; color: string; label: string; reduced: boolean }> = ({
  ratio,
  color,
  label,
  reduced,
}) => {
  const clamped = Math.max(0, Math.min(1, ratio));
  const fill = useSharedValue(reduced ? clamped : 0);
  useEffect(() => {
    if (reduced) {
      fill.value = clamped;
      return;
    }
    fill.value = withTiming(clamped, { duration: MS.move, easing: EASE.enterSoft });
    return () => cancelAnimation(fill);
  }, [clamped, reduced, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));

  return (
    <View style={st.barTrack}>
      <Animated.View style={[st.barFill, { backgroundColor: color }, fillStyle]} />
      <Text style={st.barText}>{label}</Text>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.walnutFrame },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: COLORS.ivoryCard, borderBottomWidth: 2, borderBottomColor: INK },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 17 },
  count: { fontWeight: '900', fontSize: 13, color: TONE.spent, fontVariant: ['tabular-nums'] },
  commandBar: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 7,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: INK,
    paddingHorizontal: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: INK,
    paddingVertical: 0,
  },
  searchClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: { flexDirection: 'row', gap: 5, paddingBottom: 2 },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.walnutBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnOn: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  filterText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: TONE.onDusk },
  body: { padding: 12, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  heroRail: {
    gap: 8,
    marginBottom: 6,
    padding: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 184, 0, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 184, 0, 0.45)',
  },
  heroRailHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroRailTitle: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4, color: COLORS.actionYellow },
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 12,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: INK,
    padding: 11,
    gap: 8,
  },
  cardHero: { backgroundColor: '#FFFDF5', borderColor: '#B45309' },
  cardFocused: { backgroundColor: '#FFFBEB', borderColor: COLORS.actionYellow, borderWidth: 3 },
  cardDone: { backgroundColor: '#F4F1EC', borderColor: '#ABA397' },
  bridgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DFD5',
    minWidth: 0,
  },
  reqLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  reqText: { flexShrink: 1, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.7, color: INK },
  bridgeRight: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  scopePill: { backgroundColor: COLORS.paperBeige, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  scopeText: { fontSize: 8.5, fontWeight: '900', color: TONE.spent, letterSpacing: 0.5 },
  onBeltPill: { backgroundColor: '#CCFBF1', borderRadius: 4, borderWidth: 1, borderColor: COLORS.tealSurface, paddingHorizontal: 6, paddingVertical: 2 },
  onBeltText: { fontSize: 9, fontWeight: '900', color: '#0F766E', letterSpacing: 0.5 },
  equipBtn: { backgroundColor: COLORS.actionYellow, borderRadius: 5, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 7, paddingVertical: 2 },
  equipBtnText: { fontSize: 9.5, fontWeight: '900', color: INK, letterSpacing: 0.5 },
  swapStrip: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D97706',
    padding: 7,
    gap: 5,
  },
  swapPrompt: { fontSize: 10.5, fontWeight: '900', color: '#92400E' },
  swapBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  swapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  swapChipText: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: INK },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconBox: { width: 40, height: 40, borderRadius: 9, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 },
  name: { flex: 1, flexShrink: 1, fontWeight: '900', fontSize: 14.5, color: INK },
  desc: { fontSize: 12, color: INK, opacity: 0.82 },
  claimedTag: { backgroundColor: COLORS.logicTeal, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  claimedText: { fontSize: 9, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 0.8 },
  tierTag: { backgroundColor: COLORS.deepOnyx, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, flexShrink: 0 },
  tierText: { fontSize: 9, fontWeight: '900', color: COLORS.actionYellow, letterSpacing: 0.6 },
  barTrack: { height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.paperBeige, overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transformOrigin: 'left center' },
  barText: { textAlign: 'center', fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  rewardsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  rewardStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingLeft: 5,
    paddingRight: 9,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  rewardStripWeapon: { backgroundColor: '#FEF9C3', borderColor: '#D97706' },
  rewardStripEvo: { backgroundColor: '#F3E8FF', borderColor: '#7C3AED' },
  rewardStripText: { flexShrink: 1, fontSize: 11, fontWeight: '900', color: '#92400E' },
  rewardStripTextEvo: { flexShrink: 1, fontSize: 11, fontWeight: '900', color: '#5B21B6' },
  coinChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: TONE.coinPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.coin, paddingHorizontal: 8, paddingVertical: 2 },
  coinText: { fontSize: 11.5, fontWeight: '900', color: '#7A5600', fontVariant: ['tabular-nums'] },
  chipDone: { backgroundColor: '#EAE5DD', borderColor: TONE.spentEdge },
  groupCard: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    overflow: 'hidden',
  },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10 },
  groupName: { flexShrink: 1, fontSize: 14, fontWeight: '900', color: INK },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pip: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: INK },
  pipDone: { backgroundColor: COLORS.logicTeal },
  pipOpen: { backgroundColor: COLORS.paperBeige },
  pipCount: { fontSize: 10.5, fontWeight: '900', color: TONE.spent, marginLeft: 3, fontVariant: ['tabular-nums'] },
  groupCaret: { fontSize: 11, fontWeight: '900', color: TONE.spent, paddingHorizontal: 4 },
  groupBody: { padding: 8, paddingTop: 0, gap: 8, backgroundColor: COLORS.paperBeige },
  hiddenWrap: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.walnutBorder,
    backgroundColor: 'rgba(28, 25, 23, 0.45)',
    overflow: 'hidden',
  },
  hiddenHead: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 },
  hiddenTitle: { flexShrink: 1, fontSize: 13, fontWeight: '900', color: TONE.onDusk },
  hiddenSub: { flexShrink: 1, fontSize: 11, color: TONE.onDusk, opacity: 0.78 },
  hiddenCaret: { fontSize: 11, fontWeight: '900', color: TONE.onDusk },
  hiddenList: { borderTopWidth: 1, borderTopColor: COLORS.walnutBorder, padding: 10, gap: 8 },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  hiddenRowFocused: { borderWidth: 1.5, borderColor: COLORS.actionYellow },
  hiddenRowName: { flexShrink: 1, fontSize: 12, fontWeight: '900', color: TONE.onDusk },
  hiddenRowHint: { flexShrink: 1, fontSize: 11, color: TONE.onDusk, opacity: 0.78 },
  emptyText: { color: TONE.onDusk, fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 24 },
});

export default BountyBoard;
