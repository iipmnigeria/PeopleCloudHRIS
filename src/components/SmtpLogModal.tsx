import React, { useState } from 'react';
import { X, Mail, Shield, Server, Terminal, Check, RefreshCw } from 'lucide-react';
import { EmailPayload } from '../emailService';

interface SmtpLogModalProps {
  email: EmailPayload;
  onClose: () => void;
}

export default function SmtpLogModal({ email, onClose }: SmtpLogModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'handshake'>('preview');

  // Simulated SMTP timestamps relative to email trigger
  const triggerTime = new Date(email.timestamp).getTime();
  const formatSmtpTime = (offsetMs: number) => {
    return new Date(triggerTime + offsetMs).toISOString().substring(11, 23);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs" onClick={onClose}></div>

      {/* Main Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden relative z-10 animate-scale-up">
        
        {/* Header */}
        <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">SMTP Outbox Transaction</h3>
              <p className="text-[10px] text-slate-400 font-mono">ID: {email.id} • Status: {email.status.toUpperCase()}</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-2 flex space-x-3 text-xs">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Email Preview
          </button>
          <button
            onClick={() => setActiveTab('handshake')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'handshake' ? 'bg-slate-800 text-brand-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            SMTP Handshake Logs
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
          
          {activeTab === 'preview' && (
            <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
              
              {/* Envelope details */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs text-slate-600 shadow-2xs">
                <div className="grid grid-cols-6 border-b border-slate-100 pb-2">
                  <span className="col-span-1 font-bold text-slate-400 uppercase tracking-wider text-[10px]">From:</span>
                  <span className="col-span-5 font-mono text-slate-800 font-semibold">{email.from}</span>
                </div>
                <div className="grid grid-cols-6 border-b border-slate-100 pb-2 pt-1">
                  <span className="col-span-1 font-bold text-slate-400 uppercase tracking-wider text-[10px]">To:</span>
                  <span className="col-span-5 font-mono text-slate-800 font-semibold">{email.to}</span>
                </div>
                <div className="grid grid-cols-6 pb-1 pt-1">
                  <span className="col-span-1 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Subject:</span>
                  <span className="col-span-5 font-bold text-slate-900">{email.subject}</span>
                </div>
              </div>

              {/* Render HTML markup in a secure sandbox frame */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-y-auto scrollbar-subtle">
                <div 
                  className="w-full h-full text-slate-800"
                  dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                />
              </div>

            </div>
          )}

          {activeTab === 'handshake' && (
            <div className="flex-1 bg-slate-950 font-mono text-slate-300 text-xs p-5 overflow-y-auto scrollbar-subtle space-y-2 select-text selection:bg-brand-800 selection:text-white">
              
              <div className="text-slate-500 text-[10px] pb-2 border-b border-slate-900 uppercase font-bold tracking-wider">
                Console output: mail.peoplecloudhris.com:587
              </div>

              <div className="space-y-1.5 leading-relaxed text-[11px]">
                <p className="text-slate-500">[{formatSmtpTime(0)}] <span className="text-slate-400">{"-> RESOLVING MX RECORD FOR DOMAIN"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(120)}] <span className="text-slate-400">{"-> CONNECTED TO mail.peoplecloudhris.com:587 (IP: 142.250.102.26)"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(240)}] <span className="text-indigo-400">{"<- 220 ESMTP Postfix (Ubuntu)"}</span></p>
                
                <p className="text-slate-500">[{formatSmtpTime(350)}] <span className="text-emerald-400">{"-> EHLO secure-relayer.local"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(470)}] <span className="text-indigo-400">{"<- 250-mail.peoplecloudhris.com, PIPELINING, SIZE 10485760, STARTTLS"}</span></p>
                
                <p className="text-slate-500">[{formatSmtpTime(590)}] <span className="text-emerald-400">{"-> STARTTLS"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(710)}] <span className="text-indigo-400">{"<- 220 2.0.0 Ready to start TLS"}</span></p>
                
                <p className="text-sky-400 font-semibold">[{formatSmtpTime(850)}] {"[SECURE SESSION INITIATED: TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384, 256 BIT KEY]"}</p>
                
                <p className="text-slate-500">[{formatSmtpTime(950)}] <span className="text-emerald-400">{"-> AUTH LOGIN"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(1040)}] <span className="text-indigo-400">{"<- 334 VXNlcm5hbWU6 (Base64 Username Challenge)"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(1120)}] <span className="text-emerald-400">{"-> cGVvcGxlY2xvdWRfYXBp (Username response)"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(1210)}] <span className="text-indigo-400">{"<- 334 UGFzc3dvcmQ6 (Base64 Password Challenge)"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(1290)}] <span className="text-emerald-400">{"-> ********** (Encrypted authentication credential)"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(1380)}] <span className="text-indigo-400">{"<- 235 2.7.0 Authentication successful"}</span></p>
                
                <p className="text-slate-500">[{formatSmtpTime(1450)}] <span className="text-emerald-400">{"-> MAIL FROM:<"}{email.from}{">"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(1520)}] <span className="text-indigo-400">{"<- 250 2.1.0 Ok"}</span></p>
                
                <p className="text-slate-500">[{formatSmtpTime(1600)}] <span className="text-emerald-400">{"-> RCPT TO:<"}{email.to}{">"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(1680)}] <span className="text-indigo-400">{"<- 250 2.1.5 Ok"}</span></p>
                
                <p className="text-slate-500">[{formatSmtpTime(1750)}] <span className="text-emerald-400">{"-> DATA"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(1830)}] <span className="text-indigo-400">{"<- 354 End data with <CR><LF>.<CR><LF>"}</span></p>
                
                <p className="text-slate-400 font-mono">[{formatSmtpTime(1900)}] {"-> MIME-Version: 1.0"}</p>
                <p className="text-slate-400 font-mono">[{formatSmtpTime(1900)}] {"-> Subject: "}{email.subject}</p>
                <p className="text-slate-400 font-mono">[{formatSmtpTime(1900)}] {"-> Content-Type: text/html; charset=UTF-8"}</p>
                <p className="text-slate-500">[{formatSmtpTime(1980)}] <span className="text-emerald-400">{"-> [Transmitting "}{email.bodyHtml.length}{" bytes MIME content...]"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(2050)}] <span className="text-emerald-400">{"-> ."}</span></p>
                
                <p className="text-emerald-400 font-bold">[{formatSmtpTime(2150)}] {"<- 250 2.0.0 Ok: queued as "}{email.id}{" (Delivered successfully to destination relays)"}</p>
                
                <p className="text-slate-500">[{formatSmtpTime(2200)}] <span className="text-emerald-400">{"-> QUIT"}</span></p>
                <p className="text-slate-500">[{formatSmtpTime(2280)}] <span className="text-indigo-400">{"<- 221 2.0.0 Bye (SMTP Connection Closed)"}</span></p>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-slate-700">Audit Footprint Archived</span>
          </div>
          <span>Acme corporate SMTP outbound mail system connection successful.</span>
        </div>

      </div>
    </div>
  );
}
