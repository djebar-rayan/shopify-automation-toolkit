# Quick Start — from clone to first audit in 15 minutes

## 1. Prerequisites

- Node.js ≥ 18
- Shopify CLI ≥ 3.93 (`shopify --version`)
- An account on the target Shopify store (`read_products` minimum, `write_products` for mutations)
- A Gemini API key (starts with `AIza`) — free at <https://aistudio.google.com/app/apikey>

## 2. Clone and configure

```bash
git clone https://github.com/djebar-rayan/shopify-automation-toolkit.git
cd shopify-automation-toolkit

cp .env.example .env
# Open .env and fill at minimum:
#   SHOPIFY_STORE=my-store.myshopify.com
#   SHOP_BRAND_NAME=My Brand
#   GEMINI_API_KEY=AIza...
```

## 3. Shopify authentication

```bash
shopify store auth --store my-store.myshopify.com \
  --scopes read_products,write_products,read_content,write_content,read_themes,write_files
```

A browser window opens — authorize the access. The token is then
stored by the CLI.

> If you get "port 13387 already in use":
> ```powershell
> netstat -ano | findstr ':13387'
> Stop-Process -Id <PID> -Force
> ```

## 4. First fetch

```bash
node fetch-store-data.js
```

Expected output:

```
[1/9] Fetching products...
  page 1… 50 → total 50
  page 2… 47 → total 97
  ✓ products.md (315 KB)
[2/9] Fetching collections...
…
✅ Extraction completed in 38s
```

Check that `store-data/` now contains 9 `.md` files.

## 5. First audit

```bash
node audit/full-audit.js
```

Output: `audit-report.md` at the repo root. Open it and read the
"Overall scores" and "Critical issues (Priority 1)" sections.

## 6. First action — SEO example

If the audit shows `seo_title_missing` flags:

```bash
# Dry-run first (nothing applied)
node seo/seo-update.js --target=titles

# If the preview looks good, apply:
node seo/seo-update.js --target=titles --confirm
```

## 7. Re-fetch + comparative audit

```bash
node fetch-store-data.js   # refresh store-data/
node audit/full-audit.js   # new audit-report.md
```

Compare scores. The SEO score should have improved.

## Next steps

- [docs/COMMAND_REFERENCE.md](COMMAND_REFERENCE.md) — every CLI command
- [docs/TASK_FORMAT.md](TASK_FORMAT.md) — write a custom task file
- [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md) — common errors
- [CLAUDE.md](../CLAUDE.md) — critical technical rules
