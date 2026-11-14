#!/usr/bin/env node
// scripts/healthcheck.mjs — 单人插件的体检入口。
//
// 背景：本市场只有作者一个用户，故障没人报、静默 fail-open 的钩子坏了也无感。
// 单人模式的高频故障全是「多处不同步」类，本脚本把散落的真值收进一条命令：
//
//   A. 三方版本对账    plugins/*/plugin.json ↔ marketplace.json ↔ installed_plugins.json（激活口径）
//   B. 安装缓存逐字节  激活 installPath ↔ 仓库源（.mimosa 等运行时缓存跳过）
//   C. 插件规范审计    子进程跑 scripts/audit-plugins.mjs（ERROR 才算失败，WARN 只报）
//   D. 文档体量闸      子进程跑 doc-protocol 的 check-doc-budget.py（本机装了才跑）
//   E. 钩子遥测摘要    ~/.zcode/hooks/plugin-telemetry.jsonl（装了遥测才有；只读，不判失败）
//
// 用法：node scripts/healthcheck.mjs [--ci]
//   --ci  跳过依赖本机状态的检查面（A 的激活口径、B、D、E）——给 GitHub Actions 用。
// 退出码：A 不一致 / B 有差异 / C 有 ERROR / D 违规 → 1；否则 0。E 永不影响退出码。

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const CI = process.argv.includes("--ci") || !!process.env.CI;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIP_DIRS = new Set([".mimosa", ".git"]); // 运行时缓存，不算内容差异

let hardFails = 0;
const head = (s) => console.log(`\n[${s}]`);

// ---- 小工具 ----

function walkRel(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) out.push(...walkRel(abs, base));
    else out.push({ rel: relative(base, abs).split(sep).join("/"), abs, size: st.size });
  }
  return out;
}

function filesEqual(a, b) {
  if (statSync(a).size !== statSync(b).size) return false;
  return Buffer.compare(readFileSync(a), readFileSync(b)) === 0;
}

/** 树级逐字节比对。返回差异行数组（空数组 = 一致）。输出有上限，防 38M vendor 树刷屏。 */
function diffTrees(repoDir, cacheDir) {
  const repo = walkRel(repoDir);
  const cacheMap = new Map(walkRel(cacheDir).map((f) => [f.rel, f]));
  const diffs = [];
  for (const f of repo) {
    const c = cacheMap.get(f.rel);
    if (!c) diffs.push(`仅仓库源有: ${f.rel}`);
    else if (f.size !== c.size || !filesEqual(f.abs, c.abs)) diffs.push(`内容不同: ${f.rel}`);
    cacheMap.delete(f.rel);
  }
  for (const rel of cacheMap.keys()) diffs.push(`仅缓存有: ${rel}`);
  return diffs;
}

// ---- A. 三方版本对账 ----

function checkVersions() {
  head("A] 版本三方对账（manifest ↔ marketplace ↔ 激活）");
  const market = JSON.parse(readFileSync(join(ROOT, "marketplace.json"), "utf-8"));
  const marketByName = new Map(market.plugins.map((e) => [e.name, e]));

  let installed = null;
  const installedPath = join(homedir(), ".zcode", "cli", "plugins", "installed_plugins.json");
  if (!CI && existsSync(installedPath)) {
    installed = new Map(
      JSON.parse(readFileSync(installedPath, "utf-8")).plugins.map((p) => [p.name, p]),
    );
  }

  const pluginDirs = readdirSync(join(ROOT, "plugins")).filter((d) =>
    existsSync(join(ROOT, "plugins", d, ".zcode-plugin", "plugin.json")),
  );

  for (const name of pluginDirs) {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "plugins", name, ".zcode-plugin", "plugin.json"), "utf-8"),
    );
    const marketV = marketByName.get(name)?.version;
    const parts = [`manifest ${manifest.version}`];
    let ok = true;
    if (marketV === manifest.version) parts.push(`= marketplace ${marketV}`);
    else {
      ok = false;
      parts.push(`≠ marketplace ${marketV ?? "缺条目"}`);
    }

    if (installed) {
      const act = installed.get(name);
      if (!act) {
        ok = false;
        parts.push(`激活口径缺失（未安装？）`);
      } else if (act.version === manifest.version) {
        parts.push(`= 激活 ${act.version}`);
      } else {
        ok = false;
        parts.push(`≠ 激活 ${act.version}（安装态落后：Settings → Plugins → Update）`);
      }
    }

    if (ok) console.log(`  ✅ ${name}  ${parts.join(" ")}`);
    else {
      hardFails++;
      console.log(`  ❌ ${name}  ${parts.join(" ")}`);
    }
  }
  if (CI) console.log("  ⏭️ --ci：跳过激活口径（CI 上没有本机安装态）");
}

// ---- B. 安装缓存逐字节 ----

function checkCache() {
  if (CI) return;
  head("B] 安装缓存逐字节（激活 installPath ↔ 仓库源）");
  const installedPath = join(homedir(), ".zcode", "cli", "plugins", "installed_plugins.json");
  if (!existsSync(installedPath)) {
    console.log("  ⏭️ 找不到 installed_plugins.json，跳过");
    return;
  }
  for (const p of JSON.parse(readFileSync(installedPath, "utf-8")).plugins) {
    if (p.marketplace !== "zcode-plugin") continue;
    const cacheDir = p.installPath ?? p.install_path;
    const repoDir = join(ROOT, "plugins", p.name);
    if (!cacheDir || !existsSync(cacheDir)) {
      hardFails++;
      console.log(`  ❌ ${p.name}  installPath 不可解析: ${cacheDir ?? "无"}`);
      continue;
    }
    const diffs = diffTrees(repoDir, cacheDir);
    if (diffs.length === 0) console.log(`  ✅ ${p.name}  缓存 = 仓库源（逐字节一致）`);
    else {
      hardFails++;
      console.log(`  ❌ ${p.name}  ${diffs.length} 处差异:`);
      for (const d of diffs.slice(0, 10)) console.log(`       ${d}`);
      if (diffs.length > 10) console.log(`       …另有 ${diffs.length - 10} 处`);
    }
  }
}

// ---- C. 规范审计 ----

function checkAudit() {
  head("C] 插件规范审计（scripts/audit-plugins.mjs）");
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", "audit-plugins.mjs"), ROOT], {
    encoding: "utf-8",
  });
  const last = (r.stdout ?? "").trim().split("\n").pop() ?? "";
  if (r.status === 0) {
    console.log(`  ✅ ${last.replace(/^==\s*|\s*==$/g, "")}`);
  } else {
    hardFails++;
    console.log(`  ❌ ${last}`);
    for (const line of (r.stdout ?? "").split("\n")) {
      if (line.includes("ERROR") && !line.startsWith("==")) console.log(`       ${line.trim()}`);
    }
  }
}

// ---- D. 文档体量闸 ----

function checkBudget() {
  if (CI) return;
  head("D] 文档体量闸（doc-protocol check-doc-budget.py）");
  const candidates = [
    join(homedir(), ".agents", "skills", "doc-protocol", "assets", "check-doc-budget.py"),
    join(homedir(), ".zcode", "skills", "doc-protocol", "assets", "check-doc-budget.py"),
  ];
  const script = candidates.find((p) => existsSync(p));
  if (!script) {
    console.log("  ⏭️ 本机未装 doc-protocol 技能，跳过（仓库约定载体见 doc-budget.json）");
    return;
  }
  for (const py of ["python", "python3"]) {
    const r = spawnSync(py, ["-I", "-X", "utf8", script, "--root", ROOT], {
      encoding: "utf-8",
      env: { ...process.env, PYTHONUTF8: "1" }, // 注意：-I 隔离模式忽略 PYTHON* env，真正起作用的是 -X utf8
    });
    if (r.error) continue; // 该解释器不存在，试下一个
    if (r.status === 0) console.log(`  ✅ exit 0`);
    else {
      hardFails++;
      console.log(`  ❌ exit ${r.status}（越线项见其输出）`);
      for (const line of (r.stdout ?? "").split("\n")) {
        if (/[（(]超|violation|死行/.test(line)) console.log(`       ${line.trim()}`);
      }
    }
    return;
  }
  console.log("  ⏭️ 本机没有 python 解释器，跳过");
}

// ---- E. 钩子遥测摘要 ----

function checkTelemetry() {
  if (CI) return;
  head("E] 钩子遥测摘要（~/.zcode/hooks/plugin-telemetry.jsonl）");
  const path = join(homedir(), ".zcode", "hooks", "plugin-telemetry.jsonl");
  if (!existsSync(path)) {
    console.log("  ⏭️ 无遥测文件（插件 ≥1.1.5/1.0.3/1.1.4 起自动记录；更新后跑一轮钩子再看）");
    return;
  }
  const lines = readFileSync(path, "utf-8").trimEnd().split("\n").filter(Boolean);
  const byOutcome = {};
  const byPlugin = {};
  let bad = 0;
  const recentErrors = [];
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
      byPlugin[r.plugin] = (byPlugin[r.plugin] ?? 0) + 1;
      if (r.outcome !== "pass" && recentErrors.length < 5) recentErrors.push(line);
    } catch {
      bad++;
    }
  }
  console.log(`  共 ${lines.length} 条（轮转上限 2000 行/512KB）· 按结果 ${JSON.stringify(byOutcome)} · 按插件 ${JSON.stringify(byPlugin)}`);
  if (bad) console.log(`  ⚠️ ${bad} 行解析失败（不算硬失败，多半是轮转截断）`);
  if (recentErrors.length) {
    console.log("  最近非 pass 事件（遥测只报不判，定位要靠夹具与日志）：");
    for (const l of recentErrors) console.log(`       ${l.slice(0, 160)}`);
  }
}

// ---- 主流程 ----

checkVersions();
checkCache();
checkAudit();
checkBudget();
checkTelemetry();

console.log(`\n== healthcheck 结果: ${hardFails === 0 ? "PASS" : `FAIL（${hardFails} 硬失败）`} ==`);
process.exit(hardFails === 0 ? 0 : 1);
