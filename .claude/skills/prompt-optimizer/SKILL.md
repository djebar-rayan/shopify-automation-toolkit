---
name: prompt-optimizer
description: Optimizes Shopify GraphQL queries, API calls and Claude prompts to minimize the number of calls, reduce latency and avoid common mistakes (rate limits, missing scopes, pagination). Use when GraphQL queries are slow, hitting rate limits, need pagination fixes, or when API calls can be batched or restructured for efficiency.
---

# Prompt Optimizer

Optimizes Shopify GraphQL queries and API calls to maximize efficiency
and minimize cost.

## Instructions

### Step 1 — Audit the existing queries

Read the target file (e.g. `audit/full-audit.js`) and look for:

- GraphQL queries that select too many fields (over-fetching)
- Queries that could be merged into a single one
- Inefficient pagination loops
- Mutations executed one by one instead of in batch

### Step 2 — Shopify GraphQL optimization rules

**Rule 1 — Only select the fields you actually need**

```graphql
# Before (over-fetching)
products(first: 50) {
  edges { node { id title handle descriptionHtml tags vendor productType status
    images(first: 10) { edges { node { id url altText width height } } }
    variants(first: 20) { edges { node { id price compareAtPrice sku inventoryQuantity barcode weight } } }
  } }
}

# After (strict fields)
products(first: 50) {
  edges { node { id title handle descriptionHtml tags
    images(first: 5) { edges { node { id altText } } }
    variants(first: 5) { edges { node { sku } } }
  } }
}
```

**Rule 2 — Batch mutations**

```graphql
# Before: 1 mutation per product = N API calls
# After: metafieldsSet accepts up to 25 metafields per call
mutation { metafieldsSet(metafields: [{...}, {...}, ...25 max]) { ... } }
```

**Rule 3 — Optimal pagination**

- Batch size 50 for products (max 250, but costs more in query points)
- Use `pageInfo { hasNextPage endCursor }`, not `totalCount`
- Do not re-fetch pages you already retrieved

**Rule 4 — Avoid N+1**

```graphql
# Bad: query product THEN a separate query for metafields
# Good: include metafields(namespace: "global", first: 5) inside the product query
```

**Rule 5 — Shopify rate limits**

- REST: 2 req/s (leaky bucket of 40)
- GraphQL: cost is computed per field (shop info = 1, product = 2, variants = 2/variant)
- Metafields: expensive — limit to `first: 5`, not `first: 250`
- On 429: wait for the `Retry-After` header (1–60 s)

### Step 3 — Node.js script optimization

**Add an adaptive delay between requests**:

```javascript
// Before
for (const batch of batches) { execQuery(batch); }

// After — respect rate limits
for (const batch of batches) {
  execQuery(batch);
  await new Promise(r => setTimeout(r, 500)); // 500 ms between calls
}
```

**Cache results locally**:

```javascript
const CACHE_FILE = '.audit-tmp/cache.json';
function cachedQuery(key, queryFn) {
  if (fs.existsSync(CACHE_FILE)) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE));
    if (cache[key]) return cache[key];
  }
  const result = queryFn();
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE)) : {};
  cache[key] = result;
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  return result;
}
```

### Step 4 — Claude prompt optimization

If the script uses the Claude API for content generation:

- **Use prompt caching** (`cache_control: { type: "ephemeral" }`) for long system prompts
- **Batch with Claude**: generate 10 meta titles in one call rather than 1 per call
- **Right model for the job**: Haiku for simple repetitive tasks (meta descriptions), Sonnet for complex content

### Step 5 — Optimization report

Display:

```
Before optimization:
  - X GraphQL queries for Y products
  - Estimated cost: Z query points
  - Estimated duration: T seconds

After optimization:
  - X' queries (saving: N%)
  - Estimated cost: Z' query points
  - Estimated duration: T' seconds
```

### Step 6 — Apply the optimizations

Modify the target file with the validated optimizations.
Always test on 5 products before running on 100.
