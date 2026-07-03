import React, { useState, useEffect } from 'react';
import { UserRole, HRNotification } from '../types';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Clock, 
  CreditCard, 
  Briefcase, 
  ClipboardCheck, 
  HelpCircle, 
  Settings, 
  LogOut, 
  Bell, 
  User, 
  Building,
  Menu,
  X,
  Compass,
  FileCheck2,
  CircleAlert,
  MessageSquare
} from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

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

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  currentCompanyName,
  onLogout,
  allCompanies,
  selectedTenantId,
  setSelectedTenantId,
  onViewMarketing
}: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<HRNotification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Load in-app notifications
  useEffect(() => {
    async function loadNotifications() {
      if (!currentUser.companyId && currentUser.role !== 'SuperAdmin') return;
      try {
        const companyId = currentUser.companyId || selectedTenantId;
        if (!companyId) return;

        const notifRef = collection(db, `companies/${companyId}/notifications`);
        const q = query(notifRef, where('userId', '==', currentUser.uid));
        const snap = await getDocs(q);
        
        const list: HRNotification[] = [];
        snap.forEach((docSnap) => {
          list.push({ ...docSnap.data() as HRNotification, notificationId: docSnap.id });
        });
        
        // Sort notifications by date descending
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(list);
      } catch (err) {
        console.error('Error loading notifications:', err);
      }
    }
    loadNotifications();
  }, [currentUser.companyId, selectedTenantId, currentUser.uid, currentUser.role, activeTab]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = async () => {
    const companyId = currentUser.companyId || selectedTenantId;
    if (!companyId) return;

    try {
      const updated = notifications.map(async (n) => {
        if (!n.read) {
          const docRef = doc(db, `companies/${companyId}/notifications`, n.notificationId);
          await updateDoc(docRef, { read: true });
        }
      });
      await Promise.all(updated);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  // Get matching sidebar items for user's role
  const getMenuItems = () => {
    const items = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'FinanceOfficer', 'Recruiter', 'Auditor'] },
      { id: 'employees', label: 'Employee Database', icon: Users, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'FinanceOfficer', 'Auditor'] },
      { id: 'leave', label: 'Leave Manager', icon: CalendarDays, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Auditor'] },
      { id: 'attendance', label: 'Time & Attendance', icon: Clock, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'Auditor'] },
      { id: 'payroll', label: 'Payroll Support', icon: CreditCard, roles: ['CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'] },
      { id: 'recruitment', label: 'Recruitment Hub', icon: Briefcase, roles: ['CompanyAdmin', 'HRManager', 'Recruiter'] },
      { id: 'onboarding', label: 'Employee Onboarding', icon: ClipboardCheck, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Recruiter', 'Employee'] },
      { id: 'requests', label: 'HR Helpdesk', icon: HelpCircle, roles: ['CompanyAdmin', 'HRManager', 'LineManager', 'Employee'] },
      { id: 'google-chat', label: 'Google Chat', icon: MessageSquare, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'LineManager', 'Employee', 'FinanceOfficer', 'Recruiter', 'Auditor'] },
      { id: 'audit-logs', label: 'Audit Logs', icon: FileCheck2, roles: ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'Auditor'] },
      { id: 'settings', label: 'SaaS Settings', icon: Settings, roles: ['SuperAdmin', 'CompanyAdmin'] },
    ];

    return items.filter(item => item.roles.includes(currentUser.role));
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'SuperAdmin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'CompanyAdmin': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'HRManager': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'LineManager': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Employee': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'FinanceOfficer': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Recruiter': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'Auditor': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const menuItems = getMenuItems();

  return (
    <>
      {/* MOBILE HEADER BAR */}
      <div className="lg:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40" id="mobile-header">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded bg-brand-600 flex items-center justify-center shadow-md">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-sm font-display">
            PeopleCloud<span className="text-brand-400 font-extrabold font-display">HRIS</span>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            className="p-1.5 hover:bg-slate-800 rounded-lg relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
            )}
          </button>
          
          <button 
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-1.5 hover:bg-slate-800 rounded-lg"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU DRAWER */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden" onClick={() => setIsMobileOpen(false)}>
          <div className="w-64 bg-slate-900 h-full p-4 flex flex-col justify-between" onClick={e => e.stopPropagation()}>
            <div className="space-y-6">
              {/* Active Workspace Label */}
              <div className="border-b border-slate-800 pb-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Active Workspace</p>
                <p className="font-semibold text-slate-200 text-xs truncate mt-0.5">{currentCompanyName}</p>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      activeTab === item.id 
                        ? 'bg-brand-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Profile Block */}
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
                  {currentUser.displayName.substring(0, 2)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200 truncate">{currentUser.displayName}</p>
                  <span className="text-[9px] text-slate-500 truncate block">{currentUser.email}</span>
                </div>
              </div>
              {onViewMarketing && (
                <button 
                  onClick={() => {
                    setIsMobileOpen(false);
                    onViewMarketing();
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-slate-400" />
                  <span>View Marketing Site</span>
                </button>
              )}
              <button 
                onClick={onLogout}
                className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-slate-800 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP PERMANENT SIDEBAR */}
      <div className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 text-white flex-col justify-between p-5 shrink-0 h-screen sticky top-0" id="desktop-sidebar">
        <div className="space-y-6">
          
          {/* Logo Branding */}
          <div className="flex items-center space-x-3 px-1">
            <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-600/35">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold font-display tracking-tight text-slate-100 block">
                PeopleCloud<span className="text-brand-400 font-extrabold font-display">HRIS</span>
              </span>
              <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase -mt-0.5 block">Unified SaaS Console</span>
            </div>
          </div>

          {/* Active Tenant / Company Indicator */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
            {currentUser.role === 'SuperAdmin' ? (
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1">
                  <Building className="w-3 h-3" />
                  SuperAdmin Audit Console
                </p>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 block">Selected Tenant Audit Space:</label>
                  <select 
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 focus:outline-none"
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                  >
                    {allCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.plan})</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                  <Building className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Workspace</p>
                  <p className="font-semibold text-slate-200 text-xs truncate -mt-0.5" title={currentCompanyName}>
                    {currentCompanyName}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Core Navigation Items */}
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === item.id 
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/10' 
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-100'
                }`}
              >
                <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* User Block & Notification Hub */}
        <div className="border-t border-slate-800 pt-4 space-y-4">
          
          {/* User Display Info & Notifications Bell */}
          <div className="flex items-center justify-between bg-slate-950/40 p-2 rounded-xl border border-slate-800/40">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0 uppercase">
                {currentUser.displayName.substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-200 truncate">{currentUser.displayName}</p>
                <span className={`text-[9px] border px-1 rounded inline-block mt-0.5 ${getRoleBadgeColor(currentUser.role)}`}>
                  {currentUser.role}
                </span>
              </div>
            </div>

            {currentUser.role !== 'SuperAdmin' && (
              <button 
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 relative shrink-0 cursor-pointer"
                title="Notifications Hub"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-slate-900"></span>
                )}
              </button>
            )}
          </div>

          {/* View Marketing Site Button */}
          {onViewMarketing && (
            <button 
              onClick={onViewMarketing}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all cursor-pointer"
            >
              <Compass className="w-4 h-4 text-slate-400" />
              <span>View Marketing Site</span>
            </button>
          )}

          {/* Sign Out Button */}
          <button 
            onClick={onLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Log Out Account</span>
          </button>
        </div>
      </div>

      {/* NOTIFICATION DRAWER / PANEL */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" id="notif-panel">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setShowNotifPanel(false)}></div>
          <div className="w-80 sm:w-96 bg-white h-screen z-10 shadow-2xl p-5 flex flex-col justify-between animate-fade-in">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-brand-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Notifications Inbox</h3>
                </div>
                <button 
                  onClick={() => setShowNotifPanel(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notification Cards */}
              <div className="mt-4 space-y-3 overflow-y-auto max-h-[80vh] pr-1">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <CircleAlert className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs">No notifications logged yet.</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.notificationId}
                      className={`p-3.5 rounded-xl border text-xs transition-colors ${
                        notif.read 
                          ? 'bg-slate-50 border-slate-100 text-slate-500' 
                          : 'bg-brand-50/40 border-brand-100/60 text-slate-700 font-medium shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{notif.title}</span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-[11px] mt-1 leading-relaxed">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Mark All as Read</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
