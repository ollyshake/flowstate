import "server-only";
import { eq, asc } from "drizzle-orm";
import { db } from "@/server/db";
import {
  projects,
  people,
  agents,
  personAssignments,
  agentAssignments,
  salaryRates,
  aiCosts,
  aiProviders,
  tasks,
  taskTypes,
} from "@/server/db/schema";
import {
  availableMonths,
  buildDashboardReport,
  defaultReportingMonth,
  type ReportingData,
} from "@/lib/reporting";

export class InvalidReportSelection extends Error {}

export async function getDashboardReport(
  projectId?: string,
  requestedMonth?: string,
) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
  // One consistent snapshot per page request; no cached or browser-side financial data.
  return db.transaction(
    async (tx) => {
      const projectList = await tx
        .select()
        .from(projects)
        .orderBy(asc(projects.name));
      if (!projectList.length) return null;
      const project = projectId
        ? projectList.find((p) => p.id === projectId)
        : projectList.find((p) => p.externalId === "demo-project-website") ||
          projectList[0];
      if (!project) throw new InvalidReportSelection("Unknown project.");
      const personRows = await tx
        .select({ id: people.id, name: people.name, jobTitle: people.jobTitle })
        .from(people);
      const agentRows = await tx
        .select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
        })
        .from(agents);
      const assignments = await tx
        .select()
        .from(personAssignments)
        .where(eq(personAssignments.projectId, project.id));
      const agentAssignmentRows = await tx
        .select()
        .from(agentAssignments)
        .where(eq(agentAssignments.projectId, project.id));
      const salaries = await tx.select().from(salaryRates);
      const costs = await tx
        .select({
          personId: aiCosts.personId,
          agentId: aiCosts.agentId,
          startsOn: aiCosts.startsOn,
          endsOn: aiCosts.endsOn,
          amount: aiCosts.amount,
          kind: aiCosts.kind,
          provider: aiProviders.name,
        })
        .from(aiCosts)
        .innerJoin(aiProviders, eq(aiCosts.providerId, aiProviders.id))
        .where(eq(aiCosts.projectId, project.id));
      const taskRows = await tx
        .select({
          personId: tasks.personId,
          agentId: tasks.agentId,
          status: tasks.status,
          completedAt: tasks.completedAt,
          firstReopenedAt: tasks.firstReopenedAt,
          createdAt: tasks.createdAt,
          effort: taskTypes.standardEffortHours,
          impact: taskTypes.impactWeight,
        })
        .from(tasks)
        .innerJoin(taskTypes, eq(tasks.taskTypeId, taskTypes.id))
        .where(eq(tasks.projectId, project.id));
      const data: ReportingData = {
        project,
        people: personRows,
        agents: agentRows,
        assignments,
        agentAssignments: agentAssignmentRows,
        salaries,
        costs,
        tasks: taskRows,
      };
      const months = availableMonths(data);
      const month = requestedMonth || defaultReportingMonth(data);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !months.includes(month))
        throw new InvalidReportSelection("Unknown reporting month.");
      return buildDashboardReport(data, projectList, month);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
