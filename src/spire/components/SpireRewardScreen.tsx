/**
 * Starfall Spire — Post-Battle Victory & Reward Draft Screen.
 *
 * Reuses `WeaponExplainer.tsx` (single weapon explainer guardrail!),
 * `FightReplay.tsx`, and shared `WeaponOfferRow` / `SkillNodeRow` / `ArcanaCard`
 * so drafts look and behave identically to Adventure Mode!
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import Icon from '@/components/Icon';
import RoundFunPrompt from '@/components/RoundFunPrompt';
import type { FunRating, FunTag } from '@/analytics/fightEvent';
import { COLORS } from '@/utils/colors';
import type { ArcanaId } from '@/adventure/types';
import { getArmoryWeapon } from '@/adventure/data/armory';
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
import { Btn, CoinPill, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import {
  buildSpireWeaponBuilds,
  clashesWithBelt,
  newEvolutionRecipesArmedBy,
} from '../engine/bridge';
import { REWARD_REROLL_COST, SKIP_WEAPON_COINS } from '../engine/runState';
import type { SpireLastFightSnapshot, SpireRewardBundle, SpireRun } from '../types';

interface Props {
  run: SpireRun;
  reward: SpireRewardBundle;
  lastFight: SpireLastFightSnapshot | null;
  funRating?: FunRating | null;
  funTags?: readonly FunTag[];
  onRateFun?: (rating: FunRating | null, tags: FunTag[]) => void;
  onReplayOpened?: () => void;
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
  onContinue,
}) => {
  const reduced = useReducedMotion();
  const [inspectIdx, setInspectIdx] = useState<number>(0);
  const [replayOpen, setReplayOpen] = useState(false);

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
              onPress={() => { sfx('click'); onReplayOpened?.(); setReplayOpen(true); }}
            />
          )}
        </PopIn>

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
                const heldLv = run.weaponLevels[opt.weaponId];
                const isUpgrade = heldLv !== undefined;
                const w = getArmoryWeapon(opt.weaponId, { [opt.weaponId]: { level: opt.level, tuning: {} } });
                if (!w) return null;
                const newEvos = isUpgrade ? [] : newEvolutionRecipesArmedBy(run, opt.weaponId);
                const clashes = isUpgrade ? [] : clashesWithBelt(run.weapons, opt.weaponId);
                const badges: OfferBadge[] = [];
                if (isUpgrade) {
                  badges.push({ text: `⬆ LV ${heldLv} → ${opt.level}`, bg: '#D97706' });
                }
                if (newEvos.length > 0) {
                  badges.push({
                    text:
                      newEvos.length > 1
                        ? `⚡ ARMS ${newEvos[0].name} +${newEvos.length - 1}`
                        : `⚡ ARMS ${newEvos[0].name}`,
                    bg: TONE.evoReady,
                  });
                }
                if (clashes.length > 0) {
                  badges.push({ text: '⚠ CLASH', bg: '#B91C1C' });
                }
                return (
                  <View key={`${opt.weaponId}-${i}`} style={{ gap: 5 }}>
                    <WeaponOfferRow
                      weapon={w}
                      level={opt.level}
                      badges={badges.length > 0 ? badges : undefined}
                      focused={inspectIdx === i}
                      onPress={() => { sfx('click'); setInspectIdx(i); }}
                      right={
                        <Btn
                          testID={`spire-draft-pick-${i}`}
                          small
                          label={isUpgrade ? 'Upgrade' : 'Draft'}
                          onPress={() => {
                            band.cue(isUpgrade ? 'levelUp' : 'weaponGet');
                            band.fire(w.id, 4);
                            onClaimWeapon(i);
                          }}
                        />
                      }
                    />
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
                          <Text key={c.partnerId} style={st.clashText}>
                            ⚠ Clash with {c.partnerName}: {c.reason}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Shared WeaponExplainer for the tapped option */}
            {inspectedWeapon && inspectedOffer && (
              <WeaponExplainer
                weapon={inspectedWeapon}
                build={{ level: inspectedOffer.level, tuning: {} }}
                hidePowerNote
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
              {reward.skillOptions.map((id, i) => (
                <SkillNodeRow
                  key={id}
                  testID={`spire-skill-pick-${i}`}
                  nodeId={id}
                  onPress={() => { band.cue('levelUp'); onClaimSkill(id); }}
                />
              ))}
            </View>
            <Btn small variant="ghost" label="Skip skill node" onPress={onSkipSkill} />
          </View>
        )}

        {/* 3. Elite / Boss Bonus Arcana Draft */}
        {!reward.arcanaClaimed && reward.arcanaOptions.length > 0 && (
          <View style={st.sectionCard} testID="spire-arcana-draft">
            <Text style={st.sectionTitle}>ARCANA WILDCARD (OPTIONAL)</Text>
            <View style={st.choiceList}>
              {reward.arcanaOptions.map((id, i) => (
                <ArcanaCard
                  key={id}
                  testID={`spire-arcana-pick-${i}`}
                  arcanaId={id}
                  onPress={() => { band.cue('catalyst'); onClaimArcana(id); }}
                />
              ))}
            </View>
            <Btn small variant="ghost" label="Decline Arcana" onPress={onSkipArcana} />
          </View>
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
  root: { flex: 1, backgroundColor: '#2B2118' },
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
  evoCallouts: { gap: 4, paddingLeft: 4 },
  clashBox: { backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1.5, borderColor: '#B91C1C', paddingHorizontal: 9, paddingVertical: 6, gap: 2 },
  clashText: { fontSize: 11.5, fontWeight: '800', color: '#991B1B', lineHeight: 16 },
});

export default SpireRewardScreen;
