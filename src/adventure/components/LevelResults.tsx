/** End-of-level screen: stars pop in one by one, coins are paid out, unlocks wait for their reveal. */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { band, sfx } from '@/audio';
import type { LevelDef, RunState } from '../types';
import type { ResultApplication } from '../progress';
import { damagePerMinute } from '../history';
import { formatPower, powerMultiplier } from '../data/weaponPower';
import { getBiome } from '../data/biomes';
import { BOUNTIES } from '../data/bounties';
import { mainIndexOf, getLevel } from '../data/levels';
import { shouldShowDamageNumbers, companionResultsLine } from '../coach';
import CompanionBubble from './CompanionBubble';
import { explainStarBreakdown } from '../engine/challenges';
import { Btn, CoinPill, INK, PopIn, starPopDelayMs, StarRow, TONE } from './ui';
import { Silhouette, UnlockableAvatar, describeRewardUnlocks, describeUnlock } from './rewards';
import type { FunRating, FunTag } from '@/analytics/fightEvent';
import RoundFunPrompt from '@/components/RoundFunPrompt';
import FightReplay from './FightReplay';
import PowerExplainer from './PowerExplainer';

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
  onCamp: () => void;
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
}) => {
  const insets = useSafeAreaInsets();
  const [replayOpen, setReplayOpen] = useState(false);
  const [powerInfoOpen, setPowerInfoOpen] = useState(false);
  const biome = getBiome(level.biome);
  /** A practice fight has no result: the player simply left */
  const practice = !!level.rules.sandbox;
  const won = stars > 0 || practice;
  const accuracy = level.starRule?.kind === 'accuracy';
  const title = practice ? 'PRACTICE OVER' : stars >= 3 ? 'PERFECT!' : stars === 2 ? 'VICTORY!' : stars === 1 ? (accuracy ? 'YOU WON!' : 'STAGE CLEAR!') : 'DEFEATED';

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    // Each star rings a step higher up the chord; then the coins count out like a payout
    for (let i = 1; i <= stars; i++) ts.push(setTimeout(() => band.cue('star', { amount: i }), starPopDelayMs(i - 1)));
    if (result.save.coinsUnlocked && run.coins > 0 && !level.rules.sandbox) ts.push(setTimeout(() => band.cue('coinRoll', { amount: Math.min(24, 4 + Math.round(run.coins / 5)) }), starPopDelayMs(stars) + 250));
    return () => ts.forEach(clearTimeout);
  }, [stars]); // eslint-disable-line react-hooks/exhaustive-deps

  const extraTip = practice
    ? null
    : !won
    ? run.mistakes > 3
      ? 'Check one trait at a time: Shape, then Color, then Number!'
      : 'Try spending ★ in our Skill Tree at Camp!'
    : stars === 1 && !accuracy
      ? run.features.has('rainbow')
        ? 'Rainbow Strikes (every trait different) hit twice as hard!'
        : 'Equip charms on the preview screen so every Set hits harder!'
      : null;
  const companionText = [companionResultsLine(level, run, stars, result.save.coinsUnlocked), extraTip].filter(Boolean).join(' ');

  const totalCoins = result.starCoins + result.coinsBanked + result.bountyCoins;
  // The battle's score: damage per minute of fight clock, against the best on this level so far
  const dpm = damagePerMinute(run);
  const newBest = bestDpm !== null && dpm > bestDpm;
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
  const activeBountyHooks = result.save.bountiesUnlocked && !practice
    ? BOUNTIES
        .filter(b => !result.save.completedBounties.includes(b.id) && b.progress(result.save) > 0)
        .sort((a, b) => b.progress(result.save) / b.target - a.progress(result.save) / a.target)
        .slice(0, 2)
    : [];
  const hasHearts = run.hearts !== null && run.maxHearts !== null && run.maxHearts > 0;
  const resultFighterHealth = won
    ? (hasHearts ? Math.max(1, run.hearts!) : 3)
    : 0;
  const resultFighterMaxHealth = hasHearts ? run.maxHearts! : 3;

  return (
    <View style={[st.root, { backgroundColor: biome.colors.sky, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <ScrollView contentContainerStyle={st.scroll}>
        <PopIn style={st.card}>
          <Text style={st.levelId}>{practice ? 'PRACTICE' : level.id} · {level.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <FighterAvatar
              testID="results-fighter-avatar"
              character={run.fighter}
              size={80}
              health={resultFighterHealth}
              maxHealth={resultFighterMaxHealth}
              mood={won ? 'victory' : 'defeat'}
              reaction={won ? { type: stars >= 3 ? 'ecstatic' : 'joy', id: 1 } : null}
              framed
              interactive
            />
            <Text style={{ fontWeight: '900', fontSize: 13, color: INK, opacity: 0.55 }}>VS</Text>
            <EnemyAvatar
              testID="results-enemy-avatar"
              enemy={{ name: run.foeName, icon: run.foeIcon, tier: run.foe.tier }}
              size={64}
              hp={run.foeHp}
              maxHp={run.foeMaxHp}
              mood={practice ? 'idle' : won ? 'cornered' : 'victory'}
              reaction={!won ? { type: 'taunt', id: 1 } : null}
              framed
              interactive
            />
          </View>
          <Text style={[st.title, practice && { fontSize: 28 }, { color: won ? INK : COLORS.impactRed }]}>{title}</Text>
          {!practice && <StarRow stars={stars} size={52} animateFrom={0} />}
          <CompanionBubble
            testID="results-companion-bubble"
            character={run.fighter}
            mood={won ? 'victory' : 'anticipation'}
            tone={stars >= 3 ? 'cheer' : !won ? 'warn' : 'warm'}
            avatarSize={36}
            text={companionText}
            style={{ alignSelf: 'stretch' }}
          />

          {!practice && (
            <View style={st.breakdownBox} testID="results-star-breakdown">
              {explainStarBreakdown(level, run, stars).map(row => (
                <View key={row.star} style={[st.breakdownRow, row.earned ? st.breakdownRowEarned : st.breakdownRowMissed]} testID={`results-star-row-${row.star}`}>
                  <Text style={[st.breakdownStars, row.earned ? st.breakdownStarsOn : st.breakdownStarsOff]}>
                    {'★'.repeat(row.star)}
                  </Text>
                  <Text style={st.breakdownGoal} numberOfLines={2}>{row.goal}</Text>
                  <View style={[st.breakdownBadge, row.earned ? st.breakdownBadgeOk : st.breakdownBadgeMiss]}>
                    <Text style={[st.breakdownBadgeText, row.earned ? st.breakdownBadgeTextOk : st.breakdownBadgeTextMiss]}>
                      {row.earned ? `✓ ${row.reason}` : `✗ ${row.reason}`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {shouldShowDamageNumbers(level, result.save) && (
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
          <View style={st.statsRow}>
            <Stat testID="results-sets" icon="lorc/checked-shield" label="Matches" value={`${run.matches}`} />
            <Stat testID="results-mistakes" icon="lorc/cross-mark" label="Mistakes" value={`${run.mistakes}`} />
            {run.power > 0 && (
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
          </View>

          {powerInfoOpen && run.power > 0 && (
            <PowerExplainer
              points={run.power}
              weapons={run.weapons}
              evolutionsTriggered={run.evolutionsTriggered}
              subtitle={`Finished the fight at ${formatPower(run.power)}`}
              compact
            />
          )}

          {result.save.coinsUnlocked && totalCoins > 0 && (
            <View style={st.bank}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.bankLabel}>Coins earned</Text>
                {result.granted.map(g => (
                  <Text key={g.star} style={st.bankLine}>{'★'.repeat(g.star)} reward  +{g.reward.coins}</Text>
                ))}
                {result.coinsBanked > 0 && <Text style={st.bankLine}>Coin drops  +{result.coinsBanked}</Text>}
                {result.bountyCoins > 0 && <Text style={st.bankLine}>Bounties  +{result.bountyCoins}</Text>}
              </View>
              <CoinPill coins={totalCoins} />
            </View>
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

          {starUnlocks.length > 0 && (
            <View style={{ gap: 6, alignSelf: 'stretch' }}>
              <Text style={st.section}>UNLOCKED</Text>
              {starUnlocks.map(({ star, unlock }, k) => (
                <View key={k} style={st.reward}>
                  <StarRow stars={star} max={star} size={14} />
                  {unlocksRevealed ? (
                    <UnlockableAvatar display={unlock} size={24} fighterMood="victory" iconSize={22} iconColor={COLORS.actionYellow} interactive />
                  ) : (
                    <Silhouette icon={unlock.icon} size={16} />
                  )}
                  <Text style={st.rewardText}>{unlocksRevealed ? unlock.revealed : unlock.secret}</Text>
                </View>
              ))}
            </View>
          )}

          {newPaths.map((path, k) => (
            <View key={k} style={st.pathFound} testID="results-secret-path">
              <Icon name="lorc/treasure-map" size={20} color={COLORS.actionYellow} />
              <View style={{ flex: 1 }}>
                <Text style={st.pathFoundTitle}>SECRET PATH FOUND</Text>
                <Text style={st.pathFoundText}>{unlocksRevealed ? `${path.revealed}. It is on the map now.` : 'Something new is on the map…'}</Text>
              </View>
            </View>
          ))}

          {result.newlyOpenedBiomes.length > 0 && (
            <View style={st.biomeOpen}>
              <Icon name="lorc/padlock" size={18} color={COLORS.canvasWhite} />
              <Text style={st.biomeOpenText}>New region unlocked: {getBiome(result.newlyOpenedBiomes[0] as LevelDef['biome']).name}!</Text>
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

          <View style={st.buttons}>
            {won && nextLevel && nextUnlocked ? (
              <Btn testID="results-next" label={`Next: ${nextLevel.id}`} icon="lorc/crossed-swords" onPress={onNext} />
            ) : null}
            <Btn testID="results-retry" label={practice ? 'Practice again' : stars >= 3 ? 'Play again' : won ? 'Retry for more ★' : 'Try again'} variant={won && nextLevel && nextUnlocked ? 'secondary' : 'primary'} onPress={onRetry} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn testID="results-map" label="Map" variant="secondary" icon="lorc/field" onPress={onMap} style={{ flex: 1 }} />
              <Btn testID="results-camp" label="Camp" variant="secondary" icon="lorc/campfire" onPress={onCamp} style={{ flex: 1 }} />
            </View>
          </View>
        </PopIn>
      </ScrollView>
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
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 440, backgroundColor: COLORS.canvasWhite, borderRadius: 16, borderWidth: 3, borderBottomWidth: 8, borderColor: INK, padding: 20, alignItems: 'center', gap: 12 },
  levelId: { fontWeight: '900', letterSpacing: 1.5, fontSize: 12, color: INK, opacity: 0.7 },
  title: { fontWeight: '900', fontSize: 34, letterSpacing: 2 },
  sub: { textAlign: 'center', color: INK, fontSize: 14 },
  breakdownBox: { alignSelf: 'stretch', gap: 6, backgroundColor: '#FAF7F0', borderRadius: 10, borderWidth: 1.5, borderColor: INK, padding: 10 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6 },
  breakdownRowEarned: { backgroundColor: '#FFFFFF' },
  breakdownRowMissed: { backgroundColor: '#F5F0E6', opacity: 0.92 },
  breakdownStars: { width: 44, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  breakdownStarsOn: { color: '#E0A800' },
  breakdownStarsOff: { color: '#B8B0A4' },
  breakdownGoal: { flex: 1, fontSize: 12, fontWeight: '800', color: INK },
  breakdownBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  breakdownBadgeOk: { backgroundColor: '#D4F4EE' },
  breakdownBadgeMiss: { backgroundColor: '#FFE8E5' },
  breakdownBadgeText: { fontSize: 11, fontWeight: '900' },
  breakdownBadgeTextOk: { color: '#0F766E' },
  breakdownBadgeTextMiss: { color: '#B91C1C' },
  statsRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: INK, paddingVertical: 8 },
  statValue: { fontWeight: '900', fontSize: 20, color: INK, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.7 },
  statNote: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: INK, opacity: 0.75 },
  bank: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: TONE.coinPale, borderRadius: 8, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 12, paddingVertical: 8 },
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
  biomeOpen: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: INK, borderRadius: 8, padding: 10 },
  biomeOpenText: { color: COLORS.canvasWhite, fontWeight: '800' },
  pathFound: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.deepOnyx, borderRadius: 8, padding: 10 },
  pathFoundTitle: { color: COLORS.actionYellow, fontWeight: '900', letterSpacing: 2, fontSize: 11 },
  pathFoundText: { color: COLORS.canvasWhite, fontWeight: '700', fontSize: 13 },
  tip: { fontSize: 13, color: INK, fontStyle: 'italic', textAlign: 'center', opacity: 0.85 },
  buttons: { alignSelf: 'stretch', gap: 8, marginTop: 4 },
});

export default LevelResults;
