import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Calculator, CheckCircle2, CreditCard, Download, FileText, Globe2, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Employee, UserRole } from '../types';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type CountryProfile = {
  code: string;
  country: string;
  region: string;
  currency: string;
  taxLabel: string;
  employeeSocialRate: number;
  employerSocialRate: number;
  housingOrHealthRate: number;
  complianceRules: string[];
  taxBands: Array<{ limit: number; rate: number }>;
};

type PayrollLine = {
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  departmentId: string;
  countryCode: string;
  currency: string;
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  overtime: number;
  bonus: number;
  grossPay: number;
  incomeTax: number;
  employeeSocialContribution: number;
  employerSocialContribution: number;
  housingOrHealthContribution: number;
  loanDeduction: number;
  totalDeductions: number;
  netPay: number;
  employerCost: number;
};

const countryProfiles: CountryProfile[] = [
  { code: 'NG', country: 'Nigeria', region: 'Africa', currency: 'NGN', taxLabel: 'PAYE', employeeSocialRate: 0.08, employerSocialRate: 0.10, housingOrHealthRate: 0.025, complianceRules: ['PAYE', 'Pension', 'NHF', 'NHIS/NHIA', 'NSITF', 'ITF', 'WHT'], taxBands: [{ limit: 300000, rate: 0.07 }, { limit: 300000, rate: 0.11 }, { limit: 500000, rate: 0.15 }, { limit: 500000, rate: 0.19 }, { limit: 1600000, rate: 0.21 }, { limit: Infinity, rate: 0.24 }] },
  { code: 'GH', country: 'Ghana', region: 'Africa', currency: 'GHS', taxLabel: 'PAYE', employeeSocialRate: 0.055, employerSocialRate: 0.13, housingOrHealthRate: 0, complianceRules: ['PAYE', 'SSNIT', 'Tier 2 Pension', 'Tier 3 Pension', 'NHIL Context'], taxBands: [{ limit: 490, rate: 0 }, { limit: 110, rate: 0.05 }, { limit: 130, rate: 0.10 }, { limit: 3166, rate: 0.175 }, { limit: 16000, rate: 0.25 }, { limit: Infinity, rate: 0.30 }] },
  { code: 'KE', country: 'Kenya', region: 'Africa', currency: 'KES', taxLabel: 'PAYE', employeeSocialRate: 0.06, employerSocialRate: 0.06, housingOrHealthRate: 0.015, complianceRules: ['PAYE', 'NSSF', 'SHIF/NHIF', 'Housing Levy', 'HELB where applicable'], taxBands: [{ limit: 24000, rate: 0.10 }, { limit: 8333, rate: 0.25 }, { limit: 467667, rate: 0.30 }, { limit: 300000, rate: 0.325 }, { limit: Infinity, rate: 0.35 }] },
  { code: 'ZA', country: 'South Africa', region: 'Africa', currency: 'ZAR', taxLabel: 'PAYE', employeeSocialRate: 0.01, employerSocialRate: 0.01, housingOrHealthRate: 0.01, complianceRules: ['PAYE', 'UIF', 'SDL', 'COIDA', 'Medical Aid where applicable'], taxBands: [{ limit: 237100, rate: 0.18 }, { limit: 133400, rate: 0.26 }, { limit: 142800, rate: 0.31 }, { limit: 160800, rate: 0.36 }, { limit: 183000, rate: 0.39 }, { limit: 960000, rate: 0.41 }, { limit: Infinity, rate: 0.45 }] },
  { code: 'UK', country: 'United Kingdom', region: 'Europe', currency: 'GBP', taxLabel: 'PAYE', employeeSocialRate: 0.08, employerSocialRate: 0.138, housingOrHealthRate: 0, complianceRules: ['PAYE', 'National Insurance', 'Pension Auto-Enrolment'], taxBands: [{ limit: 12570, rate: 0 }, { limit: 37700, rate: 0.20 }, { limit: 87440, rate: 0.40 }, { limit: Infinity, rate: 0.45 }] },
  { code: 'US', country: 'United States', region: 'North America', currency: 'USD', taxLabel: 'Federal/State Tax', employeeSocialRate: 0.0765, employerSocialRate: 0.0765, housingOrHealthRate: 0, complianceRules: ['Federal Tax', 'State Tax', 'Social Security', 'Medicare', 'Unemployment Insurance'], taxBands: [{ limit: 11600, rate: 0.10 }, { limit: 35550, rate: 0.12 }, { limit: 53375, rate: 0.22 }, { limit: 100525, rate: 0.24 }, { limit: 91425, rate: 0.32 }, { limit: 365625, rate: 0.35 }, { limit: Infinity, rate: 0.37 }] },
  { code: 'AE', country: 'United Arab Emirates', region: 'Middle East', currency: 'AED', taxLabel: 'Income Tax', employeeSocialRate: 0, employerSocialRate: 0, housingOrHealthRate: 0, complianceRules: ['WPS', 'End-of-Service Gratuity', 'Health Insurance where applicable'], taxBands: [{ limit: Infinity, rate: 0 }] },
  { code: 'GLOBAL', country: 'Generic Global', region: 'Global', currency: 'USD', taxLabel: 'Income Tax', employeeSocialRate: 0, employerSocialRate: 0, housingOrHealthRate: 0, complianceRules: ['Custom Tax', 'Custom Social Security', 'Custom Pension', 'Custom Health Insurance'], taxBands: [{ limit: Infinity, rate: 0.10 }] },
];

const demoEmployees: Employee[] = [
  { employeeId: 'emp-001', companyId: 'demo', firstName: 'Amina', lastName: 'Okafor', email: 'amina@demo.com', phone: '', dateOfBirth: '', gender: '', address: '', jobTitle: 'HR Business Partner', departmentId: 'People Operations', gradeLevel: 'Grade 7', employmentType: 'Full-Time', dateOfEmployment: '2026-01-01', status: 'Active', baseSalary: 650000, createdAt: new Date().toISOString() },
  { employeeId: 'emp-002', companyId: 'demo', firstName: 'Tunde', lastName: 'Bello', email: 'tunde@demo.com', phone: '', dateOfBirth: '', gender: '', address: '', jobTitle: 'Operations Officer', departmentId: 'Operations', gradeLevel: 'Grade 5', employmentType: 'Full-Time', dateOfEmployment: '2026-01-01', status: 'Active', baseSalary: 420000, createdAt: new Date().toISOString() },
  { employeeId: 'emp-003', companyId: 'demo', firstName: 'Chika', lastName: 'Nwosu', email: 'chika@demo.com', phone: '', dateOfBirth: '', gender: '', address: '', jobTitle: 'Finance Lead', departmentId: 'Finance', gradeLevel: 'Grade 8', employmentType: 'Full-Time', dateOfEmployment: '2026-01-01', status: 'Active', baseSalary: 820000, createdAt: new Date().toISOString() }
];

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);
}

function employeeName(employee: Employee) {
  return `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || employee.employeeId;
}

function estimateIncomeTax(grossMonthly: number, profile: CountryProfile) {
  const annualGross = grossMonthly * 12;
  const relief = profile.code === 'NG' ? Math.max(annualGross * 0.2 + 200000, annualGross * 0.01) : 0;
  let taxable = Math.max(0, annualGross - relief);
  let tax = 0;
  for (const band of profile.taxBands) {
    const taxableAmount = Math.min(taxable, band.limit);
    if (taxableAmount <= 0) break;
    tax += taxableAmount * band.rate;
    taxable -= taxableAmount;
  }
  return Math.round(tax / 12);
}

export default function GlobalPayrollEngine({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canRunPayroll = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer'].includes(currentUser.role);
  const [employees, setEmployees] = useState<Employee[]>(demoEmployees);
  const [countryCode, setCountryCode] = useState('NG');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [status, setStatus] = useState('Draft');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'run' | 'profile' | 'payslips'>('run');

  const profile = countryProfiles.find((item) => item.code === countryCode) || countryProfiles[0];

  useEffect(() => {
    async function loadEmployees() {
      if (!companyId) return;
      try {
        const snap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const rows: Employee[] = [];
        snap.forEach((item) => rows.push({ ...(item.data() as Employee), employeeId: item.id }));
        const activeEmployees = rows.filter((employee) => employee.status === 'Active' || employee.status === 'Onboarding');
        if (activeEmployees.length) setEmployees(activeEmployees);
      } catch (error) {
        console.warn('Global payroll engine is using demo employee data:', error);
      }
    }
    loadEmployees();
  }, [companyId]);

  const generatePayroll = () => {
    const generated = employees.map((employee) => {
      const baseSalary = Number(employee.baseSalary || 0);
      const housingAllowance = Math.round(baseSalary * 0.25);
      const transportAllowance = Math.round(baseSalary * 0.1);
      const otherAllowance = Math.round(baseSalary * 0.05);
      const overtime = 0;
      const bonus = 0;
      const grossPay = baseSalary + housingAllowance + transportAllowance + otherAllowance + overtime + bonus;
      const incomeTax = estimateIncomeTax(grossPay, profile);
      const employeeSocialContribution = Math.round(grossPay * profile.employeeSocialRate);
      const employerSocialContribution = Math.round(grossPay * profile.employerSocialRate);
      const housingOrHealthContribution = Math.round(grossPay * profile.housingOrHealthRate);
      const loanDeduction = 0;
      const totalDeductions = incomeTax + employeeSocialContribution + housingOrHealthContribution + loanDeduction;
      const netPay = grossPay - totalDeductions;
      return {
        employeeId: employee.employeeId,
        employeeName: employeeName(employee),
        jobTitle: employee.jobTitle,
        departmentId: employee.departmentId,
        countryCode: profile.code,
        currency: profile.currency,
        baseSalary,
        housingAllowance,
        transportAllowance,
        otherAllowance,
        overtime,
        bonus,
        grossPay,
        incomeTax,
        employeeSocialContribution,
        employerSocialContribution,
        housingOrHealthContribution,
        loanDeduction,
        totalDeductions,
        netPay,
        employerCost: grossPay + employerSocialContribution,
      };
    });
    setLines(generated);
    setStatus('Draft');
    setMessage(`Global payroll generated for ${generated.length} employee(s) using ${profile.country} profile.`);
  };

  const totals = useMemo(() => lines.reduce((acc, line) => {
    acc.gross += line.grossPay;
    acc.deductions += line.totalDeductions;
    acc.net += line.netPay;
    acc.tax += line.incomeTax;
    acc.employeeSocial += line.employeeSocialContribution;
    acc.employerSocial += line.employerSocialContribution;
    acc.healthHousing += line.housingOrHealthContribution;
    acc.employerCost += line.employerCost;
    return acc;
  }, { gross: 0, deductions: 0, net: 0, tax: 0, employeeSocial: 0, employerSocial: 0, healthHousing: 0, employerCost: 0 }), [lines]);

  const savePayrollRun = async (nextStatus: 'Draft' | 'Approved' | 'Paid') => {
    if (!companyId || !lines.length) return;
    try {
      const runRef = await addDoc(collection(db, `companies/${companyId}/payroll_runs`), {
        companyId,
        period,
        countryCode: profile.code,
        country: profile.country,
        currency: profile.currency,
        complianceRules: profile.complianceRules,
        status: nextStatus,
        totalGross: totals.gross,
        totalDeductions: totals.deductions,
        totalNet: totals.net,
        totalEmployerCost: totals.employerCost,
        incomeTaxPayable: totals.tax,
        socialEmployeePayable: totals.employeeSocial,
        socialEmployerPayable: totals.employerSocial,
        healthHousingPayable: totals.healthHousing,
        payePayable: profile.taxLabel === 'PAYE' ? totals.tax : 0,
        pensionEmployee: profile.code === 'NG' ? totals.employeeSocial : 0,
        pensionEmployer: profile.code === 'NG' ? totals.employerSocial : 0,
        nhfPayable: profile.code === 'NG' ? totals.healthHousing : 0,
        employeeCount: lines.length,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      await Promise.all(lines.map((line) => addDoc(collection(db, `companies/${companyId}/payroll`), {
        ...line,
        companyId,
        period,
        payrollRunId: runRef.id,
        status: nextStatus,
        paymentStatus: nextStatus === 'Paid' ? 'Paid' : 'Draft',
        processedDate: new Date().toISOString(),
      })));

      setStatus(nextStatus);
      setMessage(`Global payroll ${nextStatus.toLowerCase()} and saved successfully.`);
    } catch (error: any) {
      setMessage(`Unable to save payroll: ${error.message || error}`);
    }
  };

  const exportCsv = () => {
    const csv = [
      'Country,Currency,Employee,Job Title,Department,Basic,Housing,Transport,Other,Gross,Income Tax,Employee Social,Health/Housing,Total Deductions,Net Pay,Employer Social,Employer Cost',
      ...lines.map((line) => [profile.country, line.currency, line.employeeName, line.jobTitle, line.departmentId, line.baseSalary, line.housingAllowance, line.transportAllowance, line.otherAllowance, line.grossPay, line.incomeTax, line.employeeSocialContribution, line.housingOrHealthContribution, line.totalDeductions, line.netPay, line.employerSocialContribution, line.employerCost].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `global-payroll-${profile.code}-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="global-payroll-engine">
      <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-indigo-200 font-black">PeopleCloud Global Payroll Engine</p>
            <h1 className="text-2xl lg:text-3xl font-bold mt-2">Country-configurable payroll for Nigeria, Africa and global teams.</h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl">Run payroll by country profile, currency, income tax label, social contribution rules, health/housing deduction and compliance rule pack.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Country" value={profile.code} dark />
            <Metric label="Currency" value={profile.currency} dark />
            <Metric label="Status" value={status} dark />
          </div>
        </div>
      </div>

      {message && <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-2">
        {[
          ['run', 'Payroll Run', Calculator],
          ['profile', 'Country Profile', Globe2],
          ['payslips', 'Payslip Register', FileText],
        ].map(([id, label, Icon]: any) => <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${activeTab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="w-4 h-4" />{label}</button>)}
      </div>

      {activeTab === 'run' && <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-600" />Payroll Control</h2>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Country Profile</label><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white">{countryProfiles.map((item) => <option key={item.code} value={item.code}>{item.country} ({item.currency})</option>)}</select></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Pay Period</label><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <button disabled={!canRunPayroll} onClick={generatePayroll} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Generate Global Payroll</button>
          <button disabled={!lines.length || !canRunPayroll} onClick={() => savePayrollRun('Approved')} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Approve Payroll</button>
          <button disabled={!lines.length || !canRunPayroll} onClick={() => savePayrollRun('Paid')} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Mark as Paid</button>
          <button disabled={!lines.length} onClick={exportCsv} className="w-full border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-center gap-2"><Download className="w-4 h-4" />Export CSV</button>
          <p className="text-[10px] text-slate-400 leading-relaxed">Country profiles are configurable estimates. Production payroll must be verified against official country tax and statutory rules.</p>
        </div>
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Global Payroll Register</h2><p className="text-xs text-slate-500">{lines.length || employees.length} employee(s) available for {profile.country} payroll.</p></div><Users className="w-5 h-5 text-indigo-500" /></div>
          <PayrollTable lines={lines} currency={profile.currency} taxLabel={profile.taxLabel} />
        </div>
      </div>}

      {activeTab === 'profile' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><Metric label="Selected Country" value={profile.country} icon={Globe2} /><Metric label="Income Tax Label" value={profile.taxLabel} icon={ShieldCheck} /><Metric label="Currency" value={profile.currency} icon={Wallet} /><div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5"><h2 className="text-sm font-bold text-slate-900 mb-3">Compliance Rule Pack</h2><div className="flex flex-wrap gap-2">{profile.complianceRules.map((rule) => <span key={rule} className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-bold">{rule}</span>)}</div></div></div>}

      {activeTab === 'payslips' && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 border-b"><h2 className="text-sm font-bold text-slate-900">Payslip Register</h2><p className="text-xs text-slate-500">Generated payroll lines become payslip-ready records when saved.</p></div><PayrollTable lines={lines} currency={profile.currency} taxLabel={profile.taxLabel} /></div>}
    </div>
  );
}

function PayrollTable({ lines, currency, taxLabel }: { lines: PayrollLine[]; currency: string; taxLabel: string }) {
  if (!lines.length) return <div className="p-8 text-center text-xs text-slate-400">No payroll run generated yet. Select a country profile and generate payroll.</div>;
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Employee</th><th className="text-right p-3">Gross</th><th className="text-right p-3">{taxLabel}</th><th className="text-right p-3">Employee Social</th><th className="text-right p-3">Health/Housing</th><th className="text-right p-3">Net Pay</th><th className="text-right p-3">Employer Cost</th></tr></thead><tbody className="divide-y divide-slate-100">{lines.map((line) => <tr key={line.employeeId} className="hover:bg-slate-50"><td className="p-3"><p className="font-bold text-slate-900">{line.employeeName}</p><p className="text-[10px] text-slate-400">{line.jobTitle} • {line.departmentId}</p></td><td className="p-3 text-right font-semibold">{money(line.grossPay, currency)}</td><td className="p-3 text-right text-rose-600">{money(line.incomeTax, currency)}</td><td className="p-3 text-right text-rose-600">{money(line.employeeSocialContribution, currency)}</td><td className="p-3 text-right text-rose-600">{money(line.housingOrHealthContribution, currency)}</td><td className="p-3 text-right text-emerald-600 font-black">{money(line.netPay, currency)}</td><td className="p-3 text-right font-semibold">{money(line.employerCost, currency)}</td></tr>)}</tbody></table></div>;
}

function Metric({ label, value, icon: Icon, dark = false }: { label: string; value: React.ReactNode; icon?: any; dark?: boolean }) {
  return <div className={`${dark ? 'bg-white/10 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} rounded-2xl border p-4 shadow-sm`}><div className="flex items-center justify-between gap-3"><div><p className={`text-[10px] uppercase tracking-wider font-black ${dark ? 'text-slate-300' : 'text-slate-400'}`}>{label}</p><p className="text-lg font-black mt-1 break-words">{value}</p></div>{Icon && <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span>}</div></div>;
}
