CREATE TABLE "patient_offer_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"clinician_id" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_offer_responses_once" UNIQUE("offer_id","clinician_id")
);
--> statement-breakpoint
ALTER TABLE "clinicians" DROP CONSTRAINT "clinicians_discipline_check";--> statement-breakpoint
ALTER TABLE "patient_offer_responses" ADD CONSTRAINT "patient_offer_responses_offer_id_patient_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."patient_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_offer_responses" ADD CONSTRAINT "patient_offer_responses_clinician_id_clinicians_id_fk" FOREIGN KEY ("clinician_id") REFERENCES "public"."clinicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_offer_responses_offer_idx" ON "patient_offer_responses" USING btree ("offer_id","accepted_at");--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_discipline_check" CHECK ("clinicians"."discipline" is null or "clinicians"."discipline" in ('RN', 'LPN', 'PT', 'OT', 'SLP', 'HHA', 'MH', 'MSW'));