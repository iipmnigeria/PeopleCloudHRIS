import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Calculator, CheckCircle2, CreditCard, Download, FileText, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Employee, UserRole } from '../types';

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
  housingAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  overtime: number;
  bonus: number;
  grossPay: number;
  employeePension: number;
  employerPension: number;
  payeTax: number;
  nhf: number;
  loanDeduction: number;
  totalDeductions: number;
  netPay: number;
  employerCost: number;
};

const demoEmployees: Employee[] = [
  { employeeId: 'emp-001', companyId: 'demo', firstName: 'Amina', lastName: 'Okafor', email: 'amina@demo.com', phone: '', dateOfBirth: '', gender: '', address: '', jobTitle: 'HR Business Partner', departmentId: 'People Operations', gradeLevel: 'Grade 7', employmentType: 'Full-Time', dateOfEmployment: '2026-01-01', status: 'Active', baseSalary: 650000, createdAt: new Date().toISOString() },
  { employeeId: 'emp-002', companyId: 'demo', firstName: 'Tunde', lastName: 'Bello', email: 'tunde@demo.com', phone: '', dateOfBirth: '', gender: '', address: '', jobTitle: 'Operations Officer', departmentId: 'Operations', gradeLevel: 'Grade 5', employmentType: 'Full-Time', dateOfEmployment: '2026-01-01', status: 'Active', baseSalary: 420000, createdAt: new Date().toISOString() },
  { employeeId: 'emp-003', companyId: 'demo', firstName: 'Chika', lastName: 'Nwosu', email: 'chika@demo.com', phone: '', dateOfBirth: '', gender: '', address: '', jobTitle: 'Finance Lead', departmentId: 'Finance', gradeLevel: 'Grade 8', employmentType: 'Full-Time', dateOfEmployment: '2026-01-01', status: 'Active', baseSalary: 820000, createdAt: new Date().toISOString() }
];

function money(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);
}

function employeeName(employee: Employee) {
  return `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || employee.employeeId;
}

function estimatePaye(gross: number, pension: number, nhf: number) {
  const annualGross = gross * 12;
  const consolidatedRelief = Math.max(annualGross * 0.2 + 200000, annualGross * 0.01);
  const taxableAnnual = Math.max(0, annualGross - consolidatedRelief - (pension + nhf) * 12);
  const bands = [
    { limit: 300000, rate: 0.07 },
    { limit: 300000, rate: 0.11 },
    { limit: 500000, rate: 0.15 },
    { limit: 500000, rate: 0.19 },
    { limit: 1600000, rate: 0.21 },
    { limit: Infinity, rate: 0.24 },
  ];
  let remaining = taxableAnnual;
  let tax = 0;
  for (const band of bands) {
    const amount = Math.min(remaining, band.limit);
    if (amount <= 0) break;
    tax += amount * band.rate;
    remaining -= amount;
  }
  return Math.round(tax / 12);
}

export default function TruePayrollEngine({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canRunPayroll = ['CompanyAdmin', 'HRManager', 'FinanceOfficer'].includes(currentUser.role);
  const [employees, setEmployees] = useState<Employee[]>(demoEmployees);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [status, setStatus] = useState('Draft');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'run' | 'statutory' | 'payslips'>('run');

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
        console.warn('True payroll engine is using demo employee data:', error);
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
      const employeePension = Math.round(grossPay * 0.08);
      const employerPension = Math.round(grossPay * 0.1);
      const nhf = Math.round(grossPay * 0.025);
      const payeTax = estimatePaye(grossPay, employeePension, nhf);
      const loanDeduction = 0;
      const totalDeductions = employeePension + nhf + payeTax + loanDeduction;
      const netPay = grossPay - totalDeductions;
      return {
        employeeId: employee.employeeId,
        employeeName: employeeName(employee),
        jobTitle: employee.jobTitle,
        departmentId: employee.departmentId,
        baseSalary,
        housingAllowance,
        transportAllowance,
        otherAllowance,
        overtime,
        bonus,
        grossPay,
        employeePension,
        employerPension,
        payeTax,
        nhf,
        loanDeduction,
        totalDeductions,
        netPay,
        employerCost: grossPay + employerPension,
      };
    });
    setLines(generated);
    setStatus('Draft');
    setMessage(`Payroll generated for ${generated.length} employee(s). Review totals before approval.`);
  };

  const totals = useMemo(() => lines.reduce((acc, line) => {
    acc.gross += line.grossPay;
    acc.deductions += line.totalDeductions;
    acc.net += line.netPay;
    acc.paye += line.payeTax;
    acc.pensionEmployee += line.employeePension;
    acc.pensionEmployer += line.employerPension;
    acc.nhf += line.nhf;
    acc.employerCost += line.employerCost;
    return acc;
  }, { gross: 0, deductions: 0, net: 0, paye: 0, pensionEmployee: 0, pensionEmployer: 0, nhf: 0, employerCost: 0 }), [lines]);

  const savePayrollRun = async (nextStatus: 'Draft' | 'Approved' | 'Paid') => {
    if (!companyId || !lines.length) return;
    try {
      const runRef = await addDoc(collection(db, `companies/${companyId}/payroll_runs`), {
        companyId,
        period,
        status: nextStatus,
        totalGross: totals.gross,
        totalDeductions: totals.deductions,
        totalNet: totals.net,
        totalEmployerCost: totals.employerCost,
        payePayable: totals.paye,
        pensionEmployee: totals.pensionEmployee,
        pensionEmployer: totals.pensionEmployer,
        nhfPayable: totals.nhf,
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
      setMessage(`Payroll ${nextStatus.toLowerCase()} and saved successfully.`);
    } catch (error: any) {
      setMessage(`Unable to save payroll: ${error.message || error}`);
    }
  };

  const exportCsv = () => {
    const csv = [
      'Employee,Job Title,Department,Basic,Housing,Transport,Other,Gross,PAYE,Pension,NHF,Total Deductions,Net Pay,Employer Cost',
      ...lines.map((line) => [line.employeeName, line.jobTitle, line.departmentId, line.baseSalary, line.housingAllowance, line.transportAllowance, line.otherAllowance, line.grossPay, line.payeTax, line.employeePension, line.nhf, line.totalDeductions, line.netPay, line.employerCost].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="true-payroll-engine">
      <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-indigo-200 font-black">PeopleCloud True Payroll Engine</p>
            <h1 className="text-2xl lg:text-3xl font-bold mt-2">Run payroll, calculate statutory deductions and issue payroll records.</h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl">Payroll run generation, PAYE estimate, employee pension, employer pension, NHF, net pay, employer cost, approval status, CSV export and Firestore payroll records.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Gross" value={money(totals.gross)} dark />
            <Metric label="Net Pay" value={money(totals.net)} dark />
            <Metric label="Status" value={status} dark />
          </div>
        </div>
      </div>

      {message && <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-2">
        {[['run', 'Payroll Run', Calculator], ['statutory', 'Statutory Summary', ShieldCheck], ['payslips', 'Payslip Register', FileText]].map(([id, label, Icon]: any) => <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${activeTab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="w-4 h-4" />{label}</button>)}
      </div>

      {activeTab === 'run' && <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-600" />Payroll Control</h2>
          <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Pay Period</label><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <button disabled={!canRunPayroll} onClick={generatePayroll} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Generate Payroll</button>
          <button disabled={!lines.length || !canRunPayroll} onClick={() => savePayrollRun('Approved')} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Approve Payroll</button>
          <button disabled={!lines.length || !canRunPayroll} onClick={() => savePayrollRun('Paid')} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">Mark as Paid</button>
          <button disabled={!lines.length} onClick={exportCsv} className="w-full border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-center gap-2"><Download className="w-4 h-4" />Export CSV</button>
          <p className="text-[10px] text-slate-400 leading-relaxed">Statutory values are configurable calculation estimates. Final compliance should be verified against current official payroll rules before production use.</p>
        </div>
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Payroll Register</h2><p className="text-xs text-slate-500">{lines.length || employees.length} employee(s) available for payroll.</p></div><Users className="w-5 h-5 text-indigo-500" /></div>
          <PayrollTable lines={lines} employees={employees} />
        </div>
      </div>}

      {activeTab === 'statutory' && <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Metric label="PAYE Payable" value={money(totals.paye)} icon={ShieldCheck} /><Metric label="Employee Pension" value={money(totals.pensionEmployee)} icon={Wallet} /><Metric label="Employer Pension" value={money(totals.pensionEmployer)} icon={Wallet} /><Metric label="NHF Payable" value={money(totals.nhf)} icon={ShieldCheck} /><div className="md:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 text-xs text-slate-600"><p className="font-bold text-slate-900 mb-2">Statutory payroll layer</p><p>The engine separates PAYE, employee pension, employer pension and NHF so the finance team can review statutory liabilities before payment and remittance. Rates should remain editable before production launch.</p></div></div>}

      {activeTab === 'payslips' && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 border-b"><h2 className="text-sm font-bold text-slate-900">Payslip Register</h2><p className="text-xs text-slate-500">Each generated payroll line becomes a payslip-ready payroll record when saved.</p></div><PayrollTable lines={lines} employees={employees} /></div>}
    </div>
  );
}

function PayrollTable({ lines, employees }: { lines: PayrollLine[]; employees: Employee[] }) {
  if (!lines.length) return <div className="p-8 text-center text-xs text-slate-400">No payroll run generated yet. Use Generate Payroll to calculate salaries, deductions and net pay.</div>;
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Employee</th><th className="text-right p-3">Gross</th><th className="text-right p-3">PAYE</th><th className="text-right p-3">Pension</th><th className="text-right p-3">NHF</th><th className="text-right p-3">Deductions</th><th className="text-right p-3">Net Pay</th></tr></thead><tbody className="divide-y divide-slate-100">{lines.map((line) => <tr key={line.employeeId} className="hover:bg-slate-50"><td className="p-3"><p className="font-bold text-slate-900">{line.employeeName}</p><p className="text-[10px] text-slate-400">{line.jobTitle} • {line.departmentId}</p></td><td className="p-3 text-right font-semibold">{money(line.grossPay)}</td><td className="p-3 text-right text-rose-600">{money(line.payeTax)}</td><td className="p-3 text-right text-rose-600">{money(line.employeePension)}</td><td className="p-3 text-right text-rose-600">{money(line.nhf)}</td><td className="p-3 text-right text-rose-600 font-semibold">{money(line.totalDeductions)}</td><td className="p-3 text-right text-emerald-600 font-black">{money(line.netPay)}</td></tr>)}</tbody></table></div>;
}

function Metric({ label, value, icon: Icon, dark = false }: { label: string; value: React.ReactNode; icon?: any; dark?: boolean }) {
  return <div className={`${dark ? 'bg-white/10 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} rounded-2xl border p-4 shadow-sm`}><div className="flex items-center justify-between gap-3"><div><p className={`text-[10px] uppercase tracking-wider font-black ${dark ? 'text-slate-300' : 'text-slate-400'}`}>{label}</p><p className="text-lg font-black mt-1 break-words">{value}</p></div>{Icon && <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span>}</div></div>;
}
