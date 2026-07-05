import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { BadgeCheck, BookOpen, CalendarDays, CheckCircle2, Fingerprint, Mail, MessageSquareHeart, ShieldCheck, Users } from 'lucide-react';
import { db } from '../firebase';
import { UserRole } from '../types';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }; selectedTenantId: string };
type TabKey = 'meetings' | 'feedback' | 'ethics' | 'communication' | 'learning' | 'policy' | 'biometric';
type Row = { id: string; [key: string]: any };

const configs: Array<{ id: TabKey; label: string; collectionName: string; icon: any; description: string }> = [
  { id: 'meetings', label: 'E-Meeting / Conference', collectionName: 'experience_meetings', icon: CalendarDays, description: 'Virtual HR meetings, interviews, trainings, reviews and panels.' },
  { id: 'feedback', label: 'Feedback Pipeline', collectionName: 'experience_feedback', icon: MessageSquareHeart, description: 'Employee voice, pulse feedback, suggestions and HR follow-up.' },
  { id: 'ethics', label: 'Ethics / Whistleblowing', collectionName: 'experience_ethics_reports', icon: ShieldCheck, description: 'Confidential ethics reports and investigation tracking.' },
  { id: 'communication', label: 'Communication Center', collectionName: 'experience_communications', icon: Mail, description: 'General, bulk and personalised HR communication drafts and logs.' },
  { id: 'learning', label: 'E-Learning Bridge', collectionName: 'experience_learning', icon: BookOpen, description: 'Course plans, live class links, LMS references and learning records.' },
  { id: 'policy', label: 'Policy Acknowledgement', collectionName: 'experience_policies', icon: BadgeCheck, description: 'Policy issue, acknowledgement and compliance tracking.' },
  { id: 'biometric', label: 'Biometric Readiness', collectionName: 'experience_biometric', icon: Fingerprint, description: 'Passkey login and biometric attendance integration readiness.' },
];

export default function EmployeeExperienceSuite({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canManage = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'HR Manager'].includes(String(currentUser.role));
  const [tab, setTab] = useState<TabKey>('meetings');
  const [rows, setRows] = useState<Record<TabKey, Row[]>>({ meetings: [], feedback: [], ethics: [], communication: [], learning: [], policy: [], biometric: [] });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const activeConfig = configs.find((item) => item.id === tab) || configs[0];
  const stats = useMemo(() => configs.map((item) => ({ ...item, count: rows[item.id]?.length || 0 })), [rows]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setMessage('');
    try {
      const next: any = {};
      for (const cfg of configs) {
        try {
          const snap = await getDocs(query(collection(db, `companies/${companyId}/${cfg.collectionName}`), orderBy('createdAt', 'desc')));
          next[cfg.id] = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        } catch {
          const snap = await getDocs(collection(db, `companies/${companyId}/${cfg.collectionName}`));
          next[cfg.id] = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        }
      }
      setRows(next);
    } catch (error: any) {
      setMessage(`Unable to load Employee Experience Suite: ${error.message || error}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [companyId]);

  async function save(payload: any) {
    if (!companyId) return;
    setLoading(true);
    setMessage('');
    try {
      const ref = await addDoc(collection(db, `companies/${companyId}/${activeConfig.collectionName}`), {
        ...payload,
        companyId,
        status: payload.status || 'Open',
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName,
      });
      setRows((old) => ({ ...old, [tab]: [{ id: ref.id, ...payload, status: payload.status || 'Open' }, ...(old[tab] || [])] }));
      setMessage(`${activeConfig.label} record saved successfully.`);
    } catch (error: any) {
      setMessage(`Unable to save record: ${error.message || error}`);
    } finally { setLoading(false); }
  }

  return <div className="space-y-6"><div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800"><p className="text-[10px] uppercase tracking-[0.25em] text-indigo-300 font-black">PeopleCloudHRIS</p><h2 className="text-2xl font-black mt-2">Employee Experience & Communication Suite</h2><p className="text-sm text-slate-300 mt-2 max-w-3xl">Integrated workspace for e-meetings, feedback, ethics reporting, e-learning coordination, HR communication, policy acknowledgement and biometric readiness.</p></div>{message && <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-xs font-bold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{stats.map((item) => { const Icon = item.icon; return <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"><Icon className="w-4 h-4 text-indigo-600" /><p className="text-xl font-black text-slate-900 mt-2">{item.count}</p><p className="text-[10px] uppercase font-black text-slate-400">{item.label}</p></div>; })}</div><div className="grid grid-cols-1 xl:grid-cols-4 gap-6"><aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 h-fit space-y-1">{configs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`w-full text-left rounded-xl p-3 transition-all ${tab === item.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}><span className="flex items-center gap-2 text-xs font-black"><Icon className="w-4 h-4" />{item.label}</span><span className={`block text-[10px] mt-1 leading-relaxed ${tab === item.id ? 'text-indigo-100' : 'text-slate-400'}`}>{item.description}</span></button>; })}</aside><main className="xl:col-span-3"><SuiteForm tab={tab} canManage={canManage} loading={loading} rows={rows[tab] || []} currentUser={currentUser} onSave={save} /></main></div></div>;
}

function SuiteForm({ tab, canManage, loading, rows, currentUser, onSave }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => setForm(defaultForm(tab)), [tab]);
  const update = (key: string, value: any) => setForm((old: any) => ({ ...old, [key]: value }));
  const disabled = loading || (['meetings', 'communication', 'learning', 'policy', 'biometric'].includes(tab) && !canManage);
  const title = ({ meetings: 'Create E-Meeting / Conference', feedback: 'Submit Feedback', ethics: 'Submit Confidential Ethics Report', communication: 'Create Communication Draft / Log', learning: 'Create E-Learning Plan', policy: 'Issue Policy Acknowledgement', biometric: 'Log Biometric Readiness' } as any)[tab];
  return <Panel title={title}><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"><Fields tab={tab} form={form} update={update} /></div><div className="flex flex-wrap items-center gap-3"><button onClick={() => onSave({ ...form, submittedBy: form.protectIdentity ? 'Protected Reporter' : currentUser.displayName, submittedByUid: currentUser.uid })} disabled={disabled} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-black">Save Record</button>{disabled && <span className="text-[10px] text-slate-400">This action is limited to authorized HR/Admin users where applicable.</span>}</div><Recent rows={rows} /></Panel>;
}

function Fields({ tab, form, update }: any) {
  if (tab === 'meetings') return <><Field label="Meeting Title" value={form.title} onChange={(v: string) => update('title', v)} /><Select label="Provider" value={form.provider} onChange={(v: string) => update('provider', v)} options={['Google Meet', 'Zoom', 'Microsoft Teams', 'Manual Link', 'Physical / Hybrid']} /><Field label="Date" type="date" value={form.date} onChange={(v: string) => update('date', v)} /><Field label="Time" type="time" value={form.time} onChange={(v: string) => update('time', v)} /><Field label="Meeting Link" value={form.link} onChange={(v: string) => update('link', v)} /><Select label="Purpose" value={form.purpose} onChange={(v: string) => update('purpose', v)} options={['Interview', 'Onboarding', 'Training / L&D', 'Performance Review', 'Disciplinary Panel', 'Town Hall', 'Exit Interview']} /><Area label="Agenda / Notes" value={form.notes} onChange={(v: string) => update('notes', v)} /></>;
  if (tab === 'feedback') return <><Field label="Feedback Title" value={form.title} onChange={(v: string) => update('title', v)} /><Select label="Category" value={form.category} onChange={(v: string) => update('category', v)} options={['Suggestion', 'Complaint', 'Engagement', 'Manager Feedback', 'Workplace Issue', 'Innovation Idea']} /><Select label="Priority" value={form.priority} onChange={(v: string) => update('priority', v)} options={['Low', 'Medium', 'High', 'Critical']} /><Toggle label="Submit without name display" value={form.protectIdentity} onChange={(v: boolean) => update('protectIdentity', v)} /><Area label="Feedback / Comments" value={form.details} onChange={(v: string) => update('details', v)} /></>;
  if (tab === 'ethics') return <><Field label="Case Title" value={form.title} onChange={(v: string) => update('title', v)} /><Select label="Incident Type" value={form.incidentType} onChange={(v: string) => update('incidentType', v)} options={['Financial Misconduct', 'Harassment', 'Discrimination', 'Safety Concern', 'Policy Breach', 'Data Privacy Concern', 'Other']} /><Select label="Risk Level" value={form.riskLevel} onChange={(v: string) => update('riskLevel', v)} options={['Medium', 'High', 'Critical']} /><Field label="Incident Date" type="date" value={form.incidentDate} onChange={(v: string) => update('incidentDate', v)} /><Toggle label="Protect identity in case display" value={form.protectIdentity} onChange={(v: boolean) => update('protectIdentity', v)} /><Area label="Detailed Report" value={form.details} onChange={(v: string) => update('details', v)} /><Area label="Evidence Note / File Reference" value={form.evidenceNote} onChange={(v: string) => update('evidenceNote', v)} /></>;
  if (tab === 'communication') return <><Field label="Subject" value={form.title} onChange={(v: string) => update('title', v)} /><Select label="Audience" value={form.audience} onChange={(v: string) => update('audience', v)} options={['All Staff', 'Department', 'Managers', 'New Hires', 'Payroll Recipients', 'Training Participants', 'Custom List']} /><Select label="Channel" value={form.channel} onChange={(v: string) => update('channel', v)} options={['Email Draft', 'In-App Notice', 'SMS Placeholder', 'WhatsApp Placeholder']} /><Field label="Recipient Filter / Emails" value={form.recipients} onChange={(v: string) => update('recipients', v)} /><Toggle label="Personalised message" value={form.personalised} onChange={(v: boolean) => update('personalised', v)} /><Area label="Message Body" value={form.details} onChange={(v: string) => update('details', v)} /></>;
  if (tab === 'learning') return <><Field label="Course / Programme Title" value={form.title} onChange={(v: string) => update('title', v)} /><Select label="Format" value={form.format} onChange={(v: string) => update('format', v)} options={['Self-paced', 'Live Virtual Class', 'Blended', 'Physical Class']} /><Field label="LMS / Provider" value={form.provider} onChange={(v: string) => update('provider', v)} /><Field label="Live Class / LMS Link" value={form.link} onChange={(v: string) => update('link', v)} /><Field label="Target Audience" value={form.audience} onChange={(v: string) => update('audience', v)} /><Select label="Assessment" value={form.assessment} onChange={(v: string) => update('assessment', v)} options={['Quiz', 'Assignment', 'Attendance Only', 'Project', 'Manager Confirmation']} /><Toggle label="Certificate / CPD record" value={form.certificate} onChange={(v: boolean) => update('certificate', v)} /><Area label="Learning Notes" value={form.details} onChange={(v: string) => update('details', v)} /></>;
  if (tab === 'policy') return <><Field label="Policy Title" value={form.title} onChange={(v: string) => update('title', v)} /><Field label="Version" value={form.version} onChange={(v: string) => update('version', v)} /><Field label="Policy Link" value={form.link} onChange={(v: string) => update('link', v)} /><Field label="Audience" value={form.audience} onChange={(v: string) => update('audience', v)} /><Field label="Due Date" type="date" value={form.dueDate} onChange={(v: string) => update('dueDate', v)} /><Area label="Acknowledgement Text" value={form.details} onChange={(v: string) => update('details', v)} /></>;
  return <><Field label="Setup Name" value={form.title} onChange={(v: string) => update('title', v)} /><Select label="Biometric Type" value={form.biometricType} onChange={(v: string) => update('biometricType', v)} options={['Passkey / WebAuthn Login', 'Fingerprint Attendance Device', 'Face Recognition Attendance Device', 'Mobile GPS Selfie Clock-in', 'QR Clock-in', 'Access Control Integration']} /><Field label="Provider / Device Vendor" value={form.provider} onChange={(v: string) => update('provider', v)} /><Select label="Mode" value={form.mode} onChange={(v: string) => update('mode', v)} options={['Readiness Planning', 'Pilot', 'Live Integration', 'Import Logs Only']} /><Field label="Location / Branch" value={form.location} onChange={(v: string) => update('location', v)} /><Area label="Data Protection / Integration Notes" value={form.details} onChange={(v: string) => update('details', v)} /></>;
}

function defaultForm(tab: TabKey) { const base: any = { title: '', details: '', status: 'Open' }; if (tab === 'meetings') return { ...base, provider: 'Google Meet', purpose: 'Training / L&D', status: 'Scheduled' }; if (tab === 'feedback') return { ...base, category: 'Suggestion', priority: 'Medium', protectIdentity: false }; if (tab === 'ethics') return { ...base, incidentType: 'Financial Misconduct', riskLevel: 'High', protectIdentity: true, status: 'New Case' }; if (tab === 'communication') return { ...base, audience: 'All Staff', channel: 'Email Draft', personalised: true, status: 'Draft' }; if (tab === 'learning') return { ...base, format: 'Self-paced', provider: 'Internal LMS', assessment: 'Quiz', certificate: true, status: 'Planned' }; if (tab === 'policy') return { ...base, version: '1.0', audience: 'All Staff', details: 'I acknowledge that I have read, understood and agree to comply with this policy.', status: 'Awaiting Acknowledgement' }; return { ...base, biometricType: 'Passkey / WebAuthn Login', provider: 'Device Native Biometrics', mode: 'Readiness Planning', location: 'All Locations', status: 'Readiness Logged' }; }
function Panel({ title, children }: any) { return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"><h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><MegaphoneIcon />{title}</h3>{children}</div>; }
function MegaphoneIcon() { return <Mail className="w-5 h-5 text-indigo-600" />; }
function Field({ label, value, onChange, type = 'text' }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field" /></label>; }
function Select({ label, value, onChange, options }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field bg-white">{options.map((item: string) => <option key={item}>{item}</option>)}</select></label>; }
function Area({ label, value, onChange }: any) { return <label className="block md:col-span-2"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><textarea rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field" /></label>; }
function Toggle({ label, value, onChange }: any) { return <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"><span className="text-xs font-bold text-slate-600">{label}</span><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /></label>; }
function Recent({ rows }: { rows: Row[] }) { return <div className="border border-slate-100 rounded-2xl overflow-hidden"><div className="p-3 bg-slate-50 text-[10px] uppercase font-black text-slate-400 flex items-center gap-2"><Users className="w-3 h-3" />Recent Records</div>{rows.length === 0 ? <p className="p-4 text-xs text-slate-400">No records yet.</p> : rows.slice(0, 8).map((row) => <div key={row.id} className="p-3 border-t border-slate-100"><p className="text-xs font-black text-slate-900">{row.title || 'Untitled'}</p><p className="text-[10px] text-slate-500 mt-1">{row.status || 'Open'} • {row.category || row.purpose || row.audience || row.provider || row.biometricType || 'Employee Experience'}</p></div>)}</div>; }
