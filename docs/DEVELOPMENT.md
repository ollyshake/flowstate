# Development guide

Use the [README](../README.md) for installation, demo steps and assumptions, and [CALCULATIONS.md](../CALCULATIONS.md) for reporting formulas.

## Code map

- `src/app/`: server-rendered overview, loading/error states, shared layout and styles.
- `src/components/`: dashboard, resource picker and shadcn UI components.
- `src/lib/reporting.ts`: pure reporting calculations, month selection and formatting.
- `src/lib/resources.ts`: FTE availability calculations and shared resource types.
- `src/server/reporting/`: database queries for the overview.
- `src/server/resources/`: resource availability, assignment validation and Server Actions.
- `src/server/db/`: Drizzle schema, connection pool and repeatable seed.
- `drizzle/`: SQL migrations and schema snapshots.
- `tests/calculations.test.ts`: automated tests for the required calculations only.

## Database model

| Tables                                    | Responsibility                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `projects`                                | Names, unique external source IDs and project dates.                                       |
| `people`, `agents`                        | Resource identities; people also have available FTE capacity.                              |
| `person_assignments`, `agent_assignments` | Dated project membership; person assignments include FTE.                                  |
| `salary_rates`                            | Dated annual loaded cost per 1.0 FTE; a null end means ongoing.                            |
| `ai_providers`, `ai_costs`                | Provider seat/usage charges attributed to exactly one resource and project.                |
| `task_types`, `tasks`                     | Versioned effort/impact inputs, project work, attribution, completion and first reopening. |

Dates use inclusive starts and exclusive ends. When salary or FTE changes, end the old interval and insert a new one. FTE is stored to three decimal places, annual salary to two, and AI charges to six. Drizzle represents PostgreSQL numeric values as strings; reporting converts them to numbers and rounds only for display.

Incomplete tasks may be unassigned. Completed and reopened tasks require exactly one credited person or agent. To reopen a task through a future task workflow, set its status to `in_progress`, clear `completed_at`, and preserve `first_reopened_at`. Completing it again never clears that reopening timestamp. Historical task-type changes should create a new version rather than edit a referenced version.

Shared AI charges are split before insertion. For example, a $100 seat shared by two projects can be recorded as $60 and $40, with the rationale in `attribution_note`. Reporting spreads each row evenly across its covered days. Invoice reconciliation and currency conversion are not implemented.

## Read and write flow

Overview and availability reads use read-only, repeatable-read transactions so each response sees a consistent database snapshot. The overview reads costs/tasks for its selected project and calculates current/previous periods in memory. Assignment periods make salary-only months available in the reporting selector. The landing month prefers recorded AI/task activity so future allocations do not displace the seeded comparison.

Saving resources validates the request and locks the selected project and resource rows. Resource locks are acquired in stable ID order. Under READ COMMITTED, a concurrent save sees the first save's committed assignments before checking remaining capacity. Every person is checked at each assignment date boundary, with FTE expressed in integer thousandths to avoid floating-point capacity errors. Complete, non-overlapping salary coverage is required. Agents can work across projects without an FTE limit. All selected assignments are inserted in one transaction.

These application checks apply to resource saves through the app. Direct SQL/Studio edits can bypass capacity and historical rules. Database constraints still enforce foreign keys, basic date validity, owner exclusivity and unique assignment start dates. Reports fail visibly for salary coverage gaps/overlaps instead of understating costs.

## Database commands

- `npm run db:up`: start PostgreSQL and wait for its health check.
- `npm run db:migrate`: apply checked-in migrations; required on a fresh database.
- `npm run db:seed`: insert the repeatable demonstration data without replacing existing rows.
- `npm run db:studio`: start the database browser at [local.drizzle.studio](https://local.drizzle.studio).
- `npm run db:generate`: generate a migration after intentionally changing the schema; review the SQL before applying it.
- `npm run db:down`: stop PostgreSQL while retaining the named data volume.

`GET /api/health` reports application liveness with `{ "status": "ok" }`; it does not probe database health. Database connection/report errors are shown on the overview. Logs deliberately avoid printing connection credentials.
