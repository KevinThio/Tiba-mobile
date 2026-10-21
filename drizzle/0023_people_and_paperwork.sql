CREATE TABLE "clinician_profiles" (
	"clinician_id" text PRIMARY KEY NOT NULL,
	"speciality" text,
	"license_number" text,
	"license_issuer" text,
	"license_expiry" date,
	"education" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emergency_name" text,
	"emergency_relationship" text,
	"emergency_phone" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"author_id" text,
	"from_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"label" text NOT NULL,
	"clinician_id" text NOT NULL,
	"type" text NOT NULL,
	"terms" jsonb NOT NULL,
	"letterhead" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"admin_signature" text,
	"admin_signed_name" text,
	"admin_signed_at" timestamp with time zone,
	"clinician_signature" text,
	"clinician_signed_at" timestamp with time zone,
	"seen_by_admin_at" timestamp with time zone,
	"seen_by_clinician_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_practice_label_unique" UNIQUE("practice_id","label"),
	CONSTRAINT "contracts_status_check" CHECK ("contracts"."status" in ('draft', 'sent', 'feedback', 'signed')),
	CONSTRAINT "contracts_signed_needs_signatures" CHECK ("contracts"."status" <> 'signed' or ("contracts"."admin_signature" is not null and "contracts"."clinician_signature" is not null))
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"owner_kind" text NOT NULL,
	"owner_id" text NOT NULL,
	"slot" text,
	"name" text NOT NULL,
	"description" text,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_owner_kind_check" CHECK ("files"."owner_kind" in ('clinician', 'clinician_admin', 'patient', 'location'))
);
--> statement-breakpoint
CREATE TABLE "service_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"sections" jsonb NOT NULL,
	"parties" text NOT NULL,
	"patient_signature" text,
	"patient_signed_at" timestamp with time zone,
	"admin_signature" text,
	"admin_signed_name" text,
	"admin_signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_agreements_patient_id_unique" UNIQUE("patient_id")
);
--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "letterhead_address" text;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "letterhead_phone" text;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "letterhead_email" text;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "letterhead_image" text;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "last_contract_number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clinician_profiles" ADD CONSTRAINT "clinician_profiles_clinician_id_clinicians_id_fk" FOREIGN KEY ("clinician_id") REFERENCES "public"."clinicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_messages" ADD CONSTRAINT "contract_messages_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_messages" ADD CONSTRAINT "contract_messages_author_id_clinicians_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."clinicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clinician_id_clinicians_id_fk" FOREIGN KEY ("clinician_id") REFERENCES "public"."clinicians"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_clinicians_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."clinicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_agreements" ADD CONSTRAINT "service_agreements_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_agreements" ADD CONSTRAINT "service_agreements_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_messages_contract_idx" ON "contract_messages" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contracts_clinician_idx" ON "contracts" USING btree ("clinician_id");--> statement-breakpoint
CREATE INDEX "files_owner_idx" ON "files" USING btree ("owner_kind","owner_id");