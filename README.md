# TaskNova — Full-Stack Team Workspace

A portfolio-ready full-stack SaaS-style project for managing projects, tasks, teams, and workspace activity.

## Stack
- Frontend: React 19, Vite, Lucide React, responsive CSS
- Backend: Node.js, Express 5
- Database: PostgreSQL
- Auth: JWT + bcrypt password hashing
- Deployment target: Vercel (frontend) + Render/Railway (backend) + Neon/Supabase PostgreSQL

## Demo
Email: `demo@tasknova.app`  
Password: `Demo@123`

## Run locally
1. Start PostgreSQL and create a database named `tasknova`.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` and `JWT_SECRET`.
3. In `backend`: `npm install` then `npm start`.
4. Copy `frontend/.env.example` to `frontend/.env`.
5. In `frontend`: `npm install` then `npm run dev`.
6. Open the Vite URL shown in the terminal.

The API automatically creates the database tables and seeds a demo workspace on the first run.

## Features
- JWT authentication with protected APIs
- Workspace-scoped data isolation
- Role-aware users
- Dashboard metrics and progress tracking
- Project creation and progress summaries
- Task creation, filtering, assignment, priority and status changes
- Activity feed
- Responsive dashboard UI
- Production-friendly environment variables

## Deployment
### Backend
Create a Node service on Render/Railway. Set `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_URL`. Build command: `npm install`; start command: `npm start`.

### Database
Use a managed PostgreSQL provider such as Neon or Supabase and paste its connection string into `DATABASE_URL`.

### Frontend
Deploy `frontend` as a Vite site on Vercel. Set `VITE_API_URL` to your deployed backend URL plus `/api`, for example `https://your-api.onrender.com/api`.

## Important
Never commit `.env` files or real production credentials.
