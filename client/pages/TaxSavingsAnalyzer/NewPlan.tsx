import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  TaxSavingsPlan, createEmptyPlan, upsertPlan, loadPlans, DRAFT_KEY, computeAutoAgi,
} from './types/plan';
import { computeMarginalRate } from './utils/taxCalculations';
import { exportPlanToPdf, exportSummaryPdf } from './utils/pdfExport';
import Step1ClientInfo from './steps/Step1ClientInfo';
import Step2FinancialInputs from './steps/Step2FinancialInputs';
import Step3StrategySelection from './steps/Step3StrategySelection';
import Step4Review from './steps/Step4Review';

const STEP_LABELS = [
  { n: 1, label: 'Client Info' },
  { n: 2, label: 'Financials' },
  { n: 3, label: 'Strategies' },
  { n: 4, label: 'Review & Save' },
];

interface Props {
  planId?: string;
}

function loadDraft(): TaxSavingsPlan | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.entities) || parsed.entities.length === 0) return null;
    return parsed as TaxSavingsPlan;
  } catch {
    return null;
  }
}

export default function NewPlan({ planId }: Props) {
  const [, navigate] = useLocation();
  const base = "/".replace(/\/$/, '');

  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState<TaxSavingsPlan>(() => {
    if (planId) {
      const found = loadPlans().find(p => p.id === planId);
      if (found) return found;
    }
    const draft = loadDraft();
    if (draft && !planId) return draft;
    return createEmptyPlan();
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!planId) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
    }
  }, [plan, planId]);

  const updatePlan = useCallback((updates: Partial<TaxSavingsPlan>) => {
    setPlan(prev => {
      const next = { ...prev, ...updates };

      // Recompute entity totals when entities change
      if ('entities' in updates) {
        next.totalYear1Savings = (next.entities ?? []).reduce((sum, e) =>
          sum + e.selectedStrategies.reduce((s, x) => s + x.estimatedSavings, 0)
             + e.customStrategies.reduce((s, c) => s + c.estimatedSavings, 0), 0);
        next.totalRecurringSavings = (next.entities ?? []).reduce((sum, e) =>
          sum + e.selectedStrategies.filter(s => s.isRecurring).reduce((s, x) => s + x.estimatedSavings, 0)
             + e.customStrategies.filter(c => c.isRecurring).reduce((s, c) => s + c.estimatedSavings, 0), 0);

        // When entity netBusinessIncome/ownershipPct change, recompute AGI with pass-through
        if (!('agi' in updates)) {
          next.agi = computeAutoAgi(next);
        }
      }

      // Auto-compute marginal rate if not overridden
      if (!next.federalRateOverridden && ('agi' in updates || 'filingStatus' in updates || 'grossW2Income' in updates || 'otherIncome' in updates || 'entities' in updates)) {
        next.federalMarginalRate = computeMarginalRate(next.agi ?? 0, next.filingStatus);
      }

      // Auto-compute IL state tax if not overridden
      if (!next.stateIncomeTaxOverridden && ('agi' in updates || 'filingStatus' in updates || 'entities' in updates)) {
        next.stateIncomeTaxesPaid = (next.agi ?? 0) * next.ilRate;
      }

      return next;
    });
  }, []);

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!plan.taxpayerFirstName.trim()) return 'Please enter taxpayer first name.';
      if (!plan.taxpayerLastName.trim()) return 'Please enter taxpayer last name.';
      const emptyEntity = plan.entities.find(e => !e.entityLabel.trim());
      if (emptyEntity) return 'Please enter a name/label for all entities.';
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) { alert(err); return; }
    setStep(s => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    setStep(s => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const planName = plan.planName.trim() || `${plan.taxpayerLastName} ${plan.taxYear} Tax Plan`;
      const saved: TaxSavingsPlan = { ...plan, planName, updatedAt: now, createdAt: planId ? plan.createdAt : now };
      upsertPlan(saved);
      localStorage.removeItem(DRAFT_KEY);
      navigate(`${base}/tax-savings-analyzer`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAndExport() {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const planName = plan.planName.trim() || `${plan.taxpayerLastName} ${plan.taxYear} Tax Plan`;
      const saved: TaxSavingsPlan = { ...plan, planName, updatedAt: now, createdAt: planId ? plan.createdAt : now };
      upsertPlan(saved);
      localStorage.removeItem(DRAFT_KEY);
      await exportPlanToPdf(saved);
      navigate(`${base}/tax-savings-analyzer`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAndExportSummary() {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const planName = plan.planName.trim() || `${plan.taxpayerLastName} ${plan.taxYear} Tax Plan`;
      const saved: TaxSavingsPlan = { ...plan, planName, updatedAt: now, createdAt: planId ? plan.createdAt : now };
      upsertPlan(saved);
      localStorage.removeItem(DRAFT_KEY);
      await exportSummaryPdf(saved);
      navigate(`${base}/tax-savings-analyzer`);
    } finally {
      setIsSaving(false);
    }
  }

  const totalStrategies = plan.entities.reduce((s, e) => s + e.selectedStrategies.length + e.customStrategies.length, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`${base}/tax-savings-analyzer`)}
          className="text-slate-400 hover:text-slate-700 text-sm font-medium transition-colors">
          &larr; Back to Plans
        </button>
        <span className="text-slate-200">|</span>
        <h1 className="text-xl font-bold text-slate-800">
          {planId ? 'Edit Tax Savings Plan' : 'New Tax Savings Plan'}
        </h1>
      </div>

      {/* Step Progress */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center">
          {STEP_LABELS.map((s, idx) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <button onClick={() => step > s.n && setStep(s.n)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors
                    ${step === s.n ? 'bg-amber-500 text-white shadow-md' :
                      step > s.n ? 'bg-green-600 text-white cursor-pointer' :
                      'bg-slate-100 text-slate-400'}`}>
                  {step > s.n ? '✓' : s.n}
                </button>
                <span className={`text-[11px] mt-1.5 font-medium text-center leading-tight
                  ${step === s.n ? 'text-amber-600' : step > s.n ? 'text-green-600' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 ${step > s.n ? 'bg-green-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {step === 1 && <Step1ClientInfo plan={plan} onChange={updatePlan} />}
        {step === 2 && <Step2FinancialInputs plan={plan} onChange={updatePlan} />}
        {step === 3 && <Step3StrategySelection plan={plan} onChange={updatePlan} />}
        {step === 4 && (
          <Step4Review plan={plan} onChange={updatePlan}
            onSave={handleSave} onSaveAndExport={handleSaveAndExport}
            onSaveAndExportSummary={handleSaveAndExportSummary} isSaving={isSaving} />
        )}
      </div>

      {/* Nav Buttons */}
      {step < 4 && (
        <div className="flex items-center justify-between pb-6">
          <button onClick={goBack} disabled={step === 1}
            className="text-sm text-slate-500 hover:text-slate-800 font-medium px-5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            &larr; Back
          </button>
          {step < 3 && <span className="text-xs text-slate-400">Progress is auto-saved as a draft</span>}
          {step === 3 && (
            <span className="text-xs text-amber-600 font-medium">
              {totalStrategies} {totalStrategies === 1 ? 'strategy' : 'strategies'} selected
            </span>
          )}
          <button onClick={goNext}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm">
            Continue &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
