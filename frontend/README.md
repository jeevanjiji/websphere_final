# WebSphere Frontend (React + Vite)

This folder contains the **WebSphere** UI for a freelancer marketplace platform.

## Quick start (dev)

### Option A: Start full stack from repo root (Windows)

From the repo root, run the provided scripts:

```bash
start-dev.bat
```

### Option B: Run only the frontend

```bash
cd frontend
npm install
npm run dev
```

Default dev URL: http://localhost:5173

## Environment variables

Frontend reads env vars from `frontend/.env` (dev) or `frontend/.env.production` (production).

Common variables:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=...
VITE_VAPID_PUBLIC_KEY=...          # push notifications (public key)
VITE_RAZORPAY_KEY_ID=rzp_test_...  # Razorpay checkout key
```

Notes:
- Most API calls use `src/config/api.js` (`API_BASE_URL` + `API_ENDPOINTS`).
- Vite also proxies `/api` to `VITE_API_BASE_URL` (see `vite.config.js`), so components can call `/api/...` without hardcoding the backend host.

## App entry points

- `src/main.jsx` mounts the app.
- `src/App.jsx` wires together providers and routing:
	- `AuthProvider` (session/JWT state)
	- `SocketProvider` (Socket.IO real-time)
	- `GoogleOAuthProvider` (Google sign-in)
	- React Router routes
	- `react-hot-toast` Toaster

## Routing map (high level)

Defined in `src/App.jsx`:

- `/` → Landing page
- `/login`, `/register` → Auth UI
- `/freelancer-registration` (+ simple variant) → Freelancer onboarding
- `/freelancer-profile-setup` → Freelancer profile completion
- `/client` → Client dashboard (protected)
- `/freelancer` → Freelancer dashboard (protected)
- `/admin-dashboard` → Admin dashboard (protected)
- Email/password flows:
	- `/verify-email-notice`, `/verify-email`
	- `/forgot-password`, `/reset-password`

## Authentication & session flow

Auth state is managed by `src/contexts/AuthContext.jsx`.

On startup:
1. Calls `GET /api/auth/session` (cookie-based session)
2. If not authenticated, falls back to `localStorage` JWT (`token`) + cached `user` for backward compatibility

On login:
- `AuthContext.login()` stores `user` and `token` in `localStorage`.
- The UI then redirects by role:
	- client → `/client`
	- freelancer → `/freelancer` (or `/freelancer-profile-setup` if required)
	- admin → `/admin-dashboard`

## Real-time (Socket.IO)

`src/contexts/SocketContext.jsx` opens a Socket.IO connection to `API_BASE_URL` after auth.

It provides:
- online users tracking (`user-online`, `online-users`, `user-status-change`)
- typing indicators for chat
- toast notifications for server events
- video call signaling events (incoming call, WebRTC offer/answer/ICE, call ended)

## Main UI flows

### Client flow

Route `/client` renders `src/pages/ClientLandingPage.jsx`, which wraps `src/components/ClientDashboard.jsx`.

Client dashboard tabs:
- My Projects
- Applications
- Messages

From projects/applications you can open:
- Chat modal (`ChatInterface`)
- Workspace modal (`WorkspaceInterfaceFixed`)

### Freelancer flow

Route `/freelancer` renders `src/pages/FreelancerLandingPage.jsx`, which wraps `src/components/FreelancerDashboard.jsx`.

Freelancer dashboard includes:
- AI matches (project recommendations)
- Browse projects + apply
- Proposals
- Messages
- Active/Completed projects
- Earnings

### Workspace flow (core collaboration)

Workspaces are opened inside a modal using `src/components/WorkspaceInterfaceFixed.jsx`.

Workspace tabs:
- Chat
- Timeline
- Files
- Milestones
- Deliverables
- Payments / Payment History

Key integrations:
- Timeline UI: `src/components/ProjectTimeline.jsx`
- In-workspace AI assistant: `src/components/AIAssistantChat.jsx` (calls `POST /api/workspace/:workspaceId/ask-ai`)
- Payments: `src/components/PaymentModal.jsx` (Razorpay checkout) + workspace payment history tab

## Notifications & push notifications

In-app notifications:
- `src/components/NotificationCenter.jsx` fetches from `/api/notifications/list` and can deep-link users into a workspace.

Push notifications (browser):
- Service worker: `public/sw.js`
- Services:
	- `src/services/notificationService.js` (initial permission + SW registration)
	- `src/services/pushNotificationService.js` (subscription + preference updates)

## API configuration

Centralized API config lives in `src/config/api.js`:
- `API_BASE_URL`, `WS_BASE_URL`
- `API_ENDPOINTS` (grouped endpoint constants)
- helpers: `buildApiUrl()`, `getAuthHeaders()`

If you see any remaining hardcoded `http://localhost:5000` URLs in components, they should be migrated to this config (see repo root doc `FRONTEND_API_MIGRATION.md`).

## Scripts

From `frontend/`:

```bash
npm run dev       # Vite dev server
npm run build     # production build to dist/
npm run preview   # preview the production build
npm run lint      # ESLint
```

## Where to look in the code

- `src/pages/` — route-level pages (e.g., landing pages, auth pages)
- `src/components/` — reusable UI + feature modules (dashboards, workspace, modals)
- `src/contexts/` — global providers (`AuthContext`, `SocketContext`)
- `src/config/api.js` — API base URL + endpoint registry
- `src/services/` — notification/push subscription helpers
- `public/sw.js` — service worker for push notifications
