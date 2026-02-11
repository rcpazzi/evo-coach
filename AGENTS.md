# Evo Coach Agent Rules

## 1. Project Context
- Project goal: migrate Evo Coach from Flask/SQLite to a full-stack TypeScript app.
- Stack: Next.js App Router, TypeScript, Prisma, PostgreSQL (Docker), NextAuth.
- Source of truth:
  - `MIGRATION_PLAN.md` for migration sequence and implementation scope.
  - `LEARNING.md` for stack-specific guidance and mental models.

## 2. Current Migration Phase
- Steps 2 through 6 are implemented (auth, app shell, dashboard catch-up, Garmin core + sync routes).
- Current active target is Phase 5: implementation Steps 7 and 8 (AI generation core + workout API/UI flow).
- Do not skip migration order unless explicitly requested by the user.

## 3. Core Engineering Rules
- Keep TypeScript strict. Avoid `any` unless there is no practical alternative and add an inline rationale.
- Prefer server components for data fetching and server-only logic.
- Use client components only when interactivity/browser APIs are required.
- Build reusable components with clear boundaries and predictable props.
- Never run destructive git/file operations unless explicitly requested.
- Never revert or overwrite unrelated user changes.

## 4. Data and Backend Rules
- Use Prisma through the singleton in `src/lib/prisma.ts`.
- Manage schema changes via Prisma migrations (`prisma migrate dev/deploy`).
- Avoid schema drift between code and migrations.
- Normalize and validate all API inputs.
- Return explicit HTTP statuses and machine-readable JSON error payloads.

## 5. Auth and Security Rules
- Follow the credentials-based NextAuth flow in `src/lib/auth.ts`.
- Never log secrets, tokens, or raw credentials.
- Keep session/jwt field shape consistent: `id`, `email`, `garminConnected`.
- Always hash passwords with bcrypt before writing to DB.

## 6. Frontend/UI Rules
- For new UI, prefer Shadcn-style primitives in `src/components/ui/*`.
- Keep Evo design tokens centralized in `src/app/globals.css`.
- Keep UI responsive across mobile and desktop.
- Ensure accessible labels, focus styles, and sensible keyboard behavior.

## 7. Testing and Verification Rules
- Minimum checks before completion:
  - `npm run lint`
  - `npx tsc --noEmit`
  - feature-level smoke test for affected routes/APIs
- For auth-related work, verify:
  - protected route redirect behavior
  - register success/failure cases
  - login success/failure cases

## 8. Workflow Rules for Changes
- Implement in small, migration-aligned increments.
- Keep each change focused on the current step scope.
- Update documentation when setup, behavior, or conventions change.
- Final handoff must include:
  - what changed
  - verification performed
  - known limitations or deferred items

## 9. Definition of Done
- Current migration step acceptance criteria are satisfied.
- Lint and type checks pass.
- Manual smoke test for changed behavior passes.
- New and modified files are documented in the handoff summary.
