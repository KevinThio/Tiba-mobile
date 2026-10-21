CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"recipient_id" text NOT NULL,
	"type" text NOT NULL,
	"ref_id" text,
	"title" text NOT NULL,
	"detail" text,
	"href" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "discipline" text;--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "visit_fee_minor" integer;--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "visit_fee_currency" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_clinicians_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."clinicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id","read_at");--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_discipline_check" CHECK ("clinicians"."discipline" is null or "clinicians"."discipline" in ('RN', 'LPN', 'PT', 'OT', 'SLP', 'HHA', 'MH'));