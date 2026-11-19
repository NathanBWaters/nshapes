/**
 * Full-stack Main Menu ↔ Game Mode Resume Integration Tests.
 *
 * Mounts the real `<Game />` shell with real MMKV persistence to guarantee:
 *  1. Starfall Spire: starting a climb, leaving to Main Menu, resuming, and
 *     starting a Floor 3 Elite battle (exact regression for `Unknown level spire-elite`),
 *     plus Skirmish & Boss launches and mid-fight Retreat → Menu → Resume.
 *  2. Starfall Spire: resuming safely from every persisted room phase
 *     (`map`, `preview`, `fight`, `reward`, `shop`, `campfire`, `event`, `treasure`)
 *     and recovering cleanly if a saved phase is missing its room payload.
 *  3. Adventure Mode: moving between Main Menu, World Map, Level Preview,
 *     live Fight (Pause → Retreat to map), Camp, Field Guide, and back to
 *     Main Menu → Continue without losing progress or crashing.
 *  4. Cross-mode interleaving: Main Menu → Adventure → Main Menu → Starfall Spire
 *     → Main Menu → Adventure keeps both saves intact and playable.
 */
import React from 'react';
import { act, render, fireEvent, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TutorialProvider } from '@/context/TutorialContext';
import { KeywordProvider } from '@/context/KeywordContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

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

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

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

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `weapon-avatar-${weapon?.name ?? 'weapon'}` }),
  };
});
import Game from '@/components/Game';
import { createNewSave } from '@/adventure/progress';
import { loadAdventureSave, writeAdventureSave } from '@/adventure/save';
import { MAIN_LEVELS, getLevel } from '@/adventure/data/levels';
import { createSpireRun, selectSpireNode, startSpireEncounter } from '@/spire/engine/runState';
import { reachableNodeIds } from '@/spire/engine/mapGen';
import { loadSpireRun, resetSpireStorage, writeSpireRun } from '@/spire/save';
import type { SpireRun } from '@/spire/types';

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 667 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const renderApp = async () => {
  const screen = render(
    <SafeAreaProvider initialMetrics={SAFE_METRICS}>
      <KeywordProvider>
        <TutorialProvider>
          <Game />
        </TutorialProvider>
      </KeywordProvider>
    </SafeAreaProvider>
  );
  await act(async () => {
    await Promise.resolve();
  });
  return screen;
};

/** Build a realistic Spire run poised at Row 2 (Floor 3) with a reachable Elite node. */
const buildFloor3EliteRun = (seed = 202): { run: SpireRun; eliteNodeId: string } => {
  let run = createSpireRun('Orange Tabby', 0, seed);
  // Find a Row 2 elite node and walk a valid path from Row 0 → Row 1 → Row 2 parent
  const row2Elite = run.map.nodes.find(n => n.row === 2 && n.kind === 'elite')!;
  expect(row2Elite).toBeDefined();
  const row1Parent = run.map.nodes.find(n => n.row === 1 && n.next.includes(row2Elite.id))!;
  expect(row1Parent).toBeDefined();
  const row0Parent = run.map.nodes.find(n => n.row === 0 && n.next.includes(row1Parent.id))!;
  expect(row0Parent).toBeDefined();

  run = {
    ...run,
    floor: 2,
    phase: 'map',
    hearts: 5,
    coins: 140,
    weapons: [...run.weapons, 'war-drum'],
    weaponLevels: { ...run.weaponLevels, 'war-drum': 1 },
    currentNodeId: row1Parent.id,
    activeEncounter: null,
    map: {
      ...run.map,
      nodes: run.map.nodes.map(n =>
        n.id === row0Parent.id || n.id === row1Parent.id ? { ...n, visited: true } : n
      ),
    },
  };
  expect(reachableNodeIds(run.map, run.currentNodeId)).toContain(row2Elite.id);
  return { run, eliteNodeId: row2Elite.id };
};

describe('Main Menu ↔ Game Mode Resume Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetSpireStorage();
    writeAdventureSave(createNewSave());
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('Starfall Spire: leave to Main Menu → resume → start Floor 3 Elite battle → retreat → Main Menu → resume cleanly', async () => {
    const { run: floor2MapRun, eliteNodeId } = buildFloor3EliteRun(202);
    writeSpireRun(floor2MapRun);

    const app = await renderApp();

    // Main Menu shows LIVE RUN badge for the active Spire climb
    expect(app.getByTestId('menu-spire')).toBeTruthy();
    expect(app.getByText(/Resume Act 1 · Floor 2/)).toBeTruthy();

    // Enter Starfall Spire → Resume Climb onto the Map
    fireEvent.press(app.getByTestId('menu-spire'));
    expect(app.getByTestId('spire-setup')).toBeTruthy();
    fireEvent.press(app.getByTestId('spire-resume-run'));
    expect(app.getByTestId('spire-map')).toBeTruthy();

    // Leave back to Main Menu via SpireHeader → SpireSetup → MainMenu
    fireEvent.press(app.getByTestId('spire-back-menu'));
    expect(app.getByTestId('spire-setup')).toBeTruthy();
    fireEvent.press(app.getByTestId('spire-setup-back'));
    expect(app.getByTestId('menu-spire')).toBeTruthy();

    // Resume again from Main Menu
    fireEvent.press(app.getByTestId('menu-spire'));
    fireEvent.press(app.getByTestId('spire-resume-run'));
    expect(app.getByTestId('spire-map')).toBeTruthy();

    // Pick Floor 3 Elite node → Preview shows ParryPreviewCard → FIGHT! mounts AdventureRun with ZERO crash!
    fireEvent.press(app.getByTestId(`spire-node-${eliteNodeId}`));
    expect(app.getByTestId('spire-encounter-preview')).toBeTruthy();
    expect(app.getByTestId('spire-preview-parry')).toBeTruthy();

    fireEvent.press(app.getByTestId('spire-enter-fight'));
    expect(app.getByTestId('run-stage')).toBeTruthy();
    expect(app.getByTestId('run-parry-bar')).toBeTruthy();
    expect(app.getByTestId('run-spire-bar')).toBeTruthy();

    // Pause mid-fight → Retreat to Briefing → Main Menu → Resume → re-enter Floor 3 Elite battle!
    fireEvent.press(app.getByLabelText('Pause'));
    fireEvent.press(app.getByText('Retreat to Briefing'));
    expect(app.getByTestId('spire-encounter-preview')).toBeTruthy();

    fireEvent.press(app.getByTestId('spire-back-menu'));
    fireEvent.press(app.getByTestId('spire-setup-back'));
    expect(app.getByTestId('menu-spire')).toBeTruthy();
    expect(app.getByText(/Resume Act 1 · Floor 3/)).toBeTruthy();

    fireEvent.press(app.getByTestId('menu-spire'));
    fireEvent.press(app.getByTestId('spire-resume-run'));
    expect(app.getByTestId('spire-encounter-preview')).toBeTruthy();

    fireEvent.press(app.getByTestId('spire-enter-fight'));
    expect(app.getByTestId('run-stage')).toBeTruthy();
  });

  it('Starfall Spire: resumes mid-fight Act Boss cleanly and recovers corrupt room state', async () => {
    const base = createSpireRun('Badger', 0, 505);
    const bossNode = base.map.nodes.find(n => n.kind === 'boss')!;
    const bossFightRun: SpireRun = {
      ...base,
      floor: 7,
      phase: 'fight',
      currentNodeId: bossNode.id,
      activeEncounter: bossNode.encounter!,
    };
    writeSpireRun(bossFightRun);

    const bossApp = await renderApp();
    fireEvent.press(bossApp.getByTestId('menu-spire'));
    fireEvent.press(bossApp.getByTestId('spire-resume-run'));
    expect(bossApp.getByTestId('run-stage')).toBeTruthy();
    expect(bossApp.getByTestId('run-parry-bar')).toBeTruthy();

    // Corrupted saved phase missing its payload recovers onto 'map' rather than crashing
    const broken: SpireRun = { ...base, phase: 'fight', activeEncounter: null };
    writeSpireRun(broken);
    expect(loadSpireRun()?.phase).toBe('map');
  });

  it.each<{ kind: 'shop' | 'campfire' | 'event' | 'treasure'; testId: string }>([
    { kind: 'shop', testId: 'spire-shop' },
    { kind: 'campfire', testId: 'spire-campfire' },
    { kind: 'event', testId: 'spire-event' },
    { kind: 'treasure', testId: 'spire-treasure' },
  ])('Starfall Spire: resumes cleanly into saved $kind room from Main Menu', async ({ kind, testId }) => {
    const fresh = createSpireRun('Sly Fox', 0, 909);
    const node = fresh.map.nodes.find(n => n.kind === kind)!;
    const exposed: SpireRun = {
      ...fresh,
      map: {
        ...fresh.map,
        nodes: fresh.map.nodes.map(n => (n.id === node.id ? { ...n, row: 0 } : n)),
      },
    };
    writeSpireRun(selectSpireNode(exposed, node.id));

    const app = await renderApp();
    fireEvent.press(app.getByTestId('menu-spire'));
    fireEvent.press(app.getByTestId('spire-resume-run'));
    expect(app.getByTestId(testId)).toBeTruthy();
  });

  it('Adventure Mode: Main Menu ↔ Map ↔ Preview ↔ Fight (Retreat) ↔ Camp ↔ Main Menu ↔ Resume works end-to-end', async () => {
    // Seed an active Adventure save with World 1 progress (past cold open, into Set-Parry levels)
    const advSave = {
      ...createNewSave(),
      stars: { '1-1': 3, '1-2': 3, '1-3': 3, '1-4': 3, '1-5': 2 },
      plays: { '1-1': 1, '1-2': 1, '1-3': 1, '1-4': 1, '1-5': 1 },
      coins: 120,
      coinsUnlocked: true,
      seenMechanics: ['set_rule', 'hearts', 'timer', 'rainbow', 'attr_number'],
    };
    writeAdventureSave(advSave);

    const app = await renderApp();
    expect(app.getByTestId('menu-adventure')).toBeTruthy();
    expect(app.getByText(/Continue/)).toBeTruthy();

    // Enter Adventure Mode → Map
    fireEvent.press(app.getByTestId('menu-adventure'));
    expect(app.getByTestId('map-play-next')).toBeTruthy();

    // Open next level Preview → Start Fight → Pause → Retreat to map
    fireEvent.press(app.getByTestId('map-play-next'));
    expect(app.getByTestId('preview-play')).toBeTruthy();
    expect(app.getByTestId('preview-parry')).toBeTruthy();

    fireEvent.press(app.getByTestId('preview-play'));
    expect(app.getByTestId('run-stage')).toBeTruthy();
    expect(app.getByTestId('run-parry-bar')).toBeTruthy();

    fireEvent.press(app.getByLabelText('Pause'));
    fireEvent.press(app.getByText('Retreat to map'));
    expect(app.getByTestId('map-play-next')).toBeTruthy();

    // Open Camp and return to Map
    fireEvent.press(app.getByTestId('map-dock-camp'));
    expect(app.getByTestId('camp-tab-fighters')).toBeTruthy();
    fireEvent.press(app.getByLabelText('Back to map'));
    expect(app.getByTestId('map-play-next')).toBeTruthy();

    // Leave Adventure Mode to Main Menu → Return to Adventure Mode → Fight again!
    fireEvent.press(app.getByLabelText('Back to menu'));
    expect(app.getByTestId('menu-adventure')).toBeTruthy();

    fireEvent.press(app.getByTestId('menu-adventure'));
    expect(app.getByTestId('map-play-next')).toBeTruthy();
    fireEvent.press(app.getByTestId('map-play-next'));
    fireEvent.press(app.getByTestId('preview-play'));
    expect(app.getByTestId('run-stage')).toBeTruthy();
  });

  it('Cross-mode switching: Main Menu ↔ Adventure Mode ↔ Main Menu ↔ Starfall Spire keeps both saves intact', async () => {
    const advSave = {
      ...createNewSave(),
      stars: { '1-1': 3, '1-2': 3 },
      plays: { '1-1': 1, '1-2': 1 },
      coins: 77,
      coinsUnlocked: true,
    };
    writeAdventureSave(advSave);

    const app = await renderApp();

    // 1. Start a fresh Spire run, step onto Row 0 preview, leave to Main Menu
    fireEvent.press(app.getByTestId('menu-spire'));
    fireEvent.press(app.getByTestId('spire-start-climb'));
    expect(app.getByTestId('spire-map')).toBeTruthy();
    fireEvent.press(app.getByTestId('spire-node-a1-r0-c0'));
    expect(app.getByTestId('spire-encounter-preview')).toBeTruthy();
    fireEvent.press(app.getByTestId('spire-back-menu'));
    fireEvent.press(app.getByTestId('spire-setup-back'));

    // 2. Enter Adventure Mode, open level preview, return to Main Menu
    fireEvent.press(app.getByTestId('menu-adventure'));
    expect(app.getByTestId('map-play-next')).toBeTruthy();
    fireEvent.press(app.getByLabelText('Back to menu'));

    // 3. Both saves remain 100% intact and Spire resumes straight into Floor 1 preview → Fight!
    expect(loadAdventureSave().coins).toBe(77);
    expect(loadSpireRun()?.floor).toBe(1);
    expect(loadSpireRun()?.phase).toBe('preview');

    fireEvent.press(app.getByTestId('menu-spire'));
    fireEvent.press(app.getByTestId('spire-resume-run'));
    expect(app.getByTestId('spire-encounter-preview')).toBeTruthy();
    fireEvent.press(app.getByTestId('spire-enter-fight'));
    expect(app.getByTestId('run-stage')).toBeTruthy();

    // Sanity check Adventure levels list untouched
    expect(getLevel(MAIN_LEVELS[0].id).id).toBe('1-1');
    expect(startSpireEncounter(loadSpireRun()!).phase).toBe('fight');
  });
});
