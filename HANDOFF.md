# HANDOFF — zcode-plugin 市场

> 更新：2026-10-04 04:45
> 状态：仓库共 **3** 个插件。`skill-forge` 已装 1.1.2 并已生效；
> **`memory-loop` 与 `project-guardrails` 为新建（各 1.0.0），尚未安装到 ZCode。**
> 新会话直接从这里接。
>
> 第一 ~ 十节是 `skill-forge` 的交接笔记。新插件见「十一」。

**最新变更（2026-10-04）**：

- **v1.1.0**：skill 落点从全局库 `~/.zcode/skills/` 改为**当前项目**的 `<repo>/.zcode/skills/`，
  新增 `hooks/lib/project.js` 做路径解析。详见「八、落点为何是项目级」。
- **v1.1.1**：一次「已装已用」状态审计后的修补（4 项），详见「九、v1.1.1 改了什么」。
- **v1.1.2**：仓库身份统一为 `Jrtou` + 补 `LICENSE`，详见「十、v1.1.2 改了什么」。
- **新增两个插件**：`memory-loop`（记忆闭环消费者）与 `project-guardrails`（项目级约束），
  各 1.0.0。详见「十一」。

---

## 一、这个项目是什么

`D:\Code\zcode-plugin` 是一个 **ZCode 本地插件市场仓库**，里面打包了一个插件 `skill-forge`。

它要做的事：**让 ZCode 的 agent 在多步任务后自动把可复用的做法沉淀成 skill，并在用的时候顺手修好已有的 skill。**

对应 WorkBuddy 那套「任务完成 → 提炼 skill → 下次会话生效 → 用中发现即改」的闭环。

### 为什么需要它

- ZCode 自带 `$. skills` 系统 —— **存储和加载通道齐全**，缺的是「驱动器」
- 官方 `skill-creator` 插件是纯 skill，**零 hook**，不会提醒 agent「该沉淀了」
- 所以本插件补的是**时机**（hooks），不是**方法**（skill-creator 已覆盖方法）

---

## 二、仓库结构

```
D:\Code\zcode-plugin\                   ← ZCode「Add marketplace」指向这里
├── marketplace.json                    市场清单（plugins[0].source = "./plugins/skill-forge"）
├── HANDOFF.md                          本文件
└── plugins\skill-forge\
    ├── .zcode-plugin\plugin.json       插件清单（name/version/commands/hooks）
    ├── README.md                       安装与验证说明
    ├── commands\
    │   ├── skill-forge.md              /skill-forge
    │   └── skill-audit.md              /skill-audit
    └── hooks\
        ├── hooks.json                  SessionStart(compact|clear) + Stop
        ├── session-skill-rules.js      压缩后重新注入三铁律
        ├── stop-skill-nudge.js         兜底推一次
        └── lib\
            ├── io.js                   自带的 hook I/O 库
            └── project.js              解析项目级落点（含 home 保护）
```

---

## 三、已完成

| 项 | 状态 |
|---|---|
| 插件包 10 个文件 | ✅ 已生成并迁移到 `D:\Code\zcode-plugin` |
| git 仓库 | ✅ 远端 `git@github.com:benntqoo/zcode-plugin.git`（main） |
| GUI 安装 | ✅ 市场已注册、插件已启用（实测确认） |
| **落点改项目级** | ✅ v1.1.0 —— 6 处路径全改 + 新增 `hooks/lib/project.js` |
| **v1.1.1 四项修补** | ✅ 源码已改（io.js / project.js / stop-skill-nudge.js / skill-forge.md），待重装 |
| **v1.1.2 身份统一 + LICENSE** | ✅ 已改（marketplace.json / plugin.json / 根 README / LICENSE），待重装 |
| **「已装已用」状态审计** | ✅ 2026-10-04 —— 见「九」 |
| 语法检查（4 个 js） | ✅ `node --check` 全过 |
| 冒烟测试 | ✅ 9 组场景全过（见下） |
| `~/.zcode/AGENTS.md` | ✅ 三铁律已加，落点已改为项目级 |
| AGENTS.md 备份 | ✅ `~/.zcode/AGENTS.md.bak-20261003` |
| 旧路径清理 | ✅ `~/.zcode/plugin-workspace/` 已空 |

### 冒烟测试实测记录

| 用例 | 期望 | 实测 |
|---|---|---|
| 完成动作+经验信号+具体路径 | 触发 `{"decision":"block",...}` | ✅ |
| 回复里已出现 `SKILL.md` | 放行（空输出） | ✅ |
| `stop_hook_active: true` | 放行（防递归） | ✅ |
| 同 session 第二次 | 放行（节流） | ✅ |
| `SessionStart/compact` | 注入三铁律 | ✅ |
| 状态文件记账 | `{"pt1":1,"pt4":1,...}` | ✅ |
| **T1** cwd=git 项目 | 触发，路径指向 `<repo>/.zcode/skills/` | ✅ |
| **T2** cwd=home | 放行（全局库保护生效） | ✅ |
| **T3** SessionStart cwd=git 项目 | 注入文本含项目路径 | ✅ |
| **T4** cwd=子目录 | 向上解析到仓库根 | ✅ |
| **T5** cwd=home 下裸目录 | 放行（保守，见下） | ✅ |
| **T6** cwd 缺失 | 回退 `process.cwd()`，不崩 | ✅ |

`resolveSkillTarget()` 全场景实测：

| cwd | 判定 | 落点 |
|---|---|---|
| `D:/Code/zcode-plugin` | OK | `D:/Code/zcode-plugin/.zcode/skills` |
| `D:/Code/zcode-plugin/plugins/skill-forge` | OK | 同上（向上找到仓库根） |
| `D:/Code/SideProject/Lumi` | OK | `D:/Code/SideProject/Lumi/.zcode/skills` |
| `C:/Users/Ben` | **SKIP** | 落点与全局库重合 |
| `C:/Users/Ben/SomeBareDir` | **SKIP** | 向上命中 home 的 `.zcode`，判为全局 |
| `C:/Users/Ben/.zcode` | **SKIP** | 同上 |

> ⚠️ T5 是**有意的保守行为**：home 下没 `.git` 也没自有 `.zcode` 的裸目录会被判成 home 级而不推。
> 想在那里沉淀，`git init` 或建一个 `.zcode/` 即可（`findProjectRoot` 就近优先，会先命中它）。

> ⚠️ 踩过的坑：测试消息若短于 **80 字符**会被 `trim().length < 80` 拦掉，看起来像「没触发」。
> 复测时用完整长度的消息（实测 285 字节可用）。

---

## 四、待办

1. ~~添加市场~~ ✅ 已完成（`known_marketplaces.json` 里有 `zcode-plugin`，源 `D:\Code\zcode-plugin`）
2. ~~安装插件~~ ✅ 已完成（`cli/config.json` → `"skill-forge@zcode-plugin": true`）

3. ~~**重装到 v1.1.0**~~ ✅ **已完成（2026-10-04 核对）**
   实测：`installed_plugins.json` → `version: "1.1.0"`；安装缓存与仓库源码 `diff -r` **零差异**；
   市场缓存副本 `~/.zcode/cli/plugins/marketplaces/zcode-plugin/` 亦一致。
   启动日志 `bootstrap.app.startup.plugins.completed` 给出 `hookCount: 0 → 2`、
   `commandRootCount: 0 → 1`（装插件前后对比）—— 钩子确实挂上了。

4. ~~**重装到 v1.1.2**~~ ✅ **已完成（2026-10-04 04:06 核对）**
   实测：`installed_plugins.json` → `version: "1.1.2"`，`installPath` 指向 `…/cache/zcode-plugin/skill-forge/1.1.2`；
   旧版本目录已清空（只剩 `1.1.2`）。仓库源码 vs 安装缓存 `diff -r` **零差异**；
   vs 市场缓存副本 `~/.zcode/cli/plugins/marketplaces/zcode-plugin/plugins/skill-forge/` 亦**零差异**。
   `config.json` 的 `enabledPlugins` 仍为 `true`。
   ⚠️ 副作用：**重装会清空插件数据目录** —— 原来那个 `nudge-state.json` 已消失、目录被重建。
   ⇒ 这里的任何状态都必须能从零重建，不能当持久存储。（已记入根 `README.md` 与技能库）

5. **开新会话验证** ← **当前唯一待办**
   ⚠️ **此刻还没生效**：重装于 `2026-10-03T20:06:12Z`，而日志里最近一次
   `bootstrap.app.startup.plugins.completed` 是 `2026-10-03T17:14:22Z`（＝ 01:14 CST，重装前）。
   两者之间没有任何会话启动 ⇒ **当前会话仍在跑 v1.1.0 的钩子快照**。
   hooks 在会话启动时快照、不热加载 —— 必须**开新会话或重启应用**才切到 1.1.2。
   （别拿日志 mtime 判断：本会话一直在写日志，mtime 是「现在」；只认 `timestamp`。）
   ZCode 在会话启动时快照 hook 配置，**不热加载**。
   - 打 `/` 应看到 `skill-forge`、`skill-audit`
   - 跑一个会踩坑的多步任务 → 看回复末尾写的是 **`<当前项目>/.zcode/skills/`** 而非 `~/.zcode/skills/`

---

## 五、未验证 / 存疑（别当结论用）

| 项 | 说明 |
|---|---|
| ~~`marketplace.json` 的位置~~ | ✅ **已验证**（2026-10-04）：放仓库根即可，市场成功添加 |
| ~~`plugins/` 子目录约定~~ | ✅ **已验证**：插件从 `plugins/skill-forge/` 成功安装并启用 |
| `ZCODE_PLUGIN_ROOT` 变量替换 | 插件能跑说明替换生效（**间接**验证）；展开后的具体路径**未直接观测** |
| 原 `io.js:113` 的 `emitContinue` | 用 legacy 的 `{continue:true, stopReason}` 格式，官方推荐 `{decision:"block", reason}`。**本插件绕开了它**（自带 io.js），原有那个没改、没测 |

---

## 六、设计决策（别改回去）

1. **SessionStart 只匹配 `compact|clear`，不含 `startup`**
   正常启动靠 AGENTS.md 注入规则；再注入一遍是白烧 token。只有压缩后才补刀。

2. **Stop 钩子最多每 session 推 1 次**
   `decision:block` 会让模型多跑一整轮、用户要等。WorkBuddy 的静默沉淀在 ZCode 做不到，所以只兜底不主攻。

3. **三道闸顺序不能动**
   `stop_hook_active` → 已提 SKILL.md → 信号三连（完成+经验+路径）→ 节流。任何一道去掉都会导致刷屏或死循环。

4. **`type: "process"` + args 数组，不用 `type: "command"`**
   ponytail 用 shell 引号包路径，Windows 上有风险。官方推荐 `process`。

5. **插件自带 `hooks/lib/io.js`，不 import 用户级**
   插件不该依赖 `~/.zcode/hooks/lib/`，否则用户改自己的 lib 会把插件搞坏。

---

## 七、遗留问题（与本插件相关但未处理）

- **272 条 `memory-candidates.jsonl` 积压未消化**
  路径 `~/.zcode/hooks/memory-candidates.jsonl`，横跨 2026-08-05 → 10-03。
  `stop-memory.js` 只写不消费。本插件只管新账（skill），没管旧账（memory 候选）。
  建议：先抽样 20 条看质量，再决定是否聚合成 skill，**别直接删**。

- ~~**是否 git init**~~ **已完成（2026-10-04）**
  已初始化为 git 仓库，默认分支 `main`，远端 `git@github.com:benntqoo/zcode-plugin.git`。
  首个提交 `b9a99f1`，本地与远端一致。含 `.gitignore`（排除 `node_modules`、`_c*.mjs` 等测试残留）。

- **ZCode 原生 Project Memory 开关**
  `Settings → General → Memory`，默认关闭。与本机制职责重叠且**不可浏览/不可清除**。建议二选一。

---

## 八、落点为何是项目级（v1.1.0 变更）

**变更动机**：v1.0.0 一律写 `~/.zcode/skills/`（全局库）。头头要求 skill 归属项目，不污染全局。

### 事实依据（ZCode 官方 `zcode-configuration-guide` v0.3.0）

| 作用域 | Skills 路径 |
|---|---|
| 用户级 | `~/.zcode/skills/`、`~/.agents/skills/` |
| 工作区级 | `<repo>/.zcode/skills/`、`<repo>/.agents/skills/` |

扫描顺序（早的优先）：explicit roots → 用户 `.zcode` → 用户 `.agents` → **工作区 `.zcode`（从 cwd 向上到仓库根，每层都算）** → 工作区 `.agents` → 插件。
同级内 `.zcode` 先于 `.agents`；**越深的目录越优先**。

### 三条反直觉规则（都会咬人）

1. **用户级优先于工作区级** —— 「first same-named skill wins (**user scope has priority**)」。
   全局库里有同名 skill，项目级那份**被静默遮蔽**，症状隐蔽（文件在、改了不起作用）。
2. **逐层向上扫描** —— 子目录里也可能有自己的 `.zcode/skills/`，且优先级更高。
3. **插件全局生效** —— 一套钩子在所有工作区跑，所以路径**必须**按 `cwd` 现算，写死必错。

### 实现

- 新增 `hooks/lib/project.js` → `resolveSkillTarget(cwd)`
  - `findProjectRoot()`：从 cwd 向上找**最近的** `.git` 或 `.zcode`（同等权重，先撞上谁算谁），
    都没有则回退 cwd（最多向上 40 层）。v1.1.1 前是「`.git` 绝对优先」，会让高位的 `.git`
    越过低位自带的 `.zcode`，算出的落点与 ZCode 实际读取的位置不一致 —— 已改为就近优先。
  - 返回 `{ root, skillsDir, isUserLevel }`
- `isUserLevel = true` 的两种情况：`root` 就是 home，或解析出的 `skillsDir` 与 `~/.zcode/skills` 路径重合
  → **Stop 钩子直接放行**，SessionStart 退回用户级路径
  → 这条是**必需的**：cwd=home 时「项目级 `.zcode/skills`」字面上就等于全局库，不挡就会打着「项目专属」的旗号写全局
- 两个钩子都改成从 payload 的 `cwd` 现算（该字段存在，已由 `stop-memory.js:33`、`session-context.js:25` 印证）

### 规则与产物的作用域是分开的（有意）

| | 位置 | 作用域 |
|---|---|---|
| 三条铁律（规则） | `~/.zcode/AGENTS.md` | 所有工作区 —— 每个项目都具备沉淀能力 |
| 产出的 SKILL.md | `<repo>/.zcode/skills/<name>/` | 只有当前项目 |

头头选的组合是「规则全局、落点项目」，不是「全都项目级」。

---

## 九、v1.1.1 改了什么（2026-10-04 审计后）

审计范围：插件源码、安装缓存、市场缓存、启动日志、真实产出（stock-agent 的两个 skill）。
**结论：无 P0 缺陷** —— 线上 v1.1.0 一直正常工作。以下 4 项是审计中发现的真实问题。

| # | 问题 | 证据 | 改法 |
|---|---|---|---|
| 1 | `/skill-forge` 用相对路径 `ls .zcode/skills/` | 从子目录触发时会打印「本项目还没有 skill 目录」，把模型推向**新建重复 skill**，正好撞上同文件「已有覆盖就改不要新建」 | 改成 `git rev-parse --show-toplevel` 后列 `$ROOT/.zcode/skills/` |
| 2 | frontmatter 白名单三处不一致 | `AGENTS.md` 与 `session-skill-rules.js` 列 5 字段，`stop-skill-nudge.js` 只列 4（漏 `license`） | 补齐 `license` |
| 3 | `nudge-state.json` 只增不减 | key = session_id，无上限，每次 Stop 全量读+写 | 保留最近 200 个会话，写入前剪枝 |
| 4 | `process.stdout.write` 后立刻 `process.exit(0)` | Windows 管道写是异步的，理论可截断（实测 5 次全 898 字节完整，**未复现**） | 换 `fs.writeSync(1, json)` |

另两处清理：`project.js` 的死字段 `relPath` 已删；`findProjectRoot` 的注释与实现对齐（见「八」）。

### 审计中已验证为真的事实（可复用）

- **怎么证明插件真生效**（别翻设置页）：

  ```bash
  grep "bootstrap.app.startup.plugins.completed" ~/.zcode/cli/log/zcode-$(date +%F).jsonl | tail -1
  ```

  `hookCount` 是全局钩子注册数（装前 0 → 装后 2）；`commandRootCount` 同理。
  `skillRootCount` 是**根**数不是条目数，别拿它对账 skill 数量。
- 插件数据目录：`~/.zcode/cli/plugins/data/skill-forge@zcode-plugin/`（钩子内由环境变量给出，
  实测 `ZCODE_PLUGIN_DATA` 可用）。真实触发过一次：`nudge-state.json` = `{"sess_5256dc5c-…":1}`。
- 安装记录：`~/.zcode/cli/plugins/installed_plugins.json`（version / installPath / scope）。
- 市场缓存 `marketplaces/<id>/` 是仓库的**副本**（自带 `.git`），不是软链。
- 4 个 js `node --check` 全过；钩子实测耗时 435ms（timeout 8000ms）。
- 落点解析 9 个 cwd 场景全对（home 保护 / 子目录上溯 / UNC / 不存在的路径）。
- 产出合规：stock-agent 两个 skill 的 `description` 分别 146 / 163 字符，
  字段为 `name/description/when_to_use/metadata`。

### 未验证 / 待确认

- **Stop 上挂着两个钩子**：用户级 `~/.zcode/hooks/stop-memory.js` 输出 `additionalContext`，
  本插件输出 `decision:block`。官方文档没说多钩子的输出如何合并。**未做对照实验** ——
  想确认就临时停掉一个，各跑一次对比。

### 相邻发现（不是本插件，但同一个 Stop 事件）

`~/.zcode/hooks/memory-candidates.jsonl`：**275 条 / 249 KB**（2026-08-05 → 10-03）。
全盘搜索只有生产者 `stop-memory.js` 引用它自己 —— **没有消费者**，每次 Stop 都在 append。
按项目分：stock-agent 238、Lumi 19。建议先抽样 20 条看质量再决定，**别直接删**。

---

## 十、v1.1.2 改了什么（2026-10-04）

仓库身份统一 + 补许可证文件。**无功能性改动**，钩子逻辑一个字没动。

| # | 项 | 改前 | 改后 |
|---|---|---|---|
| 1 | 根 `LICENSE` | **不存在**（`plugin.json` 却已声明 MIT —— 声明不生效） | 新增 MIT 全文，`Copyright (c) 2026 Jrtou` |
| 2 | `marketplace.json` → `owner.name` | `Ben` | `Jrtou` |
| 3 | `plugins/skill-forge/.zcode-plugin/plugin.json` → `author.name` | `Ben` | `Jrtou` |
| 4 | 版本号 | `1.1.1`（两处） | `1.1.2`（两处同步） |
| 5 | 根 `README.md` | 只说明「声明了 MIT 但没有 LICENSE」 | 指向 `LICENSE`，删掉待定项 |

**为什么 bump 而不是静默改**：`plugin.json` 在插件目录内，改了它就是改了插件内容。
虽然本次是从 1.1.0 跨版本重装、不 bump 也会被复制，但按仓库自己的规矩
（见根 `README.md`「新增一个插件」第 4 步）内容变了就该有版本号 —— 避免留下
「同一个 1.1.1 有两份不同内容」的历史。

署名口径：**统一用 `Jrtou`**（git 提交者 `Jrtou <benntqoo@gmail.com>`），不再混用 `Ben`。

---

## 十一、memory-loop 与 project-guardrails（2026-10-04 新建）

来自 `docs/analysis/zcode-capability-gaps.md` §4 选题清单里头头选中的 #2 / #3。
动手前先做了一轮**源码级前置验证**，结果推翻了那份文档附录里的两条「未验证」。

### 前置验证结论（已改写进根 README 与技能库）

| 项 | 结论 |
|---|---|
| `async: true` 语义 | 源码 `E0n()`：`executionMode: type==="command" && async===!0 ? "background" : "foreground"`。⇒ **只对 `type:"command"` 生效，语义是「丢到后台执行」，不是「延后注入上下文」**；`process` 型根本没有这个字段 |
| 多钩子合并 | 源码 `_Qs()`：`additionalContext` 是 **`push` 累积、不覆盖**；`permissionDecision` 覆盖式，最终归并 `deny > ask > 其它`。**（原文档标「未验证」，现已确认）** |
| `hookSpecificOutput` | 实为 **7 个分支、每事件一个**；能影响工具调用的**只有 `PreToolUse` 与 `PermissionRequest`**。**（原文档说「只确认 3 个」，是错的）** |
| 项目级配置 | `<repo>/.zcode/config.json` 支持 `plugins.options`，且 **workspace 覆盖 user**（与 MCP 的 user-over-workspace 方向相反） |
| 用户已有 4 个用户级钩子 | `guard-bash`(PreToolUse) / `session-context`(SessionStart) / `prompt-router`(UserPromptSubmit) / `stop-memory`(Stop)，注册在 `~/.zcode/cli/config.json`。⇒ **直接决定了两个新插件的定位** |

### 口径（头头选定的三条，均为推荐项）

1. **#2 记忆落点 = 项目内独立文件** `<repo>/.zcode/memory/MEMORY.md`，由 SessionStart 钩子注入。
   不写 `AGENTS.md`（会污染、膨胀不可控），也不写 ZCode 原生 memory（`features.memory.enabled`
   默认 false，且无消费者）。
2. **#3 与全局 `guard-bash` = 项目级增量规则**，全局那份保留兜底，两者并存。
3. **两个插件分开打包**，各自可独立启停。

### memory-loop（1.0.0）

补上记忆链路的**消费者** —— 上游 `stop-memory.js` 只写不读，已积压 276 条 / 256 KB。

| 文件 | 作用 |
|---|---|
| `hooks/ingest-candidates.mjs` | `Stop`。读源 jsonl 增量 → 按候选的 `cwd` 解析项目根 → 写 `<repo>/.zcode/memory/candidates.jsonl`，内容指纹去重。**纯副作用，不注入任何上下文** |
| `hooks/recall-memory.mjs` | `SessionStart`。注入 `MEMORY.md`（上限 4000 字符，超出截断）+ 一句未蒸馏提示 |
| `commands/memory-loop.md` | 手动蒸馏：读候选 → 判断值得留的 → 整理进 `MEMORY.md` → 推进游标 |

**关键设计：蒸馏故意不自动化。** 脚本判断不了「这条值不值得记」，把语义判断写死成启发式只会产噪音。
机械部分（分流 / 去重 / 注入）全自动，语义部分（蒸馏）由 `/memory-loop` 触发。

数据落点全在项目内（可 review、可进 git）：`candidates.jsonl` / `MEMORY.md` / `state.json`。
唯一的例外是消费游标 `ingest-state.json`，放插件数据目录 —— **重装会清空它，这是设计允许的**：
丢了只需重扫，项目侧的指纹去重会兜住。

### project-guardrails（1.0.0）

补上「**工作区级 hooks 被整体忽略**」造成的缺口 —— 用**用户级**插件代理读取项目声明文件。

| 文件 | 作用 |
|---|---|
| `hooks/session-rules.mjs` | `SessionStart`。注入 `.zcode/guardrails.json` 的 `context[]` |
| `hooks/pretooluse-guard.mjs` | `PreToolUse`（**matcher 故意省略** = 全匹配）。按 `rules[]` 返回 deny / ask |
| `commands/guardrails.md` | `init` / `check` / 自然语言加规则 |

**关键设计：fail-open。** 配置读不到 / 坏了就放行 —— 它是用户自己写的项目配置，**不是安全边界**，
不能因为它写错就把会话卡死。坏正则逐条忽略，不影响同文件其它规则。
`PreToolUse` 省略 matcher 换来通用性，代价是每次工具调用一次进程启动 —— 所以脚本第一件事是
「没有规则文件就立刻退出」。

### 测试

`_probe.sh`（**纯 bash 驱动** —— 沙箱会拦脚本内部嵌套 spawn 子进程）→ **35 / 35 全过**：

- **ingest**：分流（含反斜杠 cwd 归一化）、游标增量、重复触发幂等、游标丢失后指纹去重兜底，
  以及非 Stop / `stop_hook_active` / home / 源文件缺失 四道闸门
- **recall**：无记忆不注入、正常注入、未蒸馏提示、蒸馏后不再提示、超长截断、home、错事件
- **guardrails**：无文件不介入、context 注入、deny / ask / 放行、`tool` 限定、非 Bash 工具匹配、
  camelCase payload、坏 JSON fail-open、只有 `context` 无 `rules`

耗时：前台钩子各约 **85 ms**（node 启动占大头），远低于 `timeoutMs`。

> 测试脚本自身踩过一次坑：断言用的 payload 文件在断言**之后**才创建，导致「空跑通过」。
> 已在 `run()` 里加了 payload / 钩子的存在性自检，缺文件直接判 FAIL。**同类问题以后要防。**

### 未验证（别当结论）

- **两个插件都没有在真实会话里跑过。** 全部证据来自对脚本的直接调用；
  「ZCode 真的会在每轮 Stop / 每次工具调用时调它们」这一步**没有实测**。
- `userConfig` 虽属 runnable 档，但**它的值以什么形式进入钩子进程未验证**（env 名？`${}` 替换？）。
  所以两个插件**都没用 userConfig**，改用环境变量 + 项目内约定文件，绕开这个未知。
- `PreToolUse` 全量 matcher 的**真实性能影响未测**（只有单次 85 ms 这个数字）。

### 待办

1. 在市场里 Install 这两个插件 → **开新会话**。
2. 装完读日志核对 `hookCount`（应先从 `2` 增加 —— 新增 4 个钩子条目；确切口径待实测）。
3. 首次实战观察：跑过一轮后，`<repo>/.zcode/memory/candidates.jsonl` 是否被创建。
