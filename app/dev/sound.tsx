/**
 * Sound studio (/dev/sound): hear everything the band can do.
 *
 * Start the band, then change the fight (hearts, foe, clock, streak…) and
 * listen to the music follow it. Tap a weapon to hear its voice, hold it to
 * add it to the band, tap a recipe for its evolution theme, and try every cue.
 * "Check levels" renders a scripted fight with no speakers and reports how
 * loud it gets (docs/sound-design.md).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { band, renderOffline, setMusicEnabled, setSfxOverride, unlockAudio } from '@/audio';
import { CUE_NAMES } from '@/audio/band';
import { NO_ALERTS, type FightAlerts, type FightMood } from '@/audio/director';
import { INSTRUMENT_NAMES } from '@/audio/instruments';
import { themeOf } from '@/audio/themes';
import { WEAPON_VOICES } from '@/audio/voices';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { WEAPON_ROLES, weaponRole } from '@/adventure/data/weaponRoles';
import { COLORS, RADIUS } from '@/utils/colors';

const WORLDS = ['meadow', 'woods', 'canyon', 'peaks', 'boss'];
const ALERT_KEYS: [keyof FightAlerts, string][] = [
  ['cursed', 'Cursed card'], ['potatoSoon', 'Potato about to jump'], ['fuseHot', 'Fuse burning down'],
  ['thornSoon', 'Thorn about to bite'], ['glassLow', 'Glass Sword running out'], ['bombSoon', 'Bomb close'],
];

const baseMood = (arrangement: string): FightMood => ({
  arrangement, boss: arrangement === 'boss', status: 'playing', paused: false, hearts: 4, maxHearts: 4, timeLeft: 120, timeTotal: 120,
  foeHp: 1, wave: 0, waves: 2, combo: 0, hotStreak: false, evolutions: [], evolutionEndsMs: Infinity, idleMs: 0, frozen: false,
  weapons: [], alerts: NO_ALERTS,
});

const Chip: React.FC<{ label: string; on?: boolean; onPress: () => void; onLongPress?: () => void; testID?: string }> = ({ label, on, onPress, onLongPress, testID }) => (
  <TouchableOpacity testID={testID} onPress={onPress} onLongPress={onLongPress} style={[st.chip, on && st.chipOn]} activeOpacity={0.7}>
    <Text style={[st.chipText, on && st.chipTextOn]}>{label}</Text>
  </TouchableOpacity>
);

const Row: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={st.row}>
    <Text style={st.rowTitle}>{title}</Text>
    <View style={st.wrap}>{children}</View>
  </View>
);

export default function SoundStudio() {
  const [mood, setMood] = useState<FightMood>(baseMood('meadow'));
  const [running, setRunning] = useState(false);
  const [recipeFilter, setRecipeFilter] = useState(0);
  const [report, setReport] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setMusicEnabled(true);
    setSfxOverride(true);
    return () => {
      band.stop();
      setSfxOverride(null);
    };
  }, []);
  useEffect(() => {
    if (running) band.setMood(mood);
  }, [mood, running]);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const set = (patch: Partial<FightMood>) => setMood(m => ({ ...m, ...patch }));
  const start = () => {
    unlockAudio();
    band.enterFight(mood);
    setRunning(true);
  };
  const stop = () => {
    band.stop();
    setRunning(false);
  };
  const toggleWeapon = (id: string) => set({ weapons: mood.weapons.includes(id) ? mood.weapons.filter(w => w !== id) : [...mood.weapons, id] });
  const toggleEvolution = (id: string) =>
    set({ evolutions: mood.evolutions.includes(id) ? mood.evolutions.filter(e => e !== id) : [...mood.evolutions, id], evolutionEndsMs: 30000 });

  const recipes = useMemo(() => EVOLUTION_RECIPES.slice(recipeFilter * 24, recipeFilter * 24 + 24), [recipeFilter]);
  const mix = band.currentMix;

  const check = async () => {
    setReport('Rendering…');
    const fight = { ...baseMood('meadow'), weapons: ['blast-powder', 'war-drum', 'mending-charm', 'snowball', 'greedy-chest'] };
    const buf = await renderOffline({
      sampleRate: 44100,
      channels: 2,
      script: {
        seconds: 16,
        events: [
          { at: 0, mood: fight },
          { at: 2, run: b => b.payout({ combo: 1, tier: 0 }) },
          { at: 3, mood: { ...fight, combo: 4, foeHp: 0.6 }, run: b => { b.payout({ combo: 4, tier: 2 }); b.fire('blast-powder', 2); b.cue('blast', { slot: 3 }); } },
          { at: 6, mood: { ...fight, combo: 8, foeHp: 0.15, evolutions: [EVOLUTION_RECIPES[0].id], evolutionEndsMs: 30000 } },
          { at: 9, run: b => { b.payout({ combo: 9, tier: 3, rainbow: true }); b.cue('coins', { amount: 12, slot: 4 }); b.cue('register', { slot: 9 }); } },
          { at: 12, mood: { ...fight, hearts: 1, timeLeft: 5, foeHp: 0.1 }, run: b => b.cue('hurt') },
        ],
      },
    });
    if (!buf) return setReport('No offline audio here.');
    let peak = 0;
    let sum = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
        sum += v * v;
      }
    }
    const rms = Math.sqrt(sum / (buf.length * buf.numberOfChannels));
    setReport(`Peak ${peak.toFixed(3)} · RMS ${rms.toFixed(3)} · ${buf.duration.toFixed(1)}s · ${peak < 1 ? 'no clipping' : 'CLIPS'}`);
  };

  return (
    <ScrollView style={st.root} contentContainerStyle={st.content}>
      <Text style={st.h1}>Sound studio</Text>
      <Text style={st.note}>Start the band, then change the fight and listen. Tap a weapon to hear it; hold it to add it to the band.</Text>

      <Row title="Band">
        <Chip testID="studio-start" label={running ? 'Stop' : 'Start'} on={running} onPress={running ? stop : start} />
        {WORLDS.map(w => (
          <Chip key={w} label={w} on={mood.arrangement === w} onPress={() => { set({ arrangement: w, boss: w === 'boss' }); if (running) band.play(w); }} />
        ))}
        <Chip testID="studio-check" label="Check levels" onPress={check} />
      </Row>
      {report && <Text testID="studio-report" style={st.readout}>{report}</Text>}

      <Text testID="studio-mix" style={st.readout}>
        {`${mix.mode} · lift +${mix.lift} · tempo ×${mix.tempo.toFixed(2)} · intensity ${mix.intensity.toFixed(2)} · drums ${mix.drums}`}
        {`${mix.lead ? ' · tune' : ''}${mix.arp ? ' · arp' : ''}${mix.pad ? ' · pad' : ''}${mix.counter ? ' · counter' : ''}${mix.heartbeat ? ' · HEARTBEAT' : ''}`}
        {`${mix.clock ? ` · clock ${mix.clock}` : ''}${mix.finisher ? ' · drum roll' : ''}${mix.lounge ? ' · lounge' : ''}`}
        {`\nSolo this bar: ${band.spotlight.join(', ') || 'nobody'}`}
      </Text>

      <Row title="Hearts">
        {[4, 3, 2, 1].map(h => <Chip key={h} label={`${h} of 4`} on={mood.hearts === h} onPress={() => set({ hearts: h })} />)}
        <Chip label="Hurt!" onPress={() => band.cue('hurt')} />
        <Chip label="Heal" onPress={() => band.cue('heal')} />
      </Row>
      <Row title="Foe HP">
        {[1, 0.6, 0.3, 0.15].map(h => <Chip key={h} label={`${Math.round(h * 100)}%`} on={mood.foeHp === h} onPress={() => set({ foeHp: h })} />)}
        <Chip label="Defeated" onPress={() => band.cue('foeDefeated')} />
        <Chip label="Win" onPress={() => { band.finale(true); setRunning(false); }} />
        <Chip label="Lose" onPress={() => { band.finale(false); setRunning(false); }} />
      </Row>
      <Row title="Clock">
        {[120, 18, 6].map(t => <Chip key={t} label={`${t}s left`} on={mood.timeLeft === t} onPress={() => set({ timeLeft: t })} />)}
      </Row>
      <Row title="Streak">
        {[0, 1, 2, 3, 5, 8, 12].map(c => (
          <Chip key={c} label={`${c}`} on={mood.combo === c} onPress={() => { set({ combo: c }); if (c > 0) band.payout({ combo: c, tier: 0 }); }} />
        ))}
      </Row>
      <Row title="A Set lands">
        {['tap', 'thump', 'slam', 'MEGA'].map((label, tier) => (
          <Chip key={label} label={label} onPress={() => band.payout({ combo: Math.max(1, mood.combo), tier })} />
        ))}
        <Chip label="Rainbow" onPress={() => band.payout({ combo: Math.max(1, mood.combo), tier: 2, rainbow: true })} />
        {[1, 2, 3].map(n => <Chip key={n} label={`card ${n}`} onPress={() => band.select(n)} />)}
      </Row>
      <Row title="State">
        <Chip label="Paused" on={mood.paused} onPress={() => set({ paused: !mood.paused })} />
        <Chip label="Level-up pick" on={mood.status === 'pick'} onPress={() => set({ status: mood.status === 'pick' ? 'playing' : 'pick' })} />
        <Chip label="Shop" on={mood.status === 'intermission'} onPress={() => set({ status: mood.status === 'intermission' ? 'playing' : 'intermission' })} />
        <Chip label="Frozen" on={mood.frozen} onPress={() => set({ frozen: !mood.frozen })} />
        <Chip label="Idle 15s" on={mood.idleMs > 0} onPress={() => set({ idleMs: mood.idleMs > 0 ? 0 : 15000 })} />
        <Chip label="Hot Streak" on={mood.hotStreak} onPress={() => set({ hotStreak: !mood.hotStreak })} />
        <Chip label="Wave 2" on={mood.wave === 1} onPress={() => set({ wave: mood.wave === 1 ? 0 : 1 })} />
      </Row>
      <Row title="On the board">
        {ALERT_KEYS.map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            on={Boolean(mood.alerts[key])}
            onPress={() => set({ alerts: { ...mood.alerts, [key]: typeof mood.alerts[key] === 'number' ? (mood.alerts[key] ? 0 : 1) : !mood.alerts[key] } })}
          />
        ))}
      </Row>

      <Text style={st.h2}>Weapons ({Object.keys(WEAPON_VOICES).length} voices)</Text>
      {WEAPON_ROLES.map(role => (
        <Row key={role.id} title={role.label}>
          {Object.keys(WEAPON_VOICES).filter(id => weaponRole(id) === role.id).map(id => (
            <Chip
              key={id}
              testID={`studio-weapon-${id}`}
              label={`${id} · ${INSTRUMENT_NAMES[WEAPON_VOICES[id].inst]}`}
              on={mood.weapons.includes(id)}
              onPress={() => (mood.weapons.includes(id) && running ? band.fire(id) : band.audition(id))}
              onLongPress={() => toggleWeapon(id)}
            />
          ))}
        </Row>
      ))}

      <Text style={st.h2}>Evolutions ({EVOLUTION_RECIPES.length} themes)</Text>
      <Row title="Page">
        {Array.from({ length: Math.ceil(EVOLUTION_RECIPES.length / 24) }, (_, i) => (
          <Chip key={i} label={`${i * 24 + 1}–${Math.min(EVOLUTION_RECIPES.length, i * 24 + 24)}`} on={recipeFilter === i} onPress={() => setRecipeFilter(i)} />
        ))}
      </Row>
      <Row title="Tap: fanfare · hold: make it live">
        {recipes.map(r => {
          const t = themeOf(r.id);
          return (
            <Chip
              key={r.id}
              testID={`studio-recipe-${r.id}`}
              label={`${r.name} · +${t.lift} ${t.groove}`}
              on={mood.evolutions.includes(r.id)}
              onPress={() => band.auditionEvolution(r.id)}
              onLongPress={() => toggleEvolution(r.id)}
            />
          );
        })}
      </Row>

      <Text style={st.h2}>Cues ({CUE_NAMES.length})</Text>
      <View style={st.wrap}>
        {CUE_NAMES.map(name => <Chip key={name} testID={`studio-cue-${name}`} label={name} onPress={() => band.cue(name, { amount: 6 })} />)}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paperBeige },
  content: { padding: 16, paddingBottom: 80, gap: 10, maxWidth: 900, alignSelf: 'center', width: '100%' },
  h1: { fontSize: 24, fontWeight: '800', color: COLORS.slateCharcoal },
  h2: { fontSize: 17, fontWeight: '800', color: COLORS.slateCharcoal, marginTop: 14 },
  note: { fontSize: 13, color: COLORS.slateCharcoal, opacity: 0.75 },
  row: { gap: 6 },
  rowTitle: { fontSize: 12, fontWeight: '700', color: COLORS.slateCharcoal, opacity: 0.7, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.button, borderWidth: 1, borderColor: COLORS.slateCharcoal, backgroundColor: COLORS.canvasWhite },
  chipOn: { backgroundColor: COLORS.slateCharcoal },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateCharcoal },
  chipTextOn: { color: COLORS.canvasWhite },
  readout: { fontSize: 12, fontFamily: 'monospace', color: COLORS.slateCharcoal, backgroundColor: COLORS.canvasWhite, padding: 8, borderRadius: RADIUS.button },
});
