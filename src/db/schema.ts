import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

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
  practiceName: text("practice_name").notNull(),
  // Last invoice number issued. Incremented inside the invoice transaction so
  // numbers are sequential per clinician with no gaps (a Postgres sequence can skip).
  lastInvoiceNumber: integer("last_invoice_number").notNull().default(0),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    clinicianId: text("clinician_id")
      .notNull()
      .references(() => clinicians.id, { onDelete: "restrict" }),
    fullName: text("full_name").notNull(),
    // Age is calculated from this, never stored.
    dateOfBirth: date("date_of_birth").notNull(),
    gender: text("gender"),
    address: text("address"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("patients_clinician_id_idx").on(t.clinicianId),
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
    // Money is stored in minor units (cents) to avoid floating-point errors.
    feeMinor: integer("fee_minor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
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
    body: text("body").notNull().default(""),
    // Signatures are PNG data URLs captured with signature_pad.
    clinicianSignature: text("clinician_signature"),
    patientSignature: text("patient_signature"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A note can only be marked signed if the clinician actually signed it.
    check("notes_signed_requires_clinician_signature", sql`${t.signedAt} is null or ${t.clinicianSignature} is not null`),
  ],
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
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    totalMinor: integer("total_minor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("invoices_clinician_number_unique").on(t.clinicianId, t.number),
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
