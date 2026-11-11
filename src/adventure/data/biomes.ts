import type { BiomeDef, BiomeId } from '../types';

export const BIOMES: BiomeDef[] = [
  {
    id: 'meadow',
    name: 'Sunny Meadow',
    subtitle: 'Learn the ropes',
    starGate: 0,
    colors: { sky: '#E8F6E3', ground: '#B9E2A6', path: '#FFFFFF', accent: '#16AA98', ink: '#2F5D3A' },
    music: 'meadow',
    decor: ['lorc/flowers', 'lorc/clover', 'lorc/flowers'],
  },
  {
    id: 'woods',
    name: 'Whispering Woods',
    subtitle: 'Foes with tricks',
    starGate: 12,
    colors: { sky: '#DCEBDD', ground: '#7FB38A', path: '#F4EFEA', accent: '#2E7D4F', ink: '#1E3B27' },
    music: 'woods',
    decor: ['lorc/cobweb', 'delapouite/bamboo', 'lorc/feather'],
  },
  {
    id: 'canyon',
    name: 'Ember Canyon',
    subtitle: 'Waves, shops & shading',
    starGate: 28,
    colors: { sky: '#FBE6D2', ground: '#E9A86F', path: '#FFF4E8', accent: '#FF7A2F', ink: '#5C2E12' },
    music: 'canyon',
    decor: ['lorc/campfire', 'delapouite/stone-pile', 'lorc/fireball'],
  },
  {
    id: 'peaks',
    name: 'Frozen Peaks',
    subtitle: 'All five traits',
    starGate: 46,
    colors: { sky: '#E3EEF8', ground: '#A8C8E6', path: '#FFFFFF', accent: '#3B82F6', ink: '#1D3557' },
    music: 'peaks',
    decor: ['lorc/snowflake-1', 'lorc/crystal-shine', 'lorc/snowflake-1'],
  },
];

export const getBiome = (id: BiomeId): BiomeDef => {
  const b = BIOMES.find(x => x.id === id);
  if (!b) throw new Error(`Unknown biome ${id}`);
  return b;
};
