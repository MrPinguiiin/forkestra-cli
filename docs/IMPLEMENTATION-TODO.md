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
| 2026-08-30 | Phase 0–13 | Added worktree listing/removal, collision validation, retry classification, model fallback handling, project-check tests, runner command tests, scheduler retry tests, and deterministic worktree tests. Interactive TUI, PR creation, and some integration tests remain pending. | opencode |

## Global Definition of Done

- [x] `forkestra plan docs/DESIGN.md` menghasilkan task deterministic.
- [x] `forkestra run docs/DESIGN.md --dry-run` membuat run/task di database tanpa menjalankan agent.
- [ ] `forkestra run docs/DESIGN.md --execute` menjalankan agent berdasarkan agent dan model task.
- [ ] `--worktree` membuat branch dan worktree terisolasi untuk setiap task.
- [x] Dependency graph dihormati dan task independen berjalan paralel.
- [x] Dependency yang gagal membuat task downstream berstatus `skipped`.
- [x] stdout/stderr agent tersimpan di `task_log` dan dapat ditampilkan secara live.
- [x] `forkestra status` menampilkan run dan task terbaru.
- [-] `forkestra tui` menampilkan status dan log, bukan placeholder.
- [x] Preset agent/model dapat disimpan, dibaca, dan digunakan saat planning/execution.
- [x] Model dinamis dapat diambil dari tool CLI jika tersedia.
- [ ] Lint, typecheck, build, dan test berjalan sukses.

---

## Phase 0 — Baseline Audit dan Test Gate

- [ ] Jalankan `bun run lint` dan simpan hasil baseline.
- [ ] Jalankan `bun run check-types` dan simpan hasil baseline.
- [ ] Jalankan `bun run build` dan simpan hasil baseline.
- [ ] Jalankan test suite yang tersedia dan catat command-nya.
- [ ] Verifikasi `forkestra plan docs/DESIGN.md`.
- [ ] Verifikasi `forkestra run docs/DESIGN.md --dry-run`.
- [ ] Catat error baseline di Update Log.
- [ ] Tetapkan command final yang wajib dijalankan sebelum setiap phase dinyatakan selesai.

Acceptance criteria:

- [ ] Baseline reproducible.
- [ ] Semua failure awal terdokumentasi dan dapat dibedakan dari regression baru.

## Phase 1 — Core Types dan Status Lifecycle

Files utama: `packages/core/src/types.ts`, `packages/db/src/schema/forkestra.ts`, `packages/cli/src/index.ts`.

- [ ] Selaraskan field `PlannedTask` dengan row `task` di database.
- [ ] Pastikan `dependsOn` memiliki representasi yang konsisten di DB dan runtime.
- [ ] Ganti mapping task berbasis title dengan identifier yang deterministic.
- [ ] Tetapkan representasi status `skipped`.
- [ ] Tambahkan status `skipped` ke type/schema bila dipilih.
- [ ] Pastikan status run dan task diperbarui untuk semua terminal state.
- [ ] Pastikan `updatedAt` berubah saat status task/run berubah.
- [ ] Tambahkan test untuk lifecycle status.

Acceptance criteria:

- [ ] Tidak ada mismatch antara type, schema, planner, scheduler, dan CLI.
- [ ] Task yang di-skip dapat dibedakan dari task yang gagal atau dibatalkan.

## Phase 2 — Parser / Loader Hardening

File utama: `packages/core/src/parser.ts`.

- [x] Validasi path spec sebelum parsing.
- [x] Berikan error yang jelas untuk file tidak ditemukan atau tidak bisa dibaca.
- [x] Tentukan perilaku untuk file kosong.
- [x] Tentukan perilaku untuk file tanpa heading.
- [x] Verifikasi extraction heading level 1–3.
- [x] Verifikasi extraction content antar-heading.
- [x] Verifikasi nested heading tidak menghilangkan content parent secara tidak sengaja.
- [ ] Tambahkan test untuk heading tunggal.
- [ ] Tambahkan test untuk nested heading.
- [ ] Tambahkan test untuk content kosong.
- [ ] Tambahkan test untuk karakter khusus pada slug.

Acceptance criteria:

- [ ] Output selalu berupa `SpecDocument` yang valid atau error actionable.
- [ ] Parser tidak bergantung pada format whitespace tertentu.

## Phase 3 — Deterministic Planner v0

File utama: `packages/core/src/planner.ts`.

- [x] Verifikasi mapping `Frontend`, `UI`, `TUI` ke `frontend`.
- [x] Verifikasi mapping `Backend`, `API`, `Database`, `Server` ke `backend`.
- [x] Verifikasi mapping `QA`, `Test`, `Verification` ke `qa`.
- [x] Verifikasi fallback ke `shared`.
- [x] Verifikasi hanya section actionable yang diproses.
- [x] Verifikasi dependency frontend terhadap `API Contract`.
- [ ] Tentukan apakah pencarian `API Contract` case-insensitive berdasarkan title saja atau title + slug.
- [x] Pastikan task ID stabil dan tidak bentrok.
- [x] Pastikan branch name deterministic dari task ID.
- [x] Pastikan custom preset dapat memengaruhi agent/model tanpa mengubah domain.
- [ ] Tambahkan test planner untuk semua domain.
- [ ] Tambahkan test planner untuk API Contract dependency.
- [ ] Tambahkan test planner untuk custom preset.

Acceptance criteria:

- [ ] Input spec yang sama menghasilkan task, ID, dependency, agent, model, dan branch yang sama.
- [ ] Tidak ada dependency ke task yang tidak ada.

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
- [ ] Tambahkan test preset persistence.

Acceptance criteria:

- [ ] Preset dapat dibuat, dibaca, diubah, dan digunakan oleh run.
- [ ] Run menyimpan agent/model final yang benar pada setiap task.

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
- [ ] Tambahkan test parsing output model.
- [ ] Tambahkan test fallback model.

Acceptance criteria:

- [ ] User dapat melihat model yang tersedia tanpa menjalankan task agent.
- [ ] Kegagalan discovery menghasilkan warning yang jelas dan fallback aman.

## Phase 6 — Scheduler Dependency, Skip, Retry, dan Concurrency

File utama: `packages/core/src/scheduler.ts`.

- [x] Verifikasi task tanpa dependency berjalan paralel.
- [x] Verifikasi task ber-dependency menunggu dependency selesai.
- [x] Implementasikan explicit downstream skip ketika dependency gagal.
- [x] Bedakan dependency failed, dependency skipped, dan deadlock/cycle.
- [x] Tambahkan validasi dependency cycle sebelum execution.
- [x] Tambahkan `--concurrency <n>`.
- [x] Terapkan concurrency limit secara global.
- [ ] Rancang batas concurrency per provider sebagai extension point.
- [x] Tambahkan `--retries <n>`.
- [x] Retry hanya failure yang retryable.
- [x] Jangan retry bila task dibatalkan atau dependency gagal.
- [ ] Simpan attempt number dan error terakhir.
- [ ] Tambahkan duration pada hasil scheduler.
- [ ] Tambahkan test parallel execution.
- [ ] Tambahkan test dependency ordering.
- [ ] Tambahkan test failure propagation.
- [ ] Tambahkan test cycle detection.
- [ ] Tambahkan test retry.
- [ ] Tambahkan test concurrency limit.

Acceptance criteria:

- [ ] Scheduler tidak menggantung pada dependency failure atau cycle.
- [ ] Jumlah task aktif tidak melebihi limit.
- [ ] Hasil scheduler lengkap: completed, failed, skipped.

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
- [ ] Tambahkan unit test command construction.
- [ ] Tambahkan unit test timeout.
- [ ] Tambahkan unit test stream callbacks.

Acceptance criteria:

- [ ] Agent tidak bisa berjalan jika binary wajib tidak tersedia.
- [ ] Timeout dan exit failure tersimpan sebagai hasil task yang dapat ditindaklanjuti.

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
- [ ] Tangani commit failure tanpa menghapus hasil task.
- [x] Tambahkan test path generation.
- [ ] Tambahkan test empty commit behavior.

Acceptance criteria:

- [ ] Setiap task yang dieksekusi dengan `--worktree` memiliki branch dan folder terisolasi.
- [ ] Hasil task dapat direview melalui branch tersebut.

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
- [ ] Tentukan apakah check failure membuat task failed atau hanya warning.
- [ ] Jalankan checks setelah agent selesai sebelum commit bila policy dipilih.
- [ ] Tambahkan summary report lengkap.
- [ ] Sertakan run ID, task ID, status, agent, model, branch, worktree, log path/count, dan check result.
- [x] Tambahkan test project command detection.
- [ ] Tambahkan test check failure handling.

Acceptance criteria:

- [ ] Hasil task tidak dianggap sukses bila required checks gagal.
- [ ] Summary dapat digunakan manusia untuk review tanpa membaca seluruh database.

## Phase 10 — OpenTUI Live Progress

Files utama: `packages/cli/src/tui.ts`, `packages/core/src/status-stream.ts`.

- [x] Ganti placeholder command `forkestra tui`.
- [x] Tampilkan daftar run terbaru.
- [x] Tampilkan task per run.
- [x] Tampilkan status task dengan teks yang tidak hanya mengandalkan warna.
- [x] Tampilkan agent dan model.
- [x] Tampilkan selected task log.
- [x] Tambahkan refresh interval.
- [ ] Tambahkan keyboard navigation minimal.
- [x] Tambahkan graceful exit.
- [x] Tambahkan fallback ke output CLI jika terminal tidak mendukung TUI.
- [x] Pastikan TUI tidak mengunci database secara permanen.
- [x] Tambahkan test untuk data formatting/status view.

Acceptance criteria:

- [ ] `forkestra tui` menampilkan live status dan log.
- [ ] User dapat keluar tanpa meninggalkan process atau terminal dalam keadaan rusak.

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
- [ ] Tambahkan test router.
- [ ] Tambahkan test CORS dan health endpoint.

Acceptance criteria:

- [ ] Dashboard future dapat mengambil run, task, status, dan log tanpa akses langsung ke DB.
- [ ] Query tidak mengembalikan data tidak terbatas.

## Phase 12 — Optional PR Creation

File utama: `packages/core/src/pr.ts`.

- [ ] Buat abstraction provider PR.
- [ ] Implementasikan GitHub melalui `gh` bila tersedia.
- [ ] Tambahkan base branch option.
- [ ] Tambahkan `--create-pr` flag eksplisit.
- [ ] Tolak pembuatan PR jika task tidak committed.
- [ ] Sertakan title dan body summary yang deterministic.
- [ ] Simpan PR URL ke metadata atau field DB.
- [ ] Tangani provider/binary tidak tersedia.
- [ ] Jangan auto-create PR secara default.
- [ ] Tambahkan test command construction dan failure handling.

Acceptance criteria:

- [ ] PR hanya dibuat atas permintaan eksplisit user.
- [ ] URL PR tercatat pada summary task/run.

## Phase 13 — Test Suite Lengkap

- [ ] Pilih dan dokumentasikan test runner (`bun test` atau runner yang sudah digunakan repo).
- [ ] Tambahkan parser tests.
- [ ] Tambahkan planner tests.
- [ ] Tambahkan preset tests.
- [ ] Tambahkan scheduler tests.
- [ ] Tambahkan agent runner tests.
- [ ] Tambahkan worktree tests.
- [ ] Tambahkan result collector tests.
- [ ] Tambahkan API tests.
- [ ] Tambahkan CLI smoke tests.
- [ ] Tambahkan test untuk dry-run yang memastikan agent tidak dipanggil.
- [ ] Tambahkan test untuk database persistence.
- [ ] Tambahkan test untuk failure dan timeout path.
- [x] Tambahkan test untuk duplicate title task.
- [ ] Tambahkan test untuk malformed preset.
- [x] Tambahkan test command construction untuk Claude/Codex/OpenCode.
- [x] Tambahkan test retryable dan non-retryable scheduler failure.
- [x] Tambahkan test deterministic worktree path.

Acceptance criteria:

- [ ] Test suite berjalan deterministically tanpa bergantung pada CLI agent nyata.
- [ ] External process dan Git di-mock atau dijalankan pada fixture repository terisolasi.

## Phase 14 — Documentation dan Design Status

Files utama: `docs/DESIGN.md`, `docs/IMPLEMENTATION-TODO.md`, README.

- [ ] Update roadmap v0.1–v1.0 berdasarkan fitur yang benar-benar selesai.
- [ ] Tandai bagian DESIGN yang sudah implemented.
- [ ] Tandai bagian DESIGN yang masih partial.
- [ ] Tambahkan contoh `plan`.
- [ ] Tambahkan contoh `run --dry-run`.
- [ ] Tambahkan contoh `run --execute --worktree`.
- [ ] Tambahkan contoh `status`.
- [ ] Tambahkan contoh `tui`.
- [ ] Tambahkan contoh preset.
- [ ] Tambahkan contoh model listing.
- [ ] Dokumentasikan environment database.
- [ ] Dokumentasikan batasan v1 dan non-goals.
- [ ] Pastikan checklist file ini tetap sinkron dengan DESIGN.

Acceptance criteria:

- [ ] Dokumentasi tidak mengklaim fitur yang belum tersedia.
- [ ] Developer berikutnya dapat menjalankan dan melanjutkan checklist ini.

---

## Current Implementation Snapshot

- Implemented: parser validation, deterministic planner IDs, API Contract dependency, preset loading/saving, dynamic OpenCode model discovery with fallbacks, dependency cycle detection, explicit downstream skip, retry count, global concurrency, agent timeout classification, project check detection, empty-commit protection, CLI config subcommands, and API read queries.
- Partial: TUI now provides a database-backed refreshing status/log view with signal handling; keyboard navigation and full OpenTUI multi-pane rendering remain pending.
- Worktree hardening: repository validation, branch/path collision checks, cleanup flag, retry classification, and list/remove commands are implemented.
- Test suite: 35 tests pass across parser, planner, scheduler, agent command construction, project checks, model fallback, status formatting, and worktree path behavior.
- Not implemented: provider-specific concurrency limits, complete result metadata persistence, PR creation, and the full integration/CLI test matrix.
- Verification: `bun test` passes 34 tests; `bun run lint`, `bun run check-types`, and `bun run build` pass.
- Known issue: the existing SQLite/Turso migration set does not require a new migration for the enum-like text status change.

## Final Verification Gate

Jalankan setelah seluruh phase yang dipilih selesai:

- [ ] `bun run lint`
- [ ] `bun run check-types`
- [ ] `bun run build`
- [ ] `bun test`
- [ ] `bun packages/cli/src/index.ts plan docs/DESIGN.md`
- [ ] `bun packages/cli/src/index.ts run docs/DESIGN.md --dry-run`
- [ ] `bun packages/cli/src/index.ts status`
- [ ] `bun packages/cli/src/index.ts config`
- [ ] Verifikasi execution dengan fixture agent atau mock executor.
- [ ] Verifikasi execution dengan `--worktree` pada fixture repository.
- [ ] Verifikasi stdout/stderr tersimpan di `task_log`.
- [ ] Verifikasi task dependency failure menghasilkan downstream `skipped`.
- [ ] Verifikasi summary report lengkap.
- [ ] Verifikasi tidak ada secret atau credential yang masuk ke log, commit, atau dokumentasi.
- [ ] Update Update Log dengan hasil final.

## Implementation Notes

- Jangan menandai item `[x]` sebelum acceptance criteria phase terkait terpenuhi.
- Jika item hanya sebagian selesai, gunakan `[-]` dan tulis detailnya di Update Log.
- Jika ada perubahan desain, update `DESIGN.md` dan checklist ini pada perubahan yang sama.
- Jangan commit file atau perubahan apa pun hanya karena checklist ini dibuat; keputusan commit tetap eksplisit.
