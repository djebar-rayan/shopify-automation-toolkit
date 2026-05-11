# Klaviyo — read-only export

This folder exports the **Klaviyo** configuration of an account into
local Markdown files + one HTML template per email. **No mutation**:
only `GET` requests are performed.

## Prerequisites

- A Klaviyo Private API key (starts with `pk_…`).
- Set `KLAVIYO_API_KEY=pk_xxx` in the `.env` at the repo root.

## Run the export

```bash
node integrations/klaviyo/klaviyo-export.js
```

## Output files

| File | Content |
|---|---|
| `flows.md` | Every flow with trigger, status, action/email counts |
| `lists.md` | Every list |
| `segments.md` | Every segment + truncated definition (200c) |
| `metrics.md` | Every metric |
| `profiles-summary.md` | **Aggregated** counters (PII-free): total, subscribed, etc. |
| `klaviyo-summary.md` | Overview + flows table |
| `templates/<flow-slug>_<n>.html` | Raw HTML of each email |

## Guarantees

- **No write to Klaviyo**: the HTTP method is locked to `GET`.
- **No PII exported**: `profiles-summary.md` contains only counters
  and the property **keys** (never the values).
- **Rate limit**: 500 ms between requests + 60 s retry on 429.
