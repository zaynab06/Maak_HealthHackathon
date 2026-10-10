# Maak prototype validation

Verified locally on 10 October 2026 with synthetic demo data. This records prototype checks, not production certification.

- Backend: 16 pytest tests passed. Includes the complete partial-then-final fulfillment workflow, role and shelter boundaries, CSRF, idempotent retries, overpledging prevention, task claim contention, and invalid quantities.
- Frontend: Vite production build passed.
- Browser journey: all five roles completed request → review → publish → pledge → volunteer delivery → shelter receipt → distribution → resident confirmation. Donors cannot access private resident requests; Ministry responses contain aggregate data.
- Layouts: 42 role/navigation/viewport combinations plus five Arabic RTL mobile views passed horizontal overflow checks without browser runtime errors.
- Request form retains unsent values when its language changes.
- Request details refresh correctly; offline failures show localized errors and allow a successful retry.
- Expired sessions on both reads and writes return to sign-in. The first subsequent sign-in succeeds. A rejected expired-session write creates no request.
- Python dependency consistency check passed.

## Repeatable checks

From the repository root:

```bash
PYTHONPATH=backend .venv/bin/pytest -q backend/tests
```

From `frontend`:

```bash
npm run build
npm run format:check
```

With the demo running on port 5000 and Playwright/Chromium available:

```bash
python scripts/browser_smoke.py
python scripts/check_layouts.py
```

The browser smoke test creates a new synthetic request and completes it. It does not reset the database. Screenshots are written to ignored `test-results/`.

## Remaining validation

Before a real pilot: testing with Lebanese residents and coordinators, assistive technology review, operational identity verification, deployment security review, backup/restore drills, and agreement on data handling and escalation responsibilities. Later-roadmap modules are not implemented by this prototype.
