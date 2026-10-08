# Battlefront Mobile

React Native customer app built with Expo, Expo Router, and NativeWind. Laravel
is the source of truth for customer accounts, catalog, cart, checkout, orders,
branches, chatbot, and product recommendations. The app consumes Laravel's
`/api/v1` JSON API.

## Requirements

- Node.js 18 or newer and npm
- Expo Go, or an iOS/Android development environment
- A reachable Battlefront Laravel backend

## Setup

Install dependencies from the project root:

```bash
npm install
```

Set `EXPO_PUBLIC_API_URL` in a local `.env` file to the Laravel API root,
including `/api/v1`:

```dotenv
EXPO_PUBLIC_API_URL=http://<backend-computer-address>:8000/api/v1
```

When using a phone, use the backend computer's reachable LAN address. Do not
use `localhost` or a computer-only `.test` hostname. The backend must accept
connections from the phone on the same network. The setup and device validation
steps are documented in `docs/MOBILE_API_HANDOFF.md` and
`docs/MOBILE_INTEGRATION_VALIDATION.md` in the `battlefront-capstone` project.
Keep `.env` local and do not ship a development server address in a production
build.

Start Expo:

```bash
npx expo start
```

Scan the QR code with Expo Go, or use the Expo terminal shortcuts to launch an
available simulator. Press `w` for a web preview; native-device validation is
still required for mobile integration.

## App structure

```text
app/
  (tabs)/              Home, catalog, cart, account
  checkout.tsx         Checkout and order placement
  orders.tsx           Order history
  orders/[id].tsx      Order details and payment-proof resubmission
  product/[id].tsx     Product details
  recommendations.tsx  Behavior-based recommendation feed
src/
  hooks/               Session, cart, wishlist, and screen state
  lib/backend.ts       Laravel API requests and response mapping
  lib/accountApi.ts    Registration, login, and profile requests
  lib/orders.ts        Order and payment-proof API requests
  components/          Shared UI and feature components
  theme/               App theme
```

## Backend and local-only features

- Product, category, branch, account, recommendation, cart, checkout, order,
  and chatbot data come from the backend. Backend prices and cart totals are
  authoritative.
- Signed-in catalog searches and product detail requests provide the backend
  with recommendation activity when the customer's profile preferences allow
  it. Account settings expose those recommendation privacy preferences.
- The mobile API is customer-facing. Inventory administration, payment
  verification, reports, forecasting, and chatbot knowledge management remain
  in the web application.
- Wishlist items, extra saved addresses, recently viewed display, and
  notification read state are stored locally. The backend does not provide
  mobile endpoints for syncing those features or for push notifications.

## Troubleshooting

- If the app cannot reach Laravel, first check the configured URL from the
  device. It must include `/api/v1`, and the phone must be able to reach the
  backend computer over the network.
- If Metro has stale NativeWind output, restart with `npx expo start -c`.
- If icons do not render, check `npm ls @expo/vector-icons`.

## Philippine address data

Address selectors use Philippine Standard Geographic Code data distributed by
`@aivangogh/ph-address`. Refer to that package's license and source for its
data provenance.
