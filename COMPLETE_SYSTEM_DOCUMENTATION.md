# WebSphere — Complete System Documentation

This document explains the **end-to-end working** of the WebSphere project (frontend + backend + database + real-time + payments + notifications + AI features), and links to the deeper feature guides already present in the repo.

## Contents

- System overview
- How to run (dev)
- Environment variables
- Architecture (frontend ↔ backend ↔ DB)
- Core data model (MongoDB collections)
- Feature flows (project → application → workspace → milestones → escrow → deliverables)
- Notifications (in-app + push + cron jobs)
- AI/ML features (matching, pricing assistant, workspace AI assistant)
- Admin features
- API map (major route groups)
- Pointers to other docs

---

## 1) System overview

WebSphere is a freelancer marketplace platform with three roles:

- **Client**: posts projects, reviews applications, funds milestones via escrow, approves deliverables.
- **Freelancer**: builds profile, browses projects, applies, collaborates in workspaces, submits deliverables.
- **Admin**: manages users, reviews/controls escrows, resolves disputes, monitors platform stats.

The collaboration center is the **Workspace**, which contains:

- Chat + real-time indicators
- Milestones + approvals
- Deliverables + reviews
- Escrow payments + payment history
- Files + downloads
- Timeline audit trail
- Workspace AI Assistant (LLM + RAG)

---

## 2) How to run (development)

### Start full stack (Windows)

From the repo root:

```bash
start-dev.bat
```

To stop:

```bash
stop-dev.bat
```

### Start manually

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Health check: `GET http://localhost:5000/test`

---

## 3) Environment variables

### Backend

Backend uses `backend/.env` (see `backend/.env.example`). Key categories:

- MongoDB: `MONGODB_URI`
- Auth/session: `JWT_SECRET`, `SESSION_SECRET`
- CORS: `CORS_ORIGINS`, `FRONTEND_URL`
- Payments: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- Email: `BREVO_API_KEY`, `BREVO_SMTP_USER`, `BREVO_FROM_EMAIL`
- Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- Uploads: `CLOUDINARY_*`
- AI: `GROQ_API_KEY`

### Frontend

Frontend uses `frontend/.env` (dev) and `frontend/.env.production` (prod). Key variables:

- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_VAPID_PUBLIC_KEY` (optional; key can also be fetched from backend)
- `VITE_RAZORPAY_KEY_ID`

API base + endpoints are centralized in `frontend/src/config/api.js`.

---

## 4) Architecture

### Runtime architecture (high level)

```mermaid
flowchart LR
  U[Browser] -->|React UI| FE[Frontend (Vite/React)]
  FE -->|REST: /api/*| BE[Backend (Express)]
  FE <-->|Socket.IO| BE
  BE --> DB[(MongoDB Atlas)]
  BE --> CL[Cloudinary]
  BE --> EM[Brevo Email]
  BE --> RP[Razorpay]
  BE --> WP[Web Push (VAPID)]
  BE --> LLM[Groq Llama (AI Assistant)]
```

### Backend entrypoint

Backend starts from `backend/server.js`:

- Connects to MongoDB
- Starts cron schedulers:
  - `backend/jobs/scheduler.js` (due date reminders)
  - `backend/jobs/escrowScheduler.js` (auto-release + daily escrow attention summary)
- Mounts routers under `/api/*`
- Starts Socket.IO server for real-time

### Frontend entrypoint

Frontend starts from `frontend/src/main.jsx` and `frontend/src/App.jsx`:

- `AuthProvider` handles session/JWT state
- `SocketProvider` maintains Socket.IO connection
- Router controls pages for each role
- Notification service initializes when a token exists

---

## 5) Core data model (MongoDB collections)

Primary collections live in `backend/models/`:

- `User`: role, auth info, profile, ratings, active/deactivated, push subscription & preferences.
- `PendingUser`: email verification pending registrations.
- `Project`: posted by client; budget, skills, status (`open/awarded/completed` etc.).
- `Application`: freelancer proposals for a project; status (`pending/awarded/accepted/...`).
- `Workspace`: created after awarding; links project + client + freelancer + application.
- `Milestone`: created in a workspace; amount, due dates, status, escrow/payment fields.
- `Escrow`: tracks Razorpay order/payment + escrow lifecycle (`pending/active/released/disputed`).
- `Deliverable`: submissions for milestones; review statuses.
- `Chat` / `Message`: project/workspace chat messages.
- `WorkspaceFile`: uploaded files per workspace.
- `Notification`: in-app notification history; unread tracking.
- `TimelineEvent`: event/audit log for workspace timeline.
- `Review`: milestone/project feedback and ratings.
- `Badge`: achievement/badging system.

---

## 6) Core feature flows (end-to-end)

### 6.1 Registration → verification → login

- Register: `POST /api/auth/register`
  - May create a `PendingUser` and send verification email.
- Verify email: `GET/POST /api/auth/verify-email` (implementation in `backend/routes/auth.js`).
- Login: `POST /api/auth/login`
  - Creates session (`express-session`) and issues JWT.
- Frontend stores `token` + `user` in `localStorage` for API auth.

### 6.2 Client posts a project

- Create project: `POST /api/projects`
  - Supports attachments (Cloudinary).
  - Triggers proactive matching notifications (see matching integration inside `backend/routes/project.js`).

Optional AI pricing:
- `POST /api/pricing/recommendation`

### 6.3 Freelancer finds projects and applies

- Browse projects: `GET /api/projects/browse` (freelancer-only)
- Apply: `POST /api/applications`
  - Validations:
    - freelancer profile completeness
    - max ongoing projects
    - proposed rate & timeline constraints
  - Creates a notification for the client.

### 6.4 Client awards application → workspace created

- Client reviews applications: `GET /api/applications/project/:projectId`
- Award / accept flow is handled in `backend/routes/applications.js` (creates chat/workspace on award).

Workspace creation (also exposed explicitly):
- `POST /api/workspaces` (client)

Workspace lookup used by frontend:
- `GET /api/workspaces/project/:projectId`

### 6.5 Workspace collaboration (chat, files, milestones, timeline)

Frontend uses `frontend/src/components/WorkspaceInterfaceFixed.jsx`.

Tabs:
- Chat
- Timeline
- Files
- Milestones
- Deliverables
- Payments

Timeline:
- Stored in `TimelineEvent` and computed from milestones/deliverables/escrows.
- See the deep guide: `TIMELINE_FEATURE.md`.

### 6.6 Milestones

Milestones are a workspace-level contract between client and freelancer.

- List: `GET /api/workspaces/:workspaceId/milestones`
- Create: `POST /api/workspaces/:workspaceId/milestones` (freelancer)
- Update/approve/reject: `PUT /api/workspaces/:workspaceId/milestones/:milestoneId`

Important logic in `backend/routes/milestones.js`:

- Budget cap validation (sum of milestones ≤ project budget)
- Deadline validation (milestones must respect project deadline)
- Service charge calculation (tiered % based on project budget)

### 6.7 Payments & escrow lifecycle (Razorpay)

Payments are implemented as **escrow per milestone**.

Core endpoints (see `backend/routes/payments.js`):

1) Client creates escrow order
- `POST /api/payments/escrow/create`

2) Frontend opens Razorpay checkout
- implemented in `frontend/src/components/PaymentModal.jsx`

3) Client verifies payment → escrow becomes active
- `POST /api/payments/escrow/verify`

4) Freelancer submits deliverable
- `POST /api/payments/escrow/submit-deliverable`

5) Client approves/rejects deliverable
- `POST /api/payments/escrow/approve-deliverable`

6) Funds release
- Admin release: `POST /api/payments/escrow/release`
- Auto-release: background job via `backend/jobs/escrowScheduler.js` + `EscrowService.processAutoReleases()`

Disputes:
- Raise dispute: `POST /api/payments/escrow/raise-dispute`
- Resolve dispute (admin): `POST /api/payments/escrow/resolve-dispute`

Payment history:
- `GET /api/payments/workspace/:workspaceId/history`

### 6.8 Notifications

There are two notification channels:

1) **In-app** notifications (stored in MongoDB)
- List: `GET /api/notifications/list`
- Mark read: `PUT /api/notifications/:id/read`
- Mark all read: `PUT /api/notifications/read-all`

2) **Push** notifications (web-push + service worker)
- VAPID key: `GET /api/notifications/vapid-public-key`
- Subscribe: `POST /api/notifications/subscribe`

Cron-driven reminders:
- Due date reminders run via `backend/jobs/scheduler.js` → `backend/jobs/dueDateNotifications.js`

Deep guide:
- `PUSH_NOTIFICATIONS_GUIDE.md`

---

## 7) AI/ML features

### 7.1 AI matching (projects ↔ freelancers)

- Route group: `backend/routes/matching.js`
- Example: `GET /api/matching/projects/:freelancerId`

Used by freelancer dashboard “AI Matches” tab.

### 7.2 AI pricing assistant

- Route group: `backend/routes/pricing.js`
- Service: `backend/services/pricingAssistant.js`

### 7.3 Workspace AI Assistant (LLM + RAG)

- Route group: `backend/routes/ai.js`
- Service: `backend/services/projectAssistant.js`
- Retrieval: `backend/services/ragRetrieval.js`

Frontend UI:
- `frontend/src/components/AIAssistantChat.jsx`

Endpoints:
- `POST /api/workspace/:workspaceId/ask-ai`
- `POST /api/workspace/:workspaceId/ask-ai/overview`
- `POST /api/workspace/:workspaceId/ask-ai/next-steps`
- `POST /api/workspace/:workspaceId/ask-ai/summarize-milestone/:milestoneId`

---

## 8) Admin features

Admin UI:
- Frontend page: `frontend/src/pages/AdminDashboard.jsx`

Admin API (major):
- `GET /api/admin/dashboard-stats`
- `GET /api/admin/users`
- user delete/restore/deactivate/reactivate endpoints
- escrow management endpoints (see `frontend/src/components/EscrowManagement.jsx` + backend admin routes)

---

## 9) API map (major route groups)

Backend mounts these groups (see `backend/server.js`):

- `/api/auth` → `backend/routes/auth.js`
- `/api/projects` → `backend/routes/project.js`
- `/api/profile` → `backend/routes/profile.js`
- `/api/applications` → `backend/routes/applications.js`
- `/api/freelancers` → `backend/routes/freelancers.js`
- `/api/chats` → `backend/routes/chat.js`
- `/api/workspaces` → `backend/routes/workspace.js`
- `/api/workspaces/:workspaceId/milestones` → `backend/routes/milestones.js`
- `/api/files` → `backend/routes/files.js`
- `/api/payments` → `backend/routes/payments.js`
- `/api/notifications` → `backend/routes/notifications.js`
- `/api/matching` → `backend/routes/matching.js`
- `/api/workspace/:workspaceId/ask-ai` → `backend/routes/ai.js`
- `/api/reviews` → `backend/routes/reviews.js`
- `/api/badges` → `backend/routes/badges.js`
- `/api/pricing` → `backend/routes/pricing.js`

---

## 10) Related docs in this repo

Use these for deeper details on specific features:

- Main overview: `README.md`
- Frontend-only docs: `frontend/README.md`
- New features summary: `NEW_FEATURES_SUMMARY.md`
- Frontend API migration: `FRONTEND_API_MIGRATION.md`
- Push notifications: `PUSH_NOTIFICATIONS_GUIDE.md`
- Timeline feature: `TIMELINE_FEATURE.md`
- Notification redirect fix notes: `NOTIFICATION_FIX_SUMMARY.md`
- Deactivation testing: `DEACTIVATION_TESTING_GUIDE.md`

---

## 11) Practical “where to start reading code”

If you want to understand the full flow quickly:

1) Backend bootstrap + route mounting + Socket.IO: `backend/server.js`
2) Data model: `backend/models/*`
3) Core flows:
   - Projects: `backend/routes/project.js`
   - Applications + award: `backend/routes/applications.js`
   - Workspace: `backend/routes/workspace.js`
   - Milestones: `backend/routes/milestones.js`
   - Escrow: `backend/routes/payments.js` + `backend/services/escrowService.js`
4) Frontend workspace UI: `frontend/src/components/WorkspaceInterfaceFixed.jsx`
5) Notifications: `backend/routes/notifications.js` + `frontend/src/components/NotificationCenter.jsx`
6) AI assistant: `backend/routes/ai.js` + `backend/services/projectAssistant.js`
