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
4. Render asks for **SMTP_URL**, **EMAIL_FROM** (see step 2 below) and **ANTHROPIC_API_KEY**
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
Claude. It only gets Tiba's help guide and the question typed: no patient records, and nothing
is stored. Create an API key at console.anthropic.com (add a small credit balance and a monthly
spend limit), set `ANTHROPIC_API_KEY` on the `tiba` service and save. Test it from the sign-in
page. Each person is limited to 60 questions per 10 minutes (15 per IP address when signed
out). People are told not to type patient details, but someone might; before real patients,
ask Anthropic about a BAA covering the API, or remove the button.

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
