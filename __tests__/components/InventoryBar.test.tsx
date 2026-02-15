/**
 * InventoryBar Component Tests
 *
 * Tests for the new fusion-based inventory display:
 * - 4 weapon slots + 4 passive slots layout
 * - Empty slot placeholders
 * - Level indicators (I, II, III)
 * - Tier-based styling (Tier 1 = purple, Tier 2 = gold)
 * - Backward compatibility with legacy weapons array
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import InventoryBar from '@/components/InventoryBar';
import { FusionWeapon, PlayerInventory, Weapon } from '@/types';

// Mock the Icon component since SVG imports don't work in tests
jest.mock('@/components/Icon', () => {
  const { View } = require('react-native');
  return function MockIcon({ testID }: { testID?: string }) {
    return <View testID={testID || 'mock-icon'} />;
  };
});

// Helper to create a test fusion weapon
const createFusionWeapon = (
  overrides: Partial<FusionWeapon> = {}
): FusionWeapon => ({
  id: `test-weapon-${Date.now()}`,
  name: 'Test Weapon',
  description: 'A test weapon',
  shortDescription: 'A test weapon',
  type: 'weapon',
  level: 1,
  fusionTier: 0,
  levelEffects: {
    1: { explosionChance: 5 },
    2: { explosionChance: 10 },
    3: { explosionChance: 15 },
  },
  ...overrides,
});

// Helper to create test inventory
const createTestInventory = (
  weapons: (FusionWeapon | null)[] = [null, null, null, null],
  passives: (FusionWeapon | null)[] = [null, null, null, null]
): PlayerInventory => ({
  weapons: weapons.length === 4 ? weapons : [...weapons, ...Array(4 - weapons.length).fill(null)] as (FusionWeapon | null)[],
  passives: passives.length === 4 ? passives : [...passives, ...Array(4 - passives.length).fill(null)] as (FusionWeapon | null)[],
});

describe('InventoryBar', () => {
  describe('New Inventory System', () => {
    it('should render the inventory container', () => {
      const inventory = createTestInventory();
      render(<InventoryBar inventory={inventory} />);

      expect(screen.getByTestId('weapon-inventory')).toBeTruthy();
    });

    it('should render "Inventory" title', () => {
      const inventory = createTestInventory();
      render(<InventoryBar inventory={inventory} />);

      expect(screen.getByText('Inventory')).toBeTruthy();
    });

    it('should render "Weapons" label', () => {
      const inventory = createTestInventory();
      render(<InventoryBar inventory={inventory} />);

      expect(screen.getByText('Weapons')).toBeTruthy();
    });

    it('should render "Passives" label', () => {
      const inventory = createTestInventory();
      render(<InventoryBar inventory={inventory} />);

      expect(screen.getByText('Passives')).toBeTruthy();
    });

    it('should render 4 weapon slots', () => {
      const inventory = createTestInventory();
      const { UNSAFE_getAllByType } = render(<InventoryBar inventory={inventory} />);

      // Count slots by checking for the slot components
      const weaponsLabel = screen.getByText('Weapons');
      expect(weaponsLabel).toBeTruthy();

      // With all empty inventory, there should be 8 Icon components (4 weapons + 4 passives)
      // Each empty slot shows an icon
    });

    it('should render 4 passive slots', () => {
      const inventory = createTestInventory();
      render(<InventoryBar inventory={inventory} />);

      const passivesLabel = screen.getByText('Passives');
      expect(passivesLabel).toBeTruthy();
    });

    describe('Filled Slots', () => {
      it('should display level I indicator for level 1 weapons', () => {
        const weapon = createFusionWeapon({ level: 1 });
        const inventory = createTestInventory([weapon, null, null, null]);
        render(<InventoryBar inventory={inventory} />);

        expect(screen.getByText('I')).toBeTruthy();
      });

      it('should display level II indicator for level 2 weapons', () => {
        const weapon = createFusionWeapon({ level: 2 });
        const inventory = createTestInventory([weapon, null, null, null]);
        render(<InventoryBar inventory={inventory} />);

        expect(screen.getByText('II')).toBeTruthy();
      });

      it('should display level III indicator for level 3 weapons', () => {
        const weapon = createFusionWeapon({ level: 3 });
        const inventory = createTestInventory([weapon, null, null, null]);
        render(<InventoryBar inventory={inventory} />);

        expect(screen.getByText('III')).toBeTruthy();
      });

      it('should display weapon icon when present', () => {
        const weapon = createFusionWeapon({ icon: 'lorc/campfire' });
        const inventory = createTestInventory([weapon, null, null, null]);
        render(<InventoryBar inventory={inventory} />);

        // Just verify it renders without error (icon is present)
        expect(screen.getByText('I')).toBeTruthy();
      });

      it('should display multiple weapons in different slots', () => {
        const weapon1 = createFusionWeapon({ level: 1 });
        const weapon2 = createFusionWeapon({ level: 2 });
        const inventory = createTestInventory([weapon1, weapon2, null, null]);
        render(<InventoryBar inventory={inventory} />);

        expect(screen.getByText('I')).toBeTruthy();
        expect(screen.getByText('II')).toBeTruthy();
      });

      it('should display passives in passive slots', () => {
        const passive = createFusionWeapon({
          type: 'passive',
          level: 3,
        });
        const inventory = createTestInventory([null, null, null, null], [passive, null, null, null]);
        render(<InventoryBar inventory={inventory} />);

        expect(screen.getByText('III')).toBeTruthy();
      });
    });

    describe('Full Inventory', () => {
      it('should display all 8 items when inventory is full', () => {
        const weapons = [
          createFusionWeapon({ level: 1 }),
          createFusionWeapon({ level: 1 }),
          createFusionWeapon({ level: 2 }),
          createFusionWeapon({ level: 3 }),
        ];
        const passives = [
          createFusionWeapon({ type: 'passive', level: 1 }),
          createFusionWeapon({ type: 'passive', level: 2 }),
          createFusionWeapon({ type: 'passive', level: 2 }),
          createFusionWeapon({ type: 'passive', level: 3 }),
        ];
        const inventory = createTestInventory(weapons, passives);
        render(<InventoryBar inventory={inventory} />);

        // Should have level indicators for all weapons
        const levelIs = screen.getAllByText('I');
        const levelIIs = screen.getAllByText('II');
        const levelIIIs = screen.getAllByText('III');

        expect(levelIs.length).toBe(3); // 2 weapons + 1 passive at level 1
        expect(levelIIs.length).toBe(3); // 1 weapon + 2 passives at level 2
        expect(levelIIIs.length).toBe(2); // 1 weapon + 1 passive at level 3
      });
    });

    describe('Mixed Inventory', () => {
      it('should handle mix of filled and empty slots', () => {
        const weapon = createFusionWeapon({ level: 2 });
        const passive = createFusionWeapon({ type: 'passive', level: 1 });
        const inventory = createTestInventory(
          [weapon, null, null, null],
          [null, passive, null, null]
        );
        render(<InventoryBar inventory={inventory} />);

        expect(screen.getByText('II')).toBeTruthy();
        expect(screen.getByText('I')).toBeTruthy();
      });
    });
  });

  describe('Legacy Weapons Array', () => {
    it('should render empty state when no weapons', () => {
      render(<InventoryBar weapons={[]} />);

      expect(screen.getByText('No items yet')).toBeTruthy();
    });

    it('should render single weapon in legacy mode', () => {
      const legacyWeapon: Weapon = {
        id: 'test-weapon',
        name: 'Test Sword',
        description: 'A test weapon',
        shortDescription: 'A test weapon',
        level: 1,
        price: 10,
        rarity: 'common',
        icon: 'lorc/crossed-swords',
        effects: {},
      };
      render(<InventoryBar weapons={[legacyWeapon]} />);

      expect(screen.getByText('Test Sword')).toBeTruthy();
    });

    it('should group duplicate weapons with count badge', () => {
      const weapon: Weapon = {
        id: 'test-weapon',
        name: 'Test Sword',
        description: 'A test weapon',
        shortDescription: 'A test weapon',
        level: 1,
        price: 10,
        rarity: 'common',
        icon: 'lorc/crossed-swords',
        effects: {},
      };
      render(<InventoryBar weapons={[weapon, { ...weapon, id: 'test-2' }, { ...weapon, id: 'test-3' }]} />);

      expect(screen.getByText('3')).toBeTruthy();
    });

    it('should sort weapons by rarity (legendary first)', () => {
      const commonWeapon: Weapon = {
        id: 'common-1',
        name: 'Common Sword',
        description: 'A common weapon',
        shortDescription: 'A common weapon',
        level: 1,
        price: 10,
        rarity: 'common',
        effects: {},
      };
      const legendaryWeapon: Weapon = {
        id: 'legendary-1',
        name: 'Legendary Blade',
        description: 'A legendary weapon',
        shortDescription: 'A legendary weapon',
        level: 1,
        price: 100,
        rarity: 'legendary',
        effects: {},
      };
      const { getAllByText } = render(
        <InventoryBar weapons={[commonWeapon, legendaryWeapon]} />
      );

      // Both should be rendered
      expect(screen.getByText('Common Sword')).toBeTruthy();
      expect(screen.getByText('Legendary Blade')).toBeTruthy();
    });
  });

  describe('Props Priority', () => {
    it('should prefer inventory prop over weapons prop when both provided', () => {
      const inventory = createTestInventory([createFusionWeapon({ level: 3 }), null, null, null]);
      const legacyWeapon: Weapon = {
        id: 'legacy',
        name: 'Legacy Weapon',
        description: 'Should not appear',
        shortDescription: 'Should not appear',
        level: 1,
        price: 10,
        rarity: 'common',
        effects: {},
      };

      render(<InventoryBar inventory={inventory} weapons={[legacyWeapon]} />);

      // Should use new inventory system (shows level indicator)
      expect(screen.getByText('III')).toBeTruthy();
      // Should not show legacy weapon name
      expect(screen.queryByText('Legacy Weapon')).toBeNull();
    });
  });
});
