package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/forkestra-cli/forkestra/internal/db"
	"github.com/forkestra-cli/forkestra/internal/model"
	"github.com/forkestra-cli/forkestra/internal/planner"
	"github.com/forkestra-cli/forkestra/internal/runner"
	"github.com/forkestra-cli/forkestra/internal/tui"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{Use: "forkestra", Short: "Multi-agent coding orchestrator"}
	root.AddCommand(planCommand(), runCommand(), statusCommand(), tuiCommand(), configCommand())
	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func openStore() (*db.Store, error) {
	store, err := db.Open(os.Getenv("DATABASE_URL"))
	if err != nil {
		return nil, err
	}
	if err := store.EnsureSchema(); err != nil {
		store.Close()
		return nil, err
	}
	return store, nil
}

func planCommand() *cobra.Command {
	return &cobra.Command{Use: "plan <spec>", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		tasks, err := planner.Load(args[0])
		if err != nil {
			return err
		}
		fmt.Fprintln(cmd.OutOrStdout(), planner.Format(tasks))
		return nil
	}}
}

func runCommand() *cobra.Command {
	var execute, dryRun bool
	cmd := &cobra.Command{Use: "run <spec>", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		store, err := openStore()
		if err != nil {
			return err
		}
		defer store.Close()
		planned, err := planner.Load(args[0])
		if err != nil {
			return err
		}
		run, err := store.CreateRun(args[0])
		if err != nil {
			return err
		}
		if err := store.InsertPlannedTasks(run.ID, planned); err != nil {
			return err
		}
		fmt.Fprintf(cmd.OutOrStdout(), "run %s\n%s\n", run.ID, planner.Format(planned))
		if dryRun || !execute {
			if dryRun {
				fmt.Fprintln(cmd.OutOrStdout(), "dry run complete")
			}
			return nil
		}
		return runner.Execute(store, run.ID, filepath.Dir(args[0]), planned)
	}}
	cmd.Flags().BoolVar(&execute, "execute", false, "Execute agent commands")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Persist and validate without executing")
	return cmd
}

func statusCommand() *cobra.Command {
	return &cobra.Command{Use: "status", RunE: func(cmd *cobra.Command, _ []string) error {
		store, err := openStore()
		if err != nil {
			return err
		}
		defer store.Close()
		run, err := store.LatestRun()
		if err != nil {
			if errors.Is(err, db.ErrNotFound) {
				return nil
			}
			return err
		}
		fmt.Fprintf(cmd.OutOrStdout(), "%s %s %s\n", run.ID, run.Status, run.SpecPath)
		for _, task := range mustTasks(store, run.ID) {
			fmt.Fprintf(cmd.OutOrStdout(), "  %s [%s] %s\n", task.ID, task.Status, task.Title)
		}
		return nil
	}}
}

func mustTasks(store *db.Store, runID string) []model.Task {
	tasks, _ := store.Tasks(runID)
	return tasks
}

func tuiCommand() *cobra.Command {
	return &cobra.Command{Use: "tui", RunE: func(cmd *cobra.Command, _ []string) error {
		store, err := openStore()
		if err != nil {
			return err
		}
		defer store.Close()
		run, err := store.LatestRun()
		if err != nil {
			if !errors.Is(err, db.ErrNotFound) {
				return err
			}
			run, err = store.CreateRun("tui-task-mode")
		}
		if err != nil {
			return err
		}
		_, err = tea.NewProgram(tui.New(store, run), tea.WithAltScreen()).Run()
		return err
	}}
}

func configCommand() *cobra.Command {
	cmd := &cobra.Command{Use: "config"}
	cmd.AddCommand(&cobra.Command{Use: "models", Run: func(cmd *cobra.Command, _ []string) { fmt.Fprintln(cmd.OutOrStdout(), "claude-code, codex, opencode") }})
	cmd.AddCommand(&cobra.Command{Use: "preset <name>", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, _ := json.MarshalIndent(map[string]string{"name": args[0]}, "", "  ")
		fmt.Fprintln(cmd.OutOrStdout(), string(b))
		return nil
	}})
	cmd.AddCommand(&cobra.Command{Use: "version", Run: func(cmd *cobra.Command, _ []string) { fmt.Fprintln(cmd.OutOrStdout(), "0.1.0") }})
	_ = strconv.Itoa
	_ = strings.TrimSpace
	return cmd
}
