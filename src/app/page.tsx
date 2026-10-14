import { notFound } from "next/navigation";
import { ProjectDashboard } from "@/components/project-dashboard";
import {
  getDashboardReport,
  InvalidReportSelection,
} from "@/server/reporting/dashboard";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const project =
    typeof params.project === "string" ? params.project : undefined;
  const month = typeof params.month === "string" ? params.month : undefined;
  let report;
  try {
    report = await getDashboardReport(project, month);
  } catch (error) {
    if (error instanceof InvalidReportSelection) notFound();
    console.error(
      "Dashboard reporting failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return (
      <main className="database-message">
        <h1>Unable to load project data</h1>
        <p>
          Check that PostgreSQL is running and DATABASE_URL is configured.
          Active assignments also need complete, non-overlapping salary rates.
        </p>
        <p>For local setup, run:</p>
        <pre>
          npm run db:up{"\n"}npm run db:migrate{"\n"}npm run db:seed
        </pre>
        <a href="/">Try again</a>
      </main>
    );
  }
  if (!report)
    return (
      <main className="database-message">
        <h1>No projects yet</h1>
        <p>
          The database is connected but has no projects. Load the sample records
          with:
        </p>
        <pre>npm run db:seed</pre>
        <a href="/">Reload projects</a>
      </main>
    );
  return (
    <ProjectDashboard
      key={`${report.project.id}-${report.month}`}
      report={report}
    />
  );
}
