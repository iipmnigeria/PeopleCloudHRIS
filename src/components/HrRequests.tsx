import React, { useState, useEffect } from 'react';
import { UserRole, HRRequest, Employee } from '../types';
import { 
  HelpCircle, 
  Send, 
  MessageSquare, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Check, 
  ChevronRight,
  Inbox,
  FileText,
  BookOpen,
  LogOut,
  Sparkles,
  ClipboardList,
  UserCheck,
  ShieldCheck,
  Download,
  AlertTriangle,
  UserMinus,
  RefreshCw
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface HrRequestsProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
    selectedTenantId?: string;
  };
  selectedTenantId: string;
}

// Fixed Corporate Policy List (Document & Policy Management - Module 12)
interface Policy {
  policyId: string;
  title: string;
  code: string;
  effectiveDate: string;
  category: string;
  summary: string;
  content: string;
}

const CORPORATE_POLICIES: Policy[] = [
  {
    policyId: 'pol-ethics-01',
    title: 'Professional Code of Conduct & Ethical Standard',
    code: 'IIPM-COC-2026',
    effectiveDate: 'January 1, 2026',
    category: 'Ethics & Compliance',
    summary: 'Core organizational guidelines governing conflict of interest, integrity, gift limits, and professional representation.',
    content: 'All personnel are required to execute duties with utmost good faith. Conflict of interests must be disclosed immediately to People Operations. Corporate resources must not be converted for personal utility. Violation of code of ethics shall lead to immediate disciplinary query and possible termination.'
  },
  {
    policyId: 'pol-remote-02',
    title: 'Hybrid & Remote Work Collaboration Framework',
    code: 'PCLOUD-HYB-04',
    effectiveDate: 'March 15, 2026',
    category: 'Operations',
    summary: 'Operational principles for core hours, digital accessibility, response times, and home security protocols.',
    content: 'Core collaboration hours are designated between 10:00 AM and 4:00 PM West African Time (WAT). Employees must be responsive on verified collaboration tools (Google Chat, Slack) within 30 minutes during core hours. Corporate data must never be stored on personal unsecured hard drives.'
  },
  {
    policyId: 'pol-harass-03',
    title: 'Anti-Harassment & Inclusive Workplace Policy',
    code: 'PCLOUD-DIV-02',
    effectiveDate: 'January 1, 2026',
    category: 'Safety & Diversity',
    summary: 'Strict guidelines ensuring zero tolerance for discrimination, workplace bullying, or hostile conditions.',
    content: 'The company enforces an absolute zero-tolerance standard for verbal, physical, visual, or sexual harassment. Grievances must be reported directly via the HR Helpdesk. All reported cases will be investigated by a neutral HR panel within 5 business days with complete confidentiality.'
  }
];

interface PolicyAcknowledgment {
  ackId: string;
  policyId: string;
  employeeId: string;
  employeeName: string;
  acknowledgedAt: string;
}

// Exit & Clearance interfaces (Exit and Offboarding - Module 14)
interface ExitRecord {
  exitId: string;
  employeeId: string;
  employeeName: string;
  resignationDate: string;
  effectiveExitDate: string;
  reason: string;
  comments: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  checklist: {
    assetReturned: boolean;
    accessDeprovisioned: boolean;
    exitInterviewCompleted: boolean;
    finalSettlementCalculated: boolean;
  };
  exitInterviewNotes?: string;
  finalSettlementDetail?: string;
  createdAt: string;
}

export default function HrRequests({ currentUser, selectedTenantId }: HrRequestsProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isHr = ['CompanyAdmin', 'HRManager', 'LineManager'].includes(currentUser.role);
  const isEmployeeOnly = currentUser.role === 'Employee';

  // Navigation Panel Tab Control
  const [activeTab, setActiveTab] = useState<'my-tickets' | 'hr-inbox'>('my-tickets');
  const [activeModule, setActiveModule] = useState<'helpdesk' | 'policies' | 'offboarding'>('helpdesk');

  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<HRRequest | null>(null);
  
  // Policy Acknowledgment state
  const [acknowledgments, setAcknowledgments] = useState<PolicyAcknowledgment[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  // Exit & Offboarding state
  const [exits, setExits] = useState<ExitRecord[]>([]);
  const [myExit, setMyExit] = useState<ExitRecord | null>(null);
  const [selectedExit, setSelectedExit] = useState<ExitRecord | null>(null);

  // Submit Ticket Form States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HRRequest['type']>('General');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Response form states
  const [managerComment, setManagerComment] = useState('');

  // Resignation Submission States
  const [resignationDate, setResignationDate] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveExitDate, setEffectiveExitDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Default 30 days notice
  const [exitReason, setExitReason] = useState('Career Growth Opportunities');
  const [exitComments, setExitComments] = useState('');
  const [resubmitToggle, setResubmitToggle] = useState(false);

  // Supervisor Clearance checklist states
  const [clearanceAsset, setClearanceAsset] = useState(false);
  const [clearanceAccess, setClearanceAccess] = useState(false);
  const [clearanceInterview, setClearanceInterview] = useState(false);
  const [clearanceSettlement, setClearanceSettlement] = useState(false);
  const [interviewNotes, setInterviewNotes] = useState('');
  const [settlementDetail, setSettlementDetail] = useState('');

  // Fetch records
  const loadModuleData = async () => {
    if (!companyId) return;
    try {
      // 1. Fetch Employees
      const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
      const empList: Employee[] = [];
      empSnap.forEach(d => empList.push({ ...d.data() as Employee, employeeId: d.id }));
      setEmployees(empList);

      const myProfile = empList.find(emp => emp.email.toLowerCase() === currentUser.email.toLowerCase());

      // 2. Fetch HR requests
      const reqSnap = await getDocs(collection(db, `companies/${companyId}/hr_requests`));
      const reqList: HRRequest[] = [];
      reqSnap.forEach(d => reqList.push({ ...d.data() as HRRequest, requestId: d.id }));
      reqList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRequests(reqList);

      // 3. Fetch Policy Acknowledgments
      const ackSnap = await getDocs(collection(db, `companies/${companyId}/policy_acknowledgments`));
      const ackList: PolicyAcknowledgment[] = [];
      ackSnap.forEach(d => ackList.push({ ...d.data() as PolicyAcknowledgment, ackId: d.id }));
      setAcknowledgments(ackList);

      // 4. Fetch Exit Records
      const exitSnap = await getDocs(collection(db, `companies/${companyId}/exits`));
      const exitList: ExitRecord[] = [];
      exitSnap.forEach(d => exitList.push({ ...d.data() as ExitRecord, exitId: d.id }));
      setExits(exitList);

      if (myProfile) {
        const matchingExit = exitList.find(ex => ex.employeeId === myProfile.employeeId);
        setMyExit(matchingExit || null);
      }

      // Default tabs based on role
      if (isHr && !isEmployeeOnly) {
        setActiveTab('hr-inbox');
      } else {
        setActiveTab('my-tickets');
      }
    } catch (err) {
      console.error('Error loading ticketing DB:', err);
    }
  };

  useEffect(() => {
    loadModuleData();
  }, [companyId, isHr, isEmployeeOnly]);

  // Submit new ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setFormError('');
    setFormSuccess('');

    if (!title.trim() || !description.trim()) {
      setFormError('Please fill in both the ticket subject and description.');
      return;
    }

    const myProfile = employees.find(emp => emp.email.toLowerCase() === currentUser.email.toLowerCase());
    if (!myProfile) {
      setFormError('Could not locate employee matching active session.');
      return;
    }

    setActionLoading(true);

    try {
      const ticketId = 'req-' + Math.random().toString(36).substring(2, 9);
      const newTicket: HRRequest = {
        requestId: ticketId,
        companyId,
        employeeId: myProfile.employeeId,
        title: title.trim(),
        type: category,
        description: description.trim(),
        status: 'Open',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/hr_requests`, ticketId), newTicket);
      setRequests([newTicket, ...requests]);

      setFormSuccess('Your request has been successfully queued. An HR representative will respond shortly.');
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setFormError(`Submission failed: ${err.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit response (HR Only)
  const handleResolveTicket = async (status: 'InProgress' | 'Resolved') => {
    if (!companyId || !selectedTicket) return;
    setActionLoading(true);

    try {
      const docRef = doc(db, `companies/${companyId}/hr_requests`, selectedTicket.requestId);
      const updateData = {
        status,
        managerComment: managerComment.trim(),
        resolvedBy: currentUser.uid,
        resolvedAt: new Date().toISOString()
      };

      await updateDoc(docRef, updateData);

      const updated = { ...selectedTicket, ...updateData };
      setRequests(requests.map(r => r.requestId === selectedTicket.requestId ? updated : r));
      setSelectedTicket(updated);
      setManagerComment('');

      // Create notification for employee
      const requester = employees.find(e => e.employeeId === selectedTicket.employeeId);
      if (requester && requester.userId) {
        const notifId = 'not-' + Math.random().toString(36).substring(2, 9);
        await setDoc(doc(db, `companies/${companyId}/notifications`, notifId), {
          notificationId: notifId,
          companyId,
          userId: requester.userId,
          title: `HR Ticket Updated: ${status}`,
          message: `Your ticket "${selectedTicket.title}" has been updated to "${status}".`,
          read: false,
          type: 'Helpdesk',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Acknowledge Policy (Module 12)
  const handleAcknowledgePolicy = async (policyId: string) => {
    if (!companyId) return;
    const myProfile = employees.find(emp => emp.email.toLowerCase() === currentUser.email.toLowerCase());
    if (!myProfile) {
      alert('Could not locate employee matching active session.');
      return;
    }

    try {
      const ackId = `ack-${policyId}-${myProfile.employeeId}`;
      const newAck: PolicyAcknowledgment = {
        ackId,
        policyId,
        employeeId: myProfile.employeeId,
        employeeName: `${myProfile.firstName} ${myProfile.lastName}`,
        acknowledgedAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/policy_acknowledgments`, ackId), newAck);
      setAcknowledgments([...acknowledgments, newAck]);
      alert(`Thank you! Your electronic signature has been applied to ${selectedPolicy?.title}.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Resignation (Module 14)
  const handleResignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const myProfile = employees.find(emp => emp.email.toLowerCase() === currentUser.email.toLowerCase());
    if (!myProfile) {
      alert('Employee session missing.');
      return;
    }

    if (!window.confirm('Are you absolutely sure you wish to submit your formal resignation? This action initiates organizational clearance workflows.')) {
      return;
    }

    setActionLoading(true);

    try {
      const exitId = `exit-${myProfile.employeeId}`;
      const newExit: ExitRecord = {
        exitId,
        employeeId: myProfile.employeeId,
        employeeName: `${myProfile.firstName} ${myProfile.lastName}`,
        resignationDate,
        effectiveExitDate,
        reason: exitReason,
        comments: exitComments,
        status: 'Pending',
        checklist: {
          assetReturned: false,
          accessDeprovisioned: false,
          exitInterviewCompleted: false,
          finalSettlementCalculated: false
        },
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/exits`, exitId), newExit);
      setMyExit(newExit);
      setExits([...exits.filter(ex => ex.exitId !== exitId), newExit]);
      setExitComments('');
      alert('Formal resignation successfully submitted. Please schedule your exit clearance interview.');
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Process exit application (HR/Manager Only)
  const handleProcessExit = async (status: 'Approved' | 'Rejected') => {
    if (!companyId || !selectedExit) return;
    setActionLoading(true);

    try {
      const docRef = doc(db, `companies/${companyId}/exits`, selectedExit.exitId);
      const updateData = {
        status,
        checklist: {
          assetReturned: clearanceAsset,
          accessDeprovisioned: clearanceAccess,
          exitInterviewCompleted: clearanceInterview,
          finalSettlementCalculated: clearanceSettlement
        },
        exitInterviewNotes: interviewNotes,
        finalSettlementDetail: settlementDetail
      };

      await updateDoc(docRef, updateData);

      // If approved, update employee status to suspended/terminated as offboarded
      if (status === 'Approved') {
        const empRef = doc(db, `companies/${companyId}/employees`, selectedExit.employeeId);
        await updateDoc(empRef, { status: 'Terminated' });
      }

      const updated = { ...selectedExit, ...updateData };
      setExits(exits.map(ex => ex.exitId === selectedExit.exitId ? updated : ex));
      setSelectedExit(updated);
      alert(`Exit request processed successfully. Clearance state updated.`);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectExitToReview = (ex: ExitRecord) => {
    setSelectedExit(ex);
    setClearanceAsset(ex.checklist.assetReturned);
    setClearanceAccess(ex.checklist.accessDeprovisioned);
    setClearanceInterview(ex.checklist.exitInterviewCompleted);
    setClearanceSettlement(ex.checklist.finalSettlementCalculated);
    setInterviewNotes(ex.exitInterviewNotes || '');
    setSettlementDetail(ex.finalSettlementDetail || '');
  };

  const getStaffName = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? `${emp.firstName} ${emp.lastName}` : empId;
  };

  const getStaffJob = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? emp.jobTitle : 'Employee';
  };

  // Filters
  const myEmployee = employees.find(e => e.email.toLowerCase() === currentUser.email.toLowerCase());
  const myTickets = requests.filter(r => r.employeeId === myEmployee?.employeeId);

  // Policy Acknowledgment checks
  const isPolicyAcknowledged = (policyId: string) => {
    if (!myEmployee) return false;
    return acknowledgments.some(ack => ack.policyId === policyId && ack.employeeId === myEmployee.employeeId);
  };

  const getAcknowledgmentDate = (policyId: string) => {
    if (!myEmployee) return '';
    const ack = acknowledgments.find(ack => ack.policyId === policyId && ack.employeeId === myEmployee.employeeId);
    return ack ? new Date(ack.acknowledgedAt).toLocaleString() : '';
  };

  return (
    <div className="space-y-6 animate-slide-up" id="hr-requests-panel">
      
      {/* 1. DOUBLE DECKER NAVIGATION BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900">Operations & Support Hub</h2>
          <p className="text-xs text-slate-500 mt-1">
            Central terminal for corporate policies, employee relations grievances, and offboarding exit clearance pipelines.
          </p>
        </div>

        {/* Major HR Module Switcher */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-stretch md:self-auto">
          <button
            onClick={() => setActiveModule('helpdesk')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
              activeModule === 'helpdesk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Employee Relations
          </button>
          <button
            onClick={() => {
              setActiveModule('policies');
              setSelectedPolicy(CORPORATE_POLICIES[0]);
            }}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
              activeModule === 'policies' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Policy Center
          </button>
          <button
            onClick={() => {
              setActiveModule('offboarding');
              if (exits.length > 0 && !selectedExit) {
                handleSelectExitToReview(exits[0]);
              }
            }}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
              activeModule === 'offboarding' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Exit Station
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODULE 1: EMPLOYEE RELATIONS HELPDESK (TICKETING)        */}
      {/* ========================================================= */}
      {activeModule === 'helpdesk' && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 flex space-x-4">
            {(!isHr || isEmployeeOnly) && (
              <button
                onClick={() => setActiveTab('my-tickets')}
                className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  activeTab === 'my-tickets' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                My Submitted Tickets
              </button>
            )}

            {isHr && (
              <>
                <button
                  onClick={() => setActiveTab('hr-inbox')}
                  className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                    activeTab === 'hr-inbox' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Ticketing Administration Inbox ({requests.filter(r => r.status !== 'Resolved').length})
                </button>
                <button
                  onClick={() => setActiveTab('my-tickets')}
                  className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                    activeTab === 'my-tickets' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  My Tickets
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Left Box: Ticket Filing */}
            {activeTab === 'my-tickets' && (
              <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                  <HelpCircle className="w-4.5 h-4.5 text-brand-500" />
                  File Helpdesk Ticket
                </h3>

                {formError && (
                  <div className="p-3 bg-rose-50 text-rose-600 text-[11px] rounded-lg border border-rose-100 animate-fade-in">
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 text-[11px] rounded-lg border border-emerald-100 animate-fade-in">
                    {formSuccess}
                  </div>
                )}

                <form onSubmit={handleSubmitTicket} className="space-y-4 text-xs text-slate-600">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Ticket Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Discrepancy in monthly travel allowance"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Helpdesk Category</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                    >
                      <option value="General">General HR Query</option>
                      <option value="PayrollQuery">Payroll Dispute</option>
                      <option value="Grievance">Confidential Grievance</option>
                      <option value="EmploymentLetter">Employment Letter Request</option>
                      <option value="SalaryConfirmation">Salary Confirmation Slip</option>
                      <option value="DocUpdate">Document Update Ticket</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Full Statement / Description</label>
                    <textarea
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      rows={5}
                      placeholder="Provide supporting statement, ticket details, or incident information..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Submit Ticket</span>
                  </button>
                </form>
              </div>
            )}

            {/* Right Box: Queue list & Inspection */}
            <div className={`lg:col-span-2 space-y-4 ${activeTab === 'hr-inbox' ? 'lg:col-span-3' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tickets list */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    {activeTab === 'hr-inbox' ? 'Organization Ticket Queue' : 'My Tickets'}
                  </h4>

                  <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                    {(activeTab === 'hr-inbox' ? requests : myTickets).length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                        <Inbox className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                        No logged tickets found.
                      </div>
                    ) : (
                      (activeTab === 'hr-inbox' ? requests : myTickets).map((ticket) => (
                        <div 
                          key={ticket.requestId} 
                          onClick={() => setSelectedTicket(ticket)}
                          className={`p-3.5 bg-white border rounded-xl text-xs space-y-2 cursor-pointer hover:border-brand-300 hover:shadow-xs transition-all ${
                            selectedTicket?.requestId === ticket.requestId ? 'border-brand-500 bg-brand-50/5 shadow-xs' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-950 truncate max-w-[150px]">{ticket.title}</span>
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                              ticket.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                              ticket.status === 'InProgress' ? 'bg-amber-100 text-amber-800' :
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {ticket.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Category: {ticket.type}</span>
                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          </div>

                          {activeTab === 'hr-inbox' && (
                            <div className="text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 flex justify-between">
                              <span>By: <strong>{getStaffName(ticket.employeeId)}</strong></span>
                              <span>{getStaffJob(ticket.employeeId)}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Inspecting ticket */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-fit space-y-4">
                  {selectedTicket ? (
                    <div className="space-y-4 animate-fade-in text-xs">
                      <div className="border-b border-slate-100 pb-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-brand-600 font-bold bg-brand-50 px-1.5 py-0.5 rounded">
                            {selectedTicket.type} Ticket
                          </span>
                          <span className="text-[10px] text-slate-400">{new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold text-slate-950 text-base mt-1">{selectedTicket.title}</h3>
                      </div>

                      <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Statement Description</span>
                        <p className="text-slate-700 leading-relaxed font-medium">{selectedTicket.description}</p>
                      </div>

                      {/* Manager response display */}
                      {selectedTicket.managerComment ? (
                        <div className="space-y-1.5 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100 text-slate-800">
                          <span className="text-[9px] uppercase font-bold text-emerald-600 block flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            HR Representative Statement
                          </span>
                          <p className="leading-relaxed font-medium">"{selectedTicket.managerComment}"</p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No formal HR statement has been submitted for this query yet.</p>
                      )}

                      {/* Resolution Input Area (HR Only) */}
                      {isHr && selectedTicket.status !== 'Resolved' && (
                        <div className="border-t border-slate-150 pt-4 space-y-3">
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Write HR Response</label>
                            <textarea
                              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
                              rows={3}
                              placeholder="Submit response statement or action coordinates..."
                              value={managerComment}
                              onChange={(e) => setManagerComment(e.target.value)}
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleResolveTicket('InProgress')}
                              disabled={actionLoading}
                              className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
                            >
                              Mark In-Progress
                            </button>
                            <button
                              onClick={() => handleResolveTicket('Resolved')}
                              disabled={actionLoading}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all cursor-pointer animate-pulse"
                            >
                              Mark Resolved
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 space-y-1.5">
                      <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="font-semibold text-xs">Select any ticket card to inspect detailed description, resolutions, and write comments.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODULE 2: CORPORATE DOCUMENTS & POLICY CENTER            */}
      {/* ========================================================= */}
      {activeModule === 'policies' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Left Panel: Policy Catalog List */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <BookOpen className="w-4.5 h-4.5 text-brand-500" />
              Corporate Handbooks & Guidelines
            </h3>

            <div className="space-y-3">
              {CORPORATE_POLICIES.map((policy) => {
                const acknowledged = isPolicyAcknowledged(policy.policyId);
                const isSelected = selectedPolicy?.policyId === policy.policyId;
                return (
                  <div
                    key={policy.policyId}
                    onClick={() => setSelectedPolicy(policy)}
                    className={`p-3.5 border rounded-xl cursor-pointer text-xs space-y-2 transition-all hover:border-slate-300 ${
                      isSelected ? 'border-brand-500 bg-brand-50/10' : 'border-slate-150 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-900 block leading-tight">{policy.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block">Code: {policy.code}</span>
                    
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="text-slate-500 font-medium">{policy.category}</span>
                      {acknowledged ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold bg-emerald-50 px-1 rounded">
                          <Check className="w-3 h-3" /> Acknowledged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-amber-600 font-bold bg-amber-50 px-1 rounded">
                          Pending Sig
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Policy Details View & Signature Log */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPolicy ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                
                {/* Policy Header block */}
                <div className="border-b border-slate-100 pb-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-mono font-bold text-[9px]">
                      {selectedPolicy.code}
                    </span>
                    <span className="text-[10px] text-slate-400">Effective: {selectedPolicy.effectiveDate}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 font-display">{selectedPolicy.title}</h3>
                  <p className="text-xs text-slate-500 leading-normal">{selectedPolicy.summary}</p>
                </div>

                {/* Policy Content */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 text-xs text-slate-700 leading-relaxed font-medium space-y-3 max-h-[300px] overflow-y-auto">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Formal Policy Content Statement</span>
                  <p>{selectedPolicy.content}</p>
                  <p className="mt-4 text-[11px] font-semibold text-slate-500 border-t border-slate-200 pt-3">
                    By submitting the electronic acknowledgment below, you agree to comply with all rules and obligations as outlined in policy directive {selectedPolicy.code}.
                  </p>
                </div>

                {/* Acknowledgment Action / Verification Badge */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {isPolicyAcknowledged(selectedPolicy.policyId) ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs flex items-center gap-3 w-full animate-fade-in">
                      <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold block text-emerald-950">Electronic Signature Verified</span>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          You digitally signed and acknowledged compliance with this directive on{' '}
                          <strong className="font-mono">{getAcknowledgmentDate(selectedPolicy.policyId)}</strong>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-slate-500 max-w-sm">
                        <span className="font-bold text-slate-800 block mb-0.5">Awaiting Digital Handshake</span>
                        Read the policy carefully. Click to register your compliance acknowledgment.
                      </div>
                      
                      <button
                        onClick={() => handleAcknowledgePolicy(selectedPolicy.policyId)}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Acknowledge Compliance</span>
                      </button>
                    </>
                  )}
                </div>

                {/* HR Audit Panel: Who has signed? (HR and Managers only) */}
                {isHr && (
                  <div className="pt-6 border-t border-slate-150 space-y-3.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      HR Audit: Tenant Acknowledgment Roster
                    </h4>
                    
                    <div className="overflow-x-auto border border-slate-150 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-150">
                            <th className="px-4 py-2">Staff Member</th>
                            <th className="px-4 py-2">Department</th>
                            <th className="px-4 py-2">Signature Timestamp</th>
                            <th className="px-4 py-2 text-right">Verification Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {employees.map(emp => {
                            const empAck = acknowledgments.find(
                              ack => ack.policyId === selectedPolicy.policyId && ack.employeeId === emp.employeeId
                            );
                            return (
                              <tr key={emp.employeeId} className="hover:bg-slate-50/30">
                                <td className="px-4 py-2.5">
                                  <span className="font-bold text-slate-900">{emp.firstName} {emp.lastName}</span>
                                  <span className="text-[10px] text-slate-400 block">{emp.jobTitle}</span>
                                </td>
                                <td className="px-4 py-2.5 font-medium">{emp.departmentId.replace('dept-', '').toUpperCase()}</td>
                                <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                                  {empAck ? new Date(empAck.acknowledgedAt).toLocaleString() : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-bold">
                                  {empAck ? (
                                    <span className="text-emerald-600 text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">
                                      Compliant
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 text-[10px] bg-amber-50 px-1.5 py-0.5 rounded">
                                      Outstanding
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-slate-100 border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <FileText className="w-12 h-12 text-slate-300 mb-2" />
                <h4 className="font-bold text-xs text-slate-700">No Policy Document Selected</h4>
                <p className="text-[10px] text-slate-400 max-w-xs mt-1">Select a corporate handbook or operational guideline from the left library panel.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODULE 3: EXIT & OFFBOARDING MANAGER                      */}
      {/* ========================================================= */}
      {activeModule === 'offboarding' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* FOR EMPLOYEES: Submission panel & Personal clearance checklist */}
          {isEmployeeOnly && (
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Resignation filing */}
              <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                  <UserMinus className="w-4.5 h-4.5 text-rose-500" />
                  Formal Resignation Filing
                </h3>

                {myExit ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Filing Status:</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        myExit.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                        myExit.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {myExit.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <p>Resigned on: <strong>{new Date(myExit.resignationDate).toLocaleDateString()}</strong></p>
                      <p>Proposed Last Working Day: <strong>{new Date(myExit.effectiveExitDate).toLocaleDateString()}</strong></p>
                      <p className="pt-2 border-t border-slate-100">Primary Exit Motive: <strong className="block text-slate-800">{myExit.reason}</strong></p>
                    </div>

                    {myExit.status === 'Pending' && (
                      <button
                        onClick={() => setResubmitToggle(true)}
                        className="w-full py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold rounded-xl text-[10px] mt-2 transition-colors cursor-pointer"
                      >
                        Adjust Exit Request Details
                      </button>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleResignSubmit} className="space-y-4 text-xs text-slate-600">
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-[11px] flex gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p>Filing resignation initiates the company asset returns and final gratuity settlement checks.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Resignation Notice Date</label>
                      <input
                        type="date"
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                        value={resignationDate}
                        onChange={(e) => setResignationDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Proposed Last Working Day</label>
                      <input
                        type="date"
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                        value={effectiveExitDate}
                        onChange={(e) => setEffectiveExitDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Primary Motive for Exit</label>
                      <select
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none"
                        value={exitReason}
                        onChange={(e) => setExitReason(e.target.value)}
                      >
                        <option value="Career Growth Opportunities">Career Growth Opportunities</option>
                        <option value="Family or Personal Circumstances">Family or Personal Circumstances</option>
                        <option value="Further Studies / Relocation">Further Studies / Relocation</option>
                        <option value="Compensation or Benefits Package">Compensation or Benefits Package</option>
                        <option value="Retirement">Retirement</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Exit Statement / Feedback</label>
                      <textarea
                        required
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                        placeholder="Provide overall experience feedback or exit remarks..."
                        value={exitComments}
                        onChange={(e) => setExitComments(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Submit Formal Resignation</span>
                    </button>
                  </form>
                )}

                {/* Submitting replacement adjust details */}
                {resubmitToggle && (
                  <form onSubmit={handleResignSubmit} className="border-t border-slate-150 pt-4 space-y-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl animate-fade-in">
                    <h4 className="font-bold text-slate-900 text-xs">Modify Exit Details</h4>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Proposed Last Working Day</label>
                      <input
                        type="date"
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-white"
                        value={effectiveExitDate}
                        onChange={(e) => setEffectiveExitDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Feedback / Remarks</label>
                      <textarea
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-white"
                        placeholder="Modify statement..."
                        value={exitComments}
                        onChange={(e) => setExitComments(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setResubmitToggle(false)}
                        className="flex-1 py-1.5 border border-slate-200 text-slate-700 bg-white rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-1.5 bg-rose-600 text-white rounded-lg font-semibold"
                      >
                        Re-Submit
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Personal Exit Clearance Checklist Tracker */}
              <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                  <ClipboardList className="w-4.5 h-4.5 text-brand-500" />
                  Personal Exit Clearance Checklist
                </h3>

                {!myExit ? (
                  <div className="py-12 text-center text-slate-400">
                    <ClipboardList className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs">Submit a formal resignation statement to initiate active clearance pipelines.</p>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Item 1: Asset return */}
                      <div className="p-4 rounded-xl border flex items-start gap-3 bg-slate-50 border-slate-150">
                        {myExit.checklist.assetReturned ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                        )}
                        <div>
                          <span className="font-bold text-slate-900 block">Corporate Asset Handover</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">Return physical company property (Laptops, tokens, security cards).</p>
                          <span className={`text-[10px] font-bold block mt-2 ${
                            myExit.checklist.assetReturned ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {myExit.checklist.assetReturned ? 'Verified & Completed' : 'Awaiting Operations Check'}
                          </span>
                        </div>
                      </div>

                      {/* Item 2: Access deprovision */}
                      <div className="p-4 rounded-xl border flex items-start gap-3 bg-slate-50 border-slate-150">
                        {myExit.checklist.accessDeprovisioned ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                        )}
                        <div>
                          <span className="font-bold text-slate-900 block">Digital Access Deprovisioning</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">Disabling of registered email addresses and SaaS application credentials.</p>
                          <span className={`text-[10px] font-bold block mt-2 ${
                            myExit.checklist.accessDeprovisioned ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {myExit.checklist.accessDeprovisioned ? 'Verified & Completed' : 'Pending exit date trigger'}
                          </span>
                        </div>
                      </div>

                      {/* Item 3: Exit Interview */}
                      <div className="p-4 rounded-xl border flex items-start gap-3 bg-slate-50 border-slate-150">
                        {myExit.checklist.exitInterviewCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                        )}
                        <div>
                          <span className="font-bold text-slate-900 block">Confidential Exit Interview</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">Conduct exit debrief with designated HR Specialist to register detailed feedback.</p>
                          <span className={`text-[10px] font-bold block mt-2 ${
                            myExit.checklist.exitInterviewCompleted ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {myExit.checklist.exitInterviewCompleted ? 'Interview Logged' : 'Awaiting interview scheduling'}
                          </span>
                        </div>
                      </div>

                      {/* Item 4: Final Settlement */}
                      <div className="p-4 rounded-xl border flex items-start gap-3 bg-slate-50 border-slate-150">
                        {myExit.checklist.finalSettlementCalculated ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                        )}
                        <div>
                          <span className="font-bold text-slate-900 block">Final Gratuity & Settlement computation</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">Calculations for accrued leave balances, prorated salary, and outstanding allowances.</p>
                          <span className={`text-[10px] font-bold block mt-2 ${
                            myExit.checklist.finalSettlementCalculated ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {myExit.checklist.finalSettlementCalculated ? 'Approved and Scheduled for Payment' : 'Under Payroll Review'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Interview Notes display if logged */}
                    {myExit.exitInterviewNotes && (
                      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-slate-800 space-y-1">
                        <span className="font-bold text-indigo-950 block">Exit Debrief Acknowledgments</span>
                        <p className="italic">"{myExit.exitInterviewNotes}"</p>
                      </div>
                    )}

                    {myExit.finalSettlementDetail && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-slate-800 space-y-1">
                        <span className="font-bold text-emerald-950 block">Final Computation Schedule Summary</span>
                        <p className="font-mono text-xs">{myExit.finalSettlementDetail}</p>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          )}

          {/* FOR ADMIN/HR: Organization-wide exit list & Detailed clearance approval console */}
          {!isEmployeeOnly && (
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              {/* Exits list */}
              <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                  <UserMinus className="w-4.5 h-4.5 text-rose-500" />
                  Tenant Exit Logs Queue
                </h3>

                <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
                  {exits.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-10">No resignations filed in this tenant database yet.</p>
                  ) : (
                    exits.map((ex) => (
                      <div
                        key={ex.exitId}
                        onClick={() => handleSelectExitToReview(ex)}
                        className={`p-3.5 border rounded-xl cursor-pointer text-xs space-y-2 hover:border-rose-300 transition-all ${
                          selectedExit?.exitId === ex.exitId ? 'border-rose-500 bg-rose-50/5' : 'border-slate-150 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-950 block">{ex.employeeName}</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                            ex.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                            ex.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {ex.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">Notice: {ex.resignationDate}</span>

                        {/* Counts completed checks */}
                        <div className="text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 flex justify-between font-medium">
                          <span>Cleared:</span>
                          <span className="font-bold">
                            {Object.values(ex.checklist).filter(Boolean).length} / 4 tasks
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Clearance Console */}
              <div className="lg:col-span-2">
                {selectedExit ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fade-in text-xs">
                    
                    {/* Header */}
                    <div className="border-b border-slate-100 pb-4 flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-rose-500 uppercase">Exit Clearance Console</span>
                        <h3 className="text-base font-bold text-slate-900 mt-1">{selectedExit.employeeName}</h3>
                        <p className="text-slate-500">Motive for resignation: <strong className="text-slate-800">{selectedExit.reason}</strong></p>
                      </div>

                      <span className={`px-2.5 py-1 rounded font-bold text-xs border ${
                        selectedExit.status === 'Pending' ? 'bg-amber-5 border border-amber-100 text-amber-700' :
                        selectedExit.status === 'Approved' ? 'bg-emerald-5 border border-emerald-100 text-emerald-700' :
                        'bg-rose-5 border border-rose-100 text-rose-700'
                      }`}>
                        {selectedExit.status}
                      </span>
                    </div>

                    {/* Resignation comment block */}
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Employee Resignation Statement</span>
                      <p className="text-slate-700 italic font-medium">"{selectedExit.comments || 'No remarks provided.'}"</p>
                    </div>

                    {/* Checkbox clearances */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Clearance Checklist Verification</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Check 1 */}
                        <label className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block">Asset Handover Completed</span>
                            <span className="text-[10px] text-slate-500 block">Laptops and hardware returned</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={clearanceAsset}
                            onChange={(e) => setClearanceAsset(e.target.checked)}
                            className="w-4 h-4 text-brand-600"
                          />
                        </label>

                        {/* Check 2 */}
                        <label className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block">Access Deprovisioned</span>
                            <span className="text-[10px] text-slate-500 block">Corporate accounts deactivated</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={clearanceAccess}
                            onChange={(e) => setClearanceAccess(e.target.checked)}
                            className="w-4 h-4 text-brand-600"
                          />
                        </label>

                        {/* Check 3 */}
                        <label className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block">Exit Interview Completed</span>
                            <span className="text-[10px] text-slate-500 block">Confidential debrief executed</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={clearanceInterview}
                            onChange={(e) => setClearanceInterview(e.target.checked)}
                            className="w-4 h-4 text-brand-600"
                          />
                        </label>

                        {/* Check 4 */}
                        <label className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block">Final Settlement Approved</span>
                            <span className="text-[10px] text-slate-500 block">Net computations processed</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={clearanceSettlement}
                            onChange={(e) => setClearanceSettlement(e.target.checked)}
                            className="w-4 h-4 text-brand-600"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Notes boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Interview debrief */}
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">HR Exit Interview Summary Notes</label>
                        <textarea
                          rows={3}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
                          placeholder="Log debrief notes, transition plan feedback..."
                          value={interviewNotes}
                          onChange={(e) => setInterviewNotes(e.target.value)}
                        />
                      </div>

                      {/* Settlement details */}
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Final Settlement Schedule Ledger</label>
                        <textarea
                          rows={3}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none"
                          placeholder="e.g. Base Prorated: NGN 150,000&#10;Accrued Leave: NGN 42,000&#10;Gratuity Sum: NGN 300,000"
                          value={settlementDetail}
                          onChange={(e) => setSettlementDetail(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* HR Signoff Actions */}
                    <div className="pt-4 border-t border-slate-150 flex justify-between items-center">
                      <div className="text-[10px] text-slate-400">
                        Notice date: {selectedExit.resignationDate} | Exit date: {selectedExit.effectiveExitDate}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProcessExit('Rejected')}
                          disabled={actionLoading}
                          className="px-4 py-2 border border-slate-250 text-slate-700 bg-white rounded-xl font-bold transition-all cursor-pointer"
                        >
                          Disapprove Exit
                        </button>
                        <button
                          onClick={() => handleProcessExit('Approved')}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all cursor-pointer"
                        >
                          Approve Clearance & Offboard
                        </button>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="bg-slate-100 border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                    <UserMinus className="w-12 h-12 text-slate-300 mb-2" />
                    <h4 className="font-bold text-xs text-slate-700">No Resignation Request Selected</h4>
                    <p className="text-[10px] text-slate-400 max-w-xs mt-1">Select a filed resignation form from the left queue to review clearance checklist status and complete interviews.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
