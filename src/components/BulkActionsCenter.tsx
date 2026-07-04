import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckSquare, Download } from 'lucide-react';

type Props = { companyId: string | null; isOnline: boolean; onOfflineAction: (label: string) => void };

type Employee = { employeeId: string; firstName?: string; lastName?: string; displayName?: string; email?: string; jobTitle?: string; departmentId?: string; status?: string };

const demoEmployees: Employee[] = [
  { employeeId: 'ceo', firstName: 'Amina', lastName: 'Okafor', jobTitle: 'Chief Executive Officer', departmentId: 'Executive', status: 'Active' },
  { employeeId: 'hr', firstName: 'Tunde', lastName: 'Bello', jobTitle: 'HR Manager', departmentId: 'People Operations', status: 'Active' },
  { employeeId: 'finance', firstName: 'Chika', lastName: 'Nwosu', jobTitle: 'Finance Lead', departmentId: 'Finance', status: 'Active' },
  { employeeId: 'ops', firstName: 'Mary', lastName: 'Johnson', jobTitle: 'Operations Officer', departmentId: 'Operations', status: 'Onboarding' },
];

function nameOf(employee: Employee) { return employee.displayName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || employee.employeeId; }

export default function BulkActionsCenter({ companyId, isOnline, onOfflineAction }: Props) {
  const [employees, setEmployees] = useState<Employee[]>(demoEmployees);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!companyId) return;
      try {
        const snap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const rows: Employee[] = [];
        snap.forEach((item) => rows.push({ employeeId: item.id, ...(item.data() as Employee) }));
        if (rows.length) setEmployees(rows);
      } catch (error) {
        console.warn('Bulk actions using demo records:', error);
      }
    }
    load();
  }, [companyId]);

  const updateEmployees = async (field: 'departmentId' | 'status', value: string) => {
    if (!selected.length) { setMessage('Select at least one employee.'); return; }
    if (!isOnline) { onOfflineAction(`Bulk ${field} update for ${selected.length} employee(s)`); setMessage('Offline action queued locally.'); return; }
    try {
      if (companyId) await Promise.all(selected.map((id) => updateDoc(doc(db, `companies/${companyId}/employees`, id), { [field]: value })));
      setEmployees((rows) => rows.map((employee) => selected.includes(employee.employeeId) ? { ...employee, [field]: value } : employee));
      setMessage('Bulk action completed successfully.');
    } catch (error: any) {
      setMessage(`Bulk action failed: ${error.message || error}`);
    }
  };

  const exportCsv = () => {
    const rows = employees.filter((employee) => selected.includes(employee.employeeId));
    const csv = ['Name,Email,Job Title,Department,Status', ...rows.map((employee) => [nameOf(employee), employee.email || '', employee.jobTitle || '', employee.departmentId || '', employee.status || ''].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'peoplecloud-selected-employees.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100"><div className="flex items-center gap-2"><CheckSquare className="w-5 h-5 text-indigo-600" /><h2 className="text-lg font-bold text-slate-900">Bulk Actions Center</h2></div><p className="text-xs text-slate-500 mt-1">Select employees and run bulk HR operations.</p></div>
        <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
          {employees.map((employee) => <label key={employee.employeeId} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={selected.includes(employee.employeeId)} onChange={() => setSelected((items) => items.includes(employee.employeeId) ? items.filter((id) => id !== employee.employeeId) : [...items, employee.employeeId])} /><div className="flex-1"><p className="text-xs font-bold text-slate-900">{nameOf(employee)}</p><p className="text-[10px] text-slate-500">{employee.jobTitle || 'Employee'} • {employee.departmentId || 'No department'}</p></div><span className="text-[10px] bg-slate-100 rounded-full px-2 py-1 text-slate-600 font-bold">{employee.status || 'Unknown'}</span></label>)}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3"><p className="text-sm font-bold text-slate-900">{selected.length} selected</p>{message && <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">{message}</div>}<button onClick={() => updateEmployees('departmentId', 'People Operations')} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 py-2 text-xs font-bold">Move to People Ops</button><button onClick={() => updateEmployees('status', 'Active')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-xs font-bold">Mark Active</button><button onClick={() => updateEmployees('status', 'Suspended')} className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-2 text-xs font-bold">Suspend Selected</button><button onClick={exportCsv} className="w-full border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-center gap-2"><Download className="w-4 h-4" />Export CSV</button></div>
    </div>
  );
}
