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
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId, LevelDef, LevelHazards } from '../types';
import { getBiome } from '../data/biomes';
import { foeDisplay, levelFoe } from '../data/foes';
import { getMechanic } from '../data/mechanics';
import { FIGHTERS, getFighter } from '../data/fighters';
import { getPassive } from '../data/passives';
import { ARCANA, getArcana } from '../data/arcana';
import { getArmoryWeapon, weaponLevelSuffix } from '../data/armory';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { getLevel } from '../data/levels';
import { isFighterTrial, starRewards } from '../data/rewards';
import { starGoals } from '../engine/challenges';
import {
  arcanaSlots,
  branchSpent,
  charmSlots,
  equippedArcanaOf,
  equippedCharms,
  getLockReason,
  recipeFamiliesHeld,
  weaponUpgradeTier,
  weaponTiers,
} from '../progress';
import { startingLoadout } from '../loadout';
import { Btn, Eyebrow, Heart, INK, PopIn, Skulls, StarRow, TONE } from './ui';
import { Silhouette, UnlockableAvatar, describeRewardUnlocks } from './rewards';

const ATTR_ICONS = { shape: 'lorc/diamond-hard', color: 'lorc/crystal-shine', number: 'lorc/cycle', shading: 'lorc/stone-block', background: 'lorc/field' } as const;

interface Props {
  level: LevelDef | null;
  save: AdventureSave;
  onClose: () => void;
  onPlay: (level: LevelDef) => void;
  onSelectFighter: (f: CharacterName) => void;
  /** Equip the charm if a slot is free, take it off if worn */
  onSelectCharm: (id: string) => void;
  /** Equip the Arcana (swapping out the oldest when full), take it off if worn */
  onSelectArcana?: (id: ArcanaId) => void;
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
  const goals = starRewards(level).map((reward, i) => ({ star: i + 1, text: texts[i], reward }));
  const isNew = !save.seenMechanics.includes(level.introduces);
  const loadout = startingLoadout(level, save);
  const gearOn = !level.rules.noGear;
  const totalHp = level.foes.reduce((a, f) => a + f.hp, 0);
  const charms = equippedCharms(save);
  const slots = charmSlots(save);
  const arcana = equippedArcanaOf(save);
  // The engine's view: it also counts skill nodes and charms that add evolution likelihood
  const armed = EVOLUTION_RECIPES.filter(r => loadout.armedRecipes.includes(r.id));
  const evolutionsOn = gearOn && loadout.features.has('evolutions');
  const fighter = getFighter(save.selectedFighter);
  const charmsFull = charms.length >= slots;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <PopIn style={st.sheet}>
          <View style={[st.header, { backgroundColor: biome.colors.sky }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[st.levelId, { color: biome.colors.ink }]}>
                {biome.name.toUpperCase()} · {level.id}{level.isBoss ? ' · BOSS' : ''}{level.branchOf ? (isFighterTrial(level) ? ' · TRIAL' : ' · ELITE') : ''}
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
            <TouchableOpacity onPress={() => onShowMechanic(level.introduces)} style={st.mech} activeOpacity={0.85}>
              <Icon name={mech.icon} size={28} color={INK} />
              <View style={{ flex: 1 }}>
                <Eyebrow text={isNew ? 'New this level' : 'Featured'} />
                <Text style={st.mechTitle}>{mech.title}</Text>
                <Text style={st.mechTag}>{mech.tagline}</Text>
              </View>
              <Icon name="lorc/open-book" size={18} color={INK} />
            </TouchableOpacity>

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

            {level.rules.hazards && <Hazards hazards={level.rules.hazards} />}

            {/* Star goals: coins up front, unlocks kept secret */}
            <Text style={st.section}>REWARDS</Text>
            <View style={{ gap: 6 }}>
              {goals.map(g => {
                const done = best >= g.star;
                const unlocks = describeRewardUnlocks(g.reward, save);
                return (
                  <View key={g.star} style={[st.goal, done && st.goalDone]}>
                    <View style={st.goalTop}>
                      <StarRow stars={g.star} max={g.star} size={15} />
                      <Text style={[st.goalText, done && { opacity: 0.6 }]}>{g.text}</Text>
                      {done && <Text style={st.doneMark}>✓</Text>}
                    </View>
                    <View style={st.goalRewards}>
                      <View style={[st.coinChip, done && st.chipDone]}>
                        <Icon name="lorc/crown-coin" size={14} color={done ? TONE.spent : TONE.coin} />
                        <Text style={[st.coinChipText, done && { color: TONE.spent }]}>{g.reward.coins}</Text>
                      </View>
                      {unlocks.map((unlock, k) =>
                        done ? (
                          <View key={k} style={[st.unlockChip, st.chipDone]}>
                            <UnlockableAvatar display={unlock} size={20} fighterMood="idle" iconSize={16} iconColor={TONE.spent} interactive />
                            <Text style={[st.unlockText, { color: TONE.spent }]} numberOfLines={1}>{unlock.revealed}</Text>
                          </View>
                        ) : (
                          <View key={k} style={st.unlockChip}>
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

            <Text style={st.section}>FIGHTER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4, paddingTop: 6 }}>
              {FIGHTERS.filter(f => save.unlockedFighters.includes(f.name)).map(f => {
                const selected = f.name === save.selectedFighter;
                const rec = level.recommended?.includes(f.name);
                const spent = branchSpent(save, f.name, 0) + branchSpent(save, f.name, 1);
                return (
                  <TouchableOpacity
                    key={f.name}
                    testID={`preview-fighter-${f.name}`}
                    onPress={() => onSelectFighter(f.name)}
                    style={[st.fighter, selected && st.fighterSel]}
                    activeOpacity={0.85}
                    accessibilityState={{ selected }}
                  >
                    <FighterAvatar
                      character={f.name}
                      size={42}
                      mood={selected ? 'anticipation' : 'idle'}
                      reaction={selected ? { type: 'entrance', id: 1 } : null}
                    />
                    <Text style={st.fighterName} numberOfLines={1}>{f.name}</Text>
                    <View style={st.passiveIcons}>
                      {f.passives.map(id => <Icon key={id} name={getPassive(id).icon} size={13} color={INK} />)}
                      {spent > 0 && <Text style={st.fighterLvl}>{spent}★</Text>}
                    </View>
                    {rec && <View style={st.rec}><Text style={st.recText}>STRONG</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {gearOn ? (
              <View style={st.passiveBox} testID="preview-passives">
                {fighter.passives.map(id => {
                  const p = getPassive(id);
                  return (
                    <View key={id} style={st.passiveRow}>
                      <Icon name={p.icon} size={16} color={INK} />
                      <Text style={st.passiveText}><Text style={{ fontWeight: '900' }}>{p.name}: </Text>{p.text}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={st.note}>Fighter passives and weapons switch on after this first fight.</Text>
            )}

            {gearOn && save.armory.length > 0 && (
              <>
                <Text style={st.section}>
                  CHARMS <Text style={st.sectionHint}>{charms.length}/{slots} equipped · tap to equip or remove</Text>
                </Text>
                <View style={st.slotRow} testID="preview-charm-slots">
                  {Array.from({ length: slots }).map((_, i) => {
                    const id = charms[i];
                    const w = id ? getArmoryWeapon(id, weaponTiers(save)) : undefined;
                    return w ? (
                      <TouchableOpacity
                        key={i}
                        testID={`preview-slot-${i}`}
                        onPress={() => onSelectCharm(id)}
                        style={[st.slot, { borderColor: getRarityColor(w.rarity), borderStyle: 'solid', backgroundColor: COLORS.canvasWhite }]}
                        accessibilityLabel={`Remove ${w.name}`}
                      >
                        <WeaponAvatar weapon={w} size={26} />
                      </TouchableOpacity>
                    ) : (
                      <View key={i} testID={`preview-slot-${i}`} style={st.slot}><Text style={st.slotEmpty}>+</Text></View>
                    );
                  })}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {save.armory.map(id => {
                    const w = getArmoryWeapon(id, weaponTiers(save));
                    if (!w) return null;
                    const selected = charms.includes(id);
                    const blocked = !selected && charmsFull;
                    const wTier = weaponUpgradeTier(save, id);
                    return (
                      <TouchableOpacity
                        key={id}
                        testID={`charm-${id}`}
                        onPress={() => {
                          setCharmTapCounts(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
                          onSelectCharm(id);
                        }}
                        style={[st.charm, { borderColor: selected ? INK : getRarityColor(w.rarity) }, selected && st.charmSel, blocked && { opacity: 0.5 }]}
                        activeOpacity={0.85}
                        accessibilityState={{ selected }}
                      >
                        <WeaponAvatar weapon={w} size={32} triggerKey={charmTapCounts[id]} />
                        <Text style={st.fighterName} numberOfLines={1}>{w.name}{weaponLevelSuffix(wTier)}</Text>
                        <Text style={st.charmDesc} numberOfLines={2}>{w.shortDescription}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {charmsFull && save.armory.length > charms.length && (
                  <Text style={st.note}>Slots full. Tap an equipped charm to swap it out.</Text>
                )}
              </>
            )}

            {/* Evolutions: which unlocked recipes the current charms arm */}
            {evolutionsOn && save.unlockedEvolutions.length > 0 && (
              <View style={st.evoBox} testID="preview-evolutions">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="lorc/crystal-shine" size={16} color={TONE.combo} />
                  <Text style={st.evoHintTitle}>
                    {armed.length > 0 ? `${armed.length} evolution${armed.length === 1 ? '' : 's'} armed` : 'No evolution armed'}
                  </Text>
                </View>
                {EVOLUTION_RECIPES.filter(r => save.unlockedEvolutions.includes(r.id)).map(r => {
                  const isArmed = armed.some(a => a.id === r.id);
                  const held = recipeFamiliesHeld(save, r);
                  return (
                    <View key={r.id} style={[st.evoRow, !isArmed && { opacity: 0.6 }]} testID={`preview-recipe-${r.id}`}>
                      <Icon name={r.icon} size={16} color={isArmed ? TONE.evoReady : INK} />
                      <View style={{ flex: 1 }}>
                        <Text style={st.evoName}>{r.name}{isArmed ? ' · ARMED' : ''}</Text>
                        <Text style={st.evoHintSub}>
                          {isArmed ? r.activeText : `Needs ${r.familyText}${held[0] || held[1] ? ' (one family equipped)' : ''}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {armed.length > 0 && (
                  <Text style={st.evoHintSub} testID="preview-evo-likelihood">
                    Catalyst chance {Math.round(loadout.evolutionLikelihood)}% per refill · up to {loadout.evolutionCap} evolutions this fight. Match the Catalyst to evolve for 20 s.
                  </Text>
                )}
              </View>
            )}

            {/* Arcana slots */}
            {gearOn && save.unlockedArcana.length > 0 && onSelectArcana && (
              <>
                <Text style={st.section}>
                  ARCANA <Text style={st.sectionHint}>{arcana.length}/{arcanaSlots(save)} · optional rule twists</Text>
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {ARCANA.filter(a => save.unlockedArcana.includes(a.id)).map(a => {
                    const selected = arcana.includes(a.id);
                    return (
                      <TouchableOpacity
                        key={a.id}
                        testID={`preview-arcana-${a.id}`}
                        onPress={() => onSelectArcana(a.id)}
                        style={[st.arcanaItem, { borderColor: selected ? INK : '#A855F7' }, selected && st.charmSel]}
                        activeOpacity={0.85}
                        accessibilityState={{ selected }}
                      >
                        <Text style={st.arcanaNum}>{a.numeral}</Text>
                        <Icon name={a.icon} size={22} color={INK} />
                        <Text style={st.fighterName} numberOfLines={1}>{a.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {arcana.length === 0 ? (
                  <Text style={st.note}>Standard rules. Tap an Arcana to bring it along.</Text>
                ) : (
                  arcana.map(id => {
                    const active = getArcana(id);
                    return (
                      <View key={id} style={st.arcanaSummary}>
                        <Text style={st.evoName}>{active.numeral} · {active.name}</Text>
                        <Text style={st.arcanaUp}>▲ {active.upside}</Text>
                        <Text style={st.arcanaDown}>▼ {active.tradeoff}</Text>
                      </View>
                    );
                  })
                )}
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
                      ? `${isFighterTrial(level) ? 'Fighter trial' : 'Elite path'}. Earn ${'★'.repeat(lock.need)} on ${lock.parentId} ${getLevel(lock.parentId).name} to open it.`
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

/** Traps the level itself places on the board. */
const Hazards: React.FC<{ hazards: LevelHazards }> = ({ hazards }) => (
  <View style={{ gap: 6 }} testID="preview-hazards">
    {hazards.timeBombs && (
      <View style={st.hazard}>
        <Icon name="lorc/time-bomb" size={20} color={INK} />
        <Text style={st.abilityText}>
          <Text style={{ fontWeight: '900' }}>Time Bombs: </Text>
          match a bomb card within {hazards.timeBombs.seconds}s or lose a heart.
        </Text>
      </View>
    )}
    {hazards.snares && (
      <View style={st.hazard}>
        <Icon name="lorc/wolf-trap" size={20} color={INK} />
        <Text style={st.abilityText}>
          <Text style={{ fontWeight: '900' }}>Snares: </Text>
          matching a snared card costs a heart. Match the card its arrow points at to defuse it for +4 damage.
        </Text>
      </View>
    )}
  </View>
);

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
  mech: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: TONE.selected },
  mechTitle: { fontSize: 16, fontWeight: '900', color: INK, marginTop: 2 },
  mechTag: { fontSize: 13, color: INK },
  rules: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1.5, borderColor: INK },
  ruleText: { fontWeight: '800', fontSize: 13, color: INK },
  ability: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFE9E7', borderRadius: 8, padding: 8, borderWidth: 1.5, borderColor: INK },
  abilityText: { flex: 1, color: INK, fontSize: 13 },
  goal: { gap: 6, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  goalDone: { backgroundColor: '#F4F1EC', borderColor: TONE.spentEdge },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalText: { flex: 1, fontWeight: '800', color: INK, fontSize: 14 },
  doneMark: { color: COLORS.logicTeal, fontWeight: '900', fontSize: 16 },
  goalRewards: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  coinChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: TONE.coinPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.coin, paddingHorizontal: 8, paddingVertical: 2 },
  coinChipText: { fontWeight: '900', color: '#7A5600', fontSize: 13 },
  unlockChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.deepOnyx, borderRadius: 999, paddingLeft: 3, paddingRight: 10, paddingVertical: 2, maxWidth: 240 },
  unlockText: { fontWeight: '800', color: COLORS.actionYellow, fontSize: 12 },
  chipDone: { backgroundColor: '#EAE5DD', borderColor: TONE.spentEdge, paddingLeft: 8 },
  section: { fontWeight: '900', letterSpacing: 2, fontSize: 12, color: INK, marginTop: 4 },
  sectionHint: { fontWeight: '600', letterSpacing: 0, fontSize: 11, opacity: 0.7 },
  note: { fontSize: 12, color: INK, opacity: 0.7 },
  fighter: { width: 92, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 2, borderColor: TONE.spentEdge, backgroundColor: COLORS.paperBeige, gap: 2 },
  fighterSel: { borderColor: INK, backgroundColor: COLORS.actionYellow, borderBottomWidth: 4 },
  fighterName: { fontSize: 11, fontWeight: '800', color: INK },
  fighterLvl: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.7 },
  rec: { position: 'absolute', top: -6, right: -4, backgroundColor: COLORS.logicTeal, borderRadius: 4, paddingHorizontal: 4, borderWidth: 1, borderColor: INK },
  recText: { fontSize: 8, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 1 },
  charm: { width: 112, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 2, backgroundColor: COLORS.paperBeige, gap: 2 },
  charmSel: { backgroundColor: COLORS.actionYellow, borderBottomWidth: 4 },
  charmDesc: { fontSize: 10, color: INK, textAlign: 'center', opacity: 0.8 },
  evoBox: { gap: 6, backgroundColor: TONE.comboPale, borderRadius: 8, borderWidth: 1.5, borderColor: TONE.combo, padding: 8 },
  evoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  evoName: { fontSize: 12, fontWeight: '900', color: INK },
  hazard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF3E0', borderRadius: 8, padding: 8, borderWidth: 1.5, borderColor: TONE.tradeoff },
  passiveBox: { gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8 },
  passiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passiveText: { flex: 1, fontSize: 12, color: INK },
  passiveIcons: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  slotRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  slot: { width: 42, height: 42, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: TONE.spentEdge, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  slotEmpty: { color: TONE.spent, fontWeight: '900', fontSize: 18 },
  evoHintTitle: { fontSize: 12, fontWeight: '900', color: INK },
  evoHintSub: { fontSize: 11, color: INK, opacity: 0.85 },
  arcanaItem: { width: 102, alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 10, borderWidth: 2, backgroundColor: COLORS.paperBeige, gap: 2 },
  arcanaNum: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: TONE.arcana },
  arcanaSummary: { backgroundColor: TONE.arcanaPale, borderRadius: 8, borderWidth: 1.5, borderColor: INK, padding: 8, gap: 2 },
  arcanaUp: { fontSize: 11, fontWeight: '800', color: TONE.upside },
  arcanaDown: { fontSize: 11, fontWeight: '700', color: TONE.tradeoff },
  footer: { padding: 14, borderTopWidth: 2, borderTopColor: INK, backgroundColor: COLORS.paperBeige },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  lockedText: { color: INK, fontWeight: '700', flexShrink: 1 },
});

export default LevelPreview;
