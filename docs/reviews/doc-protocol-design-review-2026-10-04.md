# doc-protocol 设计审查 — 跨会话/跨 agent 上下文接续是否成立

- **日期**：2026-10-04
- **审查对象**：`D:\Code\zcode-plugin\skills\doc-protocol\`（`SKILL.md` 213 行 + `references/stock-agent.md` 79 行 + `references/evidence.md` 103 行）
- **审查方式**：**技能自述不作为证据**。结论全部取自实测 —— stock-agent 的 live `handoff.md` / `AGENTS.md`、ZCode 打包源码、hook 注册表、原生记忆目录。
- **声明**：**未改动任何代码或配置**，只读 + 统计。

---

## 零、结论先行

设计意图（**不同 agent、不同会话能接续上下文；遗留与观察事项记在 handoff；开新会话记忆连贯**）拆成三层看：

| 层 | 问题 | 判定 |
|---|---|---|
| **结构层** | handoff 是否真能承载「遗留 + 观察」？ | ✅ **达成**（账本四分组 + 四态词表在位，且在实际维护） |
| **接入层** | 新会话开场能否**可靠地**读到 handoff？ | ❌ **未达成** —— 缺「开场必读」的硬通道 |
| **跨 agent 层** | 换个 agent 打开同一仓库，是否还能拿到协议？ | ⚠️ **已退化**（2026-10-04 整合的副作用） |

**一句话**：协议**写对了**，但**没有入口**。当前「记忆连贯」的实际承担者不是 doc-protocol，而是 ZCode 原生记忆（119 个文件 + `MEMORY.md` 索引）与 `AGENTS.md` 的自动注入。

---

## 一、结构层：达成（有实测支撑）

`stock-agent/handoff.md`（2001 行 / 569 KB）实测：

- **账本钉在顶部**：`:6` 起「剩余未完成与遗留事项（跨会话追踪）」，在全部日志段之上 —— 2026-09-11 的「被活埋到第 1819 行」已修复。
- **四分组在位**：`:12` 规划内剩余 / `:32` 规划后续项 / `:52` 跨会话遗留观察点 / `:245` 待用户侧决策。
- **状态词表在使用**：全文 `~~`（划掉）292 处、`⏳` 69 处、`🔴` 59 处、`🟡` 65 处。即「完成行当轮划掉 + 注提交号」的纪律**确实在被执行**，不是纸面规定。
- **观察事项确有承载**：`:58`、`:60`、`:62`、`:63`、`:227`、`:243` 等行是带日期与判据的 ⏳ 验证点。

⇒ **「把遗留/观察记在 handoff」这件事，protocol 设计成立且已落地。**

---

## 二、接入层：未达成（P0，核心缺陷）

### 事实链

1. **技能不会自动加载。** ZCode 源码（`D:\IDE\ZCode\resources\glm\zcode.cjs`）中的提示文案是：

   > `The following skills are available for use with the Skill tool:`

   技能以 **name + description 的目录形式**进入系统提示，**由模型按需用 Skill 工具调用**（渐进披露）。`loadSkill(` / `discoverSkills(` 等符号证实这是一条**工具调用链**，不是自动注入。

   ⇒ **技能里的第六节「会话开场协议（三读一查）」在开场那一刻不会自动执行** —— 除非用户提问恰好命中 `description`（「问进度/待办/还剩什么」），或模型自觉。

2. **AGENTS.md 的措辞缺「开场」。** `stock-agent/AGENTS.md:7` 写的是：

   > load it **before writing or updating any project document**, **at session close-out**, or **when asked about** progress/pending items

   三个触发点里**没有 "at session start"**。`handoff.md:3` 同样写的是「写任何项目文档前先读」。

3. **现有的 SessionStart 钩子不碰 handoff。** `~/.zcode/cli/config.json` 的 `hooks.events.SessionStart`（matcher `startup|resume`）只注册了 `session-context.js`，而它注入的是**分支名 + 最近 5 条提交 + 工作区计数**（`~/.zcode/hooks/session-context.js`），**不含账本、不含待办**。

### 后果

新会话开场只说一句「继续」时：AGENTS.md 注入了（但没让你读 handoff）→ git 状态注入了（但不含待办）→ 技能没被调用 → **agent 不知道欠着什么**。用户要的「开不同会话记忆连贯」在这一步断掉。

### 一个可对照的正面证据

原生记忆 `MEMORY.md` 的索引条目里写着「进度/待办真值=handoff活追踪表, 索引不携带进度短语」—— 说明协议精神在**记忆面被执行到位**。但同目录还留着一条事故记录 `memory-index-claims-require-repo-verification.md`：10-02 一次索引重写把「修复令未下」原样抄进索引，用户据此下开工令，而工作早已完成。
⇒ **凡是没有机械检查的条款，迟早会被人手漏一次。** 接入层正是这种条款。

---

## 三、跨 agent 层：已退化（P0，且与一条既有裁定冲突）

### 实测

| 项 | 事实 |
|---|---|
| stock-agent 项目内协议载体 | **已无**（`.agents/` 于 2026-10-04 删除） |
| 指向它的引用 | `AGENTS.md:7` 与 `handoff.md:3` **各 1 处，均已入库，现成悬空指针** |
| 用户级技能 | `~/.agents/skills/doc-protocol/` 目前仍是**旧的 3 文件版**（含 `override-template.md`），尚未被替换 |
| 其他 agent 的根 | `~/.codex/skills/` 是**独立目录**（内含 `.system`、`agent-reach` 等），doc-protocol 不在其中；`~/.claude/skills/` 为空 |
| 原生记忆里的旧记录 | `…/memory/doc-responsibilities-four-files.md` 仍写着单一规范源 = `D:\Code\stock-agent\.agents\skills\doc-protocol\SKILL.md` |

### 一条需要你重新拍板的旧结论

同一份记忆文件里有一条当时写下的判断：

> **⚠️ doc-protocol 必须留在项目 `.agents/skills/` 内**（用户曾手动移去 `~/.agents/skills/`，已按两层方案移回）：AGENTS/handoff/墓碑/记忆的指针全部指向项目路径，且它**随 git 分发到其他机器与工具** —— **移去全局则指针全断且其他会话失明**；全局只放 doc-truth-protocol。

今天的三条实测**逐条命中了这段话的后半句**：指针断了（2 处悬空）、项目内文件没了、协议只存在于 ZCode 的用户级根。

**但这不等于结论仍然成立** —— 那条判断成立于 2026-09-11 的「两层方案」，而 2026-10-04 已改成「一份自包含技能」并明确由你手动落地。所以这是一次**决策前提变更**，需要你显式确认，而不是自动沿用：

- 若你的用法**只有 ZCode** → 现状可接受，把悬空引用改成指向用户级技能即可。
- 若你会用 **Codex / 其他客户端打开同一仓库** → 现在它们拿不到协议，需要恢复一个**项目内、随 git 分发**的载体（哪怕是薄薄一份指针文件）。

---

## 四、其余问题（P1 / P2）

### P1-1 观察事项没有到期机制

账本里的 ⏳ 全部靠「收尾清单第 3 步：过期验证点升级回 🔴」维护 —— 而收尾清单本身依赖接入层（见第二节），**长期不开会话时验证点静默腐烂**。

实证：`:171` 的 D1 条件报警首验标的是「2026-09-25 09:30 后」，到 10-04 仍以 ⏳ 挂着并附「09-25 00:45 实查规则与事件均已为 0」——**验证点过期后没有自动升级，只在有人手动查看时才补记**。

### P1-2 三套记忆面没有定义分工

| 面 | 位置 | 随 git | 现状 |
|---|---|---|---|
| handoff 账本 | `<repo>/handoff.md` | ✅ | 活跃 |
| ZCode 原生记忆 | `~/.zcode/cli/memories/projects/stock-agent-*/memory/`（**119 个 md + `MEMORY.md` 索引**） | ❌ 机器本地 | **非常活跃**（索引条目多为 10-02~10-04） |
| `memory-loop` 的落点 | `<repo>/.zcode/memory/` | ✅ | 插件**未安装** |

协议只在分类学里说了「agent 记忆 = 放指针」，**没有定义这三者的边界**。已出现漂移：原生记忆里的协议指针指向**已删除**的路径。

### P2-1 账本的「可扫读」目标未达成

- 账本区间 59 行中 **12 行没有状态符号**（老格式未统一到四态词表）。
- 单个单元格最长上千字（34 / 38 / 39 号三行），把表格用成了「压缩日志」。
- `handoff.md` **2001 行，已越过协议自己的 2000 行归档线**（第五节）——条款触发但未执行，又一次印证「无机械检查 → 靠人记 → 会漏」。

---

## 五、建议（按性价比排序）

| # | 建议 | 成本 | 收益 | 归属 |
|---|---|---|---|---|
| 1 | **给 `AGENTS.md:7` 补「开场必读」**：把触发点从三个扩到四个，加 `at session start (read the handoff live-tracking table before answering)` | 一行字 | **直接补上接入层**（AGENTS.md 是自动注入的，这是唯一确定性通道） | stock-agent |
| 2 | **决定跨 agent 策略**（三选一）：a) 仓库内恢复一份 `.agents/doc-protocol.md` 薄指针（随 git 分发）；b) 只用 ZCode，接受其他客户端看不到；c) 技能为准 + 仓库内只留一行指针 | 需你拍板 | 决定协议是「ZCode 私有」还是「仓库资产」 | **你** |
| 3 | **修两处悬空引用** + 原生记忆里的旧指针（`doc-responsibilities-four-files.md`） | 三处小改 | 消除 E1 型「多载体漂移」的现成实例 | stock-agent |
| 4 | **观察事项加日期检查**：SessionStart 扫 handoff 的 ⏳ 行、与当天日期比对，过期的注入一行提醒（可扩 `project-guardrails` 或 `memory-loop`，或独立小钩子） | 一个钩子 | 让 ⏳ 不再依赖「有人开会话且记得升级」 | zcode-plugin |
| 5 | **账本瘦身**：已完成行（`~~…~~`）的长叙事下沉 `docs/architecture/` 编号文档，账本只留一行结论 + 提交号 | 一轮整理 | 恢复「扫读」 | stock-agent |
| 6 | **三套记忆面的分工写进协议第九节**（各写一句边界） | 几行字 | 防止下一次漂移 | zcode-plugin |

> 第 1 条是**最高性价比**：不改架构、不加钩子，一行字就把「开场接续」这条链补通。

---

## 六、未验证（不要当结论用）

1. **`~/.agents/skills/` 是否真的被 Codex / 其他客户端读取** —— 只知道该目录有 `.skill-lock.json`（第三方 skill 安装锁），多客户端共享这一点**未实测**。
2. **ZCode 原生记忆是否在当前配置下注入会话** —— `features.memory.enabled` 默认 `false`，但 `…/memory/` 下 119 个文件在持续更新（10-04 仍有新条目）⇒ **写入在发生**；「是否注入上下文」**未验证**。
3. **技能 description 的实际触发率** —— 未能观测到「用户提问 → 技能被调用」的真实命中记录。
4. **handoff 账本全文注入的上下文成本** —— 建议 4 若做成「注入整张表」会引入新开销，应先量一下账本字节数（当前账本区间 59 行，未计字节）。

---

## 附：证据索引（可复跑）

```bash
# 1. 技能是按需调用，不是自动注入（说明这是工具调用链）
grep -o 'The following skills are available for use with the Skill tool:' \
  /d/IDE/ZCode/resources/glm/zcode.cjs | head -1

# 2. AGENTS.md 的触发点里没有 session start
grep -n "load it before writing" /d/Code/stock-agent/AGENTS.md

# 3. SessionStart 只注入 git 状态
cat ~/.zcode/hooks/session-context.js
python -c "import json;print(json.load(open(r'C:/Users/Ben/.zcode/cli/config.json'))['hooks']['events']['SessionStart'])"

# 4. 悬空引用（各 1 处）
grep -c "\.agents/doc-protocol" /d/Code/stock-agent/AGENTS.md /d/Code/stock-agent/handoff.md

# 5. 协议载体已不在项目内
ls /d/Code/stock-agent/.agents 2>&1

# 6. 用户级技能仍是旧版（含 override-template.md）
ls -l ~/.agents/skills/doc-protocol/references/

# 7. handoff 体量与账本位置
wc -l /d/Code/stock-agent/handoff.md
grep -n "^## \|^### " /d/Code/stock-agent/handoff.md | head -8

# 8. 原生记忆的存量与旧指针
ls ~/.zcode/cli/memories/projects/stock-agent-*/memory/ | wc -l
grep -n "doc-protocol" ~/.zcode/cli/memories/projects/stock-agent-*/memory/doc-responsibilities-four-files.md
```
