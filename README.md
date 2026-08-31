# Forkestra

Forkestra is a cross-platform multi-agent coding orchestrator written entirely in Go. It uses Bubble Tea for the terminal UI and SQLite for local run/task state.

## Requirements

- Go 1.22 or newer
- Git
- Optional agent CLIs: `claude`, `codex`, or `opencode`

## Install and run

```bash
go build -o forkestra ./cmd/forkestra
./forkestra tui
```

On Windows:

```powershell
go build -o forkestra.exe ./cmd/forkestra
.\forkestra.exe tui
```

The database defaults to `packages/db/local.db` for compatibility with existing local data. Override it with `DATABASE_URL`, for example:

```bash
DATABASE_URL=/absolute/path/forkestra.db ./forkestra tui
```

## Commands

```bash
forkestra plan docs/DESIGN.md
forkestra run docs/DESIGN.md --dry-run
forkestra run docs/DESIGN.md --execute
forkestra status
forkestra tui
forkestra config models
```

The Bubble Tea TUI supports keyboard navigation and a command input:

- `/cli opencode [model]` changes the selected task's agent and model.
- `/run` starts execution when task mode is closed.
- `/task on` opens task mode.
- `/task add <domain> <title> <description>` adds a task.
- `/task edit <title> <description>` edits the selected task.
- `/task delete` deletes the selected task.
- `/task close` exits task mode.

While task mode is active, execution is blocked. Press `q` or `Ctrl-C` to exit.

## Development

```bash
go test ./...
go vet ./...
go build ./cmd/forkestra
GOOS=linux GOARCH=amd64 go build ./cmd/forkestra
GOOS=windows GOARCH=amd64 go build ./cmd/forkestra
GOOS=darwin GOARCH=arm64 go build ./cmd/forkestra
```

## Project structure

```text
cmd/forkestra/       CLI entrypoint
internal/model/      Domain types
internal/db/         SQLite persistence
internal/planner/    Markdown task planner
internal/runner/     Agent process runner
internal/tui/        Bubble Tea interface
docs/                Design and implementation documentation
go.mod               Go dependencies
go.sum               Dependency checksums
```
