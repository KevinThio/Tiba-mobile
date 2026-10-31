CREATE TABLE "visit_clocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"clinician_id" text NOT NULL,
	"event" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"virtual" boolean NOT NULL,
	"place" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_m" integer,
	"distance_m" integer,
	"patient_signature" text,
	CONSTRAINT "visit_clocks_once" UNIQUE("appointment_id","event"),
	CONSTRAINT "visit_clocks_event_check" CHECK ("visit_clocks"."event" in ('in', 'out')),
	CONSTRAINT "visit_clocks_place_check" CHECK ("visit_clocks"."place" in ('home', 'away', 'unknown', 'no_home', 'virtual')),
	CONSTRAINT "visit_clocks_virtual_check" CHECK (("visit_clocks"."place" = 'virtual') = "visit_clocks"."virtual"),
	CONSTRAINT "visit_clocks_position_check" CHECK (("visit_clocks"."latitude" is null) = ("visit_clocks"."longitude" is null)),
	CONSTRAINT "visit_clocks_distance_check" CHECK ("visit_clocks"."place" not in ('home', 'away') or "visit_clocks"."distance_m" is not null),
	CONSTRAINT "visit_clocks_signature_check" CHECK ("visit_clocks"."event" = 'in' or "visit_clocks"."virtual" or "visit_clocks"."patient_signature" is not null)
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "virtual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "home_lat" double precision;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "home_lng" double precision;--> statement-breakpoint
ALTER TABLE "visit_clocks" ADD CONSTRAINT "visit_clocks_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_clocks" ADD CONSTRAINT "visit_clocks_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_clocks" ADD CONSTRAINT "visit_clocks_clinician_id_clinicians_id_fk" FOREIGN KEY ("clinician_id") REFERENCES "public"."clinicians"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_clocks_practice_idx" ON "visit_clocks" USING btree ("practice_id","at");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_home_check" CHECK (("patients"."home_lat" is null) = ("patients"."home_lng" is null));