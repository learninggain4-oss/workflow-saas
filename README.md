# WorkFlow SaaS - Real-time Collaborative Task Management

> Trello + Asana inspired SaaS built with FastAPI + React + WebSockets

🔗 **Live Demo:** https://your-frontend.vercel.app
🔗 **Backend API:** https://workflow-saas-cofz.onrender.com

## 🚀 Features

### Core SaaS
- **Auth:** JWT login/register
- **Boards:** Create / Rename / Delete boards (Workspace)
- **Collaboration:** Invite teammates by email, shared boards
- **Members:** View board members list

### Task Management
- **CRUD:** Create, Edit, Delete tasks
- **Drag & Drop:** Todo → Doing → Done (hello-pangea/dnd)
- **Priority:** Auto high if "urgent/bug" in title
- **Fields:** Description, Due Date, Priority, Status
- **Assignment:** Assign task to teammate (👤)
- **Attachment:** Add file URL / image link

### Real-time
- **WebSocket:** Instant sync - oru aal move cheythal adutha aalkku 0.1sec-il kanam
- **Comments:** Live discussion per task with user name
- **Activity Feed:** aar enthu cheythu ennu live kanam

## 🛠 Tech Stack

**Backend:** FastAPI, SQLAlchemy, PostgreSQL (Render), WebSockets, JWT, passlib
**Frontend:** React, Vite, TailwindCSS, Axios, Drag & Drop
**Deploy:** Backend - Render, Frontend - Vercel

## 📁 Architecture

Frontend (Vercel) --REST+WS--> FastAPI (Render) --> PostgreSQL
| |
DragDrop, WS Client ConnectionManager (board_id based broadcast)


## ⚙️ Local Setup

Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload


Frontend:

cd frontend
npm install
npm run dev
# .env -> VITE_API_URL=http://localhost:8000


🔮 Next Features
 Real file upload (S3/Cloudinary)
 Email notifications
 Calendar / Gantt view
 Dark mode
Built by you - ready for resume! 🚀