# Maak implementation phases

The confirmed sprint is **18 hours**, using **React and Flask**. Budgets below guide human team coordination; they do not represent measured time already spent. An initial working prototype now implements phases 1–4 and has passed core verification. Public hosting and team usability review still need their actual deployment context.

| Phase | Budget | Gate |
|---|---:|---|
| 1 — Foundation and access | 3 h | App and database start; real sessions; resident/donor/volunteer signup only; restricted roles denied |
| 2 — Intake and coordinator work | 4 h | Category-first intake; saved reference; scoped review; private data stays out of donor projection |
| 3 — Assistance and fulfillment | 4 h | Pledge, task, pickup/delivery, partial receipt, issue and personal confirmation persist correctly |
| 4 — Oversight and usability | 3 h | Grouped aggregate data; English/Arabic; working phone layouts; state and next action visible |
| 5 — Tests and demonstration | 3 h | Core tests and real browser journey pass; repeatable startup; seeded demo and fallback screenshots |
| Buffer | 1 h | Integration, event setup and rehearsal |

## Implemented now

Five scoped workspaces; authenticated sessions and CSRF; basic self-registration; essential-supply and reported oxygen/power requests; device Other; coordinator review; donor-safe opportunities; physical pledges; atomic volunteer acceptance; delivery progress; partial receipt; stock balances; recorded issue; resident confirmation; event timelines; shelter capacity/occupancy/power report; grouped oversight; Arabic/RTL; responsive views; local synthetic seed and reset.

Source feature slices: #1, #7, #9, #12–13, #16–17, #19–21, #39–42, #44–45, #52, #54–55. These are limited prototype slices: seeded role verification, no financial collection, no complete national coverage, no automated matching/notifications, no clinical certification. The reported urgency flag supports human review and is not an implementation of a medically validated criticality classifier.

## Next small prototype increments

Prioritize the team's chosen demo story rather than starting all modules at once. Estimates below assume the existing stack and synthetic data, an experienced contributor, and no external integration:

| Increment | Approximate effort | Prerequisite |
|---|---:|---|
| Cancellation/reassignment and overdue work | 2–4 h | Explicit release/reconciliation rules and tests |
| Basic complaint intake/status path | 3–5 h | Safe routing, private scopes and recurrence history |
| Family selector and basic synthetic passport | 4–6 h | Subject/relationship authorization and provenance |
| Scoped passport grant/revocation demo | 3–5 h | Basic passport; recipient role and field-level tests |
| Relocation or appointment-linked transport demo | 4–6 h | Receiving/provider confirmation model; emergency boundaries |

These increments do not fit the initial core budget automatically. Drop them if core integration or rehearsal is incomplete. They are prototype implementation estimates, not a promise of readiness for real care.

## Supervised pilot

Plan several weeks after partners are available; reliable dates require named people and agreements. Needed work includes institutional identity/credential checks, account recovery, scoped family authority and sharing, safeguarding/complaints, staffed escalation, clinician-reviewed copy/rules, verified transport, notification fallback, security assessment, retention/hosting decisions, database migrations, backups and restore exercises. Legal, clinical and partner review time is not predictable from coding effort alone.

## Expansion and national integrations

After pilot evidence, add lot/expiry and equipment governance, verified accessibility/power, institutional NGO assignments, regional reports and history, monetary donation reconciliation, public-health signal review, and governed hospital interoperability. Forecasting requires useful longitudinal data and baseline evaluation; it is not an 18-hour feature. Use the detailed design package as the full 57-feature roadmap.
