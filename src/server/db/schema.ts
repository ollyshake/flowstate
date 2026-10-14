import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: text("name").notNull(),

    externalId: text("external_id").notNull().unique(),

    startsOn: date("starts_on").notNull(),

    endsOn: date("ends_on").notNull(),
  },
  (table) => [
    check("projects_nonempty_name", sql`length(btrim(${table.name})) > 0`),
    check(
      "projects_nonempty_external_id",
      sql`length(btrim(${table.externalId})) > 0`,
    ),
    check("projects_valid_dates", sql`${table.endsOn} > ${table.startsOn}`),
  ],
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").unique(),
    jobTitle: text("job_title"),

    // A part-time person may have less than 1.000 FTE available.
    capacityFte: numeric("capacity_fte", { precision: 4, scale: 3 })
      .notNull()
      .default("1.000"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("people_nonempty_name", sql`length(btrim(${table.name})) > 0`),
    check(
      "people_valid_capacity_fte",
      sql`${table.capacityFte} >= 0 AND ${table.capacityFte} <= 1`,
    ),
  ],
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("agents_nonempty_name", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const salaryRates = pgTable(
  "salary_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),

    annualLoadedSalary: numeric("annual_loaded_salary", {
      precision: 14,
      scale: 2,
    }).notNull(),

    // Start inclusive, end exclusive. Null means the rate has no end date.
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
  },
  (table) => [
    check(
      "salary_rates_nonnegative_salary",
      sql`${table.annualLoadedSalary} >= 0 AND ${table.annualLoadedSalary} <> 'NaN'::numeric`,
    ),
    check(
      "salary_rates_valid_dates",
      sql`${table.validTo} IS NULL OR ${table.validTo} > ${table.validFrom}`,
    ),
    uniqueIndex("salary_rates_person_start_unique").on(
      table.personId,
      table.validFrom,
    ),
    uniqueIndex("salary_rates_one_open_rate_per_person")
      .on(table.personId)
      .where(sql`${table.validTo} IS NULL`),
    index("salary_rates_person_end_idx").on(table.personId, table.validTo),
  ],
);

export const personAssignments = pgTable(
  "person_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    projectRole: text("project_role"),

    // Add a new dated row when an allocation changes.
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    fte: numeric("fte", { precision: 4, scale: 3 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "person_assignments_valid_dates",
      sql`${table.endsOn} > ${table.startsOn}`,
    ),
    check(
      "person_assignments_valid_fte",
      sql`${table.fte} > 0 AND ${table.fte} <= 1`,
    ),
    uniqueIndex("person_assignments_project_person_start_unique").on(
      table.projectId,
      table.personId,
      table.startsOn,
    ),
    index("person_assignments_person_dates_idx").on(
      table.personId,
      table.startsOn,
      table.endsOn,
    ),
    index("person_assignments_project_dates_idx").on(
      table.projectId,
      table.startsOn,
      table.endsOn,
    ),
  ],
);

export const agentAssignments = pgTable(
  "agent_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "agent_assignments_valid_dates",
      sql`${table.endsOn} > ${table.startsOn}`,
    ),
    uniqueIndex("agent_assignments_project_agent_start_unique").on(
      table.projectId,
      table.agentId,
      table.startsOn,
    ),
    index("agent_assignments_agent_dates_idx").on(
      table.agentId,
      table.startsOn,
      table.endsOn,
    ),
    index("agent_assignments_project_dates_idx").on(
      table.projectId,
      table.startsOn,
      table.endsOn,
    ),
  ],
);

export const aiChargeKind = pgEnum("ai_charge_kind", ["seat", "usage"]);
export const taskStatus = pgEnum("task_status", [
  "todo",
  "in_progress",
  "completed",
  "cancelled",
]);

export const aiProviders = pgTable(
  "ai_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
  },
  (table) => [
    check("ai_providers_nonempty_code", sql`length(btrim(${table.code})) > 0`),
    check("ai_providers_nonempty_name", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const aiCosts = pgTable(
  "ai_costs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => aiProviders.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    personId: uuid("person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "restrict",
    }),
    kind: aiChargeKind("kind").notNull(),
    // USD; retain sub-cent usage charges. Split shared charges before insertion.
    amount: numeric("amount", { precision: 14, scale: 6 }).notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    attributionNote: text("attribution_note"),
  },
  (table) => [
    check(
      "ai_costs_exactly_one_owner",
      sql`(${table.personId} IS NOT NULL) <> (${table.agentId} IS NOT NULL)`,
    ),
    check(
      "ai_costs_nonnegative_amount",
      sql`${table.amount} >= 0 AND ${table.amount} <> 'NaN'::numeric`,
    ),
    check("ai_costs_valid_dates", sql`${table.endsOn} > ${table.startsOn}`),
    index("ai_costs_project_dates_idx").on(
      table.projectId,
      table.startsOn,
      table.endsOn,
    ),
    index("ai_costs_person_dates_idx").on(
      table.personId,
      table.startsOn,
      table.endsOn,
    ),
    index("ai_costs_agent_dates_idx").on(
      table.agentId,
      table.startsOn,
      table.endsOn,
    ),
    index("ai_costs_provider_idx").on(table.providerId),
  ],
);

export const taskTypes = pgTable(
  "task_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    version: integer("version").notNull().default(1),
    name: text("name").notNull(),
    // Create a new version rather than editing referenced PU inputs.
    standardEffortHours: numeric("standard_effort_hours", {
      precision: 10,
      scale: 3,
    }).notNull(),
    impactWeight: numeric("impact_weight", {
      precision: 10,
      scale: 3,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("task_types_code_version_unique").on(table.code, table.version),
    check("task_types_nonempty_code", sql`length(btrim(${table.code})) > 0`),
    check("task_types_nonempty_name", sql`length(btrim(${table.name})) > 0`),
    check("task_types_positive_version", sql`${table.version} > 0`),
    check(
      "task_types_positive_effort",
      sql`${table.standardEffortHours} > 0 AND ${table.standardEffortHours} <> 'NaN'::numeric`,
    ),
    check(
      "task_types_positive_impact",
      sql`${table.impactWeight} > 0 AND ${table.impactWeight} <> 'NaN'::numeric`,
    ),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    taskTypeId: uuid("task_type_id")
      .notNull()
      .references(() => taskTypes.id, { onDelete: "restrict" }),
    externalId: text("external_id").notNull().unique(),
    title: text("title").notNull(),
    status: taskStatus("status").notNull().default("todo"),
    personId: uuid("person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "restrict",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    firstReopenedAt: timestamp("first_reopened_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("tasks_nonempty_title", sql`length(btrim(${table.title})) > 0`),
    check(
      "tasks_nonempty_external_id",
      sql`length(btrim(${table.externalId})) > 0`,
    ),
    check(
      "tasks_at_most_one_owner",
      sql`${table.personId} IS NULL OR ${table.agentId} IS NULL`,
    ),
    check(
      "tasks_completed_owner",
      sql`${table.status} <> 'completed' OR (${table.personId} IS NOT NULL) <> (${table.agentId} IS NOT NULL)`,
    ),
    check(
      "tasks_completion_state",
      sql`(${table.status} = 'completed') = (${table.completedAt} IS NOT NULL)`,
    ),
    check(
      "tasks_completion_after_creation",
      sql`${table.completedAt} IS NULL OR ${table.completedAt} >= ${table.createdAt}`,
    ),
    check(
      "tasks_reopening_after_creation",
      sql`${table.firstReopenedAt} IS NULL OR ${table.firstReopenedAt} >= ${table.createdAt}`,
    ),
    check(
      "tasks_recompletion_after_reopening",
      sql`${table.completedAt} IS NULL OR ${table.firstReopenedAt} IS NULL OR ${table.completedAt} >= ${table.firstReopenedAt}`,
    ),
    check(
      "tasks_reopened_owner",
      sql`${table.firstReopenedAt} IS NULL OR (${table.personId} IS NOT NULL) <> (${table.agentId} IS NOT NULL)`,
    ),
    index("tasks_project_completion_idx").on(
      table.projectId,
      table.completedAt,
    ),
    index("tasks_project_person_completion_idx").on(
      table.projectId,
      table.personId,
      table.completedAt,
    ),
    index("tasks_project_agent_completion_idx").on(
      table.projectId,
      table.agentId,
      table.completedAt,
    ),
    index("tasks_task_type_idx").on(table.taskTypeId),
  ],
);

// TypeScript models inferred from the table
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type SalaryRate = typeof salaryRates.$inferSelect;
export type NewSalaryRate = typeof salaryRates.$inferInsert;
export type PersonAssignment = typeof personAssignments.$inferSelect;
export type NewPersonAssignment = typeof personAssignments.$inferInsert;
export type AgentAssignment = typeof agentAssignments.$inferSelect;
export type NewAgentAssignment = typeof agentAssignments.$inferInsert;
export type AiProvider = typeof aiProviders.$inferSelect;
export type NewAiProvider = typeof aiProviders.$inferInsert;
export type AiCost = typeof aiCosts.$inferSelect;
export type NewAiCost = typeof aiCosts.$inferInsert;
export type TaskType = typeof taskTypes.$inferSelect;
export type NewTaskType = typeof taskTypes.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
