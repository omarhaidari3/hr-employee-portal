import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Clock,
  LogOut,
  PlusCircle,
  MessageSquare,
  Send,
  Image as ImageIcon,
  HandCoins,
  ShieldCheck,
  Pencil,
  Trash2
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('emp_portal_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (user) => {
    localStorage.setItem('emp_portal_user', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleSignOut = () => {
    localStorage.removeItem('emp_portal_user');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <CodeAuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return <EmployeeDashboard user={currentUser} onSignOut={handleSignOut} />;
}

function CodeAuthScreen({ onLoginSuccess }) {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    setError('');
    setLoading(true);

    try {
      const cleanCode = accessCode.trim().toUpperCase();
      const { data: emp, error: dbErr } = await supabase
          .from('employees')
          .select('*')
          .ilike('emp_code', cleanCode)
          .maybeSingle();

      if (dbErr) throw dbErr;
      if (!emp) {
        setError(`No employee found with code "${cleanCode}". Please verify with HR.`);
        setLoading(false);
        return;
      }

      onLoginSuccess(emp);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">Staff Access Portal</h2>
            <p className="text-xs text-slate-400">Enter your assigned code to enter your workspace</p>
          </div>

          {error && <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl text-center font-medium">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Access Code</label>
              <input
                  required
                  autoFocus
                  type="text"
                  placeholder="e.g. EMP-101"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-center text-lg font-mono font-bold text-emerald-400 uppercase tracking-widest outline-none focus:border-indigo-500 transition"
              />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold rounded-xl text-white shadow-lg text-xs tracking-wider uppercase transition cursor-pointer"
            >
              {loading ? 'Validating Code...' : 'Open Portal'}
            </button>
          </form>
        </div>
      </div>
  );
}

function EmployeeDashboard({ user, onSignOut }) {
  const [emp, setEmp] = useState(user);
  const [activeTab, setActiveTab] = useState('attendance');
  const [todayLog, setTodayLog] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [myGeneralRequests, setMyGeneralRequests] = useState([]);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Modals
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];

    const [attRes, leavesRes, genRes, chatRes, empRes] = await Promise.all([
      supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).eq('work_date', today).maybeSingle(),
      supabase.from('leave_requests').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false }),
      supabase.from('general_requests').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false }),
      supabase.from('chat_messages').select('*').eq('employee_id', emp.id).order('created_at', { ascending: true }),
      supabase.from('employees').select('*').eq('id', emp.id).single()
    ]);

    setTodayLog(attRes.data || null);
    setMyLeaves(leavesRes.data || []);
    setMyGeneralRequests(genRes.data || []);
    setChatMessages(chatRes.data || []);
    if (empRes.data) setEmp(empRes.data);
  }, [emp.id]);

  useEffect(() => {
    loadData();

    const channel = supabase
        .channel(`emp-realtime-${emp.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `employee_id=eq.${emp.id}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setChatMessages((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setChatMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'general_requests', filter: `employee_id=eq.${emp.id}` }, () => {
          loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests', filter: `employee_id=eq.${emp.id}` }, () => {
          loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs', filter: `employee_id=eq.${emp.id}` }, () => {
          loadData();
        })
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [emp.id, loadData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const payload = {
      employee_id: emp.id,
      sender: 'EMPLOYEE',
      sender_name: emp.name,
      text: chatInput.trim(),
      photo_url: null,
      is_deleted: false,
      is_edited: false
    };

    const textToSend = chatInput;
    setChatInput('');

    const { error } = await supabase.from('chat_messages').insert([payload]);
    if (error) {
      setChatInput(textToSend);
      console.error(error.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${emp.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(fileName);

      const payload = {
        employee_id: emp.id,
        sender: 'EMPLOYEE',
        sender_name: emp.name,
        text: null,
        photo_url: publicUrlData.publicUrl,
        is_deleted: false,
        is_edited: false
      };

      const { error: insertError } = await supabase.from('chat_messages').insert([payload]);
      if (insertError) throw insertError;
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditInput(msg.text || '');
  };

  const handleSaveEdit = async (id) => {
    if (!editInput.trim()) return;
    const { error } = await supabase
        .from('chat_messages')
        .update({ text: editInput.trim(), is_edited: true })
        .eq('id', id);

    if (error) {
      alert(error.message);
    } else {
      setEditingMessageId(null);
      setEditInput('');
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    const { error } = await supabase
        .from('chat_messages')
        .update({
          text: 'This message was deleted',
          photo_url: null,
          is_deleted: true
        })
        .eq('id', id);

    if (error) alert(error.message);
  };

  const handlePunch = async (mode) => {
    const today = new Date().toISOString().split('T')[0];
    const nowISO = new Date().toISOString();
    setLoading(true);

    try {
      await supabase.from('punch_events').insert([{
        employee_id: emp.id,
        employee_name: emp.name,
        punch_type: mode,
        punched_at: nowISO,
        work_date: today
      }]);

      if (mode === 'IN') {
        await supabase.from('attendance_logs').upsert([{
          employee_id: emp.id,
          employee_name: emp.name,
          work_date: today,
          clock_in: nowISO,
          status: 'Present'
        }], { onConflict: 'employee_id,work_date' });
      } else {
        const inTime = todayLog?.clock_in ? new Date(todayLog.clock_in) : new Date(nowISO);
        const hours = ((new Date(nowISO) - inTime) / (1000 * 60 * 60)).toFixed(2);
        await supabase.from('attendance_logs').upsert([{
          employee_id: emp.id,
          employee_name: emp.name,
          work_date: today,
          clock_out: nowISO,
          total_hours: parseFloat(hours),
          status: 'Present'
        }], { onConflict: 'employee_id,work_date' });
      }

      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const formatMessageDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-sm font-bold text-white">{emp.name}</h1>
              <p className="text-[10px] text-slate-400 font-mono"><strong className="text-indigo-400">{emp.emp_code}</strong> • Base: ${Number(emp.salary).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button onClick={() => setActiveTab('attendance')} className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold ${activeTab === 'attendance' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Punch & Leaves</button>
            <button onClick={() => setActiveTab('requests')} className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold ${activeTab === 'requests' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Advances</button>
            <button onClick={() => setActiveTab('chat')} className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold ${activeTab === 'chat' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Chat</button>
            <button onClick={onSignOut} className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl text-slate-300 ml-1">
              <span className="hidden sm:inline">Sign Out</span>
              <LogOut className="w-4 h-4 sm:hidden" />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: PUNCH & VACATIONS */}
          {activeTab === 'attendance' && (
              <div className="space-y-5">
                <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl text-center space-y-4 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Today's Virtual Punch Terminal</span>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <button onClick={() => handlePunch('IN')} disabled={loading} className="py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-500 font-black rounded-2xl text-xs sm:text-sm">Clock IN</button>
                    <button onClick={() => handlePunch('OUT')} disabled={loading} className="py-3.5 sm:py-4 bg-rose-600 hover:bg-rose-500 font-black rounded-2xl text-xs sm:text-sm">Clock OUT</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                    <div><span className="text-slate-500 block text-[10px]">Arrival:</span><span className="font-mono text-emerald-400 font-bold">{todayLog?.clock_in ? new Date(todayLog.clock_in).toLocaleTimeString() : '--'}</span></div>
                    <div><span className="text-slate-500 block text-[10px]">Departure:</span><span className="font-mono text-rose-400 font-bold">{todayLog?.clock_out ? new Date(todayLog.clock_out).toLocaleTimeString() : (todayLog?.clock_in ? 'On Shift' : '--')}</span></div>
                    <div><span className="text-slate-500 block text-[10px]">Hours:</span><span className="font-mono text-white font-bold">{todayLog?.total_hours || '0.00'} hrs</span></div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-white">Leave History & Quotas</h3>
                  <button onClick={() => setShowLeaveModal(true)} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4" /> Request Leave
                  </button>
                </div>

                <div className="space-y-2">
                  {myLeaves.length === 0 ? (
                      <p className="text-center py-6 text-slate-500 text-xs">No leave requests submitted yet.</p>
                  ) : (
                      myLeaves.map((l) => (
                          <div key={l.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-white block">{l.type} ({l.days} days)</span>
                              <span className="text-slate-400 text-[11px]">{l.start_date} → {l.end_date}</span>
                              {l.hr_notes && <p className="text-indigo-300 text-[10px] mt-1 font-semibold">HR Feedback: {l.hr_notes}</p>}
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                l.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                    l.status === 'Declined' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>{l.status}</span>
                          </div>
                      ))
                  )}
                </div>
              </div>
          )}

          {/* TAB 2: FINANCIAL REQUESTS */}
          {activeTab === 'requests' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 p-5 rounded-2xl border border-slate-800">
                  <div>
                    <h3 className="font-bold text-sm text-white">Financial Inquiries & Advances</h3>
                    <p className="text-xs text-slate-400">Request advance loans or apply for a salary increase.</p>
                  </div>
                  <button onClick={() => setShowGeneralModal(true)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <HandCoins className="w-4 h-4" /> New Inquiry
                  </button>
                </div>

                <div className="space-y-2">
                  {myGeneralRequests.length === 0 ? (
                      <p className="text-center py-6 text-slate-500 text-xs">No requests submitted.</p>
                  ) : (
                      myGeneralRequests.map((r) => (
                          <div key={r.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex justify-between items-center text-xs">
                            <div className="space-y-1">
                              <span className="font-bold text-white block">{r.category} {r.amount > 0 && `($${Number(r.amount).toLocaleString()})`}</span>
                              <p className="text-slate-400">{r.details}</p>
                              {r.hr_feedback && <p className="text-indigo-300 font-medium">HR Response: {r.hr_feedback}</p>}
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                r.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                    r.status === 'Declined' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>{r.status}</span>
                          </div>
                      ))
                  )}
                </div>
              </div>
          )}

          {/* TAB 3: DIRECT CHAT (DATE, EDIT, DELETE & PHOTO UPLOADS) */}
          {activeTab === 'chat' && (
              <div className="h-[75vh] bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl">
                <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950 font-bold text-sm text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Direct Messages with HR Operations</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {chatMessages.length === 0 ? (
                      <p className="text-center text-xs text-slate-500 py-10">Send your first message or picture to HR below.</p>
                  ) : (
                      chatMessages.map((m) => {
                        const isMe = m.sender === 'EMPLOYEE';
                        const isEditing = editingMessageId === m.id;

                        return (
                            <div key={m.id} className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`relative max-w-xs sm:max-w-md p-3.5 rounded-2xl text-xs space-y-1.5 shadow-md ${
                                  m.is_deleted
                                      ? 'bg-slate-800/50 text-slate-500 italic border border-slate-800'
                                      : isMe
                                          ? 'bg-emerald-600 text-white rounded-tr-none'
                                          : 'bg-slate-800 text-slate-200 rounded-tl-none'
                              }`}>
                                {isEditing ? (
                                    <div className="space-y-2">
                                      <input
                                          type="text"
                                          value={editInput}
                                          onChange={(e) => setEditInput(e.target.value)}
                                          className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700 outline-none text-xs"
                                      />
                                      <div className="flex justify-end gap-2 text-[10px]">
                                        <button onClick={() => setEditingMessageId(null)} className="px-2 py-1 bg-slate-700 rounded">Cancel</button>
                                        <button onClick={() => handleSaveEdit(m.id)} className="px-2 py-1 bg-emerald-800 font-bold rounded">Save</button>
                                      </div>
                                    </div>
                                ) : (
                                    <>
                                      <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                                      {m.photo_url && (
                                          <a href={m.photo_url} target="_blank" rel="noreferrer" className="block mt-1">
                                            <img
                                                src={m.photo_url}
                                                alt="Attachment"
                                                className="rounded-xl max-h-52 w-auto object-cover border border-white/20 hover:opacity-95 transition"
                                            />
                                          </a>
                                      )}
                                    </>
                                )}

                                {/* Edit & Delete Controls for Employee */}
                                {isMe && !m.is_deleted && !isEditing && (
                                    <div className="absolute top-1 -left-14 hidden group-hover:flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 shadow-lg">
                                      {m.text && (
                                          <button onClick={() => handleStartEdit(m)} title="Edit Message" className="p-1 hover:text-emerald-400 text-slate-400">
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                      )}
                                      <button onClick={() => handleDeleteMessage(m.id)} title="Delete Message" className="p-1 hover:text-rose-400 text-slate-400">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-1 px-1">
                                <span>{formatMessageDate(m.created_at)}</span>
                                {m.is_edited && !m.is_deleted && <span className="italic text-emerald-400 font-medium">(edited)</span>}
                              </div>
                            </div>
                        );
                      })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendChatMessage} className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                  <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                  />
                  <button
                      type="button"
                      disabled={uploadingFile}
                      onClick={() => fileInputRef.current?.click()}
                      title="Upload Photo / Document"
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 disabled:opacity-50 transition"
                  >
                    <ImageIcon className={`w-4 h-4 ${uploadingFile ? 'animate-pulse text-emerald-400' : ''}`} />
                  </button>
                  <input
                      type="text"
                      placeholder={uploadingFile ? 'Uploading attachment...' : 'Type a message to HR...'}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button type="submit" className="p-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
          )}
        </main>

        {/* MODAL: FINANCIAL REQUEST */}
        {showGeneralModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
                <h3 className="font-bold text-sm text-white">Apply for Financial Inquiry</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  await supabase.from('general_requests').insert([{
                    employee_id: emp.id,
                    employee_name: emp.name,
                    category: fd.get('category'),
                    amount: parseFloat(fd.get('amount')) || 0,
                    details: fd.get('details'),
                    status: 'Pending'
                  }]);
                  setShowGeneralModal(false);
                  loadData();
                }} className="space-y-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Request Category</label>
                    <select name="category" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white">
                      <option value="Advance / Money Debt">Advance / Money Debt from Company</option>
                      <option value="Salary Increase">Salary Increase Review</option>
                      <option value="Expense Reimbursement">Expense Reimbursement</option>
                      <option value="Equipment / Tech Asset">Hardware / Equipment Request</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Requested Amount ($)</label>
                    <input type="number" name="amount" placeholder="e.g. 1000" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Details & Justification</label>
                    <textarea required name="details" rows="3" placeholder="Explain the reason for this inquiry..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowGeneralModal(false)} className="px-4 py-2 text-slate-400">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-white">Submit to HR</button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {/* MODAL: VACATION LEAVE */}
        {showLeaveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
                <h3 className="font-bold text-sm text-white">Request Vacation / Sick Leave</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  await supabase.from('leave_requests').insert([{
                    employee_id: emp.id,
                    employee_name: emp.name,
                    department: emp.department,
                    type: fd.get('type'),
                    affects_salary: fd.get('type') === 'Unpaid Leave',
                    start_date: fd.get('start_date'),
                    end_date: fd.get('end_date'),
                    days: parseInt(fd.get('days'), 10) || 1,
                    reason: fd.get('reason'),
                    status: 'Pending'
                  }]);
                  setShowLeaveModal(false);
                  loadData();
                }} className="space-y-3">
                  <select name="type" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white">
                    <option value="Annual Vacation">Annual Paid Vacation</option>
                    <option value="Medical / Sick Leave">Medical / Sick Leave</option>
                    <option value="Unpaid Leave">Unpaid Leave</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input required type="date" name="start_date" className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                    <input required type="date" name="end_date" className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                  </div>
                  <input required type="number" min="1" name="days" placeholder="Days count" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                  <textarea required name="reason" rows="2" placeholder="Reason..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowLeaveModal(false)} className="px-4 py-2 text-slate-400">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl text-white">Submit Request</button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
}