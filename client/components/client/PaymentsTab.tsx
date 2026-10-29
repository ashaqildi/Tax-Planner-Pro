import React, { useState, useEffect } from "react";
import { EstimatedPayment, Client, QuarterSummary } from "@workspace/api-client-react";
import { useTaxMutations } from "@/hooks/use-tax-mutations";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, Save, AlertTriangle, Building2 } from "lucide-react";

interface PaymentsTabProps {
  client: Client;
  payments?: EstimatedPayment[];
  quarterSummaries?: QuarterSummary[];
  isLoading: boolean;
}

export function PaymentsTab({ client, payments, quarterSummaries, isLoading }: PaymentsTabProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-2xl"></div>
        ))}
      </div>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-600 mb-2">No payments generated</h3>
        <p className="text-slate-400 max-w-sm mx-auto">Generate the tax summary first by entering income sources.</p>
      </div>
    );
  }

  const quarters = [1, 2, 3, 4].map(q => ({
    quarter: q,
    summary: quarterSummaries?.find(s => s.quarter === q),
    payments: payments.filter(p => p.quarter === q).sort((a, b) => a.paymentType.localeCompare(b.paymentType))
  }));

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {quarters.map((q) => (
          <QuarterCard
            key={q.quarter}
            quarter={q.quarter}
            summary={q.summary}
            payments={q.payments}
            clientId={client.id}
            globalPteElection={client.pteElection}
          />
        ))}
      </div>
    </div>
  );
}

// ── Status helper ────────────────────────────────────────────────────────────
function getPaymentStatus(amountPaid: number | null, amountDue: number, dueDate: string | null) {
  if (amountDue <= 0) return "na";
  const paid = Number(amountPaid) || 0;
  if (paid >= amountDue * 0.99) return "paid";
  if (paid > 0) return "short-paid";
  if (dueDate && new Date(dueDate + "T00:00:00") < new Date()) return "overdue";
  return "pending";
}

// ── Individual payment row ────────────────────────────────────────────────────
function PaymentRow({ payment, clientId, label }: { payment: EstimatedPayment; clientId: number; label?: string }) {
  const { updatePayment } = useTaxMutations();
  const [amountPaid, setAmountPaid] = useState<string>(payment.amountPaid !== null ? String(payment.amountPaid) : "");
  const [confNumber, setConfNumber] = useState<string>(payment.confirmationNumber || "");
  const [paidDate, setPaidDate] = useState<string>(payment.paidDate || "");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setAmountPaid(payment.amountPaid !== null ? String(payment.amountPaid) : "");
    setConfNumber(payment.confirmationNumber || "");
    setPaidDate(payment.paidDate || "");
    setIsEditing(false);
  }, [payment.amountPaid, payment.confirmationNumber, payment.paidDate]);

  const status = getPaymentStatus(payment.amountPaid ?? null, payment.amountDue, payment.dueDate);

  const handleSave = () => {
    updatePayment.mutate({
      clientId,
      paymentId: payment.id,
      data: {
        amountPaid: amountPaid === "" ? null : Number(amountPaid),
        confirmationNumber: confNumber === "" ? null : confNumber,
        paidDate: paidDate === "" ? null : paidDate,
      }
    }, { onSuccess: () => setIsEditing(false) });
  };

  const paymentTypeLabels: Record<string, string> = {
    federal_individual: "Federal 1040-ES",
    state_individual: "IL Individual ES",
    state_business_pte: "IL PTE (Entity 4.95%)",
    state_business_replacement: "IL Replacement (1.5%)"
  };

  const displayLabel = label || paymentTypeLabels[payment.paymentType] || payment.paymentType;
  const rowBg =
    status === "paid" ? "bg-emerald-50/30 border-emerald-100" :
    status === "short-paid" ? "bg-amber-50/30 border-amber-100" :
    status === "overdue" ? "bg-red-50/50 border-red-100" :
    "bg-white border-slate-200 hover:border-primary/30 shadow-sm";

  return (
    <div className={`p-4 rounded-xl border transition-all duration-200 ${rowBg}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-sm text-slate-800">{displayLabel}</h4>
          <p className="text-lg font-mono font-bold text-foreground">{formatCurrency(payment.amountDue)}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <PaymentInputs
        amountPaid={amountPaid}
        confNumber={confNumber}
        paidDate={paidDate}
        isPaid={status === "paid"}
        isEditing={isEditing}
        isPending={updatePayment.isPending}
        onAmountChange={(v) => { setAmountPaid(v); setIsEditing(true); }}
        onConfChange={(v) => { setConfNumber(v); setIsEditing(true); }}
        onDateChange={(v) => { setPaidDate(v); setIsEditing(true); }}
        onSave={handleSave}
        placeholder={payment.amountDue.toString()}
      />
    </div>
  );
}

// ── Combined PTE + Replacement row for a single entity ───────────────────────
function CombinedEntityRow({
  ptePayment,
  replacementPayment,
  clientId,
  entityName,
}: {
  ptePayment: EstimatedPayment;
  replacementPayment: EstimatedPayment;
  clientId: number;
  entityName: string | null;
}) {
  const { updatePayment } = useTaxMutations();
  const combinedDue = (ptePayment.amountDue || 0) + (replacementPayment.amountDue || 0);
  const combinedPaid = (Number(ptePayment.amountPaid) || 0) + (Number(replacementPayment.amountPaid) || 0);

  const [amountPaid, setAmountPaid] = useState<string>(combinedPaid > 0 ? String(combinedPaid) : "");
  const [confNumber, setConfNumber] = useState<string>(ptePayment.confirmationNumber || replacementPayment.confirmationNumber || "");
  const [paidDate, setPaidDate] = useState<string>(ptePayment.paidDate || replacementPayment.paidDate || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const newCombinedPaid = (Number(ptePayment.amountPaid) || 0) + (Number(replacementPayment.amountPaid) || 0);
    setAmountPaid(newCombinedPaid > 0 ? String(newCombinedPaid) : "");
    setConfNumber(ptePayment.confirmationNumber || replacementPayment.confirmationNumber || "");
    setPaidDate(ptePayment.paidDate || replacementPayment.paidDate || "");
    setIsEditing(false);
  }, [ptePayment.amountPaid, replacementPayment.amountPaid, ptePayment.confirmationNumber, replacementPayment.confirmationNumber]);

  const status = getPaymentStatus(combinedPaid > 0 ? combinedPaid : null, combinedDue, ptePayment.dueDate);

  const handleSave = async () => {
    if (combinedDue <= 0) return;
    setIsPending(true);
    const totalPaid = amountPaid === "" ? null : Number(amountPaid);
    const conf = confNumber === "" ? null : confNumber;
    const date = paidDate === "" ? null : paidDate;

    const ptePct = combinedDue > 0 ? ptePayment.amountDue / combinedDue : 0.5;
    const pteShare = totalPaid !== null ? Math.round(totalPaid * ptePct * 100) / 100 : null;
    const replacementShare = totalPaid !== null ? Math.round((totalPaid - (pteShare ?? 0)) * 100) / 100 : null;

    await Promise.all([
      new Promise<void>((resolve) => updatePayment.mutate({ clientId, paymentId: ptePayment.id, data: { amountPaid: pteShare, confirmationNumber: conf, paidDate: date } }, { onSuccess: () => resolve(), onError: () => resolve() })),
      new Promise<void>((resolve) => updatePayment.mutate({ clientId, paymentId: replacementPayment.id, data: { amountPaid: replacementShare, confirmationNumber: conf, paidDate: date } }, { onSuccess: () => resolve(), onError: () => resolve() })),
    ]);
    setIsPending(false);
    setIsEditing(false);
  };

  const rowBg =
    status === "paid" ? "bg-emerald-50/30 border-emerald-100" :
    status === "short-paid" ? "bg-amber-50/30 border-amber-100" :
    status === "overdue" ? "bg-red-50/50 border-red-100" :
    "bg-white border-slate-200 hover:border-primary/30 shadow-sm";

  return (
    <div className={`p-4 rounded-xl border transition-all duration-200 ${rowBg}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-sm text-slate-800">
            IL Business Tax — PTE 4.95% + Replacement 1.5%
          </h4>
          {entityName && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-emerald-600" />
              <span className="text-[11px] font-medium text-emerald-700">{entityName}</span>
            </div>
          )}
          <p className="text-lg font-mono font-bold text-foreground mt-1">{formatCurrency(combinedDue)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            PTE: {formatCurrency(ptePayment.amountDue)} &nbsp;+&nbsp; Replacement: {formatCurrency(replacementPayment.amountDue)}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      <PaymentInputs
        amountPaid={amountPaid}
        confNumber={confNumber}
        paidDate={paidDate}
        isPaid={status === "paid"}
        isEditing={isEditing}
        isPending={isPending}
        onAmountChange={(v) => { setAmountPaid(v); setIsEditing(true); }}
        onConfChange={(v) => { setConfNumber(v); setIsEditing(true); }}
        onDateChange={(v) => { setPaidDate(v); setIsEditing(true); }}
        onSave={handleSave}
        placeholder={combinedDue.toString()}
      />
    </div>
  );
}

// ── Shared input fields ──────────────────────────────────────────────────────
function PaymentInputs({
  amountPaid, confNumber, paidDate, isPaid, isEditing, isPending,
  onAmountChange, onConfChange, onDateChange, onSave, placeholder,
}: {
  amountPaid: string; confNumber: string; paidDate: string;
  isPaid: boolean; isEditing: boolean; isPending: boolean;
  onAmountChange: (v: string) => void; onConfChange: (v: string) => void; onDateChange: (v: string) => void;
  onSave: () => void; placeholder: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Amount Paid</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <Input
            type="number"
            step="0.01"
            value={amountPaid}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder={placeholder}
            className={`h-8 pl-6 text-sm font-mono ${isPaid ? 'bg-emerald-50/50 border-emerald-200 focus-visible:ring-emerald-500' : ''}`}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Date Paid</label>
        <Input
          type="date"
          value={paidDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-8 text-sm text-slate-600"
        />
      </div>
      <div className="col-span-2 space-y-1">
        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Confirmation / Ref #</label>
        <div className="flex gap-2">
          <Input
            value={confNumber}
            onChange={(e) => onConfChange(e.target.value)}
            placeholder="e.g. EFTPS-123456"
            className="h-8 text-sm font-mono text-slate-600 flex-1"
          />
          {isEditing && (
            <Button
              size="sm"
              onClick={onSave}
              disabled={isPending}
              className="h-8 bg-primary hover:bg-primary/90 text-white px-3"
            >
              {isPending ? "..." : <Save className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return (
    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 px-2 py-0.5">
      <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
    </Badge>
  );
  if (status === "short-paid") return (
    <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 px-2 py-0.5">
      <AlertTriangle className="w-3 h-3 mr-1" /> Short-paid
    </Badge>
  );
  if (status === "overdue") return (
    <Badge variant="destructive" className="px-2 py-0.5">
      <Clock className="w-3 h-3 mr-1" /> Overdue
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-slate-500 border-slate-300 px-2 py-0.5">
      <Circle className="w-3 h-3 mr-1" /> Pending
    </Badge>
  );
}

// ── Quarter card ─────────────────────────────────────────────────────────────
function QuarterCard({
  quarter, summary, payments, clientId, globalPteElection,
}: {
  quarter: number; summary?: QuarterSummary; payments: EstimatedPayment[]; clientId: number; globalPteElection: boolean;
}) {
  if (payments.length === 0) return null;

  const dueDate = summary?.dueDate || payments[0]?.dueDate;
  const formattedDueDate = dueDate ? format(parseISO(dueDate), "MMMM d, yyyy") : "";
  const isPastDue = dueDate && new Date(dueDate) < new Date();

  const relevantPayments = payments.filter(p => p.amountDue > 0);
  const allPaid = relevantPayments.length > 0 && relevantPayments.every(p => {
    const paid = Number(p.amountPaid) || 0;
    return paid >= p.amountDue * 0.99;
  });

  // Always show individual payment rows regardless of amountDue (so they remain available for manual entry)
  const federalPayment = payments.find(p => p.paymentType === "federal_individual");
  const stateIndividualPayment = payments.find(p => p.paymentType === "state_individual");

  // Group business payments by entityName
  const businessPayments = relevantPayments.filter(
    p => p.paymentType === "state_business_pte" || p.paymentType === "state_business_replacement"
  );

  // Collect unique entity names (null = legacy/unnamed entity)
  const entityNames = [...new Set(businessPayments.map(p => p.entityName ?? null))];

  return (
    <Card className={`border-border/60 shadow-lg overflow-hidden flex flex-col relative ${allPaid ? 'bg-emerald-50/20' : 'bg-white'}`}>
      {allPaid && <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full pointer-events-none -z-0" />}
      <CardHeader className={`pb-4 border-b ${allPaid ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-display font-bold">Quarter {quarter}</CardTitle>
            <p className={`text-sm font-medium mt-1 ${isPastDue && !allPaid ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
              Due: {formattedDueDate}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Total Due</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{formatCurrency(summary?.totalDue || 0)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 bg-slate-50/30 flex-1 relative z-10">
        <div className="space-y-4">
          {federalPayment && (
            <PaymentRow payment={federalPayment} clientId={clientId} />
          )}
          {stateIndividualPayment && (
            <PaymentRow payment={stateIndividualPayment} clientId={clientId} />
          )}

          {/* Render per entity */}
          {entityNames.map(entityName => {
            const entityKey = entityName ?? "";
            const entityBizPayments = businessPayments.filter(p => (p.entityName ?? null) === entityName);
            const ptePmt = entityBizPayments.find(p => p.paymentType === "state_business_pte");
            const replacementPmt = entityBizPayments.find(p => p.paymentType === "state_business_replacement");

            // Determine PTE for this entity (presence of a pte payment record means PTE is elected for this entity)
            const entityHasPte = !!ptePmt;

            if (entityHasPte && ptePmt && replacementPmt) {
              return (
                <CombinedEntityRow
                  key={entityKey}
                  ptePayment={ptePmt}
                  replacementPayment={replacementPmt}
                  clientId={clientId}
                  entityName={entityName}
                />
              );
            }
            if (!entityHasPte && replacementPmt) {
              return (
                <PaymentRow
                  key={entityKey + "-replacement"}
                  payment={replacementPmt}
                  clientId={clientId}
                  label={entityName ? `IL Business — ${entityName} (Non-PTE - Replacement 1.5%)` : "IL Business (Non-PTE - Replacement 1.5%)"}
                />
              );
            }
            if (ptePmt) {
              return (
                <PaymentRow
                  key={entityKey + "-pte"}
                  payment={ptePmt}
                  clientId={clientId}
                  label={entityName ? `${entityName} — IL PTE (4.95%)` : "IL PTE (4.95%)"}
                />
              );
            }
            return null;
          })}

          {relevantPayments.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">No payments required for this quarter.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
