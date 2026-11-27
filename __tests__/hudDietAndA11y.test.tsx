import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Card from '@/components/Card';
import AdventureRun, { resetHudInspectTipForTest } from '@/adventure/components/AdventureRun';
import { GearChips, gearModifiers } from '@/adventure/components/GearChips';
import HudInspector from '@/adventure/components/HudInspector';
import LevelPreview from '@/adventure/components/LevelPreview';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { ARCANA, arcanaShortName } from '@/adventure/data/arcana';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { evolutionsForWeapon } from '@/adventure/data/evolutions';
import { getLevel } from '@/adventure/data/levels';
import { MECHANICS } from '@/adventure/data/mechanics';
import { challengeProgress } from '@/adventure/engine/challenges';
import { createRun } from '@/adventure/engine/run';
import { GearBelt } from '@/adventure/fx/GearBelt';
import MultiplierIgnition, { RECEIPT_HOLD_MS } from '@/adventure/fx/MultiplierIgnition';
import { buildAllLiveEvolutions } from '@/adventure/ui/evolutionViewModel';
import { createMaxedSave, createSaveBefore } from '@/adventure/progress';
import {
  MIN_READABLE_FONT_PX,
  TextSizeStorage,
  scaleText,
  useTextScale,
} from '@/utils/textSizeStorage';

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : () => undefined) });
  return { sfx: () => undefined, music: band, band, setMusicEnabled: () => undefined, setSfxOverride: () => undefined };
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    ReactActual.createElement(View, { testID: `icon-${name}`, accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID, character, size }: { testID?: string; character: string; size?: number }) =>
      ReactActual.createElement(View, {
        testID,
        style: size ? { width: size, height: size } : undefined,
        accessibilityLabel: `fighter-avatar-${character}`,
      }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy, size }: { testID?: string; enemy?: { name?: string }; size?: number }) =>
      ReactActual.createElement(View, {
        testID,
        style: size ? { width: size, height: size } : undefined,
        accessibilityLabel: `enemy-avatar-${enemy?.name ?? 'foe'}`,
      }),
  };
});

jest.mock('@/adventure/components/WeaponDemoClip', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockDemoClip = () => ReactActual.createElement(View, { testID: 'weapon-demo-clip-mock' });
  return { __esModule: true, default: MockDemoClip };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon, size }: { testID?: string; weapon?: { name?: string }; size?: number }) =>
      ReactActual.createElement(View, {
        testID,
        style: size ? { width: size, height: size } : undefined,
        accessibilityLabel: `weapon-avatar-${weapon?.name ?? 'weapon'}`,
      }),
  };
});

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: Record<string, unknown>) =>
      ReactActual.createElement(View, props, props?.children as React.ReactNode);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy(
    { __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, unknown>,
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
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};

const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={INSETS}>{ui}</SafeAreaProvider>
);

const assertMinFontFloor = (root: ReturnType<typeof render>, minPx = MIN_READABLE_FONT_PX) => {
  const texts = root.UNSAFE_queryAllByType(Text);
  expect(texts.length).toBeGreaterThan(0);
  const violations: string[] = [];
  for (const node of texts) {
    const flat = StyleSheet.flatten(node.props.style);
    if (flat && typeof flat.fontSize === 'number' && flat.fontSize < minPx) {
      violations.push(`fontSize=${flat.fontSize} on "${String(node.props.children).slice(0, 30)}"`);
    }
  }
  expect(violations).toEqual([]);
};

const effectiveHitSize = (
  style: StyleProp<ViewStyle>,
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number } | number,
  fallbackW = 0,
  fallbackH = 0
) => {
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const w = typeof flat.width === 'number' ? flat.width : typeof flat.minWidth === 'number' ? flat.minWidth : fallbackW;
  const h = typeof flat.height === 'number' ? flat.height : typeof flat.minHeight === 'number' ? flat.minHeight : fallbackH;
  const slop =
    typeof hitSlop === 'number'
      ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }
      : {
          top: hitSlop?.top ?? 0,
          bottom: hitSlop?.bottom ?? 0,
          left: hitSlop?.left ?? 0,
          right: hitSlop?.right ?? 0,
        };
  return {
    width: w + slop.left + slop.right,
    height: h + slop.top + slop.bottom,
    bottomSlop: slop.bottom,
  };
};

describe('Wave 5 Lane B: HUD Diet, Thumb-Zone Safety, Typography, Tap Targets & Jargon Cleanup', () => {
  beforeEach(() => {
    TextSizeStorage.set('normal');
    resetHudInspectTipForTest();
  });

  it('[UI-16] TextSizeStorage persists normal/large scale and useTextScale reacts live', () => {
    expect(TextSizeStorage.get()).toBe('normal');
    expect(TextSizeStorage.getScale()).toBe(1.0);
    expect(scaleText(10, 1.0)).toBe(11);
    expect(scaleText(14, 1.15)).toBe(16);

    const Probe: React.FC = () => {
      const scale = useTextScale();
      return <Text testID="scale-probe">{scale.toFixed(2)}</Text>;
    };
    const view = render(<Probe />);
    expect(view.getByTestId('scale-probe')).toHaveTextContent('1.00');

    act(() => {
      TextSizeStorage.set('large');
    });
    expect(TextSizeStorage.get()).toBe('large');
    expect(TextSizeStorage.getScale()).toBe(1.15);
    expect(view.getByTestId('scale-probe')).toHaveTextContent('1.15');

    act(() => {
      TextSizeStorage.set('normal');
    });
    expect(view.getByTestId('scale-probe')).toHaveTextContent('1.00');
  });

  it('[UI-13] hides totalDamage & biggestHit during active play, collapses idle PassiveChips, and shows battle summary inside Pause with registered Icon', () => {
    const save = {
      ...createMaxedSave(),
      selectedFighter: 'Orange Tabby' as const,
      charms: ['blast-powder', 'flint-spark'],
      equippedArcana: ['catalyst_resonance' as const],
    };
    const view = render(
      wrap(
        <AdventureRun
          level={getLevel('2-8')}
          save={save}
          seed={42}
          effects={false}
          onFinish={() => {}}
          onQuit={() => {}}
          onRestart={() => {}}
          onCoachMarkSeen={() => {}}
        />
      )
    );

    // [UI-13] Total damage & best hit are hidden during active play; legacy PowerMeter/EvolutionPickOverlay/run-evo-chip are removed
    expect(view.queryByTestId('run-total-damage')).toBeNull();
    expect(view.queryByTestId('run-biggest-hit')).toBeNull();
    expect(view.queryByTestId('power-meter')).toBeNull();
    expect(view.queryByTestId('run-power-delta')).toBeNull();
    expect(view.queryByTestId('run-evo-chip')).toBeNull();
    expect(view.queryByTestId('evo-pick-option-0')).toBeNull();

    // [UI-13] Orange Tabby's Nine Lives (1 life left) is lit & expanded; Scrappy (+0 at full HP) collapses into dim pip
    const nineLives = view.getByTestId('run-passive-nine_lives');
    const scrappy = view.getByTestId('run-passive-scrappy');
    expect(nineLives.props.accessibilityState?.expanded).toBe(true);
    expect(scrappy.props.accessibilityState?.expanded).toBe(false);
    expect(view.queryByText('+0')).toBeNull();

    // [UI-19] Arcana chip displays plain-English short name instead of bare Roman numeral "VII"
    const arcanaChip = view.getByTestId('run-arcana-chip');
    expect(arcanaChip).toHaveTextContent('Evolve');
    expect(view.queryByText('VII')).toBeNull();

    // [UI-03] Zero raw sword emoji in active HUD
    expect(view.queryByText(/⚔/)).toBeNull();
  });

  it('[UI-13] MultiplierIgnition renders slim 1-row bar at rest on mobile, floats receipt during tally + 1.8s, and preserves Beat.onLand sync', () => {
    jest.useFakeTimers();
    try {
      const save = createMaxedSave();
      const run = createRun(getLevel('2-4'), save, { seed: 7 });

      // At rest (primed, no Set landed yet): compact single-row pill on portrait (!wide), no receipt line mounted
      const view = render(<MultiplierIgnition ignition={null} run={run} enabled onPress={() => {}} />);
      expect(view.queryByTestId('score-receipt-popover')).toBeNull();
      expect(view.queryByTestId('score-receipt-line')).toBeNull();
      expect(view.getByTestId('score-base-pill')).toBeTruthy();
      expect(view.getByTestId('score-mult-pill')).toBeTruthy();

      const ignition = {
        id: 202,
        math: {
          cards: 3,
          baseCards: 3,
          collateral: {},
          flatBonus: 3,
          flatItems: [{ label: 'Heavy Hitter', amount: 3, note: 'Workshop' }],
          multiplier: 2,
          multItems: [{ label: 'Rainbow Strike', amount: 2, note: 'all different' }],
          rainbow: true,
          extra: 0,
          hit: 12,
          diffTraits: 3,
          graceUsed: false,
          sinceLastMs: 1200,
          combo: 1,
        },
        turnDamage: 12,
        lethal: false,
        isBossOrElite: false,
        foeName: 'Dozy Bunny',
      };

      // During LIVE tally: floating non-reflowing receipt expands and holds until Beat.onLand (`landSeq`)
      view.rerender(<MultiplierIgnition ignition={ignition} run={run} enabled landSeq={0} impactMs={240} onPress={() => {}} />);
      expect(view.getByText('LIVE')).toBeTruthy();
      expect(view.getByTestId('score-receipt-popover')).toBeTruthy();
      expect(view.getByTestId('score-receipt-line')).toBeTruthy();

      // Beat.onLand arrives -> slams to LAST, keeps receipt visible briefly
      view.rerender(<MultiplierIgnition ignition={ignition} run={run} enabled landSeq={1} impactMs={240} onPress={() => {}} />);
      expect(view.getByText('LAST')).toBeTruthy();
      expect(view.getByTestId('score-receipt-popover')).toBeTruthy();

      // After 1.8s hold -> floating receipt collapses cleanly back to 1-row bar
      act(() => {
        jest.advanceTimersByTime(RECEIPT_HOLD_MS + 50);
      });
      expect(view.queryByTestId('score-receipt-popover')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('[UI-15] guards mobile portrait HUD rail taps when cards are selected, allows long-press & instant ? dot, 1-tap backdrop dismiss, and 1-time tip', () => {
    const save = {
      ...createMaxedSave(),
      charms: ['blast-powder'],
      equippedArcana: ['tempo_surge' as const],
    };
    const view = render(
      wrap(
        <AdventureRun
          level={getLevel('2-8')}
          save={save}
          seed={19}
          effects={false}
          onFinish={() => {}}
          onQuit={() => {}}
          onRestart={() => {}}
          onCoachMarkSeen={() => {}}
        />
      )
    );

    // 8px dead-zone buffer between HUD and board on portrait mobile
    const boardWrapStyle = StyleSheet.flatten(view.getByTestId('run-board-wrap').props.style);
    expect(boardWrapStyle.paddingTop).toBeGreaterThanOrEqual(8);

    // Select 1 card -> thumb-zone guard activates!
    const firstCard = view.getAllByTestId(/^card-(diamond|oval|squiggle)-/)[0];
    fireEvent.press(firstCard);

    // Single-tapping guarded lower-rail HUD chips must NOT open blocking modals mid-Set
    fireEvent.press(view.getByTestId('run-challenge'));
    expect(view.queryByTestId('hud-inspector-modal')).toBeNull();

    fireEvent.press(view.getByTestId('multiplier-ignition'));
    expect(view.queryByTestId('hud-inspector-modal')).toBeNull();

    fireEvent.press(view.getByTestId('belt-blast-powder'));
    expect(view.queryByTestId('weapon-inspect-modal')).toBeNull();

    // Explicit ? info dot on MultiplierIgnition remains 1-tap instant AND shows 1-time subtle tip!
    fireEvent.press(view.getByTestId('score-info-dot'));
    expect(view.getByTestId('hud-inspector-modal')).toBeTruthy();
    expect(view.getByTestId('hud-inspect-guard-tip')).toHaveTextContent(/Hold any chip or tap \?/);

    // 1-tap dimmed backdrop dismisses HudInspector immediately
    fireEvent.press(view.getByTestId('hud-inspector-backdrop'));
    expect(view.queryByTestId('hud-inspector-modal')).toBeNull();

    // Long-pressing a guarded chip DOES inspect, and 1-time tip does NOT repeat
    fireEvent(view.getByTestId('run-challenge'), 'longPress');
    expect(view.getByTestId('hud-inspector-modal')).toBeTruthy();
    expect(view.queryByTestId('hud-inspect-guard-tip')).toBeNull();
    fireEvent.press(view.getByTestId('hud-inspector-backdrop'));

    // Long-pressing guarded belt weapon opens WeaponExplainer modal with 1-tap backdrop dismiss
    fireEvent(view.getByTestId('belt-blast-powder'), 'longPress');
    expect(view.getByTestId('weapon-inspect-modal')).toBeTruthy();
    fireEvent.press(view.getByTestId('inspect-backdrop'));
    expect(view.queryByTestId('weapon-inspect-modal')).toBeNull();
  });

  it('[UI-17] ensures >=44x44px effective touch targets via hitSlop and keeps bottom slop 0 on portrait lower rail', () => {
    const save = {
      ...createMaxedSave(),
      charms: ['blast-powder', 'flint-spark'],
    };
    const runView = render(
      wrap(
        <AdventureRun
          level={getLevel('2-8')}
          save={save}
          seed={21}
          effects={false}
          onFinish={() => {}}
          onQuit={() => {}}
          onRestart={() => {}}
          onCoachMarkSeen={() => {}}
        />
      )
    );

    const pause = runView.getByTestId('run-pause');
    const pauseTarget = effectiveHitSize(pause.props.style, pause.props.hitSlop, 36, 36);
    expect(pauseTarget.width).toBeGreaterThanOrEqual(44);
    expect(pauseTarget.height).toBeGreaterThanOrEqual(44);

    const hint = runView.getByTestId('run-hint');
    const hintTarget = effectiveHitSize(hint.props.style, hint.props.hitSlop, 44, 30);
    expect(hintTarget.width).toBeGreaterThanOrEqual(44);
    expect(hintTarget.height).toBeGreaterThanOrEqual(44);
    expect(hintTarget.bottomSlop).toBe(0);

    const beltSlot = runView.getByTestId('belt-blast-powder');
    const beltTarget = effectiveHitSize(beltSlot.props.style, beltSlot.props.hitSlop);
    expect(beltTarget.width).toBeGreaterThanOrEqual(44);
    expect(beltTarget.height).toBeGreaterThanOrEqual(44);
    expect(beltTarget.bottomSlop).toBe(0);

    const preview = render(
      wrap(
        <LevelPreview
          level={getLevel('2-4')}
          save={save}
          initialTab="loadout"
          onClose={() => {}}
          onPlay={() => {}}
          onSelectFighter={() => {}}
          onSelectCharm={() => {}}
          onShowMechanic={() => {}}
        />
      )
    );
    const closeBtn = preview.getByTestId('preview-close');
    const closeTarget = effectiveHitSize(closeBtn.props.style, closeBtn.props.hitSlop);
    expect(closeTarget.width).toBeGreaterThanOrEqual(44);
    expect(closeTarget.height).toBeGreaterThanOrEqual(44);
  });

  it('[UI-05]/[UI-06] renders atmospheric SVG stage backdrop and amplifies Boss foeSize >= 1.35x fighterSize', () => {
    const bossLevel = getLevel('1-10');
    expect(bossLevel.isBoss).toBe(true);
    const view = render(
      wrap(
        <AdventureRun
          level={bossLevel}
          save={createSaveBefore('1-10')}
          seed={5}
          effects={false}
          onFinish={() => {}}
          onQuit={() => {}}
          onRestart={() => {}}
          onCoachMarkSeen={() => {}}
        />
      )
    );

    expect(view.getByTestId('run-stage-backdrop')).toBeTruthy();
    expect(view.getByTestId('run-boss-aura')).toBeTruthy();

    const fighterStyle = StyleSheet.flatten(view.getByTestId('adventure-run-fighter').props.style);
    const enemyStyle = StyleSheet.flatten(view.getByTestId('adventure-run-enemy').props.style);
    const fighterW = Number(fighterStyle?.width ?? 0);
    const enemyW = Number(enemyStyle?.width ?? 0);
    expect(fighterW).toBeGreaterThan(0);
    expect(enemyW / fighterW).toBeGreaterThanOrEqual(1.35);
  });

  it('[UI-19] scrubs jargon across Arcana, Mechanics, GearChips, HudInspector & LevelPreview without legacy Power/Catalyst strings', () => {
    // Arcana copy & short names
    const glassPrism = ARCANA.find(a => a.id === 'glass_prism')!;
    expect(glassPrism.upside).toMatch(/Charged|Holo|damage/i);
    expect(glassPrism.upside).not.toMatch(/Power \(\+/);
    const scholar = ARCANA.find(a => a.id === 'scholars_gambit')!;
    expect(scholar.tradeoff).toContain('Weapon slot');
    expect(scholar.tradeoff).not.toContain('Charm slot');
    const mono = ARCANA.find(a => a.id === 'monochrome_pact')!;
    expect(mono.tradeoff).toContain('3+ varied');
    for (const a of ARCANA) {
      expect(arcanaShortName(a.id)).not.toMatch(/^[IVX]+$/);
    }

    // Mechanics copy
    expect(MECHANICS.power_cards.title).toBe('Charged & Holo Cards');
    expect(MECHANICS.charm.title).toBe('Weapon Belt');
    expect(MECHANICS.charm_slots.title).toBe('Weapon Slots');

    // Collector's Album GearChip uses trait icon pages, never [Shp][Col][Num][Shd]
    const albumSave = {
      ...createMaxedSave(),
      armory: ['collectors-album'],
      charms: ['collectors-album'],
    };
    const run = createRun(getLevel('2-4'), albumSave, { seed: 9 });
    const chips = render(<GearChips run={run} mods={gearModifiers(run)} onInspectWeapon={() => {}} />);
    expect(chips.getByTestId('run-album-chip')).toBeTruthy();
    expect(chips.getByTestId('album-page-shape')).toBeTruthy();
    expect(chips.getByTestId('album-page-color')).toBeTruthy();
    expect(chips.queryByText('Shp')).toBeNull();
    expect(chips.queryByText('Col')).toBeNull();
    expect(chips.queryByText('Num')).toBeNull();
    expect(chips.queryByText('Shd')).toBeNull();

    // HudInspector evolutions view shows per-weapon awakenings without Catalyst/Power jargon
    const insp = render(
      <HudInspector
        target={{ kind: 'evolutions' }}
        run={run}
        shownHp={run.foeHp}
        challenge={challengeProgress(run)}
        onClose={() => {}}
      />
    );
    expect(insp.getByTestId('inspector-evo-collectors-album')).toBeTruthy();
    expect(insp.queryByText(/Catalyst/i)).toBeNull();
    expect(insp.queryByText(/charm belt/i)).toBeNull();

    // LevelPreview renders per-weapon slots without legacy Catalyst likelihood pill
    const preview = render(
      wrap(
        <LevelPreview
          level={getLevel('2-4')}
          save={{
            ...createMaxedSave(),
            charms: ['blast-powder', 'mending-charm'],
          }}
          initialTab="loadout"
          onClose={() => {}}
          onPlay={() => {}}
          onSelectFighter={() => {}}
          onSelectCharm={() => {}}
          onShowMechanic={() => {}}
        />
      )
    );
    expect(preview.queryByTestId('preview-evo-likelihood')).toBeNull();
    expect(preview.queryByText(/chance for a Catalyst/i)).toBeNull();
  });

  it('announces GearBelt live evolution states and Card.holo / Card.marked via accessibilityLabel', () => {
    const save = {
      ...createMaxedSave(),
      charms: ['blast-powder', 'flint-spark', 'mending-charm'],
    };
    const run = createRun(getLevel('2-8'), save, { seed: 13 });
    const liveEvos = buildAllLiveEvolutions(run.weaponEvolutions).map((vm, idx) =>
      idx === 0
        ? { ...vm, phase: 'active' as const, activeRemainingMs: 11_400 }
        : idx === 1
          ? { ...vm, phase: 'charging' as const, progress: vm.target - 1, almostReady: true }
          : { ...vm, phase: 'cooldown' as const, cooldownRemainingMs: 2_200 }
    );
    const belt = render(
      <GearBelt weapons={run.weapons} evolutions={liveEvos} width={375} onInspect={() => {}} />
    );
    expect(belt.getByTestId('belt-blast-powder').props.accessibilityLabel).toMatch(/active, 12 seconds remaining/);
    expect(belt.getByTestId('belt-flint-spark').props.accessibilityLabel).toMatch(/almost ready/);
    expect(belt.getByTestId('belt-mending-charm').props.accessibilityLabel).toMatch(/cooling down, 3 seconds/);
    belt.unmount();

    const cardView = render(
      <Card
        card={{
          id: 'holo-marked',
          shape: 'diamond',
          color: 'purple',
          number: 3,
          shading: 'striped',
          selected: false,
          holo: true,
          marked: true,
        }}
        onClick={() => {}}
      />
    );
    expect(
      cardView.getByLabelText(/3 pink striped triangle, holo card, plus 4 base damage and 1\.2x multiplier, marked/)
    ).toBeTruthy();
    cardView.unmount();
  });

  it('[UI-16] enforces >=11px typography floor across all owned HUD, inspector, belt, explainer & preview components', () => {
    const save = {
      ...createMaxedSave(),
      charms: ['blast-powder', 'collectors-album', 'bounty-poster'],
      equippedArcana: ['catalyst_resonance' as const],
    };
    const run = createRun(getLevel('2-8'), save, { seed: 11 });
    const mods = gearModifiers(run);
    const blast = getArmoryWeapon('blast-powder')!;
    const liveEvos = buildAllLiveEvolutions(run.weaponEvolutions);
    const sampleEvo = evolutionsForWeapon('blast-powder')[0];

    assertMinFontFloor(render(<GearChips run={run} mods={mods} onInspectWeapon={() => {}} />));
    assertMinFontFloor(
      render(
        <GearBelt
          weapons={run.weapons}
          evolutions={liveEvos.map((e, i) =>
            i === 0 ? { ...e, phase: 'active' as const, activeRemainingMs: 12_000 } : { ...e, progress: 1 }
          )}
          growth={{ 'blast-powder#0': { stacks: 2, progress: 0 } }}
          counters={[
            {
              type: 'explosion',
              label: 'Explosions',
              stat: 'explosionChance',
              baseChance: 25,
              effectiveChance: 10,
              reduction: 15,
            },
          ]}
          ignition={{
            id: 1,
            math: {
              cards: 6,
              collateral: {},
              flatBonus: 0,
              multiplier: 1,
              rainbow: false,
              extra: 0,
              hit: 6,
              diffTraits: 2,
              graceUsed: false,
              sinceLastMs: 1000,
              combo: 1,
            },
            beltBadges: { 'blast-powder': { text: '+4', kind: 'flat' } },
            lethal: false,
            isBossOrElite: false,
            foeName: 'Foe',
          }}
          reduced
          width={375}
          onInspect={() => {}}
        />
      )
    );
    assertMinFontFloor(render(<MultiplierIgnition ignition={null} run={run} enabled onPress={() => {}} />));
    assertMinFontFloor(
      render(
        <WeaponExplainer
          weapon={blast}
          evolutionMode="live"
          equippedEvolutionId={sampleEvo.id}
          liveEvolution={liveEvos[0] ?? null}
          defaultOpen
        />
      )
    );
    assertMinFontFloor(
      render(
        <HudInspector
          target={{ kind: 'evolutions' }}
          run={run}
          shownHp={run.foeHp}
          challenge={challengeProgress(run)}
          showGuardTip
          onClose={() => {}}
        />
      )
    );
    assertMinFontFloor(
      render(
        <HudInspector
          target={{ kind: 'buff', which: 'graces' }}
          run={run}
          shownHp={run.foeHp}
          challenge={challengeProgress(run)}
          showGuardTip
          onClose={() => {}}
        />
      )
    );
    assertMinFontFloor(
      render(
        wrap(
          <LevelPreview
            level={getLevel('2-4')}
            save={save}
            initialTab="loadout"
            onClose={() => {}}
            onPlay={() => {}}
            onSelectFighter={() => {}}
            onSelectCharm={() => {}}
            onShowMechanic={() => {}}
          />
        )
      )
    );
  });
});
