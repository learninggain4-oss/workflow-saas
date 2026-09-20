import React, { useState, useEffect, useMemo } from 'react';
import { auth, boards, tasks, subtasks, comments, notifs, uploadFile, WS_BASE } from './services/api';
import { formatDate } from './utils/helpers';

// Components import
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/views/Dashboard';
import BoardView from './components/views/BoardView';
import Timeline from './components/views/Timeline';
import CalendarView from './components/views/CalendarView';
import TaskModal from './components/TaskModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';

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
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", password: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (userData) {
      setProfileForm({
        name: userData.name || "",
        email: userData.email || "",
        password: "",
      });
    }
  }, [userData]);

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

  const handleProfileUpdate = async (e) => {
    if (e) e.preventDefault();

    const name = profileForm.name.trim();
    const emailValue = profileForm.email.trim();
    const passwordValue = profileForm.password.trim();

    if (!name) {
      alert("Name is required");
      return;
    }

    if (!emailValue) {
      alert("Email is required");
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        name,
        email: emailValue,
        password: passwordValue || "",
      };
      const res = await auth.updateProfile(payload);
      setUserData(res.data.user);
      if (res.data.access_token) {
        localStorage.setItem("token", res.data.access_token);
        setToken(res.data.access_token);
      }
      setProfileForm({
        name: res.data.user?.name || name,
        email: res.data.user?.email || emailValue,
        password: "",
      });
      setShowProfileSettings(false);
      alert("Profile updated successfully");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleLabel = (lb) => {
    if (!canEdit || !editing) return;
    const cur = (editing.labels || "").split(",").filter(Boolean);
    const next = cur.includes(lb) ? cur.filter(x => x !== lb) : [...cur, lb];
    setEditing({ ...editing, labels: next.join(",") });
  };

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

  if (!token) {
    return <Auth {...{email, setEmail, password, setPassword, name, setName, isRegister, setIsRegister, handleLogin, handleRegister, bgMain, bgCard, inputCls, primaryBtn}} />;
  }

  return (
    <div className={`h-screen w-full flex overflow-hidden transition-colors duration-200 ${bgMain}`}>
      <Sidebar {...{ darkMode, setDarkMode, userData, myRole, handleUpgrade, boardsList, selectedBoard, setSelectedBoard, newBoardName, setNewBoardName, createBoard, renameValue, setRenameValue, renameBoard, deleteBoard, inviteEmail, setInviteEmail, inviteRole, setInviteRole, inviteUser, setToken, bgSide, subCard, inputCls, primaryBtn, bgCard, setShowProfileSettings }} />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <Header {...{ boardsList, selectedBoard, exportCSV, viewMode, setViewMode, showNotif, setShowNotif, notifications, setNotifications, bgCard }} />

        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
          {viewMode === "dashboard" && <Dashboard {...{ analytics, activities, bgCard }} />}
          
          {viewMode === "board" && <BoardView {...{ canEdit, title, setTitle, addTask, onDragEnd, filtered, setEditing, inputCls, primaryBtn, bgKanbanCol, bgTask }} />}
          
          {viewMode === "timeline" && <Timeline {...{ tasksList, setEditing, timelineDays, bgCard }} />}
          
          {viewMode === "calendar" && <CalendarView {...{ calDate, tasksList, setEditing, firstDay, daysInMonth, m, y, bgCard, subCard }} />}
        </div>
      </main>

      {editing && <TaskModal {...{ editing, setEditing, canEdit, saveEdit, delTask, subtasksList, toggleSubtask, delSubtask, newSubtask, setNewSubtask, addSubtask, taskComments, newComment, setNewComment, addComment, boardMembers, toggleLabel, handleFileUpload, uploading, userData, bgCard, inputCls, subCard, primaryBtn }} />}

      <ProfileSettingsModal
        show={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        handleProfileUpdate={handleProfileUpdate}
        userData={userData}
        savingProfile={savingProfile}
        bgCard={bgCard}
        inputCls={inputCls}
        primaryBtn={primaryBtn}
      />

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