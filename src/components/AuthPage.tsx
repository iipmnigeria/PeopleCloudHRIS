import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserRole, Company } from '../types';
import { DEMO_USERS, DEMO_COMPANY_ID, seedDatabaseIfNeeded } from '../dbSeeder';
import { Shield, Sparkles, Building2, UserCheck, KeyRound, Check, ArrowRight, Activity } from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: (user: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null }) => void;
  initialPlan?: string;
  onBackToLanding?: () => void;
}

export default function AuthPage({ onAuthSuccess, initialPlan, onBackToLanding }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(!!initialPlan);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('CompanyAdmin');
  
  // SaaS Registration details
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('Technology & Software');
  const [plan, setPlan] = useState<'Starter' | 'Growth' | 'Professional' | 'Enterprise'>(() => {
    if (initialPlan === 'Starter' || initialPlan === 'Growth' || initialPlan === 'Enterprise') {
      return initialPlan as any;
    }
    return 'Starter';
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);

  // Sync initialPlan when passed from parent Landing Page
  React.useEffect(() => {
    if (initialPlan) {
      setIsSignUp(true);
      if (initialPlan === 'Starter' || initialPlan === 'Growth' || initialPlan === 'Enterprise') {
        setPlan(initialPlan as any);
      }
    }
  }, [initialPlan]);

  // Auto-seed the database if needed, then attempt to sign in
  const handleDemoLogin = async (demoUser: typeof DEMO_USERS[0]) => {
    setLoading(true);
    setError('');
    setSeeding(true);
    try {
      // First ensure firestore is seeded
      await seedDatabaseIfNeeded();
      setSeeding(false);

      // Try logging in using Firebase Auth
      try {
        const userCredential = await signInWithEmailAndPassword(auth, demoUser.email, demoUser.password);
        
        // Fetch profile
        const profileRef = doc(db, 'users', userCredential.user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          onAuthSuccess({
            uid: userCredential.user.uid,
            email: demoUser.email,
            displayName: profileData.displayName || demoUser.displayName,
            role: profileData.role as UserRole,
            companyId: profileData.companyId || null
          });
        } else {
          // Create profile if auth succeeded but firestore profile missing
          const profile = {
            uid: userCredential.user.uid,
            email: demoUser.email,
            displayName: demoUser.displayName,
            role: demoUser.role,
            companyId: demoUser.companyId,
            active: true,
            createdAt: new Date().toISOString()
          };
          await setDoc(profileRef, profile);
          onAuthSuccess(profile);
        }
      } catch (authErr: any) {
        // If user not found, auto-register them (bulletproof fallback)
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
          console.log(`Demo user not found in Auth. Auto-provisioning ${demoUser.email}...`);
          const userCredential = await createUserWithEmailAndPassword(auth, demoUser.email, demoUser.password);
          
          // Write profile
          const profile = {
            uid: userCredential.user.uid,
            email: demoUser.email,
            displayName: demoUser.displayName,
            role: demoUser.role,
            companyId: demoUser.companyId,
            active: true,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', userCredential.user.uid), profile);
          
          onAuthSuccess(profile);
        } else {
          throw authErr;
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setIsOperationNotAllowed(true);
        setError('Email/Password sign-in is not enabled for this Firebase project.');
      } else {
        setError(`Demo login failed: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
      setSeeding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(false);

    try {
      setLoading(true);
      // Run DB seeder so lookup companies exist
      await seedDatabaseIfNeeded();

      if (isSignUp) {
        if (!displayName) {
          setError('Please provide your name.');
          setLoading(false);
          return;
        }

        if (role === 'CompanyAdmin' && !companyName) {
          setError('Please provide your company name for multi-tenant workspace setup.');
          setLoading(false);
          return;
        }

        // Register User in Firebase Auth
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        let finalCompanyId: string | null = null;
        if (role === 'CompanyAdmin') {
          finalCompanyId = 'comp-' + Math.random().toString(36).substring(2, 9);
        }

        // Write User Profile FIRST so security rules can check the user's role and companyId during subsequent writes
        const userProfile = {
          uid,
          email,
          displayName,
          companyId: finalCompanyId,
          role: role,
          active: true,
          createdAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'users', uid), userProfile);

        // If Company Admin, provision Company and Admin Employee SECOND
        if (role === 'CompanyAdmin' && finalCompanyId) {
          const newCompany: Company = {
            companyId: finalCompanyId,
            name: companyName,
            industry: industry,
            employeeCount: 1,
            subscriptionPlan: plan,
            subscriptionStatus: 'Trialing',
            billingEmail: email,
            renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days trial
            createdAt: new Date().toISOString(),
          };

          // Save company record
          await setDoc(doc(db, 'companies', finalCompanyId), newCompany);

          // Create matching employee profile for the admin so they are in the directory
          const adminEmp = {
            employeeId: 'emp-' + uid.substring(0, 5),
            userId: uid,
            companyId: finalCompanyId,
            firstName: displayName.split(' ')[0] || displayName,
            lastName: displayName.split(' ').slice(1).join(' ') || 'Admin',
            email: email,
            phone: '',
            dateOfBirth: '',
            gender: 'Male',
            address: '',
            jobTitle: 'Managing Director & HR Lead',
            departmentId: 'dept-product', // placeholder
            gradeLevel: 'Grade 9',
            employmentType: 'Full-Time',
            dateOfEmployment: new Date().toISOString().split('T')[0],
            status: 'Active',
            baseSalary: 10000,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, `companies/${finalCompanyId}/employees`, adminEmp.employeeId), adminEmp);
        }

        onAuthSuccess(userProfile);
      } else {
        // Sign In
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        // Get Firestore Profile
        const profileRef = doc(db, 'users', uid);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          const p = profileSnap.data();
          onAuthSuccess({
            uid,
            email,
            displayName: p.displayName || credential.user.displayName || 'User',
            role: (p.role || 'Employee') as UserRole,
            companyId: p.companyId || null,
          });
        } else {
          // Fallback if auth exists but firestore profile missing
          const p = {
            uid,
            email,
            displayName: credential.user.displayName || 'New User',
            role: 'Employee' as UserRole,
            companyId: null,
            active: true,
            createdAt: new Date().toISOString(),
          };
          await setDoc(profileRef, p);
          onAuthSuccess(p);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setIsOperationNotAllowed(true);
        setError('Email/Password sign-in is not enabled for this Firebase project.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    setIsOperationNotAllowed(false);
    try {
      await seedDatabaseIfNeeded();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user has a profile in Firestore
      const profileRef = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const p = profileSnap.data();
        onAuthSuccess({
          uid: user.uid,
          email: user.email || '',
          displayName: p.displayName || user.displayName || 'Google User',
          role: (p.role || 'Employee') as UserRole,
          companyId: p.companyId || null,
        });
      } else {
        // Create a default profile
        const p = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Google User',
          role: 'Employee' as UserRole, // default role
          companyId: null, // default no company
          active: true,
          createdAt: new Date().toISOString(),
        };
        await setDoc(profileRef, p);
        onAuthSuccess(p);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setIsOperationNotAllowed(true);
        setError('Google Sign-In is not enabled for this Firebase project.');
      } else {
        setError(`Google login failed: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row" id="auth-page">
      
      {/* LEFT SIDE: SaaS Value Proposition */}
      <div className="lg:w-1/2 bg-slate-900 text-white flex flex-col justify-between p-8 lg:p-16 relative overflow-hidden">
        
        {/* Subtle Background Art */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-brand-600 rounded-full blur-3xl opacity-10"></div>
        <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-10"></div>
        
        {/* Header Branding */}
        <div className="flex items-center space-x-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-sky-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold font-display tracking-tight text-slate-100">PeopleCloud <span className="text-brand-400">HRIS</span></span>
        </div>

        {/* Feature Cards Grid */}
        <div className="my-auto py-12 relative z-10 max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-bold font-display leading-tight mb-6">
            The intelligent hub for growing organizations.
          </h1>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            PeopleCloud is a modern, secure, multi-tenant SaaS HR platform that consolidates records, leave requests, daily attendance, onboarding, and payroll run files in one responsive, role-based cockpit.
          </p>

          <div className="space-y-4">
            <div className="flex items-start space-x-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
              <div className="w-6 h-6 rounded bg-brand-500/10 flex items-center justify-center text-brand-400 shrink-0 mt-0.5">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-200">Robust Multi-Tenancy</h4>
                <p className="text-xs text-slate-400">Isolated database structures for secure cloud-level tenant and employee safety.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
              <div className="w-6 h-6 rounded bg-brand-500/10 flex items-center justify-center text-brand-400 shrink-0 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-200">Role-Based Access (RBAC)</h4>
                <p className="text-xs text-slate-400">8 tailored access roles, providing specialized compliance views, manager actions, and employee self-service desks.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-xs text-slate-500 relative z-10 flex items-center justify-between">
          <span>© 2026 PeopleCloud Systems Inc.</span>
          <span>SaaS Edition 1.1</span>
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Gateway & Demo Access portal */}
      <div className="lg:w-1/2 flex flex-col justify-center p-6 sm:p-12 lg:p-16 overflow-y-auto">
        <div className="max-w-md w-full mx-auto space-y-8">
          
          {/* Main Auth Form Container */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/80">
            {onBackToLanding && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                &larr; Back to Marketing Website
              </button>
            )}
            <div className="mb-6">
              <h2 className="text-2xl font-bold font-display text-slate-900">
                {isSignUp ? 'Create Workspace' : 'Sign in to PeopleCloud'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {isSignUp 
                  ? 'Establish your company workspace and administrative profile.' 
                  : 'Enter your credentials to access your organization dashboard.'
                }
              </p>
            </div>

            {isOperationNotAllowed ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4 animate-fade-in space-y-3 text-left">
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <KeyRound className="w-3 h-3 text-amber-700" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Email/Password Provider Disabled</h4>
                    <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                      By default, Firebase only activates Google Auth. To sign in with demo accounts like <strong>superadmin@peoplecloud.com</strong>, please enable the <strong>Email/Password</strong> provider in your Firebase console:
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1 text-[10px] text-amber-800 pl-7 list-decimal">
                  <div>1. Go to your Firebase project console.</div>
                  <div>2. Navigate to <strong>Build</strong> &rarr; <strong>Authentication</strong> &rarr; <strong>Sign-in method</strong>.</div>
                  <div>3. Click <strong>Add new provider</strong>, select <strong>Email/Password</strong>, enable it, and save.</div>
                </div>

                <a 
                  href="https://console.firebase.google.com/project/gen-lang-client-0582357449/authentication/providers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer text-center"
                >
                  Configure Firebase Auth &rarr;
                </a>
              </div>
            ) : error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 mb-4 animate-fade-in">
                {error}
              </div>
            )}

            {seeding && (
              <div className="p-3 bg-blue-50 text-brand-700 text-xs rounded-lg border border-brand-100 mb-4 animate-pulse">
                Preparing demo database. Writing multi-tenant records to Firestore...
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      placeholder="Marcus Sterling"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">I want to register as</label>
                    <select 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                    >
                      <option value="CompanyAdmin">Company Admin (Create New Company)</option>
                      <option value="SuperAdmin">SaaS Super Admin (SaaS Platform Owner)</option>
                    </select>
                  </div>

                  {role === 'CompanyAdmin' && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        Company & Subscription Configuration
                      </h4>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company Name</label>
                        <input 
                          type="text" 
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none bg-white"
                          placeholder="Acme Tech Labs Ltd"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Industry</label>
                          <select 
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                          >
                            <option value="Technology & Software">Tech & Software</option>
                            <option value="Logistics & Supply Chain">Logistics</option>
                            <option value="Finance & Insurance">Finance</option>
                            <option value="Healthcare">Healthcare</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SaaS Plan Tier</label>
                          <select 
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-brand-600 font-medium"
                            value={plan}
                            onChange={(e) => setPlan(e.target.value as any)}
                          >
                            <option value="Starter">Starter (Max 25)</option>
                            <option value="Growth">Growth (Max 100)</option>
                            <option value="Professional">Professional (Max 500)</option>
                            <option value="Enterprise">Enterprise (Unlimited)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address</label>
                <input 
                  type="email" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  placeholder="admin@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Password</label>
                <input 
                  type="password" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2 bg-slate-900 text-white hover:bg-slate-800 font-semibold text-sm rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Processing...' : (isSignUp ? 'Setup Workspace & Register' : 'Sign In')}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500 font-medium">Or continue with</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.5-.1 1.14-.14 2.07 1.54h10.27z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.88-3.02c-1.08.72-2.45 1.16-4.08 1.16-3.14 0-5.8-2.12-6.75-4.97H1.17v3.12C3.15 21.1 7.29 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.25 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.62H1.17C.42 8.11 0 9.77 0 11.5s.42 3.39 1.17 4.88l4.08-3.12z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.96 1.19 15.24 0 12 0 7.29 0 3.15 2.9 1.17 6.62l4.08 3.12c.95-2.85 3.61-4.99 6.75-4.99z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
            </form>

            {/* Form Mode Toggle */}
            <div className="mt-4 text-center">
              <button 
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                }}
                className="text-xs text-brand-600 hover:underline font-medium cursor-pointer"
              >
                {isSignUp ? 'Already registered? Sign in instead' : 'Need a workspace for your company? Register here'}
              </button>
            </div>
          </div>

          {/* DEMO ACCESS PORTAL - ACCORDION STYLE OR DIRECT DISPLAY */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="flex items-center space-x-2 text-brand-600 mb-3">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-sm font-bold tracking-tight uppercase">SaaS Demo Audit Portal</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Test multi-tenancy and Role-Based Access Control (RBAC) instantly. Select a pre-seeded account representing different company roles:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_USERS.map((user) => (
                <button
                  key={user.uid}
                  disabled={loading}
                  onClick={() => handleDemoLogin(user)}
                  className="flex flex-col items-start p-3 bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-xl text-left transition-all duration-150 disabled:opacity-50 cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-slate-900 group-hover:text-brand-700 flex items-center gap-1">
                    {user.displayName}
                    <UserCheck className="w-3 h-3 text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                    {user.role}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 mt-1 overflow-hidden text-ellipsis max-w-full">
                    {user.email}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-center space-x-1 text-[10px] text-slate-400">
              <KeyRound className="w-3 h-3" />
              <span>All password credentials default to: <span className="font-mono font-bold text-slate-500">password123</span></span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
