# Evo Coach v2 - Migration Plan

## Context

**What**: Migrate Evo Coach from Flask/SQLite to a modern full-stack TypeScript application.

**Why**: The Flask CS50 prototype proved the concept. V2 brings production-grade infrastructure: type safety, a real database, component-based UI, and cloud deployment readiness.

**Outcome**: A fully functional Evo Coach with the same features, built on Next.js + React + Shadcn UI + Prisma + PostgreSQL + Docker, with SST deployment deferred.

**Decisions made**:

- Fresh start -- no user data migration from SQLite
- AI layer supports both OpenRouter (DeepSeek R1) and Anthropic (Claude) via `AI_PROVIDER` env var
- SST/AWS deployment deferred -- focus on local Docker development first
- `garmin-connect` npm package as primary Garmin integration (fallback: direct HTTP)

---

## Source & Destination

| | Path |
|---|---|
| Flask app (reference) | `../evo-coach-cs50/` |
| New app | `../evo-coach-v2/` |

---

## Phase 1: Project Bootstrap

### 1.1 Initialize Project

```bash
npx create-next-app@latest evo-coach-v2 --typescript --tailwind --eslint --app --src-dir
cd evo-coach-v2
npx shadcn@latest init
# Style: New York | Base color: Slate | CSS variables: Yes
```

### 1.2 Install Dependencies

```bash
npm install prisma @prisma/client next-auth@beta bcrypt openai @anthropic-ai/sdk next-themes
npm install -D @types/bcrypt
```

### 1.3 Docker Compose

`docker-compose.yml` -- PostgreSQL 16 for local development:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: evo
      POSTGRES_PASSWORD: evo_dev_password
      POSTGRES_DB: evo_coach
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 1.4 Environment Variables

`.env.local`:

```bash
DATABASE_URL="postgresql://evo:evo_dev_password@localhost:5432/evo_coach"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate: openssl rand -base64 32>"
OPENROUTER_API_KEY="<your-key>"
ANTHROPIC_API_KEY="<your-key>"
AI_PROVIDER="openrouter"
ENCRYPTION_KEY="<generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\">"
```

### 1.5 Prisma Schema

`prisma/schema.prisma` -- maps all 6 tables from the Flask app:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id               Int       @id @default(autoincrement())
  email            String    @unique
  passwordHash     String    @map("password_hash")
  garminConnected  Boolean   @default(false) @map("garmin_connected")
  garminOauthToken Bytes?    @map("garmin_oauth_token")
  lastSyncAt       DateTime? @map("last_sync_at")
  createdAt        DateTime  @default(now()) @map("created_at")

  activities          Activity[]
  dailyHealthReadings DailyHealthReading[]
  runningFitness      UserRunningFitness?
  workouts            Workout[]
  aiTrainingInsights  AiTrainingInsight[]

  @@map("users")
}

model Activity {
  id                      Int       @id @default(autoincrement())
  userId                  Int       @map("user_id")
  garminActivityId        BigInt?   @unique @map("garmin_activity_id")
  activityDate            DateTime? @map("activity_date")
  activityName            String?   @map("activity_name")
  activityType            String?   @map("activity_type")
  activityDescription     String?   @map("activity_description")
  distanceMeters          Float?    @map("distance_meters")
  durationSeconds         Int?      @map("duration_seconds")
  averagePaceSecondsPerKm Int?      @map("average_pace_seconds_per_km")
  splitSummariesJson      Json?     @map("split_summaries_json")
  averageHrBpm            Int?      @map("average_hr_bpm")
  maxHrBpm                Int?      @map("max_hr_bpm")
  hrTimeInZone1           Int?      @map("hr_time_in_zone1")
  hrTimeInZone2           Int?      @map("hr_time_in_zone2")
  hrTimeInZone3           Int?      @map("hr_time_in_zone3")
  hrTimeInZone4           Int?      @map("hr_time_in_zone4")
  hrTimeInZone5           Int?      @map("hr_time_in_zone5")
  aerobicTrainingEffect   Float?    @map("aerobic_training_effect")
  anaerobicTrainingEffect Float?    @map("anaerobic_training_effect")
  trainingEffectLabel     String?   @map("training_effect_label")
  elevationGain           Float?    @map("elevation_gain")
  elevationLoss           Float?    @map("elevation_loss")
  locationName            String?   @map("location_name")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, activityDate], name: "idx_activities_user_date")
  @@map("activities")
}

model DailyHealthReading {
  id                       Int      @id @default(autoincrement())
  userId                   Int      @map("user_id")
  readingDate              DateTime @map("reading_date") @db.Date
  sleepScore               Int?     @map("sleep_score")
  totalSleepSeconds        Int?     @map("total_sleep_seconds")
  sleepStress              Int?     @map("sleep_stress")
  sleepScoreGarminFeedback String?  @map("sleep_score_garmin_feedback")
  avgOvernightHrv          Float?   @map("avg_overnight_hrv")
  hrvStatus                String?  @map("hrv_status")
  hrv7dayAvg               Float?   @map("hrv_7day_avg")
  restingHr                Int?     @map("resting_hr")
  restingHr7dayAvg         Int?     @map("resting_hr_7day_avg")
  bodyBatteryStart         Int?     @map("body_battery_start")
  bodyBatteryEnd           Int?     @map("body_battery_end")
  dataSyncedAt             DateTime @default(now()) @map("data_synced_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, readingDate])
  @@index([userId, readingDate(sort: Desc)], name: "idx_daily_health_user_date")
  @@map("daily_health_readings")
}

model UserRunningFitness {
  id                       Int       @id @default(autoincrement())
  userId                   Int       @unique @map("user_id")
  vo2Max                   Int?      @map("vo2_max")
  predicted5kSeconds       Int?      @map("predicted_5k_seconds")
  predicted10kSeconds      Int?      @map("predicted_10k_seconds")
  predictedHalfSeconds     Int?      @map("predicted_half_seconds")
  predictedMarathonSeconds Int?      @map("predicted_marathon_seconds")
  racePredictionsLastUpdate DateTime? @map("race_predictions_last_update") @db.Date
  easyPaceLow              Int?      @map("easy_pace_low")
  easyPaceHigh             Int?      @map("easy_pace_high")
  tempoPace                Int?      @map("tempo_pace")
  thresholdPace            Int?      @map("threshold_pace")
  intervalPace             Int?      @map("interval_pace")
  repetitionPace           Int?      @map("repetition_pace")
  longRunPace              Int?      @map("long_run_pace")
  weeklyVolumeAvgKm        Float?    @map("weekly_volume_avg_km")
  longestRunKm             Float?    @map("longest_run_km")
  runningDistanceAvgKm     Float?    @map("running_distance_avg_km")
  lastUpdated              DateTime? @map("last_updated")
  dataSource               String    @default("garmin") @map("data_source")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_running_fitness")
}

model Workout {
  id                       Int       @id @default(autoincrement())
  userId                   Int       @map("user_id")
  workoutType              String    @map("workout_type")
  title                    String
  aiDescription            String?   @map("ai_description")
  workoutJson              Json      @map("workout_json")
  totalDistanceKm          Float?    @map("total_distance_km")
  estimatedDurationMinutes Int?      @map("estimated_duration_minutes")
  userPrompt               String?   @map("user_prompt")
  status                   String    @default("generated")
  scheduledDate            DateTime? @map("scheduled_date") @db.Date
  garminWorkoutId          BigInt?   @map("garmin_workout_id")
  createdAt                DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("workouts")
}

model AiTrainingInsight {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  insightDate DateTime @map("insight_date") @db.Date
  insightText String   @map("insight_text")
  insightType String?  @map("insight_type")
  createdAt   DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, insightDate, insightType])
  @@map("ai_training_insights")
}
```

### 1.6 Prisma Client Singleton

`src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

---

## Phase 2: Authentication

### 2.1 NextAuth.js Configuration

**File**: `src/lib/auth.ts`

- Credentials provider with email + password
- Password hashing via `bcrypt`
- JWT session strategy storing `userId`, `email`, `garminConnected`
- TypeScript type augmentation for custom session fields

### 2.2 Auth API Routes

- `src/app/api/auth/[...nextauth]/route.ts` -- NextAuth catch-all
- `src/app/api/auth/register/route.ts` -- Registration endpoint
  - Validates: email uniqueness, password >= 6 chars, password confirmation
  - Hashes with bcrypt, creates user via Prisma

### 2.3 Auth Middleware

**File**: `src/middleware.ts`

- Protects: `/dashboard`, `/workout`, `/connect-garmin`
- Redirects unauthenticated users to `/login`

### 2.4 Auth UI

- `src/app/(auth)/login/page.tsx` + `src/components/auth/login-form.tsx`
- `src/app/(auth)/register/page.tsx` + `src/components/auth/register-form.tsx`
- Shadcn: `button`, `input`, `label`, `card`

---

## Phase 3: Layout, Theme & Dashboard

### 3.1 Root Layout + Theme System

**File**: `src/app/layout.tsx` -- ThemeProvider (next-themes), Space Grotesk font, Toaster

**File**: `src/app/globals.css` -- Evo design tokens mapped to Shadcn CSS variables:

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#fafafa` | `#1a1815` |
| `--foreground` | `#1c1917` | `#ffffff` |
| `--card` | `#ffffff` | `#292524` |
| `--muted` | `#f5f5f5` | `#3d3836` |
| `--muted-foreground` | `#a8a29e` | `#a8a29e` |
| `--primary` | `#6b8cce` | `#6b8cce` |
| `--border` | `#e7e5e4` | `#44403c` |
| `--destructive` | `#ef4444` | `#ef4444` |

Additional semantic colors (as Tailwind custom):

- `--evo-workout`: `#f59e0b` (amber)
- `--evo-recovery`: `#10b981` (emerald)
- `--evo-sleep`: `#6366f1` (indigo)

**Files**: `src/components/navbar.tsx`, `src/components/theme-toggle.tsx`, `src/components/theme-provider.tsx`

### 3.2 Welcome Page

**File**: `src/app/page.tsx` -- Unauthenticated: hero + login CTA. Authenticated: redirect to `/dashboard`.

### 3.3 Dashboard Page (Server Component)

**File**: `src/app/(app)/dashboard/page.tsx`

Fetches directly from Prisma (no API call needed):

- Recent activities (7)
- Latest health reading
- Fitness profile
- Workouts (50)

### 3.4 Dashboard Components

| File | Type | Purpose | Shadcn |
|------|------|---------|--------|
| `components/dashboard/fitness-profile-card.tsx` | Server | Race predictions + training paces | Card |
| `components/dashboard/health-metrics-card.tsx` | Client | Sleep/HRV/HR with date nav | Card, Skeleton |
| `components/dashboard/recent-activities-table.tsx` | Server | Activity list | Table |
| `components/dashboard/workout-history-table.tsx` | Server | Workout list + status badges | Table, Badge |
| `components/dashboard/workout-detail-dialog.tsx` | Client | Workout steps modal | Dialog |
| `components/dashboard/sync-button.tsx` | Client | Garmin sync with spinner | Button |
| `components/dashboard/create-workout-card.tsx` | Server | CTA to generate workout | Card |

### 3.5 Health Metrics API

**File**: `src/app/api/health-metrics/route.ts` -- GET `?date=YYYY-MM-DD`, returns JSON

---

## Phase 4: Garmin Integration

### 4.1 Encryption

**File**: `src/server/encryption.ts`

- AES-256-GCM via Node.js `crypto` module
- Format: `[12-byte IV][16-byte auth tag][ciphertext]`
- New key required (incompatible with Flask Fernet)

### 4.2 Garmin Client

**File**: `src/server/garmin.ts`

- Primary: `garmin-connect` npm package
- Fallback: Direct HTTP to Garmin API endpoints
- Functions: `createGarminConnection()`, `getGarminClientForUser()`

**Risk**: The npm package may not support `get_race_predictions()` or `upload_workout()`. Check coverage early -- if missing, implement direct HTTP calls using the session cookies.

### 4.3 Field Mapper

**File**: `src/server/garmin-field-mapper.ts`

Port from `../evo-coach-cs50/services/garmin_field_mapper.py` (212 lines):

- `mapActivity()` -- 23 field mappings
- `mapDailyHealthReadings()` -- merges sleep + HRV + HR data
- `mapRacePredictions()` -- 4 race distance fields
- `mapRunningVolume()` -- weekly avg from 4-week sum

### 4.4 VDOT Pace Calculator

**File**: `src/server/vdot.ts`

Port from `../evo-coach-cs50/services/sync.py` lines 256-282:

```typescript
export function calculateTrainingPaces(predicted10kSeconds: number) {
  const base = predicted10kSeconds / 10;
  return {
    easyPaceLow:    Math.floor(base * 1.24),
    easyPaceHigh:   Math.floor(base * 1.36),
    tempoPace:      Math.floor(base * 1.09),
    thresholdPace:  Math.floor(base * 1.03),
    intervalPace:   Math.floor(base * 0.95),
    repetitionPace: Math.floor(base * 0.89),
  };
}
```

### 4.5 Sync Service

**File**: `src/server/sync.ts`

Port from `../evo-coach-cs50/services/sync.py` (360 lines):

- `syncUserActivities(userId, start, end)` -- fetch running activities, map, upsert
- `syncDailyHealthData(userId, start, end)` -- fetch sleep/HRV/HR, map, upsert
- `syncUserRunningFitness(userId)` -- fetch race predictions, calculate paces, upsert
- `uploadWorkoutToGarmin(userId, workoutData)` -- upload Garmin JSON

Key difference: Use Prisma `upsert` instead of raw SQL `INSERT OR REPLACE`.

### 4.6 Garmin Routes + Page

- `src/app/api/garmin/connect/route.ts` -- POST
- `src/app/api/garmin/disconnect/route.ts` -- POST
- `src/app/api/garmin/sync/route.ts` -- POST (triggers all 3 syncs in parallel)
- `src/app/(app)/connect-garmin/page.tsx` -- email + password form

---

## Phase 5: AI Workout Generation

### 5.1 Provider Abstraction

**File**: `src/server/ai.ts`

```typescript
interface AIProvider {
  generateCompletion(messages: { role: string; content: string }[]): Promise<string>;
}
```

Selected via `AI_PROVIDER` env var:

- `"openrouter"` -- `openai` SDK with `baseURL: "https://openrouter.ai/api/v1"`, model: `tngtech/deepseek-r1t2-chimera:free`
- `"anthropic"` -- `@anthropic-ai/sdk`, model: `claude-sonnet-4-5-20250929`

### 5.2 Constants

**File**: `src/lib/constants.ts`

- 309-line `SYSTEM_PROMPT` -- port verbatim from `../evo-coach-cs50/services/ai.py` lines 1-309
- Garmin workout JSON structures (step types, end conditions, target types, pace conversions)
- VDOT multiplier constants

### 5.3 Workout Pipeline

**File**: `src/server/ai.ts` (continued)

`generateWorkout(userId, userPrompt)`:

1. Fetch from Prisma: fitness profile (required), last 5 activities, last 3 health readings
2. Build system + user messages (same format as Python)
3. Call selected AI provider
4. Parse response: strip markdown code blocks, validate `workoutName`, `sportType`, `workoutSegments`
5. Return `{ workout, explanation }`

### 5.4 Workout Routes + UI

**Routes**:

- `src/app/api/workout/generate/route.ts` -- POST: type, distance, prompt
- `src/app/api/workout/[id]/accept/route.ts` -- POST: upload to Garmin
- `src/app/api/workout/[id]/reject/route.ts` -- POST: mark rejected

**Page**: `src/app/(app)/workout/page.tsx`

**Components**:

| File | Purpose |
|------|---------|
| `components/workout/workout-form.tsx` | Type radio, distance input, prompt textarea |
| `components/workout/workout-preview.tsx` | Generated workout display |
| `components/workout/workout-step-list.tsx` | Warmup/interval/cooldown steps with icons |
| `components/workout/workout-actions.tsx` | Accept/reject buttons |

Shadcn: `radio-group`, `textarea`, `select`

---

## Phase 6: Polish & SST (Deferred)

### Polish

- Skeleton loaders for dashboard components
- Spinners for sync and AI generation
- Toast notifications replacing Flask flash messages
- Error boundaries with user-friendly fallbacks
- Responsive design verification (mobile)

### SST (When Ready)

1. Create AWS account, configure credentials
2. Create `sst.config.ts`:
   - `sst.aws.Postgres` for RDS
   - `sst.aws.Nextjs` for the app
3. Set secrets: `npx sst secret set NextAuthSecret "..."`
4. Deploy: `npx sst deploy --stage production`
5. Run `npx prisma migrate deploy` against production DB

---

## Project Structure

```
evo-coach-v2/
├── docker-compose.yml
├── .env.local
├── .env.example
├── MIGRATION_PLAN.md             # This file
├── LEARNING.md                   # Tech stack learning guide
├── next.config.ts
├── tailwind.config.ts
├── components.json               # Shadcn config
├── prisma/
│   ├── schema.prisma             # 6 models (User, Activity, DailyHealthReading,
│   │                             #   UserRunningFitness, Workout, AiTrainingInsight)
│   └── migrations/               # Auto-generated by Prisma
├── src/
│   ├── middleware.ts              # Auth route protection
│   ├── app/
│   │   ├── layout.tsx            # Root: ThemeProvider, Space Grotesk, Toaster
│   │   ├── page.tsx              # Welcome (unauth) / redirect (auth)
│   │   ├── globals.css           # Tailwind + Evo design tokens
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx        # Auth check wrapper
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── workout/page.tsx
│   │   │   └── connect-garmin/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts
│   │       │   └── register/route.ts
│   │       ├── garmin/
│   │       │   ├── connect/route.ts
│   │       │   ├── disconnect/route.ts
│   │       │   └── sync/route.ts
│   │       ├── health-metrics/route.ts
│   │       └── workout/
│   │           ├── generate/route.ts
│   │           └── [id]/
│   │               ├── accept/route.ts
│   │               └── reject/route.ts
│   ├── components/
│   │   ├── ui/                   # Shadcn primitives (auto-installed)
│   │   ├── navbar.tsx
│   │   ├── theme-toggle.tsx
│   │   ├── theme-provider.tsx
│   │   ├── auth/
│   │   │   ├── login-form.tsx
│   │   │   └── register-form.tsx
│   │   ├── dashboard/
│   │   │   ├── fitness-profile-card.tsx
│   │   │   ├── health-metrics-card.tsx
│   │   │   ├── recent-activities-table.tsx
│   │   │   ├── workout-history-table.tsx
│   │   │   ├── workout-detail-dialog.tsx
│   │   │   ├── sync-button.tsx
│   │   │   └── create-workout-card.tsx
│   │   └── workout/
│   │       ├── workout-form.tsx
│   │       ├── workout-preview.tsx
│   │       ├── workout-step-list.tsx
│   │       └── workout-actions.tsx
│   ├── lib/
│   │   ├── prisma.ts             # DB client singleton
│   │   ├── auth.ts               # NextAuth configuration
│   │   ├── utils.ts              # cn(), formatPace(), formatDuration()
│   │   └── constants.ts          # SYSTEM_PROMPT, VDOT multipliers, Garmin JSON types
│   └── server/
│       ├── ai.ts                 # Multi-provider workout generation
│       ├── garmin.ts             # Garmin connection management
│       ├── sync.ts               # Activity/health/fitness sync
│       ├── encryption.ts         # AES-256-GCM for Garmin tokens
│       ├── garmin-field-mapper.ts
│       └── vdot.ts               # Training pace calculations
```

---

## Implementation Order

| Step | Task | Verification |
|------|------|-------------|
| 1 | Project init + Docker + Prisma schema | `docker compose up -d` + `npx prisma migrate dev` + `npx prisma studio` shows 6 tables |
| 2 | NextAuth + auth pages + middleware | Register, login, logout work. Protected routes redirect to `/login` |
| 3 | Root layout + theme + navbar | App shell renders. Theme toggle works. No FOUC |
| 4 | Dashboard + components (empty state) | Dashboard shows "no data" placeholders gracefully |
| 5 | Encryption + Garmin service + field mapper + VDOT | Unit test: encrypt/decrypt roundtrip. VDOT calculation matches Python output |
| 6 | Sync service + Garmin routes + sync button | Connect Garmin -> sync -> data appears on dashboard |
| 7 | AI constants + multi-provider service | Generate workout via API. Toggle `AI_PROVIDER` and verify both work |
| 8 | Workout routes + UI components | Full flow: generate -> preview steps -> accept/reject |
| 9 | Polish: loading, toasts, errors, responsive | All actions show feedback. Mobile layout works |
| 10 | SST (deferred) | Cloud deployment when AWS is set up |

---

## Source Files Reference

These files in `../evo-coach-cs50/` should be open during migration:

| What to port | File | Notes |
|-------------|------|-------|
| System prompt (309 lines) | `services/ai.py` lines 1-309 | Port verbatim to `constants.ts` |
| Workout generation pipeline | `services/ai.py` lines 310-650 | Port to `server/ai.ts` |
| VDOT pace multipliers | `services/sync.py` lines 256-282 | Port to `server/vdot.ts` |
| Full sync logic | `services/sync.py` (360 lines) | Port to `server/sync.ts` |
| Garmin field mappings | `services/garmin_field_mapper.py` (212 lines) | Port to `server/garmin-field-mapper.ts` |
| Garmin token management | `services/garmin.py` (112 lines) | Adapt for JS library in `server/garmin.ts` |
| Authoritative DB schema | `schema.sql` (167 lines) | Already mapped to Prisma above |
| Dashboard layout patterns | `templates/index.html` | Reference for component hierarchy |
| Workout step rendering | `templates/workout.html` | Reference for step list UI |
| Design token values | `static/css/custom.css` (2132 lines) | Map to `globals.css` Shadcn vars |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `garmin-connect` npm lacks race predictions or workout upload | Blocks key features | Check API coverage in Phase 4, day 1. Fallback: direct HTTP using session cookies |
| Garmin API rate limiting | Sync failures | Keep user-triggered sync only. No background polling |
| AI response parsing edge cases (markdown wrapping, truncated JSON) | Broken workouts | Port all parsing logic from Python faithfully, including edge cases |
| Long sync operations (10-30s) | Timeout in production | Fine locally. For SST: configure Lambda timeout to 60s |
| `garmin-connect` npm token format differs from Python `garth` | Can't reuse tokens | Expected -- fresh start means users reconnect anyway |
