"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Bot,
  CalendarDays,
  Check,
  LoaderCircle,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { dateLabel, lastIncludedDate, number } from "@/lib/reporting";
import {
  alreadyAssigned,
  monthlyAvailability,
  remainingCapacity,
  type ResourceOptions,
} from "@/lib/resources";
import {
  addProjectResources,
  getResourceOptions,
} from "@/server/resources/actions";

export function AddResources({
  projectId,
  open,
  onOpenChange,
  onAdded,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (people: number, agents: number) => void;
}) {
  const [options, setOptions] = useState<ResourceOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("people");
  const [query, setQuery] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<Record<string, number>>(
    {},
  );
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [saving, startSaving] = useTransition();
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setOptions(null);
    setSelectedPeople({});
    setSelectedAgents([]);
    setQuery("");
    setTab("people");
    getResourceOptions(projectId)
      .then((result) => {
        if (!active) return;
        if (result.ok) setOptions(result.options);
        else setError(result.error);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError(
            "Unable to load resources. Try closing and reopening this dialog.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, projectId]);
  const count = Object.keys(selectedPeople).length + selectedAgents.length;
  function save() {
    setError("");
    startSaving(async () => {
      try {
        const result = await addProjectResources({
          projectId,
          people: Object.entries(selectedPeople).map(([id, fte]) => ({
            id,
            fte,
          })),
          agents: selectedAgents,
        });
        if (result.ok) {
          onAdded(result.peopleAdded, result.agentsAdded);
          onOpenChange(false);
          return;
        }
        setError(result.error);
        // Refresh availability after a rejected save; retain choices for review.
        const refreshed = await getResourceOptions(projectId);
        if (refreshed.ok) setOptions(refreshed.options);
      } catch {
        setError(
          "Unable to save resources. Please check the connection and try again.",
        );
      }
    });
  }
  const matches = (name: string, role: string) =>
    `${name} ${role}`.toLowerCase().includes(query.toLowerCase());
  const invalidSelection =
    options &&
    (options.people.some(
      (person) =>
        person.id in selectedPeople &&
        (alreadyAssigned(person, options.project) ||
          Math.round(selectedPeople[person.id] * 1000) >
            Math.round(
              remainingCapacity(
                person,
                options.project.startsOn,
                options.project.endsOn,
              ) * 1000,
            )),
    ) ||
      options.agents.some(
        (agent) =>
          selectedAgents.includes(agent.id) &&
          agent.projectIds.includes(options.project.id),
      ));
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value);
      }}
    >
      <DialogContent
        className="add-resource-dialog"
        showCloseButton={!saving}
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Add resources</DialogTitle>
          <DialogDescription>
            {options
              ? `Add people and agents to ${options.project.name}.`
              : "Loading project resources…"}
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="resource-loading" role="status">
            <LoaderCircle size={18} className="animate-spin" />
            Loading availability…
          </div>
        )}
        {error && (
          <p className="resource-error" role="alert">
            {error}
          </p>
        )}
        {options && (
          <>
            <div className="allocation-timeframe">
              <CalendarDays size={15} />
              <span>Project timeframe</span>
              <strong>
                {dateLabel(options.project.startsOn)} –{" "}
                {dateLabel(lastIncludedDate(options.project.endsOn))}
              </strong>
            </div>
            <p className="assignment-scope">
              New assignments cover these project dates.
            </p>
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value);
                setQuery("");
              }}
            >
              <div className="picker-toolbar">
                <TabsList className="resource-tabs">
                  <TabsTrigger value="people" disabled={saving}>
                    <Users size={15} />
                    People
                  </TabsTrigger>
                  <TabsTrigger value="agents" disabled={saving}>
                    <Bot size={15} />
                    Agents
                  </TabsTrigger>
                </TabsList>
                <label className="search-field">
                  <Search size={14} />
                  <input
                    aria-label="Search available resources"
                    placeholder="Search resources…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    disabled={saving}
                  />
                </label>
              </div>
              <TabsContent value="people">
                <p className="availability-intro">
                  Availability shows the least free capacity in each month.
                  Select a person to set their allocation.
                </p>
                <div className="allocation-legend">
                  <span>
                    <i className="committed-swatch" />
                    Committed
                  </span>
                  <span>
                    <i className="new-swatch" />
                    New allocation
                  </span>
                  <span>
                    <i className="available-swatch" />
                    Available
                  </span>
                </div>
                <div className="candidate-list">
                  {options.people
                    .filter((person) => matches(person.name, person.role))
                    .map((person) => {
                      const max = remainingCapacity(
                        person,
                        options.project.startsOn,
                        options.project.endsOn,
                      );
                      const assigned = alreadyAssigned(person, options.project);
                      const selected = person.id in selectedPeople;
                      const fte = selectedPeople[person.id] || 0;
                      const overCapacity =
                        selected &&
                        Math.round(fte * 1000) > Math.round(max * 1000);
                      const months = monthlyAvailability(
                        person,
                        options.project,
                      );
                      const projectNames = [
                        ...new Set(
                          person.commitments.map((c) => c.projectName),
                        ),
                      ];
                      return (
                        <div
                          key={person.id}
                          className={`candidate ${selected ? "is-selected" : ""}`}
                        >
                          <button
                            className="candidate-select"
                            aria-pressed={selected}
                            disabled={
                              saving || (!selected && (assigned || max < 0.001))
                            }
                            onClick={() =>
                              setSelectedPeople((previous) => {
                                const next = { ...previous };
                                if (selected) delete next[person.id];
                                else next[person.id] = Math.min(0.2, max);
                                return next;
                              })
                            }
                          >
                            <span
                              className={`checkbox ${selected ? "checked" : ""}`}
                            >
                              {selected && <Check size={12} />}
                            </span>
                            <span className="avatar sage">
                              {person.name
                                .split(" ")
                                .map((p) => p[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <span className="candidate-name">
                              <strong>{person.name}</strong>
                              <span>
                                {person.role} · {number(person.capacityFte, 3)}{" "}
                                FTE capacity
                              </span>
                            </span>
                            <span
                              className={`availability-badge ${assigned || max < 0.001 ? "fully-booked" : ""}`}
                            >
                              {assigned
                                ? "Already on project"
                                : max < 0.001
                                  ? "Fully allocated"
                                  : `${number(max, 3)} FTE available`}
                            </span>
                          </button>
                          <div
                            className="candidate-timeline"
                            style={{
                              gridTemplateColumns: `repeat(${months.length},minmax(65px,1fr))`,
                            }}
                          >
                            {months.map((month) => {
                              const proposed = selected ? fte : 0;
                              const free = Math.max(
                                0,
                                month.available - proposed,
                              );
                              return (
                                <div key={month.month}>
                                  <span>
                                    {new Date(
                                      month.start + "T00:00:00Z",
                                    ).toLocaleDateString("en-GB", {
                                      month: "short",
                                      timeZone: "UTC",
                                    })}
                                  </span>
                                  <div
                                    className="allocation-bar"
                                    role="img"
                                    aria-label={`${month.month}: ${number(month.committed, 3)} FTE committed, ${number(proposed, 3)} FTE proposed, ${number(free, 3)} FTE available out of ${number(person.capacityFte, 3)} FTE capacity`}
                                  >
                                    <i
                                      className="committed-segment"
                                      style={{
                                        width: `${person.capacityFte ? (month.committed / person.capacityFte) * 100 : 0}%`,
                                      }}
                                    />
                                    <i
                                      className="new-segment"
                                      style={{
                                        width: `${person.capacityFte ? (Math.min(proposed, month.available) / person.capacityFte) * 100 : 0}%`,
                                      }}
                                    />
                                  </div>
                                  <small>{number(free, 3)} FTE free</small>
                                </div>
                              );
                            })}
                          </div>
                          <div className="candidate-context">
                            {projectNames.length
                              ? `Committed to ${projectNames.join(", ")}`
                              : "No existing project commitments"}
                          </div>
                          {selected && (
                            <div className="allocation-control">
                              <div>
                                <label id={`allocation-${person.id}`}>
                                  Project allocation
                                </label>
                                <strong>{number(fte, 3)} FTE</strong>
                              </div>
                              <Slider
                                aria-labelledby={`allocation-${person.id}`}
                                min={0.001}
                                max={Math.max(0.001, max)}
                                step={0.001}
                                value={[Math.min(fte, Math.max(0.001, max))]}
                                disabled={saving || assigned || max < 0.001}
                                onValueChange={(values) =>
                                  setSelectedPeople((previous) => ({
                                    ...previous,
                                    [person.id]: Number(values[0].toFixed(3)),
                                  }))
                                }
                              />
                              <div className="allocation-entry">
                                <label htmlFor={`fte-${person.id}`}>FTE</label>
                                <input
                                  id={`fte-${person.id}`}
                                  type="number"
                                  min={0.001}
                                  max={max}
                                  step={0.001}
                                  value={fte}
                                  disabled={saving}
                                  aria-invalid={overCapacity}
                                  onChange={(event) => {
                                    const value = Number(event.target.value);
                                    setSelectedPeople((previous) => ({
                                      ...previous,
                                      [person.id]: Number.isFinite(value)
                                        ? value
                                        : 0,
                                    }));
                                  }}
                                />
                                <span>
                                  Up to {number(max, 3)} FTE throughout the
                                  project
                                </span>
                              </div>
                              {overCapacity && (
                                <p className="allocation-warning">
                                  This allocation exceeds the latest
                                  availability. Reduce it or deselect this
                                  person.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {!options.people.some((person) =>
                    matches(person.name, person.role),
                  ) && (
                    <div className="empty-state">
                      No people match your search.
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="agents">
                <p className="agent-picker-note">
                  Agents can work across multiple projects and do not need an
                  FTE allocation.
                </p>
                <div className="candidate-list">
                  {options.agents
                    .filter((agent) => matches(agent.name, agent.role))
                    .map((agent) => {
                      const assigned = agent.projectIds.includes(
                        options.project.id,
                      );
                      const selected = selectedAgents.includes(agent.id);
                      return (
                        <button
                          key={agent.id}
                          className={`agent-candidate ${selected ? "is-selected" : ""}`}
                          aria-pressed={selected}
                          disabled={saving || (assigned && !selected)}
                          onClick={() =>
                            setSelectedAgents((previous) =>
                              selected
                                ? previous.filter((id) => id !== agent.id)
                                : [...previous, agent.id],
                            )
                          }
                        >
                          <span
                            className={`checkbox ${selected ? "checked" : ""}`}
                          >
                            {selected && <Check size={12} />}
                          </span>
                          <span className="avatar agent-avatar sage">
                            <Bot size={18} />
                          </span>
                          <span className="candidate-name">
                            <strong>{agent.name}</strong>
                            <span>{agent.role}</span>
                          </span>
                          {assigned && (
                            <span className="availability-badge fully-booked">
                              Already on project
                            </span>
                          )}
                        </button>
                      );
                    })}
                  {!options.agents.some((agent) =>
                    matches(agent.name, agent.role),
                  ) && (
                    <div className="empty-state">
                      No agents match your search.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            <div className="picker-footer">
              <div>
                <strong>
                  {count ? `${count} selected` : "Select people or agents"}
                </strong>
                <span>Assignments are saved to this project.</span>
              </div>
              <Button
                disabled={
                  !count ||
                  saving ||
                  invalidSelection ||
                  Object.values(selectedPeople).some(
                    (fte) =>
                      fte < 0.001 ||
                      fte > 1 ||
                      Math.abs(fte * 1000 - Math.round(fte * 1000)) > 1e-7,
                  )
                }
                onClick={save}
              >
                {saving ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}{" "}
                {saving
                  ? "Saving…"
                  : `Add ${count || ""} ${count === 1 ? "resource" : "resources"}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
