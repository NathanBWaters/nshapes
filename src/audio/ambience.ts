/**
 * Low-priority procedural biome ambience bed ([AU-20]).
 *
 * Sakurai Ep. #202 ("Balancing Ambient Sound"):
 *   - Sits at the lowest priority (-20 dB base via chip.ambienceBus, ducked -12 dB under Tier S/A SFX).
 *   - Eliminates sterile digital vacuum silence on screens & when Music is muted alone.
 *   - Zero per-frame JS allocations / zero setInterval loops: runs on looped Web Audio
 *     buffers inside chip's single AudioContext gateway.
 *   - Suspends/stops cleanly on app background (appLifecycle.ts) or when BOTH Music & SFX are OFF.
 */
import { getIsAppActive, subscribeAppActive } from '@/utils/appLifecycle';
import { chip } from './chip';
import { audioFlags } from './settings';

export type AmbienceBiome =
  | 'meadow'
  | 'woods'
  | 'camp'
  | 'canyon'
  | 'peaks'
  | 'summit'
  | 'boss'
  | 'title'
  | 'story'
  | 'map';

export type AmbienceKind = 'meadowAir' | 'woodlandBreeze' | 'campfire' | 'mountainWind';

export interface AmbienceSpec {
  kind: AmbienceKind;
  label: string;
  filterType: BiquadFilterType;
  filterHz: number;
  filterQ: number;
  lfoHz: number;
  lfoDepth: number;
  gain: number;
  crackle?: boolean;
}

export const AMBIENCE_PROFILES: Record<AmbienceKind, AmbienceSpec> = {
  meadowAir: {
    kind: 'meadowAir',
    label: 'Meadow Rustle',
    filterType: 'bandpass',
    filterHz: 620,
    filterQ: 0.9,
    lfoHz: 0.16,
    lfoDepth: 0.22,
    gain: 0.72,
  },
  woodlandBreeze: {
    kind: 'woodlandBreeze',
    label: 'Woodland Breeze',
    filterType: 'bandpass',
    filterHz: 460,
    filterQ: 1.4,
    lfoHz: 0.12,
    lfoDepth: 0.3,
    gain: 0.78,
  },
  campfire: {
    kind: 'campfire',
    label: 'Campfire Crackle',
    filterType: 'lowpass',
    filterHz: 320,
    filterQ: 0.7,
    lfoHz: 0.24,
    lfoDepth: 0.18,
    gain: 0.7,
    crackle: true,
  },
  mountainWind: {
    kind: 'mountainWind',
    label: 'High-Altitude Wind',
    filterType: 'bandpass',
    filterHz: 940,
    filterQ: 2.1,
    lfoHz: 0.21,
    lfoDepth: 0.34,
    gain: 0.68,
  },
};

export const biomeToAmbienceKind = (biome: string): AmbienceKind => {
  switch (biome) {
    case 'woods':
    case 'story':
      return 'woodlandBreeze';
    case 'camp':
    case 'canyon':
      return 'campfire';
    case 'peaks':
    case 'summit':
    case 'boss':
      return 'mountainWind';
    case 'meadow':
    case 'map':
    case 'title':
    default:
      return 'meadowAir';
  }
};

interface ActiveBed {
  ctx: BaseAudioContext;
  kind: AmbienceKind;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

class BiomeAmbience {
  private requestedBiome: AmbienceBiome | null = null;
  private active: ActiveBed | null = null;
  private pinkCache = new WeakMap<BaseAudioContext, AudioBuffer>();
  private crackleCache = new WeakMap<BaseAudioContext, AudioBuffer>();

  constructor() {
    subscribeAppActive((isActive) => {
      if (!isActive) {
        this.teardown();
      } else {
        this.sync();
      }
    });
  }

  get biome(): AmbienceBiome | null {
    return this.requestedBiome;
  }

  get isPlaying(): boolean {
    return this.active !== null;
  }

  get activeKind(): AmbienceKind | null {
    return this.active?.kind ?? null;
  }

  /** Set the desired biome ambient bed (starts immediately when audio & app are active). */
  setBiome(biome: AmbienceBiome | string | null): void {
    if (!biome) {
      this.stop();
      return;
    }
    const normalized = (
      ['meadow', 'woods', 'camp', 'canyon', 'peaks', 'summit', 'boss', 'title', 'story', 'map'].includes(biome)
        ? biome
        : 'meadow'
    ) as AmbienceBiome;
    this.requestedBiome = normalized;
    this.sync();
  }

  /** Stop and clear the ambient bed. */
  stop(): void {
    this.requestedBiome = null;
    this.teardown();
  }

  /**
   * Re-evaluate whether ambience should run:
   * - Stops whenever app is backgrounded OR BOTH music & sfx are OFF.
   * - Stays alive as a quiet organic bed if Music is OFF while SFX is ON!
   */
  sync(): void {
    if (!this.requestedBiome || !getIsAppActive() || (!audioFlags.music && !audioFlags.sfx)) {
      this.teardown();
      return;
    }
    if (!chip.ctx || !chip.ambienceBus) return;
    // Never start continuous looping ambient beds during offline bounce renders
    if (chip.liveContext && chip.ctx !== chip.liveContext) return;
    const kind = biomeToAmbienceKind(this.requestedBiome);
    if (this.active && this.active.ctx === chip.ctx && this.active.kind === kind) return;
    this.teardown();
    this.startBed(chip.ctx, chip.ambienceBus, kind);
  }

  private getPinkBuffer(ctx: BaseAudioContext): AudioBuffer {
    const hit = this.pinkCache.get(ctx);
    if (hit) return hit;
    const len = Math.max(1024, Math.floor(ctx.sampleRate * 3));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 0x1a2b3c4d;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x80000000 - 1;
    };
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = rand();
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.14;
    }
    // Crossfade loop seam (last 256 samples blended toward start) so looping is click-free
    const seam = Math.min(256, Math.floor(len / 8));
    for (let i = 0; i < seam; i++) {
      const k = i / seam;
      data[len - seam + i] = data[len - seam + i] * (1 - k) + data[i] * k;
    }
    this.pinkCache.set(ctx, buf);
    return buf;
  }

  private getCrackleBuffer(ctx: BaseAudioContext): AudioBuffer {
    const hit = this.crackleCache.get(ctx);
    if (hit) return hit;
    const len = Math.max(1024, Math.floor(ctx.sampleRate * 4));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 0x9e3779b9;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    // Bake sparse short ember pops right into the looped buffer (zero JS timers!)
    const pops = 26;
    for (let p = 0; p < pops; p++) {
      const start = Math.floor(rand() * Math.max(1, len - 240));
      const popLen = 30 + Math.floor(rand() * 90);
      const amp = 0.25 + rand() * 0.55;
      for (let j = 0; j < popLen && start + j < len; j++) {
        const env = Math.pow(1 - j / popLen, 2.5);
        data[start + j] += (rand() * 2 - 1) * amp * env;
      }
    }
    this.crackleCache.set(ctx, buf);
    return buf;
  }

  private startBed(ctx: BaseAudioContext, dest: GainNode, kind: AmbienceKind) {
    const spec = AMBIENCE_PROFILES[kind];
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    try {
      const bed = ctx.createBufferSource();
      bed.buffer = this.getPinkBuffer(ctx);
      bed.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = spec.filterType;
      filter.frequency.value = spec.filterHz;
      filter.Q.value = spec.filterQ;

      const outGain = ctx.createGain();
      outGain.gain.value = spec.gain;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = spec.lfoHz;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = spec.gain * spec.lfoDepth;
      lfo.connect(lfoDepth).connect(outGain.gain);

      bed.connect(filter).connect(outGain).connect(dest);
      bed.start(ctx.currentTime);
      lfo.start(ctx.currentTime);
      sources.push(bed, lfo);
      nodes.push(bed, filter, outGain, lfo, lfoDepth);

      if (spec.crackle) {
        const crackleSrc = ctx.createBufferSource();
        crackleSrc.buffer = this.getCrackleBuffer(ctx);
        crackleSrc.loop = true;
        const crackleFilter = ctx.createBiquadFilter();
        crackleFilter.type = 'bandpass';
        crackleFilter.frequency.value = 2800;
        crackleFilter.Q.value = 1.6;
        const crackleGain = ctx.createGain();
        crackleGain.gain.value = 0.45;
        crackleSrc.connect(crackleFilter).connect(crackleGain).connect(dest);
        crackleSrc.start(ctx.currentTime);
        sources.push(crackleSrc);
        nodes.push(crackleSrc, crackleFilter, crackleGain);
      }

      this.active = { ctx, kind, sources, nodes };
    } catch {
      this.teardown();
    }
  }

  private teardown() {
    if (!this.active) return;
    const { sources, nodes } = this.active;
    this.active = null;
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const n of nodes) {
      try {
        if (typeof (n as { disconnect?: () => void }).disconnect === 'function') {
          (n as { disconnect: () => void }).disconnect();
        }
      } catch {
        /* ignore */
      }
    }
  }
}

export const ambience = new BiomeAmbience();
