/**
 * Starfall Summit — Run Launch, Ascension & Daily Climb Hub.
 *
 * Lets the player resume an active climb, choose between Standard Climb (pick any
 * of the 6 Fighters, tune Ascension 0..20, inspect Career Stats, or share/roll a
 * deterministic seed) and Daily Climb (today's UTC deterministic seed, featured
 * climber, rotating Daily Mutator spotlight, and streak tracking).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { EASE, MS, SCALE, SPRING } from '@/utils/motion';
import type { CharacterName } from '@/types';
import { FIGHTERS } from '@/adventure/data/fighters';
import { getArmoryWeapon } from '@/adventure/data/armory';
import {
  buildSummitShareUrl,
  getDailySummitConfig,
  normalizeDateKey,
  type SummitDailyMutatorId,
} from '@/adventure/dailySeed';
import { randomSeed } from '@/adventure/engine/rng';
import { sfx } from '@/audio';
import { FighterPassivesList } from '@/adventure/components/SharedCards';
import { Btn, Eyebrow, Heart, INK, PopIn, TONE } from '@/adventure/components/ui';
import { ASCENSION_DESCRIPTIONS, MAX_ASCENSION } from '../data/ascensions';
import { STARTER_KITS } from '../data/encounters';
import { MAX_SUMMIT_WEAPONS, type CreateSpireRunOptions } from '../engine/runState';
import type { SpireMeta, SpireRun } from '../types';
import {
  SPIRE_MOTION_INSTANT,
  SpireCrossfadeSwap,
  SpireLightweightBreath,
  SpireStatPop,
  SpireTactilePressable,
} from './SpireMotion';
import SpireCoopLobby, { type SpireCoopLobbyProps } from './SpireCoopLobby';

export interface SpireSetupProps {
  activeRun: SpireRun | null;
  meta: SpireMeta;
  initialTab?: 'standard' | 'daily';
  initialSeed?: number;
  initialFighter?: CharacterName;
  initialAscension?: number;
  initialDailyDate?: string;
  initialCoopCode?: string;
  coopLobbyProps?: SpireCoopLobbyProps;
  onStartNew: (
    fighter: CharacterName,
    ascension: number,
    seed: number,
    options?: CreateSpireRunOptions
  ) => void;
  onResume: () => void;
  onAbandonActive: () => void;
  onExit: () => void;
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const Clipboard = await import('expo-clipboard');
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(text);
      return true;
    }
  } catch {
    // Clipboard unavailable
  }
  return false;
};

const SpireSetup: React.FC<SpireSetupProps> = ({
  activeRun,
  meta,
  initialTab = 'standard',
  initialSeed,
  initialFighter,
  initialAscension,
  initialDailyDate,
  initialCoopCode,
  coopLobbyProps,
  onStartNew,
  onResume,
  onAbandonActive,
  onExit,
}) => {
  const insets = useSafeAreaInsets();
  const [climbMode, setClimbMode] = useState<'solo' | 'coop'>(() =>
    initialCoopCode ? 'coop' : 'solo'
  );
  const [tab, setTab] = useState<'standard' | 'daily'>(initialTab);
  const [fighter, setFighter] = useState<CharacterName>(
    initialFighter ?? activeRun?.fighter ?? 'Orange Tabby'
  );
  const [ascension, setAscension] = useState<number>(() => {
    if (typeof initialAscension === 'number' && Number.isFinite(initialAscension)) {
      return Math.max(0, Math.min(MAX_ASCENSION, Math.floor(initialAscension)));
    }
    return Math.min(meta.highestAscensionUnlocked, MAX_ASCENSION);
  });
  const [seed, setSeed] = useState<number>(() =>
    typeof initialSeed === 'number' && initialSeed > 0 ? initialSeed : randomSeed()
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [selectReactionSeq, setSelectReactionSeq] = useState(0);
  const selectSeqRef = useRef(0);

  const hasSharedLaunch = Boolean(
    initialSeed || initialFighter || initialAscension !== undefined || initialDailyDate
  );

  useEffect(() => {
    if (initialCoopCode) setClimbMode('coop');
  }, [initialCoopCode]);

  useEffect(() => {
    setConfirmAbandon(false);
  }, [activeRun?.id]);

  useEffect(() => {
    if (!confirmAbandon) return;
    const timer = setTimeout(() => setConfirmAbandon(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmAbandon]);

  useEffect(() => {
    setCopiedLink(false);
  }, [seed, fighter, ascension]);

  const dailyDate = useMemo(() => normalizeDateKey(initialDailyDate), [initialDailyDate]);
  const dailyConfig = useMemo(() => getDailySummitConfig(dailyDate), [dailyDate]);
  const dailyClearedToday = Boolean(meta.completedDailyDates?.includes(dailyConfig.dateKey));
  const dailyBestToday = meta.dailyBestRatings?.[dailyConfig.dateKey] ?? 0;

  const displayedFighter = tab === 'daily' ? dailyConfig.fighter : fighter;
  const kit = STARTER_KITS[displayedFighter];
  const w1 = getArmoryWeapon(kit.starterWeapon, { [kit.starterWeapon]: { level: 2, tuning: {} } });
  const w2 = getArmoryWeapon(kit.bonusWeapon, { [kit.bonusWeapon]: { level: 2, tuning: {} } });

  const maxSelectableAsc = Math.max(
    1,
    meta.highestAscensionUnlocked,
    typeof initialAscension === 'number' ? Math.min(MAX_ASCENSION, initialAscension) : 0
  );

  const handleCopySeedLink = async () => {
    const url = buildSummitShareUrl({ seed, fighter, ascension });
    await copyToClipboard(url);
    sfx('click');
    setCopiedLink(true);
  };

  const startDailyClimb = () => {
    sfx('confirm');
    const dailyOpts: { dateKey: string; mutatorId: SummitDailyMutatorId } = {
      dateKey: dailyConfig.dateKey,
      mutatorId: dailyConfig.mutator.id,
    };
    onStartNew(dailyConfig.fighter, dailyConfig.ascension, dailyConfig.seed, {
      daily: dailyOpts,
    });
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]} testID="spire-setup">
      <View style={st.topBar}>
        <SpireTactilePressable
          testID="spire-setup-back"
          small
          onPress={() => { sfx('click'); onExit(); }}
          style={st.backBtn}
          accessibilityLabel="Back to main menu"
        >
          <Icon name="ui/back-arrow" size={18} color={INK} noShadow />
        </SpireTactilePressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.headerTitle} numberOfLines={1}>STARFALL SUMMIT</Text>
          <Text style={st.headerSub} numberOfLines={1}>Climb where the star fell · 3 Acts & Endless</Text>
        </View>
        <View style={st.trophyPill}>
          <Icon name="lorc/trophy" size={14} color={TONE.coin} />
          <Text style={st.trophyText}>{meta.victories}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={st.body}>
        {/* Party Mode Segmented Toggle: Solo Climb | 2P Co-Op Duo */}
        <View style={st.partyToggleRow} testID="spire-party-toggle">
          <SpireTactilePressable
            testID="spire-mode-solo"
            small
            accessibilityRole="button"
            accessibilityState={{ selected: climbMode === 'solo' }}
            onPress={() => { sfx('click'); setClimbMode('solo'); }}
            style={[st.partyBtn, climbMode === 'solo' && st.partyBtnActive]}
          >
            <Icon name="lorc/mountaintop" size={15} color={climbMode === 'solo' ? INK : TONE.onDusk} />
            <Text style={[st.partyText, climbMode === 'solo' && st.partyTextActive]}>SOLO CLIMB</Text>
          </SpireTactilePressable>
          <SpireTactilePressable
            testID="spire-mode-coop"
            small
            accessibilityRole="button"
            accessibilityState={{ selected: climbMode === 'coop' }}
            onPress={() => { sfx('click'); setClimbMode('coop'); }}
            style={[st.partyBtn, climbMode === 'coop' && st.partyBtnCoopActive]}
          >
            <Icon name="lorc/two-shadows" size={15} color={climbMode === 'coop' ? COLORS.canvasWhite : COLORS.actionYellow} />
            <Text style={[st.partyText, climbMode === 'coop' && st.partyTextCoopActive]}>2P CO-OP DUO</Text>
          </SpireTactilePressable>
        </View>

        {climbMode === 'coop' ? (
          <SpireCoopLobby
            roomCode={coopLobbyProps?.roomCode ?? null}
            connectionState={coopLobbyProps?.connectionState ?? 'idle'}
            errorMessage={coopLobbyProps?.errorMessage}
            isHost={coopLobbyProps?.isHost ?? false}
            localPlayer={coopLobbyProps?.localPlayer ?? null}
            allyPlayer={coopLobbyProps?.allyPlayer ?? null}
            selectedFighter={coopLobbyProps?.selectedFighter ?? fighter}
            ascension={coopLobbyProps?.ascension ?? ascension}
            maxSelectableAsc={coopLobbyProps?.maxSelectableAsc ?? maxSelectableAsc}
            initialCoopCode={coopLobbyProps?.initialCoopCode ?? initialCoopCode}
            coopServer={coopLobbyProps?.coopServer}
            canStartClimb={coopLobbyProps?.canStartClimb ?? false}
            onSelectFighter={next => {
              setFighter(next);
              coopLobbyProps?.onSelectFighter(next);
            }}
            onChangeAscension={next => {
              setAscension(next);
              coopLobbyProps?.onChangeAscension?.(next);
            }}
            onCreateRoom={coopLobbyProps?.onCreateRoom ?? (() => {})}
            onJoinRoom={coopLobbyProps?.onJoinRoom ?? (() => {})}
            onLeaveRoom={coopLobbyProps?.onLeaveRoom ?? (() => {})}
            onToggleReady={coopLobbyProps?.onToggleReady ?? (() => {})}
            onStartClimb={coopLobbyProps?.onStartClimb ?? (() => {})}
          />
        ) : (
        <>
        {/* Shared Seed Deep-Link Banner */}
        {hasSharedLaunch && (
          <View style={st.sharedBanner} testID="spire-shared-banner">
            <Icon name="delapouite/sparkles" size={15} color={COLORS.deepOnyx} />
            <Text style={st.sharedBannerText}>
              {tab === 'daily'
                ? `Loaded Daily Summit · ${dailyConfig.dateKey}`
                : `Shared Seed #${seed}${initialFighter ? ` · ${initialFighter}` : ''}${initialAscension ? ` · A${initialAscension}` : ''}`}
            </Text>
          </View>
        )}

        {/* Resume Active Climb Banner */}
        {activeRun && activeRun.phase !== 'defeat' && activeRun.phase !== 'victory' && (
          <PopIn style={st.resumeCard}>
            <View style={st.resumeHead}>
              <SpireLightweightBreath keySeed={`resume-${activeRun.fighter}`} size={44}>
                <FighterAvatar character={activeRun.fighter} size={44} health={activeRun.hearts} maxHealth={activeRun.maxHearts} animate={false} framed />
              </SpireLightweightBreath>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Eyebrow
                  text={activeRun.isDaily ? `DAILY CLIMB · ${activeRun.dailyDate}` : 'CLIMB IN PROGRESS'}
                  color={COLORS.actionYellow}
                />
                <Text style={st.resumeTitle} numberOfLines={1}>
                  {activeRun.fighter} · {activeRun.endless ? `Endless Act ${activeRun.act}` : `Act ${activeRun.act}`} · Floor {activeRun.floor}
                </Text>
                <Text style={st.resumeSub}>
                  ♥ {activeRun.hearts}/{activeRun.maxHearts} · {activeRun.coins}¢ · {activeRun.weapons.length}/{MAX_SUMMIT_WEAPONS} weapons · A{activeRun.ascension}
                </Text>
              </View>
            </View>
            {confirmAbandon ? (
              <View style={st.resumeBtns} testID="spire-abandon-confirm-row">
                <Btn
                  testID="spire-abandon-cancel"
                  small
                  variant="secondary"
                  label="Cancel"
                  onPress={() => { sfx('click'); setConfirmAbandon(false); }}
                />
                <Btn
                  testID="spire-abandon-run"
                  small
                  variant="dark"
                  label="Confirm Abandon?"
                  onPress={() => {
                    sfx('back');
                    setConfirmAbandon(false);
                    onAbandonActive();
                  }}
                  style={st.confirmDangerBtn}
                />
              </View>
            ) : (
              <View style={st.resumeBtns}>
                <Btn testID="spire-resume-run" label="Resume Climb" icon="lorc/mountaintop" onPress={onResume} style={{ flex: 1 }} />
                <Btn
                  testID="spire-abandon-run"
                  small
                  variant="secondary"
                  label="Abandon"
                  onPress={() => { sfx('click'); setConfirmAbandon(true); }}
                />
              </View>
            )}
          </PopIn>
        )}

        {/* Mode Switcher: Standard Climb | Daily Climb (`[TP-19]`) */}
        <View style={st.tabRow}>
          <SpireTactilePressable
            testID="spire-tab-standard"
            small
            accessibilityRole="button"
            accessibilityState={{ selected: tab === 'standard' }}
            onPress={() => { sfx('click'); setTab('standard'); }}
            style={[st.tabBtn, tab === 'standard' && st.tabBtnActive]}
          >
            <Icon name="lorc/mountaintop" size={15} color={tab === 'standard' ? INK : TONE.onDusk} />
            <Text style={[st.tabText, tab === 'standard' && st.tabTextActive]}>STANDARD CLIMB</Text>
          </SpireTactilePressable>
          <SpireTactilePressable
            testID="spire-tab-daily"
            small
            accessibilityRole="button"
            accessibilityState={{ selected: tab === 'daily' }}
            onPress={() => { sfx('click'); setTab('daily'); }}
            style={[st.tabBtn, tab === 'daily' && st.tabBtnActive]}
          >
            <Icon name="lorc/rainbow-star" size={15} color={tab === 'daily' ? INK : COLORS.actionYellow} />
            <Text style={[st.tabText, tab === 'daily' && st.tabTextActive]}>DAILY CLIMB</Text>
            {dailyClearedToday && (
              <View style={st.clearedDot}>
                <Text style={st.clearedDotText}>✓</Text>
              </View>
            )}
          </SpireTactilePressable>
        </View>

        <SpireCrossfadeSwap swapKey={tab}>
          {tab === 'standard' ? (
            <View style={{ gap: 12 }}>
              {/* Fighter Selection */}
              <Text style={st.section}>CHOOSE YOUR CLIMBER</Text>
              <View style={st.fighterGrid}>
                {FIGHTERS.map(f => {
                  const sel = f.name === fighter;
                  const wins = meta.fighterWins[f.name] ?? 0;
                  return (
                    <SpireFighterTile
                      key={f.name}
                      name={f.name}
                      selected={sel}
                      wins={wins}
                      reactionSeq={sel ? selectReactionSeq : 0}
                      onSelect={() => {
                        sfx('click');
                        setFighter(f.name);
                        setSelectReactionSeq(++selectSeqRef.current);
                      }}
                    />
                  );
                })}
              </View>

              {/* Selected Fighter Kit — whole card shifts softly as one cohesive piece (zero hollow white box!) */}
              <SpireCrossfadeSwap swapKey={fighter} fast minOpacity={0.22} style={st.kitCard} testID="spire-starter-kit">
                <View style={{ gap: 8 }}>
                  <View style={st.kitTop}>
                    <Text style={st.kitTitle}>{fighter}</Text>
                    <View style={st.kitStats}>
                      <Heart size={13} />
                      <Text style={st.kitStatText}>{kit.maxHearts}</Text>
                      <Icon name="lorc/crown-coin" size={13} color={TONE.coinBright} />
                      <Text style={st.kitStatText}>{kit.startingCoins}¢</Text>
                    </View>
                  </View>
                  <Text style={st.kitBlurb}>{kit.tagline}</Text>

                  <FighterPassivesList fighter={fighter} compact />

                  <Text style={st.subSection}>STARTER WEAPONS (LV 2)</Text>
                  <View style={st.starterRow}>
                    {[w1, w2].map(w =>
                      w ? (
                        <View key={w.id} style={st.starterChip}>
                          <WeaponAvatar weapon={w} size={24} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={st.starterName} numberOfLines={1}>{w.name}</Text>
                            <Text style={st.starterDesc} numberOfLines={2}>{w.shortDescription}</Text>
                          </View>
                        </View>
                      ) : null
                    )}
                  </View>
                </View>
              </SpireCrossfadeSwap>

              {/* Ascension Selector */}
              <Text style={st.section}>ASCENSION LEVEL</Text>
              <View style={st.ascCard}>
                <View style={st.ascRow}>
                  <SpireTactilePressable
                    testID="spire-asc-down"
                    small
                    disabled={ascension <= 0}
                    onPress={() => { sfx('click'); setAscension(a => Math.max(0, a - 1)); }}
                    style={[st.stepBtn, ascension <= 0 && { opacity: 0.35 }]}
                  >
                    <Text style={st.stepText}>−</Text>
                  </SpireTactilePressable>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <SpireStatPop value={ascension}>
                      <Text testID="spire-asc-value" style={st.ascTitle}>
                        ASCENSION {ascension}
                      </Text>
                    </SpireStatPop>
                    <Text style={st.ascUnlockHint}>
                      Unlocked up to A{maxSelectableAsc} · Beat Act III to unlock higher tiers
                    </Text>
                  </View>
                  <SpireTactilePressable
                    testID="spire-asc-up"
                    small
                    disabled={ascension >= maxSelectableAsc}
                    onPress={() => { sfx('click'); setAscension(a => Math.min(maxSelectableAsc, a + 1)); }}
                    style={[st.stepBtn, ascension >= maxSelectableAsc && { opacity: 0.35 }]}
                  >
                    <Text style={st.stepText}>+</Text>
                  </SpireTactilePressable>
                </View>
                <SpireCrossfadeSwap swapKey={ascension}>
                  <Text style={st.ascDesc}>{ASCENSION_DESCRIPTIONS[ascension]}</Text>
                </SpireCrossfadeSwap>
              </View>

              {/* Career Stats & Seed */}
              <View style={st.statsStrip}>
                <StatBox label="RUNS" value={String(meta.totalRuns)} />
                <StatBox label="WINS" value={String(meta.victories)} />
                <StatBox label="BEST FL" value={String(meta.bestFloor)} />
                <StatBox
                  label="TOP RATING"
                  value={(meta.bestSummitRating ?? 0) > 0 ? (meta.bestSummitRating ?? 0).toLocaleString() : '—'}
                />
              </View>

              <View style={st.seedRow}>
                <SpireStatPop value={seed}>
                  <Text style={st.seedText}>Run Seed: #{seed}</Text>
                </SpireStatPop>
                <View style={st.seedActions}>
                  <SpireTactilePressable
                    testID="spire-copy-seed-link"
                    small
                    onPress={handleCopySeedLink}
                    style={st.rerollSeedBtn}
                  >
                    <Icon name="lorc/scroll-unfurled" size={13} color={INK} />
                    <Text style={st.rerollSeedText}>{copiedLink ? 'Link Copied ✓' : 'Share Seed'}</Text>
                  </SpireTactilePressable>
                  <SpireTactilePressable
                    testID="spire-reroll-seed"
                    small
                    onPress={() => { sfx('click'); setSeed(randomSeed()); }}
                    style={st.rerollSeedBtn}
                  >
                    <Icon name="lorc/cycle" size={13} color={INK} />
                    <Text style={st.rerollSeedText}>New Seed</Text>
                  </SpireTactilePressable>
                </View>
              </View>
            </View>
          ) : (
            /* DAILY CLIMB TAB (`[TP-19]`) */
            <View style={st.dailyStack} testID="spire-daily-panel">
              <View style={st.dailyHeroCard}>
                <View style={st.dailyTopRow}>
                  <View style={st.dailyDateBadge}>
                    <Text style={st.dailyDateText}>{dailyConfig.dateKey}</Text>
                  </View>
                  <View style={[st.dailyStatusBadge, dailyClearedToday && st.dailyStatusCleared]}>
                    <Text style={[st.dailyStatusText, dailyClearedToday && st.dailyStatusTextCleared]}>
                      {dailyClearedToday ? 'CLEARED TODAY ✓' : 'UNPLAYED TODAY'}
                    </Text>
                  </View>
                </View>

                <Text style={st.dailyHeadline}>Everyone Climbs the Exact Same Seed</Text>
                <Text style={st.dailySeedSub}>Daily Seed #{dailyConfig.seed} · Ascension 0</Text>

                {/* Daily Mutator Spotlight */}
                <View
                  style={[st.mutatorBox, { borderColor: dailyConfig.mutator.accentColor }]}
                  testID="spire-daily-mutator"
                >
                  <View style={[st.mutatorIcon, { borderColor: dailyConfig.mutator.accentColor }]}>
                    <Icon name={dailyConfig.mutator.icon} size={24} color={dailyConfig.mutator.accentColor} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={st.mutatorEyebrow}>TODAY&apos;S DAILY MUTATOR</Text>
                    <Text style={st.mutatorName}>{dailyConfig.mutator.name}</Text>
                    <Text style={st.mutatorDesc}>{dailyConfig.mutator.description}</Text>
                  </View>
                </View>

                {/* Daily Fighter Showcase */}
                <View style={st.dailyFighterBox}>
                  <FighterAvatar character={dailyConfig.fighter} size={46} mood="anticipation" framed />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={st.mutatorEyebrow}>TODAY&apos;S FEATURED CLIMBER</Text>
                    <Text style={st.kitTitle}>{dailyConfig.fighter}</Text>
                    <Text style={st.kitBlurb}>{kit.tagline}</Text>
                  </View>
                </View>

                <View style={st.starterRow}>
                  {[w1, w2].map(w =>
                    w ? (
                      <View key={w.id} style={st.starterChip}>
                        <WeaponAvatar weapon={w} size={24} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={st.starterName} numberOfLines={1}>{w.name}</Text>
                          <Text style={st.starterDesc} numberOfLines={2}>{w.shortDescription}</Text>
                        </View>
                      </View>
                    ) : null
                  )}
                </View>

                {/* Daily Streak & Records */}
                <View style={st.statsStrip}>
                  <StatBox label="STREAK" value={String(meta.dailyStreak ?? 0)} />
                  <StatBox label="BEST STREAK" value={String(meta.bestDailyStreak ?? 0)} />
                  <StatBox label="CLEARS" value={String(meta.completedDailyDates?.length ?? 0)} />
                  <StatBox
                    label="TODAY BEST"
                    value={dailyBestToday > 0 ? dailyBestToday.toLocaleString() : '—'}
                  />
                </View>
              </View>
            </View>
          )}
        </SpireCrossfadeSwap>
        </>
        )}
      </ScrollView>

      {climbMode === 'solo' && (
        <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {tab === 'daily' ? (
            <Btn
              testID="spire-start-daily"
              label={dailyClearedToday ? "Replay Today's Daily Climb" : 'Begin Daily Climb'}
              icon="lorc/rainbow-star"
              onPress={startDailyClimb}
            />
          ) : (
            <Btn
              testID="spire-start-climb"
              label={activeRun && activeRun.phase !== 'defeat' && activeRun.phase !== 'victory' ? 'Start Fresh Climb' : 'Begin Summit Climb'}
              icon="lorc/mountaintop"
              onPress={() => {
                sfx('confirm');
                onStartNew(fighter, ascension, seed);
              }}
            />
          )}
        </View>
      )}
    </View>
  );
};

/** Fighter selection card: unselected tiles breathe gently (0 frame loops); selecting plays a snappy lift & joy reaction. */
const SpireFighterTile: React.FC<{
  name: CharacterName;
  selected: boolean;
  wins: number;
  reactionSeq: number;
  onSelect: () => void;
}> = ({ name, selected, wins, reactionSeq, onSelect }) => {
  const reduced = useReducedMotion();
  const prevSelRef = useRef(selected);
  const liftY = useSharedValue(0);
  const popScale = useSharedValue(1);

  useEffect(() => {
    const justSelected = selected && !prevSelRef.current;
    prevSelRef.current = selected;
    if (!justSelected || reduced || SPIRE_MOTION_INSTANT) return;
    liftY.value = withSequence(
      withTiming(-5, { duration: MS.feedback, easing: EASE.enter }),
      withSpring(0, SPRING.lively)
    );
    popScale.value = withSequence(
      withTiming(SCALE.pop, { duration: MS.feedback, easing: EASE.popSoft }),
      withSpring(1, SPRING.snappy)
    );
  }, [selected, reduced, liftY, popScale]);

  useEffect(
    () => () => {
      cancelAnimation(liftY);
      cancelAnimation(popScale);
    },
    [liftY, popScale]
  );

  const hopStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: liftY.value }, { scale: popScale.value }],
  }));

  return (
    <Animated.View style={[st.fighterCardSlot, hopStyle]}>
      <SpireTactilePressable
        testID={`spire-fighter-${name}`}
        small
        onPress={onSelect}
        style={[st.fighterCard, selected && st.fighterCardSel]}
        accessibilityState={{ selected }}
      >
        <SpireLightweightBreath keySeed={`setup-${name}`} size={42} active={!selected}>
          <FighterAvatar
            character={name}
            size={42}
            mood={selected ? 'anticipation' : 'idle'}
            reaction={selected && reactionSeq > 0 ? { type: 'joy', id: reactionSeq } : null}
            animate={selected}
          />
        </SpireLightweightBreath>
        <Text style={[st.fighterName, selected && st.fighterNameSel]} numberOfLines={1}>{name}</Text>
        {wins > 0 && <Text style={[st.winBadge, selected && st.winBadgeSel]}>★ {wins}</Text>}
      </SpireTactilePressable>
    </Animated.View>
  );
};

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={st.statBox}>
    <Text style={st.statVal}>{value}</Text>
    <Text style={st.statLabel}>{label}</Text>
  </View>
);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: INK, letterSpacing: 1.8 },
  headerSub: { fontSize: 11, fontWeight: '700', color: TONE.spent },
  trophyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: TONE.coinPale, borderWidth: 2, borderColor: INK, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  trophyText: { fontSize: 12, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  body: { padding: 14, gap: 12, maxWidth: 540, width: '100%', alignSelf: 'center' },
  sharedBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.actionYellow, borderRadius: 9, borderWidth: 2, borderColor: INK, paddingHorizontal: 10, paddingVertical: 7 },
  sharedBannerText: { flex: 1, fontSize: 11.5, fontWeight: '900', color: INK },
  resumeCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 12, gap: 10 },
  resumeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resumeTitle: { fontSize: 15, fontWeight: '900', color: INK, marginTop: 2 },
  resumeSub: { fontSize: 12, fontWeight: '700', color: TONE.spent },
  resumeBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmDangerBtn: { flex: 1, backgroundColor: '#B91C1C', borderColor: '#7F1D1D' },
  partyToggleRow: { flexDirection: 'row', gap: 8, backgroundColor: '#231A13', padding: 4, borderRadius: 12, borderWidth: 2, borderColor: '#6B5A49' },
  partyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 8 },
  partyBtnActive: { backgroundColor: COLORS.canvasWhite, borderWidth: 2, borderBottomWidth: 3, borderColor: INK },
  partyBtnCoopActive: { backgroundColor: '#0F766E', borderWidth: 2, borderBottomWidth: 3, borderColor: INK },
  partyText: { fontSize: 11.5, fontWeight: '900', color: TONE.onDusk, letterSpacing: 0.7 },
  partyTextActive: { color: INK },
  partyTextCoopActive: { color: COLORS.canvasWhite },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#3A2D21', borderRadius: 10, borderWidth: 2, borderColor: '#6B5A49', paddingVertical: 9, paddingHorizontal: 8 },
  tabBtnActive: { backgroundColor: COLORS.actionYellow, borderColor: INK, borderBottomWidth: 4 },
  tabText: { fontSize: 11.5, fontWeight: '900', color: TONE.onDusk, letterSpacing: 0.7 },
  tabTextActive: { color: INK },
  clearedDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' },
  clearedDotText: { fontSize: 10, fontWeight: '900', color: COLORS.canvasWhite },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 1.8, color: COLORS.actionYellow, marginTop: 2 },
  fighterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fighterCardSlot: { width: '31%', flexGrow: 1, minWidth: 92 },
  fighterCard: { width: '100%', alignItems: 'center', gap: 4, backgroundColor: '#3A2D21', borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: '#6B5A49', paddingVertical: 8, paddingHorizontal: 3 },
  fighterCardSel: { backgroundColor: COLORS.canvasWhite, borderColor: COLORS.actionYellow, borderWidth: 3, borderBottomWidth: 5 },
  fighterName: { fontSize: 10.5, fontWeight: '900', color: TONE.onDusk, textAlign: 'center' },
  fighterNameSel: { color: INK },
  winBadge: { fontSize: 10, fontWeight: '900', color: COLORS.actionYellow, fontVariant: ['tabular-nums'] },
  winBadgeSel: { color: '#92400E' },
  footer: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: '#3A2D21', borderTopWidth: 2, borderTopColor: INK },
  kitCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  kitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kitTitle: { fontSize: 17, fontWeight: '900', color: INK },
  kitStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kitStatText: { fontSize: 13, fontWeight: '900', color: INK, marginRight: 4, fontVariant: ['tabular-nums'] },
  kitBlurb: { fontSize: 12, lineHeight: 17, color: INK, opacity: 0.85 },
  subSection: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, color: TONE.spent, marginTop: 2 },
  starterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  starterChip: { flex: 1, minWidth: 132, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: INK, padding: 7 },
  starterName: { fontSize: 12, fontWeight: '900', color: INK },
  starterDesc: { fontSize: 10, color: INK, opacity: 0.8, lineHeight: 13 },
  ascCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  ascRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 38, height: 38, borderRadius: 8, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, backgroundColor: COLORS.actionYellow, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, fontWeight: '900', color: INK, lineHeight: 24 },
  ascTitle: { fontSize: 16, fontWeight: '900', color: INK, letterSpacing: 1, fontVariant: ['tabular-nums'] },
  ascUnlockHint: { fontSize: 10, fontWeight: '700', color: TONE.spent, textAlign: 'center' },
  ascDesc: { fontSize: 12, fontWeight: '700', color: INK, textAlign: 'center', backgroundColor: TONE.coinPale, borderRadius: 6, borderWidth: 1.5, borderColor: '#E5D5A3', padding: 7 },
  statsStrip: { flexDirection: 'row', gap: 6 },
  statBox: { flex: 1, backgroundColor: '#3A2D21', borderRadius: 8, borderWidth: 1.5, borderColor: '#6B5A49', paddingVertical: 8, alignItems: 'center' },
  statVal: { fontSize: 15, fontWeight: '900', color: COLORS.actionYellow, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 9, fontWeight: '800', color: TONE.onDusk, letterSpacing: 0.8 },
  seedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 },
  seedText: { fontSize: 11, fontWeight: '700', color: TONE.onDusk, opacity: 0.85, fontVariant: ['tabular-nums'] },
  seedActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rerollSeedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 4 },
  rerollSeedText: { fontSize: 11, fontWeight: '800', color: INK },
  dailyStack: { gap: 12 },
  dailyHeroCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 14, gap: 10 },
  dailyTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dailyDateBadge: { backgroundColor: INK, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  dailyDateText: { fontSize: 11, fontWeight: '900', color: COLORS.actionYellow, fontVariant: ['tabular-nums'] },
  dailyStatusBadge: { backgroundColor: COLORS.paperBeige, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 3 },
  dailyStatusCleared: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  dailyStatusText: { fontSize: 10, fontWeight: '900', color: INK, letterSpacing: 0.6 },
  dailyStatusTextCleared: { color: COLORS.canvasWhite },
  dailyHeadline: { fontSize: 17, fontWeight: '900', color: INK },
  dailySeedSub: { fontSize: 11.5, fontWeight: '700', color: TONE.spent, fontVariant: ['tabular-nums'] },
  mutatorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 2, padding: 10 },
  mutatorIcon: { width: 42, height: 42, borderRadius: 10, borderWidth: 2, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  mutatorEyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1, color: TONE.spent },
  mutatorName: { fontSize: 15, fontWeight: '900', color: INK },
  mutatorDesc: { fontSize: 11.5, fontWeight: '700', color: INK, opacity: 0.85, lineHeight: 16 },
  dailyFighterBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 1.5, borderColor: '#D6CFC4', padding: 10 },
});

export default SpireSetup;
