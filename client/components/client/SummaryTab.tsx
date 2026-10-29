import React from "react";
import { TaxSummary, EstimatedPayment, EntityBreakdown } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, User, Landmark, HelpCircle, CheckCircle2, Clock, AlertTriangle, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";

interface SummaryTabProps {
  summary?: TaxSummary;
  payments?: EstimatedPayment[];
  isLoading: boolean;
}

export function SummaryTab({ summary, payments, isLoading }: SummaryTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-slate-100 animate-pulse rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-96 bg-slate-100 animate-pulse rounded-2xl"></div>)}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
        <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-600 mb-2">No data computed</h3>
        <p className="text-slate-400 max-w-sm mx-auto">Enter income sources on the Income tab and save to see the tax computation.</p>
      </div>
    );
  }

  const DataRow = ({ label, value, strong = false, highlight = false, tooltip = "" }: { label: string, value: number, strong?: boolean, highlight?: boolean, tooltip?: string }) => (
    <div className={`flex justify-between py-2 border-b border-slate-100 last:border-0 ${strong ? 'font-bold' : 'font-medium'} ${highlight ? 'text-primary text-lg pt-4' : 'text-slate-600 text-sm'}`}>
      <span className="flex items-center gap-1.5">
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger><HelpCircle className="w-3.5 h-3.5 text-slate-400" /></TooltipTrigger>
            <TooltipContent><p className="max-w-xs">{tooltip}</p></TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className="font-mono">{formatCurrency(value)}</span>
    </div>
  );

  // ── Payment table helpers ────────────────────────────────────────────────
  const DUE_DATE_LABELS: Record<number, string> = { 1: "Apr 15", 2: "Jun 15", 3: "Sep 15", 4: "Jan 15" };

  function StatusChip({ paid, overpaid, shortPaid, overdue, noDue }: { paid: boolean; overpaid: boolean; shortPaid: boolean; overdue: boolean; noDue: boolean }) {
    if (noDue) return <span className="text-slate-400 text-xs">—</span>;
    if (overpaid) return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
        <CheckCircle2 className="w-2.5 h-2.5" /> Overpaid
      </span>
    );
    if (paid) return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
        <CheckCircle2 className="w-2.5 h-2.5" /> Paid
      </span>
    );
    if (shortPaid) return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
        <AlertTriangle className="w-2.5 h-2.5" /> Short
      </span>
    );
    if (overdue) return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
        <Clock className="w-2.5 h-2.5" /> Overdue
      </span>
    );
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-200">
        <Clock className="w-2.5 h-2.5" /> Pending
      </span>
    );
  }

  function buildQuarterRows(filteredPayments: EstimatedPayment[]) {
    return [1, 2, 3, 4].map(q => {
      const qPmts = filteredPayments.filter(p => p.quarter === q);
      const totalDue = qPmts.reduce((s, p) => s + (p.amountDue || 0), 0);
      const totalPaid = qPmts.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
      const netRemaining = totalDue - totalPaid; // negative = overpaid
      const dueDate = qPmts[0]?.dueDate ?? null;
      const overpaid = totalDue > 0 && netRemaining < 0;
      const allPaid = totalDue > 0 && totalPaid >= totalDue * 0.99;
      const shortPaid = !allPaid && !overpaid && totalPaid > 0;
      const isPastDue = dueDate ? new Date(dueDate + "T00:00:00") < new Date() : false;
      const overdue = !allPaid && !shortPaid && !overpaid && isPastDue && totalDue > 0;
      const confNums = [...new Set(qPmts.map(p => p.confirmationNumber).filter(Boolean))];
      return { q, totalDue, totalPaid, netRemaining, overpaid, allPaid, shortPaid, overdue, confNums };
    });
  }

  function PaymentTable({
    title, color, icon, rows, alwaysShow = false,
  }: {
    title: string; color: string; icon: React.ReactNode;
    rows: ReturnType<typeof buildQuarterRows>;
    alwaysShow?: boolean;
  }) {
    const annualDue = rows.reduce((s, r) => s + r.totalDue, 0);
    const annualPaid = rows.reduce((s, r) => s + r.totalPaid, 0);
    const netAnnual = annualDue - annualPaid; // negative = overpaid total
    if (annualDue === 0 && !alwaysShow) return null;

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className={`px-4 py-2.5 flex items-center justify-between ${color}`}>
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-bold text-sm">{title}</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-500">Annual due: <span className="font-bold text-slate-700">{formatCurrency(annualDue)}</span></span>
            <span className="text-slate-500">Paid: <span className="font-bold text-emerald-700">{formatCurrency(annualPaid)}</span></span>
            <span className={`font-bold ${netAnnual <= 0 ? "text-emerald-600" : "text-slate-800"}`}>
              {netAnnual <= 0 ? `Overpaid: (${formatCurrency(Math.abs(netAnnual))})` : `Remaining: ${formatCurrency(netAnnual)}`}
            </span>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-16">Qtr</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Due Date</th>
              <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount Due</th>
              <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Paid</th>
              <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Remaining</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Conf #</th>
              <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.q} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-2.5 font-bold text-slate-800">Q{row.q}</td>
                <td className="px-3 py-2.5 text-slate-600">{DUE_DATE_LABELS[row.q]}</td>
                <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-700">
                  {row.totalDue > 0 ? formatCurrency(row.totalDue) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {row.totalPaid > 0 ? <span className="text-emerald-600 font-medium">{formatCurrency(row.totalPaid)}</span> : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold">
                  {row.totalDue <= 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : row.overpaid ? (
                    <span className="text-emerald-600">({formatCurrency(Math.abs(row.netRemaining))})</span>
                  ) : row.netRemaining === 0 ? (
                    <span className="text-emerald-600">{formatCurrency(0)}</span>
                  ) : (
                    <span className="text-slate-800">{formatCurrency(row.netRemaining)}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-600 font-mono max-w-[140px] truncate">
                  {row.confNums.length > 0 ? row.confNums.join(", ") : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <StatusChip paid={row.allPaid} overpaid={row.overpaid} shortPaid={row.shortPaid} overdue={row.overdue} noDue={row.totalDue <= 0} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td colSpan={2} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{formatCurrency(annualDue)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">{formatCurrency(annualPaid)}</td>
              <td className={`px-3 py-2 text-right font-mono font-bold ${netAnnual <= 0 ? "text-emerald-600" : "text-slate-800"}`}>
                {netAnnual < 0 ? `(${formatCurrency(Math.abs(netAnnual))})` : formatCurrency(netAnnual)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // ── Build sectioned payment data ─────────────────────────────────────────
  const federalPayments = (payments ?? []).filter(p => p.paymentType === "federal_individual");
  const ilIndividualPayments = (payments ?? []).filter(p => p.paymentType === "state_individual");

  const businessPayments = (payments ?? []).filter(
    p => p.paymentType === "state_business_pte" || p.paymentType === "state_business_replacement"
  );

  // Group business payments by entity
  const entityNames = [...new Set(businessPayments.map(p => p.entityName ?? ""))].filter(Boolean);
  // If all business payments have null entityName (legacy), treat as one "business" group
  const legacyBusiness = businessPayments.filter(p => !p.entityName);

  // ── Totals ───────────────────────────────────────────────────────────────
  const federalEstPaid = federalPayments.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
  const ilIndividualEstPaid = ilIndividualPayments.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
  const businessEstPaid = businessPayments.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);

  const federalWithheld = summary.federalWithheld;
  const ilWithheld = summary.stateWithheld;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Level Overview */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-xl overflow-hidden relative">
        <div className="absolute right-0 top-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <CardContent className="p-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Total Gross Income</p>
              <p className="text-3xl font-display font-bold">{formatCurrency(summary.totalGrossIncome)}</p>
            </div>
            <div className="hidden md:block w-px h-12 bg-slate-700 mx-auto my-auto" />
            <div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1 flex items-center md:justify-start justify-center gap-2">
                PTE Election Status
              </p>
              {summary.pteElection ? (
                <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-emerald-500/50 mt-1">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-slate-300 border-slate-600 mt-1">Not Elected</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3 Tax Calculation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Federal Card */}
        <Card className="border-border/50 shadow-md bg-white flex flex-col">
          <div className="h-1.5 w-full bg-blue-600" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Landmark className="w-5 h-5 text-blue-600" /> Federal Return
            </CardTitle>
            <CardDescription>Estimated individual federal income tax</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="bg-slate-50 p-4 rounded-xl mb-4">
              <DataRow label="Federal AGI" value={summary.federalAgi} />
              <DataRow
                label={summary.federalDeductionIsItemized
                  ? "Less: Itemized Deductions"
                  : "Less: Standard Deduction"}
                value={summary.federalDeduction}
                tooltip={summary.federalDeductionIsItemized ? "Actual itemized deductions exceed the standard deduction" : "2025/2026 standard deduction for your filing status"}
              />
              {summary.federalQbiDeduction > 0 && (
                <DataRow label="Less: QBI Deduction (20%)" value={summary.federalQbiDeduction} tooltip="Section 199A deduction — 20% of qualified business income (S-Corp K-1 + Partnership K-1 + 1099-NEC)" />
              )}
              <DataRow label="Taxable Income" value={summary.federalTaxableIncome} tooltip="AGI minus standard/itemized deduction and QBI deduction" />
              <DataRow label="Estimated Liability" value={summary.federalTaxLiability} strong />
            </div>
            <div className="px-1">
              <DataRow label="Safe Harbor Target" value={summary.federalSafeHarbor} tooltip="Based on prior year tax" />
              <DataRow label="Required Annual Pmt" value={summary.federalRequiredAnnual} strong tooltip="Lesser of 90% current year or 100/110% prior year" />
              <DataRow label="Less: W-2 Withholding" value={summary.federalWithheld} />
              <DataRow label="Estimated Balance Due" value={summary.federalBalance} highlight />
            </div>
          </CardContent>
        </Card>

        {/* State Individual Card */}
        <Card className="border-border/50 shadow-md bg-white flex flex-col">
          <div className="h-1.5 w-full bg-indigo-600" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="w-5 h-5 text-indigo-600" /> Illinois Individual
            </CardTitle>
            <CardDescription>IL-1040 Personal Return</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="bg-slate-50 p-4 rounded-xl mb-4">
              <DataRow label="Illinois Base Income" value={summary.stateAgi} />
              <DataRow label="Taxable Income" value={summary.stateTaxableIncome} tooltip="Base income minus exemption" />
              <DataRow label="Estimated Liability" value={summary.stateIndividualTaxLiability} strong tooltip="4.95% flat rate" />
              {summary.pteElection && (
                <div className="mt-2 pt-2 border-t border-slate-200 border-dashed text-emerald-600 text-sm font-medium flex justify-between">
                  <span>Less: PTE Credit</span>
                  <span>-{formatCurrency(summary.stateBusinessPteTax)}</span>
                </div>
              )}
            </div>
            <div className="px-1">
              <DataRow label="Safe Harbor Target" value={summary.stateSafeHarbor} />
              <DataRow label="Required Annual Pmt" value={summary.stateRequiredAnnual} strong />
              <DataRow label="Less: W-2 Withholding" value={summary.stateWithheld} />
              <DataRow label="Estimated Balance Due" value={summary.stateBalance} highlight />
            </div>
          </CardContent>
        </Card>

        {/* IL Business Card — per entity or aggregate */}
        {summary.entityBreakdowns && summary.entityBreakdowns.length > 0 ? (
          summary.entityBreakdowns.length === 1 ? (
            <SingleEntityCard entity={summary.entityBreakdowns[0]} />
          ) : (
            <MultiEntityCard entities={summary.entityBreakdowns} />
          )
        ) : (
          <Card className={`border-border/50 shadow-md bg-white flex flex-col ${!summary.scorpPassthroughIncome ? 'opacity-60' : ''}`}>
            <div className={`h-1.5 w-full ${summary.pteElection ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className={`w-5 h-5 ${summary.pteElection ? 'text-emerald-600' : 'text-slate-400'}`} />
                Illinois Business
              </CardTitle>
              <CardDescription>S-Corp Entity Level Tax</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="bg-slate-50 p-4 rounded-xl mb-4">
                <DataRow label="Pass-through Income" value={summary.scorpPassthroughIncome} />
              </div>
              <div className="px-1">
                {summary.pteElection ? (
                  <>
                    <DataRow label="PTE Tax (4.95%)" value={summary.stateBusinessPteTax} strong />
                    <DataRow label="Replacement Tax (1.5%)" value={summary.stateBusinessReplacementTax} strong />
                    <DataRow label="Total Entity Due" value={summary.stateBusinessPteTax + summary.stateBusinessReplacementTax} highlight />
                  </>
                ) : (
                  <DataRow label="Replacement Tax Due (1.5%)" value={summary.stateBusinessReplacementTax} highlight />
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Quarterly Payment Progress Tables ────────────────────────────── */}
      {payments && payments.length > 0 && (
        <Card className="border-border/50 shadow-md bg-white overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-lg">Payment Progress</CardTitle>
            <CardDescription>Quarterly estimated payment status broken out by type</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">

            {/* Federal */}
            <PaymentTable
              title="Federal (1040-ES)"
              color="bg-blue-50 text-blue-900 border-b border-blue-100"
              icon={<Landmark className="w-4 h-4 text-blue-600" />}
              rows={buildQuarterRows(federalPayments)}
              alwaysShow
            />

            {/* IL Individual Personal */}
            <PaymentTable
              title="IL Individual Personal (IL-1040)"
              color="bg-indigo-50 text-indigo-900 border-b border-indigo-100"
              icon={<User className="w-4 h-4 text-indigo-600" />}
              rows={buildQuarterRows(ilIndividualPayments)}
              alwaysShow
            />

            {/* IL Business — per entity (named) */}
            {entityNames.map(name => {
              const entityPmts = businessPayments.filter(p => p.entityName === name);
              const hasPte = entityPmts.some(p => p.paymentType === "state_business_pte" && p.amountDue > 0);
              return (
                <PaymentTable
                  key={name}
                  title={`IL Business — ${name}${hasPte ? " (PTE 4.95% + Replacement 1.5%)" : " (Non-PTE - Replacement 1.5%)"}`}
                  color="bg-emerald-50 text-emerald-900 border-b border-emerald-100"
                  icon={<Building2 className="w-4 h-4 text-emerald-600" />}
                  rows={buildQuarterRows(entityPmts)}
                />
              );
            })}

            {/* Legacy: null-entity business records */}
            {entityNames.length === 0 && legacyBusiness.length > 0 && (
              <PaymentTable
                title={`IL Business${summary.pteElection ? " (PTE 4.95% + Replacement 1.5%)" : " (Replacement 1.5%)"}`}
                color="bg-emerald-50 text-emerald-900 border-b border-emerald-100"
                icon={<Building2 className="w-4 h-4 text-emerald-600" />}
                rows={buildQuarterRows(legacyBusiness)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Withholding & Payments Totals ────────────────────────────────── */}
      {payments && payments.length > 0 && (
        <Card className="border-border/50 shadow-md bg-white overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-slate-400 to-slate-600" />
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-slate-600" />
              <CardTitle className="text-lg">Total Tax Payments Summary</CardTitle>
            </div>
            <CardDescription>Combined estimated payments + withholding paid to date</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className={`grid grid-cols-1 gap-4 ${entityNames.length > 1 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
              {/* Federal totals */}
              {(() => {
                const grandTotal = federalEstPaid + federalWithheld;
                const liability = summary.federalTaxLiability;
                const diff = grandTotal - liability;
                return (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Landmark className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-blue-900 text-sm">Federal</h4>
                    </div>
                    <TotalRow label="Est. Payments Paid" value={federalEstPaid} />
                    <TotalRow label="W-2 / Withholding" value={federalWithheld} />
                    <div className="border-t border-blue-200 mt-2 pt-2 space-y-1">
                      <TotalRow label="Grand Total Paid" value={grandTotal} bold />
                      <TotalRow label="Est. Tax Liability" value={liability} />
                      <div className={`flex justify-between text-xs pt-1 font-bold ${diff >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        <span>{diff >= 0 ? "Overpaid" : "Underpaid"}</span>
                        <span className="font-mono">{diff >= 0 ? `(${formatCurrency(Math.abs(diff))})` : formatCurrency(Math.abs(diff))}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* IL Individual totals */}
              {(() => {
                const grandTotal = ilIndividualEstPaid + ilWithheld;
                const liability = summary.stateIndividualTaxLiability;
                const diff = grandTotal - liability;
                return (
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-indigo-600" />
                      <h4 className="font-bold text-indigo-900 text-sm">IL Individual Personal</h4>
                    </div>
                    <TotalRow label="Est. Payments Paid" value={ilIndividualEstPaid} />
                    <TotalRow label="W-2 / Withholding" value={ilWithheld} />
                    <div className="border-t border-indigo-200 mt-2 pt-2 space-y-1">
                      <TotalRow label="Grand Total Paid" value={grandTotal} bold />
                      <TotalRow label="Est. Tax Liability" value={liability} />
                      <div className={`flex justify-between text-xs pt-1 font-bold ${diff >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        <span>{diff >= 0 ? "Overpaid" : "Underpaid"}</span>
                        <span className="font-mono">{diff >= 0 ? `(${formatCurrency(Math.abs(diff))})` : formatCurrency(Math.abs(diff))}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* IL Business — one cube per named entity */}
              {entityNames.length > 0 ? (
                entityNames.map(name => {
                  const entityPmts = businessPayments.filter(p => p.entityName === name);
                  const entityPaid = entityPmts.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
                  const breakdown = summary.entityBreakdowns?.find(e => e.entityName === name);
                  const entityLiability = breakdown ? breakdown.totalEntityTax : 0;
                  const hasPte = entityPmts.some(p => p.paymentType === "state_business_pte" && p.amountDue > 0);
                  const diff = entityPaid - entityLiability;
                  return (
                    <div key={name} className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-bold text-emerald-900 text-sm">{name}</h4>
                      </div>
                      <p className="text-[10px] text-emerald-600 mb-2 font-medium">
                        {hasPte ? "PTE 4.95% + Replacement 1.5%" : "Non-PTE — Replacement 1.5%"}
                      </p>
                      <TotalRow label="Est. Payments Paid" value={entityPaid} />
                      <div className="border-t border-emerald-200 mt-2 pt-2 space-y-1">
                        <TotalRow label="Annual Liability" value={entityLiability} bold />
                        {entityLiability > 0 && (
                          <div className={`flex justify-between text-xs pt-1 font-bold ${diff >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            <span>{diff >= 0 ? "Overpaid" : "Underpaid"}</span>
                            <span className="font-mono">{diff >= 0 ? `(${formatCurrency(Math.abs(diff))})` : formatCurrency(Math.abs(diff))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Legacy fallback: single combined cube when no named entities */
                (() => {
                  const grandTotal = businessEstPaid;
                  const liability = summary.stateBusinessPteTax + summary.stateBusinessReplacementTax;
                  const diff = grandTotal - liability;
                  return (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-bold text-emerald-900 text-sm">IL Business (Entity)</h4>
                      </div>
                      <TotalRow label="Est. Payments Paid" value={businessEstPaid} />
                      <p className="text-[10px] text-emerald-700 mt-1">Entity taxes paid directly by entity — no withholding.</p>
                      <div className="border-t border-emerald-200 mt-2 pt-2 space-y-1">
                        <TotalRow label="Grand Total Paid" value={grandTotal} bold />
                        <TotalRow label="Est. Tax Liability" value={liability} />
                        {liability > 0 && (
                          <div className={`flex justify-between text-xs pt-1 font-bold ${diff >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            <span>{diff >= 0 ? "Overpaid" : "Underpaid"}</span>
                            <span className="font-mono">{diff >= 0 ? `(${formatCurrency(Math.abs(diff))})` : formatCurrency(Math.abs(diff))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TotalRow({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-xs py-1 ${bold ? "font-bold text-slate-800" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(value)}</span>
    </div>
  );
}

function SingleEntityCard({ entity }: { entity: EntityBreakdown }) {
  return (
    <Card className="border-border/50 shadow-md bg-white flex flex-col">
      <div className={`h-1.5 w-full ${entity.pteElection ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Building2 className={`w-5 h-5 ${entity.pteElection ? 'text-emerald-600' : 'text-slate-400'}`} />
          Illinois Business
        </CardTitle>
        <CardDescription>{entity.entityName}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-4">
        <div className="bg-slate-50 p-4 rounded-xl mb-4">
          <div className="flex justify-between py-2 text-sm text-slate-600 font-medium border-b border-slate-100">
            <span>Full Entity Income</span><span className="font-mono">{formatCurrency(entity.entityTotalIncome)}</span>
          </div>
        </div>
        <div className="px-1 space-y-4">
          {entity.pteElection ? (
            <>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">PTE Tax (4.95%)</h4>
                <div className="flex justify-between py-2 text-sm font-bold text-slate-800 border-b border-slate-100">
                  <span>Entity Income Tax</span><span className="font-mono">{formatCurrency(entity.pteTax)}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Credit of {formatCurrency(entity.pteCreditAtIndividual)} flows to individual IL return.</p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Replacement Tax (1.5%)</h4>
                <div className="flex justify-between py-2 text-sm font-bold text-slate-800 border-b border-slate-100">
                  <span>Replacement Tax</span><span className="font-mono">{formatCurrency(entity.replacementTax)}</span>
                </div>
              </div>
              <div className="flex justify-between text-primary text-lg font-bold pt-2">
                <span>Total Entity Due</span><span className="font-mono">{formatCurrency(entity.totalEntityTax)}</span>
              </div>
            </>
          ) : (
            <>
              <Alert className="mb-4 bg-slate-50 border-slate-200">
                <AlertDescription className="text-xs text-slate-600">PTE Not Elected. The 4.95% state income tax is paid on the individual return.</AlertDescription>
              </Alert>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Replacement Tax (1.5%)</h4>
              <div className="flex justify-between text-primary text-lg font-bold">
                <span>Replacement Tax Due</span><span className="font-mono">{formatCurrency(entity.replacementTax)}</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MultiEntityCard({ entities }: { entities: EntityBreakdown[] }) {
  const totalPte = entities.reduce((s: number, e: EntityBreakdown) => s + e.pteTax, 0);
  const totalReplacement = entities.reduce((s: number, e: EntityBreakdown) => s + e.replacementTax, 0);
  return (
    <Card className="border-border/50 shadow-md bg-white flex flex-col overflow-y-auto max-h-[520px]">
      <div className="h-1.5 w-full bg-emerald-500" />
      <CardHeader className="pb-2 sticky top-0 bg-white z-10">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Building2 className="w-5 h-5 text-emerald-600" /> Illinois Business
        </CardTitle>
        <CardDescription>{entities.length} entities · totals below</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4 space-y-3">
        {entities.map(e => (
          <div key={e.entityName} className={`rounded-lg border p-3 text-sm ${e.pteElection ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/40"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-800 text-sm">{e.entityName}</span>
              {e.pteElection
                ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] px-1 py-0">PTE</Badge>
                : <Badge variant="outline" className="text-slate-400 text-[9px] px-1 py-0">No PTE</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 text-xs text-slate-600">
              <span>Entity income: <span className="font-mono font-medium">{formatCurrency(e.entityTotalIncome)}</span></span>
              {e.pteElection && <span>PTE tax: <span className="font-mono font-medium text-emerald-700">{formatCurrency(e.pteTax)}</span></span>}
              <span>Replacement: <span className="font-mono font-medium">{formatCurrency(e.replacementTax)}</span></span>
              <span className="font-bold text-slate-800">Total: <span className="font-mono">{formatCurrency(e.totalEntityTax)}</span></span>
            </div>
          </div>
        ))}
        <div className="border-t-2 border-slate-200 pt-3 space-y-1">
          {totalPte > 0 && (
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>Total PTE Tax (4.95%)</span><span className="font-mono">{formatCurrency(totalPte)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs font-medium text-slate-600">
            <span>Total Replacement (1.5%)</span><span className="font-mono">{formatCurrency(totalReplacement)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-primary">
            <span>Total Entity Due</span><span className="font-mono">{formatCurrency(totalPte + totalReplacement)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
