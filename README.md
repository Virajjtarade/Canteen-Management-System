# Smart Canteen Management System

Full-stack canteen app: **Flask** (REST + JWT + Socket.IO) and **React + Vite + Tailwind** UI with role-based flows (owner, customer, cook, server), guest QR menu, analytics, CSV export, AI-style demand hints, voice-controlled workflows, and “ordered together” recommendations.

## Recent Feature Additions
- **Conversational Voice Workflows**: Kitchen and Server dashboards support hands-free voice commands via the Web Speech API securely configured with local HTTPS via Vite SSL. The voice transcript interface acts transactionally to acknowledge inputs.
- **Dynamic Quick-Toggle Menu Management**: Cooks can explicitly toggle menu inventory and availability states directly from their dashboard seamlessly without owner-level permissions blocking them.
- **Robust JWT Handling**: Session timeout auto-redirect cleanly handles stale 401 tokens gracefully across the frontend.

## Quick start

### 1. Backend

```bash
cd Canteen_Project
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd backend
python run.py
```

API base: `http://127.0.0.1:5000/api` · SQLite DB: `backend/instance/canteen.db` (created automatically).

Set `DATABASE_URL` for MySQL/Postgres if needed. Set `SECRET_KEY` and `JWT_SECRET_KEY` for production.

### 2. Frontend

```bash
cd Canteen_Project/frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173` — Vite proxies `/api` and `/socket.io` to the Flask server.

### 3. Production (single server)

```bash
cd frontend && npm run build
cd ../backend && python run.py
```

Flask serves the built SPA from `frontend/dist` and handles client-side routes.

## Roles

| Role | How to create | Main UI |
|------|----------------|---------|
| **Owner** | Register as “Canteen owner” | `/owner` — menu, live counter, analytics, forecast, QR |
| **Customer** | Register as “Customer” | `/my-orders`, browse `/menu/:slug` when logged in for linked orders |
| **Cook** | Owner: `POST /api/canteens/<id>/staff` | `/cook` — Voice Command dashboard, Item Availability Menu toggling |
| **Server** | Owner: `POST /api/canteens/<id>/staff` | `/server` — Voice Command dashboard, Hand-off control |

## QR ordering

Owner → **QR code** page copies the guest URL (`/menu/<slug>`). Customers scan (no login) and place orders; token numbers identify pickup.

## API highlights

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/public/canteen/<slug>/menu` — guest menu
- `POST /api/orders/canteen/<id>` — place order (optional JWT for customers)
- `POST /api/orders/counter/<id>` — owner billing counter
- `PATCH /api/orders/<id>/status` — kitchen / server workflow
- `GET /api/analytics/canteen/<id>/summary`, `GET .../export.csv`
- `GET /api/forecast/canteen/<id>`, `GET /api/recommendations/canteen/<id>`

Real-time: Socket.IO room `canteen_<id>`; client emits `join_canteen` with `{ canteen_id, token }`.

## Optional demo seed

After the server has run once (tables exist), you can extend `backend/seed_demo.py` or use the UI to register an owner and add menu items.
