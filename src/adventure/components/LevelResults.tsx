/** End-of-level screen: stars pop in one by one, coins are paid out, unlocks wait for their reveal. */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { band } from '@/audio';
import type { LevelDef, RunState } from '../types';
import type { ResultApplication } from '../progress';
import { getBiome } from '../data/biomes';
import { BOUNTIES } from '../data/bounties';
import { Btn, CoinPill, INK, PopIn, starPopDelayMs, StarRow, TONE } from './ui';
import { Silhouette, UnlockableAvatar, describeRewardUnlocks, describeUnlock } from './rewards';
import FightReplay from './FightReplay';

interface Props {
  level: LevelDef;
  run: RunState;
  stars: number;
  result: ResultApplication;
  /** False until the unlock reveal has played, so rewards stay secret */
  unlocksRevealed: boolean;
  nextLevel: LevelDef | null;
  nextUnlocked: boolean;
  onRetry: () => void;
  onNext: () => void;
  onMap: () => void;
  onCamp: () => void;
  onBounties?: () => void;
}

const LevelResults: React.FC<Props> = ({ level, run, stars, result, unlocksRevealed, nextLevel, nextUnlocked, onRetry, onNext, onMap, onCamp, onBounties }) => {
  const insets = useSafeAreaInsets();
  const [replayOpen, setReplayOpen] = useState(false);
  const biome = getBiome(level.biome);
  /** A practice fight has no result: the player simply left */
  const practice = !!level.rules.sandbox;
  const won = stars > 0 || practice;
  const accuracy = level.starRule?.kind === 'accuracy';
  const title = practice ? 'PRACTICE OVER' : stars >= 3 ? 'PERFECT!' : stars === 2 ? 'VICTORY!' : stars === 1 ? (accuracy ? 'YOU WON!' : 'SURVIVED') : 'DEFEATED';
  const sub = practice
    ? 'Nothing banked, nothing lost. The dummy is ready whenever you are.'
    : accuracy
    ? stars >= 3
      ? 'Not a single mistake.'
      : `You beat ${run.foeName} with ${run.mistakes} mistake${run.mistakes === 1 ? '' : 's'}. Fewer mistakes earn more stars.`
    : stars >= 3
      ? 'Foe defeated and challenge complete.'
      : stars === 2
        ? 'Foe knocked out! Come back for the ★★★ challenge.'
        : stars === 1
          ? `You made it, but ${run.foeName} is still standing.`
          : run.coins > 0
            ? 'Out of hearts. You keep the coins you picked up.'
            : 'Out of hearts. Have another go.';

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    // Each star rings a step higher up the chord; then the coins count out like a payout
    for (let i = 1; i <= stars; i++) ts.push(setTimeout(() => band.cue('star', { amount: i }), starPopDelayMs(i - 1)));
    if (run.coins > 0 && !level.rules.sandbox) ts.push(setTimeout(() => band.cue('coinRoll', { amount: Math.min(24, 4 + Math.round(run.coins / 5)) }), starPopDelayMs(stars) + 250));
    return () => ts.forEach(clearTimeout);
  }, [stars]); // eslint-disable-line react-hooks/exhaustive-deps

  const tip = practice
    ? null
    : !won
    ? run.mistakes > 3
      ? 'Tip: check one trait at a time: shape, then color, then number…'
      : 'Tip: spend stars in a skill tree at Camp, or try a fighter marked STRONG here.'
    : stars === 1 && !accuracy
      ? 'Tip: Rainbow Strikes (every trait different) hit twice as hard.'
      : null;

  const totalCoins = result.starCoins + result.coinsBanked + result.bountyCoins;
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
          <Text style={st.sub}>{sub}</Text>

          <View style={st.statsRow}>
            <Stat testID="results-total-damage" icon="lorc/crossed-swords" label="Total damage" value={`${run.totalDamage}`} />
            <Stat testID="results-biggest-hit" icon="lorc/bright-explosion" label="Biggest hit" value={`${run.biggestHit}`} hot={run.biggestHit >= 25} />
            {practice && run.matches > 0 && (
              <Stat testID="results-per-set" icon="lorc/target-dummy" label="Per Set" value={`${Math.round(run.totalDamage / run.matches)}`} />
            )}
          </View>
          <View style={st.statsRow}>
            <Stat icon="lorc/checked-shield" label="Sets" value={`${run.matches}`} />
            <Stat icon="lorc/cross-mark" label="Mistakes" value={`${run.mistakes}`} />
            {(run.evolutionsTriggered > 0 || run.armedRecipes.length > 0) && (
              <Stat testID="results-evolutions" icon="lorc/crystal-shine" label="Evolutions" value={`${run.evolutionsTriggered}`} />
            )}
          </View>

          {totalCoins > 0 && (
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

          {tip && <Text style={st.tip}>{tip}</Text>}

          {run.log.length > 1 && (
            <Btn testID="results-replay" label="What happened? See the fight" variant="secondary" icon="lorc/magnifying-glass" small onPress={() => setReplayOpen(true)} style={{ alignSelf: 'stretch' }} />
          )}

          <View style={st.buttons}>
            {won && nextLevel && nextUnlocked ? (
              <Btn testID="results-next" label={`Next: ${nextLevel.id}`} icon="lorc/crossed-swords" onPress={onNext} />
            ) : null}
            <Btn testID="results-retry" label={practice ? 'Practice again' : stars >= 3 ? 'Play again' : won ? 'Retry for more ★' : 'Try again'} variant={won && nextLevel && nextUnlocked ? 'secondary' : 'primary'} onPress={onRetry} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn testID="results-map" label="Map" variant="secondary" icon="lorc/field" onPress={onMap} style={{ flex: 1 }} />
              {result.save.bountiesUnlocked && onBounties && (
                <Btn testID="results-bounties" label="Bounties" variant="secondary" icon="lorc/trophy" onPress={onBounties} style={{ flex: 1 }} />
              )}
              <Btn testID="results-camp" label="Camp" variant="secondary" icon="lorc/campfire" onPress={onCamp} style={{ flex: 1 }} />
            </View>
          </View>
        </PopIn>
      </ScrollView>
      {replayOpen && <FightReplay run={run} visible onClose={() => setReplayOpen(false)} />}
    </View>
  );
};

const Stat: React.FC<{ icon: React.ComponentProps<typeof Icon>['name']; label: string; value: string; testID?: string; hot?: boolean }> = ({ icon, label, value, testID, hot }) => (
  <View style={[st.stat, hot && { backgroundColor: COLORS.actionYellow }]} testID={testID}>
    <Icon name={icon} size={18} color={INK} />
    <Text style={st.statValue}>{value}</Text>
    <Text style={st.statLabel}>{label}</Text>
  </View>
);

const st = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 440, backgroundColor: COLORS.canvasWhite, borderRadius: 16, borderWidth: 3, borderBottomWidth: 8, borderColor: INK, padding: 20, alignItems: 'center', gap: 12 },
  levelId: { fontWeight: '900', letterSpacing: 1.5, fontSize: 12, color: INK, opacity: 0.7 },
  title: { fontWeight: '900', fontSize: 34, letterSpacing: 2 },
  sub: { textAlign: 'center', color: INK, fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: INK, paddingVertical: 8 },
  statValue: { fontWeight: '900', fontSize: 20, color: INK, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.7 },
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
