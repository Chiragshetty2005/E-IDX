# E-IDX backend

Fastify + TypeScript API and PostgreSQL database for the E-IDX campus card
platform. The service stores the academic risk predictions produced by the
local OULAD model pipeline and serves them to staff only.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| API | Node 22, TypeScript, Fastify 5 | Same language as the React frontend, fast JSON schema validation, small footprint |
| Database | PostgreSQL 16 (Docker for local dev) | Real constraints, `jsonb`, role level access control |
| Data access | `pg` with plain SQL migrations | No ORM hiding the schema, migrations stay reviewable |
| Tests | `node:test` with Fastify `inject` | No HTTP server needed, fast and deterministic |

## Local setup

```bash
cd backend
cp .env.example .env

docker compose up -d          # PostgreSQL on localhost:5433
npm install
npm run migrate               # applies sql/*.sql in order
npm run export:risk           # builds seed/risk_seed.json from ml/artifacts
npm run seed                  # loads 4,786 students, cards, risk predictions
npm run dev                   # http://localhost:4000
```

`npm run export:risk` needs the project virtualenv for the ML dependencies:

```bash
cd backend && ../ml/.venv/bin/python scripts/export_risk_seed.py
```

The script is wired to that interpreter through the `export:risk` npm script.

## Talking to the frontend

The React app in `../frontend` calls this API through the Vite dev proxy, so
the browser stays on one origin and the `eidx_session` cookie is sent on every
request:

```text
browser  ──▶  http://localhost:5173/api/v1/…  ──▶  http://localhost:4000/api/v1/…
```

There is no CORS configuration. A deployed build can point at another host with
`VITE_API_URL`, and that host must then allow the origin with credentials.

The API never scores on the fly. It serves the predictions exported from the
frozen ML artifacts, so a new model run needs `npm run export:risk` followed by
`npm run seed` before the dashboards can show it.

## Tests

```bash
npm test          # 26 checks, including the privacy invariants
npm run typecheck
```

The suite needs a migrated and seeded database; it fails with a clear message
if the database is empty.

## Database layout

`public` holds the platform tables: users, sessions, cards, card updates,
enrolments, attendance summaries, academic profiles, attendance sessions and
records, verification events, interventions, exams, library loans, fee
receipts and readers.

`risk` holds the model output:

* `risk.feature_snapshots` — the aggregated model inputs for one enrolment.
  No raw VLE click log is ever stored.
* `risk.predictions` — probability, tier and the five strongest SHAP drivers.

### Role separation

The API process connects as `eidx_app`, which can read and write the platform
tables but **cannot read the risk base tables**. Risk is reachable only through
`risk.staff_predictions` and `risk.staff_feature_snapshots`, and those views
return rows only inside a transaction that has enabled the staff scope:

```sql
BEGIN;
SELECT risk.enable_staff_scope();   -- sets eidx.staff_scope for this transaction
SELECT * FROM risk.staff_predictions;
COMMIT;
```

Outside that scope the view returns zero rows, so a bug in a student facing
route cannot leak a prediction even by accident. `npm test` asserts both the
permission failure on the base table and the empty result outside the scope.

## Privacy invariants

These are enforced in code and covered by tests:

1. No `/me/*` response contains a risk field. The privacy guard
   (`src/lib/privacy.ts`) scans outgoing payloads for risk keys.
2. `POST /me/pass` issues a signed pass that carries card identity and an
   expiry only.
3. Card update payloads are rejected with `422 risk_field_blocked` if they
   contain a risk field.
4. `GET /me/risk` answers `403 risk_is_staff_only` instead of quietly
   returning an empty body.
5. Raw VLE click logs are never stored. The database keeps aggregated feature
   snapshots only.

## Endpoints

Base path `/api/v1`. Session cookie `eidx_session` (httpOnly).

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/preview-login` | Demo sign-in with `{ role, usn? }`. Disabled when `PREVIEW_AUTH=false`. |
| POST | `/auth/logout` | Revokes the session. |
| GET | `/auth/session` | Current user and permissions. |

### Student

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/me` | User, role and permissions. Never contains risk. |
| GET | `/me/card` | Card state. Never contains risk. |
| POST | `/me/pass` | Short lived signed campus pass. |
| GET | `/me/attendance` | Per course attendance for the signed-in student. |
| GET | `/me/academics` | CGPA, SGPA, internal marks, assignment rate. |
| GET | `/me/library`, `/me/exams`, `/me/fees` | Campus services, scoped to the student. |
| GET | `/me/risk` | Always `403`. Academic risk is a staff signal. |

### Staff

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/overview` | Campus figures, risk totals, recent card updates, recent checks, attention cards. Updates and checks carry the student name, card UID and reader location. |
| GET | `/students?query=&status=&page=&limit=` | Paginated, includes card and latest tier. Sorted by risk probability. |
| GET | `/students/:usn` | Full record plus the frozen risk payload. |
| GET | `/students/:usn/explanation` | Feature contributions only, no model internals. |
| POST | `/students/:usn/card-updates` | Queues an update. Requires an idempotency key and an audit actor. |
| GET | `/faculty/cohort?limit=` | Cohort totals with tier, driver and last intervention. Faculty users see only their own section; admins see the whole campus. `limit` defaults to 200 and is capped at 500. |
| GET | `/faculty/students/:usn` | Staff view with notes and risk. |
| POST | `/faculty/students/:usn/interventions` | Append-only mentor note. |
| GET | `/verifications?result=&method=&q=&from=&to=&page=&limit=` | Filtered log with summary counts. |
| GET | `/verifications/summary` | Totals and median latency for today, reader health and the hourly verification volume. |
| POST | `/verify` | Backend-authoritative decision for `{ token, method, readerId }`. |
| GET | `/sessions?date=` | Sessions with present counts. `total_expected` is the size of the creating faculty member's section. |
| POST | `/sessions`, `/sessions/:id/open`, `/sessions/:id/close` | Session control. Only one session stays open at a time. |
| GET | `/insights/risk`, `/insights/model` | Tier distribution and the frozen model contract, including `student_count` and `brier`. |

### Reader devices

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/sessions/:id/taps` | Reader to server path. Authenticated with `x-reader-key`, never with a browser session. |

## Model contract

The service reads `ml/artifacts/model_meta.json` at runtime, so the API always
publishes the same version, thresholds and metrics as the trained artifact:

* model version `catboost-cutoff60-20261126065719`
* cutoff day 60
* 26,361 rows, 23,985 students, 45 features
* grouped CV ROC-AUC 0.8344, PR-AUC 0.8151, recall@20% 0.4314
* temporal holdout (2014J) ROC-AUC 0.8044
* tiers: support ≥ 0.9134, watch ≥ 0.5409, otherwise on-track

Prediction payloads match `ml/artifacts/prediction_payload.schema.json`:
`model_version`, `cutoff_day`, `generated_at`, `student_ref`, `module_ref`,
`risk_probability`, `risk_tier` and up to five `drivers` with
`feature`, `label`, `group`, `value`, `display`, `shap_value` and `direction`.

## What the seed contains

* 4,786 students with the campus tier split used by the frontend preview:
  479 support, 957 watch, 3,350 on-track.
* Six teaching sections. Section A is the teaching cohort used by the faculty
  screens: 62 students (the twelve named preview students plus 50 spread across
  the register by stride), 9 support, 13 watch, 40 on-track. Dr. Shahin Fatima
  teaches Section A and Dr. Anita Rao teaches Section B. The other sections hold
  the remaining 4,724 students.
* The twelve named preview students map to real OULAD rows of the matching
  tier, so the dashboard and the API tell the same story.
* Cards, enrolments, attendance summaries, academic profiles, exams, library
  loans, fee receipts, attendance sessions, verification events, card updates
  and mentor notes.
* Six readers with distinct ids and locations: `GATE 01`, `GATE 02`, `GATE 03`,
  `LIB 02`, `CSE 03` and `EXAM 01`.
* One risk prediction and one feature snapshot per student.

The seed is deterministic: identifiers come from a stable hash of the entity
key, so re-running it reproduces the same database. Re-seeding truncates the
session table, so any browser session signed in before the seed is dropped and
signs in again on the next request.

## Known limitations

* `POST /auth/preview-login` is a demo affordance. Replace it with the
  university SSO before any real deployment and set `PREVIEW_AUTH=false`.
* The reader key is a shared device credential. Production should issue a
  key per reader with rotation.
* Academic risk is read from the database, never scored on the fly. A new
  model run needs `npm run export:risk` and `npm run seed` (or a dedicated
  ingestion job) before the API can serve it.
