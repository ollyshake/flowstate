# FlowState task

## To run:

```sh
npm ci
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open [localhost:3000](http://localhost:3000). 

Docker retains data between runs; `npm run db:down` stops the container without deleting its data. The seed runs skips existing rows with IDs, so running it again preserves edits.

```
npm run db:studio
```
Open https://local.drizzle.studio/
For drizzle db studio


## Checks

```sh
npm run typecheck
npm test
```

Tests are for math caculations

## Schema and key decisions

- **Projects, people and agents** have separate tables . Dated assignment tables link resources to projects, people have FTE allocations and agents do not.
- **Salary rates** are dated annual loaded costs per 1.0 FTE. New salary or allocation rows  allow for salarty history.
- **AI costs** link a provider (anthropic or openai), project and exactly one person or agent. Shared charges must be split explicitly so each row is counted once. Monetary values are stored as PostgreSQL decimals, and all  in USD.
- **Tasks** belong to a project and a versioned task type (seperate table). A completed task is for one person or agents - for now its setup so one person per task , but this could be changed with a juntion table and extra joins. PUs equal the task type's standard effort multiplied by its impact weight. Task types could have probably also been an enum on tasks.
- **Calculations** are calculated on the server from a consistent db snapshot when a project/month is opened or refreshed. Table tabs and search reuse the report. 


## Next

- Allow creation of more projects , people , agents rather thhan just assignment
- Add Some figures
- Possibly add an AI powered analytics section , feeding stats to an to add explainability to results
- FastAPI backend :)
