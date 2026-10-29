/**
 * Tax calculation engine for Illinois estimated payments
 * Supports Federal + Illinois individual + Illinois S-Corp (PTE and replacement tax)
 * Supports multiple W-2 entries and multiple S-Corp entries with per-entity PTE
 */

export type FilingStatus = "single" | "married_filing_jointly" | "married_filing_separately" | "head_of_household";

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
  ownershipPct: number;           // 0–100 (client's ownership percentage)
  ordinaryIncome: number;         // K-1 Box 1 — client's share of ordinary income
  otherIncome: number;            // K-1 other income — client's share
  stateTaxesDeducted?: number;    // Entity-level state taxes deducted in arriving at K-1 income (IL add-back only)
  pteElection?: boolean;          // Per-entity PTE override; undefined = use global flag
}

export interface EntityBreakdown {
  entityName: string;
  pteElection: boolean;
  entityTotalIncome: number;    // full entity income (k1 ÷ ownershipPct)
  pteTax: number;               // entity-level 4.95% PTE tax (0 if no PTE)
  replacementTax: number;       // entity-level 1.5% replacement tax
  totalEntityTax: number;
  quarterlyPte: number;
  quarterlyReplacement: number;
  pteCreditAtIndividual: number; // PTE credit that flows back to individual IL return
}

export interface IncomeInputs {
  // Dynamic entries (preferred when present)
  w2Entries?: W2Entry[];
  scorpEntries?: ScorpEntry[];

  // Legacy scalar fields (used when dynamic entries are absent)
  w2Wages?: number;
  scorpK1Ordinary?: number;
  scorpK1OtherIncome?: number;

  // Other income (always scalar)
  interest1099?: number;
  dividends1099?: number;
  qualifiedDividends?: number;
  nec1099?: number;
  misc1099?: number;
  partnershipK1Ordinary?: number;
  partnershipK1OtherIncome?: number;
  rentalIncome?: number;
  capitalGainsShortTerm?: number;
  capitalGainsLongTerm?: number;
  socialSecurity?: number;
  pensionRetirement?: number;
  otherIncome?: number;

  // Additional withholding (non-W-2 sources; W-2 entry withholding is summed from entries)
  federalWithheld?: number;
  stateWithheld?: number;

  priorYearFederalTax?: number;
  priorYearStateTax?: number;
  itemizedDeductions?: number;
  applyQbiDeduction?: boolean;
}

export interface TaxSummaryResult {
  taxYear: number;
  pteElection: boolean;
  totalGrossIncome: number;
  scorpPassthroughIncome: number;    // client's total K-1 share across all S-corps
  scorpEntityTotalIncome: number;    // gross entity income (k1 / ownershipPct) — drives entity-level taxes
  federalAgi: number;
  federalDeduction: number;
  federalDeductionIsItemized: boolean;
  federalQbiDeduction: number;
  federalTaxableIncome: number;
  federalTaxLiability: number;
  federalSafeHarbor: number;
  federalRequiredAnnual: number;
  federalWithheld: number;
  federalBalance: number;
  stateAgi: number;
  stateTaxableIncome: number;
  stateIndividualTaxLiability: number;
  stateBusinessPteTax: number;
  stateBusinessReplacementTax: number;
  stateSafeHarbor: number;
  stateRequiredAnnual: number;
  stateWithheld: number;
  stateBalance: number;
  entityBreakdowns: EntityBreakdown[];
  quarters: QuarterSummary[];
}

export interface QuarterSummary {
  quarter: number;
  dueDate: string;
  federalIndividualDue: number;
  stateIndividualDue: number;
  stateBusinessPteDue: number;
  stateBusinessReplacementDue: number;
  totalDue: number;
}

// 2025 Federal tax brackets
const FEDERAL_BRACKETS: Record<FilingStatus, Array<[number, number]>> = {
  single: [
    [11925, 0.10],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [626350, 0.35],
    [Infinity, 0.37],
  ],
  married_filing_jointly: [
    [23850, 0.10],
    [96950, 0.12],
    [206700, 0.22],
    [394600, 0.24],
    [501050, 0.32],
    [751600, 0.35],
    [Infinity, 0.37],
  ],
  married_filing_separately: [
    [11925, 0.10],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [375800, 0.35],
    [Infinity, 0.37],
  ],
  head_of_household: [
    [17000, 0.10],
    [64850, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250500, 0.32],
    [626350, 0.35],
    [Infinity, 0.37],
  ],
};

// Standard deductions by tax year (IRS inflation-adjusted)
const STANDARD_DEDUCTIONS_BY_YEAR: Record<number, Record<FilingStatus, number>> = {
  2024: {
    single: 14600,
    married_filing_jointly: 29200,
    married_filing_separately: 14600,
    head_of_household: 21900,
  },
  2025: {
    single: 15000,
    married_filing_jointly: 30000,
    married_filing_separately: 15000,
    head_of_household: 22500,
  },
  2026: {
    single: 15750,
    married_filing_jointly: 31500,
    married_filing_separately: 15750,
    head_of_household: 23625,
  },
};

function getStandardDeductions(taxYear: number): Record<FilingStatus, number> {
  // Use exact year if available, otherwise fall back to nearest known year
  if (STANDARD_DEDUCTIONS_BY_YEAR[taxYear]) return STANDARD_DEDUCTIONS_BY_YEAR[taxYear];
  const knownYears = Object.keys(STANDARD_DEDUCTIONS_BY_YEAR).map(Number).sort((a, b) => b - a);
  const closest = knownYears.find(y => y <= taxYear) ?? knownYears[knownYears.length - 1];
  return STANDARD_DEDUCTIONS_BY_YEAR[closest];
}

// Illinois personal exemptions
const IL_EXEMPTIONS: Record<FilingStatus, number> = {
  single: 2425,
  married_filing_jointly: 4850,
  married_filing_separately: 2425,
  head_of_household: 3637.5,
};

// Illinois flat tax rate
const IL_RATE = 0.0495;
const IL_REPLACEMENT_RATE = 0.015;

function getQuarterDueDates(taxYear: number): Record<number, string> {
  return {
    1: `${taxYear}-04-15`,
    2: `${taxYear}-06-15`,
    3: `${taxYear}-09-15`,
    4: `${taxYear + 1}-01-15`,
  };
}

function computeFederalTax(taxableIncome: number, filingStatus: FilingStatus): number {
  const brackets = FEDERAL_BRACKETS[filingStatus];
  let tax = 0;
  let previousLimit = 0;
  for (const [limit, rate] of brackets) {
    if (taxableIncome <= previousLimit) break;
    const taxableAtThisRate = Math.min(taxableIncome, limit) - previousLimit;
    tax += taxableAtThisRate * rate;
    previousLimit = limit;
  }
  return Math.max(0, tax);
}

function toNum(val: number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

export function calculateTaxSummary(
  inputs: Partial<IncomeInputs>,
  filingStatus: FilingStatus,
  globalPteElection: boolean,
  taxYear: number
): TaxSummaryResult {
  // ── W-2 Wages ────────────────────────────────────────────────────────────
  const w2Entries: W2Entry[] = inputs.w2Entries?.length ? inputs.w2Entries : [];
  const w2Wages = w2Entries.length > 0
    ? w2Entries.reduce((s, e) => s + toNum(e.wages), 0)
    : toNum(inputs.w2Wages);

  const w2FederalWithheld = w2Entries.reduce((s, e) => s + toNum(e.federalWithheld), 0);
  const w2StateWithheld = w2Entries.reduce((s, e) => s + toNum(e.stateWithheld), 0);

  const additionalFederalWithheld = toNum(inputs.federalWithheld);
  const additionalStateWithheld = toNum(inputs.stateWithheld);

  const totalFederalWithheld = w2FederalWithheld + additionalFederalWithheld;
  const totalStateWithheld = w2StateWithheld + additionalStateWithheld;

  // ── S-Corp Entries (per-entity PTE support) ───────────────────────────────
  const scorpEntries: ScorpEntry[] = inputs.scorpEntries?.length ? inputs.scorpEntries : [];
  const multipleEntities = scorpEntries.length > 1;

  const legacyScorpOrdinary = toNum(inputs.scorpK1Ordinary);
  const legacyScorpOther = toNum(inputs.scorpK1OtherIncome);

  // Client's total K-1 share (flows to individual AGI)
  const scorpPassthroughIncome = scorpEntries.length > 0
    ? scorpEntries.reduce((s, e) => s + toNum(e.ordinaryIncome) + toNum(e.otherIncome), 0)
    : legacyScorpOrdinary + legacyScorpOther;

  // Full entity-level income across all S-corps (includes state taxes add-back for IL)
  const scorpEntityTotalIncome = scorpEntries.length > 0
    ? scorpEntries.reduce((s, e) => {
        const pct = toNum(e.ownershipPct);
        const clientIncome = toNum(e.ordinaryIncome) + toNum(e.otherIncome);
        return s + (pct > 0 ? clientIncome / (pct / 100) : clientIncome) + toNum(e.stateTaxesDeducted);
      }, 0)
    : scorpPassthroughIncome;

  // ── Per-entity breakdowns ──────────────────────────────────────────────────
  const entityBreakdowns: EntityBreakdown[] = [];

  if (scorpEntries.length > 0) {
    for (const entry of scorpEntries) {
      // Per-entity PTE: if multiple entities, use per-entity flag; if single, use global
      const entryPte = multipleEntities
        ? (entry.pteElection !== undefined ? entry.pteElection : globalPteElection)
        : globalPteElection;

      const clientIncome = toNum(entry.ordinaryIncome) + toNum(entry.otherIncome);
      const pct = toNum(entry.ownershipPct);
      // IL entity income adds back any state taxes deducted in arriving at K-1 income
      const entityTotalIncome = (pct > 0 ? clientIncome / (pct / 100) : clientIncome) + toNum(entry.stateTaxesDeducted);

      const pteTax = entryPte ? round2(entityTotalIncome * IL_RATE) : 0;
      const replacementTax = round2(entityTotalIncome * IL_REPLACEMENT_RATE);
      const totalEntityTax = pteTax + replacementTax;

      // PTE credit at individual level = entity's PTE × client's ownership share
      const pteCreditAtIndividual = entryPte ? round2(entityTotalIncome * (pct / 100) * IL_RATE) : 0;

      entityBreakdowns.push({
        entityName: entry.name || "S-Corporation",
        pteElection: entryPte,
        entityTotalIncome: round2(entityTotalIncome),
        pteTax,
        replacementTax,
        totalEntityTax: round2(totalEntityTax),
        quarterlyPte: round2(pteTax / 4),
        quarterlyReplacement: round2(replacementTax / 4),
        pteCreditAtIndividual,
      });
    }
  } else if (scorpPassthroughIncome > 0) {
    // Legacy: single entity, 100% ownership
    const entityTotalIncome = scorpPassthroughIncome;
    const pteTax = globalPteElection ? round2(entityTotalIncome * IL_RATE) : 0;
    const replacementTax = round2(entityTotalIncome * IL_REPLACEMENT_RATE);
    entityBreakdowns.push({
      entityName: "S-Corporation",
      pteElection: globalPteElection,
      entityTotalIncome: round2(entityTotalIncome),
      pteTax,
      replacementTax,
      totalEntityTax: round2(pteTax + replacementTax),
      quarterlyPte: round2(pteTax / 4),
      quarterlyReplacement: round2(replacementTax / 4),
      pteCreditAtIndividual: globalPteElection ? round2(scorpPassthroughIncome * IL_RATE) : 0,
    });
  }

  // ── Aggregate entity-level taxes ──────────────────────────────────────────
  const stateBusinessPteTax = entityBreakdowns.reduce((s, e) => s + e.pteTax, 0);
  const stateBusinessReplacementTax = entityBreakdowns.reduce((s, e) => s + e.replacementTax, 0);
  const totalPteCreditAtIndividual = entityBreakdowns.reduce((s, e) => s + e.pteCreditAtIndividual, 0);

  // ── Other Income ─────────────────────────────────────────────────────────
  const interest1099 = toNum(inputs.interest1099);
  const dividends1099 = toNum(inputs.dividends1099);
  const nec1099 = toNum(inputs.nec1099);
  const misc1099 = toNum(inputs.misc1099);
  const partnershipK1Ordinary = toNum(inputs.partnershipK1Ordinary);
  const partnershipK1OtherIncome = toNum(inputs.partnershipK1OtherIncome);
  const rentalIncome = toNum(inputs.rentalIncome);
  const capitalGainsShortTerm = toNum(inputs.capitalGainsShortTerm);
  const capitalGainsLongTerm = toNum(inputs.capitalGainsLongTerm);
  const socialSecurity = toNum(inputs.socialSecurity);
  const pensionRetirement = toNum(inputs.pensionRetirement);
  const otherIncome = toNum(inputs.otherIncome);
  const priorYearFederalTax = toNum(inputs.priorYearFederalTax);
  const priorYearStateTax = toNum(inputs.priorYearStateTax);

  // ── FEDERAL CALCULATION ──────────────────────────────────────────────────
  const federalAgi =
    w2Wages +
    interest1099 +
    dividends1099 +
    nec1099 +
    misc1099 +
    scorpPassthroughIncome +
    partnershipK1Ordinary +
    partnershipK1OtherIncome +
    rentalIncome +
    capitalGainsShortTerm +
    capitalGainsLongTerm +
    (socialSecurity * 0.85) +
    pensionRetirement +
    otherIncome;

  const standardDeduction = getStandardDeductions(taxYear)[filingStatus];
  const itemizedDeductions = toNum(inputs.itemizedDeductions);
  const effectiveDeduction = itemizedDeductions > standardDeduction ? itemizedDeductions : standardDeduction;

  // QBI deduction (Section 199A): 20% of qualified business income
  const qualifiedBusinessIncome = scorpPassthroughIncome + partnershipK1Ordinary + partnershipK1OtherIncome + nec1099;
  const federalQbiDeduction = inputs.applyQbiDeduction ? round2(qualifiedBusinessIncome * 0.20) : 0;

  const federalTaxableIncome = Math.max(0, federalAgi - effectiveDeduction - federalQbiDeduction);
  const federalTaxLiability = computeFederalTax(federalTaxableIncome, filingStatus);

  const safeHarborMultiplier = priorYearFederalTax > 0 && federalAgi > 150000 ? 1.1 : 1.0;
  const federalSafeHarbor = priorYearFederalTax * safeHarborMultiplier;
  const federalRequiredAnnual = Math.min(
    federalTaxLiability * 0.9,
    federalSafeHarbor > 0 ? federalSafeHarbor : federalTaxLiability * 0.9
  );
  const federalBalance = Math.max(0, federalRequiredAnnual - totalFederalWithheld);

  // ── ILLINOIS CALCULATION ─────────────────────────────────────────────────
  const stateAgi = federalAgi;
  const ilExemption = IL_EXEMPTIONS[filingStatus];
  const stateTaxableIncome = Math.max(0, stateAgi - ilExemption);

  const grossIlIndividualTax = stateTaxableIncome * IL_RATE;
  const pteCreditAtIndividual = Math.min(totalPteCreditAtIndividual, grossIlIndividualTax);
  const stateIndividualTaxLiability = Math.max(0, grossIlIndividualTax - pteCreditAtIndividual);

  const stateSafeHarbor = priorYearStateTax;
  const stateRequiredAnnual = Math.min(
    stateIndividualTaxLiability * 0.9,
    stateSafeHarbor > 0 ? stateSafeHarbor : stateIndividualTaxLiability * 0.9
  );
  const stateBalance = Math.max(0, stateRequiredAnnual - totalStateWithheld);

  const totalGrossIncome =
    w2Wages + interest1099 + dividends1099 + nec1099 + misc1099 +
    scorpPassthroughIncome + partnershipK1Ordinary + partnershipK1OtherIncome +
    rentalIncome + capitalGainsShortTerm + capitalGainsLongTerm +
    socialSecurity + pensionRetirement + otherIncome;

  // ── QUARTERLY BREAKDOWN ──────────────────────────────────────────────────
  const federalPerQuarter = federalBalance / 4;
  const stateIndividualPerQuarter = stateBalance / 4;
  const statePtePerQuarter = stateBusinessPteTax / 4;
  const stateReplacementPerQuarter = stateBusinessReplacementTax / 4;

  const dueDates = getQuarterDueDates(taxYear);
  const quarters: QuarterSummary[] = [1, 2, 3, 4].map((q) => ({
    quarter: q,
    dueDate: dueDates[q] ?? "",
    federalIndividualDue: round2(federalPerQuarter),
    stateIndividualDue: round2(stateIndividualPerQuarter),
    stateBusinessPteDue: round2(statePtePerQuarter),
    stateBusinessReplacementDue: round2(stateReplacementPerQuarter),
    totalDue: round2(federalPerQuarter + stateIndividualPerQuarter + statePtePerQuarter + stateReplacementPerQuarter),
  }));

  const anyPte = entityBreakdowns.some(e => e.pteElection) || (entityBreakdowns.length === 0 && globalPteElection);

  const isItemized = itemizedDeductions > standardDeduction;

  return {
    taxYear,
    pteElection: anyPte,
    totalGrossIncome: round2(totalGrossIncome),
    scorpPassthroughIncome: round2(scorpPassthroughIncome),
    scorpEntityTotalIncome: round2(scorpEntityTotalIncome),
    federalAgi: round2(federalAgi),
    federalDeduction: round2(effectiveDeduction),
    federalDeductionIsItemized: isItemized,
    federalQbiDeduction: round2(federalQbiDeduction),
    federalTaxableIncome: round2(federalTaxableIncome),
    federalTaxLiability: round2(federalTaxLiability),
    federalSafeHarbor: round2(federalSafeHarbor),
    federalRequiredAnnual: round2(federalRequiredAnnual),
    federalWithheld: round2(totalFederalWithheld),
    federalBalance: round2(federalBalance),
    stateAgi: round2(stateAgi),
    stateTaxableIncome: round2(stateTaxableIncome),
    stateIndividualTaxLiability: round2(stateIndividualTaxLiability),
    stateBusinessPteTax: round2(stateBusinessPteTax),
    stateBusinessReplacementTax: round2(stateBusinessReplacementTax),
    stateSafeHarbor: round2(stateSafeHarbor),
    stateRequiredAnnual: round2(stateRequiredAnnual),
    stateWithheld: round2(totalStateWithheld),
    stateBalance: round2(stateBalance),
    entityBreakdowns,
    quarters,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
