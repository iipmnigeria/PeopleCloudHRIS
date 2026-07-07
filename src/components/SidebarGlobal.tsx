import React, { useState } from 'react';
import { UserRole } from '../types';
import { Activity, Award, Briefcase, CalendarDays, Clock, Compass, Contact, CreditCard, FileCheck2, Globe, GraduationCap, HelpCircle, LayoutDashboard, Landmark, LogOut, Megaphone, Menu, Settings, Sparkles, Users, X } from 'lucide-react';

type SidebarProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  currentCompanyName: string;
  onLogout: () => void;
  allCompanies: Array<{ id: string; name: string; plan: string }>;
  selectedTenantId: string;
  setSelectedTenantId: (id: string) => void;
  onViewMarketing?: () => void;
};

export default function SidebarGlobal({ activeTab, setActiveTab, currentUser, currentCompanyName, onLogout, allCompanies, selectedTenantId, setSelectedTenantId, onViewMarketing }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'FinanceOfficer', 'Recruiter', 'Auditor'] },
    { id: 'analytics', label: 'HR Analytics', icon: Activity, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Auditor'] },
    { id: 'employees', label: 'Employee Database', icon: Users, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'FinanceOfficer', 'Auditor'] },
    { id: 'id-cards', label: 'Employee ID Cards', icon: Contact, roles: ['CompanyAdmin', 'HRManager', 'Employee', 'Auditor'] },
    { id: 'leave', label: 'Leave Manager', icon: CalendarDays, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Auditor'] },
    { id: 'attendance', label: 'Time & Attendance', icon: Clock, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Auditor'] },
    { id: 'remote-work', label: 'Remote Work Engine', icon: Globe, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Auditor'] },
    { id: 'payroll', label: currentUser.role === 'Employee' ? 'My Payslips' : 'Global Payroll Engine', icon: CreditCard, roles: ['CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor', 'Employee'] },
    { id: 'statutory-compliance', label: 'Global Compliance Center', icon: Landmark, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'] },
    { id: 'compliance-evidence', label: 'Compliance Evidence Vault', icon: FileCheck2, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'] },
    { id: 'contractors', label: 'Contractor Hub', icon: Briefcase, roles: ['CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'] },
    { id: 'recruitment', label: 'Recruitment Hub', icon: Briefcase, roles: ['CompanyAdmin', 'HRManager', 'Recruiter'] },
    { id: 'talent-lifecycle', label: 'Talent Lifecycle', icon: Sparkles, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Recruiter', 'Auditor'] },
    { id: 'onboarding', label: 'Employee Onboarding', icon: FileCheck2, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Recruiter', 'Employee'] },
    { id: 'appraisals', label: 'Performance Management', icon: Award, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee'] },
    { id: 'training', label: 'Training & L&D', icon: GraduationCap, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee'] },
    { id: 'requests', label: 'HR Helpdesk', icon: HelpCircle, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee'] },
    { id: 'google-chat', label: 'Experience & Workforce Hub', icon: Megaphone, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'FinanceOfficer', 'Recruiter', 'Auditor'] },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileCheck2, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'Auditor'] },
    { id: 'settings', label: 'SaaS Settings', icon: Settings, roles: ['SuperAdmin', 'CompanyAdmin'] },
  ].filter((item) => item.roles.includes(currentUser.role));

  const navigate = (id: string) => { setActiveTab(id); setOpen(false); };
  const Nav = () => <nav className="space-y-1">{items.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => navigate(item.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === item.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}><Icon className="w-4 h-4" /><span>{item.label}</span></button>; })}</nav>;
  const Header = () => <div className="space-y-4"><div className="flex items-center gap-3 px-1"><div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center"><Compass className="w-5 h-5 text-white" /></div><div><span className="text-base font-bold text-slate-100 block">PeopleCloud<span className="text-brand-400">HRIS</span></span><span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase block">Global SaaS Console</span></div></div><div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Active Workspace</p><p className="font-semibold text-slate-200 text-xs truncate mt-1">{currentCompanyName}</p>{currentUser.role === 'SuperAdmin' && allCompanies.length > 0 && <select value={selectedTenantId} onChange={(event) => setSelectedTenantId(event.target.value)} className="mt-2 w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 text-[10px]"><option value="">Select Tenant</option>{allCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>}</div></div>;
  const Footer = () => <div className="border-t border-slate-800 pt-4 space-y-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">{currentUser.displayName.substring(0, 2)}</div><div className="min-w-0"><p className="text-xs font-semibold text-slate-200 truncate">{currentUser.displayName}</p><span className="text-[9px] text-slate-500 truncate block">{currentUser.role}</span></div></div>{onViewMarketing && <button onClick={onViewMarketing} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800"><Compass className="w-4 h-4" />View Marketing Site</button>}<button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-slate-800"><LogOut className="w-4 h-4" />Log Out</button></div>;

  return <><div className="lg:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40"><span className="font-bold text-sm">PeopleCloud<span className="text-brand-400">HRIS</span></span><button onClick={() => setOpen(!open)}>{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button></div>{open && <div className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden" onClick={() => setOpen(false)}><div className="w-72 bg-slate-900 h-full p-4 flex flex-col justify-between overflow-y-auto" onClick={(event) => event.stopPropagation()}><div className="space-y-6"><Header /><Nav /></div><Footer /></div></div>}<div className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 text-white flex-col justify-between p-5 shrink-0 h-screen sticky top-0"><div className="space-y-6 overflow-y-auto pr-1"><Header /><Nav /></div><Footer /></div></>;
}
