import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AlertTriangle, CalendarClock, CheckCircle2, Download, RefreshCw, Wand2 } from 'lucide-react';
import { db } from '../firebase';
import { UserRole } from '../types';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type PayrollRun = {
  id: string;
  period?: string;
  countryCode?: string;
  country?: string;
  currency?: string;
  status?: string;
  locked?: boolean;
  approvalStage?: string;
  complianceRules?: string[];
  incomeTaxPayable?: number;
  socialEmployeePayable?: number;
  socialEmployerPayable?: number;
  healthHousingPayable?: number;
  totalGross?: number;
  totalNet?: number;
};

type ComplianceRecord = {
  id: string;
  payrollRunId?: string;
  countryCode?: string;
  country?: string;
  currency?: string;
  period?: string;
  type?: string;
  authority?: string;
  amount?: number;
  dueDate?: string;
  status?: string;
  automationSource?: string;
};

type Rule = { type: string; authority: string; source: 'tax' | 'social' | 'healthHousing' | 'manual'; dueDay: number };

const countryRules: Record<string, Rule[]> = {
  NG: [
    { type: 'PAYE', authority: 'State Internal Revenue Service', source: 'tax', dueDay: 10 },
    { type: 'Pension', authority: 'PFA / PenCom', source: 'social', dueDay: 7 },
    { type: 'NHF', authority: 'Federal Mortgage Bank / NHF desk', source: 'healthHousing', dueDay: 15 },
    { type: 'NHIS/NHIA', authority: 'Health Insurance Authority / HMO', source: 'manual', dueDay: 15 },
    { type: 'NSITF', authority: 'Nigeria Social Insurance Trust Fund', source: 'manual', dueDay: 15 },
    { type: 'ITF', authority: 'Industrial Training Fund', source: 'manual', dueDay: 31 },
  ],
  GH: [
    { type: 'PAYE', authority: 'Ghana Revenue Authority', source: 'tax', dueDay: 15 },
    { type: 'SSNIT', authority: 'Social Security and National Insurance Trust', source: 'social', dueDay: 14 },
    { type: 'Tier 2 Pension', authority: 'Approved Trustee / Pension Scheme', source: 'manual', dueDay: 14 },
  ],
  KE: [
    { type: 'PAYE', authority: 'Kenya Revenue Authority', source: 'tax', dueDay: 9 },
    { type: 'NSSF', authority: 'National Social Security Fund', source: 'social', dueDay: 15 },
    { type: 'Housing Levy', authority: 'Housing Levy Authority', source: 'healthHousing', dueDay: 9 },
  ],
  ZA: [
    { type: 'PAYE', authority: 'South African Revenue Service', source: 'tax', dueDay: 7 },
    { type: 'UIF', authority: 'Unemployment Insurance Fund', source: 'social', dueDay: 7 },
    { type: 'SDL', authority: 'Skills Development Levy', source: 'manual', dueDay: 7 },
  ],
  UK: [
    { type: 'PAYE', authority: 'HMRC', source: 'tax', dueDay: 22 },
    { type: 'National Insurance', authority: 'HMRC', source: 'social', dueDay: 22 },
    { type: 'Pension Auto-Enrolment', authority: 'Pension Provider', source: 'manual', dueDay: 22 },
  ],
  US: [
    { type: 'Federal Tax', authority: 'IRS', source: 'tax', dueDay: 15 },
    { type: 'Social Security', authority: 'IRS / SSA', source: 'social', dueDay: 15 },
    { type: 'State Tax', authority: 'State Revenue Authority', source: 'manual', dueDay: 15 },
  ],
  AE: [
    { type: 'WPS', authority: 'Wage Protection System', source: 'manual', dueDay: 5 },
    { type: 'End-of-Service Gratuity', authority: 'Employer / Labour Regulation', source: 'manual', dueDay: 30 },
  ],
  GLOBAL: [
    { type: 'Custom Income Tax', authority: 'Country Tax Authority', source: 'tax', dueDay: 15 },
    { type: 'Custom Social Security', authority: 'Social Security Authority', source: 'social', dueDay: 15 },
  ],
};

function canManage(role: UserRole) {
  return ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'].includes(role);
}

function money(value: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function nextMonthDueDate(period = '', day = 15) {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText || new Date().getFullYear());
  const monthIndex = Number(monthText || new Date().getMonth() + 1) - 1;
  const due = new Date(year, monthIndex + 1, Math.max(1, Math.min(day, 28)));
  return due.toISOString().slice(0, 10);
}

function daysUntil(dateText?: string) {
  if (!dateText || dateText === 'Not set') return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateText);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function amountFromRule(run: PayrollRun, rule: Rule) {
  if (rule.source === 'tax') return Number(run.incomeTaxPayable || 0);
  if (rule.source === 'social') return Number(run.socialEmployeePayable || 0) + Number(run.socialEmployerPayable || 0);
  if (rule.source === 'healthHousing') return Number(run.healthHousingPayable || 0);
  return 0;
}

export default function PayrollComplianceAutomation({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const allowed = canManage(currentUser.role);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadData() {
    if (!companyId) return;
    try {
      const payrollSnap = await getDocs(collection(db, `companies/${companyId}/payroll_runs`));
      const runs: PayrollRun[] = [];
      payrollSnap.forEach((item) => runs.push({ id: item.id, ...(item.data() as PayrollRun) }));
      setPayrollRuns(runs.sort((a, b) => String(b.period || '').localeCompare(String(a.period || ''))));

      const recordSnap = await getDocs(collection(db, `companies/${companyId}/global_compliance`));
      const rows: ComplianceRecord[] = [];
      recordSnap.forEach((item) => rows.push({ id: item.id, ...(item.data() as ComplianceRecord) }));
      setRecords(rows);
    } catch (error: any) {
      setMessage(`Unable to load automation data: ${error.message || error}`);
    }
  }

  useEffect(() => { loadData(); }, [companyId]);

  const eligibleRuns = useMemo(() => payrollRuns.filter((run) => ['Approved', 'Final Approved', 'Paid'].includes(run.status || '') || run.locked || run.approvalStage === 'Locked'), [payrollRuns]);
  const dueSoon = useMemo(() => records.filter((record) => !['Filed', 'Remitted'].includes(record.status || '') && daysUntil(record.dueDate) >= 0 && daysUntil(record.dueDate) <= 7), [records]);
  const overdue = useMemo(() => records.filter((record) => !['Filed', 'Remitted'].includes(record.status || '') && daysUntil(record.dueDate) < 0), [records]);

  async function generateCompliance() {
    if (!companyId || !allowed) return;
    setBusy(true);
    setMessage('');
    let created = 0;
    try {
      for (const run of eligibleRuns) {
        const countryCode = run.countryCode || 'GLOBAL';
        const rules = countryRules[countryCode] || countryRules.GLOBAL;
        for (const rule of rules) {
          const exists = records.some((record) => record.payrollRunId === run.id && record.type === rule.type);
          if (exists) continue;
          const amount = amountFromRule(run, rule);
          if (amount <= 0 && rule.source !== 'manual') continue;
          const saved = await addDoc(collection(db, `companies/${companyId}/global_compliance`), {
            companyId,
            payrollRunId: run.id,
            countryCode,
            country: run.country || countryCode,
            currency: run.currency || 'NGN',
            period: run.period || '',
            type: rule.type,
            authority: rule.authority,
            amount,
            dueDate: nextMonthDueDate(run.period, rule.dueDay),
            status: 'Prepared',
            automationSource: 'payroll-to-compliance-automation',
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
          });
          setRecords((items) => [{ id: saved.id, payrollRunId: run.id, countryCode, country: run.country || countryCode, currency: run.currency || 'NGN', period: run.period || '', type: rule.type, authority: rule.authority, amount, dueDate: nextMonthDueDate(run.period, rule.dueDay), status: 'Prepared', automationSource: 'payroll-to-compliance-automation' }, ...items]);
          created += 1;
        }
      }
      setMessage(`${created} compliance obligation(s) generated from approved/paid payroll runs.`);
    } catch (error: any) {
      setMessage(`Unable to generate compliance obligations: ${error.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  async function flagOverdue() {
    if (!companyId || !allowed) return;
    setBusy(true);
    let flagged = 0;
    try {
      for (const record of overdue) {
        await updateDoc(doc(db, `companies/${companyId}/global_compliance`, record.id), { status: 'Overdue', overdueFlaggedAt: serverTimestamp(), overdueFlaggedBy: currentUser.uid });
        flagged += 1;
      }
      setRecords((items) => items.map((item) => overdue.some((record) => record.id === item.id) ? { ...item, status: 'Overdue' } : item));
      setMessage(`${flagged} overdue compliance item(s) flagged.`);
    } catch (error: any) {
      setMessage(`Unable to flag overdue items: ${error.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  function exportReport() {
    const csv = ['Period,Country,Type,Authority,Amount,Due Date,Status,Automation Source', ...records.map((record) => [record.period, record.countryCode, record.type, record.authority, record.amount, record.dueDate, record.status, record.automationSource || 'manual'].map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payroll-compliance-automation-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6" id="payroll-compliance-automation">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Item 6</p>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-indigo-600" />Payroll-to-Compliance Due Date Automation</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">Generate filing obligations from approved/paid payroll runs, set due dates, identify due-soon obligations and flag overdue records.</p>
        </div>
        <div className="flex flex-wrap gap-2"><button onClick={loadData} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button><button onClick={exportReport} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" />Export</button></div>
      </div>

      {message && <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="Eligible Payroll Runs" value={eligibleRuns.length} /><Metric label="Compliance Records" value={records.length} /><Metric label="Due Soon" value={dueSoon.length} /><Metric label="Overdue" value={overdue.length} /></div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row gap-3 md:items-center justify-between"><div><p className="text-sm font-black text-slate-900">Automation Controls</p><p className="text-xs text-slate-500">Run after payroll is final approved or marked paid.</p></div><div className="flex flex-wrap gap-2"><button onClick={generateCompliance} disabled={!allowed || busy} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-2"><Wand2 className="w-4 h-4" />Generate From Payroll</button><button onClick={flagOverdue} disabled={!allowed || busy || overdue.length === 0} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Flag Overdue</button></div></div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100"><h3 className="text-sm font-black text-slate-900">Due-Soon and Overdue Obligations</h3></div><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Record</th><th className="text-right p-3">Amount</th><th className="text-left p-3">Due Date</th><th className="text-left p-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{[...overdue, ...dueSoon].length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No due-soon or overdue obligations.</td></tr>}{[...overdue, ...dueSoon].map((record) => <tr key={record.id}><td className="p-3"><p className="font-black text-slate-900">{record.period} • {record.type}</p><p className="text-[10px] text-slate-400">{record.countryCode} • {record.authority}</p></td><td className="p-3 text-right font-bold text-slate-900">{money(Number(record.amount || 0), record.currency)}</td><td className="p-3 text-slate-600">{record.dueDate} <span className="text-slate-400">({daysUntil(record.dueDate)} day(s))</span></td><td className="p-3"><span className={`px-2 py-1 rounded-full border text-[10px] font-bold ${daysUntil(record.dueDate) < 0 ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{daysUntil(record.dueDate) < 0 ? 'Overdue' : 'Due Soon'}</span></td></tr>)}</tbody></table></div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{value}</p></div>;
}
