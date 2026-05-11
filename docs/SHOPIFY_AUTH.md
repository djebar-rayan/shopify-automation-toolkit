# Shopify authentication

The toolkit uses **Shopify CLI** for its Admin GraphQL requests. All
calls flow through `shopify store execute` (see `lib/shopify-graphql.js`).

## Recommended scopes

```bash
shopify store auth --store <store>.myshopify.com \
  --scopes read_products,write_products,read_content,write_content,read_themes,write_files
```

| Scope | What for |
|---|---|
| `read_products`, `write_products` | the whole products + images toolkit |
| `read_content`, `write_content` | CMS pages, collection descriptions |
| `read_themes` | inspect the active theme (`audit/full-audit.js`) |
| `write_files` | staged image uploads |

### Optional scopes

| Scope | What for |
|---|---|
| `read_customers` | anonymized aggregates in `store-data/customers.md` |
| `read_orders` | order aggregates in `store-data/orders.md` |

> ⚠️ **`read_metafields` / `write_metafields` do NOT exist.** Product
> metafields are bundled with `read_products` / `write_products`. Adding
> `read_metafields` triggers an OAuth error.

## Troubleshooting

### "port 13387 already in use"

The CLI's local OAuth server uses this port. If a zombie process is
holding it from a previous `auth`:

**Windows / PowerShell**:
```powershell
netstat -ano | findstr ':13387'
Stop-Process -Id <PID> -Force
```

**macOS / Linux**:
```bash
lsof -ti:13387 | xargs kill -9
```

### "ACCESS_DENIED" on some queries

The required scope isn't granted. Re-run `shopify store auth` with the
missing scope. For **menus** (navigation), no scope works through
`store execute` — the endpoint requires a private App with
`read_online_store_navigation`.

### Token expired

The CLI re-prompts you on the next command. If not:

```bash
shopify auth logout
shopify store auth --store <store> --scopes ...
```

### "Invalid store URL"

The expected format is `<name>.myshopify.com` (no `https://`, no
trailing slash).

## Check the current auth

```bash
shopify store info
```

Prints the connected store + granted scopes.

## Test a quick query

```bash
echo "query { shop { name } }" > /tmp/q.graphql
shopify store execute --store <store>.myshopify.com \
  --query-file /tmp/q.graphql --output-file /tmp/r.json
cat /tmp/r.json
```

Must return `{"shop":{"name":"…"}}` (no `.data` envelope).
