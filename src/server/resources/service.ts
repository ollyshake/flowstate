import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/server/db";
import {
  agents,
  agentAssignments,
  people,
  personAssignments,
  projects,
  salaryRates,
} from "@/server/db/schema";
import {
  alreadyAssigned,
  remainingCapacity,
  type AddResourcesInput,
  type ResourceOptions,
} from "@/lib/resources";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class ResourceError extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validate(input: AddResourcesInput) {
  if (
    !input ||
    !uuid.test(input.projectId) ||
    !Array.isArray(input.people) ||
    !Array.isArray(input.agents) ||
    input.people.length + input.agents.length === 0 ||
    input.people.length + input.agents.length > 100
  )
    throw new ResourceError("Choose at least one resource.");
  if (
    input.people.some(
      (p) =>
        !p ||
        !uuid.test(p.id) ||
        typeof p.fte !== "number" ||
        !Number.isFinite(p.fte) ||
        p.fte < 0.001 ||
        p.fte > 1 ||
        Math.abs(p.fte * 1000 - Math.round(p.fte * 1000)) > 1e-7,
    ) ||
    input.agents.some((id) => typeof id !== "string" || !uuid.test(id))
  )
    throw new ResourceError(
      "Choose a valid resource and an allocation between 0.001 and 1 FTE.",
    );
  if (
    new Set(input.people.map((p) => p.id)).size !== input.people.length ||
    new Set(input.agents).size !== input.agents.length
  )
    throw new ResourceError("Each resource can only be selected once.");
}
async function personOptions(
  tx: Transaction,
  startsOn: string,
  endsOn: string,
  ids?: string[],
) {
  const personRows = await tx
    .select({
      id: people.id,
      name: people.name,
      role: people.jobTitle,
      capacityFte: people.capacityFte,
    })
    .from(people)
    .where(ids ? inArray(people.id, ids) : undefined)
    .orderBy(asc(people.name));
  const commitments = await tx
    .select({
      personId: personAssignments.personId,
      projectId: personAssignments.projectId,
      projectName: projects.name,
      startsOn: personAssignments.startsOn,
      endsOn: personAssignments.endsOn,
      fte: personAssignments.fte,
    })
    .from(personAssignments)
    .innerJoin(projects, eq(projects.id, personAssignments.projectId))
    .where(
      and(
        lt(personAssignments.startsOn, endsOn),
        gt(personAssignments.endsOn, startsOn),
        ids ? inArray(personAssignments.personId, ids) : undefined,
      ),
    );
  return personRows.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role || "Team member",
    capacityFte: Number(p.capacityFte),
    commitments: commitments
      .filter((c) => c.personId === p.id)
      .map((c) => ({ ...c, fte: Number(c.fte) })),
  }));
}
export async function loadResourceOptions(
  projectId: string,
): Promise<ResourceOptions> {
  if (!uuid.test(projectId)) throw new ResourceError("Project not found.");
  return db.transaction(
    async (tx) => {
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      if (!project) throw new ResourceError("Project not found.");
      const personRows = await personOptions(
        tx,
        project.startsOn,
        project.endsOn,
      );
      const agentRows = await tx
        .select()
        .from(agents)
        .orderBy(asc(agents.name));
      const assignments = await tx
        .select()
        .from(agentAssignments)
        .where(
          and(
            lt(agentAssignments.startsOn, project.endsOn),
            gt(agentAssignments.endsOn, project.startsOn),
          ),
        );
      return {
        project,
        people: personRows,
        agents: agentRows.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.description || "AI agent",
          projectIds: assignments
            .filter((s) => s.agentId === a.id)
            .map((s) => s.projectId),
        })),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function saveResources(input: AddResourcesInput) {
  validate(input);
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select()
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .for("share");
    if (!project) throw new ResourceError("Project not found.");
    // Every assignment write takes the resource row lock, in stable ID order.
    // READ COMMITTED then sees assignments committed by a concurrent writer
    // before checking capacity; selections are saved together or not at all.
    const personIds = input.people.map((p) => p.id).sort();
    if (personIds.length) {
      const locked = await tx
        .select({ id: people.id })
        .from(people)
        .where(inArray(people.id, personIds))
        .orderBy(asc(people.id))
        .for("update");
      if (locked.length !== personIds.length)
        throw new ResourceError("One of the selected people no longer exists.");
      const options = await personOptions(
        tx,
        project.startsOn,
        project.endsOn,
        personIds,
      );
      const salaries = await tx
        .select()
        .from(salaryRates)
        .where(inArray(salaryRates.personId, personIds));
      for (const selected of input.people) {
        const person = options.find((p) => p.id === selected.id)!;
        if (alreadyAssigned(person, project))
          throw new ResourceError(
            `${person.name} is already assigned to this project.`,
          );
        const available = remainingCapacity(
          person,
          project.startsOn,
          project.endsOn,
        );
        if (Math.round(selected.fte * 1000) > Math.round(available * 1000))
          throw new ResourceError(
            `${person.name} has only ${available} FTE available across this project. Review the allocation and try again.`,
          );
        // Prevent saving an assignment that would break salary-based reporting.
        let coveredThrough = project.startsOn;
        const rates = salaries
          .filter(
            (s) =>
              s.personId === person.id &&
              s.validFrom < project.endsOn &&
              (s.validTo === null || s.validTo > project.startsOn),
          )
          .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
        for (const salary of rates) {
          const start =
            salary.validFrom > project.startsOn
              ? salary.validFrom
              : project.startsOn;
          const end =
            salary.validTo && salary.validTo < project.endsOn
              ? salary.validTo
              : project.endsOn;
          if (start !== coveredThrough)
            throw new ResourceError(
              `${person.name} needs complete, non-overlapping salary records for the project dates.`,
            );
          coveredThrough = end;
        }
        if (coveredThrough !== project.endsOn)
          throw new ResourceError(
            `${person.name} needs a salary record covering the project dates.`,
          );
      }
    }
    const agentIds = [...input.agents].sort();
    if (agentIds.length) {
      const locked = await tx
        .select({ id: agents.id })
        .from(agents)
        .where(inArray(agents.id, agentIds))
        .orderBy(asc(agents.id))
        .for("update");
      if (locked.length !== agentIds.length)
        throw new ResourceError("One of the selected agents no longer exists.");
      const assigned = await tx
        .select()
        .from(agentAssignments)
        .where(
          and(
            eq(agentAssignments.projectId, project.id),
            inArray(agentAssignments.agentId, agentIds),
            lt(agentAssignments.startsOn, project.endsOn),
            gt(agentAssignments.endsOn, project.startsOn),
          ),
        );
      if (assigned.length)
        throw new ResourceError(
          "One of the selected agents is already assigned to this project.",
        );
    }
    if (input.people.length)
      await tx.insert(personAssignments).values(
        input.people.map((p) => ({
          projectId: project.id,
          personId: p.id,
          fte: p.fte.toFixed(3),
          startsOn: project.startsOn,
          endsOn: project.endsOn,
        })),
      );
    if (input.agents.length)
      await tx.insert(agentAssignments).values(
        input.agents.map((agentId) => ({
          projectId: project.id,
          agentId,
          startsOn: project.startsOn,
          endsOn: project.endsOn,
        })),
      );
    return {
      peopleAdded: input.people.length,
      agentsAdded: input.agents.length,
    };
  });
}
