import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Plus, 
  Users, 
  Compass, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Layers, 
  Megaphone,
  Radio,
  FileText,
  Clock,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

interface GoogleChatProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    companyId: string | null;
  };
  selectedTenantId: string;
}

interface ChatSpace {
  name: string;
  displayName: string;
  spaceType: 'SPACE' | 'DIRECT_MESSAGE' | string;
}

interface ChatMessage {
  name: string;
  text: string;
  sender: {
    displayName: string;
    email?: string;
  };
  createTime: string;
}

export default function GoogleChat({ currentUser, selectedTenantId }: GoogleChatProps) {
  // OAuth state
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return sessionStorage.getItem('google_chat_access_token');
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // App data state
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ChatSpace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  
  // UI Panels state
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!accessToken);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmailOrId, setMemberEmailOrId] = useState('');

  // HR Broadcast states
  const [broadcastTemplate, setBroadcastTemplate] = useState('welcome');
  const [broadcastVarName, setBroadcastVarName] = useState('New Hire');
  const [broadcastVarDept, setBroadcastVarDept] = useState('Engineering');
  const [broadcastCustomText, setBroadcastCustomText] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Demo Initial Mock Data
  const [demoSpaces, setDemoSpaces] = useState<ChatSpace[]>([
    { name: 'spaces/demo-hr-general', displayName: '📣 People & HR General', spaceType: 'SPACE' },
    { name: 'spaces/demo-onboarding', displayName: '🚀 Global Employee Onboarding', spaceType: 'SPACE' },
    { name: 'spaces/demo-leadership', displayName: '👥 Leadership & Strategy', spaceType: 'SPACE' },
    { name: 'spaces/demo-direct', displayName: '💬 Jane Doe (HR Coordinator)', spaceType: 'DIRECT_MESSAGE' },
  ]);

  const [demoMessages, setDemoMessages] = useState<Record<string, ChatMessage[]>>({
    'spaces/demo-hr-general': [
      {
        name: 'spaces/demo-hr-general/messages/1',
        text: 'Welcome everyone to PeopleCloud HR announcements space! 🌟 All general announcements will be posted here.',
        sender: { displayName: 'System Administrator' },
        createTime: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
      },
      {
        name: 'spaces/demo-hr-general/messages/2',
        text: 'Reminder: The payroll cutoff for this month is Friday at 5:00 PM. Please ensure your timesheets are locked.',
        sender: { displayName: 'Finance Officer' },
        createTime: new Date(Date.now() - 3600000 * 5).toISOString()
      },
    ],
    'spaces/demo-onboarding': [
      {
        name: 'spaces/demo-onboarding/messages/1',
        text: 'Hi Team, let’s welcome Jane Doe to the Engineering department today! Jane joins us as a Senior Software Engineer.',
        sender: { displayName: 'HR Manager' },
        createTime: new Date(Date.now() - 3600000 * 10).toISOString()
      },
      {
        name: 'spaces/demo-onboarding/messages/2',
        text: 'Welcome Jane! Happy to have you on board! 🎉',
        sender: { displayName: 'Line Manager' },
        createTime: new Date(Date.now() - 3600000 * 8).toISOString()
      }
    ],
    'spaces/demo-leadership': [
      {
        name: 'spaces/demo-leadership/messages/1',
        text: 'Q3 hiring targets have been uploaded to the HR dashboard. Let’s review them in our sync tomorrow.',
        sender: { displayName: 'Company Admin' },
        createTime: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ],
    'spaces/demo-direct': [
      {
        name: 'spaces/demo-direct/messages/1',
        text: 'Hello, do you have a copy of the updated medical insurance brochure?',
        sender: { displayName: 'Jane Doe (HR Coordinator)' },
        createTime: new Date(Date.now() - 3600000 * 24).toISOString()
      }
    ]
  });

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedSpace]);

  // Load real Google Chat spaces if connected
  useEffect(() => {
    if (accessToken && !isDemoMode) {
      fetchSpaces();
    } else {
      // In demo mode, load first demo space
      if (demoSpaces.length > 0) {
        setSelectedSpace(demoSpaces[0]);
        setMessages(demoMessages[demoSpaces[0].name] || []);
      }
    }
  }, [accessToken, isDemoMode]);

  // Sync messages on space change
  useEffect(() => {
    if (selectedSpace) {
      if (isDemoMode) {
        setMessages(demoMessages[selectedSpace.name] || []);
      } else {
        fetchMessages(selectedSpace.name);
      }
    }
  }, [selectedSpace]);

  // Google OAuth flow initiation
  const handleConnectGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add required chat scopes
      provider.addScope('https://www.googleapis.com/auth/chat.spaces');
      provider.addScope('https://www.googleapis.com/auth/chat.messages');
      provider.addScope('https://www.googleapis.com/auth/chat.memberships');
      provider.addScope('https://www.googleapis.com/auth/chat.users.spacesettings');

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (!credential?.accessToken) {
        throw new Error('Could not acquire OAuth access token from login provider.');
      }

      const token = credential.accessToken;
      setAccessToken(token);
      sessionStorage.setItem('google_chat_access_token', token);
      setIsDemoMode(false);
      setSuccessMsg('Successfully authenticated Google Workspace Chat integration!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(`Auth failed: ${err.message || err}. Reverted to demo mode.`);
      setIsDemoMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    setAccessToken(null);
    sessionStorage.removeItem('google_chat_access_token');
    setIsDemoMode(true);
    setSpaces([]);
    setSelectedSpace(demoSpaces[0]);
    setMessages(demoMessages[demoSpaces[0].name] || []);
    setSuccessMsg('Disconnected Google Workspace account.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Google Chat API - Fetch Spaces
  const fetchSpaces = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API Error ${res.status}: ${errText}`);
      }
      const data = await res.json();
      if (data.spaces && data.spaces.length > 0) {
        setSpaces(data.spaces);
        setSelectedSpace(data.spaces[0]);
      } else {
        setSpaces([]);
        setSelectedSpace(null);
      }
    } catch (err: any) {
      console.error('Fetch spaces error:', err);
      setError(`Google Chat API failed to fetch spaces. This usually happens if Google Chat API is not enabled on your GCP project yet. Showing Sandbox Demo mode.`);
      setIsDemoMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Google Chat API - Fetch Messages
  const fetchMessages = async (spaceName: string) => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to load messages: ${res.statusText}`);
      }
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err: any) {
      console.error('Fetch messages error:', err);
      setError(`Failed to retrieve messages from space: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Google Chat API - Send Message (Requires confirmation according to Workspace guidelines)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedSpace) return;

    if (isDemoMode) {
      // Direct post in demo simulator
      const newMsg: ChatMessage = {
        name: `${selectedSpace.name}/messages/mock-${Math.random()}`,
        text: newMessageText,
        sender: { displayName: currentUser.displayName },
        createTime: new Date().toISOString()
      };

      const updatedMsgs = [...messages, newMsg];
      setMessages(updatedMsgs);
      setDemoMessages(prev => ({
        ...prev,
        [selectedSpace.name]: updatedMsgs
      }));
      setNewMessageText('');
      return;
    }

    // Explicit confirmation for non-demo write operations (Workspace Guideline)
    const confirmed = window.confirm(`Send this message to the Google Chat space "${selectedSpace.displayName}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`https://chat.googleapis.com/v1/${selectedSpace.name}/messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: newMessageText })
      });

      if (!res.ok) {
        throw new Error(`Failed to send message: ${res.statusText}`);
      }

      setNewMessageText('');
      fetchMessages(selectedSpace.name);
    } catch (err: any) {
      console.error('Send message error:', err);
      setError(`Failed to send message: ${err.message}`);
    }
  };

  // Google Chat API - Create Space (Requires confirmation according to Workspace guidelines)
  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    if (isDemoMode) {
      const newSpace: ChatSpace = {
        name: `spaces/demo-custom-${Date.now()}`,
        displayName: `📣 ${newSpaceName}`,
        spaceType: 'SPACE'
      };
      setDemoSpaces(prev => [...prev, newSpace]);
      setDemoMessages(prev => ({ ...prev, [newSpace.name]: [] }));
      setSelectedSpace(newSpace);
      setNewSpaceName('');
      setShowCreateSpace(false);
      setSuccessMsg(`Created mock space "${newSpaceName}" in sandbox!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }

    const confirmed = window.confirm(`Create a new Google Chat space named "${newSpaceName}"?`);
    if (!confirmed) return;

    try {
      setIsLoading(true);
      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spaceType: 'SPACE',
          displayName: newSpaceName
        })
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`API Error ${res.status}: ${detail}`);
      }

      setNewSpaceName('');
      setShowCreateSpace(false);
      setSuccessMsg('Successfully created a new Google Chat space!');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchSpaces();
    } catch (err: any) {
      console.error('Create space error:', err);
      setError(`Failed to create Google Chat space: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Google Chat API - Add Space Membership (Requires confirmation according to Workspace guidelines)
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmailOrId.trim() || !selectedSpace) return;

    if (isDemoMode) {
      const onboardMsg: ChatMessage = {
        name: `${selectedSpace.name}/messages/mock-join-${Math.random()}`,
        text: `➕ Added member (${memberEmailOrId}) to the space!`,
        sender: { displayName: 'System Administrator' },
        createTime: new Date().toISOString()
      };
      const updatedMsgs = [...messages, onboardMsg];
      setMessages(updatedMsgs);
      setDemoMessages(prev => ({
        ...prev,
        [selectedSpace.name]: updatedMsgs
      }));
      setMemberEmailOrId('');
      setShowAddMember(false);
      setSuccessMsg(`Onboarded/Invited ${memberEmailOrId} to the space in sandbox!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }

    const confirmed = window.confirm(`Invite/Add "${memberEmailOrId}" as a member of the Google Chat space "${selectedSpace.displayName}"?`);
    if (!confirmed) return;

    try {
      setIsLoading(true);
      const res = await fetch(`https://chat.googleapis.com/v1/${selectedSpace.name}/memberships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member: {
            name: `users/${memberEmailOrId}`,
            type: 'HUMAN'
          }
        })
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`API Error ${res.status}: ${detail}`);
      }

      setMemberEmailOrId('');
      setShowAddMember(false);
      setSuccessMsg('Successfully added member to Google Chat space!');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchMessages(selectedSpace.name);
    } catch (err: any) {
      console.error('Add membership error:', err);
      setError(`Failed to add member to space: ${err.message}. (Note: Google Chat API might require Enterprise organization memberships for this request).`);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger HR Broadcast (Pre-crafted template messages for instant broadcast)
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpace) return;

    let text = '';
    if (broadcastTemplate === 'welcome') {
      text = `🎉 TEAM ANNOUNCEMENT 🎉\n\nWe are absolutely thrilled to welcome ${broadcastVarName} to the ${broadcastVarDept} team! Please reach out, connect, and make them feel at home! Let’s win together. 🚀`;
    } else if (broadcastTemplate === 'onboarding') {
      text = `🚀 ONBOARDING ALERT 🚀\n\nHello Team, we have set up the onboarding schedule for ${broadcastVarName}. Please review your calendar slots for the training sessions and join us in greeting our new colleague!`;
    } else {
      text = broadcastCustomText || '📢 PeopleCloud HR Broadcast update!';
    }

    if (isDemoMode) {
      const newMsg: ChatMessage = {
        name: `${selectedSpace.name}/messages/broadcast-${Math.random()}`,
        text: text,
        sender: { displayName: `HR Manager (${currentUser.displayName})` },
        createTime: new Date().toISOString()
      };
      const updatedMsgs = [...messages, newMsg];
      setMessages(updatedMsgs);
      setDemoMessages(prev => ({
        ...prev,
        [selectedSpace.name]: updatedMsgs
      }));
      setSuccessMsg('Broadcast announcement posted successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
      setBroadcastCustomText('');
      return;
    }

    // Real broadcast write operation
    const confirmed = window.confirm(`Broadcast HR announcement to the Google Chat space "${selectedSpace.displayName}"?`);
    if (!confirmed) return;

    setNewMessageText(text);
    // Submit using standard chat sender
    setTimeout(async () => {
      try {
        const res = await fetch(`https://chat.googleapis.com/v1/${selectedSpace.name}/messages`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error(res.statusText);
        setNewMessageText('');
        setBroadcastCustomText('');
        setSuccessMsg('Broadcast announcement posted successfully to Google Workspace Chat!');
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchMessages(selectedSpace.name);
      } catch (err: any) {
        setError(`Broadcast failed: ${err.message}`);
      }
    }, 100);
  };

  return (
    <div className="space-y-6" id="google-chat-module">
      
      {/* Header and Toggle Panel */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <MessageSquare className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900 font-display">Google Chat Workspace</h1>
              {isDemoMode ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 gap-1 animate-pulse">
                  <Radio className="w-3 h-3 text-amber-600" />
                  Sandbox Demo Mode
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Connected to Google
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xl">
              Connect your official Google Workspace to directly browse Chat Spaces, onboard/add employees to spaces, and broadcast high-priority HR announcements directly to Google Chat.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isDemoMode && accessToken && (
              <button
                onClick={() => setIsDemoMode(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                Go to Active Connection
              </button>
            )}
            
            {accessToken ? (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Disconnect API
              </button>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4" />
                    Connect Google Workspace
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Notifications and messages */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-150 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div className="text-xs text-rose-800">
              <span className="font-semibold block mb-0.5">Integration Status Notification</span>
              {error}
              {isDemoMode && (
                <span className="block mt-1.5 font-medium text-slate-600">
                  💡 We have successfully initialized the <b>Sandbox Demo Mode</b> below. You can fully test listing spaces, adding members, sending announcements, and testing workflow simulations.
                </span>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-150 flex items-center gap-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Spaces listing & operations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-[520px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">Google Chat Spaces</span>
              </div>
              <button 
                onClick={() => setShowCreateSpace(!showCreateSpace)}
                className="p-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 cursor-pointer transition-colors"
                title="Create a new Space"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Create Space Inline Form */}
            {showCreateSpace && (
              <form onSubmit={handleCreateSpace} className="p-3 bg-indigo-50/50 border-b border-indigo-100 animate-slide-down">
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">New Space Name</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    placeholder="e.g. general-hr-team"
                    className="flex-1 bg-white border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                  <button 
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* Space List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {isDemoMode ? (
                demoSpaces.map((space) => (
                  <button
                    key={space.name}
                    onClick={() => setSelectedSpace(space)}
                    className={`w-full text-left p-4 flex items-center justify-between transition-colors cursor-pointer ${
                      selectedSpace?.name === space.name 
                        ? 'bg-indigo-50/60 border-l-4 border-indigo-600' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate">{space.displayName}</span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{space.spaceType}</span>
                    </div>
                    {space.spaceType === 'DIRECT_MESSAGE' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </button>
                ))
              ) : spaces.length > 0 ? (
                spaces.map((space) => (
                  <button
                    key={space.name}
                    onClick={() => setSelectedSpace(space)}
                    className={`w-full text-left p-4 flex items-center justify-between transition-colors cursor-pointer ${
                      selectedSpace?.name === space.name 
                        ? 'bg-indigo-50/60 border-l-4 border-indigo-600' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate">{space.displayName || space.name.replace('spaces/', '')}</span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{space.spaceType}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Compass className="w-8 h-8 mx-auto mb-2 opacity-55" />
                  No active spaces found. Create one above to get started.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Active Chat conversation */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-[520px]">
            {/* Chat header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-800 truncate">
                  {selectedSpace ? (selectedSpace.displayName || selectedSpace.name) : 'No Space Selected'}
                </h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {selectedSpace ? `Active Chat: ${selectedSpace.name}` : 'Select a space on the left to review chat activities'}
                </span>
              </div>
              
              {selectedSpace && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer shadow-sm transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                  Add Member
                </button>
              )}
            </div>

            {/* Add Member Inline form */}
            {showAddMember && selectedSpace && (
              <form onSubmit={handleAddMember} className="p-3.5 bg-indigo-50/40 border-b border-indigo-100 animate-slide-down">
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Add Workspace Employee (Email or ID)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={memberEmailOrId}
                    onChange={(e) => setMemberEmailOrId(e.target.value)}
                    placeholder="e.g. employee@company.com"
                    className="flex-1 bg-white border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                  <button 
                    type="submit"
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Add to Space
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Note: Adds a human collaborator profile to the Google Workspace Space.</p>
              </form>
            )}

            {/* Message streams */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <div key={msg.name} className="flex flex-col space-y-1 max-w-[85%]">
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm relative group">
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      
                      {/* Meta */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold text-indigo-600">{msg.sender.displayName}</span>
                        <span className="text-[9px] text-slate-400 font-medium">
                          {new Date(msg.createTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <MessageSquare className="w-10 h-10 mb-2 opacity-35 text-indigo-500" />
                  <span className="text-xs font-semibold">No messages in this conversation yet</span>
                  <p className="text-[10px] text-slate-400 max-w-xs mt-1">Be the first to draft and send an HR broadcast announcement below.</p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input message form */}
            {selectedSpace && (
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white flex gap-2">
                <input 
                  type="text" 
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type a message to send directly to Google Chat..."
                  className="flex-1 bg-slate-50 border border-slate-200/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <button 
                  type="submit"
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm cursor-pointer transition-all shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* HR Broadcast Hub section */}
      {selectedSpace && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Megaphone className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wider">HR Employee Broadcast Hub</h2>
          </div>

          <form onSubmit={handleSendBroadcast} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">Broadcast Template</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input 
                      type="radio" 
                      name="template" 
                      value="welcome" 
                      checked={broadcastTemplate === 'welcome'} 
                      onChange={() => setBroadcastTemplate('welcome')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block">🎉 New Employee Welcome</span>
                      <span className="text-[10px] text-slate-400 truncate block">Introduce new team hires to spaces</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input 
                      type="radio" 
                      name="template" 
                      value="onboarding" 
                      checked={broadcastTemplate === 'onboarding'} 
                      onChange={() => setBroadcastTemplate('onboarding')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block">🚀 Training & Onboarding</span>
                      <span className="text-[10px] text-slate-400 truncate block">Schedule notifications and trainings</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input 
                      type="radio" 
                      name="template" 
                      value="custom" 
                      checked={broadcastTemplate === 'custom'} 
                      onChange={() => setBroadcastTemplate('custom')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block">✏️ Custom Text Broadcast</span>
                      <span className="text-[10px] text-slate-400 truncate block">Type a fully customizable alert</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-4 flex flex-col justify-between">
              {broadcastTemplate !== 'custom' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Employee Full Name</label>
                    <input 
                      type="text"
                      value={broadcastVarName}
                      onChange={(e) => setBroadcastVarName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Department</label>
                    <input 
                      type="text"
                      value={broadcastVarDept}
                      onChange={(e) => setBroadcastVarDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Custom Alert Text</label>
                  <textarea 
                    value={broadcastCustomText}
                    onChange={(e) => setBroadcastCustomText(e.target.value)}
                    placeholder="Enter details of custom general announcement..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required={broadcastTemplate === 'custom'}
                  />
                </div>
              )}

              {/* Preview Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Draft Preview</span>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {broadcastTemplate === 'welcome' && `🎉 TEAM ANNOUNCEMENT 🎉\n\nWe are absolutely thrilled to welcome ${broadcastVarName} to the ${broadcastVarDept} team! Please reach out, connect, and make them feel at home! Let’s win together. 🚀`}
                  {broadcastTemplate === 'onboarding' && `🚀 ONBOARDING ALERT 🚀\n\nHello Team, we have set up the onboarding schedule for ${broadcastVarName}. Please review your calendar slots for the training sessions and join us in greeting our new colleague!`}
                  {broadcastTemplate === 'custom' && (broadcastCustomText || '📢 PeopleCloud HR Broadcast update!')}
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <Megaphone className="w-4 h-4" />
                  Broadcast Announcement
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
