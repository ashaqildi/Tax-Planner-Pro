import React, { useEffect, useState, useCallback } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IncomeSource, Client } from "@workspace/api-client-react";
import { useTaxMutations } from "@/hooks/use-tax-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, AlertCircle, TrendingUp, Building, Briefcase, Landmark, Plus, Trash2, ChevronDown, ChevronUp, Percent } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseNumberInput } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

// ── Types ───────────────────────────────────────────────────────────────────
interface W2Entry {
  id: string;
  label: string;
  wages: number | string;
  federalWithheld: number | string;
  stateWithheld: number | string;
}

interface ScorpEntry {
  id: string;
  name: string;
  ownershipPct: number | string;
  ordinaryIncome: number | string;
  otherIncome: number | string;
  stateTaxesDeducted?: number | string;
  pteElection?: boolean;
}

function makeW2(): W2Entry {
  return { id: crypto.randomUUID(), label: "", wages: "", federalWithheld: "", stateWithheld: "" };
}

function makeScorp(defaultName?: string, globalPte?: boolean): ScorpEntry {
  return { id: crypto.randomUUID(), name: defaultName ?? "", ownershipPct: 100, ordinaryIncome: "", otherIncome: "", stateTaxesDeducted: "", pteElection: globalPte };
}

// ── Zod schema for all the scalar fields ────────────────────────────────────
const numericField = z.union([z.string(), z.number()]).nullable().optional()
  .transform((val) => parseNumberInput(val));

const incomeSchema = z.object({
  interest1099: numericField,
  dividends1099: numericField,
  qualifiedDividends: numericField,
  nec1099: numericField,
  misc1099: numericField,
  partnershipK1Ordinary: numericField,
  partnershipK1OtherIncome: numericField,
  rentalIncome: numericField,
  capitalGainsShortTerm: numericField,
  capitalGainsLongTerm: numericField,
  socialSecurity: numericField,
  pensionRetirement: numericField,
  otherIncome: numericField,
  additionalFederalWithheld: numericField,
  additionalStateWithheld: numericField,
  priorYearFederalTax: numericField,
  priorYearStateTax: numericField,
  itemizedDeductions: numericField,
  applyQbiDeduction: z.boolean().optional().default(false),
  notes: z.string().nullable().optional(),
});

type IncomeFormInput = z.input<typeof incomeSchema>;
type IncomeFormValues = z.output<typeof incomeSchema>;

interface IncomeTabProps {
  client: Client;
  incomeSources?: IncomeSource[];
  taxYear: number;
}

// ── Main Component ──────────────────────────────────────────────────────────
export function IncomeTab({ client, incomeSources, taxYear }: IncomeTabProps) {
  const { upsertIncomeSources } = useTaxMutations();
  const currentIncome = incomeSources?.find(i => i.taxYear === taxYear);

  const [w2Entries, setW2Entries] = useState<W2Entry[]>([makeW2()]);
  const [scorpEntries, setScorpEntries] = useState<ScorpEntry[]>([]);

  const form = useForm<IncomeFormInput, unknown, IncomeFormValues>({
    // The resolver's declarations resolve Zod 4, but this schema is Zod 3.
    // At runtime the resolver parses the schema and returns its transformed output.
    resolver: zodResolver(incomeSchema as unknown as Parameters<typeof zodResolver>[0]) as Resolver<IncomeFormInput, unknown, IncomeFormValues>,
    defaultValues: {
      interest1099: "", dividends1099: "", qualifiedDividends: "", nec1099: "", misc1099: "",
      partnershipK1Ordinary: "", partnershipK1OtherIncome: "", rentalIncome: "",
      capitalGainsShortTerm: "", capitalGainsLongTerm: "", socialSecurity: "",
      pensionRetirement: "", otherIncome: "", additionalFederalWithheld: "",
      additionalStateWithheld: "", priorYearFederalTax: "", priorYearStateTax: "", itemizedDeductions: "",
      applyQbiDeduction: false, notes: "",
    }
  });

  const mapVal = (v: number | null | undefined | string) =>
    v === null || v === undefined ? "" : v;

  // Reset form + dynamic entries when data changes
  useEffect(() => {
    if (currentIncome) {
      // Restore W2 entries
      const savedW2 = (currentIncome as any).w2Entries as W2Entry[] | null;
      if (savedW2 && savedW2.length > 0) {
        setW2Entries(savedW2);
      } else if (currentIncome.w2Wages !== null && currentIncome.w2Wages !== undefined) {
        // Migrate legacy scalar → single entry
        setW2Entries([{
          id: crypto.randomUUID(),
          label: "W-2",
          wages: currentIncome.w2Wages,
          federalWithheld: currentIncome.federalWithheld ?? "",
          stateWithheld: currentIncome.stateWithheld ?? "",
        }]);
      } else {
        setW2Entries([makeW2()]);
      }

      // Restore S-Corp entries
      const savedScorp = (currentIncome as any).scorpEntries as ScorpEntry[] | null;
      if (savedScorp && savedScorp.length > 0) {
        setScorpEntries(savedScorp);
      } else if (
        (currentIncome.scorpK1Ordinary !== null && currentIncome.scorpK1Ordinary !== undefined) ||
        (currentIncome.scorpK1OtherIncome !== null && currentIncome.scorpK1OtherIncome !== undefined)
      ) {
        setScorpEntries([{
          id: crypto.randomUUID(),
          name: client.scorporationName ?? "S-Corporation",
          ownershipPct: 100,
          ordinaryIncome: currentIncome.scorpK1Ordinary ?? "",
          otherIncome: currentIncome.scorpK1OtherIncome ?? "",
          pteElection: client.pteElection,
        }]);
      } else {
        setScorpEntries([]);
      }

      form.reset({
        interest1099: mapVal(currentIncome.interest1099),
        dividends1099: mapVal(currentIncome.dividends1099),
        qualifiedDividends: mapVal(currentIncome.qualifiedDividends),
        nec1099: mapVal(currentIncome.nec1099),
        misc1099: mapVal(currentIncome.misc1099),
        partnershipK1Ordinary: mapVal(currentIncome.partnershipK1Ordinary),
        partnershipK1OtherIncome: mapVal(currentIncome.partnershipK1OtherIncome),
        rentalIncome: mapVal(currentIncome.rentalIncome),
        capitalGainsShortTerm: mapVal(currentIncome.capitalGainsShortTerm),
        capitalGainsLongTerm: mapVal(currentIncome.capitalGainsLongTerm),
        socialSecurity: mapVal(currentIncome.socialSecurity),
        pensionRetirement: mapVal(currentIncome.pensionRetirement),
        otherIncome: mapVal(currentIncome.otherIncome),
        // If migrating from legacy, withholding now lives in W-2 entries — leave additional as 0
        additionalFederalWithheld: (currentIncome as any).w2Entries?.length ? mapVal(currentIncome.federalWithheld) : "",
        additionalStateWithheld: (currentIncome as any).w2Entries?.length ? mapVal(currentIncome.stateWithheld) : "",
        priorYearFederalTax: mapVal(currentIncome.priorYearFederalTax),
        priorYearStateTax: mapVal(currentIncome.priorYearStateTax),
        itemizedDeductions: mapVal((currentIncome as any).itemizedDeductions),
        applyQbiDeduction: (currentIncome as any).applyQbiDeduction ?? false,
        notes: currentIncome.notes || "",
      });
    } else {
      setW2Entries([makeW2()]);
      setScorpEntries([]);
      form.reset({
        interest1099: "", dividends1099: "", qualifiedDividends: "", nec1099: "", misc1099: "",
        partnershipK1Ordinary: "", partnershipK1OtherIncome: "", rentalIncome: "",
        capitalGainsShortTerm: "", capitalGainsLongTerm: "", socialSecurity: "",
        pensionRetirement: "", otherIncome: "", additionalFederalWithheld: "",
        additionalStateWithheld: "", priorYearFederalTax: "", priorYearStateTax: "", itemizedDeductions: "",
        applyQbiDeduction: false, notes: "",
      });
    }
  }, [currentIncome, taxYear]);

  const updateW2 = useCallback((id: string, field: keyof W2Entry, value: string) => {
    setW2Entries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  }, []);

  const updateScorp = useCallback((id: string, field: keyof ScorpEntry, value: string) => {
    setScorpEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  }, []);

  const updateScorpPte = useCallback((id: string, value: boolean) => {
    setScorpEntries(prev => prev.map(e => e.id === id ? { ...e, pteElection: value } : e));
  }, []);

  const parseEntry = (val: string | number) =>
    val === "" || val === null || val === undefined ? 0 : Number(val);

  const onSubmit = (values: IncomeFormValues) => {
    const cleanedW2 = w2Entries
      .filter(e => parseEntry(e.wages) > 0 || e.label.trim() !== "")
      .map(e => ({
        id: e.id,
        label: e.label || "W-2",
        wages: parseEntry(e.wages),
        federalWithheld: parseEntry(e.federalWithheld),
        stateWithheld: parseEntry(e.stateWithheld),
      }));

    const cleanedScorp = scorpEntries
      .filter(e => parseEntry(e.ordinaryIncome) > 0 || parseEntry(e.otherIncome) > 0 || e.name.trim() !== "")
      .map(e => ({
        id: e.id,
        name: e.name || "S-Corporation",
        ownershipPct: Math.min(100, Math.max(0, parseEntry(e.ownershipPct) || 100)),
        ordinaryIncome: parseEntry(e.ordinaryIncome),
        otherIncome: parseEntry(e.otherIncome),
        stateTaxesDeducted: parseEntry(e.stateTaxesDeducted ?? ""),
        pteElection: e.pteElection ?? false,
      }));

    upsertIncomeSources.mutate({
      clientId: client.id,
      data: {
        ...values,
        taxYear,
        w2Entries: cleanedW2,
        scorpEntries: cleanedScorp,
        // Keep legacy aggregated withholding for backward compat
        federalWithheld: values.additionalFederalWithheld,
        stateWithheld: values.additionalStateWithheld,
      } as any,
    });
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const NumInput = ({ name, label, desc }: { name: keyof IncomeFormValues, label: string, desc?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-slate-700 font-medium text-sm">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
        <Input
          id={name}
          type="number"
          step="0.01"
          {...form.register(name)}
          className="pl-7 bg-white focus-visible:ring-primary/20 transition-all font-mono"
        />
      </div>
      {desc && <p className="text-[10px] text-slate-500 leading-tight">{desc}</p>}
    </div>
  );

  return (
    <div className="pb-20">
      <form id="income-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {client.pteElection && (
          <Alert className="bg-blue-50 border-blue-200 text-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="font-bold text-blue-900">PTE Election Active</AlertTitle>
            <AlertDescription className="text-sm">
              S-Corp K-1 income below will be taxed at entity level (4.95% PTE + 1.5% replacement) based on
              <strong> full entity income</strong> (K-1 ÷ ownership %). The individual IL return will receive a
              credit equal to your ownership share of the PTE tax paid.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Column 1 ─────────────────────────────────────────────── */}
          <div className="space-y-8">

            {/* W-2 Wages — dynamic */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-blue-500" />
              <CardHeader className="bg-slate-50/50 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-500" />
                    W-2 Wages
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => setW2Entries(prev => [...prev, makeW2()])}
                  >
                    <Plus className="w-3 h-3" /> Add W-2
                  </Button>
                </div>
                <CardDescription className="text-xs">One row per employer / spouse. Box 1 wages, Box 2 federal withholding, Box 17 state withholding.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {w2Entries.map((entry, idx) => (
                  <W2EntryRow
                    key={entry.id}
                    entry={entry}
                    index={idx}
                    total={w2Entries.length}
                    onChange={updateW2}
                    onRemove={() => setW2Entries(prev => prev.filter(e => e.id !== entry.id))}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Business & Pass-through */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-indigo-500" />
              <CardHeader className="bg-slate-50/50 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-500" />
                  Business & Pass-through
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-5">
                {/* 1099-NEC / MISC */}
                <div className="grid grid-cols-2 gap-4">
                  <NumInput name="nec1099" label="1099-NEC (Self-Employment)" />
                  <NumInput name="misc1099" label="1099-MISC" />
                </div>

                {/* S-Corp entries — dynamic */}
                <div className="rounded-xl border border-indigo-100 overflow-hidden">
                  <div className="bg-indigo-50/70 px-4 py-3 flex items-center justify-between border-b border-indigo-100">
                    <div>
                      <h4 className="font-semibold text-indigo-900 text-sm">S-Corporation K-1 Entries</h4>
                      <p className="text-[11px] text-indigo-600 mt-0.5">Enter your K-1 share. Ownership % drives entity-level IL taxes.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      onClick={() => setScorpEntries(prev => [...prev, makeScorp("", client.pteElection)])}
                    >
                      <Plus className="w-3 h-3" /> Add S-Corp
                    </Button>
                  </div>
                  <div className="p-3 space-y-3 bg-white">
                    {scorpEntries.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-4">
                        No S-Corp entries. Click "Add S-Corp" to add one.
                      </p>
                    ) : (
                      scorpEntries.map((entry, idx) => (
                        <ScorpEntryRow
                          key={entry.id}
                          entry={entry}
                          index={idx}
                          total={scorpEntries.length}
                          globalPteElection={client.pteElection}
                          multipleEntities={scorpEntries.length > 1}
                          onChange={updateScorp}
                          onTogglePte={updateScorpPte}
                          onRemove={() => setScorpEntries(prev => prev.filter(e => e.id !== entry.id))}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Partnership K-1 */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h4 className="font-semibold text-slate-700 text-sm">Partnership K-1</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <NumInput name="partnershipK1Ordinary" label="Ordinary Income" />
                    <NumInput name="partnershipK1OtherIncome" label="Other Income" />
                  </div>
                </div>

                {/* QBI Deduction */}
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Percent className="w-4 h-4 text-violet-600" />
                        <h4 className="font-semibold text-violet-900 text-sm">QBI Deduction (Section 199A)</h4>
                      </div>
                      <p className="text-[11px] text-violet-700 leading-tight">
                        Apply a 20% deduction against qualified business income (S-Corp K-1 + Partnership K-1 + 1099-NEC) to reduce federal taxable income.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.watch("applyQbiDeduction") ?? false}
                      onClick={() => form.setValue("applyQbiDeduction", !(form.watch("applyQbiDeduction") ?? false))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        form.watch("applyQbiDeduction") ? "bg-violet-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                          form.watch("applyQbiDeduction") ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  {form.watch("applyQbiDeduction") && (
                    <div className="mt-3 pt-3 border-t border-violet-100 text-[11px] text-violet-800 font-medium">
                      20% QBI deduction will be applied to federal taxable income calculation.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Withholding & Safe Harbor */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-emerald-500" />
              <CardHeader className="bg-slate-50/50 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-500" />
                  Withholding & Safe Harbor
                </CardTitle>
                <CardDescription className="text-xs">
                  W-2 withholding is tracked per entry above. Use these fields for <strong>additional</strong> withholding
                  (e.g., backup withholding on 1099s, pension withholding) and prior-year tax for Safe Harbor.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <NumInput name="additionalFederalWithheld" label="Additional Federal Withheld" desc="Non-W-2 sources" />
                  <NumInput name="additionalStateWithheld" label="Additional IL Withheld" desc="Non-W-2 sources" />
                </div>
                <div className="border-t border-slate-100 my-2 pt-4" />
                <div className="grid grid-cols-2 gap-4">
                  <NumInput name="priorYearFederalTax" label="Prior Year Federal Tax" desc="Line 24 on 1040" />
                  <NumInput name="priorYearStateTax" label="Prior Year IL Tax" />
                </div>
                <div className="border-t border-slate-100 my-2 pt-4" />
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-amber-900 text-sm">Itemized Deductions Override</h4>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      If your itemized deductions exceed the standard deduction, enter the total here.
                      The calculator will use whichever is greater. Leave blank to use the standard deduction.
                    </p>
                  </div>
                  <NumInput name="itemizedDeductions" label="Total Itemized Deductions (Schedule A)" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Column 2 ─────────────────────────────────────────────── */}
          <div className="space-y-8">
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-purple-500" />
              <CardHeader className="bg-slate-50/50 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  Investment & Passive
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <NumInput name="interest1099" label="1099-INT Interest" />
                  <NumInput name="rentalIncome" label="Rental Income (Sch E)" />
                </div>
                <div className="border-t border-slate-100 my-2 pt-4" />
                <div className="grid grid-cols-2 gap-4">
                  <NumInput name="dividends1099" label="Total Dividends (1099-DIV)" />
                  <NumInput name="qualifiedDividends" label="Qualified Portion" desc="Subset of total dividends" />
                </div>
                <div className="border-t border-slate-100 my-2 pt-4" />
                <div className="grid grid-cols-2 gap-4">
                  <NumInput name="capitalGainsShortTerm" label="Short-term Cap Gains" />
                  <NumInput name="capitalGainsLongTerm" label="Long-term Cap Gains" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-amber-500" />
              <CardHeader className="bg-slate-50/50 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Retirement & Other
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <NumInput name="socialSecurity" label="Social Security Benefits" />
                  <NumInput name="pensionRetirement" label="Pension / IRA Dist." />
                </div>
                <NumInput name="otherIncome" label="Other Misc. Income" />
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 pb-4">
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Textarea
                  {...form.register("notes")}
                  placeholder="Any context regarding income sources for this year..."
                  className="min-h-[100px] resize-none focus-visible:ring-primary/20"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Floating Action Bar */}
        <div className="fixed bottom-0 left-0 md:left-72 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-border shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.05)] z-20 flex justify-end">
          <Button
            type="submit"
            form="income-form"
            size="lg"
            disabled={upsertIncomeSources.isPending}
            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 rounded-xl px-8"
          >
            <Save className="w-4 h-4 mr-2" />
            {upsertIncomeSources.isPending ? "Saving..." : "Save Income Sources"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── W-2 Entry Row ────────────────────────────────────────────────────────────
function W2EntryRow({
  entry, index, total, onChange, onRemove,
}: {
  entry: W2Entry; index: number; total: number;
  onChange: (id: string, field: keyof W2Entry, value: string) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-100">
        <Badge variant="outline" className="text-[10px] font-bold h-5 px-1.5 text-blue-600 border-blue-200 bg-blue-50">
          W-2 #{index + 1}
        </Badge>
        <input
          type="text"
          value={entry.label}
          onChange={e => onChange(entry.id, "label", e.target.value)}
          placeholder="Label (e.g. John – Employer Name)"
          className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 min-w-0"
        />
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-slate-400 hover:text-slate-600 p-0.5"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400 hover:text-red-600 p-0.5 ml-0.5"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-3 gap-3 p-3">
          <EntryField
            label="Box 1 Wages"
            value={entry.wages}
            onChange={v => onChange(entry.id, "wages", v)}
            placeholder="0.00"
          />
          <EntryField
            label="Box 2 Fed Withheld"
            value={entry.federalWithheld}
            onChange={v => onChange(entry.id, "federalWithheld", v)}
            placeholder="0.00"
          />
          <EntryField
            label="Box 17 IL Withheld"
            value={entry.stateWithheld}
            onChange={v => onChange(entry.id, "stateWithheld", v)}
            placeholder="0.00"
          />
        </div>
      )}
    </div>
  );
}

// ── S-Corp Entry Row ─────────────────────────────────────────────────────────
function ScorpEntryRow({
  entry, index, total, globalPteElection, multipleEntities, onChange, onTogglePte, onRemove,
}: {
  entry: ScorpEntry; index: number; total: number;
  globalPteElection: boolean; multipleEntities: boolean;
  onChange: (id: string, field: keyof ScorpEntry, value: string) => void;
  onTogglePte: (id: string, val: boolean) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const pct = Number(entry.ownershipPct) || 100;
  const effectivePte = multipleEntities
    ? (entry.pteElection !== undefined ? entry.pteElection : globalPteElection)
    : globalPteElection;

  return (
    <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-indigo-50/50 border-b border-indigo-100">
        <Badge variant="outline" className="text-[10px] font-bold h-5 px-1.5 text-indigo-600 border-indigo-200 bg-indigo-50 shrink-0">
          S-Corp #{index + 1}
        </Badge>
        <input
          type="text"
          value={entry.name}
          onChange={e => onChange(entry.id, "name", e.target.value)}
          placeholder="S-Corporation Name"
          className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 min-w-0"
        />
        {/* Per-entity PTE toggle — only visible when 2+ entities */}
        {multipleEntities && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PTE</span>
            <button
              type="button"
              onClick={() => onTogglePte(entry.id, !effectivePte)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${effectivePte ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${effectivePte ? "translate-x-4.5" : "translate-x-0.5"}`} />
            </button>
            <span className={`text-[10px] font-bold ${effectivePte ? "text-emerald-600" : "text-slate-400"}`}>
              {effectivePte ? "Yes" : "No"}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-slate-400 hover:text-slate-600 p-0.5"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {total > 0 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400 hover:text-red-600 p-0.5 ml-0.5"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Ownership % row */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
            <div className="flex-1">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Ownership %</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={entry.ownershipPct}
                  onChange={e => onChange(entry.id, "ownershipPct", e.target.value)}
                  className="w-20 h-8 text-sm font-mono font-bold text-center border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <span className="text-sm font-bold text-slate-600">%</span>
              </div>
            </div>
            {effectivePte && pct < 100 && (
              <div className="text-right">
                <p className="text-[10px] text-indigo-600 font-medium">Entity-level PTE computed at 100%</p>
                <p className="text-[10px] text-indigo-600">Credit flows {pct}% to individual return</p>
              </div>
            )}
            {effectivePte && pct === 100 && (
              <div className="text-right">
                <p className="text-[10px] text-emerald-600 font-medium">100% owner — full PTE credit flows through</p>
              </div>
            )}
          </div>

          {/* Income fields */}
          <div className="grid grid-cols-2 gap-3">
            <EntryField
              label="K-1 Ordinary Income (your share)"
              value={entry.ordinaryIncome}
              onChange={v => onChange(entry.id, "ordinaryIncome", v)}
              placeholder="0.00"
            />
            <EntryField
              label="K-1 Other Income (your share)"
              value={entry.otherIncome}
              onChange={v => onChange(entry.id, "otherIncome", v)}
              placeholder="0.00"
            />
          </div>

          {/* IL-only state taxes add-back */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
            <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700">Illinois Adjustment Only</p>
            <EntryField
              label="State Taxes Deducted in Arriving at Income (entity-level)"
              value={entry.stateTaxesDeducted ?? ""}
              onChange={v => onChange(entry.id, "stateTaxesDeducted", v)}
              placeholder="0.00"
            />
            <p className="text-[10px] text-amber-600">
              Added back to full entity income for IL PTE / replacement tax only. Does not affect federal AGI.
            </p>
          </div>

          {pct > 0 && (
            <div className="text-[11px] text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
              Entity income used for IL entity tax:{" "}
              <span className="font-bold">
                {(() => {
                  const k1 = (Number(entry.ordinaryIncome) || 0) + (Number(entry.otherIncome) || 0);
                  const stateTaxes = Number(entry.stateTaxesDeducted) || 0;
                  const entityBase = pct < 100 ? k1 / (pct / 100) : k1;
                  const total = entityBase + stateTaxes;
                  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
                  if (pct < 100 && stateTaxes > 0) return `K-1 ÷ ${pct}% + ${fmt(stateTaxes)} state taxes = ${fmt(total)}`;
                  if (pct < 100) return k1 > 0 ? `K-1 ÷ ${pct}% = ${fmt(entityBase)}` : "$0";
                  if (stateTaxes > 0) return `K-1 + ${fmt(stateTaxes)} state taxes = ${fmt(total)}`;
                  return "Same as K-1 (100% owner)";
                })()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reusable $ input field ────────────────────────────────────────────────────
function EntryField({
  label, value, onChange, placeholder,
}: {
  label: string; value: string | number; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{label}</p>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-9 pl-6 pr-2 text-sm font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 text-slate-800"
        />
      </div>
    </div>
  );
}
