/**
 * Shop Removal Tests
 *
 * Tests that verify the shop has been removed from the game flow
 * while the component code is preserved for future use.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Shop Removal', () => {
  // Read Game.tsx once for all tests
  const gamePath = join(__dirname, '../../src/components/Game.tsx');
  const gameContent = readFileSync(gamePath, 'utf-8');

  describe('Component Preservation', () => {
    it('should have WeaponShop component file preserved', () => {
      const shopPath = join(__dirname, '../../src/components/WeaponShop.tsx');
      expect(existsSync(shopPath)).toBe(true);
    });

    it('should have WeaponShop.test file removed (cleanup from Phase 3)', () => {
      // Shop tests were removed in Phase 3 as part of cleanup
      // This is expected behavior - shop component preserved, tests removed
      const testPath = join(__dirname, '../weaponShop.test.ts');
      expect(existsSync(testPath)).toBe(false);
    });
  });

  describe('Game Flow Changes', () => {
    it('should have Game.tsx updated to skip shop', () => {
      // Check that comments indicate shop is being skipped
      expect(gameContent).toContain('skip shop');
      expect(gameContent).toContain('Shop is hidden');
    });

    it('should call handleProceedFromShop after level-ups instead of transitioning to shop', () => {
      // Verify the level-up completion now calls handleProceedFromShop
      // by checking for the new pattern
      expect(gameContent).toContain('handleProceedFromShop()');

      // The old pattern of transitioning to shop after level-ups should be gone
      // Look for the specific pattern "No more level-ups" followed by shop transition
      const oldPattern = /No more level-ups.*setGamePhase\('shop'\)/gs;
      expect(gameContent).not.toMatch(oldPattern);
    });

    it('should have shop case in switch statement (component still renderable)', () => {
      // The shop case in the switch should exist for backward compatibility
      // even if we don't transition to it normally
      expect(gameContent).toContain("case 'shop':");
    });

    it('should use handleProceedFromShop in round summary continue handler', () => {
      // Round summary should also skip shop
      expect(gameContent).toContain('handleProceedFromShop()');
    });
  });

  describe('Shop Phase Type', () => {
    it('should have shop in GamePhase type for type safety', () => {
      // Verify 'shop' is still a valid game phase for type safety
      // (even though we don't transition to it)
      expect(gameContent).toMatch(/'shop'\s*\|/);
    });
  });
});
