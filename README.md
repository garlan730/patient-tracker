# Klinik Utama Baruga Medical Center — Patient Tracker (React)

React rewrite of the original single-file patient tracker.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Deploy (GitHub Pages)

Pushing to `main` builds and publishes the site with `.github/workflows/deploy.yml`.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
Live at https://garlan730.github.io/patient-tracker/ (the path is set by `base` in `vite.config.js`;
change it if you rename the repo).

## Firebase backend

Sign-in uses **Firebase Authentication** (email + password) and data lives in **Cloud Firestore**
(`asia-southeast2`, Jakarta) in project `patient-tracker-8a04c` — config in `src/lib/firebase.js`.

- **Who can sign in:** a Firebase Auth account *and* an active `users/{uid}` document
  (`name`, `email`, `role: admin|staff`, `active: true`). Admins add staff from the **Users** page.
- **Security rules:** `firestore.rules`. After changing it, paste it into
  Firebase console → Firestore Database → **Rules** → **Publish**.
- **Removing someone:** deactivate them on the Users page (blocks access immediately). Deleting the login
  itself is done in Firebase console → Authentication → Users.
- **Backups:** the free Spark plan has no automatic backups. Admins should use **Users → Download backup**
  regularly and store the file securely — it contains patient data.

## Features

- **Sign in** (Firebase Auth) with roles — Admin (doctors, users, delete patients) and Staff (track progress, add/edit/archive patients, notes)
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

Patient data is shared between all signed-in staff through Firestore. Every read and write is checked by
`firestore.rules`: only active users can see patients, only admins manage doctors/users and delete patients,
and notes can only be deleted by their author or an admin. Firebase keeps people signed in on that browser
until they click **Sign out**, so sign out on shared computers.
