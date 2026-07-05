import React, { useState } from 'react';
import { CalendarClock, Landmark } from 'lucide-react';
import GlobalComplianceCenter from './GlobalComplianceCenter';
import PayrollComplianceAutomation from './PayrollComplianceAutomation';

export default function GlobalComplianceWorkspace(props: any) {
  const [tab, setTab] = useState<'center' | 'automation'>('center');
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-2">
        <button onClick={() => setTab('center')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${tab === 'center' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Landmark className="w-4 h-4" />Compliance Center</button>
        <button onClick={() => setTab('automation')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${tab === 'automation' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><CalendarClock className="w-4 h-4" />Due Date Automation</button>
      </div>
      {tab === 'center' && <GlobalComplianceCenter {...props} />}
      {tab === 'automation' && <PayrollComplianceAutomation {...props} />}
    </div>
  );
}
