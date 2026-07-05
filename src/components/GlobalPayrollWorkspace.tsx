import React, { useState } from 'react';
import { Calculator, CalendarCheck2, FileText, ShieldCheck } from 'lucide-react';
import GlobalPayrollEngineIntegrated from './GlobalPayrollEngineIntegrated';
import PayrollApprovalWorkflow from './PayrollApprovalWorkflow';
import PayslipPortal from './PayslipPortal';
import PayrollAttendanceIntegration from './PayrollAttendanceIntegration';

export default function GlobalPayrollWorkspace(props: any) {
  const isEmployee = props?.currentUser?.role === 'Employee';
  const [tab, setTab] = useState<'engine' | 'approval' | 'payslips' | 'attendance'>(isEmployee ? 'payslips' : 'engine');

  if (isEmployee) return <PayslipPortal {...props} />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-2">
        <button onClick={() => setTab('engine')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${tab === 'engine' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Calculator className="w-4 h-4" />Payroll Engine</button>
        <button onClick={() => setTab('attendance')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${tab === 'attendance' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><CalendarCheck2 className="w-4 h-4" />Attendance/Leave Integration</button>
        <button onClick={() => setTab('approval')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${tab === 'approval' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><ShieldCheck className="w-4 h-4" />Approval Workflow</button>
        <button onClick={() => setTab('payslips')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${tab === 'payslips' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><FileText className="w-4 h-4" />Payslip Portal</button>
      </div>
      {tab === 'engine' && <GlobalPayrollEngineIntegrated {...props} />}
      {tab === 'attendance' && <PayrollAttendanceIntegration {...props} />}
      {tab === 'approval' && <PayrollApprovalWorkflow {...props} />}
      {tab === 'payslips' && <PayslipPortal {...props} />}
    </div>
  );
}
