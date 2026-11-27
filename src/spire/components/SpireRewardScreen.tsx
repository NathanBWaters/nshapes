/**
 * Starfall Summit — Post-Battle Victory & Reward Draft Screen.
 *
 * Reuses `WeaponExplainer.tsx` (single weapon explainer guardrail!),
 * `FightReplay.tsx`, and shared `WeaponOfferRow` / `SkillNodeRow` / `ArcanaCard`
 * so drafts look and behave identically to Adventure Mode!
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import RoundFunPrompt from '@/components/RoundFunPrompt';
import type { FunRating, FunTag } from '@/analytics/fightEvent';
import { COLORS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { EASE, MS, OVERLAP, SCALE, SPRING, STAGGER, STAYS, reducedMs } from '@/utils/motion';
import type { ArcanaId } from '@/adventure/types';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getArcana } from '@/adventure/data/arcana';
import { getSkillNode } from '@/adventure/data/skillTrees';
import { buildDamageStory, buildSpireRunDamageStory } from '@/adventure/engine/damageStory';
import BattleDamageStory from '@/adventure/components/BattleDamageStory';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import FightReplay from '@/adventure/components/FightReplay';
import {
  ArcanaCard,
  ArmedEvolutionRow,
  SkillNodeRow,
  WeaponOfferRow,
  type OfferBadge,
} from '@/adventure/components/SharedCards';
import { Btn, Eyebrow, INK, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import type { Weapon } from '@/types';
import {
  buildSpireWeaponBuilds,
  clashesWithBelt,
  newEvolutionRecipesArmedBy,
} from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS, REWARD_REROLL_COST, SKIP_WEAPON_COINS } from '../engine/runState';
import type { SpireLastFightSnapshot, SpireRewardBundle, SpireRun } from '../types';
import SpireBeltBar from './SpireBeltBar';
import SpireSwapPicker from './SpireSwapPicker';
import {
  SPIRE_MOTION_INSTANT,
  SpireCountUp,
  SpireCrossfadeSwap,
  SpireStaggerItem,
  SpireTactilePressable,
} from './SpireMotion';

interface Props {
  run: SpireRun;
  reward: SpireRewardBundle;
  lastFight: SpireLastFightSnapshot | null;
  funRating?: FunRating | null;
  funTags?: readonly FunTag[];
  onRateFun?: (rating: FunRating | null, tags: FunTag[]) => void;
  onReplayOpened?: () => void;
  onClaimWeapon: (index: number, replaceWeaponId?: string) => void;
  onRerollWeapons: () => void;
  onSkipWeapon: () => void;
  onClaimArcana: (id: ArcanaId) => void;
  onSkipArcana: () => void;
  onClaimSkill: (nodeId: string) => void;
  onSkipSkill: () => void;
  onReorderWeapon?: (fromIndex: number, toIndex: number) => void;
  onContinue: () => void;
}

const SpireRewardScreen: React.FC<Props> = ({
  run,
  reward,
  lastFight,
  funRating = null,
  funTags = [],
  onRateFun,
  onReplayOpened,
  onClaimWeapon,
  onRerollWeapons,
  onSkipWeapon,
  onClaimArcana,
  onSkipArcana,
  onClaimSkill,
  onSkipSkill,
  onReorderWeapon,
  onContinue,
}) => {
  const reduced = useReducedMotion();
  const [inspectIdx, setInspectIdx] = useState<number>(0);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [replayOpen, setReplayOpen] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [rerollSeq, setRerollSeq] = useState(0);
  const [offerFlourish, setOfferFlourish] = useState<Record<number, number>>({});
  const [claimedWeapon, setClaimedWeapon] = useState<{
    weapon: Weapon;
    level: number;
    isUpgrade: boolean;
    flourishKey: number;
  } | null>(null);
  const [claimedSkillName, setClaimedSkillName] = useState<string | null>(null);
  const [claimedArcanaName, setClaimedArcanaName] = useState<string | null>(null);
  const claimSeqRef = useRef(0);
  const beltFull = run.weapons.length >= MAX_SUMMIT_WEAPONS;

  // Hero triumph badge spring (Disney #2/#10 staging: banner lands, crest pops +64ms later)
  const badgeScale = useSharedValue(SPIRE_MOTION_INSTANT || reduced ? 1 : 0.72);
  const badgeOp = useSharedValue(SPIRE_MOTION_INSTANT ? 1 : 0);

  useEffect(() => {
    if (SPIRE_MOTION_INSTANT) return;
    if (reduced) {
      badgeScale.value = 1;
      badgeOp.value = withTiming(1, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS });
      return;
    }
    badgeOp.value = withDelay(
      OVERLAP.secondaryMs,
      withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS }),
      STAYS.reduceMotion
    );
    badgeScale.value = withDelay(
      OVERLAP.secondaryMs,
      withSequence(
        withTiming(SCALE.reward, { duration: MS.feedback, easing: EASE.popSoft }),
        withSpring(1, SPRING.playful)
      )
    );
    return () => {
      cancelAnimation(badgeScale);
      cancelAnimation(badgeOp);
    };
  }, [reduced, badgeScale, badgeOp]);

  const badgeAnim = useAnimatedStyle(() => ({
    opacity: badgeOp.value,
    transform: [{ scale: badgeScale.value }],
  }));

  const damageStory = useMemo(
    () =>
      lastFight
        ? buildDamageStory(lastFight.run)
        : buildSpireRunDamageStory(run.stats.sourceDamage, run.stats.floorLedger),
    [lastFight, run.stats.sourceDamage, run.stats.floorLedger]
  );
  const storyBuilds = useMemo(() => lastFight?.builds ?? buildSpireWeaponBuilds(run), [lastFight, run]);

  const inspectedOffer = reward.weaponOptions[inspectIdx] ?? reward.weaponOptions[0] ?? null;
  const inspectedWeapon = inspectedOffer
    ? getArmoryWeapon(inspectedOffer.weaponId, { [inspectedOffer.weaponId]: { level: inspectedOffer.level, tuning: {} } })
    : undefined;

  const availSkills = reward.skillOptions.filter(id => !run.skillNodes.includes(id));
  const availArcana = reward.arcanaOptions.filter(id => !run.arcana.includes(id));
  const unclaimedWeapon = !reward.weaponClaimed && reward.weaponOptions.length > 0;
  const unclaimedSkill = !reward.skillClaimed && availSkills.length > 0;
  const unclaimedArcana = !reward.arcanaClaimed && availArcana.length > 0;
  const allDone = !unclaimedWeapon && !unclaimedSkill && !unclaimedArcana;

  useEffect(() => {
    setConfirmSkip(false);
  }, [allDone, reward.weaponClaimed, reward.skillClaimed, reward.arcanaClaimed]);

  useEffect(() => {
    if (!confirmSkip) return;
    const timer = setTimeout(() => setConfirmSkip(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmSkip]);

  const unclaimedSummary = [
    unclaimedWeapon ? 'Weapon' : null,
    unclaimedSkill ? 'Skill Node' : null,
    unclaimedArcana ? 'Arcana' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={st.root} testID="spire-reward-screen">
      <ScrollView contentContainerStyle={st.body}>
        <SpireStaggerItem index={0} count={1} distance={20} hero style={st.bannerCard}>
          <View style={st.bannerTopRow}>
            <Animated.View style={badgeAnim}>
              <Eyebrow
                text={reward.isActBoss ? `ACT ${run.act} BOSS DEFEATED!` : reward.nodeKind === 'elite' ? 'ELITE VANQUISHED!' : 'FLOOR CLEARED!'}
                color={COLORS.actionYellow}
              />
            </Animated.View>
            <Animated.View style={badgeAnim}>
              <Icon
                name={reward.isActBoss ? 'lorc/crown' : reward.nodeKind === 'elite' ? 'lorc/bright-explosion' : 'lorc/trophy'}
                size={22}
                color={TONE.coinBright}
              />
            </Animated.View>
          </View>
          <Text style={st.title}>{reward.foeName} Knocked Out!</Text>
          <View style={st.statsRow}>
            <View style={st.coinCountPill} testID="spire-reward-coins">
              <Icon name="lorc/crown-coin" size={16} color={TONE.coinBright} />
              <SpireCountUp
                target={reward.coinsEarned}
                delayMs={MS.feedback}
                ticks={Math.min(12, Math.max(5, Math.round(reward.coinsEarned / 10)))}
                style={st.coinCountText}
              />
            </View>
            <SpireStaggerItem index={0} count={3} baseDelayMs={MS.quick} gapMs={STAGGER.card} distance={8}>
              <View style={st.statPill}>
                <Text style={st.statText}>DPM {Math.round(reward.dpm).toLocaleString()}</Text>
              </View>
            </SpireStaggerItem>
            <SpireStaggerItem index={1} count={3} baseDelayMs={MS.quick} gapMs={STAGGER.card} distance={8}>
              <View style={st.statPill}>
                <Text style={st.statText}>Best {Math.round(reward.biggestHit).toLocaleString()}</Text>
              </View>
            </SpireStaggerItem>
            {reward.parries > 0 && (
              <SpireStaggerItem index={2} count={3} baseDelayMs={MS.quick} gapMs={STAGGER.card} distance={8}>
                <View style={[st.statPill, { backgroundColor: '#CCFBF1', borderColor: TONE.upside }]}>
                  <Text style={[st.statText, { color: TONE.upside }]}>
                    Parries {reward.parries}{reward.perfectParries > 0 ? ` (★${reward.perfectParries})` : ''}
                  </Text>
                </View>
              </SpireStaggerItem>
            )}
          </View>
          {lastFight && (
            <Btn
              small
              variant="secondary"
              label="What happened? See the fight"
              icon="delapouite/scroll-quill"
              onPress={() => { sfx('click'); onReplayOpened?.(); setReplayOpen(true); }}
            />
          )}
        </SpireStaggerItem>

        {damageStory && damageStory.totalDamage > 0 && (
          <BattleDamageStory
            story={damageStory}
            title={lastFight ? `FLOOR ${run.floor} DAMAGE BREAKDOWN` : 'CLIMB DAMAGE REPORT'}
            weaponBuilds={storyBuilds}
            startDelayMs={260}
            reduced={reduced}
            hidePowerNote
            testID="spire-reward-damage-story"
          />
        )}

        {/* 1. Weapon Draft — smooth crossfade into celebratory Claimed card (no instant list jump!) */}
        {(unclaimedWeapon || claimedWeapon) && (
          <SpireStaggerItem index={1} count={4} baseDelayMs={MS.feedback} gapMs={STAGGER.item}>
            <SpireCrossfadeSwap swapKey={reward.weaponClaimed ? `claimed-${claimedWeapon?.weapon.id ?? 'skip'}` : `draft-${rerollSeq}`}>
              {!reward.weaponClaimed && reward.weaponOptions.length > 0 ? (
                <View style={st.sectionCard} testID="spire-weapon-draft">
                  <View style={st.sectionHead}>
                    <View style={st.sectionTitleRow}>
                      <Text style={st.sectionTitle}>DRAFT A WEAPON (PICK 1 OF {reward.weaponOptions.length})</Text>
                      {beltFull && (
                        <View style={st.fullPill} testID="spire-draft-belt-full">
                          <Text style={st.fullPillText}>
                            {`BELT ${run.weapons.length}/${MAX_SUMMIT_WEAPONS}`}
                          </Text>
                        </View>
                      )}
                    </View>
                    {!reward.weaponRerolled && (
                      <SpireTactilePressable
                        testID="spire-draft-reroll"
                        small
                        disabled={run.coins < REWARD_REROLL_COST}
                        onPress={() => {
                          band.cue('reelSpin');
                          setSwapIdx(null);
                          setInspectIdx(0);
                          setRerollSeq(n => n + 1);
                          onRerollWeapons();
                        }}
                        style={[st.miniBtn, run.coins < REWARD_REROLL_COST && { opacity: 0.4 }]}
                      >
                        <Icon name="lorc/cycle" size={12} color={INK} />
                        <Text style={st.miniBtnText}>Reroll {REWARD_REROLL_COST}¢</Text>
                      </SpireTactilePressable>
                    )}
                  </View>

                  <View style={st.choiceList}>
                    {reward.weaponOptions.map((opt, i) => {
                      const heldLv = run.weaponLevels[opt.weaponId];
                      const isUpgrade = heldLv !== undefined;
                      const needsSwap = beltFull && !isUpgrade;
                      const w = getArmoryWeapon(opt.weaponId, { [opt.weaponId]: { level: opt.level, tuning: {} } });
                      if (!w) return null;
                      const newEvos = isUpgrade ? [] : newEvolutionRecipesArmedBy(run, opt.weaponId);
                      const clashes = isUpgrade ? [] : clashesWithBelt(run.weapons, opt.weaponId);
                      const badges: OfferBadge[] = [];
                      if (isUpgrade) {
                        badges.push({ icon: 'delapouite/upgrade', text: `LV ${heldLv} → ${opt.level}`, bg: '#D97706' });
                      }
                      if (newEvos.length > 0) {
                        badges.push({
                          icon: 'sbed/electric',
                          text:
                            newEvos.length > 1
                              ? `ARMS ${newEvos[0].name} +${newEvos.length - 1}`
                              : `ARMS ${newEvos[0].name}`,
                          bg: TONE.evoReady,
                        });
                      }
                      if (clashes.length > 0) {
                        badges.push({
                          icon: 'lorc/laser-warning',
                          text:
                            clashes.length > 1
                              ? `CLASHES WITH ${clashes[0].partnerName.toUpperCase()} +${clashes.length - 1}`
                              : `CLASHES WITH ${clashes[0].partnerName.toUpperCase()}`,
                          bg: '#B45309',
                        });
                      }
                      return (
                        <SpireStaggerItem
                          key={`${rerollSeq}-${opt.weaponId}-${i}`}
                          index={i}
                          count={reward.weaponOptions.length}
                          baseDelayMs={rerollSeq === 0 ? MS.quick : 0}
                          gapMs={STAGGER.item}
                          distance={10}
                        >
                          <View style={{ gap: 5 }}>
                            <WeaponOfferRow
                              weapon={w}
                              level={opt.level}
                              badges={badges.length > 0 ? badges : undefined}
                              focused={inspectIdx === i}
                              triggerKey={offerFlourish[i]}
                              onPress={() => {
                                sfx('click');
                                setInspectIdx(i);
                                setOfferFlourish(prev => ({ ...prev, [i]: (prev[i] ?? 0) + 1 }));
                              }}
                              right={
                                <Btn
                                  testID={`spire-draft-pick-${i}`}
                                  small
                                  label={isUpgrade ? 'Upgrade' : needsSwap ? 'Swap' : 'Draft'}
                                  onPress={() => {
                                    if (needsSwap) {
                                      sfx('click');
                                      setInspectIdx(i);
                                      setSwapIdx(prev => (prev === i ? null : i));
                                      return;
                                    }
                                    band.cue(isUpgrade ? 'levelUp' : 'weaponGet');
                                    band.fire(w.id, 4);
                                    setSwapIdx(null);
                                    setClaimedWeapon({
                                      weapon: w,
                                      level: opt.level,
                                      isUpgrade,
                                      flourishKey: ++claimSeqRef.current,
                                    });
                                    onClaimWeapon(i);
                                  }}
                                />
                              }
                            />
                            {needsSwap && (
                              <SpireSwapPicker
                                visible={swapIdx === i}
                                run={run}
                                incomingWeaponId={opt.weaponId}
                                incomingLevel={opt.level}
                                testIDPrefix="spire-draft-swap"
                                onConfirmSwap={dropId => {
                                  band.cue('weaponGet');
                                  band.fire(w.id, 4);
                                  setSwapIdx(null);
                                  setClaimedWeapon({
                                    weapon: w,
                                    level: opt.level,
                                    isUpgrade: false,
                                    flourishKey: ++claimSeqRef.current,
                                  });
                                  onClaimWeapon(i, dropId);
                                }}
                                onCancel={() => {
                                  sfx('click');
                                  setSwapIdx(null);
                                }}
                              />
                            )}
                            {newEvos.length > 0 && (
                              <View style={st.evoCallouts} testID={`spire-draft-evo-${i}`}>
                                {newEvos.slice(0, 2).map(r => (
                                  <ArmedEvolutionRow key={r.id} recipe={r} showFamily />
                                ))}
                              </View>
                            )}
                            {clashes.length > 0 && (
                              <View style={st.clashBox} testID={`spire-draft-clash-${i}`}>
                                {clashes.map(c => (
                                  <View key={c.partnerId} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Icon name="lorc/laser-warning" size={12} color="#92400E" noShadow />
                                    <Text style={[st.clashText, { flex: 1 }]}>
                                      Clash with {c.partnerName}: {c.reason}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </SpireStaggerItem>
                      );
                    })}
                  </View>

                  {/* Shared WeaponExplainer for the tapped option */}
                  {inspectedWeapon && inspectedOffer && (
                    <SpireCrossfadeSwap swapKey={`${rerollSeq}-${inspectedOffer.weaponId}`}>
                      <WeaponExplainer
                        weapon={inspectedWeapon}
                        build={{ level: inspectedOffer.level, tuning: {} }}
                        hidePowerNote
                      />
                    </SpireCrossfadeSwap>
                  )}

                  <Btn
                    testID="spire-draft-skip"
                    small
                    variant="ghost"
                    label={`Skip weapon draft (+${SKIP_WEAPON_COINS}¢)`}
                    onPress={() => { sfx('click'); setSwapIdx(null); onSkipWeapon(); }}
                  />
                </View>
              ) : claimedWeapon ? (
                <ClaimedWeaponFlourishCard
                  weapon={claimedWeapon.weapon}
                  level={claimedWeapon.level}
                  isUpgrade={claimedWeapon.isUpgrade}
                  flourishKey={claimedWeapon.flourishKey}
                />
              ) : null}
            </SpireCrossfadeSwap>
          </SpireStaggerItem>
        )}

        {/* 2. Elite / Boss Bonus Skill Tree Node Draft */}
        {(unclaimedSkill || claimedSkillName) && (
          <SpireStaggerItem index={2} count={4} baseDelayMs={MS.quick} gapMs={STAGGER.item}>
            <SpireCrossfadeSwap swapKey={reward.skillClaimed ? 'skill-claimed' : 'skill-open'}>
              {!reward.skillClaimed && availSkills.length > 0 ? (
                <View style={st.sectionCard} testID="spire-skill-draft">
                  <Text style={st.sectionTitle}>FIGHTER SKILL NODE (PICK 1 OF {availSkills.length})</Text>
                  <View style={st.choiceList}>
                    {availSkills.map((id, i) => (
                      <SpireStaggerItem key={id} index={i} count={availSkills.length} gapMs={STAGGER.card} distance={8}>
                        <SkillNodeRow
                          testID={`spire-skill-pick-${i}`}
                          nodeId={id}
                          onPress={() => {
                            band.cue('levelUp');
                            setClaimedSkillName(getSkillNode(id)?.name ?? id);
                            onClaimSkill(id);
                          }}
                        />
                      </SpireStaggerItem>
                    ))}
                  </View>
                  <Btn small variant="ghost" label="Skip skill node" onPress={onSkipSkill} />
                </View>
              ) : claimedSkillName ? (
                <View style={st.claimedStrip} testID="spire-skill-claimed-banner">
                  <Icon name="lorc/meditation" size={18} color={TONE.upside} />
                  <Text style={st.claimedStripText}>Skill Mastered: {claimedSkillName} ✓</Text>
                </View>
              ) : null}
            </SpireCrossfadeSwap>
          </SpireStaggerItem>
        )}

        {/* 3. Elite / Boss Bonus Arcana Draft */}
        {(unclaimedArcana || claimedArcanaName) && (
          <SpireStaggerItem index={3} count={4} baseDelayMs={MS.quick} gapMs={STAGGER.item}>
            <SpireCrossfadeSwap swapKey={reward.arcanaClaimed ? 'arcana-claimed' : 'arcana-open'}>
              {!reward.arcanaClaimed && availArcana.length > 0 ? (
                <View style={st.sectionCard} testID="spire-arcana-draft">
                  <Text style={st.sectionTitle}>ARCANA WILDCARD (OPTIONAL)</Text>
                  <View style={st.choiceList}>
                    {availArcana.map((id, i) => (
                      <SpireStaggerItem key={id} index={i} count={availArcana.length} gapMs={STAGGER.card} distance={8}>
                        <ArcanaCard
                          testID={`spire-arcana-pick-${i}`}
                          arcanaId={id}
                          onPress={() => {
                            band.cue('catalyst');
                            setClaimedArcanaName(getArcana(id).name);
                            onClaimArcana(id);
                          }}
                        />
                      </SpireStaggerItem>
                    ))}
                  </View>
                  <Btn small variant="ghost" label="Decline Arcana" onPress={onSkipArcana} />
                </View>
              ) : claimedArcanaName ? (
                <View style={[st.claimedStrip, { borderColor: TONE.arcana, backgroundColor: TONE.arcanaPale }]} testID="spire-arcana-claimed-banner">
                  <Icon name="lorc/crystal-wand" size={18} color={TONE.arcana} />
                  <Text style={st.claimedStripText}>Arcana Bound: {claimedArcanaName} ✓</Text>
                </View>
              ) : null}
            </SpireCrossfadeSwap>
          </SpireStaggerItem>
        )}

        {onReorderWeapon && run.weapons.includes('understudy') && run.weapons.length > 1 && (
          <SpireBeltBar
            run={run}
            onReorder={onReorderWeapon}
            title="BELT ORDER"
            compact
            testIDPrefix="spire-reward-belt"
          />
        )}

        {onRateFun && (
          <RoundFunPrompt
            rating={funRating}
            tags={funTags}
            onChange={onRateFun}
            compact
            title="Was that battle fun?"
            testIDPrefix="spire-reward-fun"
          />
        )}

        {confirmSkip && !allDone ? (
          <View style={st.confirmSkipBox} testID="spire-reward-confirm-skip">
            <Text style={st.confirmSkipHint}>
              Unclaimed reward{unclaimedSummary.includes(',') ? 's' : ''} remaining: {unclaimedSummary}
            </Text>
            <View style={st.confirmSkipRow}>
              <Btn
                testID="spire-reward-cancel-skip"
                small
                variant="secondary"
                label="Keep Drafting"
                onPress={() => { sfx('click'); setConfirmSkip(false); }}
              />
              <Btn
                testID="spire-reward-continue"
                small
                variant="dark"
                label="Skip Unclaimed Rewards?"
                onPress={() => { sfx('confirm'); setConfirmSkip(false); onContinue(); }}
                style={st.confirmSkipBtn}
              />
            </View>
          </View>
        ) : (
          <Btn
            testID="spire-reward-continue"
            label={
              reward.isActBoss
                ? run.act === 3 && !run.endless
                  ? 'Claim Summit Victory!'
                  : `Ascend to Act ${run.act + 1} (+1 Max ♥)`
                : allDone
                  ? 'Continue Climb'
                  : 'Proceed to Map'
            }
            icon={reward.isActBoss ? 'lorc/crown' : 'lorc/mountaintop'}
            onPress={() => {
              if (!allDone) {
                sfx('click');
                setConfirmSkip(true);
                return;
              }
              sfx('confirm');
              onContinue();
            }}
          />
        )}
      </ScrollView>

      {lastFight && (
        <FightReplay
          visible={replayOpen}
          run={lastFight.run}
          onClose={() => setReplayOpen(false)}
        />
      )}
    </View>
  );
};

/** Celebratory weapon claim banner that plays the WeaponAvatar flourish + playful pop instead of an empty list jump. */
const ClaimedWeaponFlourishCard: React.FC<{
  weapon: Weapon;
  level: number;
  isUpgrade: boolean;
  flourishKey: number;
}> = ({ weapon, level, isUpgrade, flourishKey }) => {
  const reduced = useReducedMotion();
  const [trigger, setTrigger] = useState(0);
  const scale = useSharedValue(SPIRE_MOTION_INSTANT || reduced ? 1 : 0.92);

  useEffect(() => {
    if (SPIRE_MOTION_INSTANT) return;
    const t = setTimeout(() => setTrigger(n => n + 1), OVERLAP.primaryMs);
    if (!reduced) {
      scale.value = withSequence(
        withTiming(SCALE.pop, { duration: MS.feedback, easing: EASE.popSoft }),
        withSpring(1, SPRING.playful)
      );
    }
    return () => {
      clearTimeout(t);
      cancelAnimation(scale);
    };
  }, [flourishKey, reduced, scale]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[st.claimedWeaponCard, anim]} testID="spire-weapon-claimed-banner">
      <View style={st.claimedWeaponIcon}>
        <WeaponAvatar weapon={weapon} size={34} triggerKey={trigger} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Eyebrow text={isUpgrade ? `UPGRADED TO LV ${level}!` : `DRAFTED TO BELT!`} color={COLORS.actionYellow} />
        <Text style={st.claimedWeaponTitle} numberOfLines={1}>{weapon.name}</Text>
      </View>
      <Icon name="lorc/trophy" size={20} color={TONE.coinBright} />
    </Animated.View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  body: { padding: 14, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  bannerCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 14, gap: 8 },
  bannerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 22, fontWeight: '900', color: INK },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  coinCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.canvasWhite,
    borderColor: INK,
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 64,
  },
  coinCountText: { fontFamily: MONO_FONT, fontWeight: '800', color: INK, fontSize: 14, fontVariant: ['tabular-nums'] },
  statPill: { backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 4 },
  statText: { fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  claimedWeaponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: INK,
    padding: 12,
  },
  claimedWeaponIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimedWeaponTitle: { fontSize: 16, fontWeight: '900', color: INK },
  claimedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: TONE.upside,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  claimedStripText: { fontSize: 13, fontWeight: '900', color: INK },
  sectionCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flexShrink: 1, minWidth: 0 },
  sectionTitle: { flexShrink: 1, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  fullPill: { backgroundColor: '#FEF3C7', borderRadius: 4, borderWidth: 1, borderColor: '#D97706', paddingHorizontal: 5, paddingVertical: 1 },
  fullPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: '#92400E' },
  miniBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 3 },
  miniBtnText: { fontSize: 11, fontWeight: '800', color: INK },
  choiceList: { gap: 8 },
  evoCallouts: { gap: 4, paddingLeft: 4 },
  clashBox: { backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1.5, borderColor: '#D97706', paddingHorizontal: 9, paddingVertical: 6, gap: 2 },
  clashText: { fontSize: 11.5, fontWeight: '800', color: '#92400E', lineHeight: 16 },
  confirmSkipBox: { backgroundColor: '#FFFBEB', borderRadius: 12, borderWidth: 2, borderColor: '#B45309', padding: 10, gap: 8 },
  confirmSkipHint: { fontSize: 12, fontWeight: '800', color: '#92400E', textAlign: 'center' },
  confirmSkipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmSkipBtn: { flex: 1, backgroundColor: '#B91C1C', borderColor: '#7F1D1D' },
});

export default SpireRewardScreen;
