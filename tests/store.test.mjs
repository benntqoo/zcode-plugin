// memory-loop store.mjs 直调测试 —— 指纹去重与 jsonl/state 读写（永不抛错语义）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendJsonl, fingerprint, readJsonl, readState, writeState } from "../plugins/memory-loop/hooks/lib/store.mjs";

test("fingerprint：同内容同指纹；ts/session 不进指纹；summary 只取前 200 字", () => {
  const a = { signals: "s", summary: "sum", ts: "2026-01-01", session_id: "a" };
  const b = { signals: "s", summary: "sum", ts: "2026-02-02", session_id: "b" };
  assert.equal(fingerprint(a), fingerprint(b)); // 只有 ts/session 不同 → 同指纹（去重靠它）
  assert.notEqual(fingerprint({ signals: "s", summary: "sum" }), fingerprint({ signals: "s2", summary: "sum" }));
  const long = { signals: "x", summary: "y".repeat(500) };
  const tail = { signals: "x", summary: "y".repeat(200) + "z".repeat(300) };
  assert.equal(fingerprint(long), fingerprint(tail)); // 200 字之后不影响
});

test("readJsonl：缺文件/坏行/非对象行都安全跳过，永不抛错", () => {
  assert.deepEqual(readJsonl(join(tmpdir(), "definitely-missing.jsonl")), []);
  const dir = mkdtempSync(join(tmpdir(), "guardrails-s-"));
  try {
    const p = join(dir, "x.jsonl");
    writeFileSync(p, ['{"a":1}', "not json", "[1,2]", "", '{"b":2}'].join("\n"));
    assert.deepEqual(readJsonl(p), [{ a: 1 }, { b: 2 }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appendJsonl + readJsonl 往返；空列表写 0；自动建目录", () => {
  const dir = mkdtempSync(join(tmpdir(), "guardrails-s-"));
  try {
    const p = join(dir, "nested", "c.jsonl");
    assert.equal(appendJsonl(p, []), 0);
    assert.equal(appendJsonl(p, [{ i: 1 }, { i: 2 }]), 2);
    assert.deepEqual(readJsonl(p), [{ i: 1 }, { i: 2 }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readState/writeState：往返；损坏/缺失回退 fallback", () => {
  const dir = mkdtempSync(join(tmpdir(), "guardrails-s-"));
  try {
    const p = join(dir, "state.json");
    assert.deepEqual(readState(p, { consumed: 0 }), { consumed: 0 }); // 缺失
    writeState(p, { consumed: 5 });
    assert.deepEqual(readState(p, {}), { consumed: 5 });
    writeFileSync(p, "{corrupt");
    assert.deepEqual(readState(p, { consumed: 0 }), { consumed: 0 }); // 损坏
    assert.deepEqual(existsSync(p), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
