import { TaxSavingsPlan, ENTITY_LABELS, ENTITY_SHORT_LABELS, FILING_STATUS_LABELS, getFullName, computeAutoItemized } from '../types/plan';
import { formatCurrency, formatPercent, computeFederalTax, getStandardDeduction } from '../utils/taxCalculations';

interface Props {
  plan: TaxSavingsPlan;
  onChange: (updates: Partial<TaxSavingsPlan>) => void;
  onSave: () => void;
  onSaveAndExport: () => void;
  onSaveAndExportSummary: () => void;
  isSaving?: boolean;
}

export default function Step4Review({ plan, onChange, onSave, onSaveAndExport, onSaveAndExportSummary, isSaving }: Props) {
  const totalYear1 = plan.entities.reduce((sum, e) =>
    sum + e.selectedStrategies.reduce((s, x) => s + x.estimatedSavings, 0)
       + e.customStrategies.reduce((s, c) => s + c.estimatedSavings, 0), 0);

  const totalRecurring = plan.entities.reduce((sum, e) =>
    sum + e.selectedStrategies.filter(s => s.isRecurring).reduce((s, x) => s + x.estimatedSavings, 0)
       + e.customStrategies.filter(c => c.isRecurring).reduce((s, c) => s + c.estimatedSavings, 0), 0);

  const { totalItemized } = computeAutoItemized(plan);
  const stdDeduction = getStandardDeduction(plan.filingStatus, plan.ownerAge, plan.spouseAge);
  const deduction = Math.max(totalItemized, stdDeduction);
  const taxableIncomeBefore = Math.max(0, plan.agi - deduction);
  const federalTaxBefore = computeFederalTax(taxableIncomeBefore, plan.filingStatus);
  const ilTaxBefore = plan.agi * plan.ilRate;
  const totalTaxBefore = federalTaxBefore + ilTaxBefore;
  const effectiveRateBefore = plan.agi > 0 ? totalTaxBefore / plan.agi : 0;
  const totalTaxAfter = Math.max(0, totalTaxBefore - totalYear1);
  const effectiveRateAfter = plan.agi > 0 ? totalTaxAfter / plan.agi : 0;

  const combinedRate = plan.federalMarginalRate + plan.ilRate;
  const afterTaxCostOfServices = plan.advisorFees * (1 - combinedRate);
  const netSavingsAfterFees = totalYear1 - afterTaxCostOfServices;
  const taxDeductibleBenefit = plan.advisorFees * combinedRate;

  // Auto-generate plan name if empty (using last name + year)
  const autoName = plan.taxpayerLastName ? `${plan.taxpayerLastName} ${plan.taxYear} Tax Plan` : '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Review & Save</h2>
        <p className="text-sm text-slate-500">Review your tax savings plan before saving and exporting the PDF report.</p>
      </div>

      {/* Plan Name */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Plan Name / Label</label>
        <input type="text" value={plan.planName || autoName}
          onChange={e => onChange({ planName: e.target.value })}
          placeholder={autoName || 'e.g., Smith 2025 Tax Plan'}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>

      {/* Client Profile */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-3">Client Profile</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            ['Taxpayer', getFullName(plan) || '—'],
            ['Filing Status', FILING_STATUS_LABELS[plan.filingStatus]],
            ['Tax Year', String(plan.taxYear)],
            ['State', plan.state],
            ['Estimated AGI', formatCurrency(plan.agi)],
            ['Federal Rate', formatPercent(plan.federalMarginalRate)],
            ['IL Rate', formatPercent(plan.ilRate)],
            ['Combined Rate', formatPercent(combinedRate)],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="text-xs text-slate-500">{label}</div>
              <div className="font-semibold text-slate-800 text-sm">{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Entity Summary Table */}
      <div>
        <h3 className="font-bold text-slate-700 text-sm mb-3">Tax Plan by Entity</h3>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Entity Name</th>
                <th className="text-left px-4 py-3 font-semibold">Entity Type</th>
                <th className="text-center px-4 py-3 font-semibold">Strategies</th>
                <th className="text-right px-4 py-3 font-semibold">Est. Year 1 Savings</th>
              </tr>
            </thead>
            <tbody>
              {plan.entities.map((entity, i) => {
                const entitySavings = entity.selectedStrategies.reduce((s, x) => s + x.estimatedSavings, 0)
                  + entity.customStrategies.reduce((s, c) => s + c.estimatedSavings, 0);
                return (
                  <tr key={entity.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entity.color }} />
                        <span className="font-semibold text-slate-800">{entity.entityLabel || ENTITY_LABELS[entity.entityType]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{ENTITY_SHORT_LABELS[entity.entityType]}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{entity.selectedStrategies.length + entity.customStrategies.length}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(entitySavings)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-green-50 border-t-2 border-green-200">
              <tr>
                <td colSpan={3} className="px-4 py-3 font-bold text-slate-800">TOTAL Estimated Year 1 Savings</td>
                <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">{formatCurrency(totalYear1)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-2 text-slate-600 text-sm">Year 2+ Recurring Savings Per Year</td>
                <td className="px-4 py-2 text-right font-semibold text-green-600">{formatCurrency(totalRecurring)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detailed Strategies Table */}
      <div>
        <h3 className="font-bold text-slate-700 text-sm mb-3">All Selected Strategies</h3>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-600 uppercase">Strategy</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-600 uppercase">Entity</th>
                <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-600 uppercase">Type</th>
                <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-600 uppercase">Est. Savings</th>
              </tr>
            </thead>
            <tbody>
              {plan.entities.flatMap(entity => [
                ...entity.selectedStrategies.map(s => ({ ...s, entityLabel: entity.entityLabel || ENTITY_LABELS[entity.entityType], entityColor: entity.color, isCustom: false })),
                ...entity.customStrategies.map(c => ({ strategyId: c.id, strategyName: c.name, isRecurring: c.isRecurring, estimatedSavings: c.estimatedSavings, entityLabel: entity.entityLabel || ENTITY_LABELS[entity.entityType], entityColor: entity.color, isCustom: true })),
              ]).map((s, i) => (
                <tr key={`${s.strategyId}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                  <td className="px-4 py-2.5 text-slate-700">
                    {s.strategyName}{(s as any).isCustom && <span className="text-xs text-slate-400 ml-1">(Custom)</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (s as any).entityColor }} />
                      <span className="text-xs text-slate-500">{(s as any).entityLabel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-400">{s.isRecurring ? 'Recurring' : 'One-time'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-700">{formatCurrency(s.estimatedSavings)}</td>
                </tr>
              ))}
              {plan.entities.every(e => e.selectedStrategies.length === 0 && e.customStrategies.length === 0) && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400 text-sm">No strategies selected. Go back to Step 3.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Rate Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
          <div className="text-xs font-semibold text-red-600 mb-1">Effective Rate Before</div>
          <div className="text-2xl font-bold text-red-700">{formatPercent(effectiveRateBefore)}</div>
          <div className="text-xs text-red-500 mt-1">Est. Tax: {formatCurrency(totalTaxBefore)}</div>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <div className="text-xs font-semibold text-green-600 mb-1">Effective Rate After</div>
          <div className="text-2xl font-bold text-green-700">{formatPercent(effectiveRateAfter)}</div>
          <div className="text-xs text-green-500 mt-1">Est. Tax: {formatCurrency(Math.max(0, totalTaxAfter))}</div>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
          <div className="text-xs font-semibold text-amber-600 mb-1">Total Est. Savings</div>
          <div className="text-2xl font-bold text-amber-700">{formatCurrency(totalYear1)}</div>
          <div className="text-xs text-amber-500 mt-1">Year 1 combined</div>
        </div>
      </div>

      {/* Advisor Fee Section */}
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={plan.includeAdvisorFees}
              onChange={e => onChange({ includeAdvisorFees: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300" />
            <span className="font-semibold text-slate-700 text-sm">Include Advisor Fee Section on Report</span>
          </label>
        </div>
        {plan.includeAdvisorFees && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Service Description</label>
                <input type="text" value={plan.advisorServiceDescription}
                  onChange={e => onChange({ advisorServiceDescription: e.target.value })}
                  placeholder="Tax Planning & Preparation"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fee Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" value={plan.advisorFees || ''}
                    onChange={e => onChange({ advisorFees: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
            </div>
            {plan.advisorFees > 0 && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-2">
                <div className="flex justify-between text-slate-700">
                  <span>Gross Tax Savings:</span>
                  <span className="font-bold text-green-700">{formatCurrency(totalYear1)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Your Investment in Shaqildi CPA Group ({plan.advisorServiceDescription}):</span>
                  <span>({formatCurrency(plan.advisorFees)})</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax Deductible Benefit of Investment ({formatPercent(combinedRate)} rate):</span>
                  <span className="text-green-600">+{formatCurrency(taxDeductibleBenefit)}</span>
                </div>
                <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-2">
                  <span>After-Tax Cost of Services:</span>
                  <span>({formatCurrency(afterTaxCostOfServices)})</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 border-t border-slate-300 pt-2 text-base">
                  <span>Net Tax Savings After Advisory Fees:</span>
                  <span className={netSavingsAfterFees > 0 ? 'text-green-700' : 'text-red-600'}>{formatCurrency(netSavingsAfterFees)}</span>
                </div>
                <p className="text-xs text-slate-400">Advisory fees may be deductible as an ordinary and necessary business expense under IRC §162.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advisor Notes */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Advisor Notes</label>
        <textarea value={plan.advisorNotes} onChange={e => onChange({ advisorNotes: e.target.value })}
          rows={4} placeholder="Add any notes, context, or implementation priorities for this client..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
        <p className="text-xs text-slate-400 mt-1">Included in the PDF report.</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button onClick={onSave} disabled={isSaving}
          className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60">
          {isSaving ? 'Saving...' : 'Save Plan'}
        </button>
        <button onClick={onSaveAndExportSummary} disabled={isSaving}
          className="flex-1 bg-navy-800 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60" style={{ backgroundColor: '#1a2035' }}>
          Save & Export 1-Page Summary
        </button>
        <button onClick={onSaveAndExport} disabled={isSaving}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60">
          Save & Export Full Report
        </button>
      </div>
      <p className="text-xs text-slate-400 text-center">All savings estimates are for planning purposes only. Actual results depend on implementation and individual tax circumstances.</p>
    </div>
  );
}
