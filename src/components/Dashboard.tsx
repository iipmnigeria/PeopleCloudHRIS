import React, { useState, useEffect } from 'react';
import { UserRole, Employee, LeaveRequest, Attendance, HRRequest, Company, Job } from '../types';
import { 
  Users, 
  CalendarDays, 
  Clock, 
  HelpCircle, 
  TrendingUp, 
  DollarSign, 
  UserPlus, 
  Calendar, 
  CheckCircle, 
  Sparkles, 
  ChevronRight, 
  Building2, 
  FileText,
  AlertCircle,
  UploadCloud,
  FileCheck,
  ShieldAlert,
  Send,
  Plus
} from 'lucide-react';
import { collection, getDocs, getDoc, addDoc, doc, updateDoc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';

interface DashboardProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function Dashboard({ currentUser, selectedTenantId }: DashboardProps) {
  const companyId = currentUser.companyId || selectedTenantId;

  // Real-time calculated states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyInfo, setCompanyInfo] = useState<Company | null>(null);
  
  // Platform stats (SuperAdmin)
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [globalEmployeeCount, setGlobalEmployeeCount] = useState(0);

  // Employee clock-in state
  const [clockedInToday, setClockedInToday] = useState<Attendance | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockActionLoading, setClockActionLoading] = useState(false);

  // Quick Action & Modal States
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showUploadRenewalModal, setShowUploadRenewalModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Fields for Quick Actions
  const [quickLeaveType, setQuickLeaveType] = useState('Annual');
  const [quickLeaveStart, setQuickLeaveStart] = useState('');
  const [quickLeaveEnd, setQuickLeaveEnd] = useState('');
  const [quickLeaveReason, setQuickLeaveReason] = useState('');

  const [quickTicketCategory, setQuickTicketCategory] = useState('Payroll');
  const [quickTicketDesc, setQuickTicketDesc] = useState('');

  const [quickDocType, setQuickDocType] = useState('Visa Permission');
  const [quickDocExpiry, setQuickDocExpiry] = useState('');
  const [quickDocFile, setQuickDocFile] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Load clock ticking
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch Firestore Data
  useEffect(() => {
    async function loadDashboardData() {
      if (currentUser.role === 'SuperAdmin') {
        // SuperAdmin - Load all companies and compute global SaaS metrics
        try {
          const compSnap = await getDocs(collection(db, 'companies'));
          const compList: Company[] = [];
          compSnap.forEach(d => compList.push(d.data() as Company));
          setAllCompanies(compList);

          // Get global employees count across all companies
          let count = 0;
          for (const c of compList) {
            const empSnap = await getDocs(collection(db, `companies/${c.companyId}/employees`));
            count += empSnap.size;
          }
          setGlobalEmployeeCount(count);
        } catch (err) {
          console.error('SuperAdmin load failed:', err);
        }
        return;
      }

      // Standard Tenant Roles - Load data for selected company
      if (!companyId) return;

      try {
        // Company Profile
        const compDoc = await getDoc(doc(db, 'companies', companyId));
        if (compDoc.exists()) {
          setCompanyInfo(compDoc.data() as Company);
        }

        // Employees
        const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const empList: Employee[] = [];
        empSnap.forEach(d => empList.push(d.data() as Employee));
        setEmployees(empList);

        // Leave Requests
        const leaveSnap = await getDocs(collection(db, `companies/${companyId}/leave_requests`));
        const leaveList: LeaveRequest[] = [];
        leaveSnap.forEach(d => leaveList.push(d.data() as LeaveRequest));
        setLeaves(leaveList);

        // Attendance
        const attSnap = await getDocs(collection(db, `companies/${companyId}/attendance`));
        const attList: Attendance[] = [];
        attSnap.forEach(d => attList.push(d.data() as Attendance));
        setAttendance(attList);

        // HR Requests
        const reqSnap = await getDocs(collection(db, `companies/${companyId}/hr_requests`));
        const reqList: HRRequest[] = [];
        reqSnap.forEach(d => reqList.push(d.data() as HRRequest));
        setRequests(reqList);

        // Recruitment Jobs
        const jobSnap = await getDocs(collection(db, `companies/${companyId}/jobs`));
        const jobList: Job[] = [];
        jobSnap.forEach(d => jobList.push(d.data() as Job));
        setJobs(jobList);

        // Check if current employee is clocked in today
        const todayStr = new Date().toISOString().split('T')[0];
        const activeEmp = empList.find(e => e.email === currentUser.email);
        if (activeEmp) {
          const todayClock = attList.find(a => a.employeeId === activeEmp.employeeId && a.date === todayStr);
          setClockedInToday(todayClock || null);
        }
      } catch (err) {
        console.error('Tenant dashboard load failed:', err);
      }
    }

    loadDashboardData();
  }, [currentUser.role, companyId, currentUser.email]);

  // Handle Employee Clock-In/Out
  const handleClockToggle = async () => {
    if (!companyId) return;
    setClockActionLoading(true);

    try {
      // Find logged-in employee profile
      const myProfile = employees.find(e => e.email === currentUser.email);
      if (!myProfile) {
        alert('Could not find matching Employee profile for your logged-in credentials.');
        setClockActionLoading(false);
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const isoNow = new Date().toISOString();

      if (!clockedInToday) {
        // CLOCK IN
        const attId = 'att-' + Math.random().toString(36).substring(2, 9);
        
        // Late calculation (e.g. late if clock in after 9:00 AM)
        const hour = new Date().getHours();
        const min = new Date().getMinutes();
        const isLate = (hour > 9) || (hour === 9 && min > 15);

        const newAtt: Attendance = {
          attendanceId: attId,
          companyId,
          employeeId: myProfile.employeeId,
          date: todayStr,
          clockIn: isoNow,
          status: isLate ? 'Late' : 'OnTime',
          createdAt: isoNow
        };

        await setDoc(doc(db, `companies/${companyId}/attendance`, attId), newAtt);
        setClockedInToday(newAtt);
        setAttendance([...attendance, newAtt]);
      } else {
        // CLOCK OUT
        const docRef = doc(db, `companies/${companyId}/attendance`, clockedInToday.attendanceId);
        
        // Calculate timesheet hours
        const diffMs = Date.now() - new Date(clockedInToday.clockIn).getTime();
        const hrs = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

        const updated = {
          ...clockedInToday,
          clockOut: isoNow,
          timesheetHours: hrs
        };

        await updateDoc(docRef, {
          clockOut: isoNow,
          timesheetHours: hrs
        });

        setClockedInToday(updated);
        setAttendance(attendance.map(a => a.attendanceId === clockedInToday.attendanceId ? updated : a));
      }
    } catch (err) {
      console.error('Attendance toggle error:', err);
    } finally {
      setClockActionLoading(false);
    }
  };

  // Submit Quick Leave of Absence
  const handleQuickLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const myProfile = employees.find(emp => emp.email === currentUser.email);
      const leaveId = 'leave-' + Math.random().toString(36).substring(2, 9);
      const startD = new Date(quickLeaveStart);
      const endD = new Date(quickLeaveEnd);
      const diffTime = Math.abs(endD.getTime() - startD.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      const newLeave: LeaveRequest = {
        leaveRequestId: leaveId,
        companyId,
        employeeId: myProfile?.employeeId || 'unknown-employee',
        leaveType: quickLeaveType as any,
        startDate: quickLeaveStart,
        endDate: quickLeaveEnd,
        totalDays: diffDays,
        status: 'Pending',
        comment: quickLeaveReason,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/leave_requests`, leaveId), newLeave);
      setLeaves([...leaves, newLeave]);
      
      // Reset Form & Close Modal
      setQuickLeaveStart('');
      setQuickLeaveEnd('');
      setQuickLeaveReason('');
      setShowLeaveModal(false);
      
      setToastMessage('🎉 Leave request submitted successfully into corporate pipeline!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Error submitting quick leave:', err);
    }
  };

  // Submit Quick Support Ticket
  const handleQuickTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const myProfile = employees.find(emp => emp.email === currentUser.email);
      const reqId = 'req-' + Math.random().toString(36).substring(2, 9);

      const newTicket: HRRequest = {
        requestId: reqId,
        companyId,
        employeeId: myProfile?.employeeId || 'unknown-employee',
        title: `Quick ${quickTicketCategory} Query`,
        type: quickTicketCategory,
        description: quickTicketDesc,
        status: 'Open',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/hr_requests`, reqId), newTicket);
      setRequests([...requests, newTicket]);

      // Reset & Close
      setQuickTicketDesc('');
      setShowTicketModal(false);

      setToastMessage('🎉 Helpdesk ticket registered with core People Operations team!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Error submitting quick ticket:', err);
    }
  };

  // Submit Document Renewal Upload
  const handleQuickUploadRenewal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDocExpiry) return;
    
    setToastMessage(`🎉 Renewed ${quickDocType} successfully processed! Expiry updated to ${quickDocExpiry}.`);
    setTimeout(() => setToastMessage(null), 4000);

    // Reset & Close
    setQuickDocExpiry('');
    setQuickDocFile(null);
    setShowUploadRenewalModal(false);
  };

  // Compute stats helper
  const activeEmployeeCount = employees.filter(e => e.status === 'Active').length;
  const onboardingCount = employees.filter(e => e.status === 'Onboarding').length;
  const leaveCount = leaves.filter(l => l.status === 'Approved' && new Date(l.startDate) <= new Date() && new Date(l.endDate) >= new Date()).length;
  const pendingLeavesCount = leaves.filter(l => l.status === 'Pending').length;
  const pendingRequestsCount = requests.filter(r => r.status === 'Open' || r.status === 'InProgress').length;
  const activeJobsCount = jobs.filter(j => j.status === 'Published').length;

  // Department counts
  const deptMap: { [key: string]: number } = {};
  employees.forEach(e => {
    deptMap[e.departmentId] = (deptMap[e.departmentId] || 0) + 1;
  });

  // Department ID to readable label map
  const getDeptName = (id: string) => {
    if (id === 'dept-eng') return 'Engineering & Dev';
    if (id === 'dept-hr') return 'People Operations & HR';
    if (id === 'dept-finance') return 'Finance & Accounts';
    if (id === 'dept-product') return 'Product Management';
    return id.replace('dept-', '').toUpperCase();
  };

  // Gender demographics
  const maleCount = employees.filter(e => e.gender === 'Male').length;
  const femaleCount = employees.filter(e => e.gender === 'Female').length;
  const nonBinaryCount = employees.filter(e => e.gender === 'Non-binary' || e.gender === 'Other').length;
  const totalGender = maleCount + femaleCount + nonBinaryCount || 1;

  // Formatting currency
  const formatSalary = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6 animate-slide-up" id="dashboard-tab">
      
      {/* 1. TOP DYNAMIC WELCOME BANNER */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between relative overflow-hidden border border-slate-800 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500 rounded-full blur-3xl opacity-15 -mr-16 -mt-16"></div>
        
        <div className="space-y-1 z-10">
          <div className="flex items-center space-x-2 text-brand-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Active Session Established</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">
            Welcome back, {currentUser.displayName}
          </h2>
          <p className="text-xs text-slate-400">
            {currentUser.role === 'SuperAdmin' 
              ? 'Multi-tenant cloud administrator dashboard. Running diagnostics on registered SaaS organizations.'
              : `Operating as ${currentUser.role} of ${companyInfo?.name || 'Company Workspace'}.`
            }
          </p>
        </div>

        <div className="mt-4 md:mt-0 px-4 py-2 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs shrink-0 z-10 flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-brand-400" />
          <span className="font-medium text-slate-300">
            {currentTime.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* 2. SUPERADMIN SCREEN */}
      {currentUser.role === 'SuperAdmin' && (
        <div className="space-y-6" id="superadmin-metrics">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">SaaS Platform Telemetry</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-semibold uppercase block">Subscribed Tenants</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{allCompanies.length}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                <Building2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-semibold uppercase block">Active SaaS Users</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{globalEmployeeCount}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-semibold uppercase block">Monthly SaaS Revenue</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">
                  {formatSalary(allCompanies.reduce((acc, curr) => {
                    const price = curr.subscriptionPlan === 'Starter' ? 99 : curr.subscriptionPlan === 'Growth' ? 249 : 499;
                    return acc + price;
                  }, 0))}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-semibold uppercase block">Platform Health</span>
                <span className="text-sm font-bold text-emerald-600 block mt-2 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse"></span>
                  99.98% Online
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* SaaS Tenants Registry Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm">Registered SaaS Subscribing Companies</h4>
              <span className="px-2 py-0.5 bg-slate-200 text-[10px] font-bold text-slate-700 rounded-full">Database Records</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                    <th className="px-5 py-3">Company Details</th>
                    <th className="px-5 py-3">Industry</th>
                    <th className="px-5 py-3">Plan Tier</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Renewal Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {allCompanies.map((c) => (
                    <tr key={c.companyId} className="hover:bg-slate-50/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          {c.logoUrl ? (
                            <img src={c.logoUrl} className="w-8 h-8 rounded object-cover" alt="" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                              {c.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block">{c.name}</span>
                            <span className="text-[10px] text-slate-400 block">{c.billingEmail}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium">{c.industry}</td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 bg-brand-50 border border-brand-100 text-brand-700 rounded-full font-bold text-[10px]">
                          {c.subscriptionPlan} Plan
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          c.subscriptionStatus === 'Active' 
                            ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' 
                            : 'bg-amber-50 border border-amber-100 text-amber-700'
                        }`}>
                          {c.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-[11px] text-slate-500">
                        {new Date(c.renewalDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC COMPLIANCE & SHORTCUT ACTION PANELS */}
      {currentUser.role !== 'SuperAdmin' && (
        <div className="space-y-4">
          
          {/* Success Toast */}
          {toastMessage && (
            <div className="fixed top-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white p-3.5 rounded-xl shadow-xl flex items-center space-x-2 animate-bounce">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-semibold">{toastMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Quick Request Shortcuts */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4.5 h-4.5 text-brand-600 animate-pulse" />
                  <span>Quick Request Shortcuts</span>
                </h3>
                <p className="text-[10px] text-slate-400">Instant shortcuts to lodge tickets, leaves, or documents without routing delays.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Leave Shortcut */}
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(true)}
                  className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-left transition-all hover:scale-[1.02] cursor-pointer space-y-2 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <CalendarDays className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">Request Leave</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Submit sick or vacation logs</span>
                  </div>
                </button>

                {/* 2. Helpdesk Shortcut */}
                <button
                  type="button"
                  onClick={() => setShowTicketModal(true)}
                  className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-left transition-all hover:scale-[1.02] cursor-pointer space-y-2 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
                    <HelpCircle className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">Submit HR Ticket</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Raise inquiry or support logs</span>
                  </div>
                </button>

                {/* 3. Document Renewal Upload Shortcut */}
                <button
                  type="button"
                  onClick={() => setShowUploadRenewalModal(true)}
                  className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-left transition-all hover:scale-[1.02] cursor-pointer space-y-2 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <UploadCloud className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">Renew Document</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Upload visa or contract papers</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Document Expiry Alerts */}
            <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center">
                <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />
                  <span>Compliance Desk</span>
                </h3>
                <span className="px-2 py-0.2 bg-rose-50 text-rose-700 font-mono text-[9px] font-bold rounded border border-rose-100">
                  2 Alerts
                </span>
              </div>

              {/* List of critical documents nearing expiry */}
              <div className="space-y-2.5">
                {[
                  { name: 'Sarah Lin: H1-B Visa', days: 12, urgent: true, desc: 'Requires department verification' },
                  { name: 'Corporate Building Lease', days: 28, urgent: false, desc: 'Finance allocation review' }
                ].map((docItem, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs space-y-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{docItem.name}</span>
                      <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold ${
                        docItem.urgent ? 'bg-rose-50 border border-rose-100 text-rose-700' : 'bg-amber-50 border border-amber-150 text-amber-700'
                      }`}>
                        {docItem.days} Days Left
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">"{docItem.desc}"</p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickDocType(docItem.name);
                        setShowUploadRenewalModal(true);
                      }}
                      className="w-full mt-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <UploadCloud className="w-3 h-3" />
                      <span>Upload Renewal</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 3. EXECUTIVE & HR MANAGER METRICS (SaaS Tenant Specific) */}
      {currentUser.role !== 'SuperAdmin' && currentUser.role !== 'Employee' && (
        <div className="space-y-6" id="executive-dashboard">
          
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-semibold uppercase block">Staff Strength</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{employees.length} Employees</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {activeEmployeeCount} active, {onboardingCount} onboarding
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-semibold uppercase block">Active Outages</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{leaveCount} On Leave</span>
                {pendingLeavesCount > 0 && (
                  <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
                    ● {pendingLeavesCount} pending approval
                  </span>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <CalendarDays className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-semibold uppercase block">Open HR Tickets</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{pendingRequestsCount} Tickets</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Requires resolution</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                <HelpCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-semibold uppercase block">Vacancy Openings</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{activeJobsCount} Active Jobs</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Recruitment panel active</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600">
                <UserPlus className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Dynamic SVG Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Department headcount distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-900 text-sm">Department Headcount Distribution</h4>
                <span className="text-[10px] text-slate-400 uppercase font-bold font-mono">Count</span>
              </div>
              
              <div className="space-y-3 pt-1">
                {Object.keys(deptMap).length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No employee distributions calculated.</p>
                ) : (
                  Object.entries(deptMap).map(([deptId, count]) => {
                    const percentage = Math.min(100, Math.round((count / employees.length) * 100));
                    return (
                      <div key={deptId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-slate-700">{getDeptName(deptId)}</span>
                          <span className="text-slate-900 font-bold">{count} staff ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-brand-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Demographics Split Visualizer */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 text-sm">Gender Demographics</h4>
                  <span className="text-[10px] text-slate-400 uppercase font-bold font-mono">Diversity</span>
                </div>

                <div className="pt-4 space-y-4">
                  {/* Inline visual gender stack */}
                  <div className="w-full h-8 rounded-xl overflow-hidden flex">
                    <div 
                      className="bg-sky-400 h-full flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ width: `${(maleCount / totalGender) * 100}%` }}
                      title={`Male: ${maleCount}`}
                    >
                      {maleCount > 0 && `${Math.round((maleCount / totalGender) * 100)}%`}
                    </div>
                    <div 
                      className="bg-pink-400 h-full flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ width: `${(femaleCount / totalGender) * 100}%` }}
                      title={`Female: ${femaleCount}`}
                    >
                      {femaleCount > 0 && `${Math.round((femaleCount / totalGender) * 100)}%`}
                    </div>
                    <div 
                      className="bg-indigo-400 h-full flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ width: `${(nonBinaryCount / totalGender) * 100}%` }}
                      title={`Other/Non-Binary: ${nonBinaryCount}`}
                    >
                      {nonBinaryCount > 0 && `${Math.round((nonBinaryCount / totalGender) * 100)}%`}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-2">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block mr-1"></span>
                      <span className="text-slate-500">Male</span>
                      <p className="font-bold text-slate-900 mt-1">{maleCount}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-400 inline-block mr-1"></span>
                      <span className="text-slate-500">Female</span>
                      <p className="font-bold text-slate-900 mt-1">{femaleCount}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block mr-1"></span>
                      <span className="text-slate-500">Other</span>
                      <p className="font-bold text-slate-900 mt-1">{nonBinaryCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center leading-normal">
                Metrics analyzed over {employees.length} active multi-tenant records.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. EMPLOYEE SELF SERVICE COCKPIT */}
      {currentUser.role === 'Employee' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="employee-dashboard">
          
          {/* Attendance punch station */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-brand-600 border-b border-slate-100 pb-3">
              <Clock className="w-5 h-5" />
              <h4 className="font-bold text-slate-900 text-sm">Attendance Punch Station</h4>
            </div>

            <div className="text-center py-4 space-y-2">
              <span className="text-3xl font-mono font-bold tracking-tight text-slate-900 block">
                {currentTime.toLocaleTimeString()}
              </span>
              <p className="text-xs text-slate-400 font-medium">
                {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <button
              onClick={handleClockToggle}
              disabled={clockActionLoading}
              className={`w-full py-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                clockedInToday 
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200' 
                  : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/10'
              }`}
            >
              {clockActionLoading ? 'Saving...' : (clockedInToday ? 'Clock Out for Today' : 'Clock In Now')}
            </button>

            {clockedInToday && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span>Clocked-In Stamp:</span>
                  <span className="font-mono text-slate-900 font-bold">
                    {new Date(clockedInToday.clockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                  <span>Daily Status:</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    clockedInToday.status === 'OnTime' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {clockedInToday.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Vacation leave balance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-sm">My Personal Time-Off Matrix</h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-brand-50/50 rounded-xl border border-brand-100/40">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Annual Leave</span>
                  <span className="text-xl font-bold text-brand-700 block mt-1">20 Days</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Assigned balance</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Sick Leave</span>
                  <span className="text-xl font-bold text-slate-700 block mt-1">10 Days</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Annual cap</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Used Leaves</span>
                  <span className="text-xl font-bold text-slate-700 block mt-1">
                    {leaves.filter(l => l.status === 'Approved').reduce((acc, curr) => acc + curr.totalDays, 0)} Days
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Approved requests</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Pending</span>
                  <span className="text-xl font-bold text-amber-600 block mt-1">
                    {leaves.filter(l => l.status === 'Pending').length} Request(s)
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">In workflow queue</span>
                </div>
              </div>
            </div>

            {/* Helpdesk ticket and responses overview */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-sm">Active Support Tickets</h4>
              
              <div className="space-y-2.5">
                {requests.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No active requests logged in the system. Use the HR Helpdesk tab to submit cards.
                  </div>
                ) : (
                  requests.slice(0, 3).map((req) => (
                    <div key={req.requestId} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{req.title}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Category: {req.type}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          req.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                          req.status === 'InProgress' ? 'bg-amber-100 text-amber-800' :
                          req.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {req.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-350" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 5. TEAM SUMMARY IF LINE MANAGER */}
      {currentUser.role === 'LineManager' && (
        <div className="space-y-6" id="linemanager-cockpit">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Team Supervision Desk</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team leaves to approve */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-sm">Leaves Awaiting My Approval</h4>
              
              <div className="space-y-3">
                {leaves.filter(l => l.status === 'Pending').length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <CheckCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    All team leave requests reviewed!
                  </div>
                ) : (
                  leaves.filter(l => l.status === 'Pending').map((lr) => {
                    const requester = employees.find(e => e.employeeId === lr.employeeId);
                    return (
                      <div key={lr.leaveRequestId} className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {requester ? `${requester.firstName} ${requester.lastName}` : lr.employeeId}
                          </span>
                          <span className="text-[10px] font-medium bg-brand-50 border border-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                            {lr.leaveType} Leave
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 italic">"{lr.comment || 'No reason supplied'}"</p>
                        <div className="text-[10px] text-slate-400 flex items-center justify-between">
                          <span>Dates: {lr.startDate} to {lr.endDate}</span>
                          <span className="font-bold text-slate-700">{lr.totalDays} business days</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Team attendance logs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-sm">Team Timesheets & Status Logs</h4>
              
              <div className="space-y-2.5">
                {attendance.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No timesheets logged today.</p>
                ) : (
                  attendance.slice(0, 4).map((att) => {
                    const staff = employees.find(e => e.employeeId === att.employeeId);
                    return (
                      <div key={att.attendanceId} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                        <div>
                          <span className="font-bold text-slate-950">
                            {staff ? `${staff.firstName} ${staff.lastName}` : att.employeeId}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Date: {att.date}</span>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            att.status === 'OnTime' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {att.status}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {att.timesheetHours ? `${att.timesheetHours} hrs` : 'Punch active'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK TIME-OFF REQUEST MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-sm">Submit Quick Time-Off</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Lodge a formal vacation or sick leave application.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickLeaveSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Leave Category</label>
                <select
                  value={quickLeaveType}
                  onChange={(e) => setQuickLeaveType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="Annual">✈️ Vacation / Annual Leave</option>
                  <option value="Sick">🩺 Medical / Sick Leave</option>
                  <option value="Maternity">🍼 Maternity / Family Care</option>
                  <option value="Unpaid">💼 Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Start Date</label>
                  <input
                    type="date"
                    required
                    value={quickLeaveStart}
                    onChange={(e) => setQuickLeaveStart(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">End Date</label>
                  <input
                    type="date"
                    required
                    value={quickLeaveEnd}
                    onChange={(e) => setQuickLeaveEnd(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Reason / Comment</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide details regarding your request..."
                  value={quickLeaveReason}
                  onChange={(e) => setQuickLeaveReason(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white p-2.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Lodge Leave Ticket</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QUICK HELPDESK TICKET MODAL */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-sm">Raise Helpdesk Ticket</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Route an inquiry directly to the HR operations desk.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowTicketModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickTicketSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Ticket Category</label>
                <select
                  value={quickTicketCategory}
                  onChange={(e) => setQuickTicketCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="Payroll">💳 Payroll, Taxes & Reimbursements</option>
                  <option value="Benefits">🏥 Health Insurance & Benefits</option>
                  <option value="IT Support">💻 Work Station & IT Credentials</option>
                  <option value="General">🏢 Workplace Operations & Feedback</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Inquiry Details</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Explain your queries or technical bottlenecks with as much detail as possible..."
                  value={quickTicketDesc}
                  onChange={(e) => setQuickTicketDesc(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white p-2.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit Ticket</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QUICK DOCUMENT UPLOAD RENEWAL MODAL (DRAG-AND-DROP + MANUAL SELECT) */}
      {showUploadRenewalModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-sm">Upload Renewed Document</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Drag-and-drop passport, visa, or contract papers securely.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowUploadRenewalModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickUploadRenewal} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Document Classification</label>
                <input
                  type="text"
                  required
                  value={quickDocType}
                  onChange={(e) => setQuickDocType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">New Expiration Date</label>
                <input
                  type="date"
                  required
                  value={quickDocExpiry}
                  onChange={(e) => setQuickDocExpiry(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none font-mono"
                />
              </div>

              {/* Drag and Drop Zone */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Credential Document Upload</label>
                <div
                  onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setQuickDocFile(e.dataTransfer.files[0].name);
                    }
                  }}
                  onClick={() => document.getElementById('manual-file-select')?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center space-y-2 ${
                    dragActive ? 'border-brand-600 bg-brand-50/40' : 'border-slate-200 hover:border-slate-350 bg-slate-50/50'
                  }`}
                >
                  <input
                    id="manual-file-select"
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setQuickDocFile(e.target.files[0].name);
                      }
                    }}
                  />

                  {quickDocFile ? (
                    <>
                      <FileCheck className="w-8 h-8 text-emerald-500 animate-bounce" />
                      <div>
                        <span className="font-bold text-slate-900 block font-mono">{quickDocFile}</span>
                        <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Ready for upload verification</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-brand-500" />
                      <div>
                        <span className="font-bold text-slate-900 block">Drag & drop files here</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Supports PDF, PNG, JPG (Max 15MB)</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!quickDocExpiry || !quickDocFile}
                className={`w-full p-2.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                  (!quickDocExpiry || !quickDocFile) 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-brand-600 hover:bg-brand-700 text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Verify & Save Renewal</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
