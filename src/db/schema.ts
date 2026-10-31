import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  customType,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Practices (spec v2). An administrator creates the practice at sign-up; clinicians
// join it by signing up with the same practice name and stay "pending" until the
// admin activates them. Accounts made before v2 each got their own practice.
// ---------------------------------------------------------------------------

export const practices = pgTable(
  "practices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // The name lower-cased with punctuation and spacing collapsed (normalisePracticeName),
    // so "Reyes Therapy" and "REYES  THERAPY." are the same practice.
    nameKey: text("name_key").notNull().unique(),
    // ISO 3166-1 country code (src/lib/countries.ts). Sets the currency for fees and invoices.
    country: text("country").notNull().default("US"),
    // ISO 4217 code the practice bills in, chosen by the admin. Null means the country's
    // standard currency (currencyFor(country) in src/lib/countries.ts).
    currency: text("currency"),
    // Contract letterhead (spec v2 section 5c): contact details printed under the logo, or an
    // uploaded letterhead image (PNG/JPEG data URL, like the logo) that replaces the text version.
    letterheadAddress: text("letterhead_address"),
    letterheadPhone: text("letterhead_phone"),
    letterheadEmail: text("letterhead_email"),
    letterheadImage: text("letterhead_image"),
    // The practice's service agreement wording (src/lib/agreement-template.ts); null = Tiba's default.
    agreementTemplate: jsonb("agreement_template").$type<{ id: string; h: string; text: string }[]>(),
    // Last contract number given out, for gap-free "CT-2026-07" numbers.
    lastContractNumber: integer("last_contract_number").notNull().default(0),
    // Letterhead logo: a PNG/JPEG data URL, resized in the browser and checked by
    // parseLogoDataUrl. Served by /api/practice-logo, never embedded in pages.
    logo: text("logo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("practices_country_check", sql`${t.country} ~ '^[A-Z]{2}$'`)],
);

// ---------------------------------------------------------------------------
// Auth tables (shape required by Better Auth; see src/lib/auth.ts).
// Better Auth's "user" model is the spec's Clinicians table.
// ---------------------------------------------------------------------------

export const clinicians = pgTable("clinicians", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.id, { onDelete: "restrict" }),
  // Copies of the practice's name and country, so they ride along in the session.
  // updatePractice keeps them in step with the practices row.
  practiceName: text("practice_name").notNull(),
  country: text("country").notNull().default("US"),
  // Spec v2 account type: "clinician" writes notes; "admin" runs the practice and never writes notes;
  // "patient" uses the patient portal (messages with the practice) and sees nothing else;
  // "referrer" (a referral source: a hospital, doctor or agency) uses the referral portal the same
  // way, and can attach documents to their messages.
  // Set at sign-up only; a trigger (drizzle/0005) blocks any change.
  role: text("role", { enum: ["clinician", "admin", "patient", "referrer"] }).notNull().default("clinician"),
  // Clinicians start "pending" and can't see patients until their practice admin
  // activates them. Admins can deactivate (and reactivate) them later; notes are kept.
  status: text("status", { enum: ["pending", "active", "deactivated"] }).notNull().default("pending"),
  // Spec v2 discipline (src/lib/disciplines.ts): decides which notes the clinician can write.
  // Null until they set it in Settings; then the note editor offers only their notes.
  discipline: text("discipline"),
  // The location the clinician is based at (spec v2), set by the admin on the location profile.
  // One location per clinician; removing a location moves its clinicians to one the admin picks.
  locationId: uuid("location_id").references((): AnyPgColumn => locations.id, { onDelete: "set null" }),
  // Default fee for a visit, in minor units of visitFeeCurrency (Settings → Invoicing). Pre-fills
  // the booking form when there's no earlier fee for that type of care.
  visitFeeMinor: integer("visit_fee_minor"),
  visitFeeCurrency: text("visit_fee_currency"),
  // Last invoice number issued. Incremented inside the invoice transaction so
  // numbers are sequential per clinician with no gaps (a Postgres sequence can skip).
  lastInvoiceNumber: integer("last_invoice_number").notNull().default(0),
  // Evening email listing tomorrow's appointments (sent by /api/cron/reminders).
  reminderEmails: boolean("reminder_emails").notNull().default(false),
  // IANA zone (e.g. "Africa/Nairobi") from the clinician's browser, so "tomorrow" and
  // "6 pm" mean their local day and time when the server sends reminders.
  timeZone: text("time_zone"),
  // Local date (YYYY-MM-DD) the last reminder went out, so it's sent once a day.
  lastReminderSentOn: date("last_reminder_sent_on"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  // Patient portal accounts: the date of birth given at sign-up, for the admin to check against
  // the record, and the patient record the admin linked when approving (null until then).
  birthDate: date("birth_date"),
  patientId: uuid("patient_id").references((): AnyPgColumn => patients.id, { onDelete: "set null" }),
  // Referral portal accounts: the hospital, clinic or agency they refer from, given at sign-up.
  organisation: text("organisation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("clinicians_role_check", sql`${t.role} in ('clinician', 'admin', 'patient', 'referrer')`),
  check("clinicians_patient_link_check", sql`${t.role} = 'patient' or ${t.patientId} is null`),
  // One portal account per patient record.
  uniqueIndex("clinicians_patient_idx").on(t.patientId),
  check("clinicians_country_check", sql`${t.country} ~ '^[A-Z]{2}$'`),
  check("clinicians_discipline_check", sql`${t.discipline} is null or ${t.discipline} in ('RN', 'LPN', 'PT', 'OT', 'SLP', 'HHA', 'MH')`),
  check("clinicians_status_check", sql`${t.status} in ('pending', 'active', 'deactivated')`),
  index("clinicians_practice_idx").on(t.practiceId),
  index("clinicians_location_idx").on(t.locationId),
]);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const twoFactors = pgTable(
  "two_factors",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [index("two_factors_secret_idx").on(t.secret), index("two_factors_user_id_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Practice data. Every row is owned by a clinician; always filter by clinicianId.
// ---------------------------------------------------------------------------

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Spec v2: patients belong to the practice. Admins see every one; clinicians still see
    // the patients assigned to them (clinicianId) until the shared patient list is built.
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "restrict" }),
    // The assigned clinician. Null while the admin offers a new patient to the practice's
    // clinicians (patient_offers) and nobody has accepted yet.
    clinicianId: text("clinician_id").references(() => clinicians.id, { onDelete: "restrict" }),
    fullName: text("full_name").notNull(),
    // Age is calculated from this, never stored.
    dateOfBirth: date("date_of_birth").notNull(),
    gender: text("gender"),
    address: text("address"),
    // Where the address is on the map, looked up when the address is saved (src/lib/geocode.ts).
    // Clock-ins on in-person visits are checked against it. Null when it wasn't found.
    homeLat: doublePrecision("home_lat"),
    homeLng: doublePrecision("home_lng"),
    phone: text("phone"),
    // Where this patient's invoices were last emailed; pre-fills the next invoice.
    // Also the "Email" on Add patient ("Used to send their invoices").
    invoiceEmail: text("invoice_email"),
    // Spec v2 Add patient (admins set all of these; see src/lib/patient-options.ts).
    insurer: text("insurer"),
    servicesOrdered: text("services_ordered").array().notNull().default(sql`'{}'::text[]`),
    orderingDoctor: text("ordering_doctor"),
    referralDate: date("referral_date"),
    startOfCare: date("start_of_care"),
    // "merged": a duplicate the admin merged into another record (mergedIntoId); hidden everywhere.
    status: text("status", { enum: ["active", "discharged", "merged"] }).notNull().default("active"),
    mergedIntoId: uuid("merged_into_id").references((): AnyPgColumn => patients.id, { onDelete: "set null" }),
    // Who added the record (an admin or a clinician); kept if that account goes.
    addedById: text("added_by_id").references(() => clinicians.id, { onDelete: "set null" }),
    // Possible duplicate (spec v2 section 5b): a clinician added this patient although the
    // name and date of birth match another practice patient. The admin confirms or merges.
    duplicateOfId: uuid("duplicate_of_id").references((): AnyPgColumn => patients.id, { onDelete: "set null" }),
    duplicateFlaggedAt: timestamp("duplicate_flagged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("patients_clinician_id_idx").on(t.clinicianId),
    index("patients_practice_id_idx").on(t.practiceId),
    check("patients_status_check", sql`${t.status} in ('active', 'discharged', 'merged')`),
    check("patients_home_check", sql`(${t.homeLat} is null) = (${t.homeLng} is null)`),
    // Typo-tolerant name search (pg_trgm).
    index("patients_full_name_trgm_idx").using("gin", sql`${t.fullName} gin_trgm_ops`),
  ],
);

// Fixed standard list, loaded once by `npm run db:seed`. Never edited in the app.
export const diagnosisCodes = pgTable(
  "diagnosis_codes",
  {
    code: text("code").primaryKey(),
    description: text("description").notNull(),
  },
  (t) => [
    index("diagnosis_codes_code_trgm_idx").using("gin", sql`${t.code} gin_trgm_ops`),
    index("diagnosis_codes_description_trgm_idx").using("gin", sql`${t.description} gin_trgm_ops`),
  ],
);

export const patientDiagnoses = pgTable(
  "patient_diagnoses",
  {
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    code: text("code")
      .notNull()
      .references(() => diagnosisCodes.code),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.patientId, t.code] })],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicianId: text("clinician_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    // Not in the spec; the calendar needs an end time to draw the appointment.
    durationMinutes: integer("duration_minutes").notNull().default(60),
    typeOfCare: text("type_of_care").notNull(),
    // Money is stored in minor units of `currency` (cents, fils…) to avoid floating-point errors.
    feeMinor: integer("fee_minor").notNull(),
    // The currency the fee was booked in (the practice's billing currency at the time), so a
    // later change of currency never changes what a visit cost.
    currency: text("currency").notNull().default("USD"),
    // When the visit actually started and ended, recorded by the clinician. Shown on the
    // signed note; locked once the note is signed (trigger in drizzle/0003).
    timeIn: timestamp("time_in", { withTimezone: true }),
    timeOut: timestamp("time_out", { withTimezone: true }),
    // Spec v2: a visit can be marked missed (counted in Performance), with the reason. A missed
    // visit has no note and can't be invoiced (trigger in drizzle/0028).
    missedAt: timestamp("missed_at", { withTimezone: true }),
    missedReason: text("missed_reason"),
    // A virtual (telehealth) visit: clocking in and out isn't checked against the patient's home.
    // It can only change before the clinician clocks in.
    virtual: boolean("virtual").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("appointments_missed_has_reason", sql`(${t.missedAt} is null) = (${t.missedReason} is null)`),
    check("appointments_time_out_after_time_in", sql`${t.timeOut} is null or ${t.timeIn} is null or ${t.timeOut} > ${t.timeIn}`),
    index("appointments_clinician_starts_at_idx").on(t.clinicianId, t.startsAt),
    index("appointments_patient_id_idx").on(t.patientId),
  ],
);

// One note per appointment. Once signedAt is set the note is locked by a
// database trigger (see drizzle/0001_lock_signed_notes.sql); changes go in noteAddenda.
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .unique()
      .references(() => appointments.id, { onDelete: "restrict" }),
    // The written-up note Tiba makes from the sections when it is signed.
    body: text("body").notNull().default(""),
    // Spec v2 note types: "progress" (visit note), "evaluation" (initial evaluation, sets
    // goals), "service_plan" (aide service plan) and "oasis" (OASIS assessment).
    kind: text("kind", { enum: ["progress", "evaluation", "service_plan", "oasis"] }).notNull().default("progress"),
    // Template key from src/lib/note-templates.ts, e.g. "pt", "rn", "hha", "individual".
    care: text("care").notNull().default("individual"),
    // Section answers, keyed by field id (see src/lib/note-templates.ts).
    fields: jsonb("fields").$type<Record<string, unknown>>().notNull().default({}),
    dxCode: text("dx_code").references(() => diagnosisCodes.code),
    // Signatures are PNG data URLs captured with signature_pad.
    clinicianSignature: text("clinician_signature"),
    patientSignature: text("patient_signature"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    // Amendments: each signing is a version. Amending copies the signed version into
    // note_versions first, then reopens the note as version + 1 with the reason.
    version: integer("version").notNull().default(1),
    amendmentReason: text("amendment_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A note can only be marked signed if the clinician actually signed it.
    check("notes_signed_requires_clinician_signature", sql`${t.signedAt} is null or ${t.clinicianSignature} is not null`),
    check("notes_kind_check", sql`${t.kind} in ('progress', 'evaluation', 'service_plan', 'oasis')`),
  ],
);

// Earlier signed versions of an amended note, exactly as they were signed. Never changed or
// deleted (a trigger in drizzle/0015 enforces it).
export const noteVersions = pgTable(
  "note_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    kind: text("kind").notNull(),
    care: text("care").notNull(),
    fields: jsonb("fields").$type<Record<string, unknown>>().notNull(),
    dxCode: text("dx_code"),
    body: text("body").notNull(),
    clinicianSignature: text("clinician_signature").notNull(),
    patientSignature: text("patient_signature"),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
    amendmentReason: text("amendment_reason"),
    timeIn: timestamp("time_in", { withTimezone: true }),
    timeOut: timestamp("time_out", { withTimezone: true }),
    // When it was first set aside for an amendment. Why it was replaced is the next version's
    // amendment_reason (on the next note_versions row, or on the note itself).
    archivedAt: timestamp("archived_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("note_versions_note_version_idx").on(t.noteId, t.version)],
);

export const noteAddenda = pgTable(
  "note_addenda",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("note_addenda_note_id_idx").on(t.noteId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicianId: text("clinician_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "restrict" }),
    number: integer("number").notNull(),
    // The patient billed. Null when the invoice covers visits for several patients: then the
    // clinician bills the practice, and each visit (invoice_items) carries its own patient.
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }),
    totalMinor: integer("total_minor").notNull(),
    // ISO 4217 code, from the practice's country when the invoice was made. Kept on the invoice
    // so a later country change never changes an invoice already sent.
    currency: text("currency").notNull().default("USD"),
    // Spec v2 "Payment due": the invoice date (due on receipt), or 14 or 30 days later.
    dueDate: date("due_date"),
    // Admin side (spec v2 section 5b): Unpaid → Paid, or Issue (flagged) → back to Unpaid or Paid.
    status: text("status", { enum: ["unpaid", "paid", "issue"] }).notNull().default("unpaid"),
    // When the admin first opened it ("New" until then, or Mark all as seen).
    seenAt: timestamp("seen_at", { withTimezone: true }),
    paidOn: date("paid_on"),
    paidMethod: text("paid_method"),
    issueCategory: text("issue_category"),
    issueComment: text("issue_comment"),
    issueFlaggedAt: timestamp("issue_flagged_at", { withTimezone: true }),
    // Set when the invoice PDF was emailed.
    sentTo: text("sent_to"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("invoices_clinician_number_unique").on(t.clinicianId, t.number),
    check("invoices_status_check", sql`${t.status} in ('unpaid', 'paid', 'issue')`),
    index("invoices_patient_id_idx").on(t.patientId),
  ],
);

// The visits included on an invoice. A visit can only be invoiced once.
export const invoiceItems = pgTable(
  "invoice_items",
  {
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .unique()
      .references(() => appointments.id, { onDelete: "restrict" }),
    // Copied from the appointment so the invoice never changes afterwards.
    feeMinor: integer("fee_minor").notNull(),
  },
  (t) => [primaryKey({ columns: [t.invoiceId, t.appointmentId] })],
);

// ---------------------------------------------------------------------------
// Patient reviews (spec v2 section 6). Patients send them without an account from
// /review; only the practice admin reads them, never clinicians.
// ---------------------------------------------------------------------------

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    // "Who did you see?" is optional. Kept if the clinician's account goes.
    clinicianId: text("clinician_id").references(() => clinicians.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    text: text("text").notNull(),
    // Blank means anonymous.
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // When the admin first opened Patient reviews after it arrived; null shows it as New.
    seenAt: timestamp("seen_at", { withTimezone: true }),
    // Admins can hide a review (it leaves the list and the average) but never delete it
    // or change what the patient wrote; drizzle/0010_protect_reviews.sql enforces that.
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    hiddenById: text("hidden_by_id").references(() => clinicians.id, { onDelete: "set null" }),
  },
  (t) => [
    check("reviews_rating_check", sql`${t.rating} between 1 and 5`),
    index("reviews_practice_created_idx").on(t.practiceId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Locations (spec v2 admin Locations): where the practice sees patients.
// Options for facility and services live in src/lib/location-options.ts.
// ---------------------------------------------------------------------------

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    facility: text("facility").notNull(),
    // Optional only for Telehealth (no building to visit).
    address: text("address"),
    services: text("services").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("locations_practice_id_idx").on(t.practiceId),
    check("locations_has_service", sql`cardinality(${t.services}) > 0`),
  ],
);

// In-app notifications (spec v2 section 5b), one row per recipient. Admins get new invoices,
// possible duplicates and new reviews; clinicians get contracts and invoice issues (when those
// screens exist). title, detail and href are written when the notification is made.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "cascade" }),
    // "invoice", "duplicate", "review" (later: "contract", "invoice_issue", "unbilled").
    type: text("type").notNull(),
    // The thing it's about (an invoice, patient or review id), to clear it once handled.
    refId: text("ref_id"),
    title: text("title").notNull(),
    detail: text("detail"),
    // Where it opens: the screen where it's handled.
    href: text("href").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("notifications_recipient_idx").on(t.recipientId, t.readAt)],
);

// Patient and referral portals: one conversation per portal account (a patient or a referral
// source), between that account and the practice's admins. `from_patient` means "from the portal
// account". Referral sources can attach documents (files with owner_kind "message"). Message
// bodies can hold health details: never log them or put them in emails.
export const patientMessages = pgTable(
  "patient_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    // The patient's portal account (the conversation).
    accountId: text("account_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "cascade" }),
    fromPatient: boolean("from_patient").notNull(),
    // Who wrote it: the patient, or the admin who replied.
    authorId: text("author_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // When the other side opened it (the practice for a patient's message, and the reverse).
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("patient_messages_account_idx").on(t.accountId, t.createdAt),
    check("patient_messages_body_check", sql`length(${t.body}) between 1 and 2000`),
  ],
);

// Referral portal: a patient a referral source sends the practice, with the details the practice
// needs to check cover. The admin accepts or declines it (with an optional note the source sees).
// The referral arrives as a portal message (message_id), which carries any documents.
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    // The referral source's portal account.
    referrerId: text("referrer_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => patientMessages.id, { onDelete: "set null" }),
    patientName: text("patient_name").notNull(),
    birthDate: date("birth_date").notNull(),
    insurer: text("insurer").notNull(),
    // Null for self-pay.
    insuranceId: text("insurance_id"),
    // What the patient needs, from the referral source (optional).
    note: text("note"),
    status: text("status", { enum: ["pending", "accepted", "declined"] }).notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedById: text("decided_by_id").references(() => clinicians.id, { onDelete: "set null" }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("referrals_practice_idx").on(t.practiceId, t.createdAt),
    index("referrals_referrer_idx").on(t.referrerId, t.createdAt),
    uniqueIndex("referrals_message_idx").on(t.messageId),
    check("referrals_status_check", sql`${t.status} in ('pending', 'accepted', 'declined')`),
    // Decided referrals say when; waiting ones don't.
    check("referrals_decided_check", sql`(${t.status} = 'pending') = (${t.decidedAt} is null)`),
    check("referrals_patient_name_check", sql`length(${t.patientName}) between 1 and 120`),
    check("referrals_insurer_check", sql`length(${t.insurer}) between 1 and 120`),
    check("referrals_insurance_id_check", sql`${t.insuranceId} is null or length(${t.insuranceId}) between 1 and 60`),
    check("referrals_note_check", sql`${t.note} is null or length(${t.note}) between 1 and 1000`),
    check("referrals_decision_note_check", sql`${t.decisionNote} is null or length(${t.decisionNote}) between 1 and 500`),
  ],
);

// Clocking in and out of a visit (electronic visit verification). The clinician clocks in on
// arrival and out before leaving; the phone's position is compared with the patient's home
// (src/lib/visit-clock.ts), and the patient signs at clock-out. Virtual visits record no
// position. Rows can never be changed or deleted (drizzle/0036), and each one sets the visit's
// time_in or time_out. Admins see them all on /admin/visits and are notified of every one.
export const visitClocks = pgTable(
  "visit_clocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "restrict" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "restrict" }),
    clinicianId: text("clinician_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "restrict" }),
    event: text("event", { enum: ["in", "out"] }).notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    virtual: boolean("virtual").notNull(),
    // "home": within reach of the patient's home; "away": further; "unknown": the phone didn't
    // share its position; "no_home": the patient's address isn't on the map; "virtual".
    place: text("place", { enum: ["home", "away", "unknown", "no_home", "virtual"] }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    accuracyM: integer("accuracy_m"),
    distanceM: integer("distance_m"),
    // The patient's signature at clock-out (a PNG data URL); required for in-person visits.
    patientSignature: text("patient_signature"),
  },
  (t) => [
    unique("visit_clocks_once").on(t.appointmentId, t.event),
    index("visit_clocks_practice_idx").on(t.practiceId, t.at),
    check("visit_clocks_event_check", sql`${t.event} in ('in', 'out')`),
    check("visit_clocks_place_check", sql`${t.place} in ('home', 'away', 'unknown', 'no_home', 'virtual')`),
    check("visit_clocks_virtual_check", sql`(${t.place} = 'virtual') = ${t.virtual}`),
    check("visit_clocks_position_check", sql`(${t.latitude} is null) = (${t.longitude} is null)`),
    check("visit_clocks_distance_check", sql`${t.place} not in ('home', 'away') or ${t.distanceM} is not null`),
    check("visit_clocks_signature_check", sql`${t.event} = 'in' or ${t.virtual} or ${t.patientSignature} is not null`),
  ],
);

// An invoice's history (spec v2: sent, issue flagged, issue resolved, marked paid).
export const invoiceEvents = pgTable(
  "invoice_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["sent", "issue_flagged", "issue_resolved", "paid"] }).notNull(),
    // e.g. "Wrong amount: the fee should be $75" or "Bank transfer, paid 20 Oct 2026".
    detail: text("detail"),
    actorId: text("actor_id").references(() => clinicians.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoice_events_invoice_idx").on(t.invoiceId)],
);

// "Billed to insurance" for a signed note (spec v2 Completed notes and Insurance billing). Kept
// apart from notes because signed notes are locked (drizzle/0001).
export const noteBillings = pgTable("note_billings", {
  noteId: uuid("note_id")
    .primaryKey()
    .references(() => notes.id, { onDelete: "restrict" }),
  billedAt: timestamp("billed_at", { withTimezone: true }).notNull().defaultNow(),
  billedById: text("billed_by_id").references(() => clinicians.id, { onDelete: "set null" }),
});

// Insurance billing reminders sent to the practice admin (spec v2 data: date sent, notes included).
export const billingReminders = pgTable(
  "billing_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    sentById: text("sent_by_id").references(() => clinicians.id, { onDelete: "set null" }),
    sentTo: text("sent_to").notNull(),
    // How many notes were waiting, and how many of those for more than 30 days.
    noteCount: integer("note_count").notNull(),
    overdueCount: integer("overdue_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("billing_reminders_practice_idx").on(t.practiceId, t.createdAt)],
);

// Raw file bytes. PGlite gives Uint8Array, postgres-js a Buffer (also a Uint8Array).
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "bytea" });

// Uploaded files (spec v2 "Documents and files"), stored in the database behind the login until
// hosting is decided. Who can see one follows from what it belongs to (src/lib/files.ts):
//   clinician        the clinician's own Profile documents (resume, W-9); they and their admin
//   clinician_admin  documents the admin keeps about a clinician; admins only
//   patient          clinical documents on a patient (referrals, reports, results); admins
//   location         certificates, leases, policies (PDF only); admins
//   message          documents a referral source attached to a portal message; that account and
//                    admins (owner_id is the message, or "draft:<account id>" until it's sent)
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    ownerKind: text("owner_kind", { enum: ["clinician", "clinician_admin", "patient", "location", "message"] }).notNull(),
    ownerId: text("owner_id").notNull(),
    // For the clinician's Profile: "resume" or "w9" (one each); null for everything else.
    slot: text("slot"),
    name: text("name").notNull(),
    description: text("description"),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    uploadedById: text("uploaded_by_id").references(() => clinicians.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("files_owner_idx").on(t.ownerKind, t.ownerId),
    check("files_owner_kind_check", sql`${t.ownerKind} in ('clinician', 'clinician_admin', 'patient', 'location', 'message')`),
  ],
);

// The clinician's Profile (spec v2 section 5c), plus the emergency contact the admin keeps.
export const clinicianProfiles = pgTable("clinician_profiles", {
  clinicianId: text("clinician_id")
    .primaryKey()
    .references(() => clinicians.id, { onDelete: "cascade" }),
  speciality: text("speciality"),
  licenseNumber: text("license_number"),
  licenseIssuer: text("license_issuer"),
  licenseExpiry: date("license_expiry"),
  // [{ id, level, course, school, year }]
  education: jsonb("education").$type<EducationEntry[]>().notNull().default([]),
  // [{ id, name, issuer, expiry }]
  certifications: jsonb("certifications").$type<Certification[]>().notNull().default([]),
  // Career experience, newest first: [{ id, role, employer, start, end, summary }] (months as "YYYY-MM").
  experience: jsonb("experience").$type<ExperienceEntry[]>().notNull().default([]),
  // Contact details the clinician keeps up to date (the sign-in email stays separate).
  phone: text("phone"),
  contactEmail: text("contact_email"),
  address: text("address"),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  // The emergency contact: the clinician fills it in on Profile; the admin can correct it.
  emergencyName: text("emergency_name"),
  emergencyRelationship: text("emergency_relationship"),
  emergencyPhone: text("emergency_phone"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EducationEntry = { id: string; level: string; course: string; school: string; year: string };
export type Certification = { id: string; name: string; issuer: string; expiry: string };
/** `end` is "" while it's the clinician's current role. */
export type ExperienceEntry = { id: string; role: string; employer: string; start: string; end: string; summary: string };
export type ContractTerms = { start: string; length: string; pay: string; role: string; extra: string };
export type Letterhead = { address: string; phone: string; email: string; image: string | null };

// Contracts (spec v2 section 5c): Draft, Sent, Feedback (a message instead of signing), Signed.
// Signed contracts are locked by a trigger (drizzle/0024).
export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    // "CT-2026-07", gap-free per practice (practices.last_contract_number).
    label: text("label").notNull(),
    clinicianId: text("clinician_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    terms: jsonb("terms").$type<ContractTerms>().notNull(),
    // The letterhead as it was when sent, so later changes never alter a sent contract.
    letterhead: jsonb("letterhead").$type<Letterhead>(),
    status: text("status", { enum: ["draft", "sent", "feedback", "signed"] }).notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    adminSignature: text("admin_signature"),
    adminSignedName: text("admin_signed_name"),
    adminSignedAt: timestamp("admin_signed_at", { withTimezone: true }),
    clinicianSignature: text("clinician_signature"),
    clinicianSignedAt: timestamp("clinician_signed_at", { withTimezone: true }),
    seenByAdminAt: timestamp("seen_by_admin_at", { withTimezone: true }),
    seenByClinicianAt: timestamp("seen_by_clinician_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("contracts_practice_label_unique").on(t.practiceId, t.label),
    index("contracts_clinician_idx").on(t.clinicianId),
    check("contracts_status_check", sql`${t.status} in ('draft', 'sent', 'feedback', 'signed')`),
    check(
      "contracts_signed_needs_signatures",
      sql`${t.status} <> 'signed' or (${t.adminSignature} is not null and ${t.clinicianSignature} is not null)`,
    ),
  ],
);

// One message thread per contract. Messages can't be edited or deleted (drizzle/0024).
export const contractMessages = pgTable(
  "contract_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "restrict" }),
    authorId: text("author_id").references(() => clinicians.id, { onDelete: "set null" }),
    fromRole: text("from_role", { enum: ["admin", "clinician"] }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contract_messages_contract_idx").on(t.contractId)],
);

export type AgreementSection = { h: string; text: string };

// Service agreements (spec v2 section 5): one per patient, signed by the patient and the admin on
// the device. Locked once both have signed (drizzle/0024).
export const serviceAgreements = pgTable("service_agreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id")
    .notNull()
    .unique()
    .references(() => patients.id, { onDelete: "restrict" }),
  // The wording as signed: the practice's clauses with the details filled in, fixed at the first signature.
  sections: jsonb("sections").$type<AgreementSection[]>().notNull(),
  // The form's details (client, emergency contact, insurance, services, rates, deposit,
  // authorizations, decision, initials, who signs). See AgreementDetails. Null on early agreements.
  details: jsonb("details").$type<Record<string, unknown>>(),
  // The client (or responsible party) refused to sign; the agency witness signs to record it.
  refused: boolean("refused").notNull().default(false),
  parties: text("parties").notNull(),
  patientSignature: text("patient_signature"),
  patientSignedAt: timestamp("patient_signed_at", { withTimezone: true }),
  adminSignature: text("admin_signature"),
  adminSignedName: text("admin_signed_name"),
  adminSignedAt: timestamp("admin_signed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Offering a new patient (decided 31 Oct 2026; src/lib/patient-offers.ts): instead of picking a
// clinician, the admin offers the patient to every active clinician whose discipline does that
// type of care (`service`, a SERVICES value). Each is emailed; the first to accept becomes the
// patient's clinician. "closed": the admin assigned someone else, or discharged the patient.
export const patientOffers = pgTable(
  "patient_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    status: text("status", { enum: ["open", "taken", "closed"] }).notNull().default("open"),
    offeredById: text("offered_by_id").references(() => clinicians.id, { onDelete: "set null" }),
    // How many clinicians it went to when it was offered.
    offeredTo: integer("offered_to").notNull(),
    offeredAt: timestamp("offered_at", { withTimezone: true }).notNull().defaultNow(),
    takenById: text("taken_by_id").references(() => clinicians.id, { onDelete: "restrict" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    // One open offer per patient at a time.
    uniqueIndex("patient_offers_open_idx").on(t.patientId).where(sql`status = 'open'`),
    index("patient_offers_practice_idx").on(t.practiceId, t.status),
    check("patient_offers_status_check", sql`${t.status} in ('open', 'taken', 'closed')`),
    check("patient_offers_closed_check", sql`(${t.status} = 'open') = (${t.closedAt} is null)`),
    check("patient_offers_taken_check", sql`(${t.status} = 'taken') = (${t.takenById} is not null)`),
  ],
);
