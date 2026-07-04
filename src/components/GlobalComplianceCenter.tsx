import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertTriangle, CalendarDays, CheckCircle2, Download, FileCheck2, FileUp, Globe2, Landmark, ShieldCheck, Wallet } from 'lucide-react';
import { UserRole } from '../types';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type ComplianceRecord = {
  id: string;
  companyId?: string;
  countryCode: string;
  country: string;
  currency: string;
  period: string;
  type: string;
  authority: string;
  amount: number;
  dueDate: string;
  status: 'Pending' | 'Prepared' | 'Remitted' | 'Overdue' | 'Filed';
  evidenceName?: string;
  referenceNo?: string;
  notes?: string;
  createdBy?: string;
};

type PayrollRun = {
  id: string;
  period?: string;
  countryCode?: string;
  country?: string;
  currency?: string;
  incomeTaxPayable?: number;
  socialEmployeePayable?: number;
  socialEmployerPayable?: number;
  healthHousingPayable?: number;
  payePayable?: number;
  pensionEmployee?: number;
  pensionEmployer?: number;
  nhfPayable?: number;
  totalGross?: number;
  totalNet?: number;
};

type CountryComplianceProfile = {
  code: string;
  country: string;
  region: string;
  currency: string;
  rules: Array<{ type: string; authority: string; basis: string; due: string; owner: string; source: 'Payroll' | 'Manual' }>;
};

const countryProfiles: CountryComplianceProfile[] = [
  { code: 'NG', country: 'Nigeria', region: 'Africa', currency: 'NGN', rules: [
    { type: 'PAYE', authority: 'State Internal Revenue Service', basis: 'Employee income tax withheld from payroll', due: 'Monthly remittance after payroll close', owner: 'Finance / Payroll', source: 'Payroll' },
    { type: 'Pension', authority: 'Pension Fund Administrator / PenCom', basis: 'Employee and employer pension contributions', due: 'Monthly remittance and schedule upload', owner: 'Finance / HR', source: 'Payroll' },
    { type: 'NHF', authority: 'Federal Mortgage Bank / NHF desk', basis: 'National Housing Fund contribution where applicable', due: 'Monthly remittance and schedule', owner: 'Finance', source: 'Payroll' },
    { type: 'NHIS/NHIA', authority: 'Health Insurance Authority / HMO', basis: 'Health insurance contribution or employer-funded medical plan', due: 'Per organization health scheme cycle', owner: 'HR / Admin', source: 'Manual' },
    { type: 'NSITF', authority: 'Nigeria Social Insurance Trust Fund', basis: 'Employee compensation and workplace injury insurance compliance', due: 'Periodic statutory remittance', owner: 'HR / Finance', source: 'Manual' },
    { type: 'ITF', authority: 'Industrial Training Fund', basis: 'Training contribution and employer eligibility tracking', due: 'Annual or applicable filing cycle', owner: 'HR / L&D / Finance', source: 'Manual' },
  ]},
  { code: 'GH', country: 'Ghana', region: 'Africa', currency: 'GHS', rules: [
    { type: 'PAYE', authority: 'Ghana Revenue Authority', basis: 'Income tax withheld from employee pay', due: 'Monthly statutory filing', owner: 'Finance / Payroll', source: 'Payroll' },
    { type: 'SSNIT', authority: 'Social Security and National Insurance Trust', basis: 'Social security contribution', due: 'Monthly contribution schedule', owner: 'Finance / HR', source: 'Payroll' },
    { type: 'Tier 2 Pension', authority: 'Approved Trustee / Pension Scheme', basis: 'Mandatory occupational pension scheme', due: 'Monthly remittance', owner: 'Finance / HR', source: 'Manual' },
    { type: 'Tier 3 Pension', authority: 'Approved Trustee / Voluntary Scheme', basis: 'Voluntary provident/pension contribution', due: 'As configured', owner: 'Finance / HR', source: 'Manual' },
  ]},
  { code: 'KE', country: 'Kenya', region: 'Africa', currency: 'KES', rules: [
    { type: 'PAYE', authority: 'Kenya Revenue Authority', basis: 'Income tax withheld from payroll', due: 'Monthly tax filing', owner: 'Finance / Payroll', source: 'Payroll' },
    { type: 'NSSF', authority: 'National Social Security Fund', basis: 'Social security contribution', due: 'Monthly remittance', owner: 'Finance / HR', source: 'Payroll' },
    { type: 'SHIF/NHIF', authority: 'Social Health Authority / Health Insurance Scheme', basis: 'Health insurance contribution', due: 'Monthly health contribution', owner: 'HR / Finance', source: 'Manual' },
    { type: 'Housing Levy', authority: 'Government Housing Levy Authority', basis: 'Housing levy where applicable', due: 'Monthly remittance', owner: 'Finance', source: 'Payroll' },
  ]},
  { code: 'ZA', country: 'South Africa', region: 'Africa', currency: 'ZAR', rules: [
    { type: 'PAYE', authority: 'South African Revenue Service', basis: 'Employee tax withheld from payroll', due: 'Monthly EMP filing', owner: 'Finance / Payroll', source: 'Payroll' },
    { type: 'UIF', authority: 'Unemployment Insurance Fund', basis: 'Unemployment insurance contribution', due: 'Monthly remittance', owner: 'Finance / HR', source: 'Payroll' },
    { type: 'SDL', authority: 'Skills Development Levy', basis: 'Skills levy where applicable', due: 'Monthly statutory filing', owner: 'Finance / L&D', source: 'Manual' },
    { type: 'COIDA', authority: 'Compensation Fund', basis: 'Occupational injury and disease compliance', due: 'Annual/periodic filing', owner: 'HR / Finance', source: 'Manual' },
  ]},
  { code: 'UK', country: 'United Kingdom', region: 'Europe', currency: 'GBP', rules: [
    { type: 'PAYE', authority: 'HMRC', basis: 'Payroll income tax', due: 'Real-time payroll reporting cycle', owner: 'Payroll / Finance', source: 'Payroll' },
    { type: 'National Insurance', authority: 'HMRC', basis: 'Employee and employer national insurance', due: 'Payroll reporting cycle', owner: 'Payroll / Finance', source: 'Payroll' },
    { type: 'Pension Auto-Enrolment', authority: 'Pension Provider / Regulator', basis: 'Workplace pension contributions', due: 'Scheme cycle', owner: 'HR / Payroll', source: 'Manual' },
  ]},
  { code: 'US', country: 'United States', region: 'North America', currency: 'USD', rules: [
    { type: 'Federal Tax', authority: 'IRS', basis: 'Federal payroll withholding', due: 'Deposit schedule based on employer profile', owner: 'Payroll / Finance', source: 'Payroll' },
    { type: 'State Tax', authority: 'State Revenue Authority', basis: 'State income tax where applicable', due: 'State-specific schedule', owner: 'Payroll / Finance', source: 'Manual' },
    { type: 'Social Security', authority: 'IRS / SSA', basis: 'FICA social security contribution', due: 'Payroll tax deposit schedule', owner: 'Payroll / Finance', source: 'Payroll' },
    { type: 'Medicare', authority: 'IRS', basis: 'FICA Medicare contribution', due: 'Payroll tax deposit schedule', owner: 'Payroll / Finance', source: 'Payroll' },
  ]},
  { code: 'AE', country: 'United Arab Emirates', region: 'Middle East', currency: 'AED', rules: [
    { type: 'WPS', authority: 'Wage Protection System', basis: 'Payroll payment reporting', due: 'Monthly salary processing cycle', owner: 'Payroll / Finance', source: 'Manual' },
    { type: 'End-of-Service Gratuity', authority: 'Employer / Labour Regulation', basis: 'End-of-service benefits provision', due: 'At separation or accrual review', owner: 'HR / Finance', source: 'Manual' },
    { type: 'Health Insurance', authority: 'Health Insurance Provider / Regulator', basis: 'Mandatory or employer medical cover where applicable', due: 'Policy cycle', owner: 'HR / Admin', source: 'Manual' },
  ]},
  { code: 'GLOBAL', country: 'Generic Global', region: 'Global', currency: 'USD', rules: [
    { type: 'Custom Income Tax', authority: 'Country Tax Authority', basis: 'Country-specific income tax', due: 'As configured', owner: 'Payroll / Finance', source: 'Manual' },
    { type: 'Custom Social Security', authority: 'Social Security Authority', basis: 'Country-specific social contribution', due: 'As configured', owner: 'Payroll / HR', source: 'Manual' },
    { type: 'Custom Health Insurance', authority: 'Health Insurance Authority / Provider', basis: 'Country-specific health contribution', due: 'As configured', owner: 'HR / Admin', source: 'Manual' },
  ]},
];

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function statusClass(status: ComplianceRecord['status']) {
  if (status === 'Remitted' || status === 'Filed') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'Overdue') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (status === 'Prepared') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

export default function GlobalComplianceCenter({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canManage = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'].includes(currentUser.role);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [countryCode, setCountryCode] = useState('NG');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles' | 'calendar' | 'reports'>('dashboard');
  const [message, setMessage] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [type, setType] = useState('PAYE');
  const [authority, setAuthority] = useState('State Internal Revenue Service');
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [evidenceName, setEvidenceName] = useState('');
  const [notes, setNotes] = useState('');

  const profile = countryProfiles.find((item) => item.code === countryCode) || countryProfiles[0];

  useEffect(() => {
    async function loadComplianceData() {
      if (!companyId) return;
      try {
        const recordSnap = await getDocs(collection(db, `companies/${companyId}/global_compliance`));
        const recordRows: ComplianceRecord[] = [];
        recordSnap.forEach((item) => recordRows.push({ id: item.id, ...(item.data() as ComplianceRecord) }));
        setRecords(recordRows);

        const payrollSnap = await getDocs(collection(db, `companies/${companyId}/payroll_runs`));
        const runRows: PayrollRun[] = [];
        payrollSnap.forEach((item) => runRows.push({ id: item.id, ...(item.data() as PayrollRun) }));
        setPayrollRuns(runRows);
      } catch (error) {
        console.warn('Global Compliance Center is using empty local data:', error);
      }
    }
    loadComplianceData();
  }, [companyId]);

  const currentPayrollRun = useMemo(() => payrollRuns.find((run) => run.period === period && (run.countryCode || 'NG') === countryCode), [payrollRuns, period, countryCode]);

  useEffect(() => {
    const rule = profile.rules[0];
    if (rule) {
      setType(rule.type);
      setAuthority(rule.authority);
    }
  }, [countryCode]);

  useEffect(() => {
    const rule = profile.rules.find((item) => item.type === type);
    if (rule) setAuthority(rule.authority);
    if (currentPayrollRun) {
      if (type === 'PAYE' || type === 'Federal Tax' || type === 'Custom Income Tax') setAmount(Number(currentPayrollRun.incomeTaxPayable || currentPayrollRun.payePayable || 0));
      else if (type === 'Pension' || type === 'SSNIT' || type === 'NSSF' || type === 'National Insurance' || type === 'Social Security') setAmount(Number(currentPayrollRun.socialEmployeePayable || 0) + Number(currentPayrollRun.socialEmployerPayable || 0));
      else if (type === 'NHF' || type === 'Housing Levy' || type === 'Health Insurance') setAmount(Number(currentPayrollRun.healthHousingPayable || currentPayrollRun.nhfPayable || 0));
    }
  }, [type, profile, currentPayrollRun]);

  const filteredRecords = useMemo(() => records.filter((record) => record.countryCode === countryCode), [records, countryCode]);
  const totals = useMemo(() => filteredRecords.reduce((acc, record) => {
    acc.total += Number(record.amount || 0);
    if (record.status === 'Pending' || record.status === 'Prepared') acc.open += Number(record.amount || 0);
    if (record.status === 'Remitted' || record.status === 'Filed') acc.completed += Number(record.amount || 0);
    if (record.status === 'Overdue') acc.overdue += Number(record.amount || 0);
    return acc;
  }, { total: 0, open: 0, completed: 0, overdue: 0 }), [filteredRecords]);

  const createRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !canManage) return;
    const record: ComplianceRecord = {
      id: `gcomp-${Date.now()}`,
      companyId,
      countryCode: profile.code,
      country: profile.country,
      currency: profile.currency,
      period,
      type,
      authority,
      amount: Number(amount || 0),
      dueDate: dueDate || 'Not set',
      status: 'Prepared',
      evidenceName,
      referenceNo,
      notes,
      createdBy: currentUser.uid,
    };

    try {
      const saved = await addDoc(collection(db, `companies/${companyId}/global_compliance`), { ...record, createdAt: serverTimestamp() });
      setRecords((items) => [{ ...record, id: saved.id }, ...items]);
      setMessage('Global compliance record prepared successfully.');
      setEvidenceName('');
      setReferenceNo('');
      setNotes('');
    } catch (error: any) {
      setMessage(`Unable to save compliance record: ${error.message || error}`);
    }
  };

  const updateStatus = async (record: ComplianceRecord, status: ComplianceRecord['status']) => {
    if (!companyId || !canManage) return;
    try {
      await updateDoc(doc(db, `companies/${companyId}/global_compliance`, record.id), { status, updatedAt: serverTimestamp(), updatedBy: currentUser.uid });
      setRecords((items) => items.map((item) => item.id === record.id ? { ...item, status } : item));
      setMessage(`${record.country} ${record.type} record marked as ${status}.`);
    } catch (error: any) {
      setMessage(`Unable to update status: ${error.message || error}`);
    }
  };

  const seedFromPayroll = async () => {
    if (!currentPayrollRun) {
      setMessage('No matching payroll run found for the selected country and period. Generate global payroll first or create the record manually.');
      return;
    }
    const due = dueDate || 'Not set';
    const seeds = profile.rules.filter((rule) => rule.source === 'Payroll').map((rule) => {
      let seedAmount = 0;
      if (rule.type.includes('PAYE') || rule.type.includes('Federal Tax')) seedAmount = Number(currentPayrollRun.incomeTaxPayable || currentPayrollRun.payePayable || 0);
      else if (rule.type.includes('Pension') || rule.type.includes('SSNIT') || rule.type.includes('NSSF') || rule.type.includes('National Insurance') || rule.type.includes('Social Security')) seedAmount = Number(currentPayrollRun.socialEmployeePayable || 0) + Number(currentPayrollRun.socialEmployerPayable || 0);
      else if (rule.type.includes('NHF') || rule.type.includes('Housing') || rule.type.includes('Health')) seedAmount = Number(currentPayrollRun.healthHousingPayable || currentPayrollRun.nhfPayable || 0);
      return { rule, seedAmount };
    }).filter((item) => item.seedAmount > 0);

    try {
      const savedRows: ComplianceRecord[] = [];
      for (const item of seeds) {
        const saved = await addDoc(collection(db, `companies/${companyId}/global_compliance`), {
          companyId,
          countryCode: profile.code,
          country: profile.country,
          currency: profile.currency,
          period,
          type: item.rule.type,
          authority: item.rule.authority,
          amount: item.seedAmount,
          dueDate: due,
          status: 'Prepared',
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        savedRows.push({ id: saved.id, companyId, countryCode: profile.code, country: profile.country, currency: profile.currency, period, type: item.rule.type, authority: item.rule.authority, amount: item.seedAmount, dueDate: due, status: 'Prepared', createdBy: currentUser.uid });
      }
      setRecords((items) => [...savedRows, ...items]);
      setMessage(`${savedRows.length} ${profile.country} compliance records prepared from payroll run.`);
    } catch (error: any) {
      setMessage(`Unable to seed compliance records: ${error.message || error}`);
    }
  };

  const exportComplianceCsv = () => {
    const csv = [
      'Country,Currency,Period,Type,Authority,Amount,Due Date,Status,Reference,Evidence,Notes',
      ...filteredRecords.map((record) => [record.country, record.currency, record.period, record.type, record.authority, record.amount, record.dueDate, record.status, record.referenceNo || '', record.evidenceName || '', record.notes || ''].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `global-compliance-${profile.code}-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="global-compliance-center">
      <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-indigo-200 font-black">PeopleCloud Global Compliance Center</p>
            <h1 className="text-2xl lg:text-3xl font-bold mt-2">Country-configurable statutory compliance for Africa and global teams.</h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl">Select a country rule pack, prepare compliance records from payroll, track remittance status, due dates, evidence and exports.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center"><Metric label="Country" value={profile.code} dark /><Metric label="Currency" value={profile.currency} dark /><Metric label="Open" value={money(totals.open, profile.currency)} dark /></div>
        </div>
      </div>

      {message && <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-2">
        {[
          ['dashboard', 'Compliance Dashboard', ShieldCheck],
          ['profiles', 'Country Profiles', Globe2],
          ['calendar', 'Filing Calendar', CalendarDays],
          ['reports', 'Reports & Evidence', FileCheck2],
        ].map(([id, label, Icon]: any) => <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${activeTab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="w-4 h-4" />{label}</button>)}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div><p className="text-xs font-black text-slate-900">Selected Compliance Country</p><p className="text-[11px] text-slate-500">Country profile controls rule pack, currency, authority labels and payroll-derived records.</p></div>
        <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white min-w-64">{countryProfiles.map((item) => <option key={item.code} value={item.code}>{item.country} ({item.currency})</option>)}</select>
      </div>

      {activeTab === 'dashboard' && <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <form onSubmit={createRecord} className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Wallet className="w-4 h-4 text-indigo-600" />Prepare Record</h2>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Period</label><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Compliance Type</label><select value={type} onChange={(event) => setType(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white">{profile.rules.map((rule) => <option key={rule.type}>{rule.type}</option>)}<option>Other</option></select></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Authority / Provider</label><input value={authority} onChange={(event) => setAuthority(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Amount ({profile.currency})</label><input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Due Date</label><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Reference No.</label><input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder="Receipt / schedule reference" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Evidence File Name</label><input value={evidenceName} onChange={(event) => setEvidenceName(event.target.value)} placeholder="e.g. tax-receipt.pdf" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <button disabled={!canManage} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Save Compliance Record</button>
          <button type="button" disabled={!canManage} onClick={seedFromPayroll} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Prepare from Payroll Run</button>
        </form>
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Global Compliance Register</h2><p className="text-xs text-slate-500">Track remittances, filing status and evidence for {profile.country}.</p></div><button onClick={exportComplianceCsv} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" />Export</button></div>
          <ComplianceTable records={filteredRecords} updateStatus={updateStatus} currency={profile.currency} />
        </div>
      </div>}

      {activeTab === 'profiles' && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{profile.rules.map((rule) => <div key={rule.type} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"><div className="flex items-center justify-between mb-3"><h3 className="text-sm font-black text-slate-900">{rule.type}</h3><Landmark className="w-5 h-5 text-indigo-500" /></div><p className="text-xs font-semibold text-slate-700">{rule.authority}</p><p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{rule.basis}</p><div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3 text-[10px] text-slate-500"><p><strong>Due:</strong> {rule.due}</p><p><strong>Owner:</strong> {rule.owner}</p><p><strong>Source:</strong> {rule.source}</p></div></div>)}</div>}
      {activeTab === 'calendar' && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 border-b"><h2 className="text-sm font-bold text-slate-900">Global Filing Calendar</h2><p className="text-xs text-slate-500">Upcoming due dates for {profile.country}.</p></div><ComplianceTable records={filteredRecords.slice().sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))} updateStatus={updateStatus} currency={profile.currency} compact /></div>}
      {activeTab === 'reports' && <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Metric label="Completed" value={money(totals.completed, profile.currency)} icon={CheckCircle2} /><Metric label="Open Liability" value={money(totals.open, profile.currency)} icon={AlertTriangle} /><Metric label="Overdue Liability" value={money(totals.overdue, profile.currency)} icon={AlertTriangle} /><Metric label="Evidence Records" value={filteredRecords.filter((record) => record.evidenceName).length} icon={FileUp} /><div className="md:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 text-xs text-slate-600"><p className="font-bold text-slate-900 mb-2">Evidence vault readiness</p><p>This center records evidence file names and references now. A later Storage upgrade should upload receipts, remittance schedules, clearance letters and compliance certificates into a secured document vault.</p></div></div>}
      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-[11px] text-amber-800 leading-relaxed"><strong>Compliance note:</strong> Country rule packs are configurable workflow templates. Exact rates, thresholds, filings, exemptions and due dates must be verified with official sources or local payroll advisers before production use.</div>
    </div>
  );
}

function ComplianceTable({ records, updateStatus, currency, compact = false }: { records: ComplianceRecord[]; updateStatus: (record: ComplianceRecord, status: ComplianceRecord['status']) => void; currency: string; compact?: boolean }) {
  if (!records.length) return <div className="p-8 text-center text-xs text-slate-400">No compliance records yet. Prepare a record manually or seed from a matching payroll run.</div>;
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Country</th><th className="text-left p-3">Period</th><th className="text-left p-3">Type</th><th className="text-left p-3">Authority</th><th className="text-right p-3">Amount</th><th className="text-left p-3">Due</th><th className="text-left p-3">Status</th>{!compact && <th className="text-left p-3">Action</th>}</tr></thead><tbody className="divide-y divide-slate-100">{records.map((record) => <tr key={record.id} className="hover:bg-slate-50"><td className="p-3 font-semibold text-slate-700">{record.countryCode}</td><td className="p-3 text-slate-600">{record.period}</td><td className="p-3 font-black text-slate-900">{record.type}<br/><span className="text-[10px] font-normal text-slate-400">{record.referenceNo || record.evidenceName || 'No evidence yet'}</span></td><td className="p-3 text-slate-600">{record.authority}</td><td className="p-3 text-right font-bold text-slate-900">{money(record.amount, currency)}</td><td className="p-3 text-slate-600">{record.dueDate}</td><td className="p-3"><span className={`px-2 py-1 border rounded-full text-[10px] font-black ${statusClass(record.status)}`}>{record.status}</span></td>{!compact && <td className="p-3"><select value={record.status} onChange={(event) => updateStatus(record, event.target.value as ComplianceRecord['status'])} className="border border-slate-200 rounded-lg px-2 py-1 text-[10px] bg-white"><option>Pending</option><option>Prepared</option><option>Remitted</option><option>Filed</option><option>Overdue</option></select></td>}</tr>)}</tbody></table></div>;
}

function Metric({ label, value, icon: Icon, dark = false }: { label: string; value: React.ReactNode; icon?: any; dark?: boolean }) {
  return <div className={`${dark ? 'bg-white/10 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} rounded-2xl border p-4 shadow-sm`}><div className="flex items-center justify-between gap-3"><div><p className={`text-[10px] uppercase tracking-wider font-black ${dark ? 'text-slate-300' : 'text-slate-400'}`}>{label}</p><p className="text-lg font-black mt-1 break-words">{value}</p></div>{Icon && <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span>}</div></div>;
}
