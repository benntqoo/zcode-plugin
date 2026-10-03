// Stop 钩子 —— 把用户级 stop-memory.js 产出的「记忆候选」按项目分流到各仓库。
//
// 上游：~/.zcode/hooks/stop-memory.js 每轮往一个全局 jsonl 追加候选（只写不读）。
// 本钩子：读增量 → 按候选里的 cwd 找到所属项目 → 写进 <repo>/.zcode/memory/candidates.jsonl。
// 下游：/memory-loop 命令把候选蒸馏进 MEMORY.md；SessionStart 钩子再把 MEMORY.md 注入上下文。
//
// 设计要点：
//  - **纯副作用，不注入上下文**。Stop 上注入文本会干扰模型对回复的收尾。
//  - 同步执行（不是 async/background）：状态必须落盘完成，且 <1s 就能跑完。
//  - 消费游标存在插件数据目录。**重装插件会清空它**，所以必须能从零重建 ——
//    游标丢失只会导致重扫一遍，项目侧的内容指纹去重会兜住，不会产生重复条目。

import { join } from "node:path";
import { homedir } from "node:os";
import { readStdinAsync, field, emitPass } from "./lib/io.mjs";
import { resolveProject } from "./lib/project.mjs";
import { appendJsonl, fingerprint, readJsonl, readState, writeState } from "./lib/store.mjs";

const payload = await readStdinAsync();

// 闸 1：只处理 Stop，被错配到其他事件时放行。
if (field(payload, "hook_event_name", "hookEventName") !== "Stop") emitPass();

// 闸 2：防递归。stop_hook_active=true 表示这是钩子自己请求的继续，别重复触发。
if (field(payload, "stop_hook_active", "stopHookActive") === true) emitPass();

// 候选源。默认对接用户级 stop-memory.js 的落点，可用环境变量指向别处。
const SOURCE =
  process.env.MEMORY_LOOP_SOURCE || join(homedir(), ".zcode", "hooks", "memory-candidates.jsonl");

const dataDir =
  process.env.ZCODE_PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || join(homedir(), ".zcode");
const statePath = join(dataDir, "ingest-state.json");

const all = readJsonl(SOURCE);
const state = readState(statePath, { consumed: 0 });
let consumed = Number.isInteger(state.consumed) && state.consumed >= 0 ? state.consumed : 0;

// 源文件被清空/替换/截断过 → 游标失效，从头扫。
if (all.length < consumed) consumed = 0;

const fresh = all.slice(consumed);
if (fresh.length === 0) emitPass();

// 按目标文件分组。cwd 缺失或落在 home 的候选跳过 —— home 不是项目。
const groups = new Map();
for (const rec of fresh) {
  const cwd = rec?.cwd;
  if (!cwd || typeof cwd !== "string") continue;
  let target;
  try {
    const { root, isHome } = resolveProject(cwd);
    if (isHome) continue;
    target = join(root, ".zcode", "memory", "candidates.jsonl");
  } catch {
    continue;
  }
  if (!groups.has(target)) groups.set(target, []);
  groups.get(target).push(rec);
}

let added = 0;
for (const [target, recs] of groups) {
  const seen = new Set(readJsonl(target).map(fingerprint));
  const toAdd = [];
  for (const r of recs) {
    const fp = fingerprint(r);
    if (seen.has(fp)) continue; // 同一段内容不重复落盘
    seen.add(fp);
    toAdd.push({ ...r, ingestedAt: new Date().toISOString() });
  }
  added += appendJsonl(target, toAdd);
}

writeState(statePath, {
  consumed: all.length,
  updatedAt: new Date().toISOString(),
  lastAdded: added,
});

emitPass();
