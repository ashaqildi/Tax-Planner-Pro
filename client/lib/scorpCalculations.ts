/**
 * scorpCalculations.ts
 * Shared computation engine for the S Corp vs Schedule C comparison.
 * Used by both SCorpCalculator.tsx (live UI) and generateSCorpPdf.ts (export).
 *
 * Sources: Rev. Proc. 2025-32; SSA 2026 fact sheet; OBBBA (Pub. L. 119-21);
 *          IRC §§164(f), 162(l), 199A, 3101, 1401, 404, 1372; 35 ILCS 5/201(c).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FilingStatus = "single" | "mfj";

export interface SCorpCalcInputs {
  grossIncome: number;
  salary: number;
  costFile: number;
  costPayroll: number;
  filingStatus: FilingStatus;
  isSstb: boolean;
  materialParticipation: boolean;
  // D-11: Optional deductions
  sehiSchedC: number;       // §162(l) SEHI deduction — Schedule C: reduces AGI & QBI
  retirementSchedC: number; // §404 retirement — Schedule C: reduces AGI & QBI
  shareholderHI: number;    // §1372 health ins — S Corp: reduces entity income (K-1)
  retirementER: number;     // Employer 401(k)/SEP — S Corp: reduces entity income (≤ 25% salary)
  otherIncome: number;      // Other household income — added to AGI in both columns
  netCapitalGain: number;   // Net capital gain — reduces §199A(a)(1)(B) TI cap base
}

export interface SCorpCalcResults {
  stdDed: number;
  addlMedThreshold: number;
  retirementERCapped: number;     // actual capped value used
  retirementERCap: number;        // 25% × salary cap

  // ── Schedule C ──
  seBase: number;
  seSs: number;
  seMedicare: number;
  seTax: number;
  addlMedicareSE: number;         // D-9
  seDeduction: number;            // D-1: 164(f)
  schedCQbi: number;              // D-2: reduced by 164(f), SEHI, retirement
  schedCAgi: number;
  schedCTiPreQbi: number;
  schedCQbiDed: number;           // D-3: TI cap applied
  schedCQbiLabel: string;         // §199A label describing which limitation bound
  schedCTaxableIncome: number;
  schedCFedTax: number;
  schedCStateTax: number;
  schedCTotal: number;

  // ── S Corporation ──
  eeFicaSs: number;
  eeFicaMedicare: number;
  eeFica: number;
  erFica: number;
  addlMedicareEE: number;         // D-9: employee side only
  futa: number;
  suta: number;
  adminCosts: number;
  entityIncomePreState: number;   // D-4 fix: includes ER FICA, FUTA, SUTA, health, retirement
  stateEntityTax: number;         // D-7: IL 1.5% replacement tax
  k1OrdinaryIncome: number;
  w2Box1: number;                 // W-2 Box 1 wages = salary + shareholderHI (Rev. Rul. 91-26)
  sCorpSehiDed: number;           // §162(l) deduction on 1040 = shareholderHI
  sCorpAgi: number;
  sCorpTiPreQbi: number;
  sCorpQbi: number;
  sCorpQbiDed: number;
  sCorpQbiLabel: string;          // §199A label describing which limitation bound
  sCorpTaxableIncome: number;
  sCorpFedTax: number;
  sCorpStateTax: number;
  sCorpTotal: number;

  savings: number;
}

// ─── 2026 Constants ───────────────────────────────────────────────────────────

export const WAGE_BASE_2026      = 184_500;  // SSA 2026 SS wage base (Rev. Proc. 2025-32)
export const FUTA_WAGE_LIMIT     = 7_000;    // Statutory; not inflation-indexed
export const FUTA_RATE           = 0.006;    // Net of full state credit (54% offset)
export const IL_SUTA_WAGE_BASE   = 13_590;   // IL 2026 SUTA taxable wage base (estimated)
export const IL_SUTA_RATE        = 0.03175;  // IL new-employer SUTA rate (2026)
export const IL_REPLACEMENT_RATE = 0.015;    // IL personal property replacement tax
export const IL_INCOME_TAX_RATE  = 0.0495;   // IL flat individual income tax rate
export const IL_EXEMPTION_2026   = { single: 2_775, mfj: 5_550 };  // IL DOR 2025 published; inflation-indexed per PA 103-0008
export const ADDL_MED_THRESHOLD  = { single: 200_000, mfj: 250_000 }; // statutory, not indexed
export const SECTION_415_LIMIT   = 70_000;   // 2026 §415 DC limit (estimated)

export const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  single: 16_100,  // OBBBA / Rev. Proc. 2025-32
  mfj:    32_200,  // OBBBA / Rev. Proc. 2025-32
};

export const BRACKETS_2026: Record<FilingStatus, { rate: number; min: number; max: number }[]> = {
  single: [
    { rate: 0.10, min: 0,       max: 12_400 },
    { rate: 0.12, min: 12_400,  max: 50_400 },
    { rate: 0.22, min: 50_400,  max: 105_700 },
    { rate: 0.24, min: 105_700, max: 201_775 },
    { rate: 0.32, min: 201_775, max: 256_225 },
    { rate: 0.35, min: 256_225, max: 640_600 },
    { rate: 0.37, min: 640_600, max: Infinity },
  ],
  mfj: [
    { rate: 0.10, min: 0,       max: 24_800 },
    { rate: 0.12, min: 24_800,  max: 100_800 },
    { rate: 0.22, min: 100_800, max: 211_400 },
    { rate: 0.24, min: 211_400, max: 403_550 },
    { rate: 0.32, min: 403_550, max: 512_450 },
    { rate: 0.35, min: 512_450, max: 731_200 }, // MFJ 37% — spec truncated; ~2× single estimated
    { rate: 0.37, min: 731_200, max: Infinity },
  ],
};

export const QBI_PARAMS_2026: Record<FilingStatus, { threshold: number; phaseIn: number }> = {
  single: { threshold: 197_300, phaseIn: 50_000 },
  mfj:    { threshold: 394_600, phaseIn: 100_000 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calcFederalTax(taxableIncome: number, fs: FilingStatus): number {
  let tax = 0;
  for (const b of BRACKETS_2026[fs]) {
    if (taxableIncome <= b.min) break;
    tax += (Math.min(taxableIncome, b.max) - b.min) * b.rate;
  }
  return tax;
}

/**
 * QBI deduction — Treas. Reg. 1.199A-1(d)(2) fully implemented.
 * UBIA assumed 0 (typical for service businesses).
 *
 * Returns both the deduction amount AND the label describing which limitation
 * actually bound, using the mandatory two-step approach:
 *   Step 1 — entity-level (threshold-gated) limitation → tentative + basis
 *   Step 2 — §199A(a)(1)(B) TI cap applied as an unconditional override
 *   Step 3 — OBBBA $400 floor (2026+)
 *
 * The TI cap check (step 2) MUST follow step 1; it applies at every income
 * level, including below the §199A threshold. Treating them as mutually
 * exclusive produces incorrect labels.
 */
export function calcQbiDeduction(params: {
  qbi: number;
  tiPreQbi: number;
  w2Wages: number;
  isSstb: boolean;
  fs: FilingStatus;
  materialParticipation: boolean;
  netCapitalGain: number;
}): { deduction: number; label: string } {
  const { qbi, tiPreQbi, w2Wages, isSstb, fs, materialParticipation, netCapitalGain } = params;
  const ubia = 0;
  const { threshold, phaseIn } = QBI_PARAMS_2026[fs];

  // ── STEP 1: entity-level limitation (threshold-dependent) ──────────────────
  let tentative: number;
  let basis: string;

  if (tiPreQbi <= threshold) {
    tentative = Math.max(0, 0.20 * qbi);
    basis = "20% of QBI; below §199A threshold";
  } else if (isSstb && tiPreQbi >= threshold + phaseIn) {
    tentative = 0;
    basis = "SSTB fully excluded above phase-in range";
  } else if (tiPreQbi >= threshold + phaseIn) {
    const wageLimited = Math.max(0.50 * w2Wages, 0.25 * w2Wages + 0.025 * ubia);
    tentative = Math.min(Math.max(0, 0.20 * qbi), wageLimited);
    basis = "Limited by 50% of W-2 wages";
  } else {
    // Phase-in range: Treas. Reg. 1.199A-1(d)(2)
    const ratio = (tiPreQbi - threshold) / phaseIn;
    const applicablePct = 1 - ratio;
    if (isSstb) {
      const rQbi       = Math.max(0, qbi)     * applicablePct;
      const rW2        = Math.max(0, w2Wages) * applicablePct;
      const rUbia      = ubia * applicablePct;
      const uncapped   = 0.20 * rQbi;
      const wageLimited = Math.max(0.50 * rW2, 0.25 * rW2 + 0.025 * rUbia);
      tentative = Math.min(uncapped, wageLimited);
    } else {
      const uncapped    = Math.max(0, 0.20 * qbi);
      const wageLimited = Math.max(0.50 * w2Wages, 0.25 * w2Wages + 0.025 * ubia);
      tentative = uncapped <= wageLimited
        ? uncapped
        : wageLimited + applicablePct * (uncapped - wageLimited);
    }
    basis = "Reduced by §199A phase-in";
  }

  // ── STEP 2: §199A(a)(1)(B) TI cap — ALWAYS applies, unconditional override ─
  const tiCap = Math.max(0, 0.20 * Math.max(tiPreQbi - netCapitalGain, 0));
  let deduction: number;
  let label: string;
  if (tiCap < tentative) {
    deduction = tiCap;
    label = "Limited by taxable income cap, §199A(a)(1)(B)";
  } else {
    deduction = tentative;
    label = basis;
  }

  // ── STEP 3: OBBBA 2026+ $400 minimum floor ─────────────────────────────────
  const sstbFullyExcluded = isSstb && tiPreQbi >= threshold + phaseIn;
  if (materialParticipation && !sstbFullyExcluded && deduction < 400 && qbi >= 1_000) {
    deduction = Math.min(400, Math.max(0, 0.20 * Math.max(tiPreQbi, 0)));
    label = "§199A(i) minimum deduction";
  }

  return { deduction: Math.max(0, deduction), label };
}

// ─── Main Computation ─────────────────────────────────────────────────────────

export function computeSCorpComparison(inp: SCorpCalcInputs): SCorpCalcResults {
  const fs       = inp.filingStatus;
  const stdDed   = STANDARD_DEDUCTION_2026[fs];
  const ilExemp  = IL_EXEMPTION_2026[fs];
  const amtThresh = ADDL_MED_THRESHOLD[fs];

  // ── COLUMN A: SCHEDULE C ─────────────────────────────────────────────────

  // Steps 1–5
  const seBase     = inp.grossIncome * 0.9235;
  const seSs       = Math.min(seBase, WAGE_BASE_2026) * 0.124;   // D-8: wage base cap
  const seMedicare = seBase * 0.029;
  const seTax      = seSs + seMedicare;

  // Step 6 — D-9: Additional Medicare Tax (0.9%; employee/SE side only)
  const addlMedicareSE = Math.max(0, seBase - amtThresh) * 0.009;

  // Step 7 — D-1: IRC 164(f) deduction
  const seDeduction = seTax / 2;

  // Steps 8–9 — D-11: optional above-the-line deductions
  const sehiSchedC      = inp.sehiSchedC;
  const retirementSchedC = inp.retirementSchedC;

  // Step 10 — AGI
  const schedCAgi = Math.max(
    0,
    inp.grossIncome - seDeduction - sehiSchedC - retirementSchedC + inp.otherIncome
  );

  // Step 11 — TI before QBI
  const schedCTiPreQbi = Math.max(0, schedCAgi - stdDed);

  // Step 12 — D-2: QBI base (reduced by same above-the-line items)
  const schedCQbi = Math.max(0, inp.grossIncome - seDeduction - sehiSchedC - retirementSchedC);

  // Step 13 — D-3: QBI deduction with TI cap
  const { deduction: schedCQbiDed, label: schedCQbiLabel } = calcQbiDeduction({
    qbi: schedCQbi,
    tiPreQbi: schedCTiPreQbi,
    w2Wages: 0,
    isSstb: inp.isSstb,
    fs,
    materialParticipation: inp.materialParticipation,
    netCapitalGain: inp.netCapitalGain,
  });

  // Steps 14–16
  const schedCTaxableIncome = Math.max(0, schedCTiPreQbi - schedCQbiDed);
  const schedCFedTax        = calcFederalTax(schedCTaxableIncome, fs);
  const schedCStateTax      = Math.max(0, schedCAgi - ilExemp) * IL_INCOME_TAX_RATE;

  // Step 18 — Total burden
  const schedCTotal = seTax + addlMedicareSE + schedCFedTax + schedCStateTax;

  // ── COLUMN B: S CORPORATION ──────────────────────────────────────────────

  // Steps 3–4 — EE & ER FICA (D-8: SS wage base cap)
  const eeFicaSs       = Math.min(inp.salary, WAGE_BASE_2026) * 0.062;
  const eeFicaMedicare = inp.salary * 0.0145;
  const eeFica         = eeFicaSs + eeFicaMedicare;
  const erFica         = eeFica;

  // Step 5 — D-9: Additional Medicare Tax, employee side only
  const addlMedicareEE = Math.max(0, inp.salary - amtThresh) * 0.009;

  // Steps 6–7 — D-4: FUTA & SUTA reduce entity income
  const futa = Math.min(inp.salary, FUTA_WAGE_LIMIT) * FUTA_RATE;
  const suta = Math.min(inp.salary, IL_SUTA_WAGE_BASE) * IL_SUTA_RATE;

  // Step 8 — D-5: admin costs are entity deduction under IRC 162
  const adminCosts = inp.costFile + inp.costPayroll;

  // Steps 9–10 — D-11: shareholder health ins + employer retirement (cap at 25% salary)
  const retirementERCap    = 0.25 * inp.salary;
  const retirementERCapped = Math.min(inp.retirementER, retirementERCap);

  // Step 11 — D-4: all entity-level costs reduce K-1
  const entityIncomePreState = Math.max(
    0,
    inp.grossIncome - inp.salary - erFica - futa - suta
    - adminCosts - inp.shareholderHI - retirementERCapped
  );

  // Step 12 — D-7: IL replacement tax
  const stateEntityTax    = entityIncomePreState * IL_REPLACEMENT_RATE;
  const k1OrdinaryIncome  = Math.max(0, entityIncomePreState - stateEntityTax);

  // Step 14 — AGI
  // Rev. Rul. 91-26 / Notice 2008-1: premium is included in W-2 Box 1 but NOT
  // Boxes 3/5 (FICA wage base stays at salary only). Shareholder deducts it
  // above-the-line under §162(l). The gross-up and deduction net to zero on AGI;
  // the real tax benefit is the lower K-1 (entity deducted the premium).
  const w2Box1       = inp.salary + inp.shareholderHI;  // W-2 Box 1 = salary + HI gross-up
  const sCorpSehiDed = inp.shareholderHI;               // §162(l) deduction on Form 1040
  const sCorpAgi     = w2Box1 + k1OrdinaryIncome - sCorpSehiDed + inp.otherIncome;
  // = salary + shareholderHI + k1 - shareholderHI + other = salary + k1 + other (net unchanged)

  // Steps 15–17
  const sCorpTiPreQbi = Math.max(0, sCorpAgi - stdDed);
  const sCorpQbi      = k1OrdinaryIncome; // W-2 wages are NOT QBI
  const { deduction: sCorpQbiDed, label: sCorpQbiLabel } = calcQbiDeduction({
    qbi: sCorpQbi,
    tiPreQbi: sCorpTiPreQbi,
    w2Wages: w2Box1,  // §199A W-2 wage limit uses Box 1 wages (includes HI per PLR/Notice 2008-1)
    isSstb: inp.isSstb,
    fs,
    materialParticipation: inp.materialParticipation,
    netCapitalGain: inp.netCapitalGain,
  });

  // Steps 18–20
  const sCorpTaxableIncome = Math.max(0, sCorpTiPreQbi - sCorpQbiDed);
  const sCorpFedTax        = calcFederalTax(sCorpTaxableIncome, fs);
  const sCorpStateTax      = Math.max(0, sCorpAgi - ilExemp) * IL_INCOME_TAX_RATE;

  // Step 21 — Total burden (health ins and retirement are NOT taxes; excluded per spec)
  const sCorpTotal =
    sCorpFedTax + eeFica + erFica + addlMedicareEE
    + futa + suta + adminCosts
    + sCorpStateTax + stateEntityTax;

  const savings = schedCTotal - sCorpTotal;

  return {
    stdDed, addlMedThreshold: amtThresh,
    retirementERCapped, retirementERCap,
    // Schedule C
    seBase, seSs, seMedicare, seTax, addlMedicareSE, seDeduction,
    schedCQbi, schedCAgi, schedCTiPreQbi, schedCQbiDed, schedCQbiLabel,
    schedCTaxableIncome, schedCFedTax, schedCStateTax, schedCTotal,
    // S Corp
    eeFicaSs, eeFicaMedicare, eeFica, erFica, addlMedicareEE,
    futa, suta, adminCosts,
    entityIncomePreState, stateEntityTax, k1OrdinaryIncome,
    w2Box1, sCorpSehiDed,
    sCorpAgi, sCorpTiPreQbi, sCorpQbi, sCorpQbiDed, sCorpQbiLabel,
    sCorpTaxableIncome, sCorpFedTax, sCorpStateTax, sCorpTotal,
    savings,
  };
}
