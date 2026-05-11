# Task files

This folder contains the **task files** that drive the generic scripts
(`audit/`, `content/`, `seo/`, `images/`).

Each task is a structured Markdown file that describes:

- **Target** — which scope (products / collections / pages / redirects) and which filter
- **Action** — type (`audit` / `update` / …), field modified, value (literal or Gemini prompt)
- **Validation** — checkboxes (pre-check, dry-run, confirmation)
- **Success criteria** — how to validate the task
- **Results** — automatically appended by the script

## Provided files

| File | Role |
|---|---|
| `_template.md` | Commented template — copy it to create a new task |
| `example-audit-images.md` | Working example — audit products with < 3 images |

## Versioning rule

- **User** task files (`task-*.md`) are **gitignored**.
- Only the template (`_template.md`) and the examples (`example-*.md`) are versioned.

## Filter mini-DSL

Combinable with comma (= AND):

```
all                           → every entity
handle X                      → entity whose handle = X
handles X, Y, Z               → entities whose handle ∈ {X,Y,Z}
tag X                         → entities tagged X
status ACTIVE|DRAFT|ARCHIVED  → products with this status
images < N                    → products with fewer than N images
images > N                    → products with more than N images
images = 0                    → products with no image
desc_words < N                → descriptions shorter than N words
desc_words > N                → descriptions longer than N words
seo_title missing             → missing SEO meta title
seo_description missing       → missing SEO meta description
no_alt                        → at least one image without alt
variants > N                  → products with more than N variants
vendor X                      → products from vendor X
```

Example: `status ACTIVE, images < 3, no_alt` matches the active products
with fewer than 3 images **and** at least one image without alt.

## Task lifecycle

1. **Create**: `cp tasks/_template.md tasks/task-001-my-action.md`
2. **Fill in**: open it, modify the Target / Action / Validation sections
3. **Test read-only**: `node audit/audit.js --task tasks/task-001-my-action.md`
4. **Apply**: `node content/update-products.js --task tasks/task-001-my-action.md`
5. **Inspect**: the `## Results` section is populated automatically
6. **Re-fetch**: `node fetch-store-data.js` to refresh `store-data/`
