import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { 
  Briefcase, 
  Plus, 
  Check, 
  X, 
  DollarSign, 
  CalendarDays, 
  UserCheck, 
  Users, 
  Coins, 
  FileCheck2, 
  SlidersHorizontal,
  PlusCircle,
  FileSignature,
  FileText
} from 'lucide-react';
import { collection, getDocs, addDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface ContractorEngineProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

interface Contractor {
  id: string;
  name: string;
  companyName: string;
  email: string;
  specialization: string;
  billingModel: 'Hourly' | 'Retainer' | 'Fixed_Project';
  rate: number; // Retainer per month or hourly rate
  currency: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Completed' | 'Suspended';
  taxId: string;
  budgetCap: number;
}

interface Milestone {
  id: string;
  contractorId: string;
  contractorName: string;
  title: string;
  amount: number;
  dueDate: string;
  status: 'Pending' | 'Completed' | 'Paid';
}

export default function ContractorEngine({ currentUser, selectedTenantId }: ContractorEngineProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isManager = ['CompanyAdmin', 'HRManager', 'FinanceOfficer'].includes(currentUser.role);

  // States
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeTab, setActiveTab] = useState<'contractors' | 'milestones-billing'>('contractors');

  // Form state for creating a contractor
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [cCompany, setCCompany] = useState('');
  const [email, setEmail] = useState('');
  const [spec, setSpec] = useState('');
  const [billing, setBilling] = useState<'Hourly' | 'Retainer' | 'Fixed_Project'>('Retainer');
  const [rate, setRate] = useState(1500);
  const [budgetCap, setBudgetCap] = useState(10000);
  const [startD, setStartD] = useState('');
  const [endD, setEndD] = useState('');
  const [taxId, setTaxId] = useState('');

  // Form state for new milestone
  const [selectedContrId, setSelectedContrId] = useState('');
  const [mTitle, setMTitle] = useState('');
  const [mAmount, setMAmount] = useState(500);
  const [mDueDate, setMDueDate] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Fetch contractors and milestones from Firestore
  useEffect(() => {
    async function loadContractors() {
      if (!companyId) return;
      try {
        const contSnap = await getDocs(collection(db, `companies/${companyId}/contractors`));
        const contList: Contractor[] = [];
        contSnap.forEach(d => contList.push({ ...d.data() as Contractor, id: d.id }));

        if (contList.length === 0) {
          // Seed standard contractors
          const seeded: Contractor[] = [
            {
              id: 'cont-1',
              name: 'Olanrewaju Alao',
              companyName: 'Alao Cyber Security Ltd',
              email: 'olanrewaju@alaocyber.com',
              specialization: 'Information Security Consultant',
              billingModel: 'Retainer',
              rate: 3500,
              currency: 'USD',
              startDate: '2026-01-01',
              endDate: '2026-12-31',
              status: 'Active',
              taxId: 'RC-9941033',
              budgetCap: 42000
            },
            {
              id: 'cont-2',
              name: 'Sarah Jenkins',
              companyName: 'Apex Creative Solutions',
              email: 'sarah@apexdesign.co',
              specialization: 'Senior UI/UX Contractor',
              billingModel: 'Hourly',
              rate: 75,
              currency: 'USD',
              startDate: '2026-05-10',
              endDate: '2026-08-10',
              status: 'Active',
              taxId: 'US-994012',
              budgetCap: 15000
            }
          ];
          for (const item of seeded) {
            await setDoc(doc(db, `companies/${companyId}/contractors`, item.id), item);
          }
          setContractors(seeded);
        } else {
          setContractors(contList);
        }

        // Fetch milestones
        const mileSnap = await getDocs(collection(db, `companies/${companyId}/contractorMilestones`));
        const mileList: Milestone[] = [];
        mileSnap.forEach(d => mileList.push({ ...d.data() as Milestone, id: d.id }));

        if (mileList.length === 0) {
          const seededMilestones: Milestone[] = [
            {
              id: 'mile-1',
              contractorId: 'cont-1',
              contractorName: 'Olanrewaju Alao',
              title: 'Quarterly Infrastructure Pentest Report',
              amount: 3500,
              dueDate: '2026-06-30',
              status: 'Completed'
            },
            {
              id: 'mile-2',
              contractorId: 'cont-2',
              contractorName: 'Sarah Jenkins',
              title: 'Interactive Onboarding Canvas Prototype',
              amount: 2500,
              dueDate: '2026-07-15',
              status: 'Pending'
            }
          ];
          for (const item of seededMilestones) {
            await setDoc(doc(db, `companies/${companyId}/contractorMilestones`, item.id), item);
          }
          setMilestones(seededMilestones);
        } else {
          setMilestones(mileList);
        }
      } catch (err) {
        console.error('Error loading contractor ledger:', err);
      }
    }
    loadContractors();
  }, [companyId]);

  // Create Contractor Account
  const handleCreateContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    try {
      const cId = `cont-${Date.now()}`;
      const newContr: Contractor = {
        id: cId,
        name,
        companyName: cCompany || 'Independent Practice',
        email,
        specialization: spec,
        billingModel: billing,
        rate,
        currency: 'USD',
        startDate: startD,
        endDate: endD,
        status: 'Active',
        taxId,
        budgetCap
      };

      await setDoc(doc(db, `companies/${companyId}/contractors`, cId), newContr);
      setContractors([newContr, ...contractors]);
      setIsCreating(false);
      
      // Clear forms
      setName('');
      setCCompany('');
      setEmail('');
      setSpec('');
      setRate(1500);
      setBudgetCap(10000);
      setStartD('');
      setEndD('');
      setTaxId('');
    } catch (err) {
      console.error('Failed to register contractor:', err);
    }
  };

  // Add Milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !selectedContrId) return;

    const contr = contractors.find(c => c.id === selectedContrId);
    if (!contr) return;

    try {
      const mId = `mile-${Date.now()}`;
      const newMilestone: Milestone = {
        id: mId,
        contractorId: selectedContrId,
        contractorName: contr.name,
        title: mTitle,
        amount: mAmount,
        dueDate: mDueDate,
        status: 'Pending'
      };

      await setDoc(doc(db, `companies/${companyId}/contractorMilestones`, mId), newMilestone);
      setMilestones([newMilestone, ...milestones]);
      setFormSuccess('New contract milestone and voucher registered successfully.');
      setMTitle('');
      setMAmount(500);
      setMDueDate('');
      setTimeout(() => setFormSuccess(''), 5000);
    } catch (err) {
      console.error('Error registering milestone:', err);
    }
  };

  // Transition Milestone Status
  const handleTransitionMilestone = async (mId: string, status: 'Completed' | 'Paid') => {
    try {
      const docRef = doc(db, `companies/${companyId}/contractorMilestones`, mId);
      await updateDoc(docRef, { status });
      setMilestones(milestones.map(m => m.id === mId ? { ...m, status } : m));
    } catch (err) {
      console.error('Failed to change milestone status:', err);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="space-y-6 animate-slide-up" id="contractor-consultant-engine">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900">Contractor & Consultant workspace</h2>
          <p className="text-xs text-slate-500">Oversee third-party vendors, specialized consultants, and hourly contracts. Track deliverables, manage billing limits, and approve milestone payouts.</p>
        </div>

        {isManager && activeTab === 'contractors' && !isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard External Partner</span>
          </button>
        )}
      </div>

      {/* Tabs Row */}
      <div className="border-b border-slate-200 flex space-x-4">
        <button
          onClick={() => { setActiveTab('contractors'); setIsCreating(false); }}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeTab === 'contractors' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Partner Directory
        </button>
        <button
          onClick={() => { setActiveTab('milestones-billing'); setIsCreating(false); }}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeTab === 'milestones-billing' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Milestones & Vendor Invoices
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Create Form / Milestone Submissions */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Onboard Contractor Form */}
          {isCreating && activeTab === 'contractors' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-fade-in">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <FileSignature className="w-4 h-4 text-brand-600" />
                Register Vendor Contract
              </h3>

              <form onSubmit={handleCreateContractor} className="space-y-4 text-xs text-slate-600">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Full Name / Rep Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Olanrewaju Alao"
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Company Name</label>
                  <input
                    type="text"
                    value={cCompany}
                    onChange={(e) => setCCompany(e.target.value)}
                    placeholder="Leave blank if self-employed"
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Contractor Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@vendors.com"
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Specialized Capability</label>
                  <input
                    type="text"
                    required
                    value={spec}
                    onChange={(e) => setSpec(e.target.value)}
                    placeholder="e.g. Lead Information Architect"
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Billing Category</label>
                    <select
                      value={billing}
                      onChange={(e) => setBilling(e.target.value as any)}
                      className="w-full border border-slate-200 bg-white rounded-lg p-2 focus:outline-none"
                    >
                      <option value="Retainer">Monthly Retainer</option>
                      <option value="Hourly">Hourly rate</option>
                      <option value="Fixed_Project">Fixed Milestone project</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Rate ($)</label>
                    <input
                      type="number"
                      required
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Budget Cap ($)</label>
                    <input
                      type="number"
                      required
                      value={budgetCap}
                      onChange={(e) => setBudgetCap(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Tax ID / CR Number</label>
                    <input
                      type="text"
                      required
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="Tax Identification Ref"
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Start Date</label>
                    <input
                      type="date"
                      required
                      value={startD}
                      onChange={(e) => setStartD(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-1.5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Expiry Date</label>
                    <input
                      type="date"
                      required
                      value={endD}
                      onChange={(e) => setEndD(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-1.5"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                  >
                    Authorize Contract
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Add Milestone Voucher Form */}
          {activeTab === 'milestones-billing' && isManager && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                Register Contract Milestone
              </h3>

              {formSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 text-[11px] animate-fade-in">
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handleAddMilestone} className="space-y-4 text-xs text-slate-600">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Select Partner / Vendor</label>
                  <select
                    required
                    value={selectedContrId}
                    onChange={(e) => setSelectedContrId(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-lg p-2 focus:outline-none"
                  >
                    <option value="">-- Select Active Partner --</option>
                    {contractors.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.specialization})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Milestone Title / Description</label>
                  <input
                    type="text"
                    required
                    value={mTitle}
                    onChange={(e) => setMTitle(e.target.value)}
                    placeholder="e.g. Milestone 2: Delivery of security audit report"
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Milestone Value ($)</label>
                    <input
                      type="number"
                      required
                      value={mAmount}
                      onChange={(e) => setMAmount(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Due Date</label>
                    <input
                      type="date"
                      required
                      value={mDueDate}
                      onChange={(e) => setMDueDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-1.5"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedContrId}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Create Milestone Voucher
                </button>
              </form>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Partner Ledger table or Milestones/Billing matrix */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Tab 1: Contractors Listing */}
          {activeTab === 'contractors' && !isCreating && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 pb-2.5 border-b border-slate-100">
                <Users className="w-4 h-4 text-brand-600" />
                Active Corporate External Partners
              </h3>

              <div className="space-y-4">
                {contractors.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-4 text-center">No vendors or consultants registered.</p>
                ) : (
                  contractors.map((contr) => (
                    <div key={contr.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-200 space-y-3 hover:border-slate-300 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs">{contr.name}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">{contr.specialization} • <strong>{contr.companyName}</strong></p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold self-start sm:self-center ${
                          contr.status === 'Active' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-red-50 border border-red-100 text-red-700'
                        }`}>
                          {contr.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-150 text-[11px]">
                        <div>
                          <span className="text-slate-400 text-[9px] uppercase font-bold block">Rate Scale</span>
                          <span className="font-bold text-slate-800">{formatCurrency(contr.rate)} <span className="text-[9px] text-slate-400 font-medium">/{contr.billingModel === 'Hourly' ? 'hr' : 'mo'}</span></span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] uppercase font-bold block">Tax Ref ID</span>
                          <span className="font-mono text-slate-600">{contr.taxId}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] uppercase font-bold block">Budget Cap</span>
                          <span className="font-bold text-emerald-600">{formatCurrency(contr.budgetCap)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] uppercase font-bold block">Contract Timeline</span>
                          <span className="font-bold text-slate-500 text-[10px]">{contr.startDate} to {contr.endDate}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Milestones & Vendor Invoices */}
          {activeTab === 'milestones-billing' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 pb-2.5 border-b border-slate-100">
                <Coins className="w-4 h-4 text-brand-600" />
                Voucher Approvals & Contract Disbursements
              </h3>

              <div className="space-y-3.5">
                {milestones.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-4 text-center">No project milestone logs registered.</p>
                ) : (
                  milestones.map((m) => (
                    <div key={m.id} className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                            Milestone
                          </span>
                          <h4 className="font-bold text-slate-900 text-xs">{m.title}</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">Recipient: <strong>{m.contractorName}</strong> • Deliverable Due: {m.dueDate}</p>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-slate-400 text-[9px] uppercase font-bold block">Invoice Amount</span>
                          <span className="font-bold text-slate-900 text-sm font-mono">{formatCurrency(m.amount)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {m.status === 'Pending' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 border border-amber-100 text-amber-700">
                              Awaiting Sign-off
                            </span>
                          )}
                          {m.status === 'Completed' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 border border-blue-100 text-blue-700">
                              Approved (Ready)
                            </span>
                          )}
                          {m.status === 'Paid' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                              Disbursed
                            </span>
                          )}

                          {isManager && m.status === 'Pending' && (
                            <button
                              onClick={() => handleTransitionMilestone(m.id, 'Completed')}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Sign off
                            </button>
                          )}

                          {isManager && m.status === 'Completed' && (
                            <button
                              onClick={() => handleTransitionMilestone(m.id, 'Paid')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <DollarSign className="w-3 h-3" /> Execute Payout
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
