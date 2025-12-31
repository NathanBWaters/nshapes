// Jest setup file

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

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
