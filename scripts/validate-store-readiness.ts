/**
 * Automated App Store & Google Play Store readiness guardrail.
 * Verifies native config, privacy manifests, icon specs (dimensions & zero alpha
 * on Apple icon), EAS config, legal pages, audio compatibility, and dev-route stripping.
 *
 * Usage: npx tsx scripts/validate-store-readiness.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors: string[] = [];

const fail = (msg: string) => {
  errors.push(msg);
};

interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number; // 2 = RGB (no alpha), 6 = RGBA, 3 = indexed, 0 = grayscale
}

function readPngInfo(relPath: string): PngInfo | null {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) {
    fail(`Missing required PNG asset: ${relPath}`);
    return null;
  }
  const buf = fs.readFileSync(full);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 26 || !buf.subarray(0, 8).equals(sig)) {
    fail(`Invalid PNG header: ${relPath}`);
    return null;
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf.readUInt8(24),
    colorType: buf.readUInt8(25),
  };
}

function assertPng(
  relPath: string,
  expectedW: number,
  expectedH: number,
  { requireOpaque = false } = {}
) {
  const info = readPngInfo(relPath);
  if (!info) return;
  if (info.width !== expectedW || info.height !== expectedH) {
    fail(
      `${relPath} must be ${expectedW}x${expectedH}, found ${info.width}x${info.height}`
    );
  }
  if (requireOpaque && info.colorType !== 2 && info.colorType !== 0) {
    fail(
      `${relPath} must be opaque (no alpha channel — Apple ITMS-90717), found PNG colorType=${info.colorType}`
    );
  }
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

// 1. Validate App Icons, Adaptive Icons, Splash & Store Graphics
assertPng('assets/icon.png', 1024, 1024, { requireOpaque: true });
assertPng('assets/adaptive-icon.png', 1024, 1024);
assertPng('assets/adaptive-icon-monochrome.png', 1024, 1024);
assertPng('assets/splash-icon.png', 1024, 1024);
assertPng('store-assets/google-play/app-icon-512.png', 512, 512, { requireOpaque: true });
assertPng('store-assets/google-play/feature-graphic.png', 1024, 500, { requireOpaque: true });

// 2. Validate Expo app.config.js (evaluating without EXPO_BASE_URL to verify native store config)
const prevBase = process.env.EXPO_BASE_URL;
delete process.env.EXPO_BASE_URL;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawConfig = require(path.join(ROOT, 'app.config.js'));
if (prevBase !== undefined) process.env.EXPO_BASE_URL = prevBase;

const expo = (rawConfig.default ?? rawConfig).expo;
if (!expo) {
  fail('app.config.js must export { expo: ... }');
} else {
  if (expo.userInterfaceStyle !== 'light') {
    fail(`app.config.js userInterfaceStyle must be "light", got ${JSON.stringify(expo.userInterfaceStyle)}`);
  }
  if (expo.experiments?.baseUrl) {
    fail(`app.config.js experiments.baseUrl must NOT be set for native builds when EXPO_BASE_URL is unset (got ${expo.experiments.baseUrl})`);
  }
  if (expo.runtimeVersion?.policy !== 'appVersion') {
    fail('app.config.js must configure runtimeVersion: { policy: "appVersion" } for EAS Update');
  }

  // iOS Store Compliance
  if (expo.ios?.bundleIdentifier !== 'com.nshapes.app') {
    fail(`ios.bundleIdentifier mismatch: ${expo.ios?.bundleIdentifier}`);
  }
  if (expo.ios?.supportsTablet && expo.ios?.requireFullScreen !== true) {
    fail('ios.requireFullScreen must be true when supportsTablet is true and orientation is portrait (prevents Apple ITMS-90474)');
  }
  if (expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false) {
    fail('ios.infoPlist.ITSAppUsesNonExemptEncryption must be false');
  }
  const pm = expo.ios?.privacyManifests;
  if (!pm || pm.NSPrivacyTracking !== false) {
    fail('ios.privacyManifests.NSPrivacyTracking must be false');
  }
  if (!Array.isArray(pm?.NSPrivacyAccessedAPITypes) || pm.NSPrivacyAccessedAPITypes.length < 3) {
    fail('ios.privacyManifests.NSPrivacyAccessedAPITypes must declare required API reasons (UserDefaults, FileTimestamp, SystemBootTime)');
  }
  if (!Array.isArray(pm?.NSPrivacyCollectedDataTypes) || pm.NSPrivacyCollectedDataTypes.length < 1) {
    fail('ios.privacyManifests.NSPrivacyCollectedDataTypes must declare anonymous ProductInteraction analytics');
  }

  // Android Store Compliance
  if (expo.android?.package !== 'com.nshapes.app') {
    fail(`android.package mismatch: ${expo.android?.package}`);
  }
  if (expo.android?.edgeToEdgeEnabled !== true) {
    fail('android.edgeToEdgeEnabled must be true for Android 15+ Google Play compliance');
  }
  if (!expo.android?.adaptiveIcon?.monochromeImage) {
    fail('android.adaptiveIcon.monochromeImage must be configured');
  }

  // Native audio plugin guard (must NOT request background audio or foreground service permissions)
  const audioPlugin = (expo.plugins ?? []).find(
    (p: unknown) => Array.isArray(p) && p[0] === 'react-native-audio-api'
  );
  if (!audioPlugin) {
    fail('app.config.js plugins must configure ["react-native-audio-api", { iosBackgroundMode: false, androidPermissions: [], androidForegroundService: false }]');
  } else {
    const opts = audioPlugin[1] ?? {};
    if (opts.iosBackgroundMode !== false) {
      fail('react-native-audio-api plugin must set iosBackgroundMode: false (Apple rejects unused UIBackgroundModes audio)');
    }
    if (opts.androidForegroundService !== false) {
      fail('react-native-audio-api plugin must set androidForegroundService: false');
    }
    if (!Array.isArray(opts.androidPermissions) || opts.androidPermissions.length > 0) {
      fail('react-native-audio-api plugin must set androidPermissions: []');
    }
  }
}

// 3. Validate eas.json
const easPath = path.join(ROOT, 'eas.json');
if (!fs.existsSync(easPath)) {
  fail('Missing eas.json');
} else {
  try {
    const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
    if (eas.cli?.appVersionSource !== 'remote') {
      fail('eas.json cli.appVersionSource should be "remote"');
    }
    for (const profile of ['development', 'preview', 'production']) {
      if (!eas.build?.[profile]) {
        fail(`eas.json missing build.${profile} profile`);
      }
    }
    if (eas.build?.production?.autoIncrement !== true) {
      fail('eas.json build.production.autoIncrement must be true');
    }
    if (eas.build?.production?.android?.buildType !== 'app-bundle') {
      fail('eas.json build.production.android.buildType must be "app-bundle" (.aab)');
    }
    if (!eas.submit?.production) {
      fail('eas.json missing submit.production');
    }
  } catch (err) {
    fail(`eas.json is not valid JSON: ${String(err)}`);
  }
}

// 4. Validate Legal / Support Pages & Store Docs
for (const reqFile of [
  'public/privacy.html',
  'public/support.html',
  'docs/store/app-store-connect.md',
  'docs/store/google-play-console.md',
  'docs/store/RELEASE_GUIDE.md',
  '.github/workflows/mobile-release.yml',
]) {
  const full = path.join(ROOT, reqFile);
  if (!fs.existsSync(full) || fs.statSync(full).size < 200) {
    fail(`Missing or incomplete required store file: ${reqFile}`);
  }
}

// 5. Verify no iOS-incompatible .ogg assets remain under assets/
const oggFiles = walkFiles(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.ogg'));
if (oggFiles.length > 0) {
  fail(`Found iOS-incompatible .ogg files in assets/: ${oggFiles.map((f) => path.relative(ROOT, f)).join(', ')}`);
}

// 6. Verify no hardcoded fontFamily: 'monospace' in src/ (invalid font name on iOS)
const srcFiles = walkFiles(path.join(ROOT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f));
for (const file of srcFiles) {
  if (file.endsWith(path.join('utils', 'fonts.ts'))) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (/fontFamily:\s*['"]monospace['"]/.test(content)) {
    fail(`Hardcoded fontFamily: 'monospace' in ${path.relative(ROOT, file)} — use MONO_FONT from '@/utils/fonts'`);
  }
}

// 7. Verify /dev/* routes are stripped in production
const devLayout = fs.readFileSync(path.join(ROOT, 'app/dev/_layout.tsx'), 'utf8');
if (!devLayout.includes('__DEV__') || !devLayout.includes('Redirect')) {
  fail('app/dev/_layout.tsx must guard !__DEV__ with <Redirect href="/" />');
}
const metroCfg = fs.readFileSync(path.join(ROOT, 'metro.config.js'), 'utf8');
if (!metroCfg.includes('blockList') || !metroCfg.includes('dev')) {
  fail('metro.config.js must blockList app/dev/* in production builds');
}

if (errors.length > 0) {
  console.error('✖ Store readiness validation failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log('✓ Store readiness validation passed (App Store & Google Play checks OK)');
