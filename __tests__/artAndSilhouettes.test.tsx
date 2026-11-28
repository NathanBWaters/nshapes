import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BIOMES } from '@/adventure/data/biomes';
import { BiomeScenery } from '@/adventure/components/BiomeScenery';
import CritterGallery from '@/adventure/components/CritterGallery';
import { EnemyAvatar } from '@/components/enemies/EnemyAvatar';
import {
  ENEMY_ATLAS_COLS,
  ENEMY_ATLAS_MAX_INDEX,
  ENEMY_ATLAS_ROWS,
  ENEMY_IDLE_FRAME_COUNT,
} from '@/components/enemies/EnemySpriteRig';
import {
  ENEMY_SPRITE_ATLAS_SPECS,
  WAVE1_ENEMY_SPRITE_NAMES,
  WAVE1_ENEMY_SPRITE_SLUGS,
} from '@/components/enemies/enemySpriteRegistry';
import { FighterAvatar } from '@/components/fighters/FighterAvatar';
import {
  FIGHTER_ATLAS_COLS,
  FIGHTER_ATLAS_MAX_INDEX,
  FIGHTER_ATLAS_ROWS,
  FIGHTER_IDLE_FRAME_COUNT,
  FIGHTER_SPRITE_ATLASES,
} from '@/components/fighters/FighterSpriteRig';
import { SILHOUETTE_INK } from '@/components/illustration/primitives';
import RewardReveal from '@/components/RewardReveal';
import { PRISM_COLORS } from '@/prism/components/prismTheme';
import { COLORS } from '@/utils/colors';
import {
  BODY_FONT,
  DISPLAY_FONT,
  FONT,
  MONO_FONT,
  TEXT_STYLE,
  ensureWebFontsLoaded,
  useAppFonts,
} from '@/utils/fonts';
import { CHARACTERS } from '@/utils/gameDefinitions';
import DevFightersPage from '../app/dev/fighters';

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { name: string }) =>
      ReactActual.createElement(View, { accessibilityLabel: `icon-${props.name}` }),
  };
});

const ROOT = path.resolve(__dirname, '..');

type JsonNode = {
  type?: string;
  props?: Record<string, unknown>;
  children?: (JsonNode | string)[] | null;
};

function walkJson(node: JsonNode | JsonNode[] | string | null | undefined, visit: (n: JsonNode) => void) {
  if (!node || typeof node === 'string') return;
  if (Array.isArray(node)) {
    for (const child of node) walkJson(child, visit);
    return;
  }
  visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkJson(child, visit);
  }
}

describe('[UI-01..UI-07] Visual Cohesion, Typography, Lighting & Silhouettes', () => {
  describe('[UI-01] Tactile Tabletop Storybook North Star & style_guide.md', () => {
    it('replaces the unedited LLM prompt with the single Tactile Tabletop Storybook north star', () => {
      const guide = fs.readFileSync(path.join(ROOT, 'style_guide.md'), 'utf8');
      expect(guide).toContain('Tactile Tabletop Storybook');
      expect(guide).toContain('Circle');
      expect(guide).toContain('Triangle');
      expect(guide).toContain('Bolt');
      expect(guide).toContain('#E2ECF7');
      expect(guide).not.toContain('Would you like me to create specific variations');
    });

    it('exposes harmonized Storybook color tokens without breaking existing COLORS', () => {
      expect(COLORS.ivoryCard).toBe('#FFFDF7');
      expect(COLORS.walnutFrame).toBe('#322E2B');
      expect(COLORS.walnutSurface).toBe('#3E3833');
      expect(COLORS.paperBeige).toBe('#F4EFEA');
      expect(COLORS.slateCharcoal).toBe('#383838');
      expect(COLORS.actionYellow).toBe('#FFDE00');
    });
  });

  describe('[UI-02] Semantic Typography Stack (fonts.ts & app/_layout.tsx)', () => {
    it('exports DISPLAY_FONT, BODY_FONT, MONO_FONT, FONT, TEXT_STYLE, and useAppFonts', () => {
      expect(typeof DISPLAY_FONT).toBe('string');
      expect(DISPLAY_FONT.length).toBeGreaterThan(0);
      expect(typeof BODY_FONT).toBe('string');
      expect(BODY_FONT.length).toBeGreaterThan(0);
      expect(typeof MONO_FONT).toBe('string');
      expect(MONO_FONT.length).toBeGreaterThan(0);
      expect(FONT.display).toBe(DISPLAY_FONT);
      expect(FONT.body).toBe(BODY_FONT);
      expect(FONT.mono).toBe(MONO_FONT);
      expect((TEXT_STYLE.caption.fontSize ?? 0) >= 11).toBe(true);
      expect(TEXT_STYLE.monoNum.fontFamily).toBe(MONO_FONT);
      expect(ensureWebFontsLoaded()).toBe(true);
      expect(typeof useAppFonts).toBe('function');
    });

    it('wires useAppFonts into app/_layout.tsx while preserving AppErrorBoundary', () => {
      const layoutSrc = fs.readFileSync(path.join(ROOT, 'app/_layout.tsx'), 'utf8');
      expect(layoutSrc).toContain('useAppFonts');
      expect(layoutSrc).toContain('AppErrorBoundary');
    });
  });

  describe('[UI-03] Zero Raw OS Emojis in Owned Live UI Components', () => {
    const OWNED_LIVE_UI_FILES = [
      'src/adventure/components/Camp.tsx',
      'src/adventure/components/BountyBoard.tsx',
      'src/adventure/components/BattleHistory.tsx',
      'src/adventure/components/FightReplay.tsx',
      'src/components/RewardReveal.tsx',
      'src/components/ui/ChallengeCard.tsx',
      'src/prism/components/PrismTutorial.tsx',
      'src/spire/components/SpireHeader.tsx',
      'src/spire/components/SpireEvent.tsx',
      'src/spire/components/SpireRewardScreen.tsx',
      'src/spire/components/SpireShop.tsx',
      'src/spire/components/SpireTreasure.tsx',
    ];

    const FORBIDDEN_EMOJIS = /[📊⚔⚙️🛠✅🚪🔥💥⚡🍀🔗🎁💔🎉⏱⬆⚠✦]/u;

    it('contains zero raw OS emojis in owned live TSX components', () => {
      for (const relPath of OWNED_LIVE_UI_FILES) {
        const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
        const codeLines = src
          .split('\n')
          .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
          .join('\n');
        expect(codeLines).not.toMatch(FORBIDDEN_EMOJIS);
      }
    });

    it('renders RewardReveal special weapon effects cleanly with registered vector icons', () => {
      const effects = ['explosion', 'laser', 'fire', 'grace', 'ricochet', 'connected'] as const;
      for (const effectType of effects) {
        const view = render(<RewardReveal reward={{ cardId: `card-${effectType}`, points: 10, effectType }} />);
        const serialized = JSON.stringify(view.toJSON());
        expect(serialized).not.toMatch(FORBIDDEN_EMOJIS);
        view.unmount();
      }
    });
  });

  describe('[UI-04] & [UI-05] Custom SVG BiomeScenery & Camp/Prism Harmonization', () => {
    it('renders hand-crafted 2-tone SVG BiomeScenery with LinearGradient for all 5 biomes', () => {
      for (const biome of BIOMES) {
        const view = render(<BiomeScenery biome={biome} width={420} height={520} />);
        expect(view.getByTestId(`biome-scenery-${biome.id}`)).toBeTruthy();

        let gradientCount = 0;
        let vectorShapeCount = 0;
        walkJson(view.toJSON() as JsonNode, (node) => {
          if (node.type === 'LinearGradient') gradientCount += 1;
          if (node.type === 'Path' || node.type === 'Polygon' || node.type === 'Circle') {
            vectorShapeCount += 1;
          }
        });
        expect(gradientCount).toBeGreaterThanOrEqual(2);
        expect(vectorShapeCount).toBeGreaterThanOrEqual(8);
        view.unmount();
      }
    });

    it('replaces monochrome lorc/ decor stamping in AdventureMap with BiomeScenery', () => {
      const mapSrc = fs.readFileSync(
        path.join(ROOT, 'src/adventure/components/AdventureMap.tsx'),
        'utf8'
      );
      expect(mapSrc).toContain('<BiomeScenery');
      expect(mapSrc).not.toContain('biome.decor[');
    });

    it('harmonizes Camp, BountyBoard, and Prism Deck surfaces with Storybook walnut & ink tokens', () => {
      const campSrc = fs.readFileSync(
        path.join(ROOT, 'src/adventure/components/Camp.tsx'),
        'utf8'
      );
      const bountySrc = fs.readFileSync(
        path.join(ROOT, 'src/adventure/components/BountyBoard.tsx'),
        'utf8'
      );
      expect(campSrc).not.toContain('#2B2118');
      expect(campSrc).toContain('COLORS.walnutFrame');
      expect(bountySrc).not.toContain('#231D18');
      expect(bountySrc).toContain('COLORS.walnutFrame');
      expect(PRISM_COLORS.cardWhite).toBe('#FFFDF7');
      expect(PRISM_COLORS.cardBorder).toBe('#383838');
      expect(PRISM_COLORS.gold).toBe(COLORS.actionYellow);
    });
  });

  describe('[UI-05] + [UI-06] + [UI-07] 6 Fighter 3/4 Silhouettes, Overhead Lighting & Boss Shadows', () => {
    it('renders all 6 fighters with distinct 8x8 Option B storybook sprite atlases and dual-layer crossfade', () => {
      expect(FIGHTER_ATLAS_COLS).toBe(8);
      expect(FIGHTER_ATLAS_ROWS).toBe(8);
      expect(FIGHTER_IDLE_FRAME_COUNT).toBe(32);
      expect(FIGHTER_ATLAS_MAX_INDEX).toBe(63);

      const atlasSources = new Set<unknown>();

      for (const char of CHARACTERS) {
        expect(FIGHTER_SPRITE_ATLASES[char.name]).toBeDefined();
        const view = render(
          <FighterAvatar
            character={char}
            size={80}
            mood="idle"
            animate={false}
            testID={`fighter-${char.name}`}
          />
        );
        const viewport = view.getByTestId('fighter-sprite-viewport');
        const atlas = view.getByTestId('fighter-sprite-atlas');
        const prevAtlas = view.getByTestId('fighter-sprite-atlas-prev');
        expect(viewport).toBeTruthy();
        expect(atlas.props.source).toBe(FIGHTER_SPRITE_ATLASES[char.name]);
        expect(prevAtlas.props.source).toBe(atlas.props.source);
        const flatStyle = Array.isArray(atlas.props.style)
          ? Object.assign({}, ...atlas.props.style.filter(Boolean))
          : atlas.props.style;
        expect(flatStyle.width).toBe(80 * 8);
        expect(flatStyle.height).toBe(80 * 8);
        atlasSources.add(atlas.props.source);
        view.unmount();
      }

      // Every one of the 6 fighters has its own distinct illustrated sprite atlas on disk
      expect(atlasSources.size).toBe(CHARACTERS.length);
      for (const slug of ['orange-tabby', 'sly-fox', 'badger', 'corgi', 'emperor-penguin', 'pelican']) {
        expect(fs.existsSync(path.join(ROOT, 'assets', 'fighters', `${slug}.webp`))).toBe(true);
      }
    });

    it('flattens all 6 fighters to solid #121212 silhouette mode cleanly', () => {
      for (const char of CHARACTERS) {
        const view = render(
          <FighterAvatar
            character={char}
            size={36}
            animate={false}
            silhouette
            testID={`sil-${char.name}`}
          />
        );

        const silViewport = view.getByTestId('fighter-sprite-silhouette');
        const atlas = view.getByTestId('fighter-sprite-atlas');
        expect(silViewport).toBeTruthy();
        // On native test env (jest-expo), tintColor flattens the alpha-masked sprite to SILHOUETTE_INK;
        // on web, CSS filter brightness(0) applies the solid silhouette transform.
        const flatStyle = Array.isArray(atlas.props.style)
          ? Object.assign({}, ...atlas.props.style.filter(Boolean))
          : atlas.props.style;
        expect(
          atlas.props.tintColor === SILHOUETTE_INK || flatStyle?.filter === 'brightness(0)'
        ).toBe(true);
        view.unmount();
      }
    });

    it('renders all 19 Wave 1 enemy sprite atlases (+ 2 aliases), boss grounding shadow/halo, and clean #121212 silhouettes while keeping World 2-5 SVG foes intact', () => {
      expect(ENEMY_ATLAS_COLS).toBe(8);
      expect(ENEMY_ATLAS_ROWS).toBe(8);
      expect(ENEMY_IDLE_FRAME_COUNT).toBe(32);
      expect(ENEMY_ATLAS_MAX_INDEX).toBe(63);
      expect(WAVE1_ENEMY_SPRITE_SLUGS).toHaveLength(19);
      expect(WAVE1_ENEMY_SPRITE_NAMES).toHaveLength(21);

      const stdView = render(
        <EnemyAvatar
          enemy={{ name: 'Junk Rat', tier: 1 }}
          size={80}
          mood="menacing"
          animate={false}
          testID="std-enemy"
        />
      );
      const bossView = render(
        <EnemyAvatar
          enemy={{ name: 'Ancient Dragon', tier: 4 }}
          size={80}
          mood="menacing"
          animate={false}
          testID="boss-enemy"
        />
      );

      expect(stdView.queryByTestId('boss-atmospheric-halo')).toBeNull();
      expect(bossView.getByTestId('boss-atmospheric-halo')).toBeTruthy();

      const stdShadowStyle = stdView.getByTestId('enemy-ground-shadow').props.style as Record<
        string,
        unknown
      >[];
      const bossShadowStyle = bossView.getByTestId('enemy-ground-shadow').props.style as Record<
        string,
        unknown
      >[];
      const stdWidth = stdShadowStyle.find((s) => s && typeof s.width === 'number')?.width as number;
      const bossWidth = bossShadowStyle.find((s) => s && typeof s.width === 'number')?.width as number;
      expect(bossWidth).toBeGreaterThan(stdWidth);

      // Wave 1 boss uses 8x8 dual-layer sprite atlas
      expect(bossView.getByTestId('enemy-sprite-viewport')).toBeTruthy();
      expect(bossView.getByTestId('enemy-sprite-atlas').props.source).toBe(
        ENEMY_SPRITE_ATLAS_SPECS['Ancient Dragon'].source
      );
      expect(bossView.getByTestId('enemy-sprite-atlas-prev').props.source).toBe(
        ENEMY_SPRITE_ATLAS_SPECS['Ancient Dragon'].source
      );

      // World 2-5 SVG foe keeps 2-tone LinearGradient lighting, 3/4 left facing & solid #121212 SVG silhouette
      let svgGradients = 0;
      let leftFacingTransforms = 0;
      walkJson(stdView.toJSON() as JsonNode, (node) => {
        if (node.type === 'LinearGradient') svgGradients += 1;
        const tr = node.props?.transform;
        if (typeof tr === 'string' && tr.includes('translate(-')) {
          leftFacingTransforms += 1;
        }
      });
      expect(svgGradients).toBeGreaterThanOrEqual(1);
      expect(leftFacingTransforms).toBeGreaterThanOrEqual(1);

      const silSvgFoe = render(
        <EnemyAvatar
          enemy={{ name: 'Charging Boar', tier: 2 }}
          size={64}
          mood="menacing"
          animate={false}
          silhouette
        />
      );
      const nonBlack: string[] = [];
      walkJson(silSvgFoe.toJSON() as JsonNode, (node) => {
        const fill = node.props?.fill;
        if (typeof fill === 'string' && fill !== 'none' && fill !== 'transparent' && fill !== SILHOUETTE_INK) {
          nonBlack.push(fill);
        }
      });
      expect(nonBlack).toEqual([]);
      silSvgFoe.unmount();

      // Verify all 21 Wave 1 enemy sprite names render distinct 19 atlases and flatten cleanly to #121212 silhouettes
      const enemyAtlasSources = new Set<unknown>();
      for (const enemyName of WAVE1_ENEMY_SPRITE_NAMES) {
        const spec = ENEMY_SPRITE_ATLAS_SPECS[enemyName];
        expect(spec).toBeDefined();

        const view = render(
          <EnemyAvatar
            enemy={{ name: enemyName, tier: spec.isBoss ? 4 : 1 }}
            size={80}
            mood="menacing"
            animate={false}
            testID={`wave1-${enemyName}`}
          />
        );
        const atlas = view.getByTestId('enemy-sprite-atlas');
        const prevAtlas = view.getByTestId('enemy-sprite-atlas-prev');
        expect(view.getByTestId('enemy-sprite-viewport')).toBeTruthy();
        expect(atlas.props.source).toBe(spec.source);
        expect(prevAtlas.props.source).toBe(spec.source);
        const flatStyle = Array.isArray(atlas.props.style)
          ? Object.assign({}, ...atlas.props.style.filter(Boolean))
          : atlas.props.style;
        expect(flatStyle.width).toBe(80 * 8);
        expect(flatStyle.height).toBe(80 * 8);
        enemyAtlasSources.add(atlas.props.source);
        view.unmount();

        const silView = render(
          <EnemyAvatar
            enemy={{ name: enemyName, tier: spec.isBoss ? 4 : 1 }}
            size={36}
            animate={false}
            silhouette
          />
        );
        expect(silView.getByTestId('enemy-sprite-silhouette')).toBeTruthy();
        const silAtlas = silView.getByTestId('enemy-sprite-atlas');
        const silFlat = Array.isArray(silAtlas.props.style)
          ? Object.assign({}, ...silAtlas.props.style.filter(Boolean))
          : silAtlas.props.style;
        expect(
          silAtlas.props.tintColor === SILHOUETTE_INK || silFlat?.filter === 'brightness(0)'
        ).toBe(true);
        silView.unmount();
      }
      expect(enemyAtlasSources.size).toBe(19);
      for (const slug of WAVE1_ENEMY_SPRITE_SLUGS) {
        expect(fs.existsSync(path.join(ROOT, 'assets', 'enemies', `${slug}.webp`))).toBe(true);
      }

      stdView.unmount();
      bossView.unmount();
    });

    it('exposes the solid-black Silhouette Audit toggle and 36px/80px audit strip in /dev/fighters & CritterGallery', () => {
      const studio = render(<DevFightersPage />);
      expect(studio.queryByTestId('studio-silhouette-strip')).toBeNull();

      fireEvent.press(studio.getByTestId('studio-silhouette-toggle'));
      expect(studio.getByTestId('studio-silhouette-strip')).toBeTruthy();
      expect(studio.getByTestId('studio-silhouette-36-0')).toBeTruthy();
      expect(studio.getByTestId('studio-silhouette-80-0')).toBeTruthy();
      expect(studio.getByTestId('studio-silhouette-80-5')).toBeTruthy();

      // Switch to Enemies tab and verify both facing toggle and enemy silhouette strip work
      fireEvent.press(studio.getByTestId('studio-tab-enemies'));
      expect(studio.getByTestId('studio-silhouette-strip')).toBeTruthy();
      expect(studio.getByTestId('studio-silhouette-enemy-0')).toBeTruthy();
      fireEvent.press(studio.getByTestId('studio-facing-toggle'));
      expect(studio.getByText(/Front \(Portrait\)/)).toBeTruthy();

      studio.unmount();

      // Ensure CritterGallery studio prop stays intact directly
      const direct = render(<CritterGallery mode="studio" />);
      expect(direct.getByTestId('studio-silhouette-toggle')).toBeTruthy();
      direct.unmount();
    });
  });
});
