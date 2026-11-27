/**
 * Level preview sheet — "what am I up against?"
 *
 * [UI-20] Clean 2-tab segmented switcher (`Briefing` | `Loadout`) above the
 * persistent sticky `Fight!` / `Test Loadout` footer:
 *   - Briefing (default): Foe header, Lesson, Rules, Foe Ability + Parry + Hazards,
 *     Rewards, Friendly Tailwind / Starfall Cauldron, plus a compact 1-row Loadout
 *     summary bar ("Tap Loadout to swap").
 *   - Loadout: Fighter picker + Passives, reorderable Weapon Belt (`Understudy`
 *     helper), Filter/Sort (`Fuses First` default) + 1-tap `Auto-Equip for Foe`
 *     + 3 saved Loadout Presets, single focused `WeaponExplainer`, Evolutions,
 *     and Arcana.
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, TextInput } from 'react-native';
import Animated, { ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { SCREEN_INSTANT } from '@/components/ScreenTransition';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { EASE, MS, exitMs } from '@/utils/motion';
import Icon, { IconName } from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import { scaleText, useTextScale } from '@/utils/textSizeStorage';
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId, LevelDef, MechanicDef } from '../types';
import { getBiome } from '../data/biomes';
import { foeDisplay, levelFoe } from '../data/foes';
import { getMechanic } from '../data/mechanics';
import { FIGHTERS, getFighter } from '../data/fighters';
import { getPassive } from '../data/passives';
import { ARCANA } from '../data/arcana';
import { UNDERSTUDY_ID } from '../data/adventureWeapons';
import { getArmoryWeapon, weaponLevelSuffix } from '../data/armory';
import { WEAPON_KINDS, weaponGuide } from '../data/weaponGuide';
import { WEAPON_ROLES, type WeaponRole } from '../data/weaponRoles';
import WeaponExplainer from './WeaponExplainer';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { getLevel } from '../data/levels';
import { resolveParrySpec } from '../data/parry';
import {
  CAULDRON_WAGERS,
  FRIENDLY_TAILWIND,
  TAILWIND_STAR_CAP,
  canAffordCauldronWager,
  consecutiveLossesFor,
  getCauldronWager,
  isCauldronAvailable,
  isTailwindOffered,
  shouldEnableLossStreakNudge,
  type CauldronWagerTier,
} from '../data/relief';
import { isFighterTrial, starRewards } from '../data/rewards';
import ParryPreviewCard from './ParryPreviewCard';
import { ArcanaCard, ArmedEvolutionRow, FighterPassivesList, FoeAbilityCard, HazardNotices } from './SharedCards';
import { starGoals } from '../engine/challenges';
import {
  arcanaSlots,
  armableRecipesFromArmory,
  charmSynergyWithEquipped,
  fighterStarsSpent,
  charmSlots,
  equippedArcanaOf,
  equippedCharms,
  getLockReason,
  weaponLevel,
  weaponBuilds,
} from '../progress';
import {
  DEFAULT_PRESET_NAMES,
  applyLoadoutPreset,
  autoBuildLoadout,
  filterAndSortArmory,
  loadLoadoutPresets,
  reorderCharmSlots,
  type ArmoryQuickFilter,
  type ArmorySortMode,
  type LoadoutPreset,
} from '../loadoutPresets';
import { startingLoadout } from '../loadout';
import { companionVoice, shouldShowPassiveHud } from '../coach';
import CompanionBubble from './CompanionBubble';
import { DemoView } from './MechanicIntro';
import { Btn, Heart, INK, Skulls, StarRow, TONE } from './ui';
import { Silhouette, UnlockableAvatar, describeRewardUnlocks } from './rewards';

const ATTR_ICONS = { shape: 'lorc/diamond-hard', color: 'lorc/crystal-shine', number: 'lorc/cycle', shading: 'lorc/stone-block', background: 'lorc/field' } as const;

type PreviewTab = 'briefing' | 'loadout';

const QUICK_FILTERS: { id: ArmoryQuickFilter; label: string; icon?: IconName }[] = [
  { id: 'all', label: 'All' },
  { id: 'fuses', label: 'Fuses', icon: 'lorc/crystal-shine' },
  { id: 'equipped', label: 'Equipped' },
  { id: 'lv2plus', label: 'Lv 2+' },
];

const SORT_MODES: { id: ArmorySortMode; label: string }[] = [
  { id: 'fuses', label: 'Fuses First' },
  { id: 'level', label: 'Highest Lv' },
  { id: 'az', label: 'A–Z' },
];

interface Props {
  level: LevelDef | null;
  save: AdventureSave;
  onClose: () => void;
  onPlay: (level: LevelDef) => void;
  onSelectFighter: (f: CharacterName) => void;
  /** Equip the charm if a slot is free, take it off if worn */
  onSelectCharm: (id: string) => void;
  /** Equip the Arcana (swapping out the oldest when full), take it off if worn */
  onSelectArcana?: (id: ArcanaId) => void;
  onShowMechanic: (id: string) => void;
  /** Leave for Camp (a lesson that is used there, like skill trees, offers it) */
  onOpenCamp?: (tab: NonNullable<MechanicDef['camp']>['tab']) => void;
  /** Equip the top armable recipe pair from Armory in one tap */
  onArmRecipe?: (recipeId: string) => void;
  /** [GP-18] Toggle Friendly Tailwind loss-streak relief on/off */
  onToggleTailwind?: (active: boolean) => void;
  /** [GP-18] Choose a Starfall Cauldron upward coin wager tier (0 | 1 | 2) */
  onSelectWager?: (tier: CauldronWagerTier) => void;
  /** [GP-21] Optional full-save updater for Auto-Equip, Presets, and belt slot reorder */
  onApplyLoadout?: (nextSave: AdventureSave) => void;
  /** [GP-21] Optional dedicated slot reorder callback */
  onReorderCharm?: (fromIndex: number, toIndex: number) => void;
  /** [TP-12] 1-tap launch into 1-4D Training Lab sandbox alongside FIGHT */
  onTestLoadout?: () => void;
  /** Initial tab when opened (defaults to 'briefing') */
  initialTab?: PreviewTab;
  /**
   * How the sheet goes when `level` turns null: 'slide' (put away with ✕, the
   * backdrop or the back button: it goes down the way it came), 'screen' (it
   * leaves with the screen under it, Fight! or a trip to Camp: it fades out in
   * the time the screen takes to leave) or 'cut'.
   */
  exit?: 'slide' | 'screen' | 'cut';
}

const SHEET_RISE = 96;
const KEEP = { reduceMotion: ReduceMotion.Never } as const;
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

const LevelPreview: React.FC<Props> = props => {
  const { level, onClose, exit = 'slide' } = props;
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<LevelDef | null>(level);
  const [closing, setClosing] = useState(false);
  const [foeCue, setFoeCue] = useState(0);
  const dim = useSharedValue(level ? 1 : 0);
  const rise = useSharedValue(level ? 0 : SHEET_RISE);
  const fade = useSharedValue(level ? 1 : 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpen = useRef(!!level);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const finishExit = useCallback(() => {
    if (wasOpen.current) return;
    setShown(null);
    setClosing(false);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (level) {
      const midExit = !wasOpen.current && shownRef.current !== null;
      setShown(level);
      setClosing(false);
      if (!wasOpen.current) {
        const enter = reduced ? MS.feedback : MS.panel;
        dim.value = withTiming(1, { duration: reduced ? MS.feedback : MS.quick, easing: EASE.ui, ...KEEP });
        rise.value = reduced ? 0 : withTiming(0, { duration: enter, easing: EASE.enterSoft });
        fade.value = withTiming(1, { duration: reduced ? MS.feedback : MS.feedback / 2, easing: EASE.ui, ...KEEP });
        if (!midExit) timer.current = setTimeout(() => setFoeCue(c => c + 1), reduced ? 0 : MS.feedback);
      }
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const onGone = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(finishExit)();
    };
    if (exit === 'screen' && !SCREEN_INSTANT) {
      const out = exitMs(reduced ? MS.feedback : MS.screen);
      setClosing(true);
      dim.value = withTiming(0, { duration: out, easing: EASE.exitSoft, ...KEEP });
      fade.value = withTiming(0, { duration: out, easing: EASE.exitSoft, ...KEEP }, onGone);
      return;
    }
    if (exit !== 'slide') {
      dim.value = 0;
      rise.value = SHEET_RISE;
      fade.value = 0;
      setShown(null);
      return;
    }
    const out = exitMs(reduced ? MS.feedback : MS.panel);
    setClosing(true);
    const vanish = MS.feedback / 2;
    dim.value = withTiming(0, { duration: out, easing: EASE.ui, ...KEEP });
    rise.value = reduced ? rise.value : withTiming(SHEET_RISE, { duration: out, easing: EASE.exitSoft });
    fade.value = reduced
      ? withTiming(0, { duration: out, easing: EASE.ui, ...KEEP }, onGone)
      : withDelay(out - vanish, withTiming(0, { duration: vanish, easing: EASE.exitSoft }, onGone));
  }, [level, exit, reduced, dim, rise, fade, finishExit]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!level) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [level, onClose]);

  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const backdropBox = { top: -insets.top, bottom: -insets.bottom, left: -insets.left, right: -insets.right };
  const backdropStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: rise.value }] }));

  if (!shown) return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, st.layer]}
      pointerEvents={closing ? 'none' : 'box-none'}
      testID="preview-sheet-root"
      role={closing ? undefined : 'dialog'}
      aria-modal={!closing}
      accessibilityViewIsModal={!closing}
      accessibilityElementsHidden={closing}
      importantForAccessibility={closing ? 'no-hide-descendants' : 'auto'}
    >
      <Animated.View style={[st.backdrop, backdropBox, backdropStyle]} pointerEvents="none" />
      <View style={st.overlay} pointerEvents={closing ? 'none' : 'box-none'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View style={[st.sheet, sheetStyle]}>
          <SheetContent {...props} level={shown} foeCue={foeCue} />
        </Animated.View>
      </View>
    </View>
  );
};

const SheetContent: React.FC<Props & { level: LevelDef; foeCue: number }> = ({
  level,
  save,
  onClose,
  onPlay,
  onSelectFighter,
  onSelectCharm,
  onSelectArcana,
  onShowMechanic,
  onOpenCamp,
  onArmRecipe,
  onToggleTailwind,
  onSelectWager,
  onApplyLoadout,
  onReorderCharm,
  onTestLoadout,
  initialTab = 'briefing',
  foeCue,
}) => {
  const textScale = useTextScale();
  const [activeTab, setActiveTab] = useState<PreviewTab>(initialTab);
  const [charmTapCounts, setCharmTapCounts] = useState<Record<string, number>>({});
  /** Single focused weapon explained below the shelf (never stacks 6 open explainers) */
  const [focusCharm, setFocusCharm] = useState<string | null>(null);
  const [localTailwind, setLocalTailwind] = useState<boolean>(Boolean(save.tailwindActive));
  const [localWager, setLocalWager] = useState<CauldronWagerTier>(save.cauldronWager ?? 0);
  /** [GP-21] Filter, sort (`fuses` default on LevelPreview), search, slot reorder & Auto-Equip undo */
  const [quickFilter, setQuickFilter] = useState<ArmoryQuickFilter>('all');
  const [roleFilter, setRoleFilter] = useState<WeaponRole | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<ArmorySortMode>('fuses');
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [autoUndo, setAutoUndo] = useState<{ prevSave: AdventureSave; summary: string } | null>(null);
  const [presets] = useState<(LoadoutPreset | null)[]>(() => loadLoadoutPresets());

  useEffect(() => {
    setActiveTab(initialTab);
    setSelectedSlot(null);
    setAutoUndo(null);
  }, [level.id, initialTab]);

  useEffect(() => {
    setLocalTailwind(Boolean(save.tailwindActive));
  }, [save.tailwindActive, level.id]);
  useEffect(() => {
    setLocalWager(save.cauldronWager ?? 0);
  }, [save.cauldronWager, level.id]);

  const tailwindOffered = isTailwindOffered(level, save);
  const tailwindOn = tailwindOffered && localTailwind;
  const cauldronAvailable = isCauldronAvailable(level, save);
  const activeWagerTier: CauldronWagerTier =
    !tailwindOn && cauldronAvailable && canAffordCauldronWager(save, localWager) ? localWager : 0;
  const activeWager = getCauldronWager(activeWagerTier);
  const lossStreak = consecutiveLossesFor(save, level.id);
  const stuckNudgeActive = shouldEnableLossStreakNudge(level, save);

  const handleToggleTailwind = () => {
    const next = !tailwindOn;
    setLocalTailwind(next);
    if (next && localWager !== 0) {
      setLocalWager(0);
      onSelectWager?.(0);
    }
    onToggleTailwind?.(next);
  };

  const handleSelectWager = (tier: CauldronWagerTier) => {
    if (tier !== 0 && !canAffordCauldronWager(save, tier)) return;
    setLocalWager(tier);
    if (tier > 0 && localTailwind) {
      setLocalTailwind(false);
      onToggleTailwind?.(false);
    }
    onSelectWager?.(tier);
  };

  const biome = getBiome(level.biome);
  const foe = levelFoe(level);
  const mech = getMechanic(level.introduces);
  const lock = getLockReason(save, level);
  const best = save.stars[level.id] ?? 0;
  const timed = !!level.rules.timer;
  const accuracy = level.starRule?.kind === 'accuracy';
  const texts = starGoals(level, foe.name);
  const goals = starRewards(level).map((reward, i) => ({ star: i + 1, text: texts[i], reward }));
  const isNew = !save.seenMechanics.includes(level.introduces);
  const loadout = startingLoadout(level, save);
  const gearOn = !level.rules.noGear;
  const baseTotalHp = level.foes.reduce((a, f) => a + f.hp, 0);
  const totalHp = Math.round(baseTotalHp * activeWager.foeHpScale);
  const displayHearts =
    level.rules.hearts === 0 ? 0 : level.rules.hearts + (tailwindOn ? FRIENDLY_TAILWIND.extraHearts : 0);
  const displayTimer = level.rules.timer
    ? Math.round(level.rules.timer * (tailwindOn ? FRIENDLY_TAILWIND.timerScale : 1))
    : undefined;
  const displayMoves = level.rules.moves
    ? Math.round(level.rules.moves * (tailwindOn ? FRIENDLY_TAILWIND.moveScale : 1))
    : undefined;
  const charms = equippedCharms(save);
  const slots = charmSlots(save);
  const arcana = equippedArcanaOf(save);
  const builds = weaponBuilds(save);
  const armed = EVOLUTION_RECIPES.filter(r => loadout.armedRecipes.includes(r.id));
  const evolutionsOn = gearOn && loadout.features.has('evolutions');
  const fighter = getFighter(save.selectedFighter);
  const charmsFull = charms.length >= slots;
  const practice = !!level.rules.sandbox;
  const trialFighter = isFighterTrial(level) ? FIGHTERS.find(f => f.signature === level.introduces) : undefined;
  const charmsTaught = level.introduces === 'charm' || save.seenMechanics.includes('charm') || save.armory.length > slots || practice;
  const showPassives = gearOn && shouldShowPassiveHud(level, save);
  const hasLoadoutTab =
    gearOn &&
    (charmsTaught ||
      save.unlockedFighters.length > 1 ||
      save.unlockedArcana.length > 0 ||
      showPassives);

  const filteredWeapons = useMemo(
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

  const applySaveFallback = (nextSave: AdventureSave) => {
    if (onApplyLoadout) {
      onApplyLoadout(nextSave);
      return;
    }
    if (nextSave.selectedFighter !== save.selectedFighter) {
      onSelectFighter(nextSave.selectedFighter);
    }
    const desired = nextSave.charms;
    // Remove charms not in desired, then equip desired in order
    for (const oldId of charms) {
      if (!desired.includes(oldId)) onSelectCharm(oldId);
    }
    for (const newId of desired) {
      if (!charms.includes(newId)) onSelectCharm(newId);
    }
    if (onSelectArcana) {
      for (const oldA of arcana) {
        if (!nextSave.equippedArcana.includes(oldA)) onSelectArcana(oldA);
      }
      for (const newA of nextSave.equippedArcana) {
        if (!arcana.includes(newA)) onSelectArcana(newA);
      }
    }
  };

  const handleReorder = (from: number, to: number) => {
    if (to < 0 || to >= charms.length || from === to) return;
    if (onReorderCharm) {
      onReorderCharm(from, to);
    } else if (onApplyLoadout) {
      onApplyLoadout(reorderCharmSlots(save, from, to));
    }
    setSelectedSlot(to);
  };

  const handleAutoEquip = () => {
    const prevSave = save;
    const result = autoBuildLoadout(save, level);
    setAutoUndo({ prevSave, summary: result.summary });
    setSelectedSlot(null);
    applySaveFallback(result.save);
  };

  const handleApplyPreset = (preset: LoadoutPreset) => {
    const nextSave = applyLoadoutPreset(save, preset);
    setSelectedSlot(null);
    applySaveFallback(nextSave);
  };

  /** Single focused weapon for Loadout's canonical WeaponExplainer (never stacks 6!) */
  const singleFocusedId = focusCharm ?? charms[0] ?? null;
  const singleFocusedWeapon = singleFocusedId ? getArmoryWeapon(singleFocusedId, builds) : undefined;

  return (
    <>
      <View style={[st.header, { backgroundColor: biome.colors.sky }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[st.levelId, { color: biome.colors.ink }]} numberOfLines={1}>
            {biome.name.toUpperCase()}{practice ? ' · PRACTICE' : ` · ${level.id}${level.isBoss ? ' · BOSS' : ''}${level.branchOf ? (isFighterTrial(level) ? ' · TRIAL' : ' · ELITE') : ''}`}
          </Text>
          <TouchableOpacity
            testID="preview-close"
            onPress={onClose}
            style={st.close}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Close level preview"
          >
            <Text style={st.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={st.foeRow}>
          <View style={[st.foePortrait, level.isBoss && st.foeBoss, level.branchOf && !practice && st.foeElite, practice && st.foePractice]}>
            <EnemyAvatar
              testID="preview-enemy-avatar"
              enemy={foe}
              size={level.isBoss ? 78 : 68}
              mood={level.isBoss ? 'enraged' : practice ? 'idle' : 'menacing'}
              reaction={foeCue > 0 ? { type: 'entrance', id: foeCue } : null}
              interactive
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[st.levelName, { fontSize: scaleText(24, textScale) }]}>{level.name}</Text>
            <Text style={[st.foeName, { fontSize: scaleText(14, textScale) }]}>vs {level.foes.length > 1 ? `${level.foes.length} waves` : foe.name}</Text>
            {practice ? <Text style={st.practiceTag}>NO STARS · NO CLOCK · NO LOSING</Text> : <Skulls n={level.difficulty} />}
          </View>
        </View>
        {level.foes[level.foes.length - 1].taunt && (
          <View style={st.bubble}><Text style={[st.bubbleText, { fontSize: scaleText(13, textScale) }]}>“{level.foes[level.foes.length - 1].taunt}”</Text></View>
        )}
      </View>

      {/* [UI-20] Clean 2-tab segmented switcher: Briefing | Loadout */}
      {hasLoadoutTab && (
        <View style={st.tabBar} testID="preview-tabs">
          <TouchableOpacity
            testID="preview-tab-briefing"
            onPress={() => setActiveTab('briefing')}
            style={[st.tabBtn, activeTab === 'briefing' && st.tabBtnOn]}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'briefing' }}
          >
            <Icon name="lorc/open-book" size={14} color={INK} />
            <Text style={st.tabBtnText}>BRIEFING</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="preview-tab-loadout"
            onPress={() => setActiveTab('loadout')}
            style={[st.tabBtn, activeTab === 'loadout' && st.tabBtnOn]}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'loadout' }}
          >
            <Icon name="lorc/gems" size={14} color={INK} />
            <Text style={st.tabBtnText}>LOADOUT ({charms.length}/{slots})</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={st.body} bounces={false}>
        {/* ═══════════════════════ BRIEFING TAB ═══════════════════════ */}
        {activeTab === 'briefing' && (
          <>
            {level.id === '1-1' ? (
              best === 0 ? (
                <CompanionBubble
                  testID="preview-coach"
                  character={fighter.name}
                  mood="victory"
                  text={`${companionVoice(fighter.name).hello} ${foe.name} has a star shard. I’ll show you how to win it back!`}
                />
              ) : null
            ) : practice ? null : (
              <LessonCard mech={mech} isNew={isNew} onMore={() => onShowMechanic(level.introduces)} onOpenCamp={onOpenCamp} />
            )}

            {trialFighter && save.unlockedFighters.includes(trialFighter.name) && save.selectedFighter !== trialFighter.name && (
              <View testID="preview-trial-fighter-nudge" style={st.trialNudge}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={st.evoName}>Built for {trialFighter.name}</Text>
                  <Text style={st.evoHintSub}>This trial showcases {trialFighter.name}’s two passives.</Text>
                </View>
                <Btn small testID="preview-switch-trial-fighter" label={`Switch to ${trialFighter.name}`} onPress={() => onSelectFighter(trialFighter.name)} />
              </View>
            )}

            <View style={st.rules}>
              {practice ? (
                <Rule icon="lorc/stopwatch" text="No clock" />
              ) : accuracy ? (
                <Rule icon="lorc/archery-target" text={`${Math.ceil(totalHp / 3)} matches`} />
              ) : (
                <Rule icon={timed ? 'lorc/stopwatch' : 'lorc/archery-target'} text={timed ? `${displayTimer}s` : `${displayMoves} moves`} />
              )}
              <View style={st.rule}><Heart size={16} /><Text style={st.ruleText}>{practice ? `${loadout.maxHearts ?? level.rules.hearts}, refilling` : displayHearts === 0 ? "Can't lose" : displayHearts}</Text></View>
              {!accuracy && <Rule icon="lorc/crossed-swords" text={practice ? '∞ HP' : `${totalHp} HP`} />}
              {level.rules.attributes.length >= 3 && (
                <View style={st.rule}>
                  <View style={{ flexDirection: 'row' }}>
                    {level.rules.attributes.map(a => <Icon key={a} name={ATTR_ICONS[a]} size={14} color={INK} />)}
                  </View>
                  <Text style={st.ruleText}>{level.rules.attributes.length} traits</Text>
                </View>
              )}
            </View>

            {level.foes.map((f, i) => (
              <FoeAbilityCard key={i} foe={foeDisplay(f)} />
            ))}

            {(() => {
              const parrySpec = resolveParrySpec(level, level.foes[level.foes.length - 1]);
              return parrySpec ? <ParryPreviewCard spec={parrySpec} testID="preview-parry" /> : null;
            })()}

            {level.rules.hazards && <HazardNotices hazards={level.rules.hazards} />}

            {practice && (
              <View style={st.practiceBox} testID="preview-practice">
                <Text style={st.practiceTitle}>Just for practice</Text>
                <Text style={st.abilityText}>
                  Nothing here earns stars or coins, and nothing is lost. Everything you have learned so far is switched on. Stay as long as you like.
                </Text>
                {!save.seenMechanics.includes('attr_number') && (save.stars['1-5'] ?? 0) === 0 && (
                  <Text style={st.abilityText}>
                    Heads up: the dummy’s board deals 1, 2 & 3 shapes at once — a sneak peek at the next trait!
                  </Text>
                )}
              </View>
            )}

            {/* Star goals: coins up front, unlocks kept secret */}
            {!practice && <Text style={st.section}>REWARDS</Text>}
            <View style={{ gap: 6 }}>
              {!practice && goals.map(g => {
                const done = best >= g.star;
                const unlocks = describeRewardUnlocks(g.reward, save);
                return (
                  <View key={g.star} style={[st.goal, done && st.goalDone]}>
                    <View style={st.goalTop}>
                      <StarRow stars={g.star} max={g.star} size={15} />
                      <Text style={[st.goalText, done && { opacity: 0.6 }]}>{g.text}</Text>
                      {done && <Text style={st.doneMark}>✓</Text>}
                    </View>
                    <View style={st.goalRewards}>
                      {!save.coinsUnlocked ? (
                        <View style={[st.coinChip, done && st.chipDone]} testID={`preview-shard-${g.star}`}>
                          <Icon name="lorc/flat-star" size={14} color={done ? TONE.spent : TONE.coin} />
                          <Text style={[st.coinChipText, done && { color: TONE.spent }]}>{done ? 'Shard won' : 'Star Shard'}</Text>
                        </View>
                      ) : (
                        <View style={[st.coinChip, done && st.chipDone]}>
                          <Icon name="lorc/crown-coin" size={14} color={done ? TONE.spent : TONE.coin} />
                          <Text style={[st.coinChipText, done && { color: TONE.spent }]}>{g.reward.coins}</Text>
                        </View>
                      )}
                      {unlocks.map((unlock, k) =>
                        done ? (
                          <View key={k} style={[st.unlockChip, st.chipDone]}>
                            <UnlockableAvatar display={unlock} size={20} fighterMood="idle" iconSize={16} iconColor={TONE.spent} interactive />
                            <Text style={[st.unlockText, { color: TONE.spent }]} numberOfLines={1}>{unlock.revealed}</Text>
                          </View>
                        ) : (
                          <View key={k} style={st.unlockChip}>
                            <Silhouette icon={unlock.icon} size={14} />
                            <Text style={st.unlockText}>{unlock.secret}</Text>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* [GP-18] Friendly Tailwind — warm, zero-shame relief after 2+ consecutive losses */}
            {tailwindOffered && (
              <View style={[st.reliefCard, tailwindOn && st.reliefCardOn]} testID="preview-tailwind-card">
                <View style={st.reliefHeader}>
                  <View style={st.reliefIcon}>
                    <Icon name="lorc/feather" size={18} color={INK} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.reliefEyebrow}>FRIENDLY TAILWIND · {lossStreak} TRIES</Text>
                    <Text style={st.reliefTitle}>Take a gentle breeze to push past</Text>
                  </View>
                  <TouchableOpacity
                    testID="preview-tailwind-toggle"
                    onPress={handleToggleTailwind}
                    style={[st.tailwindPill, tailwindOn && st.tailwindPillOn]}
                    activeOpacity={0.85}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: tailwindOn }}
                    accessibilityLabel={`Friendly Tailwind ${tailwindOn ? 'on' : 'off'}`}
                  >
                    <Text style={[st.tailwindPillText, tailwindOn && st.tailwindPillTextOn]}>
                      {tailwindOn ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={st.reliefDesc}>
                  +{FRIENDLY_TAILWIND.extraHearts} ♥ · +20% {timed ? 'clock' : 'moves'} · 25% slower Parries.{' '}
                  {TAILWIND_STAR_CAP === 1
                    ? 'Earns ★ to open the road ahead (★★ & ★★★ stay full strength).'
                    : 'Full stars eligible.'}
                </Text>
                {stuckNudgeActive && (
                  <Text style={st.reliefNudge} testID="preview-stuck-nudge">
                    Stuck nudge ready: 1 card softly glows after 25s quiet.
                  </Text>
                )}
              </View>
            )}

            {/* [GP-18] Starfall Cauldron — optional World 2+ upward coin wager */}
            {cauldronAvailable && !tailwindOn && (
              <View style={st.cauldronBox} testID="preview-cauldron">
                <View style={st.cauldronHead}>
                  <Icon name="lorc/campfire" size={16} color={INK} />
                  <Text style={st.cauldronTitle}>STARFALL CAULDRON</Text>
                  <Text style={st.cauldronPurse}>{save.coins}¢</Text>
                </View>
                <View style={st.wagerRow}>
                  {CAULDRON_WAGERS.map(w => {
                    const selected = activeWagerTier === w.tier;
                    const affordable = w.tier === 0 || canAffordCauldronWager(save, w.tier);
                    return (
                      <TouchableOpacity
                        key={w.tier}
                        testID={`preview-wager-${w.tier}`}
                        onPress={() => handleSelectWager(w.tier)}
                        disabled={!affordable}
                        style={[
                          st.wagerBtn,
                          selected && st.wagerBtnSel,
                          !affordable && st.wagerBtnDisabled,
                        ]}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: !affordable }}
                        accessibilityLabel={`${w.label}${w.stakeCoins > 0 ? ` (${w.stakeCoins} coins)` : ''}`}
                      >
                        <Text style={[st.wagerBtnTitle, selected && st.wagerBtnTitleSel]}>
                          {w.tier === 0 ? '0' : `+${w.tier}`} · {w.label.replace(' Wager', '')}
                        </Text>
                        <Text style={st.wagerBtnSub}>
                          {w.stakeCoins === 0 ? '1.0× coins' : affordable ? `${w.stakeCoins}¢ → ${w.coinMultiplier}×` : `Need ${w.stakeCoins}¢`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={st.cauldronSummary} testID="preview-wager-summary">{activeWager.summary}</Text>
              </View>
            )}

            {/* Early levels (before charms are taught): compact "WITH YOU" strip */}
            {gearOn && save.armory.length > 0 && !charmsTaught && (
              <View style={st.bringing} testID="preview-bringing">
                <Text style={st.bringingLabel}>WITH YOU</Text>
                {charms.map(id => {
                  const w = getArmoryWeapon(id, builds);
                  return w ? (
                    <View key={id} style={st.bringingItem}>
                      <WeaponAvatar weapon={w} size={22} />
                      <Text style={st.bringingName} numberOfLines={1}>{w.name}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            )}

            {/* [UI-20] Compact 1-row Loadout summary card on Briefing ("Tap Loadout to swap") */}
            {hasLoadoutTab && (
              <View style={st.summaryCard} testID="preview-loadout-summary">
                <TouchableOpacity
                  testID="preview-open-loadout"
                  onPress={() => setActiveTab('loadout')}
                  activeOpacity={0.85}
                  style={st.summaryHead}
                  accessibilityRole="button"
                  accessibilityLabel="Tap Loadout to swap fighter, weapons, or Arcana"
                >
                  <FighterAvatar character={fighter.name} size={34} mood="idle" animate={false} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.summaryTitle} numberOfLines={1}>{fighter.name}</Text>
                    <Text style={st.summaryHint} numberOfLines={1}>Tap Loadout to swap</Text>
                  </View>
                  <View style={st.summaryCta}>
                    <Text style={st.summaryCtaText}>LOADOUT ›</Text>
                  </View>
                </TouchableOpacity>

                {showPassives && (
                  <View style={st.summaryPassives} testID="preview-passives">
                    {fighter.passives.map(id => {
                      const p = getPassive(id);
                      return (
                        <View key={id} style={st.summaryPassiveChip}>
                          <Icon name={p.icon} size={13} color={INK} />
                          <Text style={st.summaryPassiveText} numberOfLines={1}>{p.name}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {save.armory.length > 0 && charmsTaught && (
                  <View style={st.slotRow} testID="preview-charm-slots">
                    {Array.from({ length: slots }).map((_, i) => {
                      const id = charms[i];
                      const w = id ? getArmoryWeapon(id, builds) : undefined;
                      return w ? (
                        <TouchableOpacity
                          key={i}
                          testID={`preview-slot-${i}`}
                          onPress={() => setActiveTab('loadout')}
                          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                          style={[st.slot, st.slotSmall, { borderColor: INK, borderStyle: 'solid', backgroundColor: COLORS.canvasWhite }]}
                          accessibilityLabel={`${w.name} equipped in slot ${i + 1}`}
                        >
                          <WeaponAvatar weapon={w} size={22} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          key={i}
                          testID={`preview-slot-${i}`}
                          onPress={() => setActiveTab('loadout')}
                          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                          style={[st.slot, st.slotSmall]}
                          accessibilityLabel={`Empty weapon slot ${i + 1}`}
                        >
                          <Text style={st.slotEmpty}>+</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {evolutionsOn && save.unlockedEvolutions.length > 0 && (() => {
                  const armable = armed.length === 0 ? armableRecipesFromArmory(save) : [];
                  const top = armable[0];
                  return (
                    <View style={{ gap: 6 }}>
                      <Text style={st.summaryEvo}>
                        {armed.length > 0
                          ? `${armed.length} evolution${armed.length === 1 ? '' : 's'} armed`
                          : 'No evolution armed'}
                      </Text>
                      {armed.length === 0 && top && onArmRecipe && (
                        <Btn
                          small
                          testID="preview-arm-recipe"
                          icon="lorc/fireball"
                          label={`Arm ${top.known ? top.recipe.name : '??? Evolution'}`}
                          onPress={() => onArmRecipe(top.recipe.id)}
                        />
                      )}
                    </View>
                  );
                })()}
              </View>
            )}
          </>
        )}

        {/* ═══════════════════════ LOADOUT TAB ═══════════════════════ */}
        {activeTab === 'loadout' && gearOn && (
          <View style={{ gap: 12 }} testID="preview-loadout-pane">
            {(save.unlockedFighters.length > 1 || save.seenMechanics.includes('skill_tree') || Object.keys(save.skillNodes).length > 0) && (
              <>
                <Text style={st.section}>FIGHTER</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4, paddingTop: 6 }}>
                  {FIGHTERS.filter(f => save.unlockedFighters.includes(f.name)).map(f => {
                    const selected = f.name === save.selectedFighter;
                    const rec = level.recommended?.includes(f.name);
                    const spent = fighterStarsSpent(save, f.name);
                    return (
                      <TouchableOpacity
                        key={f.name}
                        testID={`preview-fighter-${f.name}`}
                        onPress={() => onSelectFighter(f.name)}
                        style={[st.fighter, selected && st.fighterSel]}
                        activeOpacity={0.85}
                        accessibilityState={{ selected }}
                      >
                        <FighterAvatar
                          character={f.name}
                          size={42}
                          mood={selected ? 'anticipation' : 'idle'}
                          reaction={selected ? { type: 'entrance', id: 1 } : null}
                          animate={selected}
                        />
                        <Text style={st.fighterName} numberOfLines={1}>{f.name}</Text>
                        <View style={st.passiveIcons}>
                          {f.passives.map(id => <Icon key={id} name={getPassive(id).icon} size={13} color={INK} />)}
                          {spent > 0 && <Text style={st.fighterLvl}>{spent}★</Text>}
                        </View>
                        {rec && <View style={st.rec}><Text style={st.recText}>STRONG</Text></View>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {showPassives && (
              <>
                <Text style={st.section}>
                  PASSIVES <Text style={st.sectionHint}>always on for {fighter.name}</Text>
                </Text>
                <FighterPassivesList fighter={fighter.name} testID="preview-passives" />
              </>
            )}

            {save.armory.length > 0 && charmsTaught && (
              <>
                <View style={st.beltHeaderRow}>
                  <Text style={[st.section, { marginTop: 0 }]}>
                    WEAPON BELT <Text style={st.sectionHint}>{charms.length}/{slots} · tap slot to reorder</Text>
                  </Text>
                </View>

                {/* Reorderable Weapon Belt */}
                <View style={st.slotRow} testID="preview-charm-slots">
                  {Array.from({ length: slots }).map((_, i) => {
                    const id = charms[i];
                    const w = id ? getArmoryWeapon(id, builds) : undefined;
                    const isSel = selectedSlot === i;
                    return w ? (
                      <View key={i} style={{ alignItems: 'center', gap: 2 }}>
                        <TouchableOpacity
                          testID={`preview-slot-${i}`}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                          onPress={() => {
                            setFocusCharm(id);
                            if (selectedSlot === i) {
                              setSelectedSlot(null);
                              onSelectCharm(id);
                            } else if (selectedSlot !== null && (onApplyLoadout || onReorderCharm)) {
                              handleReorder(selectedSlot, i);
                            } else {
                              setSelectedSlot(i);
                            }
                          }}
                          style={[
                            st.slot,
                            { borderColor: INK, borderStyle: 'solid', backgroundColor: COLORS.canvasWhite },
                            isSel && st.slotSelected,
                          ]}
                          accessibilityLabel={`${w.name} in slot ${i + 1}`}
                        >
                          <WeaponAvatar weapon={w} size={26} />
                        </TouchableOpacity>
                        {isSel && (
                          <View style={st.nudgeRow}>
                            <TouchableOpacity
                              testID={`preview-slot-left-${i}`}
                              disabled={i === 0}
                              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                              onPress={() => handleReorder(i, i - 1)}
                              style={[st.nudgeBtn, i === 0 && st.nudgeBtnDisabled]}
                              accessibilityLabel={`Move ${w.name} left`}
                            >
                              <Text style={st.nudgeText}>◀</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              testID={`preview-slot-right-${i}`}
                              disabled={i >= charms.length - 1}
                              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                              onPress={() => handleReorder(i, i + 1)}
                              style={[st.nudgeBtn, i >= charms.length - 1 && st.nudgeBtnDisabled]}
                              accessibilityLabel={`Move ${w.name} right`}
                            >
                              <Text style={st.nudgeText}>▶</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View key={i} testID={`preview-slot-${i}`} style={st.slot}><Text style={st.slotEmpty}>+</Text></View>
                    );
                  })}
                </View>

                {understudyIdx === 0 && (
                  <View style={st.understudyWarn} testID="preview-understudy-warning">
                    <Icon name="lorc/two-shadows" size={14} color="#92400E" />
                    <Text style={st.understudyWarnText}>Understudy is in Slot 1 — tap it and press ▶ Move right to copy!</Text>
                  </View>
                )}
                {understudyIdx > 0 && understudyTarget && (
                  <View style={st.understudyLink} testID="preview-understudy-link">
                    <Icon name="lorc/two-shadows" size={14} color="#0F766E" />
                    <Text style={st.understudyLinkText}>Slot {understudyIdx + 1} Understudy ← COPIES {understudyTarget.name}</Text>
                  </View>
                )}

                {/* [GP-21] Auto-Equip for Foe + Saved Presets strip */}
                <View style={st.toolRow}>
                  <TouchableOpacity
                    testID="preview-auto-equip"
                    onPress={handleAutoEquip}
                    style={st.autoEquipBtn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Auto-Equip for ${foe.name}`}
                  >
                    <Icon name="delapouite/sparkles" size={14} color={INK} />
                    <Text style={st.autoEquipText} numberOfLines={1}>Auto-Equip for Foe</Text>
                  </TouchableOpacity>
                  {autoUndo && (
                    <TouchableOpacity
                      testID="preview-auto-equip-undo"
                      onPress={() => {
                        applySaveFallback(autoUndo.prevSave);
                        setAutoUndo(null);
                      }}
                      style={st.undoBtn}
                    >
                      <Text style={st.undoText}>Undo</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {autoUndo && <Text style={st.autoNote}>{autoUndo.summary}</Text>}

                {presets.some(Boolean) && (
                  <View style={st.presetStrip} testID="preview-presets">
                    {([0, 1, 2] as const).map(idx => {
                      const p = presets[idx];
                      if (!p) return null;
                      return (
                        <TouchableOpacity
                          key={idx}
                          testID={`preview-preset-${idx}`}
                          onPress={() => handleApplyPreset(p)}
                          style={st.presetChip}
                          activeOpacity={0.85}
                        >
                          <Text style={st.presetChipText} numberOfLines={1}>
                            {p.name || DEFAULT_PRESET_NAMES[idx]} ({p.charms.length})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* [GP-21] Compact Filter / Search / Sort strip (defaults to Fuses First) */}
                <View style={st.filterBox} testID="preview-armory-filters">
                  {save.armory.length >= 6 && (
                    <View style={st.searchRow}>
                      <Icon name="lorc/magnifying-glass" size={14} color={INK} />
                      <TextInput
                        testID="preview-armory-search"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Filter weapons..."
                        placeholderTextColor="rgba(56,56,56,0.5)"
                        style={st.searchInput}
                      />
                    </View>
                  )}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipStrip}>
                    {QUICK_FILTERS.map(f => (
                      <TouchableOpacity
                        key={f.id}
                        testID={`preview-filter-${f.id}`}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        onPress={() => setQuickFilter(f.id)}
                        style={[st.filterChip, quickFilter === f.id && st.filterChipOn]}
                      >
                        {f.icon && <Icon name={f.icon} size={11} color={INK} />}
                        <Text style={st.filterChipText}>{f.label}</Text>
                      </TouchableOpacity>
                    ))}
                    {SORT_MODES.map(m => (
                      <TouchableOpacity
                        key={m.id}
                        testID={`preview-sort-${m.id}`}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        onPress={() => setSortMode(m.id)}
                        style={[st.sortChip, sortMode === m.id && st.sortChipOn]}
                      >
                        <Text style={[st.sortChipText, sortMode === m.id && st.sortChipTextOn]}>{m.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipStrip}>
                    <TouchableOpacity
                      testID="preview-role-all"
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      onPress={() => setRoleFilter('all')}
                      style={[st.roleChip, roleFilter === 'all' && st.roleChipOn]}
                    >
                      <Text style={[st.roleChipText, roleFilter === 'all' && st.roleChipTextOn]}>All Roles</Text>
                    </TouchableOpacity>
                    {WEAPON_ROLES.map(r => (
                      <TouchableOpacity
                        key={r.id}
                        testID={`preview-role-${r.id}`}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        onPress={() => setRoleFilter(r.id)}
                        style={[st.roleChip, roleFilter === r.id && st.roleChipOn]}
                      >
                        <Text style={[st.roleChipText, roleFilter === r.id && st.roleChipTextOn]}>{r.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {filteredWeapons.map(w => {
                    const id = w.id;
                    const selected = charms.includes(id);
                    const blocked = !selected && charmsFull;
                    const wLevel = weaponLevel(save, id);
                    const synergy = !selected ? charmSynergyWithEquipped(save, id) : null;
                    return (
                      <TouchableOpacity
                        key={id}
                        testID={`charm-${id}`}
                        onPress={() => {
                          setCharmTapCounts(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
                          setFocusCharm(id);
                          setSelectedSlot(null);
                          onSelectCharm(id);
                        }}
                        style={[st.charm, selected && st.charmSel, blocked && { opacity: 0.5 }]}
                        activeOpacity={0.85}
                        accessibilityState={{ selected }}
                      >
                        <WeaponAvatar weapon={w} size={32} triggerKey={charmTapCounts[id]} />
                        <Text style={[st.fighterName, { textAlign: 'center' }]} numberOfLines={2}>{w.name}{weaponLevelSuffix(wLevel)}</Text>
                        <View style={[st.kindDot, { backgroundColor: WEAPON_KINDS[weaponGuide(id).kind].color }]}>
                          <Text style={st.kindDotText}>{WEAPON_KINDS[weaponGuide(id).kind].label.toUpperCase()}</Text>
                        </View>
                        {synergy && (
                          <View style={st.fusesTag} testID={`preview-fuses-${id}`}>
                            <Icon name="lorc/crystal-shine" size={11} color={COLORS.canvasWhite} />
                            <Text style={st.fusesText}>FUSES</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {charmsFull && save.armory.length > charms.length && (
                  <Text style={st.note}>Slots full. Tap an equipped weapon to swap it out.</Text>
                )}

                {/* [UI-20] Single focused WeaponExplainer (never stacks 6 explainers simultaneously) */}
                {singleFocusedWeapon && (
                  <View style={{ gap: 6 }} testID="preview-charm-guide">
                    <WeaponExplainer
                      key={singleFocusedWeapon.id}
                      weapon={singleFocusedWeapon}
                      build={builds[singleFocusedWeapon.id]}
                      badge={charms.includes(singleFocusedWeapon.id) ? 'Equipped' : charmsFull ? 'Slots full' : 'Not equipped'}
                      defaultOpen={focusCharm === singleFocusedWeapon.id}
                    />
                  </View>
                )}
              </>
            )}

            {/* Evolutions: which unlocked recipes the current weapons arm */}
            {evolutionsOn && save.unlockedEvolutions.length > 0 && (
              <View style={st.evoBox} testID="preview-evolutions">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="lorc/crystal-shine" size={16} color={TONE.combo} />
                  <Text style={st.evoHintTitle}>
                    {armed.length > 0 ? `${armed.length} evolution${armed.length === 1 ? '' : 's'} armed` : 'No evolution armed'}
                  </Text>
                </View>
                {armed.map(r => {
                  const known = save.unlockedEvolutions.includes(r.id) || save.discoveredEvolutions.includes(r.id);
                  return <ArmedEvolutionRow key={r.id} recipe={r} known={known} testID={`preview-recipe-${r.id}`} />;
                })}
                {armed.length > 0 ? (
                  <Text style={[st.evoHintSub, { fontSize: scaleText(11, textScale) }]} testID="preview-evo-likelihood">
                    {Math.round(loadout.evolutionLikelihood)}% chance for a Catalyst on new cards · {Number.isFinite(loadout.evolutionCap) ? `up to ${loadout.evolutionCap} evolutions this fight` : 'as many evolutions as you like'}. Match the Catalyst to evolve for 30 s.
                  </Text>
                ) : (() => {
                  const armable = armableRecipesFromArmory(save);
                  if (armable.length === 0 || !onArmRecipe) return null;
                  const top = armable[0];
                  const w0 = getArmoryWeapon(top.pair[0]);
                  const w1 = getArmoryWeapon(top.pair[1]);
                  return (
                    <View style={{ gap: 6 }}>
                      <Text style={st.evoHintSub}>
                        Equip {w0?.name ?? top.pair[0]} + {w1?.name ?? top.pair[1]} to arm {top.known ? top.recipe.name : '??? Evolution'}.
                      </Text>
                      <Btn
                        small
                        testID="preview-arm-recipe"
                        icon="lorc/fireball"
                        label={`Arm ${top.known ? top.recipe.name : '??? Evolution'}`}
                        onPress={() => onArmRecipe(top.recipe.id)}
                      />
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Arcana slots */}
            {save.unlockedArcana.length > 0 && onSelectArcana && (
              <>
                <Text style={st.section}>
                  ARCANA <Text style={st.sectionHint}>{arcana.length}/{arcanaSlots(save)} · optional rule twists</Text>
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {ARCANA.filter(a => save.unlockedArcana.includes(a.id)).map(a => {
                    const selected = arcana.includes(a.id);
                    return (
                      <TouchableOpacity
                        key={a.id}
                        testID={`preview-arcana-${a.id}`}
                        onPress={() => onSelectArcana(a.id)}
                        style={[st.arcanaItem, { borderColor: selected ? INK : '#A855F7' }, selected && st.charmSel]}
                        activeOpacity={0.85}
                        accessibilityState={{ selected }}
                      >
                        <Text style={st.arcanaNum}>{a.numeral}</Text>
                        <Icon name={a.icon} size={22} color={INK} />
                        <Text style={st.fighterName} numberOfLines={1}>{a.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {arcana.length === 0 ? (
                  <Text style={st.note}>Standard rules. Tap an Arcana to bring it along.</Text>
                ) : (
                  arcana.map(id => <ArcanaCard key={id} arcanaId={id} />)
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <View style={st.footer}>
        {lock ? (
          <View style={st.locked}>
            <Icon name="lorc/padlock" size={18} color={INK} />
            <Text style={st.lockedText}>
              {lock.kind === 'previous'
                ? 'Earn a star on the previous level to unlock.'
                : lock.kind === 'branch'
                  ? `${isFighterTrial(level) ? 'Fighter trial' : 'Elite path'}. Earn ${'★'.repeat(lock.need)} on ${lock.parentId} ${getLevel(lock.parentId).name} to open it.`
                  : `Need ${lock.need} ★ total to enter ${biome.name} (you have ${lock.have}).`}
            </Text>
          </View>
        ) : (
          <View style={st.footerActions}>
            {onTestLoadout && !practice && (
              <Btn
                testID="preview-test-loadout"
                variant="secondary"
                label="Test Loadout"
                icon="lorc/target-dummy"
                onPress={onTestLoadout}
                style={{ flex: 0.9 }}
              />
            )}
            <Btn
              testID="preview-play"
              label={practice ? 'Practice' : best > 0 ? 'Play again' : 'Fight!'}
              icon={practice ? 'lorc/target-dummy' : 'lorc/crossed-swords'}
              onPress={() => onPlay(level)}
              style={{ flex: 1.3 }}
            />
          </View>
        )}
      </View>
    </>
  );
};

const LessonCard: React.FC<{ mech: MechanicDef; isNew: boolean; onMore: () => void; onOpenCamp?: Props['onOpenCamp'] }> = ({ mech, isNew, onMore, onOpenCamp }) => (
  <TouchableOpacity testID="preview-lesson" onPress={onMore} activeOpacity={0.9} style={[st.lesson, isNew && st.lessonNew]} accessibilityRole="button" accessibilityLabel={`${mech.title}: ${mech.tagline} Tap to read more`}>
    <View style={st.lessonHead}>
      <View style={[st.lessonIcon, isNew && { backgroundColor: COLORS.actionYellow }]}><Icon name={mech.icon} size={20} color={INK} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {isNew && <Text style={st.lessonEyebrow}>NEW</Text>}
        <Text style={st.lessonTitle}>{mech.title}</Text>
      </View>
      <Text style={st.lessonMore}>More ›</Text>
    </View>
    <Text style={st.lessonText}>{mech.tagline}</Text>
    {isNew && mech.demo && <DemoView demo={mech.demo} light compact />}
    {mech.camp && onOpenCamp && (
      <Btn testID="preview-lesson-camp" small variant="secondary" icon="lorc/campfire" label={mech.camp.label} onPress={() => onOpenCamp(mech.camp!.tab)} />
    )}
  </TouchableOpacity>
);

const Rule: React.FC<{ icon: IconName; text: string }> = ({ icon, text }) => (
  <View style={st.rule}>
    <Icon name={icon} size={18} color={INK} />
    <Text style={st.ruleText}>{text}</Text>
  </View>
);

const st = StyleSheet.create({
  layer: { zIndex: 100, elevation: 100 },
  backdrop: { position: 'absolute', backgroundColor: 'rgba(18,18,18,0.55)' },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '94%', backgroundColor: COLORS.canvasWhite, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: INK, overflow: 'hidden' },
  header: { padding: 16, gap: 10, borderBottomWidth: 2, borderBottomColor: INK },
  levelId: { flex: 1, flexShrink: 1, marginRight: 8, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  close: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 15, fontWeight: '900', color: INK },
  foeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  foePortrait: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  foeBoss: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.actionYellow },
  foeElite: { backgroundColor: '#5B2333', borderColor: COLORS.deepOnyx },
  foePractice: { backgroundColor: '#F6E3A8' },
  practiceTag: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, color: INK, opacity: 0.8 },
  practiceBox: { gap: 4, backgroundColor: '#FBF3D6', borderRadius: 8, padding: 10, borderWidth: 1.5, borderColor: '#8A6420' },
  practiceTitle: { fontWeight: '900', fontSize: 14, color: INK },
  levelName: { fontSize: 24, fontWeight: '900', color: INK },
  foeName: { fontSize: 14, fontWeight: '700', color: INK, opacity: 0.8 },
  bubble: { alignSelf: 'flex-start', backgroundColor: COLORS.canvasWhite, borderWidth: 2, borderColor: INK, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 20 },
  bubbleText: { fontStyle: 'italic', color: INK, fontSize: 13 },
  tabBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.paperBeige, borderBottomWidth: 2, borderBottomColor: INK },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 9, borderWidth: 2, borderColor: '#B8B0A4', backgroundColor: COLORS.canvasWhite },
  tabBtnOn: { backgroundColor: COLORS.actionYellow, borderColor: INK, borderBottomWidth: 4 },
  tabBtnText: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: INK },
  body: { padding: 16, gap: 12 },
  summaryCard: { backgroundColor: COLORS.paperBeige, borderRadius: 12, borderWidth: 2, borderColor: INK, padding: 10, gap: 8 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  summaryTitle: { fontSize: 14, fontWeight: '900', color: INK, flexShrink: 1 },
  summaryHint: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.65, flexShrink: 1 },
  summaryCta: { backgroundColor: COLORS.actionYellow, borderRadius: 7, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 9, paddingVertical: 5 },
  summaryCtaText: { fontSize: 11, fontWeight: '900', color: INK, letterSpacing: 0.8 },
  summaryPassives: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  summaryPassiveChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 6, borderWidth: 1, borderColor: '#C5BCB0', paddingHorizontal: 7, paddingVertical: 3 },
  summaryPassiveText: { fontSize: 11, fontWeight: '800', color: INK, flexShrink: 1 },
  summaryEvo: { fontSize: 11, fontWeight: '800', color: TONE.combo },
  beltHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotSmall: { width: 34, height: 34 },
  slotSelected: { borderColor: COLORS.actionYellow, borderWidth: 3, backgroundColor: '#FFFBEB' },
  nudgeRow: { flexDirection: 'row', gap: 4 },
  nudgeBtn: { minWidth: 28, minHeight: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.actionYellow, borderRadius: 5, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 6, paddingVertical: 2 },
  nudgeBtnDisabled: { opacity: 0.35 },
  nudgeText: { fontSize: 11, fontWeight: '900', color: INK },
  understudyWarn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1.5, borderColor: '#D97706', paddingHorizontal: 9, paddingVertical: 5 },
  understudyWarnText: { flex: 1, flexShrink: 1, fontSize: 11, fontWeight: '800', color: '#92400E' },
  understudyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#CCFBF1', borderRadius: 8, borderWidth: 1.5, borderColor: '#0F766E', paddingHorizontal: 9, paddingVertical: 5 },
  understudyLinkText: { flex: 1, flexShrink: 1, fontSize: 11, fontWeight: '800', color: '#0F766E' },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autoEquipBtn: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.actionYellow, borderRadius: 8, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, paddingHorizontal: 10, paddingVertical: 7 },
  autoEquipText: { flexShrink: 1, fontSize: 12, fontWeight: '900', color: INK },
  undoBtn: { minHeight: 44, justifyContent: 'center', backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 2, borderColor: INK, paddingHorizontal: 12, paddingVertical: 7 },
  undoText: { fontSize: 12, fontWeight: '900', color: INK },
  autoNote: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  presetStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: { minHeight: 34, justifyContent: 'center', backgroundColor: COLORS.paperBeige, borderRadius: 7, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 10, paddingVertical: 5 },
  presetChipText: { fontSize: 11, fontWeight: '800', color: INK },
  filterBox: { backgroundColor: COLORS.paperBeige, borderRadius: 9, borderWidth: 1.5, borderColor: '#C5BCB0', padding: 7, gap: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, backgroundColor: COLORS.canvasWhite, borderRadius: 7, borderWidth: 1, borderColor: '#C5BCB0', paddingHorizontal: 7, paddingVertical: 3 },
  searchInput: { flex: 1, fontSize: 12, fontWeight: '600', color: INK, paddingVertical: 2 },
  chipStrip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 32, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  filterChipOn: { backgroundColor: COLORS.actionYellow },
  filterChipText: { fontSize: 11, fontWeight: '800', color: INK },
  sortChip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1.5, borderColor: '#B8B0A4', backgroundColor: COLORS.canvasWhite },
  sortChipOn: { backgroundColor: COLORS.tealSurface, borderColor: INK },
  sortChipText: { fontSize: 11, fontWeight: '800', color: INK },
  sortChipTextOn: { color: COLORS.canvasWhite },
  roleChip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#C5BCB0', backgroundColor: COLORS.canvasWhite },
  roleChipOn: { backgroundColor: INK, borderColor: INK },
  roleChipText: { fontSize: 11, fontWeight: '700', color: INK },
  roleChipTextOn: { color: COLORS.canvasWhite, fontWeight: '900' },
  lesson: { gap: 8, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: TONE.spentEdge, backgroundColor: COLORS.paperBeige },
  lessonNew: { borderColor: INK, borderBottomWidth: 4, backgroundColor: '#FFFBEB' },
  lessonHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lessonIcon: { width: 36, height: 36, borderRadius: 9, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  lessonEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: '#9A5B00' },
  lessonTitle: { flexShrink: 1, fontSize: 17, fontWeight: '900', color: INK },
  lessonMore: { fontSize: 12, fontWeight: '800', color: INK, opacity: 0.6 },
  lessonText: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '700', color: INK },
  bringing: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  bringingLabel: { fontWeight: '900', letterSpacing: 2, fontSize: 11, color: INK, opacity: 0.7 },
  bringingItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%', backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingLeft: 4, paddingRight: 9, paddingVertical: 2 },
  bringingName: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: INK },
  rules: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1.5, borderColor: INK },
  ruleText: { fontWeight: '800', fontSize: 13, color: INK },
  abilityText: { flex: 1, color: INK, fontSize: 13 },
  goal: { gap: 6, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  goalDone: { backgroundColor: '#F4F1EC', borderColor: TONE.spentEdge },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalText: { flex: 1, fontWeight: '800', color: INK, fontSize: 14 },
  doneMark: { color: COLORS.logicTeal, fontWeight: '900', fontSize: 16 },
  goalRewards: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  coinChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: TONE.coinPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.coin, paddingHorizontal: 8, paddingVertical: 2 },
  coinChipText: { fontWeight: '900', color: '#7A5600', fontSize: 13 },
  unlockChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, backgroundColor: COLORS.deepOnyx, borderRadius: 999, paddingLeft: 3, paddingRight: 10, paddingVertical: 2, maxWidth: '100%' },
  unlockText: { flexShrink: 1, fontWeight: '800', color: COLORS.actionYellow, fontSize: 12 },
  chipDone: { backgroundColor: '#EAE5DD', borderColor: TONE.spentEdge, paddingLeft: 8 },
  section: { fontWeight: '900', letterSpacing: 2, fontSize: 12, color: INK, marginTop: 4 },
  sectionHint: { fontWeight: '600', letterSpacing: 0, fontSize: 11, opacity: 0.7 },
  note: { fontSize: 12, color: INK, opacity: 0.7 },
  fighter: { width: 96, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 2, borderColor: TONE.spentEdge, backgroundColor: COLORS.paperBeige, gap: 2 },
  fighterSel: { borderColor: INK, backgroundColor: COLORS.actionYellow, borderBottomWidth: 4 },
  fighterName: { fontSize: 11, fontWeight: '800', color: INK },
  fighterLvl: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.75 },
  rec: { position: 'absolute', top: -6, right: -4, backgroundColor: COLORS.tealSurface, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: INK },
  recText: { fontSize: 11, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 0.6 },
  charm: { width: 104, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 2, backgroundColor: COLORS.paperBeige, gap: 3 },
  charmSel: { backgroundColor: COLORS.actionYellow, borderBottomWidth: 4 },
  kindDot: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, marginTop: 2 },
  kindDotText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2, color: COLORS.canvasWhite },
  fusesTag: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: TONE.combo, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: INK },
  fusesText: { fontSize: 11, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 0.3 },
  trialNudge: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.actionYellow },
  evoBox: { gap: 6, backgroundColor: TONE.comboPale, borderRadius: 8, borderWidth: 1.5, borderColor: TONE.combo, padding: 8 },
  evoName: { fontSize: 12, fontWeight: '900', color: INK },
  passiveIcons: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  slotRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  slot: { width: 42, height: 42, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: TONE.spentEdge, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  slotEmpty: { color: TONE.spent, fontWeight: '900', fontSize: 18 },
  evoHintTitle: { flexShrink: 1, fontSize: 12, fontWeight: '900', color: INK },
  evoHintSub: { fontSize: 11, color: INK, opacity: 0.85 },
  arcanaItem: { width: 106, alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 10, borderWidth: 2, backgroundColor: COLORS.paperBeige, gap: 2 },
  arcanaNum: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, color: TONE.arcana },
  reliefCard: { gap: 6, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: '#0F766E', backgroundColor: '#F0FDFA' },
  reliefCardOn: { backgroundColor: '#CCFBF1', borderBottomWidth: 4 },
  reliefHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reliefIcon: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  reliefEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, color: '#0F766E' },
  reliefTitle: { fontSize: 13, fontWeight: '900', color: INK },
  reliefDesc: { fontSize: 12, lineHeight: 17, color: INK },
  reliefNudge: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  tailwindPill: { minWidth: 58, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  tailwindPillOn: { backgroundColor: '#0F766E' },
  tailwindPillText: { fontSize: 12, fontWeight: '900', color: INK, letterSpacing: 0.8 },
  tailwindPillTextOn: { color: COLORS.canvasWhite },
  cauldronBox: { gap: 8, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: '#B45309', backgroundColor: '#FFFBEB' },
  cauldronHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cauldronTitle: { flex: 1, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: INK },
  cauldronPurse: { fontSize: 12, fontWeight: '900', color: '#92400E' },
  wagerRow: { flexDirection: 'row', gap: 6 },
  wagerBtn: { flex: 1, minHeight: 44, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 9, borderWidth: 2, borderColor: TONE.spentEdge, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center', gap: 2 },
  wagerBtnSel: { borderColor: INK, borderBottomWidth: 4, backgroundColor: COLORS.actionYellow },
  wagerBtnDisabled: { opacity: 0.45 },
  wagerBtnTitle: { fontSize: 11, fontWeight: '900', color: INK, textAlign: 'center' },
  wagerBtnTitleSel: { color: INK },
  wagerBtnSub: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.8, textAlign: 'center' },
  cauldronSummary: { fontSize: 11, fontWeight: '700', color: '#78350F', lineHeight: 16 },
  footer: { padding: 14, borderTopWidth: 2, borderTopColor: INK, backgroundColor: COLORS.paperBeige },
  footerActions: { flexDirection: 'row', gap: 8 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  lockedText: { color: INK, fontWeight: '700', flexShrink: 1 },
});

export default LevelPreview;
