/**
 * Tests for the new PlayerInventory interface
 *
 * The new inventory system features:
 * - 4 weapon slots (for fusable weapons)
 * - 4 passive slots (for non-fusable passives)
 * - null values for empty slots
 */

import { PlayerInventory, FusionWeapon } from '../../src/types';
import { createEmptyInventory, addWeaponToInventory, addPassiveToInventory, getWeaponCount, getPassiveCount } from '../../src/utils/inventoryUtils';
import { BASE_WEAPONS, BASE_PASSIVES } from '../../src/utils/fusionDefinitions';

describe('PlayerInventory Type', () => {
  describe('Inventory structure', () => {
    it('should have exactly 4 weapon slots', () => {
      const inventory = createEmptyInventory();
      expect(inventory.weapons).toHaveLength(4);
    });

    it('should have exactly 4 passive slots', () => {
      const inventory = createEmptyInventory();
      expect(inventory.passives).toHaveLength(4);
    });

    it('empty slots should be null', () => {
      const inventory = createEmptyInventory();

      inventory.weapons.forEach(slot => {
        expect(slot).toBeNull();
      });

      inventory.passives.forEach(slot => {
        expect(slot).toBeNull();
      });
    });
  });

  describe('Adding weapons to inventory', () => {
    it('should add weapon to first empty slot', () => {
      const inventory = createEmptyInventory();
      const blastPowder = BASE_WEAPONS.find(w => w.name === 'Blast Powder')!;

      const result = addWeaponToInventory(inventory, blastPowder);

      expect(result.success).toBe(true);
      expect(result.inventory.weapons[0]).not.toBeNull();
      expect(result.inventory.weapons[0]?.name).toBe('Blast Powder');
    });

    it('should fail to add weapon when all 4 slots are full', () => {
      let inventory = createEmptyInventory();

      // Fill all 4 slots
      for (let i = 0; i < 4; i++) {
        const weapon = { ...BASE_WEAPONS[i % BASE_WEAPONS.length] };
        const result = addWeaponToInventory(inventory, weapon);
        inventory = result.inventory;
      }

      // Try to add a 5th weapon
      const extraWeapon = { ...BASE_WEAPONS[0] };
      const result = addWeaponToInventory(inventory, extraWeapon);

      expect(result.success).toBe(false);
      expect(getWeaponCount(result.inventory)).toBe(4);
    });

    it('should not add passives to weapon slots', () => {
      const inventory = createEmptyInventory();
      const passive = BASE_PASSIVES.find(p => p.name === 'Oracle Eye')!;

      // Attempt to add passive as weapon should fail
      const result = addWeaponToInventory(inventory, passive as any);

      expect(result.success).toBe(false);
    });
  });

  describe('Adding passives to inventory', () => {
    it('should add passive to first empty slot', () => {
      const inventory = createEmptyInventory();
      const oracleEye = BASE_PASSIVES.find(p => p.name === 'Oracle Eye')!;

      const result = addPassiveToInventory(inventory, oracleEye);

      expect(result.success).toBe(true);
      expect(result.inventory.passives[0]).not.toBeNull();
      expect(result.inventory.passives[0]?.name).toBe('Oracle Eye');
    });

    it('should fail to add passive when all 4 slots are full', () => {
      let inventory = createEmptyInventory();

      // Fill all 4 slots
      for (let i = 0; i < 4; i++) {
        const passive = { ...BASE_PASSIVES[i % BASE_PASSIVES.length] };
        const result = addPassiveToInventory(inventory, passive);
        inventory = result.inventory;
      }

      // Try to add a 5th passive
      const extraPassive = { ...BASE_PASSIVES[0] };
      const result = addPassiveToInventory(inventory, extraPassive);

      expect(result.success).toBe(false);
      expect(getPassiveCount(result.inventory)).toBe(4);
    });

    it('should not add weapons to passive slots', () => {
      const inventory = createEmptyInventory();
      const weapon = BASE_WEAPONS.find(w => w.name === 'Blast Powder')!;

      // Attempt to add weapon as passive should fail
      const result = addPassiveToInventory(inventory, weapon as any);

      expect(result.success).toBe(false);
    });
  });

  describe('Counting items', () => {
    it('should count weapons correctly', () => {
      let inventory = createEmptyInventory();
      expect(getWeaponCount(inventory)).toBe(0);

      // Add 2 weapons
      const weapon1 = { ...BASE_WEAPONS[0] };
      const weapon2 = { ...BASE_WEAPONS[1] };
      inventory = addWeaponToInventory(inventory, weapon1).inventory;
      inventory = addWeaponToInventory(inventory, weapon2).inventory;

      expect(getWeaponCount(inventory)).toBe(2);
    });

    it('should count passives correctly', () => {
      let inventory = createEmptyInventory();
      expect(getPassiveCount(inventory)).toBe(0);

      // Add 3 passives
      const passive1 = { ...BASE_PASSIVES[0] };
      const passive2 = { ...BASE_PASSIVES[1] };
      const passive3 = { ...BASE_PASSIVES[2] };
      inventory = addPassiveToInventory(inventory, passive1).inventory;
      inventory = addPassiveToInventory(inventory, passive2).inventory;
      inventory = addPassiveToInventory(inventory, passive3).inventory;

      expect(getPassiveCount(inventory)).toBe(3);
    });
  });

  describe('Slot limits', () => {
    it('should enforce 4 weapon slot limit', () => {
      let inventory = createEmptyInventory();

      // Fill all 4 weapon slots
      for (let i = 0; i < 4; i++) {
        const weapon = { ...BASE_WEAPONS[i % BASE_WEAPONS.length], id: `weapon-${i}` };
        const result = addWeaponToInventory(inventory, weapon);
        expect(result.success).toBe(true);
        inventory = result.inventory;
      }

      expect(getWeaponCount(inventory)).toBe(4);

      // 5th weapon should fail
      const weapon5 = { ...BASE_WEAPONS[0], id: 'weapon-5' };
      const result = addWeaponToInventory(inventory, weapon5);
      expect(result.success).toBe(false);
      expect(getWeaponCount(result.inventory)).toBe(4);
    });

    it('should enforce 4 passive slot limit', () => {
      let inventory = createEmptyInventory();

      // Fill all 4 passive slots
      for (let i = 0; i < 4; i++) {
        const passive = { ...BASE_PASSIVES[i % BASE_PASSIVES.length], id: `passive-${i}` };
        const result = addPassiveToInventory(inventory, passive);
        expect(result.success).toBe(true);
        inventory = result.inventory;
      }

      expect(getPassiveCount(inventory)).toBe(4);

      // 5th passive should fail
      const passive5 = { ...BASE_PASSIVES[0], id: 'passive-5' };
      const result = addPassiveToInventory(inventory, passive5);
      expect(result.success).toBe(false);
      expect(getPassiveCount(result.inventory)).toBe(4);
    });
  });
});
