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
  Inbox
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface HrRequestsProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function HrRequests({ currentUser, selectedTenantId }: HrRequestsProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isHr = ['CompanyAdmin', 'HRManager', 'LineManager'].includes(currentUser.role);
  const isEmployeeOnly = currentUser.role === 'Employee';

  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'my-tickets' | 'hr-inbox'>('my-tickets');
  const [selectedTicket, setSelectedTicket] = useState<HRRequest | null>(null);

  // Submit Ticket Form States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HRRequest['type']>('General');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Response form states
  const [managerComment, setManagerComment] = useState('');

  // Fetch records
  useEffect(() => {
    async function loadHrRequests() {
      if (!companyId) return;
      try {
        // Fetch Employees
        const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const empList: Employee[] = [];
        empSnap.forEach(d => empList.push({ ...d.data() as Employee, employeeId: d.id }));
        setEmployees(empList);

        // Fetch HR requests
        const reqSnap = await getDocs(collection(db, `companies/${companyId}/hr_requests`));
        const reqList: HRRequest[] = [];
        reqSnap.forEach(d => reqList.push({ ...d.data() as HRRequest, requestId: d.id }));
        
        // Sort by created date descending
        reqList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setRequests(reqList);

        // Default tabs based on role
        if (isHr && !isEmployeeOnly) {
          setActiveTab('hr-inbox');
        } else {
          setActiveTab('my-tickets');
        }
      } catch (err) {
        console.error('Error loading ticketing DB:', err);
      }
    }
    loadHrRequests();
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

    const myProfile = employees.find(emp => emp.email === currentUser.email);
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

  const getStaffName = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? `${emp.firstName} ${emp.lastName}` : empId;
  };

  const getStaffJob = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? emp.jobTitle : 'Employee';
  };

  // Filters
  const myEmployee = employees.find(e => e.email === currentUser.email);
  const myTickets = requests.filter(r => r.employeeId === myEmployee?.employeeId);

  return (
    <div className="space-y-6 animate-slide-up" id="hr-requests-tab">
      
      {/* 1. HEADER ROW */}
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900">HR Helpdesk & Ticketing</h2>
        <p className="text-xs text-slate-500">File company grievances, submit payroll disputes, ask IT hardware questions, and view resolution logs.</p>
      </div>

      {/* 2. DYNAMIC TAB CONTROLLER */}
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

      {/* 3. HELP DESK GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Ticket Submission Form */}
        {activeTab === 'my-tickets' && (
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <HelpCircle className="w-4 h-4 text-brand-600" />
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
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Ticket Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payroll discrepancy with travel allowance"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Helpdesk Category</label>
                <select
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="General">General HR Query</option>
                  <option value="PayrollQuery">Payroll Dispute</option>
                  <option value="Grievance">Confidential Grievance</option>
                  <option value="ItSupport">IT & Hardware Request</option>
                  <option value="DocumentRequest">Official Document Copy</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Full Statement / Description</label>
                <textarea
                  required
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  rows={4}
                  placeholder="Provide supporting statement, ticket details, or incident information..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit Ticket</span>
              </button>
            </form>
          </div>
        )}

        {/* RIGHT COLUMN: Ticket List & Administration */}
        <div className={`lg:col-span-2 space-y-4 ${activeTab === 'hr-inbox' ? 'lg:col-span-3' : ''}`}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* TICKET DIRECTORY CARDS */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                {activeTab === 'hr-inbox' ? 'Organization Ticket Queue' : 'My Tickets'}
              </h4>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {(activeTab === 'hr-inbox' ? requests : myTickets).length === 0 ? (
                  <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
                    <Inbox className="w-6 h-6 mx-auto text-slate-350 mb-1" />
                    No logged tickets found in this viewport.
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

            {/* EXPANDED DETAILED INSPECTOR CARD */}
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

                  {/* Manager Response displays */}
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
                        <label className="block text-[10px] text-slate-500 uppercase mb-1">Write HR Response</label>
                        <textarea
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-xs"
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
                          className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold"
                        >
                          Mark In-Progress
                        </button>
                        <button
                          onClick={() => handleResolveTicket('Resolved')}
                          disabled={actionLoading}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold"
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
                  <p className="font-medium text-xs">Select any ticket card to inspect detailed description, resolutions, and write manager comments.</p>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
