import { useState } from 'react';
import { TaxSavingsPlan, TaxPlanEntity, EntityType, SelectedStrategy, CustomStrategy, ENTITY_LABELS } from '../types/plan';
import { STRATEGIES, StrategyDefinition, PERSONAL_STRATEGY_IDS, PlanComputeData } from '../utils/strategyDefinitions';
import { formatCurrency, getRetirementLimits } from '../utils/taxCalculations';

const ALL_ENTITY_TYPES: EntityType[] = ['scorp', 'partnership', 'soleProp', 'individual'];

const ENTITY_BADGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  scorp:       { label: 'S Corp',          bg: 'bg-green-100',  text: 'text-green-700'  },
  partnership: { label: 'Partnership',     bg: 'bg-blue-100',   text: 'text-blue-700'   },
  soleProp:    { label: 'Schedule C',      bg: 'bg-orange-100', text: 'text-orange-700' },
  individual:  { label: 'Individual/1040', bg: 'bg-purple-100', text: 'text-purple-700' },
};

function EligibilityBadges({ eligibleEntities }: { eligibleEntities: EntityType[] }) {
  const isAll = ALL_ENTITY_TYPES.every(t => eligibleEntities.includes(t));
  if (isAll) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium whitespace-nowrap">All Entities</span>;
  }
  return (
    <>
      {eligibleEntities.map(et => {
        const cfg = ENTITY_BADGE_CONFIG[et];
        if (!cfg) return null;
        return (
          <span key={et} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
          </span>
        );
      })}
    </>
  );
}

interface Props {
  plan: TaxSavingsPlan;
  onChange: (updates: Partial<TaxSavingsPlan>) => void;
}

function buildPlanData(plan: TaxSavingsPlan, entity: TaxPlanEntity): PlanComputeData {
  return {
    federalMarginalRate: plan.federalMarginalRate,
    ilRate: plan.ilRate,
    agi: plan.agi,
    ownerAge: plan.ownerAge,
    ownerW2: entity.ownerW2,
    netBusinessIncome: entity.netBusinessIncome,
    ownershipPct: entity.ownershipPct,
    filingStatus: plan.filingStatus,
    entityType: entity.entityType,
    state: plan.state,
    grossRevenue: entity.grossRevenue,
    mortgageInterestPrimary: plan.mortgageInterestPrimary,
    mortgageInterestSecond: plan.mortgageInterestSecond,
    charitableCash: plan.charitableCash,
    charitableNonCash: plan.charitableNonCash,
    propertyTaxes: plan.propertyTaxes,
    stateIncomeTaxesPaid: plan.stateIncomeTaxesPaid || plan.agi * plan.ilRate,
    otherItemizedDeductions: plan.otherItemizedDeductions,
    medicalExpenses: plan.medicalExpenses,
    grossW2Income: plan.grossW2Income,
    liquidAssets: plan.liquidAssets,
    spouseIncome: plan.spouseIncome,
    numberOfDependents: plan.numberOfDependents,
    spouseAge: plan.spouseAge,
  };
}

function getStrategiesForEntity(entity: TaxPlanEntity): StrategyDefinition[] {
  const isPersonal = entity.entityType === 'individual';
  return STRATEGIES.filter(s => {
    if (!s.eligibleEntities.includes(entity.entityType)) return false;
    if (isPersonal) return PERSONAL_STRATEGY_IDS.has(s.id) || entity.entityType === 'individual';
    return !PERSONAL_STRATEGY_IDS.has(s.id);
  });
}

function StrategyCard({ strategy, entity, plan, planData, selected, onToggle, onInputChange, savedInputs }: {
  strategy: StrategyDefinition; entity: TaxPlanEntity; plan: TaxSavingsPlan; planData: PlanComputeData;
  selected: boolean; onToggle: () => void;
  onInputChange: (key: string, value: number | string | boolean) => void;
  savedInputs: Record<string, number | string | boolean>;
}) {
  const [expanded, setExpanded] = useState(false);

  const inputs: Record<string, number | string | boolean> = {};
  strategy.inputFields.forEach(f => { inputs[f.key] = savedInputs[f.key] ?? f.defaultValue ?? 0; });

  const estimatedSavings = strategy.compute(inputs, planData);
  const isEligible = strategy.eligibleEntities.includes(entity.entityType);

  // Retirement plan: show limits hint
  let retirementHint = '';
  if (strategy.id === 'retirement-plan') {
    const planType = String(inputs.planType || 'solo401k');
    const limits = getRetirementLimits(planType, plan.ownerAge);
    retirementHint = limits.description;
    if (limits.isSuperCatchUp) retirementHint += ' ⭐ SECURE 2.0 Super Catch-Up applies.';
  }

  // OBBBA toggle hint for sec179
  const showOBBBAAlert = strategy.id === 'sec179-bonus';
  const usingOBBBA = Boolean(inputs.useOBBBA);
  const obbbaAmount = showOBBBAAlert && usingOBBBA
    ? (() => {
        const altInputs = { ...inputs, useOBBBA: true };
        return strategy.compute(altInputs, planData);
      })()
    : null;

  return (
    <div className={`rounded-xl border transition-all ${selected && isEligible ? 'shadow-sm' : ''} ${isEligible ? 'bg-white' : 'bg-slate-50 opacity-60'}`}
      style={{ borderColor: selected && isEligible ? entity.color : '#e2e8f0' }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={selected && isEligible} disabled={!isEligible}
            onChange={onToggle} className="mt-1 h-4 w-4 rounded border-slate-300 cursor-pointer" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <span className="font-semibold text-slate-800 text-sm">{strategy.name}</span>
              <EligibilityBadges eligibleEntities={strategy.eligibleEntities} />
              {!isEligible && <span className="text-[10px] text-slate-400 italic">Not applicable for {ENTITY_LABELS[entity.entityType]}</span>}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{strategy.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {isEligible && (
              <span className={`text-sm font-bold ${estimatedSavings > 0 ? 'text-green-700' : 'text-slate-400'}`}>
                {estimatedSavings > 0 ? `+${formatCurrency(estimatedSavings)}` : '$0'}
              </span>
            )}
            {strategy.inputFields.length > 0 && isEligible && (
              <button onClick={() => setExpanded(p => !p)}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium whitespace-nowrap">
                {expanded ? 'Hide ▲' : 'Edit inputs ▼'}
              </button>
            )}
          </div>
        </div>

        {/* OBBBA Alert */}
        {showOBBBAAlert && selected && isEligible && (
          <div className="mt-2 ml-7 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2.5 text-xs text-amber-800">
            <strong>⚠ Legislative Update:</strong> The One Big Beautiful Bill Act proposes restoring 100% bonus depreciation retroactively to assets placed in service after 1/19/2025. This tool currently uses 40% under existing law.
            {obbbaAmount && usingOBBBA && (
              <div className="mt-1 flex gap-4">
                <span>Current Law (40%): <strong>{formatCurrency(estimatedSavings)}</strong></span>
                <span className="text-green-700">If OBBBA Enacted (100%): <strong>{formatCurrency(obbbaAmount)}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Warning */}
        {strategy.warning && isEligible && selected && strategy.id !== 'sec179-bonus' && (
          <div className="mt-2 ml-7 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            ⚠ {strategy.warning}
          </div>
        )}

        {/* Expanded inputs */}
        {expanded && isEligible && (
          <div className="mt-3 ml-7 space-y-3 pt-3 border-t border-slate-100">
            {retirementHint && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                ℹ {retirementHint}
              </div>
            )}
            {strategy.inputFields.map(field => (
              <div key={field.key} className={field.greyed ? 'opacity-40 pointer-events-none' : ''}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{field.label}</label>
                {field.type === 'number' && (
                  <div className="relative max-w-xs">
                    <input type="number" value={Number(inputs[field.key]) || ''}
                      onChange={e => onInputChange(field.key, Number(e.target.value))}
                      placeholder={field.placeholder || String(field.defaultValue ?? 0)}
                      min={field.min} max={field.max}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                )}
                {field.type === 'text' && (
                  <input type="text" value={String(inputs[field.key] || '')}
                    onChange={e => onInputChange(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                )}
                {field.type === 'select' && (
                  <select value={String(inputs[field.key])} onChange={e => onInputChange(field.key, e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {field.type === 'checkbox' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={Boolean(inputs[field.key])}
                      onChange={e => onInputChange(field.key, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300" />
                    <span className="text-xs text-slate-600">Yes</span>
                  </label>
                )}
                {field.helpText && <p className="text-[11px] text-slate-400 mt-0.5">{field.helpText}</p>}
                {field.tooltipNote && <p className="text-[11px] text-amber-600 mt-0.5">⚠ {field.tooltipNote}</p>}
              </div>
            ))}
            {strategy.notes && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                ℹ {strategy.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomStrategySection({ entity, plan, onChange }: { entity: TaxPlanEntity; plan: TaxSavingsPlan; onChange: (updates: Partial<TaxSavingsPlan>) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', estimatedSavings: 0, isRecurring: true });

  function add() {
    if (!form.name || form.estimatedSavings <= 0) return;
    const updated = plan.entities.map(e => e.id === entity.id
      ? { ...e, customStrategies: [...e.customStrategies, { id: crypto.randomUUID(), ...form }] }
      : e);
    onChange({ entities: updated });
    setForm({ name: '', description: '', estimatedSavings: 0, isRecurring: true });
    setShowForm(false);
  }

  function remove(id: string) {
    const updated = plan.entities.map(e => e.id === entity.id
      ? { ...e, customStrategies: e.customStrategies.filter(c => c.id !== id) }
      : e);
    onChange({ entities: updated });
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Custom Strategies</h4>
        <button onClick={() => setShowForm(p => !p)}
          className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold">
          + Add Custom
        </button>
      </div>
      {entity.customStrategies.map(c => (
        <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-100">
          <div>
            <span className="text-sm font-semibold text-slate-700">{c.name}</span>
            {c.description && <p className="text-xs text-slate-400">{c.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-green-700 text-sm">{formatCurrency(c.estimatedSavings)}</span>
            <button onClick={() => remove(c.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        </div>
      ))}
      {showForm && (
        <div className="mt-3 space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Strategy Name *"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={2} placeholder="Description / Notes"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
              <input type="number" value={form.estimatedSavings || ''} onChange={e => setForm(p => ({ ...p, estimatedSavings: Number(e.target.value) }))}
                placeholder="Estimated Savings *"
                className="w-full rounded-lg border border-slate-200 pl-6 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <select value={form.isRecurring ? 'recurring' : 'onetime'}
              onChange={e => setForm(p => ({ ...p, isRecurring: e.target.value === 'recurring' }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="recurring">Recurring (annual)</option>
              <option value="onetime">One-time</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold">Add</button>
            <button onClick={() => setShowForm(false)} className="text-xs text-slate-500 px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
          </div>
          <p className="text-[11px] text-slate-400">Appears in PDF with note: "Advisor-estimated savings — custom strategy"</p>
        </div>
      )}
    </div>
  );
}

export default function Step3StrategySelection({ plan, onChange }: Props) {
  const [activeEntityId, setActiveEntityId] = useState(plan.entities[0]?.id || '');
  const activeEntity = plan.entities.find(e => e.id === activeEntityId) || plan.entities[0];

  const totalSavings = plan.entities.reduce((sum, e) =>
    sum + e.selectedStrategies.reduce((s, x) => s + x.estimatedSavings, 0)
       + e.customStrategies.reduce((s, c) => s + c.estimatedSavings, 0), 0);

  function isSelected(entity: TaxPlanEntity, strategyId: string) {
    return entity.selectedStrategies.some(s => s.strategyId === strategyId);
  }

  function toggleStrategy(entity: TaxPlanEntity, strategy: StrategyDefinition) {
    const planData = buildPlanData(plan, entity);
    const inputs: Record<string, number | string | boolean> = {};
    strategy.inputFields.forEach(f => { inputs[f.key] = f.defaultValue ?? 0; });

    const updated = plan.entities.map(e => {
      if (e.id !== entity.id) return e;
      if (e.selectedStrategies.some(s => s.strategyId === strategy.id)) {
        return { ...e, selectedStrategies: e.selectedStrategies.filter(s => s.strategyId !== strategy.id) };
      }
      const savings = strategy.compute(inputs, planData);
      const entry: SelectedStrategy = {
        strategyId: strategy.id, strategyName: strategy.name,
        isRecurring: strategy.isRecurring, inputs, estimatedSavings: savings, notes: strategy.notes,
      };
      return { ...e, selectedStrategies: [...e.selectedStrategies, entry] };
    });
    onChange({ entities: updated });
  }

  function updateStrategyInput(entity: TaxPlanEntity, strategyId: string, key: string, value: number | string | boolean) {
    const strategy = STRATEGIES.find(s => s.id === strategyId)!;
    const planData = buildPlanData(plan, entity);
    const existing = entity.selectedStrategies.find(s => s.strategyId === strategyId);
    const inputs = { ...(existing?.inputs || {}), [key]: value };
    strategy.inputFields.forEach(f => { if (!(f.key in inputs)) inputs[f.key] = f.defaultValue ?? 0; });
    const savings = strategy.compute(inputs, planData);

    const updated = plan.entities.map(e => {
      if (e.id !== entity.id) return e;
      if (existing) {
        return { ...e, selectedStrategies: e.selectedStrategies.map(s => s.strategyId === strategyId ? { ...s, inputs, estimatedSavings: savings } : s) };
      }
      const entry: SelectedStrategy = { strategyId: strategy.id, strategyName: strategy.name, isRecurring: strategy.isRecurring, inputs, estimatedSavings: savings, notes: strategy.notes };
      return { ...e, selectedStrategies: [...e.selectedStrategies, entry] };
    });
    onChange({ entities: updated });
  }

  const entityStrategies = getStrategiesForEntity(activeEntity);
  const entitySelectedCount = activeEntity.selectedStrategies.length + activeEntity.customStrategies.length;

  return (
    <div className="space-y-5">
      {/* Sticky savings banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Total Estimated Savings</div>
          <div className="text-3xl font-bold">{formatCurrency(totalSavings)}</div>
        </div>
        <div className="text-right text-sm text-slate-400">
          <div>{plan.entities.reduce((s, e) => s + e.selectedStrategies.length + e.customStrategies.length, 0)} strategies selected</div>
          <div>across {plan.entities.length} {plan.entities.length === 1 ? 'entity' : 'entities'}</div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Strategy Selection</h2>
        <p className="text-sm text-slate-500">Select applicable strategies for each entity. Strategies are scoped to match each entity type.</p>
      </div>

      {/* Entity tabs */}
      <div className="flex gap-2 flex-wrap">
        {plan.entities.map(e => {
          const count = e.selectedStrategies.length + e.customStrategies.length;
          return (
            <button key={e.id} onClick={() => setActiveEntityId(e.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all flex items-center gap-2 ${activeEntityId === e.id ? 'text-white' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
              style={activeEntityId === e.id ? { backgroundColor: e.color, borderColor: e.color } : {}}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeEntityId === e.id ? 'rgba(255,255,255,0.7)' : e.color }} />
              {e.entityLabel || ENTITY_LABELS[e.entityType]}
              {count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeEntityId === e.id ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Active entity strategies */}
      {activeEntity && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeEntity.color }} />
            <span className="text-sm font-bold text-slate-700">{activeEntity.entityLabel || ENTITY_LABELS[activeEntity.entityType]}</span>
            <span className="text-xs text-slate-400">— {ENTITY_LABELS[activeEntity.entityType]}</span>
            <span className="ml-auto text-xs text-slate-400">{entitySelectedCount} selected · {entityStrategies.length} available</span>
          </div>
          {entityStrategies.map(strategy => (
            <StrategyCard key={strategy.id}
              strategy={strategy} entity={activeEntity} plan={plan}
              planData={buildPlanData(plan, activeEntity)}
              selected={isSelected(activeEntity, strategy.id)}
              onToggle={() => toggleStrategy(activeEntity, strategy)}
              onInputChange={(key, val) => updateStrategyInput(activeEntity, strategy.id, key, val)}
              savedInputs={activeEntity.selectedStrategies.find(s => s.strategyId === strategy.id)?.inputs || {}} />
          ))}
          <CustomStrategySection entity={activeEntity} plan={plan} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
