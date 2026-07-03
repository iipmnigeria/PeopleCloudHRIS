import React, { useState, useEffect } from 'react';
import { UserRole, Employee, Department, DocumentRecord } from '../types';
import { 
  Search, 
  Plus, 
  Filter, 
  FileText, 
  Briefcase, 
  Wallet, 
  MapPin, 
  UserPlus2, 
  ArrowLeft, 
  Edit3, 
  Check, 
  Upload, 
  Trash2, 
  FileCheck2,
  FolderOpen
} from 'lucide-react';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface EmployeeDbProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function EmployeeDb({ currentUser, selectedTenantId }: EmployeeDbProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isReadOnly = currentUser.role === 'Employee' || currentUser.role === 'Auditor';

  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form Field States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Male');
  const [address, setAddress] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('dept-eng');
  const [gradeLevel, setGradeLevel] = useState('Grade 6');
  const [employmentType, setEmploymentType] = useState<'Full-Time' | 'Part-Time' | 'Contract' | 'Intern'>('Full-Time');
  const [supervisorId, setSupervisorId] = useState('');
  const [dateOfEmployment, setDateOfEmployment] = useState('');
  const [status, setStatus] = useState<'Active' | 'Onboarding' | 'On_Leave' | 'Suspended' | 'Terminated'>('Active');
  const [baseSalary, setBaseSalary] = useState(5000);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [nextOfKin, setNextOfKin] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Documents subcollection state
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<'Contract' | 'Policy' | 'OfferLetter' | 'Appraisal' | 'TrainingCertificate'>('Contract');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Fetch records
  useEffect(() => {
    async function loadEmployeeDb() {
      if (!companyId) return;
      try {
        // Fetch Employees
        const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const empList: Employee[] = [];
        empSnap.forEach(d => empList.push({ ...d.data() as Employee, employeeId: d.id }));
        setEmployees(empList);

        // Fetch Departments
        const deptSnap = await getDocs(collection(db, `companies/${companyId}/departments`));
        const deptList: Department[] = [];
        deptSnap.forEach(d => deptList.push({ ...d.data() as Department, departmentId: d.id }));
        setDepartments(deptList);
      } catch (err) {
        console.error('Error loading employee database:', err);
      }
    }
    loadEmployeeDb();
  }, [companyId]);

  // Load selected employee documents
  useEffect(() => {
    async function loadDocuments() {
      if (!companyId || !selectedEmp) return;
      try {
        const docSnap = await getDocs(collection(db, `companies/${companyId}/documents`));
        const docList: DocumentRecord[] = [];
        docSnap.forEach(d => {
          const rec = d.data() as DocumentRecord;
          if (rec.employeeId === selectedEmp.employeeId) {
            docList.push({ ...rec, documentId: d.id });
          }
        });
        setDocuments(docList);
      } catch (err) {
        console.error('Error loading employee documents:', err);
      }
    }
    loadDocuments();
  }, [companyId, selectedEmp]);

  // Handle Employee Selection to View details
  const handleSelectEmp = (emp: Employee) => {
    setSelectedEmp(emp);
    setIsEditing(false);
    setIsCreating(false);

    // Seed form fields
    setFirstName(emp.firstName);
    setLastName(emp.lastName);
    setEmail(emp.email);
    setPhone(emp.phone);
    setDateOfBirth(emp.dateOfBirth || '');
    setGender(emp.gender || 'Male');
    setAddress(emp.address || '');
    setJobTitle(emp.jobTitle);
    setDepartmentId(emp.departmentId);
    setGradeLevel(emp.gradeLevel || 'Grade 6');
    setEmploymentType(emp.employmentType || 'Full-Time');
    setSupervisorId(emp.supervisorId || '');
    setDateOfEmployment(emp.dateOfEmployment || '');
    setStatus(emp.status);
    setBaseSalary(emp.baseSalary);
    setBankName(emp.bankName || '');
    setAccountNumber(emp.accountNumber || '');
    setTaxId(emp.taxId || '');
    setNextOfKin(emp.nextOfKin || '');
    setEmergencyPhone(emp.emergencyPhone || '');
  };

  // Submit Edit or New Creation
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    const data: Partial<Employee> = {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      address,
      jobTitle,
      departmentId,
      gradeLevel,
      employmentType,
      supervisorId,
      dateOfEmployment,
      status,
      baseSalary: Number(baseSalary),
      bankName,
      accountNumber,
      taxId,
      nextOfKin,
      emergencyPhone,
    };

    try {
      if (isCreating) {
        // Create new record
        const newId = 'emp-' + Math.random().toString(36).substring(2, 9);
        const fullNewRecord: Employee = {
          ...(data as Employee),
          employeeId: newId,
          companyId,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, `companies/${companyId}/employees`, newId), fullNewRecord);
        setEmployees([...employees, fullNewRecord]);
        setIsCreating(false);
        setSelectedEmp(fullNewRecord);
      } else if (selectedEmp) {
        // Update existing record
        const docRef = doc(db, `companies/${companyId}/employees`, selectedEmp.employeeId);
        await updateDoc(docRef, data);

        const updatedRecord = { ...selectedEmp, ...data } as Employee;
        setEmployees(employees.map(e => e.employeeId === selectedEmp.employeeId ? updatedRecord : e));
        setSelectedEmp(updatedRecord);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error saving employee record:', err);
    }
  };

  // Drag and Drop File Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFileSim(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFileSim(e.target.files[0]);
    }
  };

  // Process and seed simulated file upload
  const processFileSim = async (file: File) => {
    if (!selectedEmp || !companyId) return;
    setUploadLoading(true);

    try {
      const docId = 'doc-' + Math.random().toString(36).substring(2, 9);
      const simulatedUrl = `https://firebasestorage.simulation.app/companies/${companyId}/employees/${selectedEmp.employeeId}/${file.name}`;

      const newDoc: DocumentRecord = {
        documentId: docId,
        companyId,
        employeeId: selectedEmp.employeeId,
        category: uploadCategory,
        name: file.name,
        fileUrl: simulatedUrl,
        accessLevel: 'ManagerAndAbove',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/documents`, docId), newDoc);
      setDocuments([...documents, newDoc]);
    } catch (err) {
      console.error('File simulation failed:', err);
    } finally {
      setUploadLoading(false);
    }
  };

  // Delete Document
  const handleDeleteDoc = async (docId: string) => {
    if (!companyId) return;
    try {
      await deleteDoc(doc(db, `companies/${companyId}/documents`, docId));
      setDocuments(documents.filter(d => d.documentId !== docId));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = `${emp.firstName} ${emp.lastName} ${emp.jobTitle}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter ? emp.departmentId === deptFilter : true;
    const matchesStatus = statusFilter ? emp.status === statusFilter : true;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const getDeptName = (id: string) => {
    const dept = departments.find(d => d.departmentId === id);
    return dept ? dept.name : id.replace('dept-', '').toUpperCase();
  };

  return (
    <div className="space-y-6" id="employees-db-tab">
      
      {/* 1. HEADER ROW */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900">Employee Directory</h2>
          <p className="text-xs text-slate-500">Manage multi-tenant corporate profiles, access control, salaries, and documents.</p>
        </div>

        {!isReadOnly && !selectedEmp && !isCreating && (
          <button
            onClick={() => {
              setIsCreating(true);
              setSelectedEmp(null);
              // reset fields
              setFirstName('');
              setLastName('');
              setEmail('');
              setPhone('');
              setDateOfBirth('');
              setGender('Male');
              setAddress('');
              setJobTitle('');
              setDepartmentId('dept-eng');
              setGradeLevel('Grade 6');
              setEmploymentType('Full-Time');
              setSupervisorId('');
              setDateOfEmployment('');
              setStatus('Active');
              setBaseSalary(5000);
              setBankName('');
              setAccountNumber('');
              setTaxId('');
              setNextOfKin('');
              setEmergencyPhone('');
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Employee</span>
          </button>
        )}
      </div>

      {/* 2. DIRECTORY VIEW (LIST & FILTERS) */}
      {!selectedEmp && !isCreating && (
        <div className="space-y-4 animate-fade-in">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, email, or job title..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <select
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                ))}
              </select>

              <select
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Onboarding">Onboarding</option>
                <option value="On_Leave">On Leave</option>
                <option value="Suspended">Suspended</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>
          </div>

          {/* EMPLOYEES GRID/TABLE */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-150">
                    <th className="px-5 py-3">Employee Name</th>
                    <th className="px-5 py-3">Designation</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Employment Type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                        No employees found matching filter settings.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.employeeId} className="hover:bg-slate-50/40">
                        <td className="px-5 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 font-bold text-slate-600 flex items-center justify-center">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{emp.firstName} {emp.lastName}</span>
                              <span className="text-[10px] text-slate-400 block">{emp.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-medium">{emp.jobTitle}</td>
                        <td className="px-5 py-4">{getDeptName(emp.departmentId)}</td>
                        <td className="px-5 py-4 font-medium">{emp.employmentType}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            emp.status === 'Active' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' :
                            emp.status === 'Onboarding' ? 'bg-blue-50 border border-blue-100 text-blue-700' :
                            emp.status === 'On_Leave' ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' :
                            'bg-red-50 border border-red-100 text-red-700'
                          }`}>
                            {emp.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleSelectEmp(emp)}
                            className="px-2.5 py-1.5 border border-slate-200 hover:border-brand-200 hover:bg-brand-50/35 text-slate-700 hover:text-brand-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          >
                            View Record
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. PROFILE VIEW & FILE COMPILATION (DETAILS SCREEN) */}
      {selectedEmp && !isEditing && !isCreating && (
        <div className="space-y-6 animate-fade-in">
          {/* Back Action Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedEmp(null)}
              className="flex items-center text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Directory
            </button>

            {!isReadOnly && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            )}
          </div>

          {/* Profile Bento Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Core Personal card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="text-center pb-4 border-b border-slate-100 space-y-2">
                <div className="w-16 h-16 bg-slate-100 rounded-full font-bold text-slate-600 text-lg flex items-center justify-center mx-auto shadow-inner">
                  {selectedEmp.firstName[0]}{selectedEmp.lastName[0]}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedEmp.firstName} {selectedEmp.lastName}</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedEmp.jobTitle}</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Email Address:</span>
                  <span className="font-semibold text-slate-900">{selectedEmp.email}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phone Number:</span>
                  <span className="font-semibold text-slate-900">{selectedEmp.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date of Birth:</span>
                  <span className="font-semibold text-slate-900">{selectedEmp.dateOfBirth || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gender:</span>
                  <span className="font-semibold text-slate-900">{selectedEmp.gender || 'N/A'}</span>
                </div>
                <div className="border-t border-slate-100 pt-2.5">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase mb-1">Residential Address</span>
                  <p className="font-medium text-slate-700 leading-normal">{selectedEmp.address || 'No registered address.'}</p>
                </div>
              </div>
            </div>

            {/* Employment and Finance Details */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Job Details Grid */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-brand-600" />
                  Employment Parameters & Hierarchy
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Department</span>
                    <span className="font-bold text-slate-800">{getDeptName(selectedEmp.departmentId)}</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Grade Level</span>
                    <span className="font-bold text-slate-800">{selectedEmp.gradeLevel || 'N/A'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Engagement Type</span>
                    <span className="font-bold text-slate-800">{selectedEmp.employmentType}</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Employment Date</span>
                    <span className="font-bold text-slate-800">{selectedEmp.dateOfEmployment || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Financial Profile Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-brand-600" />
                  Financial & Security Records
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Monthly Base Salary</span>
                    <span className="font-bold text-slate-900 text-base">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedEmp.baseSalary)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Tax Registration / Pension ID</span>
                    <span className="font-mono font-bold text-slate-800">{selectedEmp.taxId || 'N/A'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Bank details</span>
                    <span className="font-bold text-slate-800 block">{selectedEmp.bankName || 'Not Set'}</span>
                    <span className="font-mono text-[10px] text-slate-500 block">{selectedEmp.accountNumber || 'Not Set'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Next of Kin / Emergency Contact</span>
                    <span className="font-bold text-slate-800 block">{selectedEmp.nextOfKin || 'N/A'}</span>
                    <span className="font-mono text-[10px] text-slate-500 block">{selectedEmp.emergencyPhone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* DOCUMENTS SUBCOLLECTION / UPLOAD */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-brand-600" />
                  Staff Attachment Folders (Onboarding & CVs)
                </h4>

                {/* Upload Form (simulated) */}
                {!isReadOnly && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold block">Document Folder</label>
                      <select
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none"
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value as any)}
                      >
                        <option value="Contract">Employment Contract</option>
                        <option value="OfferLetter">Offer Letter</option>
                        <option value="TrainingCertificate">Training Certificate</option>
                        <option value="Appraisal">Appraisal Record</option>
                      </select>
                    </div>

                    {/* Drag and Drop Box */}
                    <div 
                      className={`md:col-span-2 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-3 transition-colors ${
                        dragActive ? 'border-brand-500 bg-brand-50/20' : 'border-slate-200 hover:border-slate-350'
                      }`}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                    >
                      <Upload className="w-5 h-5 text-slate-400 mb-1" />
                      <label className="text-[10px] font-bold text-brand-600 hover:underline cursor-pointer">
                        Drag and drop file here, or click to choose
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleFileChange}
                          disabled={uploadLoading}
                        />
                      </label>
                      <span className="text-[9px] text-slate-400 mt-0.5">Supports PDF, DOCX, JPG (Simulated upload)</span>
                    </div>
                  </div>
                )}

                {/* File Attachment list */}
                <div className="space-y-2 pt-1">
                  {documents.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center">No compliance files uploaded yet.</p>
                  ) : (
                    documents.map(d => (
                      <div key={d.documentId} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                        <div className="flex items-center space-x-2.5">
                          <FileCheck2 className="w-4 h-4 text-brand-500" />
                          <div>
                            <span className="font-bold text-slate-900 block">{d.name}</span>
                            <span className="text-[9px] text-slate-400 block">Folder: {d.category} • Uploaded: {new Date(d.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <a 
                            href={d.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-brand-600 hover:underline font-bold"
                          >
                            View/Download
                          </a>
                          {!isReadOnly && (
                            <button
                              onClick={() => handleDeleteDoc(d.documentId)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* 4. FORM FOR EDIT / CREATE */}
      {(isEditing || isCreating) && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">
              {isCreating ? 'Onboard New Employee Record' : `Modify Profile of ${selectedEmp?.firstName} ${selectedEmp?.lastName}`}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setIsCreating(false);
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-slate-600">
            {/* PERSONAL DETAIL FIELDS */}
            <div className="space-y-4 md:border-r border-slate-100 md:pr-5">
              <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">1. Personal & Contact Profile</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Personal Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Contact Phone</label>
                <input
                  type="text"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">DOB</label>
                  <input
                    type="date"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Gender</label>
                  <select
                    className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Residential Address</label>
                <textarea
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            {/* EMPLOYMENT PARAMETER FIELDS */}
            <div className="space-y-4 md:border-r border-slate-100 md:px-5">
              <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">2. Corporate Placement</h4>
              
              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Designation / Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="Senior Software Engineer"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Department</label>
                  <select
                    className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                  >
                    {departments.map(d => (
                      <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Grade Level</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Engagement</label>
                  <select
                    className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg"
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value as any)}
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Supervisor (Emp ID)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    value={supervisorId}
                    onChange={(e) => setSupervisorId(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Onboarding Status</label>
                  <select
                    className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="Active">Active</option>
                    <option value="Onboarding">Onboarding</option>
                    <option value="On_Leave">On Leave</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Employment Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    value={dateOfEmployment}
                    onChange={(e) => setDateOfEmployment(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* FINANCIAL & BANK DETAIL FIELDS */}
            <div className="space-y-4 md:pl-5">
              <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">3. Financial Records</h4>
              
              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Monthly Base Salary ($)</label>
                <input
                  type="number"
                  required
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1">Tax ID / Pension Registry</label>
                <input
                  type="text"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Bank Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Account Number</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t border-slate-150 pt-3 space-y-3">
                <h5 className="text-[10px] font-bold text-slate-700 uppercase">Emergency Kin Contacts</h5>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                      value={nextOfKin}
                      onChange={(e) => setNextOfKin(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">Kin Phone</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setIsCreating(false);
              }}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Save Employee Profile</span>
            </button>
          </div>
        </form>
      )}

    </div>
  );
}
