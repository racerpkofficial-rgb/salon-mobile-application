# Book My Salon

Android-first salon discovery and appointment booking. This repository currently contains **Phase 1**: the Expo mobile foundation and Express API foundation.

## Run locally

1. Copy `apps/api/.env.example` to `apps/api/.env` and set the values.
2. Install dependencies: `npm install`.
3. Start the API: `npm run api`.
4. Start the Android app: `npm run mobile`, then select Android from Expo.

## Phase plan

- Phase 1 (current): app shell, role access boundaries, customer discovery interface, API authentication and salon catalogue contracts.
- Phase 2: services, availability calculation, booking requests and status history.
- Phase 3: owner onboarding, subscriptions, salon approval and owner operations.
- Phase 4: admin console endpoints, FCM notifications, Cloudinary uploads, offers and production hardening.
