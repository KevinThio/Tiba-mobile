# Launching Tiba

Decided 24 Oct 2026: **United States first**, starting with a **pilot on test data**, hosted on
**Render** (app server, Postgres and the hourly job in one US region). Render can sign a HIPAA
Business Associate Agreement (BAA) on its HIPAA-enabled plans, so the same setup can carry real
patients later without moving.

> **Pilot rule:** until every item under "Before real patients" is done, use made-up patients
> only. Tiba holds protected health information (PHI); HIPAA needs a signed BAA with every
> company that stores or sends it.

## 1. Deploy the pilot

1. **Push the code** to GitHub (`git push origin main`). Keep the repository **private**.
2. **Create a Render account** at render.com and connect your GitHub account.
3. In Render, choose **New → Blueprint**, pick the `Tiba-mobile` repository and the `main`
   branch. Render reads [render.yaml](../render.yaml) and proposes:
   - `tiba-db`: Postgres 17 (US, Oregon), reachable only from the app.
   - `tiba`: the web app. Every deploy runs migrations and loads the diagnosis codes first.
   - `tiba-reminders`: an hourly job for evening reminder emails and 30-day billing alerts.
   - Secrets `BETTER_AUTH_SECRET` and `CRON_SECRET` are generated for you.
4. Render asks for **SMTP_URL**, **EMAIL_FROM** (see step 2 below) and **GEMINI_API_KEY**
   (see "Ask Tiba" below). You can leave them empty for the first deploy: the app works, but
   password resets, invoice emails and reminders won't send, and Ask Tiba says it isn't set up,
   until they're filled in.
5. Click **Apply**. The first deploy takes a few minutes. Open the address Render shows
   (`https://tiba-xxxx.onrender.com`).
6. **Sign up as the admin** of a test practice (the live database starts empty; nothing from
   your computer is copied). Then sign up clinicians with the same practice name and activate
   them under Clinicians.

Plans and prices: the blueprint uses Render's small paid plans (`starter` web service and cron
job, `basic-256mb` Postgres), because free web services sleep and skip the pre-deploy step.
Check render.com/pricing for current prices.

### Or: deploy on Vercel

Tiba is one Next.js app (pages, sign-in, database calls and Ask Tiba together), so on Vercel
the whole app runs there. Vercel keeps no files between requests, so it needs a **hosted
Postgres** database; without `DATABASE_URL` every page fails.

1. **Database:** in the Vercel project, **Storage → Create Database → Neon** (Postgres), in a US
   East region next to the app (`vercel.json` runs the app in `iad1`, Washington DC). Vercel
   adds `DATABASE_URL` to the project. Any Postgres works (Supabase, Render's with outside
   access allowed); use its pooled connection string.
2. **Environment variables** (Settings → Environment Variables, for Production):
   - `BETTER_AUTH_SECRET`: any 32+ random characters (`npx @better-auth/cli secret`).
   - `CRON_SECRET`: another long random string. Vercel sends it to the reminder job itself.
   - `SMTP_URL` and `EMAIL_FROM` (step 2), `GEMINI_API_KEY` (Ask Tiba, below).
   - `BETTER_AUTH_URL` only once a custom domain is connected. Until then Tiba uses the
     project's production address (`your-project.vercel.app`).
3. **Redeploy** (Deployments → ⋯ → Redeploy). Production builds run `vercel-build`
   ([scripts/vercel-build.mjs](../scripts/vercel-build.mjs)): migrations and diagnosis codes
   first, then the build. Preview builds never touch the database.
4. Sign up as the admin of a test practice on the production address.

Notes:
- **Reminders** run once a day at 02:00 UTC (`vercel.json`), which is evening across the US
  and the most often Vercel's free Hobby plan allows. On Pro, change the schedule to
  `0 * * * *` (hourly) so every time zone gets its evening email on time.
- **Sign-in only works on the production address.** Preview deployments
  (`…-git-branch-….vercel.app`) have other addresses, which Better Auth refuses.
- Rate limits (sign-in explanations, reviews, Ask Tiba) are kept per server copy, so they are
  looser on Vercel than on one Render server.
- Vercel signs a HIPAA BAA only on its paid plans with the HIPAA add-on (check vercel.com);
  until then, test data only, as with any pilot.

## 2. Email for the pilot

Tiba sends password resets, invoices, reminders and "you're verified" emails over SMTP. Without a
domain, use a provider that lets you verify a single sender address, for example **Brevo**
(free tier): create an account, verify your email address as a sender, create an SMTP key, then
set on the `tiba` service:

- `SMTP_URL` = `smtps://<login>:<smtp key>@smtp-relay.brevo.com:465`
- `EMAIL_FROM` = `Tiba <the-address-you-verified@example.com>`

Save; Render redeploys. Test with **Forgot password** on the sign-in page.

### Ask Tiba (the help assistant)

The **Ask Tiba** button on the sign-in page and in both apps answers how-to questions using
Google Gemini (`gemini-3.5-flash-lite`, its fastest model; set `GEMINI_MODEL` to use another). It
only gets Tiba's help guide and the question typed: no patient records, and nothing is stored.
Create an API key at aistudio.google.com, **turn on billing for its Google Cloud project** (on
the free tier Google may use prompts to improve its products) and set a budget alert, then set
`GEMINI_API_KEY` on the `tiba` service (or in the Vercel project's environment variables) and
save. Test it from the sign-in
page. Each person is limited to 60 questions per 10 minutes (15 per IP address when signed
out). People are told not to type patient details, but someone might; before real patients,
move the assistant to Gemini on Vertex AI under Google Cloud's BAA, or remove the button.

### Address lookup (clocking in and out)

Clinicians clock in and out of in-person visits from the patient's home, and Tiba compares the
phone's location with the patient's address. To know where an address is, Tiba sends the address
(never the name) to a map service when it's saved. Without a key it uses OpenStreetMap's free
Nominatim, which is fine for test data but has no BAA. Before real patients, create a Google
Maps Platform key with only the **Geocoding API** enabled, restrict it to that API, set
`GOOGLE_MAPS_API_KEY` on the app, and cover it under Google Cloud's BAA. Addresses saved before
the key is set keep their earlier lookup; save them again to look them up with Google.

## 3. Your own web address (when you have a domain)

1. Buy a domain (any registrar: Cloudflare, Namecheap, Google/Squarespace Domains).
2. In Render, `tiba` → **Settings → Custom Domains**: add e.g. `app.yourdomain.com` and create
   the DNS record Render shows. Render issues the HTTPS certificate.
3. Add the environment variable `BETTER_AUTH_URL` = `https://app.yourdomain.com` and redeploy.
   Sign-in, links in emails and the review link then use the new address. Everyone signs in
   again once.
4. Move email to the domain: verify it with your email provider (SPF, DKIM, DMARC records) and
   change `EMAIL_FROM` to `Tiba <notes@yourdomain.com>`.

## 4. Before real patients (HIPAA)

Do all of these before the first real patient's details go in:

- [ ] **Render BAA:** move the workspace to a Render plan with HIPAA-enabled workspaces and sign
      Render's BAA. Confirm the Postgres database and backups are covered.
- [ ] **Email BAA:** emails carry invoices (patient names and visits) and reminders (first name
      and initial). Use an email provider that signs a BAA (for example Paubox, or Amazon SES
      under an AWS BAA), or turn off emailing invoices to patients.
- [ ] **Address lookup BAA:** set `GOOGLE_MAPS_API_KEY` and sign Google Cloud's BAA before
      saving real patients' addresses (see "Address lookup" above).
- [ ] **Your agreements:** Tiba is a business associate of each practice. Have a lawyer prepare
      the BAA you sign with practices, plus Terms of Service and a Privacy Policy.
- [ ] **Risk assessment:** a HIPAA security risk analysis, written policies, and a breach
      response plan.
- [ ] **Access logs:** HIPAA expects a record of who viewed or changed PHI. Tiba records note
      versions, addenda, invoice history and signatures, but not every page view. Add an audit
      log before launch.
- [ ] **Two-factor sign-in** for every admin (Tiba already supports TOTP; consider requiring it).
- [ ] **Backups:** confirm Render's point-in-time recovery on the Postgres plan, and do a
      practice restore once.
- [ ] **Monitoring:** turn on Render's alerts for failed deploys and the cron job, and add error
      tracking that never records PHI.
- [ ] **Remove the pilot data** (start a fresh database) or make sure no test data looks real.
- [ ] **Diagnosis codes:** load the full ICD-10-CM list (public domain in the US):
      `npm run db:seed -- path/to/icd10cm.csv` from a Render Shell.

## Operating notes

- **Deploys:** pushing to `main` deploys automatically. Migrations run before the new version
  goes live; if one fails, the old version keeps running.
- **Rate limits** for sign-in help and patient reviews are kept in memory, so they assume a single
  app instance. Scale vertically (a bigger plan) rather than adding instances, or move the limits
  to Postgres first.
- **Uploaded files** are stored in the database, so database backups include them. If files grow
  large, move them to object storage covered by the BAA.
- **PDF fonts** ship with the app (`next.config.ts` traces them into the PDF routes).
