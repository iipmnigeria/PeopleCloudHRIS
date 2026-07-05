import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Download, Globe2, RefreshCw, WalletCards } from 'lucide-react';
import { db } from '../firebase';
import { UserRole } from '../types';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }; selectedTenantId: string };
type PayrollRun = { id: string; period?: string; countryCode?: string; country?: string; currency?: string; totalGross?: number; totalNet?: number; totalDeductions?: number; totalEmployerCost?: number; incomeTaxPayable?: number; socialEmployeePayable?: number; socialEmployerPayable?: number; healthHousingPayable?: number; employeeCount?: number; status?: string };
type Compliance = { id: string; period?: string; countryCode?: string; country?: string; currency?: string; amount?: number; status?: string; type?: string };
type Batch = { id: string; period?: string; currency?: string; totalAmount?: number; lineCount?: number; status?: string };
type CountryRow = { key: string; country: string; countryCode: string; currency: string; runs: number; employees: number; gross: number; net: number; deductions: number; employerCost: number; tax: number; social: number; complianceOpen: number; complianceFiled: number; paymentBatches: number; paymentQueued: number };

function money(value: number, currency = 'NGN') { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0)); }
function clean(value: unknown) { return String(value || '').replace(/"/g, '""'); }
function regionOf(code?: string) { if (['NG', 'GH', 'KE', 'ZA'].includes(code || '')) return 'Africa'; if (code === 'UK') return 'Europe'; if (code === 'US') return 'North America'; if (code === 'AE') return 'Middle East'; return 'Global'; }

export default function MultiCountryPayrollDashboard({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [compliance, setCompliance] = useState<Compliance[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [message, setMessage] = useState('');

  async function loadData() {
    if (!companyId) return;
    try {
      const runSnap = await getDocs(collection(db, `companies/${companyId}/payroll_runs`));
      const runRows: PayrollRun[] = [];
      runSnap.forEach((item) => runRows.push({ id: item.id, ...(item.data() as PayrollRun) }));
      setRuns(runRows);
      const compSnap = await getDocs(collection(db, `companies/${companyId}/global_compliance`));
      const compRows: Compliance[] = [];
      compSnap.forEach((item) => compRows.push({ id: item.id, ...(item.data() as Compliance) }));
      setCompliance(compRows);
      const batchSnap = await getDocs(collection(db, `companies/${companyId}/salary_payment_batches`));
      const batchRows: Batch[] = [];
      batchSnap.forEach((item) => batchRows.push({ id: item.id, ...(item.data() as Batch) }));
      setBatches(batchRows);
    } catch (error: any) { setMessage(`Unable to load multi-country dashboard: ${error.message || error}`); }
  }

  useEffect(() => { loadData(); }, [companyId]);

  const periodRuns = useMemo(() => runs.filter((run) => run.period === period), [runs, period]);
  const periodCompliance = useMemo(() => compliance.filter((item) => item.period === period), [compliance, period]);
  const periodBatches = useMemo(() => batches.filter((item) => item.period === period), [batches, period]);

  const rows = useMemo<CountryRow[]>(() => {
    const map: Record<string, CountryRow> = {};
    periodRuns.forEach((run) => {
      const key = `${run.countryCode || 'GLOBAL'}-${run.currency || 'NGN'}`;
      if (!map[key]) map[key] = { key, country: run.country || run.countryCode || 'Global', countryCode: run.countryCode || 'GLOBAL', currency: run.currency || 'NGN', runs: 0, employees: 0, gross: 0, net: 0, deductions: 0, employerCost: 0, tax: 0, social: 0, complianceOpen: 0, complianceFiled: 0, paymentBatches: 0, paymentQueued: 0 };
      map[key].runs += 1;
      map[key].employees += Number(run.employeeCount || 0);
      map[key].gross += Number(run.totalGross || 0);
      map[key].net += Number(run.totalNet || 0);
      map[key].deductions += Number(run.totalDeductions || 0);
      map[key].employerCost += Number(run.totalEmployerCost || 0);
      map[key].tax += Number(run.incomeTaxPayable || 0);
      map[key].social += Number(run.socialEmployeePayable || 0) + Number(run.socialEmployerPayable || 0) + Number(run.healthHousingPayable || 0);
    });
    periodCompliance.forEach((item) => {
      const matchingKey = Object.keys(map).find((key) => key.startsWith(`${item.countryCode || 'GLOBAL'}-`));
      const key = matchingKey || `${item.countryCode || 'GLOBAL'}-${item.currency || 'NGN'}`;
      if (!map[key]) map[key] = { key, country: item.country || item.countryCode || 'Global', countryCode: item.countryCode || 'GLOBAL', currency: item.currency || 'NGN', runs: 0, employees: 0, gross: 0, net: 0, deductions: 0, employerCost: 0, tax: 0, social: 0, complianceOpen: 0, complianceFiled: 0, paymentBatches: 0, paymentQueued: 0 };
      if (['Filed', 'Remitted'].includes(item.status || '')) map[key].complianceFiled += Number(item.amount || 0); else map[key].complianceOpen += Number(item.amount || 0);
    });
    periodBatches.forEach((batch) => {
      const matchingKey = Object.keys(map).find((key) => key.endsWith(`-${batch.currency || 'NGN'}`));
      const key = matchingKey || `GLOBAL-${batch.currency || 'NGN'}`;
      if (!map[key]) map[key] = { key, country: 'Global', countryCode: 'GLOBAL', currency: batch.currency || 'NGN', runs: 0, employees: 0, gross: 0, net: 0, deductions: 0, employerCost: 0, tax: 0, social: 0, complianceOpen: 0, complianceFiled: 0, paymentBatches: 0, paymentQueued: 0 };
      map[key].paymentBatches += 1;
      map[key].paymentQueued += Number(batch.totalAmount || 0);
    });
    return Object.values(map).sort((a, b) => b.employerCost - a.employerCost);
  }, [periodRuns, periodCompliance, periodBatches]);

  const regionRows = useMemo(() => rows.reduce((acc, row) => { const region = regionOf(row.countryCode); if (!acc[region]) acc[region] = { employees: 0, net: 0, employerCost: 0, countries: 0 }; acc[region].employees += row.employees; acc[region].net += row.net; acc[region].employerCost += row.employerCost; acc[region].countries += 1; return acc; }, {} as Record<string, { employees: number; net: number; employerCost: number; countries: number }>), [rows]);
  const currencyTotals = useMemo(() => rows.reduce((acc, row) => { if (!acc[row.currency]) acc[row.currency] = { net: 0, employerCost: 0, openCompliance: 0 }; acc[row.currency].net += row.net; acc[row.currency].employerCost += row.employerCost; acc[row.currency].openCompliance += row.complianceOpen; return acc; }, {} as Record<string, { net: number; employerCost: number; openCompliance: number }>), [rows]);

  function exportCsv() {
    const csv = ['Period,Country,Region,Currency,Runs,Employees,Gross,Net,Deductions,Employer Cost,Tax,Social,Open Compliance,Filed Compliance,Payment Batches,Queued Payments', ...rows.map((row) => [period, row.country, regionOf(row.countryCode), row.currency, row.runs, row.employees, row.gross, row.net, row.deductions, row.employerCost, row.tax, row.social, row.complianceOpen, row.complianceFiled, row.paymentBatches, row.paymentQueued].map((value) => `"${clean(value)}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `multi-country-payroll-dashboard-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <div className="space-y-6" id="multi-country-payroll-dashboard"><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Item 9</p><h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><Globe2 className="w-5 h-5 text-indigo-600" />Multi-Country Payroll Dashboard</h2><p className="text-xs text-slate-500 mt-1 max-w-3xl">View payroll exposure by country, currency, region, employer cost, compliance liability and payment batch status.</p></div><div className="flex flex-wrap gap-2"><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs" /><button onClick={loadData} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button><button onClick={exportCsv} disabled={rows.length === 0} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" />Export</button></div></div>{message && <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs font-semibold text-amber-800">{message}</div>}<div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="Countries/Currencies" value={rows.length} /><Metric label="Payroll Runs" value={periodRuns.length} /><Metric label="Employees Paid" value={rows.reduce((s, r) => s + r.employees, 0)} /><Metric label="Open Compliance Items" value={periodCompliance.filter((item) => !['Filed', 'Remitted'].includes(item.status || '')).length} /></div><div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100"><h3 className="text-sm font-black text-slate-900">Country Payroll Exposure</h3></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Country</th><th className="text-right p-3">Employees</th><th className="text-right p-3">Net Pay</th><th className="text-right p-3">Employer Cost</th><th className="text-right p-3">Open Compliance</th><th className="text-right p-3">Payment Queue</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No multi-country payroll records found for this period.</td></tr>}{rows.map((row) => <tr key={row.key} className="hover:bg-slate-50"><td className="p-3"><p className="font-black text-slate-900">{row.country}</p><p className="text-[10px] text-slate-400">{regionOf(row.countryCode)} • {row.currency} • {row.runs} run(s)</p></td><td className="p-3 text-right font-bold">{row.employees}</td><td className="p-3 text-right font-black text-emerald-600">{money(row.net, row.currency)}</td><td className="p-3 text-right font-bold text-slate-900">{money(row.employerCost, row.currency)}</td><td className="p-3 text-right text-rose-600 font-bold">{money(row.complianceOpen, row.currency)}</td><td className="p-3 text-right text-indigo-600 font-bold">{money(row.paymentQueued, row.currency)}</td></tr>)}</tbody></table></div></div><div className="space-y-4"><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"><h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><WalletCards className="w-4 h-4 text-indigo-600" />Currency Summary</h3><div className="mt-3 space-y-2">{Object.entries(currencyTotals).map(([currency, item]) => <div key={currency} className="rounded-xl bg-slate-50 border border-slate-100 p-3"><p className="text-xs font-black text-slate-900">{currency}</p><p className="text-[11px] text-slate-500">Net: {money(item.net, currency)}</p><p className="text-[11px] text-slate-500">Employer Cost: {money(item.employerCost, currency)}</p><p className="text-[11px] text-rose-600">Open Compliance: {money(item.openCompliance, currency)}</p></div>)}</div></div><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"><h3 className="text-sm font-black text-slate-900">Region Summary</h3><div className="mt-3 space-y-2">{Object.entries(regionRows).map(([region, item]) => <div key={region} className="rounded-xl bg-slate-50 border border-slate-100 p-3"><p className="text-xs font-black text-slate-900">{region}</p><p className="text-[11px] text-slate-500">Countries/Currencies: {item.countries}</p><p className="text-[11px] text-slate-500">Employees: {item.employees}</p></div>)}</div></div></div></div><div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-[11px] text-amber-800 leading-relaxed"><strong>FX note:</strong> This dashboard reports each country in its native payroll currency. Consolidated base-currency conversion should be added later using approved company FX rates.</div></div>;
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{value}</p></div>; }
