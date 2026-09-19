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
  const [taskComments, setTaskComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [activities, setActivities] = useState([]);
  const [renameValue, setRenameValue] = useState("");
  const wsRef = useRef(null)

  const authHeader={headers:{Authorization:`Bearer ${token}`}}

  const fetchBoards=async()=>{
    if(!token) return
    try{
      const r=await axios.get(`${API_URL}/api/boards`, authHeader)
      setBoards(r.data)
      if(r.data.length>0 &&!selectedBoard) setSelectedBoard(r.data[0].id)
    }catch(e){console.log("boards err",e)}
  }

  const fetchTasks=async()=>{
    if(!token ||!selectedBoard) return
    try{
      const r=await axios.get(`${API_URL}/api/tasks?board_id=${selectedBoard}`, authHeader)
      setTasks(r.data)
    }catch(e){console.log("tasks err",e)}
  }

  const fetchComments = async (taskId) => {
    if(!taskId) return
    try {
      const r = await axios.get(`${API_URL}/api/tasks/${taskId}/comments`, authHeader);
      setTaskComments(r.data);
    } catch(e) {console.log("comments err",e)}
  }

  const fetchActivities = async () => {
    if(!selectedBoard ||!token) return
    try{
      const r=await axios.get(`${API_URL}/api/boards/${selectedBoard}/activities`, authHeader)
      setActivities(r.data)
    }catch(e){console.log("activity err",e)}
  }

  useEffect(()=>{fetchBoards()},[token])
  useEffect(()=>{fetchTasks(); fetchActivities(); if(selectedBoard) setRenameValue(boards.find(b=>b.id===selectedBoard)?.name||"")},[selectedBoard])
  useEffect(()=>{ if(editing) fetchComments(editing.id) },[editing])

  // WebSocket Realtime
  useEffect(()=>{
    if(!selectedBoard ||!token) return
    const wsBase = API_URL.replace("https://","wss://").replace("http://","ws://")
    const ws = new WebSocket(`${wsBase}/ws/${selectedBoard}`)
    wsRef.current = ws
    ws.onopen = ()=> console.log("WS connected", selectedBoard)
    ws.onmessage = (e)=>{
      try{
        const data=JSON.parse(e.data)
        if(data.type==="update"){
          fetchTasks()
          fetchActivities()
          if(editing) fetchComments(editing.id)
        }
      }catch{}
    }
    return ()=> ws.close()
  },[selectedBoard])

  // Fallback polling
  useEffect(()=>{
    if(!selectedBoard ||!token) return
    const id=setInterval(()=>{ fetchTasks(); fetchActivities() },5000)
    return ()=>clearInterval(id)
  },[selectedBoard])

  const handleLogin=async()=>{
    const f=new URLSearchParams(); f.append("username",email); f.append("password",password)
    try{
      const r=await axios.post(`${API_URL}/api/login`,f)
      localStorage.setItem("token",r.data.access_token)
      setToken(r.data.access_token)
    }catch{alert("Login failed")}
  }

  const handleRegister=async()=>{
    try{
      await axios.post(`${API_URL}/api/register`,{email,password,name})
      alert("Registered! Login cheyy")
      setIsRegister(false)
    }catch(e){alert(e.response?.data?.detail||"Failed")}
  }

  const addTask=async()=>{
    if(!title.trim() ||!selectedBoard) return alert("Select board first")
    let prio=title.toLowerCase().includes("urgent")||title.toLowerCase().includes("bug")?"high":"medium"
    await axios.post(`${API_URL}/api/tasks`,{title,status:"todo",priority:prio,description:"",due_date:"",board_id:selectedBoard},authHeader)
    setTitle("")
  }

  const onDragEnd=async(r)=>{
    if(!r.destination) return
    const id=r.draggableId; const ns=r.destination.droppableId
    setTasks(p=>p.map(t=>String(t.id)===id?{...t,status:ns}:t))
    await axios.put(`${API_URL}/api/tasks/${id}`,{status:ns},authHeader)
  }

  const openEditModal = (t) => { setEditing(t) }

  const saveEdit=async()=>{
    await axios.put(`${API_URL}/api/tasks/${editing.id}`,editing,authHeader)
    setEditing(null)
  }

  const delTask=async(id)=>{
    await axios.delete(`${API_URL}/api/tasks/${id}`,authHeader)
    setEditing(null)
  }

  const createBoard=async()=>{
    if(!newBoardName.trim()) return
    const r=await axios.post(`${API_URL}/api/boards`,{name:newBoardName},authHeader)
    setNewBoardName(""); await fetchBoards(); setSelectedBoard(r.data.id)
  }

  const renameBoard=async()=>{
    if(!renameValue.trim() ||!selectedBoard) return
    await axios.put(`${API_URL}/api/boards/${selectedBoard}`,{name:renameValue},authHeader)
    await fetchBoards()
  }

  const deleteBoard=async()=>{
    if(!selectedBoard) return
    if(!confirm("Delete this board? All tasks will be deleted!")) return
    await axios.delete(`${API_URL}/api/boards/${selectedBoard}`,authHeader)
    setSelectedBoard(null)
    await fetchBoards()
  }

  const inviteUser=async()=>{
    if(!inviteEmail.trim() ||!selectedBoard) return alert("Select board first")
    try{
      await axios.post(`${API_URL}/api/boards/${selectedBoard}/invite`,{email:inviteEmail},authHeader)
      alert(`Invited ${inviteEmail}!`)
      setInviteEmail("")
    }catch(e){ alert(e.response?.data?.detail || "User must register first!") }
  }

  const addComment = async () => {
    if(!newComment.trim() ||!editing) return
    try{
      await axios.post(`${API_URL}/api/tasks/${editing.id}/comments`, {text: newComment}, authHeader)
      setNewComment("")
      fetchComments(editing.id)
    }catch(e){ alert("Comment failed") }
  }

  const filtered=tasks.filter(t=>{
    const ms=t.title.toLowerCase().includes(search.toLowerCase()) || (t.description||"").toLowerCase().includes(search.toLowerCase())
    const mp=filterPrio==="all" || t.priority===filterPrio
    return ms && mp
  })

  const currentBoardName = boards.find(b=>b.id===selectedBoard)?.name || ""

  if(!token) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <div className="bg-white p-8 rounded-xl border w-full max-w- shadow-sm">
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
            <button key={b.id} onClick={()=>setSelectedBoard(b.id)} className={`w-full text-left p-2.5 rounded-lg text-sm border truncate ${selectedBoard===b.id?'bg-black text-white border-black':'bg-gray-50 hover:bg-gray-100'}`}>
              📋 {b.name}
            </button>
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
          <p className="text- text-gray-500 mb-2 truncate">Board: <b className="text-black">{currentBoardName}</b></p>
          <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="friend@gmail.com" className="border w-full p-2.5 rounded-lg text-sm mb-2"/>
          <button disabled={!selectedBoard} onClick={inviteUser} className="bg-blue-600 disabled:bg-gray-300 text-white w-full p-2.5 rounded-lg text-sm">Invite</button>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-bold text- uppercase mb-2">Activity Feed 🔥</h3>
          <div className="max-h- overflow-auto space-y-1">
            {activities.length===0 && <p className="text- text-gray-400">No activity yet</p>}
            {activities.map(a=>(
              <div key={a.id} className="text- bg-gray-50 p-2 rounded border">
                <b className="text-blue-600">{a.user_name}</b> {a.action}
                <div className="text- text-gray-400">{a.created_at}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={()=>{localStorage.clear(); setToken(null)}} className="mt-auto text-xs border p-2 rounded-lg hover:bg-gray-50">Logout</button>
      </div>

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h2 className="text-2xl font-bold truncate">{currentBoardName || "Select a board"}</h2>
          <div className="flex gap-2">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..." className="border px-4 py-2.5 w- lg:w- rounded-lg bg-white text-sm"/>
            <select value={filterPrio} onChange={e=>setFilterPrio(e.target.value)} className="border px-3 py-2.5 rounded-lg bg-white text-sm"><option value="all">All</option><option value="high">High</option><option value="medium">Medium</option></select>
          </div>
        </div>

        <div className="flex gap-3 mb-8">
          <input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()} placeholder="New task... (urgent = high)" className="border px-4 py-2.5 w-full max-w- rounded-lg bg-white text-sm"/>
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
                        {t.description && <div className="text- text-gray-500 mt-1 line-clamp-2">{t.description}</div>}
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
            <select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})} className="border w-full p-2.5 mb-4 rounded-lg text-sm"><option value="todo">Todo</option><option value="doing">Doing</option><option value="done">Done</option></select>
            <div className="flex gap-3">
              <button onClick={saveEdit} className="bg-black text-white flex-1 p-2.5 rounded-lg text-sm">Save</button>
              <button onClick={()=>delTask(editing.id)} className="bg-red-50 text-red-600 flex-1 p-2.5 rounded-lg border text-sm">Delete</button>
              <button onClick={()=>setEditing(null)} className="bg-gray-100 flex-1 p-2.5 rounded-lg text-sm">Cancel</button>
            </div>

            <div className="mt-6 border-t pt-4">
              <h3 className="font-bold text-sm mb-3">Comments (Live 💬)</h3>
              <div className="max-h- overflow-y-auto mb-3 space-y-2 border rounded p-2 bg-gray-50">
                {taskComments.length===0? <p className="text-xs text-gray-400">No comments yet.</p> : taskComments.map(c => (
                  <div key={c.id} className="bg-white p-3 rounded-lg border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs text-blue-600">{c.user_name || `User ${c.user_id}`}</span>
                      <span className="text- text-gray-400">{c.created_at}</span>
                    </div>
                    <p className="text-">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addComment()} placeholder="Type a comment..." className="border flex-1 p-2.5 rounded-lg text-sm bg-gray-50 focus:bg-white" />
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