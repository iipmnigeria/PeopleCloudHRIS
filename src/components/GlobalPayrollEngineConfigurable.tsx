import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDoc, getDocs, doc, serverTimestamp } from 'firebase/firestore';
import { Calculator, CheckCircle2, CreditCard, Download, FileText, Globe2, ShieldCheck, Users, Wallet } from 'lucide-react';
import { db } from '../firebase';
import { Employee, UserRole } from '../types';
import { calculateProgressiveTax, defaultPayrollRuleProfiles, getDefaultRuleProfile, PayrollRuleProfile } from '../lib/payrollRuleProfiles';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type PayrollLine = {
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  departmentId: string;
  baseSalary: number;
  grossPay: number;
  incomeTax: number;
  employeeSocial: number;
  employerSocial: number;
  healthHousing: number;
  deductions: number;
  netPay: number;
  employerCost: number;
};

const demoEmployees: Employee[] = [
  { employeeId: 'emp-001', companyId: 'demo', firstName: 'Amina', lastName: 'Okafor', email: 'amina@demo.com', phone: '', dateOfBirth: '', gender: '', address: '', jobTitle: 'HR Business Partner', departmentId: 'People Operations', gradeLevel: 'Grade 7', employmentType: 'Full-Time', dateOfEmployment: '2026-01-01', status: 'Active', baseSalary: 650000, createdAt: new Date().toISOString() },
  { employeeId: 'emp-002', companyId: 'demo', firstName: 'Tunde', lastName: 'Bello', email: 'tunde@demo.com', phone: '', dateOfBirth: '', gender: '', address: '', jobTitle: 'Operations Officer', departmentId: 'Operations', gradeLevel: 'Grade 5', employmentType: 'Full-Time', dateOfEmployment: '2026-01-01', status: 'Active', baseSalary: 420000, createdAt: new Date().toISOString() },
  { employeeId: 'emp-003', companyId: 'demo', firstName: 'Chika', lastName: 'Nwosu', email: 'chika@demo.com', phone: '', dateOfBirth: '', gender: '', address: '', jobTitle: 'Finance Lead', departmentId: 'Finance', gradeLevel: 'Grade 8', employmentType: 'Full-Time', dateOfEmployment: '2026-01-01', status: 'Active', baseSalary: 820000, createdAt: new Date().toISOString() }
];

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);
}

function getName(employee: Employee) {
  return `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || employee.employeeId;
}

export default function GlobalPayrollEngineConfigurable({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canRunPayroll = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer'].includes(currentUser.role);
  const [employees, setEmployees] = useState<Employee[]>(demoEmployees);
  const [countryCode, setCountryCode] = useState('NG');
  const [profile, setProfile] = useState<PayrollRuleProfile>(getDefaultRuleProfile('NG'));
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [status, setStatus] = useState('Draft');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'run' | 'rules' | 'payslips'>('run');

  useEffect(() => {
    async function loadCompanyDefaults() {
      if (!companyId) return;
      try {
        const snap = await getDoc(doc(db, 'companies', companyId));
        if (snap.exists()) {
          const data = snap.data() as any;
          setCountryCode(data.payrollCountryCode || data.operatingCountryCode || 'NG');
        }
      } catch (error) {
        console.warn('Unable to load company payroll country:', error);
      }
    }
    loadCompanyDefaults();
  }, [companyId]);

  useEffect(() => {
    async function loadRuleProfile() {
      if (!companyId) return;
      try {
        const fallback = getDefaultRuleProfile(countryCode);
        const snap = await getDoc(doc(db, `companies/${companyId}/payroll_rule_profiles`, countryCode));
        setProfile(snap.exists() ? { ...fallback, ...(snap.data() as PayrollRuleProfile) } : fallback);
      } catch (error) {
        console.warn('Using default payroll rule profile:', error);
        setProfile(getDefaultRuleProfile(countryCode));
      }
    }
    loadRuleProfile();
  }, [companyId, countryCode]);

  useEffect(() => {
    async function loadEmployees() {
      if (!companyId) return;
      try {
        const snap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const rows: Employee[] = [];
        snap.forEach((item) => rows.push({ ...(item.data() as Employee), employeeId: item.id }));
        const active = rows.filter((employee) => employee.status === 'Active' || employee.status === 'Onboarding');
        if (active.length) setEmployees(active);
      } catch (error) {
        console.warn('Global payroll engine is using demo employee data:', error);
      }
    }
    loadEmployees();
  }, [companyId]);

  const totals = useMemo(() => lines.reduce((acc, line) => {
    acc.gross += line.grossPay;
    acc.tax += line.incomeTax;
    acc.employeeSocial += line.employeeSocial;
    acc.employerSocial += line.employerSocial;
    acc.healthHousing += line.healthHousing;
    acc.deductions += line.deductions;
    acc.net += line.netPay;
    acc.employerCost += line.employerCost;
    return acc;
  }, { gross: 0, tax: 0, employeeSocial: 0, employerSocial: 0, healthHousing: 0, deductions: 0, net: 0, employerCost: 0 }), [lines]);

  const generatePayroll = () => {
    const generated = employees.map((employee) => {
      const baseSalary = Number(employee.baseSalary || 0);
      const grossPay = Math.round(baseSalary * 1.4);
      const incomeTax = calculateProgressiveTax(grossPay, profile);
      const employeeSocial = Math.round(grossPay * Number(profile.employeeSocialRate || 0));
      const employerSocial = Math.round(grossPay * Number(profile.employerSocialRate || 0));
      const healthHousing = Math.round(grossPay * Number(profile.healthHousingRate || 0));
      const deductions = incomeTax + employeeSocial + healthHousing;
      const netPay = grossPay - deductions;
      return { employeeId: employee.employeeId, employeeName: getName(employee), jobTitle: employee.jobTitle, departmentId: employee.departmentId, baseSalary, grossPay, incomeTax, employeeSocial, employerSocial, healthHousing, deductions, netPay, employerCost: grossPay + employerSocial };
    });
    setLines(generated);
    setStatus('Draft');
    setMessage(`Payroll generated with ${profile.country} custom rule profile.`);
  };

  const savePayrollRun = async (nextStatus: 'Draft' | 'Approved' | 'Paid') => {
    if (!companyId || !lines.length) return;
    try {
      const runRef = await addDoc(collection(db, `companies/${companyId}/payroll_runs`), {
        companyId,
        period,
        countryCode: profile.countryCode,
        country: profile.country,
        currency: profile.currency,
        taxLabel: profile.taxLabel,
        complianceRules: profile.complianceRules,
        ruleProfileSource: 'company-configurable-rule-builder',
        status: nextStatus,
        totalGross: totals.gross,
        totalDeductions: totals.deductions,
        totalNet: totals.net,
        totalEmployerCost: totals.employerCost,
        incomeTaxPayable: totals.tax,
        socialEmployeePayable: totals.employeeSocial,
        socialEmployerPayable: totals.employerSocial,
        healthHousingPayable: totals.healthHousing,
        employeeCount: lines.length,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      await Promise.all(lines.map((line) => addDoc(collection(db, `companies/${companyId}/payroll`), { ...line, companyId, period, payrollRunId: runRef.id, countryCode: profile.countryCode, currency: profile.currency, status: nextStatus, paymentStatus: nextStatus === 'Paid' ? 'Paid' : 'Draft', processedDate: new Date().toISOString() })));
      setStatus(nextStatus);
      setMessage(`Payroll ${nextStatus.toLowerCase()} and saved with editable rule profile.`);
    } catch (error: any) {
      setMessage(`Unable to save payroll: ${error.message || error}`);
    }
  };

  const exportCsv = () => {
    const csv = ['Country,Currency,Employee,Gross,Tax,Employee Social,Health/Housing,Deductions,Net Pay,Employer Social,Employer Cost', ...lines.map((line) => [profile.country, profile.currency, line.employeeName, line.grossPay, line.incomeTax, line.employeeSocial, line.healthHousing, line.deductions, line.netPay, line.employerSocial, line.employerCost].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `global-payroll-${profile.countryCode}-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="global-payroll-engine">
      <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-sm"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.24em] text-indigo-200 font-black">PeopleCloud Global Payroll Engine</p><h1 className="text-2xl lg:text-3xl font-bold mt-2">Payroll powered by editable company rule profiles.</h1><p className="text-sm text-slate-300 mt-2 max-w-3xl">Select a country, load company-customized rules, calculate payroll, save payroll runs and create compliance-ready totals.</p></div><div className="grid grid-cols-3 gap-2 text-center"><Metric label="Country" value={profile.countryCode} dark /><Metric label="Currency" value={profile.currency} dark /><Metric label="Status" value={status} dark /></div></div></div>
      {message && <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-2">{[['run', 'Payroll Run', Calculator], ['rules', 'Active Rule Profile', Globe2], ['payslips', 'Payslip Register', FileText]].map(([id, label, Icon]: any) => <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${activeTab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="w-4 h-4" />{label}</button>)}</div>
      {activeTab === 'run' && <div className="grid grid-cols-1 xl:grid-cols-4 gap-6"><div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4"><h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-600" />Payroll Control</h2><div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Country Rule Profile</label><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white">{defaultPayrollRuleProfiles.map((item) => <option key={item.countryCode} value={item.countryCode}>{item.country} ({item.currency})</option>)}</select></div><div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Pay Period</label><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div><button disabled={!canRunPayroll} onClick={generatePayroll} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Generate Payroll</button><button disabled={!lines.length || !canRunPayroll} onClick={() => savePayrollRun('Approved')} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Approve Payroll</button><button disabled={!lines.length || !canRunPayroll} onClick={() => savePayrollRun('Paid')} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Mark as Paid</button><button disabled={!lines.length} onClick={exportCsv} className="w-full border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-center gap-2"><Download className="w-4 h-4" />Export CSV</button></div><div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Payroll Register</h2><p className="text-xs text-slate-500">{lines.length || employees.length} employee(s) available for {profile.country} payroll.</p></div><Users className="w-5 h-5 text-indigo-500" /></div><PayrollTable lines={lines} currency={profile.currency} taxLabel={profile.taxLabel} /></div></div>}
      {activeTab === 'rules' && <div className="grid grid-cols-1 lg:grid-cols-4 gap-4"><Metric label="Country" value={profile.country} icon={Globe2} /><Metric label="Tax Label" value={profile.taxLabel} icon={ShieldCheck} /><Metric label="Employee Rate" value={`${(profile.employeeSocialRate * 100).toFixed(2)}%`} icon={Wallet} /><Metric label="Employer Rate" value={`${(profile.employerSocialRate * 100).toFixed(2)}%`} icon={Wallet} /><div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5"><p className="text-xs font-black text-slate-900 mb-3">Compliance Rules</p><div className="flex flex-wrap gap-2">{profile.complianceRules.map((rule) => <span key={rule} className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-bold">{rule}</span>)}</div></div></div>}
      {activeTab === 'payslips' && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 border-b"><h2 className="text-sm font-bold text-slate-900">Payslip Register</h2><p className="text-xs text-slate-500">Generated payroll lines become payslip-ready records when saved.</p></div><PayrollTable lines={lines} currency={profile.currency} taxLabel={profile.taxLabel} /></div>}
    </div>
  );
}

function PayrollTable({ lines, currency, taxLabel }: { lines: PayrollLine[]; currency: string; taxLabel: string }) {
  if (!lines.length) return <div className="p-8 text-center text-xs text-slate-400">No payroll run generated yet. Select a rule profile and generate payroll.</div>;
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Employee</th><th className="text-right p-3">Gross</th><th className="text-right p-3">{taxLabel}</th><th className="text-right p-3">Social</th><th className="text-right p-3">Health/Housing</th><th className="text-right p-3">Net</th><th className="text-right p-3">Employer Cost</th></tr></thead><tbody className="divide-y divide-slate-100">{lines.map((line) => <tr key={line.employeeId} className="hover:bg-slate-50"><td className="p-3"><p className="font-bold text-slate-900">{line.employeeName}</p><p className="text-[10px] text-slate-400">{line.jobTitle} • {line.departmentId}</p></td><td className="p-3 text-right font-semibold">{money(line.grossPay, currency)}</td><td className="p-3 text-right text-rose-600">{money(line.incomeTax, currency)}</td><td className="p-3 text-right text-rose-600">{money(line.employeeSocial, currency)}</td><td className="p-3 text-right text-rose-600">{money(line.healthHousing, currency)}</td><td className="p-3 text-right text-emerald-600 font-black">{money(line.netPay, currency)}</td><td className="p-3 text-right font-semibold">{money(line.employerCost, currency)}</td></tr>)}</tbody></table></div>;
}

function Metric({ label, value, icon: Icon, dark = false }: { label: string; value: React.ReactNode; icon?: any; dark?: boolean }) {
  return <div className={`${dark ? 'bg-white/10 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} rounded-2xl border p-4 shadow-sm`}><div className="flex items-center justify-between gap-3"><div><p className={`text-[10px] uppercase tracking-wider font-black ${dark ? 'text-slate-300' : 'text-slate-400'}`}>{label}</p><p className="text-lg font-black mt-1 break-words">{value}</p></div>{Icon && <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span>}</div></div>;
}
