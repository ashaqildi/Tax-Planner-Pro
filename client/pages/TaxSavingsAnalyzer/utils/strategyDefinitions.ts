import { EntityType } from '../types/plan';
import {
  SS_WAGE_BASE_2025, SALT_CAP_2025, MILEAGE_RATE_2025,
  BONUS_DEPRECIATION_2025, BONUS_DEPRECIATION_OBBBA,
  estimateCashBalanceContribution, computeLTCGRate, getStandardDeduction,
  getRetirementLimits,
} from './taxCalculations';

export interface StrategyInputField {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  defaultValue?: number | string | boolean;
  helpText?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  greyed?: boolean;
  tooltipNote?: string;
}

export interface PlanComputeData {
  federalMarginalRate: number;
  ilRate: number;
  agi: number;
  ownerAge: number;
  ownerW2: number;
  netBusinessIncome: number;
  ownershipPct: number;
  filingStatus: string;
  entityType: string;
  state: string;
  grossRevenue: number;
  mortgageInterestPrimary: number;
  mortgageInterestSecond: number;
  charitableCash: number;
  charitableNonCash: number;
  propertyTaxes: number;
  stateIncomeTaxesPaid: number;
  otherItemizedDeductions: number;
  medicalExpenses: number;
  grossW2Income: number;
  liquidAssets: number;
  spouseIncome: number;
  numberOfDependents: number;
  spouseAge: number;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  eligibleEntities: EntityType[];
  isRecurring: boolean;
  inputFields: StrategyInputField[];
  compute: (inputs: Record<string, number | string | boolean>, plan: PlanComputeData) => number;
  notes?: string;
  warning?: string;
  ircReferences?: string;
  implementationSteps?: string[];
  eligibilityBullets?: string[];
}

export const STRATEGY_IRC_REFS: Record<string, string> = {
  'accountable-plan': 'IRC §62(c), IRC §162(a), IRC §274(d), IRC §3121(a)(2)(A), IRC §3306(b)(2)(A), IRC §62(a)(2)(A), IRC §3401(a)(2), Treas. Reg. §1.62-2, Treas. Reg. §1.162-17, Treas. Reg. §1.274-5, Rev. Rul. 2006-56, Rev. Rul. 2012-25, Rev. Rul. 95-55, IRS Publication 15 (Circular E), IRS Publication 463.',
  'sec179-bonus': 'IRC §179, IRC §168(k), IRC §168(b), Treas. Reg. §1.168(k)-2, Rev. Proc. 2019-8, IRS Form 4562, IRS Publication 946, TCJA §13201, One Big Beautiful Bill Act (pending).',
  'retirement-plan': '26 U.S.C. §401(a), 26 U.S.C. §402(g), 26 U.S.C. §414(v), 26 U.S.C. §404, 26 U.S.C. §72(t), IRS Form 5500/5500-EZ, IRS Publication 560, IRS Publication 590-A/B, SECURE 2.0 Act, IRS Notice 2024-02, IRC §415.',
  'cash-balance': 'IRC §412, IRC §430, IRC §404(a)(1), IRC §415(b), ERISA §302, Treas. Reg. §1.430(d)-1, IRS Form 5500, IRS Publication 560, PPA 2006.',
  'augusta-rule': 'IRC §280A(g), PLR 8104117, IRC §274(a)(1)(B), IRC §267(a)(2), IRC §162, Rev. Rul. 76-287, Sinopoli v. Commissioner (2023), Jadhav v. Commissioner (2023), Leslie A. Roy v. Comm\'r, TC Memo 1998-125.',
  'hsa': 'IRC §223, 26 C.F.R. §1.223-1 to §1.223-3, IRS Form 8889, IRS Publication 969, IRS Publication 502, Revenue Ruling 2004-45, IRS Notice 2004-50, IRS Audit Techniques Guide for HSAs.',
  'ptet-salt': 'IRC §164(b)(2), Illinois Public Act 102-0658 (IL PTET), 35 ILCS 5/201.2, IL Form IL-1120-ST, IL Form IL-1065, IRS Notice 2020-75, Rev. Rul. 2021-2, AICPA State PTET Tracker. IL Replacement Tax: 35 ILCS 5/201(c), IL Form IL-1120-ST Schedule B, Illinois Department of Revenue Publication 103.',
  'qbi': 'IRC §199A, Treas. Reg. §1.199A-1 through §1.199A-6, IRS Form 8995/8995-A, IRS Publication 535, Rev. Proc. 2019-38, TCJA §11011.',
  'family-employment': 'IRC §3121(b)(3), IRC §1402(c), IRC §162, IRS Publication 15, IRS Publication 926, Rev. Rul. 73-361.',
  'reasonable-comp': 'IRC §162(a)(1), IRC §3121, Reg. §1.162-7, Rev. Rul. 74-44, Watson v. United States (2012), Glass Blocks Unlimited v. Comm\'r, TC Memo 2013-180, IRS Audit Techniques Guide for S Corporations.',
  'health-insurance': 'IRC §162(l), IRC §106, Treas. Reg. §1.162(l)-1, Notice 2008-1, Rev. Rul. 91-26, IRS Form 1040 Schedule 1 Line 17.',
  'daf-bunching': 'IRC §170(f)(18), IRC §4966, IRC §4967, IRS Publication 526, Treas. Reg. §1.170A-9(f).',
  'cost-segregation': 'IRC §168, IRC §179, Treas. Reg. §1.168(i)-1, Rev. Proc. 87-56, Rev. Proc. 2011-26, IRS Audit Techniques Guide: Cost Segregation (MSSP).',
  'rd-credit': 'IRC §41, IRC §280C(c), Treas. Reg. §1.41-0 through §1.41-8, IRS Form 6765, IRS Audit Techniques Guide for R&D Credits, PATH Act §121.',
  'vehicle-deduction': 'IRC §179, IRC §168(k), IRC §280F, Rev. Proc. 2025-[current], IRS Publication 946, IRS Form 4562.',
  'qoz': 'IRC §1400Z-1, IRC §1400Z-2, Treas. Reg. §1.1400Z2(a)-1 through §1.1400Z2(f)-1, IRS Form 8949, IRS Form 8997.',
  'scorp-election': 'IRC §1361, IRC §1362, IRC §1363, IRC §1366, IRS Form 2553, Rev. Proc. 2013-30, Illinois Form IL-1120-ST.',
  'itemized-vs-standard': 'IRC §63(b), IRC §63(d), IRC §163, IRC §164, IRC §170, IRC §213, Schedule A (Form 1040), TCJA §11042, OBBBA §[SALT provision].',
  'ic-disc': 'IRC §991 through §997, Treas. Reg. §1.993-1 through §1.997-1, IRS Form 1120-IC-DISC.',
  'captive-insurance': 'IRC §831(b), IRC §953(d), IRC §162, IRS Notice 2016-66, IRS Notice 2023-10, IRS Transactions of Interest List.',
  'property-rental': 'IRC §162, IRC §168, IRC §469, Schedule E (Form 1040).',
  'child-tax-credit': 'IRC §24, IRC §24(h), IRS Schedule 8812, TCJA §11022.',
  'clean-vehicle': 'IRC §30D, IRC §25E, IRA §13401, IRS Form 8936.',
  'tax-loss-harvesting': 'IRC §1211, IRC §1212, IRC §1091 (wash-sale rule), IRS Publication 550, Schedule D (Form 1040).',
  'roth-conversion': 'IRC §408A, IRC §408(d)(3), IRC §72(t), IRS Publication 590-A, IRS Publication 590-B.',
  'home-sale-exclusion': 'IRC §121, Treas. Reg. §1.121-1 through §1.121-4, IRS Publication 523.',
};

export const STRATEGIES: StrategyDefinition[] = [
  {
    id: 'reasonable-comp',
    name: 'Reasonable Compensation Optimization',
    description: 'Many S Corp owners overpay themselves a salary, unnecessarily increasing payroll taxes. By establishing the lowest defensible "reasonable compensation" per IRS guidelines and taking the remainder as distributions, owners significantly reduce FICA exposure.',
    eligibleEntities: ['scorp'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['reasonable-comp'],
    eligibilityBullets: ['Owner must hold >50% of S Corporation stock', 'Must perform services for the corporation', 'Salary must be documented with payroll records', 'Reasonable comp threshold depends on industry, role, and comparable salaries'],
    implementationSteps: ['Obtain 3 comparable salary surveys for your role and industry', 'Consult with your CPA to determine the lowest defensible salary', 'Formally reduce W-2 salary via corporate payroll amendment', 'Document the analysis in corporate minutes', 'File amended payroll returns if reducing mid-year'],
    inputFields: [
      { key: 'currentSalary', label: 'Current Owner W-2 Salary', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'proposedSalary', label: 'Proposed Reasonable Compensation', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Must align with IRS standards for your industry.' },
    ],
    compute(inputs, plan) {
      const current = Number(inputs.currentSalary) || plan.ownerW2;
      const proposed = Number(inputs.proposedSalary) || 0;
      const reduction = Math.max(0, current - proposed);
      const belowBase = Math.min(reduction, Math.max(0, SS_WAGE_BASE_2025 - proposed));
      const aboveBase = Math.max(0, reduction - belowBase);
      return belowBase * 0.153 + aboveBase * 0.029;
    },
    warning: 'Ensure proposed salary aligns with IRS reasonable compensation standards. Document with industry salary surveys.',
  },
  {
    id: 'family-employment',
    name: 'Hiring Family Members (Income Shifting)',
    description: 'Paying legitimate wages to a spouse or children for real business services shifts income from the owner\'s higher bracket to the family member\'s lower bracket. S Corp and partnership wages paid to children under 18 are subject to FICA, but the income shifting benefit remains significant.',
    eligibleEntities: ['scorp', 'partnership', 'soleProp', 'individual'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['family-employment'],
    eligibilityBullets: ['Family member must perform genuine services', 'Wages must be reasonable for the work performed', 'Must document duties and maintain time records', 'Sole proprietors paying children under 18 are exempt from FICA on those wages'],
    implementationSteps: ['Document job description for each family member', 'Set wages comparable to what you\'d pay a non-family employee', 'Set up payroll and issue W-2s each year', 'Open a custodial IRA for minor children to further defer their income', 'Maintain contemporaneous time records'],
    inputFields: [
      { key: 'familyMemberName', label: 'Family Member Name (optional)', type: 'text', defaultValue: '', placeholder: 'e.g., Jane Smith' },
      { key: 'annualWages', label: 'Annual Wages to Be Paid', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'familyMemberRate', label: 'Family Member Marginal Rate (decimal)', type: 'number', defaultValue: 0.12, placeholder: '0.12', helpText: 'e.g., 0.12 for 12%' },
    ],
    compute(inputs, plan) {
      const wages = Number(inputs.annualWages) || 0;
      const familyRate = Number(inputs.familyMemberRate) || 0.12;
      return Math.max(0, wages * (plan.federalMarginalRate - familyRate));
    },
    notes: 'Wages must be reasonable and documented for actual services rendered.',
  },
  {
    id: 'accountable-plan',
    name: 'Accountable Plan — Business Expense Reimbursements',
    description: 'An accountable plan allows the entity to reimburse owner-employees for out-of-pocket business expenses tax-free. Without an accountable plan, TCJA eliminates these as miscellaneous itemized deductions. With a plan, reimbursements are deductible to the entity and non-taxable to the employee — creating payroll tax and income tax savings.',
    eligibleEntities: ['scorp', 'partnership'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['accountable-plan'],
    eligibilityBullets: ['Entity must adopt a written accountable plan', 'Expenses must have a business connection', 'Must have adequate accounting (receipts, logs)', 'Home office must be regular and exclusive use'],
    implementationSteps: ['Draft and adopt a written Accountable Plan document', 'Create expense reimbursement forms and submit monthly', 'Maintain receipts and mileage logs', 'For home office: calculate sq footage percentage annually', 'Process reimbursements through payroll or separate check'],
    inputFields: [
      { key: 'homeOfficeDirect', label: 'Home Office — Direct Expenses', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Repairs, dedicated equipment, etc.' },
      { key: 'totalHomeExpenses', label: 'Total Annual Home Expenses', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Mortgage interest/rent, utilities, insurance, repairs' },
      { key: 'officeSqFt', label: 'Office Square Footage', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'totalSqFt', label: 'Total Home Square Footage', type: 'number', defaultValue: 1, placeholder: '1' },
      { key: 'cellPhoneBill', label: 'Monthly Cell Phone Bill', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'cellBusinessPct', label: 'Cell Phone Business Use %', type: 'number', defaultValue: 80, placeholder: '80', min: 0, max: 100 },
      { key: 'internetBill', label: 'Monthly Internet Bill', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'internetBusinessPct', label: 'Internet Business Use %', type: 'number', defaultValue: 80, placeholder: '80', min: 0, max: 100 },
      { key: 'businessMiles', label: 'Business Miles Driven', type: 'number', defaultValue: 0, placeholder: '0', helpText: `IRS rate: $${MILEAGE_RATE_2025}/mile for 2025` },
      { key: 'meals', label: 'Business Meals (gross amount — 50% applied automatically)', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'travel', label: 'Business Travel', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'otherExpenses', label: 'Other Business Expenses', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const homeOfficeIndirect = (Number(inputs.totalHomeExpenses) || 0) * ((Number(inputs.officeSqFt) || 0) / Math.max(Number(inputs.totalSqFt) || 1, 1));
      const homeOfficeDirect = Number(inputs.homeOfficeDirect) || 0;
      const cell = (Number(inputs.cellPhoneBill) || 0) * 12 * ((Number(inputs.cellBusinessPct) || 80) / 100);
      const internet = (Number(inputs.internetBill) || 0) * 12 * ((Number(inputs.internetBusinessPct) || 80) / 100);
      const mileage = (Number(inputs.businessMiles) || 0) * MILEAGE_RATE_2025;
      const meals = (Number(inputs.meals) || 0) * 0.5; // IRC §274(n) — 50% limit
      const travel = Number(inputs.travel) || 0;
      const other = Number(inputs.otherExpenses) || 0;
      const total = homeOfficeDirect + homeOfficeIndirect + cell + internet + mileage + meals + travel + other;
      return total * (0.153 + plan.federalMarginalRate + plan.ilRate);
    },
    notes: 'Meals are 50% deductible to the corporation under IRC §274(n). The 50% limitation is automatically applied above.',
  },
  {
    id: 'health-insurance',
    name: 'Health Insurance Premium Deduction (>2% Shareholder)',
    description: 'S Corp owners owning more than 2% of the company can have the corporation pay or reimburse health, dental, vision, and LTC premiums. Premiums are included in W-2 wages but deducted above-the-line on Form 1040 (Schedule 1), reducing AGI and income tax.',
    eligibleEntities: ['scorp'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['health-insurance'],
    eligibilityBullets: ['Must own more than 2% of S Corporation stock', 'Coverage must be established under the S Corp', 'Premiums reported on W-2 Box 1 (not Boxes 3 and 5)', 'Self-employed health insurance deduction taken on Schedule 1'],
    implementationSteps: ['Establish health insurance plan under the S Corporation', 'Have premiums paid or reimbursed by the corporation', 'Include premiums in W-2 Box 1', 'Deduct on Schedule 1, Line 17 on Form 1040', 'Do not include in Social Security/Medicare wages'],
    inputFields: [
      { key: 'annualPremiums', label: 'Annual Health/Dental/Vision/LTC Premiums', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const premiums = Number(inputs.annualPremiums) || 0;
      return premiums * (plan.federalMarginalRate + plan.ilRate);
    },
  },
  {
    id: 'retirement-plan',
    name: 'Retirement Plan Contributions — Solo 401(k) / SEP-IRA / SIMPLE IRA',
    description: 'Owner-employees can make pre-tax contributions to qualified retirement plans, directly reducing taxable income. The Solo 401(k) allows up to $23,500 in employee deferrals (2025) plus a 25% employer profit-sharing contribution. SECURE 2.0 adds a super catch-up of $11,250 for ages 60–63.',
    eligibleEntities: ['scorp', 'soleProp', 'partnership'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['retirement-plan'],
    eligibilityBullets: ['Must have earned income / W-2 from the entity', 'Plan must be established by year-end (Solo 401k: 12/31; SEP: tax filing deadline)', 'SIMPLE IRA must be established before October 1 for new plans', 'SEP: no employee deferral — employer contributions only'],
    implementationSteps: ['Select the appropriate plan type for your situation', 'Establish the plan with a custodian before the applicable deadline', 'Compute maximum allowable contribution with your CPA', 'Make contribution by tax filing deadline (including extensions)', 'File Form 5500-EZ annually for Solo 401(k) with assets over $250,000'],
    inputFields: [
      { key: 'planType', label: 'Plan Type', type: 'select', options: [{ value: 'solo401k', label: 'Solo 401(k)' }, { value: 'sep', label: 'SEP-IRA' }, { value: 'simple', label: 'SIMPLE IRA' }], defaultValue: 'solo401k' },
      { key: 'employeeDeferral', label: 'Employee Deferral Amount', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Max varies by plan type and age — see limit display' },
      { key: 'employerContribution', label: 'Employer Profit-Sharing Contribution', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Typically 25% of W-2 wages; combined max $70,000' },
    ],
    compute(inputs, plan) {
      const planType = String(inputs.planType || 'solo401k');
      const limits = getRetirementLimits(planType, plan.ownerAge);

      if (planType === 'sep') {
        const employer = Number(inputs.employerContribution) || Math.min(plan.ownerW2 * 0.25, 70000);
        return Math.min(employer, limits.maxTotalContribution) * (plan.federalMarginalRate + plan.ilRate);
      }

      const deferral = Math.min(Number(inputs.employeeDeferral) || 0, limits.maxEmployeeDeferral);
      const employer = Number(inputs.employerContribution) || 0;
      const total = Math.min(deferral + employer, limits.maxTotalContribution);
      return total * (plan.federalMarginalRate + plan.ilRate);
    },
  },
  {
    id: 'cash-balance',
    name: 'Cash Balance / Defined Benefit Plan',
    description: 'A Cash Balance Plan allows business owners — especially those 45+ — to make dramatically larger pre-tax contributions than a 401(k) alone. Contributions can reach $100,000–$300,000+ per year for owners in their 50s and 60s. Actual contribution amounts require actuarial determination by a qualified TPA.',
    eligibleEntities: ['scorp', 'soleProp', 'partnership'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['cash-balance'],
    eligibilityBullets: ['Must have stable, recurring income to sustain required contributions', 'Requires annual actuarial valuation by a qualified TPA', 'Can be paired with a 401(k) for maximum benefit', 'Most beneficial for owners age 45+ with high income'],
    implementationSteps: ['Engage a qualified TPA (third-party administrator)', 'Obtain actuarial certification of allowable contribution', 'Establish the plan before year-end', 'Fund the plan by tax filing deadline', 'File Form 5500 annually'],
    inputFields: [
      { key: 'customContribution', label: 'Estimated Annual Contribution (leave 0 to auto-estimate by age)', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const custom = Number(inputs.customContribution) || 0;
      const estimated = custom > 0 ? custom : estimateCashBalanceContribution(plan.ownerAge, plan.ownerW2);
      return estimated * (plan.federalMarginalRate + plan.ilRate);
    },
    notes: 'Estimated contribution based on owner age. Actual deductible amount requires actuarial determination by a qualified TPA.',
    warning: 'This is an estimate only. Actual contribution limits require actuarial calculation.',
  },
  {
    id: 'sec179-bonus',
    name: 'Section 179 / Bonus Depreciation (Accelerated Depreciation)',
    description: 'Section 179 allows full expensing of equipment and qualified assets up to $1,220,000 for 2025. Bonus depreciation is currently 40% for 2025 under the TCJA phase-down schedule. The One Big Beautiful Bill Act (OBBBA) proposes restoring 100% retroactively to assets placed in service after January 19, 2025.',
    eligibleEntities: ['scorp', 'partnership', 'soleProp', 'individual'],
    isRecurring: false,
    ircReferences: STRATEGY_IRC_REFS['sec179-bonus'],
    eligibilityBullets: ['Asset must be used in trade or business', 'Section 179 phased out dollar-for-dollar above $3,050,000 of total asset additions', 'Passenger autos subject to luxury limits (max ~$12,400 first year)', 'Heavy SUVs (>6,000 lbs GVWR): Sec 179 capped at $31,300'],
    implementationSteps: ['Identify all qualifying asset purchases placed in service during the tax year', 'Elect Section 179 on Form 4562', 'Document business use percentage with contemporaneous records', 'Consult advisor re: OBBBA status before filing', 'Consider timing purchases before year-end'],
    inputFields: [
      { key: 'assetDescription', label: 'Asset Description (optional)', type: 'text', defaultValue: '', placeholder: 'e.g., Delivery truck' },
      { key: 'assetCost', label: 'Asset Cost', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'method', label: 'Method', type: 'select', options: [{ value: '179', label: 'Section 179' }, { value: 'bonus', label: 'Bonus Depreciation' }, { value: 'both', label: 'Both' }], defaultValue: '179' },
      { key: 'assetType', label: 'Asset Type', type: 'select', options: [{ value: 'general', label: 'General Equipment / Furniture' }, { value: 'suv', label: 'Heavy SUV (>6,000 lbs GVWR)' }, { value: 'auto', label: 'Listed Property / Passenger Auto' }, { value: 'qip', label: 'Real Property - QIP' }], defaultValue: 'general' },
      { key: 'useOBBBA', label: 'Model 100% bonus depreciation (OBBBA scenario)', type: 'checkbox', defaultValue: false, helpText: 'Toggle to model if OBBBA is enacted restoring 100% bonus depreciation retroactively to 2025.' },
    ],
    compute(inputs, plan) {
      const cost = Number(inputs.assetCost) || 0;
      const type = String(inputs.assetType);
      const bonusRate = Boolean(inputs.useOBBBA) ? BONUS_DEPRECIATION_OBBBA : BONUS_DEPRECIATION_2025;
      let deductible = 0;
      if (type === 'suv') {
        const sec179 = Math.min(cost, 31300);
        const remainder = cost - sec179;
        deductible = sec179 + remainder * bonusRate;
      } else if (type === 'auto') {
        deductible = Math.min(cost, 12400);
      } else if (type === 'qip') {
        deductible = cost * bonusRate;
      } else {
        const method = String(inputs.method);
        if (method === '179') deductible = Math.min(cost, 1220000);
        else if (method === 'bonus') deductible = cost * bonusRate;
        else deductible = Math.min(cost, 1220000);
      }
      return deductible * (plan.federalMarginalRate + plan.ilRate);
    },
    warning: '⚠ Legislative Update: The One Big Beautiful Bill Act proposes restoring 100% bonus depreciation retroactively to assets placed in service after 1/19/2025. Current law uses 40%. Toggle "OBBBA scenario" to model both.',
  },
  {
    id: 'augusta-rule',
    name: 'Augusta Rule — §280A(g) Home Rental',
    description: 'Under IRC §280A(g), a business owner may rent their personal residence to their business for up to 14 days per year for legitimate business purposes. The corporation deducts the rental as a business expense; the owner excludes the rental income entirely — no Schedule E, no tax.',
    eligibleEntities: ['scorp', 'soleProp', 'individual'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['augusta-rule'],
    eligibilityBullets: ['Personal residence rented 14 days or fewer per year', 'Must be used for legitimate business purposes (board meetings, strategy sessions)', 'Must use comparable venue rental rate (obtain 3 quotes)', 'S Corp must have proper corporate documentation', 'IRS has increased scrutiny — documentation is critical'],
    implementationSteps: ['Obtain 3 comparable venue rental quotes in your area', 'Adopt corporate minutes authorizing the rental', 'Issue a rental agreement between you and the corporation', 'Hold documented business meetings at the home', 'Ensure rental income is excluded on your personal return (line 8 Instructions, Schedule 1)'],
    inputFields: [
      { key: 'daysRented', label: 'Number of Days Rented (max 14)', type: 'number', defaultValue: 14, min: 1, max: 14 },
      { key: 'dailyRate', label: 'Daily Rental Rate ($)', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Based on comparable venue rental quotes in your area' },
    ],
    compute(inputs, plan) {
      const days = Math.min(Number(inputs.daysRented) || 0, 14);
      const rate = Number(inputs.dailyRate) || 0;
      return days * rate * (plan.federalMarginalRate + plan.ilRate);
    },
    notes: 'Document with at least 3 comparable venue rental rate quotes. Corporate minutes must reflect the business purpose of each meeting.',
    warning: 'The IRS has challenged Augusta Rule arrangements without proper documentation. Maintain contemporaneous records and comparable venue quotes.',
  },
  {
    id: 'ptet-salt',
    name: 'PTET / SALT Workaround + IL Replacement Tax',
    description: 'Illinois allows pass-through entities to elect to pay IL income tax at the entity level (PTET), effectively bypassing the SALT deduction cap. The owner receives a dollar-for-dollar IL income tax credit. For S Corps in IL, the 1.5% Replacement Tax is also deductible as a federal business expense.',
    eligibleEntities: ['scorp', 'partnership'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['ptet-salt'],
    eligibilityBullets: ['Entity must elect PTET annually (Form IL-1120-ST or IL-1065)', 'IL PTET must be paid by the entity by year-end', 'Owner receives dollar-for-dollar IL personal income tax credit', 'S Corps in IL also subject to 1.5% Replacement Tax (separately deductible at federal level)', 'Other states may have analogous PTET elections — consult your advisor'],
    implementationSteps: ['Make the annual PTET election on IL-1120-ST or IL-1065', 'Remit PTET payment by December 31 of the tax year', 'Claim IL PTET credit on personal IL-1040 Schedule CR', 'Separately track IL Replacement Tax (S Corps) — deducted on federal return', 'Confirm state PTET availability if operating outside Illinois'],
    inputFields: [
      { key: 'passThruIncome', label: "Owner's Share of IL-Sourced Pass-Through Income", type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'ilNetIncomeRT', label: 'IL Net Income Subject to Replacement Tax (S Corp only)', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Leave 0 to auto-estimate from net business income' },
      { key: 'stateHasPTET', label: "State offers a PTET election (non-IL)", type: 'checkbox', defaultValue: false, helpText: 'Check if your state has a PTET election analogous to Illinois' },
    ],
    compute(inputs, plan) {
      const income = Number(inputs.passThruIncome) || (plan.netBusinessIncome * plan.ownershipPct / 100);
      const pteTax = income * 0.0495;
      const ptetSavings = pteTax * plan.federalMarginalRate;

      let replacementTaxSavings = 0;
      if (plan.entityType === 'scorp' && (plan.state === 'Illinois' || !plan.state)) {
        const rtIncome = Number(inputs.ilNetIncomeRT) || (plan.netBusinessIncome * plan.ownershipPct / 100);
        const rtTax = rtIncome * 0.015;
        replacementTaxSavings = rtTax * plan.federalMarginalRate;
      }
      return ptetSavings + replacementTaxSavings;
    },
    notes: 'IL PTET credit offsets owner\'s IL personal tax dollar-for-dollar. Net IL cost = $0. IL Replacement Tax is reported on IL-1120-ST Schedule B.',
  },
  {
    id: 'qbi',
    name: 'Qualified Business Income (QBI) Deduction — §199A',
    description: 'Owners of pass-through businesses may deduct up to 20% of qualified business income under §199A, reducing federal income tax. The deduction is subject to W-2 wage limitations above certain income thresholds and phases out for Specified Service Trades or Businesses (SSTB) at higher income levels.',
    eligibleEntities: ['scorp', 'partnership', 'soleProp'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['qbi'],
    eligibilityBullets: ['Pass-through income from qualified trade or business', 'Income below phase-out threshold: full 20% deduction', 'Above threshold: limited to 50% of W-2 wages or 25% wages + 2.5% UBIA', 'SSTB businesses (law, accounting, health, consulting) face income-based phase-out', 'Does not reduce Illinois income tax'],
    implementationSteps: ['Confirm entity qualifies as a trade or business under IRC §162', 'Calculate QBI using Form 8995 or 8995-A', 'For SSTBs: model income below phase-out threshold (consider pension contributions to reduce AGI)', 'Optimize W-2 wages to maximize the 50% W-2 wage limitation', 'Consult advisor on aggregation rules for multiple entities'],
    inputFields: [
      { key: 'isSSTB', label: 'Is this a Specified Service Trade or Business (SSTB)?', type: 'checkbox', defaultValue: false },
      { key: 'qbi', label: 'Qualified Business Income', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Typically equal to net business income' },
      { key: 'entityW2Wages', label: 'W-2 Wages Paid by Entity', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'ubia', label: 'Unadjusted Basis of Qualified Property (optional)', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const qbi = Number(inputs.qbi) || plan.netBusinessIncome;
      const w2 = Number(inputs.entityW2Wages) || 0;
      const ubia = Number(inputs.ubia) || 0;
      const isSSTB = Boolean(inputs.isSSTB);
      let tentative = qbi * 0.20;
      const w2Limit = Math.max(w2 * 0.50, w2 * 0.25 + ubia * 0.025);
      const limited = plan.agi > 197300 ? Math.min(tentative, w2Limit) : tentative;
      let final = limited;
      if (isSSTB) {
        const threshold = plan.filingStatus === 'mfj' ? 394600 : 197300;
        const phaseEnd = plan.filingStatus === 'mfj' ? 494600 : 247300;
        if (plan.agi >= phaseEnd) final = 0;
        else if (plan.agi > threshold) {
          const ratio = (plan.agi - threshold) / (phaseEnd - threshold);
          final = final * (1 - ratio);
        }
      }
      return Math.max(0, final) * plan.federalMarginalRate;
    },
    notes: 'QBI deduction does NOT reduce Illinois income tax. If already being taken, use this to model optimization (e.g., increasing W-2 wages to maximize the W-2 limitation).',
  },
  {
    id: 'itemized-vs-standard',
    name: 'Itemized Deductions vs. Standard Deduction Optimization',
    description: 'Many taxpayers default to the standard deduction without analyzing whether itemizing would produce a larger deduction. This strategy models both scenarios and shows the incremental federal tax savings from itemizing vs. the 2025 standard deduction, including the full impact of the $40,000 SALT cap.',
    eligibleEntities: ['individual'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['itemized-vs-standard'],
    inputFields: [],
    compute(_inputs, plan) {
      const salt = Math.min(plan.propertyTaxes + plan.stateIncomeTaxesPaid, SALT_CAP_2025);
      const medDeductible = Math.max(0, plan.medicalExpenses - plan.agi * 0.075);
      const totalItemized = plan.mortgageInterestPrimary + plan.mortgageInterestSecond
        + plan.charitableCash + plan.charitableNonCash
        + salt + medDeductible + plan.otherItemizedDeductions;
      const stdDeduction = getStandardDeduction(plan.filingStatus);
      const incremental = Math.max(0, totalItemized - stdDeduction);
      return incremental * plan.federalMarginalRate;
    },
  },
  {
    id: 'daf-bunching',
    name: 'Donor-Advised Fund (DAF) — Charitable Bunching',
    description: 'A DAF allows you to contribute multiple years of charitable giving at once, bunching them to exceed the standard deduction and generate a larger incremental deduction. Appreciated securities may be contributed at fair market value — completely avoiding capital gains tax on the appreciation.',
    eligibleEntities: ['individual'],
    isRecurring: false,
    ircReferences: STRATEGY_IRC_REFS['daf-bunching'],
    eligibilityBullets: ['Taxpayer must currently be taking the standard deduction (or close to it)', 'DAF must be established at a qualified sponsoring organization', 'Contribution of appreciated securities: held long-term for maximum benefit', 'DAF grants must go to 501(c)(3) organizations'],
    implementationSteps: ['Open a DAF account at Fidelity Charitable, Schwab Charitable, or Vanguard Charitable', 'Identify securities with large unrealized gains', 'Contribute 2-5 years of planned giving in one year to bunch past the standard deduction', 'Recommend grants from DAF in subsequent years', 'Document all contributions with acknowledgment letters'],
    inputFields: [
      { key: 'annualGiving', label: 'Annual Charitable Giving', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'yearsToBunch', label: 'Years to Bunch', type: 'select', options: [{ value: '2', label: '2 Years' }, { value: '3', label: '3 Years' }, { value: '4', label: '4 Years' }, { value: '5', label: '5 Years' }], defaultValue: '3' },
      { key: 'contributionType', label: 'Contribution Type', type: 'select', options: [{ value: 'cash', label: 'Cash' }, { value: 'securities', label: 'Appreciated Securities' }, { value: 'both', label: 'Both' }], defaultValue: 'cash' },
      { key: 'costBasis', label: 'Cost Basis (if contributing securities)', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'fmv', label: 'Fair Market Value (if contributing securities)', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const annual = Number(inputs.annualGiving) || plan.charitableCash;
      const years = Number(inputs.yearsToBunch) || 3;
      const bunched = annual * years;
      const salt = Math.min(plan.propertyTaxes + plan.stateIncomeTaxesPaid, SALT_CAP_2025);
      const newItemized = plan.mortgageInterestPrimary + plan.mortgageInterestSecond + plan.otherItemizedDeductions + salt + bunched;
      const stdDeduction = getStandardDeduction(plan.filingStatus);
      const incremental = Math.max(0, newItemized - stdDeduction);
      let savings = incremental * plan.federalMarginalRate;
      const type = String(inputs.contributionType);
      if (type === 'securities' || type === 'both') {
        const basis = Number(inputs.costBasis) || 0;
        const fmv = Number(inputs.fmv) || 0;
        const gain = Math.max(0, fmv - basis);
        savings += gain * computeLTCGRate(plan.agi, plan.filingStatus);
      }
      return savings;
    },
    notes: 'Appreciated securities contributed to a DAF avoid capital gains tax entirely and receive a deduction at fair market value.',
  },
  {
    id: 'hsa',
    name: 'Health Savings Account (HSA) Optimization',
    description: 'Individuals enrolled in a High Deductible Health Plan (HDHP) can contribute to an HSA and deduct contributions above-the-line on Form 1040. For 2025: $4,300 self-only, $8,550 family, plus $1,000 catch-up for age 55+. Contributions grow tax-free; qualified medical withdrawals are tax-free.',
    eligibleEntities: ['individual'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['hsa'],
    eligibilityBullets: ['Must be enrolled in a qualifying High Deductible Health Plan (HDHP)', 'Cannot be enrolled in Medicare', 'Cannot be claimed as a dependent', '>2% S Corp shareholders: cannot contribute pre-tax through payroll; deduct on Schedule 1'],
    implementationSteps: ['Confirm HDHP enrollment', 'Open HSA account at a bank or investment custodian', 'For S Corp owners: make contributions personally and deduct on Schedule 1, Line 13', 'Invest HSA funds for long-term tax-free growth', 'Keep receipts for all qualified medical expenses'],
    inputFields: [
      { key: 'coverageType', label: 'Coverage Type', type: 'select', options: [{ value: 'self', label: 'Self-Only ($4,300)' }, { value: 'family', label: 'Family ($8,550)' }], defaultValue: 'family' },
      { key: 'existingContributions', label: 'Existing HSA Contributions This Year', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const family = String(inputs.coverageType) === 'family';
      const base = family ? 8550 : 4300;
      const catchUp = plan.ownerAge >= 55 ? 1000 : 0;
      const limit = base + catchUp;
      const existing = Number(inputs.existingContributions) || 0;
      const room = Math.max(0, limit - existing);
      return room * (plan.federalMarginalRate + plan.ilRate);
    },
    notes: 'As a >2% S Corp shareholder, HSA contributions cannot be made pre-tax through payroll. Contribute personally and deduct on Schedule 1, Line 13.',
  },
  {
    id: 'vehicle-deduction',
    name: 'Vehicle Deduction (Section 179 / Bonus / Actual Expense)',
    description: 'Business vehicles are deductible, with amounts varying significantly by vehicle type and weight. Heavy SUVs and trucks over 6,000 lbs GVWR qualify for Sec 179 up to $31,300 plus bonus depreciation on the remainder. Large commercial vehicles over 14,000 lbs can be fully expensed.',
    eligibleEntities: ['scorp', 'partnership', 'soleProp', 'individual'],
    isRecurring: false,
    ircReferences: STRATEGY_IRC_REFS['vehicle-deduction'],
    eligibilityBullets: ['Vehicle must be used primarily for business', 'Business use percentage must be documented with mileage log', 'Passenger autos subject to annual luxury limits', 'Heavy SUVs (6,001-14,000 lbs) Sec 179 capped at $31,300'],
    implementationSteps: ['Confirm vehicle GVWR from manufacturer specifications', 'Establish and maintain contemporaneous mileage log', 'Elect Sec 179 on Form 4562', 'Document 5-year recapture risk if business use drops below 50%', 'Consider IRS Listed Property rules for SUVs used for commuting'],
    inputFields: [
      { key: 'vehiclePrice', label: 'Vehicle Purchase Price', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'gvwrCategory', label: 'Vehicle GVWR Category', type: 'select', options: [{ value: 'passenger', label: 'Under 6,000 lbs (Passenger Auto)' }, { value: 'suv', label: '6,001–14,000 lbs (Heavy SUV/Truck)' }, { value: 'commercial', label: 'Over 14,000 lbs (Large Commercial)' }], defaultValue: 'suv' },
      { key: 'businessUsePct', label: 'Business Use Percentage', type: 'number', defaultValue: 100, min: 0, max: 100 },
    ],
    compute(inputs, plan) {
      const price = Number(inputs.vehiclePrice) || 0;
      const biz = (Number(inputs.businessUsePct) || 100) / 100;
      const bizCost = price * biz;
      const cat = String(inputs.gvwrCategory);
      let deductible = 0;
      if (cat === 'passenger') deductible = Math.min(bizCost, 12400);
      else if (cat === 'suv') {
        const sec179 = Math.min(bizCost, 31300);
        deductible = sec179 + (bizCost - sec179) * BONUS_DEPRECIATION_2025;
      } else {
        deductible = bizCost;
      }
      return deductible * (plan.federalMarginalRate + plan.ilRate);
    },
    notes: 'Document business use with a contemporaneous mileage log. Luxury auto limits apply to vehicles under 6,000 lbs GVWR.',
  },
  {
    id: 'property-rental',
    name: 'Renting Personal Property to the Business',
    description: 'S Corp owners can rent personally owned assets (equipment, storage) to their business. The business deducts the rental payment; the owner reports rental income on Schedule E but offsets it with depreciation, often resulting in a net tax benefit.',
    eligibleEntities: ['scorp', 'soleProp'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['property-rental'],
    inputFields: [
      { key: 'propertyDescription', label: 'Property Description (optional)', type: 'text', defaultValue: '', placeholder: 'e.g., Equipment, storage unit' },
      { key: 'annualRental', label: 'Annual Rental Amount', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'depreciationOffsets', label: 'Estimated Depreciation / Expense Offsets (Schedule E)', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const rental = Number(inputs.annualRental) || 0;
      const offsets = Number(inputs.depreciationOffsets) || 0;
      const netRentalIncome = Math.max(0, rental - offsets);
      const entitySavings = rental * (plan.federalMarginalRate + plan.ilRate);
      const personalTax = netRentalIncome * plan.federalMarginalRate;
      return Math.max(0, entitySavings - personalTax);
    },
  },
  {
    id: 'cost-segregation',
    name: 'Cost Segregation Study',
    description: 'A cost segregation study reclassifies portions of a building from 39-year or 27.5-year depreciation to 5, 7, or 15-year property, dramatically accelerating deductions. Reclassified components qualify for bonus depreciation. Studies typically identify 20–40% of building cost as accelerated property.',
    eligibleEntities: ['scorp', 'partnership', 'soleProp'],
    isRecurring: false,
    ircReferences: STRATEGY_IRC_REFS['cost-segregation'],
    eligibilityBullets: ['Own commercial, residential rental, or mixed-use real property', 'Most cost-effective for buildings over $500,000', 'Can be applied retroactively via catch-up depreciation (Form 3115)', 'Cost segregation studies are themselves deductible as a business expense'],
    implementationSteps: ['Engage a qualified cost segregation firm', 'Provide building purchase documents and cost records', 'Review and approve the engineering report', 'Adopt method change on Form 3115 if retroactive', 'File with tax return and document the study'],
    inputFields: [
      { key: 'buildingCost', label: 'Building Purchase Price / Cost Basis', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'buildingType', label: 'Building Type', type: 'select', options: [{ value: 'commercial', label: 'Commercial / Office' }, { value: 'retail', label: 'Retail' }, { value: 'warehouse', label: 'Warehouse' }, { value: 'mixed', label: 'Mixed-Use' }, { value: 'residential', label: 'Residential Rental' }], defaultValue: 'commercial' },
      { key: 'reclassificationPct', label: 'Estimated Reclassification Percentage', type: 'number', defaultValue: 25, min: 15, max: 40, placeholder: '25' },
    ],
    compute(inputs, plan) {
      const cost = Number(inputs.buildingCost) || 0;
      const pct = (Number(inputs.reclassificationPct) || 25) / 100;
      const buildingType = String(inputs.buildingType);
      const recoveryYears = buildingType === 'residential' ? 27.5 : 39;
      const reclassified = cost * pct;
      const standardDepreciation = cost / recoveryYears;
      const accelerated = reclassified * BONUS_DEPRECIATION_2025;
      const incremental = Math.max(0, accelerated - standardDepreciation);
      return incremental * (plan.federalMarginalRate + plan.ilRate);
    },
    notes: 'Cost segregation study fees ($5,000–$15,000) are themselves deductible. ROI is typically 10:1 or better for buildings over $1M.',
  },
  {
    id: 'qoz',
    name: 'Qualified Opportunity Zone (QOZ) Investment',
    description: 'By investing capital gains into a Qualified Opportunity Fund (QOF) within 180 days of realization, taxpayers can defer federal capital gains tax until December 31, 2026. Investments held 10+ years pay zero federal tax on appreciation within the QOF.',
    eligibleEntities: ['scorp', 'partnership', 'soleProp', 'individual'],
    isRecurring: false,
    ircReferences: STRATEGY_IRC_REFS['qoz'],
    inputFields: [
      { key: 'capitalGains', label: 'Capital Gains Amount Being Invested', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'holdPeriod', label: 'Estimated QOF Investment Period', type: 'select', options: [{ value: '5', label: '5 Years' }, { value: '7', label: '7 Years' }, { value: '10', label: '10+ Years' }], defaultValue: '10' },
      { key: 'appreciationRate', label: 'Estimated Annual Appreciation Rate (%)', type: 'number', defaultValue: 7, placeholder: '7' },
    ],
    compute(inputs, plan) {
      const gains = Number(inputs.capitalGains) || 0;
      const ltcgRate = computeLTCGRate(plan.agi, plan.filingStatus);
      const deferralBenefit = gains * ltcgRate;
      const hold = Number(inputs.holdPeriod) || 10;
      const appreciation = hold >= 10 ? gains * Math.pow(1 + (Number(inputs.appreciationRate) || 7) / 100, hold) - gains : 0;
      const eliminationBenefit = hold >= 10 ? appreciation * ltcgRate : 0;
      return deferralBenefit + eliminationBenefit;
    },
    warning: 'QOZ investment involves risk and illiquidity. This is a tax planning estimate only — consult a QOZ investment advisor before investing.',
  },
  {
    id: 'rd-credit',
    name: 'R&D Tax Credit (Section 41)',
    description: 'The R&D Tax Credit provides a dollar-for-dollar federal tax credit for qualified research expenses including wages, supplies, and contract research. For small businesses under $5M gross receipts, up to $250,000 can be applied against payroll taxes. One of the most underutilized credits in the tax code.',
    eligibleEntities: ['scorp', 'partnership', 'soleProp'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['rd-credit'],
    inputFields: [
      { key: 'researchWages', label: 'Qualified Research Wages', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'researchSupplies', label: 'Qualified Research Supplies', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'contractResearch', label: 'Contract Research Expenses', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'method', label: 'Credit Method', type: 'select', options: [{ value: 'asc', label: 'Alternative Simplified Credit (14%)' }, { value: 'first', label: 'First Year / No History (6%)' }], defaultValue: 'asc' },
    ],
    compute(inputs, _plan) {
      const wages = Number(inputs.researchWages) || 0;
      const supplies = Number(inputs.researchSupplies) || 0;
      const contract = Number(inputs.contractResearch) || 0;
      const qres = wages + supplies + (contract * 0.65);
      return qres * (String(inputs.method) === 'asc' ? 0.14 : 0.06);
    },
    notes: 'R&D Credit reduces tax liability dollar-for-dollar. Requires contemporaneous documentation of qualified research activities.',
  },
  {
    id: 'captive-insurance',
    name: 'Captive Insurance Company',
    description: 'A captive insurance company is wholly owned by the insured business. The business pays deductible premiums to the captive, which accumulates reserves. For small captives making the 831(b) election, investment income is tax-exempt. Typically suitable for businesses with $500K+ in insurable risk.',
    eligibleEntities: ['scorp', 'partnership'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['captive-insurance'],
    inputFields: [
      { key: 'annualPremium', label: 'Annual Premium to Captive', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const premium = Number(inputs.annualPremium) || 0;
      return premium * (plan.federalMarginalRate + plan.ilRate);
    },
    warning: 'Captive insurance is subject to heightened IRS scrutiny. Engage a qualified captive manager and ensure premiums are actuarially supported. Listed as an IRS Transaction of Interest in some configurations.',
  },
  {
    id: 'scorp-election',
    name: 'S Corp Election / Entity Structure Optimization',
    description: 'For sole proprietors and single-member LLCs earning $40,000+ in net profit, electing S Corporation status can generate significant payroll tax savings by splitting income between a reasonable salary (subject to FICA) and distributions (not subject to SE tax).',
    eligibleEntities: ['soleProp', 'partnership'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['scorp-election'],
    inputFields: [
      { key: 'netSEIncome', label: 'Current Net Self-Employment Income', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'proposedSalary', label: 'Proposed Reasonable Compensation if S Corp', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const seIncome = Number(inputs.netSEIncome) || plan.netBusinessIncome;
      const proposed = Number(inputs.proposedSalary) || 0;
      const currentSETax = Math.min(seIncome * 0.9235, SS_WAGE_BASE_2025) * 0.153 + Math.max(0, seIncome * 0.9235 - SS_WAGE_BASE_2025) * 0.029;
      const sCorpPayroll = Math.min(proposed, SS_WAGE_BASE_2025) * 0.153 + Math.max(0, proposed - SS_WAGE_BASE_2025) * 0.029;
      return Math.max(0, currentSETax - sCorpPayroll);
    },
    notes: 'Net savings should exceed annual S Corp compliance costs (~$2,000–$4,000) for this to be beneficial.',
  },
  {
    id: 'ic-disc',
    name: 'IC-DISC (Interest Charge Domestic International Sales Corporation)',
    description: 'An IC-DISC is a special purpose entity that converts ordinary export income into qualified dividend income taxed at preferential LTCG rates. Best for businesses with $1M+ in U.S. export sales.',
    eligibleEntities: ['scorp', 'partnership'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['ic-disc'],
    inputFields: [
      { key: 'exportSales', label: 'Annual Export Sales', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'commission', label: 'Estimated IC-DISC Commission (leave 0 to auto-estimate)', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const exports = Number(inputs.exportSales) || 0;
      const netExport = exports * 0.20;
      const auto = Math.max(netExport * 0.50, exports * 0.04);
      const commission = Number(inputs.commission) || auto;
      const dividendRate = computeLTCGRate(plan.agi, plan.filingStatus);
      return commission * (plan.federalMarginalRate - dividendRate);
    },
    notes: 'IC-DISC setup typically costs $3,000–$8,000 annually. Recommended for businesses with $1M+ in export sales.',
  },
  // ── NEW STRATEGIES 24–28 ──────────────────────────────────────────────────
  {
    id: 'child-tax-credit',
    name: 'Child Tax Credit (§24)',
    description: 'Taxpayers with qualifying children under age 17 may claim a Child Tax Credit of $2,000 per child (2025), with up to $1,700 refundable as the Additional Child Tax Credit. The credit begins phasing out at $400,000 AGI (MFJ) or $200,000 (Single). This is a dollar-for-dollar credit — not a deduction.',
    eligibleEntities: ['individual'],
    isRecurring: true,
    ircReferences: STRATEGY_IRC_REFS['child-tax-credit'],
    eligibilityBullets: ['Child must be under age 17 at end of tax year', 'Must be a qualifying child (dependent, lived with taxpayer > 6 months)', 'Subject to income phase-out', 'Up to $1,700 per child refundable as Additional Child Tax Credit'],
    implementationSteps: ['Confirm each child meets the qualifying child definition', 'Complete Schedule 8812 with your return', 'Ensure child has a Social Security Number', 'Model impact of reducing AGI (via retirement contributions) to stay below phase-out threshold'],
    inputFields: [
      { key: 'numberOfChildren', label: 'Number of Qualifying Children Under 17', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Pre-fill from dependents in Step 1' },
    ],
    compute(inputs, plan) {
      const children = Number(inputs.numberOfChildren) || plan.numberOfDependents;
      if (children <= 0) return 0;
      const fullCredit = children * 2000;
      const threshold = plan.filingStatus === 'mfj' ? 400000 : 200000;
      const excess = Math.max(0, plan.agi - threshold);
      const reduction = Math.ceil(excess / 1000) * 50;
      return Math.max(0, fullCredit - reduction);
    },
    notes: 'Up to $1,700 per child may be refundable as the Additional Child Tax Credit (ACTC) via Schedule 8812. This is a credit — not multiplied by tax rate.',
  },
  {
    id: 'clean-vehicle',
    name: 'Clean Vehicle Credit (§30D / §25E)',
    description: 'Purchasers of new qualifying electric or plug-in hybrid vehicles may claim a federal tax credit of up to $7,500 (new) or $4,000 (used). For 2025, the credit is subject to MAGI limits of $300,000 (MFJ) or $150,000 (Single) for new vehicles. The credit is now transferable to dealers at point of sale.',
    eligibleEntities: ['individual'],
    isRecurring: false,
    ircReferences: STRATEGY_IRC_REFS['clean-vehicle'],
    eligibilityBullets: ['Vehicle must be on IRS qualified vehicle list', 'MAGI limits: $300,000 MFJ, $225,000 HOH, $150,000 Single (new); $150,000 MFJ, $112,500 HOH, $75,000 Single (used)', 'Credit cannot be carried forward', 'Dealer transfer option: credit can be transferred to dealer at purchase (immediate benefit)'],
    implementationSteps: ['Confirm vehicle is on the current IRS qualified vehicle list at fueleconomy.gov', 'Verify your MAGI is below the applicable threshold', 'Consider dealer transfer option for immediate benefit', 'Complete Form 8936 with your tax return', 'Keep vehicle purchase documentation'],
    inputFields: [
      { key: 'vehicleType', label: 'Vehicle Type', type: 'select', options: [{ value: 'new_ev', label: 'New EV (up to $7,500)' }, { value: 'new_phev', label: 'New PHEV (up to $3,750)' }, { value: 'used', label: 'Used EV/PHEV (§25E)' }], defaultValue: 'new_ev' },
      { key: 'vehicleMagi', label: 'MAGI for Clean Vehicle Purposes', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Pre-filled from AGI; may differ slightly from AGI' },
      { key: 'usedPrice', label: 'Used Vehicle Sale Price (if applicable)', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const magi = Number(inputs.vehicleMagi) || plan.agi;
      const type = String(inputs.vehicleType);
      const newLimit = plan.filingStatus === 'mfj' ? 300000 : plan.filingStatus === 'hoh' ? 225000 : 150000;
      const usedLimit = plan.filingStatus === 'mfj' ? 150000 : plan.filingStatus === 'hoh' ? 112500 : 75000;
      if (type === 'used') {
        if (magi > usedLimit) return 0;
        return Math.min((Number(inputs.usedPrice) || 0) * 0.30, 4000);
      }
      if (magi > newLimit) return 0;
      return type === 'new_phev' ? 3750 : 7500;
    },
    notes: 'Vehicle must be on the IRS qualified vehicle list (fueleconomy.gov). Credit can be transferred to the dealer at point of sale for immediate cash benefit.',
  },
  {
    id: 'tax-loss-harvesting',
    name: 'Tax Loss Harvesting',
    description: 'Selling investments at a loss offsets capital gains and reduces tax liability. Losses first offset same-type gains (long-term vs. short-term), then cross-offset, then up to $3,000 of ordinary income per year. Excess losses carry forward indefinitely. Beware the wash-sale rule: repurchasing substantially identical securities within 30 days disallows the loss.',
    eligibleEntities: ['individual'],
    isRecurring: false,
    ircReferences: STRATEGY_IRC_REFS['tax-loss-harvesting'],
    eligibilityBullets: ['Must hold investments in taxable accounts (not IRAs/401k)', 'Wash-sale rule: no repurchase of substantially identical securities within 30 days before or after sale', 'Short-term losses offset short-term gains first (taxed at ordinary income rates)', 'Long-term losses offset long-term gains first (taxed at preferential LTCG rates)', '$3,000/year ordinary income offset; excess carries forward indefinitely'],
    implementationSteps: ['Identify positions with unrealized losses in taxable accounts', 'Sell positions before year-end to realize losses', 'Replace with similar (but not substantially identical) securities to maintain market exposure', 'Track wash-sale window (30 days before and after sale)', 'Report on Schedule D and Form 8949'],
    inputFields: [
      { key: 'unrealizedLosses', label: 'Unrealized Capital Losses Available', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'ltcgGains', label: 'Current Year Long-Term Capital Gains', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'stcgGains', label: 'Current Year Short-Term Capital Gains', type: 'number', defaultValue: 0, placeholder: '0' },
    ],
    compute(inputs, plan) {
      const losses = Number(inputs.unrealizedLosses) || 0;
      const ltcg = Number(inputs.ltcgGains) || 0;
      const stcg = Number(inputs.stcgGains) || 0;
      const ltcgOffset = Math.min(losses, ltcg);
      const remainingLosses = losses - ltcgOffset;
      const stcgOffset = Math.min(remainingLosses, stcg);
      const finalRemaining = remainingLosses - stcgOffset;
      const ordinaryOffset = Math.min(finalRemaining, 3000);
      const ltcgRate = computeLTCGRate(plan.agi, plan.filingStatus);
      return ltcgOffset * ltcgRate + stcgOffset * plan.federalMarginalRate + ordinaryOffset * plan.federalMarginalRate;
    },
    notes: 'Wash-sale rule (IRC §1091): Do not repurchase substantially identical securities within 30 days before or after the sale.',
  },
  {
    id: 'roth-conversion',
    name: 'Roth Conversion / Roth 401(k) Analysis',
    description: 'Converting traditional IRA/401(k) assets to Roth can be advantageous when current tax rates are lower than expected future rates. Roth assets grow tax-free with no required minimum distributions. This strategy models the long-term benefit of paying tax now at a lower rate vs. paying later at a potentially higher rate.',
    eligibleEntities: ['individual'],
    isRecurring: false,
    ircReferences: STRATEGY_IRC_REFS['roth-conversion'],
    inputFields: [
      { key: 'conversionAmount', label: 'Proposed Conversion / Roth Contribution Amount', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'currentRate', label: 'Current Effective Tax Rate on Conversion', type: 'number', defaultValue: 0, placeholder: '0', helpText: 'Enter as decimal; pre-filled from marginal rate' },
      { key: 'retirementRateScenario', label: 'Expected Tax Rate in Retirement', type: 'select', options: [{ value: 'lower', label: 'Lower than today (traditional may be better)' }, { value: 'same', label: 'Same as today' }, { value: 'higher', label: 'Higher than today (Roth is better)' }], defaultValue: 'higher' },
      { key: 'yearsToRetirement', label: 'Years to Retirement', type: 'number', defaultValue: 20, placeholder: '20' },
      { key: 'growthRate', label: 'Expected Annual Growth Rate (%)', type: 'number', defaultValue: 7, placeholder: '7' },
    ],
    compute(inputs, plan) {
      const amount = Number(inputs.conversionAmount) || 0;
      const rate = Number(inputs.currentRate) || plan.federalMarginalRate;
      const scenario = String(inputs.retirementRateScenario);
      const years = Number(inputs.yearsToRetirement) || 20;
      const growth = (Number(inputs.growthRate) || 7) / 100;
      const taxNow = amount * rate;
      const rothBalance = (amount - taxNow) * Math.pow(1 + growth, years);
      const futureRate = scenario === 'higher' ? rate * 1.25 : scenario === 'same' ? rate : rate * 0.75;
      const tradBalance = amount * Math.pow(1 + growth, years) * (1 - futureRate);
      return Math.max(0, rothBalance - tradBalance);
    },
    notes: 'Roth conversions increase current-year AGI and may affect IRMAA, ACA subsidies, and QBI phase-outs. Model carefully. Consider spreading conversions across multiple years.',
    warning: 'This is a long-term projection model. Actual results depend on future tax rates, investment returns, and your specific circumstances.',
  },
  {
    id: 'home-sale-exclusion',
    name: '§121 Home Sale Exclusion — Planning Strategy',
    description: 'Taxpayers who have owned and used their primary residence for at least 2 of the last 5 years may exclude up to $500,000 (MFJ) or $250,000 (Single) of gain from the sale from federal income tax. This is one of the largest tax benefits available to individuals. Planning around the 2-year ownership/use test is essential.',
    eligibleEntities: ['individual'],
    isRecurring: false,
    ircReferences: STRATEGY_IRC_REFS['home-sale-exclusion'],
    eligibilityBullets: ['Must have owned AND used as primary residence for 2+ of last 5 years', 'Can only be used once every 2 years', 'Partial exclusion available for job change, health, or unforeseen circumstances', 'Home office depreciation recaptured at 25% rate (unrecaptured §1250 gain)'],
    implementationSteps: ['Confirm ownership and use test is met (or will be met before sale)', 'Calculate adjusted basis (purchase price + capital improvements)', 'Determine exclusion amount based on filing status', 'Consult advisor re: home office depreciation recapture', 'Consider timing of sale to maximize exclusion'],
    inputFields: [
      { key: 'salePrice', label: 'Estimated Home Sale Price', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'adjustedBasis', label: 'Adjusted Basis (Purchase Price + Improvements)', type: 'number', defaultValue: 0, placeholder: '0' },
      { key: 'ownershipTestMet', label: 'Ownership/use test met (owned and used 2+ of last 5 years)', type: 'checkbox', defaultValue: true },
    ],
    compute(inputs, plan) {
      if (!Boolean(inputs.ownershipTestMet)) return 0;
      const salePrice = Number(inputs.salePrice) || 0;
      const basis = Number(inputs.adjustedBasis) || 0;
      const gain = Math.max(0, salePrice - basis);
      const exclusionLimit = plan.filingStatus === 'mfj' ? 500000 : 250000;
      const exclusion = Math.min(gain, exclusionLimit);
      const ltcgRate = computeLTCGRate(plan.agi, plan.filingStatus);
      return exclusion * ltcgRate;
    },
    notes: 'Partial exclusion may be available if 2-year test not fully met due to job change, health, or unforeseen circumstances (IRC §121(c)).',
  },
];

// Strategies that appear ONLY on the Individual (1040) tab.
// Rules:
//   - Business-entity strategies (reasonable-comp, accountable-plan, etc.) are NOT listed here.
//   - 'family-employment', 'sec179-bonus', 'vehicle-deduction', 'qoz' are ALL-entity and NOT listed here.
//   - 'scorp-election' targets soleProp/partnership business tabs — NOT listed here.
//   - Everything listed here must have eligibleEntities: ['individual'].
// NOTE: All strategies below have eligibleEntities: ['individual'] — the
// PERSONAL_STRATEGY_IDS set exists only to prevent them from appearing on
// business entity tabs. Augusta Rule is intentionally NOT listed here because
// its eligibleEntities: ['scorp', 'soleProp', 'individual'] already handles
// scoping correctly and it MUST show on S Corp + Schedule C tabs.
export const PERSONAL_STRATEGY_IDS = new Set([
  'hsa', 'itemized-vs-standard', 'daf-bunching',
  'child-tax-credit', 'clean-vehicle',
  'tax-loss-harvesting', 'roth-conversion', 'home-sale-exclusion',
]);
