import React, { useState, useEffect } from 'react';
import { UserRole, Attendance, Employee } from '../types';
import { 
  Clock, 
  CheckCircle, 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  ThumbsUp, 
  ThumbsDown,
  AlertCircle,
  FileCheck2,
  CalendarCheck2
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface AttendanceTrackingProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function AttendanceTracking({ currentUser, selectedTenantId }: AttendanceTrackingProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isApprover = ['CompanyAdmin', 'HRManager', 'LineManager', 'FinanceOfficer'].includes(currentUser.role);
  const isEmployeeOnly = currentUser.role === 'Employee';

  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [activeTab, setActiveTab] = useState<'my-attendance' | 'daily-register' | 'approvals'>('my-attendance');
  const [searchTerm, setSearchTerm] = useState('');

  // Clock state (self clock-in)
  const [myProfile, setMyProfile] = useState<Employee | null>(null);
  const [clockedInToday, setClockedInToday] = useState<Attendance | null>(null);
  const [clockActionLoading, setClockActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock ticking
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch records
  useEffect(() => {
    async function loadAttendanceData() {
      if (!companyId) return;
      try {
        // Fetch Employees
        const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const empList: Employee[] = [];
        empSnap.forEach(d => empList.push({ ...d.data() as Employee, employeeId: d.id }));
        setEmployees(empList);

        const activeEmp = empList.find(e => e.email === currentUser.email);
        if (activeEmp) setMyProfile(activeEmp);

        // Fetch Attendance Log
        const attSnap = await getDocs(collection(db, `companies/${companyId}/attendance`));
        const attList: Attendance[] = [];
        attSnap.forEach(d => attList.push({ ...d.data() as Attendance, attendanceId: d.id }));
        
        // Sort attendance records by date descending
        attList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAttendance(attList);

        // Check if clocked in today
        if (activeEmp) {
          const todayStr = new Date().toISOString().split('T')[0];
          const todayClock = attList.find(a => a.employeeId === activeEmp.employeeId && a.date === todayStr);
          setClockedInToday(todayClock || null);
        }

        // Set default active tab based on role
        if (isApprover && !isEmployeeOnly) {
          setActiveTab('daily-register');
        } else {
          setActiveTab('my-attendance');
        }
      } catch (err) {
        console.error('Error loading attendance module:', err);
      }
    }
    loadAttendanceData();
  }, [companyId, isApprover, isEmployeeOnly, currentUser.email]);

  // Self Punch Clock Trigger
  const handleClockToggle = async () => {
    if (!companyId || !myProfile) return;
    setClockActionLoading(true);

    const todayStr = new Date().toISOString().split('T')[0];
    const isoNow = new Date().toISOString();

    try {
      if (!clockedInToday) {
        // Clock In
        const attId = 'att-' + Math.random().toString(36).substring(2, 9);
        const hour = new Date().getHours();
        const min = new Date().getMinutes();
        const isLate = (hour > 9) || (hour === 9 && min > 15); // Late if after 9:15 AM

        const newPunch: Attendance = {
          attendanceId: attId,
          companyId,
          employeeId: myProfile.employeeId,
          date: todayStr,
          clockIn: isoNow,
          status: isLate ? 'Late' : 'OnTime',
          createdAt: isoNow
        };

        await setDoc(doc(db, `companies/${companyId}/attendance`, attId), newPunch);
        setClockedInToday(newPunch);
        setAttendance([newPunch, ...attendance]);
      } else {
        // Clock Out
        const docRef = doc(db, `companies/${companyId}/attendance`, clockedInToday.attendanceId);
        const diffMs = Date.now() - new Date(clockedInToday.clockIn).getTime();
        const totalHrs = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

        const updated = {
          ...clockedInToday,
          clockOut: isoNow,
          timesheetHours: totalHrs
        };

        await updateDoc(docRef, {
          clockOut: isoNow,
          timesheetHours: totalHrs
        });

        setClockedInToday(updated);
        setAttendance(attendance.map(a => a.attendanceId === clockedInToday.attendanceId ? updated : a));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClockActionLoading(false);
    }
  };

  // Process Timesheet Approvals
  const handleApproveTimesheet = async (attRecord: Attendance, approve: boolean) => {
    if (!companyId) return;
    try {
      const docRef = doc(db, `companies/${companyId}/attendance`, attRecord.attendanceId);
      const approvedAt = new Date().toISOString();
      await updateDoc(docRef, {
        approvedBy: currentUser.uid,
        approvedAt
      });

      const updated = { ...attRecord, approvedBy: currentUser.uid, approvedAt };
      setAttendance(attendance.map(a => a.attendanceId === attRecord.attendanceId ? updated : a));
    } catch (err) {
      console.error(err);
    }
  };

  const getStaffName = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? `${emp.firstName} ${emp.lastName}` : empId;
  };

  const getStaffJob = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId);
    return emp ? emp.jobTitle : 'Staff';
  };

  // Filter attendance logs
  const myAttendanceList = attendance.filter(a => a.employeeId === myProfile?.employeeId);
  
  const filteredDailyRegister = attendance.filter(a => {
    const staffName = getStaffName(a.employeeId).toLowerCase();
    const matchesSearch = staffName.includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const pendingApprovals = attendance.filter(a => a.clockOut && !a.approvedBy);

  // Stats calculation
  const totalHoursWorkedSelf = myAttendanceList.reduce((acc, curr) => acc + (curr.timesheetHours || 0), 0);
  const onTimeCountSelf = myAttendanceList.filter(a => a.status === 'OnTime').length;
  const lateCountSelf = myAttendanceList.filter(a => a.status === 'Late').length;

  return (
    <div className="space-y-6 animate-slide-up" id="attendance-tracking-tab">
      
      {/* 1. HEADER ROW */}
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900">Time & Attendance</h2>
        <p className="text-xs text-slate-500">Log daily working check-ins, manage timesheets, and approve hours clocked.</p>
      </div>

      {/* 2. DYNAMIC TAB CONTROLLERS */}
      <div className="border-b border-slate-200 flex space-x-4">
        {(!isApprover || isEmployeeOnly) && (
          <button
            onClick={() => setActiveTab('my-attendance')}
            className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === 'my-attendance' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            My Punch Cards
          </button>
        )}

        {isApprover && (
          <>
            <button
              onClick={() => setActiveTab('daily-register')}
              className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                activeTab === 'daily-register' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Daily Attendance Registers
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                activeTab === 'approvals' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Timesheet Approvals ({pendingApprovals.length})
            </button>
          </>
        )}
      </div>

      {/* 3. MODULE RENDER GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Punch clock station (always visible to employees/my attendance) */}
        {activeTab === 'my-attendance' && (
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 h-fit">
            <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Clock className="text-brand-500 w-4.5 h-4.5" />
              Punches Station
            </h3>

            <div className="text-center py-6">
              <span className="text-3xl font-mono font-bold text-slate-900 block tracking-tight">
                {currentTime.toLocaleTimeString()}
              </span>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <button
              onClick={handleClockToggle}
              disabled={clockActionLoading || !myProfile}
              className={`w-full py-3 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                clockedInToday 
                  ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100' 
                  : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/10'
              }`}
            >
              {clockActionLoading ? 'Saving...' : (clockedInToday ? 'Clock Out' : 'Clock In')}
            </button>

            {clockedInToday && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between">
                  <span>Clock In:</span>
                  <span className="font-mono font-bold text-slate-950">
                    {new Date(clockedInToday.clockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Punch Status:</span>
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                    clockedInToday.status === 'OnTime' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {clockedInToday.status}
                  </span>
                </div>
              </div>
            )}

            {/* Self Attendance summary */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Total Hours</span>
                <span className="text-sm font-mono font-bold text-slate-800 block mt-1">{totalHoursWorkedSelf.toFixed(1)}</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">On Time</span>
                <span className="text-sm font-mono font-bold text-emerald-600 block mt-1">{onTimeCountSelf}</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Late</span>
                <span className="text-sm font-mono font-bold text-amber-600 block mt-1">{lateCountSelf}</span>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: Tab lists */}
        <div className={`lg:col-span-2 ${activeTab !== 'my-attendance' ? 'lg:col-span-3' : ''}`}>
          
          {/* A. MY PUNCH CARDS HISTORICAL TABLE */}
          {activeTab === 'my-attendance' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">My Attendance History</h4>
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-150">
                      <th className="px-5 py-3">Work Date</th>
                      <th className="px-5 py-3">Clock In</th>
                      <th className="px-5 py-3">Clock Out</th>
                      <th className="px-5 py-3">Hours Clocked</th>
                      <th className="px-5 py-3">Punch Status</th>
                      <th className="px-5 py-3">Approver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {myAttendanceList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                          You haven't logged any attendance punches yet.
                        </td>
                      </tr>
                    ) : (
                      myAttendanceList.map(a => (
                        <tr key={a.attendanceId} className="hover:bg-slate-50/20">
                          <td className="px-5 py-3.5 font-bold text-slate-900">{a.date}</td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                            {new Date(a.clockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                            {a.clockOut 
                              ? new Date(a.clockOut).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              : 'Punch Active'
                            }
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {a.timesheetHours ? `${a.timesheetHours} Hours` : '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              a.status === 'OnTime' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-500">
                            {a.approvedBy ? (
                              <span className="text-emerald-600 flex items-center gap-1 font-bold">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Approved
                              </span>
                            ) : (
                              'Pending'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* B. COMPANY-WIDE REGISTER */}
          {activeTab === 'daily-register' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h4 className="font-bold text-slate-900 text-sm">Timesheets Registry Log</h4>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search register by staff name..."
                    className="pl-8 pr-3 py-1 border border-slate-200 rounded text-xs bg-white focus:outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-150">
                      <th className="px-5 py-3">Employee Name</th>
                      <th className="px-5 py-3">Work Date</th>
                      <th className="px-5 py-3">Clock In / Out</th>
                      <th className="px-5 py-3">Hours Logged</th>
                      <th className="px-5 py-3">Punch Status</th>
                      <th className="px-5 py-3 text-right">Approval Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {filteredDailyRegister.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                          No daily register records logged.
                        </td>
                      </tr>
                    ) : (
                      filteredDailyRegister.map((att) => (
                        <tr key={att.attendanceId} className="hover:bg-slate-50/20">
                          <td className="px-5 py-3.5">
                            <div>
                              <span className="font-bold text-slate-900 block">{getStaffName(att.employeeId)}</span>
                              <span className="text-[10px] text-slate-400 block">{getStaffJob(att.employeeId)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-900">{att.date}</td>
                          <td className="px-5 py-3.5 text-[10px] text-slate-500">
                            <span className="block font-semibold">In: {new Date(att.clockIn).toLocaleTimeString()}</span>
                            {att.clockOut && (
                              <span className="block text-slate-400">Out: {new Date(att.clockOut).toLocaleTimeString()}</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {att.timesheetHours ? `${att.timesheetHours} Hours` : 'Punch Active'}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              att.status === 'OnTime' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {att.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold">
                            {att.approvedBy ? (
                              <span className="text-emerald-600 inline-flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Verified
                              </span>
                            ) : (
                              <span className="text-slate-400">Unverified</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* C. TIMESHEETS APPROVAL QUEUE */}
          {activeTab === 'approvals' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <h4 className="font-bold text-slate-900 text-sm">Clocked Timesheets Awaiting Validation</h4>
              </div>

              <div className="divide-y divide-slate-100 text-xs text-slate-600">
                {pendingApprovals.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    All employee punches have been verified and processed!
                  </div>
                ) : (
                  pendingApprovals.map((att) => (
                    <div key={att.attendanceId} className="p-4 hover:bg-slate-50/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="font-bold text-sm text-slate-900">{getStaffName(att.employeeId)}</span>
                        <div className="flex items-center space-x-2.5 text-[11px] text-slate-500">
                          <span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">Date: {att.date}</span>
                          <span>In: <strong>{new Date(att.clockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</strong></span>
                          <span>Out: <strong>{att.clockOut ? new Date(att.clockOut).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></span>
                        </div>
                        <span className="text-[11px] block text-brand-600 font-bold">Total Work session: {att.timesheetHours} Hours</span>
                      </div>

                      <button
                        onClick={() => handleApproveTimesheet(att, true)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        Verify Hours
                      </button>
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
