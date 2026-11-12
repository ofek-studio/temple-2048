# Temple 2048

A 2048 puzzle game with a Zuma-style look: glossy coloured orbs, a carved stone board with golden
Aztec trim, a jungle background and a stone frog idol that reacts to merges.

Built with **Phaser 3 + TypeScript + Vite**, packaged for iOS and Android with **Capacitor 7**.
All art is generated procedurally at boot (Canvas 2D), so there are no image assets to ship.

## Run in the browser

```bash
npm install
npm run dev
```

Open http://localhost:5180. Swipe (or use arrow keys / WASD) to move the orbs.

## Project layout

- `src/game/Engine.ts` – pure 2048 rules for any board size (move, merge, spawn, limited undo,
  hammer, shuffle, zen relief, seeded RNG). No rendering.
- `src/game/Modes.ts` – the game modes: Classic, Time Attack (2 min), Zen (no game over),
  Mini 3x3, Grand 5x5 and the Daily Trial (seeded board + three goals per calendar day).
- `src/game/Daily.ts` – day seed, goal generation and goal evaluation for the Daily Trial.
- `src/game/Progress.ts` – localStorage: per-mode saves and bests, lifetime stats, day streak,
  daily results, gem gallery unlocks, tutorial flag.
- `src/game/Textures.ts` – procedural art (orbs, 3/4/5 boards, background, frog, plaques, icons).
- `src/game/Audio.ts` – WebAudio synth for effects plus a generative ambient music loop and the
  "board almost full" heartbeat.
- `src/game/Share.ts` – share sheet (Capacitor Share on devices, Web Share / clipboard on the web).
- `src/game/Native.ts` – Capacitor haptics wrapper (no-op in the browser).
- `src/scenes/` – Boot (builds textures), Menu, Game, Modes, Daily (calendar + goals),
  Temple (gem gallery, stats, share).

## Gameplay features

- Boosters per game: 3 undos, 1 hammer (tap a gem to smash it), 1 shuffle. Zen has more.
- Daily Trial: everyone gets the same seeded board; goals are "forge gem X", "score Y" and
  either "combo xN in one swipe" or "forge X without boosters". Stars are kept per day in a
  calendar; the day streak counts any mode played on consecutive days.
- Gem gallery unlocks every value forged for the first time (with the date), and the
  Chronicles panel keeps lifetime stats. Both can be shared as text.
- First launch shows a short animated tutorial; the board pulses red with a heartbeat when
  only one cell is free.
- `capacitor.config.ts` – app id `com.ofekstudio.temple2048`, app name `Temple 2048`.

## Building the native apps

```bash
npm run cap:sync        # vite build + copy dist/ into android/ and ios/
npm run cap:android     # opens the project in Android Studio
npm run cap:ios         # opens the project in Xcode (macOS only)
```

### Android (Windows is fine)

1. Install Android Studio (bundles the JDK and SDK). First launch installs the SDK.
2. `npm run cap:android`, let Gradle sync, then Run on an emulator or a USB device.
3. For the Play Store: **Build > Generate Signed Bundle (AAB)**. Keep the keystore safe,
   it is needed for every future update.

### iOS (needs a Mac with Xcode, or a cloud Mac such as Codemagic / MacStadium)

1. On the Mac: `npm install`, `npm run cap:sync`, `npx cap open ios`, then `pod install` runs automatically.
2. In Xcode set the Team (Apple Developer account, 99 USD/year) and the bundle id.
3. Product > Archive, then Distribute to App Store Connect / TestFlight.

### Icons and splash screens

Put `assets/icon.png` (1024x1024) and `assets/splash.png` (2732x2732) in the repo and run:

```bash
npx @capacitor/assets generate --iconBackgroundColor '#06331f' --splashBackgroundColor '#06331f'
```

It writes every required size into `android/` and `ios/`.

## Rate-us banner

After 3 minutes of cumulative play a stone banner asks for a rating and opens the store page
(`src/game/Rating.ts`, thresholds in `src/game/Config.ts`). Set `APPLE_APP_ID` once the app exists in
App Store Connect; until then the banner is skipped on iOS.

Step-by-step store upload instructions (Hebrew): `STORE_GUIDE.md`.

## Store checklist

- [ ] Google Play developer account (25 USD once) and Apple Developer account (99 USD/year)
- [ ] Final app name and bundle id (change `appId` in `capacitor.config.ts` before the first upload,
      it cannot change afterwards)
- [ ] Privacy policy URL (required by both stores even with no data collection)
- [ ] Screenshots: phone 9:16 (both stores), 6.7" and 6.5" iPhone, optional tablet
- [ ] Feature graphic 1024x500 (Google Play)
- [ ] Content rating questionnaire (Play) and age rating (App Store)
- [ ] Data safety / App Privacy forms: the game stores scores on-device only, no network calls
- [ ] Optional later: AdMob or in-app purchase (remove ads), Game Center / Play Games leaderboards
