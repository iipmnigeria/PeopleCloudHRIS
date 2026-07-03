import React, { useState, useEffect } from 'react';
import { UserRole, LeaveRequest, Employee } from '../types';
import { 
  Calendar, 
  Send, 
  Check, 
  X, 
  CalendarDays, 
  Clock, 
  FileText, 
  AlertCircle,
  HelpCircle,
  BadgeAlert
} from 'lucide-react';
import { collection, getDocs, setDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface LeaveManagementProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function LeaveManagement({ currentUser, selectedTenantId }: LeaveManagementProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isApprover = ['CompanyAdmin', 'HRManager', 'LineManager'].includes(currentUser.role);
  const isEmployeeOnly = currentUser.role === 'Employee';

  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'my-leaves' | 'approvals' | 'calendar'>('my-leaves');

  // Submit Request Form States
  const [leaveType, setLeaveType] = useState<LeaveRequest['leaveType']>('Annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalDays, setTotalDays] = useState(0);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Load records
  useEffect(() => {
    async function loadLeaveData() {
      if (!companyId) return;
      try {
        // Fetch Employees (to map applicant names)
        const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const empList: Employee[] = [];
        empSnap.forEach(d => empList.push({ ...d.data() as Employee, employeeId: d.id }));
        setEmployees(empList);

        // Fetch Leaves
        const leaveSnap = await getDocs(collection(db, `companies/${companyId}/leave_requests`));
        const leaveList: LeaveRequest[] = [];
        leaveSnap.forEach(d => leaveList.push({ ...d.data() as LeaveRequest, leaveRequestId: d.id }));
        setLeaves(leaveList);

        // Set default active tab based on role permissions
        if (isApprover && !isEmployeeOnly) {
          setActiveTab('approvals');
        } else {
          setActiveTab('my-leaves');
        }
      } catch (err) {
        console.error('Error loading leave module:', err);
      }
    }
    loadLeaveData();
  }, [companyId, isApprover, isEmployeeOnly]);

  // Auto calculate total working days when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end < start) {
        setTotalDays(0);
        return;
      }

      // Simple calculation of business days (skipping Saturday & Sunday)
      let count = 0;
      const curDate = new Date(start.getTime());
      while (curDate <= end) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday (0) and Saturday (6)
          count++;
        }
        curDate.setDate(curDate.getDate() + 1);
      }
      setTotalDays(count);
    } else {
      setTotalDays(0);
    }
  }, [startDate, endDate]);

  // Submit Leave Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setFormError('');
    setFormSuccess('');

    if (!startDate || !endDate) {
      setFormError('Please select both starting and ending dates.');
      return;
    }

    if (totalDays <= 0) {
      setFormError('Ending date must be equal or later than starting date.');
      return;
    }

    // Find current employee's profile
    const myProfile = employees.find(emp => emp.email === currentUser.email);
    if (!myProfile) {
      setFormError('Could not find matching employee profile for active account.');
      return;
    }

    setActionLoading(true);

    try {
      const lrId = 'leave-' + Math.random().toString(36).substring(2, 9);
      const newRequest: LeaveRequest = {
        leaveRequestId: lrId,
        companyId,
        employeeId: myProfile.employeeId,
        leaveType,
        startDate,
        endDate,
        totalDays,
        status: 'Pending',
        comment,
        createdAt: new Date().toISOString()
      };

      // Write request
      await setDoc(doc(db, `companies/${companyId}/leave_requests`, lrId), newRequest);
      setLeaves([...leaves, newRequest]);
      
      // Send notification alert to supervisor
      const notifId = 'not-' + Math.random().toString(36).substring(2, 9);
      const newNotif = {
        notificationId: notifId,
        companyId,
        userId: myProfile.supervisorId || 'uid-admin-acme', // Fallback to company admin
        title: 'New Leave Request',
        message: `${myProfile.firstName} ${myProfile.lastName} requested ${totalDays} days of ${leaveType} Leave starting ${startDate}.`,
        read: false,
        type: 'Leave',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, `companies/${companyId}/notifications`, notifId), newNotif);

      setFormSuccess('Leave request submitted successfully into manager approval queue!');
      setStartDate('');
      setEndDate('');
      setComment('');
    } catch (err: any) {
      setFormError(`Submission failed: ${err.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Process Approval / Rejection
  const handleDecision = async (request: LeaveRequest, approved: boolean) => {
    if (!companyId) return;
    setActionLoading(true);

    const updatedStatus = approved ? 'Approved' : 'Rejected';

    try {
      // 1. Update Leave Status
      const docRef = doc(db, `companies/${companyId}/leave_requests`, request.leaveRequestId);
      await updateDoc(docRef, {
        status: updatedStatus,
        approvedBy: currentUser.uid,
        approvedAt: new Date().toISOString()
      });

      // Update local array
      const updated = { ...request, status: updatedStatus, approvedBy: currentUser.uid, approvedAt: new Date().toISOString() };
      setLeaves(leaves.map(l => l.leaveRequestId === request.leaveRequestId ? updated : l));

      // 2. Fetch requester's profile for notification
      const requester = employees.find(e => e.employeeId === request.employeeId);
      if (requester && requester.userId) {
        const notifId = 'not-' + Math.random().toString(36).substring(2, 9);
        const newNotif = {
          notificationId: notifId,
          companyId,
          userId: requester.userId,
          title: `Leave Request ${updatedStatus}`,
          message: `Your request for ${request.totalDays} days of ${request.leaveType} Leave has been ${updatedStatus.toLowerCase()}.`,
          read: false,
          type: 'Leave',
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, `companies/${companyId}/notifications`, notifId), newNotif);
      }
    } catch (err) {
      console.error('Decision processing failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter My Leave Requests vs Approvals vs Calendar
  const myEmployeeId = employees.find(e => e.email === currentUser.email)?.employeeId || '';
  const myLeavesList = leaves.filter(l => l.employeeId === myEmployeeId);
  const pendingApprovals = leaves.filter(l => l.status === 'Pending');
  const activeLeavesToday = leaves.filter(l => l.status === 'Approved' && new Date(l.startDate) <= new Date() && new Date(l.endDate) >= new Date());

  const getRequesterName = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? `${emp.firstName} ${emp.lastName}` : empId;
  };

  const getRequesterJob = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? emp.jobTitle : 'Employee';
  };

  return (
    <div className="space-y-6" id="leave-manager-tab">
      
      {/* 1. HEADER ROW */}
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900">Leave Manager</h2>
        <p className="text-xs text-slate-500">File time-off requests, track company vacation balances, and process team approvals.</p>
      </div>

      {/* 2. LEAVE ENTITLEMENT BALANCES GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Annual Vacation</span>
          <span className="text-xl font-bold text-slate-900 block mt-1">20 Days</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">Assigned annual cap</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Medical / Sick Leave</span>
          <span className="text-xl font-bold text-slate-900 block mt-1">10 Days</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">Full salary covered</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Used Vacation</span>
          <span className="text-xl font-bold text-brand-600 block mt-1">
            {myLeavesList.filter(l => l.status === 'Approved').reduce((acc, curr) => acc + curr.totalDays, 0)} Days
          </span>
          <span className="text-[9px] text-slate-400 block mt-0.5">Approved time-off logs</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Awaiting Approval</span>
          <span className="text-xl font-bold text-amber-600 block mt-1">
            {myLeavesList.filter(l => l.status === 'Pending').reduce((acc, curr) => acc + curr.totalDays, 0)} Days
          </span>
          <span className="text-[9px] text-slate-400 block mt-0.5">Pending in manager queue</span>
        </div>
      </div>

      {/* 3. TAB CONTROLLER */}
      <div className="border-b border-slate-200 flex space-x-4">
        {(!isApprover || isEmployeeOnly) && (
          <button
            onClick={() => setActiveTab('my-leaves')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'my-leaves' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            My Time-Off Requests
          </button>
        )}

        {isApprover && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'approvals' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Manager Approvals Matrix ({pendingApprovals.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('calendar')}
          className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'calendar' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Company Out-of-Office Calendar ({activeLeavesToday.length})
        </button>
      </div>

      {/* 4. DETAILS RENDERER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Request Time-Off Form (shown for employee/self screens) */}
        {activeTab !== 'approvals' && (
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Calendar className="w-4 h-4 text-brand-600" />
              File Leave Request
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

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs text-slate-600">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Leave Type</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                >
                  <option value="Annual">Annual (Vacation)</option>
                  <option value="Sick">Sick (Medical)</option>
                  <option value="Casual">Casual / Personal</option>
                  <option value="Maternity">Maternity Leave</option>
                  <option value="Paternity">Paternity Leave</option>
                  <option value="Unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {totalDays > 0 && (
                <div className="p-2.5 bg-brand-50 rounded-lg text-brand-800 text-[11px] font-semibold flex items-center justify-between">
                  <span>Calculated Business Days:</span>
                  <span className="font-bold text-xs">{totalDays} working days</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Justification/Comment</label>
                <textarea
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  rows={3}
                  placeholder="Provide supporting statement or vacation reason..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit to Supervisor</span>
              </button>
            </form>
          </div>
        )}

        {/* RIGHT COLUMN: Interactive lists based on Active Tab */}
        <div className={`lg:col-span-2 space-y-4 ${activeTab === 'approvals' ? 'lg:col-span-3' : ''}`}>
          
          {/* A. MY LEAVES TABLE */}
          {activeTab === 'my-leaves' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h4 className="font-bold text-slate-900 text-sm">My Leave Request Log</h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-150">
                      <th className="px-5 py-3">Leave Details</th>
                      <th className="px-5 py-3">Duration</th>
                      <th className="px-5 py-3">Dates</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {myLeavesList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                          You haven't filed any leave requests yet.
                        </td>
                      </tr>
                    ) : (
                      myLeavesList.map(l => (
                        <tr key={l.leaveRequestId} className="hover:bg-slate-50/30">
                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-900 block">{l.leaveType} Leave</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5 max-w-xs truncate" title={l.comment}>
                              "{l.comment || 'No explanation provided'}"
                            </span>
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-800">{l.totalDays} Business Days</td>
                          <td className="px-5 py-4 font-mono text-[11px] text-slate-500">
                            {l.startDate} to {l.endDate}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              l.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                              l.status === 'Pending' ? 'bg-amber-50 text-amber-700 animate-pulse' :
                              'bg-red-50 text-red-700'
                            }`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* B. MANAGER APPROVALS MATRIX */}
          {activeTab === 'approvals' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Time-Off Requests Requiring Action</h4>
                <span className="px-2 py-0.5 bg-amber-100 text-[10px] font-bold text-amber-700 rounded-full animate-pulse">
                  {pendingApprovals.length} pending
                </span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {pendingApprovals.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs">No pending leave requests. Excellent job!</p>
                  </div>
                ) : (
                  pendingApprovals.map((req) => (
                    <div key={req.leaveRequestId} className="p-5 hover:bg-slate-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{getRequesterName(req.employeeId)}</span>
                          <span className="text-[10px] text-slate-400">({getRequesterJob(req.employeeId)})</span>
                        </div>
                        
                        <div className="flex items-center space-x-2.5 text-[11px] text-slate-500">
                          <span className="font-bold text-brand-600 px-1.5 py-0.5 bg-brand-50 rounded">
                            {req.leaveType} Leave
                          </span>
                          <span>Duration: <strong>{req.totalDays} Days</strong> ({req.startDate} to {req.endDate})</span>
                        </div>

                        {req.comment && (
                          <p className="text-slate-500 text-[11px] italic mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 max-w-xl">
                            "{req.comment}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => handleDecision(req, false)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        
                        <button
                          onClick={() => handleDecision(req, true)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* C. COMPANY OUT OF OFFICE CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <h4 className="font-bold text-slate-900 text-sm">Active Absences Today</h4>
              </div>

              <div className="p-5 text-xs">
                {activeLeavesToday.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <CalendarDays className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                    No employees are currently logged out of office today.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeLeavesToday.map((lr) => (
                      <div key={lr.leaveRequestId} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start space-x-3">
                        <div className="w-8 h-8 rounded bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0 font-bold uppercase">
                          {getRequesterName(lr.employeeId).substring(0, 2)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{getRequesterName(lr.employeeId)}</span>
                          <span className="text-[10px] text-slate-400 block">{getRequesterJob(lr.employeeId)}</span>
                          <span className="text-[10px] text-brand-700 font-bold mt-1.5 inline-block bg-brand-50 border border-brand-100 px-1.5 py-0.5 rounded">
                            {lr.leaveType} Leave (to {lr.endDate})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
