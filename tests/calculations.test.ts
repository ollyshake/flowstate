import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePeriod,
  buildDashboardReport,
  salaryCost,
  type ReportingData,
  type TaskRecord,
} from "../src/lib/reporting";

function task(date: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    personId: "person",
    agentId: null,
    status: "completed",
    completedAt: new Date(`${date}T12:00:00Z`),
    firstReopenedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    effort: "5",
    impact: "2",
    ...overrides,
  };
}
function fixture(overrides: Partial<ReportingData> = {}): ReportingData {
  return {
    project: {
      id: "project",
      externalId: "example",
      name: "Example",
      startsOn: "2026-08-01",
      endsOn: "2026-11-01",
    },
    people: [{ id: "person", name: "Person", jobTitle: "Engineer" }],
    agents: [{ id: "agent", name: "Agent", description: "Research" }],
    assignments: [
      {
        personId: "person",
        startsOn: "2026-08-01",
        endsOn: "2026-11-01",
        fte: "0.5",
      },
    ],
    agentAssignments: [
      { agentId: "agent", startsOn: "2026-08-01", endsOn: "2026-11-01" },
    ],
    salaries: [
      {
        personId: "person",
        validFrom: "2026-01-01",
        validTo: null,
        annualLoadedSalary: "36500",
      },
    ],
    costs: [],
    tasks: [],
    ...overrides,
  };
}
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("people cost uses actual calendar days, not annual salary divided by 12", () => {
  const data = fixture();
  near(calculatePeriod(data, "2026-08-01", "2026-09-01").salary, 1550);
  near(calculatePeriod(data, "2026-09-01", "2026-10-01").salary, 1500);
});
test("salary and FTE changes are split at their interval boundaries", () => {
  const data = fixture({
    assignments: [
      {
        personId: "person",
        startsOn: "2026-09-01",
        endsOn: "2026-09-16",
        fte: "0.5",
      },
      {
        personId: "person",
        startsOn: "2026-09-16",
        endsOn: "2026-10-01",
        fte: "0.25",
      },
    ],
    salaries: [
      {
        personId: "person",
        validFrom: "2026-01-01",
        validTo: "2026-09-16",
        annualLoadedSalary: "36500",
      },
      {
        personId: "person",
        validFrom: "2026-09-16",
        validTo: null,
        annualLoadedSalary: "73000",
      },
    ],
  });
  const r = calculatePeriod(data, "2026-09-01", "2026-10-01");
  near(r.salary, 1500);
  near(r.fte, 0.375);
});
test("partial assignments use day-weighted FTE and project date boundaries", () => {
  const data = fixture({
    project: {
      ...fixture().project,
      startsOn: "2026-09-16",
      endsOn: "2026-09-26",
    },
  });
  const r = calculatePeriod(data, "2026-09-01", "2026-10-01");
  near(r.salary, 500);
  near(r.fte, 1 / 6);
});
test("leap years and cross-year intervals use the applicable year length", () => {
  near(salaryCost(36600, 1, "2024-02-01", "2024-03-01"), 2900);
  near(salaryCost(36500, 1, "2023-12-31", "2024-01-02"), 100 + 36500 / 366);
});
test("AI costs are prorated, attributed once, and support multiple providers", () => {
  const data = fixture({
    costs: [
      {
        personId: "person",
        agentId: null,
        startsOn: "2026-08-16",
        endsOn: "2026-09-16",
        amount: "310",
        provider: "OpenAI",
        kind: "seat",
      },
      {
        personId: null,
        agentId: "agent",
        startsOn: "2026-09-01",
        endsOn: "2026-10-01",
        amount: "90",
        provider: "Anthropic",
        kind: "usage",
      },
      {
        personId: null,
        agentId: "agent",
        startsOn: "2026-09-01",
        endsOn: "2026-10-01",
        amount: "60",
        provider: "OpenAI",
        kind: "usage",
      },
    ],
  });
  const r = calculatePeriod(data, "2026-09-01", "2026-10-01");
  near(r.ai, 300);
  near(r.total, 1800);
  near(r.people[0].ai, 150);
  near(r.agents[0].ai, 150);
});
test("PUs exclude incomplete and reopened tasks and respect exclusive month ends", () => {
  const data = fixture({
    tasks: [
      task("2026-09-10"),
      task("2026-09-15", { firstReopenedAt: new Date("2026-09-12") }),
      task("2026-09-16", { status: "in_progress", completedAt: null }),
      task("2026-10-01"),
      task("2026-09-20", {
        personId: null,
        agentId: "agent",
        effort: "1",
        impact: "0.5",
      }),
    ],
  });
  const r = calculatePeriod(data, "2026-09-01", "2026-10-01");
  near(r.pu, 10.5);
  near(r.people[0].pu, 10);
  near(r.agents[0].pu, 0.5);
  near(r.costPerPU!, 1500 / 10.5);
});
test("current and previous periods use the exact comparison and capacity formulas", () => {
  const data = fixture({
    tasks: [
      task("2026-08-10"),
      task("2026-08-20"),
      task("2026-09-10"),
      task("2026-09-15"),
      task("2026-09-20"),
    ],
  });
  const r = buildDashboardReport(data, [data.project], "2026-09");
  near(r.puChange!, 0.5);
  near(r.costChange!, (1500 / 30 - 1550 / 20) / (1550 / 20));
  near(r.capacity!, 0.25);
  near(r.avoided!, 750);
});
test("zero PUs/FTE return unavailable ratios rather than fabricated zero baselines", () => {
  const r = buildDashboardReport(fixture(), [fixture().project], "2026-09");
  assert.equal(r.current.costPerPU, null);
  assert.equal(r.puChange, null);
  assert.equal(r.costChange, null);
  assert.equal(r.capacity, null);
  assert.equal(r.avoided, null);
});
test("negative productivity capacity is retained", () => {
  const data = fixture({
    tasks: [task("2026-08-10"), task("2026-08-20"), task("2026-09-10")],
  });
  const r = buildDashboardReport(data, [data.project], "2026-09");
  near(r.capacity!, -0.25);
  near(r.avoided!, -750);
});

test("cost per PU uses total cost divided by delivered PUs for each resource and project", () => {
  const data = fixture({
    costs: [
      {
        personId: "person",
        agentId: null,
        startsOn: "2026-09-01",
        endsOn: "2026-10-01",
        amount: "30",
        provider: "OpenAI",
        kind: "seat",
      },
      {
        personId: null,
        agentId: "agent",
        startsOn: "2026-09-01",
        endsOn: "2026-10-01",
        amount: "60",
        provider: "Anthropic",
        kind: "usage",
      },
    ],
    tasks: [
      task("2026-09-10"),
      task("2026-09-10", { personId: null, agentId: "agent" }),
    ],
  });
  const r = calculatePeriod(data, "2026-09-01", "2026-10-01");
  near(r.total, 1590);
  near(r.people[0].total, 1530);
  near(r.people[0].costPerPU!, 153);
  near(r.agents[0].costPerPU!, 6);
  near(r.costPerPU!, 79.5);
});

test("AI spend change is the currency difference between periods", () => {
  const data = fixture({
    costs: [
      {
        personId: "person",
        agentId: null,
        startsOn: "2026-08-01",
        endsOn: "2026-09-01",
        amount: "20",
        provider: "OpenAI",
        kind: "seat",
      },
      {
        personId: null,
        agentId: "agent",
        startsOn: "2026-08-01",
        endsOn: "2026-09-01",
        amount: "70",
        provider: "Anthropic",
        kind: "usage",
      },
      {
        personId: "person",
        agentId: null,
        startsOn: "2026-09-01",
        endsOn: "2026-10-01",
        amount: "20",
        provider: "OpenAI",
        kind: "seat",
      },
      {
        personId: null,
        agentId: "agent",
        startsOn: "2026-09-01",
        endsOn: "2026-10-01",
        amount: "160",
        provider: "Anthropic",
        kind: "usage",
      },
    ],
  });
  const r = buildDashboardReport(data, [data.project], "2026-09");
  near(r.previous.ai, 90);
  near(r.current.ai, 180);
  near(r.aiChange, 90);
  const reduced = fixture({
    costs: data.costs.map((cost) => ({
      ...cost,
      amount: cost.startsOn === "2026-09-01" ? "10" : cost.amount,
    })),
  });
  near(
    buildDashboardReport(reduced, [reduced.project], "2026-09").aiChange,
    -70,
  );
});
