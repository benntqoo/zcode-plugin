# impeccable（ZCode 适配版）

把上游 [pbakaus/impeccable](https://github.com/pbakaus/impeccable) —— 「编码智能体的设计词汇表」——
以 ZCode 插件形态落地：**1 个 skill（24 个设计动词）+ 1 个 `/impeccable` 命令路由 + PostToolUse 设计钩子**。
上游本身支持 19 个工具（Claude Code、Cursor、Codex…）但没有 ZCode 通道；本插件不改上游代码，
直接 vendor 其**通用产物**（`.agents/skills/` 变体）—— 该变体的 frontmatter 恰好只有
`name` / `description` / `metadata` 三个字段，与 ZCode 允许的字段集完全一致。

## 来源与版本

| 项 | 值 |
|---|---|
| 上游仓库 | https://github.com/pbakaus/impeccable（Apache-2.0） |
| vendored 版本 | `4.9.1`（插件版本号 = 上游版本号，见 `.zcode-plugin/plugin.json`） |
| vendored 来源 | 上游 commit `1995764` 的 `.agents/skills/impeccable/`（2026-11-14） |
| 排除内容 | `agents/`（Codex 专用 TOML subagent，ZCode 插件无对应分发通道；技能在无 subagent 环境下按自带降级路径运行） |
| 未改动 | `SKILL.md`、`reference/`、`scripts/` 保持上游原样，便于机械比对与更新 |

## 安装

仓库根本身是市场源（见根 [README](../../README.md)）：**Settings → Plugins → Add marketplace**
指向本仓库目录 → 对 `impeccable` 点 **Install** → **开新会话**。

## 用法

- **自动触发**：说「把这个页面 polish 一下」「critique 这个界面」等，ZCode 按技能 description 触发。
- **命令入口**：`/impeccable <verb> [target]`（见 [commands/impeccable.md](commands/impeccable.md)）。
- **纯检测**：`npx impeccable detect src/`（62 条确定性规则，无需 LLM；`--json` / `--github` 可用于 CI）。
- 上下文文件：`/impeccable init` 生成 `PRODUCT.md`，`/impeccable document` 生成 `DESIGN.md`。

## 设计钩子

`hooks/hooks.json` 只接 **PostToolUse（matcher `Edit|Write`）**：每次编辑后由
[design-hook.mjs](hooks/design-hook.mjs) 调引擎 `hook` 动词扫描被改的 UI 文件。
wrapper 任何失败都退出 0 —— 设计钩子绝不阻塞编辑本身。

**为什么无需设 `IMPECCABLE_HOOK_HARNESS`**：引擎的 harness 侦测（`crates/hook` 的
`resolve_harness`）对 Claude 风格 snake_case 信封（`hook_event_name` / `tool_name` /
`tool_input`，无 `turn_id` / `conversation_id`）的 fallback 就是 `claude`，
而 ZCode 的 hook 信封正是这一形态。

**Windows 启动顺序**：wrapper 先试 `sh`（bash 启动器是上游主力路径，且 ZCode shell 即 Git Bash），
spawn 失败再退 `cmd /c impeccable.cmd`（上游自注该启动器尚未在真实 Windows 上验证过）。

v1 未接 SessionStart / Stop（避免非 UI 会话的固定开销）。要补全成与上游 Claude 插件等价，
在 `hooks/hooks.json` 的 `hooks` 对象里追加（timeoutMs 照抄上游 5s / 30s）：

```json
"SessionStart": [{ "hooks": [{ "type": "process", "command": "node",
  "args": ["${ZCODE_PLUGIN_ROOT}/hooks/design-hook.mjs"], "timeoutMs": 10000 }] }],
"Stop": [{ "hooks": [{ "type": "process", "command": "node",
  "args": ["${ZCODE_PLUGIN_ROOT}/hooks/design-hook.mjs"], "timeoutMs": 30000 }] }]
```

## 首跑与引擎二进制

引擎是自包含二进制（skill 内不带，首跑按 `scripts/engine-checksums.txt` 校验下载，
落在 `~/.impeccable/bin/<version>/`）。
安装后建议先手动跑一次 `detect` 或任一动词把下载预热掉，再依赖钩子 ——
否则第一次 PostToolUse 可能因下载超时被掐（timeoutMs 10s）。

网络受限环境（沙箱 / CI 常拦 `release-assets.githubusercontent.com` 这类发布 CDN）会下载失败，
此时启动器会报错但给出可操作提示；逃生口是 `IMPECCABLE_BIN` 指向本地构建或预装的引擎
（源码 `cargo build --release -p impeccable` 即得，stable 工具链即可编）。

## 更新 runbook（上游出新版时）

```bash
git clone --depth 1 https://github.com/pbakaus/impeccable /tmp/imp-new
# 1) 比对版本与产物
diff -r /tmp/imp-new/.agents/skills/impeccable plugins/impeccable/skills/impeccable
# 2) 重新 vendor（保持排除 agents/）
rm -rf plugins/impeccable/skills/impeccable
cp -r /tmp/imp-new/.agents/skills/impeccable plugins/impeccable/skills/
rm -rf plugins/impeccable/skills/impeccable/agents
# 3) 三处版本号对齐：plugin.json、根 marketplace.json、本 README 的 vendored 版本与 commit
```

## 已知校验误报

plugin-creator 的 `validate-plugin.mjs` 会对上游 bundle 报一条
`Unresolved placeholder: skills\impeccable\scripts\live-browser.js` —— 那是上游源码自带的一句
`// TODO` 注释（live-browser.js 内），属脚手架占位符扫描对第三方打包产物的误报；
ZCode loader 只在 manifest / hook 命令串里替换 `${…}` token，不扫 skill 内 JS，无实害。
按「上游文件不改动」原则保留，重 vendor 后仍会出现，勿当缺陷修。

## License

上游 impeccable，Apache-2.0，版权属 Paul Bakaus 及贡献者 —— 见本目录
[LICENSE](LICENSE) 与 [NOTICE.md](NOTICE.md)。本插件的适配 glue（wrapper / hooks /
command / README）随本仓库以 MIT 分发。
