/**
 * PeopleCloud HRIS SaaS - TypeScript Interfaces & Types
 */

export type UserRole =
  | 'SuperAdmin'
  | 'CompanyAdmin'
  | 'HRManager'
  | 'LineManager'
  | 'Employee'
  | 'FinanceOfficer'
  | 'Recruiter'
  | 'Auditor';

export interface Company {
  companyId: string;
  name: string;
  logoUrl?: string;
  industry: string;
  employeeCount: number;
  subscriptionPlan: 'Starter' | 'Growth' | 'Professional' | 'Enterprise';
  subscriptionStatus: 'Trialing' | 'Active' | 'Past_Due' | 'Canceled';
  billingEmail: string;
  renewalDate: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  companyId: string | null; // Null for SuperAdmin
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface Employee {
  employeeId: string;
  userId?: string; // Firebase Auth UID if registered
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  jobTitle: string;
  departmentId: string;
  gradeLevel: string;
  employmentType: 'Full-Time' | 'Part-Time' | 'Contract' | 'Intern';
  supervisorId?: string; // employeeId of supervisor
  dateOfEmployment: string;
  status: 'Active' | 'Onboarding' | 'On_Leave' | 'Suspended' | 'Terminated';
  baseSalary: number;
  bankName?: string;
  accountNumber?: string;
  taxId?: string;
  nextOfKin?: string;
  emergencyPhone?: string;
  onboardingTasks?: { [key: string]: boolean };
  createdAt: string;
}

export interface Department {
  departmentId: string;
  companyId: string;
  name: string;
  headId?: string; // Employee ID of department head
  createdAt: string;
}

export interface Attendance {
  attendanceId: string;
  companyId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  clockIn: string; // ISO string
  clockOut?: string; // ISO string
  status: 'OnTime' | 'Late' | 'Absent';
  timesheetHours?: number;
  approvedBy?: string; // Employee ID or User UID
  approvedAt?: string; // ISO string
  createdAt: string;
}

export interface LeaveRequest {
  leaveRequestId: string;
  companyId: string;
  employeeId: string;
  leaveType: 'Annual' | 'Sick' | 'Maternity' | 'Paternity' | 'Casual' | 'Unpaid';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  comment?: string;
  approvedBy?: string; // User UID of approving manager
  approvedAt?: string; // ISO string
  createdAt: string;
}

export interface PayrollRecord {
  payrollId: string;
  companyId: string;
  period: string; // YYYY-MM (e.g. "2026-06")
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  status: 'Draft' | 'Approved' | 'Paid';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;

  // Single-employee run extensions
  payrollRecordId?: string;
  employeeId?: string;
  payPeriod?: string;
  baseSalary?: number;
  allowances?: number;
  deductions?: number;
  taxWithheld?: number;
  netSalary?: number;
  paymentStatus?: 'Draft' | 'Paid' | 'Issued';
  paymentMethod?: string;
  processedDate?: string;
}

export interface Payslip {
  payslipId: string;
  payrollId: string;
  companyId: string;
  employeeId: string;
  period: string; // YYYY-MM
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: 'Draft' | 'Issued';
  createdAt: string;
}

export interface Job {
  jobId: string;
  companyId: string;
  title: string;
  departmentId: string;
  description: string;
  requirements: string;
  salaryRange?: string;
  status: 'Draft' | 'Published' | 'Closed';
  createdAt: string;
}

export interface Candidate {
  candidateId: string;
  jobId: string;
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  cvUrl?: string;
  stage: 'Applied' | 'Screening' | 'Interviewing' | 'Offered' | 'Hired' | 'Rejected';
  score?: number; // 1-5 or 1-100
  feedback?: string;
  convertedToEmployee?: boolean;
  createdAt: string;
}

export interface OnboardingTask {
  taskId: string;
  companyId: string;
  employeeId: string;
  title: string;
  category: string; // "Orientation" | "Document" | "IT" | "Health" | etc.
  status: 'Pending' | 'Completed';
  assignedTo?: string; // Employee ID or role
  completedAt?: string;
  createdAt: string;
}

export interface HRRequest {
  requestId: string;
  companyId: string;
  employeeId: string;
  type: 'EmploymentLetter' | 'SalaryConfirmation' | 'LeaveEnquiry' | 'Complaint' | 'DocUpdate' | 'General';
  title: string;
  description: string;
  status: 'Open' | 'InProgress' | 'Resolved' | 'Closed';
  assigneeId?: string; // User UID
  resolution?: string;
  createdAt: string;
}

export interface DocumentRecord {
  documentId: string;
  companyId: string;
  employeeId?: string; // null for company-wide documents/policies
  category: 'Contract' | 'Policy' | 'OfferLetter' | 'Appraisal' | 'TrainingCertificate' | 'Payslip' | 'Template';
  name: string;
  fileUrl: string;
  accessLevel: 'AdminOnly' | 'ManagerAndAbove' | 'EmployeeSelf';
  createdAt: string;
}

export interface HRNotification {
  notificationId: string;
  companyId: string;
  userId: string; // recipient
  title: string;
  message: string;
  read: boolean;
  type: string; // "Leave" | "Onboarding" | "Payroll" | "HRRequest" | "System"
  createdAt: string;
}

export interface AuditLog {
  logId: string;
  companyId: string;
  userId: string;
  action: string;
  module: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}
