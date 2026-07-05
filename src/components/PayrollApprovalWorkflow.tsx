import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Clock3, Lock, RefreshCcw, ShieldCheck, UserCheck, Wallet } from 'lucide-react';
import { db } from '../firebase';
import { UserRole } from '../types';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type PayrollRun = {
  id: string;
  period?: string;
  country?: string;
  currency?: string;
  status?: string;
  approvalStage?: string;
  locked?: boolean;
  totalGross?: number;
  totalNet?: number;
  totalDeductions?: number;
  totalEmployerCost?: number;
  employeeCount?: number;
  approvalHistory?: Array<{ stage: string; action: string; by: string; at: string }>;
};

const workflowSteps = [
  { stage: 'Draft', label: 'Prepared', icon: Clock3 },
  { stage: 'HR Review', label: 'HR Review', icon: UserCheck },
  { stage: 'Finance Review', label: 'Finance Review', icon: Wallet },
  { stage: 'Final Approval', label: 'Final Approval', icon: ShieldCheck },
  { stage: 'Locked', label: 'Paid & Locked', icon: Lock },
];

function money(value: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function stageIndex(stage?: string) {
  const index = workflowSteps.findIndex((item) => item.stage === (stage || 'Draft'));
  return index < 0 ? 0 : index;
}

function canPerform(role: UserRole, action: string) {
  if (role === 'SuperAdmin') return true;
  if (action === 'submit') return ['CompanyAdmin', 'HRManager', 'FinanceOfficer'].includes(role);
  if (action === 'hr-review') return ['CompanyAdmin', 'HRManager'].includes(role);
  if (action === 'finance-review') return ['CompanyAdmin', 'FinanceOfficer'].includes(role);
  if (action === 'final-approve') return ['CompanyAdmin'].includes(role);
  if (action === 'mark-paid') return ['CompanyAdmin', 'FinanceOfficer'].includes(role);
  if (action === 'reversal') return ['CompanyAdmin', 'FinanceOfficer'].includes(role);
  return false;
}

export default function PayrollApprovalWorkflow({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRuns = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, `companies/${companyId}/payroll_runs`));
      const rows: PayrollRun[] = [];
      snap.forEach((item) => rows.push({ id: item.id, ...(item.data() as PayrollRun) }));
      rows.sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')));
      setRuns(rows);
    } catch (error: any) {
      setMessage(`Unable to load payroll runs: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [companyId]);

  const summary = useMemo(() => runs.reduce((acc, run) => {
    acc.total += 1;
    if (run.locked || run.approvalStage === 'Locked') acc.locked += 1;
    else if (run.approvalStage === 'Final Approval') acc.final += 1;
    else if (run.approvalStage === 'Finance Review') acc.finance += 1;
    else if (run.approvalStage === 'HR Review') acc.hr += 1;
    else acc.draft += 1;
    return acc;
  }, { total: 0, draft: 0, hr: 0, finance: 0, final: 0, locked: 0 }), [runs]);

  const updateRun = async (run: PayrollRun, action: string, nextStage: string, nextStatus: string, locked = false) => {
    if (!companyId) return;
    if (!canPerform(currentUser.role, action)) {
      setMessage('You do not have permission to perform this payroll approval action.');
      return;
    }
    if (run.locked && action !== 'reversal') {
      setMessage('This payroll run is locked. Only a controlled reversal request can be created.');
      return;
    }
    const history = [...(run.approvalHistory || []), { stage: nextStage, action: nextStatus, by: currentUser.displayName || currentUser.email, at: new Date().toISOString() }];
    try {
      await updateDoc(doc(db, `companies/${companyId}/payroll_runs`, run.id), {
        approvalStage: nextStage,
        status: nextStatus,
        locked,
        approvalHistory: history,
        lastApprovalActionBy: currentUser.uid,
        lastApprovalActionAt: serverTimestamp(),
      });
      setRuns((items) => items.map((item) => item.id === run.id ? { ...item, approvalStage: nextStage, status: nextStatus, locked, approvalHistory: history } : item));
      setMessage(`Payroll run ${run.period || run.id} moved to ${nextStage}.`);
    } catch (error: any) {
      setMessage(`Unable to update approval workflow: ${error.message || error}`);
    }
  };

  const requestReversal = async (run: PayrollRun) => {
    if (!companyId || !canPerform(currentUser.role, 'reversal')) return;
    const history = [...(run.approvalHistory || []), { stage: 'Reversal Requested', action: 'Controlled reversal requested', by: currentUser.displayName || currentUser.email, at: new Date().toISOString() }];
    try {
      await updateDoc(doc(db, `companies/${companyId}/payroll_runs`, run.id), {
        reversalRequested: true,
        approvalStage: 'Reversal Requested',
        status: 'Reversal Requested',
        approvalHistory: history,
        reversalRequestedBy: currentUser.uid,
        reversalRequestedAt: serverTimestamp(),
      });
      setRuns((items) => items.map((item) => item.id === run.id ? { ...item, approvalStage: 'Reversal Requested', status: 'Reversal Requested', approvalHistory: history } : item));
      setMessage('Controlled reversal request created for admin review.');
    } catch (error: any) {
      setMessage(`Unable to request reversal: ${error.message || error}`);
    }
  };

  const renderAction = (run: PayrollRun) => {
    const stage = run.approvalStage || (run.status === 'Paid' ? 'Locked' : 'Draft');
    if (stage === 'Draft' || run.status === 'Draft' || run.status === 'Approved') return <button onClick={() => updateRun(run, 'submit', 'HR Review', 'Pending HR Review')} className="btn-primary">Submit to HR</button>;
    if (stage === 'HR Review') return <button onClick={() => updateRun(run, 'hr-review', 'Finance Review', 'HR Reviewed')} className="btn-primary">HR Reviewed</button>;
    if (stage === 'Finance Review') return <button onClick={() => updateRun(run, 'finance-review', 'Final Approval', 'Finance Reviewed')} className="btn-primary">Finance Reviewed</button>;
    if (stage === 'Final Approval') return <button onClick={() => updateRun(run, 'final-approve', 'Approved', 'Final Approved')} className="btn-primary">Final Approve</button>;
    if (stage === 'Approved') return <button onClick={() => updateRun(run, 'mark-paid', 'Locked', 'Paid', true)} className="btn-primary">Mark Paid & Lock</button>;
    if (stage === 'Locked' || run.locked || run.status === 'Paid') return <button onClick={() => requestReversal(run)} className="btn-secondary"><RefreshCcw className="w-4 h-4" />Request Reversal</button>;
    return <button onClick={() => updateRun(run, 'submit', 'HR Review', 'Pending HR Review')} className="btn-primary">Restart Workflow</button>;
  };

  return (
    <div className="space-y-6" id="payroll-approval-workflow">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Item 3</p>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-600" />Payroll Approval Workflow</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">Controls payroll submission, HR review, finance review, final approval, paid lock and reversal request tracking.</p>
          </div>
          <button onClick={loadRuns} disabled={loading} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">Refresh</button>
        </div>
      </div>

      {message && <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Metric label="Total" value={summary.total} />
        <Metric label="Draft" value={summary.draft} />
        <Metric label="HR" value={summary.hr} />
        <Metric label="Finance" value={summary.finance} />
        <Metric label="Final" value={summary.final} />
        <Metric label="Locked" value={summary.locked} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Payroll Run</th><th className="text-left p-3">Workflow</th><th className="text-right p-3">Net Pay</th><th className="text-right p-3">Employer Cost</th><th className="text-left p-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{runs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No payroll runs found. Generate and save payroll first.</td></tr>}{runs.map((run) => <tr key={run.id} className="hover:bg-slate-50"><td className="p-3"><p className="font-black text-slate-900">{run.period || 'No period'}</p><p className="text-[10px] text-slate-400">{run.country || 'Country not set'} • {run.employeeCount || 0} employee(s)</p><p className="text-[10px] text-slate-400">Status: {run.status || 'Draft'}</p></td><td className="p-3"><Workflow stage={run.approvalStage || (run.locked ? 'Locked' : 'Draft')} /></td><td className="p-3 text-right font-bold text-emerald-600">{money(run.totalNet || 0, run.currency)}</td><td className="p-3 text-right font-bold text-slate-900">{money(run.totalEmployerCost || 0, run.currency)}</td><td className="p-3">{renderAction(run)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Workflow({ stage }: { stage: string }) {
  const currentIndex = stageIndex(stage);
  return <div className="flex flex-wrap gap-1">{workflowSteps.map((step, index) => { const Icon = step.icon; const active = index <= currentIndex; return <span key={step.stage} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${active ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}><Icon className="w-3 h-3" />{step.label}</span>; })}</div>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{value}</p></div>;
}
