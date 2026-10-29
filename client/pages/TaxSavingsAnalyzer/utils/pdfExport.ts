import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  TaxSavingsPlan, TaxPlanEntity, ENTITY_LABELS, ENTITY_SHORT_LABELS,
  FILING_STATUS_LABELS, getFullName, computeAutoItemized, computePassThroughIncome,
} from '../types/plan';
import {
  formatCurrency, formatPercent, computeFederalTax, getStandardDeduction,
  BONUS_DEPRECIATION_2025,
} from './taxCalculations';
import { STRATEGIES } from './strategyDefinitions';

// ── Brand Colors ─────────────────────────────────────────────────────────────
const NAVY = [26, 32, 53] as [number, number, number];
const GOLD = [168, 124, 25] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const GREEN = [22, 163, 74] as [number, number, number];
const LIGHT_GRAY = [248, 249, 251] as [number, number, number];
const TEXT_DARK = [30, 35, 50] as [number, number, number];
const TEXT_MED = [90, 100, 120] as [number, number, number];
const RED = [185, 28, 28] as [number, number, number];
const AMBER_BG = [254, 243, 199] as [number, number, number];
const AMBER_DARK = [120, 53, 15] as [number, number, number];

const LOGO_URL = "/" + 'images/logo.png';

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function fmt(n: number): string { return formatCurrency(n); }
function pct(r: number): string { return (r * 100).toFixed(1) + '%'; }

/**
 * Strip / replace every character outside WinAnsi (ISO-8859-1) so jsPDF's
 * built-in Helvetica font never encounters an unmappable code-point.
 * Unmappable chars cause the infamous "s p a c e d   l e t t e r s" bug
 * where the rest of the string is rendered with a gap between every glyph.
 */
function sanitize(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u00A7/g, 'Sec.')          // § section sign  -> "Sec."
    .replace(/\u26A0[\uFE0F]?/g, '[!]')  // ⚠ warning sign  -> "[!]"
    .replace(/\u2014/g, ' - ')           // — em dash
    .replace(/\u2013/g, '-')             // – en dash
    .replace(/[\u2018\u2019]/g, "'")     // ' '  curly single quotes
    .replace(/[\u201C\u201D]/g, '"')     // " "  curly double quotes
    .replace(/\u2022/g, '-')             // • bullet
    .replace(/\u00D7/g, 'x')            // × multiplication sign
    .replace(/[^\x00-\xFF]/g, '')        // strip anything else above Latin-1
    ;
}

export async function exportPlanToPdf(plan: TaxSavingsPlan): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 45;
  const contentW = pageW - margin * 2;

  const fullName = getFullName(plan) || 'Client';
  const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── Computed Financials ───────────────────────────────────────────────────
  const totalYear1 = plan.entities.reduce((sum, e) =>
    sum + e.selectedStrategies.reduce((s, x) => s + x.estimatedSavings, 0)
       + e.customStrategies.reduce((s, c) => s + c.estimatedSavings, 0), 0);

  const totalRecurring = plan.entities.reduce((sum, e) =>
    sum + e.selectedStrategies.filter(s => s.isRecurring).reduce((s, x) => s + x.estimatedSavings, 0)
       + e.customStrategies.filter(c => c.isRecurring).reduce((s, c) => s + c.estimatedSavings, 0), 0);

  const { totalItemized } = computeAutoItemized(plan);
  const stdDeduction = getStandardDeduction(plan.filingStatus, plan.ownerAge, plan.spouseAge);
  const deduction = Math.max(totalItemized, stdDeduction);
  const taxableIncomeBefore = Math.max(0, plan.agi - deduction);
  const fedTaxBefore = computeFederalTax(taxableIncomeBefore, plan.filingStatus);
  const ilTaxBefore = plan.agi * plan.ilRate;
  const totalTaxBefore = fedTaxBefore + ilTaxBefore;
  const effectiveRateBefore = plan.agi > 0 ? totalTaxBefore / plan.agi : 0;
  const totalTaxAfter = Math.max(0, totalTaxBefore - totalYear1);
  const effectiveRateAfter = plan.agi > 0 ? totalTaxAfter / plan.agi : 0;
  const combinedRate = plan.federalMarginalRate + plan.ilRate;

  const logoData = await loadImageAsBase64(LOGO_URL);
  let currentPage = 0;

  // ── Running Header (every page except cover) ────────────────────────────
  function drawRunningHeader() {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 50, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 50, pageW, 3, 'F');

    // Logo area
    if (logoData) {
      try {
        doc.setFillColor(...WHITE);
        doc.roundedRect(margin - 4, 5, 180, 40, 3, 3, 'F');
        doc.addImage(logoData, 'PNG', margin, 8, 170, 34, undefined, 'NONE');
      } catch {
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
        doc.text('Shaqildi CPA Group', margin + 2, 30);
      }
    } else {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
      doc.text('Shaqildi CPA Group', margin, 30);
    }

    // Right: client name | tax year
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text(`${fullName}  |  Tax Year ${plan.taxYear}`, pageW - margin, 22, { align: 'right' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 190, 210);
    doc.text('Shaqildi CPA Group  |  The Entrepreneurial Accountants', pageW - margin, 36, { align: 'right' });
  }

  function drawFooter() {
    const fy = pageH - 32;
    doc.setFillColor(...NAVY);
    doc.rect(0, fy, pageW, 32, 'F');
    doc.setFontSize(6.5); doc.setTextColor(...WHITE); doc.setFont('helvetica', 'normal');
    doc.text('Shaqildi CPA Group  |  ahmadshaqildi@shaqildicpa.com  |  708-856-2494  |  Lockport, IL  |  Orland Park, IL', margin, fy + 11);
    doc.text('This analysis is for planning purposes only. Results are estimates based on information provided. Not tax advice.', margin, fy + 22);
    doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, pageW - margin, fy + 16, { align: 'right' });
  }

  function newPage() {
    drawFooter();
    doc.addPage();
    currentPage++;
    drawRunningHeader();
    return 53 + 16; // y start after header
  }

  function checkPageBreak(y: number, needed: number): number {
    if (y + needed > pageH - 50) return newPage();
    return y;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  currentPage = 1;

  // Top bar (NAVY, full top third)
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, pageH * 0.38, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, pageH * 0.38, pageW, 5, 'F');

  // Logo centered on cover
  if (logoData) {
    try {
      doc.setFillColor(...WHITE);
      doc.roundedRect(pageW / 2 - 110, 30, 220, 70, 6, 6, 'F');
      doc.addImage(logoData, 'PNG', pageW / 2 - 106, 34, 212, 62, undefined, 'NONE');
    } catch {
      doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
      doc.text('Shaqildi CPA Group', pageW / 2, 70, { align: 'center' });
    }
  } else {
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text('Shaqildi CPA Group', pageW / 2, 70, { align: 'center' });
  }

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 210, 230);
  doc.text('The Entrepreneurial Accountants', pageW / 2, 115, { align: 'center' });

  // Center content
  const centerY = pageH * 0.38 + 60;

  doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
  doc.text('Tax Savings Analysis', pageW / 2, centerY, { align: 'center' });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2);
  doc.line(pageW / 2 - 80, centerY + 10, pageW / 2 + 80, centerY + 10);

  doc.setFontSize(14); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
  doc.text(fullName, pageW / 2, centerY + 34, { align: 'center' });
  doc.setFontSize(11); doc.setTextColor(130, 140, 160);
  doc.text(`Tax Year ${plan.taxYear}`, pageW / 2, centerY + 52, { align: 'center' });

  // Bottom third
  const bottomY = pageH * 0.72;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
  doc.text('Prepared by', pageW / 2, bottomY, { align: 'center' });
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
  doc.text('Ahmad Shaqildi, CPA', pageW / 2, bottomY + 18, { align: 'center' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
  doc.text(reportDate, pageW / 2, bottomY + 34, { align: 'center' });

  doc.setDrawColor(220, 225, 235); doc.setLineWidth(0.5);
  doc.line(margin + 40, bottomY + 46, pageW - margin - 40, bottomY + 46);

  doc.setFontSize(8); doc.setTextColor(140, 150, 165);
  doc.text('Shaqildi CPA Group  |  The Entrepreneurial Accountants', pageW / 2, bottomY + 60, { align: 'center' });
  doc.text('Lockport, IL  |  708-856-2494  |  ahmadshaqildi@shaqildicpa.com', pageW / 2, bottomY + 74, { align: 'center' });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — DISCLAIMER
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 2;
  drawRunningHeader();
  let y = 53 + 24;

  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
  doc.text('Important Information', margin, y);
  y += 10;
  doc.setDrawColor(...GOLD); doc.setLineWidth(2);
  doc.line(margin, y, margin + 180, y);
  y += 18;

  const disclaimerParagraphs = [
    `This report, including all associated materials (collectively "this report"), is for informational purposes only and intended solely for the named client: ${fullName}. The tax savings presented are estimates based on information provided and should not be construed as guaranteed results. No professional-client relationship beyond the existing engagement is created by this report.`,
    `All projections are based on current federal and Illinois tax regulations as of ${reportDate}. Tax laws are subject to change, including potential changes under the One Big Beautiful Bill Act currently pending in Congress. No obligation is assumed to update this report to reflect subsequent legislative changes.`,
    `This analysis was prepared by Shaqildi CPA Group solely for the use of the named client. Any reproduction, redistribution, or use by third parties without express written consent of Shaqildi CPA Group is prohibited.`,
    `The strategies presented require proper implementation, documentation, and ongoing compliance to achieve the estimated tax savings. Actual results will vary based on full implementation, changes in income, and legislative developments. Nothing in this report constitutes legal, investment, or financial planning advice.`,
    `Estimates related to bonus depreciation reflect current law (${(BONUS_DEPRECIATION_2025 * 100).toFixed(0)}% for 2025). Where the "OBBBA scenario" is modeled, it assumes enactment of the One Big Beautiful Bill Act as currently proposed. This should not be relied upon until enacted into law.`,
  ];

  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  for (const para of disclaimerParagraphs) {
    const lines = doc.splitTextToSize(para, contentW - 20);
    const h = lines.length * 12 + 14;
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, contentW, h, 3, 3, 'F');
    doc.setTextColor(...TEXT_DARK);
    doc.text(lines, margin + 10, y + 11);
    y += h + 8;
  }

  y += 10;
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin, y, contentW, 50, 4, 4, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text('Shaqildi CPA Group  |  ahmadshaqildi@shaqildicpa.com  |  708-856-2494', margin + 10, y + 16);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 190, 210);
  doc.text('Lockport, IL (Physical)  |  Orland Park, IL (Remote)', margin + 10, y + 30);
  doc.text(`Tax Year ${plan.taxYear}  |  Prepared: ${reportDate}`, margin + 10, y + 44);

  drawFooter();

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — TABLE OF CONTENTS / OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 3;
  drawRunningHeader();
  y = 53 + 24;

  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
  doc.text('Overview', margin, y);
  y += 10;
  doc.setDrawColor(...GOLD); doc.setLineWidth(2);
  doc.line(margin, y, margin + 80, y);
  y += 24;

  const tocItems = [
    'Tax Savings Summary',
    `${fullName}'s Estimated Tax Savings`,
    `Tax Plan by Entity — ${plan.taxYear}`,
    'Strategy Details & Appendix by Entity',
    'Implementation Plan',
  ];

  for (const item of tocItems) {
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, contentW, 30, 4, 4, 'F');
    doc.setFillColor(...GOLD);
    doc.roundedRect(margin + 10, y + 11, 8, 8, 2, 2, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
    doc.text(item, margin + 26, y + 19);
    y += 38;
  }

  drawFooter();

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 4 — CLIENT TAX SAVINGS SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 4;
  drawRunningHeader();
  y = 53 + 18;

  doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
  doc.text(`${fullName}'s Tax Savings Plan`, margin, y);
  y += 14;

  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
  const summaryIntro = `This represents your consolidated potential tax savings analysis across all entities based on a comprehensive review of your information.`;
  doc.text(doc.splitTextToSize(summaryIntro, contentW), margin, y);
  y += 28;

  // Big savings box
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin, y, contentW, 100, 6, 6, 'F');
  doc.setFillColor(...GOLD);
  doc.roundedRect(margin, y, 6, 100, 3, 3, 'F');

  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 200, 230);
  doc.text(`${plan.taxYear} Estimated Tax Savings`, pageW / 2, y + 22, { align: 'center' });
  doc.setFontSize(32); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text(fmt(totalYear1), pageW / 2, y + 58, { align: 'center' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 230);
  doc.text(`Effective Rate Before: ${pct(effectiveRateBefore)}`, pageW / 2 - 80, y + 82, { align: 'right' });
  doc.text(`Effective Rate After: ${pct(effectiveRateAfter)}`, pageW / 2 + 80, y + 82, { align: 'left' });
  y += 110;

  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
  doc.text('These estimates reflect savings derived from:', margin, y);
  y += 14;

  const bulletPoints = [
    'Information and income details provided',
    'Selected tax strategies and implementation preferences',
    `Current federal and Illinois tax regulations as of ${reportDate}`,
    'All projections will update if income information or tax laws change.',
  ];
  for (const bp of bulletPoints) {
    doc.setFillColor(...GOLD);
    doc.circle(margin + 6, y - 2, 2.5, 'F');
    doc.setTextColor(...TEXT_MED);
    doc.text(bp, margin + 16, y);
    y += 14;
  }

  drawFooter();

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 5 — TAX PLAN BY ENTITY
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 5;
  drawRunningHeader();
  y = 53 + 18;

  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
  doc.text(`Tax Plan by Entity for ${plan.taxYear}`, margin, y);
  y += 8;
  doc.setDrawColor(...GOLD); doc.setLineWidth(1.5);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  // Entity rows
  const entityTableRows = plan.entities.map(e => {
    const savings = e.selectedStrategies.reduce((s, x) => s + x.estimatedSavings, 0)
      + e.customStrategies.reduce((s, c) => s + c.estimatedSavings, 0);
    const strategiesCount = e.selectedStrategies.length + e.customStrategies.length;
    return [
      e.entityLabel || ENTITY_LABELS[e.entityType],
      ENTITY_SHORT_LABELS[e.entityType],
      fmt(savings),
      strategiesCount.toString(),
    ];
  });

  autoTable(doc, {
    startY: y, margin: { left: margin, right: margin }, tableWidth: contentW,
    head: [['Entity Name', 'Entity Type', 'Tax Savings', 'Strategies']],
    body: entityTableRows,
    foot: [['TOTAL', '', fmt(totalYear1), plan.entities.reduce((s, e) => s + e.selectedStrategies.length + e.customStrategies.length, 0).toString()]],
    styles: { fontSize: 9, cellPadding: 6, textColor: TEXT_DARK },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: [22, 101, 52], textColor: WHITE, fontStyle: 'bold', fontSize: 10 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 120 }, 2: { halign: 'right', cellWidth: 110, fontStyle: 'bold' }, 3: { halign: 'center', cellWidth: 70 } },
    alternateRowStyles: { fillColor: [252, 252, 254] },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 2) data.cell.styles.textColor = GREEN;
    },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // Recurring savings note
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, contentW, 28, 3, 3, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
  doc.text(`Year 2+ Recurring Annual Savings:`, margin + 10, y + 12);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
  doc.text(fmt(totalRecurring), pageW - margin - 10, y + 12, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...TEXT_MED);
  doc.text('Includes only strategies marked as recurring.', margin + 10, y + 22);
  y += 36;

  // Advisor fee section (if enabled)
  if (plan.includeAdvisorFees && plan.advisorFees > 0) {
    const afterTaxCost = plan.advisorFees * (1 - combinedRate);
    const taxBenefit = plan.advisorFees * combinedRate;
    const netSavings = totalYear1 - afterTaxCost;

    doc.setFillColor(254, 249, 240);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1);
    doc.roundedRect(margin, y, contentW, 80, 4, 4, 'FD');

    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
    doc.text('Your Investment in Shaqildi CPA Group', margin + 10, y + 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);

    const feeRows = [
      [`${plan.advisorServiceDescription}:`, fmt(plan.advisorFees)],
      [`Tax Deductible Benefit (${pct(combinedRate)} combined rate):`, `+${fmt(taxBenefit)}`],
      [`After-Tax Investment:`, `(${fmt(afterTaxCost)})`],
    ];
    let fy = y + 30;
    for (const [label, val] of feeRows) {
      doc.setTextColor(...TEXT_MED); doc.text(label, margin + 10, fy);
      doc.setTextColor(...TEXT_DARK); doc.text(val, pageW - margin - 10, fy, { align: 'right' });
      fy += 12;
    }

    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.5);
    doc.line(margin + 10, fy, pageW - margin - 10, fy);
    fy += 10;

    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
    doc.text('Net Tax Savings After Advisory Fees:', margin + 10, fy);
    doc.setTextColor(...GREEN);
    doc.text(fmt(netSavings), pageW - margin - 10, fy, { align: 'right' });
  }

  drawFooter();

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGES 6+ — PER-ENTITY APPENDIX
  // ═══════════════════════════════════════════════════════════════════════════
  for (const entity of plan.entities) {
    const allEntityStrategies = [
      ...entity.selectedStrategies,
      ...entity.customStrategies.map(c => ({
        strategyId: `custom-${c.id}`,
        strategyName: c.name,
        isRecurring: c.isRecurring,
        estimatedSavings: c.estimatedSavings,
        inputs: {},
        notes: c.description,
        isCustom: true,
      })),
    ];
    if (allEntityStrategies.length === 0) continue;

    // Entity section header page
    doc.addPage();
    currentPage++;
    drawRunningHeader();
    y = 53 + 18;

    doc.setFillColor(...NAVY);
    doc.roundedRect(margin, y, contentW, 90, 6, 6, 'F');

    // Color accent bar using entity color
    try {
      const rgb = hexToRgb(entity.color);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    } catch { doc.setFillColor(...GOLD); }
    doc.roundedRect(margin, y, 8, 90, 4, 4, 'F');

    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text('Appendix by Entity', margin + 20, y + 24);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text(entity.entityLabel || ENTITY_LABELS[entity.entityType], margin + 20, y + 46);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 230);
    doc.text(`(${ENTITY_SHORT_LABELS[entity.entityType]})`, margin + 20, y + 62);
    doc.text(`${allEntityStrategies.length} strategies selected for this entity`, margin + 20, y + 76);

    y += 106;

    const entityDescription = `This section contains a summary of tax-saving strategies, credits, and detailed financial calculations relevant to ${entity.entityLabel || ENTITY_LABELS[entity.entityType]}.`;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
    doc.text(doc.splitTextToSize(entityDescription, contentW), margin, y);

    drawFooter();

    // ── Per-strategy: 3-sub-page format ──────────────────────────────────
    for (const strat of allEntityStrategies) {
      const isCustom = (strat as any).isCustom === true;
      const stratDef = STRATEGIES.find(s => s.id === strat.strategyId);

      // SUB-PAGE A: Strategy Summary
      doc.addPage();
      currentPage++;
      drawRunningHeader();
      y = 53 + 14;

      // Entity breadcrumb
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
      doc.text(`${entity.entityLabel || ENTITY_LABELS[entity.entityType]}  |  ${ENTITY_SHORT_LABELS[entity.entityType]}`, margin, y);
      y += 14;

      // Strategy title bar
      doc.setFillColor(...NAVY);
      doc.roundedRect(margin, y, contentW, 28, 4, 4, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
      doc.text(`${sanitize(strat.strategyName)} - Summary`, margin + 10, y + 18);
      y += 36;

      // Savings boxes
      const boxW = (contentW - 12) / 2;
      const boxes: Array<[string, string, string, [number, number, number], [number, number, number]]> = [
        ['Estimated Tax Savings', '', fmt(strat.estimatedSavings), [236, 253, 245], GREEN],
        ['Recurring', '', strat.isRecurring ? 'Annual' : 'One-time', LIGHT_GRAY, TEXT_DARK],
      ];
      boxes.forEach((b, i) => {
        const bx = margin + i * (boxW + 12);
        doc.setFillColor(...b[3]);
        doc.roundedRect(bx, y, boxW, 52, 4, 4, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_MED);
        doc.text(b[0], bx + boxW / 2, y + 14, { align: 'center' });
        doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...b[4]);
        doc.text(b[2], bx + boxW / 2, y + 36, { align: 'center' });
      });
      y += 60;

      // Description
      const description = sanitize(stratDef?.description || (isCustom ? (strat as any).notes || 'Custom strategy.' : ''));
      if (description) {
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_DARK);
        const descLines = doc.splitTextToSize(description, contentW);
        doc.text(descLines, margin, y);
        y += descLines.length * 11 + 10;
      }

      // Eligibility
      if (stratDef?.eligibilityBullets && stratDef.eligibilityBullets.length > 0) {
        y = checkPageBreak(y, 60);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
        doc.text('Eligibility Criteria and Requirements', margin, y);
        y += 12;
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
        for (const bullet of stratDef.eligibilityBullets) {
          y = checkPageBreak(y, 14);
          doc.setFillColor(...GOLD);
          doc.circle(margin + 5, y - 3, 2, 'F');
          const bLines = doc.splitTextToSize(sanitize(bullet), contentW - 18);
          doc.text(bLines, margin + 14, y);
          y += bLines.length * 10 + 4;
        }
        y += 6;
      }

      // Implementation Steps
      if (stratDef?.implementationSteps && stratDef.implementationSteps.length > 0) {
        y = checkPageBreak(y, 60);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
        doc.text('Recommended Steps for Implementation', margin, y);
        y += 12;
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
        for (let si = 0; si < stratDef.implementationSteps.length; si++) {
          const step = sanitize(stratDef.implementationSteps[si]);
          y = checkPageBreak(y, 14);
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
          doc.text(`${si + 1}.`, margin + 4, y);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
          const sLines = doc.splitTextToSize(step, contentW - 20);
          doc.text(sLines, margin + 16, y);
          y += sLines.length * 10 + 4;
        }
      }

      doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(160, 170, 185);
      doc.text('*Potential savings are estimates. Actual results depend on full implementation.', margin, pageH - 50);

      drawFooter();

      // SUB-PAGE B: Calculation Breakdown
      doc.addPage();
      currentPage++;
      drawRunningHeader();
      y = 53 + 14;

      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
      doc.text(`${entity.entityLabel || ENTITY_LABELS[entity.entityType]}  |  ${ENTITY_SHORT_LABELS[entity.entityType]}`, margin, y);
      y += 14;

      doc.setFillColor(240, 243, 248);
      doc.roundedRect(margin, y, contentW, 28, 4, 4, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
      doc.text(`${strat.strategyName} — Potential Savings Calculation`, margin + 10, y + 18);
      y += 36;

      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
      doc.text('Based on your provided inputs, here is a breakdown of your potential tax savings.', margin, y);
      y += 16;

      // Input values table
      const inputRows: string[][] = [];
      if (!isCustom && strat.inputs && Object.keys(strat.inputs).length > 0) {
        const fieldDefs = stratDef?.inputFields ?? [];
        for (const [k, v] of Object.entries(strat.inputs)) {
          if (['assetDescription', 'familyMemberName', 'propertyDescription'].includes(k)) continue;
          const fieldDef = fieldDefs.find(f => f.key === k);
          const label = fieldDef?.label ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          let displayVal = String(v);
          if (typeof v === 'boolean') displayVal = v ? 'Yes' : 'No';
          else if (typeof v === 'number' && v > 0 && !k.toLowerCase().includes('pct') && !k.toLowerCase().includes('rate') && !k.toLowerCase().includes('years') && !k.toLowerCase().includes('period') && !k.toLowerCase().includes('miles')) {
            displayVal = fmt(v);
          }
          inputRows.push([label, displayVal]);
        }
      }

      if (inputRows.length > 0) {
        autoTable(doc, {
          startY: y, margin: { left: margin, right: margin }, tableWidth: contentW * 0.7,
          head: [['Input Parameter', 'Value']],
          body: inputRows,
          styles: { fontSize: 8, cellPadding: 4, textColor: TEXT_DARK },
          headStyles: { fillColor: LIGHT_GRAY, textColor: TEXT_DARK, fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', fontStyle: 'bold' } },
          alternateRowStyles: { fillColor: [252, 252, 254] },
        });
        y = (doc as any).lastAutoTable.finalY + 14;
      }

      // Tax savings calculation summary
      const combinedRateDisp = (plan.federalMarginalRate * 100).toFixed(0) + '% federal + ' + (plan.ilRate * 100).toFixed(2) + '% IL';
      const calcRows = [
        ['Estimated Deduction / Benefit', fmt(strat.estimatedSavings > 0 ? strat.estimatedSavings / combinedRate || strat.estimatedSavings : 0)],
        ['x Combined Effective Tax Rate', `${pct(combinedRate)} (${combinedRateDisp})`],
        ['= Estimated Tax Savings', fmt(strat.estimatedSavings)],
      ];

      autoTable(doc, {
        startY: y, margin: { left: margin, right: margin }, tableWidth: contentW,
        head: [['Tax Savings Calculation', 'Amount']],
        body: calcRows,
        styles: { fontSize: 9, cellPadding: 5, textColor: TEXT_DARK },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', fontStyle: 'bold', cellWidth: 120 } },
        didParseCell(data) {
          if (data.section === 'body' && data.row.index === 2 && data.column.index === 1) {
            data.cell.styles.textColor = GREEN;
            data.cell.styles.fontSize = 10;
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      if (stratDef?.notes) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...TEXT_MED);
        doc.setFillColor(...LIGHT_GRAY);
        const noteLines = doc.splitTextToSize(`Note: ${sanitize(stratDef.notes)}`, contentW - 20);
        doc.roundedRect(margin, y, contentW, noteLines.length * 10 + 12, 3, 3, 'F');
        doc.text(noteLines, margin + 8, y + 10);
        y += noteLines.length * 10 + 20;
      }

      drawFooter();

      // SUB-PAGE C: IRC References
      doc.addPage();
      currentPage++;
      drawRunningHeader();
      y = 53 + 14;

      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
      doc.text(`${entity.entityLabel || ENTITY_LABELS[entity.entityType]}  |  ${ENTITY_SHORT_LABELS[entity.entityType]}`, margin, y);
      y += 14;

      doc.setFillColor(...NAVY);
      doc.roundedRect(margin, y, contentW, 28, 4, 4, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
      doc.text(`${strat.strategyName} — Tax References`, margin + 10, y + 18);
      y += 36;

      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
      doc.text('Here is a comprehensive list of IRS tax code references, relevant court cases, and', margin, y);
      y += 12;
      doc.text('related regulations to substantiate this strategy.', margin, y);
      y += 20;

      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
      doc.text('Internal Revenue Code sections and related regulations include:', margin, y);
      y += 14;

      if (isCustom || !stratDef?.ircReferences) {
        doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...TEXT_MED);
        doc.text('Custom strategy — IRC references not applicable.', margin, y);
      } else {
        doc.setFillColor(...LIGHT_GRAY);
        const ircLines = doc.splitTextToSize(sanitize(stratDef.ircReferences), contentW - 20);
        const ircH = ircLines.length * 11 + 16;
        doc.roundedRect(margin, y, contentW, ircH, 4, 4, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_DARK);
        doc.text(ircLines, margin + 10, y + 12);
        y += ircH + 12;
      }

      if (stratDef?.warning) {
        y = checkPageBreak(y, 40);
        doc.setFillColor(254, 243, 199);
        const warnLines = doc.splitTextToSize(`[!] ${sanitize(stratDef.warning)}`, contentW - 20);
        const warnH = warnLines.length * 11 + 14;
        doc.roundedRect(margin, y, contentW, warnH, 3, 3, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 53, 15);
        doc.text(warnLines, margin + 10, y + 11);
      }

      drawFooter();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL PAGE — IMPLEMENTATION PLAN
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage++;
  drawRunningHeader();
  y = 53 + 18;

  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
  doc.text('Implementation Plan', margin, y);
  y += 8;
  doc.setDrawColor(...GOLD); doc.setLineWidth(2);
  doc.line(margin, y, margin + 160, y);
  y += 18;

  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
  const implIntro = 'Implementing your recommended strategies in a timely manner is essential to convert potential tax savings into measurable benefits.';
  doc.text(doc.splitTextToSize(implIntro, contentW), margin, y);
  y += 24;

  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
  doc.text('Below are your key action items:', margin, y);
  y += 16;

  const actionItems = [
    'Carefully evaluate each recommended strategy, noting its eligibility criteria and timing requirements.',
    'Review all strategies to ensure no beneficial opportunities are overlooked.',
    'Follow the step-by-step guidance within each strategy to stay organized and compliant.',
    'Document all implementation steps as you complete them for reference and audit purposes.',
    'Contact Shaqildi CPA Group to begin implementing these strategies immediately.',
  ];

  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  for (const action of actionItems) {
    y = checkPageBreak(y, 30);
    doc.setFillColor(...LIGHT_GRAY);
    const actionLines = doc.splitTextToSize(action, contentW - 40);
    const actionH = actionLines.length * 11 + 14;
    doc.roundedRect(margin, y, contentW, actionH, 3, 3, 'F');
    doc.setFillColor(...GOLD);
    doc.circle(margin + 12, y + actionH / 2, 3, 'F');
    doc.setTextColor(...TEXT_DARK);
    doc.text(actionLines, margin + 26, y + 11);
    y += actionH + 8;
  }

  y += 10;

  // CTA Banner
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin, y, contentW, 65, 5, 5, 'F');
  doc.setFillColor(...GOLD);
  doc.roundedRect(margin, y, 6, 65, 3, 3, 'F');
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 230);
  doc.text('Begin implementing your strategies now to realize the full potential of your', margin + 18, y + 18);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text(`estimated ${fmt(totalYear1)} in tax savings.`, margin + 18, y + 35);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 230);
  doc.text('Shaqildi CPA Group  |  Ahmad Shaqildi, CPA  |  708-856-2494  |  ahmadshaqildi@shaqildicpa.com', margin + 18, y + 54);

  // Advisor Notes
  if (plan.advisorNotes) {
    y += 75;
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, contentW, 14, 3, 3, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_DARK);
    doc.text('Advisor Notes', margin + 8, y + 10);
    y += 14;
    const noteLines = doc.splitTextToSize(plan.advisorNotes, contentW - 16);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
    doc.text(noteLines, margin + 8, y + 12);
  }

  drawFooter();

  // Save
  const safeName = (getFullName(plan) || 'Client').replace(/[^a-z0-9]/gi, '_');
  const planNameSafe = (plan.planName || 'TaxPlan').replace(/[^a-z0-9]/gi, '_');
  doc.save(`${safeName}_${planNameSafe}_${plan.taxYear}.pdf`);
}

// ── 1-Page Summary PDF ────────────────────────────────────────────────────────
// Mirrors the simple client-facing summary: logo, profile bar, strategy list,
// Year 1 total, Year 2+ recurring, and advisor fee ROI section.
export async function exportSummaryPdf(plan: TaxSavingsPlan): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 50;
  const contentW = pageW - margin * 2;
  const fullName = getFullName(plan) || 'Client';

  // ── Logo ──────────────────────────────────────────────────────────────────
  let y = 28;
  const logoData = await loadImageAsBase64(LOGO_URL);
  if (logoData) {
    const logoW = 200;
    const logoH = 58;
    const logoX = (pageW - logoW) / 2;
    doc.setFillColor(...WHITE);
    doc.roundedRect(logoX - 8, y - 6, logoW + 16, logoH + 12, 5, 5, 'F');
    doc.addImage(logoData, 'PNG', logoX, y, logoW, logoH, undefined, 'NONE');
    y += logoH + 20;
  } else {
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text('Shaqildi CPA Group', pageW / 2, y + 12, { align: 'center' });
    y += 34;
  }

  // ── Title ─────────────────────────────────────────────────────────────────
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
  doc.text(`Tax Savings Analysis for ${plan.taxYear}`, pageW / 2, y, { align: 'center' });
  y += 18;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MED);
  doc.text(plan.planName || `${fullName} ${plan.taxYear} Tax Plan`, pageW / 2, y, { align: 'center' });
  y += 18;

  // ── Profile Bar ───────────────────────────────────────────────────────────
  const businessEntities = plan.entities.filter(e => e.entityType !== 'individual');
  const entityTypePart = businessEntities.length > 0
    ? businessEntities.map(e => ENTITY_SHORT_LABELS[e.entityType] || ENTITY_LABELS[e.entityType]).join(' | ')
    : 'Personal';
  const netIncome = computePassThroughIncome(plan);
  const filingLabel = FILING_STATUS_LABELS[plan.filingStatus] || plan.filingStatus;
  const profileParts: string[] = [];
  if (entityTypePart) profileParts.push(entityTypePart);
  if (plan.state) profileParts.push(plan.state);
  if (netIncome > 0) profileParts.push(`${fmt(netIncome)} net`);
  profileParts.push(filingLabel);
  if (plan.liquidAssets > 0) profileParts.push(`${fmt(plan.liquidAssets)} Liquid to Invest`);
  const profileText = profileParts.join('  ,  ');
  const profileLines = doc.splitTextToSize(profileText, contentW - 20);
  const profileH = profileLines.length * 13 + 16;
  doc.setFillColor(...AMBER_BG);
  doc.roundedRect(margin, y, contentW, profileH, 4, 4, 'F');
  doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...AMBER_DARK);
  doc.text(profileLines, pageW / 2, y + 11, { align: 'center' });
  y += profileH + 16;

  // ── Strategy List ─────────────────────────────────────────────────────────
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
  doc.text('Opportunities Identified to Reduce Your Annual Tax', margin, y);
  y += 14;

  // Collect all strategies across entities
  const allRows: Array<{ label: string; savings: number; entityLabel: string }> = [];
  for (const entity of plan.entities) {
    for (const s of entity.selectedStrategies) {
      allRows.push({ label: s.strategyName, savings: s.estimatedSavings, entityLabel: entity.entityLabel });
    }
    for (const c of entity.customStrategies) {
      allRows.push({ label: c.name, savings: c.estimatedSavings, entityLabel: entity.entityLabel });
    }
  }

  const rowH = 18;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 251);
      doc.rect(margin, y - 2, contentW, rowH, 'F');
    }
    doc.setTextColor(...TEXT_DARK);
    doc.text(row.label, margin + 8, y + 11);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(row.savings), margin + contentW - 8, y + 11, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += rowH;
  }

  // ── Year 1 Total ──────────────────────────────────────────────────────────
  const totalYear1 = allRows.reduce((s, r) => s + r.savings, 0);
  y += 4;
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin, y, contentW, 22, 3, 3, 'F');
  doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text('Estimated Year 1 Tax Savings', margin + 10, y + 14);
  doc.text(fmt(totalYear1), margin + contentW - 10, y + 14, { align: 'right' });
  y += 32;

  // ── Year 2+ Recurring ─────────────────────────────────────────────────────
  const totalRecurring = plan.entities.reduce((sum, e) =>
    sum + e.selectedStrategies.filter(s => s.isRecurring).reduce((s2, x) => s2 + x.estimatedSavings, 0)
       + e.customStrategies.filter(c => c.isRecurring).reduce((s2, c) => s2 + c.estimatedSavings, 0), 0);

  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
  doc.text('Year 2 & Forward Savings', margin, y);
  y += 14;
  doc.setFillColor(248, 249, 251);
  doc.rect(margin, y - 2, contentW, rowH, 'F');
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_DARK);
  doc.text('Estimated Year 2 & Forward Tax Savings (per year)', margin + 8, y + 11);
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(totalRecurring), margin + contentW - 8, y + 11, { align: 'right' });
  y += rowH + 12;

  // ── Advisor Fee ROI ───────────────────────────────────────────────────────
  if (plan.advisorFees > 0) {
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.5);
    doc.line(margin, y, margin + contentW, y);
    y += 12;

    const combinedRate = plan.federalMarginalRate + plan.ilRate;
    const taxBenefit = plan.advisorFees * combinedRate;
    const afterTaxCost = plan.advisorFees * (1 - combinedRate);

    const feeRows: Array<[string, string]> = [
      [`Your investment in Shaqildi CPA Group (${plan.advisorServiceDescription || 'advisory services'}):`, fmt(plan.advisorFees)],
      [`Tax Deductible Benefit of Investment (${pct(combinedRate)} rate):`, `+${fmt(taxBenefit)}`],
      ['After-Tax Cost of Services:', fmt(afterTaxCost)],
    ];

    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_DARK);
    for (const [label, val] of feeRows) {
      doc.text(label, margin + 8, y);
      doc.setFont('helvetica', 'bold');
      doc.text(val, margin + contentW - 8, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 16;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  y += 10;
  doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...TEXT_MED);
  doc.text(
    'All estimates are for planning purposes only. Consult Shaqildi CPA Group before implementing any strategy.',
    pageW / 2, y, { align: 'center' },
  );

  const safeName = (fullName).replace(/[^a-z0-9]/gi, '_');
  const planNameSafe = (plan.planName || 'TaxPlan').replace(/[^a-z0-9]/gi, '_');
  doc.save(`${safeName}_${planNameSafe}_${plan.taxYear}_Summary.pdf`);
}
