import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertTriangle, CalendarDays, CheckCircle2, Download, FileCheck2, FileUp, Landmark, ShieldCheck, Wallet } from 'lucide-react';
import { UserRole } from '../types';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type ComplianceType = 'PAYE' | 'Pension' | 'NHF' | 'NHIS/NHIA' | 'NSITF' | 'ITF' | 'WHT' | 'Other';

type ComplianceRecord = {
  id: string;
  companyId?: string;
  period: string;
  type: ComplianceType;
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
  payePayable?: number;
  pensionEmployee?: number;
  pensionEmployer?: number;
  nhfPayable?: number;
  employeeCount?: number;
  totalGross?: number;
  totalNet?: number;
};

const defaultRules: Array<{ type: ComplianceType; authority: string; basis: string; due: string; owner: string }> = [
  { type: 'PAYE', authority: 'State Internal Revenue Service', basis: 'Employee income tax withheld from payroll', due: 'Monthly remittance after payroll close', owner: 'Finance / Payroll' },
  { type: 'Pension', authority: 'Pension Fund Administrator / PenCom', basis: 'Employee and employer pension contributions', due: 'Monthly remittance and schedule upload', owner: 'Finance / HR' },
  { type: 'NHF', authority: 'Federal Mortgage Bank / NHF desk', basis: 'National Housing Fund contribution where applicable', due: 'Monthly remittance and schedule', owner: 'Finance' },
  { type: 'NHIS/NHIA', authority: 'Health Insurance Authority / HMO', basis: 'Health insurance contribution or employer-funded medical plan', due: 'Per organization health scheme cycle', owner: 'HR / Admin' },
  { type: 'NSITF', authority: 'Nigeria Social Insurance Trust Fund', basis: 'Employee compensation and workplace injury insurance compliance', due: 'Periodic statutory remittance', owner: 'HR / Finance' },
  { type: 'ITF', authority: 'Industrial Training Fund', basis: 'Training contribution and employer eligibility tracking', due: 'Annual or applicable filing cycle', owner: 'HR / L&D / Finance' },
  { type: 'WHT', authority: 'Federal/State Tax Authority', basis: 'Withholding tax on qualifying vendor payments', due: 'Monthly or transaction-based filing', owner: 'Finance' },
];

function money(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function statusClass(status: ComplianceRecord['status']) {
  if (status === 'Remitted' || status === 'Filed') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'Overdue') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (status === 'Prepared') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

export default function StatutoryComplianceCenter({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canManage = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'].includes(currentUser.role);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'calendar' | 'reports'>('dashboard');
  const [message, setMessage] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [type, setType] = useState<ComplianceType>('PAYE');
  const [authority, setAuthority] = useState('State Internal Revenue Service');
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [evidenceName, setEvidenceName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function loadComplianceData() {
      if (!companyId) return;
      try {
        const recordSnap = await getDocs(collection(db, `companies/${companyId}/statutory_compliance`));
        const recordRows: ComplianceRecord[] = [];
        recordSnap.forEach((item) => recordRows.push({ id: item.id, ...(item.data() as ComplianceRecord) }));
        setRecords(recordRows);

        const payrollSnap = await getDocs(collection(db, `companies/${companyId}/payroll_runs`));
        const runRows: PayrollRun[] = [];
        payrollSnap.forEach((item) => runRows.push({ id: item.id, ...(item.data() as PayrollRun) }));
        setPayrollRuns(runRows);
      } catch (error) {
        console.warn('Statutory Compliance Center is using empty local data:', error);
      }
    }
    loadComplianceData();
  }, [companyId]);

  const currentPayrollRun = useMemo(() => payrollRuns.find((run) => run.period === period), [payrollRuns, period]);

  const recommendedAmount = useMemo(() => {
    if (!currentPayrollRun) return 0;
    if (type === 'PAYE') return Number(currentPayrollRun.payePayable || 0);
    if (type === 'Pension') return Number(currentPayrollRun.pensionEmployee || 0) + Number(currentPayrollRun.pensionEmployer || 0);
    if (type === 'NHF') return Number(currentPayrollRun.nhfPayable || 0);
    return 0;
  }, [currentPayrollRun, type]);

  useEffect(() => {
    const rule = defaultRules.find((item) => item.type === type);
    if (rule) setAuthority(rule.authority);
    if (recommendedAmount > 0) setAmount(recommendedAmount);
  }, [type, recommendedAmount]);

  const totals = useMemo(() => records.reduce((acc, record) => {
    acc.total += Number(record.amount || 0);
    if (record.status === 'Pending' || record.status === 'Prepared') acc.open += Number(record.amount || 0);
    if (record.status === 'Remitted' || record.status === 'Filed') acc.completed += Number(record.amount || 0);
    if (record.status === 'Overdue') acc.overdue += Number(record.amount || 0);
    return acc;
  }, { total: 0, open: 0, completed: 0, overdue: 0 }), [records]);

  const createRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !canManage) return;
    const record: ComplianceRecord = {
      id: `comp-${Date.now()}`,
      companyId,
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
      const saved = await addDoc(collection(db, `companies/${companyId}/statutory_compliance`), {
        ...record,
        createdAt: serverTimestamp(),
      });
      setRecords((items) => [{ ...record, id: saved.id }, ...items]);
      setMessage('Compliance record prepared successfully.');
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
      await updateDoc(doc(db, `companies/${companyId}/statutory_compliance`, record.id), { status, updatedAt: serverTimestamp(), updatedBy: currentUser.uid });
      setRecords((items) => items.map((item) => item.id === record.id ? { ...item, status } : item));
      setMessage(`${record.type} record marked as ${status}.`);
    } catch (error: any) {
      setMessage(`Unable to update status: ${error.message || error}`);
    }
  };

  const seedFromPayroll = async () => {
    if (!currentPayrollRun) {
      setMessage('No payroll run found for the selected period. Generate payroll first or create the record manually.');
      return;
    }
    const due = dueDate || 'Not set';
    const seeds: Array<Pick<ComplianceRecord, 'type' | 'authority' | 'amount' | 'dueDate' | 'period' | 'status'>> = [
      { type: 'PAYE', authority: 'State Internal Revenue Service', amount: Number(currentPayrollRun.payePayable || 0), dueDate: due, period, status: 'Prepared' },
      { type: 'Pension', authority: 'Pension Fund Administrator / PenCom', amount: Number(currentPayrollRun.pensionEmployee || 0) + Number(currentPayrollRun.pensionEmployer || 0), dueDate: due, period, status: 'Prepared' },
      { type: 'NHF', authority: 'Federal Mortgage Bank / NHF desk', amount: Number(currentPayrollRun.nhfPayable || 0), dueDate: due, period, status: 'Prepared' },
    ].filter((item) => item.amount > 0);

    try {
      const savedRows: ComplianceRecord[] = [];
      for (const seed of seeds) {
        const saved = await addDoc(collection(db, `companies/${companyId}/statutory_compliance`), {
          ...seed,
          companyId,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        savedRows.push({ ...seed, id: saved.id, companyId, createdBy: currentUser.uid });
      }
      setRecords((items) => [...savedRows, ...items]);
      setMessage(`${savedRows.length} statutory records prepared from payroll run.`);
    } catch (error: any) {
      setMessage(`Unable to seed statutory records: ${error.message || error}`);
    }
  };

  const exportComplianceCsv = () => {
    const csv = [
      'Period,Type,Authority,Amount,Due Date,Status,Reference,Evidence,Notes',
      ...records.map((record) => [record.period, record.type, record.authority, record.amount, record.dueDate, record.status, record.referenceNo || '', record.evidenceName || '', record.notes || ''].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statutory-compliance-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="statutory-compliance-center">
      <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-indigo-200 font-black">PeopleCloud Statutory Compliance Center</p>
            <h1 className="text-2xl lg:text-3xl font-bold mt-2">PAYE, Pension, NHF, NHIS/NHIA, NSITF, ITF and remittance tracking.</h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl">Prepare statutory liabilities from payroll, track due dates, upload evidence references, monitor remittance status and export compliance reports.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Total" value={money(totals.total)} dark />
            <Metric label="Open" value={money(totals.open)} dark />
            <Metric label="Overdue" value={money(totals.overdue)} dark />
          </div>
        </div>
      </div>

      {message && <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-2">
        {[
          ['dashboard', 'Compliance Dashboard', ShieldCheck],
          ['rules', 'Compliance Rules', Landmark],
          ['calendar', 'Filing Calendar', CalendarDays],
          ['reports', 'Reports & Evidence', FileCheck2],
        ].map(([id, label, Icon]: any) => <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${activeTab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="w-4 h-4" />{label}</button>)}
      </div>

      {activeTab === 'dashboard' && <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <form onSubmit={createRecord} className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Wallet className="w-4 h-4 text-indigo-600" />Prepare Compliance Record</h2>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Period</label><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Compliance Type</label><select value={type} onChange={(event) => setType(event.target.value as ComplianceType)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"><option>PAYE</option><option>Pension</option><option>NHF</option><option>NHIS/NHIA</option><option>NSITF</option><option>ITF</option><option>WHT</option><option>Other</option></select></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Authority / Provider</label><input value={authority} onChange={(event) => setAuthority(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Amount</label><input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Due Date</label><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Reference No.</label><input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder="Receipt / schedule reference" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Evidence File Name</label><input value={evidenceName} onChange={(event) => setEvidenceName(event.target.value)} placeholder="e.g. PAYE-receipt.pdf" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <button disabled={!canManage} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Save Compliance Record</button>
          <button type="button" disabled={!canManage} onClick={seedFromPayroll} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Prepare PAYE/Pension/NHF from Payroll</button>
        </form>

        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Compliance Register</h2><p className="text-xs text-slate-500">Track statutory remittances, filing status and evidence references.</p></div><button onClick={exportComplianceCsv} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" />Export</button></div>
          <ComplianceTable records={records} updateStatus={updateStatus} />
        </div>
      </div>}

      {activeTab === 'rules' && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{defaultRules.map((rule) => <div key={rule.type} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"><div className="flex items-center justify-between mb-3"><h3 className="text-sm font-black text-slate-900">{rule.type}</h3><Landmark className="w-5 h-5 text-indigo-500" /></div><p className="text-xs font-semibold text-slate-700">{rule.authority}</p><p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{rule.basis}</p><div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3 text-[10px] text-slate-500"><p><strong>Due:</strong> {rule.due}</p><p><strong>Owner:</strong> {rule.owner}</p></div></div>)}</div>}

      {activeTab === 'calendar' && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 border-b"><h2 className="text-sm font-bold text-slate-900">Compliance Filing Calendar</h2><p className="text-xs text-slate-500">Upcoming statutory due dates based on prepared compliance records.</p></div><ComplianceTable records={records.slice().sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))} updateStatus={updateStatus} compact /></div>}

      {activeTab === 'reports' && <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Metric label="Completed" value={money(totals.completed)} icon={CheckCircle2} /><Metric label="Open Liability" value={money(totals.open)} icon={AlertTriangle} /><Metric label="Overdue Liability" value={money(totals.overdue)} icon={AlertTriangle} /><Metric label="Evidence Records" value={records.filter((record) => record.evidenceName).length} icon={FileUp} /><div className="md:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 text-xs text-slate-600"><p className="font-bold text-slate-900 mb-2">Audit and compliance evidence</p><p>This center records evidence file names and references now. A later Storage upgrade should upload receipts, remittance schedules, clearance letters and compliance certificates into Firebase Storage or a secured document vault.</p></div></div>}

      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-[11px] text-amber-800 leading-relaxed">
        <strong>Compliance note:</strong> Rates, thresholds, due dates and statutory applicability should be verified and configured for each client before production payroll use. This module provides the compliance workflow and tracking center, not legal or tax advice.
      </div>
    </div>
  );
}

function ComplianceTable({ records, updateStatus, compact = false }: { records: ComplianceRecord[]; updateStatus: (record: ComplianceRecord, status: ComplianceRecord['status']) => void; compact?: boolean }) {
  if (!records.length) return <div className="p-8 text-center text-xs text-slate-400">No compliance records yet. Prepare a record manually or seed PAYE/Pension/NHF from a payroll run.</div>;
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Period</th><th className="text-left p-3">Type</th><th className="text-left p-3">Authority</th><th className="text-right p-3">Amount</th><th className="text-left p-3">Due</th><th className="text-left p-3">Status</th>{!compact && <th className="text-left p-3">Action</th>}</tr></thead><tbody className="divide-y divide-slate-100">{records.map((record) => <tr key={record.id} className="hover:bg-slate-50"><td className="p-3 font-semibold text-slate-700">{record.period}</td><td className="p-3 font-black text-slate-900">{record.type}<br/><span className="text-[10px] font-normal text-slate-400">{record.referenceNo || record.evidenceName || 'No evidence yet'}</span></td><td className="p-3 text-slate-600">{record.authority}</td><td className="p-3 text-right font-bold text-slate-900">{money(record.amount)}</td><td className="p-3 text-slate-600">{record.dueDate}</td><td className="p-3"><span className={`px-2 py-1 border rounded-full text-[10px] font-black ${statusClass(record.status)}`}>{record.status}</span></td>{!compact && <td className="p-3"><select value={record.status} onChange={(event) => updateStatus(record, event.target.value as ComplianceRecord['status'])} className="border border-slate-200 rounded-lg px-2 py-1 text-[10px] bg-white"><option>Pending</option><option>Prepared</option><option>Remitted</option><option>Filed</option><option>Overdue</option></select></td>}</tr>)}</tbody></table></div>;
}

function Metric({ label, value, icon: Icon, dark = false }: { label: string; value: React.ReactNode; icon?: any; dark?: boolean }) {
  return <div className={`${dark ? 'bg-white/10 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} rounded-2xl border p-4 shadow-sm`}><div className="flex items-center justify-between gap-3"><div><p className={`text-[10px] uppercase tracking-wider font-black ${dark ? 'text-slate-300' : 'text-slate-400'}`}>{label}</p><p className="text-lg font-black mt-1 break-words">{value}</p></div>{Icon && <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span>}</div></div>;
}
