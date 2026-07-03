import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { 
  Company, 
  UserProfile, 
  Employee, 
  Department, 
  LeaveRequest, 
  Attendance, 
  PayrollRecord, 
  Payslip, 
  Job, 
  Candidate, 
  OnboardingTask, 
  HRRequest, 
  DocumentRecord, 
  HRNotification, 
  AuditLog 
} from './types';

export const DEMO_COMPANY_ID = 'acme-corp';
export const DEMO_COMPANY_2_ID = 'globex-logistics';

// List of demo users with their emails and corresponding passwords (for mock auth and demo login)
export const DEMO_USERS = [
  {
    email: 'superadmin@peoplecloud.com',
    password: 'password123',
    displayName: 'Sophia Alvarez',
    role: 'SuperAdmin' as const,
    companyId: null,
    uid: 'uid-superadmin',
  },
  {
    email: 'admin@acme.com',
    password: 'password123',
    displayName: 'Marcus Sterling',
    role: 'CompanyAdmin' as const,
    companyId: DEMO_COMPANY_ID,
    uid: 'uid-admin-acme',
  },
  {
    email: 'hr@acme.com',
    password: 'password123',
    displayName: 'Sarah Jenkins',
    role: 'HRManager' as const,
    companyId: DEMO_COMPANY_ID,
    uid: 'uid-hr-acme',
  },
  {
    email: 'manager@acme.com',
    password: 'password123',
    displayName: 'David Vance',
    role: 'LineManager' as const,
    companyId: DEMO_COMPANY_ID,
    uid: 'uid-manager-acme',
  },
  {
    email: 'employee@acme.com',
    password: 'password123',
    displayName: 'Alex Rivera',
    role: 'Employee' as const,
    companyId: DEMO_COMPANY_ID,
    uid: 'uid-employee-acme',
  },
  {
    email: 'finance@acme.com',
    password: 'password123',
    displayName: 'Elena Rostova',
    role: 'FinanceOfficer' as const,
    companyId: DEMO_COMPANY_ID,
    uid: 'uid-finance-acme',
  },
  {
    email: 'recruiter@acme.com',
    password: 'password123',
    displayName: 'Liam O\'Connor',
    role: 'Recruiter' as const,
    companyId: DEMO_COMPANY_ID,
    uid: 'uid-recruiter-acme',
  },
  {
    email: 'auditor@acme.com',
    password: 'password123',
    displayName: 'Victoria Vance',
    role: 'Auditor' as const,
    companyId: DEMO_COMPANY_ID,
    uid: 'uid-auditor-acme',
  }
];

export async function seedDatabaseIfNeeded() {
  try {
    const companiesSnap = await getDocs(collection(db, 'companies'));
    if (!companiesSnap.empty) {
      console.log('Database already contains records. Skipping auto-seeding.');
      return;
    }

    console.log('Database empty. Initiating PeopleCloud HRIS auto-seeding...');

    // 1. Seed Companies
    const company1: Company = {
      companyId: DEMO_COMPANY_ID,
      name: 'Acme Technology Corporation',
      logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      industry: 'Technology & Software',
      employeeCount: 8,
      subscriptionPlan: 'Growth',
      subscriptionStatus: 'Active',
      billingEmail: 'billing@acme.com',
      renewalDate: '2026-12-31T23:59:59Z',
      createdAt: '2026-01-01T08:00:00Z',
    };

    const company2: Company = {
      companyId: DEMO_COMPANY_2_ID,
      name: 'Globex Logistics & Supply',
      logoUrl: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      industry: 'Logistics & Supply Chain',
      employeeCount: 3,
      subscriptionPlan: 'Starter',
      subscriptionStatus: 'Trialing',
      billingEmail: 'accounts@globex.com',
      renewalDate: '2026-08-15T23:59:59Z',
      createdAt: '2026-06-15T12:00:00Z',
    };

    await setDoc(doc(db, 'companies', DEMO_COMPANY_ID), company1);
    await setDoc(doc(db, 'companies', DEMO_COMPANY_2_ID), company2);

    // 2. Seed Users Info in /users collection
    for (const demoUser of DEMO_USERS) {
      const profile: UserProfile = {
        uid: demoUser.uid,
        email: demoUser.email,
        displayName: demoUser.displayName,
        companyId: demoUser.companyId,
        role: demoUser.role,
        active: true,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', demoUser.uid), profile);
    }

    // 3. Seed Departments for Acme Corp
    const depts: Department[] = [
      { departmentId: 'dept-eng', companyId: DEMO_COMPANY_ID, name: 'Engineering & Development', headId: 'emp-manager-acme', createdAt: '2026-01-01T09:00:00Z' },
      { departmentId: 'dept-hr', companyId: DEMO_COMPANY_ID, name: 'People Operations & HR', headId: 'emp-hr-acme', createdAt: '2026-01-01T09:00:00Z' },
      { departmentId: 'dept-finance', companyId: DEMO_COMPANY_ID, name: 'Finance & Accounts', headId: 'emp-finance-acme', createdAt: '2026-01-01T09:00:00Z' },
      { departmentId: 'dept-product', companyId: DEMO_COMPANY_ID, name: 'Product Management', headId: 'emp-admin-acme', createdAt: '2026-01-01T09:00:00Z' },
    ];

    for (const d of depts) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/departments`, d.departmentId), d);
    }

    // 4. Seed Employee Records (Acme Technology Corp)
    const employees: Employee[] = [
      {
        employeeId: 'emp-admin-acme',
        userId: 'uid-admin-acme',
        companyId: DEMO_COMPANY_ID,
        firstName: 'Marcus',
        lastName: 'Sterling',
        email: 'admin@acme.com',
        phone: '+1 (555) 101-0001',
        dateOfBirth: '1982-04-12',
        gender: 'Male',
        address: '228 Marina Boulevard, San Francisco, CA',
        jobTitle: 'Vice President of Product & HR Sponsor',
        departmentId: 'dept-product',
        gradeLevel: 'Grade 9',
        employmentType: 'Full-Time',
        dateOfEmployment: '2026-01-05',
        status: 'Active',
        baseSalary: 12500,
        bankName: 'Silicon Valley Bank',
        accountNumber: '******5592',
        taxId: 'TX-992019-A',
        nextOfKin: 'Clara Sterling (Spouse)',
        emergencyPhone: '+1 (555) 101-0002',
        createdAt: '2026-01-05T09:00:00Z'
      },
      {
        employeeId: 'emp-hr-acme',
        userId: 'uid-hr-acme',
        companyId: DEMO_COMPANY_ID,
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 'hr@acme.com',
        phone: '+1 (555) 202-0001',
        dateOfBirth: '1988-11-23',
        gender: 'Female',
        address: '741 Sunset Blvd, Los Angeles, CA',
        jobTitle: 'Human Resources Director',
        departmentId: 'dept-hr',
        gradeLevel: 'Grade 8',
        employmentType: 'Full-Time',
        dateOfEmployment: '2026-01-10',
        status: 'Active',
        baseSalary: 8500,
        bankName: 'Chase Bank',
        accountNumber: '******2281',
        taxId: 'TX-104928-B',
        nextOfKin: 'Robert Jenkins (Spouse)',
        emergencyPhone: '+1 (555) 202-0002',
        createdAt: '2026-01-10T09:00:00Z'
      },
      {
        employeeId: 'emp-manager-acme',
        userId: 'uid-manager-acme',
        companyId: DEMO_COMPANY_ID,
        firstName: 'David',
        lastName: 'Vance',
        email: 'manager@acme.com',
        phone: '+1 (555) 303-0001',
        dateOfBirth: '1985-06-15',
        gender: 'Male',
        address: '445 Oak Street, Oakland, CA',
        jobTitle: 'Engineering Manager',
        departmentId: 'dept-eng',
        gradeLevel: 'Grade 8',
        employmentType: 'Full-Time',
        dateOfEmployment: '2026-01-15',
        status: 'Active',
        baseSalary: 11000,
        bankName: 'Wells Fargo',
        accountNumber: '******8839',
        taxId: 'TX-882910-C',
        nextOfKin: 'Helen Vance (Mother)',
        emergencyPhone: '+1 (555) 303-0002',
        createdAt: '2026-01-15T09:00:00Z'
      },
      {
        employeeId: 'emp-employee-acme',
        userId: 'uid-employee-acme',
        companyId: DEMO_COMPANY_ID,
        firstName: 'Alex',
        lastName: 'Rivera',
        email: 'employee@acme.com',
        phone: '+1 (555) 404-0001',
        dateOfBirth: '1993-09-02',
        gender: 'Non-binary',
        address: '109 Mission District St, San Francisco, CA',
        jobTitle: 'Senior Software Engineer',
        departmentId: 'dept-eng',
        gradeLevel: 'Grade 6',
        employmentType: 'Full-Time',
        supervisorId: 'emp-manager-acme',
        dateOfEmployment: '2026-02-01',
        status: 'Active',
        baseSalary: 7800,
        bankName: 'Bank of America',
        accountNumber: '******1042',
        taxId: 'TX-440283-D',
        nextOfKin: 'Maria Rivera (Sister)',
        emergencyPhone: '+1 (555) 404-0002',
        createdAt: '2026-02-01T09:00:00Z'
      },
      {
        employeeId: 'emp-finance-acme',
        userId: 'uid-finance-acme',
        companyId: DEMO_COMPANY_ID,
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'finance@acme.com',
        phone: '+1 (555) 505-0001',
        dateOfBirth: '1990-01-30',
        gender: 'Female',
        address: '15 Ocean Avenue, San Francisco, CA',
        jobTitle: 'Chief Finance Officer',
        departmentId: 'dept-finance',
        gradeLevel: 'Grade 8',
        employmentType: 'Full-Time',
        dateOfEmployment: '2026-01-10',
        status: 'Active',
        baseSalary: 9800,
        bankName: 'CitiBank',
        accountNumber: '******4482',
        taxId: 'TX-509381-E',
        nextOfKin: 'Yury Rostov (Father)',
        emergencyPhone: '+1 (555) 505-0002',
        createdAt: '2026-01-10T09:00:00Z'
      },
      {
        employeeId: 'emp-recruiter-acme',
        userId: 'uid-recruiter-acme',
        companyId: DEMO_COMPANY_ID,
        firstName: 'Liam',
        lastName: 'O\'Connor',
        email: 'recruiter@acme.com',
        phone: '+1 (555) 606-0001',
        dateOfBirth: '1992-07-08',
        gender: 'Male',
        address: '52 Hilltop Terrace, Daly City, CA',
        jobTitle: 'Senior Recruiter',
        departmentId: 'dept-hr',
        gradeLevel: 'Grade 5',
        employmentType: 'Full-Time',
        supervisorId: 'emp-hr-acme',
        dateOfEmployment: '2026-02-15',
        status: 'Active',
        baseSalary: 5500,
        bankName: 'Chase Bank',
        accountNumber: '******9930',
        taxId: 'TX-669201-F',
        nextOfKin: 'Maureen O\'Connor (Mother)',
        emergencyPhone: '+1 (555) 606-0002',
        createdAt: '2026-02-15T09:00:00Z'
      },
      {
        employeeId: 'emp-auditor-acme',
        userId: 'uid-auditor-acme',
        companyId: DEMO_COMPANY_ID,
        firstName: 'Victoria',
        lastName: 'Vance',
        email: 'auditor@acme.com',
        phone: '+1 (555) 707-0001',
        dateOfBirth: '1984-03-25',
        gender: 'Female',
        address: '112 Pine Street, San Francisco, CA',
        jobTitle: 'Internal Compliance Auditor',
        departmentId: 'dept-finance',
        gradeLevel: 'Grade 7',
        employmentType: 'Full-Time',
        dateOfEmployment: '2026-03-01',
        status: 'Active',
        baseSalary: 6800,
        bankName: 'Bank of the West',
        accountNumber: '******2291',
        taxId: 'TX-773820-G',
        nextOfKin: 'Jonathan Vance (Spouse)',
        emergencyPhone: '+1 (555) 707-0002',
        createdAt: '2026-03-01T09:00:00Z'
      },
      {
        employeeId: 'emp-newhire-acme',
        companyId: DEMO_COMPANY_ID,
        firstName: 'Danielle',
        lastName: 'Kemp',
        email: 'danielle.kemp@gmail.com',
        phone: '+1 (555) 808-0001',
        dateOfBirth: '1996-05-18',
        gender: 'Female',
        address: '400 King St, San Francisco, CA',
        jobTitle: 'Junior Frontend Developer',
        departmentId: 'dept-eng',
        gradeLevel: 'Grade 4',
        employmentType: 'Full-Time',
        supervisorId: 'emp-manager-acme',
        dateOfEmployment: '2026-07-01',
        status: 'Onboarding',
        baseSalary: 4200,
        bankName: 'Chase Bank',
        accountNumber: '******3311',
        taxId: 'TX-118239-Z',
        nextOfKin: 'Aria Kemp (Mother)',
        emergencyPhone: '+1 (555) 808-0002',
        createdAt: '2026-06-28T10:00:00Z'
      }
    ];

    for (const emp of employees) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/employees`, emp.employeeId), emp);
    }

    // 5. Seed Attendance Logs for June 2026
    const attendanceRecords: Attendance[] = [
      {
        attendanceId: 'att-001',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-employee-acme',
        date: '2026-06-25',
        clockIn: '2026-06-25T08:52:12Z',
        clockOut: '2026-06-25T17:35:00Z',
        status: 'OnTime',
        timesheetHours: 8.7,
        approvedBy: 'emp-manager-acme',
        approvedAt: '2026-06-25T18:00:00Z',
        createdAt: '2026-06-25T08:52:12Z'
      },
      {
        attendanceId: 'att-002',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-employee-acme',
        date: '2026-06-26',
        clockIn: '2026-06-26T09:15:45Z',
        clockOut: '2026-06-26T17:10:00Z',
        status: 'Late',
        timesheetHours: 7.9,
        approvedBy: 'emp-manager-acme',
        approvedAt: '2026-06-26T18:00:00Z',
        createdAt: '2026-06-26T09:15:45Z'
      },
      {
        attendanceId: 'att-003',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-hr-acme',
        date: '2026-06-26',
        clockIn: '2026-06-26T08:45:00Z',
        clockOut: '2026-06-26T17:00:00Z',
        status: 'OnTime',
        timesheetHours: 8.25,
        approvedBy: 'emp-admin-acme',
        approvedAt: '2026-06-26T17:30:00Z',
        createdAt: '2026-06-26T08:45:00Z'
      }
    ];

    for (const att of attendanceRecords) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/attendance`, att.attendanceId), att);
    }

    // 6. Seed Leave Requests
    const leaveRequests: LeaveRequest[] = [
      {
        leaveRequestId: 'leave-001',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-employee-acme',
        leaveType: 'Annual',
        startDate: '2026-07-15',
        endDate: '2026-07-22',
        totalDays: 6,
        status: 'Pending',
        comment: 'Going for annual family vacation.',
        createdAt: '2026-07-01T14:22:11Z'
      },
      {
        leaveRequestId: 'leave-002',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-recruiter-acme',
        leaveType: 'Casual',
        startDate: '2026-06-10',
        endDate: '2026-06-11',
        totalDays: 2,
        status: 'Approved',
        comment: 'To attend to urgent domestic matters.',
        approvedBy: 'emp-hr-acme',
        approvedAt: '2026-06-12T09:00:00Z',
        createdAt: '2026-06-09T16:00:00Z'
      },
      {
        leaveRequestId: 'leave-003',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-manager-acme',
        leaveType: 'Sick',
        startDate: '2026-06-18',
        endDate: '2026-06-19',
        totalDays: 2,
        status: 'Approved',
        comment: 'Medical certificate attached for wisdom teeth extraction.',
        approvedBy: 'emp-admin-acme',
        approvedAt: '2026-06-18T11:00:00Z',
        createdAt: '2026-06-18T08:00:00Z'
      }
    ];

    for (const lr of leaveRequests) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/leave_requests`, lr.leaveRequestId), lr);
    }

    // 7. Seed Payroll & Payslip Record for June 2026
    const payrollJune: PayrollRecord = {
      payrollId: 'pay-2026-06',
      companyId: DEMO_COMPANY_ID,
      period: '2026-06',
      totalGross: 60900,
      totalDeductions: 8400,
      totalNet: 52500,
      status: 'Approved',
      approvedBy: 'uid-admin-acme',
      approvedAt: '2026-06-28T16:30:00Z',
      createdAt: '2026-06-24T09:00:00Z',
    };
    await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/payroll_records`, payrollJune.payrollId), payrollJune);

    const payslips: Payslip[] = [
      {
        payslipId: 'ps-001',
        payrollId: 'pay-2026-06',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-admin-acme',
        period: '2026-06',
        baseSalary: 12500,
        allowances: 1000,
        deductions: 1800,
        netSalary: 11700,
        status: 'Issued',
        createdAt: '2026-06-25T08:00:00Z'
      },
      {
        payslipId: 'ps-002',
        payrollId: 'pay-2026-06',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-employee-acme',
        period: '2026-06',
        baseSalary: 7800,
        allowances: 400,
        deductions: 1100,
        netSalary: 7100,
        status: 'Issued',
        createdAt: '2026-06-25T08:00:00Z'
      },
      {
        payslipId: 'ps-003',
        payrollId: 'pay-2026-06',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-manager-acme',
        period: '2026-06',
        baseSalary: 11000,
        allowances: 800,
        deductions: 1500,
        netSalary: 10300,
        status: 'Issued',
        createdAt: '2026-06-25T08:00:00Z'
      }
    ];

    for (const ps of payslips) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/payslips`, ps.payslipId), ps);
    }

    // 8. Seed Recruitment Jobs & Candidates
    const job1: Job = {
      jobId: 'job-001',
      companyId: DEMO_COMPANY_ID,
      title: 'Senior DevOps Cloud Engineer',
      departmentId: 'dept-eng',
      description: 'We are seeking a senior engineer to orchestrate our Google Cloud platform environments and construct high-performance CI/CD pipelines.',
      requirements: '5+ years experience GCP, Terraform, Kubernetes, and Docker. Strong script capability in Bash/Python.',
      salaryRange: '$120,000 - $150,000',
      status: 'Published',
      createdAt: '2026-06-01T08:00:00Z'
    };
    await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/jobs`, job1.jobId), job1);

    const candidates: Candidate[] = [
      {
        candidateId: 'cand-001',
        jobId: 'job-001',
        companyId: DEMO_COMPANY_ID,
        name: 'Tyler Durden',
        email: 'tyler.durden@soap.io',
        phone: '+1 (555) 901-2291',
        stage: 'Interviewing',
        score: 88,
        feedback: 'Extremely proficient in Cloud architectures. Excellent communication style. Highly technical.',
        createdAt: '2026-06-12T14:30:00Z'
      },
      {
        candidateId: 'cand-002',
        jobId: 'job-001',
        companyId: DEMO_COMPANY_ID,
        name: 'Robert Paulson',
        email: 'robert@bigbob.org',
        stage: 'Screening',
        createdAt: '2026-06-20T10:00:00Z'
      }
    ];

    for (const cand of candidates) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/candidates`, cand.candidateId), cand);
    }

    // 9. Seed Onboarding Tasks for Danielle Kemp (emp-newhire-acme)
    const onboardingTasks: OnboardingTask[] = [
      { taskId: 'task-01', companyId: DEMO_COMPANY_ID, employeeId: 'emp-newhire-acme', title: 'Sign Offer Letter & Employment Contract', category: 'Document', status: 'Completed', completedAt: '2026-06-29T11:00:00Z', createdAt: '2026-06-28T10:00:00Z' },
      { taskId: 'task-02', companyId: DEMO_COMPANY_ID, employeeId: 'emp-newhire-acme', title: 'Submit W-4 Tax forms and direct deposit info', category: 'Document', status: 'Completed', completedAt: '2026-06-30T15:00:00Z', createdAt: '2026-06-28T10:00:00Z' },
      { taskId: 'task-03', companyId: DEMO_COMPANY_ID, employeeId: 'emp-newhire-acme', title: 'Acknowledge Employee Handbook & Code of Conduct', category: 'Document', status: 'Pending', createdAt: '2026-06-28T10:00:00Z' },
      { taskId: 'task-04', companyId: DEMO_COMPANY_ID, employeeId: 'emp-newhire-acme', title: 'Attend team welcome and workspace walk-through', category: 'Orientation', status: 'Pending', createdAt: '2026-06-28T10:00:00Z' }
    ];

    for (const ot of onboardingTasks) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/onboarding_tasks`, ot.taskId), ot);
    }

    // 10. Seed HR Requests Helpdesk tickets
    const hrRequests: HRRequest[] = [
      {
        requestId: 'req-001',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-employee-acme',
        type: 'EmploymentLetter',
        title: 'Visa Application Support Letter',
        description: 'Please issue a formal employment confirmation letter to support my upcoming tourist visa application to Japan.',
        status: 'Open',
        createdAt: '2026-07-02T10:15:00Z'
      },
      {
        requestId: 'req-002',
        companyId: DEMO_COMPANY_ID,
        employeeId: 'emp-manager-acme',
        type: 'DocUpdate',
        title: 'New Health Insurance Certificate Update',
        description: 'I would like to submit my updated marital health coverage forms for insurance revision.',
        status: 'Resolved',
        resolution: 'Document received, details processed, and benefits platform updated successfully.',
        createdAt: '2026-06-20T09:00:00Z'
      }
    ];

    for (const req of hrRequests) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/hr_requests`, req.requestId), req);
    }

    // 11. Seed Company Policies (Documents module)
    const docs: DocumentRecord[] = [
      {
        documentId: 'doc-001',
        companyId: DEMO_COMPANY_ID,
        category: 'Policy',
        name: 'PeopleCloud Acme Employee Handbook 2026',
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        accessLevel: 'EmployeeSelf',
        createdAt: '2026-01-01T08:00:00Z'
      },
      {
        documentId: 'doc-002',
        companyId: DEMO_COMPANY_ID,
        category: 'Policy',
        name: 'Hybrid Remote Work Policy Guidelines',
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        accessLevel: 'EmployeeSelf',
        createdAt: '2026-01-15T09:00:00Z'
      },
      {
        documentId: 'doc-003',
        companyId: DEMO_COMPANY_ID,
        category: 'Template',
        name: 'Annual Performance Appraisal Questionnaire Template',
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        accessLevel: 'ManagerAndAbove',
        createdAt: '2026-05-01T10:00:00Z'
      }
    ];

    for (const docRec of docs) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/documents`, docRec.documentId), docRec);
    }

    // 12. Seed Notifications
    const notifications: HRNotification[] = [
      {
        notificationId: 'not-001',
        companyId: DEMO_COMPANY_ID,
        userId: 'uid-manager-acme',
        title: 'Pending Leave Approval',
        message: 'Alex Rivera (emp-employee-acme) submitted a request for Annual Leave from 2026-07-15 to 2026-07-22.',
        read: false,
        type: 'Leave',
        createdAt: '2026-07-01T14:25:00Z'
      },
      {
        notificationId: 'not-002',
        companyId: DEMO_COMPANY_ID,
        userId: 'uid-admin-acme',
        title: 'Payroll Approved',
        message: 'June 2026 Payroll Run has been approved. Direct deposit worksheets are ready for download.',
        read: true,
        type: 'Payroll',
        createdAt: '2026-06-28T16:35:00Z'
      }
    ];

    for (const not of notifications) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/notifications`, not.notificationId), not);
    }

    // 13. Seed Audit logs
    const logs: AuditLog[] = [
      {
        logId: 'log-001',
        companyId: DEMO_COMPANY_ID,
        userId: 'uid-admin-acme',
        action: 'Authorized June Payroll Run',
        module: 'Payroll',
        details: 'Payroll ID: pay-2026-06. Sum total net paid out: $52,500.',
        createdAt: '2026-06-28T16:30:00Z'
      },
      {
        logId: 'log-002',
        companyId: DEMO_COMPANY_ID,
        userId: 'uid-hr-acme',
        action: 'Assigned Onboarding Tasks for Danielle Kemp',
        module: 'Onboarding',
        createdAt: '2026-06-28T10:05:00Z'
      }
    ];

    for (const log of logs) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_ID}/audit_logs`, log.logId), log);
    }

    // ----------------------------------------------------
    // Seed Company 2 - Globex Logistics (Starter Plan)
    // ----------------------------------------------------
    const depts2: Department[] = [
      { departmentId: 'dept-ops-globex', companyId: DEMO_COMPANY_2_ID, name: 'Operations & Fleet Logistics', createdAt: '2026-06-15T12:00:00Z' },
    ];
    for (const d of depts2) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_2_ID}/departments`, d.departmentId), d);
    }

    const employees2: Employee[] = [
      {
        employeeId: 'emp-ops-globex-01',
        companyId: DEMO_COMPANY_2_ID,
        firstName: 'John',
        lastName: 'Falconer',
        email: 'john.f@globex.com',
        phone: '+1 (555) 991-0029',
        dateOfBirth: '1989-10-10',
        gender: 'Male',
        address: '42 Shipping Lane, Houston, TX',
        jobTitle: 'Fleet Director & Lead Admin',
        departmentId: 'dept-ops-globex',
        gradeLevel: 'Grade 7',
        employmentType: 'Full-Time',
        dateOfEmployment: '2026-06-16',
        status: 'Active',
        baseSalary: 6200,
        bankName: 'Frost Bank',
        accountNumber: '******5591',
        createdAt: '2026-06-16T09:00:00Z'
      }
    ];
    for (const emp of employees2) {
      await setDoc(doc(db, `companies/${DEMO_COMPANY_2_ID}/employees`, emp.employeeId), emp);
    }

    console.log('PeopleCloud HRIS auto-seeding completed successfully.');
  } catch (error) {
    console.error('Error during auto-seeding database:', error);
  }
}
