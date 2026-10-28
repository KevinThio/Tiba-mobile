CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"referrer_id" text NOT NULL,
	"message_id" uuid,
	"patient_name" text NOT NULL,
	"birth_date" date NOT NULL,
	"insurer" text NOT NULL,
	"insurance_id" text,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_id" text,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_status_check" CHECK ("referrals"."status" in ('pending', 'accepted', 'declined')),
	CONSTRAINT "referrals_decided_check" CHECK (("referrals"."status" = 'pending') = ("referrals"."decided_at" is null)),
	CONSTRAINT "referrals_patient_name_check" CHECK (length("referrals"."patient_name") between 1 and 120),
	CONSTRAINT "referrals_insurer_check" CHECK (length("referrals"."insurer") between 1 and 120),
	CONSTRAINT "referrals_insurance_id_check" CHECK ("referrals"."insurance_id" is null or length("referrals"."insurance_id") between 1 and 60),
	CONSTRAINT "referrals_note_check" CHECK ("referrals"."note" is null or length("referrals"."note") between 1 and 1000),
	CONSTRAINT "referrals_decision_note_check" CHECK ("referrals"."decision_note" is null or length("referrals"."decision_note") between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_clinicians_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."clinicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_message_id_patient_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."patient_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_decided_by_id_clinicians_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."clinicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referrals_practice_idx" ON "referrals" USING btree ("practice_id","created_at");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_message_idx" ON "referrals" USING btree ("message_id");