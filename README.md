# forkestra-cli

Forkestra CLI is a terminal-first multi-agent coding orchestrator. It parses a markdown spec, creates deterministic task plans, stores run state in Turso/SQLite, and can dispatch coding agents such as Claude Code, Codex CLI, and OpenCode.

## Stack

- **Runtime:** Bun
- **CLI:** Commander.js
- **TUI:** OpenTUI
- **Optional API:** Hono + tRPC
- **Database:** Turso/SQLite
- **ORM:** Drizzle
- **Markdown parser:** unified + remark-parse
- **Monorepo:** Turborepo
- **Linting:** Biome

## Getting Started

Install dependencies:

```bash
bun install
```

Create or update `apps/server/.env`:

```bash
DATABASE_URL=file:/absolute/path/to/forkestra-cli/packages/db/local.db
DATABASE_AUTH_TOKEN=
CORS_ORIGIN=http://localhost:3000
```

Apply the database schema:

```bash
bun run db:push
```

## CLI Usage

Plan tasks from a spec file:

```bash
bun packages/cli/src/index.ts plan docs/DESIGN.md
```

Create a run and persist tasks:

```bash
bun packages/cli/src/index.ts run docs/DESIGN.md
```

Validate the execution schedule without calling agents:

```bash
bun packages/cli/src/index.ts run docs/DESIGN.md --dry-run
```

Execute agents, optionally with isolated worktrees:

```bash
bun packages/cli/src/index.ts run docs/DESIGN.md --execute --worktree --repo /path/to/project --workspace-root /path/to/worktrees
```

Show recent runs:

```bash
bun packages/cli/src/index.ts status
```

Show runtime config:

```bash
bun packages/cli/src/index.ts config
```

Compile the CLI binary:

```bash
bun run compile:cli
```

The binary is generated at:

```bash
packages/cli/forkestra
```

## Optional API Server

Run the Hono/tRPC server:

```bash
bun run dev:server
```

Available tRPC procedures include:

- `healthCheck`
- `runs`
- `tasksByRun`

## Project Structure

```text
forkestra-cli/
├── apps/
│   ├── fumadocs/      # Documentation app
│   └── server/        # Optional Hono + tRPC API
├── docs/
│   └── DESIGN.md      # Product/architecture design source
├── packages/
│   ├── api/           # tRPC routers
│   ├── cli/           # Commander CLI entrypoint
│   ├── core/          # Parser, planner, agent runner, git worktree utils
│   ├── db/            # Drizzle schema and migrations
│   ├── env/           # Runtime env validation
│   └── config/        # Shared TypeScript config
```

## Available Scripts

- `bun run dev`: Start all apps through Turborepo
- `bun run build`: Build all apps/packages
- `bun run lint`: Run Biome lint on source/config files
- `bun run format`: Format source/config files with Biome
- `bun run check-types`: Check TypeScript types
- `bun run compile:cli`: Compile the CLI binary
- `bun run compile:server`: Compile the server binary
- `bun run dev:server`: Start only the API server
- `bun run db:push`: Push schema changes to Turso/SQLite
- `bun run db:generate`: Generate Drizzle migrations
- `bun run db:migrate`: Run Drizzle migrations
- `bun run db:studio`: Open Drizzle Studio
- `bun run db:local`: Start local Turso dev database

## Roadmap

- v0.1: CLI planning, persisted runs, deterministic markdown planner
- v0.2: Agent execution for Claude Code, Codex CLI, and OpenCode
- v0.3: Git worktree automation and dependency-aware scheduling
- v0.4: OpenTUI live progress UI
- v0.5: Dynamic model selector and reusable presets
- v1.0: PR creation, test integration, and run summary reports
