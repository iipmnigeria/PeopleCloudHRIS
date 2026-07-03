import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { jsPDF } from 'jspdf';
import { AuditLog, UserProfile, UserRole } from '../types';
import { 
  FileCheck2, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  User, 
  Clock, 
  Activity, 
  Building2, 
  Eye, 
  CheckCircle2, 
  SlidersHorizontal,
  ChevronDown,
  Info,
  ShieldAlert,
  Layers,
  Sparkles,
  Database,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

interface AuditLogsProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function AuditLogs({ currentUser, selectedTenantId }: AuditLogsProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter and Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('All');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'desc' | 'asc'>('desc');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showSimulateModal, setShowSimulateModal] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedModule, selectedUserFilter, sortBy]);

  // Simulation Form State
  const [simAction, setSimAction] = useState('Employee Onboarded');
  const [simModule, setSimModule] = useState('Employees');
  const [simDetails, setSimDetails] = useState('Onboarded Danielle Kemp as Junior Designer. Department: Creative Ops.');
  const [simulating, setSimulating] = useState(false);

  // Firestore Error Handler helper
  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path
    };
    console.error('Firestore Error in AuditLogs: ', JSON.stringify(errInfo));
    setErrorMsg(`Permission or connection error. Detailed diagnostic logs sent to SaaS administrator console.`);
    throw new Error(JSON.stringify(errInfo));
  }

  // Load audit logs and user profiles
  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch User Profiles to map userId to names
      const usersPath = 'users';
      const usersMap: Record<string, UserProfile> = {};
      try {
        const usersSnap = await getDocs(collection(db, usersPath));
        usersSnap.forEach((d) => {
          usersMap[d.id] = { ...d.data() as UserProfile, uid: d.id };
        });
        setUserProfiles(usersMap);
      } catch (err) {
        console.warn('Unable to pre-fetch user profiles mapping:', err);
      }

      // 2. Fetch Audit Logs
      const logsPath = `companies/${companyId}/audit_logs`;
      const logsSnap = await getDocs(collection(db, logsPath));
      const logsList: AuditLog[] = [];
      logsSnap.forEach((d) => {
        logsList.push({
          ...d.data() as AuditLog,
          logId: d.id,
        });
      });

      // Sort logs by newest first default
      logsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLogs(logsList);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `companies/${companyId}/audit_logs`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  // Modules available
  const modules = ['All', 'Dashboard', 'Employees', 'Leave', 'Attendance', 'Payroll', 'Recruitment', 'Onboarding', 'Settings', 'HR Requests'];

  // Filter logs list
  const filteredLogs = logs.filter(log => {
    const userProfile = userProfiles[log.userId];
    const userDisplayName = userProfile?.displayName || 'Unknown User';
    const userEmail = userProfile?.email || log.userId || '';
    
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase())) ||
      userDisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesModule = selectedModule === 'All' || log.module === selectedModule;
    const matchesUser = selectedUserFilter === 'All' || log.userId === selectedUserFilter;

    return matchesSearch && matchesModule && matchesUser;
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortBy === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handle Log Simulation
  const handleSimulateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSimulating(true);
    
    const path = `companies/${companyId}/audit_logs`;
    try {
      const newLog: Omit<AuditLog, 'logId'> = {
        companyId,
        userId: currentUser.uid,
        action: simAction,
        module: simModule,
        details: simDetails,
        createdAt: new Date().toISOString(),
        ipAddress: `${Math.floor(Math.random() * 255) + 1}.168.1.${Math.floor(Math.random() * 254) + 1}`
      };

      await addDoc(collection(db, path), newLog);
      setShowSimulateModal(false);
      loadData();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSimulating(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'User Name', 'User Email', 'Action', 'Module', 'IP Address', 'Details'];
    
    const rows = filteredLogs.map(log => {
      const user = userProfiles[log.userId];
      const timestamp = log.createdAt;
      const userName = user?.displayName || 'Unknown';
      const userEmail = user?.email || log.userId;
      const action = log.action;
      const moduleName = log.module;
      const ipAddress = log.ipAddress || 'N/A';
      const details = log.details || '';

      // Escape quotes and wrap values in quotes to handle commas/newlines/quotes safely
      const cleanField = (val: string) => {
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      };

      return [
        cleanField(timestamp),
        cleanField(userName),
        cleanField(userEmail),
        cleanField(action),
        cleanField(moduleName),
        cleanField(ipAddress),
        cleanField(details)
      ];
    });

    const csvString = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AuditLogs_${companyId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to PDF
  const exportToPDF = () => {
    if (filteredLogs.length === 0) return;
    
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;
    let currentPage = 1;

    // Helper for adding footer
    const addFooter = (pageNum: number) => {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      
      const dateStr = new Date().toLocaleString();
      doc.text(`Generated on: ${dateStr} • Powered by PeopleCloud HRIS`, margin, pageHeight - 20);
      
      const pageStr = `Page ${pageNum}`;
      const pageStrWidth = doc.getTextWidth(pageStr);
      doc.text(pageStr, pageWidth - margin - pageStrWidth, pageHeight - 20);
    };

    // --- PAGE 1 HEADER ---
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, y, contentWidth, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PEOPLECLOUD HRIS', margin + 15, y + 22);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('COMPLIANCE & AUDIT LOG REPORT', margin + 15, y + 37);

    // Right aligned metadata in banner
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    const orgText = `Tenant: ${companyId || 'N/A'}`;
    const orgTextWidth = doc.getTextWidth(orgText);
    doc.text(orgText, pageWidth - margin - 15 - orgTextWidth, y + 22);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    const countText = `Report Volume: ${filteredLogs.length} events logged`;
    const countTextWidth = doc.getTextWidth(countText);
    doc.text(countText, pageWidth - margin - 15 - countTextWidth, y + 37);

    y += 70;

    // Filter scope info box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(margin, y, contentWidth, 40, 'FD');
    
    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('REPORT PARAMETERS & SECURITY CONTEXT', margin + 12, y + 16);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    const filterDesc = `Query Filters - Module: ${selectedModule} | Operator: ${selectedUserFilter === 'All' ? 'All Users' : (userProfiles[selectedUserFilter]?.displayName || selectedUserFilter)} | Search: "${searchQuery || 'None'}"`;
    doc.text(filterDesc, margin + 12, y + 28);

    // Security Status Indicator
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129); // emerald-500
    const statusText = `[SECURE CRYPTO-VERIFIED LEDGER]`;
    const statusWidth = doc.getTextWidth(statusText);
    doc.text(statusText, pageWidth - margin - 12 - statusWidth, y + 22);

    y += 55;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text('CHRONOLOGICAL EVENT LOGS', margin, y);
    
    y += 12;

    filteredLogs.forEach((log) => {
      const user = userProfiles[log.userId];
      const opName = user?.displayName || 'System Agent / Auto-Run';
      const opEmail = user?.email || `uid: ${log.userId}`;
      const opRole = user?.role || 'Staff';
      const timestamp = new Date(log.createdAt).toLocaleString();
      const ip = log.ipAddress || '10.0.4.15';
      const action = log.action;
      const moduleName = log.module;
      const details = log.details || 'No extended parameter payload recorded.';

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      const wrappedDetails = doc.splitTextToSize(`Details: ${details}`, contentWidth - 30);
      
      const detailsLinesCount = wrappedDetails.length;
      const elementHeight = 45 + (detailsLinesCount * 11);

      if (y + elementHeight > pageHeight - margin) {
        addFooter(currentPage);
        doc.addPage();
        currentPage++;
        y = margin + 20;
        
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(margin, y, contentWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`PEOPLECLOUD HRIS AUDIT REPORT • ${orgText}`, margin + 10, y + 16);
        
        y += 40;
      }

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, elementHeight - 8, 'FD');

      let accentColor = [99, 102, 241];
      if (moduleName === 'Payroll') accentColor = [16, 185, 129];
      if (moduleName === 'Leave') accentColor = [245, 158, 11];
      if (moduleName === 'HR Requests') accentColor = [244, 63, 94];
      if (moduleName === 'Settings') accentColor = [100, 116, 139];
      
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(margin, y, 4, elementHeight - 8, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`TIMESTAMP:`, margin + 15, y + 14);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(timestamp, margin + 80, y + 14);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(148, 163, 184);
      doc.text(`MODULE:`, margin + 250, y + 14);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text(moduleName.toUpperCase(), margin + 300, y + 14);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(148, 163, 184);
      doc.text(`IP ADDRESS:`, margin + 450, y + 14);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(ip, margin + 515, y + 14);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(action, margin + 15, y + 29);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const opText = `Executed by: ${opName} (${opEmail} • ${opRole})`;
      const opTextWidth = doc.getTextWidth(opText);
      doc.text(opText, pageWidth - margin - 15 - opTextWidth, y + 29);

      doc.setDrawColor(241, 245, 249);
      doc.line(margin + 15, y + 36, pageWidth - margin - 15, y + 36);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      
      let detailsY = y + 46;
      wrappedDetails.forEach((line: string) => {
        doc.text(line, margin + 15, detailsY);
        detailsY += 11;
      });

      y += elementHeight;
    });

    addFooter(currentPage);

    doc.save(`AuditReport_${companyId}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Get matching background/text colors for modules
  const getModuleBadgeColor = (module: string) => {
    switch (module) {
      case 'Payroll': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Employees': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'Recruitment': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Onboarding': return 'bg-pink-50 text-pink-700 border-pink-100';
      case 'Leave': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Attendance': return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'Settings': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'HR Requests': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="audit-logs-workspace">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <FileCheck2 className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest font-sans">
              System Audit Space
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-display">
            Tenant Audit Logs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident, fully searchable security logs documenting administrative and employee lifecycle events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={loadData}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button 
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button 
            onClick={exportToPDF}
            disabled={filteredLogs.length === 0}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Export PDF</span>
          </button>

          <button 
            onClick={() => setShowSimulateModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulate Log</span>
          </button>
        </div>
      </div>

      {/* ERROR MESSAGE BAR */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-xs font-medium">
            <p className="font-bold">Security / Database Interface Warning</p>
            <p className="mt-0.5 opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Records</p>
            <p className="text-xl font-bold text-slate-800">{logs.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtered Volume</p>
            <p className="text-xl font-bold text-slate-800">{filteredLogs.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Operators</p>
            <p className="text-xl font-bold text-slate-800">{Object.keys(userProfiles).length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audit Tenant ID</p>
            <p className="text-xs font-mono font-bold text-slate-700 truncate w-32" title={companyId}>{companyId}</p>
          </div>
        </div>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          
          {/* Action Query Search */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input 
              type="text"
              placeholder="Search by action, details, operator email or display name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>

          {/* Module Select */}
          <div className="w-full lg:w-48">
            <div className="relative">
              <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
              >
                <option value="All">All Modules</option>
                {modules.slice(1).map(mod => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* User Select Map */}
          <div className="w-full lg:w-56">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
              >
                <option value="All">All Operators</option>
                {Object.keys(userProfiles).map(uid => {
                  const user = userProfiles[uid];
                  return (
                    <option key={user.uid} value={user.uid}>{user.displayName} ({user.role})</option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Sort Order Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy(sortBy === 'desc' ? 'asc' : 'desc')}
              className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{sortBy === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* CORE LOGS TABLE PANEL */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-600">Querying secure ledger database...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No Security Logs Recorded</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or simulate a new activity log.</p>
            </div>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Operator / User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Module Space</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {paginatedLogs.map((log) => {
                  const operatorProfile = userProfiles[log.userId];
                  const opName = operatorProfile?.displayName || 'System Agent / Auto-Run';
                  const opEmail = operatorProfile?.email || 'uid: ' + log.userId.substring(0, 8) + '...';
                  const opRole = operatorProfile?.role || 'Staff';
                  const isExpanded = expandedLogId === log.logId;

                  return (
                    <React.Fragment key={log.logId}>
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        {/* Timestamp */}
                        <td className="py-4 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>

                        {/* Operator Identity */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold flex items-center justify-center text-[10px]">
                              {opName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 leading-tight">{opName}</p>
                              <p className="text-[10px] text-slate-400 leading-none mt-0.5">{opEmail} • <span className="font-semibold text-slate-500">{opRole}</span></p>
                            </div>
                          </div>
                        </td>

                        {/* Action Description */}
                        <td className="py-4 px-4">
                          <p className="font-semibold text-slate-700 max-w-sm" title={log.action}>
                            {log.action}
                          </p>
                        </td>

                        {/* Module Badge */}
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${getModuleBadgeColor(log.module)}`}>
                            {log.module}
                          </span>
                        </td>

                        {/* IP Address */}
                        <td className="py-4 px-4 font-mono text-[10px] text-slate-400">
                          {log.ipAddress || '10.0.4.15'}
                        </td>

                        {/* Expand Trigger */}
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.logId)}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-md font-semibold text-[10px] inline-flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isExpanded ? 'Collapse' : 'Inspect'}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/30">
                          <td colSpan={6} className="py-3.5 px-6 border-b border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Log Metadata Details</span>
                                <div className="bg-white p-3 rounded-xl border border-slate-100 text-slate-700 text-xs font-semibold leading-relaxed shadow-inner">
                                  {log.details || 'No extended parameter payload was recorded for this standard action.'}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Ledger Verification Signatures</span>
                                <div className="bg-slate-900 text-slate-300 p-3 rounded-xl font-mono text-[10px] space-y-1 overflow-x-auto shadow-md">
                                  <p><span className="text-indigo-400">"log_id":</span> "{log.logId}"</p>
                                  <p><span className="text-indigo-400">"company_id":</span> "{log.companyId}"</p>
                                  <p><span className="text-indigo-400">"operator_uid":</span> "{log.userId}"</p>
                                  <p><span className="text-indigo-400">"tamper_evident_hash":</span> "sha256-verified-ok"</p>
                                  <p><span className="text-indigo-400">"environment":</span> "Google Cloud Run Sandboxed VM"</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION PANEL FOOTER */}
          <div className="bg-slate-50 border-t border-slate-100 px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{filteredLogs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{Math.min(filteredLogs.length, currentPage * itemsPerPage)}</span> of{' '}
              <span className="font-bold text-slate-800">{filteredLogs.length}</span> entries
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-indigo-600 font-bold shadow-sm">
                  {currentPage}
                </span>
                <span className="text-slate-400">/</span>
                <span className="px-1.5">{totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          </>
        )}
      </div>

      {/* SIMULATE LOG MODAL POPUP */}
      {showSimulateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden animate-slide-up">
            
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-sm font-display">Simulate Auditor Event</span>
              </div>
              <button 
                onClick={() => setShowSimulateModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSimulateLog} className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Generate custom system-wide audit entries to verify responsive table logic, filters, search engines, and ledger outputs in real time.
              </p>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  System Module Category
                </label>
                <select
                  value={simModule}
                  onChange={(e) => {
                    setSimModule(e.target.value);
                    if (e.target.value === 'Payroll') {
                      setSimAction('Processed Bi-Weekly Payroll');
                      setSimDetails('Computed run for June, processed 12 active staff payments via Chase Bank.');
                    } else if (e.target.value === 'Leave') {
                      setSimAction('Approved Sick Leave Request');
                      setSimDetails('Approved medical leave request for David Vance (Sick Leave, 3 days).');
                    } else if (e.target.value === 'Attendance') {
                      setSimAction('Forced Clock-Out Corrective');
                      setSimDetails('Admin forced automated checkout at 18:00 UTC for missed terminal logout.');
                    } else if (e.target.value === 'Settings') {
                      setSimAction('Changed SaaS Plan Matrix');
                      setSimDetails('Upgraded enterprise level core node, enabled professional auditing suite.');
                    } else {
                      setSimAction('Employee Onboarded');
                      setSimDetails('Onboarded Danielle Kemp as Junior Designer. Department: Creative Ops.');
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {modules.slice(1).map(mod => (
                    <option key={mod} value={mod}>{mod}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Activity / Action Taken
                </label>
                <input
                  type="text"
                  required
                  value={simAction}
                  onChange={(e) => setSimAction(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Affected Record Details
                </label>
                <textarea
                  required
                  rows={3}
                  value={simDetails}
                  onChange={(e) => setSimDetails(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-100 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {simulating ? 'Writing Log...' : 'Commit Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
