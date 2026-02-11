# Evo Coach Project Architecture (Beginner Guide)

This document explains how the app is built today, why it was designed this way, and what to improve next.

## 1. What this project is

Evo Coach is a web app that helps runners:
- create an account and sign in
- connect Garmin
- sync activities and health data
- view a dashboard
- generate AI workouts and upload them to Garmin

The app is being migrated from an older Flask prototype to a TypeScript + Next.js architecture.

## 2. Tech stack (and what each part does)

- `Next.js (App Router)`: full-stack framework for pages + server routes.
- `React`: UI components.
- `TypeScript`: safer code with type checks.
- `Prisma`: typed database access layer (ORM).
- `PostgreSQL`: main database (running in Docker locally).
- `NextAuth (credentials + JWT)`: authentication and session handling.
- `garmin-connect`: Garmin integration client.
- `OpenRouter/Anthropic SDKs`: AI providers for workout generation.
- `Tailwind + shadcn-style components`: UI styling and reusable primitives.

## 3. High-level architecture

Think of the project in 5 layers:

1. UI pages and components
- Files under `src/app/*` and `src/components/*`
- Show data and capture user actions

2. API routes
- Files under `src/app/api/*`
- Validate requests, check auth, call services, return JSON

3. Business logic services
- Files under `src/server/*`
- Garmin adapter, sync logic, AI generation, encryption

4. Data access
- `src/lib/prisma.ts` + Prisma models in `prisma/schema.prisma`
- Reads/writes app data in PostgreSQL

5. External systems
- Garmin APIs
- AI providers

## 4. Folder map (important paths)

- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/connect-garmin/page.tsx`
- `src/app/(app)/workout/page.tsx`
- `src/app/api/auth/*`, `src/app/api/garmin/*`, `src/app/api/health-metrics/route.ts`, `src/app/api/workout/*`
- `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/constants.ts`
- `src/server/garmin.ts`, `src/server/sync.ts`, `src/server/ai.ts`, `src/server/encryption.ts`
- `prisma/schema.prisma`, `prisma/migrations/*`
- `src/middleware.ts` (protects private routes)

## 5. Data model (simple view)

Core tables:
- `users`: account + Garmin connection status
- `activities`: synced workouts/runs from Garmin
- `daily_health_readings`: sleep/HRV/resting HR snapshots
- `user_running_fitness`: race predictions + pace targets
- `workouts`: generated/accepted/rejected AI workouts
- `ai_training_insights`: reserved for future coaching insights

Most data is user-scoped (`user_id` foreign key), so each person only sees their own records.

## 6. Main user flows

### A) Login flow
1. User submits email/password.
2. NextAuth checks credentials in `src/lib/auth.ts`.
3. Password is verified with bcrypt hash.
4. JWT session is created.
5. Protected routes (`/dashboard`, `/workout`, `/connect-garmin`) are guarded by `src/middleware.ts`.

### B) Garmin sync flow
1. User connects Garmin on `/connect-garmin`.
2. Credentials/session payload is encrypted (`src/server/encryption.ts`) and stored in DB.
3. User triggers sync (`POST /api/garmin/sync`).
4. Route creates one sync context (single Garmin client session).
5. Sync services run:
- activities sync
- daily health sync
- running fitness sync
6. Data is upserted into DB and `lastSyncAt` is updated.

### C) Workout generation flow
1. User submits workout request on `/workout`.
2. `POST /api/workout/generate` validates input + session.
3. `src/server/ai.ts` loads user context:
- fitness profile (required)
- recent activities
- recent health data
4. Selected AI provider generates Garmin-compatible JSON.
5. Parsed workout is saved with status `generated`.
6. User can accept/reject:
- accept tries Garmin upload first; status changes only on success
- reject marks workout as `rejected`

## 7. Key design decisions (and why)

1. Single Next.js app for frontend + backend
- Reason: fewer moving parts for a small team and faster iteration.

2. App Router + server components by default
- Reason: keep data fetching close to the server and reduce client complexity.

3. NextAuth credentials with JWT sessions
- Reason: simple email/password auth without custom session infrastructure.

4. Prisma + PostgreSQL
- Reason: typed queries, safe migrations, and production-ready relational DB.

5. Adapter pattern for Garmin and AI providers
- Garmin: `GarminAdapter` in `src/server/garmin.ts`
- AI: provider interface in `src/server/ai.ts`
- Reason: easier to swap providers or add fallback logic.

6. Strict request validation in routes
- Reason: prevent bad data from reaching services/DB.

7. Encrypt Garmin token payload before DB storage
- Reason: reduce risk if DB is exposed.

## 8. Current strengths

- Clear separation between UI, API, service, and DB layers.
- Auth is integrated across pages and routes.
- Sync pipeline is modular and easier to debug.
- Dashboard and workout pages use real DB-backed data.
- AI provider errors are now normalized to user-friendly messages.

## 9. Current limitations (important)

1. Garmin credentials are still stored (encrypted), not replaced by a true OAuth token refresh system.
2. Sync and generation run in request/response time (no background job queue yet).
3. Test coverage is still light; most checks are lint, typecheck, and manual smoke tests.
4. Error handling is better but still mostly string-based in some places.
5. Observability is basic (no centralized tracing/metrics yet).

## 10. Improvement roadmap (beginner-friendly order)

### Priority 1: Reliability
1. Add background jobs for long operations (sync, AI generation).
2. Add retry logic with backoff for transient Garmin/API failures.
3. Add idempotency keys for sensitive mutations (accept/reject/upload).

### Priority 2: Safety and correctness
1. Add schema validation with Zod for all route inputs and outputs.
2. Replace string status fields with enums in Prisma (`WorkoutStatus`).
3. Strengthen secret/config boot validation at startup.

### Priority 3: Testing
1. Unit tests for mapper/encryption/date-validation helpers.
2. Integration tests for auth + Garmin sync + workout routes.
3. End-to-end tests for core happy path (register -> sync -> generate -> accept).

### Priority 4: Developer experience
1. Add structured logging with request IDs.
2. Add `docs/` section with API contract examples.
3. Add seed scripts for demo data.

### Priority 5: Product quality
1. Add dashboard loading skeletons and clearer empty-state guidance.
2. Add sync history/audit table.
3. Add user-facing troubleshooting hints for provider failures.

## 11. How to reason about changes

When adding a feature, follow this checklist:
1. Update Prisma schema only if data model must change.
2. Add/adjust route validation first.
3. Keep business logic in `src/server/*`, not in UI components.
4. Make DB writes explicit and user-scoped.
5. Return clear error status + message.
6. Run `npm run lint` and `npx tsc --noEmit`.

## 12. Architecture principles to keep

- Keep boundaries clear (UI != business logic != data access).
- Prefer explicit contracts over hidden assumptions.
- Keep security defaults strict (auth checks, encrypted secrets, safe errors).
- Build small, testable modules.
- Favor predictable behavior over clever shortcuts.

