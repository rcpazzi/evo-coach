# Evo Coach v2 - Learning Guide

A practical reference for migrating from Flask/SQLite to Next.js/React/Shadcn/Prisma/PostgreSQL/Docker/SST. Written for someone who knows the basics but needs to connect the dots for a real project.

---

## Current Implementation Notes (February 11, 2026)

- AI provider selection is runtime-configurable via `AI_PROVIDER`:
  - `openrouter` (default) requires `OPENROUTER_API_KEY`
  - `anthropic` requires `ANTHROPIC_API_KEY`
- Workout generation API contract:
  - `POST /api/workout/generate`
  - Requires authenticated user and existing `userRunningFitness` data
  - Missing fitness profile returns a sync-first guidance error
- Workout decision APIs:
  - `POST /api/workout/[id]/accept` uploads to Garmin first, then marks workout `uploaded`
  - If Garmin upload fails, workout remains `generated`
  - `POST /api/workout/[id]/reject` marks workout `rejected`

---

## 1. Tech Stack Overview

| Tool | What It Does | Flask Equivalent |
|------|-------------|------------------|
| **Next.js (App Router)** | Full-stack React framework. File-based routing, server-side rendering, API routes. Both your Flask app and Jinja templates in one. | Flask + Jinja2 |
| **React Server Components** | Components that render on the server and send HTML. No JS shipped to client. Default in App Router. | Jinja2 templates |
| **React Client Components** | Components that hydrate in the browser for interactivity. Add `"use client"` directive. | `<script>` tags in templates |
| **Shadcn UI** | Copy-paste component library built on Radix + Tailwind. Code lives in your project, you own it. | Bootstrap, but you own the source |
| **Prisma** | Type-safe ORM. Define models in a schema file, run migrations, get auto-generated TypeScript types. | raw SQL / SQLAlchemy |
| **PostgreSQL** | Production database replacing SQLite. Runs in Docker locally. | SQLite |
| **Docker** | Containerized PostgreSQL for local dev. Everyone gets the same database. | `venv` but for infrastructure |
| **SST v3** | Infrastructure-as-code for AWS. One command to deploy Next.js + database. | Manual server setup / Heroku |

---

## 2. Key Concepts

### 2.1 File-Based Routing

In Flask, you write route decorators. In Next.js, your folder structure IS your routing.

**Flask:**

```python
@app.route('/workout/<int:id>')
def workout_detail(id):
    return render_template('workout.html', workout=workout)
```

**Next.js:**

```
src/app/
  dashboard/
    page.tsx          --> /dashboard
  workout/
    page.tsx          --> /workout
    [id]/
      page.tsx        --> /workout/42
  api/
    garmin/
      sync/
        route.ts      --> POST /api/garmin/sync
```

The `[id]` folder uses square brackets for dynamic segments:

```tsx
// src/app/workout/[id]/page.tsx
export default async function WorkoutPage({ params }: { params: { id: string } }) {
  const workout = await prisma.workout.findUnique({ where: { id: parseInt(params.id) } });
  return <WorkoutDetail workout={workout} />;
}
```

**Key rules:**

- A folder with `page.tsx` = a route
- A folder with `route.ts` = an API endpoint
- A folder without either = not a route (can hold layouts, components, utilities)
- `layout.tsx` wraps all pages in its folder and subfolders
- `loading.tsx` shows while `page.tsx` fetches data
- `error.tsx` catches errors (must be `"use client"`)

---

### 2.2 Server Components vs Client Components

**The mental model**: Server Components = Jinja templates (rendered on server, no interactivity). Client Components = your `<script>` JavaScript (runs in browser, handles events).

Components are Server Components by default. Add `"use client"` at the top to make them Client Components.

| Server Component | Client Component |
|------------------|------------------|
| Fetch data from Prisma directly | `useState`, `useEffect`, `useRef` |
| Read environment variables | `onClick`, `onChange`, event handlers |
| No JS shipped to client | Browser APIs (`localStorage`, `window`) |
| `async` function components | Animations, real-time updates |

**Evo Coach example:**

```tsx
// src/app/(app)/dashboard/page.tsx -- SERVER Component (default)
// Can query Prisma directly. No API call needed.
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const activities = await prisma.activity.findMany({
    where: { userId: currentUser.id },
    orderBy: { activityDate: "desc" },
    take: 7,
  });

  return (
    <div>
      <h1>Dashboard</h1>
      {/* This Client Component receives data as props */}
      <HealthMetricsCard />
      <RecentActivitiesTable activities={activities} />
    </div>
  );
}
```

```tsx
// src/components/dashboard/health-metrics-card.tsx -- CLIENT Component
"use client";

import { useState, useEffect } from "react";

export function HealthMetricsCard() {
  const [date, setDate] = useState(new Date());
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch(`/api/health-metrics?date=${date.toISOString().split("T")[0]}`)
      .then((res) => res.json())
      .then(setMetrics);
  }, [date]);

  return (
    <div>
      <button onClick={() => setDate(prev => /* previous day */)}>Prev</button>
      <span>{date.toLocaleDateString()}</span>
      <button onClick={() => setDate(next => /* next day */)}>Next</button>
      {metrics && <div>Sleep: {metrics.sleepScore}</div>}
    </div>
  );
}
```

**Important**: Server Components can render Client Components. Client Components cannot import Server Components (but can accept them as `children` props).

---

### 2.3 Server Actions vs API Routes

Two ways to handle mutations. Server Actions are simpler for form submissions. API Routes are better for complex/long-running operations.

**Flask:**

```python
@app.route('/workout', methods=['GET', 'POST'])
def workout():
    if request.method == 'POST':
        # handle form
        return redirect(url_for('workout_detail', id=new_id))
    return render_template('workout.html')
```

**Next.js with Server Action:**

```tsx
// src/app/(app)/workout/actions.ts
"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function rejectWorkout(workoutId: number) {
  await prisma.workout.update({
    where: { id: workoutId },
    data: { status: "rejected" },
  });
  redirect("/dashboard");
}
```

```tsx
// src/components/workout/workout-actions.tsx
"use client";

import { rejectWorkout } from "@/app/(app)/workout/actions";

export function WorkoutActions({ workoutId }: { workoutId: number }) {
  return (
    <form action={rejectWorkout.bind(null, workoutId)}>
      <button type="submit">Reject</button>
    </form>
  );
}
```

**Next.js with API Route (better for long operations like AI generation):**

```typescript
// src/app/api/workout/generate/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await generateWorkout(body.userId, body.prompt); // may take 30s+
  return NextResponse.json(result);
}
```

**When to use each in Evo Coach:**

| Use Server Actions | Use API Routes |
|--------------------|----------------|
| Reject workout | Generate workout (long-running AI call) |
| Disconnect Garmin | Sync Garmin (long-running, multiple API calls) |
| Simple status updates | Connect Garmin (external API) |
| | Health metrics (client-side date navigation) |

---

### 2.4 Prisma Migrations

In the Flask app, you had `schema.sql` and ran it with `executescript()`. No version tracking, no rollbacks.

Prisma uses a declarative schema file. You describe what you want, Prisma generates the SQL to get there.

**The workflow:**

```bash
# 1. Edit prisma/schema.prisma (add a field, change a type, add a table)

# 2. Generate and apply migration
npx prisma migrate dev --name add_workout_notes
# This creates: prisma/migrations/20260208_add_workout_notes/migration.sql
# And updates the Prisma Client types automatically

# 3. Use in code with full type safety
const workout = await prisma.workout.findUnique({
  where: { id: 42 },
  include: { user: true },
});
// workout.title is string, workout.user.email is string -- TypeScript knows!
```

**Common Prisma commands:**

```bash
npx prisma migrate dev          # Create + apply migration (dev only)
npx prisma migrate deploy       # Apply pending migrations (production)
npx prisma generate             # Regenerate client types (usually automatic)
npx prisma studio               # Visual database browser at localhost:5555
npx prisma db push              # Push schema without creating migration (prototyping)
npx prisma migrate reset        # Nuke DB, re-run all migrations (dev only!)
```

**Prisma vs raw SQL comparison:**

Flask (raw SQL):

```python
conn.execute('''
    INSERT OR REPLACE INTO daily_health_readings
    (user_id, reading_date, sleep_score, avg_overnight_hrv)
    VALUES (?, ?, ?, ?)
''', (user_id, date, sleep_score, hrv))
conn.commit()
```

Next.js (Prisma):

```typescript
await prisma.dailyHealthReading.upsert({
  where: { userId_readingDate: { userId, readingDate: new Date(date) } },
  update: { sleepScore: sleep_score, avgOvernightHrv: hrv },
  create: { userId, readingDate: new Date(date), sleepScore: sleep_score, avgOvernightHrv: hrv },
});
```

---

### 2.5 Shadcn UI Workflow

Shadcn is NOT a typical npm dependency. You run a CLI command that copies component source code into your project. You own the code.

**Install components:**

```bash
npx shadcn@latest add button        # Creates src/components/ui/button.tsx
npx shadcn@latest add card          # Creates src/components/ui/card.tsx
npx shadcn@latest add dialog        # Creates src/components/ui/dialog.tsx
npx shadcn@latest add table badge skeleton toast dropdown-menu
```

**Use in your code:**

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FitnessProfileCard({ fitness }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Running Fitness</CardTitle>
      </CardHeader>
      <CardContent>
        <p>VO2 Max: {fitness.vo2Max}</p>
        <Button variant="outline" size="sm">View Details</Button>
      </CardContent>
    </Card>
  );
}
```

**Customization**: Open `src/components/ui/button.tsx` and edit it directly. It's your code. Change colors, sizes, animations -- whatever you need.

**Browse components**: https://ui.shadcn.com/docs/components

---

### 2.6 Docker Compose for Local Dev

One command to get a PostgreSQL database running:

```bash
docker compose up -d        # Start Postgres in background
docker compose down          # Stop
docker compose down -v       # Stop and delete data
docker compose logs db       # View Postgres logs
```

Your `.env.local` points to it:

```
DATABASE_URL="postgresql://evo:evo_dev_password@localhost:5432/evo_coach"
```

No need to install PostgreSQL on your machine. Docker handles it.

---

### 2.7 Environment Variables

Next.js has strict rules about which variables reach the browser:

| Prefix | Server | Browser | Example |
|--------|--------|---------|---------|
| (none) | Yes | **No** | `DATABASE_URL`, `OPENROUTER_API_KEY` |
| `NEXT_PUBLIC_` | Yes | Yes | `NEXT_PUBLIC_APP_NAME` |

**Never** prefix secrets with `NEXT_PUBLIC_`. If a Client Component needs server data, fetch it through an API route or Server Action.

**Evo Coach `.env.local`:**

```bash
# Server-only (safe -- never reaches browser)
DATABASE_URL="postgresql://evo:evo_dev_password@localhost:5432/evo_coach"
NEXTAUTH_SECRET="random-secret-here"
OPENROUTER_API_KEY="sk-or-v1-..."
ANTHROPIC_API_KEY="sk-ant-..."
ENCRYPTION_KEY="64-char-hex-key"

# No NEXT_PUBLIC_ variables needed for this app
```

---

### 2.8 Middleware (Auth Protection)

Flask uses `@login_required` on each route. Next.js uses a single `middleware.ts` file that pattern-matches paths.

**Flask:**

```python
@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/workout')
@login_required
def workout():
    return render_template('workout.html')
```

**Next.js:**

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// Only run on these paths (everything else is public)
export const config = {
  matcher: ["/dashboard/:path*", "/workout/:path*", "/connect-garmin/:path*"],
};
```

One file protects all routes. No decorators to forget.

---

### 2.9 Dark/Light Theme (next-themes)

The Flask app uses custom JavaScript + `localStorage` + CSS `data-theme` attribute. It has a flash of wrong theme on page load.

`next-themes` solves this with zero FOUC (flash of unstyled content).

**Setup:**

```tsx
// src/components/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
```

```tsx
// src/app/layout.tsx
import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

```tsx
// src/components/theme-toggle.tsx
"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
```

Shadcn components automatically respect the theme through CSS variables in `globals.css`.

---

## 3. Flask-to-Next.js Mapping

| Flask Concept | Next.js Equivalent | Notes |
|---------------|-------------------|-------|
| `templates/base.html` | `src/app/layout.tsx` | Root layout wraps all pages |
| `templates/index.html` | `src/app/(app)/dashboard/page.tsx` | Pages are React components |
| `templates/workout.html` | `src/app/(app)/workout/page.tsx` | File = route |
| `static/css/` | `src/app/globals.css` + Tailwind | CSS variables in globals, utilities via Tailwind |
| `static/js/dashboard.js` | Client Components | `"use client"` components with React state |
| `models.py` | `prisma/schema.prisma` + `src/lib/prisma.ts` | Schema file + client singleton |
| `services/ai.py` | `src/server/ai.ts` | TypeScript, same structure |
| `services/sync.py` | `src/server/sync.ts` | Prisma upsert replaces raw SQL |
| `services/garmin.py` | `src/server/garmin.ts` | JS library instead of Python |
| `@app.route('/api/...')` | `src/app/api/.../route.ts` | File-based API routes |
| `@login_required` | `src/middleware.ts` | Single file, path matching |
| `request.form['field']` | `formData.get('field')` or `request.json()` | Server Actions or API routes |
| `redirect(url_for('...'))` | `redirect('/path')` | From `next/navigation` |
| `flash('message', 'success')` | Shadcn Toast (`sonner`) | Client-side toast notifications |
| `session['user_id']` | `getServerSession(authOptions)` | NextAuth session |
| `render_template('x.html', data=y)` | Return JSX with props | Server Components render data directly |
| `request.args.get('date')` | `request.nextUrl.searchParams.get('date')` | URL query params in API routes |
| `jsonify(data)` | `NextResponse.json(data)` | JSON responses |
| `.env` + `python-dotenv` | `.env.local` (built-in to Next.js) | No library needed |

---

## 4. Development Workflow

### Starting the Dev Environment

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies (first time or after pulling)
npm install

# 3. Run database migrations
npx prisma migrate dev

# 4. Start the dev server
npm run dev

# App runs at http://localhost:3000
```

### Adding a New Shadcn Component

```bash
# 1. Find what you need at https://ui.shadcn.com/docs/components
# 2. Install it
npx shadcn@latest add dialog

# 3. It creates src/components/ui/dialog.tsx
# 4. Import and use it
```

### Creating a New Page

To add a `/history` page:

```bash
mkdir -p src/app/\(app\)/history
# Create src/app/(app)/history/page.tsx
```

```tsx
// src/app/(app)/history/page.tsx
import { prisma } from "@/lib/prisma";

export default async function HistoryPage() {
  const workouts = await prisma.workout.findMany({
    where: { status: "completed" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Workout History</h1>
      {/* render workouts */}
    </div>
  );
}
```

Visit `http://localhost:3000/history`. No route registration needed.

### Adding a Database Table

```bash
# 1. Edit prisma/schema.prisma -- add your model
# 2. Create + apply migration
npx prisma migrate dev --name add_training_plan
# 3. Types are auto-generated. Use immediately:
```

```typescript
const plan = await prisma.trainingPlan.create({
  data: { name: "Marathon Prep", weeks: 16, userId: session.user.id },
});
```

### Deploying with SST (When Ready)

```bash
npx sst deploy --stage dev         # Deploy to dev
npx sst deploy --stage production  # Deploy to production
npx sst console                    # Open monitoring dashboard
```

---

## 5. Common Gotchas

### Gotcha 1: Forgetting "use client"

**Symptom**: `useState is not defined` or `onClick handlers do nothing`

**Fix**: Any component using `useState`, `useEffect`, `useRef`, `onClick`, `onChange`, or browser APIs must have `"use client"` as the very first line.

```tsx
// WRONG -- will crash
import { useState } from "react";
export function Counter() {
  const [count, setCount] = useState(0); // Error!
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

// CORRECT
"use client";
import { useState } from "react";
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

---

### Gotcha 2: Browser APIs in Server Components

**Symptom**: `ReferenceError: localStorage is not defined`

**Fix**: `localStorage`, `window`, `document` don't exist on the server. Use them only in Client Components, inside `useEffect`.

```tsx
"use client";
import { useEffect, useState } from "react";

export function UserPreference() {
  const [unit, setUnit] = useState("km");

  useEffect(() => {
    // Safe: runs only in the browser
    const saved = localStorage.getItem("distanceUnit");
    if (saved) setUnit(saved);
  }, []);

  return <span>{unit}</span>;
}
```

---

### Gotcha 3: Prisma Client Singleton

**Symptom**: "Too many Prisma Clients" warning or connection pool exhaustion

**Fix**: Next.js hot-reloads modules in dev. Each reload creates a new client. Use the singleton pattern:

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Always import from `@/lib/prisma`. Never `new PrismaClient()` elsewhere.

---

### Gotcha 4: Environment Variable Visibility

**Symptom**: `process.env.OPENROUTER_API_KEY` is `undefined` in the browser

**Rule**: Only `NEXT_PUBLIC_` prefixed vars reach the browser. This is a security feature.

```bash
OPENROUTER_API_KEY="sk-..."           # Server only (safe)
NEXT_PUBLIC_APP_NAME="Evo Coach"      # Visible in browser (non-sensitive only)
```

---

### Gotcha 5: File-Based Routing Surprises

Common mistakes:

- `app/workout/page.tsx` is `/workout` (folder name = URL, not file name)
- `app/api/workout/route.ts` uses **`route.ts`**, not `page.tsx` (API routes are different)
- A folder without `page.tsx` is NOT a route
- `[id]` brackets mean dynamic segment, not literal brackets in URL
- Route groups `(auth)` and `(app)` use parentheses -- they DON'T appear in the URL

---

### Gotcha 6: Form Handling Differences

**Flask**: One route handles GET (show form) and POST (process form).

**Next.js**: The page renders the form. A Server Action or API route handles submission.

```tsx
// Server Action approach
"use server";
export async function handleSubmit(formData: FormData) {
  const email = formData.get("email") as string;
  // validate, save, redirect...
  revalidatePath("/dashboard");  // Tell Next.js to refetch data
  redirect("/dashboard");        // Navigate (throws internally -- don't wrap in try/catch)
}
```

---

### Gotcha 7: The `@/` Import Alias

`@/` is an alias to the project root. Eliminates `../../../` hell.

```tsx
// Instead of:
import { prisma } from "../../../lib/prisma";

// Use:
import { prisma } from "@/lib/prisma";
```

Configured automatically in `tsconfig.json`.

---

### Gotcha 8: Async Server Components

Server Components can be `async` functions. You can `await` directly in the component body. This is NOT normal React -- it's an App Router feature.

```tsx
// Valid in Server Components
export default async function DashboardPage() {
  const data = await prisma.activity.findMany(); // Direct await!
  return <div>{data.map(...)}</div>;
}
```

Client Components CANNOT be async. Pass data as props from a Server Component, or fetch with `useEffect`/SWR.

---

## 6. Quick Reference

| I want to... | Do this |
|--------------|---------|
| Add a page | Create `src/app/[route]/page.tsx` |
| Add an API endpoint | Create `src/app/api/[route]/route.ts` with `GET`/`POST` exports |
| Add a UI component | `npx shadcn@latest add [component]` |
| Add a database table | Edit `prisma/schema.prisma`, run `npx prisma migrate dev` |
| Protect a route | Add path to `matcher` in `src/middleware.ts` |
| Handle form submission | Server Action (`"use server"`) or API route |
| Access the database | `import { prisma } from "@/lib/prisma"` (server only) |
| Add interactivity | Create Client Component with `"use client"` |
| Toggle dark mode | `useTheme()` hook from `next-themes` |
| Show loading state | Create `loading.tsx` in the route folder |
| Handle errors | Create `error.tsx` in the route folder (must be `"use client"`) |
| View database visually | `npx prisma studio` |
| Reset database | `npx prisma migrate reset` (dev only) |
| Deploy | `npx sst deploy --stage [stage]` |

---

## Official Docs

- Next.js App Router: https://nextjs.org/docs/app
- Prisma: https://www.prisma.io/docs
- Shadcn UI: https://ui.shadcn.com
- SST v3: https://sst.dev/docs
- NextAuth.js: https://next-auth.js.org
- next-themes: https://github.com/pacocoursey/next-themes
- Tailwind CSS: https://tailwindcss.com/docs

## Migration Note (2026-02-11): Garmin Sync Hardening

- Garmin sync now acquires a single Garmin client/session per sync request and reuses it across activities, daily health, and running fitness sync operations.
- `POST /api/garmin/sync` now accepts optional empty request bodies robustly by parsing raw text only when present.
- Unsupported adapter operations are surfaced explicitly as capability errors from the Garmin adapter layer.
- Direct HTTP fallback is still intentionally deferred; unsupported operations should return clear error messages instead of ambiguous failures.
