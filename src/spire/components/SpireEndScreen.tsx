/**
 * Starfall Summit — Victory (with Enter Endless Starfall!) & Defeat Summary Screen.
 *
 * Reuses `FighterAvatar`, `WeaponAvatar`, `FightReplay`, and shared `ui.tsx`.
 */
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import Icon from '@/components/Icon';
import RoundFunPrompt from '@/components/RoundFunPrompt';
import type { FunRating, FunTag } from '@/analytics/fightEvent';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { buildDamageStory, buildSpireRunDamageStory } from '@/adventure/engine/damageStory';
import BattleDamageStory from '@/adventure/components/BattleDamageStory';
import FightReplay from '@/adventure/components/FightReplay';
import { WeaponChip } from '@/adventure/components/SharedCards';
import { Btn, DARK, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { sfx } from '@/audio';
import { buildSpireWeaponBuilds, spireHeldWeapons } from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS } from '../engine/runState';
import { computeSpireRating, formatSpireShareCard } from '../engine/share';
import type { SpireLastFightSnapshot, SpireRun } from '../types';

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

interface Props {
  run: SpireRun;
  victory: boolean;
  lastFight: SpireLastFightSnapshot | null;
  funRating?: FunRating | null;
  funTags?: readonly FunTag[];
  onRateFun?: (rating: FunRating | null, tags: FunTag[]) => void;
  onReplayOpened?: () => void;
  onEnterEndless?: () => void;
  onNewRun: () => void;
  onExitToMenu: () => void;
}

const SpireEndScreen: React.FC<Props> = ({
  run,
  victory,
  lastFight,
  funRating = null,
  funTags = [],
  onRateFun,
  onReplayOpened,
  onEnterEndless,
  onNewRun,
  onExitToMenu,
}) => {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [replayOpen, setReplayOpen] = useState(false);
  const [storyScope, setStoryScope] = useState<'climb' | 'final'>('climb');
  const [copiedShare, setCopiedShare] = useState(false);
  const held = spireHeldWeapons(run);
  const builds = useMemo(() => buildSpireWeaponBuilds(run), [run]);
  const rating = useMemo(() => computeSpireRating(run, victory), [run, victory]);
  const shareCard = useMemo(() => formatSpireShareCard(run, victory), [run, victory]);
  const handleCopyShare = async () => {
    await copyToClipboard(shareCard);
    sfx('click');
    setCopiedShare(true);
  };
  const climbStory = useMemo(
    () => buildSpireRunDamageStory(run.stats.sourceDamage, run.stats.floorLedger),
    [run.stats.sourceDamage, run.stats.floorLedger]
  );
  const finalFightStory = useMemo(() => (lastFight ? buildDamageStory(lastFight.run) : null), [lastFight]);
  const activeStory =
    storyScope === 'final' && finalFightStory && finalFightStory.totalDamage > 0
      ? finalFightStory
      : climbStory ?? finalFightStory;
  const canToggleScope = !!(climbStory && finalFightStory && finalFightStory.totalDamage > 0 && (run.stats.floorLedger?.length ?? 0) > 1);

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
          <Text style={st.title}>{victory ? 'SUMMIT CONQUERED!' : 'CLIMB ENDED'}</Text>
          <Text style={st.sub}>
            {victory
              ? `${run.fighter} shattered the Starfall Summit! Ascension ${run.ascension + 1} is now unlocked.`
              : `${run.fighter} fell to ${run.defeatedBy ?? 'the Summit'} on Floor ${run.floor}.`}
          </Text>
          <FighterAvatar
            character={run.fighter}
            size={68}
            health={victory ? run.hearts : 0}
            maxHealth={run.maxHearts}
            mood={victory ? 'victory' : 'defeat'}
          />
        </PopIn>

        {/* Summit Rating & GSP-Style Percentile Framing (`[TP-19]`) */}
        <View style={st.ratingCard} testID="spire-end-rating">
          <View style={st.ratingTop}>
            <View style={[st.tierPill, { backgroundColor: rating.tierColor }]}>
              <Text style={st.tierPillText}>{rating.tierName.toUpperCase()} TIER</Text>
            </View>
            {run.isDaily && run.dailyDate && (
              <Text style={st.dailyTag}>DAILY · {run.dailyDate}</Text>
            )}
          </View>
          <Text style={st.ratingValue}>
            Summit Rating {rating.rating.toLocaleString('en-US')}
          </Text>
          <Text style={st.ratingPercentile}>
            Outscored ~{rating.percentile}% of climbers
          </Text>
          <View style={st.ratingTrack}>
            <View style={[st.ratingFill, { width: `${rating.percentile}%` }]} />
          </View>
          <View style={st.breakdownRow}>
            <Text style={st.breakdownChip}>Floors +{rating.floorPoints}</Text>
            <Text style={st.breakdownChip}>DPM +{rating.dpmPoints}</Text>
            <Text style={st.breakdownChip}>Parries +{rating.parryPoints}</Text>
            {rating.evolutionPoints > 0 && (
              <Text style={st.breakdownChip}>Evos +{rating.evolutionPoints}</Text>
            )}
            {rating.ascensionMultiplier > 1 && (
              <Text style={st.breakdownChip}>×{rating.ascensionMultiplier} Asc</Text>
            )}
          </View>
        </View>

        {/* Cumulative Damage Story (Full Climb + optional Final Fight toggle) */}
        {activeStory && activeStory.totalDamage > 0 && (
          <BattleDamageStory
            story={activeStory}
            title={activeStory === climbStory ? 'FULL CLIMB DAMAGE' : 'FINAL FIGHT DAMAGE'}
            weaponBuilds={activeStory === finalFightStory && lastFight ? lastFight.builds : builds}
            startDelayMs={280}
            reduced={reduced}
            hidePowerNote
            testID="spire-end-damage-story"
            headerRight={
              canToggleScope ? (
                <View style={st.scopeToggle}>
                  <TouchableOpacity
                    testID="spire-story-scope-climb"
                    onPress={() => { sfx('click'); setStoryScope('climb'); }}
                    style={[st.scopeBtn, storyScope === 'climb' && st.scopeBtnActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.scopeBtnText, storyScope === 'climb' && st.scopeBtnTextActive]}>Climb</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="spire-story-scope-final"
                    onPress={() => { sfx('click'); setStoryScope('final'); }}
                    style={[st.scopeBtn, storyScope === 'final' && st.scopeBtnActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.scopeBtnText, storyScope === 'final' && st.scopeBtnTextActive]}>Last</Text>
                  </TouchableOpacity>
                </View>
              ) : undefined
            }
          />
        )}

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

          <Text style={st.sec}>FINAL ARSENAL ({held.length}/{MAX_SUMMIT_WEAPONS} WEAPONS · {run.skillNodes.length} SKILLS · {run.arcana.length} ARCANA)</Text>
          <View style={st.gearWrap}>
            {held.map((w, i) => (
              <WeaponChip key={`${w.id}-${i}`} weapon={w} level={builds[w.id]?.level ?? 1} />
            ))}
          </View>

          {lastFight && (
            <Btn
              small
              variant="secondary"
              label="See Final Fight Replay"
              icon="delapouite/scroll-quill"
              onPress={() => { sfx('click'); onReplayOpened?.(); setReplayOpen(true); }}
            />
          )}
        </View>

        {/* Spoiler-Free Share Card + Seed URL (`[TP-19]`) */}
        <View style={st.statsCard} testID="spire-end-share-card">
          <Text style={st.sec}>SPOILER-FREE SHARE CARD</Text>
          <Text style={st.sharePreview}>{shareCard}</Text>
          <Btn
            testID="spire-end-copy-share"
            small
            variant={copiedShare ? 'secondary' : 'primary'}
            label={copiedShare ? 'Copied Share Card ✓' : 'Copy Share Card & Seed Link'}
            icon="lorc/scroll-unfurled"
            onPress={handleCopyShare}
          />
        </View>

        {onRateFun && (
          <RoundFunPrompt
            rating={funRating}
            tags={funTags}
            onChange={onRateFun}
            compact
            title={victory ? 'Was that climb fun?' : 'Was that fight fun?'}
            testIDPrefix="spire-end-fun"
          />
        )}

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
  ratingCard: { backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 14, gap: 6, alignItems: 'center' },
  ratingTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tierPillText: { fontSize: 10, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 1 },
  dailyTag: { fontSize: 10, fontWeight: '900', color: COLORS.actionYellow, letterSpacing: 0.8 },
  ratingValue: { fontSize: 22, fontWeight: '900', color: COLORS.canvasWhite, fontVariant: ['tabular-nums'] },
  ratingPercentile: { fontSize: 13, fontWeight: '800', color: '#99F6E4' },
  ratingTrack: { width: '100%', height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden', marginTop: 2 },
  ratingFill: { height: '100%', backgroundColor: COLORS.actionYellow, borderRadius: 999 },
  breakdownRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: 3 },
  breakdownChip: { fontSize: 10, fontWeight: '800', color: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, fontVariant: ['tabular-nums'] },
  sharePreview: { backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#D6CFC4', padding: 10, fontSize: 11, lineHeight: 16, color: INK, fontFamily: MONO_FONT },
  title: { fontSize: 26, fontWeight: '900', color: DARK.text, letterSpacing: 1, textAlign: 'center' },
  sub: { fontSize: 13, color: DARK.muted, textAlign: 'center', lineHeight: 19 },
  statsCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 14, gap: 10 },
  sec: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '30%', flexGrow: 1, minWidth: 92, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#D6CFC4', paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  metricVal: { fontSize: 15, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 10, fontWeight: '800', color: TONE.spent },
  gearWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scopeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.paperBeige,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: INK,
    padding: 1.5,
    gap: 2,
  },
  scopeBtn: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  scopeBtnActive: {
    backgroundColor: INK,
  },
  scopeBtnText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: INK,
  },
  scopeBtnTextActive: {
    color: COLORS.actionYellow,
  },
  actions: { gap: 8 },
});

export default SpireEndScreen;
