/**
 * Starfall Spire — Post-Battle Victory & Reward Draft Screen.
 *
 * Reuses `WeaponExplainer.tsx` (single weapon explainer guardrail!) and
 * `FightReplay.tsx` so players can inspect both drafted weapons and the fight
 * log right after every floor!
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import type { ArcanaId } from '@/adventure/types';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getArcana } from '@/adventure/data/arcana';
import { getSkillNode } from '@/adventure/data/skillTrees';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import FightReplay from '@/adventure/components/FightReplay';
import { Btn, CoinPill, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import { newEvolutionsArmedBy } from '../engine/bridge';
import { REWARD_REROLL_COST, SKIP_WEAPON_COINS } from '../engine/runState';
import type { SpireLastFightSnapshot, SpireRewardBundle, SpireRun } from '../types';

interface Props {
  run: SpireRun;
  reward: SpireRewardBundle;
  lastFight: SpireLastFightSnapshot | null;
  onClaimWeapon: (index: number) => void;
  onRerollWeapons: () => void;
  onSkipWeapon: () => void;
  onClaimArcana: (id: ArcanaId) => void;
  onSkipArcana: () => void;
  onClaimSkill: (nodeId: string) => void;
  onSkipSkill: () => void;
  onContinue: () => void;
}

const SpireRewardScreen: React.FC<Props> = ({
  run,
  reward,
  lastFight,
  onClaimWeapon,
  onRerollWeapons,
  onSkipWeapon,
  onClaimArcana,
  onSkipArcana,
  onClaimSkill,
  onSkipSkill,
  onContinue,
}) => {
  const [inspectIdx, setInspectIdx] = useState<number>(0);
  const [replayOpen, setReplayOpen] = useState(false);

  const inspectedOffer = reward.weaponOptions[inspectIdx] ?? reward.weaponOptions[0] ?? null;
  const inspectedWeapon = inspectedOffer
    ? getArmoryWeapon(inspectedOffer.weaponId, { [inspectedOffer.weaponId]: { level: inspectedOffer.level, tuning: {} } })
    : undefined;

  const allDone = reward.weaponClaimed && reward.arcanaClaimed && reward.skillClaimed;

  return (
    <View style={st.root} testID="spire-reward-screen">
      <ScrollView contentContainerStyle={st.body}>
        <PopIn style={st.bannerCard}>
          <Eyebrow
            text={reward.isActBoss ? `ACT ${run.act} BOSS DEFEATED!` : reward.nodeKind === 'elite' ? 'ELITE VANQUISHED!' : 'FLOOR CLEARED!'}
            color={COLORS.actionYellow}
          />
          <Text style={st.title}>{reward.foeName} Knocked Out!</Text>
          <View style={st.statsRow}>
            <CoinPill coins={reward.coinsEarned} />
            <View style={st.statPill}>
              <Text style={st.statText}>DPM {Math.round(reward.dpm).toLocaleString()}</Text>
            </View>
            <View style={st.statPill}>
              <Text style={st.statText}>Best {Math.round(reward.biggestHit).toLocaleString()}</Text>
            </View>
            {reward.parries > 0 && (
              <View style={[st.statPill, { backgroundColor: '#CCFBF1', borderColor: TONE.upside }]}>
                <Text style={[st.statText, { color: TONE.upside }]}>
                  Parries {reward.parries}{reward.perfectParries > 0 ? ` (★${reward.perfectParries})` : ''}
                </Text>
              </View>
            )}
          </View>
          {lastFight && (
            <Btn
              small
              variant="secondary"
              label="What happened? See the fight"
              icon="delapouite/scroll-quill"
              onPress={() => { sfx('click'); setReplayOpen(true); }}
            />
          )}
        </PopIn>

        {/* 1. Weapon Draft */}
        {!reward.weaponClaimed && reward.weaponOptions.length > 0 && (
          <View style={st.sectionCard} testID="spire-weapon-draft">
            <View style={st.sectionHead}>
              <Text style={st.sectionTitle}>DRAFT A WEAPON (PICK 1 OF {reward.weaponOptions.length})</Text>
              {!reward.weaponRerolled && (
                <TouchableOpacity
                  testID="spire-draft-reroll"
                  disabled={run.coins < REWARD_REROLL_COST}
                  onPress={() => { band.cue('reelSpin'); onRerollWeapons(); }}
                  style={[st.miniBtn, run.coins < REWARD_REROLL_COST && { opacity: 0.4 }]}
                >
                  <Icon name="lorc/cycle" size={12} color={INK} />
                  <Text style={st.miniBtnText}>Reroll {REWARD_REROLL_COST}¢</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={st.choiceList}>
              {reward.weaponOptions.map((opt, i) => {
                const w = getArmoryWeapon(opt.weaponId, { [opt.weaponId]: { level: opt.level, tuning: {} } });
                if (!w) return null;
                const newEvos = newEvolutionsArmedBy(run, opt.weaponId);
                const firstEvo = newEvos[0] ? EVOLUTION_RECIPES.find(r => r.id === newEvos[0]) : null;
                const focused = inspectIdx === i;
                return (
                  <View key={`${opt.weaponId}-${i}`} style={[st.draftRow, focused && st.draftRowFocused]}>
                    <TouchableOpacity
                      onPress={() => { sfx('click'); setInspectIdx(i); }}
                      style={st.draftInfo}
                      activeOpacity={0.8}
                    >
                      <View style={st.iconBox}><WeaponAvatar weapon={w} size={32} /></View>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <View style={st.nameRow}>
                          <Text style={st.itemName} numberOfLines={1}>
                            {w.name}{opt.level > 1 ? ` Lv ${opt.level}` : ''}
                          </Text>
                          {newEvos.length > 0 && (
                            <View style={st.evoBadge}>
                              <Text style={st.evoBadgeText}>
                                ⚡ ARMS {newEvos.length > 1 ? `${newEvos.length} EVOS` : firstEvo?.name ?? 'EVO'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={st.itemDesc} numberOfLines={2}>{w.shortDescription}</Text>
                      </View>
                    </TouchableOpacity>
                    <Btn
                      testID={`spire-draft-pick-${i}`}
                      small
                      label="Draft"
                      onPress={() => {
                        band.cue('weaponGet');
                        band.fire(w.id, 4);
                        onClaimWeapon(i);
                      }}
                    />
                  </View>
                );
              })}
            </View>

            {/* Shared WeaponExplainer for the tapped option */}
            {inspectedWeapon && inspectedOffer && (
              <WeaponExplainer
                weapon={inspectedWeapon}
                build={{ level: inspectedOffer.level, tuning: {} }}
              />
            )}

            <Btn
              testID="spire-draft-skip"
              small
              variant="ghost"
              label={`Skip weapon draft (+${SKIP_WEAPON_COINS}¢)`}
              onPress={() => { sfx('click'); onSkipWeapon(); }}
            />
          </View>
        )}

        {/* 2. Elite / Boss Bonus Skill Tree Node Draft */}
        {!reward.skillClaimed && reward.skillOptions.length > 0 && (
          <View style={st.sectionCard} testID="spire-skill-draft">
            <Text style={st.sectionTitle}>FIGHTER SKILL NODE (PICK 1 OF {reward.skillOptions.length})</Text>
            <View style={st.choiceList}>
              {reward.skillOptions.map((id, i) => {
                const node = getSkillNode(id);
                if (!node) return null;
                return (
                  <TouchableOpacity
                    key={id}
                    testID={`spire-skill-pick-${i}`}
                    onPress={() => { band.cue('levelUp'); onClaimSkill(id); }}
                    style={st.skillCard}
                    activeOpacity={0.85}
                  >
                    <View style={[st.iconBox, { backgroundColor: '#CCFBF1' }]}>
                      <Icon name={node.icon} size={22} color={TONE.upside} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.itemName}>{node.name}</Text>
                      <Text style={st.itemDesc}>{node.text}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Btn small variant="ghost" label="Skip skill node" onPress={onSkipSkill} />
          </View>
        )}

        {/* 3. Elite / Boss Bonus Arcana Draft */}
        {!reward.arcanaClaimed && reward.arcanaOptions.length > 0 && (
          <View style={st.sectionCard} testID="spire-arcana-draft">
            <Text style={st.sectionTitle}>ARCANA WILDCARD (OPTIONAL)</Text>
            <View style={st.choiceList}>
              {reward.arcanaOptions.map((id, i) => {
                const a = getArcana(id);
                return (
                  <TouchableOpacity
                    key={id}
                    testID={`spire-arcana-pick-${i}`}
                    onPress={() => { band.cue('catalyst'); onClaimArcana(id); }}
                    style={st.arcanaCard}
                    activeOpacity={0.85}
                  >
                    <View style={[st.iconBox, { backgroundColor: TONE.arcanaPale, borderColor: TONE.arcana }]}>
                      <Icon name={a.icon} size={22} color={TONE.arcana} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[st.itemName, { color: TONE.arcana }]}>{a.numeral} · {a.name}</Text>
                      <Text style={[st.itemDesc, { color: TONE.upside, fontWeight: '700' }]}>▲ {a.upside}</Text>
                      <Text style={[st.itemDesc, { color: TONE.tradeoff }]}>▼ {a.tradeoff}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Btn small variant="ghost" label="Decline Arcana" onPress={onSkipArcana} />
          </View>
        )}

        <Btn
          testID="spire-reward-continue"
          label={
            reward.isActBoss
              ? run.act === 3 && !run.endless
                ? 'Claim Spire Victory!'
                : `Ascend to Act ${run.act + 1} (+1 Max ♥)`
              : allDone
                ? 'Continue Climb'
                : 'Proceed to Map'
          }
          icon={reward.isActBoss ? 'lorc/crown' : 'lorc/mountaintop'}
          onPress={() => { sfx('confirm'); onContinue(); }}
        />
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

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1E1B2E' },
  body: { padding: 14, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  bannerCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 14, gap: 8 },
  title: { fontSize: 22, fontWeight: '900', color: INK },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  statPill: { backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 4 },
  statText: { fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  sectionCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  miniBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 3 },
  miniBtnText: { fontSize: 11, fontWeight: '800', color: INK },
  choiceList: { gap: 8 },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 2, borderColor: '#D6CFC4', backgroundColor: COLORS.paperBeige, padding: 8 },
  draftRowFocused: { borderColor: INK, backgroundColor: TONE.selected },
  draftInfo: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 42, height: 42, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  itemName: { flexShrink: 1, fontSize: 14, fontWeight: '900', color: INK },
  itemDesc: { fontSize: 12, color: INK, opacity: 0.85, lineHeight: 16 },
  evoBadge: { backgroundColor: TONE.arcana, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  evoBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 0.4 },
  skillCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: TONE.upside, backgroundColor: '#F0FDFA', padding: 10 },
  arcanaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: TONE.arcana, backgroundColor: TONE.arcanaPale, padding: 10 },
});

export default SpireRewardScreen;
