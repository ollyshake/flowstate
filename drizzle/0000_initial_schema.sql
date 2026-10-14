CREATE TYPE "public"."ai_charge_kind" AS ENUM('seat', 'usage');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "agent_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_assignments_valid_dates" CHECK ("agent_assignments"."ends_on" > "agent_assignments"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_nonempty_name" CHECK (length(btrim("agents"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "ai_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"person_id" uuid,
	"agent_id" uuid,
	"kind" "ai_charge_kind" NOT NULL,
	"amount" numeric(14, 6) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"attribution_note" text,
	CONSTRAINT "ai_costs_exactly_one_owner" CHECK (("ai_costs"."person_id" IS NOT NULL) <> ("ai_costs"."agent_id" IS NOT NULL)),
	CONSTRAINT "ai_costs_nonnegative_amount" CHECK ("ai_costs"."amount" >= 0 AND "ai_costs"."amount" <> 'NaN'::numeric),
	CONSTRAINT "ai_costs_valid_dates" CHECK ("ai_costs"."ends_on" > "ai_costs"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "ai_providers_code_unique" UNIQUE("code"),
	CONSTRAINT "ai_providers_nonempty_code" CHECK (length(btrim("ai_providers"."code")) > 0),
	CONSTRAINT "ai_providers_nonempty_name" CHECK (length(btrim("ai_providers"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"job_title" text,
	"capacity_fte" numeric(4, 3) DEFAULT '1.000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_email_unique" UNIQUE("email"),
	CONSTRAINT "people_nonempty_name" CHECK (length(btrim("people"."name")) > 0),
	CONSTRAINT "people_valid_capacity_fte" CHECK ("people"."capacity_fte" >= 0 AND "people"."capacity_fte" <= 1)
);
--> statement-breakpoint
CREATE TABLE "person_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"project_role" text,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"fte" numeric(4, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_assignments_valid_dates" CHECK ("person_assignments"."ends_on" > "person_assignments"."starts_on"),
	CONSTRAINT "person_assignments_valid_fte" CHECK ("person_assignments"."fte" > 0 AND "person_assignments"."fte" <= 1)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"external_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	CONSTRAINT "projects_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "projects_nonempty_name" CHECK (length(btrim("projects"."name")) > 0),
	CONSTRAINT "projects_nonempty_external_id" CHECK (length(btrim("projects"."external_id")) > 0),
	CONSTRAINT "projects_valid_dates" CHECK ("projects"."ends_on" > "projects"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "salary_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"annual_loaded_salary" numeric(14, 2) NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	CONSTRAINT "salary_rates_nonnegative_salary" CHECK ("salary_rates"."annual_loaded_salary" >= 0 AND "salary_rates"."annual_loaded_salary" <> 'NaN'::numeric),
	CONSTRAINT "salary_rates_valid_dates" CHECK ("salary_rates"."valid_to" IS NULL OR "salary_rates"."valid_to" > "salary_rates"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "task_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"standard_effort_hours" numeric(10, 3) NOT NULL,
	"impact_weight" numeric(10, 3) NOT NULL,
	CONSTRAINT "task_types_nonempty_code" CHECK (length(btrim("task_types"."code")) > 0),
	CONSTRAINT "task_types_nonempty_name" CHECK (length(btrim("task_types"."name")) > 0),
	CONSTRAINT "task_types_positive_version" CHECK ("task_types"."version" > 0),
	CONSTRAINT "task_types_positive_effort" CHECK ("task_types"."standard_effort_hours" > 0 AND "task_types"."standard_effort_hours" <> 'NaN'::numeric),
	CONSTRAINT "task_types_positive_impact" CHECK ("task_types"."impact_weight" > 0 AND "task_types"."impact_weight" <> 'NaN'::numeric)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_type_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"person_id" uuid,
	"agent_id" uuid,
	"completed_at" timestamp with time zone,
	"first_reopened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "tasks_nonempty_title" CHECK (length(btrim("tasks"."title")) > 0),
	CONSTRAINT "tasks_nonempty_external_id" CHECK (length(btrim("tasks"."external_id")) > 0),
	CONSTRAINT "tasks_at_most_one_owner" CHECK ("tasks"."person_id" IS NULL OR "tasks"."agent_id" IS NULL),
	CONSTRAINT "tasks_completed_owner" CHECK ("tasks"."status" <> 'completed' OR ("tasks"."person_id" IS NOT NULL) <> ("tasks"."agent_id" IS NOT NULL)),
	CONSTRAINT "tasks_completion_state" CHECK (("tasks"."status" = 'completed') = ("tasks"."completed_at" IS NOT NULL)),
	CONSTRAINT "tasks_completion_after_creation" CHECK ("tasks"."completed_at" IS NULL OR "tasks"."completed_at" >= "tasks"."created_at"),
	CONSTRAINT "tasks_reopening_after_creation" CHECK ("tasks"."first_reopened_at" IS NULL OR "tasks"."first_reopened_at" >= "tasks"."created_at"),
	CONSTRAINT "tasks_recompletion_after_reopening" CHECK ("tasks"."completed_at" IS NULL OR "tasks"."first_reopened_at" IS NULL OR "tasks"."completed_at" >= "tasks"."first_reopened_at"),
	CONSTRAINT "tasks_reopened_owner" CHECK ("tasks"."first_reopened_at" IS NULL OR ("tasks"."person_id" IS NOT NULL) <> ("tasks"."agent_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_costs" ADD CONSTRAINT "ai_costs_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_costs" ADD CONSTRAINT "ai_costs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_costs" ADD CONSTRAINT "ai_costs_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_costs" ADD CONSTRAINT "ai_costs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_assignments" ADD CONSTRAINT "person_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_assignments" ADD CONSTRAINT "person_assignments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_rates" ADD CONSTRAINT "salary_rates_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_type_id_task_types_id_fk" FOREIGN KEY ("task_type_id") REFERENCES "public"."task_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_assignments_project_agent_start_unique" ON "agent_assignments" USING btree ("project_id","agent_id","starts_on");--> statement-breakpoint
CREATE INDEX "agent_assignments_agent_dates_idx" ON "agent_assignments" USING btree ("agent_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "agent_assignments_project_dates_idx" ON "agent_assignments" USING btree ("project_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "ai_costs_project_dates_idx" ON "ai_costs" USING btree ("project_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "ai_costs_person_dates_idx" ON "ai_costs" USING btree ("person_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "ai_costs_agent_dates_idx" ON "ai_costs" USING btree ("agent_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "ai_costs_provider_idx" ON "ai_costs" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_assignments_project_person_start_unique" ON "person_assignments" USING btree ("project_id","person_id","starts_on");--> statement-breakpoint
CREATE INDEX "person_assignments_person_dates_idx" ON "person_assignments" USING btree ("person_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "person_assignments_project_dates_idx" ON "person_assignments" USING btree ("project_id","starts_on","ends_on");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_rates_person_start_unique" ON "salary_rates" USING btree ("person_id","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_rates_one_open_rate_per_person" ON "salary_rates" USING btree ("person_id") WHERE "salary_rates"."valid_to" IS NULL;--> statement-breakpoint
CREATE INDEX "salary_rates_person_end_idx" ON "salary_rates" USING btree ("person_id","valid_to");--> statement-breakpoint
CREATE UNIQUE INDEX "task_types_code_version_unique" ON "task_types" USING btree ("code","version");--> statement-breakpoint
CREATE INDEX "tasks_project_completion_idx" ON "tasks" USING btree ("project_id","completed_at");--> statement-breakpoint
CREATE INDEX "tasks_project_person_completion_idx" ON "tasks" USING btree ("project_id","person_id","completed_at");--> statement-breakpoint
CREATE INDEX "tasks_project_agent_completion_idx" ON "tasks" USING btree ("project_id","agent_id","completed_at");--> statement-breakpoint
CREATE INDEX "tasks_task_type_idx" ON "tasks" USING btree ("task_type_id");