import {
  createEmptyPlan, DRAFT_KEY, ENTITY_LABELS, FILING_STATUS_LABELS, STORAGE_KEY,
  type TaxSavingsPlan,
} from '../types/plan';

const FORMAT = 'tax-savings-analyzer-backup';
const VERSION = 1;

export interface AnalyzerBackup {
  format: typeof FORMAT;
  version: typeof VERSION;
  exportedAt: string;
  plans: TaxSavingsPlan[];
  draft: TaxSavingsPlan | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checkFields(value: Record<string, unknown>, template: Record<string, unknown>, path: string) {
  for (const [key, expected] of Object.entries(template)) {
    const actual = value[key];
    if (typeof expected === 'number' ? typeof actual !== 'number' || !Number.isFinite(actual)
      : Array.isArray(expected) ? !Array.isArray(actual)
      : typeof actual !== typeof expected) {
      throw new Error(`${path}.${key} is missing or has an invalid type.`);
    }
  }
}

function checkPlan(value: unknown, path: string): asserts value is TaxSavingsPlan {
  if (!record(value)) throw new Error(`${path} must be an object.`);
  // The plan and entity defaults define the persisted field types; nested strategies
  // have their own checks below. Additional fields are preserved for forward compatibility.
  const template = createEmptyPlan();
  checkFields(value, template as unknown as Record<string, unknown>, path);
  if (!value.id || !Number.isInteger(value.taxYear) || !Number.isFinite(Date.parse(value.createdAt as string))
    || !Number.isFinite(Date.parse(value.updatedAt as string))) {
    throw new Error(`${path} has an invalid ID, tax year, or date.`);
  }
  if (!Object.hasOwn(FILING_STATUS_LABELS, value.filingStatus as string)) {
    throw new Error(`${path} has an invalid filing status.`);
  }
  if ((value.entities as unknown[]).length === 0) throw new Error(`${path}.entities must not be empty.`);
  const entityIds = new Set<string>();
  for (const [i, entity] of (value.entities as unknown[]).entries()) {
    const at = `${path}.entities[${i}]`;
    if (!record(entity)) throw new Error(`${at} must be an object.`);
    const { businessName, ein, ...requiredEntityFields } = template.entities[0];
    checkFields(entity, requiredEntityFields as Record<string, unknown>, at);
    if (!entity.id || entityIds.has(entity.id as string)
      || !Object.hasOwn(ENTITY_LABELS, entity.entityType as string)) {
      throw new Error(`${at} has an invalid or duplicate ID or entity type.`);
    }
    entityIds.add(entity.id as string);
    if (entity.businessName !== undefined && typeof entity.businessName !== 'string'
      || entity.ein !== undefined && typeof entity.ein !== 'string') {
      throw new Error(`${at} has an invalid business name or EIN.`);
    }
    for (const [j, strategy] of (entity.selectedStrategies as unknown[]).entries()) {
      const strategyPath = `${at}.selectedStrategies[${j}]`;
      if (!record(strategy) || typeof strategy.strategyId !== 'string'
        || typeof strategy.strategyName !== 'string' || typeof strategy.isRecurring !== 'boolean'
        || typeof strategy.estimatedSavings !== 'number' || !Number.isFinite(strategy.estimatedSavings)
        || !record(strategy.inputs) || (strategy.notes !== undefined && typeof strategy.notes !== 'string')
        || Object.values(strategy.inputs).some(input =>
          !['string', 'boolean', 'number'].includes(typeof input)
          || typeof input === 'number' && !Number.isFinite(input))) {
        throw new Error(`${strategyPath} is invalid.`);
      }
    }
    for (const [j, strategy] of (entity.customStrategies as unknown[]).entries()) {
      const strategyPath = `${at}.customStrategies[${j}]`;
      if (!record(strategy) || typeof strategy.id !== 'string' || !strategy.id
        || typeof strategy.name !== 'string' || typeof strategy.description !== 'string'
        || typeof strategy.estimatedSavings !== 'number' || !Number.isFinite(strategy.estimatedSavings)
        || typeof strategy.isRecurring !== 'boolean') {
        throw new Error(`${strategyPath} is invalid.`);
      }
    }
  }
}

export function validateBackup(value: unknown): AnalyzerBackup {
  if (!record(value) || value.format !== FORMAT || value.version !== VERSION
    || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))
    || !Array.isArray(value.plans) || !(value.draft === null || record(value.draft))) {
    throw new Error('Not a supported Tax Savings Analyzer backup (format/version or structure is invalid).');
  }
  const ids = new Set<string>();
  value.plans.forEach((plan, i) => {
    checkPlan(plan, `plans[${i}]`);
    if (ids.has(plan.id)) throw new Error(`Duplicate plan ID in plans[${i}].`);
    ids.add(plan.id);
  });
  if (value.draft !== null) checkPlan(value.draft, 'draft');
  return value as unknown as AnalyzerBackup;
}

export function readBrowserBackup(): AnalyzerBackup {
  // Do not use loadPlans here: its error fallback returns [] and could silently omit records.
  const plansRaw = localStorage.getItem(STORAGE_KEY);
  const draftRaw = localStorage.getItem(DRAFT_KEY);
  let plans: unknown;
  let draft: unknown;
  try {
    plans = plansRaw === null ? [] : JSON.parse(plansRaw);
    draft = draftRaw === null ? null : JSON.parse(draftRaw);
  } catch {
    throw new Error('Stored plans or draft contain invalid JSON. No backup was downloaded.');
  }
  return validateBackup({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), plans, draft });
}

export function replaceBrowserBackup(backup: AnalyzerBackup): void {
  // Validate again before any change, even if a caller bypassed the import UI.
  validateBackup(backup);
  const previousPlans = localStorage.getItem(STORAGE_KEY);
  const previousDraft = localStorage.getItem(DRAFT_KEY);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.plans));
    if (backup.draft === null) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(backup.draft));
  } catch (error) {
    try {
      if (previousPlans === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previousPlans);
      if (previousDraft === null) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, previousDraft);
    } catch {
      throw new Error('Restore failed and automatic rollback failed. Check browser storage before trying again.');
    }
    throw error;
  }
}