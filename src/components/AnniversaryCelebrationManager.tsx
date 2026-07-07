import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { Cake, CalendarHeart, CheckCircle2, Gift, Loader2, Mail, PartyPopper, Search } from 'lucide-react';
import { db } from '../firebase';
import { Employee, UserRole } from '../types';
import { queueEmailNotification } from '../services/emailService';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }; selectedTenantId: string };
type Occasion = 'Birthday' | 'Work Anniversary' | 'Wedding Anniversary';
type Candidate = { employee: Employee; occasion: Occasion; dateValue: string; years?: number; message: string };
type LogRow = { id: string; [key: string]: any };

const defaults: Record<Occasion, string> = {
  Birthday: 'Happy Birthday, {firstName}! We celebrate you today and wish you joy, strength and a fulfilling new year. From all of us at {companyName}.',
  'Work Anniversary': 'Congratulations, {firstName}, on your work anniversary! Thank you for your commitment, contribution and service to {companyName}.',
  'Wedding Anniversary': 'Happy Wedding Anniversary, {firstName}! We celebrate this special milestone with you and wish your home continued joy and peace.'
};

export default function AnniversaryCelebrationManager({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canManage = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'HR Manager'].includes(String(currentUser.role));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [companyName, setCompanyName] = useState('Your Organization');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [templates, setTemplates] = useState(defaults);
  const today = new Date();
  const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => { loadData(); }, [companyId]);

  async function loadData() {
    if (!companyId) return;
    setLoading(true);
    try {
      const companySnap = await getDocs(collection(db, 'companies'));
      const currentCompany = companySnap.docs.find((item) => item.id === companyId);
      if (currentCompany) setCompanyName(currentCompany.data().name || 'Your Organization');
      const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
      setEmployees(empSnap.docs.map((item) => ({ employeeId: item.id, ...(item.data() as Employee) })));
      const logSnap = await getDocs(collection(db, `companies/${companyId}/celebration_logs`));
      setLogs(logSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error: any) {
      setMessage(`Unable to load celebration records: ${error.message || error}`);
    } finally { setLoading(false); }
  }

  function mmdd(value?: string) {
    if (!value) return '';
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return `${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    const parts = String(value).split('-');
    return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : '';
  }

  function yearsSince(value?: string) {
    if (!value) return 0;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : Math.max(0, today.getFullYear() - parsed.getFullYear());
  }

  function render(template: string, employee: Employee, occasion: Occasion, years = 0) {
    const firstName = employee.firstName || employee.displayName?.split(' ')[0] || 'Colleague';
    return template.replaceAll('{firstName}', firstName).replaceAll('{lastName}', employee.lastName || '').replaceAll('{employeeName}', `${employee.firstName || ''} ${employee.lastName || ''}`.trim()).replaceAll('{companyName}', companyName).replaceAll('{occasion}', occasion).replaceAll('{years}', String(years));
  }

  const candidates = useMemo<Candidate[]>(() => {
    const result: Candidate[] = [];
    employees.forEach((employee: any) => {
      if (mmdd(employee.dateOfBirth) === todayKey) result.push({ employee, occasion: 'Birthday', dateValue: employee.dateOfBirth, message: render(templates.Birthday, employee, 'Birthday') });
      const hireDate = employee.dateOfEmployment || employee.hireDate || employee.joinDate;
      if (mmdd(hireDate) === todayKey) result.push({ employee, occasion: 'Work Anniversary', dateValue: hireDate, years: yearsSince(hireDate), message: render(templates['Work Anniversary'], employee, 'Work Anniversary', yearsSince(hireDate)) });
      const weddingDate = employee.weddingDate || employee.marriageAnniversaryDate || employee.weddingAnniversary;
      if (mmdd(weddingDate) === todayKey) result.push({ employee, occasion: 'Wedding Anniversary', dateValue: weddingDate, years: yearsSince(weddingDate), message: render(templates['Wedding Anniversary'], employee, 'Wedding Anniversary', yearsSince(weddingDate)) });
    });
    return result;
  }, [employees, templates, companyName, todayKey]);

  function alreadySent(item: Candidate) {
    const email = item.employee.email || item.employee.workEmail;
    return logs.some((log) => log.dateKey === todayKey && log.occasion === item.occasion && log.employeeEmail === email);
  }

  async function sendCandidate(item: Candidate) {
    if (!companyId) return;
    const email = item.employee.workEmail || item.employee.email;
    if (!email) { setMessage('This employee has no email address.'); return; }
    if (alreadySent(item)) { setMessage('This celebration message was already logged for today.'); return; }
    const subject = item.occasion === 'Birthday' ? `Happy Birthday, ${item.employee.firstName || ''}!` : item.occasion === 'Work Anniversary' ? `Congratulations on your Work Anniversary` : `Happy Wedding Anniversary`;
    await queueEmailNotification({ to: email, subject, html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937"><h2>${subject}</h2><p>${item.message}</p><p>Warm regards,<br/>${companyName}</p></div>`, companyId, type: 'celebration_message', metadata: { employeeId: item.employee.employeeId, occasion: item.occasion, dateKey: todayKey } });
    const log = { companyId, employeeId: item.employee.employeeId, employeeEmail: email, employeeName: `${item.employee.firstName || ''} ${item.employee.lastName || ''}`.trim(), occasion: item.occasion, dateKey: todayKey, message: item.message, sentBy: currentUser.uid, sentAt: serverTimestamp(), status: 'Queued' };
    const ref = await addDoc(collection(db, `companies/${companyId}/celebration_logs`), log);
    setLogs([{ id: ref.id, ...log, sentAt: new Date().toISOString() }, ...logs]);
    setMessage(`${item.occasion} message queued for ${log.employeeName || email}.`);
  }

  async function runToday() {
    if (!canManage) return;
    const pending = candidates.filter((item) => !alreadySent(item));
    for (const item of pending) await sendCandidate(item);
    if (pending.length === 0) setMessage('No unsent celebration messages found for today.');
  }

  const filteredLogs = logs.filter((log) => `${log.employeeName} ${log.occasion} ${log.employeeEmail}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /><span className="ml-3 text-xs text-slate-500 font-bold">Loading Anniversary Celebration Manager...</span></div>;

  return <div className="space-y-6" id="anniversary-celebration-manager"><div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"><p className="text-[10px] uppercase tracking-[0.25em] text-indigo-600 font-black">PeopleCloudHRIS</p><h1 className="text-2xl font-black text-slate-950 mt-2">Anniversary Celebration Manager</h1><p className="text-sm text-slate-500 mt-2 max-w-4xl">Automatically identify birthday, work anniversary and wedding anniversary occasions, then queue personalised celebration emails for staff.</p></div>{message && <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}<div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric icon={Cake} label="Birthdays Today" value={candidates.filter((i) => i.occasion === 'Birthday').length} /><Metric icon={Gift} label="Work Anniversaries" value={candidates.filter((i) => i.occasion === 'Work Anniversary').length} /><Metric icon={CalendarHeart} label="Wedding Anniversaries" value={candidates.filter((i) => i.occasion === 'Wedding Anniversary').length} /><Metric icon={Mail} label="Messages Logged" value={logs.filter((l) => l.dateKey === todayKey).length} /></div><div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"><h2 className="text-sm font-black text-slate-900 flex items-center gap-2"><PartyPopper className="w-5 h-5 text-indigo-600" />Today's Celebrations</h2>{candidates.length === 0 ? <Empty text="No birthday, work anniversary or wedding anniversary found for today." /> : candidates.map((item) => <div key={`${item.occasion}-${item.employee.employeeId}`} className="rounded-2xl border border-slate-100 p-4"><p className="text-sm font-black text-slate-900">{item.employee.firstName} {item.employee.lastName}</p><p className="text-[10px] text-slate-500 mt-1">{item.occasion}{item.years ? ` • ${item.years} year(s)` : ''}</p><p className="text-xs text-slate-600 mt-2">{item.message}</p><button onClick={() => sendCandidate(item)} disabled={!canManage || alreadySent(item)} className="mt-3 px-3 py-1.5 bg-slate-900 disabled:bg-slate-300 text-white rounded-lg text-[10px] font-black">{alreadySent(item) ? 'Already Queued' : 'Queue Message'}</button></div>)}<button onClick={runToday} disabled={!canManage} className="w-full px-4 py-2 bg-indigo-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-black">Run Today's Celebration Check</button></div><div className="xl:col-span-2 space-y-6"><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"><h2 className="text-sm font-black text-slate-900">Message Templates</h2><Template label="Birthday Template" value={templates.Birthday} onChange={(v: string) => setTemplates({ ...templates, Birthday: v })} /><Template label="Work Anniversary Template" value={templates['Work Anniversary']} onChange={(v: string) => setTemplates({ ...templates, 'Work Anniversary': v })} /><Template label="Wedding Anniversary Template" value={templates['Wedding Anniversary']} onChange={(v: string) => setTemplates({ ...templates, 'Wedding Anniversary': v })} /><p className="text-[10px] text-slate-400">Supported tags: {'{firstName}'}, {'{lastName}'}, {'{employeeName}'}, {'{companyName}'}, {'{occasion}'}, {'{years}'}.</p></div><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"><div className="flex flex-col md:flex-row justify-between gap-3"><h2 className="text-sm font-black text-slate-900">Celebration Logs</h2><div className="relative md:w-72"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs" /></div></div>{filteredLogs.length === 0 ? <Empty text="No celebration logs yet." /> : filteredLogs.slice(0, 10).map((log) => <div key={log.id} className="rounded-2xl border border-slate-100 p-4"><p className="text-sm font-black text-slate-900">{log.employeeName || log.employeeEmail}</p><p className="text-[10px] text-slate-500 mt-1">{log.occasion} • {log.dateKey} • {log.status}</p></div>)}</div></div></div><div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-800"><strong>Production note:</strong> this manager queues emails through the existing Firestore email service. For fully automatic daily sending even when no HR user opens the app, deploy a Firebase Scheduled Function later to run this same celebration check every morning.</div></div>;
}

function Metric({ icon: Icon, label, value }: any) { return <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"><Icon className="w-4 h-4 text-indigo-600" /><p className="text-xl font-black text-slate-900 mt-2">{value}</p><p className="text-[10px] uppercase font-black text-slate-400">{label}</p></div>; }
function Template({ label, value, onChange }: any) { return <label className="block"><span className="block text-[10px] uppercase font-black text-slate-500 mb-1">{label}</span><textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="input-field" /></label>; }
function Empty({ text }: { text: string }) { return <p className="text-xs text-slate-400 p-4 rounded-2xl bg-slate-50 border border-slate-100">{text}</p>; }
