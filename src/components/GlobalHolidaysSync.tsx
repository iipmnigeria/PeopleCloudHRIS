import React, { useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

type Props = { companyId: string | null; userId: string };

type Holiday = { date: string; name: string; countryCode?: string; holidayTypes?: string[]; nationalHoliday?: boolean };

export default function GlobalHolidaysSync({ companyId, userId }: Props) {
  const [country, setCountry] = useState('NG');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const syncHolidays = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`https://date.nager.at/api/v4/Holidays/${country}/${year}`);
      if (!response.ok) throw new Error(`Holiday API returned ${response.status}`);
      const data = await response.json();
      setHolidays(data);
      if (companyId) {
        await setDoc(doc(db, `companies/${companyId}/holiday_sync`, `${country}-${year}`), {
          country,
          year,
          holidays: data,
          syncedBy: userId,
          syncedAt: serverTimestamp(),
        });
      }
      setMessage(`${data.length} holidays synced successfully.`);
    } catch (error: any) {
      setMessage(`Holiday sync failed: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-indigo-600" /><h2 className="text-lg font-bold text-slate-900">Global Holidays Sync</h2></div>
          <p className="text-xs text-slate-500 mt-1">Sync country public holidays into the company holiday calendar collection.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white">
            <option value="NG">Nigeria</option><option value="GH">Ghana</option><option value="KE">Kenya</option><option value="ZA">South Africa</option><option value="GB">United Kingdom</option><option value="US">United States</option>
          </select>
          <input value={year} onChange={(e) => setYear(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs w-24" />
          <button onClick={syncHolidays} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Sync</button>
        </div>
      </div>
      {message && <div className="rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 p-3 text-xs font-semibold">{message}</div>}
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500"><span className="col-span-3">Date</span><span className="col-span-6">Holiday</span><span className="col-span-3">Type</span></div>
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {holidays.length ? holidays.map((holiday) => <div key={`${holiday.date}-${holiday.name}`} className="grid grid-cols-12 px-4 py-3 text-xs"><span className="col-span-3 font-mono text-slate-600">{holiday.date}</span><span className="col-span-6 font-semibold text-slate-800">{holiday.name}</span><span className="col-span-3 text-slate-500">{holiday.holidayTypes?.join(', ') || (holiday.nationalHoliday ? 'National' : 'Public')}</span></div>) : <div className="p-8 text-center text-xs text-slate-400">No holidays synced yet.</div>}
        </div>
      </div>
    </div>
  );
}
