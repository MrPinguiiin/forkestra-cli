package planner

import (
	"bufio"
	"crypto/sha1"
	"encoding/hex"
	"os"
	"strings"

	"github.com/forkestra-cli/forkestra/internal/model"
)

func Load(path string) ([]model.PlannedTask, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var tasks []model.PlannedTask
	scanner := bufio.NewScanner(f)
	var title, body string
	flush := func() {
		if title == "" || strings.TrimSpace(body) == "" {
			return
		}
		domain := domainFor(title)
		id := string(domain) + "-" + hash(title)[:8]
		tasks = append(tasks, model.PlannedTask{ID: id, Title: title, Description: strings.TrimSpace(body), Domain: domain, Agent: model.OpenCode, Model: "anthropic/claude-sonnet-4", Status: model.Pending, BranchName: "feature/" + id})
		title = ""
		body = ""
	}
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#") {
			flush()
			title = strings.TrimSpace(strings.TrimLeft(line, "#"))
		} else if title != "" {
			body += line + "\n"
		}
	}
	flush()
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	for _, t := range tasks {
		if strings.Contains(strings.ToLower(t.Title), "api contract") {
			for i := range tasks {
				if tasks[i].Domain == model.Frontend && tasks[i].ID != t.ID {
					tasks[i].DependsOn = append(tasks[i].DependsOn, t.ID)
				}
			}
		}
	}
	return tasks, nil
}
func domainFor(title string) model.Domain {
	s := strings.ToLower(title)
	switch {
	case strings.Contains(s, "frontend") || strings.Contains(s, "ui") || strings.Contains(s, "tui"):
		return model.Frontend
	case strings.Contains(s, "backend") || strings.Contains(s, "api") || strings.Contains(s, "database") || strings.Contains(s, "server"):
		return model.Backend
	case strings.Contains(s, "test") || strings.Contains(s, "qa") || strings.Contains(s, "verification"):
		return model.QA
	default:
		return model.Shared
	}
}
func hash(s string) string { h := sha1.Sum([]byte(s)); return hex.EncodeToString(h[:]) }
func Format(tasks []model.PlannedTask) string {
	var lines []string
	for _, t := range tasks {
		lines = append(lines, t.ID+" ["+string(t.Domain)+"] "+t.Title+" -> "+string(t.Agent)+":"+t.Model)
	}
	return strings.Join(lines, "\n")
}
