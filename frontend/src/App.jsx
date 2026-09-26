// frontend/src/App.jsx - FULL FIXED - Added viewRoleDistribution, Time Tracking, Task Dependencies, Board Chat, Advanced Automations & Recurring Tasks, Global Search, i18n (Multi-Language), Offline PWA Sync & Task Activity Log
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, admin, boards, tasks, subtasks, comments, notifs, uploadFile, boardChat, automations as automationsApi, WS_BASE } from './services/api';
import { formatDate } from './utils/helpers';

// NEW: Offline Sync imports
import { saveTasksLocally, getLocalTasks, saveOfflineAction, syncOfflineActions } from './services/offlineSync';

// NEW: i18n import for Multi-Language Support
import './i18n';
import { useTranslation } from 'react-i18next';

// Components import
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/views/Dashboard';
import BoardView from './components/views/BoardView';
import Timeline from './components/views/Timeline';
import CalendarView from './components/views/CalendarView';
import GanttChartView from './components/views/GanttChartView'; // NEW: Gantt Chart View Import
import TaskModal from './components/TaskModal';
import AccountSettingsPage from './components/views/AccountSettingsPage';
import ReportsPage from './components/views/ReportsPage';
import TeamPage from './components/views/TeamPage';
import AdvancedAutomations from './components/views/AdvancedAutomations';
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

// NEW: Rich Text Editor Component
import RichTextEditor from './components/RichTextEditor';

// NEW: Task Activity Log Component
import TaskActivityLog from './components/TaskActivityLog';

// Views that cannot render anything meaningful without a selected project.
// Everything else (settings, templates, onboarding, resources, feedback, audit)
// must stay reachable on an empty workspace - Templates in particular is how a
// user bootstraps their first project, so gating it behind the empty state
// made the whole screen unreachable.
const BOARD_SCOPED_VIEWS = [
  'dashboard', 'board', 'timeline', 'calendar', 'gantt', 'reports', 'team', 'automations',
];

export default function App() {
  // i18n hooks Setup
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(() => i18n.resolvedLanguage || i18n.language || "en");

  // ഭാഷ മാറ്റുമ്പോൾ i18n ഇന്സ്റ്റൻസിലേക്ക് വിനം അയയ്ക്കുക; React state വഴി എല്ലാ കമ്പൊനന്റുകളും വീണ്ടും റീരെന്റർ ആകും
  const changeLanguage = (lng) => {
    if (!lng || lng === i18n.resolvedLanguage) return;
    setLanguage(lng);
    i18n.changeLanguage(lng);
  };

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [userData, setUserData] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  // NEW STATE FOR OFFLINE SYNC
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("sidebarOpen") !== "false");
  const [profileForm, setProfileForm] = useState({ name: "", email: "", password: "" });
  const [profileAvatar, setProfileAvatar] = useState(localStorage.getItem("profileAvatar") || "");
  const [savingProfile, setSavingProfile] = useState(false);
  
  // NEW STATE FOR CHAT
  const [isChatOpen, setIsChatOpen] = useState(false); 
  const [chatMessages, setChatMessages] = useState([]);

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
    emailNotifications: true, boardUpdates: true, taskReminders: true, weeklyDigest: false, compactMode: false, rememberMe: true, showSessions: false, language: i18n.resolvedLanguage || i18n.language || "en",
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

  // NEW: Offline Sync Event Listeners
  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      if (token) {
        await syncOfflineActions(tasks);
        fetchBoardData(); // Refresh data after syncing
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token, selectedBoard]);

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

  // profilePreferences.language ആണ് ഭാഷയുടെ ഒരൊറ്റ സ്രോതസം: സ്വയം സേവ് ചെയ്തതും ബാക്കെൻഡിൽ നിന്ന് വരുന്നതും ഇവിടെയാണ് പ്രാബക്കുന്നത്
  useEffect(() => {
    const preferred = profilePreferences.language;
    if (preferred && preferred !== i18n.resolvedLanguage) changeLanguage(preferred);
  }, [profilePreferences.language]);

  // യൂസർ തിരഞ്ഞെടുത്ത ഭാഷ profile_preferences-ലേക്ക് എഴുതുക, അതേ ബാക്കെൻഡിലേക്കും പോകും
  useEffect(() => {
    setProfilePreferences((prev) => (prev.language === language ? prev : { ...prev, language }));
  }, [language]);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "b") return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (el?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      setSidebarOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
  // Only board-scoped views get the empty-workspace panel; the rest render normally.
  const needsBoard = BOARD_SCOPED_VIEWS.includes(viewMode) && boardsList.length === 0;

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

    // OFFLINE MODE: Load data from LocalStorage
    if (isOffline) {
      const cachedTasks = getLocalTasks(activeBoardId);
      if (String(selectedBoardRef.current) === String(activeBoardId)) {
          setTasks(cachedTasks);
      }
      return;
    }

    try {
      const tRes = await tasks.getAll(activeBoardId);
      if (String(selectedBoardRef.current) !== String(activeBoardId)) return;
      setTasks(tRes.data);
      saveTasksLocally(activeBoardId, tRes.data); // Save for offline usage

      const aRes = await boards.getActivities(activeBoardId);
      if (String(selectedBoardRef.current) !== String(activeBoardId)) return;
      setActivities(aRes.data);

      const mRes = await boards.getMembers(activeBoardId);
      if (String(selectedBoardRef.current) !== String(activeBoardId)) return;
      setBoardMembers(mRes.data);
      setBoardMembersBoardId(activeBoardId);

    } catch {
      if (String(selectedBoardRef.current) === String(activeBoardId)) {
        setBoardMembers([]);
        setBoardMembersBoardId(activeBoardId);
      }
    }
  };

  const fetchTaskDetails = async (id) => {
    if (!id || isOffline) return; // Skip if offline
    try {
      const cRes = await comments.getAll(id); setTaskComments(cRes.data);
      const sRes = await subtasks.getAll(id); setSubtasks(sRes.data);
      // The task payload deliberately omits activities, so the Activity Log
      // needs its own fetch.
      const aRes = await tasks.getActivities(id).catch(() => ({ data: [] }));
      setEditing(prev => (prev && String(prev.id) === String(id) ? { ...prev, activities: aRes.data || [] } : prev));
    } catch {}
  };

  useEffect(() => { fetchInitialData(); }, [token]);
  useEffect(() => {
    setBoardMembers([]);
    setBoardMembersBoardId(selectedBoard || null);
    fetchBoardData(selectedBoard);
    // Close chat if switching board
    setIsChatOpen(false);
    setChatMessages([]);
    if (!selectedBoard || isOffline) return;
    boardChat.getMessages(selectedBoard)
      .then(res => setChatMessages(res.data || []))
      .catch(() => setChatMessages([]));
  }, [selectedBoard]);
  useEffect(() => { if (editing) fetchTaskDetails(editing.id); }, [editing]);

  useEffect(() => {
    if (!selectedBoard ||!token || isOffline) return;
    // The server validates ?token= and closes with 1008 when it is missing, and
    // also checks board access before accepting the socket.
    const ws = new WebSocket(`${WS_BASE}/ws/${selectedBoard}?token=${encodeURIComponent(token)}`);
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === "update") {
          fetchBoardData();
          notifs.getAll().then(res => setNotifications(res.data));
          if (editing) fetchTaskDetails(editing.id);
        } else if (d.type === "chat") {
          setChatMessages(prev => prev.some(m => String(m.id) === String(d.message?.id)) ? prev : [...prev, d.message]);
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [selectedBoard, isOffline, token]);

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

  // Plan upgrades are not wired up: the billing backend and its checkout flow
  // have been removed. Kept as a single entry point so the existing upgrade
  // buttons in the sidebar and account settings still behave predictably.
  const handleUpgrade = async () => {
    alert("Plan upgrades are not available at the moment. Please contact your workspace owner.");
  };

  const handlePlanSelection = async (planName) => {
    const tier = (planName || '').toLowerCase();
    if (tier === 'enterprise') { alert("Enterprise pricing is handled through sales."); return; }
    if (tier === 'free') { alert("You are already on the free plan"); return; }
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
    
    const newTaskData = { title, status: "todo", priority: prio, board_id: selectedBoard };

    // OFFLINE MODE: Save to queue and update UI
    if (isOffline) {
      const tempId = `temp_${Date.now()}`;
      const tempTask = { ...newTaskData, id: tempId };
      setTasks(prev => [...prev, tempTask]);
      saveOfflineAction({ type: 'CREATE_TASK', payload: newTaskData });
      setTitle("");
      return;
    }

    try {
      await tasks.create(newTaskData);
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
    
    // OFFLINE MODE
    if (isOffline) {
        if (!String(id).startsWith('temp_')) {
            saveOfflineAction({ type: 'UPDATE_TASK', taskId: id, payload: { status: ns } });
        }
        return;
    }

    try { await tasks.update(id, { status: ns }); } catch {}
  };

  const saveEdit = async () => {
    if (!canEdit) return alert("Viewers cannot edit");

    // OFFLINE MODE
    if (isOffline) {
        setTasks(p => p.map(t => String(t.id) === String(editing.id) ? editing : t));
        if (!String(editing.id).startsWith('temp_')) {
            saveOfflineAction({ type: 'UPDATE_TASK', taskId: editing.id, payload: editing });
        }
        setEditing(null);
        return;
    }

    // saveEdit sends the whole task object and has no catch, so any server
    // failure surfaced as an unhandled promise rejection ("Uncaught (in
    // promise) AxiosError") with the edit silently lost. Fail visibly instead.
    try {
      await tasks.update(editing.id, editing);
      setEditing(null);
      fetchBoardData();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.detail || "Could not save changes. Please try again.");
    }
  };

  const delTask = async (id) => {
    if (!canEdit ||!confirm("Delete task?")) return;

    // OFFLINE MODE
    if (isOffline) {
        setTasks(p => p.filter(t => String(t.id) !== String(id)));
        if (!String(id).startsWith('temp_')) {
            saveOfflineAction({ type: 'DELETE_TASK', taskId: id });
        }
        setEditing(null);
        return;
    }

    await tasks.delete(id); setEditing(null); fetchBoardData();
  };

  const addSubtask = async () => {
    if (!canEdit ||!newSubtask.trim() ||!editing || isOffline) return;
    await subtasks.create(editing.id, newSubtask); setNewSubtask(""); fetchTaskDetails(editing.id);
  };
  const toggleSubtask = async (s) => {
    if (!canEdit || isOffline) return;
    await subtasks.update(s.id,!s.is_completed); fetchTaskDetails(editing.id);
  };
  const delSubtask = async (sId) => {
    if (!canEdit || isOffline) return;
    await subtasks.delete(sId); fetchTaskDetails(editing.id);
  };

  const createBoard = async () => {
    if (!newBoardName.trim()) return;
    try {
      const r = await boards.create(newBoardName);
      setNewBoardName(""); await fetchInitialData(); setSelectedBoard(r.data.id);
    } catch (e) { alert(e.response?.data?.detail || "Error"); }
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
    if (!newComment.trim() ||!editing || isOffline) return;
    await comments.create(editing.id, newComment); setNewComment(""); fetchTaskDetails(editing.id);
  };

  const handleFileUpload = async (e) => {
    if (!canEdit ||!e.target.files[0] || isOffline) return;
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
      const updatedTask = await tasks.update(taskId, { recurring: recurringData });
      alert(`Recurring task setup completed successfully!`);
      
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

  const openRecurringModalForTask = (task) => {
    setRecurringTargetTask(task);
    setIsRecurringModalOpen(true);
  };

  const sendChatMessage = async (text) => {
    if (!selectedBoard || !text?.trim()) return;
    try {
      // The server broadcasts to every socket on the board, so do not also
      // append locally or the message renders twice.
      await boardChat.sendMessage(selectedBoard, text.trim());
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to send message");
    }
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
    return <Auth {...{email, setEmail, password, setPassword, name, setName, isRegister, setIsRegister, handleLogin, handleRegister, bgMain, bgCard, inputCls, primaryBtn, t, changeLanguage }} />;
  }

  return (
    <div className={`h-screen w-full p-3 md:p-5 transition-colors duration-200 ${bgMain}`}>
      <div className="app-shell h-full w-full overflow-hidden rounded- border border-white/10 flex relative">
        <Sidebar {...{ darkMode, setDarkMode, userData, myRole, handleUpgrade, boardsList, selectedBoard, setSelectedBoard, newBoardName, setNewBoardName, createBoard, setToken, bgSide, subCard, inputCls, primaryBtn, bgCard, setViewMode, t, changeLanguage, open: sidebarOpen, refreshBoards: fetchInitialData }} />
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          
          {/* OFFLINE INDICATOR BANNER */}
          {isOffline && (
            <div className="bg-yellow-500 text-black text-center text-xs py-1.5 font-semibold z-50 w-full flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"></path></svg>
              You are currently offline. Changes will be synced when connection is restored.
            </div>
          )}

          <Header {...{ boardsList, selectedBoard, exportCSV, viewMode, setViewMode, bgCard, sidebarOpen, toggleSidebar: () => setSidebarOpen((prev) => !prev), t, changeLanguage, language, showNotif, setShowNotif, notifications, setNotifications }} />
          <div className="flex-1 overflow-auto p-6 md:p-8 custom-scrollbar">
          {needsBoard? (
            /* Empty workspace: no project is auto-created, the user names the first one. */
            <div className={`max-w-xl mx-auto mt-10 border rounded-2xl p-8 text-center shadow-sm ${bgCard}`}>
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 text-white flex items-center justify-center text-lg font-black shadow-lg shadow-indigo-500/25">+</div>
              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{t('Create your first project')}</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('Name your project in the sidebar to get started. Nothing is created automatically.')}</p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('templates')}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {t('Start from a template')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('settings')}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
                >
                  {t('Account settings')}
                </button>
              </div>
            </div>
          ) : viewMode === "settings"? (
            <AccountSettingsPage {...{ userData, profileForm, setProfileForm, handleProfileUpdate, savingProfile, profilePreferences, setProfilePreferences, workspaceDefaults, setWorkspaceDefaults, resetProfilePreferences, darkMode, setDarkMode, profileAvatar, setProfileAvatar, handleAvatarUpload, handleDeleteAccount, accountActivity, handleUpgrade, securitySettings, handleVerifyEmail, toggleTwoFactor, toggleConnectedApp, bgCard, inputCls, primaryBtn, setViewMode, t, changeLanguage }} />
          ) : viewMode === "reports"? (
            <ReportsPage {...{ analytics, bgCard, setViewMode, t, changeLanguage }} />
          ) : viewMode === "team"? (
            <TeamPage {...{ bgCard, setViewMode, boardMembers, registeredUsers, setRegisteredUsers, myRole, myPermissions, tasksList, selectedBoard, inviteEmail, setInviteEmail, invitePassword, setInvitePassword, inviteRole, setInviteRole, inviteUser, currentEmail, updateMemberRole, removeMember, t, changeLanguage }} />
          ) : viewMode === "automations"? (
            <AdvancedAutomations {...{ bgCard, setViewMode, darkMode, inputCls, primaryBtn, boardId: selectedBoard, automationsApi, canManage: Boolean(myPermissions.manageAutomations || myPermissions.manageBoard), t, changeLanguage }} />
          ) : viewMode === "audit"? (
            <AuditLogPage {...{ bgCard, setViewMode, t, changeLanguage }} />
          ) : viewMode === "templates"? (
            <TemplatesPage {...{ bgCard, setViewMode, setSelectedBoard, refreshBoards: fetchInitialData, t, changeLanguage }} />
          ) : viewMode === "onboarding"? (
            <OnboardingPage {...{ bgCard, setViewMode, t, changeLanguage }} />
          ) : viewMode === "resources"? (
            <ResourcesPage {...{ bgCard, setViewMode, t, changeLanguage }} />
          ) : viewMode === "feedback"? (
            <FeedbackPage {...{ bgCard, setViewMode, t, changeLanguage }} />
          ) : (
            <>
              {viewMode === "dashboard" && <Dashboard {...{ analytics, activities, bgCard, userData, setViewMode, boardsList, selectedBoard, t, changeLanguage }} />}
              {viewMode === "board" && <BoardView {...{ canEdit, title, setTitle, addTask, onDragEnd, filtered, setEditing, inputCls, primaryBtn, bgKanbanCol, bgTask, t, changeLanguage }} />}
              {viewMode === "timeline" && <Timeline {...{ tasksList, setEditing, timelineDays, bgCard, t, changeLanguage }} />}
              {viewMode === "calendar" && <CalendarView {...{ calDate, tasksList, setEditing, firstDay, daysInMonth, m, y, bgCard, subCard, t, changeLanguage }} />}
              {viewMode === "gantt" && <GanttChartView {...{ tasksList, setEditing, bgCard, darkMode, t, changeLanguage }} />}
            </>
          )}
        </div>
      </main>
      
      {/* 
        NEW: Passed RichTextEditor and TaskActivityLog into TaskModal 
      */}
      {editing && <TaskModal {...{ editing, setEditing, canEdit, saveEdit, delTask, subtasksList, toggleSubtask, delSubtask, newSubtask, setNewSubtask, addSubtask, taskComments, newComment, setNewComment, addComment, boardMembers, toggleLabel, handleFileUpload, uploading, userData, bgCard, inputCls, subCard, primaryBtn, activeTimer, setActiveTimer, startTimer, tasksList, openRecurringModalForTask, RichTextEditor, TaskActivityLog, t, changeLanguage }} />}
      
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
        t={t}
      />

      {activeTimer && <TimeTracker activeTimer={activeTimer} setActiveTimer={setActiveTimer} tasksList={tasksList} setTasks={setTasks} tasksApi={tasks} darkMode={darkMode} t={t} />}

      {/* Board Chat Component */}
      <BoardChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        selectedBoard={selectedBoard} 
        boardMembers={boardMembers} 
        userData={userData} 
        messages={chatMessages}
        setMessages={setChatMessages}
        sendMessage={sendChatMessage}
        chatApi={boardChat}
        canPost={canEdit}
        bgCard={bgCard} 
        inputCls={inputCls} 
        primaryBtn={primaryBtn} 
        subCard={subCard} 
        darkMode={darkMode}
        t={t}
      />

      {/* Global Search Component */}
      <GlobalSearch 
        boardsList={boardsList} 
        tasksList={tasksList} 
        setSelectedBoard={setSelectedBoard} 
        setEditing={setEditing} 
        darkMode={darkMode}
        t={t} 
      />

      {/* Floating Chat Button */}
      {selectedBoard && !['settings', 'billing', 'reports', 'team', 'automations', 'audit', 'templates', 'onboarding', 'resources', 'feedback'].includes(viewMode) && (
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
