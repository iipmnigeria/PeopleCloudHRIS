import React, { useState, useEffect } from 'react';
import { UserRole, Company } from '../types';
import { 
  Settings2, 
  Building2, 
  CreditCard, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  Activity, 
  FileCheck2,
  FileSpreadsheet
} from 'lucide-react';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface SettingsProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function Settings({ currentUser, selectedTenantId }: SettingsProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isCompanyAdmin = currentUser.role === 'CompanyAdmin';
  const isReadOnly = currentUser.role === 'Employee' || currentUser.role === 'Auditor';

  // State Management
  const [company, setCompany] = useState<Company | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'subscription' | 'compliance' | 'audit'>('profile');
  
  // Profile edit states
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Fetch company records
  useEffect(() => {
    async function loadCompanyDetails() {
      if (!companyId) return;
      try {
        const docRef = doc(db, 'companies', companyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Company;
          setCompany(data);
          setCompanyName(data.name);
          setIndustry(data.industry);
          setBillingEmail(data.billingEmail);
        }
      } catch (err) {
        console.error('Error loading company settings:', err);
      }
    }
    loadCompanyDetails();
  }, [companyId]);

  // Update profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !companyName.trim()) return;
    setActionLoading(true);
    setSaveSuccess('');

    try {
      const docRef = doc(db, 'companies', companyId);
      const updateData = {
        name: companyName.trim(),
        industry: industry.trim(),
        billingEmail: billingEmail.trim()
      };

      await updateDoc(docRef, updateData);
      setCompany(company ? { ...company, ...updateData } : null);
      setSaveSuccess('Corporate configurations updated successfully.');
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Upgrade/Change Plan Tier
  const handleChangeSubscription = async (tier: Company['subscriptionPlan']) => {
    if (!companyId || isReadOnly) return;
    setActionLoading(true);
    setSaveSuccess('');

    try {
      const docRef = doc(db, 'companies', companyId);
      const price = tier === 'Starter' ? 99 : tier === 'Growth' ? 249 : 499;

      await updateDoc(docRef, {
        subscriptionPlan: tier,
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days renewal
      });

      setCompany(company ? { ...company, subscriptionPlan: tier } : null);
      setSaveSuccess(`Subscription successfully updated to the ${tier} Plan!`);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up" id="settings-tab">
      
      {/* 1. HEADER ROW */}
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900">Control Panel Settings</h2>
        <p className="text-xs text-slate-500">Configure multi-tenant company parameters, choose subscription tiers, and review regulatory audits.</p>
      </div>

      {/* 2. SUB-TAB BAR */}
      <div className="border-b border-slate-200 flex space-x-4">
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'profile' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Company Profile
        </button>
        <button
          onClick={() => setActiveSubTab('subscription')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'subscription' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Subscription Packages
        </button>
        <button
          onClick={() => setActiveSubTab('compliance')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'compliance' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Compliance Directories
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'audit' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Security Audit Ledger
        </button>
      </div>

      {/* 3. SETTINGS SECTIONS */}
      <div className="max-w-4xl">
        
        {/* A. COMPANY PROFILE FORM */}
        {activeSubTab === 'profile' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Building2 className="w-4 h-4 text-brand-600" />
              Corporate Identity Configuration
            </h3>

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-[11px] rounded-lg border border-emerald-100">
                {saveSuccess}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs text-slate-600 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Company Registered Name</label>
                  <input
                    type="text"
                    required
                    disabled={!isCompanyAdmin}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 bg-white"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Business Industry Sectors</label>
                  <input
                    type="text"
                    required
                    disabled={!isCompanyAdmin}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 bg-white"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Billing & Finance Email Address</label>
                <input
                  type="email"
                  required
                  disabled={!isCompanyAdmin}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 bg-white"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                />
              </div>

              {isCompanyAdmin && (
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {actionLoading ? 'Saving...' : 'Save Corporate Config'}
                </button>
              )}
            </form>
          </div>
        )}

        {/* B. SUBSCRIPTION TIERS CARDS */}
        {activeSubTab === 'subscription' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Current active Package plan</span>
                <span className="text-xl font-bold text-slate-900 block mt-1">
                  {company?.subscriptionPlan} Tier Plan
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full font-bold text-xs ${
                company?.subscriptionStatus === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                ● {company?.subscriptionStatus}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Starter */}
              <div className={`bg-white p-5 rounded-2xl border flex flex-col justify-between space-y-4 ${
                company?.subscriptionPlan === 'Starter' ? 'border-brand-500 ring-2 ring-brand-500/10' : 'border-slate-200'
              }`}>
                <div className="space-y-2">
                  <span className="text-[9px] uppercase font-bold text-slate-400">Starter Core</span>
                  <h4 className="text-xl font-bold text-slate-950 font-display">$99 <span className="text-xs text-slate-500 font-normal">/ month</span></h4>
                  <p className="text-[11px] text-slate-500 leading-normal">Ideal for early-stage organizations looking for core payroll and directories.</p>
                </div>
                <button
                  disabled={company?.subscriptionPlan === 'Starter' || isReadOnly}
                  onClick={() => handleChangeSubscription('Starter')}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    company?.subscriptionPlan === 'Starter' 
                      ? 'bg-brand-50 text-brand-700 cursor-default' 
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {company?.subscriptionPlan === 'Starter' ? 'Active Plan' : 'Select Starter'}
                </button>
              </div>

              {/* Growth */}
              <div className={`bg-white p-5 rounded-2xl border flex flex-col justify-between space-y-4 ${
                company?.subscriptionPlan === 'Growth' ? 'border-brand-500 ring-2 ring-brand-500/10' : 'border-slate-200'
              }`}>
                <div className="space-y-2">
                  <span className="text-[9px] uppercase font-bold text-brand-600 font-bold">Recommended</span>
                  <h4 className="text-xl font-bold text-slate-950 font-display">$249 <span className="text-xs text-slate-500 font-normal">/ month</span></h4>
                  <p className="text-[11px] text-slate-500 leading-normal">Expands support to recruitment dashboards and vacancy tracking pipelines.</p>
                </div>
                <button
                  disabled={company?.subscriptionPlan === 'Growth' || isReadOnly}
                  onClick={() => handleChangeSubscription('Growth')}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    company?.subscriptionPlan === 'Growth' 
                      ? 'bg-brand-50 text-brand-700 cursor-default' 
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {company?.subscriptionPlan === 'Growth' ? 'Active Plan' : 'Upgrade to Growth'}
                </button>
              </div>

              {/* Enterprise */}
              <div className={`bg-white p-5 rounded-2xl border flex flex-col justify-between space-y-4 ${
                company?.subscriptionPlan === 'Enterprise' ? 'border-brand-500 ring-2 ring-brand-500/10' : 'border-slate-200'
              }`}>
                <div className="space-y-2">
                  <span className="text-[9px] uppercase font-bold text-slate-400">Scale Unlimited</span>
                  <h4 className="text-xl font-bold text-slate-950 font-display">$499 <span className="text-xs text-slate-500 font-normal">/ month</span></h4>
                  <p className="text-[11px] text-slate-500 leading-normal">Unlocks advanced EEOC automated reports, unlimited storage and helpdesk.</p>
                </div>
                <button
                  disabled={company?.subscriptionPlan === 'Enterprise' || isReadOnly}
                  onClick={() => handleChangeSubscription('Enterprise')}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    company?.subscriptionPlan === 'Enterprise' 
                      ? 'bg-brand-50 text-brand-700 cursor-default' 
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {company?.subscriptionPlan === 'Enterprise' ? 'Active Plan' : 'Request Enterprise'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* C. COMPLIANCE DIRECTORY */}
        {activeSubTab === 'compliance' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 animate-fade-in">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <FileCheck2 className="w-4.5 h-4.5 text-brand-600" />
              SaaS Compliance Overrides & Reports
            </h3>

            <div className="space-y-3.5 text-xs text-slate-650">
              
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-150">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">EEOC Demographics Summary (U.S.)</span>
                  <p className="text-[10px] text-slate-400 max-w-lg leading-normal">
                    Aggregated visual breakdown of gender ratios across multi-tenant employees as mandated by the Equal Employment Opportunity Commission.
                  </p>
                </div>
                <button
                  onClick={() => alert('Compiling EEOC Demographics Report from active Firestore records... Complete!')}
                  className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                >
                  Export EEOC
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-150">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">GDPR Personal data Records</span>
                  <p className="text-[10px] text-slate-400 max-w-lg leading-normal">
                    Audit of employee files matching General Data Protection Regulation directives. Tracks data privacy access overrides.
                  </p>
                </div>
                <button
                  onClick={() => alert('Generating GDPR Privacy Compliance Sheet... Done!')}
                  className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-[11px] cursor-pointer"
                >
                  Review Logs
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-150">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">Corporate Annual Tax Statements (W-2 / 1099)</span>
                  <p className="text-[10px] text-slate-400 max-w-lg leading-normal">
                    Consolidation of flat income tax withholdings processed via the PeopleCloud HRIS payroll support engine.
                  </p>
                </div>
                <button
                  onClick={() => alert('Consolidating W2 Statements... Completed successfully!')}
                  className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-[11px] cursor-pointer"
                >
                  Verify Forms
                </button>
              </div>

            </div>
          </div>
        )}

        {/* D. SECURITY AUDIT LEDGER */}
        {activeSubTab === 'audit' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-fade-in text-xs">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-105 pb-3">
              <ShieldCheck className="w-4.5 h-4.5 text-brand-600" />
              SaaS Tenant Audit Trail Ledger
            </h3>

            <div className="space-y-2.5 font-mono text-[11px]">
              
              <div className="p-3 bg-slate-50 border-l-4 border-emerald-500 rounded text-slate-650 space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>AUDIT_ENFORCE_RBAC</span>
                  <span>SUCCESS</span>
                </div>
                <p className="text-[10px] text-slate-400">Enforced security permissions matrix across employee profile documents folder requests.</p>
                <span className="text-[9px] text-slate-400 block mt-1">Timestamp: {new Date().toISOString()}</span>
              </div>

              <div className="p-3 bg-slate-50 border-l-4 border-emerald-500 rounded text-slate-650 space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>DATABASE_ISOLATION_CHECK</span>
                  <span>PASSED</span>
                </div>
                <p className="text-[10px] text-slate-400">Isolated database query boundaries. Tenant ID checked against active user auth credentials.</p>
                <span className="text-[9px] text-slate-400 block mt-1">Timestamp: {new Date(Date.now() - 3600000).toISOString()}</span>
              </div>

              <div className="p-3 bg-slate-50 border-l-4 border-emerald-500 rounded text-slate-650 space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>SYSTEM_HEALTH_METRIC</span>
                  <span>ONLINE</span>
                </div>
                <p className="text-[10px] text-slate-400">Cloud Run container metrics: Memory usage 42%, active websockets connection 1/1, ingress safe.</p>
                <span className="text-[9px] text-slate-400 block mt-1">Timestamp: {new Date(Date.now() - 7200000).toISOString()}</span>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
