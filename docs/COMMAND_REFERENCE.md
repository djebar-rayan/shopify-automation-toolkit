# Command Reference

Every CLI command exposed by the toolkit, with its flags.

> Any command accepts `--yes` to skip the confirmation prompts (use
> with caution — prefer the dry-run).

---

## Extraction

### `node fetch-store-data.js`

Extracts the complete store state → `store-data/*.md`.

No flag — reads `.env`. Re-runnable as often as needed.

---

## Audit

### `node audit/audit.js`

Generic read-only audit. Lists the matched entities + their flags.

| Flag | Effect |
|---|---|
| `--task <file.md>` | Read the task (recommended) |
| `--scope products\|collections\|pages\|redirects` | Without task: pick a scope |
| `--filter "<dsl>"` | Without task: apply a filter (see mini-DSL) |

### `node audit/full-audit.js`

Full audit with scoring (SEO / UX / Content / Operations).

Output: `audit-report.md` at the repo root.

---

## SEO

### `node seo/seo-update.js`

Generates and applies SEO meta using the **local formulas** from
`lib/builders/seo-meta.js` (no Gemini, free, deterministic).

| Flag | Effect |
|---|---|
| `--target=titles\|descriptions\|alt` | Which meta to generate (default: `titles`) |
| `--filter "<dsl>"` | Override the default filter |
| `--confirm` | Actually apply (otherwise dry-run) |
| `--mode=vision` (with `alt`) | Generate alts via Gemini Vision (image analysis) |

---

## Content

### `node content/update-products.js`

Generic product update, driven by a task file.

| Flag | Effect |
|---|---|
| `--task <file.md>` | **Required** |
| `--yes` | Skip the confirmation |

Supported fields: `descriptionHtml`, `seo.title`, `seo.description`,
`tags`, `handle`, `status`.

### `node content/update-collections.js`

Same for collections. Fields: `descriptionHtml`, `seo.title`,
`seo.description`, `handle`.

### `node content/update-pages.js`

Same for CMS pages. Fields: `body`, `seo.title`, `seo.description`,
`handle`, `title`.

### `node content/handle-normalize.js`

Normalizes non-ASCII handles into ASCII kebab-case.

| Flag | Effect |
|---|---|
| (none) | Dry-run |
| `--confirm` | Apply |
| `--map=<file.json>` | Transliteration preset (e.g. `lib/builders/translit-presets/tifinagh.json`) |
| `--yes` | Skip the confirmation |

---

## Images

### `node images/image-audit.js`

Image count + quality (missing alts, < threshold).

| Flag | Effect |
|---|---|
| `--task <file.md>` | Task-driven audit |
| `--filter "<dsl>"` | Ad-hoc audit |

### `node images/image-alt.js`

Updates the missing alt texts.

| Flag | Effect |
|---|---|
| `--filter "<dsl>"` | Default: `status ACTIVE, no_alt` |
| `--mode=formula\|vision` | Text source (default: `formula`) |
| `--confirm` | Apply |

### `node images/image-generate.js`

Generates images via Gemini Image. Saved locally in `generated-images/`.

| Flag | Effect |
|---|---|
| `--mode=single\|multi-variant` | Mode (default: `single`) |
| `--handle=<product-handle>` | **Required** |
| `--prompt="…"` | User prompt (otherwise default) |
| `--canonical=<idx>` | (multi-variant) canonical image (default: 0) |
| `--only="V1, V2"` | Limit to these named variants |
| `--skip="V3"` | Skip these variants |
| `--retries=<n>` | Retry count (default: `MAX_RETRIES`) |
| `--no-improve` | Do not improve the prompt via Gemini Text |
| `--dry-run` | Do not call Gemini |

### `node images/image-upload.js`

Uploads local images to Shopify (staged upload + `productCreateMedia`).

| Flag | Effect |
|---|---|
| `--handle=<product-handle>` | **Required** |
| `--file=<path>` | One single file |
| `--dir=<path>` | All `*.jpg/png/webp` in the folder |
| `--confirm` | Actually apply |
| `--link-variants` | Bind each image to the variant whose title matches the filename |
| `--delete-old` | Delete previous images after upload (**IRREVERSIBLE**) |

### `node images/visual-audit.js`

Image quality audit via Gemini Vision (`ADEQUATE` / `REPLACE` / `NO_IMAGE`).

| Flag | Effect |
|---|---|
| `--filter "<dsl>"` | Default: `status ACTIVE` |
| `--refresh` | Ignore the JSON cache and re-call Gemini |

Output: `visual-audit-report.md` + cache `.audit-tmp/visual-audit.json`.

---

## Integrations

### `node integrations/klaviyo/klaviyo-export.js`

Read-only Klaviyo export → Markdown + HTML templates.

Required env var: `KLAVIYO_API_KEY=pk_...` in `.env`.

### `node integrations/shopify-email/adapt-templates.js`

Adapts Klaviyo HTML templates for Shopify Email.

| Flag | Effect |
|---|---|
| `--src=<dir>` | Source folder (default: `../klaviyo/templates/`) |
| `--out=<dir>` | Output folder (default: `./templates-adapted/`) |
| `--mapping=<file.json>` | Custom variable substitutions |

---

## npm shortcuts

| Command | Equivalent |
|---|---|
| `npm run fetch` | `node fetch-store-data.js` |
| `npm run audit` | `node audit/audit.js` |
| `npm run audit:full` | `node audit/full-audit.js` |
| `npm run image:audit` | `node images/image-audit.js` |
| `npm run image:visual-audit` | `node images/visual-audit.js` |
| `npm run klaviyo:export` | `node integrations/klaviyo/klaviyo-export.js` |
| `npm run klaviyo:adapt` | `node integrations/shopify-email/adapt-templates.js` |
| `npm run syntax-check` | `node -c` on every `*.js` |
