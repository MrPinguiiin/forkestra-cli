package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/forkestra-cli/forkestra/internal/db"
	"github.com/forkestra-cli/forkestra/internal/model"
)

type Model struct {
	store         *db.Store
	run           *model.Run
	tasks         []model.Task
	logs          []model.Log
	selected      int
	taskMode      bool
	input         textinput.Model
	notice        string
	width, height int
}
type refreshMsg struct{}

func New(store *db.Store, run *model.Run) Model {
	input := textinput.New()
	input.Prompt = "> "
	input.Placeholder = "/help"
	input.Focus()
	return Model{store: store, run: run, input: input, notice: "/cli agent [model] | /run | /task on|close|add|edit|delete"}
}
func (m Model) Init() tea.Cmd { return tea.Batch(textinput.Blink, refresh) }
func refresh() tea.Msg        { return refreshMsg{} }
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" || msg.String() == "q" {
			return m, tea.Quit
		}
		if msg.String() == "up" || msg.String() == "k" {
			if m.selected > 0 {
				m.selected--
			}
		}
		if msg.String() == "down" || msg.String() == "j" {
			if m.selected < len(m.tasks)-1 {
				m.selected++
			}
		}
		if msg.String() == "enter" {
			value := m.input.Value()
			m.input.Reset()
			m.handle(value)
			return m, refresh
		}
		var cmd tea.Cmd
		m.input, cmd = m.input.Update(msg)
		return m, cmd
	case refreshMsg:
		m.tasks, _ = m.store.Tasks(m.run.ID)
		if len(m.tasks) > 0 {
			if m.selected >= len(m.tasks) {
				m.selected = len(m.tasks) - 1
			}
			m.logs, _ = m.store.Logs(m.tasks[m.selected].ID)
		}
		return m, tea.Tick(500*time.Millisecond, func(time.Time) tea.Msg { return refreshMsg{} })
	}
	return m, nil
}
func (m *Model) handle(value string) {
	p := strings.Fields(value)
	if len(p) == 0 {
		return
	}
	switch p[0] {
	case "/help":
		m.notice = "/cli agent [model] | /run | /task on|close|add|edit|delete"
	case "/cli":
		if len(p) < 2 || m.selected >= len(m.tasks) {
			m.notice = "Usage: /cli claude-code|codex|opencode [model]"
			return
		}
		agent := model.Agent(p[1])
		if agent != model.ClaudeCode && agent != model.Codex && agent != model.OpenCode {
			m.notice = "Unsupported CLI"
			return
		}
		name := "anthropic/claude-sonnet-4"
		if len(p) > 2 {
			name = p[2]
		}
		_ = m.store.SetTaskCLI(m.tasks[m.selected].ID, agent, name)
		m.notice = "CLI updated"
	case "/run":
		if m.taskMode {
			m.notice = "Close task mode before running"
		} else {
			m.notice = "Run queued (use CLI run for execution)"
		}
	case "/task":
		m.taskCommand(p[1:])
	default:
		m.notice = "Unknown command"
	}
}
func (m *Model) taskCommand(p []string) {
	if len(p) == 0 {
		return
	}
	switch p[0] {
	case "on":
		m.taskMode = true
		m.notice = "Task mode ON"
	case "close", "off":
		m.taskMode = false
		m.notice = "Task mode OFF"
	default:
		if !m.taskMode {
			m.notice = "Enable task mode first"
			return
		}
		switch p[0] {
		case "add":
			if len(p) < 4 {
				m.notice = "Usage: /task add <domain> <title> <description>"
				return
			}
			if err := m.store.AddTask(m.run.ID, model.Domain(p[1]), p[2], strings.Join(p[3:], " ")); err != nil {
				m.notice = err.Error()
			} else {
				m.notice = "Task added"
			}
		case "edit":
			if len(p) < 3 || m.selected >= len(m.tasks) {
				m.notice = "Usage: /task edit <title> <description>"
				return
			}
			if err := m.store.UpdateTask(m.tasks[m.selected].ID, p[1], strings.Join(p[2:], " ")); err != nil {
				m.notice = err.Error()
			} else {
				m.notice = "Task updated"
			}
		case "delete":
			if m.selected >= len(m.tasks) {
				m.notice = "No task selected"
				return
			}
			if err := m.store.DeleteTask(m.tasks[m.selected].ID); err != nil {
				m.notice = err.Error()
			} else {
				m.notice = "Task deleted"
			}
		default:
			m.notice = "Use add, edit, delete, or close"
		}
	}
}
func (m Model) View() string {
	left := ""
	for i, t := range m.tasks {
		mark := " "
		if i == m.selected {
			mark = ">"
		}
		left += fmt.Sprintf("%s [%s] %s\n", mark, t.Status, t.Title)
	}
	if left == "" {
		left = "No tasks\n"
	}
	detail := "No task selected"
	if len(m.tasks) > 0 {
		t := m.tasks[m.selected]
		detail = fmt.Sprintf("id: %s\nstatus: %s\ndomain: %s\ncli: %s\nmodel: %s\nbranch: %s", t.ID, t.Status, t.Domain, t.Agent, t.Model, t.BranchName)
	}
	log := "No logs"
	if len(m.logs) > 0 {
		var lines []string
		for _, l := range m.logs {
			lines = append(lines, "["+l.Stream+"] "+l.Content)
		}
		log = strings.Join(lines, "\n")
	}
	panel := func(title, content string) string {
		return lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).Padding(0, 1).Width(max(20, m.width/3)).Height(max(5, m.height/2)).Render(title + "\n" + content)
	}
	return lipgloss.JoinVertical(lipgloss.Left, lipgloss.NewStyle().Bold(true).Render("Forkestra  run "+m.run.ID+"  "+string(m.run.Status)), lipgloss.JoinHorizontal(lipgloss.Top, panel("Tasks", left), panel("Task detail", detail)), panel("Live output", log), m.input.View()+"\n"+m.notice)
}
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
