import { useRef, useState, type ChangeEvent } from 'react';
import { useLocation } from 'wouter';
import {
  loadPlans, deletePlan, upsertPlan, TaxSavingsPlan, ENTITY_SHORT_LABELS,
  FILING_STATUS_LABELS, ENTITY_COLORS, createEmptyPlan, getFullName,
} from './types/plan';
import { formatCurrency } from './utils/taxCalculations';
import { exportPlanToPdf } from './utils/pdfExport';
import { readBrowserBackup, replaceBrowserBackup, validateBackup } from './utils/backup';

export default function TaxSavingsAnalyzerIndex() {
  const [, navigate] = useLocation();
  const [plans, setPlans] = useState<TaxSavingsPlan[]>(loadPlans);
  const [exporting, setExporting] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState('');
  const backupInput = useRef<HTMLInputElement>(null);
  const base = "/".replace(/\/$/, '');

  function refresh() { setPlans(loadPlans()); }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this plan? This cannot be undone.')) return;
    deletePlan(id);
    refresh();
  }

  function handleDuplicate(plan: TaxSavingsPlan) {
    const copy: TaxSavingsPlan = {
      ...createEmptyPlan(),
      ...plan,
      id: crypto.randomUUID(),
      planName: (plan.planName || 'Unnamed Plan') + ' - Copy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entities: plan.entities.map(e => ({ ...e, id: crypto.randomUUID() })),
    };
    upsertPlan(copy);
    refresh();
  }

  async function handleExport(plan: TaxSavingsPlan) {
    setExporting(plan.id);
    try { await exportPlanToPdf(plan); } finally { setExporting(null); }
  }

  function handleExportCSV() {
    const rows = [
      ['Plan Name', 'Client Name', 'Tax Year', 'Entity Types', 'Est. Year 1 Savings', 'Effective Rate Before', 'Effective Rate After', 'Date Created', 'Last Modified'],
      ...plans.map(p => [
        p.planName || 'Unnamed',
        getFullName(p),
        String(p.taxYear),
        p.entities.map(e => ENTITY_SHORT_LABELS[e.entityType]).join(' / '),
        formatCurrency(p.totalYear1Savings),
        p.effectiveRateBefore > 0 ? (p.effectiveRateBefore * 100).toFixed(1) + '%' : '—',
        p.effectiveRateAfter > 0 ? (p.effectiveRateAfter * 100).toFixed(1) + '%' : '—',
        new Date(p.createdAt).toLocaleDateString(),
        new Date(p.updatedAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaxSavingsPlans_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadBackup() {
    try {
      const backup = readBrowserBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `TaxSavingsAnalyzer_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupMessage('Backup downloaded. Keep this file private: it contains client and financial data.');
    } catch (error) {
      setBackupMessage(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleRestoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const backup = validateBackup(JSON.parse(await file.text()));
      // Replacement (not merging) is deliberate: avoid ID conflicts and hidden data loss.
      if (!window.confirm(
        `Replace ALL existing saved plans and the unsaved draft in this browser with ${backup.plans.length} plan(s)${backup.draft ? ' and a draft' : ' and no draft'} from this backup?\n\n`
        + 'This permanently replaces the local Tax Savings Analyzer plans and draft in this browser. '
        + 'Download a backup of the current data first if you need to keep it.'
      )) {
        setBackupMessage('Restore cancelled; local data was not changed.');
        return;
      }
      replaceBrowserBackup(backup);
      refresh();
      setBackupMessage(`Restore complete: ${backup.plans.length} plan(s)${backup.draft ? ' and a draft' : ''} restored.`);
    } catch (error) {
      setBackupMessage(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tax Savings Analyzer</h1>
          <p className="text-sm text-slate-500 mt-1">Build, save, and export professional tax savings analysis reports for your clients.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadBackup}
            className="text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-4 py-2.5 rounded-xl font-medium transition-colors">
            Download Backup
          </button>
          <button onClick={() => backupInput.current?.click()}
            className="text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-4 py-2.5 rounded-xl font-medium transition-colors">
            Restore Backup
          </button>
          <input ref={backupInput} type="file" accept=".json,application/json" className="hidden"
            aria-label="Select Tax Savings Analyzer backup JSON" onChange={handleRestoreBackup} />
          {plans.length > 0 && (
            <button onClick={handleExportCSV}
              className="text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-4 py-2.5 rounded-xl font-medium transition-colors">
              Export CSV
            </button>
          )}
          <button onClick={() => navigate(`${base}/tax-savings-analyzer/new`)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2">
            <span className="text-lg leading-none">+</span> New Plan
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500">Backups include saved plans and any unsaved draft. JSON files contain sensitive client data; store them securely. Restoring replaces both on this browser.</p>
      {backupMessage && <p role="status" className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{backupMessage}</p>}

      {plans.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-lg font-bold text-slate-700 mb-2">No plans yet</h2>
          <p className="text-sm text-slate-400 mb-6 max-w-sm">Create your first client tax savings plan to get started. Plans are saved locally and persist across sessions.</p>
          <button onClick={() => navigate(`${base}/tax-savings-analyzer/new`)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
            + Create First Plan
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left px-5 py-3.5 font-semibold">Plan Name</th>
                  <th className="text-left px-4 py-3.5 font-semibold">Client</th>
                  <th className="text-left px-4 py-3.5 font-semibold">Entities</th>
                  <th className="text-center px-4 py-3.5 font-semibold">Year</th>
                  <th className="text-right px-4 py-3.5 font-semibold">Est. Savings</th>
                  <th className="text-right px-4 py-3.5 font-semibold">Last Modified</th>
                  <th className="text-center px-4 py-3.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan, i) => {
                  const totalSavings = plan.entities.reduce((sum, e) =>
                    sum + e.selectedStrategies.reduce((s, x) => s + x.estimatedSavings, 0)
                       + e.customStrategies.reduce((s, c) => s + c.estimatedSavings, 0), 0);
                  return (
                    <tr key={plan.id} className={`border-b border-slate-100 transition-colors hover:bg-amber-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800">{plan.planName || '(Unnamed Plan)'}</div>
                        {plan.advisorNotes && <div className="text-xs text-slate-400 truncate max-w-[200px]">{plan.advisorNotes}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{getFullName(plan) || '—'}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {plan.entities.map((e, ei) => (
                            <span key={e.id}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: e.color ?? ENTITY_COLORS[ei % ENTITY_COLORS.length] }}>
                              {ENTITY_SHORT_LABELS[e.entityType]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-600">{plan.taxYear}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-green-700">
                        {totalSavings > 0 ? formatCurrency(totalSavings) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-400 text-xs">
                        {new Date(plan.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button onClick={() => navigate(`${base}/tax-savings-analyzer/${plan.id}`)}
                            className="text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                            Edit
                          </button>
                          <button onClick={() => handleDuplicate(plan)}
                            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-100 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                            Copy
                          </button>
                          <button onClick={() => handleExport(plan)} disabled={exporting === plan.id}
                            className="text-xs text-amber-700 hover:text-amber-900 border border-amber-200 hover:border-amber-400 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                            {exporting === plan.id ? '...' : 'PDF'}
                          </button>
                          <button onClick={() => handleDelete(plan.id)}
                            className="text-xs text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>{plans.length} plan{plans.length !== 1 ? 's' : ''} saved &mdash; stored locally in your browser</span>
            <span>Use "Export CSV" to download a summary spreadsheet</span>
          </div>
        </div>
      )}
    </div>
  );
}
