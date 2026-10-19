# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev           # dev server on http://localhost:3000
npm run build         # production build
npm run lint          # ESLint
npm run typecheck     # next typegen + tsc (typegen creates the global LayoutProps/PageProps types)
npm run db:generate   # write a new SQL migration in ./drizzle after editing src/db/schema.ts
npm run db:migrate    # apply migrations (PGlite locally, or DATABASE_URL if set)
npm run db:seed       # load diagnosis codes; pass a CSV path to load the full list: npm run db:seed -- path.csv
```

First run: copy `.env.example` to `.env.local`, set `BETTER_AUTH_SECRET`, then run `npm run db:migrate && npm run db:seed`. To reset the local database, delete `.data/` and run those two commands again.

There is no test runner yet.

## Planning documents

- [tiba-product-spec.md](tiba-product-spec.md): the version 1 spec, covering screens, data, and what is out of scope. It is the source of truth for features.
- [tiba-brand-concept.md](tiba-brand-concept.md): voice, tone, and the visual system. Where the spec's "light green and white" differs from it, the brand concept wins.

## What Tiba is

A responsive web app, installable on phones as a PWA (no native app), for a **solo clinician** to book appointments, write and sign visit notes, find patients, and generate invoice PDFs.

- **One login only:** the clinician. Patients never log in; they sign on the clinician's device.
- **Three screens:** Appointments (calendar), Visit note, Patient record. The brand rule is "three screens, nothing to learn", so push back on new screens or settings.
- **Out of scope for v1:** reminders, payment tracking, insurance claims, multi-user practices and roles, patient logins and self-booking, note templates, reports, and dashboards.

## Architecture

**Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Tailwind v4 + shadcn/ui (Base UI primitives), Drizzle ORM on PostgreSQL, Better Auth, Zod, FullCalendar 7, signature_pad, @react-pdf/renderer.

**Database: one schema, two drivers** ([src/db/index.ts](src/db/index.ts)). If `DATABASE_URL` is set, the app uses postgres-js against a real server. Otherwise it uses **PGlite**, real Postgres running in-process and stored in `.data/pglite`. PGlite allows one open instance per folder, so it is cached on `globalThis`. Stop `next dev`/`next start` before running `db:migrate` or `db:seed`, because two processes on one folder can corrupt it. `@electric-sql/pglite` is in `serverExternalPackages` and must stay there. `drizzle-kit` is only used for `generate`; migrations are applied by [scripts/migrate.ts](scripts/migrate.ts), so `drizzle-kit migrate`/`studio` are not wired up.

**Schema** ([src/db/schema.ts](src/db/schema.ts)):
- Better Auth's `user` model is the `clinicians` table, mapped in [src/lib/auth.ts](src/lib/auth.ts). Auth table columns must keep the field names Better Auth expects; when adding a Better Auth plugin, add its tables and fields by hand.
- **Practice logo** (`clinicians.practice_logo`) is optional and stored as a PNG/JPEG data URL. The browser resizes uploads to 512px in [logo-upload.tsx](src/components/logo-upload.tsx), and the server checks the format and the file's real type with `parseLogoDataUrl` in [practice-logo.ts](src/lib/practice-logo.ts). SVG is never stored. The logo deliberately isn't a Better Auth field, so it stays out of the session. Pages show it through the private route `/api/practice-logo?v=<updatedAt>` (`practiceLogoUrl()`); don't embed the data URL in pages. Save changes with `updatePractice` in [practice-actions.ts](src/lib/practice-actions.ts), which also bumps `updatedAt`, and that busts the image cache.
- Every practice table carries `clinicianId`. **Always filter by the signed-in clinician**, even though there is one login per practice.
- Money is stored as integer minor units (`feeMinor`, `totalMinor`). The currency is not decided yet.
- Age is calculated from `dateOfBirth`, never stored.

**Rules enforced by the database, not just the UI:**
- **Signed notes are locked.** A trigger in [drizzle/0001_lock_signed_notes.sql](drizzle/0001_lock_signed_notes.sql) rejects any UPDATE or DELETE once `signed_at` is set. Corrections go in `note_addenda`. A check constraint stops a note being marked signed without `clinician_signature`. The patient's signature is optional, so collect it *before* the clinician signs.
- **Gap-free invoice numbers:** in the same transaction that inserts the invoice, run `UPDATE clinicians SET last_invoice_number = last_invoice_number + 1 ... RETURNING`. Don't use a Postgres sequence, because sequences skip numbers on rollback. `invoice_items.appointment_id` is unique, so a visit can only be invoiced once.
- Hand-written SQL (extensions, triggers) goes in `npm run db:generate -- --custom --name <name>` migrations. `0000_init.sql` was edited to start with `CREATE EXTENSION pg_trgm`.

**Search** uses the `pg_trgm` GIN indexes on `patients.full_name` and `diagnosis_codes`. For typo-tolerant name search, use `word_similarity(q, full_name) > 0.3 OR full_name ILIKE '%'||q||'%'`, ordered by `word_similarity`. The default `%` operator compares against the whole name and misses typos like "amna" for "Amina Wanjiru".

**Diagnosis codes:** [data/diagnosis-codes.sample.csv](data/diagnosis-codes.sample.csv) is a small sample (ICD-10, F/Z codes). The full list depends on the market: WHO ICD-10 needs a licence, while ICD-10-CM (US) is public domain.

**Auth** ([src/lib/auth.ts](src/lib/auth.ts)):
- Email and password with at least 12 characters, plus optional TOTP 2FA.
- Sessions expire after **30 minutes of inactivity** (`expiresIn` + `updateAge`), because the device is handed to patients.
- [src/proxy.ts](src/proxy.ts) (Next 16's renamed middleware) only checks that a session cookie exists. **Every page and Server Action that reads patient data must call `requireClinician()`.**
- Better Auth rejects requests whose `Origin` isn't `BETTER_AUTH_URL` with an "Invalid origin" error. In development `trustedOrigins` also allows `127.0.0.1` and LAN addresses (`192.168.*`, `10.*`), and `next.config.ts` has matching `allowedDevOrigins`. This means a phone on the same Wi-Fi can use the Network URL that `next dev` prints. Production trusts only `BETTER_AUTH_URL`.

**Routes:**
- `src/app/(auth)/` holds sign-in, sign-up, and the 2FA step.
- `src/app/(app)/` holds signed-in screens; its layout calls `requireClinician()` and renders `AppShell`. `/appointments` and `/patients` are placeholders for now. The visit note will be opened from an appointment, so it has no nav entry.
- Better Auth's handler is at `src/app/api/auth/[...all]`.

**Appointments screen** (`src/app/(app)/appointments/`):
- Server Actions live in `actions.ts`: list (for the calendar's visible range), patient search, care types with their last fee, and create. Every one starts with `requireClinician()` and filters by `clinicianId`.
- The calendar is FullCalendar 7 (`@fullcalendar/react`, classic theme). The theme's CSS classes are **minified**, so style it only through the palette variables in `calendar.css`, the `dayCellClass`/`eventContent` hooks, and `[data-date]` attributes. `dateClick` listens for pointer events, so a synthetic `.click()` won't trigger it.
- Times: the browser turns its local date and time into an ISO instant before calling the server, and the server stores `timestamptz`. Display always uses the viewer's local time.
- `/appointments/[id]` is the Visit note screen. So far it shows the letterhead (`NoteLetterhead`: practice logo, practice name and clinician), the visit details and blank signature lines. Writing and signing come next. The PDF must reuse the same letterhead layout. Show dates and times on server-rendered pages with `LocalDateTime`, because the server doesn't know the viewer's time zone.

## Design system

- **Tokens** live in [src/app/globals.css](src/app/globals.css). Primitives in `src/components/ui/` are shadcn (Base UI), resized for the brand:
  - 44px (`h-11`) buttons, inputs and select boxes; a taller text area; a 20px checkbox; and a roomier dialog.
  - Badge has extra `success` (signed) and `accent` (lilac, e.g. draft) variants.
  - The toast (`toast()` from `sonner`) is mounted once in the root layout, top-centre, light only.
- **Tiba components** live in `src/components/`:
  - [app-shell.tsx](src/components/app-shell.tsx): a sidebar on `md` and up; on phones, a top bar, a bottom tab bar, and an account sheet. It respects the iPhone safe-area insets.
  - [nav-items.ts](src/components/nav-items.ts): the single list of nav destinations.
  - `PageHeader`: title, help line and actions. Start every screen with it.
  - `EmptyState`: friendly "nothing here yet" panels.
  - `FormField`: a label, an input and an optional `hint`. Pass `input` to use another control.
  - `PasswordInput`: has a show/hide toggle.
  - `FormAlert`: the form-level error box.
  - `LogoUpload`: picks and resizes the practice logo. It's used on sign-up and in `PracticeDetailsDialog`, which opens from the sidebar and the phone account sheet.
  - `Logo`.
- **Sign-in screens:** [src/app/(auth)/layout.tsx](src/app/(auth)/layout.tsx) shows the brand panel beside the form on `lg` screens and only the logo plus form on smaller ones. Start each auth page with `AuthHeading`.
- **Phone layout:** `main` has bottom padding (`pb-28`) so content clears the bottom tab bar. Keep it if you change the shell.
- **shadcn gotchas:**
  - `shadcn add` writes `import { cn } from "cn"` and installs the `cn` package (plus `next-themes` for sonner). We use `cn` from `@/lib/utils` (clsx + tailwind-merge) and have no theme switching, and ESLint errors on the `cn` import. After adding a component, fix its imports and `npm uninstall cn next-themes`.
  - Components that depend on `button` stop at a prompt asking to overwrite it. Back up `src/components/ui/button.tsx`, run `shadcn add <name> -y --overwrite`, then restore the button.

**Dependencies** are pinned to exact versions that were at least two weeks old when added. Keep new ones pinned the same way.

## Private health information

Everything sits behind the login. Never put patient data in logs, URLs, query strings, or analytics. Dev mode would log every Server Action's arguments; `logging.serverFunctions: false` in `next.config.ts` turns that off, so keep it. `.data/` holds the local database and is git-ignored. Hosting is not decided yet: it depends on the market (Kenya Data Protection Act and/or HIPAA with a BAA).

## Brand rules that affect code and copy

- **Palette:** colours are CSS variables in [src/app/globals.css](src/app/globals.css). Use the semantic tokens (`bg-primary`, `bg-secondary`, `text-muted-foreground`, `bg-accent` for lilac) rather than hex values. There is no dark theme in v1.
- **Type:** Young Serif (`font-heading`, applied to h1–h3 automatically) and Figtree (`font-sans`).
- **Copy:** plain, warm, and brief. Say "you". Error messages say what to do next. Never use these words: *platform, solution, seamless, optimise, invalid*. Better Auth's own error messages break these rules (for example "Invalid email or password"), so map error codes to Tiba copy, as [sign-up](src/app/(auth)/sign-up/page.tsx) does. Don't joke about health or privacy.
