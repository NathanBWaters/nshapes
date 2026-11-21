import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CompanionBubble from '@/adventure/components/CompanionBubble';
import AdventureMap from '@/adventure/components/AdventureMap';
import AdventureRun from '@/adventure/components/AdventureRun';
import { compactRoleBonusLabel, GearChips, gearModifiers, hasGearChips } from '@/adventure/components/GearChips';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getLevel } from '@/adventure/data/levels';
import { activeRoleBonuses } from '@/adventure/data/weaponRoles';
import { createRun } from '@/adventure/engine/run';
import { createMaxedSave, createNewSave } from '@/adventure/progress';
import Card, { CardBoardProvider } from '@/components/Card';
import type { Card as CardType } from '@/types';

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
      { attr: 'color' as const, status: 'pass' as const, label: 'Color: all red', detail: 'Color: all red', brief: 'Color: all red' },
      { attr: 'shape' as const, status: 'fail' as const, label: 'Shape: 2 diamonds + 1 oval', detail: 'Shape: 2 diamonds + 1 oval', brief: 'Shape: 2 diamonds + 1 oval' },
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

  it('renders crisp countdown badges on all 5 timed Gambles without bogus text when clock is null', () => {
    const baseCard: CardType = {
      id: 'c1',
      shape: 'oval',
      color: 'red',
      number: 1,
      shading: 'solid',
      selected: false,
    };

    // 1. Thorn Bush (lethal bite countdown + urgent red at <= 5s)
    const thornView = render(
      <CardBoardProvider overlay={{}} clockMs={11000}>
        <Card card={{ ...baseCard, id: 'thorn-1', thornAt: 15000 }} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(thornView.getByTestId('card-timer-thorn')).toBeTruthy();
    expect(thornView.getByText('4s')).toBeTruthy();
    thornView.unmount();

    // 2. Long Fuse (normal countdown -> hot sweet-spot countdown with !)
    const fuseView = render(
      <CardBoardProvider overlay={{}} clockMs={9000}>
        <Card card={{ ...baseCard, id: 'fuse-1', fuseAt: 20000, fuseHot: false }} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(fuseView.getByTestId('card-timer-fuse')).toBeTruthy();
    expect(fuseView.getByText('11s')).toBeTruthy();
    fuseView.rerender(
      <CardBoardProvider overlay={{}} clockMs={17000}>
        <Card card={{ ...baseCard, id: 'fuse-1', fuseAt: 20000, fuseHot: true }} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(fuseView.getByText('3s!')).toBeTruthy();
    fuseView.unmount();

    // 3. Cursed Idol (lock timer)
    const curseView = render(
      <CardBoardProvider overlay={{}} clockMs={3000}>
        <Card card={{ ...baseCard, id: 'curse-1', locked: true, cursedUntil: 10000 }} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(curseView.getByTestId('card-timer-curse')).toBeTruthy();
    expect(curseView.getByText('7s')).toBeTruthy();
    curseView.unmount();

    // 4. Fog Lantern (face-down flip timer)
    const fogView = render(
      <CardBoardProvider overlay={{}} clockMs={2000}>
        <Card card={{ ...baseCard, id: 'fog-1', isFaceDown: true, fogFlipAt: 8000 }} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(fogView.getByTestId('card-timer-fog')).toBeTruthy();
    expect(fogView.getByText('6s')).toBeTruthy();
    fogView.unmount();

    // 5. Hot Potato (jump timer from board overlay potatoAtMs)
    const potatoView = render(
      <CardBoardProvider overlay={{ potatoAtMs: 12000 }} clockMs={4000}>
        <Card card={{ ...baseCard, id: 'potato-1', hot: true }} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(potatoView.getByTestId('card-timer-potato')).toBeTruthy();
    expect(potatoView.getByText('8s')).toBeTruthy();
    potatoView.unmount();

    // Static / replay context (clockMs = null): no bogus NaN or 0s countdown
    const staticFog = render(
      <CardBoardProvider overlay={{}} clockMs={null}>
        <Card card={{ ...baseCard, id: 'fog-static', isFaceDown: true, fogFlipAt: 8000 }} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(staticFog.queryByTestId('card-timer-fog')).toBeNull();
    staticFog.unmount();
  });

  it('highlights Mirror Shard and Tightrope slots and previews Catalyst target Evolution on Card', () => {
    const baseCard: CardType = {
      id: 'slot-card',
      shape: 'diamond',
      color: 'purple',
      number: 2,
      shading: 'solid',
      selected: false,
    };

    const view = render(
      <CardBoardProvider
        overlay={{
          mirrorCardIds: new Set(['slot-card']),
          tightropeCardIds: new Set(['slot-card']),
          catalystRecipeName: 'Wildfire Echo',
        }}
        clockMs={null}
      >
        <Card card={{ ...baseCard, hasEvolutionItem: true, evolutionReady: true }} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(view.getByTestId('card-mirror-frame')).toBeTruthy();
    expect(view.getByTestId('card-slot-mirror')).toBeTruthy();
    expect(view.getByTestId('card-tightrope-frame')).toBeTruthy();
    expect(view.getByTestId('card-slot-tightrope')).toBeTruthy();
    expect(view.getByTestId('card-catalyst-name')).toHaveTextContent('Wildfire Echo');
    view.unmount();

    // Non-highlighted card shows neither slot indicator
    const plain = render(
      <CardBoardProvider
        overlay={{ mirrorCardIds: new Set(['other']), tightropeCardIds: new Set(['other']) }}
        clockMs={null}
      >
        <Card card={baseCard} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(plain.queryByTestId('card-slot-mirror')).toBeNull();
    expect(plain.queryByTestId('card-slot-tightrope')).toBeNull();
    plain.unmount();
  });

  it('displays compact Brotato 2/4/6 Role Set Bonus pills in GearChips and full thresholds + counter alert in WeaponExplainer', () => {
    const save = {
      ...createNewSave(),
      armory: ['thorn-bush', 'long-fuse', 'blast-powder', 'flint-spark'],
      charms: ['thorn-bush', 'long-fuse', 'blast-powder', 'flint-spark'],
      upgrades: { charm_belt: 1 },
    };
    const run = createRun(getLevel('2-3'), save, { seed: 7, features: new Set(['hearts', 'gear']) });
    const mods = gearModifiers(run);
    expect(hasGearChips(mods, run.weapons)).toBe(true);

    const bonuses = activeRoleBonuses(run.weapons);
    expect(bonuses.map(compactRoleBonusLabel)).toEqual(
      expect.arrayContaining(['2× Gambles +15%', '2× Damage +1'])
    );

    const chips = render(<GearChips run={run} mods={mods} />);
    const gamblesChip = chips.getByTestId('run-role-bonus-gambles');
    const damageChip = chips.getByTestId('run-role-bonus-damage');
    expect(gamblesChip).toBeTruthy();
    expect(damageChip).toBeTruthy();
    expect(chips.getByText('2× Gambles +15%')).toBeTruthy();
    expect(chips.getByText('2× Damage +1')).toBeTruthy();
    expect(StyleSheet.flatten(gamblesChip.props.style).maxWidth).toBe('100%');
    chips.unmount();

    // Canonical single WeaponExplainer shows 2×/4×/6× Role Set Bonus tiers & active counter alert
    const flint = getArmoryWeapon('flint-spark')!;
    const explainer = render(
      <WeaponExplainer
        weapon={flint}
        heldWeapons={run.weapons}
        counter={{
          type: 'fire',
          label: 'Fire Spread',
          stat: 'fireSpreadChance',
          baseChance: 18,
          effectiveChance: 6,
          reduction: 15,
        }}
        defaultOpen
      />
    );
    expect(explainer.getByTestId('weapon-explainer-role-bonus-flint-spark')).toBeTruthy();
    expect(explainer.getByTestId('weapon-explainer-role-tier-flint-spark-2')).toBeTruthy();
    expect(explainer.getByTestId('weapon-explainer-role-tier-flint-spark-4')).toBeTruthy();
    expect(explainer.getByTestId('weapon-explainer-role-tier-flint-spark-6')).toBeTruthy();
    expect(explainer.getByTestId('weapon-explainer-counter-flint-spark')).toHaveTextContent(/−15%.*18%.*6%/);
    explainer.unmount();
  });

  it('wires Role Set Bonus chips, enemy counter badges, and Next-Evolution preview inside AdventureRun', () => {
    const maxed = createMaxedSave();
    const save = {
      ...createNewSave(),
      seenMechanics: maxed.seenMechanics,
      seenCoachMarks: maxed.seenCoachMarks,
      armory: ['flint-spark', 'blast-powder', 'mending-charm'],
      charms: ['flint-spark', 'blast-powder', 'mending-charm'],
      unlockedEvolutions: ['wildfire'],
    };
    const level = getLevel('3-5P'); // Wet Crab (counters Fire!)
    const view = render(
      <SafeAreaProvider initialMetrics={INSETS}>
        <AdventureRun
          level={level}
          save={save}
          seed={42}
          effects={false}
          onFinish={() => {}}
          onQuit={() => {}}
          onRestart={() => {}}
          onCoachMarkSeen={() => {}}
        />
      </SafeAreaProvider>
    );
    expect(view.getByTestId('run-role-bonus-damage')).toBeTruthy();
    expect(view.getByTestId('belt-counter-flint-spark')).toBeTruthy();
    expect(view.queryByTestId('belt-counter-blast-powder')).toBeNull();
    expect(view.getByTestId('run-evo-chip')).toHaveTextContent(/Next: .+|CATALYST: .+/);
    view.unmount();
  });
});
