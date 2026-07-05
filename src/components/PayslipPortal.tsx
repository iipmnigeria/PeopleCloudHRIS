import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { Download, FileText, Search } from 'lucide-react';
import { db } from '../firebase';
import { UserRole } from '../types';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }; selectedTenantId: string };
type Payslip = { id: string; employeeId?: string; employeeName?: string; employeeEmail?: string; jobTitle?: string; departmentId?: string; period?: string; countryCode?: string; currency?: string; status?: string; paymentStatus?: string; grossPay?: number; incomeTax?: number; employeeSocial?: number; employeeSocialContribution?: number; healthHousing?: number; housingOrHealthContribution?: number; deductions?: number; totalDeductions?: number; netPay?: number; employerCost?: number };

function canViewAll(role: UserRole) { return ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'].includes(role); }
function money(value: number, currency = 'NGN') { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0)); }
function tax(row: Payslip) { return Number(row.incomeTax || 0); }
function social(row: Payslip) { return Number(row.employeeSocial || row.employeeSocialContribution || 0); }
function health(row: Payslip) { return Number(row.healthHousing || row.housingOrHealthContribution || 0); }
function deductions(row: Payslip) { return Number(row.deductions || row.totalDeductions || tax(row) + social(row) + health(row)); }

export default function PayslipPortal({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const [items, setItems] = useState<Payslip[]>([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const viewAll = canViewAll(currentUser.role);

  async function loadPayslips() {
    if (!companyId) return;
    try {
      const payrollRef = collection(db, `companies/${companyId}/payroll`);
      const snap = viewAll ? await getDocs(payrollRef) : await getDocs(firestoreQuery(payrollRef, where('employeeEmail', '==', currentUser.email)));
      const rows: Payslip[] = [];
      snap.forEach((item) => rows.push({ id: item.id, ...(item.data() as Payslip) }));
      rows.sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')));
      setItems(rows);
    } catch (error: any) { setMessage(`Unable to load payslips: ${error.message || error}`); }
  }

  useEffect(() => { loadPayslips(); }, [companyId, currentUser.email, viewAll]);

  const visible = useMemo(() => {
    const base = viewAll ? items : items.filter((item) => String(item.employeeEmail || '').toLowerCase() === currentUser.email.toLowerCase());
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((item) => [item.employeeName, item.period, item.jobTitle, item.departmentId, item.countryCode].join(' ').toLowerCase().includes(q));
  }, [items, search, currentUser.email, viewAll]);

  function openPayslip(row: Payslip) {
    const currency = row.currency || 'NGN';
    const text = [
      'PeopleCloudHRIS Payslip',
      `Period: ${row.period || 'N/A'}`,
      `Country: ${row.countryCode || 'N/A'}`,
      `Employee: ${row.employeeName || 'Employee'}`,
      `Job Title: ${row.jobTitle || ''}`,
      `Department: ${row.departmentId || ''}`,
      `Gross Pay: ${money(Number(row.grossPay || 0), currency)}`,
      `Income Tax: ${money(tax(row), currency)}`,
      `Employee Social: ${money(social(row), currency)}`,
      `Health/Housing: ${money(health(row), currency)}`,
      `Total Deductions: ${money(deductions(row), currency)}`,
      `Net Pay: ${money(Number(row.netPay || 0), currency)}`,
      '',
      'Use browser print or save as PDF.'
    ].join('\n');
    const win = window.open('', '_blank');
    if (win) { win.document.body.innerText = text; }
  }

  return <div className="space-y-6" id="payslip-portal"><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Item 4</p><h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600" />Payslip PDF & Employee Payroll Portal</h2><p className="text-xs text-slate-500 mt-1">Employees can view their payslips. HR, Finance and Admin users can review all payslips.</p></div><button onClick={loadPayslips} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">Refresh</button></div>{message && <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs font-semibold text-amber-800">{message}</div>}<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between"><p className="text-xs text-slate-500">{viewAll ? 'All payslip records view' : 'Employee self-service payslip view'}</p><div className="relative min-w-72"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payslips..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs" /></div></div><div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Employee</th><th className="text-left p-3">Period</th><th className="text-right p-3">Gross</th><th className="text-right p-3">Deductions</th><th className="text-right p-3">Net Pay</th><th className="text-left p-3">PDF</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No payslip records found.</td></tr>}{visible.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="p-3"><p className="font-black text-slate-900">{row.employeeName || 'Unnamed Employee'}</p><p className="text-[10px] text-slate-400">{row.jobTitle || 'No title'} • {row.departmentId || 'No department'}</p></td><td className="p-3 text-slate-600">{row.period || 'N/A'}</td><td className="p-3 text-right font-bold text-slate-900">{money(Number(row.grossPay || 0), row.currency)}</td><td className="p-3 text-right font-bold text-rose-600">{money(deductions(row), row.currency)}</td><td className="p-3 text-right font-black text-emerald-600">{money(Number(row.netPay || 0), row.currency)}</td><td className="p-3"><button onClick={() => openPayslip(row)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-bold"><Download className="w-3 h-3" />PDF</button></td></tr>)}</tbody></table></div></div></div>;
}
