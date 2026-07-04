import React, { useState, useEffect, useRef } from 'react';
import { UserRole, Employee, DocumentRecord } from '../types';
import { 
  User, 
  Camera, 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  CreditCard, 
  Landmark, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  MapPin, 
  Printer, 
  ArrowLeft, 
  ArrowRight, 
  Video, 
  Sparkles,
  Award,
  Upload,
  UserCheck,
  CheckCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, updateDoc, setDoc, query, where, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { triggerEmail } from '../emailService';

interface InteractiveOnboardingProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
  onPreviewClose?: () => void; // Optional fallback
}

export default function InteractiveOnboarding({ currentUser, selectedTenantId, onPreviewClose }: InteractiveOnboardingProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isEmployee = currentUser.role === 'Employee';

  // Core employee state
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Step wizard tracking (1: Welcome, 2: Profile Info, 3: Document Scanner, 4: Digital Contract, 5: Completion Summary)
  const [currentStep, setCurrentStep] = useState(1);

  // Step 2 Form States (Profile Information)
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Male');
  const [address, setAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [nextOfKin, setNextOfKin] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  // Step 3 States (Camera Scan & Upload)
  const [docCategory, setDocCategory] = useState<'ID_CARD' | 'CERTIFICATE' | 'PROOF_OF_ADDRESS'>('ID_CARD');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ category: string, name: string, date: string, url: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Step 4 States (Digital Signature Contract)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [isSigned, setIsSigned] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signedContractUrl, setSignedContractUrl] = useState<string | null>(null);
  const [ipAddress, setIpAddress] = useState('192.168.1.104'); // Simulated local container IP

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Fetch / Resolve current Employee record
  useEffect(() => {
    async function resolveEmployeeProfile() {
      if (!companyId) return;
      setLoading(true);
      try {
        // Query to find Employee record linked to user's UID or matching Email
        let matchedEmp: Employee | null = null;
        
        // Try searching by Email first
        const empRef = collection(db, `companies/${companyId}/employees`);
        const qEmail = query(empRef, where('email', '==', currentUser.email));
        const emailSnap = await getDocs(qEmail);
        
        if (!emailSnap.empty) {
          const docData = emailSnap.docs[0];
          matchedEmp = { ...docData.data() as Employee, employeeId: docData.id };
        } else {
          // Fallback search by UID
          const qUid = query(empRef, where('userId', '==', currentUser.uid));
          const uidSnap = await getDocs(qUid);
          if (!uidSnap.empty) {
            const docData = uidSnap.docs[0];
            matchedEmp = { ...docData.data() as Employee, employeeId: docData.id };
          }
        }

        // If no Employee record exists for a mock admin/HR checking the page, create a temporary preview employee
        if (!matchedEmp) {
          const tempEmpId = 'emp-onboard-preview';
          matchedEmp = {
            employeeId: tempEmpId,
            userId: currentUser.uid,
            companyId,
            firstName: currentUser.displayName?.split(' ')[0] || 'New',
            lastName: currentUser.displayName?.split(' ')[1] || 'Hire',
            email: currentUser.email,
            phone: '+1 (555) 019-9922',
            dateOfBirth: '1995-08-20',
            gender: 'Male',
            address: '100 Innovation Way, Silicon Valley, CA',
            jobTitle: 'Senior Specialist',
            departmentId: 'dept-eng',
            gradeLevel: 'Grade 6',
            employmentType: 'Full-Time',
            dateOfEmployment: new Date().toISOString().split('T')[0],
            status: 'Onboarding',
            baseSalary: 6200,
            onboardingTasks: {
              'Sign Contract': false,
              'ID Card Setup': false,
              'Workstation Allocation': false,
              'Security Training': false
            },
            createdAt: new Date().toISOString()
          };
          // Write to firestore so they can use the onboarding seamlessly in preview mode!
          await setDoc(doc(db, `companies/${companyId}/employees`, tempEmpId), matchedEmp);
        }

        setEmployee(matchedEmp);

        // Prepopulate form states
        if (matchedEmp) {
          setPhone(matchedEmp.phone || '');
          setDateOfBirth(matchedEmp.dateOfBirth || '');
          setGender(matchedEmp.gender || 'Male');
          setAddress(matchedEmp.address || '');
          setBankName(matchedEmp.bankName || '');
          setAccountNumber(matchedEmp.accountNumber || '');
          setTaxId(matchedEmp.taxId || '');
          setNextOfKin(matchedEmp.nextOfKin || '');
          setEmergencyPhone(matchedEmp.emergencyPhone || '');

          // Check if tasks are completed already
          const tasks = matchedEmp.onboardingTasks || {};
          if (tasks['ID Card Setup']) {
            setUploadedDocs([
              { category: 'ID_CARD', name: 'Identity_Verified_Camera.jpg', date: new Date().toLocaleDateString(), url: 'simulated_photo_url' }
            ]);
          }
          if (tasks['Sign Contract']) {
            setIsSigned(true);
            setSignedContractUrl(`contracts/signed_agreement_${matchedEmp.employeeId}.pdf`);
          }
        }

        // Simulate fetching IP Address for signature certificate
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          const ipData = await res.json();
          if (ipData.ip) setIpAddress(ipData.ip);
        } catch {
          // ignore ip fetch errors
        }

      } catch (err) {
        console.error('Error loading onboarding employee profile:', err);
        setErrorMessage('Failed to resolve employee record in Cloud Firestore.');
      } finally {
        setLoading(false);
      }
    }

    resolveEmployeeProfile();
  }, [companyId, currentUser.email, currentUser.uid, currentUser.displayName]);

  // Step 2 Debounced Auto-save to Cloud Firestore
  useEffect(() => {
    if (currentStep !== 2 || !employee || !companyId) return;

    // Skip initial run if all fields are empty
    if (!phone && !dateOfBirth && !address && !bankName && !accountNumber && !taxId && !nextOfKin && !emergencyPhone) return;

    setAutoSaveStatus('saving');

    const delayDebounceFn = setTimeout(async () => {
      try {
        const updateData = {
          phone: phone.trim(),
          dateOfBirth,
          gender,
          address: address.trim(),
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          taxId: taxId.trim(),
          nextOfKin: nextOfKin.trim(),
          emergencyPhone: emergencyPhone.trim()
        };

        await updateDoc(doc(db, `companies/${companyId}/employees`, employee.employeeId), updateData);
        
        // Update local state without triggering deep effect cycles
        setEmployee(prev => prev ? { ...prev, ...updateData } : null);

        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2500);
      } catch (err) {
        console.error('Auto-save failed:', err);
        setAutoSaveStatus('failed');
      }
    }, 1500); // 1.5 second typing debounce

    return () => clearTimeout(delayDebounceFn);
  }, [
    phone, 
    dateOfBirth, 
    gender, 
    address, 
    bankName, 
    accountNumber, 
    taxId, 
    nextOfKin, 
    emergencyPhone, 
    currentStep, 
    companyId, 
    employee?.employeeId
  ]);

  // Clean up media streams
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // --- CAMERA HANDLING ---
  const startCamera = async () => {
    setCameraError('');
    setIsCameraActive(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 485 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Error starting camera stream:', err);
      setCameraError('Permission to access camera was denied or camera is not available. Please upload a file instead.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
      setCameraError('Failed to capture picture. Please try again.');
    }
  };

  // Drag and drop fallbacks
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCapturedImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit verified snapshot upload
  const handleUploadDocument = async () => {
    if (!employee || !companyId || !capturedImage) return;
    setSaveLoading(true);
    setSuccessMessage('');
    
    try {
      const docName = `${docCategory.toLowerCase()}_verified_${Date.now()}.jpg`;
      const docUrl = capturedImage; // Store base64 data url directly as simulated Cloud storage URL
      
      // 1. Write document record under employee's documents subcollection
      const docId = 'doc-' + Math.random().toString(36).substring(2, 9);
      const newDoc: DocumentRecord = {
        documentId: docId,
        companyId,
        employeeId: employee.employeeId,
        category: docCategory === 'ID_CARD' ? 'OfferLetter' : docCategory === 'CERTIFICATE' ? 'TrainingCertificate' : 'Policy',
        name: docName,
        fileUrl: docUrl,
        accessLevel: 'EmployeeSelf',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/employees/${employee.employeeId}/documents`, docId), newDoc);

      // 2. Mark task complete in Employee Profile
      const currentTasks = { ...(employee.onboardingTasks || {}) };
      currentTasks['ID Card Setup'] = true;

      await updateDoc(doc(db, `companies/${companyId}/employees`, employee.employeeId), {
        onboardingTasks: currentTasks
      });

      // Update local states
      setEmployee({ ...employee, onboardingTasks: currentTasks });
      setUploadedDocs([...uploadedDocs, { 
        category: docCategory, 
        name: docCategory === 'ID_CARD' ? 'Government Photo ID' : docCategory === 'CERTIFICATE' ? 'Academic Degree' : 'Proof of Residency', 
        date: new Date().toLocaleDateString(),
        url: docUrl 
      }]);
      
      setCapturedImage(null);
      setSuccessMessage('Document verified and uploaded successfully.');
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to save document. Please check security rules.');
    } finally {
      setSaveLoading(false);
    }
  };

  // --- DIGITAL SIGNATURE PAD ---
  useEffect(() => {
    if (currentStep === 4 && signatureMode === 'draw') {
      setTimeout(() => {
        initCanvas();
      }, 100);
    }
  }, [currentStep, signatureMode]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set styling
    ctx.strokeStyle = '#1e293b'; // Slate 800
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Handle Touch coordinates
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    
    // Handle Mouse coordinates
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignatureCanvas = () => {
    initCanvas();
    setSignatureDataUrl(null);
  };

  // Capture drawing or text as digital signature
  const handleAdoptSignature = () => {
    if (signatureMode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Verify signature is not completely blank (simple non-white pixel check or set state)
      const dataUrl = canvas.toDataURL('image/png');
      setSignatureDataUrl(dataUrl);
    } else {
      if (!typedName.trim()) return;
      
      // Render typed name into canvas to save as image
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#4f46e5'; // Brand-600
        ctx.font = 'italic bold 32px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
        
        // Draw elegant underline
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, 90);
        ctx.lineTo(360, 90);
        ctx.stroke();
        
        setSignatureDataUrl(canvas.toDataURL('image/png'));
      }
    }
  };

  // Trigger a confirmation notification to the HR team via Firestore when a new hire completes all steps of the checklist
  const triggerHRNotification = async (emp: Employee) => {
    try {
      const companyId = emp.companyId;
      if (!companyId) return;

      // Fetch users belonging to this company to notify HR & Company Admins
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('companyId', '==', companyId));
      let hrRecipientIds: string[] = [];
      try {
        const usersSnap = await getDocs(q);
        usersSnap.forEach((userDoc) => {
          const userData = userDoc.data();
          if (['CompanyAdmin', 'HRManager', 'Recruiter'].includes(userData.role)) {
            hrRecipientIds.push(userDoc.id);
          }
        });
      } catch (err) {
        console.warn('Could not fetch specific users for notification, falling back:', err);
      }

      // Fallback: If no explicit HR users found, add demo managers/admins or the current UID
      if (hrRecipientIds.length === 0) {
        if (companyId === 'demo-company-id' || companyId === 'acme') {
          hrRecipientIds.push('uid-admin-acme', 'uid-manager-acme');
        } else {
          // Add a default admin recipient
          hrRecipientIds.push('uid-admin-acme');
        }
      }

      // De-duplicate just in case
      hrRecipientIds = Array.from(new Set(hrRecipientIds));

      // Create a notification document in the company's notifications collection for each HR/Admin recipient
      const path = `companies/${companyId}/notifications`;
      const notificationPromises = hrRecipientIds.map(async (userId) => {
        const notifData = {
          companyId,
          userId,
          title: 'Onboarding Checklist Completed',
          message: `New hire ${emp.firstName} ${emp.lastName} (${emp.jobTitle}) has completed all onboarding checklist steps, uploaded verified documents, and signed the digital contract.`,
          read: false,
          type: 'Onboarding',
          createdAt: new Date().toISOString()
        };
        try {
          await addDoc(collection(db, path), notifData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      });

      await Promise.all(notificationPromises);
      console.log(`Triggered onboarding completion notifications to ${hrRecipientIds.length} HR members.`);
    } catch (err) {
      console.error('Error triggering HR notifications for onboarding completion:', err);
    }
  };

  // Sign and record contract in Firestore
  const handleSignContract = async () => {
    if (!employee || !companyId || !signatureDataUrl) return;
    setSaveLoading(true);
    setSuccessMessage('');

    try {
      // 1. Create document record for signed contract
      const contractId = 'contract-signed-' + Math.random().toString(36).substring(2, 9);
      const signedDoc: DocumentRecord = {
        documentId: contractId,
        companyId,
        employeeId: employee.employeeId,
        category: 'Contract',
        name: `Employment_Contract_Signed_${employee.firstName}_${employee.lastName}.pdf`,
        fileUrl: signatureDataUrl, // Binds signature capture directly as file URL
        accessLevel: 'EmployeeSelf',
        createdAt: new Date().toISOString()
      };

      const signedDocPath = `companies/${companyId}/employees/${employee.employeeId}/documents/${contractId}`;
      try {
        await setDoc(doc(db, `companies/${companyId}/employees/${employee.employeeId}/documents`, contractId), signedDoc);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, signedDocPath);
      }

      // 2. Mark contract complete in employee onboarding progress
      const currentTasks = { ...(employee.onboardingTasks || {}) };
      currentTasks['Sign Contract'] = true;

      // Check if all orientation items are done to flip status
      const allDone = Object.values(currentTasks).every(val => val === true);
      const updatedStatus = allDone ? 'Active' : 'Onboarding';

      const employeeDocPath = `companies/${companyId}/employees/${employee.employeeId}`;
      try {
        await updateDoc(doc(db, `companies/${companyId}/employees`, employee.employeeId), {
          onboardingTasks: currentTasks,
          status: updatedStatus
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, employeeDocPath);
      }

      setEmployee({ ...employee, onboardingTasks: currentTasks, status: updatedStatus });
      setIsSigned(true);
      setSignedContractUrl(`contracts/signed_agreement_${employee.employeeId}.pdf`);
      setSuccessMessage('Digital employment contract signed and archived successfully!');
      
      // Advance to success step
      setCurrentStep(5);

      // Trigger notification to HR team via Firestore when a new hire completes all steps of the InteractiveOnboarding checklist
      const updatedEmployee = { ...employee, onboardingTasks: currentTasks, status: updatedStatus };
      await triggerHRNotification(updatedEmployee);

      // Trigger contract signed email confirmation
      triggerEmail({
        from: 'contracts@peoplecloudhris.com',
        to: employee.email,
        subject: `Signed Employment Agreement Archived: ${employee.firstName} ${employee.lastName}`,
        bodyHtml: `
          <div style="font-family: sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <h2 style="color: #10b981; font-size: 18px; font-weight: bold; margin-bottom: 16px;">Employment Contract Signed & Certified</h2>
            <p style="font-size: 13px; line-height: 1.5; color: #334155;">Dear <strong>${employee.firstName}</strong>,</p>
            <p style="font-size: 13px; line-height: 1.5; color: #334155;">Thank you for executing your digital employment contract. This serves as official cryptographic confirmation that your signed agreement has been successfully stamped and archived in Firestore.</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 0; font-size: 12px; color: #475569;"><strong>Signee Name:</strong> ${employee.firstName} ${employee.lastName}</p>
              <p style="margin: 6px 0 0; font-size: 12px; color: #475569;"><strong>Position:</strong> ${employee.jobTitle}</p>
              <p style="margin: 6px 0 0; font-size: 12px; color: #475569;"><strong>Date Signed:</strong> ${new Date().toUTCString()}</p>
              <p style="margin: 6px 0 0; font-size: 11px; color: #64748b; font-family: monospace;"><strong>IP Audit Address:</strong> ${ipAddress}</p>
            </div>

            <p style="font-size: 13px; line-height: 1.5; color: #334155;">Your HR representative has been automatically notified and is currently setting up your workstation, laptop delivery, and email credentials.</p>
            <p style="font-size: 13px; line-height: 1.5; color: #334155;">Welcome to the family! We are thrilled to work alongside you.</p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 10px; text-align: center; margin: 0;">Powered securely by PeopleCloud HRIS Mail Services.</p>
          </div>
        `
      });
    } catch (err) {
      console.error('Error signing digital contract:', err);
      setErrorMessage('Failed to sign and save contract in Cloud Firestore.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Save Step 2 Form (Profile Information)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !companyId) return;
    setSaveLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const updateData = {
        phone: phone.trim(),
        dateOfBirth,
        gender,
        address: address.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        taxId: taxId.trim(),
        nextOfKin: nextOfKin.trim(),
        emergencyPhone: emergencyPhone.trim()
      };

      const docRef = doc(db, `companies/${companyId}/employees`, employee.employeeId);
      await updateDoc(docRef, updateData);

      setEmployee({ ...employee, ...updateData });
      setSuccessMessage('Onboarding profile information saved successfully!');
      
      // Advance to Document verification
      setCurrentStep(3);
    } catch (err) {
      console.error('Error saving profile information:', err);
      setErrorMessage('Failed to save profile. Please check firestore write rules.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Print checklist receipt or details
  const handlePrintChecklist = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest font-mono">Assembling Interactive Onboarding Portal...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="font-bold text-slate-800 text-sm">Employee Profile Resolution Error</h3>
        <p className="text-xs max-w-md mx-auto">We could not resolve your Employee Database profile. Please make sure your login email matches an employee email address in the core registry.</p>
      </div>
    );
  }

  // Calculate complete percentages
  const totalChecklists = employee.onboardingTasks ? Object.keys(employee.onboardingTasks).length : 4;
  const completedChecklists = employee.onboardingTasks ? Object.values(employee.onboardingTasks).filter(Boolean).length : 0;
  const completionPercentage = Math.round((completedChecklists / totalChecklists) * 100);

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="interactive-onboarding-container">
      
      {/* 1. PROGRESS BAR HEADER & MULTI-TENANT CONTEXT */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-md">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-brand-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900 uppercase tracking-widest font-mono">
                {employee.status === 'Active' ? 'Orientation Done' : 'Onboarding Phase'}
              </span>
              <span className="text-[10px] font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 font-mono">
                ID: {employee.employeeId}
              </span>
            </div>
            <h2 className="text-lg font-bold font-display mt-1.5 flex items-center gap-1.5">
              Welcome, {employee.firstName} {employee.lastName}!
              <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
            </h2>
            <p className="text-xs text-slate-400 max-w-lg mt-0.5 font-medium leading-relaxed">
              We are absolutely thrilled to welcome you to the family! Follow this guided step-by-step checklist to complete your profile, upload your credentials, and finalize your digital employment contracts.
            </p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 flex items-center gap-3 shrink-0">
            <div className="relative w-12 h-12 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center">
              <span className="text-xs font-bold text-brand-400 font-mono">{completionPercentage}%</span>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="24" cy="24" r="22" stroke="rgba(71,85,105,0.3)" strokeWidth="2.5" fill="transparent" />
                <circle 
                  cx="24" 
                  cy="24" 
                  r="22" 
                  stroke="#4f46e5" 
                  strokeWidth="2.5" 
                  fill="transparent" 
                  strokeDasharray="138" 
                  strokeDashoffset={138 - (138 * completionPercentage) / 100} 
                />
              </svg>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block font-mono">Completion Progress</span>
              <span className="text-xs font-bold text-slate-200 block">{completedChecklists} of {totalChecklists} Tasks Done</span>
            </div>
          </div>
        </div>

        {/* Dynamic Horizontal Progress Bar */}
        <div className="mt-5 bg-slate-800/40 border border-slate-800/50 rounded-xl p-4 relative z-10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Onboarding Track Completeness
            </span>
            <span className="text-xs font-bold text-brand-400 font-mono">
              {completionPercentage}% Done
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-4 p-0.5 border border-slate-800/60 shadow-inner overflow-hidden">
            <div 
              className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 via-brand-500 to-emerald-500 transition-all duration-500 relative"
              style={{ width: `${Math.max(completionPercentage, 3)}%` }}
            >
              {completionPercentage > 0 && completionPercentage < 100 && (
                <div className="absolute right-0.5 top-0.5 w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center mt-2.5 text-[9px] text-slate-400 font-mono uppercase tracking-wider font-bold">
            <span className={currentStep === 1 || currentStep === 2 ? "text-brand-400" : ""}>1. Profile Form</span>
            <span className={currentStep === 3 ? "text-brand-400" : ""}>2. ID / Document Scan</span>
            <span className={currentStep === 4 ? "text-brand-400" : ""}>3. Digital Signature</span>
            <span className={currentStep === 5 ? "text-emerald-400" : ""}>4. Finished</span>
          </div>
        </div>

        {/* Wizard Multi-Step Steps Indicator */}
        <div className="border-t border-slate-800 mt-6 pt-5 grid grid-cols-5 gap-2 relative z-10 text-center">
          {[
            { step: 1, label: 'Welcome' },
            { step: 2, label: 'Profile Form' },
            { step: 3, label: 'Doc Scan' },
            { step: 4, label: 'Sign Contract' },
            { step: 5, label: 'Receipt' },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => currentStep > item.step && setCurrentStep(item.step)}
              disabled={currentStep < item.step}
              className={`flex flex-col items-center group transition-all duration-200 focus:outline-none ${
                currentStep >= item.step ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all duration-200 ${
                currentStep === item.step ? 'bg-brand-600 text-white shadow-xs scale-110 ring-2 ring-brand-500/20' :
                currentStep > item.step ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {currentStep > item.step ? <Check className="w-3.5 h-3.5" /> : item.step}
              </div>
              <span className={`text-[9px] font-bold tracking-tight mt-1.5 block transition-colors duration-200 ${
                currentStep === item.step ? 'text-brand-400' :
                currentStep > item.step ? 'text-slate-300' : 'text-slate-500'
              }`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. ALERT MESSAGES */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 3. STEP CONTENT SECTIONS */}

      {/* STEP 1: WELCOME BANNER & INITIAL ASSESSOR */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 animate-slide-up">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-50 rounded-2xl border border-brand-100 text-brand-600">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Your Corporate Designation Overview</h3>
              <p className="text-xs text-slate-500">Review your designated job parameters. If any details are incorrect, please contact your HR partner Sarah Jenkins.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Corporate Role</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">{employee.jobTitle}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Base Salary</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">${(employee.baseSalary || 0).toLocaleString()}/month</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Employment Type</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">{employee.employmentType || 'Full-Time'}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Date of Commencement</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">{employee.dateOfEmployment || new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Required Actions Checklist</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <Check className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Personal Profile Information</span>
                    <span className="text-[10px] text-slate-500">Provide bank accounts, emergency contacts, tax details.</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded uppercase font-mono">Incomplete</span>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <Check className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Document Verification Scan</span>
                    <span className="text-[10px] text-slate-500">Capture or upload photo verification of Govt Issued ID / degree.</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                  employee.onboardingTasks?.['ID Card Setup'] ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-amber-600 bg-amber-50 border border-amber-100'
                }`}>
                  {employee.onboardingTasks?.['ID Card Setup'] ? 'Complete' : 'Incomplete'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <Check className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Employment Agreement Digital Signature</span>
                    <span className="text-[10px] text-slate-500">Review, adopt digital signature, and sign your binding contract.</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                  employee.onboardingTasks?.['Sign Contract'] ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-amber-600 bg-amber-50 border border-amber-100'
                }`}>
                  {employee.onboardingTasks?.['Sign Contract'] ? 'Complete' : 'Incomplete'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PROFILE INFORMATION FORM */}
      {currentStep === 2 && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 animate-slide-up">
          <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-600">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 text-base">Step 1: Complete Personal Profile Card</h3>
                
                {/* Auto Save Status Badge */}
                {autoSaveStatus === 'saving' && (
                  <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded flex items-center gap-1 shrink-0 animate-pulse">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    Saving progress...
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <Check className="w-2.5 h-2.5" />
                    All changes auto-saved
                  </span>
                )}
                {autoSaveStatus === 'failed' && (
                  <span className="text-[9px] font-mono font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Auto-save offline
                  </span>
                )}
                {autoSaveStatus === 'idle' && (
                  <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <Check className="w-2.5 h-2.5 text-slate-400" />
                    Auto-save active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">Please enter your private personal records. These are securely encrypted in Firestore and visible only to HR Managers.</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Section A: Contact Details */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Contact & Address Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Primary Telephone</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 440-2211"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Gender Definition</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none text-xs"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="PreferNotToSay">Prefer Not to Say</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Home Physical Address</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street Address, City, State, ZIP Code"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Section B: Financial & Bank Details */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                Financial, Bank & Tax Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Salary Bank Name</label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Chase Bank, SVB"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Account Number</label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 10420938491"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Tax ID / SSN Number</label>
                  <input
                    type="text"
                    required
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="TX-00912-X"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Section C: Emergency Contacts */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-slate-400" />
                Emergency Contact Details (Next of Kin)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Next of Kin Full Name & Relationship</label>
                  <input
                    type="text"
                    required
                    value={nextOfKin}
                    onChange={(e) => setNextOfKin(e.target.value)}
                    placeholder="e.g. Clara Sterling (Spouse)"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1 font-bold">Emergency Phone Line</label>
                  <input
                    type="text"
                    required
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="+1 (555) 012-4422"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={saveLoading}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {saveLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save & Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: DOCUMENT VERIFICATION SCANNER */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 animate-slide-up">
          <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-600">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Step 2: Credential Document Scanner</h3>
              <p className="text-xs text-slate-500">We require photo documentation to verify your employment eligibility. Scan with your camera or drop a file copy below.</p>
            </div>
          </div>

          {/* Document selection */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'ID_CARD', label: 'Govt ID / Passport' },
              { id: 'CERTIFICATE', label: 'Academic Degree' },
              { id: 'PROOF_OF_ADDRESS', label: 'Proof of Address' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDocCategory(d.id as any);
                  setCapturedImage(null);
                  stopCamera();
                }}
                className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  docCategory === d.id ? 'border-brand-600 bg-brand-50/50 text-brand-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Core Interactive Scanner Stage */}
          <div className="relative">
            {isCameraActive ? (
              <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-video border border-slate-800 shadow-inner flex flex-col justify-end">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
                
                {/* Visual Scanning overlays */}
                <div className="absolute inset-0 border-[24px] border-slate-950/40 flex items-center justify-center pointer-events-none">
                  <div className="w-4/5 h-3/4 border-2 border-brand-400 border-dashed rounded-lg relative flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-brand-500 -translate-x-1.5 -translate-y-1.5 rounded-sm"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-brand-500 translate-x-1.5 -translate-y-1.5 rounded-sm"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-brand-500 -translate-x-1.5 translate-y-1.5 rounded-sm"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-brand-500 translate-x-1.5 translate-y-1.5 rounded-sm"></div>
                    <span className="text-[10px] text-brand-300 font-mono font-bold bg-slate-950/80 px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-xs">
                      Align document card here
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4 z-10">
                  <button
                    onClick={captureSnapshot}
                    className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    Capture Picture
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 bg-slate-900/90 hover:bg-slate-900 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : capturedImage ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-4 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block mb-2">Scan Frame Preview</span>
                <img 
                  src={capturedImage} 
                  alt="Captured Document Snapshot" 
                  className="max-h-72 object-contain mx-auto rounded-xl border border-slate-200 shadow-sm"
                  referrerPolicy="no-referrer"
                />
                
                <div className="flex justify-center gap-3 mt-4">
                  <button
                    onClick={handleUploadDocument}
                    disabled={saveLoading}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {saveLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Verify & Upload
                  </button>
                  <button
                    onClick={() => setCapturedImage(null)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Retake / Reupload
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
                  isDragging ? 'border-brand-500 bg-brand-50/20' : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="max-w-xs mx-auto space-y-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-800">Use Live Webcam or Upload Copy</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Ensure text on the photo ID card is fully legible and clear for automatic OCR checks.</p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Open Camera
                    </button>
                    <label className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
                      Browse Files
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  {cameraError && (
                    <p className="text-[10px] text-rose-500 font-medium font-mono pt-2">{cameraError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Show list of uploaded docs */}
          {uploadedDocs.length > 0 && (
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Completed Document Scans</h4>
              <div className="space-y-2">
                {uploadedDocs.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-slate-800 font-bold">{doc.name}</span>
                      <span className="text-[10px] text-slate-400">({doc.category})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Uploaded {doc.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex justify-between items-center pt-5 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              disabled={uploadedDocs.length === 0}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                uploadedDocs.length > 0 ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed border'
              }`}
            >
              <span>Continue to Contract</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: DIGITAL CONTRACT SIGNATURE PAD */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 animate-slide-up">
          <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
            <div className="p-3 bg-brand-50 rounded-2xl border border-brand-100 text-brand-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Step 3: Digital Employment Contract Agreement</h3>
              <p className="text-xs text-slate-500">Please review your binding employment agreement below. Adopt a digital signature format to execute the contract.</p>
            </div>
          </div>

          {/* Mini Scrollable Contract Document preview */}
          <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 max-h-72 overflow-y-auto text-[11px] text-slate-600 leading-relaxed space-y-4 font-medium select-none scrollbar-subtle shadow-inner">
            <div className="text-center space-y-1">
              <h4 className="font-display font-extrabold text-slate-900 text-xs uppercase tracking-wider">Acme Technology Corporation</h4>
              <p className="font-bold text-slate-800 text-[10px]">OFFICIAL CONTRACT OF PERMANENT EMPLOYMENT</p>
              <p className="text-[9px] text-slate-400 font-mono">Ref ID: {employee.employeeId || 'DEMO-X'}</p>
            </div>

            <p>
              This Employment Agreement (the "Agreement") is entered into as of <strong>{employee.dateOfEmployment || new Date().toISOString().split('T')[0]}</strong>, by and between <strong>Acme Technology Corporation</strong> (the "Company") and <strong>{employee.firstName} {employee.lastName}</strong> (the "Employee").
            </p>

            <div className="space-y-2">
              <p className="font-bold text-slate-950 text-xs">1. Position and Job Title</p>
              <p>
                The Employee shall be employed in the capacity of <strong>{employee.jobTitle}</strong>. The Employee agrees to perform all duties, responsibilities, and instructions as directed by the Board of Directors and the designated Line Supervisor.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-950 text-xs">2. Compensation & Benefits</p>
              <p>
                The Company shall pay the Employee a monthly gross base salary of <strong>${(employee.baseSalary || 5000).toLocaleString()} USD</strong>, payable in accordance with the standard payroll policies of the Company. All earnings will be subject to applicable statutory tax deductions.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-950 text-xs">3. Confidentiality and IP Protection</p>
              <p>
                The Employee acknowledges that during employment, they will have access to confidential proprietary corporate software, source code repositories, and user databases. The Employee agrees to preserve the absolute confidentiality of such intellectual properties and agrees that all creations during work hours belong exclusively to the Company.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-950 text-xs">4. Termination and Notice Period</p>
              <p>
                Either party may terminate this Agreement by giving a minimum of thirty (30) days written notice to the other. The Company reserves the right to terminate employment immediately for gross misconduct.
              </p>
            </div>

            <p className="text-[10px] text-slate-400 italic">
              *By signing below, both parties confirm they have read, understood, and agreed to all provisions and covenants herein.
            </p>
          </div>

          {/* Interactive Signature Area */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4">
              <span className="font-bold text-slate-900 text-xs">Adopt Your Signature</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSignatureMode('draw');
                    setSignatureDataUrl(null);
                  }}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    signatureMode === 'draw' ? 'bg-white shadow-xs text-brand-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Draw Signature
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignatureMode('type');
                    setSignatureDataUrl(null);
                    setTypedName(`${employee.firstName} ${employee.lastName}`);
                  }}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    signatureMode === 'type' ? 'bg-white shadow-xs text-brand-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Type Signature
                </button>
              </div>
            </div>

            {signatureDataUrl ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-center space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Adopted Electronic Signature</p>
                <img 
                  src={signatureDataUrl} 
                  alt="Captured digital signature" 
                  className="mx-auto max-h-24 bg-slate-50/50 rounded-lg p-2 border border-slate-100"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setSignatureDataUrl(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:text-slate-800 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                >
                  Clear & Choose Different
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {signatureMode === 'draw' ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-medium">Draw your signature inside the container below using your mouse or touch screen.</p>
                    <canvas
                      ref={canvasRef}
                      width={450}
                      height={130}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-32 bg-white border border-slate-300 rounded-xl cursor-crosshair shadow-xs touch-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={clearSignatureCanvas}
                        className="px-3 py-1 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Reset Pad
                      </button>
                      <button
                        type="button"
                        onClick={handleAdoptSignature}
                        className="px-4 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                      >
                        Adopt Drawn Signature
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-400 font-medium">Type your legal name to auto-generate an electronic cursive signature signature.</p>
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="e.g. Liam Sterling"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                    <div className="bg-white border rounded-xl p-4 text-center">
                      <span className="text-[9px] text-slate-400 block font-mono">CURSIVE PREVIEW</span>
                      <p className="font-bold text-indigo-600 text-3xl italic font-display mt-2 font-serif select-none">
                        {typedName || 'Your Signature'}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAdoptSignature}
                        disabled={!typedName.trim()}
                        className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs disabled:opacity-40"
                      >
                        Adopt Cursive Signature
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Secure Audit certification container */}
          {signatureDataUrl && (
            <div className="bg-brand-50/50 border border-brand-100 rounded-xl p-4 flex gap-3 text-brand-800 text-xs">
              <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
              <div className="space-y-1 font-medium">
                <p className="font-bold">SaaS Cryptographic Audit Footprint</p>
                <p className="text-[10px] text-brand-700 leading-relaxed">
                  By clicking 'Sign Contract', a digital contract will be archived in Firestore matching the profile metadata. 
                  Audit footprint: <strong className="font-mono">IP: {ipAddress}</strong> on <strong className="font-mono">{new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex justify-between items-center pt-5 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleSignContract}
              disabled={saveLoading || !signatureDataUrl}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                signatureDataUrl ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed border'
              }`}
            >
              {saveLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Adopt & Sign Contract</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: ONBOARDING COMPLETION SUMMARY / PRINT */}
      {currentStep === 5 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 animate-slide-up print-area">
          <div className="text-center space-y-3 pb-6 border-b border-slate-100 relative">
            <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle className="w-6 h-6 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base flex items-center justify-center gap-1.5">
                Onboarding Portal Tasks Completed!
                <Award className="w-4.5 h-4.5 text-amber-500" />
              </h3>
              <p className="text-xs text-slate-500 font-medium">Excellent work, {employee.firstName}. You have successfully submitted all required pre-employment documents.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Submission Receipt Card</h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="p-4 bg-slate-50/50 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Employee Registry ID</span>
                <span className="font-mono font-bold text-slate-800">{employee.employeeId}</span>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Legal Full Name</span>
                <span className="font-bold text-slate-900">{employee.firstName} {employee.lastName}</span>
              </div>
              <div className="p-4 bg-slate-50/50 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Assigned Designation</span>
                <span className="font-bold text-slate-900">{employee.jobTitle}</span>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Identity Documents Scan Status</span>
                <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Verified and Archived
                </span>
              </div>
              <div className="p-4 bg-slate-50/50 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Digital Contract Signature Status</span>
                <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Legally Signed (IP: {ipAddress})
                </span>
              </div>
            </div>
          </div>

          {/* Pending Admin orientation task tracker */}
          <div className="bg-slate-50 border rounded-2xl p-4 text-xs text-slate-600 space-y-2.5">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-500" />
              Administrative Orientation Items
            </p>
            <p className="text-[11px] text-slate-500">Your HR administrators will coordinate these remaining checklist items for you over your first week of joining:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-semibold text-[11px]">
              <div className="flex items-center gap-2 text-slate-500 bg-white px-3 py-1.5 border border-slate-200/60 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                <span>Workstation Provisioning & Laptop Delivery</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 bg-white px-3 py-1.5 border border-slate-200/60 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                <span>Security Awareness Orientation Courses</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-between items-center pt-5 border-t border-slate-100 no-print">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Restart Preview
            </button>
            <div className="flex gap-2">
              <button
                onClick={handlePrintChecklist}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border"
              >
                <Printer className="w-4 h-4" />
                Print Submission Card
              </button>
              {onPreviewClose && (
                <button
                  onClick={onPreviewClose}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Exit Portal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
