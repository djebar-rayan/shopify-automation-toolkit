# Troubleshooting — FAQ and common errors

## "SHOPIFY_STORE missing in .env"

→ Copy `.env.example` to `.env` and fill at least `SHOPIFY_STORE`.

```bash
cp .env.example .env
```

## "store-data/products.md not found"

→ Run `node fetch-store-data.js` first. Every generic script reads
from `store-data/`, which must have been populated.

## The command exits with code 1 without any message

→ Likely `stdio: 'pipe'` instead of `'inherit'` in a fork of
`execGql`. See **Rule 2** in `CLAUDE.md`. All toolkit scripts comply.

## "Cannot find module ./shop-config"

→ Legacy imports. The toolkit uses `./lib/config` everywhere. Make
sure relative imports are correct after a local refactor.

## The query returns `undefined` everywhere

→ You are accessing `res.data.products.edges` instead of
`res.products.edges`. The Shopify CLI **has no `.data` envelope**.
See **Rule 3** in `CLAUDE.md`.

## "Gemini Text 429" in a loop

→ Free-tier rate limit (10 req/min). The toolkit automatically retries
after 60 s, up to 3 times. If it persists:
- Reduce the task volume (tighter filter)
- Wait a few minutes
- Upgrade to the paid tier

## "blockReason: OTHER" when generating text with Gemini

→ You are using `GEMINI_MODEL` (Flash Image) for text. Use
`GEMINI_TEXT_MODEL`. See `lib/gemini-text.js` (already correct).

## Generated image rejected with "Too small (XX KB < 50KB)"

→ The prompt doesn't ask for enough quality. Add "4K quality",
"high resolution", "sharp details" and switch to `--mode=multi-variant`
with a reference image if possible.

## "Resolution too low (300×400)"

→ Same. Gemini Flash Image often returns square 1024×1024 images but
may produce thumbnails on vague prompts. Force the resolution in the
prompt: "square 4K image, 4096×4096 pixels".

## "stagedUploadsCreate failed"

→ Check the `write_files` scope. See `docs/SHOPIFY_AUTH.md`.

## "ACCESS_DENIED on menus"

→ The `menus` GraphQL query requires a private App with
`read_online_store_navigation`. `fetch-store-data.js` writes an honest
stub in `store-data/navigation.md`. Document the menu manually if
needed.

## Broken encoding (accented characters)

→ On Windows, make sure the console is set to UTF-8:
```powershell
chcp 65001
```

## "shopify-cli not found"

→ Install Shopify CLI: <https://shopify.dev/docs/api/shopify-cli/install>

## The task runs but nothing happens

→ Check that:
1. The scope is consistent with the script (`scope=products` for
   `content/update-products.js`).
2. The filter actually matches some entities (run `audit/audit.js
   --task <task>` first to verify).
3. The "Ask confirmation" box isn't ticked if you expect a non-interactive
   run (pass `--yes`).
