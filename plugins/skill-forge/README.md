# skill-forge

一个 ZCode 插件：让 agent **在多步任务后自动沉淀可复用 skill**，并在**用的时候顺手修好已有的 skill**。

等价于 WorkBuddy 那套「任务完成 → 提炼 skill → 下次生效 → 用中发现即改」的闭环。

---

## 它装了什么

```
D:\Code\zcode-plugin\              仓库根 —— ZCode「添加市场」时指向这里
├── marketplace.json               市场清单
└── plugins\
    └── skill-forge\               插件本体
        ├── .zcode-plugin\plugin.json   插件清单
        ├── commands\
        │   ├── skill-forge.md      /skill-forge — 手动把本轮沉淀成 skill
        │   └── skill-audit.md      /skill-audit — 体检 skill 库
        └── hooks\
            ├── hooks.json          SessionStart(compact|clear) + Stop
            ├── session-skill-rules.js  压缩后重新注入三铁律
            ├── stop-skill-nudge.js     兜底：该沉淀却没沉淀时推一次
            └── lib\
                ├── io.js           自带的 hook I/O 库（不依赖用户 hooks/lib）
                └── project.js      解析「本项目」的 skill 落点（含 home 保护）
```

## 三条铁律

1. **做完就沉淀** —— 走过 5+ 步试错 / 绕过非显然的坑 / 定下会重复用的口径 → 写**当前项目**的 `.zcode/skills/<name>/SKILL.md`，不许问「要不要存」
2. **用过就复检** —— 本轮调用过 skill，收尾前回读一遍，发现过时命令/错工具名/缺步骤就同轮改
3. **读到错就修** —— 读 SKILL.md 发现错字或失效路径，当场改，不要只报告

规则写入 `~/.zcode/AGENTS.md`（主渠道）。插件的 SessionStart 钩子只在 `compact|clear` 后补刀，避免与 AGENTS.md 重复占用 token。

## 落点：项目级，不是全局

**规则是全局的，skill 是项目专属的。** 这两件事分开看：

| | 位置 | 作用域 |
|---|---|---|
| 三条铁律（规则） | `~/.zcode/AGENTS.md` | 所有工作区 —— 每个项目都具备沉淀能力 |
| 产出的 SKILL.md | `<repo>/.zcode/skills/<name>/` | 只有当前项目 —— 随 git 走，不污染全局库 |

两个钩子都从 payload 的 `cwd` 现算落点（`lib/project.js`），因为**插件本身是全局安装的**，同一个钩子会在任何工作区触发，路径写死就会错。

**三条必须知道的 ZCode 规则**（出自官方 `zcode-configuration-guide`）：

1. **用户级优先于工作区级** —— 同名 skill 时 `~/.zcode/skills/foo/` **胜出**，项目级那份被静默遮蔽。症状很隐蔽：文件在、改了不起作用。别在全局库留同名条目。
2. **逐层向上扫描** —— 从 cwd 到仓库根，**每一层**的 `.zcode/skills/` 都算，越深越优先。
3. **插件全局生效** —— 装一次，所有工作区都跑这套钩子。

**一个边界已被挡掉**：工作区就是 home 时（`cwd = C:\Users\Ben`），「项目级 `.zcode/skills`」会解析成 `C:\Users\Ben\.zcode\skills`，**与用户级目录完全重合** —— 照推等于打着「项目专属」的旗号写全局库。`resolveSkillTarget()` 检测到重合即返回 `isUserLevel: true`，Stop 钩子直接放行。

---

## 安装（4 步）

### 1. 确认文件就位

```bash
ls -R D:/Code/zcode-plugin
```

根目录应有 `marketplace.json`；`plugins/skill-forge/` 下应有 `.zcode-plugin/plugin.json`、`commands/`、`hooks/`。

### 2. 添加本地市场

ZCode → **Settings → Plugins** → 右上角 **Create → Add marketplace** → 选 **本地目录**：

```
D:\Code\zcode-plugin
```

（也可以直接把文件夹拖进去。）

添加后，市场列表里会出现 `zcode-plugin`，里面有一个 `skill-forge` 插件。

### 3. 安装并启用

在市场里点该插件的 **Install**。新建插件默认启用。

装完后 **Settings → Plugins → Installed** 里能看到它，点进去应显示：

- Commands: 2
- Hooks: 2

### 4. 追加 AGENTS.md 规则

把 `~/.zcode/AGENTS.md` 末尾追加下面这段（**部署前已备份为 `AGENTS.md.bak-20261003`**）：

```markdown

---

## Skill 沉淀与更新（常驻规则）

### 铁律 1 — 做完就沉淀，不要问
一次任务收尾前，若满足任一条，必须在本轮内写出 skill：
- 走了 5 步以上才走通，中间有试错
- 踩到并绕过了一个非显然的坑（环境、编码、路径、版本、权限）
- 定下了一条口径、约定或决策，将来会重复用到

落点：**当前项目**的 `.zcode/skills/<kebab-case-name>/SKILL.md`
（不是 `~/.zcode/skills/` —— 那是全局库，会让所有项目共用一套）

frontmatter 只允许这几个字段，其余会被静默忽略：
`name`(必填) / `description`(必填,≤1024字符) / `when_to_use` / `license` / `metadata`

- `description` 会以 250 字符截断后注入每轮上下文 —— 把**触发条件**写在最前面，写「什么时候用」而不是「它是什么」。
- 写完一句话报路径即可，**不要问「要不要存」**。

### 铁律 2 — 用过就复检
本轮只要通过 `$` 或 `/` 调用过某个 skill，收尾前必须回读一遍：过时命令、失效路径、错工具名、被本次现实推翻的判据。发现即改，同一轮内改完。

### 铁律 3 — 读到错就修
读任何 `SKILL.md` 时发现错字、错命令、失效路径 —— 当场改，不要只报告。

### 什么时候不沉淀
一次性问答、纯查询、没产生新方法论的会话。不要为了凑数写 skill —— 每条都占 metadata 预算。

### 预算红线
ZCode 每轮注入所有**启用中** skill 的 name + 250 字符 description，总量有固定预算。超预算后注入退化成「只有名字」，模型不知道用哪个，自动触发率骤降。
⇒ 新增前先问：**能不能并进已有 skill？** 定期跑 `/skill-audit` 体检。

### 与 memory 的分工
- **skill** = 可复用的**做事方法** → 人可读、可版本控制
- **memory** = 关于项目的**事实**（用 pnpm、测试命令是 X）
```

### 5. 重启生效

hook 配置在**会话启动时快照**。改完必须**开新会话**才生效，运行中的会话不会热加载。

---

## 验证

开新会话后：

1. 输入 `/` —— 应能看到 `skill-forge` 和 `skill-audit` 两个命令
2. 跑一个会踩坑的多步任务（例如配一个环境、发现路径不对、绕过去）
3. 观察两件事：
   - 回复末尾是否出现写入 **`<当前项目>/.zcode/skills/`** 的动作（不是 `~/.zcode/skills/`）
   - 若没写，是否被 Stop 钩子推了一轮
4. 跑 `/skill-audit` 确认新 skill 进列表且 frontmatter 合规
5. 查节流状态：

```bash
cat "${ZCODE_PLUGIN_DATA:-$TEMP/skill-forge}/nudge-state.json"
```

## 已知边界

| 项 | 说明 |
|---|---|
| Stop 钩子不做静默沉淀 | `decision:block` 会让模型多跑一轮，用户要等、token 要烧。所以每 session 最多推 1 次 |
| 插件 hooks 在设置页只读 | 不能单独开关某一条，只能整体启用/停用插件 |
| 项目级 hooks 默认待信任 | `<workspace>/.zcode/config.json` 里的 hooks 不会直接执行：走 `admission → evaluateDispatch()`，`trustState` 默认 `pending_trust`，需逐仓库显式信任；声明摘要一变即 `stale_digest`。**不是被策略禁止**，只是门槛高 —— 这正是本插件用用户级 hooks 代替工作区钩子的原因 |
| 改插件后需 bump version | `marketplace.json` 里的 `version` 不升，ZCode 不认为有更新（已实测） |
| 用户级遮蔽项目级 | ZCode 既定行为，非本插件可控：同名 skill 时 `~/.zcode/skills/` 那份胜出 |
| 工作区在 home 下不推 | 项目级落点会与用户级目录重合，`resolveSkillTarget()` 判定后直接放行 |
| 落点无标记时回退 cwd | `findProjectRoot()` 从 cwd 向上找**最近的** `.git` 或 `.zcode`（两者同等，先撞上谁算谁），都没有就用 cwd 本身。这是「就近优先」而非「`.git` 绝对优先」—— 与 ZCode 自己「越深的 `.zcode/skills` 优先级越高」的发现顺序保持一致 |

## 回滚

```bash
# 卸载：Settings → Plugins → Installed → 点插件 → Uninstall
# 移除市场：Marketplace sources 面板 → Remove this marketplace
# 仓库整体删除（含源码）：
# rm -rf D:/Code/zcode-plugin

# 恢复 AGENTS.md
cp ~/.zcode/AGENTS.md.bak-20261003 ~/.zcode/AGENTS.md
```

---

## 与 ZCode 官方 skill-creator 的区别

| | skill-creator（官方） | skill-forge（本插件） |
|---|---|---|
| 提供 | 写 skill 的**方法**（skill 形式） | 写 skill 的**时机**（hook 形式） |
| 何时生效 | 被调用 / 被语义触发时 | 每轮任务结束时自动判断 |
| 有 hook 吗 | ❌ 没有，只有 `"skills": "skills"` | ✅ Stop + SessionStart |
| 会主动改已有 skill 吗 | ❌ 只在被调用时工作 | ✅ 铁律 2、3 |

**结论：skill-creator 不能单独实现该机制** —— 它教你「怎么写」，但不会提醒你「该写了」或「这条写错了」。两者互补，建议都留着。
