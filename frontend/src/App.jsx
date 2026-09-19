import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

function App(){
  const [token,setToken]=useState(localStorage.getItem("token"))
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState(""); const [isRegister,setIsRegister]=useState(false)
  const [tasks,setTasks]=useState([]); const [title,setTitle]=useState("")
  const [search,setSearch]=useState(""); const [filterPrio,setFilterPrio]=useState("all")
  const [editing,setEditing]=useState(null)
  const [boards,setBoards]=useState([]); const [selectedBoard,setSelectedBoard]=useState(null)
  const [newBoardName,setNewBoardName]=useState(""); const [inviteEmail,setInviteEmail]=useState("")
  const [taskComments,setTaskComments]=useState([]); const [newComment,setNewComment]=useState("");
  const [activities,setActivities]=useState([]); const [renameValue,setRenameValue]=useState("");
  const [boardMembers,setBoardMembers]=useState([]); const [uploading,setUploading]=useState(false)
  const [notifications,setNotifications]=useState([]); const [showNotif,setShowNotif]=useState(false)
  const wsRef=useRef(null)
  const authHeader={headers:{Authorization:`Bearer ${token}`}}

  const fetchBoards=async()=>{
    if(!token) return
    try{ const r=await axios.get(`${API_URL}/api/boards`, authHeader); setBoards(r.data); if(r.data.length>0 &&!selectedBoard) setSelectedBoard(r.data[0].id) }catch{}
  }
  const fetchTasks=async()=>{
    if(!token||!selectedBoard) return
    try{ const r=await axios.get(`${API_URL}/api/tasks?board_id=${selectedBoard}`, authHeader); setTasks(r.data) }catch{}
  }
  const fetchComments=async(taskId)=>{
    if(!taskId) return
    try{ const r=await axios.get(`${API_URL}/api/tasks/${taskId}/comments`, authHeader); setTaskComments(r.data) }catch{}
  }
  const fetchActivities=async()=>{
    if(!selectedBoard) return
    try{ const r=await axios.get(`${API_URL}/api/boards/${selectedBoard}/activities`, authHeader); setActivities(r.data) }catch{}
  }
  const fetchBoardMembers=async()=>{
    if(!selectedBoard) return
    try{ const r=await axios.get(`${API_URL}/api/boards/${selectedBoard}/members`, authHeader); setBoardMembers(r.data) }catch{}
  }
  const fetchNotifications=async()=>{
    if(!token) return
    try{ const r=await axios.get(`${API_URL}/api/notifications`, authHeader); setNotifications(r.data) }catch{}
  }

  useEffect(()=>{fetchBoards(); fetchNotifications()},[token])
  useEffect(()=>{fetchTasks(); fetchActivities(); fetchBoardMembers(); if(selectedBoard) setRenameValue(boards.find(b=>b.id===selectedBoard)?.name||"")},[selectedBoard])
  useEffect(()=>{ if(editing) fetchComments(editing.id) },[editing])

  useEffect(()=>{
    if(!selectedBoard||!token) return
    const wsBase=API_URL.replace("https://","wss://").replace("http://","ws://")
    const ws=new WebSocket(`${wsBase}/ws/${selectedBoard}`); wsRef.current=ws
    ws.onmessage=(e)=>{ try{ const d=JSON.parse(e.data); if(d.type==="update"){ fetchTasks(); fetchActivities(); fetchNotifications(); if(editing) fetchComments(editing.id) } }catch{} }
    return ()=>ws.close()
  },[selectedBoard])

  useEffect(()=>{ if(!selectedBoard) return; const id=setInterval(()=>{ fetchTasks(); fetchActivities(); fetchNotifications() },8000); return ()=>clearInterval(id) },[selectedBoard])
  useEffect(()=>{ if(!token) return; const id=setInterval(()=>fetchNotifications(),10000); return ()=>clearInterval(id) },[token])

  const handleLogin=async()=>{
    const f=new URLSearchParams(); f.append("username",email); f.append("password",password)
    try{ const r=await axios.post(`${API_URL}/api/login`,f); localStorage.setItem("token",r.data.access_token); setToken(r.data.access_token) }catch{alert("Login failed")}
  }
  const handleRegister=async()=>{ try{ await axios.post(`${API_URL}/api/register`,{email,password,name}); alert("Registered!"); setIsRegister(false)}catch(e){alert(e.response?.data?.detail||"Failed")} }
  const addTask=async()=>{
    if(!title.trim()||!selectedBoard) return alert("Select board")
    let prio=title.toLowerCase().includes("urgent")||title.toLowerCase().includes("bug")?"high":"medium"
    await axios.post(`${API_URL}/api/tasks`,{title,status:"todo",priority:prio,description:"",due_date:"",board_id:selectedBoard, assigned_to:"", assigned_to_name:"", attachment_url:""},authHeader)
    setTitle("")
  }
  const onDragEnd=async(r)=>{
    if(!r.destination) return
    const id=r.draggableId; const ns=r.destination.droppableId
    setTasks(p=>p.map(t=>String(t.id)===id?{...t,status:ns}:t))
    await axios.put(`${API_URL}/api/tasks/${id}`,{status:ns},authHeader)
  }
  const openEditModal=(t)=>setEditing(t)
  const saveEdit=async()=>{ await axios.put(`${API_URL}/api/tasks/${editing.id}`,editing,authHeader); setEditing(null) }
  const delTask=async(id)=>{ await axios.delete(`${API_URL}/api/tasks/${id}`,authHeader); setEditing(null) }
  const createBoard=async()=>{ if(!newBoardName.trim()) return; const r=await axios.post(`${API_URL}/api/boards`,{name:newBoardName},authHeader); setNewBoardName(""); await fetchBoards(); setSelectedBoard(r.data.id) }
  const renameBoard=async()=>{ if(!renameValue.trim()||!selectedBoard) return; await axios.put(`${API_URL}/api/boards/${selectedBoard}`,{name:renameValue},authHeader); await fetchBoards() }
  const deleteBoard=async()=>{ if(!selectedBoard) return; if(!confirm("Delete board?")) return; await axios.delete(`${API_URL}/api/boards/${selectedBoard}`,authHeader); setSelectedBoard(null); await fetchBoards() }
  const inviteUser=async()=>{ if(!inviteEmail.trim()||!selectedBoard) return; try{ await axios.post(`${API_URL}/api/boards/${selectedBoard}/invite`,{email:inviteEmail},authHeader); alert("Invited!"); setInviteEmail(""); fetchBoardMembers(); fetchNotifications() }catch(e){alert(e.response?.data?.detail||"Failed")} }
  const addComment=async()=>{ if(!newComment.trim()||!editing) return; await axios.post(`${API_URL}/api/tasks/${editing.id}/comments`,{text:newComment},authHeader); setNewComment(""); fetchComments(editing.id) }

  const handleFileUpload=async(e)=>{
    const file=e.target.files[0]; if(!file) return; if(file.size>5*1024*1024){ alert("Max 5MB"); return }
    setUploading(true)
    try{ const fd=new FormData(); fd.append("file",file); const r=await axios.post(`${API_URL}/api/upload`, fd, { headers:{ Authorization:`Bearer ${token}`, "Content-Type":"multipart/form-data" } }); setEditing({...editing, attachment_url:r.data.url}); alert("Uploaded!") }catch(err){ alert(err.response?.data?.detail||"Upload failed") }
    setUploading(false)
  }

  const markRead=async(id)=>{ await axios.put(`${API_URL}/api/notifications/${id}/read`,{},authHeader); fetchNotifications() }
  const markAllRead=async()=>{ await axios.put(`${API_URL}/api/notifications/read-all`,{},authHeader); fetchNotifications() }
  const deleteNotif=async(id)=>{ await axios.delete(`${API_URL}/api/notifications/${id}`,authHeader); fetchNotifications() }

  const filtered=tasks.filter(t=>{
    const ms=t.title.toLowerCase().includes(search.toLowerCase()) || (t.description||"").toLowerCase().includes(search.toLowerCase())
    const mp=filterPrio==="all" || t.priority===filterPrio
    return ms && mp
  })
  const currentBoardName=boards.find(b=>b.id===selectedBoard)?.name||""
  const unread=notifications.filter(n=>!n.is_read).length

  if(!token) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <div className="bg-white p-8 rounded-xl border w-full max-w-">
        <h1 className="font-bold text-xl mb-5">WorkFlow SaaS Login</h1>
        {isRegister && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="border w-full p-2.5 mb-3 rounded-lg text-sm"/>}
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="border w-full p-2.5 mb-3 rounded-lg text-sm"/>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="border w-full p-2.5 mb-4 rounded-lg text-sm"/>
        <button onClick={isRegister?handleRegister:handleLogin} className="bg-black text-white w-full p-2.5 rounded-lg text-sm">{isRegister?"Register":"Login"}</button>
        <button onClick={()=>setIsRegister(!isRegister)} className="text-sm text-gray-500 mt-4 w-full">{isRegister?"Have account? Login":"New? Register"}</button>
      </div>
    </div>
  )

  return(
    <div className="min-h-screen bg-[#f8fafc] flex">
      <div className="w- min-w- bg-white border-r p-5 flex flex-col h-screen sticky top-0 overflow-y-auto">
        <h1 className="font-bold text-lg mb-6">WorkFlow SaaS 🚀</h1>
        <h2 className="font-bold text- uppercase tracking-wider text-gray-500 mb-3">Your Boards</h2>
        <div className="space-y-2 mb-4 max-h- overflow-auto">
          {boards.map(b=>(
            <button key={b.id} onClick={()=>setSelectedBoard(b.id)} className={`w-full text-left p-2.5 rounded-lg text-sm border truncate ${selectedBoard===b.id?'bg-black text-white border-black':'bg-gray-50 hover:bg-gray-100'}`}>📋 {b.name}</button>
          ))}
        </div>
        <div className="flex gap-2 mb-6">
          <input value={newBoardName} onChange={e=>setNewBoardName(e.target.value)} placeholder="New board" className="border p-2 rounded-lg text-sm flex-1 min-w-0"/>
          <button onClick={createBoard} className="bg-black text-white px-3 rounded-lg text-sm">+</button>
        </div>
        {selectedBoard && (
          <div className="border rounded-lg p-3 mb-4 bg-gray-50">
            <p className="text- font-bold uppercase mb-2">Manage Board</p>
            <input value={renameValue} onChange={e=>setRenameValue(e.target.value)} className="border w-full p-2 rounded text-xs mb-2"/>
            <div className="flex gap-2">
              <button onClick={renameBoard} className="bg-white border flex-1 p-2 rounded text-xs">Rename</button>
              <button onClick={deleteBoard} className="bg-red-50 text-red-600 border border-red-200 flex-1 p-2 rounded text-xs">Delete</button>
            </div>
          </div>
        )}
        <div className="border-t pt-4 mb-4">
          <h3 className="font-bold text- uppercase mb-3">Invite Teammate</h3>
          <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="friend@gmail.com" className="border w-full p-2.5 rounded-lg text-sm mb-2"/>
          <button disabled={!selectedBoard} onClick={inviteUser} className="bg-blue-600 disabled:bg-gray-300 text-white w-full p-2.5 rounded-lg text-sm">Invite</button>
          <p className="text- text-gray-400 mt-2 truncate">{boardMembers.map(m=>m.name).join(", ")}</p>
        </div>
        <div className="border-t pt-4">
          <h3 className="font-bold text- uppercase mb-2">Activity Feed 🔥</h3>
          <div className="max-h- overflow-auto space-y-1">
            {activities.map(a=>(
              <div key={a.id} className="text- bg-gray-50 p-2 rounded border"><b className="text-blue-600">{a.user_name}</b> {a.action}<div className="text- text-gray-400">{a.created_at}</div></div>
            ))}
          </div>
        </div>
        <button onClick={()=>{localStorage.clear(); setToken(null)}} className="mt-auto text-xs border p-2 rounded-lg">Logout</button>
      </div>

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h2 className="text-2xl font-bold truncate">{currentBoardName||"Select board"}</h2>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <button onClick={()=>setShowNotif(!showNotif)} className="relative bg-white border px-4 py-2.5 rounded-lg text-sm">
                🔔 {unread>0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text- w-5 h-5 flex items-center justify-center rounded-full font-bold">{unread}</span>}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-12 w- bg-white border rounded-xl shadow-xl z-50 max-h- overflow-hidden flex flex-col">
                  <div className="p-3 border-b flex justify-between items-center"><span className="font-bold text-sm">Notifications {unread>0 && `(${unread})`}</span><button onClick={markAllRead} className="text- text-blue-600">Mark all read</button></div>
                  <div className="overflow-auto flex-1">
                    {notifications.length===0 && <p className="text-xs text-gray-400 p-4">No notifications</p>}
                    {notifications.map(n=>(
                      <div key={n.id} className={`p-3 border-b flex gap-2 ${!n.is_read?'bg-blue-50':''}`}>
                        <div className="flex-1"><p className="text-">{n.message}</p><p className="text- text-gray-400">{n.created_at} • {n.type}</p></div>
                        <div className="flex flex-col gap-1">
                          {!n.is_read && <button onClick={()=>markRead(n.id)} className="text- bg-black text-white px-2 py-1 rounded">Read</button>}
                          <button onClick={()=>deleteNotif(n.id)} className="text- text-red-500">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..." className="border px-4 py-2.5 w- lg:w- rounded-lg bg-white text-sm"/>
            <select value={filterPrio} onChange={e=>setFilterPrio(e.target.value)} className="border px-3 py-2.5 rounded-lg bg-white text-sm"><option value="all">All</option><option value="high">High</option><option value="medium">Medium</option></select>
          </div>
        </div>

        <div className="flex gap-3 mb-8">
          <input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()} placeholder="New task... (urgent=high)" className="border px-4 py-2.5 w-full max-w- rounded-lg bg-white text-sm"/>
          <button onClick={addTask} className="bg-black text-white px-6 rounded-lg text-sm">Add</button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {["todo","doing","done"].map(s=>(
              <Droppable key={s} droppableId={s}>{(p)=>(
                <div ref={p.innerRef} {...p.droppableProps} className="bg-white rounded-xl border p-4 min-h-">
                  <h3 className="font-bold uppercase text- tracking-wider border-b pb-3 mb-3">{s} ({filtered.filter(t=>t.status===s).length})</h3>
                  {filtered.filter(t=>t.status===s).map((t,i)=>(
                    <Draggable key={t.id} draggableId={String(t.id)} index={i}>{(pr)=>(
                      <div ref={pr.innerRef} {...pr.draggableProps} {...pr.dragHandleProps} onClick={()=>openEditModal(t)} className="bg-[#f1f5f9] p-3 rounded-lg mb-3 border hover:shadow-sm cursor-pointer">
                        <div className="font-medium text- line-clamp-2">{t.title}</div>
                        {t.assigned_to && <div className="mt-1 text- bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full inline-block">👤 {t.assigned_to_name||t.assigned_to}</div>}
                        {t.attachment_url && (t.attachment_url.startsWith("data:image")||t.attachment_url.includes("cloudinary")||t.attachment_url.includes("image")? <img src={t.attachment_url} className="mt-2 w-full h-20 object-cover rounded border"/> : <div className="text- text-blue-500 mt-1 truncate">📎 {t.attachment_url}</div>)}
                        <div className="flex justify-between items-center mt-2">
                          <span className={`text- px-2 py-1 rounded-full font-bold ${t.priority==='high'?'bg-red-100 text-red-600':'bg-green-100 text-green-700'}`}>{t.priority}</span>
                          {t.due_date && <span className="text- text-gray-500">📅 {t.due_date}</span>}
                        </div>
                      </div>
                    )}</Draggable>
                  ))}{p.placeholder}
                </div>
              )}</Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w- max-w-full max-h- overflow-y-auto">
            <h2 className="font-bold text-lg mb-4">Edit Task</h2>
            <input value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})} className="border w-full p-2.5 mb-3 rounded-lg text-sm"/>
            <textarea value={editing.description||""} onChange={e=>setEditing({...editing,description:e.target.value})} className="border w-full p-2.5 mb-3 rounded-lg h-20 text-sm" placeholder="Description..."/>
            <div className="flex gap-3 mb-3">
              <input type="date" value={editing.due_date||""} onChange={e=>setEditing({...editing,due_date:e.target.value})} className="border p-2.5 rounded-lg w-1/2 text-sm"/>
              <select value={editing.priority} onChange={e=>setEditing({...editing,priority:e.target.value})} className="border p-2.5 rounded-lg w-1/2 text-sm"><option value="medium">Medium</option><option value="high">High</option></select>
            </div>
            <select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})} className="border w-full p-2.5 mb-3 rounded-lg text-sm"><option value="todo">Todo</option><option value="doing">Doing</option><option value="done">Done</option></select>

            <div className="border rounded-lg p-3 mb-3 bg-blue-50/50">
              <label className="text- font-bold uppercase">Assign To 🔔 will notify</label>
              <select value={editing.assigned_to||""} onChange={e=>{
                const sel=boardMembers.find(m=>m.email===e.target.value)
                setEditing({...editing, assigned_to:e.target.value, assigned_to_name:sel?.name||""})
              }} className="border w-full p-2.5 rounded-lg text-sm mt-1 bg-white">
                <option value="">Unassigned</option>
                {boardMembers.map(m=>(
                  <option key={m.email} value={m.email}>{m.name} ({m.email})</option>
                ))}
              </select>
            </div>

            <div className="border rounded-lg p-3 mb-4 bg-gray-50">
              <label className="text- font-bold uppercase">File Upload 📎</label>
              <input type="file" onChange={handleFileUpload} className="w-full text-xs mt-2 mb-2"/>
              {uploading && <p className="text-xs text-blue-600">Uploading...</p>}
              {editing.attachment_url && (
                <div className="mt-2">
                  {editing.attachment_url.startsWith("data:image")||editing.attachment_url.includes("image")? <img src={editing.attachment_url} className="w-full h-32 object-cover rounded border"/> : <a href={editing.attachment_url} target="_blank" className="text-xs text-blue-600 break-all">{editing.attachment_url}</a>}
                  <button onClick={()=>setEditing({...editing,attachment_url:""})} className="text- text-red-500 mt-1">Remove file</button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={saveEdit} className="bg-black text-white flex-1 p-2.5 rounded-lg text-sm">Save</button>
              <button onClick={()=>delTask(editing.id)} className="bg-red-50 text-red-600 flex-1 p-2.5 rounded-lg border text-sm">Delete</button>
              <button onClick={()=>setEditing(null)} className="bg-gray-100 flex-1 p-2.5 rounded-lg text-sm">Cancel</button>
            </div>

            <div className="mt-6 border-t pt-4">
              <h3 className="font-bold text-sm mb-3">Comments 💬 (notifies assigned)</h3>
              <div className="max-h- overflow-y-auto mb-3 space-y-2 border rounded p-2 bg-gray-50">
                {taskComments.length===0? <p className="text-xs text-gray-400">No comments</p> : taskComments.map(c => (
                  <div key={c.id} className="bg-white p-2 rounded border"><div className="flex justify-between"><span className="font-bold text-xs text-blue-600">{c.user_name}</span><span className="text- text-gray-400">{c.created_at}</span></div><p className="text-">{c.text}</p></div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addComment()} placeholder="Comment..." className="border flex-1 p-2.5 rounded-lg text-sm"/>
                <button onClick={addComment} className="bg-blue-600 text-white px-4 rounded-lg text-sm">Post</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default App