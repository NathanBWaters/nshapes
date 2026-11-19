/**
 * Starfall Spire — Mystery Narrative Event Screen.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getSkillNode } from '@/adventure/data/skillTrees';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { Btn, DARK, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import { getSpireEvent } from '../data/events';
import { spireHeldWeapons } from '../engine/bridge';
import type { SpireEventState, SpireRun } from '../types';

interface Props {
  run: SpireRun;
  eventState: SpireEventState;
  onChoose: (optionId: string) => void;
  onPickWeapon: (index: number) => void;
  onPickSkill: (nodeId: string) => void;
  onPickForge: (weaponId: string) => void;
  onLeave: () => void;
}

const SpireEvent: React.FC<Props> = ({
  run,
  eventState,
  onChoose,
  onPickWeapon,
  onPickSkill,
  onPickForge,
  onLeave,
}) => {
  const def = getSpireEvent(eventState.eventId);
  const held = spireHeldWeapons(run);
  const forgeable = held.filter(w => (run.weaponLevels[w.id] ?? 1) < MAX_WEAPON_LEVEL);

  const hasPendingSubPick =
    (eventState.pendingWeaponOptions?.length ?? 0) > 0 ||
    (eventState.pendingSkillOptions?.length ?? 0) > 0 ||
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
              <Eyebrow text="MYSTERY ENCOUNTER" color="#E9D5FF" />
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
                  return (
                    <TouchableOpacity
                      key={o.weaponId}
                      testID={`spire-event-weapon-${i}`}
                      onPress={() => { band.cue('weaponGet'); onPickWeapon(i); }}
                      style={st.subPick}
                    >
                      <WeaponAvatar weapon={w} size={28} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.optLabel}>{w.name} Lv {o.level}</Text>
                        <Text style={st.optDetail} numberOfLines={2}>{w.shortDescription}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Inline Skill Node Pick */}
            {eventState.pendingSkillOptions && eventState.pendingSkillOptions.length > 0 && (
              <View style={{ gap: 8 }}>
                {eventState.pendingSkillOptions.map((id, i) => {
                  const n = getSkillNode(id);
                  if (!n) return null;
                  return (
                    <TouchableOpacity
                      key={id}
                      testID={`spire-event-skill-${i}`}
                      onPress={() => { band.cue('levelUp'); onPickSkill(id); }}
                      style={st.subPick}
                    >
                      <Icon name={n.icon} size={22} color={TONE.upside} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.optLabel}>{n.name}</Text>
                        <Text style={st.optDetail}>{n.text}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Inline Overclock +2 Forge */}
            {eventState.pendingForge && (
              <View style={{ gap: 8 }}>
                {forgeable.map(w => (
                  <TouchableOpacity
                    key={w.id}
                    testID={`spire-event-forge-${w.id}`}
                    onPress={() => { band.cue('levelUp'); onPickForge(w.id); }}
                    style={st.subPick}
                  >
                    <WeaponAvatar weapon={w} size={26} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.optLabel}>{w.name}</Text>
                      <Text style={st.optDetail}>
                        Level {run.weaponLevels[w.id] ?? 1} → {Math.min(MAX_WEAPON_LEVEL, (run.weaponLevels[w.id] ?? 1) + 2)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
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
  root: { flex: 1, backgroundColor: '#1E182B' },
  body: { padding: 14, gap: 12, maxWidth: 500, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  storyCard: { backgroundColor: DARK.panel, borderRadius: 14, borderWidth: 2.5, borderColor: '#A855F7', padding: 14, gap: 10 },
  storyHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: { width: 48, height: 48, borderRadius: 10, borderWidth: 2, borderColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '900', color: DARK.text },
  storyText: { fontSize: 14, lineHeight: 20, color: DARK.text, opacity: 0.92 },
  optList: { gap: 10 },
  optCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 4 },
  optBold: { borderColor: '#7C3AED', backgroundColor: '#FAF5FF' },
  optSafe: { borderColor: TONE.upside, backgroundColor: '#F0FDFA' },
  optHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  optLabel: { fontSize: 15, fontWeight: '900', color: INK },
  optDetail: { fontSize: 12, lineHeight: 17, color: INK, opacity: 0.85 },
  lockTag: { fontSize: 10, fontWeight: '900', color: '#B91C1C', backgroundColor: '#FEE2E2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  outcomeCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 14, gap: 10 },
  outcomeTitle: { fontSize: 19, fontWeight: '900', color: INK, textAlign: 'center' },
  outcomeText: { fontSize: 13, lineHeight: 19, color: INK, textAlign: 'center' },
  subPick: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 2, borderColor: INK, padding: 10 },
});

export default SpireEvent;
