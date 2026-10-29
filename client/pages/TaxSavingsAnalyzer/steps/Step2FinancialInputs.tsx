import { TaxSavingsPlan, TaxPlanEntity, ENTITY_LABELS, computeAutoItemized, computeAutoAgi, computePassThroughIncome } from '../types/plan';
import { computeMarginalRate, formatPercent, getStandardDeduction, SALT_CAP_2025, formatCurrency } from '../utils/taxCalculations';

interface Props {
  plan: TaxSavingsPlan;
  onChange: (updates: Partial<TaxSavingsPlan>) => void;
}

function CurrencyInput({ label, value, onChange, helpText, placeholder = '0', autoValue, greyed, tooltipNote }: {
  label: string; value: number; onChange: (v: number) => void; helpText?: string;
  placeholder?: string; autoValue?: string; greyed?: boolean; tooltipNote?: string;
}) {
  return (
    <div className={greyed ? 'opacity-50' : ''}>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
        {label}
        {tooltipNote && (
          <span className="group relative cursor-help">
            <span className="text-slate-400 text-xs border border-slate-300 rounded-full w-4 h-4 inline-flex items-center justify-center">?</span>
            <span className="absolute left-0 top-full mt-1 w-64 bg-slate-800 text-white text-xs rounded-lg p-2 hidden group-hover:block z-10 shadow-lg">
              {tooltipNote}
            </span>
          </span>
        )}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input type="number" value={greyed ? 0 : value || ''} onChange={e => !greyed && onChange(Number(e.target.value))}
          disabled={greyed} placeholder={autoValue || placeholder} min={0}
          className={`w-full rounded-lg border ${greyed ? 'border-slate-100 bg-slate-50' : 'border-slate-200'} pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400`} />
      </div>
      {helpText && <p className="text-xs text-slate-400 mt-1">{helpText}</p>}
    </div>
  );
}

function EntityFinancialsCard({ entity, onChange }: { entity: TaxPlanEntity; onChange: (updates: Partial<TaxPlanEntity>) => void }) {
  if (entity.entityType === 'individual') return null;
  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: entity.color }}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entity.color }} />
        <span className="text-sm font-bold text-slate-700">{entity.entityLabel || ENTITY_LABELS[entity.entityType]}</span>
        <span className="text-xs text-slate-400">({ENTITY_LABELS[entity.entityType]})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gross Business Revenue</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="number" value={entity.grossRevenue || ''} min={0}
              onChange={e => {
                const v = Number(e.target.value);
                onChange({ grossRevenue: v, netBusinessIncome: Math.max(0, v - entity.totalDeductions) });
              }}
              className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Total Business Deductions (before strategies)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="number" value={entity.totalDeductions || ''} min={0}
              onChange={e => {
                const v = Number(e.target.value);
                onChange({ totalDeductions: v, netBusinessIncome: Math.max(0, entity.grossRevenue - v) });
              }}
              className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Net Business Income</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="number" value={entity.netBusinessIncome || ''}
              onChange={e => onChange({ netBusinessIncome: Number(e.target.value) })}
              placeholder="Auto-calculated"
              className="w-full rounded-lg border border-amber-200 bg-amber-50 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <p className="text-xs text-slate-400 mt-1">Auto-calculated. Override if needed.</p>
        </div>
      </div>
    </div>
  );
}

export default function Step2FinancialInputs({ plan, onChange }: Props) {
  // Pass-through income = K-1 / Schedule C income flowing from every business entity
  const passThrough = computePassThroughIncome(plan);
  const computedAgi = computeAutoAgi(plan);
  const displayAgi = plan.agi || computedAgi;
  const computedMarginalRate = computeMarginalRate(displayAgi, plan.filingStatus);
  const combinedRate = plan.federalMarginalRate + plan.ilRate;

  const { saltRaw, saltCapped, totalItemized, medicalDeductible } = computeAutoItemized(plan);
  const stdDeduction = getStandardDeduction(plan.filingStatus, plan.ownerAge, plan.spouseAge);
  const itemizedBetter = totalItemized > stdDeduction;
  const itemizedDiff = Math.abs(totalItemized - stdDeduction);

  const autoIlTax = displayAgi * plan.ilRate;

  // Helper: recompute AGI from a partial plan snapshot and propagate
  function recomputeAgi(partial: Partial<TaxSavingsPlan>) {
    const merged = { ...plan, ...partial };
    const newAgi = computeAutoAgi(merged);
    return {
      ...partial,
      agi: newAgi,
      federalMarginalRate: plan.federalRateOverridden
        ? plan.federalMarginalRate
        : computeMarginalRate(newAgi, merged.filingStatus),
    };
  }

  function handleAgiChange(v: number) {
    onChange({ agi: v, federalMarginalRate: plan.federalRateOverridden ? plan.federalMarginalRate : computeMarginalRate(v, plan.filingStatus) });
  }

  function updateEntity(id: string, updates: Partial<TaxPlanEntity>) {
    const newEntities = plan.entities.map(e => e.id === id ? { ...e, ...updates } : e);
    // When entity net business income or ownership changes, recompute plan-level AGI
    const agiUpdates = recomputeAgi({ entities: newEntities });
    onChange({ ...agiUpdates, entities: newEntities });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Income & Financial Inputs</h2>
        <p className="text-sm text-slate-500">Enter business and personal income figures used to compute estimated tax savings.</p>
      </div>

      {/* Entity-level financials */}
      {plan.entities.filter(e => e.entityType !== 'individual').length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">Business / Entity Level</h3>
          <div className="space-y-4">
            {plan.entities.filter(e => e.entityType !== 'individual').map(entity => (
              <EntityFinancialsCard key={entity.id} entity={entity} onChange={u => updateEntity(entity.id, u)} />
            ))}
          </div>
        </div>
      )}

      {/* Personal / 1040 */}
      <div>
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">Personal / 1040 Level</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput label="Gross W-2 Income (all sources, incl. entity W-2s)" value={plan.grossW2Income}
            onChange={v => onChange(recomputeAgi({ grossW2Income: v }))} />
          <CurrencyInput label="Other Ordinary Income (interest, rental, etc.)" value={plan.otherIncome}
            onChange={v => onChange(recomputeAgi({ otherIncome: v }))} />
          {plan.filingStatus === 'mfj' && (
            <CurrencyInput label="Spouse Income" value={plan.spouseIncome}
              onChange={v => onChange(recomputeAgi({ spouseIncome: v }))} />
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Estimated AGI</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={plan.agi || ''} placeholder={String(Math.round(computedAgi))}
                onChange={e => handleAgiChange(Number(e.target.value))}
                className="w-full rounded-lg border border-amber-200 bg-amber-50 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Auto-calculated including K-1 / Schedule C pass-through. Override if needed.</p>
          </div>
          <CurrencyInput label="Liquid Assets Available to Invest (optional)" value={plan.liquidAssets}
            onChange={v => onChange({ liquidAssets: v })}
            helpText="Used for QOZ, Cash Balance, and DAF strategy estimates." />
        </div>

        {/* AGI composition breakdown */}
        {passThrough > 0 && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
            <p className="font-semibold text-blue-800 mb-2">AGI Composition</p>
            <div className="space-y-1 text-blue-700">
              <div className="flex justify-between">
                <span>W-2 wages (all sources)</span>
                <span>{formatCurrency(plan.grossW2Income)}</span>
              </div>
              {plan.filingStatus === 'mfj' && plan.spouseIncome > 0 && (
                <div className="flex justify-between">
                  <span>Spouse income</span>
                  <span>{formatCurrency(plan.spouseIncome)}</span>
                </div>
              )}
              {plan.otherIncome > 0 && (
                <div className="flex justify-between">
                  <span>Other ordinary income</span>
                  <span>{formatCurrency(plan.otherIncome)}</span>
                </div>
              )}
              {plan.entities.filter(e => e.entityType !== 'individual' && e.netBusinessIncome > 0).map(e => (
                <div key={e.id} className="flex justify-between">
                  <span>{e.entityLabel} pass-through ({e.ownershipPct}% K-1 / Sch. C)</span>
                  <span>{formatCurrency(e.netBusinessIncome * e.ownershipPct / 100)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-blue-300 pt-1 mt-1">
                <span>Estimated AGI</span>
                <span>{formatCurrency(displayAgi)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Itemized Deductions */}
      <div>
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">Itemized Deductions Detail</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput label="Mortgage Interest — Primary Residence" value={plan.mortgageInterestPrimary} onChange={v => onChange({ mortgageInterestPrimary: v })} />
          <CurrencyInput label="Mortgage Interest — Second Home" value={plan.mortgageInterestSecond} onChange={v => onChange({ mortgageInterestSecond: v })} />
          <CurrencyInput label="Charitable Contributions — Cash" value={plan.charitableCash} onChange={v => onChange({ charitableCash: v })} />
          <CurrencyInput label="Charitable Contributions — Non-Cash" value={plan.charitableNonCash} onChange={v => onChange({ charitableNonCash: v })} helpText="Fair market value of donated property, clothing, vehicles, etc." />
          <CurrencyInput label="Property Taxes (real estate)" value={plan.propertyTaxes}
            onChange={v => {
              const newStateIl = plan.stateIncomeTaxOverridden ? plan.stateIncomeTaxesPaid : autoIlTax;
              onChange({ propertyTaxes: v, stateIncomeTaxesPaid: newStateIl });
            }} />
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Estimated IL Income Tax (state taxes paid)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number"
                value={plan.stateIncomeTaxOverridden ? plan.stateIncomeTaxesPaid || '' : ''}
                placeholder={`Auto: $${Math.round(autoIlTax).toLocaleString()} (AGI × 4.95%)`}
                onChange={e => onChange({ stateIncomeTaxesPaid: Number(e.target.value), stateIncomeTaxOverridden: true })}
                onBlur={e => { if (!e.target.value) onChange({ stateIncomeTaxOverridden: false, stateIncomeTaxesPaid: autoIlTax }); }}
                className="w-full rounded-lg border border-amber-200 bg-amber-50 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Auto-populated at AGI × 4.95% (IL rate). Override if needed.</p>
          </div>
          <CurrencyInput label="Vehicle Registration / Personal Property Tax" value={plan.vehicleRegistrationTax}
            onChange={v => onChange({ vehicleRegistrationTax: v })} greyed
            tooltipNote="Personal property taxes on vehicles are no longer deductible under TCJA. Included for reference only." />
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Medical Expenses</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={plan.medicalExpenses || ''}
                onChange={e => onChange({ medicalExpenses: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Only the portion exceeding 7.5% of AGI (${Math.round(displayAgi * 0.075).toLocaleString()}) is deductible. Deductible amount: ${Math.round(medicalDeductible).toLocaleString()}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Other Itemized Deductions</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={plan.otherItemizedDeductions || ''}
                onChange={e => onChange({ otherItemizedDeductions: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <input type="text" value={plan.otherItemizedDescription} placeholder="Description (optional)"
              onChange={e => onChange({ otherItemizedDescription: e.target.value })}
              className="w-full mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>

        {/* SALT summary + comparison */}
        <div className="mt-4 space-y-2">
          {saltRaw > SALT_CAP_2025 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-700 font-medium">
              ⚠ SALT capped at $40,000 for 2025. Your total state/local taxes of ${saltRaw.toLocaleString()} exceed the cap by ${(saltRaw - SALT_CAP_2025).toLocaleString()}.
            </div>
          )}
          <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${itemizedBetter ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
            <div>
              <strong>Total Itemized: ${Math.round(totalItemized).toLocaleString()}</strong>
              {' '}vs Standard Deduction: ${stdDeduction.toLocaleString()}
            </div>
            <div className="text-right font-semibold">
              {itemizedBetter
                ? `✓ Itemizing saves $${Math.round(itemizedDiff).toLocaleString()} more`
                : `Standard is $${Math.round(itemizedDiff).toLocaleString()} better${itemizedDiff > 5000 ? ' — consider DAF bunching (Strategy 12)' : ''}`}
            </div>
          </div>
        </div>
      </div>

      {/* Tax Rates */}
      <div>
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">Tax Rates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Federal Marginal Rate</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-slate-50 text-slate-500 text-center">
                Computed: {formatPercent(computedMarginalRate)}
              </div>
              <input type="number" step="0.01" min={0} max={0.37}
                value={plan.federalRateOverridden ? plan.federalMarginalRate : ''}
                placeholder="Override"
                onChange={e => onChange({ federalMarginalRate: Number(e.target.value), federalRateOverridden: true })}
                onBlur={e => { if (!e.target.value) onChange({ federalRateOverridden: false, federalMarginalRate: computedMarginalRate }); }}
                className="flex-1 rounded-lg border border-amber-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Leave override blank to use computed rate.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Illinois Income Tax Rate</label>
            <div className="relative">
              <input type="number" step="0.001" value={plan.ilRate}
                onChange={e => onChange({ ilRate: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 pr-7 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">dec</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Combined Effective Rate</label>
            <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-amber-50 text-amber-800 font-bold text-center text-xl">
              {formatPercent(combinedRate)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Federal + IL (read-only)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
