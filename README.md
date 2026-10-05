# Spice Route Kitchen — Admin & Kitchen Operations Panel

Operational management web application for restaurant administrators and kitchen staff. Supports full menu catalog management, user and role governance, real-time live kitchen dispatch queue, order status transitions, and administrative access control.

## Related Repositories

- **Backend API**: [food_delivery_backend](https://github.com/amitava121/food_delivery_backend) (Port 8000)
- **Customer Website**: [food_delivery_website](https://github.com/amitava121/food_delivery_website) (Port 3000)

---

## Technology Stack

- **Core**: Vanilla HTML5, Semantic CSS3, Modular JavaScript (ES6+)
- **Styling**: Comprehensive Admin UI design system (`styles.css` + `admin.css`) with responsive mobile drawers, dark mode accents, and status badges
- **Real-Time**: WebSockets (`/ws/orders?token=...` with automatic reconnection and live audio/visual toast alerts)
- **Security**: Strict client-side and server-side RBAC; automatic route gating and navigation visibility per role

---

## Screens & Capabilities

| Page | Accessible By | Purpose |
| :--- | :--- | :--- |
| **`index.html`** | Super Admin, Admin | Executive store dashboard, real-time metrics, quick dish & category stats |
| **`orders.html`** | Super Admin, Admin | Full operational order grid, status filters, order detail breakdown, and state transition actions |
| **`kitchen.html`** | Chef, Admin, Super Admin | Live Chef kitchen queue, prep time tracking, order fulfillment indicators, `🍳 Confirm & Prepare` and `🔔 Mark Ready` actions |
| **`menu.html`** | Super Admin, Admin | Dish catalog CRUD, price, image upload, dietary tags, description, and live stock adjustments |
| **`categories.html`** | Super Admin, Admin | Category CRUD and ordering hierarchy |
| **`banners.html`** | Super Admin, Admin | Promotional marketing banners and offer sliders |
| **`users.html`** | Super Admin, Admin | Customer and Chef user governance, account block/unblock, and profile edits |
| **`admins.html`** | **Super Admin ONLY** | Administrator account management; strictly blocked for normal Admins and other roles |

---

## Roles & Demo Accounts

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `owner@demo.com` | `demo123` | Unrestricted access across all pages, including `admins.html` |
| **Admin** | `admin@demo.com` | `demo123` | Dashboard, Orders, Kitchen, Menu, Categories, Banners, Users |
| **Kitchen / Chef** | `chef@demo.com` | `demo123` | Auto-redirects to `kitchen.html`; operational preparation queue |

---

## Quick Start

### 1. Configuration
Open `api.js` and verify the `BASE` and `WS_BASE` endpoints point to your backend:
```javascript
const BASE = "http://127.0.0.1:8000";
const WS_BASE = "ws://127.0.0.1:8000";
```

### 2. Run the Static Server
Serve this directory on port `3001`:
```powershell
python -m http.server 3001
```

### 3. Open in Browser
Visit: http://127.0.0.1:3001
