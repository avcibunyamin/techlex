# TechLex

IT terminology learning platform built with React Native + Expo.

## Features

- **Swipe-based learning** — Tinder-style flashcards with Leitner spaced repetition (5 boxes)
- **500 IT terms** — AI & ML, Cybersecurity, Design & UX, Networking, Software Development
- **Multi-category selection** — Pick categories, shuffle, and learn
- **Energy system** — Freemium model with 30 max energy, 5-minute refill
- **Level system** — Level up every 100 swipes
- **Bilingual** — Full Turkish + English support (i18n)
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

Run the SQL migrations in order on your Supabase project:

1. `supabase/schema.sql`
2. `supabase/migration_profiles.sql`
3. `supabase/migration_002_premium.sql`
4. `supabase/migration_003_leitner_level.sql`
5. `supabase/migration_004_subscription_cancel.sql`

## License

All rights reserved.
