import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle2, Edit3, Plus, Save, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { UserRole } from '../types';
import { defaultPayrollRuleProfiles, getDefaultRuleProfile, PayrollRuleProfile, TaxBand } from '../lib/payrollRuleProfiles';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

export default function PayrollRuleBuilder({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canEdit = ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer'].includes(currentUser.role);
  const [countryCode, setCountryCode] = useState('NG');
  const [profile, setProfile] = useState<PayrollRuleProfile>(getDefaultRuleProfile('NG'));
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [complianceText, setComplianceText] = useState(getDefaultRuleProfile('NG').complianceRules.join(', '));

  useEffect(() => {
    async function loadProfile() {
      if (!companyId) return;
      setLoading(true);
      setMessage('');
      try {
        const fallback = getDefaultRuleProfile(countryCode);
        const snap = await getDoc(doc(db, `companies/${companyId}/payroll_rule_profiles`, countryCode));
        const loaded = snap.exists() ? { ...fallback, ...(snap.data() as PayrollRuleProfile) } : fallback;
        setProfile(loaded);
        setComplianceText((loaded.complianceRules || []).join(', '));
      } catch (error: any) {
        setMessage(`Unable to load payroll rule profile: ${error.message || error}`);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [companyId, countryCode]);

  const updateField = (field: keyof PayrollRuleProfile, value: any) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const updateBand = (index: number, field: keyof TaxBand, value: number) => {
    setProfile((current) => ({ ...current, taxBands: current.taxBands.map((band, itemIndex) => itemIndex === index ? { ...band, [field]: value } : band) }));
  };

  const addBand = () => {
    setProfile((current) => ({ ...current, taxBands: [...current.taxBands, { limit: 0, rate: 0 }] }));
  };

  const removeBand = (index: number) => {
    setProfile((current) => ({ ...current, taxBands: current.taxBands.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const resetToDefault = () => {
    const fallback = getDefaultRuleProfile(countryCode);
    setProfile(fallback);
    setComplianceText(fallback.complianceRules.join(', '));
    setMessage('Default rule profile restored locally. Click Save Rule Profile to publish it.');
  };

  const saveProfile = async () => {
    if (!companyId || !canEdit) return;
    setLoading(true);
    setMessage('');
    const normalized: PayrollRuleProfile = {
      ...profile,
      countryCode,
      employeeSocialRate: Number(profile.employeeSocialRate || 0),
      employerSocialRate: Number(profile.employerSocialRate || 0),
      healthHousingRate: Number(profile.healthHousingRate || 0),
      reliefRate: Number(profile.reliefRate || 0),
      fixedAnnualRelief: Number(profile.fixedAnnualRelief || 0),
      taxBands: profile.taxBands.map((band) => ({ limit: Number(band.limit || 0), rate: Number(band.rate || 0) })),
      complianceRules: complianceText.split(',').map((item) => item.trim()).filter(Boolean),
    };

    try {
      await setDoc(doc(db, `companies/${companyId}/payroll_rule_profiles`, countryCode), {
        ...normalized,
        isCustom: true,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      }, { merge: true });
      setProfile(normalized);
      setMessage(`${normalized.country} payroll rule profile saved successfully.`);
    } catch (error: any) {
      setMessage(`Unable to save payroll rule profile: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5" id="payroll-rule-builder">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Item 2</p>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Edit3 className="w-5 h-5 text-indigo-600" />Editable Payroll Rule Builder</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">Configure tax bands, statutory contribution rates, reliefs, currencies and rule packs by country. Saved profiles are stored per company and can be used by the Global Payroll Engine.</p>
        </div>
        <div className="flex gap-2">
          <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white">
            {defaultPayrollRuleProfiles.map((item) => <option key={item.countryCode} value={item.countryCode}>{item.country}</option>)}
          </select>
          <button onClick={resetToDefault} disabled={!canEdit} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Reset</button>
        </div>
      </div>

      {message && <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
        <Field label="Country"><input value={profile.country} onChange={(event) => updateField('country', event.target.value)} disabled={!canEdit} className="input-field" /></Field>
        <Field label="Region"><input value={profile.region} onChange={(event) => updateField('region', event.target.value)} disabled={!canEdit} className="input-field" /></Field>
        <Field label="Currency"><input value={profile.currency} onChange={(event) => updateField('currency', event.target.value.toUpperCase())} disabled={!canEdit} className="input-field" /></Field>
        <Field label="Tax Label"><input value={profile.taxLabel} onChange={(event) => updateField('taxLabel', event.target.value)} disabled={!canEdit} className="input-field" /></Field>
        <Field label="Employee Social Rate"><input type="number" step="0.001" value={profile.employeeSocialRate} onChange={(event) => updateField('employeeSocialRate', Number(event.target.value))} disabled={!canEdit} className="input-field" /></Field>
        <Field label="Employer Social Rate"><input type="number" step="0.001" value={profile.employerSocialRate} onChange={(event) => updateField('employerSocialRate', Number(event.target.value))} disabled={!canEdit} className="input-field" /></Field>
        <Field label="Health / Housing Rate"><input type="number" step="0.001" value={profile.healthHousingRate} onChange={(event) => updateField('healthHousingRate', Number(event.target.value))} disabled={!canEdit} className="input-field" /></Field>
        <Field label="Relief Rate"><input type="number" step="0.001" value={profile.reliefRate} onChange={(event) => updateField('reliefRate', Number(event.target.value))} disabled={!canEdit} className="input-field" /></Field>
        <Field label="Fixed Annual Relief"><input type="number" value={profile.fixedAnnualRelief} onChange={(event) => updateField('fixedAnnualRelief', Number(event.target.value))} disabled={!canEdit} className="input-field" /></Field>
        <div className="lg:col-span-3"><Field label="Compliance Rules"><textarea value={complianceText} onChange={(event) => setComplianceText(event.target.value)} disabled={!canEdit} rows={2} className="input-field" /></Field></div>
      </div>

      <div className="border border-slate-100 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
          <div><p className="text-xs font-black text-slate-900">Progressive Tax Bands</p><p className="text-[10px] text-slate-500">Use limit 0 for the final unlimited band.</p></div>
          <button onClick={addBand} disabled={!canEdit} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4" />Add Band</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Band</th><th className="text-right p-3">Limit</th><th className="text-right p-3">Rate</th><th className="text-right p-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{profile.taxBands.map((band, index) => <tr key={index}><td className="p-3 font-bold text-slate-700">Band {index + 1}</td><td className="p-3 text-right"><input type="number" value={band.limit} onChange={(event) => updateBand(index, 'limit', Number(event.target.value))} disabled={!canEdit} className="input-field text-right" /></td><td className="p-3 text-right"><input type="number" step="0.001" value={band.rate} onChange={(event) => updateBand(index, 'rate', Number(event.target.value))} disabled={!canEdit} className="input-field text-right" /></td><td className="p-3 text-right"><button onClick={() => removeBand(index)} disabled={!canEdit || profile.taxBands.length <= 1} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:text-slate-300"><Trash2 className="w-4 h-4" />Remove</button></td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={saveProfile} disabled={!canEdit || loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-2"><Save className="w-4 h-4" />{loading ? 'Saving...' : 'Save Rule Profile'}</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">{label}</span>{children}</label>;
}
