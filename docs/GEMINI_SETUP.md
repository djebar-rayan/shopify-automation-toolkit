# Gemini setup

## 1. Get an API key

1. Go to <https://aistudio.google.com/app/apikey>
2. Sign in with a Google account
3. Click "Create API key"
4. Copy the key — it starts with **`AIza...`**

> OAuth tokens (`AQ...`) **do not work** with this toolkit.

## 2. Configure `.env`

```bash
GEMINI_API_KEY=AIzaSy...real_key_here
```

## 3. Models used

The toolkit defines 3 models in `.env`:

| Variable | Default value | Role |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.1-flash-image-preview` | **Image generation/editing only** |
| `GEMINI_TEXT_MODEL` | `gemini-3.1-flash-lite-preview` | Text (descriptions, prompts, meta) |
| `GEMINI_VISION_MODEL` | `gemini-3.1-flash-lite-preview` | Image analysis (vision) |

> ⚠️ Never use `GEMINI_MODEL` (Flash Image) for text or analysis — the
> model rejects those calls with `blockReason: OTHER`.

> Flash Lite natively supports text AND vision: the same model ID is
> used for `GEMINI_TEXT_MODEL` and `GEMINI_VISION_MODEL`.

## 4. Free tier limits

- **10 requests / minute** per model
- The toolkit automatically waits `DELAY_GEMINI=6500 ms` between calls
- On **429 Rate Limit** or **503 Unavailable**: retry after 60 s
  (up to `MAX_RETRIES=3`, configurable)

## 5. Paid tier cost

- See <https://ai.google.dev/pricing> for current rates
- Flash Lite: very cheap (text + vision)
- Flash Image: priced per image generation token

## 6. Test it

```bash
node -e "
const { callGeminiTextWithRetry } = require('./lib/gemini-text');
callGeminiTextWithRetry('Say hello in English.').then(console.log);
"
```

If the key is valid, you should see a response within a few seconds. Otherwise:

- `GEMINI_API_KEY invalid or missing` → check `.env`
- `Gemini Text 401` → invalid / revoked key
- `Gemini Text 429` → rate limit (wait 60 s)
- `Gemini Text 403` → quota exhausted
