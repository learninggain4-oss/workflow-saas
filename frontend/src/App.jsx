import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { auth, boards, tasks, subtasks, comments, notifs, uploadFile, WS_BASE } from './services/api';

const AVAILABLE_LABELS = [
  {name:"Bug", cls:"bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"},
  {name:"Feature", cls:"bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"},
  {name:"Design", cls:"bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"},
  {name:"Backend", cls:"bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"},
  {name:"Frontend", cls:"bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800"},
  {name:"Urgent", cls:"bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"},
];
const getLabelCls = (name) => AVAILABLE_LABELS.find(l=>l.name===name)?.cls || "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [userData, setUserData] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  const [tasksList, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [filterPrio, setFilterPrio] = useState("all");
  const [filterLabel, setFilterLabel] = useState("all");
  const [editing, setEditing] = useState(null);

  const [boardsList, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [newBoardName, setNewBoardName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [renameValue, setRenameValue] = useState("");

  const [taskComments, setTaskComments] = useState([]);
  const [subtasksList, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [activities, setActivities] = useState([]);
  const [boardMembers, setBoardMembers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [viewMode, setViewMode] = useState("board");
  const [calDate, setCalDate] = useState(new Date());
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");

  useEffect(() => { localStorage.setItem("darkMode", String(darkMode)); }, [darkMode]);

  const currentEmail = useMemo(() => {
    try { return token ? JSON.parse(atob(token.split('.')[1])).sub || "" : ""; } catch { return ""; }
  }, [token]);

  const myRole = useMemo(() => {
    if (!selectedBoard || boardMembers.length === 0) return "member";
    return boardMembers.find(x => x.email === currentEmail)?.role || "member";
  }, [boardMembers, currentEmail, selectedBoard]);
  
  const canEdit = myRole === "admin" || myRole === "member";

  const fetchInitialData = async () => {
    if (!token) return;
    try {
      const uRes = await auth.getMe(); setUserData(uRes.data);
      const bRes = await boards.getAll(); setBoards(bRes.data);
      if (bRes.data.length > 0 && !selectedBoard) setSelectedBoard(bRes.data[0].id);
      const nRes = await notifs.getAll(); setNotifications(nRes.data);
    } catch {}
  };

  const fetchBoardData = async () => {
    if (!selectedBoard) return;
    try {
      const tRes = await tasks.getAll(selectedBoard); setTasks(tRes.data);
      const aRes = await boards.getActivities(selectedBoard); setActivities(aRes.data);
      const mRes = await boards.getMembers(selectedBoard); setBoardMembers(mRes.data);
      const b = boardsList.find(x => x.id === selectedBoard);
      if (b) setRenameValue(b.name);
    } catch {}
  };

  const fetchTaskDetails = async (id) => {
    if (!id) return;
    try {
      const cRes = await comments.getAll(id); setTaskComments(cRes.data);
      const sRes = await subtasks.getAll(id); setSubtasks(sRes.data);
    } catch {}
  };

  useEffect(() => { fetchInitialData(); }, [token]);
  useEffect(() => { fetchBoardData(); }, [selectedBoard]);
  useEffect(() => { if (editing) fetchTaskDetails(editing.id); }, [editing]);

  useEffect(() => {
    if (!selectedBoard || !token) return;
    const ws = new WebSocket(`${WS_BASE}/ws/${selectedBoard}`);
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === "update") {
          fetchBoardData();
          notifs.getAll().then(res => setNotifications(res.data));
          if (editing) fetchTaskDetails(editing.id);
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [selectedBoard]);

  const handleLogin = async () => {
    const f = new URLSearchParams(); f.append("username", email); f.append("password", password);
    try {
      const r = await auth.login(f);
      localStorage.setItem("token", r.data.access_token); setToken(r.data.access_token);
    } catch { alert("Login failed - check email/password"); }
  };

  const handleRegister = async () => {
    try {
      await auth.register({ email, password, name });
      alert("Registered! Now login"); setIsRegister(false);
    } catch (e) { alert(e.response?.data?.detail || "Register failed"); }
  };

  const handleUpgrade = async () => {
    try { await auth.upgrade(); alert("Upgraded to Pro!"); auth.getMe().then(r => setUserData(r.data)); } catch { alert("Upgrade failed"); }
  };

  const exportCSV = async () => {
    if (!selectedBoard) return;
    try {
      const response = await boards.exportCSV(selectedBoard);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `board_${selectedBoard}_export.csv`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch { alert("Failed to export data"); }
  };

  const addTask = async () => {
    if (!canEdit) return alert("Viewers cannot add tasks");
    if (!title.trim() || !selectedBoard) return alert("Select board and enter title");
    const prio = (title.toLowerCase().includes("urgent") || title.toLowerCase().includes("bug")) ? "high" : "medium";
    try {
      await tasks.create({ title, status: "todo", priority: prio, board_id: selectedBoard });
      setTitle(""); fetchBoardData();
    } catch (e) { alert(e.response?.data?.detail || "Error adding task"); }
  };

  const onDragEnd = async (r) => {
    if (!canEdit || !r.destination) return;
    const id = r.draggableId; const ns = r.destination.droppableId;
    setTasks(p => p.map(t => String(t.id) === id ? { ...t, status: ns } : t));
    try { await tasks.update(id, { status: ns }); } catch {}
  };

  const saveEdit = async () => {
    if (!canEdit) return alert("Viewers cannot edit");
    await tasks.update(editing.id, editing); setEditing(null); fetchBoardData();
  };

  const delTask = async (id) => {
    if (!canEdit || !confirm("Delete task?")) return;
    await tasks.delete(id); setEditing(null); fetchBoardData();
  };

  const addSubtask = async () => {
    if (!canEdit || !newSubtask.trim() || !editing) return;
    await subtasks.create(editing.id, newSubtask); setNewSubtask(""); fetchTaskDetails(editing.id);
  };
  const toggleSubtask = async (s) => {
    if (!canEdit) return;
    await subtasks.update(s.id, !s.is_completed); fetchTaskDetails(editing.id);
  };
  const delSubtask = async (sId) => {
    if (!canEdit) return;
    await subtasks.delete(sId); fetchTaskDetails(editing.id);
  };

  const createBoard = async () => {
    if (!newBoardName.trim()) return;
    try {
      const r = await boards.create(newBoardName);
      setNewBoardName(""); await fetchInitialData(); setSelectedBoard(r.data.id);
    } catch (e) { alert(e.response?.data?.detail || "Error"); }
  };
  const renameBoard = async () => {
    if (!renameValue.trim() || !selectedBoard || myRole !== 'admin') return;
    await boards.rename(selectedBoard, renameValue); await fetchInitialData();
  };
  const deleteBoard = async () => {
    if (!selectedBoard || myRole !== 'admin' || !confirm("Delete board?")) return;
    await boards.delete(selectedBoard); setSelectedBoard(null); await fetchInitialData();
  };
  const inviteUser = async () => {
    if (!inviteEmail.trim() || !selectedBoard || myRole !== 'admin') return alert("Only admins can invite");
    try {
      const res = await boards.invite(selectedBoard, inviteEmail, inviteRole);
      alert(res.data.message || "Invited!"); setInviteEmail(""); fetchBoardData();
    } catch (e) { alert(e.response?.data?.detail || "Invite failed"); }
  };

  const addComment = async () => {
    if (!newComment.trim() || !editing) return;
    await comments.create(editing.id, newComment); setNewComment(""); fetchTaskDetails(editing.id);
  };

  const handleFileUpload = async (e) => {
    if (!canEdit || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) return alert("Max 5MB");
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await uploadFile(fd);
      setEditing({ ...editing, attachment_url: r.data.url }); alert("Uploaded!");
    } catch { alert("Upload failed"); }
    setUploading(false);
  };

  const toggleLabel = (lb) => {
    if (!canEdit || !editing) return;
    const cur = (editing.labels || "").split(",").filter(Boolean);
    const next = cur.includes(lb) ? cur.filter(x => x !== lb) : [...cur, lb];
    setEditing({ ...editing, labels: next.join(",") });
  };

  const formatDate = (d) => {
    const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`;
  };

  const formatMentions = (text) => text.split(/(@[\w\.-]+@[\w\.-]+)/g).map((p, i) => p.startsWith("@") ? <b key={i} className="text-indigo-500 font-semibold">{p}</b> : p);

  const analytics = useMemo(() => {
    const total = tasksList.length;
    const done = tasksList.filter(t => t.status === "done").length;
    let totalTimeEst = 0; let totalTimeSpent = 0;
    const byMember = {};
    tasksList.forEach(t => {
      totalTimeEst += (t.time_estimated || 0); totalTimeSpent += (t.time_spent || 0);
      if (t.assigned_to) byMember[t.assigned_to] = (byMember[t.assigned_to] || 0) + 1;
    });
    return {
      total, done, progress: total === 0 ? 0 : Math.round((done / total) * 100),
      todo: tasksList.filter(t => t.status === "todo").length,
      doing: tasksList.filter(t => t.status === "doing").length,
      overdue: tasksList.filter(t => t.due_date && t.due_date < formatDate(new Date()) && t.status !== "done").length,
      totalTimeEst, totalTimeSpent, byMember
    };
  }, [tasksList]);

  const filtered = tasksList.filter(t => {
    const ms = t.title.toLowerCase().includes(search.toLowerCase()) || (t.description || "").toLowerCase().includes(search.toLowerCase());
    const mp = filterPrio === "all" || t.priority === filterPrio;
    const ml = filterLabel === "all" || (t.labels || "").split(",").includes(filterLabel);
    return ms && mp && ml;
  });

  const timelineDays = Array.from({ length: 14 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return formatDate(d); });
  const y = calDate.getFullYear(); const m = calDate.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate(); const firstDay = new Date(y, m, 1).getDay();

  // Modern Professional UI Variables
  const bgMain = darkMode ? "bg-[#09090b] text-gray-100" : "bg-[#f8fafc] text-gray-900";
  const bgSide = darkMode ? "bg-[#121214] border-gray-800 text-gray-300" : "bg-white border-gray-200 text-gray-700";
  const bgCard = darkMode ? "bg-[#18181b] border-gray-800" : "bg-white border-gray-200";
  const bgKanbanCol = darkMode ? "bg-[#121214] border-gray-800" : "bg-gray-50 border-gray-100";
  const bgTask = darkMode ? "bg-[#18181b] border-gray-700 hover:border-gray-500 hover:shadow-lg" : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md";
  const inputCls = darkMode ? "bg-[#09090b] border-gray-700 text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow";
  const subCard = darkMode ? "bg-[#1f1f22] border-gray-800" : "bg-gray-50 border-gray-200";
  const primaryBtn = "bg-indigo-600 hover:bg-indigo-700 text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-[#18181b]";

  if (!token) return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${bgMain}`}>
      <div className={`p-10 rounded-2xl border w-full max-w-md shadow-2xl ${bgCard}`}>
        <div className="text-center mb-8">
          <h1 className="font-extrabold text-3xl tracking-tight mb-2">WorkFlow<span className="text-indigo-500">.</span></h1>
          <p className="text-sm text-gray-500 font-medium">Team Task Management + Email</p>
        </div>
        <div className="space-y-4">
          {isRegister && <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className={`border w-full p-3 rounded-xl text-sm ${inputCls}`} />}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className={`border w-full p-3 rounded-xl text-sm ${inputCls}`} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={`border w-full p-3 rounded-xl text-sm ${inputCls}`} />
          <button onClick={isRegister ? handleRegister : handleLogin} className={`w-full p-3 rounded-xl text-sm font-semibold shadow-md mt-2 ${primaryBtn}`}>
            {isRegister ? "Create Account" : "Sign In"}
          </button>
        </div>
        <div className="mt-6 text-center">
          <button onClick={() => setIsRegister(!isRegister)} className="text-sm text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
            {isRegister ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`h-screen w-full flex overflow-hidden transition-colors duration-200 ${bgMain}`}>
      
      {/* Sidebar */}
      <aside className={`w-64 flex-shrink-0 border-r flex flex-col transition-colors duration-200 ${bgSide}`}>
        <div className="p-6 flex justify-between items-center shrink-0">
          <h1 className="font-extrabold text-xl tracking-tight">WorkFlow<span className="text-indigo-500">.</span></h1>
          <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}>
            {darkMode ? "☀" : "🌙"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {userData && (
            <div className={`border p-4 rounded-xl shadow-sm ${subCard}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-lg">
                  {(userData.name || userData.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate text-gray-900 dark:text-gray-100">{userData.name || userData.email.split('@')[0]}</p>
                  <p className="text-xs text-gray-500 truncate">{userData.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border ${userData.subscription_tier === 'pro' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' : 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>
                  {userData.subscription_tier} Plan
                </span>
                {userData.subscription_tier === 'free' && <button onClick={handleUpgrade} className="text-[10px] font-bold bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition-colors shadow-sm">Upgrade</button>}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="font-semibold text-xs uppercase tracking-widest text-gray-500">Projects</h2>
              <span className="text-[10px] font-bold bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">{myRole}</span>
            </div>
            <div className="space-y-1 mb-4">
              {boardsList.map(b => (
                <button key={b.id} onClick={() => setSelectedBoard(b.id)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-all duration-200 flex items-center gap-2 ${selectedBoard === b.id ? 'bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-900/20 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'}`}>
                  <span className="opacity-70">❖</span> {b.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2 px-1">
              <input value={newBoardName} onChange={e => setNewBoardName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createBoard()} placeholder="New project..." className={`border p-2 rounded-lg text-sm flex-1 min-w-0 ${inputCls}`} />
              <button onClick={createBoard} className={`px-3 rounded-lg text-sm font-bold flex items-center justify-center ${primaryBtn}`}>+</button>
            </div>
          </div>

          {selectedBoard && myRole === 'admin' && (
            <div className={`border rounded-xl p-4 shadow-sm ${subCard}`}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-500">Settings</p>
              <input value={renameValue} onChange={e => setRenameValue(e.target.value)} className={`border w-full p-2.5 rounded-lg text-sm mb-3 ${inputCls}`} placeholder="Rename board..." />
              <div className="flex gap-2">
                <button onClick={renameBoard} className={`border flex-1 p-2 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${bgCard}`}>Rename</button>
                <button onClick={deleteBoard} className="bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 flex-1 p-2 rounded-lg text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">Delete</button>
              </div>
            </div>
          )}

          {myRole === 'admin' && (
            <div className="pt-2">
              <h3 className="font-semibold text-xs uppercase tracking-widest text-gray-500 mb-3 px-2">Team Members</h3>
              <div className="space-y-2">
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" className={`border w-full p-2.5 rounded-lg text-sm ${inputCls}`} />
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={`border w-full p-2.5 rounded-lg text-sm ${inputCls}`}>
                  <option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option>
                </select>
                <button onClick={inviteUser} className={`w-full p-2.5 rounded-lg text-sm font-semibold shadow-sm ${primaryBtn}`}>Send Invite</button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 shrink-0">
          <button onClick={() => { localStorage.clear(); setToken(""); }} className={`w-full text-sm border p-2.5 rounded-lg font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800 transition-colors ${bgCard}`}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Header */}
        <header className="flex-shrink-0 h-20 px-8 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-transparent">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-extrabold tracking-tight truncate">
              {boardsList.find(b => b.id === selectedBoard)?.name || "Select a project"}
            </h2>
            {selectedBoard && (
              <button onClick={exportCSV} className={`px-3 py-1.5 border rounded-lg text-xs font-semibold shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800 ${bgCard}`}>
                Export CSV
              </button>
            )}
          </div>
          
          <div className="flex gap-4 items-center">
            <div className={`flex border rounded-lg p-1 shadow-sm ${bgCard}`}>
              {["dashboard", "board", "timeline", "calendar"].map(m => (
                <button key={m} onClick={() => setViewMode(m)} className={`px-4 py-1.5 rounded-md text-sm font-semibold capitalize transition-all duration-200 ${viewMode === m ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-900/40 dark:text-indigo-300" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
                  {m}
                </button>
              ))}
            </div>
            
            <div className="relative">
              <button onClick={() => setShowNotif(!showNotif)} className={`relative border p-2.5 rounded-lg text-sm shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${bgCard}`}>
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex justify-center items-center rounded-full border-2 border-white dark:border-[#18181b]">
                    {notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>
              
              {showNotif && (
                <div className={`absolute right-0 top-12 w-80 border rounded-xl shadow-2xl z-50 max-h-96 overflow-auto ${bgCard}`}>
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-inherit z-10">
                    <span className="font-bold text-sm">Notifications</span>
                    <button onClick={() => { notifs.markAllRead(); notifs.getAll().then(r => setNotifications(r.data)); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Mark all read</button>
                  </div>
                  <div className="py-2">
                    {notifications.length === 0 && <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>}
                    {notifications.map(n => (
                      <div key={n.id} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800/50 text-sm flex justify-between group hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <span className={`pr-4 ${!n.is_read ? 'font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>{n.message}</span>
                        <button onClick={() => { notifs.delete(n.id); notifs.getAll().then(r => setNotifications(r.data)); }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
          
          {viewMode === "dashboard" && (
            <div className="space-y-8 max-w-7xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">
                <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
                  <p className="text-sm font-semibold text-gray-500 mb-2">Total Tasks</p>
                  <p className="text-4xl font-extrabold">{analytics.total}</p>
                </div>
                <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
                  <p className="text-sm font-semibold text-gray-500 mb-2">Completed</p>
                  <p className="text-4xl font-extrabold text-emerald-500">{analytics.done}</p>
                </div>
                <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
                  <p className="text-sm font-semibold text-gray-500 mb-2">In Progress</p>
                  <p className="text-4xl font-extrabold text-blue-500">{analytics.doing}</p>
                </div>
                <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
                  <p className="text-sm font-semibold text-gray-500 mb-2">Overdue</p>
                  <p className="text-4xl font-extrabold text-red-500">{analytics.overdue}</p>
                </div>
              </div>
              
              <div className={`rounded-2xl border shadow-sm flex flex-col ${bgCard}`}>
                <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="font-bold text-lg">Recent Activity Feed</h3>
                </div>
                <div className="p-0 max-h-[400px] overflow-y-auto">
                  {activities.length === 0 && <div className="p-6 text-gray-500 text-sm">No activity yet.</div>}
                  {activities.map(a => (
                    <div key={a.id} className="text-sm border-b border-gray-100 dark:border-gray-800/50 p-4 px-6 flex gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold shrink-0">
                        {a.user_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col justify-center">
                        <p><b className="text-gray-900 dark:text-gray-100">{a.user_name}</b> <span className="text-gray-600 dark:text-gray-400">{a.action}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewMode === "board" && (
            <div className="h-full flex flex-col min-w-min">
              {canEdit && (
                <div className="flex gap-3 mb-8 shrink-0">
                  <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="What needs to be done?" className={`border px-5 py-3 w-full max-w-md rounded-xl text-sm shadow-sm ${inputCls}`} />
                  <button onClick={addTask} className={`px-6 rounded-xl text-sm font-semibold shadow-sm ${primaryBtn}`}>Create Task</button>
                </div>
              )}
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-6 h-full pb-4 items-start">
                  {["todo", "doing", "done"].map(s => (
                    <Droppable key={s} droppableId={s} isDropDisabled={!canEdit}>{(p) => (
                      <div ref={p.innerRef} {...p.droppableProps} className={`w-[340px] shrink-0 rounded-2xl border p-4 flex flex-col max-h-full ${bgKanbanCol}`}>
                        <div className="flex items-center justify-between mb-4 px-2">
                          <h3 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                            {s === 'todo' && <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>}
                            {s === 'doing' && <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>}
                            {s === 'done' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>}
                            {s}
                          </h3>
                          <span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                            {filtered.filter(t => t.status === s).length}
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 min-h-[150px]">
                          {filtered.filter(t => t.status === s).map((t, i) => (
                            <Draggable key={t.id} draggableId={String(t.id)} index={i} isDragDisabled={!canEdit}>{(pr, snapshot) => (
                              <div ref={pr.innerRef} {...pr.draggableProps} {...pr.dragHandleProps} onClick={() => setEditing({ ...t, labels: t.labels || "" })} 
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${bgTask} ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-indigo-500' : ''}`}>
                                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2 leading-relaxed">{t.title}</div>
                                {t.labels && (
                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {t.labels.split(",").filter(Boolean).map(lb => (
                                      <span key={lb} className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getLabelCls(lb)}`}>{lb}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}</Draggable>
                          ))}
                          {p.placeholder}
                        </div>
                      </div>
                    )}</Droppable>
                  ))}
                </div>
              </DragDropContext>
            </div>
          )}

          {viewMode === "timeline" && (
            <div className={`rounded-2xl border p-6 shadow-sm overflow-x-auto ${bgCard}`}>
              <h3 className="font-bold text-xl mb-6">Project Timeline</h3>
              <div className="min-w-[900px]">
                {/* Timeline Header */}
                <div className="grid grid-cols-[250px_repeat(14,1fr)] gap-1 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <div className="text-xs font-bold text-gray-500 uppercase">Task</div>
                  {timelineDays.map(d => <div key={d} className="text-[10px] text-center text-gray-400 font-semibold">{d.split('-').slice(1).join('/')}</div>)}
                </div>
                {/* Timeline Body */}
                <div className="space-y-3">
                  {tasksList.filter(t => t.start_date && t.due_date).map(t => (
                    <div key={t.id} onClick={() => setEditing({ ...t, labels: t.labels || "" })} className="grid grid-cols-[250px_repeat(14,1fr)] gap-1 items-center cursor-pointer group py-1">
                      <div className="text-sm font-medium truncate pr-4 group-hover:text-indigo-600 transition-colors">{t.title}</div>
                      <div style={{ gridColumn: `${Math.max(2, timelineDays.indexOf(t.start_date) + 2)} / span ${timelineDays.indexOf(t.due_date) - timelineDays.indexOf(t.start_date) + 1}` }} 
                        className={`h-7 rounded-lg text-[11px] flex items-center font-bold px-3 shadow-sm transition-all group-hover:shadow-md ${t.status === 'done' ? 'bg-emerald-500 text-white' : t.status === 'doing' ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white'}`}>
                        {t.status.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewMode === "calendar" && (
            <div className={`rounded-2xl border p-6 shadow-sm max-w-6xl mx-auto ${bgCard}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-2xl">{calDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              </div>
              <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-800 border dark:border-gray-800 rounded-xl overflow-hidden">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className={`p-3 text-xs font-bold text-center uppercase tracking-wider text-gray-500 ${subCard}`}>{d}</div>)}
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className={`min-h-[120px] ${bgCard}`}></div>)}
                {Array.from({ length: daysInMonth }).map((_, idx) => (
                  <div key={idx} className={`min-h-[120px] p-2 flex flex-col gap-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${bgCard}`}>
                    <div className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${idx + 1 === new Date().getDate() && m === new Date().getMonth() ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>{idx + 1}</div>
                    <div className="flex-1 overflow-y-auto space-y-1">
                      {tasksList.filter(t => t.due_date === formatDate(new Date(y, m, idx + 1))).map(t => (
                        <div key={t.id} onClick={() => setEditing({ ...t, labels: t.labels || "" })} className="text-[10px] px-2 py-1 rounded cursor-pointer font-semibold border bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 truncate hover:shadow-sm">
                          {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Edit Modal (Beautiful modern modal layout) */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
          <div className={`rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border ${bgCard} overflow-hidden transform transition-all`}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#18181b]">
              <h2 className="font-extrabold text-lg text-gray-900 dark:text-gray-100">Task Details</h2>
              <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">✕</button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="md:col-span-2 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Title</label>
                    <input disabled={!canEdit} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className={`border w-full p-3 rounded-xl text-lg font-medium shadow-sm ${inputCls}`} />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Description</label>
                    <textarea disabled={!canEdit} value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} className={`border w-full p-3 rounded-xl min-h-[120px] text-sm shadow-sm resize-y ${inputCls}`} placeholder="Add a more detailed description..." />
                  </div>
                  
                  <div className={`border rounded-xl p-4 shadow-sm ${subCard}`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Checklist ({subtasksList.filter(s=>s.is_completed).length}/{subtasksList.length})
                    </h3>
                    
                    {/* Progress bar */}
                    {subtasksList.length > 0 && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-4">
                        <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{width: `${(subtasksList.filter(s=>s.is_completed).length / subtasksList.length) * 100}%`}}></div>
                      </div>
                    )}
                    
                    <div className="space-y-2 mb-3">
                      {subtasksList.map(st => (
                        <div key={st.id} className="flex items-start gap-3 group">
                          <input type="checkbox" disabled={!canEdit} checked={st.is_completed} onChange={() => toggleSubtask(st)} className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700" />
                          <span className={`text-sm flex-1 transition-all ${st.is_completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{st.title}</span>
                          {canEdit && <button onClick={() => delSubtask(st.id)} className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>}
                        </div>
                      ))}
                    </div>
                    {canEdit && <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubtask()} placeholder="Add an item..." className={`border p-2.5 rounded-lg text-sm w-full ${inputCls}`} />}
                  </div>

                  {/* Comments Section integrated neatly */}
                  <div className="pt-4 mt-6 border-t border-gray-100 dark:border-gray-800">
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                      Activity & Comments
                    </h3>
                    <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {taskComments.length === 0 && <p className="text-xs text-gray-500 italic">No comments yet.</p>}
                      {taskComments.map(c => (
                        <div key={c.id} className="flex gap-3">
                           <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-xs shrink-0">
                             {c.user_name.charAt(0).toUpperCase()}
                           </div>
                           <div className={`p-3 rounded-xl rounded-tl-none border shadow-sm flex-1 ${subCard}`}>
                             <div className="font-bold text-xs text-gray-900 dark:text-gray-100 mb-1">{c.user_name}</div>
                             <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{formatMentions(c.text)}</p>
                           </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 relative">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 absolute left-0 top-1">
                        {userData?.name ? userData.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} placeholder="Write a comment... (use @ to mention)" className={`border flex-1 p-2.5 pl-10 rounded-xl text-sm shadow-sm ${inputCls}`} />
                      <button onClick={addComment} className={`px-5 rounded-xl text-sm font-semibold shadow-sm ${primaryBtn}`}>Post</button>
                    </div>
                  </div>
                </div>

                {/* Sidebar/Meta Data Area */}
                <div className="space-y-5">
                  <div className={`p-4 rounded-xl border shadow-sm ${subCard}`}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Status</label>
                    <select disabled={!canEdit} value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`border w-full p-2.5 rounded-lg text-sm font-medium ${inputCls}`}>
                      <option value="todo">To Do</option><option value="doing">In Progress</option><option value="done">Completed</option>
                    </select>

                    <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5 uppercase tracking-wider">Assignee</label>
                    <select disabled={!canEdit} value={editing.assigned_to || ""} onChange={e => setEditing({ ...editing, assigned_to: e.target.value })} className={`border w-full p-2.5 rounded-lg text-sm ${inputCls}`}>
                      <option value="">Unassigned</option>
                      {boardMembers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                    </select>

                    <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5 uppercase tracking-wider">Due Date</label>
                    <input disabled={!canEdit} type="date" value={editing.due_date || ""} onChange={e => setEditing({ ...editing, due_date: e.target.value })} className={`border p-2.5 rounded-lg w-full text-sm ${inputCls}`} />
                  </div>

                  <div className={`p-4 rounded-xl border shadow-sm ${subCard}`}>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Labels</label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_LABELS.map(l => {
                        const isSelected = (editing.labels || "").includes(l.name);
                        return (
                          <button disabled={!canEdit} key={l.name} onClick={() => toggleLabel(l.name)} 
                            className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-all ${isSelected ? 'ring-2 ring-offset-1 ring-indigo-500 dark:ring-offset-[#1f1f22]' : 'opacity-70 hover:opacity-100'} ${isSelected ? l.cls : l.cls}`}>
                            {l.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border shadow-sm ${subCard}`}>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Attachments</label>
                    {editing.attachment_url ? (
                      <div className="mb-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg flex items-center justify-between">
                         <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400 truncate pr-2">File Attached</span>
                         <a href={editing.attachment_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:underline shrink-0">View</a>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mb-3 italic">No files attached.</p>
                    )}
                    {canEdit && (
                      <div className="relative">
                        <input type="file" id="file-upload" onChange={handleFileUpload} className="hidden" />
                        <label htmlFor="file-upload" className={`w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed rounded-lg text-sm font-medium cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${uploading ? 'opacity-50 pointer-events-none' : ''} ${bgCard}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                          {uploading ? "Uploading..." : "Upload File (Max 5MB)"}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer Actions */}
            {canEdit && (
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#18181b] flex justify-end gap-3 shrink-0">
                <button onClick={() => delTask(editing.id)} className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 px-5 py-2.5 rounded-xl border border-red-200 dark:border-red-800/50 text-sm font-semibold transition-colors">Delete Task</button>
                <button onClick={() => setEditing(null)} className={`px-5 py-2.5 rounded-xl border text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${bgCard}`}>Cancel</button>
                <button onClick={saveEdit} className={`px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md ${primaryBtn}`}>Save Changes</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Style overrides for Custom Scrollbar to keep it sleek */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}