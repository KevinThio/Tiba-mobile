CREATE TABLE "patient_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"from_patient" boolean NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "patient_messages_body_check" CHECK (length("patient_messages"."body") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "clinicians" DROP CONSTRAINT "clinicians_role_check";--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "patient_id" uuid;--> statement-breakpoint
ALTER TABLE "patient_messages" ADD CONSTRAINT "patient_messages_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_messages" ADD CONSTRAINT "patient_messages_account_id_clinicians_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."clinicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_messages" ADD CONSTRAINT "patient_messages_author_id_clinicians_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."clinicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_messages_account_idx" ON "patient_messages" USING btree ("account_id","created_at");--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clinicians_patient_idx" ON "clinicians" USING btree ("patient_id");--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_patient_link_check" CHECK ("clinicians"."role" = 'patient' or "clinicians"."patient_id" is null);--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_role_check" CHECK ("clinicians"."role" in ('clinician', 'admin', 'patient'));