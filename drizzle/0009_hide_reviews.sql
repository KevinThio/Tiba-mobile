ALTER TABLE "reviews" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "hidden_by_id" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hidden_by_id_clinicians_id_fk" FOREIGN KEY ("hidden_by_id") REFERENCES "public"."clinicians"("id") ON DELETE set null ON UPDATE no action;