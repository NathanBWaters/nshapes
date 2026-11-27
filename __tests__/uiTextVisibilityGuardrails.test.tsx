import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CompanionBubble from '@/adventure/components/CompanionBubble';
import AdventureMap from '@/adventure/components/AdventureMap';
import AdventureRun from '@/adventure/components/AdventureRun';
import BountyBoard from '@/adventure/components/BountyBoard';
import Camp from '@/adventure/components/Camp';
import DamageSourceExplainer from '@/adventure/components/DamageSourceExplainer';
import FieldGuide from '@/adventure/components/FieldGuide';
import { GearChips, gearModifiers, hasGearChips } from '@/adventure/components/GearChips';
import SkillTree from '@/adventure/components/SkillTree';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { evolutionsForWeapon } from '@/adventure/data/evolutions';
import { getLevel } from '@/adventure/data/levels';
import { createRun } from '@/adventure/engine/run';
import { createMaxedSave, createNewSave } from '@/adventure/progress';
import Card, { CardBoardProvider } from '@/components/Card';
import RoundFunPrompt from '@/components/RoundFunPrompt';
import SpireHeader from '@/spire/components/SpireHeader';
import SpireSetup from '@/spire/components/SpireSetup';
import SpireSwapPicker from '@/spire/components/SpireSwapPicker';
import { createSpireRun } from '@/spire/engine/runState';
import { createInitialSpireMeta } from '@/spire/save';
import { NEGATIVE_FUN_TAGS } from '@/analytics/fightEvent';
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

  it('highlights Mirror Shard, Tightrope, Holo sheen/badge, and Marked badge on Card without Catalyst copy', () => {
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
        }}
        clockMs={null}
      >
        <Card card={{ ...baseCard, holo: true, marked: true }} onClick={() => {}} />
      </CardBoardProvider>
    );
    expect(view.getByTestId('card-mirror-frame')).toBeTruthy();
    expect(view.getByTestId('card-slot-mirror')).toBeTruthy();
    expect(view.getByTestId('card-tightrope-frame')).toBeTruthy();
    expect(view.getByTestId('card-slot-tightrope')).toBeTruthy();
    expect(view.getByTestId('card-holo-sheen')).toBeTruthy();
    expect(view.getByTestId('card-holo-badge')).toBeTruthy();
    expect(view.getByTestId('card-marked-badge')).toBeTruthy();
    view.unmount();

    // Non-highlighted card shows none of these overlays
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
    expect(plain.queryByTestId('card-holo-badge')).toBeNull();
    expect(plain.queryByTestId('card-marked-badge')).toBeNull();
    plain.unmount();
  });

  it('displays live Trick chips in GearChips without Role Set pills and shows counter alert in WeaponExplainer', () => {
    const save = {
      ...createNewSave(),
      armory: ['bounty-poster', 'snowball', 'blast-powder', 'flint-spark'],
      charms: ['bounty-poster', 'snowball', 'blast-powder', 'flint-spark'],
      upgrades: { charm_belt: 1 },
    };
    const run = createRun(getLevel('2-3'), save, { seed: 7, features: new Set(['hearts', 'gear']) });
    const mods = gearModifiers(run);
    expect(hasGearChips(mods)).toBe(true);

    const chips = render(<GearChips run={run} mods={mods} />);
    const bountyChip = chips.getByTestId('run-bounty-chip');
    expect(bountyChip).toBeTruthy();
    expect(chips.queryByTestId('run-role-bonus-damage')).toBeNull();
    expect(StyleSheet.flatten(bountyChip.props.style).maxWidth).toBe('100%');
    chips.unmount();

    // Canonical single WeaponExplainer shows active counter alert without Role Set tiers
    const flint = getArmoryWeapon('flint-spark')!;
    const explainer = render(
      <WeaponExplainer
        weapon={flint}
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
    expect(explainer.queryByTestId('weapon-explainer-role-bonus-flint-spark')).toBeNull();
    expect(explainer.getByTestId('weapon-explainer-counter-flint-spark')).toHaveTextContent(/−15%.*18%.*6%/);
    explainer.unmount();
  });

  it('wires enemy counter badges and per-weapon evolution rails inside AdventureRun without Role Set or PowerMeter chips', () => {
    const maxed = createMaxedSave();
    const [flintEvoA] = evolutionsForWeapon('flint-spark');
    const [blastEvoA] = evolutionsForWeapon('blast-powder');
    const multiSave = {
      ...createNewSave(),
      seenMechanics: maxed.seenMechanics,
      seenCoachMarks: maxed.seenCoachMarks,
      armory: ['flint-spark', 'blast-powder', 'mending-charm'],
      charms: ['flint-spark', 'blast-powder', 'mending-charm'],
      unlockedWeaponEvolutions: [flintEvoA.id, blastEvoA.id],
      equippedEvolutions: { 'flint-spark': flintEvoA.id, 'blast-powder': blastEvoA.id },
    };
    const level = getLevel('3-5P'); // Wet Crab (counters Fire!)
    const view = render(
      <SafeAreaProvider initialMetrics={INSETS}>
        <AdventureRun
          level={level}
          save={multiSave}
          seed={42}
          effects={false}
          onFinish={() => {}}
          onQuit={() => {}}
          onRestart={() => {}}
          onCoachMarkSeen={() => {}}
        />
      </SafeAreaProvider>
    );
    expect(view.queryByTestId('run-role-bonus-damage')).toBeNull();
    expect(view.getByTestId('belt-counter-flint-spark')).toBeTruthy();
    expect(view.queryByTestId('belt-counter-blast-powder')).toBeNull();
    expect(view.getByTestId('belt-evo-rail-flint-spark')).toBeTruthy();
    expect(view.getByTestId('belt-evo-rail-blast-powder')).toBeTruthy();
    view.unmount();
  });

  it('enforces 375px-safe width, shrinkable clamped text, and zero Spire/Catalyst copy on WeaponExplainer 1-of-3 Evolution selector', () => {
    const flint = getArmoryWeapon('flint-spark')!;
    const [evoA, evoB] = evolutionsForWeapon('flint-spark');
    const onSelectEvolution = jest.fn();
    const view = render(
      <WeaponExplainer
        weapon={flint}
        defaultOpen
        evolutionMode="select"
        showEvolutionsWhenClosed
        equippedEvolutionId={evoA.id}
        unlockedEvolutionIds={[evoA.id, evoB.id]}
        beltSynergyIds={new Set(['burn'])}
        onSelectEvolution={onSelectEvolution}
        onJumpToBounty={() => {}}
      />
    );

    expect(view.getByTestId('weapon-explainer-evo-selector-flint-spark')).toBeTruthy();

    // Every clamped Text node inside WeaponExplainer carries flexShrink > 0 so it never clips off 375px screens
    const nodes = collectNodes(view.toJSON());
    for (const n of nodes) {
      if (n.type === 'Text' && n.props?.numberOfLines) {
        const ts = StyleSheet.flatten(n.props?.style) ?? {};
        expect(ts.flexShrink).toBeGreaterThan(0);
      }
    }

    const allText = nodes
      .filter(n => n.type === 'Text')
      .map(n => (Array.isArray(n.children) ? n.children.join('') : String(n.children ?? '')))
      .join(' ');
    expect(allText).not.toMatch(/spire|\bcatalyst\b/i);

    fireEvent.press(view.getByTestId(`evo-option-${evoB.id}`));
    expect(onSelectEvolution).toHaveBeenCalledWith('flint-spark', evoB.id);
    view.unmount();
  });

  it('enforces shrinkable row wrapping layout contracts on DamageSourceExplainer', () => {
    const [evo] = evolutionsForWeapon('blast-powder');
    const sourceId = `evo:${evo.id}`;
    const view = render(
      <DamageSourceExplainer
        sourceId={sourceId}
        accentColor="#16AA98"
        badge="MVP"
        result={{ text: '240 cumulative dmg (48%) · 6 hits · biggest spike +72.', share: 0.48 }}
        defaultOpen
      />
    );

    const card = view.getByTestId(`damage-source-explainer-${sourceId}`);
    const cardStyle = StyleSheet.flatten(card.props.style);
    expect(cardStyle.width).toBe('100%');
    expect(cardStyle.maxWidth).toBe('100%');

    const whatNode = view.getByTestId(`damage-source-what-${sourceId}`);
    expect(StyleSheet.flatten(whatNode.props.style).flexShrink).toBeGreaterThan(0);

    // Check every row Text node with numberOfLines carries flexShrink: 1 so it never clips
    const nodes = collectNodes(view.toJSON());
    for (const n of nodes) {
      if (n.type === 'Text' && n.props?.numberOfLines) {
        const ts = StyleSheet.flatten(n.props?.style) ?? {};
        expect(ts.flexShrink).toBeGreaterThan(0);
      }
    }

    view.unmount();
  });

  it('wraps all 6 negative feedback tag chips cleanly in RoundFunPrompt (default & compact, 375px safe)', () => {
    for (const compact of [false, true]) {
      const view = render(
        <RoundFunPrompt
          rating="down"
          tags={['too_easy', 'bug_in_game']}
          onChange={() => {}}
          compact={compact}
          testIDPrefix="guard-fun"
        />
      );

      const boxStyle = StyleSheet.flatten(view.getByTestId('guard-fun-prompt').props.style);
      expect(boxStyle.alignSelf).toBe('stretch');
      expect(boxStyle.maxWidth).toBe('100%');
      expect(boxStyle.minWidth).toBe(0);

      const wrapStyle = StyleSheet.flatten(view.getByTestId('guard-fun-tags').props.style);
      expect(wrapStyle.flexDirection).toBe('row');
      expect(wrapStyle.flexWrap).toBe('wrap');
      expect(wrapStyle.maxWidth).toBe('100%');

      expect(NEGATIVE_FUN_TAGS).toHaveLength(6);
      for (const tag of NEGATIVE_FUN_TAGS) {
        const chip = view.getByTestId(`guard-fun-tag-${tag.id}`);
        const chipStyle = StyleSheet.flatten(chip.props.style);
        expect(chipStyle.maxWidth).toBe('100%');
        expect(view.getByText(tag.label)).toBeTruthy();
        const labelStyle = StyleSheet.flatten(view.getByText(tag.label).props.style);
        expect(labelStyle.flexShrink).toBeGreaterThan(0);
      }

      view.unmount();
    }
  });

  it('enforces 375px-safe width & shrinkable text contracts on SpireSwapPicker at 6/6', () => {
    const base = createSpireRun('Orange Tabby', 0, 6060);
    const six = ['blast-powder', 'mending-charm', 'flint-spark', 'understudy', 'war-drum', 'snowball'];
    const fullRun = {
      ...base,
      weapons: six,
      weaponLevels: Object.fromEntries(six.map(id => [id, 3])),
    };

    const view = render(
      <SpireSwapPicker
        run={fullRun}
        incomingWeaponId="echo-stone"
        incomingLevel={3}
        price={65}
        onConfirmSwap={() => {}}
        onCancel={() => {}}
        testIDPrefix="guard-swap"
      />
    );

    const panelStyle = StyleSheet.flatten(view.getByTestId('guard-swap-panel').props.style);
    expect(panelStyle.width).toBe('100%');
    expect(panelStyle.maxWidth).toBe('100%');

    const titleNode = view.getByText('Belt Full (6/6) — Swap out which weapon?');
    const titleStyle = StyleSheet.flatten(titleNode.props.style);
    expect(titleStyle.flexShrink).toBeGreaterThan(0);
    expect(titleStyle.minWidth).toBe(0);

    for (const id of six) {
      expect(view.getByTestId(`guard-swap-drop-${id}`)).toBeTruthy();
    }

    view.unmount();
  });

  it('uses the standard mobile ui/back-arrow icon (never lorc/return-arrow) on navigation back buttons', () => {
    const save = createNewSave();
    const run = createSpireRun('Orange Tabby', 0, 7777);
    const meta = createInitialSpireMeta();

    const screens: [string, () => React.ReactElement][] = [
      [
        'SpireHeader',
        () => <SpireHeader run={run} onOpenBuild={() => {}} onExitToMenu={() => {}} />,
      ],
      [
        'SpireSetup',
        () => (
          <SpireSetup
            activeRun={null}
            meta={meta}
            onStartNew={() => {}}
            onResume={() => {}}
            onAbandonActive={() => {}}
            onExit={() => {}}
          />
        ),
      ],
      [
        'AdventureMap',
        () => (
          <AdventureMap
            save={save}
            onSelectLevel={() => {}}
            onOpenCamp={() => {}}
            onOpenGuide={() => {}}
            onExit={() => {}}
          />
        ),
      ],
      [
        'Camp',
        () => <Camp save={save} onChange={() => {}} onClose={() => {}} />,
      ],
      [
        'SkillTree',
        () => <SkillTree save={save} fighter="Orange Tabby" onChange={() => {}} onBack={() => {}} />,
      ],
      [
        'BountyBoard',
        () => <BountyBoard save={save} onClose={() => {}} />,
      ],
      [
        'FieldGuide',
        () => <FieldGuide save={save} onClose={() => {}} />,
      ],
    ];

    for (const [, makeElement] of screens) {
      const view = render(<SafeAreaProvider initialMetrics={INSETS}>{makeElement()}</SafeAreaProvider>);
      expect(view.getAllByLabelText('icon-ui/back-arrow').length).toBeGreaterThanOrEqual(1);
      expect(view.queryByLabelText('icon-lorc/return-arrow')).toBeNull();
      view.unmount();
    }
  });
});
