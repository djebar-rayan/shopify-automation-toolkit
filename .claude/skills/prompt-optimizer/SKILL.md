---
name: prompt-optimizer
description: Optimise les requêtes GraphQL Shopify, les appels API, et les prompts Claude pour minimiser le nombre d'appels, réduire la latence et éviter les erreurs courantes (rate limits, scopes manquants, pagination). Use when GraphQL queries are slow, hitting rate limits, need pagination fixes, or when API calls can be batched or restructured for efficiency.
---

# Prompt Optimizer

Optimise les requêtes GraphQL Shopify et les appels API pour maximiser l'efficacité et minimiser les coûts.

## Instructions

### Step 1 : Auditer les requêtes existantes

Lire le fichier cible (ex. `shopify-audit.js`) et identifier :
- Requêtes GraphQL qui sélectionnent trop de champs (over-fetching)
- Requêtes qui pourraient être fusionnées en une seule
- Boucles de pagination inefficaces
- Mutations exécutées une par une au lieu de batch

### Step 2 : Règles d'optimisation GraphQL Shopify

**Règle 1 — Ne sélectionner que les champs nécessaires**
```graphql
# Avant (over-fetching)
products(first: 50) {
  edges { node { id title handle descriptionHtml tags vendor productType status
    images(first: 10) { edges { node { id url altText width height } } }
    variants(first: 20) { edges { node { id price compareAtPrice sku inventoryQuantity barcode weight } } }
  } }
}

# Après (champs stricts)
products(first: 50) {
  edges { node { id title handle descriptionHtml tags
    images(first: 5) { edges { node { id altText } } }
    variants(first: 5) { edges { node { sku } } }
  } }
}
```

**Règle 2 — Batch les mutations**
```graphql
# Avant : 1 mutation par produit = N appels API
# Après : metafieldsSet accepte jusqu'à 25 metafields par appel
mutation { metafieldsSet(metafields: [{...}, {...}, ...25 max]) { ... } }
```

**Règle 3 — Pagination optimale**
- Batch size 50 pour les produits (max 250 mais coûte plus en query cost)
- Utiliser `pageInfo { hasNextPage endCursor }` pas `totalCount`
- Ne pas re-fetcher des pages déjà récupérées

**Règle 4 — Éviter les N+1**
```graphql
# Mauvais : query produit PUIS query metafields séparée
# Bon : inclure metafields(namespace: "global", first: 5) dans la query produit
```

**Règle 5 — Rate limits Shopify**
- REST: 2 req/s (leaky bucket 40)
- GraphQL: coût calculé par champ (shop info = 1, product = 2, variants = 2/variant)
- Metafields: coûteux — limiter `first: 5` pas `first: 250`
- En cas de 429 : attendre `Retry-After` header (1-60s)

### Step 3 : Optimisation des scripts Node.js

**Ajouter un délai adaptatif entre les requêtes** :
```javascript
// Avant
for (const batch of batches) { execQuery(batch); }

// Après — respecter les rate limits
for (const batch of batches) {
  execQuery(batch);
  await new Promise(r => setTimeout(r, 500)); // 500ms entre appels
}
```

**Mémoriser les résultats en cache local** :
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

### Step 4 : Optimisation des prompts Claude

Si le script utilise Claude API pour générer du contenu :

- **Utiliser le prompt caching** (`cache_control: { type: "ephemeral" }`) pour les system prompts longs
- **Batching Claude** : générer 10 meta titles en un seul appel plutôt que 1 par 1
- **Modèle adapté** : Haiku pour les tâches répétitives simples (meta descriptions), Sonnet pour le contenu complexe

### Step 5 : Rapport d'optimisation

Afficher :
```
Avant optimisation :
  - X requêtes GraphQL pour Y produits
  - Coût estimé : Z query points
  - Durée estimée : T secondes

Après optimisation :
  - X' requêtes (économie : N%)
  - Coût estimé : Z' query points
  - Durée estimée : T' secondes
```

### Step 6 : Appliquer les optimisations

Modifier le fichier cible avec les optimisations validées.
Toujours tester sur 5 produits avant de lancer sur 100.
