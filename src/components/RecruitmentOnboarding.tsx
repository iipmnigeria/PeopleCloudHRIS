import React, { useState, useEffect } from 'react';
import { UserRole, Job, Candidate, Employee } from '../types';
import { 
  Plus, 
  Briefcase, 
  Users, 
  CheckSquare, 
  ArrowRight, 
  FileText, 
  Play, 
  CheckCircle, 
  Trash2,
  BookmarkPlus,
  AlertCircle
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface RecruitmentOnboardingProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function RecruitmentOnboarding({ currentUser, selectedTenantId }: RecruitmentOnboardingProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isRecruiter = ['CompanyAdmin', 'HRManager', 'Recruiter'].includes(currentUser.role);
  const isEmployeeOnly = currentUser.role === 'Employee';

  // State Management
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'job-board' | 'candidate-pipeline' | 'onboarding-checklists'>('job-board');

  // New Job Opening Form States
  const [jobTitle, setJobTitle] = useState('');
  const [jobDept, setJobDept] = useState('dept-eng');
  const [jobDesc, setJobDesc] = useState('');
  const [jobSalary, setJobSalary] = useState('$80,000 - $110,000');
  const [jobLoading, setJobLoading] = useState(false);

  // New Candidate App Form States
  const [candName, setCandName] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candJobId, setCandJobId] = useState('');
  const [candResumeName, setCandResumeName] = useState('cv_curriculum_vitae.pdf');
  const [candLoading, setCandLoading] = useState(false);

  // Fetch Firestore Records
  useEffect(() => {
    async function loadRecruitmentData() {
      if (!companyId) return;
      try {
        // Fetch Jobs
        const jobSnap = await getDocs(collection(db, `companies/${companyId}/jobs`));
        const jobList: Job[] = [];
        jobSnap.forEach(d => jobList.push({ ...d.data() as Job, jobId: d.id }));
        setJobs(jobList);

        // Fetch Candidates
        const candSnap = await getDocs(collection(db, `companies/${companyId}/candidates`));
        const candList: Candidate[] = [];
        candSnap.forEach(d => candList.push({ ...d.data() as Candidate, candidateId: d.id }));
        setCandidates(candList);

        // Fetch Employees (New hires)
        const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const empList: Employee[] = [];
        empSnap.forEach(d => empList.push({ ...d.data() as Employee, employeeId: d.id }));
        setEmployees(empList);

        // Default layout tabs
        if (isRecruiter && !isEmployeeOnly) {
          setActiveTab('candidate-pipeline');
        } else {
          setActiveTab('job-board');
        }
      } catch (err) {
        console.error('Error loading recruitment database:', err);
      }
    }
    loadRecruitmentData();
  }, [companyId, isRecruiter, isEmployeeOnly]);

  // Submit Job Opening
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !jobTitle.trim()) return;
    setJobLoading(true);

    try {
      const jobId = 'job-' + Math.random().toString(36).substring(2, 9);
      const newJob: Job = {
        jobId,
        companyId,
        title: jobTitle.trim(),
        departmentId: jobDept,
        description: jobDesc.trim(),
        requirements: 'Requires relevant industry certifications and team experience.',
        salaryRange: jobSalary,
        status: 'Published',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/jobs`, jobId), newJob);
      setJobs([...jobs, newJob]);

      setJobTitle('');
      setJobDesc('');
    } catch (err) {
      console.error(err);
    } finally {
      setJobLoading(false);
    }
  };

  // Submit Candidate Application
  const handleApplyCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !candName.trim() || !candJobId) return;
    setCandLoading(true);

    try {
      const candId = 'cand-' + Math.random().toString(36).substring(2, 9);
      const newCand: Candidate = {
        candidateId: candId,
        companyId,
        jobId: candJobId,
        name: candName.trim(),
        email: candEmail.trim(),
        stage: 'Screening',
        cvUrl: `https://firebasestorage.simulation.app/resumes/${candId}/${candResumeName}`,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/candidates`, candId), newCand);
      setCandidates([...candidates, newCand]);

      setCandName('');
      setCandEmail('');
      setCandJobId('');
    } catch (err) {
      console.error(err);
    } finally {
      setCandLoading(false);
    }
  };

  // Advance Candidate Pipeline Phase
  const handleTransitionCandidate = async (cand: Candidate, stage: Candidate['stage']) => {
    if (!companyId) return;
    try {
      const docRef = doc(db, `companies/${companyId}/candidates`, cand.candidateId);
      await updateDoc(docRef, { stage });

      setCandidates(candidates.map(c => c.candidateId === cand.candidateId ? { ...c, stage } : c));

      // If Hired -> Onboard them as a new employee!
      if (stage === 'Hired') {
        const empId = 'emp-' + Math.random().toString(36).substring(2, 9);
        const [firstName, ...lastNameParts] = cand.name.split(' ');
        const lastName = lastNameParts.join(' ') || 'Candidate';

        const matchedJob = jobs.find(j => j.jobId === cand.jobId);

        const newHire: Employee = {
          employeeId: empId,
          companyId,
          firstName,
          lastName,
          email: cand.email,
          phone: '',
          jobTitle: matchedJob?.title || 'Onboard Hire',
          departmentId: matchedJob?.departmentId || 'dept-eng',
          status: 'Onboarding', // Put them on Onboarding status
          baseSalary: 4500,
          dateOfBirth: '',
          gender: '',
          address: '',
          gradeLevel: 'Grade 1',
          employmentType: 'Full-Time',
          dateOfEmployment: new Date().toISOString().split('T')[0],
          onboardingTasks: {
            'Sign Contract': false,
            'ID Card Setup': false,
            'Workstation Allocation': false,
            'Security Training': false
          },
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, `companies/${companyId}/employees`, empId), newHire);
        setEmployees([...employees, newHire]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Onboarding Checklist Tasks
  const handleToggleTask = async (employee: Employee, taskKey: string, checked: boolean) => {
    if (!companyId) return;

    const currentTasks = { ...(employee.onboardingTasks || {}) };
    currentTasks[taskKey] = checked;

    // Check if onboarding is completely finished
    const allDone = Object.values(currentTasks).every(val => val === true);
    const updatedStatus = allDone ? 'Active' : 'Onboarding';

    try {
      const docRef = doc(db, `companies/${companyId}/employees`, employee.employeeId);
      await updateDoc(docRef, {
        onboardingTasks: currentTasks,
        status: updatedStatus
      });

      const updatedEmp = { ...employee, onboardingTasks: currentTasks, status: updatedStatus };
      setEmployees(employees.map(e => e.employeeId === employee.employeeId ? updatedEmp : e));
    } catch (err) {
      console.error(err);
    }
  };

  const getJobTitleName = (jobId: string) => {
    const job = jobs.find(j => j.jobId === jobId);
    return job ? job.title : 'General Vacancy';
  };

  const getDeptName = (id: string) => {
    if (id === 'dept-eng') return 'Engineering & Dev';
    if (id === 'dept-hr') return 'People Operations & HR';
    if (id === 'dept-finance') return 'Finance & Accounts';
    if (id === 'dept-product') return 'Product Management';
    return id.replace('dept-', '').toUpperCase();
  };

  const onboardingHires = employees.filter(e => e.status === 'Onboarding' || e.onboardingTasks);

  return (
    <div className="space-y-6 animate-slide-up" id="recruitment-onboarding-tab">
      
      {/* 1. HEADER ROW */}
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900">Talent Acquisition & Orientation</h2>
        <p className="text-xs text-slate-500">Coordinate published corporate job advertisements, advance hiring pipelines, and track orientation checklists.</p>
      </div>

      {/* 2. DYNAMIC TAB CONTROLLERS */}
      <div className="border-b border-slate-200 flex space-x-4">
        <button
          onClick={() => setActiveTab('job-board')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeTab === 'job-board' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Job Advertisements ({jobs.length})
        </button>

        {isRecruiter && (
          <button
            onClick={() => setActiveTab('candidate-pipeline')}
            className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === 'candidate-pipeline' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Candidate Pipeline ({candidates.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('onboarding-checklists')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeTab === 'onboarding-checklists' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          New-Hire Orientation Checklists ({onboardingHires.length})
        </button>
      </div>

      {/* 3. GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Recruitment Publishing tools (recruiter/admins only) */}
        {activeTab === 'job-board' && isRecruiter && (
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit animate-fade-in">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Briefcase className="w-4 h-4 text-brand-600" />
              Publish Corporate Vacancy
            </h3>

            <form onSubmit={handleCreateJob} className="space-y-4 text-xs text-slate-600">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Vacancy/Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Frontend Engineer (React)"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Department</label>
                  <select
                    className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none text-[11px]"
                    value={jobDept}
                    onChange={(e) => setJobDept(e.target.value)}
                  >
                    <option value="dept-eng">Engineering & Dev</option>
                    <option value="dept-hr">HR & Operations</option>
                    <option value="dept-finance">Finance</option>
                    <option value="dept-product">Product Management</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Salary Range</label>
                  <input
                    type="text"
                    required
                    placeholder="$75k - $95k"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    value={jobSalary}
                    onChange={(e) => setJobSalary(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Job Description & Skills</label>
                <textarea
                  required
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-[11px]"
                  rows={4}
                  placeholder="Summarize vacancy requirements, tools used, and target outcomes..."
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={jobLoading}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Publish Job Opening</span>
              </button>
            </form>
          </div>
        )}

        {/* LEFT COLUMN: Mock Candidate Applying tool */}
        {activeTab === 'candidate-pipeline' && (
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit animate-fade-in">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Users className="w-4 h-4 text-brand-600" />
              Register Mock Candidate App
            </h3>

            <form onSubmit={handleApplyCandidate} className="space-y-4 text-xs text-slate-600">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Candidate Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Liam Sterling"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  value={candName}
                  onChange={(e) => setCandName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="liam.sterling@gmail.com"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  value={candEmail}
                  onChange={(e) => setCandEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Applied For Opening</label>
                <select
                  required
                  className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none"
                  value={candJobId}
                  onChange={(e) => setCandJobId(e.target.value)}
                >
                  <option value="">Select published vacancy...</option>
                  {jobs.map(j => (
                    <option key={j.jobId} value={j.jobId}>{j.title}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={candLoading || jobs.length === 0}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Job Application</span>
              </button>
            </form>
          </div>
        )}

        {/* RIGHT COLUMN: Interactive listings based on Active Tab */}
        <div className={`lg:col-span-2 ${activeTab === 'onboarding-checklists' ? 'lg:col-span-3' : ''}`}>
          
          {/* A. JOB BOARD ADVERTISEMENTS */}
          {activeTab === 'job-board' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {jobs.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 md:col-span-2">
                  <Briefcase className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                  No jobs have been published. Use the publisher form to post corporate openings.
                </div>
              ) : (
                jobs.map(j => (
                  <div key={j.jobId} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                          {getDeptName(j.departmentId)}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-slate-500">{j.salaryRange}</span>
                      </div>
                      <h4 className="font-bold text-slate-950 text-sm mt-1">{j.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{j.description}</p>
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-[10px] text-slate-400">
                      <span>Posted: {new Date(j.createdAt).toLocaleDateString()}</span>
                      <span className="text-emerald-600 font-bold">● Live Portal</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* B. CANDIDATE PIPELINE WORKFLOW */}
          {activeTab === 'candidate-pipeline' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Hiring pipeline Review Board</h4>
              </div>

              <div className="divide-y divide-slate-100 text-xs text-slate-600">
                {candidates.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                    No candidates submitted yet. Submit candidate apps to populate the pipelines.
                  </div>
                ) : (
                  candidates.map((cand) => (
                    <div key={cand.candidateId} className="p-5 hover:bg-slate-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-950">{cand.name}</span>
                          <span className="text-[10px] text-slate-400">({cand.email})</span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                          <span>Applied for: <strong>{getJobTitleName(cand.jobId)}</strong></span>
                          <span>•</span>
                          <a href={cand.cvUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline flex items-center gap-0.5">
                            <FileText className="w-3.5 h-3.5" />
                            View CV Record
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Phase label */}
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          cand.stage === 'Screening' ? 'bg-slate-100 text-slate-800' :
                          cand.stage === 'Interviewing' ? 'bg-blue-100 text-blue-800' :
                          cand.stage === 'Offered' ? 'bg-purple-100 text-purple-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          Current: {cand.stage}
                        </span>

                        {/* Transitions */}
                        {cand.stage !== 'Hired' && (
                          <div className="flex gap-1.5">
                            {cand.stage === 'Screening' && (
                              <button
                                onClick={() => handleTransitionCandidate(cand, 'Interviewing')}
                                className="px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-md"
                              >
                                Invite Interview
                              </button>
                            )}
                            {cand.stage === 'Interviewing' && (
                              <button
                                onClick={() => handleTransitionCandidate(cand, 'Offered')}
                                className="px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-md"
                              >
                                Issue Offer Letter
                              </button>
                            )}
                            {cand.stage === 'Offered' && (
                              <button
                                onClick={() => handleTransitionCandidate(cand, 'Hired')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md flex items-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Hire Now
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* C. NEW HIRE ORIENTATION CHECKLISTS */}
          {activeTab === 'onboarding-checklists' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Onboarding Hires</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {onboardingHires.length === 0 ? (
                  <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 md:col-span-2">
                    <CheckSquare className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                    No employees are currently listed in onboarding orientation state.
                  </div>
                ) : (
                  onboardingHires.map((emp) => {
                    const tasks = emp.onboardingTasks || {
                      'Sign Contract': false,
                      'ID Card Setup': false,
                      'Workstation Allocation': false,
                      'Security Training': false
                    };

                    const completedCount = Object.values(tasks).filter(Boolean).length;
                    const percentComplete = Math.round((completedCount / Object.keys(tasks).length) * 100);

                    return (
                      <div key={emp.employeeId} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-900 block">{emp.firstName} {emp.lastName}</span>
                              <span className="text-[10px] text-slate-400 block">{emp.jobTitle}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              emp.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800 animate-pulse'
                            }`}>
                              {emp.status}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                              <span>Checklist Progress</span>
                              <span>{percentComplete}% Complete</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-brand-600 h-full rounded-full transition-all duration-350"
                                style={{ width: `${percentComplete}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Interactive checkboxes */}
                        <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                          {Object.entries(tasks).map(([taskKey, isDone]) => (
                            <label key={taskKey} className="flex items-center space-x-2.5 cursor-pointer text-slate-600 hover:text-slate-950 font-medium select-none">
                              <input
                                type="checkbox"
                                disabled={isEmployeeOnly} // Only HR/Recruiters/Managers can edit onboarding checkpoints
                                checked={isDone}
                                onChange={(e) => handleToggleTask(emp, taskKey, e.target.checked)}
                                className="w-4 h-4 rounded border-slate-200 text-brand-600 focus:ring-brand-500"
                              />
                              <span className={isDone ? 'line-through text-slate-400' : ''}>{taskKey}</span>
                            </label>
                          ))}
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
