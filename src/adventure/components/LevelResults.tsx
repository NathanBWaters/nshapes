/** End-of-level screen: stars pop in one by one, coins bank, rewards unlock. */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { WEAPONS } from '@/utils/gameDefinitions';
import { sfx } from '@/audio';
import type { LevelDef, RunState } from '../types';
import type { ResultApplication } from '../progress';
import { getBiome } from '../data/biomes';
import { Btn, CoinPill, INK, PopIn, StarRow } from './ui';
import { rewardText } from './LevelPreview';

interface Props {
  level: LevelDef;
  run: RunState;
  stars: number;
  result: ResultApplication;
  nextLevel: LevelDef | null;
  nextUnlocked: boolean;
  onRetry: () => void;
  onNext: () => void;
  onMap: () => void;
  onCamp: () => void;
}

const LevelResults: React.FC<Props> = ({ level, run, stars, result, nextLevel, nextUnlocked, onRetry, onNext, onMap, onCamp }) => {
  const insets = useSafeAreaInsets();
  const biome = getBiome(level.biome);
  const won = stars > 0;
  const title = stars >= 3 ? 'PERFECT!' : stars === 2 ? 'VICTORY!' : stars === 1 ? 'SURVIVED' : 'DEFEATED';
  const sub =
    stars >= 3 ? 'Foe defeated and challenge complete.' :
    stars === 2 ? 'Foe knocked out! Come back for the ★★★ challenge.' :
    stars === 1 ? `You made it, but ${run.foeName} is still standing.` :
    'Out of hearts. Your coins are still banked.';

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= stars; i++) ts.push(setTimeout(() => sfx(i === 1 ? 'star1' : i === 2 ? 'star2' : 'star3'), 350 + (i - 1) * 450));
    if (result.granted.some(g => g.reward.character || g.reward.weapons)) ts.push(setTimeout(() => sfx('unlock'), 350 + stars * 450 + 200));
    return () => ts.forEach(clearTimeout);
  }, [stars, result.granted]);

  const tip = !won
    ? run.mistakes > 3
      ? 'Tip: check one trait at a time: shape, then color, then number…'
      : 'Tip: level up your fighter at Camp, or try a fighter marked STRONG here.'
    : stars === 1
      ? 'Tip: Rainbow Strikes (every trait different) hit twice as hard.'
      : null;

  return (
    <View style={[st.root, { backgroundColor: biome.colors.sky, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <ScrollView contentContainerStyle={st.scroll}>
        <PopIn style={st.card}>
          <Text style={st.levelId}>{level.id} · {level.name}</Text>
          <Text style={[st.title, { color: won ? INK : COLORS.impactRed }]}>{title}</Text>
          <StarRow stars={stars} size={52} animateFrom={0} />
          <Text style={st.sub}>{sub}</Text>

          <View style={st.statsRow}>
            <Stat icon="lorc/crossed-swords" label="Damage" value={`${run.totalDamage}`} />
            <Stat icon="lorc/checked-shield" label="Sets" value={`${run.matches}`} />
            <Stat icon="lorc/cross-mark" label="Mistakes" value={`${run.mistakes}`} />
          </View>

          {result.coinsBanked > 0 && (
            <PopIn delay={300} style={st.bank}>
              <Text style={st.bankLabel}>Coins banked</Text>
              <CoinPill coins={result.coinsBanked} />
            </PopIn>
          )}

          {result.granted.length > 0 && (
            <View style={{ gap: 6, alignSelf: 'stretch' }}>
              <Text style={st.section}>NEW REWARDS</Text>
              {result.granted.map((g, i) => (
                <PopIn key={i} delay={400 + i * 250} style={st.reward}>
                  <StarRow stars={g.star} max={g.star} size={14} />
                  <Icon name={g.reward.character ? 'lorc/trophy' : g.reward.weapons?.length ? 'lorc/gems' : 'lorc/crown-coin'} size={20} color={INK} />
                  <Text style={st.rewardText}>{rewardText(g.reward)}</Text>
                </PopIn>
              ))}
              {result.granted.some(g => g.reward.weapons?.length) && (
                <Text style={st.hint}>New weapons join your Armory and can show up in level-ups and shops.</Text>
              )}
            </View>
          )}

          {result.newlyOpenedBiomes.length > 0 && (
            <PopIn delay={900} style={st.biomeOpen}>
              <Icon name="lorc/padlock" size={18} color={COLORS.canvasWhite} />
              <Text style={st.biomeOpenText}>New region unlocked: {getBiome(result.newlyOpenedBiomes[0] as LevelDef['biome']).name}!</Text>
            </PopIn>
          )}

          {tip && <Text style={st.tip}>{tip}</Text>}

          <View style={st.buttons}>
            {won && nextLevel && nextUnlocked ? (
              <Btn testID="results-next" label={`Next: ${nextLevel.id}`} icon="lorc/crossed-swords" onPress={onNext} />
            ) : null}
            <Btn testID="results-retry" label={stars >= 3 ? 'Play again' : won ? 'Retry for more ★' : 'Try again'} variant={won && nextLevel && nextUnlocked ? 'secondary' : 'primary'} onPress={onRetry} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn label="Map" variant="secondary" icon="lorc/field" onPress={onMap} style={{ flex: 1 }} />
              <Btn label="Camp" variant="secondary" icon="lorc/campfire" onPress={onCamp} style={{ flex: 1 }} />
            </View>
          </View>
        </PopIn>
      </ScrollView>
    </View>
  );
};

const Stat: React.FC<{ icon: React.ComponentProps<typeof Icon>['name']; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={st.stat}>
    <Icon name={icon} size={18} color={INK} />
    <Text style={st.statValue}>{value}</Text>
    <Text style={st.statLabel}>{label}</Text>
  </View>
);

export const weaponName = (id: string) => WEAPONS.find(w => w.id === id)?.name ?? id;

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
  bank: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF6C2', borderRadius: 8, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 12, paddingVertical: 8 },
  bankLabel: { fontWeight: '800', color: INK },
  section: { fontWeight: '900', letterSpacing: 2, fontSize: 12, color: INK },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBE0', borderRadius: 8, borderWidth: 1.5, borderColor: INK, padding: 8 },
  rewardText: { flex: 1, fontWeight: '800', color: INK, fontSize: 13 },
  hint: { fontSize: 12, color: INK, opacity: 0.7 },
  biomeOpen: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: INK, borderRadius: 8, padding: 10 },
  biomeOpenText: { color: COLORS.canvasWhite, fontWeight: '800' },
  tip: { fontSize: 13, color: INK, fontStyle: 'italic', textAlign: 'center', opacity: 0.85 },
  buttons: { alignSelf: 'stretch', gap: 8, marginTop: 4 },
});

export default LevelResults;
