import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  computeSCorpComparison,
  FilingStatus,
  ADDL_MED_THRESHOLD,
  IL_EXEMPTION_2026,
  QBI_PARAMS_2026,
  WAGE_BASE_2026,
} from "./scorpCalculations";

// ─── Colour constants ─────────────────────────────────────────────────────────
const NAVY        = [26, 32, 53]      as [number, number, number];
const GOLD        = [168, 124, 25]    as [number, number, number];
const WHITE       = [255, 255, 255]   as [number, number, number];
const LIGHT_GRAY  = [248, 249, 251]   as [number, number, number];
const TEXT_DARK   = [30, 35, 50]      as [number, number, number];
const TEXT_MED    = [90, 100, 120]    as [number, number, number];
const GREEN       = [22, 163, 74]     as [number, number, number];
const AMBER_BG    = [254, 243, 199]   as [number, number, number];
const AMBER_BORDER = [217, 119, 6]   as [number, number, number];
const SUBTOTAL_BG = [240, 243, 248]   as [number, number, number];

const LOGO_URL = "/" + "images/logo.png";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SCorpPdfInput {
  clientName: string;
  grossIncome: number;
  salary: number;
  costToFile1120S: number;
  costToProcessPayroll: number;
  filingStatus: FilingStatus;
  isSstb: boolean;
  materialParticipation: boolean;
  // D-11 optional
  sehiSchedC: number;
  retirementSchedC: number;
  shareholderHI: number;
  retirementER: number;
  otherIncome: number;
  netCapitalGain: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Returns the label that accurately describes which §199A limitation
 * actually bound in a given column. Per Fix 1 spec logic.
 */

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateSCorpPdf(inputs: SCorpPdfInput): Promise<void> {
  const {
    clientName, grossIncome, salary,
    costToFile1120S, costToProcessPayroll,
    filingStatus: fs, isSstb, materialParticipation,
    sehiSchedC, retirementSchedC, shareholderHI, retirementER,
    otherIncome, netCapitalGain,
  } = inputs;

  // ── Shared calculation engine ────────────────────────────────────────────
  const r = computeSCorpComparison({
    grossIncome, salary,
    costFile: costToFile1120S, costPayroll: costToProcessPayroll,
    filingStatus: fs, isSstb, materialParticipation,
    sehiSchedC, retirementSchedC, shareholderHI, retirementER,
    otherIncome, netCapitalGain,
  });

  const fsLabel   = fs === "mfj" ? "Married Filing Jointly" : "Single";
  const amtThresh = ADDL_MED_THRESHOLD[fs];
  const ilExemp   = IL_EXEMPTION_2026[fs];

  // ── PDF setup ────────────────────────────────────────────────────────────
  const doc      = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const pageW    = doc.internal.pageSize.getWidth();
  const pageH    = doc.internal.pageSize.getHeight();
  const margin   = 28;               // tighter margins
  const contentW = pageW - margin * 2;
  let y = 0;

  // Row display helpers — detail rows: value only; subtotal rows: value + short note
  const $ = (val: number) => val === 0 ? "—" : fmt(val);
  const d = (val: number) => val === 0 ? "—" : `(${fmt(val)})`;
  const withNote = (val: number, note: string) =>
    val === 0 ? "—" : `${fmt(val)}\n${note}`;
  const negNote = (val: number, note: string) =>
    val === 0 ? "—" : `(${fmt(val)})\n${note}`;
  const na = "—";

  function drawFooter() {
    const footerY = pageH - 22;
    doc.setFillColor(...NAVY);
    doc.rect(0, footerY, pageW, 22, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...WHITE);
    doc.text(
      "Shaqildi CPA Group  |  Confidential — Prepared for client use only. Estimates only; consult your tax professional before any election.",
      margin, footerY + 9
    );
    doc.text(
      `Page ${(doc as any).internal.getNumberOfPages()}`,
      pageW - margin, footerY + 9, { align: "right" }
    );
  }

  // ── HEADER ───────────────────────────────────────────────────────────────
  const headerH = 50;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, headerH, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, headerH, pageW, 3, "F");

  // Logo white pill
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin - 3, 7, 186, 36, 4, 4, "F");

  const logoData = await loadImageAsBase64(LOGO_URL);
  if (logoData) {
    try { doc.addImage(logoData, "PNG", margin, 9, 180, 32, undefined, "NONE"); }
    catch {
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY);
      doc.text("Shaqildi CPA Group", margin + 4, 30);
    }
  } else {
    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY);
    doc.text("Shaqildi CPA Group", margin + 4, 30);
  }

  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
  doc.text("S CORP vs SCHEDULE C ANALYSIS", pageW - margin, 24, { align: "right" });
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 190, 210);
  doc.text(
    `Prepared: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    pageW - margin, 38, { align: "right" }
  );

  y = headerH + 3 + 7;

  // ── CLIENT INFO BAR ──────────────────────────────────────────────────────
  const clientBarH = 24;
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, contentW, clientBarH, 4, 4, "F");
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEXT_DARK);
  doc.text(`S Corp Analysis — ${clientName}`, margin + 10, y + 10);
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...TEXT_MED);
  doc.text(
    `2026 Federal (Rev. Proc. 2025-32 / OBBBA)  |  ${fsLabel}  |  Illinois State`,
    margin + 10, y + 20
  );
  y += clientBarH + 6;

  // ── INPUT SUMMARY ────────────────────────────────────────────────────────
  const secH = 14;
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, secH, "F");
  doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
  doc.text("Input Summary", margin + 6, y + 9.5);
  y += secH;

  const inputRows: string[][] = [
    ["Gross Business Income", fmt(grossIncome),
     "Reasonable Salary (S Corp)", fmt(salary)],
    ["Filing Status", fsLabel,
     "SSTB", !isSstb
       ? "No"
       : (r.schedCTiPreQbi > QBI_PARAMS_2026[fs].threshold || r.sCorpTiPreQbi > QBI_PARAMS_2026[fs].threshold)
         ? "Yes — QBI phase-out applies"
         : "Yes — no limitation at this income level"],
    ["Cost to File 1120S", fmt(costToFile1120S),
     "Cost to Process Payroll", fmt(costToProcessPayroll)],
  ];
  if (sehiSchedC > 0 || retirementSchedC > 0) {
    inputRows.push([
      "SEHI (Sch C §162(l))", sehiSchedC > 0 ? fmt(sehiSchedC) : "—",
      "Retirement (Sch C §404)", retirementSchedC > 0 ? fmt(retirementSchedC) : "—",
    ]);
  }
  if (shareholderHI > 0 || retirementER > 0) {
    inputRows.push([
      "Shareholder Health Ins (§1372)", shareholderHI > 0 ? fmt(shareholderHI) : "—",
      "Employer Retirement (§404)", retirementER > 0 ? fmt(r.retirementERCapped) + (r.retirementERCapped < retirementER ? "*" : "") : "—",
    ]);
  }
  if (otherIncome > 0 || netCapitalGain > 0) {
    inputRows.push([
      "Other Household Income", otherIncome > 0 ? fmt(otherIncome) : "—",
      "Net Capital Gain", netCapitalGain > 0 ? fmt(netCapitalGain) : "—",
    ]);
  }

  autoTable(doc, {
    startY: y, margin: { left: margin, right: margin }, tableWidth: contentW,
    body: inputRows,
    styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK },
    columnStyles: {
      0: { cellWidth: "auto", textColor: TEXT_MED },
      1: { cellWidth: 72, halign: "right", fontStyle: "bold" },
      2: { cellWidth: "auto", textColor: TEXT_MED },
      3: { cellWidth: 72, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [252, 252, 254] },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── TAX COMPARISON TABLE ─────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, secH, "F");
  doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
  doc.text("Tax Comparison — Schedule C vs S Corporation (2026)", margin + 6, y + 9.5);
  y += secH;

  // Build rows — detail rows: value only; subtotal/summary rows: value + note
  const tableRows: string[][] = [];

  // Entity waterfall
  tableRows.push(["Gross Business Income",            $(grossIncome),             $(grossIncome)]);
  tableRows.push(["  Owner Salary (FICA wage base)",  na,                         d(salary)]);
  tableRows.push(["  Employer FICA (7.65%)",          na,                         d(r.erFica)]);
  tableRows.push(["  FUTA",                           na,                         d(r.futa)]);
  tableRows.push(["  SUTA (IL est.)",                 na,                         d(r.suta)]);
  tableRows.push(["  Admin Costs (IRC 162)",          na,                         r.adminCosts > 0 ? d(r.adminCosts) : "—"]);
  if (shareholderHI > 0)    tableRows.push(["  Shareholder Health Ins (§1372)", na, negNote(shareholderHI, "Entity deduction; Box 1 gross-up, not FICA")]);
  if (r.retirementERCapped > 0) tableRows.push(["  Employer Retirement (§404)", na, d(r.retirementERCapped)]);
  tableRows.push(["  IL Replacement Tax (1.5%)",      na,                         d(r.stateEntityTax)]);

  tableRows.push([
    "K-1 / Pass-Through Income",
    withNote(grossIncome, "All profit flows through"),
    withNote(r.k1OrdinaryIncome, "After entity costs & IL repl. tax"),
  ]);

  // Individual tax
  tableRows.push(["  Self-Employment Tax",            d(r.seTax),                 na]);
  if (r.addlMedicareSE > 0)
    tableRows.push(["  Add'tl Medicare Tax 0.9% (§1401(b)(2))",
      negNote(r.addlMedicareSE, `SE above $${(amtThresh/1000).toFixed(0)}k`), na]);
  if (r.addlMedicareEE > 0)
    tableRows.push(["  Add'tl Medicare Tax 0.9% (§3101(b)(2))", na,
      negNote(r.addlMedicareEE, `Salary above $${(amtThresh/1000).toFixed(0)}k`)]);
  tableRows.push(["  164(f) SE Deduction",            d(r.seDeduction),            na]);
  tableRows.push(["  Employee FICA",                  na,                          d(r.eeFica)]);
  if (shareholderHI > 0) {
    tableRows.push(["  W-2 Box 1 Wages",              na,                            $(r.w2Box1)]);
    tableRows.push(["  SEHI Deduction (§162(l))",     na,                            negNote(r.sCorpSehiDed, "Rev. Rul. 91-26; capped at W-2")]);
  }
  if (sehiSchedC > 0)        tableRows.push(["  SEHI Deduction (§162(l))",   d(sehiSchedC), na]);
  if (retirementSchedC > 0) tableRows.push(["  Retirement Deduction (§404)", d(retirementSchedC), na]);
  if (otherIncome > 0)       tableRows.push(["  Other Household Income",      $(otherIncome), $(otherIncome)]);

  tableRows.push([
    "Adjusted Gross Income (AGI)",
    $(r.schedCAgi), $(r.sCorpAgi),
  ]);
  tableRows.push(["  Standard Deduction (OBBBA 2026)",  d(r.stdDed),              d(r.stdDed)]);
  tableRows.push([
    `  QBI Base (§199A${isSstb ? " · SSTB" : ""})`,
    $(r.schedCQbi), $(r.sCorpQbi),
  ]);
  tableRows.push([
    "  QBI Deduction (§199A)",
    negNote(r.schedCQbiDed, r.schedCQbiLabel),
    negNote(r.sCorpQbiDed, r.sCorpQbiLabel),
  ]);

  tableRows.push([
    "Federal Taxable Income",
    $(r.schedCTaxableIncome), $(r.sCorpTaxableIncome),
  ]);
  tableRows.push([
    "Federal Income Tax",
    $(r.schedCFedTax),
    $(r.sCorpFedTax),
  ]);
  tableRows.push([
    "IL Individual Income Tax (4.95%)",
    $(r.schedCStateTax),
    $(r.sCorpStateTax),
  ]);
  tableRows.push(["TOTAL TAX BURDEN",         fmt(r.schedCTotal), fmt(r.sCorpTotal)]);
  tableRows.push([
    "ESTIMATED TAX SAVINGS", "",
    r.savings >= 0 ? fmt(r.savings) : `(${fmt(Math.abs(r.savings))})`,
  ]);

  const totalRowIdx   = tableRows.length - 2;
  const savingsRowIdx = tableRows.length - 1;

  const subtotalLabels = new Set(["K-1 / Pass-Through Income", "Adjusted Gross Income (AGI)", "Federal Taxable Income"]);

  autoTable(doc, {
    startY: y, margin: { left: margin, right: margin }, tableWidth: contentW,
    head: [["", "Schedule C  (Sole Proprietor)", "S Corporation"]],
    body: tableRows,
    styles: { fontSize: 6.5, cellPadding: 1.8, textColor: TEXT_DARK, valign: "top" },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 148 },
      1: { halign: "right", cellWidth: "auto" },
      2: { halign: "right", cellWidth: "auto" },
    },
    alternateRowStyles: { fillColor: [252, 252, 254] },
    rowPageBreak: "avoid",
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const idx  = data.row.index;
      const lbl  = (data.row.raw as string[])[0] ?? "";
      const isSubtotal = subtotalLabels.has(lbl);

      if (isSubtotal || idx === totalRowIdx) {
        data.cell.styles.fontStyle  = "bold";
        data.cell.styles.fillColor  = SUBTOTAL_BG;
        data.cell.styles.cellPadding = { top: 2.5, bottom: 2.5, left: 1.8, right: 1.8 };
      }
      if (idx === savingsRowIdx) {
        data.cell.styles.fontStyle  = "bold";
        data.cell.styles.fillColor  = (r.savings >= 0 ? [236, 253, 245] : [254, 242, 242]) as [number, number, number];
        if (data.column.index === 2) {
          data.cell.styles.textColor = (r.savings >= 0 ? GREEN : [220, 38, 38]) as [number, number, number];
          data.cell.styles.fontSize  = 9;
        }
      }
      // Dim detail-row labels
      if (data.column.index === 0 && lbl.startsWith("  ")) {
        data.cell.styles.textColor = TEXT_MED;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── SAVINGS CALLOUT (inline, no separate box — saves vertical space) ──────
  const savingsBg   = (r.savings >= 0 ? [236, 253, 245] : [254, 242, 242]) as [number, number, number];
  const savingsLine = (r.savings >= 0 ? GREEN : [220, 38, 38])              as [number, number, number];
  const calloutH = 30;
  doc.setFillColor(...savingsBg);
  doc.roundedRect(margin, y, contentW, calloutH, 3, 3, "F");
  doc.setDrawColor(...savingsLine); doc.setLineWidth(1);
  doc.roundedRect(margin, y, contentW, calloutH, 3, 3, "S");
  doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEXT_DARK);
  doc.text(
    r.savings >= 0 ? "ESTIMATED ANNUAL SAVINGS WITH S CORP ELECTION" : "ADDITIONAL COST WITH S CORP ELECTION",
    margin + 8, y + 11
  );
  doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...TEXT_MED);
  doc.text("Schedule C burden minus S Corp burden  |  All taxes included; premiums & retirement excluded", margin + 8, y + 23);
  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(...savingsLine);
  doc.text(
    r.savings >= 0 ? fmt(r.savings) : `(${fmt(Math.abs(r.savings))})`,
    pageW - margin - 8, y + 22, { align: "right" }
  );
  y += calloutH + 5;

  // ── S CORP CONSIDERATIONS ────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, secH, "F");
  doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
  doc.text("S-Corporation Considerations (Beyond Tax Savings)", margin + 6, y + 9.5);
  y += secH;

  autoTable(doc, {
    startY: y, margin: { left: margin, right: margin }, tableWidth: contentW,
    body: [
      [
        "COMPLIANCE & IRS SCRUTINY\n• Reasonable compensation must be documented\n• Increased IRS review vs. sole proprietor\n• Distributions may be reclassified as wages",
        "RETIREMENT PLANNING IMPACT\n• Employer contribution capped at 25% of W-2\n• Lower salary reduces contribution limits\n• Differential can exceed total FICA savings",
        "PAYROLL & ADMIN REQUIREMENTS\n• Regular payroll required\n• Ongoing 941s, W-2s, state payroll filings\n• Additional systems and coordination",
      ],
      [
        "FRINGE BENEFIT LIMITATIONS\n• 2% shareholders excluded from §125 plans\n• Health ins. via §1372 / Form W-2\n• Benefits require separate planning",
        "SHAREHOLDER BASIS TRACKING\n• Annual stock & debt basis (Form 7203)\n• Losses limited to available basis\n• Distributions taxable if basis is low",
        "OWNERSHIP & STRUCTURAL RULES\n• U.S. individual shareholders only\n• Maximum 100 shareholders\n• One class of stock requirement",
      ],
    ],
    styles: {
      fontSize: 6, cellPadding: 2.5, textColor: TEXT_DARK, valign: "top",
      lineColor: [220, 225, 235] as [number, number, number], lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [250, 251, 254] },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ── ADVISORY BOX ─────────────────────────────────────────────────────────
  const assumption = [
    `2026 constants: SS wage base $${WAGE_BASE_2026.toLocaleString()} (SSA) | Std deduction $${r.stdDed.toLocaleString()} (OBBBA / Rev. Proc. 2025-32) | IL 4.95% flat | IL repl. tax 1.5% | IL SUTA 3.175% new-employer. UBIA assumed $0.`,
    `Add'tl Medicare Tax (§3101(b)(2)/§1401(b)(2)): $200k single / $250k MFJ threshold (statutory, not indexed). ${materialParticipation ? "OBBBA $400 QBI floor applied." : ""}`,
    `Total burden excludes health insurance premiums and retirement contributions. These are NOT neutral between the two structures. Health premiums avoid FICA in an S corporation (§1372; Rev. Rul. 91-26) but are subject to SE tax under a Schedule C. Retirement contribution capacity is generally lower in an S corporation because the employer contribution is capped at 25% of W-2 wages. Both effects should be modeled separately.`,
  ].join("  ");

  doc.setFontSize(6.5);
  const splitLines = doc.splitTextToSize(assumption, contentW - 18);
  const lineH      = 9;
  const boxH       = 10 + splitLines.length * lineH + 8;

  if (y + boxH > pageH - 22 - 3) {
    doc.addPage();
    drawFooter();
    y = margin;
  }

  doc.setFillColor(...AMBER_BG);
  doc.roundedRect(margin, y, contentW, boxH, 3, 3, "F");
  doc.setDrawColor(...AMBER_BORDER); doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, contentW, boxH, 3, 3, "S");
  doc.setFont("helvetica", "bold"); doc.setTextColor(120, 60, 0);
  doc.text("Assumptions & Advisory:", margin + 8, y + 9);
  doc.setFont("helvetica", "normal");
  doc.text(splitLines, margin + 8, y + 18, { lineHeightFactor: 1.3 });

  // ── FOOTER & SAVE ────────────────────────────────────────────────────────
  drawFooter();
  const safeName = clientName.replace(/[^a-z0-9]/gi, "_") || "Client";
  doc.save(`${safeName}_SCorpAnalysis_2026.pdf`);
}
