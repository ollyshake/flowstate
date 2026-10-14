import { db, pool } from "./index";
import {
  agents,
  agentAssignments,
  aiCosts,
  aiProviders,
  people,
  personAssignments,
  projects,
  salaryRates,
  tasks,
  taskTypes,
  type NewAiCost,
  type NewPersonAssignment,
  type NewTask,
} from "./schema";

// Stable IDs make repeated runs additive without deleting or overwriting user data.
const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const createdAt = new Date("2026-08-01T00:00:00Z");

const projectRows = [
  {
    id: id(1),
    externalId: "demo-project-website",
    name: "Website relaunch",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
  },
  {
    id: id(2),
    externalId: "demo-project-mobile",
    name: "Mobile app",
    startsOn: "2026-08-01",
    endsOn: "2026-12-01",
  },
  {
    id: id(3),
    externalId: "demo-project-insights",
    name: "Customer insights",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
  },
];

const personRows = [
  {
    id: id(10),
    name: "Olivia Rhye",
    email: "olivia@example.test",
    jobTitle: "Product designer",
    capacityFte: "1.000",
    createdAt,
  },
  {
    id: id(11),
    name: "Phoenix Baker",
    email: "phoenix@example.test",
    jobTitle: "Frontend engineer",
    capacityFte: "1.000",
    createdAt,
  },
  {
    id: id(12),
    name: "Lana Steiner",
    email: "lana@example.test",
    jobTitle: "Product manager",
    capacityFte: "0.800",
    createdAt,
  },
  {
    id: id(13),
    name: "Demi Wilkinson",
    email: "demi@example.test",
    jobTitle: "Content strategist",
    capacityFte: "1.000",
    createdAt,
  },
  {
    id: id(14),
    name: "Drew Cano",
    email: "drew@example.test",
    jobTitle: "QA engineer",
    capacityFte: "1.000",
    createdAt,
  },
  {
    id: id(15),
    name: "Alex Morgan",
    email: "alex@example.test",
    jobTitle: "Full-stack engineer",
    capacityFte: "1.000",
    createdAt,
  },
];

const agentRows = [
  {
    id: id(20),
    name: "Atlas",
    description: "Development and code review",
    createdAt,
  },
  {
    id: id(21),
    name: "Scout",
    description: "Research and competitive analysis",
    createdAt,
  },
  {
    id: id(22),
    name: "Quill",
    description: "Content and copywriting",
    createdAt,
  },
  {
    id: id(23),
    name: "Pixel",
    description: "Design QA and accessibility; available to assign",
    createdAt,
  },
];

const salaryRows = [
  {
    id: id(100),
    personId: id(10),
    annualLoadedSalary: "96000.00",
    validFrom: "2026-08-01",
    validTo: "2026-09-01",
  },
  {
    id: id(101),
    personId: id(10),
    annualLoadedSalary: "100000.00",
    validFrom: "2026-09-01",
    validTo: null,
  },
  ...[108000, 84000, 90000, 78000, 102000].map((salary, index) => ({
    id: id(102 + index),
    personId: id(11 + index),
    annualLoadedSalary: salary.toFixed(2),
    validFrom: "2026-08-01",
    validTo: null,
  })),
];

const assignmentRows: NewPersonAssignment[] = [
  {
    id: id(200),
    projectId: id(1),
    personId: id(10),
    fte: "0.800",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(201),
    projectId: id(2),
    personId: id(10),
    fte: "0.200",
    startsOn: "2026-08-01",
    endsOn: "2026-12-01",
    createdAt,
  },
  {
    id: id(202),
    projectId: id(1),
    personId: id(11),
    fte: "0.600",
    startsOn: "2026-08-01",
    endsOn: "2026-09-01",
    createdAt,
  },
  {
    id: id(203),
    projectId: id(1),
    personId: id(11),
    fte: "0.700",
    startsOn: "2026-09-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(204),
    projectId: id(3),
    personId: id(11),
    fte: "0.400",
    startsOn: "2026-08-01",
    endsOn: "2026-09-01",
    createdAt,
  },
  {
    id: id(205),
    projectId: id(3),
    personId: id(11),
    fte: "0.300",
    startsOn: "2026-09-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(206),
    projectId: id(1),
    personId: id(12),
    fte: "0.500",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(207),
    projectId: id(2),
    personId: id(12),
    fte: "0.300",
    startsOn: "2026-08-01",
    endsOn: "2026-12-01",
    createdAt,
  },
  {
    id: id(208),
    projectId: id(1),
    personId: id(13),
    fte: "0.400",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(209),
    projectId: id(3),
    personId: id(13),
    fte: "0.400",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(210),
    projectId: id(2),
    personId: id(14),
    fte: "0.500",
    startsOn: "2026-08-01",
    endsOn: "2026-12-01",
    createdAt,
  },
  {
    id: id(211),
    projectId: id(3),
    personId: id(14),
    fte: "0.500",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
];

const agentAssignmentRows = [
  {
    id: id(300),
    projectId: id(1),
    agentId: id(20),
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(301),
    projectId: id(2),
    agentId: id(20),
    startsOn: "2026-08-01",
    endsOn: "2026-12-01",
    createdAt,
  },
  {
    id: id(302),
    projectId: id(1),
    agentId: id(21),
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(303),
    projectId: id(3),
    agentId: id(21),
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(304),
    projectId: id(1),
    agentId: id(22),
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(305),
    projectId: id(3),
    agentId: id(22),
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
];

const providerRows = [
  { id: id(30), code: "openai", name: "OpenAI" },
  { id: id(31), code: "anthropic", name: "Anthropic" },
];

// Illustrative pre-AI baselines, not measurements from an actual PMS.
const taskTypeRows = [
  {
    id: id(40),
    code: "feature",
    version: 1,
    name: "Feature implementation",
    standardEffortHours: "8.000",
    impactWeight: "1.500",
  },
  {
    id: id(41),
    code: "analysis",
    version: 1,
    name: "Pricing analysis",
    standardEffortHours: "6.000",
    impactWeight: "2.000",
  },
  {
    id: id(42),
    code: "review",
    version: 1,
    name: "Quality review",
    standardEffortHours: "3.000",
    impactWeight: "1.000",
  },
  {
    id: id(43),
    code: "update",
    version: 1,
    name: "Status update",
    standardEffortHours: "1.000",
    impactWeight: "0.500",
  },
];

const periods = [
  {
    startsOn: "2026-08-01",
    endsOn: "2026-09-01",
    label: "August",
    month: "08",
    completedPerOwner: 2,
  },
  {
    startsOn: "2026-09-01",
    endsOn: "2026-10-01",
    label: "September",
    month: "09",
    completedPerOwner: 3,
  },
];
const costRows: NewAiCost[] = [];
const taskRows: NewTask[] = [];

for (const [periodIndex, period] of periods.entries()) {
  // One cost/output set per project + person, even when their FTE has several dated rows.
  const active = assignmentRows.filter(
    (a) => a.startsOn < period.endsOn && a.endsOn > period.startsOn,
  );
  for (const [index, assignment] of active.entries()) {
    const common = {
      projectId: assignment.projectId,
      personId: assignment.personId,
      agentId: null,
      startsOn: period.startsOn,
      endsOn: period.endsOn,
    };
    costRows.push(
      {
        id: id(1000 + costRows.length),
        ...common,
        providerId: id(30),
        kind: "seat",
        amount: "20.000000",
        attributionNote:
          "Illustrative per-project share of a shared provider seat.",
      },
      {
        id: id(1001 + costRows.length),
        ...common,
        providerId: id(31),
        kind: "usage",
        amount: (15 + index * 3 + periodIndex * 20).toFixed(6),
      },
    );
  }
  for (const [index, assignment] of agentAssignmentRows.entries()) {
    for (const provider of providerRows) {
      costRows.push({
        id: id(1000 + costRows.length),
        projectId: assignment.projectId,
        personId: null,
        agentId: assignment.agentId,
        providerId: provider.id,
        kind: "usage",
        amount: (70 + index * 12 + periodIndex * 35).toFixed(6),
        startsOn: period.startsOn,
        endsOn: period.endsOn,
      });
    }
  }

  const owners = [
    ...active.map((a) => ({
      projectId: a.projectId,
      personId: a.personId!,
      agentId: null,
    })),
    ...agentAssignmentRows.map((a) => ({
      projectId: a.projectId,
      personId: null,
      agentId: a.agentId,
    })),
  ];
  for (const [ownerIndex, owner] of owners.entries()) {
    for (let n = 0; n < period.completedPerOwner; n++) {
      const type = taskTypeRows[(ownerIndex + n) % taskTypeRows.length];
      const taskId = id(2000 + taskRows.length);
      taskRows.push({
        id: taskId,
        externalId: `demo-task-${taskId}`,
        ...owner,
        taskTypeId: type.id,
        title: `${period.label} ${type.name.toLowerCase()} ${ownerIndex + 1}.${n + 1}`,
        status: "completed",
        completedAt: new Date(`2026-${period.month}-${10 + n * 5}T12:00:00Z`),
        createdAt,
      });
    }
  }
}

for (const [index, project] of projectRows.entries()) {
  const type = taskTypeRows[index];
  taskRows.push(
    {
      id: id(3000 + index * 3),
      externalId: `demo-${project.externalId}-todo`,
      projectId: project.id,
      taskTypeId: type.id,
      title: "Plan next milestone",
      status: "todo",
      createdAt,
    },
    {
      id: id(3001 + index * 3),
      externalId: `demo-${project.externalId}-progress`,
      projectId: project.id,
      taskTypeId: type.id,
      title: "Deliver next milestone",
      status: "in_progress",
      createdAt,
    },
    {
      id: id(3002 + index * 3),
      externalId: `demo-${project.externalId}-reopened`,
      projectId: project.id,
      taskTypeId: type.id,
      title: "Re-completed work (excluded from PUs)",
      status: "completed",
      personId: assignmentRows.find((a) => a.projectId === project.id)!
        .personId,
      completedAt: new Date("2026-09-25T12:00:00Z"),
      firstReopenedAt: new Date("2026-09-24T12:00:00Z"),
      createdAt,
    },
  );
}

// Keep this expansion separate from the original fixtures so their generated
// cost/task IDs and the existing project reports remain stable on reseeding.
const extraProjectRows = [
  {
    id: id(4),
    externalId: "demo-project-platform",
    name: "Platform upgrade",
    startsOn: "2026-08-01",
    endsOn: "2026-12-01",
  },
  {
    id: id(5),
    externalId: "demo-project-design",
    name: "Design system",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
  },
];

const extraPeople = [
  {
    seedId: 400,
    name: "Sienna Park",
    email: "sienna@example.test",
    jobTitle: "Product designer",
    capacityFte: "1.000",
    salary: 90000,
  },
  {
    seedId: 401,
    name: "Maya Patel",
    email: "maya@example.test",
    jobTitle: "Backend engineer",
    capacityFte: "1.000",
    salary: 114000,
  },
  {
    seedId: 402,
    name: "Ethan Price",
    email: "ethan@example.test",
    jobTitle: "QA engineer",
    capacityFte: "0.800",
    salary: 72000,
  },
  {
    seedId: 403,
    name: "James Wilson",
    email: "james@example.test",
    jobTitle: "Data analyst",
    capacityFte: "1.000",
    salary: 84000,
  },
  {
    seedId: 404,
    name: "Nora Chen",
    email: "nora@example.test",
    jobTitle: "Frontend engineer",
    capacityFte: "1.000",
    salary: 102000,
  },
  {
    seedId: 405,
    name: "Leo Martinez",
    email: "leo@example.test",
    jobTitle: "UX researcher",
    capacityFte: "0.800",
    salary: 80000,
  },
  {
    seedId: 406,
    name: "Priya Shah",
    email: "priya@example.test",
    jobTitle: "Product manager",
    capacityFte: "1.000",
    salary: 110000,
  },
  {
    seedId: 407,
    name: "Sam Taylor",
    email: "sam@example.test",
    jobTitle: "DevOps engineer",
    capacityFte: "1.000",
    salary: 120000,
  },
];
const extraPersonRows = extraPeople.map(({ seedId, salary, ...person }) => ({
  id: id(seedId),
  ...person,
  createdAt,
}));
const extraSalaryRows = extraPeople.map((person) => ({
  id: id(600 + person.seedId - 400),
  personId: id(person.seedId),
  annualLoadedSalary: person.salary.toFixed(2),
  validFrom: "2026-08-01",
  validTo: null,
}));

const extraAgentRows = [
  {
    id: id(500),
    name: "Relay",
    description: "Documentation and project reporting",
    createdAt,
  },
  {
    id: id(501),
    name: "Ledger",
    description: "Cost analysis and budget research",
    createdAt,
  },
  {
    id: id(502),
    name: "Beacon",
    description: "Customer feedback and sentiment analysis",
    createdAt,
  },
  {
    id: id(503),
    name: "Sentinel",
    description: "Test automation and quality checks",
    createdAt,
  },
  {
    id: id(504),
    name: "Compass",
    description: "Planning and requirements analysis",
    createdAt,
  },
  {
    id: id(505),
    name: "Forge",
    description: "Feature implementation and code review",
    createdAt,
  },
];

// Sienna, Maya and Ethan are completely unassigned. These five other people
// have changing commitments, leaving 0.3–0.7 FTE available across a full project.
const extraAssignmentRows: NewPersonAssignment[] = [
  {
    id: id(700),
    projectId: id(4),
    personId: id(403),
    fte: "0.400",
    startsOn: "2026-08-01",
    endsOn: "2026-09-01",
    createdAt,
  },
  {
    id: id(701),
    projectId: id(4),
    personId: id(403),
    fte: "0.600",
    startsOn: "2026-09-01",
    endsOn: "2026-10-01",
    createdAt,
  },
  {
    id: id(702),
    projectId: id(4),
    personId: id(403),
    fte: "0.200",
    startsOn: "2026-10-01",
    endsOn: "2026-12-01",
    createdAt,
  },
  {
    id: id(703),
    projectId: id(4),
    personId: id(404),
    fte: "0.300",
    startsOn: "2026-08-01",
    endsOn: "2026-12-01",
    createdAt,
  },
  {
    id: id(704),
    projectId: id(5),
    personId: id(405),
    fte: "0.200",
    startsOn: "2026-08-01",
    endsOn: "2026-09-01",
    createdAt,
  },
  {
    id: id(705),
    projectId: id(5),
    personId: id(405),
    fte: "0.400",
    startsOn: "2026-09-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(706),
    projectId: id(5),
    personId: id(406),
    fte: "0.500",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
  {
    id: id(707),
    projectId: id(4),
    personId: id(406),
    fte: "0.200",
    startsOn: "2026-09-01",
    endsOn: "2026-12-01",
    createdAt,
  },
  {
    id: id(708),
    projectId: id(4),
    personId: id(407),
    fte: "0.200",
    startsOn: "2026-08-01",
    endsOn: "2026-09-01",
    createdAt,
  },
  {
    id: id(709),
    projectId: id(4),
    personId: id(407),
    fte: "0.400",
    startsOn: "2026-09-01",
    endsOn: "2026-12-01",
    createdAt,
  },
  {
    id: id(710),
    projectId: id(5),
    personId: id(407),
    fte: "0.200",
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
];
const extraAgentAssignments = [
  {
    id: id(800),
    projectId: id(4),
    agentId: id(502),
    startsOn: "2026-08-01",
    endsOn: "2026-12-01",
    createdAt,
  },
  {
    id: id(801),
    projectId: id(5),
    agentId: id(503),
    startsOn: "2026-08-01",
    endsOn: "2026-11-01",
    createdAt,
  },
];
const extraCostRows: NewAiCost[] = [];
const extraTaskRows: NewTask[] = [];

for (const [periodIndex, period] of periods.entries()) {
  const activePeople = [
    ...new Map(
      extraAssignmentRows
        .filter((a) => a.startsOn < period.endsOn && a.endsOn > period.startsOn)
        .map((a) => [`${a.projectId}:${a.personId}`, a]),
    ).values(),
  ];
  const activeAgents = extraAgentAssignments.filter(
    (a) => a.startsOn < period.endsOn && a.endsOn > period.startsOn,
  );
  const owners = [
    ...activePeople.map((a) => ({
      projectId: a.projectId,
      personId: a.personId!,
      agentId: null,
    })),
    ...activeAgents.map((a) => ({
      projectId: a.projectId,
      personId: null,
      agentId: a.agentId,
    })),
  ];
  for (const owner of owners) {
    const resourceNumber = Number(
      (owner.personId || owner.agentId)!.slice(-12),
    );
    const projectNumber = Number(owner.projectId.slice(-12));
    // IDs derive from owner + project + period rather than array positions.
    const key =
      periodIndex * 100000 + resourceNumber * 100 + projectNumber * 10;
    for (const [providerIndex, provider] of providerRows.entries()) {
      const isSeat = owner.personId !== null && provider.code === "openai";
      const amount =
        owner.personId !== null
          ? isSeat
            ? 10
            : 18 + (resourceNumber - 400) * 2 + periodIndex * 12
          : (provider.code === "openai" ? 45 : 90) +
            (resourceNumber - 500) * 5 +
            periodIndex * 20;
      extraCostRows.push({
        id: id(1000000 + key + providerIndex),
        ...owner,
        providerId: provider.id,
        kind: isSeat ? "seat" : "usage",
        amount: amount.toFixed(6),
        startsOn: period.startsOn,
        endsOn: period.endsOn,
        attributionNote: isSeat
          ? "Illustrative project-attributed share of a provider seat."
          : null,
      });
    }
    for (let n = 0; n < period.completedPerOwner; n++) {
      const type =
        taskTypeRows[
          (resourceNumber + projectNumber + n) % taskTypeRows.length
        ];
      const taskId = id(2000000 + key + n);
      extraTaskRows.push({
        id: taskId,
        externalId: `demo-task-${taskId}`,
        ...owner,
        taskTypeId: type.id,
        title: `${period.label} ${type.name.toLowerCase()} ${resourceNumber}.${n + 1}`,
        status: "completed",
        completedAt: new Date(`2026-${period.month}-${10 + n * 5}T12:00:00Z`),
        createdAt,
      });
    }
  }
}
for (const project of extraProjectRows) {
  const projectNumber = Number(project.id.slice(-12));
  extraTaskRows.push(
    {
      id: id(3000000 + projectNumber * 10),
      externalId: `${project.externalId}-backlog`,
      projectId: project.id,
      taskTypeId: id(40),
      title: "Plan the next milestone",
      status: "todo",
      createdAt,
    },
    {
      id: id(3000001 + projectNumber * 10),
      externalId: `${project.externalId}-in-progress`,
      projectId: project.id,
      taskTypeId: id(42),
      title: "Review the current milestone",
      status: "in_progress",
      createdAt,
    },
  );
}

async function seed() {
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(projects)
        .values([...projectRows, ...extraProjectRows])
        .onConflictDoNothing();
      await tx
        .insert(people)
        .values([...personRows, ...extraPersonRows])
        .onConflictDoNothing();
      await tx
        .insert(agents)
        .values([...agentRows, ...extraAgentRows])
        .onConflictDoNothing();
      await tx.insert(aiProviders).values(providerRows).onConflictDoNothing();
      await tx.insert(taskTypes).values(taskTypeRows).onConflictDoNothing();
      await tx
        .insert(salaryRates)
        .values([...salaryRows, ...extraSalaryRows])
        .onConflictDoNothing();
      await tx
        .insert(personAssignments)
        .values([...assignmentRows, ...extraAssignmentRows])
        .onConflictDoNothing();
      await tx
        .insert(agentAssignments)
        .values([...agentAssignmentRows, ...extraAgentAssignments])
        .onConflictDoNothing();
      await tx
        .insert(aiCosts)
        .values([...costRows, ...extraCostRows])
        .onConflictDoNothing();
      await tx
        .insert(tasks)
        .values([...taskRows, ...extraTaskRows])
        .onConflictDoNothing();
    });
    console.log(
      `Seed complete: ${projectRows.length + extraProjectRows.length} projects, ${personRows.length + extraPersonRows.length} people, ${agentRows.length + extraAgentRows.length} agents, ${costRows.length + extraCostRows.length} AI costs and ${taskRows.length + extraTaskRows.length} tasks (August/September 2026). Existing seed rows were preserved.`,
    );
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
