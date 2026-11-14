// skill-forge 插件自带的 hook I/O 库
//
// 为什么自带一份：插件进程的 ${ZCODE_PLUGIN_ROOT} 指向插件安装目录，
// 不应该 import 用户级 ~/.zcode/hooks/lib/io.js —— 那会造成隐式依赖，
// 用户改动自己的 lib 会把插件搞坏。
//
// 契约来源：ZCode Hook 官方文档（2026-10）
//   stdin  一行 JSON（camelCase + snake_case 双写）
//   stdout 顶层仅允许 additionalContext / continue / decision / hookSpecificOutput /
//          reason / stopReason / suppressOutput
//   退出码 0=通过 / 2=拦截 / 其他=可恢复错误
//
// 原则：任何异常都不应阻塞主会话 —— 解析失败/输出失败一律静默 exit 0。

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, writeSync } from "fs";
import { dirname, resolve } from "path";
import { homedir } from "os";

/**
 * 异步读取 stdin（Windows 管道必需）。失败返回 {}。
 *
 * 注意：不要先试 readFileSync(0) 再回退 —— Windows 上同步读 fd 0 可能
 * 返回空且消耗/锁定流，导致后续异步读也读不到。直接用异步流最稳。
 */
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
    return safeObject(JSON.parse(trimmed));
  } catch {
    return {};
  }
}

/** 取 payload 字段，优先 snake_case，回退 camelCase（ZCode 双写）。 */
export function field(payload, snake, camel) {
  if (payload == null) return undefined;
  if (Object.prototype.hasOwnProperty.call(payload, snake)) return payload[snake];
  if (camel && Object.prototype.hasOwnProperty.call(payload, camel)) return payload[camel];
  return undefined;
}

/** 注入上下文到会话（任何事件可用）。 */
export function emitContext(eventName, text) {
  if (!text) return emitPass();
  write({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: text,
    },
  });
}

// ---- 钩子遥测（单人使用的故障可见性）----
// fail-open 的代价是故障不可见：这里把每次输出/放行同步记一行到
// ~/.zcode/hooks/plugin-telemetry.jsonl（scripts/healthcheck.mjs 的 E 面汇总）。
// 三条硬约束：同步写（exit 前落盘）、自带轮转（512KB/2000 行）、任何失败绝不影响钩子。
// 关闭：PLUGIN_TELEMETRY=off（CI 自动关）。
const T0 = Date.now();
const TELEMETRY_PLUGIN = (() => {
  const seg = import.meta.url.split(/[\\/]/);
  const i = seg.lastIndexOf("plugins");
  return i >= 0 ? seg[i + 1] : "unknown";
})();

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

/** 放行。空输出 + exit 0 即「无意见」，比显式 allow 更稳（不覆盖其他 hook 的决策）。 */
export function emitPass() {
  recordTelemetry("pass");
  process.exit(0);
}

/**
 * Stop：用官方格式请求继续一轮（decision:block）。
 *
 * 为什么不用 { continue: true, stopReason }：那是 legacy 写法，官方文档说明
 * legacy 需要 additionalContext 才能把内容传进模型；用 stopReason 未必到得了模型。
 * 这里统一走 decision:block + reason。
 *
 * 注意：ZCode 限制连续 block 最多 3 次，调用方仍需自行节制。
 */
export function emitBlockStop(reason) {
  if (!reason) return emitPass();
  write({ decision: "block", reason });
}

// ---- 内部助手 ----

function write(obj) {
  try {
    // 用 writeSync(1, ...) 而不是 process.stdout.write + process.exit：
    // 管道上的 stdout 写入在 Node 里是异步的，紧跟一个 process.exit(0)
    // 理论上会在数据刷出前终止进程（Windows 尤甚）。同步写 fd 1 写完了才返回，
    // 之后 exit 就是安全的。
    const out = obj?.hookSpecificOutput;
    const outcome = obj?.decision === "block" ? "block" : (out?.permissionDecision ?? "context");
    recordTelemetry(outcome, out?.hookEventName ?? null);
    writeSync(1, JSON.stringify(obj));
  } catch {
    // 输出失败也不阻塞会话。
  }
  process.exit(0);
}

function safeObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
