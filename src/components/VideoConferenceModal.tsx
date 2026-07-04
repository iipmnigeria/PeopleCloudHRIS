import React from 'react';
import { X, Video, Shield } from 'lucide-react';

interface VideoConferenceModalProps {
  roomName: string;
  subject: string;
  onClose: () => void;
}

export default function VideoConferenceModal({ roomName, subject, onClose }: VideoConferenceModalProps) {
  // Generate Jitsi url
  const cleanRoomName = roomName.replace(/[^a-zA-Z0-9]/g, '');
  const jitsiUrl = `https://meet.jit.si/${cleanRoomName}#config.prejoinPageEnabled=false&userInfo.displayName=PeopleCloudUser`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs" onClick={onClose}></div>
      
      {/* Content Container */}
      <div className="bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden relative z-10">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
              <Video className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">{subject}</h3>
              <p className="text-[10px] text-slate-400 font-mono">Secure Room ID: {cleanRoomName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900/50 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              Live Call Connected
            </span>
            <button 
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Call Frame */}
        <div className="flex-1 bg-slate-900 relative">
          <iframe 
            src={jitsiUrl}
            className="w-full h-full border-0"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
          ></iframe>
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-850 text-[10px] text-slate-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>End-to-end encrypted peer connection via Jitsi Meet Secure Bridge.</span>
          </div>
          <span>No plugins required. Works directly inside PeopleCloud HRIS.</span>
        </div>
      </div>
    </div>
  );
}
