import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserRole } from './types';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import EmployeeDb from './components/EmployeeDb';
import EmployeeDataLinkManager from './components/EmployeeDataLinkManager';
import EmployeeDataPublicForm from './components/EmployeeDataPublicForm';
import OrgCatalogManager from './components/OrgCatalogManager';
import LeaveManagement from './components/LeaveManagement';
import AttendanceTracking from './components/AttendanceTracking';
import TruePayrollEngine from './components/TruePayrollEngine';
import StatutoryComplianceCenter from './components/StatutoryComplianceCenter';
import ComplianceEvidenceVault from './components/ComplianceEvidenceVault';
import HrRequests from './components/HrRequests';
import RecruitmentOnboarding from './components/RecruitmentOnboarding';
import PerformanceAppraisal from './components/PerformanceAppraisal';
import LearningDevelopment from './components/LearningDevelopment';
import HrAnalytics from './components/HrAnalytics';
import Settings from './components/Settings';
import AuditLogs from './components/AuditLogs';
import GoogleChat from './components/GoogleChat';
import InteractiveOnboarding from './components/InteractiveOnboarding';
import IdCardStudio from './components/IdCardStudio';
import RemoteWorkEngine from './components/RemoteWorkEngine';
import ContractorEngine from './components/ContractorEngine';
import TalentLifecycleEngine from './components/TalentLifecycleEngine';
import { Loader2, Sparkles } from 'lucide-react';

interface UserSession { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null; }

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [adminPreviewOnboarding, setAdminPreviewOnboarding] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [currentCompanyName, setCurrentCompanyName] = useState('Loading Tenant...');
  const [allCompanies, setAllCompanies] = useState<Array<{ id: string; name: string; plan: string }>>([]);
  const [viewMode, setViewMode] = useState<'landing' | 'auth' | 'app'>('landing');
  const [initialPlan, setInitialPlan] = useState<string | undefined>(undefined);
  const employeeIntakeToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('employee-intake') : null;

  useEffect(() => { const unsubscribe = onAuthStateChanged(auth, async (user) => { try { if (!user) { setCurrentUser(null); setViewMode((prev) => (prev === 'auth' ? 'auth' : 'landing')); return; } const profileRef = doc(db, 'users', user.uid); const snap = await getDoc(profileRef); let session: UserSession; if (snap.exists()) { const profile = snap.data(); session = { uid: user.uid, email: user.email || '', displayName: profile.displayName || user.displayName || 'PeopleCloud User', role: (profile.role || 'Employee') as UserRole, companyId: profile.companyId || null }; } else { const profile = { uid: user.uid, email: user.email || '', displayName: user.displayName || 'New Hire', role: 'Employee' as UserRole, companyId: 'acme-corp', active: true, createdAt: new Date().toISOString() }; await setDoc(profileRef, profile); session = profile; } setCurrentUser(session); setViewMode('app'); if (session.companyId) setSelectedTenantId(session.companyId); } catch (error) { console.error('Auth sync state error:', error); } finally { setLoading(false); } }); return () => unsubscribe(); }, []);
  useEffect(() => { if (!currentUser) return; async function loadCompanies() { try { const snap = await getDocs(collection(db, 'companies')); const list: Array<{ id: string; name: string; plan: string }> = []; snap.forEach((item) => { const data = item.data(); list.push({ id: item.id, name: data.name || 'Unnamed Corp', plan: data.subscriptionPlan || 'Starter' }); }); setAllCompanies(list); if (currentUser.role === 'SuperAdmin' && list.length > 0 && !selectedTenantId) setSelectedTenantId(list[0].id); } catch (error) { console.error('Error fetching companies directory:', error); } } loadCompanies(); }, [currentUser, selectedTenantId]);
  useEffect(() => { const companyId = currentUser?.companyId || selectedTenantId; if (!companyId) { setCurrentCompanyName('SaaS Root Console'); return; } async function loadCompanyName() { try { const snap = await getDoc(doc(db, 'companies', companyId)); setCurrentCompanyName(snap.exists() ? snap.data().name : 'Demo Enterprise'); } catch (error) { console.error('Error setting company name:', error); setCurrentCompanyName('Demo Enterprise'); } } loadCompanyName(); }, [currentUser, selectedTenantId]);
  const handleAuthSuccess = (session: UserSession) => { setCurrentUser(session); if (session.companyId) setSelectedTenantId(session.companyId); setActiveTab('dashboard'); setViewMode('app'); };
  const handleLogout = async () => { await signOut(auth); setCurrentUser(null); setSelectedTenantId(''); setAllCompanies([]); setViewMode('landing'); setInitialPlan(undefined); };

  if (employeeIntakeToken) return <EmployeeDataPublicForm token={employeeIntakeToken} />;
  if (loading) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /><div className="text-center"><p className="text-xs font-bold text-slate-800 uppercase tracking-widest">PeopleCloud HRIS</p><p className="text-[10px] text-slate-400 mt-1">Acquiring cloud metadata context...</p></div></div>;
  if (viewMode === 'landing') return <LandingPage onGetStarted={(planName) => { setInitialPlan(planName); setViewMode('auth'); }} onLoginClick={() => { setInitialPlan(undefined); setViewMode('auth'); }} isLoggedIn={!!currentUser} onGoToDashboard={() => setViewMode('app')} />;
  if (!currentUser && viewMode === 'auth') return <AuthPage onAuthSuccess={handleAuthSuccess} initialPlan={initialPlan} onBackToLanding={() => setViewMode('landing')} />;
  if (!currentUser) return <LandingPage onGetStarted={(planName) => { setInitialPlan(planName); setViewMode('auth'); }} onLoginClick={() => { setInitialPlan(undefined); setViewMode('auth'); }} isLoggedIn={false} onGoToDashboard={() => setViewMode('app')} />;

  const employeeWorkspace = <div className="space-y-6"><OrgCatalogManager currentUser={currentUser} selectedTenantId={selectedTenantId} /><EmployeeDataLinkManager currentUser={currentUser} selectedTenantId={selectedTenantId} /><EmployeeDb currentUser={currentUser} selectedTenantId={selectedTenantId} /></div>;

  return <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row" id="app-workspace"><Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} currentCompanyName={currentCompanyName} onLogout={handleLogout} allCompanies={allCompanies} selectedTenantId={selectedTenantId} setSelectedTenantId={setSelectedTenantId} onViewMarketing={() => setViewMode('landing')} /><main className="flex-1 p-4 sm:p-6 lg:p-8 max-h-screen overflow-y-auto"><div className="max-w-7xl mx-auto space-y-6">{activeTab === 'dashboard' && <Dashboard currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'analytics' && <HrAnalytics currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'employees' && employeeWorkspace}{activeTab === 'id-cards' && <IdCardStudio currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'leave' && <LeaveManagement currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'attendance' && <AttendanceTracking currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'remote-work' && <RemoteWorkEngine currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'payroll' && <TruePayrollEngine currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'statutory-compliance' && <StatutoryComplianceCenter currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'compliance-evidence' && <ComplianceEvidenceVault currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'contractors' && <ContractorEngine currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'recruitment' && <RecruitmentOnboarding currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'talent-lifecycle' && <TalentLifecycleEngine currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'onboarding' && (currentUser.role === 'Employee' || adminPreviewOnboarding ? <InteractiveOnboarding currentUser={currentUser} selectedTenantId={selectedTenantId} onPreviewClose={currentUser.role !== 'Employee' ? () => setAdminPreviewOnboarding(false) : undefined} /> : <div className="space-y-4"><div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl shadow-xs flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-100 border border-indigo-200 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5 animate-pulse" /></div><div><p className="text-xs font-bold text-indigo-950">New-Hire Interactive Onboarding Experience</p><p className="text-[10px] text-indigo-600 font-medium">Click launch to preview the interactive checklist, camera scanners, and signature pads used by new recruits.</p></div></div><button onClick={() => setAdminPreviewOnboarding(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs">Launch Simulator</button></div><RecruitmentOnboarding currentUser={currentUser} selectedTenantId={selectedTenantId} /></div>)}{activeTab === 'appraisals' && <PerformanceAppraisal currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'training' && <LearningDevelopment currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'requests' && <HrRequests currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'google-chat' && <GoogleChat currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'audit-logs' && <AuditLogs currentUser={currentUser} selectedTenantId={selectedTenantId} />}{activeTab === 'settings' && <Settings currentUser={currentUser} selectedTenantId={selectedTenantId} />}</div></main></div>;
}
