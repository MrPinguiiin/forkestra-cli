# DESIGN.md — Multi-Agent Vibe Coding CLI Orchestrator

## 1. Overview

Forkestra CLI adalah orchestrator terminal-first yang menjalankan beberapa AI coding CLI agent (Claude Code, Codex CLI, OpenCode) untuk mengerjakan task berdasarkan satu file spesifikasi markdown (`design.md`).

User menulis kebutuhan sistem dalam satu file markdown, Forkestra mem-parse section, memecahnya menjadi task granular, menyimpan run/task state ke Turso/SQLite, lalu menjalankan agent yang dipilih dengan progress yang bisa ditampilkan di CLI/TUI. Hono + tRPC disediakan sebagai HTTP API opsional untuk dashboard web di masa depan.

## 2. Goals & Non-Goals

### Goals

- Menerima satu file `design.md` sebagai input spesifikasi.
- Memecah spesifikasi menjadi task granular dengan planner deterministic v0.
- Menjalankan AI CLI agent: Claude Code, Codex CLI, OpenCode.
- Mendukung pemilihan tool CLI dan model AI per domain task.
- Menyimpan run, task, preset, dan log ke Turso/SQLite via Drizzle.
- Memberikan live progress ke terminal/TUI.
- Menyiapkan branch/worktree per task untuk review manusia.

### Non-Goals (v1)

- Tidak otomatis deploy production.
- Tidak menyelesaikan konflik semantik kompleks antar agent.
- Tidak membangun model AI sendiri.
- Tidak mewajibkan dashboard web; Hono/tRPC hanya API opsional.

## 3. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    Forkestra CLI/TUI                    │
│          (Bun + Commander + OpenTUI optional)            │
│                                                         │
│   ┌───────────┐     ┌─────────────┐     ┌─────────────┐ │
│   │ Parser/   │────▶│   Planner   │────▶│ Scheduler/  │ │
│   │ Loader    │     │ task split  │     │ Dispatcher  │ │
│   │ remark    │     │ deterministic│    │ Bun.spawn   │ │
│   └───────────┘     └─────────────┘     └──────┬──────┘ │
│                                                 │        │
│              ┌──────────────────────────────────┤        │
│              ▼                  ▼               ▼        │
│      ┌──────────────┐   ┌──────────────┐ ┌──────────────┐│
│      │ Agent Runner │   │ Agent Runner │ │ Agent Runner ││
│      │ Frontend/TUI │   │ Backend/API  │ │ QA/Shared    ││
│      │ git worktree │   │ git worktree │ │ git worktree ││
│      │ OpenCode     │   │ Claude/Codex │ │ OpenCode     ││
│      └──────┬───────┘   └──────┬───────┘ └──────┬───────┘│
│             │                  │                │        │
│             ▼                  ▼                ▼        │
│      ┌────────────────────────────────────────────────┐  │
│      │      Result Collector / Logs / Status DB        │  │
│      │       Turso/SQLite + Drizzle + task logs         │  │
│      └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

Optional API: apps/server = Hono + tRPC for run/task dashboard.
```

## 4. Components

### 4.1 CLI Command Layer

Commander.js menyediakan command utama:

- `forkestra plan <design.md>`: parse spec dan tampilkan task.
- `forkestra run <design.md>`: buat run/task di DB; optional execute agent.
- `forkestra run <design.md> --dry-run`: validasi planning dan scheduling tanpa memanggil agent.
- `forkestra run <design.md> --execute --worktree`: jalankan agent dengan worktree terisolasi.
- `forkestra status`: tampilkan run/task terakhir.
- `forkestra tui`: placeholder entrypoint untuk OpenTUI status interface.
- `forkestra config`: tampilkan konfigurasi runtime.

### 4.2 Parser / Loader

- Membaca `design.md`.
- Menggunakan `unified` + `remark-parse` untuk markdown AST.
- Mengekstrak heading dan raw section content.
- Output: `SpecDocument`.

### 4.3 Planner

- Mengubah `SpecDocument` menjadi daftar `PlannedTask`.
- v0 deterministic berbasis heading:
  - `Frontend`, `UI`, `TUI` → `frontend`
  - `Backend`, `API`, `Database`, `Server` → `backend`
  - `QA`, `Test`, `Verification` → `qa`
  - sisanya → `shared`
- Jika ada section `API Contract`, task frontend bergantung pada task tersebut.

### 4.4 Agent & Model Selection

- Default v0 memakai OpenCode untuk semua domain.
- Field task menyimpan `agent` dan `model`.
- Preset disimpan di DB sebagai JSON mapping domain ke agent/model.
- v0.5 dapat mengambil daftar model dinamis dari command seperti `opencode models`.

### 4.5 Scheduler / Dispatcher

- Menerima daftar task dan menghitung dependency graph.
- Task tanpa dependency dijalankan paralel (`Promise.all` per batch).
- Task dengan dependency dijalankan setelah dependency-nya selesai.
- Jika dependency gagal, task downstream di-skip.
- Membuat git worktree per task jika `--worktree` diaktifkan:
  - `git worktree add <workspace>/task-<id> -b feature/<task-id>`
- Menjalankan validasi CLI tools sebelum eksekusi via `which`.

### 4.6 Agent Runner

- Wrapper proses memakai `Bun.spawn()`.
- Command target:
  - Claude Code: `claude -p "<prompt>" --model <model> --output-format json`
  - Codex CLI: `codex exec "<prompt>" --model <model>`
  - OpenCode: `opencode run --agent <domain-agent> -m <provider>/<model> "<prompt>"`
- stdout/stderr distream ke DB `task_log`.
- Menangani timeout, exit code, dan status task.

### 4.7 Progress Stream / TUI

- OpenTUI menjadi UI terminal utama.
- v0 minimal: CLI output biasa.
- v0.4: panel task status + log stream multi-pane.
- Hono/tRPC dapat diekspos ke dashboard web di masa depan.

### 4.8 Result Collector / Merger

- Setelah task selesai, jalankan lint/test sesuai konfigurasi project target.
- Commit hasil task branch.
- PR creation via GitHub/GitLab API bersifat opsional untuk v1.
- Summary report berisi task sukses/gagal, model, agent, branch, dan log path.

## 5. Data Model

```ts
export type SpecDocument = {
  path: string;
  raw: string;
  sections: SpecSection[];
};

export type PlannedTask = {
  id: string;
  runId?: string;
  domain: "frontend" | "backend" | "shared" | "qa";
  title: string;
  description: string;
  dependsOn: string[];
  agent: "claude-code" | "codex" | "opencode";
  model: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  branchName: string;
  worktreePath?: string;
};
```

Drizzle tables:

- `run`: satu eksekusi dari satu spec file.
- `task`: task per run, domain, agent, model, branch, status.
- `task_log`: stdout/stderr per task.
- `agent_preset`: preset agent/model per domain.

## 6. Execution Flow

1. User menjalankan `forkestra plan docs/DESIGN.md` atau `forkestra run docs/DESIGN.md`.
2. Parser mengekstrak markdown sections.
3. Planner membuat daftar task deterministic.
4. CLI menyimpan `run` dan `task` ke Turso/SQLite.
5. Jika `--execute` dipakai, Agent Runner menjalankan CLI agent via `Bun.spawn()`.
6. stdout/stderr disimpan ke `task_log` dan ditampilkan ke terminal/TUI.
7. Status task diperbarui: pending → running → completed/failed.
8. Result collector dapat membuat commit/branch/PR jika mode itu diaktifkan.

## 7. Tech Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Runtime | Bun | Startup cepat, native TS, `Bun.spawn()`, bisa compile binary |
| CLI | Commander.js | Command tree sederhana dan stabil |
| TUI | OpenTUI | Terminal UI terintegrasi dengan Better-T-Stack addon |
| Backend API opsional | Hono + tRPC | Ringan, type-safe, siap untuk dashboard web |
| Markdown parser | unified + remark-parse | AST markdown matang dan fleksibel |
| Storage state | Turso/SQLite | Ringan untuk CLI lokal, tetap bisa sync remote nanti |
| ORM | Drizzle | Ringan dan cocok untuk SQLite/Turso |
| Isolasi workspace | Git worktree | Menghindari konflik antar agent |
| Process runner | Bun.spawn() | Streaming stdout/stderr native |
| Lint/format | Biome | Cepat untuk TypeScript |
| Monorepo | Turborepo | Cache build/typecheck antar package |

## 8. Konfigurasi Model per Tool

| Tool | Cara Override Model per Task | Contoh |
|---|---|---|
| OpenCode | `-m`/`--model`, atau named agent | `opencode run --agent backend-agent -m anthropic/claude-opus-4 "prompt"` |
| Claude Code | `--model` di headless mode | `claude -p "prompt" --model claude-opus-4` |
| Codex CLI | `--model` di `codex exec` | `codex exec "prompt" --model gpt-5.2` |

Contoh `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4",
  "agent": {
    "backend-agent": { "model": "anthropic/claude-opus-4" },
    "frontend-agent": { "model": "openai/gpt-5.2" },
    "qa-agent": { "model": "anthropic/claude-sonnet-4" }
  }
}
```

## 9. Risks & Mitigations

| Risiko | Mitigasi |
|---|---|
| Task frontend/backend saling bergantung tanpa kontrak jelas | Wajibkan `API Contract`, jadikan dependency frontend |
| Rate limit/cost provider | Tambahkan concurrency limit per provider |
| Output agent tidak konsisten | Jalankan lint/format/test pasca-generate |
| Agent crash | Timeout, retry, task log checkpoint |
| Merge conflict | Git worktree per task + review manual |
| Model mahal dipakai untuk task sederhana | Preset default + rekomendasi model berdasarkan domain |

## 10. Roadmap

1. **v0.1** — CLI `plan`, `run`, `status`, parser markdown, planner deterministic.
2. **v0.2** — Agent runner untuk Claude Code, Codex CLI, OpenCode.
3. **v0.3** — Git worktree automation dan dependency-aware scheduler.
4. **v0.4** — OpenTUI live progress + log panels.
5. **v0.5** — Model selector dinamis dan preset management.
6. **v1.0** — Auto PR creation, test integration, summary report.
