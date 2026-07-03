import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
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
import Settings from './components/Settings';
import AuditLogs from './components/AuditLogs';
import GoogleChat from './components/GoogleChat';
import { CircleAlert, Sparkles, LogOut, Loader2 } from 'lucide-react';

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
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [currentCompanyName, setCurrentCompanyName] = useState('Loading Tenant...');
  const [allCompanies, setAllCompanies] = useState<Array<{ id: string; name: string; plan: string }>>([]);
  
  // Enterprise subscription marketing view controls
  const [viewMode, setViewMode] = useState<'landing' | 'auth' | 'app'>('landing');
  const [initialPlan, setInitialPlan] = useState<string | undefined>(undefined);

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
    if (!compId) {
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

          {activeTab === 'employees' && (
            <EmployeeDb 
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

          {activeTab === 'payroll' && (
            <PayrollSupport 
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
            <RecruitmentOnboarding 
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

    </div>
  );
}
