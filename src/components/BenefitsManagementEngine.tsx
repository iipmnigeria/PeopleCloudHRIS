import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { Activity, CheckCircle2, Gift, HeartPulse, Loader2, Plus, Search, ShieldCheck, Users, WalletCards } from 'lucide-react';
import { db } from '../firebase';
import { Employee, UserRole } from '../types';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }; selectedTenantId: string };
type Row = { id: string; [key: string]: any };

export default function BenefitsManagementEngine({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canManage = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'HR Manager', 'FinanceOfficer'].includes(String(currentUser.role));
  const [tab, setTab] = useState<'plans' | 'enrolments' | 'claims' | 'payroll'>('plans');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [enrolments, setEnrolments] = useState<Row[]>([]);
  const [claims, setClaims] = useState<Row[]>([]);
  const [payrollLinks, setPayrollLinks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [planForm, setPlanForm] = useState({ planName: '', category: 'Health Insurance', provider: '', eligibility: 'All confirmed employees', employerContribution: '', employeeContribution: '', benefitValue: '', renewalCycle: 'Annual', status: 'Active', notes: '' });
  const [enrolForm, setEnrolForm] = useState({ employeeId: '', planId: '', coverageLevel: 'Employee Only', beneficiaryName: '', beneficiaryRelationship: '', startDate: '', endDate: '', status: 'Active', notes: '' });
  const [claimForm, setClaimForm] = useState({ employeeId: '', planId: '', claimType: 'Medical', claimAmount: '', incidentDate: '', description: '', status: 'Submitted', financeStatus: 'Pending Review' });
  const [payrollForm, setPayrollForm] = useState({ employeeId: '', benefitType: 'Allowance', title: '', amount: '', frequency: 'Monthly', taxable: 'Yes', payrollAction: 'Add to Payroll', status: 'Active' });

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
        setEnrolForm((old) => ({ ...old, employeeId: old.employeeId || first }));
        setClaimForm((old) => ({ ...old, employeeId: old.employeeId || first }));
        setPayrollForm((old) => ({ ...old, employeeId: old.employeeId || first }));
      }
      const loadedPlans = await read('benefit_plans');
      setPlans(loadedPlans);
      setEnrolments(await read('benefit_enrolments'));
      setClaims(await read('benefit_claims'));
      setPayrollLinks(await read('benefit_payroll_links'));
      if (loadedPlans[0]?.id) {
        setEnrolForm((old) => ({ ...old, planId: old.planId || loadedPlans[0].id }));
        setClaimForm((old) => ({ ...old, planId: old.planId || loadedPlans[0].id }));
      }
    } catch (error: any) {
      setMessage(`Unable to load benefits records: ${error.message || error}`);
    } finally { setLoading(false); }
  }

  async function read(name: string) {
    const snap = await getDocs(collection(db, `companies/${companyId}/${name}`));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  const employeeName = (id?: string) => {
    const emp = employees.find((item) => item.employeeId === id);
    return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email : 'Unassigned';
  };
  const planName = (id?: string) => plans.find((item) => item.id === id)?.planName || 'Unassigned Plan';

  const stats = useMemo(() => [
    ['Benefit Plans', plans.length, Gift],
    ['Enrolled Staff', new Set(enrolments.map((item) => item.employeeId)).size, Users],
    ['Open Claims', claims.filter((item) => item.status !== 'Approved' && item.status !== 'Rejected').length, HeartPulse],
    ['Approved Claims', claims.filter((item) => item.status === 'Approved').length, CheckCircle2],
    ['Payroll Links', payrollLinks.length, WalletCards],
    ['Active Benefits', enrolments.filter((item) => item.status === 'Active').length, ShieldCheck],
  ], [plans, enrolments, claims, payrollLinks]);

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !canManage || !planForm.planName) return;
    const payload = { ...planForm, companyId, createdBy: currentUser.uid, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, `companies/${companyId}/benefit_plans`), payload);
    setPlans([{ id: ref.id, ...payload }, ...plans]);
    setMessage('Benefit plan created successfully.');
  }

  async function saveEnrolment(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !canManage || !enrolForm.employeeId || !enrolForm.planId) return;
    const payload = { ...enrolForm, companyId, createdBy: currentUser.uid, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, `companies/${companyId}/benefit_enrolments`), payload);
    setEnrolments([{ id: ref.id, ...payload }, ...enrolments]);
    setMessage('Employee benefit enrolment saved successfully.');
  }

  async function saveClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !claimForm.employeeId) return;
    const payload = { ...claimForm, companyId, claimAmount: Number(claimForm.claimAmount || 0), createdBy: currentUser.uid, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, `companies/${companyId}/benefit_claims`), payload);
    setClaims([{ id: ref.id, ...payload }, ...claims]);
    setMessage('Benefit claim submitted for HR/Finance review.');
  }

  async function savePayrollLink(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !canManage || !payrollForm.title) return;
    const payload = { ...payrollForm, companyId, amount: Number(payrollForm.amount || 0), createdBy: currentUser.uid, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, `companies/${companyId}/benefit_payroll_links`), payload);
    setPayrollLinks([{ id: ref.id, ...payload }, ...payrollLinks]);
    setMessage('Benefit payroll rule/action saved. It can be used by payroll during salary processing.');
  }

  async function updateClaimStatus(item: Row, status: string) {
    if (!companyId || !canManage) return;
    await updateDoc(doc(db, `companies/${companyId}/benefit_claims`, item.id), { status, financeStatus: status === 'Approved' ? 'Ready for Payment' : status });
    setClaims(claims.map((claim) => claim.id === item.id ? { ...claim, status, financeStatus: status === 'Approved' ? 'Ready for Payment' : status } : claim));
  }

  const filteredPlans = plans.filter((item) => `${item.planName} ${item.category} ${item.provider}`.toLowerCase().includes(search.toLowerCase()));
  const filteredEnrolments = enrolments.filter((item) => `${employeeName(item.employeeId)} ${planName(item.planId)} ${item.coverageLevel}`.toLowerCase().includes(search.toLowerCase()));
  const filteredClaims = claims.filter((item) => `${employeeName(item.employeeId)} ${planName(item.planId)} ${item.claimType}`.toLowerCase().includes(search.toLowerCase()));
  const filteredPayroll = payrollLinks.filter((item) => `${employeeName(item.employeeId)} ${item.title} ${item.benefitType}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /><span className="ml-3 text-xs text-slate-500 font-bold">Loading Benefits Management Engine...</span></div>;

  return <div className="space-y-6" id="benefits-management-engine"><div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"><p className="text-[10px] uppercase tracking-[0.25em] text-indigo-600 font-black">PeopleCloudHRIS</p><h1 className="text-2xl font-black text-slate-950 mt-2">Benefits Management Engine</h1><p className="text-sm text-slate-500 mt-2 max-w-4xl">Manage benefit plans, staff enrolments, beneficiaries, claims, allowances, deductions and payroll-linked benefit actions from one HR/Finance workspace.</p></div>{message && <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{stats.map(([label, value, Icon]: any) => <div key={label} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"><Icon className="w-4 h-4 text-indigo-600" /><p className="text-xl font-black text-slate-900 mt-2">{value}</p><p className="text-[10px] uppercase font-black text-slate-400">{label}</p></div>)}</div><div className="flex flex-col md:flex-row justify-between gap-4"><div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm overflow-x-auto"><Tab active={tab === 'plans'} onClick={() => setTab('plans')}>Plans</Tab><Tab active={tab === 'enrolments'} onClick={() => setTab('enrolments')}>Enrolments</Tab><Tab active={tab === 'claims'} onClick={() => setTab('claims')}>Claims</Tab><Tab active={tab === 'payroll'} onClick={() => setTab('payroll')}>Payroll Links</Tab></div><div className="relative w-full md:w-80"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search benefits records..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs" /></div></div>{tab === 'plans' && <TwoColumn form={<PlanForm form={planForm} setForm={setPlanForm} save={savePlan} canManage={canManage} />} list={<Records rows={filteredPlans} title={(r) => r.planName} meta={(r) => `${r.category} • ${r.provider || 'Internal'} • ${r.renewalCycle} • ${r.status}`} />} />}{tab === 'enrolments' && <TwoColumn form={<EnrolForm form={enrolForm} setForm={setEnrolForm} save={saveEnrolment} canManage={canManage} employees={employees} plans={plans} />} list={<Records rows={filteredEnrolments} title={(r) => employeeName(r.employeeId)} meta={(r) => `${planName(r.planId)} • ${r.coverageLevel} • ${r.beneficiaryName || 'No beneficiary'} • ${r.status}`} />} />}{tab === 'claims' && <TwoColumn form={<ClaimForm form={claimForm} setForm={setClaimForm} save={saveClaim} employees={employees} plans={plans} />} list={<ClaimRecords rows={filteredClaims} employeeName={employeeName} planName={planName} canManage={canManage} updateClaimStatus={updateClaimStatus} />} />}{tab === 'payroll' && <TwoColumn form={<PayrollForm form={payrollForm} setForm={setPayrollForm} save={savePayrollLink} canManage={canManage} employees={employees} />} list={<Records rows={filteredPayroll} title={(r) => r.title} meta={(r) => `${employeeName(r.employeeId)} • ${r.benefitType} • ${r.amount} • ${r.frequency} • ${r.payrollAction}`} />} />}</div>;
}

function PlanForm({ form, setForm, save, canManage }: any) { return <Card title="Create Benefit Plan"><form onSubmit={save} className="space-y-3"><Field label="Plan Name" value={form.planName} onChange={(v: string) => setForm({ ...form, planName: v })} /><Select label="Category" value={form.category} onChange={(v: string) => setForm({ ...form, category: v })} options={['Health Insurance', 'Pension', 'Life Insurance', 'Loan', 'Allowance', 'Wellbeing', 'Leave Benefit', 'Transport', 'Housing', 'Meal', 'Education Support', 'Other']} /><Field label="Provider / Vendor" value={form.provider} onChange={(v: string) => setForm({ ...form, provider: v })} /><Field label="Eligibility Rule" value={form.eligibility} onChange={(v: string) => setForm({ ...form, eligibility: v })} /><Field label="Employer Contribution" value={form.employerContribution} onChange={(v: string) => setForm({ ...form, employerContribution: v })} /><Field label="Employee Contribution" value={form.employeeContribution} onChange={(v: string) => setForm({ ...form, employeeContribution: v })} /><Field label="Benefit Value / Coverage" value={form.benefitValue} onChange={(v: string) => setForm({ ...form, benefitValue: v })} /><Select label="Renewal Cycle" value={form.renewalCycle} onChange={(v: string) => setForm({ ...form, renewalCycle: v })} options={['Monthly', 'Quarterly', 'Annual', 'One-Off']} /><Area label="Notes" value={form.notes} onChange={(v: string) => setForm({ ...form, notes: v })} /><Button disabled={!canManage}>Create Plan</Button></form></Card>; }
function EnrolForm({ form, setForm, save, canManage, employees, plans }: any) { return <Card title="Enroll Employee"><form onSubmit={save} className="space-y-3"><EmployeeSelect value={form.employeeId} onChange={(v: string) => setForm({ ...form, employeeId: v })} employees={employees} /><PlanSelect value={form.planId} onChange={(v: string) => setForm({ ...form, planId: v })} plans={plans} /><Select label="Coverage Level" value={form.coverageLevel} onChange={(v: string) => setForm({ ...form, coverageLevel: v })} options={['Employee Only', 'Employee + Spouse', 'Employee + Children', 'Family', 'Custom']} /><Field label="Beneficiary Name" value={form.beneficiaryName} onChange={(v: string) => setForm({ ...form, beneficiaryName: v })} /><Field label="Beneficiary Relationship" value={form.beneficiaryRelationship} onChange={(v: string) => setForm({ ...form, beneficiaryRelationship: v })} /><Field label="Start Date" type="date" value={form.startDate} onChange={(v: string) => setForm({ ...form, startDate: v })} /><Field label="End Date" type="date" value={form.endDate} onChange={(v: string) => setForm({ ...form, endDate: v })} /><Select label="Status" value={form.status} onChange={(v: string) => setForm({ ...form, status: v })} options={['Active', 'Pending', 'Suspended', 'Expired']} /><Area label="Notes" value={form.notes} onChange={(v: string) => setForm({ ...form, notes: v })} /><Button disabled={!canManage}>Save Enrolment</Button></form></Card>; }
function ClaimForm({ form, setForm, save, employees, plans }: any) { return <Card title="Submit Benefit Claim"><form onSubmit={save} className="space-y-3"><EmployeeSelect value={form.employeeId} onChange={(v: string) => setForm({ ...form, employeeId: v })} employees={employees} /><PlanSelect value={form.planId} onChange={(v: string) => setForm({ ...form, planId: v })} plans={plans} /><Select label="Claim Type" value={form.claimType} onChange={(v: string) => setForm({ ...form, claimType: v })} options={['Medical', 'Reimbursement', 'Loan', 'Allowance', 'Insurance', 'Wellbeing', 'Other']} /><Field label="Claim Amount" value={form.claimAmount} onChange={(v: string) => setForm({ ...form, claimAmount: v })} /><Field label="Incident Date" type="date" value={form.incidentDate} onChange={(v: string) => setForm({ ...form, incidentDate: v })} /><Area label="Description" value={form.description} onChange={(v: string) => setForm({ ...form, description: v })} /><Button disabled={false}>Submit Claim</Button></form></Card>; }
function PayrollForm({ form, setForm, save, canManage, employees }: any) { return <Card title="Create Payroll-Linked Benefit"><form onSubmit={save} className="space-y-3"><EmployeeSelect value={form.employeeId} onChange={(v: string) => setForm({ ...form, employeeId: v })} employees={employees} /><Select label="Benefit Type" value={form.benefitType} onChange={(v: string) => setForm({ ...form, benefitType: v })} options={['Allowance', 'Deduction', 'Employer Contribution', 'Employee Contribution', 'Taxable Benefit', 'Non-Taxable Benefit']} /><Field label="Title" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} /><Field label="Amount" value={form.amount} onChange={(v: string) => setForm({ ...form, amount: v })} /><Select label="Frequency" value={form.frequency} onChange={(v: string) => setForm({ ...form, frequency: v })} options={['Monthly', 'Quarterly', 'Annual', 'One-Off']} /><Select label="Taxable" value={form.taxable} onChange={(v: string) => setForm({ ...form, taxable: v })} options={['Yes', 'No', 'Depends on Country Rule']} /><Select label="Payroll Action" value={form.payrollAction} onChange={(v: string) => setForm({ ...form, payrollAction: v })} options={['Add to Payroll', 'Deduct from Payroll', 'Employer Cost Only', 'Report Only']} /><Button disabled={!canManage}>Save Payroll Link</Button></form></Card>; }
function ClaimRecords({ rows, employeeName, planName, canManage, updateClaimStatus }: any) { return <Card title="Claim Records"><div className="space-y-3">{rows.length === 0 ? <Empty /> : rows.map((row: Row) => <div key={row.id} className="rounded-2xl border border-slate-100 p-4"><p className="text-sm font-black text-slate-900">{employeeName(row.employeeId)} — {row.claimType}</p><p className="text-[10px] text-slate-500 mt-1">{planName(row.planId)} • {row.claimAmount} • {row.status} • {row.financeStatus}</p>{canManage && <div className="flex gap-2 mt-3"><button onClick={() => updateClaimStatus(row, 'Approved')} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black">Approve</button><button onClick={() => updateClaimStatus(row, 'Rejected')} className="px-3 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-black">Reject</button></div>}</div>)}</div></Card>; }
function TwoColumn({ form, list }: any) { return <div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><div>{form}</div><div className="xl:col-span-2">{list}</div></div>; }
function Records({ rows, title, meta }: any) { return <Card title="Records"><div className="space-y-3">{rows.length === 0 ? <Empty /> : rows.map((row: Row) => <div key={row.id} className="rounded-2xl border border-slate-100 p-4"><p className="text-sm font-black text-slate-900">{title(row)}</p><p className="text-[10px] text-slate-500 mt-1">{meta(row)}</p></div>)}</div></Card>; }
function Card({ title, children }: any) { return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"><h2 className="text-sm font-black text-slate-900 flex items-center gap-2"><Gift className="w-5 h-5 text-indigo-600" />{title}</h2>{children}</div>; }
function Field({ label, value, onChange, type = 'text' }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field" /></label>; }
function Area({ label, value, onChange }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><textarea rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field" /></label>; }
function Select({ label, value, onChange, options }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field bg-white">{options.map((item: string) => <option key={item}>{item}</option>)}</select></label>; }
function EmployeeSelect({ value, onChange, employees }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">Employee</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field bg-white">{employees.map((emp: Employee) => <option key={emp.employeeId} value={emp.employeeId}>{emp.firstName} {emp.lastName}</option>)}</select></label>; }
function PlanSelect({ value, onChange, plans }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">Benefit Plan</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field bg-white">{plans.map((plan: Row) => <option key={plan.id} value={plan.id}>{plan.planName}</option>)}</select></label>; }
function Button({ disabled, children }: any) { return <button disabled={disabled} className="w-full px-4 py-2 bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-xs font-black"><Plus className="w-4 h-4 inline mr-1" />{children}</button>; }
function Tab({ active, onClick, children }: any) { return <button onClick={onClick} className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${active ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{children}</button>; }
function Empty() { return <p className="text-xs text-slate-400 p-4 rounded-2xl bg-slate-50 border border-slate-100">No records yet.</p>; }
