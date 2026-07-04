import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  FileEdit, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Award, 
  FileText, 
  Save, 
  Send,
  UserCheck,
  Star,
  Activity
} from 'lucide-react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserRole, Employee, AppraisalGoal, PerformanceAppraisal as IPerformanceAppraisal } from '../types';

interface PerformanceAppraisalProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

const DEFAULT_KPIS = [
  { kpiName: 'Quality of Work & Accuracy', weight: 25 },
  { kpiName: 'Timeliness & Dependability', weight: 25 },
  { kpiName: 'Communication & Teamwork', weight: 25 },
  { kpiName: 'Problem Solving & Innovation', weight: 25 }
];

export default function PerformanceAppraisal({ currentUser, selectedTenantId }: PerformanceAppraisalProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const [activeSubTab, setActiveSubTab] = useState<'goals' | 'appraisals'>('goals');
  const [loading, setLoading] = useState(true);

  // Common datasets
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployeeProfile, setCurrentEmployeeProfile] = useState<Employee | null>(null);

  // Goals state
  const [goals, setGoals] = useState<AppraisalGoal[]>([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalWeight, setGoalWeight] = useState(25);
  const [goalEmployeeId, setGoalEmployeeId] = useState('');

  // Extended goal hierarchy states
  const [goalLevel, setGoalLevel] = useState<'Employee' | 'Department' | 'Organisation'>('Employee');
  const [goalDeptId, setGoalDeptId] = useState('dept-eng');
  const [goalParentId, setGoalParentId] = useState('');
  const [goalProgress, setGoalProgress] = useState(0);
  const [levelFilter, setLevelFilter] = useState<'All' | 'Employee' | 'Department' | 'Organisation'>('All');

  // Appraisals state
  const [appraisals, setAppraisals] = useState<IPerformanceAppraisal[]>([]);
  const [selectedAppraisal, setSelectedAppraisal] = useState<IPerformanceAppraisal | null>(null);
  const [newPeriod, setNewPeriod] = useState('2026 Annual Performance Appraisal');
  const [selfFeedback, setSelfFeedback] = useState('');
  const [managerFeedback, setManagerFeedback] = useState('');
  const [kpiRatings, setKpiRatings] = useState<{ [key: string]: { self: number; manager: number } }>({});
  const [appraisalEmployeeId, setAppraisalEmployeeId] = useState('');

  // Search/Filter
  const [searchQuery, setSearchQuery] = useState('');

  const isHR = currentUser.role === 'CompanyAdmin' || currentUser.role === 'HRManager';
  const isManager = currentUser.role === 'LineManager';
  const isEmployeeOnly = currentUser.role === 'Employee';

  useEffect(() => {
    if (!companyId) return;
    loadData();
  }, [companyId, currentUser]);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Load Employees
      const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
      const empList: Employee[] = [];
      empSnap.forEach(docSnap => {
        empList.push({ ...docSnap.data() as Employee, employeeId: docSnap.id });
      });
      setEmployees(empList);

      // Identify current user's employee record if they are an employee
      const match = empList.find(e => e.email.toLowerCase() === currentUser.email.toLowerCase());
      if (match) {
        setCurrentEmployeeProfile(match);
        setGoalEmployeeId(match.employeeId);
        setAppraisalEmployeeId(match.employeeId);
      } else if (empList.length > 0) {
        setGoalEmployeeId(empList[0].employeeId);
        setAppraisalEmployeeId(empList[0].employeeId);
      }

      // 2. Load Goals
      const goalsSnap = await getDocs(collection(db, `companies/${companyId}/goals`));
      const goalsList: AppraisalGoal[] = [];
      goalsSnap.forEach(docSnap => {
        goalsList.push({ ...docSnap.data() as AppraisalGoal, goalId: docSnap.id });
      });
      setGoals(goalsList);

      // 3. Load Appraisals
      const appraisalsSnap = await getDocs(collection(db, `companies/${companyId}/appraisals`));
      const appraisalsList: IPerformanceAppraisal[] = [];
      appraisalsSnap.forEach(docSnap => {
        appraisalsList.push({ ...docSnap.data() as IPerformanceAppraisal, appraisalId: docSnap.id });
      });
      setAppraisals(appraisalsList);

    } catch (err) {
      console.error('Error loading appraisal data:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- GOAL ACTIONS ---
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !goalTitle) return;

    try {
      const empId = goalLevel === 'Organisation' 
        ? 'company-wide' 
        : (goalLevel === 'Department' ? `dept-${goalDeptId}` : goalEmployeeId);

      const newGoal: any = {
        companyId,
        employeeId: empId || '',
        title: goalTitle,
        description: goalDesc,
        weight: Number(goalWeight),
        status: isHR || isManager ? 'Approved' : 'Draft',
        level: goalLevel,
        departmentId: goalLevel === 'Department' ? goalDeptId : '',
        parentGoalId: goalLevel !== 'Organisation' ? goalParentId : '',
        progress: Number(goalProgress) || 0,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, `companies/${companyId}/goals`), newGoal);
      setGoals([...goals, { ...newGoal, goalId: docRef.id }]);
      setGoalTitle('');
      setGoalDesc('');
      setGoalWeight(25);
      setGoalParentId('');
      setGoalProgress(0);
    } catch (err) {
      console.error('Error adding goal:', err);
    }
  };

  const handleUpdateGoalStatus = async (goalId: string, status: AppraisalGoal['status']) => {
    if (!companyId) return;
    try {
      const docRef = doc(db, `companies/${companyId}/goals`, goalId);
      await updateDoc(docRef, { status });
      setGoals(goals.map(g => g.goalId === goalId ? { ...g, status } : g));
    } catch (err) {
      console.error('Error updating goal:', err);
    }
  };

  const handleUpdateGoalProgress = async (goalId: string, newProgress: number) => {
    if (!companyId) return;
    const boundedProgress = Math.max(0, Math.min(100, newProgress));
    try {
      const docRef = doc(db, `companies/${companyId}/goals`, goalId);
      await updateDoc(docRef, { progress: boundedProgress });
      setGoals(goals.map(g => g.goalId === goalId ? { ...g, progress: boundedProgress } as any : g));
    } catch (err) {
      console.error('Error updating goal progress:', err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!companyId || !window.confirm('Delete this goal record?')) return;
    try {
      await deleteDoc(doc(db, `companies/${companyId}/goals`, goalId));
      setGoals(goals.filter(g => g.goalId !== goalId));
    } catch (err) {
      console.error(err);
    }
  };

  // --- APPRAISAL ACTIONS ---
  const handleInitiateAppraisal = async () => {
    if (!companyId || !appraisalEmployeeId) return;

    // Check if appraisal already exists for this employee and period
    const exists = appraisals.find(a => a.employeeId === appraisalEmployeeId && a.period === newPeriod);
    if (exists) {
      alert(`Appraisal already exists for this employee in the ${newPeriod} period.`);
      setSelectedAppraisal(exists);
      return;
    }

    try {
      const newApp: Omit<IPerformanceAppraisal, 'appraisalId'> = {
        companyId,
        employeeId: appraisalEmployeeId,
        period: newPeriod,
        status: 'Draft',
        kpis: DEFAULT_KPIS.map(k => ({
          kpiName: k.kpiName,
          weight: k.weight,
          selfRating: 3,
          managerRating: 3
        })),
        selfFeedback: '',
        managerFeedback: '',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, `companies/${companyId}/appraisals`), newApp);
      const createdAppraisal: IPerformanceAppraisal = { ...newApp, appraisalId: docRef.id };
      setAppraisals([...appraisals, createdAppraisal]);
      setSelectedAppraisal(createdAppraisal);
      
      // Seed default KPI ratings
      const initKpis: { [key: string]: { self: number; manager: number } } = {};
      newApp.kpis.forEach(k => {
        initKpis[k.kpiName] = { self: 3, manager: 3 };
      });
      setKpiRatings(initKpis);
      setSelfFeedback('');
      setManagerFeedback('');
    } catch (err) {
      console.error('Error initiating appraisal:', err);
    }
  };

  const handleSelectAppraisal = (app: IPerformanceAppraisal) => {
    setSelectedAppraisal(app);
    setSelfFeedback(app.selfFeedback || '');
    setManagerFeedback(app.managerFeedback || '');
    const currentKpis: { [key: string]: { self: number; manager: number } } = {};
    app.kpis.forEach(k => {
      currentKpis[k.kpiName] = { self: k.selfRating || 3, manager: k.managerRating || 3 };
    });
    setKpiRatings(currentKpis);
  };

  const handleUpdateKpiRating = (kpiName: string, type: 'self' | 'manager', value: number) => {
    setKpiRatings(prev => ({
      ...prev,
      [kpiName]: {
        ...prev[kpiName],
        [type]: value
      }
    }));
  };

  const handleSaveAppraisal = async (status: IPerformanceAppraisal['status']) => {
    if (!companyId || !selectedAppraisal) return;

    try {
      // Map ratings back into KPIs
      const updatedKpis = selectedAppraisal.kpis.map(k => ({
        ...k,
        selfRating: kpiRatings[k.kpiName]?.self ?? 3,
        managerRating: kpiRatings[k.kpiName]?.manager ?? 3
      }));

      // Calculate final weighted score
      let totalWeightedScore = 0;
      let totalWeight = 0;
      updatedKpis.forEach(k => {
        const score = status === 'Approved' || status === 'Reviewed' ? k.managerRating : k.selfRating;
        totalWeightedScore += score * k.weight;
        totalWeight += k.weight;
      });
      const finalScore = Number((totalWeightedScore / totalWeight).toFixed(2));

      const updatedData: Partial<IPerformanceAppraisal> = {
        status,
        kpis: updatedKpis,
        selfFeedback,
        managerFeedback,
        finalScore
      };

      const docRef = doc(db, `companies/${companyId}/appraisals`, selectedAppraisal.appraisalId);
      await updateDoc(docRef, updatedData);

      // Create internal notification
      await addDoc(collection(db, `companies/${companyId}/notifications`), {
        userId: currentUser.uid,
        title: 'Appraisal Status Updated',
        message: `Your ${selectedAppraisal.period} appraisal status is now ${status}.`,
        read: false,
        type: 'System',
        createdAt: new Date().toISOString()
      });

      // Update state
      const updatedList = appraisals.map(a => 
        a.appraisalId === selectedAppraisal.appraisalId 
          ? { ...a, ...updatedData } 
          : a
      );
      setAppraisals(updatedList);
      setSelectedAppraisal({ ...selectedAppraisal, ...updatedData });
      alert('Appraisal form successfully updated!');
    } catch (err) {
      console.error('Error saving appraisal:', err);
    }
  };

  // Filter datasets based on view context (Personal vs Admin/All)
  const getFilteredGoals = () => {
    let filtered = goals;
    if (isEmployeeOnly && currentEmployeeProfile) {
      filtered = goals.filter(g => 
        g.employeeId === currentEmployeeProfile.employeeId || 
        g.employeeId === 'company-wide' || 
        g.employeeId === `dept-${currentEmployeeProfile.department || 'eng'}`
      );
    }
    if (levelFilter !== 'All') {
      filtered = filtered.filter(g => (g as any).level === levelFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(g => {
        const emp = employees.find(e => e.employeeId === g.employeeId);
        return g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
               (emp && `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));
      });
    }
    return filtered;
  };

  const getFilteredAppraisals = () => {
    let filtered = appraisals;
    if (isEmployeeOnly && currentEmployeeProfile) {
      filtered = appraisals.filter(a => a.employeeId === currentEmployeeProfile.employeeId);
    }
    if (searchQuery) {
      filtered = filtered.filter(a => {
        const emp = employees.find(e => e.employeeId === a.employeeId);
        return a.period.toLowerCase().includes(searchQuery.toLowerCase()) || 
               (emp && `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));
      });
    }
    return filtered;
  };

  const visibleGoals = getFilteredGoals();
  const visibleAppraisals = getFilteredAppraisals();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Activity className="w-8 h-8 text-brand-600 animate-spin" />
        <span className="ml-3 text-xs text-slate-500 font-mono">Syncing IIPM performance records...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="performance-appraisal-panel">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-950 font-display">Performance & Talent Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Core HRIS Module for goal-setting, KPI tracking, self-evaluations, and line manager feedback.
          </p>
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveSubTab('goals')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeSubTab === 'goals' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Goals & KPIs
          </button>
          <button
            onClick={() => setActiveSubTab('appraisals')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeSubTab === 'appraisals' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Appraisal Forms
          </button>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search performance records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Action Button: Create Appraisal */}
        {activeSubTab === 'appraisals' && (isHR || isManager) && (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={newPeriod}
              onChange={(e) => setNewPeriod(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="2026 Annual Performance Appraisal">2026 Annual Review</option>
              <option value="2026 Mid-Year Performance Appraisal">2026 Mid-Year Review</option>
              <option value="Probationary Confirmation Appraisal">Probation Confirmation</option>
            </select>
            
            <select
              value={appraisalEmployeeId}
              onChange={(e) => setAppraisalEmployeeId(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="">-- Choose Employee --</option>
              {employees.map(emp => (
                <option key={emp.employeeId} value={emp.employeeId}>
                  {emp.firstName} {emp.lastName} ({emp.jobTitle})
                </option>
              ))}
            </select>

            <button
              onClick={handleInitiateAppraisal}
              disabled={!appraisalEmployeeId}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate Appraisal</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENT: GOALS & KPIS */}
      {activeSubTab === 'goals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: Goal Creation Panel */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-brand-600" />
                <span>Create New Goal / KPI</span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-1">Establish aligned strategic landmarks & employee objectives.</p>
            </div>

            <form onSubmit={handleAddGoal} className="space-y-3">
              
              {/* Goal Level selection */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Goal Hierarchy Level</label>
                <select
                  value={goalLevel}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setGoalLevel(val);
                    if (val === 'Organisation') {
                      setGoalEmployeeId('company-wide');
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="Employee">👤 Individual Employee level</option>
                  <option value="Department">👥 Departmental unit milestone</option>
                  <option value="Organisation">🏢 Company Organisation target</option>
                </select>
              </div>

              {/* Conditional department selector */}
              {goalLevel === 'Department' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Associated Department</label>
                  <select
                    value={goalDeptId}
                    onChange={(e) => setGoalDeptId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="dept-eng">Engineering Department</option>
                    <option value="dept-sales">Sales & Growth</option>
                    <option value="dept-hr">HR & Operations</option>
                    <option value="dept-finance">Finance & Treasury</option>
                    <option value="dept-product">Product & Design</option>
                  </select>
                </div>
              )}

              {/* Target Employee (Only for Employee goals) */}
              {goalLevel === 'Employee' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Target Employee</label>
                  {isEmployeeOnly ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-700">
                      {currentEmployeeProfile?.firstName} {currentEmployeeProfile?.lastName} (Self)
                    </div>
                  ) : (
                    <select
                      value={goalEmployeeId}
                      onChange={(e) => setGoalEmployeeId(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">-- Select Employee --</option>
                      {employees.map(emp => (
                        <option key={emp.employeeId} value={emp.employeeId}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Aligned Parent Goal (to link / map goal) */}
              {goalLevel !== 'Organisation' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Map to Corporate Target (Alignment)</label>
                  <select
                    value={goalParentId}
                    onChange={(e) => setGoalParentId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">-- No Direct Parent Target --</option>
                    {goals.filter(g => (g as any).level === 'Organisation' || (g as any).level === 'Department').map(g => (
                      <option key={g.goalId} value={g.goalId}>
                        {((g as any).level === 'Organisation' ? '🏢 ' : '👥 ') + g.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Goal Title */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Goal Title</label>
                <input
                  type="text"
                  placeholder="e.g. Increase sales conversion by 15%"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Description & Key Results</label>
                <textarea
                  rows={2}
                  placeholder="Provide precise measurable KPIs..."
                  value={goalDesc}
                  onChange={(e) => setGoalDesc(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Goal Weight and Starting progress */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Weight (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={goalWeight}
                    onChange={(e) => setGoalWeight(Number(e.target.value))}
                    required
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">Starting progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={goalProgress}
                    onChange={(e) => setGoalProgress(Number(e.target.value))}
                    required
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg p-2 text-xs font-semibold flex items-center justify-center space-x-1.5 shadow transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Goal Target</span>
              </button>
            </form>
          </div>

          {/* RIGHT: Goals Listing */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Visual Level Filters Bar */}
            <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex flex-wrap gap-1">
              {[
                { key: 'All', label: 'All Levels', icon: '🎯' },
                { key: 'Organisation', label: 'Organisation Targets', icon: '🏢' },
                { key: 'Department', label: 'Department Milestones', icon: '👥' },
                { key: 'Employee', label: 'Individual Goals', icon: '👤' }
              ].map((lvl) => (
                <button
                  key={lvl.key}
                  type="button"
                  onClick={() => setLevelFilter(lvl.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    levelFilter === lvl.key
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{lvl.icon}</span>
                  <span>{lvl.label}</span>
                  <span className="px-1 py-0.2 bg-slate-200 text-[9px] text-slate-600 rounded-full font-mono">
                    {lvl.key === 'All' 
                      ? goals.length 
                      : goals.filter(g => (g as any).level === lvl.key).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Appraisal Goals</h2>
              
              {visibleGoals.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="text-xs">No goals matched the search or view context.</p>
                </div>
              ) : (
                <div className="space-y-4 divide-y divide-slate-100/60">
                  {visibleGoals.map((g, index) => {
                    const emp = employees.find(e => e.employeeId === g.employeeId);
                    const lvl = (g as any).level || 'Employee';
                    const progressVal = Number((g as any).progress) || 0;
                    
                    // Retrieve parent goal details for alignment mapping tracing
                    const parentGoal = g.parentGoalId ? goals.find(pg => pg.goalId === g.parentGoalId) : null;

                    return (
                      <div key={g.goalId} className={`pt-4 first:pt-0 space-y-3`}>
                        
                        {/* Title and Level Badge */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{g.title}</span>
                              <span className="bg-slate-100 text-[10px] font-mono font-medium px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                                Weight: {g.weight}%
                              </span>
                              
                              {/* Hierarchy Level Badges */}
                              {lvl === 'Organisation' && (
                                <span className="bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                  🏢 Organisation Target
                                </span>
                              )}
                              {lvl === 'Department' && (
                                <span className="bg-purple-50 text-purple-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                                  👥 Department Milestone
                                </span>
                              )}
                              {lvl === 'Employee' && (
                                <span className="bg-blue-50 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                                  👤 Individual Employee Goal
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 max-w-xl">{g.description}</p>
                          </div>

                          {/* Level context label */}
                          <div className="text-[10px] text-slate-400 shrink-0 text-right">
                            {lvl === 'Organisation' && <span className="font-bold text-amber-700">Company-wide Goal</span>}
                            {lvl === 'Department' && <span className="font-bold text-purple-700">Unit: {(g as any).departmentId === 'dept-eng' ? 'Engineering' : 'Operations'}</span>}
                            {lvl === 'Employee' && <span>Owner: <strong className="text-slate-600">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned'}</strong></span>}
                          </div>
                        </div>

                        {/* Hierarchical Alignment Map Trace path */}
                        {parentGoal && (
                          <div className="p-2 bg-slate-50/80 border border-slate-200/40 rounded-lg text-[10px] text-slate-500 flex items-center gap-2 italic animate-fade-in">
                            <span className="text-xs">🎯</span>
                            <span>Mapped Hierarchy Alignment: </span>
                            <span className="font-bold text-slate-700">“{parentGoal.title}”</span>
                            <span className="text-slate-400">({(parentGoal as any).level})</span>
                          </div>
                        )}

                        {/* Interactive Progress Tracking Slider & Controls */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                              <span>Strategic Progress</span>
                              <span className="font-bold text-slate-800">{progressVal}%</span>
                            </div>
                            <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden relative">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${progressVal}%` }}
                              />
                            </div>
                          </div>

                          {/* Live Adjusters */}
                          <div className="flex items-center gap-1.5 justify-end shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateGoalProgress(g.goalId, progressVal - 10)}
                              className="px-2 py-1 text-[10px] border border-slate-200 hover:bg-slate-100 text-slate-600 rounded font-bold cursor-pointer"
                            >
                              -10%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateGoalProgress(g.goalId, progressVal + 10)}
                              className="px-2 py-1 text-[10px] border border-slate-200 hover:bg-slate-100 text-slate-600 rounded font-bold cursor-pointer"
                            >
                              +10%
                            </button>

                            <span className="text-slate-300 mx-1">|</span>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              g.status === 'Achieved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              g.status === 'In_Progress' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              g.status === 'Missed' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                              'bg-slate-50 text-slate-600 border-slate-100'
                            }`}>
                              {g.status.replace('_', ' ')}
                            </span>

                            {/* Quick Actions (Manager & Admin only) */}
                            {!isEmployeeOnly && (
                              <div className="flex items-center gap-1 border-l border-slate-150 pl-2 ml-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateGoalStatus(g.goalId, 'Achieved')}
                                  title="Mark Achieved"
                                  className="p-1 hover:bg-emerald-50 rounded text-emerald-600 cursor-pointer"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateGoalStatus(g.goalId, 'Missed')}
                                  title="Mark Missed"
                                  className="p-1 hover:bg-rose-50 rounded text-rose-600 cursor-pointer"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGoal(g.goalId)}
                                  title="Delete Goal"
                                  className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT: APPRAISALS */}
      {activeSubTab === 'appraisals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: Appraisal Selector Panel */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Appraisal Period Forms</h2>
            
            {visibleAppraisals.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No appraisals initiated yet.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {visibleAppraisals.map((app) => {
                  const emp = employees.find(e => e.employeeId === app.employeeId);
                  const isSelected = selectedAppraisal?.appraisalId === app.appraisalId;
                  return (
                    <button
                      key={app.appraisalId}
                      onClick={() => handleSelectAppraisal(app)}
                      className={`w-full text-left p-3.5 rounded-lg border text-xs transition-all flex justify-between items-center ${
                        isSelected 
                          ? 'border-brand-500 bg-brand-50/50' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">{app.period}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee'}
                        </div>
                        {app.finalScore !== undefined && (
                          <div className="text-[10px] font-mono text-slate-500 font-bold flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>Score: {app.finalScore} / 5</span>
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        app.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        app.status === 'Reviewed' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                        app.status === 'Submitted' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-slate-50 text-slate-600 border-slate-100'
                      }`}>
                        {app.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Appraisal Form Details Editor */}
          <div className="lg:col-span-2">
            {selectedAppraisal ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                
                {/* Header Information */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Active Appraisal Form</span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedAppraisal.period}</h3>
                    <p className="text-xs text-slate-500">
                      Evaluate competencies across key indicators on a 1 (Unsatisfactory) to 5 (Outstanding) scale.
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded border ${
                    selectedAppraisal.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    selectedAppraisal.status === 'Reviewed' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                    selectedAppraisal.status === 'Submitted' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    'bg-slate-50 text-slate-600 border-slate-100'
                  }`}>
                    {selectedAppraisal.status}
                  </span>
                </div>

                {/* KPIs Ratings Matrix */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">KPIs & Performance Metrics</h4>
                  <div className="space-y-3.5">
                    {selectedAppraisal.kpis.map((kpi) => {
                      const currentRatings = kpiRatings[kpi.kpiName] || { self: 3, manager: 3 };
                      return (
                        <div key={kpi.kpiName} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <span className="text-xs font-bold text-slate-950">{kpi.kpiName}</span>
                              <p className="text-[10px] text-slate-400 mt-0.5">Weighted relevance: {kpi.weight}%</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                            {/* Employee Self Rating */}
                            <div>
                              <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Self Assessment</span>
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map(val => (
                                  <button
                                    key={val}
                                    type="button"
                                    disabled={selectedAppraisal.status !== 'Draft'}
                                    onClick={() => handleUpdateKpiRating(kpi.kpiName, 'self', val)}
                                    className={`p-1.5 rounded transition-all ${
                                      currentRatings.self >= val ? 'text-amber-500' : 'text-slate-300'
                                    }`}
                                  >
                                    <Star className="w-4 h-4 fill-current" />
                                  </button>
                                ))}
                                <span className="ml-2 font-mono text-xs text-slate-600 font-bold">{currentRatings.self} / 5</span>
                              </div>
                            </div>

                            {/* Manager Appraisal Rating */}
                            <div>
                              <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supervisor Assessment</span>
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map(val => (
                                  <button
                                    key={val}
                                    type="button"
                                    disabled={isEmployeeOnly || selectedAppraisal.status === 'Approved'}
                                    onClick={() => handleUpdateKpiRating(kpi.kpiName, 'manager', val)}
                                    className={`p-1.5 rounded transition-all ${
                                      currentRatings.manager >= val ? 'text-brand-600' : 'text-slate-300'
                                    }`}
                                  >
                                    <Star className="w-4 h-4 fill-current" />
                                  </button>
                                ))}
                                <span className="ml-2 font-mono text-xs text-slate-600 font-bold">{currentRatings.manager} / 5</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Self Feedback */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Employee Self-Feedback / Achievements</label>
                    <textarea
                      rows={3}
                      value={selfFeedback}
                      disabled={selectedAppraisal.status !== 'Draft'}
                      onChange={(e) => setSelfFeedback(e.target.value)}
                      placeholder="List accomplishments, training gaps, and feedback..."
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>

                  {/* Manager Feedback */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Supervisor Overall Evaluation</label>
                    <textarea
                      rows={3}
                      value={managerFeedback}
                      disabled={isEmployeeOnly || selectedAppraisal.status === 'Approved'}
                      onChange={(e) => setManagerFeedback(e.target.value)}
                      placeholder="Provide overall supervisor recommendations and growth plans..."
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-400">
                    Calculated rating average will compile upon save.
                  </div>
                  
                  <div className="flex gap-2">
                    {/* Employee Actions */}
                    {selectedAppraisal.status === 'Draft' && (
                      <>
                        <button
                          onClick={() => handleSaveAppraisal('Draft')}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <Save className="w-4 h-4" />
                          <span>Save Draft</span>
                        </button>
                        <button
                          onClick={() => handleSaveAppraisal('Submitted')}
                          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                        >
                          <Send className="w-4 h-4" />
                          <span>Submit Evaluation</span>
                        </button>
                      </>
                    )}

                    {/* Manager & Admin Review Actions */}
                    {selectedAppraisal.status === 'Submitted' && !isEmployeeOnly && (
                      <>
                        <button
                          onClick={() => handleSaveAppraisal('Reviewed')}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <Save className="w-4 h-4" />
                          <span>Save Evaluations</span>
                        </button>
                        <button
                          onClick={() => handleSaveAppraisal('Approved')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Approve & Finalize</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <Award className="w-12 h-12 text-slate-300 mb-2" />
                <h4 className="text-xs font-bold text-slate-700">No Appraisal Selected</h4>
                <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                  Select an active appraisal form from the list to enter ratings, view self-assessment comments, and write supervisor evaluations.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
