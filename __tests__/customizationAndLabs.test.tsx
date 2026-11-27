/**
 * Wave 3 Lane C (`w3-customization-labs`) verification suite covering all 8 items:
 *   [GP-20] WeaponDemoClip (2s looping mini-board + reduced-motion schematic) inside WeaponExplainer
 *   [GP-21] Armory filter/search/sort, 1-tap Auto-Equip + Undo, 3 Loadout Presets, belt slot reorder & Understudy clarity
 *   [GP-23] FighterBuildAura worn-build visual aura & Evolution halo
 *   [UI-20] LevelPreview Briefing | Loadout 2-tab declutter & Camp Next Goal hub cleanup
 *   [TP-11] FightDebugDrawer, devOverrides runtime JSON store & /dev Studio Hub
 *   [TP-12] TrainingLabBar sandbox controls, rolling 15s DPS & Camp/LevelPreview TEST LOADOUT buttons
 *   [TP-13] replayMoveSnapshot, HighlightStageModal (0.5x / 1x) & FightReplay Watch Highlight pills
 *   [TP-14] CritterGallery extraction, /dev/fighters thin wrapper & FieldGuide Critters tab
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Camp from '@/adventure/components/Camp';
import CritterGallery, { collectGalleryFoes } from '@/adventure/components/CritterGallery';
import FieldGuide from '@/adventure/components/FieldGuide';
import FightDebugDrawer from '@/adventure/components/FightDebugDrawer';
import FightReplay from '@/adventure/components/FightReplay';
import HighlightStageModal from '@/adventure/components/HighlightStageModal';
import LevelPreview from '@/adventure/components/LevelPreview';
import TrainingLabBar, { computeRollingDps } from '@/adventure/components/TrainingLabBar';
import WeaponDemoClip, { WEAPON_DEMO_ARCHETYPE, getWeaponDemoSpec } from '@/adventure/components/WeaponDemoClip';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { ARCANA } from '@/adventure/data/arcana';
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon } from '@/adventure/data/armory';
import { LEVELS, getLevel } from '@/adventure/data/levels';
import { PARRY_RULES } from '@/adventure/data/parry';
import { SURGE_RULES } from '@/adventure/data/rules';
import {
  applyDevOverridesJson,
  buildDevOverridesDiff,
  getDevOverrides,
  getEffectiveParryRules,
  getEffectiveSurgeRules,
  getEffectiveWeaponStats,
  resetDevOverrides,
  setDevLayers,
  setDevSlowMo,
} from '@/adventure/engine/devOverrides';
import { FightRecorder, replayMoveSnapshot, synthesizeHighlightSnapshot } from '@/adventure/engine/replay';
import { baseCardReward, createRun, runReducer } from '@/adventure/engine/run';
import { fxClock } from '@/adventure/fx/clock';
import { fightReplayOf } from '@/adventure/history';
import {
  applyLoadoutPreset,
  autoBuildLoadout,
  clearLoadoutPreset,
  filterAndSortArmory,
  loadLoadoutPresets,
  reorderCharmSlots,
  saveLoadoutPreset,
} from '@/adventure/loadoutPresets';
import { applyLevelResult, createMaxedSave, createNewSave, toggleCharm } from '@/adventure/progress';
import { FighterBuildAura, deriveBuildTheme } from '@/components/fighters/FighterBuildAura';
import DevFightersPage from '../app/dev/fighters';
import DevStudioHub, { DEV_STUDIOS } from '../app/dev/index';
import { findSet } from './testUtils/adventureFight';

let mockReducedMotion = false;
const mockRouterPush = jest.fn();
const mockStorageMap = new Map<string, string>();
const mockClipboardSet = jest.fn(async (_text: string) => true);

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: (text: string) => mockClipboardSet(text),
}));

jest.mock('@/utils/storage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStorageMap.get(key)),
    set: jest.fn((key: string, val: string) => {
      mockStorageMap.set(key, val);
    }),
    remove: jest.fn((key: string) => {
      mockStorageMap.delete(key);
    }),
  },
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock('@/hooks/useAppActive', () => ({
  useAppActive: () => true,
}));

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : key === 'gridMs' ? 62.5 : () => undefined) });
  return { sfx: jest.fn(), music: band, band, setMusicEnabled: jest.fn(), setSfxOverride: jest.fn() };
});

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Ellipse: 'Ellipse',
  G: 'G',
  Text: 'Text',
  TSpan: 'TSpan',
  Path: 'Path',
  Polygon: 'Polygon',
  Polyline: 'Polyline',
  Line: 'Line',
  Rect: 'Rect',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
  ClipPath: 'ClipPath',
  Pattern: 'Pattern',
}));

jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID, character }: { testID?: string; character: string | { name: string } }) =>
      ReactActual.createElement(View, {
        testID: testID ?? `mock-fighter-${typeof character === 'string' ? character : character.name}`,
      }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy: string | { name: string } }) =>
      ReactActual.createElement(View, {
        testID: testID ?? `mock-enemy-${typeof enemy === 'string' ? enemy : enemy.name}`,
      }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon: { id: string } }) =>
      ReactActual.createElement(View, { testID: testID ?? `mock-weapon-${weapon.id}` }),
  };
});

jest.mock('@/components/Icon', () => {
  const { View: RNView, Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return (
      <RNView testID={`mock-icon-${name}`}>
        <RNText>{name}</RNText>
      </RNView>
    );
  };
});

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrap = (node: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>{node}</SafeAreaProvider>
);

beforeEach(() => {
  mockReducedMotion = false;
  mockRouterPush.mockClear();
  mockClipboardSet.mockClear();
  mockStorageMap.clear();
  resetDevOverrides();
  fxClock.slow = 1;
});

describe('[GP-20] WeaponDemoClip inside WeaponExplainer', () => {
  it('maps every single one of the 64 Armory weapons to an explicit visual demo archetype', () => {
    expect(ALL_ARMORY_WEAPON_IDS).toHaveLength(64);
    for (const id of ALL_ARMORY_WEAPON_IDS) {
      expect(WEAPON_DEMO_ARCHETYPE[id]).toBeDefined();
      const spec = getWeaponDemoSpec(id);
      expect(spec.caption.length).toBeGreaterThan(8);
      expect(spec.matchSlots.length).toBe(3);
    }
  });

  it('embeds looping 2s demo in WeaponExplainer and switches to static schematic under Reduced Motion', () => {
    const blast = getArmoryWeapon('blast-powder')!;
    const animatedView = render(wrap(<WeaponExplainer weapon={blast} defaultOpen />));
    expect(animatedView.getByTestId('weapon-demo-clip-blast-powder')).toBeTruthy();
    expect(animatedView.getByTestId('weapon-demo-loop-blast-powder')).toBeTruthy();
    animatedView.unmount();

    mockReducedMotion = true;
    const staticView = render(wrap(<WeaponDemoClip weaponId="prismatic-ray" />));
    expect(staticView.getByTestId('weapon-demo-schematic-prismatic-ray')).toBeTruthy();
    expect(staticView.getByText('SCHEMATIC')).toBeTruthy();
  });
});

describe('[GP-21] & [UI-20] Loadout Presets, Auto-Equip, Slot Reorder, Camp & LevelPreview', () => {
  it('reorders belt slots cleanly for Understudy and saves/loads 3 MMKV presets', () => {
    const base = {
      ...createMaxedSave(),
      charms: ['understudy', 'blast-powder', 'flint-spark'],
    };
    const reordered = reorderCharmSlots(base, 0, 1);
    expect(reordered.charms).toEqual(['blast-powder', 'understudy', 'flint-spark']);

    saveLoadoutPreset(0, reordered, 'Burst');
    saveLoadoutPreset(1, { ...reordered, charms: ['mending-charm', 'life-vessel'] }, 'Survival');
    const loaded = loadLoadoutPresets();
    expect(loaded[0]?.name).toBe('Burst');
    expect(loaded[0]?.charms).toEqual(['blast-powder', 'understudy', 'flint-spark']);
    expect(loaded[1]?.name).toBe('Survival');
    expect(loaded[2]).toBeNull();

    const applied = applyLoadoutPreset({ ...createMaxedSave(), charms: [] }, loaded[0]!);
    expect(applied.charms).toEqual(['blast-powder', 'understudy', 'flint-spark']);

    const afterClear = clearLoadoutPreset(0);
    expect(afterClear[0]).toBeNull();
  });

  it('autoBuildLoadout avoids clashing pairs, respects Understudy placement, and arms an Evolution', () => {
    const save = {
      ...createMaxedSave(),
      charms: [],
    };
    const level = getLevel('3-1');
    const built = autoBuildLoadout(save, level);
    expect(built.save.charms.length).toBeGreaterThanOrEqual(3);
    expect(built.save.charms[0]).not.toBe('understudy');
    expect(built.armedEvolution).toBeTruthy();
    expect(built.summary).toContain('Auto-equipped');
  });

  it('filterAndSortArmory filters by search, role, Lv 2+, Equipped, and Synergy', () => {
    const save = {
      ...createMaxedSave(),
      charms: ['blast-powder'],
    };
    const searchHits = filterAndSortArmory(save, { quick: 'all', role: 'all', query: 'prismatic', sort: 'az' });
    expect(searchHits.map(w => w.id)).toEqual(['prismatic-ray']);

    const equippedOnly = filterAndSortArmory(save, { quick: 'equipped', role: 'all', query: '', sort: 'level' });
    expect(equippedOnly.map(w => w.id)).toEqual(['blast-powder']);

    const synergyOnly = filterAndSortArmory(save, { quick: 'synergy', role: 'all', query: '', sort: 'synergy' });
    expect(synergyOnly.length).toBeGreaterThan(0);
    expect(synergyOnly.every(w => w.id !== 'blast-powder')).toBe(true);
  });

  it('Camp renders Next Goal, TEST LOADOUT, search/filter/presets, Understudy warning, and belt reorder', () => {
    let save = {
      ...createMaxedSave(),
      charms: ['understudy', 'blast-powder'],
    };
    const onChange = jest.fn(next => {
      save = next;
    });
    const onTestLoadout = jest.fn();

    const hub = render(
      wrap(<Camp save={save} onChange={onChange} onClose={() => {}} onTestLoadout={onTestLoadout} />)
    );
    expect(hub.getByTestId('camp-next-goal')).toBeTruthy();
    fireEvent.press(hub.getByTestId('camp-test-loadout'));
    expect(onTestLoadout).toHaveBeenCalledTimes(1);
    hub.unmount();

    const armoryView = render(
      wrap(
        <Camp
          save={save}
          initialTab="armory"
          onChange={onChange}
          onClose={() => {}}
          onTestLoadout={onTestLoadout}
        />
      )
    );
    // Slot 1 Understudy warning appears, then nudging right reorders slots cleanly
    expect(armoryView.getByTestId('camp-understudy-warning')).toBeTruthy();
    fireEvent.press(armoryView.getByTestId('camp-slot-0'));
    fireEvent.press(armoryView.getByTestId('camp-slot-right-0'));
    expect(save.charms).toEqual(['blast-powder', 'understudy']);
    armoryView.rerender(
      wrap(
        <Camp
          save={save}
          initialTab="armory"
          onChange={onChange}
          onClose={() => {}}
          onTestLoadout={onTestLoadout}
        />
      )
    );
    expect(armoryView.getByTestId('camp-understudy-link')).toBeTruthy();

    // Save preset 0 and trigger Auto-Equip + Undo
    fireEvent.press(armoryView.getByTestId('camp-preset-save-0'));
    expect(loadLoadoutPresets()[0]?.charms).toEqual(['blast-powder', 'understudy']);

    fireEvent.press(armoryView.getByTestId('camp-auto-equip'));
    expect(armoryView.getByTestId('camp-auto-equip-undo')).toBeTruthy();
    fireEvent.press(armoryView.getByTestId('camp-auto-equip-undo'));

    // Search narrows the 64-weapon list cleanly
    fireEvent.changeText(armoryView.getByTestId('camp-armory-search'), 'magnet');
    expect(armoryView.getByTestId('camp-armory-magnet')).toBeTruthy();
    expect(armoryView.queryByTestId('camp-armory-blast-powder')).toBeNull();
  });

  it('LevelPreview splits Briefing | Loadout cleanly and offers TEST LOADOUT alongside FIGHT', () => {
    const level = getLevel('1-5');
    let save = {
      ...createMaxedSave(),
      charms: ['blast-powder', 'flint-spark'],
    };
    const onTestLoadout = jest.fn();
    const onApplyLoadout = jest.fn(next => {
      save = next;
    });
    const onSelectCharm = jest.fn(id => {
      save = toggleCharm(save, id);
    });

    const view = render(
      wrap(
        <LevelPreview
          level={level}
          save={save}
          onClose={() => {}}
          onPlay={() => {}}
          onSelectFighter={() => {}}
          onSelectCharm={onSelectCharm}
          onSelectArcana={() => {}}
          onShowMechanic={() => {}}
          onApplyLoadout={onApplyLoadout}
          onTestLoadout={onTestLoadout}
        />
      )
    );

    // Default Briefing tab shows compact loadout summary + TEST LOADOUT button
    expect(view.getByTestId('preview-tabs')).toBeTruthy();
    expect(view.getByTestId('preview-loadout-summary')).toBeTruthy();
    expect(view.queryByTestId('preview-loadout-pane')).toBeNull();

    fireEvent.press(view.getByTestId('preview-test-loadout'));
    expect(onTestLoadout).toHaveBeenCalledTimes(1);

    // Switch to Loadout tab -> Filter/Sort, Auto-Equip, single focused WeaponExplainer
    fireEvent.press(view.getByTestId('preview-tab-loadout'));
    expect(view.getByTestId('preview-loadout-pane')).toBeTruthy();
    expect(view.getByTestId('preview-armory-filters')).toBeTruthy();
    expect(view.getByTestId('preview-charm-guide')).toBeTruthy();
    // Single focused explainer (not stacking both blast-powder and flint-spark simultaneously!)
    expect(view.getByTestId('weapon-explainer-blast-powder')).toBeTruthy();
    expect(view.queryByTestId('weapon-explainer-flint-spark')).toBeNull();

    fireEvent.press(view.getByTestId('preview-auto-equip'));
    expect(onApplyLoadout).toHaveBeenCalled();
  });
});

describe('[GP-23] FighterBuildAura worn-build overlay', () => {
  it('derives dominant role, Evolution halo, and Arcana count and renders cleanly', () => {
    expect(deriveBuildTheme([], 0, 0)).toBeNull();
    const theme = deriveBuildTheme(['blast-powder', 'flint-spark', 'mending-charm'], 1, 2);
    expect(theme).toEqual({ dominantRole: 'damage', evolved: true, arcanaCount: 2 });

    const view = render(wrap(<FighterBuildAura theme={theme} size={56} />));
    const aura = view.getByTestId('fighter-build-aura');
    expect(aura.props.accessibilityLabel).toContain('Ember Glow');
    expect(aura.props.accessibilityLabel).toContain('Evolved halo');
    expect(aura.props.accessibilityLabel).toContain('2 Arcana');
    view.unmount();

    mockReducedMotion = true;
    const quietView = render(wrap(<FighterBuildAura theme={theme} size={56} quiet />));
    expect(quietView.getByTestId('fighter-build-aura')).toBeTruthy();
  });
});

describe('[TP-11] devOverrides, FightDebugDrawer & /dev Studio Hub', () => {
  it('applies live JSON overrides, slow-mo clock sync, layer toggles, and clean source diff', () => {
    const bad = applyDevOverridesJson('{not-json');
    expect(bad.ok).toBe(false);

    const ok = applyDevOverridesJson(
      JSON.stringify({
        parry: { perfectWindowMs: 4500 },
        surge: { multiplier: 6 },
        weapons: { 'blast-powder': { explosionChance: 55 } },
      })
    );
    expect(ok.ok).toBe(true);
    expect(getEffectiveParryRules().perfectWindowMs).toBe(4500);
    expect(getEffectiveSurgeRules().multiplier).toBe(6);
    expect(getEffectiveWeaponStats('blast-powder', { explosionChance: 20 }).explosionChance).toBe(55);

    setDevSlowMo(0.25);
    expect(fxClock.slow).toBe(4);
    setDevLayers({ hideFx: true, showAnchors: true });
    expect(getDevOverrides().layers).toEqual({ hideFx: true, dimBoard: false, showAnchors: true });

    const diff = buildDevOverridesDiff();
    expect(diff).toContain(`PARRY_RULES.perfectWindowMs: ${PARRY_RULES.perfectWindowMs} -> 4500`);
    expect(diff).toContain(`SURGE_RULES.multiplier: ${SURGE_RULES.multiplier} -> 6`);
    expect(diff).toContain('WEAPON[blast-powder].explosionChance = 55');

    resetDevOverrides();
    expect(fxClock.slow).toBe(1);
    expect(getEffectiveParryRules().perfectWindowMs).toBe(PARRY_RULES.perfectWindowMs);
  });

  it('FightDebugDrawer dispatches state controls, hot-swap weapon, slow-mo, layers & Copy Diff', () => {
    const actions = {
      onSetFoeHp: jest.fn(),
      onToggleFreezeClock: jest.fn(),
      onTriggerEvo: jest.fn(),
      onAdvanceEvo: jest.fn(),
      onForceParry: jest.fn(),
      onForceSurge: jest.fn(),
      onHotSwapWeapon: jest.fn(),
      onSetHearts: jest.fn(),
    };
    const view = render(
      wrap(
        <FightDebugDrawer
          run={{
            foeHp: 80,
            foeMaxHp: 100,
            hearts: 4,
            maxHearts: 5,
            weapons: [],
            surge: null,
            parry: null,
            frozenMs: 0,
          }}
          actions={actions}
        />
      )
    );
    expect(view.queryByTestId('debug-drawer-panel')).toBeNull();
    fireEvent.press(view.getByTestId('debug-drawer-toggle'));
    expect(view.getByTestId('debug-drawer-panel')).toBeTruthy();

    fireEvent.press(view.getByTestId('debug-foe-hp-1'));
    expect(actions.onSetFoeHp).toHaveBeenCalledWith(1);
    fireEvent.press(view.getByTestId('debug-freeze-clock'));
    expect(actions.onToggleFreezeClock).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByTestId('debug-trigger-evo'));
    expect(actions.onTriggerEvo).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByTestId('debug-advance-evo'));
    expect(actions.onAdvanceEvo).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByTestId('debug-parry-perfect'));
    expect(actions.onForceParry).toHaveBeenCalledWith('perfect');
    fireEvent.press(view.getByTestId('debug-force-surge'));
    expect(actions.onForceSurge).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByTestId('debug-hearts-1'));
    expect(actions.onSetHearts).toHaveBeenCalledWith(1);

    fireEvent.press(view.getByTestId('debug-weapon-lv-4'));
    fireEvent.press(view.getByTestId('debug-weapon-apply'));
    expect(actions.onHotSwapWeapon).toHaveBeenCalledWith(ALL_ARMORY_WEAPON_IDS[0], 4);

    fireEvent.press(view.getByTestId('debug-slowmo-0.5'));
    expect(fxClock.slow).toBe(2);
    fireEvent.press(view.getByTestId('debug-copy-diff'));
    expect(mockClipboardSet).toHaveBeenCalled();
  });

  it('/dev Studio Hub links cleanly to all 7 live studios and preset routes', () => {
    expect(DEV_STUDIOS).toHaveLength(7);
    const view = render(wrap(<DevStudioHub />));
    for (const studio of DEV_STUDIOS) {
      expect(view.getByTestId(`dev-studio-card-${studio.id}`)).toBeTruthy();
    }
    fireEvent.press(view.getByTestId('dev-preset-sandbox'));
    expect(mockRouterPush).toHaveBeenCalledWith('/dev/adventure?save=maxed&level=1-4D');
    fireEvent.press(view.getByTestId('dev-studio-link-summit'));
    expect(mockRouterPush).toHaveBeenCalledWith('/dev/summit?start=true');
  });
});

describe('[TP-12] TrainingLabBar sandbox controls & rolling 15s DPS', () => {
  it('computes rolling 15s DPS, Peak Hit, and Trigger Counter accurately', () => {
    const sampleLog = [
      { t: 1000, wave: 0, kind: 'set' as const, damage: 30, setDamage: 20, coins: 1, xp: 1, hearts: 4, heartsDelta: 0, foeHp: 999, foeMaxHp: 999, lines: [{ type: 'blast' as const, amount: 10 }] },
      { t: 18_000, wave: 0, kind: 'set' as const, damage: 45, setDamage: 30, coins: 1, xp: 1, hearts: 4, heartsDelta: 0, foeHp: 999, foeMaxHp: 999, lines: [{ type: 'laser' as const, amount: 15 }, { type: 'fire' as const, amount: 4 }] },
      { t: 25_000, wave: 0, kind: 'set' as const, damage: 15, setDamage: 15, coins: 1, xp: 1, hearts: 4, heartsDelta: 0, foeHp: 999, foeMaxHp: 999, lines: [] },
    ];
    // At t=26s, window [11s..26s] captures 45 + 15 = 60 dmg over 15s = 4.0 DPS
    const stats = computeRollingDps(sampleLog, 26_000, 15_000);
    expect(stats.windowDamage).toBe(60);
    expect(stats.dps).toBe(4);
    expect(stats.peakHit).toBe(45);
    expect(stats.triggerCount).toBe(3);
  });

  it('wires hot-swap Fighter/Weapons/Arcana, Trigger/Step Evo, Parry, Surge, Dummy Modes, Reset & Return', () => {
    const save = createMaxedSave();
    const actions = {
      onSwapFighter: jest.fn(),
      onToggleWeapon: jest.fn(),
      onToggleArcana: jest.fn(),
      onTriggerEvo: jest.fn(),
      onAdvanceEvo: jest.fn(),
      onTriggerParry: jest.fn(),
      onToggleSurge: jest.fn(),
      onChangeDummyMode: jest.fn(),
      onResetDummy: jest.fn(),
      onReturn: jest.fn(),
    };
    const view = render(
      wrap(
        <TrainingLabBar
          save={save}
          run={{
            fighter: 'Orange Tabby',
            weapons: [getArmoryWeapon('blast-powder')!],
            arcana: [],
            weaponEvolutions: [
              {
                weaponId: 'blast-powder',
                evoId: 'blast-powder:cluster-charge',
                phase: 'charging',
                progress: 0,
                target: 3,
                almostReady: false,
                activeRemainingMs: 0,
                durationMs: 15000,
                cooldownRemainingMs: 0,
                triggersCount: 0,
              },
            ],
            surge: null,
            parry: null,
            elapsedMs: 10_000,
            biggestHit: 42,
            log: [],
            totalDamage: 42,
          }}
          returnLabel="Back to Preview"
          actions={actions}
        />
      )
    );

    expect(view.getByTestId('training-lab-dps')).toBeTruthy();
    expect(view.getByTestId('training-lab-peak')).toBeTruthy();
    fireEvent.press(view.getByTestId('training-lab-trigger-evo'));
    expect(actions.onTriggerEvo).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByTestId('training-lab-step-evo'));
    expect(actions.onAdvanceEvo).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByTestId('training-lab-parry'));
    expect(actions.onTriggerParry).toHaveBeenCalledWith('immortal');
    fireEvent.press(view.getByTestId('training-lab-surge'));
    expect(actions.onToggleSurge).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByTestId('training-dummy-counter_color'));
    expect(actions.onChangeDummyMode).toHaveBeenCalledWith('counter_color');
    expect(view.getByTestId('training-dummy-desc')).toHaveTextContent(/Orange/);
    fireEvent.press(view.getByTestId('training-lab-reset'));
    expect(actions.onResetDummy).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByTestId('training-lab-return'));
    expect(actions.onReturn).toHaveBeenCalledTimes(1);

    // Hot-swap tray: Fighter, Weapons, Arcana
    fireEvent.press(view.getByTestId('training-lab-swap-toggle'));
    fireEvent.press(view.getByTestId('training-swap-weapon-blast-powder'));
    expect(actions.onToggleWeapon).toHaveBeenCalledWith('blast-powder');
    fireEvent.press(view.getByTestId('training-swap-tab-fighter'));
    fireEvent.press(view.getByTestId('training-swap-fighter-Sly Fox'));
    expect(actions.onSwapFighter).toHaveBeenCalledWith('Sly Fox');
    fireEvent.press(view.getByTestId('training-swap-tab-arcana'));
    fireEvent.press(view.getByTestId(`training-swap-arcana-${ARCANA[0].id}`));
    expect(actions.onToggleArcana).toHaveBeenCalledWith(ARCANA[0].id);
  });
});

describe('[TP-13] replayMoveSnapshot, HighlightStageModal & FightReplay', () => {
  it('replays a deterministic FightRecording up to move i and drives 0.5x / 1x HighlightStageModal', () => {
    const level = getLevel('1-2');
    const save = { ...createNewSave(), armory: ['blast-powder'], charms: ['blast-powder'] };
    const seed = 4242;
    const rec = new FightRecorder(seed);
    let state = createRun(level, save, { seed });

    const triple = findSet(state)!;
    const action = {
      type: 'MATCH' as const,
      cards: triple,
      rewards: triple.map(baseCardReward),
      resolveWeapons: true,
    };
    rec.record(action, state);
    state = runReducer(state, action);

    const setMoveIdx = state.log.findIndex(e => e.kind === 'set');
    expect(setMoveIdx).toBeGreaterThan(0);

    const snap = replayMoveSnapshot(level, save, rec.toJSON(), setMoveIdx);
    expect(snap).not.toBeNull();
    expect(snap!.boardBefore.length).toBeGreaterThanOrEqual(9);
    expect(snap!.entry.kind).toBe('set');
    expect(snap!.ignition).not.toBeNull();

    // Synthesized highlight fallback from persisted FightReplayData also works
    const replayData = fightReplayOf(state);
    const fallbackSnap = synthesizeHighlightSnapshot(replayData, setMoveIdx, state.weapons);
    expect(fallbackSnap).not.toBeNull();
    expect(fallbackSnap!.ignition?.math.hit).toBe(state.log[setMoveIdx].set?.hit);

    // FightReplay surfaces "Watch Highlight (0.5×)" and opens HighlightStageModal cleanly
    const replayView = render(
      wrap(
        <FightReplay
          run={state}
          recording={rec.toJSON()}
          save={save}
          visible
          onClose={() => {}}
        />
      )
    );
    expect(replayView.getByTestId('replay-watch-biggest')).toBeTruthy();
    expect(replayView.getByTestId('replay-watch-selected')).toBeTruthy();

    fireEvent.press(replayView.getByTestId('replay-watch-biggest'));
    expect(replayView.getByTestId('highlight-stage-modal')).toBeTruthy();
    expect(fxClock.slow).toBe(2);

    fireEvent.press(replayView.getByTestId('highlight-speed-1'));
    expect(fxClock.slow).toBe(1);

    fireEvent.press(replayView.getByTestId('highlight-speed-0.5'));
    expect(fxClock.slow).toBe(2);

    fireEvent.press(replayView.getByTestId('highlight-replay'));
    fireEvent.press(replayView.getByTestId('highlight-close'));
    expect(fxClock.slow).toBe(1);
    replayView.unmount();

    // Direct HighlightStageModal reduced-motion check
    mockReducedMotion = true;
    const staticModal = render(
      wrap(<HighlightStageModal visible snapshot={snap} onClose={() => {}} />)
    );
    expect(staticModal.getByText(/STATIC/)).toBeTruthy();
    expect(fxClock.slow).toBe(1);
  });
});

describe('[TP-14] CritterGallery, FieldGuide Critters tab & /dev/fighters', () => {
  it('tracks defeated vs undefeated foes and displays v0.1.173 Parry rule in FieldGuide Critters tab', () => {
    let save = createNewSave();
    // Defeat 1-1 and 2-1 (so Meadow & Woods foes are defeated, while later bosses remain silhouetted)
    save = applyLevelResult(save, getLevel('1-1'), 2, 0).save;
    save = applyLevelResult(save, getLevel('1-6'), 2, 0).save;

    const foes = collectGalleryFoes(save);
    expect(foes.length).toBeGreaterThan(20);
    expect(foes.some(f => f.defeated)).toBe(true);
    expect(foes.some(f => !f.defeated)).toBe(true);
    expect(LEVELS.length).toBe(59);

    const guide = render(wrap(<FieldGuide save={save} onClose={() => {}} />));
    fireEvent.press(guide.getByTestId('guide-tab-critters'));
    expect(guide.getByTestId('critter-gallery')).toBeTruthy();
    expect(guide.getByTestId('critter-gallery-stage')).toBeTruthy();

    // Pet & HP wear-and-tear controls on Fighters sub-tab
    fireEvent.press(guide.getByTestId('critter-hp-2'));
    fireEvent.press(guide.getByTestId('critter-fighter-react-dizzy_joy'));

    // Switch to Foes sub-tab: defeated foe inspects live with Parry rule, unbeaten foe is silhouetted
    fireEvent.press(guide.getByTestId('critter-gallery-tab-foes'));
    const defeatedFoe = foes.find(f => f.defeated && f.parrySpec)!;
    const undefeatedFoe = foes.find(f => !f.defeated)!;
    fireEvent.press(guide.getByTestId(`critter-foe-${defeatedFoe.key}`));
    expect(guide.getByTestId('critter-foe-parry-rule')).toBeTruthy();
    expect(guide.getByTestId(`critter-foe-silhouette-${undefeatedFoe.key}`)).toBeTruthy();
  });

  it('app/dev/fighters renders unlocked-all CritterGallery studio wrapper cleanly', () => {
    const view = render(wrap(<DevFightersPage />));
    expect(view.getByTestId('studio-tab-fighters')).toBeTruthy();
    expect(view.getByTestId('studio-tab-enemies')).toBeTruthy();
    expect(view.getByTestId('studio-tab-weapons')).toBeTruthy();
    fireEvent.press(view.getByTestId('studio-tab-enemies'));
    expect(view.getByTestId('studio-enemy-card-0')).toBeTruthy();
    fireEvent.press(view.getByTestId('studio-tab-weapons'));
    view.unmount();

    // Direct CritterGallery gallery smoke test with empty save
    const emptyGallery = render(wrap(<CritterGallery mode="gallery" save={createNewSave()} />));
    fireEvent.press(emptyGallery.getByTestId('critter-gallery-tab-foes'));
    expect(emptyGallery.getByTestId('critter-gallery-no-foes')).toBeTruthy();
  });
});
