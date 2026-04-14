# Smart Canteen — Comprehensive Test Plan

## 1. Overview

This test plan covers all features of the Smart Canteen Management System, organized by user role and functional area. Each test case includes a unique ID, preconditions, steps, and expected results.

---

## 2. Test Environment

| Component | Version / Detail |
|-----------|-----------------|
| Backend | Python 3.10+, Flask 3.x, SQLite (dev) |
| Frontend | React 18, Vite 5, Tailwind CSS |
| Browser | Chrome 120+ (HTTPS via `@vitejs/plugin-basic-ssl`) |
| Transport | Socket.IO (WebSocket with fallback) |

---

## 3. Authentication & Authorization

### TC-AUTH-01: Customer Registration
- **Precondition**: No account exists for the email
- **Steps**: POST `/api/auth/register` with `{email, password, name, role: "customer"}`
- **Expected**: 201 response with `access_token` and user object

### TC-AUTH-02: Password Minimum Length
- **Steps**: Register with a 3-character password
- **Expected**: 400 error: "Password must be at least 6 characters"

### TC-AUTH-03: Duplicate Email Registration
- **Steps**: Register twice with the same email
- **Expected**: 409 error: "Email already registered"

### TC-AUTH-04: Owner Registration Creates Canteen
- **Steps**: Register with `role: "owner"` and `canteen_name: "Test Kitchen"`
- **Expected**: Canteen created with slug `test-kitchen`, user's `canteen_id` is set

### TC-AUTH-05: Staff Registration Requires canteen_id
- **Steps**: Register with `role: "cook"` without `canteen_id`
- **Expected**: 400 error: "canteen_id required for staff"

### TC-AUTH-06: Login
- **Steps**: POST `/api/auth/login` with valid credentials
- **Expected**: 200 with `access_token` and user object

### TC-AUTH-07: Invalid Login
- **Steps**: Login with wrong password
- **Expected**: 401 error: "Invalid credentials"

### TC-AUTH-08: JWT /me Endpoint
- **Steps**: GET `/api/auth/me` with valid Bearer token
- **Expected**: 200 with user profile

---

## 4. Canteen Management (Owner)

### TC-CAN-01: List All Canteens (Public)
- **Steps**: GET `/api/canteens`
- **Expected**: 200 with array of canteen objects

### TC-CAN-02: Search Canteens with Wildcards
- **Steps**: GET `/api/canteens?q=test%25kitchen`
- **Expected**: `%` and `_` are escaped — no SQL injection via wildcards

### TC-CAN-03: Create Canteen
- **Precondition**: Logged in as owner
- **Steps**: POST `/api/canteens` with `{name: "New Place"}`
- **Expected**: 201, slug auto-generated, owner_id set

### TC-CAN-04: Update Canteen (PATCH)
- **Steps**: PATCH `/api/canteens/{id}` with new name/upi_id
- **Expected**: 200, fields updated

### TC-CAN-05: Add Staff
- **Steps**: POST `/api/canteens/{id}/staff` with cook details
- **Expected**: 201, new user linked to canteen

### TC-CAN-06: QR Code URL
- **Steps**: GET `/api/canteens/{id}/qr`
- **Expected**: JSON with guest menu URL

---

## 5. Menu Management

### TC-MENU-01: Add Menu Item
- **Steps**: POST `/api/menu/canteen/{id}` with `{name, price}`
- **Expected**: 201, new item with `available: true`

### TC-MENU-02: Toggle Availability (Cook)
- **Precondition**: Logged in as cook
- **Steps**: PATCH `/api/menu/item/{id}` with `{available: false}`
- **Expected**: Item marked unavailable, reflected in guest menu

### TC-MENU-03: Delete Menu Item
- **Steps**: DELETE `/api/menu/item/{id}`
- **Expected**: 200, item removed

---

## 6. Order Flow

### TC-ORD-01: Place Order (Logged-in Customer)
- **Steps**: POST `/api/orders/canteen/{id}` with items and payment_mode
- **Expected**: 201, token_number assigned, status `pending_payment`

### TC-ORD-02: Place Guest Order (No Auth)
- **Steps**: POST `/api/orders/canteen/{id}` with `guest_label`
- **Expected**: 201, guest order created

### TC-ORD-03: Token Number Uniqueness (Race Condition)
- **Steps**: Send 10 concurrent POST requests to same canteen
- **Expected**: All token numbers are unique (row-level lock prevents duplicates)

### TC-ORD-04: Status Transitions
- **Steps**: PATCH status through `accepted → preparing → ready → served`
- **Expected**: Each transition succeeds

### TC-ORD-05: Track by Token
- **Steps**: GET `/api/public/track?canteen_id=X&token=Y`
- **Expected**: 200 with order status

### TC-ORD-06: My Orders (Customer)
- **Steps**: GET `/api/orders/mine` with Bearer token
- **Expected**: Array of user's orders

---

## 7. Real-Time (Socket.IO)

### TC-SOCK-01: Authenticated Room Join
- **Steps**: Emit `join_canteen` with valid JWT
- **Expected**: Joined room, receives `order_new`/`order_update` events

### TC-SOCK-02: Reject Invalid Token
- **Steps**: Emit `join_canteen` with expired/invalid JWT
- **Expected**: Disconnected

### TC-SOCK-03: Reject Missing Room
- **Steps**: Emit `join_canteen` without `canteen_id`
- **Expected**: Disconnected

### TC-SOCK-04: Live Order Updates
- **Steps**: Cook changes order status while customer is subscribed
- **Expected**: Customer receives `order_update` event, UI updates

---

## 8. Kitchen Dashboard (Cook Role)

### TC-COOK-01: View Active Orders
- **Steps**: Login as cook, open Kitchen Dashboard
- **Expected**: 3-column layout: New Orders / Preparing / Ready

### TC-COOK-02: Voice Command — Start Cooking
- **Steps**: Enable voice, say "prepare 5"
- **Expected**: Order #5 moves from Accepted to Preparing

### TC-COOK-03: Voice Command — Mark Ready
- **Steps**: Say "ready 5"
- **Expected**: Order #5 moves from Preparing to Ready

### TC-COOK-04: Manage Menu Availability
- **Steps**: Click "Manage Menu", toggle item availability
- **Expected**: Item status changes, reflected in guest menu

### TC-COOK-05: Tab Visibility — Background Pauses
- **Steps**: Switch to another tab
- **Expected**: Socket disconnects, mic stops, no polling

### TC-COOK-06: Tab Visibility — Foreground Resumes
- **Steps**: Switch back to Kitchen tab
- **Expected**: Socket reconnects, data refreshes, mic resumes

---

## 9. Server Dashboard (Server Role)

### TC-SRV-01: View Ready Orders
- **Steps**: Login as server, open Server Dashboard
- **Expected**: Ready and Served tabs shown

### TC-SRV-02: Mark Served
- **Steps**: Click "Mark served" on a ready order
- **Expected**: Order moves to Served tab

### TC-SRV-03: Voice Command — Served
- **Steps**: Enable voice, say "served 3"
- **Expected**: Order #3 marked as served

---

## 10. Guest Menu

### TC-GUEST-01: View Menu Without Login
- **Steps**: Navigate to `/menu/{slug}`
- **Expected**: Menu loads, items displayed with price

### TC-GUEST-02: Place Guest Order
- **Steps**: Add items to cart, fill optional name, place order
- **Expected**: Token number shown, status updates in real-time

### TC-GUEST-03: Live Status Updates
- **Steps**: Order is updated by cook
- **Expected**: Guest sees status change on page + browser notification

---

## 11. Customer Dashboard

### TC-CUST-01: Search Canteens
- **Steps**: Type in search box
- **Expected**: Results update after 300ms debounce (no per-keystroke fire)

### TC-CUST-02: Navigate to Menu
- **Steps**: Click "Order now" on a canteen card
- **Expected**: Redirected to `/menu/{slug}`

---

## 12. Forecast & Recommendations (Owner)

### TC-FORE-01: Demand Forecast
- **Steps**: GET `/api/forecast/canteen/{id}?date=2026-04-14`
- **Expected**: Suggestions filtered by matching weekday, averaged per week

### TC-FORE-02: No History for Weekday
- **Expected**: Response with empty suggestions and "Not enough history for this day of week"

### TC-REC-01: Item Recommendations
- **Steps**: GET `/api/recommendations/canteen/{id}`
- **Expected**: Popular pairs from last 90 days, max 500 orders scanned

### TC-REC-02: Seed-Based Recommendations
- **Steps**: GET `/api/recommendations/canteen/{id}?menu_item_id=3`
- **Expected**: "Also ordered" items for item 3

---

## 13. Security

### TC-SEC-01: Secret Key Warnings
- **Steps**: Start backend without `SECRET_KEY`/`JWT_SECRET_KEY` env vars
- **Expected**: Warning printed, random dev key used

### TC-SEC-02: CORS Configuration
- **Steps**: Set `CORS_ORIGINS=https://myapp.com`
- **Expected**: Only that origin is allowed for API/socket requests

### TC-SEC-03: SQL Wildcard Injection
- **Steps**: Search with `q=test%25` or `q=test_`
- **Expected**: Wildcards are escaped, literal match only

---

## 14. Housekeeping Verification

### TC-HOUSE-01: No Root package.json
- **Steps**: Check project root
- **Expected**: No `package.json` or `node_modules/` at root

### TC-HOUSE-02: .env.example Exists
- **Expected**: File documents all env vars

### TC-HOUSE-03: .gitignore Coverage
- **Expected**: `__pycache__/`, `*.pyc`, `.env`, root `node_modules/` are all listed

### TC-HOUSE-04: Shared Slugify
- **Expected**: `auth.py` and `canteens.py` import from `app/utils.py`

### TC-HOUSE-05: Flask-Migrate Available
- **Steps**: `flask db --help` in backend directory
- **Expected**: Migration commands listed

---

## 15. Build Verification

### TC-BUILD-01: Frontend Build
- **Steps**: `npm run build` in frontend
- **Expected**: Zero errors, dist/ generated

### TC-BUILD-02: Backend Startup
- **Steps**: `python -c "from app import create_app; create_app()"`
- **Expected**: No import errors
