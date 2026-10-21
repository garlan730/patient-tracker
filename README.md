# Baruga Medical Center — Patient Tracker (React)

React rewrite of `../index.html`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Demo accounts

Seeded on first run (see `SEED_USERS` in `src/lib/constants.js`):

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | Admin |
| staff    | staff123  | Staff |

Change these passwords from the **Users** page after first sign-in.

## Features

- **Sign in** with roles — Admin (doctors, users, delete patients) and Staff (track progress, add/edit/archive patients, notes)
- **Dashboard** — KPIs, patients by next step, steps per month, status breakdown, caseload per doctor, recent activity (charts link into filtered tracker views)
- **Two patient groups** — *Tanam's Patients* (Consultation → Crown Placement, 11 steps) and *Internal Patients*
  (Anatomic Impression, Vertical Dim., Sent to Lab, Arrived at Clinic, Placement), each with its own tab in the tracker and on the dashboard.
  Step lists live in `src/lib/constants.js` (`TREATMENT_STEPS`, `INTERNAL_STEPS`).
- **Tracker** — real dates via date picker (shown as `12 Oct 2026`), per-step notes, out-of-order date warning, next-step highlight
- **Patient panel** — timeline + timestamped note log with author
- **Filters** — search, doctor, status, next step, date range on any step or last activity, archived; sort; filters live in the URL so views can be bookmarked
- **Edit / archive / delete** patients
- **Export CSV** (opens in Excel) of the current filtered view

## Data & security

This is a **local demo**: users, patients and notes are stored in the browser's `localStorage`,
so data is per-browser and not shared between computers. Passwords are salted + SHA-256 hashed,
but anyone with access to the browser can read the data. Before using real patient data,
replace `src/lib/auth.jsx` and `src/lib/data.jsx` with a real backend (e.g. Supabase/Firebase/your API) —
the rest of the app only talks to `useAuth()` / `useData()`.
