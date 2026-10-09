# doc-protocol 体量治理 —— 外部最佳实践对照与优化方案

> ⚰️ **已退役（2026-10-05）** —— 本文件已并入
> [`doc-protocol-bloat-and-entrypoints-impl-2026-10-05.md`](doc-protocol-bloat-and-entrypoints-impl-2026-10-05.md)（合并版实施单）。
> 保留仅作时点证据（外部最佳实践对照与 R1~R6 → R1'~R8' 的推导过程）。**新内容一律进合并版，不再更新本文件。**

- 日期：2026-10-05
- 上游：`docs/reviews/doc-protocol-handoff-bloat-review-2026-10-05.md`（实测 + 初版建议 R1~R6）
- 本文件：**查外部成熟实践，把 R1~R6 升级为 R1'~R8'**
- 状态：**规划件，未改动任何代码或配置。** 不含实施动作。

---

## 0. 一句话结论

**外部行业已经把这个问题解过很多遍，且方案高度收敛。** 我们的 R1~R6 方向对，但缺三样
行业标配：**①"热/温/冷"三层要显式定义并各配生命周期**；**②淘汰要绑在生命周期事件上（收尾），
不是绑在体量阈值上**；**③阈值必须落成闸（脚本/hook），不是提示词。**

其中**改动最大的一条是 R1**：原方案是"划掉后过一周期移出"（仍依赖"记得到期"），
升级为**"活表只允许未完成项"这个不变量**（可机械校验，无需记时间）。
依据是 DPM/记忆分层的通用做法：**账本 = 追加型事件日志（冷）+ 未完成投影（热）**。

---

## 1. 外部最佳实践（四套体系，逐条可溯源）

### 1.1 Anthropic《Effective Context Engineering for AI Agents》（2025-09）

被引用最多、也最权威的一份。核心三招：

| 招 | 内容 | 对我们的映射 |
|---|---|---|
| **Compaction** | 到预算就蒸馏历史并继续；**保留**决策/路径/计划，**丢弃**探索轨迹与冗余工具输出 | 段区归档 ≈ compaction；但我们要"可恢复"（见 1.3） |
| **Structured note-taking** | agent 把状态**写进上下文之外的文件**（todo、NOTES.md），需要时读回 | 这正是 handoff/账本；**关键是"读回"要有指针** |
| **Sub-agent 隔离** | 子代理烧自己的窗口，只回摘要 | ZCode 已有；本问题不用 |

同一份文档里还有两条硬话：
- 目标 = **"the smallest set of high-signal tokens"**（最小高信号 token 集）。
- **`CLAUDE.md` 内容每次请求都重新注入** ⇒ 持久规则放这里，别放初始 prompt。
  推论：**指令文件是"每会话固定成本"，任何加进去的字都在稀释真正重要的规则。**

> 出处：https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

### 1.2 记忆分层 + 生命周期（AWS / 4-tier memory / DPM）

行业共识是四层：

```
Tier 1 Working   —— 当前任务上下文（= 上下文窗口）
Tier 2 Episodic  —— 带时间戳的经历/工具调用记录
Tier 3 Semantic  —— 抽象事实与规则（架构决策、规范）
Tier 4 Procedural—— 技能/SOP（= skills、AGENTS.md 约定）
```

关键**不是"分四层"本身，而是每层要有生命周期四动作**（AWS 记忆模块原文）：
**写入条件 → 晋升门槛 → 检索优先级 → 淘汰规则**。

- **写入**：不是所有内容都值得记；要有重要性判据。
- **晋升**：低级层不能无门槛升到高级层（"原始日志禁止直接晋升为事实"）。
- **检索**：**级联检索** —— 上层命中足够就不查下层（省上下文）。
- **淘汰**：**"从未被访问的记忆应归档或删除"**；带时间衰减；事实冲突要版本化不覆盖。

一句话：**"热路径只保留本轮决策最小必需信息，大容量历史冷记忆按需回填。"**

> 出处：AWS China Blog《Agent 记忆模块的最佳实践》
> https://aws.amazon.com/cn/blogs/china/agentic-ai-infrastructure-deep-practice-experience-thinking-series-three-best-practices-for-agent-memory-module
> 另见 codefather 综述（DPM：追加型事件日志 + 任务条件投影，20× 压缩、仅 1 次 LLM 调用）

### 1.3 可恢复压缩（Manus）+ 渐进披露

**Manus 的教训**：不可逆压缩必然丢信息 —— *"你无法可靠地预测哪个观察结果可能在十步之后变得至关重要"*。
它的解法 = **先 offload 到文件系统保底，再做有损压缩**；"删掉网页内容但保留 URL"。

**渐进披露**（Progress Disclosure，行业标准做法）：
- 根文件保持精简 + 指针（"deployment details: see docs/deploy.md"）；
- skills 就是这个模式的正式化：**名字+一行描述进上下文，正文按需加载**；
- 口号：**"pay for context at use time, not at session start."**

> 出处：Manus《Context Engineering for AI Agents: Lessons from Building Manus》
> （中文编译见 zilliz.com.cn/blog/Context-Engineering-Showdown）
> 渐进披露：https://aiwiki.ai/wiki/context_engineering

### 1.4 12-Factor Agents · Factor 3 "Own Your Context Window"

- 上下文窗口是**注意力预算**，不是存储。
- **优先级淘汰**：核心指令 > 用户目标 > 近期消息 > 关键数据；"三句前的谢谢"最先丢。
- **Context Gate**：每样东西进入窗口前先问 "**Is this absolutely necessary for the next step?**"
- **预算制**：给不同类别定硬限（文中示例：核心记忆 ≤2K、检索内容 ≤4K）。
- 研究引用：**Dex Horthy 的"dumb zone"** —— 上下文窗口 40%~60% 那段模型召回最差；
  Anthropic 的建议触发点是 **~70% 即压缩**（而 Claude Code 的 auto-compact 是 95% 被动兜底）。

> 出处：https://deepwiki.com/dawuliang/12-factor-agents/2.3-factor-3:-own-your-context-window
> https://paddo.dev/blog/12-factor-agents/

### 1.5 Context Rot / Lost in the Middle（为什么必须控）

Chroma 实测 18 个 LLM：**输入越长，性能越降**；Liu et al. 确立 **U 形注意力曲线** ——
开头与结尾注意力集中，**中间显著衰减**。这与我们"账本钉顶"的设计**方向一致**，
但也意味着：**任何中间位置的长块都在被浪费。**

> 出处：arXiv:2307.03172；Chroma《Context Rot》

### 1.6 一句话最狠的（Jon Krohn field guide）

> **"An instruction is a probability while a hook is a guarantee."**
> 必须**绝不**发生的事，用**代码**强制，不用提示词。

以及同源的指令文件经验值：
- **frontier 模型约 150~200 条 standing instructions 后遵从度下降** —— 是个可用预算；
- **"陈旧指令比缺失更糟"**（说了假话会教模型不信任或照做）；
- **"steering 文件当代码管：有人负责、有评审、定期修剪。"**

> 出处：https://www.jonkrohn.com/posts/2026/8/31/claudemd-agentsmd-skills-hooks-and-subagents-a-field-guide-to-steering-ai-agents

---

## 2. 六条可迁移原则（从上面提炼）

| # | 原则 | 一句话 |
|---|---|---|
| **P1** | 上下文是预算 | 凡"每次必读"的东西都要有配额（字节/条数），无配额 = 必然膨胀 |
| **P2** | 分层 + 生命周期 | 每个载体明确它属于热/温/冷，并定义**写入/晋升/检索/淘汰** |
| **P3** | 压缩必须可恢复 | 先把全量写进冷层，再动热层；热层留指针（不是留内容） |
| **P4** | 渐进披露 | 根文件精简 + 指针；细节按需加载 —— 但**规则/决策不碎片化**（见 §4 张力） |
| **P5** | 主动 > 被动 | 在**生命周期事件**（收尾）触发整理，体量阈值只作兜底红线 |
| **P6** | 承诺用闸 | 阈值写成脚本/hook；提示词只是概率 |

---

## 3. 映射：我们的每个病灶 ↔ 外部原则 ↔ 优化动作

| 病灶（实测，见审查报告 §1） | 命中的原则 | 优化动作 |
|---|---|---|
| 账本 60% 死行永驻、无出口 | P2 淘汰 + P3 可恢复 | **R1'**：账本改"未完成投影"，完成项恒等移入冷层 |
| 账本行均 2,175 B、单行峰 5,249 B | P1 预算 | **R4'**：单行软上限 + 说明列上限 |
| 2000 行阈值对字节无感 | P1 预算（字节为准） | **R2'**：改双判据，字节为主 |
| AGENTS.md 91.5% 触顶、静默截断 | P1 预算 + P4 渐进披露 | **R6'**：字节 + **条数**双预算，超限抽叙事成独立文件 |
| 三个阈值全部"越线未执行" | **P6 闸** | **R5'**：脚本 + 两处消费点（收尾 / SessionStart 注入） |
| 归档是"搬家跑步机" | P2 分层 + P5 主动 | **R1'+R7'**：收尾即投影；段区明确为"温层" |
| 归档产物自身无上限 | P2 | **R7'**：冷层分片 + 每片上限 + 顶部指针 |
| 补记 ≤3 形同虚设 | P6 闸 | **R3'**：机械化校验 |
| 旧指令/旧结论滞留 | P4 + "陈旧比缺失更糟" | **R8'**：陈旧即删（不等阈值） |

---

## 4. 外部资料里的一条张力，以及我们的取舍

外部并非一致，有两条互相拉扯的主张，必须写清我们站哪边：

- **Lossfunk**：「**一体化 + 长上下文 > 多 Agent + RAG**」，碎片化检索会丢知识。
- **Memora / chroma 系**：「**98% token 缩减不损性能**」，压缩检索更优。

**我们的取舍**：**按内容性质分而治之** ——

- **规则 / 决策 / 边界**（语义层，小、稳定、必须精确）→ **整块保留在热层，不碎片化**
  （对齐 Lossfunk）。
- **叙事 / 过程 / 历史**（情节层，大、易变、少回看）→ **下沉冷层，按需 grep 回填**
  （对齐 Memora）。

⇒ 所以本方案**只压缩"叙事与死行"，绝不压缩"规则"**。这也是为什么 §5 的 R7' 明确
"段区降为温层"而不是"把规则也拆散"。

---

## 5. 优化后的方案（R1'~R8'，替代初版 R1~R6）

### R1' —— 账本改为「未完成投影」（升级 R1，**最高性价比**）

**不变量**：活账本**只允许** 🔴/🟡/⏳ 三种未完成行；**任何 `~~` 行都不得留在活表内**。

- 完成一个待办 = **同一收尾动作里两件事**：① 该行追加到冷层
  `docs/archive/handoff-ledger-<YYYY-MM>.md`（append-only，一行一条，含提交号）；
  ② 从活表**删除**该行。
- 活表里不放"已结账"区、不放"最近 N 行已完成"。**活表 ≠ 台账**：它是台账的一个**视图**（过滤）。
- 冷层是**追加型事件日志**（DPM 模型）；可复查性由它 + git 共同兜底，零信息损失。

**为什么比初版 R1 好**：初版"过一周期移出"仍要人记时间、判周期；本版是一个
**可机械校验的不变量**（`grep -c '~~' 活表 == 0`），无需记忆、无歧义。
直接砍掉 **60% 行 / ~55 KB**。

**外部依据**：P2 淘汰策略 + P3 可恢复压缩 + DPM（append-only log + 投影）。

### R2' —— 双预算，字节为主（升级 R2）

| 对象 | 预算 | 现状 |
|---|---|---|
| `handoff.md` 归档线 | 2000 行 **或** 500 KB（先到者） | 2044 行 / 648 KB ⇒ **已双越线** |
| **活账本** | **≤ 15 KB 且 ≤ 40 行** | 91 KB / 42 行 ⇒ 超 6× |
| **活跃待办条数** | **≤ 30 条**（软） | 42 条 ⇒ 应拆分或清理 |
| 冷层单片 | ≤ 500 KB（超出即开新片） | v1 已 476 KB |

新增"**活跃条数**"这一维：账本价值密度 = 未完成项数；条数过多本身就是"该收敛"的信号。

### R3' —— 补记 ≤3 机械化（升级 R3）

把"同日补记 ≤3、超过即开新段"写成可跑检查（`补记{N}` 计数）+ 段头格式校验
（`## YYYY-MM-DD(第N段)…`）。现挂 `scripts/`（该仓库已有守卫测试文化）。
实测 **≥17 段越限、最多 10 条** ⇒ 这条不机械化必然复发（E3）。

### R4' —— 单行软上限（升级 R4）

- 账本单行 ≤ **600 B**；段内单行 ≤ **800 B**；账本"下一步/备注"列 ≤ **200 字**。
- 超长内容移入 `docs/`，表内留**指针**（对齐 P3：留指针不留内容）。

### R5' —— 机械化体量检查（升级 R5，**根治项**）

`scripts/check-doc-budget.py`：输出**结构化 JSON**（各文档行数/字节、账本大小与死行数、
是否越线、补记是否超限、AGENTS.md 字节与条数）。

**两个消费点**（这条是关键 —— 对齐 P6）：
1. **收尾清单第 0 步**：跑它，退出码非零即红。
2. **`project-guardrails` 的 SessionStart 注入**（与
   `docs/plans/project-guardrails-entrypoints-task-2026-10-04.md` **合流**）：
   开场直接把 `账本 N KB / handoff N 行 / 已越线` 打进上下文 —— 让回弹**在越线前可见**。

**依据**：三个阈值全部"越线未执行"，证明纯自律不成立。

### R6' —— 指令文件双预算 + 周期性重估（升级 R6）

- **字节预算**：`≤ 60 KB`（留 40% 余量对抗回弹；现状 93.7 KB）。
- **条数预算**：**≤ 150 条** standing instruction（对齐 1.6 的经验值 150~200；
  超了先删陈旧项再加新的）。
- **超限动作**：抽叙事成独立文件（先例已有：`docs/architecture/41-*.md`），
  指令文件里只留一行指针（P4 渐进披露）。
- **周期性重估**：把"指令文件字节/条数"纳入 R5' 输出，回弹越线前可见。
  现状：10-02 抽过（103 KB→86.5 KB），**3 天回弹 +7.2 KB**。

### R7' —— 显式三层 + 冷层分片（**新增**，对齐 P2/P4）

给第一节分类学**加一列"层"**，把隐含的分层写死：

| 层 | 载体 | 访问策略 | 预算 |
|---|---|---|---|
| **热**（每会话必读） | AGENTS.md 头部 · **活账本** | 精简 + 指针；**规则不碎片化** | 见 R2'/R6' |
| **温**（按需读） | handoff 段区 · docs/ | 追加不回改；不整块读 | 按需 |
| **冷**（引用） | docs/archive/* | 追加型、不可变、单片有上限 | 单片 ≤500 KB |

冷层分片命名含日期区间，**活表顶部留指针**（P3：留指针）。

### R8' —— 陈旧即删（**新增**，对齐"陈旧比缺失更糟"）

明确一条**反向义务**：发现指令/账本行**不再为真** → **立即删**，**不等体积阈值**。
重构后必须 prune 指令文件。理由：说了假话比没说更糟 —— 模型会不信任或照做。

---

## 6. 取舍：外部这些做法我们**不**采用

| 外部做法 | 为什么不用 |
|---|---|
| **向量库 / embedding 检索** | 我们的载体是 git 里的 markdown，要**人可审计、diff 友好**；引入向量库是基础设施，且破坏"单一权威载体 + git 为真值"。**grep 就是够用的检索器。** |
| **自动 LLM 摘要压缩** | 不可逆、易丢关键约束；我们是"规则要精确"的场景。改用**结构化投影 + 人可控归档**（可恢复）。 |
| **多 agent 隔离** | 问题的根因是**文档体量**，不是上下文任务负载。ZCode 已有 subagent，与本问题正交。 |
| **70% 自动压缩** | ZCode 不向技能/插件暴露上下文预算 ⇒ 无从测百分比。改为**生命周期事件触发**（收尾），体量阈值作兜底。 |

---

## 7. 落地顺序

**最小可行（可立刻做，三个数直接降）**：R1'（账本投影）+ R2'（活账本预算）+ R6'（指令预算）。
- 收益：每个会话必读的账本从 **91 KB → ≤15 KB**；AGENTS.md 从触顶拉回安全区。

**根治**：+ R5'（闸）+ R7'/R8'（结构性）。
- R5' 的输出正是 entrypoints 任务单要注入的内容 ⇒ **两份规划可合流**。

**改动落点**（实施时）：

| 规则 | 落点 |
|---|---|
| R1'/R2'/R4'/R8' | `skills/doc-protocol/SKILL.md` 第四/五/七节 + 第一节加"层"列 |
| R6' | SKILL.md 第三节（准入测试旁） |
| R7' | SKILL.md 第一节（分类学）+ 第五节归档条款 |
| stock-agent 阈值 | `skills/doc-protocol/references/stock-agent.md`（具体数字） |
| R5' 脚本 | `scripts/check-doc-budget.py`（stock-agent 侧） |
| R5' 注入 | 与 `docs/plans/project-guardrails-entrypoints-task-2026-10-04.md` 合流 |

---

## 8. 未验证

- **外部经验的适用边界**：150~200 条指令、dumb-zone 40~60% 来自不同模型/工具，**未在本机 ZCode 上实测**；
  作为预算参考，不作硬判据。
- **"活表只留未完成" 对 grep 引用完整性的影响**：段区若按 `第N段` 引用账本行，移出后需确认无悬空引用（实施时核）。
- **冷层分片上限 500 KB 是否合适** —— 与 v1 现状（476 KB）同量级，未按读取成本实测。
- **R5' 输出注入 SessionStart 的 token 成本** —— 未测（依赖 entrypoints 任务单先落地）。

---

## 9. 参考文献

1. Anthropic, *Effective Context Engineering for AI Agents* (2025-09) —
   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
2. Anthropic Agent SDK, *How the agent loop works*（compaction / CLAUDE.md 每请求重注入）—
   https://docs.anthropic.com/en/docs/agent-sdk/agent-loop
3. Manus, *Context Engineering for AI Agents: Lessons from Building Manus*（可恢复压缩、recitation、文件系统即外部记忆）—
   中文编译 https://zilliz.com.cn/blog/Context-Engineering-Showdown
4. HumanLayer, *12-Factor Agents*，Factor 3 *Own Your Context Window* —
   https://deepwiki.com/dawuliang/12-factor-agents/2.3-factor-3:-own-your-context-window
   · https://paddo.dev/blog/12-factor-agents/
5. AWS China Blog, *Agent 记忆模块的最佳实践*（4-tier + 生命周期：写入/晋升/检索/淘汰）—
   https://aws.amazon.com/cn/blogs/china/agentic-ai-infrastructure-deep-practice-experience-thinking-series-three-best-practices-for-agent-memory-module
6. Chroma, *Context Rot: How Increasing Input Tokens Impacts LLM Performance*；Liu et al., *Lost in the Middle*, arXiv:2307.03172
7. aiwiki, *Context engineering*（AGENTS.md 分层、渐进披露、150~200 指令经验值）—
   https://aiwiki.ai/wiki/context_engineering
8. Jon Krohn, *CLAUDE.md, AGENTS.md, Skills, Hooks and Subagents: A Field Guide*（"指令是概率，hook 是保证"）—
   https://www.jonkrohn.com/posts/2026/8/31/claudemd-agentsmd-skills-hooks-and-subagents-a-field-guide-to-steering-ai-agents
9. codefather, *Agent 系统中的短期记忆与长期记忆：架构、存储与检索深度分析*（DPM / Memora / 记忆自治谱系）—
   https://www.codefather.cn/post/2074087543401349122

---

## 10. 给决策者的一句话

**我们的 R1~R6 与行业方案同向，但差在"闸"与"不变量"。**
最值钱的一改动是 **R1'：把账本从"台账"改成"未完成投影"** —— 一句话的规则，可机械校验，
直接砍掉 60% 死行；配合 **R5'（闸）** 与 **R6'（指令双预算）**，把"每会话必读"的两个载体
从"必然膨胀"变成"有上限、会自动报警"。
