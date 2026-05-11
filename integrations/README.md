# Third-party integrations

This folder hosts the **connectors to third-party services** that are
not Shopify (ESP, automation, analytics, payment…).

Each integration lives in its own subfolder with:

- a main script (`<integration>.js`)
- a `README.md` describing the scope, required credentials and
  output files
- optionally configuration / mapping files

## Provided integrations

| Folder | Role |
|---|---|
| `klaviyo/` | Read-only Klaviyo export → Markdown files + HTML templates |
| `shopify-email/` | Generic Klaviyo → Shopify Email template adaptation |

## Adding an integration

1. Create a folder `integrations/<name>/`.
2. Place a script that reads its secrets from `lib/config` (via `.env`).
3. Document in a `README.md` the required environment variables and outputs.
4. **Read-only by default**: only trigger writes on explicit user action (`--confirm`).

## Future integration ideas

- **Brevo / Sendinblue**: alternative ESP to Klaviyo.
- **n8n**: automation orchestrator (Shopify webhooks → workflows).
- **Google Merchant Center**: catalog exports.
- **Stripe**: cross-reference customers ↔ payments for advanced metrics.
- **Plausible / Matomo**: server-side analytics.
