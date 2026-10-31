CREATE TABLE "patient_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"service" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"offered_by_id" text,
	"offered_to" integer NOT NULL,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"taken_by_id" text,
	"closed_at" timestamp with time zone,
	CONSTRAINT "patient_offers_status_check" CHECK ("patient_offers"."status" in ('open', 'taken', 'closed')),
	CONSTRAINT "patient_offers_closed_check" CHECK (("patient_offers"."status" = 'open') = ("patient_offers"."closed_at" is null)),
	CONSTRAINT "patient_offers_taken_check" CHECK (("patient_offers"."status" = 'taken') = ("patient_offers"."taken_by_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "clinician_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patient_offers" ADD CONSTRAINT "patient_offers_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_offers" ADD CONSTRAINT "patient_offers_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_offers" ADD CONSTRAINT "patient_offers_offered_by_id_clinicians_id_fk" FOREIGN KEY ("offered_by_id") REFERENCES "public"."clinicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_offers" ADD CONSTRAINT "patient_offers_taken_by_id_clinicians_id_fk" FOREIGN KEY ("taken_by_id") REFERENCES "public"."clinicians"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "patient_offers_open_idx" ON "patient_offers" USING btree ("patient_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "patient_offers_practice_idx" ON "patient_offers" USING btree ("practice_id","status");