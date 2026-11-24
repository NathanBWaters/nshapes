# Google Play Console Metadata — NShapes

Ready-to-paste metadata, graphics manifest, Data Safety answers, and IARC rating guide for publishing **NShapes** (`com.nshapes.app`) on Google Play.

---

## 1. App Details

| Field | Value |
|---|---|
| **App Name** *(max 30 chars)* | `NShapes` |
| **Package Name** | `com.nshapes.app` |
| **Default Language** | English (United States) — `en-US` |
| **App or Game** | **Game** |
| **Category** | **Puzzle** |
| **Tags** | `Puzzle`, `Card`, `Roguelike`, `Offline`, `Single player` |
| **Free or Paid** | **Free** |
| **Contains Ads** | **No** |
| **In-App Purchases** | **No** |

---

## 2. Store Listing Copy

### Short Description *(max 80 chars)*
```text
Match trios, unlock wild relic combos, and conquer 4 offline roguelike modes!
```
*(77 characters)*

### Full Description *(max 4,000 chars)*
```text
Spot trios. Bend the rules. Build wild combos.

NShapes is a tactile, offline-first pattern-matching roguelike inspired by classic trio-matching card puzzles — packed with animal fighters, relic weapons, evolutions, Arcana, and deep combo deckbuilding. 100% free with zero ads, zero paywalls, and zero account required.

FOUR COMPLETE MODES
• Adventure Mode: Battle across 5 handcrafted worlds, rescue caged friends, earn stars, unlock fighters and relic weapons, and discover weapon evolutions at Camp.
• Starfall Summit: Conquer a 3-act roguelike mountain climb featuring branching maps, campfires, events, relic shops, ascension tiers, and Endless runs.
• Prism Deck: A turn-based combo roguelike with unlockable starter decks, Charms, Spells, Star Charts, Vouchers, custom seeds, and a Daily Challenge.
• Free Play & Interactive Tutorial: Learn the trio-matching rules quickly or unwind with untimed practice boards.

DESIGNED FOR CLARITY & GAME FEEL
• Live adaptive synthesized music and crisp procedural sound effects that react to every combo.
• Colorblind Mode in Options switches cards to a high-contrast Okabe-Ito palette with R / B / P corner badges.
• Runs 100% offline with instant local device saves and full Android back-button support.
```

### Contact & Legal URLs
- **Privacy Policy URL:** `https://nathanbwaters.github.io/nshapes/privacy.html`
- **Website / Support URL:** `https://nathanbwaters.github.io/nshapes/support.html`
- **Developer Email:** Enter your Google Play Console developer email in the Play Console Store Settings form.

---

## 3. Store Graphics Checklist

All assets are pre-generated in the repository (reproducible via `npm run store:assets` & `npm run store:screenshots`):

| Asset | Required Size | Repo Path |
|---|---|---|
| **App Icon** | `512 × 512` PNG (opaque) | `store-assets/google-play/app-icon-512.png` |
| **Feature Graphic** | `1024 × 500` PNG (opaque) | `store-assets/google-play/feature-graphic.png` |
| **Phone Screenshots** | `1080 × 1920` (9:16 portrait, min 2) | `store-assets/screenshots/android-phone/*.png` |
| **10-inch Tablet Screenshots** | `1600 × 2560` (portrait, min 2) | `store-assets/screenshots/android-tablet-10/*.png` |

---

## 4. Data Safety Form Answers

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** *(HTTPS to `us.i.posthog.com`)* |
| Do you provide a way for users to request that their data is deleted? | **No account created** *(anonymous install ID only; local data resettable via Options → Reset Game and telemetry opt-out via Options → Gameplay Analytics)* |
| **Data Type 1: App activity → App interactions** | **Collected** (not shared) · Optional (opt-out in Options) · Purpose: **Analytics** |
| **Data Type 2: Device or other IDs** | **Collected** (not shared) · Optional (opt-out in Options) · Purpose: **Analytics** *(random anonymous install UUID; never ADID/GAID)* |
| Advertising ID (`AD_ID`) permission used? | **No** |

---

## 5. Content Rating (IARC) & Target Audience

- **Target Age Group:** **13–15, 16–17, 18 and over** *(General Audience — do NOT check under-13 / Families Policy, as NShapes includes anonymous gameplay analytics and a Discord community link)*.
- **Appeal to Children:** Select **No** (game uses strategic roguelike deckbuilding mechanics designed for teen/adult puzzle fans).
- **IARC Questionnaire:**
  - Violence: **Mild / Fantasy cartoon violence** (abstract damage numbers & whimsical animal mascots; no blood, gore, or realistic harm).
  - Sexual content / Language / Drugs / Gambling / User-generated content / Location sharing / Digital purchases: **No** for all.

---

## 6. Permissions Audit

Verified via `npx expo prebuild --clean`:
- `android.permission.INTERNET` — anonymous gameplay analytics & EAS OTA updates.
- `android.permission.VIBRATE` — tactile haptic feedback (`expo-haptics`).
- All unnecessary permissions (`RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE`) are explicitly blocked/excluded.

---

## 7. Play Console Release Track Note (Personal Developer Accounts)

- EAS Submit (`eas.json`) uploads `.aab` builds to the **`internal`** track as a **`draft`** release by default (`npm run mobile:submit:android`).
- **First upload caveat:** Google Play requires uploading the very first `.aab` manually once in the Play Console UI to initialize the app package (`com.nshapes.app`); every subsequent release can be submitted automatically via `eas submit`.
- For personal Play Developer accounts created after Nov 2023, promote from **Internal Testing** → **Closed Testing** (12 opted-in testers for 14 continuous days) before requesting Production access.
