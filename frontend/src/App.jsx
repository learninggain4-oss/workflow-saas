import { useState, useEffect } from 'react'
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

  const authHeader={headers:{Authorization:`Bearer ${token}`}}

  const fetchBoards=async()=>{
    if(!token) return
    try{
      const r=await axios.get(`${API_URL}/api/boards`, authHeader)
      setBoards(r.data)
      if(r.data.length>0 &&!selectedBoard) setSelectedBoard(r.data[0].id)
    }catch(e){console.log(e)}
  }

  const fetchTasks=async()=>{
    if(!token ||!selectedBoard) return
    try{
      const r=await axios.get(`${API_URL}/api/tasks?board_id=${selectedBoard}`, authHeader)
      setTasks(r.data)
    }catch(e){console.log(e)}
  }

  useEffect(()=>{fetchBoards()},[token])
  useEffect(()=>{fetchTasks()},[selectedBoard])

  const handleLogin=async()=>{
    const f=new URLSearchParams(); f.append("username",email); f.append("password",password)
    try{ const r=await axios.post(`${API_URL}/api/login`,f); localStorage.setItem("token",r.data.access_token); setToken(r.data.access_token)}catch{alert("Login failed")}
  }
  const handleRegister=async()=>{ try{ await axios.post(`${API_URL}/api/register`,{email,password,name}); alert("Registered! Login cheyy"); setIsRegister(false)}catch(e){alert(e.response?.data?.detail||"Failed")}}

  const addTask=async()=>{
    if(!title.trim() ||!selectedBoard) return
    let prio=title.toLowerCase().includes("urgent")||title.toLowerCase().includes("bug")?"high":"medium"
    await axios.post(`${API_URL}/api/tasks`,{title,status:"todo",priority:prio,description:"",due_date:"",board_id:selectedBoard},authHeader)
    setTitle(""); fetchTasks()
  }

  const onDragEnd=async(r)=>{
    if(!r.destination) return
    const id=r.draggableId; const ns=r.destination.droppableId
    setTasks(p=>p.map(t=>String(t.id)===id?{...t,status:ns}:t))
    await axios.put(`${API_URL}/api/tasks/${id}`,{status:ns},authHeader)
  }

  const saveEdit=async()=>{ await axios.put(`${API_URL}/api/tasks/${editing.id}`,editing,authHeader); setEditing(null); fetchTasks() }
  const delTask=async(id)=>{ await axios.delete(`${API_URL}/api/tasks/${id}`,authHeader); setEditing(null); fetchTasks() }

  const createBoard=async()=>{
    if(!newBoardName.trim()) return
    const r=await axios.post(`${API_URL}/api/boards`,{name:newBoardName},authHeader)
    setNewBoardName(""); await fetchBoards(); setSelectedBoard(r.data.id)
  }

  const inviteUser=async()=>{
    if(!inviteEmail.trim()) return
    try{
      await axios.post(`${API_URL}/api/boards/${selectedBoard}/invite`,{email:inviteEmail},authHeader)
      alert(`Invited ${inviteEmail} successfully!`); setInviteEmail("")
    }catch(e){ alert(e.response?.data?.detail || "User must register first!") }
  }

  const filtered=tasks.filter(t=>{
    const ms=t.title.toLowerCase().includes(search.toLowerCase()) || (t.description||"").toLowerCase().includes(search.toLowerCase())
    const mp=filterPrio==="all" || t.priority===filterPrio
    return ms && mp
  })

  const currentBoardName = boards.find(b=>b.id===selectedBoard)?.name || ""

  if(!token) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <div className="bg-white p-8 rounded-xl border w-"><h1 className="font-bold text-xl mb-5">WorkFlow SaaS Login</h1>
      {isRegister && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="border w-full p-2.5 mb-3 rounded-lg"/>}
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="border w-full p-2.5 mb-3 rounded-lg"/>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="border w-full p-2.5 mb-4 rounded-lg"/>
      <button onClick={isRegister?handleRegister:handleLogin} className="bg-black text-white w-full p-2.5 rounded-lg">{isRegister?"Register":"Login"}</button>
      <button onClick={()=>setIsRegister(!isRegister)} className="text-sm text-gray-500 mt-4 w-full">{isRegister?"Have account? Login":"New? Register"}</button></div>
    </div>
  )

  return(
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar */}
      <div className="w- bg-white border-r p-5 flex flex-col">
        <h1 className="font-bold text-lg mb-6">WorkFlow SaaS 🚀</h1>
        <h2 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-3">Your Boards</h2>
        <div className="space-y-2 mb-4">
          {boards.map(b=>(
            <button key={b.id} onClick={()=>setSelectedBoard(b.id)} className={`w-full text-left p-2.5 rounded-lg text-sm border ${selectedBoard===b.id?'bg-black text-white border-black':'bg-gray-50 hover:bg-gray-100'}`}>
              📋 {b.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-8">
          <input value={newBoardName} onChange={e=>setNewBoardName(e.target.value)} placeholder="New board name" className="border p-2 rounded-lg text-sm flex-1"/>
          <button onClick={createBoard} className="bg-black text-white px-3 rounded-lg text-sm">+</button>
        </div>

        <div className="mt-auto border-t pt-5">
          <h3 className="font-bold text-xs uppercase mb-3">Invite Teammate</h3>
          <p className="text- text-gray-500 mb-2">Board: <b>{currentBoardName}</b></p>
          <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="friend@gmail.com" className="border w-full p-2.5 rounded-lg text-sm mb-2"/>
          <button onClick={inviteUser} className="bg-blue-600 text-white w-full p-2.5 rounded-lg text-sm">Invite to Board</button>
          <p className="text- text-gray-400 mt-2">User must register first in this app.</p>
        </div>
        <button onClick={()=>{localStorage.clear(); setToken(null)}} className="mt-4 text-xs border p-2 rounded-lg">Logout</button>
      </div>

      {/* Main */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h2 className="text-2xl font-bold">{currentBoardName || "Select a board"}</h2>
          <div className="flex gap-2">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..." className="border px-4 py-2.5 w- rounded-lg bg-white"/>
            <select value={filterPrio} onChange={e=>setFilterPrio(e.target.value)} className="border px-3 py-2.5 rounded-lg bg-white text-sm"><option value="all">All</option><option value="high">High</option><option value="medium">Medium</option></select>
          </div>
        </div>

        <div className="flex gap-3 mb-8">
          <input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()} placeholder="New task..." className="border px-4 py-2.5 w- rounded-lg bg-white"/>
          <button onClick={addTask} className="bg-black text-white px-6 rounded-lg">Add</button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-3 gap-6">
            {["todo","doing","done"].map(s=>(
              <Droppable key={s} droppableId={s}>{(p)=>(
                <div ref={p.innerRef} {...p.droppableProps} className="bg-white rounded-xl border p-4 min-h-">
                  <h3 className="font-bold uppercase text-xs tracking-wider border-b pb-3 mb-3">{s} ({filtered.filter(t=>t.status===s).length})</h3>
                  {filtered.filter(t=>t.status===s).map((t,i)=>(
                    <Draggable key={t.id} draggableId={String(t.id)} index={i}>{(pr)=>(
                      <div ref={pr.innerRef} {...pr.draggableProps} {...pr.dragHandleProps} onClick={()=>setEditing(t)} className="bg-[#f1f5f9] p-3 rounded-lg mb-3 border hover:shadow-sm cursor-pointer">
                        <div className="font-medium text-">{t.title}</div>
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
          <div className="bg-white rounded-xl p-6 w-">
            <h2 className="font-bold text-lg mb-4">Edit Task</h2>
            <input value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})} className="border w-full p-2.5 mb-3 rounded-lg"/>
            <textarea value={editing.description||""} onChange={e=>setEditing({...editing,description:e.target.value})} className="border w-full p-2.5 mb-3 rounded-lg h-20" placeholder="Description..."/>
            <div className="flex gap-3 mb-3">
              <input type="date" value={editing.due_date||""} onChange={e=>setEditing({...editing,due_date:e.target.value})} className="border p-2.5 rounded-lg w-1/2"/>
              <select value={editing.priority} onChange={e=>setEditing({...editing,priority:e.target.value})} className="border p-2.5 rounded-lg w-1/2"><option value="medium">Medium</option><option value="high">High</option></select>
            </div>
            <select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})} className="border w-full p-2.5 mb-4 rounded-lg"><option value="todo">Todo</option><option value="doing">Doing</option><option value="done">Done</option></select>
            <div className="flex gap-3">
              <button onClick={saveEdit} className="bg-black text-white flex-1 p-2.5 rounded-lg">Save</button>
              <button onClick={()=>delTask(editing.id)} className="bg-red-50 text-red-600 flex-1 p-2.5 rounded-lg border">Delete</button>
              <button onClick={()=>setEditing(null)} className="bg-gray-100 flex-1 p-2.5 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default App