package runner

import (
	"fmt"
	"github.com/forkestra-cli/forkestra/internal/db"
	"github.com/forkestra-cli/forkestra/internal/model"
	"os/exec"
)

func Execute(store *db.Store, runID, cwd string, planned []model.PlannedTask) error {
	if err := store.SetRunStatus(runID, model.Running); err != nil {
		return err
	}
	for _, task := range planned {
		if err := store.SetTaskStatus(task.ID, model.Running); err != nil {
			return err
		}
		command, args := commandFor(task)
		process := exec.Command(command, args...)
		process.Dir = cwd
		output, err := process.CombinedOutput()
		if len(output) > 0 {
			_, _ = store.DB.Exec(`INSERT INTO task_log(task_id,stream,content) VALUES (?,?,?)`, task.ID, "stdout", string(output))
		}
		status := model.Completed
		if err != nil {
			status = model.Failed
		}
		if updateErr := store.SetTaskStatus(task.ID, status); updateErr != nil {
			return updateErr
		}
		if err != nil {
			_ = store.SetRunStatus(runID, model.Failed)
			return fmt.Errorf("%s: %w", task.ID, err)
		}
	}
	return store.SetRunStatus(runID, model.Completed)
}
func commandFor(task model.PlannedTask) (string, []string) {
	prompt := task.Title + "\n\n" + task.Description
	switch task.Agent {
	case model.ClaudeCode:
		return "claude", []string{"-p", prompt}
	case model.Codex:
		return "codex", []string{"exec", prompt}
	default:
		return "opencode", []string{"run", prompt}
	}
}
