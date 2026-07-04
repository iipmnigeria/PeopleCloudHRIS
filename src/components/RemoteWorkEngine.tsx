import React, { useState, useEffect } from 'react';
import { UserRole, Employee } from '../types';
import { 
  Wifi, 
  MapPin, 
  Clock, 
  Plus, 
  Check, 
  X, 
  Globe, 
  Activity, 
  ShieldAlert, 
  Laptop, 
  FileText, 
  Gauge,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Play
} from 'lucide-react';
import { collection, getDocs, addDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface RemoteWorkEngineProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

interface RemoteRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'Fully_Remote' | 'Hybrid' | 'Work_From_Anywhere';
  startDate: string;
  endDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  justification: string;
  homeSetupScore: number; // 1-100 rating
  createdAt: string;
}

interface CheckInRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
  ipAddress: string;
  downloadSpeed: number; // Mbps
  latency: number; // ms
  setupStatus: 'Compliant' | 'Warning' | 'Non_Compliant';
  locationName: string;
  coordinates: string;
}

export default function RemoteWorkEngine({ currentUser, selectedTenantId }: RemoteWorkEngineProps) {
  const companyId = currentUser.companyId || selectedTenantId;
  const isManager = ['CompanyAdmin', 'HRManager', 'LineManager'].includes(currentUser.role);
  const isEmployee = currentUser.role === 'Employee';

  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'presence-checkins' | 'requests-approvals' | 'compliance-speedtest'>('presence-checkins');
  const [requests, setRequests] = useState<RemoteRequest[]>([]);
  const [checkins, setCheckins] = useState<CheckInRecord[]>([]);

  // Form states for submitting new Remote Work Request
  const [reqType, setReqType] = useState<'Fully_Remote' | 'Hybrid' | 'Work_From_Anywhere'>('Fully_Remote');
  const [reqStart, setReqStart] = useState('');
  const [reqEnd, setReqEnd] = useState('');
  const [reqJustification, setReqJustification] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Interactive Speedtest Simulator States
  const [speedtestProgress, setSpeedtestProgress] = useState<number>(-1); // -1 means idle
  const [speedtestStage, setSpeedtestStage] = useState<'idle' | 'latency' | 'download' | 'upload' | 'complete'>('idle');
  const [simDownload, setSimDownload] = useState<number>(0);
  const [simLatency, setSimLatency] = useState<number>(0);
  const [simUpload, setSimUpload] = useState<number>(0);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  // Get matching employee record
  const currentEmployee = employees.find(e => e.email === currentUser.email);

  // Fetch employees, checkins, and requests from Firestore
  useEffect(() => {
    async function loadData() {
      if (!companyId) return;
      try {
        // Fetch Employees
        const empSnap = await getDocs(collection(db, `companies/${companyId}/employees`));
        const empList: Employee[] = [];
        empSnap.forEach(d => empList.push({ ...d.data() as Employee, employeeId: d.id }));
        setEmployees(empList);

        // Fetch Remote Requests (or seed some if empty)
        const reqSnap = await getDocs(collection(db, `companies/${companyId}/remoteRequests`));
        const reqList: RemoteRequest[] = [];
        reqSnap.forEach(d => reqList.push({ ...d.data() as RemoteRequest, id: d.id }));
        
        if (reqList.length === 0 && empList.length > 0) {
          // Seed standard entries for presentation
          const seeded: RemoteRequest[] = [
            {
              id: 'req-1',
              employeeId: empList[0].employeeId,
              employeeName: `${empList[0].firstName} ${empList[0].lastName}`,
              type: 'Hybrid',
              startDate: '2026-07-01',
              endDate: '2026-12-31',
              status: 'Approved',
              justification: 'Splitting time to accommodate elderly care on Thursdays and Fridays.',
              homeSetupScore: 88,
              createdAt: new Date().toISOString()
            },
            {
              id: 'req-2',
              employeeId: empList[1]?.employeeId || 'seed-2',
              employeeName: empList[1] ? `${empList[1].firstName} ${empList[1].lastName}` : 'Ademola Vance',
              type: 'Fully_Remote',
              startDate: '2026-07-15',
              endDate: '2027-01-15',
              status: 'Pending',
              justification: 'Relocating to Lagos state. Requested permanent fully remote contract.',
              homeSetupScore: 92,
              createdAt: new Date().toISOString()
            }
          ];
          for (const item of seeded) {
            await setDoc(doc(db, `companies/${companyId}/remoteRequests`, item.id), item);
          }
          setRequests(seeded);
        } else {
          setRequests(reqList);
        }

        // Fetch Check-ins (or seed some if empty)
        const checkSnap = await getDocs(collection(db, `companies/${companyId}/remoteCheckins`));
        const checkList: CheckInRecord[] = [];
        checkSnap.forEach(d => checkList.push({ ...d.data() as CheckInRecord, id: d.id }));

        if (checkList.length === 0 && empList.length > 0) {
          const seededChecks: CheckInRecord[] = [
            {
              id: 'chk-1',
              employeeId: empList[0].employeeId,
              employeeName: `${empList[0].firstName} ${empList[0].lastName}`,
              timestamp: new Date().toISOString(),
              ipAddress: '197.210.64.12',
              downloadSpeed: 45.8,
              latency: 24,
              setupStatus: 'Compliant',
              locationName: 'Lekki Phase 1, Lagos',
              coordinates: '6.4281° N, 3.4219° E'
            },
            {
              id: 'chk-2',
              employeeId: empList[1]?.employeeId || 'seed-2',
              employeeName: empList[1] ? `${empList[1].firstName} ${empList[1].lastName}` : 'Ademola Vance',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              ipAddress: '102.89.44.87',
              downloadSpeed: 12.4,
              latency: 140,
              setupStatus: 'Warning',
              locationName: 'Wuse II, Abuja',
              coordinates: '9.0765° N, 7.4854° E'
            }
          ];
          for (const item of seededChecks) {
            await setDoc(doc(db, `companies/${companyId}/remoteCheckins`, item.id), item);
          }
          setCheckins(seededChecks);
        } else {
          setCheckins(checkList);
        }
      } catch (err) {
        console.error('Error fetching Remote Work Engine records:', err);
      }
    }
    loadData();
  }, [companyId]);

  // Submit New Work Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !currentEmployee) return;

    try {
      const newReq: RemoteRequest = {
        id: `rem-${Date.now()}`,
        employeeId: currentEmployee.employeeId,
        employeeName: `${currentEmployee.firstName} ${currentEmployee.lastName}`,
        type: reqType,
        startDate: reqStart,
        endDate: reqEnd,
        status: 'Pending',
        justification: reqJustification,
        homeSetupScore: Math.floor(Math.random() * 20) + 80, // simulated home router score
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${companyId}/remoteRequests`, newReq.id), newReq);
      setRequests([newReq, ...requests]);
      setFormSuccess('Your remote work deployment proposal was submitted to Line Management.');
      setReqJustification('');
      setReqStart('');
      setReqEnd('');
      setTimeout(() => setFormSuccess(''), 5000);
    } catch (err) {
      console.error('Failed to submit remote request:', err);
    }
  };

  // Run Simulated Broadband Speedtest and Check-in Employee
  const triggerSpeedtest = () => {
    if (speedtestProgress !== -1) return; // already running
    setSpeedtestProgress(0);
    setSpeedtestStage('latency');

    // Interval to count progress and simulate numbers
    const interval = setInterval(() => {
      setSpeedtestProgress(prev => {
        const next = prev + 5;
        if (next >= 100) {
          clearInterval(interval);
          setSpeedtestStage('complete');
          commitCheckIn();
          return 100;
        }

        // Change stages based on progress
        if (next < 30) {
          setSpeedtestStage('latency');
          setSimLatency(Math.floor(Math.random() * 15) + 12);
        } else if (next >= 30 && next < 70) {
          setSpeedtestStage('download');
          setSimDownload(Math.round((Math.random() * 30 + 40) * 10) / 10);
        } else {
          setSpeedtestStage('upload');
          setSimUpload(Math.round((Math.random() * 15 + 10) * 10) / 10);
        }

        return next;
      });
    }, 150);
  };

  const commitCheckIn = async () => {
    if (!companyId || !currentEmployee) return;

    try {
      const chkId = `chk-${Date.now()}`;
      const speed = Math.round((Math.random() * 30 + 40) * 10) / 10;
      const latency = Math.floor(Math.random() * 15) + 12;
      const status = speed >= 30 ? 'Compliant' : 'Warning';

      const checkInObj: CheckInRecord = {
        id: chkId,
        employeeId: currentEmployee.employeeId,
        employeeName: `${currentEmployee.firstName} ${currentEmployee.lastName}`,
        timestamp: new Date().toISOString(),
        ipAddress: '197.210.8.' + Math.floor(Math.random() * 254 + 1),
        downloadSpeed: speed,
        latency,
        setupStatus: status,
        locationName: 'Home Network Workspace, Lagos',
        coordinates: '6.5244° N, 3.3792° E'
      };

      await setDoc(doc(db, `companies/${companyId}/remoteCheckins`, chkId), checkInObj);
      setCheckins([checkInObj, ...checkins]);
      setHasCheckedInToday(true);
    } catch (err) {
      console.error('Failed to commit remote checkin:', err);
    }
  };

  // Handle Request Approval
  const handleReviewRequest = async (reqId: string, action: 'Approved' | 'Rejected') => {
    try {
      const docRef = doc(db, `companies/${companyId}/remoteRequests`, reqId);
      await updateDoc(docRef, { status: action });
      setRequests(requests.map(r => r.id === reqId ? { ...r, status: action } : r));
    } catch (err) {
      console.error('Failed to update request status:', err);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up" id="remote-work-management-engine">
      
      {/* Header Panel */}
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900">Distributed Remote Work Engine</h2>
        <p className="text-xs text-slate-500">Track geo-presence logins, assess remote workspace network bandwidth requirements, and process corporate digital workplace hybrid requests.</p>
      </div>

      {/* Internal Navigation tabs */}
      <div className="border-b border-slate-200 flex space-x-4">
        <button
          onClick={() => setActiveTab('presence-checkins')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeTab === 'presence-checkins' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Geo Presence Check-Ins
        </button>
        <button
          onClick={() => setActiveTab('compliance-speedtest')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeTab === 'compliance-speedtest' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Workstation Compliance Checker
        </button>
        <button
          onClick={() => setActiveTab('requests-approvals')}
          className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all ${
            activeTab === 'requests-approvals' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Remote Hybrid Requests
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Controls or form */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Daily Status Panel */}
          {activeTab === 'presence-checkins' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                Remote Office Clock-In
              </h3>

              {isEmployee ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center space-y-2">
                    <MapPin className="w-6 h-6 text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-800">Biometric Location Tracking Active</p>
                    <p className="text-[10px] text-slate-500">Every check-in triggers system verification of IP addresses and secures connection speed thresholds.</p>
                  </div>

                  {hasCheckedInToday ? (
                    <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 text-[11px] font-bold text-center flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" />
                      Checked-In Securely For Today!
                    </div>
                  ) : (
                    <button
                      onClick={triggerSpeedtest}
                      disabled={speedtestProgress !== -1 && speedtestProgress < 100}
                      className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                    >
                      <Wifi className="w-4 h-4" />
                      <span>Verify Connection & Clock In</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500 leading-relaxed">
                  <p>You are viewing this panel in Manager Mode. Employee clock-in buttons are disabled for administrative personnel.</p>
                </div>
              )}
            </div>
          )}

          {/* compliance speedtest simulator */}
          {activeTab === 'compliance-speedtest' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <Gauge className="w-4 h-4 text-indigo-600" />
                Home Router Speedtest
              </h3>

              <div className="space-y-4 text-xs">
                <p className="text-slate-500">Conduct a high-precision corporate network diagnostic to assure compliance with SLA remote requirements.</p>
                
                {/* Speedtest Dial simulator */}
                <div className="border border-slate-150 bg-slate-950 text-white rounded-xl p-5 text-center space-y-4 relative overflow-hidden">
                  
                  {/* Progress Line */}
                  {speedtestProgress !== -1 && speedtestProgress < 100 && (
                    <div className="absolute top-0 left-0 h-1 bg-brand-500 transition-all duration-150" style={{ width: `${speedtestProgress}%` }}></div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Current Phase</span>
                    <h4 className="font-bold text-xs font-mono text-indigo-400 capitalize">{speedtestStage}</h4>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-4 text-center">
                    <div>
                      <span className="text-[8px] text-slate-400 font-mono block">PING</span>
                      <span className="text-sm font-bold font-mono text-slate-100">{simLatency || '-'} <span className="text-[8px] text-slate-500 font-medium">ms</span></span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-mono block">DOWNLOAD</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">{simDownload || '-'} <span className="text-[8px] text-slate-500 font-medium">Mbps</span></span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-mono block">UPLOAD</span>
                      <span className="text-sm font-bold font-mono text-sky-400">{simUpload || '-'} <span className="text-[8px] text-slate-500 font-medium">Mbps</span></span>
                    </div>
                  </div>

                  {speedtestStage === 'complete' && (
                    <div className="p-2 bg-emerald-950/50 border border-emerald-900 text-emerald-400 rounded text-[10px] font-mono">
                      ● WORKSPACE NET Compliant (&gt;30 Mbps verified)
                    </div>
                  )}

                  <button
                    onClick={triggerSpeedtest}
                    disabled={speedtestProgress !== -1 && speedtestProgress < 100}
                    className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase cursor-pointer"
                  >
                    {speedtestProgress === -1 ? 'Launch Test' : speedtestProgress < 100 ? 'Testing...' : 'Rerun Diagnostics'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New Request Form */}
          {activeTab === 'requests-approvals' && isEmployee && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <Laptop className="w-4 h-4 text-indigo-600" />
                Submit Deployment Proposal
              </h3>

              {formSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 text-[11px] animate-fade-in">
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs text-slate-600">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Arrangement Category</label>
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value as any)}
                    className="w-full border border-slate-200 bg-white rounded-lg p-2 focus:outline-none"
                  >
                    <option value="Fully_Remote">Permanent Fully Remote</option>
                    <option value="Hybrid">Hybrid Office / Home split</option>
                    <option value="Work_From_Anywhere">Work from Anywhere (Out of country)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Start Date</label>
                    <input
                      type="date"
                      required
                      value={reqStart}
                      onChange={(e) => setReqStart(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-1.5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">End Date</label>
                    <input
                      type="date"
                      required
                      value={reqEnd}
                      onChange={(e) => setReqEnd(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-1.5"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Strategic Justification</label>
                  <textarea
                    required
                    rows={4}
                    value={reqJustification}
                    onChange={(e) => setReqJustification(e.target.value)}
                    placeholder="Provide description of domestic workstations and work schedules..."
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Send Request
                </button>
              </form>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Ledger of checkins or requests */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Tab 1 content: Geolocation Checkin log */}
          {activeTab === 'presence-checkins' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 pb-2.5 border-b border-slate-100">
                <Globe className="w-4 h-4 text-brand-600" />
                Geo-Presence Presence Registers
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-150">
                      <th className="px-4 py-3">Employee Name</th>
                      <th className="px-4 py-3">Checked In</th>
                      <th className="px-4 py-3">IP Address</th>
                      <th className="px-4 py-3">Broadband Speed</th>
                      <th className="px-4 py-3">Location Coordinates</th>
                      <th className="px-4 py-3 text-right">SLA SLA status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {checkins.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium">No checkins registered today.</td>
                      </tr>
                    ) : (
                      checkins.map((chk) => (
                        <tr key={chk.id} className="hover:bg-slate-50/30">
                          <td className="px-4 py-3.5 font-bold text-slate-900">{chk.employeeName}</td>
                          <td className="px-4 py-3.5 font-medium text-slate-500">{new Date(chk.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3.5 font-mono text-[10px] text-slate-400">{chk.ipAddress}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-800">{chk.downloadSpeed} Mbps <span className="text-[9px] text-slate-400">({chk.latency}ms)</span></td>
                          <td className="px-4 py-3.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{chk.locationName}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                              chk.setupStatus === 'Compliant' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-amber-50 border border-amber-100 text-amber-700'
                            }`}>
                              {chk.setupStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2 content: Speedtest Compliance matrix */}
          {activeTab === 'compliance-speedtest' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 pb-2.5 border-b border-slate-100">
                <Activity className="w-4 h-4 text-indigo-600" />
                Workforce Workstation Compliance Registry
              </h3>

              <div className="space-y-3">
                {checkins.map((chk) => (
                  <div key={chk.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center font-bold text-slate-600">
                        {chk.employeeName[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-950 text-xs">{chk.employeeName}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">IP Router: {chk.ipAddress} • {chk.locationName}</p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-center">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Latency SLA</span>
                        <span className="font-mono text-slate-700 font-bold">{chk.latency} ms</span>
                      </div>
                      <div className="text-right border-l border-slate-200 pl-4">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Bandwidth</span>
                        <span className="font-mono text-emerald-600 font-bold">{chk.downloadSpeed} Mbps</span>
                      </div>
                      <div className="border-l border-slate-200 pl-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                          chk.setupStatus === 'Compliant' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-rose-50 border border-rose-100 text-rose-700'
                        }`}>
                          {chk.setupStatus === 'Compliant' ? 'SECURE_PASS' : 'WARNING'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Request List */}
          {activeTab === 'requests-approvals' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 pb-2.5 border-b border-slate-100">
                <FileText className="w-4 h-4 text-brand-600" />
                Remote Hybrid Approvals Panel
              </h3>

              <div className="space-y-4">
                {requests.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-4 text-center">No outstanding request logs.</p>
                ) : (
                  requests.map((req) => (
                    <div key={req.id} className="p-4 bg-white rounded-xl border border-slate-200 space-y-3.5 hover:border-slate-300 transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-mono font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded mr-1.5 uppercase">
                            {req.type.replace('_', ' ')}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{req.employeeName}</span>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          req.status === 'Approved' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' :
                          req.status === 'Rejected' ? 'bg-rose-50 border border-rose-100 text-rose-700' :
                          'bg-amber-50 border border-amber-100 text-amber-700'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-150 leading-relaxed italic">
                        "{req.justification}"
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
                        <span>Period: <strong>{req.startDate}</strong> to <strong>{req.endDate}</strong></span>
                        
                        {isManager && req.status === 'Pending' && (
                          <div className="flex space-x-1.5">
                            <button
                              onClick={() => handleReviewRequest(req.id, 'Rejected')}
                              className="px-2.5 py-1 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                            <button
                              onClick={() => handleReviewRequest(req.id, 'Approved')}
                              className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Check className="w-3 h-3" /> Approve & Sign
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
