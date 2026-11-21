/**
 * Brotato-style Cumulative Weapon/Passive Damage Story (`damageStory.ts`)
 * & Shared Component (`BattleDamageStory.tsx`) tests across Adventure Mode
 * and Starfall Spire.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  buildDamageStory,
  buildSpireRunDamageStory,
  mergeSpireDamageLedger,
  resolveDamageSourceMeta,
  type DamageSourceSummary,
  type DamageStory,
} from '@/adventure/engine/damageStory';
import { ARCANA } from '@/adventure/data/arcana';
import { getEvolutionRecipe } from '@/adventure/data/evolutions';
import { PASSIVES } from '@/adventure/data/passives';
import { getSkillNode } from '@/adventure/data/skillTrees';
import { simulateRun, BOTS } from '@/adventure/engine/bot';
import { getLevel } from '@/adventure/data/levels';
import { applyLevelResult, createMaxedSave, createNewSave } from '@/adventure/progress';
import { computeStars } from '@/adventure/engine/run';
import BattleDamageStory from '@/adventure/components/BattleDamageStory';
import FightReplay from '@/adventure/components/FightReplay';
import LevelResults from '@/adventure/components/LevelResults';
import type { FightReplayData } from '@/adventure/history';
import SpireRewardScreen from '@/spire/components/SpireRewardScreen';
import SpireEndScreen from '@/spire/components/SpireEndScreen';
import { completeSpireBattle, createSpireRun, selectSpireNode } from '@/spire/engine/runState';
import { buildSpireWeaponBuilds, SPIRE_FIGHT_FEATURES, spireEncounterToLevel, spireHeldWeapons, spireRunOverrides, spireRunToVirtualSave } from '@/spire/engine/bridge';
import type { SpireLastFightSnapshot } from '@/spire/types';

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
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
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
  ClipPath: 'ClipPath',
  Pattern: 'Pattern',
}));

jest.mock('@/utils/storage', () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));

jest.mock('@/audio', () => {
  const band = new Proxy(
    {},
    {
      get: (_t, key) => (key === 'inFight' ? false : key === 'gridMs' ? 62.5 : () => undefined),
    }
  );
  return { band, sfx: () => undefined, sound: { play: () => undefined } };
});

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View: RNView, Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return ReactActual.createElement(
      RNView,
      { testID: `icon-${name}` },
      ReactActual.createElement(RNText, null, name)
    );
  };
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
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy: { name: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `enemy-avatar-${enemy.name}` }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon: { id: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `weapon-avatar-${weapon.id}` }),
  };
});

const wrap = (node: React.ReactElement) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

const noop = () => {};

const runGearedFight = () => {
  const save = createMaxedSave();
  const level = getLevel('2-4');
  const sim = simulateRun(level, save, BOTS.expert, 7);
  return { save, level, run: sim.state };
};

describe('damageStory attribution & timeline engine', () => {
  it('conserves exact fight damage and produces monotonic cumulative timelines on a geared Adventure fight', () => {
    const { run } = runGearedFight();
    const story = buildDamageStory(run);

    expect(story.totalDamage).toBeGreaterThan(0);
    expect(story.xAxisMode).toBe('time');
    expect(story.sources.length).toBeGreaterThanOrEqual(3);
    expect(story.chartSources.length).toBeGreaterThan(0);
    expect(story.chartSources.length).toBeLessThanOrEqual(5);

    // Conservation: sum of individual sources equals total fight damage within rounding tolerance
    const attributedSum = story.sources.reduce((acc, s) => acc + s.totalDamage, 0);
    expect(Math.abs(attributedSum - story.totalDamage)).toBeLessThanOrEqual(story.sources.length);

    // Sources sorted descending by cumulative damage
    for (let i = 1; i < story.sources.length; i++) {
      expect(story.sources[i - 1].totalDamage).toBeGreaterThanOrEqual(story.sources[i].totalDamage);
    }

    // Weapon attribution includes canonical weaponId so WeaponExplainer can inspect it
    const weapons = story.sources.filter(s => s.kind === 'weapon');
    expect(weapons.length).toBeGreaterThan(0);
    for (const w of weapons) {
      expect(typeof w.weaponId).toBe('string');
      expect(w.weaponId!.length).toBeGreaterThan(0);
    }

    // Timeline starts at 0 and climbs monotonically to totalDamage
    expect(story.points[0].totalCumulative).toBe(0);
    for (let i = 1; i < story.points.length; i++) {
      expect(story.points[i].totalCumulative).toBeGreaterThanOrEqual(story.points[i - 1].totalCumulative);
    }
    expect(Math.round(story.points[story.points.length - 1].totalCumulative)).toBe(Math.round(story.totalDamage));

    // Crescendo beats stay cleanly inside [0.06, 0.985] and strictly ascending
    expect(story.crescendoBeats.length).toBeGreaterThan(0);
    expect(story.crescendoBeats.length).toBeLessThanOrEqual(7);
    for (let i = 0; i < story.crescendoBeats.length; i++) {
      const b = story.crescendoBeats[i];
      expect(b.progress).toBeGreaterThanOrEqual(0.06);
      expect(b.progress).toBeLessThanOrEqual(0.985);
      if (i > 0) expect(b.pointIndex).toBeGreaterThan(story.crescendoBeats[i - 1].pointIndex);
    }

    expect(story.headline.length).toBeGreaterThan(10);
  });

  it('accumulates floor-by-floor Spire damage across wins and defeats into a full-climb story', () => {
    const { run: fight1 } = runGearedFight();
    const { run: fight2 } = runGearedFight();

    const step1 = mergeSpireDamageLedger(undefined, undefined, 1, fight1);
    const step2 = mergeSpireDamageLedger(step1.sourceDamage, step1.floorLedger, 2, fight2);

    expect(step2.floorLedger).toHaveLength(2);
    expect(step2.floorLedger[0].floor).toBe(1);
    expect(step2.floorLedger[1].floor).toBe(2);

    const climbStory = buildSpireRunDamageStory(step2.sourceDamage, step2.floorLedger);
    expect(climbStory).not.toBeNull();
    expect(climbStory!.xAxisMode).toBe('floors');
    expect(climbStory!.points).toHaveLength(3); // Start + Fl 1 + Fl 2
    expect(climbStory!.points[0].label).toBe('Start');
    expect(climbStory!.points[1].label).toBe('Fl 1');
    expect(climbStory!.points[2].label).toBe('Fl 2');
    expect(Math.round(climbStory!.totalDamage)).toBe(Math.round(fight1.totalDamage + fight2.totalDamage));

    // Complete a real Spire battle (both victory & defeat) and verify sourceDamage persists on SpireRun.stats
    let spire = createSpireRun('Orange Tabby', 0, 101);
    const firstNode = spire.map.nodes.find(n => n.row === 0 && n.encounter);
    expect(firstNode).toBeTruthy();
    spire = selectSpireNode(spire, firstNode!.id);
    const lvl = spireEncounterToLevel(spire, spire.activeEncounter!);
    const simWon = simulateRun(lvl, createNewSave(), BOTS.expert, 17).state;
    const wonSpire = completeSpireBattle(spire, { ...simWon, status: 'won', endReason: 'defeated', foeHp: 0 });
    expect(wonSpire.stats.sourceDamage).toBeDefined();
    expect(wonSpire.stats.floorLedger).toHaveLength(1);
    expect(Object.keys(wonSpire.stats.sourceDamage!).length).toBeGreaterThan(0);

    const lostSpire = completeSpireBattle(spire, { ...simWon, status: 'lost', endReason: 'hearts', hearts: 0 });
    expect(lostSpire.phase).toBe('defeat');
    expect(lostSpire.stats.sourceDamage).toBeDefined();
    expect(lostSpire.stats.floorLedger).toHaveLength(1);
  });

  it('attributes Spire fights with zero Power Scaling and credits active Evolutions by their canonical name & kind', () => {
    let spire = createSpireRun('Corgi', 0, 2027);
    const firstNode = spire.map.nodes.find(n => n.row === 0 && n.encounter)!;
    spire = selectSpireNode(spire, firstNode.id);
    const sim = simulateRun(
      spireEncounterToLevel(spire, spire.activeEncounter!),
      spireRunToVirtualSave(spire),
      BOTS.expert,
      42,
      undefined,
      {
        skipPicks: true,
        features: new Set(SPIRE_FIGHT_FEATURES),
        overrides: spireRunOverrides(spire),
      }
    );
    const story = buildDamageStory(sim.state);
    expect(story.sources.find(s => s.kind === 'power')).toBeUndefined();
    expect(story.sources.find(s => s.name === 'Active Evolution')).toBeUndefined();
    if (sim.state.forgedRecipes.length > 0) {
      const evos = story.sources.filter(s => s.kind === 'evolution');
      expect(evos.length).toBeGreaterThan(0);
    }
  });
});

describe('BattleDamageStory shared UI across Adventure Mode and Starfall Spire', () => {
  it('renders by default on geared LevelResults and opens canonical WeaponExplainer when tapping a weapon row', () => {
    const { save, level, run } = runGearedFight();
    const stars = Math.max(1, computeStars(run));
    const result = applyLevelResult(save, level, stars, 0, run);
    const story = buildDamageStory(run);
    const weaponIdx = story.sources.slice(0, 4).findIndex(s => s.kind === 'weapon');

    const view = render(
      wrap(
        <LevelResults
          level={level}
          run={run}
          stars={stars}
          result={result}
          unlocksRevealed
          nextLevel={null}
          nextUnlocked={false}
          onRetry={noop}
          onNext={noop}
          onMap={noop}
          onCamp={noop}
        />
      )
    );

    expect(view.getByTestId('battle-damage-story')).toBeTruthy();
    expect(view.getByTestId('battle-damage-story-chart')).toBeTruthy();
    expect(view.getByTestId('battle-damage-story-rows')).toBeTruthy();
    expect(view.getByTestId('battle-damage-story-replay-btn')).toBeTruthy();

    // Tap a row (weapon if in top 4, else row 0) to isolate its curve & open inline inspector
    const tapIdx = weaponIdx >= 0 ? weaponIdx : 0;
    fireEvent.press(view.getByTestId(`battle-damage-story-row-${tapIdx}`));
    expect(view.getByTestId('battle-damage-story-inspector')).toBeTruthy();
  });

  it('respects reduced motion by hiding the 3s replay trigger and showing final total immediately', () => {
    const { run } = runGearedFight();
    const story = buildDamageStory(run);
    const view = render(
      wrap(<BattleDamageStory story={story} weaponBuilds={run.weaponBuilds} reduced muted />)
    );
    expect(view.queryByTestId('battle-damage-story-replay-btn')).toBeNull();
    expect(view.getByTestId('battle-damage-story-total').props.children.join('')).toContain(
      Math.round(story.totalDamage).toLocaleString()
    );
  });

  it('renders by default on SpireRewardScreen and SpireEndScreen (with Climb / Last Fight scope toggle)', () => {
    const { run: fight1 } = runGearedFight();
    const { run: fight2 } = runGearedFight();
    let spire = createSpireRun('Sly Fox', 0, 555);
    const firstNode = spire.map.nodes.find(n => n.row === 0 && n.encounter)!;
    spire = selectSpireNode(spire, firstNode.id);
    // Win floor 1
    spire = completeSpireBattle(spire, { ...fight1, status: 'won', endReason: 'defeated', foeHp: 0 });
    const snapshot: SpireLastFightSnapshot = {
      run: fight2,
      weapons: spireHeldWeapons(spire),
      builds: buildSpireWeaponBuilds(spire),
    };

    const rewardView = render(
      wrap(
        <SpireRewardScreen
          run={spire}
          reward={spire.reward!}
          lastFight={snapshot}
          onClaimWeapon={noop}
          onRerollWeapons={noop}
          onSkipWeapon={noop}
          onClaimArcana={noop}
          onSkipArcana={noop}
          onClaimSkill={noop}
          onSkipSkill={noop}
          onContinue={noop}
        />
      )
    );
    expect(rewardView.getByTestId('spire-reward-damage-story')).toBeTruthy();
    expect(rewardView.getByTestId('spire-reward-damage-story-chart')).toBeTruthy();
    rewardView.unmount();

    // Add a 2nd floor to spire.stats so SpireEndScreen offers both Full Climb and Final Fight toggle
    const merged2 = mergeSpireDamageLedger(spire.stats.sourceDamage, spire.stats.floorLedger, 2, fight2);
    const endedSpire = {
      ...spire,
      floor: 2,
      phase: 'victory' as const,
      stats: { ...spire.stats, ...merged2, floorsCleared: 2 },
    };

    const endView = render(
      wrap(
        <SpireEndScreen
          run={endedSpire}
          victory
          lastFight={snapshot}
          onNewRun={noop}
          onExitToMenu={noop}
        />
      )
    );
    expect(endView.getByTestId('spire-end-damage-story')).toBeTruthy();
    expect(endView.getByTestId('spire-story-scope-climb')).toBeTruthy();
    expect(endView.getByTestId('spire-story-scope-final')).toBeTruthy();

    fireEvent.press(endView.getByTestId('spire-story-scope-final'));
    expect(endView.getByText('FINAL FIGHT DAMAGE')).toBeTruthy();
    fireEvent.press(endView.getByTestId('spire-story-scope-climb'));
    expect(endView.getByText('FULL CLIMB DAMAGE')).toBeTruthy();
  });

  it('resolves Arcana, Trap Defusal, Workshop Upgrades, and Summit copy cleanly in damageStory', () => {
    // Arcana by display name & explicit ref (including Tempo Surge, which must NOT collide with Shading Surge!)
    expect(resolveDamageSourceMeta({ label: 'Monochrome Pact' }).id).toBe('arcana:monochrome_pact');
    expect(resolveDamageSourceMeta({ label: 'Tempo Surge' }).id).toBe('arcana:tempo_surge');
    expect(resolveDamageSourceMeta({ label: 'Prismatic Fever' }).id).toBe('arcana:prismatic_fever');
    expect(resolveDamageSourceMeta({ sourceRef: 'arcana:glass_prism' })).toMatchObject({
      id: 'arcana:glass_prism',
      name: 'Glass Prism',
    });

    // Shading Surge still resolves to bonus:surge
    expect(resolveDamageSourceMeta({ label: 'Shading Surge' }).id).toBe('bonus:surge');

    // Traps cleared flat item resolves to bonus:traps
    expect(resolveDamageSourceMeta({ label: 'Traps cleared' })).toMatchObject({
      id: 'bonus:traps',
      name: 'Trap Defusal',
    });

    // Workshop upgrade & Role Set Bonus
    expect(resolveDamageSourceMeta({ label: 'Heavy Hitter' }).id).toBe('upgrade:heavy_hitter');
    expect(resolveDamageSourceMeta({ sourceRef: 'role:damage' })).toMatchObject({
      id: 'role:damage',
      name: 'Damage Set Bonus',
    });

    // Full climb story uses Starfall Summit wording (never stale "Spire" copy)
    const { run: fight } = runGearedFight();
    const merged = mergeSpireDamageLedger(undefined, undefined, 1, fight);
    const climbStory = buildSpireRunDamageStory(merged.sourceDamage, merged.floorLedger);
    expect(climbStory).not.toBeNull();
    expect(climbStory!.headline).not.toMatch(/\bSpire\b/i);
  });

  it('opens rich DamageSourceExplainer cards for every non-weapon breakdown source and keeps WeaponExplainer for weapons', () => {
    const phoenix = getEvolutionRecipe('phoenix-pyre');
    const purrPunch = getSkillNode('tabby-0-1')!;
    const monochrome = ARCANA.find(a => a.id === 'monochrome_pact')!;

    const makeSource = (
      partial: Pick<DamageSourceSummary, 'id' | 'name' | 'kind' | 'icon' | 'color' | 'totalDamage'> & { weaponId?: string }
    ): DamageSourceSummary => ({
      ...partial,
      share: partial.totalDamage / 1600,
      hits: 4,
      biggestHit: Math.round(partial.totalDamage * 0.4),
      cumulative: [0, partial.totalDamage],
    });

    const sources: DamageSourceSummary[] = [
      makeSource({ id: 'weapon:blast-powder', weaponId: 'blast-powder', name: 'Blast Powder', kind: 'weapon', icon: 'lorc/bright-explosion', color: '#F5B800', totalDamage: 200 }),
      makeSource({ id: 'evo:phoenix-pyre', name: phoenix.name, kind: 'evolution', icon: phoenix.icon, color: '#16AA98', totalDamage: 180 }),
      makeSource({ id: 'bonus:parry', name: 'Set-Parry Counter', kind: 'bonus', icon: 'lorc/sword-clash', color: '#F0483E', totalDamage: 160 }),
      makeSource({ id: 'bonus:surge', name: 'Shading Surge', kind: 'bonus', icon: 'lorc/power-lightning', color: '#38BDF8', totalDamage: 150 }),
      makeSource({ id: 'bonus:rainbow', name: 'Rainbow Strike', kind: 'bonus', icon: 'lorc/rainbow-star', color: '#FB923C', totalDamage: 140 }),
      makeSource({ id: 'bonus:purity', name: 'Purity Chain', kind: 'bonus', icon: 'lorc/crystal-shine', color: '#C084FC', totalDamage: 130 }),
      makeSource({ id: 'bonus:traps', name: 'Trap Defusal', kind: 'bonus', icon: 'lorc/checked-shield', color: '#4ADE80', totalDamage: 120 }),
      makeSource({ id: 'passive:scrappy', name: PASSIVES.scrappy.name, kind: 'passive', icon: PASSIVES.scrappy.icon, color: '#F5B800', totalDamage: 110 }),
      makeSource({ id: 'node:tabby-0-1', name: purrPunch.name, kind: 'skill', icon: purrPunch.icon, color: '#16AA98', totalDamage: 100 }),
      makeSource({ id: 'role:damage', name: 'Damage Set Bonus', kind: 'bonus', icon: 'delapouite/star-formation', color: '#F0483E', totalDamage: 90 }),
      makeSource({ id: 'arcana:monochrome_pact', name: monochrome.name, kind: 'bonus', icon: monochrome.icon, color: '#38BDF8', totalDamage: 80 }),
      makeSource({ id: 'upgrade:heavy_hitter', name: 'Heavy Hitter', kind: 'passive', icon: 'lorc/fist', color: '#FB923C', totalDamage: 60 }),
      makeSource({ id: 'set:cards', name: 'Matched Sets', kind: 'set', icon: 'lorc/crossed-swords', color: '#C084FC', totalDamage: 30 }),
      makeSource({ id: 'set:card_bonus', name: 'Power Cards', kind: 'bonus', icon: 'lorc/flat-star', color: '#4ADE80', totalDamage: 20 }),
      makeSource({ id: 'power:scale', name: 'Power Scaling', kind: 'power', icon: 'lorc/power-lightning', color: '#F5B800', totalDamage: 15 }),
      makeSource({ id: 'fx:burn', name: 'Burn Damage', kind: 'bonus', icon: 'lorc/candle-flame', color: '#F0483E', totalDamage: 15 }),
    ];

    const story: DamageStory = {
      totalDamage: 1600,
      durationMs: 60000,
      xAxisMode: 'time',
      sources,
      chartSources: sources.slice(0, 5),
      points: [
        { tMs: 0, label: '0:00', totalCumulative: 0, stepDamage: 0, peakSourceId: null },
        { tMs: 60000, label: '1:00', totalCumulative: 1600, stepDamage: 1600, peakSourceId: 'weapon:blast-powder' },
      ],
      headline: 'Blast Powder led with 200 dmg (13%)',
      crescendoBeats: [],
    };

    const view = render(wrap(<BattleDamageStory story={story} reduced muted />));
    fireEvent.press(view.getByTestId('battle-damage-story-show-all'));

    // 1. Standard weapon MUST render canonical WeaponExplainer (never DamageSourceExplainer!)
    fireEvent.press(view.getByTestId('battle-damage-story-row-0'));
    expect(view.getByTestId('weapon-explainer-blast-powder')).toBeTruthy();
    expect(view.queryByTestId('damage-source-explainer-weapon:blast-powder')).toBeNull();

    // 2. Evolution
    fireEvent.press(view.getByTestId('battle-damage-story-row-1'));
    expect(view.getByTestId('damage-source-explainer-evo:phoenix-pyre')).toBeTruthy();
    expect(view.getByTestId('damage-source-what-evo:phoenix-pyre')).toHaveTextContent(phoenix.activeText, { exact: false });
    expect(view.getByTestId('damage-source-what-evo:phoenix-pyre')).toHaveTextContent(/Lasts 30s.*\+10 opening hit.*\+2 flat Set damage.*×1\.5 Set damage/);
    expect(view.getByTestId('damage-source-result-evo:phoenix-pyre')).toHaveTextContent(/THIS FIGHT.*180 cumulative dmg/);
    fireEvent.press(view.getByTestId('damage-source-toggle-evo:phoenix-pyre'));
    expect(view.getByTestId('damage-source-more-evo:phoenix-pyre')).toHaveTextContent(phoenix.familyText, { exact: false });
    expect(view.getByTestId('damage-source-more-evo:phoenix-pyre')).toHaveTextContent(phoenix.flavor, { exact: false });

    // 3. Set-Parry Counter
    fireEvent.press(view.getByTestId('battle-damage-story-row-2'));
    expect(view.getByTestId('damage-source-what-bonus:parry')).toHaveTextContent(/×1\.4.*×1\.75.*×2/);
    fireEvent.press(view.getByTestId('damage-source-toggle-bonus:parry'));
    expect(view.getByTestId('damage-source-more-bonus:parry')).toHaveTextContent(/Perfect Parry.*Stagger/);

    // 4. Shading Surge
    fireEvent.press(view.getByTestId('battle-damage-story-row-3'));
    expect(view.getByTestId('damage-source-what-bonus:surge')).toHaveTextContent(/45 seconds.*15 seconds.*×5/);

    // 5. Rainbow Strike
    fireEvent.press(view.getByTestId('battle-damage-story-row-4'));
    expect(view.getByTestId('damage-source-what-bonus:rainbow')).toHaveTextContent(/all 3 cards differ in every active trait/);

    // 6. Purity Chain
    fireEvent.press(view.getByTestId('battle-damage-story-row-5'));
    expect(view.getByTestId('damage-source-what-bonus:purity')).toHaveTextContent(/consecutive Sets.*same number of differing traits/);

    // 7. Trap Defusal
    fireEvent.press(view.getByTestId('battle-damage-story-row-6'));
    expect(view.getByTestId('damage-source-what-bonus:traps')).toHaveTextContent(/Time Bombs or Snares/);

    // 8. Fighter Passive
    fireEvent.press(view.getByTestId('battle-damage-story-row-7'));
    expect(view.getByTestId('damage-source-explainer-passive:scrappy')).toHaveTextContent('Orange Tabby Passive', { exact: false });
    expect(view.getByTestId('damage-source-what-passive:scrappy')).toHaveTextContent(PASSIVES.scrappy.text, { exact: false });

    // 9. Skill Tree Node
    fireEvent.press(view.getByTestId('battle-damage-story-row-8'));
    expect(view.getByTestId('damage-source-explainer-node:tabby-0-1')).toHaveTextContent('Orange Tabby · Skill Tree', { exact: false });
    expect(view.getByTestId('damage-source-what-node:tabby-0-1')).toHaveTextContent(purrPunch.text, { exact: false });

    // 10. Role Set Bonus (with expandable 2×/4×/6× tier pills)
    fireEvent.press(view.getByTestId('battle-damage-story-row-9'));
    expect(view.getByTestId('damage-source-explainer-role:damage')).toHaveTextContent('ROLE BONUS', { exact: false });
    expect(view.getByTestId('damage-source-explainer-role:damage')).toHaveTextContent('2 / 4 / 6 Held Bonus', { exact: false });
    fireEvent.press(view.getByTestId('damage-source-toggle-role:damage'));
    expect(view.getByTestId('damage-source-role-tier-damage-2')).toBeTruthy();
    expect(view.getByTestId('damage-source-role-tier-damage-4')).toBeTruthy();
    expect(view.getByTestId('damage-source-role-tier-damage-6')).toBeTruthy();

    // 11. Arcana (with expandable Boon/Curse rows)
    fireEvent.press(view.getByTestId('battle-damage-story-row-10'));
    expect(view.getByTestId('damage-source-explainer-arcana:monochrome_pact')).toHaveTextContent('ARCANA', { exact: false });
    expect(view.getByTestId('damage-source-what-arcana:monochrome_pact')).toHaveTextContent(monochrome.upside, { exact: false });
    expect(view.getByTestId('damage-source-what-arcana:monochrome_pact')).toHaveTextContent(monochrome.tradeoff, { exact: false });
    fireEvent.press(view.getByTestId('damage-source-toggle-arcana:monochrome_pact'));
    expect(view.getByTestId('damage-source-more-arcana:monochrome_pact')).toHaveTextContent(/Boon \(Upside\)/);
    expect(view.getByTestId('damage-source-more-arcana:monochrome_pact')).toHaveTextContent(/Curse \(Tradeoff\)/);

    // 12. Workshop Upgrade
    fireEvent.press(view.getByTestId('battle-damage-story-row-11'));
    expect(view.getByTestId('damage-source-explainer-upgrade:heavy_hitter')).toHaveTextContent('UPGRADE', { exact: false });
    expect(view.getByTestId('damage-source-what-upgrade:heavy_hitter')).toHaveTextContent(/\+1 damage on every Set/);

    // 13. Matched Sets, Power Cards, Power Scaling, Burn FX
    fireEvent.press(view.getByTestId('battle-damage-story-row-12'));
    expect(view.getByTestId('damage-source-what-set:cards')).toHaveTextContent(/Base damage from every valid 3-card Set/);

    fireEvent.press(view.getByTestId('battle-damage-story-row-13'));
    expect(view.getByTestId('damage-source-what-set:card_bonus')).toHaveTextContent(/Power cards, War Drum charges/);

    fireEvent.press(view.getByTestId('battle-damage-story-row-14'));
    expect(view.getByTestId('damage-source-what-power:scale')).toHaveTextContent(/in-fight Power meter/);

    fireEvent.press(view.getByTestId('battle-damage-story-row-15'));
    expect(view.getByTestId('damage-source-what-fx:burn')).toHaveTextContent(/Burning cards scorch the foe/);

    view.unmount();

    // Verify full-climb mode (`xAxisMode: 'floors'`) labels result strip as "THIS CLIMB"
    const climbView = render(
      wrap(<BattleDamageStory story={{ ...story, xAxisMode: 'floors' }} reduced muted />)
    );
    fireEvent.press(climbView.getByTestId('battle-damage-story-row-1'));
    expect(climbView.getByTestId('damage-source-result-evo:phoenix-pyre')).toHaveTextContent('THIS CLIMB', { exact: false });
    climbView.unmount();
  });

  it('upgrades FightReplay non-weapon cards (Evolutions, Skill Nodes, Role Bonuses, Arcana, Passives) to DamageSourceExplainer while preserving testIDs', () => {
    const replay: FightReplayData = {
      levelId: '2-4',
      foeName: 'Test Foe',
      fighter: 'Orange Tabby',
      status: 'won',
      endReason: 'defeated',
      totalDamage: 120,
      matches: 3,
      mistakes: 0,
      elapsedMs: 20000,
      maxHearts: 5,
      weapons: ['blast-powder', 'flint-spark'],
      weaponBuilds: {},
      skillNodes: ['tabby-0-1'],
      passives: ['nine_lives', 'scrappy'],
      arcana: ['monochrome_pact'],
      log: [
        {
          t: 5000,
          wave: 0,
          kind: 'set',
          damage: 60,
          setDamage: 30,
          coins: 0,
          xp: 0,
          hearts: 5,
          heartsDelta: 0,
          foeHp: 60,
          foeMaxHp: 120,
          lines: [
            { type: 'hit', amount: 15, text: 'Phoenix Pyre', source: 'Phoenix Pyre', sourceRef: 'evo:phoenix-pyre' },
            { type: 'hit', amount: 8, text: 'Purr Punch', source: 'Purr Punch', sourceRef: 'node:tabby-0-1' },
            { type: 'rule', amount: 7, text: 'Damage Set', source: 'Damage Set', sourceRef: 'role:damage' },
          ],
        },
      ],
    };

    const view = render(wrap(<FightReplay replay={replay} visible onClose={noop} />));

    // Weapons still use WeaponExplainer
    expect(view.getByTestId('weapon-explainer-blast-powder')).toBeTruthy();
    expect(view.getByTestId('weapon-explainer-flint-spark')).toBeTruthy();

    // Non-weapons use DamageSourceExplainer with preserved replay-gear-* testIDs
    expect(view.getByTestId('replay-gear-evo:phoenix-pyre')).toBeTruthy();
    expect(view.getByTestId('replay-gear-node:tabby-0-1')).toBeTruthy();
    expect(view.getByTestId('replay-gear-role:damage')).toBeTruthy();
    expect(view.getByTestId('replay-gear-arcana:monochrome_pact')).toBeTruthy();
    expect(view.getByTestId('replay-gear-passive:nine_lives')).toBeTruthy();
    expect(view.getByTestId('replay-gear-passive:scrappy')).toBeTruthy();

    // Rich canonical copy & expandable tiers work inside FightReplay too
    expect(view.getByTestId('damage-source-what-evo:phoenix-pyre')).toHaveTextContent(/Lasts 30s/);
    expect(view.getByTestId('damage-source-what-arcana:monochrome_pact')).toHaveTextContent(/Tradeoff:/);
    expect(view.getByTestId('damage-source-what-passive:scrappy')).toHaveTextContent(PASSIVES.scrappy.text, { exact: false });

    fireEvent.press(view.getByTestId('damage-source-toggle-role:damage'));
    expect(view.getByTestId('damage-source-role-bonus-damage')).toHaveTextContent('2 held', { exact: false });
    expect(view.getByTestId('damage-source-role-tier-damage-2')).toBeTruthy();

    view.unmount();
  });
});
