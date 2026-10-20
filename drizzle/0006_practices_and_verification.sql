CREATE TABLE "practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"logo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practices_name_key_unique" UNIQUE("name_key"),
	CONSTRAINT "practices_country_check" CHECK ("practices"."country" in ('US', 'KE'))
);
--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "practice_id" uuid;--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
-- Accounts made before practices existed: one practice per practice name (the oldest
-- account's country and logo win), every account linked to it and left active.
-- The name key must match normalisePracticeName in src/lib/practice-name.ts.
INSERT INTO "practices" ("name", "name_key", "country", "logo")
SELECT DISTINCT ON (k) "practice_name", k, "country", "practice_logo"
FROM (SELECT *, COALESCE(NULLIF(trim(regexp_replace(lower("practice_name"), '[^a-z0-9]+', ' ', 'g')), ''), lower(trim("practice_name"))) AS k FROM "clinicians") c
ORDER BY k, "created_at";--> statement-breakpoint
UPDATE "clinicians" c SET "practice_id" = p."id", "status" = 'active'
FROM "practices" p WHERE p."name_key" = COALESCE(NULLIF(trim(regexp_replace(lower(c."practice_name"), '[^a-z0-9]+', ' ', 'g')), ''), lower(trim(c."practice_name")));--> statement-breakpoint
ALTER TABLE "clinicians" ALTER COLUMN "practice_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clinicians_practice_idx" ON "clinicians" USING btree ("practice_id");--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_status_check" CHECK ("clinicians"."status" in ('pending', 'active', 'deactivated'));