import { useState, useEffect } from 'react'
import axios from 'axios'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"
const COLUMNS = ["todo", "doing", "done"]

function App() {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState("")

  const fetchTasks = async () => {
    const res = await axios.get(`${API_URL}/api/tasks`)
    setTasks(res.data)
  }

  useEffect(() => { fetchTasks() }, [])

  const addTask = async () => {
    if (!title.trim()) return
    let priority = "medium"
    if (title.toLowerCase().includes("urgent") || title.toLowerCase().includes("bug")) priority = "high"

    await axios.post(`${API_URL}/api/tasks`, {
      id: Date.now(),
      title,
      status: "todo",
      priority
    })
    setTitle("")
    fetchTasks()
  }

  const onDragEnd = async (result) => {
    if (!result.destination) return
    const taskId = parseInt(result.draggableId)
    const newStatus = result.destination.droppableId

    // Optimistic update - UI instant maatum
    setTasks(prev => prev.map(t => t.id === taskId? {...t, status: newStatus} : t))

    // Backend update
    await axios.put(`${API_URL}/api/tasks/${taskId}?status=${newStatus}`)
  }

  const deleteTask = async (id) => {
    await axios.delete(`${API_URL}/api/tasks/${id}`)
    fetchTasks()
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold">WorkFlow SaaS 🚀</h1>
        <p className="text-gray-500 mt-1">Drag & Drop + AI Priority | Total: {tasks.length}</p>

        <div className="flex gap-3 mt-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="New task... ex: Fix urgent bug"
            className="border border-gray-300 rounded-lg px-4 py-2.5 w- focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button onClick={addTask} className="bg-black text-white px-6 py-2.5 rounded-lg font-medium hover:bg-zinc-800">
            Add Task + AI
          </button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-3 gap-6 mt-8">
            {COLUMNS.map(status => (
              <Droppable key={status} droppableId={status}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="bg-white rounded-xl border border-gray-200 p-4 min-h-">
                    <h3 className="font-bold uppercase text-sm tracking-wider border-b pb-3 mb-3">
                      {status} <span className="text-gray-400">({tasks.filter(t => t.status === status).length})</span>
                    </h3>

                    {tasks.filter(t => t.status === status).map((t, index) => (
                      <Draggable key={t.id} draggableId={String(t.id)} index={index}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="bg-[#f1f5f9] p-3 rounded-lg mb-3 border border-gray-100 hover:shadow-sm">
                            <div className="font-medium text-">{t.title}</div>
                            <div className="flex justify-between items-center mt-2">
                              <span className={`text- px-2 py-1 rounded-full font-bold ${t.priority === 'high'? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                {t.priority}
                              </span>
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
    </div>
  )
}

export default App