import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { Award, BookOpen, CheckCircle2, Crown, Gift, LineChart, Loader2, Plus, Search, Sparkles, Target, TrendingUp } from 'lucide-react';
import { db } from '../firebase';
import { Employee, UserRole } from '../types';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type AnyRecord = { id: string; [key: string]: any };

export default function PerformanceManagementEngine({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canManage = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'HR Manager', 'LineManager'].includes(String(currentUser.role));
  const [tab, setTab] = useState<'kpi' | 'review' | 'actions'>('kpi');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kpis, setKpis] = useState<AnyRecord[]>([]);
  const [reviews, setReviews] = useState<AnyRecord[]>([]);
  const [actions, setActions] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const [kpiForm, setKpiForm] = useState({ title: '', employeeId: '', ownerLevel: 'Employee', measure: '', target: '', weight: '20', progress: '0', learningNeed: '', promotionImpact: 'Neutral', benefitImpact: 'Neutral', talentSignal: 'Core Performer' });
  const [reviewForm, setReviewForm] = useState({ employeeId: '', period: '2026 Annual Performance Review', rating: '3', score: '60', managerSummary: '', learningPlan: '', promotionRecommendation: 'Not Yet', benefitRecommendation: 'Standard Benefits', talentSegment: 'Core Talent', nextRoleReadiness: 'Developing' });
  const [actionForm, setActionForm] = useState({ type: 'L&D', title: '', employeeId: '', source: 'Performance Review', dueDate: '', status: 'Open', notes: '' });

  useEffect(() => { loadData(); }, [companyId]);

  async function loadData() {
    if (!companyId) return;
    setLoading(true);
    try {
      const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
      const empList = empSnap.docs.map((item) => ({ employeeId: item.id, ...(item.data() as Employee) }));
      setEmployees(empList);
      const first = empList[0]?.employeeId || '';
      if (first) {
        setKpiForm((old) => ({ ...old, employeeId: old.employeeId || first }));
        setReviewForm((old) => ({ ...old, employeeId: old.employeeId || first }));
        setActionForm((old) => ({ ...old, employeeId: old.employeeId || first }));
      }
      setKpis(await read(companyId, 'performance_kpis'));
      setReviews(await read(companyId, 'performance_reviews'));
      setActions(await read(companyId, 'performance_actions'));
    } catch (error: any) {
      setMessage(`Unable to load performance records: ${error.message || error}`);
    } finally { setLoading(false); }
  }

  async function read(cid: string, name: string) {
    const snap = await getDocs(collection(db, `companies/${cid}/${name}`));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  function empName(id: string) {
    const emp = employees.find((item) => item.employeeId === id);
    return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email : 'Unassigned';
  }

  const stats = useMemo(() => {
    const avgProgress = kpis.length ? Math.round(kpis.reduce((s, r) => s + Number(r.progress || 0), 0) / kpis.length) : 0;
    const avgScore = reviews.length ? Math.round(reviews.reduce((s, r) => s + Number(r.score || 0), 0) / reviews.length) : 0;
    return [
      ['KPIs', kpis.length, Target], ['KPI Progress', `${avgProgress}%`, TrendingUp], ['Review Score', `${avgScore}%`, Award],
      ['L&D Actions', actions.filter((r) => r.type === 'L&D').length, BookOpen], ['Promotion', actions.filter((r) => r.type === 'Promotion').length, Crown],
      ['Benefits', actions.filter((r) => r.type === 'Benefits').length, Gift], ['Talent', actions.filter((r) => r.type === 'Talent').length, Sparkles],
    ];
  }, [kpis, reviews, actions]);

  async function saveKpi(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !canManage || !kpiForm.title) return;
    const payload = { ...kpiForm, weight: Number(kpiForm.weight), progress: Number(kpiForm.progress), status: 'Active', createdBy: currentUser.uid, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, `companies/${companyId}/performance_kpis`), payload);
    setKpis([{ id: ref.id, ...payload }, ...kpis]);
    setMessage('KPI saved and linked to performance, L&D, promotion, benefits and talent signals.');
  }

  async function saveReview(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !canManage || !reviewForm.employeeId) return;
    const payload = { ...reviewForm, rating: Number(reviewForm.rating), score: Number(reviewForm.score), status: 'Manager Review', createdBy: currentUser.uid, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, `companies/${companyId}/performance_reviews`), payload);
    setReviews([{ id: ref.id, ...payload }, ...reviews]);
    setMessage('Performance review outcome saved with L&D, promotion, benefits and talent recommendations.');
  }

  async function saveAction(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !canManage || !actionForm.title) return;
    const payload = { ...actionForm, createdBy: currentUser.uid, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, `companies/${companyId}/performance_actions`), payload);
    setActions([{ id: ref.id, ...payload }, ...actions]);
    setMessage('Linked performance action created.');
  }

  const visibleKpis = kpis.filter((r) => `${r.title} ${empName(r.employeeId)}`.toLowerCase().includes(search.toLowerCase()));
  const visibleReviews = reviews.filter((r) => `${r.period} ${empName(r.employeeId)} ${r.talentSegment}`.toLowerCase().includes(search.toLowerCase()));
  const visibleActions = actions.filter((r) => `${r.title} ${r.type} ${empName(r.employeeId)}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /><span className="ml-3 text-xs text-slate-500 font-bold">Loading Performance Management Engine...</span></div>;

  return <div className="space-y-6" id="performance-management-engine"><div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800"><p className="text-[10px] uppercase tracking-[0.25em] text-indigo-300 font-black">PeopleCloudHRIS</p><h1 className="text-2xl font-black mt-2">Performance Management Engine</h1><p className="text-sm text-slate-300 mt-2 max-w-4xl">Set and track KPIs, run performance reviews, link L&D, recommend promotion, trigger benefits actions and feed talent management.</p></div>{message && <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{stats.map(([label, value, Icon]: any) => <div key={label} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"><Icon className="w-4 h-4 text-indigo-600" /><p className="text-xl font-black text-slate-900 mt-2">{value}</p><p className="text-[10px] uppercase font-black text-slate-400">{label}</p></div>)}</div><div className="flex flex-col md:flex-row justify-between gap-4"><div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm"><Tab active={tab === 'kpi'} onClick={() => setTab('kpi')}>KPI Tracking</Tab><Tab active={tab === 'review'} onClick={() => setTab('review')}>Reviews & Outcomes</Tab><Tab active={tab === 'actions'} onClick={() => setTab('actions')}>Linked Actions</Tab></div><div className="relative w-full md:w-80"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search performance records..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs" /></div></div>{tab === 'kpi' && <TwoColumn form={<KpiForm form={kpiForm} setForm={setKpiForm} employees={employees} save={saveKpi} canManage={canManage} />} list={<Records rows={visibleKpis} title={(r) => r.title} meta={(r) => `${empName(r.employeeId)} • ${r.progress}% • ${r.learningNeed || 'No L&D link'} • ${r.talentSignal}`} />} />}{tab === 'review' && <TwoColumn form={<ReviewForm form={reviewForm} setForm={setReviewForm} employees={employees} save={saveReview} canManage={canManage} />} list={<Records rows={visibleReviews} title={(r) => `${empName(r.employeeId)} — ${r.period}`} meta={(r) => `${r.score}% • ${r.promotionRecommendation} • ${r.benefitRecommendation} • ${r.talentSegment}`} />} />}{tab === 'actions' && <TwoColumn form={<ActionForm form={actionForm} setForm={setActionForm} employees={employees} save={saveAction} canManage={canManage} />} list={<Records rows={visibleActions} title={(r) => r.title} meta={(r) => `${r.type} • ${empName(r.employeeId)} • ${r.status} • Due ${r.dueDate || 'Not set'}`} />} />}</div>;
}

function KpiForm({ form, setForm, employees, save, canManage }: any) { return <Card title="Create KPI / Objective"><form onSubmit={save} className="space-y-3"><Field label="KPI Title" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} /><Select label="Owner Level" value={form.ownerLevel} onChange={(v: string) => setForm({ ...form, ownerLevel: v })} options={['Organisation', 'Department', 'Employee']} /><EmployeeSelect value={form.employeeId} onChange={(v: string) => setForm({ ...form, employeeId: v })} employees={employees} /><Field label="Measure" value={form.measure} onChange={(v: string) => setForm({ ...form, measure: v })} /><Field label="Target" value={form.target} onChange={(v: string) => setForm({ ...form, target: v })} /><Field label="Weight %" value={form.weight} onChange={(v: string) => setForm({ ...form, weight: v })} /><Field label="Progress %" value={form.progress} onChange={(v: string) => setForm({ ...form, progress: v })} /><Field label="Linked Learning Need" value={form.learningNeed} onChange={(v: string) => setForm({ ...form, learningNeed: v })} /><Select label="Promotion Impact" value={form.promotionImpact} onChange={(v: string) => setForm({ ...form, promotionImpact: v })} options={['Neutral', 'Supports Promotion', 'Requires Improvement']} /><Select label="Benefits Impact" value={form.benefitImpact} onChange={(v: string) => setForm({ ...form, benefitImpact: v })} options={['Neutral', 'Bonus Eligible', 'Recognition Eligible', 'Improvement Required']} /><Select label="Talent Signal" value={form.talentSignal} onChange={(v: string) => setForm({ ...form, talentSignal: v })} options={['High Potential', 'Core Performer', 'Critical Talent', 'Watchlist', 'Needs Support']} /><Button disabled={!canManage}>Create KPI</Button></form></Card>; }
function ReviewForm({ form, setForm, employees, save, canManage }: any) { return <Card title="Create Review Outcome"><form onSubmit={save} className="space-y-3"><EmployeeSelect value={form.employeeId} onChange={(v: string) => setForm({ ...form, employeeId: v })} employees={employees} /><Field label="Period" value={form.period} onChange={(v: string) => setForm({ ...form, period: v })} /><Field label="Rating 1-5" value={form.rating} onChange={(v: string) => setForm({ ...form, rating: v })} /><Field label="Score %" value={form.score} onChange={(v: string) => setForm({ ...form, score: v })} /><Area label="Manager Summary" value={form.managerSummary} onChange={(v: string) => setForm({ ...form, managerSummary: v })} /><Area label="L&D Plan" value={form.learningPlan} onChange={(v: string) => setForm({ ...form, learningPlan: v })} /><Select label="Promotion Recommendation" value={form.promotionRecommendation} onChange={(v: string) => setForm({ ...form, promotionRecommendation: v })} options={['Not Yet', 'Ready for Promotion', 'Future Candidate', 'Role Change Recommended']} /><Select label="Benefits Recommendation" value={form.benefitRecommendation} onChange={(v: string) => setForm({ ...form, benefitRecommendation: v })} options={['Standard Benefits', 'Bonus Eligible', 'Recognition Award', 'Retention Package Review']} /><Select label="Talent Segment" value={form.talentSegment} onChange={(v: string) => setForm({ ...form, talentSegment: v })} options={['High Potential', 'Core Talent', 'Critical Talent', 'Needs Support', 'Succession Candidate']} /><Select label="Next Role Readiness" value={form.nextRoleReadiness} onChange={(v: string) => setForm({ ...form, nextRoleReadiness: v })} options={['Developing', 'Ready Now', 'Ready in 6-12 Months', 'Ready in 1-2 Years']} /><Button disabled={!canManage}>Save Review Outcome</Button></form></Card>; }
function ActionForm({ form, setForm, employees, save, canManage }: any) { return <Card title="Create Linked Action"><form onSubmit={save} className="space-y-3"><Select label="Action Type" value={form.type} onChange={(v: string) => setForm({ ...form, type: v })} options={['L&D', 'Promotion', 'Benefits', 'Talent']} /><Field label="Action Title" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} /><EmployeeSelect value={form.employeeId} onChange={(v: string) => setForm({ ...form, employeeId: v })} employees={employees} /><Field label="Source" value={form.source} onChange={(v: string) => setForm({ ...form, source: v })} /><Field label="Due Date" type="date" value={form.dueDate} onChange={(v: string) => setForm({ ...form, dueDate: v })} /><Select label="Status" value={form.status} onChange={(v: string) => setForm({ ...form, status: v })} options={['Open', 'In Progress', 'Completed']} /><Area label="Notes" value={form.notes} onChange={(v: string) => setForm({ ...form, notes: v })} /><Button disabled={!canManage}>Create Action</Button></form></Card>; }
function TwoColumn({ form, list }: any) { return <div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><div>{form}</div><div className="xl:col-span-2">{list}</div></div>; }
function Card({ title, children }: any) { return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"><h2 className="text-sm font-black text-slate-900 flex items-center gap-2"><LineChart className="w-5 h-5 text-indigo-600" />{title}</h2>{children}</div>; }
function Records({ rows, title, meta }: any) { return <Card title="Records"><div className="space-y-3">{rows.length === 0 ? <p className="text-xs text-slate-400 p-4 rounded-2xl bg-slate-50 border border-slate-100">No records yet.</p> : rows.map((row: any) => <div key={row.id} className="rounded-2xl border border-slate-100 p-4"><p className="text-sm font-black text-slate-900">{title(row)}</p><p className="text-[10px] text-slate-500 mt-1">{meta(row)}</p></div>)}</div></Card>; }
function Field({ label, value, onChange, type = 'text' }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field" /></label>; }
function Area({ label, value, onChange }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><textarea rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field" /></label>; }
function Select({ label, value, onChange, options }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field bg-white">{options.map((item: string) => <option key={item} value={item}>{item}</option>)}</select></label>; }
function EmployeeSelect({ value, onChange, employees }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">Employee</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field bg-white">{employees.map((emp: Employee) => <option key={emp.employeeId} value={emp.employeeId}>{emp.firstName} {emp.lastName}</option>)}</select></label>; }
function Button({ disabled, children }: any) { return <button disabled={disabled} className="w-full px-4 py-2 bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-xs font-black"><Plus className="w-4 h-4 inline mr-1" />{children}</button>; }
function Tab({ active, onClick, children }: any) { return <button onClick={onClick} className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${active ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{children}</button>; }
