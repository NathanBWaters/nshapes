/**
 * Effects studio (/dev/fx): watch everything the fight can show.
 *
 * A quiet stand-in fight screen (a foe, a fighter, the HUD chips, a weapon
 * belt and twelve cards) with a button for every kind of fight event, a
 * sample cascade, and the evolution cut-in. Slow motion lets one effect be
 * read frame by frame. Nothing here plays the game: the buttons hand the
 * stage the same events the engine would (docs/fx-design.md).
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import type { Card as CardType } from '@/types';
import { COLORS } from '@/utils/colors';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { PASSIVES } from '@/adventure/data/passives';
import type { EvolutionRecipe, RunEvent, RunEventType } from '@/adventure/types';
import { Anchor, AnchorsProvider, EVENT_FX, EvolutionCutIn, FxStage, GearBelt, fxClock, scriptFor, useAnchors, useFightFx } from '@/adventure/fx';

const INK = COLORS.slateCharcoal;
const WEAPON_IDS = ['blast-powder', 'prismatic-ray', 'chaos-shard', 'flint-spark', 'mending-charm', 'fortunes-favor', 'connector', 'echo-stone'];
const SPEEDS = [1, 4, 10];

const SHAPES = ['diamond', 'oval', 'squiggle'] as const;
const CARD_COLORS = ['red', 'green', 'purple'] as const;
const SHADINGS = ['solid', 'striped', 'open'] as const;
const BOARD: CardType[] = Array.from({ length: 12 }, (_, i) => ({
  id: `studio-${i}`,
  shape: SHAPES[i % 3],
  color: CARD_COLORS[Math.floor(i / 3) % 3],
  number: ((i % 3) + 1) as CardType['number'],
  shading: SHADINGS[(i + Math.floor(i / 3)) % 3],
  selected: false,
}));

/** Which cards a sample of each event plays on, and the rule that "caused" it (so its weapon jumps on the belt) */
const SAMPLE: Partial<Record<RunEventType, Partial<RunEvent>>> = {
  hit: { amount: 7, slots: [0, 4, 8] },
  rainbow: { amount: 14, slots: [0, 4, 8] },
  blast: { amount: 6, text: '2', slots: [3, 7], source: 'w0:blast-powder#0' },
  laser: { amount: 8, text: '3', slots: [3, 4, 5], source: 'w1:prismatic-ray#0' },
  ricochet: { amount: 3, text: '3', slots: [1, 6, 11], source: 'w2:chaos-shard#0' },
  link_burst: { text: '2', slots: [2, 9] },
  echo: { text: '3', slots: [2, 5, 10] },
  fire: { amount: 2, slots: [5, 9] },
  pinata: { amount: 12, slots: [7] },
  pinata_break: { amount: 12, slots: [7] },
  grow: { amount: 1, slots: [11] },
  link: { amount: 1, slots: [0, 10] },
  fetch: { amount: 2, slots: [2, 6] },
  keen_eye: { slots: [4] },
  catalyst_spawn: { slots: [4] },
  evolution_start: { slots: [4] },
  trap_placed: { text: 'snare', slots: [6] },
  trap_defused: { amount: 4, text: 'snare', slots: [6] },
  trap_sprung: { amount: 1, text: 'bomb', slots: [6] },
  dud: { slots: [1] },
  face_down: { slots: [10] },
  bomb: { slots: [8] },
  countdown: { slots: [8] },
  attr_shift: { slots: [3, 4] },
  card_removed: { slots: [11] },
  heal: { amount: 1, source: 'w4:mending-charm#0' },
  coins: { amount: 5 },
  time_gain: { amount: 3 },
  hint: { amount: 1 },
  hurt: { amount: 1 },
  regen: { amount: 4 },
  wave: { amount: 2 },
  combo: { amount: 4 },
  hot_streak_hit: { amount: 2 },
  grudge: { amount: 2 },
  grudge_release: { amount: 6 },
  patience: { amount: 3 },
  rule: { amount: 4, text: 'Mirror!' },
  charged: { amount: 2 },
  empowered: { amount: 1 },
  simplified: { text: 'color' },
  purity: { amount: 2 },
  purity_max: { amount: 3 },
  overkill: { amount: 9 },
  evolution_end: { text: 'Phoenix Pyre' },
};

/** Events that remove cards show the card that was there */
const REMOVES: ReadonlySet<RunEventType> = new Set(['blast', 'laser', 'ricochet', 'link_burst', 'trap_sprung']);

let nextId = 1;
const sampleEvent = (type: RunEventType): RunEvent => {
  const s = SAMPLE[type] ?? {};
  return { id: nextId++, type, ...s, ...(s.slots && REMOVES.has(type) ? { cards: s.slots.map(i => BOARD[i]) } : {}) };
};

const CASCADE: RunEventType[] = ['hit', 'blast', 'coins', 'laser', 'heal', 'ricochet', 'fire', 'time_gain'];

const Chip: React.FC<{ label: string; on?: boolean; onPress: () => void; testID?: string }> = ({ label, on, onPress, testID }) => (
  <TouchableOpacity testID={testID} onPress={onPress} style={[st.chip, on && st.chipOn]} activeOpacity={0.7}>
    <Text style={[st.chipText, on && st.chipTextOn]}>{label}</Text>
  </TouchableOpacity>
);

export default function FxStudio() {
  const anchors = useAnchors();
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [speed, setSpeed] = useState(1);
  const [reduced, setReduced] = useState(false);
  const fx = useFightFx({ anchors, reduced });
  const weapons = useMemo(() => WEAPON_IDS.map(id => getArmoryWeapon(id)).filter((w): w is NonNullable<typeof w> => !!w), []);
  const recipes = EVOLUTION_RECIPES.slice(0, 2);

  const play = (types: RunEventType[]) => fx.play(scriptFor(types.map(sampleEvent), { weapons, reduced }));
  const evolve = (list: EvolutionRecipe[]) =>
    fx.play(scriptFor(list.map(r => ({ ...sampleEvent('evolution_start'), text: r.name })), { weapons, reduced }));
  const changeSpeed = (s: number) => {
    fxClock.slow = s;
    setSpeed(s);
  };

  return (
    <AnchorsProvider value={anchors}>
      <View style={st.page}>
        <View style={st.fight} onLayout={e => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <View ref={anchors.rootRef} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
          <View style={st.hud}>
            <View style={st.row}>
              <Anchor name="foe">
                <View style={st.portrait}><EnemyAvatar enemy={{ name: 'Sparring Dummy', icon: 'lorc/daemon-skull', tier: 1 }} size={44} lightweight /></View>
              </Anchor>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.name}>Effects studio</Text>
                <View style={st.hp}><View style={st.hpFill} /></View>
                <Anchor name="combo" style={{ alignSelf: 'flex-start' }}><Text style={st.small}>COMBO ×4</Text></Anchor>
              </View>
              <Anchor name="fighter"><FighterAvatar character="Orange Tabby" size={44} framed /></Anchor>
            </View>
            <View style={[st.row, { flexWrap: 'wrap', gap: 6 }]}>
              <Anchor name="hearts"><View style={st.stat}><Text style={st.statText}>♥ 3/4</Text></View></Anchor>
              <Anchor name="clock">
                <View style={[st.stat, fx.busy && st.statHeld]} testID="studio-clock">
                  <Icon name="lorc/stopwatch" size={14} color={fx.busy ? COLORS.logicTeal : INK} />
                  <Text style={st.statText}>{fx.busy ? 'held' : '60s'}</Text>
                </View>
              </Anchor>
              <Anchor name="graces"><View style={st.stat}><Icon name="lorc/clover" size={14} color={COLORS.logicTeal} /><Text style={st.statText}>2</Text></View></Anchor>
              <View style={{ flex: 1 }} />
              <Anchor name="coins"><View style={st.stat}><Icon name="lorc/crown-coin" size={14} color="#E0A800" /><Text style={st.statText}>120</Text></View></Anchor>
              <Anchor name="hint"><View style={[st.stat, { backgroundColor: COLORS.actionYellow }]}><Icon name="lorc/light-bulb" size={14} color={INK} /><Text style={st.statText}>3</Text></View></Anchor>
            </View>
            <View style={[st.row, { flexWrap: 'wrap', gap: 4 }]}>
              {Object.values(PASSIVES).map(p => (
                <Anchor key={p.id} name={`passive:${p.id}`}><View style={st.passive}><Icon name={p.icon} size={13} color={INK} /></View></Anchor>
              ))}
              <Anchor name={`evo:${recipes[0].id}`}><View style={[st.passive, { backgroundColor: '#E9D5FF' }]}><Icon name={recipes[0].icon} size={13} color={INK} /></View></Anchor>
            </View>
            <Anchor name="xp"><View style={st.xp} /></Anchor>
            <GearBelt weapons={weapons} width={stage.w} onInspect={() => {}} />
          </View>

          <View ref={anchors.ref('board')} collapsable={false} style={st.board}>
            {[0, 1, 2, 3].map(r => (
              <View key={r} style={st.cardRow}>
                {[0, 1, 2].map(c => {
                  const i = r * 3 + c;
                  return (
                    <View key={i} ref={anchors.ref(`slot:${i}`)} collapsable={false} onLayout={anchors.measure} style={st.slot}>
                      <Card card={BOARD[i]} onClick={() => {}} disabled />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <FxStage fx={fx} anchors={anchors} size={stage} />
          {fx.cutIn && (
            <EvolutionCutIn
              key={fx.cutIn.key}
              recipes={fx.cutIn.recipes.map(id => EVOLUTION_RECIPES.find(r => r.id === id)).filter((r): r is EvolutionRecipe => !!r)}
              weapons={weapons}
              seconds={30}
              size={stage}
              onDone={fx.dismissCutIn}
            />
          )}
          {fx.banner && <View style={st.banner}><Text style={st.bannerText}>Effects off: a small banner would show here.</Text></View>}
        </View>

        <ScrollView style={st.controls} contentContainerStyle={st.controlsBody}>
          <View style={st.wrap}>
            <Text style={st.heading}>Speed</Text>
            {SPEEDS.map(s => <Chip key={s} label={s === 1 ? 'Real time' : `${s}× slower`} on={speed === s} onPress={() => changeSpeed(s)} testID={`fx-speed-${s}`} />)}
            <Chip label={reduced ? 'Effects off' : 'Effects on'} on={!reduced} onPress={() => setReduced(r => !r)} testID="fx-reduced" />
          </View>
          <View style={st.wrap}>
            <Text style={st.heading}>Play</Text>
            <Chip label="A Set and what it sets off" onPress={() => play(CASCADE)} testID="fx-cascade" />
            <Chip label="Evolution" onPress={() => evolve(recipes.slice(0, 1))} testID="fx-evolution" />
            <Chip label="Two evolutions at once" onPress={() => evolve(recipes)} testID="fx-evolution-2" />
          </View>
          <View style={st.wrap}>
            <Text style={st.heading}>Every event</Text>
            {(Object.keys(EVENT_FX) as RunEventType[]).map(type => (
              <Chip key={type} label={EVENT_FX[type] ? type : `${type} (nothing)`} onPress={() => play([type])} testID={`fx-event-${type}`} />
            ))}
          </View>
        </ScrollView>
      </View>
    </AnchorsProvider>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.paperBeige, alignItems: 'center' },
  fight: { width: '100%', maxWidth: 480, backgroundColor: '#E8F3E4' },
  hud: { backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK, padding: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  portrait: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvasWhite },
  name: { fontWeight: '900', fontSize: 15, color: INK },
  small: { fontSize: 11, fontWeight: '900', color: COLORS.impactOrange },
  hp: { height: 16, borderRadius: 4, borderWidth: 2, borderColor: INK, backgroundColor: '#F1E9E0', overflow: 'hidden' },
  hpFill: { width: '70%', height: '100%', backgroundColor: COLORS.impactRed },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  statHeld: { backgroundColor: '#D4F4EE', borderColor: COLORS.logicTeal },
  statText: { fontWeight: '900', color: INK, fontSize: 13 },
  passive: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  xp: { height: 10, borderRadius: 3, borderWidth: 1.5, borderColor: INK, backgroundColor: '#7AC8FF' },
  board: { paddingVertical: 8, paddingHorizontal: 44, gap: 6 },
  cardRow: { flexDirection: 'row', gap: 6 },
  slot: { flex: 1, aspectRatio: 0.95 },
  banner: { position: 'absolute', left: 0, right: 0, top: 60, backgroundColor: INK, padding: 8 },
  bannerText: { color: COLORS.canvasWhite, textAlign: 'center', fontWeight: '700' },
  controls: { width: '100%', maxWidth: 480, flex: 1 },
  controlsBody: { padding: 10, gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  heading: { width: '100%', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: INK, opacity: 0.7, textTransform: 'uppercase' },
  chip: { borderWidth: 2, borderColor: INK, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: COLORS.canvasWhite },
  chipOn: { backgroundColor: COLORS.actionYellow },
  chipText: { fontSize: 12, fontWeight: '800', color: INK },
  chipTextOn: { color: INK },
});
