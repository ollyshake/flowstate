// Pure calculations shared by the server report builder and its tests.
// Formulas are defined in REQUIREMENTS.md. All intervals are [start, end), UTC.
export type ProjectRecord = {
  id: string;
  name: string;
  externalId: string;
  startsOn: string;
  endsOn: string;
};
export type PersonRecord = {
  id: string;
  name: string;
  jobTitle: string | null;
};
export type AgentRecord = {
  id: string;
  name: string;
  description: string | null;
};
export type AssignmentRecord = {
  personId: string;
  startsOn: string;
  endsOn: string;
  fte: string;
};
export type AgentAssignmentRecord = {
  agentId: string;
  startsOn: string;
  endsOn: string;
};
export type SalaryRecord = {
  personId: string;
  validFrom: string;
  validTo: string | null;
  annualLoadedSalary: string;
};
export type CostRecord = {
  personId: string | null;
  agentId: string | null;
  startsOn: string;
  endsOn: string;
  amount: string;
  provider: string;
  kind: "seat" | "usage";
};
export type TaskRecord = {
  personId: string | null;
  agentId: string | null;
  status: string;
  completedAt: Date | null;
  firstReopenedAt: Date | null;
  createdAt: Date;
  effort: string;
  impact: string;
};
export type ReportingData = {
  project: ProjectRecord;
  people: PersonRecord[];
  agents: AgentRecord[];
  assignments: AssignmentRecord[];
  agentAssignments: AgentAssignmentRecord[];
  salaries: SalaryRecord[];
  costs: CostRecord[];
  tasks: TaskRecord[];
};
export type ResourceRow = {
  id: string;
  name: string;
  role: string;
  fte: number;
  salary: number;
  ai: number;
  total: number;
  pu: number;
  costPerPU: number | null;
  providers: string[];
};
export type PeriodReport = {
  salary: number;
  ai: number;
  total: number;
  pu: number;
  fte: number;
  costPerPU: number | null;
  people: ResourceRow[];
  agents: ResourceRow[];
  providers: string[];
};
export type DashboardReport = {
  project: ProjectRecord;
  projects: ProjectRecord[];
  month: string;
  months: string[];
  previousMonth: string;
  current: PeriodReport;
  previous: PeriodReport;
  puChange: number | null;
  costChange: number | null;
  aiChange: number;
  capacity: number | null;
  avoided: number | null;
  forecast: number | null;
  accrued: number;
  remainingDays: number;
  forecastCutoff: string;
  activeDays: number;
  completed: number;
  taskCount: number;
  progress: number | null;
  calculatedAt: string;
};
const DAY = 86_400_000;
const stamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const daysBetween = (start: string, end: string) =>
  Math.max(0, (stamp(end) - stamp(start)) / DAY);
export function monthWindow(month: string) {
  const start = `${month}-01`;
  const date = new Date(stamp(start));
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  )
    .toISOString()
    .slice(0, 10);
  return { start, end };
}
export function previousMonth(month: string) {
  const date = new Date(stamp(`${month}-01`));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 7);
}
function overlap(
  start: string,
  end: string,
  otherStart: string,
  otherEnd: string,
) {
  return daysBetween(
    start > otherStart ? start : otherStart,
    end < otherEnd ? end : otherEnd,
  );
}
function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}
export function percentChange(
  current: number | null,
  previous: number | null,
): number | null {
  return current !== null && previous !== null && previous > 0
    ? (current - previous) / previous
    : null;
}
export function salaryCost(
  annual: number,
  fte: number,
  start: string,
  end: string,
): number {
  let cursor = start,
    total = 0;
  while (cursor < end) {
    const year = Number(cursor.slice(0, 4));
    const nextYear = `${year + 1}-01-01`;
    const segmentEnd = nextYear < end ? nextYear : end;
    total +=
      (annual * fte * daysBetween(cursor, segmentEnd)) /
      daysBetween(`${year}-01-01`, nextYear);
    cursor = segmentEnd;
  }
  return total;
}
function eligible(task: TaskRecord, start: string, end: string) {
  return (
    task.status === "completed" &&
    !task.firstReopenedAt &&
    task.completedAt !== null &&
    task.completedAt.getTime() >= stamp(start) &&
    task.completedAt.getTime() < stamp(end)
  );
}
export function calculatePeriod(
  data: ReportingData,
  start: string,
  end: string,
): PeriodReport {
  const { project } = data;
  const scopeStart = start > project.startsOn ? start : project.startsOn;
  const scopeEnd = end < project.endsOn ? end : project.endsOn;
  const periodDays = daysBetween(start, end);
  const people = new Map<string, ResourceRow>();
  const agents = new Map<string, ResourceRow>();
  function row(id: string, kind: "person" | "agent") {
    const map = kind === "person" ? people : agents;
    if (!map.has(id)) {
      const person = data.people.find((p) => p.id === id);
      const agent = data.agents.find((a) => a.id === id);
      if ((kind === "person" && !person) || (kind === "agent" && !agent))
        throw new Error("Reporting owner is missing.");
      map.set(id, {
        id,
        name: kind === "person" ? person!.name : agent!.name,
        role:
          kind === "person"
            ? person!.jobTitle || "Team member"
            : agent!.description || "AI agent",
        fte: 0,
        salary: 0,
        ai: 0,
        total: 0,
        pu: 0,
        costPerPU: null,
        providers: [],
      });
    }
    return map.get(id)!;
  }
  if (scopeStart < scopeEnd && periodDays > 0) {
    for (const assignment of data.assignments) {
      const activeDays = overlap(
        scopeStart,
        scopeEnd,
        assignment.startsOn,
        assignment.endsOn,
      );
      if (!activeDays) continue;
      const person = row(assignment.personId, "person");
      person.fte += (Number(assignment.fte) * activeDays) / periodDays;
      const activeStart = [scopeStart, assignment.startsOn].sort().at(-1)!;
      const activeEnd = [scopeEnd, assignment.endsOn].sort()[0];
      let coveredDays = 0;
      const rates = data.salaries
        .filter((s) => s.personId === assignment.personId)
        .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
      let coveredThrough = activeStart;
      for (const salary of rates) {
        const segmentStart = [activeStart, salary.validFrom].sort().at(-1)!;
        const segmentEnd = [activeEnd, salary.validTo || activeEnd].sort()[0];
        if (segmentStart >= segmentEnd) continue;
        if (segmentStart < coveredThrough)
          throw new Error(
            "Overlapping salary rates prevent accurate reporting.",
          );
        coveredDays += daysBetween(segmentStart, segmentEnd);
        coveredThrough = segmentEnd;
        person.salary += salaryCost(
          Number(salary.annualLoadedSalary),
          Number(assignment.fte),
          segmentStart,
          segmentEnd,
        );
      }
      if (coveredDays !== activeDays)
        throw new Error("A salary rate is missing for an active assignment.");
    }
    for (const assignment of data.agentAssignments) {
      if (overlap(scopeStart, scopeEnd, assignment.startsOn, assignment.endsOn))
        row(assignment.agentId, "agent");
    }
    for (const cost of data.costs) {
      const coveredDays = overlap(
        scopeStart,
        scopeEnd,
        cost.startsOn,
        cost.endsOn,
      );
      if (!coveredDays) continue;
      const owner = cost.personId
        ? row(cost.personId, "person")
        : row(cost.agentId!, "agent");
      owner.ai +=
        (Number(cost.amount) * coveredDays) /
        daysBetween(cost.startsOn, cost.endsOn);
      if (!owner.providers.includes(cost.provider))
        owner.providers.push(cost.provider);
    }
    for (const task of data.tasks) {
      if (!eligible(task, scopeStart, scopeEnd)) continue;
      const owner = task.personId
        ? row(task.personId, "person")
        : row(task.agentId!, "agent");
      owner.pu += Number(task.effort) * Number(task.impact);
    }
  }
  for (const resource of [...people.values(), ...agents.values()]) {
    resource.total = resource.salary + resource.ai;
    resource.costPerPU = ratio(resource.total, resource.pu);
    resource.providers.sort();
  }
  const team = [...people.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const bots = [...agents.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const all = [...team, ...bots];
  const salary = team.reduce((sum, p) => sum + p.salary, 0);
  const ai = all.reduce((sum, r) => sum + r.ai, 0);
  const pu = all.reduce((sum, r) => sum + r.pu, 0);
  return {
    salary,
    ai,
    total: salary + ai,
    pu,
    fte: team.reduce((sum, p) => sum + p.fte, 0),
    costPerPU: ratio(salary + ai, pu),
    people: team,
    agents: bots,
    providers: [...new Set(all.flatMap((r) => r.providers))].sort(),
  };
}
function reportingMonths(
  data: ReportingData,
  includeAssignments: boolean,
): string[] {
  const months = new Set<string>();
  const intervals = includeAssignments
    ? [...data.costs, ...data.assignments, ...data.agentAssignments]
    : data.costs;
  for (const interval of intervals) {
    const start =
      interval.startsOn > data.project.startsOn
        ? interval.startsOn
        : data.project.startsOn;
    const end =
      interval.endsOn < data.project.endsOn
        ? interval.endsOn
        : data.project.endsOn;
    if (start >= end) continue;
    let month = start.slice(0, 7);
    const last = lastIncludedDate(end).slice(0, 7);
    while (month <= last) {
      months.add(month);
      month = monthWindow(month).end.slice(0, 7);
    }
  }
  for (const task of data.tasks)
    if (task.completedAt)
      months.add(task.completedAt.toISOString().slice(0, 7));
  return [...months]
    .filter(
      (m) =>
        monthWindow(m).start < data.project.endsOn &&
        monthWindow(m).end > data.project.startsOn,
    )
    .sort()
    .reverse();
}
export function availableMonths(data: ReportingData): string[] {
  const months = reportingMonths(data, true);
  return months.length ? months : [data.project.startsOn.slice(0, 7)];
}
export function defaultReportingMonth(data: ReportingData): string {
  // Keep the latest recorded activity as the landing period, while allowing
  // salary-only and scheduled assignment months to be selected explicitly.
  return reportingMonths(data, false)[0] ?? availableMonths(data)[0];
}
export function buildDashboardReport(
  data: ReportingData,
  projects: ProjectRecord[],
  month: string,
  calculatedAt = new Date().toISOString(),
): DashboardReport {
  const window = monthWindow(month);
  const prevMonth = previousMonth(month);
  const prevWindow = monthWindow(prevMonth);
  const current = calculatePeriod(data, window.start, window.end);
  const previous = calculatePeriod(data, prevWindow.start, prevWindow.end);
  const baseline =
    previous.fte > 0 && previous.pu > 0 ? previous.pu / previous.fte : null;
  const capacity =
    baseline !== null ? current.pu / baseline - current.fte : null;
  const avoided =
    capacity !== null && current.fte > 0
      ? (capacity * current.salary) / current.fte
      : null;
  const cutoff =
    window.end < data.project.endsOn ? window.end : data.project.endsOn;
  const accrued =
    cutoff > data.project.startsOn
      ? calculatePeriod(data, data.project.startsOn, cutoff).total
      : 0;
  const remainingDays = daysBetween(
    cutoff > data.project.startsOn ? cutoff : data.project.startsOn,
    data.project.endsOn,
  );
  const activeDays = overlap(
    window.start,
    window.end,
    data.project.startsOn,
    data.project.endsOn,
  );
  const forecast =
    remainingDays === 0
      ? accrued
      : activeDays > 0
        ? accrued + (current.total / activeDays) * remainingDays
        : null;
  const activeTasks = data.tasks.filter((t) => t.status !== "cancelled");
  const completed = activeTasks.filter((t) => t.status === "completed").length;
  return {
    project: data.project,
    projects,
    month,
    months: availableMonths(data),
    previousMonth: prevMonth,
    current,
    previous,
    puChange: percentChange(current.pu, previous.pu),
    costChange: percentChange(current.costPerPU, previous.costPerPU),
    aiChange: current.ai - previous.ai,
    capacity,
    avoided,
    forecast,
    accrued,
    remainingDays,
    forecastCutoff: cutoff,
    activeDays,
    completed,
    taskCount: activeTasks.length,
    progress: ratio(completed, activeTasks.length),
    calculatedAt,
  };
}
export const money = (value: number | null, decimals = 0) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
export const number = (value: number | null, decimals = 1) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: decimals,
      }).format(value);
export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
export const lastIncludedDate = (exclusiveEnd: string) =>
  iso(stamp(exclusiveEnd) - DAY);
