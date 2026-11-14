# zcode-plugin

**An open plugin marketplace and skill library for ZCode** — closing three mechanism gaps (memory loop, project guardrails, experience distillation) and bringing in upstream design capability.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-ZCode-blue)
![Marketplace](https://img.shields.io/badge/marketplace-local%20directory-8A2BE2)
![Node](https://img.shields.io/badge/hooks-node%20process-green)

English | [简体中文](README.md)

The repository root **is itself a ZCode local plugin marketplace**: add this directory as a marketplace source and install any plugin below.

---

## What you get

### Plugins (installed via marketplace)

| Plugin | Version | Kind | One-liner |
|---|---|---|---|
| [`skill-forge`](plugins/skill-forge/README.md) | 1.1.5 | mechanism · distillation | After multi-step tasks, automatically distill reusable practices into project-level skills — and fix existing skills in passing |
| [`memory-loop`](plugins/memory-loop/README.md) | 1.0.3 | mechanism · memory | Consume memory candidates → split per project → distill → re-inject distilled memory at session start |
| [`project-guardrails`](plugins/project-guardrails/README.md) | 1.1.4 | mechanism · guardrails | Per-project conventions and tool rules + automatic handoff-ledger index injection at session start (zero config) |
| [`impeccable`](plugins/impeccable/README.md) | 4.9.1 | capability · design | ZCode adaptation of upstream [pbakaus/impeccable](https://github.com/pbakaus/impeccable): a design vocabulary + AI-slop detector |
| [`taste-skill`](plugins/taste-skill/README.md) | 2.5.1 | capability · design | ZCode adaptation of upstream [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill): anti-mediocre company-site methodology + Stop completion gate (GATE: PASS) |

#### skill-forge — automatic experience distillation

When a task took 5+ steps, bypassed a non-obvious pitfall, or settled a convention you will reuse, the agent writes it into a project-level skill (under `<repo>/.zcode/skills/` — versioned, reviewable).

- **Commands**: `/skill-forge` (manual distillation) · `/skill-audit` (skill-library budget & shadowing audit)
- **Hooks**: `Stop` (distillation nudge) + `SessionStart` (re-inject rules after compact/clear)
- **Usage**: hooks work out of the box; the three iron rules must be appended to `~/.zcode/AGENTS.md` to stay resident (primary channel — the hook only re-injects after compact/clear). Copy-paste text in its README, install step 4

#### memory-loop — closing the memory loop

ZCode's memory candidates are write-only (`memory-candidates.jsonl` grows forever, no consumer). This plugin is the **consumer**: at `Stop` it splits candidates per project (by `cwd`) and deduplicates; after manual distillation it re-injects at `SessionStart`.

- **Commands**: `/memory-loop` (distillation helper)
- **Hooks**: `Stop` (split) + `SessionStart` (inject distilled `MEMORY.md`)
- **Prerequisite**: some upstream hook writing candidates (default inbox `~/.zcode/hooks/memory-candidates.jsonl`); without one it silently does nothing

#### project-guardrails — per-project guardrails

Workspace-level hooks are trust-gated by default, making project-owned constraints hard. This **user-level** plugin reads project declarations on their behalf, bypassing the trust gate:

- **Zero config**: if the repo has a handoff-ledger carrier, `SessionStart` injects the ledger index + doc-size budget automatically
- **Optional config**: declare `context[]` (session-start conventions), `rules[]` (`PreToolUse` tool rules with `deny`/`ask`), `entrypoints[]` (custom injections) in `<repo>/.agents/guardrails.json` (fallback `.zcode/`)

```jsonc
// <repo>/.agents/guardrails.json example
{
  "context": ["This repo uses pnpm; never npm install"],
  "rules": [{ "tool": "Bash", "pattern": "git push --force", "decision": "deny", "reason": "no force push" }]
}
```

- **Commands**: `/guardrails` (show effective declarations)
- **Hooks**: `SessionStart` ×2 (rules + ledger index, independent failure domains) + `PreToolUse` (tool rules)

#### impeccable — design capability (vendored adaptation)

The upstream's 24 design verbs (`polish` / `critique` / `audit` / `bolder`…), a 62-rule deterministic AI-slop detector (Rust engine, no LLM needed), and an automatic design hook. Upstream files are vendored untouched; the adaptation layer is a hook wrapper, a command router, and hook wiring.

- **Commands**: `/impeccable <verb> [target]`
- **Hooks**: `PostToolUse` (scans edited UI files after every Edit/Write)
- **Usage**:

```bash
# In a session: say "polish this page", or
/impeccable polish src/app.html

# Detection only (CI-ready: --json / --github)
npx impeccable detect src/
```

> The engine binary downloads on first run (checksum-verified). When upstream releases a new version, follow the re-vendor runbook in the plugin README.

#### taste-skill — anti-mediocre site building (vendored adaptation)

The upstream "give coding agents taste" frontend skill (111k+ stars): deals palettes / font pairings / hero layouts by six business categories, mandates real photographs and real product UI, and runs a five-viewport headless-Chrome consistency check plus a `gate.mjs` completion gate (holds session close until `GATE: PASS`). Vendored untouched; the ZCode bridge is a `/taste-skill` command plus a plugin-level Stop hook (the upstream `hooks:` block inside skill frontmatter is silently ignored by ZCode).

- **Command**: `/taste-skill <brief or goal>` (the trigger sentence sits beyond ZCode's 250-char description injection window, so auto-triggering is weak — name it explicitly when unsure)
- **Hook**: `Stop` (completion gate; always releases when unarmed / errored / another session holds the build — never traps)
- **Requirements**: Node 22+; Chrome / Edge / Chromium (the gate runs a headless browser)

> **Division of labor between the two design plugins**: building a company site / landing page → `taste-skill` (from scratch, gate-enforced); reviewing / fixing an existing interface (dashboards, components included) → `impeccable` (critique / detect / polish). Design-system selection for app-style UI (SaaS backends, mobile) is out of scope for both — **explicitly call** an external selection skill (e.g. `ui-ux-pro-max`) when needed; with these two design capabilities in place, such skills no longer need auto-triggering — keeping a manual entry is enough.

### Skill (manual install)

| Skill | What it does |
|---|---|
| [`doc-protocol`](skills/doc-protocol/SKILL.md) | Document responsibility routing and progress-truth protocol: one authoritative carrier per fact class, a single todo ledger, hot/warm/cold layering with size budgets, session open/close checklists. Self-contained (general principles + landing layer + a worked example + a budget-gate script) |

```bash
cp -r skills/doc-protocol ~/.agents/skills/doc-protocol   # or symlink
```

## Install

1. ZCode → **Settings → Plugins** → **Create → Add marketplace** → pick this repository directory (clone it locally)
2. Click **Install** on the plugins you want (enabled by default)
3. **Start a new session** — hook configuration is snapshotted at session start; running sessions do not hot-reload
4. **Only `skill-forge` has an extra step**: append the three iron rules to `~/.zcode/AGENTS.md` (copy-paste text in [`plugins/skill-forge/README.md`](plugins/skill-forge/README.md), install step 4). The other four plugins are zero-config — **do not** add anything to AGENTS.md for them: context injection, tool rules, design scanning and the finish gate all come from hooks, and a duplicated rule is a second source of truth (drift is worse than absence)

Requirements: ZCode desktop; hook processes need **Node**; `impeccable`'s design hook uses `sh` from Git Bash on Windows (ZCode's default shell).

## Self-check & tests

```bash
node --test tests/*.test.mjs       # unit + parity fixtures (incl. the M1 dead-row / Python-truth regression)
node scripts/healthcheck.mjs       # five-surface check: version reconciliation / byte-level cache diff / spec audit / doc budget / telemetry summary
node scripts/healthcheck.mjs --ci  # CI mode (skips surfaces that depend on local install state)
```

Single-user plugins get no bug reports from the outside, so hooks ship **lightweight telemetry**: every emit/pass appends one line to `~/.zcode/hooks/plugin-telemetry.jsonl` (auto-rotated at 512KB / 2000 lines, local file only, nothing leaves the machine; `PLUGIN_TELEMETRY=off` disables). GitHub Actions runs the same healthcheck weekly (see `.github/workflows/health.yml`, Chinese) alongside a local scheduled check.

## Why these plugins

ZCode's system-prompt pipeline is solid; what it lacks is **programmability and portability**. Every plugin here fills one mechanism gap:

| ZCode native | Consequence | Filled by |
|---|---|---|
| Memory candidates are write-only | No consumer at all | `memory-loop` |
| Project-owned constraints are hard to gate in (workspace hooks trust gate) | Constraints can't reach tool calls | `project-guardrails` |
| Experience never distills; skill library unobserved | Same pitfalls re-hit; budget overflow kills auto-trigger | `skill-forge` |

Full analysis — field-level contracts of all 7 hook events and a `runnable` / `diagnosticOnly` / `unsupported` compatibility matrix — lives in [`docs/analysis/zcode-capability-gaps.md`](docs/analysis/zcode-capability-gaps.md) (Chinese).

## Documentation

| Looking for | Go to |
|---|---|
| Per-plugin install / verify / rollback | `plugins/<name>/README.md` |
| Contributing: adding plugins/skills, hooks development rules, troubleshooting | [CONTRIBUTING.md](CONTRIBUTING.md) |
| ZCode capability-gap analysis | [docs/analysis/zcode-capability-gaps.md](docs/analysis/zcode-capability-gaps.md) |
| Cross-session design notes & ledger | [HANDOFF.md](HANDOFF.md) |
| Skill directory conventions | [skills/README.md](skills/README.md) |

Deep-dive documents are mostly written in Chinese; the structure and code comments should get you through.

## Contributing

PRs welcome. The full walkthrough for adding plugins/skills, the hook output protocol, and a field-tested gotcha list live in [CONTRIBUTING.md](CONTRIBUTING.md). Two hard rules: plugin `name` must match `^[a-z0-9][a-z0-9._-]{0,127}$`; on release, **bump versions in plugin.json, marketplace.json and the README table together** (the update check compares them).

## License

**MIT** — see [LICENSE](LICENSE).

The `impeccable` plugin is vendored from [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (**Apache-2.0**, copyright Paul Bakaus and contributors — see [plugins/impeccable/LICENSE](plugins/impeccable/LICENSE) and [NOTICE.md](plugins/impeccable/NOTICE.md)); the `taste-skill` plugin is vendored from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (**MIT**, copyright Leonxlnx — see [plugins/taste-skill/LICENSE](plugins/taste-skill/LICENSE)). The adaptation layers on top are MIT, same as this repository.
