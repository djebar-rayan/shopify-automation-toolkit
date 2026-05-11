# CLAUDE.md — Critical technical rules

> **Non-negotiable** conventions and rules for anyone (human or AI agent)
> contributing to this repo. Every rule below already broke a Shopify
> store at some point — each rule has a concrete cost.

---

## Stack

- **Shopify CLI** ≥ 3.93 (Admin GraphQL gateway)
- **Node.js** ≥ 18 (built-ins only, **no npm dependencies**)
- **Gemini 3.1** (Google AI Studio, Flash + Flash Image models)
- **Platforms**: Windows 11 / macOS / Linux (PowerShell or bash)

---

## Rule 1 — Every GraphQL request goes through `--query-file`

On Windows, curly braces `{}` break the shell. **Never** use inline
`--query`.

```javascript
// CORRECT
fs.writeFileSync(qFile, queryString, 'utf8');
execSync(`shopify store execute --store ${STORE} --query-file "${qFile}" --output-file "${outFile}"`);

// FORBIDDEN
execSync(`shopify store execute --store ${STORE} --query '{ products... }'`);
```

Implemented in `lib/shopify-graphql.js::execGql()`.

---

## Rule 2 — `stdio: 'inherit'` is mandatory inside `execSync`

Without a TTY, the Shopify CLI exits with code 1 even when the request
succeeds.

```javascript
// CORRECT
execSync(cmd, { encoding: 'utf8', timeout: 60000, stdio: 'inherit' });

// FORBIDDEN
execSync(cmd, { encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
```

---

## Rule 3 — The GraphQL response has NO `.data` envelope

The Shopify CLI writes the inner content directly to the output file.

```javascript
// CORRECT — direct access
const edges  = res?.products?.edges || [];
const target = res?.stagedUploadsCreate?.stagedTargets?.[0];

// FORBIDDEN — double wrapper, always returns undefined
const edges  = res?.data?.products?.edges || [];
const target = res?.data?.stagedUploadsCreate?.stagedTargets?.[0];
```

---

## Rule 4 — `resource: 'PRODUCT_IMAGE'` for staged uploads

When uploading an image to a Shopify product:

```javascript
// CORRECT
{ resource: 'PRODUCT_IMAGE', filename, mimeType, httpMethod: 'POST' }

// FORBIDDEN — upload is rejected
{ resource: 'IMAGE', ... }
```

Implemented in `lib/image-upload.js::stagedUploadFromFile()`.

---

## Rule 5 — The shipping `📦` block ALWAYS opens the description

Business convention (configurable via `SHOP_SHIPPING_HTML` in `.env`).

```javascript
// CORRECT — use the builders
const { injectShipping, repositionShipping } = require('./lib/builders/shipping');
const newHtml = injectShipping(currentHtml);

// FORBIDDEN — block placed at the end
const newHtml = cleaned + SHIPPING_BLOCK;
```

---

## Rule 6 — `read_metafields` is NOT a valid Shopify OAuth scope

Product metafields are included in `read_products`. Never add
`read_metafields` or `write_metafields` to `shopify store auth --scopes`:
that triggers an OAuth error.

```bash
# CORRECT
shopify store auth --store <store> \
  --scopes read_products,write_products,read_content,write_content,read_themes,write_files

# FORBIDDEN — OAuth error
... --scopes read_products,read_metafields,write_metafields,...
```

---

## Gemini models

| Constant | Default value | Usage |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.1-flash-image-preview` | **Image generation/editing only** |
| `GEMINI_TEXT_MODEL` | `gemini-3.1-flash-lite-preview` | Text (descriptions, prompts, meta) |
| `GEMINI_VISION_MODEL` | `gemini-3.1-flash-lite-preview` | Image analysis (vision) |

> `GEMINI_VISION_MODEL` and `GEMINI_TEXT_MODEL` share the same value:
> Flash Lite handles both text + images natively.
>
> NEVER use `GEMINI_MODEL` (Flash Image) for analysis or text — it
> refuses with `blockReason: OTHER`.

The API key must start with `AIza` (Google AI Studio). OAuth tokens
(`AQ...`) do not work.

---

## `execGql` pattern (`lib/shopify-graphql.js`)

1. Write the query to `.audit-tmp/gq.graphql`
2. Write variables to `.audit-tmp/gv.json`
3. Run `shopify store execute ... --query-file ... --output-file ...`
4. Read the output file and parse the JSON
5. Return the parsed JSON (no `.data` envelope)

## Staged upload pattern (`lib/image-upload.js`)

```
stagedUploadsCreate → resourceUrl + parameters + url
  ↓
multipartPost (binary upload to the staging bucket)
  ↓
productCreateMedia (attaches resourceUrl to the product)
```

## Image generation pipeline

```
buildPrompt(product, …)
  ↓
callGeminiTextWithRetry — prompt improvement (optional)
  ↓ DELAY_GEMINI delay
callGeminiImageWithRetry — generation
  ↓
validateGeneratedImage — size ≥ 50 KB, ≥ 800×800
  ↓
local save under generated-images/
```

---

## Known limitations

- **`menus` GraphQL**: returns `ACCESS_DENIED` even with `read_content`.
  The endpoint is not available through `store execute` (it requires a
  private App with `read_online_store_navigation`).
  `fetch-store-data.js` writes a stub.
- **Gemini rate limit**: 10 req/min on the free tier. Use
  `DELAY_GEMINI=6500` ms between calls. On 429: automatic retry after
  60 s (max 3).
- **`productReorderMedia`**: **asynchronous** mutation. Returns a Job
  ID, not an immediate result — `store execute` does not follow the job.
- **Port 13387 in use** during `shopify store auth`:
  ```powershell
  netstat -ano | findstr ':13387'
  Stop-Process -Id <PID> -Force
  ```

---

## Reusability

To adapt the toolkit to a new store:

1. Copy `.env.example` → `.env`
2. Fill in `SHOPIFY_STORE`, `SHOP_BRAND_NAME`, `SHOP_BRAND_VOCABULARY`,
   `SHOP_SHIPPING_HTML`, `GEMINI_API_KEY`
3. `shopify store auth ...` (scopes above)
4. `node fetch-store-data.js`

No code change required to switch stores.
