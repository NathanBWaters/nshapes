import * as path from 'path';
import { version as PKG_VERSION } from '../package.json';
import {
  BALANCE_ERAS,
  BALANCE_ERA_MANIFEST,
  CURRENT_BALANCE_ERA_ID,
  compareSemver,
  getEraForVersion,
  getMinValidVersion,
  isVersionAtLeast,
  nextPatchVersion,
  semverToNumeric,
  type BalanceEra,
} from '@/analytics/balanceEras';
import {
  computeBalanceFingerprints,
  diffBalanceFingerprints,
  VIRTUAL_GLOBAL_CONSTANTS_KEY,
} from '@/analytics/balanceFingerprints';
import { validateManifestIntegrity } from '../scripts/balance-eras';

const REPO_ROOT = path.resolve(__dirname, '..');

describe('balanceEras manifest & semver helpers', () => {
  it('compares semver numerically (never lexicographically)', () => {
    expect(semverToNumeric('0.1.99')).toBe(1099);
    expect(semverToNumeric('0.1.100')).toBe(1100);
    expect(semverToNumeric('v0.1.164')).toBe(1164);
    expect(semverToNumeric('1.2.3-beta.1')).toBe(1_002_003);
    expect(semverToNumeric(null)).toBeNull();
    expect(semverToNumeric('invalid')).toBeNull();

    // Lexicographically '0.1.99' > '0.1.100', numerically 0.1.99 < 0.1.100
    expect(compareSemver('0.1.99', '0.1.100')).toBe(-1);
    expect(compareSemver('0.1.164', '0.1.164')).toBe(0);
    expect(compareSemver('0.2.0', '0.1.999')).toBe(1);

    expect(isVersionAtLeast('0.1.100', '0.1.99')).toBe(true);
    expect(isVersionAtLeast('0.1.99', '0.1.100')).toBe(false);
    expect(isVersionAtLeast('0.1.164', '0.1.164')).toBe(true);
    expect(isVersionAtLeast(undefined, '0.1.164')).toBe(false);
    expect(nextPatchVersion('0.1.164')).toBe('0.1.165');
  });

  it('resolves historical eras and hierarchical global/mode/category/item validity floors', () => {
    expect(BALANCE_ERAS.length).toBeGreaterThanOrEqual(9);
    const currentEra = BALANCE_ERAS[BALANCE_ERAS.length - 1];
    const currentMin = currentEra.minVersion;
    const nextMin = nextPatchVersion(currentMin);
    expect(CURRENT_BALANCE_ERA_ID).toBe(currentEra.id);

    expect(getEraForVersion('0.1.118')).toBeNull();
    expect(getEraForVersion('0.1.119')?.id).toBe('E0');
    expect(getEraForVersion('0.1.154')?.id).toBe('E5');
    expect(getEraForVersion('0.1.158')?.id).toBe('E6');
    expect(getEraForVersion('0.1.160')?.id).toBe('E7');
    expect(getEraForVersion('0.1.164')?.id).toBe('E8');
    expect(getEraForVersion(currentMin)?.id).toBe(currentEra.id);
    expect(getEraForVersion('0.1.999')?.id).toBe(currentEra.id);

    // Current era global floor (or active mode/category floor) matches manifest minVersion
    const expectedAdvFloor = getMinValidVersion('all', undefined, 'adventure', BALANCE_ERAS);
    expect(expectedAdvFloor).toBe(getMinValidVersion('all', undefined, 'adventure'));
    expect(isVersionAtLeast(currentMin, expectedAdvFloor)).toBe(true);
    expect(getMinValidVersion('weapons', 'blast-powder', 'adventure')).toBe(expectedAdvFloor);
    expect(getMinValidVersion('evolutions', 'stockpile', 'adventure')).toBe(expectedAdvFloor);

    // Historical E8 was a global hard reset at 0.1.164
    const erasThroughE8 = BALANCE_ERAS.slice(0, 9); // E0..E8
    expect(getMinValidVersion('all', undefined, 'adventure', erasThroughE8)).toBe('0.1.164');
    expect(getMinValidVersion('all', undefined, 'spire', erasThroughE8)).toBe('0.1.164');

    // Mode-scoped era (E6 Spire) does not cross-invalidate Adventure when evaluated up to E6
    const erasThroughE6 = BALANCE_ERAS.slice(0, 7); // E0..E6
    expect(getMinValidVersion('weapons', 'blast-powder', 'spire', erasThroughE6)).toBe('0.1.158');
    expect(getMinValidVersion('weapons', 'blast-powder', 'adventure', erasThroughE6)).toBe('0.1.154');

    // Category-scoped era (E7 Evolutions) invalidates evolutions but preserves weapons/fighters
    const erasThroughE7 = BALANCE_ERAS.slice(0, 8); // E0..E7
    expect(getMinValidVersion('evolutions', 'phoenix-pyre', 'adventure', erasThroughE7)).toBe('0.1.159');
    expect(getMinValidVersion('weapons', 'blast-powder', 'adventure', erasThroughE7)).toBe('0.1.154');
    expect(getMinValidVersion('fighters', 'Corgi', 'adventure', erasThroughE7)).toBe('0.1.154');

    // Granular per-item era: buffing only chrono-shard in next patch keeps blast-powder valid from current floor
    const withGranularPatch: BalanceEra[] = [
      ...BALANCE_ERAS,
      {
        id: `E${BALANCE_ERAS.length}`,
        minVersion: nextMin,
        date: '2026-11-22',
        commit: 'testsha',
        summary: 'Buff chrono-shard only',
        scope: 'item',
        invalidated: { weapons: ['chrono-shard'] },
      },
    ];
    expect(getMinValidVersion('weapons', 'chrono-shard', 'adventure', withGranularPatch)).toBe(nextMin);
    expect(getMinValidVersion('weapons', 'blast-powder', 'adventure', withGranularPatch)).toBe(expectedAdvFloor);
    expect(getMinValidVersion('fighters', 'Corgi', 'adventure', withGranularPatch)).toBe(expectedAdvFloor);
  });

  it('infers global, mode, category, and item invalidation scopes accurately from fingerprint diffs', () => {
    const base = BALANCE_ERA_MANIFEST.fingerprints;

    // 1. Identical snapshots -> no changes
    const none = diffBalanceFingerprints(base, base);
    expect(none.hasChanges).toBe(false);

    // 2. Single weapon mechanical change -> granular item scope
    const singleWeapon = {
      engineFiles: { ...base.engineFiles },
      items: {
        ...base.items,
        weapons: { ...base.items.weapons, 'chrono-shard': 'deadbeef12345678' },
      },
    };
    const itemDiff = diffBalanceFingerprints(base, singleWeapon);
    expect(itemDiff.hasChanges).toBe(true);
    expect(itemDiff.inferredScope).toBe('item');
    expect(itemDiff.inferredInvalidation).toEqual({ weapons: ['chrono-shard'] });

    // 3. Spire-only file change -> mode scope ['spire']
    const spireOnly = {
      engineFiles: { ...base.engineFiles, 'src/spire/data/encounters.ts': 'abcd1234ef567890' },
      items: base.items,
    };
    const modeDiff = diffBalanceFingerprints(base, spireOnly);
    expect(modeDiff.inferredScope).toBe('mode');
    expect(modeDiff.inferredInvalidation.modes).toEqual(['spire']);
    expect(modeDiff.inferredInvalidation.global).toBeUndefined();

    // 4. Global constant or combat engine change -> global scope
    const globalChange = {
      engineFiles: { ...base.engineFiles, [VIRTUAL_GLOBAL_CONSTANTS_KEY]: '1111222233334444' },
      items: base.items,
    };
    const globalDiff = diffBalanceFingerprints(base, globalChange);
    expect(globalDiff.inferredScope).toBe('global');
    expect(globalDiff.inferredInvalidation.global).toBe(true);

    // 5. >= 50% of levels edited -> category scope ['levels']
    const halfLevels = { ...base.items.levels };
    const levelIds = Object.keys(halfLevels);
    for (let i = 0; i < Math.ceil(levelIds.length * 0.6); i++) {
      halfLevels[levelIds[i]] = '9999aaaabbbbcccc';
    }
    const catDiff = diffBalanceFingerprints(base, {
      engineFiles: { ...base.engineFiles },
      items: { ...base.items, levels: halfLevels },
    });
    expect(catDiff.inferredScope).toBe('category');
    expect(catDiff.inferredInvalidation.categories).toEqual(['levels']);
  });

  it('passes deterministic repo integrity check now and across future non-balance version bumps', () => {
    const fp = computeBalanceFingerprints(REPO_ROOT);
    expect(Object.keys(fp.items.weapons).length).toBe(64);
    expect(Object.keys(fp.items.evolutions).length).toBe(208);
    expect(Object.keys(fp.items.fighters).length).toBe(6);
    expect(Object.keys(fp.items.arcana).length).toBe(8);
    expect(Object.keys(fp.items.levels).length).toBeGreaterThanOrEqual(55);

    const checkCurrent = validateManifestIntegrity(BALANCE_ERA_MANIFEST, PKG_VERSION, REPO_ROOT);
    expect(checkCurrent.errors).toEqual([]);
    expect(checkCurrent.ok).toBe(true);

    // Future non-balance patch bump (e.g. UI/audio/docs commit) must remain valid!
    const checkFuture = validateManifestIntegrity(
      BALANCE_ERA_MANIFEST,
      nextPatchVersion(PKG_VERSION),
      REPO_ROOT
    );
    expect(checkFuture.errors).toEqual([]);
    expect(checkFuture.ok).toBe(true);
  });
});
