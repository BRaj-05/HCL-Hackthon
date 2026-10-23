# Collect — React JavaScript frontend

A modular collections workspace built with React, JavaScript/JSX, Vite, React Router, Zod, Papa Parse and Lucide. All project changes are confined to the `frontend` directory on branch `front`. There is no TypeScript source or TypeScript build step.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173).

The default is an explicitly labeled local demo. It starts with the manager role; the header lets you switch between collector, manager, collections head and auditor. Demo records persist in this browser's local storage. To reset the dataset, clear the site's browser storage. Customer names, scores and payment records are fictional.

## Connect Express + PostgreSQL + Prisma

Copy `.env.example` to `.env` and configure:

```dotenv
VITE_DEMO_MODE=false
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_ENABLE_AI=true
```

Restart Vite after changing environment variables. The frontend accesses PostgreSQL through Express REST endpoints. Prisma, PostgreSQL credentials, SQL, financial calculations and JWT verification belong on the server. Never put `DATABASE_URL`, a Prisma client, or private secrets in a `VITE_*` variable.

The REST adapters accept UUID strings, Prisma Decimal amounts serialized as strings or numbers, ISO timestamps, and the documented Prisma enum representations. See [the API contract](docs/API_CONTRACT.md). The existing repository server is a MongoDB starter and was left unchanged; it does not yet implement this contract.

Live mode requires valid credentials and a working backend. A failed API request never switches to demo data. JWTs are kept in session storage and sent using `Authorization: Bearer`. A 401 returns to sign-in; 403 and Zod-style 422 errors appear in the interface.

## Modules and folder classification

```text
frontend/
├── public/                     Favicon and static assets
├── src/
│   ├── app/                    Routes, loading/error states, workspace state
│   ├── components/             Navigation, dialogs, tables, cards
│   ├── features/
│   │   ├── auth/               Sign-in, sessions, role selection
│   │   ├── dashboard/          Portfolio overview and collection activity
│   │   ├── finance/            DPD bucket and queue display classification
│   │   ├── worklist/           Plan for the day
│   │   ├── loans/              Accounts, assignment, holds, account details
│   │   ├── contacts/           Contact history, fair-practice checks, PTP
│   │   ├── settlements/        Proposal and independent maker-checker review
│   │   ├── reconciliation/     Payment ledger, PTP and settlement outcomes
│   │   ├── day-end/            As-of runs, pipeline steps, outbox and retries
│   │   ├── imports/            Loan, schedule, payment and contact CSV upload
│   │   ├── exports/            Collection and settlement output CSVs
│   │   ├── rules/              R1–R12 policy registry and optional controls
│   │   ├── audit/              Searchable read-only audit trail
│   │   └── ai/                 Optional recovery scores and top three reasons
│   ├── lib/                    CSV handling, formatting, validation, permissions
│   ├── services/
│   │   ├── api/                HTTP client, Prisma DTO mapping, domain API modules
│   │   ├── demo/               Isolated local data and illustrative batch engine
│   │   └── gateway.js          Shared operations selecting demo or live adapters
│   ├── styles/                 Pastel theme and responsive layouts
│   └── main.jsx                React entry point
├── docs/API_CONTRACT.md         Express integration contract
├── e2e/                        Browser workflow tests (JavaScript)
├── vite.config.js
└── playwright.config.js
```

React components use `.jsx`; utilities, API adapters, configuration and tests use `.js`.

## Workflow

1. Import loans, schedules, payments, then contacts. Download the matching CSV template, validate it, and preview rows before submitting.
2. Run day-end for an as-of date. The demo recalculates FIFO allocation, DPD, bucket, dues and penal amounts; it refreshes priorities and reconciles commitments.
3. Open the worklist. Filter, rank and assign accounts. Review schedules, payments, contacts and audit events in account details.
4. Log customer conversations and promises to pay. Accounts on hold cannot be contacted.
5. Propose a settlement; a different authorized manager or head must review it.
6. Reconcile payment outcomes, inspect reminder events and download evaluation CSVs.

All display dates use Asia/Kolkata. CSV financial dates are YYYY-MM-DD; CSV contact timestamps should include the IST offset (`+05:30`). Amounts are in INR rupees, with up to two decimal places.

## Roles

| Capability | Collector | Manager | Head | Auditor |
| --- | --- | --- | --- | --- |
| View accounts | Assigned | All | All | All |
| Log contacts / propose settlement | Assigned | Yes | Yes | No |
| Review another maker's proposal | No | Yes | Yes | No |
| Assign accounts / manage holds | No | Yes | Yes | No |
| Import / reconcile / run day-end / retry reminders | No | Yes | Yes | No |
| Export reports | No | Yes | Yes | Yes |
| Change optional rules | No | No | Yes | No |
| Inspect audit | Own activity | All | All | All |

The frontend guides access. The Express backend must independently enforce JWT validation, RBAC, account ownership, maker-checker separation and database transactions.

## Demo limitations and missing specification

The architecture was supplied, but no case-study PDF was attached or present in the repository. Therefore exact R1–R12 definitions, legal contact policies, penalty formulas, evaluation column specifications and AI model behavior are not claimed as final.

The demo illustrates FIFO, DPD thresholds (0, 1–30, 31–60, 61–90, 90+), and a non-accumulating penal charge of 0.5% of overdue installments. R7, R8 and R12 control optional queue behavior. Core financial, hold and fair-practice rules cannot be disabled. Demo contact hours are 08:00–19:00 IST. Replace these assumptions with the case-study/backend policies.

PTP and settlement demo outcomes compare eligible payments in the commitment date window. Production matching, payment reversals, waivers, rounding, overpayments, policy versioning and transactional guarantees must be implemented by the backend. Imported accounts need their schedules before calculation.

The day-end demo is repeatable without accumulating charges or duplicate reminder keys for an account/date. It prepares export data and queues events; it never sends messages or runs a server worker. AI scores are synthetic; there is no Python model in this frontend. Set `VITE_ENABLE_AI=false` to hide optional AI screens and ranking.

## Checks

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Microsoft Edge on Windows. On other platforms install Chromium with `npx playwright install chromium`. Playwright starts and stops its own local Vite server. Tests use their own browser contexts and do not alter your browser's demo records.

For production static hosting, serve `dist/` and configure an SPA fallback to `index.html` for browser routes.
