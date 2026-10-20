CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"name" text NOT NULL,
	"facility" text NOT NULL,
	"address" text,
	"services" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_has_service" CHECK (cardinality("locations"."services") > 0)
);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "locations_practice_id_idx" ON "locations" USING btree ("practice_id");