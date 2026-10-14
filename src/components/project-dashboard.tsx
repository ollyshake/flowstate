"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Database,
  FolderKanban,
  Info,
  Layers2,
  Search,
  Users,
  Plus,
  Check,
} from "lucide-react";
import { AddResources } from "@/components/add-resources";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  dateLabel,
  lastIncludedDate,
  money,
  monthLabel,
  number,
  type DashboardReport,
  type ResourceRow,
} from "@/lib/reporting";

function Help({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="help-icon" aria-label="Explain this metric">
          <Info size={13} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="metric-tooltip">{children}</TooltipContent>
    </Tooltip>
  );
}
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return <span className="avatar sage">{initials}</span>;
}
function Delta({
  value,
  inverse = false,
}: {
  value: number | null;
  inverse?: boolean;
}) {
  if (value === null) return <span className="no-baseline">No baseline</span>;
  const good = inverse ? value <= 0 : value >= 0;
  const Icon = value < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={`delta ${good ? "positive" : "negative"}`}>
      <Icon size={13} />
      {number(Math.abs(value) * 100)}%
    </span>
  );
}
function sum(
  rows: ResourceRow[],
  field: "salary" | "ai" | "total" | "pu" | "fte",
) {
  return rows.reduce((total, row) => total + row[field], 0);
}
function ResourceTable({
  rows,
  agents = false,
  query,
}: {
  rows: ResourceRow[];
  agents?: boolean;
  query: string;
}) {
  const filtered = rows.filter((row) =>
    `${row.name} ${row.role} ${row.providers.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const total = sum(rows, "total"),
    pu = sum(rows, "pu");
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{agents ? "Agent" : "Person"}</th>
              {agents ? (
                <th>Providers</th>
              ) : (
                <>
                  <th>
                    Allocation
                    <Help>
                      Average project FTE over the selected calendar month,
                      weighted by days assigned.
                    </Help>
                  </th>
                  <th>
                    Salary cost
                    <Help>
                      Loaded annual salary × FTE × assigned days ÷ calendar days
                      in that year. Changes in salary or FTE are calculated
                      separately.
                    </Help>
                  </th>
                </>
              )}
              <th>AI spend</th>
              {!agents && <th>Total cost</th>}
              <th>PUs delivered</th>
              <th>Cost / PU</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="person-cell">
                    {agents ? (
                      <span className="avatar agent-avatar sage">
                        <Bot size={18} />
                      </span>
                    ) : (
                      <Avatar name={row.name} />
                    )}
                    <div>
                      <strong>{row.name}</strong>
                      <span>{row.role}</span>
                    </div>
                  </div>
                </td>
                {agents ? (
                  <td className="providers-cell">
                    {row.providers.join(", ") || "—"}
                  </td>
                ) : (
                  <>
                    <td>
                      <div className="fte-cell">
                        <span>
                          {number(row.fte, 3)}
                          <small>FTE</small>
                        </span>
                        <i>
                          <b
                            style={{
                              width: `${Math.min(100, row.fte * 100)}%`,
                            }}
                          />
                        </i>
                      </div>
                    </td>
                    <td>{money(row.salary, 2)}</td>
                  </>
                )}
                <td className="subtle-cell">{money(row.ai, 2)}</td>
                {!agents && (
                  <td className="strong-cell">{money(row.total, 2)}</td>
                )}
                <td>{number(row.pu, 3)}</td>
                <td>{money(row.costPerPU, 2)}</td>
              </tr>
            ))}
          </tbody>
          {!query && (
            <tfoot>
              <tr>
                <td>{agents ? "Agents total" : "People total"}</td>
                {agents ? (
                  <td>
                    {rows.length} {rows.length === 1 ? "agent" : "agents"}
                  </td>
                ) : (
                  <>
                    <td>{number(sum(rows, "fte"), 3)} FTE</td>
                    <td>{money(sum(rows, "salary"), 2)}</td>
                  </>
                )}
                <td>{money(sum(rows, "ai"), 2)}</td>
                {!agents && <td>{money(total, 2)}</td>}
                <td>{number(pu, 3)}</td>
                <td>{money(pu > 0 ? total / pu : null, 2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!filtered.length && (
        <div className="empty-state">
          {query
            ? `No resources match “${query}”.`
            : `No ${agents ? "agents" : "people"} assigned or credited in this period.`}
        </div>
      )}
    </>
  );
}
export function ProjectDashboard({ report: r }: { report: DashboardReport }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resourceTab, setResourceTab] = useState("people");
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const c = r.current;
  const previousLabel = monthLabel(r.previousMonth);
  const shortMonth = new Date(`${r.month}-01T00:00:00Z`).toLocaleDateString(
    "en-GB",
    { month: "short", timeZone: "UTC" },
  );
  function navigate(project: string, month?: string) {
    const params = new URLSearchParams({ project });
    if (month) params.set("month", month);
    startTransition(() => router.push(`/?${params}`, { scroll: false }));
  }
  return (
    <TooltipProvider delayDuration={200}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link
            className="brand"
            href="/"
            prefetch={false}
            aria-label="Flowstate home"
          >
            <span className="brand-symbol">
              <Layers2 size={23} />
            </span>
            flowstate<span className="brand-dot">.</span>
          </Link>
          <div className="workspace">
            <span className="workspace-icon">
              <Database size={15} />
            </span>
            <div>
              <strong>Project workspace</strong>
              <span>Local PostgreSQL</span>
            </div>
            <span className="workspace-dot" />
          </div>
          <div className="nav-label">PROJECTS</div>
          <nav className="project-nav" aria-label="Projects">
            {r.projects.map((project) => (
              <button
                key={project.id}
                disabled={pending}
                aria-current={project.id === r.project.id ? "page" : undefined}
                className={`project-link ${project.id === r.project.id ? "selected" : ""}`}
                onClick={() => navigate(project.id)}
              >
                <span className="project-dot sage" />
                {project.name}
              </button>
            ))}
          </nav>
          <label className="mobile-project-select">
            <span className="sr-only">Project</span>
            <select
              aria-label="Project"
              disabled={pending}
              value={r.project.id}
              onChange={(e) => navigate(e.target.value)}
            >
              {r.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <span>Projects</span>
              <ChevronRight size={14} />
              <strong>{r.project.name}</strong>
            </div>
          </header>
          <main
            className={`dashboard ${pending ? "is-loading" : ""}`}
            id="project-top"
            aria-busy={pending}
          >
            <div className="project-heading">
              <div className="project-title-group">
                <div className="project-icon sage">
                  <FolderKanban size={26} />
                </div>
                <div>
                  <h1>{r.project.name}</h1>
                  <p>Project overview</p>
                </div>
              </div>
              <Button className="add-button" onClick={() => setAddOpen(true)}>
                <Plus size={16} />
                Add resources
              </Button>
            </div>
            <div className="project-meta">
              <span>
                <CalendarDays size={14} />
                {dateLabel(r.project.startsOn)} –{" "}
                {dateLabel(lastIncludedDate(r.project.endsOn))}
              </span>
              <span className="meta-divider" />
              <span>
                {c.people.length} people <span className="meta-dot">·</span>{" "}
                {c.agents.length} {c.agents.length === 1 ? "agent" : "agents"}{" "}
                in this period
              </span>
            </div>
            <div className="overview-toolbar">
              <div className="section-tab">Overview</div>
              <label className="period-select">
                <CalendarDays size={14} />
                <select
                  aria-label="Reporting period"
                  value={r.month}
                  disabled={pending}
                  onChange={(e) => navigate(r.project.id, e.target.value)}
                >
                  {r.months.map((month) => (
                    <option key={month} value={month}>
                      {monthLabel(month)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </label>
            </div>
            <div className="summary-heading">
              <h2>Project costs</h2>
              <span>Compared with {previousLabel}</span>
            </div>
            <section className="metrics-grid" aria-label="Project metrics">
              <article className="metric-card">
                <div className="metric-label">
                  Total cost
                  <Help>
                    People cost + AI cost for {monthLabel(r.month)}. Salary and
                    AI charge intervals are prorated by actual days.
                  </Help>
                </div>
                <div className="metric-value">{money(c.total)}</div>
                <div className="metric-foot">
                  {money(c.salary)} people{" "}
                  <span className="muted">+ {money(c.ai)} AI</span>
                </div>
                <div className="cost-split">
                  <span
                    style={{
                      width: `${c.total > 0 ? (c.salary / c.total) * 100 : 0}%`,
                    }}
                  />
                  <span />
                </div>
              </article>
              <article className="metric-card">
                <div className="metric-label">
                  AI cost
                  <Help>
                    All provider seat and usage charges attributed to this
                    project’s people and agents.
                  </Help>
                </div>
                <div className="metric-value">{money(c.ai)}</div>
                <div className="metric-foot">
                  {money(Math.abs(r.aiChange))}{" "}
                  {r.aiChange < 0 ? "less" : "more"} than previous month
                </div>
                <div className="mini-provider">
                  {c.providers.join(" · ") || "No AI charges"}
                </div>
              </article>
              <article className="metric-card">
                <div className="metric-label">
                  Forecasted cost
                  <Help>
                    Accrued project cost through the end of the selected month,
                    plus remaining project days at that month’s daily cost rate.
                    This is an estimate.
                  </Help>
                </div>
                <div className="metric-value">{money(r.forecast)}</div>
                <div className="metric-foot">Estimated full-project cost</div>
                <div className="budget-caption">
                  Based on {shortMonth} daily spend
                </div>
              </article>
              <article className="metric-card">
                <div className="metric-label">
                  Current progress
                  <Help>
                    Currently completed tasks ÷ all non-cancelled project tasks.
                    This is the current project state; cost and PU figures use
                    the selected month.
                  </Help>
                </div>
                <div className="metric-value">
                  {number(r.progress === null ? null : r.progress * 100)}
                  <span className="value-unit">
                    {r.progress === null ? "" : "%"}
                  </span>
                </div>
                <div className="metric-foot">
                  {r.completed} of {r.taskCount} tasks completed
                </div>
                <div className="progress-track">
                  <span style={{ width: `${(r.progress || 0) * 100}%` }} />
                </div>
              </article>
            </section>
            <div className="performance-grid">
              <section className="panel performance-card">
                <div className="panel-heading">
                  <div>
                    <h2>Productivity</h2>
                    <p>Completed work during {monthLabel(r.month)}</p>
                  </div>
                  <Help>
                    PUs = task type standard effort × impact weight. Completed
                    work that was reopened earns no PUs.
                  </Help>
                </div>
                <div className="output-metrics">
                  <div>
                    <span className="output-label">Productive Units</span>
                    <div>
                      <strong>{number(c.pu, 3)}</strong>
                      <Delta value={r.puChange} />
                    </div>
                  </div>
                  <span className="vertical-rule" />
                  <div>
                    <span className="output-label">Cost per PU</span>
                    <div>
                      <strong>{money(c.costPerPU, 2)}</strong>
                      <Delta value={r.costChange} inverse />
                    </div>
                  </div>
                </div>
                <div className="performance-note">
                  <span>
                    {number(c.fte, 3)} average FTE this month ·{" "}
                    {number(r.previous.fte, 3)} previous month
                  </span>
                </div>
              </section>
              <section className="panel performance-card capacity-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Capacity created</h2>
                    <p>Compared with {previousLabel}</p>
                  </div>
                  <Help>
                    Calculated using the previous month’s PUs per FTE, following
                    REQUIREMENTS.md. These are estimates of equivalent people
                    capacity and cost.
                  </Help>
                </div>
                <div className="output-metrics">
                  <div>
                    <span className="output-label">Equivalent capacity</span>
                    <div>
                      <strong>{number(r.capacity, 2)}</strong>
                      <span className="capacity-unit">FTE</span>
                    </div>
                  </div>
                  <span className="vertical-rule" />
                  <div>
                    <span className="output-label">Cost avoided</span>
                    <div>
                      <strong>{money(r.avoided)}</strong>
                    </div>
                  </div>
                </div>
                <div className="performance-note">
                  <p>
                    {r.capacity === null
                      ? "No previous productivity baseline is available."
                      : r.capacity < 0
                        ? "Negative capacity indicates a productivity shortfall against the previous month."
                        : "Extra output compared with the previous month’s productivity per FTE."}
                  </p>
                  <p>Cost avoided is an estimate, rather than a cash saving.</p>
                </div>
              </section>
            </div>
            <section className="panel resources-panel" id="resources">
              <div className="resource-heading">
                <div>
                  <h2>Project resources</h2>
                  <p>People and agents for {r.project.name}.</p>
                </div>
                <span className="resource-period">{monthLabel(r.month)}</span>
              </div>
              {notice && (
                <p className="resource-notice" role="status">
                  <Check size={14} />
                  {notice}
                </p>
              )}
              <Tabs
                value={resourceTab}
                onValueChange={(value) => {
                  setResourceTab(value);
                  setQuery("");
                }}
              >
                <div className="resource-toolbar">
                  <TabsList
                    className="resource-tabs"
                    aria-label="Resource type"
                  >
                    <TabsTrigger value="people">
                      <Users size={14} />
                      People<span>{c.people.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="agents">
                      <Bot size={15} />
                      Agents<span>{c.agents.length}</span>
                    </TabsTrigger>
                  </TabsList>
                  <label className="search-field">
                    <Search size={14} />
                    <input
                      aria-label={`Search ${resourceTab}`}
                      placeholder={`Search ${resourceTab}…`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>
                <TabsContent value="people" className="table-content">
                  <ResourceTable rows={c.people} query={query} />
                </TabsContent>
                <TabsContent value="agents" className="table-content">
                  <ResourceTable rows={c.agents} agents query={query} />
                </TabsContent>
              </Tabs>
            </section>
            <footer className="page-footer">
              <span>Calculated from PostgreSQL on each overview request</span>
              <span>USD · {monthLabel(r.month)}</span>
            </footer>
          </main>
        </div>
      </div>
      <AddResources
        projectId={r.project.id}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={(people, agents) => {
          setResourceTab(people ? "people" : "agents");
          setQuery("");
          setNotice(
            `${people + agents} ${people + agents === 1 ? "resource" : "resources"} added to ${r.project.name}.`,
          );
          router.refresh();
        }}
      />
    </TooltipProvider>
  );
}
