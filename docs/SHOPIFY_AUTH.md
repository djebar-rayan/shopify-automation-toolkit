# Authentification Shopify

Le toolkit utilise **Shopify CLI** pour ses requêtes Admin GraphQL. Tous les appels
passent par `shopify store execute` (cf. `lib/shopify-graphql.js`).

## Scopes recommandés

```bash
shopify store auth --store <store>.myshopify.com \
  --scopes read_products,write_products,read_content,write_content,read_themes,write_files
```

| Scope | Pour quoi |
|---|---|
| `read_products`, `write_products` | tout le toolkit produits + images |
| `read_content`, `write_content` | pages CMS, collections (descriptions) |
| `read_themes` | inspection du thème actif (`audit/full-audit.js`) |
| `write_files` | staged uploads d'images |

### Scopes optionnels

| Scope | Pour quoi |
|---|---|
| `read_customers` | agrégats anonymisés dans `store-data/customers.md` |
| `read_orders` | agrégats commandes dans `store-data/orders.md` |

> ⚠️ **`read_metafields` / `write_metafields` n'existent PAS.** Les metafields
> produits sont inclus dans `read_products` / `write_products`. Ajouter
> `read_metafields` provoque une OAuth error.

## Dépannage

### "port 13387 already in use"

Le serveur OAuth local du CLI utilise ce port. S'il reste un processus
zombie d'un précédent `auth` :

**Windows / PowerShell** :
```powershell
netstat -ano | findstr ':13387'
Stop-Process -Id <PID> -Force
```

**macOS / Linux** :
```bash
lsof -ti:13387 | xargs kill -9
```

### "ACCESS_DENIED" sur certaines queries

Le scope nécessaire n'est pas accordé. Relancer `shopify store auth` avec le
scope manquant. Pour les **menus** (navigation), aucun scope `store execute`
ne fonctionne — l'endpoint nécessite une App privée avec
`read_online_store_navigation`.

### Token expiré

Le CLI re-prompte automatiquement à la prochaine commande. Si non :

```bash
shopify auth logout
shopify store auth --store <store> --scopes ...
```

### "Invalid store URL"

Le format attendu est `<nom>.myshopify.com` (sans `https://`, sans slash final).

## Vérifier l'auth actuelle

```bash
shopify store info
```

Affiche le store connecté + les scopes accordés.

## Tester une query rapidement

```bash
echo "query { shop { name } }" > /tmp/q.graphql
shopify store execute --store <store>.myshopify.com \
  --query-file /tmp/q.graphql --output-file /tmp/r.json
cat /tmp/r.json
```

Doit retourner `{"shop":{"name":"…"}}` (pas d'enveloppe `.data`).
