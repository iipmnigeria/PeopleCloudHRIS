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
  Download
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
  const [activeTab, setActiveTab] = useState<'my-payslips' | 'finance-payroll'>('my-payslips');
  
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
      </div>

      {/* 3. CORE DISPLAY MATRIX */}
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

            {/* Print trigger footer action */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
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
