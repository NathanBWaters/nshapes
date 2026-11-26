/**
 * End-of-level screen: the card arrives whole, the stars fall in one by one and tick their goals,
 * then the coins count out; unlocks wait for their reveal.
 * The choreography lives in ResultsMotion.tsx (review: docs/motion/reviews/results-payout.md).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useColorblind } from '@/utils/cardColors';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { band, sfx } from '@/audio';
import type { LevelDef, RunState } from '../types';
import { isLevelUnlocked, type ResultApplication } from '../progress';
import { damagePerMinute } from '../history';
import { formatPower, powerMultiplier } from '../data/weaponPower';
import { getBiome } from '../data/biomes';
import { levelFoe } from '../data/foes';
import { getMechanic } from '../data/mechanics';
import { BOUNTIES } from '../data/bounties';
import { MAIN_LEVELS, mainIndexOf, getLevel } from '../data/levels';
import { STORY_BOSS_CALLBACKS } from '../data/story';
import { shouldShowDamageNumbers, companionResultsLine, diagnoseResultTip } from '../coach';
import CompanionBubble from './CompanionBubble';
import { explainStarBreakdown } from '../engine/challenges';
import { Btn, INK, starLandMs, starPopDelayMs, StarRow, TONE } from './ui';
import { COIN_TICK_MS, coinRollAmount, coinRollTicks, coinStartMs, CountingCoinPill, FadeAt, FIGHTER_CHEER_LAG_MS, missesShownMs, ResultsCard, ResultStars, revealPayoutMs, rowTurnMs, sealLandMs, TICK_LAG_MS, TickAt, TurnOver, VictorySeal, VictorySunburst } from './ResultsMotion';
import { Silhouette, UnlockableAvatar, describeRewardUnlocks, describeUnlock } from './rewards';
import type { FunRating, FunTag } from '@/analytics/fightEvent';
import RoundFunPrompt from '@/components/RoundFunPrompt';
import { buildDamageStory } from '../engine/damageStory';
import BattleDamageStory from './BattleDamageStory';
import FightReplay from './FightReplay';
import PowerExplainer from './PowerExplainer';
import { resolveVictoryCallout } from '../victoryCallout';

interface Props {
  level: LevelDef;
  run: RunState;
  stars: number;
  result: ResultApplication;
  /** The best damage per minute on this level before this battle (null: it had not been fought) */
  bestDpm?: number | null;
  /** False until the unlock reveal has played, so rewards stay secret */
  unlocksRevealed: boolean;
  nextLevel: LevelDef | null;
  nextUnlocked: boolean;
  funRating?: FunRating | null;
  funTags?: FunTag[];
  onRateFun?: (rating: FunRating | null, tags: FunTag[]) => void;
  onReplayOpened?: () => void;
  onRetry: () => void;
  onNext: () => void;
  onMap: () => void;
  onCamp: (tab?: 'fighters' | 'workshop') => void;
  /** Optional 1-tap "Arm <Recipe> & Retry" handler from context-aware defeat diagnostic ([OB-17]) */
  onArmRecipeAndRetry?: (recipeId: string) => void;
  /** Optional replay trigger for the 5-5 Hydra ending ceremony ([OB-20]) */
  onWatchEnding?: () => void;
}

const LevelResults: React.FC<Props> = ({
  level,
  run,
  stars,
  result,
  bestDpm = null,
  unlocksRevealed,
  nextLevel,
  nextUnlocked,
  funRating = null,
  funTags = [],
  onRateFun,
  onReplayOpened,
  onRetry,
  onNext,
  onMap,
  onCamp,
  onArmRecipeAndRetry,
  onWatchEnding,
}) => {
  const insets = useSafeAreaInsets();
  const colorblind = useColorblind();
  const [replayOpen, setReplayOpen] = useState(false);
  const [powerInfoOpen, setPowerInfoOpen] = useState(false);
  const biome = getBiome(level.biome);
  /** A practice fight has no result: the player simply left */
  const practice = !!level.rules.sandbox;
  const won = stars > 0 || practice;
  const knockedOut = run.endReason === 'defeated';
  const hasHearts = run.hearts !== null && run.maxHearts !== null && run.maxHearts > 0;
  const newlyReachableBiome =
    result.newlyOpenedBiomes.find(b => {
      const first = MAIN_LEVELS.find(l => l.biome === b);
      return first ? isLevelUnlocked(result.save, first) : false;
    }) ?? (won && nextLevel && nextUnlocked && nextLevel.biome !== level.biome ? nextLevel.biome : undefined);

  // The battle's score: damage per minute of fight clock, against the best on this level so far
  const dpm = damagePerMinute(run);
  const newBest = bestDpm !== null && dpm > bestDpm;
  const callout = resolveVictoryCallout({
    stars: practice ? null : stars,
    endReason: run.endReason,
    damageReceived: run.roundStats.damageReceived,
    mistakes: run.mistakes,
    hasHearts,
    heartsLeft: run.hearts,
    isBoss: Boolean(level.isBoss),
    isPerfectParryKo: run.lastSetIgnition?.parryKind === 'perfect' && knockedOut,
    finalBlowDmg: run.lastSetIgnition ? Math.round(run.lastSetIgnition.turnDamage ?? run.lastSetIgnition.math.hit) : 0,
    practice,
    newBest,
  });
  const title = callout.headline;
  /** Earned victory performance seal stamped onto the hero crest after the stars lock in */
  const rankSeal = callout.rankSeal;

  const reduced = useReducedMotion();
  const revealedFirst = React.useRef(unlocksRevealed);
  useEffect(() => {
    // Angry Birds–style star sequence: brisk rising swoosh as each giant star launches across
    // the screen, then heavy stamp thwack + ascending triad chime on the exact landing frame.
    // Reduced motion shows every star at once: one unified chord, no swoosh.
    if (reduced) {
      if (stars > 0) band.cue('star', { amount: stars });
      return;
    }
    const ts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= stars; i++) {
      ts.push(setTimeout(() => band.cue('starSwoosh', { amount: i }), starPopDelayMs(i - 1)));
      ts.push(setTimeout(() => band.cue('star', { amount: i }), starLandMs(i - 1)));
    }
    if (rankSeal) {
      ts.push(setTimeout(() => band.cue('rankSeal'), sealLandMs(stars)));
    }
    return () => ts.forEach(clearTimeout);
  }, [stars]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCoins = result.starCoins + result.coinsBanked + result.bountyCoins;
  const showBank = result.save.coinsUnlocked && totalCoins > 0;
  const coinsCount = showBank && !practice && !reduced;
  // A bigger payout rolls longer (5 ticks for a handful of coins, 16 at most: 0.7 s)
  const rollAmount = coinRollAmount(totalCoins);

  // The fighter cheers last, when the payout is done (on the coin bell, or after the stars when no
  // coins count): the leap answers the stars and coins, it never competes with them
  // (When an unlock reveal is coming, not before it closes: the reveal would cover the leap mid-air.)
  const [cheer, setCheer] = useState(reduced || stars === 0);
  const firstRevealed = React.useRef(unlocksRevealed);
  useEffect(() => {
    if (cheer || coinsCount || !unlocksRevealed) return;
    const t = setTimeout(() => setCheer(true), firstRevealed.current ? starLandMs(stars - 1) + FIGHTER_CHEER_LAG_MS : revealPayoutMs(handoffRows));
    return () => clearTimeout(t);
  }, [unlocksRevealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const rollTicks = coinRollTicks(rollAmount);
  // The payout starts once the player can see it: after the stars, or, when an unlock
  // reveal covers the screen, just after the last reveal is closed
  const [paying, setPaying] = useState(false);
  const revealedAtStart = React.useRef(unlocksRevealed);
  useEffect(() => {
    if (!showBank || !unlocksRevealed || practice || reduced) return;
    const t = setTimeout(() => {
      band.cue('coinRoll', { amount: rollAmount });
      setPaying(true);
    }, revealedAtStart.current ? coinStartMs(stars) : revealPayoutMs(handoffRows));
    return () => clearTimeout(t);
  }, [unlocksRevealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const diagnostic = useMemo(
    () => (practice ? null : diagnoseResultTip(level, run, stars, result.save, colorblind)),
    [practice, level, run, stars, result.save, colorblind]
  );
  const companionText = [companionResultsLine(level, run, stars, result.save.coinsUnlocked), diagnostic?.text].filter(Boolean).join(' ');

  // A weapon the player already owned came back as a free level: name the level it reached
  const levelOf = (star: number, name: string) => {
    const u = result.unlocks.find(x => x.kind === 'weapon' && x.star === star && x.level !== undefined && describeUnlock(x).name === name);
    return u ? describeUnlock(u).revealed : null;
  };
  const starUnlocks = result.granted.flatMap(g =>
    describeRewardUnlocks(g.reward).map(unlock => {
      const levelled = unlock.kind === 'weapon' ? levelOf(g.star, unlock.name) : null;
      return { star: g.star, unlock: levelled ? { ...unlock, revealed: levelled, secret: levelled } : unlock };
    })
  );
  // Secret paths this result opened: named only once their reveal has played
  const newPaths = result.unlocks.filter(u => u.kind === 'path').map(describeUnlock);
  /** Rows that turn over when the reveals close (only when there were reveals to close) */
  const handoffRows = unlocksRevealed && revealedFirst.current ? 0 : starUnlocks.length + newPaths.length;
  const activeBountyHooks = result.save.bountiesUnlocked && !practice
    ? BOUNTIES
        .filter(b => !result.save.completedBounties.includes(b.id) && b.progress(result.save) > 0)
        .sort((a, b) => b.progress(result.save) / b.target - a.progress(result.save) / a.target)
        .slice(0, 2)
    : [];
  const showNumbers = shouldShowDamageNumbers(level, result.save);
  const damageStory = useMemo(() => buildDamageStory(run), [run]);
  const showDamageStory =
    damageStory.totalDamage > 0 &&
    (showNumbers || practice || run.weapons.length > 0 || damageStory.sources.length >= 2);
  // Start the 3-second battle damage story crescendo cleanly after stars & coins settle
  const storyStartDelayMs = revealedAtStart.current
    ? showBank && !practice
      ? coinStartMs(stars) + rollTicks * COIN_TICK_MS + 260
      : (stars > 0 ? starLandMs(stars - 1) : 0) + 380
    : revealPayoutMs(handoffRows) + (showBank && !practice ? rollTicks * COIN_TICK_MS + 260 : 320);
  const canGoOn = won && !!nextLevel && nextUnlocked;
  const nextFoe = canGoOn && nextLevel ? levelFoe(nextLevel) : null;
  const nextIsNew = !!nextLevel && !result.save.seenMechanics.includes(nextLevel.introduces);
  const resultFighterHealth = won
    ? (hasHearts ? Math.max(1, run.hearts!) : 3)
    : 0;
  const resultFighterMaxHealth = hasHearts ? run.maxHearts! : 3;

  return (
    <View style={[st.root, { backgroundColor: biome.colors.sky, paddingTop: insets.top + 6 }]}>
      <ScrollView contentContainerStyle={st.scroll}>
        <ResultsCard reduced={reduced} stampStars={won && !practice ? stars : 0} style={st.card}>
          {/* Ceremonial Dark-Onyx Victory Stage Header */}
          <View style={st.heroBand}>
            <View style={[st.heroBgClip, !won && st.heroBgDefeat]} pointerEvents="none">
              {won && !practice && <VictorySunburst stars={stars} reduced={reduced} />}
              <View style={[st.heroAccentBar, !won && st.heroAccentDefeat]} />
            </View>

            {/* Top meta bar: level ribbon + stamped Victory Rank Seal */}
            <View style={st.heroTopRow}>
              <View style={st.levelPill}>
                <Text style={st.levelId} numberOfLines={1}>
                  {practice ? 'PRACTICE' : level.id} · {level.name}
                </Text>
              </View>
              {rankSeal && (
                <VictorySeal
                  label={rankSeal.label}
                  accent={rankSeal.accent}
                  at={sealLandMs(stars)}
                  reduced={reduced}
                />
              )}
            </View>

            {/* Champion Fighter vs Vanquished Foe */}
            <View style={st.matchupRow}>
              <View style={[st.championRing, won && !practice && st.championRingGold]}>
                <FighterAvatar
                  testID="results-fighter-avatar"
                  character={run.fighter}
                  size={60}
                  health={resultFighterHealth}
                  maxHealth={resultFighterMaxHealth}
                  mood={won ? 'victory' : 'defeat'}
                  reaction={won && cheer ? { type: stars >= 3 ? 'ecstatic' : 'joy', id: 1 } : null}
                  framed
                  interactive
                />
              </View>
              <Text style={st.vsBadge}>VS</Text>
              <View style={st.foeWrap}>
                <View style={won && knockedOut && !practice ? st.foeBeaten : undefined}>
                  <EnemyAvatar
                    testID="results-enemy-avatar"
                    enemy={{ name: run.foeName, icon: run.foeIcon, tier: run.foe.tier }}
                    size={48}
                    hp={run.foeHp}
                    maxHp={run.foeMaxHp}
                    mood={practice ? 'idle' : won && knockedOut ? 'cornered' : won ? 'idle' : 'victory'}
                    reaction={!won ? { type: 'taunt', id: 1 } : null}
                    framed
                    interactive
                  />
                </View>
                {won && knockedOut && !practice && (
                  <View testID="results-ko-tag" style={st.koTag}>
                    <Text style={st.koTagText}>K.O.</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Monumental Gold Victory Title */}
            <Text
              testID="results-title"
              style={[
                st.title,
                (practice || title.length > 13) && st.titleCompact,
                !won && st.titleDefeat,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {title}
            </Text>

            {/* Giant Arched Angry Birds–style SVG Trophy Stars */}
            {!practice && <ResultStars stars={stars} size={65} reduced={reduced} darkSocket />}

            {/* The stars are the shards of the fallen star this foe was holding (data/story.ts) */}
            {!practice && (
              // The caption of the stars: it would spoil them if it came first
              <FadeAt at={missesShownMs(stars)} reduced={reduced}>
                <Text style={st.shards} testID="results-shards">
                  {stars >= 3 ? 'All 3 star shards won back!' : stars > 0 ? `${stars} of 3 star shards won back` : 'No shards this time'}
                </Text>
              </FadeAt>
            )}
          </View>

          {/* Clean Tactile Paper Body */}
          <View style={st.body}>
          <CompanionBubble
            testID="results-companion-bubble"
            character={run.fighter}
            mood={won ? 'victory' : 'anticipation'}
            tone={stars >= 3 ? 'cheer' : !won ? 'warn' : 'warm'}
            avatarSize={34}
            text={companionText}
            style={{ alignSelf: 'stretch' }}
          />
          {diagnostic?.quickAction && (
            <Btn
              testID="results-quick-action"
              small
              variant="primary"
              icon={
                diagnostic.quickAction.kind === 'arm_recipe'
                  ? 'lorc/crystal-shine'
                  : diagnostic.quickAction.kind === 'open_tree'
                    ? 'lorc/flat-star'
                    : 'lorc/gear-hammer'
              }
              label={diagnostic.quickAction.label}
              onPress={() => {
                const qa = diagnostic.quickAction!;
                if (qa.kind === 'arm_recipe' && qa.payload && onArmRecipeAndRetry) {
                  onArmRecipeAndRetry(qa.payload);
                } else if (qa.kind === 'open_tree') {
                  onCamp('fighters');
                } else if (qa.kind === 'open_workshop') {
                  onCamp('workshop');
                }
              }}
              style={{ alignSelf: 'stretch' }}
            />
          )}

          {!practice && (
            <View style={st.breakdownBox} testID="results-star-breakdown">
              {/* The goals are there from the start; each ✓ lands just behind its star, the misses once the stars are done */}
              {explainStarBreakdown(level, run, stars).map(row => {
                const lands = row.earned && row.star <= stars ? starLandMs(row.star - 1) + TICK_LAG_MS : missesShownMs(stars);
                return (
                  <View key={row.star} style={[st.breakdownRow, row.earned ? st.breakdownRowEarned : st.breakdownRowMissed]} testID={`results-star-row-${row.star}`}>
                    <Text style={[st.breakdownStars, row.earned ? st.breakdownStarsOn : st.breakdownStarsOff]}>
                      {'★'.repeat(row.star)}
                    </Text>
                    <Text style={st.breakdownGoal} numberOfLines={2}>{row.goal}</Text>
                    <TickAt at={lands} reduced={reduced} style={st.breakdownBadgeWrap}>
                      <View style={[st.breakdownBadge, row.earned ? st.breakdownBadgeOk : st.breakdownBadgeMiss]}>
                        <Text style={[st.breakdownBadgeText, row.earned ? st.breakdownBadgeTextOk : st.breakdownBadgeTextMiss]}>
                          {row.earned ? `✓ ${row.reason}` : `✗ ${row.reason}`}
                        </Text>
                      </View>
                    </TickAt>
                  </View>
                );
              })}
            </View>
          )}

          {/* The payout sits right under the goals, where it is on screen without scrolling */}
          {showBank && (
            <View style={st.bank} testID="results-bank">
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.bankLabel}>Coins earned</Text>
                {result.granted.map(g => (
                  <Text key={g.star} style={st.bankLine}>{'★'.repeat(g.star)} reward  +{g.reward.coins}</Text>
                ))}
                {result.coinsBanked > 0 && <Text style={st.bankLine}>Coin drops  +{result.coinsBanked}</Text>}
                {result.bountyCoins > 0 && <Text style={st.bankLine}>Bounties  +{result.bountyCoins}</Text>}
              </View>
              {/* Counts up tick for tick with the coinRoll cue, and bumps on its closing bell */}
              <CountingCoinPill total={totalCoins} running={paying} ticks={rollTicks} reduced={reduced || practice} onBell={() => setCheer(true)} />
            </View>
          )}

          {/* What was won, right under the payout so it is on screen: each row turns over once its reveal has played */}
          {starUnlocks.length > 0 && (
            <View style={{ gap: 6, alignSelf: 'stretch' }}>
              <Text style={st.section}>UNLOCKED</Text>
              {starUnlocks.map(({ star, unlock }, k) => (
                <TurnOver
                  key={k}
                  shown={unlocksRevealed}
                  delay={rowTurnMs(k, handoffRows)}
                  reduced={reduced}
                  style={st.reward}
                  testID={`results-unlocked-${k}`}
                  face={shown => (
                    <>
                      <StarRow stars={star} max={star} size={14} />
                      {shown ? (
                        <UnlockableAvatar display={unlock} size={24} fighterMood="victory" iconSize={22} iconColor={COLORS.actionYellow} interactive />
                      ) : (
                        <Silhouette icon={unlock.icon} size={16} />
                      )}
                      <Text style={st.rewardText}>{shown ? unlock.revealed : unlock.secret}</Text>
                    </>
                  )}
                />
              ))}
            </View>
          )}

          {newPaths.map((path, k) => (
            <TurnOver
              key={k}
              shown={unlocksRevealed}
              delay={rowTurnMs(starUnlocks.length + k, handoffRows)}
              reduced={reduced}
              style={st.pathFound}
              testID="results-secret-path"
              face={shown => (
                <>
                  <Icon name="lorc/treasure-map" size={20} color={COLORS.actionYellow} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.pathFoundTitle}>SECRET PATH FOUND</Text>
                    <Text style={st.pathFoundText}>{shown ? `${path.revealed}. It is on the map now.` : 'Something new is on the map…'}</Text>
                  </View>
                </>
              )}
            />
          ))}

          {showNumbers && (
            <View style={st.statsRow}>
              <Stat testID="results-total-damage" icon="lorc/crossed-swords" label="Total damage" value={`${run.totalDamage}`} />
              <Stat testID="results-biggest-hit" icon="lorc/bright-explosion" label="Biggest hit" value={`${run.biggestHit}`} hot={run.biggestHit >= 25} />
              <Stat
                testID="results-dpm"
                icon="delapouite/speedometer"
                label="Damage / min"
                value={`${dpm}`}
                hot={newBest}
                note={newBest ? 'NEW BEST' : bestDpm !== null ? `best ${bestDpm}` : undefined}
              />
            </View>
          )}
          {(showNumbers || practice || run.evolutionsTriggered > 0 || run.armedRecipes.length > 0) && <View style={st.statsRow}>
            {(showNumbers || practice) && <Stat testID="results-sets" icon="lorc/checked-shield" label="Matches" value={`${run.matches}`} />}
            {(showNumbers || practice) && <Stat testID="results-mistakes" icon="lorc/cross-mark" label="Mistakes" value={`${run.mistakes}`} />}
            {run.power > 0 && (showNumbers || practice) && (
              <Stat
                testID="results-power"
                icon="lorc/power-lightning"
                label="Power reached"
                value={formatPower(run.power)}
                hot={powerMultiplier(run.power) >= 5}
                note={powerInfoOpen ? 'HIDE INFO' : 'TAP TO EXPLAIN'}
                onPress={() => { sfx('click'); setPowerInfoOpen(v => !v); }}
              />
            )}
            {practice && run.matches > 0 && (
              <Stat testID="results-per-set" icon="lorc/target-dummy" label="Per Set" value={`${Math.round(run.totalDamage / run.matches)}`} />
            )}
            {(run.evolutionsTriggered > 0 || run.armedRecipes.length > 0) && (
              <Stat testID="results-evolutions" icon="lorc/crystal-shine" label="Evolutions" value={`${run.evolutionsTriggered}`} />
            )}
          </View>}

          {powerInfoOpen && run.power > 0 && (showNumbers || practice) && (
            <PowerExplainer
              points={run.power}
              weapons={run.weapons}
              evolutionsTriggered={run.evolutionsTriggered}
              subtitle={`Finished the fight at ${formatPower(run.power)}`}
              compact
            />
          )}

          {showDamageStory && (
            <BattleDamageStory
              story={damageStory}
              weaponBuilds={run.weaponBuilds}
              startDelayMs={storyStartDelayMs}
              active={unlocksRevealed}
              reduced={reduced}
            />
          )}


          {result.completedBounties.length > 0 && (
            <View style={st.bountyDoneBox}>
              <Text style={st.section}>BOUNTIES COMPLETED</Text>
              {result.completedBounties.map(b => (
                <View key={b.id} style={st.bountyDoneRow}>
                  <Icon name={b.icon} size={18} color={COLORS.actionYellow} />
                  <Text style={st.rewardText}>{b.name}</Text>
                  <Text style={st.bountyCoinTag}>+{b.reward.coins}¢</Text>
                </View>
              ))}
            </View>
          )}

          {activeBountyHooks.length > 0 && result.completedBounties.length === 0 && (
            <View style={st.bountyHookBox}>
              <Text style={st.bountyHookHeader}>CROSS-RUN BOUNTY PROGRESS</Text>
              {activeBountyHooks.map(b => {
                const cur = Math.min(b.target, b.progress(result.save));
                return (
                  <View key={b.id} style={st.bountyHookRow}>
                    <Icon name={b.icon} size={14} color={INK} />
                    <Text style={st.bountyHookName} numberOfLines={1}>{b.name}</Text>
                    <Text style={st.bountyHookFrac}>{cur}/{b.target}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {won && level.isBoss && !practice && (
            <View testID="results-boss-clear" style={st.bossClear}>
              <Icon name="lorc/crown" size={20} color={INK} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={st.bossClearTitle}>{biome.name.toUpperCase()} GUARDIAN DEFEATED!</Text>
                <Text style={st.bossClearSub}>
                  {STORY_BOSS_CALLBACKS[level.id] ?? (nextLevel && nextUnlocked ? `The road to ${getBiome(nextLevel.biome).name} is open!` : 'Region complete!')}
                </Text>
                {level.id === '5-5' && onWatchEnding && (
                  <TouchableOpacity
                    testID="results-watch-ending"
                    onPress={() => { sfx('confirm'); onWatchEnding(); }}
                    style={st.endingBtn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={st.endingBtnText}>Watch Ending Ceremony</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {newlyReachableBiome && (
            <View style={st.biomeOpen}>
              <Icon name="lorc/padlock" size={18} color={COLORS.canvasWhite} />
              <Text style={st.biomeOpenText}>New region unlocked: {getBiome(newlyReachableBiome as LevelDef['biome']).name}!</Text>
            </View>
          )}

          {run.log.length > 1 && (practice || mainIndexOf(level) >= mainIndexOf(getLevel('1-4'))) && (
            <Btn
              testID="results-replay"
              label="What happened? See the fight"
              variant="secondary"
              icon="lorc/magnifying-glass"
              small
              onPress={() => { onReplayOpened?.(); setReplayOpen(true); }}
              style={{ alignSelf: 'stretch' }}
            />
          )}

          {onRateFun && (practice || mainIndexOf(level) >= mainIndexOf(getLevel('1-4'))) && (
            <RoundFunPrompt rating={funRating} tags={funTags} onChange={onRateFun} testIDPrefix="results-fun" />
          )}

          </View>
        </ResultsCard>
      </ScrollView>

      {/* What next: always in reach, never below the fold */}
      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]} testID="results-actions">
        {canGoOn && nextLevel && nextFoe ? (
          <TouchableOpacity testID="results-next" onPress={onNext} activeOpacity={0.85} style={st.nextBtn} accessibilityRole="button" accessibilityLabel={`Next: ${nextLevel.id} ${nextLevel.name}, against ${nextFoe.name}`}>
            <View style={st.nextFoe}>
              <EnemyAvatar enemy={nextFoe} size={40} mood="menacing" lightweight />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.nextLabel} numberOfLines={2}>NEXT: {nextLevel.name}</Text>
              <Text style={st.nextSub} numberOfLines={1}>
                {nextIsNew ? `New: ${getMechanic(nextLevel.introduces).title}` : `vs ${nextFoe.name}`}
              </Text>
            </View>
            <Icon name="lorc/crossed-swords" size={20} color={INK} />
          </TouchableOpacity>
        ) : (
          <Btn testID="results-retry" label={practice ? 'Practice again' : won ? 'Play again' : 'Try again'} onPress={onRetry} />
        )}
        <View style={st.footerRow}>
          {canGoOn && (
            <Btn testID="results-retry" small label={stars >= 3 ? 'Replay' : 'Retry'} variant="secondary" onPress={onRetry} style={{ flex: 1 }} />
          )}
          <Btn testID="results-map" small label="Map" variant="secondary" icon="lorc/field" onPress={onMap} style={{ flex: 1 }} />
          <Btn testID="results-camp" small label="Camp" variant="secondary" icon="lorc/campfire" onPress={() => onCamp()} style={{ flex: 1 }} />
        </View>
      </View>
      {replayOpen && <FightReplay run={run} visible onClose={() => setReplayOpen(false)} />}
    </View>
  );
};

const Stat: React.FC<{ icon: React.ComponentProps<typeof Icon>['name']; label: string; value: string; testID?: string; hot?: boolean; note?: string; onPress?: () => void }> = ({ icon, label, value, testID, hot, note, onPress }) => {
  const inner = (
    <>
      <Icon name={icon} size={18} color={INK} />
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
      {note && <Text style={st.statNote}>{note}</Text>}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={[st.stat, hot && { backgroundColor: COLORS.actionYellow }]} testID={testID} onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
        {inner}
      </TouchableOpacity>
    );
  }
  return (
    <View style={[st.stat, hot && { backgroundColor: COLORS.actionYellow }]} testID={testID}>
      {inner}
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 18,
    borderWidth: 3,
    borderBottomWidth: 7,
    borderColor: INK,
    alignItems: 'stretch',
    overflow: 'visible',
  },
  heroBand: {
    position: 'relative',
    paddingTop: 9,
    paddingBottom: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
    overflow: 'visible',
  },
  heroBgClip: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C1917',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  heroBgDefeat: {
    backgroundColor: '#25191A',
  },
  heroAccentBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: '#F5B800',
  },
  heroAccentDefeat: {
    backgroundColor: COLORS.impactRed,
  },
  heroTopRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
  },
  levelPill: {
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255, 253, 245, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelId: { fontWeight: '900', letterSpacing: 1.2, fontSize: 11, color: '#F5EFE6', flexShrink: 1 },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 2,
  },
  championRing: {
    borderRadius: 16,
    padding: 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 253, 245, 0.25)',
  },
  championRingGold: {
    borderColor: '#F5B800',
    backgroundColor: 'rgba(255, 222, 0, 0.12)',
  },
  vsBadge: {
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#D6CFC5',
    opacity: 0.8,
  },
  foeWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foeBeaten: {
    opacity: 0.72,
    transform: [{ rotate: '6deg' }],
  },
  koTag: {
    position: 'absolute',
    bottom: -5,
    right: -6,
    backgroundColor: COLORS.impactRed,
    borderWidth: 1.5,
    borderColor: INK,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    transform: [{ rotate: '-6deg' }],
  },
  koTagText: {
    color: COLORS.canvasWhite,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 2.2,
    color: COLORS.actionYellow,
    textShadowColor: '#0B0908',
    textShadowRadius: 3,
    textAlign: 'center',
    marginTop: 0,
  },
  titleCompact: {
    fontSize: 22,
    letterSpacing: 1.5,
  },
  titleDefeat: {
    color: '#FF7B73',
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 7,
  },
  sub: { textAlign: 'center', color: INK, fontSize: 14 },
  breakdownBox: { alignSelf: 'stretch', gap: 4, backgroundColor: '#FAF7F0', borderRadius: 10, borderWidth: 1.5, borderColor: INK, padding: 7 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 6, paddingVertical: 2.5, paddingHorizontal: 6, borderRadius: 6 },
  breakdownRowEarned: { backgroundColor: '#FFFFFF' },
  breakdownRowMissed: { backgroundColor: '#F5F0E6', opacity: 0.92 },
  breakdownStars: { width: 42, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  breakdownStarsOn: { color: '#E0A800' },
  breakdownStarsOff: { color: '#B8B0A4' },
  breakdownGoal: { flex: 1, fontSize: 12, fontWeight: '800', color: INK },
  breakdownBadgeWrap: { flexShrink: 1, maxWidth: '52%' },
  breakdownBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  breakdownBadgeOk: { backgroundColor: '#D4F4EE' },
  breakdownBadgeMiss: { backgroundColor: '#FFE8E5' },
  breakdownBadgeText: { fontSize: 11, fontWeight: '900' },
  breakdownBadgeTextOk: { color: '#0F766E' },
  breakdownBadgeTextMiss: { color: '#B91C1C' },
  statsRow: { flexDirection: 'row', gap: 6, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: INK, paddingVertical: 5 },
  statValue: { fontWeight: '900', fontSize: 17, color: INK, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 10.5, fontWeight: '700', color: INK, opacity: 0.72 },
  statNote: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: INK, opacity: 0.75 },
  bank: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: TONE.coinPale, borderRadius: 8, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 10, paddingVertical: 6 },
  bankLabel: { fontWeight: '900', color: INK },
  bankLine: { fontSize: 12, color: INK, opacity: 0.8, fontVariant: ['tabular-nums'] },
  section: { fontWeight: '900', letterSpacing: 2, fontSize: 12, color: INK },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.deepOnyx, borderRadius: 8, padding: 8 },
  rewardText: { flex: 1, fontWeight: '900', color: COLORS.actionYellow, fontSize: 14 },
  bountyDoneBox: { alignSelf: 'stretch', gap: 6 },
  bountyDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.deepOnyx, borderRadius: 8, padding: 8 },
  bountyCoinTag: { fontWeight: '900', color: '#FDE68A', fontSize: 12 },
  bountyHookBox: { alignSelf: 'stretch', backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  bountyHookHeader: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: INK, opacity: 0.7 },
  bountyHookRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bountyHookName: { flex: 1, fontSize: 12, fontWeight: '800', color: INK },
  bountyHookFrac: { fontSize: 12, fontWeight: '900', color: TONE.upside, fontVariant: ['tabular-nums'] },
  biomeOpen: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: INK, borderRadius: 8, padding: 10 },
  biomeOpenText: { flex: 1, flexShrink: 1, color: COLORS.canvasWhite, fontWeight: '800' },
  bossClear: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', backgroundColor: COLORS.actionYellow, borderRadius: 10, borderWidth: 2, borderColor: INK, padding: 10 },
  bossClearTitle: { fontWeight: '900', fontSize: 13, letterSpacing: 1, color: INK, flexShrink: 1 },
  bossClearSub: { fontSize: 12, fontWeight: '700', color: INK, flexShrink: 1 },
  endingBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: COLORS.deepOnyx,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  endingBtnText: { color: COLORS.actionYellow, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  pathFound: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.deepOnyx, borderRadius: 8, padding: 10 },
  pathFoundTitle: { color: COLORS.actionYellow, fontWeight: '900', letterSpacing: 2, fontSize: 11 },
  pathFoundText: { color: COLORS.canvasWhite, fontWeight: '700', fontSize: 13 },
  tip: { fontSize: 13, color: INK, fontStyle: 'italic', textAlign: 'center', opacity: 0.85 },
  shards: { fontSize: 12, fontWeight: '800', color: '#E9DFD2', opacity: 0.9, marginTop: -2 },
  footer: { backgroundColor: COLORS.canvasWhite, borderTopWidth: 2, borderTopColor: INK, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 8, alignItems: 'center' },
  footerRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', maxWidth: 440, width: '100%' },
  nextBtn: { alignSelf: 'stretch', maxWidth: 440, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.actionYellow, borderWidth: 2, borderBottomWidth: 5, borderColor: INK, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10 },
  nextFoe: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nextLabel: { flexShrink: 1, fontWeight: '900', fontSize: 16, letterSpacing: 0.5, color: INK, textTransform: 'uppercase' },
  nextSub: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: INK },
});

export default LevelResults;
