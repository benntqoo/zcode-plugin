// ZCode hook 共享 I/O。
//
// 每个插件自带一份，**不要** import 用户级 `~/.zcode/hooks/lib/`：
// 用户改自己的库会把插件搞坏，且插件分发出去后那个路径不存在。
//
// 输出用 writeSync 直写 fd 1：Windows 上 process.stdout.write() 后立刻
// process.exit(0)，管道里的数据可能来不及 flush 就被截断。

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 读 stdin 全部并 JSON.parse。任何失败都返回 {}，绝不抛错。 */
export async function readStdinAsync() {
  let raw = "";
  try {
    for await (const chunk of process.stdin) {
      raw += typeof chunk === "string" ? chunk : chunk.toString("utf-8");
    }
  } catch {
    raw = "";
  }
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const v = JSON.parse(trimmed);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** 取 payload 字段：优先 snake_case，回退 camelCase（ZCode 两种都发）。 */
export function field(payload, snake, camel) {
  if (!payload || typeof payload !== "object") return undefined;
  if (Object.hasOwn(payload, snake)) return payload[snake];
  if (camel && Object.hasOwn(payload, camel)) return payload[camel];
  return undefined;
}

/** 注入上下文。除 PreToolUse / PermissionRequest 外的事件都只支持这个字段。 */
export function emitContext(eventName, text) {
  if (!text) return emitPass();
  write({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: text,
    },
  });
}

/** PreToolUse 专用：allow / ask / deny。多钩子同事件时 deny > ask > 其它。 */
export function emitPermission(decision, reason) {
  write({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  });
}

// ---- 钩子遥测（单人使用的故障可见性）----
// fail-open 的代价是故障不可见：这里把每次输出/放行同步记一行到
// ~/.zcode/hooks/plugin-telemetry.jsonl（scripts/healthcheck.mjs 的 E 面汇总）。
// 三条硬约束：同步写（exit 前落盘）、自带轮转（512KB/2000 行）、任何失败绝不影响钩子。
// 关闭：PLUGIN_TELEMETRY=off（CI 自动关）。
const T0 = Date.now();
const TELEMETRY_PLUGIN = telemetryPluginName(fileURLToPath(import.meta.url));

/**
 * 从 io 模块路径推插件名：向上找 hooks 目录，再取插件名。
 * 仓库源（plugins/<名>/hooks/…）hooks 上一级即插件名；
 * 安装缓存（…/cache/<市场>/<名>/<版>/hooks/…）hooks 上一级是版本号，再上一层才是插件名。
 * 不能按 "plugins" 路径段找 —— 缓存路径里有 cli\plugins 与 cache\zcode-plugin 两处，
 * lastIndexOf 会取到 "cache"（2026-11-15~19 实测 4281 条全记错）。
 */
export function telemetryPluginName(modulePath) {
  let dir = dirname(String(modulePath));
  while (basename(dir) !== "hooks" && dirname(dir) !== dir) dir = dirname(dir);
  if (basename(dir) !== "hooks") return "unknown";
  dir = dirname(dir); // 仓库布局=插件名；缓存布局=版本号
  if (/^\d+(\.\d+)*$/.test(basename(dir))) dir = dirname(dir);
  return basename(dir);
}

function recordTelemetry(outcome, event) {
  try {
    if (process.env.PLUGIN_TELEMETRY === "off" || process.env.CI) return;
    // 路径零输入面：目录是常量（无 env 覆盖）+ resolve 归一 + dirname 包含性校验
    const dir = resolve(homedir(), ".zcode", "hooks");
    const file = resolve(dir, "plugin-telemetry.jsonl");
    if (dirname(file) !== dir) return;
    try {
      if (existsSync(file) && statSync(file).size > 512 * 1024) {
        const lines = readFileSync(file, "utf-8").trimEnd().split("\n");
        writeFileSync(file, lines.slice(-2000).join("\n") + "\n");
      }
    } catch {}
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      file,
      JSON.stringify({
        ts: new Date().toISOString(),
        plugin: TELEMETRY_PLUGIN,
        event: event ?? null,
        outcome,
        ms: Date.now() - T0,
      }) + "\n",
    );
  } catch {}
}

/**
 * 放行 = 空输出 + exit 0。
 * 不要显式发 allow —— 那会覆盖其他钩子的 deny 决策。
 */
export function emitPass() {
  recordTelemetry("pass");
  process.exit(0);
}

function write(obj) {
  try {
    const out = obj?.hookSpecificOutput;
    const outcome = obj?.decision === "block" ? "block" : (out?.permissionDecision ?? "context");
    recordTelemetry(outcome, out?.hookEventName ?? null);
    writeSync(1, JSON.stringify(obj));
  } catch {
    // 输出失败也不阻塞会话。
  }
  process.exit(0);
}
