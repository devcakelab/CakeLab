# CakeLab (Flask -> Django + React migration)

This project now includes:
- Login/Register system (hashed passwords)
- Real-time dashboard with statistics
- Complete POS with shopping cart
- Transaction history and receipts
- Product management (CRUD)
- Inventory tracking with low-stock alerts
- Advanced reporting (daily, weekly, monthly)
- User performance metrics
- 5 preloaded dessert products
- New Django REST API backend (`backend/`)
- New React frontend scaffold (`frontend/`)

## Legacy Flask App

The original Flask app still exists and can still run:

1. `pip install -r requirements.txt`
2. `python app.py`
3. Open `http://127.0.0.1:5000`

## Migrated Stack (Django + React)

### Backend (Django API)

1. `pip install -r requirements.txt`
2. `cd backend`
3. `python manage.py migrate`
4. `python manage.py seed_pos`
5. `python manage.py runserver`

Backend API base URL: `http://127.0.0.1:8000/api`

### Frontend (React)

Node.js is required.

1. Install Node.js LTS
2. `cd frontend`
3. `npm install`
4. `npm run dev`

Frontend URL: `http://127.0.0.1:5173`

### One-click startup on Windows

You can also launch using batch files from the project root:

- `start_system.bat` - starts backend and frontend in two new terminals
- `start_backend.bat` - starts only Django backend
- `start_frontend.bat` - starts only React frontend

`start_system.bat` also opens `http://localhost:5173` automatically.

### Auto-load SMTP/signature config

To avoid setting PowerShell env vars every run:

1. Copy `.env.example` to `.env`
2. Fill your real SMTP/signature values in `.env`
3. Start normally (`start_system.bat` or `python manage.py runserver`)

The backend now auto-loads `.env` at startup.

### Phase 2 API coverage

The migrated Django API now includes:
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Sections: `/api/sections`, `/api/sections/<id>`
- Products: `/api/products`, `/api/products/<id>`, `/api/products/low-stock`
- POS/Sales: `/api/checkout`, `/api/sales`, `/api/sales/<id>`, `/api/sales/<id>/receipt.pdf`
- Dashboard/Reports: `/api/dashboard/stats`, `/api/dashboard/insights`, `/api/reports?period=daily|weekly|monthly`
- Performance: `/api/users/performance`

## Default Login

- Default admin username: `admin`
- Default admin password: `admin123`
- For React + Django, login through the React page (calls `/api/auth/login`).

## Notes

- Legacy Flask database file: `pos.db`
- Django database file: `backend/db.sqlite3`
- Sample desserts and default admin are seeded via `python manage.py seed_pos`.
