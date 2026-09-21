import React, { useState, useEffect, useMemo } from 'react';
import { auth, admin, boards, tasks, subtasks, comments, notifs, uploadFile, WS_BASE } from './services/api';
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
import AccountSettingsPage from './components/views/AccountSettingsPage';
import BillingPage from './components/views/BillingPage';
import ReportsPage from './components/views/ReportsPage';
import TeamPage from './components/views/TeamPage';
import AutomationPage from './components/views/AutomationPage';
import IntegrationsPage from './components/views/IntegrationsPage';
import AuditLogPage from './components/views/AuditLogPage';
import TemplatesPage from './components/views/TemplatesPage';
import OnboardingPage from './components/views/OnboardingPage';
import ResourcesPage from './components/views/ResourcesPage';
import FeedbackPage from './components/views/FeedbackPage';

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
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [renameValue, setRenameValue] = useState("");

  const [taskComments, setTaskComments] = useState([]);
  const [subtasksList, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [activities, setActivities] = useState([]);
  const [boardMembers, setBoardMembers] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [viewMode, setViewMode] = useState("board");
  const [calDate, setCalDate] = useState(new Date());
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");
  const [profileForm, setProfileForm] = useState({ name: "", email: "", password: "" });
  const [profileAvatar, setProfileAvatar] = useState(localStorage.getItem("profileAvatar") || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const defaultAccountActivity = [
    { id: 1, title: "Signed in", time: "Today" },
    { id: 2, title: "Updated profile", time: "Today" },
  ];
  const [accountActivity, setAccountActivity] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("accountActivity") || "null");
      return saved?.length ? saved : defaultAccountActivity;
    } catch {
      return defaultAccountActivity;
    }
  });
  const defaultProfilePreferences = {
    emailNotifications: true,
    boardUpdates: true,
    taskReminders: true,
    weeklyDigest: false,
    compactMode: false,
    rememberMe: true,
    showSessions: false,
  };
  const defaultWorkspaceDefaults = {
    openLastBoard: true,
    showCompletedTasks: true,
    autoSaveEdits: true,
    previewFiles: true,
    hideArchived: false,
  };
  const defaultSecuritySettings = {
    emailVerified: true,
    twoFactorEnabled: false,
    connectedApps: [
      { id: 'google', name: 'Google', type: 'OAuth', connected: true },
      { id: 'github', name: 'GitHub', type: 'OAuth', connected: false },
      { id: 'slack', name: 'Slack', type: 'OAuth', connected: true },
    ],
  };
  const [profilePreferences, setProfilePreferences] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("profilePreferences") || "null");
      return saved ? { ...defaultProfilePreferences, ...saved } : defaultProfilePreferences;
    } catch {
      return defaultProfilePreferences;
    }
  });
  const [workspaceDefaults, setWorkspaceDefaults] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("workspaceDefaults") || "null");
      return saved ? { ...defaultWorkspaceDefaults, ...saved } : defaultWorkspaceDefaults;
    } catch {
      return defaultWorkspaceDefaults;
    }
  });
  const [securitySettings, setSecuritySettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("securitySettings") || "null");
      if (!saved) return defaultSecuritySettings;
      return {
        ...defaultSecuritySettings,
        ...saved,
        connectedApps: saved.connectedApps?.length ? saved.connectedApps : defaultSecuritySettings.connectedApps,
      };
    } catch {
      return defaultSecuritySettings;
    }
  });

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

  useEffect(() => {
    localStorage.setItem("profilePreferences", JSON.stringify(profilePreferences));
  }, [profilePreferences]);

  useEffect(() => {
    localStorage.setItem("workspaceDefaults", JSON.stringify(workspaceDefaults));
  }, [workspaceDefaults]);

  useEffect(() => {
    localStorage.setItem("securitySettings", JSON.stringify(securitySettings));
  }, [securitySettings]);

  useEffect(() => {
    localStorage.setItem("profileAvatar", profileAvatar || "");
  }, [profileAvatar]);

  useEffect(() => {
    localStorage.setItem("accountActivity", JSON.stringify(accountActivity));
  }, [accountActivity]);

  const currentEmail = useMemo(() => {
    try { return token ? JSON.parse(atob(token.split('.')[1])).sub || "" : ""; } catch { return ""; }
  }, [token]);

  const normalizeRoleValue = (role) => {
    const value = String(role || 'editor').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const aliases = {
      owner: 'owner',
      administrator: 'administrator',
      editor: 'editor',
      guest: 'guest',
      subscriber: 'subscriber',
    };
    return aliases[value] || 'editor';
  };

  const defaultPermissionsForRole = (role = 'owner') => {
    const normalizedRole = normalizeRoleValue(role);
    if (normalizedRole === 'owner') {
      return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true };
    }
    if (normalizedRole === 'administrator') {
      return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true };
    }
    if (normalizedRole === 'editor') {
      return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: false, manageBoard: false };
    }
    if (normalizedRole === 'guest') {
      return { viewBoard: true, createTasks: true, editTasks: false, deleteTasks: false, manageMembers: false, manageBoard: false };
    }
    if (normalizedRole === 'subscriber') {
      return { viewBoard: true, createTasks: false, editTasks: false, deleteTasks: false, manageMembers: false, manageBoard: false };
    }
    return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true };
  };

  const getMemberPermissions = (member) => {
    const base = defaultPermissionsForRole(member?.role || 'editor');
    const custom = member?.permissions && typeof member.permissions === 'object' ? member.permissions : {};
    return { ...base, ...custom };
  };

  const myRole = useMemo(() => {
    if (!selectedBoard || boardMembers.length === 0) return "owner";
    const match = boardMembers.find(x => String(x.email || '').trim().toLowerCase() === String(currentEmail || '').trim().toLowerCase());
    return normalizeRoleValue(match?.role || "editor");
  }, [boardMembers, currentEmail, selectedBoard]);

  const myPermissions = useMemo(() => {
    const member = boardMembers.find(x => x.email === currentEmail)
    return getMemberPermissions(member);
  }, [boardMembers, currentEmail]);

  const canEdit = Boolean(myPermissions.createTasks || myPermissions.editTasks || myPermissions.deleteTasks || myPermissions.manageBoard);

  const fetchInitialData = async () => {
    if (!token) return;
    try {
      const uRes = await auth.getMe();
      const user = uRes.data;
      setUserData(user);
      if (user?.profile_preferences) {
        setProfilePreferences({ ...defaultProfilePreferences, ...user.profile_preferences });
      }
      if (user?.workspace_defaults) {
        setWorkspaceDefaults({ ...defaultWorkspaceDefaults, ...user.workspace_defaults });
      }
      if (user?.security_settings) {
        setSecuritySettings({
          ...defaultSecuritySettings,
          ...user.security_settings,
          connectedApps: user.security_settings.connectedApps || defaultSecuritySettings.connectedApps,
        });
      }
      if (user?.avatar_url) setProfileAvatar(user.avatar_url);
      const bRes = await boards.getAll(); setBoards(bRes.data);
      if (bRes.data.length > 0 && !selectedBoard) setSelectedBoard(bRes.data[0].id);
      if (user?.role === 'owner') {
        const adminRes = await admin.getUsers();
        setRegisteredUsers(adminRes.data || []);
      } else {
        setRegisteredUsers([]);
      }
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

  const addAccountActivity = (title) => {
    setAccountActivity((prev) => [{ id: Date.now(), title, time: "Just now" }, ...prev].slice(0, 5));
  };

  const handleUpgrade = async () => {
    try {
      await auth.upgrade();
      const userRes = await auth.getMe();
      setUserData(userRes.data);
      alert("Upgraded to Pro!");
      addAccountActivity("Upgraded to Pro");
    } catch { alert("Upgrade failed"); }
  };

  const handlePlanSelection = async (planName) => {
    const tier = (planName || '').toLowerCase();

    if (tier === 'pro') {
      await handleUpgrade();
      return;
    }

    if (tier === 'free') {
      alert("You are already on the free plan or can stay on it without any upgrade.");
      return;
    }

    if (tier === 'enterprise') {
      alert("Enterprise pricing is handled through sales. Please contact support to set up a custom workspace plan.");
      return;
    }

    alert("This plan is not currently available from the app.");
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
    if (!renameValue.trim() || !selectedBoard || myRole !== 'administrator') return;
    await boards.rename(selectedBoard, renameValue); await fetchInitialData();
  };
  const deleteBoard = async () => {
    if (!selectedBoard || myRole !== 'administrator' || !confirm("Delete board?")) return;
    await boards.delete(selectedBoard); setSelectedBoard(null); await fetchInitialData();
  };
  const inviteUser = async () => {
    if (!inviteEmail.trim() || !selectedBoard || (myRole !== 'administrator' && myRole !== 'owner')) return alert("Only owners and admins can invite");
    try {
      const res = await boards.invite(selectedBoard, inviteEmail, inviteRole, invitePassword);
      alert(res.data.message || "Invited!");
      setInviteEmail("");
      setInvitePassword("");
      fetchBoardData();
    } catch (e) { alert(e.response?.data?.detail || "Invite failed"); }
  };

  const updateMemberRole = async (userId, role, permissions = null) => {
    if (!selectedBoard || myRole !== 'administrator') return;
    try {
      const payload = permissions ? { role, permissions } : { role };
      await boards.updateMemberRole(selectedBoard, userId, payload);
      await fetchBoardData();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to update member role");
    }
  };

  const removeMember = async (userId) => {
    if (!selectedBoard || myRole !== 'administrator') return;
    const member = boardMembers.find((m) => String(m.id) === String(userId));
    const confirmed = window.confirm(`Remove ${member?.name || member?.email || 'this member'} from this board?`);
    if (!confirmed) return;

    try {
      await boards.removeMember(selectedBoard, userId);
      await fetchBoardData();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to remove member");
    }
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
        avatar_url: profileAvatar || "",
        profile_preferences: profilePreferences,
        workspace_defaults: workspaceDefaults,
        security_settings: {
          emailVerified: securitySettings.emailVerified,
          twoFactorEnabled: securitySettings.twoFactorEnabled,
          connectedApps: securitySettings.connectedApps,
        },
      };
      const res = await auth.updateProfile(payload);
      const updatedUser = res.data.user || res.data;
      setUserData(updatedUser);
      if (updatedUser?.profile_preferences) {
        setProfilePreferences({ ...defaultProfilePreferences, ...updatedUser.profile_preferences });
      }
      if (updatedUser?.workspace_defaults) {
        setWorkspaceDefaults({ ...defaultWorkspaceDefaults, ...updatedUser.workspace_defaults });
      }
      if (updatedUser?.security_settings) {
        setSecuritySettings({
          ...defaultSecuritySettings,
          ...updatedUser.security_settings,
          connectedApps: updatedUser.security_settings.connectedApps || defaultSecuritySettings.connectedApps,
        });
      }
      if (res.data.access_token) {
        localStorage.setItem("token", res.data.access_token);
        setToken(res.data.access_token);
      }
      setProfileForm({
        name: updatedUser?.name || name,
        email: updatedUser?.email || emailValue,
        password: "",
      });
      if (updatedUser?.avatar_url) setProfileAvatar(updatedUser.avatar_url);
      addAccountActivity("Updated profile settings");
      alert("Profile updated successfully");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const resetProfilePreferences = () => {
    setProfilePreferences(defaultProfilePreferences);
    setWorkspaceDefaults(defaultWorkspaceDefaults);
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Avatar image must be under 2MB");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadFile(formData);
      const avatarUrl = res.data?.url || "";
      setProfileAvatar(avatarUrl);
      if (userData) {
        await auth.updateProfile({
          name: userData.name || profileForm.name,
          email: userData.email || profileForm.email,
          password: "",
          avatar_url: avatarUrl,
          profile_preferences: profilePreferences,
          workspace_defaults: workspaceDefaults,
          security_settings: {
            emailVerified: securitySettings.emailVerified,
            twoFactorEnabled: securitySettings.twoFactorEnabled,
            connectedApps: securitySettings.connectedApps,
          },
        });
      }
      addAccountActivity("Updated profile photo");
      alert("Profile photo updated");
    } catch {
      alert("Profile photo upload failed");
    }
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm("This will clear your stored session and local profile data on this device. Continue?");
    if (!confirmed) return;

    localStorage.clear();
    setToken("");
    setUserData(null);
    setBoards([]);
    setTasks([]);
    setNotifications([]);
    setProfileForm({ name: "", email: "", password: "" });
    setProfileAvatar("");
    setViewMode("board");
  };

  const handleVerifyEmail = () => {
    setSecuritySettings((prev) => ({ ...prev, emailVerified: true }));
    addAccountActivity("Verified email address");
  };

  const toggleTwoFactor = () => {
    setSecuritySettings((prev) => {
      const nextState = !prev.twoFactorEnabled;
      addAccountActivity(nextState ? "Enabled two-factor authentication" : "Disabled two-factor authentication");
      return { ...prev, twoFactorEnabled: nextState };
    });
  };

  const toggleConnectedApp = (id) => {
    setSecuritySettings((prev) => ({
      ...prev,
      connectedApps: prev.connectedApps.map((app) =>
        app.id === id ? { ...app, connected: !app.connected } : app
      ),
    }));
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
    <div className={`h-screen w-full p-3 md:p-5 transition-colors duration-200 ${bgMain}`}>
      <div className="app-shell h-full w-full overflow-hidden rounded-[28px] border border-white/10 flex">
        <Sidebar {...{ darkMode, setDarkMode, userData, myRole, handleUpgrade, boardsList, selectedBoard, setSelectedBoard, newBoardName, setNewBoardName, createBoard, renameValue, setRenameValue, renameBoard, deleteBoard, inviteEmail, setInviteEmail, invitePassword, setInvitePassword, inviteRole, setInviteRole, inviteUser, setToken, bgSide, subCard, inputCls, primaryBtn, bgCard, setViewMode }} />

        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <Header {...{ boardsList, selectedBoard, exportCSV, viewMode, setViewMode, showNotif, setShowNotif, notifications, setNotifications, bgCard }} />

          <div className="flex-1 overflow-auto p-6 md:p-8 custom-scrollbar">
          {viewMode === "settings" ? (
            <AccountSettingsPage {...{
              userData,
              profileForm,
              setProfileForm,
              handleProfileUpdate,
              savingProfile,
              profilePreferences,
              setProfilePreferences,
              workspaceDefaults,
              setWorkspaceDefaults,
              resetProfilePreferences,
              darkMode,
              setDarkMode,
              profileAvatar,
              setProfileAvatar,
              handleAvatarUpload,
              handleDeleteAccount,
              accountActivity,
              handleUpgrade,
              securitySettings,
              handleVerifyEmail,
              toggleTwoFactor,
              toggleConnectedApp,
              bgCard,
              inputCls,
              primaryBtn,
              setViewMode,
            }} />
          ) : viewMode === "billing" ? (
            <BillingPage {...{ userData, bgCard, setViewMode, handleUpgrade, handlePlanSelection }} />
          ) : viewMode === "reports" ? (
            <ReportsPage {...{ analytics, bgCard, setViewMode }} />
          ) : viewMode === "team" ? (
            <TeamPage {...{ bgCard, setViewMode, boardMembers, registeredUsers, setRegisteredUsers, myRole, myPermissions, tasksList, selectedBoard, inviteEmail, setInviteEmail, invitePassword, setInvitePassword, inviteRole, setInviteRole, inviteUser, currentEmail, updateMemberRole, removeMember }} />
          ) : viewMode === "automations" ? (
            <AutomationPage {...{ bgCard, setViewMode }} />
          ) : viewMode === "integrations" ? (
            <IntegrationsPage {...{ bgCard, setViewMode, securitySettings }} />
          ) : viewMode === "audit" ? (
            <AuditLogPage {...{ bgCard, setViewMode }} />
          ) : viewMode === "templates" ? (
            <TemplatesPage {...{ bgCard, setViewMode }} />
          ) : viewMode === "onboarding" ? (
            <OnboardingPage {...{ bgCard, setViewMode }} />
          ) : viewMode === "resources" ? (
            <ResourcesPage {...{ bgCard, setViewMode }} />
          ) : viewMode === "feedback" ? (
            <FeedbackPage {...{ bgCard, setViewMode }} />
          ) : (
            <>
              {viewMode === "dashboard" && <Dashboard {...{ analytics, activities, bgCard, userData, setViewMode, boardsList, selectedBoard }} />}

              {viewMode === "board" && <BoardView {...{ canEdit, title, setTitle, addTask, onDragEnd, filtered, setEditing, inputCls, primaryBtn, bgKanbanCol, bgTask }} />}

              {viewMode === "timeline" && <Timeline {...{ tasksList, setEditing, timelineDays, bgCard }} />}

              {viewMode === "calendar" && <CalendarView {...{ calDate, tasksList, setEditing, firstDay, daysInMonth, m, y, bgCard, subCard }} />}
            </>
          )}
        </div>
      </main>

      {editing && <TaskModal {...{ editing, setEditing, canEdit, saveEdit, delTask, subtasksList, toggleSubtask, delSubtask, newSubtask, setNewSubtask, addSubtask, taskComments, newComment, setNewComment, addComment, boardMembers, toggleLabel, handleFileUpload, uploading, userData, bgCard, inputCls, subCard, primaryBtn }} />}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
      </div>
    </div>
  );
}