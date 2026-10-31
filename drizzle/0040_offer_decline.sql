ALTER TABLE "patient_offer_responses" ADD COLUMN "answer" text DEFAULT 'accepted' NOT NULL;--> statement-breakpoint
ALTER TABLE "patient_offer_responses" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "patient_offer_responses" ADD CONSTRAINT "patient_offer_responses_answer_check" CHECK ("patient_offer_responses"."answer" in ('accepted', 'declined'));--> statement-breakpoint
ALTER TABLE "patient_offer_responses" ADD CONSTRAINT "patient_offer_responses_reason_check" CHECK ("patient_offer_responses"."answer" = 'declined' or "patient_offer_responses"."reason" is null);