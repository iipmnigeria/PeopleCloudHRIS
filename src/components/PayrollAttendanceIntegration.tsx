import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { CalendarCheck2, CheckCircle2, RefreshCw, Wand2 } from 'lucide-react';
import { db } from '../firebase';
import { Attendance, Employee, LeaveRequest, UserRole } from '../types';

type Props = { currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }; selectedTenantId: string };
type Adj = { id: string; period: string; employeeId: string; employeeName: string; employeeEmail?: string; workedHours: number; regularHours: number; overtimeHours: number; overtimePay: number; approvedPaidLeaveDays: number; unpaidLeaveDays: number; absentDays: number; unpaidLeaveDeduction: number; absenceDeduction: number; totalAdditions: number; totalDeductions: number; netAttendanceAdjustment: number };

function money(value: number, currency = 'NGN') { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0)); }
function inPeriod(dateText: string | undefined, period: string) { return String(dateText || '').startsWith(period); }
function overlapsPeriod(startDate: string, endDate: string, period: string) { const start = new Date(startDate); const end = new Date(endDate); const [y, m] = period.split('-').map(Number); const first = new Date(y, m - 1, 1); const last = new Date(y, m, 0); return start <= last && end >= first; }
function canManage(role: UserRole) { return ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer'].includes(role); }
function nameOf(e: Employee) { return `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || e.employeeId; }

export default function PayrollAttendanceIntegration({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const allowed = canManage(currentUser.role);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const standardMonthlyHours = 176;
  const standardMonthlyWorkDays = 22;
  const overtimeMultiplier = 1.5;

  async function loadData() {
    if (!companyId) return;
    try {
      const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
      const empRows: Employee[] = [];
      empSnap.forEach((item) => empRows.push({ ...(item.data() as Employee), employeeId: item.id }));
      setEmployees(empRows.filter((employee) => employee.status === 'Active' || employee.status === 'Onboarding'));
      const attSnap = await getDocs(collection(db, `companies/${companyId}/attendance`));
      const attRows: Attendance[] = [];
      attSnap.forEach((item) => attRows.push({ ...(item.data() as Attendance), attendanceId: item.id }));
      setAttendance(attRows);
      const leaveSnap = await getDocs(collection(db, `companies/${companyId}/leave_requests`));
      const leaveRows: LeaveRequest[] = [];
      leaveSnap.forEach((item) => leaveRows.push({ ...(item.data() as LeaveRequest), leaveRequestId: item.id }));
      setLeaves(leaveRows);
    } catch (error: any) { setMessage(`Unable to load attendance/leave data: ${error.message || error}`); }
  }

  useEffect(() => { loadData(); }, [companyId]);

  const adjustments = useMemo<Adj[]>(() => employees.map((employee) => {
    const base = Number(employee.baseSalary || 0);
    const hourly = base / standardMonthlyHours;
    const daily = base / standardMonthlyWorkDays;
    const att = attendance.filter((item) => item.employeeId === employee.employeeId && inPeriod(item.date, period));
    const approved = att.filter((item) => item.approvedBy || item.clockOut);
    const workedHours = Number(approved.reduce((sum, item) => sum + Number(item.timesheetHours || 0), 0).toFixed(2));
    const regularHours = Math.min(workedHours, standardMonthlyHours);
    const overtimeHours = Math.max(0, Number((workedHours - standardMonthlyHours).toFixed(2)));
    const overtimePay = Math.round(overtimeHours * hourly * overtimeMultiplier);
    const absentDays = att.filter((item) => item.status === 'Absent').length;
    const empLeaves = leaves.filter((leave) => leave.employeeId === employee.employeeId && leave.status === 'Approved' && overlapsPeriod(leave.startDate, leave.endDate, period));
    const unpaidLeaveDays = empLeaves.filter((leave) => leave.leaveType === 'Unpaid').reduce((sum, leave) => sum + Number(leave.totalDays || 0), 0);
    const approvedPaidLeaveDays = empLeaves.filter((leave) => leave.leaveType !== 'Unpaid').reduce((sum, leave) => sum + Number(leave.totalDays || 0), 0);
    const unpaidLeaveDeduction = Math.round(unpaidLeaveDays * daily);
    const absenceDeduction = Math.round(absentDays * daily);
    const totalAdditions = overtimePay;
    const totalDeductions = unpaidLeaveDeduction + absenceDeduction;
    return { id: `${period}-${employee.employeeId}`, period, employeeId: employee.employeeId, employeeName: nameOf(employee), employeeEmail: employee.email, workedHours, regularHours, overtimeHours, overtimePay, approvedPaidLeaveDays, unpaidLeaveDays, absentDays, unpaidLeaveDeduction, absenceDeduction, totalAdditions, totalDeductions, netAttendanceAdjustment: totalAdditions - totalDeductions };
  }), [employees, attendance, leaves, period]);

  const totals = useMemo(() => adjustments.reduce((acc, item) => { acc.overtime += item.overtimePay; acc.deductions += item.totalDeductions; acc.net += item.netAttendanceAdjustment; return acc; }, { overtime: 0, deductions: 0, net: 0 }), [adjustments]);

  async function publishAdjustments() {
    if (!companyId || !allowed) return;
    setSaving(true); setMessage('');
    try {
      await Promise.all(adjustments.map((item) => setDoc(doc(db, `companies/${companyId}/payroll_attendance_adjustments`, item.id), { ...item, companyId, source: 'attendance-leave-payroll-integration', standardMonthlyHours, standardMonthlyWorkDays, overtimeMultiplier, generatedBy: currentUser.uid, generatedAt: serverTimestamp() }, { merge: true })));
      setMessage(`${adjustments.length} payroll attendance/leave adjustment(s) published for ${period}.`);
    } catch (error: any) { setMessage(`Unable to publish adjustments: ${error.message || error}`); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6" id="payroll-attendance-integration"><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Item 7</p><h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><CalendarCheck2 className="w-5 h-5 text-indigo-600" />Attendance/Leave-to-Payroll Integration</h2><p className="text-xs text-slate-500 mt-1 max-w-3xl">Convert approved attendance hours, overtime, approved leave, unpaid leave and absences into payroll additions and deductions.</p></div><div className="flex flex-wrap gap-2"><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs" /><button onClick={loadData} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button></div></div>{message && <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs font-semibold text-indigo-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}<div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="Employees" value={adjustments.length} /><Metric label="Overtime Pay" value={money(totals.overtime)} /><Metric label="Leave/Absence Deduction" value={money(totals.deductions)} /><Metric label="Net Adjustment" value={money(totals.net)} /></div><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row gap-3 md:items-center justify-between"><div><p className="text-sm font-black text-slate-900">Publish Payroll Adjustments</p><p className="text-xs text-slate-500">Published adjustments are read by the Global Payroll Engine during payroll generation for the same period.</p></div><button onClick={publishAdjustments} disabled={!allowed || saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-2"><Wand2 className="w-4 h-4" />{saving ? 'Publishing...' : 'Publish to Payroll'}</button></div><div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Employee</th><th className="text-right p-3">Hours</th><th className="text-right p-3">Overtime</th><th className="text-right p-3">Paid Leave</th><th className="text-right p-3">Unpaid Leave</th><th className="text-right p-3">Absence</th><th className="text-right p-3">Net Adj.</th></tr></thead><tbody className="divide-y divide-slate-100">{adjustments.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="p-3"><p className="font-black text-slate-900">{item.employeeName}</p><p className="text-[10px] text-slate-400">{item.employeeEmail}</p></td><td className="p-3 text-right font-bold text-slate-900">{item.workedHours}</td><td className="p-3 text-right text-emerald-600 font-bold">{item.overtimeHours}h / {money(item.overtimePay)}</td><td className="p-3 text-right text-slate-700">{item.approvedPaidLeaveDays}</td><td className="p-3 text-right text-rose-600">{item.unpaidLeaveDays} / {money(item.unpaidLeaveDeduction)}</td><td className="p-3 text-right text-rose-600">{item.absentDays} / {money(item.absenceDeduction)}</td><td className={`p-3 text-right font-black ${item.netAttendanceAdjustment >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(item.netAttendanceAdjustment)}</td></tr>)}</tbody></table></div><div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-[11px] text-amber-800 leading-relaxed"><strong>Payroll policy note:</strong> This uses 176 monthly hours, 22 workdays and 1.5x overtime multiplier. A future policy screen can make these configurable.</div></div>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{value}</p></div>; }
