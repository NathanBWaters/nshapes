/**
 * Level preview sheet — "what am I up against?" Foe, difficulty, new
 * mechanic, star goals with their coin rewards, secret unlocks shown as
 * silhouettes, and the fighter + charm you'll bring.
 */
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
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
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId, LevelDef, MechanicDef } from '../types';
import { getBiome } from '../data/biomes';
import { foeDisplay, levelFoe } from '../data/foes';
import { getMechanic } from '../data/mechanics';
import { FIGHTERS, getFighter } from '../data/fighters';
import { getPassive } from '../data/passives';
import { ARCANA } from '../data/arcana';
import { getArmoryWeapon, weaponLevelSuffix } from '../data/armory';
import { WEAPON_KINDS, weaponGuide } from '../data/weaponGuide';
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
import { startingLoadout } from '../loadout';
import { companionVoice, shouldShowPassiveHud } from '../coach';
import CompanionBubble from './CompanionBubble';
import { DemoView } from './MechanicIntro';
import { Btn, Heart, INK, Skulls, StarRow, TONE } from './ui';
import { Silhouette, UnlockableAvatar, describeRewardUnlocks } from './rewards';

const ATTR_ICONS = { shape: 'lorc/diamond-hard', color: 'lorc/crystal-shine', number: 'lorc/cycle', shading: 'lorc/stone-block', background: 'lorc/field' } as const;

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
  /**
   * How the sheet goes when `level` turns null: 'slide' (put away with ✕, the
   * backdrop or the back button: it goes down the way it came), 'screen' (it
   * leaves with the screen under it, Fight! or a trip to Camp: it fades out in
   * the time the screen takes to leave) or 'cut'.
   */
  exit?: 'slide' | 'screen' | 'cut';
}

/**
 * The sheet's motion (docs/motion/reviews/preview-sheet.md). The backdrop
 * dims in place; the sheet rises a short way on its own; the foe drops into
 * its portrait once the sheet is nearly there; put away, it goes back down the
 * same way in two thirds of the time. Interrupted either way, every value
 * carries on from where it is to the new end, so a quick double tap always
 * ends fully open or fully closed.
 */
const SHEET_RISE = 96;
/** Fades still play when the device asks for reduced motion (Reanimated would otherwise cut them): only the travel goes */
const KEEP = { reduceMotion: ReduceMotion.Never } as const;
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

const LevelPreview: React.FC<Props> = props => {
  const { level, onClose, exit = 'slide' } = props;
  const reduced = useReducedMotion();
  /** The level on screen: it outlives `level` while the sheet goes down */
  const [shown, setShown] = useState<LevelDef | null>(level);
  const [closing, setClosing] = useState(false);
  /** Bumped on every opening: the foe's drop-in waits for the sheet */
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
      // Reopened before the exit finished: the sheet is still there, so the foe stays put
      const midExit = !wasOpen.current && shownRef.current !== null;
      setShown(level);
      setClosing(false);
      if (!wasOpen.current) {
        // Opening (or reopening mid-exit): from wherever the values are now
        const enter = reduced ? MS.feedback : MS.panel;
        dim.value = withTiming(1, { duration: reduced ? MS.feedback : MS.quick, easing: EASE.ui, ...KEEP });
        rise.value = reduced ? 0 : withTiming(0, { duration: enter, easing: EASE.enterSoft });
        // Opaque within 4 frames: a longer fade shows the map's words through the sheet
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
      // Goes with the screen under it: no travel of its own, gone when the screen is
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
    // The backdrop answers the tap at once (ease-out); the sheet accelerates away, opaque,
    // and only fades in its last 4 frames, as it came (a long fade shows the map through it)
    const vanish = MS.feedback / 2;
    dim.value = withTiming(0, { duration: out, easing: EASE.ui, ...KEEP });
    rise.value = reduced ? rise.value : withTiming(SHEET_RISE, { duration: out, easing: EASE.exitSoft });
    // Gone only once it has faded all the way (an interrupted exit does not finish, so it does not unmount)
    fade.value = reduced
      ? withTiming(0, { duration: out, easing: EASE.ui, ...KEEP }, onGone)
      : withDelay(out - vanish, withTiming(0, { duration: vanish, easing: EASE.exitSoft }, onGone));
  }, [level, exit, reduced, dim, rise, fade, finishExit]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Android's back button puts the sheet away, as the modal it replaces did
  useEffect(() => {
    if (!level) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [level, onClose]);

  // The context, not the hook: a sheet rendered without a provider (a test) simply has no insets
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  /**
   * The dim covers the whole phone, as the Modal's did: AdventureMode sits inside
   * the app's SafeAreaView, so the backdrop reaches past its box by the insets
   * (no ancestor clips: AdventureMode, Game and app/index.tsx have no overflow
   * hidden). The sheet itself stays inside the safe area. On web the insets are 0.
   */
  const backdropBox = { top: -insets.top, bottom: -insets.bottom, left: -insets.left, right: -insets.right };
  const backdropStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: rise.value }] }));

  if (!shown) return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, st.layer]}
      pointerEvents={closing ? 'none' : 'box-none'}
      testID="preview-sheet-root"
      // What the Modal gave for free: screen readers stay in the sheet, not on the map behind it.
      // Once closing begins, release modal focus immediately so the map behind is accessible again.
      role={closing ? undefined : 'dialog'}
      aria-modal={!closing}
      accessibilityViewIsModal={!closing}
      accessibilityElementsHidden={closing}
      importantForAccessibility={closing ? 'no-hide-descendants' : 'auto'}
    >
      <Animated.View style={[st.backdrop, backdropBox, backdropStyle]} pointerEvents="none" />
      {/* box-none hands touches to its children, so the closing sheet must say none here too */}
      <View style={st.overlay} pointerEvents={closing ? 'none' : 'box-none'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View style={[st.sheet, sheetStyle]}>
          <SheetContent {...props} level={shown} foeCue={foeCue} />
        </Animated.View>
      </View>
    </View>
  );
};

const SheetContent: React.FC<Props & { level: LevelDef; foeCue: number }> = ({ level, save, onClose, onPlay, onSelectFighter, onSelectCharm, onSelectArcana, onShowMechanic, onOpenCamp, onArmRecipe, onToggleTailwind, onSelectWager, foeCue }) => {
  const [charmTapCounts, setCharmTapCounts] = useState<Record<string, number>>({});
  /** The charm tapped last: explained below the row even when it could not be equipped */
  const [focusCharm, setFocusCharm] = useState<string | null>(null);
  const [localTailwind, setLocalTailwind] = useState<boolean>(Boolean(save.tailwindActive));
  const [localWager, setLocalWager] = useState<CauldronWagerTier>(save.cauldronWager ?? 0);
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
  // The engine's view: it also counts skill nodes and charms that add evolution likelihood
  const armed = EVOLUTION_RECIPES.filter(r => loadout.armedRecipes.includes(r.id));
  const evolutionsOn = gearOn && loadout.features.has('evolutions');
  const fighter = getFighter(save.selectedFighter);
  const charmsFull = charms.length >= slots;
  /** A practice fight: nothing to win or lose, so no goals, rewards or difficulty */
  const practice = !!level.rules.sandbox;
  const trialFighter = isFighterTrial(level) ? FIGHTERS.find(f => f.signature === level.introduces) : undefined;
  // Swapping charms is its own lesson (the level that introduces 'charm'); before it, or with nothing to swap, the picker stays away
  const charmsTaught = level.introduces === 'charm' || save.seenMechanics.includes('charm') || save.armory.length > slots || practice;

  return (
    <>
          <View style={[st.header, { backgroundColor: biome.colors.sky }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[st.levelId, { color: biome.colors.ink }]}>
                {biome.name.toUpperCase()}{practice ? ' · PRACTICE' : ` · ${level.id}${level.isBoss ? ' · BOSS' : ''}${level.branchOf ? (isFighterTrial(level) ? ' · TRIAL' : ' · ELITE') : ''}`}
              </Text>
              <TouchableOpacity testID="preview-close" onPress={onClose} style={st.close}><Text style={st.closeText}>✕</Text></TouchableOpacity>
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
                <Text style={st.levelName}>{level.name}</Text>
                <Text style={st.foeName}>vs {level.foes.length > 1 ? `${level.foes.length} waves` : foe.name}</Text>
                {practice ? <Text style={st.practiceTag}>NO STARS · NO CLOCK · NO LOSING</Text> : <Skulls n={level.difficulty} />}
              </View>
            </View>
            {level.foes[level.foes.length - 1].taunt && (
              <View style={st.bubble}><Text style={st.bubbleText}>“{level.foes[level.foes.length - 1].taunt}”</Text></View>
            )}
          </View>

          <ScrollView contentContainerStyle={st.body} bounces={false}>
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
              // The lesson: the one new thing this level brings, with its picture. Tap for the full page.
              // (A practice level says what it is in its own box, below.)
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

            {gearOn && (
              <>
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
                {shouldShowPassiveHud(level, save) && (
                  <>
                    <Text style={st.section}>
                      PASSIVES <Text style={st.sectionHint}>always on for {fighter.name}</Text>
                    </Text>
                    <FighterPassivesList fighter={fighter.name} testID="preview-passives" />
                  </>
                )}
              </>
            )}

            {/* Until charms are taught, the weapons simply come along: nothing to manage yet */}
            {gearOn && save.armory.length > 0 && !charmsTaught && (
              <View style={st.bringing} testID="preview-bringing">
                <Text style={st.bringingLabel}>WITH YOU</Text>
                {charms.map(id => {
                  const w = getArmoryWeapon(id, weaponBuilds(save));
                  return w ? (
                    <View key={id} style={st.bringingItem}>
                      <WeaponAvatar weapon={w} size={22} />
                      <Text style={st.bringingName} numberOfLines={1}>{w.name}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            )}

            {gearOn && save.armory.length > 0 && charmsTaught && (
              <>
                <Text style={st.section}>
                  CHARMS <Text style={st.sectionHint}>{charms.length}/{slots} equipped · tap to equip or remove</Text>
                </Text>
                <View style={st.slotRow} testID="preview-charm-slots">
                  {Array.from({ length: slots }).map((_, i) => {
                    const id = charms[i];
                    const w = id ? getArmoryWeapon(id, weaponBuilds(save)) : undefined;
                    return w ? (
                      <TouchableOpacity
                        key={i}
                        testID={`preview-slot-${i}`}
                        onPress={() => onSelectCharm(id)}
                        style={[st.slot, { borderColor: INK, borderStyle: 'solid', backgroundColor: COLORS.canvasWhite }]}
                        accessibilityLabel={`Remove ${w.name}`}
                      >
                        <WeaponAvatar weapon={w} size={26} />
                      </TouchableOpacity>
                    ) : (
                      <View key={i} testID={`preview-slot-${i}`} style={st.slot}><Text style={st.slotEmpty}>+</Text></View>
                    );
                  })}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {save.armory.map(id => {
                    const w = getArmoryWeapon(id, weaponBuilds(save));
                    if (!w) return null;
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
                            <Text style={st.fusesText}>✦ FUSES</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {charmsFull && save.armory.length > charms.length && (
                  <Text style={st.note}>Slots full. Tap an equipped charm to swap it out.</Text>
                )}

                {/* Before 1-4 teaches swapping charms, keep charm details tucked unless tapped */}
                {(focusCharm !== null || save.seenMechanics.includes('charm') || save.armory.length >= 3) && (
                  <View style={{ gap: 8 }} testID="preview-charm-guide">
                    {focusCharm && !charms.includes(focusCharm) && (() => {
                      const w = getArmoryWeapon(focusCharm, weaponBuilds(save));
                      return w ? (
                        <WeaponExplainer key={`look-${focusCharm}`} weapon={w} build={weaponBuilds(save)[focusCharm]} badge={charmsFull ? 'Slots full' : 'Not equipped'} defaultOpen />
                      ) : null;
                    })()}
                    {charms.length > 0 && <Text style={st.sectionHint}>WHAT YOUR CHARMS DO · tap one for tips</Text>}
                    {charms.map(id => {
                      const w = getArmoryWeapon(id, weaponBuilds(save));
                      return w ? <WeaponExplainer key={id} weapon={w} build={weaponBuilds(save)[id]} defaultOpen={id === focusCharm} /> : null;
                    })}
                    {charms.length === 0 && !focusCharm && <Text style={st.note}>Tap a charm above to equip it and see what it does.</Text>}
                  </View>
                )}
              </>
            )}

            {/* Evolutions: which unlocked recipes the current charms arm */}
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
                  <Text style={st.evoHintSub} testID="preview-evo-likelihood">
                    Catalyst chance {Math.round(loadout.evolutionLikelihood)}% per refill · {Number.isFinite(loadout.evolutionCap) ? `up to ${loadout.evolutionCap} evolutions this fight` : 'as many evolutions as you like'}. Match the Catalyst to evolve for 30 s.
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

            {/* Arcana slots */}
            {gearOn && save.unlockedArcana.length > 0 && onSelectArcana && (
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
              <Btn testID="preview-play" label={practice ? 'Practice' : best > 0 ? 'Play again' : 'Fight!'} icon={practice ? 'lorc/target-dummy' : 'lorc/crossed-swords'} onPress={() => onPlay(level)} />
            )}
          </View>
    </>
  );
};

/**
 * The one thing this level teaches. New: a card with its picture (this IS the
 * lesson; the fight starts straight from the sheet). Seen before: one line.
 */
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
    {/* Something that is used at Camp can be used right now, before the fight that asks for it */}
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
  /** Above everything the screen under it stacks (the map's top bar has its own zIndex) */
  layer: { zIndex: 100, elevation: 100 },
  backdrop: { position: 'absolute', backgroundColor: 'rgba(18,18,18,0.55)' },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '94%', backgroundColor: COLORS.canvasWhite, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: INK, overflow: 'hidden' },
  header: { padding: 16, gap: 10, borderBottomWidth: 2, borderBottomColor: INK },
  levelId: { flex: 1, flexShrink: 1, marginRight: 8, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  close: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontWeight: '900', color: INK },
  foeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  foePortrait: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  foeBoss: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.actionYellow },
  foeElite: { backgroundColor: '#5B2333', borderColor: COLORS.deepOnyx },
  foePractice: { backgroundColor: '#F6E3A8' },
  practiceTag: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: INK, opacity: 0.75 },
  practiceBox: { gap: 4, backgroundColor: '#FBF3D6', borderRadius: 8, padding: 10, borderWidth: 1.5, borderColor: '#8A6420' },
  practiceTitle: { fontWeight: '900', fontSize: 14, color: INK },
  levelName: { fontSize: 24, fontWeight: '900', color: INK },
  foeName: { fontSize: 14, fontWeight: '700', color: INK, opacity: 0.8 },
  bubble: { alignSelf: 'flex-start', backgroundColor: COLORS.canvasWhite, borderWidth: 2, borderColor: INK, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 20 },
  bubbleText: { fontStyle: 'italic', color: INK, fontSize: 13 },
  body: { padding: 16, gap: 12 },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: '#FFFBEB' },
  coachText: { flex: 1, fontSize: 14, fontWeight: '800', color: INK, lineHeight: 19 },
  mech: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: TONE.selected },
  mechTitle: { fontSize: 16, fontWeight: '900', color: INK, marginTop: 2 },
  mechTag: { fontSize: 13, color: INK },
  lesson: { gap: 8, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: TONE.spentEdge, backgroundColor: COLORS.paperBeige },
  lessonNew: { borderColor: INK, borderBottomWidth: 4, backgroundColor: '#FFFBEB' },
  lessonHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lessonIcon: { width: 36, height: 36, borderRadius: 9, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  lessonEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#9A5B00' },
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
  ability: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFE9E7', borderRadius: 8, padding: 8, borderWidth: 1.5, borderColor: INK },
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
  fighter: { width: 92, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 2, borderColor: TONE.spentEdge, backgroundColor: COLORS.paperBeige, gap: 2 },
  fighterSel: { borderColor: INK, backgroundColor: COLORS.actionYellow, borderBottomWidth: 4 },
  fighterName: { fontSize: 11, fontWeight: '800', color: INK },
  fighterLvl: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.7 },
  rec: { position: 'absolute', top: -6, right: -4, backgroundColor: COLORS.logicTeal, borderRadius: 4, paddingHorizontal: 4, borderWidth: 1, borderColor: INK },
  recText: { fontSize: 8, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 1 },
  charm: { width: 96, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 2, backgroundColor: COLORS.paperBeige, gap: 2 },
  charmSel: { backgroundColor: COLORS.actionYellow, borderBottomWidth: 4 },
  kindDot: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, marginTop: 2 },
  kindDotText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4, color: COLORS.canvasWhite },
  fusesTag: { backgroundColor: TONE.combo, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: INK },
  fusesText: { fontSize: 8, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 0.5 },
  trialNudge: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.actionYellow },
  evoBox: { gap: 6, backgroundColor: TONE.comboPale, borderRadius: 8, borderWidth: 1.5, borderColor: TONE.combo, padding: 8 },
  evoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  evoName: { fontSize: 12, fontWeight: '900', color: INK },
  hazard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF3E0', borderRadius: 8, padding: 8, borderWidth: 1.5, borderColor: TONE.tradeoff },
  passiveBox: { gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8 },
  passiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passiveText: { flex: 1, fontSize: 12, color: INK },
  passiveIcons: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  slotRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  slot: { width: 42, height: 42, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: TONE.spentEdge, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  slotEmpty: { color: TONE.spent, fontWeight: '900', fontSize: 18 },
  evoHintTitle: { flexShrink: 1, fontSize: 12, fontWeight: '900', color: INK },
  evoHintSub: { fontSize: 11, color: INK, opacity: 0.85 },
  arcanaItem: { width: 102, alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 10, borderWidth: 2, backgroundColor: COLORS.paperBeige, gap: 2 },
  arcanaNum: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: TONE.arcana },
  arcanaSummary: { backgroundColor: TONE.arcanaPale, borderRadius: 8, borderWidth: 1.5, borderColor: INK, padding: 8, gap: 2 },
  arcanaUp: { fontSize: 11, fontWeight: '800', color: TONE.upside },
  arcanaDown: { fontSize: 11, fontWeight: '700', color: TONE.tradeoff },
  reliefCard: { gap: 6, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: '#0F766E', backgroundColor: '#F0FDFA' },
  reliefCardOn: { backgroundColor: '#CCFBF1', borderBottomWidth: 4 },
  reliefHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reliefIcon: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  reliefEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: '#0F766E' },
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
  wagerBtnSub: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.8, textAlign: 'center' },
  cauldronSummary: { fontSize: 11, fontWeight: '700', color: '#78350F', lineHeight: 16 },
  footer: { padding: 14, borderTopWidth: 2, borderTopColor: INK, backgroundColor: COLORS.paperBeige },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  lockedText: { color: INK, fontWeight: '700', flexShrink: 1 },
});

export default LevelPreview;
