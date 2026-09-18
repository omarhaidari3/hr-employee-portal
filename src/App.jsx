import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Clock,
  LogIn,
  LogOut,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  X,
  Lock,
  User,
  MessageSquare,
  Send,
  Image as ImageIcon,
  HandCoins
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={setCurrentUser} />;
  }

  return <EmployeeDashboard user={currentUser} onSignOut={() => setCurrentUser(null)} />;
}

function AuthScreen({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanUsername = usernameInput.trim().toLowerCase();
      const { data: emp, error: dbErr } = await supabase
          .from('employees')
          .select('*')
          .ilike('username', cleanUsername)
          .maybeSingle();

      if (dbErr) throw dbErr;
      if (!emp || !emp.is_activated) {
        setError('No activated account found with this username. Please activate first.');
        setLoading(false);
        return;
      }
      if (emp.password_hash !== passwordInput) {
        setError('Incorrect password.');
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

  const handleFirstTimeSetup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    if (newPassword.length < 4) return setError('Password must be at least 4 characters long.');

    setLoading(true);
    try {
      const cleanCode = empCode.trim();
      const cleanEmail = empEmail.trim().toLowerCase();
      const cleanUsername = newUsername.trim().toLowerCase();

      const { data: emp, error: findErr } = await supabase
          .from('employees')
          .select('*')
          .ilike('emp_code', cleanCode)
          .ilike('email', cleanEmail)
          .maybeSingle();

      if (findErr) throw findErr;
      if (!emp) {
        setError(`No employee record found matching code "${cleanCode}" and email "${cleanEmail}". Make sure HR added you first.`);
        setLoading(false);
        return;
      }

      if (emp.is_activated) {
        setError('This employee account is already activated. Sign in directly.');
        setLoading(false);
        return;
      }

      const { data: updated, error: updErr } = await supabase
          .from('employees')
          .update({
            username: cleanUsername,
            password_hash: newPassword,
            is_activated: true
          })
          .eq('id', emp.id)
          .select()
          .single();

      if (updErr) throw updErr;

      setSuccess('Account activated! Logging you in...');
      setTimeout(() => onLoginSuccess(updated), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <h2 className="text-xl font-bold text-center">Employee Self-Service Workspace</h2>
          {error && <div className="p-3 bg-rose-950 text-rose-300 text-xs rounded-xl">{error}</div>}
          {success && <div className="p-3 bg-emerald-950 text-emerald-300 text-xs rounded-xl">{success}</div>}

          {!isRegistering ? (
              <form onSubmit={handleLogin} className="space-y-4 text-xs">
                <input required placeholder="Username" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                <input required type="password" placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-white cursor-pointer">{loading ? 'Verifying...' : 'Sign In'}</button>
                <p className="text-center text-[11px] text-slate-400">First time? <button type="button" onClick={() => setIsRegistering(true)} className="text-emerald-400 font-bold cursor-pointer">Activate Account</button></p>
              </form>
          ) : (
              <form onSubmit={handleFirstTimeSetup} className="space-y-3 text-xs">
                <input required placeholder="Employee Code (e.g. EMP-101)" value={empCode} onChange={(e) => setEmpCode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                <input required type="email" placeholder="Work Email" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                <input required placeholder="Choose a Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                <input required type="password" placeholder="Set Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                <input required type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl text-white cursor-pointer">Create Account</button>
                <p className="text-center text-[11px]"><button type="button" onClick={() => setIsRegistering(false)} className="text-slate-400 cursor-pointer">Back to Login</button></p>
              </form>
          )}
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
  const [chatPhotoUrl, setChatPhotoUrl] = useState('');
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const messagesEndRef = useRef(null);

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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `employee_id=eq.${emp.id}` }, (payload) => {
          setChatMessages((prev) => [...prev, payload.new]);
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
    if (!chatInput.trim() && !chatPhotoUrl.trim()) return;

    const payload = {
      employee_id: emp.id,
      sender: 'EMPLOYEE',
      sender_name: emp.name,
      text: chatInput.trim() || null,
      photo_url: chatPhotoUrl.trim() || null
    };

    const { data, error } = await supabase.from('chat_messages').insert([payload]).select().single();
    if (!error && data) {
      setChatMessages((prev) => [...prev, data]);
      setChatInput('');
      setChatPhotoUrl('');
      setShowPhotoPrompt(false);
    }
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

  return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-sm font-bold text-white">{emp.name}</h1>
              <p className="text-[10px] text-slate-400 font-mono">@{emp.username} • Base: ${Number(emp.salary).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab('attendance')} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'attendance' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Punch & Quotas</button>
            <button onClick={() => setActiveTab('requests')} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'requests' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Raises & Advances</button>
            <button onClick={() => setActiveTab('chat')} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'chat' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Direct Messages</button>
            <button onClick={onSignOut} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl ml-2 cursor-pointer">Sign Out</button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
          {/* TAB 1: PUNCH & VACATIONS */}
          {activeTab === 'attendance' && (
              <div className="space-y-5">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center space-y-4 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Today's Virtual Attendance</span>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handlePunch('IN')} disabled={loading} className="py-4 bg-emerald-600 hover:bg-emerald-500 font-black rounded-2xl text-sm cursor-pointer">Clock IN (Arrival)</button>
                    <button onClick={() => handlePunch('OUT')} disabled={loading} className="py-4 bg-rose-600 hover:bg-rose-500 font-black rounded-2xl text-sm cursor-pointer">Clock OUT (Departure)</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                    <div><span className="text-slate-500 block text-[10px]">Arrival:</span><span className="font-mono text-emerald-400 font-bold">{todayLog?.clock_in ? new Date(todayLog.clock_in).toLocaleTimeString() : '--'}</span></div>
                    <div><span className="text-slate-500 block text-[10px]">Departure:</span><span className="font-mono text-rose-400 font-bold">{todayLog?.clock_out ? new Date(todayLog.clock_out).toLocaleTimeString() : (todayLog?.clock_in ? 'On Shift' : '--')}</span></div>
                    <div><span className="text-slate-500 block text-[10px]">Hours:</span><span className="font-mono text-white font-bold">{todayLog?.total_hours || '0.00'} hrs</span></div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-white">Vacation Quotas & Leave History</h3>
                  <button onClick={() => setShowLeaveModal(true)} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <PlusCircle className="w-4 h-4" /> Request Vacation / Sick
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
                <div className="flex justify-between items-center bg-slate-900 p-5 rounded-2xl border border-slate-800">
                  <div>
                    <h3 className="font-bold text-sm text-white">Financial Inquiries & Advances</h3>
                    <p className="text-xs text-slate-400">Request company debt/advances or submit a salary increase application.</p>
                  </div>
                  <button onClick={() => setShowGeneralModal(true)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <HandCoins className="w-4 h-4" /> New Financial Request
                  </button>
                </div>

                <div className="space-y-2">
                  {myGeneralRequests.length === 0 ? (
                      <p className="text-center py-6 text-slate-500 text-xs">No advance or salary requests submitted.</p>
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

          {/* TAB 3: DIRECT CHAT WITH HR */}
          {activeTab === 'chat' && (
              <div className="h-[75vh] bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-slate-800 bg-slate-950 font-bold text-sm text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Direct Messages with HR Operations</span>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {chatMessages.length === 0 ? (
                      <p className="text-center text-xs text-slate-500 py-10">Send your first message or picture to HR below.</p>
                  ) : (
                      chatMessages.map((m) => {
                        const isMe = m.sender === 'EMPLOYEE';
                        return (
                            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`max-w-md p-3.5 rounded-2xl text-xs space-y-1.5 shadow-md ${isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
                                {m.text && <p>{m.text}</p>}
                                {m.photo_url && <img src={m.photo_url} alt="Attachment" className="rounded-xl max-h-48 object-cover mt-1 border border-white/20" />}
                              </div>
                              <span className="text-[9px] text-slate-500 mt-0.5">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        );
                      })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendChatMessage} className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                  <button type="button" onClick={() => setShowPhotoPrompt(!showPhotoPrompt)} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <input
                      type="text"
                      placeholder="Type a message to HR..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button type="submit" className="p-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold cursor-pointer">
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                {showPhotoPrompt && (
                    <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                      <input
                          type="text"
                          placeholder="Paste image URL (e.g. receipt or doctor note)..."
                          value={chatPhotoUrl}
                          onChange={(e) => setChatPhotoUrl(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                      <button type="button" onClick={() => setShowPhotoPrompt(false)} className="text-xs text-slate-400 cursor-pointer">Done</button>
                    </div>
                )}
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
                    <button type="button" onClick={() => setShowGeneralModal(false)} className="px-4 py-2 text-slate-400 cursor-pointer">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-white cursor-pointer">Submit to HR</button>
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
                    <button type="button" onClick={() => setShowLeaveModal(false)} className="px-4 py-2 text-slate-400 cursor-pointer">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl text-white cursor-pointer">Submit Request</button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
}