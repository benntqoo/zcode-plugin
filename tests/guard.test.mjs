// guard.mjs 直调测试 —— 规则解析与匹配（fail-open 语义不许变：坏配置一律放行）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluate, loadGuardrails, matchText, readGuardrailsFile } from "../plugins/project-guardrails/hooks/lib/guard.mjs";

function tmpRepo(files) {
  const root = mkdtempSync(join(tmpdir(), "guardrails-g-"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  return root;
}

test("readGuardrailsFile：.agents 优先；.agents JSON 坏时回退 .zcode；全缺 → null", () => {
  const both = tmpRepo({
    ".agents/guardrails.json": JSON.stringify({ context: ["from-agents"] }),
    ".zcode/guardrails.json": JSON.stringify({ context: ["from-zcode"] }),
  });
  try {
    const found = readGuardrailsFile(both);
    assert.equal(found.rel, ".agents/guardrails.json");
    assert.deepEqual(found.parsed.context, ["from-agents"]);
  } finally {
    rmSync(both, { recursive: true, force: true });
  }

  const fallback = tmpRepo({
    ".agents/guardrails.json": "{bad",
    ".zcode/guardrails.json": JSON.stringify({ context: ["from-zcode"] }),
  });
  try {
    assert.equal(readGuardrailsFile(fallback).rel, ".zcode/guardrails.json");
  } finally {
    rmSync(fallback, { recursive: true, force: true });
  }

  const empty = mkdtempSync(join(tmpdir(), "guardrails-e-"));
  try {
    assert.equal(readGuardrailsFile(empty), null);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("loadGuardrails：只认 deny/ask；坏正则丢条目；tool 缺省 *；reason 有默认", () => {
  const root = tmpRepo({
    ".agents/guardrails.json": JSON.stringify({
      context: ["ok", "  ", 123],
      rules: [
        { tool: "Bash", pattern: "git push --force", action: "deny" },
        { pattern: "rm -rf", action: "ask", reason: "危险删除" },
        { pattern: "x", action: "allow" }, // 非 deny/ask → 丢
        { pattern: "(unclosed", action: "deny" }, // 坏正则 → 丢
        { pattern: "y" }, // 无 action → 丢
        "not-an-object",
      ],
    }),
  });
  try {
    const g = loadGuardrails(root);
    assert.deepEqual(g.context, ["ok"]);
    assert.equal(g.rules.length, 2);
    const [deny, ask] = g.rules;
    assert.equal(deny.action, "deny");
    assert.equal(deny.tool, "Bash");
    assert.equal(ask.tool, "*");
    assert.equal(ask.reason, "危险删除");
    assert.equal(deny.reason, "命中项目规则 git push --force");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("evaluate：deny 最严先返；无 deny 返回第一条 ask；tool 过滤大小写不敏感且支持 |", () => {
  const g = {
    rules: [
      { tool: "Write", re: /secret/, action: "ask", reason: "r1" },
      { tool: "bash|write", re: /force/, action: "deny", reason: "r2" },
      { tool: "*", re: /anything/, action: "ask", reason: "r3" },
    ],
  };
  assert.equal(evaluate(g, "Bash", "git push --force").reason, "r2"); // deny 越过前面的 ask
  assert.equal(evaluate(g, "Write", "my secret").reason, "r1");
  assert.equal(evaluate(g, "WebFetch", "anything at all").reason, "r3"); // * 兜底
  assert.equal(evaluate(g, "Bash", "harmless"), null);
  assert.equal(evaluate(null, "Bash", "x"), null);
});

test("matchText：抽已知键拼接；全空回退整 JSON；超长截 20000；非字符串忽略", () => {
  const t = matchText("Bash", { command: "git push", file_path: "a.ts", n: 42 });
  assert.match(t, /git push/);
  assert.match(t, /a\.ts/);
  assert.doesNotMatch(t, /42/);

  assert.match(matchText("Bash", { weird: "only-unknown" }), /only-unknown/);
  assert.equal(matchText("Bash", {}).length, 2); // "{}" 的 JSON 兜底
  assert.equal(matchText("Bash", null), "");
  assert.equal(matchText("Bash", { command: "x".repeat(30000) }).length, 20000);
});
