import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Building2, CheckCircle2, CreditCard, Globe2, Lock, ShieldCheck } from 'lucide-react';
import { db } from '../firebase';
import { UserRole } from '../types';

type SettingsProps = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type CountryOption = {
  code: string;
  name: string;
  region: string;
  currency: string;
  timeZone: string;
  language: string;
  dateFormat: string;
  compliancePack: string;
};

const countries: CountryOption[] = [
  { code: 'NG', name: 'Nigeria', region: 'Africa', currency: 'NGN', timeZone: 'Africa/Lagos', language: 'English', dateFormat: 'DD/MM/YYYY', compliancePack: 'Nigeria: PAYE, Pension, NHF, NHIS/NHIA, NSITF, ITF' },
  { code: 'GH', name: 'Ghana', region: 'Africa', currency: 'GHS', timeZone: 'Africa/Accra', language: 'English', dateFormat: 'DD/MM/YYYY', compliancePack: 'Ghana: PAYE, SSNIT, Tier 2, Tier 3' },
  { code: 'KE', name: 'Kenya', region: 'Africa', currency: 'KES', timeZone: 'Africa/Nairobi', language: 'English', dateFormat: 'DD/MM/YYYY', compliancePack: 'Kenya: PAYE, NSSF, SHIF/NHIF, Housing Levy' },
  { code: 'ZA', name: 'South Africa', region: 'Africa', currency: 'ZAR', timeZone: 'Africa/Johannesburg', language: 'English', dateFormat: 'YYYY/MM/DD', compliancePack: 'South Africa: PAYE, UIF, SDL, COIDA' },
  { code: 'UK', name: 'United Kingdom', region: 'Europe', currency: 'GBP', timeZone: 'Europe/London', language: 'English', dateFormat: 'DD/MM/YYYY', compliancePack: 'UK: PAYE, National Insurance, Pension Auto-Enrolment' },
  { code: 'US', name: 'United States', region: 'North America', currency: 'USD', timeZone: 'America/New_York', language: 'English', dateFormat: 'MM/DD/YYYY', compliancePack: 'US: Federal Tax, State Tax, Social Security, Medicare' },
  { code: 'AE', name: 'United Arab Emirates', region: 'Middle East', currency: 'AED', timeZone: 'Asia/Dubai', language: 'English', dateFormat: 'DD/MM/YYYY', compliancePack: 'UAE: WPS, Gratuity, Health Insurance' },
  { code: 'GLOBAL', name: 'Generic Global', region: 'Global', currency: 'USD', timeZone: 'UTC', language: 'English', dateFormat: 'YYYY-MM-DD', compliancePack: 'Generic: Custom tax, social security, pension and health rules' },
];

const taxYearOptions = ['January - December', 'April - March', 'July - June', 'October - September', 'Custom'];

export default function SettingsGlobal({ currentUser, selectedTenantId }: SettingsProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canEdit = ['SuperAdmin', 'CompanyAdmin', 'HRManager'].includes(currentUser.role);
  const [activeTab, setActiveTab] = useState<'global' | 'profile' | 'subscription' | 'security'>('global');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState('Starter');
  const [subscriptionStatus, setSubscriptionStatus] = useState('Pending');
  const [operatingCountryCode, setOperatingCountryCode] = useState('NG');
  const [payrollCountryCode, setPayrollCountryCode] = useState('NG');
  const [operatingCurrency, setOperatingCurrency] = useState('NGN');
  const [payrollCurrency, setPayrollCurrency] = useState('NGN');
  const [timeZone, setTimeZone] = useState('Africa/Lagos');
  const [language, setLanguage] = useState('English');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [taxYear, setTaxYear] = useState('January - December');
  const [compliancePack, setCompliancePack] = useState(countries[0].compliancePack);

  useEffect(() => {
    async function loadSettings() {
      if (!companyId) return;
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'companies', companyId));
        if (snap.exists()) {
          const data = snap.data() as any;
          setCompanyName(data.name || '');
          setIndustry(data.industry || '');
          setBillingEmail(data.billingEmail || '');
          setSubscriptionPlan(data.subscriptionPlan || 'Starter');
          setSubscriptionStatus(data.subscriptionStatus || 'Pending');
          const operating = countries.find((item) => item.code === (data.operatingCountryCode || data.countryCode || 'NG')) || countries[0];
          const payroll = countries.find((item) => item.code === (data.payrollCountryCode || data.countryCode || operating.code)) || operating;
          setOperatingCountryCode(operating.code);
          setPayrollCountryCode(payroll.code);
          setOperatingCurrency(data.operatingCurrency || data.billingCurrency || operating.currency);
          setPayrollCurrency(data.payrollCurrency || payroll.currency);
          setTimeZone(data.timeZone || operating.timeZone);
          setLanguage(data.language || operating.language);
          setDateFormat(data.dateFormat || operating.dateFormat);
          setTaxYear(data.taxYear || 'January - December');
          setCompliancePack(data.defaultComplianceRulePack || payroll.compliancePack);
        }
      } catch (error: any) {
        setMessage(`Unable to load company settings: ${error.message || error}`);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [companyId]);

  const applyOperatingCountry = (code: string) => {
    const country = countries.find((item) => item.code === code) || countries[0];
    setOperatingCountryCode(country.code);
    setOperatingCurrency(country.currency);
    setTimeZone(country.timeZone);
    setLanguage(country.language);
    setDateFormat(country.dateFormat);
  };

  const applyPayrollCountry = (code: string) => {
    const country = countries.find((item) => item.code === code) || countries[0];
    setPayrollCountryCode(country.code);
    setPayrollCurrency(country.currency);
    setCompliancePack(country.compliancePack);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !canEdit) return;
    setLoading(true);
    setMessage('');
    try {
      await setDoc(doc(db, 'companies', companyId), {
        name: companyName.trim(),
        industry: industry.trim(),
        billingEmail: billingEmail.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      }, { merge: true });
      setMessage('Company profile saved successfully.');
    } catch (error: any) {
      setMessage(`Unable to save profile: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const saveGlobalSettings = async () => {
    if (!companyId || !canEdit) return;
    const operating = countries.find((item) => item.code === operatingCountryCode) || countries[0];
    const payroll = countries.find((item) => item.code === payrollCountryCode) || operating;
    setLoading(true);
    setMessage('');
    try {
      await setDoc(doc(db, 'companies', companyId), {
        operatingCountryCode: operating.code,
        operatingCountry: operating.name,
        operatingRegion: operating.region,
        operatingCurrency,
        billingCurrency: operatingCurrency,
        payrollCountryCode: payroll.code,
        payrollCountry: payroll.name,
        payrollRegion: payroll.region,
        payrollCurrency,
        timeZone,
        language,
        dateFormat,
        taxYear,
        defaultComplianceRulePack: compliancePack,
        globalPayrollReady: true,
        globalComplianceReady: true,
        globalSettingsUpdatedAt: serverTimestamp(),
        globalSettingsUpdatedBy: currentUser.uid,
      }, { merge: true });
      setMessage('Company Country & Currency Settings saved. Payroll and compliance can now use this company profile.');
    } catch (error: any) {
      setMessage(`Unable to save global settings: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="settings-tab">
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900">SaaS Settings</h2>
        <p className="text-xs text-slate-500">Configure company identity, country, currency, payroll jurisdiction, tax year and global compliance defaults.</p>
      </div>
      {message && <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}
      <div className="border-b border-slate-200 flex flex-wrap gap-4">
        {[
          ['global', 'Global Setup', Globe2],
          ['profile', 'Company Profile', Building2],
          ['subscription', 'Subscription', CreditCard],
          ['security', 'Security', ShieldCheck],
        ].map(([id, label, Icon]: any) => <button key={id} onClick={() => setActiveTab(id)} className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Icon className="w-4 h-4" />{label}</button>)}
      </div>
      {activeTab === 'global' && <div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5"><h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><Globe2 className="w-4 h-4 text-brand-600" />Company Country & Currency Settings</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"><Field label="Operating Country"><select value={operatingCountryCode} onChange={(event) => applyOperatingCountry(event.target.value)} disabled={!canEdit} className="input-field">{countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></Field><Field label="Payroll Country"><select value={payrollCountryCode} onChange={(event) => applyPayrollCountry(event.target.value)} disabled={!canEdit} className="input-field">{countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></Field><Field label="Operating Currency"><input value={operatingCurrency} onChange={(event) => setOperatingCurrency(event.target.value.toUpperCase())} disabled={!canEdit} className="input-field" /></Field><Field label="Payroll Currency"><input value={payrollCurrency} onChange={(event) => setPayrollCurrency(event.target.value.toUpperCase())} disabled={!canEdit} className="input-field" /></Field><Field label="Time Zone"><input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} disabled={!canEdit} className="input-field" /></Field><Field label="Language"><input value={language} onChange={(event) => setLanguage(event.target.value)} disabled={!canEdit} className="input-field" /></Field><Field label="Date Format"><select value={dateFormat} onChange={(event) => setDateFormat(event.target.value)} disabled={!canEdit} className="input-field"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY/MM/DD</option><option>YYYY-MM-DD</option></select></Field><Field label="Tax Year"><select value={taxYear} onChange={(event) => setTaxYear(event.target.value)} disabled={!canEdit} className="input-field">{taxYearOptions.map((item) => <option key={item}>{item}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Default Compliance Rule Pack"><textarea value={compliancePack} onChange={(event) => setCompliancePack(event.target.value)} disabled={!canEdit} rows={3} className="input-field" /></Field></div></div><button onClick={saveGlobalSettings} disabled={!canEdit || loading} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold">{loading ? 'Saving...' : 'Save Global Setup'}</button></div><div className="bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 space-y-4"><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-200 font-black">Company Global Profile</p><Summary label="Operating Country" value={countries.find((item) => item.code === operatingCountryCode)?.name || operatingCountryCode} /><Summary label="Payroll Country" value={countries.find((item) => item.code === payrollCountryCode)?.name || payrollCountryCode} /><Summary label="Operating Currency" value={operatingCurrency} /><Summary label="Payroll Currency" value={payrollCurrency} /><Summary label="Tax Year" value={taxYear} /></div></div>}
      {activeTab === 'profile' && <form onSubmit={saveProfile} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-3xl text-xs"><h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-brand-600" />Corporate Identity</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Company Registered Name"><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={!canEdit} required className="input-field" /></Field><Field label="Industry"><input value={industry} onChange={(event) => setIndustry(event.target.value)} disabled={!canEdit} className="input-field" /></Field></div><Field label="Billing Email"><input type="email" value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} disabled={!canEdit} className="input-field" /></Field><button disabled={!canEdit || loading} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold">Save Company Profile</button></form>}
      {activeTab === 'subscription' && <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-3xl"><h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-brand-600" />Subscription Overview</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4"><SummaryCard label="Current Plan" value={subscriptionPlan} /><SummaryCard label="Status" value={subscriptionStatus} /></div><p className="text-[11px] text-slate-500 mt-4">Provider credentials should be managed through secured server-side settings before production payment activation.</p></div>}
      {activeTab === 'security' && <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-3xl"><h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><Lock className="w-4 h-4 text-brand-600" />Security & Access</h3><p className="text-xs text-slate-500 mt-2">This panel will later control payroll access restrictions, approval rights, employee payslip access and tenant isolation checks.</p></div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">{label}</span>{children}</label>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/10 border border-white/10 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-300 font-black">{label}</p><p className="text-sm font-bold mt-1">{value}</p></div>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">{label}</p><p className="text-lg font-black text-slate-900 mt-1">{value}</p></div>;
}
