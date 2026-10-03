// Hook — stop-skill-nudge.js  (Stop, 无 matcher)
//
// 作用：每轮结束时判断「本轮值不值得沉淀成 skill，而 agent 又没沉淀」。
// 命中则用 decision:block 推模型继续一轮，让它写 skill 或说明为何不写。
//
// 防打扰三道闸（缺一不可）：
//   1. stop_hook_active === true → 放行（这是因 block 而继续的那一轮，防震荡）
//   2. 每个 session 最多推 1 次（状态文件节流）
//   3. 信号保守：必须同时命中「完成动作 + 经验信号 + 具体路径」，且回复里没提到 SKILL.md
//
// 设计取舍：不做静默沉淀。Stop block 会让模型多跑一整轮，用户要等、token 要烧。
// 所以这里只兜底，主要驱动力放在 AGENTS.md 的常驻规则里。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { readStdinAsync, field, emitPass, emitBlockStop } from "./lib/io.js";
import { resolveSkillTarget } from "./lib/project.js";

const payload = await readStdinAsync();
const eventName = field(payload, "hook_event_name", "hookEventName");

if (eventName !== "Stop") {
  emitPass();
}

// 闸 1：因 Stop block 而继续的那一轮，不再重复推
if (field(payload, "stop_hook_active", "stopHookActive") === true) {
  emitPass();
}

const message = field(payload, "last_assistant_message", "lastAssistantMessage") || "";
const sessionId = field(payload, "session_id", "sessionId") || "unknown";

if (message.trim().length < 80) {
  emitPass();
}

// 闸 3 之一：已经在沉淀了就不再推
if (/SKILL\.md|\.zcode[\\/]skills|skills[\\/][a-z0-9-]+[\\/]/i.test(message)) {
  emitPass();
}

// ---- 信号 ----
// 注意：中文不加 \b —— CJK 不属于 \w，\b 在中文边界不生效，会漏匹配
const DONE_RE =
  /(?:已(?:完成|实现|修复|配置|跑通|接入|部署|创建|重构)|跑通了?|搞定了?|worked|wrote|implemented|configured|got it working)/i;

const LESSON_RE =
  /(?:坑|踩坑|陷阱|注意[:：]|教训|关键点|要点|根因|绕(?:过|开)|而不是|正确的是|必须用|不能用|gotcha|pitfall|root cause|caveat)/i;

const PATH_RE = /(?:[\w.-]+[\\/][\w.-]+[\\/][\w.-]+|[\w-]+\.(?:js|ts|kt|py|json|md|toml|ya?ml|gradle|exe))/;

if (!(DONE_RE.test(message) && LESSON_RE.test(message) && PATH_RE.test(message))) {
  emitPass();
}

// ---- 落点：写进当前项目，不是全局库 ----
// 插件是全局安装的，任何工作区都会跑这个钩子，所以路径必须按本次会话的 cwd 现算。
// 保护：工作区就是 home 时，「项目级 .zcode/skills」与用户级目录重合 —— 推了
// 等于把 skill 写进全局库，与「项目专属」的初衷正好相反，直接放行。
const target = resolveSkillTarget(field(payload, "cwd"));

if (target.isUserLevel) {
  emitPass();
}

const skillsDirForMsg = target.skillsDir.replace(/\\/g, "/");

// 闸 2：每 session 最多推 1 次
// 状态落在插件数据目录（ZCode 会清掉临时目录，不能放那儿）
const dataDir =
  process.env.ZCODE_PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), "skill-forge");
const statePath = join(dataDir, "nudge-state.json");

// 状态文件只增不减会长大 —— 只保留最近这么多个会话
const MAX_TRACKED = 200;

let state = {};
try {
  if (existsSync(statePath)) {
    const parsed = JSON.parse(readFileSync(statePath, "utf-8"));
    state = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }
} catch {
  state = {};
}

if ((state[sessionId] || 0) >= 1) {
  emitPass();
}

// 记账（先写再输出，避免写失败导致重复推送）
state[sessionId] = (state[sessionId] || 0) + 1;

// 剪枝：对象键保持插入序，所以砍头部就是砍最老的会话
const tracked = Object.keys(state);
if (tracked.length > MAX_TRACKED) {
  for (const k of tracked.slice(0, tracked.length - MAX_TRACKED)) delete state[k];
}

try {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state), "utf-8");
} catch {
  // 记账失败不阻塞
}

emitBlockStop(
  [
    "本轮像是走通了某条非显然的流程（检测到完成动作 + 经验信号 + 具体路径）。",
    "",
    "结束前做一次沉淀判断，二选一：",
    "",
    "A. 有可复用的做法 → 写入 `" + skillsDirForMsg + "/<kebab-name>/SKILL.md`，",
    "   这是**本项目**的 skill 目录。不要写 `~/.zcode/skills/` —— 那是全局库，会污染所有项目。",
    "   frontmatter 只写 name / description / when_to_use / license / metadata。",
    "   description 写清「什么时候用」（250 字符截断后注入上下文，触发条件放最前面）。",
    "   写完一句话报路径。",
    "",
    "B. 确实没什么可复用（纯一次性操作 / 项目特有细节 / 已在其他 skill 覆盖）→ ",
    "   直接说明「本轮无需沉淀，原因：…」，不要写文件。",
    "",
    "不要因为被催就硬写低质量 skill —— 每条都占每轮注入的预算。",
  ].join("\n")
);
