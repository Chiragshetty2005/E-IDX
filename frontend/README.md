# E-IDX frontend

React front end for the E-IDX campus card platform. It covers card operations, academic
support, student services, reader verification and campus presence for four roles: admin,
faculty, student and parent.

The app talks to the E-IDX API in `../backend` and falls back to the sample register in
`src/data/mock.ts` when the API cannot be reached, so the demo still works with the backend
switched off. The presence and parent screens fall back to the preview register in
`src/data/presence.ts` in the same way.

## Signing in

The app opens on `/signin`. There is no screen behind it until a session exists.

1. On start-up the app calls `GET /auth/session` with a five second timeout.
   * A valid session goes straight to the role home.
   * `401` means nobody is signed in, so the sign-in page stays.
   * A network error means the API is down, so the sign-in page says so and offers the
     sample register.
2. The sign-in page picks a role and calls `POST /auth/preview-login`. A student can
   type a USN; an empty field uses the first student account in the register.
3. The API answers with an HttpOnly session cookie. Every later request carries it, and the
   API enforces the role and the record scope on the server.
4. `Sign out` in the sidebar calls `POST /auth/logout` and returns to `/signin`.
5. A session that expires while the app is open sends the person back to `/signin` with a
   short notice, instead of leaving stale screens on screen.

`Continue with sample data` opens the dashboards on the sample register in
`src/data/mock.ts`, with no server session. The badge then reads `Preview data`.

The preview sign-in is a demo affordance and must be replaced by campus SSO before
deployment. The API can turn it off with `PREVIEW_AUTH=false`.

The `Viewing as` control in the sidebar is a demo switcher for the seeded accounts. In live
mode it signs in again through `POST /auth/preview-login`, so the server session and the
screen always agree. The route guard in `App.tsx` is a preview convenience only.

The parent role signs in from the third row of the sign-in page (`Parent or guardian`). A
parent account is linked to children in `parent_links`; the portal only ever shows those
children. The API enforces the link on the server, so previewing the parent role cannot be
widened from the browser.

## Campus presence

Presence is checkpoint based, not GPS. A child is seen when a reader sees a tag or a QR or
NFC credential at a checkpoint.

| Term | Meaning |
| --- | --- |
| Checkpoint | A named reader position: bus stop, gate, classroom, library or canteen. |
| State | `on-campus`, `on-bus`, `left` or `not-arrived`. |
| Method | `uhf` (hands-free tag), `qr` (scan) or `nfc` (tap). |
| Source | `reader`, `simulated` or `seed`. |

Two staff screens and one parent portal read it:

* `/admin/presence` — the campus presence board. Admin scopes it to the school pilot or the
  college register, faculty are locked to their own section. The board shows the summary
  band, the live student list, zone counts, the emergency headcount, the checkpoint feed and
  the read simulator.
* `/parent` and `/parent/children/:usn` — the children list and a single child's timeline,
  card and tag identifiers.
* `/parent/alerts` — arrival, departure, bus and off-campus notifications for linked
  children only.

The read simulator writes a real `presence_events` row with `source='simulated'`, then raises
a push notification (sent) and an SMS (queued) outbox row for every linked parent. It is
labelled as a simulation on the screen and in the event feed: a browser cannot read a passive
UHF tag, so real reads must arrive from a reader.

School children are never scored by the academic risk model. The students register shows
`Primary school` and the class label for them instead of a risk tier, and no risk field is
sent to a parent payload or a card update.

## Live and preview modes

The shell always shows where the numbers come from.

| Badge | Meaning |
| --- | --- |
| `Live API` | The browser holds a server session and every screen reads from the API. |
| `Connecting to the API` | The session check is still running. |
| `Preview data` | The app is showing the sample register instead of the API. |

The role is kept in `localStorage` under `eidx-role`, so the sign-in page opens on the role
that was used last.

## Run locally

Requires Node 22 or newer, and the backend running on port 4000.

```bash
# terminal 1, from ../backend
docker compose up -d
npm run migrate
npm run export:risk   # once, with ml/.venv
npm run seed
npm run dev

# terminal 2, from this folder
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:4000`, so the browser stays on one origin and the
HttpOnly session cookie is sent without any CORS setup. A deployed build can point elsewhere
with `VITE_API_URL`, for example `VITE_API_URL=https://api.example.edu/api/v1`.

Other commands:

```bash
npm run build       # type-check and production build
npm run preview     # serve the production build (same /api proxy)
npm run lint        # Oxlint
npm run smoke:api   # client checks against a running API
```

`npm run smoke:api` signs in with each role, pulls every endpoint the dashboards use and runs
the real adapters over the payloads. It catches shape drift between the backend routes and
`src/api/adapters.ts` without a browser.

## What each screen reads

| Screen | Endpoints |
| --- | --- |
| Admin overview | `GET /admin/overview` |
| Students and cards | `GET /students`, `GET /students/:usn`, `POST /students/:usn/card-updates` |
| Verification log | `GET /verifications`, `GET /verifications/summary` |
| Academic intelligence | `GET /insights/risk`, `GET /insights/model`, `GET /faculty/cohort` |
| Card studio | `GET /students`, `GET /students/:usn`, `POST /students/:usn/card-updates` |
| Faculty cohort | `GET /faculty/cohort`, `GET /sessions` |
| Faculty student record | `GET /students/:usn`, `POST /faculty/students/:usn/interventions` |
| Attendance sessions | `GET /sessions`, `POST /sessions/:id/open`, `POST /sessions/:id/close` |
| Student card and services | `GET /me/*`, `POST /me/pass` |
| Campus presence board | `GET /presence/overview?level=school\|college`, `POST /presence/simulate` |
| Parent portal | `GET /parent/children`, `GET /parent/children/:usn`, `GET /parent/alerts` |
| Verification console | Scripted test cases only, no API call |

Search, filtering and pagination run on the server for the students register and the
verification log. The sample data is filtered in the browser when the app is in preview mode.

## Model metadata

The screens show the real model that was trained locally on OULAD, not placeholder numbers.
In live mode the numbers come from `GET /insights/model` and the risk classes from
`GET /insights/risk`.

| Item | Value |
| --- | --- |
| Model | CatBoost, build `2026.11.26` |
| Training data | 26,361 active module enrolments, 23,985 students, 45 features |
| Cutoff | Day 60 of the module |
| Validation | Grouped CV ROC-AUC 0.8344, PR-AUC 0.8151, recall@20% 0.4314 |
| Temporal holdout | ROC-AUC 0.8044 on the 2014J presentation |
| Tiers | support ≥ 0.9134, watch ≥ 0.5409, otherwise on-track (top 10% and next 20%) |
| Drivers | Assessment scores 27%, recent VLE activity 21%, module context 15%, submission timing 12%, missed assessments 11% |

The model reads assessment and VLE behaviour. Campus attendance is **not** a model input, and card
taps are never used to train it. Socioeconomic attributes are excluded from the inputs and are
used only for subgroup checks. The fairness audit and the full model card live in
`../ml/artifacts/`.

## Source layout

```text
src/
  api/
    client.ts       Fetch wrapper: cookies, timeout, typed errors
    endpoints.ts    One function per API route
    types.ts        Wire types that mirror the backend routes
    adapters.ts     Wire payloads into the view models the pages use
  components/       App shell, card preview, card studio, charts, QR pass, buttons, status
  data/
    mock.ts         Sample students, checks, sessions, services and model metadata
    preview.ts      Sample data rendered into the same view models the API produces
    presence.ts     School pilot, parent preview and presence view models
    views.ts        View models shared by the pages
    hooks.ts        Data hooks with live loading, error and fallback handling
  lib/ui.ts         Small class and label helpers
  pages/admin/      Admin overview, students, verification log, insights, campus presence
  pages/faculty/    Cohort, student detail, sessions
  pages/student/    My card, campus services
  pages/parent/     Children, child detail, alerts
  pages/SignIn.tsx  Sign-in page, outside the shell
  pages/Verify.tsx  Reader verification simulator
  App.tsx           Route map, session gate and role guard
  index.css         Design tokens and named text styles
  session.tsx       Server session, sign-in, data mode and role state
  types.ts          Domain types shared with the API
```

## Privacy and security rules

These are product invariants, not optional polish:

1. **Risk never reaches the card or the student app.** No risk probability, tier or explanation
   appears in `/me/*` responses, `POST /me/pass` payloads or card update payloads. The student
   view model in `src/types.ts` has no risk fields at all, so the client cannot leak them by
   accident. Risk is shown only on staff surfaces and is framed as support, never as a sanction.
2. **The backend decides trust.** The card displays a signed, short-lived pass. The server checks
   signature, expiry, card status and session window before writing attendance or granting entry.
3. **Authenticate and authorise every request.** The API uses an HttpOnly session cookie and
   enforces role and record scope on the server. The sign-in page and the route guard in the
   browser are a convenience; the API decides who may read and write what.
4. **Audit sensitive reads and writes.** Staff access to risk explanations and all card,
   intervention, session and revocation changes are recorded with actor, reason and timestamp.
5. **Minimise data.** Endpoints return only the fields a screen needs. Socioeconomic attributes
   are not in model inputs or staff explanations.
6. **Reader traffic is device traffic.** Readers need device credentials, server-side replay
   protection and rate limits. The browser never posts attendance; the tap simulator on the
   sessions screen stays in the browser and is labelled as a test.
7. **Parents see presence, never risk.** Parent payloads contain only the linked child's
   presence, card and notification records. The parent view models in `src/types.ts` have no
   risk fields, and the API rejects risk keys in parent responses.
8. **Presence is checkpoint based.** There is no GPS and no location tracking between
   checkpoints. A read says a tag was seen at a named checkpoint at a time; it does not say
   where the child has been since.

## Preview limitations

- The preview sign-in is not campus SSO. `POST /auth/preview-login` issues a real session, but it
  is a demo affordance and the API can disable it with `PREVIEW_AUTH=false`.
- The verification console runs scripted test cases; it does not scan a real QR code or NFC tag,
  and it does not post to the API.
- The tap simulator on the attendance screen is local to the browser. Real readers post taps to
  `POST /sessions/:id/taps` with device credentials.
- The presence simulator posts to `POST /presence/simulate` as an admin and writes a real
  event with `source='simulated'`. It stands in for a hands-free reader, because a browser
  cannot read a passive UHF tag. The notification rows it creates are outbox rows, not a
  delivered push message or SMS.
- There is no live GPS. Presence only changes when a checkpoint reader or the simulator
  writes an event.
- The faculty attendance trend chart is illustrative. Weekly attendance history is not stored yet.
- In preview mode, mentor notes, queued card updates and session state live in component memory
  and reset on reload.
- The reader key is a shared device credential. Production should issue a key per reader with
  rotation.

## Next steps

1. Replace the preview sign-in with campus SSO and keep the server-side role checks.
2. Integrate signed rotating passes and reader verification with real hardware.
3. Add end-to-end tests for role boundaries, card updates, verification outcomes, attendance
   and mentor notes.
4. Store weekly attendance history so the faculty trend chart can read real data.
5. Run the model on live institutional data and re-check the fairness gaps before any pilot.
