/**
 * Starfall Summit — Mystery Narrative Event Screen.
 *
 * Reuses shared `WeaponOfferRow` and `SkillNodeRow` for inline rewards.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { getArcana } from '@/adventure/data/arcana';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { ArcanaCard, SkillNodeRow, WeaponOfferRow, type OfferBadge } from '@/adventure/components/SharedCards';
import { Btn, DARK, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import { getSpireEvent } from '../data/events';
import { clashesWithBelt, newEvolutionRecipesArmedBy, spireHeldWeapons } from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS, SKIP_WEAPON_COINS } from '../engine/runState';
import type { SpireEventState, SpireRun } from '../types';
import SpireSwapPicker from './SpireSwapPicker';

interface Props {
  run: SpireRun;
  eventState: SpireEventState;
  onChoose: (optionId: string) => void;
  onPickWeapon: (index: number, replaceWeaponId?: string) => void;
  onSkipWeapon?: () => void;
  onPickSkill: (nodeId: string) => void;
  onPickForge: (weaponId: string) => void;
  onResolveArcana?: (accept: boolean) => void;
  onLeave: () => void;
}

const SpireEvent: React.FC<Props> = ({
  run,
  eventState,
  onChoose,
  onPickWeapon,
  onSkipWeapon,
  onPickSkill,
  onPickForge,
  onResolveArcana,
  onLeave,
}) => {
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const def = getSpireEvent(eventState.eventId);
  const held = spireHeldWeapons(run);
  const beltFull = run.weapons.length >= MAX_SUMMIT_WEAPONS;
  const forgeable = held.filter(w => (run.weaponLevels[w.id] ?? 1) < MAX_WEAPON_LEVEL);
  const availSkills = (eventState.pendingSkillOptions ?? []).filter(id => !run.skillNodes.includes(id));
  const pendingArcana =
    eventState.pendingArcanaOffer && !run.arcana.includes(eventState.pendingArcanaOffer)
      ? eventState.pendingArcanaOffer
      : undefined;
  const previewArcana =
    eventState.offeredArcana && !run.arcana.includes(eventState.offeredArcana)
      ? eventState.offeredArcana
      : undefined;

  const hasPendingSubPick =
    (eventState.pendingWeaponOptions?.length ?? 0) > 0 ||
    availSkills.length > 0 ||
    Boolean(pendingArcana) ||
    !!eventState.pendingForge;

  return (
    <View style={st.root} testID="spire-event">
      <ScrollView contentContainerStyle={st.body}>
        <PopIn style={st.storyCard}>
          <View style={st.storyHead}>
            <View style={[st.iconBadge, { backgroundColor: def.accent }]}>
              <Icon name={def.icon} size={28} color={COLORS.canvasWhite} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Eyebrow text="MYSTERY ENCOUNTER" color={COLORS.actionYellow} />
              <Text style={st.title}>{def.title}</Text>
            </View>
          </View>
          <Text style={st.storyText}>{def.story}</Text>
        </PopIn>

        {!eventState.resolved ? (
          <View style={st.optList}>
            {def.options.map((opt, idx) => {
              const lockedCoins = opt.minCoins !== undefined && run.coins < opt.minCoins;
              const lockedHearts = opt.minHearts !== undefined && run.hearts < opt.minHearts;
              const lockedWeapon = !!opt.needsWeapon && forgeable.length === 0;
              const disabled = lockedCoins || lockedHearts || lockedWeapon;
              const lockNote = lockedCoins
                ? `Needs ${opt.minCoins}¢`
                : lockedHearts
                  ? `Needs ${opt.minHearts}+ ♥`
                  : lockedWeapon
                    ? 'No upgradeable weapon'
                    : null;

              return (
                <TouchableOpacity
                  key={opt.id}
                  testID={`spire-event-opt-${idx}`}
                  disabled={disabled}
                  onPress={() => {
                    band.cue(opt.tone === 'bold' ? 'catalyst' : 'tap');
                    onChoose(opt.id);
                  }}
                  style={[
                    st.optCard,
                    opt.tone === 'bold' && st.optBold,
                    opt.tone === 'safe' && st.optSafe,
                    disabled && { opacity: 0.45 },
                  ]}
                  activeOpacity={0.85}
                >
                  <View style={st.optHead}>
                    <Text style={st.optLabel}>{opt.label}</Text>
                    {lockNote && <Text style={st.lockTag}>{lockNote}</Text>}
                  </View>
                  <Text style={st.optDetail}>{opt.detail}</Text>
                  {opt.id === 'arcana' && previewArcana && (
                    <View style={{ marginTop: 6 }}>
                      <ArcanaCard
                        arcanaId={previewArcana}
                        badgeText="PREVIEW"
                        testID="spire-event-arcana-preview"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <PopIn style={st.outcomeCard}>
            <Text style={st.outcomeTitle}>{eventState.outcomeTitle ?? 'Outcome'}</Text>
            <Text style={st.outcomeText}>{eventState.outcomeText}</Text>

            {/* Inline Weapon Pick */}
            {eventState.pendingWeaponOptions && eventState.pendingWeaponOptions.length > 0 && (
              <View style={{ gap: 8 }}>
                {eventState.pendingWeaponOptions.map((o, i) => {
                  const w = getArmoryWeapon(o.weaponId, { [o.weaponId]: { level: o.level, tuning: {} } });
                  if (!w) return null;
                  const heldLv = run.weaponLevels[o.weaponId];
                  const isUpgrade = heldLv !== undefined;
                  const needsSwap = beltFull && !isUpgrade;
                  const newEvos = isUpgrade ? [] : newEvolutionRecipesArmedBy(run, o.weaponId);
                  const clashes = isUpgrade ? [] : clashesWithBelt(run.weapons, o.weaponId);
                  const badges: OfferBadge[] = [];
                  if (isUpgrade) badges.push({ text: `⬆ LV ${heldLv} → ${o.level}`, bg: '#D97706' });
                  if (newEvos.length > 0) {
                    badges.push({
                      text: newEvos.length > 1 ? `⚡ ${newEvos[0].name} +${newEvos.length - 1}` : `⚡ ${newEvos[0].name}`,
                      bg: TONE.evoReady,
                    });
                  }
                  if (clashes.length > 0) badges.push({ text: '⚠ CLASH', bg: '#B91C1C' });
                  const handlePick = () => {
                    if (needsSwap) {
                      sfx('click');
                      setSwapIdx(prev => (prev === i ? null : i));
                      return;
                    }
                    band.cue(isUpgrade ? 'levelUp' : 'weaponGet');
                    setSwapIdx(null);
                    onPickWeapon(i);
                  };
                  return (
                    <View key={`${o.weaponId}-${i}`} style={{ gap: 5 }}>
                      <WeaponOfferRow
                        testID={`spire-event-weapon-${i}`}
                        weapon={w}
                        level={o.level}
                        badges={badges.length > 0 ? badges : undefined}
                        focused
                        onPress={handlePick}
                        right={
                          <Btn
                            testID={`spire-event-weapon-btn-${i}`}
                            small
                            label={isUpgrade ? 'Upgrade' : needsSwap ? 'Swap' : 'Claim'}
                            onPress={handlePick}
                          />
                        }
                      />
                      {swapIdx === i && needsSwap && (
                        <SpireSwapPicker
                          run={run}
                          incomingWeaponId={o.weaponId}
                          incomingLevel={o.level}
                          testIDPrefix="spire-event-swap"
                          onConfirmSwap={dropId => {
                            band.cue('weaponGet');
                            setSwapIdx(null);
                            onPickWeapon(i, dropId);
                          }}
                          onCancel={() => {
                            sfx('click');
                            setSwapIdx(null);
                          }}
                        />
                      )}
                    </View>
                  );
                })}
                {beltFull && onSkipWeapon && (
                  <Btn
                    testID="spire-event-weapon-skip"
                    small
                    variant="ghost"
                    label={`Keep current belt (+${SKIP_WEAPON_COINS}¢)`}
                    onPress={() => {
                      sfx('click');
                      setSwapIdx(null);
                      onSkipWeapon();
                    }}
                  />
                )}
              </View>
            )}

            {/* Inline Skill Node Pick */}
            {availSkills.length > 0 && (
              <View style={{ gap: 8 }}>
                {availSkills.map((id, i) => (
                  <SkillNodeRow
                    key={id}
                    testID={`spire-event-skill-${i}`}
                    nodeId={id}
                    onPress={() => { band.cue('levelUp'); onPickSkill(id); }}
                  />
                ))}
              </View>
            )}

            {/* Inline Arcana Accept / Decline (never forces a blind cursed Arcana!) */}
            {pendingArcana && (
              <View style={{ gap: 8 }}>
                <ArcanaCard
                  arcanaId={pendingArcana}
                  showTagline
                  testID="spire-event-arcana-offer"
                />
                <Btn
                  testID="spire-event-arcana-accept"
                  label={`Accept ${getArcana(pendingArcana).name}`}
                  icon="lorc/crystal-wand"
                  onPress={() => {
                    band.cue('catalyst');
                    onResolveArcana?.(true);
                  }}
                />
                <Btn
                  testID="spire-event-arcana-decline"
                  small
                  variant="ghost"
                  label="Decline & Keep Walking"
                  onPress={() => {
                    sfx('click');
                    onResolveArcana?.(false);
                  }}
                />
              </View>
            )}

            {/* Inline Forge (+1 or +2 Levels) */}
            {eventState.pendingForge && (
              <View style={{ gap: 8 }}>
                {forgeable.map(w => {
                  const lv = run.weaponLevels[w.id] ?? 1;
                  const delta = eventState.pendingForgeDelta ?? 2;
                  return (
                    <WeaponOfferRow
                      key={w.id}
                      testID={`spire-event-forge-${w.id}`}
                      weapon={w}
                      level={lv}
                      subtitle={`Level ${lv} → ${Math.min(MAX_WEAPON_LEVEL, lv + delta)}`}
                      focused
                      onPress={() => { band.cue('levelUp'); onPickForge(w.id); }}
                    />
                  );
                })}
              </View>
            )}

            {!hasPendingSubPick && (
              <Btn
                testID="spire-event-leave"
                label={eventState.ambushEncounter ? 'Face the Guardian!' : 'Continue Climb'}
                icon={eventState.ambushEncounter ? 'lorc/crossed-swords' : 'lorc/mountaintop'}
                onPress={() => { sfx('confirm'); onLeave(); }}
              />
            )}
          </PopIn>
        )}
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  body: { padding: 14, gap: 12, maxWidth: 500, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  storyCard: { backgroundColor: DARK.panel, borderRadius: 14, borderWidth: 2.5, borderColor: COLORS.actionYellow, padding: 14, gap: 10 },
  storyHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: { width: 48, height: 48, borderRadius: 10, borderWidth: 2, borderColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '900', color: DARK.text },
  storyText: { fontSize: 14, lineHeight: 20, color: DARK.text, opacity: 0.92 },
  optList: { gap: 10 },
  optCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 4 },
  optBold: { borderColor: '#D97706', backgroundColor: '#FFFBEB' },
  optSafe: { borderColor: TONE.upside, backgroundColor: '#F0FDFA' },
  optHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  optLabel: { fontSize: 15, fontWeight: '900', color: INK },
  optDetail: { fontSize: 12, lineHeight: 17, color: INK, opacity: 0.85 },
  lockTag: { fontSize: 10, fontWeight: '900', color: '#B91C1C', backgroundColor: '#FEE2E2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  outcomeCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 14, gap: 10 },
  outcomeTitle: { fontSize: 19, fontWeight: '900', color: INK, textAlign: 'center' },
  outcomeText: { fontSize: 13, lineHeight: 19, color: INK, textAlign: 'center' },
});

export default SpireEvent;
