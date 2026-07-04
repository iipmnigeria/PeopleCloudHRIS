import React, { useState } from 'react';
import { UserRole } from '../types';
import { Activity, Award, Bell, Briefcase, CalendarDays, Clock, Compass, Contact, CreditCard, FileCheck2, Globe, GraduationCap, HelpCircle, LayoutDashboard, LogOut, Menu, MessageSquare, Settings, Sparkles, Users, X } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  currentCompanyName: string;
  onLogout: () => void;
  allCompanies: Array<{ id: string; name: string; plan: string }>;
  selectedTenantId: string;
  setSelectedTenantId: (id: string) => void;
  onViewMarketing?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, currentUser, currentCompanyName, onLogout, allCompanies, selectedTenantId, setSelectedTenantId, onViewMarketing }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'FinanceOfficer', 'Recruiter', 'Auditor'] },
    { id: 'analytics', label: 'HR Analytics', icon: Activity, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Auditor'] },
    { id: 'employees', label: 'Employee Database', icon: Users, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'FinanceOfficer', 'Auditor'] },
    { id: 'id-cards', label: 'Employee ID Cards', icon: Contact, roles: ['CompanyAdmin', 'HRManager', 'Employee', 'Auditor'] },
    { id: 'leave', label: 'Leave Manager', icon: CalendarDays, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Auditor'] },
    { id: 'attendance', label: 'Time & Attendance', icon: Clock, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Auditor'] },
    { id: 'remote-work', label: 'Remote Work Engine', icon: Globe, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Auditor'] },
    { id: 'payroll', label: 'True Payroll Engine', icon: CreditCard, roles: ['CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'] },
    { id: 'contractors', label: 'Contractor Hub', icon: Briefcase, roles: ['CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'] },
    { id: 'recruitment', label: 'Recruitment Hub', icon: Briefcase, roles: ['CompanyAdmin', 'HRManager', 'Recruiter'] },
    { id: 'talent-lifecycle', label: 'Talent Lifecycle', icon: Sparkles, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Recruiter', 'Auditor'] },
    { id: 'onboarding', label: 'Employee Onboarding', icon: FileCheck2, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Recruiter', 'Employee'] },
    { id: 'appraisals', label: 'Performance Appraisals', icon: Award, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee'] },
    { id: 'training', label: 'Training & L&D', icon: GraduationCap, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee'] },
    { id: 'requests', label: 'HR Helpdesk', icon: HelpCircle, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee'] },
    { id: 'google-chat', label: 'Smart Workforce Hub', icon: MessageSquare, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'FinanceOfficer', 'Recruiter', 'Auditor'] },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileCheck2, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'Auditor'] },
    { id: 'settings', label: 'SaaS Settings', icon: Settings, roles: ['SuperAdmin', 'CompanyAdmin'] },
  ].filter((item) => item.roles.includes(currentUser.role));

  const navigate = (id: string) => {
    setActiveTab(id);
    setIsMobileOpen(false);
  };

  const NavItems = () => <nav className="space-y-1">{items.map((item) => <button key={item.id} onClick={() => navigate(item.id)} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === item.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}><item.icon className="w-4 h-4" /><span>{item.label}</span></button>)}</nav>;

  return (
    <>
      <div className="lg:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40" id="mobile-header">
        <div className="flex items-center space-x-2.5"><div className="w-8 h-8 rounded bg-brand-600 flex items-center justify-center shadow-md"><Compass className="w-4 h-4 text-white" /></div><span className="font-bold tracking-tight text-sm font-display">PeopleCloud<span className="text-brand-400 font-extrabold font-display">HRIS</span></span></div>
        <div className="flex items-center space-x-3"><Bell className="w-4 h-4 text-slate-400" /><button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-1.5 hover:bg-slate-800 rounded-lg cursor-pointer">{isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button></div>
      </div>

      {isMobileOpen && <div className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden" onClick={() => setIsMobileOpen(false)}><div className="w-72 bg-slate-900 h-full p-4 flex flex-col justify-between overflow-y-auto" onClick={(event) => event.stopPropagation()}><div className="space-y-6"><WorkspaceHeader currentCompanyName={currentCompanyName} currentUser={currentUser} allCompanies={allCompanies} selectedTenantId={selectedTenantId} setSelectedTenantId={setSelectedTenantId} /><NavItems /></div><Footer currentUser={currentUser} onLogout={onLogout} onViewMarketing={onViewMarketing} /></div></div>}

      <div className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 text-white flex-col justify-between p-5 shrink-0 h-screen sticky top-0" id="desktop-sidebar">
        <div className="space-y-6 overflow-y-auto pr-1"><div className="flex items-center space-x-3 px-1"><div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-600/35"><Compass className="w-5 h-5 text-white" /></div><div><span className="text-base font-bold font-display tracking-tight text-slate-100 block">PeopleCloud<span className="text-brand-400 font-extrabold font-display">HRIS</span></span><span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase block">Unified SaaS Console</span></div></div><WorkspaceHeader currentCompanyName={currentCompanyName} currentUser={currentUser} allCompanies={allCompanies} selectedTenantId={selectedTenantId} setSelectedTenantId={setSelectedTenantId} /><NavItems /></div>
        <Footer currentUser={currentUser} onLogout={onLogout} onViewMarketing={onViewMarketing} />
      </div>
    </>
  );
}

function WorkspaceHeader({ currentCompanyName, currentUser, allCompanies, selectedTenantId, setSelectedTenantId }: { currentCompanyName: string; currentUser: any; allCompanies: Array<{ id: string; name: string; plan: string }>; selectedTenantId: string; setSelectedTenantId: (id: string) => void }) {
  return <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80"><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Active Workspace</p><p className="font-semibold text-slate-200 text-xs truncate mt-0.5">{currentCompanyName}</p>{currentUser.role === 'SuperAdmin' && allCompanies.length > 0 && <select value={selectedTenantId} onChange={(event) => setSelectedTenantId(event.target.value)} className="mt-2 w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none"><option value="">Select Tenant</option>{allCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>}</div>;
}

function Footer({ currentUser, onLogout, onViewMarketing }: { currentUser: any; onLogout: () => void; onViewMarketing?: () => void }) {
  return <div className="border-t border-slate-800 pt-4 space-y-4"><div className="flex items-center space-x-2.5"><div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">{currentUser.displayName.substring(0, 2)}</div><div className="min-w-0"><p className="text-xs font-semibold text-slate-200 truncate">{currentUser.displayName}</p><span className="text-[9px] text-slate-500 truncate block">{currentUser.role}</span></div></div>{onViewMarketing && <button onClick={onViewMarketing} className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"><Compass className="w-4 h-4 text-slate-400" /><span>View Marketing Site</span></button>}<button onClick={onLogout} className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-slate-800 hover:text-rose-300 transition-colors cursor-pointer"><LogOut className="w-4 h-4" /><span>Log Out</span></button></div>;
}
