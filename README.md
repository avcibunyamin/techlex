# TechLex

IT terminology learning platform built with React Native + Expo.

## Features

- **Swipe-based learning** — Tinder-style flashcards with Leitner spaced repetition (5 boxes)
- **500 IT terms** — Cybersecurity, Software Development, AI/ML, Networking, and UX
- **Multi-category selection** — Pick categories, shuffle, and learn
- **Energy system** — Freemium model with 30 max energy, 5-minute refill
- **Level system** — Level up every 100 swipes
- **10-language UI** — Term content is currently Turkish and English
- **Premium subscriptions** — Individual, Duo, Family plans with cancel-at-period-end
- **Cloud sync** — Supabase backend with RLS
- **Dark/Light theme** — System-aware with manual override

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 57 |
| Navigation | Expo Router (file-based) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| State | Zustand + AsyncStorage |
| Animations | react-native-reanimated + gesture-handler |
| i18n | react-i18next |
| Icons | lucide-react-native |

## Getting Started

```bash
# Install dependencies
npm install

# Copy env file and add your Supabase credentials
cp .env.example .env

# Start development server
npx expo start
```

## Project Structure

```
app/                  # Expo Router screens
  (auth)/             # Login / signup
  (tabs)/             # Main tab navigation
  term/[id].tsx       # Term detail
  paywall.tsx         # Subscription plans
components/           # Reusable components
  CardDeck.tsx        # Swipe card stack
  SwipeCard.tsx       # Individual flashcard
lib/                  # Business logic
  store.ts            # Zustand state management
  spaced-repetition.ts
  sync.ts             # Supabase cloud sync
  i18n/               # Translations (tr, en)
data/                 # Term data (JSON)
supabase/             # SQL migrations
constants/            # Design tokens
types/                # TypeScript interfaces
```

## Database Setup

The authoritative migration instructions live in
[`supabase/README.md`](./supabase/README.md). For a fresh project, run:

1. `supabase/000_full_schema.sql`
2. `supabase/migration_006_gamification.sql`
3. `supabase/migration_007_server_time.sql`
4. `supabase/migration_009_secure_sync.sql`

For an existing project, run `supabase/preflight_009.sql` first. Deploy the
migration before releasing the client that uses the secure sync RPCs.

## License

Private project. All rights reserved.
