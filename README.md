# 🎬 Movie Memory

A full-stack web application that lets users save their favorite movie and discover AI-generated fun facts about it.

**Variant chosen: A — Backend-Focused (Caching & Correctness)**

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Variables](#environment-variables)
3. [Database Setup & Migrations](#database-setup--migrations)
4. [Architecture Overview](#architecture-overview)
5. [Variant A — Design Decisions](#variant-a--design-decisions)
6. [Key Tradeoffs](#key-tradeoffs)
7. [What I Would Improve with 2 More Hours](#what-i-would-improve-with-2-more-hours)
8. [AI Usage](#ai-usage)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in your values
cp .env.example .env
# → Edit .env with your credentials (see section below)

# 3. Generate Prisma client
npx prisma generate

# 4. Run database migrations
npx prisma migrate dev

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Create a `.env` file at the project root (use `.env.example` as a template):

| Variable              | Description                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Postgres connection string, e.g. `postgresql://user:pass@localhost:5432/movie_memory`          |
| `NEXTAUTH_URL`        | Your app's URL. Use `http://localhost:3000` for development.                                   |
| `NEXTAUTH_SECRET`     | A random secret. Generate with: `openssl rand -base64 32`                                     |
| `GOOGLE_CLIENT_ID`    | OAuth 2.0 Client ID from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET`| Corresponding Client Secret                                                                   |
| `OPENAI_API_KEY`      | API key from [OpenAI](https://platform.openai.com/api-keys)                                   |

### Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create a new OAuth 2.0 Client ID (Web application).
3. Add `http://localhost:3000/api/auth/callback/google` as an Authorized Redirect URI.
4. Copy the Client ID and Client Secret into your `.env`.

---

## Database Setup & Migrations

This project uses **Postgres** via **Prisma ORM** (v7).

```bash
# Ensure Postgres is running locally, then:

# Generate the Prisma client
npx prisma generate

# Run all migrations
npx prisma migrate dev

# (Optional) Open Prisma Studio to inspect data
npx prisma studio
```

### Schema Overview

| Model               | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `User`               | Stores Google profile + favorite movie + onboarding timestamp  |
| `Account` / `Session`| NextAuth.js auth infrastructure                               |
| `Fact`               | AI-generated fun facts, keyed by `userId` + `movie` + `createdAt` |

Key design decisions:
- `favoriteMovie` lives on `User` (not a separate table) because the spec calls for exactly one movie per user.
- `onboardedAt` is a nullable timestamp — `null` means the user hasn't completed onboarding yet. This is cheaper and simpler than a separate boolean flag.
- `Fact` uses a composite index on `(userId, movie, createdAt DESC)` to make the 60-second cache lookup a fast index scan.

---

## Architecture Overview

```
src/
├── app/
│   ├── page.tsx                  # Landing page (SSR, auth redirect)
│   ├── onboarding/page.tsx       # Onboarding page (SSR, auth guard)
│   ├── dashboard/page.tsx        # Dashboard page (SSR, auth guard)
│   └── api/
│       ├── auth/[...nextauth]/   # NextAuth API route
│       ├── onboarding/route.ts   # POST — save favorite movie
│       ├── change-movie/route.ts # POST — update favorite movie
│       └── fact/route.ts         # GET — generate/retrieve fun fact
├── components/
│   ├── providers.tsx             # SessionProvider wrapper
│   ├── sign-in-button.tsx        # Google Sign-In (client component)
│   ├── sign-out-button.tsx       # Sign Out (client component)
│   ├── onboarding-form.tsx       # Movie input form (client component)
│   ├── user-profile.tsx          # Profile card with inline movie edit
│   ├── dashboard-content.tsx     # Client wrapper coordinating profile + fact
│   └── fun-fact.tsx              # Fun fact display + refresh (client)
├── lib/
│   ├── auth.ts                   # NextAuth v5 configuration
│   ├── prisma.ts                 # Prisma singleton (pg adapter)
│   ├── openai.ts                 # OpenAI client singleton
│   ├── validation.ts             # Server-side input validation
│   └── fact-generator.ts         # ⭐ Core fact logic (Variant A)
├── types/
│   └── next-auth.d.ts            # Session type augmentation
└── __tests__/
    └── fact-generator.test.ts    # Variant A backend tests (8 tests)
```

### Request Flow

1. **Unauthenticated user** hits `/` → sees landing page with Google Sign-In.
2. **After Google OAuth** → NextAuth creates User + Account in Postgres.
3. **Landing page** checks `onboardedAt`:
   - `null` → redirect to `/onboarding`
   - set → redirect to `/dashboard`
4. **Onboarding** → user types their favorite movie → `POST /api/onboarding` validates and saves.
5. **Dashboard** → SSR loads user profile from DB, client-side `FunFact` component calls `GET /api/fact`.
6. **Fact generation** → `fact-generator.ts` handles caching, deduplication, and failure fallback (see Variant A below).

---

## Variant A — Design Decisions

I chose **Variant A (Backend-Focused)** because the caching and correctness challenges are where real-world production bugs tend to hide. Getting cache invalidation, concurrency, and failure handling right is more impactful than building more UI surface area.

### 1. 60-Second Cache Window

The `generateFunFact()` function queries Prisma for the most recent fact where:
```sql
userId = ? AND movie = ? AND createdAt >= (NOW() - 60 seconds)
```

If found, it returns the cached fact immediately (no OpenAI call). The composite index `(userId, movie, createdAt DESC)` ensures this is an efficient index scan.

### 2. Burst / Idempotency Protection

I use an **in-memory lock map** (`Map<string, Promise<FactResult>>`). When a generation request arrives:

1. Check if a Promise already exists for `userId:movie`.
2. If yes → **await the existing Promise** (dedup).
3. If no → create a new Promise, store it in the map, and proceed.
4. After the Promise resolves/rejects → clean up the map entry.

This means if a user refreshes 5 times in rapid succession, only **one** OpenAI call is made. All 5 requests share the same Promise and receive the same result.

**Documented limitation:** This only works within a single Node.js process. In a horizontally-scaled deployment, you'd need a distributed lock (e.g., Redis `SETNX` or Postgres advisory locks).

### 3. Failure Handling

If OpenAI times out or returns an error:
1. Query for the **most recent fact** (regardless of age) for this user + movie.
2. If one exists → return it as a fallback (with `cached: true`).
3. If none exists → throw a user-friendly error message.

### 4. Backend Tests (8 passing)

Tests cover all Variant A requirements using mocked Prisma and OpenAI:

| Test                                            | What it verifies                                   |
| ----------------------------------------------- | -------------------------------------------------- |
| Returns cached fact within 60s                  | Cache hit path                                     |
| Generates new fact when cache expired           | Cache miss path + OpenAI call + DB write           |
| Passes correct date threshold                   | 60-second window calculation accuracy              |
| Queries only requesting user's facts            | Authorization scoping                              |
| Does not return another user's facts            | User isolation                                     |
| Returns fallback on OpenAI failure              | Graceful degradation                               |
| Throws user-friendly error on total failure     | No cached fact + OpenAI down                       |
| Deduplicates concurrent requests                | Burst protection / in-memory lock                  |

---

## Change Movie

Users can change their favorite movie directly from the dashboard without going through onboarding again.

### How it works

1. Click the **pencil icon** (✏️) next to the displayed favorite movie.
2. An inline input field appears — type a new movie name.
3. Press **Enter** or click **Save** to confirm, or **Escape** / **Cancel** to discard.
4. On save, a `POST /api/change-movie` request validates the input (same rules as onboarding) and updates the user's `favoriteMovie` in the database.
5. The Fun Fact component automatically remounts and fetches a **fresh AI-generated fact** for the new movie.

### Technical details

- The `DashboardContent` client wrapper coordinates `UserProfile` and `FunFact`. When the movie changes, it increments a React key on `FunFact`, forcing a remount and fresh fetch.
- The "New Fact" button passes `?fresh=true` to skip the 60-second cache, ensuring the user always gets a new fact on explicit request.
- The change-movie API reuses the same `validateMovie()` logic (2–200 chars, trimmed, whitespace-normalized).

---

## Security & Correctness

- **Server-side validation**: Movie input is trimmed, length-checked (2–200 chars), and whitespace-normalized in `validation.ts`.
- **User isolation**: Every Prisma query is scoped to `session.user.id`. The fact generator only fetches facts belonging to the authenticated user.
- **No secrets on client**: All API keys (`OPENAI_API_KEY`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`) are only used in server-side code (API routes and `lib/` files). None are prefixed with `NEXT_PUBLIC_`.
- **Missing Google data**: The dashboard handles `null` name (shows "Movie Lover"), `null` email (hidden), and `null` image (shows initial avatar).
- **Auth guards**: The landing page (`/`) performs server-side redirects. `/onboarding` and `/dashboard` both verify the session and redirect accordingly. NextAuth middleware adds an extra layer of protection.

---

## Key Tradeoffs

| Decision                          | Tradeoff                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| **In-memory lock** over DB lock   | Simpler, zero-latency, but only works single-process. Documented limitation.                  |
| **favoriteMovie on User**         | Simpler schema. If we needed movie history, a separate Movie table would be better.           |
| **`gpt-3.5-turbo`** over GPT-4   | Much faster and cheaper. Sufficient for fun facts. Easy to swap.                              |
| **Database sessions** over JWT    | More secure (revocable), but requires DB hit per request. Worth it for a user-facing app.     |
| **No client-side caching**        | Since Variant A focuses on backend caching, client fetches fresh on each navigation. Keeps the FunFact component simple. |
| **Server Components for pages**   | Pages are SSR (auth check + data fetch). Interactive parts (forms, buttons) are client components. Minimizes JS shipped to browser. |

---

## What I Would Improve with 2 More Hours

1. **Distributed locking**: Replace the in-memory lock with Redis `SETNX` or Postgres advisory locks for multi-instance deployments.
2. **Rate limiting**: Add per-user rate limiting on the fact endpoint to prevent API abuse.
3. **Streaming facts**: Use OpenAI's streaming API to show the fun fact as it generates, improving perceived performance.
4. **E2E tests**: Add Playwright tests for the full auth → onboarding → dashboard flow.
5. **Loading skeletons**: Replace the spinner with shimmer/skeleton UI for a more polished feel.
6. **Error boundary**: Add a React error boundary around the dashboard to catch rendering errors gracefully.

---

## AI Usage

- Used GitHub Copilot for boilerplate code generation (component structure, Prisma queries, Jest test scaffolding).
- Used AI to verify Prisma v7 API changes (adapter pattern, config file format) since documentation was sparse.
- All architecture decisions, caching strategy, and test cases were designed manually — AI assisted with implementation speed, not design.
- AI helped generate and validate multiple positive and negative test cases .
- Helped create READEME instructions.
- Encountered a critical Oauth sign in error which I was not able to figure out , AI helped me tackle it .
