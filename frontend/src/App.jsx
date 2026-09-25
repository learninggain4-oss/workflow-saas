// frontend/src/App.jsx - FULL FIXED - Added viewRoleDistribution, Time Tracking, Task Dependencies, Board Chat, Advanced Automations & Recurring Tasks, Global Search
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
// Removed old AutomationPage import and added AdvancedAutomations
import AdvancedAutomations from './components/views/AdvancedAutomations';
import IntegrationsPage from './components/views/IntegrationsPage';
import AuditLogPage from './components/views/AuditLogPage';
import TemplatesPage from './components/views/TemplatesPage';
import OnboardingPage from './components/views/OnboardingPage';
import ResourcesPage from './components/views/ResourcesPage';
import FeedbackPage from './components/views/FeedbackPage';
import TimeTracker from './components/views/TimeTracker'; 
import BoardChat from './components/views/BoardChat'; 

// NEW: Recurring Tasks Component
import RecurringTaskModal from './components/views/RecurringTaskModal';

// NEW: Global Search Component
import GlobalSearch from './components/GlobalSearch';

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
  const [inviteRole, setInviteRole] = useState("administrator");
  const [renameValue, setRenameValue] = useState("");

  const [taskComments, setTaskComments] = useState([]);
  const [subtasksList, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [activities, setActivities] = useState([]);
  const [boardMembers, setBoardMembers] = useState([]);
  const [boardMembersBoardId, setBoardMembersBoardId] = useState(null);
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
  
  // NEW STATE FOR CHAT
  const [isChatOpen, setIsChatOpen] = useState(false); 

  // NEW STATE FOR RECURRING TASKS
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [recurringTargetTask, setRecurringTargetTask] = useState(null);

  const [activeTimer, setActiveTimer] = useState(() => {
    try { return JSON.parse(localStorage.getItem("activeTimer")) || null; } catch { return null; }
  });
  
  useEffect(() => { 
    localStorage.setItem("activeTimer", JSON.stringify(activeTimer)); 
  }, [activeTimer]);

  const startTimer = (taskId) => {
    setActiveTimer({ taskId, startTime: Date.now(), accumulated: 0, isRunning: true });
  };

  const defaultAccountActivity = [
    { id: 1, title: "Signed in", time: "Today" },
    { id: 2, title: "Updated profile", time: "Today" },
  ];
  const [accountActivity, setAccountActivity] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("accountActivity") || "null");
      return saved?.length? saved : defaultAccountActivity;
    } catch {
      return defaultAccountActivity;
    }
  });
  const defaultProfilePreferences = {
    emailNotifications: true, boardUpdates: true, taskReminders: true, weeklyDigest: false, compactMode: false, rememberMe: true, showSessions: false,
  };
  const defaultWorkspaceDefaults = {
    openLastBoard: true, showCompletedTasks: true, autoSaveEdits: true, previewFiles: true, hideArchived: false,
  };
  const defaultSecuritySettings = {
    emailVerified: true, twoFactorEnabled: false,
    connectedApps: [
      { id: 'google', name: 'Google', type: 'OAuth', connected: true },
      { id: 'github', name: 'GitHub', type: 'OAuth', connected: false },
      { id: 'slack', name: 'Slack', type: 'OAuth', connected: true },
    ],
  };
  const [profilePreferences, setProfilePreferences] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("profilePreferences") || "null");
      return saved? {...defaultProfilePreferences,...saved } : defaultProfilePreferences;
    } catch { return defaultProfilePreferences; }
  });
  const [workspaceDefaults, setWorkspaceDefaults] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("workspaceDefaults") || "null");
      return saved? {...defaultWorkspaceDefaults,...saved } : defaultWorkspaceDefaults;
    } catch { return defaultWorkspaceDefaults; }
  });
  const [securitySettings, setSecuritySettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("securitySettings") || "null");
      if (!saved) return defaultSecuritySettings;
      return {...defaultSecuritySettings,...saved, connectedApps: saved.connectedApps?.length? saved.connectedApps : defaultSecuritySettings.connectedApps };
    } catch { return defaultSecuritySettings; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode? 'dark' : 'light';
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (userData) {
      setProfileForm({ name: userData.name || "", email: userData.email || "", password: "" });
    }
  }, [userData]);

  useEffect(() => { localStorage.setItem("profilePreferences", JSON.stringify(profilePreferences)); }, [profilePreferences]);
  useEffect(() => { localStorage.setItem("workspaceDefaults", JSON.stringify(workspaceDefaults)); }, [workspaceDefaults]);
  useEffect(() => { localStorage.setItem("securitySettings", JSON.stringify(securitySettings)); }, [securitySettings]);
  useEffect(() => { localStorage.setItem("profileAvatar", profileAvatar || ""); }, [profileAvatar]);
  useEffect(() => { localStorage.setItem("accountActivity", JSON.stringify(accountActivity)); }, [accountActivity]);

  const currentEmail = useMemo(() => {
    try { return token? JSON.parse(atob(token.split('.')[1])).sub || "" : ""; } catch { return ""; }
  }, [token]);

  const selectedBoardRef = useRef(selectedBoard);
  useEffect(() => {
    selectedBoardRef.current = selectedBoard;
  }, [selectedBoard]);

  const normalizeRoleValue = (role) => {
    const value = String(role || 'editor').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const aliases = { owner: 'owner', administrator: 'administrator', admin: 'administrator', super_admin: 'owner', superadmin: 'owner', editor: 'editor', member: 'editor', guest: 'guest', subscriber: 'subscriber', viewer: 'subscriber' };
    return aliases[value] || 'editor';
  };

  const defaultPermissionsForRole = (role = 'owner') => {
    const normalizedRole = normalizeRoleValue(role);
    if (normalizedRole === 'owner') { return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true, viewRoleDistribution: true }; }
    if (normalizedRole === 'administrator') { return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true, viewRoleDistribution: true }; }
    if (normalizedRole === 'editor') { return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: false, manageBoard: false, viewRoleDistribution: false }; }
    if (normalizedRole === 'guest') { return { viewBoard: true, createTasks: true, editTasks: false, deleteTasks: false, manageMembers: false, manageBoard: false, viewRoleDistribution: false }; }
    if (normalizedRole === 'subscriber') { return { viewBoard: true, createTasks: false, editTasks: false, deleteTasks: false, manageMembers: false, manageBoard: false, viewRoleDistribution: false }; }
    return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true, viewRoleDistribution: true };
  };

  const getMemberPermissions = (member) => {
    const role = normalizeRoleValue(member?.role || 'editor');
    const base = defaultPermissionsForRole(role);
    const custom = member?.permissions && typeof member.permissions === 'object'? member.permissions : {};
    
    if (role === 'owner' || role === 'administrator') {
      return { ...base, ...custom, viewRoleDistribution: true, manageMembers: true, manageBoard: true };
    }
    return {...base,...custom };
  };

  const selectedBoardDetails = useMemo(
    () => boardsList.find((board) => String(board.id) === String(selectedBoard)) || null,
    [boardsList, selectedBoard]
  );

  const currentBoardMember = useMemo(() => {
    if (!selectedBoard || String(boardMembersBoardId) !== String(selectedBoard)) return null;
    return boardMembers.find(x => String(x.email || '').trim().toLowerCase() === String(currentEmail || '').trim().toLowerCase()) || null;
  }, [boardMembers, boardMembersBoardId, currentEmail, selectedBoard]);

  const myRole = useMemo(() => {
    if (!selectedBoard) return normalizeRoleValue(userData?.role || 'editor');
    if (currentBoardMember) return normalizeRoleValue(currentBoardMember.role);
    if (selectedBoardDetails?.role) return normalizeRoleValue(selectedBoardDetails.role);
    if (selectedBoardDetails?.owner_id && userData?.id && String(selectedBoardDetails.owner_id) === String(userData.id)) return 'owner';
    if (userData && normalizeRoleValue(userData.role) === 'owner') return 'owner';
    return "editor";
  }, [currentBoardMember, selectedBoard, selectedBoardDetails, userData]);

  const myPermissions = useMemo(() => {
    if (currentBoardMember) return getMemberPermissions(currentBoardMember);
    if (selectedBoardDetails?.permissions) return getMemberPermissions({ role: myRole, permissions: selectedBoardDetails.permissions });
    return getMemberPermissions({ role: myRole });
  }, [currentBoardMember, myRole, selectedBoardDetails]);

  const canEdit = Boolean(myPermissions.createTasks || myPermissions.editTasks || myPermissions.deleteTasks || myPermissions.manageBoard);
  const isAdminOrOwner = myRole === 'owner' || myRole === 'administrator';

  const fetchInitialData = async () => {
    if (!token) return;
    try {
      const uRes = await auth.getMe();
      const user = uRes.data;
      setUserData(user);
      if (user?.profile_preferences) setProfilePreferences({...defaultProfilePreferences,...user.profile_preferences });
      if (user?.workspace_defaults) setWorkspaceDefaults({...defaultWorkspaceDefaults,...user.workspace_defaults });
      if (user?.security_settings) setSecuritySettings({...defaultSecuritySettings,...user.security_settings, connectedApps: user.security_settings.connectedApps || defaultSecuritySettings.connectedApps });
      if (user?.avatar_url) setProfileAvatar(user.avatar_url);
      const bRes = await boards.getAll(); setBoards(bRes.data);
      if (bRes.data.length > 0 &&!selectedBoard) setSelectedBoard(bRes.data[0].id);
      if (normalizeRoleValue(user?.role) === 'owner') {
        const adminRes = await admin.getUsers();
        setRegisteredUsers(adminRes.data || []);
      } else {
        setRegisteredUsers([]);
      }
      const nRes = await notifs.getAll(); setNotifications(nRes.data);
    } catch {}
  };

  const fetchBoardData = async (boardId = selectedBoard) => {
    if (!boardId) return;
    const activeBoardId = boardId;
    try {
      const tRes = await tasks.getAll(activeBoardId);
      if (String(selectedBoardRef.current) !== String(activeBoardId)) return;
      setTasks(tRes.data);

      const aRes = await boards.getActivities(activeBoardId);
      if (String(selectedBoardRef.current) !== String(activeBoardId)) return;
      setActivities(aRes.data);

      const mRes = await boards.getMembers(activeBoardId);
      if (String(selectedBoardRef.current) !== String(activeBoardId)) return;
      setBoardMembers(mRes.data);
      setBoardMembersBoardId(activeBoardId);

      const b = boardsList.find(x => String(x.id) === String(activeBoardId));
      if (b) setRenameValue(b.name);
    } catch {
      if (String(selectedBoardRef.current) === String(activeBoardId)) {
        setBoardMembers([]);
        setBoardMembersBoardId(activeBoardId);
      }
    }
  };

  const fetchTaskDetails = async (id) => {
    if (!id) return;
    try {
      const cRes = await comments.getAll(id); setTaskComments(cRes.data);
      const sRes = await subtasks.getAll(id); setSubtasks(sRes.data);
    } catch {}
  };

  useEffect(() => { fetchInitialData(); }, [token]);
  useEffect(() => {
    setBoardMembers([]);
    setBoardMembersBoardId(selectedBoard || null);
    fetchBoardData(selectedBoard);
    // Close chat if switching board
    setIsChatOpen(false);
  }, [selectedBoard]);
  useEffect(() => { if (editing) fetchTaskDetails(editing.id); }, [editing]);

  useEffect(() => {
    if (!selectedBoard ||!token) return;
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
    setAccountActivity((prev) => [{ id: Date.now(), title, time: "Just now" },...prev].slice(0, 5));
  };

  const handleUpgrade = async () => {
    try {
      await auth.upgrade();
      const userRes = await auth.getMe();
      setUserData(userRes.data);
      alert("Upgraded to Pro!"); addAccountActivity("Upgraded to Pro");
    } catch { alert("Upgrade failed"); }
  };

  const handlePlanSelection = async (planName) => {
    const tier = (planName || '').toLowerCase();
    if (tier === 'pro') { await handleUpgrade(); return; }
    if (tier === 'free') { alert("You are already on the free plan"); return; }
    if (tier === 'enterprise') { alert("Enterprise pricing is handled through sales."); return; }
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
    if (!title.trim() ||!selectedBoard) return alert("Select board and enter title");
    const prio = (title.toLowerCase().includes("urgent") || title.toLowerCase().includes("bug"))? "high" : "medium";
    try {
      await tasks.create({ title, status: "todo", priority: prio, board_id: selectedBoard });
      setTitle(""); fetchBoardData();
    } catch (e) { alert(e.response?.data?.detail || "Error adding task"); }
  };

  const onDragEnd = async (r) => {
    if (!canEdit || !r.destination) return;
    const id = r.draggableId; 
    const ns = r.destination.droppableId;
    
    const taskToMove = tasksList.find(t => String(t.id) === String(id));
    if (taskToMove && (ns === "doing" || ns === "done")) {
      const deps = taskToMove.dependencies || [];
      const incompleteDeps = tasksList.filter(t => deps.includes(String(t.id)) && t.status !== "done");
      
      if (incompleteDeps.length > 0) {
        alert(`Cannot move this task. It is waiting on ${incompleteDeps.length} incomplete task(s) to be done first!`);
        return;
      }
    }

    setTasks(p => p.map(t => String(t.id) === id? {...t, status: ns } : t));
    try { await tasks.update(id, { status: ns }); } catch {}
  };

  const saveEdit = async () => {
    if (!canEdit) return alert("Viewers cannot edit");
    await tasks.update(editing.id, editing); setEditing(null); fetchBoardData();
  };

  const delTask = async (id) => {
    if (!canEdit ||!confirm("Delete task?")) return;
    await tasks.delete(id); setEditing(null); fetchBoardData();
  };

  const addSubtask = async () => {
    if (!canEdit ||!newSubtask.trim() ||!editing) return;
    await subtasks.create(editing.id, newSubtask); setNewSubtask(""); fetchTaskDetails(editing.id);
  };
  const toggleSubtask = async (s) => {
    if (!canEdit) return;
    await subtasks.update(s.id,!s.is_completed); fetchTaskDetails(editing.id);
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
    if (!renameValue.trim() ||!selectedBoard ||!isAdminOrOwner) return;
    await boards.rename(selectedBoard, renameValue); await fetchInitialData();
  };
  const deleteBoard = async () => {
    if (!selectedBoard ||!isAdminOrOwner ||!confirm("Delete board?")) return;
    await boards.delete(selectedBoard); setSelectedBoard(null); await fetchInitialData();
  };

  const inviteUser = async () => {
    if (!inviteEmail.trim() ||!selectedBoard ||!isAdminOrOwner) return alert("Only owners and admins can invite");
    try {
      const normalizedInviteRole = normalizeRoleValue(inviteRole);
      const res = await boards.invite(selectedBoard, inviteEmail.trim().toLowerCase(), normalizedInviteRole, invitePassword);
      alert(res.data.message || "Invited! Email sent with password & role");
      setInviteEmail(""); setInvitePassword(""); fetchBoardData();
      if (isAdminOrOwner) {
        const adminRes = await admin.getUsers().catch(()=>null);
        if (adminRes) setRegisteredUsers(adminRes.data || []);
      }
    } catch (e) { alert(e.response?.data?.detail || "Invite failed"); }
  };

  const updateMemberRole = async (userId, role, permissions = null) => {
    if (!selectedBoard ||!isAdminOrOwner) return alert("Only owner/admin can change role");
    try {
      const normalizedRole = normalizeRoleValue(role);
      const payload = permissions? { role: normalizedRole, permissions } : { role: normalizedRole };
      await boards.updateMemberRole(selectedBoard, userId, payload);
      await fetchBoardData();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to update member role");
    }
  };

  const removeMember = async (userId) => {
    if (!selectedBoard ||!isAdminOrOwner) return;
    const member = boardMembers.find((m) => String(m.id) === String(userId) || String(m.email).toLowerCase() === String(userId).toLowerCase());
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
    if (!newComment.trim() ||!editing) return;
    await comments.create(editing.id, newComment); setNewComment(""); fetchTaskDetails(editing.id);
  };

  const handleFileUpload = async (e) => {
    if (!canEdit ||!e.target.files[0]) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) return alert("Max 5MB");
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await uploadFile(fd);
      setEditing({...editing, attachment_url: r.data.url }); alert("Uploaded!");
    } catch { alert("Upload failed"); }
    setUploading(false);
  };

  const handleProfileUpdate = async (e) => {
    if (e) e.preventDefault();
    const nameVal = profileForm.name.trim();
    const emailValue = profileForm.email.trim();
    const passwordValue = profileForm.password.trim();
    if (!nameVal) { alert("Name is required"); return; }
    if (!emailValue) { alert("Email is required"); return; }
    setSavingProfile(true);
    try {
      const payload = {
        name: nameVal, email: emailValue, password: passwordValue || "",
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
      if (updatedUser?.profile_preferences) setProfilePreferences({...defaultProfilePreferences,...updatedUser.profile_preferences });
      if (updatedUser?.workspace_defaults) setWorkspaceDefaults({...defaultWorkspaceDefaults,...updatedUser.workspace_defaults });
      if (updatedUser?.security_settings) setSecuritySettings({...defaultSecuritySettings,...updatedUser.security_settings, connectedApps: updatedUser.security_settings.connectedApps || defaultSecuritySettings.connectedApps });
      if (res.data.access_token) { localStorage.setItem("token", res.data.access_token); setToken(res.data.access_token); }
      setProfileForm({ name: updatedUser?.name || nameVal, email: updatedUser?.email || emailValue, password: "" });
      if (updatedUser?.avatar_url) setProfileAvatar(updatedUser.avatar_url);
      addAccountActivity("Updated profile settings"); alert("Profile updated successfully");
    } catch (err) { alert(err.response?.data?.detail || "Failed to update profile"); }
    finally { setSavingProfile(false); }
  };

  const resetProfilePreferences = () => { setProfilePreferences(defaultProfilePreferences); setWorkspaceDefaults(defaultWorkspaceDefaults); };
  
  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Avatar image must be under 2MB"); return; }
    try {
      const formData = new FormData(); formData.append("file", file);
      const res = await uploadFile(formData);
      const avatarUrl = res.data?.url || "";
      setProfileAvatar(avatarUrl);
      if (userData) {
        await auth.updateProfile({
          name: userData.name || profileForm.name, email: userData.email || profileForm.email, password: "",
          avatar_url: avatarUrl, profile_preferences: profilePreferences, workspace_defaults: workspaceDefaults,
          security_settings: { emailVerified: securitySettings.emailVerified, twoFactorEnabled: securitySettings.twoFactorEnabled, connectedApps: securitySettings.connectedApps },
        });
      }
      addAccountActivity("Updated profile photo"); alert("Profile photo updated");
    } catch { alert("Profile photo upload failed"); }
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm("This will clear your stored session and local profile data on this device. Continue?");
    if (!confirmed) return;
    localStorage.clear(); setToken(""); setUserData(null); setBoards([]); setTasks([]); setNotifications([]);
    setProfileForm({ name: "", email: "", password: "" }); setProfileAvatar(""); setViewMode("board");
  };

  const handleVerifyEmail = () => { setSecuritySettings((prev) => ({...prev, emailVerified: true })); addAccountActivity("Verified email address"); };
  
  const toggleTwoFactor = () => {
    setSecuritySettings((prev) => {
      const nextState =!prev.twoFactorEnabled;
      addAccountActivity(nextState? "Enabled two-factor authentication" : "Disabled two-factor authentication");
      return {...prev, twoFactorEnabled: nextState };
    });
  };

  const toggleConnectedApp = (id) => {
    setSecuritySettings((prev) => ({...prev, connectedApps: prev.connectedApps.map((app) => app.id === id? {...app, connected:!app.connected } : app) }));
  };

  const toggleLabel = (lb) => {
    if (!canEdit ||!editing) return;
    const cur = (editing.labels || "").split(",").filter(Boolean);
    const next = cur.includes(lb)? cur.filter(x => x!== lb) : [...cur, lb];
    setEditing({...editing, labels: next.join(",") });
  };

  // RECURRING TASK HANDLER
  const handleSaveRecurringConfig = async (taskId, recurringData) => {
    try {
      // Assuming tasks.update can handle storing extra metadata. 
      // If your backend supports a specific endpoint for recurrences, use that instead.
      const updatedTask = await tasks.update(taskId, { recurring: recurringData });
      alert(`Recurring task setup completed successfully!`);
      
      // Update local state if needed or re-fetch board data
      if (editing && editing.id === taskId) {
        setEditing({...editing, recurring: recurringData});
      }
      fetchBoardData();
      setIsRecurringModalOpen(false);
      setRecurringTargetTask(null);
    } catch (e) {
      alert("Failed to save recurring configuration.");
    }
  };

  // Helper to open recurring modal from TaskModal or anywhere else
  const openRecurringModalForTask = (task) => {
    setRecurringTargetTask(task);
    setIsRecurringModalOpen(true);
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
      total, done, progress: total === 0? 0 : Math.round((done / total) * 100),
      todo: tasksList.filter(t => t.status === "todo").length,
      doing: tasksList.filter(t => t.status === "doing").length,
      overdue: tasksList.filter(t => t.due_date && t.due_date < formatDate(new Date()) && t.status!== "done").length,
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

  const bgMain = darkMode? "bg-[#09090b] text-gray-100" : "bg-[#f8fafc] text-gray-900";
  const bgSide = darkMode? "bg-[#121214] border-gray-800 text-gray-300" : "bg-white border-gray-200 text-gray-700";
  const bgCard = darkMode? "bg-[#18181b] border-gray-800" : "bg-white border-gray-200";
  const bgKanbanCol = darkMode? "bg-[#121214] border-gray-800" : "bg-gray-50 border-gray-100";
  const bgTask = darkMode? "bg-[#18181b] border-gray-700 hover:border-gray-500 hover:shadow-lg" : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md";
  const inputCls = darkMode? "bg-[#09090b] border-gray-700 text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow";
  const subCard = darkMode? "bg-[#1f1f22] border-gray-800" : "bg-gray-50 border-gray-200";
  const primaryBtn = "bg-indigo-600 hover:bg-indigo-700 text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-[#18181b]";

  if (!token) {
    return <Auth {...{email, setEmail, password, setPassword, name, setName, isRegister, setIsRegister, handleLogin, handleRegister, bgMain, bgCard, inputCls, primaryBtn}} />;
  }

  return (
    <div className={`h-screen w-full p-3 md:p-5 transition-colors duration-200 ${bgMain}`}>
      <div className="app-shell h-full w-full overflow-hidden rounded- border border-white/10 flex relative">
        <Sidebar {...{ darkMode, setDarkMode, userData, myRole, handleUpgrade, boardsList, selectedBoard, setSelectedBoard, newBoardName, setNewBoardName, createBoard, renameValue, setRenameValue, renameBoard, deleteBoard, inviteEmail, setInviteEmail, invitePassword, setInvitePassword, inviteRole, setInviteRole, inviteUser, setToken, bgSide, subCard, inputCls, primaryBtn, bgCard, setViewMode }} />
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <Header {...{ boardsList, selectedBoard, exportCSV, viewMode, setViewMode, showNotif, setShowNotif, notifications, setNotifications, bgCard }} />
          <div className="flex-1 overflow-auto p-6 md:p-8 custom-scrollbar">
          {viewMode === "settings"? (
            <AccountSettingsPage {...{ userData, profileForm, setProfileForm, handleProfileUpdate, savingProfile, profilePreferences, setProfilePreferences, workspaceDefaults, setWorkspaceDefaults, resetProfilePreferences, darkMode, setDarkMode, profileAvatar, setProfileAvatar, handleAvatarUpload, handleDeleteAccount, accountActivity, handleUpgrade, securitySettings, handleVerifyEmail, toggleTwoFactor, toggleConnectedApp, bgCard, inputCls, primaryBtn, setViewMode }} />
          ) : viewMode === "billing"? (
            <BillingPage {...{ userData, bgCard, setViewMode, handleUpgrade, handlePlanSelection }} />
          ) : viewMode === "reports"? (
            <ReportsPage {...{ analytics, bgCard, setViewMode }} />
          ) : viewMode === "team"? (
            <TeamPage {...{ bgCard, setViewMode, boardMembers, registeredUsers, setRegisteredUsers, myRole, myPermissions, tasksList, selectedBoard, inviteEmail, setInviteEmail, invitePassword, setInvitePassword, inviteRole, setInviteRole, inviteUser, currentEmail, updateMemberRole, removeMember }} />
          ) : viewMode === "automations"? (
            <AdvancedAutomations {...{ bgCard, setViewMode, darkMode, inputCls, primaryBtn }} />
          ) : viewMode === "integrations"? (
            <IntegrationsPage {...{ bgCard, setViewMode, securitySettings }} />
          ) : viewMode === "audit"? (
            <AuditLogPage {...{ bgCard, setViewMode }} />
          ) : viewMode === "templates"? (
            <TemplatesPage {...{ bgCard, setViewMode }} />
          ) : viewMode === "onboarding"? (
            <OnboardingPage {...{ bgCard, setViewMode }} />
          ) : viewMode === "resources"? (
            <ResourcesPage {...{ bgCard, setViewMode }} />
          ) : viewMode === "feedback"? (
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
      
      {editing && <TaskModal {...{ editing, setEditing, canEdit, saveEdit, delTask, subtasksList, toggleSubtask, delSubtask, newSubtask, setNewSubtask, addSubtask, taskComments, newComment, setNewComment, addComment, boardMembers, toggleLabel, handleFileUpload, uploading, userData, bgCard, inputCls, subCard, primaryBtn, activeTimer, setActiveTimer, startTimer, tasksList, openRecurringModalForTask }} />}
      
      {/* Recurring Task Modal Rendering */}
      <RecurringTaskModal 
        isOpen={isRecurringModalOpen} 
        onClose={() => setIsRecurringModalOpen(false)} 
        task={recurringTargetTask} 
        onSave={handleSaveRecurringConfig} 
        bgCard={bgCard} 
        inputCls={inputCls} 
        primaryBtn={primaryBtn} 
        darkMode={darkMode}
      />

      {activeTimer && <TimeTracker activeTimer={activeTimer} setActiveTimer={setActiveTimer} tasksList={tasksList} setTasks={setTasks} tasksApi={tasks} darkMode={darkMode} />}

      {/* NEW: Board Chat Component */}
      <BoardChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        selectedBoard={selectedBoard} 
        boardMembers={boardMembers} 
        userData={userData} 
        bgCard={bgCard} 
        inputCls={inputCls} 
        primaryBtn={primaryBtn} 
        subCard={subCard} 
        darkMode={darkMode}
      />

      {/* NEW: Global Search Component */}
      <GlobalSearch 
        boardsList={boardsList} 
        tasksList={tasksList} 
        setSelectedBoard={setSelectedBoard} 
        setEditing={setEditing} 
        darkMode={darkMode} 
      />

      {/* NEW: Floating Chat Button */}
      {selectedBoard && !['settings', 'billing', 'reports', 'team', 'automations', 'integrations', 'audit', 'templates', 'onboarding', 'resources', 'feedback'].includes(viewMode) && (
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)} 
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 z-40"
          title="Board Chat"
        >
          {isChatOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          )}
        </button>
      )}

      <style dangerouslySetInnerHTML={{__html: `
       .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
       .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
       .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
       .dark.custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
       .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
      </div>
    </div>
  );
}