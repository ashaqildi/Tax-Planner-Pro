import { pgTable, serial, integer, numeric, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const estimatedPaymentsTable = pgTable("estimated_payments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  taxYear: integer("tax_year").notNull(),
  quarter: integer("quarter").notNull(),
  paymentType: text("payment_type").notNull(),
  entityName: text("entity_name"),
  dueDate: date("due_date").notNull(),
  amountDue: numeric("amount_due", { precision: 12, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }),
  confirmationNumber: text("confirmation_number"),
  paidDate: date("paid_date"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEstimatedPaymentSchema = createInsertSchema(estimatedPaymentsTable).omit({ id: true, updatedAt: true });
export type InsertEstimatedPayment = z.infer<typeof insertEstimatedPaymentSchema>;
export type EstimatedPayment = typeof estimatedPaymentsTable.$inferSelect;
