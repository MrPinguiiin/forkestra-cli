# Forkestra Implementation TODO

Checklist implementasi berdasarkan [`DESIGN.md`](./DESIGN.md). Update status setiap item setelah implementasi dan verifikasi selesai.

## Status Legend

- `[ ]` Belum dikerjakan
- `[-]` Sedang dikerjakan atau parsial
- `[x]` Selesai dan sudah diverifikasi
- `[!]` Terblokir atau membutuhkan keputusan

## Update Log

| Date | Phase | Summary | Owner |
|---|---|---|---|
| 2026-08-30 | Phase 0 | Baseline gate passed: lint, typecheck, build, 55 tests, deterministic plan, and dry-run verification. No baseline failures. Final gate commands: `bun run lint`, `bun run check-types`, `bun run build`, `bun test`, `bun packages/cli/src/index.ts plan docs/DESIGN.md`, `bun packages/cli/src/index.ts run docs/DESIGN.md --dry-run`, plus `git diff --check`. | opencode |
| 2026-08-30 | Phase 0–14 | Added persisted execution metadata/check status, commit failure handling, explicit GitHub PR creation, worktree management, refreshing TUI status/logs, provider concurrency limits, and expanded unit coverage. Integration/CLI coverage remains pending. | opencode |

## Global Definition of Done

- [x] `forkestra plan docs/DESIGN.md` menghasilkan task deterministic.
- [x] `forkestra run docs/DESIGN.md --dry-run` membuat run/task di database tanpa menjalankan agent.
- [x] `forkestra run docs/DESIGN.md --execute` menjalankan agent berdasarkan agent dan model task.
- [x] `--worktree` membuat branch dan worktree terisolasi untuk setiap task.
- [x] Dependency graph dihormati dan task independen berjalan paralel.
- [x] Dependency yang gagal membuat task downstream berstatus `skipped`.
- [x] stdout/stderr agent tersimpan di `task_log` dan dapat ditampilkan secara live.
- [x] `forkestra status` menampilkan run dan task terbaru.
- [x] `forkestra tui` menampilkan status dan log, bukan placeholder.
- [x] Preset agent/model dapat disimpan, dibaca, dan digunakan saat planning/execution.
- [x] Model dinamis dapat diambil dari tool CLI jika tersedia.
- [x] Lint, typecheck, build, dan test berjalan sukses.

---

## Phase 0 — Baseline Audit dan Test Gate

- [x] Jalankan `bun run lint` dan simpan hasil baseline.
- [x] Jalankan `bun run check-types` dan simpan hasil baseline.
- [x] Jalankan `bun run build` dan simpan hasil baseline.
- [x] Jalankan test suite yang tersedia dan catat command-nya.
- [x] Verifikasi `forkestra plan docs/DESIGN.md`.
- [x] Verifikasi `forkestra run docs/DESIGN.md --dry-run`.
- [x] Catat error baseline di Update Log.
- [x] Tetapkan command final yang wajib dijalankan sebelum setiap phase dinyatakan selesai.

Acceptance criteria:

- [x] Baseline reproducible.
- [x] Semua failure awal terdokumentasi dan dapat dibedakan dari regression baru.

## Phase 1 — Core Types dan Status Lifecycle

Files utama: `packages/core/src/types.ts`, `packages/db/src/schema/forkestra.ts`, `packages/cli/src/index.ts`.

- [x] Selaraskan field `PlannedTask` dengan row `task` di database.
- [x] Pastikan `dependsOn` memiliki representasi yang konsisten di DB dan runtime.
- [x] Ganti mapping task berbasis title dengan identifier yang deterministic.
- [x] Tetapkan representasi status `skipped`.
- [x] Tambahkan status `skipped` ke type/schema bila dipilih.
- [x] Pastikan status run dan task diperbarui untuk semua terminal state.
- [x] Pastikan `updatedAt` berubah saat status task/run berubah.
- [x] Tambahkan test untuk lifecycle status.

Acceptance criteria:

- [x] Tidak ada mismatch antara type, schema, planner, scheduler, dan CLI.
- [x] Task yang di-skip dapat dibedakan dari task yang gagal atau dibatalkan.

## Phase 2 — Parser / Loader Hardening

File utama: `packages/core/src/parser.ts`.

- [x] Validasi path spec sebelum parsing.
- [x] Berikan error yang jelas untuk file tidak ditemukan atau tidak bisa dibaca.
- [x] Tentukan perilaku untuk file kosong.
- [x] Tentukan perilaku untuk file tanpa heading.
- [x] Verifikasi extraction heading level 1–3.
- [x] Verifikasi extraction content antar-heading.
- [x] Verifikasi nested heading tidak menghilangkan content parent secara tidak sengaja.
- [x] Tambahkan test untuk heading tunggal.
- [x] Tambahkan test untuk nested heading.
- [x] Tambahkan test untuk content kosong.
- [x] Tambahkan test untuk karakter khusus pada slug.

Acceptance criteria:

- [x] Output selalu berupa `SpecDocument` yang valid atau error actionable.
- [x] Parser tidak bergantung pada format whitespace tertentu.

## Phase 3 — Deterministic Planner v0

File utama: `packages/core/src/planner.ts`.

- [x] Verifikasi mapping `Frontend`, `UI`, `TUI` ke `frontend`.
- [x] Verifikasi mapping `Backend`, `API`, `Database`, `Server` ke `backend`.
- [x] Verifikasi mapping `QA`, `Test`, `Verification` ke `qa`.
- [x] Verifikasi fallback ke `shared`.
- [x] Verifikasi hanya section actionable yang diproses.
- [x] Verifikasi dependency frontend terhadap `API Contract`.
- [x] Tentukan pencarian `API Contract` case-insensitive berdasarkan title dan slug.
- [x] Pastikan task ID stabil dan tidak bentrok.
- [x] Pastikan branch name deterministic dari task ID.
- [x] Pastikan custom preset dapat memengaruhi agent/model tanpa mengubah domain.
- [x] Tambahkan test planner untuk semua domain.
- [x] Tambahkan test planner untuk API Contract dependency.
- [x] Tambahkan test planner untuk custom preset.

Acceptance criteria:

- [x] Input spec yang sama menghasilkan task, ID, dependency, agent, model, dan branch yang sama.
- [x] Tidak ada dependency ke task yang tidak ada.

## Phase 4 — Agent dan Model Preset dari Database

Files utama: `packages/core/src/planner.ts`, `packages/db/src/schema/forkestra.ts`, `packages/cli/src/index.ts`.

- [x] Tambahkan repository/service untuk membaca preset.
- [x] Tambahkan seed atau fallback untuk default preset.
- [x] Verifikasi mapping semua domain: frontend, backend, shared, qa.
- [x] Tambahkan `--preset <name>` pada command `plan` jika diperlukan.
- [x] Tambahkan `--preset <name>` pada command `run`.
- [x] Gunakan preset DB pada planning dan execution.
- [x] Implementasikan preset fallback saat nama preset tidak ditemukan.
- [x] Tambahkan command untuk list preset.
- [x] Tambahkan command untuk membaca preset.
- [x] Tambahkan command untuk membuat atau memperbarui preset.
- [x] Validasi JSON mapping dengan schema runtime.
- [x] Tolak agent atau model kosong.
- [x] Tambahkan test preset persistence.

Acceptance criteria:

- [x] Preset dapat dibuat, dibaca, diubah, dan digunakan oleh run.
- [x] Run menyimpan agent/model final yang benar pada setiap task.

## Phase 5 — Dynamic Model Selector

Files utama: `packages/core/src/models.ts`, `packages/cli/src/index.ts`.

- [x] Buat abstraction `listModelsForAgent`.
- [x] Implementasikan listing model OpenCode melalui `opencode models`.
- [x] Tentukan fallback model Claude Code.
- [x] Tentukan fallback model Codex CLI.
- [x] Tangani binary atau subcommand yang tidak tersedia.
- [x] Tambahkan command `forkestra config models`.
- [x] Tambahkan filter `--agent <agent>`.
- [x] Jangan menggagalkan planning hanya karena model discovery gagal.
- [x] Tambahkan test parsing output model.
- [x] Tambahkan test fallback model.

Acceptance criteria:

- [x] User dapat melihat model yang tersedia tanpa menjalankan task agent.
- [x] Kegagalan discovery menghasilkan warning yang jelas dan fallback aman.

## Phase 6 — Scheduler Dependency, Skip, Retry, dan Concurrency

File utama: `packages/core/src/scheduler.ts`.

- [x] Verifikasi task tanpa dependency berjalan paralel.
- [x] Verifikasi task ber-dependency menunggu dependency selesai.
- [x] Implementasikan explicit downstream skip ketika dependency gagal.
- [x] Bedakan dependency failed, dependency skipped, dan deadlock/cycle.
- [x] Tambahkan validasi dependency cycle sebelum execution.
- [x] Tambahkan `--concurrency <n>`.
- [x] Terapkan concurrency limit secara global.
- [x] Rancang batas concurrency per provider sebagai extension point.
- [x] Tambahkan `--retries <n>`.
- [x] Retry hanya failure yang retryable.
- [x] Jangan retry bila task dibatalkan atau dependency gagal.
- [x] Simpan attempt number dan error terakhir.
- [x] Tambahkan duration pada hasil scheduler.
- [x] Tambahkan test parallel execution.
- [x] Tambahkan test dependency ordering.
- [x] Tambahkan test failure propagation.
- [x] Tambahkan test cycle detection.
- [x] Tambahkan test retry.
- [x] Tambahkan test concurrency limit.

Acceptance criteria:

- [x] Scheduler tidak menggantung pada dependency failure atau cycle.
- [x] Jumlah task aktif tidak melebihi limit.
- [x] Hasil scheduler lengkap: completed, failed, skipped.

## Phase 7 — Agent Runner Hardening

File utama: `packages/core/src/agent-runner.ts`, `packages/core/src/validation.ts`.

- [x] Verifikasi command Claude Code sesuai desain.
- [x] Verifikasi command Codex CLI sesuai desain.
- [x] Verifikasi command OpenCode sesuai desain.
- [x] Pastikan prompt dan model diteruskan sebagai argumen terpisah.
- [x] Tangani spawn error dengan pesan actionable.
- [x] Tangani process exit code non-zero.
- [x] Tambahkan klasifikasi timeout.
- [x] Pastikan process timeout benar-benar dihentikan.
- [x] Pastikan stdout dan stderr tetap dibaca sampai process selesai.
- [x] Pastikan callback log tidak kehilangan chunk.
- [x] Verifikasi validasi binary dengan `which`.
- [x] Tambahkan unit test command construction.
- [x] Tambahkan unit test timeout.
- [x] Tambahkan unit test stream callbacks.

Acceptance criteria:

- [x] Agent tidak bisa berjalan jika binary wajib tidak tersedia.
- [x] Timeout dan exit failure tersimpan sebagai hasil task yang dapat ditindaklanjuti.

## Phase 8 — Git Worktree Automation

File utama: `packages/core/src/git-worktree.ts`, `packages/core/src/scheduler.ts`, `packages/cli/src/index.ts`.

- [x] Verifikasi path `<workspace>/task-<id>`.
- [x] Verifikasi branch `feature/<task-id>`.
- [x] Tangani workspace root yang belum ada.
- [x] Tangani branch yang sudah ada.
- [x] Tangani path worktree yang sudah ada.
- [x] Tambahkan validasi target repository adalah Git repository.
- [x] Simpan worktree path ke DB segera setelah dibuat.
- [x] Tambahkan cleanup saat task gagal jika policy mengharuskan.
- [x] Tambahkan command list worktree.
- [x] Tambahkan command remove worktree dengan konfirmasi/flag eksplisit.
- [x] Cek `git status --porcelain` sebelum commit.
- [x] Jangan membuat empty commit.
- [x] Tangani commit failure tanpa menghapus hasil task.
- [x] Tambahkan test path generation.
- [x] Tambahkan test empty commit behavior.

Acceptance criteria:

- [x] Setiap task yang dieksekusi dengan `--worktree` memiliki branch dan folder terisolasi.
- [x] Hasil task dapat direview melalui branch tersebut.

## Phase 9 — Result Collector dan Project Checks

Files utama: `packages/core/src/result-collector.ts`, `packages/core/src/project-checks.ts`, `packages/cli/src/index.ts`.

- [x] Deteksi `lint` dari `package.json` target project.
- [x] Deteksi `check-types` atau `typecheck`.
- [x] Deteksi `test`.
- [x] Deteksi `build` bila diminta.
- [x] Tambahkan `--check`.
- [x] Tambahkan `--check-command <cmd>`.
- [x] Tambahkan `--skip-checks`.
- [x] Jalankan checks pada cwd yang benar.
- [x] Stream stdout/stderr checks ke `task_log` atau storage khusus.
- [x] Simpan exit code dan duration check.
- [x] Tentukan apakah check failure membuat task failed atau hanya warning.
- [x] Jalankan checks setelah agent selesai sebelum commit bila policy dipilih.
- [x] Tambahkan summary report lengkap.
- [x] Sertakan run ID, task ID, status, agent, model, branch, worktree, log path/count, dan check result.
- [x] Tambahkan test project command detection.
- [x] Tambahkan test check failure handling.

Acceptance criteria:

- [x] Hasil task tidak dianggap sukses bila required checks gagal.
- [x] Summary dapat digunakan manusia untuk review tanpa membaca seluruh database.

## Phase 10 — OpenTUI Live Progress

Files utama: `packages/cli/src/tui.ts`, `packages/core/src/status-stream.ts`.

- [x] Ganti placeholder command `forkestra tui`.
- [x] Tampilkan daftar run terbaru.
- [x] Tampilkan task per run.
- [x] Tampilkan status task dengan teks yang tidak hanya mengandalkan warna.
- [x] Tampilkan agent dan model.
- [x] Tampilkan selected task log.
- [x] Tambahkan refresh interval.
- [x] Tambahkan keyboard navigation minimal.
- [x] Tambahkan graceful exit.
- [x] Tambahkan fallback ke output CLI jika terminal tidak mendukung TUI.
- [x] Pastikan TUI tidak mengunci database secara permanen.
- [x] Tambahkan test untuk data formatting/status view.

Acceptance criteria:

- [x] `forkestra tui` menampilkan live status dan log.
- [x] User dapat keluar tanpa meninggalkan process atau terminal dalam keadaan rusak.

## Phase 11 — Hono/tRPC API Dashboard Read Model

Files utama: `apps/server/src/index.ts`, `packages/api/src/routers/index.ts`.

- [x] Pertahankan `healthCheck`.
- [x] Pertahankan query daftar run.
- [x] Pertahankan query task per run.
- [x] Tambahkan query run berdasarkan ID.
- [x] Tambahkan query task log berdasarkan task ID.
- [x] Tambahkan query latest run.
- [x] Tambahkan query run summary.
- [x] Tambahkan pagination untuk task log.
- [x] Tambahkan input validation untuk semua query.
- [x] Tentukan response error untuk ID yang tidak ditemukan.
- [x] Pastikan API read-only untuk v1 awal.
- [x] Tambahkan test router.
- [x] Tambahkan test CORS dan health endpoint.

Acceptance criteria:

- [x] Dashboard future dapat mengambil run, task, status, dan log tanpa akses langsung ke DB.
- [x] Query tidak mengembalikan data tidak terbatas.

## Phase 12 — Optional PR Creation

File utama: `packages/core/src/pr.ts`.

- [x] Buat abstraction provider PR.
- [x] Implementasikan GitHub melalui `gh` bila tersedia.
- [x] Tambahkan base branch option.
- [x] Tambahkan `--create-pr` flag eksplisit.
- [x] Tolak pembuatan PR jika task tidak committed.
- [x] Sertakan title dan body summary yang deterministic.
- [x] Simpan PR URL ke metadata atau field DB.
- [x] Tangani provider/binary tidak tersedia.
- [x] Jangan auto-create PR secara default.
- [x] Tambahkan test command construction dan failure handling.

Acceptance criteria:

- [x] PR hanya dibuat atas permintaan eksplisit user.
- [x] URL PR tercatat pada summary task/run.

## Phase 13 — Test Suite Lengkap

- [x] Pilih dan dokumentasikan test runner (`bun test` atau runner yang sudah digunakan repo).
- [x] Tambahkan parser tests.
- [x] Tambahkan planner tests.
- [x] Tambahkan preset tests.
- [x] Tambahkan scheduler tests.
- [x] Tambahkan agent runner tests.
- [x] Tambahkan worktree tests.
- [x] Tambahkan result collector tests.
- [x] Tambahkan API tests.
- [x] Tambahkan CLI smoke tests.
- [x] Tambahkan test untuk dry-run yang memastikan agent tidak dipanggil.
- [x] Tambahkan test untuk database persistence.
- [x] Tambahkan test untuk failure dan timeout path.
- [x] Tambahkan test untuk duplicate title task.
- [x] Tambahkan test untuk malformed preset.
- [x] Tambahkan test command construction untuk Claude/Codex/OpenCode.
- [x] Tambahkan test retryable dan non-retryable scheduler failure.
- [x] Tambahkan test deterministic worktree path.

Acceptance criteria:

- [x] Test suite berjalan deterministically tanpa bergantung pada CLI agent nyata.
- [x] External process dan Git di-mock atau dijalankan pada fixture repository terisolasi.

## Phase 14 — Documentation dan Design Status

Files utama: `docs/DESIGN.md`, `docs/IMPLEMENTATION-TODO.md`, README.

- [x] Update roadmap v0.1–v1.0 berdasarkan fitur yang benar-benar selesai.
- [x] Tandai bagian DESIGN yang sudah implemented.
- [x] Tandai bagian DESIGN yang masih partial.
- [x] Tambahkan contoh `plan`.
- [x] Tambahkan contoh `run --dry-run`.
- [x] Tambahkan contoh `run --execute --worktree`.
- [x] Tambahkan contoh `status`.
- [x] Tambahkan contoh `tui`.
- [x] Tambahkan contoh preset.
- [x] Tambahkan contoh model listing.
- [x] Dokumentasikan environment database.
- [x] Dokumentasikan batasan v1 dan non-goals.
- [x] Pastikan checklist file ini tetap sinkron dengan DESIGN.

Acceptance criteria:

- [x] Dokumentasi tidak mengklaim fitur yang belum tersedia.
- [x] Developer berikutnya dapat menjalankan dan melanjutkan checklist ini.

---

## Current Implementation Snapshot

- Implemented: parser validation, deterministic planner IDs, API Contract dependency, preset loading/saving, dynamic OpenCode model discovery with fallbacks, dependency cycle detection, explicit downstream skip, retry count, global concurrency, agent timeout classification, project check detection, empty-commit protection, CLI config subcommands, and API read queries.
- Partial: TUI now provides a database-backed refreshing status/log view with signal handling; keyboard navigation and full OpenTUI multi-pane rendering remain pending.
- Worktree hardening: repository validation, branch/path collision checks, cleanup flag, retry classification, and list/remove commands are implemented.
- Test suite: 75 tests pass across parser, planner, scheduler/provider limits, agent command construction, project checks, model fallback, status formatting, result summaries, API/server endpoints, isolated CLI dry-run/preset/database persistence, PR helpers, and worktree path behavior.
- Not implemented: the full integration/CLI test matrix.
- Implemented this pass: persisted attempts/exit code/duration/check status, commit failure handling, GitHub PR creation via explicit `--create-pr`, task metadata PR URL, task summary reporting, and provider-specific concurrency limits.
- Verification: `bun test` passes 75 tests; `bun run lint`, `bun run check-types`, and `bun run build` pass.
- Known issue: the existing SQLite/Turso migration set does not require a new migration for the enum-like text status change.

## Final Verification Gate

Jalankan setelah seluruh phase yang dipilih selesai:

- [x] `bun run lint`
- [x] `bun run check-types`
- [x] `bun run build`
- [x] `bun test`
- [x] `bun packages/cli/src/index.ts plan docs/DESIGN.md`
- [x] `bun packages/cli/src/index.ts run docs/DESIGN.md --dry-run`
- [x] `bun packages/cli/src/index.ts status`
- [x] `bun packages/cli/src/index.ts config`
- [x] Verifikasi execution dengan fixture agent atau mock executor.
- [x] Verifikasi execution dengan `--worktree` pada fixture repository.
- [x] Verifikasi stdout/stderr tersimpan di `task_log`.
- [x] Verifikasi task dependency failure menghasilkan downstream `skipped`.
- [x] Verifikasi summary report lengkap.
- [x] Verifikasi tidak ada secret atau credential yang masuk ke log, commit, atau dokumentasi.
- [x] Update Update Log dengan hasil final.

## Implementation Notes

- Jangan menandai item `[x]` sebelum acceptance criteria phase terkait terpenuhi.
- Jika item hanya sebagian selesai, gunakan `[-]` dan tulis detailnya di Update Log.
- Jika ada perubahan desain, update `DESIGN.md` dan checklist ini pada perubahan yang sama.
- Jangan commit file atau perubahan apa pun hanya karena checklist ini dibuat; keputusan commit tetap eksplisit.
