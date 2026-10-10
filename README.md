# Maak · معك

A responsive **React + Flask** website for health-related support and shelter coordination during displacement in Lebanon. Maak means “with you.” This is a working **synthetic-data hackathon prototype**, based on the team's feature document and cedar/heart/hands identity.

The core journey is implemented with persisted API state:

**Resident request → coordinator review → de-identified donation opportunity → physical supply pledge → volunteer delivery → shelter receipt → distribution to resident → resident confirmation.**

Shelter receipt and resident fulfillment are separate. Incoming promises are not inventory. Partial receipts leave the remaining need open. Oversight excludes resident names, private notes, and patient records.

## The 18-hour team schedule

| Phase | Budget | Implementation delivered |
|---|---:|---|
| 1. Foundation | 3 hours | React/Vite, Flask, SQLite/SQLAlchemy, authenticated sessions, CSRF, scoped roles |
| 2. Need intake and review | 4 hours | Essential supplies, reported oxygen/power needs, coordinator review, private timeline |
| 3. Fulfillment | 4 hours | Donor pledge, atomic task acceptance, pickup/delivery, partial receipt, issue and resident confirmation |
| 4. Oversight and usability | 3 hours | Aggregate Ministry view, shelter reporting, English/Arabic, RTL, phone layouts |
| 5. Verification and demo | 3 hours | Backend tests, real browser journey, reproducible startup, demo instructions |
| Buffer | 1 hour | Team integration, rehearsal and unexpected issues |

These are planning budgets for the team's sprint, not measured implementation durations. See [docs/PHASES.md](docs/PHASES.md) for gates and later work.

## Start the website

Requirements: Python 3.12+ and Node 20.19+ or 22.12+ (validated here with Python 3.12.14 and Node 24.19.0). Run from the repository root:

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
npm --prefix frontend ci
npm --prefix frontend run build
cd backend
../.venv/bin/gunicorn 'app:create_app()' --bind 0.0.0.0:5000 --workers 1 --threads 4
```

Flask serves the built React app and API from the same origin on port **5000**. This is the validated serving mode. There is no separate frontend service to start after the build. The database and local session signing key are retained in ignored `backend/instance/`; processes need restarting in a new workspace session.

For development, run two terminals:

```bash
# Terminal 1, repository root:
cd backend
../.venv/bin/flask --app app run --host 0.0.0.0 --port 5000
```

```bash
# Terminal 2, repository root:
npm --prefix frontend run dev
```

Vite uses port **5173** and proxies `/api` to Flask on port 5000. Use Gunicorn with the built frontend for a hosted demo, rather than exposing development debug mode.

## Try each role

On the sign-in page, select a demo workspace, then choose **Sign in**. Demo accounts all use the public password **`MaakDemo!2026`**:

| Role | Email | Access |
|---|---|---|
| Resident | `resident@maak.demo` | Own requests; reported support needs; confirm own receipt |
| Coordinator | `coordinator@maak.demo` | Assigned shelter needs, pledges, receipts, stock and reports |
| Donor | `donor@maak.demo` | Approved opportunities and own pledges, without private resident data |
| Volunteer | `volunteer@maak.demo` | Available eligible tasks and own assigned deliveries |
| Ministry demo | `ministry@maak.demo` | Participating-shelter aggregates and distribution balances |

Use separate browser profiles/incognito windows to keep multiple roles signed in. New users can register as residents, donors, or volunteers. Coordinator/Ministry self-registration is denied. Newly registered volunteers remain ineligible to accept deliveries until a future approval workflow is implemented; the seeded volunteer is approved for synthetic tasks.

The initial database includes two demo shelters and one resident request for ten hygiene kits. It seeds once and preserves subsequent changes. To reset a **disposable synthetic demo** deliberately:

```bash
cd backend
../.venv/bin/flask --app app reset-demo --yes
```

This deletes the current database contents. Do not use it for data you want to retain.

## Four-minute demo

1. Resident: submit an essential-supply request; view saved reference and next action.
2. Coordinator: open that request, review it, then publish a safe supply description with no identifying information.
3. Donor: pledge a compatible quantity from Opportunities.
4. Coordinator: open Deliveries and create a private pickup/delivery task.
5. Volunteer: accept the task, confirm pickup, then report delivery.
6. Coordinator: confirm accepted quantity at the shelter. This does **not** mark the resident fulfilled. Open the request and record supplies issued to the resident.
7. Resident: confirm the quantity personally received. Full fulfillment now shows Confirmed complete.
8. Ministry demo: show grouped needs, pledges, receipts, issues and confirmations; demonstrate that individual request access is denied for that role.

Use **Refresh** for immediate updates between roles. Workspaces also refresh every 20 seconds. For a partial-delivery story, accept six out of ten and provide a discrepancy reason; four remain unreceived. No quantities from different supply units are added into one misleading total.

## Checks

```bash
# Repository root:
PYTHONPATH=backend .venv/bin/pytest -q backend/tests
npm --prefix frontend run build
```

The backend suite tests full/partial fulfillment, scopes, private projections, CSRF, privileged registration denial, replay protection, competing volunteers, invalid quantities, premature receipts, and truthful overcapacity.

Optional browser smoke test, against a running **synthetic** demo:

```bash
.venv/bin/pip install playwright
.venv/bin/python -m playwright install chromium
.venv/bin/python scripts/browser_smoke.py
```

If Chromium is already installed, use `MAAK_BROWSER=/path/to/chromium`. The test creates a new synthetic request and exercises five real browser roles. It checks aggregate privacy, phone viewport fit, RTL, and preservation of unsent form data during language switching. Screenshots go to ignored `test-results/`. It does not reset existing data. Browser automation was run here with the environment's installed Playwright and Chromium.

## Code map

- `backend/app.py`: API, validation, authorization, transitions, demo seed and frontend serving.
- `backend/models.py`: schema, constraints, events and idempotency records.
- `backend/tests/`: meaningful API/workflow tests using isolated temporary databases.
- `frontend/src/App.jsx`: authenticated workspace, routing, data refresh and actions.
- `frontend/src/NeedViews.jsx`: resident/coordinator needs, forms and timeline.
- `frontend/src/Operations.jsx`: donor, volunteer, shelter and aggregate oversight views.
- `frontend/src/i18n.jsx`: English/Arabic text, RTL preference and Beirut-time formatting.
- `frontend/src/styles.css`: cedar-green theme, focus states and responsive layouts.
- `frontend/public/`: generated bilingual logo and self-hosted Noto Arabic fonts with license.

The frontend stores only language preference in localStorage. Health requests are fetched from the server and are not cached for offline access. Authentication uses an HttpOnly session cookie; mutations require a CSRF token. Privileges are backend-owned. Public/donor/task payloads are purpose-built projections.

## Runtime settings

`backend/.env.example` documents supported settings. Flask does not automatically load that file in the Gunicorn command; supply settings through your hosting environment or shell. Keep secret values out of Git.

- `MAAK_SECRET_KEY`: optional signing key supplied securely; otherwise a persistent local key is created with restrictive file permissions.
- `MAAK_DATABASE_URL`: defaults to `sqlite:///maak.db` in Flask's instance directory. This prototype's receipt upsert is SQLite-specific; PostgreSQL is a later migration, not a validated alternative yet.
- `MAAK_COOKIE_SECURE=1`: set when the demo is served over HTTPS. Leave unset for local HTTP development.

## Current scope and next steps

This prototype implements the coordination slice, not all 57 roadmap features. It does not provide medical diagnosis, emergency dispatch, full health passports, family authorization, payments, hospital/DICOM integration, offline clinical storage, appointment booking, outbreaks, forecasts, mental health referrals, complaints, or institution verification. Planned care categories are visibly labeled Later phase.

No real notifications are sent: dashboards are the work source. There is no account recovery, volunteer approval console, grant/credential workflow, cancellation/reassignment workflow, complete reporting history, rate-limit service, or production audit review. A single-instance SQLite setup is used; schema migration and production operations are later work.

Before any real-health-data pilot: agree ownership, clinical and safeguarding routes, staffing, approved contacts, access rules, consent, hosting and retention; implement missing controls; test restore and security; and connect actual partners. The public demo accounts must never be used for real records. A hackathon affiliation is not a production operating agreement or an endorsement.
