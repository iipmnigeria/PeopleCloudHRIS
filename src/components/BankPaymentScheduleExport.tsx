import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { Banknote, CheckCircle2, Download, RefreshCw, Search } from 'lucide-react';
import { db } from '../firebase';
import { Employee, UserRole } from '../types';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }; selectedTenantId: string };
type PayLine = { id: string; employeeId?: string; employeeName?: string; employeeEmail?: string; period?: string; currency?: string; countryCode?: string; netPay?: number; paymentStatus?: string; status?: string; bankName?: string; accountNumber?: string; accountName?: string; payrollRunId?: string };
type Batch = { id: string; period?: string; currency?: string; lineCount?: number; totalAmount?: number; status?: string; createdAt?: any };

function canManage(role: UserRole) { return ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'].includes(role); }
function money(value: number, currency = 'NGN') { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0)); }
function clean(value: unknown) { return String(value || '').replace(/"/g, '""'); }

export default function BankPaymentScheduleExport({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const allowed = canManage(currentUser.role);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayLine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadData() {
    if (!companyId) return;
    try {
      const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
      const empRows: Employee[] = [];
      empSnap.forEach((item) => empRows.push({ ...(item.data() as Employee), employeeId: item.id }));
      setEmployees(empRows);
      const paySnap = await getDocs(collection(db, `companies/${companyId}/payroll`));
      const payRows: PayLine[] = [];
      paySnap.forEach((item) => payRows.push({ id: item.id, ...(item.data() as PayLine) }));
      setPayroll(payRows);
      const batchSnap = await getDocs(collection(db, `companies/${companyId}/salary_payment_batches`));
      const batchRows: Batch[] = [];
      batchSnap.forEach((item) => batchRows.push({ id: item.id, ...(item.data() as Batch) }));
      setBatches(batchRows);
    } catch (error: any) { setMessage(`Unable to load payment data: ${error.message || error}`); }
  }

  useEffect(() => { loadData(); }, [companyId]);

  const enriched = useMemo(() => payroll.filter((line) => line.period === period).map((line) => {
    const emp = employees.find((item) => item.employeeId === line.employeeId || item.email === line.employeeEmail);
    return { ...line, bankName: line.bankName || emp?.bankName || '', accountNumber: line.accountNumber || emp?.accountNumber || '', accountName: line.accountName || line.employeeName || `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() };
  }), [payroll, employees, period]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter((line) => [line.employeeName, line.employeeEmail, line.bankName, line.accountNumber, line.paymentStatus, line.status].join(' ').toLowerCase().includes(q));
  }, [enriched, query]);

  const payable = useMemo(() => filtered.filter((line) => Number(line.netPay || 0) > 0 && !['Paid', 'Failed'].includes(line.paymentStatus || '')), [filtered]);
  const totalPayable = useMemo(() => payable.reduce((sum, line) => sum + Number(line.netPay || 0), 0), [payable]);
  const missingBank = useMemo(() => payable.filter((line) => !line.bankName || !line.accountNumber).length, [payable]);

  function exportCsv(lines = payable, suffix = 'bank-payment-schedule') {
    const csv = ['Employee,Email,Bank,Account Number,Account Name,Period,Currency,Net Pay,Payment Status,Payroll Run', ...lines.map((line) => [line.employeeName, line.employeeEmail, line.bankName, line.accountNumber, line.accountName, line.period, line.currency, line.netPay, line.paymentStatus || 'Pending', line.payrollRunId].map((v) => `"${clean(v)}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${suffix}-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createBatch() {
    if (!companyId || !allowed || payable.length === 0) return;
    setBusy(true); setMessage('');
    try {
      const batchRef = await addDoc(collection(db, `companies/${companyId}/salary_payment_batches`), { companyId, period, currency: payable[0]?.currency || 'NGN', lineCount: payable.length, totalAmount: totalPayable, status: missingBank > 0 ? 'Pending Bank Validation' : 'Ready for Payment', missingBankCount: missingBank, createdBy: currentUser.uid, createdAt: serverTimestamp() });
      await Promise.all(payable.map((line) => updateDoc(doc(db, `companies/${companyId}/payroll`, line.id), { paymentBatchId: batchRef.id, paymentStatus: missingBank > 0 ? 'Pending Bank Validation' : 'Queued for Payment', paymentQueuedAt: serverTimestamp(), paymentQueuedBy: currentUser.uid })));
      setBatches((items) => [{ id: batchRef.id, period, currency: payable[0]?.currency || 'NGN', lineCount: payable.length, totalAmount: totalPayable, status: missingBank > 0 ? 'Pending Bank Validation' : 'Ready for Payment' }, ...items]);
      setMessage(`Payment batch created for ${payable.length} employee(s).`);
      loadData();
    } catch (error: any) { setMessage(`Unable to create payment batch: ${error.message || error}`); }
    finally { setBusy(false); }
  }

  async function markLine(line: PayLine, status: 'Paid' | 'Failed') {
    if (!companyId || !allowed) return;
    try {
      await updateDoc(doc(db, `companies/${companyId}/payroll`, line.id), { paymentStatus: status, paymentStatusUpdatedAt: serverTimestamp(), paymentStatusUpdatedBy: currentUser.uid });
      setPayroll((items) => items.map((item) => item.id === line.id ? { ...item, paymentStatus: status } : item));
    } catch (error: any) { setMessage(`Unable to update payment status: ${error.message || error}`); }
  }

  return <div className="space-y-6" id="bank-payment-schedule-export"><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Item 8</p><h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><Banknote className="w-5 h-5 text-indigo-600" />Bank Payment Schedule Export</h2><p className="text-xs text-slate-500 mt-1 max-w-3xl">Create salary payment batches, export bank schedules, track payment status and reconcile failed payments.</p></div><div className="flex flex-wrap gap-2"><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs" /><button onClick={loadData} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button></div></div>{message && <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}<div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="Payable Lines" value={payable.length} /><Metric label="Total Payable" value={money(totalPayable, payable[0]?.currency)} /><Metric label="Missing Bank Details" value={missingBank} /><Metric label="Batches" value={batches.length} /></div><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row gap-3 md:items-center justify-between"><div className="relative min-w-72"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payment lines..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs" /></div><div className="flex flex-wrap gap-2"><button onClick={() => exportCsv(payable)} disabled={payable.length === 0} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" />Export Bank CSV</button><button onClick={createBatch} disabled={!allowed || busy || payable.length === 0} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold">Create Payment Batch</button></div></div><div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Employee</th><th className="text-left p-3">Bank Details</th><th className="text-right p-3">Net Pay</th><th className="text-left p-3">Status</th><th className="text-left p-3">Reconcile</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No payroll payment lines found for this period.</td></tr>}{filtered.map((line) => <tr key={line.id} className="hover:bg-slate-50"><td className="p-3"><p className="font-black text-slate-900">{line.employeeName}</p><p className="text-[10px] text-slate-400">{line.employeeEmail}</p></td><td className="p-3"><p className="font-bold text-slate-700">{line.bankName || 'Missing bank'}</p><p className="text-[10px] text-slate-400">{line.accountNumber || 'Missing account'} • {line.accountName || ''}</p></td><td className="p-3 text-right font-black text-emerald-600">{money(Number(line.netPay || 0), line.currency)}</td><td className="p-3"><span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold">{line.paymentStatus || 'Pending'}</span></td><td className="p-3"><div className="flex gap-1"><button onClick={() => markLine(line, 'Paid')} className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold">Paid</button><button onClick={() => markLine(line, 'Failed')} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-bold">Failed</button></div></td></tr>)}</tbody></table></div><div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100"><h3 className="text-sm font-black text-slate-900">Payment Batches</h3></div><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Period</th><th className="text-right p-3">Lines</th><th className="text-right p-3">Amount</th><th className="text-left p-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{batches.map((batch) => <tr key={batch.id}><td className="p-3 font-bold text-slate-900">{batch.period}</td><td className="p-3 text-right">{batch.lineCount}</td><td className="p-3 text-right font-black">{money(Number(batch.totalAmount || 0), batch.currency)}</td><td className="p-3 text-slate-600">{batch.status}</td></tr>)}</tbody></table></div></div>;
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{value}</p></div>; }
