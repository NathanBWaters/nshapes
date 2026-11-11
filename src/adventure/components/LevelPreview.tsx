/**
 * Level preview sheet — "what am I up against?" Foe, difficulty, new
 * mechanic, star goals + rewards, and fighter choice.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { WEAPONS } from '@/utils/gameDefinitions';
import type { CharacterName } from '@/types';
import type { AdventureSave, LevelDef, RewardDef } from '../types';
import { getBiome } from '../data/biomes';
import { foeDisplay, levelFoe } from '../data/foes';
import { getMechanic } from '../data/mechanics';
import { FIGHTERS } from '../data/fighters';
import { describeChallenge } from '../engine/challenges';
import { fighterLevel, getLockReason } from '../progress';
import { Btn, Eyebrow, Heart, INK, PopIn, Skulls, StarRow } from './ui';

const ATTR_ICONS = { shape: 'lorc/diamond-hard', color: 'lorc/crystal-shine', number: 'lorc/cycle', shading: 'lorc/stone-block', background: 'lorc/field' } as const;

export const rewardText = (r: RewardDef): string => {
  const parts: string[] = [];
  if (r.character) parts.push(`Unlock ${r.character}`);
  if (r.weapons?.length) parts.push(r.weapons.map(id => WEAPONS.find(w => w.id === id)?.name ?? id).filter((v, i, a) => a.indexOf(v) === i).join(' + '));
  if (r.coins) parts.push(`${r.coins} coins`);
  return parts.join(' · ');
};

const rewardIcon = (r: RewardDef) => (r.character ? 'lorc/trophy' : r.weapons?.length ? 'lorc/gems' : 'lorc/crown-coin');

interface Props {
  level: LevelDef | null;
  save: AdventureSave;
  onClose: () => void;
  onPlay: (level: LevelDef, fighter: CharacterName) => void;
  onSelectFighter: (f: CharacterName) => void;
  onShowMechanic: (id: string) => void;
}

const LevelPreview: React.FC<Props> = ({ level, save, onClose, onPlay, onSelectFighter, onShowMechanic }) => {
  if (!level) return null;
  const biome = getBiome(level.biome);
  const foe = levelFoe(level);
  const mech = getMechanic(level.introduces);
  const lock = getLockReason(save, level);
  const best = save.stars[level.id] ?? 0;
  const timed = !!level.rules.timer;
  const goals = [
    { star: 1, text: timed ? `Survive ${level.rules.timer}s` : level.rules.moves ? `Survive all ${level.rules.moves} moves` : 'Survive', reward: level.rewards.star1 },
    { star: 2, text: level.foes.length > 1 ? `Defeat all ${level.foes.length} waves` : `Defeat ${foe.name}`, reward: level.rewards.star2 },
    { star: 3, text: `Defeat + ${describeChallenge(level)}`, reward: level.rewards.star3 },
  ];
  const isNew = !save.seenMechanics.includes(level.introduces);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <PopIn style={st.sheet}>
          <View style={[st.header, { backgroundColor: biome.colors.sky }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[st.levelId, { color: biome.colors.ink }]}>{biome.name.toUpperCase()} · {level.id}{level.isBoss ? ' · BOSS' : ''}</Text>
              <TouchableOpacity onPress={onClose} style={st.close}><Text style={st.closeText}>✕</Text></TouchableOpacity>
            </View>
            <View style={st.foeRow}>
              <View style={[st.foePortrait, level.isBoss && st.foeBoss]}>
                <Icon name={foe.icon} size={level.isBoss ? 64 : 54} color={INK} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.levelName}>{level.name}</Text>
                <Text style={st.foeName}>vs {level.foes.length > 1 ? `${level.foes.length} waves` : foe.name}</Text>
                <Skulls n={level.difficulty} />
              </View>
            </View>
            {level.foes[level.foes.length - 1].taunt && (
              <View style={st.bubble}><Text style={st.bubbleText}>“{level.foes[level.foes.length - 1].taunt}”</Text></View>
            )}
          </View>

          <ScrollView contentContainerStyle={st.body} bounces={false}>
            {/* New mechanic */}
            <TouchableOpacity onPress={() => onShowMechanic(level.introduces)} style={st.mech} activeOpacity={0.85}>
              <Icon name={mech.icon} size={28} color={INK} />
              <View style={{ flex: 1 }}>
                <Eyebrow text={isNew ? 'New this level' : 'Featured'} />
                <Text style={st.mechTitle}>{mech.title}</Text>
                <Text style={st.mechTag}>{mech.tagline}</Text>
              </View>
              <Icon name="lorc/open-book" size={18} color={INK} />
            </TouchableOpacity>

            {/* Rules strip */}
            <View style={st.rules}>
              <Rule icon={timed ? 'lorc/stopwatch' : 'lorc/archery-target'} text={timed ? `${level.rules.timer}s` : `${level.rules.moves} moves`} />
              <View style={st.rule}><Heart size={16} /><Text style={st.ruleText}>{level.index === 0 ? '∞' : level.rules.hearts}</Text></View>
              <Rule icon="lorc/crossed-swords" text={`${level.foes.reduce((a, f) => a + f.hp, 0)} HP`} />
              <View style={st.rule}>
                <View style={{ flexDirection: 'row' }}>
                  {level.rules.attributes.map(a => <Icon key={a} name={ATTR_ICONS[a]} size={14} color={INK} />)}
                </View>
                <Text style={st.ruleText}>{level.rules.attributes.length} traits</Text>
              </View>
            </View>

            {level.foes.map((f, i) => {
              const d = foeDisplay(f);
              return d.ability ? (
                <View key={i} style={st.ability}>
                  <Icon name={d.icon} size={18} color={INK} />
                  <Text style={st.abilityText}><Text style={{ fontWeight: '900' }}>{d.name}: </Text>{d.ability}</Text>
                </View>
              ) : null;
            })}

            {/* Star goals */}
            <View style={{ gap: 6 }}>
              {goals.map(g => {
                const done = best >= g.star;
                return (
                  <View key={g.star} style={[st.goal, done && st.goalDone]}>
                    <StarRow stars={g.star} max={g.star} size={14} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.goalText}>{g.text}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name={rewardIcon(g.reward)} size={12} color={done ? '#8E877D' : '#B07D00'} />
                        <Text style={[st.goalReward, done && { textDecorationLine: 'line-through', color: '#8E877D' }]}>{rewardText(g.reward)}</Text>
                      </View>
                    </View>
                    {done && <Icon name="lorc/checked-shield" size={18} color={COLORS.logicTeal} />}
                  </View>
                );
              })}
            </View>

            {/* Fighter picker */}
            <Text style={st.section}>FIGHTER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {FIGHTERS.filter(f => save.unlockedFighters.includes(f.name)).map(f => {
                const selected = f.name === save.selectedFighter;
                const rec = level.recommended?.includes(f.name);
                return (
                  <TouchableOpacity key={f.name} onPress={() => onSelectFighter(f.name)} style={[st.fighter, selected && st.fighterSel]} activeOpacity={0.85}>
                    <Icon name={f.icon} size={30} color={INK} />
                    <Text style={st.fighterName} numberOfLines={1}>{f.name}</Text>
                    <Text style={st.fighterLvl}>LV {fighterLevel(save, f.name)}</Text>
                    {rec && <View style={st.rec}><Text style={st.recText}>STRONG</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ScrollView>

          <View style={st.footer}>
            {lock ? (
              <View style={st.locked}>
                <Icon name="lorc/padlock" size={18} color={INK} />
                <Text style={st.lockedText}>
                  {lock.kind === 'previous' ? 'Earn a star on the previous level to unlock.' : `Need ${lock.need} ★ total to enter ${biome.name} (you have ${lock.have}).`}
                </Text>
              </View>
            ) : (
              <Btn testID="preview-play" label={best > 0 ? 'Play again' : 'Fight!'} icon="lorc/crossed-swords" onPress={() => onPlay(level, save.selectedFighter)} />
            )}
          </View>
        </PopIn>
      </View>
    </Modal>
  );
};

const Rule: React.FC<{ icon: React.ComponentProps<typeof Icon>['name']; text: string }> = ({ icon, text }) => (
  <View style={st.rule}>
    <Icon name={icon} size={18} color={INK} />
    <Text style={st.ruleText}>{text}</Text>
  </View>
);

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,18,0.55)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '94%', backgroundColor: COLORS.canvasWhite, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: INK, overflow: 'hidden' },
  header: { padding: 16, gap: 10, borderBottomWidth: 2, borderBottomColor: INK },
  levelId: { fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  close: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontWeight: '900', color: INK },
  foeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  foePortrait: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  foeBoss: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.actionYellow },
  levelName: { fontSize: 24, fontWeight: '900', color: INK },
  foeName: { fontSize: 14, fontWeight: '700', color: INK, opacity: 0.8 },
  bubble: { alignSelf: 'flex-start', backgroundColor: COLORS.canvasWhite, borderWidth: 2, borderColor: INK, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 20 },
  bubbleText: { fontStyle: 'italic', color: INK, fontSize: 13 },
  body: { padding: 16, gap: 12 },
  mech: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: '#FFFBE0' },
  mechTitle: { fontSize: 16, fontWeight: '900', color: INK, marginTop: 2 },
  mechTag: { fontSize: 13, color: INK },
  rules: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1.5, borderColor: INK },
  ruleText: { fontWeight: '800', fontSize: 13, color: INK },
  ability: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFE9E7', borderRadius: 8, padding: 8, borderWidth: 1.5, borderColor: INK },
  abilityText: { flex: 1, color: INK, fontSize: 13 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  goalDone: { backgroundColor: '#F1FBF8' },
  goalText: { fontWeight: '800', color: INK, fontSize: 14 },
  goalReward: { fontSize: 12, color: '#B07D00', fontWeight: '700' },
  section: { fontWeight: '900', letterSpacing: 2, fontSize: 12, color: INK, marginTop: 4 },
  fighter: { width: 92, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 2, borderColor: '#CFC8BD', backgroundColor: COLORS.paperBeige, gap: 2 },
  fighterSel: { borderColor: INK, backgroundColor: COLORS.actionYellow, borderBottomWidth: 4 },
  fighterName: { fontSize: 11, fontWeight: '800', color: INK },
  fighterLvl: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.7 },
  rec: { position: 'absolute', top: -6, right: -4, backgroundColor: COLORS.logicTeal, borderRadius: 4, paddingHorizontal: 4, borderWidth: 1, borderColor: INK },
  recText: { fontSize: 8, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 1 },
  footer: { padding: 14, borderTopWidth: 2, borderTopColor: INK, backgroundColor: COLORS.paperBeige },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  lockedText: { color: INK, fontWeight: '700', flexShrink: 1 },
});

export default LevelPreview;
