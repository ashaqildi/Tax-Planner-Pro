import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientsTable, incomeSourcesTable, estimatedPaymentsTable } from "@workspace/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { calculateTaxSummary } from "../lib/taxCalculator.js";
import type { FilingStatus, ScorpEntry } from "../lib/taxCalculator.js";

const router: IRouter = Router();

function serializeClient(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    filingStatus: c.filingStatus,
    pteElection: c.pteElection,
    scorporationName: c.scorporationName,
    scorporationEin: c.scorporationEin,
    currentTaxYear: c.currentTaxYear,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function serializeIncome(i: typeof incomeSourcesTable.$inferSelect) {
  const toNum = (v: string | null) => (v !== null ? parseFloat(v) : null);
  return {
    id: i.id,
    clientId: i.clientId,
    taxYear: i.taxYear,
    w2Entries: (i.w2Entries as any[]) ?? [],
    scorpEntries: (i.scorpEntries as any[]) ?? [],
    w2Wages: toNum(i.w2Wages),
    interest1099: toNum(i.interest1099),
    dividends1099: toNum(i.dividends1099),
    qualifiedDividends: toNum(i.qualifiedDividends),
    nec1099: toNum(i.nec1099),
    misc1099: toNum(i.misc1099),
    scorpK1Ordinary: toNum(i.scorpK1Ordinary),
    scorpK1OtherIncome: toNum(i.scorpK1OtherIncome),
    partnershipK1Ordinary: toNum(i.partnershipK1Ordinary),
    partnershipK1OtherIncome: toNum(i.partnershipK1OtherIncome),
    rentalIncome: toNum(i.rentalIncome),
    capitalGainsShortTerm: toNum(i.capitalGainsShortTerm),
    capitalGainsLongTerm: toNum(i.capitalGainsLongTerm),
    socialSecurity: toNum(i.socialSecurity),
    pensionRetirement: toNum(i.pensionRetirement),
    otherIncome: toNum(i.otherIncome),
    federalWithheld: toNum(i.federalWithheld),
    stateWithheld: toNum(i.stateWithheld),
    priorYearFederalTax: toNum(i.priorYearFederalTax),
    priorYearStateTax: toNum(i.priorYearStateTax),
    itemizedDeductions: toNum(i.itemizedDeductions),
    applyQbiDeduction: i.applyQbiDeduction ?? false,
    notes: i.notes,
    updatedAt: i.updatedAt.toISOString(),
  };
}

function serializePayment(p: typeof estimatedPaymentsTable.$inferSelect) {
  const toNum = (v: string | null) => (v !== null ? parseFloat(v) : null);
  return {
    id: p.id,
    clientId: p.clientId,
    taxYear: p.taxYear,
    quarter: p.quarter,
    paymentType: p.paymentType,
    entityName: p.entityName ?? null,
    dueDate: p.dueDate,
    amountDue: toNum(p.amountDue) ?? 0,
    amountPaid: toNum(p.amountPaid),
    confirmationNumber: p.confirmationNumber,
    paidDate: p.paidDate,
    notes: p.notes,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function getQuarterDueDates(year: number): Record<number, string> {
  return {
    1: `${year}-04-15`,
    2: `${year}-06-15`,
    3: `${year}-09-15`,
    4: `${year + 1}-01-15`,
  };
}

async function ensurePaymentRecords(
  clientId: number,
  taxYear: number,
  scorpEntries: ScorpEntry[],
  globalPteElection: boolean
) {
  const existing = await db
    .select()
    .from(estimatedPaymentsTable)
    .where(and(eq(estimatedPaymentsTable.clientId, clientId), eq(estimatedPaymentsTable.taxYear, taxYear)));

  const multipleEntities = scorpEntries.length > 1;

  // When scorp entries with names exist, purge any null-entity business records
  // (they are stale from a legacy state before entities were named)
  if (scorpEntries.length > 0) {
    const nullEntityBizIds = existing
      .filter(p => (p.paymentType === "state_business_pte" || p.paymentType === "state_business_replacement") && p.entityName === null)
      .map(p => p.id);
    if (nullEntityBizIds.length > 0) {
      await db.delete(estimatedPaymentsTable).where(inArray(estimatedPaymentsTable.id, nullEntityBizIds));
      // Remove them from our working set
      const deletedSet = new Set(nullEntityBizIds);
      existing.splice(0, existing.length, ...existing.filter(p => !deletedSet.has(p.id)));
    }
  }

  const existingKeys = new Set(
    existing.map((p) => `${p.quarter}|${p.paymentType}|${p.entityName ?? ""}`)
  );
  const dueDates = getQuarterDueDates(taxYear);
  const toInsert: any[] = [];

  for (const quarter of [1, 2, 3, 4]) {
    const dueDate = dueDates[quarter];

    // Non-entity records (always created)
    if (!existingKeys.has(`${quarter}|federal_individual|`)) {
      toInsert.push({ clientId, taxYear, quarter, paymentType: "federal_individual", entityName: null, dueDate, amountDue: "0" });
    }
    if (!existingKeys.has(`${quarter}|state_individual|`)) {
      toInsert.push({ clientId, taxYear, quarter, paymentType: "state_individual", entityName: null, dueDate, amountDue: "0" });
    }

    if (scorpEntries.length > 0) {
      // Per-entity business records
      for (const entry of scorpEntries) {
        const entityName = entry.name || "S-Corporation";
        const entryPte = multipleEntities
          ? (entry.pteElection !== undefined ? entry.pteElection : globalPteElection)
          : globalPteElection;

        // Always create replacement record
        if (!existingKeys.has(`${quarter}|state_business_replacement|${entityName}`)) {
          toInsert.push({ clientId, taxYear, quarter, paymentType: "state_business_replacement", entityName, dueDate, amountDue: "0" });
        }
        // PTE record: always create (amount will be $0 if PTE not elected, updated later)
        if (!existingKeys.has(`${quarter}|state_business_pte|${entityName}`)) {
          toInsert.push({ clientId, taxYear, quarter, paymentType: "state_business_pte", entityName, dueDate, amountDue: "0" });
        }
      }
    } else {
      // Legacy: no scorp entries — create null-entity business records
      if (!existingKeys.has(`${quarter}|state_business_pte|`)) {
        toInsert.push({ clientId, taxYear, quarter, paymentType: "state_business_pte", entityName: null, dueDate, amountDue: "0" });
      }
      if (!existingKeys.has(`${quarter}|state_business_replacement|`)) {
        toInsert.push({ clientId, taxYear, quarter, paymentType: "state_business_replacement", entityName: null, dueDate, amountDue: "0" });
      }
    }
  }

  if (toInsert.length > 0) {
    await db.insert(estimatedPaymentsTable).values(toInsert);
  }
}

async function updatePaymentAmounts(
  clientId: number,
  taxYear: number,
  income: typeof incomeSourcesTable.$inferSelect | null,
  filingStatus: FilingStatus,
  globalPteElection: boolean
) {
  if (!income) return;

  const toNum = (v: string | null) => (v !== null ? parseFloat(v) : 0);
  const scorpEntries: ScorpEntry[] = (income.scorpEntries as ScorpEntry[]) ?? [];

  const summary = calculateTaxSummary(
    {
      w2Entries: (income.w2Entries as any[]) ?? [],
      scorpEntries,
      w2Wages: toNum(income.w2Wages),
      interest1099: toNum(income.interest1099),
      dividends1099: toNum(income.dividends1099),
      qualifiedDividends: toNum(income.qualifiedDividends),
      nec1099: toNum(income.nec1099),
      misc1099: toNum(income.misc1099),
      scorpK1Ordinary: toNum(income.scorpK1Ordinary),
      scorpK1OtherIncome: toNum(income.scorpK1OtherIncome),
      partnershipK1Ordinary: toNum(income.partnershipK1Ordinary),
      partnershipK1OtherIncome: toNum(income.partnershipK1OtherIncome),
      rentalIncome: toNum(income.rentalIncome),
      capitalGainsShortTerm: toNum(income.capitalGainsShortTerm),
      capitalGainsLongTerm: toNum(income.capitalGainsLongTerm),
      socialSecurity: toNum(income.socialSecurity),
      pensionRetirement: toNum(income.pensionRetirement),
      otherIncome: toNum(income.otherIncome),
      federalWithheld: toNum(income.federalWithheld),
      stateWithheld: toNum(income.stateWithheld),
      priorYearFederalTax: toNum(income.priorYearFederalTax),
      priorYearStateTax: toNum(income.priorYearStateTax),
      itemizedDeductions: toNum(income.itemizedDeductions),
      applyQbiDeduction: (income as any).applyQbiDeduction ?? false,
    },
    filingStatus,
    globalPteElection,
    taxYear
  );

  for (const q of summary.quarters) {
    // Update non-entity payments
    await db
      .update(estimatedPaymentsTable)
      .set({ amountDue: String(q.federalIndividualDue), updatedAt: new Date() })
      .where(and(
        eq(estimatedPaymentsTable.clientId, clientId),
        eq(estimatedPaymentsTable.taxYear, taxYear),
        eq(estimatedPaymentsTable.quarter, q.quarter),
        eq(estimatedPaymentsTable.paymentType, "federal_individual"),
        isNull(estimatedPaymentsTable.entityName)
      ));

    await db
      .update(estimatedPaymentsTable)
      .set({ amountDue: String(q.stateIndividualDue), updatedAt: new Date() })
      .where(and(
        eq(estimatedPaymentsTable.clientId, clientId),
        eq(estimatedPaymentsTable.taxYear, taxYear),
        eq(estimatedPaymentsTable.quarter, q.quarter),
        eq(estimatedPaymentsTable.paymentType, "state_individual"),
        isNull(estimatedPaymentsTable.entityName)
      ));

    if (scorpEntries.length > 0) {
      // Update per-entity business payments
      for (const entity of summary.entityBreakdowns) {
        // Always update PTE amount — zero it out when PTE is not elected so stale values don't persist
        await db
          .update(estimatedPaymentsTable)
          .set({ amountDue: String(entity.pteElection ? entity.quarterlyPte : 0), updatedAt: new Date() })
          .where(and(
            eq(estimatedPaymentsTable.clientId, clientId),
            eq(estimatedPaymentsTable.taxYear, taxYear),
            eq(estimatedPaymentsTable.quarter, q.quarter),
            eq(estimatedPaymentsTable.paymentType, "state_business_pte"),
            eq(estimatedPaymentsTable.entityName, entity.entityName)
          ));
        await db
          .update(estimatedPaymentsTable)
          .set({ amountDue: String(entity.quarterlyReplacement), updatedAt: new Date() })
          .where(and(
            eq(estimatedPaymentsTable.clientId, clientId),
            eq(estimatedPaymentsTable.taxYear, taxYear),
            eq(estimatedPaymentsTable.quarter, q.quarter),
            eq(estimatedPaymentsTable.paymentType, "state_business_replacement"),
            eq(estimatedPaymentsTable.entityName, entity.entityName)
          ));
      }

      // Zero out any legacy null-entity business records
      await db
        .update(estimatedPaymentsTable)
        .set({ amountDue: "0", updatedAt: new Date() })
        .where(and(
          eq(estimatedPaymentsTable.clientId, clientId),
          eq(estimatedPaymentsTable.taxYear, taxYear),
          eq(estimatedPaymentsTable.quarter, q.quarter),
          inArray(estimatedPaymentsTable.paymentType, ["state_business_pte", "state_business_replacement"]),
          isNull(estimatedPaymentsTable.entityName)
        ));
    } else {
      // Legacy: update null-entity business records
      await db
        .update(estimatedPaymentsTable)
        .set({ amountDue: String(q.stateBusinessPteDue), updatedAt: new Date() })
        .where(and(
          eq(estimatedPaymentsTable.clientId, clientId),
          eq(estimatedPaymentsTable.taxYear, taxYear),
          eq(estimatedPaymentsTable.quarter, q.quarter),
          eq(estimatedPaymentsTable.paymentType, "state_business_pte"),
          isNull(estimatedPaymentsTable.entityName)
        ));
      await db
        .update(estimatedPaymentsTable)
        .set({ amountDue: String(q.stateBusinessReplacementDue), updatedAt: new Date() })
        .where(and(
          eq(estimatedPaymentsTable.clientId, clientId),
          eq(estimatedPaymentsTable.taxYear, taxYear),
          eq(estimatedPaymentsTable.quarter, q.quarter),
          eq(estimatedPaymentsTable.paymentType, "state_business_replacement"),
          isNull(estimatedPaymentsTable.entityName)
        ));
    }
  }
}

// GET /api/clients
router.get("/", async (_req, res) => {
  const clients = await db.select().from(clientsTable).orderBy(clientsTable.name);
  res.json(clients.map(serializeClient));
});

// POST /api/clients
router.post("/", async (req, res) => {
  const body = req.body;
  const [client] = await db
    .insert(clientsTable)
    .values({
      name: body.name,
      email: body.email ?? null,
      filingStatus: body.filingStatus,
      pteElection: body.pteElection ?? false,
      scorporationName: body.scorporationName ?? null,
      scorporationEin: body.scorporationEin ?? null,
      currentTaxYear: body.currentTaxYear ?? new Date().getFullYear(),
    })
    .returning();

  await ensurePaymentRecords(client.id, client.currentTaxYear, [], client.pteElection);
  res.status(201).json(serializeClient(client));
});

// GET /api/clients/:clientId
router.get("/:clientId", async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const taxYear = client.currentTaxYear;
  const [income] = await db.select().from(incomeSourcesTable).where(and(eq(incomeSourcesTable.clientId, clientId), eq(incomeSourcesTable.taxYear, taxYear)));
  const scorpEntries: ScorpEntry[] = (income?.scorpEntries as ScorpEntry[]) ?? [];
  await ensurePaymentRecords(clientId, taxYear, scorpEntries, client.pteElection);
  if (income) {
    await updatePaymentAmounts(clientId, taxYear, income, client.filingStatus as FilingStatus, client.pteElection);
  }

  const incomeSources = await db.select().from(incomeSourcesTable).where(and(eq(incomeSourcesTable.clientId, clientId), eq(incomeSourcesTable.taxYear, taxYear)));
  const payments = await db.select().from(estimatedPaymentsTable).where(and(eq(estimatedPaymentsTable.clientId, clientId), eq(estimatedPaymentsTable.taxYear, taxYear)));

  const toNum = (v: string | null) => (v !== null ? parseFloat(v) : 0);
  const summary = calculateTaxSummary(
    income ? {
      w2Entries: (income.w2Entries as any[]) ?? [],
      scorpEntries: scorpEntries,
      w2Wages: toNum(income.w2Wages),
      interest1099: toNum(income.interest1099),
      dividends1099: toNum(income.dividends1099),
      qualifiedDividends: toNum(income.qualifiedDividends),
      nec1099: toNum(income.nec1099),
      misc1099: toNum(income.misc1099),
      scorpK1Ordinary: toNum(income.scorpK1Ordinary),
      scorpK1OtherIncome: toNum(income.scorpK1OtherIncome),
      partnershipK1Ordinary: toNum(income.partnershipK1Ordinary),
      partnershipK1OtherIncome: toNum(income.partnershipK1OtherIncome),
      rentalIncome: toNum(income.rentalIncome),
      capitalGainsShortTerm: toNum(income.capitalGainsShortTerm),
      capitalGainsLongTerm: toNum(income.capitalGainsLongTerm),
      socialSecurity: toNum(income.socialSecurity),
      pensionRetirement: toNum(income.pensionRetirement),
      otherIncome: toNum(income.otherIncome),
      federalWithheld: toNum(income.federalWithheld),
      stateWithheld: toNum(income.stateWithheld),
      priorYearFederalTax: toNum(income.priorYearFederalTax),
      priorYearStateTax: toNum(income.priorYearStateTax),
      itemizedDeductions: toNum(income.itemizedDeductions),
      applyQbiDeduction: (income as any).applyQbiDeduction ?? false,
    } : {},
    client.filingStatus as FilingStatus,
    client.pteElection,
    taxYear
  );

  res.json({
    ...serializeClient(client),
    incomeSources: incomeSources.map(serializeIncome),
    payments: payments.map(serializePayment),
    taxSummary: summary,
  });
});

// PUT /api/clients/:clientId
router.put("/:clientId", async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const body = req.body;

  const [existing] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!existing) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const updateData: Partial<typeof clientsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.filingStatus !== undefined) updateData.filingStatus = body.filingStatus;
  if (body.pteElection !== undefined) updateData.pteElection = body.pteElection;
  if (body.scorporationName !== undefined) updateData.scorporationName = body.scorporationName;
  if (body.scorporationEin !== undefined) updateData.scorporationEin = body.scorporationEin;
  if (body.currentTaxYear !== undefined) updateData.currentTaxYear = body.currentTaxYear;

  const [updated] = await db.update(clientsTable).set(updateData).where(eq(clientsTable.id, clientId)).returning();

  const newPte = body.pteElection !== undefined ? body.pteElection : existing.pteElection;
  const newYear = body.currentTaxYear !== undefined ? body.currentTaxYear : existing.currentTaxYear;

  const [income] = await db.select().from(incomeSourcesTable).where(and(eq(incomeSourcesTable.clientId, clientId), eq(incomeSourcesTable.taxYear, newYear)));
  const scorpEntries: ScorpEntry[] = (income?.scorpEntries as ScorpEntry[]) ?? [];

  await ensurePaymentRecords(clientId, newYear, scorpEntries, newPte);

  if (body.pteElection !== undefined && body.pteElection !== existing.pteElection) {
    if (income) {
      const fs = (body.filingStatus ?? existing.filingStatus) as FilingStatus;
      await updatePaymentAmounts(clientId, newYear, income, fs, newPte);
    }
  }

  res.json(serializeClient(updated));
});

// DELETE /api/clients/:clientId
router.delete("/:clientId", async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
  res.status(204).send();
});

// GET /api/clients/:clientId/income
router.get("/:clientId/income", async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const taxYear = req.query.taxYear ? parseInt(req.query.taxYear as string) : undefined;

  const conditions = [eq(incomeSourcesTable.clientId, clientId)];
  if (taxYear) conditions.push(eq(incomeSourcesTable.taxYear, taxYear));

  const income = await db.select().from(incomeSourcesTable).where(and(...conditions));
  res.json(income.map(serializeIncome));
});

// POST /api/clients/:clientId/income (upsert)
router.post("/:clientId/income", async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const body = req.body;
  const taxYear = body.taxYear;

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const [existing] = await db.select().from(incomeSourcesTable).where(and(eq(incomeSourcesTable.clientId, clientId), eq(incomeSourcesTable.taxYear, taxYear)));

  const incomeData = {
    clientId,
    taxYear,
    w2Entries: body.w2Entries ?? null,
    scorpEntries: body.scorpEntries ?? null,
    w2Wages: body.w2Wages?.toString() ?? null,
    interest1099: body.interest1099?.toString() ?? null,
    dividends1099: body.dividends1099?.toString() ?? null,
    qualifiedDividends: body.qualifiedDividends?.toString() ?? null,
    nec1099: body.nec1099?.toString() ?? null,
    misc1099: body.misc1099?.toString() ?? null,
    scorpK1Ordinary: body.scorpK1Ordinary?.toString() ?? null,
    scorpK1OtherIncome: body.scorpK1OtherIncome?.toString() ?? null,
    partnershipK1Ordinary: body.partnershipK1Ordinary?.toString() ?? null,
    partnershipK1OtherIncome: body.partnershipK1OtherIncome?.toString() ?? null,
    rentalIncome: body.rentalIncome?.toString() ?? null,
    capitalGainsShortTerm: body.capitalGainsShortTerm?.toString() ?? null,
    capitalGainsLongTerm: body.capitalGainsLongTerm?.toString() ?? null,
    socialSecurity: body.socialSecurity?.toString() ?? null,
    pensionRetirement: body.pensionRetirement?.toString() ?? null,
    otherIncome: body.otherIncome?.toString() ?? null,
    federalWithheld: body.federalWithheld?.toString() ?? null,
    stateWithheld: body.stateWithheld?.toString() ?? null,
    priorYearFederalTax: body.priorYearFederalTax?.toString() ?? null,
    priorYearStateTax: body.priorYearStateTax?.toString() ?? null,
    itemizedDeductions: body.itemizedDeductions?.toString() ?? null,
    applyQbiDeduction: (body as any).applyQbiDeduction ?? false,
    notes: body.notes ?? null,
    updatedAt: new Date(),
  };

  let saved;
  if (existing) {
    [saved] = await db.update(incomeSourcesTable).set(incomeData).where(eq(incomeSourcesTable.id, existing.id)).returning();
  } else {
    [saved] = await db.insert(incomeSourcesTable).values(incomeData).returning();
  }

  const scorpEntries: ScorpEntry[] = (saved.scorpEntries as ScorpEntry[]) ?? [];
  await ensurePaymentRecords(clientId, taxYear, scorpEntries, client.pteElection);
  await updatePaymentAmounts(clientId, taxYear, saved, client.filingStatus as FilingStatus, client.pteElection);

  const allIncome = await db.select().from(incomeSourcesTable).where(and(eq(incomeSourcesTable.clientId, clientId), eq(incomeSourcesTable.taxYear, taxYear)));
  res.json(allIncome.map(serializeIncome));
});

// GET /api/clients/:clientId/payments
router.get("/:clientId/payments", async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const taxYear = req.query.taxYear ? parseInt(req.query.taxYear as string) : undefined;

  const conditions = [eq(estimatedPaymentsTable.clientId, clientId)];
  if (taxYear) conditions.push(eq(estimatedPaymentsTable.taxYear, taxYear));

  const payments = await db
    .select()
    .from(estimatedPaymentsTable)
    .where(and(...conditions))
    .orderBy(estimatedPaymentsTable.quarter, estimatedPaymentsTable.paymentType);

  res.json(payments.map(serializePayment));
});

// PUT /api/clients/:clientId/payments/:paymentId
router.put("/:clientId/payments/:paymentId", async (req, res) => {
  const paymentId = parseInt(req.params.paymentId);
  const body = req.body;

  const updateData: Partial<typeof estimatedPaymentsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.amountPaid !== undefined) updateData.amountPaid = body.amountPaid?.toString() ?? null;
  if (body.confirmationNumber !== undefined) updateData.confirmationNumber = body.confirmationNumber;
  if (body.paidDate !== undefined) updateData.paidDate = body.paidDate;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const [updated] = await db
    .update(estimatedPaymentsTable)
    .set(updateData)
    .where(eq(estimatedPaymentsTable.id, paymentId))
    .returning();

  res.json(serializePayment(updated));
});

// GET /api/clients/:clientId/tax-summary
router.get("/:clientId/tax-summary", async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const taxYear = req.query.taxYear ? parseInt(req.query.taxYear as string) : client.currentTaxYear;
  const [income] = await db.select().from(incomeSourcesTable).where(and(eq(incomeSourcesTable.clientId, clientId), eq(incomeSourcesTable.taxYear, taxYear)));

  const toNum = (v: string | null) => (v !== null ? parseFloat(v) : 0);
  const scorpEntries: ScorpEntry[] = (income?.scorpEntries as ScorpEntry[]) ?? [];

  const summary = calculateTaxSummary(
    income ? {
      w2Entries: (income.w2Entries as any[]) ?? [],
      scorpEntries,
      w2Wages: toNum(income.w2Wages),
      interest1099: toNum(income.interest1099),
      dividends1099: toNum(income.dividends1099),
      qualifiedDividends: toNum(income.qualifiedDividends),
      nec1099: toNum(income.nec1099),
      misc1099: toNum(income.misc1099),
      scorpK1Ordinary: toNum(income.scorpK1Ordinary),
      scorpK1OtherIncome: toNum(income.scorpK1OtherIncome),
      partnershipK1Ordinary: toNum(income.partnershipK1Ordinary),
      partnershipK1OtherIncome: toNum(income.partnershipK1OtherIncome),
      rentalIncome: toNum(income.rentalIncome),
      capitalGainsShortTerm: toNum(income.capitalGainsShortTerm),
      capitalGainsLongTerm: toNum(income.capitalGainsLongTerm),
      socialSecurity: toNum(income.socialSecurity),
      pensionRetirement: toNum(income.pensionRetirement),
      otherIncome: toNum(income.otherIncome),
      federalWithheld: toNum(income.federalWithheld),
      stateWithheld: toNum(income.stateWithheld),
      priorYearFederalTax: toNum(income.priorYearFederalTax),
      priorYearStateTax: toNum(income.priorYearStateTax),
      itemizedDeductions: toNum(income.itemizedDeductions),
      applyQbiDeduction: (income as any).applyQbiDeduction ?? false,
    } : {},
    client.filingStatus as FilingStatus,
    client.pteElection,
    taxYear
  );

  res.json(summary);
});

export default router;
