// ZCode hook 共享 I/O。
//
// 每个插件自带一份，**不要** import 用户级 `~/.zcode/hooks/lib/`：
// 用户改自己的库会把插件搞坏，且插件分发出去后那个路径不存在。
//
// 输出用 writeSync 直写 fd 1：Windows 上 process.stdout.write() 后立刻
// process.exit(0)，管道里的数据可能来不及 flush 就被截断。

import { writeSync } from "node:fs";

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

/**
 * 放行 = 空输出 + exit 0。
 * 不要显式发 allow —— 那会覆盖其他钩子的 deny 决策。
 */
export function emitPass() {
  process.exit(0);
}

function write(obj) {
  try {
    writeSync(1, JSON.stringify(obj));
  } catch {
    // 输出失败也不阻塞会话。
  }
  process.exit(0);
}
