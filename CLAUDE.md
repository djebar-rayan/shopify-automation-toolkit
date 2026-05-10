# CLAUDE.md — Règles techniques critiques

> Conventions et règles **non-négociables** pour quiconque (humain ou agent IA)
> contribue à ce repo. Toute violation de ces règles a déjà cassé une boutique
> Shopify dans le passé — chaque règle a un coût concret.

---

## Stack

- **Shopify CLI** ≥ 3.93 (passerelle Admin GraphQL)
- **Node.js** ≥ 18 (built-ins uniquement, **aucune dépendance npm**)
- **Gemini 3.1** (Google AI Studio, modèles Flash + Flash Image)
- **Plateforme** : Windows 11 / macOS / Linux (PowerShell ou bash)

---

## Règle 1 — Toutes les requêtes GraphQL passent par `--query-file`

Sur Windows, les accolades `{}` cassent le shell. **Jamais** de `--query` inline.

```javascript
// ✅ CORRECT
fs.writeFileSync(qFile, queryString, 'utf8');
execSync(`shopify store execute --store ${STORE} --query-file "${qFile}" --output-file "${outFile}"`);

// ❌ INTERDIT
execSync(`shopify store execute --store ${STORE} --query '{ products... }'`);
```

Implémenté dans `lib/shopify-graphql.js::execGql()`.

---

## Règle 2 — `stdio: 'inherit'` obligatoire dans `execSync`

Sans TTY, le Shopify CLI sort avec code 1 même quand la requête réussit.

```javascript
// ✅
execSync(cmd, { encoding: 'utf8', timeout: 60000, stdio: 'inherit' });

// ❌
execSync(cmd, { encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
```

---

## Règle 3 — La réponse GraphQL N'A PAS d'enveloppe `.data`

Le Shopify CLI écrit directement le contenu intérieur dans le fichier de sortie.

```javascript
// ✅ CORRECT — accès direct
const edges  = res?.products?.edges || [];
const target = res?.stagedUploadsCreate?.stagedTargets?.[0];

// ❌ INTERDIT — double wrapper, retourne toujours undefined
const edges  = res?.data?.products?.edges || [];
const target = res?.data?.stagedUploadsCreate?.stagedTargets?.[0];
```

---

## Règle 4 — `resource: 'PRODUCT_IMAGE'` pour les staged uploads

Pour pousser une image vers un produit Shopify :

```javascript
// ✅ CORRECT
{ resource: 'PRODUCT_IMAGE', filename, mimeType, httpMethod: 'POST' }

// ❌ INTERDIT — rejette l'upload
{ resource: 'IMAGE', ... }
```

Implémenté dans `lib/image-upload.js::stagedUploadFromFile()`.

---

## Règle 5 — Le bloc livraison `📦` ouvre TOUJOURS la description

Convention métier (configurable via `SHOP_LIVRAISON_HTML` dans `.env`).

```javascript
// ✅ CORRECT — utilise les builders
const { injectLivraison, repositionLivraison } = require('./lib/builders/livraison');
const newHtml = injectLivraison(currentHtml);

// ❌ INTERDIT — bloc en fin
const newHtml = cleaned + LIVRAISON_BLOCK;
```

---

## Règle 6 — `read_metafields` n'est PAS un scope OAuth Shopify valide

Les metafields produits sont inclus dans `read_products`. Ne jamais ajouter
`read_metafields` ou `write_metafields` dans `shopify store auth --scopes` :
cela provoque une OAuth error.

```bash
# ✅ CORRECT
shopify store auth --store <store> \
  --scopes read_products,write_products,read_content,write_content,read_themes,write_files

# ❌ INTERDIT — OAuth error
... --scopes read_products,read_metafields,write_metafields,...
```

---

## Modèles Gemini

| Constante | Valeur par défaut | Usage |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.1-flash-image-preview` | **Génération/édition d'images uniquement** |
| `GEMINI_TEXT_MODEL` | `gemini-3.1-flash-lite-preview` | Texte (descriptions, prompts, meta) |
| `GEMINI_VISION_MODEL` | `gemini-3.1-flash-lite-preview` | Analyse d'images (vision) |

> `GEMINI_VISION_MODEL` et `GEMINI_TEXT_MODEL` partagent la même valeur :
> Flash Lite gère nativement texte + images.
>
> Ne JAMAIS utiliser `GEMINI_MODEL` (Flash Image) pour analyse ou texte —
> il refuse avec `blockReason: OTHER`.

La clé API doit commencer par `AIza` (Google AI Studio). Les tokens OAuth
(`AQ...`) ne fonctionnent pas.

---

## Pattern `execGql` (`lib/shopify-graphql.js`)

1. Écrire la query dans `.audit-tmp/gq.graphql`
2. Écrire les variables dans `.audit-tmp/gv.json`
3. Exécuter `shopify store execute ... --query-file ... --output-file ...`
4. Lire le fichier de sortie et parser le JSON
5. Retourner le JSON parsé (sans enveloppe `.data`)

## Pattern staged upload (`lib/image-upload.js`)

```
stagedUploadsCreate → resourceUrl + parameters + url
  ↓
multipartPost (upload binaire vers le bucket de staging)
  ↓
productCreateMedia (attache resourceUrl au produit)
```

## Pipeline génération image

```
buildPrompt(product, …)
  ↓
callGeminiTextWithRetry — amélioration du prompt (optionnelle)
  ↓ délai DELAY_GEMINI
callGeminiImageWithRetry — génération
  ↓
validateGeneratedImage — taille ≥ 50 KB, ≥ 800×800
  ↓
sauvegarde locale dans generated-images/
```

---

## Limitations connues

- **`menus` GraphQL** : retourne `ACCESS_DENIED` même avec `read_content`.
  Endpoint indisponible via `store execute` (nécessite App privée avec
  `read_online_store_navigation`). `fetch-store-data.js` écrit un stub.
- **Rate limit Gemini** : 10 req/min en tier gratuit. Délai
  `DELAY_GEMINI=6500` ms entre appels. Sur 429 : retry après 60 s (max 3).
- **`productReorderMedia`** : mutation **asynchrone**. Retourne un Job ID,
  pas un résultat immédiat — `store execute` ne suit pas le job.
- **Port 13387 occupé** lors de `shopify store auth` :
  ```powershell
  netstat -ano | findstr ':13387'
  Stop-Process -Id <PID> -Force
  ```

---

## Réutilisabilité

Pour adapter le toolkit à une nouvelle boutique :

1. Copier `.env.example` → `.env`
2. Remplir `SHOPIFY_STORE`, `SHOP_BRAND_NAME`, `SHOP_BRAND_VOCABULARY`,
   `SHOP_LIVRAISON_HTML`, `GEMINI_API_KEY`
3. `shopify store auth ...` (scopes au-dessus)
4. `node fetch-store-data.js`

Aucun changement de code requis pour changer de boutique.
