import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { auth, boards, tasks, subtasks, comments, notifs, uploadFile, WS_BASE } from './services/api';

const AVAILABLE_LABELS = [
  {name:"Bug", cls:"bg-red-100 text-red-700 border-red-200"},
  {name:"Feature", cls:"bg-blue-100 text-blue-700 border-blue-200"},
  {name:"Design", cls:"bg-purple-100 text-purple-700 border-purple-200"},
  {name:"Backend", cls:"bg-orange-100 text-orange-700 border-orange-200"},
  {name:"Frontend", cls:"bg-cyan-100 text-cyan-700 border-cyan-200"},
  {name:"Urgent", cls:"bg-yellow-100 text-yellow-800 border-yellow-200"},
];
const getLabelCls = (name) => AVAILABLE_LABELS.find(l=>l.name===name)?.cls || "bg-gray-100 text-gray-600 border-gray-200";

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

  const formatMentions = (text) => text.split(/(@[\w\.-]+@[\w\.-]+)/g).map((p, i) => p.startsWith("@") ? <b key={i} className="text-blue-500">{p}</b> : p);

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

  const bgMain = darkMode ? "bg-[#0f1115] text-gray-100" : "bg-[#f8fafc] text-gray-900";
  const bgSide = darkMode ? "bg-[#16181d] border-gray-700 text-gray-100" : "bg-white border-gray-200";
  const bgCard = darkMode ? "bg-[#1e2128] border-gray-700" : "bg-white border-gray-200";
  const bgTask = darkMode ? "bg-[#2a2e38] border-gray-700" : "bg-[#f1f5f9] border-gray-200";
  const inputCls = darkMode ? "bg-[#2a2e38] border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900";
  const subCard = darkMode ? "bg-[#252a33] border-gray-700" : "bg-gray-50 border-gray-200";

  if (!token) return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${bgMain}`}>
      <div className={`p-8 rounded-xl border w-full max-w-md shadow-lg ${bgCard}`}>
        <h1 className="font-bold text-xl mb-1">WorkFlow SaaS 🚀</h1>
        <p className="text-xs text-gray-500 mb-5">Team Task Management + Email</p>
        {isRegister && <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className={`border w-full p-2.5 mb-3 rounded-lg text-sm ${inputCls}`} />}
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={`border w-full p-2.5 mb-3 rounded-lg text-sm ${inputCls}`} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={`border w-full p-2.5 mb-4 rounded-lg text-sm ${inputCls}`} />
        <button onClick={isRegister ? handleRegister : handleLogin} className="bg-black text-white w-full p-2.5 rounded-lg text-sm font-bold dark:bg-white dark:text-black">{isRegister ? "Register" : "Login"}</button>
        <button onClick={() => setIsRegister(!isRegister)} className="text-sm text-gray-500 mt-4 w-full hover:text-black dark:hover:text-white">{isRegister ? "Have account? Login" : "New? Create account"}</button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen flex ${bgMain}`}>
      <div className={`w-64 min-w-[16rem] border-r p-5 flex flex-col h-screen sticky top-0 overflow-y-auto ${bgSide}`}>
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-bold text-lg">WorkFlow 🚀</h1>
          <button onClick={() => setDarkMode(!darkMode)} className="border px-3 py-1.5 rounded-lg text-sm bg-black text-white dark:bg-white dark:text-black">{darkMode ? "☀" : "🌙"}</button>
        </div>
        {userData && (
          <div className={`border p-3 rounded-xl mb-4 ${subCard}`}>
            <p className="font-bold text-sm truncate">{userData.name || userData.email.split('@')[0]}</p>
            <p className="text-xs text-gray-500 truncate">{userData.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${userData.subscription_tier === 'pro' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-200 text-gray-600 border-gray-300'}`}>{userData.subscription_tier} Plan</span>
              {userData.subscription_tier === 'free' && <button onClick={handleUpgrade} className="text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded hover:bg-purple-700">Upgrade</button>}
            </div>
          </div>
        )}
        <p className="text-xs text-blue-500 font-bold mb-4">Role: {myRole.toUpperCase()}</p>
        <h2 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-3">Your Boards</h2>
        <div className="space-y-2 mb-4 max-h-48 overflow-auto">
          {boardsList.map(b => (
            <button key={b.id} onClick={() => setSelectedBoard(b.id)} className={`w-full text-left p-2.5 rounded-lg text-sm border truncate transition ${selectedBoard === b.id ? 'bg-black text-white border-black font-bold' : 'hover:bg-gray-100 dark:hover:bg-[#2a2e38] ' + bgCard}`}>📋 {b.name}</button>
          ))}
        </div>
        <div className="flex gap-2 mb-6">
          <input value={newBoardName} onChange={e => setNewBoardName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createBoard()} placeholder="New board" className={`border p-2 rounded-lg text-sm flex-1 min-w-0 ${inputCls}`} />
          <button onClick={createBoard} className="bg-black text-white px-3 rounded-lg text-sm font-bold dark:bg-white dark:text-black">+</button>
        </div>
        {selectedBoard && myRole === 'admin' && (
          <div className={`border rounded-lg p-3 mb-4 ${subCard}`}>
            <p className="text-xs font-bold uppercase mb-2 opacity-60">Manage Board</p>
            <input value={renameValue} onChange={e => setRenameValue(e.target.value)} className={`border w-full p-2 rounded text-xs mb-2 ${inputCls}`} />
            <div className="flex gap-2"><button onClick={renameBoard} className={`border flex-1 p-2 rounded text-xs font-bold ${bgCard}`}>Rename</button><button onClick={deleteBoard} className="bg-red-50 text-red-600 border border-red-200 flex-1 p-2 rounded text-xs font-bold">Delete</button></div>
          </div>
        )}
        {myRole === 'admin' && (
          <div className="border-t pt-4 mb-4">
            <h3 className="font-bold text-xs uppercase mb-3">Invite Teammate 📧</h3>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email" className={`border w-full p-2 rounded-lg text-sm mb-2 ${inputCls}`} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={`border w-full p-2 rounded-lg text-sm mb-2 ${inputCls}`}><option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select>
            <button onClick={inviteUser} className="bg-blue-600 text-white w-full p-2 rounded-lg text-sm font-bold">Invite</button>
          </div>
        )}
        <button onClick={() => { localStorage.clear(); setToken(""); }} className={`mt-auto text-xs border p-2.5 rounded-lg font-bold hover:bg-red-50 hover:text-red-600 ${bgCard}`}>Logout</button>
      </div>

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold truncate">{boardsList.find(b => b.id === selectedBoard)?.name || "Select board"}</h2>
            {selectedBoard && <button onClick={exportCSV} className={`px-3 py-1.5 border rounded-lg text-xs font-bold hover:shadow-sm ${bgCard}`}>⬇ CSV</button>}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className={`flex border rounded-lg p-1 ${bgCard}`}>
              {["dashboard", "board", "timeline", "calendar"].map(m => (
                <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1.5 rounded-md text-sm font-bold capitalize transition ${viewMode === m ? "bg-black text-white dark:bg-white dark:text-black shadow" : "text-gray-500"}`}>{m}</button>
              ))}
            </div>
            <button onClick={() => setShowNotif(!showNotif)} className={`relative border px-4 py-2.5 rounded-lg text-sm font-bold ${bgCard}`}>🔔 {notifications.filter(n => !n.is_read).length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 flex justify-center items-center rounded-full animate-pulse">{notifications.filter(n => !n.is_read).length}</span>}</button>
            {showNotif && (
              <div className={`absolute right-8 top-20 w-80 border rounded-xl shadow-2xl z-50 max-h-96 overflow-auto ${bgCard}`}>
                <div className="p-3 border-b flex justify-between"><span className="font-bold text-sm">Notifications</span><button onClick={() => { notifs.markAllRead(); notifs.getAll().then(r => setNotifications(r.data)); }} className="text-xs text-blue-600">Mark read</button></div>
                {notifications.map(n => (
                  <div key={n.id} className="p-3 border-b text-sm">{n.message} <button onClick={() => { notifs.delete(n.id); notifs.getAll().then(r => setNotifications(r.data)); }} className="text-red-500 text-xs ml-2">X</button></div>
                ))}
              </div>
            )}
          </div>
        </div>

        {viewMode === "dashboard" && (
           <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className={`rounded-xl border p-4 shadow-sm ${bgCard}`}><p className="text-xs uppercase text-gray-500 font-bold">Total Tasks</p><p className="text-2xl font-bold mt-1">{analytics.total}</p></div>
              <div className={`rounded-xl border p-4 shadow-sm ${bgCard}`}><p className="text-xs uppercase text-gray-500 font-bold">Done</p><p className="text-2xl font-bold mt-1 text-green-600">{analytics.done}</p></div>
              <div className={`rounded-xl border p-4 shadow-sm ${bgCard}`}><p className="text-xs uppercase text-gray-500 font-bold">Overdue</p><p className="text-2xl font-bold mt-1 text-red-600">{analytics.overdue}</p></div>
            </div>
            <div className={`rounded-xl border p-5 ${bgCard} max-h-96 overflow-y-auto`}><h3 className="font-bold mb-4">Activity Feed</h3>{activities.map(a => <div key={a.id} className="text-sm border-b py-2"><b className="text-blue-500">{a.user_name}</b> {a.action}</div>)}</div>
          </div>
        )}

        {viewMode === "board" && (
          <>
            {canEdit && (
              <div className="flex gap-3 mb-6">
                <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="New task..." className={`border px-4 py-2.5 w-full max-w-2xl rounded-lg text-sm ${inputCls}`} />
                <button onClick={addTask} className="bg-black text-white px-6 rounded-lg text-sm font-bold">Add Task</button>
              </div>
            )}
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {["todo", "doing", "done"].map(s => (
                  <Droppable key={s} droppableId={s} isDropDisabled={!canEdit}>{(p) => (
                    <div ref={p.innerRef} {...p.droppableProps} className={`rounded-xl border p-4 min-h-[200px] shadow-sm ${bgCard}`}>
                      <h3 className="font-bold uppercase text-sm border-b pb-3 mb-3">{s}</h3>
                      {filtered.filter(t => t.status === s).map((t, i) => (
                        <Draggable key={t.id} draggableId={String(t.id)} index={i} isDragDisabled={!canEdit}>{(pr) => (
                          <div ref={pr.innerRef} {...pr.draggableProps} {...pr.dragHandleProps} onClick={() => setEditing({ ...t, labels: t.labels || "" })} className={`p-3 rounded-xl mb-3 border cursor-pointer ${bgTask}`}>
                            <div className="font-medium text-sm">{t.title}</div>
                            {t.labels && <div className="flex gap-1 mt-2">{t.labels.split(",").filter(Boolean).map(lb => <span key={lb} className={`text-xs px-2 py-0.5 rounded-full border ${getLabelCls(lb)}`}>{lb}</span>)}</div>}
                          </div>
                        )}</Draggable>
                      ))}{p.placeholder}
                    </div>
                  )}</Droppable>
                ))}
              </div>
            </DragDropContext>
          </>
        )}

        {viewMode === "timeline" && (
          <div className={`rounded-xl border p-5 shadow-sm overflow-x-auto ${bgCard}`}>
            <h3 className="font-bold text-lg mb-4">Timeline</h3>
            <div className="min-w-[800px]">
              {tasksList.filter(t => t.start_date && t.due_date).map(t => (
                <div key={t.id} onClick={() => setEditing({ ...t, labels: t.labels || "" })} className="grid grid-cols-[200px_repeat(14,1fr)] gap-1 mb-2 items-center cursor-pointer py-1">
                  <div className="text-sm truncate pr-2">{t.title}</div>
                  <div style={{ gridColumn: `${Math.max(2, timelineDays.indexOf(t.start_date) + 2)} / span ${timelineDays.indexOf(t.due_date) - timelineDays.indexOf(t.start_date) + 1}` }} className="h-6 rounded-md bg-blue-500 text-xs flex items-center font-bold text-white px-2">{t.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === "calendar" && (
          <div className={`rounded-xl border p-5 shadow-sm ${bgCard}`}>
            <h3 className="font-bold text-lg mb-4">{calDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <div className="grid grid-cols-7 gap-px bg-gray-200 border rounded-xl overflow-hidden">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className={`p-2.5 text-xs font-bold text-center ${subCard}`}>{d}</div>)}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className={`min-h-[100px] ${bgCard}`}></div>)}
              {Array.from({ length: daysInMonth }).map((_, idx) => (
                <div key={idx} className={`min-h-[100px] p-2 ${bgCard}`}>
                  <div className="text-sm font-bold w-6 h-6 flex items-center justify-center">{idx + 1}</div>
                  {tasksList.filter(t => t.due_date === formatDate(new Date(y, m, idx + 1))).map(t => (
                    <div key={t.id} onClick={() => setEditing({ ...t, labels: t.labels || "" })} className="text-xs px-1.5 py-0.5 mt-1 rounded cursor-pointer font-bold border bg-blue-100 text-blue-700 truncate">{t.title}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border ${bgCard}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Edit Task</h2>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-full border">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <input disabled={!canEdit} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className={`border w-full p-2.5 mb-3 rounded-xl text-sm ${inputCls}`} />
                <textarea disabled={!canEdit} value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} className={`border w-full p-2.5 mb-3 rounded-xl h-24 text-sm ${inputCls}`} />
                <div className={`border rounded-xl p-3 mb-3 ${subCard}`}>
                  <h3 className="text-xs font-bold uppercase mb-2">Checklist</h3>
                  {subtasksList.map(st => (
                    <div key={st.id} className="flex items-center gap-2 mb-2">
                      <input type="checkbox" disabled={!canEdit} checked={st.is_completed} onChange={() => toggleSubtask(st)} />
                      <span className="text-sm flex-1">{st.title}</span>
                      {canEdit && <button onClick={() => delSubtask(st.id)} className="text-xs text-red-500">Del</button>}
                    </div>
                  ))}
                  {canEdit && <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubtask()} placeholder="Add item" className={`border p-2 rounded-lg text-sm w-full mt-2 ${inputCls}`} />}
                </div>
                {canEdit && <input type="file" onChange={handleFileUpload} className="w-full text-xs mb-3" />}
                {editing.attachment_url && <a href={editing.attachment_url} target="_blank" className="text-blue-500 text-xs">View Attachment</a>}
              </div>
              <div>
                <select disabled={!canEdit} value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`border w-full p-2.5 rounded-xl text-sm mb-3 ${inputCls}`}><option value="todo">Todo</option><option value="doing">Doing</option><option value="done">Done</option></select>
                <input disabled={!canEdit} type="date" value={editing.due_date || ""} onChange={e => setEditing({ ...editing, due_date: e.target.value })} className={`border p-2.5 rounded-xl w-full text-sm mb-3 ${inputCls}`} />
                <div className="flex flex-wrap gap-2 mb-3">
                  {AVAILABLE_LABELS.map(l => (
                    <button disabled={!canEdit} key={l.name} onClick={() => toggleLabel(l.name)} className={`text-xs px-3 py-1.5 rounded-full border ${(editing.labels || "").includes(l.name) ? 'bg-black text-white' : l.cls}`}>{l.name}</button>
                  ))}
                </div>
                <select disabled={!canEdit} value={editing.assigned_to || ""} onChange={e => setEditing({ ...editing, assigned_to: e.target.value })} className={`border w-full p-2.5 rounded-xl text-sm ${inputCls}`}><option value="">Unassigned</option>{boardMembers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}</select>
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-3 mt-4 border-t pt-4">
                <button onClick={saveEdit} className="bg-black text-white flex-1 p-3 rounded-xl text-sm font-bold">Save</button>
                <button onClick={() => delTask(editing.id)} className="bg-red-50 text-red-600 flex-1 p-3 rounded-xl border font-bold">Delete</button>
              </div>
            )}
            <div className="mt-6 border-t pt-5">
              <h3 className="font-bold text-sm mb-3">Comments</h3>
              {taskComments.map(c => <div key={c.id} className={`p-2.5 rounded-xl border mb-2 ${bgCard}`}><span className="font-bold text-xs text-blue-600">{c.user_name}</span><p className="text-sm">{formatMentions(c.text)}</p></div>)}
              <div className="flex gap-2 mt-3"><input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} className={`border flex-1 p-2.5 rounded-xl text-sm ${inputCls}`} /><button onClick={addComment} className="bg-blue-600 text-white px-5 rounded-xl text-sm font-bold">Post</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

//(Clean UI Component)