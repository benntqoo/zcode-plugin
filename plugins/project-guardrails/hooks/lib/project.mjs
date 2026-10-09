// 从 cwd 解析「这次会话作用在哪个项目」。
//
// 必须从 payload 的 cwd 现算 —— 插件是全局生效的，写死路径必错。

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const MAX_UP = 40;

/** 路径归一化，仅用于比较：统一分隔符、去尾斜杠、Windows 下忽略大小写。 */
export function normPath(p) {
  if (!p) return "";
  let s = String(p).replace(/\\/g, "/").replace(/\/+$/, "");
  if (process.platform === "win32") s = s.toLowerCase();
  return s;
}

/** 项目根标记：`.git` / `.zcode` / `.agents` 同等权重，就近者赢。 */
const ROOT_MARKERS = [".git", ".zcode", ".agents"];

/**
 * 从 start 向上找项目根：**就近的标记赢**，三个标记同等权重。
 *
 * 为什么不是「.git 绝对优先」：ZCode 自己的发现顺序是越深的 `.zcode` 优先级越高
 * （它同样认 `.agents`）。落点必须与之一致，否则文件写了不生效。
 *
 * ⚠️ 加 `.agents` 的影响面：只影响「有 `.agents/` 但既无 `.git` 也无 `.zcode`」的目录 ——
 * 原先会继续向上、现在就地定根。常见仓库两者都有，行为不变。
 */
export function findProjectRoot(start) {
  let dir = resolve(start);
  for (let i = 0; i < MAX_UP; i++) {
    if (ROOT_MARKERS.some((m) => existsSync(join(dir, m)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

/**
 * 会话的项目上下文。
 *
 * isHome=true 表示算出来的根与 home 重合 —— 调用方**必须放弃**，
 * 否则会把用户级目录当成项目，规则会意外地对所有会话生效。
 */
export function resolveProject(cwd) {
  const start = cwd && String(cwd).trim() ? String(cwd) : process.cwd();
  const root = findProjectRoot(start);
  return {
    root,
    isHome: normPath(root) === normPath(homedir()),
  };
}
