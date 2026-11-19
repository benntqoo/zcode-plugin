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
| [`skill-forge`](plugins/skill-forge/README.md) | 1.1.6 | 机制 · 经验沉淀 | 多步任务后自动把可复用做法沉淀成 skill，并在使用中顺手修正已有 skill |
| [`memory-loop`](plugins/memory-loop/README.md) | 1.0.4 | 机制 · 记忆闭环 | 消费记忆候选 → 按 cwd 分流 → 蒸馏 → 会话开始自动注入 |
| [`project-guardrails`](plugins/project-guardrails/README.md) | 1.1.5 | 机制 · 项目护栏 | 项目级约定与工具规则 + 会话开场自动注入待办账本索引（零配置） |
| [`impeccable`](plugins/impeccable/README.md) | 4.9.1 | 能力 · 设计 | 上游 [pbakaus/impeccable](https://github.com/pbakaus/impeccable) 的 ZCode 适配版：设计词汇表 + AI-slop 检测器 |
| [`taste-skill`](plugins/taste-skill/README.md) | 2.5.1 | 能力 · 设计 | 上游 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) 的 ZCode 适配版：反平庸公司站建站方法论 + Stop 完成闸门（GATE: PASS） |

#### skill-forge —— 经验自动沉淀

任务收尾时，agent 若走了 5 步以上、踩过非显然的坑、或定下了会重复用到的约定，会自动把经验写成项目级 skill（落在 `<repo>/.zcode/skills/`，随 git 走、可 review）。

- **命令**：`/skill-forge`（手动触发沉淀）· `/skill-audit`（盘点 skill 库预算与同名遮蔽）
- **钩子**：`Stop`（沉淀提醒）+ `SessionStart`（compact/clear 后重注入规则）
- **用法**：钩子装完即生效；三条铁律需追加到 `~/.zcode/AGENTS.md` 才常驻（主渠道——钩子只在 compact/clear 后补刀），可复制全文见其 README「安装」第 4 步

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

#### taste-skill —— 反平庸建站（vendor 适配）

上游 111k+ stars 的「让编码智能体有品味」前端 skill：按生意六分类发牌调色板 / 字体配对 / hero 布局，强制真实照片与真实产品 UI，五宽度无头 Chrome 一致性检查 + `gate.mjs` 完成闸门（扣住收尾直到 `GATE: PASS`）。上游零改动 vendor；ZCode 桥为 `/taste-skill` 命令 + 插件级 Stop 钩子（上游写在 skill frontmatter 的 `hooks:` 块会被 ZCode 静默忽略）。

- **命令**：`/taste-skill <brief 或目标>`（description 触发句超出 ZCode 的 250 字符注入窗，自动触发弱化，拿不准就点名）
- **钩子**：`Stop`（完成闸门；未布防 / 异常 / 他人会话一律放行，不卡死）
- **要求**：Node 22+；Chrome / Edge / Chromium（闸门要跑无头浏览器）

> **两个设计插件的分工**：建公司站 / landing page → `taste-skill`（从零建，闸门兜底）；审 / 改现有界面（dashboard、组件也含）→ `impeccable`（critique / detect / polish）。应用型 UI（SaaS 后台 / 移动端）的 design-system 选型不在两者范围内，需要时**显式调用**外部选型类技能（如 `ui-ux-pro-max`）——这两件设计能力落地后，此类技能已无自动触发的必要，保留手动入口即可。

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
4. **仅 skill-forge 有额外一步**：把三条铁律追加到 `~/.zcode/AGENTS.md`（可复制全文见 [`plugins/skill-forge/README.md`](plugins/skill-forge/README.md)「安装」第 4 步）。其余四个插件零配置，**不需要**往 AGENTS.md 写任何说明——约定注入、工具规则、设计扫描、完成闸门全部由钩子自带，重复写会形成第二个真值源，漂移比缺失更糟

要求：ZCode 桌面版；钩子进程依赖 **Node**；`impeccable` 的设计钩子在 Windows 走 Git Bash 的 `sh`（ZCode 默认 shell 即是）。

## 自检与测试

```bash
node --test tests/*.test.mjs       # 单元 + parity 夹具（含 M1 死行判定对齐 Python 真源的回归）
node scripts/healthcheck.mjs       # 五面体检：版本三方对账 / 缓存逐字节 / 规范审计 / 体量闸 / 遥测摘要
node scripts/healthcheck.mjs --ci  # CI 模式（跳过依赖本机安装态的检查面）
```

单人使用没有外部报障渠道，所以钩子自带**轻量遥测**：每次输出/放行同步追加一行到 `~/.zcode/hooks/plugin-telemetry.jsonl`（512KB / 2000 行自动轮转，本机文件、无任何上报；`PLUGIN_TELEMETRY=off` 关闭）。GitHub Actions 每周一跑同一套体检（[`.github/workflows/health.yml`](.github/workflows/health.yml)），配合本地定时体检构成双传感器。

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

`impeccable` 插件 vendor 自 [pbakaus/impeccable](https://github.com/pbakaus/impeccable)（**Apache-2.0**，版权属 Paul Bakaus 及贡献者，见 [plugins/impeccable/LICENSE](plugins/impeccable/LICENSE) 与 [NOTICE.md](plugins/impeccable/NOTICE.md)）；`taste-skill` 插件 vendor 自 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)（**MIT**，版权属 Leonxlnx，见 [plugins/taste-skill/LICENSE](plugins/taste-skill/LICENSE)）。两者之上的适配层随本仓库以 MIT 分发。
