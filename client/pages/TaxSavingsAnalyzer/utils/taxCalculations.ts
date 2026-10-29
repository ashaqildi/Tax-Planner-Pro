const BRACKETS_2025: Record<string, { rate: number; min: number; max: number }[]> = {
  mfj: [
    { rate: 0.10, min: 0, max: 23850 },
    { rate: 0.12, min: 23850, max: 96950 },
    { rate: 0.22, min: 96950, max: 206700 },
    { rate: 0.24, min: 206700, max: 394600 },
    { rate: 0.32, min: 394600, max: 501050 },
    { rate: 0.35, min: 501050, max: 751600 },
    { rate: 0.37, min: 751600, max: Infinity },
  ],
  single: [
    { rate: 0.10, min: 0, max: 11925 },
    { rate: 0.12, min: 11925, max: 48475 },
    { rate: 0.22, min: 48475, max: 103350 },
    { rate: 0.24, min: 103350, max: 197300 },
    { rate: 0.32, min: 197300, max: 250525 },
    { rate: 0.35, min: 250525, max: 375800 },
    { rate: 0.37, min: 375800, max: Infinity },
  ],
  mfs: [
    { rate: 0.10, min: 0, max: 11925 },
    { rate: 0.12, min: 11925, max: 48475 },
    { rate: 0.22, min: 48475, max: 103350 },
    { rate: 0.24, min: 103350, max: 197300 },
    { rate: 0.32, min: 197300, max: 250525 },
    { rate: 0.35, min: 250525, max: 375800 },
    { rate: 0.37, min: 375800, max: Infinity },
  ],
  hoh: [
    { rate: 0.10, min: 0, max: 17000 },
    { rate: 0.12, min: 17000, max: 64850 },
    { rate: 0.22, min: 64850, max: 103350 },
    { rate: 0.24, min: 103350, max: 197300 },
    { rate: 0.32, min: 197300, max: 250500 },
    { rate: 0.35, min: 250500, max: 375800 },
    { rate: 0.37, min: 375800, max: Infinity },
  ],
  qss: [
    { rate: 0.10, min: 0, max: 23850 },
    { rate: 0.12, min: 23850, max: 96950 },
    { rate: 0.22, min: 96950, max: 206700 },
    { rate: 0.24, min: 206700, max: 394600 },
    { rate: 0.32, min: 394600, max: 501050 },
    { rate: 0.35, min: 501050, max: 751600 },
    { rate: 0.37, min: 751600, max: Infinity },
  ],
};

// 2025 Standard Deductions (OBBBA confirmed)
const STANDARD_DEDUCTIONS_2025: Record<string, number> = {
  mfj: 30000,
  single: 15000,
  mfs: 15000,
  hoh: 22500,
  qss: 30000,
};

// Additional standard deduction for 65+ or blind (2025)
// MFJ: $1,600 per qualifying person; Single/HOH: $2,000
export const ADDITIONAL_STD_DEDUCTION_MFJ = 1600;
export const ADDITIONAL_STD_DEDUCTION_SINGLE = 2000;

const LTCG_THRESHOLDS_2025: Record<string, { rate15: number; rate20: number }> = {
  mfj: { rate15: 96700, rate20: 600050 },
  single: { rate15: 48350, rate20: 533400 },
  mfs: { rate15: 48350, rate20: 300000 },
  hoh: { rate15: 64750, rate20: 566700 },
  qss: { rate15: 96700, rate20: 600050 },
};

export function computeMarginalRate(agi: number, filingStatus: string): number {
  const brackets = BRACKETS_2025[filingStatus] ?? BRACKETS_2025.single;
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (agi > brackets[i].min) return brackets[i].rate;
  }
  return 0.10;
}

export function computeFederalTax(taxableIncome: number, filingStatus: string): number {
  const brackets = BRACKETS_2025[filingStatus] ?? BRACKETS_2025.single;
  let tax = 0;
  for (const b of brackets) {
    if (taxableIncome <= b.min) break;
    tax += (Math.min(taxableIncome, b.max) - b.min) * b.rate;
  }
  return Math.max(0, tax);
}

export function computeLTCGRate(agi: number, filingStatus: string): number {
  const t = LTCG_THRESHOLDS_2025[filingStatus] ?? LTCG_THRESHOLDS_2025.single;
  if (agi > t.rate20) return 0.238; // 20% + 3.8% NIIT
  if (agi > t.rate15) return 0.15;
  return 0;
}

export function getStandardDeduction(filingStatus: string, ownerAge = 0, spouseAge = 0): number {
  const base = STANDARD_DEDUCTIONS_2025[filingStatus] ?? 15000;
  let additional = 0;
  if (filingStatus === 'mfj' || filingStatus === 'qss') {
    if (ownerAge >= 65) additional += ADDITIONAL_STD_DEDUCTION_MFJ;
    if (spouseAge >= 65) additional += ADDITIONAL_STD_DEDUCTION_MFJ;
  } else {
    if (ownerAge >= 65) additional += ADDITIONAL_STD_DEDUCTION_SINGLE;
  }
  return base + additional;
}

export function estimateCashBalanceContribution(age: number, w2: number): number {
  let estimated = 0;
  if (age < 40) estimated = 50000;
  else if (age < 45) estimated = 100000;
  else if (age < 50) estimated = 150000;
  else if (age < 55) estimated = 200000;
  else if (age < 60) estimated = 250000;
  else if (age < 65) estimated = 280000;
  else estimated = 300000;
  return Math.min(estimated, Math.max(w2, 0));
}

export interface RetirementLimits {
  maxEmployeeDeferral: number;
  maxTotalContribution: number;
  catchUpAmount: number;
  employerContributionRate?: number;
  description: string;
  isSuperCatchUp: boolean;
}

export function getRetirementLimits(planType: string, age: number): RetirementLimits {
  if (planType === 'sep') {
    return {
      maxEmployeeDeferral: 0,
      maxTotalContribution: 70000,
      catchUpAmount: 0,
      employerContributionRate: 0.25,
      description: 'SEP-IRA: Lesser of 25% of W-2 compensation or $70,000. No employee deferral component.',
      isSuperCatchUp: false,
    };
  }
  if (planType === 'simple') {
    const base = 16500;
    const catchUp = age >= 50 ? 3500 : 0;
    return {
      maxEmployeeDeferral: base + catchUp,
      maxTotalContribution: base + catchUp + base * 0.03,
      catchUpAmount: catchUp,
      description: `SIMPLE IRA: Up to $${(base + catchUp).toLocaleString()} employee deferral. Employer match typically 2-3%. Must be established before October 1 for new plans.`,
      isSuperCatchUp: false,
    };
  }
  // Solo 401(k) default
  const base = 23500;
  const catchUp50 = age >= 50 && age < 60 ? 7500 : 0;
  const superCatchUp = age >= 60 && age <= 63 ? 11250 : 0; // SECURE 2.0
  const totalCatchUp = catchUp50 + superCatchUp;
  return {
    maxEmployeeDeferral: base + totalCatchUp,
    maxTotalContribution: 70000,
    catchUpAmount: totalCatchUp,
    description: `Solo 401(k): Up to $${(base + totalCatchUp).toLocaleString()} employee deferral${superCatchUp > 0 ? ' (incl. SECURE 2.0 super catch-up)' : catchUp50 > 0 ? ' (incl. catch-up)' : ''} + 25% employer profit sharing, combined max $70,000.`,
    isSuperCatchUp: superCatchUp > 0,
  };
}

export function computeCombinedRate(federalRate: number, ilRate: number): number {
  return federalRate + ilRate;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatCurrencyExact(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatPercent(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

export const SS_WAGE_BASE_2025 = 176100;
export const SALT_CAP_2025 = 40000;
export const MILEAGE_RATE_2025 = 0.70; // IRS business mileage rate 2025
export const BONUS_DEPRECIATION_2025 = 0.40; // Current law (TCJA phase-down)
export const BONUS_DEPRECIATION_OBBBA = 1.00; // If OBBBA enacted
