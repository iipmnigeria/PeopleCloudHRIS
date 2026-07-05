import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { CheckCircle2, Copy, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import { UserRole } from '../types';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }; selectedTenantId: string };
type LinkRow = { id: string; companyId?: string; title?: string; purpose?: string; status?: string; expiresAt?: string; employeeId?: string; employeeEmail?: string };
type Submission = { id: string; companyId?: string; token?: string; purpose?: string; employeeId?: string; employeeEmail?: string; status?: string; submittedData?: any };
function canManage(role: UserRole) { return ['SuperAdmin', 'CompanyAdmin', 'HRManager'].includes(role); }
function makeToken() { return `edl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }

export default function EmployeeDataLinkManager({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const allowed = canManage(currentUser.role);
  const [purpose, setPurpose] = useState('New Employee Data Collection');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [days, setDays] = useState(7);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadData() {
    if (!companyId || !allowed) return;
    setBusy(true);
    setMessage('');
    try {
      const linkQuery = query(collection(db, 'employee_data_links'), where('companyId', '==', companyId));
      const linkSnap = await getDocs(linkQuery);
      const linkRows: LinkRow[] = [];
      linkSnap.forEach((item) => linkRows.push({ ...(item.data() as LinkRow), id: item.id }));
      setLinks(linkRows.sort((a, b) => String(b.expiresAt || '').localeCompare(String(a.expiresAt || ''))));

      const subQuery = query(collection(db, 'employee_data_submissions'), where('companyId', '==', companyId));
      const subSnap = await getDocs(subQuery);
      const subRows: Submission[] = [];
      subSnap.forEach((item) => subRows.push({ ...(item.data() as Submission), id: item.id }));
      setSubmissions(subRows);
      setMessage('Employee data links refreshed.');
    } catch (error: any) {
      setMessage(`Unable to refresh links. Confirm the latest Firestore rules are published. Details: ${error.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadData(); }, [companyId, allowed]);
  const pending = useMemo(() => submissions.filter((item) => item.status === 'Pending HR Review'), [submissions]);
  function urlFor(token: string) { return `${window.location.origin}${window.location.pathname}?employee-intake=${token}`; }

  async function createLink() {
    if (!companyId || !allowed) return;
    setBusy(true);
    setMessage('');
    try {
      const token = makeToken();
      const expiresAt = new Date(Date.now() + Number(days || 7) * 86400000).toISOString();
      const title = purpose === 'Existing Staff Data Update' ? 'Existing Staff Data Update Form' : 'New Employee Data Collection Form';
      const data = { companyId, title, purpose, status: 'Active', employeeId, employeeEmail, expiresAt, createdBy: currentUser.uid, createdAt: serverTimestamp() };
      await setDoc(doc(db, 'employee_data_links', token), data);
      setLinks((items) => [{ id: token, ...data }, ...items]);
      setMessage('Employee data link generated. Copy and share with the employee.');
    } catch (error: any) {
      setMessage(`Unable to generate link. Confirm the latest Firestore rules are published. Details: ${error.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  async function approveSubmission(item: Submission) {
    if (!companyId || !allowed || !item.submittedData) return;
    setBusy(true);
    setMessage('');
    try {
      const f = item.submittedData;
      const data = { ...f, companyId, email: String(f.email || item.employeeEmail || '').toLowerCase(), bankVerificationNumber: f.bvn || f.bankVerificationNumber || '', nationalIdentificationNumber: f.nin || f.nationalIdentificationNumber || '', nextOfKinRelationship: f.relationship || f.nextOfKinRelationship || '', updatedAt: new Date().toISOString(), updatedBy: currentUser.uid };
      const targetId = item.employeeId || f.employeeId || (f.employeeCode ? `emp-${String(f.employeeCode).toLowerCase().replace(/[^a-z0-9-]/g, '-')}` : `emp-${Date.now()}`);
      await setDoc(doc(db, `companies/${companyId}/employees`, targetId), { ...data, employeeId: targetId, createdAt: new Date().toISOString() }, { merge: true });
      await updateDoc(doc(db, 'employee_data_submissions', item.id), { status: 'Approved', approvedBy: currentUser.uid, approvedAt: serverTimestamp(), targetEmployeeId: targetId });
      setSubmissions((rows) => rows.map((row) => row.id === item.id ? { ...row, status: 'Approved' } : row));
      setMessage('Submission approved and employee database updated.');
    } catch (error: any) {
      setMessage(`Unable to approve submission: ${error.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) return null;
  return <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><LinkIcon className="w-4 h-4 text-indigo-600" />Employee Data Collection Links</h3><p className="text-xs text-slate-500 mt-1">Generate secure links for new employee records or existing staff data updates.</p></div><button onClick={loadData} disabled={busy} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-2 disabled:opacity-50"><RefreshCw className="w-4 h-4" />Refresh</button></div>{message && <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs font-bold text-indigo-800">{message}</div>}<div className="grid grid-cols-1 md:grid-cols-5 gap-3"><select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"><option>New Employee Data Collection</option><option>Existing Staff Data Update</option></select><input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="Employee ID, optional" className="px-3 py-2 border border-slate-200 rounded-xl text-xs" /><input value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} placeholder="Employee email, optional" className="px-3 py-2 border border-slate-200 rounded-xl text-xs" /><input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-3 py-2 border border-slate-200 rounded-xl text-xs" /><button onClick={createLink} disabled={busy} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black disabled:opacity-50">{busy ? 'Working...' : 'Generate Link'}</button></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><div className="border border-slate-100 rounded-xl overflow-hidden"><div className="p-3 bg-slate-50 text-[10px] uppercase font-black text-slate-500">Generated Links</div>{links.length === 0 && <p className="p-4 text-xs text-slate-400">No generated links yet.</p>}{links.slice(0, 5).map((link) => <div key={link.id} className="p-3 border-t border-slate-100 text-xs"><p className="font-bold text-slate-900">{link.title}</p><p className="text-[10px] text-slate-500">Expires: {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'N/A'}</p><button onClick={() => navigator.clipboard.writeText(urlFor(link.id))} className="mt-2 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold inline-flex gap-1 items-center"><Copy className="w-3 h-3" />Copy Link</button><p className="text-[9px] text-slate-400 mt-1 break-all">{urlFor(link.id)}</p></div>)}</div><div className="border border-slate-100 rounded-xl overflow-hidden"><div className="p-3 bg-slate-50 text-[10px] uppercase font-black text-slate-500">Pending Submissions ({pending.length})</div>{pending.length === 0 && <p className="p-4 text-xs text-slate-400">No pending employee submissions.</p>}{pending.map((item) => <div key={item.id} className="p-3 border-t border-slate-100 text-xs"><p className="font-bold text-slate-900">{item.submittedData?.firstName} {item.submittedData?.lastName}</p><p className="text-[10px] text-slate-500">{item.employeeEmail || item.submittedData?.email} • {item.purpose}</p><button onClick={() => approveSubmission(item)} disabled={busy} className="mt-2 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold inline-flex gap-1 items-center disabled:opacity-50"><CheckCircle2 className="w-3 h-3" />Approve & Update Database</button></div>)}</div></div></div>;
}
