import React, { useState, useEffect } from 'react';
import { UserRole, Employee, PayrollRecord } from '../types';
import { 
  DollarSign, 
  Check, 
  FileText, 
  TrendingUp, 
  CreditCard, 
  Printer, 
  ChevronRight, 
  Building2, 
  BadgePercent,
  Download,
  Calendar,
  Calculator,
  AlertCircle,
  Trash2,
  Sliders,
  Plus
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface PayrollSupportProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function PayrollSupport({ currentUser, selectedTenantId }: PayrollSupportProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isFinance = ['CompanyAdmin', 'HRManager', 'FinanceOfficer'].includes(currentUser.role);
  const isEmployeeOnly = currentUser.role === 'Employee';

  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'my-payslips' | 'finance-payroll' | 'payroll-calendar' | 'payroll-calculator'>('my-payslips');

  // Calendar Reminders State (Durable corporate calendar with database syncing)
  const [reminders, setReminders] = useState<{ id: string; day: number; title: string; category: string; description: string; status: 'Pending' | 'Completed' }[]>([
    { id: '1', day: 10, title: 'PAYE State Tax Return Filing', category: 'Tax', description: 'Submission of monthly withheld income tax to revenue authority.', status: 'Completed' },
    { id: '2', day: 15, title: 'Pension Authority Remittance', category: 'Tax', description: 'Contribution uploads for all qualifying permanent employees.', status: 'Pending' },
    { id: '3', day: 24, title: 'Timesheets & Attendance Freeze', category: 'Audit', description: 'Cut-off for all attendance logs and outstanding leave approvals.', status: 'Pending' },
    { id: '4', day: 25, title: 'Direct Deposit Authorization', category: 'Disbursement', description: 'Execute final bank routing dispatch and fund transfers.', status: 'Pending' },
    { id: '5', day: 28, title: 'Staff Salary & Payslip Disbursement', category: 'Disbursement', description: 'Official compensation statement release and bank credits.', status: 'Pending' },
  ]);
  const [newRemDay, setNewRemDay] = useState(1);
  const [newRemTitle, setNewRemTitle] = useState('');
  const [newRemCat, setNewRemCat] = useState('Other');
  const [newRemDesc, setNewRemDesc] = useState('');

  // Interactive Calculator States
  const [calcBaseSalary, setCalcBaseSalary] = useState(5000);
  const [calcOvertime, setCalcOvertime] = useState(10);
  const [calcOvertimeRate, setCalcOvertimeRate] = useState(35);
  const [calcBonus, setCalcBonus] = useState(500);
  const [calcAllowance, setCalcAllowance] = useState(450);
  const [calcTaxRate, setCalcTaxRate] = useState(12);
  const [calcPensionRate, setCalcPensionRate] = useState(5);
  const [calcOtherDeduction, setCalcOtherDeduction] = useState(100);

  // Load custom corporate calendar reminders from database
  useEffect(() => {
    async function loadReminders() {
      if (!companyId) return;
      try {
        const snap = await getDocs(collection(db, `companies/${companyId}/payroll_reminders`));
        const list: any[] = [];
        snap.forEach(d => list.push({ ...d.data(), id: d.id }));
        if (list.length > 0) {
          setReminders(prev => {
            const defaultIds = new Set(prev.map(p => p.id));
            const custom = list.filter(l => !defaultIds.has(l.id));
            return [...prev, ...custom];
          });
        }
      } catch (err) {
        console.error("Error loading payroll reminders:", err);
      }
    }
    loadReminders();
  }, [companyId]);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemTitle || !companyId) return;
    const newRem = {
      id: `rem-${Date.now()}`,
      day: Number(newRemDay),
      title: newRemTitle,
      category: newRemCat,
      description: newRemDesc,
      status: 'Pending' as const
    };
    try {
      await setDoc(doc(db, `companies/${companyId}/payroll_reminders`, newRem.id), newRem);
      setReminders(prev => [...prev, newRem]);
      setNewRemTitle('');
      setNewRemDesc('');
    } catch (err) {
      console.error("Error saving reminder:", err);
    }
  };

  const handleToggleReminderStatus = async (remId: string, currentStatus: 'Pending' | 'Completed') => {
    if (!companyId) return;
    const nextStatus = currentStatus === 'Pending' ? 'Completed' : 'Pending';
    try {
      await updateDoc(doc(db, `companies/${companyId}/payroll_reminders`, remId), { status: nextStatus });
    } catch (err) {
      // It might be a default seed card that isn't written to firebase yet, handle locally:
      try {
        const remObj = reminders.find(r => r.id === remId);
        if (remObj) {
          await setDoc(doc(db, `companies/${companyId}/payroll_reminders`, remId), { ...remObj, status: nextStatus });
        }
      } catch (innerErr) {
        console.error("Error setting custom status:", innerErr);
      }
    }
    setReminders(prev => prev.map(r => r.id === remId ? { ...r, status: nextStatus } : r));
  };
  
  // Selected Payslip for popup/modal receipt
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  // New Payroll Generation Form State
  const [payPeriod, setPayPeriod] = useState('2026-06 (June)');
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState('');

  // Fetch records
  useEffect(() => {
    async function loadPayrollData() {
      if (!companyId) return;
      try {
        // Fetch Employees
        const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const empList: Employee[] = [];
        empSnap.forEach(d => empList.push({ ...d.data() as Employee, employeeId: d.id }));
        setEmployees(empList);

        // Fetch Payroll Runs
        const paySnap = await getDocs(collection(db, `companies/${companyId}/payroll`));
        const payList: PayrollRecord[] = [];
        paySnap.forEach(d => {
          const data = d.data();
          payList.push({
            ...data,
            payrollRecordId: d.id,
            payrollId: data.payrollId || d.id,
            companyId: data.companyId || companyId,
            period: data.period || data.payPeriod || '',
            totalGross: data.totalGross || 0,
            totalDeductions: data.totalDeductions || 0,
            totalNet: data.totalNet || 0,
            status: data.status || data.paymentStatus || 'Paid',
            createdAt: data.createdAt || new Date().toISOString()
          } as PayrollRecord);
        });
        
        // Sort by period descending
        payList.sort((a, b) => (b.payPeriod || '').localeCompare(a.payPeriod || ''));
        setPayrollHistory(payList);

        // Default tabs based on role permissions
        if (isFinance && !isEmployeeOnly) {
          setActiveTab('finance-payroll');
        } else {
          setActiveTab('my-payslips');
        }
      } catch (err) {
        console.error('Error loading payroll database:', err);
      }
    }
    loadPayrollData();
  }, [companyId, isFinance, isEmployeeOnly]);

  // Download payslip as high-fidelity offline HTML
  const handleDownloadHtmlPayslip = () => {
    if (!selectedPayslip) return;
    const name = getStaffName(selectedPayslip.employeeId);
    const bank = getStaffBank(selectedPayslip.employeeId);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payslip - ${name} - ${selectedPayslip.payPeriod}</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #f8fafc; padding: 40px; color: #1e293b; }
          .card { max-width: 600px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
          .box { background: #f8fafc; border: 1px solid #f1f5f9; padding: 16px; border-radius: 12px; }
          .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
          .value { font-weight: bold; font-size: 14px; color: #0f172a; }
          .breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px; }
          .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
          .item { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; }
          .deduct { color: #be123c; }
          .total { display: flex; justify-content: space-between; align-items: center; background: #ecfdf5; border: 1px solid #d1fae5; padding: 16px; border-radius: 12px; }
          .net { font-size: 24px; font-weight: bold; color: #059669; }
          .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 32px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div>
              <h2 style="margin:0; font-size: 20px; font-weight: 800;">PeopleCloud HRIS</h2>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Official Corporate Compensation Statement</p>
            </div>
            <div style="text-align: right;">
              <span style="font-weight: bold; font-size: 14px;">${selectedPayslip.payPeriod}</span>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Issued: ${selectedPayslip.processedDate}</p>
            </div>
          </div>
          <div class="grid">
            <div class="box">
              <div class="label">Recipient Employee</div>
              <div class="value">${name}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">ID: ${selectedPayslip.employeeId}</div>
            </div>
            <div class="box">
              <div class="label">Disbursement Target</div>
              <div class="value">${bank}</div>
              <div style="font-size: 11px; color: #059669; font-weight: bold; margin-top: 4px;">● Direct Bank Deposit Completed</div>
            </div>
          </div>
          <div class="breakdown">
            <div>
              <div class="section-title">Earnings Breakdown</div>
              <div class="item"><span>Base monthly salary</span><span>${formatCurrency(selectedPayslip.baseSalary)}</span></div>
              <div class="item"><span>Housing Allowance</span><span>${formatCurrency(selectedPayslip.allowances * 0.6)}</span></div>
              <div class="item"><span>Travel Allowance</span><span>${formatCurrency(selectedPayslip.allowances * 0.4)}</span></div>
            </div>
            <div>
              <div class="section-title">Deductions Breakdown</div>
              <div class="item deduct"><span>PAYE Income Tax withheld</span><span>-${formatCurrency(selectedPayslip.taxWithheld)}</span></div>
              <div class="item deduct"><span>National Pension Fund (5%)</span><span>-${formatCurrency(selectedPayslip.deductions - selectedPayslip.taxWithheld)}</span></div>
            </div>
          </div>
          <div class="total">
            <div>
              <div class="label">Net Disbursed Take-Home</div>
              <span style="font-size: 11px; color: #64748b;">Authorized compensation rate</span>
            </div>
            <div class="net">${formatCurrency(selectedPayslip.netSalary)}</div>
          </div>
          <div class="footer">
            <p>This document is digitally rendered and represents a legal compensation statement. Verified Ledger ID: #${selectedPayslip.payrollRecordId}.</p>
            <p>© 2026 PeopleCloud HRIS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payslip-${name.replace(/\s+/g, '_')}-${selectedPayslip.payPeriod.replace(/\s+/g, '_')}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Tax math calculation formulas
  const calculatePayrollMath = (base: number) => {
    const housingAllowance = 300;
    const transportAllowance = 150;
    const grossSalary = base + housingAllowance + transportAllowance;
    
    // 5% pension fund
    const pensionContribution = Math.round(grossSalary * 0.05);
    // 12% income tax rate
    const taxDeduction = Math.round((grossSalary - pensionContribution) * 0.12);
    
    const totalDeductions = pensionContribution + taxDeduction;
    const netPay = grossSalary - totalDeductions;

    return {
      housingAllowance,
      transportAllowance,
      grossSalary,
      pensionContribution,
      taxDeduction,
      totalDeductions,
      netPay
    };
  };

  // Run and commit Monthly Payroll processing
  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || employees.length === 0) return;
    setGenerationLoading(true);
    setGenerationSuccess('');

    try {
      const addedRecords: PayrollRecord[] = [];

      for (const emp of employees) {
        if (emp.status === 'Terminated' || emp.status === 'Suspended') continue;

        const math = calculatePayrollMath(emp.baseSalary);
        const recordId = `pay-${emp.employeeId}-${payPeriod.replace(/[^a-zA-Z0-9]/g, '')}`;

        const newPayrollRun: PayrollRecord = {
          payrollId: recordId,
          payrollRecordId: recordId,
          companyId,
          employeeId: emp.employeeId,
          payPeriod,
          period: payPeriod,
          baseSalary: emp.baseSalary,
          allowances: math.housingAllowance + math.transportAllowance,
          deductions: math.totalDeductions,
          taxWithheld: math.taxDeduction,
          netSalary: math.netPay,
          paymentStatus: 'Paid',
          paymentMethod: 'Bank_Transfer',
          processedDate: new Date().toISOString().split('T')[0],
          totalGross: math.grossSalary,
          totalDeductions: math.totalDeductions,
          totalNet: math.netPay,
          status: 'Paid',
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, `companies/${companyId}/payroll`, recordId), newPayrollRun);
        addedRecords.push(newPayrollRun);
      }

      setPayrollHistory([...addedRecords, ...payrollHistory]);
      setGenerationSuccess(`Successfully generated and authorized payroll entries for ${addedRecords.length} staff!`);
    } catch (err) {
      console.error('Payroll generation error:', err);
    } finally {
      setGenerationLoading(false);
    }
  };

  const getStaffName = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? `${emp.firstName} ${emp.lastName}` : empId;
  };

  const getStaffBank = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? `${emp.bankName} Account ending in ...${emp.accountNumber?.slice(-4) || 'XXXX'}` : 'Direct Bank Deposit';
  };

  // Filters
  const myEmployee = employees.find(e => e.email === currentUser.email);
  const myPayslipList = payrollHistory.filter(p => p.employeeId === myEmployee?.employeeId);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="space-y-6 animate-slide-up" id="payroll-support-tab">
      
      {/* 1. HEADER ROW */}
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900">Payroll Support & Ledger</h2>
        <p className="text-xs text-slate-500">Review monthly payroll disbursements, print payslip reports, and authorize corporate bank routing.</p>
      </div>

      {/* 2. TAB CONTROLLERS */}
      <div className="border-b border-slate-200 flex space-x-4">
        {(!isFinance || isEmployeeOnly) && (
          <button
            onClick={() => setActiveTab('my-payslips')}
            className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === 'my-payslips' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            My Monthly Payslips
          </button>
        )}

        {isFinance && (
          <>
            <button
              onClick={() => setActiveTab('finance-payroll')}
              className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                activeTab === 'finance-payroll' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Corporate Payroll Office
            </button>
            <button
              onClick={() => setActiveTab('my-payslips')}
              className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                activeTab === 'my-payslips' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Staff Payslips Review
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('payroll-calendar')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center gap-1.5 ${
            activeTab === 'payroll-calendar' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Payroll Calendar
        </button>

        <button
          onClick={() => setActiveTab('payroll-calculator')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center gap-1.5 ${
            activeTab === 'payroll-calculator' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          Payroll Calculator
        </button>
      </div>

      {/* 3. CORE DISPLAY MATRIX */}
      {activeTab !== 'payroll-calendar' && activeTab !== 'payroll-calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Run Payroll Console (Finance Only) */}
          {activeTab === 'finance-payroll' && (
            <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit animate-fade-in">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-105 pb-2.5">
                <Building2 className="w-4 h-4 text-brand-600" />
                Authorize Monthly Payroll Run
              </h3>

              {generationSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-[11px] rounded-lg border border-emerald-100 animate-fade-in">
                  {generationSuccess}
                </div>
              )}

              <form onSubmit={handleProcessPayroll} className="space-y-4 text-xs text-slate-600">
                <div className="p-3 bg-brand-50 border border-brand-100/40 rounded-xl space-y-1.5 text-brand-800">
                  <span className="text-[10px] uppercase font-bold text-brand-700 block">SaaS Finance Audit</span>
                  <p className="text-[11px] leading-normal font-medium">
                    Executing this operation will compile salaries, calculate tax scales, apply default travel/housing stipends, and record ledger items.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Select Pay Period</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2"
                    value={payPeriod}
                    onChange={(e) => setPayPeriod(e.target.value)}
                  >
                    <option value="2026-06 (June)">2026-06 (June)</option>
                    <option value="2026-07 (July)">2026-07 (July)</option>
                    <option value="2026-08 (August)">2026-08 (August)</option>
                    <option value="2026-09 (September)">2026-09 (September)</option>
                  </select>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex justify-between text-slate-500">
                    <span>Target Headcount:</span>
                    <span className="font-bold text-slate-900">{employees.length} Staff</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Gross Salaries Projected:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatCurrency(employees.reduce((acc, curr) => acc + curr.baseSalary, 0))}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generationLoading || employees.length === 0}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Process and Deposit Funds</span>
                </button>
              </form>
            </div>
          )}

          {/* RIGHT COLUMN: Table logs */}
          <div className={`lg:col-span-2 ${activeTab === 'finance-payroll' ? '' : 'lg:col-span-3'}`}>
            
            {/* PAYSLIPS DIRECTORY */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">
                  {isFinance && activeTab === 'finance-payroll' ? 'Global Payroll Ledgers' : 'My Payslip Records'}
                </h4>
                <CreditCard className="w-4 h-4 text-slate-400" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-150">
                      <th className="px-5 py-3">Payee / Staff</th>
                      <th className="px-5 py-3">Pay Period</th>
                      <th className="px-5 py-3">Gross Salary</th>
                      <th className="px-5 py-3">Deductions (Tax/Pens)</th>
                      <th className="px-5 py-3">Net pay scale</th>
                      <th className="px-5 py-3 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {(isFinance && activeTab === 'finance-payroll' ? payrollHistory : myPayslipList).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                          No processed payroll receipts found for this selection.
                        </td>
                      </tr>
                    ) : (
                      (isFinance && activeTab === 'finance-payroll' ? payrollHistory : myPayslipList).map((rec) => (
                        <tr key={rec.payrollRecordId} className="hover:bg-slate-50/20">
                          <td className="px-5 py-3.5">
                            <span className="font-bold text-slate-900 block">{getStaffName(rec.employeeId)}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs">{getStaffBank(rec.employeeId)}</span>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-700">{rec.payPeriod}</td>
                          <td className="px-5 py-3.5 font-mono text-slate-600">
                            {formatCurrency(rec.baseSalary + rec.allowances)}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-rose-600">
                            -{formatCurrency(rec.deductions)}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-emerald-600 bg-emerald-50/15">
                            {formatCurrency(rec.netSalary)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedPayslip(rec)}
                              className="px-2.5 py-1.5 border border-slate-200 hover:border-brand-200 text-slate-700 hover:text-brand-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Generate Payslip
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* NEW SECTION: PAYROLL CALENDAR */}
      {activeTab === 'payroll-calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="payroll-calendar-view">
          
          {/* Calendar Grid Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-sm">SaaS Corporate Payroll Calendar</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Monthly recurrent milestones, filings, and cut-off benchmarks</p>
                </div>
                <span className="px-2.5 py-1 bg-brand-50 border border-brand-100 text-brand-700 rounded-lg text-xs font-bold font-mono">
                  October 2026
                </span>
              </div>

              {/* 31-Day Calendar Grid */}
              <div className="grid grid-cols-7 gap-2.5 text-center">
                {/* Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d} className="text-[10px] uppercase font-bold text-slate-400 py-1">{d}</span>
                ))}

                {/* Blank slots to offset October 1st, 2026 (Starts on a Thursday -> 4 blank slots) */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`blank-${i}`} className="aspect-square bg-slate-50/40 rounded-lg"></div>
                ))}

                {/* Days 1 to 31 */}
                {Array.from({ length: 31 }).map((_, i) => {
                  const dayNum = i + 1;
                  const matchingEvents = reminders.filter(r => r.day === dayNum);
                  const isToday = dayNum === new Date().getDate();

                  let cellBg = "bg-white hover:bg-slate-50 border border-slate-150";
                  let textCol = "text-slate-800 font-medium";

                  if (matchingEvents.length > 0) {
                    const status = matchingEvents[0].status;
                    if (status === 'Completed') {
                      cellBg = "bg-emerald-50 border border-emerald-200 shadow-sm shadow-emerald-100/50";
                      textCol = "text-emerald-800 font-bold";
                    } else {
                      cellBg = "bg-amber-50 border border-amber-200 shadow-sm shadow-amber-100/50";
                      textCol = "text-amber-800 font-bold";
                    }
                  } else if (isToday) {
                    cellBg = "bg-brand-50 border border-brand-300";
                    textCol = "text-brand-800 font-bold";
                  }

                  return (
                    <div 
                      key={`day-${dayNum}`} 
                      className={`aspect-square p-1.5 rounded-xl flex flex-col justify-between items-center relative transition-all cursor-pointer ${cellBg}`}
                    >
                      <span className={`text-xs ${textCol}`}>{dayNum}</span>
                      {matchingEvents.length > 0 && (
                        <span className={`w-2 h-2 rounded-full block animate-pulse ${
                          matchingEvents[0].status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Info legends */}
              <div className="flex flex-wrap justify-center gap-4 text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 block"></span>
                  Completed Landmark
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500 block animate-pulse"></span>
                  Pending Milestones
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded border border-brand-300 bg-brand-50 block"></span>
                  Active System Date
                </span>
              </div>
            </div>

            {/* Admin Add Landmark Form */}
            {isFinance && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Plus className="w-4 h-4 text-brand-600" />
                  Schedule Corporate Payroll Landmark
                </h4>
                <form onSubmit={handleAddReminder} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Target Calendar Day</label>
                    <input 
                      type="number" 
                      min={1} 
                      max={31} 
                      required
                      value={newRemDay}
                      onChange={(e) => setNewRemDay(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1" 
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Compliance Domain</label>
                    <select 
                      value={newRemCat} 
                      onChange={(e) => setNewRemCat(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1"
                    >
                      <option value="Tax">Tax Compliance</option>
                      <option value="Pension">Pension Board</option>
                      <option value="Audit">Internal Audit</option>
                      <option value="Disbursement">Direct Funds Release</option>
                      <option value="Other">Custom Landmark</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Operation Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Audit cut-off"
                      value={newRemTitle}
                      onChange={(e) => setNewRemTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none" 
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Task Description / Legal Mandate</label>
                    <input 
                      type="text" 
                      placeholder="Brief guidelines or state agency requirements..." 
                      value={newRemDesc}
                      onChange={(e) => setNewRemDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1" 
                    />
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      Add to Active Schedule
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Timeline list side panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-sm flex items-center justify-between">
                <span>Timeline Schedule</span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] text-slate-500 font-mono rounded font-bold">
                  {reminders.length} Active
                </span>
              </h4>

              <div className="space-y-3.5">
                {reminders.sort((a,b) => a.day - b.day).map((rem) => (
                  <div key={rem.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs space-y-1.5 relative">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Day {rem.day} of Month</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        rem.category === 'Tax' ? 'bg-amber-100 text-amber-800' :
                        rem.category === 'Pension' ? 'bg-indigo-100 text-indigo-800' :
                        rem.category === 'Audit' ? 'bg-purple-100 text-purple-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {rem.category}
                      </span>
                    </div>
                    <span className="font-semibold text-slate-800 block text-[11px]">{rem.title}</span>
                    <p className="text-[10px] text-slate-500 leading-relaxed italic">"{rem.description}"</p>
                    
                    <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 mt-2">
                      <span className="text-[9px] text-slate-400 font-medium">Compliance tracker</span>
                      <button 
                        onClick={() => handleToggleReminderStatus(rem.id, rem.status)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 cursor-pointer transition-colors ${
                          rem.status === 'Completed' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {rem.status === 'Completed' ? '✓ Completed' : '⌛ Pending'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* NEW SECTION: PAYROLL CALCULATOR */}
      {activeTab === 'payroll-calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="payroll-calculator-view">
          
          {/* Controls Panel */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Sliders className="w-4 h-4 text-brand-600" />
              Paycheck Parameters Sandbox
            </h3>

            <div className="space-y-4 text-xs text-slate-600">
              {/* Base Salary */}
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <label>Base Monthly Salary</label>
                  <span>{formatCurrency(calcBaseSalary)}</span>
                </div>
                <input 
                  type="range" 
                  min={500} 
                  max={25000} 
                  step={100}
                  value={calcBaseSalary}
                  onChange={(e) => setCalcBaseSalary(Number(e.target.value))}
                  className="w-full accent-brand-600 h-1 bg-slate-150 rounded-lg appearance-none" 
                />
              </div>

              {/* Overtime Hours */}
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <label>Overtime Active Hours</label>
                  <span>{calcOvertime} hrs</span>
                </div>
                <input 
                  type="range" 
                  min={0} 
                  max={80} 
                  step={1}
                  value={calcOvertime}
                  onChange={(e) => setCalcOvertime(Number(e.target.value))}
                  className="w-full accent-brand-600 h-1 bg-slate-150 rounded-lg appearance-none" 
                />
              </div>

              {/* Overtime Hourly Rate */}
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Overtime Rate ($/hour)</label>
                <input 
                  type="number" 
                  min={10} 
                  max={200}
                  value={calcOvertimeRate}
                  onChange={(e) => setCalcOvertimeRate(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:outline-none focus:ring-brand-500" 
                />
              </div>

              {/* Bonus */}
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Performance Incentive / Bonus</label>
                <input 
                  type="number" 
                  min={0}
                  value={calcBonus}
                  onChange={(e) => setCalcBonus(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:outline-none focus:ring-brand-500" 
                />
              </div>

              {/* Allowance */}
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Tax-Exempt Allowances (Housing/Travel)</label>
                <input 
                  type="number" 
                  min={0}
                  value={calcAllowance}
                  onChange={(e) => setCalcAllowance(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:outline-none focus:ring-brand-500" 
                />
              </div>

              {/* Progressive Tax Rate */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <div className="flex justify-between font-bold text-slate-900">
                  <label>Income Tax Bracket</label>
                  <span>{calcTaxRate}%</span>
                </div>
                <input 
                  type="range" 
                  min={0} 
                  max={45} 
                  step={0.5}
                  value={calcTaxRate}
                  onChange={(e) => setCalcTaxRate(Number(e.target.value))}
                  className="w-full accent-rose-500 h-1 bg-slate-150 rounded-lg appearance-none" 
                />
              </div>

              {/* Pension Contribution */}
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <label>Pension Fund Contribution</label>
                  <span>{calcPensionRate}%</span>
                </div>
                <input 
                  type="range" 
                  min={0} 
                  max={20} 
                  step={0.5}
                  value={calcPensionRate}
                  onChange={(e) => setCalcPensionRate(Number(e.target.value))}
                  className="w-full accent-rose-500 h-1 bg-slate-150 rounded-lg appearance-none" 
                />
              </div>

              {/* Other Deductions */}
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Insurance / Other Deductions</label>
                <input 
                  type="number" 
                  min={0}
                  value={calcOtherDeduction}
                  onChange={(e) => setCalcOtherDeduction(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:outline-none focus:ring-brand-500" 
                />
              </div>
            </div>
          </div>

          {/* Results Sheet Mock Ledger Card */}
          <div className="lg:col-span-2 space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-sm">Simulated Paycheck Statements</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Real-time calculations based on active legal withholding rules</p>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[10px] rounded">
                  Live Calculator
                </span>
              </div>

              {/* Split layout inside simulation sheet */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-slate-600">
                
                {/* Earnings List */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-950 uppercase text-[10px] border-b border-slate-100 pb-1.5 flex justify-between">
                    <span>Simulated Earnings</span>
                    <span>Subtotal</span>
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Base Salary Contract:</span>
                      <span className="font-mono font-semibold text-slate-800">{formatCurrency(calcBaseSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Overtime hours worked ({calcOvertime} hrs):</span>
                      <span className="font-mono font-semibold text-slate-800">{formatCurrency(calcOvertime * calcOvertimeRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Incentive Bonuses:</span>
                      <span className="font-mono font-semibold text-slate-800">{formatCurrency(calcBonus)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monthly Allowances:</span>
                      <span className="font-mono font-semibold text-slate-800">{formatCurrency(calcAllowance)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900 text-[11px]">
                      <span>Gross Salaries Projected:</span>
                      <span className="font-mono">{formatCurrency(calcBaseSalary + (calcOvertime * calcOvertimeRate) + calcBonus + calcAllowance)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions List */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-950 uppercase text-[10px] border-b border-slate-100 pb-1.5 flex justify-between">
                    <span>Estimated Deductions</span>
                    <span>Withheld</span>
                  </h4>
                  <div className="space-y-2 text-rose-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Progressive Income Tax ({calcTaxRate}%):</span>
                      <span className="font-mono font-semibold">-{formatCurrency((calcBaseSalary + (calcOvertime * calcOvertimeRate) + calcBonus) * (calcTaxRate / 100))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pension board contribution ({calcPensionRate}%):</span>
                      <span className="font-mono font-semibold">-{formatCurrency((calcBaseSalary + (calcOvertime * calcOvertimeRate) + calcBonus) * (calcPensionRate / 100))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Other direct deductions:</span>
                      <span className="font-mono font-semibold">-{formatCurrency(calcOtherDeduction)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-rose-800 text-[11px]">
                      <span>Total Withheld Deductions:</span>
                      <span className="font-mono">
                        -{formatCurrency(
                          ((calcBaseSalary + (calcOvertime * calcOvertimeRate) + calcBonus) * (calcTaxRate / 100)) + 
                          ((calcBaseSalary + (calcOvertime * calcOvertimeRate) + calcBonus) * (calcPensionRate / 100)) + 
                          calcOtherDeduction
                        )}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Large consolidated cash display */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Est. Net Take-Home Bank Deposit</span>
                  <p className="text-[11px] text-slate-500 leading-normal font-medium">
                    This amount represents the final credit disbursed into physical employee bank routing coordinates.
                  </p>
                </div>
                <div className="text-center sm:text-right shrink-0">
                  <span className="text-2xl font-mono font-bold text-emerald-700 block">
                    {formatCurrency(
                      (calcBaseSalary + (calcOvertime * calcOvertimeRate) + calcBonus + calcAllowance) - 
                      (
                        ((calcBaseSalary + (calcOvertime * calcOvertimeRate) + calcBonus) * (calcTaxRate / 100)) + 
                        ((calcBaseSalary + (calcOvertime * calcOvertimeRate) + calcBonus) * (calcPensionRate / 100)) + 
                        calcOtherDeduction
                      )
                    )}
                  </span>
                </div>
              </div>

              {/* Informative advice */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-[11px] text-slate-500 space-y-1.5 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4.5 h-4.5 text-slate-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Disclaimer Notice</strong>: This calculator provides interactive simulation estimates. Official monthly payouts may differ depending on variable state tax filings, prorated leave deductions, custom benefits, and authorized operational reimbursements. Keep pension ratios high for tax compliance.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 4. MODAL DETAILED PAYSLIP RECEIPT */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header control */}
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">Corporate Compensation Voucher</span>
              <button
                onClick={() => setSelectedPayslip(null)}
                className="text-slate-400 hover:text-white font-bold text-xs"
              >
                Close
              </button>
            </div>

            {/* Receipt layout container */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs" id="printable-payslip">
              
              {/* Branding and Pay period */}
              <div className="flex justify-between items-start border-b border-slate-150 pb-4">
                <div>
                  <h3 className="text-lg font-bold font-display text-slate-950">PeopleCloud HRIS</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Corporate Compensation ledger</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 block">{selectedPayslip.payPeriod}</span>
                  <span className="text-[10px] text-slate-400 block">Issued: {selectedPayslip.processedDate}</span>
                </div>
              </div>

              {/* Employee Particulars */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Recipient Payee</span>
                  <span className="font-bold text-slate-900 text-xs">{getStaffName(selectedPayslip.employeeId)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">ID: {selectedPayslip.employeeId}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Payment Destination</span>
                  <span className="font-medium text-slate-800 text-[11px] block">{getStaffBank(selectedPayslip.employeeId)}</span>
                  <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">● Direct Deposit Successful</span>
                </div>
              </div>

              {/* Earnings & Deductions Breakdowns */}
              <div className="grid grid-cols-2 gap-6 pt-2">
                
                {/* Earnings */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-950 uppercase text-[10px] border-b border-slate-100 pb-1 flex justify-between">
                    <span>Earnings</span>
                    <span>Amount</span>
                  </h4>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Basic monthly:</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.baseSalary)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Housing Allowance:</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.allowances * 0.6)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Travel Allowance:</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.allowances * 0.4)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-950 uppercase text-[10px] border-b border-slate-100 pb-1 flex justify-between">
                    <span>Deductions</span>
                    <span>Amount</span>
                  </h4>

                  <div className="space-y-1.5 text-rose-700">
                    <div className="flex justify-between">
                      <span>Income Tax withheld:</span>
                      <span className="font-mono">-{formatCurrency(selectedPayslip.taxWithheld)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pension Fund (5%):</span>
                      <span className="font-mono">-{formatCurrency(selectedPayslip.deductions - selectedPayslip.taxWithheld)}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Total Summary Block */}
              <div className="border-t border-slate-150 pt-4 flex justify-between items-center text-sm">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Consolidated Pay scale</span>
                  <span className="text-[9px] text-slate-400 block font-medium">Deposited net sum</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold font-mono text-emerald-600">
                    {formatCurrency(selectedPayslip.netSalary)}
                  </span>
                </div>
              </div>

              {/* Footer signatures */}
              <div className="pt-6 border-t border-slate-100 text-center space-y-1">
                <p className="text-[10px] text-slate-400 leading-normal">
                  This voucher is digitally compiled on security-verified cloud runners. System certificate reference: #{selectedPayslip.payrollRecordId}.
                </p>
                <p className="text-[9px] text-slate-400">Powered by PeopleCloud HRIS SaaS. All rights reserved.</p>
              </div>

            </div>

            {/* Print & Download triggers footer action */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
              <button
                onClick={handleDownloadHtmlPayslip}
                className="px-4 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download Statement</span>
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Statement</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
