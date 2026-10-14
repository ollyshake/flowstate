import { monthWindow, lastIncludedDate, type ProjectRecord } from "./reporting";

export type Commitment = {
  projectId: string;
  projectName: string;
  startsOn: string;
  endsOn: string;
  fte: number;
};
export type PersonOption = {
  id: string;
  name: string;
  role: string;
  capacityFte: number;
  commitments: Commitment[];
};
export type AgentOption = {
  id: string;
  name: string;
  role: string;
  projectIds: string[];
};
export type ResourceOptions = {
  project: ProjectRecord;
  people: PersonOption[];
  agents: AgentOption[];
};
export type AddResourcesInput = {
  projectId: string;
  people: { id: string; fte: number }[];
  agents: string[];
};
export type ResourceResult =
  | { ok: true; options: ResourceOptions }
  | { ok: false; error: string };
export type AddResourcesResult =
  | { ok: true; peopleAdded: number; agentsAdded: number }
  | { ok: false; error: string };

// Integer thousandths match PostgreSQL numeric(4,3) and avoid floating-point
// errors when checking e.g. 0.7 + 0.3 against a person's 1.0 FTE capacity.
const units = (fte: number) => Math.round(fte * 1000);
export function remainingCapacity(
  person: PersonOption,
  start: string,
  end: string,
): number {
  const points = [
    ...new Set([
      start,
      end,
      ...person.commitments
        .flatMap((c) => [c.startsOn, c.endsOn])
        .filter((date) => date > start && date < end),
    ]),
  ].sort();
  let maximum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const committed = person.commitments
      .filter((c) => c.startsOn < points[i + 1] && c.endsOn > points[i])
      .reduce((sum, c) => sum + units(c.fte), 0);
    maximum = Math.max(maximum, committed);
  }
  return Math.max(0, units(person.capacityFte) - maximum) / 1000;
}
export function monthlyAvailability(
  person: PersonOption,
  project: ProjectRecord,
) {
  const result: {
    month: string;
    start: string;
    end: string;
    committed: number;
    available: number;
  }[] = [];
  let month = project.startsOn.slice(0, 7);
  const lastMonth = lastIncludedDate(project.endsOn).slice(0, 7);
  while (month <= lastMonth) {
    const window = monthWindow(month);
    const start =
      window.start > project.startsOn ? window.start : project.startsOn;
    const end = window.end < project.endsOn ? window.end : project.endsOn;
    const available = remainingCapacity(person, start, end);
    result.push({
      month,
      start,
      end,
      available,
      committed: Math.max(0, person.capacityFte - available),
    });
    month = window.end.slice(0, 7);
  }
  return result;
}
export const alreadyAssigned = (person: PersonOption, project: ProjectRecord) =>
  person.commitments.some(
    (c) =>
      c.projectId === project.id &&
      c.startsOn < project.endsOn &&
      c.endsOn > project.startsOn,
  );
