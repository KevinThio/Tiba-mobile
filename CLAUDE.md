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

First run: copy `.env.example` to `.env.local`, set `BETTER_AUTH_SECRET` (and `CRON_SECRET`; `SMTP_URL` is optional in dev), then run `npm run db:migrate && npm run db:seed`. To reset the local database, delete `.data/` and run those two commands again.

There is no test runner yet.

## Planning documents

- [tiba-product-spec.md](tiba-product-spec.md): the **Version 2** spec (screens, data, rules, open questions). It is the source of truth for features. Items marked "kept from v1.1" were built before v2 and stay in scope.
- [tiba-brand-concept.md](tiba-brand-concept.md): voice and tone. Colours and type come from the design-system tokens in `globals.css`.

## What Tiba is

A responsive web app, installable on phones as a PWA (no native app), where clinicians write and sign visit notes tied to appointments and invoice them. Spec v2 turns it from a solo-clinician tool into a **practice** tool:

- **Two account types:** clinician (own appointments and notes, the shared practice patient list, invoices, their profile and contracts) and administrator (runs the practice: clinician accounts and contracts, every signed note, invoices and payments, insurance billing, patients and duplicate checks, locations, service agreements, performance, notifications, reviews; never writes notes). Patients have no account. They sign on the device and can leave reviews.
- **Clinical scope (20 Oct update):** therapy notes plus SOAP discipline notes (PT, OT, ST, RN/LPN, CNA/HHA) with CPT/G billing codes and the 8-minute rule; initial evaluations that set goals; progress notes that rate them and can prefill from the last signed note; and an aide service plan that must be signed before any aide visit note. Each clinician has a discipline that decides what they can write. Section 11 of the spec has the data model, permissions and acceptance criteria.
- **Spec v2 is mostly not built yet.** Each account is still its own practice: `clinicians` is the Better Auth user table (both account types live in it), and every query is scoped by `clinicianId`. Accounts have a `role` (clinician or admin) and a `country` (US or KE), but there's no shared practice yet, so an admin can't see any clinicians. There's no practices table, discipline, location, structured note sections, drafts, evaluations or goals, duplicate check, notifications, profiles, contracts, performance, reviews or service agreements yet. Introducing a `practices` table (and linking clinicians to an admin's practice) touches every table and query, so plan that migration before building admin screens with real data. How a clinician joins a practice isn't in the spec yet.
- **Built so far:** sign-in (each account type lands in its own app), sign-up as in the v2 prototype (country, account type, logo required for admins, password 8+), the admin app shell with placeholder screens, an Appointments month calendar with booking, the Tomorrow card and reminders, the visit page with letterhead and time in/out, and an Invoices screen with PDF and email. Spec v2 differs in places: a week strip instead of a month calendar, only signed visits invoiceable (code allows any past visit), a due date on invoices, currency from the practice country, and admin invoice statuses (Unpaid, Paid, Issue).

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
- **Gap-free invoice numbers:** in the same transaction that inserts the invoice, run `UPDATE clinicians SET last_invoice_number = last_invoice_number + 1 ... RETURNING` (as `createInvoice` does). Don't use a Postgres sequence, because sequences skip numbers on rollback. `invoice_items.appointment_id` is unique, so a visit can only be invoiced once.

**Invoices screen** (`src/app/(app)/invoices/`):
- The visit list covers the look-back period (`periods.ts`) up to now, across all patients. An invoice is for **one patient**: the first ticked visit decides who, and the server re-checks that, plus that every visit belongs to the clinician, has already happened and isn't on another invoice.
- When an email address is given, `createInvoice` emails the PDF after the transaction commits. A failed send doesn't undo the invoice; it comes back as `emailError`, and the user can resend from Recent invoices. The address is saved to `patients.invoice_email` to pre-fill the next invoice. `invoices.sent_to` and `sent_at` record the send.
- The PDF comes from [src/lib/invoice-pdf.tsx](src/lib/invoice-pdf.tsx) (`@react-pdf/renderer`, built-in Helvetica) with the same letterhead content as `NoteLetterhead`. It's served privately at `/api/invoices/[id]/pdf`. Times print in `clinicians.time_zone`.
- A `"use server"` file may only export async functions, so shared constants such as `PERIODS` live in separate modules.

**Email** ([src/lib/email.ts](src/lib/email.ts)): nodemailer over `SMTP_URL` (any provider), sending from `EMAIL_FROM`. Without `SMTP_URL` in development, emails are written to `.data/outbox/*.eml`; open them in a mail app to check them. Production throws `EmailNotConfiguredError`, which the actions turn into friendly copy. Build bodies with `renderEmail()`. Never log email contents or recipients.
- Hand-written SQL (extensions, triggers) goes in `npm run db:generate -- --custom --name <name>` migrations. `0000_init.sql` was edited to start with `CREATE EXTENSION pg_trgm`.

**Search** uses the `pg_trgm` GIN indexes on `patients.full_name` and `diagnosis_codes`. For typo-tolerant name search, use `word_similarity(q, full_name) > 0.3 OR full_name ILIKE '%'||q||'%'`, ordered by `word_similarity`. The default `%` operator compares against the whole name and misses typos like "amna" for "Amina Wanjiru".

**Diagnosis codes:** [data/diagnosis-codes.sample.csv](data/diagnosis-codes.sample.csv) is a small sample (ICD-10, F/Z codes). The full list depends on the market: WHO ICD-10 needs a licence, while ICD-10-CM (US) is public domain.

**Auth** ([src/lib/auth.ts](src/lib/auth.ts)):
- Email and password with at least 8 characters (spec v2), plus optional TOTP 2FA.
- **Account types:** `role` and `country` are Better Auth additional fields set at sign-up. The role can never change: the `databaseHooks.user.update.before` hook refuses any update that includes `role` (a hook's returned data is merged into the original, so it can't just drop the field), and a trigger in [drizzle/0005_lock_account_role.sql](drizzle/0005_lock_account_role.sql) blocks it in the database too. Admins must have a practice logo: sign-up asks for it and `updatePractice` won't remove it.
- **Routing by role:** `/` sends each account home with `homeFor(role)` (`/appointments` or `/admin`), and sign-in, two-factor and sign-up all go to `/`. Clinician pages use `requireClinician()`, which sends admins to `/admin`; admin pages (`src/app/admin/`) use `requireAdmin()`, which sends clinicians back. `requireAccount()` accepts either and is only for things both share, like practice details.
- Sessions expire after **30 minutes of inactivity** (`expiresIn` + `updateAge`), because the device is handed to patients.
- [src/proxy.ts](src/proxy.ts) (Next 16's renamed middleware) only checks that a session cookie exists. **Every page and Server Action that reads patient data must call `requireClinician()` (or `requireAdmin()` in the admin app).**
- Better Auth rejects requests whose `Origin` isn't `BETTER_AUTH_URL` with an "Invalid origin" error. In development `trustedOrigins` also allows `127.0.0.1` and LAN addresses (`192.168.*`, `10.*`), and `next.config.ts` has matching `allowedDevOrigins`. This means a phone on the same Wi-Fi can use the Network URL that `next dev` prints. Production trusts only `BETTER_AUTH_URL`.

**Routes:**
- `src/app/(auth)/` holds sign-in, sign-up, and the 2FA step.
- `src/app/admin/` is the admin app: its layout calls `requireAdmin()` and renders `AppShell app="admin"` (practice logo and name at the top, the prototype's grouped menu, phone tabs Overview, Patients, Billing and More). `ADMIN_SECTIONS` in `nav-items.ts` lists every admin screen with its header copy; `admin/[section]/page.tsx` shows a placeholder for any section not built yet, so a built screen just gets its own folder. Overview, Settings and More have their own pages.
- `src/app/(app)/` holds the clinician app's signed-in screens; its layout calls `requireClinician()` and renders `AppShell`. The clinician nav follows the v2 prototype: Appointments, Notes to do, Patients, Invoices (kept from v1.1), Contracts, Notifications, Profile and Settings. `/patients`, `/notes`, `/contracts`, `/notifications` and `/profile` are placeholders until each screen is built, and `/settings` so far only has practice details and sign out. The visit note is opened from an appointment or a draft, so it has no nav entry. Build screens in the order in spec section 11, using the details in spec section 14.
- Better Auth's handler is at `src/app/api/auth/[...all]`.

**Appointments screen** (`src/app/(app)/appointments/`):
- Server Actions live in `actions.ts`: list (for the calendar's visible range), patient search, care types with their last fee, and create. Every one starts with `requireClinician()` and filters by `clinicianId`.
- The calendar is FullCalendar 7 (`@fullcalendar/react`, classic theme). The theme's CSS classes are **minified**, so style it only through the palette variables in `calendar.css`, the `dayCellClass`/`eventContent` hooks, and `[data-date]` attributes. `dateClick` listens for pointer events, so a synthetic `.click()` won't trigger it.
- Times: the browser turns its local date and time into an ISO instant before calling the server, and the server stores `timestamptz`. Display always uses the viewer's local time.
- `/appointments/[id]` is the Visit note screen. So far it shows the letterhead (`NoteLetterhead`: practice logo, practice name and clinician), the visit details, **Visit times** and blank signature lines. Writing and signing come next.
  - **Time in and time out** (`appointments.time_in`/`time_out`) are recorded with `setVisitTimes` in `visit-times.tsx`. The one-tap "now" buttons appear only on the visit day; a typed time always counts as being on the visit's day. A check constraint requires time out to be after time in, and a trigger in `drizzle/0003` locks both times (and `starts_at`) once the note is signed. Before signing, the times show as editable inputs; after signing, they print in the details grid, on the note PDF and on invoices.
- **Tomorrow card and reminders** (`tomorrow-card.tsx`, `reminder-actions.ts`, [src/lib/reminders.ts](src/lib/reminders.ts)): "Email me tomorrow's list" sends immediately. The evening reminder is `clinicians.reminder_emails` plus `time_zone`, which is saved from the browser. `GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` sends at most one email per clinician per local day, after 6 pm in their time zone, so call it **hourly** from a scheduler (Vercel Cron, a GitHub Action, cron-job.org). Reminder emails show patients as "Amina W." only. Time-zone maths uses `temporal-polyfill`. The PDF must reuse the same letterhead layout. Show dates and times on server-rendered pages with `LocalDateTime`, because the server doesn't know the viewer's time zone.

## Design system

- **Tokens** live in [src/app/globals.css](src/app/globals.css). Primitives in `src/components/ui/` are shadcn (Base UI), resized for the brand:
  - **Controls are 48px** (`h-12`), small ones 40px (`size="sm"`, `h-10`). The design system's minimum tap target is 44px.
  - **Buttons** are pills (`rounded-full`) with a 1.5px border and semibold text. Variants: `default` (fern), `secondary` (fern-100), `outline` (white, fern-300 border, fern text), `ghost` (fern text), `destructive`. Disabled is ink-100 with ink-400 text, not faded.
  - **Inputs, selects and text areas** are `rounded-md` (12px) with a 1.5px `border-input` (ink-300). On focus the border turns fern (`border-primary`) and the lilac ring shows. Placeholders are `text-subtle-foreground`.
  - **Badges** are 26px pills, 13px semibold, with `success`, `info`/`accent`, `warning`, `danger`, `neutral` and `outline` variants.
  - **Cards** are `rounded-lg` (16px) with `border-border-subtle` and `shadow-sm`. Dialogs and sheets are `rounded-xl` (24px) with `shadow-lg`. The checkbox is 20px with a 6px radius.
  - The spec's **Design system additions** (section 11: choice chips, measures grid, level rows, billing codes table, combobox, signature pad, notice banners, skeletons and more) don't exist yet. Build them as shared components in `src/components/` when the screens that need them are built.
  - The toast (`toast()` from `sonner`) is mounted once in the root layout, top-centre, light only.
- **Tiba components** live in `src/components/`:
  - [app-shell.tsx](src/components/app-shell.tsx): shared by both apps (`app="clinician"` or `"admin"` picks the navigation, because icon components can't be passed from a server layout). A side menu on `md` and up (footer: practice identity plus a sign-out icon); on phones, a top bar (logo plus the clinician's initials, which open Account) and a bottom tab bar. It respects the iPhone safe-area insets.
  - [nav-items.ts](src/components/nav-items.ts): `NAV_ITEMS` (desktop menu) and `TAB_ITEMS` (phone tabs Visits, Notes, Patients, Account). The Account tab is `/settings`; its `also` list keeps the tab lit on Profile, Contracts, Notifications and Invoices, which phones reach from the Account screen.
  - `PageHeader`: optional `back` link and `overline`, the title, a help line and actions. Start every screen with it, copying the overline and title from spec section 14.
  - `PracticeMark` (logo or initials in a frame, plus `initialsOf`) and `SignOutButton` (`iconOnly` for the side menu).
  - `EmptyState`: friendly "nothing here yet" panels.
  - `FormField`: a label, an input and an optional `hint`. Pass `input` to use another control.
  - `PasswordInput`: has a show/hide toggle.
  - `FormAlert`: the form-level error box.
  - `LogoUpload`: picks and resizes the practice logo. It's used on sign-up and in `PracticeDetailsDialog`, which opens from Settings.
  - `Logo`.
- **Sign-in screens:** [src/app/(auth)/layout.tsx](src/app/(auth)/layout.tsx) shows the brand panel beside the form on `lg` screens and only the logo plus form on smaller ones. Start each auth page with `AuthHeading`.
- **Stale styles in dev:** a utility class used for the first time in a file created while `npm run dev` is running may be missing from the served CSS (an element stays hidden or unstyled). Restart the dev server before debugging it.
- **Shell sizes:** the phone top bar is 64px (`h-16`) and the tab bar is 72px with `shadow-up` instead of a border. Bars that sit above the tab bar use `bottom-[calc(72px+env(safe-area-inset-bottom))]`. Page gutters are 20px on phones (`px-5`) and 40px on desktop (`md:px-10`). Auth and settings forms use `max-w-form` (480px).
- **Phone layout:** `main` has bottom padding (`pb-28`) so content clears the bottom tab bar. Keep it if you change the shell. Use `grid-cols-1` (which is `minmax(0, 1fr)`) on page-level grids. A plain `grid` column grows to its widest content, and on phones that silently widens the whole page (`innerWidth` grows past the device width; it was 566px instead of 390px), so check `window.innerWidth` at 390px, not just horizontal scroll.
- **shadcn gotchas:**
  - `shadcn add` writes `import { cn } from "cn"` and installs the `cn` package (plus `next-themes` for sonner). We use `cn` from `@/lib/utils` (clsx + tailwind-merge) and have no theme switching, and ESLint errors on the `cn` import. After adding a component, fix its imports and `npm uninstall cn next-themes`.
  - Components that depend on `button` stop at a prompt asking to overwrite it. Back up `src/components/ui/button.tsx`, run `shadcn add <name> -y --overwrite`, then restore the button.

**Dependencies** are pinned to exact versions that were at least two weeks old when added. Keep new ones pinned the same way.

## Private health information

Everything sits behind the login. Never put patient data in logs, URLs, query strings, or analytics. Dev mode would log every Server Action's arguments; `logging.serverFunctions: false` in `next.config.ts` turns that off, so keep it. `.data/` holds the local database and is git-ignored. Hosting is not decided yet: it depends on the market (Kenya Data Protection Act and/or HIPAA with a BAA).

## Brand rules that affect code and copy

- **Palette:** [src/app/globals.css](src/app/globals.css) mirrors the design-system tokens: the scales (`--fern-50…900`, `--lilac-50…700`, `--ink-50…900`, `--red-*`, `--amber-*`) plus semantic names. Components use the semantic utilities only:
  - **Actions:** `bg-primary` (with `hover:bg-primary-hover`, `active:bg-primary-press`), `bg-secondary`, `bg-destructive`.
  - **Surfaces:** `bg-muted` (panel), `bg-accent` (lilac), `bg-sunken`.
  - **Text:** `text-muted-foreground`, `text-subtle-foreground`, `text-accent-foreground`.
  - **Borders:** `border-border` (default), `border-border-subtle` (cards, bars), `border-border-strong`, `border-border-action` (outline buttons).
  - **Disabled:** `bg-disabled`/`text-disabled-foreground`. Secondary buttons press to `bg-secondary-press`.
  - **Status pairs:** `bg-success`/`text-success-foreground`, and the same for `info`, `warning`, `danger` and `neutral`. Badge has matching variants.
  - **Focus:** the ring is 3px lilac-300 (`ring-ring`, at full strength).
  - **Radii** follow the design system: `rounded-xs` 6px, `rounded-sm` 10px (rows inside panels), `rounded-md` 12px (controls, alerts, small panels), `rounded-lg` 16px (cards), `rounded-xl` 24px (dialogs, sheets), `rounded-full` (buttons, badges, chips). Don't use `rounded-2xl` or larger.
  - **Shadows:** `shadow-xs`, `shadow-sm` (cards), `shadow-md` (hover, menus), `shadow-lg` (dialogs), `shadow-up` (bottom bars). Motion uses `ease-out` with 120ms (controls) or 200ms (cards, toggles).
  - Never write hex values in components; the email and PDF templates are the only exception, because they can't read CSS variables. There is no dark theme.
- **Type:** Young Serif (`font-heading`, applied to h1–h3 automatically, weight 400) and Figtree (`font-sans`). The design-system scale is available as `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-title`, `text-body-lg`, `text-body`, `text-small`, `text-caption` and `text-overline` (each sets its own line height).
- **Layout:** the desktop layout starts at **860px**, because the `md` breakpoint is overridden in `globals.css`. Content is capped at **1120px** (`max-w-content`). Dates read "12 Sep 2026". Currency follows the practice country ($80.00 or KSh 8,000) once v2's country setting exists.
- **Copy:** plain, warm, and brief. Say "you". Error messages say what to do next. Never use these words: *platform, solution, seamless, optimise, invalid*. Better Auth's own error messages break these rules (for example "Invalid email or password"), so map error codes to Tiba copy, as [sign-up](src/app/(auth)/sign-up/page.tsx) does. Don't joke about health or privacy.
