# 上游 issue 草稿 — pbakaus/impeccable

> **提交入口**：https://github.com/pbakaus/impeccable/issues/new
> **建议标题**：`Detector behavior clarifications: overused-font semantics, low-contrast gradient attribution, nested-cards criteria`
> **用法**：把下方分隔线内的英文正文整段复制进 issue。三条线索共用一套复现夹具，先合一条提交；
> 维护者若要求拆分，每节自带独立的复现代码，可直接拆成三条。
> 语言用英文（上游为英文项目）。提交后把 issue 链接回填到 HANDOFF 账本 🟡 行。

---

**Title:** Detector behavior clarifications: overused-font semantics, low-contrast gradient attribution, nested-cards criteria

**Body:**

Context: I've been running impeccable 4.9.1 (engine 0.1.24, windows-x64) end-to-end as a plugin adaptation, including the `critique` flow (CLI + browser overlay) against crafted fixtures. The engine worked excellently overall — this report is only about three behavior/documentation nits we had to verify experimentally. All three were confirmed against the CLI and, where applicable, the browser-injected detector.

## 1. `overused-font`: declared vs rendered semantics

Fixture: `font-family: 'Inter'` declared on `body`, with **no** `@font-face`, no `<link>`, and Inter not installed locally (all fallbacks are system fonts).

- CLI `detect`: flags `[overused-font] Primary font: inter`
- Browser-injected detector: does **not** flag it (nothing named Inter is actually rendered)

Two defensible readings — and I'd argue the declaration itself is the slop signal (AI-generated pages routinely *declare* Inter without loading it). **Request:** document which semantics each surface uses (declaration-based vs rendered-based), so users don't read the browser-side silence as "rule missing".

## 2. `low-contrast` on gradient backgrounds: worst-point attribution, unstable reported ratio

Fixture: `body { background: linear-gradient(135deg, #6366f1, #8b5cf6); }` with 14px `#94a3b8` text.

Reported: `2.1:1 (need 4.5:1) — text #94a3b8 on #7654c6 (gradient on body)`. `#7654c6` is a synthesized composite effectively taken at a worst-case point of the gradient; point-sampling the actual glyph position gives ≈1.5:1 (it varies along the gradient).

Two sub-issues:

- The **direction** is right and conservative (fails AA regardless), which is good.
- The **number** is unstable: after editing only the copy text (different length → different element geometry → different sampling point), the same rule on the same colors reported **1.5:1**. Anyone trying to verify the reported ratio against reality will chase a moving target.

**Request:** document the sampling strategy (worst-point?), and/or report a range or the sample position (e.g. "fails AA at every sampled point" instead of a single drifting number).

## 3. `nested-cards`: document what counts as a "card"

Observed criteria (verified with minimal fixtures):

- **Fires** on real card morphology: solid background + `border-radius` + `box-shadow` (+ border + padding) nested inside another card → `[nested-cards] Card inside card (div)`
- **Silent** on a nested div whose only differentiation is a darker translucent fill (`rgba(0,0,0,.25)` + radius, no border/shadow/solid fill) — both CLI and browser side

The rule is clearly deliberate about morphology, which is good — but nothing documents it. Agents and developers fixing flagged UIs (or writing test fixtures, as I did) will otherwise guess wrong about why it fired or stayed silent. **Request:** a short "what counts as a card" note in the rule docs/output.

## Reproduction

```html
<!-- finding 1+2+3 in one file -->
<body style="font-family:'Inter';background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:48px">
  <div style="background:rgba(255,255,255,.08);border-radius:16px;padding:24px">
    <p style="color:#94a3b8;font-size:14px">low contrast text</p>
    <div style="background:rgba(0,0,0,.25);border-radius:12px;padding:16px">nested translucent div (not flagged)</div>
  </div>
</body>
<!-- finding 3 fires when the inner div gets solid bg + border + box-shadow -->
```

```
npx impeccable detect fixture.html   # 4.9.1 / engine 0.1.24 / windows-x64
```

Happy to split into three separate issues if that's easier to triage — just say the word. Thanks for a genuinely excellent tool; the critique pipeline and hooks have been rock solid in our testing.
