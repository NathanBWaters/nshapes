/**
 * Starfall Spire — Victory (with Enter Endless Starfall!) & Defeat Summary Screen.
 *
 * Reuses `FighterAvatar`, `WeaponAvatar`, `FightReplay`, and shared `ui.tsx`.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import { weaponLevelSuffix } from '@/adventure/data/armory';
import FightReplay from '@/adventure/components/FightReplay';
import { Btn, DARK, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { sfx } from '@/audio';
import { buildSpireWeaponBuilds, spireHeldWeapons } from '../engine/bridge';
import type { SpireLastFightSnapshot, SpireRun } from '../types';

interface Props {
  run: SpireRun;
  victory: boolean;
  lastFight: SpireLastFightSnapshot | null;
  onEnterEndless?: () => void;
  onNewRun: () => void;
  onExitToMenu: () => void;
}

const SpireEndScreen: React.FC<Props> = ({
  run,
  victory,
  lastFight,
  onEnterEndless,
  onNewRun,
  onExitToMenu,
}) => {
  const insets = useSafeAreaInsets();
  const [replayOpen, setReplayOpen] = useState(false);
  const held = spireHeldWeapons(run);
  const builds = buildSpireWeaponBuilds(run);

  return (
    <View style={[st.root, { paddingTop: insets.top }]} testID={victory ? 'spire-victory' : 'spire-defeat'}>
      <ScrollView contentContainerStyle={[st.body, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
        <PopIn style={[st.hero, victory ? st.heroWin : st.heroLose]}>
          <Icon
            name={victory ? 'lorc/crown' : 'lorc/daemon-skull'}
            size={44}
            color={victory ? COLORS.actionYellow : '#FCA5A5'}
          />
          <Eyebrow
            text={victory ? `ASCENSION ${run.ascension} CLEARED!` : run.endless ? `ENDLESS ACT ${run.act} · FLOOR ${run.floor}` : `ACT ${run.act} · FLOOR ${run.floor}`}
            color={victory ? COLORS.actionYellow : '#FECACA'}
          />
          <Text style={st.title}>{victory ? 'SPIRE CONQUERED!' : 'CLIMB ENDED'}</Text>
          <Text style={st.sub}>
            {victory
              ? `${run.fighter} shattered the Starfall Summit! Ascension ${run.ascension + 1} is now unlocked.`
              : `${run.fighter} fell to ${run.defeatedBy ?? 'the Spire'} on Floor ${run.floor}.`}
          </Text>
          <FighterAvatar
            character={run.fighter}
            size={68}
            health={victory ? run.hearts : 0}
            maxHealth={run.maxHearts}
            mood={victory ? 'victory' : 'defeat'}
          />
        </PopIn>

        {/* Run Stats Grid */}
        <View style={st.statsCard}>
          <Text style={st.sec}>RUN SUMMARY · SEED #{run.seed}</Text>
          <View style={st.statGrid}>
            <Metric label="Floors" value={String(run.stats.floorsCleared)} />
            <Metric label="Peak DPM" value={Math.round(run.stats.peakDpm).toLocaleString()} />
            <Metric label="Biggest Hit" value={Math.round(run.stats.biggestHit).toLocaleString()} />
            <Metric label="Total Dmg" value={Math.round(run.stats.totalDamage).toLocaleString()} />
            <Metric label="Parries" value={`${run.stats.parries} (★${run.stats.perfectParries})`} />
            <Metric label="Evolutions" value={String(run.stats.evolutionsForged)} />
          </View>

          <Text style={st.sec}>FINAL ARSENAL ({held.length} WEAPONS · {run.skillNodes.length} SKILLS · {run.arcana.length} ARCANA)</Text>
          <View style={st.gearWrap}>
            {held.map((w, i) => (
              <View key={`${w.id}-${i}`} style={st.gearChip}>
                <WeaponAvatar weapon={w} size={20} />
                <Text style={st.gearText} numberOfLines={1}>
                  {w.name}{weaponLevelSuffix(builds[w.id]?.level ?? 1)}
                </Text>
              </View>
            ))}
          </View>

          {lastFight && (
            <Btn
              small
              variant="secondary"
              label="See Final Fight Replay"
              icon="delapouite/scroll-quill"
              onPress={() => { sfx('click'); setReplayOpen(true); }}
            />
          )}
        </View>

        <View style={st.actions}>
          {victory && onEnterEndless && (
            <Btn
              testID="spire-enter-endless"
              label="Enter Endless Starfall (Act 4+)"
              icon="various-artists/infinity"
              onPress={() => { sfx('confirm'); onEnterEndless(); }}
            />
          )}
          <Btn
            testID="spire-play-again"
            variant={victory ? 'secondary' : 'primary'}
            label={victory ? 'Claim Victory & New Setup' : 'Climb Again'}
            icon="lorc/mountaintop"
            onPress={() => { sfx('confirm'); onNewRun(); }}
          />
          <Btn
            testID="spire-end-menu"
            variant="secondary"
            label="Return to Main Menu"
            onPress={() => { sfx('click'); onExitToMenu(); }}
          />
        </View>
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

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={st.metric}>
    <Text style={st.metricVal}>{value}</Text>
    <Text style={st.metricLabel}>{label}</Text>
  </View>
);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  body: { padding: 14, gap: 12, maxWidth: 500, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: 16, borderWidth: 3, borderBottomWidth: 6, padding: 18, alignItems: 'center', gap: 8 },
  heroWin: { backgroundColor: DARK.panel, borderColor: COLORS.actionYellow },
  heroLose: { backgroundColor: '#2A181B', borderColor: '#DC2626' },
  title: { fontSize: 26, fontWeight: '900', color: DARK.text, letterSpacing: 1, textAlign: 'center' },
  sub: { fontSize: 13, color: DARK.muted, textAlign: 'center', lineHeight: 19 },
  statsCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 14, gap: 10 },
  sec: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '30%', flexGrow: 1, minWidth: 92, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#D6CFC4', paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  metricVal: { fontSize: 15, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 10, fontWeight: '800', color: TONE.spent },
  gearWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 7, paddingVertical: 3, maxWidth: '100%' },
  gearText: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: INK },
  actions: { gap: 8 },
});

export default SpireEndScreen;
