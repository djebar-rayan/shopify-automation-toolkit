# Architecture — `store-data` + `scripts` + `tasks`

This document explains the **why** behind the toolkit's three pillars.
The **how** lives in `README.md` and `docs/COMMAND_REFERENCE.md`.

---

## The problem we're solving

A Shopify store changes constantly. Every modification (new product,
description update, handle normalization, …) requires:

1. **Understanding the current state** without hammering Shopify 50
   times (rate limit).
2. **Describing the intent** (e.g. "all products with fewer than 3
   images") in a way that both a human and an AI agent can verify
   together.
3. **Applying** the mutation to Shopify idempotently.
4. **Tracing** what was done so it can be audited later.

Ad-hoc scripts pile up fast and become unmanageable. The
`store-data + scripts + tasks` triad addresses all four points.

---

## Pillar 1 — `store-data/`: the local source of truth

`fetch-store-data.js` extracts the full state of the store into
**9 Markdown files** (one per category):

```
store-data/
├── products.md       # 1 block per product (ID, handle, SEO, images, variants, metafields)
├── collections.md
├── customers.md      # anonymized aggregate (zero PII)
├── orders.md         # aggregate (revenue, AOV, top products)
├── pages.md
├── metafields.md     # summary per namespace
├── redirects.md
├── navigation.md
└── store-meta.md     # global snapshot (plan, currency, volumes)
```

**Why Markdown rather than JSON?**

- **Human-readable** in any editor or on GitHub.
- **Diffable**: `git diff` clearly shows what changed between two
  extractions (useful for recurring audits).
- **Parseable** by scripts: an MD format with `## Title` sections and
  `- **Key**: value` fields is trivial to read.

`store-data/` is **gitignored**: it's local and store-specific.

---

## Pillar 2 — `lib/` + domain folders: one tool, one responsibility

Every CLI script does **one thing**:

| Domain | Scripts |
|---|---|
| Audit | `audit/audit.js`, `audit/full-audit.js` |
| SEO | `seo/seo-update.js` |
| Content | `content/update-products.js`, `content/update-collections.js`, `content/update-pages.js`, `content/handle-normalize.js` |
| Images | `images/image-audit.js`, `images/image-alt.js`, `images/image-generate.js`, `images/image-upload.js`, `images/visual-audit.js` |

All of them rely on `lib/` for shared logic:

- `lib/config.js` — centralized config (`.env`)
- `lib/shopify-graphql.js` — `execGql` / `execMutation`
- `lib/store-data.js` — parser for `store-data/<scope>.md`
- `lib/task-file.js` — task-file parser
- `lib/filter-dsl.js` — mini filter DSL
- `lib/gemini-text.js` / `gemini-vision.js` / `gemini-image.js` — Gemini
- `lib/image-download.js` / `image-validate.js` / `image-upload.js` — image pipeline
- `lib/builders/seo-meta.js` / `content-prompts.js` / `handle.js` / `shipping.js` — parameterized formulas

**Rule**: one file = one responsibility. If a script grows, it gets
split.

---

## Pillar 3 — `tasks/`: intent described, verifiable, idempotent

Every update is described in a Markdown file:

```markdown
## Target
- Scope: products
- Filter: status ACTIVE, desc_words < 150

## Action
- Type: update
- Field: descriptionHtml
- Value: generate via Gemini with this prompt: "…"

## Validation before applying
- [x] Verify in store-data/products.md
- [x] Show dry-run
- [x] Ask for confirmation

## Success criteria
- 100% of targeted products have a description ≥ 150 words
```

The generic scripts (`content/update-products.js`, `audit/audit.js`, …)
**read this file**, apply the action, and **write the results** at the
bottom of the file:

```markdown
## Results — 2026-01-15T20:00:00Z
- Entities targeted: 12
- Entities modified: 12
- Errors: 0
```

**Benefits**:

- The task file is a **versionable trace** (git-blame friendly).
- The dry-run lets you **validate** the intent before mutating.
- The **success criteria** make the audit objective.
- The AI agent can generate the task, the user reviews and approves it.

---

## Filter mini-DSL

The `Filter` field accepts a simple syntax, combinable with commas
(= AND):

```
all                           → every entity
handle X                      → entity whose handle = X
handles X, Y, Z               → entities whose handle ∈ {X, Y, Z}
tag X                         → entities tagged with X
status ACTIVE|DRAFT|ARCHIVED  → products with that status
images < N                    → products with fewer than N images
images > N
images = 0
desc_words < N
desc_words > N
seo_title missing
seo_description missing
no_alt                        → at least one image without alt
variants > N
vendor X
```

The DSL is implemented in `lib/filter-dsl.js` and is fully
unit-testable.

---

## Typical workflow loop

```
┌──────────────────────────────────────────────────────────────┐
│ 1. node fetch-store-data.js          → store-data/*.md        │
│ 2. node audit/full-audit.js          → audit-report.md        │
│    (or targeted audit via tasks/)                              │
│ 3. cp tasks/_template.md tasks/<task>.md                       │
│ 4. node content/update-products.js --task tasks/<task>.md      │
│    → Shopify mutations + ## Results appended to the task       │
│ 5. node fetch-store-data.js          → re-fetch                │
│ 6. git add tasks/<task>.md && git commit  (traceability)       │
└──────────────────────────────────────────────────────────────┘
```

Everything is replayable, verifiable, traceable.
