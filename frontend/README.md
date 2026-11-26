# E-IDX frontend

Frontend preview for the E-IDX campus card platform. The interface covers campus card
operations, academic support, student services and reader verification.

The app is intentionally self-contained for now. It uses realistic sample data and does not
connect to an API, database, card or reader.

## Run locally

Requires Node 22 or newer.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Other commands:

```bash
npm run build    # type-check and production build
npm run preview  # serve the production build
npm run lint     # Oxlint
```

## Preview roles

The role switcher in the sidebar or mobile menu is a preview control. It is not authentication.
The selected role is stored in `localStorage` under `eidx-role`, and the route guard is
client-side only. Real access control must be enforced by the backend.

| Role | Home | Screens |
| --- | --- | --- |
| Admin, card services | `/admin` | Overview, students and cards, verification log, academic intelligence, verification console |
| Faculty, CSE | `/faculty` | Cohort, student record, attendance sessions, verification console |
| Student, card holder | `/student` | My card, campus services |

The demo student is Chirag P Shetty, `1DS23CS0048`. Use the role switcher to move between
accounts. Unauthorised URLs redirect to the active role's home; for example, `/admin` while
using the student role opens `/student`.

## What is implemented

- Admin overview with card studio, live update simulation, recent card updates, recent checks,
  cards needing attention and the academic snapshot.
- Student and card register with search, status filtering, a detail drawer and a queue-update
  flow.
- Verification log with hourly volume, reader health, student filtering and result filters.
- Academic intelligence screen with risk distribution, drivers, model information and privacy
  notes.
- Faculty cohort with support/watch lists, student records, model explanations, mentor notes,
  attendance and SGPA trends.
- Attendance sessions with an open/close flow, simulated taps and live counts.
- Verification console with QR and NFC test cases and backend-style accepted, expired, revoked
  and cloned outcomes.
- Student card with an identity/services E Ink preview, rotating QR pass and attendance summary.
- Campus services for attendance, library, examinations and fees.
- Responsive layouts tested at 320, 390 and 1440 pixels, 404 screen, keyboard focus states and
  reduced-motion support.

All numbers and names are sample data. The shell includes a "Preview data" label and every
screen ends with a note that no card or server is connected.

## Source layout

```text
src/
  components/       App shell, card preview, card studio, charts, QR pass, buttons, status
  data/mock.ts      Sample students, checks, sessions, services and model metadata
  lib/ui.ts         Small class and label helpers
  pages/admin/      Admin overview, students, verification log, insights
  pages/faculty/    Cohort, student detail, sessions
  pages/student/    My card, campus services
  pages/Verify.tsx  Reader verification simulator
  App.tsx           Route map and preview role guard
  index.css         Design tokens and named text styles
  session.tsx       Demo session and role state
  types.ts          Domain types shared with the future API
```

## Backend handoff

Data currently comes from `src/data/mock.ts`. Components consume the domain types in
`src/types.ts`. When the backend exists, replace those imports with API calls while keeping the
same component-facing shapes. The pages should not need to know how data is fetched.

The endpoints below are a proposed contract, not an implemented API. Prefix them with the
backend's versioned base path, keep responses JSON and use ISO 8601 timestamps.

| Surface | Proposed endpoints | Notes |
| --- | --- | --- |
| Session | `GET /me` | Current user, role and permissions. Replaces the preview role switch. |
| Admin overview | `GET /admin/overview` | Campus figures, risk totals, recent card updates, recent checks and attention cards in one read. |
| Students | `GET /students?query=&status=&page=&limit=` | Paginated. Include card summary with each student. |
| Student record | `GET /students/:usn` | Profile, courses, SGPA and card. Risk fields only for authorised staff. |
| Card update | `POST /students/:usn/card-updates` | Queue a stepped-up update. Require an idempotency key and audit actor. |
| Verification log | `GET /verifications?result=&method=&q=&from=&to=&page=` | Filter server-side. Return counts for the summary strip. |
| Verification | `POST /verify` | Backend-authoritative decision. Body: `{ token, method, readerId }`. Return `accepted`, `reason`, latency and a minimal student summary only on success. |
| Faculty cohort | `GET /faculty/cohort` | Cohort totals plus students with risk tier, driver and last intervention. |
| Student support | `GET /faculty/students/:usn` | Staff view with risk explanation and mentor notes. |
| Mentor note | `POST /faculty/students/:usn/interventions` | Append-only note with author and server timestamp. |
| Sessions | `GET /sessions?date=` | Session list with present counts and state. |
| Session control | `POST /sessions/:id/open`, `POST /sessions/:id/close` | Only one open session per section. |
| Session taps | `POST /sessions/:id/taps` | Reader-to-server path. Authenticate the reader; do not expose this to the browser. |
| Student card | `GET /me/card`, `POST /me/pass` | Card state and a short-lived signed pass. The pass must not contain risk data. |
| Campus services | `GET /me/attendance`, `GET /me/library`, `GET /me/exams`, `GET /me/fees` | Scope every read to the signed-in student. |
| Insights | `GET /insights/risk`, `GET /insights/model`, `GET /students/:usn/explanation` | Staff-only. Explanations return feature contributions, not raw model internals. |

Mutating endpoints should return the updated resource or a job identifier. Card updates and
verification writes are asynchronous in reality, so model their status instead of assuming an
instant success.

## Privacy and security rules

These are product invariants, not optional polish:

1. **Risk never reaches the card or the student app.** No risk probability, tier or explanation
   may appear in `/me/*` responses, `POST /me/pass` payloads or card update payloads. Risk is
   shown only on staff surfaces and is framed as support, never as a sanction.
2. **The backend decides trust.** The card displays a signed, short-lived pass. The server must
   check signature, expiry, single-use nonce, card status and reader scope before writing
   attendance or granting entry.
3. **Authenticate and authorise every request.** Use campus SSO, HttpOnly cookies and CSRF
   protection for browser mutations. Enforce role and record scope on the server. The current
   client-side role guard is only a preview convenience.
4. **Audit sensitive reads and writes.** Log staff access to risk explanations and all card,
   intervention, session and revocation changes with actor, reason and timestamp.
5. **Minimise data.** Return only the fields a screen needs. Do not include socioeconomic
   attributes in deployed model inputs or staff explanations. Verification logs should show a
   rejected card's identity only to authorised operators.
6. **Reader traffic is device traffic.** Readers need device credentials or mutual TLS,
   server-side replay protection and rate limits. Remove the browser "simulate tap" endpoint
   from production or restrict it to a development environment.

## Preview limitations

- No authentication, API, database, reader hardware or card provisioning.
- Mentor notes, queued card updates, session state and verification outcomes live in component
  memory and reset on reload.
- The verification console runs scripted test cases; it does not scan a real QR code or NFC tag.
- Dates and times are fixed sample values. Some simulated actions use a mock clock so they stay
  inside the open session window.
- The role switcher is not a security boundary.

## Next steps

1. Implement the backend service and database schema against the contract above.
2. Add SSO, server-side RBAC and the `GET /me` bootstrap.
3. Replace `src/data/mock.ts` imports with an API client under `src/api/`.
4. Integrate signed rotating passes and reader verification.
5. Connect the risk model and explanation service without exposing it to student surfaces.
6. Add end-to-end tests for role boundaries, card updates, verification outcomes, attendance
   and mentor notes.
