import { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

// ================= API CONFIG =================
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

// ================= LABELS CONFIG - ALL LABELS =================
const AVAILABLE_LABELS = [
  { name: "Bug", cls: "bg-red-100 text-red-700 border-red-200" },
  { name: "Feature", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  { name: "Design", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  { name: "Backend", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  { name: "Frontend", cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { name: "Urgent", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
]

const getLabelCls = (name) => {
  const found = AVAILABLE_LABELS.find(l => l.name === name)
  return found?.cls || "bg-gray-100 text-gray-600 border-gray-200"
}

// ================= MAIN APP COMPONENT =================
export default function App() {

  // ---------- AUTH STATES ----------
  const [token, setToken] = useState(localStorage.getItem("token") || "")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isRegister, setIsRegister] = useState(false)

  // ---------- TASK STATES ----------
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState("")
  const [search, setSearch] = useState("")
  const [filterPrio, setFilterPrio] = useState("all")
  const [filterLabel, setFilterLabel] = useState("all")
  const [editing, setEditing] = useState(null)

  // ---------- BOARD STATES ----------
  const [boards, setBoards] = useState([])
  const [selectedBoard, setSelectedBoard] = useState(null)
  const [newBoardName, setNewBoardName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [renameValue, setRenameValue] = useState("")
  const [boardMembers, setBoardMembers] = useState([])

  // ---------- COMMENT & ACTIVITY STATES ----------
  const [taskComments, setTaskComments] = useState([])
  const [newComment, setNewComment] = useState("")
  const [activities, setActivities] = useState([])

  // ---------- FILE & NOTIFICATION STATES ----------
  const [uploading, setUploading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showNotif, setShowNotif] = useState(false)

  // ---------- VIEW & THEME STATES ----------
  const [viewMode, setViewMode] = useState("board") // board or calendar
  const [calDate, setCalDate] = useState(new Date())
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true")

  // ---------- AUTH HEADER ----------
  const authHeader = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }

  // ================= 401 AUTO FIX - INTERCEPTOR =================
  // Token expire aayal automatic logout cheyyum
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          console.log("401 Unauthorized - clearing token, please login again")
          localStorage.removeItem("token")
          setToken("")
          setBoards([])
          setTasks([])
          setSelectedBoard(null)
        }
        return Promise.reject(error)
      }
    )
    return () => axios.interceptors.response.eject(interceptor)
  }, [])

  // ================= DARK MODE PERSIST =================
  useEffect(() => {
    localStorage.setItem("darkMode", String(darkMode))
  }, [darkMode])

  // ================= GET CURRENT USER EMAIL FROM JWT =================
  const getCurrentEmail = () => {
    try {
      if (!token) return ""
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub || ""
    } catch {
      return ""
    }
  }
  const currentEmail = getCurrentEmail()

  // ================= FETCH FUNCTIONS =================
  const fetchBoards = async () => {
    if (!token) return
    try {
      const response = await axios.get(`${API_URL}/api/boards`, authHeader)
      setBoards(response.data)
      if (response.data.length > 0 && !selectedBoard) {
        setSelectedBoard(response.data[0].id)
      }
    } catch (error) {
      console.log("fetchBoards error", error)
    }
  }

  const fetchTasks = async () => {
    if (!token || !selectedBoard) return
    try {
      const response = await axios.get(`${API_URL}/api/tasks?board_id=${selectedBoard}`, authHeader)
      setTasks(response.data)
    } catch (error) {
      console.log("fetchTasks error", error)
    }
  }

  const fetchComments = async (taskId) => {
    if (!taskId) return
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${taskId}/comments`, authHeader)
      setTaskComments(response.data)
    } catch (error) {
      console.log("fetchComments error", error)
    }
  }

  const fetchActivities = async () => {
    if (!selectedBoard) return
    try {
      const response = await axios.get(`${API_URL}/api/boards/${selectedBoard}/activities`, authHeader)
      setActivities(response.data)
    } catch (error) {
      console.log("fetchActivities error", error)
    }
  }

  const fetchBoardMembers = async () => {
    if (!selectedBoard) return
    try {
      const response = await axios.get(`${API_URL}/api/boards/${selectedBoard}/members`, authHeader)
      setBoardMembers(response.data)
    } catch (error) {
      console.log("fetchBoardMembers error", error)
    }
  }

  const fetchNotifications = async () => {
    if (!token) return
    try {
      const response = await axios.get(`${API_URL}/api/notifications`, authHeader)
      setNotifications(response.data)
    } catch (error) {
      console.log("fetchNotifications error", error)
    }
  }

  // ================= USE EFFECTS =================
  useEffect(() => {
    fetchBoards()
    fetchNotifications()
  }, [token])

  useEffect(() => {
    fetchTasks()
    fetchActivities()
    fetchBoardMembers()
    const currentBoard = boards.find(x => x.id === selectedBoard)
    if (currentBoard) {
      setRenameValue(currentBoard.name)
    }
  }, [selectedBoard])

  useEffect(() => {
    if (editing) {
      fetchComments(editing.id)
    }
  }, [editing])

  // WebSocket for real-time updates
  useEffect(() => {
    if (!selectedBoard || !token) return
    const wsBase = API_URL.replace("https://", "wss://").replace("http://", "ws://")
    const ws = new WebSocket(`${wsBase}/ws/${selectedBoard}`)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "update") {
          fetchTasks()
          fetchActivities()
          fetchNotifications()
        }
      } catch {}
    }
    return () => {
      try { ws.close() } catch {}
    }
  }, [selectedBoard])

  // ================= POLLING FALLBACK - REALTIME BACKUP =================
  useEffect(() => {
    if (!token) return
    const intervalId = setInterval(() => {
      if (selectedBoard) {
        fetchTasks()
        fetchNotifications()
        if (editing) fetchComments(editing.id)
      }
    }, 8000)
    return () => clearInterval(intervalId)
  }, [selectedBoard, token, editing])

  // ================= AUTH HANDLERS =================

  const handleLogin = async () => {
    const formData = new URLSearchParams()
    formData.append("username", email)
    formData.append("password", password)
    try {
      const response = await axios.post(`${API_URL}/api/login`, formData)
      localStorage.setItem("token", response.data.access_token)
      setToken(response.data.access_token)
      setEmail("")
      setPassword("")
    } catch (error) {
      alert("Login failed - check email/password")
    }
  }

  const handleRegister = async () => {
    try {
      await axios.post(`${API_URL}/api/register`, { email, password, name })
      alert("Registered! Now login")
      setIsRegister(false)
    } catch (error) {
      alert(error.response?.data?.detail || "Register failed")
    }
  }

  // ================= TASK HANDLERS =================
  const addTask = async () => {
    if (!title.trim() || !selectedBoard) {
      alert("Select board and enter title")
      return
    }
    const lower = title.toLowerCase()
    const priority = (lower.includes("urgent") || lower.includes("bug")) ? "high" : "medium"
    await axios.post(`${API_URL}/api/tasks`, {
      title,
      status: "todo",
      priority,
      description: "",
      due_date: "",
      board_id: selectedBoard,
      assigned_to: "",
      assigned_to_name: "",
      attachment_url: "",
      labels: ""
    }, authHeader)
    setTitle("")
  }

  const onDragEnd = async (result) => {
    if (!result.destination) return
    const draggedId = result.draggableId
    const newStatus = result.destination.droppableId
    // Optimistic update
    setTasks(prev => prev.map(t => String(t.id) === draggedId ? { ...t, status: newStatus } : t))
    await axios.put(`${API_URL}/api/tasks/${draggedId}`, { status: newStatus }, authHeader)
  }

  const openEditModal = (task) => {
    setEditing({ ...task, labels: task.labels || "" })
  }

  const saveEdit = async () => {
    await axios.put(`${API_URL}/api/tasks/${editing.id}`, editing, authHeader)
    setEditing(null)
  }

  const deleteTask = async (taskId) => {
    await axios.delete(`${API_URL}/api/tasks/${taskId}`, authHeader)
    setEditing(null)
  }

  // ================= BOARD HANDLERS =================
  const createBoard = async () => {
    if (!newBoardName.trim()) return
    const response = await axios.post(`${API_URL}/api/boards`, { name: newBoardName }, authHeader)
    setNewBoardName("")
    await fetchBoards()
    setSelectedBoard(response.data.id)
  }

  const renameBoard = async () => {
    if (!renameValue.trim()) return
    await axios.put(`${API_URL}/api/boards/${selectedBoard}`, { name: renameValue }, authHeader)
    await fetchBoards()
  }

  const deleteBoard = async () => {
    if (!confirm("Delete board and all tasks? This cannot be undone!")) return
    await axios.delete(`${API_URL}/api/boards/${selectedBoard}`, authHeader)
    setSelectedBoard(null)
    await fetchBoards()
  }

  const inviteUser = async () => {
    try {
      await axios.post(`${API_URL}/api/boards/${selectedBoard}/invite`, { email: inviteEmail }, authHeader)
      alert("Invited + Email sent!")
      setInviteEmail("")
      fetchBoardMembers()
    } catch (error) {
      alert(error.response?.data?.detail || "Invite failed - user must register first")
    }
  }

  // ================= COMMENT HANDLERS =================
  const addComment = async () => {
    if (!newComment.trim() || !editing) return
    await axios.post(`${API_URL}/api/tasks/${editing.id}/comments`, { text: newComment }, authHeader)
    setNewComment("")
    fetchComments(editing.id)
  }

  // ================= FILE UPLOAD HANDLER =================
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert("Max file size 5MB")
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      })
      setEditing({ ...editing, attachment_url: response.data.url })
      alert("Uploaded successfully!")
    } catch (error) {
      alert("Upload failed - add Cloudinary keys in Render ENV")
    }
    setUploading(false)
  }

  // ================= NOTIFICATION HANDLERS =================
  const markRead = async (notificationId) => {
    await axios.put(`${API_URL}/api/notifications/${notificationId}/read`, {}, authHeader)
    fetchNotifications()
  }

  const markAllRead = async () => {
    await axios.put(`${API_URL}/api/notifications/read-all`, {}, authHeader)
    fetchNotifications()
  }

  const deleteNotif = async (notificationId) => {
    await axios.delete(`${API_URL}/api/notifications/${notificationId}`, authHeader)
    fetchNotifications()
  }

  const testEmail = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/test-email`, {}, authHeader)
      if (response.data.sent) {
        alert(`✅ Email sent to ${response.data.to}\nCheck inbox + spam folder`)
      } else {
        alert(`❌ Email Failed\nHost: ${response.data.config.host}\nFrom: ${response.data.config.from}\nHas Brevo Key: ${response.data.config.has_brevo_key}\n\nHint: Add BREVO_API_KEY=xkeysib-... in Render ENV and verify FROM_EMAIL in Brevo Senders`)
      }
    } catch (error) {
      if (error.response?.status === 401) {
        alert("Session expired - please login again")
        localStorage.removeItem("token")
        setToken("")
      } else {
        alert("Test failed - check backend Render logs")
      }
    }
  }

  const toggleLabel = (labelName) => {
    const currentLabels = (editing.labels || "").split(",").filter(Boolean)
    let nextLabels
    if (currentLabels.includes(labelName)) {
      nextLabels = currentLabels.filter(x => x !== labelName)
    } else {
      nextLabels = [...currentLabels, labelName]
    }
    setEditing({ ...editing, labels: nextLabels.join(",") })
  }

  // ================= CALENDAR HELPERS =================
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDay = (year, month) => {
    return new Date(year, month, 1).getDay()
  }

  const formatDate = (dateObj) => {
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const tasksByDate = (dateString) => {
    return tasks.filter(t => t.due_date === dateString)
  }

  // ================= ANALYTICS =================
  const analytics = useMemo(() => {
    const total = tasks.length
    const todo = tasks.filter(t => t.status === "todo").length
    const doing = tasks.filter(t => t.status === "doing").length
    const done = tasks.filter(t => t.status === "done").length
    const high = tasks.filter(t => t.priority === "high").length
    const my = tasks.filter(t => t.assigned_to === currentEmail).length
    const todayStr = formatDate(new Date())
    const overdue = tasks.filter(t => t.due_date && t.due_date < todayStr && t.status !== "done").length
    const dueToday = tasks.filter(t => t.due_date === todayStr).length
    const progress = total === 0 ? 0 : Math.round((done / total) * 100)
    const labelCount = {}
    const byMember = {}
    tasks.forEach(t => {
      const labels = (t.labels || "").split(",").filter(Boolean)
      labels.forEach(l => {
        labelCount[l] = (labelCount[l] || 0) + 1
      })
      if (t.assigned_to) {
        byMember[t.assigned_to] = (byMember[t.assigned_to] || 0) + 1
      }
    })
    return { total, todo, doing, done, high, my, overdue, dueToday, progress, labelCount, byMember }
  }, [tasks, currentEmail])

  // ================= FILTERED TASKS =================
  const filtered = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || (t.description || "").toLowerCase().includes(search.toLowerCase())
    const matchesPrio = filterPrio === "all" || t.priority === filterPrio
    const matchesLabel = filterLabel === "all" || (t.labels || "").split(",").includes(filterLabel)
    return matchesSearch && matchesPrio && matchesLabel
  })

  // ================= DERIVED VALUES =================
  const currentBoardName = boards.find(b => b.id === selectedBoard)?.name || ""
  const unread = notifications.filter(n => !n.is_read).length
  const year = calDate.getFullYear()
  const month = calDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDay(year, month)
  const monthName = calDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  // ================= THEME CLASSES =================
  const bgMain = darkMode ? "bg-[#0f1115] text-gray-100" : "bg-[#f8fafc] text-gray-900"
  const bgSide = darkMode ? "bg-[#16181d] border-gray-700 text-gray-100" : "bg-white border-gray-200"
  const bgCard = darkMode ? "bg-[#1e2128] border-gray-700" : "bg-white border-gray-200"
  const bgTask = darkMode ? "bg-[#2a2e38] border-gray-700" : "bg-[#f1f5f9] border-gray-200"
  const inputCls = darkMode ? "bg-[#2a2e38] border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900"
  const subCard = darkMode ? "bg-[#252a33] border-gray-700" : "bg-gray-50 border-gray-200"
  const statCard = darkMode ? "bg-[#1e2128] border-gray-700" : "bg-white border-gray-200"

  // ================= LOGIN SCREEN =================
  if (!token) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${bgMain}`}>
        <div className={`p-8 rounded-xl border w-full max-w-[400px] shadow-lg ${bgCard}`}>
          <h1 className="font-bold text-xl mb-1">WorkFlow SaaS 🚀</h1>
          <p className="text-xs text-gray-500 mb-5">Team Task Management + Email + Calendar + Real-time</p>

          {isRegister && (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full Name"
              className={`border w-full p-2.5 mb-3 rounded-lg text-sm ${inputCls}`}
            />
          )}

          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            className={`border w-full p-2.5 mb-3 rounded-lg text-sm ${inputCls}`}
          />

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className={`border w-full p-2.5 mb-4 rounded-lg text-sm ${inputCls}`}
          />

          <button
            onClick={isRegister ? handleRegister : handleLogin}
            className="bg-black text-white w-full p-2.5 rounded-lg text-sm font-bold dark:bg-white dark:text-black hover:opacity-90"
          >
            {isRegister ? "Register" : "Login"}
          </button>

          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-gray-500 mt-4 w-full hover:text-black dark:hover:text-white"
          >
            {isRegister ? "Already have account? Login" : "New here? Create account"}
          </button>
        </div>
      </div>
    )
  }

  // ================= MAIN APP LAYOUT =================
  return (
    <div className={`min-h-screen flex ${bgMain}`}>

      {/* ================= SIDEBAR ================= */}
      <div className={`w-[300px] min-w-[300px] border-r p-5 flex flex-col h-screen sticky top-0 overflow-y-auto ${bgSide}`}>

        {/* Logo + Dark Mode */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-bold text-lg">WorkFlow 🚀</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="border px-3 py-1.5 rounded-lg text-sm bg-black text-white dark:bg-white dark:text-black font-bold"
          >
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>

        {/* Boards List */}
        <h2 className="font-bold text-[11px] uppercase tracking-wider text-gray-500 mb-3">Your Boards</h2>
        <div className="space-y-2 mb-4 max-h-[180px] overflow-auto pr-1">
          {boards.map(board => (
            <button
              key={board.id}
              onClick={() => setSelectedBoard(board.id)}
              className={`w-full text-left p-2.5 rounded-lg text-sm border truncate transition-all ${
                selectedBoard === board.id
                  ? 'bg-black text-white border-black dark:bg-white dark:text-black font-bold shadow'
                  : 'hover:bg-gray-100 dark:hover:bg-[#2a2e38] ' + bgCard
              }`}
            >
              📋 {board.name}
            </button>
          ))}
          {boards.length === 0 && (
            <p className="text-[11px] text-gray-400">No boards yet - create one below</p>
          )}
        </div>

        {/* Create Board */}
        <div className="flex gap-2 mb-6">
          <input
            value={newBoardName}
            onChange={e => setNewBoardName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createBoard()}
            placeholder="New board name"
            className={`border p-2 rounded-lg text-sm flex-1 min-w-0 ${inputCls}`}
          />
          <button
            onClick={createBoard}
            className="bg-black text-white px-3 rounded-lg text-sm font-bold dark:bg-white dark:text-black"
          >
            +
          </button>
        </div>

        {/* Manage Board */}
        {selectedBoard && (
          <div className={`border rounded-lg p-3 mb-4 ${subCard}`}>
            <p className="text-[10px] font-bold uppercase mb-2 opacity-60 tracking-wider">Manage Board</p>
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              placeholder="Board name"
              className={`border w-full p-2 rounded text-xs mb-2 ${inputCls}`}
            />
            <div className="flex gap-2">
              <button
                onClick={renameBoard}
                className={`border flex-1 p-2 rounded text-xs font-bold hover:bg-gray-100 ${bgCard}`}
              >
                Rename
              </button>
              <button
                onClick={deleteBoard}
                className="bg-red-50 text-red-600 border border-red-200 flex-1 p-2 rounded text-xs font-bold hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Invite */}
        <div className="border-t pt-4 mb-4">
          <h3 className="font-bold text-[11px] uppercase mb-3 tracking-wider">Invite Teammate + Email 📧</h3>
          <input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="friend@gmail.com"
            className={`border w-full p-2.5 rounded-lg text-sm mb-2 ${inputCls}`}
          />
          <button
            disabled={!selectedBoard}
            onClick={inviteUser}
            className="bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white w-full p-2.5 rounded-lg text-sm font-bold hover:bg-blue-700"
          >
            Invite + Send Email
          </button>
          <button
            onClick={testEmail}
            className={`mt-2 w-full p-2.5 rounded-lg text-xs border font-bold ${bgCard} hover:bg-gray-100 dark:hover:bg-[#2a2e38]`}
          >
            🧪 Test My Email Config
          </button>
        </div>

        {/* Label Filter */}
        <div className="border-t pt-4 mb-4">
          <h3 className="font-bold text-[11px] uppercase mb-2 tracking-wider">Label Filter 🏷️</h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              onClick={() => setFilterLabel("all")}
              className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${filterLabel === "all" ? "bg-black text-white border-black" : "bg-gray-100 dark:bg-[#2a2e38]"}`}
            >
              All
            </button>
            {AVAILABLE_LABELS.map(label => (
              <button
                key={label.name}
                onClick={() => setFilterLabel(label.name)}
                className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${
                  filterLabel === label.name
                    ? 'bg-black text-white border-black dark:bg-white dark:text-black'
                    : label.cls
                }`}
              >
                {label.name}
              </button>
            ))}
          </div>
        </div>

        {/* Members List */}
        {boardMembers.length > 0 && (
          <div className="border-t pt-4 mb-4">
            <h3 className="font-bold text-[11px] uppercase mb-2 tracking-wider">Members 👥 ({boardMembers.length})</h3>
            <div className="space-y-1 max-h-[100px] overflow-auto">
              {boardMembers.map(member => (
                <div key={member.email} className={`text-[11px] p-1.5 rounded border truncate ${subCard}`}>
                  <span className="font-bold">{member.name}</span>
                  <span className="text-gray-400"> - {member.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Feed */}
        <div className="border-t pt-4 mb-4">
          <h3 className="font-bold text-[11px] uppercase mb-2 tracking-wider">Activity Feed 🔥</h3>
          <div className="max-h-[160px] overflow-auto space-y-1.5 pr-1">
            {activities.length === 0 && (
              <p className="text-[11px] text-gray-400">No activity yet - create tasks</p>
            )}
            {activities.map(activity => (
              <div key={activity.id} className={`text-[11px] p-2 rounded border leading-tight ${subCard}`}>
                <b className="text-blue-500">{activity.user_name}</b> {activity.action}
                <div className="text-[10px] text-gray-400 mt-0.5">{activity.created_at}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout - Fix 401 */}
        <button
          onClick={() => {
            localStorage.clear()
            setToken("")
            setSelectedBoard(null)
            setBoards([])
            setTasks([])
          }}
          className="mt-auto text-xs border p-2.5 rounded-lg font-bold bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
        >
          Logout (Fix 401 Error)
        </button>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div className="flex-1 p-6 lg:p-8 overflow-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h2 className="text-2xl font-bold truncate">
            {currentBoardName || "Select a board"}
          </h2>

          <div className="flex gap-2 items-center flex-wrap">

            {/* View Mode Toggle */}
            <div className={`flex border rounded-lg p-1 ${bgCard}`}>
              <button
                onClick={() => setViewMode("board")}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${
                  viewMode === "board"
                    ? "bg-black text-white dark:bg-white dark:text-black shadow"
                    : "text-gray-500 hover:text-black"
                }`}
              >
                📋 Board
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${
                  viewMode === "calendar"
                    ? "bg-black text-white dark:bg-white dark:text-black shadow"
                    : "text-gray-500 hover:text-black"
                }`}
              >
                📅 Calendar
              </button>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotif(!showNotif)}
                className={`relative border px-4 py-2.5 rounded-lg text-sm font-bold ${bgCard} hover:shadow-sm`}
              >
                🔔 Bell
                {unread > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold animate-pulse">
                    {unread}
                  </span>
                )}
              </button>

              {showNotif && (
                <div className={`absolute right-0 top-12 w-[380px] border rounded-xl shadow-2xl z-50 max-h-[420px] overflow-hidden flex flex-col ${bgCard}`}>
                  <div className={`p-3 border-b flex justify-between items-center ${subCard}`}>
                    <span className="font-bold text-sm">Notifications {unread > 0 && `(${unread} unread)`}</span>
                    <button onClick={markAllRead} className="text-[11px] text-blue-600 font-bold hover:underline">
                      Mark all read
                    </button>
                  </div>
                  <div className="overflow-auto flex-1">
                    {notifications.length === 0 && (
                      <p className="text-xs text-gray-400 p-6 text-center">No notifications yet</p>
                    )}
                    {notifications.map(n => (
                      <div key={n.id} className={`p-3 border-b flex gap-2 ${!n.is_read ? 'bg-blue-50 dark:bg-[#252a33]' : ''}`}>
                        <div className="flex-1">
                          <p className="text-[12px] leading-snug">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{n.created_at} • Email sent 📧</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => markRead(n.id)} className="text-[10px] bg-black text-white px-2.5 py-1 rounded-full font-bold h-fit hover:bg-gray-800">
                            Read
                          </button>
                          <button onClick={() => deleteNotif(n.id)} className="text-[10px] text-gray-400 hover:text-red-500">
                            ✕ Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search tasks..."
              className={`border px-4 py-2.5 w-[160px] rounded-lg text-sm ${inputCls}`}
            />

            {/* Priority Filter */}
            <select
              value={filterPrio}
              onChange={e => setFilterPrio(e.target.value)}
              className={`border px-3 py-2.5 rounded-lg text-sm font-bold ${inputCls}`}
            >
              <option value="all">All Priority</option>
              <option value="high">High 🔥</option>
              <option value="medium">Medium</option>
            </select>
          </div>
        </div>

        {/* ================= DASHBOARD STATS ================= */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">

          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Total Tasks</p>
            <p className="text-2xl font-bold mt-1">{analytics.total}</p>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-black dark:bg-white h-1.5 rounded-full transition-all duration-500" style={{ width: `${analytics.progress}%` }}></div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{analytics.progress}% done</p>
          </div>

          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Todo</p>
            <p className="text-2xl font-bold mt-1">{analytics.todo}</p>
            <p className="text-[10px] text-gray-400 mt-1">To start</p>
          </div>

          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Doing</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{analytics.doing}</p>
            <p className="text-[10px] text-gray-400 mt-1">In progress</p>
          </div>

          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Done ✅</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{analytics.done}</p>
            <p className="text-[10px] text-gray-400 mt-1">Completed</p>
          </div>

          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">High Priority 🔥</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{analytics.high}</p>
            <p className="text-[10px] text-gray-400 mt-1">Urgent</p>
          </div>

          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">My Tasks 👤</p>
            <p className="text-2xl font-bold mt-1">{analytics.my}</p>
            <p className="text-[10px] text-gray-400 mt-1 truncate">{currentEmail.split('@')[0] || "me"}</p>
          </div>

          <div className={`rounded-xl border p-4 shadow-sm ${statCard} ${analytics.overdue > 0 ? 'ring-1 ring-red-400' : ''}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Overdue ⚠️</p>
            <p className={`text-2xl font-bold mt-1 ${analytics.overdue > 0 ? 'text-red-600' : ''}`}>{analytics.overdue}</p>
            <p className="text-[10px] text-gray-400 mt-1">Today: {analytics.dueToday}</p>
          </div>
        </div>

        {/* Labels + Workload Analytics */}
        {(Object.keys(analytics.labelCount).length > 0 || Object.keys(analytics.byMember).length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            <div className={`rounded-xl border p-4 flex flex-wrap gap-2 items-center ${statCard}`}>
              <span className="text-[11px] font-bold uppercase mr-2 tracking-wider">Labels 🏷️:</span>
              {Object.entries(analytics.labelCount).map(([labelName, count]) => (
                <span key={labelName} className={`text-[11px] px-2.5 py-1 rounded-full border font-bold ${getLabelCls(labelName)}`}>
                  {labelName}: {count}
                </span>
              ))}
              {Object.keys(analytics.labelCount).length === 0 && (
                <span className="text-[11px] text-gray-400">No labels yet</span>
              )}
            </div>
            <div className={`rounded-xl border p-4 flex flex-wrap gap-2 items-center ${statCard}`}>
              <span className="text-[11px] font-bold uppercase mr-2 tracking-wider">Workload 👥:</span>
              {Object.entries(analytics.byMember).map(([emailAddr, count]) => (
                <span key={emailAddr} className={`text-[11px] px-2.5 py-1 rounded-full border font-bold ${subCard}`}>
                  {emailAddr.split('@')[0]}: <b>{count}</b>
                </span>
              ))}
              {Object.keys(analytics.byMember).length === 0 && (
                <span className="text-[11px] text-gray-400">No assignees yet</span>
              )}
            </div>
          </div>
        )}

        {/* Add Task Input */}
        <div className="flex gap-3 mb-8">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="New task... (type urgent or bug = high priority)"
            className={`border px-4 py-2.5 w-full max-w-[460px] rounded-lg text-sm shadow-sm ${inputCls}`}
          />
          <button
            onClick={addTask}
            className="bg-black text-white px-6 rounded-lg text-sm font-bold shadow hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            Add Task
          </button>
        </div>

        {/* ================= BOARD VIEW ================= */}
        {viewMode === "board" ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {["todo", "doing", "done"].map(status => (
                <Droppable key={status} droppableId={status}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`rounded-xl border p-4 min-h-[520px] shadow-sm ${bgCard}`}
                    >
                      <h3 className="font-bold uppercase text-[11px] tracking-wider border-b pb-3 mb-3 flex justify-between items-center">
                        <span>{status}</span>
                        <span className="bg-gray-100 dark:bg-[#2a2e38] px-2 py-0.5 rounded-full">
                          {filtered.filter(t => t.status === status).length}
                        </span>
                      </h3>

                      {filtered.filter(t => t.status === status).map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => openEditModal(task)}
                              className={`p-3 rounded-xl mb-3 border cursor-pointer hover:shadow-md transition-all ${bgTask}`}
                            >
                              <div className="font-medium text-[13px] leading-snug line-clamp-2">
                                {task.title}
                              </div>

                              {task.labels && (
                                <div className="flex gap-1 flex-wrap mt-2">
                                  {task.labels.split(",").filter(Boolean).map(label => (
                                    <span key={label} className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${getLabelCls(label)}`}>
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex justify-between items-center mt-2.5">
                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${
                                  task.priority === 'high'
                                    ? 'bg-red-100 text-red-600 border-red-200'
                                    : 'bg-green-100 text-green-700 border-green-200'
                                }`}>
                                  {task.priority}
                                </span>
                                {task.due_date && (
                                  <span className={`text-[10px] ${task.due_date < formatDate(new Date()) && task.status !== 'done' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                    📅 {task.due_date}
                                  </span>
                                )}
                              </div>

                              {task.assigned_to && (
                                <div className="mt-1.5 text-[10px] text-gray-500 flex items-center gap-1">
                                  👤 {task.assigned_to_name || task.assigned_to.split('@')[0]}
                                </div>
                              )}

                              {task.attachment_url && (
                                <div className="text-[10px] text-blue-600 mt-1 font-bold">
                                  📎 Attachment
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        ) : (
          /* ================= CALENDAR VIEW ================= */
          <div className={`rounded-xl border p-5 shadow-sm ${bgCard}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">{monthName}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setCalDate(new Date(year, month - 1, 1))}
                  className={`border px-3 py-1.5 rounded-lg text-sm font-bold ${bgCard} hover:bg-gray-50 dark:hover:bg-[#2a2e38]`}
                >
                  ◀ Prev
                </button>
                <button
                  onClick={() => setCalDate(new Date())}
                  className={`border px-3 py-1.5 rounded-lg text-sm font-bold ${bgCard} hover:bg-gray-50 dark:hover:bg-[#2a2e38]`}
                >
                  Today
                </button>
                <button
                  onClick={() => setCalDate(new Date(year, month + 1, 1))}
                  className={`border px-3 py-1.5 rounded-lg text-sm font-bold ${bgCard} hover:bg-gray-50 dark:hover:bg-[#2a2e38]`}
                >
                  Next ▶
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border rounded-xl overflow-hidden">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className={`p-2.5 text-[11px] font-bold text-center uppercase ${subCard}`}>
                  {day}
                </div>
              ))}

              {Array.from({ length: firstDay }).map((_, index) => (
                <div key={`empty-${index}`} className={`h-[120px] ${bgCard}`}></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const dateString = formatDate(new Date(year, month, day))
                const dayTasks = tasksByDate(dateString)
                const isToday = dateString === formatDate(new Date())
                return (
                  <div
                    key={day}
                    className={`h-[120px] p-2 overflow-hidden ${bgCard} ${isToday ? 'ring-2 ring-black dark:ring-white ring-inset' : ''}`}
                  >
                    <div className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-black text-white dark:bg-white dark:text-black' : ''}`}>
                      {day}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {dayTasks.slice(0, 3).map(t => (
                        <div
                          key={t.id}
                          onClick={() => openEditModal(t)}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer font-bold border ${
                            t.priority === 'high'
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200'
                          }`}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[10px] text-gray-400 font-bold">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================= EDIT MODAL ================= */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl p-6 w-[600px] max-w-full max-h-[92vh] overflow-y-auto shadow-2xl border ${bgCard}`}>

            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Edit Task ✏️</h2>
              <button
                onClick={() => setEditing(null)}
                className={`w-8 h-8 rounded-full border flex items-center justify-center ${subCard} hover:bg-gray-200`}
              >
                ✕
              </button>
            </div>

            {/* Title */}
            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase opacity-60">Title</label>
              <input
                value={editing.title}
                onChange={e => setEditing({ ...editing, title: e.target.value })}
                placeholder="Task title"
                className={`border w-full p-2.5 rounded-xl text-sm font-medium mt-1 ${inputCls}`}
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase opacity-60">Description</label>
              <textarea
                value={editing.description || ""}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                className={`border w-full p-2.5 rounded-xl h-24 text-sm mt-1 ${inputCls}`}
                placeholder="Detailed description..."
              />
            </div>

            {/* Due Date + Priority */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-bold uppercase opacity-60">Due Date</label>
                <input
                  type="date"
                  value={editing.due_date || ""}
                  onChange={e => setEditing({ ...editing, due_date: e.target.value })}
                  className={`border p-2.5 rounded-xl w-full text-sm mt-1 ${inputCls}`}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase opacity-60">Priority</label>
                <select
                  value={editing.priority}
                  onChange={e => setEditing({ ...editing, priority: e.target.value })}
                  className={`border p-2.5 rounded-xl w-full text-sm mt-1 font-bold ${inputCls}`}
                >
                  <option value="medium">Medium</option>
                  <option value="high">High 🔥</option>
                </select>
              </div>
            </div>

            {/* Status */}
            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase opacity-60">Status</label>
              <select
                value={editing.status}
                onChange={e => setEditing({ ...editing, status: e.target.value })}
                className={`border w-full p-2.5 rounded-xl text-sm mt-1 font-bold ${inputCls}`}
              >
                <option value="todo">📋 Todo</option>
                <option value="doing">⚡ Doing</option>
                <option value="done">✅ Done</option>
              </select>
            </div>

            {/* Labels */}
            <div className={`border rounded-xl p-3 mb-3 ${subCard}`}>
              <label className="text-[11px] font-bold uppercase tracking-wider">Labels 🏷️ - Click to toggle</label>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {AVAILABLE_LABELS.map(label => {
                  const isActive = (editing.labels || "").split(",").includes(label.name)
                  return (
                    <button
                      key={label.name}
                      onClick={() => toggleLabel(label.name)}
                      className={`text-[11px] px-3 py-1.5 rounded-full border font-bold transition-all ${
                        isActive
                          ? 'bg-black text-white border-black dark:bg-white dark:text-black scale-105 shadow'
                          : 'hover:scale-105 ' + label.cls
                      }`}
                    >
                      {isActive ? '✓ ' : ''}{label.name}
                    </button>
                  )
                })}
              </div>
              {editing.labels && (
                <p className="text-[10px] text-gray-400 mt-2">Selected: {editing.labels}</p>
              )}
            </div>

            {/* Assign */}
            <div className={`border rounded-xl p-3 mb-3 ${subCard}`}>
              <label className="text-[11px] font-bold uppercase tracking-wider">Assign To 👤 + Email Notification 📧</label>
              <select
                value={editing.assigned_to || ""}
                onChange={e => {
                  const selected = boardMembers.find(m => m.email === e.target.value)
                  setEditing({ ...editing, assigned_to: e.target.value, assigned_to_name: selected?.name || "" })
                }}
                className={`border w-full p-2.5 rounded-xl text-sm mt-2 ${inputCls}`}
              >
                <option value="">Unassigned</option>
                {boardMembers.map(member => (
                  <option key={member.email} value={member.email}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1.5">Assign cheythal automatic bell notification + email pokum</p>
            </div>

            {/* Attachment */}
            <div className={`border rounded-xl p-3 mb-5 ${subCard}`}>
              <label className="text-[11px] font-bold uppercase tracking-wider">Attachment 📎 (Cloudinary / Base64)</label>
              <input
                type="file"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="w-full text-xs mt-2.5 mb-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-black file:text-white file:text-xs dark:file:bg-white dark:file:text-black"
              />
              {uploading && (
                <p className="text-xs text-blue-600 font-bold animate-pulse">Uploading... please wait</p>
              )}
              {editing.attachment_url && (
                <div className="mt-3 text-xs break-all bg-white dark:bg-[#1e2128] border p-2.5 rounded-xl flex justify-between items-center">
                  <a href={editing.attachment_url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline truncate mr-2">
                    📎 View Attachment File
                  </a>
                  <button
                    onClick={() => setEditing({ ...editing, attachment_url: "" })}
                    className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full font-bold hover:bg-red-100"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={saveEdit}
                className="bg-black text-white flex-1 p-3 rounded-xl text-sm font-bold shadow hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                💾 Save + Send Email
              </button>
              <button
                onClick={() => deleteTask(editing.id)}
                className="bg-red-50 text-red-600 flex-1 p-3 rounded-xl border border-red-200 text-sm font-bold hover:bg-red-100"
              >
                🗑️ Delete Task
              </button>
              <button
                onClick={() => setEditing(null)}
                className={`flex-1 p-3 rounded-xl text-sm font-bold border ${subCard} hover:bg-gray-100`}
              >
                Cancel
              </button>
            </div>

            {/* Comments Section */}
            <div className="mt-7 border-t pt-5">
              <h3 className="font-bold text-sm mb-3">Comments 💬 + Email Notify</h3>

              <div className={`max-h-[160px] overflow-y-auto mb-3 space-y-2 border rounded-xl p-2.5 ${subCard}`}>
                {taskComments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No comments yet - be first!</p>
                ) : (
                  taskComments.map(comment => (
                    <div key={comment.id} className={`p-2.5 rounded-xl border ${bgCard}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-blue-600">{comment.user_name}</span>
                        <span className="text-[10px] text-gray-400">{comment.created_at}</span>
                      </div>
                      <p className="text-[13px] mt-1 leading-snug">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addComment()}
                  placeholder="Write a comment... assigned user gets email"
                  className={`border flex-1 p-2.5 rounded-xl text-sm ${inputCls}`}
                />
                <button
                  onClick={addComment}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl text-sm font-bold"
                >
                  Post
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
