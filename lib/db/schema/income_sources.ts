import { pgTable, serial, integer, numeric, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export interface W2Entry {
  id: string;
  label: string;
  wages: number;
  federalWithheld: number;
  stateWithheld: number;
}

export interface ScorpEntry {
  id: string;
  name: string;
  ownershipPct: number;
  ordinaryIncome: number;
  otherIncome: number;
  pteElection?: boolean;
}

export const incomeSourcesTable = pgTable("income_sources", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  taxYear: integer("tax_year").notNull(),
  // Dynamic entries (new)
  w2Entries: jsonb("w2_entries").$type<W2Entry[]>(),
  scorpEntries: jsonb("scorp_entries").$type<ScorpEntry[]>(),
  // Legacy scalar fields (kept for backward compat)
  w2Wages: numeric("w2_wages", { precision: 12, scale: 2 }),
  interest1099: numeric("interest_1099", { precision: 12, scale: 2 }),
  dividends1099: numeric("dividends_1099", { precision: 12, scale: 2 }),
  qualifiedDividends: numeric("qualified_dividends", { precision: 12, scale: 2 }),
  nec1099: numeric("nec_1099", { precision: 12, scale: 2 }),
  misc1099: numeric("misc_1099", { precision: 12, scale: 2 }),
  scorpK1Ordinary: numeric("scorp_k1_ordinary", { precision: 12, scale: 2 }),
  scorpK1OtherIncome: numeric("scorp_k1_other_income", { precision: 12, scale: 2 }),
  partnershipK1Ordinary: numeric("partnership_k1_ordinary", { precision: 12, scale: 2 }),
  partnershipK1OtherIncome: numeric("partnership_k1_other_income", { precision: 12, scale: 2 }),
  rentalIncome: numeric("rental_income", { precision: 12, scale: 2 }),
  capitalGainsShortTerm: numeric("capital_gains_short_term", { precision: 12, scale: 2 }),
  capitalGainsLongTerm: numeric("capital_gains_long_term", { precision: 12, scale: 2 }),
  socialSecurity: numeric("social_security", { precision: 12, scale: 2 }),
  pensionRetirement: numeric("pension_retirement", { precision: 12, scale: 2 }),
  otherIncome: numeric("other_income", { precision: 12, scale: 2 }),
  federalWithheld: numeric("federal_withheld", { precision: 12, scale: 2 }),
  stateWithheld: numeric("state_withheld", { precision: 12, scale: 2 }),
  priorYearFederalTax: numeric("prior_year_federal_tax", { precision: 12, scale: 2 }),
  priorYearStateTax: numeric("prior_year_state_tax", { precision: 12, scale: 2 }),
  itemizedDeductions: numeric("itemized_deductions", { precision: 12, scale: 2 }),
  applyQbiDeduction: boolean("apply_qbi_deduction").default(false),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIncomeSourceSchema = createInsertSchema(incomeSourcesTable).omit({ id: true, updatedAt: true });
export type InsertIncomeSource = z.infer<typeof insertIncomeSourceSchema>;
export type IncomeSource = typeof incomeSourcesTable.$inferSelect;
