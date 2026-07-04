import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserRole } from './types';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import EmployeeDb from './components/EmployeeDb';
import LeaveManagement from './components/LeaveManagement';
import AttendanceTracking from './components/AttendanceTracking';
import PayrollSupport from './components/PayrollSupport';
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
import { CircleAlert, Sparkles, LogOut, Loader2, Mail, Terminal, Check, X, RefreshCw } from 'lucide-react';
import { subscribeToEmails, EmailPayload } from './emailService';
import SmtpLogModal from './components/SmtpLogModal';

interface UserSession {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  companyId: string | null;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [adminPreviewOnboarding, setAdminPreviewOnboarding] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [currentCompanyName, setCurrentCompanyName] = useState('Loading Tenant...');
  const [allCompanies, setAllCompanies] = useState<Array<{ id: string; name: string; plan: string }>>([]);
  
  // Enterprise subscription marketing view controls
  const [viewMode, setViewMode] = useState<'landing' | 'auth' | 'app'>('landing');
  const [initialPlan, setInitialPlan] = useState<string | undefined>(undefined);

  // SMTP Email Outbox tracking states
  const [activeEmails, setActiveEmails] = useState<EmailPayload[]>([]);
  const [viewingEmail, setViewingEmail] = useState<EmailPayload | null>(null);

  useEffect(() => {
    return subscribeToEmails((newEmail) => {
      setActiveEmails((prev) => {
        const exists = prev.some((e) => e.id === newEmail.id);
        if (exists) {
          return prev.map((e) => (e.id === newEmail.id ? newEmail : e));
        }
        return [...prev, newEmail];
      });
    });
  }, []);

  // 1. Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const profileRef = doc(db, 'users', user.uid);
          const snap = await getDoc(profileRef);
          
          if (snap.exists()) {
            const p = snap.data();
            const session: UserSession = {
              uid: user.uid,
              email: user.email || '',
              displayName: p.displayName || user.displayName || 'PeopleCloud User',
              role: p.role as UserRole,
              companyId: p.companyId || null
            };
            setCurrentUser(session);
            setViewMode('app'); // Auto-navigate to app workspace upon login
            
            // If they have a companyId, pre-set tenant selection
            if (p.companyId) {
              setSelectedTenantId(p.companyId);
            }
          } else {
            // User signed in but has no profile, auto-create a default profile in Firestore
            const defaultProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'New Hire',
              role: 'Employee',
              companyId: 'acme-corp', // Link to the seeded acme-corp tenant
              active: true,
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', user.uid), defaultProfile);

            const session: UserSession = {
              uid: user.uid,
              email: user.email || '',
              displayName: defaultProfile.displayName,
              role: defaultProfile.role as UserRole,
              companyId: defaultProfile.companyId
            };
            setCurrentUser(session);
            setViewMode('app');
            setSelectedTenantId('acme-corp');
          }
        } else {
          setCurrentUser(null);
          // Only force back to landing if they weren't purposefully looking at auth
          setViewMode((prev) => prev === 'auth' ? 'auth' : 'landing');
        }
      } catch (err) {
        console.error('Auth sync state error:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch all companies (SuperAdmin tenant selector dataset)
  useEffect(() => {
    if (!currentUser) return;
    async function loadCompaniesDataset() {
      try {
        const snap = await getDocs(collection(db, 'companies'));
        const list: Array<{ id: string; name: string; plan: string }> = [];
        snap.forEach(d => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || 'Unnamed Corp',
            plan: data.subscriptionPlan || 'Starter'
          });
        });
        setAllCompanies(list);
        
        // If SuperAdmin, default to first available company if none selected
        if (currentUser.role === 'SuperAdmin' && list.length > 0 && !selectedTenantId) {
          setSelectedTenantId(list[0].id);
        }
      } catch (err) {
        console.error('Error fetching companies directory:', err);
      }
    }
    loadCompaniesDataset();
  }, [currentUser, selectedTenantId]);

  // 3. Keep current company name in sync
  useEffect(() => {
    const compId = currentUser?.companyId || selectedTenantId;
    if (!compId || !auth.currentUser) {
      setCurrentCompanyName('SaaS Root Console');
      return;
    }

    async function fetchActiveCompanyName() {
      try {
        const snap = await getDoc(doc(db, 'companies', compId));
        if (snap.exists()) {
          setCurrentCompanyName(snap.data().name);
        } else {
          setCurrentCompanyName('Demo Enterprise');
        }
      } catch (err) {
        console.error('Error setting company name:', err);
        setCurrentCompanyName('Demo Enterprise');
        handleFirestoreError(err, OperationType.GET, 'companies/' + compId);
      }
    }
    fetchActiveCompanyName();
  }, [currentUser, selectedTenantId]);

  // Handle successful login/signups from AuthPage
  const handleAuthSuccess = (session: UserSession) => {
    setCurrentUser(session);
    if (session.companyId) {
      setSelectedTenantId(session.companyId);
    }
    setActiveTab('dashboard');
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setSelectedTenantId('');
      setAllCompanies([]);
      setViewMode('landing');
      setInitialPlan(undefined);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <div className="text-center">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-widest">PeopleCloud HRIS</p>
          <p className="text-[10px] text-slate-400 mt-1">Acquiring cloud metadata context...</p>
        </div>
      </div>
    );
  }

  // 1. If viewing marketing landing page (either logged in or logged out)
  if (viewMode === 'landing') {
    return (
      <LandingPage
        onGetStarted={(planName) => {
          setInitialPlan(planName);
          setViewMode('auth');
        }}
        onLoginClick={() => {
          setInitialPlan(undefined);
          setViewMode('auth');
        }}
        isLoggedIn={!!currentUser}
        onGoToDashboard={() => setViewMode('app')}
      />
    );
  }

  // 2. If not logged in and on the authentication page
  if (!currentUser && viewMode === 'auth') {
    return (
      <AuthPage 
        onAuthSuccess={(session) => {
          handleAuthSuccess(session);
          setViewMode('app');
        }}
        initialPlan={initialPlan}
        onBackToLanding={() => setViewMode('landing')}
      />
    );
  }

  // 3. Fallback: if not logged in at all, force to landing
  if (!currentUser) {
    return (
      <LandingPage
        onGetStarted={(planName) => {
          setInitialPlan(planName);
          setViewMode('auth');
        }}
        onLoginClick={() => {
          setInitialPlan(undefined);
          setViewMode('auth');
        }}
        isLoggedIn={false}
        onGoToDashboard={() => setViewMode('app')}
      />
    );
  }

  // Render Core Workspace Layout
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row" id="app-workspace">
      
      {/* SIDEBAR NAVIGATION CONTROLS */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        currentCompanyName={currentCompanyName}
        onLogout={handleLogout}
        allCompanies={allCompanies}
        selectedTenantId={selectedTenantId}
        setSelectedTenantId={setSelectedTenantId}
        onViewMarketing={() => setViewMode('landing')}
      />

      {/* CORE MODULE CONTENT PANEL */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-h-screen overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {activeTab === 'dashboard' && (
            <Dashboard 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'analytics' && (
            <HrAnalytics 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'employees' && (
            <EmployeeDb 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'id-cards' && (
            <IdCardStudio 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'leave' && (
            <LeaveManagement 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceTracking 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'remote-work' && (
            <RemoteWorkEngine 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'payroll' && (
            <PayrollSupport 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'contractors' && (
            <ContractorEngine 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'recruitment' && (
            <RecruitmentOnboarding 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'onboarding' && (
            currentUser.role === 'Employee' || adminPreviewOnboarding ? (
              <InteractiveOnboarding 
                currentUser={currentUser} 
                selectedTenantId={selectedTenantId} 
                onPreviewClose={
                  currentUser.role !== 'Employee' 
                    ? () => setAdminPreviewOnboarding(false) 
                    : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 border border-indigo-200 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-indigo-950">New-Hire Interactive Onboarding Experience</p>
                      <p className="text-[10px] text-indigo-600 font-medium">Click launch to preview the interactive checklist, camera scanners, and signature pads used by new recruits.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAdminPreviewOnboarding(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Launch Simulator
                  </button>
                </div>
                <RecruitmentOnboarding 
                  currentUser={currentUser} 
                  selectedTenantId={selectedTenantId} 
                />
              </div>
            )
          )}

          {activeTab === 'appraisals' && (
            <PerformanceAppraisal 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'training' && (
            <LearningDevelopment 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'requests' && (
            <HrRequests 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'google-chat' && (
            <GoogleChat 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'audit-logs' && (
            <AuditLogs 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

          {activeTab === 'settings' && (
            <Settings 
              currentUser={currentUser} 
              selectedTenantId={selectedTenantId} 
            />
          )}

        </div>
      </main>

      {/* Floating SMTP Email Outbox Live Notification Drawer */}
      {activeEmails.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl p-4 space-y-3 animate-slide-up no-print">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="text-xs font-bold font-display tracking-tight text-slate-100 font-semibold">SMTP Server Outbox</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono bg-slate-800 text-brand-400 px-1.5 py-0.5 rounded border border-slate-700 font-bold">
                {activeEmails.length} Outbound
              </span>
              <button 
                onClick={() => setActiveEmails([])}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-2 scrollbar-subtle pr-1">
            {activeEmails.map((email) => (
              <div 
                key={email.id}
                onClick={() => setViewingEmail(email)}
                className="bg-slate-950 hover:bg-slate-850 p-2.5 rounded-xl border border-slate-850 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between gap-3 text-[11px]"
              >
                <div className="truncate space-y-0.5 flex-1 pr-1">
                  <p className="font-bold text-slate-200 truncate">{email.subject}</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">To: {email.to}</p>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {email.status === 'sending' ? (
                    <span className="text-[9px] font-mono text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-900/50 flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      Relaying
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-900/50 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" />
                      Delivered
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-[9px] text-slate-500 font-medium text-center italic">
            Click any message row to trace the live SMTP handshake.
          </p>
        </div>
      )}

      {/* SMTP Log & HTML Email Inspector Modal */}
      {viewingEmail && (
        <SmtpLogModal 
          email={viewingEmail} 
          onClose={() => setViewingEmail(null)} 
        />
      )}

    </div>
  );
}
