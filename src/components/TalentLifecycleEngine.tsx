import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Award, Briefcase, CheckCircle2, ClipboardCheck, GitBranch, GraduationCap, Layers, Search, ShieldCheck, TrendingUp, UserCheck, Users } from 'lucide-react';

type UserSession = {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  companyId: string | null;
};

type Props = {
  currentUser: UserSession;
  selectedTenantId: string;
};

type EmployeeRow = {
  employeeId: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  jobTitle?: string;
  departmentId?: string;
  gradeLevel?: string;
  status?: string;
};

type TalentRecord = {
  id: string;
  employeeName: string;
  section: string;
  title: string;
  status: string;
  owner: string;
  dueDate: string;
};

const demoEmployees: EmployeeRow[] = [
  { employeeId: 'emp-001', firstName: 'Amina', lastName: 'Okafor', email: 'amina@demo.com', jobTitle: 'HR Business Partner', departmentId: 'People Operations', gradeLevel: 'Grade 7', status: 'Active' },
  { employeeId: 'emp-002', firstName: 'Tunde', lastName: 'Bello', email: 'tunde@demo.com', jobTitle: 'Operations Officer', departmentId: 'Operations', gradeLevel: 'Grade 5', status: 'Onboarding' },
  { employeeId: 'emp-003', firstName: 'Chika', lastName: 'Nwosu', email: 'chika@demo.com', jobTitle: 'Finance Lead', departmentId: 'Finance', gradeLevel: 'Grade 8', status: 'Active' },
];

const engineSections = [
  {
    id: 'foundation',
    title: 'Foundation Layer',
    subtitle: 'Talent profile, job architecture and competency foundation.',
    icon: Layers,
    items: ['Talent Profile', 'Job Family Architecture', 'Competency Framework', 'Skills Inventory', 'Role Requirements', 'Performance History']
  },
  {
    id: 'entry',
    title: 'Talent Entry',
    subtitle: 'Candidate conversion, onboarding and probation confirmation.',
    icon: UserCheck,
    items: ['Recruitment Pipeline', 'Candidate-to-Employee Conversion', 'Onboarding Checklist', 'Probation Objectives', 'Probation Confirmation']
  },
  {
    id: 'development',
    title: 'Career Pathing & Development',
    subtitle: 'Growth pathway, skill gaps and individual development plan.',
    icon: GraduationCap,
    items: ['Career Pathing', 'Skill Gap Analysis', 'Competency Gap Analysis', 'Individual Development Plan', 'Mentoring Plan']
  },
  {
    id: 'progression',
    title: 'Progression & Succession',
    subtitle: 'Promotion readiness, internal mobility and successor pipeline.',
    icon: TrendingUp,
    items: ['Promotion Readiness', 'Promotion Workflow', 'Transfer Workflow', 'Internal Mobility', 'Succession Planning', '9-Box Review']
  },
  {
    id: 'exit',
    title: 'Exit & Alumni Management',
    subtitle: 'Exit workflow, clearance, final settlement and alumni pool.',
    icon: Briefcase,
    items: ['Exit Management', 'Exit Interview', 'Clearance Checklist', 'Final Settlement Tracking', 'Alumni Talent Pool', 'Exit Analytics']
  }
];

function nameOf(employee: EmployeeRow) {
  return employee.displayName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || employee.employeeId;
}

export default function TalentLifecycleEngine({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const [activeSection, setActiveSection] = useState('foundation');
  const [employees, setEmployees] = useState<EmployeeRow[]>(demoEmployees);
  const [records, setRecords] = useState<TalentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [recordTitle, setRecordTitle] = useState('Probation confirmation review');
  const [recordStatus, setRecordStatus] = useState('Planned');
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');

  const activeMeta = engineSections.find((section) => section.id === activeSection) || engineSections[0];
  const selectedEmployee = employees.find((employee) => employee.employeeId === selectedEmployeeId) || employees[0];

  useEffect(() => {
    async function loadEngineData() {
      if (!companyId) return;
      try {
        const employeeSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const employeeRows: EmployeeRow[] = [];
        employeeSnap.forEach((item) => employeeRows.push({ employeeId: item.id, ...(item.data() as EmployeeRow) }));
        if (employeeRows.length) {
          setEmployees(employeeRows);
          setSelectedEmployeeId(employeeRows[0].employeeId);
        } else {
          setSelectedEmployeeId(demoEmployees[0].employeeId);
        }

        const recordSnap = await getDocs(collection(db, `companies/${companyId}/talent_lifecycle`));
        const recordRows: TalentRecord[] = [];
        recordSnap.forEach((item) => recordRows.push({ id: item.id, ...(item.data() as TalentRecord) }));
        setRecords(recordRows);
      } catch (error) {
        console.warn('Talent lifecycle engine is using demo data:', error);
        setSelectedEmployeeId(demoEmployees[0].employeeId);
      }
    }
    loadEngineData();
  }, [companyId]);

  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    const target = `${nameOf(employee)} ${employee.email || ''} ${employee.jobTitle || ''} ${employee.departmentId || ''}`.toLowerCase();
    return target.includes(search.toLowerCase());
  }), [employees, search]);

  const visibleRecords = records.filter((record) => record.section === activeSection);

  const createRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployee || !recordTitle.trim()) return;

    const newRecord: TalentRecord = {
      id: `talent-${Date.now()}`,
      employeeName: nameOf(selectedEmployee),
      section: activeSection,
      title: recordTitle.trim(),
      status: recordStatus,
      owner: currentUser.displayName,
      dueDate: dueDate || 'Not set',
    };

    try {
      if (companyId) {
        const saved = await addDoc(collection(db, `companies/${companyId}/talent_lifecycle`), {
          ...newRecord,
          employeeId: selectedEmployee.employeeId,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        newRecord.id = saved.id;
      }
      setRecords((items) => [newRecord, ...items]);
      setMessage('Talent lifecycle record created successfully.');
      setRecordTitle('');
    } catch (error: any) {
      setMessage(`Unable to save record: ${error.message || error}`);
    }
  };

  const readinessScore = Math.min(100, 35 + (records.length * 7));
  const activeTalentCount = employees.filter((employee) => employee.status !== 'Terminated').length;
  const exitRecordCount = records.filter((record) => record.section === 'exit').length;

  return (
    <div className="space-y-6" id="talent-lifecycle-engine">
      <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-indigo-200 font-black">PeopleCloud Talent Lifecycle Engine</p>
            <h1 className="text-2xl lg:text-3xl font-bold mt-2">From talent entry to career growth, progression, exit and alumni.</h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl">A complete talent management layer for talent profiles, job families, competencies, career pathing, readiness, succession, mobility and exit intelligence.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniMetric label="Talent" value={activeTalentCount} />
            <MiniMetric label="Readiness" value={`${readinessScore}%`} />
            <MiniMetric label="Exit Cases" value={exitRecordCount} />
          </div>
        </div>
      </div>

      {message && <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {engineSections.map((section) => <button key={section.id} onClick={() => setActiveSection(section.id)} className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${activeSection === section.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}><section.icon className="w-5 h-5 mb-3 text-indigo-400" /><p className="text-xs font-black">{section.title}</p><p className={`text-[10px] mt-1 ${activeSection === section.id ? 'text-slate-300' : 'text-slate-500'}`}>{section.subtitle}</p></button>)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div><h2 className="text-lg font-bold text-slate-900">{activeMeta.title}</h2><p className="text-xs text-slate-500 mt-1">{activeMeta.subtitle}</p></div>
              <ShieldCheck className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeMeta.items.map((item) => <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-900">{item}</p><p className="text-[10px] text-slate-500 mt-1">Configured as part of the {activeMeta.title.toLowerCase()} workflow.</p></div>)}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-900">Lifecycle Records</h3><p className="text-xs text-slate-500">Records created under the active lifecycle section.</p></div><ClipboardCheck className="w-5 h-5 text-indigo-500" /></div>
            <div className="divide-y divide-slate-100">
              {visibleRecords.length ? visibleRecords.map((record) => <div key={record.id} className="grid grid-cols-12 gap-3 px-5 py-4 text-xs"><span className="col-span-4 font-bold text-slate-900">{record.title}<br/><span className="text-[10px] font-normal text-slate-400">{record.employeeName}</span></span><span className="col-span-3 text-slate-600">{record.owner}</span><span className="col-span-3 text-slate-600">{record.dueDate}</span><span className="col-span-2"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold">{record.status}</span></span></div>) : <div className="p-8 text-center text-xs text-slate-400">No lifecycle records for this section yet. Create one from the action panel.</div>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-indigo-600" /><h3 className="text-sm font-bold text-slate-900">Talent Profiles</h3></div>
            <div className="relative mb-3"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs" /></div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {filteredEmployees.map((employee) => <button key={employee.employeeId} onClick={() => setSelectedEmployeeId(employee.employeeId)} className={`w-full text-left rounded-xl border p-3 cursor-pointer ${selectedEmployeeId === employee.employeeId ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><p className="text-xs font-bold text-slate-900">{nameOf(employee)}</p><p className="text-[10px] text-slate-500">{employee.jobTitle || 'No role'} • {employee.gradeLevel || 'No grade'}</p><p className="text-[9px] text-slate-400">{employee.departmentId || 'No department'} • {employee.status || 'Unknown'}</p></button>)}
            </div>
          </div>

          <form onSubmit={createRecord} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2"><Award className="w-5 h-5 text-indigo-600" /><h3 className="text-sm font-bold text-slate-900">Create Lifecycle Action</h3></div>
            <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Selected Employee</label><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white">{employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{nameOf(employee)}</option>)}</select></div>
            <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Action Title</label><input value={recordTitle} onChange={(e) => setRecordTitle(e.target.value)} required placeholder="e.g. Skill gap analysis for HRBP pathway" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Status</label><select value={recordStatus} onChange={(e) => setRecordStatus(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"><option>Planned</option><option>In Progress</option><option>Ready for Review</option><option>Approved</option><option>Completed</option></select></div><div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Due Date</label><input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div></div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer">Save Talent Lifecycle Record</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3"><p className="text-[9px] uppercase tracking-wider text-slate-300 font-black">{label}</p><p className="text-lg font-black text-white mt-1">{value}</p></div>;
}
