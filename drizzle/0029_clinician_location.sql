ALTER TABLE "clinicians" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clinicians_location_idx" ON "clinicians" USING btree ("location_id");