// SessionStart 钩子 —— 把项目级蒸馏记忆注入上下文。
//
// 这是「记忆闭环」里唯一真正让记忆**生效**的一步：ZCode 没有别的入口能让
// 外部往上下文里塞内容（`outputStyles` 属于 diagnosticOnly，插件改不了系统提示）。
//
// 注入两样东西，都只在有内容时才发：
//  1. <repo>/.zcode/memory/MEMORY.md —— 蒸馏后的长期记忆（截断到 MAX_CHARS）
//  2. 一句待办提示 —— 仅当存在未蒸馏候选时

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readStdinAsync, field, emitContext, emitPass } from "./lib/io.mjs";
import { resolveProject } from "./lib/project.mjs";
import { readJsonl, readState } from "./lib/store.mjs";

// 注入越多越占上下文预算，默认 4000 字符。
const MAX_CHARS = Number(process.env.MEMORY_LOOP_MAX_CHARS) || 4000;

const payload = await readStdinAsync();

if (field(payload, "hook_event_name", "hookEventName") !== "SessionStart") emitPass();

const cwd = field(payload, "cwd") || process.cwd();
let ctx;
try {
  ctx = resolveProject(cwd);
} catch {
  emitPass();
}
// home 不是项目 —— 放弃，否则等于把全局目录当项目写。
if (ctx.isHome) emitPass();

const memFile = join(ctx.memoryDir, "MEMORY.md");
const candFile = join(ctx.memoryDir, "candidates.jsonl");
const stateFile = join(ctx.memoryDir, "state.json");

const parts = [];

if (existsSync(memFile)) {
  let mem = "";
  try {
    mem = readFileSync(memFile, "utf-8").trim();
  } catch {
    mem = "";
  }
  if (mem) {
    if (mem.length > MAX_CHARS) {
      mem = `${mem.slice(0, MAX_CHARS)}\n…（已截断，完整内容见 ${memFile}）`;
    }
    parts.push(`[memory-loop] 本项目长期记忆（${memFile}）:\n${mem}`);
  }
}

// 只有「有新的、还没蒸馏的候选」时才提示，避免每次开会话都唠叨。
const candCount = readJsonl(candFile).length;
const distilled = Number(readState(stateFile, { distilled: 0 }).distilled) || 0;
if (candCount > distilled) {
  parts.push(
    `[memory-loop] 有 ${candCount - distilled} 条未蒸馏候选（共 ${candCount} 条，${candFile}）。` +
      `需要时运行 /memory-loop 蒸馏进 MEMORY.md —— 不运行也没关系，不影响当前任务。`
  );
}

if (parts.length === 0) emitPass();
emitContext("SessionStart", parts.join("\n\n"));
