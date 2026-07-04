import React, { useMemo, useState } from 'react';
import { Copy, Share2, Users } from 'lucide-react';

type Props = { currentUser: { uid: string; email: string; displayName: string } };
type Activity = { id: string; name: string; email: string; stage: string; score: number; status: string };

function scoreFor(stage: string) { if (stage === 'registration') return 10; if (stage === 'trial') return 25; if (stage === 'subscription') return 100; return 70; }

export default function ReferralGrowthHub({ currentUser }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState('registration');
  const [message, setMessage] = useState('');

  const code = useMemo(() => `${(currentUser.displayName || 'PCH').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()}-${currentUser.uid.slice(0, 6).toUpperCase()}`, [currentUser.displayName, currentUser.uid]);
  const link = `${window.location.origin}${import.meta.env.BASE_URL || '/PeopleCloudHRIS/'}?ref=${encodeURIComponent(code)}`;
  const totalScore = activities.reduce((sum, item) => sum + item.score, 0);

  const addActivity = (event: React.FormEvent) => {
    event.preventDefault();
    setActivities((items) => [{ id: `ref-${Date.now()}`, name, email, stage, score: scoreFor(stage), status: stage === 'subscription' || stage === 'renewal' ? 'approved' : 'pending' }, ...items]);
    setName(''); setEmail(''); setMessage('Referral activity added.');
  };

  return <div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Metric icon={Share2} label="Activities" value={activities.length} /><Metric icon={Users} label="Total Score" value={totalScore} /><Metric icon={Users} label="Code" value={code} /></div><div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"><h2 className="text-lg font-bold text-slate-900">Referral Growth Hub</h2><p className="text-xs text-slate-500">Unique referral code, link, and activity stages from registration to subscription.</p><div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4"><p className="text-[10px] uppercase font-black text-indigo-500">Referral Code</p><p className="text-xl font-black text-indigo-900">{code}</p></div><div className="bg-slate-50 border rounded-xl p-3 text-[11px] font-mono break-all">{link}</div><button onClick={() => navigator.clipboard?.writeText(link)} className="w-full bg-slate-900 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center justify-center gap-2"><Copy className="w-4 h-4" />Copy Link</button>{message && <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold">{message}</div>}</div><div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-4"><form onSubmit={addActivity} className="grid grid-cols-1 md:grid-cols-4 gap-2"><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Prospect name" className="border rounded-xl px-3 py-2 text-xs" /><input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="Email" className="border rounded-xl px-3 py-2 text-xs" /><select value={stage} onChange={(e) => setStage(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"><option value="registration">Registration</option><option value="trial">Trial</option><option value="subscription">Subscription</option><option value="renewal">Renewal</option></select><button className="bg-indigo-600 text-white rounded-xl px-4 py-2 text-xs font-bold">Add</button></form><div className="border rounded-2xl overflow-hidden">{activities.length ? activities.map((item) => <div key={item.id} className="grid grid-cols-12 px-4 py-3 border-b text-xs"><span className="col-span-4 font-bold">{item.name}<br/><span className="text-[10px] text-slate-400">{item.email}</span></span><span className="col-span-3 capitalize">{item.stage}</span><span className="col-span-2 font-bold text-emerald-600">{item.score}</span><span className="col-span-3 capitalize">{item.status}</span></div>) : <div className="p-8 text-center text-xs text-slate-400">No referral activity yet.</div>}</div></div></div></div>;
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) { return <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{label}</p><p className="text-lg font-black text-slate-900 mt-1">{value}</p></div><span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span></div></div>; }
