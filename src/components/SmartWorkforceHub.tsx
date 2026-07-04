import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckSquare, Gift, Network, Wifi, WifiOff } from 'lucide-react';
import SmartOrgChart from './SmartOrgChart';
import GlobalHolidaysSync from './GlobalHolidaysSync';
import BulkActionsCenter from './BulkActionsCenter';
import ReferralGrowthHub from './ReferralGrowthHub';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: string; companyId: string | null }; selectedTenantId: string };

export default function SmartWorkforceHub({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId || null;
  const [activeTab, setActiveTab] = useState<'org' | 'holidays' | 'bulk' | 'referrals'>('org');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const nav = [
    { id: 'org', label: 'Smart Org Chart', icon: Network },
    { id: 'holidays', label: 'Global Holidays Sync', icon: CalendarDays },
    { id: 'bulk', label: 'Bulk Actions', icon: CheckSquare },
    { id: 'referrals', label: 'Referral Growth Hub', icon: Gift },
  ] as const;

  return <div className="space-y-6" id="smart-workforce-hub"><div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-sm"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.24em] text-indigo-200 font-black">PeopleCloud Smart Workforce Hub</p><h1 className="text-2xl lg:text-3xl font-bold mt-2">Enterprise HR intelligence tools.</h1><p className="text-sm text-slate-300 mt-2 max-w-3xl">Smart org chart, global holidays sync, bulk actions, offline awareness, and referral tracking.</p></div><div className={`rounded-2xl px-4 py-3 border ${isOnline ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-200' : 'bg-rose-500/10 border-rose-400/20 text-rose-200'}`}><div className="flex items-center gap-2 text-xs font-bold">{isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}{isOnline ? 'Online mode active' : 'Offline mode active'}</div></div></div></div><div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-2">{nav.map((item) => <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === item.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}><item.icon className="w-4 h-4" />{item.label}</button>)}</div>{activeTab === 'org' && <SmartOrgChart companyId={companyId} />}{activeTab === 'holidays' && <GlobalHolidaysSync companyId={companyId} userId={currentUser.uid} />}{activeTab === 'bulk' && <BulkActionsCenter companyId={companyId} isOnline={isOnline} onOfflineAction={() => undefined} />}{activeTab === 'referrals' && <ReferralGrowthHub currentUser={currentUser} />}</div>;
}
