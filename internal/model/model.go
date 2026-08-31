package model

import "time"

type Status string

const (
	Pending   Status = "pending"
	Running   Status = "running"
	Completed Status = "completed"
	Failed    Status = "failed"
	Cancelled Status = "cancelled"
	Skipped   Status = "skipped"
)

type Domain string

const (
	Frontend Domain = "frontend"
	Backend  Domain = "backend"
	Shared   Domain = "shared"
	QA       Domain = "qa"
)

type Agent string

const (
	ClaudeCode Agent = "claude-code"
	Codex      Agent = "codex"
	OpenCode   Agent = "opencode"
)

type Run struct {
	ID, SpecPath         string
	Status               Status
	CreatedAt, UpdatedAt time.Time
}
type Task struct {
	ID, RunID, Title, Description, Agent, Model, WorktreePath, BranchName string
	Domain                                                                Domain
	Status                                                                Status
	Metadata                                                              string
	AttemptCount                                                          int
	ExitCode, DurationMs                                                  *int
	CheckStatus                                                           string
	CreatedAt, UpdatedAt                                                  time.Time
}
type Log struct {
	ID, TaskID, Stream, Content string
	CreatedAt                   time.Time
}
type PlannedTask struct {
	ID, RunID, Title, Description, BranchName string
	Domain                                    Domain
	Agent                                     Agent
	Model                                     string
	Status                                    Status
	DependsOn                                 []string
}
