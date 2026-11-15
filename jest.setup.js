// Jest setup file

// Mock react-native-mmkv globally so transitive storage imports work without native NitroModules
jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  const createStore = (id = 'default') => {
    let mem = stores.get(id);
    if (!mem) {
      mem = new Map();
      stores.set(id, mem);
    }
    return {
      set: (key, value) => {
        mem.set(key, value);
      },
      getString: (key) => {
        const v = mem.get(key);
        return typeof v === 'string' ? v : undefined;
      },
      getNumber: (key) => {
        const v = mem.get(key);
        return typeof v === 'number' ? v : undefined;
      },
      getBoolean: (key) => {
        const v = mem.get(key);
        return typeof v === 'boolean' ? v : undefined;
      },
      contains: (key) => mem.has(key),
      remove: (key) => mem.delete(key),
      delete: (key) => {
        mem.delete(key);
      },
      getAllKeys: () => Array.from(mem.keys()),
      clearAll: () => {
        mem.clear();
      },
    };
  };
  const createMMKV = (config) => createStore(config?.id);
  function MMKV(config) {
    return createStore(config?.id);
  }
  return {
    __esModule: true,
    createMMKV,
    MMKV,
  };
});

// Mock react-native-svg for testing
jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    Svg: 'Svg',
    Circle: 'Circle',
    Ellipse: 'Ellipse',
    G: 'G',
    Text: 'Text',
    TSpan: 'TSpan',
    TextPath: 'TextPath',
    Path: 'Path',
    Polygon: 'Polygon',
    Polyline: 'Polyline',
    Line: 'Line',
    Rect: 'Rect',
    Use: 'Use',
    Image: 'Image',
    Symbol: 'Symbol',
    Defs: 'Defs',
    Pattern: 'Pattern',
    LinearGradient: 'LinearGradient',
    RadialGradient: 'RadialGradient',
    Stop: 'Stop',
    ClipPath: 'ClipPath',
    Mask: 'Mask',
  };
});

// Mock sounds module to avoid .ogg file import issues
jest.mock('@/utils/sounds', () => ({
  playSound: jest.fn(),
  preloadSound: jest.fn(),
  preloadAllSounds: jest.fn(),
  setAudioEnabled: jest.fn(),
  isAudioEnabled: jest.fn(() => true),
  initAudio: jest.fn(),
  playCardDealing: jest.fn(),
  playSelect: jest.fn(),
}));

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
