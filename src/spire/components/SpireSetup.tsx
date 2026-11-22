/**
 * Starfall Summit — Run Launch & Ascension Setup screen.
 *
 * Lets the player resume an active climb, pick any of the 6 Fighters (with full
 * Starter Kit & Passives preview), tune Ascension 0..20, inspect Career Stats,
 * or roll a fresh deterministic seed.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import type { CharacterName } from '@/types';
import { FIGHTERS } from '@/adventure/data/fighters';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { randomSeed } from '@/adventure/engine/rng';
import { sfx } from '@/audio';
import { FighterPassivesList } from '@/adventure/components/SharedCards';
import { Btn, Eyebrow, Heart, INK, PopIn, TONE } from '@/adventure/components/ui';
import { ASCENSION_DESCRIPTIONS, MAX_ASCENSION } from '../data/ascensions';
import { STARTER_KITS } from '../data/encounters';
import { MAX_SUMMIT_WEAPONS } from '../engine/runState';
import type { SpireMeta, SpireRun } from '../types';

interface Props {
  activeRun: SpireRun | null;
  meta: SpireMeta;
  onStartNew: (fighter: CharacterName, ascension: number, seed: number) => void;
  onResume: () => void;
  onAbandonActive: () => void;
  onExit: () => void;
}

const SpireSetup: React.FC<Props> = ({ activeRun, meta, onStartNew, onResume, onAbandonActive, onExit }) => {
  const insets = useSafeAreaInsets();
  const [fighter, setFighter] = useState<CharacterName>(activeRun?.fighter ?? 'Orange Tabby');
  const [ascension, setAscension] = useState<number>(Math.min(meta.highestAscensionUnlocked, MAX_ASCENSION));
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  useEffect(() => {
    setConfirmAbandon(false);
  }, [activeRun?.id]);

  useEffect(() => {
    if (!confirmAbandon) return;
    const timer = setTimeout(() => setConfirmAbandon(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmAbandon]);

  const kit = STARTER_KITS[fighter];
  const w1 = getArmoryWeapon(kit.starterWeapon, { [kit.starterWeapon]: { level: 2, tuning: {} } });
  const w2 = getArmoryWeapon(kit.bonusWeapon, { [kit.bonusWeapon]: { level: 2, tuning: {} } });

  const maxSelectableAsc = Math.max(1, meta.highestAscensionUnlocked);

  return (
    <View style={[st.root, { paddingTop: insets.top }]} testID="spire-setup">
      <View style={st.topBar}>
        <TouchableOpacity
          testID="spire-setup-back"
          onPress={() => { sfx('click'); onExit(); }}
          style={st.backBtn}
          accessibilityLabel="Back to main menu"
        >
          <Icon name="ui/back-arrow" size={18} color={INK} noShadow />
        </TouchableOpacity>
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
        {/* Resume Active Climb Banner */}
        {activeRun && activeRun.phase !== 'defeat' && activeRun.phase !== 'victory' && (
          <PopIn style={st.resumeCard}>
            <View style={st.resumeHead}>
              <FighterAvatar character={activeRun.fighter} size={44} health={activeRun.hearts} maxHealth={activeRun.maxHearts} animate={false} framed />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Eyebrow text="CLIMB IN PROGRESS" color={COLORS.actionYellow} />
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

        {/* Fighter Selection */}
        <Text style={st.section}>CHOOSE YOUR CLIMBER</Text>
        <View style={st.fighterGrid}>
          {FIGHTERS.map(f => {
            const sel = f.name === fighter;
            const wins = meta.fighterWins[f.name] ?? 0;
            return (
              <TouchableOpacity
                key={f.name}
                testID={`spire-fighter-${f.name}`}
                onPress={() => { sfx('click'); setFighter(f.name); }}
                style={[st.fighterCard, sel && st.fighterCardSel]}
                activeOpacity={0.85}
                accessibilityState={{ selected: sel }}
              >
                <FighterAvatar character={f.name} size={42} mood={sel ? 'anticipation' : 'idle'} animate={sel} />
                <Text style={[st.fighterName, sel && st.fighterNameSel]} numberOfLines={1}>{f.name}</Text>
                {wins > 0 && <Text style={[st.winBadge, sel && st.winBadgeSel]}>★ {wins}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Fighter Kit */}
        <View style={st.kitCard} testID="spire-starter-kit">
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

        {/* Ascension Selector */}
        <Text style={st.section}>ASCENSION LEVEL</Text>
        <View style={st.ascCard}>
          <View style={st.ascRow}>
            <TouchableOpacity
              testID="spire-asc-down"
              disabled={ascension <= 0}
              onPress={() => { sfx('click'); setAscension(a => Math.max(0, a - 1)); }}
              style={[st.stepBtn, ascension <= 0 && { opacity: 0.35 }]}
            >
              <Text style={st.stepText}>−</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text testID="spire-asc-value" style={st.ascTitle}>
                ASCENSION {ascension}
              </Text>
              <Text style={st.ascUnlockHint}>
                Unlocked up to A{maxSelectableAsc} · Beat Act III to unlock higher tiers
              </Text>
            </View>
            <TouchableOpacity
              testID="spire-asc-up"
              disabled={ascension >= maxSelectableAsc}
              onPress={() => { sfx('click'); setAscension(a => Math.min(maxSelectableAsc, a + 1)); }}
              style={[st.stepBtn, ascension >= maxSelectableAsc && { opacity: 0.35 }]}
            >
              <Text style={st.stepText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={st.ascDesc}>{ASCENSION_DESCRIPTIONS[ascension]}</Text>
        </View>

        {/* Career Stats & Seed */}
        <View style={st.statsStrip}>
          <StatBox label="RUNS" value={String(meta.totalRuns)} />
          <StatBox label="WINS" value={String(meta.victories)} />
          <StatBox label="BEST FL" value={String(meta.bestFloor)} />
          <StatBox label="BEST HIT" value={meta.bestBiggestHit > 0 ? meta.bestBiggestHit.toLocaleString() : '—'} />
        </View>

        <View style={st.seedRow}>
          <Text style={st.seedText}>Run Seed: #{seed}</Text>
          <TouchableOpacity onPress={() => { sfx('click'); setSeed(randomSeed()); }} style={st.rerollSeedBtn}>
            <Icon name="lorc/cycle" size={13} color={INK} />
            <Text style={st.rerollSeedText}>New Seed</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Btn
          testID="spire-start-climb"
          label={activeRun && activeRun.phase !== 'defeat' && activeRun.phase !== 'victory' ? 'Start Fresh Climb' : 'Begin Summit Climb'}
          icon="lorc/mountaintop"
          onPress={() => { sfx('confirm'); onStartNew(fighter, ascension, seed); }}
        />
      </View>
    </View>
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
  resumeCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 12, gap: 10 },
  resumeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resumeTitle: { fontSize: 15, fontWeight: '900', color: INK, marginTop: 2 },
  resumeSub: { fontSize: 12, fontWeight: '700', color: TONE.spent },
  resumeBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmDangerBtn: { flex: 1, backgroundColor: '#B91C1C', borderColor: '#7F1D1D' },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 1.8, color: COLORS.actionYellow, marginTop: 2 },
  fighterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fighterCard: { width: '31%', flexGrow: 1, minWidth: 92, alignItems: 'center', gap: 4, backgroundColor: '#3A2D21', borderRadius: 10, borderWidth: 2, borderColor: '#6B5A49', paddingVertical: 8, paddingHorizontal: 3 },
  fighterCardSel: { backgroundColor: COLORS.canvasWhite, borderColor: COLORS.actionYellow, borderWidth: 3 },
  fighterName: { fontSize: 10.5, fontWeight: '900', color: TONE.onDusk, textAlign: 'center' },
  fighterNameSel: { color: INK },
  winBadge: { fontSize: 10, fontWeight: '900', color: COLORS.actionYellow },
  winBadgeSel: { color: '#92400E' },
  footer: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: '#3A2D21', borderTopWidth: 2, borderTopColor: INK },
  kitCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  kitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kitTitle: { fontSize: 17, fontWeight: '900', color: INK },
  kitStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kitStatText: { fontSize: 13, fontWeight: '900', color: INK, marginRight: 4 },
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
  ascTitle: { fontSize: 16, fontWeight: '900', color: INK, letterSpacing: 1 },
  ascUnlockHint: { fontSize: 10, fontWeight: '700', color: TONE.spent, textAlign: 'center' },
  ascDesc: { fontSize: 12, fontWeight: '700', color: INK, textAlign: 'center', backgroundColor: TONE.coinPale, borderRadius: 6, borderWidth: 1.5, borderColor: '#E5D5A3', padding: 7 },
  statsStrip: { flexDirection: 'row', gap: 6 },
  statBox: { flex: 1, backgroundColor: '#3A2D21', borderRadius: 8, borderWidth: 1.5, borderColor: '#6B5A49', paddingVertical: 8, alignItems: 'center' },
  statVal: { fontSize: 15, fontWeight: '900', color: COLORS.actionYellow, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 9, fontWeight: '800', color: TONE.onDusk, letterSpacing: 0.8 },
  seedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  seedText: { fontSize: 11, fontWeight: '700', color: TONE.onDusk, opacity: 0.85, fontVariant: ['tabular-nums'] },
  rerollSeedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 4 },
  rerollSeedText: { fontSize: 11, fontWeight: '800', color: INK },
});

export default SpireSetup;
