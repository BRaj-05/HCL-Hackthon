# RecoverPlus backend

Run `npm start` from `server/`. Health: `GET /api/health`. Run unit tests with `npm test` (Node 22.16 or later; isolation disabled for this sandbox).

The pure engine accepts normalized camelCase values with string/Decimal money and YYYY-MM-DD business dates. Production configuration must be mapped from the official file once supplied. `contactValidation` is a pure preflight check, not an atomic contact writer. `reconciliation` requires imported payments scoped to the settlement loan; it performs no status persistence.

Database-dependent routes are explicit 503 dependency responses, not completed APIs. There is no login, authorization, import persistence, day-end job, export CLI or simulated delivery worker yet. No fallback store is used. See `DB_GAPS.md` and `BACKEND_STATUS.md` before integration.
