/**
 * Camp — spend coins. Two tabs:
 *   Fighters: level each fighter 1→10 (upgrades their starting gear)
 *   Workshop: expensive permanent upgrades
 * Plus a read-only Armory of every weapon unlocked so far.
 */
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import type { FighterReactionEvent, FighterReactionType } from '@/utils/fighterAnimations';
import { COLORS, getRarityColor } from '@/utils/colors';
import { WEAPONS } from '@/utils/gameDefinitions';
import { sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave } from '../types';
import { FIGHTERS, MAX_FIGHTER_LEVEL, getLevelUpCost, getLoadout } from '../data/fighters';
import { UPGRADES } from '../data/upgrades';
import { MECHANICS } from '../data/mechanics';
import { buyUpgrade, canLevelFighter, equipCharm, fighterLevel, levelFighter, upgradeCost, upgradeTier } from '../progress';
import { Btn, CoinPill, INK, PopIn } from './ui';

type Tab = 'fighters' | 'workshop' | 'armory';

interface Props {
  save: AdventureSave;
  onChange: (save: AdventureSave) => void;
  onClose: () => void;
}

const weapon = (id: string) => WEAPONS.find(w => w.id === id);

const Camp: React.FC<Props> = ({ save, onChange, onClose }) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('fighters');
  const [reactions, setReactions] = useState<Partial<Record<CharacterName, FighterReactionEvent>>>({});
  const [armoryTapCounts, setArmoryTapCounts] = useState<Record<string, number>>({});
  const reactionSeq = useRef(0);

  const fireFighterReaction = (name: CharacterName, type: FighterReactionType) => {
    reactionSeq.current += 1;
    setReactions(prev => ({ ...prev, [name]: { type, id: reactionSeq.current } }));
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity onPress={() => { sfx('back'); onClose(); }} style={st.back} accessibilityLabel="Back to map">
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Icon name="lorc/campfire" size={24} color={COLORS.impactOrange} />
        <Text style={st.title}>CAMP</Text>
        <View style={{ flex: 1 }} />
        <CoinPill coins={save.coins} />
      </View>
      <View style={st.tabs}>
        {(['fighters', 'workshop', 'armory'] as Tab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => { sfx('click'); setTab(t); }} style={[st.tab, tab === t && st.tabOn]}>
            <Text style={[st.tabText, tab === t && { color: INK }]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 24 }]}>
        {tab === 'fighters' && FIGHTERS.map(f => {
          const unlocked = save.unlockedFighters.includes(f.name);
          const lvl = fighterLevel(save, f.name);
          const cost = getLevelUpCost(lvl);
          const now = getLoadout(f.name, lvl);
          const next = lvl < MAX_FIGHTER_LEVEL ? getLoadout(f.name, lvl + 1) : null;
          const nextPerk = lvl < MAX_FIGHTER_LEVEL ? f.perkText[lvl] : null;
          const gearChanges = next ? next.filter((id, i) => now[i] !== id) : [];
          const sig = MECHANICS[f.signature];
          const selected = save.selectedFighter === f.name;
          return (
            <View key={f.name} style={[st.fighter, !unlocked && { opacity: 0.55 }, selected && { borderColor: COLORS.deepOnyx, backgroundColor: '#FFFBE0' }]}>
              <View style={st.fighterHead}>
                {unlocked ? (
                  <FighterAvatar
                    testID={`camp-fighter-avatar-${f.name}`}
                    character={f.name}
                    size={50}
                    mood={selected ? 'anticipation' : 'idle'}
                    reaction={reactions[f.name] ?? null}
                    framed
                    interactive
                  />
                ) : (
                  <View style={st.portrait}><Icon name="lorc/padlock" size={30} color={INK} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={st.fighterName}>{unlocked ? f.name : '???'}</Text>
                  <Text style={st.fighterBlurb}>{unlocked ? f.blurb : 'A fighter you have not met yet. Keep winning stars.'}</Text>
                  {unlocked && <LevelPips level={lvl} />}
                </View>
                {unlocked && !selected && (
                  <Btn
                    small
                    variant="secondary"
                    label="Use"
                    onPress={() => {
                      sfx('confirm');
                      fireFighterReaction(f.name, 'joy');
                      onChange({ ...save, selectedFighter: f.name });
                    }}
                  />
                )}
                {selected && <View style={st.usingTag}><Text style={st.usingText}>USING</Text></View>}
              </View>
              {unlocked && (
                <>
                  <View style={st.gearRow}>
                    {now.map((id, i) => {
                      const w = weapon(id);
                      return (
                        <View key={i} style={[st.gear, { borderColor: w ? getRarityColor(w.rarity) : INK }]}>
                          {w && <WeaponAvatar weapon={w} size={20} interactive />}
                          <Text style={st.gearText} numberOfLines={1}>{w?.name ?? id}</Text>
                        </View>
                      );
                    })}
                  </View>
                  {sig && <Text style={st.sigText}><Text style={{ fontWeight: '900' }}>Signature: </Text>{sig.tagline}</Text>}
                  {cost !== null ? (
                    <View style={st.levelUpRow}>
                      <Text style={st.nextText} numberOfLines={2}>
                        Lv {lvl + 1}: {[...gearChanges.map(id => {
                          const w = weapon(id);
                          return w ? `${w.name} (${w.rarity})` : id;
                        }), nextPerk].filter(Boolean).join(' · ') || 'Stronger gear'}
                      </Text>
                      <Btn
                        small
                        label={`${cost}¢`}
                        icon="lorc/crown-coin"
                        disabled={!canLevelFighter(save, f.name)}
                        onPress={() => {
                          sfx('levelup');
                          fireFighterReaction(f.name, 'powerup');
                          onChange(levelFighter(save, f.name));
                        }}
                      />
                    </View>
                  ) : (
                    <Text style={st.maxed}>MAX LEVEL</Text>
                  )}
                </>
              )}
            </View>
          );
        })}

        {tab === 'workshop' && (
          <>
            <Text style={st.blurb}>Permanent upgrades for every fighter. They're pricey, so replay levels to save up. Tougher foes pay more.</Text>
            {UPGRADES.map(u => {
              const tier = upgradeTier(save, u.id);
              const cost = upgradeCost(save, u.id);
              return (
                <PopIn key={u.id} style={st.upgrade}>
                  <View style={st.portrait}><Icon name={u.icon} size={30} color={INK} /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={st.fighterName}>{u.name}</Text>
                    <Text style={st.fighterBlurb}>{tier > 0 ? `Now: ${u.description(tier)}` : u.description(1)}</Text>
                    <View style={{ flexDirection: 'row', gap: 3, marginTop: 2 }}>
                      {u.costs.map((_, i) => <View key={i} style={[st.tierPip, i < tier && st.tierPipOn]} />)}
                    </View>
                  </View>
                  {cost !== null ? (
                    <Btn small label={`${cost}¢`} icon="lorc/crown-coin" disabled={save.coins < cost} onPress={() => { sfx('unlock'); onChange(buyUpgrade(save, u.id)); }} />
                  ) : (
                    <Text style={st.maxed}>MAX</Text>
                  )}
                </PopIn>
              );
            })}
          </>
        )}

        {tab === 'armory' && (
          <>
            <Text style={st.blurb}>Weapons you've unlocked. Tap one to equip it as your charm. They also show up in level-up picks and shops.</Text>
            {save.armory.length === 0 && <Text style={st.blurb}>Nothing here yet. Some stars unlock a weapon.</Text>}
            <View style={st.armory}>
              {WEAPONS.filter(w => save.armory.includes(w.id)).map(w => {
                const equipped = save.charm === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => {
                      sfx('confirm');
                      setArmoryTapCounts(prev => ({ ...prev, [w.id]: (prev[w.id] ?? 0) + 1 }));
                      onChange(equipCharm(save, w.id));
                    }}
                    activeOpacity={0.85}
                    style={[st.armoryItem, { borderColor: equipped ? COLORS.actionYellow : getRarityColor(w.rarity) }, equipped && { backgroundColor: '#FFFBE0' }]}
                  >
                    <WeaponAvatar weapon={w} size={36} triggerKey={armoryTapCounts[w.id]} />
                    <Text style={st.armoryName} numberOfLines={1}>{w.name}</Text>
                    <Text style={[st.armoryRarity, { color: getRarityColor(w.rarity) === COLORS.rarityCommon ? '#8E877D' : getRarityColor(w.rarity) }]}>{equipped ? 'equipped' : w.rarity}</Text>
                    <Text style={st.armoryDesc} numberOfLines={2}>{w.shortDescription}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={st.blurb}>More weapons are out there…</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const LevelPips: React.FC<{ level: number }> = ({ level }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
    <Text style={st.lvText}>LV {level}</Text>
    {Array.from({ length: MAX_FIGHTER_LEVEL }).map((_, i) => <View key={i} style={[st.lvPip, i < level && st.lvPipOn]} />)}
  </View>
);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 18 },
  tabs: { flexDirection: 'row', gap: 6, padding: 10 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 2, borderColor: '#6B5A49', alignItems: 'center' },
  tabOn: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  tabText: { fontWeight: '900', color: '#E9DCCB', letterSpacing: 1.5, fontSize: 12 },
  body: { padding: 12, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  blurb: { color: '#E9DCCB', fontSize: 13, textAlign: 'center', marginVertical: 4 },
  fighter: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  fighterHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  portrait: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  fighterName: { fontWeight: '900', fontSize: 16, color: INK },
  fighterBlurb: { fontSize: 12, color: INK, opacity: 0.8 },
  usingTag: { backgroundColor: INK, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  usingText: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  gearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gear: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, maxWidth: 170 },
  gearText: { fontSize: 11, fontWeight: '800', color: INK },
  sigText: { fontSize: 12, color: INK },
  levelUpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8 },
  nextText: { flex: 1, fontSize: 12, fontWeight: '700', color: INK },
  maxed: { fontWeight: '900', color: COLORS.logicTeal, letterSpacing: 1, fontSize: 12 },
  lvText: { fontSize: 10, fontWeight: '900', color: INK, marginRight: 4 },
  lvPip: { width: 10, height: 6, borderRadius: 2, backgroundColor: '#E2DBD0' },
  lvPipOn: { backgroundColor: COLORS.actionYellow, borderWidth: 1, borderColor: INK },
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12 },
  tierPip: { width: 18, height: 6, borderRadius: 2, backgroundColor: '#E2DBD0' },
  tierPipOn: { backgroundColor: COLORS.logicTeal },
  armory: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  armoryItem: { width: 120, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2.5, padding: 8, alignItems: 'center', gap: 2 },
  armoryName: { fontWeight: '900', fontSize: 12, color: INK },
  armoryRarity: { fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  armoryDesc: { fontSize: 10, color: INK, textAlign: 'center', opacity: 0.8 },
});

export default Camp;
