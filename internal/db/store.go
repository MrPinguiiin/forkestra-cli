package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/forkestra-cli/forkestra/internal/model"
	_ "modernc.org/sqlite"
)

var ErrNotFound = sql.ErrNoRows

type Store struct{ DB *sql.DB }

func Open(path string) (*Store, error) {
	if path == "" {
		path = os.Getenv("DATABASE_URL")
	}
	if path == "" {
		path = filepath.Join("packages", "db", "local.db")
	}
	if len(path) > 5 && path[:5] == "file:" {
		path = path[5:]
	}
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	return &Store{DB: conn}, nil
}

func (s *Store) Close() error { return s.DB.Close() }
func (s *Store) EnsureSchema() error {
	_, err := s.DB.Exec(`CREATE TABLE IF NOT EXISTS run (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), spec_path TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000), updated_at INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000));
CREATE TABLE IF NOT EXISTS task (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), run_id TEXT REFERENCES run(id) ON DELETE CASCADE, domain TEXT NOT NULL, title TEXT NOT NULL, description TEXT, agent TEXT, model TEXT, status TEXT NOT NULL DEFAULT 'pending', worktree_path TEXT, branch_name TEXT, metadata TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, exit_code INTEGER, duration_ms INTEGER, check_status TEXT NOT NULL DEFAULT 'not-run', created_at INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000), updated_at INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000));
CREATE TABLE IF NOT EXISTS task_log (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE, stream TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000));`)
	return err
}
func (s *Store) LatestRun() (*model.Run, error) {
	row := s.DB.QueryRow(`SELECT id,spec_path,status,created_at,updated_at FROM run ORDER BY created_at DESC LIMIT 1`)
	return scanRun(row)
}
func (s *Store) CreateRun(spec string) (*model.Run, error) {
	row := s.DB.QueryRow(`INSERT INTO run(spec_path) VALUES (?) RETURNING id,spec_path,status,created_at,updated_at`, spec)
	return scanRun(row)
}
func (s *Store) InsertPlannedTasks(runID string, planned []model.PlannedTask) error {
	for _, item := range planned {
		metadata, err := json.Marshal(map[string]any{"plannedId": item.ID, "dependsOn": item.DependsOn})
		if err != nil {
			return err
		}
		if _, err := s.DB.Exec(`INSERT INTO task(run_id,domain,title,description,agent,model,status,branch_name,metadata) VALUES (?,?,?,?,?,?,?,?,?)`, runID, item.Domain, item.Title, item.Description, item.Agent, item.Model, item.Status, item.BranchName, string(metadata)); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) Tasks(runID string) ([]model.Task, error) {
	rows, err := s.DB.Query(`SELECT id,coalesce(run_id,''),domain,title,coalesce(description,''),coalesce(agent,''),coalesce(model,''),status,coalesce(worktree_path,''),coalesce(branch_name,''),coalesce(metadata,''),attempt_count,exit_code,duration_ms,check_status,created_at,updated_at FROM task WHERE run_id=? ORDER BY created_at`, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Task
	for rows.Next() {
		var t model.Task
		var created, updated int64
		if err := rows.Scan(&t.ID, &t.RunID, &t.Domain, &t.Title, &t.Description, &t.Agent, &t.Model, &t.Status, &t.WorktreePath, &t.BranchName, &t.Metadata, &t.AttemptCount, &t.ExitCode, &t.DurationMs, &t.CheckStatus, &created, &updated); err != nil {
			return nil, err
		}
		t.CreatedAt = time.UnixMilli(created)
		t.UpdatedAt = time.UnixMilli(updated)
		out = append(out, t)
	}
	return out, rows.Err()
}
func (s *Store) UpdateTask(id string, title, description string) error {
	_, err := s.DB.Exec(`UPDATE task SET title=?,description=?,updated_at=? WHERE id=?`, title, description, time.Now().UnixMilli(), id)
	return err
}
func (s *Store) DeleteTask(id string) error {
	_, err := s.DB.Exec(`DELETE FROM task WHERE id=?`, id)
	return err
}
func (s *Store) AddTask(runID string, domain model.Domain, title, description string) error {
	_, err := s.DB.Exec(`INSERT INTO task(run_id,domain,title,description,agent,model,status,branch_name) VALUES (?,?,?,?,?,?,?,?)`, runID, domain, title, description, model.OpenCode, "anthropic/claude-sonnet-4", model.Pending, "feature/"+slug(title))
	return err
}
func (s *Store) SetTaskCLI(id string, agent model.Agent, modelName string) error {
	_, err := s.DB.Exec(`UPDATE task SET agent=?,model=?,updated_at=? WHERE id=?`, agent, modelName, time.Now().UnixMilli(), id)
	return err
}
func (s *Store) SetRunStatus(id string, status model.Status) error {
	_, err := s.DB.Exec(`UPDATE run SET status=?,updated_at=? WHERE id=?`, status, time.Now().UnixMilli(), id)
	return err
}
func (s *Store) SetTaskStatus(id string, status model.Status) error {
	_, err := s.DB.Exec(`UPDATE task SET status=?,updated_at=? WHERE id=?`, status, time.Now().UnixMilli(), id)
	return err
}
func (s *Store) Logs(taskID string) ([]model.Log, error) {
	rows, err := s.DB.Query(`SELECT id,task_id,stream,content,created_at FROM task_log WHERE task_id=? ORDER BY created_at LIMIT 200`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Log
	for rows.Next() {
		var l model.Log
		var created int64
		if err := rows.Scan(&l.ID, &l.TaskID, &l.Stream, &l.Content, &created); err != nil {
			return nil, err
		}
		l.CreatedAt = time.UnixMilli(created)
		out = append(out, l)
	}
	return out, rows.Err()
}
func scanRun(row *sql.Row) (*model.Run, error) {
	var r model.Run
	var created, updated int64
	if err := row.Scan(&r.ID, &r.SpecPath, &r.Status, &created, &updated); err != nil {
		return nil, err
	}
	r.CreatedAt = time.UnixMilli(created)
	r.UpdatedAt = time.UnixMilli(updated)
	return &r, nil
}
func slug(v string) string {
	b, _ := json.Marshal(v)
	_ = b
	out := ""
	for _, r := range v {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' {
			out += string(r)
		} else if out != "" && out[len(out)-1] != '-' {
			out += "-"
		}
	}
	if out == "" {
		return "task"
	}
	return out
}

var _ = fmt.Sprintf
