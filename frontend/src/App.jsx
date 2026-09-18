import { useState, useEffect } from 'react'
import axios from 'axios'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"))
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState("")

  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  const fetchTasks = async () => {
    if (!token) return
    try {
      const res = await axios.get(`${API_URL}/api/tasks`, authHeader)
      setTasks(res.data)
    } catch (e) { console.log(e) }
  }

  useEffect(() => { fetchTasks() }, [token])

  const handleLogin = async () => {
    try {
      const form = new URLSearchParams()
      form.append("username", email)
      form.append("password", password)
      const res = await axios.post(`${API_URL}/api/login`, form)
      localStorage.setItem("token", res.data.access_token)
      localStorage.setItem("email", email)
      setToken(res.data.access_token)
    } catch (e) { alert("Login failed - Email/Password wrong") }
  }

  const handleRegister = async () => {
    try {
      await axios.post(`${API_URL}/api/register`, { email, password, name })
      alert("Registered! Now Login cheyy")
      setIsRegister(false)
    } catch (e) { alert(e.response?.data?.detail || "Register failed") }
  }

  const addTask = async () => {
    if (!title.trim()) return
    let priority = title.toLowerCase().includes("urgent") || title.toLowerCase().includes("bug")? "high" : "medium"
    await axios.post(`${API_URL}/api/tasks?id=${Date.now()}&title=${encodeURIComponent(title)}&status=todo&priority=${priority}`, {}, authHeader)
    setTitle(""); fetchTasks()
  }

  const onDragEnd = async (result) => {
    if (!result.destination) return
    const taskId = result.draggableId
    const newStatus = result.destination.droppableId
    setTasks(prev => prev.map(t => String(t.id) === taskId? {...t, status: newStatus } : t))
    await axios.put(`${API_URL}/api/tasks/${taskId}?status=${newStatus}`, {}, authHeader)
  }

  const deleteTask = async (id) => {
    await axios.delete(`${API_URL}/api/tasks/${id}`, authHeader)
    fetchTasks()
  }

  const logout = () => { localStorage.clear(); setToken(null); setTasks([]) }

  // LOGIN SCREEN
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
        <div className="bg-white p-8 rounded-xl border border-gray-200 w- shadow-sm">
          <h1 className="font-bold text-xl mb-1">Login - WorkFlow SaaS 🚀</h1>
          <p className="text-sm text-gray-500 mb-5">Step 2 - User wise tasks</p>
          {isRegister && <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="border border-gray-300 w-full p-2.5 mb-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" />}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email - mihrajpunnad27@gmail.com" className="border border-gray-300 w-full p-2.5 mb-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="border border-gray-300 w-full p-2.5 mb-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" />
          <button onClick={isRegister? handleRegister : handleLogin} className="bg-black text-white w-full p-2.5 rounded-lg font-medium hover:bg-zinc-800">{isRegister? "Register" : "Login"}</button>
          <button onClick={() => setIsRegister(!isRegister)} className="text-sm text-gray-500 mt-4 w-full hover:text-black">{isRegister? "Have account? Login" : "New? Register"}</button>
        </div>
      </div>
    )
  }

  // MAIN BOARD
  return (
    <div className="min-h-screen bg-[#f8fafc] p-8">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">WorkFlow SaaS 🚀</h1>
          <p className="text-sm text-gray-500">{localStorage.getItem("email")} | Total: {tasks.length}</p>
        </div>
        <button onClick={logout} className="text-sm border border-gray-300 bg-white px-4 py-2 rounded-lg hover:bg-gray-50">Logout</button>
      </div>

      <div className="max-w-6xl mx-auto flex gap-3 mt-6">
        <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="New task... ex: Fix urgent bug" className="border border-gray-300 px-4 py-2.5 w- rounded-lg focus:outline-none focus:ring-2 focus:ring-black" />
        <button onClick={addTask} className="bg-black text-white px-6 rounded-lg font-medium hover:bg-zinc-800">Add + AI</button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-6 mt-8">
          {["todo", "doing", "done"].map(status => (
            <Droppable key={status} droppableId={status}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="bg-white rounded-xl border border-gray-200 p-4 min-h-">
                  <h3 className="font-bold uppercase text-xs tracking-wider border-b pb-3 mb-3">{status} <span className="text-gray-400">({tasks.filter(t => t.status === status).length})</span></h3>
                  {tasks.filter(t => t.status === status).map((t, index) => (
                    <Draggable key={t.id} draggableId={String(t.id)} index={index}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="bg-[#f1f5f9] p-3 rounded-lg mb-3 border border-gray-100 hover:shadow-sm">
                          <div className="font-medium text-">{t.title}</div>
                          <div className="flex justify-between items-center mt-2">
                            <span className={`text- px-2 py-1 rounded-full font-bold ${t.priority === 'high'? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{t.priority}</span>
                            <button onClick={() => deleteTask(t.id)} className="text- text-gray-400 hover:text-red-500">Delete</button>
                          </div>
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
    </div>
  )
}

export default App