// SessionStart 钩子 —— 把 <repo>/.agents/guardrails.json（优先）或 <repo>/.zcode/guardrails.json 的 context 注入上下文。
//
// 补的是这个缺口：工作区级 hooks **默认处于「待信任」**（需逐仓库显式信任才执行，
// 且 hook 声明摘要一变即 stale_digest 失效），所以「项目自带行为约束」的门槛很高。
// 这个用户级插件代替工作区钩子去读项目里的声明文件，于是「项目说了算」重新成立。
//
// 与用户级 guard-bash.js 的分工：
//   guard-bash  = 全局兜底黑名单（对任何项目都一样）
//   本插件      = 项目级增量规则（只在这个项目里生效）
// 两者叠加，互不冲突：additionalContext 是累积的，permissionDecision 取最严。

import { readStdinAsync, field, emitContext, emitPass } from "./lib/io.mjs";
import { resolveProject } from "./lib/project.mjs";
import { loadGuardrails } from "./lib/guard.mjs";

const payload = await readStdinAsync();

if (field(payload, "hook_event_name", "hookEventName") !== "SessionStart") emitPass();

const cwd = field(payload, "cwd") || process.cwd();
let ctx;
try {
  ctx = resolveProject(cwd);
} catch {
  emitPass();
}
if (ctx.isHome) emitPass(); // home 不是项目

const g = loadGuardrails(ctx.root);
if (!g || g.context.length === 0) emitPass();

const body = g.context.map((s) => `- ${s.trim()}`).join("\n");
emitContext("SessionStart", `[guardrails] 本项目约定（${g.path}）:\n${body}`);
