import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { Building2, CheckCircle2, ListPlus, Plus, Search, Tags } from 'lucide-react';
import { db } from '../firebase';
import { Department, UserRole } from '../types';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }; selectedTenantId: string };
type Category = 'Job Title' | 'Job Role' | 'Grade Level' | 'Employment Type' | 'Work Location' | 'Unit' | 'Employment Status';
type Item = { id: string; category: Category; name: string; code?: string; status?: string };
const categories: Category[] = ['Job Title', 'Job Role', 'Grade Level', 'Employment Type', 'Work Location', 'Unit', 'Employment Status'];

export default function OrgCatalogManager({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canManage = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'HR Manager'].includes(String(currentUser.role));
  const [tab, setTab] = useState<'Departments' | Category>('Departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [queryText, setQueryText] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => { loadData(); }, [companyId]);

  async function loadData() {
    if (!companyId) return;
    try {
      const deptSnap = await getDocs(collection(db, `companies/${companyId}/departments`));
      setDepartments(deptSnap.docs.map((row) => ({ departmentId: row.id, ...(row.data() as Department) })));
      const catalogSnap = await getDocs(collection(db, `companies/${companyId}/org_catalog`));
      setItems(catalogSnap.docs.map((row) => ({ id: row.id, ...(row.data() as Item) })));
    } catch (error: any) { setMessage(`Unable to load catalog: ${error.message || error}`); }
  }

  function slug(value: string) { return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `item-${Date.now()}`; }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!companyId || !canManage || !name.trim()) return;
    if (tab === 'Departments') {
      const id = `dept-${slug(code || name)}`;
      const payload = { name: name.trim(), code, status: 'Active', companyId, createdBy: currentUser.uid, createdAt: serverTimestamp() };
      await setDoc(doc(db, `companies/${companyId}/departments`, id), payload, { merge: true });
      setDepartments((old) => [{ departmentId: id, ...(payload as any) }, ...old.filter((d) => d.departmentId !== id)]);
      setMessage('Department saved and is now available for employee records.');
    } else {
      const payload = { category: tab, name: name.trim(), code, status: 'Active', companyId, createdBy: currentUser.uid, createdAt: serverTimestamp() };
      const ref = await addDoc(collection(db, `companies/${companyId}/org_catalog`), payload);
      setItems((old) => [{ id: ref.id, ...(payload as any) }, ...old]);
      setMessage(`${tab} saved as a custom company option.`);
    }
    setName(''); setCode('');
  }

  const currentRows = tab === 'Departments'
    ? departments.map((d: any) => ({ id: d.departmentId, name: d.name, code: d.code, status: d.status || 'Active' }))
    : items.filter((i) => i.category === tab);
  const filtered = currentRows.filter((row) => `${row.name} ${row.code}`.toLowerCase().includes(queryText.toLowerCase()));

  return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5" id="org-catalog-manager"><div className="flex flex-col lg:flex-row justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Company Setup</p><h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><ListPlus className="w-5 h-5 text-indigo-600" />Organization Catalog Manager</h2><p className="text-xs text-slate-500 mt-1">HR Managers can add custom departments, titles, roles, grades, employment types, units and work locations.</p></div><div className="relative w-full lg:w-80"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Search catalog..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs" /></div></div>{message && <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}<div className="flex gap-2 overflow-x-auto pb-1"><Tab active={tab === 'Departments'} onClick={() => setTab('Departments')}>Departments</Tab>{categories.map((cat) => <Tab key={cat} active={tab === cat} onClick={() => setTab(cat)}>{cat}s</Tab>)}</div><div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><form onSubmit={save} className="rounded-2xl border border-slate-100 p-4 space-y-3 h-fit"><h3 className="text-sm font-black text-slate-900 flex items-center gap-2">{tab === 'Departments' ? <Building2 className="w-4 h-4 text-indigo-600" /> : <Tags className="w-4 h-4 text-indigo-600" />}Add {tab}</h3><Field label="Name" value={name} onChange={setName} /><Field label="Code / Short Name" value={code} onChange={setCode} /><button disabled={!canManage} className="w-full px-4 py-2 bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Save {tab}</button>{!canManage && <p className="text-[10px] text-amber-600">Only CompanyAdmin and HRManager can add custom options.</p>}</form><div className="xl:col-span-2 rounded-2xl border border-slate-100 overflow-hidden"><div className="bg-slate-50 p-3 text-[10px] uppercase tracking-wider text-slate-500 font-black">{tab} List</div><div className="divide-y divide-slate-100">{filtered.length === 0 ? <p className="p-4 text-xs text-slate-400">No catalog items yet.</p> : filtered.map((row) => <div key={row.id} className="p-4"><p className="text-sm font-black text-slate-900">{row.name}</p><p className="text-[10px] text-slate-500 mt-1">{row.code || 'No code'} • {row.status || 'Active'}</p></div>)}</div></div></div></div>;
}

function Tab({ active, onClick, children }: any) { return <button onClick={onClick} className={`px-3 py-2 rounded-xl text-[10px] font-black whitespace-nowrap ${active ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{children}</button>; }
function Field({ label, value, onChange }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><input value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field" /></label>; }
