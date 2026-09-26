# WorkFlow SaaS

A full-stack workflow and collaboration platform inspired by Trello and Asana, designed to help teams manage projects, track execution, collaborate in real time, and operate from a polished SaaS dashboard.

> A modern project management SaaS prototype built for real-world team workflows, productivity visibility, and product-ready UX.

![React](https://img.shields.io/badge/Frontend-React-61DAFB)
![Vite](https://img.shields.io/badge/Build-Vite-646CFF)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)
![Tailwind](https://img.shields.io/badge/UI-TailwindCSS-38B2AC)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791)

## Demo

- Live app: add your deployed URL here
- API: add your backend URL here
- Screenshots: add board, task modal, and dashboard images here

![Workflow Dashboard](https://via.placeholder.com/1200x700?text=Workflow+Dashboard)

## Product Summary

WorkFlow SaaS is a full-stack workflow and collaboration platform that brings together task management, board-based planning, team communication, reporting, and SaaS product UX in one unified experience. It was built to simulate how a modern productivity product feels for teams managing work at scale.

This project demonstrates end-to-end product thinking across user experience, collaboration flow, workflow structure, and business-oriented dashboard design.

## Overview

WorkFlow SaaS is a project and task management application designed to feel like a real SaaS product rather than a simple to-do app. It combines board-based planning, role-based collaboration, live task updates, reporting, and premium product UI in one workspace.

The platform is designed to support real team workflows, including:

- shared boards for planning and execution
- task updates and cross-user collaboration
- reporting and visibility for operational tracking
- workspace and billing-related SaaS product flows
- a polished product experience for end users and stakeholders

## Key Features

### Collaboration and Workspace Management
- create, rename, and delete boards
- invite teammates to shared workspaces
- role-based permissions and access control
- workspace-level activity tracking and collaboration visibility

### Task Management
- create, edit, and delete tasks
- move tasks across To Do, In Progress, and Done
- set priority levels and labels
- assign tasks to teammates
- add comments, subtasks, and attachments

### Productivity and Insights
- analytics dashboard and reporting views
- timeline and calendar-based task tracking
- automation, onboarding, and resource management pages
- audit logging and integrations overview

### SaaS Product Experience
- premium UI styling with dark mode support
- billing and plan selection screens
- profile and workspace settings management
- clean, product-ready navigation and dashboard structure

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Axios
- WebSockets for live updates
- drag-and-drop task interactions

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT authentication
- board-scoped real-time updates

## Architecture

The application follows a board-centric SaaS architecture:

- each board acts as an independent workspace
- tasks belong to a selected board and are shared across collaborators
- users can invite teammates and manage board-level permissions
- comments, activity updates, and analytics are surfaced through the shared workflow experience
- the frontend provides a polished operational dashboard while the backend manages authentication, data flow, and shared workspace logic

## Key Highlights

- premium SaaS-style UI with a dark mode experience
- real-time board interaction flow
- collaborative task updates across workspaces
- analytics and reporting views for operational visibility
- billing, settings, and product management screens
- onboarding and workflow guidance built into the product

## Project Structure

```text
workflow-saas/
├── backend/
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── runtime.txt
│   ├── schemas.py
│   └── utils.py
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── public/
│   └── src/
├── netlify.toml
├── README.md
├── .gitignore
└── .env.example (if added in your environment setup)
```

## Getting Started

### 1. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Run the frontend

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

## Environment Variables

`.env.example` is a keys-only template listing every variable the code reads.
See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for what each key does and how to
generate the random ones.

Two are required in production, and the app refuses to boot without them:

```bash
# SECRET_KEY - signs login tokens
python -c "import secrets; print(secrets.token_urlsafe(48))"

# INTEGRATION_ENCRYPTION_KEY - encrypts third-party credentials at rest
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

`SECRET_KEY` must stay the same across deploys, or every user is signed out.
`DATABASE_URL` must point at Postgres on a deployed service — sqlite lives on an
ephemeral filesystem and is destroyed on every deploy.

Invite emails need either a valid `BREVO_API_KEY` or configured `SMTP_HOST`,
`SMTP_USER` and `SMTP_PASS`. The frontend reads `VITE_API_URL`, which Vite
inlines at **build** time — set it in the hosting UI and rebuild.

## Deployment Notes

- frontend can be deployed to Netlify or Vercel
- backend can be deployed to Render, Railway, or similar services
- production deployments should use secure API and WebSocket URLs
- environment variables should be stored in the hosting platform securely

## Current Status

The product is in a polished SaaS-style state with the main workflow experience connected and visually unified. It is ready to serve as a solid foundation for deeper production features such as Stripe billing, email automation, enterprise admin controls, and advanced workflow rules.

## Roadmap

- Stripe and billing integration
- email reminders and notifications
- advanced filtering and saved views
- export/import workflows for project data
- mobile responsiveness improvements
- enterprise admin and permission controls

## License

This project is intended for learning, portfolio, and prototype use unless otherwise specified.

## Summary

WorkFlow SaaS is a strong full-stack workflow management product concept built with React and FastAPI, combining project planning, collaboration, analytics, and SaaS-style UX into one app. It is structured to be both presentable to recruiters and extensible for real-world product development.


