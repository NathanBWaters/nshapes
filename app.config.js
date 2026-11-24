const pkg = require('./package.json');

const WEB_BASE_URL = process.env.EXPO_BASE_URL || '';
const IS_WEB_SUBPATH = Boolean(WEB_BASE_URL);
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '';

const STORE_VERSION = '1.0.0';
const PRIVACY_POLICY_URL = 'https://nathanbwaters.github.io/nshapes/privacy.html';
const SUPPORT_URL = 'https://nathanbwaters.github.io/nshapes/support.html';

export default {
  expo: {
    name: 'NShapes',
    slug: 'nshapes',
    version: STORE_VERSION,
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'nshapes',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      fallbackToCacheTimeout: 0,
      checkAutomatically: 'ON_LOAD',
      ...(EAS_PROJECT_ID ? { url: `https://u.expo.dev/${EAS_PROJECT_ID}` } : {}),
    },
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#103260',
    },
    ios: {
      supportsTablet: true,
      requireFullScreen: true,
      bundleIdentifier: 'com.nshapes.app',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleAllowMixedLocalizations: false,
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [
          {
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              'NSPrivacyCollectedDataTypePurposeAnalytics',
            ],
          },
        ],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
            NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
            NSPrivacyAccessedAPITypeReasons: ['E174.1'],
          },
        ],
      },
    },
    android: {
      package: 'com.nshapes.app',
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        monochromeImage: './assets/adaptive-icon-monochrome.png',
        backgroundColor: '#103260',
      },
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
      icon: './assets/icon.png',
      name: 'NShapes',
      shortName: 'NShapes',
      description: 'A pattern-matching roguelike — match trios, bend the rules, and build wild combos.',
      backgroundColor: '#145CA8',
      themeColor: '#145CA8',
      display: 'standalone',
      orientation: 'portrait',
      startUrl: IS_WEB_SUBPATH ? `${WEB_BASE_URL.replace(/\/$/, '')}/` : '/',
      scope: IS_WEB_SUBPATH ? `${WEB_BASE_URL.replace(/\/$/, '')}/` : '/',
    },
    plugins: [
      'expo-router',
      'expo-asset',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#103260',
        },
      ],
      [
        'react-native-audio-api',
        {
          iosBackgroundMode: false,
          androidPermissions: [],
          androidForegroundService: false,
          enableFFmpeg: false,
        },
      ],
    ],
    extra: {
      privacyPolicyUrl: PRIVACY_POLICY_URL,
      supportUrl: SUPPORT_URL,
      storeVersion: STORE_VERSION,
      buildVersion: pkg.version,
      ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
      ...(IS_WEB_SUBPATH ? { baseUrl: WEB_BASE_URL } : {}),
    },
  },
};
