import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Download, FileUp, Link as LinkIcon, Search, ShieldCheck } from 'lucide-react';
import { db, storage } from '../firebase';
import { UserRole } from '../types';

type Props = {
  currentUser: { uid: string; email: string; displayName: string; role: UserRole; companyId: string | null };
  selectedTenantId: string;
};

type ComplianceRecord = {
  id: string;
  countryCode?: string;
  country?: string;
  currency?: string;
  period?: string;
  type?: string;
  authority?: string;
  amount?: number;
  dueDate?: string;
  status?: string;
  evidenceName?: string;
  evidenceUrl?: string;
  evidenceUploadedAt?: any;
};

type EvidenceLog = {
  id: string;
  complianceRecordId?: string;
  fileName?: string;
  fileUrl?: string;
  evidenceType?: string;
  uploadedByName?: string;
  uploadedAt?: any;
  period?: string;
  complianceType?: string;
  countryCode?: string;
};

function canManageEvidence(role: UserRole) {
  return ['SuperAdmin', 'CompanyAdmin', 'HRManager', 'FinanceOfficer', 'Auditor'].includes(role);
}

function money(value: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function ComplianceEvidenceVault({ currentUser, selectedTenantId }: Props) {
  const companyId = currentUser.companyId || selectedTenantId;
  const canManage = canManageEvidence(currentUser.role);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [logs, setLogs] = useState<EvidenceLog[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [evidenceType, setEvidenceType] = useState('Remittance Receipt');
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  async function loadData() {
    if (!companyId) return;
    try {
      const recordSnap = await getDocs(collection(db, `companies/${companyId}/global_compliance`));
      const recordRows: ComplianceRecord[] = [];
      recordSnap.forEach((item) => recordRows.push({ id: item.id, ...(item.data() as ComplianceRecord) }));
      recordRows.sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')));
      setRecords(recordRows);
      if (!selectedRecordId && recordRows.length) setSelectedRecordId(recordRows[0].id);

      const logSnap = await getDocs(collection(db, `companies/${companyId}/compliance_evidence`));
      const logRows: EvidenceLog[] = [];
      logSnap.forEach((item) => logRows.push({ id: item.id, ...(item.data() as EvidenceLog) }));
      setLogs(logRows);
    } catch (error: any) {
      setMessage(`Unable to load evidence vault: ${error.message || error}`);
    }
  }

  useEffect(() => { loadData(); }, [companyId]);

  const selectedRecord = useMemo(() => records.find((item) => item.id === selectedRecordId), [records, selectedRecordId]);
  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((item) => [item.country, item.countryCode, item.type, item.authority, item.period, item.status].join(' ').toLowerCase().includes(q));
  }, [records, query]);

  async function uploadEvidence() {
    if (!companyId || !selectedRecord || !file || !canManage) return;
    setUploading(true);
    setMessage('');
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `companies/${companyId}/compliance_evidence/${selectedRecord.id}/${Date.now()}-${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
      const url = await getDownloadURL(storageRef);
      const logData = {
        companyId,
        complianceRecordId: selectedRecord.id,
        fileName: file.name,
        fileUrl: url,
        storagePath: path,
        evidenceType,
        period: selectedRecord.period || '',
        complianceType: selectedRecord.type || '',
        countryCode: selectedRecord.countryCode || '',
        uploadedBy: currentUser.uid,
        uploadedByName: currentUser.displayName || currentUser.email,
        uploadedAt: serverTimestamp(),
      };
      const saved = await addDoc(collection(db, `companies/${companyId}/compliance_evidence`), logData);
      await updateDoc(doc(db, `companies/${companyId}/global_compliance`, selectedRecord.id), {
        evidenceName: file.name,
        evidenceUrl: url,
        evidenceType,
        evidenceUploadedAt: serverTimestamp(),
        evidenceUploadedBy: currentUser.uid,
        status: selectedRecord.status === 'Prepared' || selectedRecord.status === 'Pending' ? 'Filed' : selectedRecord.status,
      });
      setLogs((items) => [{ id: saved.id, ...logData, uploadedAt: new Date().toISOString() }, ...items]);
      setRecords((items) => items.map((item) => item.id === selectedRecord.id ? { ...item, evidenceName: file.name, evidenceUrl: url, status: item.status === 'Prepared' || item.status === 'Pending' ? 'Filed' : item.status } : item));
      setFile(null);
      setMessage('Compliance evidence uploaded and linked successfully.');
    } catch (error: any) {
      setMessage(`Unable to upload evidence: ${error.message || error}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6" id="compliance-evidence-vault">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-black">Item 5</p>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><FileUp className="w-5 h-5 text-indigo-600" />Compliance Evidence Upload</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">Upload remittance receipts, filing acknowledgements, schedules, certificates and regulatory evidence against compliance records.</p>
        </div>
        <button onClick={loadData} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">Refresh</button>
      </div>

      {message && <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs font-semibold text-indigo-800">{message}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-600" />Upload Evidence</h3>
          <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Compliance Record</label><select value={selectedRecordId} onChange={(event) => setSelectedRecordId(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white">{records.map((item) => <option key={item.id} value={item.id}>{item.period} • {item.countryCode} • {item.type}</option>)}</select></div>
          <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Evidence Type</label><select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"><option>Remittance Receipt</option><option>Filing Acknowledgement</option><option>Payment Schedule</option><option>Compliance Certificate</option><option>Regulatory Letter</option><option>Other Evidence</option></select></div>
          <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Evidence File</label><input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} disabled={!canManage} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
          <button onClick={uploadEvidence} disabled={!canManage || !file || !selectedRecord || uploading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 text-xs font-bold">{uploading ? 'Uploading...' : 'Upload & Link Evidence'}</button>
          {selectedRecord && <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-600"><p className="font-bold text-slate-900">Selected Record</p><p>{selectedRecord.countryCode} • {selectedRecord.type}</p><p>{selectedRecord.period} • {money(Number(selectedRecord.amount || 0), selectedRecord.currency)}</p><p>Status: {selectedRecord.status || 'Pending'}</p></div>}
        </div>

        <div className="xl:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between"><p className="text-xs text-slate-500">Evidence-ready compliance records</p><div className="relative min-w-72"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs" /></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Record</th><th className="text-right p-3">Amount</th><th className="text-left p-3">Evidence</th><th className="text-left p-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredRecords.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No compliance records found. Prepare compliance records first.</td></tr>}{filteredRecords.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="p-3"><p className="font-black text-slate-900">{item.period} • {item.type}</p><p className="text-[10px] text-slate-400">{item.countryCode} • {item.authority}</p></td><td className="p-3 text-right font-bold text-slate-900">{money(Number(item.amount || 0), item.currency)}</td><td className="p-3">{item.evidenceUrl ? <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 font-bold"><Download className="w-3 h-3" />{item.evidenceName || 'View evidence'}</a> : <span className="text-slate-400">No evidence</span>}</td><td className="p-3"><span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold">{item.status || 'Pending'}</span></td></tr>)}</tbody></table></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100"><h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><LinkIcon className="w-4 h-4 text-indigo-600" />Evidence Upload Log</h3></div><table className="w-full text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-3">Evidence</th><th className="text-left p-3">Record</th><th className="text-left p-3">Uploaded By</th><th className="text-left p-3">Open</th></tr></thead><tbody className="divide-y divide-slate-100">{logs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No evidence uploaded yet.</td></tr>}{logs.map((item) => <tr key={item.id}><td className="p-3"><p className="font-bold text-slate-900">{item.fileName}</p><p className="text-[10px] text-slate-400">{item.evidenceType}</p></td><td className="p-3 text-slate-600">{item.period} • {item.countryCode} • {item.complianceType}</td><td className="p-3 text-slate-600">{item.uploadedByName || 'Unknown'}</td><td className="p-3">{item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold">Open</a>}</td></tr>)}</tbody></table></div>
    </div>
  );
}
