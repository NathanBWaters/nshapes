/**
 * Sound studio (/dev/sound): hear and measure everything the band can do ([AU-16]).
 *
 * Start the band, switch Monitor Mode (Flat Stereo / Phone Sim 300-5 kHz Mono /
 * Low Vol -12 dB), audition all 10 arrangements, 6 fighter voices, biome ambience,
 * Kill-Cam 3-beat arc, 64 weapon voices, 192 per-weapon evolution themes, and every cue.
 * "Check levels" renders a scripted fight offline and reports stereo peak,
 * mono-sum peak, broadband RMS, and 300-5000 Hz phone-band RMS.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ambience,
  band,
  FIGHTER_VOICE_IDS,
  renderOffline,
  setMusicEnabled,
  setSfxOverride,
  unlockAudio,
  type AmbienceBiome,
  type FighterCallKind,
} from '@/audio';
import { CUE_NAMES } from '@/audio/band';
import { chip, type MonitorMode } from '@/audio/chip';
import { NO_ALERTS, type FightAlerts, type FightMood } from '@/audio/director';
import { INSTRUMENT_NAMES } from '@/audio/instruments';
import { themeOf } from '@/audio/themes';
import { WEAPON_VOICES } from '@/audio/voices';
import { WEAPON_EVOLUTIONS, evolutionsForWeapon } from '@/adventure/data/evolutions';
import { WEAPON_ROLES, weaponRole, type WeaponRole } from '@/adventure/data/weaponRoles';
import { useAppActive } from '@/hooks/useAppActive';
import { COLORS, RADIUS } from '@/utils/colors';
import { registerInterval } from '@/utils/perfWatchdog';

const WORLDS = ['title', 'story', 'map', 'camp', 'meadow', 'woods', 'canyon', 'peaks', 'summit', 'boss'];
const AMBIENCE_BIOMES: AmbienceBiome[] = ['meadow', 'woods', 'camp', 'canyon', 'peaks', 'summit'];
const MONITOR_MODES: [MonitorMode, string][] = [
  ['flat', 'Flat Stereo'],
  ['phone', 'Phone Sim 300–5kHz Mono'],
  ['lowVol', 'Low Vol -12 dB'],
];
const CALL_KINDS: FighterCallKind[] = ['signature', 'cheer', 'hurt'];

const ALERT_KEYS: [keyof FightAlerts, string][] = [
  ['bombSoon', 'Bomb close'],
  ['fuseHot', 'Fuse burning down'],
  ['potatoSoon', 'Potato about to jump'],
  ['thornSoon', 'Thorn about to bite'],
  ['glassLow', 'Glass Sword running out'],
  ['cursed', 'Cursed card'],
];

const baseMood = (arrangement: string): FightMood => ({
  arrangement,
  boss: arrangement === 'boss',
  status: 'playing',
  paused: false,
  hearts: 4,
  maxHearts: 4,
  timeLeft: 120,
  timeTotal: 120,
  foeHp: 1,
  wave: 0,
  waves: 2,
  combo: 0,
  hotStreak: false,
  evolutions: [],
  evolutionEndsMs: Infinity,
  idleMs: 0,
  frozen: false,
  weapons: [],
  alerts: NO_ALERTS,
});

const toDb = (lin: number): string => (lin <= 1e-6 ? '-inf' : (20 * Math.log10(lin)).toFixed(1));

/** 2nd-order digital biquad filter (RBJ Audio EQ Cookbook) for offline 300-5000 Hz phone-band RMS analysis. */
const biquadFilter = (input: Float32Array, sr: number, type: 'highpass' | 'lowpass', freq: number, q = 0.707): Float32Array => {
  const out = new Float32Array(input.length);
  const w0 = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  if (type === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
  } else {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
};

const Chip: React.FC<{ label: string; on?: boolean; onPress: () => void; onLongPress?: () => void; testID?: string }> = ({
  label,
  on,
  onPress,
  onLongPress,
  testID,
}) => (
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
  const appActive = useAppActive();
  const [mood, setMood] = useState<FightMood>(baseMood('meadow'));
  const [running, setRunning] = useState(false);
  const [monitorMode, setMonitorModeState] = useState<MonitorMode>('flat');
  const [activeAmbience, setActiveAmbience] = useState<AmbienceBiome | null>(null);
  const [fighterKind, setFighterKind] = useState<FighterCallKind>('signature');
  const [evoRoleFilter, setEvoRoleFilter] = useState<WeaponRole | 'all'>('damage');
  const [report, setReport] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setMusicEnabled(true);
    setSfxOverride(true);
    return () => {
      chip.setMonitorMode('flat');
      band.stop();
      setSfxOverride(null);
    };
  }, []);

  useEffect(() => {
    if (running) band.setMood(mood);
  }, [mood, running]);

  useEffect(() => {
    if (!appActive) return;
    const stopTrack = registerInterval('SoundStudio.poll');
    const id = setInterval(() => tick(n => n + 1), 250);
    return () => {
      clearInterval(id);
      stopTrack();
    };
  }, [appActive]);

  const set = (patch: Partial<FightMood>) => setMood(m => ({ ...m, ...patch }));
  const start = () => {
    unlockAudio();
    const isBattle = !['title', 'story', 'map', 'camp'].includes(mood.arrangement);
    if (isBattle) band.enterFight(mood);
    else band.play(mood.arrangement);
    setRunning(true);
  };
  const stop = () => {
    band.stop();
    setActiveAmbience(null);
    setRunning(false);
  };
  const setMonitor = (mode: MonitorMode) => {
    unlockAudio();
    chip.setMonitorMode(mode);
    setMonitorModeState(mode);
  };
  const toggleAmbience = (biome: AmbienceBiome | null) => {
    unlockAudio();
    if (!biome || activeAmbience === biome) {
      ambience.stop();
      setActiveAmbience(null);
    } else {
      ambience.setBiome(biome);
      setActiveAmbience(biome);
    }
  };
  const toggleWeapon = (id: string) =>
    set({ weapons: mood.weapons.includes(id) ? mood.weapons.filter(w => w !== id) : [...mood.weapons, id] });
  const toggleEvolution = (id: string) =>
    set({
      evolutions: mood.evolutions.includes(id) ? mood.evolutions.filter(e => e !== id) : [...mood.evolutions, id],
      evolutionEndsMs: 30000,
    });

  const evoWeapons = useMemo(() => {
    const allIds = Object.keys(WEAPON_VOICES).filter(id => evolutionsForWeapon(id).length > 0);
    return evoRoleFilter === 'all' ? allIds : allIds.filter(id => weaponRole(id) === evoRoleFilter);
  }, [evoRoleFilter]);
  const mix = band.currentMix;
  const diag = chip.getDiagnostics();

  const check = async () => {
    setReport('Rendering stereo + mono-sum + 300-5kHz phone-band check…');
    const firstEvoId = WEAPON_EVOLUTIONS[0].id;
    const fight = { ...baseMood('summit'), weapons: ['blast-powder', 'war-drum', 'mending-charm', 'snowball', 'greedy-chest'] };
    const buf = await renderOffline({
      sampleRate: 44100,
      channels: 2,
      script: {
        seconds: 16,
        events: [
          { at: 0, mood: fight },
          { at: 2, run: b => b.payout({ combo: 1, tier: 0 }) },
          {
            at: 3,
            mood: { ...fight, combo: 4, foeHp: 0.6 },
            run: b => {
              b.payout({ combo: 4, tier: 2 });
              b.fire('blast-powder', 2);
              b.cue('blast', { slot: 3 });
              b.cue('evoAlmost', { slot: 4 });
            },
          },
          { at: 6, mood: { ...fight, combo: 8, foeHp: 0.15, evolutions: [firstEvoId], evolutionEndsMs: 20000 }, run: b => b.playCutInEvolve(firstEvoId) },
          {
            at: 9,
            run: b => {
              b.payout({ combo: 9, tier: 3, rainbow: true });
              b.cue('coins', { amount: 12, slot: 4 });
              b.cue('register', { slot: 9 });
            },
          },
          { at: 12, mood: { ...fight, hearts: 1, timeLeft: 5, foeHp: 0.1 }, run: b => b.cue('hurt') },
          { at: 14, run: b => { b.playKillCamRiser(); b.playKillCamShatter(280); } },
        ],
      },
    });
    if (!buf) return setReport('No offline audio here.');
    const ch0 = buf.getChannelData(0);
    const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
    const mono = new Float32Array(buf.length);
    let stereoPeak = 0;
    let monoPeak = 0;
    let sumSq = 0;
    for (let i = 0; i < buf.length; i++) {
      const l = ch0[i];
      const r = ch1[i];
      const absMax = Math.max(Math.abs(l), Math.abs(r));
      if (absMax > stereoPeak) stereoPeak = absMax;
      sumSq += l * l + r * r;
      const m = 0.5 * (l + r);
      mono[i] = m;
      const am = Math.abs(m);
      if (am > monoPeak) monoPeak = am;
    }
    const rms = Math.sqrt(sumSq / (buf.length * 2));
    const phoneBand = biquadFilter(biquadFilter(mono, buf.sampleRate, 'highpass', 300), buf.sampleRate, 'lowpass', 5000);
    let phoneSum = 0;
    for (let i = 0; i < phoneBand.length; i++) phoneSum += phoneBand[i] * phoneBand[i];
    const phoneRms = Math.sqrt(phoneSum / Math.max(1, phoneBand.length));
    const clipState = stereoPeak < 1 && monoPeak < 1 ? 'no clipping' : 'CLIPS';
    setReport(
      `Stereo Peak ${stereoPeak.toFixed(3)} (${toDb(stereoPeak)} dB) · Mono Peak ${monoPeak.toFixed(3)} (${toDb(monoPeak)} dB)\n` +
        `Broadband RMS ${rms.toFixed(3)} (${toDb(rms)} dB) · Phone 300-5kHz RMS ${phoneRms.toFixed(3)} (${toDb(phoneRms)} dB) · ${buf.duration.toFixed(1)}s · ${clipState}`
    );
  };

  return (
    <ScrollView style={st.root} contentContainerStyle={st.content}>
      <Text style={st.h1}>Sound studio</Text>
      <Text style={st.note}>Start the band, toggle Monitor Mode (Phone Sim / Low Vol), test fighters & Kill-Cam, and verify levels.</Text>

      <Row title="Band">
        <Chip testID="studio-start" label={running ? 'Stop' : 'Start'} on={running} onPress={running ? stop : start} />
        {WORLDS.map(w => (
          <Chip
            key={w}
            label={w}
            on={mood.arrangement === w}
            onPress={() => {
              set({ arrangement: w, boss: w === 'boss' });
              if (running) band.play(w);
            }}
          />
        ))}
        <Chip testID="studio-check" label="Check levels" onPress={check} />
      </Row>

      <Row title="Monitor Mode (Audition EQ & Mono Fold-Down)">
        {MONITOR_MODES.map(([mode, label]) => (
          <Chip key={mode} testID={`studio-monitor-${mode}`} label={label} on={monitorMode === mode} onPress={() => setMonitor(mode)} />
        ))}
      </Row>

      <Row title="Biome Ambience (-20 dB Bed)">
        <Chip label="Off" on={activeAmbience === null} onPress={() => toggleAmbience(null)} />
        {AMBIENCE_BIOMES.map(b => (
          <Chip key={b} label={b} on={activeAmbience === b} onPress={() => toggleAmbience(b)} />
        ))}
      </Row>

      {report && <Text testID="studio-report" style={st.readout}>{report}</Text>}

      <Text testID="studio-diagnostics" style={st.readout}>
        {`Voices: ${diag.activeVoices}/${diag.maxVoices} · Stolen: ${diag.stolenVoices} · Monitor: ${diag.monitorMode} · Live RMS ${toDb(diag.rms)} dB / Peak ${toDb(diag.peak)} dB`}
        {`\nTiers — S:${diag.tiers.S.count}${diag.tiers.S.recent ? '*' : ''}  A:${diag.tiers.A.count}${diag.tiers.A.recent ? '*' : ''}  B:${diag.tiers.B.count}${diag.tiers.B.recent ? '*' : ''}  C:${diag.tiers.C.count}${diag.tiers.C.recent ? '*' : ''}`}
      </Text>

      <Text testID="studio-mix" style={st.readout}>
        {`${mix.mode} (lead: ${mix.leadMode}) · lift +${mix.lift} · tempo ×${mix.tempo.toFixed(2)} · intensity ${mix.intensity.toFixed(2)} · drums ${mix.drums}`}
        {`${mix.lead ? ` · tune (${mix.leadGain.toFixed(2)})` : ''}${mix.arp ? ' · arp' : ''}${mix.pad ? ' · pad' : ''}${mix.counter ? ' · counter' : ''}${mix.heartbeat ? ' · HEARTBEAT' : ''}`}
        {`${mix.clock ? ` · clock ${mix.clock}` : ''}${mix.finisher ? ' · drum roll' : ''}${mix.lounge ? ' · lounge' : ''}`}
        {`\nSolo this bar: ${band.spotlight.join(', ') || 'nobody'}`}
      </Text>

      <Row title="Kill-Cam & Mount-Synced Cut-Ins">
        <Chip
          label="Kill-Cam Riser"
          onPress={() => {
            unlockAudio();
            band.playKillCamRiser();
          }}
        />
        <Chip
          label="Kill-Cam Shatter"
          onPress={() => {
            unlockAudio();
            band.playKillCamShatter();
          }}
        />
        <Chip
          label="Kill-Cam 3-Beat Arc"
          onPress={() => {
            unlockAudio();
            band.playKillCamRiser();
            setTimeout(() => band.slowMoDefeat({ boss: true }), 260);
            setTimeout(() => band.playKillCamShatter(), 308);
          }}
        />
        <Chip
          label="Cut-In Evolve (90ms)"
          onPress={() => {
            unlockAudio();
            band.playCutInEvolve(WEAPON_EVOLUTIONS[0].id);
          }}
        />
        <Chip
          label="Evo Almost (Tier A)"
          onPress={() => {
            unlockAudio();
            band.cue('evoAlmost');
          }}
        />
        <Chip
          label="Evo Progress (Tier C)"
          onPress={() => {
            unlockAudio();
            band.cue('evoProgress', { amount: 0.66 });
          }}
        />
        <Chip
          label="Evo Charge (Tier B)"
          onPress={() => {
            unlockAudio();
            band.cue('evoCharge');
          }}
        />
        <Chip
          label="Evo End (Tier C)"
          onPress={() => {
            unlockAudio();
            band.cue('evoEnd');
          }}
        />
        <Chip
          label="Arcana Gain (Tier B)"
          onPress={() => {
            unlockAudio();
            band.cue('arcanaGain');
          }}
        />
        <Chip
          label="WeaponPick ReelStop (3x)"
          onPress={() => {
            unlockAudio();
            band.playWeaponPickReelStop();
          }}
        />
      </Row>

      <Row title="Fighters (6 voices)">
        {CALL_KINDS.map(kind => (
          <Chip key={kind} label={`kind: ${kind}`} on={fighterKind === kind} onPress={() => setFighterKind(kind)} />
        ))}
        {FIGHTER_VOICE_IDS.map(f => (
          <Chip
            key={f}
            testID={`studio-fighter-${f}`}
            label={f}
            onPress={() => {
              unlockAudio();
              band.fighterCall(f, fighterKind, { bypassCooldown: true });
            }}
          />
        ))}
      </Row>

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
        <Chip label="Idle 25s" on={mood.idleMs > 0} onPress={() => set({ idleMs: mood.idleMs > 0 ? 0 : 25000 })} />
        <Chip label="Hot Streak" on={mood.hotStreak} onPress={() => set({ hotStreak: !mood.hotStreak })} />
        <Chip label="Wave 2" on={mood.wave === 1} onPress={() => set({ wave: mood.wave === 1 ? 0 : 1 })} />
      </Row>
      <Row title="On the board (Top 2 Lethality Cap)">
        {ALERT_KEYS.map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            on={Boolean(mood.alerts[key])}
            onPress={() =>
              set({
                alerts: {
                  ...mood.alerts,
                  [key]: typeof mood.alerts[key] === 'number' ? (mood.alerts[key] ? 0 : 1) : !mood.alerts[key],
                },
              })
            }
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

      <Text style={st.h2}>Evolutions ({WEAPON_EVOLUTIONS.length} themes · 64 weapons × 3)</Text>
      <Row title="Filter by weapon role">
        <Chip label="All (64)" on={evoRoleFilter === 'all'} onPress={() => setEvoRoleFilter('all')} />
        {WEAPON_ROLES.map(role => (
          <Chip
            key={role.id}
            label={role.label}
            on={evoRoleFilter === role.id}
            onPress={() => setEvoRoleFilter(role.id)}
          />
        ))}
      </Row>
      <Text style={st.note}>Tap A / B / C to audition weapon-anchored fanfare · long-press to make it live in the band.</Text>
      {evoWeapons.map(weaponId => {
        const evos = evolutionsForWeapon(weaponId);
        const voice = WEAPON_VOICES[weaponId];
        return (
          <Row
            key={weaponId}
            title={`${weaponId} · ${voice ? INSTRUMENT_NAMES[voice.inst] : 'synth'}`}
          >
            {evos.map(evo => {
              const t = themeOf(evo.id);
              const slotLabel = ['A', 'B', 'C'][evo.slotIndex];
              return (
                <Chip
                  key={evo.id}
                  testID={`studio-evo-${evo.id}`}
                  label={`${slotLabel}: ${evo.name} · +${t.lift} ${t.groove} (${INSTRUMENT_NAMES[t.insts[1]]})`}
                  on={mood.evolutions.includes(evo.id)}
                  onPress={() => {
                    unlockAudio();
                    band.auditionEvolution(evo.id);
                  }}
                  onLongPress={() => toggleEvolution(evo.id)}
                />
              );
            })}
          </Row>
        );
      })}

      <Text style={st.h2}>Cues ({CUE_NAMES.length})</Text>
      <View style={st.wrap}>
        {CUE_NAMES.map(name => (
          <Chip key={name} testID={`studio-cue-${name}`} label={name} onPress={() => band.cue(name, { amount: 6 })} />
        ))}
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
