# Battlefront Mobile — Home Screen

React Native (Expo + Expo Router + NativeWind) rebuild of the Battlefront
Computer Trading storefront, starting with the Home screen. Structured like
a Shopee-style shopping app: sticky header, promo carousel, category chips,
flash deals with a countdown, trust bar, recommended picks, product grid,
brand strip, and a bottom tab bar (Home / Categories / Cart / Account).

## Requirements

- Node.js 18+ (LTS recommended)
- npm (or yarn/pnpm if you prefer — adjust commands accordingly)
- The **Expo Go** app on your phone (iOS App Store / Google Play), *or*
  Xcode (iOS simulator) / Android Studio (Android emulator) if you want to
  run on a simulator instead of a physical device

## 1. Install dependencies

From the project root:

```bash
npm install
```

## 2. Start the dev server

```bash
npx expo start
```

This opens the Expo Dev Tools in your terminal with a QR code.

## 3. Open the app

Pick whichever is easiest:

- **Physical phone (fastest way to see it):** Install **Expo Go** from the
  App Store/Play Store, then scan the QR code shown in the terminal
  (Camera app on iOS, or the Expo Go app's scanner on Android).
- **iOS Simulator (Mac only):** press `i` in the terminal after `expo start`
  (requires Xcode installed).
- **Android Emulator:** press `a` in the terminal after `expo start`
  (requires Android Studio with an emulator configured).
- **Web preview (quick sanity check, not the real target):** press `w`.

## Project structure

```
app/
  _layout.tsx            ← root layout (SafeAreaProvider, status bar)
  (tabs)/
    _layout.tsx           ← bottom tab navigator (Home/Categories/Cart/Account)
    index.tsx             ← Home screen (what we just built)
    categories.tsx         ← placeholder
    cart.tsx                ← placeholder
    account.tsx              ← placeholder
src/
  components/
    layout/Header.tsx      ← logo, search bar, cart badge
    sections/               ← PromoBanners, Categories, FlashDeals, TrustBar,
                               SulitPicks, ProductCard, ProductGrid, NewArrivals, Brands
  hooks/useCountdown.ts     ← flash-deal countdown timer
  lib/
    data.ts                 ← hardcoded sample data
    api.ts                   ← async stub functions — swap these for real
                               fetch calls later without touching any screen
  theme/theme.ts             ← shadow/spacing constants (colors live in
                               tailwind.config.js as NativeWind tokens)
tailwind.config.js            ← Battlefront color tokens (background, primary, etc.)
global.css                     ← NativeWind entry point
```

## Notes on this build

- **Styling:** NativeWind (Tailwind classes) throughout — `bg-background`,
  `text-foreground`, `bg-primary`, `border-border`, etc. All resolve to the
  Battlefront dark palette defined once in `tailwind.config.js`. No hardcoded
  hex values in components.
- **Data:** hardcoded in `src/lib/data.ts`, accessed only through the async
  functions in `src/lib/api.ts` (`getCategories()`, `getFlashDeals()`, etc.).
  When a real backend is ready, only `api.ts` needs to change.
- **Only the Home tab is fully built.** Categories/Cart/Account are minimal
  placeholder screens so the tab bar is navigable — each will get its own
  full build in a later pass, per the skill's one-screen-at-a-time workflow.
- **Product images** use placeholder Unsplash URLs — swap for real product
  photography when available.

## Troubleshooting

- If Metro complains about NativeWind/CSS not resolving, stop the server and
  restart with a clean cache: `npx expo start -c`
- If icons don't render, confirm `@expo/vector-icons` installed correctly
  (`npm ls @expo/vector-icons`).
