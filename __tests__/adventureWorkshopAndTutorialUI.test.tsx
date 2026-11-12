/**
 * Camp (skill trees, Workshop, Armory charm slots, Arcana), the level preview
 * loadout, the Field Guide's recipe and fighter pages, unlock reveals, and the
 * first-evolution lesson, rendered with the real components.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Camp from '@/adventure/components/Camp';
import FieldGuide from '@/adventure/components/FieldGuide';
import LevelPreview from '@/adventure/components/LevelPreview';
import UnlockReveal from '@/adventure/components/UnlockReveal';
import AdventureMode from '@/adventure/AdventureMode';
import { createNewSave, equippedCharms, toggleCharm, toggleArcana } from '@/adventure/progress';
import { LEVELS, MAIN_LEVELS, mainIndexOf } from '@/adventure/data/levels';
import { ARCANA } from '@/adventure/data/arcana';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { getPassive } from '@/adventure/data/passives';
import { getFighter } from '@/adventure/data/fighters';
import { skillTreeOf } from '@/adventure/data/skillTrees';
import { starRewards } from '@/adventure/data/rewards';
import { UPGRADES } from '@/adventure/data/upgrades';
import type { AdventureSave } from '@/adventure/types';

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
}));

jest.mock('@/utils/storage', () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));

jest.mock('@/audio', () => ({
  sfx: jest.fn(),
  music: { play: jest.fn(), stop: jest.fn() },
  setMusicEnabled: jest.fn(),
}));

jest.mock('@/components/Icon', () => {
  const { View: RNView, Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return (
      <RNView testID={`fallback-icon-${name}`}>
        <RNText>{name}</RNText>
      </RNView>
    );
  };
});

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>{node}</SafeAreaProvider>;

const CAMPAIGN_WEAPONS = [...new Set(LEVELS.flatMap(l => starRewards(l).flatMap(r => r.weapons ?? [])))];

/** A save with this many stars earned on the first main levels. */
const starred = (total: number): Record<string, number> => {
  const stars: Record<string, number> = {};
  let left = total;
  for (const l of MAIN_LEVELS) {
    if (left <= 0) break;
    stars[l.id] = Math.min(3, left);
    left -= stars[l.id];
  }
  return stars;
};

/** Renders Camp and keeps feeding it the latest save, like AdventureMode does. */
const renderCamp = (initial: AdventureSave, tab: React.ComponentProps<typeof Camp>['initialTab']) => {
  let save = initial;
  const utils = render(wrap(<Camp save={save} initialTab={tab} onChange={next => { save = next; }} onClose={() => {}} />));
  const sync = () => utils.rerender(wrap(<Camp save={save} initialTab={tab} onChange={next => { save = next; }} onClose={() => {}} />));
  // A function, not a getter: object spread would copy a getter's value once
  return { ...utils, current: () => save, sync };
};

describe('Camp', () => {
  it('Fighters tab shows both passives; the skill tree buys linked nodes from its own star pool and refunds them', () => {
    const fighter = 'Orange Tabby';
    const def = getFighter(fighter);
    const camp = renderCamp({ ...createNewSave(), coinsUnlocked: true, stars: starred(4) }, 'fighters');

    for (const id of def.passives) {
      expect(camp.getByTestId(`camp-passive-${id}`)).toBeTruthy();
      expect(camp.getByText(getPassive(id).name)).toBeTruthy();
    }
    expect(camp.getByTestId('camp-stars')).toHaveTextContent(/4/);

    fireEvent.press(camp.getByTestId(`camp-open-tree-${fighter}`));
    expect(camp.getByTestId(`skill-tree-${fighter}`)).toBeTruthy();
    // Both passives and every node are on the map and readable, even the locked ones
    for (const id of def.passives) {
      expect(camp.getByTestId(`skill-passive-${id}`)).toBeTruthy();
      expect(camp.getByTestId(`skill-root-${id}`)).toBeTruthy();
    }
    const nodes = skillTreeOf(fighter);
    for (const n of nodes) expect(camp.getByTestId(`skill-node-${n.id}`)).toBeTruthy();
    const entry = nodes.filter(n => n.roots.length > 0).sort((a, b) => a.cost - b.cost)[0];
    expect(entry.cost).toBeLessThanOrEqual(4);
    const beyond = nodes.find(n => n.roots.length === 0 && n.links.includes(entry.id))!;
    expect(camp.getByTestId(`skill-node-${beyond.id}`).props.accessibilityLabel).toMatch(/locked/);

    // A locked node can be read but not bought
    fireEvent.press(camp.getByTestId(`skill-node-${beyond.id}`));
    expect(camp.getByTestId('skill-detail')).toBeTruthy();
    expect(camp.getAllByText(beyond.text).length).toBeGreaterThan(0);
    expect(camp.getByText(new RegExp(`Links to: .*${entry.name}`))).toBeTruthy();
    fireEvent.press(camp.getByTestId('skill-buy'));
    expect(camp.current().skillNodes[fighter]).toBeUndefined();

    // A node next to a passive is buyable
    fireEvent.press(camp.getByTestId(`skill-node-${entry.id}`));
    fireEvent.press(camp.getByTestId('skill-buy'));
    expect(camp.current().skillNodes[fighter]).toEqual([entry.id]);
    camp.sync();
    expect(camp.getByTestId(`skill-node-${entry.id}`).props.accessibilityLabel).toMatch(/owned/);
    expect(camp.getByTestId(`skill-node-${beyond.id}`).props.accessibilityLabel).not.toMatch(/locked/);
    // This fighter's own pool: 4 earned minus what it spent
    expect(camp.getByTestId('skill-tree-stars')).toHaveTextContent(new RegExp(`${4 - entry.cost}/ 4`));

    // Refund it from its detail sheet
    fireEvent.press(camp.getByTestId(`skill-node-${entry.id}`));
    fireEvent.press(camp.getByTestId('skill-refund-node'));
    expect(camp.current().skillNodes[fighter]).toBeUndefined();
  });

  it('Workshop is locked until unlocked, then sells loadout items, met mechanics and Armory weapon upgrades, all refundable', () => {
    const weapon = CAMPAIGN_WEAPONS[0];
    // Charm Belt is sold once charm slots have been taught
    const charmSlotsLevel = LEVELS.find(l => l.introduces === UPGRADES.find(u => u.id === 'charm_belt')!.mechanic);
    const locked: AdventureSave = {
      ...createNewSave(),
      coins: 1000,
      coinsUnlocked: true,
      stars: { [MAIN_LEVELS[0].id]: 2, ...(charmSlotsLevel ? { [charmSlotsLevel.id]: 1 } : {}) },
      armory: [weapon],
    };
    const first = render(wrap(<Camp save={locked} initialTab="workshop" onChange={() => {}} onClose={() => {}} />));
    expect(first.getByTestId('camp-workshop-locked')).toBeTruthy();
    expect(first.queryByTestId('camp-upgrade-charm_belt')).toBeNull();
    first.unmount();

    const camp = renderCamp({ ...locked, workshopUnlocked: true }, 'workshop');
    expect(camp.getByTestId('camp-upgrade-charm_belt')).toBeTruthy();
    // Tarot Deck waits for a second Arcana; Evolution Lab for the evolutions lesson
    expect(camp.queryByTestId('camp-upgrade-tarot_deck')).toBeNull();
    expect(camp.queryByTestId('camp-upgrade-evolution_lab')).toBeNull();
    expect(camp.getByTestId(`camp-weapon-upgrade-${weapon}`)).toBeTruthy();

    fireEvent.press(camp.getByTestId('camp-buy-upgrade-charm_belt'));
    expect(camp.current().upgrades.charm_belt).toBe(1);
    expect(camp.current().coins).toBe(700);
    camp.sync();
    fireEvent.press(camp.getByTestId('camp-refund-upgrade-charm_belt'));
    expect(camp.current().upgrades.charm_belt).toBeUndefined();
    expect(camp.current().coins).toBe(1000);
  });

  it('Armory fills charm slots, refuses a 4th charm with a note, and takes one off on tap', () => {
    const armory = CAMPAIGN_WEAPONS.slice(0, 4);
    const camp = renderCamp({ ...createNewSave(), coinsUnlocked: true, armory }, 'armory');
    for (const id of armory.slice(0, 3)) {
      fireEvent.press(camp.getByTestId(`camp-armory-${id}`));
      camp.sync();
    }
    expect(equippedCharms(camp.current())).toEqual(armory.slice(0, 3));
    fireEvent.press(camp.getByTestId(`camp-armory-${armory[3]}`));
    expect(camp.getByTestId('camp-charms-full')).toBeTruthy();
    expect(equippedCharms(camp.current())).toEqual(armory.slice(0, 3));
    fireEvent.press(camp.getByTestId(`camp-armory-${armory[0]}`));
    expect(equippedCharms(camp.current())).toEqual(armory.slice(1, 3));
  });

  it('Arcana tab equips into the available slots', () => {
    const owned = ARCANA.slice(0, 2).map(a => a.id);
    const camp = renderCamp({ ...createNewSave(), unlockedArcana: owned }, 'arcana');
    fireEvent.press(camp.getByTestId(`camp-arcana-${owned[0]}`));
    camp.sync();
    fireEvent.press(camp.getByTestId(`camp-arcana-${owned[1]}`));
    // One slot: the second Arcana takes the first one's place
    expect(camp.current().equippedArcana).toEqual([owned[1]]);
  });
});

describe('Level preview loadout', () => {
  it('shows charm slots, the fighter passives, armed evolutions and Arcana slots', () => {
    const level = MAIN_LEVELS.find(l => !l.rules.noGear)!;
    const recipe = EVOLUTION_RECIPES[0];
    const armory = recipe.families.map(f => f[0]);
    let save: AdventureSave = {
      ...createNewSave(),
      coinsUnlocked: true,
      stars: { [MAIN_LEVELS[0].id]: 3 },
      armory,
      unlockedEvolutions: [recipe.id],
      unlockedArcana: [ARCANA[0].id],
    };
    const onCharm = jest.fn((id: string) => { save = toggleCharm(save, id); });
    const onArcana = jest.fn(id => { save = toggleArcana(save, id); });
    const props = { level, onClose: () => {}, onPlay: () => {}, onSelectFighter: () => {}, onSelectCharm: onCharm, onSelectArcana: onArcana, onShowMechanic: () => {} };
    const view = render(wrap(<LevelPreview {...props} save={save} />));

    expect(view.getByTestId('preview-charm-slots')).toBeTruthy();
    expect(view.getByTestId('preview-slot-2')).toBeTruthy();
    expect(view.queryByTestId('preview-slot-3')).toBeNull();
    expect(view.getByTestId('preview-passives')).toBeTruthy();
    expect(view.getByText(/No evolution armed/)).toBeTruthy();

    fireEvent.press(view.getByTestId(`charm-${armory[0]}`));
    fireEvent.press(view.getByTestId(`charm-${armory[1]}`));
    expect(onCharm).toHaveBeenCalledTimes(2);
    view.rerender(wrap(<LevelPreview {...props} save={save} />));
    expect(view.getByText(/1 evolution armed/)).toBeTruthy();
    expect(view.getByText(`${recipe.name} · ARMED`)).toBeTruthy();
    expect(view.getByTestId('preview-evo-likelihood')).toBeTruthy();

    fireEvent.press(view.getByTestId(`preview-arcana-${ARCANA[0].id}`));
    expect(save.equippedArcana).toEqual([ARCANA[0].id]);
  });

  it('lists a level hazard', () => {
    const level = LEVELS.find(l => l.rules.hazards?.snares || l.rules.hazards?.timeBombs);
    if (!level) return;
    const view = render(wrap(
      <LevelPreview level={level} save={createNewSave()} onClose={() => {}} onPlay={() => {}} onSelectFighter={() => {}} onSelectCharm={() => {}} onShowMechanic={() => {}} />
    ));
    expect(view.getByTestId('preview-hazards')).toBeTruthy();
  });
});

describe('Field Guide', () => {
  it('Recipe Guide shows locked, unlocked, armed and evolved recipes with their families and effects', () => {
    const [armedR, forgedR, lockedR] = EVOLUTION_RECIPES;
    const charms = armedR.families.map(f => f[0]);
    const save: AdventureSave = {
      ...createNewSave(),
      armory: charms,
      charms,
      unlockedEvolutions: [armedR.id, forgedR.id],
      discoveredEvolutions: [forgedR.id],
    };
    const view = render(wrap(<FieldGuide save={save} onClose={() => {}} />));
    fireEvent.press(view.getByTestId('guide-tab-recipes'));
    expect(view.getByText(`RECIPES (2/${EVOLUTION_RECIPES.length})`)).toBeTruthy();
    expect(view.getByText(armedR.name)).toBeTruthy();
    expect(view.getByText('ARMED BY YOUR CHARMS')).toBeTruthy();
    expect(view.getByText(armedR.activeText)).toBeTruthy();
    expect(view.getByText(forgedR.name)).toBeTruthy();
    expect(view.getByText('EVOLVED BEFORE')).toBeTruthy();
    expect(view.getByTestId(`recipe-${lockedR.id}`)).toBeTruthy();
    expect(view.queryByText(lockedR.name)).toBeNull();
  });

  it('Fighters page explains passives and skill trees', () => {
    const view = render(wrap(<FieldGuide save={createNewSave()} onClose={() => {}} />));
    fireEvent.press(view.getByTestId('guide-tab-fighters'));
    expect(view.getByTestId('guide-skill-trees')).toBeTruthy();
    const tabby = getFighter('Orange Tabby');
    expect(view.getByText(new RegExp(getPassive(tabby.passives[0]).text.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy();
  });
});

describe('Unlock reveals', () => {
  it('reveals the Workshop (and opens it) and a first evolution with how it works', () => {
    let opened = false;
    const view = render(
      <UnlockReveal
        unlocks={[{ kind: 'feature', feature: 'workshop', star: 1 }]}
        save={createNewSave()}
        onUseFighter={() => {}}
        onEquipCharm={() => {}}
        onOpenFeature={f => { opened = f === 'workshop'; }}
        onDone={() => {}}
      />
    );
    expect(view.getByText('The Workshop unlocked!')).toBeTruthy();
    fireEvent.press(view.getByTestId('unlock-reveal'));
    fireEvent.press(view.getByTestId('unlock-primary'));
    expect(opened).toBe(true);

    const recipe = EVOLUTION_RECIPES[0];
    view.rerender(
      <UnlockReveal
        unlocks={[{ kind: 'evolution', id: recipe.id, star: 1, firstEvolution: true }]}
        save={createNewSave()}
        onUseFighter={() => {}}
        onEquipCharm={() => {}}
        onDone={() => {}}
      />
    );
    expect(view.getByText('New evolution unlocked!')).toBeTruthy();
    fireEvent.press(view.getByTestId('unlock-reveal'));
    expect(view.getByText(recipe.name)).toBeTruthy();
    expect(view.getByText(`Armed by: ${recipe.familyText}`)).toBeTruthy();
  });

  it('a new fighter names its passives and points at its trial; once the trial is played the reveal explains them', () => {
    const fox = getFighter('Sly Fox');
    const trial = LEVELS.find(l => l.branchOf && l.introduces === fox.signature);
    const reveal = (save: AdventureSave) => {
      const view = render(
        <UnlockReveal unlocks={[{ kind: 'fighter', name: fox.name, star: 3 }]} save={save} onUseFighter={() => {}} onEquipCharm={() => {}} onDone={() => {}} />
      );
      fireEvent.press(view.getByTestId('unlock-reveal'));
      return view;
    };
    if (trial) {
      const short = reveal(createNewSave());
      expect(short.getByText(new RegExp(trial.name))).toBeTruthy();
      for (const id of fox.passives) expect(short.queryByText(getPassive(id).text)).toBeNull();
      short.unmount();
    }
    const full = reveal({ ...createNewSave(), seenMechanics: [fox.signature] });
    for (const id of fox.passives) expect(full.getByText(getPassive(id).text)).toBeTruthy();
  });
});

describe('First-evolution lesson', () => {
  it('the level that grants the first recipe opens with a discovery page, and the next fight teaches evolutions', () => {
    const first = MAIN_LEVELS.find(l => starRewards(l).some(r => r.evolution))!;
    const before = MAIN_LEVELS.slice(0, mainIndexOf(first));
    const save: AdventureSave = {
      ...createNewSave(),
      plays: { [MAIN_LEVELS[0].id]: 1 },
      stars: Object.fromEntries(before.map(l => [l.id, 3])),
      coinsUnlocked: true,
      seenMechanics: before.map(l => l.introduces),
    };
    const view = render(wrap(<AdventureMode initialSave={save} onExit={() => {}} />));
    fireEvent.press(view.getByTestId(`map-node-${first.id}`));
    fireEvent.press(view.getByTestId('preview-play'));
    expect(view.getByText('Milestone Reward: First Evolution')).toBeTruthy();
    view.unmount();

    const next = MAIN_LEVELS[mainIndexOf(first) + 1];
    const recipeId = starRewards(first).find(r => r.evolution)!.evolution!;
    const after: AdventureSave = {
      ...save,
      stars: { ...save.stars, [first.id]: 3 },
      seenMechanics: [...save.seenMechanics, first.introduces, 'combo_hunt_intro'],
      unlockedEvolutions: [recipeId],
    };
    const second = render(wrap(<AdventureMode initialSave={after} onExit={() => {}} />));
    fireEvent.press(second.getByTestId(`map-node-${next.id}`));
    fireEvent.press(second.getByTestId('preview-play'));
    const recipe = EVOLUTION_RECIPES.find(r => r.id === recipeId)!;
    // Either the level's own lesson comes first (and names the evolution lesson next), or the evolution lesson itself
    const evolutionLessonShown = second.queryAllByText(new RegExp(recipe.name)).length > 0 || second.queryByText(/^Next: /) !== null;
    expect(evolutionLessonShown).toBe(true);
  });
});
