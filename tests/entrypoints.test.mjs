// entrypoints.mjs 直调测试 —— 核心是 M1 的 parity 不变量回归：
// 死行判定必须与 check-doc-budget.py 的 `_is_completed_row` 同语义
// （剥反引号 span 后整行找 ~~，单个即死）。2026-11-15 修的就是这三处漂移。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUDGET_DEFAULTS,
  buildEntrypointBlocks,
  loadBudgetConfig,
  loadEntrypoints,
  resolveInside,
  safeRelPath,
  sliceRegion,
} from "../plugins/project-guardrails/hooks/lib/entrypoints.mjs";

function tmpRepo(files) {
  const root = mkdtempSync(join(tmpdir(), "guardrails-ep-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

// 四行账本：①正常活跃 ②单个 ~~（Python 判死）③~~ 在备注格（Python 判死）
// ④~~ 在反引号 span 里（Python 豁免）。两处「死」两处「活」，一处都不能错。
const LEDGER = [
  "## 待办账本",
  "",
  "| 状态 | 事项 | 来源段 | 备注 |",
  "|---|---|---|---|",
  "| 🔴 待办 | 正常活跃行 | 一 | — |",
  "| 🟡 挂起 | 半个删除线~~ | 二 | — |",
  "| 🔴 待办 | 波浪线在备注格 | 三 | 见~~旧~~记录 |",
  "| 🔴 待办 | 反引号里引用语法 | 四 | 语法是 `~~text~~` 字面量 |",
  "",
  "## 一、正文起点",
  "",
  "正文。",
].join("\n");

const BUDGET = JSON.stringify({ ledger: { from: "^## 待办账本", to: "^## 一、" } });

// Python 真源闸（本机装了 doc-protocol 才跑；CI 上没有则 skip，靠上面 JS 断言兜底）
const PY_SCRIPT =
  existsSync(join(homedir(), ".agents", "skills", "doc-protocol", "assets", "check-doc-budget.py"))
    ? join(homedir(), ".agents", "skills", "doc-protocol", "assets", "check-doc-budget.py")
    : join(homedir(), ".zcode", "skills", "doc-protocol", "assets", "check-doc-budget.py");
const PY = ["python", "python3"].find((cmd) => !spawnSync(cmd, ["--version"], { encoding: "utf-8" }).error);

test("M1 回归：死行判定与 Python 同语义（2 死 2 活，三场景各就各位）", () => {
  const root = tmpRepo({ "handoff.md": LEDGER, "doc-budget.json": BUDGET });
  try {
    const blocks = buildEntrypointBlocks(root, loadEntrypoints(root).specs).join("\n");
    // 预算块：两行死行，一个不多一个不少
    assert.match(blocks, /活账本 .+\(2 死行\)/);
    // 表格块：只剩 ①④，②③ 被判死丢弃
    assert.match(blocks, /待办 2 项/);
    assert.match(blocks, /正常活跃行/);
    assert.match(blocks, /反引号里引用语法/);
    assert.doesNotMatch(blocks, /半个删除线/);
    assert.doesNotMatch(blocks, /波浪线在备注格/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Python 真源闸对同一夹具报同样的死行数（本机装了 doc-protocol 才跑）", { skip: !PY || !existsSync(PY_SCRIPT) }, () => {
  const root = tmpRepo({ "handoff.md": LEDGER, "doc-budget.json": BUDGET });
  try {
    const r = spawnSync(PY, ["-I", "-X", "utf8", PY_SCRIPT, "--root", root], {
      encoding: "utf-8",
      env: { ...process.env, PYTHONUTF8: "1" }, // 注意：-I 隔离模式忽略 PYTHON* env，真正起作用的是 -X utf8
    });
    assert.equal(r.status, 1); // 夹具含死行 → 闸退出 1 是预期
    const json = JSON.parse(r.stdout); // 非 tty 下只输出 JSON
    const v = (json.violations ?? []).find((x) => x.code === "ledger.completed_rows");
    assert.ok(v, JSON.stringify(json).slice(0, 300));
    assert.match(v.message, /2 行/); // 与 JS 侧「2 死行」合流
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("表头与分隔行不算数据行；✅ 行静默丢弃不计入无状态", () => {
  const root = tmpRepo({
    "handoff.md": [
      "## 待办账本",
      "",
      "| 状态 | 事项 |",
      "|---|---|",
      "| ✅ | 已完成不该出现在活表 |",
      "| 没有符号的行 | 也丢但要计数 |",
      "| 🔴 待办 | 唯一活行 |",
      "",
    ].join("\n"),
  });
  try {
    const blocks = buildEntrypointBlocks(root, loadEntrypoints(root).specs).join("\n");
    assert.match(blocks, /待办 1 项/);
    assert.match(blocks, /唯一活行/);
    assert.doesNotMatch(blocks, /已完成不该出现/);
    // 无状态行计入「未列出」提示
    assert.match(blocks, /1 行无状态符号未列出/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("loadEntrypoints：没写 → 内置约定；写 [] → 明确关掉；坏条目丢该条", () => {
  const root = tmpRepo({ "handoff.md": LEDGER, "doc-budget.json": BUDGET });
  try {
    const conv = loadEntrypoints(root);
    assert.equal(conv.explicit, false);
    assert.equal(conv.specs.length, 2); // 账本索引 + 体量

    mkdirSync(join(root, ".agents"), { recursive: true });
    writeFileSync(join(root, ".agents", "guardrails.json"), JSON.stringify({ entrypoints: [] }));
    const off = loadEntrypoints(root);
    assert.equal(off.explicit, true);
    assert.equal(off.specs.length, 0);

    writeFileSync(
      join(root, ".agents", "guardrails.json"),
      JSON.stringify({
        entrypoints: [{ id: "bad-kind", kind: "nope", file: "handoff.md" }, null, { id: "ok", file: "handoff.md" }],
      }),
    );
    const cfg = loadEntrypoints(root);
    assert.equal(cfg.explicit, true);
    assert.equal(cfg.specs.length, 1);
    assert.equal(cfg.specs[0].id, "ok");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("loadBudgetConfig：JSON 坏 → 默认；部分配置合并不丢默认字段", () => {
  const root = tmpRepo({ "doc-budget.json": "{broken json" });
  try {
    assert.deepEqual(loadBudgetConfig(root), BUDGET_DEFAULTS);
    writeFileSync(join(root, "doc-budget.json"), JSON.stringify({ ledger: { maxBytes: 999 } }));
    const cfg = loadBudgetConfig(root);
    assert.equal(cfg.ledger.maxBytes, 999);
    assert.equal(cfg.ledger.maxLines, BUDGET_DEFAULTS.ledger.maxLines); // 未覆盖字段留默认
    assert.deepEqual(cfg.documents, BUDGET_DEFAULTS.documents);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("safeRelPath/resolveInside：绝对路径、盘符、.. 穿越一律拒绝；钉在 root 内", () => {
  assert.equal(safeRelPath("/etc/passwd"), null);
  assert.equal(safeRelPath("C:\\Windows\\system32"), null);
  assert.equal(safeRelPath("docs/../../secret"), null);
  assert.equal(safeRelPath("docs/handoff.md"), "docs/handoff.md");

  const base = mkdtempSync(join(tmpdir(), "guardrails-ri-"));
  try {
    const inside = resolveInside(base, "docs/handoff.md");
    assert.ok(inside && inside.startsWith(base));
    assert.equal(resolveInside(base, "../outside"), null);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("sliceRegion：from 为 ## 时 ### 子分组不算终止（表格挂在子标题下也能读到）", () => {
  const lines = ["## 待办账本", "### 分组", "| 🔴 待办 | x |", "## 二、后续"];
  const { start, end } = sliceRegion(lines, { from: "## 待办账本" });
  assert.equal(start, 0);
  assert.equal(end, 3); // 止于同级 ## 二、，### 分组 不截断
});

test("sliceRegion：配了 to 只认 to；正则 from 编译失败回退字面量前缀", () => {
  const lines = ["## 一", "内容", "## 二", "更多"];
  assert.equal(sliceRegion(lines, { from: "## 一", to: "^## 二" }).end, 2);
  // 「表（草稿」含未配对括号 → 编译失败 → startsWith 字面量兜底
  const lit = ["## 表（草稿", "| 🔴 | x |", "## 下节"];
  const r = sliceRegion(lit, { from: "## 表（草稿" });
  assert.equal(r.start, 0);
  assert.equal(r.end, 2);
});
