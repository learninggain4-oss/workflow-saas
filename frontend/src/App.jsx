import { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

const AVAILABLE_LABELS = [
  {name:"Bug", cls:"bg-red-100 text-red-700 border-red-200"},
  {name:"Feature", cls:"bg-blue-100 text-blue-700 border-blue-200"},
  {name:"Design", cls:"bg-purple-100 text-purple-700 border-purple-200"},
  {name:"Backend", cls:"bg-orange-100 text-orange-700 border-orange-200"},
  {name:"Frontend", cls:"bg-cyan-100 text-cyan-700 border-cyan-200"},
  {name:"Urgent", cls:"bg-yellow-100 text-yellow-800 border-yellow-200"},
]
const getLabelCls = (name) => AVAILABLE_LABELS.find(l=>l.name===name)?.cls || "bg-gray-100 text-gray-600 border-gray-200"

export default function App(){
  // Auth
  const [token,setToken]=useState(localStorage.getItem("token")||"")
  const [email,setEmail]=useState("")
  const [password,setPassword]=useState("")
  const [name,setName]=useState("")
  const [isRegister,setIsRegister]=useState(false)

  // Tasks & UI
  const [tasks,setTasks]=useState([])
  const [title,setTitle]=useState("")
  const [search,setSearch]=useState("")
  const [filterPrio,setFilterPrio]=useState("all")
  const [filterLabel,setFilterLabel]=useState("all")
  const [editing,setEditing]=useState(null)

  // Boards
  const [boards,setBoards]=useState([])
  const [selectedBoard,setSelectedBoard]=useState(null)
  const [newBoardName,setNewBoardName]=useState("")
  const [inviteEmail,setInviteEmail]=useState("")
  const [renameValue,setRenameValue]=useState("")

  // Extras
  const [taskComments,setTaskComments]=useState([])
  const [newComment,setNewComment]=useState("")
  const [activities,setActivities]=useState([])
  const [boardMembers,setBoardMembers]=useState([])
  const [uploading,setUploading]=useState(false)
  const [notifications,setNotifications]=useState([])
  const [showNotif,setShowNotif]=useState(false)
  const [viewMode,setViewMode]=useState("board")
  const [calDate,setCalDate]=useState(new Date())
  const [darkMode,setDarkMode]=useState(localStorage.getItem("darkMode")==="true")

  const authHeader={headers:{Authorization:`Bearer ${token}`}}

  useEffect(()=>{ localStorage.setItem("darkMode", String(darkMode)) },[darkMode])

  const getCurrentEmail=()=>{
    try{
      if(!token) return ""
      return JSON.parse(atob(token.split('.')[1])).sub||""
    }catch{ return "" }
  }
  const currentEmail=getCurrentEmail()

  // Fetchers
  const fetchBoards=async()=>{
    if(!token) return
    try{
      const r=await axios.get(`${API_URL}/api/boards`, authHeader)
      setBoards(r.data)
      if(r.data.length>0 &&!selectedBoard) setSelectedBoard(r.data[0].id)
    }catch{}
  }
  const fetchTasks=async()=>{
    if(!token||!selectedBoard) return
    try{
      const r=await axios.get(`${API_URL}/api/tasks?board_id=${selectedBoard}`, authHeader)
      setTasks(r.data)
    }catch{}
  }
  const fetchComments=async(id)=>{
    if(!id) return
    try{
      const r=await axios.get(`${API_URL}/api/tasks/${id}/comments`, authHeader)
      setTaskComments(r.data)
    }catch{}
  }
  const fetchActivities=async()=>{
    if(!selectedBoard) return
    try{
      const r=await axios.get(`${API_URL}/api/boards/${selectedBoard}/activities`, authHeader)
      setActivities(r.data)
    }catch{}
  }
  const fetchBoardMembers=async()=>{
    if(!selectedBoard) return
    try{
      const r=await axios.get(`${API_URL}/api/boards/${selectedBoard}/members`, authHeader)
      setBoardMembers(r.data)
    }catch{}
  }
  const fetchNotifications=async()=>{
    if(!token) return
    try{
      const r=await axios.get(`${API_URL}/api/notifications`, authHeader)
      setNotifications(r.data)
    }catch{}
  }

  useEffect(()=>{ fetchBoards(); fetchNotifications() },[token])
  useEffect(()=>{
    fetchTasks(); fetchActivities(); fetchBoardMembers()
    const b=boards.find(x=>x.id===selectedBoard)
    if(b) setRenameValue(b.name)
  },[selectedBoard])
  useEffect(()=>{ if(editing) fetchComments(editing.id) },[editing])

  // WebSocket realtime
  useEffect(()=>{
    if(!selectedBoard||!token) return
    const wsBase=API_URL.replace("https://","wss://").replace("http://","ws://")
    const ws=new WebSocket(`${wsBase}/ws/${selectedBoard}`)
    ws.onmessage=(e)=>{
      try{
        const d=JSON.parse(e.data)
        if(d.type==="update"){ fetchTasks(); fetchActivities(); fetchNotifications(); if(editing) fetchComments(editing.id) }
      }catch{}
    }
    return ()=>{ try{ ws.close() }catch{} }
  },[selectedBoard])

  // Polling fallback
  useEffect(()=>{
    if(!token) return
    const id=setInterval(()=>{ if(selectedBoard){ fetchTasks(); fetchNotifications() } },8000)
    return ()=>clearInterval(id)
  },[selectedBoard,token])

  // Auth handlers
  const handleLogin=async()=>{
    const f=new URLSearchParams()
    f.append("username",email)
    f.append("password",password)
    try{
      const r=await axios.post(`${API_URL}/api/login`,f)
      localStorage.setItem("token",r.data.access_token)
      setToken(r.data.access_token)
    }catch{ alert("Login failed - check email/password") }
  }
  const handleRegister=async()=>{
    try{
      await axios.post(`${API_URL}/api/register`,{email,password,name})
      alert("Registered! Now login")
      setIsRegister(false)
    }catch(e){ alert(e.response?.data?.detail||"Register failed") }
  }

  // Task handlers
  const addTask=async()=>{
    if(!title.trim()||!selectedBoard) return alert("Select board and enter title")
    const prio=(title.toLowerCase().includes("urgent")||title.toLowerCase().includes("bug"))?"high":"medium"
    await axios.post(`${API_URL}/api/tasks`,{title,status:"todo",priority:prio,description:"",due_date:"",board_id:selectedBoard,assigned_to:"",assigned_to_name:"",attachment_url:"",labels:""},authHeader)
    setTitle("")
  }
  const onDragEnd=async(r)=>{
    if(!r.destination) return
    const id=r.draggableId
    const ns=r.destination.droppableId
    setTasks(p=>p.map(t=>String(t.id)===id?{...t,status:ns}:t))
    try{ await axios.put(`${API_URL}/api/tasks/${id}`,{status:ns},authHeader) }catch{}
  }
  const openEditModal=(t)=>setEditing({...t, labels:t.labels||""})
  const saveEdit=async()=>{ await axios.put(`${API_URL}/api/tasks/${editing.id}`,editing,authHeader); setEditing(null) }
  const delTask=async(id)=>{ await axios.delete(`${API_URL}/api/tasks/${id}`,authHeader); setEditing(null) }

  // Board handlers
  const createBoard=async()=>{
    if(!newBoardName.trim()) return
    const r=await axios.post(`${API_URL}/api/boards`,{name:newBoardName},authHeader)
    setNewBoardName("")
    await fetchBoards()
    setSelectedBoard(r.data.id)
  }
  const renameBoard=async()=>{
    if(!renameValue.trim()||!selectedBoard) return
    await axios.put(`${API_URL}/api/boards/${selectedBoard}`,{name:renameValue},authHeader)
    await fetchBoards()
  }
  const deleteBoard=async()=>{
    if(!selectedBoard) return
    if(!confirm("Delete board and all tasks?")) return
    await axios.delete(`${API_URL}/api/boards/${selectedBoard}`,authHeader)
    setSelectedBoard(null)
    await fetchBoards()
  }
  const inviteUser=async()=>{
    if(!inviteEmail.trim()||!selectedBoard) return
    try{
      await axios.post(`${API_URL}/api/boards/${selectedBoard}/invite`,{email:inviteEmail},authHeader)
      alert("Invited + Email sent!")
      setInviteEmail("")
      fetchBoardMembers()
    }catch(e){ alert(e.response?.data?.detail||"Invite failed - user must register first") }
  }

  // Comment / Upload / Notif / Email
  const addComment=async()=>{
    if(!newComment.trim()||!editing) return
    try{
      await axios.post(`${API_URL}/api/tasks/${editing.id}/comments`,{text:newComment},authHeader)
      setNewComment("")
      fetchComments(editing.id)
    }catch{ alert("Comment failed") }
  }
  const handleFileUpload=async(e)=>{
    const file=e.target.files[0]
    if(!file) return
    if(file.size>5*1024*1024){ alert("Max 5MB"); return }
    setUploading(true)
    try{
      const fd=new FormData()
      fd.append("file",file)
      const r=await axios.post(`${API_URL}/api/upload`, fd, { headers:{ Authorization:`Bearer ${token}`, "Content-Type":"multipart/form-data" } })
      setEditing({...editing, attachment_url:r.data.url})
      alert("Uploaded!")
    }catch{ alert("Upload failed - add Cloudinary keys in Render") }
    setUploading(false)
  }
  const markRead=async(id)=>{ await axios.put(`${API_URL}/api/notifications/${id}/read`,{},authHeader); fetchNotifications() }
  const markAllRead=async()=>{ await axios.put(`${API_URL}/api/notifications/read-all`,{},authHeader); fetchNotifications() }
  const deleteNotif=async(id)=>{ await axios.delete(`${API_URL}/api/notifications/${id}`,authHeader); fetchNotifications() }
  const testEmail=async()=>{
    try{
      const r=await axios.post(`${API_URL}/api/test-email`,{},authHeader)
      alert(r.data.sent? `✅ Email sent to ${r.data.to}` : `❌ Failed - Check Render Logs\nHost:${r.data.config.host}\nFrom:${r.data.config.from}\nHint: Verify FROM_EMAIL in Brevo`)
    }catch{ alert("Test failed - check backend logs /api/test-email") }
  }
  const toggleLabel=(lb)=>{
    if(!editing) return
    const cur=(editing.labels||"").split(",").filter(Boolean)
    const next=cur.includes(lb)? cur.filter(x=>x!==lb): [...cur,lb]
    setEditing({...editing, labels:next.join(",")})
  }

  // Calendar helpers
  const getDaysInMonth=(y,m)=>new Date(y,m+1,0).getDate()
  const getFirstDay=(y,m)=>new Date(y,m,1).getDay()
  const formatDate=(d)=>{ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
  const tasksByDate=(ds)=>tasks.filter(t=>t.due_date===ds)

  // Analytics
  const analytics=useMemo(()=>{
    const total=tasks.length
    const todo=tasks.filter(t=>t.status==="todo").length
    const doing=tasks.filter(t=>t.status==="doing").length
    const done=tasks.filter(t=>t.status==="done").length
    const high=tasks.filter(t=>t.priority==="high").length
    const my=tasks.filter(t=>t.assigned_to===currentEmail).length
    const todayStr=formatDate(new Date())
    const overdue=tasks.filter(t=>t.due_date && t.due_date < todayStr && t.status!=="done").length
    const dueToday=tasks.filter(t=>t.due_date===todayStr).length
    const progress=total===0?0:Math.round((done/total)*100)
    const labelCount={}
    const byMember={}
    tasks.forEach(t=>{
      (t.labels||"").split(",").filter(Boolean).forEach(l=>{ labelCount[l]=(labelCount[l]||0)+1 })
      if(t.assigned_to){ byMember[t.assigned_to]=(byMember[t.assigned_to]||0)+1 }
    })
    return {total,todo,doing,done,high,my,overdue,dueToday,progress,labelCount,byMember}
  },[tasks,currentEmail])

  const filtered=tasks.filter(t=>{
    const ms=t.title.toLowerCase().includes(search.toLowerCase()) || (t.description||"").toLowerCase().includes(search.toLowerCase())
    const mp=filterPrio==="all"||t.priority===filterPrio
    const ml=filterLabel==="all"||(t.labels||"").split(",").includes(filterLabel)
    return ms&&mp&&ml
  })

  const currentBoardName=boards.find(b=>b.id===selectedBoard)?.name||""
  const unread=notifications.filter(n=>!n.is_read).length
  const y=calDate.getFullYear()
  const m=calDate.getMonth()
  const daysInMonth=getDaysInMonth(y,m)
  const firstDay=getFirstDay(y,m)
  const monthName=calDate.toLocaleString('default',{month:'long',year:'numeric'})

  // Theme classes
  const bgMain=darkMode?"bg-[#0f1115] text-gray-100":"bg-[#f8fafc] text-gray-900"
  const bgSide=darkMode?"bg-[#16181d] border-gray-700 text-gray-100":"bg-white border-gray-200"
  const bgCard=darkMode?"bg-[#1e2128] border-gray-700":"bg-white border-gray-200"
  const bgTask=darkMode?"bg-[#2a2e38] border-gray-700":"bg-[#f1f5f9] border-gray-200"
  const inputCls=darkMode?"bg-[#2a2e38] border-gray-600 text-white placeholder-gray-400":"bg-white border-gray-300 text-gray-900"
  const subCard=darkMode?"bg-[#252a33] border-gray-700":"bg-gray-50 border-gray-200"
  const statCard=darkMode?"bg-[#1e2128] border-gray-700":"bg-white border-gray-200"

  if(!token){
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${bgMain}`}>
        <div className={`p-8 rounded-xl border w-full max-w- shadow-lg ${bgCard}`}>
          <h1 className="font-bold text-xl mb-1">WorkFlow SaaS 🚀</h1>
          <p className="text-xs text-gray-500 mb-5">Team Task Management + Email</p>
          {isRegister && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className={`border w-full p-2.5 mb-3 rounded-lg text-sm ${inputCls}`}/>}
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className={`border w-full p-2.5 mb-3 rounded-lg text-sm ${inputCls}`}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className={`border w-full p-2.5 mb-4 rounded-lg text-sm ${inputCls}`}/>
          <button onClick={isRegister?handleRegister:handleLogin} className="bg-black text-white w-full p-2.5 rounded-lg text-sm font-bold dark:bg-white dark:text-black">{isRegister?"Register":"Login"}</button>
          <button onClick={()=>setIsRegister(!isRegister)} className="text-sm text-gray-500 mt-4 w-full hover:text-black dark:hover:text-white">{isRegister?"Have account? Login":"New? Create account"}</button>
        </div>
      </div>
    )
  }

  return(
    <div className={`min-h-screen flex ${bgMain}`}>
      {/* SIDEBAR */}
      <div className={`w- min-w- border-r p-5 flex flex-col h-screen sticky top-0 overflow-y-auto ${bgSide}`}>
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-bold text-lg">WorkFlow 🚀</h1>
          <button onClick={()=>setDarkMode(!darkMode)} className="border px-3 py-1.5 rounded-lg text-sm bg-black text-white dark:bg-white dark:text-black">{darkMode?"☀":"🌙"}</button>
        </div>

        <h2 className="font-bold text- uppercase tracking-wider text-gray-500 mb-3">Your Boards</h2>
        <div className="space-y-2 mb-4 max-h- overflow-auto">
          {boards.map(b=>(
            <button key={b.id} onClick={()=>setSelectedBoard(b.id)} className={`w-full text-left p-2.5 rounded-lg text-sm border truncate transition ${selectedBoard===b.id?'bg-black text-white border-black dark:bg-white dark:text-black font-bold':'hover:bg-gray-100 dark:hover:bg-[#2a2e38] '+bgCard}`}>📋 {b.name}</button>
          ))}
          {boards.length===0 && <p className="text- text-gray-400">No boards - create one</p>}
        </div>
        <div className="flex gap-2 mb-6">
          <input value={newBoardName} onChange={e=>setNewBoardName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createBoard()} placeholder="New board name" className={`border p-2 rounded-lg text-sm flex-1 min-w-0 ${inputCls}`}/>
          <button onClick={createBoard} className="bg-black text-white px-3 rounded-lg text-sm font-bold dark:bg-white dark:text-black">+</button>
        </div>

        {selectedBoard && (
          <div className={`border rounded-lg p-3 mb-4 ${subCard}`}>
            <p className="text- font-bold uppercase mb-2 opacity-60">Manage Board</p>
            <input value={renameValue} onChange={e=>setRenameValue(e.target.value)} className={`border w-full p-2 rounded text-xs mb-2 ${inputCls}`}/>
            <div className="flex gap-2">
              <button onClick={renameBoard} className={`border flex-1 p-2 rounded text-xs font-bold ${bgCard}`}>Rename</button>
              <button onClick={deleteBoard} className="bg-red-50 text-red-600 border border-red-200 flex-1 p-2 rounded text-xs font-bold hover:bg-red-100">Delete</button>
            </div>
          </div>
        )}

        <div className="border-t pt-4 mb-4">
          <h3 className="font-bold text- uppercase mb-3">Invite Teammate + Email 📧</h3>
          <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="friend@gmail.com" className={`border w-full p-2.5 rounded-lg text-sm mb-2 ${inputCls}`}/>
          <button disabled={!selectedBoard} onClick={inviteUser} className="bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white w-full p-2.5 rounded-lg text-sm font-bold">Invite + Send Email</button>
          <button onClick={testEmail} className={`mt-2 w-full p-2.5 rounded-lg text-xs border font-bold ${bgCard} hover:bg-gray-100 dark:hover:bg-[#2a2e38]`}>🧪 Test My Email</button>
        </div>

        <div className="border-t pt-4 mb-4">
          <h3 className="font-bold text- uppercase mb-2">Label Filter 🏷</h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button onClick={()=>setFilterLabel("all")} className={`text- px-2.5 py-1 rounded-full border font-bold ${filterLabel==="all"?"bg-black text-white border-black":"bg-gray-100 dark:bg-[#2a2e38]"}`}>All</button>
            {AVAILABLE_LABELS.map(l=>(
              <button key={l.name} onClick={()=>setFilterLabel(l.name)} className={`text- px-2.5 py-1 rounded-full border font-bold ${filterLabel===l.name?'bg-black text-white border-black dark:bg-white dark:text-black': l.cls}`}>{l.name}</button>
            ))}
          </div>
        </div>

        <div className="border-t pt-4 mb-4">
          <h3 className="font-bold text- uppercase mb-2">Activity Feed 🔥</h3>
          <div className="max-h- overflow-auto space-y-1.5 pr-1">
            {activities.length===0 && <p className="text- text-gray-400">No activity yet</p>}
            {activities.map(a=>(
              <div key={a.id} className={`text- p-2 rounded border leading-tight ${subCard}`}><b className="text-blue-500">{a.user_name}</b> {a.action}<div className="text- text-gray-400 mt-0.5">{a.created_at}</div></div>
            ))}
          </div>
        </div>

        <button onClick={()=>{localStorage.clear(); setToken(""); setSelectedBoard(null); setBoards([]); setTasks([])}} className={`mt-auto text-xs border p-2.5 rounded-lg font-bold ${bgCard} hover:bg-red-50 hover:text-red-600 hover:border-red-200`}>Logout</button>
      </div>

      {/* MAIN */}
      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h2 className="text-2xl font-bold truncate">{currentBoardName||"Select a board"}</h2>
          <div className="flex gap-2 items-center flex-wrap">
            <div className={`flex border rounded-lg p-1 ${bgCard}`}>
              <button onClick={()=>setViewMode("board")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode==="board"?"bg-black text-white dark:bg-white dark:text-black shadow":"text-gray-500 hover:text-black"}`}>📋 Board</button>
              <button onClick={()=>setViewMode("calendar")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode==="calendar"?"bg-black text-white dark:bg-white dark:text-black shadow":"text-gray-500 hover:text-black"}`}>📅 Calendar</button>
            </div>

            <div className="relative">
              <button onClick={()=>setShowNotif(!showNotif)} className={`relative border px-4 py-2.5 rounded-lg text-sm font-bold ${bgCard} hover:shadow-sm`}>🔔 {unread>0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text- w-5 h-5 flex items-center justify-center rounded-full font-bold animate-pulse">{unread}</span>}</button>
              {showNotif && (
                <div className={`absolute right-0 top-12 w- border rounded-xl shadow-2xl z-50 max-h- overflow-hidden flex flex-col ${bgCard}`}>
                  <div className={`p-3 border-b flex justify-between items-center ${subCard}`}><span className="font-bold text-sm">Notifications {unread>0 && `(${unread} unread)`}</span><div className="flex gap-2"><button onClick={markAllRead} className="text- text-blue-600 font-bold">Mark all read</button></div></div>
                  <div className="overflow-auto flex-1">
                    {notifications.length===0 && <p className="text-xs text-gray-400 p-6 text-center">No notifications</p>}
                    {notifications.map(n=>(
                      <div key={n.id} className={`p-3 border-b flex gap-2 ${!n.is_read?'bg-blue-50 dark:bg-[#252a33]':''}`}>
                        <div className="flex-1"><p className="text- leading-snug">{n.message}</p><p className="text- text-gray-400 mt-1">{n.created_at} • 📧 Email sent</p></div>
                        <div className="flex flex-col gap-1"><button onClick={()=>markRead(n.id)} className="text- bg-black text-white px-2.5 py-1 rounded-full font-bold h-fit">Read</button><button onClick={()=>deleteNotif(n.id)} className="text- text-gray-400 hover:text-red-500">✕</button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search title/desc..." className={`border px-4 py-2.5 w- rounded-lg text-sm ${inputCls}`}/>
            <select value={filterPrio} onChange={e=>setFilterPrio(e.target.value)} className={`border px-3 py-2.5 rounded-lg text-sm font-bold ${inputCls}`}><option value="all">All Prio</option><option value="high">High 🔥</option><option value="medium">Medium</option></select>
          </div>
        </div>

        {/* DASHBOARD ANALYTICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}><p className="text- uppercase tracking-wider text-gray-500 font-bold">Total</p><p className="text-2xl font-bold mt-1">{analytics.total}</p><div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden"><div className="bg-black dark:bg-white h-1.5 rounded-full transition-all" style={{width:`${analytics.progress}%`}}></div></div><p className="text- text-gray-400 mt-1">{analytics.progress}% done</p></div>
          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}><p className="text- uppercase tracking-wider text-gray-500 font-bold">Todo</p><p className="text-2xl font-bold mt-1">{analytics.todo}</p><p className="text- text-gray-400 mt-1">To start</p></div>
          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}><p className="text- uppercase tracking-wider text-gray-500 font-bold">Doing</p><p className="text-2xl font-bold mt-1 text-blue-600">{analytics.doing}</p><p className="text- text-gray-400 mt-1">In progress</p></div>
          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}><p className="text- uppercase tracking-wider text-gray-500 font-bold">Done</p><p className="text-2xl font-bold mt-1 text-green-600">{analytics.done}</p><p className="text- text-gray-400 mt-1">{analytics.progress}%</p></div>
          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}><p className="text- uppercase tracking-wider text-gray-500 font-bold">High 🔥</p><p className="text-2xl font-bold mt-1 text-red-600">{analytics.high}</p><p className="text- text-gray-400 mt-1">Urgent</p></div>
          <div className={`rounded-xl border p-4 shadow-sm ${statCard}`}><p className="text- uppercase tracking-wider text-gray-500 font-bold">My Tasks 👤</p><p className="text-2xl font-bold mt-1">{analytics.my}</p><p className="text- text-gray-400 mt-1 truncate">{currentEmail.split('@')[0]||"me"}</p></div>
          <div className={`rounded-xl border p-4 shadow-sm ${statCard} ${analytics.overdue>0?'ring-1 ring-red-400':''}`}><p className="text- uppercase tracking-wider text-gray-500 font-bold">Overdue ⚠</p><p className={`text-2xl font-bold mt-1 ${analytics.overdue>0?'text-red-600':''}`}>{analytics.overdue}</p><p className="text- text-gray-400 mt-1">Today: {analytics.dueToday}</p></div>
        </div>

        {/* Labels + Workload breakdown */}
        {(Object.keys(analytics.labelCount).length>0 || Object.keys(analytics.byMember).length>0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            <div className={`rounded-xl border p-4 flex flex-wrap gap-2 items-center ${statCard}`}>
              <span className="text- font-bold uppercase mr-2">Labels 🏷:</span>
              {Object.entries(analytics.labelCount).map(([k,v])=><span key={k} className={`text- px-2.5 py-1 rounded-full border font-bold ${getLabelCls(k)}`}>{k}: {v}</span>)}
              {Object.keys(analytics.labelCount).length===0 && <span className="text- text-gray-400">No labels yet</span>}
            </div>
            <div className={`rounded-xl border p-4 flex flex-wrap gap-2 items-center ${statCard}`}>
              <span className="text- font-bold uppercase mr-2">Workload 👥:</span>
              {Object.entries(analytics.byMember).map(([em,cnt])=><span key={em} className={`text- px-2.5 py-1 rounded-full border font-bold ${subCard}`}>{em.split('@')[0]}: <b>{cnt}</b></span>)}
              {Object.keys(analytics.byMember).length===0 && <span className="text- text-gray-400">No assignees</span>}
            </div>
          </div>
        )}

        {/* Add task */}
        <div className="flex gap-3 mb-8">
          <input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()} placeholder="New task... (type urgent or bug = high priority)" className={`border px-4 py-2.5 w-full max-w- rounded-lg text-sm shadow-sm ${inputCls}`}/>
          <button onClick={addTask} className="bg-black text-white px-6 rounded-lg text-sm font-bold shadow hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">Add Task</button>
        </div>

        {viewMode==="board"?(
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {["todo","doing","done"].map(s=>(
                <Droppable key={s} droppableId={s}>{(p)=>(
                  <div ref={p.innerRef} {...p.droppableProps} className={`rounded-xl border p-4 min-h- shadow-sm ${bgCard}`}>
                    <h3 className="font-bold uppercase text- tracking-wider border-b pb-3 mb-3 flex justify-between"><span>{s}</span><span className="bg-gray-100 dark:bg-[#2a2e38] px-2 py-0.5 rounded-full">{filtered.filter(t=>t.status===s).length}</span></h3>
                    {filtered.filter(t=>t.status===s).map((t,i)=>(
                      <Draggable key={t.id} draggableId={String(t.id)} index={i}>{(pr)=>(
                        <div ref={pr.innerRef} {...pr.draggableProps} {...pr.dragHandleProps} onClick={()=>openEditModal(t)} className={`p-3 rounded-xl mb-3 border cursor-pointer hover:shadow-md transition ${bgTask}`}>
                          <div className="font-medium text- leading-snug line-clamp-2">{t.title}</div>
                          {t.labels && <div className="flex gap-1 flex-wrap mt-2">{t.labels.split(",").filter(Boolean).map(lb=><span key={lb} className={`text- px-2 py-0.5 rounded-full border font-bold ${getLabelCls(lb)}`}>{lb}</span>)}</div>}
                          <div className="flex justify-between items-center mt-2.5">
                            <span className={`text- px-2 py-1 rounded-full font-bold ${t.priority==='high'?'bg-red-100 text-red-600 border border-red-200':'bg-green-100 text-green-700 border border-green-200'}`}>{t.priority}</span>
                            {t.due_date && <span className={`text- ${t.due_date < formatDate(new Date()) && t.status!=='done'? 'text-red-600 font-bold' : 'text-gray-500'}`}>📅 {t.due_date}</span>}
                          </div>
                          {t.assigned_to && <div className="mt-1.5 text- text-gray-500 flex items-center gap-1">👤 {t.assigned_to_name||t.assigned_to.split('@')[0]}</div>}
                          {t.attachment_url && <div className="text- text-blue-600 mt-1 font-bold">📎 Attachment</div>}
                        </div>
                      )}</Draggable>
                    ))}{p.placeholder}
                  </div>
                )}</Droppable>
              ))}
            </div>
          </DragDropContext>
        ):(
          <div className={`rounded-xl border p-5 shadow-sm ${bgCard}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">{monthName}</h3>
              <div className="flex gap-2">
                <button onClick={()=>setCalDate(new Date(y,m-1,1))} className={`border px-3 py-1.5 rounded-lg text-sm font-bold ${bgCard} hover:bg-gray-50`}>◀ Prev</button>
                <button onClick={()=>setCalDate(new Date())} className={`border px-3 py-1.5 rounded-lg text-sm font-bold ${bgCard} hover:bg-gray-50`}>Today</button>
                <button onClick={()=>setCalDate(new Date(y,m+1,1))} className={`border px-3 py-1.5 rounded-lg text-sm font-bold ${bgCard} hover:bg-gray-50`}>Next ▶</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border rounded-xl overflow-hidden">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className={`p-2.5 text- font-bold text-center uppercase ${subCard}`}>{d}</div>)}
              {Array.from({length:firstDay}).map((_,i)=><div key={`empty-${i}`} className={`h- ${bgCard}`}></div>)}
              {Array.from({length:daysInMonth}).map((_,idx)=>{
                const day=idx+1; const dateStr=formatDate(new Date(y,m,day)); const dayTasks=tasksByDate(dateStr); const isToday=dateStr===formatDate(new Date())
                return (
                  <div key={day} className={`h- p-2 overflow-hidden ${bgCard} ${isToday?'ring-2 ring-black dark:ring-white ring-inset':''}`}>
                    <div className={`text- font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday?'bg-black text-white dark:bg-white dark:text-black':''}`}>{day}</div>
                    <div className="mt-1.5 space-y-1">
                      {dayTasks.slice(0,3).map(t=>(
                        <div key={t.id} onClick={()=>openEditModal(t)} className={`text- px-1.5 py-0.5 rounded truncate cursor-pointer font-bold border ${t.priority==='high'?'bg-red-100 text-red-700 border-red-200':'bg-blue-100 text-blue-700 border-blue-200'}`}>{t.title}</div>
                      ))}
                      {dayTasks.length>3 && <div className="text- text-gray-400 font-bold">+{dayTasks.length-3} more</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl p-6 w- max-w-full max-h- overflow-y-auto shadow-2xl border ${bgCard}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Edit Task ✏</h2>
              <button onClick={()=>setEditing(null)} className={`w-8 h-8 rounded-full border flex items-center justify-center ${subCard}`}>✕</button>
            </div>

            <input value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})} placeholder="Task title" className={`border w-full p-2.5 mb-3 rounded-xl text-sm font-medium ${inputCls}`}/>
            <textarea value={editing.description||""} onChange={e=>setEditing({...editing,description:e.target.value})} className={`border w-full p-2.5 mb-3 rounded-xl h-24 text-sm ${inputCls}`} placeholder="Description..."/>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text- font-bold uppercase opacity-60">Due Date</label><input type="date" value={editing.due_date||""} onChange={e=>setEditing({...editing,due_date:e.target.value})} className={`border p-2.5 rounded-xl w-full text-sm mt-1 ${inputCls}`}/></div>
              <div><label className="text- font-bold uppercase opacity-60">Priority</label><select value={editing.priority} onChange={e=>setEditing({...editing,priority:e.target.value})} className={`border p-2.5 rounded-xl w-full text-sm mt-1 font-bold ${inputCls}`}><option value="medium">Medium</option><option value="high">High 🔥</option></select></div>
            </div>

            <div className="mb-3"><label className="text- font-bold uppercase opacity-60">Status</label><select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})} className={`border w-full p-2.5 rounded-xl text-sm mt-1 font-bold ${inputCls}`}><option value="todo">📋 Todo</option><option value="doing">⚡ Doing</option><option value="done">✅ Done</option></select></div>

            <div className={`border rounded-xl p-3 mb-3 ${subCard}`}>
              <label className="text- font-bold uppercase">Labels 🏷 - Click to toggle</label>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {AVAILABLE_LABELS.map(l=>{
                  const active=(editing.labels||"").split(",").includes(l.name)
                  return <button key={l.name} onClick={()=>toggleLabel(l.name)} className={`text- px-3 py-1.5 rounded-full border font-bold transition-all ${active?'bg-black text-white border-black dark:bg-white dark:text-black scale-105 shadow':'hover:scale-105 '+l.cls}`}>{active?'✓ ':''}{l.name}</button>
                })}
              </div>
              {editing.labels && <p className="text- text-gray-400 mt-2">Selected: {editing.labels}</p>}
            </div>

            <div className={`border rounded-xl p-3 mb-3 ${subCard}`}>
              <label className="text- font-bold uppercase">Assign To 👤 + 📧 Email Notification</label>
              <select value={editing.assigned_to||""} onChange={e=>{
                const sel=boardMembers.find(m=>m.email===e.target.value)
                setEditing({...editing, assigned_to:e.target.value, assigned_to_name:sel?.name||""})
              }} className={`border w-full p-2.5 rounded-xl text-sm mt-2 ${inputCls}`}>
                <option value="">Unassigned</option>
                {boardMembers.map(m=><option key={m.email} value={m.email}>{m.name} ({m.email})</option>)}
              </select>
              <p className="text- text-gray-400 mt-1.5">Assign cheythal automatic bell + email notification pokum</p>
            </div>

            <div className={`border rounded-xl p-3 mb-5 ${subCard}`}>
              <label className="text- font-bold uppercase">Attachment 📎 (Cloudinary / Base64)</label>
              <input type="file" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" className="w-full text-xs mt-2.5 mb-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-black file:text-white file:text-xs dark:file:bg-white dark:file:text-black"/>
              {uploading && <p className="text-xs text-blue-600 font-bold animate-pulse">Uploading... wait</p>}
              {editing.attachment_url && <div className="mt-3 text-xs break-all bg-white dark:bg-[#1e2128] border p-2.5 rounded-xl flex justify-between items-center"><a href={editing.attachment_url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline truncate mr-2">📎 View File</a><button onClick={()=>setEditing({...editing,attachment_url:""})} className="text- bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full font-bold">Remove</button></div>}
            </div>

            <div className="flex gap-3">
              <button onClick={saveEdit} className="bg-black text-white flex-1 p-3 rounded-xl text-sm font-bold shadow hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">💾 Save + Email</button>
              <button onClick={()=>delTask(editing.id)} className="bg-red-50 text-red-600 flex-1 p-3 rounded-xl border border-red-200 text-sm font-bold hover:bg-red-100">🗑 Delete</button>
              <button onClick={()=>setEditing(null)} className={`flex-1 p-3 rounded-xl text-sm font-bold border ${subCard}`}>Cancel</button>
            </div>

            <div className="mt-7 border-t pt-5">
              <h3 className="font-bold text-sm mb-3">Comments 💬 + Email Notification</h3>
              <div className={`max-h- overflow-y-auto mb-3 space-y-2 border rounded-xl p-2.5 ${subCard}`}>
                {taskComments.length===0? <p className="text-xs text-gray-400 text-center py-4">No comments yet - first comment add cheyyu</p> : taskComments.map(c=>(
                  <div key={c.id} className={`p-2.5 rounded-xl border ${bgCard}`}><div className="flex justify-between items-center"><span className="font-bold text-xs text-blue-600">{c.user_name}</span><span className="text- text-gray-400">{c.created_at}</span></div><p className="text- mt-1 leading-snug">{c.text}</p></div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addComment()} placeholder="Write a comment... (assigned user gets email)" className={`border flex-1 p-2.5 rounded-xl text-sm ${inputCls}`}/>
                <button onClick={addComment} className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl text-sm font-bold">Post</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 