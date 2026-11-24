# Apple App Store Connect Metadata — NShapes

Ready-to-paste metadata, privacy declarations, and review notes for submitting **NShapes** (`com.nshapes.app`) to the Apple App Store.

---

## 1. App Information

| Field | Value |
|---|---|
| **Name** | `NShapes` |
| **Subtitle** *(max 30 chars)* | `Pattern-Matching Roguelike` *(26 chars)* |
| **Bundle ID** | `com.nshapes.app` |
| **SKU** | `com.nshapes.app` |
| **Primary Language** | English (U.S.) |
| **Primary Category** | Games — **Puzzle** |
| **Secondary Category** | Games — **Card** |
| **Made for Kids** | **No** (General Audience) |
| **Pricing** | **Free** (No In-App Purchases, No Ads) |
| **Copyright** | `2026 Nathan Waters` |

---

## 2. Store Listing Copy

### Promotional Text *(max 170 chars — editable without a new binary)*
```text
Four ways to master pattern-matching trios: a 5-world Adventure campaign, Starfall Summit roguelike climb, turn-based Prism Deck combos, and untimed Free Play!
```
*(160 characters)*

### Description
```text
Spot trios. Bend the rules. Build wild combos.

NShapes is a fast, tactile pattern-matching roguelike inspired by classic trio-matching card puzzles — supercharged with fighters, relic weapons, evolutions, Arcana, and deep deckbuilding combos. Play 100% offline with zero ads, zero paywalls, and zero accounts.

FOUR COMPLETE MODES
• Adventure Mode — Journey across 5 handcrafted worlds, rescue caged friends, battle quirky foes, earn stars, unlock fighters and relic weapons, and discover powerful weapon evolutions at Camp.
• Starfall Summit — Scale a 3-act roguelike mountain climb with branching routes, campfires, events, relic shops, ascension tiers, and Endless play.
• Prism Deck — A turn-based combo-scoring roguelike with starter decks, Charms, Spells, Star Charts, Vouchers, seeded runs, and a fresh Daily Challenge every day.
• Free Play & Interactive Tutorial — Learn the pattern-matching rules in minutes or practice at your own pace with no timer.

BUILT FOR FOCUS & FEEL
• Live adaptive soundtrack and crisp synthesized sound effects tailored to every weapon and combo.
• Colorblind-friendly by default (high-contrast Tangerine Orange, Electric Blue & Berry Pink cards with Circle, Triangle & Bolt shapes) plus optional O / B / P corner labels in Options.
• Works completely offline on iPhone and iPad with instant local saves.
```

### Keywords *(max 100 chars — comma-separated, no spaces)*
```text
puzzle,roguelike,deckbuilder,card,pattern,match,trio,combo,offline,brain,logic,indie,shapes,strategy
```
*(100 characters — zero third-party trademarks)*

### URLs
- **Support URL:** `https://nathanbwaters.github.io/nshapes/support.html`
- **Marketing URL:** `https://nathanbwaters.github.io/nshapes/`
- **Privacy Policy URL:** `https://nathanbwaters.github.io/nshapes/privacy.html`

### What's New in Version 1.0.0
```text
Welcome to NShapes v1.0!
• Full 5-World Adventure Campaign with Fighters, Weapons, Evolutions, Arcana, and Camp
• Starfall Summit 3-Act Roguelike Climb & Endless Mode
• Prism Deck Turn-Based Combo Roguelike with Daily Challenges
• Live synthesized adaptive music & weapon sound effects
• High-contrast Colorblind Mode and 100% offline play
```

---

## 3. Screenshots & Device Assets

Generated reproducibly via `npm run store:screenshots` (output in `store-assets/screenshots/`):
- **iPhone 6.9" Display** (`1320 × 2868`): `store-assets/screenshots/ios-iphone-6.9/*.png`
- **iPad Pro 13" Display** (`2064 × 2752`): `store-assets/screenshots/ios-ipad-13/*.png`
- **App Icon**: `assets/icon.png` (`1024 × 1024`, opaque RGB PNG, no alpha channel — automatically bundled into `.ipa`)

---

## 4. App Privacy (Privacy Nutrition Label)

Matches `ios.privacyManifests` in `app.config.js` (`PrivacyInfo.xcprivacy`):

- **Do you or your third-party partners collect data from this app?** → **Yes**
- **Data Types Collected:**
  - **Usage Data → Product Interaction**
    - Used for: **Analytics** (game balance & difficulty telemetry via PostHog)
    - Linked to the user's identity? → **No**
    - Used for tracking across apps/websites? → **No**
- **Tracking / ATT:** No IDFA, no ad networks, no cross-app tracking → **App Tracking Transparency (ATT) prompt is NOT required**.
- **In-app control:** Players can disable telemetry anytime via **Options → Gameplay Analytics → OFF**.

---

## 5. Age Rating Questionnaire

| Category | Answer |
|---|---|
| Cartoon or Fantasy Violence | **Infrequent/Mild** *(whimsical cartoon animal fighters & foes)* |
| Realistic Violence | None |
| Profanity or Crude Humor | None |
| Horror/Fear Themes | None |
| Sexual Content / Nudity | None |
| Alcohol, Tobacco, or Drug Use | None |
| Simulated Gambling | None *(no real money, no casino/slot betting)* |
| Unrestricted Web Access | No |
| Contests / Loot Boxes | No |
| Made for Kids | **No** |

*(Expected rating: **9+** or **4+** depending on Apple's mild cartoon violence threshold.)*

---

## 6. Export Compliance

- `ITSAppUsesNonExemptEncryption` is set to `false` in `app.config.js` (`Info.plist`).
- NShapes uses only standard OS HTTPS (TLS) for anonymous analytics and OTA updates (exempt encryption).

---

## 7. App Review Information & Notes

- **Sign-In Required:** **No** (uncheck "Sign-in required" — zero accounts/login).
- **Contact Info:** Enter your App Store Connect contact phone & email in the App Store Connect form.
- **Notes for Reviewer:**
```text
NShapes is a 100% free, offline-first pattern-matching roguelike puzzle game with no accounts, no ads, and no in-app purchases.

Quick test path:
1. Tap "Play" to enter Adventure Mode (World 1-1 introduces the 3-card pattern-matching rules interactively).
2. Tap "Starfall Summit" or "Prism Deck" from the main menu to explore the roguelike climb and turn-based combo modes.
3. Tap "Options" to verify Music, Sound Effects, Colorblind Mode, Gameplay Analytics opt-out, Privacy Policy, Support, and Reset Game.

Note on audio: Sound and music are synthesized live on-device and respect the iPhone Silent/Ring switch (AVAudioSession ambient category).
```
