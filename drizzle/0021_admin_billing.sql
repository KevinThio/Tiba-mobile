CREATE TABLE "invoice_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"detail" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_billings" (
	"note_id" uuid PRIMARY KEY NOT NULL,
	"billed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"billed_by_id" text
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "status" text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_on" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_method" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issue_category" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issue_comment" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issue_flagged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_actor_id_clinicians_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."clinicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_billings" ADD CONSTRAINT "note_billings_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_billings" ADD CONSTRAINT "note_billings_billed_by_id_clinicians_id_fk" FOREIGN KEY ("billed_by_id") REFERENCES "public"."clinicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_events_invoice_idx" ON "invoice_events" USING btree ("invoice_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" in ('unpaid', 'paid', 'issue'));--> statement-breakpoint
-- Every invoice made so far was sent: start its history.
INSERT INTO "invoice_events" ("invoice_id", "kind", "actor_id", "created_at") SELECT "id", 'sent', "clinician_id", "created_at" FROM "invoices";
