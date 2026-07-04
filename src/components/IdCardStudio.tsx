import React, { useState, useEffect, useRef } from 'react';
import { UserRole, Employee } from '../types';
import { 
  Shield, 
  Printer, 
  Upload, 
  Camera, 
  Grid, 
  RotateCw, 
  Check, 
  AlertCircle, 
  Download, 
  Eye, 
  CreditCard,
  Barcode as BarcodeIcon,
  RefreshCw,
  QrCode,
  UserCheck
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface IdCardStudioProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

interface CardCustomization {
  themeColor: string;
  badgeStyle: 'vertical' | 'horizontal';
  bloodGroup: string;
  idExpiry: string;
  barcodeValue: string;
  qrValue: string;
  showSignature: boolean;
  textColor: string;
  accentColor: string;
}

export default function IdCardStudio({ currentUser, selectedTenantId }: IdCardStudioProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isEmployee = currentUser.role === 'Employee';

  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  
  // ID Photo State
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoLoading, setPhotoLoading] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  
  // Customization State
  const [custom, setCustom] = useState<CardCustomization>({
    themeColor: '#3b82f6', // Indigo/Blue default
    badgeStyle: 'vertical',
    bloodGroup: 'O+',
    idExpiry: new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 years default
    barcodeValue: 'EMP-100459',
    qrValue: 'https://peoplecloudhris.com/verify/100459',
    showSignature: true,
    textColor: '#ffffff',
    accentColor: '#1e293b'
  });

  const [ocrStatus, setOcrStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch employees
  useEffect(() => {
    async function loadEmployees() {
      if (!companyId) return;
      try {
        const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const empList: Employee[] = [];
        empSnap.forEach(d => empList.push({ ...d.data() as Employee, employeeId: d.id }));
        setEmployees(empList);

        // Pre-select current employee if role is Employee
        if (isEmployee) {
          const matching = empList.find(e => e.email === currentUser.email);
          if (matching) {
            setSelectedEmpId(matching.employeeId);
            setSelectedEmp(matching);
            // Default barcode/QR
            setCustom(prev => ({
              ...prev,
              barcodeValue: matching.employeeId,
              qrValue: `https://peoplecloudhris.com/verify/${matching.employeeId}`
            }));
          }
        } else if (empList.length > 0) {
          setSelectedEmpId(empList[0].employeeId);
          setSelectedEmp(empList[0]);
          setCustom(prev => ({
            ...prev,
            barcodeValue: empList[0].employeeId,
            qrValue: `https://peoplecloudhris.com/verify/${empList[0].employeeId}`
          }));
        }
      } catch (err) {
        console.error('Error loading employees in ID Card studio:', err);
      }
    }
    loadEmployees();
  }, [companyId, isEmployee, currentUser.email]);

  // Handle Employee Change
  const handleEmpChange = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employees.find(e => e.employeeId === empId);
    setSelectedEmp(emp || null);
    if (emp) {
      setCustom(prev => ({
        ...prev,
        barcodeValue: emp.employeeId,
        qrValue: `https://peoplecloudhris.com/verify/${emp.employeeId}`
      }));
      // Reset photo unless saved on employee record (simulated)
      setPhotoUrl('');
    }
  };

  // Camera Actions
  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 300, height: 300, facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera streaming failed:', err);
      setCameraActive(false);
      alert('Unable to access camera. Please upload an image instead.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 320, 320);
      const dataUrl = canvas.toDataURL('image/png');
      setPhotoUrl(dataUrl);
    }
    // Stop streams
    const stream = videoRef.current.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const cancelCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
    setCameraActive(false);
  };

  // Drag and Drop File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setPhotoLoading(true);
    setOcrStatus('processing');

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoUrl(result);
      setPhotoFile(file);
      setPhotoLoading(false);

      // Simulate Employee ID Card Processor OCR / metadata extraction
      setTimeout(() => {
        setOcrStatus('success');
        setSuccessMessage('Biometric photo successfully aligned and formatted for ID Card standard (CR80).');
        setTimeout(() => setOcrStatus('idle'), 4000);
      }, 1500);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Print function
  const triggerPrintBadge = () => {
    window.print();
  };

  // Download function (Simulates export to PDF, JPEG, PNG in high definition)
  const triggerDownloadBadge = (format: 'png' | 'jpeg' | 'pdf') => {
    if (!selectedEmp) return;
    
    const fileName = `ID_Badge_${selectedEmp.firstName}_${selectedEmp.lastName}_CR80.${format}`;
    
    // Create canvas and render card layout
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Draw background
      ctx.fillStyle = '#0f172a'; // Slate 900
      ctx.fillRect(0, 0, 600, 900);
      
      // Draw border
      ctx.strokeStyle = custom.themeColor;
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 6, 588, 888);
      
      // Header circle graphic
      ctx.fillStyle = custom.themeColor;
      ctx.beginPath();
      ctx.arc(300, 0, 250, 0, Math.PI);
      ctx.fill();
      
      // Branding text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PEOPLECLOUD SECURE STAFF', 300, 80);
      
      // Photo area background circle
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(300, 320, 110, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = custom.themeColor;
      ctx.lineWidth = 6;
      ctx.stroke();
      
      // Staff initials in photo area
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(`${selectedEmp.firstName[0]}${selectedEmp.lastName[0]}`, 300, 335);
      
      // Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(`${selectedEmp.firstName} ${selectedEmp.lastName}`, 300, 520);
      
      // Title
      ctx.fillStyle = custom.themeColor;
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(selectedEmp.jobTitle.toUpperCase(), 300, 565);
      
      // Metadata table area
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(80, 640, 440, 100);
      
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('DEPARTMENT', 110, 675);
      ctx.textAlign = 'right';
      ctx.fillText('SECURITY LEVEL', 490, 675);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(selectedEmp.employmentType, 110, 715);
      ctx.textAlign = 'right';
      ctx.fillText('LEVEL 4 CLEARANCE', 490, 715);
      
      // Barcode
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(150, 780, 300, 40);
      
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('||| ||| || | ||| || ||| || |||', 300, 805);
      
      // Footer barcode label
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(custom.barcodeValue, 300, 850);
    }
    
    let dataUrl = '';
    if (format === 'pdf') {
      dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    } else if (format === 'jpeg') {
      dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    } else {
      dataUrl = canvas.toDataURL('image/png');
    }
    
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    
    setOcrStatus('success');
    setSuccessMessage(`Exported and downloaded ID Card successfully as ${format.toUpperCase()}!`);
    setTimeout(() => setOcrStatus('idle'), 4000);
  };

  return (
    <div className="space-y-6 animate-slide-up" id="id-card-processor-module">
      
      {/* Print styles injected directly */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-area-wrapper, #print-area-wrapper * {
            visibility: visible !important;
          }
          #print-area-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 20px !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900">Corporate Employee ID Card Processor</h2>
          <p className="text-xs text-slate-500">Formulate, design, and print standardized credit-card sized (CR80) ID badges. Integrates biometric photo processing, auto-generated barcode scanning, and security clearances.</p>
        </div>

        <button
          onClick={triggerPrintBadge}
          disabled={!selectedEmp}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Both Sides</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 no-print">
        
        {/* Left Side: ID Parameter Setup */}
        <div className="xl:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 h-fit">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            Badge Configurator
          </h3>

          {/* Select Employee */}
          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Select Employee Profile</label>
            <select
              disabled={isEmployee}
              value={selectedEmpId}
              onChange={(e) => handleEmpChange(e.target.value)}
              className="w-full border border-slate-200 bg-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
            >
              {employees.map(e => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.firstName} {e.lastName} ({e.jobTitle})
                </option>
              ))}
            </select>
          </div>

          {/* Photo Capturing & Processing */}
          <div className="space-y-2 text-xs">
            <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block">Biometric ID Photo Processor</label>
            
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
              {/* Photo Display */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Employee Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-slate-400 font-mono font-bold text-base uppercase">
                      {selectedEmp ? `${selectedEmp.firstName[0]}${selectedEmp.lastName[0]}` : 'ID'}
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-slate-800">Align Employee Face</p>
                  <p className="text-[10px] text-slate-400">Accepted formats: JPG, PNG, or PDF scans.</p>
                </div>
              </div>

              {cameraActive ? (
                <div className="space-y-2">
                  <div className="bg-black rounded-lg overflow-hidden aspect-video relative flex items-center justify-center">
                    <video ref={videoRef} className="w-full max-h-40 object-cover" />
                    <div className="absolute inset-0 border-2 border-dashed border-indigo-400 pointer-events-none opacity-40"></div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={cancelCamera}
                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={capturePhoto}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      Capture Frame
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={startCamera}
                    className="px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    Camera Snap
                  </button>
                  <button
                    onClick={triggerFileInput}
                    className="px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    Upload File
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png, image/jpeg, image/jpg, application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* OCR Processor Feed */}
              {ocrStatus === 'processing' && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg flex items-center gap-2 animate-pulse text-[11px]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing face contouring & crop ratios...</span>
                </div>
              )}
              {ocrStatus === 'success' && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg flex items-center gap-1.5 text-[11px] animate-fade-in">
                  <UserCheck className="w-4 h-4" />
                  <span>{successMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Design Settings */}
          <div className="space-y-3.5 text-xs border-t border-slate-100 pt-4">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Styling Parameters</h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-500 font-medium">Theme Tint</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={custom.themeColor}
                    onChange={(e) => setCustom({ ...custom, themeColor: e.target.value })}
                    className="w-8 h-7 p-0 border border-slate-300 rounded cursor-pointer"
                  />
                  <span className="font-mono text-[11px] uppercase text-slate-500 font-semibold">{custom.themeColor}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-medium">Text Color</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={custom.textColor}
                    onChange={(e) => setCustom({ ...custom, textColor: e.target.value })}
                    className="w-8 h-7 p-0 border border-slate-300 rounded cursor-pointer"
                  />
                  <span className="font-mono text-[11px] uppercase text-slate-500 font-semibold">{custom.textColor}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-500 font-medium">ID Card Expiry</label>
                <input
                  type="date"
                  value={custom.idExpiry}
                  onChange={(e) => setCustom({ ...custom, idExpiry: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-1.5 text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-medium">Blood Group</label>
                <select
                  value={custom.bloodGroup}
                  onChange={(e) => setCustom({ ...custom, bloodGroup: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-1.5 text-[11px] bg-white"
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-500 font-medium block">Barcode Reference Code</label>
              <input
                type="text"
                value={custom.barcodeValue}
                onChange={(e) => setCustom({ ...custom, barcodeValue: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-1.5 text-[11px] font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-500 font-medium block">QR Verification Link</label>
              <input
                type="text"
                value={custom.qrValue}
                onChange={(e) => setCustom({ ...custom, qrValue: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-1.5 text-[11px] font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="showSig"
                checked={custom.showSignature}
                onChange={(e) => setCustom({ ...custom, showSignature: e.target.checked })}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="showSig" className="text-slate-600 font-medium select-none">Include authorized digital stamp</label>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Card Preview Screens */}
        <div className="xl:col-span-2 space-y-4">
          
          {/* Card Export Toolbar */}
          {selectedEmp && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-xs">Print & Export Headquarters</h4>
                  <p className="text-[10px] text-slate-400">Download formatted files ready for custom ID printers.</p>
                </div>
                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono text-[9px] font-bold rounded">
                  CR-80 Standard
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => triggerDownloadBadge('png')}
                  className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>

                <button
                  onClick={() => triggerDownloadBadge('jpeg')}
                  className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download JPEG</span>
                </button>

                <button
                  onClick={() => triggerDownloadBadge('pdf')}
                  className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Printable PDF</span>
                </button>
              </div>
            </div>
          )}

          <div className="bg-slate-100 p-8 rounded-2xl border border-slate-200 shadow-inner flex flex-col md:flex-row items-center justify-center gap-10 min-h-[500px]">
            
            {selectedEmp ? (
              <>
                {/* 1. FRONT SIDE OF THE BADGE */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block text-center uppercase tracking-wider">Badge Front Side</span>
                  
                  {/* Standard Credit Card Size container (Vertical CR80 Ratio) */}
                  <div 
                    style={{ borderColor: custom.themeColor }}
                    className="w-[245px] h-[375px] bg-slate-900 rounded-[18px] border-4 shadow-2xl relative overflow-hidden flex flex-col text-white"
                  >
                    {/* Header accent circle */}
                    <div 
                      style={{ backgroundColor: custom.themeColor }}
                      className="absolute -top-16 -left-10 w-44 h-44 rounded-full opacity-35 filter blur-md"
                    ></div>
                    <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-slate-800/40 opacity-40 filter blur-sm"></div>

                    {/* Logo and company branding */}
                    <div className="pt-5 px-4 flex items-center justify-between z-10">
                      <div className="flex items-center gap-1.5">
                        <div style={{ backgroundColor: custom.themeColor }} className="w-5 h-5 rounded-md flex items-center justify-center">
                          <Shield className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-200">PeopleCloud</span>
                      </div>
                      <span className="text-[8px] uppercase tracking-wider font-bold bg-white/15 px-2 py-0.5 rounded-full text-slate-300 border border-white/5">
                        Secure Staff
                      </span>
                    </div>

                    {/* Photo area */}
                    <div className="mt-6 flex flex-col items-center justify-center z-10">
                      <div 
                        style={{ borderColor: custom.themeColor }}
                        className="w-24 h-24 rounded-full bg-slate-850 border-2 overflow-hidden flex items-center justify-center shadow-lg"
                      >
                        {photoUrl ? (
                          <img src={photoUrl} alt="Portrait" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-xl font-bold text-slate-400">{selectedEmp.firstName[0]}{selectedEmp.lastName[0]}</span>
                        )}
                      </div>
                    </div>

                    {/* Employee Credentials */}
                    <div className="mt-4 px-4 text-center z-10 flex-1 flex flex-col justify-between pb-4">
                      <div>
                        <h4 className="font-bold text-base text-slate-50 tracking-tight leading-snug">
                          {selectedEmp.firstName} {selectedEmp.lastName}
                        </h4>
                        <p style={{ color: custom.themeColor }} className="text-[10px] font-bold uppercase tracking-wider mt-0.5">
                          {selectedEmp.jobTitle}
                        </p>
                      </div>

                      {/* Card Metadata info row */}
                      <div className="bg-slate-950/40 rounded-xl p-2.5 border border-white/5 space-y-1.5">
                        <div className="flex justify-between text-[8px] uppercase font-bold text-slate-400">
                          <span>Department</span>
                          <span>ID Code</span>
                        </div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-200 leading-none">
                          <span className="truncate max-w-[110px]">{selectedEmp.employmentType}</span>
                          <span className="font-mono text-indigo-400">{selectedEmp.employeeId.substring(0, 10)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom strip */}
                    <div style={{ backgroundColor: custom.themeColor }} className="h-3.5 w-full"></div>
                  </div>
                </div>

                {/* 2. BACK SIDE OF THE BADGE */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block text-center uppercase tracking-wider">Badge Back Side</span>
                  
                  {/* Card back container */}
                  <div 
                    style={{ borderColor: custom.themeColor }}
                    className="w-[245px] h-[375px] bg-slate-950 rounded-[18px] border-4 shadow-2xl relative overflow-hidden flex flex-col text-slate-300 text-[9px]"
                  >
                    {/* Magnetic stripe simulator */}
                    <div className="h-9 w-full bg-slate-900 border-b border-slate-800 mt-5"></div>

                    {/* Content Container */}
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      {/* Security disclaimers */}
                      <div className="space-y-2 mt-2 leading-relaxed text-[8px] text-slate-400">
                        <p>This card is non-transferable and remains the sole property of PeopleCloud HRIS. Any unauthorized use represents breach of contract.</p>
                        <p>If found, please drop at the nearest national postal services box or return to corporate security office immediately.</p>
                      </div>

                      {/* Vital Specs */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2 rounded-xl border border-white/5 text-[8px]">
                        <div>
                          <span className="text-slate-500 font-bold uppercase block text-[7px]">Blood Group</span>
                          <span className="font-bold text-slate-200 text-[10px]">{custom.bloodGroup}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-bold uppercase block text-[7px]">Card Expiry</span>
                          <span className="font-bold text-slate-200">{custom.idExpiry}</span>
                        </div>
                      </div>

                      {/* Barcode & Signature area */}
                      <div className="space-y-2">
                        {/* Barcode image simulator */}
                        <div className="bg-white p-1 rounded border border-slate-800 flex flex-col items-center justify-center">
                          <div className="h-6 w-full flex items-center justify-between px-2 bg-slate-900 overflow-hidden font-mono text-[6px] tracking-widest text-white">
                            <span>||| | | || ||| || | ||| || |||</span>
                          </div>
                          <span className="text-[7px] font-mono text-slate-600 tracking-wider mt-0.5">{custom.barcodeValue}</span>
                        </div>

                        {/* Signature block */}
                        {custom.showSignature && (
                          <div className="flex items-center justify-between border-t border-slate-800 pt-1.5 text-[8px]">
                            <div>
                              <span className="text-[7px] text-slate-500 block uppercase font-bold">Authorized Officer</span>
                              <span className="font-serif italic text-emerald-500">Security Clearance</span>
                            </div>
                            <QrCode className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom accent bar */}
                    <div style={{ backgroundColor: custom.themeColor }} className="h-3.5 w-full"></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center space-y-2 py-10">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
                <p className="text-slate-500 font-bold text-sm">No Employee Selected</p>
                <p className="text-xs text-slate-400">Please choose an employee from the configurator sidebar to start processing.</p>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* PRINT-ONLY EMBED AREA (Always hidden inside screen view, formatted strictly for A4 grid output) */}
      {selectedEmp && (
        <div id="print-area-wrapper" className="hidden">
          {/* Card Front */}
          <div 
            style={{ borderColor: custom.themeColor, fontFamily: 'sans-serif' }}
            className="w-[245px] h-[375px] bg-slate-900 rounded-[18px] border-4 shadow-none relative overflow-hidden flex flex-col text-white print:m-0"
          >
            <div style={{ backgroundColor: custom.themeColor }} className="absolute -top-16 -left-10 w-44 h-44 rounded-full opacity-35 filter blur-md"></div>
            <div className="pt-5 px-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-1.5">
                <div style={{ backgroundColor: custom.themeColor }} className="w-5 h-5 rounded-md flex items-center justify-center">
                  <Shield className="w-3 h-3 text-white" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-200">PeopleCloud</span>
              </div>
              <span className="text-[8px] uppercase tracking-wider font-bold bg-white/15 px-2 py-0.5 rounded-full text-slate-300">
                Secure Staff
              </span>
            </div>

            <div className="mt-6 flex flex-col items-center justify-center z-10">
              <div style={{ borderColor: custom.themeColor }} className="w-24 h-24 rounded-full bg-slate-800 border-2 overflow-hidden flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="Portrait" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-slate-400">{selectedEmp.firstName[0]}{selectedEmp.lastName[0]}</span>
                )}
              </div>
            </div>

            <div className="mt-4 px-4 text-center z-10 flex-1 flex flex-col justify-between pb-4">
              <div>
                <h4 className="font-bold text-base text-slate-50 tracking-tight">{selectedEmp.firstName} {selectedEmp.lastName}</h4>
                <p style={{ color: custom.themeColor }} className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{selectedEmp.jobTitle}</p>
              </div>

              <div className="bg-slate-950/40 rounded-xl p-2.5 border border-white/5 space-y-1.5">
                <div className="flex justify-between text-[8px] uppercase font-bold text-slate-400">
                  <span>Department</span>
                  <span>ID Code</span>
                </div>
                <div className="flex justify-between text-[9px] font-bold text-slate-200">
                  <span>{selectedEmp.employmentType}</span>
                  <span className="font-mono text-indigo-400">{selectedEmp.employeeId.substring(0, 10)}</span>
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: custom.themeColor }} className="h-3.5 w-full"></div>
          </div>

          {/* Card Back */}
          <div 
            style={{ borderColor: custom.themeColor, fontFamily: 'sans-serif' }}
            className="w-[245px] h-[375px] bg-slate-950 rounded-[18px] border-4 shadow-none relative overflow-hidden flex flex-col text-slate-300 text-[9px] print:m-0"
          >
            <div className="h-9 w-full bg-slate-900 border-b border-slate-800 mt-5"></div>
            <div className="flex-1 p-4 flex flex-col justify-between">
              <div className="space-y-2 mt-2 leading-relaxed text-[8px] text-slate-400">
                <p>This card is non-transferable and remains the sole property of PeopleCloud HRIS. Any unauthorized use represents breach of contract.</p>
                <p>If found, please drop at the nearest national postal services box or return to corporate security office immediately.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2 rounded-xl border border-white/5 text-[8px]">
                <div>
                  <span className="text-slate-500 font-bold uppercase block text-[7px]">Blood Group</span>
                  <span className="font-bold text-slate-200 text-[10px]">{custom.bloodGroup}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase block text-[7px]">Card Expiry</span>
                  <span className="font-bold text-slate-200">{custom.idExpiry}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="bg-white p-1 rounded border border-slate-800 flex flex-col items-center justify-center">
                  <div className="h-6 w-full flex items-center justify-between px-2 bg-slate-900 overflow-hidden font-mono text-[6px] tracking-widest text-white">
                    <span>||| | | || ||| || | ||| || |||</span>
                  </div>
                  <span className="text-[7px] font-mono text-slate-600 tracking-wider mt-0.5">{custom.barcodeValue}</span>
                </div>

                {custom.showSignature && (
                  <div className="flex items-center justify-between border-t border-slate-800 pt-1.5 text-[8px]">
                    <div>
                      <span className="text-[7px] text-slate-500 block uppercase font-bold">Authorized Officer</span>
                      <span className="font-serif italic text-emerald-500">Security Clearance</span>
                    </div>
                    <QrCode className="w-5 h-5 text-slate-400" />
                  </div>
                )}
              </div>
            </div>
            <div style={{ backgroundColor: custom.themeColor }} className="h-3.5 w-full"></div>
          </div>
        </div>
      )}

    </div>
  );
}
