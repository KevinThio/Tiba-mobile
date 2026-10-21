# Tiba: Product Spec (Version 2)

Updated 20 Oct 2026 (profiles, contracts, duplicates, invoices, performance, build guide) · Draft for review · Replaces Version 1

Tiba is a website, used on phone and desktop, where clinicians keep every patient visit note in one place: tied to an appointment, signed, easy to find and ready to invoice. Version 2 adds a second kind of account, the **administrator**, who runs a practice with several clinicians, locations and insurers.

Core action is unchanged: *write and sign a note for a patient visit.*

> Items marked **(kept from v1.1)** were requested and built after Version 1 and are not in the Version 2 design files. They stay in scope unless removed.

## 1. What changed

### Since Version 1

| Area | Version 1 | Version 2 |
|---|---|---|
| Accounts | One login: the clinician | Two account types: clinician and administrator. Sign-in checks the type and opens the right app. |
| Sign up | Name, email, password | Adds practice name, country, type of account and practice logo (optional for clinicians, required for admins). |
| Visit notes | One free-text box | Sections that change with the type of care: therapy notes, plus PT, OT, ST, skilled nursing (RN or LPN) and CNA / home health aide notes. Tiba writes the finished note after signing. |
| Care plans | Not covered | Initial evaluations set goals, progress notes rate them, and an aide service plan must be signed before aide visits. |
| Unsigned notes | Not covered | Saved as drafts automatically. Listed with finished visits that still need a note. |
| Screens | Appointments, Visit note, Patient record | A full clinician app and a full admin app (see sections 4 and 5), plus sign up and a patient review page. |
| Patients | Signed on the device | Also leave reviews for the practice from the sign-in page, with no account. |
| States | Normal only | Every screen has live, loading and error versions. |
| Practices | Solo clinicians only | Group practices with several clinicians and locations. |
| Currency | Not set | Set by the practice country: US dollars or Kenyan shillings. |

### In the 20 Oct update

| Area | Change |
|---|---|
| Clinician profiles | New **Profile** screen: discipline, licence, education, certifications and documents (resume, W-9). Admins see it on each clinician's page. |
| Contracts | Admins create, sign and send contracts on the practice letterhead. Clinicians sign them or reply with a message. |
| Duplicate patients | Same name and date of birth shows a warning before saving. Clinicians can save with a flag for the admin to check; admins confirm or merge. |
| Invoices (admin) | Statuses are now **Unpaid**, **Paid** and **Issue**, with Record payment, Flag issue and Resolve issue. Overdue is a red label on Unpaid after 30 days. |
| Notifications | One list for each account type, with counts on the menu. |
| Performance | New admin screen: admissions, invoices, paid vs unpaid, missed visits and reviews per clinician. |
| Navigation | Clinician phone tabs are Visits, Notes, Patients and Account. Admin menu adds Notifications, Performance and Contracts. |
| Reviews | Patients can name the clinician they saw ("Who did you see?"). |
| Build guide | Data model, permissions, acceptance criteria and new design-system patterns (section 11). |
| Joining a practice | Clinicians sign up with their practice's name and wait until the practice admin verifies (activates) them (section 3). |
| Forgot password | Sign in links to a page that emails a reset link to registered emails only (section 3). |

## 2. Who uses Tiba

| Person | Account | What they do |
|---|---|---|
| Clinician | Regular account | Sees their own appointments and patients, writes and signs notes, sends invoices, keeps their profile up to date and signs contracts. |
| Administrator | Admin account | Runs the practice: clinician accounts and contracts, every signed note, invoices and payments, insurance billing, patients and duplicates, locations, service agreements, performance and reviews. Does not write visit notes. |
| Patient | None | Signs notes and service agreements on the clinician or admin device. Can leave a review of the practice. May receive invoices by email. |

## 3. Accounts and access

### Sign in
- Email and password, plus "Keep me signed in".
- Tiba looks up the account type and opens the clinician app or the admin app.
- Unknown email: "We couldn't find an account for that email. Check it, or create one below."
- Links: **Create an account**, **Leave a review** (patients) and **Check reviews from patients**. The last asks for an admin sign-in and opens Reviews. A clinician who uses it is told only the admin can see reviews.

### Forgot password
- **Forgot password?** sits under the password field on Sign in and opens a page that asks for the account's email.
- **Unregistered emails are not accepted:** "We couldn't find an account for that email. Check it, or create an account." Nothing is sent. (This tells people whether an email has an account, as sign in and sign up already do.)
- For a registered email, Tiba emails a **reset link** and shows "Check your email" with the address. The link works **once, within 1 hour**. Asking again within a minute is held back: "We sent you a link a moment ago…".
- The link opens **Set a new password**: new password (at least 8 characters) typed twice. Saving changes the password and **signs the account out on every device**; then "Your password is changed" with **Sign in**.
- A used or expired link shows "This link has expired" with **Send a new link**.

### Sign up

| Field | Rule |
|---|---|
| Your name | Required. |
| Email | Required and must include an @. Must not belong to an existing account. |
| Password | At least 8 characters. |
| Type of account | Clinician or Administrator. Required. Asked before the practice name, because the fields below depend on it. |
| Practice name | Required. An administrator creates the practice with this name; a clinician joins the practice with this name (see **Joining a practice**). |
| Country | Administrators only: United States or Kenya. Sets the currency ($ or KSh). Clinicians use their practice's country. |
| Practice logo | Administrators only, and required: "Admins need to add the practice logo." Clinicians use their practice's logo. |

The practice name and logo form the **letterhead** at the top of every signed note, invoice, service agreement and contract, on screen and in the PDF. With no logo, the letterhead shows the practice name (contracts show initials and ask the admin to add a logo).

### Joining a practice
A practice is created by its administrator. Clinicians join it by signing up with the same practice name, and their account stays **inactive until the admin verifies it**.

| Step | What happens |
|---|---|
| Admin signs up | Creates the practice and is active straight away. If a practice with that name is already on Tiba: "A practice called "Reyes Therapy" is already on Tiba. If it's yours, sign in instead. If not, add something to tell it apart, like the town." |
| Clinician signs up | Types the practice name. Names match ignoring case, spaces and punctuation ("reyes therapy." joins "Reyes Therapy"). The account is created as **Waiting for verification**, the admin gets an email, and the clinician sees "Waiting for your admin". |
| No such practice | "We couldn't find a practice called "…". Check the exact name with your practice admin. They need to create the practice on Tiba first." No account is created. |
| Practice has no admin | (Practices made before Version 2.) ""…" doesn't have an admin on Tiba yet, so nobody can verify you. Ask your practice to create an admin account first." |
| While waiting | The clinician can sign in but only sees the waiting page ("Check again", "Sign out"). They can't see patients, appointments or invoices. |
| Admin verifies | On **Clinicians**, the admin taps **Activate**. The clinician is emailed ("You're verified at …") and their next visit opens Appointments. **Not now** leaves them inactive (shown as Deactivated); the admin can activate them later. |
| Admin deactivates | Asks to confirm. The clinician is signed out everywhere at once, can't see patients, and sees "Your account is turned off" if they sign in. Their notes are kept. **Activate** turns the account back on. |

Account statuses: **Waiting for verification** (pending) → **Active** ⇄ **Deactivated**. Only the practice admin changes them; nobody can change their own status, practice or account type.

### Sign out
Available on every device: Settings on desktop, the Account tab on the clinician phone app, the account area of the desktop side menu, and the More screen in the admin phone app. Sign-out always returns to the sign-in page.

## 4. Clinician app

**Phone:** top bar and bottom tabs: **Visits**, **Notes** (badge: notes to do), **Patients** and **Account** (badge: new notifications). Account holds Profile, Contracts, Notifications and Settings.

**Desktop:** side menu with **Appointments**, **Notes to do** (badge), **Patients**, **Invoices** (kept from v1.1), **Contracts** (badge: waiting to sign), **Notifications** (badge: new), **Profile** and **Settings**, plus a live **Drafts** list (patient name, type of care · sections done, e.g. "Physical therapy · 6 of 10"). The footer shows the clinician and practice with a sign-out button. The phone top bar shows the Tiba logo and the clinician's initials, which open Account.

| Screen | What it does |
|---|---|
| Appointments | A week strip with a dot for days that have notes to do. The day's visits, each with a status; "Back to today" when another day is picked. A reminder links to Notes to do. **Tomorrow card (kept from v1.1):** number of visits tomorrow, "Email me tomorrow's list", and an optional evening reminder (6 pm in the clinician's time zone, sent to their sign-in email, patients shown as first name and initial). |
| Notes to do | Two lists: finished visits with no note yet, and drafts (started but unsigned) with sections done and last edit. "All caught up" when both are empty. |
| Visit note | Type of care, diagnosis code and the sections for that type of care (section 4a). Also used for initial evaluations and the aide service plan (section 4b). Progress bar. Saves as a draft as you type. "Save draft" or "Continue to sign". **Time in and time out (kept from v1.1):** one tap on the day of the visit, or type the times; time out must be after time in. |
| Sign note | Summary of the answers. Clinician signs; the patient signs too if that setting is on. "Sign and save". |
| Signed note | Locked: "Signed at 11:22 by you and Joseph. Signed notes are locked. Add an addendum if something changes." Shows the letterhead, the note Tiba wrote from the sections ("Written up from your sections"), the original answers, time in and time out, and both signatures. Download PDF and Create invoice (hidden once invoiced). The note and the visit times can't be changed after signing. |
| Patients | Every patient in the practice, with search. Flags patients with a note to do and patients the admin is checking as possible duplicates. Add patient. |
| Patient record | Age and "Your patient since". Details, diagnosis codes, **Care team** card (services ordered, which evaluations have set goals, aide service plan status), visits with status. Download PDF, Write note or Finish note, Create invoice. |
| Invoice | Pick signed visits not yet invoiced, "Send to" email and "Payment due" (Due on receipt, Due in 14 days or Due in 30 days). Shows the total. "Send invoice". **(kept from v1.1):** list filtered to the last week, 2 weeks, month, 2 months or 6 months; one patient per invoice with "tick all"; the invoice PDF is emailed automatically to the address entered, which is remembered for that patient; invoices can be emailed again. |
| Add patient | See **Patients** in section 4b. Runs the duplicate check (section 5b). |
| Notifications | New contracts to sign, admin replies on contracts, invoice issues flagged by the admin. "Mark all as read". |
| Contracts | Contracts from the practice, with "Waiting for you" first. |
| Contract | The contract on the letterhead, a message thread with the admin, and "Sign and send back" (or Download PDF once signed). |
| Profile | About you, Education, Certifications and Documents (section 5c). "Save profile". |
| Settings | Your role (discipline), Notes and signing ("Patients sign each note"), Invoicing (visit fee), country (sets the currency), privacy line, Sign out. |

### Visit status
**Upcoming** → **Needs note** (visit finished) → **Draft** (note started) → **Signed** → **Invoiced**. A visit can also be **Missed** (counted in Performance). An aide visit for a patient with no signed aide service plan shows **Needs plan** instead of Needs note or Draft. In Notes to do, a draft with every section filled shows **Ready to sign** instead of its section count.

| Status | Badge |
|---|---|
| Upcoming | Outline (grey border) |
| Needs note, Needs plan | Warning (amber) |
| Draft | Neutral (grey) |
| Ready to sign, New | Info (lilac) |
| Signed, Paid, Billed | Success (fern) |
| Overdue, Issue | Danger (red) |

### Diagnosis code field
A type-to-filter list used everywhere a code is picked (visit note, add patient). Typing a code (F41) or words (anxiety, panic) narrows the list as you type. Arrow keys move through the matches, Enter picks one, Escape closes the list. The field can be cleared.

## 4a. Note sections by type of care

### Therapy notes

| Type of care | Sections |
|---|---|
| Individual therapy | Mood today (pick one) · What you worked on (pick any) · Approaches used (pick any) · What happened (text) · Risk check (pick one) · Plan and homework (text) |
| Couples therapy | Who attended · What you worked on · Approaches used · What happened · Risk check · Plan and homework |
| Assessment | Reason for referral · How they presented · Relevant history · Risk check · Initial formulation · Recommendation |
| Follow-up call | Reason for call · Update · Risk check · Agreed next step |

### Discipline notes: PT, OT, ST, skilled nursing, CNA / HHA

These note types are grouped in SOAP order: **Subjective, Objective, Assessment, Plan**, then **Billing**. On desktop a section outline sits beside the note with a done count per group; on phone the groups show as chips that jump to each part.

| Type | Sections |
|---|---|
| Physical therapy | S: what they told you, pain (today, best, worst). O: measurements (range of motion, strength, Timed Up and Go), treatment given, response. A: goal progress, assessment. P: plan, visits per week. Billing: 97110, 97140, 97112, 97116, 97530 with minutes. |
| Occupational therapy | S: what they told you. O: help needed with daily tasks (Independent, Supervision, Min, Mod or Max assist), grip and nine-hole peg, treatment given. A: goal progress, assessment. P: plan, visits per week. Billing: 97535, 97530, 97110, 97112, 97763 with minutes. |
| Speech therapy | S: what they or their family told you. O: areas worked on, accuracy per target and trials, level of help. A: goal progress, assessment. P: plan, home practice. Billing: 92507, 92526, 92609 (once per visit). |
| Skilled nursing (RN or LPN) | Same SOAP layout: what the patient or family said, pain, vital signs (temperature, pulse, respiration, blood pressure, oxygen, weight, blood sugar), body systems (normal, changed, not checked), wound size (optional), skilled care given, medicine review, goal progress, assessment, homebound status, teaching given, doctor contacted, plan, and G0299, G0300, G0162 and G0495 in 15-minute units. |
| CNA or home health aide visit | Follows the agency's paper form, in six numbered parts: (1) visit time arrived and left with total time, purpose, diet; (2) vital signs including blood pressure on both arms, skin, body area affected, thinking and alertness; (3) daily living tasks for cooking and eating, bathing and hygiene, mobility, dressing and grooming, each marked No help, Device, Standby, Min, Mod, Max or Total; (4) medicine help, medicines and times, meal log; (5) companion care and home help tasks; (6) other observations and the daily narrative. The aide and the patient both sign. Only tasks done that day need marking. |

- Every section must be filled before signing. Missing sections are named: "Fill 2 more sections to sign: …".
- Changing the type of care swaps the sections. Answers to shared sections stay.
- Timed codes add up minutes and show billable units using the 8-minute rule. Untimed codes are Add toggles.
- Goal names are samples; in the real product they come from each patient's plan of care.
- The arrived and left times on discipline notes are the visit's **time in and time out**.
- After signing, Tiba turns the answers into a written note. The prototype uses a fixed sentence pattern per type of care. Version 2 needs a decision on whether to use AI writing.

## 4b. Evaluations, progress notes and the aide service plan

Discipline care runs in three steps: an **initial evaluation** sets the goals, **progress notes** rate those goals at each visit, and, when a home health aide is ordered, an **aide service plan** must be signed before any aide visit can be documented.

### Initial evaluations

| Evaluation | Sections | Codes |
|---|---|---|
| PT evaluation | S: reason for referral, history, medical history, prior function, home setup, what they want back. O: pain, range of motion and strength, Timed Up and Go, Berg, 30-second chair stand, mobility levels. A: assessment, complexity, rehab potential, goals. P: visits, duration, planned treatment. | 97161, 97162, 97163 |
| OT evaluation | S: occupational profile, history, prior function, home setup. O: daily task levels, grip and nine-hole peg, thinking and safety. A: assessment, complexity, goals. P: visits, duration, planned treatment. | 97165, 97166, 97167 |
| ST evaluation | S: case history, areas of concern. O: tests given, standard score, percentile, intelligibility, oral mechanism. A: assessment, severity, goals. P: visits, duration, home program. | 92521, 92522, 92523, 92610 |
| Skilled nursing start of care (RN) | S: reason for home care, medical history, why homebound. O: vital signs, body systems, wound (optional), MAHC-10 fall risk, medicine list check. A: assessment, goals. P: services to request, visit plan, emergency plan. | G0299 |

- Each goal has text, short- or long-term, and a target (2, 4, 8 or 12 weeks). At least one goal is needed to sign.
- Goals come only from a signed evaluation in the same practice.

### Progress notes
- **Goal progress** lists the goals from the latest signed evaluation for that discipline, each rated **Met**, **Progressing** or **Not yet**, with the evaluation date and author shown. With no signed evaluation, the section says so instead.
- **Prefill from last visit** appears on every progress note. It copies the latest signed note of the same type for the same patient, and the clinician then edits anything. Billing minutes and visit times are not copied. A banner shows where the copy came from, with Undo.
- Prefill works across clinicians in the same practice. If the only earlier notes are from another practice, the button is replaced by: "Notes from other practices can't be copied."

### Aide service plan
A separate note with its own screen, one per patient, following the home health aide care plan the agency uses to direct aide work (frequency, precautions, tasks and supervision).

| Part | What it records |
|---|---|
| 1. Orders | Aide visits per week, for how long, visit length. |
| 2. Safety | Precautions, activity allowed, diet, and when to call the nurse or therapist (temperature, pulse, blood pressure, blood sugar limits). |
| 3. Personal care | Bath type; each task (bathing, hair, mouth, shaving, skin, nails file only, dressing, toileting, catheter care) set to Every visit, As needed or Not needed. |
| 4. Mobility and meals | Transfers, walking help, range of motion, turning; meal prep, help with eating, fluids. |
| 5. Home and medicines | Housekeeping, laundry, linens, errands; medicine reminders only. |
| 6. Goals and supervision | Goals of aide care, what to report right away, supervisory visit every 14 days (skilled care ongoing) or every 60 days (aide only). |

| Rule | Behaviour |
|---|---|
| Who writes it | RN when skilled nursing is ordered. PT or OT only when no nurse is ordered and PT or OT is on the case. Anyone else sees why they can't, with no edit controls. |
| Aide visits | An HHA / CNA visit note is locked until the plan is signed. The lock explains why and links to the plan or the care team. |
| Signing | Author and patient both sign. The patient record shows plan status and who wrote it. |

### Patients
- Admins and clinicians can both add patients. **Add patient** records full name (required), date of birth, phone, email, diagnosis code, services ordered (skilled nursing, PT, OT, ST, home health aide, social work) and the ordering doctor. An aide can't be ordered without a nurse, PT or OT on the case.
- Clinicians add from their Patients list or from a search with no match. Admins also set the assigned clinician, insurer, date of referral and start of care (optional). Insurers depend on the country: Self-pay, Aetna, Blue Cross Blue Shield, Cigna, UnitedHealthcare, Medicaid, Medicare (US); Self-pay, SHA (Social Health Authority), AAR Insurance, Britam, Jubilee Health, CIC Insurance, Madison (Kenya). Every new patient joins the practice list for everyone.
- Every add runs the **duplicate patient check** (section 5b).
- Each clinician sets their **discipline** in Settings or Profile (RN, LPN, PT, OT, SLP, HHA / CNA, mental health). It decides which notes and plans they can write.

## 5. Admin app

**Desktop:** side menu in four groups:
- (top) **Overview**, **Notifications**, **Performance**
- **People:** Clinicians, Patients
- **Work:** Appointments, Completed notes, Invoices, Insurance billing
- **Practice:** Contracts, Locations, Patient reviews, Settings

The top shows the practice logo and name; the bottom shows the admin name and Sign out. Menu items show badges: Notifications (everything new), Patients (duplicate flags), Clinicians (deactivated), Invoices (new), Insurance billing (over 30 days), Contracts (unseen replies and signatures), Patient reviews (new).

**Phone:** tabs for **Overview**, **Patients**, **Billing** and **More**. More lists Notifications, Contracts, Performance, Invoices, Clinicians, Appointments, Completed notes, Locations, Patient reviews and Settings, each with a one-line summary.

| Screen | What it does |
|---|---|
| Overview | Practice logo, name and admin name. "Needs your attention": clinicians waiting to be verified, notes unbilled 30+ days, agreements waiting for the admin, deactivated accounts, new reviews, new invoices, possible duplicates, contract replies and signatures. Today's visits across the practice. |
| Notifications | New invoices, possible duplicates, new reviews, notes unbilled for 30+ days, and contract messages and signatures. Each item opens the screen where it's handled. |
| Performance | See section 5b. |
| Clinicians | **Waiting for you to verify**: clinicians who signed up with the practice name, with **Activate** and **Not now**. Then every clinician with Active or Deactivated status, with **Deactivate** (asks to confirm) or **Activate**. See **Joining a practice** in section 3. |
| Clinician profile | Details (role, email, phone, registration, location, joined). Qualifications, Education, Certifications and Profile documents from the clinician's profile, all downloadable. Account active toggle; deactivating asks to confirm and keeps their notes. Emergency contact (name, relationship, phone). Documents. Send contract. |
| Patients | Active and Discharged tabs, search, assigned clinician, agreement status, "Admin checking" for possible duplicates. Add patient. |
| Add patient | As for clinicians, plus assigned clinician, insurer, date of referral and start of care. |
| Duplicate review | Existing record and new entry side by side (section 5b). |
| Patient details | Details, date of referral, start of care, assigned clinician, Discharge or Reactivate, clinical documents, service agreement. |
| Service agreement | Filled from the patient and practice details. Patient and admin both sign on the device ("Save signatures"). Downloadable as a PDF once fully signed. |
| Appointments | Upcoming visits for every clinician, grouped by day, filter by clinician. |
| Completed notes | Every signed note, newest first, filter by clinician, with billed status. Opens the note, with Download PDF and Mark as billed. |
| Invoices | Every invoice clinicians have sent, in **Unpaid**, **Paid** and **Issues** tabs with counts and a clinician filter. New invoices carry a "New" badge until opened, or "Mark all as seen". |
| Invoice | Patient, clinician, amount, status and history. Record payment, Flag issue, Resolve issue, Download PDF (section 5b). |
| Insurance billing | "Waiting to bill" and "Billed", each oldest first. Rows over 30 days are red. Send reminder. |
| Contracts | Every contract with its status, in tabs All, Waiting, Messages, Signed and Drafts, with counts. New contract. |
| New contract | Create or update a contract with a live preview on the letterhead. "Save draft" or "Sign and send". |
| Contract | The contract, its status and the message thread. Continue editing (draft), Update and resend (sent or message), Download PDF (signed). |
| Locations | Every location and its address. Add location. |
| Add location | Name, type of facility (Outpatient clinic, Community centre, Hospital-based, Telehealth, Home visits; pick one), address (required, except Telehealth) and at least one service (Individual therapy, Couples therapy, Family therapy, Assessment, Group therapy, Follow-up call, plus Physical therapy, Occupational therapy, Speech therapy, Skilled nursing, Home health aide for discipline practices). Two locations in a practice can't share a name. Files can be added once it exists. |
| Location profile | Address and clinicians there, type of facility, type of services, and PDF files with a short description that can be downloaded or removed. Remove location asks to confirm; clinicians based there are moved to a location you pick. The last location can't be removed. |
| Patient reviews | Average rating and every review, newest first, with the clinician named if the patient picked one. Admin only. |
| Settings | Practice name, country (sets the currency), admin name, practice logo (required), contract letterhead details (address, phone, email), Sign out. "Save changes". |
| More (phone) | The menu items that don't fit in the tabs. |

### Insurance billing rules
- A note counts as waiting from the day it is signed until it is marked as billed to insurance.
- Both lists sort oldest first. Waiting rows show the days waited; red after 30 days.
- **Send reminder** lists every note waiting more than 30 days and notifies the clinician who signed each one. The page then shows when the last reminder was sent.

### Service agreement
- States: Not started → Generated → Patient signed or Admin signed → Fully signed.
- Either person can sign first; the record shows who is still needed.
- The fully signed PDF includes the practice, patient, clinician, every section and a "signed electronically" line with date and time for each person.

> The agreement wording is a placeholder (care, fees, cancelling, confidentiality, records, ending care) until the real outline arrives.

### Documents and files

| Where | What | Rules |
|---|---|---|
| Clinician profile (admin side) | Registration, insurance, DBS check, contracts | PDF, Word or image. Description optional. Only admins can see them. |
| Clinician's own Profile | Resume or CV, W-9 or other IRS form; signed contracts listed automatically | Optional. Upload, replace, download, remove. The admin can see and download them. |
| Patient details | Referral letters, reports, test results | PDF, Word or image. Description optional. |
| Location profile | Certificates, leases, policies | PDF only. Short description required. |

Every file shows its name, description, size and upload date, and can be downloaded or removed.

## 5b. Duplicates, invoices, notifications and performance

### Duplicate patient check
- Runs whenever a patient is added, by an admin or a clinician. A match means the same name and the same date of birth. Names are compared ignoring case, spaces and punctuation (e.g. "AMINA HASSAN" = "Amina Hassan").
- The warning shows as soon as both fields match, before saving: "Possible duplicate. Amina Hassan, born 14 Mar 1992, is already in your practice."
- **Clinician:** can open the existing record, or choose "Add and ask admin to check". The patient is saved with a Possible duplicate flag, shows "Admin checking" in the list, and the record shows a notice.
- **Admin:** can open the existing record, or confirm "It's a different person" and save. No flag is raised.
- **Admin review screen:** existing record and new entry side by side, matching fields in green. "Confirm new patient" clears the flag. "Merge into existing" keeps the original record, moves any notes from the new entry and hides it.
- Flags appear in Overview "Needs your attention", in Notifications and as a badge on Patients.

### Invoices from clinicians

| Status | Meaning | Actions |
|---|---|---|
| Unpaid | Sent by a clinician, no payment recorded. Shows days since sent; red "Overdue" after 30 days. | Record payment (date, paid by), Flag issue, Download PDF |
| Paid | Payment recorded by the admin. | Download PDF |
| Issue | Admin flagged a problem: category plus a required comment. The clinician is told. | Record payment, Resolve issue (back to Unpaid), Download PDF |

- Issue categories: Wrong amount, Wrong patient, Missing or unsigned note, Insurance denied, Duplicate invoice, Other.
- Payment methods: Insurance, Card, Cash, Bank transfer, Check (US) or M-Pesa (Kenya).
- Each invoice keeps a history: sent, issue flagged, issue resolved, marked paid.
- Every new invoice is "New" until the admin opens it, or taps "Mark all as seen".
- The Invoices screen has Unpaid, Paid and Issues tabs with counts and a clinician filter.

### Notifications
- **Admin:** one list with new invoices, possible duplicates, new reviews, notes unbilled for 30+ days, and contract messages and signatures. Each item opens the screen where it's handled. The count shows on the Notifications menu item and on the More tab on phone.
- **Clinician:** new contract to sign, admin replied on a contract, and invoice issues. The count shows on the Notifications menu item and on the Account tab on phone.

### Performance

| Measure | Rule |
|---|---|
| Period | Last 7 days, Last 30 days (default), Last 90 days, This year. |
| Patients admitted | Patients whose added date (or start of care, or referral) falls in the period. Merged duplicates are not counted. |
| Invoices sent | Count and total of invoices sent in the period. |
| Paid / Unpaid | Count and total of each status for invoices sent in the period. A bar shows the split, including issues. |
| Missed visits | Count per clinician in the period, with a bar. Red when a clinician has 2 or more. |
| Reviews | Count and average rating per clinician, plus each review with its clinician. Patients can name the clinician on the review form ("Who did you see?"). |

## 5c. Clinician profiles and contracts

### Clinician profile
New **Profile** item in the clinician side menu (desktop) and under the **Account** tab on phone, which also holds Contracts, Notifications and Settings.

| Section | Fields and rules |
|---|---|
| About you | Discipline (RN, LPN, PT, OT, SLP, HHA / CNA, mental health) and speciality. Licence number, issuing board and expiry for licensed disciplines (optional; hidden for aides and CNAs). |
| Education | Any number of entries, every level: Certificate, Diploma, Associate, Bachelor's, Master's, Doctorate, Other; course or qualification (required), school, year. |
| Certifications | Name (required), issuer, expiry with a Current / Expires soon (within 60 days) / Expired badge. Quick-add for BLS, CPR, First Aid, HHA and CNA certification. Aides and CNAs must have at least one. |
| Documents | Resume or CV (optional), W-9 or other IRS form (optional): upload, replace, download, remove. Signed contracts are listed automatically and download as PDF. |

Admins see the same information on each clinician's page (Qualifications, Education, Certifications, Profile documents) and can download every document.

### Contracts

| Status | Who acts | What happens |
|---|---|---|
| Draft | Admin | Saved but not shared. Continue editing from Contracts. |
| Sent (waiting to sign) | Clinician | Admin signed and shared it. Clinician gets a notification and it appears under Contracts, Waiting for you. |
| Message (feedback) | Admin | Clinician sent a message instead of signing. Admin is notified, can reply in the thread, or use Update and resend (status returns to Sent). |
| Signed | — | Clinician signed and sent it back. Admin is notified to check it under Contracts. Both can download the PDF; it is listed on the clinician's profile. |

- **Create a contract (admin):** clinician, type (Independent contractor agreement, Employment offer, Confidentiality agreement), start date, length, pay, role or services, other terms, with a live preview on the letterhead.
- **Letterhead:** practice logo from Settings plus address, phone and email, saved for every contract. An uploaded letterhead image can replace the text version. With no logo, initials show and the admin is told to add one.
- **Signing:** the admin signs before sending; the clinician signs on their device. Signatures are drawn and stored as images with name and date.
- **Messages:** one thread per contract. Each new message notifies the other side.
- **Notifications:** clinician — new contract to sign, admin replied. Admin — clinician messaged, clinician signed; also shown on Overview and as menu badges.

## 6. Patient reviews
- Opened from the sign-in page (**Leave a review** in the "Are you a patient?" panel). No account needed.
- **Finding the practice:** the patient types the practice name (matched like clinicians joining: case, spaces and punctuation don't matter). Not found: "We couldn't find "…" on Tiba. Check the name on your appointment letter or invoice, or ask the practice for their review link." Only practices with an admin take reviews.
- **Review link:** each practice has its own link (/review?practice=…), shown with **Copy link** on the admin's Patient reviews screen. It opens the form with the practice already picked, for emails, texts or a QR code.
- Fields: star rating (required, "Pick a star rating."), review text (required, up to 2,000 characters), who they saw (optional: Not sure, or one of the practice's active clinicians), name (optional; blank means anonymous). Practice location is added once Locations exist.
- After sending: "Thank you · Your review is with the practice. Only their admin can read it."
- Only administrators can see reviews. Clinicians never do. **Check reviews from patients** on the sign-in page asks for a sign-in and opens Patient reviews for an admin; a clinician sees "Only your admin can see reviews".
- New reviews show a **New** badge the first time the admin opens Patient reviews, a count on the menu item, and "N new patient reviews" on Overview.
- **Hiding, never deleting:** an admin can **Hide** a review (asks first: "Hide this review? It moves to Hidden reviews and stops counting towards your average. Reviews can't be deleted, so you can show it again at any time."). Hidden reviews sit in a folded **Hidden reviews (n)** section with the date hidden and **Show again**, and don't count towards the average or new-review counts. Nobody can delete a review or change what the patient wrote; a review only goes if its whole practice is removed.
- The form is public, so it is limited to a few sends per device in ten minutes and quietly ignores bots.

## 7. Emails
- Sent from the practice's configured email account. Each email notes that it may contain private health information.
- **Tomorrow's appointments** go to the clinician: on request, or every evening if turned on (kept from v1.1).
- **Invoices** go to the address entered when the invoice is created (or later), with the invoice PDF attached (kept from v1.1).
- **Reset your password** goes to the account's email when someone asks on the Forgot password page, with a **Set a new password** button (and the plain link). It works once, within an hour.
- **New clinician waiting** goes to the practice admin when a clinician signs up with the practice name: "Dr Wanjiru wants to join Reyes Therapy on Tiba", with a link to Clinicians.
- **You're verified** goes to the clinician when the admin activates them for the first time.
- **Billing reminders** go to clinicians with notes waiting more than 30 days (channel to be decided, see open questions).
- In-app notifications (section 5b) don't send email yet.

## 8. Screen states

| State | List screens | Form and detail screens |
|---|---|---|
| Live | Normal content. | Normal content. |
| Loading | Grey placeholder rows shaped like the content, with a line such as "Loading your patients…". | Grey placeholder fields. |
| Error | "We couldn't load …" with Try again. | A red message at the top with Try again. What the user typed stays on screen. |

Actions that save (sign in, sign up, sign and save, send invoice, send contract) show a short spinner on the button. Field errors say what to do next, e.g. "Add an @, e.g. sam@clinic.com."

## 9. Layout
- Phone and desktop from one design. Desktop layout from 860px wide.
- Phone: 64px top bar, 72px bottom tabs on main screens; main buttons sit in a bar at the bottom of detail screens, with a back link to the screen you came from.
- Desktop: side menu, buttons in the page header, content up to 1120px wide. Forms are up to 480px wide.
- The practice country sets the currency: United States uses US dollars, shown as $80.00; Kenya uses Kenyan shillings, shown as KSh 8,000. Country is picked at sign-up and can be changed in Settings. Dates read 12 Sep 2026.
- Visual style follows the Tiba design system (Fern and Lilac colours, Young Serif and Figtree).

## 10. Data

| Table | Fields | Written by | Read by |
|---|---|---|---|
| Practices | name, name for matching (lower case, no punctuation; unique), country, currency (USD or KES), logo, letterhead (address, phone, email, image) | Admin sign up, Admin settings | Everything (letterhead, currency, clinician sign up) |
| Accounts | name, email, password, type (clinician or administrator), practice, status (waiting for verification, active or deactivated), discipline (RN, LPN, PT, OT, ST, HHA, MH), role, phone, registration, location, emergency contact, documents, patients-sign setting, visit fee, evening reminder on/off, time zone | Sign up, Admin (clinician profile), Settings | Sign in, Admin |
| Clinician profiles | speciality, licence number, issuer and expiry, education (level, course, school, year), certifications (name, issuer, expiry), resume, W-9, other documents | Clinician | Clinician, Admin |
| Locations | name, address, type of facility, type of services, files | Admin | Admin, Reviews, Clinician profile |
| Patients | full name, date of birth (age is calculated), phone, email, insurer, diagnosis codes, services ordered (RN, PT, OT, ST, HHA, MSW), ordering doctor, assigned clinician, date of referral, start of care, status (active, discharged or merged), added by and when, duplicate flag (match, flagged by, when), merged into, invoice email, files | Clinician, Admin | Both apps |
| Diagnosis codes | code, description (a standard list, loaded once) | Nobody (fixed list) | Visit note, Add patient, Patient record |
| Appointments | start, end, type of care, fee, patient, clinician, location, status (upcoming, done or missed), missed reason, time in, time out | Clinician | Both apps, reminder emails |
| Notes | appointment, patient, practice, author, type of care, kind (evaluation, progress or service plan), section answers, diagnosis code, draft or signed, signed date, signatures, prefilled from, written note, billed to insurance (date) | Clinician (Visit note), Admin (Mark as billed) | Both apps |
| Goals | evaluation note, patient, discipline, text, short or long term, target weeks | Clinician (evaluation) | Progress notes, Care team |
| Invoices | invoice number, practice, patient, clinician, visits included, amount, currency, due date, sent date, emailed to, seen by admin, status (unpaid, paid or issue), paid date and method, issue (category, comment, flagged, resolved), history | Clinician (create), Admin (payment, issues) | Both apps |
| Service agreements | patient, practice, sections, patient signature, admin signature, signed dates, status | Admin | Admin |
| Contracts | number, practice, clinician, type, terms (start, length, pay, role, other), letterhead, status (draft, sent, feedback or signed), sent date, admin signature, clinician signature, message thread, seen by each side | Admin, Clinician (sign, message) | Admin, Clinician |
| Reviews | practice, location (later), clinician (optional), rating 1–5, text, name (optional), date, seen by admin, hidden (date, by whom) | Patients (no account); Admin hides or shows | Admin only |
| Notifications | practice, recipient, type (invoice sent, duplicate flag, review, unbilled 30 days, contract message, contract signed, contract sent, invoice issue), what it points to, created, read | Tiba | Admin, Clinician |
| Billing reminders | date sent, notes included | Admin | Admin |

Patient records are private health information, so everything sits behind the login and must be stored securely. Clinicians see only their own appointments and notes; the patient list is shared across the practice. Administrators see the whole practice but cannot write visit notes.

## 11. Build guide

The design files are the source of truth for layout and copy. Prototypes: Tiba Prototype Desktop and Tiba Prototype Mobile (TibaApp for sign-in and the clinician app, which routes admins to TibaAdmin). Screen boards: Tiba Profiles - Contracts, Tiba Screens, Tiba Visit Notes, Tiba Evaluations - Plans, Tiba Patient Access, Tiba Duplicates Invoices Performance.

### Data model (as given in the design spec)
Section 10 expands this with the fields kept from v1.1 (time in and out, invoice email, reminders).

| Entity | Key fields |
|---|---|
| Practice | id, name, logo, country, currency (USD or KES), locations[] |
| User | id, practiceId, name, email, role (clinician or admin), discipline (RN, LPN, PT, OT, ST, HHA or MH), active, emergencyContact, documents[] |
| Patient | id, practiceId, name, dob, phone, email, insurer, dxCodes[], ordersServices[] (RN, PT, OT, ST, HHA or MSW), orderingDoctor, assignedClinicianId, referralDate, startOfCare, status (active, discharged or merged), addedBy, addedAt, duplicateFlag {matchId, flaggedBy, at} or null, mergedInto or null |
| Appointment | id, patientId, clinicianId, start, end, careType, status (upcoming, done or missed), missedReason |
| Note | id, appointmentId, patientId, practiceId, authorId, careType, kind (evaluation, progress or servicePlan), fields{}, dxCode, status (draft or signed), signedAt, signatures[], prefilledFrom or null, generatedText, billedToInsuranceAt |
| Goal | id, evaluationNoteId, patientId, discipline, text, term (short or long), targetWeeks |
| Invoice | id, number, practiceId, patientId, clinicianId, visitNoteIds[], amount, currency, sentAt, seenByAdminAt, status (unpaid, paid or issue), paidAt, paidMethod, issue {category, comment, flaggedAt, resolvedAt}, history[] |
| ClinicianProfile | userId, speciality, discipline, licenseNumber, licenseIssuer, licenseExpiry, education[{level, course, school, year}], certifications[{name, issuer, expiry}], resume, w9, otherDocs[] |
| Contract | id, number, practiceId, clinicianId, type, terms{start, length, pay, role, extra}, letterhead{logo, address, phone, email, image}, status (draft, sent, feedback or signed), sentAt, adminSignature{name, image, at}, clinicianSignature{name, image, at}, thread[{from, text, at}], seenByAdmin, seenByClinician |
| Review | id, practiceId, locationId, clinicianId or null, rating 1–5, text, name or null, createdAt |
| Notification | id, practiceId, recipientRole (admin), type (invoiceSent, duplicateFlag, review or unbilled30), refId, createdAt, readAt |

### Suggested build order
Each step builds on the one before. Section 14 has the details for each screen.

1. **Foundations:** practices and account types (clinician or admin), country and currency, discipline; sign up and sign in updated to match (password 8+, country, account type, admin logo required); clinicians joining a practice and the admin verifying them. *Done 20 Oct 2026, except discipline.*
2. **Clinician core:** Appointments (week strip, statuses), Visit note for therapy types (drafts, sections, progress), Sign note, Signed note (written note, addenda), Notes to do.
3. **Patients:** Patients list, Add patient (services ordered, duplicate check), Patient record (care team).
4. **Billing:** Invoice from signed visits (due date, currency), merged with the existing Invoices screen.
5. **Settings and account:** discipline, patients-sign toggle, country, visit fee; Notifications.
6. **Discipline notes:** SOAP notes with measures, level rows and billing codes; evaluations and goals; progress notes and prefill; aide service plan and the aide visit lock.
7. **Admin app:** Overview, Clinicians and profiles, Patients and duplicate review, Completed notes, Invoices (payments and issues), Insurance billing, Locations, Settings, More. *Clinicians, Patients (list, Add patient with duplicate check, Discharge and Reactivate), Appointments, Locations (list and Add location) and Patient reviews done 21 Oct 2026; location profile (files, remove), patient details and duplicate review screens still to come.*
8. **People and paperwork:** clinician Profile, Contracts (both sides), service agreements, documents and files.
9. **Insight and patients:** Performance, Patient reviews (patient form and admin list). *Patient reviews done 21 Oct 2026.*

### Permissions

| Action | Clinician | Admin |
|---|---|---|
| Add patient | Yes (may raise a duplicate flag) | Yes (can confirm on the spot) |
| Resolve duplicate flag | No | Yes |
| Write notes | Own visits, by discipline | No |
| Write aide service plan | RN if nurse ordered; PT/OT only if no nurse ordered | No |
| Prefill a progress note | Same patient, same care type, same practice | — |
| Send invoice | Own signed visits | — |
| Mark invoice paid, flag or resolve issue | No | Yes |
| Edit own profile, upload resume and W-9 | Yes | View and download |
| Create, sign and send contracts | No | Yes |
| Sign a contract or message about it | Own contracts | Reply, update and resend |
| See reviews, performance, notifications | No (own notifications only) | Yes |
| Activate or deactivate accounts, locations, settings | No | Yes |

### Acceptance criteria (20 Oct update)
- Adding a patient with the same normalised name and DOB as an existing practice patient shows the duplicate warning before save.
- A clinician-added duplicate is saved with a flag, creates an admin notification, and appears on Overview until confirmed or merged.
- Merging hides the new record, moves its notes to the original and leaves an audit entry.
- Every invoice a clinician sends creates an admin notification and appears in Unpaid with a New badge.
- Flagging an issue requires a category and a comment, moves the invoice to Issues and notifies the clinician.
- Resolving an issue returns it to Unpaid; recording a payment moves it to Paid from either Unpaid or Issue.
- Performance numbers change with the period and match the underlying records.
- HHA notes cannot be saved or signed until the patient has a signed service plan.
- Progress notes show goals only from a signed evaluation in the same practice.
- Prefill copies fields except billing minutes and visit times, and is unavailable when the source note is from another practice.
- A sent contract appears in the clinician's Contracts and Notifications; signing marks it Signed for both and notifies the admin.
- A clinician message on a contract notifies the admin; an admin reply notifies the clinician.
- Contracts can't be sent without the admin's signature; the letterhead uses the practice logo and saved contact details.
- Aides and CNAs can't save a profile without at least one certification.
- Every screen has live, loading and error states as drawn.

### Design system additions
These patterns were built in the design project on top of the Tiba Design System and should become components:

| Pattern | Use |
|---|---|
| SideNav with groups, badges and drafts | Desktop navigation for clinician and admin apps. |
| Section outline / jump chips | SOAP or numbered note sections; outline on desktop, chips on phone, with done counts. |
| Choice chips (single and multi) | Tap answers in notes and forms; 44px minimum. |
| Measures grid | Number inputs with units (vitals, ROM, scores); time inputs for visits. |
| Level rows | A row per item with a level picker (goal progress, ADL help levels, aide tasks). |
| Goal set editor | Goal text, short/long-term and target, add and remove. |
| Billing codes table | Timed codes with minutes and 8-minute-rule units, untimed codes as Add toggles. |
| Combobox | Type-to-filter diagnosis code picker with keyboard support. |
| Signature pad and signed signature tile | Draw, clear, locked display. |
| Notice banners | Info (fern), waiting (lilac), warning (amber, e.g. duplicates), danger (red, e.g. issues), prefill with Undo. |
| Locked state | Explains why an action is blocked, with one way forward. |
| Stat card, split bar, clinician metric row | Performance page. |
| Skeleton list and form | Loading states. |
| Error block and banner | Full error for lists, banner for forms that keeps input. |

## 12. Out of scope
- Later versions: appointment reminders to patients, payments taken inside Tiba, insurance claims sent to insurers automatically.
- Patient logins and online self-booking.
- Reports beyond the admin Overview and Performance screens.

## 13. Open questions
- **Service agreement outline:** waiting on the real wording and sections.
- **Clinician documents:** which document types are required, and do any expire?
- **Billing reminders:** sent to clinicians only, or also to billing staff? By email, in-app, or both?
- **Insurance billing:** marked by hand for now. Is there an insurer system to connect to?
- **Written notes:** fixed sentence pattern or AI writing?
- **Signature images in PDFs:** the prototype records an electronic-signature line; should the drawn signature appear too?
- **Reviews:** patients find the practice by name or through its review link; admins can hide but not delete reviews. Should admins be able to reply? Should the link come with a printable QR code?
- **Currency:** sample prices show as $80.00 or KSh 8,000. Should one practice be able to bill in both currencies at once?
- **Notifications by email:** should any in-app notification (contract to sign, invoice issue) also send an email?
- **Billing codes:** the CPT and G codes are US codes. What do Kenyan practices use?
- **More than one admin:** a practice has one admin for now (a second admin sign-up with the same name is refused). Should an admin be able to add another admin?
- **Solo clinicians:** a clinician can only join a practice that has an admin. Should a clinician who works alone be able to set up their own practice without an admin?
- **Renaming a practice:** clinicians join by the current name. Should the admin be able to share a join link or code instead of the name?

## 14. Screen details (from the prototypes)

Taken from Tiba Prototype Desktop and Tiba Prototype (phone), 20 Oct 2026. Each entry gives the header (overline · title · actions), what the screen holds, and its copy. Sample names and numbers are from the prototype. On phones, the actions of detail screens move to a bar at the bottom, and a back link names the screen you came from ("← Notes").

### Shared pieces
- **Header:** small uppercase overline, serif title, actions on the right. Detail screens add a back link above.
- **Loading:** the header stays; the body shows grey placeholder rows and a line such as "Loading your patients…".
- **Error:** "We couldn't load your patients" · "Check your connection and try again. Nothing you've written is lost." · **Try again**.
- **Privacy line** under auth forms and in Settings: "Your patients' notes are private and stored safely."
- **Signature pad:** name above, "Sign here with your finger or mouse", **Clear**.
- **Diagnosis code field:** hint "Type to filter, e.g. F41 or anxiety." Clear button (×) once a code is picked.

### Auth and patient pages
| Screen | Details |
|---|---|
| Sign in | **Built 21 Oct 2026.** "Welcome back" · "Sign in to your practice." Email (mail icon), Password (lock icon, show/hide) with **Forgot password?**, "Keep me signed in" switch (on by default), **Sign in →** (spinner while signing in). Field errors under the field: "Add the email you use for Tiba.", "Add an @, e.g. sam@clinic.com.", "Add your password.", "We couldn't find an account for that email. Check it, or create one below.", "That password doesn't match. Try again, or reset it."; too many tries: "Too many tries. Please wait a minute, then try again." "New to Tiba? Create an account". Panel "Are you a patient?": "Tell the practice how your visits went. Only the practice admin reads reviews." **Leave a review**, **Check reviews from patients**. Under every sign-in page: "Your patients' notes are private and stored safely." (The prototype's "Try a demo account" links are for the prototype only.) |
| Forgot password | Back to sign in. "Forgot your password?" · "Enter the email you use for Tiba and we'll send you a link to set a new one." Email, **Send reset link**. Unregistered email: "We couldn't find an account for that email. Check it, or create an account." "Remembered it? Back to sign in". |
| Check your email | "Check your email" · "We've sent a link to … It works once, within the next hour. If it isn't there, check your spam folder." **Back to sign in**, **Send it again**. |
| Set a new password | "Set a new password" · "Choose a password you don't use anywhere else." New password ("At least 8 characters."), Type it again ("The two passwords don't match. Type the same password in both boxes."), **Save new password**. Then "Your password is changed" · "Sign in with your new password. For your safety, we've signed your account out on every other device." **Sign in**. |
| Link expired | "This link has expired" · "Reset links work once, within an hour of asking. Ask for a new one and use it straight away." **Send a new link**, **Back to sign in**. |
| Sign up | **Built 21 Oct 2026.** "Let's set you up" · "One account for you and your practice." Your name, Email (mail icon), Password (lock icon, show/hide; "At least 8 characters." turns green with a tick once met), Type of account as two cards: Clinician "Write notes, sign and invoice your patients." / Administrator "Run the practice: clinicians, billing, locations." Practice name (clinician label "Practice you're joining", hint "Use the same name your practice admin signed up with. They'll verify your account before you can see patients."; admin hint "Clinicians join your practice by entering this name when they sign up. You verify each one."). Admins only: Country ("Prices will show in US dollars ($).") and Practice logo (**Upload logo**; "It shows on invoices, notes and agreements. PNG or JPG works best."). **Create account** (spinner: "Setting things up…"). Clinicians see "Your practice admin gets an email and verifies you. Until then, you'll see a waiting page." Field errors under the field, and the first one gets focus: "Add your name.", "Add your email.", "Add an @, e.g. sam@clinic.com.", "Your password needs at least 8 characters.", "Add your practice name." / "Add the name of the practice you're joining.", "Admins need to add the practice logo.", "There's already an account with that email. Sign in instead", plus the practice messages in section 3. "Already have an account? Sign in". |
| Waiting for your admin | Hourglass icon · "Waiting for your admin" · "You've asked to join Reyes Therapy. Your practice admin needs to verify your account before you can see patients. We've let them know." "Signed in as … Once you're verified, we'll email you and this page opens your appointments." **Check again**, **Sign out**. Deactivated version: "Your account is turned off" · "Reyes Therapy's admin has deactivated your account, so you can't see patients for now. Your notes are kept safe. If this is a mistake, contact your practice admin." |
| Leave a review | Back to Sign in. "How was your visit?" · "Your review goes privately to the practice. You don't need an account." "Which practice did you visit?" ("Type the name as it appears on your appointment letter or invoice.") **Find practice**; then the practice with **Change** (not shown when opened from the practice's review link), Your rating (five stars, with a word: Poor, Not great, Okay, Good, Excellent), Your review, Who did you see? (Not sure, or a clinician; "Optional. Helps the practice thank the right person."), Your name (optional; "Leave blank to stay anonymous."). **Send review**. (Practice location comes once Locations exist.) |
| Review sent | "Thank you" · "Your review is with the practice. Only their admin can read it." **Back to sign in**. |
| Only your admin can see reviews | From **Check reviews from patients** when a clinician signs in. Lock icon · "Only your admin can see reviews" · "Patient reviews go privately to Reyes Therapy's admin. Clinicians can't read them, so patients can speak freely." **Back to Tiba**. |

### Clinician app
| Screen | Details |
|---|---|
| Appointments | **Built 21 Oct 2026** (Needs plan comes with aide visits). Overline "Today · Friday 16 October" (or the picked day) · title "12 appointments" (or "A free day"). **Back to today** when another day is picked. Week strip Mon–Sun with dots under days that have notes to do. Lilac reminder bar: "3 finished visits need notes · 12 drafts are waiting." (opens Notes to do). Visit rows: initials, patient, "09:00–09:50 · Individual therapy", status badge, chevron. Empty day: "Nothing booked". Tomorrow card (kept from v1.1) sits below. |
| Notes to do | **Built 21 Oct 2026** (section counts and Ready to sign come with structured notes). "To do" · "15 notes to finish" (or "All caught up"). **Needs a note (3)** "Finished visits with no note yet." Rows: "13 Oct · 14:00 · Individual therapy" with **Write note**. **Drafts (12)** "Started but not signed. Saved as you type." Rows: "Today · Assessment · Edited 10:02" with "3 of 6" or **Ready to sign**. |
| Visit note | Back Notes. Overline "Visit note · 16 Oct 2026 · 09:00–09:50" ("Initial evaluation · …", "Aide service plan · …") · patient name · **Save draft**, **Continue to sign**. Prefill banner "Start from the last visit? Copy the 12 Oct individual therapy note by Dr Sam Reyes. You can edit everything after." **Prefill from last visit** (or "Can't prefill from the last visit. The last occupational therapy note is from Riverside Rehab. Notes from other practices can't be copied."). Therapy notes: Type of care chips ("Sections change with the type of care."). Discipline notes: fixed Type of note with a line: "Progress note. Goals come from the evaluation." / "Initial evaluation. Sets the goals." / "One plan per patient. Update it when orders change." Diagnosis code. Progress: "6 of 10 sections done" with a bar and "Draft saved". Each section shows "Done" once filled. Desktop: section outline card on the left (S, O, A, P, B with "2/2"); phone: jump chips. |
| Visit note: discipline extras | Evaluations add a banner "Goals set here carry into every visit. Each physical therapy note for Peter will rate progress on these goals." Goal editor hint: "Make each goal measurable: what, how much, by when." Evaluation billing: "Pick the evaluation code that matches the complexity above." Timed billing: "38 timed minutes · 3 billable units" and "Units follow the 8-minute rule: 8–22 minutes is 1 unit, 23–37 is 2, and so on." Nursing: "Home health nursing is billed in 15-minute units." Speech: "These codes are billed once per visit." Goal progress shows "Goals from the 2 Oct evaluation by Ana Ruiz, PT." Measures show units (°, /5, /10, sec, kg, bpm, mmHg, °F, lb, mg/dL, %). |
| Visit note: aide plan and visit | Service plan banner: "Aide service plan for Mary Wanjiku. An RN writes this plan because skilled nursing is ordered. Aide visit notes stay locked until this plan is signed." with the services ordered as chips. Aide visit level rows: "Tap the help level for each task you did. Leave the rest blank." Medicine help: None needed, Reminders, Assistance. Meal log: All, Half, A little, Refused. Companion care and home help are optional pick-any lists. |
| Locked aide visit | "Service plan needed first" · "Mary has no signed aide service plan yet, so this visit can't be documented. An RN writes this plan because skilled nursing is ordered. A draft plan is waiting to be finished." **Finish service plan** (or a link to the care team when you can't write it). |
| Sign note | Back Note. Overline "Both of you sign" (or "Your signature") · "Sign Amina's note" · **Sign and save**. Summary: date and time, type of care · diagnosis, then each section's answer. "Once signed, Tiba writes these sections up as a finished note and locks it." Your signature pad; patient pad "Hand the device over to sign" with "Hand the device to Amina. They only see this box, not your notes." |
| Signed note | Overline "Signed note · 16 Oct 2026 · 10:30–11:20" · patient · **Download PDF**, **Create invoice**. Banner "Signed at 11:22 by you and Joseph · Signed notes are locked. Add an addendum if something changes." Type of care and diagnosis. "Visit note · Written up from your sections" with the generated text. "Section answers" (collapsed). Signature tiles: Clinician and Patient, each with name and "11:22, 16 Oct". |
| Patients | "14 patients in Reyes Therapy" · Patients · **Add patient**. Search. Rows: initials, name, "34 · Last visit 16 Oct", "Note to do" badge. |
| Patient record | Back Patients. Overline "34 · Your patient since Feb 2026" · name · **Download PDF**, **Write note** / **Finish note** (desktop), **Create invoice** (disabled with no signed visits). Cards: Details (date of birth, phone, email), Diagnosis codes, Care team, Visits ("16 Oct 2026 · 09:00 · Individual therapy" with status). Empty: "No visits yet". |
| Invoice | Back Patient. "New invoice" · "Invoice Amina" · **Send invoice**. Signed visits with checkboxes and fees. Send to (email), Payment due (Due on receipt, Due in 14 days, Due in 30 days). Total "1 visit · $80.00". Plus the v1.1 period filter and auto-email. |
| Add patient | Back Patients. "New patient" · "Add a patient" · **Add patient**. Full name, Date of birth (optional), Phone (optional), Services ordered ("Pick what the doctor ordered. You can change it later."), Ordering doctor (optional), Email (optional; "We use this to send their invoices."), Diagnosis code (optional). The duplicate warning appears as soon as name and date of birth match. |
| Notifications | "For you" · Notifications · **Mark all as read**. Rows: "New contract to sign · Independent contractor agreement · 15 Oct 2026" with a New badge. Empty: "You're all caught up". |
| Contracts | Practice name · Contracts. **Waiting for you (1)** "Sign, or message your admin with questions." **Signed (1)** "Copies are also in your profile." Rows: type, "CT-2027-01 · sent 15 Oct 2026", badge. |
| Contract | Back Contracts. "CT-2027-01 · from Ruth Mensah" · type · **Sign and send back** (or **Download PDF**). Banner "Ready for your signature. Read it through, then sign below. If something needs changing, send Ruth a message instead." The contract on the letterhead (logo or initials, address, phone, email; numbered clauses: Services, Pay, Length and ending, Notes, Licence and insurance, Taxes, Confidentiality; Other terms). Signature tiles: Practice admin (signed) and Clinician ("Waiting for signature"). Your signature pad: "Signing sends it straight back to Ruth Mensah. A copy goes to your profile." **Messages**: "Questions about this contract? Message your admin here." **Message admin**. |
| Profile | Discipline as overline · "Your profile" · **Save profile**. About you (Discipline, Speciality, License number, Issued by, Expires; licence fields optional). Education ("Every level, from certificates to doctorates."; Level, Course or qualification, School or college, Year completed, Remove, **Add education**). Certifications ("Optional. Add BLS, CPR or any others." Quick add chips; Certification, Issued by, Expires, status badge, Remove, **Add certification**). Documents ("Your admin can see and download these."): Resume or CV, W-9 or other IRS form (Upload, Replace, Download, Remove), signed contracts. |
| Settings / Account | "Your practice" · Settings (Account on phone) · **Sign out**. Phone only: rows for your profile, Contracts ("1 waiting for you"), Notifications ("1 new"), Invoices. **Your role**: Discipline ("Decides which notes and service plans you can write."). **Notes and signing**: "Patients sign each note" ("They sign on your device at the end of the visit."). **Invoicing**: Country ("Prices show in US dollars ($)."), Visit fee ("Used for each visit on new invoices."). Practice name and logo. Privacy line. |

### Admin app
| Screen | Details |
|---|---|
| Overview | "Admin · Ruth Mensah" · practice name. **Needs your attention** rows, each with an icon, a line of detail and a badge: "4 notes unbilled 30+ days · Oldest signed 26 Aug 2026 · 51 days ago" (Overdue); "Sign Lena's service agreement"; "Check possible duplicate: AMINA HASSAN" (Confirm); "Maya sent a message about a contract" (Reply); "Tom signed a contract" (Signed); "3 new invoices from clinicians · Mark paid, or flag an issue" (New); "1 invoice has an issue · Waiting for the clinician to fix"; "Grace Wanjiru's account is deactivated" (Deactivated); "3 new patient reviews · In the last two weeks". **Today across the practice**: "13:00 · Individual therapy · Dr Sam Reyes". |
| Notifications | "For you" · Notifications. Rows such as "Dr Maya Chen sent INV-1052 · $120 · Marcus Bell · 16 Oct" (New), "Possible duplicate: AMINA HASSAN" (Confirm), "New review · 5 of 5", "4 notes unbilled for 30+ days". |
| Performance | "Practice performance" · Performance. Period chips. Stat cards: Patients admitted (names), Invoices sent ("$645.00 in total"), Paid ("$200.00 received"), Unpaid ("$355.00 waiting"), Missed visits ("Across 3 clinicians"), Patient reviews ("Average 4.3 of 5"). Invoices split bar (Paid, Unpaid, Issues). **By clinician** "Missed visits, invoices and patient reviews in this period.": each clinician with role, missed visits, invoices "3 · $240", reviews "5.0 (1)". **Reviews in this period**. |
| Clinicians | "4 active · 1 deactivated" · Clinicians. **Waiting for you to verify (1)** "They signed up with your practice name. Activate the people you know; until then they can't see any patients." Rows: name, "email · asked to join 20 Oct 2026", "Waiting for you" badge, **Activate**, **Not now**. **Your clinicians**: name, "Clinical psychologist · Camden" (role and location once profiles exist), Active or Deactivated, **Deactivate** or **Activate**. Deactivate dialog: "Deactivate Dr Maya Chen? They're signed out straight away and can't see patients. Their notes are kept, and you can turn the account back on at any time." **Keep active** / **Deactivate account**. Empty: "No clinicians yet. Ask your clinicians to create an account with the practice name "Reyes Therapy". They'll show up here for you to verify." The menu shows the waiting count. |
| Clinician profile | Back Clinicians. Role · name · **Send contract**, **Deactivate account** (or **Activate account**). Details (Role, Email, Phone, Registration, Location, Joined). Qualifications (Speciality, License, Issued by, License expires). Education. Certifications. Profile documents ("Uploaded by the clinician"). Account: "Account active · They can sign in and write notes." Emergency contact (Name, Relationship (optional), Phone, **Save contact**). Documents ("Registration, insurance, DBS, contracts. Only admins can see these."; Description (optional), **Upload file**). |
| Patients | "9 active · 2 discharged" · Patients · **Add patient**. Tabs Active (9), Discharged (2). Rows: name, "Dr Sam Reyes · Started 3 Feb 2026" (or "Referred 2 Oct 2026"), badge: Agreement signed, Needs your signature, No agreement or Possible duplicate. |
| Patient details | Back Patients. "Active · Dr Sam Reyes" · name · **Discharge** (or **Reactivate**). Details (date of birth, phone, email, insurer, services ordered, ordering doctor, diagnosis). Care (date of referral, start of care, clinician picker). Service agreement status, e.g. "Lena signed on 14 Oct 2026, 14:52. Add your signature to finish." **Open to sign**. Clinical documents ("Referral letters, reports, test results. Kept with Lena's record."). |
| Add patient | Back Patients. "New patient" · "Add a patient" · **Add patient**. Patient: Full name, Date of birth (required for now: the duplicate check needs it), Phone (optional), Email (optional; "Used to send their invoices."). Care: Clinician (active clinicians only; with none: "Add a clinician first"), Insurer (Self-pay plus the country's list), Diagnosis code (optional, type to filter), Services ordered (chips; an aide needs nursing, PT or OT: "An aide can only be ordered with skilled nursing, physical or occupational therapy."), Ordering doctor (optional), Date of referral, Start of care (optional, not before referral). "Clinicians see and treat the patient once they are added here." Same name and date of birth: "Possible duplicate. Amina Hassan, born 14 Mar 1992, is already in your practice." **It's a different person** / **Check the patient list**. |
| Duplicate review | Back Patients. "Possible duplicate" · name · **Merge into existing**, **Confirm new patient**. "Is this the same person? Dr Sam Reyes added AMINA HASSAN on 15 Oct 2026. Amina Hassan already has a record with the same name and date of birth." Existing record and New entry side by side (name, date of birth, phone, email, clinician, insurer). "Matching fields are in green. Merging keeps the existing record and moves any notes from the new one into it." |
| Service agreement | Back Patient. "Both of you sign" (or "Fully signed") · Service agreement · **Save signatures** (or **Download PDF**). Letterhead, "Between Reyes Therapy and Lena Moreau · Clinician Dr Sam Reyes", six numbered sections, "Draft wording. Swap in your agreement outline when it's ready." Signature tiles for Patient and Practice admin. |
| Appointments | "Upcoming" · Appointments. Clinician filter. Grouped by day ("Today · Friday 16 Oct", "Saturday 17 Oct"). Rows "13:00 · Individual therapy · Dr Sam Reyes". |
| Completed notes | "All clinicians" · Completed notes. Clinician filter. "11 signed notes · Newest first. Drafts stay private to each clinician until signed." Rows "Joseph Okafor · 15 Oct · Dr Sam Reyes · Couples therapy" with Billed or Not billed. |
| Signed note (admin) | Back. "Signed note · 26 Aug 2026" · patient · **Download PDF**, **Mark as billed**. Visit (patient, clinician, type of care, date, insurer). "Not billed yet · 51 days since signing · $90.00 to Bupa." Visit note with "Signed by Dr Maya Chen on 26 Aug 2026, 11:58". |
| Invoices | "Sent by your clinicians" · Invoices. Banner "3 new invoices from clinicians since you last looked." **Mark all as seen**. Tabs Unpaid (5), Paid (5), Issues (1). Clinician filter. "5 invoices · $475.00 · Newest first. Open one to mark it paid or flag an issue." Rows "Sofia Rossi · $75.00 · INV-1051 · sent 16 Oct 2026 · Tom Alvarez" with New, days since sent, or Overdue. |
| Invoice | Back. "Invoice · Dr Maya Chen" · "Hannah Lewis · $90.00" · **Download PDF**, **Resolve issue** (when flagged). Issue banner with the comment and date. Details (number, patient, clinician, visit, sent, amount, insurer). History. **Record payment**: Paid on, Paid by (Insurance, Card, Cash, Bank transfer, Check or M-Pesa), **Mark as paid**. **Flag issue**: category and comment. |
| Insurance billing | "Notes billed to insurance" · Insurance billing · **Send reminder**. Banner "4 notes have waited more than 30 days to be billed to insurance." **Waiting to bill (6)** "Oldest first. Red means more than 30 days." Rows "Oliver Brooks · 26 Aug · Dr Maya Chen · Individual therapy · $90.00 · 51 days". **Billed (5)** "Oldest first." Rows end "Billed 29 Aug". |
| Contracts | "2 waiting to sign" · Contracts · **New contract**. Tabs All, Waiting, Messages, Signed, Drafts. Rows "Dr Sam Reyes · Independent contractor agreement · CT-2027-01 · sent 15 Oct" with Waiting to sign, New, Signed or Draft. |
| New contract | Back. "New contract" · "Create a contract" · **Save draft**, **Sign and send**. Contract: Clinician, Type, Start date, Length (3 months, 6 months, 12 months, No end date), Pay, Role or services, Other terms (optional). Letterhead ("Used on every contract you send."; no-logo notice; Address, Phone, Email; **Upload letterhead image** "Optional: upload your own letterhead image to replace the text version."). Live preview. Your signature: "Sign here, then send". "Sending shares it to Esther's Contracts and notifications." |
| Contract (admin) | Back. "CT-2026-14 · Dr Maya Chen" · type · **Update and resend**, **Continue editing** or **Download PDF** by status. Banner "Maya sent a message · Reply below, or update the contract and send it again." Contract preview, signature tiles, Messages thread, **Send reply**. |
| Locations | "3 locations" · Locations · **Add location**. Rows: name, address, facility type. |
| Location profile | Back Locations. Facility type · name · **Remove location** (disabled for the last one). Address, Clinicians, Type of facility, Type of services. Files ("PDFs only, each with a short description. Download or remove them any time."; Short description, **Upload PDF**). |
| Add location | Back Locations. "New location" · "Add a location" · **Add location**. Location name, Type of facility, Address, Type of services. "You can upload files for this location once it's added." |
| Patient reviews | "From your patients" · Patient reviews. "4.3 · Average from 6 reviews · Only admins can see these. Patients send them from the sign-in page." Rows: stars, text, "Anonymous · Tom Alvarez · 11 Oct 2026" ("Clinician not named" when the patient picked Not sure), New badge on the first visit after it arrives, **Hide** on each review. **Hidden reviews (n)**, folded, with "Hidden reviews don't count towards your average. Reviews can't be deleted." and **Show again**. **Your review link** with **Copy link**. Empty: "No reviews yet". |
| Settings | "Your practice" · Settings · **Save changes**. Practice name, Country ("Invoices, billing and agreements show US dollars ($)."), Your name, Practice logo ("Admin accounts need a logo. It shows on invoices, notes and agreements."), Sign out. |
| More (phone) | Practice name · More. Rows with a one-line summary each (see section 5), then **Sign out**. |

## Brand notes
- Should feel calm, clinical, and friendly.
- Fern and Lilac palette on a soft off-white page, deep fern for headings and buttons, near-black text, lilac as a small accent.
- Plenty of white space, and equally comfortable on a phone and a computer.
