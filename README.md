# CakeLab (Django + React)

The app includes:
- Login/Register system (hashed passwords)
- Real-time dashboard with statistics
- Complete POS with shopping cart
- Transaction history and receipts
- Product management (CRUD)
- Inventory tracking with low-stock alerts
- Advanced reporting (daily, weekly, monthly)
- User performance metrics
- 5 preloaded dessert products
- Django REST API backend (`backend/`)
- React frontend (`frontend/`)

## Backend (Django API)

1. `pip install -r requirements.txt`
2. `cd backend`
3. `python manage.py migrate`
4. `python manage.py seed_pos`
5. `python manage.py runserver`

Backend API base URL: `http://127.0.0.1:8000/api`

## Frontend (React)

Node.js is required.

1. Install Node.js LTS
2. `cd frontend`
3. `npm install`
4. `npm run dev`

Frontend URL: `http://127.0.0.1:5173`

## One-click startup on Windows

From the project root:

- `start_system.bat` — backend and frontend in two terminals, then opens `http://localhost:5173`
- `start_backend.bat` — Django only
- `start_frontend.bat` — Vite only

## Auto-load SMTP/signature config

To avoid setting PowerShell env vars every run, put values in a `.env` or `Gmail.env` file at the project root or under `backend/` (see `backend/core/views.py` for parsed keys). Start with `start_system.bat` or `python manage.py runserver` as usual. `Gmail.env` is listed in `.gitignore` so SMTP credentials stay on your machine only.

## API overview

The Django API exposes:
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

- Django database file: `backend/db.sqlite3`
- Sample desserts and default admin are seeded via `python manage.py seed_pos`.
- Login branding assets live in `frontend/public/` (`clfav.png`, `clheader.png`).
