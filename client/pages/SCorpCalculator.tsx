import React, { useState, useMemo } from "react";
import { Calculator, Download, FileText, AlertCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { generateSCorpPdf } from "@/lib/generateSCorpPdf";
import {
  computeSCorpComparison,
  FilingStatus,
  STANDARD_DEDUCTION_2026,
  IL_EXEMPTION_2026,
  SECTION_415_LIMIT,
  ADDL_MED_THRESHOLD,
  WAGE_BASE_2026,
} from "@/lib/scorpCalculations";

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseDollar(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : Math.max(0, n);
}

// ─── Table Cell Components ────────────────────────────────────────────────────

interface CellProps {
  value?: number;
  formula?: string;
  isNA?: boolean;
  bold?: boolean;
  highlight?: "green" | "red";
  negative?: boolean;
}

function ResultCell({ value = 0, formula, isNA, bold, highlight, negative }: CellProps) {
  if (isNA) return <td className="px-4 py-2.5 text-right text-slate-300 text-sm">—</td>;

  const colorClass =
    highlight === "green" ? "text-emerald-700 font-bold" :
    highlight === "red"   ? "text-red-600 font-bold" :
    bold                  ? "text-slate-900 font-semibold" :
    negative              ? "text-slate-500" :
    "text-slate-800";

  const display = negative && value !== 0 ? `(${formatCurrency(value)})` : value === 0 && negative ? "—" : formatCurrency(value);

  return (
    <td className="px-4 py-2.5 text-right text-sm">
      <div className={`${highlight ? "text-xl font-extrabold" : bold ? "text-base font-semibold" : "text-sm"} ${colorClass}`}>
        {display}
      </div>
      {formula && <div className="text-[10px] text-slate-400 font-normal mt-0.5 leading-tight">{formula}</div>}
    </td>
  );
}

function SectionRow({ label }: { label: string }) {
  return (
    <tr className="bg-[#1a2035]">
      <td colSpan={3} className="px-4 py-1.5 text-[11px] font-semibold text-slate-300 tracking-wider uppercase">
        {label}
      </td>
    </tr>
  );
}

function SubtotalRow({ label, schedC, sCorp }: { label: string; schedC: number; sCorp: number }) {
  return (
    <tr className="bg-slate-100/80 border-t border-slate-200">
      <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">{label}</td>
      <td className="px-4 py-2.5 text-right font-semibold text-slate-800 text-sm">{formatCurrency(schedC)}</td>
      <td className="px-4 py-2.5 text-right font-semibold text-slate-800 text-sm">{formatCurrency(sCorp)}</td>
    </tr>
  );
}

// ─── Dollar Input ─────────────────────────────────────────────────────────────

function DollarInput({
  id, placeholder = "0.00", value, onChange, warn,
}: { id: string; placeholder?: string; value: string; onChange: (v: string) => void; warn?: boolean }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pl-7 ${warn ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SCorpCalculator() {
  // ── Core inputs ──
  const [clientName,     setClientName]     = useState("");
  const [grossIncomeStr, setGrossIncomeStr] = useState("");
  const [salaryStr,      setSalaryStr]      = useState("");
  const [costFileStr,    setCostFileStr]    = useState("");
  const [costPayrollStr, setCostPayrollStr] = useState("");
  const [filingStatus,   setFilingStatus]   = useState<FilingStatus>("single");
  const [isSstb,         setIsSstb]         = useState(false);
  const [materialPart,   setMaterialPart]   = useState(true);

  // ── D-11 optional deductions ──
  const [sehiSchedCStr,      setSehiSchedCStr]      = useState("");
  const [retirementSchedCStr,setRetirementSchedCStr] = useState("");
  const [shareholderHIStr,   setShareholderHIStr]   = useState("");
  const [retirementERStr,    setRetirementERStr]    = useState("");
  const [otherIncomeStr,     setOtherIncomeStr]     = useState("");
  const [netCapGainStr,      setNetCapGainStr]      = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExporting,  setIsExporting]  = useState(false);

  // ── Parsed values ──
  const grossIncome        = parseDollar(grossIncomeStr);
  const salaryRaw          = parseDollar(salaryStr);
  const salary             = Math.min(salaryRaw, grossIncome);
  const salaryExceedsIncome = salaryRaw > grossIncome && grossIncome > 0;
  const costFile           = parseDollar(costFileStr);
  const costPayroll        = parseDollar(costPayrollStr);
  const sehiSchedC         = parseDollar(sehiSchedCStr);
  const retirementSchedC   = parseDollar(retirementSchedCStr);
  const shareholderHI      = parseDollar(shareholderHIStr);
  const retirementER       = parseDollar(retirementERStr);
  const otherIncome        = parseDollar(otherIncomeStr);
  const netCapGain         = parseDollar(netCapGainStr);

  // Helper text: approximate Schedule C retirement cap
  const approxSchedCRetirementCap = useMemo(() => {
    const seBase = grossIncome * 0.9235;
    const seSs = Math.min(seBase, WAGE_BASE_2026) * 0.124;
    const seMed = seBase * 0.029;
    const seDeduction = (seSs + seMed) / 2;
    const netSE = Math.max(0, grossIncome - seDeduction - sehiSchedC);
    return Math.min(netSE * 0.20, SECTION_415_LIMIT);
  }, [grossIncome, sehiSchedC]);

  const retirementERCapDisplay = salary * 0.25;
  const retirementERExceedsCap = retirementER > retirementERCapDisplay && salary > 0;

  const r = useMemo(() =>
    computeSCorpComparison({
      grossIncome, salary, costFile, costPayroll,
      filingStatus, isSstb, materialParticipation: materialPart,
      sehiSchedC, retirementSchedC, shareholderHI, retirementER,
      otherIncome, netCapitalGain: netCapGain,
    }),
    [grossIncome, salary, costFile, costPayroll, filingStatus, isSstb, materialPart,
     sehiSchedC, retirementSchedC, shareholderHI, retirementER, otherIncome, netCapGain]
  );

  const hasInputs = grossIncome > 0 && salary > 0;
  const fs = filingStatus;
  const fc = formatCurrency;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await generateSCorpPdf({
        clientName: clientName || "Client",
        grossIncome, salary: salary,
        costToFile1120S: costFile, costToProcessPayroll: costPayroll,
        filingStatus, isSstb, materialParticipation: materialPart,
        sehiSchedC, retirementSchedC, shareholderHI, retirementER,
        otherIncome, netCapitalGain: netCapGain,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
            {clientName ? `S Corp Analysis — ${clientName}` : "S Corp Calculator"}
          </h1>
          <p className="text-muted-foreground">
            Compare Schedule C (sole proprietor) vs S Corporation — 2026 federal &amp; Illinois taxes.
          </p>
        </div>
        {hasInputs && (
          <Button onClick={handleExport} disabled={isExporting}
            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 shrink-0">
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Generating PDF..." : "Export to PDF"}
          </Button>
        )}
      </div>

      {/* Input Card */}
      <Card className="border-border/60 shadow-sm mb-8">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="w-4 h-4 text-primary" />
            Client Inputs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1: Name + Filing Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Client Name</Label>
              <Input placeholder="e.g. John Smith" value={clientName}
                onChange={(e) => setClientName(e.target.value)} className="max-w-sm" />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Filing Status</Label>
              <div className="flex rounded-md border border-input overflow-hidden">
                {(["single", "mfj"] as FilingStatus[]).map((s) => (
                  <button key={s} onClick={() => setFilingStatus(s)}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      filingStatus === s ? "bg-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {s === "single" ? "Single" : "Married Filing Jointly"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Income + Salary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <Label htmlFor="gross" className="text-sm font-medium text-slate-700 mb-1.5 block">
                Gross Business Income / Net Profit
              </Label>
              <DollarInput id="gross" value={grossIncomeStr} onChange={setGrossIncomeStr} />
            </div>

            <div>
              <Label htmlFor="salary" className="text-sm font-medium text-slate-700 mb-1.5 block">
                Reasonable Salary (S Corp) <span className="text-red-500">*</span>
              </Label>
              <DollarInput id="salary" placeholder="Required — facts &amp; circumstances"
                value={salaryStr} onChange={setSalaryStr} warn={salaryExceedsIncome} />
              {salaryExceedsIncome && (
                <div className="flex items-center gap-1.5 mt-1.5 text-amber-600 text-[11px]">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Capped at {fc(grossIncome)}
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                IRC 3121(d)(1) — must reflect facts &amp; circumstances; no safe-harbor percentage.
              </p>
            </div>

            <div>
              <Label htmlFor="costFile" className="text-sm font-medium text-slate-700 mb-1.5 block">
                Cost to File 1120S Return
              </Label>
              <DollarInput id="costFile" value={costFileStr} onChange={setCostFileStr} />
            </div>

            <div>
              <Label htmlFor="costPayroll" className="text-sm font-medium text-slate-700 mb-1.5 block">
                Cost to Process Payroll (Annual)
              </Label>
              <DollarInput id="costPayroll" value={costPayrollStr} onChange={setCostPayrollStr} />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <input id="sstb" type="checkbox" checked={isSstb} onChange={(e) => setIsSstb(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary cursor-pointer" />
              <div>
                <label htmlFor="sstb" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Specified Service Trade or Business (SSTB)
                </label>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  IRC 199A(d)(2)(A): accounting, law, consulting, financial services, etc. QBI phases out above income threshold.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <input id="matpart" type="checkbox" checked={materialPart} onChange={(e) => setMaterialPart(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary cursor-pointer" />
              <div>
                <label htmlFor="matpart" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Materially Participates (OBBBA §70201)
                </label>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Enables the 2026 OBBBA $400 QBI minimum floor when QBI ≥ $1,000.
                </p>
              </div>
            </div>
          </div>

          {/* Optional deductions toggle */}
          <div>
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showAdvanced ? "Hide" : "Show"} optional deductions &amp; adjustments (D-11)
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* SEHI – Schedule C */}
                <div>
                  <Label htmlFor="sehiSC" className="text-sm font-medium text-slate-700 mb-1.5 block">
                    SEHI Deduction — Schedule C (§162(l))
                  </Label>
                  <DollarInput id="sehiSC" value={sehiSchedCStr} onChange={setSehiSchedCStr} />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Reduces AGI and QBI base on the Schedule C side.
                  </p>
                </div>

                {/* Retirement – Schedule C */}
                <div>
                  <Label htmlFor="retSC" className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Retirement Deduction — Schedule C (§404)
                  </Label>
                  <DollarInput id="retSC" value={retirementSchedCStr} onChange={setRetirementSchedCStr} />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Solo 401(k)/SEP — reduces AGI &amp; QBI base.
                    Approx. cap: {fc(approxSchedCRetirementCap)} (~20% net SE, §415 limit {fc(SECTION_415_LIMIT)}).
                  </p>
                </div>

                {/* Shareholder Health Ins – S Corp */}
                <div>
                  <Label htmlFor="shHI" className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Shareholder Health Insurance — S Corp (§1372)
                  </Label>
                  <DollarInput id="shHI" value={shareholderHIStr} onChange={setShareholderHIStr} />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Entity deducts premium → reduces K-1. Added to W-2 and deducted on 1040 (net AGI effect: zero).
                  </p>
                </div>

                {/* Retirement – S Corp */}
                <div>
                  <Label htmlFor="retER" className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Employer Retirement Contribution — S Corp (§404)
                  </Label>
                  <DollarInput id="retER" value={retirementERStr} onChange={setRetirementERStr}
                    warn={retirementERExceedsCap} />
                  {retirementERExceedsCap && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-amber-600 text-[11px]">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      Exceeds 25% cap ({fc(retirementERCapDisplay)}); calculation uses capped amount.
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    Reduces entity income (K-1). Cap: 25% × salary = {fc(retirementERCapDisplay)};
                    §415 limit {fc(SECTION_415_LIMIT)}.
                  </p>
                </div>

                {/* Other Income */}
                <div>
                  <Label htmlFor="otherInc" className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Other Household Income (Spouse W-2, etc.)
                  </Label>
                  <DollarInput id="otherInc" value={otherIncomeStr} onChange={setOtherIncomeStr} />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Added to AGI in both columns. Affects marginal rate and §199A TI cap.
                  </p>
                </div>

                {/* Net Capital Gain */}
                <div>
                  <Label htmlFor="capGain" className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Net Capital Gain (§199A TI cap adjustment)
                  </Label>
                  <DollarInput id="capGain" value={netCapGainStr} onChange={setNetCapGainStr} />
                  <p className="text-[10px] text-slate-400 mt-1">
                    §199A(a)(1)(B): QBI deduction capped at 20% × (TI minus net cap gains).
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasInputs && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Calculator className="w-4 h-4 text-primary" />
              Tax Comparison — 2026 Federal &amp; Illinois
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a2035] text-white">
                  <th className="px-4 py-3 text-left font-semibold text-sm w-60">Line Item</th>
                  <th className="px-4 py-3 text-right font-semibold text-sm">
                    Schedule C<br /><span className="text-[11px] font-normal text-slate-300">Sole Proprietor / SMLLC</span>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-sm">
                    S Corporation<br /><span className="text-[11px] font-normal text-slate-300">Entity Election</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">

                {/* ── Entity Waterfall ── */}
                <SectionRow label="Entity Income Waterfall" />

                <tr className="bg-white hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-700">Gross Business Income</td>
                  <ResultCell value={grossIncome} formula="Net profit before owner comp" />
                  <ResultCell value={grossIncome} formula="Net profit before owner comp" />
                </tr>

                <tr className="bg-slate-50/40">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Owner Salary (FICA wage base)</td>
                  <ResultCell isNA />
                  <ResultCell value={salary} formula="Reasonable compensation — IRC 3121(d)(1); SS/Medicare base" negative />
                </tr>

                <tr className="bg-white hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Employer FICA (7.65%)</td>
                  <ResultCell isNA />
                  <ResultCell
                    value={r.erFica}
                    formula={`MIN(${fc(salary)}, $${WAGE_BASE_2026.toLocaleString()})×6.2% + ${fc(salary)}×1.45%`}
                    negative />
                </tr>

                <tr className="bg-slate-50/40">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">FUTA</td>
                  <ResultCell isNA />
                  <ResultCell value={r.futa} formula="MIN(salary, $7,000) × 0.6% (net of state credit)" negative />
                </tr>

                <tr className="bg-white hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">SUTA (IL est.)</td>
                  <ResultCell isNA />
                  <ResultCell value={r.suta} formula="MIN(salary, $13,590) × 3.175% — IL new-employer" negative />
                </tr>

                {r.adminCosts > 0 && (
                  <tr className="bg-slate-50/40">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Admin Costs (IRC 162)</td>
                    <ResultCell isNA />
                    <ResultCell value={r.adminCosts}
                      formula={`${fc(costFile)} 1120S + ${fc(costPayroll)} payroll`} negative />
                  </tr>
                )}

                {shareholderHI > 0 && (
                  <tr className="bg-white hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Shareholder Health Ins (§1372)</td>
                    <ResultCell isNA />
                    <ResultCell value={shareholderHI} formula="Entity deduction — reduces K-1; grossed into W-2 Box 1 (not Boxes 3/5)" negative />
                  </tr>
                )}

                {r.retirementERCapped > 0 && (
                  <tr className="bg-slate-50/40">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Employer Retirement (§404)</td>
                    <ResultCell isNA />
                    <ResultCell value={r.retirementERCapped}
                      formula={`≤ 25% × salary = ${fc(r.retirementERCap)}`} negative />
                  </tr>
                )}

                <tr className="bg-white hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">IL Replacement Tax (1.5%)</td>
                  <ResultCell isNA />
                  <ResultCell value={r.stateEntityTax}
                    formula={`${fc(r.entityIncomePreState)} × 1.5% (35 ILCS 5/201(c))`} negative />
                </tr>

                <SubtotalRow label="K-1 / Pass-Through Income"
                  schedC={grossIncome} sCorp={r.k1OrdinaryIncome} />

                {/* ── Individual Tax ── */}
                <SectionRow label="Individual Tax Computation" />

                <tr className="bg-white hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Self-Employment Tax</td>
                  <ResultCell value={r.seTax}
                    formula={`${fc(r.seSs)} SS + ${fc(r.seMedicare)} Medicare (SE base: ${fc(r.seBase)})`}
                    negative />
                  <ResultCell isNA />
                </tr>

                {r.addlMedicareSE > 0 && (
                  <tr className="bg-slate-50/40">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Add'tl Medicare Tax (§3101(b)(2) / §1401(b)(2)) — 0.9%</td>
                    <ResultCell value={r.addlMedicareSE}
                      formula={`SE base above $${(ADDL_MED_THRESHOLD[fs] / 1000).toFixed(0)}k threshold`} negative />
                    <ResultCell isNA />
                  </tr>
                )}

                {r.addlMedicareEE > 0 && (
                  <tr className="bg-slate-50/40">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Add'tl Medicare Tax (§3101(b)(2)) — 0.9%</td>
                    <ResultCell isNA />
                    <ResultCell value={r.addlMedicareEE}
                      formula={`Salary above $${(ADDL_MED_THRESHOLD[fs] / 1000).toFixed(0)}k — employee side only`} negative />
                  </tr>
                )}

                <tr className="bg-white hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">164(f) SE Deduction</td>
                  <ResultCell value={r.seDeduction}
                    formula={`${fc(r.seTax)} ÷ 2 — above-the-line, reduces AGI & QBI`} negative />
                  <ResultCell isNA />
                </tr>

                <tr className="bg-slate-50/40">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Employee FICA</td>
                  <ResultCell isNA />
                  <ResultCell value={r.eeFica}
                    formula={`MIN(${fc(salary)}, $${WAGE_BASE_2026.toLocaleString()})×6.2% + ${fc(salary)}×1.45%`} negative />
                </tr>

                {shareholderHI > 0 && (
                  <tr className="bg-slate-50/40">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">W-2 Box 1 Wages</td>
                    <ResultCell isNA />
                    <ResultCell value={r.w2Box1} formula={`Salary ${fc(salary)} + HI gross-up ${fc(shareholderHI)} — Box 1 only, not FICA base`} />
                  </tr>
                )}

                {shareholderHI > 0 && (
                  <tr className="bg-white hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">SEHI Deduction (§162(l))</td>
                    <ResultCell isNA />
                    <ResultCell value={r.sCorpSehiDed} formula="Above-the-line — capped at W-2 from S corp; Rev. Rul. 91-26" negative />
                  </tr>
                )}

                {sehiSchedC > 0 && (
                  <tr className="bg-white hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">SEHI Deduction — §162(l)</td>
                    <ResultCell value={sehiSchedC} formula="Reduces AGI & QBI base" negative />
                    <ResultCell isNA />
                  </tr>
                )}

                {retirementSchedC > 0 && (
                  <tr className="bg-slate-50/40">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Retirement — §404</td>
                    <ResultCell value={retirementSchedC} formula="Reduces AGI & QBI base" negative />
                    <ResultCell isNA />
                  </tr>
                )}

                {otherIncome > 0 && (
                  <tr className="bg-white hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Other Household Income</td>
                    <ResultCell value={otherIncome} formula="Spouse W-2, etc. — added to AGI" />
                    <ResultCell value={otherIncome} formula="Spouse W-2, etc. — added to AGI" />
                  </tr>
                )}

                <SubtotalRow label="Adjusted Gross Income (AGI)"
                  schedC={r.schedCAgi} sCorp={r.sCorpAgi} />

                <tr className="bg-white hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">Standard Deduction</td>
                  <ResultCell value={r.stdDed}
                    formula={`2026 ${fs === "mfj" ? "MFJ" : "Single"} — OBBBA`} negative />
                  <ResultCell value={r.stdDed}
                    formula={`2026 ${fs === "mfj" ? "MFJ" : "Single"} — OBBBA`} negative />
                </tr>

                <tr className="bg-slate-50/40">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">QBI Base (§199A)</td>
                  <ResultCell value={r.schedCQbi}
                    formula={`Profit − 164(f) − SEHI − retirement${isSstb ? " · SSTB" : ""}`} />
                  <ResultCell value={r.sCorpQbi}
                    formula={`K-1 only (W-2 wages excluded)${isSstb ? " · SSTB" : ""}`} />
                </tr>

                <tr className="bg-white hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-sm text-slate-600 pl-7">QBI Deduction (§199A)</td>
                  <ResultCell value={r.schedCQbiDed}
                    formula={r.schedCQbiLabel} negative />
                  <ResultCell value={r.sCorpQbiDed}
                    formula={r.sCorpQbiLabel} negative />
                </tr>

                <SubtotalRow label="Federal Taxable Income"
                  schedC={r.schedCTaxableIncome} sCorp={r.sCorpTaxableIncome} />

                <tr className="bg-white hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-700">Federal Income Tax</td>
                  <ResultCell value={r.schedCFedTax}
                    formula={`2026 brackets on ${fc(r.schedCTaxableIncome)}`} />
                  <ResultCell value={r.sCorpFedTax}
                    formula={`2026 brackets on ${fc(r.sCorpTaxableIncome)}`} />
                </tr>

                <tr className="bg-slate-50/40">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-700">IL Individual Income Tax</td>
                  <ResultCell value={r.schedCStateTax}
                    formula={`(${fc(r.schedCAgi)} AGI − ${fc(IL_EXEMPTION_2026[fs])} exemp.) × 4.95%`} />
                  <ResultCell value={r.sCorpStateTax}
                    formula={`(${fc(r.sCorpAgi)} AGI − ${fc(IL_EXEMPTION_2026[fs])} exemp.) × 4.95%`} />
                </tr>

                {/* ── Summary ── */}
                <SectionRow label="Summary" />

                <tr className="bg-[#1a2035]/5 border-t-2 border-slate-200">
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">
                    Total Tax Burden
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                      All taxes: income + payroll/SE + Add'tl Medicare + entity-level
                    </div>
                  </td>
                  <ResultCell value={r.schedCTotal}
                    formula="SE Tax + Add'tl Medicare + Federal + IL Individual" bold />
                  <ResultCell value={r.sCorpTotal}
                    formula="EE+ER FICA + Add'tl Medicare + FUTA + SUTA + IL Repl. + Federal + IL Individual + Admin" bold />
                </tr>

                <tr className={r.savings >= 0 ? "bg-emerald-50" : "bg-red-50"}>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">
                    Estimated Tax Savings
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">Schedule C Total − S Corp Total</div>
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right">
                    <div className={`text-2xl font-extrabold ${r.savings >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {r.savings >= 0 ? fc(r.savings) : `(${fc(Math.abs(r.savings))})`}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {r.savings >= 0
                        ? "Estimated annual savings with S Corp election"
                        : "S Corp costs more than Schedule C in this scenario"}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footnotes */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 space-y-1.5">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-500">2026 constants:</strong>{" "}
                  Federal brackets per Rev. Proc. 2025-32 &amp; OBBBA · SS wage base ${WAGE_BASE_2026.toLocaleString()} (SSA) ·
                  Standard deduction {fs === "mfj" ? `$${STANDARD_DEDUCTION_2026.mfj.toLocaleString()} MFJ` : `$${STANDARD_DEDUCTION_2026.single.toLocaleString()} Single`} (OBBBA / Rev. Proc. 2025-32) ·
                  Add'tl Medicare Tax (§3101(b)(2)/§1401(b)(2)) $200k single / $250k MFJ threshold (statutory, not indexed) ·
                  IL 4.95% flat rate · IL replacement tax 1.5% (35 ILCS 5/201(c)) ·
                  IL SUTA new-employer 3.175% on first $13,590.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-500">QBI deduction (§199A):</strong>{" "}
                  Lesser of (a) 20% of QBI and (b) wage/UBIA limitation above the income threshold
                  (UBIA assumed zero for service businesses), further limited to 20% of taxable income
                  determined <em>before</em> the QBI deduction per §199A(a)(1)(B).
                  {isSstb && " SSTB phase-out applies per Treas. Reg. 1.199A-5."}
                  {" "}OBBBA 2026 $400 floor applies when QBI ≥ $1,000 and materially participates.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-500">Total burden excludes:</strong>{" "}
                  Total burden excludes health insurance premiums and retirement contributions.
                  These are <strong>not neutral</strong> between the two structures. Health premiums avoid FICA in
                  an S corporation (§1372; Rev. Rul. 91-26) but are subject to SE tax under a Schedule C.
                  Retirement contribution capacity is generally lower in an S corporation because the employer
                  contribution is capped at 25% of W-2 wages. Both effects should be modeled separately.
                  UBIA assumed zero.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!hasInputs && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">Enter income and salary to see the comparison</h3>
          <p className="text-slate-400 max-w-sm mx-auto">
            Both <strong>Gross Business Income</strong> and <strong>Reasonable Salary</strong> are required.
            Salary must reflect facts and circumstances — there is no default formula.
          </p>
        </div>
      )}
    </div>
  );
}
