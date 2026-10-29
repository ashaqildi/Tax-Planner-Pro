import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Client, TaxSummary, EstimatedPayment, IncomeSource } from "@workspace/api-client-react";

interface W2Entry { id: string; label: string; wages: number; federalWithheld: number; stateWithheld: number; }
interface ScorpEntry { id: string; name: string; ownershipPct: number; ordinaryIncome: number; otherIncome: number; }

// Brand colors (matching the app theme)
const NAVY = [26, 32, 53] as [number, number, number];       // sidebar navy
const GOLD = [168, 124, 25] as [number, number, number];      // primary gold
const WHITE = [255, 255, 255] as [number, number, number];
const LIGHT_GRAY = [248, 249, 251] as [number, number, number];
const TEXT_DARK = [30, 35, 50] as [number, number, number];
const TEXT_MED = [90, 100, 120] as [number, number, number];
const GREEN = [22, 163, 74] as [number, number, number];
const RED = [220, 38, 38] as [number, number, number];
const AMBER = [217, 119, 6] as [number, number, number];

const LOGO_URL = "/" + "images/logo.png";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function filingStatusLabel(s: string): string {
  const map: Record<string, string> = {
    single: "Single",
    married_filing_jointly: "Married Filing Jointly",
    married_filing_separately: "Married Filing Separately",
    head_of_household: "Head of Household",
  };
  return map[s] ?? s;
}

const PAYMENT_LABELS: Record<string, string> = {
  federal_individual: "Federal (1040-ES)",
  state_individual: "Illinois Individual (IL-1040-ES)",
  state_business_pte: "Illinois PTE Tax (IL-1120-ST)",
  state_business_replacement: "Illinois Replacement Tax",
};

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateClientPdf(
  client: Client,
  summary: TaxSummary | undefined,
  payments: EstimatedPayment[],
  taxYear: number,
  incomeSources?: IncomeSource[]
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Helper to add a new page if needed ──────────────────────────────────
  function checkPageBreak(neededSpace: number) {
    if (y + neededSpace > pageH - 60) {
      doc.addPage();
      y = 50;
      drawFooter();
    }
  }

  // ── Footer (printed once per page at time of creation) ──────────────────
  function drawFooter() {
    const footerY = pageH - 28;
    doc.setFillColor(...NAVY);
    doc.rect(0, footerY, pageW, 28, "F");
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "normal");
    doc.text("Shaqildi CPA Group | Confidential - Prepared for client use only", margin, footerY + 10);
    doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, pageW - margin, footerY + 10, { align: "right" });
  }

  // ── HEADER BAND ─────────────────────────────────────────────────────────
  const headerH = 90;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, headerH, "F");

  // Gold accent bar
  doc.setFillColor(...GOLD);
  doc.rect(0, headerH, pageW, 4, "F");

  // White background pill for the logo (dark-on-white logo)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin - 4, 12, 188, 64, 5, 5, "F");

  // Try to load and embed the logo
  const logoData = await loadImageAsBase64(LOGO_URL);
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, 18, 176, 52, undefined, 'NONE');
    } catch {
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text("Shaqildi CPA Group", margin + 4, 52);
    }
  } else {
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text("Shaqildi CPA Group", margin + 4, 52);
  }

  // Right side — report title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("ESTIMATED TAX SUMMARY", pageW - margin, 35, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 190, 210);
  doc.text(`Tax Year ${taxYear}`, pageW - margin, 52, { align: "right" });
  doc.text(`Prepared: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, pageW - margin, 65, { align: "right" });

  y = headerH + 14;

  // ── CLIENT INFO BLOCK ───────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, contentW, 76, 6, 6, "F");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(client.name, margin + 16, y + 22);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MED);

  const col1x = margin + 16;
  const col2x = margin + contentW / 2;
  const infoY = y + 40;

  doc.text(`Filing Status: ${filingStatusLabel(client.filingStatus)}`, col1x, infoY);
  doc.text(`PTE Election: ${client.pteElection ? "Yes - Active" : "No"}`, col1x, infoY + 16);

  if (client.scorporationName) {
    doc.text(`S-Corporation: ${client.scorporationName}`, col2x, infoY);
    if (client.scorporationEin) {
      doc.text(`EIN: ${client.scorporationEin}`, col2x, infoY + 16);
    }
  }
  if (client.email) {
    doc.text(`Email: ${client.email}`, col2x, infoY + (client.scorporationName ? 32 : 0));
  }

  y += 76 + 20;

  // ── TAX SUMMARY TABLES ──────────────────────────────────────────────────
  if (summary) {
    // Use the deduction info already computed by the server and returned in summary
    const effectiveDeduction = (summary as any).federalDeduction ?? 0;
    const usingItemized = (summary as any).federalDeductionIsItemized ?? false;
    const deductionLabel = usingItemized ? "Less: Itemized Deductions" : "Less: Standard Deduction";

    // Section header
    function sectionHeader(title: string) {
      checkPageBreak(40);
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, contentW, 26, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WHITE);
      doc.text(title, margin + 10, y + 17);
      y += 26;
    }

    // ─ Federal Summary ─
    sectionHeader("Federal Income Tax Summary");

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      head: [["Line Item", "Amount"]],
      body: [
        ["Adjusted Gross Income (AGI)", fmt(summary.federalAgi)],
        [deductionLabel, `(${fmt(effectiveDeduction)})`],
        ...(((summary as any).federalQbiDeduction ?? 0) > 0
          ? [["Less: QBI Deduction (Section 199A, 20%)", `(${fmt((summary as any).federalQbiDeduction)})`]]
          : []),
        ["Federal Taxable Income", fmt(summary.federalTaxableIncome)],
        ["Estimated Tax Liability", fmt(summary.federalTaxLiability)],
        ["Safe Harbor Target (Prior Year)", fmt(summary.federalSafeHarbor)],
        ["Required Annual Estimated Payment", fmt(summary.federalRequiredAnnual)],
        ["Less: W-2 Federal Withholding", fmt(summary.federalWithheld)],
        ["Estimated Balance for Estimated Payments", fmt(summary.federalBalance)],
      ],
      styles: { fontSize: 9, cellPadding: 5, textColor: TEXT_DARK },
      headStyles: { fillColor: [240, 243, 248], textColor: TEXT_DARK, fontStyle: "bold", fontSize: 9 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      alternateRowStyles: { fillColor: [252, 252, 254] },
      rowPageBreak: "avoid",
      didParseCell: (data) => {
        if (data.row.index === 7 && data.column.index === 1) {
          data.cell.styles.textColor = summary.federalBalance > 0 ? RED : GREEN;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // ─ Illinois Individual ─
    checkPageBreak(160);
    sectionHeader("Illinois Individual Income Tax Summary (4.95% Flat Rate)");

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      head: [["Line Item", "Amount"]],
      body: [
        ["Illinois Base Income", fmt(summary.stateAgi)],
        ["Illinois Taxable Income (after exemption)", fmt(summary.stateTaxableIncome)],
        ["Gross IL Individual Tax (4.95%)", fmt(summary.stateTaxableIncome * 0.0495)],
        ...(summary.pteElection ? [["Less: PTE Credit (4.95% paid at entity level)", `(${fmt(summary.stateBusinessPteTax)})`]] : []),
        ["Net IL Individual Tax Liability", fmt(summary.stateIndividualTaxLiability)],
        ["Safe Harbor Target", fmt(summary.stateSafeHarbor)],
        ["Required Annual Estimated Payment", fmt(summary.stateRequiredAnnual)],
        ["Less: IL W-2 Withholding", fmt(summary.stateWithheld)],
        ["Estimated Balance for Estimated Payments", fmt(summary.stateBalance)],
      ],
      styles: { fontSize: 9, cellPadding: 5, textColor: TEXT_DARK },
      headStyles: { fillColor: [240, 243, 248], textColor: TEXT_DARK, fontStyle: "bold", fontSize: 9 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      alternateRowStyles: { fillColor: [252, 252, 254] },
      rowPageBreak: "avoid",
      didParseCell: (data) => {
        const lastIdx = summary.pteElection ? 8 : 7;
        if (data.row.index === lastIdx && data.column.index === 1) {
          data.cell.styles.textColor = summary.stateBalance > 0 ? RED : GREEN;
        }
        if (summary.pteElection && data.row.index === 3 && data.column.index === 1) {
          data.cell.styles.textColor = GREEN;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // ─ Illinois S-Corp Business Level ─
    if (summary.scorpPassthroughIncome > 0) {
      checkPageBreak(160);
      sectionHeader(`Illinois S-Corporation Business Level Tax${summary.pteElection ? " (PTE Elected)" : " (No PTE)"}`);

      const businessRows: string[][] = [
        ["S-Corp Pass-through Income (Ordinary + Other K-1)", fmt(summary.scorpPassthroughIncome)],
      ];
      if (summary.pteElection) {
        businessRows.push(
          ["PTE Tax (4.95%) - Paid at Entity Level", fmt(summary.stateBusinessPteTax)],
          ["Personal Property Replacement Tax (1.5%)", fmt(summary.stateBusinessReplacementTax)],
          ["Total Entity-Level Tax Due Annually", fmt(summary.stateBusinessPteTax + summary.stateBusinessReplacementTax)],
        );
      } else {
        businessRows.push(
          ["Personal Property Replacement Tax (1.5%) Only", fmt(summary.stateBusinessReplacementTax)],
          ["Note: Individual return bears the full 4.95% IL income tax", ""],
        );
      }

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentW,
        head: [["Line Item", "Amount"]],
        body: businessRows,
        styles: { fontSize: 9, cellPadding: 5, textColor: TEXT_DARK },
        headStyles: { fillColor: [240, 243, 248], textColor: TEXT_DARK, fontStyle: "bold", fontSize: 9 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        alternateRowStyles: { fillColor: [252, 252, 254] },
        rowPageBreak: "avoid",
      });
      y = (doc as any).lastAutoTable.finalY + 16;
    }

    // ─ Income Sources Detail ─
    const currentIncome = incomeSources?.find(i => i.taxYear === taxYear);
    if (currentIncome) {
      const w2Entries: W2Entry[] = (currentIncome as any).w2Entries ?? [];
      const scorpEntries: ScorpEntry[] = (currentIncome as any).scorpEntries ?? [];
      const hasW2Detail = w2Entries.length > 0;
      const hasScorpDetail = scorpEntries.length > 0;

      if (hasW2Detail || hasScorpDetail) {
        checkPageBreak(60);
        sectionHeader("Income Sources Detail");

        if (hasW2Detail) {
          const w2Total = w2Entries.reduce((s, e) => s + (Number(e.wages) || 0), 0);
          const fedTotal = w2Entries.reduce((s, e) => s + (Number(e.federalWithheld) || 0), 0);
          const ilTotal = w2Entries.reduce((s, e) => s + (Number(e.stateWithheld) || 0), 0);

          const w2Body: string[][] = w2Entries.map((e, idx) => [
            `W-2 #${idx + 1}${e.label ? `: ${e.label}` : ""}`,
            fmt(Number(e.wages) || 0),
            fmt(Number(e.federalWithheld) || 0),
            fmt(Number(e.stateWithheld) || 0),
          ]);
          if (w2Entries.length > 1) {
            w2Body.push(["TOTAL", fmt(w2Total), fmt(fedTotal), fmt(ilTotal)]);
          }

          checkPageBreak(40 + w2Body.length * 22);
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            tableWidth: contentW,
            head: [["W-2 Wages", "Box 1 Wages", "Box 2 Fed Withheld", "Box 17 IL Withheld"]],
            body: w2Body,
            styles: { fontSize: 9, cellPadding: 4.5, textColor: TEXT_DARK },
            headStyles: { fillColor: [235, 241, 252], textColor: TEXT_DARK, fontStyle: "bold", fontSize: 9 },
            columnStyles: {
              1: { halign: "right" },
              2: { halign: "right" },
              3: { halign: "right" },
            },
            alternateRowStyles: { fillColor: [252, 252, 254] },
            rowPageBreak: "avoid",
            didParseCell: (data) => {
              if (data.row.index === w2Body.length - 1 && w2Entries.length > 1 && data.section === "body") {
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.fillColor = [230, 238, 255];
              }
            },
          });
          y = (doc as any).lastAutoTable.finalY + 12;
        }

        if (hasScorpDetail) {
          const scorpBody: string[][] = scorpEntries.map((e, idx) => {
            const pct = Number(e.ownershipPct) || 100;
            const ordK1 = Number(e.ordinaryIncome) || 0;
            const othK1 = Number(e.otherIncome) || 0;
            const totalK1 = ordK1 + othK1;
            const entityTotal = pct < 100 && pct > 0 ? totalK1 / (pct / 100) : totalK1;
            return [
              `S-Corp #${idx + 1}${e.name ? `: ${e.name}` : ""}`,
              `${pct}%`,
              fmt(entityTotal),
              fmt(ordK1),
              fmt(othK1),
            ];
          });

          checkPageBreak(40 + scorpBody.length * 22);
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            tableWidth: contentW,
            head: [["S-Corp K-1 Entry", "Ownership %", "Entity Total Income", "K-1 Ordinary (Your Share)", "K-1 Other (Your Share)"]],
            body: scorpBody,
            styles: { fontSize: 9, cellPadding: 4.5, textColor: TEXT_DARK },
            headStyles: { fillColor: [237, 233, 254], textColor: TEXT_DARK, fontStyle: "bold", fontSize: 9 },
            columnStyles: {
              1: { halign: "center", fontStyle: "bold" },
              2: { halign: "right" },
              3: { halign: "right" },
              4: { halign: "right" },
            },
            alternateRowStyles: { fillColor: [252, 252, 254] },
            rowPageBreak: "avoid",
          });
          y = (doc as any).lastAutoTable.finalY + 16;
        }
      }
    }

    // ─ Quarterly Breakdown Overview ─
    checkPageBreak(120);
    sectionHeader("Quarterly Estimated Payment Schedule");

    const hasBusinessTax = summary.quarters.some(q => (q.stateBusinessPteDue + q.stateBusinessReplacementDue) > 0);
    const quarterHead = hasBusinessTax
      ? [["Quarter", "Due Date", "Federal (Individual)", "IL Individual", "IL Business (PTE + Replacement)", "Total Due"]]
      : [["Quarter", "Due Date", "Federal (Individual)", "IL Individual", "Total Due"]];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      head: quarterHead,
      body: summary.quarters.map((q) => {
        const ilBizCombined = q.stateBusinessPteDue + q.stateBusinessReplacementDue;
        const row = [
          `Q${q.quarter}`,
          fmtDate(q.dueDate),
          fmt(q.federalIndividualDue),
          fmt(q.stateIndividualDue),
        ];
        if (hasBusinessTax) row.push(fmt(ilBizCombined));
        row.push(fmt(q.totalDue));
        return row;
      }),
      styles: { fontSize: 8.5, cellPadding: 5, textColor: TEXT_DARK },
      headStyles: { fillColor: [240, 243, 248], textColor: TEXT_DARK, fontStyle: "bold", fontSize: 8.5 },
      columnStyles: {
        0: { halign: "center", fontStyle: "bold" },
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        ...(hasBusinessTax ? { 5: { halign: "right", fontStyle: "bold" } } : {}),
      },
      alternateRowStyles: { fillColor: [252, 252, 254] },
    });
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  // ── QUARTERLY PAYMENT DETAIL ─────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build display rows per quarter, combining PTE + Replacement into one line per entity
  interface DisplayRow {
    label: string;
    amountDue: number;
    amountPaid: number | null;
    paidDate: string | null;
    confirmationNumber: string | null;
    dueDate: string | null;
  }

  function buildDisplayRows(qPayments: EstimatedPayment[]): DisplayRow[] {
    const rows: DisplayRow[] = [];
    const individualTypes = ["federal_individual", "state_individual"];
    const INDIVIDUAL_LABELS: Record<string, string> = {
      federal_individual: "Federal (1040-ES)",
      state_individual: "Illinois Individual (IL-1040-ES)",
    };

    // Individual payments first
    for (const p of qPayments) {
      if (individualTypes.includes(p.paymentType)) {
        rows.push({
          label: INDIVIDUAL_LABELS[p.paymentType] ?? p.paymentType,
          amountDue: p.amountDue,
          amountPaid: p.amountPaid !== null ? Number(p.amountPaid) : null,
          paidDate: p.paidDate ?? null,
          confirmationNumber: p.confirmationNumber ?? null,
          dueDate: p.dueDate ?? null,
        });
      }
    }

    // Business payments grouped by entityName — PTE + Replacement combined
    const bizPayments = qPayments.filter(
      p => p.paymentType === "state_business_pte" || p.paymentType === "state_business_replacement"
    );
    const entityNames = [...new Set(bizPayments.map(p => p.entityName ?? ""))];

    for (const entityName of entityNames) {
      const entityPmts = bizPayments.filter(p => (p.entityName ?? "") === entityName);
      const ptePmt = entityPmts.find(p => p.paymentType === "state_business_pte");
      const replPmt = entityPmts.find(p => p.paymentType === "state_business_replacement");

      const combinedDue = entityPmts.reduce((s, p) => s + (p.amountDue || 0), 0);
      const combinedPaid = entityPmts.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
      const confNum = ptePmt?.confirmationNumber || replPmt?.confirmationNumber || null;
      const paidDate = ptePmt?.paidDate || replPmt?.paidDate || null;
      const dueDate = ptePmt?.dueDate || replPmt?.dueDate || null;

      const hasPte = !!ptePmt;
      const entityLabel = entityName
        ? `${entityName} — IL Business Tax (${hasPte ? "PTE 4.95% + Replacement 1.5%" : "Non-PTE - Replacement 1.5%"})`
        : `IL Business Tax (${hasPte ? "PTE 4.95% + Replacement 1.5%" : "Non-PTE - Replacement 1.5%"})`;

      rows.push({
        label: entityLabel,
        amountDue: combinedDue,
        amountPaid: combinedPaid > 0 ? combinedPaid : null,
        paidDate,
        confirmationNumber: confNum,
        dueDate,
      });
    }

    return rows;
  }

  // Determine the next unpaid quarter
  const grouped = [1, 2, 3, 4].map((q) => {
    const qPayments = payments.filter((p) => p.quarter === q && p.amountDue > 0);
    const displayRows = buildDisplayRows(qPayments);
    const allPaid = displayRows.length > 0 && displayRows.every((r) =>
      r.amountPaid !== null && r.amountPaid >= r.amountDue * 0.99
    );
    const dueDate = qPayments[0]?.dueDate ?? null;
    return { quarter: q, payments: qPayments, displayRows, allPaid, dueDate };
  });

  const nextQuarter = grouped.find((g) => !g.allPaid && g.payments.length > 0);

  // ── Section header helper (may add page) ──────────────────────────────────
  function quarterSectionHeader(label: string) {
    checkPageBreak(44);
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 26, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text(label, margin + 10, y + 17);
    y += 26;
  }

  quarterSectionHeader("Payment Detail by Quarter");

  for (const group of grouped) {
    if (group.displayRows.length === 0) continue;

    checkPageBreak(60 + group.displayRows.length * 28);

    const dueDateStr = group.dueDate ? fmtDate(group.dueDate) : "";
    const isPastDue = group.dueDate ? new Date(group.dueDate + "T00:00:00") < today : false;
    const isNext = nextQuarter?.quarter === group.quarter;

    // Quarter sub-header
    const qHeaderColor: [number, number, number] = group.allPaid
      ? [236, 253, 245]
      : isNext
      ? [254, 252, 232]
      : [245, 247, 250];
    const qTextColor: [number, number, number] = group.allPaid ? GREEN : isNext ? AMBER : TEXT_DARK;

    doc.setFillColor(...qHeaderColor);
    doc.rect(margin, y, contentW, 28, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...qTextColor);
    doc.text(`Quarter ${group.quarter}  |  Due: ${dueDateStr}`, margin + 10, y + 18);

    if (group.allPaid) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...GREEN);
      doc.text("ALL PAID", pageW - margin - 10, y + 18, { align: "right" });
    } else if (isNext) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...AMBER);
      doc.text("NEXT PAYMENT DUE", pageW - margin - 10, y + 18, { align: "right" });
    } else if (isPastDue) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...RED);
      doc.text("OVERDUE", pageW - margin - 10, y + 18, { align: "right" });
    }
    y += 28;

    // Payment rows table — uses merged display rows (PTE + Replacement combined per entity)
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      head: [["Payment Type", "Amount Due", "Amount Paid", "Date Paid", "Confirmation #", "Status"]],
      body: group.displayRows.map((r) => {
        const paid = r.amountPaid !== null && r.amountPaid >= r.amountDue * 0.99;
        const overdue = !paid && r.dueDate && new Date(r.dueDate + "T00:00:00") < today;
        return [
          r.label,
          fmt(r.amountDue),
          r.amountPaid !== null ? fmt(r.amountPaid) : "-",
          fmtDate(r.paidDate),
          r.confirmationNumber || "-",
          paid ? "Paid" : overdue ? "Overdue" : "Pending",
        ];
      }),
      styles: { fontSize: 8.5, cellPadding: 4.5, textColor: TEXT_DARK },
      headStyles: { fillColor: [232, 236, 244], textColor: TEXT_DARK, fontStyle: "bold", fontSize: 8.5 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "center" },
        4: { fontStyle: "bold", cellWidth: "auto" },
        5: { halign: "center", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [252, 252, 254] },
      rowPageBreak: "avoid",
      didParseCell: (data) => {
        if (data.column.index === 5 && data.section === "body") {
          const val = String(data.cell.raw);
          if (val === "Paid") data.cell.styles.textColor = GREEN;
          else if (val === "Overdue") data.cell.styles.textColor = RED;
          else data.cell.styles.textColor = AMBER;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ── NEXT PAYMENT CALLOUT ─────────────────────────────────────────────────
  if (nextQuarter && nextQuarter.displayRows.length > 0) {
    checkPageBreak(80);

    const dueDateStr = nextQuarter.dueDate ? fmtDate(nextQuarter.dueDate) : "";
    const totalNextDue = nextQuarter.displayRows.reduce((sum, r) => sum + r.amountDue, 0);

    doc.setFillColor(254, 252, 232);
    doc.roundedRect(margin, y, contentW, 56, 6, 6, "F");
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.5);
    doc.roundedRect(margin, y, contentW, 56, 6, 6, "S");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text("NEXT PAYMENT DUE", margin + 14, y + 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MED);
    doc.text(`Quarter ${nextQuarter.quarter}  |  Due Date: ${dueDateStr}`, margin + 14, y + 34);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(fmt(totalNextDue), pageW - margin - 14, y + 34, { align: "right" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MED);
    doc.text("Total across all payment types for this quarter", pageW - margin - 14, y + 46, { align: "right" });
    y += 56 + 16;
  }

  // ── DISCLAIMER ───────────────────────────────────────────────────────────
  checkPageBreak(60);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(160, 170, 185);
  const disclaimer =
    "This summary is prepared based on projected income and estimated tax calculations. Actual tax liability may differ. " +
    "This document is confidential and intended solely for the named client. Please consult your tax professional before making any payment decisions.";
  const lines = doc.splitTextToSize(disclaimer, contentW);
  doc.text(lines, margin, y);
  y += lines.length * 10 + 10;

  // Draw footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter();
  }

  // Save
  const safeName = client.name.replace(/[^a-z0-9]/gi, "_");
  doc.save(`${safeName}_TaxSummary_${taxYear}.pdf`);
}
