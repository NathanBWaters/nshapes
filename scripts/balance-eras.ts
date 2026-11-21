/**
 * Balance Era Manifest & Version-Invalidation CLI:
 *   - `check`       Deterministic guardrail: verifies fingerprints, era ordering, and version floor.
 *   - `record`      Records a new Balance Era (auto-detecting global/mode/category/item scope).
 *   - `status`      Shows current Balance Era, active version floors, and unrecorded drift.
 *   - `history`     Lists all recorded Balance Eras from E0 to HEAD.
 *   - `valid-since` Queries the exact `minValidVersion` for any category/item/mode.
 *
 * Examples:
 *   npm run validate:balance-eras
 *   npm run balance:era:status
 *   npm run balance:era:record -- --summary "Buff chrono-shard Lv1-5" --bump
 *   npx tsx scripts/balance-eras.ts valid-since --category evolutions --item stockpile --mode adventure
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  compareSemver,
  getMinValidVersion,
  nextPatchVersion,
  semverToNumeric,
  type BalanceCategory,
  type BalanceEra,
  type BalanceEraManifest,
  type BalanceEraScope,
  type FightModeFilter,
} from '../src/analytics/balanceEras';
import {
  computeBalanceFingerprints,
  diffBalanceFingerprints,
  type BalanceFingerprintDiff,
} from '../src/analytics/balanceFingerprints';

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/analytics/balanceEras.json');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

const VALID_CATEGORIES = new Set<BalanceCategory | 'all'>([
  'all',
  'weapons',
  'evolutions',
  'fighters',
  'arcana',
  'levels',
]);
const VALID_MODES = new Set<FightModeFilter>(['adventure', 'spire', 'free_play', 'classic']);
const VALID_SCOPES = new Set<BalanceEraScope | 'auto'>(['auto', 'global', 'mode', 'category', 'item']);

const readManifest = (): BalanceEraManifest =>
  JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as BalanceEraManifest;

const writeManifest = (manifest: BalanceEraManifest) => {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
};

const readPackageJson = (): { version: string; [k: string]: unknown } =>
  JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { version: string; [k: string]: unknown };

const getShortHeadSha = (): string => {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'working-tree';
  }
};

const parseFlags = (argv: string[]): Record<string, string | boolean> => {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const eqIdx = key.indexOf('=');
    if (eqIdx >= 0) {
      flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
};

const formatDiffLines = (diff: BalanceFingerprintDiff): string[] => {
  const lines: string[] = [];
  if (diff.changedEngineFiles.length > 0) {
    lines.push(`  Changed engine files (${diff.changedEngineFiles.length}): ${diff.changedEngineFiles.join(', ')}`);
  }
  if (diff.addedEngineFiles.length > 0) {
    lines.push(`  Added engine files (${diff.addedEngineFiles.length}): ${diff.addedEngineFiles.join(', ')}`);
  }
  if (diff.removedEngineFiles.length > 0) {
    lines.push(`  Removed engine files (${diff.removedEngineFiles.length}): ${diff.removedEngineFiles.join(', ')}`);
  }
  for (const cat of ['weapons', 'evolutions', 'fighters', 'arcana', 'levels'] as const) {
    const c = diff.changedItems[cat];
    const a = diff.addedItems[cat];
    const r = diff.removedItems[cat];
    if (c.length > 0) lines.push(`  Changed ${cat} (${c.length}): ${c.slice(0, 12).join(', ')}${c.length > 12 ? ` (+${c.length - 12} more)` : ''}`);
    if (a.length > 0) lines.push(`  Added ${cat} (${a.length}): ${a.slice(0, 12).join(', ')}${a.length > 12 ? ` (+${a.length - 12} more)` : ''}`);
    if (r.length > 0) lines.push(`  Removed ${cat} (${r.length}): ${r.slice(0, 12).join(', ')}${r.length > 12 ? ` (+${r.length - 12} more)` : ''}`);
  }
  lines.push(`  Inferred scope: ${diff.inferredScope} -> ${JSON.stringify(diff.inferredInvalidation)}`);
  return lines;
};

export const validateManifestIntegrity = (
  manifest: BalanceEraManifest,
  pkgVersion: string,
  repoRoot: string = REPO_ROOT
): { ok: boolean; errors: string[]; diff: BalanceFingerprintDiff; counts: Record<string, number> } => {
  const errors: string[] = [];

  if (!Array.isArray(manifest.eras) || manifest.eras.length === 0) {
    errors.push('Manifest must contain at least one BalanceEra entry.');
  }

  const seenIds = new Set<string>();
  let prevMin: string | null = null;
  for (const era of manifest.eras ?? []) {
    if (!era.id || typeof era.id !== 'string') {
      errors.push('Every BalanceEra must have a non-empty string id.');
    } else if (seenIds.has(era.id)) {
      errors.push(`Duplicate BalanceEra id "${era.id}".`);
    } else {
      seenIds.add(era.id);
    }

    if (semverToNumeric(era.minVersion) === null) {
      errors.push(`Era "${era.id}" has invalid semver minVersion "${era.minVersion}".`);
    } else if (prevMin !== null && compareSemver(prevMin, era.minVersion) > 0) {
      errors.push(`Era "${era.id}" minVersion (${era.minVersion}) is older than previous era (${prevMin}).`);
    }
    prevMin = era.minVersion;
  }

  const latestEra = manifest.eras?.[manifest.eras.length - 1];
  if (latestEra) {
    if (manifest.currentEraId !== latestEra.id) {
      errors.push(
        `currentEraId ("${manifest.currentEraId}") must match latest era id ("${latestEra.id}").`
      );
    }
    if (semverToNumeric(pkgVersion) === null) {
      errors.push(`package.json version "${pkgVersion}" is not valid semver.`);
    } else if (compareSemver(latestEra.minVersion, pkgVersion) > 0) {
      errors.push(
        `Latest era ${latestEra.id} minVersion (${latestEra.minVersion}) exceeds package.json version (${pkgVersion}).`
      );
    }
  }

  const currentFp = computeBalanceFingerprints(repoRoot);
  const diff = diffBalanceFingerprints(manifest.fingerprints, currentFp);
  if (diff.hasChanges) {
    errors.push(
      [
        'Unrecorded balance changes detected compared to src/analytics/balanceEras.json:',
        ...formatDiffLines(diff),
        'Run: npm run balance:era:record -- --summary "<describe balance update>" [--version X.Y.Z | --bump]',
      ].join('\n')
    );
  }

  const counts = {
    engineFiles: Object.keys(currentFp.engineFiles).length,
    weapons: Object.keys(currentFp.items.weapons).length,
    evolutions: Object.keys(currentFp.items.evolutions).length,
    fighters: Object.keys(currentFp.items.fighters).length,
    arcana: Object.keys(currentFp.items.arcana).length,
    levels: Object.keys(currentFp.items.levels).length,
  };

  return { ok: errors.length === 0, errors, diff, counts };
};

const runCheck = () => {
  const manifest = readManifest();
  const pkg = readPackageJson();
  const res = validateManifestIntegrity(manifest, pkg.version, REPO_ROOT);
  if (!res.ok) {
    console.error('✗ Balance Era guardrail failed:');
    for (const err of res.errors) console.error(err);
    process.exit(1);
  }
  const latest = manifest.eras[manifest.eras.length - 1];
  console.log(
    `✓ Balance Era manifest valid (${latest.id}, minVersion ${latest.minVersion}, app ${pkg.version}; ` +
      `${res.counts.engineFiles} engine hashes, ${res.counts.weapons} weapons, ${res.counts.evolutions} evolutions, ` +
      `${res.counts.fighters} fighters, ${res.counts.arcana} arcana, ${res.counts.levels} levels)`
  );
};

const nextEraId = (eras: readonly BalanceEra[]): string => {
  let maxNum = -1;
  for (const e of eras) {
    const m = /^E(\d+)$/.exec(e.id);
    if (m) maxNum = Math.max(maxNum, Number.parseInt(m[1], 10));
  }
  return `E${maxNum + 1}`;
};

const runRecord = (flags: Record<string, string | boolean>) => {
  const manifest = readManifest();
  const pkg = readPackageJson();
  const currentFp = computeBalanceFingerprints(REPO_ROOT);

  if (flags['init-fingerprints']) {
    manifest.fingerprints = currentFp;
    manifest.currentAppVersion = pkg.version;
    writeManifest(manifest);
    console.log(
      `✓ Initialized balance fingerprints in src/analytics/balanceEras.json for ${manifest.currentEraId} (v${pkg.version})`
    );
    return;
  }

  const diff = diffBalanceFingerprints(manifest.fingerprints, currentFp);
  if (!diff.hasChanges && !flags.force) {
    console.log(`No mechanical balance changes detected since ${manifest.currentEraId}. Nothing recorded.`);
    return;
  }

  const latest = manifest.eras[manifest.eras.length - 1];
  let targetVersion = pkg.version;
  if (typeof flags.version === 'string') {
    if (semverToNumeric(flags.version) === null) {
      console.error(`Invalid --version "${flags.version}". Expected X.Y.Z semver.`);
      process.exit(1);
    }
    targetVersion = flags.version.replace(/^v/, '');
  } else if (flags.bump) {
    targetVersion = nextPatchVersion(pkg.version);
    pkg.version = targetVersion;
    fs.writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    console.log(`↑ Bumped package.json version -> ${targetVersion}`);
  }

  if (latest && compareSemver(targetVersion, latest.minVersion) < 0) {
    console.error(
      `Target version (${targetVersion}) is older than latest era ${latest.id} (${latest.minVersion}).`
    );
    process.exit(1);
  }

  const rawScope = typeof flags.scope === 'string' ? flags.scope : 'auto';
  if (!VALID_SCOPES.has(rawScope as BalanceEraScope | 'auto')) {
    console.error(`Invalid --scope "${rawScope}". Use: auto | global | mode | category | item`);
    process.exit(1);
  }
  const scope: BalanceEraScope =
    rawScope === 'auto' ? diff.inferredScope : (rawScope as BalanceEraScope);
  const invalidated =
    scope === 'global'
      ? {
          global: true,
          modes: ['adventure', 'spire'] as FightModeFilter[],
          categories: ['weapons', 'evolutions', 'fighters', 'arcana', 'levels'] as BalanceCategory[],
        }
      : diff.inferredInvalidation;

  const summary =
    typeof flags.summary === 'string' && flags.summary.trim().length > 0
      ? flags.summary.trim()
      : `Balance update (${scope}: ${Object.keys(invalidated).join(', ') || 'manual'})`;

  const id = nextEraId(manifest.eras);
  const newEra: BalanceEra = {
    id,
    minVersion: targetVersion,
    date: new Date().toISOString().slice(0, 10),
    commit: getShortHeadSha(),
    summary,
    scope,
    invalidated,
  };

  manifest.eras.push(newEra);
  manifest.currentEraId = id;
  manifest.currentAppVersion = targetVersion;
  manifest.fingerprints = currentFp;
  writeManifest(manifest);

  console.log(`✓ Recorded Balance Era ${id} (minVersion ${targetVersion}, scope: ${scope})`);
  for (const line of formatDiffLines(diff)) console.log(line);
  if (!flags.bump && typeof flags.version !== 'string' && latest && targetVersion === latest.minVersion) {
    console.log(
      `Note: minVersion matches previous era (${targetVersion}). When bumping package.json for release, pass --bump or --version ${nextPatchVersion(pkg.version)}.`
    );
  }
  console.log('Tip: Run `npm run analytics:export` to refresh docs/posthog-dashboards.json with the new version floor.');
};

const runStatus = () => {
  const manifest = readManifest();
  const pkg = readPackageJson();
  const currentFp = computeBalanceFingerprints(REPO_ROOT);
  const diff = diffBalanceFingerprints(manifest.fingerprints, currentFp);
  const latest = manifest.eras[manifest.eras.length - 1];

  console.log(`Current Balance Era : ${latest.id} (minVersion >= v${latest.minVersion}, date ${latest.date})`);
  console.log(`Summary             : ${latest.summary}`);
  console.log(`App Version         : v${pkg.version}`);
  console.log(`Adventure Floor     : >= v${getMinValidVersion('all', undefined, 'adventure', manifest.eras)}`);
  console.log(`Starfall Summit     : >= v${getMinValidVersion('all', undefined, 'spire', manifest.eras)}`);
  console.log(`Weapons Floor       : >= v${getMinValidVersion('weapons', undefined, 'adventure', manifest.eras)}`);
  console.log(`Evolutions Floor    : >= v${getMinValidVersion('evolutions', undefined, 'adventure', manifest.eras)}`);
  console.log(`Fighters Floor      : >= v${getMinValidVersion('fighters', undefined, 'adventure', manifest.eras)}`);
  console.log(`Working Tree Drift  : ${diff.hasChanges ? 'UNRECORDED CHANGES DETECTED' : 'Clean (matches manifest)'}`);
  if (diff.hasChanges) {
    for (const line of formatDiffLines(diff)) console.log(line);
  }
};

const runHistory = () => {
  const manifest = readManifest();
  console.log('| Era | Min Version | Date | Commit | Scope | Summary |');
  console.log('|---|---|---|---|---|---|');
  for (const e of manifest.eras) {
    console.log(`| ${e.id} | v${e.minVersion} | ${e.date} | ${e.commit} | ${e.scope} | ${e.summary} |`);
  }
};

const runValidSince = (flags: Record<string, string | boolean>) => {
  const manifest = readManifest();
  const rawCat = typeof flags.category === 'string' ? flags.category : 'all';
  if (!VALID_CATEGORIES.has(rawCat as BalanceCategory | 'all')) {
    console.error(`Invalid --category "${rawCat}". Use: all | weapons | evolutions | fighters | arcana | levels`);
    process.exit(1);
  }
  const category = rawCat as BalanceCategory | 'all';
  const item = typeof flags.item === 'string' ? flags.item : undefined;
  const rawMode = typeof flags.mode === 'string' ? flags.mode : undefined;
  if (rawMode && !VALID_MODES.has(rawMode as FightModeFilter)) {
    console.error(`Invalid --mode "${rawMode}". Use: adventure | spire | free_play | classic`);
    process.exit(1);
  }
  const mode = rawMode as FightModeFilter | undefined;
  const minVer = getMinValidVersion(category, item, mode, manifest.eras);
  const label = [category, item ? `(${item})` : null, mode ? `[${mode}]` : null].filter(Boolean).join(' ');
  console.log(`${label}: valid since app_version >= ${minVer}`);
};

if (require.main === module) {
  const [cmd = 'status', ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (cmd === 'check') {
    runCheck();
  } else if (cmd === 'record') {
    runRecord(flags);
  } else if (cmd === 'status') {
    runStatus();
  } else if (cmd === 'history') {
    runHistory();
  } else if (cmd === 'valid-since') {
    runValidSince(flags);
  } else {
    console.error(
      `Unknown command "${cmd}". Use: check | record | status | history | valid-since`
    );
    process.exit(1);
  }
}
