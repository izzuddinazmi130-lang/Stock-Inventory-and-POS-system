# HQ Inventory — Stock Inventory & POS System

A central stock inventory and point-of-sale system for **Kaftanasia** and **AS Tech**. It keeps stock for several businesses, their branches and pop-up stores in one place: products, QR labels, sales with receipts, low-stock alerts, damage reports, reports and a full audit trail.

Built with **React + Vite + Tailwind CSS** on the frontend and **Node.js + Express + MySQL/MariaDB** on the backend, with live updates over **Socket.IO**.

---

## Features

**Businesses, branches and stores**
- Several businesses, each with its own branches. Each branch has a short code (e.g. `KA`, `KA-KB`) used in SKUs and receipt numbers.
- Pop-up stores (bazaars, booths, events) under a branch, with start/end dates. Their status switches automatically between upcoming, active and ended.

**Roles**
- **Super Admin:** sees and manages everything across all businesses and branches.
- **Branch Admin:** works only inside their own branch.

**Products**
- One product per size, each with its own SKU, stock and prices.
- Four prices per product: customer, dealer, staff and cost.
- Per-business product form: choose the categories and extra fields (e.g. Colour, Collection, Model) staff fill in. Fields can be added, edited, reordered and removed.
- Low-stock alert level per product and an optional "New" badge.
- Add existing products to other branches, or remove a product from one branch without deleting it everywhere.

**Stock**
- Stock is tracked per branch, with stock in, stock out and adjustments.
- Every change is logged in the stock movement history (quantity before → after, who, when).
- Low-stock list and notification bell, updated live across open screens.

**Point of sale**
- Scan QR codes or barcodes with the device camera or a USB scanner, or search by name or SKU.
- Customer, dealer and staff price lists.
- Payment by cash, QR / e-wallet or online banking, with cash received and change due.
- Receipt numbers per branch per day (e.g. `KA-261001-0001`), sales history and receipt reprint.
- Stock-in mode for receiving deliveries.

**QR labels**
- Print labels (70 × 36 mm) with QR code, name, size/colour, SKU and price.
- Download as **PNG**, **JPG** or an A4 **PDF** sheet with any number of copies.

**Damage reports**
- Record damaged items with a reason, the value lost and photo evidence. Stock is deducted automatically.

**Reports and dashboard**
- Dashboard with key figures, recent stock movements and low stock.
- Reports on stock movements, sales and write-offs, filtered by business, branch, store and date.

**Users and security**
- Staff can request an account; a Super Admin approves or declines it.
- Accounts can be suspended and reactivated.
- Super Admins can reset a password to a temporary one. The user must choose a new password at their next sign-in.
- Everyone can change their own password.
- Passwords are hashed with bcrypt. Sessions use JWT in an httpOnly cookie.
- Audit log of sign-ins, product, stock, user and settings changes, with old and new values, IP address and device.

**Interface**
- Responsive design that works on desktop, tablet and phone. Tables turn into cards on small screens.
- Collapsible sidebar that opens on hover.
- Shared design system and UI kit (see [`frontend/DESIGN.md`](frontend/DESIGN.md)).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios, lucide-react, html5-qrcode, Socket.IO client |
| Backend | Node.js, Express 4, mysql2, JSON Web Tokens, bcryptjs, multer (photo uploads), qrcode, Socket.IO |
| Database | MySQL 8 or MariaDB 10.4+ (e.g. via XAMPP) |

---

## Project structure

```
Stock-Inventory-and-POS-system/
├── backend/
│   ├── src/
│   │   ├── config/         # Database connection
│   │   ├── middleware/     # Authentication, roles, branch/business scoping
│   │   ├── routes/         # REST API: auth, users, businesses, branches, stores,
│   │   │                   #   products, qr (POS), sales, damage, reports, audit
│   │   ├── utils/          # Receipt numbers, sales reports, validation, real-time events
│   │   ├── scripts/        # Maintenance scripts (e.g. password reset)
│   │   └── server.js       # Express + Socket.IO entry point
│   ├── uploads/            # Damage report photos (not committed)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/     # App shell, sidebar, header, shared UI kit (components/ui)
│   │   ├── pages/          # Dashboard, products, POS & QR labels, sales, stores,
│   │   │                   #   damage, reports, users, businesses, audit, sign-in
│   │   ├── context/        # Auth and socket providers
│   │   └── services/       # API client
│   └── DESIGN.md           # Design system: colours, components, layout rules
└── database/
    └── hq_inventory_system.sql   # The whole database structure in one file
```

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or newer
- MySQL 8 or MariaDB 10.4+ (the easiest way on Windows is [XAMPP](https://www.apachefriends.org/))

### 1. Clone the repository
```bash
git clone https://github.com/nurathirah07/Stock-Inventory-and-POS-system.git
cd Stock-Inventory-and-POS-system
```

### 2. Create the database
1. Start **MySQL** (e.g. from the XAMPP Control Panel).
2. Open phpMyAdmin (http://localhost/phpmyadmin) and create a database called `hq_inventory_system` (collation `utf8mb4_general_ci`).
3. Select it, go to **Import**, choose `database/hq_inventory_system.sql` and click **Go**.

### 3. Configure and start the backend
```bash
cd backend
npm install
cp .env.example .env      # on Windows: copy .env.example .env
```
Open `backend/.env` and fill in your values (see [Environment variables](#environment-variables)). Generate a secret for `JWT_SECRET` with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Then start the API:
```bash
npm run dev
```
The API runs at **http://localhost:5000**.

### 4. Start the frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**.

### 5. Create the first Super Admin
1. In phpMyAdmin, run this SQL (use your own email and name):
   ```sql
   INSERT INTO users (email, password_hash, full_name, role, status, is_active)
   VALUES ('admin@example.com', '-', 'Super Administrator', 'super_admin', 'active', 1);
   ```
2. Set a temporary password with the reset script:
   ```bash
   cd backend
   node src/scripts/reset-password.js admin@example.com
   ```
3. Sign in with the temporary password it prints. You'll be asked to choose your own password.
4. From there, create businesses, branches and user accounts inside the app.

---

## Environment variables

`backend/.env`:

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | Database host | `127.0.0.1` |
| `DB_PORT` | Database port | `3306` |
| `DB_USER` | Database user | `root` |
| `DB_PASS` | Database password | |
| `DB_NAME` | Database name | `hq_inventory_system` |
| `JWT_SECRET` | Long random secret used to sign sessions | *(generate one)* |
| `PORT` | API port | `5000` |
| `CLIENT_URL` | Frontend address allowed to call the API | `http://localhost:5173` |

> Never commit `backend/.env`. It contains your database password and session secret.

---

## Scripts

| Where | Command | What it does |
|---|---|---|
| `backend/` | `npm run dev` | Start the API and restart it automatically when code changes |
| `backend/` | `npm start` | Start the API (production) |
| `backend/` | `node src/scripts/reset-password.js <email>` | Emergency password reset: prints a temporary password; the user must change it at the next sign-in |
| `frontend/` | `npm run dev` | Start the development server (http://localhost:5173) |
| `frontend/` | `npm run dev:phone` | Start the https server for phones and tablets (needed for camera scanning) |
| `frontend/` | `npm run build` | Build the production files into `frontend/dist` |
| `frontend/` | `npm run lint` | Check the code with ESLint |

---

## Languages (English and Bahasa Malaysia)

Every user can choose **EN** or **BM** with the switch in the top bar (or on the sign-in page). The choice is remembered on that device.

For developers:
- Wrap on-screen text in `t()` from `src/i18n`, written in English: `t('Save')`, `t('Only {stock} in stock.', { stock })`. For plurals, use `{n|item|items}`.
- Add the Malay version to `src/i18n/ms.js` (the English sentence is the key). Anything missing simply shows in English.
- Messages from the server are written in English and translated on arrival; ones that contain names or numbers are matched by the patterns at the end of `ms.js`.

## Database file

`database/hq_inventory_system.sql` holds the complete database structure (tables only, no data) in one file, including every past upgrade. Import it into an empty database for a fresh install. An existing database that is already running this version needs nothing.

To back up your data, use phpMyAdmin → **Export**.

---

## Using the app on a phone or tablet

The interface is fully responsive. Phones only allow the camera (POS QR scanning) on a secure `https://` address, so use the phone server:
```bash
cd frontend
npm run dev:phone
```
1. On the phone (same Wi-Fi as the PC), open the **Network** address it prints, e.g. `https://192.168.1.20:5174`.
2. The first time, the phone warns that the connection is not private (the certificate is made by your own PC). On iPhone tap **Show Details → visit this website**; on Android tap **Advanced → Proceed**.
3. Sign in, open **Point of sale**, tap the camera button and allow the camera.

If the page does not load, allow Node.js through Windows Firewall on private networks. A USB or Bluetooth barcode scanner works on any address.

---

## Notes
- Damage report photos are stored in `backend/uploads/` and are not committed.
- Point-of-sale receipt numbers restart at `0001` each day for each branch.

---

## Authors
Built for **Kaftanasia** and **AS Tech**.
