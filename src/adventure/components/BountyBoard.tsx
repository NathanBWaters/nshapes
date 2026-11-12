/**
 * Cross-Run Bounty Board.
 *
 * Unlocked upon clearing 1-8 (Meadow Boss). Every Set, Rainbow Strike,
 * Escalating Purity combo, and Weapon Evolution across all fights advances
 * these milestones and cashes out coins, Armory weapons, and Arcana wildcards.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import { WEAPONS } from '@/utils/gameDefinitions';
import { sfx } from '@/audio';
import type { AdventureSave, BountyCategory } from '../types';
import { BOUNTIES } from '../data/bounties';
import { getArcana } from '../data/arcana';
import { CoinPill, INK, PopIn } from './ui';
import { Silhouette } from './UnlockReveal';

type Filter = 'all' | BountyCategory;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'mastery', label: 'MASTERY' },
  { id: 'chaos', label: 'CHAOS' },
  { id: 'roster', label: 'ROSTER' },
  { id: 'explorer', label: 'EXPLORER' },
];

interface Props {
  save: AdventureSave;
  onClose: () => void;
}

const BountyBoard: React.FC<Props> = ({ save, onClose }) => {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(() => {
    const filtered = filter === 'all' ? BOUNTIES : BOUNTIES.filter(b => b.category === filter);
    return [...filtered].sort((a, b) => {
      const aDone = save.completedBounties.includes(a.id);
      const bDone = save.completedBounties.includes(b.id);
      if (aDone !== bDone) return aDone ? 1 : -1;
      const aPct = Math.min(1, a.progress(save) / a.target);
      const bPct = Math.min(1, b.progress(save) / b.target);
      return bPct - aPct;
    });
  }, [filter, save]);

  const completedCount = save.completedBounties.length;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity onPress={() => { sfx('back'); onClose(); }} style={st.back} accessibilityLabel="Back to map">
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Icon name="lorc/trophy" size={22} color="#D97706" />
        <Text style={st.title}>BOUNTIES</Text>
        <Text style={st.count}>{completedCount}/{BOUNTIES.length}</Text>
        <View style={{ flex: 1 }} />
        <CoinPill coins={save.coins} />
      </View>

      <View style={st.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            testID={`bounty-filter-${f.id}`}
            onPress={() => { sfx('click'); setFilter(f.id); }}
            style={[st.filterBtn, filter === f.id && st.filterBtnOn]}
          >
            <Text style={[st.filterText, filter === f.id && { color: INK }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={st.blurb}>
          Every fight — win, lose, or replay — advances your Bounties and automatically cashes out rewards at the end of a run.
        </Text>

        {items.map(b => {
          const done = save.completedBounties.includes(b.id);
          const raw = b.progress(save);
          const cur = done ? b.target : Math.min(b.target, raw);
          const pct = Math.min(1, cur / b.target);
          const rewardWeapon = b.reward.weapons?.[0] ? WEAPONS.find(w => w.id === b.reward.weapons![0]) : undefined;
          const rewardArcana = b.reward.arcana ? getArcana(b.reward.arcana) : undefined;

          return (
            <PopIn key={b.id} style={[st.card, done && st.cardDone]}>
              <View style={st.head}>
                <View style={[st.iconBox, done && { backgroundColor: COLORS.actionYellow }]}>
                  <Icon name={b.icon} size={24} color={INK} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <Text style={st.name}>{b.name}</Text>
                    {done && (
                      <View style={st.claimedTag}>
                        <Text style={st.claimedText}>CLAIMED ✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={st.desc}>{b.description}</Text>
                </View>
              </View>

              <View style={st.barTrack}>
                <View style={[st.barFill, { width: `${pct * 100}%`, backgroundColor: done ? COLORS.logicTeal : COLORS.actionYellow }]} />
                <Text style={st.barText}>{cur} / {b.target}</Text>
              </View>

              <View style={st.rewardsRow}>
                <View style={[st.coinChip, done && st.chipDone]}>
                  <Icon name="lorc/crown-coin" size={13} color={done ? '#8E877D' : '#B07D00'} />
                  <Text style={[st.coinText, done && { color: '#8E877D' }]}>+{b.reward.coins}¢</Text>
                </View>

                {rewardWeapon && (
                  <View style={[st.unlockChip, done && st.chipDone]}>
                    {done ? (
                      <>
                        <WeaponAvatar weapon={rewardWeapon} size={18} />
                        <Text style={[st.unlockText, { color: '#8E877D' }]}>{rewardWeapon.name}</Text>
                      </>
                    ) : (
                      <>
                        <Silhouette icon={rewardWeapon.icon ?? 'lorc/crossed-swords'} size={13} />
                        <Text style={st.unlockText}>Armory Weapon</Text>
                      </>
                    )}
                  </View>
                )}

                {rewardArcana && (
                  <View style={[st.unlockChip, done && st.chipDone]}>
                    {done ? (
                      <>
                        <Icon name={rewardArcana.icon} size={15} color="#8E877D" />
                        <Text style={[st.unlockText, { color: '#8E877D' }]}>Arcana {rewardArcana.numeral}: {rewardArcana.name}</Text>
                      </>
                    ) : (
                      <>
                        <Silhouette icon={rewardArcana.icon} size={13} />
                        <Text style={st.unlockText}>Arcana Wildcard</Text>
                      </>
                    )}
                  </View>
                )}
              </View>
            </PopIn>
          );
        })}
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#231D18' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 17 },
  count: { fontWeight: '900', fontSize: 13, color: '#8E877D' },
  filters: { flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingTop: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  filterBtn: { flex: 1, paddingVertical: 7, borderRadius: 6, borderWidth: 2, borderColor: '#6B5A49', alignItems: 'center' },
  filterBtnOn: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  filterText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#E9DCCB' },
  body: { padding: 12, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  blurb: { color: '#E9DCCB', fontSize: 12, textAlign: 'center', marginBottom: 2 },
  card: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  cardDone: { backgroundColor: '#F4F1EC', borderColor: '#ABA397' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 44, height: 44, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '900', fontSize: 15, color: INK },
  desc: { fontSize: 12, color: INK, opacity: 0.82 },
  claimedTag: { backgroundColor: COLORS.logicTeal, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  claimedText: { fontSize: 9, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 1 },
  barTrack: { height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.paperBeige, overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  barText: { textAlign: 'center', fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  rewardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  coinChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF6C2', borderRadius: 999, borderWidth: 1.5, borderColor: '#B07D00', paddingHorizontal: 8, paddingVertical: 2 },
  coinText: { fontSize: 12, fontWeight: '900', color: '#7A5600' },
  unlockChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.deepOnyx, borderRadius: 999, paddingLeft: 4, paddingRight: 10, paddingVertical: 2 },
  unlockText: { fontSize: 11, fontWeight: '800', color: COLORS.actionYellow },
  chipDone: { backgroundColor: '#EAE5DD', borderColor: '#CFC8BD', paddingLeft: 8 },
});

export default BountyBoard;
