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
  const [activeTab, setActiveTab] = useState<'my-attendance' | 'daily-register' | 'approvals' | 'heatmap'>('my-attendance');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHeatday, setSelectedHeatday] = useState<number | null>(null);

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

        <button
          onClick={() => setActiveTab('heatmap')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeTab === 'heatmap' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          📊 Smart Presence Heatmap
        </button>
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

          {/* D. SMART ATTENDANCE HEATMAP APPLICATION */}
          {activeTab === 'heatmap' && (
            <div className="space-y-6 animate-fade-in" id="attendance-heatmap-view">
              
              {/* Top Analytical Badges */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">Average Presence Rate</span>
                  <span className="text-xl font-mono font-bold text-emerald-600">94.2%</span>
                  <p className="text-[10px] text-slate-500 mt-1">October average team presence ratio</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">Peak Punch-In Window</span>
                  <span className="text-xl font-mono font-bold text-slate-900">08:15 — 08:45 AM</span>
                  <p className="text-[10px] text-slate-500 mt-1">92% of staff clock-in within this block</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">Tardiness Index</span>
                  <span className="text-xl font-mono font-bold text-amber-600">5.8%</span>
                  <p className="text-[10px] text-slate-500 mt-1">Ratio of check-ins registered as 'Late'</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">Core Location Cluster</span>
                  <span className="text-xl font-mono font-bold text-indigo-600">88% Remote</span>
                  <p className="text-[10px] text-slate-500 mt-1">Presence registered from remote coordinates</p>
                </div>
              </div>

              {/* Main Heatmap Container */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 31-Day Attendance Density Calendar */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="font-display font-bold text-slate-900 text-sm">October Daily Presence Heatmap</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Click on any active calendar day to analyze detailed check-in rosters</p>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono font-bold rounded">
                      Month of Oct
                    </span>
                  </div>

                  {/* 31-Day Grid */}
                  <div className="grid grid-cols-7 gap-2 text-center text-xs">
                    {/* Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <span key={d} className="text-[9px] uppercase font-bold text-slate-400">{d}</span>
                    ))}

                    {/* blank offsets (October 1st starts on Thursday) */}
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={`blank-${i}`} className="aspect-square bg-slate-50/20 rounded"></div>
                    ))}

                    {/* Days 1 to 31 */}
                    {Array.from({ length: 31 }).map((_, i) => {
                      const dayNum = i + 1;
                      // Weekends are Saturday (Oct 3, 10, 17, 24, 31) and Sunday (Oct 4, 11, 18, 25)
                      const isWeekend = [3, 10, 17, 24, 31, 4, 11, 18, 25].includes(dayNum);
                      
                      let cellClass = "";
                      let tooltip = "";

                      if (isEmployeeOnly) {
                        // Employee view: show their individual record status
                        // Mock check: e.g. Day 2, 5, 6, 7 OnTime; Day 8, 12 Late; Weekends quiet
                        if (isWeekend) {
                          cellClass = "bg-slate-50 text-slate-400 border border-slate-100";
                          tooltip = "Weekend Off-day";
                        } else if ([2, 5, 6, 7, 13, 14, 15, 16, 20, 21, 22].includes(dayNum)) {
                          cellClass = "bg-emerald-500 text-white border border-emerald-600 font-bold hover:bg-emerald-600 shadow-sm";
                          tooltip = "OnTime check-in";
                        } else if ([8, 12, 19].includes(dayNum)) {
                          cellClass = "bg-amber-400 text-white border border-amber-500 font-bold hover:bg-amber-500 shadow-sm";
                          tooltip = "Late arrival";
                        } else {
                          cellClass = "bg-rose-100 text-rose-700 border border-rose-200 font-semibold hover:bg-rose-200";
                          tooltip = "Unexcused Absence";
                        }
                      } else {
                        // Manager view: show company-wide presence density ratios
                        if (isWeekend) {
                          cellClass = "bg-slate-50 text-slate-400 border border-slate-100";
                          tooltip = "Weekend Off-day";
                        } else if ([1, 2, 5, 6, 7, 14, 15, 21, 22, 28, 29].includes(dayNum)) {
                          cellClass = "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-bold border border-emerald-700";
                          tooltip = "95% - 100% Team Attendance (Peak)";
                        } else if ([8, 9, 12, 13, 16, 20, 23, 27, 30].includes(dayNum)) {
                          cellClass = "bg-emerald-400 text-slate-900 hover:bg-emerald-500 shadow-xs border border-emerald-500 font-semibold";
                          tooltip = "75% - 94% Team Attendance";
                        } else {
                          cellClass = "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-200 font-medium";
                          tooltip = "50% - 74% Attendance (Low)";
                        }
                      }

                      const isSelected = selectedHeatday === dayNum;

                      return (
                        <div
                          key={`heatday-${dayNum}`}
                          onClick={() => setSelectedHeatday(dayNum)}
                          title={tooltip}
                          className={`aspect-square rounded-lg flex items-center justify-center relative cursor-pointer transition-all ${cellClass} ${
                            isSelected ? 'ring-2 ring-brand-600 ring-offset-2 scale-110 z-10' : ''
                          }`}
                        >
                          <span>{dayNum}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Color scale bar */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3 border-t border-slate-100 font-mono">
                    <span>Low Presence (Absences / Off)</span>
                    <div className="flex gap-1">
                      <span className="w-4 h-4 bg-slate-100 border border-slate-200 rounded block" title="Weekend / Off-day"></span>
                      <span className="w-4 h-4 bg-amber-100 border border-amber-200 rounded block" title="50%-74% Attendance"></span>
                      <span className="w-4 h-4 bg-emerald-400 border border-emerald-500 rounded block" title="75%-94% Attendance"></span>
                      <span className="w-4 h-4 bg-emerald-600 border border-emerald-700 rounded block" title="95%-100% Presence"></span>
                    </div>
                    <span>High Presence (Peak OnTime)</span>
                  </div>
                </div>

                {/* Day detail popover sidebar */}
                <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center justify-between border-b border-slate-100 pb-2">
                    <span>Roster Audit</span>
                    {selectedHeatday ? (
                      <span className="px-2 py-0.5 bg-brand-50 border border-brand-100 text-brand-700 rounded text-[10px] font-mono font-bold">
                        Oct {selectedHeatday}, 2026
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">No day chosen</span>
                    )}
                  </h4>

                  {selectedHeatday ? (
                    <div className="space-y-4 animate-fade-in text-xs">
                      
                      {/* Metric widgets */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-slate-50 border border-slate-150 p-2 rounded-xl">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">Present</span>
                          <span className="text-sm font-bold text-emerald-700 font-mono">
                            {isEmployeeOnly ? "1 / 1" : "14 / 15 Staff"}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-150 p-2 rounded-xl">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">Late Punches</span>
                          <span className="text-sm font-bold text-amber-600 font-mono">
                            {isEmployeeOnly ? ([8, 12, 19].includes(selectedHeatday) ? "1" : "0") : "1 Late"}
                          </span>
                        </div>
                      </div>

                      {/* Status timeline list */}
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        <h5 className="font-bold uppercase text-[9px] text-slate-400 font-mono">Check-In Registry</h5>
                        
                        {isEmployeeOnly ? (
                          <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-900 block">My Check-In</span>
                              <span className="text-[10px] text-slate-400">Punches Coordinate: Active Web IP</span>
                            </div>
                            <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                              [2, 5, 6, 7, 13, 14, 15, 16, 20, 21, 22].includes(selectedHeatday) 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : ([8, 12, 19].includes(selectedHeatday) ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100')
                            }`}>
                              {[2, 5, 6, 7, 13, 14, 15, 16, 20, 21, 22].includes(selectedHeatday) ? "OnTime (08:31 AM)" : ([8, 12, 19].includes(selectedHeatday) ? "Late (09:44 AM)" : "Absent")}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="p-2 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-[11px]">
                              <div>
                                <span className="font-bold text-slate-900 block">Marcus Vance</span>
                                <span className="text-[10px] text-slate-400 block font-mono">08:05 AM — OnTime</span>
                              </div>
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            </div>
                            <div className="p-2 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-[11px]">
                              <div>
                                <span className="font-bold text-slate-900 block">Sarah Lin</span>
                                <span className="text-[10px] text-slate-400 block font-mono">08:14 AM — OnTime</span>
                              </div>
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            </div>
                            <div className="p-2 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-[11px]">
                              <div>
                                <span className="font-bold text-slate-900 block">David Kalu</span>
                                <span className="text-[10px] text-slate-400 block font-mono">09:32 AM — Late</span>
                              </div>
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                            </div>
                          </>
                        )}
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
                      Select a date block on the heatmap grid to trace operational check-in statistics.
                    </div>
                  )}
                </div>

              </div>

              {/* Weekly Hourly Distribution Matrix */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-slate-900 text-sm">Hourly Punch-In Distribution Matrix</h4>
                  <p className="text-[11px] text-slate-400">Weekly concentration showing hourly peak check-in intervals</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
                  {/* Monday to Friday columns representing hourly grids */}
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                    <div key={day} className="bg-slate-50/50 p-3 rounded-xl border border-slate-150 space-y-2 text-center">
                      <span className="font-bold text-slate-900 text-xs block border-b border-slate-100 pb-1">{day}</span>
                      
                      <div className="space-y-1.5 text-[10px]">
                        <div className="p-1 bg-emerald-600 text-white rounded font-mono font-bold" title="Peak interval">
                          08:00 AM — 95%
                        </div>
                        <div className="p-1 bg-emerald-400 text-slate-900 rounded font-mono font-medium" title="Medium interval">
                          09:00 AM — 42%
                        </div>
                        <div className="p-1 bg-slate-100 text-slate-500 rounded font-mono" title="Low interval">
                          10:00 AM — 12%
                        </div>
                        <div className="p-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono font-bold" title="Lunch break slot">
                          12:00 PM — 80%
                        </div>
                        <div className="p-1 bg-purple-50 text-purple-700 border border-purple-200 rounded font-mono font-bold" title="Check-out slot">
                          05:00 PM — 91%
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Informational advice */}
                  <div className="md:col-span-1 bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between text-left">
                    <span className="text-[9px] uppercase font-bold text-brand-400 font-mono block">Insight Engine</span>
                    <p className="text-[10px] leading-relaxed text-slate-300 italic">
                      "Highest login density concentrates between 08:00 AM and 08:30 AM on Mondays. Schedule standups post-09:15 AM to avoid bottleneck delays."
                    </p>
                    <span className="text-[9px] text-slate-400 font-mono block mt-2">Core HRIS AI Recommendation</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
