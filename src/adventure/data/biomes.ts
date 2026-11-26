import type { BiomeDef, BiomeId } from '../types';

export const BIOMES: BiomeDef[] = [
  {
    id: 'meadow',
    name: 'Sunny Meadow',
    subtitle: 'Where the first shards fell',
    starGate: 0,
    colors: { sky: '#E8F6E3', ground: '#B9E2A6', path: '#FFFFFF', accent: '#16AA98', ink: '#2F5D3A' },
    music: 'meadow',
    decor: ['lorc/flowers', 'lorc/clover', 'delapouite/sunflower'],
    skyIcon: { icon: 'lorc/sun', color: '#F5B800' },
  },
  {
    id: 'woods',
    name: 'Whispering Woods',
    subtitle: 'Foes with tricks, and traps',
    starGate: 10,
    colors: { sky: '#DCEBDD', ground: '#7FB38A', path: '#F4EFEA', accent: '#2E7D4F', ink: '#1E3B27' },
    music: 'woods',
    decor: ['lorc/pine-tree', 'delapouite/bamboo', 'lorc/cobweb'],
    skyIcon: { icon: 'lorc/fluffy-cloud', color: '#FFFFFF' },
  },
  {
    id: 'canyon',
    name: 'Ember Canyon',
    subtitle: 'Waves, shops & shading surges',
    starGate: 24,
    colors: { sky: '#FBE6D2', ground: '#E9A86F', path: '#FFF4E8', accent: '#FF7A2F', ink: '#5C2E12' },
    music: 'canyon',
    decor: ['lorc/campfire', 'delapouite/stone-pile', 'lorc/fireball'],
    skyIcon: { icon: 'lorc/sun', color: '#FF7A2F' },
  },
  {
    id: 'peaks',
    name: 'Frozen Peaks',
    subtitle: 'Ride the surge, stacked builds',
    starGate: 46,
    colors: { sky: '#E3EEF8', ground: '#A8C8E6', path: '#FFFFFF', accent: '#3B82F6', ink: '#1D3557' },
    music: 'peaks',
    decor: ['lorc/snowflake-1', 'lorc/pine-tree', 'lorc/crystal-shine'],
    skyIcon: { icon: 'lorc/fluffy-cloud', color: '#FFFFFF' },
  },
  {
    id: 'summit',
    name: 'Starfall Summit',
    subtitle: 'Everything, all at once',
    starGate: 76,
    colors: { sky: '#E7E0F7', ground: '#A99BD6', path: '#FFF9E8', accent: '#F5B82E', ink: '#2A1D57' },
    music: 'summit',
    decor: ['lorc/mountaintop', 'delapouite/falling-star', 'lorc/comet-spark'],
    skyIcon: { icon: 'delapouite/falling-star', color: '#F5B82E' },
  },
];

export const getBiome = (id: BiomeId): BiomeDef => {
  const b = BIOMES.find(x => x.id === id);
  if (!b) throw new Error(`Unknown biome ${id}`);
  return b;
};

/** "World 2" style number of a region, in map order. */
export const worldNumber = (id: BiomeId): number => BIOMES.findIndex(b => b.id === id) + 1;
