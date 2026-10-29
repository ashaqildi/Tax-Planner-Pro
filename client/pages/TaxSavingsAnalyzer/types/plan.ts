export type EntityType = 'scorp' | 'partnership' | 'soleProp' | 'individual';
export type FilingStatus = 'mfj' | 'single' | 'mfs' | 'hoh' | 'qss';

export interface SelectedStrategy {
  strategyId: string;
  strategyName: string;
  isRecurring: boolean;
  inputs: Record<string, number | string | boolean>;
  estimatedSavings: number;
  notes?: string;
}

export interface CustomStrategy {
  id: string;
  name: string;
  description: string;
  estimatedSavings: number;
  isRecurring: boolean;
}

export interface TaxPlanEntity {
  id: string;
  entityLabel: string;
  entityType: EntityType;
  businessName?: string;
  ein?: string;
  ownershipPct: number;
  ownerW2: number;
  grossRevenue: number;
  totalDeductions: number;
  netBusinessIncome: number;
  selectedStrategies: SelectedStrategy[];
  customStrategies: CustomStrategy[];
  entityTaxSavings: number;
  color: string;
}

export interface TaxSavingsPlan {
  id: string;
  planName: string;
  taxYear: number;
  createdAt: string;
  updatedAt: string;
  advisorNotes: string;
  advisorFees: number;
  advisorServiceDescription: string;
  includeAdvisorFees: boolean;

  // Primary Taxpayer
  taxpayerFirstName: string;
  taxpayerLastName: string;
  filingStatus: FilingStatus;
  ownerAge: number;
  spouseFirstName: string;
  spouseLastName: string;
  spouseAge: number;
  state: string;
  numberOfDependents: number;

  // Personal / 1040 financials
  grossW2Income: number;
  spouseIncome: number;
  otherIncome: number;
  agi: number;
  liquidAssets: number;

  // Itemized deductions
  mortgageInterestPrimary: number;
  mortgageInterestSecond: number;
  charitableCash: number;
  charitableNonCash: number;
  propertyTaxes: number;
  vehicleRegistrationTax: number;
  stateIncomeTaxesPaid: number;
  stateIncomeTaxOverridden: boolean;
  otherItemizedDeductions: number;
  otherItemizedDescription: string;
  medicalExpenses: number;

  // Tax rates
  federalMarginalRate: number;
  federalRateOverridden: boolean;
  ilRate: number;

  // Entities
  entities: TaxPlanEntity[];

  // Totals
  totalYear1Savings: number;
  totalRecurringSavings: number;
  effectiveRateBefore: number;
  effectiveRateAfter: number;
}

export const ENTITY_LABELS: Record<EntityType, string> = {
  scorp: 'S Corporation',
  partnership: 'Partnership / Multi-Member LLC',
  soleProp: 'Sole Proprietor / Single-Member LLC',
  individual: 'Individual (1040)',
};

export const ENTITY_SHORT_LABELS: Record<EntityType, string> = {
  scorp: 'S Corp (1120-S)',
  partnership: 'Partnership (1065)',
  soleProp: 'Schedule C',
  individual: 'Individual (1040)',
};

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  mfj: 'Married Filing Jointly',
  single: 'Single',
  mfs: 'Married Filing Separately',
  hoh: 'Head of Household',
  qss: 'Qualifying Surviving Spouse',
};

export const ENTITY_COLORS = [
  '#1a5276', // navy blue
  '#ca8a04', // amber
  '#166534', // green
  '#7e22ce', // purple
  '#be123c', // rose
  '#0891b2', // cyan
];

export const STORAGE_KEY = 'shaqildi_tax_plans';
export const DRAFT_KEY = 'shaqildi_tax_plan_draft';

function migratePlan(raw: Record<string, unknown>): TaxSavingsPlan {
  const base = createEmptyPlan();
  const merged = { ...base, ...raw } as TaxSavingsPlan & Record<string, unknown>;

  // If old format: no entities array
  if (!Array.isArray(merged.entities) || merged.entities.length === 0) {
    const oldET = (raw.entityType as EntityType) ?? 'individual';
    const oldName = (raw.clientName as string) ?? '';
    const parts = oldName.trim().split(/\s+/);
    if (!merged.taxpayerFirstName && parts.length > 0) merged.taxpayerFirstName = parts[0];
    if (!merged.taxpayerLastName && parts.length > 1) merged.taxpayerLastName = parts.slice(1).join(' ');

    const entitySelStrategies: SelectedStrategy[] = Array.isArray(raw.selectedStrategies)
      ? (raw.selectedStrategies as SelectedStrategy[]) : [];
    const entityCustomStrategies: CustomStrategy[] = Array.isArray(raw.customStrategies)
      ? (raw.customStrategies as CustomStrategy[]) : [];

    const entity = createDefaultEntity({
      entityType: oldET,
      entityLabel: oldName || (oldET === 'individual' ? (merged.taxpayerFirstName + ' ' + merged.taxpayerLastName).trim() : ''),
      ownerW2: Number(raw.ownerW2) || 0,
      grossRevenue: Number(raw.grossRevenue) || 0,
      totalDeductions: Number(raw.totalDeductions) || 0,
      netBusinessIncome: Number(raw.netBusinessIncome) || 0,
      ownershipPct: Number(raw.ownershipPct) || 100,
      selectedStrategies: entitySelStrategies,
      customStrategies: entityCustomStrategies,
      entityTaxSavings: entitySelStrategies.reduce((s, x) => s + (x.estimatedSavings || 0), 0),
      color: ENTITY_COLORS[0],
    });

    // Always ensure an Individual (1040) entity exists for personal strategies
    // (Augusta Rule, HSA, family employment, etc.). If the migrated entity is
    // already individual, use it alone; otherwise add a separate individual tab.
    if (oldET === 'individual') {
      merged.entities = [entity];
    } else {
      const individualEntity = createDefaultEntity({
        entityType: 'individual',
        entityLabel: (merged.taxpayerFirstName + ' ' + merged.taxpayerLastName).trim() || 'Personal (1040)',
        color: ENTITY_COLORS[1] ?? '#64748b',
      });
      merged.entities = [entity, individualEntity];
    }
  }

  // Ensure all entity fields have defaults
  merged.entities = merged.entities.map((e, i) => ({
    id: e.id ?? crypto.randomUUID(),
    entityLabel: e.entityLabel ?? '',
    entityType: (e.entityType as EntityType) ?? 'individual',
    businessName: e.businessName ?? '',
    ein: e.ein ?? '',
    ownershipPct: e.ownershipPct ?? 100,
    ownerW2: e.ownerW2 ?? 0,
    grossRevenue: e.grossRevenue ?? 0,
    totalDeductions: e.totalDeductions ?? 0,
    netBusinessIncome: e.netBusinessIncome ?? 0,
    selectedStrategies: Array.isArray(e.selectedStrategies) ? e.selectedStrategies : [],
    customStrategies: Array.isArray(e.customStrategies) ? e.customStrategies : [],
    entityTaxSavings: e.entityTaxSavings ?? 0,
    color: e.color ?? ENTITY_COLORS[i % ENTITY_COLORS.length],
  }));

  return merged;
}

export function loadPlans(): TaxSavingsPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(p => migratePlan(p as Record<string, unknown>));
  } catch {
    return [];
  }
}

export function savePlans(plans: TaxSavingsPlan[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export function deletePlan(id: string): void {
  savePlans(loadPlans().filter(p => p.id !== id));
}

export function upsertPlan(plan: TaxSavingsPlan): void {
  const plans = loadPlans();
  const idx = plans.findIndex(p => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan;
  else plans.unshift(plan);
  savePlans(plans);
}

export function createDefaultEntity(overrides?: Partial<TaxPlanEntity>): TaxPlanEntity {
  return {
    id: crypto.randomUUID(),
    entityLabel: '',
    entityType: 'individual',
    businessName: '',
    ein: '',
    ownershipPct: 100,
    ownerW2: 0,
    grossRevenue: 0,
    totalDeductions: 0,
    netBusinessIncome: 0,
    selectedStrategies: [],
    customStrategies: [],
    entityTaxSavings: 0,
    color: ENTITY_COLORS[0],
    ...overrides,
  };
}

export function createEmptyPlan(): TaxSavingsPlan {
  return {
    id: crypto.randomUUID(),
    planName: '',
    taxYear: 2025,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    advisorNotes: '',
    advisorFees: 0,
    advisorServiceDescription: 'Tax Planning & Preparation',
    includeAdvisorFees: false,

    taxpayerFirstName: '',
    taxpayerLastName: '',
    filingStatus: 'mfj',
    ownerAge: 45,
    spouseFirstName: '',
    spouseLastName: '',
    spouseAge: 0,
    state: 'Illinois',
    numberOfDependents: 0,

    grossW2Income: 0,
    spouseIncome: 0,
    otherIncome: 0,
    agi: 0,
    liquidAssets: 0,

    mortgageInterestPrimary: 0,
    mortgageInterestSecond: 0,
    charitableCash: 0,
    charitableNonCash: 0,
    propertyTaxes: 0,
    vehicleRegistrationTax: 0,
    stateIncomeTaxesPaid: 0,
    stateIncomeTaxOverridden: false,
    otherItemizedDeductions: 0,
    otherItemizedDescription: '',
    medicalExpenses: 0,

    federalMarginalRate: 0.24,
    federalRateOverridden: false,
    ilRate: 0.0495,

    entities: [
      createDefaultEntity({ entityLabel: '', entityType: 'individual', color: ENTITY_COLORS[0] }),
    ],

    totalYear1Savings: 0,
    totalRecurringSavings: 0,
    effectiveRateBefore: 0,
    effectiveRateAfter: 0,
  };
}

export function getFullName(plan: TaxSavingsPlan): string {
  return [plan.taxpayerFirstName, plan.taxpayerLastName].filter(Boolean).join(' ');
}

export function computeAutoItemized(plan: TaxSavingsPlan): {
  saltRaw: number; saltCapped: number; totalItemized: number; medicalDeductible: number;
} {
  const saltRaw = plan.propertyTaxes + plan.stateIncomeTaxesPaid;
  const saltCapped = Math.min(saltRaw, 40000);
  const medicalDeductible = Math.max(0, plan.medicalExpenses - plan.agi * 0.075);
  const totalItemized = plan.mortgageInterestPrimary + plan.mortgageInterestSecond
    + plan.charitableCash + plan.charitableNonCash
    + saltCapped + medicalDeductible + plan.otherItemizedDeductions;
  return { saltRaw, saltCapped, totalItemized, medicalDeductible };
}

/**
 * Returns the total pass-through income flowing from all non-individual entities
 * to the owner's Form 1040. For S-Corps this is K-1 ordinary income; for
 * partnerships it is the partner's distributive share; for sole props it is
 * Schedule C net profit. ownerW2 from the entity is already captured in
 * plan.grossW2Income, so we do NOT subtract it here — netBusinessIncome on
 * an S-Corp 1120-S is already AFTER officer compensation.
 */
export function computePassThroughIncome(plan: TaxSavingsPlan): number {
  return plan.entities
    .filter(e => e.entityType !== 'individual')
    .reduce((sum, e) => sum + (e.netBusinessIncome * (e.ownershipPct / 100)), 0);
}

/**
 * Full auto-computed AGI = W-2 wages + spouse income + other income
 *   + pass-through K-1 / Schedule C income from all entities.
 * The result is used as the AGI placeholder unless the user manually overrides.
 */
export function computeAutoAgi(plan: TaxSavingsPlan): number {
  const spouseInc = plan.filingStatus === 'mfj' ? plan.spouseIncome : 0;
  return plan.grossW2Income + spouseInc + plan.otherIncome + computePassThroughIncome(plan);
}
