import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  Award, 
  BookOpen, 
  UserCheck, 
  FileText, 
  CheckCircle2, 
  Activity, 
  GraduationCap, 
  TrendingUp, 
  Clock 
} from 'lucide-react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserRole, Employee, TrainingCourse, TrainingEnrollment } from '../types';

interface LearningDevelopmentProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

const DEFAULT_COURSES = [
  { title: 'IIPM HR Professional Leadership Certification', provider: 'IIPM Institute', category: 'Leadership', capacity: 30, description: 'Advanced talent development, leadership principles, and corporate governance standards.' },
  { title: 'Strategic HR Business Partnering', provider: 'Global Talent Academy', category: 'Professional', capacity: 25, description: 'How to transition HR from administrative support into a strategic organizational driver.' },
  { title: 'Labor Law & Regulatory Compliance', provider: 'Legal Counsel Group', category: 'Compliance', capacity: 50, description: 'Statutory compliance guidelines covering local pension, labor laws, tax codes, and auditing requirements.' }
];

export default function LearningDevelopment({ currentUser, selectedTenantId }: LearningDevelopmentProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'my-courses' | 'admin-enrollments'>('catalog');
  const [loading, setLoading] = useState(true);

  // Common datasets
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployeeProfile, setCurrentEmployeeProfile] = useState<Employee | null>(null);

  // Courses & enrollments
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);

  // Course form state
  const [newTitle, setNewTitle] = useState('');
  const [newProvider, setNewProvider] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<'Leadership' | 'Technical' | 'Compliance' | 'Professional'>('Professional');
  const [newStartDate, setNewStartDate] = useState('2026-08-01');
  const [newEndDate, setNewEndDate] = useState('2026-08-05');
  const [newCapacity, setNewCapacity] = useState(30);

  // Search/Filter
  const [searchQuery, setSearchQuery] = useState('');

  const isHR = currentUser.role === 'CompanyAdmin' || currentUser.role === 'HRManager';
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

      const match = empList.find(e => e.email.toLowerCase() === currentUser.email.toLowerCase());
      if (match) {
        setCurrentEmployeeProfile(match);
      }

      // 2. Load Courses
      const coursesSnap = await getDocs(collection(db, `companies/${companyId}/courses`));
      const coursesList: TrainingCourse[] = [];
      coursesSnap.forEach(docSnap => {
        coursesList.push({ ...docSnap.data() as TrainingCourse, courseId: docSnap.id });
      });

      // Seed default courses if empty
      if (coursesList.length === 0 && !isEmployeeOnly) {
        for (const defaultCourse of DEFAULT_COURSES) {
          const courseData: Omit<TrainingCourse, 'courseId'> = {
            companyId,
            title: defaultCourse.title,
            provider: defaultCourse.provider,
            description: defaultCourse.description,
            category: defaultCourse.category as any,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'Upcoming',
            capacity: defaultCourse.capacity,
            enrolledCount: 0
          };
          const ref = await addDoc(collection(db, `companies/${companyId}/courses`), courseData);
          coursesList.push({ ...courseData, courseId: ref.id });
        }
      }
      setCourses(coursesList);

      // 3. Load Enrollments
      const enrollSnap = await getDocs(collection(db, `companies/${companyId}/enrollments`));
      const enrollList: TrainingEnrollment[] = [];
      enrollSnap.forEach(docSnap => {
        enrollList.push({ ...docSnap.data() as TrainingEnrollment, enrollmentId: docSnap.id });
      });
      setEnrollments(enrollList);

    } catch (err) {
      console.error('Error loading L&D data:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- COURSE CREATION ---
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !newTitle || !newProvider) return;

    try {
      const courseData: Omit<TrainingCourse, 'courseId'> = {
        companyId,
        title: newTitle,
        provider: newProvider,
        description: newDesc,
        category: newCategory,
        startDate: newStartDate,
        endDate: newEndDate,
        status: 'Upcoming',
        capacity: Number(newCapacity),
        enrolledCount: 0
      };

      const docRef = await addDoc(collection(db, `companies/${companyId}/courses`), courseData);
      setCourses([...courses, { ...courseData, courseId: docRef.id }]);
      setNewTitle('');
      setNewProvider('');
      setNewDesc('');
      alert('New training course successfully listed!');
    } catch (err) {
      console.error('Error listing course:', err);
    }
  };

  // --- ENROLLMENT LOGIC ---
  const handleEnroll = async (courseId: string) => {
    if (!companyId || !currentEmployeeProfile) {
      alert('Profile synchronization is required to register for courses.');
      return;
    }

    // Check if already enrolled
    const alreadyEnrolled = enrollments.some(
      e => e.courseId === courseId && e.employeeId === currentEmployeeProfile.employeeId
    );
    if (alreadyEnrolled) {
      alert('You are already registered for this training session.');
      return;
    }

    const targetCourse = courses.find(c => c.courseId === courseId);
    if (targetCourse && targetCourse.enrolledCount >= targetCourse.capacity) {
      alert('This course is already at full seat capacity.');
      return;
    }

    try {
      const newEnroll: Omit<TrainingEnrollment, 'enrollmentId'> = {
        companyId,
        employeeId: currentEmployeeProfile.employeeId,
        courseId,
        status: 'Enrolled',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, `companies/${companyId}/enrollments`), newEnroll);
      setEnrollments([...enrollments, { ...newEnroll, enrollmentId: docRef.id }]);

      // Increment enrolled count
      if (targetCourse) {
        const courseRef = doc(db, `companies/${companyId}/courses`, courseId);
        await updateDoc(courseRef, { enrolledCount: targetCourse.enrolledCount + 1 });
        setCourses(courses.map(c => c.courseId === courseId ? { ...c, enrolledCount: c.enrolledCount + 1 } : c));
      }

      alert('Successfully registered! Good luck with your learning program.');
    } catch (err) {
      console.error('Enrollment error:', err);
    }
  };

  // --- MANAGER ACTIONS: COMPLETE COURSE & CERTIFICATION ---
  const handleCompleteEnrollment = async (enrollmentId: string, score: number, feedback: string) => {
    if (!companyId) return;

    try {
      const docRef = doc(db, `companies/${companyId}/enrollments`, enrollmentId);
      const updateData = {
        status: 'Completed' as const,
        score,
        feedback,
        completedAt: new Date().toISOString()
      };
      await updateDoc(docRef, updateData);

      // Create Certificate file record placeholder in the Document Management Submodule
      const enrollment = enrollments.find(e => e.enrollmentId === enrollmentId);
      const course = courses.find(c => c.courseId === enrollment?.courseId);
      const emp = employees.find(e => e.employeeId === enrollment?.employeeId);

      if (enrollment && course && emp) {
        await addDoc(collection(db, `companies/${companyId}/documents`), {
          companyId,
          employeeId: emp.employeeId,
          category: 'TrainingCertificate',
          name: `${course.title} Certificate - ${emp.firstName} ${emp.lastName}`,
          fileUrl: `https://iipm-certifications-placeholder.org/pdf/cert-${enrollmentId}.pdf`,
          accessLevel: 'EmployeeSelf',
          createdAt: new Date().toISOString()
        });

        // Notify employee
        await addDoc(collection(db, `companies/${companyId}/notifications`), {
          userId: currentUser.uid,
          companyId,
          title: 'Training Course Completed',
          message: `Congratulations! You completed ${course.title} and your certificate is available in Document Center.`,
          read: false,
          type: 'System',
          createdAt: new Date().toISOString()
        });
      }

      setEnrollments(enrollments.map(e => e.enrollmentId === enrollmentId ? { ...e, ...updateData } : e));
      alert('Enrollment marked as Completed. Digital certification issued!');
    } catch (err) {
      console.error(err);
    }
  };

  // Filter datasets
  const getFilteredCourses = () => {
    let list = courses;
    if (searchQuery) {
      list = list.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.provider.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return list;
  };

  const getMyEnrollments = () => {
    if (!currentEmployeeProfile) return [];
    return enrollments.filter(e => e.employeeId === currentEmployeeProfile.employeeId);
  };

  const visibleCourses = getFilteredCourses();
  const myEnrollments = getMyEnrollments();

  return (
    <div className="space-y-6" id="learning-development-panel">
      
      {/* HEADER HERO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-950 font-display">Learning & Talent Development</h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize professional seminars, track Continued Professional Development (CPD) credits, and record certifications.
          </p>
        </div>
        
        {/* Sub-tab selections */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveSubTab('catalog')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeSubTab === 'catalog' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Course Catalog
          </button>
          
          {isEmployeeOnly && (
            <button
              onClick={() => setActiveSubTab('my-courses')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSubTab === 'my-courses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              My Learning Path
            </button>
          )}

          {!isEmployeeOnly && (
            <button
              onClick={() => setActiveSubTab('admin-enrollments')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSubTab === 'admin-enrollments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Admin & Certifications
            </button>
          )}
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="relative w-full md:w-96">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search courses or training providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* SUB-TAB: COURSE CATALOG */}
      {activeSubTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: Create Course (Admin and HR only) */}
          {!isEmployeeOnly && (
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-brand-600" />
                  <span>Launch Training Course</span>
                </h2>
                <p className="text-[10px] text-slate-400 mt-1">Add courses to the organization’s catalog.</p>
              </div>

              <form onSubmit={handleCreateCourse} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Course Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Advanced HR Audits & Metrics"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Training Provider</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nigerian Institute of HR (IIPM)"
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e: any) => setNewCategory(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="Leadership">Leadership</option>
                      <option value="Technical">Technical</option>
                      <option value="Compliance">Compliance</option>
                      <option value="Professional">Professional</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Capacity (Seats)</label>
                    <input
                      type="number"
                      required
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Enter course curriculum overview..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg p-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publish Course</span>
                </button>
              </form>
            </div>
          )}

          {/* RIGHT: Course Listings Catalog */}
          <div className={`${isEmployeeOnly ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-4`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleCourses.map((c) => {
                const isUserEnrolled = enrollments.some(
                  e => e.courseId === c.courseId && e.employeeId === currentEmployeeProfile?.employeeId
                );
                return (
                  <div key={c.courseId} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          c.category === 'Leadership' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                          c.category === 'Compliance' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                          c.category === 'Technical' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {c.category}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          {c.enrolledCount} / {c.capacity} Enrolled
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 leading-snug">{c.title}</h3>
                      <p className="text-[10px] text-slate-500 font-medium">Provider: {c.provider}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{c.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[10px]">{c.startDate} to {c.endDate}</span>
                      </div>

                      {isEmployeeOnly ? (
                        <button
                          onClick={() => handleEnroll(c.courseId)}
                          disabled={isUserEnrolled || c.enrolledCount >= c.capacity}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                            isUserEnrolled 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed' 
                              : 'bg-brand-600 hover:bg-brand-700 text-white'
                          }`}
                        >
                          {isUserEnrolled ? 'Registered' : 'Enroll Now'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-brand-600 font-bold uppercase">Administrator</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB: MY COURSES */}
      {activeSubTab === 'my-courses' && isEmployeeOnly && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">My Training Records & Certifications</h2>
          
          {myEnrollments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-xs">You have not registered for any courses yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myEnrollments.map((e) => {
                const course = courses.find(c => c.courseId === e.courseId);
                return (
                  <div key={e.enrollmentId} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-slate-900">{course?.title || 'Unknown Course'}</h3>
                      <p className="text-[10px] text-slate-500 font-medium">Provider: {course?.provider}</p>
                      {e.completedAt && (
                        <p className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Completed on {e.completedAt.split('T')[0]}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        e.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        e.status === 'Canceled' ? 'bg-slate-50 text-slate-400 border-slate-100' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {e.status}
                      </span>

                      {e.status === 'Completed' && e.score !== undefined && (
                        <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Score: {e.score}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: ADMIN ENROLLMENTS & EVALUATIONS */}
      {activeSubTab === 'admin-enrollments' && !isEmployeeOnly && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Pending Certification Approvals</h2>
          
          {enrollments.filter(e => e.status === 'Enrolled').length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">All registered employee training programs are finalized and credited.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {enrollments.filter(e => e.status === 'Enrolled').map((e) => {
                const course = courses.find(c => c.courseId === e.courseId);
                const emp = employees.find(emp => emp.employeeId === e.employeeId);
                return (
                  <div key={e.enrollmentId} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-slate-900">{course?.title}</h3>
                      <p className="text-[10px] text-slate-500 font-semibold">
                        Registered Employee: {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">Enrolled: {new Date(e.createdAt).toLocaleDateString()}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const score = Number(prompt('Enter evaluation score percentage (0-100):', '85'));
                          const feedback = prompt('Provide supervisor completion feedback:', 'Excellent performance and high attendance rate.');
                          if (score >= 0 && score <= 100) {
                            handleCompleteEnrollment(e.enrollmentId, score, feedback || '');
                          } else {
                            alert('Invalid score provided.');
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                      >
                        Grade & Complete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
