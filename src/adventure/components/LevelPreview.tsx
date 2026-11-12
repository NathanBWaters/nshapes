/**
 * Level preview sheet — "what am I up against?" Foe, difficulty, new
 * mechanic, star goals with their coin rewards, secret unlocks shown as
 * silhouettes, and the fighter + charm you'll bring.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import Icon, { IconName } from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS, getRarityColor } from '@/utils/colors';
import { WEAPONS } from '@/utils/gameDefinitions';
import type { CharacterName, Weapon } from '@/types';
import type { AdventureSave, ArcanaId, LevelDef, RewardDef } from '../types';
import { getBiome } from '../data/biomes';
import { foeDisplay, levelFoe } from '../data/foes';
import { getMechanic } from '../data/mechanics';
import { FIGHTERS, getFighter, getLoadout } from '../data/fighters';
import { applyWeaponUpgradeTier } from '../data/upgrades';
import { ARCANA, getArcana } from '../data/arcana';
import { EVOLUTION_RECIPES, getEvolutionRecipe } from '../data/evolutions';
import { getLevel } from '../data/levels';
import { starGoals } from '../engine/challenges';
import { fighterLevel, getFeaturesForLevel, getLockReason, weaponUpgradeTier } from '../progress';
import { Btn, Eyebrow, Heart, INK, PopIn, Skulls, StarRow } from './ui';
import { Silhouette } from './UnlockReveal';

const ATTR_ICONS = { shape: 'lorc/diamond-hard', color: 'lorc/crystal-shine', number: 'lorc/cycle', shading: 'lorc/stone-block', background: 'lorc/field' } as const;

const weapon = (id: string) => WEAPONS.find(w => w.id === id);

/** What a star unlocks besides coins. Secret until earned. */
export const unlockInfo = (r: RewardDef): { secret: string; revealed: string; icon: IconName } | null => {
  if (r.unlockFeature === 'coins') return { secret: 'New ability', revealed: 'Coin Drops', icon: 'lorc/crown-coin' };
  if (r.unlockFeature === 'workshop') return { secret: 'Camp upgrade', revealed: 'The Workshop', icon: 'lorc/gear-hammer' };
  if (r.character) return { secret: 'A new fighter', revealed: r.character, icon: getFighter(r.character).icon };
  if (r.weapons?.length) {
    const ws = r.weapons.map(weapon);
    return { secret: r.weapons.length > 1 ? 'New weapons' : 'A new weapon', revealed: ws.map(w => w?.name ?? '?').join(' + '), icon: ws[0]?.icon ?? 'lorc/gems' };
  }
  if (r.evolution) {
    const evo = getEvolutionRecipe(r.evolution);
    return { secret: 'A weapon combo', revealed: `Combo: ${evo.result.name}`, icon: evo.result.icon ?? 'lorc/crystal-shine' };
  }
  if (r.arcana) {
    const a = getArcana(r.arcana);
    return { secret: 'A new Arcana', revealed: `Arcana ${a.numeral}: ${a.name}`, icon: a.icon };
  }
  return null;
};

interface Props {
  level: LevelDef | null;
  save: AdventureSave;
  onClose: () => void;
  onPlay: (level: LevelDef) => void;
  onSelectFighter: (f: CharacterName) => void;
  onSelectCharm: (id: string) => void;
  onSelectArcana?: (id: ArcanaId | null) => void;
  onShowMechanic: (id: string) => void;
}

const LevelPreview: React.FC<Props> = ({ level, save, onClose, onPlay, onSelectFighter, onSelectCharm, onSelectArcana, onShowMechanic }) => {
  const [charmTapCounts, setCharmTapCounts] = useState<Record<string, number>>({});
  if (!level) return null;
  const biome = getBiome(level.biome);
  const foe = levelFoe(level);
  const mech = getMechanic(level.introduces);
  const lock = getLockReason(save, level);
  const best = save.stars[level.id] ?? 0;
  const timed = !!level.rules.timer;
  const accuracy = level.starRule?.kind === 'accuracy';
  const texts = starGoals(level, foe.name);
  const goals = [
    { star: 1, text: texts[0], reward: level.rewards.star1 },
    { star: 2, text: texts[1], reward: level.rewards.star2 },
    { star: 3, text: texts[2], reward: level.rewards.star3 },
  ];
  const isNew = !save.seenMechanics.includes(level.introduces);
  const gearOn = !level.rules.noGear;
  const totalHp = level.foes.reduce((a, f) => a + f.hp, 0);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <PopIn style={st.sheet}>
          <View style={[st.header, { backgroundColor: biome.colors.sky }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[st.levelId, { color: biome.colors.ink }]}>
                {biome.name.toUpperCase()} · {level.id}{level.isBoss ? ' · BOSS' : ''}{level.branchOf ? ' · ELITE' : ''}
              </Text>
              <TouchableOpacity onPress={onClose} style={st.close}><Text style={st.closeText}>✕</Text></TouchableOpacity>
            </View>
            <View style={st.foeRow}>
              <View style={[st.foePortrait, level.isBoss && st.foeBoss, level.branchOf && st.foeElite]}>
                <EnemyAvatar
                  testID="preview-enemy-avatar"
                  enemy={foe}
                  size={level.isBoss ? 78 : 68}
                  mood={level.isBoss ? 'enraged' : 'menacing'}
                  reaction={{ type: 'entrance', id: 1 }}
                  interactive
                />
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
              {accuracy ? (
                <Rule icon="lorc/archery-target" text={`Make ${Math.ceil(totalHp / 3)} Sets`} />
              ) : (
                <Rule icon={timed ? 'lorc/stopwatch' : 'lorc/archery-target'} text={timed ? `${level.rules.timer}s` : `${level.rules.moves} moves`} />
              )}
              <View style={st.rule}><Heart size={16} /><Text style={st.ruleText}>{level.rules.hearts === 0 ? "Can't lose" : level.rules.hearts}</Text></View>
              <Rule icon="lorc/crossed-swords" text={`${totalHp} HP`} />
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
                  <EnemyAvatar enemy={d} size={26} mood="menacing" lightweight />
                  <Text style={st.abilityText}><Text style={{ fontWeight: '900' }}>{d.name}: </Text>{d.ability}</Text>
                </View>
              ) : null;
            })}

            {/* Star goals: coins up front, unlocks kept secret */}
            <Text style={st.section}>REWARDS</Text>
            <View style={{ gap: 6 }}>
              {goals.map(g => {
                const done = best >= g.star;
                const unlock = unlockInfo(g.reward);
                return (
                  <View key={g.star} style={[st.goal, done && st.goalDone]}>
                    <View style={st.goalTop}>
                      <StarRow stars={g.star} max={g.star} size={15} />
                      <Text style={[st.goalText, done && { opacity: 0.6 }]}>{g.text}</Text>
                      {done && <Text style={st.doneMark}>✓</Text>}
                    </View>
                    <View style={st.goalRewards}>
                      <View style={[st.coinChip, done && st.chipDone]}>
                        <Icon name="lorc/crown-coin" size={14} color={done ? '#8E877D' : '#B07D00'} />
                        <Text style={[st.coinChipText, done && { color: '#8E877D' }]}>{g.reward.coins}</Text>
                      </View>
                      {unlock && (
                        done ? (
                          <View style={[st.unlockChip, st.chipDone]}>
                            {g.reward.character ? (
                              <FighterAvatar character={g.reward.character} size={20} mood="idle" />
                            ) : g.reward.weapons?.length && weapon(g.reward.weapons[0]) ? (
                              <WeaponAvatar weapon={weapon(g.reward.weapons[0])} size={20} interactive />
                            ) : g.reward.evolution ? (
                              <WeaponAvatar weapon={getEvolutionRecipe(g.reward.evolution).result} size={20} interactive />
                            ) : (
                              <Icon name={unlock.icon} size={16} color="#8E877D" />
                            )}
                            <Text style={[st.unlockText, { color: '#8E877D' }]} numberOfLines={1}>{unlock.revealed}</Text>
                          </View>
                        ) : (
                          <View style={st.unlockChip}>
                            <Silhouette icon={unlock.icon} size={14} />
                            <Text style={st.unlockText}>{unlock.secret}</Text>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Fighter picker */}
            <Text style={st.section}>FIGHTER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4, paddingTop: 6 }}>
              {FIGHTERS.filter(f => save.unlockedFighters.includes(f.name)).map(f => {
                const selected = f.name === save.selectedFighter;
                const rec = level.recommended?.includes(f.name);
                return (
                  <TouchableOpacity key={f.name} onPress={() => onSelectFighter(f.name)} style={[st.fighter, selected && st.fighterSel]} activeOpacity={0.85}>
                    <FighterAvatar
                      character={f.name}
                      size={42}
                      mood={selected ? 'anticipation' : 'idle'}
                      reaction={selected ? { type: 'entrance', id: 1 } : null}
                    />
                    <Text style={st.fighterName} numberOfLines={1}>{f.name}</Text>
                    <Text style={st.fighterLvl}>LV {fighterLevel(save, f.name)}</Text>
                    {rec && <View style={st.rec}><Text style={st.recText}>STRONG</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {!gearOn && <Text style={st.note}>Fighter abilities and weapons switch on after this first fight.</Text>}

            {/* Charm picker */}
            {gearOn && save.armory.length > 0 && (
              <>
                <Text style={st.section}>CHARM <Text style={st.sectionHint}>one weapon from your Armory</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {save.armory.map(id => {
                    const w = weapon(id);
                    if (!w) return null;
                    const selected = save.charm === id;
                    const wTier = weaponUpgradeTier(save, id);
                    return (
                      <TouchableOpacity
                        key={id}
                        testID={`charm-${id}`}
                        onPress={() => {
                          setCharmTapCounts(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
                          onSelectCharm(id);
                        }}
                        style={[st.charm, { borderColor: selected ? INK : getRarityColor(w.rarity) }, selected && st.charmSel]}
                        activeOpacity={0.85}
                      >
                        <WeaponAvatar weapon={w} size={32} triggerKey={charmTapCounts[id]} />
                        <Text style={st.fighterName} numberOfLines={1}>{w.name}{wTier > 0 ? ` +${wTier}` : ''}</Text>
                        <Text style={st.charmDesc} numberOfLines={2}>{applyWeaponUpgradeTier(w, wTier).shortDescription}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Evolution synergy preview when Evolutions are unlocked */}
            {gearOn && getFeaturesForLevel(level, save).has('evolutions') && (() => {
              const previewWeapons: Weapon[] = getLoadout(save.selectedFighter, fighterLevel(save, save.selectedFighter))
                .map(weapon)
                .filter((w): w is Weapon => !!w);
              if (save.charm && save.armory.includes(save.charm)) {
                const cw = weapon(save.charm);
                if (cw) previewWeapons.push(cw);
              }
              const recipe = EVOLUTION_RECIPES.find(r => save.unlockedEvolutions.includes(r.id) && r.hasGear(previewWeapons));
              if (!recipe) return null;
              return (
                <View style={st.evoHint}>
                  <Icon name="lorc/crystal-shine" size={18} color="#7C3AED" />
                  <View style={{ flex: 1 }}>
                    <Text style={st.evoHintTitle}>
                      {`Combo Ready to Prime: ${recipe.result.name}`}
                    </Text>
                    <Text style={st.evoHintSub}>{recipe.primeRequirementText}, then match the hidden Catalyst card.</Text>
                  </View>
                </View>
              );
            })()}

            {/* Arcana tarot wildcard picker */}
            {gearOn && save.unlockedArcana.length > 0 && onSelectArcana && (
              <>
                <Text style={st.section}>ARCANA <Text style={st.sectionHint}>optional rule twist</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  <TouchableOpacity
                    testID="preview-arcana-none"
                    onPress={() => onSelectArcana(null)}
                    style={[st.arcanaItem, save.activeArcana === null && st.charmSel, { borderColor: save.activeArcana === null ? INK : '#CFC8BD' }]}
                    activeOpacity={0.85}
                  >
                    <Icon name="lorc/crossed-swords" size={22} color={INK} />
                    <Text style={st.fighterName}>Standard</Text>
                    <Text style={st.charmDesc} numberOfLines={2}>No rule modifier</Text>
                  </TouchableOpacity>
                  {ARCANA.filter(a => save.unlockedArcana.includes(a.id)).map(a => {
                    const selected = save.activeArcana === a.id;
                    return (
                      <TouchableOpacity
                        key={a.id}
                        testID={`preview-arcana-${a.id}`}
                        onPress={() => onSelectArcana(selected ? null : a.id)}
                        style={[st.arcanaItem, { borderColor: selected ? INK : '#A855F7' }, selected && st.charmSel]}
                        activeOpacity={0.85}
                      >
                        <Text style={st.arcanaNum}>{a.numeral}</Text>
                        <Icon name={a.icon} size={22} color={INK} />
                        <Text style={st.fighterName} numberOfLines={1}>{a.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {save.activeArcana && save.unlockedArcana.includes(save.activeArcana) && (() => {
                  const active = getArcana(save.activeArcana);
                  return (
                    <View style={st.arcanaSummary}>
                      <Text style={st.arcanaUp}>▲ {active.upside}</Text>
                      <Text style={st.arcanaDown}>▼ {active.tradeoff}</Text>
                    </View>
                  );
                })()}
              </>
            )}
          </ScrollView>

          <View style={st.footer}>
            {lock ? (
              <View style={st.locked}>
                <Icon name="lorc/padlock" size={18} color={INK} />
                <Text style={st.lockedText}>
                  {lock.kind === 'previous'
                    ? 'Earn a star on the previous level to unlock.'
                    : lock.kind === 'branch'
                      ? `Elite path. Earn ${'★'.repeat(lock.need)} on ${lock.parentId} ${getLevel(lock.parentId).name} to open it.`
                      : `Need ${lock.need} ★ total to enter ${biome.name} (you have ${lock.have}).`}
                </Text>
              </View>
            ) : (
              <Btn testID="preview-play" label={best > 0 ? 'Play again' : 'Fight!'} icon="lorc/crossed-swords" onPress={() => onPlay(level)} />
            )}
          </View>
        </PopIn>
      </View>
    </Modal>
  );
};

const Rule: React.FC<{ icon: IconName; text: string }> = ({ icon, text }) => (
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
  foeElite: { backgroundColor: '#5B2333', borderColor: COLORS.deepOnyx },
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
  goal: { gap: 6, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  goalDone: { backgroundColor: '#F4F1EC', borderColor: '#CFC8BD' },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalText: { flex: 1, fontWeight: '800', color: INK, fontSize: 14 },
  doneMark: { color: COLORS.logicTeal, fontWeight: '900', fontSize: 16 },
  goalRewards: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  coinChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF6C2', borderRadius: 999, borderWidth: 1.5, borderColor: '#B07D00', paddingHorizontal: 8, paddingVertical: 2 },
  coinChipText: { fontWeight: '900', color: '#7A5600', fontSize: 13 },
  unlockChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.deepOnyx, borderRadius: 999, paddingLeft: 3, paddingRight: 10, paddingVertical: 2, maxWidth: 240 },
  unlockText: { fontWeight: '800', color: COLORS.actionYellow, fontSize: 12 },
  chipDone: { backgroundColor: '#EAE5DD', borderColor: '#CFC8BD', paddingLeft: 8 },
  section: { fontWeight: '900', letterSpacing: 2, fontSize: 12, color: INK, marginTop: 4 },
  sectionHint: { fontWeight: '600', letterSpacing: 0, fontSize: 11, opacity: 0.7 },
  note: { fontSize: 12, color: INK, opacity: 0.7 },
  fighter: { width: 92, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 2, borderColor: '#CFC8BD', backgroundColor: COLORS.paperBeige, gap: 2 },
  fighterSel: { borderColor: INK, backgroundColor: COLORS.actionYellow, borderBottomWidth: 4 },
  fighterName: { fontSize: 11, fontWeight: '800', color: INK },
  fighterLvl: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.7 },
  rec: { position: 'absolute', top: -6, right: -4, backgroundColor: COLORS.logicTeal, borderRadius: 4, paddingHorizontal: 4, borderWidth: 1, borderColor: INK },
  recText: { fontSize: 8, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 1 },
  charm: { width: 112, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 2, backgroundColor: COLORS.paperBeige, gap: 2 },
  charmSel: { backgroundColor: COLORS.actionYellow, borderBottomWidth: 4 },
  charmDesc: { fontSize: 10, color: INK, textAlign: 'center', opacity: 0.8 },
  evoHint: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F3FF', borderRadius: 8, borderWidth: 1.5, borderColor: '#7C3AED', padding: 8 },
  evoHintTitle: { fontSize: 12, fontWeight: '900', color: INK },
  evoHintSub: { fontSize: 11, color: INK, opacity: 0.85 },
  arcanaItem: { width: 102, alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 10, borderWidth: 2, backgroundColor: COLORS.paperBeige, gap: 2 },
  arcanaNum: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: '#6D28D9' },
  arcanaSummary: { backgroundColor: '#FAF5FF', borderRadius: 8, borderWidth: 1.5, borderColor: INK, padding: 8, gap: 2 },
  arcanaUp: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  arcanaDown: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  footer: { padding: 14, borderTopWidth: 2, borderTopColor: INK, backgroundColor: COLORS.paperBeige },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  lockedText: { color: INK, fontWeight: '700', flexShrink: 1 },
});

export default LevelPreview;
