@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TechLex: IT terminology flashcard app. Expo SDK 57, React Native, TypeScript strict, Supabase. Targets iOS, Android and web. The project root is `pratik-kelime/` (the parent `TechLex/` folder is only a wrapper); run all commands from here.

## Commands

- `npx expo start` (dev client), `npm run ios`, `npm run android`, `npm run web`, `npm run build:web`
- Verify with `npx tsc --noEmit`. There is currently no lint and no test suite.
- Env: copy `.env.example` to `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- Pushing to `main` triggers the GitHub Pages web deploy (`.github/workflows/deploy.yml`), so web must keep building.

## Architecture

- **Navigation:** Expo Router. The guard in `app/_layout.tsx` routes `onboarding` → `(auth)/login` → `(tabs)`; no guest mode. `(auth)`, `term/[id]`, `paywall` are modals.
- **State:** one Zustand store, `lib/store.ts`, persisted to AsyncStorage (`@pratik_kelime_data`). Business rules (energy, XP, streak, badges, quiz) live in the store, not in screens.
- **Terms:** static JSON in `data/terms/`, content only in `tr` and `en`.
- **Leitner:** `lib/spaced-repetition.ts`, 5 boxes (0/1/3/7/14 days). Known → next box; unknown → back to box 1.
- **Swipe sync:** swipes are queued locally and sent in batches of 10 via the `process_swipe_events` RPC, plus flushed on app background/foreground. The server recomputes progress/XP/streak/energy and dedupes event IDs, so every event needs a unique ID. On login, `checkSyncConflict` must run before any sync. Energy and streak use server time (`getServerNow`), not the device clock.
- **i18n:** `lib/i18n/locales/` has 10 languages. Add every new user-facing string to all of them, and keep Arabic (`ar`) RTL layouts working.

## Supabase (sensitive)

- Schema, RLS, RPCs and the auth flow are the security boundary. Clients never write profile/progress tables directly; all writes go through RPCs, and subscription tier is server-managed.
- Do not change files in `supabase/` or the auth flow unless asked. `supabase/README.md` is the authoritative migration guide; canonical progress columns are `box` and `next_review`.
- A client change that depends on a new RPC must ship after its migration is deployed.

## Native and UI

- `ios/` and `android/` are generated and gitignored; never edit them directly. Put native config in `app.json` / Expo config plugins.
- Add Expo/RN dependencies with `npx expo install` so versions match SDK 57.
- For UI changes, check iOS and Android separately: safe area insets, notch/Dynamic Island, keyboard avoidance, tab bar height. Web must not break.
- Use theme tokens from `constants/theme.ts` instead of hardcoded colors.
