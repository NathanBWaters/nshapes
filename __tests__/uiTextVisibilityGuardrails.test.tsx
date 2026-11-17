import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CompanionBubble from '@/adventure/components/CompanionBubble';
import AdventureMap from '@/adventure/components/AdventureMap';
import { createNewSave } from '@/adventure/progress';

const mockKvStore = new Map<string, string>();
jest.mock('@/utils/storage', () => ({
  storage: {
    getString: (k: string) => mockKvStore.get(k),
    set: (k: string, v: string) => mockKvStore.set(k, v),
    remove: (k: string) => mockKvStore.delete(k),
  },
}));

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : () => undefined) });
  return { sfx: () => undefined, music: band, band, setMusicEnabled: () => undefined, setSfxOverride: () => undefined };
});

jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID, character }: { testID?: string; character: string }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `fighter-avatar-${character}` }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `enemy-avatar-${enemy?.name ?? 'foe'}` }),
  };
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: any) => ReactActual.createElement(View, props, props?.children);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy(
    { __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, any>,
    {
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
        return target[prop];
      },
    }
  );
});

const INSETS = {
  frame: { x: 0, y: 0, width: 375, height: 667 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function collectNodes(node: any, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;
  out.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectNodes(child, out);
  }
  return out;
}

describe('UI Text Visibility Style-Contract Guardrails', () => {
  it('enforces shrinkable row wrapping contracts on CompanionBubble (static & clickable)', () => {
    const longMsg =
      "Meow! Tap Dozy Bunny (1-1) to begin! I'll teach you the Magic Rule of Set right on the board!";
    const pills = [
      { attr: 'color' as const, status: 'pass' as const, label: 'Color: all red' },
      { attr: 'shape' as const, status: 'fail' as const, label: 'Shape: 2 diamonds + 1 oval' },
    ];

    for (const clickable of [false, true]) {
      const screen = render(
        <CompanionBubble
          testID="bubble"
          character="Orange Tabby"
          badge="Magic Rule"
          title="The Magic Rule of Set"
          text={longMsg}
          pills={pills}
          onPress={clickable ? () => {} : undefined}
        />
      );

      const root = screen.getByTestId('bubble');
      const rootStyle = StyleSheet.flatten(root.props.style);
      expect(rootStyle.flexDirection).toBe('row');
      expect(rootStyle.width).toBe('100%');
      expect(rootStyle.maxWidth).toBe('100%');
      expect(rootStyle.flexShrink).toBe(1);
      expect(rootStyle.minWidth).toBe(0);

      const tree = screen.toJSON();
      const nodes = collectNodes(tree);

      // Inner speech bubble container must allow shrinking below max-content width
      const bubbleNode = nodes.find(
        n => n.type === 'View' && StyleSheet.flatten(n.props?.style)?.borderRadius === 12
      );
      expect(bubbleNode).toBeTruthy();
      const bubbleStyle = StyleSheet.flatten(bubbleNode.props.style);
      expect(bubbleStyle.flex).toBe(1);
      expect(bubbleStyle.flexShrink).toBe(1);
      expect(bubbleStyle.minWidth).toBe(0);
      expect(bubbleStyle.maxWidth).toBe('100%');

      // Every Text node (speaker, title, body text, pills) must have flexShrink: 1 (or >0)
      const textNodes = nodes.filter(n => n.type === 'Text');
      expect(textNodes.length).toBeGreaterThanOrEqual(5);
      for (const tn of textNodes) {
        const ts = StyleSheet.flatten(tn.props?.style) ?? {};
        // badgeText sits inside a wrap-safe pill whose wrapper itself has flexShrink: 1 + maxWidth: 100%,
        // whereas multi-word header/body/pill texts must explicitly carry flexShrink: 1
        if (ts.fontSize !== 9) {
          expect(ts.flexShrink).toBeGreaterThan(0);
        }
      }

      screen.unmount();
    }
  });

  it('keeps AdventureMap guide banner in a bounded container so CompanionBubble wraps cleanly', () => {
    const save = createNewSave();
    const screen = render(
      <SafeAreaProvider initialMetrics={INSETS}>
        <AdventureMap
          save={save}
          onSelectLevel={() => {}}
          onOpenCamp={() => {}}
          onOpenGuide={() => {}}
          onExit={() => {}}
        />
      </SafeAreaProvider>
    );

    const bannerBubble = screen.getByTestId('map-guide-banner');
    const bannerStyle = StyleSheet.flatten(bannerBubble.props.style);
    expect(bannerStyle.width).toBe('100%');
    expect(bannerStyle.maxWidth).toBe('100%');
    expect(bannerStyle.flexShrink).toBe(1);
    expect(bannerStyle.minWidth).toBe(0);
    screen.unmount();
  });
});
