# Task file format

A task file is a structured Markdown that describes one intervention on
the store. It is read by `audit/`, `content/`, `seo/`, `images/`.

## Skeleton

```markdown
# Human-readable task title

**Date**: YYYY-MM-DD
**Script used**: `<path/to/script.js>`
**Reference files read**: `store-data/<scope>.md`

## Target

- **Scope**: products | collections | pages | redirects
- **Filter**: <DSL expression>
- **Entities affected**: 0 (recomputed by the script)

## Action

- **Type**: audit | update | create | delete
- **Field**: descriptionHtml | seo.title | seo.description | tags | handle | status | …
- **Value**: <literal> | generate via Gemini with this prompt: "…"

## Validation

- [x] Verify target entities are in `store-data/<scope>.md`
- [x] Show planned changes (dry-run)
- [x] Ask confirmation y/N before mutation

## Success criteria

- <criterion 1>
- <criterion 2>

## Results

<!-- automatically appended by the script -->
```

## Filter mini-DSL

Combinable with comma (= AND):

| Clause | Meaning |
|---|---|
| `all` / `all products` | Every entity |
| `handle X` | handle = X |
| `handles X, Y, Z` | handle ∈ {X, Y, Z} |
| `tag X` | has the tag X |
| `status ACTIVE\|DRAFT\|ARCHIVED` | product status |
| `images < N` | fewer than N images |
| `images > N` | more than N images |
| `images = 0` | no image at all |
| `desc_words < N` | description shorter than N words |
| `desc_words > N` | description longer than N words |
| `seo_title missing` | empty meta title |
| `seo_description missing` | empty meta description |
| `no_alt` | at least one image without alt |
| `variants > N` | more than N variants |
| `vendor X` | vendor = X |

Examples:

- `status ACTIVE, images < 3, no_alt`
- `tag bestseller, desc_words < 150`
- `handles foo, bar, baz`

## Action fields

### `Type`

- `audit` — read-only, writes nothing in Shopify
- `update` — `<entity>Update` mutation
- `create` — creation (rarely used via task, prefer Shopify UI)
- `delete` — deletion (rarely used via task)

### `Field` (depends on the scope)

| Scope | Supported fields |
|---|---|
| products | `descriptionHtml`, `seo.title`, `seo.description`, `tags`, `handle`, `status` |
| collections | `descriptionHtml`, `seo.title`, `seo.description`, `handle` |
| pages | `body`, `seo.title`, `seo.description`, `handle`, `title` |

### `Value`

- **Literal**: `<p>fixed HTML</p>` or `tag1, tag2, tag3` (for `tags`)
- **Gemini**: `generate via Gemini with this prompt: "Write a description …"`
  → the script calls `lib/gemini-text.js::callGeminiTextWithRetry` with
  the prompt enriched by the product context (title, type, vendor, tags).

## Validation section

Checked boxes control the script behaviour:

- `[x] Verify target entities are in store-data/...` — pre-condition check
- `[x] Show planned changes (dry-run)` — prints the dry-run on the first 3–5 targets
- `[x] Ask confirmation y/N before mutation` — interactive prompt

Use `--yes` to skip the prompt programmatically.

## Results section

Automatically filled by the script:

```markdown
## Results — 2026-01-15T20:00:00Z
- Targeted entities: 12
- Modified entities: 12
- Errors: 0
- Field modified: descriptionHtml
- Re-fetch recommended: node fetch-store-data.js
```

## Lifecycle

1. **Create**: `cp tasks/_template.md tasks/task-001-<name>.md`
2. **Fill in**: Target + Action + Validation
3. **Test**: `node audit/audit.js --task tasks/task-001-<name>.md` (dry-run)
4. **Apply**: `node content/update-products.js --task tasks/task-001-<name>.md`
5. **Inspect**: the `## Results` section is automatically populated
6. **Re-fetch**: `node fetch-store-data.js` to refresh `store-data/`
7. **Track**: `git add tasks/task-001-<name>.md && git commit`
