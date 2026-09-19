# WorkFlow SaaS — Real-time Collaborative Task Manager

> **Trello + Asana clone built as a real SaaS** — Boards, Live Comments, Assignment, File Upload, WebSockets

![React](https://img.shields.io/badge/Frontend-React+Vite-61DAFB)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)
![Postgres](https://img.shields.io/badge/DB-PostgreSQL-336791)
![Live](https://img.shields.io/badge/Live-Vercel+Render-black)

**Live Demo:** `https://your-frontend.vercel.app`
**API:** `https://workflow-saas-cofz.onrender.com`
**Video Demo:** (add Loom link)

### ✨ What I Built

This is not a todo list — this is a **multi-tenant SaaS** with:

**Core SaaS:**
- JWT Auth (register/login)
- Workspaces = Boards (Create / Rename / Delete)
- Invite teammates by email → shared board access
- Board Members list + role (owner can delete/rename)

**Task System:**
- CRUD + Drag & Drop (Todo → Doing → Done)
- Auto priority (title has "urgent/bug" → high)
- Description, Due Date, Status
- **Assign to teammate** — 👤 badge on card + activity log
- **Real File Upload** — Cloudinary + base64 fallback, image preview on card

**Real-time Collaboration:**
- **WebSocket per board** (`/ws/{board_id}`) — move/comment/assign = 0.1s sync to all members
- Polling fallback (5s) for reliability
- Live Comments with user name + timestamp
- Activity Feed — "Arjun created task 'Bug Fix' / moved to Done / invited ajay@gmail.com / assigned to..."

### 🛠️ Tech Stack

**Frontend:** React + Vite, TailwindCSS, Axios, @hello-pangea/dnd, WebSocket API
**Backend:** FastAPI, SQLAlchemy, PostgreSQL, WebSockets (ConnectionManager), JWT, Passlib, Cloudinary
**Infra:** Render (API + Postgres), Vercel (Frontend), Cloudinary (files)

### 🏗️ Architecture

Vercel (React)

REST: /api/boards, /tasks, /upload, /invite
WS: wss://.../ws/{board_id}

↓
FastAPI (Render)
├─ ConnectionManager { board_id: } → broadcast {"type":"update"}
├─ /api/upload → Cloudinary (or base64 data URL fallback)
└─ PostgreSQL (users, boards, board_members, tasks, comments, activities)[WebSocket]


### 📸 Screenshots
Add 3 screenshots here: Kanban view, Edit Modal with Assign+File, Activity Feed

### 🚀 Local Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
# create.env from.env.example
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
# create.env from.env.example
npm run dev



🔑 Env Vars

Backend .env:

DATABASE_URL=postgresql://...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...


Frontend .env:

VITE_API_URL=https://workflow-saas-cofz.onrender.com


📡 Key APIs


POST /api/register, /api/login
GET/POST /api/boards, PUT/DELETE /api/boards/{id}
POST /api/boards/{id}/invite, GET /api/boards/{id}/members
GET /api/boards/{id}/activities
GET /api/tasks?board_id=1, POST /api/tasks
PUT /api/tasks/{id}, DELETE /api/tasks/{id}
GET/POST /api/tasks/{id}/comments
POST /api/upload (multipart file → {url})
WS /ws/{board_id}


✅ What I Fixed (Real Production Bugs)
DELETE 500 — IN () empty list in Postgres + comment must be deleted before task
CORS + global exception handler
fix_db() startup migration for Render Postgres (ALTER TABLE ADD COLUMN IF NOT EXISTS)
🔮 Next
 Email notifications (due date)
 Calendar / Gantt view
 Dark mode + Search


 Built for resume — real-time SaaS, not a toy todo.

 
### 2. `backend/.env.example`

```txt
DATABASE_URL=postgresql://user:pass@host/db
# For local use sqlite
# DATABASE_URL=sqlite:///./tasks.db

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret



frontend/.env.example

VITE_API_URL=http://localhost:8000
# Production
# VITE_API_URL=https://workflow-saas-cofz.onrender.com


Demo Checklist (1 min Loom video)


1. Login with 2 accounts (2 browsers)
2. Board create → Invite 2nd account → Show members list
3. Task create with "urgent bug" → auto high priority
4. Drag todo → doing → done → 2nd browser live sync
5. Edit → Assign to teammate → File upload → Image preview
6. Comment → Other browser instant comment
7. Activity feed scroll
8. Show Render logs + Vercel deploy


LinkedIn:

🚀 Built a Real-time Collaborative SaaS — WorkFlow SaaS (Trello + Asana clone)

Not a todo app — full multi-tenant SaaS:
✅ JWT Auth, Boards (CRUD), Invite by email
✅ Drag-Drop, Assign, File Upload (Cloudinary), Due dates
✅ Real-time with WebSockets per board — 0.1s sync
✅ Comments + Activity Feed + Live presence

Stack: FastAPI + PostgreSQL + React + Tailwind + WebSockets + Cloudinary + Render + Vercel

Fixed real prod bugs: DELETE 500 due to empty IN() in Postgres, CORS, migration on startup.

Live: [vercel link] | API: [render link] | Code: [github link]

#buildinpublic #saas #fastapi #react #websocket


Resume bullet:

WorkFlow SaaS — Real-time Collaborative Task Manager | FastAPI, React, PostgreSQL, WebSockets, Cloudinary
• Built multi-tenant SaaS with boards, invite-based sharing, task assignment, file upload, live comments
• Implemented board-scoped WebSocket manager + 5s polling fallback for 0.1s cross-user sync
• Fixed prod Postgres bugs (empty IN() clause, FK cascade, startup ALTER TABLE migrations)
• Deployed: Render (API+DB) + Vercel (frontend) + Cloudinary


