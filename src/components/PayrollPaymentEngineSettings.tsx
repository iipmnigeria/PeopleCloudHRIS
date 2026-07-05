import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Banknote, CheckCircle2, CreditCard, KeyRound, ShieldCheck, WalletCards } from 'lucide-react';
import { db } from '../firebase';
import { UserRole } from '../types';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type Provider = 'Manual Bank Export' | 'Paystack' | 'Flutterwave' | 'Interswitch' | 'Bank API';

const providers: Array<{ name: Provider; note: string; readiness: string }> = [
  { name: 'Manual Bank Export', note: 'Generate bank-ready payment schedules while live API payments are disabled.', readiness: 'Available Now' },
  { name: 'Paystack', note: 'Prepare payroll batches for Paystack Transfers through secure backend functions.', readiness: 'API Ready' },
  { name: 'Flutterwave', note: 'Prepare payroll batches for Flutterwave payouts and transfer reconciliation.', readiness: 'API Ready' },
  { name: 'Interswitch', note: 'Enterprise option for bank-grade payout processing and reconciliation.', readiness: 'Enterprise' },
  { name: 'Bank API', note: 'Custom direct bank integration for enterprise clients with banking API access.', readiness: 'Custom' },
];

export default function PayrollPaymentEngineSettings({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canEdit = ['SuperAdmin', 'CompanyAdmin'].includes(String(currentUser.role));
  const [provider, setProvider] = useState<Provider>('Manual Bank Export');
  const [mode, setMode] = useState<'Test' | 'Live'>('Test');
  const [currency, setCurrency] = useState('NGN');
  const [businessName, setBusinessName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [secretKeyReference, setSecretKeyReference] = useState('');
  const [fundingSource, setFundingSource] = useState('Provider Wallet / Transfer Balance');
  const [authorizationMode, setAuthorizationMode] = useState('Finance prepares, CompanyAdmin authorizes');
  const [requireDualApproval, setRequireDualApproval] = useState(true);
  const [verifyRecipients, setVerifyRecipients] = useState(true);
  const [enableLivePayments, setEnableLivePayments] = useState(false);
  const [backendSecretsReady, setBackendSecretsReady] = useState(false);
  const [webhookConfirmed, setWebhookConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const webhookUrl = useMemo(() => `${window.location.origin}/api/payroll-payments/webhook/${String(provider).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, [provider]);
  const readiness = useMemo(() => {
    if (provider === 'Manual Bank Export') return 'Ready for manual salary schedule export.';
    if (!backendSecretsReady) return 'Waiting for backend secret configuration.';
    if (!webhookConfirmed) return 'Waiting for webhook confirmation.';
    if (!enableLivePayments) return 'Test mode ready. Live payments are disabled.';
    return 'Payment engine ready for controlled live payroll disbursement.';
  }, [provider, backendSecretsReady, webhookConfirmed, enableLivePayments]);

  useEffect(() => {
    async function load() {
      if (!companyId) return;
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, `companies/${companyId}/payroll_payment_settings`, 'default'));
        if (snap.exists()) {
          const data = snap.data() as any;
          setProvider(data.provider || 'Manual Bank Export');
          setMode(data.mode || 'Test');
          setCurrency(data.currency || 'NGN');
          setBusinessName(data.businessName || '');
          setPublicKey(data.publicKey || '');
          setSecretKeyReference(data.secretKeyReference || '');
          setFundingSource(data.fundingSource || 'Provider Wallet / Transfer Balance');
          setAuthorizationMode(data.authorizationMode || 'Finance prepares, CompanyAdmin authorizes');
          setRequireDualApproval(data.requireDualApproval ?? true);
          setVerifyRecipients(data.verifyRecipients ?? true);
          setEnableLivePayments(data.enableLivePayments ?? false);
          setBackendSecretsReady(data.backendSecretsReady ?? false);
          setWebhookConfirmed(data.webhookConfirmed ?? false);
        }
      } catch (error: any) {
        setMessage(`Unable to load payroll payment setup: ${error.message || error}`);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  async function save() {
    if (!companyId || !canEdit) return;
    setLoading(true);
    setMessage('');
    try {
      await setDoc(doc(db, `companies/${companyId}/payroll_payment_settings`, 'default'), {
        provider,
        mode,
        currency,
        businessName,
        publicKey,
        secretKeyReference,
        fundingSource,
        authorizationMode,
        requireDualApproval,
        verifyRecipients,
        enableLivePayments,
        backendSecretsReady,
        webhookConfirmed,
        webhookUrl,
        readiness,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      }, { merge: true });
      setMessage('Payroll Payment Engine setup saved successfully. Approved payroll can now use this configuration when payment processing is activated.');
    } catch (error: any) {
      setMessage(`Unable to save payroll payment setup: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  return <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5" id="payroll-payment-engine-settings"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Enterprise Payroll Payments</p><h3 className="font-black text-slate-900 text-base flex items-center gap-2"><WalletCards className="w-5 h-5 text-brand-600" />Payroll Payment Engine Setup</h3><p className="text-xs text-slate-500 mt-1">Let each company choose its payroll payment platform, setup authorization controls, and prepare approved payroll for secure disbursement.</p></div><span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black">{readiness}</span></div>{message && <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}<div className="grid grid-cols-1 lg:grid-cols-5 gap-3">{providers.map((item) => <button type="button" key={item.name} onClick={() => setProvider(item.name)} disabled={!canEdit} className={`text-left rounded-2xl border p-4 transition-all ${provider === item.name ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-black text-slate-900">{item.name}</p><span className="text-[9px] font-black text-indigo-600 bg-white/70 px-2 py-0.5 rounded-full">{item.readiness}</span></div><p className="text-[10px] text-slate-500 mt-2 leading-relaxed">{item.note}</p></button>)}</div><div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><div className="xl:col-span-2 space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"><Field label="Selected Platform"><input value={provider} disabled className="input-field" /></Field><Field label="Environment"><select value={mode} onChange={(e) => setMode(e.target.value as 'Test' | 'Live')} disabled={!canEdit} className="input-field"><option>Test</option><option>Live</option></select></Field><Field label="Payroll Payment Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} disabled={!canEdit} className="input-field" /></Field><Field label="Business / Merchant Name"><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={!canEdit} placeholder="Company payment profile name" className="input-field" /></Field><Field label="Public Key / Merchant ID"><input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} disabled={!canEdit || provider === 'Manual Bank Export'} placeholder="Public key, merchant ID or integration reference" className="input-field" /></Field><Field label="Secret Key Reference"><input value={secretKeyReference} onChange={(e) => setSecretKeyReference(e.target.value)} disabled={!canEdit || provider === 'Manual Bank Export'} placeholder="Example: firebase-secret-paystack-live" className="input-field" /></Field><Field label="Funding Source"><input value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} disabled={!canEdit} className="input-field" /></Field><Field label="Authorization Workflow"><select value={authorizationMode} onChange={(e) => setAuthorizationMode(e.target.value)} disabled={!canEdit} className="input-field"><option>Finance prepares, CompanyAdmin authorizes</option><option>HR prepares, Finance authorizes</option><option>HR prepares, Finance reviews, CompanyAdmin authorizes</option><option>Enterprise maker-checker approval</option></select></Field><div className="md:col-span-2"><Field label="Webhook URL"><input value={webhookUrl} readOnly className="input-field bg-slate-50" /></Field><p className="text-[10px] text-slate-400 mt-1">Use this as the provider webhook destination when the backend endpoint is deployed.</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"><Toggle label="Require dual approval before salary payment" value={requireDualApproval} setValue={setRequireDualApproval} disabled={!canEdit} /><Toggle label="Verify employee bank recipients before payment" value={verifyRecipients} setValue={setVerifyRecipients} disabled={!canEdit} /><Toggle label="Backend secrets have been configured securely" value={backendSecretsReady} setValue={setBackendSecretsReady} disabled={!canEdit || provider === 'Manual Bank Export'} /><Toggle label="Webhook has been configured and tested" value={webhookConfirmed} setValue={setWebhookConfirmed} disabled={!canEdit || provider === 'Manual Bank Export'} /><Toggle label="Enable live payroll payment processing" value={enableLivePayments} setValue={setEnableLivePayments} disabled={!canEdit || provider === 'Manual Bank Export' || mode !== 'Live'} /></div><button onClick={save} disabled={!canEdit || loading} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-black">{loading ? 'Saving...' : 'Save Payment Setup'}</button></div><div className="bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 space-y-4"><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-200 font-black">Seamless Setup Checklist</p><Checklist icon={<CreditCard className="w-4 h-4" />} title="Choose Platform" done={!!provider} text="Select Paystack, Flutterwave, Interswitch, Bank API or Manual Export." /><Checklist icon={<KeyRound className="w-4 h-4" />} title="Secure Credentials" done={provider === 'Manual Bank Export' || backendSecretsReady} text="Live secret keys must be configured on the backend, not inside the browser app." /><Checklist icon={<Banknote className="w-4 h-4" />} title="Recipient Verification" done={verifyRecipients} text="Confirm employee bank account readiness before payments are released." /><Checklist icon={<ShieldCheck className="w-4 h-4" />} title="Approval Control" done={requireDualApproval} text="Maker-checker workflow protects approved payroll from accidental payment." /><div className="rounded-xl bg-white/10 border border-white/10 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-300 font-black">Payment Status</p><p className="text-sm font-bold mt-1">{readiness}</p></div></div></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">{label}</span>{children}</label>;
}

function Toggle({ label, value, setValue, disabled }: { label: string; value: boolean; setValue: (v: boolean) => void; disabled?: boolean }) {
  return <label className={`flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 ${disabled ? 'opacity-60' : ''}`}><span className="text-xs font-bold text-slate-700">{label}</span><input type="checkbox" checked={value} onChange={(e) => setValue(e.target.checked)} disabled={disabled} className="w-4 h-4" /></label>;
}

function Checklist({ icon, title, text, done }: { icon: React.ReactNode; title: string; text: string; done: boolean }) {
  return <div className="flex gap-3 rounded-xl bg-white/10 border border-white/10 p-3"><div className={done ? 'text-emerald-300' : 'text-slate-500'}>{icon}</div><div><p className="text-xs font-black text-white">{title}</p><p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{text}</p></div></div>;
}
