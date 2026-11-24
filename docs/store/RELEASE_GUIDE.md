# NShapes Mobile Store Release Guide (Apple App Store & Google Play)

This repository is pre-configured for **Expo Application Services (EAS Build, EAS Submit, and EAS Update)** using Continuous Native Generation (CNG — no committed `ios/` or `android/` folders).

---

## 1. One-Time Prerequisites

1. **Expo / EAS Account:** Create a free account at [expo.dev](https://expo.dev).
2. **Apple Developer Program** (\$99/yr): Enroll at [developer.apple.com](https://developer.apple.com) and create an App ID + App Store Connect app record with Bundle ID **`com.nshapes.app`**.
3. **Google Play Console** (\$25 one-time): Enroll at [play.google.com/console](https://play.google.com/console) and create an app with package name **`com.nshapes.app`**.

---

## 2. One-Time Project Linking (Local CLI)

```bash
# 1. Authenticate with Expo
npx eas-cli login

# 2. Link this repo to an EAS project (creates your EAS projectId)
npx eas-cli init

# 3. Record the generated projectId from `eas project:info`
#    Set EAS_PROJECT_ID in your shell and in GitHub Repo Secrets/Variables
#    (or paste into app.config.js extra.eas.projectId once initialized).
export EAS_PROJECT_ID="<your-eas-project-uuid>"
```

### Optional: Wire GitHub Actions Mobile Releases (`.github/workflows/mobile-release.yml`)
1. Generate a robot/access token at **expo.dev → Account Settings → Access Tokens**.
2. In GitHub **Settings → Secrets and variables → Actions**, add:
   - Secret **`EXPO_TOKEN`**: your Expo access token
   - Variable **`EAS_PROJECT_ID`**: your EAS project UUID from `eas init`
3. Run builds, submissions, or OTA updates anytime from **Actions → Mobile Release (EAS)**!

---

## 3. Pre-Release Verification

Before cutting a store binary, run the full local check suite:

```bash
npm run verify:guardrails   # TypeScript, ESLint perf rules, icons, balance eras, store readiness, perf tests
npm run test:fast           # Unit & integration test suite
npx expo-doctor             # Verify Expo SDK 54 native compatibility (17/17 checks)
```

To regenerate crisp icons, Play feature graphic, or store screenshots after UI updates:

```bash
npm run store:assets        # Regenerate assets/icon.png, adaptive/monochrome icons, splash, feature graphic
npm run store:screenshots   # Regenerate Apple (iPhone 6.9", iPad 13") & Google (Phone, 10" Tablet) screenshots
```

---

## 4. Test on Real Devices First (Preview Builds)

```bash
# Android sideloadable APK + iOS internal ad-hoc build (or iOS Simulator build)
npm run mobile:build:preview
# Or specifically iOS Simulator build (no Apple Developer device UDID needed):
npx eas-cli build --platform ios --profile preview-simulator
```

Verify on device:
- [ ] Live synthesized music & weapon SFX play cleanly (and respect iPhone Silent Switch)
- [ ] Backgrounding the app suspends audio immediately and resumes cleanly on return
- [ ] Android hardware Back button navigates cleanly across all 4 modes without abrupt app exit
- [ ] `/dev/*` routes are completely absent from production builds
- [ ] Options → Privacy Policy & Support links open live GitHub Pages URLs
- [ ] Options → Colorblind Mode, Gameplay Analytics opt-out, and Reset Game all work

---

## 5. Build & Submit v1.0.0 to App Store & Google Play

### iOS (TestFlight → App Store)
```bash
# 1. Build signed .ipa (EAS prompts to create Distribution Cert & Provisioning Profile automatically)
npm run mobile:build:ios

# 2. Submit to App Store Connect / TestFlight (EAS guides you through Apple ID / App Store Connect API Key)
npm run mobile:submit:ios
```
Then in **App Store Connect**:
1. Paste copy, keywords, URLs, Privacy Nutrition Label, and review notes from [`docs/store/app-store-connect.md`](./app-store-connect.md).
2. Upload screenshots from `store-assets/screenshots/ios-iphone-6.9/` and `store-assets/screenshots/ios-ipad-13/`.
3. Select the TestFlight build and click **Add for Review**.

### Android (Google Play Internal Testing → Production)
```bash
# 1. Build signed Android App Bundle (.aab)
npm run mobile:build:android

# 2. First upload ONLY: download the .aab from the EAS build URL and upload it once
#    manually in Google Play Console → Testing → Internal testing.
#    For all subsequent releases, create a Google Service Account JSON key (google-service-account.json, gitignored)
#    and run:
npm run mobile:submit:android
```
Then in **Google Play Console**:
1. Paste copy, Data Safety, and IARC answers from [`docs/store/google-play-console.md`](./google-play-console.md).
2. Upload `store-assets/google-play/app-icon-512.png`, `store-assets/google-play/feature-graphic.png`, and screenshots from `store-assets/screenshots/android-phone/` and `store-assets/screenshots/android-tablet-10/`.

---

## 6. Instant Over-The-Air Updates (EAS Update)

For JS-only bug fixes, copy edits, or balance patches that don't change native modules or `version` (`1.0.0`):

```bash
npm run mobile:update:prod -- --message "Balance & bug fix update"
```

When bumping native dependencies or store marketing version (`1.0.0` → `1.1.0`), update `STORE_VERSION` in `app.config.js` and `src/utils/storeUrls.ts` and cut fresh production native binaries (`npm run mobile:build:prod`).
