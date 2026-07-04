import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Network, Search, Users, Building2 } from 'lucide-react';

type Props = { companyId: string | null };

type Employee = {
  employeeId: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  jobTitle?: string;
  departmentId?: string;
  departmentName?: string;
  managerId?: string;
  status?: string;
};

const demoEmployees: Employee[] = [
  { employeeId: 'ceo', firstName: 'Amina', lastName: 'Okafor', jobTitle: 'Chief Executive Officer', departmentId: 'Executive', status: 'Active' },
  { employeeId: 'hr', firstName: 'Tunde', lastName: 'Bello', jobTitle: 'HR Manager', departmentId: 'People Operations', managerId: 'ceo', status: 'Active' },
  { employeeId: 'finance', firstName: 'Chika', lastName: 'Nwosu', jobTitle: 'Finance Lead', departmentId: 'Finance', managerId: 'ceo', status: 'Active' },
  { employeeId: 'ops', firstName: 'Mary', lastName: 'Johnson', jobTitle: 'Operations Officer', departmentId: 'Operations', managerId: 'hr', status: 'Onboarding' },
];

function employeeName(employee: Employee) {
  return employee.displayName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || employee.employeeId;
}

export default function SmartOrgChart({ companyId }: Props) {
  const [employees, setEmployees] = useState<Employee[]>(demoEmployees);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadEmployees() {
      if (!companyId) return;
      try {
        const snap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const rows: Employee[] = [];
        snap.forEach((item) => rows.push({ employeeId: item.id, ...(item.data() as Employee) }));
        if (rows.length) setEmployees(rows);
      } catch (error) {
        console.warn('Smart org chart is using demo records:', error);
      }
    }
    loadEmployees();
  }, [companyId]);

  const groups = useMemo(() => employees.reduce<Record<string, Employee[]>>((acc, employee) => {
    const key = employee.departmentName || employee.departmentId || 'Unassigned';
    acc[key] = acc[key] || [];
    acc[key].push(employee);
    return acc;
  }, {}), [employees]);

  const filteredIds = employees
    .filter((employee) => `${employeeName(employee)} ${employee.email || ''} ${employee.jobTitle || ''} ${employee.departmentId || ''}`.toLowerCase().includes(search.toLowerCase()))
    .map((employee) => employee.employeeId);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat icon={Users} label="Employees mapped" value={employees.length} />
        <Stat icon={Building2} label="Departments" value={Object.keys(groups).length} />
        <Stat icon={Network} label="Reporting links" value={employees.filter((e) => e.managerId).length} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Smart Organization Chart</h2>
            <p className="text-xs text-slate-500 mt-1">Auto-groups employees by department and reporting lines where manager IDs exist.</p>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search org chart..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Object.entries(groups).map(([department, members]) => (
            <div key={department} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 capitalize">{department.replace(/-/g, ' ')}</h3>
                <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded-full font-bold">{members.length} people</span>
              </div>
              <div className="space-y-2">
                {members.filter((employee) => filteredIds.includes(employee.employeeId)).map((employee) => (
                  <div key={employee.employeeId} className="bg-white rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-bold text-slate-900">{employeeName(employee)}</p>
                    <p className="text-[10px] text-slate-500">{employee.jobTitle || 'Employee'} • {employee.status || 'Unknown'}</p>
                    {employee.managerId && <p className="text-[9px] text-indigo-500 mt-1 font-mono">Reports to: {employee.managerId}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{value}</p></div><span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span></div></div>;
}
