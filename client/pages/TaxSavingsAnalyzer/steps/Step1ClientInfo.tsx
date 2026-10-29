import { useState } from 'react';
import { TaxSavingsPlan, TaxPlanEntity, EntityType, FilingStatus, ENTITY_LABELS, FILING_STATUS_LABELS, createDefaultEntity, ENTITY_COLORS } from '../types/plan';

const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'];

const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  scorp: 'bg-green-100 text-green-800 border-green-200',
  partnership: 'bg-blue-100 text-blue-700 border-blue-200',
  soleProp: 'bg-orange-100 text-orange-700 border-orange-200',
  individual: 'bg-slate-100 text-slate-700 border-slate-200',
};

interface Props {
  plan: TaxSavingsPlan;
  onChange: (updates: Partial<TaxSavingsPlan>) => void;
}

function CurrencyInput({ label, value, onChange, helpText }: { label: string; value: number; onChange: (v: number) => void; helpText?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input type="number" value={value || ''} onChange={e => onChange(Number(e.target.value))} placeholder="0" min={0}
          className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      {helpText && <p className="text-xs text-slate-400 mt-1">{helpText}</p>}
    </div>
  );
}

function EntityCard({ entity, index, canRemove, onChange, onRemove }: {
  entity: TaxPlanEntity; index: number; canRemove: boolean;
  onChange: (updates: Partial<TaxPlanEntity>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border-2 p-5 transition-all" style={{ borderColor: entity.color }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entity.color }} />
          <span className="text-sm font-bold text-slate-700">Entity {index + 1}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ENTITY_TYPE_COLORS[entity.entityType]}`}>
            {ENTITY_LABELS[entity.entityType]}
          </span>
        </div>
        <button onClick={onRemove} disabled={!canRemove}
          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed font-medium">
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Entity / Business Name <span className="text-red-500">*</span></label>
          <input type="text" value={entity.entityLabel}
            onChange={e => onChange({ entityLabel: e.target.value })}
            placeholder={entity.entityType === 'individual' ? 'e.g., John Smith' : 'e.g., Smith Consulting LLC'}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Entity Type</label>
          <select value={entity.entityType}
            onChange={e => onChange({ entityType: e.target.value as EntityType })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
            {(Object.keys(ENTITY_LABELS) as EntityType[]).map(k => (
              <option key={k} value={k}>{ENTITY_LABELS[k]}</option>
            ))}
          </select>
        </div>

        {entity.entityType !== 'individual' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Owner Ownership Percentage</label>
              <div className="relative">
                <input type="number" value={entity.ownershipPct || ''} min={1} max={100}
                  onChange={e => onChange({ ownershipPct: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 pr-7 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>

            <CurrencyInput label="Owner W-2 Wages from This Entity" value={entity.ownerW2}
              onChange={v => onChange({ ownerW2: v })}
              helpText="Used for retirement plan limits and reasonable comp analysis." />

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">EIN (optional)</label>
              <input type="text" value={entity.ein || ''} onChange={e => onChange({ ein: e.target.value })}
                placeholder="XX-XXXXXXX"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Step1ClientInfo({ plan, onChange }: Props) {
  function updateEntity(id: string, updates: Partial<TaxPlanEntity>) {
    onChange({
      entities: plan.entities.map(e => e.id === id ? { ...e, ...updates } : e),
    });
  }

  function addEntity() {
    const newColor = ENTITY_COLORS[plan.entities.length % ENTITY_COLORS.length];
    onChange({
      entities: [...plan.entities, createDefaultEntity({ entityType: 'scorp', entityLabel: '', color: newColor })],
    });
  }

  function removeEntity(id: string) {
    if (plan.entities.length <= 1) return;
    onChange({ entities: plan.entities.filter(e => e.id !== id) });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Client & Entity Information</h2>
        <p className="text-sm text-slate-500">Enter the taxpayer's personal information and add all business entities involved in this tax plan.</p>
      </div>

      {/* Section A: Primary Taxpayer */}
      <div>
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] flex items-center justify-center font-bold">A</span>
          Primary Taxpayer
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
            <input type="text" value={plan.taxpayerFirstName}
              onChange={e => {
                const fn = e.target.value;
                onChange({ taxpayerFirstName: fn });
              }}
              placeholder="John"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last Name <span className="text-red-500">*</span></label>
            <input type="text" value={plan.taxpayerLastName}
              onChange={e => onChange({ taxpayerLastName: e.target.value })}
              placeholder="Smith"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Filing Status</label>
            <select value={plan.filingStatus} onChange={e => onChange({ filingStatus: e.target.value as FilingStatus })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              {(Object.keys(FILING_STATUS_LABELS) as FilingStatus[]).map(k => (
                <option key={k} value={k}>{FILING_STATUS_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tax Year</label>
            <select value={plan.taxYear} onChange={e => onChange({ taxYear: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">State</label>
            <select value={plan.state} onChange={e => onChange({ state: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Taxpayer Age</label>
            <input type="number" value={plan.ownerAge || ''} onChange={e => onChange({ ownerAge: Number(e.target.value) })}
              placeholder="45" min={18} max={100}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <p className="text-xs text-slate-400 mt-1">Used for retirement catch-up and Cash Balance Plan limits.</p>
          </div>

          {/* MFJ fields */}
          {plan.filingStatus === 'mfj' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Spouse First Name</label>
                <input type="text" value={plan.spouseFirstName}
                  onChange={e => onChange({ spouseFirstName: e.target.value })}
                  placeholder="Jane"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Spouse Last Name</label>
                <input type="text" value={plan.spouseLastName}
                  onChange={e => onChange({ spouseLastName: e.target.value })}
                  placeholder="Smith"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Spouse Age</label>
                <input type="number" value={plan.spouseAge || ''} onChange={e => onChange({ spouseAge: Number(e.target.value) })}
                  placeholder="43" min={18} max={100}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Number of Dependents</label>
            <input type="number" value={plan.numberOfDependents} min={0}
              onChange={e => onChange({ numberOfDependents: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <p className="text-xs text-slate-400 mt-1">Used for Child Tax Credit pre-fill.</p>
          </div>
        </div>
      </div>

      {/* Section B: Business Entities */}
      <div>
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] flex items-center justify-center font-bold">B</span>
          Business Entities
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Add each business entity involved in this tax plan. The <strong>Individual (1040)</strong> entity type is used for personal-level strategies.
          Every plan must have at least one entity.
        </p>
        <div className="space-y-4">
          {plan.entities.map((entity, idx) => (
            <EntityCard key={entity.id} entity={entity} index={idx}
              canRemove={plan.entities.length > 1}
              onChange={updates => updateEntity(entity.id, updates)}
              onRemove={() => removeEntity(entity.id)} />
          ))}
        </div>
        <button onClick={addEntity}
          className="mt-4 w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-amber-400 py-3 text-sm font-semibold text-slate-500 hover:text-amber-600 transition-colors">
          + Add Another Entity
        </button>
      </div>
    </div>
  );
}
