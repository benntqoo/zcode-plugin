# zcode-plugin

**ZCode 的开源插件市场与技能库** —— 补上 ZCode 缺失的三条机制（记忆闭环、项目护栏、经验沉淀），并引入上游设计能力。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-ZCode-blue)
![Marketplace](https://img.shields.io/badge/marketplace-local%20directory-8A2BE2)
![Node](https://img.shields.io/badge/hooks-node%20process-green)

[English](README.en.md) | 简体中文

仓库根本身就是一个 **ZCode 本地插件市场**：把本目录添加为市场源，即可安装下列全部插件。

---

## 提供的工具

### 插件（走市场安装）

| 插件 | 版本 | 类型 | 一句话 |
|---|---|---|---|
| [`skill-forge`](plugins/skill-forge/README.md) | 1.1.3 | 机制 · 经验沉淀 | 多步任务后自动把可复用做法沉淀成 skill，并在使用中顺手修正已有 skill |
| [`memory-loop`](plugins/memory-loop/README.md) | 1.0.1 | 机制 · 记忆闭环 | 消费记忆候选 → 按 cwd 分流 → 蒸馏 → 会话开始自动注入 |
| [`project-guardrails`](plugins/project-guardrails/README.md) | 1.1.2 | 机制 · 项目护栏 | 项目级约定与工具规则 + 会话开场自动注入待办账本索引（零配置） |
| [`impeccable`](plugins/impeccable/README.md) | 4.9.1 | 能力 · 设计 | 上游 [pbakaus/impeccable](https://github.com/pbakaus/impeccable) 的 ZCode 适配版：设计词汇表 + AI-slop 检测器 |

#### skill-forge —— 经验自动沉淀

任务收尾时，agent 若走了 5 步以上、踩过非显然的坑、或定下了会重复用到的约定，会自动把经验写成项目级 skill（落在 `<repo>/.zcode/skills/`，随 git 走、可 review）。

- **命令**：`/skill-forge`（手动触发沉淀）· `/skill-audit`（盘点 skill 库预算与同名遮蔽）
- **钩子**：`Stop`（沉淀提醒）+ `SessionStart`（compact/clear 后重注入规则）
- **用法**：装完即生效，无需配置

#### memory-loop —— 记忆闭环

ZCode 的记忆候选只写不读（`memory-candidates.jsonl` 只增不减）。本插件是它的**消费者**：Stop 时按 `cwd` 把候选分流到各项目并去重，人工蒸馏后于 SessionStart 注入。

- **命令**：`/memory-loop`（蒸馏辅助）
- **钩子**：`Stop`（分流）+ `SessionStart`（注入蒸馏后的 `MEMORY.md`）
- **前提**：需要上游某个钩子在写候选（默认对接 `~/.zcode/hooks/memory-candidates.jsonl`）；没有上游时不报错、什么也不做

#### project-guardrails —— 项目护栏

工作区级 hooks 默认「待信任」，项目自带约束门槛高。本插件以**用户级**插件代读项目声明，绕开信任闸：

- **零配置**：仓库里只要有待办账本载体，SessionStart 自动注入账本索引 + 体量状态
- **按需配置**：`<repo>/.agents/guardrails.json`（回退 `.zcode/`）声明 `context[]`（开场注入的约定）、`rules[]`（PreToolUse 工具规则，支持 `deny`/`ask`）、`entrypoints[]`（自定义注入项）

```jsonc
// <repo>/.agents/guardrails.json 示例
{
  "context": ["本仓库用 pnpm，禁止 npm install"],
  "rules": [{ "tool": "Bash", "pattern": "git push --force", "decision": "deny", "reason": "禁强推" }]
}
```

- **命令**：`/guardrails`（查看当前生效声明）
- **钩子**：`SessionStart` ×2（规则注入 + 账本索引，独立失败域）+ `PreToolUse`（工具规则）

#### impeccable —— 设计能力（vendor 适配）

上游 24 个设计动词（`polish` / `critique` / `audit` / `bolder`…）+ 62 条确定性 AI-slop 检测器（Rust 引擎，无需 LLM）+ 自动设计钩子。上游文件零改动，适配层为 wrapper / 命令路由 / 钩子桥。

- **命令**：`/impeccable <verb> [target]`
- **钩子**：`PostToolUse`（Edit/Write 后自动扫描被改 UI 文件）
- **用法**：

```bash
# 会话内：说「把这个页面 polish 一下」或
/impeccable polish src/app.html

# 纯检测（CI 可用，--json / --github 出结构化结果）
npx impeccable detect src/
```

> 引擎二进制首跑自动下载（校验 checksum）；上游出新版按插件 README 的 re-vendor runbook 跟进。

### 技能（手动安装）

| 技能 | 作用 |
|---|---|
| [`doc-protocol`](skills/doc-protocol/SKILL.md) | 文档职责路由与进度真值协议：每类事实只有一个权威载体、唯一待办账本、热/温/冷分层与体量预算、会话开场/收尾清单。自包含（通用原则 + 落地层 + stock-agent 实例 + 体量闸脚本） |

```bash
cp -r skills/doc-protocol ~/.agents/skills/doc-protocol   # 或 ln -s 软链
```

## 安装

1. ZCode → **Settings → Plugins** → **Create → Add marketplace** → 选本仓库目录（克隆到本地即可）
2. 市场里对目标插件点 **Install**（默认启用）
3. **开新会话** —— hook 配置在会话启动时快照，运行中的会话不热加载

要求：ZCode 桌面版；钩子进程依赖 **Node**；`impeccable` 的设计钩子在 Windows 走 Git Bash 的 `sh`（ZCode 默认 shell 即是）。

## 为什么是这些插件

ZCode 的系统提示管线不弱，弱的是**可编程性与可移植性**。本仓库全部插件都在补机制缺口：

| ZCode 原生 | 后果 | 补足插件 |
|---|---|---|
| 记忆候选只写不读 | 全盘无消费者 | `memory-loop` |
| 项目自带约束门槛高（工作区 hooks 待信任） | 约束进不了工具调用层 | `project-guardrails` |
| 经验不沉淀、skill 库无观测 | 坑重踩、预算超限触发率骤降 | `skill-forge` |

完整分析（含 7 个 hook 事件的字段级契约、`runnable` / `diagnosticOnly` / `unsupported` 三档兼容性清单）见 [`docs/analysis/zcode-capability-gaps.md`](docs/analysis/zcode-capability-gaps.md)。

## 文档导航

| 想了解 | 去哪 |
|---|---|
| 单个插件的安装 / 验证 / 回滚 | `plugins/<name>/README.md` |
| 参与贡献：新增插件 / 技能、hooks 开发规矩、排查手册 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| ZCode 能力缺口分析（选题依据） | [docs/analysis/zcode-capability-gaps.md](docs/analysis/zcode-capability-gaps.md) |
| 跨会话设计笔记与账本 | [HANDOFF.md](HANDOFF.md) |
| 技能目录约定 | [skills/README.md](skills/README.md) |

## 贡献

欢迎 PR。新增插件/技能的完整流程、hooks 输出协议、实测踩坑清单见 [CONTRIBUTING.md](CONTRIBUTING.md)。注意两条红线：插件 `name` 必须匹配 `^[a-z0-9][a-z0-9._-]{0,127}$`；发版时 **plugin.json 与 marketplace.json 的版本号必须一起动**（更新检测口径）。

## 许可证

**MIT** —— 见 [LICENSE](LICENSE)。

`impeccable` 插件 vendor 自 [pbakaus/impeccable](https://github.com/pbakaus/impeccable)（**Apache-2.0**，版权属 Paul Bakaus 及贡献者，见 [plugins/impeccable/LICENSE](plugins/impeccable/LICENSE) 与 [NOTICE.md](plugins/impeccable/NOTICE.md)）；其上的适配层随本仓库以 MIT 分发。
