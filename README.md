# WorkFlow SaaS 🚀 - Trello Clone with AI Priority

Live Demo: **https://workflow-saas-xl.vercel.app**
Backend API: https://workflow-saas-cofz.onrender.com/docs

A full-stack Kanban board like Trello built for my portfolio.

### Features
- ✅ Drag & Drop (Todo / Doing / Done)
- ✅ User Auth (JWT + bcrypt) - each user sees own tasks
- ✅ Edit Task, Description, Due Date 📅
- ✅ Search + Priority Filter 🔍
- ✅ AI Priority - title-il "urgent/bug" ennu paranjal auto High priority
- ✅ Permanent DB - PostgreSQL on Render (not local SQLite)

### Tech Stack
- Frontend: React + Vite + Tailwind + @hello-pangea/dnd + Axios
- Backend: FastAPI + SQLAlchemy + PostgreSQL + JWT Auth
- Deploy: Vercel (frontend) + Render (backend + DB)

### Run Locally
```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# frontend
cd frontend
npm install
npm run dev


#API Endpoints

POST /api/register, POST /api/login, GET /api/tasks, POST /api/tasks, PUT /api/tasks/{id}, DELETE /api/tasks/{id}

Built by Mihraj TK - Kochi

