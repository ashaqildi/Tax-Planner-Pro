-- Schema only; generated from lib/db/src/schema. No customer records or secrets.
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"filing_status" text DEFAULT 'single' NOT NULL,
	"pte_election" boolean DEFAULT false NOT NULL,
	"scorporation_name" text,
	"scorporation_ein" text,
	"current_tax_year" integer DEFAULT 2025 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "income_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"tax_year" integer NOT NULL,
	"w2_entries" jsonb,
	"scorp_entries" jsonb,
	"w2_wages" numeric(12, 2),
	"interest_1099" numeric(12, 2),
	"dividends_1099" numeric(12, 2),
	"qualified_dividends" numeric(12, 2),
	"nec_1099" numeric(12, 2),
	"misc_1099" numeric(12, 2),
	"scorp_k1_ordinary" numeric(12, 2),
	"scorp_k1_other_income" numeric(12, 2),
	"partnership_k1_ordinary" numeric(12, 2),
	"partnership_k1_other_income" numeric(12, 2),
	"rental_income" numeric(12, 2),
	"capital_gains_short_term" numeric(12, 2),
	"capital_gains_long_term" numeric(12, 2),
	"social_security" numeric(12, 2),
	"pension_retirement" numeric(12, 2),
	"other_income" numeric(12, 2),
	"federal_withheld" numeric(12, 2),
	"state_withheld" numeric(12, 2),
	"prior_year_federal_tax" numeric(12, 2),
	"prior_year_state_tax" numeric(12, 2),
	"itemized_deductions" numeric(12, 2),
	"apply_qbi_deduction" boolean DEFAULT false,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "estimated_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"tax_year" integer NOT NULL,
	"quarter" integer NOT NULL,
	"payment_type" text NOT NULL,
	"entity_name" text,
	"due_date" date NOT NULL,
	"amount_due" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2),
	"confirmation_number" text,
	"paid_date" date,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "estimated_payments" ADD CONSTRAINT "estimated_payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
